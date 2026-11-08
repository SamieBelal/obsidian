// Room tests: several players on fake connections, with timers run by hand. Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const PX = require('./engine.js');
const { createRoom, cleanName, animationSeconds } = require('./host.js');

function setup(options = {}) {
  const inbox = {};
  const timers = [];
  let clock = 0;
  const room = createRoom({
    code: 'TEST',
    send: (token, message) => {
      (inbox[token] = inbox[token] || []).push(JSON.parse(JSON.stringify(message)));
    },
    rng: PX.makeRng(options.seed || 5),
    setTimer: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
    clearTimer: (t) => { const n = timers.indexOf(t); if (n >= 0) timers.splice(n, 1); },
    now: () => clock,
    timers: options.timers === undefined ? { abilities: 20, calls: 20, cards: 30, reveal: 10 } : options.timers,
  });
  const latest = (token) => {
    const all = (inbox[token] || []).filter((m) => m.type === 'state');
    return all[all.length - 1];
  };
  const fireTimer = () => {
    const t = timers.shift();
    clock += t.ms;
    t.fn();
  };
  return { room, inbox, latest, fireTimer, timers };
}

function lobbyOfThree(t, subs = ['lightning', 'healing', 'seismic']) {
  ['a', 'b', 'c'].forEach((token, i) => {
    t.room.join(token, token.toUpperCase());
    t.room.action(token, { type: 'pick', sub: subs[i] });
  });
}

// Plays whatever each player is being asked for, choosing the first option.
function actAll(t, tokens) {
  for (const token of tokens) {
    const s = t.latest(token);
    if (!s || s.screen !== 'game' || !s.needs) continue;
    if (s.needs === 'ability') t.room.action(token, { type: 'ability', choice: null });
    if (s.needs === 'call') t.room.action(token, { type: 'call', el: 'fire' });
    if (s.needs === 'card') t.room.action(token, { type: 'card', id: s.view.hand[0].id });
    if (s.needs === 'vote') t.room.action(token, { type: 'vote', el: 'water' });
    if (s.needs === 'ready') t.room.action(token, { type: 'ready' });
  }
  // A timed reveal moves on only when its timer runs out, so run it.
  const now = t.latest(tokens[0]);
  if (now && now.stage === 'reveal' && t.timers.length) t.fireTimer();
}

test('a game cannot start until 2 seats are filled and everyone has chosen', () => {
  const t = setup();
  t.room.join('a', 'A');
  t.room.action('a', { type: 'start' });
  assert.match(t.inbox.a.at(-1).message, /Add 1 more/);
  t.room.join('b', 'B');
  t.room.action('a', { type: 'start' });
  assert.match(t.inbox.a.at(-1).message, /Waiting for A, B to choose/);
  t.room.action('a', { type: 'pick', sub: 'healing' });
  t.room.action('b', { type: 'pick', sub: 'metal' });
  t.room.action('a', { type: 'start' });
  assert.strictEqual(t.latest('b').screen, 'game');
});

test('only the host can run the lobby', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.action('b', { type: 'start' });
  assert.strictEqual(t.latest('b').screen, 'lobby');
  assert.match(t.inbox.b.at(-1).message, /Only the host/);
});

test('sub-element picks stay secret in the lobby', () => {
  const t = setup();
  lobbyOfThree(t);
  assert.ok(!JSON.stringify(t.latest('b').seats).includes('lightning'));
});

test('nobody can join a started game, but a full room and new names are handled', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.join('a', 'A');
  assert.strictEqual(t.room.join('d', 'A'), null);
  t.room.action('d', { type: 'pick', sub: 'metal' });
  assert.strictEqual(t.latest('d').seats[3].name, 'A 2');
  t.room.join('e', 'E');
  t.room.join('f', 'F');
  assert.match(t.room.join('g', 'G'), /full/);
  t.room.action('e', { type: 'pick', sub: 'metal' });
  t.room.action('f', { type: 'pick', sub: 'metal' });
  t.room.action('a', { type: 'start' });
  assert.match(t.room.join('h', 'H'), /already started/);
});

