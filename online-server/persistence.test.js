'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {RoomService}=require('./room-service.js');
const Engine=require('./load-engine.js');

const clone=x=>JSON.parse(JSON.stringify(x));
class MemoryStore{
 constructor(){this.rows=new Map();this.writes=0;this.fail=false;}
 async initialize(){}
 async loadAll(){return [...this.rows].map(([code,payload])=>({code,payload:clone(payload)}));}
 async save(code,payload){if(this.fail)throw Error('database unavailable');this.rows.set(code,clone(payload));this.writes++;}
 async remove(code){this.rows.delete(code);}
 async close(){}
}
class Peer extends EventEmitter{
 constructor(){super();this.messages=[];this.closed=false;}
 sendJSON(msg){this.messages.push(clone(msg));}
 latest(type){return this.messages.filter(x=>x.type===type).at(-1);}
 write(msg){this.emit('message',JSON.stringify(msg));}
 close(){if(!this.closed){this.closed=true;this.emit('close');}}
}
const attach=service=>{const p=new Peer();service.attach(p);return p;};
const act=(p,action,extra={})=>p.write({type:'ACTION',action,...extra});

(async()=>{
 const store=new MemoryStore();
 const s1=new RoomService({store,graceMs:2500,aiDelay:10000,resolutionDelay:0});
 const host=attach(s1);host.write({type:'CREATE',name:'Desktop'});
 const roomCode=host.latest('WELCOME').code,hostToken=host.latest('WELCOME').token;
 const phone=attach(s1);phone.write({type:'JOIN',code:roomCode,name:'Phone'});
 const phoneToken=phone.latest('WELCOME').token;
 act(host,'ADD_AI');act(host,'ADD_AI');
 act(host,'READY',{ready:true});act(phone,'READY',{ready:true});act(host,'START');
 const live=s1.rooms.get(roomCode);
 assert.equal(live.game.players.reduce((n,p)=>n+p.hand.length,0),52);
 const original=clone(live.game);
 await s1.flushPersistence();
 const stored=store.rows.get(roomCode);
 assert.equal(stored.version,1);
 assert.equal(stored.game.players[0].hand.length,13);
 assert.equal(stored.sessions.length,2);
 assert.equal(stored.sessions.some(x=>x.token===hostToken),true);
 assert.equal(stored.sessions.some(x=>x.token===phoneToken),true);
 s1.shutdown({preserveStore:true});
 assert.equal(host.latest('ROOM_CLOSED'),undefined,'redeploy must never erase browser resume token');
 await s1.flushPersistence();
 assert.equal(store.rows.has(roomCode),true,'room must remain stored after clean shutdown');

 // Simulate a brand-new process: none of the original in-memory maps survive.
 const s2=new RoomService({store,graceMs:2500,aiDelay:10000,resolutionDelay:0});
 try{
  assert.equal(await s2.restore(),1);
  assert.equal(s2.rooms.size,1);
  const offline=s2.rooms.get(roomCode);
  assert.deepEqual(offline.game,original,'the precise authoritative game and Aiybai are restored');
  assert.equal(offline.room.seats[0].connected,false);
  assert.equal(offline.room.seats[1].connected,false);
  assert(offline.room.seats[0].reconnectUntil>Date.now());
  const newHost=attach(s2);newHost.write({type:'RESUME',code:roomCode,token:hostToken});
  const hostSnap=newHost.latest('SNAPSHOT');
  assert.equal(hostSnap.seat,0);
  assert.equal(hostSnap.clientId,host.latest('WELCOME').clientId);
  assert.deepEqual(hostSnap.view.players[0].hand.map(x=>x.id),
    original.players[0].hand.map(x=>x.id));
  assert.equal(hostSnap.view.players[1].hand.length,0,'another human hand must remain hidden');
  const newPhone=attach(s2);newPhone.write({type:'RESUME',code:roomCode,token:phoneToken});
  const phoneSnap=newPhone.latest('SNAPSHOT');
  assert.equal(phoneSnap.seat,1);
  assert.deepEqual(phoneSnap.view.players[1].hand.map(x=>x.id),
    original.players[1].hand.map(x=>x.id));
  assert.equal(phoneSnap.view.players[0].hand.length,0);
  assert.equal(phoneSnap.room.seats[1].connected,true);
  assert.equal(phoneSnap.room.seats[1].aiTakeover,undefined);
  assert.equal(s2.sessions.size,2,'no duplicate identities');
  await s2.flushPersistence();
  assert.equal(store.rows.get(roomCode).sessions.length,2);
  const savedCount=store.writes;
  store.fail=true;
  act(newHost,'AI_DIFFICULTY',{difficulty:'medium'}); // game-phase action is rejected
  act(newHost,'LEAVE');
  await s2.flushPersistence();
  assert.equal(s2.persistenceLastError,'database unavailable','persistence failure is reported');
  store.fail=false;
  assert(store.writes>=savedCount);
 }finally{s2.shutdown({preserveStore:true});}
 console.log('PASS persistent server restart: private hands, seat tokens, reconnect, no premature AI takeover');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
