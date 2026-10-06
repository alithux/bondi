/* BONDI Stage 5 browser multiplayer transport/controller.
   Stage 5.0 uses BroadcastChannel (with localStorage fallback), so rooms work
   across tabs/windows on the same browser profile. The controller is host-
   authoritative and is intentionally backend-agnostic for the next online step. */
(function (root) {
  'use strict';

  const Core = root.BondiMultiplayerCore;
  if (!Core) throw new Error('BONDI multiplayer core is missing.');

  const ROOM_PREFIX = 'bondi:room:';
  const BUS_PREFIX = 'bondi:bus:';
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function id() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function makeCode() {
    let s = '';
    const bytes = root.crypto && root.crypto.getRandomValues ? root.crypto.getRandomValues(new Uint8Array(6)) : null;
    for (let i = 0; i < 6; i++) {
      const n = bytes ? bytes[i] : Math.floor(Math.random() * 256);
      s += CODE_ALPHABET[n % CODE_ALPHABET.length];
    }
    return s;
  }

  function normalizeCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function roomRegistryWrite(code, hostClientId) {
    try { localStorage.setItem(ROOM_PREFIX + code, JSON.stringify({ code, hostClientId, updatedAt: Date.now() })); } catch (_) {}
  }
  function roomRegistryRemove(code) {
    try { localStorage.removeItem(ROOM_PREFIX + code); } catch (_) {}
  }

  class RoomTransport {
    constructor(code, handler) {
      this.code = code;
      this.handler = handler;
      this.instanceId = id();
      this.channel = null;
      this.storageHandler = null;
      if ('BroadcastChannel' in root) {
        this.channel = new BroadcastChannel(`bondi-room-${code}`);
        this.channel.onmessage = e => this._receive(e.data);
      } else {
        this.storageHandler = e => {
          if (e.key !== BUS_PREFIX + code || !e.newValue) return;
          try { this._receive(JSON.parse(e.newValue)); } catch (_) {}
        };
        root.addEventListener('storage', this.storageHandler);
      }
    }
    _receive(message) {
      if (!message || message.transportInstance === this.instanceId) return;
      this.handler(message);
    }
    send(message) {
      const payload = Object.assign({}, message, { transportInstance: this.instanceId, sentAt: Date.now(), nonce: Math.random().toString(36).slice(2) });
      if (this.channel) this.channel.postMessage(payload);
      else {
        try { localStorage.setItem(BUS_PREFIX + this.code, JSON.stringify(payload)); } catch (_) {}
      }
    }
    close() {
      if (this.channel) this.channel.close();
      if (this.storageHandler) root.removeEventListener('storage', this.storageHandler);
    }
  }

  class MultiplayerClient {
    constructor({ engine, onUpdate, onError, aiDifficulty = 'hard', aiDelay = 650, resolutionDelay = 1800 } = {}) {
      if (!engine) throw new Error('BONDI engine is required.');
      this.engine = engine;
      this.onUpdate = typeof onUpdate === 'function' ? onUpdate : () => {};
      this.onError = typeof onError === 'function' ? onError : () => {};
      this.aiDifficulty = aiDifficulty;
      this.aiDelay = aiDelay;
      this.resolutionDelay = resolutionDelay;
      this.clientId = id();
      this.name = 'Player';
      this.room = null;
      this.game = null;
      this.view = null;
      this.transport = null;
      this.isHost = false;
      this.resolutionPause = false;
      this.aiTimer = null;
      this.resolutionTimer = null;
      this.joinTimer = null;
      this.closed = false;
    }

    _emit() {
      const seat = this.room ? Core.seatForClient(this.room, this.clientId) : null;
      this.onUpdate({
        room: this.room ? JSON.parse(JSON.stringify(this.room)) : null,
        view: this.view ? JSON.parse(JSON.stringify(this.view)) : null,
        clientId: this.clientId,
        seat: seat ? seat.seat : null,
        isHost: this.isHost,
        transport: 'local-browser'
      });
    }

    _fail(message) {
      this.onError(String(message || 'Multiplayer error.'));
    }

    _openTransport(code) {
      if (this.transport) this.transport.close();
      this.transport = new RoomTransport(code, msg => this._onMessage(msg));
    }

    createRoom(name) {
      this.leave(false);
      this.closed = false;
      this.name = Core.cleanName(name);
      const code = makeCode();
      this.room = Core.createRoom({ code, hostClientId: this.clientId, hostName: this.name });
      this.isHost = true;
      this._openTransport(code);
      roomRegistryWrite(code, this.clientId);
      this._broadcastRoom();
      this._emit();
      return code;
    }

    joinRoom(name, rawCode) {
      this.leave(false);
      this.closed = false;
      const code = normalizeCode(rawCode);
      if (code.length !== 6) throw new Error('Enter the 6-character room code.');
      this.name = Core.cleanName(name);
      this.isHost = false;
      this.room = null;
      this.view = null;
      this._openTransport(code);
      this.transport.send({ type: 'JOIN_REQUEST', clientId: this.clientId, name: this.name });
      clearTimeout(this.joinTimer);
      this.joinTimer = setTimeout(() => {
        if (!this.room) this._fail('Room not found on this browser. Make sure the host room is open in another tab/window.');
      }, 2500);
      this._emit();
      return code;
    }

    setReady(ready) { this._lobbyAction({ type: 'SET_READY', clientId: this.clientId, ready: !!ready }); }
    setName(name) { this.name = Core.cleanName(name); this._lobbyAction({ type: 'SET_NAME', clientId: this.clientId, name: this.name }); }
    setDealer(seat) { this._lobbyAction({ type: 'SET_DEALER', clientId: this.clientId, seat: Number(seat) }); }
    addAI() { this._lobbyAction({ type: 'ADD_AI', clientId: this.clientId }); }
    removeAI(seat) { this._lobbyAction({ type: 'REMOVE_AI', clientId: this.clientId, seat: Number(seat) }); }

    _lobbyAction(action) {
      if (!this.transport) return;
      if (this.isHost) this._hostLobbyAction(action);
      else this.transport.send({ type: 'LOBBY_ACTION', action });
    }

    _hostLobbyAction(action) {
      try {
        this.room = Core.applyLobbyAction(this.room, action);
        this._broadcastRoom();
        this._emit();
      } catch (e) { this._fail(e.message); }
    }

    startGame() {
      if (!this.isHost) return this._fail('Only the host can start the game.');
      try {
        const started = Core.startGame(this.room, this.engine);
        this.room = started.room;
        this.game = started.game;
        this.resolutionPause = false;
        this._broadcastRoom();
        this._broadcastViews();
        this._scheduleNext();
      } catch (e) { this._fail(e.message); }
    }

    playCard(cardId) {
      if (!this.room || this.room.phase !== 'game') return;
      if (this.resolutionPause && this.isHost) return this._fail('Wait for the Aiy resolution to finish.');
      if (this.isHost) this._hostPlay(this.clientId, cardId);
      else this.transport.send({ type: 'PLAY_REQUEST', clientId: this.clientId, cardId });
    }

    _hostPlay(clientId, cardId) {
      if (this.resolutionPause) return;
      const before = this.game;
      const result = Core.applyHumanPlay(this.room, this.game, clientId, cardId, this.engine);
      if (!result.ok) {
        this._sendTo(clientId, { type: 'ERROR', message: result.error });
        if (clientId === this.clientId) this._fail(result.error);
        return;
      }
      this.game = result.state;
      this._afterPlay(before);
    }

    _afterPlay(before) {
      const oldRes = before && before.lastResolution ? JSON.stringify(before.lastResolution) : '';
      const newRes = this.game && this.game.lastResolution ? JSON.stringify(this.game.lastResolution) : '';
      const resolved = !!newRes && oldRes !== newRes;
      if (resolved && !this.game.roundOver) {
        this.resolutionPause = true;
        this._broadcastViews();
        clearTimeout(this.resolutionTimer);
        this.resolutionTimer = setTimeout(() => {
          this.resolutionPause = false;
          this._broadcastViews();
          this._scheduleNext();
        }, this.resolutionDelay);
      } else {
        this._broadcastViews();
        this._scheduleNext();
      }
    }

    _scheduleNext() {
      clearTimeout(this.aiTimer);
      if (!this.isHost || !this.game || this.game.roundOver || this.resolutionPause) return;
      const seat = this.game.currentPlayer;
      if (!Core.isAISeat(this.room, seat)) return;
      this.aiTimer = setTimeout(() => {
        if (!this.game || this.game.roundOver || this.resolutionPause || !Core.isAISeat(this.room, this.game.currentPlayer)) return;
        const i = this.game.currentPlayer;
        const card = this.engine.chooseAICard(this.game, i, this.aiDifficulty);
        if (!card) return this._fail('AI could not choose a card.');
        const before = this.game;
        const result = this.engine.playCard(this.game, i, card.id);
        if (!result.ok) return this._fail(result.error);
        this.game = result.state;
        this._afterPlay(before);
      }, this.aiDelay);
    }

    _broadcastRoom() {
      if (!this.isHost || !this.transport || !this.room) return;
      roomRegistryWrite(this.room.code, this.clientId);
      this.transport.send({ type: 'ROOM_STATE', room: this.room });
    }

    _sendTo(clientId, payload) {
      if (!this.transport) return;
      this.transport.send(Object.assign({}, payload, { targetClientId: clientId }));
    }

    _broadcastViews() {
      if (!this.isHost || !this.room || !this.game) return;
      this.room.seats.forEach(seat => {
        if (!seat || seat.isAI || !seat.clientId) return;
        const view = Core.projectGame(this.room, this.game, seat.clientId, this.resolutionPause);
        if (seat.clientId === this.clientId) {
          this.view = view;
          this._emit();
        } else {
          this._sendTo(seat.clientId, { type: 'GAME_VIEW', view, room: this.room });
        }
      });
    }

    _onMessage(msg) {
      if (!msg || (msg.targetClientId && msg.targetClientId !== this.clientId)) return;
      if (this.isHost) {
        if (msg.type === 'JOIN_REQUEST') {
          try {
            this.room = Core.applyLobbyAction(this.room, { type: 'JOIN', clientId: msg.clientId, name: msg.name });
            this._sendTo(msg.clientId, { type: 'JOIN_ACCEPTED', room: this.room });
            this._broadcastRoom();
            this._emit();
          } catch (e) { this._sendTo(msg.clientId, { type: 'ERROR', message: e.message }); }
          return;
        }
        if (msg.type === 'LOBBY_ACTION') { this._hostLobbyAction(msg.action); return; }
        if (msg.type === 'PLAY_REQUEST') { this._hostPlay(msg.clientId, msg.cardId); return; }
        if (msg.type === 'LEAVE') {
          if (this.room && this.room.phase === 'game') {
            try {
              const replacement = Core.replaceClientWithAI(this.room, msg.clientId);
              this.room = replacement.room;
              if (this.game && this.game.players[replacement.seat]) this.game.players[replacement.seat].name = replacement.name;
              this._broadcastRoom();
              this._broadcastViews();
              this._scheduleNext();
            } catch (e) { this._fail(e.message); }
          } else this._hostLobbyAction({ type: 'LEAVE', clientId: msg.clientId });
          return;
        }
      }

      if (msg.type === 'JOIN_ACCEPTED') {
        clearTimeout(this.joinTimer);
        this.room = msg.room;
        this._emit();
      } else if (msg.type === 'ROOM_STATE') {
        if (!this.room && !Core.seatForClient(msg.room, this.clientId)) return;
        this.room = msg.room;
        this._emit();
      } else if (msg.type === 'GAME_VIEW') {
        this.room = msg.room || this.room;
        this.view = msg.view;
        this._emit();
      } else if (msg.type === 'ERROR') {
        this._fail(msg.message);
      } else if (msg.type === 'ROOM_CLOSED') {
        this._fail('The host closed the room.');
        this.leave(false);
        this._emit();
      }
    }

    leave(notify = true) {
      clearTimeout(this.aiTimer);
      clearTimeout(this.resolutionTimer);
      clearTimeout(this.joinTimer);
      if (notify && this.transport && this.room) {
        if (this.isHost) {
          this.transport.send({ type: 'ROOM_CLOSED' });
          roomRegistryRemove(this.room.code);
        } else {
          this.transport.send({ type: 'LEAVE', clientId: this.clientId });
        }
      }
      if (this.transport) this.transport.close();
      this.transport = null;
      this.room = null;
      this.game = null;
      this.view = null;
      this.isHost = false;
      this.resolutionPause = false;
      if (notify) this._emit();
    }
  }

  root.BondiMultiplayer = { MultiplayerClient, normalizeCode, makeCode };
})(window);
