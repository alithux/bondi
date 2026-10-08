# BONDI Stage 5.3 — Online Play Again & Same-Room Rematches

**Website:** https://alithux.github.io/bondi/
**Online server:** https://bondi-online.onrender.com/health

Stage 5.3 fixes the missing replay option seen after the fully completed Ayya/Fathun/AI multiplayer match. The online host can tap **Play Again — same room** after a match completes. All connected people keep their seat/name and all AI seats remain. Every human marks **Ready** again, then the host selects **Start next game**. New 52-card hands are generated server-side. The dealer is retained for the host to change in the rematch lobby if desired. The same six-character room code and reconnect tokens remain valid.

This release also promotes another seated human to host if the current host leaves during a game, so rematches are not permanently blocked. Only the new host can offer a rematch; requests during active games or from nonhosts are rejected. No active room is restarted automatically.

The verified Stage 4.2 Hard AI, BONDI rules, original local-browser transport, and Solo mode are unchanged. Local same-browser rooms still use their existing per-game flow; Play Again is for the hosted online mode.

## Online mode notes

- All human players must tap Ready for each additional game.
- Rooms stay in server memory; a Render restart or free-tier sleep still ends active rooms.
- A disconnected human retains their reserved seat for 60 seconds, even during the rematch lobby; after that timeout the seat may become empty and must be filled or rejoined.
- An online player who explicitly leaves a game is replaced by AI; a new host is elected if necessary.

## Validation

See `STAGE53-TEST-RESULTS.md` and run the included Node tests. Also inspect one real-world two-phone rematch before treating the feature as field-confirmed.

## Current release

Stage 5.3 includes **Play Again** for completed online matches. The online host can return the same room to the lobby; all human players must mark Ready again before fresh hands are dealt. Server and GitHub Pages deployments must both complete before using this feature on different phones.
