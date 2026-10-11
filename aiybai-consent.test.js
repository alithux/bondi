'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const {RoomService}=require('./online-server/room-service.js');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function prepare(){
 let room=Core.createRoom({code:'QW2345',hostClientId:'host',hostName:'Alice'});
 room=Core.applyLobbyAction(room,{type:'JOIN',clientId:'guest',name:'Bob'});
 room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
 room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
 room=Core.applyLobbyAction(room,{type:'SET_READY',clientId:'host',ready:true});
 room=Core.applyLobbyAction(room,{type:'SET_READY',clientId:'guest',ready:true});
 const started=Core.startGame(room,Engine,()=>0.45);
 started.game.lastResolution={type:'normal',leadSuit:'♣',cards:[],winnerIndex:2};
 started.room.matchNumber=1;
 return started;
}
const totalCards=g=>g.players.reduce((n,p)=>n+p.hand.length,0)+g.trick.length;
function unit(){
 let {room,game}=prepare();
 assert.equal(totalCards(game),52);
 assert.equal(Core.requestAiybai(room,game,'host',false).ok,false,'no request outside break');
 const mid=structuredClone(game);mid.trick=[{playerIndex:2,card:mid.players[2].hand[0]}];
 assert.equal(Core.requestAiybai(room,mid,'host',true).ok,false,'cannot collect mid Aiy');
 const r=Core.requestAiybai(room,game,'host',true);
 assert(r.ok);assert.equal(r.toSeat,1);
 assert.equal(Core.requestAiybai(room,r.state,'host',true).ok,false,'only one pending request');
 assert.equal(Core.answerAiybai(r.state,2,true).ok,false,'no consent from other player');
 const no=Core.answerAiybai(r.state,1,false);assert(no.ok);assert.equal(no.accepted,false);
 assert.equal(totalCards(no.state),52);assert.equal(no.state.players[1].status,'active');
 assert.equal(no.state.players[0].hand.length,13);
 const yes=Core.answerAiybai(r.state,1,true);assert(yes.ok);assert(yes.accepted);
 assert.equal(yes.state.players[1].hand.length,0);
 assert.equal(yes.state.players[1].status,'finished');
 assert.deepEqual(yes.state.finishedOrder,[1]);
 assert.equal(yes.state.players[0].hand.length,26);
 assert.equal(totalCards(yes.state),52);
 assert(!yes.state.aiybaiRequest);
 const a=Core.projectGame(room,yes.state,'host');
 const b=Core.projectGame(room,yes.state,'guest');
 assert.equal(a.players[2].hand.length,0,'opponent card identities remain hidden');
 assert.equal(b.players[0].hand.length,0,'recipient cards hidden from donor');
 assert.equal(a.players[0].handCount,26);
 assert.equal(b.players[0].handCount,26);
 assert.equal(Core.nextAiybaiSeat(a,0),2,'next recipient skips finished guest using public counts');
 assert.equal(Core.requestAiybai(room,yes.state,'host',true).toSeat,2,'next active skips finished seat');
 // Keep a realistic 52-card state while removing seat 1's cards for a
 // previously-finished player and verifying the only valid target is seat 2.
 const skipped=structuredClone(game);
 skipped.players[0].hand.push(...skipped.players[1].hand);
 skipped.players[1].hand=[];skipped.players[1].status='finished';skipped.finishedOrder=[1];
 assert.equal(Core.requestAiybai(room,skipped,'host',true).toSeat,2);
 const second=Core.requestAiybai(room,skipped,'host',true);
 assert.equal(Core.answerAiybai(second.state,2,true).state.players[2].status,'finished');
 const final=Core.answerAiybai(second.state,2,true).state;
 assert.equal(final.currentPlayer,3,'if former starter finished, next active leads after them');
 assert.equal(totalCards(final),52);
 // With only two active players, consent finishes the match, keeps
 // first/last ordering, and archives same-room totals once.
 const two=structuredClone(game);
 two.players[0].hand.push(...two.players[2].hand,...two.players[3].hand);
 for(const i of [2,3]){two.players[i].hand=[];two.players[i].status='finished';}
 two.finishedOrder=[2,3];two.currentPlayer=1;
 const offer=Core.requestAiybai(room,two,'host',true);
 assert.equal(offer.toSeat,1);
 const ended=Core.answerAiybai(offer.state,1,true).state;
 assert(ended.roundOver);assert.equal(ended.players[0].hand.length,52);
 assert.deepEqual(ended.finishedOrder,[2,3,1]);
 assert.equal(ended.currentPlayer,0);
 const archived=Core.archiveMatch(room,ended);
 assert.equal(archived.roomStats.matchesPlayed,1);
 assert.deepEqual(archived.roomStats.lastPlaces,[1,0,0,0]);
 assert.deepEqual(Core.archiveMatch(archived,ended).roomStats,archived.roomStats);
 console.log('PASS core: agreement, refusal, no mid-Aiy, skip finished, sorted 52-card transfer, stats');
}
class FakePeer extends EventEmitter{
 constructor(){super();this.messages=[];this.closed=false;}
 sendJSON(message){this.messages.push(JSON.parse(JSON.stringify(message)));}
 write(message){this.emit('message',JSON.stringify(message));}
 latest(type){return this.messages.filter(m=>m.type===type).at(-1);}
 close(){if(!this.closed){this.closed=true;this.emit('close');}}
}
function connect(service){const p=new FakePeer();service.attach(p);return p;}
const action=(p,a,rest={})=>p.write({type:'ACTION',action:a,...rest});
async function online(){
 const service=new RoomService({aiDelay:10000,resolutionDelay:5000});
 try{
  const host=connect(service);host.write({type:'CREATE',name:'Alice'});
  const code=host.latest('WELCOME').code;
  const guest=connect(service);guest.write({type:'JOIN',code,name:'Bob'});
  action(host,'ADD_AI');action(host,'ADD_AI');
  action(host,'READY',{ready:true});action(guest,'READY',{ready:true});action(host,'START');
  const entry=service.rooms.get(code);
  clearTimeout(entry.aiTimer);entry.aiTimer=null;
  entry.resolutionPause=true;entry.aiybaiWindowOpen=true;
  entry.game.lastResolution={type:'normal',leadSuit:'♣',cards:[],winnerIndex:2};
  entry.game.trick=[];
  const before=entry.game.players.map(p=>p.hand.length);
  action(host,'PLAY',{cardId:entry.game.players[0].hand[0].id});
  assert.match(host.latest('ERROR').message,/wait/i);
  action(guest,'REQUEST_AIYBAI');
  const request=entry.game.aiybaiRequest;
  assert.deepEqual(request,{fromSeat:1,toSeat:2});
  assert.equal(guest.latest('SNAPSHOT').view.aiybaiRequest.toSeat,2);
  assert.equal(guest.latest('SNAPSHOT').view.players[2].hand.length,0,'AI card identities hidden');
  assert.equal(host.latest('SNAPSHOT').view.players[1].hand.length,0);
  action(host,'ANSWER_AIYBAI',{accept:true});
  assert.match(host.latest('ERROR').message,/only the requested/i);
  service.aiDelay=0;
  // The AI acceptance timer was created with the original AI delay.
  clearTimeout(entry.resolutionTimer);
  service._settleAiybai(entry,2,true);
  // Do not let AI auto-play while exercising subsequent manual requests.
  service.aiDelay=10000;
  assert.equal(entry.game.players[2].status,'finished');
  assert.equal(entry.game.players[2].hand.length,0);
  assert.equal(entry.game.players[1].hand.length,before[1]+before[2]);
  assert.equal(totalCards(entry.game),52);
  assert.equal(entry.aiybaiWindowOpen,false);
  assert.equal(entry.game.aiybaiRequest,undefined);
  await sleep(850);
  assert.equal(entry.resolutionPause,false);
  // Explicit human agreement and rejection must work with seat ownership.
  entry.resolutionPause=true;entry.aiybaiWindowOpen=true;
  action(host,'REQUEST_AIYBAI'); // host targets seat 1 human
  assert.deepEqual(entry.game.aiybaiRequest,{fromSeat:0,toSeat:1});
  action(guest,'ANSWER_AIYBAI',{accept:false});
  assert.equal(entry.game.players[1].hand.length,before[1]+before[2]);
  assert.equal(entry.game.aiybaiRequest,undefined);
  assert.equal(entry.aiybaiWindowOpen,false);
  entry.resolutionPause=true;entry.aiybaiWindowOpen=true;
  action(host,'REQUEST_AIYBAI');
  action(guest,'ANSWER_AIYBAI',{accept:true});
  assert.equal(entry.game.players[1].status,'finished');
  assert.equal(entry.game.players[0].hand.length,before[0]+before[1]+before[2]);
  assert.equal(totalCards(entry.game),52);
  console.log('PASS online: human/AI consent, authorization, hidden cards, pause/resume, decline');
 }finally{service.shutdown();}
}
(async()=>{unit();await online();})().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
