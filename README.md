# BONDI Stage 5.6 — Hard AI 4.4: Adaptive Suit Memory

**Play:** https://alithux.github.io/bondi/
**Online server:** https://bondi-online.onrender.com/health

Hard AI 4.4 reduces a specific class of avoidable Bondi: if the very next active seat is publicly confirmed void in the chosen lead suit, but publicly known to have a card in another legal suit, the AI switches to that known-follow lead. This can occur at any stage of the match, not only at three cards or fewer.

The AI uses visible Bondi history, confirmed suit shortages and publicly returned cards. It does not read opponents' hidden Aiybai. It preserves one-card emergency containment and does not switch into equally urgent confirmed suit-void danger elsewhere.

**AI lead insight** appears in exported online logs when an AI lead involves confirmed suit knowledge. Solo full strategy logs contain a **SUIT MEMORY** note. The rules, Easy/Medium AI, 2-phone rooms, AI takeover, player names, reconnect and same-room Play Again are unchanged.

## Validation

- Engine regression: 64/64.
- Multiplayer-core regression: 13/13.
- Prior Stage 5.5 targeted AI tests: 5/5.
- New Stage 5.6 targeted AI tests: 7/7.
- Online full-match tests: 20 successful complete games.
- Mixed multiplayer tests: 160/160 games complete.
- Existing iPhone suspended-tab, reconnection, identity and rematch tests passed.
- 400 same-seed Hard AI 4.3 vs 4.4 games each: zero stalls or illegal moves.

Average Bondis were 16.08 (4.3) versus 16.02 (4.4); matches with 3+ consecutive Bondi conveyor streaks were 211 versus 210. **These aggregate differences are too small to establish general superiority.** The concrete verified-follow correction is the tested improvement.

See STAGE56-TEST-RESULTS.md. The complete source archive includes the A/B harness and tests.

## Deployment

The website on GitHub Pages and the Node.js WebSocket service on Render reconstruct the same 10 engine chunks. The free Render service can sleep; new deployments end active in-memory rooms. Use a new room when testing a newly deployed version.


## Stage 5.6.1 — Easier multiplayer lobby (UI only)

Multiplayer setup now separates **Create a room** from **Join a room**, while optional same-browser/server settings are in an expandable section. The lobby shows a prominent room code, **Copy room code** and **Share invite link**, seat/readiness progress, and a simple **I'm ready to play** action. Guests do not see host-only controls; host can still fill AI seats, choose the dealer, and start a match once everyone is ready. Shared links with `?room=ABC123` open the Join screen with the room code prefilled. **Hard AI 4.4 and the online server are unchanged.**

Verification: `node multiplayer-lobby-refresh.test.js` plus existing game, multiplayer, iPhone, rematch and WebSocket regressions. See [lobby test results](LOBBY-REFRESH-TEST-RESULTS.md).

## Stage 5.6.2 — Hard AI 4.5: Less predictable post-Bondi leads

When a Hard AI receives an interrupted Aiy back into its Aiybai, it leads the next Aiy. Hard AI 4.5 considers lower-ranked leads with comparable public-information risk, instead of routinely choosing a high card just because it has a favorable suit. A low card is **not** forced when it would create a known immediate Bondi or expose a near-finishing player. One-card containment still overrides this preference.

This affects Hard AI **only after it receives Bondi**. When giving Bondi, the established rule to discard the highest card of the chosen suit remains intact. No other rules, human turns or multiplayer transport were changed.

The browser and server both load ten synchronized source chunks. The frontend URL cache version is now 5.6.2. The focused regression test is `node post-bondi-lead.test.js`, alongside `node stage56.test.js`. The existing published Stage 5.6.1 results are historical; they do not establish that this new model wins more games.
