'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
if(process.env.BONDI_SCENARIOS!=='1'){
 console.error('Disabled. Enable explicitly: BONDI_SCENARIOS=1 node dev/scenarios/server.js');process.exit(1);
}
const port=Number(process.env.BONDI_SCENARIO_PORT||4177);
const root=path.resolve(__dirname,'../..');
const files=new Map([['/runner.js',path.join(__dirname,'runner.js')],['/ui.js',path.join(__dirname,'ui.js')],['/fixtures.json',path.join(__dirname,'fixtures.json')],...['game-engine.js','multiplayer-core.js',...Array.from({length:10},(_,i)=>'source-part-'+String(i+1).padStart(2,'0')+'.js')].map(f=>['/'+f,path.join(root,f)])]);
http.createServer((req,res)=>{
 if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){res.writeHead(403);return res.end('Local development only');}
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const url=new URL(req.url,'http://localhost');
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(url.pathname==='/') {res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(require('./page.js'));}
 const file=files.get(url.pathname);if(!file){res.writeHead(404);return res.end('Not found');}
 res.setHeader('Content-Type',file.endsWith('.json')?'application/json; charset=utf-8':'text/javascript; charset=utf-8');
 res.end(fs.readFileSync(file));
}).listen(port,'127.0.0.1',()=>console.log(`BONDI rules lab: http://127.0.0.1:${port}`));
