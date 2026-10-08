# BONDI Stage 5.3 — Play Again Validation

**Verdict: PASS** (automated tests; real two-phone rematch confirmation pending).

Stage 5.3 adds a server-authoritative, host-initiated replay path that returns all players to the same lobby without issuing new room codes. The old completed Aiybai is discarded, a fresh full 52-card deal is created for the next match, and human players must mark Ready again.

## Existing regressions

- BONDI Stage 4.2 engine: **64/64 passed**, with no engine changes.
- Multiplayer core: **13/13 passed**.
- Online server regression including new rematch case: **PASS**.
- 20/20 complete online Hard-AI games: **PASS**, 0 illegal plays or stalls.
- Online client using two genuine WebSocket connections: **PASS**, including replay and private Aiybai views.
- iPhone same-browser join/play with a suspended host tab: **PASS**.
- Stage 5.2 connection/turn/name UI regressions: **PASS**.
- Mixed multiplayer simulation: **160/160 games**, 13,124 plays.
- Stage 5.3 host/guest replay interface: **PASS**.
- Full game-to-game rematch stress in release ZIP: two completed games in one room, then third lobby: **PASS**.

## Rematch-specific safety

- Rematch is rejected before the current game is finished.
- Rematch requests from non-host players are rejected.
- Same room code, names, identities, AI seats, and reconnection tokens are retained.
- Human Ready flags reset, AI Ready flags stay true; starting before all humans are ready is blocked.
- Old game projections are not sent to players after the room returns to lobby.
- The next game receives new cards and keeps opponents' hidden Aiybai private.
- Dealer selection is available before starting again.
- If the host leaves mid-game, a remaining human can inherit host privileges and request the next match.

**Limitation:** persistent same-room Play Again currently applies to Online mode only. The separate same-browser transport remains unchanged. The free Render server does not persist rooms across restarts or sleep.

The complete automated test output and additional rematch tests are included in the downloadable Stage 5.3 ZIP.
