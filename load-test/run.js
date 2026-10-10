'use strict';
// BONDI isolated network load tester. Always launches its own local server.
// It has no remote URL option and never contacts the production Render instance.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {performance}=require('node:perf_hooks');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const quantile=(numbers,q)=>{
 if(!numbers.length)return null;
 const ordered=numbers.slice().sort((a,b)=>a-b);
 return Math.round(ordered[Math.ceil((ordered.length-1)*q)]*10)/10;
};
const randomizer=seed=>()=>{
 seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
 return (seed>>>0)/4294967296;
};
const timeout=(fn,ms,message)=>new Promise((resolve,reject)=>{
 const t=setTimeout(()=>reject(Error(message)),ms);
 Promise.resolve().then(fn).then(x=>{clearTimeout(t);resolve(x);},e=>{clearTimeout(t);reject(e);});
});

class VirtualClient {
 constructor(url){this.url=url;this.messages=[];this.waiters=[];this.errorCount=0;this.ws=null;this.clientId=null;}
 async connect(){
  assert(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(this.url),'Only loopback WebSocket is allowed');
  this.ws=new WebSocket(this.url);
  this.ws.addEventListener('message',evt=>{
   let msg;
   try{msg=JSON.parse(evt.data);}catch(_){return;}
   if(msg.type==='ERROR')this.errorCount++;
   if(msg.type==='WELCOME')this.clientId=msg.clientId;
   this.messages.push(msg);if(this.messages.length>10)this.messages.shift();
   for(const waiter of [...this.waiters]){
    let match=false;try{match=waiter.test(msg);}catch(err){waiter.reject(err);continue;}
    if(match)waiter.resolve(msg);
   }
  });
  await timeout(()=>new Promise((resolve,reject)=>{
   this.ws.addEventListener('open',resolve,{once:true});
   this.ws.addEventListener('error',evt=>reject(Error('WebSocket connection error: '+(evt.error?.message||evt.message||'unknown handshake failure'))),{once:true});
  }),12000,'Timed out opening a virtual player WebSocket');
  return this;
 }
 last(type){return [...this.messages].reverse().find(m=>m.type===type);}
 waitFor(test,ms=12000){
  for(let i=this.messages.length-1;i>=0;i--)if(test(this.messages[i]))return Promise.resolve(this.messages[i]);
  return new Promise((resolve,reject)=>{
   const waiter={test,resolve:value=>{clearTimeout(t);this.waiters=this.waiters.filter(x=>x!==waiter);resolve(value);},
    reject:err=>{clearTimeout(t);this.waiters=this.waiters.filter(x=>x!==waiter);reject(err);}};
   const t=setTimeout(()=>waiter.reject(Error('Timed out waiting for server message')),ms);
   this.waiters.push(waiter);
  });
 }
 send(msg){
  if(this.ws?.readyState!==WebSocket.OPEN)throw Error('Virtual player socket disconnected');
  this.ws.send(JSON.stringify(msg));
 }
 close(){try{this.ws?.close();}catch(_){}}
}
const cmd=(player,action,rest={})=>player.send({type:'ACTION',action,...rest});

