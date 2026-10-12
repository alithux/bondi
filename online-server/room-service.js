'use strict';
const crypto = require('node:crypto');
const Core = require('../multiplayer-core.js');
const Engine = require('./load-engine.js');
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_GRACE_MS=120000;
const IDLE_ROOM_MS=20*60*1000;

function cleanCode(value) { return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); }
function randomCode() { return Array.from({length:6},()=>CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join(''); }
function secureRandom() {return crypto.randomInt(0x100000000)/0x100000000;}
function clone(v){return JSON.parse(JSON.stringify(v));}
function visibleRoom(room) {return clone(room);}
function requireDistinctName(room, desired, exceptClientId=null) {
  const name=Core.cleanName(desired);
  const clash=room.seats.some(seat => (seat.clientId||seat.isAI) &&
    seat.clientId!==exceptClientId && seat.name.toLowerCase()===name.toLowerCase());
  if(clash)throw Error('That player name is already used in this room. Choose a different name.');
  return name;
}
function translateFinishLogs(log,room) {
  return log.map(x=>x.replace(/\bPlayer ([1-4]) has finished\./g,(_,n)=>`${room.seats[Number(n)-1].name} (Seat ${n}) has finished.`));
}
class RoomService {
  constructor({aiDelay=1000,resolutionDelay=1000,graceMs=SESSION_GRACE_MS, maxRooms=100,logger=()=>{}}={}) {
    this.rooms=new Map();this.sessions=new Map();this.aiDelay=aiDelay;this.resolutionDelay=resolutionDelay;this.graceMs=graceMs;this.maxRooms=maxRooms;this.logger=logger;
  }
  attach(peer) {
    peer._bondiv2={token:null,count:0,windowAt:Date.now()};
    peer.on('message', raw=>{
      if(typeof raw!=='string'||raw.length>32768)return peer.close(1009);
      let msg;
      try{msg=JSON.parse(raw);}catch(_){this._error(peer,'Invalid JSON.');return;}
      if(!msg||typeof msg!=='object'||Array.isArray(msg)){this._error(peer,'Invalid message.');return;}
      const conn=peer._bondiv2,now=Date.now();
      if(now-conn.windowAt>10000){conn.count=0;conn.windowAt=now;}
      if(++conn.count>100){this._error(peer,'Too many actions.');peer.close(1008);return;}
      try{this._message(peer,msg);}catch(err){this._error(peer,err.message||'Room error.');}
    });
    peer.on('close',()=>this._disconnect(peer));
    peer.sendJSON({type:'CONNECTED',protocol:1});
  }
  _error(peer,message){peer.sendJSON({type:'ERROR',message:String(message).slice(0,160)});}
  _freshSession(peer,entry,clientId,name) {
    const token=crypto.randomBytes(32).toString('hex');
    const session={token,clientId,roomCode:entry.room.code,name,peer,lastSeen:Date.now(),disconnectTimer:null};
    this.sessions.set(token,session);peer._bondiv2.token=token;
    peer.sendJSON({type:'WELCOME',code:entry.room.code,clientId,token});
    return session;
  }
  _mustSession(peer) {
    const s=this.sessions.get(peer._bondiv2.token);
    if(!s||s.peer!==peer)throw Error('Reconnect or join a room first.');
    const entry=this.rooms.get(s.roomCode);
    if(!entry||!Core.seatForClient(entry.room,s.clientId))throw Error('Room is no longer available.');
    return {s,entry};
  }
  _roomEntry(room){return {room,game:null,aiTimer:null,resolutionTimer:null,resolutionPause:false,aiybaiWindowOpen:false,pauseUntil:0,updatedAt:Date.now(),revision:0};}
  _create(peer,msg){
    if(peer._bondiv2.token)throw Error('Leave the current room first.');
    if(this.rooms.size>=this.maxRooms)throw Error('Server is full. Try again later.');
    let code;do{code=randomCode();}while(this.rooms.has(code));
    const clientId=crypto.randomUUID(),name=Core.cleanName(msg.name);
    const entry=this._roomEntry(Core.createRoom({code,hostClientId:clientId,hostName:name}));
    this.rooms.set(code,entry);this._freshSession(peer,entry,clientId,name);this._broadcast(entry);
  }
  _join(peer,msg){
    if(peer._bondiv2.token)throw Error('Leave the current room first.');
    const code=cleanCode(msg.code),entry=this.rooms.get(code);
    if(!entry||entry.room.phase!=='lobby')throw Error('Room not found or game already started.');
    const clientId=crypto.randomUUID(),name=requireDistinctName(entry.room,msg.name);
    entry.room=Core.applyLobbyAction(entry.room,{type:'JOIN',clientId,name});
    this._freshSession(peer,entry,clientId,name);this._broadcast(entry);
  }
  _resume(peer,msg) {
    if(peer._bondiv2.token)throw Error('Already connected to a room.');
    const token=String(msg.token||''),session=this.sessions.get(token);
    if(!/^[a-f0-9]{64}$/.test(token)||!session||session.roomCode!==cleanCode(msg.code))throw Error('Session expired. Please join again.');
    const entry=this.rooms.get(session.roomCode);
    const oldSeat=entry&&Core.seatForClient(entry.room,session.clientId);
    if(!oldSeat||oldSeat.aiTakeover)throw Error('Your seat is no longer available.');
    if(oldSeat.reconnectUntil&&Date.now()>oldSeat.reconnectUntil)
      throw Error('Session expired. The reconnection window has ended.');
    if(session.disconnectTimer){clearTimeout(session.disconnectTimer);session.disconnectTimer=null;}
    if(session.peer&&session.peer!==peer){
      // A resumed identity has exactly one active connection. Tell the old
      // tab explicitly, so it does not loop forever and steal the seat back.
      session.peer._bondiv2.token=null;
      if(!session.peer.closed)session.peer.sendJSON({type:'SESSION_REPLACED'});
      session.peer.close(1000);
    }
    session.peer=peer;peer._bondiv2.token=token;session.lastSeen=Date.now();
    if(entry.room.phase==='lobby')entry.room=Core.applyLobbyAction(entry.room,{type:'RECONNECT',clientId:session.clientId});
    else {const seat=Core.seatForClient(entry.room,session.clientId);if(seat)seat.connected=true;}
    const resumedSeat=Core.seatForClient(entry.room,session.clientId);if(resumedSeat)delete resumedSeat.reconnectUntil;
    entry.revision++;entry.updatedAt=Date.now();
    peer.sendJSON({type:'WELCOME',code:entry.room.code,clientId:session.clientId,token});
    this._broadcast(entry);
  }
  _message(peer,msg) {
    if(msg.type==='CREATE')return this._create(peer,msg);
    if(msg.type==='JOIN')return this._join(peer,msg);
    if(msg.type==='RESUME')return this._resume(peer,msg);
    if(msg.type!=='ACTION')throw Error('Unknown message type.');
    const {s,entry}=this._mustSession(peer);const action=String(msg.action||'');
    entry.updatedAt=Date.now();
    if(action==='LEAVE'){
      this._leave(s,entry);peer._bondiv2.token=null;
      peer.sendJSON({type:'LEFT'});return;
    }
    if(action==='REMATCH'){
      if(s.clientId!==entry.room.hostClientId)throw Error('Only the host can request another game.');
      if(entry.room.phase!=='game'||!entry.game||!entry.game.roundOver)throw Error('Finish the current game before starting another.');
      clearTimeout(entry.aiTimer);clearTimeout(entry.resolutionTimer);
      entry.aiTimer=null;entry.resolutionTimer=null;entry.resolutionPause=false;entry.aiybaiWindowOpen=false;entry.pauseUntil=0;
      entry.game=null;
      entry.room.phase='lobby';
      // The previous match keeps human names even after AI takes a departed
      // player's seat. Only now, with the previous log gone, assign fresh AI
      // identities for the next match. Make them unique even after multiple
      // takeovers, or when another player chose a name like 'AI 3'.
      const names=new Set(entry.room.seats.filter(seat=>!seat.aiTakeover).map(seat=>seat.name.toLowerCase()));
      entry.room.seats.forEach(seat=>{
        if(seat.aiTakeover){
          let n=1;while(names.has(`ai ${n}`))n++;
          seat.name=`AI ${n}`;names.add(seat.name.toLowerCase());
          delete seat.aiTakeover;
        }
        seat.ready=!!seat.isAI;
      });
      entry.room.updatedAt=Date.now();entry.revision++;
      this._broadcast(entry);return;
    }
    if(entry.room.phase==='lobby'){
      const t={READY:'SET_READY',DEALER:'SET_DEALER',AI_DIFFICULTY:'SET_AI_DIFFICULTY',ADD_AI:'ADD_AI',REMOVE_AI:'REMOVE_AI',NAME:'SET_NAME'}[action];
      if(action==='START'){
        if(s.clientId!==entry.room.hostClientId)throw Error('Only the host can start.');
        const started=Core.startGame(entry.room,Engine,secureRandom);
        entry.room=started.room;entry.room.matchNumber=(Number(entry.room.matchNumber)||0)+1;entry.game=started.game;entry.resolutionPause=false;entry.aiybaiWindowOpen=false;entry.revision++;
        this._broadcast(entry);this._schedule(entry);return;
      }
      if(!t)throw Error('That action is not allowed in the lobby.');
      const name=t==='SET_NAME'?requireDistinctName(entry.room,msg.name,s.clientId):msg.name;
      entry.room=Core.applyLobbyAction(entry.room,{type:t,clientId:s.clientId,ready:!!msg.ready,seat:msg.seat,name,difficulty:msg.difficulty});
      this._broadcast(entry);return;
    }
    if(entry.room.phase==='game'&&action==='REQUEST_AIYBAI'){
      const r=Core.requestAiybai(entry.room,entry.game,s.clientId,
        entry.aiybaiWindowOpen);
      if(!r.ok)throw Error(r.error);
      entry.game=r.state;
      entry.aiybaiWindowOpen=false;
      clearTimeout(entry.resolutionTimer);
      // AI answers a request deliberately; it never takes cards without one.
      if(Core.isAISeat(entry.room,r.toSeat))
        entry.resolutionTimer=setTimeout(()=>this._settleAiybai(entry,r.toSeat,true),Math.max(150,this.aiDelay));
      else
        // Non-response cancels the request after 30s; it never transfers cards.
        entry.resolutionTimer=setTimeout(()=>this._settleAiybai(entry,r.toSeat,false),30000);
      entry.revision++;this._broadcast(entry);return;
    }
    if(entry.room.phase==='game'&&action==='ANSWER_AIYBAI'){
      const seat=Core.seatForClient(entry.room,s.clientId);
      if(!seat||seat.isAI||!entry.game?.aiybaiRequest||entry.game.aiybaiRequest.toSeat!==seat.seat)
        throw Error('Only the requested human player may accept or decline.');
      this._settleAiybai(entry,seat.seat,msg.accept===true);return;
    }
    if(entry.room.phase!=='game'||action!=='PLAY')throw Error('That action is not allowed during the game.');
    if(entry.game?.aiybaiRequest)throw Error('Wait for the requested player to answer.');
    if(entry.resolutionPause)throw Error('Wait for the Aiy to resolve.');
    const cardId=String(msg.cardId||'');
    const before=entry.game;
    const r=Core.applyHumanPlay(entry.room,before,s.clientId,cardId,Engine);
    if(!r.ok)throw Error(r.error);
    entry.game=r.state;this._afterPlay(entry,before);
  }
  _settleAiybai(entry,answerSeat,accepted){
    if(!entry.game?.aiybaiRequest)return;
    const result=Core.answerAiybai(entry.game,answerSeat,accepted);
    if(!result.ok){this.logger('Aiybai answer rejected',result.error);return;}
    clearTimeout(entry.resolutionTimer);
    entry.resolutionTimer=null;
    entry.game=result.state;
    entry.aiybaiWindowOpen=false;
    entry.resolutionPause=false;entry.pauseUntil=0;
    if(entry.game.roundOver)entry.room=Core.archiveMatch(entry.room,entry.game);
    // The original leader resumes immediately after the requested player
    // agrees or declines. No artificial pause is required.
    entry.revision++;this._broadcast(entry);this._schedule(entry);
  }
  _afterPlay(entry,before){
    clearTimeout(entry.aiTimer);entry.aiTimer=null;
    entry.revision++;
    const resolved=Core.recordAiyResolution(before,entry.game);
    if(entry.game.roundOver)entry.room=Core.archiveMatch(entry.room,entry.game);
    // The new leader may request Aiybai at their own pace until they
    // either start the next Aiy or initiate one consensual request.
    entry.aiybaiWindowOpen=!!(resolved&&!entry.game.roundOver);
    clearTimeout(entry.resolutionTimer);
    entry.resolutionTimer=null;
    // Hold the completed cards on every player's screen for one second,
    // including when an AI wins the Aiy or only two players remain. The
    // following AI lead is immediate when this review ends, so the normal
    // 1000ms AI thinking timer is not stacked on top of the review.
    const reviewAiy=entry.aiybaiWindowOpen&&this.resolutionDelay>0;
    entry.resolutionPause=reviewAiy;
    entry.pauseUntil=reviewAiy?Date.now()+this.resolutionDelay:0;
    this._broadcast(entry);
    if(reviewAiy){
      entry.resolutionTimer=setTimeout(()=>{
        if(!this.rooms.has(entry.room.code)||entry.game?.aiybaiRequest)return;
        entry.resolutionTimer=null;
        entry.resolutionPause=false;entry.pauseUntil=0;
        entry.revision++;this._broadcast(entry);this._schedule(entry,0);
      },this.resolutionDelay);
    }else this._schedule(entry);
  }
  _schedule(entry,delay=this.aiDelay){
    clearTimeout(entry.aiTimer);
    if(!entry.game||entry.game.roundOver||entry.resolutionPause)return;
    const i=entry.game.currentPlayer;
    if(!Core.isAISeat(entry.room,i))return;
    entry.aiTimer=setTimeout(()=>{
      if(!this.rooms.has(entry.room.code)||entry.game.roundOver||entry.resolutionPause||entry.game.aiybaiRequest||!Core.isAISeat(entry.room,entry.game.currentPlayer))return;
      const seat=entry.game.currentPlayer;
      const card=Engine.chooseAICard(entry.game,seat,entry.room.aiDifficulty||'hard');
      if(!card){this.logger('AI had no move',entry.room.code);return;}
      const before=entry.game;
      const tactic=(entry.room.aiDifficulty||'hard')==='hard'?Engine.explainHardAILead(before,seat,card):null;
      const r=Engine.playCard(before,seat,card.id);
      if(!r.ok){this.logger('Illegal AI move',entry.room.code,r.error);return;}
      // Insert public-information-only reasoning immediately before the lead.
      // The existing human/AI play, Bondi and finishing log lines are unchanged.
      if(tactic) r.state.log.splice(before.log.length,0,
        `AI lead insight · ${before.players[seat].name} (Seat ${seat+1}) · ${card.suit}: ${tactic.explanation} (Seat ${tactic.nextSeat}).`);
      entry.game=r.state;this._afterPlay(entry,before);
    },Math.max(0,delay));
  }
  _broadcast(entry){
    const room=visibleRoom(entry.room);
    for(const s of this.sessions.values()){
      if(s.roomCode!==entry.room.code||!s.peer||s.peer.closed)continue;
      const seat=Core.seatForClient(entry.room,s.clientId);
      if(!seat)continue;
      const view=entry.game?Core.projectGame(entry.room,entry.game,s.clientId,entry.resolutionPause,entry.aiybaiWindowOpen):null;
      if(view)view.log=translateFinishLogs(view.log,entry.room);
      s.peer.sendJSON({type:'SNAPSHOT',room,view,clientId:s.clientId,seat:seat.seat,isHost:s.clientId===room.hostClientId,revision:entry.revision});
    }
  }
  _leave(s,entry){
    if(entry.room.phase==='lobby'){
      // An expired/leaving lobby host must not destroy a room with guests.
      // Transfer host authority before Core handles the LEAVE action.
      if(entry.room.hostClientId===s.clientId){
        const nextHost=entry.room.seats.filter(x=>x.clientId&&x.clientId!==s.clientId&&!x.isAI)
          .sort((a,b)=>Number(b.connected)-Number(a.connected)||a.seat-b.seat)[0];
        if(nextHost)entry.room.hostClientId=nextHost.clientId;
      }
      entry.room=Core.applyLobbyAction(entry.room,{type:'LEAVE',clientId:s.clientId});
      if(entry.room.phase==='closed')this._closeRoom(entry.room.code);
      else {entry.revision++;this._broadcast(entry);}
    }else if(entry.room.phase==='game'){
      if(entry.game?.aiybaiRequest){
        const seat=Core.seatForClient(entry.room,s.clientId);
        if(seat&&[entry.game.aiybaiRequest.fromSeat,entry.game.aiybaiRequest.toSeat].includes(seat.seat))
          this._settleAiybai(entry,entry.game.aiybaiRequest.toSeat,false);
      }
      const previous=Core.seatForClient(entry.room,s.clientId);
      const previousName=previous.name;
      const r=Core.replaceClientWithAI(entry.room,s.clientId);entry.room=r.room;
      const takeover=entry.room.seats[r.seat];
      delete takeover.reconnectUntil;
      // Preserve the human's historical identity through the current match.
      // Crucially, even a 'finished' BONDI player could return on a later
      // Bondi collection, so an AI must still be able to play this seat.
      takeover.name=previousName;
      takeover.aiTakeover=true;
      entry.game.players[r.seat].name=previousName;
      entry.game.log.push(`${previousName} (Seat ${r.seat+1}) left — AI controls their Aiybai until this match ends.`);
      // When a host leaves mid-game, promote the next human so an ended
      // match still has someone who can request a rematch.
      if(entry.room.hostClientId===s.clientId){
        const candidate=entry.room.seats.filter(x=>x.clientId&&!x.isAI)
          .sort((a,b)=>Number(b.connected)-Number(a.connected)||a.seat-b.seat)[0];
        entry.room.hostClientId=candidate?candidate.clientId:null;
      }
      entry.revision++;this._broadcast(entry);this._schedule(entry);
    }
    if(s.disconnectTimer)clearTimeout(s.disconnectTimer);
    this.sessions.delete(s.token);
  }
  _disconnect(peer) {
    const token=peer._bondiv2?.token;
    if(!token)return;
    const s=this.sessions.get(token);
    if(!s||s.peer!==peer)return;
    s.peer=null;s.lastSeen=Date.now();
    const entry=this.rooms.get(s.roomCode);
    if(!entry)return;
    if(entry.room.phase==='lobby')entry.room=Core.applyLobbyAction(entry.room,{type:'DISCONNECT',clientId:s.clientId});
    else {const seat=Core.seatForClient(entry.room,s.clientId);if(seat)seat.connected=false;}
    const seat=Core.seatForClient(entry.room,s.clientId);
    if(seat)seat.reconnectUntil=Date.now()+this.graceMs;
    entry.revision++;entry.updatedAt=Date.now();
    this._broadcast(entry);
    s.disconnectTimer=setTimeout(()=>{
      const latest=this.rooms.get(s.roomCode);
      if(!latest||s.peer)return;
      this._leave(s,latest);
    },this.graceMs);
  }
  _closeRoom(code){
    const entry=this.rooms.get(code);
    if(!entry)return;
    clearTimeout(entry.aiTimer);clearTimeout(entry.resolutionTimer);
    this.rooms.delete(code);
    for(const s of [...this.sessions.values()]){
      if(s.roomCode!==code)continue;
      if(s.peer&&!s.peer.closed){s.peer.sendJSON({type:'ROOM_CLOSED'});s.peer._bondiv2.token=null;}
      if(s.disconnectTimer)clearTimeout(s.disconnectTimer);
      this.sessions.delete(s.token);
    }
  }
  cleanIdleRooms(now=Date.now()){
    for(const [code,entry] of this.rooms){
      const connected=[...this.sessions.values()].some(s=>s.roomCode===code&&s.peer&&!s.peer.closed);
      if(!connected&&now-entry.updatedAt>IDLE_ROOM_MS)this._closeRoom(code);
    }
  }
  shutdown(){for(const code of [...this.rooms.keys()])this._closeRoom(code);}
}
module.exports={RoomService,cleanCode,translateFinishLogs,requireDistinctName};
