/* BONDI Stage 5 browser multiplayer transport/controller.
   Stage 5.0.2 keeps the durable mailbox and adds a shared-browser authoritative
   game snapshot. The active human tab can validate/apply its own move even when
   iOS suspends the original host tab. This is only for same-browser testing; a
   real online deployment will move authority to a server. */
(function (root) {
  'use strict';

  const Core = root.BondiMultiplayerCore;
  if (!Core) throw new Error('BONDI multiplayer core is missing.');

  const ROOM_PREFIX = 'bondi:room:';
  const BUS_PREFIX = 'bondi:bus:';
  const MAIL_PREFIX = 'bondi:mail:';
  const MAIL_TTL_MS = 10 * 60 * 1000;
  const GAME_PREFIX = 'bondi:game:';
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
  function sharedGameRead(code) {
    try {
      const raw = localStorage.getItem(GAME_PREFIX + code);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function sharedGameWrite(code, payload) {
    try { localStorage.setItem(GAME_PREFIX + code, JSON.stringify(payload)); return true; } catch (_) { return false; }
  }
  function sharedGameRemove(code) {
    try { localStorage.removeItem(GAME_PREFIX + code); } catch (_) {}
  }

  class RoomTransport {
    constructor(code, handler) {
      this.code = code;
      this.handler = handler;
      this.instanceId = id();
      this.channel = null;
      this.storageHandler = null;
      this.focusHandler = null;
      this.visibilityHandler = null;
      this.pollTimer = null;
      this.seen = new Set();
      this.mailPrefix = `${MAIL_PREFIX}${code}:`;

      if ('BroadcastChannel' in root) {
        try {
          this.channel = new BroadcastChannel(`bondi-room-${code}`);
          this.channel.onmessage = e => this._receive(e.data);
        } catch (_) { this.channel = null; }
      }

      this.storageHandler = e => {
        if (!e || !e.key || !e.newValue || !e.key.startsWith(this.mailPrefix)) return;
        try { this._receive(JSON.parse(e.newValue)); } catch (_) {}
      };
      root.addEventListener('storage', this.storageHandler);
      this.focusHandler = () => this.poll();
      this.visibilityHandler = () => this.poll();
      root.addEventListener('focus', this.focusHandler);
      root.addEventListener('visibilitychange', this.visibilityHandler);
      this.pollTimer = root.setInterval ? root.setInterval(() => this.poll(), 450) : setInterval(() => this.poll(), 450);
      this.poll();
    }
    _receive(message) {
      if (!message || message.transportInstance === this.instanceId) return;
      const messageId = message.messageId || message.nonce;
      if (messageId && this.seen.has(messageId)) return;
      if (messageId) {
        this.seen.add(messageId);
        if (this.seen.size > 500) this.seen = new Set(Array.from(this.seen).slice(-250));
      }
      this.handler(message);
    }
    _writeMailbox(payload) {
      try {
        localStorage.setItem(this.mailPrefix + payload.messageId, JSON.stringify(payload));
      } catch (_) {}
    }
    _cleanupMailbox(now = Date.now()) {
      try {
        const remove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(this.mailPrefix)) continue;
          try {
            const msg = JSON.parse(localStorage.getItem(key) || 'null');
            if (!msg || !msg.sentAt || now - msg.sentAt > MAIL_TTL_MS) remove.push(key);
          } catch (_) { remove.push(key); }
        }
        remove.forEach(key => localStorage.removeItem(key));
      } catch (_) {}
    }
    poll() {
      try {
        const messages = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(this.mailPrefix)) continue;
          try {
            const msg = JSON.parse(localStorage.getItem(key) || 'null');
            if (msg) messages.push(msg);
          } catch (_) {}
        }
        messages.sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0));
        messages.forEach(msg => this._receive(msg));
        this._cleanupMailbox();
      } catch (_) {}
    }
    send(message) {
      const messageId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${this.instanceId}`;
      const payload = Object.assign({}, message, {
        transportInstance: this.instanceId,
        sentAt: Date.now(),
        nonce: messageId,
        messageId
      });
      if (this.channel) {
        try { this.channel.postMessage(payload); } catch (_) {}
      }
      this._writeMailbox(payload);
      try { localStorage.setItem(BUS_PREFIX + this.code, JSON.stringify(payload)); } catch (_) {}
    }
    close() {
      if (this.channel) this.channel.close();
      if (this.storageHandler) root.removeEventListener('storage', this.storageHandler);
      if (this.focusHandler) root.removeEventListener('focus', this.focusHandler);
      if (this.visibilityHandler) root.removeEventListener('visibilitychange', this.visibilityHandler);
      if (this.pollTimer) {
        if (root.clearInterval) root.clearInterval(this.pollTimer); else clearInterval(this.pollTimer);
      }
      this.pollTimer = null;
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
      this.syncTimer = null;
      this.sharedRevision = 0;
      this.sharedUpdatedAt = 0;
      this.pauseUntil = 0;
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
        transport: 'local-browser-active-tab-authority'
      });
    }

    _fail(message) {
      this.onError(String(message || 'Multiplayer error.'));
    }

    _openTransport(code) {
      if (this.transport) this.transport.close();
      clearInterval(this.syncTimer);
      this.transport = new RoomTransport(code, msg => this._onMessage(msg));
      this.syncTimer = setInterval(() => this._syncSharedGame(), 300);
    }

    _isActiveTab() {
      return root.document ? !root.document.hidden : this.isHost;
    }

    _adoptShared(shared, emit = true) {
      if (!shared || !shared.room || !shared.game) return false;
      const seat = Core.seatForClient(shared.room, this.clientId);
      if (!seat) return false;
      this.room = JSON.parse(JSON.stringify(shared.room));
      this.game = JSON.parse(JSON.stringify(shared.game));
      this.resolutionPause = !!shared.resolutionPause;
      this.pauseUntil = Number(shared.pauseUntil || 0);
      this.sharedRevision = Number(shared.revision || 0);
      this.sharedUpdatedAt = Number(shared.updatedAt || 0);
      this.view = Core.projectGame(this.room, this.game, this.clientId, this.resolutionPause);
      if (emit) this._emit();
      return true;
    }

    _commitSharedGame({ emit = true } = {}) {
      if (!this.room || !this.game) return false;
      const previous = sharedGameRead(this.room.code);
      const revision = Math.max(this.sharedRevision || 0, previous && previous.revision || 0) + 1;
      const payload = {
        room: this.room,
        game: this.game,
        resolutionPause: !!this.resolutionPause,
        pauseUntil: Number(this.pauseUntil || 0),
        revision,
        updatedAt: Date.now(),
        actorClientId: this.clientId
      };
      if (!sharedGameWrite(this.room.code, payload)) return false;
      this.sharedRevision = revision;
      this.sharedUpdatedAt = payload.updatedAt;
      this.view = Core.projectGame(this.room, this.game, this.clientId, this.resolutionPause);
      if (emit) this._emit();
      return true;
    }

    _syncSharedGame(force = false) {
      const code = this.room && this.room.code || this.transport && this.transport.code;
      if (!code) return false;
      const shared = sharedGameRead(code);
      if (!shared || !shared.room || !shared.game) return false;
      const revision = Number(shared.revision || 0);
      if (!force && revision <= this.sharedRevision) {
        if (this.resolutionPause && this.pauseUntil && Date.now() >= this.pauseUntil && this._isActiveTab()) {
          this.resolutionPause = false;
          this.pauseUntil = 0;
          this._commitSharedGame();
          this._broadcastViews();
          this._scheduleNext();
          return true;
        }
        return false;
      }
      if (!this._adoptShared(shared, true)) return false;
      if (this.resolutionPause && this.pauseUntil && Date.now() >= this.pauseUntil && this._isActiveTab()) {
        this.resolutionPause = false;
        this.pauseUntil = 0;
        this._commitSharedGame();
        this._broadcastViews();
        this._scheduleNext();
      }
      return true;
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
        if (!this.room) this._fail('Still waiting for the host tab. On iPhone, switch to the host tab once, then come back here.');
      }, 12000);
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
        this.pauseUntil = 0;
        this._commitSharedGame();
        this._broadcastRoom();
        this._broadcastViews();
        this._scheduleNext();
      } catch (e) { this._fail(e.message); }
    }

    playCard(cardId) {
      if (!this.room || this.room.phase !== 'game') return;
      this._syncSharedGame(true);
      if (this.resolutionPause) return this._fail('Wait for the Aiy resolution to finish.');
      this._applySharedHumanPlay(this.clientId, cardId);
    }

    _applySharedHumanPlay(clientId, cardId) {
      const code = this.room && this.room.code;
      if (!code) return;
      const shared = sharedGameRead(code);
      if (shared && shared.room && shared.game) this._adoptShared(shared, false);
      if (this.resolutionPause) return this._sendPlayError(clientId, 'Wait for the Aiy resolution to finish.');
      const before = this.game;
      const result = Core.applyHumanPlay(this.room, this.game, clientId, cardId, this.engine);
      if (!result.ok) return this._sendPlayError(clientId, result.error);
      this.game = result.state;
      this._afterPlay(before);
    }

    _sendPlayError(clientId, message) {
      if (clientId === this.clientId) this._fail(message);
      else this._sendTo(clientId, { type: 'ERROR', message });
    }

    _hostPlay(clientId, cardId) {
      this._applySharedHumanPlay(clientId, cardId);
    }

    _afterPlay(before) {
      const oldRes = before && before.lastResolution ? JSON.stringify(before.lastResolution) : '';
      const newRes = this.game && this.game.lastResolution ? JSON.stringify(this.game.lastResolution) : '';
      const resolved = !!newRes && oldRes !== newRes;
      clearTimeout(this.resolutionTimer);
      if (resolved && !this.game.roundOver) {
        this.resolutionPause = true;
        this.pauseUntil = Date.now() + this.resolutionDelay;
        this._commitSharedGame();
        this._broadcastViews();
        const expectedRevision = this.sharedRevision;
        this.resolutionTimer = setTimeout(() => {
          const latest = sharedGameRead(this.room && this.room.code);
          if (latest && Number(latest.revision || 0) !== expectedRevision) { this._syncSharedGame(true); return; }
          this.resolutionPause = false;
          this.pauseUntil = 0;
          this._commitSharedGame();
          this._broadcastViews();
          this._scheduleNext();
        }, this.resolutionDelay);
      } else {
        this.pauseUntil = 0;
        this._commitSharedGame();
        this._broadcastViews();
        this._scheduleNext();
      }
    }

    _scheduleNext() {
      clearTimeout(this.aiTimer);
      if (!this.game || this.game.roundOver || this.resolutionPause) return;
      const seat = this.game.currentPlayer;
      if (!Core.isAISeat(this.room, seat)) return;
      const expectedRevision = this.sharedRevision;
      this.aiTimer = setTimeout(() => {
        const latest = sharedGameRead(this.room && this.room.code);
        if (latest && Number(latest.revision || 0) !== expectedRevision) { this._syncSharedGame(true); return; }
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
      if (!this.room || !this.game) return;
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
              this._commitSharedGame();
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
        if (msg.room.phase === 'game') this._syncSharedGame();
        else this._emit();
      } else if (msg.type === 'GAME_VIEW') {
        this.room = msg.room || this.room;
        if (!this._syncSharedGame()) { this.view = msg.view; this._emit(); }
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
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      if (notify && this.transport && this.room) {
        if (this.isHost) {
          this.transport.send({ type: 'ROOM_CLOSED' });
          roomRegistryRemove(this.room.code);
          sharedGameRemove(this.room.code);
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
      this.pauseUntil = 0;
      this.sharedRevision = 0;
      this.sharedUpdatedAt = 0;
      if (notify) this._emit();
    }
  }

  root.BondiMultiplayer = { MultiplayerClient, normalizeCode, makeCode };
})(window);
