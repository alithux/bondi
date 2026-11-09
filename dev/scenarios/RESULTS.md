# Validation — 2026-11-09

Passed locally:
- All four production-engine scenarios and their explicit expected outcomes.
- Repeatability and unchanged fixture inputs.
- Duplicate-card detection and intentionally incorrect leader expectation rejection.
- Identical complete traces through browser source-part loading and server engine loading (Node VM).
- Existing solo-aiybai.test.js and aiybai-consent.test.js, including online service checks.
- JavaScript syntax checks for the UI and development server.

Not yet verified:
- Actual Chromium/WebKit page rendering and mobile viewport behavior. Browser downloads
  failed in this environment, and system Chromium launch was denied by socket restrictions.
- Physical iPhone testing.

The new scenario-browser GitHub workflow runs the provided Playwright checks after a PR
is opened. Its result must be checked separately; this report does not claim CI passed.
The runner is local development only and is not deployed as a public game feature.
