// The how-to-play walkthrough: one idea per screen, basics first, then powers, then the extras.
// Damage and abilities come from the engine, so what it shows can't drift from the real game.
(function () {
  const { CONFIG, BEATS, SUBS, matchupDamage, subsFor } = PX;
  const { cardArt, cardBack, powerArt } = PXArt;
  const KEY = 'px-seen-help';
  const dialog = document.getElementById('help');
  let step = 0;
  let reveal = 'down'; // the table's cards: 'down', 'playing' or 'done'
  let runId = 0;
  let layer = null;

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const card = (c) => `<span class="card">${cardArt(c.el, c.power)}</span>`;
  const damage = (a, b) => matchupDamage(3, a, b);

  function choices(hand) {
    return `<div class="tap-row">${hand.map((c, n) => `<button class="card" data-choice="${n}" aria-label="${cap(c.el)} ${c.power}">${cardArt(c.el, c.power)}</button>`).join('')}</div>`;
  }

  // Water, fire and earth around a triangle, with arrows pointing at what each one beats.
  function triangle() {
    const label = (el) => `<span class="tri-card tri-${el}">${card({ el, power: 4 })}<span>${cap(el)}</span></span>`;
    return `<div class="triangle">
      <svg viewBox="0 0 300 250" aria-hidden="true">
        <defs><marker id="tri-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#F6EFE0"/></marker></defs>
        <path d="M188 62 L238 118" /><path d="M204 192 L96 192" /><path d="M62 118 L112 62" />
      </svg>
      ${label('water')}${label('fire')}${label('earth')}
    </div>`;
  }

  const ELEMENT_HAND = [{ el: 'water', power: 3 }, { el: 'fire', power: 3 }, { el: 'earth', power: 3 }];
  const CALL_HAND = [{ el: 'water', power: 4 }, { el: 'fire', power: 2 }, { el: 'earth', power: 5 }];

  // A four-player table. Each seat's damage is worked out from everyone else's card.
  const TABLE = [
    { name: 'You', card: { el: 'fire', power: 4 } },
    { name: 'Reed', card: { el: 'earth', power: 5 } },
    { name: 'Mia', card: { el: 'water', power: 2 } },
    { name: 'Jo', card: { el: 'fire', power: 6 } },
  ];

  // Who each seat is hit by, worked out by the engine's damage rule.
  const hitsOn = (seat) => TABLE
    .filter((other) => other !== seat)
    .map((other) => ({ name: other.name, amount: damage(other.card, seat.card) }))
    .filter((h) => h.amount > 0);

  function board() {
    const seats = TABLE.map((seat, n) => {
      const hits = hitsOn(seat);
      const total = hits.reduce((sum, h) => sum + h.amount, 0);
      const result = reveal !== 'done' ? '<span class="tut-result">&nbsp;</span>'
        : total ? `<span class="tut-result"><strong class="bad">-${total} HP</strong>${hits.map((h) => `${h.name} ${h.amount}`).join(', ')}</span>`
          : '<span class="tut-result"><strong class="good">No damage</strong>&nbsp;</span>';
      return `<li class="tut-seat${seat.name === 'You' ? ' tut-you' : ''}" data-seat="${n}">
        <span class="tut-name">${seat.name}</span>
        <span class="card">${reveal === 'down' ? cardBack() : cardArt(seat.card.el, seat.card.power)}</span>
        ${result}
      </li>`;
    }).join('');
    const foot = reveal === 'down' ? '<button class="action" id="flip">Flip the cards</button>'
      : reveal === 'done' ? '<p class="board-note">Add up every player who beats you. That\'s your damage.</p><button class="action quiet small" id="flip">Watch again</button>'
        : '<p class="board-note">&nbsp;</p>';
    return `<ul class="tut-board" data-fx-shake>${seats}</ul><div class="buttons">${foot}</div>`;
  }

  // Flip every card, then play each attacker's hits in turn: all of one player's hits fly together.
  async function playReveal() {
    const run = ++runId;
    reveal = 'playing';
    render();
    if (PXFx.reducedMotion() || typeof gsap === 'undefined') { reveal = 'done'; render(); return; }
    const cardOf = (n) => dialog.querySelector(`[data-seat="${n}"] .card`);
    await gsap.fromTo(dialog.querySelectorAll('.tut-seat .card'), { rotationY: 90, transformPerspective: 600 }, { rotationY: 0, duration: 0.28, stagger: 0.07, ease: 'back.out(2)' });
    for (const [n, seat] of TABLE.entries()) {
      if (run !== runId) return;
      const targets = TABLE
        .map((other, m) => ({ card: cardOf(m), amount: other === seat ? 0 : damage(seat.card, other.card) }))
        .filter((t) => t.amount > 0);
      if (!targets.length) continue;
      await PXFx.attack(layer, cardOf(n), seat.card.el, targets);
    }
    if (run !== runId) return;
    reveal = 'done';
    render();
  }

  const STEPS = [
    {
      title: 'Each element beats the next',
      body: () => `
        ${triangle()}
        <p class="ask">Reed plays earth. <strong>Tap the one that beats it.</strong></p>
        ${choices(ELEMENT_HAND)}
        <p class="answer" aria-live="polite"></p>`,
      answer(n) {
        const c = ELEMENT_HAND[n];
        if (BEATS[3][c.el].includes('earth')) return { good: true, text: 'Yes! Fire beats earth.' };
        if (c.el === 'earth') return { good: false, text: 'Same element just compares numbers. Find the element that beats earth.' };
        return { good: false, text: 'Earth beats water. Follow the arrows and try again.' };
      },
    },
    {
      title: 'How much damage',
      body: () => {
        const rows = [
          [{ el: 'fire', power: 2 }, { el: 'earth', power: 5 }, 'Better element, whatever the numbers'],
          [{ el: 'fire', power: 5 }, { el: 'fire', power: 3 }, 'Same element, higher number'],
          [{ el: 'fire', power: 5 }, { el: 'earth', power: 3 }, 'Better element and higher number'],
        ];
        return `<ul class="hits">${rows.map(([a, b, why]) => `<li>
            <span class="pair">${card(a)}<span class="versus">vs</span>${card(b)}</span>
            <span class="hit-text"><strong>${damage(a, b)} damage</strong>${why}</span>
          </li>`).join('')}</ul>
        <p class="ask">Same element and same number? Nothing happens.</p>`;
      },
    },
    {
      title: 'Everyone plays at once',
      body: () => `
        <p class="ask">It's not one on one. Everyone picks a card in secret, they all flip together, and <strong>your card fights every other card</strong>.</p>
        ${board()}`,
      mount() {
        const flip = dialog.querySelector('#flip');
        if (flip) flip.addEventListener('click', playReveal);
      },
    },
    {
      title: 'Last one standing wins',
      body: () => `
        <ul class="gains plain">
          <li>Everyone starts with <strong>${CONFIG.maxHp} HP</strong>. Hit 0 and you're out.</li>
          <li>You hold <strong>${CONFIG.handSize} cards</strong> and draw one after every round.</li>
          <li>Your newest card is <strong>face-up</strong>, so everyone can see it.</li>
          <li><strong>Down to two players?</strong> Damage grows every round, so it ends fast.</li>
        </ul>`,
    },
    {
      title: 'Pick a sub-element',
      body: () => `
        <p class="ask">Before the game, everyone secretly picks one. It gives you a power and makes that element <strong>your element</strong>.</p>
        <ul class="ability-list">${subsFor(3).map((key) => {
          const sub = SUBS[key];
          return `<li><span class="power-thumb">${powerArt(key)}</span><span><strong>${sub.name}</strong> (${cap(sub.element)}, ${sub.cost} charge): ${sub.text}</span></li>`;
        }).join('')}</ul>`,
    },
    {
      title: 'Charge up your power',
      body: () => `
        <p class="ask">Your power costs charge. You earn it by playing cards of your element:</p>
        <ul class="gains">
          <li><strong>+${CONFIG.chargeForHit}</strong> Play your element and beat someone</li>
          <li><strong>+${CONFIG.chargeForMiss}</strong> Play your element and beat nobody</li>
        </ul>
        <p class="ask">Once you have enough, you can use it at the start of a round. You can hold up to ${CONFIG.maxCharge} charge.</p>`,
    },
    {
      title: 'Call your element',
      body: () => `
        <p class="ask">Each round, before cards, everyone secretly calls an element, then all the calls are shown. Play what you called and get <strong>+${CONFIG.callBonus} charge</strong>. You don't have to, and there's no penalty if you don't.</p>
        <p class="ask"><strong>You called water.</strong> Tap a card to play.</p>
        ${choices(CALL_HAND)}
        <p class="answer" aria-live="polite"></p>`,
      answer(n) {
        const c = CALL_HAND[n];
        if (c.el === 'water') return { good: true, text: `You played what you called: +${CONFIG.callBonus} charge.` };
        return { good: true, text: 'You played something else. No bonus, and no penalty either.' };
      },
    },
    {
      title: 'Knocked out? Not done yet',
      body: () => `
        <p class="ask">Players who are out go to the <strong>Spirit World</strong>.</p>
        <ul class="gains plain">
          <li>Each round, everyone who's out secretly <strong>votes for an element</strong>.</li>
          <li>The element with the most votes gets <strong>+1</strong> on every card of it that round.</li>
          <li>A tied vote does nothing.</li>
        </ul>
        <p class="ask">That's everything. Tap <strong>How to play</strong> anytime to come back.</p>`,
    },
  ];

  function render() {
    const current = STEPS[step];
    const last = step === STEPS.length - 1;
    dialog.innerHTML = `
      <div class="help-head">
        <span class="dots" aria-label="Step ${step + 1} of ${STEPS.length}">${STEPS.map((_, n) => `<i class="${n === step ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool" id="help-close">Skip</button>
      </div>
      <h2 id="help-title" tabindex="-1">${current.title}</h2>
      <div class="help-body">${current.body()}</div>
      <div class="help-foot">
        ${step > 0 ? '<button class="action quiet" id="help-back">Back</button>' : '<span></span>'}
        <button class="action" id="help-next">${last ? 'Start playing' : 'Next'}</button>
      </div>`;
    if (layer) dialog.appendChild(layer.canvas);
    else if (window.PXFx) layer = PXFx.createLayer(dialog);
    dialog.querySelector('#help-close').addEventListener('click', close);
    dialog.querySelector('#help-next').addEventListener('click', () => {
      if (last) close();
      else { step += 1; resetReveal(); render(); }
    });
    const back = dialog.querySelector('#help-back');
    if (back) back.addEventListener('click', () => { step -= 1; resetReveal(); render(); });
    dialog.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => {
      dialog.querySelectorAll('[data-choice]').forEach((other) => other.classList.toggle('chosen', other === b));
      const result = current.answer(Number(b.dataset.choice));
      dialog.querySelector('.answer').innerHTML = `<span class="${result.good ? 'good' : 'bad'}">${result.text}</span>`;
    }));
    if (current.mount) current.mount();
    dialog.scrollTop = 0;
    dialog.querySelector('#help-title').focus();
  }

  function open() {
    step = 0;
    resetReveal();
    render();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#help-title').focus();
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* private browsing */ }
  }

  function close() {
    resetReveal();
    if (dialog.open) dialog.close();
  }

  // Stops a reveal that's still playing and turns the table's cards back over.
  function resetReveal() {
    reveal = 'down';
    runId += 1;
    if (window.gsap) gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    if (layer) layer.clear();
  }

  // Opens once for new players, the first time they reach a lobby, while they're waiting anyway.
  function openIfNew() {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch (e) { /* private browsing */ }
    if (!seen) open();
  }

  document.getElementById('help-open').addEventListener('click', open);
  window.PXHelp = { open, close, openIfNew };
})();
