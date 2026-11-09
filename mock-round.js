// Mock designs for the tutorial's "How a round goes" page. Three calmer takes: one thing happens at a time,
// with short lines. Pick a design with the tabs at the top, or open mock-round.html#b to go straight to one.
(function () {
  const { matchupDamage } = PX;
  const { cardArt, cardBack, powerArt } = PXArt;
  const help = document.getElementById('help');
  const tabs = document.getElementById('mock-tabs');
  const note = document.getElementById('mock-note');
  const layer = PXFx.createLayer(document.body);

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const icon = (el) => `<img class="el-icon" src="art/board/icon-${el}.webp" alt="">`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const bubble = (el) => `<span class="rd-call">${icon(el)} ${cap(el)}</span>`;

  // The same three steps, in the same words, in every design.
  const STEPS = [
    { title: 'Call it', lines: ['Call an element.', 'Use your sub-element, if you can. (More on those next.)'] },
    { title: 'Pick a card', lines: ['Choose a card and keep it hidden.'] },
    { title: 'Flip', lines: ['Everyone flips at once.'] },
  ];
  const stepText = (n) => `<span class="rd-num">Step ${n + 1} of 3</span><strong>${STEPS[n].title}</strong>${STEPS[n].lines.map((l) => `<span>${l}</span>`).join('')}`;

  // Just two players: you have Combustion and play fire; Reed calls water but plays earth.
  const YOU = { call: 'fire', card: { el: 'fire', power: 4 }, sub: 'combustion' };
  const REED = { call: 'water', card: { el: 'earth', power: 5 } };

  let run = 0;
  const alive = (id) => id === run;
  function stopAll() {
    run += 1;
    gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    layer.clear();
    document.querySelectorAll('.fx-label').forEach((el) => el.remove());
  }

  function seat(who, name) {
    return `<div class="duo-seat" data-who="${who}">
      <span class="duo-name">${name}</span>
      <span class="duo-call"></span>
      <span class="slot"><span class="rd-empty"></span></span>
    </div>`;
  }

  const pop = (el) => gsap.fromTo(el, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3)' });

  function dropCard(slot) {
    slot.innerHTML = `<span class="card">${cardBack()}</span>`;
    return gsap.fromTo(slot.firstChild, { y: -40, opacity: 0, rotation: -6 }, { y: 0, opacity: 1, rotation: 0, duration: 0.35, ease: 'back.out(1.8)' });
  }

  // Both cards flip, then whoever won hits the other.
  async function flip(id, root, mine, boosted) {
    const yourCard = root.querySelector('[data-who="you"] .card');
    const reedCard = root.querySelector('[data-who="reed"] .card');
    yourCard.innerHTML = cardArt(mine.el, mine.power);
    reedCard.innerHTML = cardArt(REED.card.el, REED.card.power);
    await gsap.fromTo([reedCard, yourCard], { rotationY: 90, transformPerspective: 600 }, { rotationY: 0, duration: 0.28, stagger: 0.1, ease: 'back.out(2)' });
    const youHit = matchupDamage(3, mine, REED.card) * (boosted && mine.el === 'fire' ? 2 : 1);
    const reedHit = matchupDamage(3, REED.card, mine);
    if (!alive(id)) return { youHit, reedHit };
    if (youHit) await PXFx.attack(layer, yourCard, mine.el, [{ card: reedCard, amount: youHit }]);
    if (reedHit) await PXFx.attack(layer, reedCard, REED.card.el, [{ card: yourCard, amount: reedHit }]);
    return { youHit, reedHit };
  }

  // A: watch it. Just you and Reed, and one thing happens at a time. The steps on top replay one.
  const watch = {
    key: 'a',
    name: 'A · Watch, then try it',
    mode: 'watch',
    note: 'Picked, with C added on: after the demo, “Try it yourself” lets you play the same round against Reed, one question at a time. “Watch the demo” goes back. Only two players, so there\'s less to look at. Each step does one thing: calls pop up and your Combustion lights, then both cards go face-down, then they flip and your fire hits Reed for 2. Plays on its own; tap a step to replay it.',
    body() {
      if (this.mode === 'try') return doit.body();
      return `
      <div class="rd-pills" role="group" aria-label="Steps">${STEPS.map((s, n) => `<button class="rd-pill" data-step="${n}"><b>${n + 1}</b> ${s.title}</button>`).join('<span class="rd-arrow">›</span>')}</div>
      <div class="duo">${seat('reed', 'Reed')}${seat('you', 'You')}</div>
      <p class="rd-step" aria-live="polite"></p>
      <div class="buttons center"><button class="action small" id="try">Try it yourself</button></div>`;
    },
    async mount(id) {
      if (this.mode === 'try') {
        doit.mount(id, () => { this.mode = 'watch'; render(); });
        return;
      }
      help.querySelector('#try').addEventListener('click', () => { this.mode = 'try'; render(); });
      help.querySelectorAll('.rd-pill').forEach((b) => b.addEventListener('click', () => { stopAll(); this.show(run, Number(b.dataset.step)); }));
      for (let n = 0; n < 3; n++) {
        if (!alive(id)) return;
        await this.show(id, n);
        await wait(1200);
      }
    },
    // Sets the table to how it looks before step n, then plays step n.
    async show(id, n) {
      const duo = help.querySelector('.duo');
      duo.innerHTML = `${seat('reed', 'Reed')}${seat('you', 'You')}`;
      const you = duo.querySelector('[data-who="you"]');
      const reed = duo.querySelector('[data-who="reed"]');
      if (n > 0) { you.querySelector('.duo-call').innerHTML = bubble(YOU.call); reed.querySelector('.duo-call').innerHTML = bubble(REED.call); }
      if (n > 1) { you.querySelector('.slot').innerHTML = `<span class="card">${cardBack()}</span>`; reed.querySelector('.slot').innerHTML = `<span class="card">${cardBack()}</span>`; }
      help.querySelectorAll('.rd-pill').forEach((p, k) => p.classList.toggle('on', k === n));
      help.querySelector('.rd-step').innerHTML = stepText(n);
      await wait(500);
      if (!alive(id)) return;
      if (n === 0) {
        for (const [s, p] of [[you, YOU], [reed, REED]]) {
          s.querySelector('.duo-call').innerHTML = bubble(p.call);
          pop(s.querySelector('.rd-call'));
          await wait(450);
          if (!alive(id)) return;
        }
        await PXFx.ability(layer, document.body, YOU.sub, you, null);
      } else if (n === 1) {
        await dropCard(you.querySelector('.slot'));
        await wait(200);
        if (alive(id)) await dropCard(reed.querySelector('.slot'));
      } else {
        await flip(id, duo, YOU.card, true);
      }
    },
  };

  // B: the big picture only. Three panels, each with a small picture and one line, lighting up in turn.
  const overview = {
    key: 'b',
    name: 'B · Three panels',
    note: 'No table at all, just the big picture: three panels side by side, each with a small picture and a line or two. They light up one after another. The details come on the pages after this one.',
    body: () => `
      <div class="ov">${STEPS.map((s, n) => `<div class="ov-panel" data-panel="${n}">
          <span class="ov-num">${n + 1}</span>
          <div class="ov-pic">${[
            `${bubble('fire')}<span class="ov-power">${powerArt('combustion')}</span>`,
            `<span class="card">${cardBack()}</span>`,
            `<span class="slot"><span class="card" data-ov="a">${cardArt('fire', 4)}</span></span><span class="slot"><span class="card" data-ov="b">${cardArt('earth', 5)}</span></span>`,
          ][n]}</div>
          <strong>${s.title}</strong>
          ${s.lines.map((l) => `<span>${l}</span>`).join('')}
        </div>`).join('<span class="ov-arrow">›</span>')}</div>
      <p class="rd-step"><span class="rd-after">Then the next round starts.</span></p>`,
    async mount(id) {
      const panels = [...help.querySelectorAll('.ov-panel')];
      for (const [n, panel] of panels.entries()) {
        await wait(n ? 900 : 400);
        if (!alive(id)) return;
        panel.classList.add('on');
        gsap.fromTo(panel, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
        if (n === 2) {
          await wait(300);
          if (alive(id)) await PXFx.attack(layer, panel.querySelector('[data-ov="a"]'), 'fire', [{ card: panel.querySelector('[data-ov="b"]'), amount: 1 }]);
        }
      }
    },
  };

  // C: do it yourself. One question at a time against Reed: call, use your power or not, pick a card, flip.
  const HAND = [{ el: 'fire', power: 4 }, { el: 'water', power: 3 }, { el: 'earth', power: 2 }];
  const doit = {
    key: 'c',
    name: 'C · Play one round',
    note: 'You play a round against Reed, one question at a time: call an element, decide on your sub-element, pick a card, flip. Only one thing is on screen to answer at any moment. Your choices change what happens at the flip.',
    body: () => `
      <div class="rd-dots">${STEPS.map((s, n) => `<span class="rd-dot" data-dot="${n}"><b>${n + 1}</b> ${s.title}</span>`).join('')}</div>
      <div class="duo">${seat('reed', 'Reed')}${seat('you', 'You')}</div>
      <div class="ask-box" aria-live="polite"></div>`,
    mount(id, backToDemo) {
      const box = help.querySelector('.ask-box');
      const you = help.querySelector('[data-who="you"]');
      const reed = help.querySelector('[data-who="reed"]');
      const state = { call: null, boosted: false, card: null };
      const dot = (n) => help.querySelectorAll('.rd-dot').forEach((d, k) => { d.classList.toggle('on', k === n); d.classList.toggle('done', k < n); });
      const ask = (title, line, buttons) => {
        box.innerHTML = `<strong>${title}</strong><span>${line}</span><div class="ask-buttons">${buttons}</div>`;
        gsap.fromTo(box, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 });
      };
      const on = (sel, fn) => box.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => fn(b)));

      const askCall = () => {
        dot(0);
        ask('Call an element', 'What will you say you\'re playing?', ['fire', 'water', 'earth'].map((el) => `<button class="action quiet" data-call="${el}">${icon(el)} ${cap(el)}</button>`).join(''));
        on('[data-call]', async (b) => {
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
        on('[data-use]', async (b) => {
          box.innerHTML = '';
          if (b.dataset.use === 'yes') {
            state.boosted = true;
            await PXFx.ability(layer, document.body, 'combustion', you, null);
          }
          if (alive(id)) askCard();
        });
      };

      const askCard = () => {
        dot(1);
        ask('Pick a card', 'Reed won\'t see it until the flip.', `<div class="tap-row">${HAND.map((c, n) => `<button class="card" data-card="${n}" aria-label="${cap(c.el)} ${c.power}">${cardArt(c.el, c.power)}</button>`).join('')}</div>`);
        on('[data-card]', async (b) => {
          state.card = HAND[Number(b.dataset.card)];
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
        on('#do-flip', async () => {
          box.innerHTML = '';
          const { youHit, reedHit } = await flip(id, help.querySelector('.duo'), state.card, state.boosted);
          if (!alive(id)) return;
          const result = youHit ? `You hit Reed for ${youHit}.` : reedHit ? `Reed hits you for ${reedHit}.` : 'Nobody gets hurt.';
          const kept = state.call === state.card.el ? ' You played what you called: <strong>+1 charge</strong>.' : '';
          ask(result, `Reed called water but played earth.${kept}`, `<button class="action quiet small" id="again">Play again</button>${backToDemo ? '<button class="action quiet small" id="demo">Watch the demo</button>' : ''}`);
          on('#again', () => render());
          on('#demo', () => backToDemo());
        });
      };

      askCall();
    },
  };

  const DESIGNS = [watch, overview, doit];
  let current = DESIGNS[0];

  function render() {
    stopAll();
    const id = run;
    help.innerHTML = `
      <div class="help-head">
        <span class="dots">${Array.from({ length: 8 }, (_, n) => `<i class="${n === 2 ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool">Skip</button>
      </div>
      <h2>How a round goes</h2>
      <div class="help-body">${current.body()}</div>
      <div class="help-foot"><button class="action quiet">Back</button><button class="action">Next</button></div>`;
    note.textContent = current.note;
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === current.key));
    current.mount(id);
  }

  tabs.innerHTML = DESIGNS.map((d) => `<button data-key="${d.key}">${d.name}</button>`).join('');
  tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    current = DESIGNS.find((d) => d.key === b.dataset.key);
    if (current.mode) current.mode = 'watch';
    history.replaceState(null, '', `#${current.key}`);
    render();
  }));
  current = DESIGNS.find((d) => `#${d.key}` === location.hash) || DESIGNS[0];
  render();
})();
