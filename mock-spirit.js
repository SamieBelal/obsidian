// Mock designs for the tutorial's "Knocked out" page: players who are out go to the Spirit World, vote for
// an element each round, and the winner gets +1 on every card of it (a tie does nothing). The example
// fight is Reed's fire 5 against Jo's earth 5: 1 damage normally, 2 once fire is boosted to 6.
// Pick a design with the tabs at the top, or open mock-spirit.html#b to go straight to one.
(function () {
  const { matchupDamage } = PX;
  const { cardArt, cardBack } = PXArt;
  const help = document.getElementById('help');
  const tabs = document.getElementById('mock-tabs');
  const note = document.getElementById('mock-note');
  const layer = PXFx.createLayer(document.body);

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const icon = (el) => `<img class="el-icon" src="art/board/icon-${el}.webp" alt="">`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ELEMENTS = ['fire', 'water', 'earth'];

  const REED = { el: 'fire', power: 5 };
  const JO = { el: 'earth', power: 5 };

  let run = 0;
  const alive = (id) => id === run;
  function stopAll() {
    run += 1;
    gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    layer.clear();
    document.querySelectorAll('.fx-label, .sp-orb').forEach((el) => el.remove());
  }

  const seat = (who, name, card, hp) => `<div class="sp-seat" data-who="${who}">
      <span class="sp-name">${name}</span>
      <span class="slot"><span class="card">${card ? cardArt(card.el, card.power) : cardBack()}</span></span>
      ${hp === undefined ? '' : `<span class="sp-hp"><b>${hp}</b> HP</span>`}
    </div>`;

  // A spirit: a faded, glowing card back that floats gently.
  const spirit = (who, name) => `<div class="sp-ghost" data-who="${who}"><span class="sp-ghost-card">${cardBack()}</span><span class="sp-name">${name}</span></div>`;
  function floatGhosts() {
    help.querySelectorAll('.sp-ghost-card').forEach((g, n) => gsap.to(g, { y: -6, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: n * 0.4 }));
  }

  // The vote count for each element, as three chips.
  const tallyHtml = () => `<div class="sp-tally">${ELEMENTS.map((el) => `<span class="sp-chip el-${el}" data-el="${el}">${icon(el)} ${cap(el)} <b>0</b></span>`).join('')}</div>`;

  // A vote flies from a spirit to its element's chip and bumps the count.
  function vote(fromEl, el) {
    return new Promise((resolve) => {
      const chip = help.querySelector(`.sp-chip[data-el="${el}"]`);
      const a = fromEl.getBoundingClientRect();
      const b = chip.getBoundingClientRect();
      const orb = document.createElement('span');
      orb.className = 'sp-orb';
      orb.innerHTML = icon(el);
      document.body.appendChild(orb);
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
    help.querySelectorAll('.sp-seat').forEach((s) => {
      const card = s.querySelector('.card');
      const num = card.querySelector('.card-num');
      if (!num || card.dataset.el !== el) return;
      num.textContent = Number(num.textContent) + 1;
      num.classList.add('boosted');
      gsap.fromTo(card, { boxShadow: '0 0 0 3px #9FE8FF, 0 0 26px #6FD3F0' }, { boxShadow: '0 0 0 0px rgba(0,0,0,0), 0 0 0px rgba(0,0,0,0)', duration: 1.4, clearProps: 'boxShadow' });
      const tag = document.createElement('span');
      tag.className = 'sp-plus';
      tag.textContent = '+1';
      s.querySelector('.slot').appendChild(tag);
      gsap.fromTo(tag, { xPercent: -50, scale: 0.2, y: 0, opacity: 1 }, { scale: 1.2, y: -26, duration: 0.5, ease: 'back.out(3)' });
    });
  }

  // Reed's fire hits Jo's earth; the damage depends on whether fire got the +1.
  async function fight(boosted) {
    const reed = help.querySelector('[data-who="reed"] .card');
    const jo = help.querySelector('[data-who="jo"] .card');
    const amount = matchupDamage(3, { el: 'fire', power: REED.power + (boosted ? 1 : 0) }, JO);
    await PXFx.attack(layer, reed, 'fire', [{ card: jo, amount }]);
    return amount;
  }

  const tableHtml = (withCards = true) => `<div class="sp-table">${seat('reed', 'Reed', withCards ? REED : null)}${seat('jo', 'Jo', withCards ? JO : null)}</div>`;
  const markCards = () => {
    const r = help.querySelector('[data-who="reed"] .card');
    const j = help.querySelector('[data-who="jo"] .card');
    if (r) r.dataset.el = REED.el;
    if (j) j.dataset.el = JO.el;
  };

  // A: the whole story. Mia gets knocked out and floats up to the Spirit World, then she and Sam vote
  // fire, and Reed's fire 5 becomes a 6 and hits Jo twice as hard.
  const story = {
    key: 'a',
    name: 'A · Watch it happen',
    note: 'A short story: Mia is down to 1 HP, takes a hit and is out. Her card fades and floats up into the Spirit World next to Sam, who’s already out. Next round they both vote fire, so Reed’s fire 5 becomes a 6 and hits Jo for 2 instead of 1.',
    body: () => `
      <div class="sp-world"><span class="sp-world-label">Spirit World</span><div class="sp-ghosts">${spirit('sam', 'Sam')}</div></div>
      ${tallyHtml()}
      <div class="sp-table">${seat('reed', 'Reed', REED, 6)}${seat('mia', 'Mia', { el: 'earth', power: 2 }, 1)}${seat('jo', 'Jo', JO, 7)}</div>
      <p class="fo-caption" aria-live="polite">&nbsp;</p>
      <div class="buttons center"><button class="action quiet small" id="again" hidden>Watch again</button></div>`,
    async mount(id) {
      const caption = help.querySelector('.fo-caption');
      help.querySelector('#again').addEventListener('click', () => render());
      help.querySelector('.sp-tally').style.visibility = 'hidden';
      markCards();
      floatGhosts();
      await wait(600);
      if (!alive(id)) return;

      // Mia is hit to 0 and is out.
      caption.innerHTML = 'Mia is down to her last HP...';
      const mia = help.querySelector('[data-who="mia"]');
      await PXFx.attack(layer, help.querySelector('[data-who="reed"] .card'), 'fire', [{ card: mia.querySelector('.card'), amount: 2 }]);
      if (!alive(id)) return;
      mia.querySelector('.sp-hp b').textContent = '0';
      caption.innerHTML = '<span class="dmg">Mia is out</span><strong>But she’s not done.</strong>';
      await wait(900);
      if (!alive(id)) return;

      // Her seat fades and a spirit rises into the Spirit World.
      const ghosts = help.querySelector('.sp-ghosts');
      const from = mia.getBoundingClientRect();
      ghosts.insertAdjacentHTML('beforeend', spirit('mia', 'Mia'));
      const ghost = ghosts.lastElementChild;
      const to = ghost.getBoundingClientRect();
      gsap.to(mia, { opacity: 0, scale: 0.8, duration: 0.5 });
      await gsap.fromTo(ghost, { x: from.left - to.left, y: from.top - to.top, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.9, ease: 'power2.inOut' });
      mia.remove();
      floatGhosts();
      caption.innerHTML = '<span class="ev-vs">Spirit World</span>Players who are out go here. <strong>Every round, they vote for an element.</strong>';
      await wait(1600);
      if (!alive(id)) return;

      // Next round: both spirits vote fire.
      const tally = help.querySelector('.sp-tally');
      tally.style.visibility = 'visible';
      gsap.fromTo(tally, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      ['reed', 'jo'].forEach((w) => { help.querySelector(`[data-who="${w}"] .card`).innerHTML = cardBack(); });
      await wait(400);
      for (const g of help.querySelectorAll('.sp-ghost')) {
        if (!alive(id)) return;
        await vote(g, 'fire');
      }
      if (!alive(id)) return;
      caption.innerHTML = '<span class="dmg gain">Fire wins the vote</span><strong>Every fire card gets +1 this round.</strong>';
      await wait(1200);
      if (!alive(id)) return;

      // The cards flip, fire gets its +1, and Reed's hit lands harder.
      const reedCard = help.querySelector('[data-who="reed"] .card');
      const joCard = help.querySelector('[data-who="jo"] .card');
      reedCard.innerHTML = cardArt(REED.el, REED.power);
      joCard.innerHTML = cardArt(JO.el, JO.power);
      await gsap.fromTo([reedCard, joCard], { rotationY: 90, transformPerspective: 600 }, { rotationY: 0, duration: 0.28, stagger: 0.1, ease: 'back.out(2)' });
      await wait(300);
      boost('fire');
      await wait(900);
      if (!alive(id)) return;
      const amount = await fight(true);
      if (!alive(id)) return;
      caption.innerHTML = `<span class="dmg">Jo loses ${amount}</span><strong>Reed’s fire went from 5 to 6, so it beat Jo’s earth by more.</strong>`;
      await wait(1800);
      if (!alive(id)) return;
      caption.innerHTML = 'The most votes wins. <strong>A tie does nothing.</strong>';
      help.querySelector('#again').hidden = false;
    },
  };

  // B: you're the spirit. You've been knocked out; vote, and see what your vote does to the next fight.
  // Sam, the other spirit, votes fire, so voting fire wins it and anything else ties.
  const yourvote = {
    key: 'b',
    name: 'B · You’re the spirit',
    note: 'Hands-on: you’ve been knocked out, and you get to vote. Sam (also out) votes fire. Vote fire too and fire gets +1, so Reed hits Jo for 2. Vote anything else and it’s a 1–1 tie, nothing gets boosted, and Reed hits for 1. Teaches the tie rule by letting you trigger it.',
    body: () => `
      <div class="sp-world"><span class="sp-world-label">Spirit World</span><div class="sp-ghosts">${spirit('you', 'You')}${spirit('sam', 'Sam')}</div></div>
      ${tallyHtml()}
      ${tableHtml(false)}
      <div class="ask-box" aria-live="polite"></div>`,
    mount(id) {
      const box = help.querySelector('.ask-box');
      floatGhosts();
      box.innerHTML = `<strong>You’re out, but you’re not done</strong><span>Vote for an element. If it gets the most votes, every card of it gets <strong>+1</strong> this round.</span>
        <div class="ask-buttons">${ELEMENTS.map((el) => `<button class="action quiet" data-vote="${el}">${icon(el)} ${cap(el)}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', async () => {
        const mine = b.dataset.vote;
        box.innerHTML = '';
        await vote(help.querySelector('[data-who="you"]'), mine);
        if (!alive(id)) return;
        await wait(300);
        await vote(help.querySelector('[data-who="sam"]'), 'fire');
        if (!alive(id)) return;
        const won = mine === 'fire';
        box.innerHTML = won ? '<strong>Fire wins, 2 votes to 0</strong><span>Every fire card gets +1.</span>' : '<strong>It’s a tie, 1 to 1</strong><span>A tie does nothing. No boost this round.</span>';
        await wait(1200);
        if (!alive(id)) return;
        help.querySelector('.sp-table').outerHTML = tableHtml(true);
        markCards();
        const cards = help.querySelectorAll('.sp-table .card');
        await gsap.fromTo(cards, { rotationY: 90, transformPerspective: 600 }, { rotationY: 0, duration: 0.28, stagger: 0.1, ease: 'back.out(2)' });
        if (won) { boost('fire'); await wait(900); }
        if (!alive(id)) return;
        const amount = await fight(won);
        if (!alive(id)) return;
        box.innerHTML = `<strong>Reed hits Jo for ${amount}</strong><span>${won ? 'Your vote made Reed’s fire a 6. Without it, that was only 1.' : 'Vote fire with Sam and Reed’s fire becomes a 6, for 2 damage.'}</span>
          <div class="ask-buttons"><button class="action quiet small" id="again">Vote again</button></div>`;
        box.querySelector('#again').addEventListener('click', () => render());
      }));
    },
  };

  // C: the rule in three quick panels that light up in turn.
  const panels = {
    key: 'c',
    name: 'C · Three panels',
    note: 'The calm version, like the three-panel round overview: Out → Vote → +1. Each panel has a small picture and one line, lighting up in turn, and the last one shows a fire 5 turning into a 6.',
    body: () => `
      <div class="ov">
        <div class="ov-panel" data-panel="0"><span class="ov-num">1</span><div class="ov-pic">${spirit('p0', '')}</div><strong>Hit 0 HP?</strong><span>You go to the Spirit World.</span></div>
        <span class="ov-arrow">›</span>
        <div class="ov-panel" data-panel="1"><span class="ov-num">2</span><div class="ov-pic">${ELEMENTS.map((el) => icon(el)).join('')}</div><strong>Vote</strong><span>Every round, pick an element.</span></div>
        <span class="ov-arrow">›</span>
        <div class="ov-panel" data-panel="2"><span class="ov-num">3</span><div class="ov-pic"><span class="sp-seat"><span class="slot"><span class="card" data-el="fire">${cardArt('fire', 5)}</span></span></span></div><strong>+1</strong><span>The most votes gives every card of it +1.</span></div>
      </div>
      <p class="fo-caption">A tie does nothing.</p>`,
    async mount(id) {
      floatGhosts();
      const list = [...help.querySelectorAll('.ov-panel')];
      for (const [n, panel] of list.entries()) {
        await wait(n ? 1000 : 400);
        if (!alive(id)) return;
        panel.classList.add('on');
        gsap.fromTo(panel, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
        if (n === 1) {
          panel.querySelectorAll('.el-icon').forEach((e, k) => gsap.fromTo(e, { y: 0 }, { y: -8, duration: 0.25, yoyo: true, repeat: 1, delay: k * 0.15 }));
        }
        if (n === 2) {
          await wait(500);
          if (alive(id)) boost('fire');
        }
      }
    },
  };

  const DESIGNS = [story, yourvote, panels];
  let current = DESIGNS[0];

  function render() {
    stopAll();
    const id = run;
    help.innerHTML = `
      <div class="help-head">
        <span class="dots">${Array.from({ length: 8 }, (_, n) => `<i class="${n === 6 ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool">Skip</button>
      </div>
      <h2>Knocked out? Not done yet</h2>
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
