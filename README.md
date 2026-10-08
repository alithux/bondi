# BONDI Stage 5.4 — Player Identity & Rematch Reliability

**Game:** https://alithux.github.io/bondi/  
**Online server:** https://bondi-online.onrender.com/health  
**Engine:** BONDI rules + Hard AI Stage 4.2 (unchanged)

BONDI is a Maldivian multiplayer card game. **Aiy** (އަތް) means the played sequence, and **Aiybai** means a player's held cards. Four-player online rooms support players on different phones, AI-filled seats, real-time server-authoritative play, and **Play Again** in the same room. Solo vs AI and same-browser multiplayer remain available.

## What's new in Stage 5.4

- **Original player identity persists for an entire match.** If Ayya finishes and later disconnects, AI may control that seat but historic log entries and player labels still say **Ayya (Seat 2)** instead of changing retroactively to “AI 3”.
- During the match, such a seat is visibly labeled **AI takeover**. On **Play Again**, an abandoned seat receives a unique `AI N` identity for the new match; the previous match's history is no longer displayed.
- **Bondi re-entry is supported.** Even a player who previously finished can collect a Bondi and return to active play. If they already left, AI can continue that seat after re-entry; their identity still remains the original name for that match.
- **Lobby host failover.** If a host leaves or expires during a lobby/rematch lobby, another human becomes host so the room code, Ready flow and next match remain available. A lobby with no remaining human participants still closes.
- Game rules, Stage 4.2 Hard AI, card legality, same-browser and Solo modes are **unchanged**.

## How to use

1. Open the site on both phones; select **Multiplayer → Online — different phones**.
2. Create a room on one phone, and join on the other using its code and different player names.
3. Fill unused seats with AI, mark Ready, and start BONDI.
4. After a game ends, the online host taps **Play Again — same room**. All remaining human players mark Ready before a new 52-card deal.
5. If someone leaves, the match continues with AI control of that seat. A connection lost unexpectedly has a **60-second** reconnect window before AI takes over. The next match gives any vacated seat a new AI name; the host may remove that AI in the rematch lobby to make space for a returning person.

## Validation

See [STAGE54-TEST-RESULTS.md](STAGE54-TEST-RESULTS.md) and the included test scripts. Tests cover completed online matches, private Aiybai, room rematches, disconnects, AI takeover of a previously finished human, actual Bondi re-entry, host transfer in the lobby, and the mobile-oriented UI.

**Limits:** This is a one-process, in-memory WebSocket server hosted on Render's free plan. Rooms are lost when the instance sleeps or restarts; waking can take time. There are no permanent player accounts, public matchmaking, or room persistence. The 60-second grace window is controlled by the server, not a phone.

Deployment details: [ONLINE-DEPLOY.md](ONLINE-DEPLOY.md). Same-browser local mode does not yet have same-room Play Again; only Online mode does.
