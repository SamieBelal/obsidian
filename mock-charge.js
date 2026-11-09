// Mock designs for the tutorial's "Charging up" page, with the new charge rule (not in the engine yet):
// every round +1, played what you called +1, played your element +1. In all three you picked Lightning,
// so fire is your element and you need 4 charge to use it. A checklist ticks off what you earned.
// Pick a design with the tabs at the top, or open mock-charge.html#b to go straight to one.
(function () {
  const { SUBS, CONFIG } = PX;
  const { cardArt, cardBack, powerArt } = PXArt;
  const help = document.getElementById('help');
  const tabs = document.getElementById('mock-tabs');
  const note = document.getElementById('mock-note');
  const layer = PXFx.createLayer(document.body);

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const icon = (el) => `<img class="el-icon" src="art/board/icon-${el}.webp" alt="">`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const bubble = (el) => `<span class="rd-call">${icon(el)} ${cap(el)}</span>`;
  const SUB = 'lightning';
  const MINE = SUBS[SUB].element;
  const COST = SUBS[SUB].cost;

  // The new rule: three checks, +1 each.
  const checks = (call, card) => ({ base: true, called: call === card.el, mine: card.el === MINE });
  const total = (c) => Object.values(c).filter(Boolean).length;

  let run = 0;
  const alive = (id) => id === run;
  function stopAll() {
    run += 1;
    gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    layer.clear();
    document.querySelectorAll('.fx-label, .cg-orb').forEach((el) => el.remove());
  }

  // The checklist: each line lights up when it counts this round.
  const receiptHtml = () => `<ul class="cg-receipt">
      <li data-r="base"><b>+1</b> Every round</li>
      <li data-r="called"><b>+1</b> You played what you called</li>
      <li data-r="mine"><b>+1</b> It’s ${icon(MINE)} fire, your element</li>
    </ul>`;

  // Ticks the lines that count, one at a time, and sends a drop of charge from each into the dots.
  async function tick(id, receipt, meter, c) {
    receipt.querySelectorAll('li').forEach((li) => li.classList.remove('yes', 'no'));
    for (const key of ['base', 'called', 'mine']) {
      if (!alive(id)) return;
      const li = receipt.querySelector(`[data-r="${key}"]`);
      li.classList.add(c[key] ? 'yes' : 'no');
      if (c[key]) {
        gsap.fromTo(li, { scale: 1.06 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
        await fill(meter, li.querySelector('b'), 1);
      } else {
        await wait(350);
      }
    }
  }

  // Your charge: Lightning's picture, then five dots. The fourth has a ring, since that's what Lightning costs.
  function meterHtml(charge, big) {
    return `<div class="cg-meter${big ? ' big' : ''}">
      <span class="cg-thumb">${powerArt(SUB)}</span>
      <span class="cg-pips">${Array.from({ length: CONFIG.maxCharge }, (_, n) => `<i class="${n < charge ? 'on' : ''}${n === COST - 1 ? ' cost' : ''}"></i>`).join('')}</span>
      ${big ? `<span class="cg-cost">Lightning costs ${COST}</span>` : ''}
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
      document.body.appendChild(orb);
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

  const pop = (el) => gsap.fromTo(el, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3)' });
  // The page opens by saying why charge matters, before any of the how.
  const yourElement = `<div class="cg-intro">
      <p><strong>Your sub-element needs charge before you can use it.</strong></p>
      <p>Say you picked <strong>Lightning</strong>. It needs <strong>${COST} charge</strong>, and it’s a ${icon(MINE)} fire sub-element, so fire is your element.</p>
      <p class="cg-how">Here’s how you charge up:</p>
    </div>`;
  const closing = `You can hold up to ${CONFIG.maxCharge}. <strong>Each sub-element costs a different amount, and you use it in step 1.</strong>`;

  // Your seat: what you called, the card you played, and your charge.
  const youHtml = (charge) => `<div class="cg-you">
      <span class="duo-name">You</span>
      <span class="duo-call"></span>
      <span class="slot"><span class="rd-empty"></span></span>
      ${meterHtml(charge)}
    </div>`;

  async function showPlay(id, root, call, card) {
    root.querySelector('.duo-call').innerHTML = bubble(call);
    pop(root.querySelector('.rd-call'));
    await wait(450);
    if (!alive(id)) return;
    root.querySelector('.slot').innerHTML = `<span class="card">${cardArt(card.el, card.power)}</span>`;
    await gsap.fromTo(root.querySelector('.card'), { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.8)' });
  }

  // A: four examples. Your call and card appear, then the checklist ticks off what you earned.
  const EXAMPLES = [
    { pill: '+1', call: 'fire', card: { el: 'water', power: 3 }, why: 'You bluffed and it wasn’t fire. You still get the 1.' },
    { pill: '+2', call: 'water', card: { el: 'water', power: 3 }, why: 'You played what you called.' },
    { pill: '+2', call: 'earth', card: { el: 'fire', power: 4 }, why: 'You played fire, your element.' },
    { pill: '+3', call: 'fire', card: { el: 'fire', power: 4 }, why: 'You called fire and played fire. Everything counts.' },
  ];
  const examples = {
    key: 'a',
    name: 'A · Checklist',
    note: 'Your seat on the left, the checklist on the right. Four quick examples: your call and card appear, then each line that counts lights up and sends a drop into your charge dots. No fighting, since hits don’t matter for charge any more. Tap a pill to replay one.',
    body: () => `
      ${yourElement}
      <div class="cg-split">${youHtml(0)}${receiptHtml()}</div>
      <div class="fo-pills" role="group" aria-label="Examples">${EXAMPLES.map((e, n) => `<button class="fo-pill" data-ex="${n}">${icon(e.call)}<span>›</span>${icon(e.card.el)} ${e.pill}</button>`).join('')}</div>
      <p class="fo-caption" aria-live="polite">&nbsp;</p>`,
    async mount(id) {
      help.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { stopAll(); this.show(run, Number(b.dataset.ex)); }));
      await wait(400);
      for (let n = 0; n < EXAMPLES.length; n++) {
        if (!alive(id)) return;
        await this.show(id, n);
        if (!alive(id)) return;
        await wait(1000);
      }
      if (alive(id)) help.querySelector('.fo-caption').innerHTML = closing;
    },
    async show(id, n) {
      const e = EXAMPLES[n];
      const split = help.querySelector('.cg-split');
      split.innerHTML = `${youHtml(0)}${receiptHtml()}`;
      help.querySelectorAll('[data-ex]').forEach((p) => p.classList.toggle('on', Number(p.dataset.ex) === n));
      const caption = help.querySelector('.fo-caption');
      caption.innerHTML = '&nbsp;';
      await showPlay(id, split, e.call, e.card);
      if (!alive(id)) return;
      const c = checks(e.call, e.card);
      await tick(id, split.querySelector('.cg-receipt'), split.querySelector('.cg-meter'), c);
      if (alive(id)) caption.innerHTML = `<span class="dmg gain">+${total(c)} charge</span><strong>${e.why}</strong>`;
    },
  };

  // B: watch a big bar fill over two rounds until Lightning is ready, then spend it on Reed.
  const ROUNDS = [
    { call: 'fire', card: { el: 'fire', power: 5 } },
    { call: 'fire', card: { el: 'water', power: 2 } },
  ];
  const fillbar = {
    key: 'b',
    name: 'B · Fill the bar',
    note: 'Focuses on the bar. Two rounds play out next to the checklist: an honest fire call (+3), then a bluff (+1). At 4, Lightning lights up, gets used on Reed, and the bar drops back down. Shows earning and spending in one go.',
    body: () => `
      ${yourElement}
      ${meterHtml(0, true)}
      <div class="cg-split">${youHtml(0)}${receiptHtml()}</div>
      <p class="fo-caption" aria-live="polite">&nbsp;</p>
      <div class="cg-target"><div class="cg-you" data-who="reed"><span class="duo-name">Reed</span><span class="slot"><span class="card">${cardBack()}</span></span></div></div>
      <div class="buttons center"><button class="action quiet small" id="again" hidden>Watch again</button></div>`,
    async mount(id) {
      help.querySelector('#again').addEventListener('click', () => render());
      const meter = help.querySelector('.cg-meter.big');
      const split = help.querySelector('.cg-split');
      const caption = help.querySelector('.fo-caption');
      split.querySelector('.cg-meter').remove();
      let sum = 0;
      await wait(500);
      for (const [n, r] of ROUNDS.entries()) {
        if (!alive(id)) return;
        split.querySelector('.duo-name').textContent = `You, round ${n + 1}`;
        split.querySelector('.duo-call').innerHTML = '';
        split.querySelector('.slot').innerHTML = '<span class="rd-empty"></span>';
        caption.innerHTML = '&nbsp;';
        await showPlay(id, split, r.call, r.card);
        if (!alive(id)) return;
        const c = checks(r.call, r.card);
        await tick(id, split.querySelector('.cg-receipt'), meter, c);
        if (!alive(id)) return;
        sum += total(c);
        caption.innerHTML = `<span class="dmg gain">+${total(c)} charge</span><strong>${r.call === r.card.el ? 'Honest fire call.' : 'A bluff, so just the 1.'}</strong>`;
        await wait(1300);
      }
      if (!alive(id) || sum < COST) return;
      meter.classList.add('ready');
      caption.innerHTML = '<span class="dmg gain">Lightning is ready</span><strong>Use it in step 1 of the next round.</strong>';
      await wait(1400);
      if (!alive(id)) return;
      const target = help.querySelector('.cg-target');
      gsap.to(target, { opacity: 1, duration: 0.3 });
      await wait(350);
      const reed = target.querySelector('[data-who="reed"]');
      await PXFx.ability(layer, document.body, SUB, meter, reed);
      if (!alive(id)) return;
      await PXFx.strike(layer, reed.querySelector('.card'), SUBS[SUB].amount, false);
      if (!alive(id)) return;
      meter.classList.remove('ready');
      [...meter.querySelectorAll('.cg-pips i.on')].reverse().slice(0, COST).forEach((p, k) => gsap.delayedCall(k * 0.12, () => p.classList.remove('on')));
      caption.innerHTML = closing;
      help.querySelector('#again').hidden = false;
    },
  };

  // C: earn it yourself. Each round you call an element and pick a card; the checklist shows what you got.
  // Keep going until Lightning is ready, then use it on Reed.
  const HANDS = [
    [{ el: 'fire', power: 5 }, { el: 'water', power: 2 }, { el: 'earth', power: 4 }],
    [{ el: 'earth', power: 2 }, { el: 'fire', power: 3 }, { el: 'water', power: 1 }],
    [{ el: 'water', power: 3 }, { el: 'earth', power: 5 }, { el: 'fire', power: 4 }],
  ];
  const yourself = {
    key: 'c',
    name: 'C · Earn it yourself',
    note: 'Hands-on: get Lightning ready. Each round you call an element, then pick a card, and the checklist shows what you earned. Calling fire and playing fire gets there fastest, but any play gets at least 1. Once you reach 4, you zap Reed.',
    body: () => `
      ${yourElement}
      <div class="cg-split">${youHtml(0)}${receiptHtml()}</div>
      <div class="ask-box" aria-live="polite"></div>
      <div class="cg-target"><div class="cg-you" data-who="reed"><span class="duo-name">Reed</span><span class="slot"><span class="card">${cardBack()}</span></span></div></div>`,
    mount(id) {
      const box = help.querySelector('.ask-box');
      const split = help.querySelector('.cg-split');
      const meter = split.querySelector('.cg-meter');
      let sum = 0;
      let round = 0;
      let call = null;
      const on = (sel, fn) => box.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => fn(b)));

      const askCall = () => {
        split.querySelector('.duo-call').innerHTML = '';
        split.querySelector('.slot').innerHTML = '<span class="rd-empty"></span>';
        split.querySelectorAll('.cg-receipt li').forEach((li) => li.classList.remove('yes', 'no'));
        box.innerHTML = `<strong>Round ${round + 1}: call an element</strong><span>Tell everyone what you’re playing. You can lie.</span>
          <div class="ask-buttons">${['fire', 'water', 'earth'].map((el) => `<button class="action quiet" data-call="${el}">${icon(el)} ${cap(el)}</button>`).join('')}</div>`;
        on('[data-call]', (b) => {
          call = b.dataset.call;
          split.querySelector('.duo-call').innerHTML = bubble(call);
          pop(split.querySelector('.rd-call'));
          askCard();
        });
      };

      const askCard = () => {
        const hand = HANDS[round % HANDS.length];
        box.innerHTML = `<strong>Now pick a card</strong><span>You called ${call}.</span>
          <div class="ask-buttons"><div class="tap-row">${hand.map((c, n) => `<button class="card" data-card="${n}" aria-label="${cap(c.el)} ${c.power}">${cardArt(c.el, c.power)}</button>`).join('')}</div></div>`;
        on('[data-card]', async (b) => {
          const card = hand[Number(b.dataset.card)];
          box.innerHTML = '';
          split.querySelector('.slot').innerHTML = `<span class="card">${cardArt(card.el, card.power)}</span>`;
          await gsap.fromTo(split.querySelector('.card'), { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.8)' });
          const c = checks(call, card);
          await tick(id, split.querySelector('.cg-receipt'), meter, c);
          if (!alive(id)) return;
          sum = Math.min(CONFIG.maxCharge, sum + total(c));
          round += 1;
          box.innerHTML = `<strong>+${total(c)} charge</strong><span>You have ${sum} now.</span>`;
          if (sum >= COST) return ready();
          box.insertAdjacentHTML('beforeend', '<div class="ask-buttons"><button class="action small" id="next-round">Next round</button></div>');
          on('#next-round', askCall);
        });
      };

      const ready = () => {
        meter.classList.add('ready');
        box.innerHTML = `<strong>Lightning is ready!</strong><span>You got there in ${round} round${round > 1 ? 's' : ''}.</span>
          <div class="ask-buttons"><button class="action" id="zap">Use Lightning on Reed</button></div>`;
        on('#zap', async () => {
          box.innerHTML = '';
          const target = help.querySelector('.cg-target');
          await gsap.to(target, { opacity: 1, duration: 0.3 });
          const reed = target.querySelector('[data-who="reed"]');
          await PXFx.ability(layer, document.body, SUB, split.querySelector('.cg-you'), reed);
          if (!alive(id)) return;
          await PXFx.strike(layer, reed.querySelector('.card'), SUBS[SUB].amount, false);
          if (!alive(id)) return;
          meter.classList.remove('ready');
          [...meter.querySelectorAll('.cg-pips i.on')].reverse().slice(0, COST).forEach((p, k) => gsap.delayedCall(k * 0.12, () => p.classList.remove('on')));
          box.innerHTML = `<strong>3 damage to Reed</strong><span>That used ${COST} charge.</span><div class="ask-buttons"><button class="action quiet small" id="again">Try again</button></div>`;
          on('#again', () => render());
        });
      };

      askCall();
    },
  };

  const DESIGNS = [examples, fillbar, yourself];
  let current = DESIGNS[0];

  function render() {
    stopAll();
    const id = run;
    help.innerHTML = `
      <div class="help-head">
        <span class="dots">${Array.from({ length: 8 }, (_, n) => `<i class="${n === 4 ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool">Skip</button>
      </div>
      <h2>Charging your sub-element</h2>
      <div class="help-body">${current.body()}</div>
      <div class="help-foot"><button class="action quiet">Back</button><button class="action">Next</button></div>`;
    note.textContent = current.note;
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === current.key));
    current.mount(id);
  }

  tabs.innerHTML = DESIGNS.map((d) => `<button data-key="${d.key}">${d.name}</button>`).join('');
  tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    current = DESIGNS.find((d) => d.key === b.dataset.key);
    history.replaceState(null, '', `#${current.key}`);
    render();
  }));
  current = DESIGNS.find((d) => `#${d.key}` === location.hash) || DESIGNS[0];
  render();
})();
