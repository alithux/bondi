# BONDI Stage 5.0.1 — Multiplayer Foundation · iPhone tab-sync fix

Stage 5.0.1 keeps the Stage 4.1 BONDI rules and Hard AI unchanged and hardens local-browser multiplayer for iPhone/iOS tab suspension.

## iPhone fix
- BroadcastChannel remains the fast path.
- Every room action is also stored in a persistent localStorage mailbox.
- Clients poll the mailbox and poll immediately when a tab regains focus/visibility.
- Join requests survive while the host tab is suspended.
- Join acceptance survives until the guest tab is active again.
- Message IDs deduplicate fast-path and mailbox delivery.
- Mailbox messages expire after 10 minutes.

## iPhone test flow
1. Create the room in tab 1.
2. Join with the code in tab 2.
3. Switch to the host tab once.
4. Switch back to the joining tab; the lobby should appear.

This remains same-browser multiplayer. Different-device play still needs the cloud/WebSocket transport.

## Validation
- Stage 4.1 rules/AI: **62/62 passed**.
- Multiplayer core: **13/13 passed**.
- Standard browser room flow: **passed**.
- iPhone suspended-host mailbox regression: **passed** with BroadcastChannel deliberately disabled.
- Mixed multiplayer simulation: **160/160 games**, **13,000 synchronized plays**, **0 illegal moves**, **0 stalls**.
