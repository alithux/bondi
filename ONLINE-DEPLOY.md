# BONDI Stage 5.1.1 — Online Multiplayer Deployment

The GitHub Pages website is static and cannot itself host online multiplayer. The new server is a standalone Node.js WebSocket service using the exact same BONDI Stage 4.2 engine chunks as the website. No database, API keys, or npm packages are required for this initial live-room milestone.

## Live deployment

**Render service:** https://bondi-online.onrender.com

**WebSocket:** wss://bondi-online.onrender.com/ws

**Website:** https://alithux.github.io/bondi/

**Plan/region:** Free / Singapore. Render reports the service live. The website's `online-config.js` points to this server, and Online is the default room connection. The first connection can take roughly a minute after inactivity.

## Recreating the hosted deployment (Render)

1. Connect the **Render** service to the GitHub repository `alithux/bondi` or use the Render integration in ChatGPT to provision a web service.
2. Configure a **Web Service** from the GitHub repository, branch `main`:
   - Runtime: **Node.js** (Node 22 or newer)
   - Build command: `echo "BONDI server uses built-in Node.js modules"`
   - Start command: `node online-server/server.js`
   - Health check: `/health`
   - `BONDI_ALLOWED_ORIGINS`: `https://alithux.github.io`
   - `PORT`: leave managed by the hosting provider (the server reads it automatically)
3. Wait for `/health` on the provider's **HTTPS** domain to report `{ "ok": true, ... }`.
4. On https://alithux.github.io/bondi/ choose **Multiplayer** → **Online — different phones**.
5. The website already fills the server address. Create a room; on another phone open the same website and enter its room code.
6. The checked-in `online-config.js` already points to this Render service. Only edit it when migrating to another host.

The included `render.yaml` can also be used to create the service as a Render Blueprint. Service names and hosting plans can depend on account availability and may incur charges; verify these before accepting deployment.

## Development locally

```bash
node online-server/server.js
node online-server/room-service.test.js
node online-client.test.js
```

Server environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | HTTP/WebSocket port, default 8080 |
| `BONDI_ALLOWED_ORIGINS` | Comma-separated allowed browser origins. Default includes the BONDI GitHub Pages site and local port 8080. |

Server endpoints: `GET /health`, `WebSocket /ws`.

## What is supported

- Create/join four-player rooms from different phones or browsers
- Set names, Ready, dealer, host controls, and AI-filled seats
- Private Aiybai projections: other players' cards never leave the server
- Server-side BONDI rules, Hard AI, Bondi resolutions, player finishing, game outcome
- WebSocket reconnect with per-session secret (60-second server grace window)
- Game-log finish lines using actual player names
- Local-browser and Solo modes unchanged and still available

## Current limitations

- Server process memory holds active games, so **a server restart or free-tier spin-down ends rooms**.
- Players do not have accounts; room codes are invitations, not persistent identities.
- A disconnected player has **60 seconds** to reclaim their seat before the server replaces them with AI in an active game.
- No matchmaking, spectator mode, payments, rankings, database, or multi-instance clustering.
- Do not scale this prototype across multiple server instances without shared session/game state and an atomic action mechanism.
- The live service is deployed, but its free plan spins down after 15 minutes of inactivity and can take around one minute to wake. The client retries connections.

The browser stores only the player's opaque session token in that tab's `sessionStorage`; it does not store or obtain other players' hidden cards. The server applies all legal-move checks and never accepts a client-provided game state.
