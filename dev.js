// Effects playground (dev.html): a fake table with every animation one click away, using the game's own
// fx.js, so what plays here is exactly what plays in a game. Nothing here is part of the game itself.
(function () {
  const { SUBS, CONFIG } = PX;
  const { cardArt, cardBack } = PXArt;
  const app = document.getElementById('app');
  const panel = document.getElementById('dev-panel');
  const layer = PXFx.createLayer(document.body);

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const icon = (el) => `<img class="el-icon" src="art/board/icon-${el}.webp" alt="">`;

  // Seat 0 is you, at the bottom. Each player has a power and a card on the table.
  const players = [
    { name: 'You', sub: 'seismic', card: { el: 'fire', power: 4 } },
    { name: 'Reed', sub: 'healing', card: { el: 'earth', power: 5 } },
    { name: 'Flint', sub: 'metal', card: { el: 'water', power: 2 } },
    { name: 'Marsh', sub: 'lightning', card: { el: 'fire', power: 6 } },
  ];
  const state = { from: 0, to: [1], element: 'fire', amount: 1, blocked: false, speed: 1, faceDown: false };
  // Your hand at the bottom, and the hand Seismic Sense reveals when you read someone.
  const HAND = [{ el: 'water', power: 3 }, { el: 'fire', power: 5 }, { el: 'earth', power: 2 }, { el: 'water', power: 6 }, { el: 'earth', power: 4 }];
  const READ_HAND = [{ el: 'earth', power: 6 }, { el: 'water', power: 1 }, { el: 'fire', power: 3 }, { el: 'water', power: 5 }, { el: 'fire', power: 2 }];

  const element = (p) => SUBS[p.sub].element;

  function meter(p) {
    return `<div class="meter" data-hp-for="${players.indexOf(p)}"><span class="hp-label"><span class="hp-number">${CONFIG.maxHp}</span> HP</span><span class="hp-bar"><span style="width:100%"></span></span><span class="pips">${'<i class="on"></i>'.repeat(3)}${'<i></i>'.repeat(2)}</span></div>`;
  }

  function renderTable() {
    const rivals = players.slice(1).map((p, n) => `<div class="seat el-${element(p)}" data-seat="${n + 1}">
        <span class="who">${icon(element(p))}<span class="who-text">${p.name}<span class="class">${SUBS[p.sub].name}</span></span></span>
        <span class="showing"><span class="card">${cardArt(p.card.el, p.card.power)}</span></span>
        ${meter(p)}
        <span class="state"></span>
      </div>`).join('');
    const plays = players.map((p, i) => `<div class="play" data-play="${i}">
        <span class="card">${state.faceDown ? cardBack() : cardArt(p.card.el, p.card.power)}</span>${p.name}<span class="damage">&nbsp;</span>
      </div>`).join('');
    const me = players[0];
    app.innerHTML = `
      <section class="table">
        <header class="topline">
          <h2>Effects playground</h2>
          <span class="cycle">Water beats fire. Fire beats earth. Earth beats water. Same element: higher number wins.</span>
        </header>
        <div class="seats">${rivals}</div>
        <div class="middle"><div class="clock on" aria-hidden="true">20</div><div class="middle-body"><div class="reveal" data-fx-shake>${plays}</div></div></div>
        <div class="mine">
          <div class="me-line el-${element(me)}" data-seat="0">
            <span class="who">${icon(element(me))}${SUBS[me.sub].name}</span>
            ${meter(me)}
            <span class="what">${SUBS[me.sub].cost} charge: ${SUBS[me.sub].text}</span>
          </div>
          <div class="hand">${HAND.map((c) => `<div class="slot"><button class="card" disabled>${cardArt(c.el, c.power)}</button><span class="tag"></span></div>`).join('')}</div>
        </div>
      </section>`;
  }

  const seat = (i) => app.querySelector(`[data-seat="${i}"]`);
  const card = (i) => app.querySelector(`[data-play="${i}"] .card`);

  // Effects

  function hit() {
    const p = players[state.from];
    p.card = { el: state.element, power: p.card.power };
    card(state.from).innerHTML = cardArt(p.card.el, p.card.power);
    const targets = state.to.filter((i) => i !== state.from).map((i) => ({ card: card(i), amount: state.amount, blocked: state.blocked }));
    if (!targets.length) return flash('Pick at least one target other than the attacker.');
    return PXFx.attack(layer, card(state.from), state.element, targets);
  }

  async function power(sub) {
    const target = state.to.find((i) => i !== state.from);
    await PXFx.ability(layer, document.body, sub, seat(state.from), target === undefined ? null : seat(target));
    // When you read someone with Seismic Sense, their hand appears in the middle and flips face-up, as in a game.
    if (sub === 'seismic' && state.from === 0 && target !== undefined) {
      app.querySelectorAll('.seen').forEach((el) => el.remove());
      app.querySelector('.middle-body').insertAdjacentHTML('afterbegin', `<div class="seen"><span>${players[target].name}'s hand</span>
        <div class="row">${READ_HAND.map((c) => `<span class="card">${cardArt(c.el, c.power)}</span>`).join('')}</div></div>`);
      await PXFx.reveal(app.querySelectorAll('.seen .card'), cardBack());
    }
  }

  function strike() {
    const target = state.to.find((i) => i !== state.from);
    if (target === undefined) return flash('Pick a target for the strike.');
    return PXFx.strike(layer, card(target), SUBS.lightning.amount, state.blocked);
  }

  // A scripted reveal: everyone's hits in seat order, then a Lightning strike, like a real round.
  async function fullReveal() {
    reset();
    const script = [
      [0, 'fire', [[1, 1]]],
      [1, 'earth', [[2, 2]]],
      [2, 'water', [[0, 1], [3, 1]]],
      [3, 'fire', [[0, 1], [1, 2]]],
    ];
    for (const [from, el, hits] of script) {
      players[from].card.el = el;
      card(from).innerHTML = cardArt(el, players[from].card.power);
    }
    for (const [from, el, hits] of script) {
      await PXFx.attack(layer, card(from), el, hits.map(([to, amount]) => ({ card: card(to), amount })));
    }
    await PXFx.strike(layer, card(2), SUBS.lightning.amount, false);
  }

  function reset() {
    gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    layer.clear();
    document.querySelectorAll('.fx-label').forEach((el) => el.remove());
    renderTable();
    PXFx.setSpeed(state.speed);
  }

  function flash(text) {
    const note = panel.querySelector('.dev-note');
    note.textContent = text;
    gsap.fromTo(note, { opacity: 1 }, { opacity: 0, delay: 2, duration: 0.5 });
  }

  // Controls

  function renderPanel() {
    const seatPicks = (name, type, selected) => players.map((p, i) => `<label class="dev-chip"><input type="${type}" name="${name}" value="${i}" ${selected(i) ? 'checked' : ''}> ${p.name}</label>`).join('');
    panel.innerHTML = `
      <h2>Effects playground</h2>
      <p class="dev-hint">Click to play. Shift+click anything to replay it on a loop until you press Reset.</p>

      <h3>Who</h3>
      <div class="dev-row"><span class="dev-label">From</span>${seatPicks('from', 'radio', (i) => i === state.from)}</div>
      <div class="dev-row"><span class="dev-label">To</span>${seatPicks('to', 'checkbox', (i) => state.to.includes(i))}</div>

      <h3>Card hit</h3>
      <div class="dev-row">${['fire', 'water', 'earth'].map((el) => `<label class="dev-chip el-${el}"><input type="radio" name="element" value="${el}" ${state.element === el ? 'checked' : ''}> ${cap(el)}</label>`).join('')}</div>
      <div class="dev-row">
        <label class="dev-chip"><input type="radio" name="amount" value="1" ${state.amount === 1 ? 'checked' : ''}> 1 damage</label>
        <label class="dev-chip"><input type="radio" name="amount" value="2" ${state.amount === 2 ? 'checked' : ''}> 2 damage</label>
        <label class="dev-chip"><input type="checkbox" name="blocked" ${state.blocked ? 'checked' : ''}> Blocked</label>
      </div>
      <button class="dev-btn wide" data-run="hit">Play hit</button>

      <h3>Powers</h3>
      <div class="dev-grid">${Object.keys(SUBS).filter((k) => ['fire', 'water', 'earth'].includes(SUBS[k].element)).map((k) => `<button class="dev-btn el-${SUBS[k].element}" data-run="power:${k}">${SUBS[k].name}</button>`).join('')}</div>
      <button class="dev-btn wide" data-run="strike">Lightning strike (reveal)</button>

      <h3>Whole round</h3>
      <button class="dev-btn wide" data-run="reveal">Full reveal</button>

      <h3>Playback</h3>
      <div class="dev-row">${[1, 0.5, 0.25].map((v) => `<label class="dev-chip"><input type="radio" name="speed" value="${v}" ${state.speed === v ? 'checked' : ''}> ${v === 1 ? 'Normal' : v === 0.5 ? '½ speed' : '¼ speed'}</label>`).join('')}</div>
      <div class="dev-row"><label class="dev-chip"><input type="checkbox" name="facedown" ${state.faceDown ? 'checked' : ''}> Cards face-down</label></div>
      <button class="dev-btn wide quiet" id="dev-reset">Reset table</button>
      <p class="dev-note" aria-live="polite"></p>`;

    panel.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => {
      if (input.name === 'from') state.from = Number(input.value);
      if (input.name === 'to') state.to = [...panel.querySelectorAll('input[name="to"]:checked')].map((i) => Number(i.value));
      if (input.name === 'element') state.element = input.value;
      if (input.name === 'amount') state.amount = Number(input.value);
      if (input.name === 'blocked') state.blocked = input.checked;
      if (input.name === 'speed') { state.speed = Number(input.value); PXFx.setSpeed(state.speed); }
      if (input.name === 'facedown') { state.faceDown = input.checked; renderTable(); }
    }));
    panel.querySelectorAll("[data-run]").forEach((button) => button.addEventListener('click', (e) => play(button.dataset.run, e.shiftKey)));
    panel.querySelector('#dev-reset').addEventListener('click', () => { looping = null; reset(); });
  }

  let looping = null;
  async function play(what, loop) {
    const run = () => {
      if (what === 'hit') return hit();
      if (what === 'strike') return strike();
      if (what === 'reveal') return fullReveal();
      return power(what.split(':')[1]);
    };
    if (!loop) return run();
    const id = (looping = Symbol(what));
    while (looping === id) {
      await run();
      await new Promise((r) => setTimeout(r, 500 / state.speed));
      if (looping === id) reset();
    }
    return undefined;
  }

  // ?play=seismic (or hit, strike, reveal, or any power) plays that effect as soon as the page opens.
  const auto = new URLSearchParams(location.search).get('play');

  renderTable();
  renderPanel();
  if (auto) setTimeout(() => play(SUBS[auto] ? `power:${auto}` : auto, false), 600);
  window.PXDev = { play, reset, state };
})();
