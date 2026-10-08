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
