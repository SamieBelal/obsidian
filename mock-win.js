// Mock designs for the tutorial's last page: 12 HP and last one standing wins, your hand (5 cards, draw one
// a round, the newest is face-up for everyone), and sudden death when two are left (every hit does +1,
// then +2, and so on). Pick a design with the tabs at the top, or open mock-win.html#b to go to one.
(function () {
  const { matchupDamage, CONFIG } = PX;
  const { cardArt, cardBack } = PXArt;
  const help = document.getElementById('help');
  const tabs = document.getElementById('mock-tabs');
  const note = document.getElementById('mock-note');
  const layer = PXFx.createLayer(document.body);

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);

  let run = 0;
  const alive = (id) => id === run;
  function stopAll() {
    run += 1;
    gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    layer.clear();
    document.querySelectorAll('.fx-label').forEach((el) => el.remove());
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

  const hpBar = (hp) => `<span class="wn-hp"><b>${hp}</b> HP<span class="wn-bar"><i style="width:${(hp / CONFIG.maxHp) * 100}%"></i></span></span>`;
  function setHp(seat, hp) {
    const b = seat.querySelector('.wn-hp b');
    const counter = { v: Number(b.textContent) };
    gsap.to(counter, { v: hp, duration: 0.5, onUpdate: () => { b.textContent = Math.round(counter.v); } });
    gsap.to(seat.querySelector('.wn-bar i'), { width: `${(hp / CONFIG.maxHp) * 100}%`, duration: 0.5 });
  }

  // Your hand: all five face-up to you, with the newest marked, since everyone else can see that one too.
  const handHtml = (cards, newest) => `<div class="wn-hand">${cards.map((c, n) => `<span class="wn-held${n === newest ? ' shown' : ''}"><span class="card">${cardArt(c.el, c.power)}</span>${n === newest ? '<span class="wn-eye">Everyone sees this</span>' : ''}</span>`).join('')}</div>`;
  // Someone else's hand, as you see it: four backs and their one face-up card.
  const theirHand = (faceUp) => `<div class="wn-hand theirs">${'<span class="wn-held"><span class="card">' + cardBack() + '</span></span>'.repeat(4)}<span class="wn-held shown"><span class="card">${cardArt(faceUp.el, faceUp.power)}</span></span></div>`;

  // A: four short beats with pills: HP, your hand, sudden death, the win.
  const HAND = [{ el: 'water', power: 3 }, { el: 'fire', power: 5 }, { el: 'earth', power: 2 }, { el: 'water', power: 6 }];
  const DRAWN = { el: 'earth', power: 4 };
  const beats = {
    key: 'a',
    name: 'A · Four quick beats',
    note: 'Four short beats with pills, like the face-off pages: 12 HP and out at 0; your hand of 5, where the card you just drew is face-up for everyone; sudden death with two left; and the win, with a gold burst. Tap a pill to replay one.',
    steps: ['12 HP', 'Your hand', 'Sudden death', 'The win'],
    body() {
      return `<div class="fo-pills" role="group" aria-label="Rules">${this.steps.map((s, n) => `<button class="fo-pill" data-beat="${n}">${s}</button>`).join('')}</div>
        <div class="wn-stage"></div>
        <p class="fo-caption" aria-live="polite">&nbsp;</p>`;
    },
    async mount(id) {
      help.querySelectorAll('[data-beat]').forEach((b) => b.addEventListener('click', () => { stopAll(); this.show(run, Number(b.dataset.beat)); }));
      for (let n = 0; n < this.steps.length; n++) {
        if (!alive(id)) return;
        await this.show(id, n);
        if (!alive(id)) return;
        await wait(1400);
      }
    },
    async show(id, n) {
      const stage = help.querySelector('.wn-stage');
      const caption = help.querySelector('.fo-caption');
      help.querySelectorAll('[data-beat]').forEach((p, k) => p.classList.toggle('on', k === n));
      caption.innerHTML = '&nbsp;';
      if (n === 0) {
        stage.innerHTML = `<div class="wn-row">${['You', 'Reed', 'Mia'].map((name, i) => `<div class="wn-seat" data-i="${i}"><span class="sp-name">${name}</span>${hpBar(12)}</div>`).join('')}</div>`;
        caption.innerHTML = `<span class="dmg gain">Everyone starts with ${CONFIG.maxHp} HP</span><strong>Hit 0 and you’re out.</strong>`;
        await wait(900);
        if (!alive(id)) return;
        const mia = stage.querySelector('[data-i="2"]');
        setHp(mia, 0);
        await wait(600);
        gsap.to(mia, { opacity: 0.3, filter: 'grayscale(1)', duration: 0.4 });
      } else if (n === 1) {
        stage.innerHTML = `<p class="wn-label">Your hand</p>${handHtml(HAND, 3)}`;
        caption.innerHTML = `<span class="dmg gain">You hold ${CONFIG.handSize} cards</span><strong>You draw one after every round.</strong>`;
        await wait(800);
        if (!alive(id)) return;
        const hand = stage.querySelector('.wn-hand');
        hand.querySelector('.shown .wn-eye').remove();
        hand.querySelector('.shown').classList.remove('shown');
        hand.insertAdjacentHTML('beforeend', `<span class="wn-held shown"><span class="card">${cardArt(DRAWN.el, DRAWN.power)}</span><span class="wn-eye">Everyone sees this</span></span>`);
        await gsap.fromTo(hand.lastElementChild, { x: 80, y: -40, opacity: 0, rotation: 10 }, { x: 0, y: 0, opacity: 1, rotation: 0, duration: 0.45, ease: 'back.out(1.6)' });
        if (!alive(id)) return;
        caption.innerHTML = '<span class="dmg gain">The card you just drew is face-up</span><strong>Everyone can see it. The rest stay hidden.</strong>';
      } else if (n === 2) {
        stage.innerHTML = `<div class="wn-banner">Sudden death</div><div class="wn-row">${this.duelSeat('you', 'You', { el: 'water', power: 3 }, 4)}${this.duelSeat('reed', 'Reed', { el: 'fire', power: 2 }, 5)}</div>`;
        gsap.fromTo(stage.querySelector('.wn-banner'), { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.5)' });
        caption.innerHTML = '<span class="dmg">Down to two players?</span><strong>Every hit does 1 extra, then 2 extra, and so on.</strong>';
        await wait(1200);
        if (!alive(id)) return;
        const base = matchupDamage(3, { el: 'water', power: 3 }, { el: 'fire', power: 2 });
        await PXFx.attack(layer, stage.querySelector('[data-who="you"] .card'), 'water', [{ card: stage.querySelector('[data-who="reed"] .card'), amount: base + 1 }]);
        if (!alive(id)) return;
        setHp(stage.querySelector('[data-who="reed"]'), 5 - (base + 1));
        caption.innerHTML = `<span class="dmg">${base} + 1 extra = ${base + 1}</span><strong>So the game can’t drag on.</strong>`;
      } else {
        stage.innerHTML = `<div class="wn-world">${spiritRow(['Reed', 'Mia', 'Jo'])}</div><div class="wn-row"><div class="wn-seat wn-winner" data-who="you"><span class="sp-name">You</span>${hpBar(3)}</div></div>`;
        floatGhosts();
        await wait(500);
        if (!alive(id)) return;
        celebrate(stage.querySelector('.wn-winner'));
        caption.innerHTML = '<span class="dmg gain wn-big">Last one standing wins</span><strong>That’s everything. Have fun!</strong>';
      }
    },
    duelSeat: (who, name, card, hp) => `<div class="wn-seat" data-who="${who}"><span class="sp-name">${name}</span><span class="slot"><span class="card">${cardArt(card.el, card.power)}</span></span>${hpBar(hp)}</div>`,
  };

  const spiritRow = (names) => `<span class="sp-world-label">Spirit World</span><div class="sp-ghosts">${names.map((n) => `<div class="sp-ghost"><span class="sp-ghost-card">${cardBack()}</span><span class="sp-name">${n}</span></div>`).join('')}</div>`;
  function floatGhosts() {
    help.querySelectorAll('.sp-ghost-card').forEach((g, n) => gsap.to(g, { y: -6, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: n * 0.4 }));
  }

  // B: win the final round yourself. It's sudden death, Reed has 2 HP, and you can see Reed's face-up card.
  const MY_HAND = [{ el: 'earth', power: 6 }, { el: 'water', power: 2 }, { el: 'fire', power: 1 }, { el: 'earth', power: 3 }, { el: 'fire', power: 4 }];
  const REED_CARD = { el: 'fire', power: 3 };
  const final = {
    key: 'b',
    name: 'B · Win the last round',
    note: 'Hands-on: it’s you and Reed, sudden death. Reed has 2 HP and you have 3. You can see Reed’s face-up card (the one Reed just drew): fire 3. Pick a card from your hand to win. Water beats it, and so does a bigger fire. Earth or fire 1 loses, and Reed hits you for 2 (1 + 1 for sudden death).',
    body: () => `
      <div class="wn-world">${spiritRow(['Mia', 'Jo'])}</div>
      <div class="wn-banner small">Sudden death: every hit +1</div>
      <div class="wn-duel">
        <div class="wn-seat" data-who="reed"><span class="sp-name">Reed</span>${hpBar(2)}${theirHand(REED_CARD)}<span class="slot wn-play"></span></div>
      </div>
      <div class="ask-box" aria-live="polite"></div>
      <div class="wn-seat wn-me" data-who="you"><span class="slot wn-play"></span><span class="sp-name">You</span>${hpBar(3)}</div>`,
    mount(id) {
      floatGhosts();
      const box = help.querySelector('.ask-box');
      const reed = help.querySelector('[data-who="reed"]');
      const you = help.querySelector('[data-who="you"]');
      box.innerHTML = `<strong>Win the game</strong><span>Reed’s face-up card is <strong>fire 3</strong>, the one Reed just drew. Reed plays it. Pick your card.</span>
        <div class="ask-buttons"><div class="tap-row">${MY_HAND.map((c, n) => `<button class="card" data-card="${n}" aria-label="${cap(c.el)} ${c.power}">${cardArt(c.el, c.power)}</button>`).join('')}</div></div>`;
      box.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', async () => {
        const mine = MY_HAND[Number(b.dataset.card)];
        box.innerHTML = '';
        const reedSlot = reed.querySelector('.wn-play');
        const yourSlot = you.querySelector('.wn-play');
        reed.querySelector('.wn-hand .shown').style.visibility = 'hidden';
        reedSlot.innerHTML = `<span class="card">${cardArt(REED_CARD.el, REED_CARD.power)}</span>`;
        yourSlot.innerHTML = `<span class="card">${cardArt(mine.el, mine.power)}</span>`;
        await gsap.fromTo([reedSlot.firstChild, yourSlot.firstChild], { y: (i) => (i ? 30 : -30), opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.8)' });
        const out = matchupDamage(3, mine, REED_CARD);
        const inn = matchupDamage(3, REED_CARD, mine);
        if (out) await PXFx.attack(layer, yourSlot.firstChild, mine.el, [{ card: reedSlot.firstChild, amount: out + 1 }]);
        if (inn) await PXFx.attack(layer, reedSlot.firstChild, REED_CARD.el, [{ card: yourSlot.firstChild, amount: inn + 1 }]);
        if (!alive(id)) return;
        if (out) {
          setHp(reed, 0);
          gsap.to(reed, { opacity: 0.3, filter: 'grayscale(1)', duration: 0.5, delay: 0.4 });
          await wait(700);
          if (!alive(id)) return;
          celebrate(you);
          box.innerHTML = `<strong class="wn-big">You win!</strong><span>${cap(mine.el)} ${mine.power} beat Reed’s fire for ${out}, +1 for sudden death. <strong>Last one standing wins.</strong></span>
            <div class="ask-buttons"><button class="action quiet small" id="again">Play it again</button></div>`;
        } else {
          if (inn) setHp(you, Math.max(0, 3 - (inn + 1)));
          const lostIt = inn + 1 >= 3;
          box.innerHTML = `<strong class="bad">${inn ? (lostIt ? 'Reed wins this one' : `Reed hits you for ${inn + 1}`) : 'Nobody gets hurt'}</strong><span>${inn ? `Reed’s fire beat your ${mine.el} for ${inn}, +1 for sudden death.` : 'Same card, nothing happens.'} Reed’s fire 3 was face-up the whole time. <strong>Water beats it.</strong></span>
            <div class="ask-buttons"><button class="action small" id="again">Try again</button></div>`;
        }
        box.querySelector('#again').addEventListener('click', () => render());
      }));
    },
  };

  // C: three panels, then the win.
  const panels = {
    key: 'c',
    name: 'C · Three panels',
    note: 'The calm version: three panels (12 HP, your hand, sudden death) light up in turn, then a big “Last one standing wins” finish with a gold burst.',
    body: () => `
      <div class="ov">
        <div class="ov-panel"><span class="ov-num">1</span><div class="ov-pic"><span class="wn-big-hp">${CONFIG.maxHp}</span></div><strong>${CONFIG.maxHp} HP</strong><span>Hit 0 and you’re out.</span></div>
        <span class="ov-arrow">›</span>
        <div class="ov-panel"><span class="ov-num">2</span><div class="ov-pic">${theirHand({ el: 'fire', power: 4 })}</div><strong>Your hand</strong><span>Hold ${CONFIG.handSize}, draw one a round. The one you just drew is face-up.</span></div>
        <span class="ov-arrow">›</span>
        <div class="ov-panel"><span class="ov-num">3</span><div class="ov-pic"><span class="wn-plus">+1</span></div><strong>Two left?</strong><span>Every hit does extra, and it grows each round.</span></div>
      </div>
      <p class="wn-finish" aria-live="polite"></p>`,
    async mount(id) {
      const list = [...help.querySelectorAll('.ov-panel')];
      for (const [n, panel] of list.entries()) {
        await wait(n ? 1000 : 400);
        if (!alive(id)) return;
        panel.classList.add('on');
        gsap.fromTo(panel, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      }
      await wait(1100);
      if (!alive(id)) return;
      const finish = help.querySelector('.wn-finish');
      finish.innerHTML = 'Last one standing wins';
      gsap.fromTo(finish, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.5)' });
      celebrate(finish);
    },
  };

  const DESIGNS = [beats, final, panels];
  let current = DESIGNS[0];

  function render() {
    stopAll();
    const id = run;
    help.innerHTML = `
      <div class="help-head">
        <span class="dots">${Array.from({ length: 8 }, (_, n) => `<i class="${n === 7 ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool">Skip</button>
      </div>
      <h2>Last one standing</h2>
      <div class="help-body">${current.body()}</div>
      <div class="help-foot"><button class="action quiet">Back</button><button class="action">Start playing</button></div>`;
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
