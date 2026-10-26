'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'))
 .replace('function showScreen(mode){',
 'window.__watchAiyResolution=observeAiyResolution;window.__stopAiyResolution=stopAiyResolution;function showScreen(mode){');
assert.match(html,/id="aiyResolutionFlights" class="aiy-resolution-flights"/);
assert.match(html,/id="aiyResolutionFeedback" class="aiy-resolution-feedback hidden" role="status" aria-live="polite"/);
assert.match(html,/#gameArea \.aiy-resolution-flights\{[^}]*pointer-events:none/,'visuals do not intercept touches');
assert.match(html,/@keyframes aiy-collect-card/);
assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{#gameArea \.aiy-resolve-card/);
assert.match(html,/Stage 5\.16\.1 · Aiy resolution effects/);
assert.match(html,/observeAiyResolution\(state,gameKey/,'normal render path updates winner feedback');
function boot(reduceMotion=false){
 class Classes{
  constructor(){this.items=new Set(['hidden']);}
  contains(n){return this.items.has(n);}
  toggle(n,v){if(v===undefined)v=!this.items.has(n);if(v)this.items.add(n);else this.items.delete(n);}
 }
 class E{
  constructor(id){this.id=id;this.classList=new Classes();this.children=[];this.value='';
   this.innerHTML='';this.textContent='';this.events={};this.disabled=false;this.open=false;this.scrollLeft=0;
   this.style={values:{},setProperty:(k,v)=>{this.style.values[k]=v}};}
  setAttribute(){} addEventListener(type,cb){this.events[type]=cb;}
  click(){return this.events.click?.({target:this});}
  appendChild(el){this.children.push(el);}
  getBoundingClientRect(){
   if(this.id==='tableArena')return {left:0,top:0,width:340,height:420};
   if(this.id.startsWith('seat')){
    const i=Number(this.id.slice(4));
    return {left:25+i*62,top:55+i*55,width:72,height:50};
   }
   if(this.id.startsWith('face')){
    const i=Number(this.id.slice(4));
    return {left:95+i*32,top:183+i*12,width:49,height:69};
   }
   return {left:0,top:0,width:330,height:400};
  }
  querySelector(selector){
   if(this.id==='seats'&&selector.includes('data-seat')){
    const m=selector.match(/data-seat="(\d+)"/);return m?seats[Number(m[1])]:null;
   }
   if(this.id==='aiy'&&selector.includes('data-seat')){
    const m=selector.match(/data-seat="(\d+)"/);return m?slots[Number(m[1])]:null;
   }
   if(this.id.startsWith('slot')&&selector==='.face')return faces[Number(this.id.slice(4))];
   return null;
  }
  querySelectorAll(){return [];}
 }
 const els=new Map(),$=id=>{if(!els.has(id))els.set(id,new E(id));return els.get(id);};
 const seats=Array.from({length:4},(_,i)=>new E('seat'+i));
 const slots=Array.from({length:4},(_,i)=>new E('slot'+i));
 const faces=Array.from({length:4},(_,i)=>new E('face'+i));
 const store={getItem:()=>null,setItem(){},removeItem(){}};
 const doc={getElementById:$,createElement:id=>new E(id),body:{classList:new Classes()},title:'BONDI'};
 const win={matchMedia:()=>({matches:reduceMotion}),BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',
  location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:''},addEventListener(){}};
 const ctx=vm.createContext({window:win,document:doc,localStorage:store,sessionStorage:store,
  navigator:{},Date,console,clearTimeout:()=>{},setTimeout:()=>0,setInterval:()=>0,
  BondiEngineReady:{then:()=>{}},BondiEngine:{},
  BondiMultiplayer:{normalizeCode:s=>s.toUpperCase()},
  BondiMultiplayerCore:{},BondiOnline:{serverWebSocketURL:()=>''}
 });
 // Boot the minimal UI without initializing an engine or network client.
 vm.runInContext(script.replace('BondiEngineReady.then(()=>{','(function(){'),ctx,{filename:'aiy-resolution-app.js'});
 return {win,$,seats,slots,faces};
}
const e=(seat,id,rank,suit)=>({playerIndex:seat,card:{id,rank,suit}});
const a=e(0,'A♣','A','♣'),b=e(1,'9♣','9','♣'),c=e(2,'8♠','8','♠'),d=e(3,'J♥','J','♥');
const players=['You','AI 1','AI 2','AI 3'].map(name=>({name}));
const play=cards=>({players,trick:cards,lastResolution:null});
const resolved=(type,winnerIndex,cards)=>({players,trick:[],lastResolution:{type,winnerIndex,leadSuit:'♣',cards}});
const normal=boot();
function watch(t,s,review=false,key='solo:1',connected=true){t.win.__watchAiyResolution(s,key,review,0,connected);}
watch(normal,resolved('normal',0,[a,b]),true);
assert(normal.$('aiyResolutionFeedback').classList.contains('hidden'),'restored Aiy does not flash');
assert.equal(normal.$('aiyResolutionFlights').children.length,0);
watch(normal,play([a,b]));
watch(normal,resolved('normal',0,[a,b]),true);
const firstCount=normal.$('aiyResolutionFlights').children.length;
assert.equal(firstCount,2,'normal Aiy clears public cards with short flight copies');
assert.match(normal.$('aiyResolutionFeedback').textContent,/You wins the Aiy/);
assert.equal(normal.$('aiyResolutionFeedback').classList.contains('hidden'),false);
assert.equal(normal.$('aiyResolutionFeedback').classList.contains('bondi'),false);
assert.equal(normal.seats[0].classList.contains('aiy-resolution-winner'),true);
assert.equal(normal.$('tableArena').classList.contains('aiy-collecting'),true);
assert.equal(normal.$('aiyResolutionFlights').children[0].textContent,'A♣');
assert(!normal.$('aiyResolutionFlights').children[0].innerHTML.includes('Aiybai'));
const normalDx=normal.$('aiyResolutionFlights').children[0].style.values['--resolve-dx'];
watch(normal,resolved('normal',0,[a,b]),true);
assert.equal(normal.$('aiyResolutionFlights').children.length,firstCount,'duplicate snapshot does not replay flight');
watch(normal,play([c,d]));
assert(normal.$('aiyResolutionFeedback').classList.contains('hidden'),'next Aiy clears banner');
assert.equal(normal.$('tableArena').classList.contains('aiy-collecting'),false,'next Aiy clears old cards');
watch(normal,resolved('bondi',2,[c,d]),true);
assert.equal(normal.$('aiyResolutionFlights').children.length,2,'Bondi returns publicly played cards');
assert(normal.$('aiyResolutionFlights').children.every(x=>x.className.includes('returning')));
assert(normal.$('aiyResolutionFeedback').classList.contains('bondi'),'Bondi receives distinct winner label');
assert.match(normal.$('aiyResolutionFeedback').textContent,/BONDI · AI 2 takes 2 cards back/);
assert.equal(normal.seats[2].classList.contains('aiy-resolution-winner'),true);
assert.notEqual(normal.$('aiyResolutionFlights').children[0].style.values['--resolve-dx'],normalDx,
 'Bondi uses recipient seat, not a normal clear-to-center destination');
watch(normal,resolved('bondi',2,[c,d]),false);
assert(normal.$('aiyResolutionFeedback').classList.contains('hidden'),'review ending removes feedback');
assert.equal(normal.$('aiyResolutionFlights').children.length,0,'review ending cleans the overlays');
normal.win.__stopAiyResolution();
assert.equal(normal.$('aiyResolutionFlights').innerHTML,'','leaving game clears visual copies');

const quiet=boot(true);
watch(quiet,play([a,b]),false,'solo:2');
watch(quiet,resolved('bondi',1,[a,b]),true,'solo:2');
assert.equal(quiet.$('aiyResolutionFlights').children.length,0,'Reduce Motion has no moving cards');
assert.match(quiet.$('aiyResolutionFeedback').textContent,/BONDI/,'Reduce Motion retains explanatory text');
assert(quiet.seats[1].classList.contains('aiy-resolution-winner'),'Reduce Motion retains winner highlight');
assert(!quiet.$('tableArena').classList.contains('aiy-collecting'),'Reduce Motion keeps cards visible');
const remote=boot();
watch(remote,play([a,b]),false,'multi:ABC:1:0',false);
watch(remote,resolved('normal',0,[a,b]),true,'multi:ABC:1:0');
assert(remote.$('aiyResolutionFeedback').classList.contains('hidden'),'disconnect and reconnect establishes baseline');
watch(remote,play([c]),false,'multi:ABC:2:0');
watch(remote,resolved('normal',0,[c]),true,'multi:ABC:2:0');
assert(remote.$('aiyResolutionFeedback').classList.contains('hidden'),'new match cannot replay old history');
watch(remote,play([a,b]),false,'multi:ABC:2:0');
watch(remote,resolved('normal',0,[a,b]),true,'multi:ABC:2:0');
assert.equal(remote.$('aiyResolutionFlights').children.length,2,'new live Aiy in multiplayer animates');
console.log('PASS Aiy resolution: normal clearing, Bondi returns, winner cue, deduplication, reconnect/match privacy, reduced motion');
