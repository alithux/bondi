'use strict';
const http=require('node:http');
const {upgradeWebSocket}=require('./websocket.js');
const {RoomService}=require('./room-service.js');
const port=Number(process.env.PORT||8080);
const origins=(process.env.BONDI_ALLOWED_ORIGINS||'https://alithux.github.io,http://localhost:8080,http://127.0.0.1:8080').split(',').map(x=>x.trim()).filter(Boolean);
const service=new RoomService({logger:(...args)=>console.warn('[BONDI]',...args)});
const server=http.createServer((req,res)=>{
  if(req.url==='/health'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:true,service:'BONDI online rooms',rooms:service.rooms.size}));
  }else{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.on('upgrade',(req,socket,head)=>upgradeWebSocket(req,socket,head,peer=>service.attach(peer),{allowedOrigins:origins}));
const sweep=setInterval(()=>service.cleanIdleRooms(),60*1000);sweep.unref();
server.listen(port,'0.0.0.0',()=>console.log(`BONDI online server ready on port ${port}; allowed origins: ${origins.join(', ')}`));
function stop(){clearInterval(sweep);service.shutdown();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2500).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
module.exports={server,service};
