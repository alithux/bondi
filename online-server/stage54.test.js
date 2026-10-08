'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {RoomService}=require('./room-service.js');
const Engine=require('./load-engine.js');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class Peer extends EventEmitter{
  constructor(){super();this.messages=[];this.closed=false;}
  sendJSON(x){this.messages.push(JSON.parse(JSON.stringify(x)));}
  write(x){this.emit('message',JSON.stringify(x));}
  latest(t){return this.messages.filter(x=>x.type===t).at(-1);}
  close(){if(!this.closed){this.closed=true;this.emit('close');}}
}
const peer=s=>{const p=new Peer();s.attach(p);return p};
const create=(s,name)=>{const p=peer(s);p.write({type:'CREATE',name});return p};
const join=(s,code,name)=>{const p=peer(s);p.write({type:'JOIN',code,name});return p};
const action=(p,act,data={})=>p.write({type:'ACTION',action:act,...data});
function setup(s,names=['Host','Ayya']){
 const h=create(s,names[0]),code=h.latest('WELCOME').code,guests=names.slice(1).map(n=>join(s,code,n));
 for(let i=names.length;i<4;i++)action(h,'ADD_AI');
 action(h,'READY',{ready:true});guests.forEach(g=>action(g,'READY',{ready:true}));action(h,'START');
 assert.equal(s.rooms.get(code).room.phase,'game');
 return {h,guests,code,entry:s.rooms.get(code)};
}
async function test(name,fn){await fn();console.log('PASS',name)}
(async()=>{
 await test('finished human keeps historic name after timeout; no retroactive AI rename',async()=>{
  const s=new RoomService({graceMs:30,aiDelay:200,resolutionDelay:0});
  try{
   const {h,guests,code,entry}=setup(s),g=guests[0];
   entry.game.players[1].status='finished';entry.game.players[1].hand=[];
   entry.game.finishedOrder=[1];
   entry.game.log.push('Player 2 has finished.');
   const token=g.latest('WELCOME').token;
   g.close();await wait(50);
   const room=entry.room,seat=room.seats[1],snap=h.latest('SNAPSHOT');
   assert.equal(seat.name,'Ayya');assert.equal(seat.aiTakeover,true);
   assert.equal(seat.isAI,true);assert.equal(seat.clientId,null);
   assert.equal(entry.game.players[1].name,'Ayya');
   assert.ok(snap.view.log.includes('Ayya (Seat 2) has finished.'),'Finish log must retain Ayya');
   assert.ok(!snap.view.log.some(x=>x.includes('AI 3 (Seat 2) has finished')));
   assert.match(snap.view.log.at(-1),/Ayya \(Seat 2\) left.*AI controls/i);
   assert.equal(snap.room.seats[1].aiTakeover,true);
   const late=peer(s);late.write({type:'RESUME',code,token});
   assert.match(late.latest('ERROR').message,/expired|available/i);
  }finally{s.shutdown();}
 });
 await test('AI takeover can play an active former-human seat, preserving its name',async()=>{
  const s=new RoomService({graceMs:30,aiDelay:3,resolutionDelay:0});
  try{
   const {h,guests,code,entry}=setup(s),g=guests[0];
   const handBefore=entry.game.players[1].hand.length;
   entry.game.currentPlayer=1;
   g.close();await wait(90);
   assert.equal(entry.room.seats[1].isAI,true);
   assert.equal(entry.room.seats[1].name,'Ayya');
   assert.equal(entry.game.players[1].name,'Ayya');
   assert.ok(entry.game.log.some(x=>/^Ayya played /i.test(x)), 'AI resumed former human seat without stalling');
   assert.ok(entry.game.players[1].hand.length<=handBefore);
  }finally{s.shutdown();}
 });
 await test('finished departed host can regain Aiybai from Bondi and AI plays revived seat',async()=>{
  const s=new RoomService({graceMs:30,aiDelay:2,resolutionDelay:0});
  try{
   const {h,guests,code,entry}=setup(s,['pc','Ayya']),g=guests[0];
   const ace=Engine.createDeck().find(c=>c.id==='A♣');
   const diamond=Engine.createDeck().find(c=>c.id==='7♦');
   entry.game.players[0].hand=[];entry.game.players[0].status='finished';entry.game.finishedOrder=[0];
   entry.game.players[1].hand=[diamond];entry.game.players[1].status='active';
   entry.game.trick=[{playerIndex:0,card:ace,bondi:false}];
   entry.game.leadSuit='♣';entry.game.currentPlayer=1;entry.game.roundOver=false;
   h.close();await wait(45);
   assert.equal(entry.room.seats[0].isAI,true);
   assert.equal(entry.room.seats[0].name,'pc');
   assert.equal(entry.room.hostClientId,g.latest('WELCOME').clientId);
   action(g,'PLAY',{cardId:'7♦'});
   const afterBondi=entry.game;
   assert.equal(afterBondi.lastResolution.type,'bondi');
   assert.equal(afterBondi.lastResolution.recipientIndex,0);
   assert.equal(afterBondi.players[0].status,'active');
   assert.equal(afterBondi.players[0].name,'pc');
   assert.ok(afterBondi.players[0].hand.some(c=>c.id==='A♣'));
   await wait(24);
   assert.ok(entry.game.log.some(line=>line.startsWith('pc played ')), 'AI took turn after a real Bondi revival');
   assert.equal(entry.game.players[0].name,'pc');
  }finally{s.shutdown();}
 });
 await test('rematch resets takeover seats into unique AI identities; game history stays distinct',async()=>{
  const s=new RoomService({graceMs:30,aiDelay:1000,resolutionDelay:0});
  try{
   const {h,guests,code,entry}=setup(s,['Host','Ayya','Fathun']);
   for(const g of guests)g.close();
   await wait(50);
   assert.deepEqual(entry.room.seats.slice(1,3).map(x=>x.name),['Ayya','Fathun']);
   assert.deepEqual(entry.room.seats.slice(1,3).map(x=>x.aiTakeover),[true,true]);
   entry.game.roundOver=true;
   action(h,'REMATCH');
   assert.equal(entry.room.phase,'lobby');
   assert.equal(entry.room.matchNumber,1);
   assert.deepEqual(entry.room.seats.map(x=>x.name),['Host','AI 2','AI 3','AI 1']);
   assert.equal(entry.room.seats.every(x=>!x.aiTakeover),true);
   assert.equal(new Set(entry.room.seats.map(x=>x.name.toLowerCase())).size,4);
   action(h,'READY',{ready:true});action(h,'START');
   assert.equal(entry.room.matchNumber,2);
   assert.deepEqual(entry.game.players.map(x=>x.name),['Host','AI 2','AI 3','AI 1']);
   assert.equal(entry.game.players.every(x=>x.hand.length===13),true);
   assert.equal(entry.game.log.some(x=>/Ayya|Fathun/.test(x)),false,'No stale history leaks into next match');
  }finally{s.shutdown();}
 });
 await test('leaving lobby host transfers ownership; guest can ready and start same room',async()=>{
  const s=new RoomService();
  try{
   const h=create(s,'Host'),code=h.latest('WELCOME').code,g=join(s,code,'Guest');
   action(h,'LEAVE');
   const entry=s.rooms.get(code);
   assert.ok(entry,'Lobby persists when another human remains');
   assert.equal(entry.room.seats[0].clientId,null);
   assert.equal(entry.room.hostClientId,g.latest('WELCOME').clientId);
   assert.equal(g.latest('SNAPSHOT').isHost,true);
   for(let i=0;i<3;i++)action(g,'ADD_AI');
   action(g,'READY',{ready:true});action(g,'START');
   assert.equal(entry.room.phase,'game');
   assert.equal(entry.room.code,code);
  }finally{s.shutdown();}
 });
 await test('lobby host connection timeout promotes guest; only human host absence closes room',async()=>{
  const s=new RoomService({graceMs:35});
  try{
   const h=create(s,'Host'),code=h.latest('WELCOME').code,g=join(s,code,'Guest');
   h.close();await wait(50);
   const entry=s.rooms.get(code);
   assert.ok(entry,'Guest holds room after host timeout');
   assert.equal(entry.room.hostClientId,g.latest('WELCOME').clientId);
   assert.equal(g.latest('SNAPSHOT').isHost,true);
   action(g,'LEAVE');
   assert.equal(s.rooms.has(code),false,'Room closes when the last human leaves');
  }finally{s.shutdown();}
 });
 await test('rematch lobby stays open after original host times out, new host can begin match 3',async()=>{
  const s=new RoomService({graceMs:35,aiDelay:1000});
  try{
   const {h,guests,code,entry}=setup(s),g=guests[0];
   entry.game.roundOver=true;
   action(h,'REMATCH');
   assert.equal(entry.room.phase,'lobby');
   h.close();await wait(55);
   assert.equal(entry.room.hostClientId,g.latest('WELCOME').clientId);
   assert.equal(entry.room.seats[0].clientId,null);
   action(g,'ADD_AI');action(g,'READY',{ready:true});action(g,'START');
   assert.equal(entry.room.phase,'game');
   assert.equal(entry.room.matchNumber,2);
   assert.deepEqual(entry.game.players.map(x=>x.name),['AI 3','Ayya','AI 1','AI 2']);
  }finally{s.shutdown();}
 });
 console.log('STAGE 5.4 LIVE SEAT IDENTITY AND HOST RESILIENCE: ALL PASS');
})().catch(e=>{console.error('FAIL',e.stack||e);process.exitCode=1});
