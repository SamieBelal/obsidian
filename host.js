// The room: runs one lobby and game, and tells each player only what they are allowed to know.
// It has no network code, so it can run in a browser tab or in tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./bots.js'));
  else root.PXHost = factory(root.PX, root.PXBots);
})(typeof self !== 'undefined' ? self : this, function (PX, PXBots) {
  const { STRATEGIES, chooseVote } = PXBots;
  const MAX_SEATS = 6;
  const MIN_SEATS = 2;
  const BOT_NAMES = ['Reed', 'Flint', 'Marsh', 'Cinder', 'Slate'];
  // Seconds for each step. The reveal's time comes after its hit animations (see revealSeconds).
  const DEFAULT_TIMERS = { plan: 25, cards: 30, reveal: 5 };

  // About how long a round's hits take to play out in the browser, so the reveal timer starts after them.
  // Matches the animations in fx.js: the cards flip, then each attacker's hits, then any Lightning.
  function animationSeconds(report) {
    if (!report) return 0;
    const attackers = report.plays.filter((play) => Object.values(report.damageFrom).some((hits) => hits.some((h) => h.player === play.player))).length;
    const bolts = report.abilities.filter((a) => a.sub === 'lightning').length;
    return Math.ceil(1 + report.plays.length * 0.1 + attackers * 1.4 + bolts * 1);
  }

  function cleanName(raw) {
    const text = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
    return text || 'Player';
  }

  function createRoom({ code = null, send, timers = DEFAULT_TIMERS, rng = Math.random, setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now }) {
    const seats = [];
    // Air (a fourth element) is switched off while its rules are being rethought. The engine still supports it.
    const elementCount = 3;
    let game = null;
    let stage = 'lobby'; // lobby | playing | reveal | over
    let report = null;
    let acted = new Set();
    let timer = null;
    let timerKey = null;
    let deadline = null;

    const seatOf = (token) => seats.findIndex((s) => s.token === token);
    const validSubs = () => PX.subsFor(elementCount);

    function uniqueName(name) {
      const taken = new Set(seats.map((s) => s.name.toLowerCase()));
      if (!taken.has(name.toLowerCase())) return name;
      for (let n = 2; ; n++) {
        const next = `${name.slice(0, 13)} ${n}`;
        if (!taken.has(next.toLowerCase())) return next;
      }
    }

    // What a seat still has to do right now, if anything.
    function needsOf(i) {
      // Everyone clicks Next round to move on. With timers, the reveal also moves on by itself when time runs out.
      if (stage === 'reveal') return acted.has(i) ? null : 'ready';
      if (stage !== 'playing' || acted.has(i)) return null;
      const p = game.players[i];
      const phase = game.turn.phase;
      // Step 1: call an element, then decide on your sub-element if you have the charge for it.
      if (phase === 'plan') {
        if (!p.alive) return null;
        if (!(i in game.turn.calls)) return 'call';
        return PX.canUseAbility(game, i) ? 'ability' : null;
      }
      if (!p.alive) return 'vote';
      return game.turn.forced[i] ? null : 'card';
    }

    const humans = () => seats.map((s, i) => ({ s, i })).filter(({ s }) => !s.bot);
    const waitingSeats = () => humans().filter(({ s, i }) => s.online && needsOf(i)).map(({ i }) => i);

    function lobbyBlockers() {
      const list = [];
      if (seats.length < MIN_SEATS) list.push(`Add ${MIN_SEATS - seats.length} more player${MIN_SEATS - seats.length > 1 ? 's' : ''} or bot${MIN_SEATS - seats.length > 1 ? 's' : ''}`);
      const unpicked = seats.filter((s) => !s.bot && !s.sub).map((s) => s.name);
      if (unpicked.length) list.push(`Waiting for ${unpicked.join(', ')} to choose`);
      return list;
    }

    function stateFor(i) {
      const base = { type: 'state', code, me: i, isHost: i === 0, elementCount };
      if (stage === 'lobby') {
        return {
          ...base,
          screen: 'lobby',
          myPick: seats[i].sub,
          blockers: lobbyBlockers(),
          // Picks stay secret until the game starts, so only whether someone has chosen is shared.
          seats: seats.map((s) => ({ name: s.name, bot: s.bot, picked: s.bot || !!s.sub, online: s.online })),
        };
      }
      return {
        ...base,
        screen: 'game',
        stage,
        view: PX.viewFor(game, i),
        needs: needsOf(i),
        waitingOn: waitingSeats().filter((n) => n !== i).map((n) => seats[n].name),
        offline: humans().filter(({ s }) => !s.online).map(({ i: n }) => n),
        secondsLeft: deadline === null ? null : Math.max(0, Math.ceil((deadline - now()) / 1000)),
        report: stage === 'playing' ? null : report,
        winners: stage === 'over' ? game.winners : null,
      };
    }

    function publish() {
      humans().forEach(({ s, i }) => { if (s.online) send(s.token, stateFor(i)); });
    }

    function stopTimer() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      deadline = null;
      timerKey = null;
    }

    function syncTimer() {
      if (!timers || (stage !== 'playing' && stage !== 'reveal')) return stopTimer();
      const phase = stage === 'reveal' ? 'reveal' : game.turn.phase;
      const key = `${game.round}:${stage}:${phase}`;
      if (key === timerKey) return undefined;
      stopTimer();
      timerKey = key;
      const seconds = timers[phase] + (phase === 'reveal' ? animationSeconds(report) : 0);
      deadline = now() + seconds * 1000;
      timer = setTimer(() => {
        timer = null;
        advance();
        settle();
      }, seconds * 1000);
      return undefined;
    }

    function botsAct() {
      const phase = game.turn.phase;
      seats.forEach((s, i) => {
        if (!s.bot) return;
        const p = game.players[i];
        const view = PX.viewFor(game, i);
        if (phase === 'plan' && p.alive) {
          PX.submitCall(game, i, STRATEGIES.smart.call(view, rng));
          if (PX.canUseAbility(game, i)) {
            const choice = STRATEGIES.smart.ability(view, rng);
            if (choice) PX.submitAbility(game, i, choice);
          }
        } else if (phase === 'cards') {
          if (!p.alive) PX.submitVote(game, i, chooseVote(view, rng));
          else if (!game.turn.forced[i]) PX.submitCard(game, i, STRATEGIES.smart.card(view, rng));
        }
      });
    }

    // Moves on one step. Anyone who hasn't acted gets the default: hold charge, no call, random card, no vote.
    function advance() {
      acted = new Set();
      if (stage === 'reveal') {
        stage = 'playing';
        report = null;
        botsAct();
        return;
      }
      const phase = game.turn.phase;
      if (phase === 'plan') {
        PX.resolvePlan(game);
        botsAct();
      } else {
        game.players.forEach((p) => {
          if (p.alive && !game.turn.cards[p.index]) {
            PX.submitCard(game, p.index, p.hand[Math.floor(rng() * p.hand.length)].id);
          }
        });
        report = PX.resolveRound(game);
        stage = game.over ? 'over' : 'reveal';
      }
    }

    function settle() {
      // Each step moves on as soon as nobody is left to act; a timed one also moves on when its clock runs out.
      while ((stage === 'playing' || stage === 'reveal') && waitingSeats().length === 0) advance();
      syncTimer();
      publish();
    }

    function start() {
      if (lobbyBlockers().length) throw new Error(lobbyBlockers()[0]);
      const subs = validSubs();
      seats.forEach((s) => { if (s.bot) s.sub = subs[Math.floor(rng() * subs.length)]; });
      game = PX.createGame({
        seats: seats.map((s) => ({ name: s.name, sub: s.sub })),
        elementCount,
        seed: Math.floor(rng() * 2 ** 31),
      });
      stage = 'playing';
      report = null;
      acted = new Set();
      botsAct();
      settle();
    }

    function backToLobby() {
      stopTimer();
      for (let i = seats.length - 1; i > 0; i--) if (!seats[i].bot && !seats[i].online) seats.splice(i, 1);
      game = null;
      report = null;
      acted = new Set();
      stage = 'lobby';
      publish();
    }

    function addBot() {
      if (seats.length >= MAX_SEATS) throw new Error('The room is full');
      const name = BOT_NAMES.find((n) => !seats.some((s) => s.name === n)) || 'Bot';
      seats.push({ token: null, name: uniqueName(name), bot: true, sub: null, online: true });
    }

    function lobbyAction(i, action) {
      if (action.type === 'pick') {
        if (!validSubs().includes(action.sub)) throw new Error('Choose a sub-element from the list');
        seats[i].sub = action.sub;
      } else if (i !== 0) {
        throw new Error('Only the host can do that');
      } else if (action.type === 'addBot') {
        addBot();
      } else if (action.type === 'removeBot') {
        const n = Number(action.seat);
        if (!seats[n] || !seats[n].bot) throw new Error('That seat is not a bot');
        seats.splice(n, 1);
      } else if (action.type === 'start') {
        start();
        return;
      } else {
        throw new Error('Unknown action');
      }
      publish();
    }

    function gameAction(i, action) {
      if (action.type === 'lobby') {
        if (i !== 0) throw new Error('Only the host can do that');
        if (stage !== 'over') throw new Error('The game is still going');
        backToLobby();
        return;
      }
      const needs = needsOf(i);
      if (action.type !== needs) throw new Error('That is not available right now');
      if (needs === 'ability' && action.choice) {
        PX.submitAbility(game, i, { target: Number(action.choice.target), slot: Number(action.choice.slot) || 0 });
      } else if (needs === 'call') {
        // Making a call doesn't finish step 1 if there's a sub-element to decide on next.
        PX.submitCall(game, i, action.el);
        settle();
        return;
      } else if (needs === 'card') {
        PX.submitCard(game, i, action.id);
      } else if (needs === 'vote') {
        PX.submitVote(game, i, action.el);
      }
      acted.add(i);
      settle();
    }

    return {
      // Returns null if the player got in, or a reason if they didn't.
      join(token, rawName) {
        const known = seatOf(token);
        if (known >= 0) {
          seats[known].online = true;
          if (stage === 'lobby') publish();
          else settle();
          return null;
        }
        if (stage !== 'lobby') return 'This game has already started.';
        if (seats.length >= MAX_SEATS) return 'This room is full.';
        seats.push({ token, name: uniqueName(cleanName(rawName)), bot: false, sub: null, online: true });
        publish();
        return null;
      },

      leave(token) {
        const i = seatOf(token);
        if (i <= 0) return;
        if (stage === 'lobby') {
          seats.splice(i, 1);
          publish();
          return;
        }
        seats[i].online = false;
        settle();
      },

      action(token, action) {
        const i = seatOf(token);
        if (i < 0 || !action || typeof action.type !== 'string') return;
        try {
          if (stage === 'lobby') lobbyAction(i, action);
          else gameAction(i, action);
        } catch (err) {
          send(token, { type: 'error', message: err.message });
        }
      },

      addBot() {
        addBot();
        publish();
      },

      isPlaying: () => stage === 'playing' || stage === 'reveal',
    };
  }

  return { createRoom, cleanName, animationSeconds, MAX_SEATS, MIN_SEATS, DEFAULT_TIMERS };
});
