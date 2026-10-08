'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const vm=require('node:vm');
const fs=require('node:fs');
const {RoomService}=require('./online-server/room-service.js');
const {upgradeWebSocket}=require('./online-server/websocket.js');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=5000){const start=Date.now();while(Date.now()-start<timeout){const val=fn();if(val)return val;await wait(10);}throw new Error('Timed out waiting for condition');}
function createClient(url,values=new Map()){const updates=[];const errors=[];
 const window={URL,WebSocket,location:{protocol:'http:'},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 const context=vm.createContext({window,URL,WebSocket,console,setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync(require.resolve('./online-client.js'),'utf8'),context,{filename:'online-client.js'});
 const client=new window.BondiOnline.OnlineMultiplayerClient({serverUrl:url,onUpdate:s=>updates.push(s),onError:s=>errors.push(s)});
 return {client,updates,errors,values};
}
(async()=>{
 const service=new RoomService({aiDelay:2,resolutionDelay:5,graceMs:4000});
 const server=http.createServer();
 const peers=new Set();
 server.on('upgrade',(req,socket,head)=>upgradeWebSocket(req,socket,head,peer=>{peers.add(peer);service.attach(peer);},{allowedOrigins:[]}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 try{
  const {client:h,errors:herrors}=createClient(url);
  const {client:g,errors:gerrors,values:gstorage}=createClient(url);
  h.createRoom('Host');
  const code=await until(()=>h.room?.code);
  assert.equal(code.length,6);
  console.log('PASS online browser client creates room',code);
  g.joinRoom('Guest',code);
  await until(()=>g.seat===1);
  await until(()=>h.room?.seats?.[1]?.name==='Guest');
  assert.notEqual(h.clientId,g.clientId);
  console.log('PASS different WebSocket clients join & sync lobby');
  h.addAI();await until(()=>h.room?.seats?.[2]?.isAI);
  h.addAI();await until(()=>h.room?.seats?.[3]?.isAI);
  h.setDealer(1);await until(()=>h.room?.dealerSeat===1);
  h.setReady(true);g.setReady(true);
  await until(()=>h.room?.seats?.[0]?.ready&&h.room?.seats?.[1]?.ready);
  h.startGame();await until(()=>h.view?.players?.[0]?.hand.length===13 && g.view?.players?.[1]?.hand.length===13);
  assert.equal(h.view.players[1].hand.length,0);
  assert.equal(g.view.players[0].hand.length,0);
  assert.equal(h.view.currentPlayer,0);
  console.log('PASS deal + private Aiybai projections');
  const card=h.view.players[0].hand[0];h.playCard(card.id);
  await until(()=>h.view?.players?.[0]?.hand.length===12);
  await until(()=>g.view?.trick?.some(x=>x.playerIndex===0));
  assert.equal(g.view.players[0].hand.length,0);
  console.log('PASS human play validated by server and synchronized to guest');
  // Intentional guest drop tests automatic reconnect and ticket-backed seat recovery.
  const clientId=g.clientId;
  g.ws.close();
  await until(()=>g.status==='disconnected');
  await until(()=>g.status==='connected' && g.clientId===clientId && g.view && g.room?.code===code,9000);
  assert.equal(g.seat,1);
  console.log('PASS guest session auto-reconnect and seat recovery');
  assert.deepEqual(herrors,[]);
  assert.deepEqual(gerrors,[]);
  // Stage 5.2: manual retry should reclaim the same reserved seat without
  // creating a second room or leaking hidden opponents' Aiybai.
  g.ws.close();
  await until(()=>g.status==='disconnected');
  g.retryConnection();
  await until(()=>g.status==='connected'&&g.seat===1&&g.clientId===clientId,4000);
  assert.equal(g.view.players[0].hand.length,0);
  console.log('PASS Stage 5.2 reconnect-now recovers original private seat');
  // Browser refresh: old context stops without sending LEAVE; new context
  // reuses sessionStorage token and reclaims the same server seat.
  const oldGuestId=g.clientId;g.stopped=true;g.ws.close();
  const {client:g2,errors:g2errors}=createClient(url,gstorage);
  g2.resumeRoom();
  await until(()=>g2.seat===1&&g2.clientId===oldGuestId&&g2.view,4000);
  assert.deepEqual(g2errors,[]);
  console.log('PASS new browser context recovers seat after page refresh');
  h.leave();g2.leave();service.shutdown();
  console.log('ONLINE CLIENT + SERVER: ALL PASS');
 }finally{service.shutdown();for(const peer of peers)peer.socket.destroy();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('FAIL',e.stack||e);process.exitCode=1;});
