/* BONDI Stage 5.1: server-authoritative online client. Does not contain, run or
   receive other players' hidden Aiybai. Network failures are visible. */
(function(root){
 'use strict';
 function normalizeCode(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);}
 function serverWebSocketURL(input){
   const original=String(input||'').trim();
   if(!original)throw Error('Online server not configured yet. Enter its HTTPS address first.');
   let url;
   try{url=new URL(original);}catch(_){throw Error('Enter a valid online server URL, such as https://your-bondi-server.example.com');}
   if(url.protocol==='https:')url.protocol='wss:';
   else if(url.protocol==='http:')url.protocol='ws:';
   if(!['wss:','ws:'].includes(url.protocol))throw Error('The server address must use HTTPS or WSS.');
   if(url.protocol==='ws:'&&root.location?.protocol==='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))
     throw Error('This website requires a secure HTTPS/WSS online server.');
   if(url.username||url.password||url.search||url.hash)throw Error('Use only the server address, without passwords or query parameters.');
   if(!url.pathname.endsWith('/ws'))url.pathname=url.pathname.replace(/\/$/,'')+'/ws';
   return url.toString();
 }
 class OnlineMultiplayerClient {
   constructor({onUpdate,onError,serverUrl}={}){
     this.onUpdate=typeof onUpdate==='function'?onUpdate:()=>{};
     this.onError=typeof onError==='function'?onError:()=>{};
     this.serverUrl=serverWebSocketURL(serverUrl);
     this.room=null;this.view=null;this.clientId=null;this.seat=null;this.isHost=false;
     this.ws=null;this.intent=null;this.reconnectTimer=null;this.reconnectTries=0;
     this.stopped=true;this.generation=0;this.session=null;this.status='idle';
     this.storageKey='bondi:online:session:'+this.serverUrl;
     try{const raw=root.sessionStorage?.getItem(this.storageKey);if(raw)this.session=JSON.parse(raw);}catch(_){}
   }
   _emit(){this.onUpdate({room:this.room,view:this.view,clientId:this.clientId,seat:this.seat,isHost:this.isHost,transport:'online-server',connectionStatus:this.status});}
   _error(e){this.onError(String(e?.message||e||'Online connection error.'));}
   _send(value){if(!this.ws||this.ws.readyState!==1){this._error('Not connected to the online server.');return false;}
     this.ws.send(JSON.stringify(value));return true;}
   _storeSession(){try{if(this.session)root.sessionStorage?.setItem(this.storageKey,JSON.stringify(this.session));else root.sessionStorage?.removeItem(this.storageKey);}catch(_){}}
   _open(){
     clearTimeout(this.reconnectTimer);
     if(this.stopped)return;
     const generation=++this.generation;
     this.status=this.reconnectTries?'reconnecting':'connecting';
     this._emit();
     let ws;
     try{ws=new root.WebSocket(this.serverUrl);}catch(e){this._error(e);return;}
     this.ws=ws;
     ws.addEventListener('open',()=>{
       if(generation!==this.generation)return;
       this.reconnectTries=0;this.status='connected';this._emit();
       if(this.session?.code&&this.session.token){this._send({type:'RESUME',code:this.session.code,token:this.session.token});}
       else if(this.intent){this._send(this.intent);}
     });
     ws.addEventListener('message',evt=>{
       if(generation!==this.generation)return;
       let msg;try{msg=JSON.parse(evt.data);}catch(_){return;}
       if(msg.type==='WELCOME'){
         this.session={code:msg.code,token:msg.token,clientId:msg.clientId};
         this.clientId=msg.clientId;this._storeSession();this.status='connected';this._emit();
       }else if(msg.type==='SNAPSHOT'){
         this.room=msg.room;this.view=msg.view;this.clientId=msg.clientId;
         this.seat=msg.seat;this.isHost=!!msg.isHost;this.status='connected';this._emit();
       }else if(msg.type==='ERROR'){
         this._error(msg.message);
         if(/session expired|seat is no longer available/i.test(msg.message||'')){
           this.session=null;this._storeSession();this.stopped=true;ws.close();
         }
       }else if(msg.type==='ROOM_CLOSED'||msg.type==='LEFT'){
         this.session=null;this._storeSession();this.room=null;this.view=null;
         this.clientId=null;this.seat=null;this.isHost=false;this.stopped=true;
         this.status='closed';this._emit();
         if(msg.type==='ROOM_CLOSED')this._error('The online room has closed.');
       }
     });
     ws.addEventListener('close',()=>{
       if(generation!==this.generation)return;
       this.ws=null;
       if(this.stopped)return;
       this.status='disconnected';this._emit();
       if(++this.reconnectTries>12){this._error('Could not reconnect to the online server.');this.stopped=true;return;}
       const delay=Math.min(12000,500*2**Math.min(this.reconnectTries,5));
       this.reconnectTimer=setTimeout(()=>this._open(),delay);
     });
     ws.addEventListener('error',()=>{if(generation===this.generation)this._error('Cannot reach the online server. Check its address and whether it is running.');});
   }
   _begin(intent){
     this.leave(false);this.stopped=false;this.intent=intent;this.session=null;this._storeSession();
     this._open();
   }
   resumeRoom(){if(!this.session?.token||!this.session?.code)throw Error('No recent online room to reconnect.');this.stopped=false;this.intent=null;this._open();}
   createRoom(name){this._begin({type:'CREATE',name:String(name||'').trim().slice(0,24)});}
   joinRoom(name,code){code=normalizeCode(code);if(code.length!==6)throw Error('Enter the 6-character room code.');
     this._begin({type:'JOIN',name:String(name||'').trim().slice(0,24),code});}
   setReady(ready){this._send({type:'ACTION',action:'READY',ready:!!ready});}
   setName(name){this._send({type:'ACTION',action:'NAME',name:String(name||'').slice(0,24)});}
   setDealer(seat){this._send({type:'ACTION',action:'DEALER',seat:Number(seat)});}
   addAI(){this._send({type:'ACTION',action:'ADD_AI'});}
   removeAI(seat){this._send({type:'ACTION',action:'REMOVE_AI',seat:Number(seat)});}
   startGame(){this._send({type:'ACTION',action:'START'});}
   playCard(cardId){this._send({type:'ACTION',action:'PLAY',cardId:String(cardId)});}
   leave(notify=true){
     clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.stopped=true;
     const oldWs=this.ws;
     if(notify&&oldWs?.readyState===1){try{oldWs.send(JSON.stringify({type:'ACTION',action:'LEAVE'}));}catch(_){}}
     this.generation++;this.ws=null;
     if(oldWs)try{oldWs.close();}catch(_){}
     this.session=null;this._storeSession();this.room=null;this.view=null;this.clientId=null;this.seat=null;this.isHost=false;
     this.status='idle';this.reconnectTries=0;
     if(notify)this._emit();
   }
 }
 root.BondiOnline={OnlineMultiplayerClient,serverWebSocketURL};
})(window);
