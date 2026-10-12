'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const {RoomService}=require('./online-server/room-service.js');

const html=fs.readFileSync(__dirname+'/index.html','utf8');
assert.match(html,/function beginSoloAiyReview\(\)/,'solo game reviews every completed Aiy');
assert.match(html,/renderSolo\(\);\},1000\);/,'solo human pause is exactly 1000ms');
assert.match(html,/aiTimer=setTimeout\(playSoloAI,1000\)/,'solo AI move interval is exactly 1000ms');
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
 assert.equal(service.resolutionDelay,1000,'online human lead default is 1 second');
 const pauseStart=Date.now();
 service._afterPlay(entry,before);
 assert.equal(entry.resolutionPause,true,'human lead waits 1000ms');
 assert(entry.resolutionTimer,'human lead has a scheduled unlock');
 assert(entry.pauseUntil>=pauseStart+970&&entry.pauseUntil<=pauseStart+1150,'1-second target');
 assert.equal(entry.aiybaiWindowOpen,true,'leader can request Aiybai during pause');
 assert(Core.requestAiybai(entry.room,entry.game,'host',true).ok,
   'leader can still make request while pause is active');
 await new Promise(resolve=>setTimeout(resolve,1120));
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
 // When only two players remain, keep their completed cards visible
 // during the same one-second transition, even when an AI leads next.
 const aiEntry=service._roomEntry({...started.room,code:'AILEAD'});
 aiEntry.game=structuredClone(state);
 for(const i of [1,3]){aiEntry.game.players[i].hand=[];aiEntry.game.players[i].status='finished';}
 aiEntry.game.currentPlayer=2;
 aiEntry.game.lastResolution={type:'normal',leadSuit:'♠',winnerIndex:2,cards:[
   {playerIndex:2,card:{id:'9♠',rank:'9',suit:'♠',value:9}},
   {playerIndex:0,card:{id:'6♠',rank:'6',suit:'♠',value:6}}]};
 const previousAI=structuredClone(aiEntry.game);
 previousAI.trick=structuredClone(aiEntry.game.lastResolution.cards);
 service.rooms.set('AILEAD',aiEntry);
 service.aiDelay=1000;
 const aiReviewStart=Date.now();
 service._afterPlay(aiEntry,previousAI);
 assert.equal(aiEntry.game.players.filter(p=>p.status==='active').length,2);
 assert.equal(aiEntry.resolutionPause,true,'AI leader also holds resolved Aiy for a second');
 assert(aiEntry.resolutionTimer,'one-second display timer exists for AI lead');
 assert.equal(aiEntry.aiTimer,null,'AI is not scheduled to play during card review');
 assert(aiEntry.pauseUntil>=aiReviewStart+970&&aiEntry.pauseUntil<=aiReviewStart+1150);
 const projected=Core.projectGame(aiEntry.room,aiEntry.game,'host',aiEntry.resolutionPause,aiEntry.aiybaiWindowOpen);
 assert.equal(projected.lastResolution.cards.length,2,'both players cards remain visible in snapshot');
 assert.equal(projected.resolutionPause,true);
 await new Promise(resolve=>setTimeout(resolve,1120));
 assert.equal(aiEntry.resolutionPause,false,'review ends after about one second');
 assert.equal(aiEntry.game.trick.length,1,'AI plays at end of review without second one-second wait');
 console.log('PASS one-second card review for human and two-player AI leads, without extra AI delay');
}finally{service.shutdown();}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;});

