'use strict';
const assert = require('node:assert/strict');
const E = require('./game-engine-source.js');
const card = id => E.createDeck().find(c => c.id === id);

function room() {
  const hands = [
    ['2♠','K♦','4♥','6♥','8♥'],
    ['3♦','10♥','2♦','7♥','3♣','9♣','J♣','9♦'],
    ['A♣','5♦','Q♠','Q♥','8♣','7♣','10♠'],
    ['A♦','2♣','K♥','J♥','8♦','6♣','5♠','5♣']
  ];
  const ids = hands.flat();
  assert.equal(new Set(ids).size, ids.length, 'fixture must have unique cards');
  const state = E.createGame({playerCount:4,random:()=>0.5});
  state.players.forEach((p,i)=>{p.hand=hands[i].map(card);p.status='active';});
  state.currentPlayer=0;
  state.trick=[];
  state.leadSuit=null;
  state.aiMemory={
    knownVoids:{0:[],1:['♠'],2:[],3:[]},
    publicHeldCards:{0:[],1:['3♦','10♥'],2:[],3:[]},
    seenPlays:[],
    bondiHistory:[]
  };
  return state;
}

// A post-Bondi recipient can choose a lower HEART lead which the next
// opponent is publicly known to hold, rather than automatically re-leading
// the high, singleton DIAMOND.
let state=room();
state.lastResolution={type:'bondi',leadSuit:'♠',recipientIndex:0};
const post=E.chooseAICard(state,0,'hard',()=>0.5);
assert.equal(post.id,'4♥','post-Bondi must favor a comparably safe lower lead');

// Do NOT blindly prefer a low card if that suit guarantees the next
// opponent an immediate Bondi. Retain the safe higher lead when necessary.
state=room();
state.players[0].hand=['2♠','K♦','A♥'].map(card);
state.aiMemory.publicHeldCards[1]=['3♦'];
state.lastResolution={type:'bondi',leadSuit:'♠',recipientIndex:0};
assert.equal(E.chooseAICard(state,0,'hard',()=>0.5).id,'K♦');

// The preference belongs to the Bondi recipient only. Replaying an
// unrelated player's Bondi must not affect our own leading choice.
state=room();
const normal=E.chooseAICard(state,0,'hard',()=>0.5);
state.lastResolution={type:'bondi',leadSuit:'♠',recipientIndex:2};
assert.equal(E.chooseAICard(state,0,'hard',()=>0.5).id,normal.id);

// Existing Bondi-giving convention: once a suit is selected for an
// off-suit Bondi, the AI discards its highest card in that suit.
state=room();
state.trick=[{playerIndex:3,card:card('2♣'),bondi:false}];
state.leadSuit='♣';
const discard=E.chooseAICard(state,0,'hard',()=>0.5);
assert(!state.players[0].hand.some(c=>c.suit===discard.suit && c.value>discard.value));
assert(E.legalMoves(state,0).some(c=>c.id===discard.id));
console.log('PASS post-Bondi low lead, confirmed-void protection, recipient scope and legal Bondi discard');
