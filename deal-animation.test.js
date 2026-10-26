'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Engine=require('./online-server/load-engine.js');
const Core=require('./multiplayer-core.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
assert.match(html,/id="dealAnimation" class="deal-animation hidden" aria-hidden="true"/);
assert.match(html,/id="tableArena"/);
assert.match(html,/#gameArea \.deal-animation\{[^}]*pointer-events:none/,'animation cannot trap touch events');
assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{#gameArea \.deck-stack\{animation:none!important/,'Reduced Motion shows static cards');
assert.doesNotMatch(html,/@media\(prefers-reduced-motion:reduce\)\{#gameArea \.deal-animation\{display:none!important/,'never make the whole effect disappear');
assert.match(html,/id="replayDeal"/,'manual replay is available');
assert.match(html,/@keyframes bondi-shuffle/);
assert.match(html,/@keyframes bondi-deal-flight/);
assert.match(html,/Stage 5\.16\.1 · Aiy resolution effects/);

function boot(reduceMotion=false){
 class ClassList{
  constructor(){this.items=new Set(['hidden']);}
  contains(x){return this.items.has(x);}
  toggle(x,flag){if(flag===undefined)flag=!this.items.has(x);if(flag)this.items.add(x);else this.items.delete(x);}
 }
 class Element{
  constructor(id){this.id=id;this.value='';this.classList=new ClassList();this.innerHTML='';
   this.textContent='';this.events={};this.disabled=false;this.scrollLeft=0;this.clientWidth=340;
   this.offsetWidth=68;this.open=false;this.style={setProperty(){}};}
  addEventListener(k,fn){this.events[k]=fn;}
  setAttribute(){}
  click(){return this.events.click?.({target:this});}
  getBoundingClientRect(){return {width:330,height:400,left:0};}
  querySelectorAll(s){
   if(this.id==='hand'&&s==='[data-card]'){this.buttons=[...this.innerHTML.matchAll(/data-card="([^"]+)"/g)].map((m,i)=>{
    const b=new Element('card');b.dataset={card:m[1]};b.offsetLeft=i*70;return b;
   });return this.buttons;}
   return [];
  }
 }
 const els=new Map(),$=id=>{if(!els.has(id))els.set(id,new Element(id));return els.get(id);};
 const storage={getItem:()=>null,setItem(){},removeItem(){}};
 const tasks=[],canceled=[];
 let multiplayer;
 class FakeClient{
  constructor(options){this.options=options;multiplayer=this;}
  createRoom(){}
  leave(){}
  playCard(id){this.lastPlayed=id;}
 }
 const win={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',
  matchMedia:()=>({matches:reduceMotion}),
  addEventListener(){},
  location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:''}};
 const doc={getElementById:$,title:'BONDI',body:{classList:new ClassList()}};
 const ctx=vm.createContext({window:win,document:doc,localStorage:storage,sessionStorage:storage,
  navigator:{},console,Date,
  setInterval:()=>0,setTimeout:fn=>{tasks.push(fn);return tasks.length;},
  clearTimeout:id=>{canceled.push(id);},
  BondiEngineReady:{then:fn=>fn()},BondiEngine:Engine,
  BondiMultiplayerCore:Core,
  BondiMultiplayer:{MultiplayerClient:FakeClient,normalizeCode:s=>s.toUpperCase()},
  BondiOnline:{OnlineMultiplayerClient:FakeClient,serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws'}
 });
 vm.runInContext(js,ctx,{filename:'deal-animation-app.js'});
 return {$,tasks,canceled,doc,getClient:()=>multiplayer};
}
function visible(t){return !t.$('dealAnimation').classList.contains('hidden');}
const solo=boot();
assert.equal(visible(solo),false);
solo.$('soloMode').click();
solo.$('players').value='4';solo.$('dealer').value='1';solo.$('aiDifficulty').value='hard';
solo.$('newGame').click();
assert.equal(visible(solo),true,'new solo deal starts animation');
assert.equal(solo.$('gameArea').classList.contains('is-dealing'),true,'all real card faces are covered');
assert.equal(solo.$('play').disabled,true,'cannot play a card until deal ends');
assert.equal((solo.$('dealAnimation').innerHTML.match(/class="shuffle-card"/g)||[]).length,6);
assert.equal((solo.$('dealAnimation').innerHTML.match(/class="flying-card"/g)||[]).length,16);
assert.match(solo.$('dealAnimation').innerHTML,/--deal-x:-119px/,'cards fly to the left player');
assert.match(solo.$('dealAnimation').innerHTML,/--deal-y:-136px/,'cards fly to the top player');
assert.match(solo.$('dealAnimation').innerHTML,/--deal-y:136px/,'cards fly to the viewer');
assert.doesNotMatch(solo.$('dealAnimation').innerHTML,/data-card=|\bhand=|A♠|K♥/,'animation shows backs only');
assert.equal((solo.$('hand').innerHTML.match(/data-card=/g)||[]).length,13,'true hand dealt immediately');
const handBefore=[...solo.$('hand').innerHTML.matchAll(/data-card="([^"]+)"/g)].map(m=>m[1]);
solo.tasks.at(-1)();
assert.equal(visible(solo),false,'animation clears after its own timeout');
assert.equal(solo.$('gameArea').classList.contains('is-dealing'),false,'Aiybai becomes visible when dealing ends');
assert.deepEqual([...solo.$('hand').innerHTML.matchAll(/data-card="([^"]+)"/g)].map(m=>m[1]),handBefore,'finish callback never changes actual Aiybai cards');
solo.$('replayDeal').click();
assert.equal(visible(solo),true,'manual replay makes the deal visible again');
assert.deepEqual([...solo.$('hand').innerHTML.matchAll(/data-card="([^"]+)"/g)].map(m=>m[1]),handBefore,'replay does not change original Aiybai cards');
solo.tasks.at(-1)();
assert.equal(visible(solo),false,'replay cleans itself up');

solo.$('soloOptions').click();solo.$('players').value='2';solo.$('dealer').value='1';
solo.$('newGame').click();
assert.equal(visible(solo),true,'reshuffle starts a new animation');
assert.equal((solo.$('dealAnimation').innerHTML.match(/class="flying-card"/g)||[]).length,8,
 'two-player animation deals only to existing seats');
solo.$('soloHome').click();
assert.equal(visible(solo),false,'leaving gameplay clears animation');
const quiet=boot(true);
quiet.$('soloMode').click();
quiet.$('players').value='4';quiet.$('dealer').value='1';quiet.$('aiDifficulty').value='hard';
quiet.$('newGame').click();
assert.equal(visible(quiet),true,'reduced-motion mode keeps visible static feedback');
assert.match(quiet.$('dealAnimation').innerHTML,/CARDS DEALT/,'clear static fallback');
assert.doesNotMatch(quiet.$('dealAnimation').innerHTML,/class="flying-card"/,'no motion for reduced-motion preference');
quiet.tasks.at(-1)();
assert.equal(visible(quiet),false,'static fallback cleans up');
assert.equal((quiet.$('hand').innerHTML.match(/data-card=/g)||[]).length,13,'reduced motion still deals normally');

const online=boot();
online.$('multiMode').click();
online.$('transportMode').value='online';online.$('playerName').value='Ay';online.$('createRoom').click();
const client=online.getClient();
let room=Core.createRoom({code:'AN1234',hostClientId:'host',hostName:'Ay'});
client.options.onUpdate({room,view:null,clientId:'host',seat:0,isHost:true,connectionStatus:'connected'});
assert.equal(visible(online),false,'lobby does not trigger an animation');
for(let i=0;i<3;i++)room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
room=Core.applyLobbyAction(room,{type:'SET_READY',clientId:'host',ready:true});
const started=Core.startGame(room,Engine,()=>0.37);room=started.room;
const view=Core.projectGame(room,started.game,'host');
const update=(connectionStatus='connected')=>client.options.onUpdate({
 room,view,clientId:'host',seat:0,isHost:true,connectionStatus
});
update();
assert.equal(visible(online),true,'transition from multiplayer lobby to game deals cards');
assert.equal(online.$('gameArea').classList.contains('is-dealing'),true,'multiplayer hand is concealed through animation');
assert.equal((online.$('dealAnimation').innerHTML.match(/class="flying-card"/g)||[]).length,16);
const taskCount=online.tasks.length;
update();
update('reconnecting');
update('connected');
assert.equal(online.tasks.length,taskCount,'live updates and reconnects never replay the deal');
online.tasks.at(-1)();
assert.equal(visible(online),false);
assert.equal(online.$('gameArea').classList.contains('is-dealing'),false,'online cards reveal after local animation');
update();
assert.equal(visible(online),false,'existing online game does not repeat animation');
// A restored active game, with no prior lobby transition, must also skip motion.
const restored=boot();
restored.$('multiMode').click();
restored.$('transportMode').value='online';restored.$('playerName').value='Ay';restored.$('createRoom').click();
restored.getClient().options.onUpdate({room,view,clientId:'host',seat:0,isHost:true,connectionStatus:'connected'});
assert.equal(visible(restored),false,'restoring an in-progress room does not pretend to redeal');
console.log('PASS iPhone-visible deal, 2/4-player motion, replay, online transitions, and reduced-motion feedback');
