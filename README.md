# BONDI Stage 4.0 — Strategic AI Rewrite

Stage 4 replaces the patch-by-patch Hard-AI decision flow with a unified strategic layer while preserving the confirmed BONDI rules and the mobile-first game.

## Strategic architecture

- **Public-state model:** one shared model tracks confirmed voids, publicly returned cards, recent legal follows, Bondi history, opponent card counts, and publicly inferable suit exhaustion.
- **Candidate lead evaluation:** every legal Hard-AI lead is scored against actual seat order and estimated probability that each opponent can follow before the first Bondi.
- **Whole-table scoring:** final-card danger, 1–5 card threats, repeated Bondi conveyors, self-growth, suit depletion, and safe follow routes are considered together rather than as isolated override rules.
- **Consequence threshold:** ordinary tactical play stays stable unless the strategic model sees a materially better table outcome, reducing oscillation and overfitting.
- **Contextual following:** when a later confirmed Bondi is predictable, Hard AI can deliberately stay below the current high card instead of unnecessarily becoming the likely Bondi recipient.
- **Bondi rule preserved:** when Hard AI gives Bondi, it still gives the highest-value card in the strategically chosen suit.

## Validation

- 60/60 automated regression and Stage 4 tests pass.
- 80/80 complete four-player Hard-AI simulation games finished normally.
- No illegal AI moves or stalled games in the simulation batch.

The goal of Stage 4 is to make future improvements at the model/scoring level rather than adding one special-case patch after every game log.
