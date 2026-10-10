'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Core=require('./multiplayer-core.js');
const Engine=require('./online-server/load-engine.js');
const {RoomService}=require('./online-server/room-service.js');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

class FakePeer extends EventEmitter {
  constructor(){super();this.messages=[];this.closed=false;}
  sendJSON(value){this.messages.push(JSON.parse(JSON.stringify(value)));}
  write(value){this.emit('message',JSON.stringify(value));}
  latest(type){return this.messages.filter(x=>x.type===type).at(-1);}
  close(){if(!this.closed){this.closed=true;this.emit('close');}}
}
function attach(service){const peer=new FakePeer();service.attach(peer);return peer;}
function action(peer,name,params={}){peer.write({type:'ACTION',action:name,...params});}

async function main(){
  let room=Core.createRoom({code:'ABC123',hostClientId:'host',hostName:'Host'});
  assert.equal(room.aiDifficulty,'hard','existing Hard behavior remains the default');
  for(const level of ['easy','medium','hard']){
    room=Core.applyLobbyAction(room,{type:'SET_AI_DIFFICULTY',clientId:'host',difficulty:level});
    assert.equal(room.aiDifficulty,level);
  }
  assert.throws(()=>Core.applyLobbyAction(room,{type:'SET_AI_DIFFICULTY',clientId:'guest',difficulty:'easy'}),/host/i);
  for(const value of ['expert','HARD','',null,3]){
    assert.throws(()=>Core.applyLobbyAction(room,{type:'SET_AI_DIFFICULTY',clientId:'host',difficulty:value}),/difficulty/i);
  }
  assert.equal(room.aiDifficulty,'hard','rejected changes do not mutate room');
  console.log('PASS room difficulty defaults, valid choices and host-only validation');

  const originalChoose=Engine.chooseAICard;
  const chosenLevels=[];
  Engine.chooseAICard=function(state,playerIndex,level,...other){
    chosenLevels.push(level);
    return originalChoose(state,playerIndex,level,...other);
  };
  try{
    for(const level of ['easy','medium','hard']){
      chosenLevels.length=0;
      const service=new RoomService({aiDelay:1,resolutionDelay:1});
      try{
        const host=attach(service);
        host.write({type:'CREATE',name:'Host'});
        const code=host.latest('WELCOME').code;
        action(host,'AI_DIFFICULTY',{difficulty:level});
        assert.equal(host.latest('SNAPSHOT').room.aiDifficulty,level);
        const guest=attach(service);
        guest.write({type:'JOIN',code,name:'Guest'});
        assert.equal(guest.latest('SNAPSHOT').room.aiDifficulty,level,'guests see the chosen level');
        action(guest,'AI_DIFFICULTY',{difficulty:'hard'});
        assert.match(guest.latest('ERROR').message,/host/i);
        assert.equal(host.latest('SNAPSHOT').room.aiDifficulty,level);
        action(host,'ADD_AI');action(host,'ADD_AI');
        action(host,'DEALER',{seat:3}); // the dealer's right is seat 3 (index 2), an AI
        action(host,'READY',{ready:true});
        action(guest,'READY',{ready:true});
        action(host,'START');
        assert.equal(host.latest('SNAPSHOT').room.phase,'game');
        for(let tries=0;tries<20&&!chosenLevels.length;tries++)await wait(20);
        assert(chosenLevels.length,'online game must make an AI decision');
        assert(chosenLevels.every(x=>x===level),'online AI must receive the selected '+level+' level');
        assert.equal(host.latest('SNAPSHOT').room.aiDifficulty,level);
      }finally{service.shutdown();}
    }
    console.log('PASS server uses Easy, Medium and Hard and shows selected level to guests');

    // After a same-room rematch, room settings should not be reset.
    room=Core.applyLobbyAction(room,{type:'SET_AI_DIFFICULTY',clientId:'host',difficulty:'medium'});
    const started=Core.startGame(
      Core.applyLobbyAction(
        Core.applyLobbyAction(
          Core.applyLobbyAction(
            Core.applyLobbyAction(room,{type:'ADD_AI',clientId:'host'}),
            {type:'ADD_AI',clientId:'host'}),
          {type:'ADD_AI',clientId:'host'}),
        {type:'SET_READY',clientId:'host',ready:true}),Engine);
    assert.equal(started.room.aiDifficulty,'medium');
    console.log('PASS game starts with persisted difficulty');
  }finally{Engine.chooseAICard=originalChoose;}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
