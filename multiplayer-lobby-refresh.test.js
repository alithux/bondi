'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
for(const id of ['chooseCreate','chooseJoin','joinChoicePanel','createChoicePanel','connectionOptions','hostControls','shareRoom','shareStatus','lobbyCount','lobbyProgress'])assert.match(html,new RegExp(`id="${id}"`));
class ClassList{constructor(){this.items=new Set()}contains(x){return this.items.has(x)}toggle(x,v){if(v===undefined)v=!this.contains(x);if(v)this.items.add(x);else this.items.delete(x);} }
class Element {constructor(id){this.id=id;this.value='';this.innerHTML='';this.textContent='';this.disabled=false;this.classList=new ClassList();this.handlers={};this.attrs={};}
 addEventListener(event,fn){this.handlers[event]=fn}setAttribute(k,v){this.attrs[k]=v}querySelectorAll(){return []}click(){return this.handlers.click?.({target:this})} }
const els=new Map(),$=id=>{if(!els.has(id))els.set(id,new Element(id));return els.get(id)};
const session={getItem(){return null},setItem(){},removeItem(){}};
let current,clipboard='';
class FakeClient{constructor(args){current=this;this.args=args;this.created=[];this.joined=[];this.ais=0;this.readies=[];this.starts=0;this.rematches=0;}
 createRoom(name){this.created.push(name)}joinRoom(name,code){this.joined.push([name,code])}setReady(x){this.readies.push(x)}startGame(){this.starts++}requestRematch(){this.rematches++}addAI(){this.ais++}removeAI(){}setDealer(){}leave(){} }
const document={getElementById:$,title:'BONDI'};
const window={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:'?room=ABC123'},addEventListener(){}};
const ctx={window,document,localStorage:session,sessionStorage:session,console,Date,setInterval:()=>0,setTimeout:()=>0,clearTimeout:()=>{},navigator:{clipboard:{writeText:async value=>clipboard=value}},
 BondiOnline:{serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws',OnlineMultiplayerClient:FakeClient},
 BondiMultiplayer:{normalizeCode:x=>x.toUpperCase(),MultiplayerClient:class{}},
 BondiMultiplayerCore:{canStart:room=>room.seats.every(s=>s.isAI||(s.clientId&&s.ready&&s.connected))},
 BondiEngineReady:{then:fn=>fn()},BondiEngine:{}};
vm.runInNewContext(js,ctx,{filename:'multiplayer-lobby-refresh.js'});
assert.equal($('joinCode').value,'ABC123');assert.equal($('multiSetup').classList.contains('hidden'),false);
assert.equal($('joinChoicePanel').classList.contains('hidden'),false);
assert.equal($('createChoicePanel').classList.contains('hidden'),true);
console.log('PASS shared invite URL preselects Join and fills the six-character code without autojoining');
$('chooseCreate').click();assert.equal($('createChoicePanel').classList.contains('hidden'),false);$('chooseJoin').click();assert.equal($('joinChoicePanel').classList.contains('hidden'),false);
$('playerName').value='Phone';$('transportMode').value='online';$('joinRoom').click();assert.deepEqual(current.joined,[['Phone','ABC123']]);
console.log('PASS new Create/Join selection routes actions to the original online client');
const room={code:'ABC123',phase:'lobby',matchNumber:1,hostClientId:'host',dealerSeat:3,seats:[
 {seat:0,clientId:'host',name:'Host <One>',connected:true,isAI:false,ready:false},
 {seat:1,clientId:'guest',name:'Phone',connected:true,isAI:false,ready:false},
 {seat:2,clientId:null,name:'',connected:false,isAI:false,ready:false},
 {seat:3,clientId:null,name:'',connected:false,isAI:false,ready:false}]};
function update(isHost,clientId){current.args.onUpdate({room,view:null,clientId,seat:isHost?0:1,isHost,connectionStatus:'connected'});}
update(true,'host');
assert.equal($('hostControls').classList.contains('hidden'),false);
assert.equal($('startRoom').classList.contains('hidden'),false);
assert.equal($('startRoom').disabled,true);
assert.match($('lobbyProgress').textContent,/2 seats remaining/);
assert.match($('lobbySeats').innerHTML,/Host &lt;One&gt;/);
$('fillAI').click();assert.equal(current.ais,2,'fill-AI sends precisely one request for each empty seat');
console.log('PASS host has clear next action and AI fill sends exact empty-seat count');
update(false,'guest');assert.equal($('hostControls').classList.contains('hidden'),true);
assert.equal($('startRoom').classList.contains('hidden'),true);
$('readyButton').click();assert.deepEqual(current.readies,[true]);
room.seats[2]={seat:2,name:'AI 1',isAI:true,ready:true,connected:true};room.seats[3]={seat:3,name:'AI 2',isAI:true,ready:true,connected:true};
room.seats[1].ready=true;
update(false,'guest');assert.match($('lobbyProgress').textContent,/Waiting for Host/);
console.log('PASS guest sees only relevant readiness controls and waiting guidance');
room.seats[0].ready=true;
update(true,'host');assert.equal($('startRoom').disabled,false);assert.equal($('startRoom').textContent,'Start next game');
$('startRoom').click();assert.equal(current.starts,1);
(async()=>{
 await $('copyRoomCode').click();assert.equal(clipboard,'ABC123');assert.match($('shareStatus').textContent,/copied/i);
 await $('shareRoom').click();assert.equal(clipboard,'https://alithux.github.io/bondi/?room=ABC123');assert.match($('shareStatus').textContent,/link copied/i);
 console.log('PASS copy room code and copy shareable, prefilling invite link');
 console.log('STAGE 5.6.1 MULTIPLAYER LOBBY UI: ALL PASS');
})().catch(e=>{console.error(e);process.exitCode=1});