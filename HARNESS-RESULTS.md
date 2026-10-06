# BONDI Stage 4.1 — Automated AI Validation Report

**Verdict: PASS**

Generated from the Stage 4.1 engine with deterministic seeds. The harness does not change gameplay; it stress-tests the AI.

## Random full-game stress

- 500/500 four-player Hard-AI games completed normally.
- Illegal AI moves: 0. Stalled games: 0.
- Plays per game: average 83.88, median 82, max 158.
- Bondis per game: average 16.55, median 16, max 44.
- Last-player Aiybai: average 10.68, median 9, max 33.
- Loser distribution by seat [P1,P2,P3,P4]: [151, 122, 110, 117].
- Multi-one-card lead opportunities encountered: 218.
- Full-information avoidable multi-finish choices: 2.
- **Publicly-known** avoidable multi-finish choices: 0.
- Raw games with a 3+ consecutive same recipient/giver Bondi streak: 315; maximum streak 12 (diagnostic only; heads-up repetition can be legitimate).
- **Multi-player near-finisher conveyor** streaks of 3+: 187; maximum qualifying streak 5 (pattern count only).
- Heuristic conveyor candidates flagged for offline inspection: 838. These are **not** treated as failures because seat order and earlier Bondis can make them harmless or forced.

## Targeted multi-threat terminal stress

- Constructed public-information cases: 1000.
- Cases where Hard AI allowed more one-card finishers than an available lead: 0.
- Pass rate: 100%.

## Targeted conveyor stress

- Constructed established-conveyor cases with a publicly-known safe suit: 500.
- Hard-AI failures: 0.
- Pass rate: 100%.

## Exact regression scenarios

- PASS — Game 3 double-finish regression: chose 3♥; chosen finishers 1, best available 1.
- PASS — Immediate Bondi cuts off second one-card threat: chose 6♥; chosen finishers 1, best available 1.

## Interpretation

Stage 4.1 passed the automated safety/strategy gate used by this harness: no illegal moves, no stalls, no publicly-known avoidable multi-finish lead, no targeted terminal-lookahead or constructed conveyor failure, and both known regressions passed. Hidden-card full-information diagnostics may still identify outcomes the AI could not reasonably know from public play; those are not treated as hard failures.

## Reproduce

The downloadable validation package contains `ai-validation-harness.js`, the exact JSON result set, the Stage 4.1 source, and the regression tests.

```bash
node ai-validation-harness.js --games 500 --targeted 1000 --conveyor 500 --seed 41701
```
