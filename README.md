# BONDI

Mobile-first BONDI playable prototype — Stage 3.17.

## Stage 3.17 — Multi-Threat Endgame Lock

- Hard AI now evaluates the whole table when multiple opponents are within five cards.
- Repeated Bondi feeds where the same AI keeps taking cards while an opponent sheds cards are treated as an escalating conveyor risk.
- Confirmed 1–3 card escapes remain the strongest hard danger.
- Four- and five-card repeated-feed patterns are now detected earlier so the AI can avoid creating an unavoidable two-threat finish when a materially safer lead exists.
- If every available lead is dangerous, the AI keeps the least damaging routes instead of assuming a safe option exists.
- Stage 3.16 heads-up void lock remains intact.
- Mobile-first UI remains intact.
- Hosted engine assets are cache-busted with v=3.17 and Full Game Logs now include the build number.

**56/56 automated tests pass.**
