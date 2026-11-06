// The screens. They only draw what the room sends, whether the room is in this tab or a friend's.
(function () {
  const { SUBS, CONFIG } = PX;
  const { cardArt, cardBack, powerArt } = PXArt;
  const app = document.getElementById('app');

  const session = {
    mode: 'home', // home | connecting | room
    message: '',
    state: null,
    send: null, // sends an action to the room
    host: null,
    status: 'connected',
    pick: null, // the player's half-finished ability choice
    flippedRound: null,
    deadline: null,
    lastHp: {}, // each player's HP before the round being revealed
    fx: null, // the reveal animation: { round, playing, shown, final }
    abilityFx: null, // the abilities animation: { round, playing }
    callsRound: null, // the round whose calls have already popped in
  };

  let fxLayer = null;

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  // The painted icon for an element, from art/board.
  const icon = (el) => (['fire', 'water', 'earth'].includes(el) ? `<img class="el-icon" src="art/board/icon-${el}.webp" alt="" draggable="false">` : '');
  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const roomFromUrl = () => (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const savedName = () => { try { return localStorage.getItem('px-name') || ''; } catch (e) { return ''; } };
  const saveName = (name) => { try { localStorage.setItem('px-name', name); } catch (e) { /* private browsing */ } };

  // A refresh keeps your seat, because the token stays in this tab's session storage.
  function tokenFor(code) {
    const key = `px-token-${code}`;
    let token = null;
    try { token = sessionStorage.getItem(key); } catch (e) { /* private browsing */ }
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      try { sessionStorage.setItem(key, token); } catch (e) { /* private browsing */ }
    }
    return token;
  }

  function hadSeatIn(code) {
    try { return !!sessionStorage.getItem(`px-token-${code}`); } catch (e) { return false; }
  }

  function setUrl(code) {
    const url = new URL(location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    history.replaceState(null, '', url);
  }

  async function keepScreenOn() {
    try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { /* not supported or refused */ }
  }

  function receive(state) {
    const before = session.state;
    if (state.type === 'error') {
      session.message = state.message;
      render();
      return;
    }
    if (!before || before.needs !== state.needs || (before.view && before.view.round !== state.view?.round)) session.pick = null;
    if (before && before.screen === 'lobby' && state.screen === 'game') PXHelp.close();
    if (!before && state.screen === 'lobby') PXHelp.openIfNew();
    session.state = state;
    session.mode = 'room';
    session.message = '';
    session.deadline = state.secondsLeft === null || state.secondsLeft === undefined ? null : Date.now() + state.secondsLeft * 1000;
    // A new round (or a new game) ends any reveal animation still playing.
    if (state.screen !== 'game' || state.stage === 'playing') {
      if (session.fx && fxLayer) fxLayer.clear();
      session.fx = null;
    }
    if (state.screen !== 'game' || state.stage !== 'playing') session.abilityFx = null;
    if (state.screen !== 'game') session.callsRound = null;
    if (state.screen === 'game' && state.stage === 'playing') {
      session.lastHp = Object.fromEntries(state.view.players.map((p) => [p.index, p.hp]));
    }
    // While the hits are playing, hold later updates so the screen isn't redrawn mid-animation.
    if (session.fx && session.fx.playing && state.report && state.report.round === session.fx.round) return;
    if (abilitiesPlaying() && state.view.round === session.abilityFx.round && state.view.phase !== 'abilities') return;
    const startFx = shouldAnimate(state);
    const startAbilities = shouldAnimateAbilities(state);
    render();
    if (startFx) playReveal();
    if (startAbilities) playAbilities();
  }

  // Abilities animation: once abilities lock in, each one plays on the seats, a beat apart.

  function shouldAnimateAbilities(state) {
    if (state.screen !== 'game' || state.stage !== 'playing') return false;
    const view = state.view;
    if (view.phase === 'abilities' || !view.abilities.length) return false;
    if (session.abilityFx && session.abilityFx.round === view.round) return false;
    const motion = window.PXFx && typeof gsap !== 'undefined' && !PXFx.reducedMotion();
    session.abilityFx = { round: view.round, playing: motion };
    return motion;
  }

  async function playAbilities() {
    const fx = session.abilityFx;
    if (!fxLayer) fxLayer = PXFx.createLayer(document.body);
    const seatOf = (i) => app.querySelector(`[data-seat="${i}"]`);
    await Promise.all(session.state.view.abilities.map((a, n) => new Promise((r) => setTimeout(r, n * 450)).then(() => {
      if (session.abilityFx !== fx || !seatOf(a.player)) return null;
      return PXFx.ability(fxLayer, document.body, a.sub, seatOf(a.player), a.target === null ? null : seatOf(a.target));
    })));
    if (session.abilityFx !== fx) return;
    fx.playing = false;
    render();
  }

  const abilitiesPlaying = () => !!(session.abilityFx && session.abilityFx.playing);

  // The lasting look of an active power on a seat: Combustion glows, Metalbending is plated.
  function powerClasses(p) {
    if (abilitiesPlaying()) return '';
    return `${p.primed ? ' fx-primed' : ''}${p.shield > 0 ? ' fx-shielded' : ''}`;
  }

  // Reveal animation

  // Starts the hits for a newly revealed round, unless the player prefers less motion.
  function shouldAnimate(state) {
    if (state.screen !== 'game' || !state.report || (state.stage !== 'reveal' && state.stage !== 'over')) return false;
    if (session.fx && session.fx.round === state.report.round) return false;
    const report = state.report;
    const anyHit = report.plays.some((p) => report.damageFrom[p.player].length) || report.abilities.some((a) => a.sub === 'lightning');
    if (!window.PXFx || typeof gsap === 'undefined' || PXFx.reducedMotion() || !anyHit) {
      session.fx = { round: report.round, playing: false };
      return false;
    }
    const final = Object.fromEntries(state.view.players.map((p) => [p.index, p.hp]));
    const before = (i) => (session.lastHp[i] !== undefined ? session.lastHp[i] : Math.min(CONFIG.maxHp, final[i] + (report.damage[i] || 0)));
    session.fx = {
      round: report.round,
      playing: true,
      final,
      shown: Object.fromEntries(state.view.players.map((p) => [p.index, before(p.index)])),
    };
    return true;
  }

  // Each attacker's hits fly together, one attacker after another, in seat order.
  async function playReveal() {
    const fx = session.fx;
    const report = session.state.report;
    if (!fxLayer) fxLayer = PXFx.createLayer(document.body);
    // Let the cards finish flipping over first.
    await new Promise((r) => setTimeout(r, 450 + report.plays.length * 90));
    const cardOf = (i) => app.querySelector(`.reveal [data-play="${i}"] .card`);
    for (const play of report.plays) {
      if (session.fx !== fx || !cardOf(play.player)) break;
      const targets = report.plays.map((t) => {
        const hit = report.damageFrom[t.player].find((h) => h.player === play.player);
        if (!hit) return null;
        const blocked = report.blocked.includes(t.player);
        return { card: cardOf(t.player), amount: hit.amount, blocked, onHit: () => { if (!blocked) showHit(fx, t.player, hit.amount); } };
      }).filter(Boolean);
      if (targets.length) await PXFx.attack(fxLayer, cardOf(play.player), play.card.el, targets);
    }
    // Lightning strikes after the cards.
    for (const bolt of report.abilities.filter((a) => a.sub === 'lightning')) {
      if (session.fx !== fx || !cardOf(bolt.target)) break;
      const blocked = report.blocked.includes(bolt.target);
      await PXFx.strike(fxLayer, cardOf(bolt.target), SUBS.lightning.amount, blocked);
      if (!blocked) showHit(fx, bolt.target, SUBS.lightning.amount);
    }
    if (session.fx !== fx) return;
    fx.playing = false;
    render();
  }

  // Lowers a player's HP bar as a hit lands, never below where it really ends up.
  function showHit(fx, i, amount) {
    fx.shown[i] = Math.max(fx.final[i], fx.shown[i] - amount);
    app.querySelectorAll(`[data-hp-for="${i}"]`).forEach((meter) => {
      meter.querySelector('.hp-number').textContent = fx.shown[i];
      meter.querySelector('.hp-bar span').style.width = `${(fx.shown[i] / CONFIG.maxHp) * 100}%`;
    });
  }

  const animating = () => !!(session.fx && session.fx.playing && session.state.report && session.state.report.round === session.fx.round);

  // Ways into a room

  function playSolo(bots) {
    const token = 'solo';
    const room = PXHost.createRoom({ send: (_t, s) => receive(s) });
    session.send = (action) => room.action(token, action);
    room.join(token, 'You');
    for (let n = 0; n < bots; n++) room.addBot();
  }

  function createRoom(name) {
    session.mode = 'connecting';
    session.message = 'Creating your room...';
    render();
    const token = 'host';
    let room = null;
    const net = PXNet.startHost({
      open(code) {
        room = PXHost.createRoom({
          code,
          send: (t, state) => { if (t === token) receive(state); else net.send(t, state); },
        });
        session.send = (action) => room.action(token, action);
        session.host = room;
        room.join(token, name);
        setUrl(code);
        keepScreenOn();
      },
      error(message) {
        session.mode = 'home';
        session.message = message;
        render();
      },
      join: (t, n) => room.join(t, n),
      leave: (t) => room.leave(t),
      action: (t, data) => room.action(t, data),
    });
  }

  function joinRoom(code, name) {
    session.mode = 'connecting';
    session.message = `Joining room ${code}...`;
    render();
    const net = PXNet.joinRoom(code, {
      token: tokenFor(code),
      name,
      state: receive,
      error(message) {
        session.message = message;
        render();
      },
      status(status) {
        if (session.status !== status) {
          session.status = status;
          if (session.mode === 'room') render();
        }
      },
      failed(reason) {
        session.mode = 'home';
        session.state = null;
        session.message = reason;
        render();
      },
    });
    session.send = (action) => net.send(action);
    setUrl(code);
    keepScreenOn();
  }

  // Home

  function renderHome() {
    const code = roomFromUrl();
    app.innerHTML = `
      <section class="setup home">
        <h1>Project X</h1>
        <p class="pitch">Call an element, play a card, and bluff your friends. Last one standing wins. For 2-6 players.</p>
        ${session.message ? `<p class="notice" role="alert">${esc(session.message)}</p>` : ''}
        ${session.mode === 'connecting' ? '' : `
        <label class="field">Your name<input id="name" maxlength="16" autocomplete="off" value="${esc(savedName())}" placeholder="Name your friends will see"></label>
        <div class="ways">
          <form id="join-form" class="way">
            <h2>Join a friend's room</h2>
            <label class="field">Room code<input id="code" maxlength="4" autocomplete="off" autocapitalize="characters" value="${esc(code)}" placeholder="ABCD"></label>
            <button class="action" type="submit">Join room</button>
          </form>
          <div class="way">
            <h2>Start a room</h2>
            <p>Your browser hosts the game, so keep this tab open until it ends.</p>
            <button class="action" id="create">Create room</button>
          </div>
          <div class="way">
            <h2>Practice</h2>
            <p>Play on your own against bots.</p>
            <div class="buttons start">
              <button class="action quiet" id="duel">1v1 a bot</button>
              <button class="action quiet" id="solo">Play a group</button>
            </div>
          </div>
        </div>`}
      </section>`;
    if (session.mode === 'connecting') return;
    const nameValue = () => {
      const value = document.getElementById('name').value.trim();
      saveName(value);
      return value;
    };
    const needName = () => {
      const value = nameValue();
      if (value) return value;
      session.message = 'Enter a name first.';
      const typedCode = document.getElementById('code').value;
      renderHome();
      document.getElementById('code').value = typedCode;
      document.getElementById('name').focus();
      return null;
    };
    document.getElementById('join-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const typed = document.getElementById('code').value.toUpperCase().replace(/[^A-Z]/g, '');
      if (typed.length !== 4) {
        session.message = 'Room codes are 4 letters.';
        renderHome();
        return;
      }
      const name = needName();
      if (name) joinRoom(typed, name);
    });
    document.getElementById('create').addEventListener('click', () => {
      const name = needName();
      if (name) createRoom(name);
    });
    [['solo', 3], ['duel', 1]].forEach(([id, bots]) => document.getElementById(id).addEventListener('click', () => {
      saveName(document.getElementById('name').value.trim());
      playSolo(bots);
    }));
  }

  // Lobby

  function renderLobby(s) {
    const subs = PX.subsFor(s.elementCount);
    const invite = s.code ? `${location.origin}${location.pathname}?room=${s.code}` : '';
    app.innerHTML = `
      <section class="setup lobby">
        ${s.code ? `<div class="room-code">
          <div><h1>${esc(s.code)}</h1><p class="pitch">Your friends join with this code.</p></div>
          <button class="action" id="copy">Copy invite link</button>
        </div>` : '<h1>Practice</h1>'}
        ${session.message ? `<p class="notice" role="alert">${esc(session.message)}</p>` : ''}
        <h2>Players (${s.seats.length} of ${PXHost.MAX_SEATS})</h2>
        <ul class="roster">
          ${s.seats.map((seat, i) => `<li>
            <span class="roster-name">${esc(seat.name)}${i === s.me ? ' (you)' : ''}${i === 0 && s.code ? ', host' : ''}${seat.bot ? ', bot' : ''}</span>
            <span class="roster-state">${seat.bot ? '' : seat.picked ? 'Ready' : 'Choosing'}</span>
            ${s.isHost && seat.bot ? `<button class="action quiet small" data-remove="${i}">Remove</button>` : ''}
          </li>`).join('')}
        </ul>
        ${s.isHost && s.seats.length < PXHost.MAX_SEATS ? '<button class="action quiet" id="add-bot">Add a bot</button>' : ''}
        <h2 class="gap">Choose your sub-element</h2>
        <p class="hint">Nobody sees your choice until the game starts.</p>
        <div class="sub-grid">
          ${subs.map((key) => {
            const sub = SUBS[key];
            return `<button class="sub-tile el-${sub.element}" data-sub="${key}" aria-pressed="${key === s.myPick}">
              <span class="print">${powerArt(key) || cardArt(sub.element, sub.cost >= 4 ? 6 : 3, false)}</span>
              <span class="words">
                <h3>${sub.name}</h3>
                <span class="cost">${cap(sub.element)}, ${sub.cost} charge</span>
                <span class="what">${sub.text}</span>
              </span>
            </button>`;
          }).join('')}
        </div>
        ${s.isHost ? `<div class="options">
          <button class="action" id="start" ${s.blockers.length ? 'disabled' : ''}>Start game</button>
        </div>
        ${s.blockers.length ? `<p class="hint end">${esc(s.blockers.join('. '))}.</p>` : ''}` : '<p class="hint">The host starts the game once everyone has chosen.</p>'}
      </section>`;

    app.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => session.send({ type: 'pick', sub: b.dataset.sub })));
    app.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => session.send({ type: 'removeBot', seat: Number(b.dataset.remove) })));
    const on = (id, fn, event = 'click') => { const el = document.getElementById(id); if (el) el.addEventListener(event, fn); };
    on('add-bot', () => session.send({ type: 'addBot' }));
    on('start', () => session.send({ type: 'start' }));
    on('copy', async (e) => {
      const button = e.target;
      try {
        await navigator.clipboard.writeText(invite);
        button.textContent = 'Link copied';
      } catch (err) {
        session.message = `Share this link: ${invite}`;
        render();
      }
    });
  }

  // Table

  function nameOf(s, i) {
    return i === s.me ? 'You' : esc(s.view.players[i].name);
  }

  function cycleText(count) {
    const table = PX.BEATS[count];
    return Object.keys(table).map((el) => `${cap(el)} beats ${table[el][0]}`).join('. ') + '.';
  }

  function pips(charge) {
    return `<span class="pips" aria-label="${charge} of ${CONFIG.maxCharge} charge">${Array.from({ length: CONFIG.maxCharge }, (_, n) => `<i class="${n < charge ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function hpMeter(p) {
    const hp = animating() ? session.fx.shown[p.index] : p.hp;
    return `<div class="meter" data-hp-for="${p.index}"><span class="hp-label"><span class="hp-number">${hp}</span> HP</span><span class="hp-bar"><span style="width:${(hp / CONFIG.maxHp) * 100}%"></span></span>${pips(p.charge)}</div>`;
  }

  function abilityLine(s, a) {
    const who = nameOf(s, a.player);
    const target = a.target === null ? '' : a.target === s.me ? ' on you' : ` on ${esc(s.view.players[a.target].name)}`;
    return `${who} used ${SUBS[a.sub].name}${target}.`;
  }

  function roundStory(s, report) {
    const lines = report.abilities.map((a) => abilityLine(s, a));
    if (report.spirit) lines.push(`The Spirit World gave ${report.spirit} +1 power.`);
    for (const i of report.blocked) lines.push(`${nameOf(s, i)} blocked all damage.`);
    for (const i of report.eliminated) lines.push(i === s.me ? 'You are out. You can still vote from the Spirit World.' : `${esc(s.view.players[i].name)} is out.`);
    if (!Object.values(report.damage).some((d) => d > 0) && !report.blocked.length) lines.push('Nobody took damage.');
    return lines;
  }

  function seatHtml(s, p) {
    const notes = [];
    if (!p.alive) notes.push('Out');
    if (s.offline.includes(p.index)) notes.push('Disconnected');
    if (p.shield > 0) notes.push('Blocking');
    if (p.primed) notes.push('Combustion ready');
    if (p.callsMade && p.alive) notes.push(`kept ${p.callsKept} of ${p.callsMade} calls`);
    const targetable = session.pick && session.pick.mode === 'target' && p.alive;
    const tag = targetable ? 'button' : 'div';
    return `<${tag} class="seat el-${p.element} ${p.alive ? '' : 'out'}${powerClasses(p)}" data-seat="${p.index}" ${targetable ? `data-target="${p.index}"` : ''}>
      <span class="who">${icon(p.element)}<span class="who-text">${esc(p.name)}<span class="class">${SUBS[p.sub].name}</span></span></span>
      <span class="showing">${p.faceUp && s.stage !== 'over' ? `<span class="card" title="Showing ${p.faceUp.el} ${p.faceUp.power}">${cardArt(p.faceUp.el, p.faceUp.power)}</span>` : ''}</span>
      ${hpMeter(p)}
      <span class="state">${p.call ? `<span class="call-tag el-${p.call}">Calling ${p.call}</span> ` : ''}${notes.join(', ')}</span>
    </${tag}>`;
  }

  // Spells out how a player's damage adds up, for example "Reed 2 + Marsh 1".
  function damageMath(s, report, i) {
    const hits = report.damageFrom[i];
    const bolts = report.abilities.filter((a) => a.sub === 'lightning' && a.target === i);
    if (!hits.length && !bolts.length) return '';
    const parts = hits.map((h) => `${nameOf(s, h.player)} ${h.amount}`);
    for (const b of bolts) parts.push(`${SUBS.lightning.amount} Lightning`);
    if (report.suddenDeath) parts.push(`${report.suddenDeathBonus} sudden death`);
    const halved = report.abilities.some((a) => a.sub === 'flight' && a.player === i);
    return parts.join(' + ') + (halved ? ', halved by Flight' : '');
  }

  function revealHtml(s, report) {
    const animate = session.flippedRound !== report.round;
    session.flippedRound = report.round;
    const plays = report.plays.map((play, order) => {
      const dmg = report.damage[play.player];
      const blocked = report.blocked.includes(play.player);
      const label = blocked ? '<span class="damage safe">Blocked</span>'
        : dmg > 0 ? `<span class="damage">-${dmg} HP</span>` : '<span class="damage safe">Safe</span>';
      const math = damageMath(s, report, play.player);
      const from = math ? `<span class="from">${math}</span>` : '';
      const called = report.calls[play.player];
      const truth = called ? `<span class="from">${called === play.card.el ? `Called ${called}, kept it` : `Called ${called}, bluffed`}</span>` : '';
      const results = animating() ? '<span class="damage">&nbsp;</span>' : `${label}${from}${truth}`;
      return `<div class="play" data-play="${play.player}">
        <span class="card ${animate ? 'flip' : ''}" style="animation-delay:${order * 90}ms">${cardArt(play.card.el, play.card.power)}</span>
        ${nameOf(s, play.player)}${results}
      </div>`;
    }).join('');
    const story = animating() ? '' : roundStory(s, report).map((line) => `<li>${line}</li>`).join('');
    return `<div class="reveal" data-fx-shake>${plays}</div>${story ? `<ul class="story">${story}</ul>` : ''}`;
  }

  // Everyone's call, big and in color, with how often they've kept their word.
  function callsHtml(s) {
    const view = s.view;
    if (view.phase !== 'cards') return '';
    const alive = view.players.filter((p) => p.alive);
    const order = alive.filter((p) => p.index !== s.me).concat(alive.filter((p) => p.index === s.me));
    const fresh = session.callsRound !== view.round;
    session.callsRound = view.round;
    const tiles = order.map((p, n) => {
      const record = p.callsMade ? `kept ${p.callsKept} of ${p.callsMade}` : 'first call';
      return `<div class="call ${p.call ? `el-${p.call}` : 'no-call'} ${fresh ? 'pop' : ''}" style="animation-delay:${n * 140}ms">
        <span class="call-who">${nameOf(s, p.index)}</span>
        <span class="call-el">${p.call ? `${icon(p.call)}${cap(p.call)}` : 'No call'}</span>
        <span class="call-record">${record}</span>
      </div>`;
    }).join('');
    return `<div class="calls"><h3>The calls</h3><div class="call-row">${tiles}</div></div>`;
  }

  function knowledgeHtml(s) {
    const known = s.view.knowledge;
    if (!known) return '';
    const name = esc(s.view.players[known.target].name);
    const title = known.hand.length === 1 ? `${name} must play this card` : `${name}'s hand`;
    return `<div class="seen"><span>${title}</span><div class="row">${known.hand.map((c) => `<span class="card">${cardArt(c.el, c.power)}</span>`).join('')}</div></div>`;
  }

  function waitingText(s) {
    if (!s.waitingOn.length) return 'Moving on...';
    return `Waiting for ${s.waitingOn.map(esc).join(', ')}.`;
  }

  function middleHtml(s) {
    const view = s.view;
    const me = view.players[s.me];
    const sub = SUBS[me.sub];
    const lines = view.abilities.map((a) => `<li>${abilityLine(s, a)}</li>`).join('');
    const story = lines ? `<ul class="story">${lines}</ul>` : '';

    if (animating()) return revealHtml(s, s.report);
    if (s.stage === 'over') {
      const iWon = s.winners.includes(s.me);
      const others = s.winners.filter((i) => i !== s.me).map((i) => esc(view.players[i].name));
      const title = iWon ? (others.length ? `You tied with ${others.join(' and ')}` : 'You win') : `${others.join(' and ')} win${others.length > 1 ? '' : 's'}`;
      return `${revealHtml(s, s.report)}<p class="prompt big">${title}</p>
        ${s.isHost ? '<div class="buttons"><button class="action" id="back-to-lobby">Back to lobby</button></div>' : '<p class="prompt"><small>The host can start another game.</small></p>'}`;
    }
    if (s.stage === 'reveal') {
      return `${revealHtml(s, s.report)}${s.needs === 'ready' ? '<button class="action" id="next">Next round</button>' : `<p class="prompt"><small>${waitingText(s)}</small></p>`}`;
    }
    if (session.pick && session.pick.mode === 'target') {
      return `<p class="prompt">Choose a player for ${sub.name}.</p><button class="action quiet" id="back">Back</button>`;
    }
    if (session.pick && session.pick.mode === 'slot') {
      const t = view.players[session.pick.target];
      return `<p class="prompt">Choose one of ${esc(t.name)}'s face-down cards. They must play it.</p>
        <div class="slots">${Array.from({ length: t.faceDownCount }, (_, n) => `<button class="card" data-slot="${n}" aria-label="Face-down card ${n + 1}">${cardBack()}</button>`).join('')}</div>`;
    }
    switch (s.needs) {
      case 'ability':
        return `<div class="power-offer"><span class="power-card">${powerArt(me.sub)}</span><p class="prompt">You have ${me.charge} charge. Use ${sub.name} this round?<small>${sub.text}</small></p></div>
          <div class="buttons el-${me.element}">
            <button class="action power" id="use">Use ${sub.name} (${sub.cost} charge)</button>
            <button class="action quiet" id="hold">Hold your charge</button>
          </div>`;
      case 'call': {
        const forcedNote = view.forcedId ? ' You are being bloodbent, so you must play the marked card, but you can still lie about it.' : '';
        return `${story}${knowledgeHtml(s)}<p class="prompt">Call an element for everyone to see.<small>You can lie. Play what you call for +${CONFIG.callBonus} charge.${forcedNote}</small></p>
          <div class="buttons">${PX.elementsFor(s.elementCount).map((el) => `<button class="action power el-${el}" data-call="${el}">${icon(el)}<span>Call ${cap(el)}</span></button>`).join('')}</div>`;
      }
      case 'card':
        return `${callsHtml(s)}${story}${knowledgeHtml(s)}<p class="prompt">${view.myCall ? `You called ${view.myCall}. ` : ''}Choose a card to play.</p>`;
      case 'vote':
        return `${story}<p class="prompt">You are in the Spirit World. Vote for an element to get +1 power this round.</p>
          <div class="buttons">${PX.elementsFor(s.elementCount).map((el) => `<button class="action power el-${el}" data-vote="${el}">${icon(el)}<span>${cap(el)}</span></button>`).join('')}</div>`;
      default: {
        const forced = view.forcedId && view.phase === 'cards' ? '<p class="prompt">You are being bloodbent, so you must play the marked card.</p>' : '';
        return `${callsHtml(s)}${story}${knowledgeHtml(s)}${forced}<p class="prompt"><small>${waitingText(s)}</small></p>`;
      }
    }
  }

  function handHtml(s) {
    const view = s.view;
    if (!view.players[s.me].alive) return '';
    const canPlay = s.needs === 'card';
    const cards = view.hand.map((c) => {
      const label = `${cap(c.el)} ${c.power}${c.id === view.faceUpId ? ', visible to everyone' : ''}`;
      const notes = [];
      if (view.forcedId === c.id) notes.push('You must play this');
      else if (c.id === view.faceUpId) notes.push('Everyone can see this');
      if (canPlay && c.el === view.myCall) notes.push(`${notes.length ? '. ' : ''}+${CONFIG.callBonus} charge`);
      return `<div class="slot">
        <button class="card" data-card="${esc(c.id)}" aria-label="${label}" ${canPlay ? '' : 'disabled'}>${cardArt(c.el, c.power)}</button>
        <span class="tag">${notes.join('')}</span>
      </div>`;
    }).join('');
    return `<div class="hand">${cards}</div>`;
  }

  function renderGame(s) {
    const view = s.view;
    const me = view.players[s.me];
    const sub = SUBS[me.sub];
    const rivals = view.players.filter((p) => p.index !== s.me);
    const sudden = view.suddenDeath && s.stage === 'playing' ? `<span class="sudden">Sudden death: all damage +${view.suddenDeathBonus}</span>` : '';
    const round = s.report ? s.report.round : view.round;
    app.innerHTML = `
      <section class="table">
        <header class="topline">
          <h2>Round ${round}</h2>
          ${sudden}
          <span class="cycle">${cycleText(s.elementCount)} Same element: higher number wins. Play ${me.element} to earn charge.</span>
        </header>
        ${session.status === 'lost' ? '<p class="notice" role="alert">Lost the connection to the host. Trying to reconnect...</p>' : ''}
        ${session.message ? `<p class="notice" role="alert">${esc(session.message)}</p>` : ''}
        <div class="seats">${rivals.map((p) => seatHtml(s, p)).join('')}</div>
        <div class="middle"><div class="clock" id="countdown" aria-hidden="true"></div><div class="middle-body" aria-live="polite">${middleHtml(s)}</div></div>
        <div class="mine">
          <div class="me-line el-${me.element}${powerClasses(me)}" data-seat="${s.me}">
            <span class="who">${icon(me.element)}${sub.name}</span>
            ${hpMeter(me)}
            <span class="what">${sub.cost} charge: ${sub.text}</span>
          </div>
          ${handHtml(s)}
        </div>
      </section>`;
    bindGame(s);
    tick();
  }

  function bindGame(s) {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    const sub = SUBS[s.view.players[s.me].sub];
    on('use', () => {
      if (sub.needsTarget) {
        session.pick = { mode: 'target' };
        render();
      } else {
        session.send({ type: 'ability', choice: {} });
      }
    });
    on('hold', () => session.send({ type: 'ability', choice: null }));
    on('back', () => { session.pick = null; render(); });
    on('next', () => session.send({ type: 'ready' }));
    on('back-to-lobby', () => session.send({ type: 'lobby' }));
    app.querySelectorAll('[data-target]').forEach((b) => b.addEventListener('click', () => {
      const target = Number(b.dataset.target);
      if (s.view.players[s.me].sub === 'bloodbending') {
        session.pick = { mode: 'slot', target };
        render();
      } else {
        session.send({ type: 'ability', choice: { target } });
      }
    }));
    app.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
      session.send({ type: 'ability', choice: { target: session.pick.target, slot: Number(b.dataset.slot) } });
    }));
    app.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => session.send({ type: 'card', id: b.dataset.card })));
    app.querySelectorAll('[data-call]').forEach((b) => b.addEventListener('click', () => session.send({ type: 'call', el: b.dataset.call })));
    app.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => session.send({ type: 'vote', el: b.dataset.vote })));
  }

  function tick() {
    const el = document.getElementById('countdown');
    if (!el) return;
    if (session.deadline === null) {
      el.textContent = '';
      el.className = 'clock';
      return;
    }
    const left = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
    el.textContent = left;
    // The last few seconds turn red and pulse.
    el.className = `clock on${left <= 5 ? ' low' : ''}`;
  }

  function render() {
    if (session.mode !== 'room') return renderHome();
    if (session.state.screen === 'lobby') return renderLobby(session.state);
    return renderGame(session.state);
  }

  setInterval(tick, 500);

  window.addEventListener('beforeunload', (e) => {
    if (session.host && session.host.isPlaying()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session.mode === 'room') keepScreenOn();
  });

  // A refresh during a game drops you straight back into your seat.
  const urlRoom = roomFromUrl();
  if (urlRoom && hadSeatIn(urlRoom) && savedName()) joinRoom(urlRoom, savedName());
  else render();
})();
