// Balance simulator. Run with: node sim.js [gamesPerSetup]
const PX = require('./engine.js');
const { STRATEGIES, makeSmart, chooseVote } = require('./bots.js');

const GAMES = Number(process.argv[2]) || 20000;

// Try numbers without editing the engine, for example:
// PX_TUNE='{"healing":{"cost":3,"amount":3}}' node sim.js 5000
for (const [key, change] of Object.entries(JSON.parse(process.env.PX_TUNE || '{}'))) {
  Object.assign(PX.SUBS[key], change);
}
if (process.env.PX_HP) PX.CONFIG.maxHp = Number(process.env.PX_HP);
if (process.env.PX_CALL) PX.CONFIG.callBonus = Number(process.env.PX_CALL);
if (process.env.PX_SD) PX.CONFIG.suddenDeathBonus = Number(process.env.PX_SD);

function playGame(seats, elementCount, seed, rng, strategies) {
  const s = PX.createGame({ seats, elementCount, seed });
  const stats = { firstKo: null, abilityUses: {}, maxHit: 0 };
  while (!s.over) {
    for (const p of s.players) {
      if (!p.alive || !PX.canUseAbility(s, p.index)) continue;
      const choice = strategies[p.index].ability(PX.viewFor(s, p.index), rng);
      if (choice) {
        PX.submitAbility(s, p.index, choice);
        stats.abilityUses[p.index] = (stats.abilityUses[p.index] || 0) + 1;
      }
    }
    PX.resolveAbilities(s);
    for (const p of s.players) {
      if (p.alive) PX.submitCall(s, p.index, strategies[p.index].call(PX.viewFor(s, p.index), rng));
    }
    PX.revealCalls(s);
    for (const p of s.players) {
      if (p.alive) {
        if (!s.turn.forced[p.index]) PX.submitCard(s, p.index, strategies[p.index].card(PX.viewFor(s, p.index), rng));
      } else {
        PX.submitVote(s, p.index, chooseVote(PX.viewFor(s, p.index), rng));
      }
    }
    const report = PX.resolveRound(s);
    stats.maxHit = Math.max(stats.maxHit, ...Object.values(report.damage));
    if (report.eliminated.length && stats.firstKo === null) stats.firstKo = report.round;
  }
  return { state: s, stats };
}

function average(list) {
  return list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
}

function percentile(list, q) {
  const sorted = list.slice().sort((a, b) => a - b);
  return sorted[Math.floor(q * (sorted.length - 1))];
}

// Sub-element strength: wins relative to a fair share, across random tables.
// 1.00 is fair, 1.20 means winning 20% more often than a fair share.
function runTable(elementCount, playerCount) {
  const rng = PX.makeRng(1000 + elementCount * 100 + playerCount);
  const subs = PX.subsFor(elementCount);
  const seen = {};
  const won = {};
  const uses = {};
  for (const k of subs) { seen[k] = 0; won[k] = 0; uses[k] = 0; }
  const rounds = [];
  const firstKos = [];
  let stalled = 0;
  let hitOver10 = 0;
  let shared = 0;

  for (let g = 0; g < GAMES; g++) {
    const seats = Array.from({ length: playerCount }, (_, i) => ({ name: `P${i}`, sub: subs[Math.floor(rng() * subs.length)] }));
    const strategies = seats.map(() => STRATEGIES.smart);
    const { state, stats } = playGame(seats, elementCount, g * 7919 + 13, rng, strategies);
    rounds.push(state.round);
    if (stats.firstKo) firstKos.push(stats.firstKo);
    if (state.stalled) stalled++;
    if (stats.maxHit >= 7) hitOver10++;
    if (state.winners.length > 1) shared++;
    seats.forEach((seat, i) => {
      seen[seat.sub]++;
      uses[seat.sub] += stats.abilityUses[i] || 0;
      if (state.winners.includes(i)) won[seat.sub] += 1 / state.winners.length;
    });
  }

  const strength = {};
  const usesPerGame = {};
  for (const k of subs) {
    strength[k] = seen[k] ? (won[k] / seen[k]) * playerCount : 0;
    usesPerGame[k] = seen[k] ? uses[k] / seen[k] : 0;
  }
  return {
    elementCount, playerCount, strength, usesPerGame,
    rounds: average(rounds), p90: percentile(rounds, 0.9),
    firstKo: average(firstKos),
    stalled: stalled / GAMES, bigHit: hitOver10 / GAMES, shared: shared / GAMES,
  };
}

