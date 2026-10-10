'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
for(const id of ['handTurnStatus','inviteLink','inviteLinkField','hand','play','shareStatus'])
 assert.match(html,new RegExp('id="'+id+'"'));
assert.match(html,/\.card\{flex-basis:68px;width:68px;min-width:68px;height:94px/,'cards are larger on phones');
assert.match(html,/:focus-visible\{outline:3px solid var\(--gold\)/,'keyboard focus remains visible');
assert.match(html,/\.room-total-row span\{font-size:\.87rem/,'results have readable labels');
assert.match(html,/Stage 5\.9 · Mobile multiplayer/);

class ClassList{
 constructor(){this.values=new Set(['hidden']);}
 contains(v){return this.values.has(v);}
 toggle(v,yes){if(yes===undefined)yes=!this.values.has(v);if(yes)this.values.add(v);else this.values.delete(v);}
}
class Element{
 constructor(id){this.id=id;this.value='';this.innerHTML='';this.textContent='';this.disabled=false;this.classList=new ClassList();this.events={};this.scrollLeft=0;this.focused=false;this.selected=false;}
 addEventListener(type,fn){this.events[type]=fn;}
 setAttribute(){}
 focus(){this.focused=true;}
 select(){this.selected=true;}
 click(){return this.events.click?.({target:this});}
 querySelectorAll(){return [];}
}
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
let client,clipboardDisabled=false,copyCount=0;
class FakeClient{
 constructor(options){this.options=options;client=this;}
 createRoom(){}
 playCard(id){this.lastPlayed=id;}
 leave(){}
}
const navigator={clipboard:{writeText:async()=>{copyCount++;if(clipboardDisabled)throw Error('Browser clipboard denied');}}};
const storage={getItem:()=>null,setItem(){},removeItem(){}};
const window={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:''},addEventListener(){}};
const ctx=vm.createContext({window,document:{getElementById:$,title:'BONDI'},localStorage:storage,sessionStorage:storage,console,Date,setInterval:()=>0,setTimeout:()=>0,clearTimeout:()=>{},navigator,
 BondiMultiplayer:{MultiplayerClient:FakeClient,normalizeCode:x=>x.toUpperCase()},
 BondiOnline:{OnlineMultiplayerClient:FakeClient,serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws'},
 BondiMultiplayerCore:Core,BondiEngineReady:{then:fn=>fn()},BondiEngine:Engine});
vm.runInContext(js,ctx);
$('multiMode').click();
$('playerName').value='Ay';$('transportMode').value='online';$('createRoom').click();
assert(client);
let room=Core.createRoom({code:'AB1234',hostClientId:'host',hostName:'Ay'});
client.options.onUpdate({room,view:null,clientId:'host',seat:0,isHost:true,connectionStatus:'connected'});
assert.equal($('inviteLink').value,'https://alithux.github.io/bondi/?room=AB1234');
assert.equal($('inviteLinkField').classList.contains('hidden'),false);
(async()=>{
 clipboardDisabled=true;
 await $('shareRoom').click();
 assert.equal($('inviteLink').focused,true,'fallback focuses invite link');
 assert.equal($('inviteLink').selected,true,'fallback selects invitation for manual copy');
 assert.match($('shareStatus').textContent,/Automatic copying is unavailable/);
 $('inviteLink').selected=false;$('inviteLink').click();assert($('inviteLink').selected);
 clipboardDisabled=false;await $('copyRoomCode').click();assert(copyCount>=2);
 for(let i=0;i<3;i++)room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
 room=Core.applyLobbyAction(room,{type:'SET_READY',clientId:'host',ready:true});
 const started=Core.startGame(room,Engine,()=>.34);room=started.room;room.matchNumber=1;
 const view=Core.projectGame(room,started.game,'host');
 view.currentPlayer=0;view.roundOver=false;view.resolutionPause=false;
 const update=(status='connected')=>client.options.onUpdate({room,view,clientId:'host',seat:0,isHost:true,connectionStatus:status});
 update();
 assert.match($('handTurnStatus').textContent,/YOUR TURN/);
 assert.equal($('handTurnStatus').classList.contains('ready'),true);
 assert.match($('hand').innerHTML,/aria-label="[^"]+ of (spades|hearts|diamonds|clubs)"/);
 assert.match($('hand').innerHTML,/aria-pressed="false"/);
 const first=view.players[0].hand[0];
 vm.runInContext('handleCardTap('+JSON.stringify(first.id)+')',ctx);
 assert.equal($('play').disabled,false);
 assert.equal($('play').textContent,'Play '+first.rank+first.suit);
 assert.match($('hand').innerHTML,/aria-pressed="true"/);
 update('reconnecting');
 assert.match($('handTurnStatus').textContent,/Reconnecting/);
 assert.equal($('play').disabled,true);
 assert.match($('hand').innerHTML,/disabled/);
 update('connected');view.currentPlayer=1;update();
 assert.match($('handTurnStatus').textContent,/Waiting for/);
 assert.equal($('play').disabled,true);
 view.currentPlayer=0;view.resolutionPause=true;update();
 assert.match($('handTurnStatus').textContent,/އަތް resolving/);
 assert.equal($('handTurnStatus').classList.contains('paused'),true);
 // Local-browser mode does not offer a misleading cross-device invitation.
 $('transportMode').value='local';$('transportMode').events.change();
 $('transportMode').value='online';
 console.log('PASS Stage 5.9 phone cards, selection, turn status, reconnection and invite sharing');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
