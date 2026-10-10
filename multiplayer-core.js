/* BONDI Stage 5 multiplayer core. Browser + CommonJS compatible. */
(function (root) {
  'use strict';

  const ROOM_VERSION = 1;
  const MAX_PLAYERS = 4;

  const clone = value => JSON.parse(JSON.stringify(value));
  const cleanName = value => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24) || 'Player';

  function seatTemplate(index) {
    return { seat: index, clientId: null, name: `Player ${index + 1}`, isAI: false, ready: false, connected: false };
  }

  function createRoom({ code, hostClientId, hostName }) {
    if (!code || !hostClientId) throw new Error('Room code and host client ID are required.');
    const seats = Array.from({ length: MAX_PLAYERS }, (_, i) => seatTemplate(i));
    seats[0] = { seat: 0, clientId: hostClientId, name: cleanName(hostName), isAI: false, ready: false, connected: true };
    return {
      version: ROOM_VERSION,
      code: String(code).toUpperCase(),
      phase: 'lobby',
      hostClientId,
      dealerSeat: 3,
      aiDifficulty: 'hard',
      seats,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function seatForClient(room, clientId) {
    return room.seats.find(s => s && s.clientId === clientId) || null;
  }

  function assertHost(room, clientId) {
    if (room.hostClientId !== clientId) throw new Error('Only the room host can do that.');
  }

  function nextAIName(room) {
    const used = new Set(room.seats.filter(Boolean).map(s => s.name));
    let n = 1;
    while (used.has(`AI ${n}`)) n++;
    return `AI ${n}`;
  }

  function applyLobbyAction(room, action) {
    if (!room || room.phase !== 'lobby') throw new Error('The room is not in the lobby.');
    const r = clone(room);
    const type = action && action.type;

    if (type === 'JOIN') {
      if (!action.clientId) throw new Error('Missing client ID.');
      const existing = seatForClient(r, action.clientId);
      if (existing) {
        existing.connected = true;
        existing.name = cleanName(action.name || existing.name);
      } else {
        const open = r.seats.find(s => !s.clientId && !s.isAI);
        if (!open) throw new Error('This room is full.');
        open.clientId = action.clientId;
        open.name = cleanName(action.name);
        open.ready = false;
        open.connected = true;
      }
    } else if (type === 'SET_READY') {
      const seat = seatForClient(r, action.clientId);
      if (!seat || seat.isAI) throw new Error('Player seat not found.');
      seat.ready = !!action.ready;
    } else if (type === 'SET_NAME') {
      const seat = seatForClient(r, action.clientId);
      if (!seat || seat.isAI) throw new Error('Player seat not found.');
      seat.name = cleanName(action.name);
    } else if (type === 'SET_DEALER') {
      assertHost(r, action.clientId);
      const seat = Number(action.seat);
      if (!Number.isInteger(seat) || seat < 0 || seat >= MAX_PLAYERS) throw new Error('Dealer seat is invalid.');
      r.dealerSeat = seat;
    } else if (type === 'SET_AI_DIFFICULTY') {
      assertHost(r, action.clientId);
      if (!['easy', 'medium', 'hard'].includes(action.difficulty)) throw new Error('AI difficulty must be Easy, Medium, or Hard.');
      r.aiDifficulty = action.difficulty;
    } else if (type === 'ADD_AI') {
      assertHost(r, action.clientId);
      const open = r.seats.find(s => !s.clientId && !s.isAI);
      if (!open) throw new Error('There are no empty seats.');
      open.isAI = true;
      open.name = nextAIName(r);
      open.ready = true;
      open.connected = true;
    } else if (type === 'REMOVE_AI') {
      assertHost(r, action.clientId);
      const seat = r.seats[Number(action.seat)];
      if (!seat || !seat.isAI) throw new Error('That seat is not an AI seat.');
      r.seats[seat.seat] = seatTemplate(seat.seat);
    } else if (type === 'LEAVE') {
      const seat = seatForClient(r, action.clientId);
      if (!seat) return r;
      if (action.clientId === r.hostClientId) {
        r.phase = 'closed';
      } else {
        r.seats[seat.seat] = seatTemplate(seat.seat);
      }
    } else if (type === 'DISCONNECT') {
      const seat = seatForClient(r, action.clientId);
      if (seat) seat.connected = false;
    } else if (type === 'RECONNECT') {
      const seat = seatForClient(r, action.clientId);
      if (seat) seat.connected = true;
    } else {
      throw new Error(`Unknown lobby action: ${type}`);
    }

    r.updatedAt = Date.now();
    return r;
  }

  function canStart(room) {
    if (!room || room.phase !== 'lobby') return false;
    if (room.seats.length !== MAX_PLAYERS || room.seats.some(s => !s || (!s.clientId && !s.isAI))) return false;
    return room.seats.every(s => s.isAI || (s.connected && s.ready));
  }

  function startGame(room, engine, random = Math.random) {
    if (!canStart(room)) throw new Error('All four seats must be filled and all human players must be ready.');
    if (!engine || typeof engine.createGame !== 'function') throw new Error('BONDI engine is unavailable.');
    const game = engine.createGame({ playerCount: MAX_PLAYERS, dealer: room.dealerSeat, random });
    game.players.forEach((p, i) => { p.name = room.seats[i].name; });
    const nextRoom = clone(room);
    nextRoom.phase = 'game';
    nextRoom.updatedAt = Date.now();
    return { room: nextRoom, game };
  }

  function publicPlayer(p, own) {
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      handCount: p.hand.length,
      hand: own ? clone(p.hand) : []
    };
  }

  function projectGame(room, game, viewerClientId, resolutionPause = false) {
    const seat = seatForClient(room, viewerClientId);
    if (!seat) throw new Error('Viewer is not seated in this room.');
    return {
      viewerSeat: seat.seat,
      dealer: game.dealer,
      currentPlayer: game.currentPlayer,
      leadSuit: game.leadSuit,
      trick: clone(game.trick),
      pendingFinish: clone(game.pendingFinish || []),
      finishedOrder: clone(game.finishedOrder || []),
      roundOver: !!game.roundOver,
      lastResolution: clone(game.lastResolution),
      message: game.message,
      log: clone(game.log || []),
      resolutionPause: !!resolutionPause,
      players: game.players.map((p, i) => publicPlayer(p, i === seat.seat))
    };
  }

  function clientForSeat(room, seatIndex) {
    const seat = room.seats[seatIndex];
    return seat && !seat.isAI ? seat.clientId : null;
  }

  function isAISeat(room, seatIndex) {
    return !!(room.seats[seatIndex] && room.seats[seatIndex].isAI);
  }

  function replaceClientWithAI(room, clientId) {
    if (!room || room.phase !== 'game') throw new Error('AI replacement is only available during a game.');
    const r = clone(room);
    const seat = seatForClient(r, clientId);
    if (!seat || seat.isAI) throw new Error('Human player seat not found.');
    const seatIndex = seat.seat;
    seat.clientId = null;
    seat.isAI = true;
    seat.ready = true;
    seat.connected = true;
    seat.name = nextAIName(r);
    r.updatedAt = Date.now();
    return { room: r, seat: seatIndex, name: seat.name };
  }

  function validateHumanPlay(room, game, clientId, cardId, engine) {
    if (!room || room.phase !== 'game') return { ok: false, error: 'The game has not started.' };
    const seat = seatForClient(room, clientId);
    if (!seat || seat.isAI) return { ok: false, error: 'Player seat not found.' };
    if (game.roundOver) return { ok: false, error: 'The round is over.' };
    if (game.currentPlayer !== seat.seat) return { ok: false, error: 'It is not your turn.' };
    const legal = engine.legalMoves(game, seat.seat);
    if (!legal.some(c => c.id === cardId)) return { ok: false, error: 'That card is not a legal move.' };
    return { ok: true, seat: seat.seat };
  }

  function applyHumanPlay(room, game, clientId, cardId, engine) {
    const valid = validateHumanPlay(room, game, clientId, cardId, engine);
    if (!valid.ok) return valid;
    return engine.playCard(game, valid.seat, cardId);
  }

  const api = {
    ROOM_VERSION,
    MAX_PLAYERS,
    cleanName,
    createRoom,
    seatForClient,
    applyLobbyAction,
    canStart,
    startGame,
    projectGame,
    clientForSeat,
    isAISeat,
    replaceClientWithAI,
    validateHumanPlay,
    applyHumanPlay
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BondiMultiplayerCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
