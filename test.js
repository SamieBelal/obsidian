// Rules tests. Run with: node --test test.js
const test = require('node:test');
const assert = require('node:assert');
const PX = require('./engine.js');
const { STRATEGIES, chooseVote } = require('./bots.js');

const card = (el, power, tag = '') => ({ id: `${tag}${el}-${power}`, el, power });

// Builds a game, then gives each player exact hands so outcomes are deterministic.
function game(subs, hands = [], elementCount = 3) {
  const state = PX.createGame({ seats: subs.map((sub, i) => ({ name: `P${i}`, sub })), elementCount, seed: 1 });
  hands.forEach((hand, i) => {
    state.players[i].hand = hand.map((c, n) => ({ ...c, id: `${i}:${n}:${c.id}` }));
    state.players[i].faceUpId = state.players[i].hand[hand.length - 1].id;
  });
  return state;
}

function playRound(state, picks, abilities = {}) {
  for (const [i, choice] of Object.entries(abilities)) PX.submitAbility(state, Number(i), choice);
  PX.resolveAbilities(state);
  PX.revealCalls(state);
  picks.forEach((slot, i) => {
    if (slot !== null) PX.submitCard(state, i, state.players[i].hand[slot].id);
  });
  return PX.resolveRound(state);
}

const fill = [card('fire', 1, 'a'), card('water', 1, 'b'), card('earth', 1, 'c'), card('fire', 2, 'd')];

test('each player who beats you deals 1, +1 if they won on element with a higher number', () => {
  const s = game(['lightning', 'combustion', 'seismic', 'healing'], [
    [card('fire', 5), ...fill],
    [card('fire', 2), ...fill],
    [card('earth', 4), ...fill],
    [card('water', 3), ...fill],
  ]);
  const r = playRound(s, [0, 0, 0, 0]);
  assert.deepStrictEqual(r.damage, { 0: 1, 1: 3, 2: 3, 3: 2 });
});

test('within an element, the higher number deals 1 and equal numbers deal nothing', () => {
  const s = game(['lightning', 'combustion', 'healing'], [
    [card('fire', 6), ...fill],
    [card('fire', 1), ...fill],
    [card('fire', 3), ...fill],
  ]);
  const r = playRound(s, [0, 0, 0]);
  assert.deepStrictEqual(r.damage, { 0: 0, 1: 2, 2: 1 });

  const even = game(['lightning', 'combustion', 'healing'], [
    [card('fire', 3), ...fill],
    [card('fire', 3), ...fill],
    [card('fire', 3), ...fill],
  ]);
  assert.deepStrictEqual(playRound(even, [0, 0, 0]).damage, { 0: 0, 1: 0, 2: 0 });
});

test('charge: +2 for a hit with your element, +1 for a miss, 0 for other elements', () => {
  const s = game(['lightning', 'healing', 'seismic'], [
    [card('fire', 3), ...fill],
    [card('fire', 3), ...fill],
    [card('fire', 3), ...fill],
  ]);
  let r = playRound(s, [0, 0, 0]);
  assert.deepStrictEqual(r.chargeGained, { 0: 1, 1: 0, 2: 0 });

  const t = game(['lightning', 'healing', 'seismic'], [
    [card('fire', 3), ...fill],
    [card('water', 3), ...fill],
    [card('earth', 3), ...fill],
  ]);
  r = playRound(t, [0, 0, 0]);
  assert.deepStrictEqual(r.chargeGained, { 0: 2, 1: 2, 2: 2 });
});

test('charge stops at the meter limit', () => {
  const s = game(['lightning', 'healing'], [[card('fire', 3), ...fill], [card('earth', 3), ...fill]]);
  s.players[0].charge = 4;
  playRound(s, [0, 0]);
  assert.strictEqual(s.players[0].charge, PX.CONFIG.maxCharge);
});

test('sudden death adds 1 once two players remain', () => {
  const s = game(['lightning', 'healing', 'metal'], [[card('fire', 3), ...fill], [card('earth', 3), ...fill], [card('fire', 1), ...fill]]);
  s.players[2].alive = false;
  PX.beginRound(s);
  const r = playRound(s, [0, 0, null]);
  assert.strictEqual(r.suddenDeath, true);
  assert.strictEqual(r.damage[1], 2);
});

