# BONDI Stage 5.0 — Multiplayer Foundation

Stage 5.0 moves BONDI beyond the solo prototype while keeping the validated Stage 4.1 Hard AI unchanged.

## Play modes

- **Solo vs AI** — the existing 2-player or 4-player game remains available.
- **Multiplayer** — create a 4-seat room, join with a 6-character room code, mix human players with AI seats, ready up, choose the dealer, and start from a shared lobby.

## Multiplayer architecture

The room host is authoritative. Other players send play requests; only the host applies those requests through the BONDI rules engine and then distributes projected game state. This keeps Aiy, Aiybai, Bondi resolution, turn order, and finish/re-entry rules synchronized.

Each human client receives its own Aiybai. Opponents expose card counts but not hidden cards.

If a non-host human leaves during an active game, the host converts that seat to AI so the game can continue rather than stall.

## Stage 5.0 transport scope

Stage 5.0 deliberately uses browser-local transport: BroadcastChannel with a localStorage fallback. That means the complete multiplayer room/lobby/game flow can be tested across separate tabs or windows in the **same browser profile**.

This is not yet different-device internet multiplayer. The room protocol and host-authoritative game layer are transport-agnostic so the next stage can replace the local transport with a cloud/WebSocket service without rewriting BONDI rules.

## Validation

- Stage 4.1 rules/AI suite: **62/62 passed**
- Multiplayer core suite: **13/13 passed**
- End-to-end browser controller flow passed
- Mixed human/AI multiplayer stress: **160/160 complete games**
- **13,000 synchronized plays**
- **0 illegal moves**
- **0 stalls**
- Maximum stress-game length: **140 plays**

See `MULTIPLAYER-TEST-RESULTS.md` for the Stage 5 validation summary.

## Testing the multiplayer foundation

1. Open BONDI in one browser tab/window.
2. Choose **Multiplayer**, enter a name, and create a room.
3. Open BONDI in a second tab/window in the same browser profile.
4. Choose **Multiplayer**, enter another name and the host's room code, then join.
5. On the host tab, fill remaining empty seats with AI.
6. Mark both human players Ready.
7. Host starts the game.

Live build: https://alithux.github.io/bondi/
