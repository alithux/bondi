/* BONDI core rules engine. CommonJS + browser compatible. */
(function (root) {
  'use strict';
  const SUITS = ['♣', '♦', '♥', '♠'];
  const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const VALUES = Object.fromEntries(RANKS.map((rank, i) => [rank, i + 2]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const sortHand = hand => hand.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.value - b.value);

  function createDeck() {
    return SUITS.flatMap(suit => RANKS.map(rank => ({ id: `${rank}${suit}`, rank, suit, value: VALUES[rank] })));
  }
  function shuffle(cards, random = Math.random) {
    const result = cards.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function createGame({ playerCount = 4, dealer = 0, random = Math.random } = {}) {
    if (![2, 4].includes(playerCount)) throw new Error('Equal dealing currently supports 2 players (26 cards each) or 4 players (13 cards each).');
    if (!Number.isInteger(dealer) || dealer < 0 || dealer >= playerCount) throw new Error('Dealer index is outside the player range.');
    const players = Array.from({ length: playerCount }, (_, i) => ({ id: i, name: `Player ${i + 1}`, hand: [], status: 'active' }));
    const deck = shuffle(createDeck(), random);
    deck.forEach((card, index) => players[index % playerCount].hand.push(card));
    players.forEach(p => sortHand(p.hand));
    const firstPlayer = (dealer - 1 + playerCount) % playerCount;
    return {
      players, dealer, currentPlayer: firstPlayer, leadSuit: null, trick: [],
      pendingFinish: [], finishedOrder: [], roundOver: false, lastResolution: null,
      aiMemory: { knownVoids: Object.fromEntries(players.map(p => [p.id, []])), seenPlays: [], bondiHistory: [], publicHeldCards: Object.fromEntries(players.map(p => [p.id, []])) },
      message: `Dealt ${52 / playerCount} cards each. Player ${firstPlayer + 1} (dealer’s right) starts.`,
      log: [`New game: ${playerCount} players, ${52 / playerCount} cards each.`, `Dealer: Player ${dealer + 1}; first Aiy: Player ${firstPlayer + 1}.`]
    };
  }
  function legalMoves(state, playerIndex) {
    const player = state.players[playerIndex];
    if (!player || player.status !== 'active') return [];
    if (!state.trick.length) return player.hand.slice();
    const follow = player.hand.filter(card => card.suit === state.leadSuit);
    return follow.length ? follow : player.hand.slice();
  }
  function highestLeadCard(trick, leadSuit) {
    return trick.filter(play => play.card.suit === leadSuit)
      .reduce((best, play) => !best || play.card.value > best.card.value ? play : best, null);
  }
  function markFinished(state, playerIndex) {
    const p = state.players[playerIndex];
    if (p.status === 'finished' || p.hand.length) return;
    p.status = 'finished';
    if (!state.finishedOrder.includes(playerIndex)) state.finishedOrder.push(playerIndex);
    state.log.push(`Player ${playerIndex + 1} has finished.`);
  }
  function nextActive(state, afterIndex) {
    for (let step = 1; step <= state.players.length; step++) {
      const i = (afterIndex + step) % state.players.length;
      if (state.players[i].status === 'active' && state.players[i].hand.length > 0) return i;
    }
    return -1;
  }
  function checkRoundOver(state) {
    const remaining = state.players.filter(p => p.status === 'active' && p.hand.length > 0);
    if (remaining.length <= 1) {
      state.roundOver = true;
      if (remaining.length === 1) {
        state.message = `${remaining[0].name} is the last player holding cards.`;
        state.log.push(state.message);
      } else {
        state.message = 'No players remain with cards.';
      }
    }
  }
  function playCard(state, playerIndex, cardId) {
    const s = clone(state);
    if (s.roundOver) return { ok: false, error: 'The round is over.' };
    if (playerIndex !== s.currentPlayer) return { ok: false, error: 'It is not this player’s turn.' };
    const player = s.players[playerIndex];
    if (!player || player.status !== 'active') return { ok: false, error: 'This player is not active.' };
    const card = player.hand.find(c => c.id === cardId);
    if (!card) return { ok: false, error: 'That card is not in this player’s Aiybai.' };
    if (!legalMoves(s, playerIndex).some(c => c.id === cardId)) return { ok: false, error: 'You must follow the lead suit if you have one.' };

    if (!s.trick.length) s.leadSuit = card.suit;
    const isBondi = s.trick.length > 0 && card.suit !== s.leadSuit;
    player.hand = player.hand.filter(c => c.id !== cardId);
    s.trick.push({ playerIndex, card, bondi: isBondi });
    if (!s.aiMemory) s.aiMemory = { knownVoids: Object.fromEntries(s.players.map(p => [p.id, []])), seenPlays: [], bondiHistory: [], publicHeldCards: Object.fromEntries(s.players.map(p => [p.id, []])) };
    if (!s.aiMemory.bondiHistory) s.aiMemory.bondiHistory = [];
    if (!s.aiMemory.seenPlays) s.aiMemory.seenPlays = [];
    if (!s.aiMemory.publicHeldCards) s.aiMemory.publicHeldCards = Object.fromEntries(s.players.map(p => [p.id, []]));
    // Cards returned by Bondi are public information. If a publicly-known card is
    // later played, it is no longer known to remain in that player's Aiybai.
    s.aiMemory.publicHeldCards[playerIndex] = (s.aiMemory.publicHeldCards[playerIndex] || []).filter(id => id !== cardId);
    s.aiMemory.seenPlays.push({ playerIndex, card: clone(card), leadSuit: s.leadSuit, bondi: isBondi });
    if (isBondi) {
      const voids = s.aiMemory.knownVoids[playerIndex] || (s.aiMemory.knownVoids[playerIndex] = []);
      if (!voids.includes(s.leadSuit)) voids.push(s.leadSuit);
    }
    s.log.push(`${player.name} played ${card.rank}${card.suit}${isBondi ? ' — BONDI!' : ''}`);

    if (!player.hand.length) {
      // They remain provisionally involved until this Aiy resolves, per the user's rule.
      player.status = 'pending-finish';
      s.pendingFinish.push(playerIndex);
      s.log.push(`${player.name} played their last card and is waiting for this Aiy to resolve.`);
    }

    if (isBondi) resolveBondi(s);
    else {
      // If a last-card player was temporarily staying because their card was highest,
      // they finish immediately once a higher card of the lead suit overtakes it.
      const currentHighest = highestLeadCard(s.trick, s.leadSuit);
      for (const pendingIndex of s.pendingFinish.slice()) {
        const pendingPlay = s.trick.find(play => play.playerIndex === pendingIndex);
        if (pendingPlay && currentHighest && currentHighest.playerIndex !== pendingIndex) {
          if (currentHighest.card.value > pendingPlay.card.value) markFinished(s, pendingIndex);
        }
      }
      s.pendingFinish = s.pendingFinish.filter(i => s.players[i].status === 'pending-finish');
      const next = nextPlayerInAiy(s, playerIndex);
      if (next < 0) resolveNormalAiy(s);
      else { s.currentPlayer = next; s.message = `${s.players[next].name} to play. Lead suit: ${s.leadSuit}.`; }
    }
    return { ok: true, state: s };
  }
  function nextPlayerInAiy(state, from) {
    for (let step = 1; step <= state.players.length; step++) {
      const i = (from + step) % state.players.length;
      const alreadyPlayed = state.trick.some(play => play.playerIndex === i);
      if (state.players[i].status === 'active' && state.players[i].hand.length > 0 && !alreadyPlayed) return i;
      if (state.players[i].status === 'pending-finish' && !alreadyPlayed) return i;
    }
    return -1;
  }
  function resolveNormalAiy(s) {
    const resolvedCards = clone(s.trick);
    const resolvedLeadSuit = s.leadSuit;
    const winner = highestLeadCard(s.trick, s.leadSuit);
    const winnerIndex = winner ? winner.playerIndex : s.currentPlayer;
    s.log.push(`Aiy resolved without Bondi. Highest original-suit card: Player ${winnerIndex + 1}.`);
    s.lastResolution = { type: 'normal', leadSuit: resolvedLeadSuit, cards: resolvedCards, winnerIndex };
    // A player who used their last card is finished after resolution unless a Bondi returns cards.
    for (const i of s.pendingFinish.slice()) markFinished(s, i);
    s.pendingFinish = [];
    s.trick = []; s.leadSuit = null;
    checkRoundOver(s);
    if (!s.roundOver) {
      let starter = winnerIndex;
      if (s.players[starter].status !== 'active' || !s.players[starter].hand.length) starter = nextActive(s, winnerIndex);
      if (starter < 0) { checkRoundOver(s); return; }
      s.currentPlayer = starter;
      s.message = `${s.players[starter].name} starts the next Aiy.`;
    }
  }
  function resolveBondi(s) {
    const resolvedCards = clone(s.trick);
    const resolvedLeadSuit = s.leadSuit;
    const bondiPlay = resolvedCards.find(play => play.bondi) || null;
    const highest = highestLeadCard(s.trick, s.leadSuit);
    if (!highest) return;
    const recipientIndex = highest.playerIndex;
    const recipient = s.players[recipientIndex];
    for (const play of s.trick) recipient.hand.push(play.card);
    // Bondi cards return to the Aiybai in normal suit/rank order rather than
    // being left appended at the back of the hand.
    sortHand(recipient.hand);
    if (!s.aiMemory.publicHeldCards) s.aiMemory.publicHeldCards = Object.fromEntries(s.players.map(p => [p.id, []]));
    const held = new Set(s.aiMemory.publicHeldCards[recipientIndex] || []);
    for (const play of s.trick) held.add(play.card.id);
    s.aiMemory.publicHeldCards[recipientIndex] = Array.from(held);
    // Taking an interrupted Aiy can restore suits that were previously known empty.
    if (s.aiMemory && s.aiMemory.knownVoids) {
      const restored = new Set(s.trick.map(play => play.card.suit));
      const known = s.aiMemory.knownVoids[recipientIndex] || [];
      s.aiMemory.knownVoids[recipientIndex] = known.filter(suit => !restored.has(suit));
    }
    if (recipient.status === 'pending-finish' || recipient.status === 'finished') {
      recipient.status = 'active';
      s.finishedOrder = s.finishedOrder.filter(i => i !== recipientIndex);
      s.pendingFinish = s.pendingFinish.filter(i => i !== recipientIndex);
      s.log.push(`${recipient.name} returns to the game after taking the Bondi cards.`);
    }
    // Other players who played their last card are finished once the interrupted Aiy resolves.
    for (const i of s.pendingFinish.slice()) if (i !== recipientIndex) markFinished(s, i);
    s.pendingFinish = [];
    s.log.push(`Bondi: ${recipient.name}, who played the highest card of the original lead suit, takes all cards from this interrupted Aiy back into their Aiybai.`);
    const leaderIndex = resolvedCards.length ? resolvedCards[0].playerIndex : null;
    const outcome = {
      leadSuit: resolvedLeadSuit, leaderIndex, recipientIndex,
      bondiPlayerIndex: bondiPlay ? bondiPlay.playerIndex : null,
      handCountsAfter: s.players.map(p => p.hand.length)
    };
    if (!s.aiMemory.bondiHistory) s.aiMemory.bondiHistory = [];
    s.aiMemory.bondiHistory.push(outcome);
    if (s.aiMemory.bondiHistory.length > 40) s.aiMemory.bondiHistory.shift();
    s.lastResolution = { type: 'bondi', leadSuit: resolvedLeadSuit, cards: resolvedCards, recipientIndex, bondiPlayerIndex: bondiPlay ? bondiPlay.playerIndex : null, leaderIndex };
    s.trick = []; s.leadSuit = null;
    checkRoundOver(s);
    if (!s.roundOver) {
      s.currentPlayer = recipientIndex;
      s.message = `Bondi resolved. ${recipient.name} starts the next Aiy.`;
    }
  }
  function chooseLegacyAICard(state, playerIndex, difficulty = 'easy', random = Math.random) {
    const moves = legalMoves(state, playerIndex);
    if (!moves.length) return null;
    const level = String(difficulty).toLowerCase();
    if (level === 'easy') {
      // Even Easy follows the BONDI card-choice convention: if it cannot follow
      // suit, choose a random Bondi suit but give the highest card in that suit.
      const isBondiChoice = state.trick.length > 0 && !moves.some(c => c.suit === state.leadSuit);
      if (isBondiChoice) {
        const suits = [...new Set(moves.map(c => c.suit))];
        const suit = suits[Math.floor(random() * suits.length)];
        return moves.filter(c => c.suit === suit).sort((a,b) => b.value - a.value)[0];
      }
      return moves[Math.floor(random() * moves.length)];
    }

    let sorted = moves.slice().sort((a,b) => a.value - b.value);
    const hand = state.players[playerIndex].hand;
    const counts = Object.fromEntries(SUITS.map(suit => [suit, hand.filter(c => c.suit === suit).length]));
    const knownVoids = state.aiMemory && state.aiMemory.knownVoids ? state.aiMemory.knownVoids : {};

    if (!state.trick.length) {
      if (level === 'medium') return sorted[0];

      // Hard lead strategy: known opponent voids are opportunities to force Bondi.
      // Prefer a low card in such a suit so the AI is less likely to become the
      // highest original-suit player who must take the interrupted Aiy back.
      const targetSuits = new Set();
      for (const p of state.players) {
        if (p.id === playerIndex || p.status !== 'active') continue;
        for (const suit of (knownVoids[p.id] || [])) if (counts[suit] > 0) targetSuits.add(suit);
      }
      // A known void is only an opportunity if repeatedly forcing Bondi is not
      // feeding that opponent toward zero while this AI takes the cards back.
      const history = state.aiMemory && state.aiMemory.bondiHistory ? state.aiMemory.bondiHistory : [];
      function harmfulRepeat(suit) {
        // Stage 3.13: recipient anti-repeat. The player who TAKES a Bondi Aiy is
        // the one who starts next, even when someone else originally led it. A
        // harmful repeat therefore belongs to the recipient, not just the prior
        // leader. Keep avoiding that suit while the Bondi giver is still active
        // and is still confirmed void in it.
        const recent = history.slice().reverse().find(h => h.recipientIndex === playerIndex && h.leadSuit === suit && h.bondiPlayerIndex != null);
        if (!recent) return false;
        const opponent = state.players[recent.bondiPlayerIndex];
        if (!opponent || opponent.status !== 'active' || opponent.hand.length <= 0) return false;
        const voids = knownVoids[opponent.id] || knownVoids[recent.bondiPlayerIndex] || [];
        return voids.includes(suit);
      }
      // Stage 3.5: first defend against the opponent closest to finishing. If we
      // know that player is void in some suits, do not feed those escape routes
      // when we can instead lead a suit they may still be able to follow. This
      // is opponent-aware rather than merely suit-repeat-aware.
      const activeOpponents = state.players
        .map((p,i) => ({p,i}))
        .filter(x => x.i !== playerIndex && x.p.status === 'active' && x.p.hand.length > 0);

      // Stage 3.6: score every possible lead against every active opponent.
      // This uses public information only: hand counts and confirmed voids.
      // A lead into a known void gives that opponent a Bondi escape; this is
      // increasingly dangerous as their Aiybai approaches zero. Conversely,
      // a suit they are not known void in is our best evidence that it may
      // force them to follow. We never inspect hidden opponent cards here.
      function threatWeight(n) {
        if (n <= 1) return 1500;
        if (n === 2) return 900;
        if (n === 3) return 520;
        if (n === 4) return 280;
        if (n <= 6) return 90;
        return 18;
      }
      const publicHeld = state.aiMemory && state.aiMemory.publicHeldCards ? state.aiMemory.publicHeldCards : {};
      function publicHandInfo(x) {
        const ids = publicHeld[x.p.id] || publicHeld[x.i] || [];
        const knownCards = ids.map(id => {
          const suit = SUITS.find(s => id.endsWith(s));
          return suit ? { id, suit } : null;
        }).filter(Boolean);
        return { knownCards, complete: knownCards.length === x.p.hand.length };
      }
      function repeatFeedCount(suit, opponentIndex) {
        let n = 0;
        // Stage 3.13: count harmful Bondi outcomes by who received the Aiy, not
        // only by who originally led it. This preserves the consequence when the
        // recipient becomes the next leader after somebody else's lead.
        for (let i = history.length - 1; i >= 0; i--) {
          const h = history[i];
          if (h.recipientIndex !== playerIndex) continue;
          if (h.leadSuit === suit && h.bondiPlayerIndex === opponentIndex) n++;
          else if (n) break;
          if (n >= 6) break;
        }
        return n;
      }
      function definitelyVoid(x, suit) {
        const voids = new Set(knownVoids[x.p.id] || knownVoids[x.i] || []);
        if (voids.has(suit)) return true;
        const info = publicHandInfo(x);
        if (info.complete && !info.knownCards.some(c => c.suit === suit)) return true;

        // Stage 3.16: AI Bondi-discard exhaustion inference. Our AI always
        // gives the highest card in its chosen Bondi suit. Therefore, when an
        // AI opponent publicly gives the 2 of a suit as Bondi, that 2 must have
        // been its only remaining card in that suit: there is no lower card it
        // could still hold, and any higher one would have been the required
        // Bondi discard instead. This is public-information inference, not a
        // hidden-hand read. Do not apply it to Player 1 (the human), because the
        // current UI still permits a human to choose any legal off-suit card.
        if (x.i !== 0) {
          const seen = state.aiMemory && state.aiMemory.seenPlays ? state.aiMemory.seenPlays : [];
          for (let i = seen.length - 1; i >= 0; i--) {
            const play = seen[i];
            if (play.playerIndex !== x.i || !play.card) continue;
            if (play.bondi && play.card.suit === suit && play.card.value === 2) return true;
            // A later legal follow in this suit proves the old exhaustion
            // inference is stale (the player must have received the suit back).
            if (!play.bondi && play.leadSuit === suit && play.card.suit === suit) break;
          }
        }
        return false;
      }
      function definitelyHas(x, suit) {
        const info = publicHandInfo(x);
        return info.knownCards.some(c => c.suit === suit);
      }
      // Stage 3.9: final-card containment. If an opponent has exactly one
      // card left, use only legitimate public/private-to-self information to
      // estimate which lead suit is most likely to force that card to follow.
      // Exact public cards beat probability; confirmed voids are treated as
      // escape routes. When the last card is still hidden, estimate its suit
      // from the remaining never-revealed card pool (excluding this AI's own
      // cards, which it legitimately knows cannot be in the opponent's hand).
      const revealedIds = new Set((state.aiMemory && state.aiMemory.seenPlays ? state.aiMemory.seenPlays : []).map(x => x.card && x.card.id).filter(Boolean));
      const ownIds = new Set(hand.map(c => c.id));
      function unseenSuitCountsFor(x) {
        const voids = new Set(knownVoids[x.p.id] || knownVoids[x.i] || []);
        const countsBySuit = Object.fromEntries(SUITS.map(s => [s, 0]));
        for (const c of createDeck()) {
          if (revealedIds.has(c.id) || ownIds.has(c.id) || voids.has(c.suit)) continue;
          countsBySuit[c.suit]++;
        }
        return countsBySuit;
      }
      function finalCardContainmentRisk(card) {
        let hardEscapes = 0;
        let unknownEscapes = 0;
        let knownFollows = 0;
        let probabilityRisk = 0;
        for (const x of activeOpponents) {
          if (x.p.hand.length !== 1) continue;
          if (definitelyVoid(x, card.suit)) {
            hardEscapes++;
            probabilityRisk += 10000;
            continue;
          }
          if (definitelyHas(x, card.suit)) {
            knownFollows++;
            probabilityRisk -= 6000;
            continue;
          }
          const suitCounts = unseenSuitCountsFor(x);
          const total = Object.values(suitCounts).reduce((a,b) => a+b, 0);
          const pFollow = total ? suitCounts[card.suit] / total : 0;
          if (pFollow === 0) unknownEscapes++;
          probabilityRisk += Math.round((1 - pFollow) * 3200);
        }
        // If risk is otherwise tied, retain future blocking flexibility by
        // preferring to lead from a suit where this AI still has another card.
        const reservePenalty = counts[card.suit] === 1 ? 120 : 0;
        const recentBondiPenalty = state.lastResolution && state.lastResolution.type === 'bondi' && state.lastResolution.leadSuit === card.suit ? 700 : 0;
        return { hardEscapes, unknownEscapes, knownFollows, probabilityRisk: probabilityRisk + reservePenalty + recentBondiPenalty };
      }

      function endgameRisk(card) {
        let hardEscapes = 0;
        let score = 0;
        for (const x of activeOpponents) {
          const n = x.p.hand.length;
          if (n > 2) continue;
          if (definitelyVoid(x, card.suit)) {
            hardEscapes++;
            const base = n === 1 ? 10000 : 6500;
            const repeats = repeatFeedCount(card.suit, x.i);
            // Stage 3.7: a repeated conveyor becomes exponentially unacceptable.
            score += base + repeats * repeats * 2600;
          } else if (definitelyHas(x, card.suit)) {
            // Publicly-known returned cards are strong evidence this lead can force follow.
            score -= n === 1 ? 2600 : 1400;
          } else {
            // Unknown is safer than confirmed void, but not as safe as known-followable.
            score += n === 1 ? 900 : 450;
          }
        }
        return { hardEscapes, score };
      }
      function leadRisk(card) {
        let score = 0;
        for (const x of activeOpponents) {
          const voids = new Set(knownVoids[x.p.id] || knownVoids[x.i] || []);
          const w = threatWeight(x.p.hand.length);
          if (voids.has(card.suit)) score += w;
          else if (x.p.hand.length <= 4) score -= Math.round(w * 0.18);
          const repeats = repeatFeedCount(card.suit, x.i);
          if (repeats) score += repeats * repeats * 900;
        }
        if (harmfulRepeat(card.suit)) score += 1100;
        // Prefer shortening our own suit and using a low lead when risk ties.
        score += counts[card.suit] * 3 + card.value * 0.08;
        return score;
      }

      // Stage 3.11: seat-aware downstream-Bondi prediction. A near-finisher
      // who is likely to follow the lead can sometimes be made to take cards
      // back if a later player in the same Aiy is known void in that suit.
      // The leader should use a low card so the near-finisher has a better
      // chance of becoming the highest original-suit player before that later
      // Bondi. This uses only public information and seat order; it never reads
      // concealed opponent cards.
      function playersAfterLeader() {
        const order = [];
        for (let step = 1; step < state.players.length; step++) {
          const i = (playerIndex + step) % state.players.length;
          const p = state.players[i];
          if (p.status === 'active' && p.hand.length > 0) order.push({p,i});
        }
        return order;
      }
      const downstreamOrder = playersAfterLeader();

      // Stage 3.14: persistent void lock. If this AI previously RECEIVED a
      // Bondi Aiy because an opponent was confirmed void in the lead suit,
      // that suit is a hard no-repeat while the same opponent remains active
      // and the void is still publicly valid. This prevents another scoring
      // layer (for example, containment of a different one-card player) from
      // overriding the known conveyor loss. The lock disappears naturally when
      // public play restores that suit and knownVoids is cleared.
      function recipientVoidLocked(card) {
        for (let i = history.length - 1; i >= 0; i--) {
          const h = history[i];
          if (h.recipientIndex !== playerIndex || h.leadSuit !== card.suit || h.bondiPlayerIndex == null) continue;
          const giver = state.players[h.bondiPlayerIndex];
          if (!giver || giver.status !== 'active' || giver.hand.length <= 0) continue;
          const x = activeOpponents.find(o => o.i === h.bondiPlayerIndex);
          if (x && definitelyVoid(x, card.suit)) return true;
        }
        return false;
      }
      const unlockedLeads = sorted.filter(c => !recipientVoidLocked(c));
      if (unlockedLeads.length) sorted = unlockedLeads;

      function recentFollowStrength(opponentIndex, suit) {
        const seen = state.aiMemory && state.aiMemory.seenPlays ? state.aiMemory.seenPlays : [];
        let strength = 0;
        for (let i = seen.length - 1, age = 0; i >= 0 && age < 28; i--, age++) {
          const play = seen[i];
          if (play.playerIndex !== opponentIndex || !play.card || play.bondi) continue;
          if (play.leadSuit === suit && play.card.suit === suit) {
            strength += Math.max(1, 10 - Math.floor(age / 3));
            if (strength >= 14) break;
          }
        }
        return strength;
      }
      function knownSuitValues(x, suit) {
        const info = publicHandInfo(x);
        const deck = createDeck();
        const byId = new Map(deck.map(c => [c.id, c]));
        return info.knownCards
          .filter(c => c.suit === suit)
          .map(c => byId.get(c.id))
          .filter(Boolean)
          .map(c => c.value);
      }
      function seatAwareEndgameScore(card) {
        if (activeOpponents.length < 2) return 0;
        let score = 0;
        for (let targetPos = 0; targetPos < downstreamOrder.length; targetPos++) {
          const target = downstreamOrder[targetPos];
          const n = target.p.hand.length;
          if (n > 3 || definitelyVoid(target, card.suit)) continue;

          // Stage 3.12 sequencing correction: a confirmed void player BEFORE
          // the target would Bondi first, so the target would never get a turn.
          // Likewise, only the FIRST confirmed void after the target can end the
          // Aiy; later void players are irrelevant once that Bondi occurs.
          const priorVoid = downstreamOrder.slice(0, targetPos).some(x => definitelyVoid(x, card.suit));
          if (priorVoid) continue;
          const firstLaterVoid = downstreamOrder
            .slice(targetPos + 1)
            .find(x => definitelyVoid(x, card.suit));
          if (!firstLaterVoid) continue;
          const laterVoids = [firstLaterVoid];

          // Never deliberately create a free last-card Bondi for the first
          // downstream Bondi player. Two-card players are also costly, but less so.
          const downstreamDanger = firstLaterVoid.p.hand.length === 1 ? 14000
            : firstLaterVoid.p.hand.length === 2 ? 2600
            : firstLaterVoid.p.hand.length === 3 ? 900 : 180;

          let followConfidence = 0.22;
          if (definitelyHas(target, card.suit)) followConfidence = 1;
          else {
            const rf = recentFollowStrength(target.i, card.suit);
            if (rf) followConfidence = Math.min(0.82, 0.34 + rf * 0.035);
          }

          // Publicly-known held cards can tell us whether the target is able to
          // overtake this exact lead. Otherwise a lower lead is probabilistically
          // better because more unseen ranks can beat it.
          const vals = knownSuitValues(target, card.suit);
          let overtakeChance;
          if (vals.length) {
            const beaters = vals.filter(v => v > card.value).length;
            overtakeChance = beaters / vals.length;
          } else {
            overtakeChance = Math.max(0.04, Math.min(0.96, (14 - card.value) / 12));
          }

          // Players between the target and the downstream Bondi can also follow
          // and overtake the target. If they are publicly known to hold this suit,
          // temper the trap bonus because target-as-recipient is less certain.
          let interference = 1;
          for (let j = targetPos + 1; j < downstreamOrder.length; j++) {
            const x = downstreamOrder[j];
            if (definitelyVoid(x, card.suit)) break;
            if (definitelyHas(x, card.suit)) interference *= 0.72;
            else interference *= 0.9;
          }

          const targetBenefit = n === 1 ? 7600 : n === 2 ? 4300 : 2100;
          const trapValue = targetBenefit * followConfidence * overtakeChance * interference;
          // If the target is likely to follow but is unlikely to overtake the
          // leader, the later Bondi becomes actively harmful: the near-finisher
          // sheds a card while somebody else (often this AI) takes the Aiy.
          const failedTrapCost = targetBenefit * followConfidence * (1 - overtakeChance) * 0.9;
          score += downstreamDanger + failedTrapCost - trapValue;
        }
        return Math.round(score);
      }

      // Stage 3.12: response-aware Aiy simulation. Stage 3.11 could see a
      // downstream Bondi pattern but was too optimistic about the near-finisher
      // cooperating by playing high. This layer assumes a near-finisher will
      // choose the response that best helps them escape whenever such a response
      // is still plausible from public information. It also respects the most
      // important sequencing rule: the FIRST Bondi ends the Aiy immediately, so
      // no player after that point can participate in the trap.
      function possibleSuitValues(x, suit) {
        if (definitelyVoid(x, suit)) return [];
        const info = publicHandInfo(x);
        const deck = createDeck();
        const byId = new Map(deck.map(c => [c.id, c]));
        const values = new Set(info.knownCards.filter(c => c.suit === suit).map(c => byId.get(c.id)).filter(Boolean).map(c => c.value));
        if (info.complete) return Array.from(values).sort((a,b)=>a-b);

        // Over-approximate hidden possibilities rather than peeking at the real
        // Aiybai. Cards already gone from play, cards in this AI's Aiybai, and
        // cards publicly known to belong to another player cannot be hidden in
        // this opponent's Aiybai. Everything else remains a legitimate
        // possibility, which makes the simulation deliberately conservative.
        const unavailable = new Set(ownIds);
        for (const id of revealedIds) unavailable.add(id);
        for (const [owner, ids] of Object.entries(publicHeld)) {
          if (Number(owner) === x.i) continue;
          for (const id of (ids || [])) unavailable.add(id);
        }
        for (const c of deck) {
          if (c.suit !== suit) continue;
          if (unavailable.has(c.id)) continue;
          values.add(c.value);
        }
        return Array.from(values).sort((a,b)=>a-b);
      }
      function responseAwareAiyScore(card) {
        if (activeOpponents.length < 2 || !downstreamOrder.length) return 0;
        const suit = card.suit;
        let score = 0;

        // The first confirmed void in seat order is the first certain Bondi.
        // Any supposed trap involving a player after this point is impossible.
        const firstVoidPos = downstreamOrder.findIndex(x => definitelyVoid(x, suit));
        if (firstVoidPos >= 0) {
          const firstVoid = downstreamOrder[firstVoidPos];
          const n = firstVoid.p.hand.length;
          // A near-finisher who is the first Bondi player simply sheds a card.
          // One-card players finish immediately, so this is especially bad.
          score += n === 1 ? 18000 : n === 2 ? 5200 : n === 3 ? 1700 : 120;
        }

        for (let targetPos = 0; targetPos < downstreamOrder.length; targetPos++) {
          const target = downstreamOrder[targetPos];
          const n = target.p.hand.length;
          if (n > 3 || definitelyVoid(target, suit)) continue;

          // A downstream-Bondi trap is only structurally possible when the
          // target acts BEFORE the first confirmed Bondi player.
          if (firstVoidPos < 0 || firstVoidPos <= targetPos) continue;

          let followConfidence = 0.22;
          if (definitelyHas(target, suit)) followConfidence = 1;
          else {
            const rf = recentFollowStrength(target.i, suit);
            if (rf) followConfidence = Math.min(0.82, 0.34 + rf * 0.035);
          }
          if (followConfidence < 0.3) continue;

          // Conservatively estimate the highest card that may already be on the
          // table before the target acts. A publicly-known or still-plausible
          // higher card from an intervening player makes it easier for the
          // near-finisher to duck underneath instead of taking control.
          let currentHigh = card.value;
          for (let j = 0; j < targetPos; j++) {
            const before = downstreamOrder[j];
            if (definitelyVoid(before, suit)) break;
            const vals = possibleSuitValues(before, suit);
            if (vals.length) currentHigh = Math.max(currentHigh, Math.max(...vals));
          }

          const possible = possibleSuitValues(target, suit);
          if (!possible.length) continue;
          const losing = possible.filter(v => v < currentHigh);
          const winning = possible.filter(v => v > currentHigh);
          const targetBenefit = n === 1 ? 8200 : n === 2 ? 4700 : 2300;

          // Strategic response assumption: if a losing follow card is still
          // plausible, the near-finisher can choose it and avoid becoming the
          // highest original-suit player. Do not count the later Bondi as a trap.
          if (losing.length) {
            score += Math.round(targetBenefit * followConfidence * 0.95);
            if (n === 1 && publicHandInfo(target).complete) score += 10000;
            continue;
          }

          // If we cannot establish a plausible winning response, there is no
          // reliable trap to simulate.
          if (!winning.length) continue;
          const targetPlay = Math.min(...winning); // rational lowest winning card

          // Even after the target takes the lead, an intervening player may be
          // able to overtake them before the first Bondi. If that is plausible,
          // the target would not receive the interrupted Aiy; for a one-card
          // target, being overtaken means they finish before the Bondi resolves.
          let canBeOvertaken = false;
          for (let j = targetPos + 1; j < firstVoidPos; j++) {
            const between = downstreamOrder[j];
            if (possibleSuitValues(between, suit).some(v => v > targetPlay)) {
              canBeOvertaken = true;
              break;
            }
          }
          if (canBeOvertaken) {
            score += Math.round(targetBenefit * followConfidence * (n === 1 ? 1.7 : 0.8));
            continue;
          }

          // Robust trap: the target cannot plausibly duck below the current high,
          // is likely to follow, and no intervening player is plausibly able to
          // overtake before the first confirmed Bondi. Reward this setup.
          score -= Math.round(targetBenefit * followConfidence * 0.9);
        }
        return score;
      }
      function combinedSeatAwareScore(card) {
        return seatAwareEndgameScore(card) + responseAwareAiyScore(card);
      }

      // Stage 3.10: heads-up strategy mode. With only two active players,
      // leading a suit the opponent is confirmed void in guarantees that any
      // Bondi comes straight back to the leader. That lets the opponent shed a
      // card while the leader takes the Aiy, so avoid such suits whenever any
      // plausible follow suit exists. Publicly known held cards are the
      // strongest safe signal; recent successful follows are weaker evidence.
      function headsUpLeadScore(card, opponent) {
        const voided = definitelyVoid(opponent, card.suit);
        const hasPublic = definitelyHas(opponent, card.suit);
        const repeats = repeatFeedCount(card.suit, opponent.i);
        let score = 0;
        if (voided) score += 100000;
        if (hasPublic) score -= 12000;

        // Recent legal follows show that the opponent has held this suit before.
        // This is only weak evidence because they may have since exhausted it.
        const seen = state.aiMemory && state.aiMemory.seenPlays ? state.aiMemory.seenPlays : [];
        let recentFollowEvidence = 0;
        for (let i = seen.length - 1, age = 0; i >= 0 && age < 20; i--, age++) {
          const play = seen[i];
          if (play.playerIndex !== opponent.i || !play.card || play.bondi) continue;
          if (play.card.suit === card.suit && play.leadSuit === card.suit) {
            recentFollowEvidence += Math.max(1, 8 - Math.floor(age / 3));
          }
        }
        score -= recentFollowEvidence * 90;

        // A repeated heads-up conveyor is especially harmful.
        score += repeats * repeats * 7000;
        if (harmfulRepeat(card.suit)) score += 9000;
        if (state.lastResolution && state.lastResolution.type === 'bondi' && state.lastResolution.leadSuit === card.suit) score += 15000;

        // Preserve a useful blocking suit when possible so the AI can keep
        // forcing follow on later Aiy instead of spending its only card now.
        if (!voided && counts[card.suit] === 1) score += 260;
        else if (!voided && counts[card.suit] >= 2) score -= 120;

        // If neither suit is known, prefer the one the opponent is statistically
        // more likely to hold from the remaining public card pool.
        if (!voided && !hasPublic) {
          const suitCounts = unseenSuitCountsFor(opponent);
          const total = Object.values(suitCounts).reduce((a,b) => a+b, 0);
          const pFollow = total ? suitCounts[card.suit] / total : 0;
          score += Math.round((1 - pFollow) * 800);
        }
        return score;
      }

      // Stage 3.16: heads-up hard void lock. In true heads-up play there is no
      // downstream player who can interrupt the Aiy before the opponent acts.
      // If the opponent is definitely void in a candidate lead suit, that lead
      // guarantees an immediate Bondi. Remove such leads completely whenever
      // at least one plausible follow suit remains. This hard filter runs BEFORE
      // the general Stage 3.15 follow-chain ranking so another scoring objective
      // cannot revive a confirmed heads-up conveyor. If every suit is confirmed
      // void, no strategy can prevent the immediate Bondi; leave all candidates
      // available and let the damage-control scorer choose among them.
      if (activeOpponents.length === 1) {
        const huOpponent = activeOpponents[0];
        const huNonVoid = sorted.filter(c => !definitelyVoid(huOpponent, c.suit));
        if (huNonVoid.length) sorted = huNonVoid;
      }

      // Stage 3.15: confirmed follow-chain gate. Stage 3.14 only classified a
      // candidate as "dangerous" or "safe". That breaks down when every suit
      // exposes some near-finisher: for example, a direct Bondi to a three-card
      // player may be less costly than letting a one-card player later in the
      // Aiy reach a confirmed void and finish. Walk the actual seat order, stop
      // at the first Bondi, and rank the reachable escape by severity.
      //
      // Publicly-known held cards make a follow certain. Unknown hands continue
      // the chain probabilistically using only public information; hidden cards
      // are never inspected. A confirmed follow-chain into a 1-card void is the
      // strongest emergency, then 2 cards, then 3 cards.
      function estimatedFollowProbability(x, suit) {
        if (definitelyHas(x, suit)) return 1;
        if (definitelyVoid(x, suit)) return 0;
        const info = publicHandInfo(x);
        const hiddenSlots = Math.max(0, x.p.hand.length - info.knownCards.length);
        if (hiddenSlots <= 0) return 0;
        const suitCounts = unseenSuitCountsFor(x);
        const total = Object.values(suitCounts).reduce((a,b) => a+b, 0);
        if (!total) return 0;
        const pSingle = suitCounts[suit] / total;
        let pFollow = 1 - Math.pow(1 - pSingle, hiddenSlots);
        const rf = recentFollowStrength(x.i, suit);
        if (rf) pFollow = Math.max(pFollow, Math.min(0.88, 0.38 + rf * 0.035));
        return Math.max(0, Math.min(1, pFollow));
      }
      function nearFinishEscapeBase(n) {
        // Stage 3.17: the table-wide endgame starts before a player reaches
        // the old 1-3 card emergency band. Four- and five-card opponents are
        // still recoverable, but repeatedly feeding them Bondi can create an
        // unavoidable two-threat finish a few Aiy later.
        return n === 1 ? 12000 : n === 2 ? 7000 : n === 3 ? 3500
          : n === 4 ? 1600 : n === 5 ? 700 : 0;
      }
      function recentConveyorFeedCount(opponentIndex) {
        let count = 0;
        let inspected = 0;
        for (let i = history.length - 1; i >= 0 && inspected < 10; i--, inspected++) {
          const h = history[i];
          if (h.recipientIndex === playerIndex && h.bondiPlayerIndex === opponentIndex) count++;
          // A Bondi taken by somebody else breaks this AI's self-growth conveyor.
          else if (h.recipientIndex !== playerIndex && count) break;
        }
        return count;
      }
      function followChainDanger(card) {
        let reachProbability = 1;
        let allPriorConfirmed = true;
        let hardSeverity = 0;
        let expectedRisk = 0;
        let firstEmergencyIndex = null;

        for (const x of downstreamOrder) {
          const n = x.p.hand.length;
          if (definitelyVoid(x, card.suit)) {
            if (n <= 3) {
              const base = nearFinishEscapeBase(n);
              const conveyor = recentConveyorFeedCount(x.i);
              const conveyorPenalty = conveyor * (n <= 3 ? 2200 : n <= 5 ? 900 : 200);
              expectedRisk += reachProbability * (base + conveyorPenalty);
              if (allPriorConfirmed) hardSeverity = 4 - n; // 1-card=3, 2-card=2, 3-card=1
              firstEmergencyIndex = x.i;
            }
            // The first Bondi ends the Aiy; nobody after this player matters.
            break;
          }

          if (definitelyHas(x, card.suit)) continue;

          // Unknown: this player may be void and end the Aiy here. If they are
          // themselves near finishing, account for that escape risk; otherwise
          // only the probability of reaching later seats changes.
          const pFollow = estimatedFollowProbability(x, card.suit);
          if (n <= 5) {
            const conveyor = recentConveyorFeedCount(x.i);
            const conveyorPenalty = conveyor * (n <= 3 ? 1500 : 600);
            expectedRisk += reachProbability * (1 - pFollow) * (nearFinishEscapeBase(n) + conveyorPenalty);
          }
          reachProbability *= pFollow;
          allPriorConfirmed = false;
          if (reachProbability < 0.03) break;
        }
        return { hardSeverity, expectedRisk, firstEmergencyIndex };
      }

      const followProfiles = sorted.map(card => ({ card, risk: followChainDanger(card) }));
      const followChainRiskById = new Map(followProfiles.map(x => [x.card.id, x.risk]));
      if (followProfiles.length) {
        // First keep the least severe CONFIRMED escape route. This is the key
        // Stage 3.15 fix when every available suit is dangerous: a 3-card Bondi
        // is preferable to handing a reachable one-card opponent a guaranteed
        // finish. Unknown follow chains remain a soft risk signal so they do not
        // override a stronger seat-aware plan by themselves.
        const minHard = Math.min(...followProfiles.map(x => x.risk.hardSeverity));
        const maxHard = Math.max(...followProfiles.map(x => x.risk.hardSeverity));
        if (maxHard > minHard) {
          sorted = followProfiles.filter(x => x.risk.hardSeverity === minHard).map(x => x.card);
        }
      }
      function followChainSoftRisk(card) {
        const r = followChainRiskById.get(card.id);
        return r ? r.expectedRisk : 0;
      }
      function chainAwareLeadRisk(card) {
        // Unknown follow-chain risk is deliberately soft. Confirmed emergencies
        // were already handled above; this only nudges close strategic choices.
        return leadRisk(card) + followChainSoftRisk(card) * 0.02;
      }

      // Stage 3.17: multi-threat endgame lock. When two or more opponents are
      // already within five cards, compare the whole table before falling back
      // to offensive targeting. Confirmed 1-3 card escapes remain lexicographic
      // hard dangers; repeated self-growth conveyors into 4-5 card opponents
      // are now strong enough to be rejected when a materially safer lead is
      // available. If every lead is bad, keep the least damaging set rather
      // than pretending a Bondi can be prevented.
      const nearTable = activeOpponents.filter(x => x.p.hand.length <= 5);
      const criticalTable = activeOpponents.filter(x => x.p.hand.length <= 3);
      const hasEstablishedConveyor = nearTable.some(x => recentConveyorFeedCount(x.i) >= 2);
      const multiThreatEndgame = nearTable.length >= 2 && (criticalTable.length >= 2 || hasEstablishedConveyor);
      if (multiThreatEndgame && sorted.length > 1) {
        const profiles = sorted.map(card => ({ card, risk: followChainRiskById.get(card.id) || followChainDanger(card) }));
        const minHard = Math.min(...profiles.map(x => x.risk.hardSeverity));
        const hardPool = profiles.filter(x => x.risk.hardSeverity === minHard);
        const minExpected = Math.min(...hardPool.map(x => x.risk.expectedRisk));
        // Keep a small tolerance so ordinary rank/suit strategy can break true
        // ties, but cut off materially worse conveyor choices.
        const tolerance = minExpected < 2500 ? 900 : Math.max(1200, minExpected * 0.22);
        const safer = hardPool.filter(x => x.risk.expectedRisk <= minExpected + tolerance).map(x => x.card);
        if (safer.length && safer.length < sorted.length) sorted = safer;
      }

      // Stage 3.13 immediate-next gate is retained as a regression guard. The
      // Stage 3.14 reachable filter above is broader, so in most cases this is
      // now already satisfied before reaching this block.
      const immediateNextIndex = nextActive(state, playerIndex);
      const immediateNextThreat = activeOpponents.find(x => x.i === immediateNextIndex && x.p.hand.length <= 3);
      if (immediateNextThreat) {
        const immediateSafe = sorted.filter(c => !definitelyVoid(immediateNextThreat, c.suit));
        if (immediateSafe.length && immediateSafe.length < sorted.length) {
          if (activeOpponents.length === 1) {
            return immediateSafe.slice().sort((a,b) =>
              headsUpLeadScore(a, immediateNextThreat) - headsUpLeadScore(b, immediateNextThreat)
              || leadRisk(a) - leadRisk(b)
              || a.value - b.value
            )[0];
          }
          return immediateSafe.slice().sort((a,b) => {
            const ea = endgameRisk(a), eb = endgameRisk(b);
            const sa = combinedSeatAwareScore(a), sb = combinedSeatAwareScore(b);
            return ea.hardEscapes - eb.hardEscapes
              || (ea.score + sa) - (eb.score + sb)
              || chainAwareLeadRisk(a) - chainAwareLeadRisk(b)
              || a.value - b.value;
          })[0];
        }
      }

      if (activeOpponents.length === 1) {
        const opponent = activeOpponents[0];
        const nonVoid = sorted.filter(c => !definitelyVoid(opponent, c.suit));
        const pool = nonVoid.length ? nonVoid : sorted;
        return pool.slice().sort((a,b) =>
          headsUpLeadScore(a, opponent) - headsUpLeadScore(b, opponent)
          || leadRisk(a) - leadRisk(b)
          || a.value - b.value
        )[0];
      }
      function hasFinalCardEvidence(x) {
        if (x.p.hand.length !== 1) return false;
        const voids = knownVoids[x.p.id] || knownVoids[x.i] || [];
        const held = publicHeld[x.p.id] || publicHeld[x.i] || [];
        if (voids.length || held.length) return true;
        // Card-count inference only becomes actionable once enough of the deck
        // has been publicly revealed and the remaining suit distribution is
        // meaningfully uneven. Otherwise keep the established Hard strategy.
        if (revealedIds.size < 20) return false;
        const cs = unseenSuitCountsFor(x);
        const vals = Object.values(cs);
        return Math.max(...vals) - Math.min(...vals) >= 3;
      }
      const finalCardThreat = activeOpponents.some(hasFinalCardEvidence);
      if (finalCardThreat) {
        // Final-card containment outranks normal Hard-AI strategy. We first
        // avoid confirmed Bondi finishes, then prefer exact known-follow suits,
        // then use card-count inference for still-hidden last cards.
        return sorted.slice().sort((a,b) => {
          const fa = finalCardContainmentRisk(a), fb = finalCardContainmentRisk(b);
          const ea = endgameRisk(a), eb = endgameRisk(b);
          // Protect the whole table state first: a known safe final-card suit
          // must not revive an older conveyor that is rapidly emptying another
          // near-finisher. Then use final-card evidence to break close calls.
          const sa = combinedSeatAwareScore(a), sb = combinedSeatAwareScore(b);
          return ea.hardEscapes - eb.hardEscapes
            || (ea.score + sa) - (eb.score + sb)
            || fa.hardEscapes - fb.hardEscapes
            || fb.knownFollows - fa.knownFollows
            || fa.unknownEscapes - fb.unknownEscapes
            || fa.probabilityRisk - fb.probabilityRisk
            || chainAwareLeadRisk(a) - chainAwareLeadRisk(b)
            || a.value - b.value;
        })[0];
      }

      const endgameThreat = activeOpponents.some(x => {
        if (x.p.hand.length > 2) return false;
        const voids = knownVoids[x.p.id] || knownVoids[x.i] || [];
        const held = publicHeld[x.p.id] || publicHeld[x.i] || [];
        return voids.length > 0 || held.length > 0;
      });
      if (endgameThreat) {
        // Hard safety layer: first minimize the number of 1–2 card players who
        // are definitely given a Bondi escape. Only then use softer strategy.
        return sorted.slice().sort((a,b) => {
          const ra = endgameRisk(a), rb = endgameRisk(b);
          const sa = combinedSeatAwareScore(a), sb = combinedSeatAwareScore(b);
          return ra.hardEscapes - rb.hardEscapes || (ra.score + sa) - (rb.score + sb) || chainAwareLeadRisk(a) - chainAwareLeadRisk(b) || a.value - b.value;
        })[0];
      }
      const seriousThreat = activeOpponents.some(x => x.p.hand.length <= 4 && (knownVoids[x.p.id] || knownVoids[x.i] || []).length > 0);
      if (seriousThreat) {
        return sorted.slice().sort((a,b) => combinedSeatAwareScore(a) - combinedSeatAwareScore(b) || chainAwareLeadRisk(a) - chainAwareLeadRisk(b) || a.value - b.value)[0];
      }

      const seatAwareThreat = activeOpponents.some(x => x.p.hand.length <= 3);
      if (seatAwareThreat) {
        const seatScores = sorted.map(c => ({card:c, score:combinedSeatAwareScore(c)}));
        const bestSeat = Math.min(...seatScores.map(x => x.score));
        // Only let this layer override ordinary Hard strategy when there is a
        // meaningful downstream-Bondi opportunity or danger signal.
        if (bestSeat <= -450 || seatScores.some(x => x.score >= 5000)) {
          return seatScores.slice().sort((a,b) => a.score - b.score || chainAwareLeadRisk(a.card) - chainAwareLeadRisk(b.card) || a.card.value - b.card.value)[0].card;
        }
      }

      const safeTargeted = sorted.filter(c => targetSuits.has(c.suit) && !harmfulRepeat(c.suit));
      if (safeTargeted.length) return safeTargeted.sort((a,b) => a.value - b.value || counts[a.suit] - counts[b.suit])[0];

      // Otherwise build power by working toward another empty suit. A suit that
      // just made this AI collect the Aiy while an opponent shed a card is a
      // strongly bad repeat; use another suit whenever one exists.
      const candidates = sorted.filter(c => !harmfulRepeat(c.suit));
      const pool = candidates.length ? candidates : sorted;
      return pool.slice().sort((a,b) => counts[a.suit] - counts[b.suit] || a.value - b.value)[0];
    }

    const following = moves[0].suit === state.leadSuit;
    if (following) {
      const high = highestLeadCard(state.trick, state.leadSuit);
      const winning = sorted.filter(c => !high || c.value > high.card.value);
      if (level === 'medium') return winning[0] || sorted[0];
      return winning[0] || sorted[sorted.length - 1];
    }

    // No lead suit: every legal move creates Bondi.
    // BONDI strategy rule: once a suit is chosen for the Bondi, give the highest
    // value card from that suit. Suit choice can still be strategic.
    const suitsAvailable = [...new Set(moves.map(c => c.suit))];
    const highestInSuit = suit => moves.filter(c => c.suit === suit).sort((a,b) => b.value - a.value)[0];

    if (level === 'medium') {
      // Medium keeps its simple short-suit preference, then uses the highest
      // card in that selected suit.
      const chosenSuit = suitsAvailable.slice().sort((a,b) => counts[a] - counts[b] || SUITS.indexOf(a) - SUITS.indexOf(b))[0];
      return highestInSuit(chosenSuit);
    }

    // Hard AI chooses which suit to shed contextually, but the actual Bondi
    // card is always the highest card in that selected suit.
    function bondiSuitScore(suit) {
      const suitCards = hand.filter(c => c.suit === suit);
      const candidate = highestInSuit(suit);
      const remaining = suitCards.filter(c => c.id !== candidate.id);
      let score = 0;
      if (remaining.length === 0) score += 120;       // creates a new empty suit now
      else if (remaining.length === 1) score += 55;   // one card away from empty
      else if (remaining.length === 2) score += 24;
      score += Math.max(0, 12 - remaining.length * 3);
      score += candidate.value * 1.2;
      return score;
    }
    const chosenSuit = suitsAvailable.slice().sort((a,b) => bondiSuitScore(b) - bondiSuitScore(a) || counts[a] - counts[b])[0];
    return highestInSuit(chosenSuit);
  }

  // Stage 4: unified strategic layer for Hard AI.
  // The earlier Stage 3 heuristics remain as a tactical baseline, but Hard now
  // builds one public-information model of the table and uses it to compare
  // complete lead candidates. Endgame danger, Bondi conveyors, final-card
  // containment and seat reachability are evaluated together instead of as
  // independent override blocks.
  function buildStrategicModel(state, playerIndex) {
    const memory = state.aiMemory || {};
    const knownVoids = memory.knownVoids || {};
    const publicHeld = memory.publicHeldCards || {};
    const seen = memory.seenPlays || [];
    const history = memory.bondiHistory || [];
    const self = state.players[playerIndex];
    const opponents = state.players.map((p,i)=>({p,i})).filter(x=>x.i!==playerIndex && x.p.status==='active' && x.p.hand.length>0);
    const revealed = new Set(seen.map(x=>x.card && x.card.id).filter(Boolean));
    const own = new Set(self.hand.map(c=>c.id));

    function publicCards(x) {
      const ids = publicHeld[x.p.id] || publicHeld[x.i] || [];
      return ids.map(id => {
        const suit = SUITS.find(s=>id.endsWith(s));
        const rank = suit ? id.slice(0,-suit.length) : null;
        return suit ? {id,suit,rank,value:VALUES[rank]} : null;
      }).filter(Boolean);
    }
    function definitelyVoid(x,suit) {
      if ((knownVoids[x.p.id] || knownVoids[x.i] || []).includes(suit)) return true;
      const pc = publicCards(x);
      if (pc.length === x.p.hand.length && !pc.some(c=>c.suit===suit)) return true;
      if (x.i !== 0) {
        for (let i=seen.length-1;i>=0;i--) {
          const play=seen[i];
          if (play.playerIndex!==x.i || !play.card) continue;
          if (!play.bondi && play.leadSuit===suit && play.card.suit===suit) break;
          if (play.bondi && play.card.suit===suit && play.card.value===2) return true;
        }
      }
      return false;
    }
    function definitelyHas(x,suit) { return publicCards(x).some(c=>c.suit===suit); }
    function unseenSuitCounts(x) {
      const out=Object.fromEntries(SUITS.map(s=>[s,0]));
      const voids=new Set(knownVoids[x.p.id] || knownVoids[x.i] || []);
      for (const c of createDeck()) {
        if (own.has(c.id) || revealed.has(c.id) || voids.has(c.suit)) continue;
        out[c.suit]++;
      }
      return out;
    }
    function followProbability(x,suit) {
      if (definitelyVoid(x,suit)) return 0;
      if (definitelyHas(x,suit)) return 1;
      const pc=publicCards(x);
      const slots=Math.max(0,x.p.hand.length-pc.length);
      if (!slots) return 0;
      const sc=unseenSuitCounts(x), total=Object.values(sc).reduce((a,b)=>a+b,0);
      let p=total ? 1-Math.pow(1-(sc[suit]/total),slots) : 0;
      // Recent legal follows are useful but deliberately decay quickly.
      let strength=0;
      for (let i=seen.length-1,age=0;i>=0 && age<24;i--,age++) {
        const z=seen[i];
        if (z.playerIndex===x.i && !z.bondi && z.leadSuit===suit && z.card && z.card.suit===suit) {
          strength=Math.max(strength, Math.max(1,8-Math.floor(age/3)));
          break;
        }
      }
      if (strength) p=Math.max(p,Math.min(.88,.36+strength*.045));
      return Math.max(0,Math.min(1,p));
    }
    function conveyorCount(opponentIndex,suit=null) {
      let n=0, inspected=0;
      for (let i=history.length-1;i>=0 && inspected<12;i--,inspected++) {
        const h=history[i];
        if (h.recipientIndex===playerIndex && h.bondiPlayerIndex===opponentIndex && (!suit || h.leadSuit===suit)) n++;
        else if (n && h.recipientIndex!==playerIndex) break;
      }
      return n;
    }
    function orderAfterLeader() {
      const arr=[];
      for (let step=1;step<state.players.length;step++) {
        const i=(playerIndex+step)%state.players.length;
        const p=state.players[i];
        if (p.status==='active' && p.hand.length>0) arr.push({p,i});
      }
      return arr;
    }
    return {self,opponents,knownVoids,publicCards,definitelyVoid,definitelyHas,followProbability,conveyorCount,order:orderAfterLeader(),history};
  }

  function strategicThreatValue(n) {
    if (n<=1) return 24000;
    if (n===2) return 12500;
    if (n===3) return 6500;
    if (n===4) return 2800;
    if (n===5) return 1200;
    if (n<=7) return 350;
    return 70;
  }

  // Stage 4.1: simulate how many one-card opponents can escape before the
  // first Bondi terminates this Aiy. This is deliberately public-information
  // only: followProbability comes from confirmed voids, publicly held cards,
  // recent follows and unseen-card estimates. A one-card opponent who reaches
  // their turn is counted as a potential finisher whether they follow or give
  // Bondi; the difference is that Bondi stops the Aiy and protects later seats
  // from also escaping in the same sequence.
  function strategicTerminalProfile(state, playerIndex, card, model) {
    let branches=[{prob:1,finishers:0,stopped:false}];
    for (const x of model.order) {
      const next=[];
      const pFollow=model.followProbability(x,card.suit);
      const pBondi=1-pFollow;
      for (const branch of branches) {
        if (branch.stopped) { next.push(branch); continue; }
        const escape=x.p.hand.length===1 ? 1 : 0;
        if (pFollow>0) next.push({prob:branch.prob*pFollow,finishers:branch.finishers+escape,stopped:false});
        if (pBondi>0) next.push({prob:branch.prob*pBondi,finishers:branch.finishers+escape,stopped:true});
      }
      branches=next.filter(b=>b.prob>1e-9);
    }
    const total=branches.reduce((n,b)=>n+b.prob,0)||1;
    const expectedFinishers=branches.reduce((n,b)=>n+b.prob*b.finishers,0)/total;
    const multiFinishProbability=branches.reduce((n,b)=>n+(b.finishers>=2?b.prob:0),0)/total;
    const anyFinishProbability=branches.reduce((n,b)=>n+(b.finishers>=1?b.prob:0),0)/total;
    const maxLikelyFinishers=branches.reduce((m,b)=>b.prob>=.025?Math.max(m,b.finishers):m,0);
    return {expectedFinishers,multiFinishProbability,anyFinishProbability,maxLikelyFinishers};
  }

  function strategicLeadScore(state, playerIndex, card, model, legacyPick) {
    const self=model.self;
    const ownSuitCount=self.hand.filter(c=>c.suit===card.suit).length;
    let score=card.value*.45 + ownSuitCount*5;
    let reach=1;
    let firstBondi=false;

    // Keep a small tactical prior so ordinary positions retain the successful
    // Stage 3 play style, while table danger can overwhelm it.
    if (legacyPick && legacyPick.id===card.id) score-=2500;
    if (state.lastResolution && state.lastResolution.type==='bondi' && state.lastResolution.leadSuit===card.suit) score+=450;

    for (const x of model.order) {
      const n=x.p.hand.length;
      const threat=strategicThreatValue(n);
      const pFollow=model.followProbability(x,card.suit);
      const pBondi=1-pFollow;
      const conveyor=model.conveyorCount(x.i,card.suit);

      // Expected escape risk is evaluated at the point the player is reached.
      // Confirmed void near-finishers become effectively hard constraints.
      score += reach*pBondi*threat;
      score += reach*pBondi*conveyor*conveyor*(n<=3?2600:n<=5?900:180);
      if (model.definitelyVoid(x,card.suit) && n<=3) score += 40000 + (4-n)*22000;
      if (model.definitelyHas(x,card.suit) && n<=3) score -= threat*.75;

      // A one-card player's most likely follow suit is the central containment
      // question. Probability matters even when the exact card is not public.
      if (n===1) score += (1-pFollow)*10000 - pFollow*4500;

      if (pBondi>=.999) { firstBondi=true; break; }
      reach*=pFollow;
      if (reach<.025) break;
    }

    // When several opponents are close, minimize the worst table outcome rather
    // than pursuing a profitable Bondi against a safer opponent.
    const near=model.opponents.filter(x=>x.p.hand.length<=5);
    if (near.length>=2) {
      for (const x of near) {
        const pBondi=1-model.followProbability(x,card.suit);
        score += pBondi*strategicThreatValue(x.p.hand.length)*.55;
      }
    }

    // If nobody is in immediate danger, retain the useful BONDI principle of
    // working a shorter suit toward empty and occasionally targeting a known
    // void in a player who is not close to finishing.
    if (!model.opponents.some(x=>x.p.hand.length<=5)) {
      score += ownSuitCount*18;
      for (const x of model.opponents) {
        if (model.definitelyVoid(x,card.suit) && x.p.hand.length>=6) score-=220;
      }
    }

    // Repeatedly taking cards while the same opponent sheds them is globally bad.
    for (const x of model.opponents) {
      const c=model.conveyorCount(x.i);
      if (c>=2 && model.definitelyVoid(x,card.suit)) score += c*c*1500;
    }
    return score;
  }

  function chooseHardStrategicCard(state, playerIndex, random=Math.random) {
    const moves=legalMoves(state,playerIndex);
    if (!moves.length) return null;
    const legacy=chooseLegacyAICard(state,playerIndex,'hard',random);
    const model=buildStrategicModel(state,playerIndex);

    if (!state.trick.length) {
      const oneCardThreats=model.opponents.filter(x=>x.p.hand.length===1).length;
      let ranked=moves.map(card=>({
        card,
        score:strategicLeadScore(state,playerIndex,card,model,legacy),
        terminal:strategicTerminalProfile(state,playerIndex,card,model)
      })).sort((a,b)=>{
        // With multiple one-card opponents, terminal sequencing outranks normal
        // tactical score. Prefer a lead whose first Bondi cuts the Aiy short
        // before a second opponent can shed their final card.
        if (oneCardThreats>=2) {
          const aCertain=a.terminal.multiFinishProbability>=.999 ? 1 : 0;
          const bCertain=b.terminal.multiFinishProbability>=.999 ? 1 : 0;
          if (aCertain!==bCertain) return aCertain-bCertain;
          if (Math.abs(a.terminal.multiFinishProbability-b.terminal.multiFinishProbability)>.02) return a.terminal.multiFinishProbability-b.terminal.multiFinishProbability;
          if (a.terminal.maxLikelyFinishers!==b.terminal.maxLikelyFinishers) return a.terminal.maxLikelyFinishers-b.terminal.maxLikelyFinishers;
          if (Math.abs(a.terminal.expectedFinishers-b.terminal.expectedFinishers)>.08) return a.terminal.expectedFinishers-b.terminal.expectedFinishers;
        }
        return a.score-b.score || a.card.value-b.card.value || SUITS.indexOf(a.card.suit)-SUITS.indexOf(b.card.suit);
      });
      // Stage 4.2: persistent conveyor breaker. Once the same opponent has
      // shed into this AI through Bondi at least twice, a lead suit that the
      // repeated giver is confirmed void in becomes a hard strategic liability.
      // If there is no one-card emergency elsewhere in the Aiy and another lead
      // reduces that confirmed conveyor exposure, keep only the least-exposed
      // candidates. This prevents a larger opponent from being used forever as
      // an Aiy cutoff while they discard card after card toward finishing.
      const allLeads=ranked.slice();
      const persistentConveyorThreats=model.opponents.filter(x=>model.conveyorCount(x.i)>=2);
      if (oneCardThreats===0 && persistentConveyorThreats.length && ranked.length>1) {
        const conveyorExposure=entry=>persistentConveyorThreats.reduce((sum,x)=>{
          const feeds=model.conveyorCount(x.i);
          return sum + (model.definitelyVoid(x,entry.card.suit) ? feeds*feeds : 0);
        },0);
        const minExposure=Math.min(...ranked.map(conveyorExposure));
        if (ranked.some(x=>conveyorExposure(x)>minExposure)) {
          ranked=ranked.filter(x=>conveyorExposure(x)===minExposure);
        }
      }
      const legacyEntry=legacy && ranked.find(x=>x.card.id===legacy.id);
      // Stage 4 is consequence-driven, not novelty-driven. The planner takes
      // control when public evidence says the tactical baseline exposes a real
      // endgame disaster or an established multi-opponent conveyor. Otherwise
      // the proven tactical choice remains the stable default.
      const near=model.opponents.filter(x=>x.p.hand.length<=5);
      const legacyHardDanger=legacy && model.opponents.some(x=>x.p.hand.length<=3 && model.definitelyVoid(x,legacy.suit));
      const establishedConveyor=persistentConveyorThreats.length>0;
      const finalCardUpgrade=legacy && model.opponents.some(x=>x.p.hand.length===1 && !model.definitelyHas(x,legacy.suit) && model.definitelyHas(x,ranked[0].card.suit));
      const legacyTerminal=legacy && strategicTerminalProfile(state,playerIndex,legacy,model);
      const multiThreatTerminalUpgrade=oneCardThreats>=2 && legacyTerminal && (
        legacyTerminal.multiFinishProbability-ranked[0].terminal.multiFinishProbability>.02 ||
        legacyTerminal.maxLikelyFinishers>ranked[0].terminal.maxLikelyFinishers ||
        legacyTerminal.expectedFinishers-ranked[0].terminal.expectedFinishers>.08
      );
      let choice=ranked[0].card;
      if (legacy && !legacyHardDanger && !establishedConveyor && !finalCardUpgrade && !multiThreatTerminalUpgrade) choice=legacy;
      else if (legacyEntry && choice.id!==legacy.id && legacyEntry.score-ranked[0].score < 1200 && !multiThreatTerminalUpgrade) choice=legacy;

      // Stage 4.3: replay-aware Bondi defense. After collecting a Bondi
      // from an opponent holding at most three cards, avoid letting them shed
      // again if their own publicly-returned cards prove a follow-suit exit.
      // Never risk a one-card opponent's escape to achieve this, and never
      // switch into another equally-or-more urgent confirmed void.
      if (oneCardThreats===0 && allLeads.length>1) {
        const feeders=model.opponents
          .filter(x=>x.p.hand.length<=3 && model.conveyorCount(x.i)>=1)
          .sort((a,b)=>a.p.hand.length-b.p.hand.length || model.conveyorCount(b.i)-model.conveyorCount(a.i));
        for(const feeder of feeders){
          if(!model.definitelyVoid(feeder,choice.suit)) continue;
          const escape=allLeads.filter(entry=>
            model.definitelyHas(feeder,entry.card.suit) &&
            !model.opponents.some(other=>other.i!==feeder.i &&
              other.p.hand.length<=feeder.p.hand.length &&
              model.definitelyVoid(other,entry.card.suit)));
          if(!escape.length) continue; // forced Bondi: do not invent a safe lead.
          // Retain the Stage 4 evaluation among verified alternatives.
          choice=escape[0].card;
          break;
        }
      }
      return choice;
    }

    const sorted=moves.slice().sort((a,b)=>a.value-b.value);
    const following=sorted[0].suit===state.leadSuit;
    if (following) {
      const high=highestLeadCard(state.trick,state.leadSuit);
      const later=[];
      for (let step=1;step<state.players.length;step++) {
        const i=(playerIndex+step)%state.players.length;
        if (state.trick.some(p=>p.playerIndex===i)) continue;
        const p=state.players[i];
        if (p.status==='active' && p.hand.length>0) later.push({p,i});
      }
      const laterConfirmedVoid=later.find(x=>model.definitelyVoid(x,state.leadSuit));
      if (laterConfirmedVoid && high) {
        // If a later Bondi is already publicly predictable, avoid unnecessarily
        // becoming the current high card and therefore the likely recipient.
        const losing=sorted.filter(c=>c.value<high.card.value);
        if (losing.length) return losing[0];
      }
      return legacy;
    }

    // Bondi itself remains constrained by the confirmed rule: after choosing a
    // suit, give the highest card in that suit. The tactical baseline already
    // does this well, so Stage 4 preserves it rather than inventing new rules.
    return legacy;
  }

  function chooseAICard(state, playerIndex, difficulty = 'easy', random = Math.random) {
    const level=String(difficulty).toLowerCase();
    if (level==='hard') return chooseHardStrategicCard(state,playerIndex,random);
    return chooseLegacyAICard(state,playerIndex,difficulty,random);
  }

    const api = { createDeck, shuffle, createGame, legalMoves, playCard, highestLeadCard, chooseAICard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BondiEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
