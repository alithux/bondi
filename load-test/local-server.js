'use strict';
// Isolated-only copy of BONDI HTTP/WebSocket wiring, bound to loopback.
// No production Render credentials, hostnames, or allowed-origin settings.
const http=require('node:http');
const {RoomService}=require('../online-server/room-service.js');
const {upgradeWebSocket}=require('../online-server/websocket.js');
const port=Number(process.env.PORT);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Local test requires PORT');
const service=new RoomService({logger:(...args)=>console.warn('[BENCH]',...args)});
const server=http.createServer((req,res)=>{
 if(req.url==='/health'&&req.method==='GET'){
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({ok:true,service:'BONDI isolated benchmark',rooms:service.rooms.size}));
 }else{res.writeHead(404);res.end('Not found');}
});
server.on('upgrade',(req,socket,head)=>
 upgradeWebSocket(req,socket,head,peer=>service.attach(peer),{allowedOrigins:[]}));
server.listen(port,'127.0.0.1',()=>console.log('Isolated BONDI benchmark listening on 127.0.0.1:'+port));
function stop(){service.shutdown();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2500).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
