# BONDI Stage 5.0.3 — Multiplayer Foundation · Hard AI Stage 4.2

Stage 5.0.3 keeps the Stage 5.0.2 same-browser multiplayer and iPhone active-tab synchronization, and upgrades Hard AI to **Stage 4.2 — Persistent Conveyor Breaker**.

## Stage 4.2 AI change
- Detects when the same opponent has Bondied into the AI at least twice in a continuing recipient/giver conveyor.
- If that opponent is confirmed void in the repeated lead suit and no opponent has a one-card emergency, Hard AI rejects materially worse repeated-feed leads when another suit reduces conveyor exposure.
- This closes the multiplayer pattern where AI 2 repeatedly led 9♥ while Ali repeatedly Bondied and shed card after card.
- A genuine one-card terminal threat still outranks the conveyor breaker, preserving Stage 4.1 terminal lookahead.
- Stage 4.1 multi-threat terminal logic, heads-up logic, the highest-card Bondi rule, and the confirmed BONDI rules remain intact.

## Multiplayer
Stage 5.0.2 behavior is retained: durable iPhone room mailbox, shared same-browser game snapshot, active-player move application while the original host tab is suspended, AI continuation, and revision-based recovery.

## Validation
- Rules/AI regression suite: **64/64 passed**.
- 500/500 complete four-player Hard-AI games.
- 1,000/1,000 targeted terminal-lookahead cases.
- 500/500 established conveyor cases.
- 500/500 new persistent-conveyor conflict cases.
- 0 illegal AI moves and 0 stalled AI games.
- Multiplayer core: **13/13 passed**.
- Standard browser multiplayer flow: **PASS**.
- iPhone suspended-host join regression: **PASS**.
- iPhone suspended-host guest play regression: **PASS**.
- Mixed multiplayer simulation: **160/160 games**, **13,124 synchronized plays**, **0 illegal moves**, **0 stalls**.

## Prototype security note
Same-browser multiplayer stores the authoritative prototype game snapshot in browser storage so another active tab can continue when iOS suspends the host. The UI hides opponents’ Aiybai, but browser storage is not a security boundary. Real internet multiplayer will move authority and hidden Aiybai to a server.
