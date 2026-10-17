# BONDI isolated multiplayer capacity benchmark

## Current-code verification — 17 October 2026

Run against main `aae6403` plus the corrected benchmark, on the local Codex execution host using Node.js 24.19.0. These are **local isolated results, not GitHub Actions or Render production measurements**. Raw metrics: [results-2026-10-17.json](results-2026-10-17.json).

The opening dealing lock remained active. Virtual clients waited for the server reveal snapshot. Aiy presentation delay was disabled only in the isolated server. The zero-budget regression confirmed unfinished games return a failing exit code and retain JSON diagnostics.

| Rooms | Virtual players | Completed | P95 action latency | Errors |
|---:|---:|---:|---:|---:|
| 10 | 40 | 10/10 | 7.2 ms | 0 |
| 25 | 100 | 25/25 | 18.1 ms | 0 |
| 50 | 200 | 50/50 | 28 ms | 0 |
| 100 | 400 | 100/100 | 53.2 ms | 0 |

All 185 games completed, with zero reported errors. The 101st room was correctly rejected in the 100-room scenario. Server RSS was unavailable on this host and is recorded as null, not zero. These results do not establish Render Free capacity, Hard-AI throughput, persistence performance or real-network latency.

## Historical benchmark — 10 October 2026

The figures below describe the older code and are preserved for reference.


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