test('a game that starts as a 1v1 only reaches sudden death at the set round, then it grows', () => {
  const s = game(['lightning', 'healing'], [[card('fire', 3), ...fill], [card('earth', 3), ...fill]]);
  let r = playRound(s, [0, 0]);
  assert.strictEqual(r.suddenDeath, false);
  assert.strictEqual(r.damage[1], 1);

  s.round = PX.CONFIG.duelSuddenDeathRound - 1;
  PX.beginRound(s);
  assert.strictEqual(s.turn.suddenDeathBonus, PX.CONFIG.suddenDeathBonus);
  PX.beginRound(s);
  assert.strictEqual(s.turn.suddenDeathBonus, PX.CONFIG.suddenDeathBonus + 1);
});

test('Lightning hits regardless of the round, and costs 4', () => {
  const s = game(['lightning', 'healing', 'seismic'], [
    [card('fire', 3), ...fill],
    [card('fire', 3), ...fill],
    [card('fire', 3), ...fill],
  ]);
  s.players[0].charge = 4;
  const r = playRound(s, [0, 0, 0], { 0: { target: 2 } });
  assert.strictEqual(r.damage[2], 3);
  assert.strictEqual(s.players[0].charge, 1, '4 spent, then +1 for playing fire without a hit');
});

test('Metalbending blocks Lightning in the same round and lasts only that round', () => {
  const s = game(['lightning', 'metal', 'healing'], [
    [card('fire', 6), card('fire', 6, 'x'), ...fill],
    [card('earth', 3), card('earth', 3, 'x'), ...fill],
    [card('fire', 1), card('fire', 1, 'x'), ...fill],
  ]);
  s.players[0].charge = 4;
  s.players[1].charge = 5;
  let r = playRound(s, [0, 0, 0], { 0: { target: 1 }, 1: {} });
  assert.strictEqual(r.damage[1], 0);
  assert.deepStrictEqual(r.blocked, [1]);
  assert.strictEqual(s.players[1].shield, 0);
});

test('Combustion doubles the next fire card against everyone it hits, then wears off', () => {
  const s = game(['combustion', 'seismic', 'metal'], [
    [card('fire', 4), card('fire', 4, 'x'), ...fill.slice(1)],
    [card('earth', 1), card('earth', 1, 'x'), ...fill.slice(1)],
    [card('earth', 1, 'y'), card('earth', 1, 'z'), ...fill.slice(1)],
  ]);
  s.players[0].charge = 2;
  const r = playRound(s, [0, 0, 0], { 0: {} });
  assert.strictEqual(r.damage[1], 4);
  assert.strictEqual(r.damage[2], 4);
  assert.strictEqual(s.players[0].primed, false);
});

test('Healing cannot go above max HP', () => {
  const s = game(['healing', 'seismic', 'metal'], [
    [card('fire', 1), ...fill],
    [card('fire', 1), ...fill],
    [card('fire', 1), ...fill],
  ]);
  s.players[0].charge = 4;
  s.players[0].hp = 11;
  playRound(s, [0, 0, 0], { 0: {} });
  assert.strictEqual(s.players[0].hp, PX.CONFIG.maxHp);
});

test('Seismic Sense reveals the hand to the user only', () => {
  const s = game(['seismic', 'healing', 'metal'], [
    [card('earth', 1), ...fill],
    [card('water', 2), ...fill],
    [card('earth', 3), ...fill],
  ]);
  s.players[0].charge = 2;
  PX.submitAbility(s, 0, { target: 1 });
  PX.resolveAbilities(s);
  PX.revealCalls(s);
  assert.strictEqual(PX.viewFor(s, 0).knowledge.hand.length, 5);
  assert.strictEqual(PX.viewFor(s, 2).knowledge, null);
});

