'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Engine=require('./online-server/load-engine.js');
const Core=require('./multiplayer-core.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'))
 .replace('function showScreen(mode){','window.__observe=observePlayedCards;window.__stopFlights=stopCardFlights;function showScreen(mode){');
assert.match(html,/id="cardFlights" class="card-flights"/,'separate overlay exists');
assert.match(html,/#gameArea \.card-flights\{[^}]*pointer-events:none/,'flights never block taps');
assert.match(html,/bondi-card-flight 460ms/,'flight completes inside the existing one-second review');
assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{#gameArea \.card-flight/,'reduced-motion style');
assert.match(html,/Stage 5\.15C\.1 · Animated card plays/);

function boot(reduceMotion=false){
 class Classes{
  constructor(){this.s=new Set(['hidden']);}
  contains(n){return this.s.has(n);}
  toggle(n,v){if(v===undefined)v=!this.s.has(n);if(v)this.s.add(n);else this.s.delete(n);}
 }
 let overlay;
 class E{
  constructor(id){this.id=id;this.classList=new Classes();this.events={};this.value='';this.textContent='';this._html='';
   this.scrollLeft=0;this.clientWidth=330;this.disabled=false;this.open=false;this.dataset={};
   this.style={values:{},setProperty:(k,v)=>this.style.values[k]=v};}
  set innerHTML(x){this._html=x;if(this.id==='cardFlights')this.children=[];}
  get innerHTML(){return this._html;}
  setAttribute(){}
  addEventListener(k,fn){this.events[k]=fn;}
  click(){return this.events.click?.({target:this});}
  remove(){this.removed=true;if(overlay)overlay.children=overlay.children.filter(x=>x!==this);}
  appendChild(n){if(!this.children)this.children=[];this.children.push(n);}
  getBoundingClientRect(){
   if(this.id==='tableArena')return {left:0,top:0,width:340,height:420};
   if(this.id==='seat')return {left:12,top:135,width:75,height:47};
   if(this.id==='face')return {left:160,top:180,width:49,height:68};
   return {left:0,top:0,width:340,height:400};
  }
  querySelector(selector){
   if(this.id==='seats'&&selector.includes('seat'))return seat;
   if(this.id==='aiy'&&selector.includes('played'))return slot;
   if(this.id==='slot'&&selector==='.face')return face;
   return null;
  }
  querySelectorAll(s){
   if(this.id==='hand'&&s==='[data-card]'){
    this.buttons=[...this.innerHTML.matchAll(/data-card="([^"]+)"/g)].map((m,i)=>{
     const b=new E('card');b.dataset.card=m[1];b.offsetLeft=i*70;b.offsetWidth=70;return b;
    });return this.buttons;
   }
   return [];
  }
 }
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new E(id));return elements.get(id);};
 overlay=$('cardFlights');
 const seat=new E('seat'),slot=new E('slot'),face=new E('face');
 const tasks=new Map();let next=0;
 const setTimeout=fn=>{tasks.set(++next,fn);return next;};
 const clearTimeout=id=>{tasks.delete(id);};
 const store={getItem:()=>null,setItem(){},removeItem(){}};
 const doc={getElementById:$,createElement:id=>new E(id),body:{classList:new Classes()},title:'BONDI'};
 const win={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',matchMedia:()=>({matches:reduceMotion}),
  location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:''},addEventListener(){}};
 const ctx=vm.createContext({window:win,document:doc,localStorage:store,sessionStorage:store,
  console,Date,setTimeout,clearTimeout,setInterval:()=>0,navigator:{},
  BondiEngineReady:{then:fn=>fn()},BondiEngine:Engine,BondiMultiplayerCore:Core,
  BondiMultiplayer:{normalizeCode:s=>s.toUpperCase()},BondiOnline:{serverWebSocketURL:()=>''}});
 vm.runInContext(script,ctx,{filename:'card-play-motion-inline.js'});
 $('players').value='4';$('dealer').value='1';$('aiDifficulty').value='hard';
 $('soloMode').click();$('newGame').click();
 // Finish the existing opening deal without changing the game state.
 const deal=next;tasks.get(deal)?.();tasks.delete(deal);
 return {$,slot,overlay,tasks,win};
}
const e=(seat,id,rank,suit)=>({playerIndex:seat,card:{id,rank,suit}});
const a=e(1,'A♥','A','♥'),b=e(2,'K♠','K','♠'),c=e(3,'J♣','J','♣'),d=e(0,'9♦','9','♦');
const t=boot();
const watch=(entries,review=false,key='solo:1')=>t.win.__observe(entries,key,review);
watch([]);
assert.equal(t.overlay.children.length,0,'baseline produces no historical flight');
watch([a]);
assert.equal(t.overlay.children.length,1,'first real play animates');
assert.equal(t.overlay.children[0].className,'card-flight red','hearts render in red');
assert.equal(t.overlay.children[0].style.values['--flight-dx'],'135px','flight moves from the mocked seat center to the mocked Aiy center');
assert.match(t.overlay.children[0].innerHTML,/A♥/);
assert(!t.overlay.children[0].innerHTML.includes('data-card'),'only the publicly played card is shown');
watch([a]);
assert.equal(t.overlay.children.length,1,'same public card must not replay');
watch([a,b]);
assert.equal(t.overlay.children.length,2,'fast subsequent play overlaps previous flight');
watch([a,b,c,d],true);
assert.equal(t.overlay.children.length,2,'multi-card catch-up snapshot never fakes missing moves');
watch([a,b,c,d],true);
assert.equal(t.overlay.children.length,2,'repeat Aiy review never replays');
watch([e(2,'Q♠','Q','♠')],false);
assert.equal(t.overlay.children.length,3,'first new lead immediately after Aiy review animates');
watch([e(2,'Q♠','Q','♠')],false);
assert.equal(t.overlay.children.length,3);
watch([a],false,'multi:room:1:0');
assert.equal(t.overlay.children.length,3,'joined/reconnected game creates baseline without animation');
watch([a,b],false,'multi:room:1:0');
assert.equal(t.overlay.children.length,4,'subsequent real move animates for multiplayer');
const pending=[...t.tasks.entries()].filter(([id,fn])=>id!==0);
for(const [id,fn] of pending){fn();t.tasks.delete(id);}
assert.equal(t.overlay.children.length,0,'all flights independently finish');
assert.equal(t.slot.classList.contains('arriving'),false,'actual Aiy cards stay visible when animations finish');
watch([]);
watch([a]);
assert.equal(t.overlay.children.length,1);
t.win.__stopFlights();
assert.equal(t.overlay.children.length,0,'exiting a match removes all flight elements');
const reduced=boot(true);
reduced.win.__observe([],'solo:1',false);
reduced.win.__observe([a],'solo:1',false);
assert.equal(reduced.overlay.children.length,0,'Reduce Motion does not fly cards');
console.log('PASS per-card seat-to-Aiy motion, overlapping AI turns, 1-second review, reconnect safety and accessibility');
