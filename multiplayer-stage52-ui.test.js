'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
class FakeClassList {
 constructor(){this.items=new Set()}
 add(x){this.items.add(x)}remove(x){this.items.delete(x)}
 contains(x){return this.items.has(x)}
 toggle(x,v){if(v===undefined)v=!this.contains(x);if(v)this.add(x);else this.remove(x);return v}
}
class FakeElement {
 constructor(id){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.scrollLeft=0;this.disabled=false;this.classList=new FakeClassList();this.handlers={};}
 addEventListener(name,fn){this.handlers[name]=fn}
 querySelectorAll(){return []}
 click(){if(this.handlers.click)this.handlers.click({target:this})}
}
const elements=new Map();
const getElement=id=>{if(!elements.has(id))elements.set(id,new FakeElement(id));return elements.get(id)};
let newestClient=null;
class FakeOnlineClient {
 constructor(args){this.args=args;newestClient=this;this.room=null;this.view=null;this.status='idle'}
 createRoom(){this.created=true}
 retryConnection(){this.retried=true}
 leave(){this.room=null}
}
const document={getElementById:getElement,title:'BONDI'};
const localStorage={getItem(){return null},setItem(){}};
const sessionStorage={getItem(){return null},setItem(){}};
const window={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',addEventListener(){},location:{protocol:'https:'}};
const BondiOnline={serverWebSocketURL:s=>'wss://bondi-online.onrender.com/ws',OnlineMultiplayerClient:FakeOnlineClient};
const BondiMultiplayer={normalizeCode:s=>s,MultiplayerClient:class {}};
const BondiMultiplayerCore={canStart(){return false}};
const BondiEngineReady={then(fn){fn()}};
const context={document,window,navigator:{clipboard:{writeText:async()=>{}}},localStorage,sessionStorage,BondiOnline,BondiMultiplayer,BondiMultiplayerCore,BondiEngineReady,BondiEngine:{},setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},Date,console};
vm.runInNewContext(js,context,{filename:'index-inline.js'});
assert.equal(getElement('transportMode').value,''); // Browser's selected-option parsing isn't simulated here.
getElement('transportMode').value='online';
getElement('createRoom').click();
assert.equal(newestClient.created,true);
const room={phase:'game',code:'STAGE5',hostClientId:'one',dealerSeat:3,seats:[
 {seat:0,name:'Ali',clientId:'one',connected:true,ready:true},
 {seat:1,name:'Mariam',clientId:'two',connected:true,ready:true},
 {seat:2,name:'AI 1',clientId:null,isAI:true,connected:true},
 {seat:3,name:'AI 2',clientId:null,isAI:true,connected:true}]};
const view={dealer:3,currentPlayer:0,leadSuit:null,trick:[],lastResolution:null,message:'Ali to play',players:room.seats.map((s,i)=>({name:s.name,status:'active',handCount:13,hand:i===0?[{id:'A♥',rank:'A',suit:'♥'}]:[]})),log:[],roundOver:false,resolutionPause:false};
const push=(status,overrideRoom=room,overrideView=view)=>{newestClient.room=overrideRoom;newestClient.view=overrideView;newestClient.args.onUpdate({room:overrideRoom,view:overrideView,clientId:'one',seat:0,isHost:true,transport:'online-server',connectionStatus:status})};
push('connected');
assert.match(getElement('turnNotice').textContent,/YOUR TURN/);
assert.equal(document.title,'🃏 Your turn · BONDI');
assert.ok(!getElement('hand').innerHTML.includes('disabled'));
assert.match(getElement('gamePresence').textContent,/Connected/);
assert.ok(getElement('seats').innerHTML.includes('Seat 1'));
push('disconnected');
assert.match(getElement('turnNotice').textContent,/Reconnecting/);
assert.ok(getElement('hand').innerHTML.includes('disabled'));
assert.equal(getElement('play').disabled,true);
assert.equal(getElement('retryGame').classList.contains('hidden'),false);
getElement('retryGame').click();assert.equal(newestClient.retried,true);
const disconnectedRoom=JSON.parse(JSON.stringify(room));
disconnectedRoom.seats[1].connected=false;disconnectedRoom.seats[1].reconnectUntil=Date.now()+47000;
push('connected',disconnectedRoom);
assert.match(getElement('gamePresence').textContent,/Mariam \(Seat 2\) disconnected · 4[67]s/);
assert.ok(getElement('seats').innerHTML.includes('offline'));
const escaped=JSON.parse(JSON.stringify(room));escaped.seats[1].name='<img src=x onerror=alert(1)>';
const otherView=JSON.parse(JSON.stringify(view));otherView.players[1].name=escaped.seats[1].name;
push('connected',escaped,otherView);
assert.ok(!getElement('seats').innerHTML.includes('<img'));
assert.ok(getElement('seats').innerHTML.includes('&lt;img'));
console.log('PASS Stage 5.2 browser interface: turn banner, reconnect UI, server grace countdown, seat labels, name escaping');
