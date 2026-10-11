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
const mp=new MultiplayerClient({engine:Engine,aiDelay:1,resolutionDelay:5000,onUpdate(){},onError:e=>errors.push(e)});
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
  mp.game.trick=[];mp.resolutionPause=true;mp.aiybaiWindowOpen=true;mp.pauseUntil=Date.now()+5000;
  mp._commitSharedGame();
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
  assert.equal(mp.game.aiybaiRequest,undefined);
  assert.equal(Core.nextAiybaiSeat(mp.view,0),2);
  assert.deepEqual(errors,[],'no same-browser errors');
  console.log('PASS same-browser Aiybai request, AI acceptance, 52 cards, hidden hand and next active');
 }finally{mp.leave(false);}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
