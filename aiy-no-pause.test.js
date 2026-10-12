'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const {RoomService}=require('./online-server/room-service.js');

const html=fs.readFileSync(__dirname+'/index.html','utf8');
assert.doesNotMatch(html,/beginSoloResolutionPause|2200\)/,
  'solo mode must not pause for 2.2 seconds after Aiy resolution');
assert.match(html,/view\.currentPlayer===me&&player\?\.status/,'request UI is leader-only');

let room=Core.createRoom({code:'NOPAUS',hostClientId:'host',hostName:'Host'});
for(let i=0;i<3;i++)room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
room=Core.applyLobbyAction(room,{type:'SET_READY',clientId:'host',ready:true});
const started=Core.startGame(room,Engine,()=>0.44);
let before=started.game;
let state=before,plays=0;
while(!state.lastResolution&&!state.roundOver&&plays++<8){
 const index=state.currentPlayer;
 const legal=Engine.legalMoves(state,index);
 assert(legal.length>0);
 before=state; // The state immediately before the play that resolved this Aiy.
 const result=Engine.playCard(state,index,legal[0].id);
 assert(result.ok);
 state=result.state;
}
assert(state.lastResolution,'a real Aiy must have resolved');
assert.equal(state.trick.length,0,'Aiy completely ended');
const service=new RoomService({aiDelay:100000});
const entry=service._roomEntry(started.room);
entry.game=state;
service.rooms.set(started.room.code,entry);
try{
 service._afterPlay(entry,before);
 assert.equal(entry.resolutionPause,false,'no forced between-Aiy pause');
 assert.equal(entry.resolutionTimer,null,'no delayed timer to unlock the next Aiy');
 assert.equal(entry.pauseUntil,0);
 assert.equal(entry.aiybaiWindowOpen,true,'next leader may make a request on their own turn');
 const leader=state.currentPlayer;
 assert.equal(Core.requestAiybai(entry.room,entry.game,'host',true).ok,leader===0,
   'only next leader can request, never other players');
 const leadResult=Engine.playCard(entry.game,leader,Engine.legalMoves(entry.game,leader)[0].id);
 assert(leadResult.ok);
 const previous=entry.game;
 entry.game=leadResult.state;
 service._afterPlay(entry,previous);
 assert.equal(entry.resolutionPause,false,'first card of next Aiy is immediately playable');
 assert.equal(entry.aiybaiWindowOpen,false,'request closes once next Aiy begins');
}finally{service.shutdown();}
console.log('PASS no forced solo or multiplayer delay, next-leader request and immediate lead');
