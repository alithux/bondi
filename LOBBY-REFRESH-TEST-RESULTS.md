# Stage 5.6.1 — Multiplayer lobby usability checks

**Scope:** UI-only refinement; Hard AI 4.4 and BONDI rules unchanged.

- PASS: beginner path explicitly chooses Create or Join, no competing actions on one line.
- PASS: invitation URL `?room=ABC123` prefills Join; does not join automatically or bypass a name.
- PASS: copy room code and copy invite link actions.
- PASS: host-only dealer/AI/start controls hidden from guests.
- PASS: ready and host-start action flow, including same-room rematches.
- PASS: AI fill action sends one ADD_AI request per empty seat (not repeated requests for already occupied seats).
- PASS: HTML layout inspected with headless Chromium at 390px mobile and 768px tablet, zero horizontal overflow.
- PASS: `multiplayer-lobby-refresh.test.js` plus Stage 5.2, 5.3 and 5.4 UI regressions.
- PASS: core game-engine, multiplayer-core, iPhone/local-browser, 160-game multiplayer simulation, online WebSocket, privacy, reconnection and Play Again tests.
- LIMITATION: the environment blocks direct Chrome-to-localhost navigation, so a live WebSocket two-browser UI test was not run; online transport protocol is unchanged and its existing tests passed. Test a fresh room on two physical phones after publishing.