/* Diagnostic orchestration only: all game transitions use production APIs. */
(function(root){
'use strict';
function run(E,C,fixture){
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const copy=x=>JSON.parse(JSON.stringify(x));
 let state=E.createGame({playerCount:4,dealer:fixture.dealer,random:()=>0.5});
 const deck=E.createDeck(),cards=new Map(deck.map(c=>[c.id,c]));
 state.players.forEach((p,i)=>{p.hand=fixture.hands[i].map(id=>{check(cards.has(id),'Unknown card '+id);return copy(cards.get(id));});});
 state.currentPlayer=fixture.currentPlayer;
 let cleared=fixture.cleared.map(id=>{check(cards.has(id),'Unknown cleared card '+id);return id;});
 const room=C.createRoom({code:'TEST23',hostClientId:'tester',hostName:'Player 1'});
 room.phase='game';
 const trace=[];
 function record(action){
  const held=state.players.flatMap(p=>p.hand.map(c=>c.id));
  const table=state.trick.map(p=>p.card.id);
  const all=[...held,...table,...cleared];
  check(all.length===52&&new Set(all).size===52&&all.every(id=>cards.has(id)),
   'Card conservation failed: held + current Aiy + cleared must contain 52 unique cards');
  trace.push({action,nextPlayer:state.currentPlayer+1,nextPlayerMeaning:state.trick.length?'Next to play':'Next Aiy leader',
   players:state.players.map(p=>({name:p.name,status:p.status,aiybai:p.hand.map(c=>c.id)})),
   aiy:table,held:held.length,cleared:cleared.length,total:all.length,
   log:state.log.slice(),pendingRequest:state.aiybaiRequest||null});
 }
 function expect(values){
  if(values.currentPlayer!==undefined)check(state.currentPlayer===values.currentPlayer,'Unexpected next player');
  if(values.statuses)values.statuses.forEach((status,i)=>check(state.players[i].status===status,'Unexpected status for seat '+(i+1)));
  if(values.counts)values.counts.forEach((n,i)=>check(state.players[i].hand.length===n,'Unexpected Aiybai count for seat '+(i+1)));
  if(values.resolution)check(state.lastResolution?.type===values.resolution,'Unexpected Aiy resolution');
 }
 record('Loaded fixed state');
 for(const action of fixture.actions){
  const before=JSON.stringify(state);
  let result;
  if(action.type==='play')result=E.playCard(state,action.seat,action.card);
  else if(action.type==='request')result=C.requestAiybai(room,state,'tester',true);
  else if(action.type==='answer')result=C.answerAiybai(state,action.seat,action.accept);
  else throw Error('Unknown action');
  check(result.ok,result.error||'Action rejected');
  check(JSON.stringify(state)===before,'Production transition mutated its input');
  const previous=state;
  state=result.state;
  if(action.type==='play'&&state.trick.length===0&&state.lastResolution?.type==='normal')
   cleared.push(...state.lastResolution.cards.map(p=>p.card.id));
  if(action.type==='answer'){
   const target=previous.aiybaiRequest.toSeat,from=previous.aiybaiRequest.fromSeat;
   if(action.accept){
    const expected=[...previous.players[from].hand,...previous.players[target].hand].map(c=>c.id).sort();
    check(JSON.stringify(state.players[from].hand.map(c=>c.id).sort())===JSON.stringify(expected),'Transfer changed card identities');
    check(!C.answerAiybai(state,target,true).ok,'Repeated acceptance must be rejected');
   }else check(JSON.stringify(state.players)===JSON.stringify(previous.players),'Decline changed players');
  }
  expect(action.expect||{});
  record(action.type==='play'?`Player ${action.seat+1} plays ${action.card}`:
   action.type==='request'?'Request Aiybai':action.accept?'Accept Aiybai':'Decline Aiybai');
 }
 return {id:fixture.id,name:fixture.name,passed:true,trace};
}
const api={run};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.BondiScenarios=api;
})(typeof globalThis!=='undefined'?globalThis:this);