test('names are cleaned before anyone sees them', () => {
  assert.strictEqual(cleanName('   '), 'Player');
  assert.strictEqual(cleanName('a\u0000b'), 'ab');
  assert.strictEqual(cleanName('x'.repeat(40)).length, 16);
});

test('a full game finishes with three people, and no message reveals a hidden card', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const t = setup({ seed });
    const tokens = ['a', 'b', 'c'];
    lobbyOfThree(t, ['lightning', 'bloodbending', 'seismic']);
    t.room.action('a', { type: 'start' });
    for (let n = 0; n < 1000 && t.latest('a').stage !== 'over'; n++) {
      // Each player's messages must not contain another player's hidden cards.
      const a = t.latest('a');
      if (a.stage === 'playing') {
        const all = tokens.map((tk) => t.latest(tk));
        all.forEach((s, i) => {
          all.forEach((other, j) => {
            if (i === j || s.view.knowledge?.target === j) return;
            const faceUp = other.view.faceUpId;
            for (const card of other.view.hand) {
              if (card.id !== faceUp) assert.ok(!JSON.stringify(s).includes(card.id), `seat ${i} can see hidden card ${card.id}`);
            }
          });
        });
      }
      actAll(t, tokens);
    }
    const final = t.latest('a');
    assert.strictEqual(final.stage, 'over');
    assert.ok(final.winners.length >= 1);
    assert.strictEqual(t.timers.length, 0, 'no timer is left running');
  }
});

test('out-of-turn and malformed actions are refused without breaking the game', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.action('a', { type: 'start' });
  t.room.action('b', { type: 'card', id: 'nope' });
  t.room.action('b', { type: 'call', el: 'lava' });
  t.room.action('b', null);
  t.room.action('b', { type: 42 });
  t.room.action('stranger', { type: 'call', el: 'fire' });
  t.room.action('b', { type: 'lobby' });
  assert.strictEqual(t.latest('b').needs, 'call', 'still waiting for a real call');
  t.room.action('b', { type: 'call', el: 'fire' });
  assert.strictEqual(t.latest('b').needs, null);
  assert.deepStrictEqual(t.latest('b').waitingOn, ['A', 'C']);
});

test('an ability cannot be aimed at a dead or invalid player', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.action('a', { type: 'start' });
  // Earn enough charge by playing rounds until the ability is offered.
  for (let n = 0; n < 200 && t.latest('a').needs !== 'ability'; n++) actAll(t, ['a', 'b', 'c']);
  assert.strictEqual(t.latest('a').needs, 'ability');
  t.room.action('a', { type: 'ability', choice: { target: 99 } });
  assert.match(t.inbox.a.at(-1).message, /another living player/);
  assert.strictEqual(t.latest('a').needs, 'ability', 'can still choose again');
});

test('the timer moves the game on, playing a random card for anyone who did not choose', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.action('a', { type: 'start' });
  assert.strictEqual(t.latest('a').secondsLeft, 20);
  t.fireTimer(); // calls time out with no call made
  assert.strictEqual(t.latest('a').needs, 'card');
  assert.strictEqual(t.latest('a').secondsLeft, 30);
  t.fireTimer(); // cards time out
  assert.strictEqual(t.latest('a').stage, 'reveal');
  assert.strictEqual(t.latest('a').report.plays.length, 3);
  t.fireTimer(); // reveal times out
  assert.strictEqual(t.latest('a').stage, 'playing');
  assert.strictEqual(t.latest('a').view.round, 2);
});

test('with timers, the reveal needs no clicks: it waits for the hits to play, then 10 more seconds', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.action('a', { type: 'start' });
  t.fireTimer(); // calls time out
  t.fireTimer(); // cards time out
  const reveal = t.latest('a');
  assert.strictEqual(reveal.stage, 'reveal');
  ['a', 'b', 'c'].forEach((token) => assert.strictEqual(t.latest(token).needs, null, 'nobody has to click Next round'));
  assert.strictEqual(reveal.secondsLeft, 10 + animationSeconds(reveal.report));
  t.room.action('a', { type: 'ready' });
  assert.strictEqual(t.latest('a').stage, 'reveal', 'a stray click does not skip the reveal');
  t.fireTimer();
  assert.strictEqual(t.latest('a').stage, 'playing');
  assert.strictEqual(t.latest('a').view.round, 2);
});

