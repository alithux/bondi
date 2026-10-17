# BONDI Stage 5.15C.1 — Animated card plays · Hard AI 4.5

## Current release

New Bondi resolutions briefly nudge the table (420 ms) and highlight its edge. Reduce Motion uses only the static highlight. Normal Aiy, repeated snapshots and restored matches do not trigger the effect; game timing and rules are unchanged.

**Aiybai requests are manual:** use Game menu → Request Aiybai when you choose to ask the next active player. Simply becoming eligible after an Aiy no longer opens a panel over your cards. Opening the option asks for confirmation; Cancel returns to normal play without sending a request. Incoming requests still show Agree/Decline. Existing server eligibility and consent rules remain unchanged.


BONDI supports solo play and online multiplayer, a modern mobile table, Straight/Arc Aiybai selection, shuffle/deal animations, and public card flights into the Aiy. The opening dealing phase hides cards and blocks both human and AI plays until dealing completes. Solo strategy logs use the same build label as the visible page header.

- Installable PWA with offline solo play after the public app shell has been cached. Solo progress is not retained after closing/reloading.
- Online rooms include AI difficulty, consent-based Aiybai requests, match results, room statistics, and a two-minute reconnect reservation.
- PostgreSQL room recovery is implemented but requires deployment configuration. Check `/health` for `persistence: postgres_ready` before relying on restart recovery.
- The recorded test-database expiry is **13 November 2026**; verify the current plan and arrange continued storage before then.
- Gameplay regression checks run on pull requests and pushes to `main` (as well as the existing AI branch).

The sections below are release history. Older version numbers, deployment limitations and validation figures describe those releases, not the current deployment. Real-device behavior and Render deployment/database state require separate live verification.

## Stage 5.6 — Hard AI 4.4: Adaptive Suit Memory (historical)

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


## Stage 5.10.4 — Review each completed Aiy for 1 second

BONDI now supports a **manual Request Aiybai** action in multiplayer, based on the confirmed real-life rule:

- Only the **active human player who is about to lead the next Aiy** can request Aiybai. They can wait as long as they need before playing their first card (not mid-Aiy or before the first completed Aiy).
- The request always targets the **immediate next active player in playing order**. Players who are already finished are skipped; no other active players can be skipped.
- The next player may **Agree** or **Decline**. There is **no transfer before acceptance**. If accepted, all remaining cards move to the requester and the giver immediately finishes. If declined, play continues unchanged.
- Only one request is possible before that leader starts the next Aiy, preventing repeated dialogs. Human recipients have **30 seconds** to answer; unanswered offers expire safely with **no transfer**. The leader can then play immediately.
- In games with AI seats, humans can request from the next active AI; the AI agrees to finish after a short response delay. **AI does not initiate unsolicited requests.** This ensures no Aiybai collection starts automatically.
- **One-second review of every completed Aiy**, including two-player endgames, in solo, same-browser, and online multiplayer. Both players' cards stay visible for the full second even if an AI will lead next. Human players can act after the review; an AI leader plays immediately when it ends, avoiding a second one-second wait. Requests remain available to the next human leader during the 1-second transition and afterwards, until they play their first card. An Aiybai request still waits for accept/decline or 30-second expiry, and resumes immediately once answered.
- Card identities remain hidden from other players in public snapshots and logs; the transfer keeps all 52 cards in play and updates game completion/finishing order without counting it as a Bondi event.
- The request UI is in the multiplayer gameplay area only (not the solo-vs-AI mode). The game stays at four players by default.

The online server authorizes requests and acceptance based on the authenticated seat, not client-provided seat numbers. In same-browser test rooms, state is synchronized through the existing shared-game channel. The Stage 5.10.4 version label and cache key are updated. Regression tests in `aiybai-consent.test.js` cover transfers, refusal, authority, hidden cards, finished-seat skipping and results.


## Stage 5.11 — Reliable online reconnection

