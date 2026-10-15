/* BONDI Stage 5.14.2 — offline solo mode + installable app.
   Only publicly shipped static files are cached. Room snapshots, WebSocket
   traffic, credentials, and opponent Aiybai never enter this cache. */
'use strict';
const CACHE_NAME = 'bondi-static-v5.14.2';
const APP_SHELL = './';
const PRECACHE = [
  APP_SHELL,
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  ...Array.from({length:10},(_,i)=>'./source-part-'+String(i+1).padStart(2,'0')+'.js?v=5.14.2'),
  './game-engine.js?v=5.14.2',
  './multiplayer-core.js?v=5.14.2',
  './multiplayer-browser.js?v=5.14.2',
  './online-config.js?v=5.14.2',
  './online-client.js?v=5.14.2'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache=>cache.addAll(PRECACHE))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith('bondi-static-')&&key!==CACHE_NAME)
      .map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    // A live page load always prefers the newest HTML; when the phone has
    // no signal, fall back to the complete pre-cached solo app shell.
    event.respondWith(fetch(request).catch(()=>caches.open(CACHE_NAME)
      .then(cache=>cache.match(APP_SHELL))));
    return;
  }
  if(!PRECACHE.some(path=>new URL(path,self.registration.scope).href===url.href))return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
    const cached=await cache.match(request);
    return cached||fetch(request);
  }));
});
