// The how-to-play walkthrough. It reads rules and numbers from the engine, so it can't drift from the real game.
(function () {
  const { SUBS, CONFIG, BEATS, matchupDamage } = PX;
  const { cardArt } = PXArt;
  const KEY = 'px-seen-help';
  const dialog = document.getElementById('help');
  let step = 0;

  const card = (el, power) => `<span class="card">${cardArt(el, power)}</span>`;
  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  function matchupRow(a, b) {
    const dealt = matchupDamage(3, a, b);
    const taken = matchupDamage(3, b, a);
    let why;
    if (dealt === 2) why = `${cap(a.el)} beats ${b.el} and ${a.power} is higher.`;
    else if (dealt === 1 && a.el !== b.el) why = `${cap(a.el)} beats ${b.el}, but ${a.power} isn't higher.`;
    else if (dealt === 1) why = `Same element, and ${a.power} is higher.`;
    else if (!dealt && !taken) why = 'Same element and same number.';
    const result = dealt ? `${dealt} damage` : taken ? `${taken} damage to you` : 'No damage';
    return `<li class="matchup">
      <span class="pair">${card(a.el, a.power)}<span class="versus">vs</span>${card(b.el, b.power)}</span>
      <span><strong>${result}</strong><br>${why}</span>
    </li>`;
  }

  // The practice round: a rival's card is shown, and you click your cards to see what each would do.
  const RIVAL = { el: 'earth', power: 4 };
  const PRACTICE = [{ el: 'fire', power: 5 }, { el: 'fire', power: 2 }, { el: 'water', power: 6 }, { el: 'earth', power: 6 }];

  function practiceResult(mine) {
    const dealt = matchupDamage(3, mine, RIVAL);
    const taken = matchupDamage(3, RIVAL, mine);
    const name = `${cap(mine.el)} ${mine.power}`;
    if (dealt === 2) return `${name} is the best play: fire beats earth and ${mine.power} is higher than ${RIVAL.power}, so you deal 2.`;
    if (dealt === 1 && mine.el !== RIVAL.el) return `${name} deals 1. Fire beats earth, but ${mine.power} isn't higher than ${RIVAL.power}, so there's no bonus.`;
    if (dealt === 1) return `${name} deals 1. It's the same element, and ${mine.power} is higher than ${RIVAL.power}.`;
    if (taken) return `${name} loses, and you take ${taken}. Earth beats water, and the rival's ${RIVAL.power} isn't higher than your ${mine.power}, so there's no bonus.`;
    return `${name} does nothing.`;
  }

  const abilityRows = () => ['combustion', 'lightning', 'seismic', 'metal', 'healing', 'bloodbending'].map((key) => {
    const sub = SUBS[key];
    return `<li><span class="el-dot el-${sub.element}"></span><strong>${sub.name}</strong> (${cap(sub.element)}, ${sub.cost} charge): ${sub.text}</li>`;
  }).join('');

  const timers = PXHost.DEFAULT_TIMERS;

  const STEPS = [
    {
      title: 'Be the last one standing',
      body: () => `
        <p>Everyone starts with ${CONFIG.maxHp} HP. Each round, all players reveal a card at the same time. When your HP hits 0, you're out.</p>
        <div class="card-row">${card('fire', 5)}${card('water', 2)}${card('earth', 6)}</div>
        <p>Every card has an <strong>element</strong> and a <strong>number</strong> from ${CONFIG.powers[0]} to ${CONFIG.powers[CONFIG.powers.length - 1]}. The pattern gets denser as the number rises.</p>
        <p>You hold ${CONFIG.handSize} cards, and the one you drew last is face-up for everyone to see.</p>`,
    },
    {
      title: 'Elements beat each other in a circle',
      body: () => `
        <ul class="cycle-list">${Object.keys(BEATS[3]).map((el) => `<li><span class="pair">${card(el, 4)}<span class="versus">beats</span>${card(BEATS[3][el][0], 4)}</span></li>`).join('')}</ul>
        <p>If you play the same element as someone, the higher number wins.</p>`,
    },
    {
      title: 'Add up the damage',
      body: () => `
        <ul class="matchups">
          ${matchupRow({ el: 'fire', power: 5 }, { el: 'earth', power: 3 })}
          ${matchupRow({ el: 'fire', power: 2 }, { el: 'earth', power: 5 })}
          ${matchupRow({ el: 'fire', power: 5 }, { el: 'fire', power: 3 })}
          ${matchupRow({ el: 'fire', power: 3 }, { el: 'fire', power: 3 })}
        </ul>
        <p>Your card is compared with <strong>every</strong> other player's card, and all the damage adds up. If three players beat you, you take damage from all three.</p>`,
    },
    {
      title: 'Try it',
      body: () => `
        <div class="practice">
          <div class="rival"><p>Your rival plays</p>${card(RIVAL.el, RIVAL.power)}</div>
          <div class="yours"><p>Select one of your cards</p>
            <div class="card-row">${PRACTICE.map((c, n) => `<button class="card" data-practice="${n}" aria-label="${cap(c.el)} ${c.power}">${cardArt(c.el, c.power)}</button>`).join('')}</div>
          </div>
        </div>
        <p class="practice-result" id="practice-result" aria-live="polite">Which card deals the most damage?</p>`,
    },
    {
      title: 'Each round has three steps',
      body: () => `
        <ol class="round-steps">
          <li><strong>Ability.</strong> If you have enough charge, you can use your sub-element's ability.</li>
          <li><strong>Call.</strong> Everyone announces an element at the same time, such as "I'm playing water". <strong>You can lie.</strong></li>
          <li><strong>Card.</strong> Everyone secretly picks a card, then all the cards flip at once.</li>
        </ol>
        <p>Calling is where the mind games happen. If Reed calls water, you could play earth to beat it. But Reed might expect that and play fire instead.</p>
        <p>Everyone can see how many calls each player has kept, so you'll learn who to trust.</p>`,
    },
    {
      title: 'Charge up your sub-element',
      body: () => `
        <p>Before the game, you secretly choose one sub-element. Its element is the one you want to play.</p>
        <ul class="charge-list">
          <li><strong>+${CONFIG.chargeForHit} charge</strong> for playing your element and beating someone</li>
          <li><strong>+${CONFIG.chargeForMiss} charge</strong> for playing your element and beating nobody</li>
          <li><strong>+${CONFIG.callBonus} charge</strong> for playing what you called, whichever element it is</li>
        </ul>
        <ul class="ability-list">${abilityRows()}</ul>
        <p>You can hold up to ${CONFIG.maxCharge} charge.</p>`,
    },
    {
      title: 'The endgame',
      body: () => `
        <ul class="charge-list">
          <li><strong>Spirit World.</strong> If you're knocked out, you're still in it. Each round, you vote for an element to get +1 number.</li>
          <li><strong>Sudden death.</strong> When two players remain, all damage gets +${CONFIG.suddenDeathBonus}, and that grows by 1 each round.</li>
          <li><strong>Time limits.</strong> With friends, you get ${timers.calls} seconds to call and ${timers.cards} to pick a card. If time runs out, the game plays a random card for you.</li>
        </ul>
        <p>That's everything. You can reopen this anytime from <strong>How to play</strong> at the top of the screen.</p>`,
    },
  ];

  function render() {
    const current = STEPS[step];
    const last = step === STEPS.length - 1;
    dialog.innerHTML = `
      <div class="help-head">
        <span class="help-progress">Step ${step + 1} of ${STEPS.length}</span>
        <button class="action quiet small" id="help-close">Close</button>
      </div>
      <h2 id="help-title" tabindex="-1">${current.title}</h2>
      <div class="help-body">${current.body()}</div>
      <div class="help-foot">
        ${step > 0 ? '<button class="action quiet" id="help-back">Back</button>' : '<span></span>'}
        <button class="action" id="help-next">${last ? 'Got it' : 'Next'}</button>
      </div>`;
    dialog.querySelector('#help-close').addEventListener('click', close);
    dialog.querySelector('#help-next').addEventListener('click', () => {
      if (last) close();
      else { step += 1; render(); }
    });
    const back = dialog.querySelector('#help-back');
    if (back) back.addEventListener('click', () => { step -= 1; render(); });
    dialog.querySelectorAll('[data-practice]').forEach((b) => b.addEventListener('click', () => {
      dialog.querySelectorAll('[data-practice]').forEach((other) => other.classList.toggle('chosen', other === b));
      dialog.querySelector('#practice-result').textContent = practiceResult(PRACTICE[Number(b.dataset.practice)]);
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
