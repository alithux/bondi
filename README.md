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


## Stage 5.7 — Multiplayer AI difficulty

The room host can choose **Easy**, **Medium**, or **Hard** AI in the multiplayer lobby before the match starts. Hard is the default for existing behavior. The selection is shared with guests, applies to **all AI seats** (including seats taken over after a player leaves), and remains set for a same-room rematch. Only the host can change the setting, and the server rejects invalid levels and in-game changes. Local-browser rooms follow the same rule. The exported multiplayer game log records the chosen level. BONDI rules and solo difficulty settings have not changed.

Validation: `node multiplayer-ai-difficulty.test.js`, `node multiplayer-lobby-refresh.test.js`, `node online-server/room-service.test.js` plus existing AI regressions. GitHub Actions on PR #3 passed after correcting the dealer fixture. Deploy the browser and online server together; live Render deployment restarts in-memory rooms.


## Stage 5.8 — Multiplayer results and match statistics

When a multiplayer match ends, players see a dedicated **Match Complete** screen:
- Finishing order uses the game's actual `finishedOrder`. First to finish appears first; the player still holding cards appears last. No alternative scoring or changes to BONDI rules are introduced.
- Total **Bondi** events and completed **Aiy (އަތް)**, plus Bondi *given* and *received* for each seat. These counters update on the authoritative resolved Aiy state, including repeated identical Bondi sequences. They do not inspect unrevealed Aiybai.
- A **same-room series** (last 20 matches) shows how often an AI player finished first at each Easy/Medium/Hard difficulty. This is descriptive, **not a win-rate comparison**, and resets when the online room is closed or the server restarts.
- The host's **Play Again — same room** button remains directly below the results panel; guests see the same results and wait for the host. When the host initiates a rematch, the same room and match history are kept while humans tap Ready again.
- Download-free **Copy Game Log** now includes the match's finishing order and Bondi counts.

The same read-only results panel works in same-browser/local multiplayer. Play Again in the same room remains an online-room feature. The current 4-player game rules, difficulty settings, reconnects and AI decisions are unchanged.

Validation: `node match-results.test.js` covers real Bondi resolution counters, duplicate sequence detection, projected privacy, finishing order, match archive idempotence and a complete online game/rematch. `node match-results-ui.test.js` covers the end-screen and rematch button state. The existing regression suite is unchanged. Browser scripts are cache-busted to version 5.8.0.


## Stage 5.8.1 — Simple statistics for the current multiplayer room

After each completed online or local-browser multiplayer match, BONDI shows **that match's finishing order** followed by one compact **This room · all matches** scoreboard. Each of the four seats shows first-place finishes, last-place finishes, Bondi given and Bondi received, accumulated over rematches in **that same room only**.

- Room totals are accumulated once on the authoritative room state as each match ends; repeated snapshots/reconnects do not count a match twice.
- Totals survive **Play Again — same room**, regardless of how often you rematch. They are not limited to the most recent 20 entries in the internal match-history list.
- Totals are **by seat**. If an AI takes over a departing player's seat, the numbers for that seat remain, under its current displayed name.
- A different room always starts from zero. Statistics are not saved as a global player profile and are lost when the room is closed or the online server restarts.
- The Copy Game Log includes the current room's cumulative figures.
- The game rules, BONDI resolutions, AI strategies and all individual match results are unchanged.

Regression tests `match-results.test.js` and `match-results-ui.test.js` check two-match accumulation, archive idempotence, the 20-match history boundary, new-room reset, display and host-controlled rematch. Browser assets use cache version 5.8.1.


## Stage 5.9 — Mobile multiplayer improvements

The web app now has larger touch-friendly Aiybai cards on phones (68×94 pixels), clearer selected-card highlighting, and accessible spoken suit names and selected-state labels. The Play button names the selected card, while a turn-status notice beside the Aiybai shows when it is your turn, another player's turn, when the އަތް is resolving, or when an online connection is unavailable. Existing server-side turn validation and BONDI rules remain unchanged.

Online-room lobbies show a selectable invite URL below the share buttons. If the embedded browser does not allow copying or sharing, the app selects the invitation link so it can be copied manually. Same-browser testing rooms do not display an online invite. Match standings and cumulative **current-room-only** statistics have larger mobile text. All buttons and form controls get a visible keyboard focus indicator.

These are website/UI-only changes; no modification to the server, AI engine, dealing or four-player multiplayer defaults. Automated mobile UI checks in `mobile-ux.test.js` cover invite sharing fallbacks, selectable cards, turn state, Aiy pause and reconnection. The mobile asset version is 5.9.0. Field testing on iOS/Android is still recommended.
