// The how-to-play walkthrough: one idea per screen, learned by tapping cards.
// Damage comes from the engine, so what it shows can't drift from the real game.
(function () {
  const { CONFIG, BEATS, matchupDamage } = PX;
  const { cardArt } = PXArt;
  const KEY = 'px-seen-help';
  const dialog = document.getElementById('help');
  let step = 0;

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const name = (c) => `${cap(c.el)} ${c.power}`;
  const card = (c) => `<span class="card">${cardArt(c.el, c.power)}</span>`;
  const damage = (a, b) => matchupDamage(3, a, b);

  function choices(hand) {
    return `<div class="tap-row">${hand.map((c, n) => `<button class="card" data-choice="${n}" aria-label="${name(c)}">${cardArt(c.el, c.power)}</button>`).join('')}</div>`;
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
  const LIE_HAND = [{ el: 'earth', power: 5 }, { el: 'water', power: 4 }, { el: 'fire', power: 3 }];
  const REED_CARD = { el: 'fire', power: 6 };

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
        if (c.el === 'earth') return { good: false, text: 'Same element, so that one is a tie here. Try again.' };
        return { good: false, text: 'Earth beats water. Follow the arrows and try again.' };
      },
    },
    {
      title: 'Higher numbers hit harder',
      body: () => {
        const rows = [
          [{ el: 'fire', power: 5 }, { el: 'earth', power: 3 }, 'Better element and higher number'],
          [{ el: 'fire', power: 2 }, { el: 'earth', power: 5 }, 'Better element'],
          [{ el: 'fire', power: 5 }, { el: 'fire', power: 3 }, 'Same element, higher number'],
        ];
        return `<ul class="hits">${rows.map(([a, b, why]) => `<li>
            <span class="pair">${card(a)}<span class="versus">vs</span>${card(b)}</span>
            <span class="hit-text"><strong>${damage(a, b)} damage</strong>${why}</span>
          </li>`).join('')}</ul>
        <p class="ask">Everyone plays at once, and your card fights all of them.</p>`;
      },
    },
    {
      title: 'People can lie',
      body: () => `
        <p class="ask">Before playing, everyone calls an element. <strong>Reed calls water.</strong> What do you play?</p>
        ${choices(LIE_HAND)}
        <div class="lie-result" aria-live="polite"></div>`,
      answer(n) {
        const mine = LIE_HAND[n];
        const dealt = damage(mine, REED_CARD);
        const taken = damage(REED_CARD, mine);
        const result = dealt ? `You saw through it and deal ${dealt}.`
          : taken === 2 ? 'Fire beats earth, so you take 2.' : `Same element, but 6 is higher, so you take ${taken}.`;
        return {
          good: dealt > 0,
          reveal: true,
          text: `Reed lied and played ${name(REED_CARD)}! ${result} Everyone can see how often each player tells the truth.`,
        };
      },
    },
    {
      title: 'Charge up your power',
      body: () => `
        <p class="ask">You choose one power before the game, and it belongs to an element. Earn charge, then use it.</p>
        <ul class="gains">
          <li><strong>+${CONFIG.chargeForHit}</strong> Play your element and beat someone</li>
          <li><strong>+${CONFIG.chargeForMiss}</strong> Play your element and beat nobody</li>
          <li><strong>+${CONFIG.callBonus}</strong> Play the element you called</li>
        </ul>`,
    },
    {
      title: 'Last one standing wins',
      body: () => `
        <ul class="gains plain">
          <li>Everyone starts with <strong>${CONFIG.maxHp} HP</strong>.</li>
          <li><strong>Knocked out?</strong> You vote each round to boost an element.</li>
          <li><strong>Down to two players?</strong> Damage starts growing, so the game ends fast.</li>
          <li><strong>Everyone can see one card</strong> in your hand: the newest one.</li>
        </ul>
        <p class="ask">The fastest way to learn the rest is to play. Tap <strong>How to play</strong> anytime to come back.</p>`,
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
    dialog.querySelector('#help-close').addEventListener('click', close);
    dialog.querySelector('#help-next').addEventListener('click', () => {
      if (last) close();
      else { step += 1; render(); }
    });
    const back = dialog.querySelector('#help-back');
    if (back) back.addEventListener('click', () => { step -= 1; render(); });
    dialog.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => {
      dialog.querySelectorAll('[data-choice]').forEach((other) => other.classList.toggle('chosen', other === b));
      const result = current.answer(Number(b.dataset.choice));
      const place = dialog.querySelector('.answer, .lie-result');
      const reveal = result.reveal ? `<span class="flip-row">${card(LIE_HAND[Number(b.dataset.choice)])}<span class="versus">vs</span>${card(REED_CARD)}</span>` : '';
      place.innerHTML = `${reveal}<span class="${result.good ? 'good' : 'bad'}">${result.text}</span>`;
    }));
    dialog.scrollTop = 0;
    dialog.querySelector('#help-title').focus();
  }

  function open() {
    step = 0;
    render();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#help-title').focus();
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* private browsing */ }
  }

  function close() {
    if (dialog.open) dialog.close();
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
