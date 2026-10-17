'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const zlib=require('node:zlib');
const path=require('node:path');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'./');
assert.equal(manifest.scope,'./');
assert.equal(manifest.id,'./');
for(const size of [192,512]){
 const found=manifest.icons.find(x=>x.sizes===size+'x'+size);
 assert(found&&found.type==='image/png','proper installable icon required: '+size);
}
function checkPng(name,expected){
 const raw=fs.readFileSync(path.join(__dirname,name));
 assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(raw.readUInt32BE(16),expected,'PNG width is correct');
 assert.equal(raw.readUInt32BE(20),expected,'PNG height is correct');
 const idats=[];let pos=8;
 while(pos<raw.length){
  const n=raw.readUInt32BE(pos),tag=raw.toString('ascii',pos+4,pos+8);
  if(tag==='IDAT')idats.push(raw.subarray(pos+8,pos+8+n));
  pos+=12+n;
  if(tag==='IEND')break;
 }
 assert(idats.length>0,'PNG contains actual image data');
 const uncompressed=zlib.inflateSync(Buffer.concat(idats));
 assert.equal(uncompressed.length,expected*(Math.ceil(expected/8)+1),'image bitmap decodes');
 assert(uncompressed.some(x=>x!==0),'icon must have visible artwork');
}
checkPng('icon-192.png',192);
checkPng('icon-512.png',512);
checkPng('apple-touch-icon.png',180);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.match(html,/id="installHelp"/);
assert.match(html,/id="installApp"/);
assert.match(html,/id="offlineNotice"/);
assert.match(html,/id="onlineOfflineNote"/);
assert.match(html,/navigator.serviceWorker.register\('\.\/sw\.js'\)/);
assert.match(html,/Stage 5\.15C\.1 · Animated card plays/);
const events={};
const origin='https://alithux.github.io',scope=origin+'/bondi/';
const resolve=path=>new URL(path,scope).href;
const records=new Map(),deletes=[];
function cacheFor(name){
 if(!records.has(name))records.set(name,new Map());
 const map=records.get(name);
 return {
  async addAll(paths){for(const p of paths){
   assert(fs.existsSync(pathJoin(p)),'precache file must exist '+p);
   map.set(resolve(p),{source:'cache',url:resolve(p)});
  }},
  async match(request){return map.get(resolve(typeof request==='string'?request:request.url));}
 };
}
function pathJoin(url){const stripped=url.split('?')[0];return path.join(__dirname,stripped);}
const caches={
 open:async name=>cacheFor(name),
 keys:async()=>[...records.keys()],
 delete:async name=>{deletes.push(name);return records.delete(name);}
};
let claimed=false,skip=false,networkRequests=[];
const self={
 location:{origin},registration:{scope},clients:{claim:async()=>{claimed=true;}},
 skipWaiting:async()=>{skip=true;},
 addEventListener:(name,cb)=>{events[name]=cb;}
};
const context=vm.createContext({self,caches,URL,Promise,
 fetch:async request=>{networkRequests.push(typeof request==='string'?request:request.url);throw Error('offline');}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'sw.js'),'utf8'),context,{filename:'sw.js'});
async function emit(name,request){
 let task;
 const event={
  request,
  waitUntil:promise=>{task=promise;},
  respondWith:promise=>{task=promise;}
 };
 events[name](event);
 return task?await task:null;
}
(async()=>{
 records.set('bondi-static-v5.11',new Map());
 await emit('install');
 assert(skip,'activate newly installed service worker');
 assert(records.has('bondi-static-v5.15c1-manual-aiybai'));
 assert(records.get('bondi-static-v5.15c1-manual-aiybai').size>=20,'entire public game shell is cached');
 await emit('activate');
 assert(claimed,'new worker controls future navigations');
 assert(deletes.includes('bondi-static-v5.11'));
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 for(const script of scripts){
  assert(records.get('bondi-static-v5.15c1-manual-aiybai').has(resolve(script)),script+' needs an offline copy');
 }
 const offlinePage=await emit('fetch',{url:scope+'?room=ABC123',method:'GET',mode:'navigate'});
 assert(offlinePage&&offlinePage.source==='cache','offline navigation loads cached BONDI page');
 const offlineScript=await emit('fetch',{url:resolve('source-part-01.js?v=5.15c1'),method:'GET',mode:'cors'});
 assert(offlineScript&&offlineScript.source==='cache','game engine remains accessible offline');
 const prevCalls=networkRequests.length;
 const ignored=await emit('fetch',{url:'https://bondi-online.onrender.com/health',method:'GET',mode:'cors'});
 assert.equal(ignored,null,'service worker never intercepts private remote requests');
 assert.equal(networkRequests.length,prevCalls,'service worker must not call remote multiplayer service');
 const unlisted=await emit('fetch',{url:scope+'?token=secret',method:'GET',mode:'cors'});
 assert.equal(unlisted,null,'arbitrary request with session token must not be cached');
 console.log('PASS Stage 5.15c1 installable icons, offline solo shell, navigation fallback and multiplayer privacy');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
