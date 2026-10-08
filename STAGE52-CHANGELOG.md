# Stage 5.2 — What changed

Production code changed:
- `online-server/room-service.js`: case-insensitive unique names; server-origin reconnect deadlines, cleared on reconnect and AI replacement; finish log seat labels.
- `online-client.js`: distinguish connected socket from a successfully resumed room, add manual retry, report terminal reconnect failure, preserve reconnect token for temporary drops.
- `index.html`: name/seat tags, prominent turn banner, online connection status, countdown, manual retry controls, sanitization of player names and improved exported seat roster.
- `online-config.js`: live Render URL remains preconfigured.

Tests added/extended:
- `online-server/room-service.test.js`
- `online-client.test.js`
- `multiplayer-stage52-ui.test.js`

Unchanged:
- Stage 4.2 BONDI engine, Bondi event/turn/finish rules.
- Same-browser multiplayer transport and gameplay.
- Server-authoritative private Aiybai and move validation.

Hosting: GitHub Pages frontend and Singapore Render free Node service. A code push automatically deploys the Render service and temporarily ends in-memory rooms.
