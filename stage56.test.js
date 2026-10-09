'use strict';
const assert=require('node:assert/strict');
const E=require('./game-engine-source.js'),Old=require('./game-engine-4.3-baseline.js');
const card=id=>E.createDeck().find(c=>c.id===id);
function position(){
 const hands=[['2♠','K♦','A♥'],['10♥','4♥','3♦','5♦','3♥','8♥','10♣','3♣'],['6♥','8♦','9♦','6♦','K♥','9♥','6♠'],['4♦','K♣','5♥','7♦','5♣','8♠','2♣','Q♠']];
 const s=E.createGame({playerCount:4,random:()=>.5});s.players.forEach((p,i)=>p.hand=hands[i].map(card));
 s.currentPlayer=0;s.trick=[];s.leadSuit=null;
 s.aiMemory={knownVoids:{0:[],1:['♠'],2:[],3:[]},publicHeldCards:{0:[],1:['3♦'],2:[],3:[]},seenPlays:[],bondiHistory:[]};return s;
}
let s=position();assert.equal(Old.chooseAICard(s,0,'hard',()=>.5).id,'2♠');
assert.equal(E.chooseAICard(s,0,'hard',()=>.5).id,'K♦');
assert.equal(E.explainHardAILead(s,0,E.chooseAICard(s,0,'hard',()=>.5)).kind,'verified-follow');
s=position();s.aiMemory.publicHeldCards[1]=[];
assert.equal(E.chooseAICard(s,0,'hard',()=>.5).id,'2♠');
s=position();s.players[2].hand=[card('6♥')];
assert.equal(E.chooseAICard(s,0,'hard',()=>.5).id,Old.chooseAICard(s,0,'hard',()=>.5).id);
s=position();s.players[2].hand=[card('6♥'),card('9♦')];s.aiMemory.knownVoids[2]=['♦','♥'];
assert.notEqual(E.chooseAICard(s,0,'hard',()=>.5).suit,'♦');
s=position();for(const mode of ['easy','medium'])assert.equal(E.chooseAICard(s,0,mode,()=>.5).id,Old.chooseAICard(s,0,mode,()=>.5).id);
console.log('PASS Stage 5.6 public suit memory and one-card containment');
