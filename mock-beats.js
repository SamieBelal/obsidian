// Mock designs for the tutorial's "what beats what" step. Each one uses the game's real hit animations
// from fx.js. Pick a design with the tabs at the top, or open mock-beats.html#b to go straight to one.
(function () {
  const { BEATS, matchupDamage } = PX;
  const { cardArt } = PXArt;
  const help = document.getElementById('help');
  const tabs = document.getElementById('mock-tabs');
  const note = document.getElementById('mock-note');
  const layer = PXFx.createLayer(document.body);

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const icon = (el) => `<img class="el-icon" src="art/board/icon-${el}.webp" alt="">`;
  const word = (el) => `<span class="el-word el-${el}">${cap(el)}</span>`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Each element and the one it beats, in loop order: water beats fire, fire beats earth, earth beats water.
  const ORDER = ['water', 'fire', 'earth'];
  const PAIRS = ORDER.map((el) => [el, BEATS[3][el][0]]);
  const loser = (el) => BEATS[3][el][0];

  let run = 0;
  const alive = (id) => id === run;

  function stopAll() {
    run += 1;
    gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    layer.clear();
  }

  // One element's card hits another, with the real animation for the attacker's element.
  function hit(fromCard, toCard, el, amount = 1) {
    if (PXFx.reducedMotion()) return Promise.resolve();
    return PXFx.attack(layer, fromCard, el, [{ card: toCard, amount }]);
  }

  // Two cards that tie knock together and nothing happens.
  function bump(a, b) {
    return gsap.timeline()
      .to(a, { x: 26, duration: 0.16, ease: 'power2.in' })
      .to(b, { x: -26, duration: 0.16, ease: 'power2.in' }, '<')
      .to([a, b], { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
  }

  const card = (el, power = 4, extra = '') => `<span class="card" data-el="${el}" ${extra}>${cardArt(el, power)}</span>`;

  // A: the three cards sit in a loop and fight their way around it, one arrow at a time.
  const loop = {
    key: 'a',
    name: 'Alt · The loop (A)',
    note: 'The triangle comes alive: each card attacks the one it beats, in turn, with its arrow lighting up. No quiz, just watch. Plays once on open, with a Watch again button.',
    body: () => `
      <div class="loop">
        <svg viewBox="0 0 360 300" aria-hidden="true">
          <defs><marker id="loop-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="currentColor"/></marker></defs>
          <path data-arrow="water" d="M222 70 L282 132" /><path data-arrow="fire" d="M244 236 L116 236" /><path data-arrow="earth" d="M78 132 L138 70" />
        </svg>
        ${ORDER.map((el) => `<span class="loop-card loop-${el}">${card(el)}</span>`).join('')}
      </div>
      <p class="loop-caption" aria-live="polite">&nbsp;</p>
      <div class="buttons center"><button class="action quiet small" id="again" hidden>Watch again</button></div>`,
    async mount(id) {
      const again = help.querySelector('#again');
      again.addEventListener('click', () => { again.hidden = true; this.play(id); });
      await wait(400);
      this.play(id);
    },
    async play(id) {
      const caption = help.querySelector('.loop-caption');
      const cardOf = (el) => help.querySelector(`.loop-${el} .card`);
      help.querySelectorAll('[data-arrow]').forEach((a) => a.classList.remove('lit', 'done'));
      for (const [a, b] of PAIRS) {
        if (!alive(id)) return;
        const arrow = help.querySelector(`[data-arrow="${a}"]`);
        arrow.classList.add('lit');
        caption.innerHTML = `${word(a)} beats ${word(b)}`;
        await hit(cardOf(a), cardOf(b), a);
        if (!alive(id)) return;
        arrow.classList.replace('lit', 'done');
        await wait(350);
      }
      if (!alive(id)) return;
      caption.innerHTML = 'Around and around. <strong>Every element beats one and loses to one.</strong>';
      help.querySelector('#again').hidden = false;
    },
  };

  // The face-off: one matchup at a time, big, in the middle; the card on the left hits the one on the right.
  // It plays every matchup on its own, then the pills underneath replay any one. Used by step 1 (B) and step 2.
  function makeFaceoff({ key, name, note, title, matchups, ending }) {
    return {
      key, name, note, title,
      body: () => `
        <div class="faceoff">
          <span class="fo-slot fo-left"></span>
          <span class="fo-beats">&nbsp;</span>
          <span class="fo-slot fo-right"></span>
        </div>
        <div class="fo-pills" role="group" aria-label="Matchups">
          ${matchups.map((m, n) => `<button class="fo-pill" data-pair="${n}">${m.pill}</button>`).join('')}
        </div>
        <p class="fo-caption">&nbsp;</p>`,
      async mount(id) {
        help.querySelectorAll('[data-pair]').forEach((b) => b.addEventListener('click', () => {
          stopAll();
          this.show(run, Number(b.dataset.pair), true);
        }));
        await wait(300);
        for (let n = 0; n < matchups.length; n++) {
          if (!alive(id)) return;
          await this.show(id, n);
          if (!alive(id)) return;
          await wait(900);
        }
        if (alive(id)) help.querySelector('.fo-caption').innerHTML = `${ending} <strong>Tap one to see it again.</strong>`;
      },
      async show(id, n, only) {
        const m = matchups[n];
        const left = help.querySelector('.fo-left');
        const right = help.querySelector('.fo-right');
        help.querySelectorAll('[data-pair]').forEach((p) => p.classList.toggle('on', Number(p.dataset.pair) === n));
        left.innerHTML = card(m.a.el, m.a.power);
        right.innerHTML = card(m.b.el, m.b.power);
        help.querySelector('.fo-beats').textContent = m.middle || 'beats';
        help.querySelector('.fo-caption').innerHTML = m.caption;
        await gsap.timeline()
          .fromTo(left.firstChild, { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.6)' })
          .fromTo(right.firstChild, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.6)' }, '<');
        if (!alive(id)) return;
        await wait(250);
        if (!alive(id)) return;
        const amount = matchupDamage(3, m.a, m.b);
        if (amount) await hit(left.firstChild, right.firstChild, m.a.el, amount);
        else await bump(left.firstChild, right.firstChild);
        if (only && alive(id)) help.querySelector('.fo-caption').innerHTML += '<br><small>Tap another, or Next.</small>';
      },
    };
  }

  // How each win sounds, said like you'd say it to a friend.
  const SAYINGS = {
    water: `${word('water')} puts out ${word('fire')}`,
    fire: `${word('fire')} scorches ${word('earth')}`,
    earth: `${word('earth')} buries ${word('water')}`,
  };

  const faceoff = makeFaceoff({
    key: 'b',
    name: 'Step 1 · Face-off (B)',
    note: 'Picked. One fight at a time with big cards: the winner on the left hits the loser on the right. It cycles through all three on its own; tap a pill to replay one.',
    title: 'Who beats who',
    matchups: PAIRS.map(([a, b]) => ({
      a: { el: a, power: 4 }, b: { el: b, power: 4 },
      pill: `${icon(a)}<span>›</span>${icon(b)}`,
      caption: SAYINGS[a],
    })),
    ending: 'And around it goes.',
  });

  // Step 2 in the same style: how much damage a hit does, worked out by the engine's own damage rule.
  const pill = (a, b) => `${icon(a.el)}${a.power}<span>›</span>${icon(b.el)}${b.power}`;
  const DAMAGE = [
    [{ el: 'fire', power: 2 }, { el: 'earth', power: 5 }, 'Fire beats earth, even with a smaller number.'],
    [{ el: 'fire', power: 5 }, { el: 'fire', power: 3 }, 'Both fire, so the bigger number wins.'],
    [{ el: 'fire', power: 5 }, { el: 'earth', power: 3 }, 'Fire beats earth <em>and</em> has the bigger number. Double hit.'],
    [{ el: 'fire', power: 4 }, { el: 'fire', power: 4 }, 'Exact same card. Nobody gets hurt.'],
  ];
  const damage = makeFaceoff({
    key: 'd',
    name: 'Step 2 · Damage',
    note: 'Step 2 in the face-off style: the same big cards and pills, but the caption counts the damage and the hit lands with that number. The last one is a tie: the cards just bump.',
    title: 'Doing damage',
    matchups: DAMAGE.map(([a, b, why]) => {
      const amount = matchupDamage(3, a, b);
      return {
        a, b,
        pill: pill(a, b),
        middle: amount ? 'hits' : 'vs',
        caption: amount ? `<span class="dmg">-${amount} HP</span><strong>${why}</strong>` : `<span class="dmg none">Nothing</span><strong>${why}</strong>`,
      };
    }),
    ending: 'Win, and they lose 1. Win big, and they lose 2.',
  });

  // C: learn by playing. Reed plays a card; you answer with one of yours and watch who wins.
  const tryit = {
    key: 'c',
    name: 'Later · Beat Reed (C)',
    note: 'Hands-on: Reed plays a card and you tap one of yours to beat it. Your card fights Reed’s for real, right or wrong. Three quick rounds (earth, then fire, then water) and the loop fills in as you go.',
    round: 0,
    body() {
      const theirs = ['earth', 'fire', 'water'][this.round];
      return `
        <div class="duel">
          <span class="duel-name">Reed plays</span>
          ${card(theirs, 4, 'id="reed-card"')}
        </div>
        <div class="tap-row duel-hand">${ORDER.map((el) => `<button class="card" data-pick="${el}" aria-label="${cap(el)}">${cardArt(el, 4)}</button>`).join('')}</div>
        <p class="answer" aria-live="polite"><span class="ask-line">Tap the card that <strong>beats ${cap(theirs).toLowerCase()}</strong>.</span></p>
        <div class="learned">${PAIRS.map(([a, b]) => `<span class="chip-learn" data-learned="${a}">${icon(a)}<span>beats</span>${icon(b)}</span>`).join('')}</div>`;
    },
    learned: new Set(),
    mount(id) {
      const theirs = ['earth', 'fire', 'water'][this.round];
      this.learned.forEach((el) => help.querySelector(`[data-learned="${el}"]`).classList.add('on'));
      let busy = false;
      help.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        const mine = b.dataset.pick;
        const reed = help.querySelector('#reed-card');
        const answer = help.querySelector('.answer');
        help.querySelectorAll('[data-pick]').forEach((o) => o.classList.toggle('chosen', o === b));
        answer.innerHTML = '&nbsp;';
        await gsap.to(b, { y: -18, duration: 0.18, ease: 'power2.out' });
        if (!alive(id)) return;
        if (loser(mine) === theirs) {
          await hit(b, reed, mine);
          if (!alive(id)) return;
          this.learned.add(mine);
          help.querySelector(`[data-learned="${mine}"]`).classList.add('on');
          const more = this.round < 2;
          answer.innerHTML = `<span class="good">${cap(mine)} beats ${theirs}!</span>${more ? '<button class="action small" id="next-round">Next card</button>' : '<span class="soft">That\'s the whole loop.</span>'}`;
          const next = help.querySelector('#next-round');
          if (next) next.addEventListener('click', () => { this.round += 1; render(); });
        } else if (mine === theirs) {
          await bump(b, reed);
          if (!alive(id)) return;
          answer.innerHTML = `<span class="bad">Same element: nothing happens.</span> <span class="soft">Find the one that beats ${theirs}.</span>`;
        } else {
          await hit(reed, b, theirs);
          if (!alive(id)) return;
          answer.innerHTML = `<span class="bad">Ouch, ${theirs} beats ${mine}.</span> <span class="soft">Try another.</span>`;
        }
        gsap.to(b, { y: 0, duration: 0.2 });
        busy = false;
      }));
    },
    reset() { this.round = 0; this.learned = new Set(); },
  };

  const DESIGNS = [faceoff, damage, loop, tryit];
  let current = DESIGNS[0];

  function render() {
    stopAll();
    const id = run;
    help.innerHTML = `
      <div class="help-head">
        <span class="dots">${[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<i class="${n === (current.key === 'd' ? 1 : 0) ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool">Skip</button>
      </div>
      <h2>${current.title || 'Each element beats the next'}</h2>
      <div class="help-body">${current.body()}</div>
      <div class="help-foot">${current.key === 'd' ? '<button class="action quiet">Back</button>' : '<span></span>'}<button class="action">Next</button></div>`;
    note.textContent = current.note;
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === current.key));
    current.mount(id);
  }

  tabs.innerHTML = DESIGNS.map((d) => `<button data-key="${d.key}">${d.name}</button>`).join('');
  tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    current = DESIGNS.find((d) => d.key === b.dataset.key);
    if (current.reset) current.reset();
    history.replaceState(null, '', `#${current.key}`);
    render();
  }));
  current = DESIGNS.find((d) => `#${d.key}` === location.hash) || DESIGNS[0];
  render();
})();
