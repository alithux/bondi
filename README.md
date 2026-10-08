# BONDI Stage 5.5 — Hard AI 4.3: Adaptive Bondi Defense

**Play BONDI:** https://alithux.github.io/bondi/  
**Online server:** https://bondi-online.onrender.com/health

## New in Stage 5.5

The BONDI 52-card rules, Aiy, Aiybai, Bondi outcomes, same-room Play Again, online two-phone multiplayer, and player identity features remain unchanged.

Hard AI Stage 4.3 adds a conservative defense against **avoidable repeated Bondi pickups**. When an opponent has three or fewer cards and has already shed a Bondi into the AI's Aiybai, the AI checks publicly returned cards for a suit the opponent can definitely follow. It switches from a confirmed-void lead to that safer suit only if doing so will not expose another equally-or-more urgent opponent to a confirmed Bondi. It still permits forced Bondis, and it preserves early-Bondi containment of one-card players.

This only uses the AI's own cards, publicly observed cards, and opponent card counts. **It does not inspect hidden Aiybai**. Easy and Medium AI and all gameplay rules are unchanged.

## Testing and caveats

The downloadable Stage 5.5 source package includes the complete deterministic regression fixtures and tests (`stage55.test.js`, `stage55-regression-fixtures.json`, `game-engine.test.js`) and the validation harness. The readable `game-engine-source.js` is also checked into this repository alongside the ten browser engine chunks.

- 64/64 existing rule/AI tests passed; all five new regression cases passed.
- 13/13 multiplayer-core tests, 20/20 online test games, and 160/160 mixed multiplayer simulations passed.
- The AI harness finished 400/400 seeded games with no illegal moves or stalls, plus 120/120 in each targeted stress category.
- **Aggregate conveyor statistics are mixed**, so these results show a reproducible decision correction, not proof of stronger overall play. See `STAGE55-TEST-RESULTS.md`.

The Render free-tier server sleeps when idle; server restarts erase live in-memory rooms.
