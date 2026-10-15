'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Engine=require('./online-server/load-engine.js');
const Core=require('./multiplayer-core.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
for(const id of ['soloSetup','soloPlayingBar','soloPlayingSummary','soloOptions','soloHome','soloBack','newGame','gameArea'])
 assert.match(html,new RegExp('id="'+id+'"'));
class ClassList{
 constructor(){this.values=new Set(['hidden']);}
 contains(v){return this.values.has(v);}
 toggle(v,yes){if(yes===undefined)yes=!this.values.has(v);if(yes)this.values.add(v);else this.values.delete(v);}
}
class Element{
 constructor(id){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.classList=new ClassList();this.events={};this.scrollLeft=0;this.disabled=false;}
 addEventListener(k,fn){this.events[k]=fn;}
 setAttribute(){}
 querySelectorAll(){return [];}
 click(){return this.events.click?.({target:this});}
}
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
const storage={getItem:()=>null,setItem(){},removeItem(){}};
const win={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:''},addEventListener(){}};
const ctx=vm.createContext({window:win,document:{getElementById:$,title:'BONDI'},localStorage:storage,sessionStorage:storage,
 console,Date,setInterval:()=>0,setTimeout:()=>0,clearTimeout:()=>{},navigator:{},
 BondiEngineReady:{then:fn=>fn()},BondiEngine:Engine,
 BondiMultiplayer:{normalizeCode:x=>x.toUpperCase()},BondiMultiplayerCore:Core,
 BondiOnline:{serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws'}});
vm.runInContext(js,ctx,{filename:'solo-setup-visibility.js'});
const hidden=id=>$(id).classList.contains('hidden');
$('soloMode').click();
assert.equal(hidden('soloSetup'),false,'before starting, players can configure a solo game');
assert.equal(hidden('gameArea'),true,'do not auto-deal before settings are confirmed');
assert.equal(hidden('soloPlayingBar'),true);
assert.equal($('soloBack').textContent,'Back');
$('players').value='4';$('dealer').value='3';$('aiDifficulty').value='hard';
$('newGame').click();
assert.equal(hidden('soloSetup'),true,'hide the circled controls after Shuffle & deal');
assert.equal(hidden('gameArea'),false,'show the card table directly');
assert.equal(hidden('soloPlayingBar'),false,'retain small navigation controls');
assert.match($('soloPlayingSummary').textContent,/4 players · Hard AI/);
assert.equal(($('hand').innerHTML.match(/data-card=/g)||[]).length,13,'initial Aiybai has 13 cards');
const originalHand=$('hand').innerHTML;
$('soloOptions').click();
assert.equal(hidden('soloSetup'),false,'New game reopens options only when requested');
assert.equal(hidden('gameArea'),true,'hide previous card table while changing options');
assert.equal($('soloBack').textContent,'Resume game');
$('players').value='2';$('dealer').value='0';$('aiDifficulty').value='easy';
$('soloBack').click();
assert.equal(hidden('soloSetup'),true,'Resume closes setup without redealing');
assert.equal(hidden('gameArea'),false);
assert.equal($('hand').innerHTML,originalHand,'cancelling options must preserve original Aiybai');
assert.equal($('players').value,'4','restore original game settings');
assert.equal($('aiDifficulty').value,'hard','do not accidentally change AI mid-game');
$('soloHome').click();
assert.equal(hidden('homePanel'),false);
assert.equal(hidden('gameArea'),true);
$('soloMode').click();
assert.equal(hidden('soloSetup'),true,'returning from Home resumes existing match');
assert.equal(hidden('gameArea'),false);
assert.equal($('hand').innerHTML,originalHand);
$('soloOptions').click();
$('players').value='2';$('dealer').value='0';$('aiDifficulty').value='medium';
$('newGame').click();
assert.equal(hidden('soloSetup'),true);
assert.equal(hidden('gameArea'),false);
assert.match($('soloPlayingSummary').textContent,/2 players · Medium AI/);
assert.equal(($('hand').innerHTML.match(/data-card=/g)||[]).length,26,'reshuffle honors 2-player setup');
$('soloOptions').click();$('soloBack').click();
assert.equal($('aiDifficulty').value,'medium');
console.log('PASS solo setup hides after dealing; compact navigation, resume, and new-game settings work');