function getPort(){return new Promise((resolve,reject)=>{
 const server=net.createServer();
 server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const port=server.address().port;
  server.close(()=>resolve(port));
 });
});}
async function health(port){
 const began=performance.now();
 const reply=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(2500)});
 if(!reply.ok)throw Error('Local server health HTTP '+reply.status);
 const json=await reply.json();
 if(!json.ok)throw Error('Local server unhealthy');
 return {latencyMs:performance.now()-began,rooms:json.rooms};
}
async function localServer(){
 const port=await getPort(),lines=[];
 const child=spawn(process.execPath,['load-test/local-server.js'],{
  cwd:path.resolve(__dirname,'..'),
  env:{...process.env,PORT:String(port),BONDI_ALLOWED_ORIGINS:''},
  stdio:['ignore','pipe','pipe']
 });
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{
  const x=String(b);lines.push(x);
  if(lines.length>40)lines.shift();
 });
 try{
  await timeout(async()=>{
   while(true){
    if(child.exitCode!==null)throw Error('Local server exited: '+lines.join('').slice(-1500));
    try{await health(port);return;}catch(_){await sleep(60);}
   }
  },15000,'Local BONDI server did not start');
  return {port,child,lines};
 }catch(error){child.kill('SIGKILL');throw error;}
}
async function stopServer(instance){
 if(!instance)return;
 if(instance.child.exitCode!==null)return;
 instance.child.kill('SIGTERM');
 await Promise.race([
  new Promise(r=>instance.child.once('exit',r)),
  sleep(3700).then(()=>{if(instance.child.exitCode===null)instance.child.kill('SIGKILL');})
 ]);
}
function serverRssMb(pid){
 try{
  const status=fs.readFileSync(`/proc/${pid}/status`,'utf8');
  const m=status.match(/^VmRSS:\s+(\d+)\s+kB/m);
  return m?Math.round(Number(m[1])/1024*10)/10:null;
 }catch(_){return null;}
}
async function newRoom(url,i){
 const clients=[];
 try{
  const host=await new VirtualClient(url).connect();clients.push(host);
  host.send({type:'CREATE',name:`Host ${i}`});
  const welcome=await host.waitFor(m=>m.type==='WELCOME');
  const code=welcome.code;
  await host.waitFor(m=>m.type==='SNAPSHOT'&&m.room.code===code);
  // Join three distinct virtual human players so every room has four sockets.
  for(let n=1;n<4;n++){
   const guest=await new VirtualClient(url).connect();clients.push(guest);
   guest.send({type:'JOIN',code,name:`P${n} R${i}`});
   await guest.waitFor(m=>m.type==='WELCOME');
   await guest.waitFor(m=>m.type==='SNAPSHOT'&&m.room.code===code);
  }
  for(const c of clients)cmd(c,'READY',{ready:true});
  await host.waitFor(m=>m.type==='SNAPSHOT'&&m.room.code===code&&m.room.seats.every(s=>s.ready));
  cmd(host,'START');
  await host.waitFor(m=>m.type==='SNAPSHOT'&&m.room.phase==='game'&&!!m.view,15000);
  return {clients,host,code,random:randomizer((i+1)*104729)};
 }catch(e){for(const c of clients)c.close();throw e;}
}
async function playRoom(room,deadline,latencies){
 const {clients,host}=room;
 let moves=0;
 while(Date.now()<deadline && moves<2500){
  const state=host.last('SNAPSHOT');
  if(!state?.view)throw Error('Missing game snapshot');
  if(state.view.roundOver)return {completed:true,moves};
  const turn=state.view.currentPlayer;
  const player=clients.find(c=>c.clientId===state.room.seats[turn]?.clientId);
  if(!player)throw Error('No virtual client for active player');
  const own=await player.waitFor(m=>m.type==='SNAPSHOT'&&m.room.phase==='game'&&
   m.revision>=state.revision&&m.view?.currentPlayer===turn);
  const hand=own.view.players[turn].hand;
  if(!hand?.length)throw Error('Current virtual human has no Aiybai');
  const follow=own.view.trick.length?hand.filter(c=>c.suit===own.view.leadSuit):[];
  const legal=follow.length?follow:hand;
  const pick=legal[Math.floor(room.random()*legal.length)];
  const previousErrorCount=player.errorCount;
  const before=performance.now();
  cmd(player,'PLAY',{cardId:pick.id});
  const change=await host.waitFor(m=>m.type==='SNAPSHOT'&&m.revision>state.revision&&m.view,15000);
  latencies.push(performance.now()-before);
  if(player.errorCount!==previousErrorCount)throw Error('Server refused virtual player action');
  if(change.room.code!==room.code)throw Error('Room code changed');
  moves++;
 }
 return {completed:false,moves};
}
async function stage(count,budgetMs){
 const instance=await localServer();
 const sockets=[],latencies=[],healthLatencies=[],errors=[],rooms=[];
 let peakRss=null,peakRooms=0,limitRejected=null;
 const sample=async()=>{
  const rss=serverRssMb(instance.child.pid);
  if(rss!==null)peakRss=Math.max(peakRss??0,rss);
  try{
   const h=await health(instance.port);
   healthLatencies.push(h.latencyMs);peakRooms=Math.max(peakRooms,h.rooms);
  }catch(e){errors.push('Health: '+e.message);}
 };
 const watcher=setInterval(()=>{sample().catch(e=>errors.push(e.message));},1500);
 const started=Date.now();
 try{
  const url=`ws://127.0.0.1:${instance.port}/ws`;
  // Avoid a sudden connection burst; the goal is steady concurrent rooms.
  for(let start=0;start<count;start+=10){
   const batch=await Promise.allSettled(Array.from({length:Math.min(10,count-start)},(_,offset)=>
    newRoom(url,start+offset)));
   for(const b of batch){
    if(b.status==='fulfilled'){rooms.push(b.value);sockets.push(...b.value.clients);}
    else errors.push('Room setup: '+b.reason.message);
   }
  }
  await sample();
  const observed=await health(instance.port);
  if(rooms.length!==count){console.error('Room setup diagnostics:',JSON.stringify(errors.slice(0,12)));console.error('Local server logs:',instance.lines.join('').slice(-2500));}
  assert.equal(rooms.length,count,`Only ${rooms.length}/${count} rooms started`);
  assert.equal(observed.rooms,count,'Unexpected isolated server room count');
  if(count===100){
   const extra=await new VirtualClient(url).connect();
   try{
    extra.send({type:'CREATE',name:'Over Limit'});
    const rejected=await extra.waitFor(m=>m.type==='ERROR',6000);
    limitRejected=/server is full/i.test(rejected.message);
    assert(limitRejected,'101st room must be rejected by maxRooms=100');
   }finally{extra.close();}
  }
  const deadline=Date.now()+budgetMs;
  const results=await Promise.allSettled(rooms.map(room=>playRoom(room,deadline,latencies)));
  const completed=results.filter(r=>r.status==='fulfilled'&&r.value.completed).length;
  const totalMoves=results.reduce((sum,r)=>sum+(r.status==='fulfilled'?r.value.moves:0),0);
  for(const result of results)if(result.status==='rejected')errors.push('Play: '+result.reason.message);
  await sample();
  return {
   roomsRequested:count,roomsStarted:rooms.length,virtualPlayers:count*4,
   matchesCompleted:completed,matchesUnfinished:count-completed,
   gameActions:totalMoves,elapsedSec:Math.round((Date.now()-started)/100)/10,
   actionLatencyP50Ms:quantile(latencies,.5),actionLatencyP95Ms:quantile(latencies,.95),
   healthLatencyP95Ms:quantile(healthLatencies,.95),serverPeakRssMb:peakRss,
   observedPeakRooms:peakRooms,room101Rejected:limitRejected,
   errors:errors.slice(0,12),errorCount:errors.length
  };
 }finally{
  clearInterval(watcher);
  for(const socket of sockets)socket.close();
  await stopServer(instance);
 }
}
function markdown(results){
 const heading='| Rooms | Virtual players | Matches completed | Actions | P95 action ms | P95 health ms | Peak server RAM MB | Errors |';
 const divider='|---:|---:|---:|---:|---:|---:|---:|---:|';
 return ['# BONDI isolated multiplayer load test','',
  'Run location: local Node.js process on GitHub Actions (NOT the live Render server).',
  'Simulated players are four real WebSocket clients per room using legal BONDI moves.',
  'Each scenario starts a fresh isolated server. Matches that do not finish within the bounded time window are reported as unfinished.',
  '',heading,divider,...results.map(r=>`| ${r.roomsStarted} | ${r.virtualPlayers} | ${r.matchesCompleted}/${r.roomsRequested} | ${r.gameActions} | ${r.actionLatencyP95Ms??'n/a'} | ${r.healthLatencyP95Ms??'n/a'} | ${r.serverPeakRssMb??'n/a'} | ${r.errorCount} |`),
  '','100-room configured cap enforced: '+(results.find(r=>r.roomsRequested===100)?.room101Rejected===true?'Yes':'Not checked'),
  '','Limitations: one GitHub Actions machine is not a Render Free instance; this does not establish production capacity or uptime.'
 ].join('\n');
}
async function main(){
 assert(typeof WebSocket==='function','This test requires Node.js 22+ native WebSocket.');
 const quick=process.argv.includes('--quick');
 const scenarios=quick?[[2,18000],[5,25000]]:[[10,30000],[25,45000],[50,60000],[100,90000]];
 const outputFile=process.argv.find(x=>x.startsWith('--output='))?.split('=').slice(1).join('=')||'';
 const results=[];
 for(const [rooms,budgetMs] of scenarios){
  console.log(`Starting isolated test: ${rooms} rooms / ${rooms*4} WebSockets`);
  const data=await stage(rooms,budgetMs);
  results.push(data);
  console.log('SCENARIO',JSON.stringify(data));
  if(data.errorCount || data.roomsStarted!==rooms)throw Error('Scenario had connection/gameplay/health errors at '+rooms+' rooms');
 }
 const report=markdown(results);
 console.log(report);
 if(outputFile)fs.writeFileSync(outputFile,JSON.stringify({timestamp:new Date().toISOString(),environment:{node:process.version,platform:os.platform(),cpus:os.cpus().length,totalMemoryGb:Math.round(os.totalmem()/1073741824)},scenarios:results},null,2)+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report+'\n');
}
main().catch(err=>{console.error('LOAD TEST FAILED:',err.stack||err);process.exitCode=1;});
