'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const data=new Map();
const storage={
 getItem:k=>data.has(k)?data.get(k):null,
 setItem:(k,v)=>data.set(k,String(v)),
 removeItem:k=>data.delete(k),
 key:i=>[...data.keys()][i]||null,
 get length(){return data.size;}
};
const root={
 BondiMultiplayerCore:Core,
 document:{hidden:false},
 addEventListener(){},removeEventListener(){},
 setInterval:()=>0,clearInterval(){},
 crypto:{randomUUID:()=> 'host-local-'+Math.random().toString(36).slice(2)}
};
const ctx={window:root,localStorage:storage,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},console,Date,Math};
vm.runInNewContext(fs.readFileSync(__dirname+'/multiplayer-browser.js','utf8'),ctx,{filename:'multiplayer-browser.js'});
const MultiplayerClient=root.BondiMultiplayer.MultiplayerClient;
const errors=[];
const mp=new MultiplayerClient({engine:Engine,aiDelay:1,resolutionDelay:1000,onUpdate(){},onError:e=>errors.push(e)});
const total=()=>mp.game.players.reduce((n,p)=>n+p.hand.length,0);
(async()=>{
 try{
  mp.createRoom('Local');
  for(let i=0;i<3;i++)mp.addAI();
  mp.setReady(true);
  mp.startGame();
  assert(mp.game,'same-browser host game starts');
  clearTimeout(mp.aiTimer);
  mp.game.lastResolution={type:'normal',leadSuit:'♣',cards:[],winnerIndex:2};
  mp.game.trick=[];mp.game.currentPlayer=0;mp.resolutionPause=false;mp.aiybaiWindowOpen=true;mp.pauseUntil=0;
  // Model a real completed Aiy transition into a human lead.
  const beforeResolution=structuredClone(mp.game);
  beforeResolution.trick=[{playerIndex:1,card:mp.game.players[1].hand[0]}];
  mp._afterPlay(beforeResolution);
  assert.equal(mp.resolutionPause,true,'human leader gets the same 1000ms as AI');
  assert(mp.pauseUntil>=Date.now()+850&&mp.pauseUntil<=Date.now()+1150,'human pause has a 1-second deadline');
  assert.equal(mp.aiybaiWindowOpen,true,'request stays available during pause');
  const before=mp.game.players.map(p=>p.hand.length);
  mp.requestAiybai();
  assert.deepEqual(JSON.parse(JSON.stringify(mp.game.aiybaiRequest)),{fromSeat:0,toSeat:1});
  assert.equal(mp.view.aiybaiRequest.toSeat,1);
  assert.equal(mp.view.players[1].hand.length,0,'hidden AI hand never projected');
  assert.equal(mp.view.aiybaiWindowOpen,false);
  assert.equal(total(),52);
  await new Promise(r=>setTimeout(r,280));
  assert.equal(mp.game.players[1].status,'finished','AI can accept only after requested');
  assert.equal(mp.game.players[0].hand.length,before[0]+before[1]);
  assert.equal(mp.view.players[1].handCount,0);
  assert.equal(total(),52);
  assert.equal(mp.aiybaiWindowOpen,false);
  assert.equal(mp.resolutionPause,false,'no pause after agreement');
  assert.equal(mp.game.aiybaiRequest,undefined);
  assert.equal(Core.nextAiybaiSeat(mp.view,0),2);
  assert.deepEqual(errors,[],'no same-browser errors');
  // After a two-player Aiy, the next AI leader must also respect the
  // one-second review, without waiting an additional aiDelay afterward.
  mp.game.currentPlayer=2;
  mp.game.players[3].hand=[];mp.game.players[3].status='finished';
  mp.game.trick=[];mp.game.lastResolution={type:'normal',leadSuit:'♠',cards:[
    {playerIndex:2,card:{id:'9♠',rank:'9',suit:'♠',value:9}},
    {playerIndex:0,card:{id:'6♠',rank:'6',suit:'♠',value:6}}]};
  const previousAI=structuredClone(mp.game);
  previousAI.trick=structuredClone(mp.game.lastResolution.cards);
  mp._afterPlay(previousAI);
  assert.equal(mp.resolutionPause,true,'two-player Aiy stays visible when AI leads');
  assert.equal(mp.view.resolutionPause,true);
  assert.equal(mp.view.lastResolution.cards.length,2);
  assert.equal(mp.aiTimer,null,'next AI lead is not queued during review');
  await new Promise(r=>setTimeout(r,1130));
  assert.equal(mp.resolutionPause,false);
  assert.equal(mp.game.trick.length,1,'AI leads just after the 1-second review');
  assert.deepEqual(errors,[],'no local play errors');
  console.log('PASS same-browser Aiybai consent and 1-second two-player AI-lead review');
 }finally{mp.leave(false);}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
