# BONDI Stage 5.0.2 — Multiplayer Foundation · iPhone active-tab play fix

Stage 5.0.2 keeps the Stage 4.1 BONDI rules and Hard AI unchanged. It fixes multiplayer card play when iOS suspends the original host tab.

## What changed
- The durable mailbox from Stage 5.0.1 remains for room/join actions.
- At game start, the authoritative same-browser game snapshot is persisted in localStorage.
- The active human player's tab validates and applies its own legal move from that shared snapshot.
- The same active tab can advance following AI turns, so a sleeping host tab no longer blocks play.
- Other tabs synchronize to the newest committed revision when they wake.
- Resolution state is revisioned to avoid a stale tab overwriting a newer game state.
- Multiplayer taps are no longer blocked by a leftover Solo-mode resolution pause.
- Double-tap timing is slightly more forgiving on touch screens.

## iPhone test flow
1. Create the room in tab 1.
2. Join with the code in tab 2.
3. Switch to the host tab once so it accepts the queued join.
4. Switch back to tab 2.
5. Ready both humans, fill remaining seats with AI, and start.
6. Once the game begins, play normally from whichever tab owns the current human turn; you no longer need to wake the host for each card.

## Validation
- Stage 4.1 rules/AI: **62/62 passed**.
- Multiplayer core: **13/13 passed**.
- Standard browser room flow: **PASS**.
- iPhone suspended-host join regression: **PASS**.
- iPhone suspended-host guest card-play regression: **PASS**.
- Mixed multiplayer simulation: **160/160 games**, **13,000 synchronized plays**, **0 illegal moves**, **0 stalls**.

## Prototype security note
Stage 5.0.2 is deliberately a same-browser prototype. The full authoritative game snapshot exists in browser storage so any active tab can keep the game moving when iOS suspends another tab. The BONDI UI still projects only the player's own Aiybai, but this is not a security boundary against browser developer tools. For real internet multiplayer, authority and hidden Aiybai will move to a server.
