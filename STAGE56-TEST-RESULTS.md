# BONDI Stage 5.6 — Hard AI 4.4 Test Results

**PASS.** In a public-information-consistent constructed game, an opponent is known void in spades while a diamond is known to be in their Aiybai. Stage 4.3 selects 2♠ and triggers a certain immediate Bondi; Stage 4.4 selects K♦ to force the confirmed follow instead.

Tests verify that no unknown opponent cards influence the AI, one-card early Bondi cutoff is retained, no guaranteed danger is shifted to a closer finisher, and Easy/Medium AI decisions are unchanged. A live RoomService regression confirms its public-only explanations do not expose other Aiybai.

| 400 matching seeded games | Hard 4.3 | Hard 4.4 |
|---|---:|---:|
| Games finished | 400 | 400 |
| Illegal moves | 0 | 0 |
| Stalls | 0 | 0 |
| Average Bondis | 16.08 | 16.02 |
| Games with >=3 consecutive conveyor | 211 | 210 |

Additional compatibility: 64/64 game engine tests, 13/13 multiplayer-core, 5/5 previous AI regressions, 7/7 new decision tests, 20 complete online games, 160 multiplayer simulations, iPhone tests, and rematch/identity tests.

**Limitation:** The user-observed 3♠ sequence cannot be proven avoidable from logs alone because other players' contemporaneous hidden Aiybai are unknown. A Bondi can be strategically useful to stop one-card players. Aggregate statistics are nearly unchanged; broad improvement is not established.

**Pending:** Field verification on two real phones with Stage 5.6.