- A temporarily disconnected online human player has a **two-minute seat reservation** before the server assigns AI takeover. During this time, the seat, ongoing match and their private Aiybai are retained on the server.
- Online play automatically retries an interrupted WebSocket connection and resynchronizes the player's authoritative room, hand and turn. A socket stuck without completing its handshake is closed and retried instead of hanging indefinitely.
- Refreshing the same browser tab automatically tries to restore the saved authenticated session from **tab-scoped sessionStorage**; it does not create a duplicate player. On a second connected tab presenting the same session, the original connection is explicitly stopped and cannot continuously reclaim the seat.
- Reconnecting uses an unpredictable 256-bit session token, and opponents never receive a player's hidden Aiybai. Invalid or expired sessions cannot reclaim an AI-taken-over seat. After the reservation expires, takeover remains irreversible for that match.
- Session restoration only works while the online server still retains the room and original token. It does **not** preserve a room across server restarts or across different devices, and quitting a tab can discard its tab-scoped session key.
- Automated server/client regression tests verify disconnect, reconnection, hidden cards, duplicate-tab replacement, stalled connections and expired-seat takeover. No BONDI gameplay rules or timing have changed.


## Stage 5.12 — Recover online rooms after a server restart (requires database activation)

BONDI can now store each server-authoritative online room, private game Aiybai, current Aiy, match history, room statistics and authenticated reconnect-session tokens in PostgreSQL. On startup, it reloads the stored rooms *before* accepting new connections. Human seats are marked temporarily disconnected and get the normal two-minute opportunity to reconnect to their original seat. Pending Aiybai requests are safely declined after a restart; no player is forced to transfer cards. Next AI plays are scheduled again; the rules, one-second card review and game UI are unchanged.

**Configuration:** The deployed web service deliberately stays in the existing in-memory mode until the owner connects a database. To activate without exposing credentials in GitHub:

1. In the Render **bondi-online** web service, set Build Command to `npm install --prefix online-server` (the old `echo` build command does not install Node dependencies).
2. In the Render **bondi-rooms-persistence** PostgreSQL database dashboard, copy its **Internal Database URL**.
3. In **bondi-online → Environment**, add the secret environment variable `DATABASE_URL` using that Internal Database URL. Do **not** paste it into GitHub source, logs, or chat.
4. Redeploy and verify `https://bondi-online.onrender.com/health` reports `"persistence":"postgres_ready"` and the server logs report recovered room counts. Create a new test room, restart the web service, then reconnect from the same browser tab to verify it survives.

If `DATABASE_URL` is unset, the health endpoint reports `"persistence":"not_configured"` and BONDI continues using volatile in-memory rooms. If PostgreSQL is configured but unavailable at startup, the server refuses to start rather than pretending stored rooms have been recovered. Later write failures are exposed as `"persistence":"degraded"` and require attention.

**Free-plan limitations:** Render's Free PostgreSQL database expires **30 days after creation** (this first test database is scheduled to expire **13 November 2026**); Free PostgreSQL has no managed backups. Real long-term persistence requires replacing or upgrading the datastore before expiry. The persistence guarantee covers normal graceful service restarts/redeployments once it has been activated; unexpected crashes may lose updates not yet committed to PostgreSQL. Multiple independently active servers are not supported by the current single-server room authority.

Validation: `node online-server/persistence.test.js` simulates a new server process, restoring both players' private Aiybai and tokens without duplicating seats. PostgreSQL is optional for other standalone tests and same-browser multiplayer.


## Stage 5.13 — Installable BONDI and offline Solo vs AI

BONDI is now an installable Progressive Web App (PWA) with 192px and 512px app icons and an iPhone home-screen icon. A small service worker saves the public app shell, the ten engine source chunks, and supporting scripts locally. Once the site has been loaded online and its app shell cached, **Solo vs AI remains available without an internet connection**. BONDI rules, AI difficulty, އަތް pacing, Aiybai transfers and backend logic are unchanged.

