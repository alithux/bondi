'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const raw=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
const hook='function beginSoloAiyReview(){';
assert(raw.includes(hook),'solo review hook must exist');
const js=raw.replace(hook,`window.__soloTest={
 getState:()=>soloState,
 setState:s=>{soloState=s;},
 setWindow:open=>{soloAiybaiWindowOpen=!!open;},
 render:()=>renderSolo(),
 lead:cardId=>playSoloHuman(cardId),
 review:()=>beginSoloAiyReview()
};
`+hook);
class ClassList{
 constructor(){this.values=new Set(['hidden']);}
 contains(x){return this.values.has(x);}
 toggle(x,yes){if(yes===undefined)yes=!this.values.has(x);if(yes)this.values.add(x);else this.values.delete(x);}
}
class Element{
 constructor(id){this.id=id;this.classList=new ClassList();this.disabled=false;this.value='';this.innerHTML='';this.textContent='';this.events={};this.scrollLeft=0;this.clientWidth=340;this.style={setProperty(){}};this.open=false;}
 addEventListener(type,fn){this.events[type]=fn;}
 click(){return this.events.click?.({target:this});}
 setAttribute(){}
 querySelectorAll(){return [];}
}
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
const timers=[];
const pending=(ms)=>timers.filter(t=>t.ms===ms&&!t.cancelled).at(-1);
const fire=t=>{assert(t,'expected a pending timer');t.cancelled=true;t.fn();};
const storage={getItem:()=>null,setItem(){},removeItem(){}};
const window={location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:''},addEventListener(){}};
const document={getElementById:$,title:'BONDI',body:{classList:new ClassList()}};
const ctx=vm.createContext({window,document,localStorage:storage,sessionStorage:storage,navigator:{},console,Date,Math,
 BondiEngine:Engine,BondiEngineReady:{then:fn=>fn()},BondiMultiplayerCore:Core,
 BondiMultiplayer:{normalizeCode:x=>x.toUpperCase()},BondiOnline:{serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws'},
 setInterval:()=>0,clearInterval(){},
 setTimeout:(fn,ms)=>{const t={fn,ms,cancelled:false};timers.push(t);return t;},
 clearTimeout:t=>{if(t)t.cancelled=true;}});
vm.runInContext(js,ctx,{filename:'solo-aiybai.test.js'});
const t=window.__soloTest;
const hidden=id=>$(id).classList.contains('hidden');
const count=s=>s.players.reduce((n,p)=>n+p.hand.length,0)+s.trick.length;
function resolvedGame(n){
 let s=Engine.createGame({playerCount:n,dealer:n-1});
 s.players[0].name='You';s.players.slice(1).forEach((p,i)=>p.name='AI '+(i+1));
 let steps=0;
 while(!s.lastResolution&&!s.roundOver&&steps++<100){
  const i=s.currentPlayer,legal=Engine.legalMoves(s,i);
  assert(legal.length>0,'game must have legal cards');
  const next=Engine.playCard(s,i,legal[0].id);assert(next.ok);s=next.state;
 }
 assert(s.lastResolution,'real game has completed an Aiy');
 assert.equal(s.trick.length,0);
 assert.equal(s.players[0].status,'active');
 // Model a resolution won by the human leader.
 s.currentPlayer=0;
 return s;
}
$('soloMode').click();
$('players').value='4';$('dealer').value='3';$('aiDifficulty').value='hard';
$('newGame').click();
fire(pending(2750));
assert.match(html,/Stage 5\\.15C\\.3 · Solo Aiybai requests/);
assert.equal(hidden('openAiybaiRequest'),false,'solo menu advertises the request');
assert.equal($('openAiybaiRequest').disabled,true,'cannot request before first completed Aiy');
assert.equal(hidden('aiybaiShortcut'),true,'no opening-game request shortcut');
assert.equal(hidden('aiybaiOfferPanel'),true,'no automatic opening-game popup');
const first=t.getState();
assert.equal(count(first),52,'game starts with a complete 52-card deck');
$('openAiybaiRequest').click();
assert.equal(hidden('aiybaiOfferPanel'),true,'disabled menu does not open a request');

let game=resolvedGame(4);t.setState(game);t.setWindow(true);t.render();
assert.equal($('openAiybaiRequest').disabled,false);
assert.equal(hidden('aiybaiShortcut'),false,'leader sees compact opt-in shortcut');
assert.match($('aiybaiShortcut').textContent,/AI 1.*Aiybai/);
assert.equal(hidden('aiybaiOfferPanel'),true,'eligibility does not force a popup');
const cardsBefore=count(game),humanBefore=game.players[0].hand.length,aiBefore=game.players[1].hand.length;
$('aiybaiShortcut').click();
assert.equal(hidden('aiybaiOfferPanel'),false,'shortcut opens the confirmation');
assert.equal(t.getState().aiybaiRequest,undefined,'opening the panel never sends request');
$('cancelAiybaiRequest').click();
assert.equal(hidden('aiybaiOfferPanel'),true,'Cancel returns to gameplay');
assert.equal(t.getState().players[0].hand.length,humanBefore,'Cancel transfers nothing');
$('openAiybaiRequest').click();
$('requestAiybai').click();
assert.equal(t.getState().aiybaiRequest.fromSeat,0);
assert.equal(t.getState().aiybaiRequest.toSeat,1);
assert.equal(hidden('aiybaiShortcut'),true,'only one request at a time');
assert.equal(hidden('aiybaiAnswerActions'),true,'AI answers its own request');
assert.equal($('play').disabled,true,'human cannot play while waiting');
assert.equal(count(t.getState()),cardsBefore,'request itself transfers no cards');
fire(pending(1000));
assert.equal(t.getState().aiybaiRequest,undefined,'AI response resolves the pending request');
assert.equal(t.getState().players[1].status,'finished','AI finishes after consenting');
assert.equal(t.getState().players[1].hand.length,0);
assert.equal(t.getState().players[0].hand.length,humanBefore+aiBefore,'entire AI Aiybai transferred');
assert.equal(count(t.getState()),cardsBefore,'all remaining cards conserved');
assert.equal($('openAiybaiRequest').disabled,true,'second request disallowed until another Aiy finishes');

// Reopening a completed-Aiy window and leading a card closes the request.
game=resolvedGame(4);t.setState(game);t.setWindow(true);t.render();
const move=Engine.legalMoves(game,0)[0];
t.lead(move.id);
assert.equal(hidden('aiybaiShortcut'),true,'request disappears after lead card played');
assert.equal($('openAiybaiRequest').disabled,true);

// A new match must invalidate an outstanding delayed AI consent.
game=resolvedGame(4);t.setState(game);t.setWindow(true);t.render();
$('aiybaiShortcut').click();$('requestAiybai').click();
const stale=pending(1000);assert(stale);
$('newGame').click(); // Triggering the new-game handler cancels old pending timers.
const replacement=t.getState();assert.equal(replacement.aiybaiRequest,undefined);
stale.fn(); // Even a stale callback that runs anyway must do nothing.
assert.equal(t.getState(),replacement,'old request must not affect a fresh deal');
assert.equal(count(t.getState()),52);

// Two-player Solo vs AI follows exactly the same request/consent rules.
$('players').value='2';$('dealer').value='1';$('aiDifficulty').value='easy';
$('newGame').click();
fire(pending(2750));
game=resolvedGame(2);t.setState(game);t.setWindow(true);t.render();
const twoTotal=count(game),twoHuman=game.players[0].hand.length,twoAI=game.players[1].hand.length;
$('aiybaiShortcut').click();$('requestAiybai').click();
fire(pending(1000));
assert.equal(t.getState().roundOver,true,'last active human ends two-player match after consent');
assert.equal(t.getState().players[0].hand.length,twoHuman+twoAI);
assert.equal(count(t.getState()),twoTotal);
assert.equal(hidden('aiybaiShortcut'),true,'no request in completed match');
console.log('PASS Solo Aiybai: manual controls, opening restrictions, cancellation, AI consent, card locks, lead closure, deal reset, 2/4 players');
