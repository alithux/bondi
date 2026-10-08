'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const http=require('node:http');
const {RoomService}=require('./room-service.js');
const {upgradeWebSocket}=require('./websocket.js');
const Engine=require('./load-engine.js');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class FakePeer extends EventEmitter {
  constructor(){super();this.messages=[];this.closed=false;}
  sendJSON(msg){this.messages.push(JSON.parse(JSON.stringify(msg)));}
  write(msg){this.emit('message',JSON.stringify(msg));}
  latest(type){return this.messages.filter(x=>x.type===type).at(-1);}
  close(){if(!this.closed){this.closed=true;this.emit('close');}}
}
function peer(service){const p=new FakePeer();service.attach(p);return p;}
function cmd(p,action,rest={}){p.write({type:'ACTION',action,...rest});}
function create(service,name='Host'){const p=peer(service);p.write({type:'CREATE',name});return p;}
function join(service,code,name='Guest'){const p=peer(service);p.write({type:'JOIN',code,name});return p;}
async function test(name,fn){await fn();console.log('PASS',name);}
(async()=>{
 await test('creates/join rooms; lobby identity and host-only controls',async()=>{
  const s=new RoomService({aiDelay:1,resolutionDelay:1});
  const h=create(s),code=h.latest('WELCOME').code;
  const g=join(s,code);
  assert.notEqual(h.latest('WELCOME').token,g.latest('WELCOME').token);
  assert.equal(g.latest('SNAPSHOT').seat,1);
  cmd(g,'START');assert.match(g.latest('ERROR').message,/not allowed|host/i);
  cmd(g,'ADD_AI');assert.match(g.latest('ERROR').message,/host/i);
  cmd(h,'ADD_AI');cmd(h,'ADD_AI');
  cmd(h,'READY',{ready:true});cmd(g,'READY',{ready:true});cmd(h,'START');
  assert.equal(h.latest('SNAPSHOT').room.phase,'game');
  assert.equal(g.latest('SNAPSHOT').room.phase,'game');
  s.shutdown();
 });
 await test('hidden opponents cards and valid move enforcement',async()=>{
  const s=new RoomService({aiDelay:200,resolutionDelay:1});
  const h=create(s),code=h.latest('WELCOME').code,g=join(s,code);
  cmd(h,'ADD_AI');cmd(h,'ADD_AI');cmd(h,'DEALER',{seat:3});
  cmd(h,'READY',{ready:true});cmd(g,'READY',{ready:true});cmd(h,'START');
  const a=h.latest('SNAPSHOT'),b=g.latest('SNAPSHOT');
  assert.equal(a.view.players[0].hand.length,13);
  assert.equal(a.view.players[1].hand.length,0);
  assert.equal(b.view.players[0].hand.length,0);
  assert.equal(b.view.players[1].hand.length,13);
  assert.notDeepEqual(a.view.players[0].hand,b.view.players[1].hand);
  const turn=a.view.currentPlayer;
  const mover=turn===0?h:turn===1?g:null;
  if(mover){cmd(mover,'PLAY',{cardId:'not-a-card'});assert.match(mover.latest('ERROR').message,/legal|not your turn/i);}
  s.shutdown();
 });
 await test('opponent cannot forge turn, dealer, game state or another seat',async()=>{
  const s=new RoomService({aiDelay:1000,resolutionDelay:1});
  const h=create(s),code=h.latest('WELCOME').code,g=join(s,code);
  cmd(h,'ADD_AI');cmd(h,'ADD_AI');cmd(h,'READY',{ready:true});cmd(g,'READY',{ready:true});cmd(h,'START');
  const snap=g.latest('SNAPSHOT'),before=s.rooms.get(code).game;
  g.write({type:'ACTION',action:'DEALER',seat:1,room:{phase:'lobby'},game:{currentPlayer:1}});
  assert.equal(s.rooms.get(code).game,before);
  cmd(g,'PLAY',{cardId:'A♠',clientId:h.latest('WELCOME').clientId});
  assert.equal(s.rooms.get(code).game,before);
  assert.ok(g.latest('ERROR'));
  s.shutdown();
 });
 await test('disconnect and resume with secret restores seat; unknown token refused',async()=>{
  const s=new RoomService({graceMs:500,aiDelay:200,resolutionDelay:1});
  const h=create(s),code=h.latest('WELCOME').code,g=join(s,code);
  const {token,clientId}=g.latest('WELCOME');
  g.close();
  assert.equal(h.latest('SNAPSHOT').room.seats[1].connected,false);
  const f=peer(s);f.write({type:'RESUME',code,token:'a'.repeat(64)});
  assert.match(f.latest('ERROR').message,/expired/);
  const r=peer(s);r.write({type:'RESUME',code,token});
  assert.equal(r.latest('WELCOME').clientId,clientId);
  assert.equal(r.latest('SNAPSHOT').room.seats[1].connected,true);
  s.shutdown();
 });
 await test('Stage 5.2 rejects duplicate online identities without consuming a seat',async()=>{
  const s=new RoomService({graceMs:200});
  const h=create(s,'Ali'),code=h.latest('WELCOME').code;
  const dup=join(s,code,'  aLi  ');
  assert.match(dup.latest('ERROR').message,/name is already used/i);
  assert.equal(dup.latest('WELCOME'),undefined);
  assert.equal(s.rooms.get(code).room.seats[1].clientId,null);
  const g=join(s,code,'Mariam');assert.equal(g.latest('SNAPSHOT').seat,1);
  cmd(g,'NAME',{name:'ali'});
  assert.match(g.latest('ERROR').message,/name is already used/i);
  assert.equal(s.rooms.get(code).room.seats[1].name,'Mariam');
  cmd(g,'NAME',{name:'Hassan'});
  assert.equal(s.rooms.get(code).room.seats[1].name,'Hassan');
  s.shutdown();
 });
 await test('Stage 5.2 disconnected seat shows server-provided deadline and clears on resume',async()=>{
  const s=new RoomService({graceMs:120,aiDelay:2,resolutionDelay:2});
  const h=create(s,'Ali'),code=h.latest('WELCOME').code,g=join(s,code,'Mariam');
  const {token,clientId}=g.latest('WELCOME');
  const before=Date.now();g.close();
  const seat=h.latest('SNAPSHOT').room.seats[1];
  assert.equal(seat.connected,false);
  assert.ok(seat.reconnectUntil>=before+100&&seat.reconnectUntil<=Date.now()+130);
  const r=peer(s);r.write({type:'RESUME',code,token});
  assert.equal(r.latest('WELCOME').clientId,clientId);
  const resumed=h.latest('SNAPSHOT').room.seats[1];
  assert.equal(resumed.connected,true);assert.equal(resumed.reconnectUntil,undefined);
  await wait(145);
  assert.equal(s.rooms.get(code).room.seats[1].name,'Mariam');
  s.shutdown();
 });
 await test('Stage 5.2 expired disconnected game seat becomes AI and gameplay continues',async()=>{
  const s=new RoomService({graceMs:80,aiDelay:2,resolutionDelay:1});
  const h=create(s,'Ali'),code=h.latest('WELCOME').code,g=join(s,code,'Mariam');
  cmd(h,'ADD_AI');cmd(h,'ADD_AI');cmd(h,'READY',{ready:true});cmd(g,'READY',{ready:true});cmd(h,'START');
  assert.equal(s.rooms.get(code).room.phase,'game');
  const token=g.latest('WELCOME').token;g.close();
  assert.equal(h.latest('SNAPSHOT').room.seats[1].connected,false);
  await wait(110);
  const snap=h.latest('SNAPSHOT');
  assert.equal(snap.room.seats[1].isAI,true);
  assert.equal(snap.room.seats[1].clientId,null);
  assert.equal(snap.room.seats[1].reconnectUntil,undefined);
  const late=peer(s);late.write({type:'RESUME',code,token});
  assert.match(late.latest('ERROR').message,/expired|available/);
  s.shutdown();
 });
 await test('real WebSocket handshake over Node HTTP, welcome and room state',async()=>{
  const s=new RoomService();
  const server=http.createServer((req,res)=>{res.writeHead(200);res.end('OK');});
  server.on('upgrade',(req,sock,head)=>upgradeWebSocket(req,sock,head,p=>s.attach(p),{allowedOrigins:[]}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`ws://127.0.0.1:${server.address().port}/ws`;
  const ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  const welcomes=[];
  ws.addEventListener('message',e=>welcomes.push(JSON.parse(e.data)));
  ws.send(JSON.stringify({type:'CREATE',name:'Mobile'}));
  for(let i=0;i<30&&!welcomes.find(x=>x.type==='SNAPSHOT');i++)await wait(20);
  assert.ok(welcomes.some(x=>x.type==='WELCOME'));
  assert.equal(welcomes.find(x=>x.type==='SNAPSHOT').room.phase,'lobby');
  ws.close();await wait(10);s.shutdown();await new Promise(resolve=>server.close(resolve));
 });
 await test('Stage 5.3 rematch keeps room, resets human readiness and creates fresh game',async()=>{
  const s=new RoomService({aiDelay:500,resolutionDelay:0});
  try{
   const h=create(s,'Ayya'),code=h.latest('WELCOME').code,g=join(s,code,'Fathun');
   cmd(h,'ADD_AI');cmd(h,'ADD_AI');cmd(h,'READY',{ready:true});cmd(g,'READY',{ready:true});cmd(h,'START');
   const entry=s.rooms.get(code);
   assert.equal(entry.room.matchNumber,1);
   cmd(h,'REMATCH');assert.match(h.latest('ERROR').message,/finish the current game/i);
   entry.game.roundOver=true;
   cmd(g,'REMATCH');assert.match(g.latest('ERROR').message,/only the host/i);
   cmd(h,'REMATCH');assert.equal(entry.room.phase,'lobby');assert.equal(entry.game,null);
   assert.deepEqual(entry.room.seats.map(x=>x.ready),[false,false,true,true]);
   assert.equal(g.latest('SNAPSHOT').view,null);
   cmd(h,'START');assert.match(h.latest('ERROR').message,/ready/i);
   cmd(h,'READY',{ready:true});cmd(g,'READY',{ready:true});cmd(h,'START');
   assert.equal(entry.room.matchNumber,2);assert.equal(entry.game.roundOver,false);
   assert.equal(entry.game.players[0].hand.length,13);
   assert.equal(g.latest('SNAPSHOT').view.players[0].hand.length,0);
   assert.equal(entry.room.code,code);
  }finally{s.shutdown();}
 });
 // Server-local gameplay stress: single human + three Hard AI, no leaking or illegal plays.
 await test('20 complete online rooms with Hard AI and private seat projections',async()=>{
  const s=new RoomService({aiDelay:0,resolutionDelay:0});
  let totalMoves=0;
  for(let game=0;game<20;game++){
   const h=create(s,`Human${game}`),code=h.latest('WELCOME').code;
   cmd(h,'ADD_AI');cmd(h,'ADD_AI');cmd(h,'ADD_AI');cmd(h,'READY',{ready:true});cmd(h,'START');
   let guard=0;
   while(!s.rooms.get(code).game.roundOver&&guard++<2200){
    const entry=s.rooms.get(code);
    if(entry.resolutionPause){await wait(1);continue;}
    if(entry.game.currentPlayer===0){
      const legal=Engine.legalMoves(entry.game,0);
      assert.ok(legal.length);
      cmd(h,'PLAY',{cardId:legal[0].id});totalMoves++;
      const err=h.latest('ERROR');assert.equal(err,undefined,err&&err.message);
    }else{await wait(1);}
   }
   assert.ok(s.rooms.get(code).game.roundOver,`game ${game} stalled at ${guard}`);
   assert.ok(!h.latest('SNAPSHOT').view.players.some((p,i)=>i!==0&&p.hand.length>0));
   cmd(h,'LEAVE');
  }
  s.shutdown();
  console.log('ONLINE STRESS:',20,'complete games,',totalMoves,'human moves, 0 illegal, 0 stalled');
 });
})().catch(e=>{console.error('FAIL',e.stack||e);process.exitCode=1;});
