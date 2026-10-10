# BONDI multiplayer capacity test

This test creates **virtual humans over real WebSocket connections** against a **new, isolated Node.js BONDI server process**. It never sends load to the production Render instance.

Run locally with Node.js 22+:

```sh
node load-test/run.js --quick --output=load-test-results.json
node load-test/run.js --output=load-test-results.json
```

The full run uses separate fresh servers at **10, 25, 50 and 100 rooms** (four sockets per room, i.e. 40, 100, 200 and 400 simulated players). All players join, Ready, and Start, then use legal moves automatically. The 100-room scenario also checks that creating the 101st room is rejected.

Metrics include setup count, completed vs unfinished matches within the fixed time window, total human `PLAY` actions, action round-trip time P50/P95, HTTP `/health` response-time P95, maximum server resident memory (on Linux), reported errors and the configured room-cap check. The report is printed to CI logs, written to the JSON output, and included in the GitHub Actions job summary.

**Safety:** the runner accepts no remote server URL, launches `load-test/local-server.js` as a loopback-only subprocess using the same `RoomService` and WebSocket implementation bound on an ephemeral port, and connects via `ws://127.0.0.1`. It stops each subprocess when its scenario ends. The production server is not accessed or restarted. GitHub Actions workflow: `.github/workflows/load-test.yml`; runs automatically on PRs changing the load tool or can be started manually in Actions.

**Interpretation:** the stated room limit of 100 is a software cap, not a guaranteed Render Free capacity. Results measure the GitHub Actions runner's CPUs and memory, not Render's. Incomplete games are **not** counted as successes. The isolated server skips the usual 1.8-second Aiy presentation delay (setting `resolutionDelay=0`) to keep the CI test fast; no BONDI game rules are changed. The test intentionally uses four human virtual clients per room to exercise connection and gameplay broadcasting; it does not benchmark all-Hard-AI CPU workload, mobile internet latency, cross-region access, or multiple server instances. It is not a substitute for a separately authorized production/staging performance trial.


Latest measured isolated result: [Load test results](RESULTS.md).
