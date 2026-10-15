'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
assert.match(html,/id="handLayout"/,'hand layout selector exists');
assert.match(html,/value="straight">Straight/);
assert.match(html,/value="arc">Arc/);
assert.match(html,/\.cards\.arc \.card\.selected\{/,'selected card has an arc-specific raised position');
assert.match(html,/\.cards\.arc\s*\{[^}]*overflow-x:auto/,'arc remains scrollable for large Aiybai');
assert.match(html,/\.cards\.arc \.card:focus-visible/,'overlapping keyboard-focused cards remain visible');

function boot(savedValue,failStorage=false){
 class ClassList{
  constructor(){this.values=new Set(['hidden']);}
  contains(v){return this.values.has(v);}
  toggle(v,on){if(on===undefined)on=!this.values.has(v);if(on)this.values.add(v);else this.values.delete(v);}
 }
 class Element{
  constructor(id){this.id=id;this.value='';this.innerHTML='';this.textContent='';this.scrollLeft=0;this.disabled=false;this.classList=new ClassList();this.events={};this.dataset={};}
  addEventListener(type,fn){this.events[type]=fn;}
  click(){return this.events.click?.({target:this});}
  setAttribute(){}
  querySelectorAll(sel){if(this.id==='hand'&&sel==='[data-card]'){this.buttons=[...this.innerHTML.matchAll(/data-card="([^"]+)"/g)].map(match=>{const b=new Element('card');b.dataset.card=match[1];return b;});return this.buttons;}return [];}
 }
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 let client, saved=null;
 class FakeClient{
  constructor(opts){this.opts=opts;client=this;}
  createRoom(){}
  playCard(card){this.played=card;}
 }
 const storage={
  getItem(key){if(failStorage)throw Error('storage blocked');return key==='bondi:hand-layout'?savedValue:null;},
  setItem(key,v){if(failStorage)throw Error('storage blocked');saved=[key,v];},
  removeItem(){}
 };
 const win={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',
   location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:''},
   addEventListener(){}};
 const ctx=vm.createContext({
  window:win,document:{getElementById:$,title:'BONDI'},
  localStorage:storage,sessionStorage:storage,console,Date,setInterval:()=>0,
  setTimeout:()=>0,clearTimeout:()=>{},navigator:{},
  BondiEngineReady:{then:fn=>fn()},BondiEngine:Engine,
  BondiMultiplayer:{normalizeCode:x=>x.toUpperCase(),MultiplayerClient:FakeClient},
  BondiOnline:{serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws',OnlineMultiplayerClient:FakeClient},
  BondiMultiplayerCore:Core
 });
 vm.runInContext(script,ctx,{filename:'aiybai-layout-inline.js'});
 function shape(mode){$('handLayout').value=mode;$('handLayout').events.change({target:$('handLayout')});}
 return {$,shape,getSaved:()=>saved,getClient:()=>client};
}
const { $, shape,getSaved,getClient}=boot(undefined);
assert.equal($('handLayout').value,'straight','Straight is the default for returning players');
$('soloMode').click();
$('newGame').click();
const initial=$('hand').innerHTML;
assert.equal($('hand').classList.contains('arc'),false);
assert.equal(($('hand').innerHTML.match(/data-card=/g)||[]).length,13);
shape('arc');
assert.deepEqual(getSaved(),['bondi:hand-layout','arc'],'choice persists on the device');
assert.equal($('hand').classList.contains('arc'),true);
assert.equal($('hand').classList.contains('straight'),false);
assert.match($('hand').innerHTML,/--fan-angle:-12\.0deg;--fan-rise:17\.0px/,'first card tilts to the left');
assert.match($('hand').innerHTML,/--fan-angle:0\.0deg;--fan-rise:0\.0px/,'middle card is upright and raised');
assert.match($('hand').innerHTML,/--fan-angle:12\.0deg;--fan-rise:17\.0px/,'last card tilts to the right');
assert.match($('hand').innerHTML,/aria-pressed="false"/,'selection accessibility remains');
const firstCard=$('hand').buttons[0];
firstCard.click();
assert.equal($('play').disabled,false,'tapping an arc card still selects it');
assert.match($('hand').innerHTML,/aria-pressed="true"/,'selected arc card is announced');
shape('straight');
assert.deepEqual(getSaved(),['bondi:hand-layout','straight']);
assert.equal($('hand').classList.contains('arc'),false);
assert.equal($('hand').classList.contains('straight'),true);
assert.equal(($('hand').innerHTML.match(/data-card=/g)||[]).length,13);
assert.match($('hand').innerHTML,/aria-pressed="true"/,'changing shape preserves selected card');
const fresh=boot('arc');
assert.equal(fresh.$('handLayout').value,'arc','saved arc choice is restored on refresh');
fresh.$('soloMode').click();fresh.$('newGame').click();
assert.equal(fresh.$('hand').classList.contains('arc'),true);
assert.match(fresh.$('hand').innerHTML,/--fan-angle:12\.0deg/);

const online=boot('arc');
online.$('multiMode').click();
online.$('playerName').value='Ay';online.$('createRoom').click();
const peer=online.getClient();
let room=Core.createRoom({code:'AB1234',hostClientId:'host',hostName:'Ay'});
for(let i=0;i<3;i++)room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
room=Core.applyLobbyAction(room,{type:'SET_READY',clientId:'host',ready:true});
const started=Core.startGame(room,Engine,()=>0.35),view=Core.projectGame(started.room,started.game,'host');
view.currentPlayer=0;view.resolutionPause=false;
peer.opts.onUpdate({room:started.room,view,seat:0,clientId:'host',isHost:true,connectionStatus:'connected'});
assert.equal(online.$('hand').classList.contains('arc'),true,'multiplayer uses the same setting');
assert.equal((online.$('hand').innerHTML.match(/data-card=/g)||[]).length,13);
const onlineFirst=online.$('hand').buttons[0];onlineFirst.click();
assert.equal(online.$('play').disabled,false,'arc cards remain clickable in online play');
online.shape('straight');
assert.equal(online.$('hand').classList.contains('arc'),false);
assert.equal((online.$('hand').innerHTML.match(/data-card=/g)||[]).length,13);
const restricted=boot('arc',true);
restricted.$('soloMode').click();restricted.$('newGame').click();
assert.equal(restricted.$('hand').classList.contains('arc'),false,'blocked storage falls back to Straight');
restricted.shape('arc');
assert.equal(restricted.$('hand').classList.contains('arc'),true,'arc still works if storage writes fail');
console.log('PASS Aiybai straight/arc selection, saved preference, 13-card fan, solo + online input and storage fallback');
