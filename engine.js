// Project X rules engine. Pure game logic with no DOM, shared by the browser game and the simulator.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PX = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CONFIG = {
    maxHp: 12,
    handSize: 5,
    maxCharge: 5,
    powers: [1, 2, 3, 4, 5, 6],
    chargeForHit: 2,
    chargeForMiss: 1,
    callBonus: 1,
    suddenDeathBonus: 1,
    duelSuddenDeathRound: 8,
    roundLimit: 60,
  };

  const BEATS = {
    3: { water: ['fire'], fire: ['earth'], earth: ['water'] },
    4: { water: ['fire'], fire: ['air'], air: ['earth'], earth: ['water'] },
  };

  const SUBS = {
    combustion: { name: 'Combustion', element: 'fire', cost: 2, needsTarget: false, text: 'Your next fire card deals double damage to everyone it hits.' },
    lightning: { name: 'Lightning', element: 'fire', cost: 4, needsTarget: true, amount: 3, text: 'Deal 3 damage to one player.' },
    seismic: { name: 'Seismic Sense', element: 'earth', cost: 2, needsTarget: true, text: "See one player's hand before you choose your card." },
    metal: { name: 'Metalbending', element: 'earth', cost: 5, needsTarget: false, rounds: 1, text: 'Block all damage this round.' },
    healing: { name: 'Healing', element: 'water', cost: 4, needsTarget: false, amount: 2, text: 'Heal 2 HP.' },
    bloodbending: { name: 'Bloodbending', element: 'water', cost: 4, needsTarget: true, text: "Force one of a player's face-down cards on them, chosen blind. Only you and they see it." },
    flight: { name: 'Flight', element: 'air', cost: 2, needsTarget: false, text: 'Take half damage this round.' },
    vacuum: { name: 'Vacuum', element: 'air', cost: 4, needsTarget: true, text: "One player's card deals no damage this round." },
  };

  // Fixed order for abilities locked in during the same round.
  const ABILITY_ORDER = ['metal', 'flight', 'bloodbending', 'vacuum', 'seismic', 'combustion', 'healing', 'lightning'];

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function elementsFor(count) {
    return Object.keys(BEATS[count]);
  }

  function subsFor(count) {
    const els = elementsFor(count);
    return Object.keys(SUBS).filter((k) => els.includes(SUBS[k].element));
  }

  function beats(state, a, b) {
    return BEATS[state.elementCount][a].includes(b);
  }

  // Damage card a deals to card b: 0 if it doesn't beat it, 1 if it does, 2 if it wins on element with a higher number.
  function matchupDamage(elementCount, a, b) {
    if (a.el === b.el) return a.power > b.power ? 1 : 0;
    if (!BEATS[elementCount][a.el].includes(b.el)) return 0;
    return a.power > b.power ? 2 : 1;
  }

  function buildDeck(playerIndex, elementCount, rng) {
    const deck = [];
    for (const el of elementsFor(elementCount)) {
      for (const power of CONFIG.powers) {
        deck.push({ id: `${playerIndex}-${el}-${power}`, el, power });
      }
    }
    return shuffle(deck, rng);
  }

  // Draw one card. The card just drawn is the player's face-up card.
  // If the hand holds none of the player's element, the draw is guaranteed to be that element.
  function draw(state, p) {
    if (p.deck.length === 0) {
      p.deck = shuffle(p.discard, state.rng);
      p.discard = [];
    }
    let index = p.deck.length - 1;
    if (!p.hand.some((c) => c.el === p.element)) {
      let found = p.deck.findIndex((c) => c.el === p.element);
      if (found < 0 && p.discard.length) {
        p.deck = shuffle(p.deck.concat(p.discard), state.rng);
        p.discard = [];
        found = p.deck.findIndex((c) => c.el === p.element);
      }
      if (found >= 0) index = found;
      else index = p.deck.length - 1;
    }
    const [card] = p.deck.splice(index, 1);
    p.hand.push(card);
    p.faceUpId = card.id;
  }

  function createGame({ seats, elementCount = 3, seed = Date.now() }) {
    const rng = makeRng(seed);
    const state = {
      elementCount,
      rng,
      duel: seats.length === 2,
      round: 0,
      over: false,
      winners: [],
      history: [],
      players: seats.map((seat, i) => ({
        index: i,
        name: seat.name,
        sub: seat.sub,
        element: SUBS[seat.sub].element,
        hp: CONFIG.maxHp,
        charge: 0,
        alive: true,
        shield: 0,
        callsMade: 0,
        callsKept: 0,
        primed: false,
        halved: false,
        deck: buildDeck(i, elementCount, rng),
        discard: [],
        hand: [],
        faceUpId: null,
      })),
      turn: null,
    };
    for (const p of state.players) {
      for (let i = 0; i < CONFIG.handSize - 1; i++) p.hand.push(p.deck.pop());
      draw(state, p);
    }
    beginRound(state);
    return state;
  }

  function beginRound(state) {
    state.round += 1;
    const alive = state.players.filter((p) => p.alive).length;
    // A game that starts as a duel gets a normal stretch first, because two players remain from round 1.
    const suddenDeath = alive === 2 && (!state.duel || state.round >= CONFIG.duelSuddenDeathRound);
    if (suddenDeath && !state.suddenDeathRound) state.suddenDeathRound = state.round;
    state.turn = {
      phase: 'abilities',
      suddenDeath,
      suddenDeathBonus: suddenDeath ? CONFIG.suddenDeathBonus + (state.round - state.suddenDeathRound) : 0,
      abilityChoices: {},
      publicAbilities: [],
      silenced: [],
      bolts: [],
      forced: {},
      knowledge: {},
      calls: {},
      cards: {},
      votes: {},
    };
  }

  function canUseAbility(state, i) {
    const p = state.players[i];
    return p.alive && state.turn.phase === 'abilities' && p.charge >= SUBS[p.sub].cost;
  }

  function faceDownCards(p) {
    return p.hand.filter((c) => c.id !== p.faceUpId);
  }

  // choice: { target?: number, slot?: number }. slot is a position among the target's face-down cards.
  function submitAbility(state, i, choice) {
    if (!canUseAbility(state, i)) throw new Error(`Player ${i} cannot use an ability now`);
    const sub = SUBS[state.players[i].sub];
    if (sub.needsTarget) {
      const target = state.players[choice.target];
      if (!target || !target.alive || target.index === i) throw new Error('Choose another living player');
    }
    state.turn.abilityChoices[i] = choice;
  }

  function resolveAbilities(state) {
    const turn = state.turn;
    if (turn.phase !== 'abilities') throw new Error('Abilities already resolved');
    const queue = Object.keys(turn.abilityChoices)
      .map(Number)
      .sort((a, b) => {
        const diff = ABILITY_ORDER.indexOf(state.players[a].sub) - ABILITY_ORDER.indexOf(state.players[b].sub);
        return diff || a - b;
      });

    for (const i of queue) {
      const p = state.players[i];
      const sub = SUBS[p.sub];
      const choice = turn.abilityChoices[i];
      p.charge -= sub.cost;
      turn.publicAbilities.push({ player: i, sub: p.sub, target: sub.needsTarget ? choice.target : null });

      if (p.sub === 'metal') p.shield = sub.rounds;
      if (p.sub === 'flight') p.halved = true;
      if (p.sub === 'combustion') p.primed = true;
      if (p.sub === 'healing') p.hp = Math.min(CONFIG.maxHp, p.hp + sub.amount);
      if (p.sub === 'lightning') turn.bolts.push({ from: i, target: choice.target, amount: sub.amount });
      if (p.sub === 'vacuum') turn.silenced.push(choice.target);
      if (p.sub === 'seismic') {
        const t = state.players[choice.target];
        turn.knowledge[i] = { target: t.index, hand: t.hand.slice(), forcedId: turn.forced[t.index] || null };
      }
      if (p.sub === 'bloodbending') {
        const t = state.players[choice.target];
        if (!turn.forced[t.index]) {
          const options = faceDownCards(t);
          const slot = Math.min(Math.max(0, choice.slot || 0), options.length - 1);
          turn.forced[t.index] = options[slot].id;
        }
        const forcedCard = t.hand.find((c) => c.id === turn.forced[t.index]);
        turn.knowledge[i] = { target: t.index, hand: [forcedCard], forcedId: forcedCard.id };
      }
    }
    turn.phase = 'calls';
    for (const iText of Object.keys(turn.forced)) {
      turn.cards[iText] = turn.forced[iText];
    }
  }

  // Everyone calls an element in secret. It doesn't have to be true, and nobody sees a call until revealCalls.
  function submitCall(state, i, el) {
    if (state.turn.phase !== 'calls') throw new Error('Not the call phase');
    if (!state.players[i].alive) throw new Error('Player is out');
    if (!elementsFor(state.elementCount).includes(el)) throw new Error('Unknown element');
    state.turn.calls[i] = el;
  }

  function revealCalls(state) {
    if (state.turn.phase !== 'calls') throw new Error('Not the call phase');
    state.turn.phase = 'cards';
  }

  function submitCard(state, i, cardId) {
    const p = state.players[i];
    if (state.turn.phase !== 'cards') throw new Error('Not the card phase');
    if (!p.alive) throw new Error('Player is out');
    if (state.turn.forced[i]) return;
    if (!p.hand.some((c) => c.id === cardId)) throw new Error('Card is not in hand');
    state.turn.cards[i] = cardId;
  }

  function submitVote(state, i, el) {
    if (state.players[i].alive) throw new Error('Only eliminated players vote');
    if (!elementsFor(state.elementCount).includes(el)) throw new Error('Unknown element');
    state.turn.votes[i] = el;
  }

  function spiritElement(state) {
    const tally = {};
    for (const el of Object.values(state.turn.votes)) tally[el] = (tally[el] || 0) + 1;
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
    return entries[0][0];
  }

  function resolveRound(state) {
    const turn = state.turn;
    if (turn.phase !== 'cards') throw new Error('Not the card phase');
    const living = state.players.filter((p) => p.alive);
    for (const p of living) {
      if (!turn.cards[p.index]) throw new Error(`Player ${p.index} has not played a card`);
    }

    const bonus = spiritElement(state);
    const plays = living.map((p) => {
      const card = p.hand.find((c) => c.id === turn.cards[p.index]);
      let power = card.power + (bonus === card.el ? 1 : 0);
      const doubled = p.primed && card.el === 'fire';
      return { player: p.index, card, power, doubled, silenced: turn.silenced.includes(p.index) };
    });

    const report = {
      round: state.round,
      suddenDeath: turn.suddenDeath,
      suddenDeathBonus: turn.suddenDeathBonus,
      spirit: bonus,
      abilities: turn.publicAbilities.slice(),
      calls: { ...turn.calls },
      plays,
      damage: {},
      hitsBy: {},
      hitsOn: {},
      damageFrom: {},
      blocked: [],
      chargeGained: {},
      eliminated: [],
    };

    // You beat a player with a winning element, or with a higher number in the same element.
    const asCard = (play) => ({ el: play.card.el, power: play.power });
    const landsOn = (a, t) => matchupDamage(state.elementCount, asCard(a), asCard(t)) > 0;

    const damageTo = (a, t) => matchupDamage(state.elementCount, asCard(a), asCard(t)) * (a.doubled ? 2 : 1);

    for (const target of plays) {
      const attackers = plays.filter((a) => !a.silenced && a.player !== target.player && landsOn(a, target));
      report.hitsOn[target.player] = attackers.map((a) => a.player);
      report.damageFrom[target.player] = attackers.map((a) => ({ player: a.player, amount: damageTo(a, target) }));
      let damage = attackers.reduce((sum, a) => sum + damageTo(a, target), 0);
      for (const bolt of turn.bolts) if (bolt.target === target.player) damage += bolt.amount;
      if (damage > 0 && turn.suddenDeath) damage += turn.suddenDeathBonus;
      const p = state.players[target.player];
      if (damage > 0 && p.shield > 0) {
        report.blocked.push(target.player);
        damage = 0;
      }
      if (p.halved) damage = Math.floor(damage / 2);
      report.damage[target.player] = damage;
    }

    for (const play of plays) {
      const p = state.players[play.player];
      const hit = !play.silenced && plays.some((o) => o.player !== play.player && landsOn(play, o));
      report.hitsBy[play.player] = hit;
      let gain = 0;
      if (play.card.el === p.element) gain = hit ? CONFIG.chargeForHit : CONFIG.chargeForMiss;
      const called = turn.calls[play.player];
      if (called) {
        p.callsMade += 1;
        if (called === play.card.el) {
          p.callsKept += 1;
          gain += CONFIG.callBonus;
        }
      }
      p.charge = Math.min(CONFIG.maxCharge, p.charge + gain);
      report.chargeGained[play.player] = gain;
    }

    const hpBefore = {};
    for (const play of plays) {
      const p = state.players[play.player];
      hpBefore[p.index] = p.hp;
      p.hp -= report.damage[play.player];
      if (p.primed && play.card.el === 'fire') p.primed = false;
      p.halved = false;
      if (p.shield > 0) p.shield -= 1;
      p.hand = p.hand.filter((c) => c.id !== play.card.id);
      p.discard.push(play.card);
    }
    for (const p of living) {
      if (p.hp <= 0) {
        p.hp = 0;
        p.alive = false;
        report.eliminated.push(p.index);
      }
    }

    const stillAlive = state.players.filter((p) => p.alive);
    state.history.push(report);

    if (stillAlive.length === 1) {
      state.over = true;
      state.winners = [stillAlive[0].index];
    } else if (stillAlive.length === 0) {
      // Everyone left fell together: the highest HP before the round wins, ties share it.
      const best = Math.max(...living.map((p) => hpBefore[p.index]));
      state.over = true;
      state.winners = living.filter((p) => hpBefore[p.index] === best).map((p) => p.index);
    } else if (state.round >= CONFIG.roundLimit) {
      const best = Math.max(...stillAlive.map((p) => p.hp));
      state.over = true;
      state.stalled = true;
      state.winners = stillAlive.filter((p) => p.hp === best).map((p) => p.index);
    }

    if (!state.over) {
      for (const p of stillAlive) draw(state, p);
      beginRound(state);
    } else {
      state.turn = null;
    }
    return report;
  }

  // What player i is allowed to know. Bots and the UI read only this, so neither can peek.
  function viewFor(state, i) {
    const me = state.players[i];
    const turn = state.turn;
    return {
      me: i,
      round: state.round,
      elementCount: state.elementCount,
      phase: turn ? turn.phase : 'over',
      suddenDeath: turn ? turn.suddenDeath : false,
      suddenDeathBonus: turn ? turn.suddenDeathBonus : 0,
      hand: me.alive ? me.hand.slice() : [],
      faceUpId: me.faceUpId,
      forcedId: turn ? turn.forced[i] || null : null,
      myCall: turn ? turn.calls[i] || null : null,
      knowledge: turn ? turn.knowledge[i] || null : null,
      abilities: turn ? turn.publicAbilities.slice() : [],
      players: state.players.map((p) => {
        const faceUp = p.hand.find((c) => c.id === p.faceUpId);
        return {
          index: p.index,
          name: p.name,
          sub: p.sub,
          element: p.element,
          hp: p.hp,
          charge: p.charge,
          alive: p.alive,
          shield: p.shield,
          primed: p.primed,
          call: turn && turn.phase === 'cards' ? turn.calls[p.index] || null : null,
          callsMade: p.callsMade,
          callsKept: p.callsKept,
          handSize: p.hand.length,
          faceDownCount: faceDownCards(p).length,
          faceUp: p.alive && faceUp ? faceUp : null,
        };
      }),
    };
  }

  return {
    CONFIG, BEATS, SUBS, ABILITY_ORDER, makeRng, shuffle, elementsFor, subsFor,
    createGame, beginRound, canUseAbility, submitAbility, resolveAbilities, submitCall, revealCalls,
    submitCard, submitVote, resolveRound, viewFor, spiritElement, beats, matchupDamage,
  };
});
