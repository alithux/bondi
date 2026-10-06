# BONDI Stage 4.0.1 — Strategic AI Rewrite

Stage 4.0.1 keeps the Stage 4 strategic Hard-AI rewrite and replaces the fragile compressed mobile loader with a plain JavaScript loader.

## Strategic AI
- Unified public-state model for confirmed voids, returned cards, recent follows, Bondi history, card counts, and seat order.
- Candidate lead evaluation across the whole table.
- Whole-table endgame scoring for final-card danger, 1–5 card threats, repeated Bondi conveyors, and follow/Bondi probability.
- Contextual following can duck below the current high when a later confirmed Bondi is predictable.
- Confirmed Bondi card rule remains: highest card in the strategically chosen Bondi suit.

## Mobile deployment
- No runtime Base64 decoding.
- No gzip or DecompressionStream requirement.
- No external decompression CDN.
- Ten small plain JavaScript source chunks are joined by a tiny local initializer.
- Dealer choices are present in HTML before engine startup.
- Full Game Logs identify `Build: Stage 4.0.1`.

## Validation
- 60/60 automated tests pass.
- 80/80 complete four-player Hard-AI simulation games completed normally.
- The plain-source mobile loader was separately tested to initialize a 52-card BONDI engine correctly.
