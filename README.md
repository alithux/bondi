# BONDI Stage 4.1 — Multi-Threat Terminal Lookahead

Stage 4.1 keeps the Stage 4 strategic AI architecture and adds terminal Aiy sequencing for multiple one-card opponents.

## What changed
- Hard AI now models how many one-card opponents can act before the first Bondi ends the Aiy.
- With multiple one-card threats, a route that can let two opponents finish is ranked below a route where an earlier Bondi cuts the Aiy short after only one escape.
- This terminal outcome ranking sits above ordinary tactical lead scoring only in genuine multi-final-card situations.
- The Stage 4 public-information model, conveyor handling, final-card containment, and contextual following remain intact.
- No hidden-hand information is used.

## Regression from the five-game review
The Game 3 endgame is now covered directly: when AI 1 faced two one-card opponents and leading Spades allowed both to finish in the same Aiy, the planner now avoids that double-finish route when an earlier Bondi can terminate the Aiy first.

## Validation
- 62/62 automated tests pass.
- 120/120 complete four-player Hard-AI simulation games completed normally.
- 0 illegal AI moves.
- 0 stalled games.
- Maximum simulation length in the validation batch: 130 plays.

## Mobile deployment
The working Stage 4.0.1 plain-source loader is retained: no Base64, gzip, DecompressionStream, or external decompression dependency. Full Game Logs identify `Build: Stage 4.1`.


## Automated AI validation harness

Stage 4.1 now has a reproducible broader-validation harness. The current validation gate ran:

- 500 complete four-player Hard-AI games
- 1,000 constructed multi-one-card terminal scenarios
- 500 constructed established-conveyor scenarios with a publicly-known safe suit
- the exact Game 3 double-finish regression plus an immediate-Bondi sequencing regression

Current result: **PASS** — 0 illegal moves, 0 stalls, 0 publicly-known avoidable multi-finish leads, 0 targeted terminal failures, and 0 targeted conveyor failures.

See `HARNESS-RESULTS.md` for the report. The downloadable validation package contains the executable harness and full JSON result set.
