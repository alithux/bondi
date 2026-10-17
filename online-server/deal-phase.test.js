'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {RoomService}=require('./room-service.js');
const Core=require('../multiplayer-core.js');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Peer extends EventEmitter{
 constructor(){super();this.messages=[];this.closed=false;}
 sendJSON(x){this.messages.push(JSON.parse(JSON.stringify(x)));}
 write(action,extra={}){this.emit('message',JSON.stringify({type:'ACTION',action,...extra}));}
 latest(type){return this.messages.filter(x=>x.type===type).at(-1);}
 close(){this.closed=true;this.emit('close');}
}
function host(s){const p=new Peer();s.attach(p);p.emit('message',JSON.stringify({type:'CREATE',name:'Host'}));return p;}
function start(s,dealer=1){
 const p=host(s),code=p.latest('WELCOME').code;
 p.write('ADD_AI');p.write('ADD_AI');p.write('ADD_AI');
 p.write('DEALER',{seat:dealer});p.write('READY',{ready:true});p.write('START');
 return {p,entry:s.rooms.get(code),code};
}
(async()=>{
 const human=new RoomService({dealMs:100,aiDelay:1,resolutionDelay:0});
 try{
  const {p,entry}=start(human,1);
  assert.equal(entry.game.currentPlayer,0,'host is first player');
  const card=entry.game.players[0].hand[0].id;
  const before=entry.game;
  assert(entry.room.dealUntil>Date.now(),'server publishes a real dealing deadline');
  p.write('PLAY',{cardId:card});
  assert.match(p.latest('ERROR').message,/Wait until dealing finishes/);
  assert.equal(entry.game,before,'human cannot play before dealing');
  assert.equal(p.latest('SNAPSHOT').view.trick.length,0);
  await wait(145);
  assert.equal(entry.room.dealUntil,0,'deadline clears and is broadcast');
  assert.equal(p.latest('SNAPSHOT').room.dealUntil,0,'all seats learn that the deal ended');
  p.write('PLAY',{cardId:card});
  assert.notEqual(entry.game,before,'regular human play resumes after deal');
 }finally{human.shutdown();}
 const ai=new RoomService({dealMs:125,aiDelay:1,resolutionDelay:0});
 try{
  const {entry}=start(ai,0);
  assert(Core.isAISeat(entry.room,entry.game.currentPlayer),'AI begins this game');
  const startPlayer=entry.game.currentPlayer,initial=entry.game.trick.length;
  await wait(50);
  assert.equal(entry.game.trick.length,initial,'AI cannot play while cards are flying');
  assert.equal(entry.game.currentPlayer,startPlayer);
  await wait(135);
  assert(entry.game.trick.length>0||entry.game.currentPlayer!==startPlayer,
   'AI gets its scheduled turn after dealing completes');
 }finally{ai.shutdown();}
 console.log('PASS server locks human and AI until animated opening deal ends, then resumes normal play');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
