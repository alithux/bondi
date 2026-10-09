'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
class ClassList{constructor(){this.names=new Set()}contains(n){return this.names.has(n)}toggle(n,v){if(v===undefined)v=!this.contains(n);if(v)this.names.add(n);else this.names.delete(n)}}
class Element{constructor(id){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.scrollLeft=0;this.disabled=false;this.classList=new ClassList();this.handlers={}}
 addEventListener(n,cb){this.handlers[n]=cb}querySelectorAll(){return []}click(){this.handlers.click?.({target:this})}}
const els=new Map(),$=id=>{if(!els.has(id))els.set(id,new Element(id));return els.get(id)};
let client,lastCopy='';
class FakeOnlineClient{constructor(args){client=this;this.args=args;}createRoom(){} requestRematch(){}leave(){} }
const document={getElementById:$,title:'BONDI'},storage={getItem(){return null},setItem(){},removeItem(){}};
const window={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',addEventListener(){},location:{protocol:'https:'}};
const context={document,window,navigator:{clipboard:{writeText:async x=>{lastCopy=x}}},localStorage:storage,sessionStorage:storage,
 BondiOnline:{serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws',OnlineMultiplayerClient:FakeOnlineClient},
 BondiMultiplayer:{normalizeCode:x=>x,MultiplayerClient:class{}},BondiMultiplayerCore:{canStart:()=>true},
 BondiEngineReady:{then:fn=>fn()},BondiEngine:{},console,Date,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0};
vm.runInNewContext(js,context,{filename:'index-stage54.js'});
$('transportMode').value='online';$('createRoom').click();
const room={code:'ADZDFG',phase:'game',matchNumber:2,hostClientId:'host',dealerSeat:3,seats:[
 {seat:0,clientId:'host',name:'pc',connected:true,isAI:false,ready:true},
 {seat:1,clientId:null,name:'Ayya',connected:true,isAI:true,ready:true,aiTakeover:true},
 {seat:2,clientId:null,name:'AI 1',connected:true,isAI:true,ready:true},
 {seat:3,clientId:null,name:'AI 2',connected:true,isAI:true,ready:true}]};
const view={dealer:3,currentPlayer:0,leadSuit:null,trick:[],pendingFinish:[],finishedOrder:[2,1,3],lastResolution:null,
 message:'pc is the last player holding cards.',roundOver:true,resolutionPause:false,
 log:['Ayya played 2♥','Player 2 has finished.','Ayya (Seat 2) left — AI controls their Aiybai until this match ends.','pc is the last player holding cards.'],
 players:room.seats.map((seat,i)=>({name:seat.name,status:i===0?'active':'finished',handCount:i===0?3:0,hand:[]}))};
client.args.onUpdate({room,view,clientId:'host',seat:0,isHost:true,connectionStatus:'connected',transport:'online-server'});
assert.match($('seats').innerHTML,/Ayya · Seat 2 · AI takeover/);
assert.doesNotMatch($('seats').innerHTML,/AI 3 · Seat 2/);
assert.match($('gamePresence').textContent,/Ayya \(Seat 2\) left · AI controls that seat/);
assert.match($('rematchHint').textContent,/Departed seats become AI/i);
console.log('PASS game view identifies Ayya historically, clearly marks AI takeover and rematch substitution');
(async()=>{
 await $('copyFullLog').handlers.click({target:$('copyFullLog')});
 assert.match(lastCopy,/Build: Stage 5\.(?:4|5|6)/);
 assert.match(lastCopy,/Seat 2: Ayya \(AI takeover after leaving\)/);
 assert.match(lastCopy,/Ayya \(Seat 2\) has finished\./);
 assert.doesNotMatch(lastCopy,/AI 3 \(Seat 2\) has finished/);
 console.log('PASS Stage 5.4 exported log preserves completed human player name across AI takeover');
 const lobby=JSON.parse(JSON.stringify(room));lobby.phase='lobby';lobby.seats[1].name='AI 3';delete lobby.seats[1].aiTakeover;
 client.args.onUpdate({room:lobby,view:null,clientId:'host',seat:0,isHost:true,connectionStatus:'connected',transport:'online-server'});
 assert.equal($('lobbyPanel').classList.contains('hidden'),false);
 assert.match($('lobbySeats').innerHTML,/AI 3/);
 assert.doesNotMatch($('lobbySeats').innerHTML,/Ayya/);
 console.log('PASS next lobby shows AI seat only after original match history is cleared');
 console.log('STAGE 5.4 BROWSER IDENTITY UI: ALL PASS');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
