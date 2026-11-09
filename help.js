// The how-to-play walkthrough: eight pages, each one showing a rule with the game's real cards and animations,
// and several letting you try it. Damage and charge come from the engine, so what it shows matches the game.
// The designs were worked out on the mock pages (mock-*.html); help.css holds the styles.
(function () {
  const { CONFIG, SUBS, BEATS, matchupDamage } = PX;
  const { cardArt, cardBack, powerArt } = PXArt;
  const KEY = 'px-seen-help';
  const dialog = document.getElementById('help');
  let step = 0;
  let run = 0;
  let layer = null;

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const icon = (el) => `<img class="el-icon" src="art/board/icon-${el}.webp" alt="">`;
  const word = (el) => `<span class="el-word el-${el}">${cap(el)}</span>`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const card = (el, power) => `<span class="card">${cardArt(el, power)}</span>`;
  const bubble = (el) => `<span class="rd-call">${icon(el)} ${cap(el)}</span>`;
  const $ = (sel) => dialog.querySelector(sel);
  const $$ = (sel) => [...dialog.querySelectorAll(sel)];
  const on = (root, sel, fn) => root.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => fn(b)));
  const pop = (el) => gsap.fromTo(el, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3)' });
  const ELEMENTS = ['water', 'fire', 'earth'];

  // Each page's animations check this, so leaving a page stops whatever it was doing.
  const alive = (id) => id === run;
  function stopAll() {
    run += 1;
    if (window.gsap) gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    if (layer) layer.clear();
    dialog.querySelectorAll('.fx-label, .cg-orb, .sp-orb').forEach((el) => el.remove());
  }

  // Powers and labels draw inside the tutorial window, which sits above the rest of the page.
  const power = (sub, user, target) => PXFx.ability(layer, dialog, sub, user, target || null);
  const hit = (from, to, el, amount) => PXFx.attack(layer, from, el, [{ card: to, amount }]);

  function flipUp(cards) {
    return gsap.fromTo(cards, { rotationY: 90, transformPerspective: 600 }, { rotationY: 0, duration: 0.28, stagger: 0.08, ease: 'back.out(2)' });
  }

  function dropCard(slot) {
    slot.innerHTML = `<span class="card">${cardBack()}</span>`;
    return gsap.fromTo(slot.firstChild, { y: -40, opacity: 0, rotation: -6 }, { y: 0, opacity: 1, rotation: 0, duration: 0.35, ease: 'back.out(1.8)' });
  }

  // Two cards that tie knock together and nothing happens.
  function bump(a, b) {
    return gsap.timeline()
      .to(a, { x: 26, duration: 0.16, ease: 'power2.in' })
      .to(b, { x: -26, duration: 0.16, ease: 'power2.in' }, '<')
      .to([a, b], { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
  }

  // Pages 1 and 2: the face-off. One matchup at a time, big, in the middle: the left card hits the right one.
  // It plays every matchup on its own, then the pills underneath replay any one.
  function faceoff({ title, matchups, ending }) {
    return {
      title,
      body: () => `
        <div class="faceoff">
          <span class="fo-slot fo-left"></span>
          <span class="fo-beats">&nbsp;</span>
          <span class="fo-slot fo-right"></span>
        </div>
        <div class="fo-pills" role="group" aria-label="Matchups">${matchups.map((m, n) => `<button class="fo-pill" data-pair="${n}">${m.pill}</button>`).join('')}</div>
        <p class="fo-caption" aria-live="polite">&nbsp;</p>`,
      async mount(id) {
        on(dialog, '[data-pair]', (b) => { stopAll(); this.show(run, Number(b.dataset.pair), true); });
        await wait(300);
        for (let n = 0; n < matchups.length; n++) {
          if (!alive(id)) return;
          await this.show(id, n);
          if (!alive(id)) return;
          await wait(900);
        }
        if (alive(id)) $('.fo-caption').innerHTML = `${ending} <strong>Tap one to see it again.</strong>`;
      },
      async show(id, n, only) {
        const m = matchups[n];
        const left = $('.fo-left');
        const right = $('.fo-right');
        $$('[data-pair]').forEach((p) => p.classList.toggle('on', Number(p.dataset.pair) === n));
        left.innerHTML = card(m.a.el, m.a.power);
        right.innerHTML = card(m.b.el, m.b.power);
        $('.fo-beats').textContent = m.middle || 'beats';
        $('.fo-caption').innerHTML = m.caption;
        await gsap.timeline()
          .fromTo(left.firstChild, { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.6)' })
          .fromTo(right.firstChild, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.6)' }, '<');
        await wait(250);
        if (!alive(id)) return;
        const amount = matchupDamage(3, m.a, m.b);
        if (amount) await hit(left.firstChild, right.firstChild, m.a.el, amount);
        else await bump(left.firstChild, right.firstChild);
        if (only && alive(id)) $('.fo-caption').innerHTML += '<br><small>Tap another, or Next.</small>';
      },
    };
  }

  // How each win sounds: water beats fire, fire beats earth, earth beats water.
  const SAYINGS = {
    water: `${word('water')} puts out ${word('fire')}`,
    fire: `${word('fire')} scorches ${word('earth')}`,
    earth: `${word('earth')} buries ${word('water')}`,
  };
  const beatsPage = faceoff({
    title: 'Who beats who',
    matchups: ELEMENTS.map((a) => {
      const b = BEATS[3][a][0];
      return { a: { el: a, power: 4 }, b: { el: b, power: 4 }, pill: `${icon(a)}<span>›</span>${icon(b)}`, caption: SAYINGS[a] };
    }),
    ending: 'And around it goes.',
  });

  const DAMAGE = [
    [{ el: 'fire', power: 2 }, { el: 'earth', power: 5 }, 'Fire beats earth, even with a smaller number.'],
    [{ el: 'fire', power: 5 }, { el: 'fire', power: 3 }, 'Both fire, so the bigger number wins.'],
    [{ el: 'fire', power: 5 }, { el: 'earth', power: 3 }, 'Fire beats earth <em>and</em> has the bigger number. Double hit.'],
    [{ el: 'fire', power: 4 }, { el: 'fire', power: 4 }, 'Exact same card. Nobody gets hurt.'],
  ];
  const damagePage = faceoff({
    title: 'Doing damage',
    matchups: DAMAGE.map(([a, b, why]) => {
      const amount = matchupDamage(3, a, b);
      return {
        a, b,
        pill: `${icon(a.el)}${a.power}<span>›</span>${icon(b.el)}${b.power}`,
        middle: amount ? 'hits' : 'vs',
        caption: `<span class="dmg${amount ? '' : ' none'}">${amount ? `-${amount} HP` : 'Nothing'}</span><strong>${why}</strong>`,
      };
    }),
    ending: 'Win, and they lose 1. Win big, and they lose 2.',
  });

  // Page 3: how a round goes. A two-player demo plays the three steps; then you can try a round yourself.
  const ROUND_STEPS = [
    { title: 'Call it', lines: ['Call an element.', 'Use your sub-element, if you can. (More on those next.)'] },
    { title: 'Pick a card', lines: ['Choose a card and keep it hidden.'] },
    { title: 'Flip', lines: ['Everyone flips at once.'] },
  ];
  const YOU = { call: 'fire', card: { el: 'fire', power: 4 }, sub: 'combustion' };
  const REED = { call: 'water', card: { el: 'earth', power: 5 } };
  const TRY_HAND = [{ el: 'fire', power: 4 }, { el: 'water', power: 3 }, { el: 'earth', power: 2 }];

  const duoSeat = (who, name) => `<div class="duo-seat" data-who="${who}">
      <span class="duo-name">${name}</span>
      <span class="duo-call"></span>
      <span class="slot"><span class="rd-empty"></span></span>
    </div>`;

  // Both cards flip, then whoever won hits the other. Combustion doubles a fire card's damage.
  async function duoFlip(id, root, mine, boosted) {
    const yourCard = root.querySelector('[data-who="you"] .card');
    const reedCard = root.querySelector('[data-who="reed"] .card');
    yourCard.innerHTML = cardArt(mine.el, mine.power);
    reedCard.innerHTML = cardArt(REED.card.el, REED.card.power);
    await flipUp([reedCard, yourCard]);
    const youHit = matchupDamage(3, mine, REED.card) * (boosted && mine.el === 'fire' ? 2 : 1);
    const reedHit = matchupDamage(3, REED.card, mine);
    if (!alive(id)) return { youHit, reedHit };
    if (youHit) await hit(yourCard, reedCard, mine.el, youHit);
    if (reedHit && alive(id)) await hit(reedCard, yourCard, REED.card.el, reedHit);
    return { youHit, reedHit };
  }

  const roundPage = {
    title: 'How a round goes',
    mode: 'watch',
    reset() { this.mode = 'watch'; },
    body() {
      if (this.mode === 'try') {
        return `
          <div class="rd-dots">${ROUND_STEPS.map((s, n) => `<span class="rd-dot"><b>${n + 1}</b> ${s.title}</span>`).join('')}</div>
          <div class="duo">${duoSeat('reed', 'Reed')}${duoSeat('you', 'You')}</div>
          <div class="ask-box" aria-live="polite"></div>`;
      }
      return `
        <div class="rd-pills" role="group" aria-label="Steps">${ROUND_STEPS.map((s, n) => `<button class="rd-pill" data-step="${n}"><b>${n + 1}</b> ${s.title}</button>`).join('<span class="rd-arrow">›</span>')}</div>
        <div class="duo">${duoSeat('reed', 'Reed')}${duoSeat('you', 'You')}</div>
        <p class="rd-step" aria-live="polite"></p>
        <div class="buttons center"><button class="action small" id="try">Try it yourself</button></div>`;
    },
    async mount(id) {
      if (this.mode === 'try') return this.tryIt(id);
      $('#try').addEventListener('click', () => { this.mode = 'try'; render(); });
      on(dialog, '.rd-pill', (b) => { stopAll(); this.show(run, Number(b.dataset.step)); });
      for (let n = 0; n < 3; n++) {
        if (!alive(id)) return undefined;
        await this.show(id, n);
        await wait(1200);
      }
      return undefined;
    },
    // Sets the table to how it looks before step n, then plays step n.
    async show(id, n) {
      const duo = $('.duo');
      duo.innerHTML = `${duoSeat('reed', 'Reed')}${duoSeat('you', 'You')}`;
      const you = duo.querySelector('[data-who="you"]');
      const reed = duo.querySelector('[data-who="reed"]');
      if (n > 0) { you.querySelector('.duo-call').innerHTML = bubble(YOU.call); reed.querySelector('.duo-call').innerHTML = bubble(REED.call); }
      if (n > 1) { you.querySelector('.slot').innerHTML = `<span class="card">${cardBack()}</span>`; reed.querySelector('.slot').innerHTML = `<span class="card">${cardBack()}</span>`; }
      $$('.rd-pill').forEach((p, k) => p.classList.toggle('on', k === n));
      $('.rd-step').innerHTML = `<span class="rd-num">Step ${n + 1} of 3</span><strong>${ROUND_STEPS[n].title}</strong>${ROUND_STEPS[n].lines.map((l) => `<span>${l}</span>`).join('')}`;
      await wait(500);
      if (!alive(id)) return;
      if (n === 0) {
        for (const [s, p] of [[you, YOU], [reed, REED]]) {
          s.querySelector('.duo-call').innerHTML = bubble(p.call);
          pop(s.querySelector('.rd-call'));
          await wait(450);
          if (!alive(id)) return;
        }
        await power(YOU.sub, you);
      } else if (n === 1) {
        await dropCard(you.querySelector('.slot'));
        await wait(200);
        if (alive(id)) await dropCard(reed.querySelector('.slot'));
      } else {
        await duoFlip(id, duo, YOU.card, true);
      }
    },
    // The same round against Reed, one question at a time.
    tryIt(id) {
      const box = $('.ask-box');
      const you = $('[data-who="you"]');
      const reed = $('[data-who="reed"]');
      const state = { call: null, boosted: false, card: null };
      const dot = (n) => $$('.rd-dot').forEach((d, k) => { d.classList.toggle('on', k === n); d.classList.toggle('done', k < n); });
      const ask = (title, line, buttons) => {
        box.innerHTML = `<strong>${title}</strong><span>${line}</span><div class="ask-buttons">${buttons}</div>`;
        gsap.fromTo(box, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 });
      };

      const askCall = () => {
        dot(0);
        ask('Call an element', 'What will you say you’re playing?', ['fire', 'water', 'earth'].map((el) => `<button class="action quiet" data-call="${el}">${icon(el)} ${cap(el)}</button>`).join(''));
        on(box, '[data-call]', async (b) => {
          state.call = b.dataset.call;
          box.innerHTML = '';
          you.querySelector('.duo-call').innerHTML = bubble(state.call);
          pop(you.querySelector('.rd-call'));
          await wait(400);
          if (!alive(id)) return;
          reed.querySelector('.duo-call').innerHTML = bubble(REED.call);
          pop(reed.querySelector('.rd-call'));
          await wait(500);
          if (alive(id)) askPower();
        });
      };

      const askPower = () => {
        ask('Use your sub-element?', 'You have enough charge for <strong>Combustion</strong>: your next fire card does double damage.',
          `<span class="ask-power">${powerArt('combustion')}</span><button class="action" data-use="yes">Use it</button><button class="action quiet" data-use="no">Not now</button>`);
        on(box, '[data-use]', async (b) => {
          box.innerHTML = '';
          if (b.dataset.use === 'yes') {
            state.boosted = true;
            await power('combustion', you);
          }
          if (alive(id)) askCard();
        });
      };

      const askCard = () => {
        dot(1);
        ask('Pick a card', 'Reed won’t see it until the flip.', `<div class="tap-row">${TRY_HAND.map((c, n) => `<button class="card" data-card="${n}" aria-label="${cap(c.el)} ${c.power}">${cardArt(c.el, c.power)}</button>`).join('')}</div>`);
        on(box, '[data-card]', async (b) => {
          state.card = TRY_HAND[Number(b.dataset.card)];
          box.innerHTML = '';
          await dropCard(you.querySelector('.slot'));
          await wait(250);
          if (!alive(id)) return;
          await dropCard(reed.querySelector('.slot'));
          if (alive(id)) askFlip();
        });
      };

      const askFlip = () => {
        dot(2);
        ask('Flip', 'Everyone flips at once.', '<button class="action" id="do-flip">Flip</button>');
        on(box, '#do-flip', async () => {
          box.innerHTML = '';
          const { youHit, reedHit } = await duoFlip(id, $('.duo'), state.card, state.boosted);
          if (!alive(id)) return;
          const result = youHit ? `You hit Reed for ${youHit}.` : reedHit ? `Reed hits you for ${reedHit}.` : 'Nobody gets hurt.';
          const kept = state.call === state.card.el ? ` You played what you called: <strong>+${CONFIG.callBonus} charge</strong>.` : '';
          ask(result, `Reed called water but played earth.${kept}`, '<button class="action quiet small" id="again">Play again</button><button class="action quiet small" id="demo">Watch the demo</button>');
          on(box, '#again', () => render());
          on(box, '#demo', () => { this.mode = 'watch'; render(); });
        });
      };

      askCall();
    },
  };

  // Page 4: choose your sub-element. Tap any of the six to watch it work on a small table.
  const SUB_ORDER = ['combustion', 'lightning', 'seismic', 'metal', 'healing', 'bloodbending'];
  const SUB_LINES = {
    combustion: 'Your next fire card does double damage.',
    lightning: 'Deal 3 damage to anyone.',
    seismic: 'See someone’s hand before the round.',
    metal: 'Block all incoming damage this round.',
    healing: 'Heal 2 HP.',
    bloodbending: 'Choose a face-down card an opponent has to play this round.',
  };
  // A small table for each power: Reed on top, you below. Cards marked down start face-down.
  const SCENES = {
    combustion: { you: { hp: 12, cards: [{ el: 'fire', power: 4 }] }, reed: { hp: 12, cards: [{ el: 'earth', power: 3 }] } },
    lightning: { you: { hp: 12, cards: [{ el: 'fire', power: 2 }] }, reed: { hp: 12, cards: [{ el: 'water', power: 5 }] } },
    seismic: { you: { hp: 12, cards: [{ el: 'earth', power: 4 }] }, reed: { hp: 12, down: true, cards: [{ el: 'water', power: 2 }, { el: 'fire', power: 5 }, { el: 'earth', power: 1 }, { el: 'water', power: 6 }] } },
    metal: { you: { hp: 12, cards: [{ el: 'earth', power: 2 }] }, reed: { hp: 12, cards: [{ el: 'fire', power: 5 }] } },
    healing: { you: { hp: 6, cards: [{ el: 'water', power: 3 }] }, reed: { hp: 12, cards: [{ el: 'earth', power: 4 }] } },
    bloodbending: { you: { hp: 12, cards: [{ el: 'water', power: 3 }] }, reed: { hp: 12, down: true, cards: [{ el: 'fire', power: 6 }, { el: 'earth', power: 1 }, { el: 'water', power: 4 }] } },
  };

  function miniSeat(who, name, seat) {
    return `<div class="mini-seat mini-${who}" data-who="${who}">
      <span class="mini-name">${name}</span>
      <span class="mini-hp"><b>${seat.hp}</b> HP<span class="mini-bar"><i style="width:${(seat.hp / CONFIG.maxHp) * 100}%"></i></span></span>
      <div class="mini-cards">${seat.cards.map((c) => `<span class="slot"><span class="card">${seat.down ? cardBack() : cardArt(c.el, c.power)}</span></span>`).join('')}</div>
    </div>`;
  }

  function setMiniHp(seat, hp) {
    const b = seat.querySelector('.mini-hp b');
    const counter = { v: Number(b.textContent) };
    gsap.to(counter, { v: hp, duration: 0.5, onUpdate: () => { b.textContent = Math.round(counter.v); } });
    gsap.to(seat.querySelector('.mini-bar i'), { width: `${(hp / CONFIG.maxHp) * 100}%`, duration: 0.5 });
    gsap.fromTo(seat.querySelector('.mini-hp'), { scale: 1.25 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  // Plays one power start to finish: the power goes off, then you see what it does.
  async function playPower(id, sub, caption) {
    const scene = SCENES[sub];
    const you = $('.mini-you');
    const reed = $('.mini-reed');
    const yourCard = you.querySelector('.card');
    const reedCards = [...reed.querySelectorAll('.card')];
    const say = (html) => { if (alive(id)) caption.innerHTML = html; };
    say('&nbsp;');
    await wait(300);
    if (!alive(id)) return;
    if (sub === 'combustion') {
      await power(sub, you);
      if (!alive(id)) return;
      say('Fire beats earth, so normally that’s 1 damage...');
      await hit(yourCard, reedCards[0], 'fire', 2);
      setMiniHp(reed, scene.reed.hp - 2);
      say('...but Combustion makes it <strong>2</strong>.');
    } else if (sub === 'lightning') {
      await power(sub, you, reed);
      if (!alive(id)) return;
      say('When the cards flip, the bolt lands.');
      await wait(400);
      if (!alive(id)) return;
      await PXFx.strike(layer, reedCards[0], SUBS.lightning.amount, false);
      setMiniHp(reed, scene.reed.hp - SUBS.lightning.amount);
      say(`<strong>${SUBS.lightning.amount} damage</strong>, whatever cards got played.`);
    } else if (sub === 'seismic') {
      await power(sub, you, reed);
      if (!alive(id)) return;
      reedCards.forEach((el, n) => { el.innerHTML = cardArt(scene.reed.cards[n].el, scene.reed.cards[n].power); });
      await PXFx.reveal(reedCards, cardBack());
      say('Only you see it. Now you know what Reed <strong>can</strong> play.');
    } else if (sub === 'metal') {
      await power(sub, you);
      if (!alive(id)) return;
      say('Reed’s fire beats your earth...');
      await PXFx.attack(layer, reedCards[0], 'fire', [{ card: yourCard, amount: 2, blocked: true }]);
      say('...and it <strong>bounces right off</strong>.');
    } else if (sub === 'healing') {
      await power(sub, you);
      if (!alive(id)) return;
      setMiniHp(you, scene.you.hp + SUBS.healing.amount);
      say(`Back up to <strong>${scene.you.hp + SUBS.healing.amount} HP</strong>.`);
    } else if (sub === 'bloodbending') {
      await power(sub, you, reed);
      if (!alive(id)) return;
      say('You grab one of Reed’s face-down cards, without seeing it...');
      const pick = reedCards[1];
      await gsap.to(pick, { y: -14, duration: 0.25, ease: 'power2.out' });
      await wait(450);
      if (!alive(id)) return;
      pick.innerHTML = cardArt(scene.reed.cards[1].el, scene.reed.cards[1].power);
      await PXFx.reveal([pick], cardBack());
      gsap.to(pick, { boxShadow: '0 0 0 3px #C0182B, 0 0 18px #C0182B', duration: 0.3 });
      say('...an <strong>Earth 1</strong>. Reed has to play it. Only you two know.');
    }
  }

  const subsPage = {
    title: 'Choose your sub-element',
    index: 0,
    reset() { this.index = 0; },
    body() {
      const key = SUB_ORDER[this.index];
      const meta = `<span class="meta">${icon(SUBS[key].element)} ${cap(SUBS[key].element)} · costs ${SUBS[key].cost} charge</span>`;
      return `
        <p class="ask">You pick one of these before the game starts. <strong>Tap one to see what it does.</strong></p>
        <div class="pk-row">${['fire', 'earth', 'water'].map((el) => `<div class="pk-group el-${el}">${SUB_ORDER.filter((k) => SUBS[k].element === el).map((k) => `<button class="pk ${k === key ? 'on' : ''}" data-key="${k}" aria-label="${SUBS[k].name}">${powerArt(k)}<span>${SUBS[k].name}</span></button>`).join('')}</div>`).join('')}</div>
        <div class="pk-stage">
          <p class="pk-line"><strong>${SUBS[key].name}.</strong> ${SUB_LINES[key]} ${meta}</p>
          <div class="mini-table">${miniSeat('reed', 'Reed', SCENES[key].reed)}${miniSeat('you', 'You', SCENES[key].you)}</div>
          <p class="pw-caption" aria-live="polite">&nbsp;</p>
        </div>`;
    },
    mount(id) {
      on(dialog, '.pk', (b) => { this.index = SUB_ORDER.indexOf(b.dataset.key); render(); });
      playPower(id, SUB_ORDER[this.index], $('.pw-caption'));
    },
  };

  // Page 5: charging your sub-element. You picked Lightning (fire, 4 charge); each round you call and play,
  // and a checklist shows what you earned, until Lightning is ready.
  const CHARGE_SUB = 'lightning';
  const MINE = SUBS[CHARGE_SUB].element;
  const COST = SUBS[CHARGE_SUB].cost;
  const CHARGE_HANDS = [
    [{ el: 'fire', power: 5 }, { el: 'water', power: 2 }, { el: 'earth', power: 4 }],
    [{ el: 'earth', power: 2 }, { el: 'fire', power: 3 }, { el: 'water', power: 1 }],
    [{ el: 'water', power: 3 }, { el: 'earth', power: 5 }, { el: 'fire', power: 4 }],
  ];
  const checks = (call, c) => ({ base: CONFIG.chargePerRound, called: c.el === call ? CONFIG.callBonus : 0, mine: c.el === MINE ? CONFIG.elementBonus : 0 });
  const total = (c) => c.base + c.called + c.mine;

  function meterHtml(charge) {
    return `<div class="cg-meter">
      <span class="cg-thumb">${powerArt(CHARGE_SUB)}</span>
      <span class="cg-pips">${Array.from({ length: CONFIG.maxCharge }, (_, n) => `<i class="${n < charge ? 'on' : ''}${n === COST - 1 ? ' cost' : ''}"></i>`).join('')}</span>
    </div>`;
  }

  // A glowing drop flies from where the charge was earned into the next empty dot.
  async function fill(meter, from, amount) {
    const pips = [...meter.querySelectorAll('.cg-pips i')];
    const start = pips.filter((p) => p.classList.contains('on')).length;
    const src = from.getBoundingClientRect();
    for (let k = 0; k < amount && start + k < pips.length; k++) {
      const pip = pips[start + k];
      const to = pip.getBoundingClientRect();
      const orb = document.createElement('span');
      orb.className = 'cg-orb';
      dialog.appendChild(orb);
      gsap.set(orb, { left: src.left + src.width / 2, top: src.top + src.height / 2, xPercent: -50, yPercent: -50 });
      gsap.to(orb, { left: to.left + to.width / 2, top: to.top + to.height / 2, duration: 0.45, ease: 'power2.in', onComplete: () => {
        orb.remove();
        pip.classList.add('on');
        gsap.fromTo(pip, { scale: 2 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
      } });
      await wait(150);
    }
    await wait(500);
  }

  // Ticks each line of the checklist that counts and sends its charge into the dots.
  async function tick(id, receipt, meter, c) {
    receipt.querySelectorAll('li').forEach((li) => li.classList.remove('yes', 'no'));
    for (const key of ['base', 'called', 'mine']) {
      if (!alive(id)) return;
      const li = receipt.querySelector(`[data-r="${key}"]`);
      li.classList.add(c[key] ? 'yes' : 'no');
      if (c[key]) {
        gsap.fromTo(li, { scale: 1.06 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
        await fill(meter, li.querySelector('b'), c[key]);
      } else {
        await wait(350);
      }
    }
  }

  const chargePage = {
    title: 'Charging your sub-element',
    body: () => `
      <div class="cg-intro">
        <p><strong>Your sub-element needs charge before you can use it.</strong></p>
        <p>Say you picked <strong>Lightning</strong>. It needs <strong>${COST} charge</strong>, and it’s a ${icon(MINE)} fire sub-element, so fire is your element.</p>
        <p class="cg-how">Here’s how you charge up:</p>
      </div>
      <div class="cg-split">
        <div class="cg-you">
          <span class="duo-name">You</span>
          <span class="duo-call"></span>
          <span class="slot"><span class="rd-empty"></span></span>
          ${meterHtml(0)}
        </div>
        <ul class="cg-receipt">
          <li data-r="base"><b>+${CONFIG.chargePerRound}</b> Every round</li>
          <li data-r="called"><b>+${CONFIG.callBonus}</b> You played what you called</li>
          <li data-r="mine"><b>+${CONFIG.elementBonus}</b> It’s ${icon(MINE)} fire, your element</li>
        </ul>
      </div>
      <div class="ask-box" aria-live="polite"></div>
      <div class="cg-target"><div class="cg-you" data-who="reed"><span class="duo-name">Reed</span><span class="slot"><span class="card">${cardBack()}</span></span></div></div>`,
    mount(id) {
      const box = $('.ask-box');
      const split = $('.cg-split');
      const meter = split.querySelector('.cg-meter');
      let sum = 0;
      let round = 0;
      let call = null;

      const askCall = () => {
        split.querySelector('.duo-call').innerHTML = '';
        split.querySelector('.slot').innerHTML = '<span class="rd-empty"></span>';
        split.querySelectorAll('.cg-receipt li').forEach((li) => li.classList.remove('yes', 'no'));
        box.innerHTML = `<strong>Round ${round + 1}: call an element</strong><span>Tell everyone what you’re playing. You can lie.</span>
          <div class="ask-buttons">${['fire', 'water', 'earth'].map((el) => `<button class="action quiet" data-call="${el}">${icon(el)} ${cap(el)}</button>`).join('')}</div>`;
        on(box, '[data-call]', (b) => {
          call = b.dataset.call;
          split.querySelector('.duo-call').innerHTML = bubble(call);
          pop(split.querySelector('.rd-call'));
          askCard();
        });
      };

      const askCard = () => {
        const hand = CHARGE_HANDS[round % CHARGE_HANDS.length];
        box.innerHTML = `<strong>Now pick a card</strong><span>You called ${call}.</span>
          <div class="ask-buttons"><div class="tap-row">${hand.map((c, n) => `<button class="card" data-card="${n}" aria-label="${cap(c.el)} ${c.power}">${cardArt(c.el, c.power)}</button>`).join('')}</div></div>`;
        on(box, '[data-card]', async (b) => {
          const played = hand[Number(b.dataset.card)];
          box.innerHTML = '';
          split.querySelector('.slot').innerHTML = card(played.el, played.power);
          await gsap.fromTo(split.querySelector('.card'), { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.8)' });
          const c = checks(call, played);
          await tick(id, split.querySelector('.cg-receipt'), meter, c);
          if (!alive(id)) return;
          sum = Math.min(CONFIG.maxCharge, sum + total(c));
          round += 1;
          box.innerHTML = `<strong>+${total(c)} charge</strong><span>You have ${sum} now.</span>`;
          if (sum >= COST) {
            ready();
            return;
          }
          box.insertAdjacentHTML('beforeend', '<div class="ask-buttons"><button class="action small" id="next-round">Next round</button></div>');
          on(box, '#next-round', askCall);
        });
      };

      const ready = () => {
        meter.classList.add('ready');
        box.innerHTML = `<strong>Lightning is ready!</strong><span>You got there in ${round} round${round > 1 ? 's' : ''}.</span>
          <div class="ask-buttons"><button class="action" id="zap">Use Lightning on Reed</button></div>`;
        on(box, '#zap', async () => {
          box.innerHTML = '';
          const target = $('.cg-target');
          await gsap.to(target, { opacity: 1, duration: 0.3 });
          const reed = target.querySelector('[data-who="reed"]');
          await power(CHARGE_SUB, split.querySelector('.cg-you'), reed);
          if (!alive(id)) return;
          await PXFx.strike(layer, reed.querySelector('.card'), SUBS[CHARGE_SUB].amount, false);
          if (!alive(id)) return;
          meter.classList.remove('ready');
          [...meter.querySelectorAll('.cg-pips i.on')].reverse().slice(0, COST).forEach((p, k) => gsap.delayedCall(k * 0.12, () => p.classList.remove('on')));
          box.innerHTML = `<strong>${SUBS[CHARGE_SUB].amount} damage to Reed</strong><span>That used ${COST} charge. You can hold up to ${CONFIG.maxCharge}, and each sub-element costs a different amount.</span>
            <div class="ask-buttons"><button class="action quiet small" id="again">Try again</button></div>`;
          on(box, '#again', () => render());
        });
      };

      askCall();
    },
  };

  // Page 6: everyone at once. Your three fights play one at a time, then the whole table.
  const TABLE = [
    { name: 'You', card: { el: 'fire', power: 4 } },
    { name: 'Reed', card: { el: 'earth', power: 5 } },
    { name: 'Mia', card: { el: 'water', power: 2 } },
    { name: 'Jo', card: { el: 'fire', power: 6 } },
  ];
  const dmg = (from, to) => (from === to ? 0 : matchupDamage(3, TABLE[from].card, TABLE[to].card));
  const hitsOn = (i) => TABLE.map((p, j) => ({ from: j, amount: dmg(j, i) })).filter((h) => h.amount > 0);
  const lost = (i) => hitsOn(i).reduce((sum, h) => sum + h.amount, 0);
  const tableHtml = () => `<ul class="tut-board ev-board">${TABLE.map((p, i) => `<li class="tut-seat ev-seat${i === 0 ? ' tut-you' : ''}" data-seat="${i}">
      <span class="tut-name">${p.name}</span>
      <span class="slot"><span class="card">${cardBack()}</span></span>
      <span class="ev-result"></span>
    </li>`).join('')}</ul>`;
  const seatEl = (i) => $(`[data-seat="${i}"]`);
  const cardEl = (i) => seatEl(i).querySelector('.card');
  const MY_FIGHTS = [1, 2, 3].map((j) => {
    const them = TABLE[j];
    const out = dmg(0, j);
    const inn = dmg(j, 0);
    let text = 'Same card. Nothing happens.';
    if (out) text = `Your fire beats ${them.name}’s ${them.card.el}. <strong>${them.name} loses ${out}.</strong>`;
    else if (inn && them.card.el === TABLE[0].card.el) text = `${them.name}’s fire is bigger than yours. <strong>You lose ${inn}.</strong>`;
    else if (inn) text = `${them.name}’s ${them.card.el} beats your fire. <strong>You lose ${inn}.</strong>`;
    return { j, out, inn, text };
  });

  const everyonePage = {
    title: 'Everyone at once',
    body: () => `<p class="ask ev-ask">It’s not one on one. <strong>Your card fights every other card on the table.</strong></p>${tableHtml()}
      <p class="fo-caption" aria-live="polite">&nbsp;</p><div class="buttons center"><button class="action small" id="all" hidden>Watch the whole table</button></div>`,
    async flip() {
      TABLE.forEach((p, i) => { cardEl(i).innerHTML = cardArt(p.card.el, p.card.power); });
      await flipUp(TABLE.map((_, i) => cardEl(i)));
    },
    async mount(id) {
      const caption = $('.fo-caption');
      $('#all').addEventListener('click', () => this.whole());
      await wait(500);
      if (!alive(id)) return;
      await this.flip();
      if (!alive(id)) return;
      await wait(400);
      for (const m of MY_FIGHTS) {
        if (!alive(id)) return;
        $$('.ev-seat').forEach((s, k) => s.classList.toggle('dim', k !== 0 && k !== m.j));
        caption.innerHTML = `<span class="ev-vs">You vs ${TABLE[m.j].name}</span>${m.text}`;
        await wait(700);
        if (!alive(id)) return;
        if (m.out) await hit(cardEl(0), cardEl(m.j), TABLE[0].card.el, m.out);
        if (m.inn && alive(id)) await hit(cardEl(m.j), cardEl(0), TABLE[m.j].card.el, m.inn);
        await wait(900);
      }
      if (!alive(id)) return;
      $$('.ev-seat').forEach((s) => s.classList.remove('dim'));
      caption.innerHTML = `<span class="dmg">You lose ${lost(0)}</span><strong>Mia and Jo both beat you, so both hits count.</strong>`;
      $('#all').hidden = false;
    },
    // Resets the table and plays every player's hits, then shows what each seat lost and from whom.
    async whole() {
      stopAll();
      const id = run;
      $('.ev-board').outerHTML = tableHtml();
      $('#all').hidden = true;
      const caption = $('.fo-caption');
      caption.innerHTML = 'And everyone else’s cards fight too.';
      await this.flip();
      for (let i = 0; i < TABLE.length; i++) {
        if (!alive(id)) return;
        const targets = TABLE.map((_, j) => ({ card: cardEl(j), amount: dmg(i, j) })).filter((t) => t.amount > 0);
        if (targets.length) await PXFx.attack(layer, cardEl(i), TABLE[i].card.el, targets);
      }
      if (!alive(id)) return;
      TABLE.forEach((p, i) => {
        const hits = hitsOn(i);
        seatEl(i).querySelector('.ev-result').innerHTML = hits.length
          ? `<strong class="bad">-${lost(i)} HP</strong>${hits.map((h) => `${TABLE[h.from].name} ${h.amount}`).join(', ')}`
          : '<strong class="good">No damage</strong>';
      });
      caption.innerHTML = '<strong>Add up everyone who beat you. That’s what you lose.</strong>';
    },
  };

  // Page 7: knocked out. You're in the Spirit World with Sam, who votes fire. Your vote decides whether fire
  // gets +1 (Reed's fire 5 then hits Jo's earth 5 for 2) or it's a tie and nothing changes.
  const SP_REED = { el: 'fire', power: 5 };
  const SP_JO = { el: 'earth', power: 5 };
  const ghost = (who, name) => `<div class="sp-ghost" data-who="${who}"><span class="sp-ghost-card">${cardBack()}</span><span class="sp-name">${name}</span></div>`;
  const spSeat = (who, name, c) => `<div class="sp-seat" data-who="${who}"><span class="sp-name">${name}</span><span class="slot"><span class="card" data-el="${c ? c.el : ''}">${c ? cardArt(c.el, c.power) : cardBack()}</span></span></div>`;
  const spTable = (show) => `<div class="sp-table">${spSeat('reed', 'Reed', show ? SP_REED : null)}${spSeat('jo', 'Jo', show ? SP_JO : null)}</div>`;
  function floatGhosts() {
    $$('.sp-ghost-card').forEach((g, n) => gsap.to(g, { y: -6, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: n * 0.4 }));
  }

  // A vote flies from a spirit to its element's counter and bumps it.
  function vote(fromEl, el) {
    return new Promise((resolve) => {
      const chip = $(`.sp-chip[data-el="${el}"]`);
      const a = fromEl.getBoundingClientRect();
      const b = chip.getBoundingClientRect();
      const orb = document.createElement('span');
      orb.className = 'sp-orb';
      orb.innerHTML = icon(el);
      dialog.appendChild(orb);
      gsap.set(orb, { left: a.left + a.width / 2, top: a.top + a.height / 2, xPercent: -50, yPercent: -50 });
      gsap.to(orb, { left: b.left + b.width / 2, top: b.top + b.height / 2, duration: 0.6, ease: 'power2.inOut', onComplete: () => {
        orb.remove();
        const count = chip.querySelector('b');
        count.textContent = Number(count.textContent) + 1;
        gsap.fromTo(chip, { scale: 1.25 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
        resolve();
      } });
    });
  }

  // Every card of the boosted element on the table gets +1: the number changes and glows.
  function boost(el) {
    $$('.sp-seat').forEach((s) => {
      const c = s.querySelector('.card');
      const num = c.querySelector('.card-num');
      if (!num || c.dataset.el !== el) return;
      num.textContent = Number(num.textContent) + 1;
      num.classList.add('boosted');
      gsap.fromTo(c, { boxShadow: '0 0 0 3px #9FE8FF, 0 0 26px #6FD3F0' }, { boxShadow: '0 0 0 0px rgba(0,0,0,0), 0 0 0px rgba(0,0,0,0)', duration: 1.4, clearProps: 'boxShadow' });
      const tag = document.createElement('span');
      tag.className = 'sp-plus';
      tag.textContent = '+1';
      s.querySelector('.slot').appendChild(tag);
      gsap.fromTo(tag, { xPercent: -50, scale: 0.2, y: 0, opacity: 1 }, { scale: 1.2, y: -26, duration: 0.5, ease: 'back.out(3)' });
    });
  }

  const spiritPage = {
    title: 'Knocked out? Not done yet',
    body: () => `
      <div class="sp-world"><span class="sp-world-label">Spirit World</span><div class="sp-ghosts">${ghost('you', 'You')}${ghost('sam', 'Sam')}</div></div>
      <div class="sp-tally">${ELEMENTS.map((el) => `<span class="sp-chip el-${el}" data-el="${el}">${icon(el)} ${cap(el)} <b>0</b></span>`).join('')}</div>
      ${spTable(false)}
      <div class="ask-box" aria-live="polite"></div>`,
    mount(id) {
      const box = $('.ask-box');
      floatGhosts();
      box.innerHTML = `<strong>You’re out, but you’re not done</strong><span>Vote for an element. If it gets the most votes, every card of it gets <strong>+1</strong> this round.</span>
        <div class="ask-buttons">${['fire', 'water', 'earth'].map((el) => `<button class="action quiet" data-vote="${el}">${icon(el)} ${cap(el)}</button>`).join('')}</div>`;
      on(box, '[data-vote]', async (b) => {
        const mine = b.dataset.vote;
        box.innerHTML = '';
        await vote($('.sp-ghost[data-who="you"]'), mine);
        if (!alive(id)) return;
        await wait(300);
        await vote($('.sp-ghost[data-who="sam"]'), 'fire');
        if (!alive(id)) return;
        const won = mine === 'fire';
        box.innerHTML = won ? '<strong>Fire wins, 2 votes to 0</strong><span>Every fire card gets +1.</span>' : '<strong>It’s a tie, 1 to 1</strong><span>A tie does nothing. No boost this round.</span>';
        await wait(1200);
        if (!alive(id)) return;
        $('.sp-table').outerHTML = spTable(true);
        await flipUp($$('.sp-table .card'));
        if (won) { boost('fire'); await wait(900); }
        if (!alive(id)) return;
        const amount = matchupDamage(3, { el: 'fire', power: SP_REED.power + (won ? 1 : 0) }, SP_JO);
        await hit($('[data-who="reed"] .card'), $('[data-who="jo"] .card'), 'fire', amount);
        if (!alive(id)) return;
        box.innerHTML = `<strong>Reed hits Jo for ${amount}</strong><span>${won ? 'Your vote made Reed’s fire a 6. Without it, that was only 1.' : 'Vote fire with Sam and Reed’s fire becomes a 6, for 2 damage.'}</span>
          <div class="ask-buttons"><button class="action quiet small" id="again">Vote again</button></div>`;
        on(box, '#again', () => render());
      });
    },
  };

  // Page 8: last one standing. Four short beats: 12 HP, your hand, sudden death and the win.
  const hpBar = (hp) => `<span class="wn-hp"><b>${hp}</b> HP<span class="wn-bar"><i style="width:${(hp / CONFIG.maxHp) * 100}%"></i></span></span>`;
  function setWinHp(seat, hp) {
    const b = seat.querySelector('.wn-hp b');
    const counter = { v: Number(b.textContent) };
    gsap.to(counter, { v: hp, duration: 0.5, onUpdate: () => { b.textContent = Math.round(counter.v); } });
    gsap.to(seat.querySelector('.wn-bar i'), { width: `${(hp / CONFIG.maxHp) * 100}%`, duration: 0.5 });
  }

  // Gold sparks bursting up from the winner.
  function celebrate(el) {
    const r = el.getBoundingClientRect();
    const colors = ['#FFF8E1', '#FFE08A', '#D9AE52', '#FFB13B'];
    for (let i = 0; i < 70; i++) {
      const angle = rand(-Math.PI, 0);
      const speed = rand(220, 560);
      layer.add({
        x: r.left + r.width / 2, y: r.top + r.height / 2, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        drag: 1.4, gravity: 420, size: rand(4, 9), life: rand(0.8, 1.5), delay: rand(0, 0.3), colors,
      });
    }
    gsap.fromTo(el, { scale: 1 }, { scale: 1.08, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' });
  }

  const WIN_HAND = [{ el: 'water', power: 3 }, { el: 'fire', power: 5 }, { el: 'earth', power: 2 }, { el: 'water', power: 6 }];
  const DRAWN = { el: 'earth', power: 4 };
  const duelSeat = (who, name, c, hp) => `<div class="wn-seat" data-who="${who}"><span class="sp-name">${name}</span><span class="slot">${card(c.el, c.power)}</span>${hpBar(hp)}</div>`;
  const spiritRow = (names) => `<span class="sp-world-label">Spirit World</span><div class="sp-ghosts">${names.map((n) => `<div class="sp-ghost"><span class="sp-ghost-card">${cardBack()}</span><span class="sp-name">${n}</span></div>`).join('')}</div>`;

  const winPage = {
    title: 'Last one standing',
    beats: ['12 HP', 'Your hand', 'Sudden death', 'The win'],
    body() {
      return `<div class="fo-pills" role="group" aria-label="Rules">${this.beats.map((s, n) => `<button class="fo-pill" data-beat="${n}">${s}</button>`).join('')}</div>
        <div class="wn-stage"></div>
        <p class="fo-caption" aria-live="polite">&nbsp;</p>`;
    },
    async mount(id) {
      on(dialog, '[data-beat]', (b) => { stopAll(); this.show(run, Number(b.dataset.beat)); });
      for (let n = 0; n < this.beats.length; n++) {
        if (!alive(id)) return;
        await this.show(id, n);
        if (!alive(id)) return;
        await wait(1400);
      }
    },
    async show(id, n) {
      const stage = $('.wn-stage');
      const caption = $('.fo-caption');
      $$('[data-beat]').forEach((p, k) => p.classList.toggle('on', k === n));
      caption.innerHTML = '&nbsp;';
      if (n === 0) {
        stage.innerHTML = `<div class="wn-row">${['You', 'Reed', 'Mia'].map((name, i) => `<div class="wn-seat" data-i="${i}"><span class="sp-name">${name}</span>${hpBar(CONFIG.maxHp)}</div>`).join('')}</div>`;
        caption.innerHTML = `<span class="dmg gain">Everyone starts with ${CONFIG.maxHp} HP</span><strong>Hit 0 and you’re out.</strong>`;
        await wait(900);
        if (!alive(id)) return;
        const mia = stage.querySelector('[data-i="2"]');
        setWinHp(mia, 0);
        await wait(600);
        gsap.to(mia, { opacity: 0.3, filter: 'grayscale(1)', duration: 0.4 });
      } else if (n === 1) {
        stage.innerHTML = `<p class="wn-label">Your hand</p><div class="wn-hand">${WIN_HAND.map((c, k) => `<span class="wn-held${k === 3 ? ' shown' : ''}">${card(c.el, c.power)}${k === 3 ? '<span class="wn-eye">Everyone sees this</span>' : ''}</span>`).join('')}</div>`;
        caption.innerHTML = `<span class="dmg gain">You hold ${CONFIG.handSize} cards</span><strong>You draw one after every round.</strong>`;
        await wait(800);
        if (!alive(id)) return;
        const hand = stage.querySelector('.wn-hand');
        hand.querySelector('.shown .wn-eye').remove();
        hand.querySelector('.shown').classList.remove('shown');
        hand.insertAdjacentHTML('beforeend', `<span class="wn-held shown">${card(DRAWN.el, DRAWN.power)}<span class="wn-eye">Everyone sees this</span></span>`);
        await gsap.fromTo(hand.lastElementChild, { x: 80, y: -40, opacity: 0, rotation: 10 }, { x: 0, y: 0, opacity: 1, rotation: 0, duration: 0.45, ease: 'back.out(1.6)' });
        if (!alive(id)) return;
        caption.innerHTML = '<span class="dmg gain">The card you just drew is face-up</span><strong>Everyone can see it. The rest stay hidden.</strong>';
      } else if (n === 2) {
        stage.innerHTML = `<div class="wn-banner">Sudden death</div><div class="wn-row">${duelSeat('you', 'You', { el: 'water', power: 3 }, 4)}${duelSeat('reed', 'Reed', { el: 'fire', power: 2 }, 5)}</div>`;
        gsap.fromTo(stage.querySelector('.wn-banner'), { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.5)' });
        caption.innerHTML = '<span class="dmg">Down to two players?</span><strong>Every hit does 1 extra, then 2 extra, and so on.</strong>';
        await wait(1200);
        if (!alive(id)) return;
        const base = matchupDamage(3, { el: 'water', power: 3 }, { el: 'fire', power: 2 });
        const extra = CONFIG.suddenDeathBonus;
        await hit(stage.querySelector('[data-who="you"] .card'), stage.querySelector('[data-who="reed"] .card'), 'water', base + extra);
        if (!alive(id)) return;
        setWinHp(stage.querySelector('[data-who="reed"]'), 5 - (base + extra));
        caption.innerHTML = `<span class="dmg">${base} + ${extra} extra = ${base + extra}</span><strong>So the game can’t drag on.</strong>`;
      } else {
        stage.innerHTML = `<div class="wn-world">${spiritRow(['Reed', 'Mia', 'Jo'])}</div><div class="wn-row"><div class="wn-seat wn-winner" data-who="you"><span class="sp-name">You</span>${hpBar(3)}</div></div>`;
        floatGhosts();
        await wait(500);
        if (!alive(id)) return;
        celebrate(stage.querySelector('.wn-winner'));
        caption.innerHTML = '<span class="dmg gain wn-big">Last one standing wins</span><strong>That’s everything. Have fun!</strong>';
      }
    },
  };

  const PAGES = [beatsPage, damagePage, roundPage, subsPage, chargePage, everyonePage, spiritPage, winPage];

  function render() {
    stopAll();
    const id = run;
    const page = PAGES[step];
    const last = step === PAGES.length - 1;
    dialog.innerHTML = `
      <div class="help-head">
        <span class="dots" aria-label="Step ${step + 1} of ${PAGES.length}">${PAGES.map((_, n) => `<i class="${n === step ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool" id="help-close">Skip</button>
      </div>
      <h2 id="help-title" tabindex="-1">${page.title}</h2>
      <div class="help-body">${page.body()}</div>
      <div class="help-foot">
        ${step > 0 ? '<button class="action quiet" id="help-back">Back</button>' : '<span></span>'}
        <button class="action" id="help-next">${last ? 'Start playing' : 'Next'}</button>
      </div>`;
    if (layer) dialog.appendChild(layer.canvas);
    else layer = PXFx.createLayer(dialog);
    $('#help-close').addEventListener('click', close);
    $('#help-next').addEventListener('click', () => {
      if (last) close();
      else go(step + 1);
    });
    const back = $('#help-back');
    if (back) back.addEventListener('click', () => go(step - 1));
    page.mount(id);
    dialog.scrollTop = 0;
    $('#help-title').focus();
  }

  // Moving to a page starts it fresh.
  function go(n) {
    step = n;
    if (PAGES[step].reset) PAGES[step].reset();
    render();
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    go(0);
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* private browsing */ }
  }

  function close() {
    stopAll();
    if (dialog.open) dialog.close();
  }

  // Opens once for new players, the first time they reach a lobby, while they're waiting anyway.
  function openIfNew() {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch (e) { /* private browsing */ }
    if (!seen) open();
  }

  dialog.addEventListener('close', stopAll);
  document.getElementById('help-open').addEventListener('click', open);
  window.PXHelp = { open, close, openIfNew };
})();
