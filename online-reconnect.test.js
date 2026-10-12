'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let now=0,nextTimer=1;
const timers=new Map();
function setFakeTimeout(fn,ms){const id=nextTimer++;timers.set(id,{at:now+ms,fn});return id;}
function clearFakeTimeout(id){timers.delete(id);}
function tick(ms){
 const end=now+ms;
 for(let guard=0;guard<1000;guard++){
  const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
  if(!next)break;
  timers.delete(next[0]);now=next[1].at;next[1].fn();
 }
 now=end;
}
const storageData=new Map();
const storage={
 getItem:k=>storageData.has(k)?storageData.get(k):null,
 setItem:(k,v)=>storageData.set(k,String(v)),
 removeItem:k=>storageData.delete(k)
};
const sockets=[];
class FakeSocket{
 constructor(url){this.url=url;this.readyState=0;this.events={};this.sent=[];this.closed=false;sockets.push(this);}
 addEventListener(event,fn){(this.events[event] ||= []).push(fn);}
 emit(event,value={}){for(const fn of this.events[event]||[])fn(value);}
 open(){this.readyState=1;this.emit('open');}
 reply(msg){this.emit('message',{data:JSON.stringify(msg)});}
 send(value){this.sent.push(JSON.parse(value));}
 close(){if(this.closed)return;this.closed=true;this.readyState=3;this.emit('close');}
}
const root={WebSocket:FakeSocket,sessionStorage:storage,location:{protocol:'https:'}};
const ctx={window:root,URL,setTimeout:setFakeTimeout,clearTimeout:clearFakeTimeout,console};
vm.runInNewContext(fs.readFileSync(__dirname+'/online-client.js','utf8'),ctx,{filename:'online-client.js'});
const statuses=[],errors=[];
const client=new root.BondiOnline.OnlineMultiplayerClient({
 serverUrl:'https://bondi-online.onrender.com',
 onUpdate:state=>statuses.push(state),
 onError:error=>errors.push(error)
});
const token='c'.repeat(64),code='ABC234';
client.createRoom('PC');const first=sockets.at(-1);
first.open();assert.equal(first.sent.at(-1).type,'CREATE');
first.reply({type:'WELCOME',code,token,clientId:'pc-id'});
assert.notEqual(client.status,'connected','WELCOME is not enough to prove game state synced');
first.reply({type:'SNAPSHOT',clientId:'pc-id',seat:0,isHost:true,
 room:{code,phase:'game',seats:[{clientId:'pc-id',connected:true}]},
 view:{players:[{hand:[{id:'A♠'}]}],currentPlayer:0}});
assert.equal(client.status,'connected');
assert.equal(client.view.players[0].hand[0].id,'A♠');
assert.equal(JSON.parse(storage.getItem(client.storageKey)).token,token);
first.close();assert.equal(client.status,'disconnected');
assert.equal(client.stopped,false);
tick(1000);const second=sockets.at(-1);assert.notEqual(second,first);
second.open();
assert.equal(second.sent.at(-1).type,'RESUME');
assert.equal(second.sent.at(-1).token,token);
second.reply({type:'WELCOME',code,token,clientId:'pc-id'});
assert.notEqual(client.status,'connected','must wait for private authoritative snapshot on reconnect');
second.reply({type:'SNAPSHOT',clientId:'pc-id',seat:0,isHost:true,
 room:{code,phase:'game',seats:[{clientId:'pc-id',connected:true}]},
 view:{players:[{hand:[{id:'A♠'},{id:'2♠'}]}],currentPlayer:0}});
assert.equal(client.status,'connected');
assert.equal(client.view.players[0].hand.length,2,'resync latest private hand');
assert.equal(client.reconnectTries,0);
// Simulate phone network black-holing the next connection after disconnection.
second.close();tick(1000);
const stalled=sockets.at(-1);
tick(10000);
assert.equal(stalled.closed,true,'silent WebSocket is closed after handshake watchdog');
assert.equal(client.status,'disconnected');
tick(1000);const recovered=sockets.at(-1);
assert.notEqual(recovered,stalled,'watchdog must schedule a fresh socket');
recovered.open();assert.equal(recovered.sent.at(-1).type,'RESUME');
// Another tab resumes the seat. This tab must not reconnect and steal it back.
recovered.reply({type:'SESSION_REPLACED'});
assert.equal(client.status,'replaced');
assert.equal(client.stopped,true);
assert.equal(storage.getItem(client.storageKey),null);
const socketsBefore=sockets.length;
tick(60000);assert.equal(sockets.length,socketsBefore,'replaced tab cannot auto-reconnect');
assert(statuses.some(x=>x.connectionStatus==='reconnecting'));
assert.deepEqual(errors, ['Connection timed out. Trying to reconnect…']);
console.log('PASS Stage 5.11 browser: private snapshot restore, watchdog, one active tab, no stale retry');
