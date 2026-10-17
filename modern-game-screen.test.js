'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Engine=require('./online-server/load-engine.js');
const Core=require('./multiplayer-core.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
for(const id of ['gameHud','gameMenu','hudRoom','hudTurn','hudLead','hudConnection','aiyProgress',
  'gameArea','seats','aiy','gamePresence','play','clear','handLayout','handPreview',
  'selectedCardMini','soloPlayingBar','multiplayerBar','copyFullLog','retryGame','leaveGame',
  'openAiybaiRequest','aiybaiMenuHint','aiybaiShortcut','aiybaiOfferPanel']){
  assert.match(html,new RegExp('id="'+id+'"'),'existing required controls must remain: '+id);
}
assert.match(html,/#gameArea:not\(\.hidden\)\{[^}]*height:100dvh/,
 'active gameplay is a full-height screen');
assert.match(html,/#gameArea \.game-hand-dock\{[^}]*flex:0 0 auto/,
 'Aiybai dock occupies a permanent touch zone');
assert.match(html,/#gameArea \.play-actions\{[^}]*position:static/,
 'play actions stay inside the bottom dock rather than float over the table');
assert.match(html,/#gameArea \.table-panel\{[^}]*flex:1 1 auto/,
 'table uses the flexible middle viewport');
assert.match(html,/\.game-menu-content\{[^}]*overflow-y:auto/,
 'secondary actions live in a scrollable menu');
assert.match(html,/#gameArea \.table-seats \.seat\[data-position="top"\]/);
assert.match(html,/#gameArea \.table-seats \.seat\[data-position="bottom"\]/);
assert.match(html,/@media\(max-width:360px\)/,'small Android and iPhone screens are supported');
assert.match(html,/@media\(max-height:740px\)/,'short screens compact the interface');
assert.match(html,/Stage 5\.15C\.1 · Animated card plays/);

class ClassList{
 constructor(){this.items=new Set(['hidden']);}
 contains(x){return this.items.has(x);}
 toggle(x,flag){if(flag===undefined)flag=!this.items.has(x);if(flag)this.items.add(x);else this.items.delete(x);}
}
class Element{
 constructor(id){this.id=id;this.classList=new ClassList();this.value='';this.textContent='';this.innerHTML='';this.events={};this.disabled=false;this.scrollLeft=0;this.clientWidth=340;this.open=false;this.style={setProperty(){}};}
 addEventListener(name,fn){this.events[name]=fn;}
 setAttribute(){}
 click(){return this.events.click?.({target:this});}
 querySelectorAll(selector){
  if(this.id==='hand'&&selector==='[data-card]'){
   this.buttons=[...this.innerHTML.matchAll(/data-card="([^"]+)"/g)].map((m,i)=>{
    const b=new Element('card');b.dataset={card:m[1]};b.offsetLeft=i*70;b.offsetWidth=70;return b;
   });
   return this.buttons;
  }
  return [];
 }
}
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
const document={getElementById:$,title:'BONDI',body:{classList:new ClassList()}};
const storage={getItem:()=>null,setItem(){},removeItem(){}};
let client;
class FakeClient{
 constructor(options){this.options=options;client=this;}
 createRoom(){}
 leave(){}
 playCard(card){this.played=card;}
 requestAiybai(){this.requests=(this.requests||0)+1;}
}
const win={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',
 location:{origin:'https://alithux.github.io',pathname:'/bondi/',search:'',protocol:'https:'},
 addEventListener(){}};
const timers=[];
const ctx=vm.createContext({
 window:win,document,localStorage:storage,sessionStorage:storage,
 navigator:{},console,Date,setInterval:()=>0,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},
 BondiEngineReady:{then:fn=>fn()},BondiEngine:Engine,
 BondiMultiplayer:{normalizeCode:v=>v.toUpperCase(),MultiplayerClient:FakeClient},
 BondiOnline:{serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws',OnlineMultiplayerClient:FakeClient},
 BondiMultiplayerCore:Core
});
vm.runInContext(script,ctx,{filename:'modern-game-screen'});
assert.equal(document.body.classList.contains('in-game'),false,'home is not fixed-height gameplay');
$('soloMode').click();
assert.equal(document.body.classList.contains('in-game'),false,'first-time settings retain scrolling');
$('players').value='4';$('dealer').value='1';$('aiDifficulty').value='hard';
$('newGame').click();
assert.equal(document.body.classList.contains('in-game'),true,'after dealing a mobile gameplay screen is active');
assert.equal($('gameArea').classList.contains('is-dealing'),true,'the initial hand is covered');
timers.at(-1)(); // Complete the opening deal before testing live controls.
assert.equal($('hudRoom').textContent,'Solo · 4 players');
assert.equal($('hudConnection').textContent,'● Solo');
assert.match($('hudTurn').textContent,/Your turn/);
assert.equal($('hudLead').textContent,'Lead: —');
assert.equal($('aiyProgress').textContent,'0 / 4');
assert.equal(($('hand').innerHTML.match(/data-card=/g)||[]).length,13);
assert.match($('handPreview').textContent,/Tap a card/);
const first=$('hand').buttons[0];
first.click();
assert.match($('handPreview').textContent,/Selected:/);
assert.match($('selectedCardMini').textContent,/[^\s]+/);
assert.equal($('selectedCardMini').classList.contains('hidden'),false);
assert.equal($('play').disabled,false);
$('soloOptions').click();
assert.equal(document.body.classList.contains('in-game'),false,'solo options restore a scrolling setup');
$('soloBack').click();
assert.equal(document.body.classList.contains('in-game'),true,'resume returns to the full-height table');
$('soloHome').click();
assert.equal(document.body.classList.contains('in-game'),false,'leaving game returns ordinary navigation');
$('multiMode').click();
$('playerName').value='Ay';$('transportMode').value='online';$('createRoom').click();
assert(client,'multiplayer client still constructs');
let room=Core.createRoom({code:'BD1234',hostClientId:'host',hostName:'Ay'});
for(let i=0;i<3;i++)room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
room=Core.applyLobbyAction(room,{type:'SET_READY',clientId:'host',ready:true});
const started=Core.startGame(room,Engine,()=>0.37);
room=started.room;
room.dealUntil=Date.now()+2750;
const view=Core.projectGame(room,started.game,'host');
view.currentPlayer=0;view.resolutionPause=false;
const update=(status='connected')=>client.options.onUpdate({room,view,seat:0,isHost:true,clientId:'host',connectionStatus:status});
update();
assert.equal(document.body.classList.contains('in-game'),true,'online multiplayer uses same immersive view');
assert.equal($('hudRoom').textContent,'Room BD1234');
assert.equal($('hudConnection').textContent,'● Online');
assert.equal($('gameArea').classList.contains('is-dealing'),true,'other devices also wait for deal completion');
room.dealUntil=0;update(); // server publishes the end of the deal
assert.match($('hudTurn').textContent,/Your turn/);
// Before any completed Aiy, keep a discoverable but disabled menu action,
// without showing either a popup or a shortcut over the player's hand.
assert.equal($('openAiybaiRequest').classList.contains('hidden'),false);
assert.equal($('openAiybaiRequest').disabled,true);
assert.match($('aiybaiMenuHint').textContent,/after a completed Aiy/i);
assert.equal($('aiybaiShortcut').classList.contains('hidden'),true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true);
$('openAiybaiRequest').click();
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'disabled menu cannot open a request');
// After a completed Aiy and before the leader's next card, an explicit
// action appears next to the hand and requires a separate confirmation.
view.aiybaiWindowOpen=true;
view.lastResolution={type:'normal',leadSuit:'♣',cards:[],winnerIndex:0};
update();
assert.equal($('openAiybaiRequest').disabled,false);
assert.equal($('aiybaiShortcut').classList.contains('hidden'),false);
assert.match($('aiybaiShortcut').textContent,/AI 1.*Aiybai/);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'no automatic popup');
$('aiybaiShortcut').click();
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),false,'shortcut opens a manual confirmation');
assert.equal(client.requests||0,0,'opening the panel cannot transfer cards');
$('cancelAiybaiRequest').click();
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'Cancel returns to ordinary gameplay');
$('openAiybaiRequest').click();
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),false,'menu opens the same confirmation');
$('requestAiybai').click();
assert.equal(client.requests,1,'only explicit confirmation sends a request');
view.aiybaiWindowOpen=false;
view.aiybaiRequest={fromSeat:1,toSeat:0};
view.currentPlayer=1;
update();
assert.equal($('aiybaiShortcut').classList.contains('hidden'),true,'no shortcut during a pending request');
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),false,'incoming consent choices stay visible');
assert.equal($('aiybaiAnswerActions').classList.contains('hidden'),false);
view.aiybaiRequest=null;view.currentPlayer=0;
update();
assert.equal($('openAiybaiRequest').disabled,true,'disabled between request windows');
assert.equal($('aiybaiShortcut').classList.contains('hidden'),true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true);

assert.match($('seats').innerHTML,/data-position="bottom"/);
assert.equal(($('aiy').innerHTML.match(/class="played awaiting"/g)||[]).length,4);
view.leadSuit='♥';
view.trick=[{playerIndex:1,card:{id:'3♥',rank:'3',suit:'♥'}}];
update();
assert.equal($('hudLead').textContent,'Lead: ♥');
assert.equal($('aiyProgress').textContent,'1 / 4');
update('reconnecting');
assert.equal($('hudConnection').classList.contains('degraded'),true);
assert.equal($('hudTurn').classList.contains('blocked'),true);
assert.equal($('play').disabled,true,'connection blocks play as before');
$('leaveGame').click();
assert.equal(document.body.classList.contains('in-game'),false,'leaving multiplayer resets page layout');
console.log('PASS Stage 5.15A immersive HUD, safe touch dock, phone breakpoints, solo + online transitions and selection');
