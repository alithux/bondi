'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Core=require('./multiplayer-core.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'))
 .replace('function beginSoloAiyReview()', 'window.__testRenderGame=renderGame; function beginSoloAiyReview()');
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
assert.match($('seats').innerHTML,/data-seat="0" data-position="bottom"/,'human is at bottom');
assert.match($('seats').innerHTML,/data-seat="1" data-position="left"/,'next player is at left');
assert.match($('seats').innerHTML,/data-seat="2" data-position="top"/);
assert.match($('seats').innerHTML,/data-seat="3" data-position="right"/);
assert.match($('seats').innerHTML,/Ayya &lt;Host&gt;/,'table names must be escaped');
assert.match($('aiy').innerHTML,/class="played awaiting"/,'empty card places never reveal hands');
assert.equal(($('aiy').innerHTML.match(/class="played awaiting"/g)||[]).length,4);
assert.equal($('matchResultsPanel').classList.contains('hidden'),false,'results visible when match ends');
assert.equal($('rematchPanel').classList.contains('hidden'),false,'host sees rematch panel');
assert.equal($('resultsBondiCount').textContent,'8');
assert.equal($('resultsAiyCount').textContent,'24');
assert.match($('resultsStandings').innerHTML,/Ayya &lt;Host&gt;/,'names escaped');
assert.match($('resultsStandings').innerHTML,/Gave 4 Bondi/);
assert.match($('resultsTitle').textContent,/AI 2 finished first/);
assert.match($('resultsHeroName').textContent,/AI 2 finished first/,'winner spotlight uses true first finisher');
assert.match($('resultsHeroDetail').textContent,/You finished 2 of 4/,'non-winner sees own rank');
assert.equal($('resultsConfetti').innerHTML,'','restored completed match never fakes confetti');
assert.match($('resultsStandings').innerHTML,/results-item is-you/,'viewer ranking is clearly highlighted');
assert.equal($('resultsSoloActions').classList.contains('hidden'),true,'solo controls hidden in multiplayer');
assert.match($('resultsSeries').textContent,/3 completed matches in this room/);
assert.match($('roomTotals').innerHTML,/Ayya &lt;Host&gt;/,'seat names escaped in cumulative stats');
assert.match($('roomTotals').innerHTML,/First: 2 · Last: 0/,'room first/last counts appear');
assert.match($('roomTotals').innerHTML,/Bondi given: 8 · Received: 9/,'room Bondi counts appear');
assert.doesNotMatch($('resultsSeries').textContent,/AI finished first/,'simplified room stats omit per-difficulty clutter');
assert.equal($('playAgain').classList.contains('hidden'),false);
$('playAgain').click();assert.equal(current.rematches,1);
update(false);
assert.match($('seats').innerHTML,/data-seat="1" data-position="bottom"/,"guest seat rotates to bottom");
assert.match($('seats').innerHTML,/data-seat="0" data-position="right"/);
assert.equal($('matchResultsPanel').classList.contains('hidden'),false,'guests see identical results');
assert.equal($('playAgain').classList.contains('hidden'),true,'guests cannot rematch');
view.roundOver=false;
update(true);
assert.equal($('matchResultsPanel').classList.contains('hidden'),true,'results hidden during game');
view.roundOver=true;update(true);
const firstBurst=$('resultsConfetti').innerHTML;
assert.match(firstBurst,/--burst-delay:/,'a live finish has brief decorative celebration');
assert.equal(($('resultsConfetti').innerHTML.match(/<span /g)||[]).length,12,'non-champion gets subtle result celebration');
update(true);
assert.equal($('resultsConfetti').innerHTML,firstBurst,'repeated result cannot restart confetti');
view.finishedOrder=[0,2,1];update(true);
assert.match($('resultsHeroName').textContent,/You finished first!/,'champion gets personal victory wording');
view.finishedOrder=[2,0,1];view.roundOver=false;update(true);
assert.equal($('rematchPanel').classList.contains('hidden'),true,'rematch hidden during game');
// Stage 5.10.1: only the next leader may request before playing a card.
for(const id of ['aiybaiOfferPanel','aiybaiOfferNote','requestAiybai','aiybaiAnswerActions','acceptAiybai','declineAiybai'])
 assert.match(html,new RegExp('id="'+id+'"'));
