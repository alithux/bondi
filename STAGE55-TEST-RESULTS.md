# BONDI Stage 5.5 — Hard AI 4.3 Regression Report

**Result:** PASS on the completed, bounded test suite. The two-phone field test remains to be confirmed.

- Reproduced a Stage 4.2 seeded decision that re-led 2♦ into a three-card player confirmed void in ♦, even though public information confirmed ♣/♥ follow cards. Stage 4.3 chooses the known-follow exit instead.
- A second snapshot of the same conveyor also switches to the known-follow suit.
- An opponent with fewer cards retains protection; the AI must not simply shift the Bondi escape to them.
- A separate one-card emergency preserves the Stage 4.2 early-Bondi cutoff.
- Forced Bondis remain legal, and the AI switches to a confirmed-safe ♦ as soon as it becomes available.
- Five deterministic regression cases passed. Their complete fixtures and runnable scripts are in the downloadable release archive.
- Original engine/rules: **64/64** passed. Multiplayer core: **13/13** passed. Online server stress: **20 complete games**, zero illegal moves or stalls. Mixed local multiplayer: **160/160 games** passed.
- Seeded AI stress: **400/400** complete games, zero illegal moves or stalls. Three targeted groups (terminal, conveyor, persistent conveyor): **120/120 each** passed; zero publicly-known avoidable multi-finish decisions.

**Honest benchmark limit:** The Stage 4.2 baseline had 208/400 games exhibiting a 3+ same-recipient/giver Bondi streak, while Stage 4.3 had 211/400. Mean Bondis were 16.04 and 16.08. These aggregate figures are mixed, cannot establish global outperformance, and include forced and strategically justified Bondis. A larger 1,000-game test exceeded its runtime limit and is not counted as passing.

Both the website and Node server reconstruct exactly the same ten-part engine source, which matches the locally tested Stage 4.3 candidate.
