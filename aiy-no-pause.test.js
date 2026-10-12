'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const {RoomService}=require('./online-server/room-service.js');

const html=fs.readFileSync(__dirname+'/index.html','utf8');
assert.match(html,/function beginSoloHumanLeadPause\(\)/,'solo human Aiy leads get a brief pause');
assert.match(html,/renderSolo\(\);\},650\);/,'solo human pause is exactly 650ms');
assert.doesNotMatch(html,/2200\)/,'obsolete long solo pause is removed');
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
(async()=>{
try{
 // Force the new leader to be human; the preceding Aiy genuinely resolved.
 entry.game.currentPlayer=0;
 const pauseStart=Date.now();
 service._afterPlay(entry,before);
 assert.equal(entry.resolutionPause,true,'human lead waits 650ms');
 assert(entry.resolutionTimer,'human lead has a scheduled unlock');
 assert(entry.pauseUntil>=pauseStart+630&&entry.pauseUntil<=pauseStart+800,'650ms target');
 assert.equal(entry.aiybaiWindowOpen,true,'leader can request Aiybai during pause');
 assert(Core.requestAiybai(entry.room,entry.game,'host',true).ok,
   'leader can still make request while pause is active');
 await new Promise(resolve=>setTimeout(resolve,720));
 assert.equal(entry.resolutionPause,false,'human turn unlocked without extra waiting');
 assert.equal(entry.pauseUntil,0);
 assert.equal(entry.aiybaiWindowOpen,true,'request remains available until first card');
 const leader=entry.game.currentPlayer;
 const leadResult=Engine.playCard(entry.game,leader,Engine.legalMoves(entry.game,leader)[0].id);
 assert(leadResult.ok);
 const previous=entry.game;
 entry.game=leadResult.state;
 service._afterPlay(entry,previous);
 assert.equal(entry.resolutionPause,false,'following normal card play has no extra human lead pause');
 assert.equal(entry.aiybaiWindowOpen,false,'request closes once next Aiy begins');
 // When an AI wins the Aiy, its existing 650ms move scheduling is sufficient.
 const aiEntry=service._roomEntry({...started.room,code:'AILEAD'});
 aiEntry.game=structuredClone(state);
 aiEntry.game.currentPlayer=1;
 service.rooms.set('AILEAD',aiEntry);
 service.aiDelay=650;
 service._afterPlay(aiEntry,before);
 assert.equal(aiEntry.resolutionPause,false,'no extra 650ms before AI timer');
 assert.equal(aiEntry.resolutionTimer,null,'no stacked resolution timer for AI');
 assert(aiEntry.aiTimer,'AI keeps its own 650ms thinking timer');
 console.log('PASS exactly 650ms human lead transition, existing AI timer and leader request');
}finally{service.shutdown();}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;});