// Does skill matter? One careful player against a table of random players.
function runSkill(elementCount, playerCount) {
  const rng = PX.makeRng(5000 + elementCount * 10 + playerCount);
  const subs = PX.subsFor(elementCount);
  let wins = 0;
  for (let g = 0; g < GAMES; g++) {
    const seats = Array.from({ length: playerCount }, (_, i) => ({ name: `P${i}`, sub: subs[Math.floor(rng() * subs.length)] }));
    const strategies = seats.map((_, i) => (i === 0 ? STRATEGIES.smart : STRATEGIES.random));
    const { state } = playGame(seats, elementCount, g * 104729 + 3, rng, strategies);
    if (state.winners.includes(0)) wins += 1 / state.winners.length;
  }
  return { rate: wins / GAMES, fair: 1 / playerCount };
}

function pad(text, width) {
  return String(text).padEnd(width);
}

for (const elementCount of [3, 4]) {
  const subs = PX.subsFor(elementCount);
  console.log(`\n=== ${elementCount} elements (${PX.elementsFor(elementCount).join(', ')}) ===`);
  console.log('players | avg rounds | 90th pct | first KO | stalled | hit of 7+  | shared win');
  const tables = [3, 4, 5, 6].map((n) => runTable(elementCount, n));
  for (const t of tables) {
    console.log(
      `${pad(t.playerCount, 7)} | ${pad(t.rounds.toFixed(1), 10)} | ${pad(t.p90, 8)} | ${pad(t.firstKo.toFixed(1), 8)} | ` +
      `${pad((t.stalled * 100).toFixed(1) + '%', 7)} | ${pad((t.bigHit * 100).toFixed(0) + '%', 10)} | ${(t.shared * 100).toFixed(1)}%`
    );
  }
  console.log('\nStrength by sub-element (1.00 = fair share of wins), with uses per game at 5 players:');
  console.log(`${pad('', 14)}${tables.map((t) => pad(t.playerCount + 'p', 7)).join('')}uses`);
  const five = tables[2];
  for (const k of subs) {
    console.log(`${pad(PX.SUBS[k].name, 14)}${tables.map((t) => pad(t.strength[k].toFixed(2), 7)).join('')}${five.usesPerGame[k].toFixed(1)}`);
  }
  console.log('\nSkill check: one careful player against random players');
  for (const n of [3, 5]) {
    const r = runSkill(elementCount, n);
    console.log(`${n} players: wins ${(r.rate * 100).toFixed(0)}% (fair share ${(r.fair * 100).toFixed(0)}%)`);
  }
}

// One bot playing differently from the rest of the table. 1.00 means no better than a fair share.
function edge(playerCount, lead, rest) {
  const rng = PX.makeRng(9000 + playerCount);
  const subs = PX.subsFor(3);
  let wins = 0;
  for (let g = 0; g < GAMES; g++) {
    const seats = Array.from({ length: playerCount }, (_, i) => ({ name: `P${i}`, sub: subs[Math.floor(rng() * subs.length)] }));
    const strategies = seats.map((_, i) => (i === 0 ? lead : rest));
    const { state } = playGame(seats, 3, g * 15485863 + 7, rng, strategies);
    if (state.winners.includes(0)) wins += 1 / state.winners.length;
  }
  return ((wins / GAMES) * playerCount).toFixed(2);
}

console.log('\n=== Calling (3 elements, share of wins where 1.00 is fair) ===');
console.log('                                            3p    4p    5p    6p');
const row = (label, lead, rest) => console.log(pad(label, 44) + [3, 4, 5, 6].map((n) => pad(edge(n, lead, rest), 6)).join(''));
row('Baseline: nobody reads calls', makeSmart({ readCalls: false }), makeSmart({ readCalls: false }));
row('One reader among players who ignore calls', makeSmart(), makeSmart({ readCalls: false }));
row('One player ignoring calls among readers', makeSmart({ readCalls: false }), makeSmart());
for (const honesty of [0, 0.3, 0.6, 0.9, 1]) {
  row(`Calls honestly ${Math.round(honesty * 100)}% of the time, among readers`, makeSmart({ honesty }), makeSmart());
}
