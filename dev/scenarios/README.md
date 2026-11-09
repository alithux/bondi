# BONDI rules lab

Run fixed synthetic scenarios through the production engine and Aiybai transfer APIs.
No live rooms, remote servers, accounts, or production state are used.

## Run

From the repository root:

```sh
node dev/scenarios/test.js
BONDI_SCENARIOS=1 node dev/scenarios/server.js
```

Open http://127.0.0.1:4177. Choose a scenario or run all four, expand each action
for Aiybai cards, player status, current Aiy, next player/leader, and engine logs.
Download report saves repeatable JSON locally. `BONDI_SCENARIO_PORT` overrides 4177.

The server exits unless BONDI_SCENARIOS=1, binds only to loopback, validates Host,
and serves an explicit file allowlist. There is no link in the game, service-worker
entry, or production-server route. This is a development flag, not an authenticated
production feature. Test mobile viewport layouts locally; do not expose this server
on a public interface to test a phone.

## Fixtures and scope

`fixtures.json` defines the dealer, current player, four fixed Aiybai, previously
cleared cards, action sequence, and explicit expected outcomes. Actions call
`playCard` from the actual source-part engine or `requestAiybai`/`answerAiybai`
from multiplayer-core. The browser loads the same source parts as index.html;
Node uses online-server/load-engine.js. No alternate rules engine is implemented.

- Normal Aiy: K♣, A♣, 3♣, 4♣; Player 2 leads next with cards remaining.
- Last card: Player 1's final K♣ remains pending, then finishes immediately on A♣.
- Acceptance: a real completed Aiy precedes the request; Player 2 gives all cards,
  finishes, and Player 1 remains leader. A duplicate acceptance is rejected.
- Decline: players' card identities and statuses are unchanged.

At every step, Aiybai + current Aiy + cleared cards must be exactly the 52 unique
canonical card IDs. lastResolution is history and must not be double-counted.
The fixture starts late in a synthetic match, with cleared cards explicitly listed.

This does not certify live deployment, physical-iPhone behavior, network reconnects,
or a new interpretation of Bondi triggers. Request eligibility is exercised through
current production APIs; no extra "out of options" threshold is introduced.

## Browser verification

With Playwright and its Chromium/WebKit browsers available:

```sh
node dev/scenarios/browser.test.js
```

The browser check starts its own opt-in loopback server on 4178 and compares all
browser traces to the server-loader results at desktop and mobile viewport sizes.
It also checks repeated runs, report downloads, overflow, the route allowlist, and
that the server refuses to start without the flag. Actual phone testing is separate.