test('Bloodbending can only pick face-down cards and only the user sees the result', () => {
  for (let slot = 0; slot < 4; slot++) {
    const s = game(['bloodbending', 'healing', 'metal'], [
      [card('water', 1), ...fill],
      [card('earth', 2), ...fill],
      [card('earth', 3), ...fill],
    ]);
    s.players[0].charge = 4;
    PX.submitAbility(s, 0, { target: 1, slot });
    PX.resolveAbilities(s);
    PX.revealCalls(s);
    const forcedId = s.turn.forced[1];
    assert.notStrictEqual(forcedId, s.players[1].faceUpId);
    assert.strictEqual(PX.viewFor(s, 0).knowledge.forcedId, forcedId);
    assert.strictEqual(PX.viewFor(s, 1).forcedId, forcedId, 'the target learns the card');
    assert.strictEqual(PX.viewFor(s, 2).knowledge, null, 'the rest of the table does not');

    PX.submitCard(s, 0, s.players[0].hand[0].id);
    PX.submitCard(s, 1, s.players[1].hand[0].id === forcedId ? s.players[1].hand[1].id : s.players[1].hand[0].id);
    PX.submitCard(s, 2, s.players[2].hand[0].id);
    const r = PX.resolveRound(s);
    assert.strictEqual(r.plays.find((p) => p.player === 1).card.id, forcedId, 'the target cannot change it');
  }
});

test('Vacuum stops a card dealing damage or counting as a hit', () => {
  const s = game(['vacuum', 'lightning', 'metal'], [
    [card('air', 1), ...fill],
    [card('fire', 6), ...fill],
    [card('fire', 1), ...fill],
  ], 4);
  s.players[0].charge = 4;
  const r = playRound(s, [0, 0, 0], { 0: { target: 1 } });
  assert.strictEqual(r.hitsBy[1], false);
  assert.strictEqual(r.damage[0], 1, 'only the other fire card hits');
});

test('with air, fire and earth ignore each other, but the higher fire still beats the lower', () => {
  const s = game(['lightning', 'seismic', 'healing'], [
    [card('fire', 6), ...fill],
    [card('earth', 6), ...fill],
    [card('fire', 1), ...fill],
  ], 4);
  const r = playRound(s, [0, 0, 0]);
  assert.deepStrictEqual(r.damage, { 0: 0, 1: 0, 2: 1 });
});

test('Spirit World: +1 power can earn the number bonus, and a tied vote adds nothing', () => {
  const setup = () => {
    const s = game(['lightning', 'seismic', 'healing', 'metal'], [
      [card('fire', 3), ...fill],
      [card('earth', 3), ...fill],
      [card('earth', 3), ...fill],
      [card('earth', 3), ...fill],
    ]);
    s.players[2].alive = false;
    s.players[3].alive = false;
    PX.resolveAbilities(s);
    PX.revealCalls(s);
    PX.submitCard(s, 0, s.players[0].hand[0].id);
    PX.submitCard(s, 1, s.players[1].hand[0].id);
    return s;
  };
  let s = setup();
  PX.submitVote(s, 2, 'fire');
  PX.submitVote(s, 3, 'fire');
  assert.strictEqual(PX.resolveRound(s).damage[1], 2);

  s = setup();
  PX.submitVote(s, 2, 'fire');
  PX.submitVote(s, 3, 'water');
  assert.strictEqual(PX.resolveRound(s).damage[1], 1);
});

test('a hand always keeps at least one card of your element', () => {
  const s = PX.createGame({ seats: ['lightning', 'seismic', 'healing'].map((sub, i) => ({ name: `P${i}`, sub })), seed: 7 });
  for (let n = 0; n < 40 && !s.over; n++) {
    PX.resolveAbilities(s);
    PX.revealCalls(s);
    for (const p of s.players) {
      if (!p.alive) continue;
      assert.ok(p.hand.some((c) => c.el === p.element), `${p.name} has no ${p.element}`);
      PX.submitCard(s, p.index, p.hand.find((c) => c.el !== p.element)?.id || p.hand[0].id);
    }
    PX.resolveRound(s);
  }
});

test('bots only see what they are allowed to: rival hands are absent from the view', () => {
  const s = PX.createGame({ seats: ['lightning', 'seismic', 'healing'].map((sub, i) => ({ name: `P${i}`, sub })), seed: 3 });
  const rival = PX.viewFor(s, 0).players[1];
  assert.strictEqual(rival.hand, undefined);
  assert.strictEqual(rival.deck, undefined);
});

