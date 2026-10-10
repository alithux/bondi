# BONDI isolated multiplayer capacity benchmark

**Test date:** 10 October 2026  
**Workflow run:** [BONDI isolated multiplayer load test #38056567080](https://github.com/alithux/bondi/actions/runs/38056567080)  
**JSON results artifact:** [bondi-load-test-results](https://github.com/alithux/bondi/actions/runs/38056567080/artifacts/11671026736)

All scenarios used a freshly launched loopback-only BONDI Node.js server on a GitHub Actions runner. Each room had **four simulated human players**, each on a separate real WebSocket connection, playing a complete game using legal BONDI cards. The usual resolution animation delay was set to zero **only on the isolated benchmark server**.

| Rooms concurrently | Virtual players | Games completed | Total card actions | P95 card action latency | P95 health latency | Peak server RSS | Errors |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 40 | 10/10 | 760 | 11.5 ms | 1.8 ms | 77.8 MB | 0 |
| 25 | 100 | 25/25 | 1,922 | 19.6 ms | 1.6 ms | 102.0 MB | 0 |
| 50 | 200 | 50/50 | 3,979 | 45.8 ms | 41.1 ms | 112.6 MB | 0 |
| 100 | 400 | 100/100 | 7,743 | 71.8 ms | 178.4 ms | 139.3 MB | 0 |

The test also verified that creating a 101st room returned the expected `Server is full` error, confirming the configured limit of 100 rooms.

## Interpretation

**Supported by the test:** the current BONDI game server code successfully completed games for 100 concurrently active rooms (400 WebSocket clients) on the CI machine, with no detected errors in this run.

**Not established:** that the single production **Render Free** instance can handle 100 concurrent rooms with acceptable response times. The CI runner has a different CPU, memory, networking environment and server lifecycle. These results also do not test cross-region networks, mobile browsers, sustained hours-long traffic, or 3-Hard-AI rooms, which can use substantially more CPU.

The production server was **not** load-tested, restarted or redeployed as part of this benchmark. For a reliable Render-specific capacity figure, use a separate authorized staging instance with Render-equivalent resources and representative mixtures of AI and human players.

To reproduce: `node load-test/run.js --output=load-test-results.json` from the BONDI repo on Node 22+. See [README](README.md) for setup and safety constraints.