test('a player who disconnects stops holding up the round, and can come back to the same seat', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.action('a', { type: 'start' });
  t.room.action('a', { type: 'call', el: 'fire' });
  t.room.action('b', { type: 'call', el: 'fire' });
  t.room.leave('c');
  assert.strictEqual(t.latest('a').needs, 'card', 'moved on without the missing player');
  assert.deepStrictEqual(t.latest('a').offline, [2]);

  assert.strictEqual(t.room.join('c', 'C'), null);
  const back = t.latest('c');
  assert.strictEqual(back.me, 2);
  assert.strictEqual(back.needs, 'card', 'they can play this round');
  assert.deepStrictEqual(t.latest('a').offline, []);
});

test('a game keeps going to the end if a player never comes back', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.action('a', { type: 'start' });
  t.room.leave('b');
  for (let n = 0; n < 1000 && t.latest('a').stage !== 'over'; n++) actAll(t, ['a', 'c']);
  assert.strictEqual(t.latest('a').stage, 'over');
});

test('the host can return to the lobby for another game, and missing players lose their seats', () => {
  const t = setup();
  lobbyOfThree(t);
  t.room.action('a', { type: 'addBot' });
  t.room.action('a', { type: 'start' });
  t.room.leave('c');
  for (let n = 0; n < 1000 && t.latest('a').stage !== 'over'; n++) actAll(t, ['a', 'b']);
  t.room.action('b', { type: 'lobby' });
  assert.strictEqual(t.latest('b').screen, 'game', 'only the host can do this');
  t.room.action('a', { type: 'lobby' });
  const lobby = t.latest('a');
  assert.strictEqual(lobby.screen, 'lobby');
  assert.deepStrictEqual(lobby.seats.map((s) => s.name), ['A', 'B', 'Reed']);
  t.room.action('a', { type: 'addBot' });
  t.room.action('a', { type: 'start' });
  assert.strictEqual(t.latest('b').screen, 'game');
});

test('air is switched off: it cannot be turned on, and air sub-elements cannot be picked', () => {
  const t = setup();
  lobbyOfThree(t);
  const last = (token) => t.inbox[token][t.inbox[token].length - 1];
  t.room.action('a', { type: 'air', on: true });
  assert.strictEqual(last('a').type, 'error');
  t.room.action('b', { type: 'pick', sub: 'flight' });
  assert.strictEqual(last('b').type, 'error');
  assert.strictEqual(t.latest('b').myPick, 'healing');
  assert.strictEqual(t.latest('a').elementCount, 3);
});

test('two friends can play a full 1v1, and one player with a bot can too', () => {
  const t = setup();
  t.room.join('a', 'A');
  t.room.join('b', 'B');
  t.room.action('a', { type: 'pick', sub: 'lightning' });
  t.room.action('b', { type: 'pick', sub: 'bloodbending' });
  t.room.action('a', { type: 'start' });
  for (let n = 0; n < 2000 && t.latest('a').stage !== 'over'; n++) actAll(t, ['a', 'b']);
  assert.strictEqual(t.latest('a').stage, 'over');

  const solo = setup({ timers: null });
  solo.room.join('a', 'A');
  solo.room.addBot();
  solo.room.action('a', { type: 'pick', sub: 'metal' });
  solo.room.action('a', { type: 'start' });
  for (let n = 0; n < 2000 && solo.latest('a').stage !== 'over'; n++) actAll(solo, ['a']);
  assert.strictEqual(solo.latest('a').stage, 'over');
});

test('solo play has no timers and waits for you', () => {
  const t = setup({ timers: null });
  t.room.join('a', 'A');
  t.room.addBot();
  t.room.addBot();
  t.room.action('a', { type: 'pick', sub: 'metal' });
  t.room.action('a', { type: 'start' });
  assert.strictEqual(t.timers.length, 0);
  assert.strictEqual(t.latest('a').secondsLeft, null);
  assert.strictEqual(t.latest('a').needs, 'call');
});
