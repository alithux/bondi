'use strict';
const assert=require('node:assert/strict');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const {RoomService}=require('./online-server/room-service.js');
const {EventEmitter}=require('node:events');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const card=id=>Engine.createDeck().find(c=>c.id===id);

function filledRoom(){
 let room=Core.createRoom({code:'AB1234',hostClientId:'host',hostName:'Ayya <Host>'});
 for(let i=0;i<3;i++)room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
 room=Core.applyLobbyAction(room,{type:'SET_READY',clientId:'host',ready:true});
 room=Core.applyLobbyAction(room,{type:'SET_AI_DIFFICULTY',clientId:'host',difficulty:'medium'});
 room.matchNumber=1;
 return room;
}
function testResolution(){
 const room=filledRoom();
 const {game}=Core.startGame(room,Engine,()=>0.5);
 assert.deepEqual(game.matchStats,Core.newMatchStats());
 // A two-card interrupted Aiy: the original lead player receives Bondi.
 game.currentPlayer=0;game.trick=[];game.leadSuit=null;
 game.players[0].hand=[card('2♥')];game.players[1].hand=[card('3♠')];
 game.players[2].hand=[card('7♦')];game.players[3].hand=[card('9♣')];
 const first=Engine.playCard(game,0,'2♥');
 assert.equal(first.ok,true);
 const second=Engine.playCard(first.state,1,'3♠');
 assert.equal(second.ok,true);
 assert.equal(second.state.lastResolution.type,'bondi');
 assert.equal(Core.recordAiyResolution(first.state,second.state),true);
 assert.equal(second.state.matchStats.bondiEvents,1);
 assert.equal(second.state.matchStats.bondiGiven[1],1);
 assert.equal(second.state.matchStats.bondiReceived[0],1);
 assert.equal(Core.recordAiyResolution(second.state,second.state),false);
 assert.equal(second.state.matchStats.bondiEvents,1,'rerenders cannot recount');
 const beforeNormal=structuredClone(second.state);
 beforeNormal.trick=[{playerIndex:0,card:card('2♥'),bondi:false}];
 const after=structuredClone(beforeNormal);
 after.trick=[];
 after.lastResolution={type:'normal',leadSuit:'♥',cards:[],winnerIndex:0};
 assert.equal(Core.recordAiyResolution(beforeNormal,after),true);
 assert.equal(after.matchStats.normalAiy,1);
 // After a Bondi card is returned, the very same combination can resolve
 // again. Its lastResolution data may be identical, but it is a NEW Aiy.
 const beforeRepeat=structuredClone(after);
 beforeRepeat.trick=[{playerIndex:0,card:card('2♥'),bondi:false}];
 const repeated=structuredClone(beforeRepeat);
 repeated.trick=[];
 repeated.lastResolution=structuredClone(second.state.lastResolution);
 assert.equal(Core.recordAiyResolution(beforeRepeat,repeated),true);
 assert.equal(repeated.matchStats.bondiEvents,2);
 assert.equal(repeated.matchStats.bondiGiven[1],2);
 assert.equal(repeated.matchStats.bondiReceived[0],2);
 console.log('PASS exact counts for Bondi given, Bondi received and normal Aiy');
}
function testResults(){
 const room=filledRoom(),{game}=Core.startGame(room,Engine,()=>0.5);
 game.finishedOrder=[2,0,1];game.roundOver=true;
 game.players.forEach((p,i)=>{p.hand=i===3?[card('A♣'),card('K♣')]:[];p.status=i===3?'active':'finished';});
 game.matchStats={bondiEvents:7,normalAiy:14,bondiGiven:[2,3,1,1],bondiReceived:[1,2,4,0]};
 const view=Core.projectGame(room,game,'host');
 assert.equal(view.players[3].hand.length,0,'no opponent card identities in projection');
 assert.equal(view.players[3].handCount,2);
 assert.equal(view.matchStats.bondiEvents,7);
 const result=Core.matchResults(room,view);
 assert.deepEqual(result.players.map(p=>p.seat),[2,0,1,3]);
 assert.deepEqual(result.players.map(p=>p.rank),[1,2,3,4]);
 assert.equal(result.players[3].lastHolding,true,'last holding cards is last place');
 assert.equal(result.players[0].isAI,true);
 assert.equal(result.players[0].bondiGiven,1);
 assert.equal(result.players[0].bondiReceived,4);
 assert.equal(result.bondiEvents,7);
 assert.equal(result.normalAiy,14);
 assert.equal(result.difficulty,'medium');
 assert.equal(result.firstFinisherIsAI,true);
 assert.equal(JSON.stringify(result).includes('A♣'),false,'no hidden Aiybai leak');
 const archived=Core.archiveMatch(room,game),again=Core.archiveMatch(archived,game);
 assert.equal(archived.matchHistory.length,1);
 assert.equal(again.matchHistory.length,1,'same match not archived twice');
 assert.equal(archived.matchHistory[0].firstFinisherIsAI,true);
 assert.equal(archived.matchHistory[0].bondiEvents,7);
 assert.equal(archived.roomStats.matchesPlayed,1);
 assert.deepEqual(archived.roomStats.firstPlaces,[0,0,1,0]);
 assert.deepEqual(archived.roomStats.lastPlaces,[0,0,0,1]);
 assert.deepEqual(archived.roomStats.bondiGiven,[2,3,1,1]);
 assert.deepEqual(archived.roomStats.bondiReceived,[1,2,4,0]);
 assert.deepEqual(again.roomStats,archived.roomStats,'repeated archival must not count twice');

 // A second match in exactly the same room must add to the first.
 const rematchRoom={...archived,phase:'lobby',matchNumber:2};
 const rematch=Core.startGame(rematchRoom,Engine,()=>0.5).game;
 rematch.roundOver=true;
 rematch.finishedOrder=[0,1,2];
 rematch.players.forEach((p,i)=>{p.hand=i===3?[card('A♣')]:[];p.status=i===3?'active':'finished';});
 rematch.matchStats={bondiEvents:3,normalAiy:9,bondiGiven:[1,0,2,0],bondiReceived:[0,1,2,0]};
 const combined=Core.archiveMatch({...rematchRoom,phase:'game'},rematch);
 assert.equal(combined.roomStats.matchesPlayed,2);
 assert.deepEqual(combined.roomStats.firstPlaces,[1,0,1,0]);
 assert.deepEqual(combined.roomStats.lastPlaces,[0,0,0,2]);
 assert.deepEqual(combined.roomStats.bondiGiven,[3,3,3,1]);
 assert.deepEqual(combined.roomStats.bondiReceived,[1,3,6,0]);
 assert.equal(combined.matchHistory.length,2);

 // The last-20 match-history display must not truncate overall room totals.
 let longRoom=combined;
 for(let number=3;number<=22;number++)
   longRoom=Core.archiveMatch({...longRoom,matchNumber:number},rematch);
 assert.equal(longRoom.matchHistory.length,20);
 assert.equal(longRoom.roomStats.matchesPlayed,22,'totals accumulate for all matches, not just last 20');
 assert.equal(longRoom.roomStats.firstPlaces[0],21);
 assert.deepEqual(Core.createRoom({code:'NEWRM1',hostClientId:'other',hostName:'Ayya'}).roomStats,
   Core.newRoomStats(),'creating a separate room must reset totals');
 assert.equal(Core.matchResults(archived,{...view,roundOver:false}),null);
 console.log('PASS finishing order, loser, seat stats, hidden cards and archive deduplication');
}
class FakePeer extends EventEmitter{
 constructor(){super();this.messages=[];this.closed=false;}
 sendJSON(obj){this.messages.push(JSON.parse(JSON.stringify(obj)));}
 write(data){this.emit('message',JSON.stringify(data));}
 latest(type){return this.messages.filter(m=>m.type===type).at(-1);}
 close(){if(!this.closed){this.closed=true;this.emit('close');}}
}
function attach(service){const p=new FakePeer();service.attach(p);return p;}
function send(peer,action,other={}){peer.write({type:'ACTION',action,...other});}
async function testOnline(){
 const service=new RoomService({aiDelay:0,resolutionDelay:0});
 try{
   const h=attach(service);h.write({type:'CREATE',name:'Ayya'});
   const code=h.latest('WELCOME').code;
   send(h,'AI_DIFFICULTY',{difficulty:'easy'});
   for(let i=0;i<3;i++)send(h,'ADD_AI');
   send(h,'READY',{ready:true});send(h,'START');
   const entry=service.rooms.get(code);
   let guard=0;
   while(!entry.game.roundOver&&guard++<2500){
     if(entry.resolutionPause){await sleep(1);continue;}
     if(entry.game.currentPlayer===0){
       const next=Engine.legalMoves(entry.game,0)[0];
       assert(next,'human always has a legal move');
       send(h,'PLAY',{cardId:next.id});
     }else await sleep(1);
   }
   assert(entry.game.roundOver,'online game must finish');
   assert.equal(h.latest('ERROR'),undefined);
   const final=h.latest('SNAPSHOT');
   const result=Core.matchResults(final.room,final.view);
   assert(result);
   assert.equal(result.bondiEvents,final.view.matchStats.bondiGiven.reduce((a,b)=>a+b,0));
   assert.equal(result.bondiEvents,final.view.matchStats.bondiReceived.reduce((a,b)=>a+b,0));
   assert.equal(result.players.length,4);
   assert.equal(final.room.matchHistory.length,1,'server archives match on completion');
   assert.equal(final.room.roomStats.matchesPlayed,1,'server publishes current-room totals');
   assert.equal(final.room.roomStats.firstPlaces.reduce((a,b)=>a+b,0),1);
   assert.equal(final.room.roomStats.lastPlaces.reduce((a,b)=>a+b,0),1);
   assert.equal(final.room.roomStats.bondiGiven.reduce((a,b)=>a+b,0),result.bondiEvents);
   assert.equal(result.difficulty,'easy');
   send(h,'REMATCH');
   assert.equal(h.latest('SNAPSHOT').room.phase,'lobby');
   assert.equal(h.latest('SNAPSHOT').room.matchHistory.length,1,'same-room history survives rematch');
   assert.equal(h.latest('SNAPSHOT').view,null);
   console.log('PASS full online match, correct Bondi totals, rematch history');
 }finally{service.shutdown();}
}
(async()=>{testResolution();testResults();await testOnline();})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