**Install:** Open [BONDI](https://alithux.github.io/bondi/) on an internet-connected device. On iOS Safari choose **Share → Add to Home Screen**; on Android Chrome choose **Install app** or **Add to Home screen** in the browser menu. On desktop, use the browser's install option when shown. BONDI includes inline setup instructions and an optional Install button in browsers that support the prompt.

**Offline boundaries:** Multiplayer with other devices **requires internet**; the service worker does not intercept WebSockets, Render server requests, private room sessions, player cards, or database records. It caches only the shipped public files from GitHub Pages. An internet connection is needed again for online multiplayer, to fetch future updates, or to install on a new device. Offline solo match progress is **not persisted after closing/reloading**; a newly launched solo game starts from a fresh shuffle.

**Updates:** Service worker cache version `bondi-static-v5.13` and script query `?v=5.13` match. On a future release, change both to install an updated app shell; normal navigation prefers network but works offline with cached HTML when the network fails. No native App Store binary is created by this stage.

Validation: `node pwa-offline.test.js` verifies the three PNG app icons decode, manifest sizes, precached script completeness, old-cache cleanup, offline navigation/script recovery and refusal to cache private multiplayer requests. Existing gameplay, UI, reconnect and persistence tests remain in CI.


## Stage 5.14 — A real BONDI card-table view

BONDI now displays the current **އަތް (Aiy)** over a green felt table with a subtle wooden rim. Players are arranged around the table relative to the local viewer: your seat appears at the bottom; for four-player games the others appear at left, top and right; for two-player solo games the opponent is at the top. Their name, seat number, Aiybai card count, dealer status, AI/human status and current-turn indicator remain visible. Human players' hidden cards are **never rendered**.

The center board gives each player a place for their publicly played card and leaves an empty placeholder until they have played. Played cards have proper-looking ranks, corner indices and suit pips, with an emphasis for Bondi. The viewer's selectable Aiybai cards have a matching face design while preserving the existing swipe/scroll affordance, spoken card labels, tap selection, double-tap play and accessibility/disabled states.

The Aiy display still holds completed cards for one second, and the next active player remains highlighted. This is a **UI-only stage**: no changes to rules, AI evaluation, timeouts, WebSocket protocols, the server or the PostgreSQL database. Screens adapt to phone and desktop widths and respect reduced-motion settings.

Tests in `match-results-ui.test.js` verify rotating player positions, safe player-name display, no hidden-card exposure, two-player layout and the visibility of cards during the one-second Aiy review. The rest of the gameplay, online and PWA regression tests are unchanged, with the offline static cache updated to `bondi-static-v5.14` alongside script cache-busting.


## Stage 5.14.1 — Hide Solo vs AI setup after dealing

The large **Solo vs AI** configuration panel (Players, Dealer, AI difficulty and Shuffle & deal) is now visible **only before starting a solo match**, or when explicitly selecting **New game**. Once a match is dealt, it disappears and the card table moves directly below a compact navigation bar showing player count, chosen difficulty, **New game** and **Home**.

**New game** opens the configuration screen without automatically losing the ongoing match. **Resume game** closes it and returns to the exact same cards. **Shuffle & deal** starts a fresh match with the currently selected settings and hides the configuration again. The AI difficulty of the current match is frozen until a new deal, so changing a setting and then resuming does not silently change that match's AI. Revisiting Solo from Home restores the ongoing match.

Online multiplayer, game rules, Aiy timing, card table layout, server and PostgreSQL are unchanged. The offline app-shell cache and versioned script URLs are updated to `5.14.1`. Test: `node solo-setup-visibility.test.js` plus the existing regression suite.


## Stage 5.14.2 — Optional Straight / Arc Aiybai

Beside **Your Aiybai**, a compact **Hand shape** dropdown lets each viewer switch between **Straight** and **Arc** card arrangements at any time (solo or online multiplayer). Straight remains the default on a new device. The optional arc gently rotates the left and right cards to form a curved fan, keeps a slightly raised center, and lifts selected cards above the fan. Horizontal hand scrolling remains available for long Aiybai, including 26-card two-player games.

This is a visual-only, viewer-side setting stored under `bondi:hand-layout` in browser `localStorage`. Switching shape doesn't deal cards, alter turn order, show opponent cards, or change card selection or double-tap play. It remains usable if localStorage is blocked and no personal hand data is saved. Each device/browser chooses its own shape independently.

The PWA app-shell cache and asset versions are bumped to `5.14.2`. Test with `node aiybai-layout.test.js` and the existing CI suite.


## Stage 5.14.3 — Full Aiybai fan, finger slide and automatic lead-suit focus

In **Arc** mode, the entire Aiybai (including a 26-card two-player hand) fits across the available phone or desktop width as a compact overlapping grid. The hand no longer requires horizontal scrolling. Drag a finger from left to right across the fan to highlight/select each card without playing it; the currently selected card lifts and shows an explicit card preview, and the player taps **Play** to submit it. Ordinary taps, keyboard selection and double-tap play remain available. Since 26 cards must fit across a narrow phone, card indices overlap heavily; dragging exposes the complete currently selected card.

When another player establishes the lead suit for the current **އަތް (Aiy)**, matching cards are visually highlighted. In **Straight** mode BONDI automatically scrolls to the first matching suit card **once per new Aiy**, not on every game redraw; in **Arc** mode all cards are already visible so the matching suit is highlighted without scrolling. No automatic scrolling occurs when the player cannot follow suit. Manual scrolling and selected-card state are preserved across ordinary redraws.

This is a purely local interface change for Solo vs AI and multiplayer: no rule, turn order, opponent Aiybai, Aiy pacing, server or database change. The installed PWA cache updates to `5.14.3`. Tests cover the full 13/26-card fan, finger selection without auto-play, the Play button, suit focus and no repeated jump.


## Stage 5.15A — Premium mobile gameplay screen

BONDI's solo and multiplayer gameplay screens now use the same **modern mobile-first, full-height layout**. The top HUD provides a compact BONDI title, solo/room identity, connectivity indicator, current turn, and leading suit. The middle is a flexible emerald felt table with circular player initials, card counts, highlighted active player, and Aiy card slots. The bottom is a fixed **thumb-friendly Aiybai dock**, with the saved Straight/Arc choice, full-hand fan / swipe selection, a visible selected-card preview, large Play button, and smaller Clear button. The game has special adjustments for narrow (320px) and short screens, safe areas and wider devices.

The menu at the top right exposes the **existing** Solo New game/Home, multiplayer Leave/Reconnect and game-log/export actions rather than leaving them above the playing field. Its menu is a native accessible disclosure; long notes and logs no longer interrupt active play. Reconnecting/turn/lead-suit states are powered by actual game snapshots. Matching suit highlighting and automatic straight-hand focus are preserved. Aiybai consent and match result panels stay accessible as overlays in this first stage; richer dialogs and animation are planned for Stage 5.15B/C.

This is a **frontend-only** update: no BONDI rule, AI model, އަތް (Aiy) resolution timing, Aiybai transfer, online multiplayer protocol, Render server, or PostgreSQL change. It reuses existing card buttons and touch selection; hidden opponent cards remain private. No third-party fonts or remote images are required, so offline solo continues working. The offline cache updates to `5.15a`.

Testing: `node modern-game-screen.test.js` plus the full 18 existing test suite, including Aiy review, touch hand selection, reconnect and persistence. The aesthetic uses initials rather than real profile photos until profile/avatar consent exists.


## Stage 5.15A.1 — Shuffle and dealing animations

Starting a new Solo vs AI game now briefly **shuffles a stack of card backs in the center of the table and deals cards outward** to every seat. The same animation plays for everyone when an online or same-browser multiplayer room first transitions from the lobby into a started match, including a fresh match after a rematch lobby. It uses only anonymous card-back shapes; actual Aiybai cards are private and are not animated face-up.

The animation is **cosmetic only**. It does not alter randomness, cards, dealer/right-hand opening turn, AI, Aiybai consent, WebSocket state, or the existing Aiy review/turn timings. It does not intercept taps. The true game hand is present immediately, and the overlay clears itself after about **1.4 seconds**. Navigating away cancels the overlay. Ordinary game updates, same-room reconnections, refreshes, and mid-game restores **do not replay** the deal. People using the OS/browser **Reduce Motion** preference see the game instantly without the visual animation.

Implemented with lightweight local HTML and CSS keyframes, so there are no external files or network dependencies and offline Solo still works. The PWA cache is `bondi-static-v5.15a1`. Test via `node deal-animation.test.js`, followed by the complete regression suite.


## Stage 5.15A.2 — iPhone shuffle visibility fix

On some phones the initial shuffle was invisible because the game immediately skipped the entire overlay when the operating system requested **Reduce Motion**. The original visual was also very short (~1.4 seconds) and understated. The revised shuffling and dealing uses higher contrast card backs and a clearer status label, remains visible around **2.75 seconds**, and shows a static **CARDS DEALT** deck/message for about 1.15 seconds if Reduce Motion is enabled. The animation never disables card input or changes the real game/AI timings.

An explicit **Menu → Replay deal animation** command lets players verify the effect during a game without reshuffling the actual Aiybai or changing turn order. The command displays only anonymous backs. On iPhone, the animation requires **Settings → Accessibility → Motion → Reduce Motion** to be off; otherwise the static alternative appears. When updating an installed BONDI web app, reopen it while online to receive the new `5.15a2` PWA cache. Test: `node deal-animation.test.js` plus all existing UI and engine tests.


## Stage 5.15A.3 — Do not reveal or play cards while dealing

A new match now has an actual **opening dealing phase**, not merely a decorative animation over an already-active game. While the shuffle/deal effect plays (~2.75 seconds), each player's Aiybai faces, the central Aiy and the action buttons stay visually concealed/locked. **Solo vs AI never schedules its first AI move or accepts a human move during the phase.** The Render multiplayer server publishes `room.dealUntil`, rejects human plays before the authoritative deadline and does not schedule an AI move until the deadline. It broadcasts when the deal finishes; clients reveal cards only after both that server signal and the local animation are done. The opening phase is entirely separate from subsequent one-second completed-Aiy reviews, which remain unchanged.

On reconnect or page refresh, players observe the current server dealing deadline instead of restarting the shuffle; persisted room recovery respects the same deadline. Replay deal animation remains cosmetic and never reshuffles actual cards. Reduced Motion still gets static dealing feedback. Tests cover solo, normal 2/4-player displays, preventing early server AI/human plays, and resuming existing game pacing.


## Stage 5.15C.1 — Cards fly from player seats into the Aiy

After the opening deal, **each newly played public card** now animates from its player's visible seat to its slot in the center of the **އަތް (Aiy)**. This includes human players, AI opponents, two-player mode, four-player mode and an immediate first lead after Aiy review. Face-up cards are shown only *after* they have been publicly played. The effect lasts about **460 ms**, comfortably shorter than the existing **one-second completed-Aiy review**. Independent flight overlays can overlap during rapid AI moves; no BONDI rules, AI turn scheduling, network protocol, persistence, hand contents or actual Aiy timing are changed.

The implementation detects a one-card extension of the currently rendered Aiy, while distinguishing a newly led Aiy after review. Initial snapshots, reconnecting clients, batch/catch-up updates and page reloads **do not retroactively animate earlier moves**. All visuals are drawn locally with CSS/DOM over the table, ignore touch events, and are disabled under the browser/OS Reduce Motion preference. Flight elements are removed automatically after playback and when leaving the game. Existing shuffle/deal animations are unaffected.

Verification: `node card-flight.test.js` plus all existing gameplay, mobile, reconnect, persistence and offline-PWA regression tests. The PWA asset cache is bumped to `5.15c1`.