view.players[0].status='active';view.players[0].handCount=12;
view.players[1].status='active';view.players[1].handCount=10;
view.players[2].status='active';view.players[2].handCount=9;
view.players[3].status='active';view.players[3].handCount=7;
view.lastResolution={type:'normal',cards:[]};
view.trick=[];view.currentPlayer=0;view.resolutionPause=false;view.aiybaiWindowOpen=true;view.aiybaiRequest=null;
room.seats[1].name='Bob';room.seats[1].clientId='guest';room.seats[1].isAI=false;
update(true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'12-card leader is not prompted after normal Aiy');
assert.equal($('openAiybaiRequest').classList.contains('hidden'),false,'manual option stays in menu');
assert.equal(current.requests||0,0,'no automatic request');
$('openAiybaiRequest').click();
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),false,'explicit menu action opens confirmation');
$('cancelAiybaiRequest').click();
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'cancel returns to cards without requesting');
update(true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'ordinary snapshots do not reopen it');
assert.equal(current.requests||0,0);
$('openAiybaiRequest').click();
assert.equal($('requestAiybai').classList.contains('hidden'),false);
assert.match($('aiybaiOfferNote').textContent,/Bob/);
view.currentPlayer=2;
update(true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'non-leader cannot interrupt Aiy');
view.currentPlayer=0;
update(true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'new eligibility does not reopen old prompt');
$('openAiybaiRequest').click();
$('requestAiybai').click();assert.equal(current.requests,1);
view.aiybaiRequest={fromSeat:0,toSeat:1};view.aiybaiWindowOpen=false;
update(false);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),false,'actual incoming request still appears');
assert.equal($('aiybaiAnswerActions').classList.contains('hidden'),false,'only target can answer');
assert.match($('aiybaiOfferNote').textContent,/If you agree/);
$('declineAiybai').click();assert.equal(current.answer,false);
$('acceptAiybai').click();assert.equal(current.answer,true);
update(true);
assert.equal($('aiybaiAnswerActions').classList.contains('hidden'),true,'requester cannot accept for donor');
view.aiybaiRequest=null;view.trick=[{playerIndex:0,card:{rank:'A',suit:'♠',id:'A♠'}}];
update(true);
assert.equal($('aiybaiOfferPanel').classList.contains('hidden'),true,'no requests mid-Aiy');
// The two-player endgame previously cleared these cards instantly whenever
// the next leader was AI; they must remain visible during the one-second review.
view.trick=[];view.currentPlayer=2;view.resolutionPause=true;
view.lastResolution={type:'normal',leadSuit:'♠',cards:[
 {playerIndex:2,card:{id:'9♠',rank:'9',suit:'♠',value:9}},
 {playerIndex:0,card:{id:'6♠',rank:'6',suit:'♠',value:6}}]};
view.players[1].status='finished';view.players[3].status='finished';
update(true);
assert.match($('aiy').innerHTML,/9♠/,'AI card stays visible after Aiy resolution');
assert.match($('aiy').innerHTML,/6♠/,'human card stays visible after Aiy resolution');
assert.equal(($('aiy').innerHTML.match(/class="played has-card"/g)||[]).length,2,
 'only played cards are revealed; no artificial face-up cards for finished players');
assert.equal(($('aiy').innerHTML.match(/class="played awaiting"/g)||[]).length,2);
assert.match($('handTurnStatus').textContent,/next turn in a moment/);
view.resolutionPause=false;update(true);
assert.doesNotMatch($('aiy').innerHTML,/9♠/,'old cards clear when review has ended');
// The game supports two-player Solo vs AI: only top/bottom seats appear
// and the Aiy board never expects two nonexistent opponent slots.
const twoPlayer={
 players:[{name:'You',status:'active',hand:[{rank:'A',suit:'♠',id:'A♠'}]},
          {name:'AI 1',status:'active',hand:[]}],
 dealer:1,currentPlayer:0,leadSuit:'♠',trick:[{playerIndex:1,card:{rank:'K',suit:'♠',id:'K♠'}}],
 roundOver:false,log:[],message:'Your turn'
};
ctx.twoPlayer=twoPlayer;
vm.runInContext('window.__testRenderGame(twoPlayer,{viewerSeat:0,aiSeats:new Set([1]),resolutionPause:false,multiplayer:false})',ctx);
assert.match($('seats').innerHTML,/data-seat="0" data-position="bottom"/);
assert.match($('seats').innerHTML,/data-seat="1" data-position="top"/);
assert.doesNotMatch($('seats').innerHTML,/data-position="left"|data-position="right"/);
assert.match($('aiy').innerHTML,/K♠/);
assert.equal(($('aiy').innerHTML.match(/class="played awaiting"/g)||[]).length,1);
assert.match($('hand').innerHTML,/class="card-index"/,'new card styling retains legal card buttons');
assert.match($('hand').innerHTML,/aria-label="A of spades"/,'screen-reader card label preserved');
console.log('PASS match results, Aiybai UI and two-player resolved-Aiy card visibility');
