'use strict';
const http=require('node:http');
const {upgradeWebSocket}=require('./websocket.js');
const {RoomService}=require('./room-service.js');
const port=Number(process.env.PORT||8080);
const origins=(process.env.BONDI_ALLOWED_ORIGINS||'https://alithux.github.io,http://localhost:8080,http://127.0.0.1:8080').split(',').map(x=>x.trim()).filter(Boolean);
const store=process.env.DATABASE_URL?
  new (require('./room-store.js').PostgresRoomStore)({connectionString:process.env.DATABASE_URL}):null;
const service=new RoomService({store,logger:(...args)=>console.warn('[BONDI]',...args)});
const server=http.createServer((req,res)=>{
  if(req.url==='/health'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:!service.persistenceLastError,service:'BONDI online rooms',
      rooms:service.rooms.size,persistence:!store?'not_configured':service.persistenceLastError?'degraded':'postgres_ready'}));
  }else{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.on('upgrade',(req,socket,head)=>upgradeWebSocket(req,socket,head,peer=>service.attach(peer),{allowedOrigins:origins}));
const sweep=setInterval(()=>service.cleanIdleRooms(),60*1000);sweep.unref();
async function start(){
  try{
    const recovered=await service.restore();
    server.listen(port,'0.0.0.0',()=>console.log(
      `BONDI online server ready on port ${port}; recovered rooms: ${recovered}; persistence: ${store?'Postgres':'not configured'}; allowed origins: ${origins.join(', ')}`));
  }catch(err){
    console.error('[BONDI] Database startup failed; refusing to start without recovering rooms:',err.message);
    process.exitCode=1;
    process.exit(1);
  }
}
let stopping=false;
function stop(){
  if(stopping)return;
  stopping=true;clearInterval(sweep);
  service.shutdown({preserveStore:!!store});
  const emergency=setTimeout(()=>process.exit(1),8000);emergency.unref();
  service.flushPersistence().then(()=>store?.close())
    .then(()=>server.close(()=>process.exit(0)))
    .catch(err=>{console.error('[BONDI] Shutdown persistence failed:',err.message);process.exit(1);});
}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
start();
module.exports={server,service};
