# BONDI

Mobile-first BONDI playable prototype — Stage 3.16.

## Stage 3.16 — Heads-Up Void Lock + Conveyor Prevention

- Hard AI removes confirmed-void heads-up lead suits whenever any plausible follow suit exists.
- The hard lock runs before general endgame/follow-chain scoring, so another objective cannot revive a guaranteed Bondi conveyor.
- If an AI gives the **2** of a suit as its highest Bondi discard, opponents can infer that AI has exhausted that suit.
- The extra inference is not applied to the human player, because the current human UI still allows any legal off-suit card.
- If every available lead suit is confirmed void for the opponent, the AI recognizes the Bondi as unavoidable and uses damage-control scoring.
- Stage 3.8–3.15 multiplayer behavior is retained.
- Mobile-first UI remains unchanged.

**54/54 automated tests pass.**
