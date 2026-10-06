# BONDI Stage 5.0.1 — Multiplayer Validation Results

- Stage 4.1 BONDI engine: **62/62 passed**.
- Multiplayer core: **13/13 passed**.
- Standard create/join/ready/start/sync/play browser test: **PASS**.
- iPhone suspended-tab regression: **PASS**.
  - BroadcastChannel delivered no messages.
  - Host polling was stopped to simulate a suspended tab.
  - Guest join remained in the persistent mailbox.
  - Host processed it after resume/poll.
  - Guest processed the queued acceptance after resume/poll.
- Mixed multiplayer stress: **160/160 games**, **13,000 plays**, **0 illegal moves**, **0 stalls**.

Stage 5.0.1 is same-browser multiplayer. Internet rooms between different devices require the next cloud transport.
