# BONDI Stage 5.1 — Online Multiplayer Foundation

**Playable website:** https://alithux.github.io/bondi/

**Current game:** BONDI Stage 5.1 UI, confirmed Stage 4.2 Hard AI and rules, Stage 5.0.3 same-browser multiplayer preserved.

Stage 5.1 adds a *separate* server-authoritative WebSocket game mode. Once a server is deployed, people on different phones can create and join the same four-seat room, play BONDI together, and fill unused seats with Hard AI. The server alone holds full Aiybai and validates each move. The static GitHub Pages website continues to work without an online server for Solo vs AI and Same-browser tabs.

### Features added

- Select **Same-browser tabs** or **Online — different phones** on the multiplayer screen.
- Enter an online server HTTPS address; the browser connects over WSS.
- Create/join rooms, Ready, host/dealer controls, AI-filled seats, turn-by-turn real-time synchronization.
- Server-private Aiybai, validated turns/Bondi/finish order, game-over results.
- Reconnect after an interrupted connection, and **Reconnect previous online room** after refreshing the same tab.
- Multiplayer logs now use the real players' names for finished seats.
- The existing Stage 5.0.3 local-browser transport and Solo vs AI are unchanged.

### How to deploy

See **[ONLINE-DEPLOY.md](ONLINE-DEPLOY.md)**. The online server is **not yet hosted**, so this milestone cannot claim that two arbitrary phones can already connect through the public GitHub Pages site. A Render or other Node server connection is the remaining deployment step.

### Verified tests

- Rules and AI: **64/64 passed**.
- Multiplayer core: **13/13 passed**.
- Online service: create/join, host permissions, private views, illegal/forged action rejection, resume, actual WebSocket handshake: **passed**.
- Online service: **20/20 full games** with three Hard AIs, **0 illegal plays, 0 stalls**.
- Browser-side WebSocket client against live local server: create/join, private hands, legal card play synchronized, network reconnect, refresh-token reclaim: **passed**.
- Existing iPhone same-browser flow: earlier Stage 5.0.3 code is preserved; original tests also remain in the downloadable source.

### Known tradeoffs

The live game server uses memory storage and needs a host that accepts WebSocket upgrades. A restart ends its active rooms. No npm dependency is required. No public server domain is configured until one is deployed.
