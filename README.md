# BONDI Stage 5.2 — Online Multiplayer Experience & Reliability

**Playable website:** https://alithux.github.io/bondi/
**Online server:** https://bondi-online.onrender.com/health
**Engine:** Stage 4.2 Hard AI (unchanged).

Stage 5.2 builds on the first successful two-phone BONDI match in Stage 5.1.1. Two real phones can connect to the same four-seat room through a server-authoritative WebSocket service on Render (Singapore). Same-browser rooms and Solo remain available.

## What's new

- **Unambiguous player identities:** online rooms reject a second player's name if it duplicates an existing occupied seat (case insensitive, normalized whitespace); a player can choose another name and retry. Lobby, Aiy cards, player seats and exported log clearly show seat numbers.
- **Your turn:** a high-visibility YOUR TURN banner appears on the active seat, and the tab title changes to "Your turn · BONDI" while it's your turn. It is visual only; no device notification permission is required.
- **Connection health:** both lobby and game show connected/reconnecting/disconnected status. During reconnection the game disables submitting cards rather than pretending the move was sent.
- **Server-controlled grace countdown:** when a person disconnects, other players see a countdown for that seat, from the server's existing 60-second grace period. Returning in time reclaims the same seat; when the deadline expires in an ongoing game, AI takes over.
- **Reconnect now:** manual reconnect in addition to the existing automatic retry and same-tab refresh recovery.
- **Name display safety:** user-defined names are HTML-escaped when inserted into the lobby/board.

## How to play online

Open https://alithux.github.io/bondi/ on two phones. Choose **Multiplayer** and **Online — different phones** (selected by default). Enter distinct player names. One phone creates a room, the other enters the six-character room code. Mark both ready, fill remaining seats with AI, and start.

When a person disconnects, their seat is reserved for up to 60 seconds in the current server process. The browser retries automatically; **Reconnect now** can be used if needed. To rejoin after a page refresh, choose **Reconnect previous online room** in the same browser tab.

## Tests

- Game engine/rules: **64/64 passed**, unchanged Stage 4.2 AI.
- Multiplayer core: **13/13 passed**.
- New online tests: duplicate identity rejection, countdown on disconnect, resume without losing seat, AI replacement on timeout, manual retry: **PASS**.
- Actual local WebSocket handshake and two-client game: **PASS**.
- **20/20 online Hard-AI games**, zero illegal moves/stalls.
- Browser interface VM regression: turn notification, name escaping, countdown, reconnection UI and input blocking: **PASS**.
- Existing same-browser/iPhone join/iPhone play regressions: **PASS**.
- Existing mixed multiplayer stress: **160/160 games** and **13,124 plays**.

Full output: `STAGE52-TEST-OUTPUT.txt`; details: `ONLINE-TEST-RESULTS.md`.

## Known limitations

- Render free service may spin down after inactivity, causing a slow first connection and losing any rooms still in memory. It has no persistent game database.
- Reconnection is limited to the same room and a currently valid server-issued token; after a timeout or server restart, players must create or join a new room.
- The current game has no matchmaking, account login, push notifications, spectator system, or spectator security policy.
- Do not run multiple server replicas without shared atomic game/session state.

The server remains authoritative for moves and hidden Aiybai; no change was made to the BONDI engine, cards or Hard AI.
