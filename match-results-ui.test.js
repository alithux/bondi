'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Core=require('./multiplayer-core.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
for(const id of ['matchResultsPanel','resultsStandings','resultsSeries','roomTotals','resultsBondiCount','resultsAiyCount','resultsLastSeat'])assert.match(html,new RegExp('id="'+id+'"'));
class ClassList {
 constructor(){this.values=new Set();}
 contains(v){return this.values.has(v);}
 toggle(v,yes){if(yes===undefined)yes=!this.contains(v);if(yes)this.values.add(v);else this.values.delete(v);}
}
class Element {
 constructor(id){this.id=id;this.value='';this.innerHTML='';this.textContent='';this.disabled=false;this.classList=new ClassList();this.events={};this.scrollLeft=0;}
 addEventListener(type,callback){this.events[type]=callback;}
 setAttribute(){}
 click(){return this.events.click?.({target:this});}
 querySelectorAll(){return [];}
}
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
const session={getItem:()=>null,setItem(){},removeItem(){}};
let current;
class FakeClient {
 constructor(args){this.args=args;this.rematches=0;current=this;}
 createRoom(){}
 requestRematch(){this.rematches++;}
  requestAiybai(){this.requests=(this.requests||0)+1;}
  answerAiybai(yes){this.answer=!!yes;}
}
const document={getElementById:$,title:'BONDI'};
const window={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',location:{protocol:'https:',origin:'https://alithux.github.io',pathname:'/bondi/',search:''},addEventListener(){}};
const ctx={window,document,localStorage:session,sessionStorage:session,console,Date,setInterval:()=>0,setTimeout:()=>0,clearTimeout:()=>{},navigator:{clipboard:{writeText:async()=>{}}},
 BondiOnline:{serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws',OnlineMultiplayerClient:FakeClient},
 BondiMultiplayer:{normalizeCode:x=>x.toUpperCase(),MultiplayerClient:FakeClient},
 BondiMultiplayerCore:Core,
 BondiEngineReady:{then:fn=>fn()},BondiEngine:{}};
vm.runInNewContext(js,ctx,{filename:'match-results-ui'});
$('multiMode').click();
$('playerName').value='Ayya <Host>';$('transportMode').value='online';$('createRoom').click();
assert(current);
let room=Core.createRoom({code:'AB1234',hostClientId:'host',hostName:'Ayya <Host>'});
for(let i=0;i<3;i++)room=Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'});
room.matchNumber=3;room.phase='game';room.aiDifficulty='medium';
room.matchHistory=[{matchNumber:1,difficulty:'easy',firstFinisherIsAI:true},{matchNumber:2,difficulty:'hard',firstFinisherIsAI:false},{matchNumber:3,difficulty:'medium',firstFinisherIsAI:true}];
room.roomStats={matchesPlayed:3,firstPlaces:[1,0,2,0],lastPlaces:[0,1,0,2],bondiGiven:[6,2,8,4],bondiReceived:[3,4,9,4]};
const view={
 players:room.seats.map((s,i)=>({name:s.name,id:i,status:i===3?'active':'finished',handCount:i===3?7:0,hand:[]})),
 dealer:3,currentPlayer:3,leadSuit:null,trick:[],pendingFinish:[],finishedOrder:[2,0,1],roundOver:true,
 matchStats:{bondiEvents:8,normalAiy:16,bondiGiven:[1,2,4,1],bondiReceived:[2,1,3,2]},
 lastResolution:null,log:['AI 1 played Q♣ — BONDI!'],resolutionPause:false,message:'AI 3 is last player holding cards.'
};
function update(isHost){current.args.onUpdate({room,view,clientId:isHost?'host':'guest',seat:isHost?0:1,isHost,connectionStatus:'connected'});}
update(true);
assert.equal($('matchResultsPanel').classList.contains('hidden'),false,'results visible when match ends');
assert.equal($('rematchPanel').classList.contains('hidden'),false,'host sees rematch panel');
assert.equal($('resultsBondiCount').textContent,'8');
assert.equal($('resultsAiyCount').textContent,'24');
assert.match($('resultsStandings').innerHTML,/Ayya &lt;Host&gt;/,'names escaped');
assert.match($('resultsStandings').innerHTML,/Gave 4 Bondi/);
assert.match($('resultsTitle').textContent,/AI 2 finished first/);
assert.match($('resultsSeries').textContent,/3 completed matches in this room/);
assert.match($('roomTotals').innerHTML,/Ayya &lt;Host&gt;/,'seat names escaped in cumulative stats');
assert.match($('roomTotals').innerHTML,/First: 2 · Last: 0/,'room first/last counts appear');
assert.match($('roomTotals').innerHTML,/Bondi given: 8 · Received: 9/,'room Bondi counts appear');
assert.doesNotMatch($('resultsSeries').textContent,/AI finished first/,'simplified room stats omit per-difficulty clutter');
assert.equal($('playAgain').classList.contains('hidden'),false);
$('playAgain').click();assert.equal(current.rematches,1);
update(false);
assert.equal($('matchResultsPanel').classList.contains('hidden'),false,'guests see identical results');
assert.equal($('playAgain').classList.contains('hidden'),true,'guests cannot rematch');
view.roundOver=false;
update(true);
assert.equal($('matchResultsPanel').classList.contains('hidden'),true,'results hidden during game');
assert.equal($('rematchPanel').classList.contains('hidden'),true,'rematch hidden during game');
// Stage 5.10.1: only the next leader may request before playing a card.
for(const id of ['aiybaiOfferPanel','aiybaiOfferNote','requestAiybai','aiybaiAnswerActions','acceptAiybai','declineAiybai'])
 assert.match(html,new RegExp('id="'+id+'"'));
view.players[0].status='active';view.players[0].handCount=12;
view.players[1].status='active';view.players[1].handCount=10;
view.players[2].status='active';view.players[2].handCount=9;
view.players[3].status='active';view.players[3].handCount=7;
view.lastResolution={type:'bondi',cards:[]};
view.trick=[];view.currentPlayer=0;view.resolutionPause=false;view.aiybaiWindowOpen=true;view.aiybaiRequest=null;
room.seats[1].name='Bob';room.seats[1].clientId='guest';room.seats[1].isAI=false;
update(true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),false);
assert.equal($('requestAiybai').classList.contains('hidden'),false);
assert.match($('aiybaiOfferNote').textContent,/Bob/);
view.currentPlayer=2;
update(true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'non-leader cannot interrupt Aiy');
view.currentPlayer=0;
update(true);
$('requestAiybai').click();assert.equal(current.requests,1);
view.aiybaiRequest={fromSeat:0,toSeat:1};view.aiybaiWindowOpen=false;
update(false);
assert.equal($('aiybaiAnswerActions').classList.contains('hidden'),false,'only target can answer');
assert.match($('aiybaiOfferNote').textContent,/If you agree/);
$('declineAiybai').click();assert.equal(current.answer,false);
$('acceptAiybai').click();assert.equal(current.answer,true);
update(true);
assert.equal($('aiybaiAnswerActions').classList.contains('hidden'),true,'requester cannot accept for donor');
view.aiybaiRequest=null;view.trick=[{playerIndex:0,card:{rank:'A',suit:'♠',id:'A♠'}}];
update(true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'no requests mid-Aiy');
console.log('PASS room-only cumulative stats UI, HTML escaping, host-only rematch and reset');