function callRound(hands, calls) {
  const s = game(['lightning', 'healing', 'seismic'], hands);
  PX.resolveAbilities(s);
  calls.forEach((el, i) => PX.submitCall(s, i, el));
  return s;
}

test('a call earns +1 charge if you play it, on top of any charge for your element', () => {
  const hands = [
    [card('fire', 3), ...fill],
    [card('fire', 3), ...fill],
    [card('fire', 3), ...fill],
  ];
  const s = callRound(hands, ['fire', 'fire', 'water']);
  PX.revealCalls(s);
  s.players.forEach((p) => PX.submitCard(s, p.index, p.hand[0].id));
  const r = PX.resolveRound(s);
  assert.deepStrictEqual(r.chargeGained, { 0: 2, 1: 1, 2: 0 });
});

test('calls stay hidden until they are all revealed', () => {
  const hands = [[card('fire', 3), ...fill], [card('water', 3), ...fill], [card('earth', 3), ...fill]];
  const s = callRound(hands, ['water', 'water', 'fire']);
  assert.strictEqual(PX.viewFor(s, 1).players[0].call, null);
  assert.strictEqual(PX.viewFor(s, 0).myCall, 'water', 'you can see your own call');
  assert.throws(() => PX.submitCard(s, 0, s.players[0].hand[0].id), /Not the card phase/);
  PX.revealCalls(s);
  assert.strictEqual(PX.viewFor(s, 1).players[0].call, 'water');
});

test('every call goes on a public record of kept and broken calls', () => {
  const hands = [[card('fire', 3), ...fill], [card('fire', 3), ...fill], [card('fire', 3), ...fill]];
  const s = callRound(hands, ['fire', 'water', 'fire']);
  PX.revealCalls(s);
  s.players.forEach((p) => PX.submitCard(s, p.index, p.hand[0].id));
  PX.resolveRound(s);
  const seen = PX.viewFor(s, 2).players;
  assert.deepStrictEqual([seen[0].callsMade, seen[0].callsKept], [1, 1]);
  assert.deepStrictEqual([seen[1].callsMade, seen[1].callsKept], [1, 0]);
});

test('a bloodbent player still calls, and can lie about the forced card', () => {
  const s = game(['bloodbending', 'healing', 'metal'], [
    [card('water', 1), ...fill],
    [card('earth', 2), ...fill],
    [card('earth', 3), ...fill],
  ]);
  s.players[0].charge = 4;
  PX.submitAbility(s, 0, { target: 1, slot: 0 });
  PX.resolveAbilities(s);
  PX.submitCall(s, 1, 'fire');
  PX.revealCalls(s);
  assert.strictEqual(PX.viewFor(s, 2).players[1].call, 'fire');
});

test('full bot games always finish with a winner', () => {
  const rng = PX.makeRng(11);
  for (let g = 0; g < 500; g++) {
    const subs = PX.subsFor(3);
    const seats = Array.from({ length: 2 + (g % 5) }, (_, i) => ({ name: `P${i}`, sub: subs[Math.floor(rng() * subs.length)] }));
    const s = PX.createGame({ seats, seed: g + 1 });
    while (!s.over) {
      for (const p of s.players) {
        if (!p.alive || !PX.canUseAbility(s, p.index)) continue;
        const choice = STRATEGIES.smart.ability(PX.viewFor(s, p.index), rng);
        if (choice) PX.submitAbility(s, p.index, choice);
      }
      PX.resolveAbilities(s);
      for (const p of s.players) {
        if (p.alive) PX.submitCall(s, p.index, STRATEGIES.smart.call(PX.viewFor(s, p.index), rng));
      }
      PX.revealCalls(s);
      for (const p of s.players) {
        if (p.alive) {
          if (!s.turn.forced[p.index]) PX.submitCard(s, p.index, STRATEGIES.smart.card(PX.viewFor(s, p.index), rng));
        } else {
          PX.submitVote(s, p.index, chooseVote(PX.viewFor(s, p.index), rng));
        }
      }
      PX.resolveRound(s);
    }
    assert.ok(s.winners.length >= 1);
  }
});
