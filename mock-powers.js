// Mock designs for the tutorial's sub-elements step. Every design shows the powers working on a small
// two-player table (you and Reed), using the game's real power animations from fx.js.
// Pick a design with the tabs at the top, or open mock-powers.html#b to go straight to one.
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
  const ORDER = ['combustion', 'lightning', 'seismic', 'metal', 'healing', 'bloodbending'];
  const ELEMENTS = ['fire', 'earth', 'water'];

  // What each power does, in one plain line.
  const LINES = {
    combustion: 'Your next fire card does double damage.',
    lightning: 'Deal 3 damage to anyone.',
    seismic: 'See someone’s hand before the round.',
    metal: 'Block all incoming damage this round.',
    healing: 'Heal 2 HP.',
    bloodbending: 'Choose a face-down card an opponent has to play this round.',
  };

  let run = 0;
  const alive = (id) => id === run;
  function stopAll() {
    run += 1;
    gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    layer.clear();
    document.querySelectorAll('.fx-label').forEach((el) => el.remove());
  }

  // A small table: Reed on top, you at the bottom. Each seat has an HP count and its cards.
  // Cards marked down start face-down.
  const SCENES = {
    combustion: { you: { hp: 12, cards: [{ el: 'fire', power: 4 }] }, reed: { hp: 12, cards: [{ el: 'earth', power: 3 }] } },
    lightning: { you: { hp: 12, cards: [{ el: 'fire', power: 2 }] }, reed: { hp: 12, cards: [{ el: 'water', power: 5 }] } },
    seismic: { you: { hp: 12, cards: [{ el: 'earth', power: 4 }] }, reed: { hp: 12, down: true, cards: [{ el: 'water', power: 2 }, { el: 'fire', power: 5 }, { el: 'earth', power: 1 }, { el: 'water', power: 6 }] } },
    metal: { you: { hp: 12, cards: [{ el: 'earth', power: 2 }] }, reed: { hp: 12, cards: [{ el: 'fire', power: 5 }] } },
    healing: { you: { hp: 6, cards: [{ el: 'water', power: 3 }] }, reed: { hp: 12, cards: [{ el: 'earth', power: 4 }] } },
    bloodbending: { you: { hp: 12, cards: [{ el: 'water', power: 3 }] }, reed: { hp: 12, down: true, cards: [{ el: 'fire', power: 6 }, { el: 'earth', power: 1 }, { el: 'water', power: 4 }] } },
  };

  function seatHtml(who, name, seat) {
    return `<div class="mini-seat mini-${who}" data-who="${who}">
      <span class="mini-name">${name}</span>
      <span class="mini-hp"><b>${seat.hp}</b> HP<span class="mini-bar"><i style="width:${(seat.hp / CONFIG.maxHp) * 100}%"></i></span></span>
      <div class="mini-cards">${seat.cards.map((c) => `<span class="slot"><span class="card">${seat.down ? cardBack() : cardArt(c.el, c.power)}</span></span>`).join('')}</div>
    </div>`;
  }

  const tableHtml = (sub) => `<div class="mini-table" data-sub="${sub}">${seatHtml('reed', 'Reed', SCENES[sub].reed)}${seatHtml('you', 'You', SCENES[sub].you)}</div>`;

  function setHp(seat, hp) {
    const b = seat.querySelector('.mini-hp b');
    const counter = { v: Number(b.textContent) };
    gsap.to(counter, { v: hp, duration: 0.5, onUpdate: () => { b.textContent = Math.round(counter.v); } });
    gsap.to(seat.querySelector('.mini-bar i'), { width: `${(hp / CONFIG.maxHp) * 100}%`, duration: 0.5 });
    gsap.fromTo(seat.querySelector('.mini-hp'), { scale: 1.25 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  // Plays one power on a table, start to finish: the power goes off, then you see what it does.
  async function play(id, table, caption) {
    const sub = table.dataset.sub;
    const scene = SCENES[sub];
    const you = table.querySelector('.mini-you');
    const reed = table.querySelector('.mini-reed');
    const yourCard = you.querySelector('.card');
    const reedCards = [...reed.querySelectorAll('.card')];
    const say = (html) => { if (caption && alive(id)) caption.innerHTML = html; };
    const fx = (target) => PXFx.ability(layer, document.body, sub, you, target);

    say('&nbsp;');
    await wait(300);
    if (!alive(id)) return;
    if (sub === 'combustion') {
      await fx(null);
      if (!alive(id)) return;
      say('Fire beats earth, so normally that\'s 1 damage...');
      await PXFx.attack(layer, yourCard, 'fire', [{ card: reedCards[0], amount: 2 }]);
      setHp(reed, scene.reed.hp - 2);
      say('...but Combustion makes it <strong>2</strong>.');
    } else if (sub === 'lightning') {
      await fx(reed);
      if (!alive(id)) return;
      say('When the cards flip, the bolt lands.');
      await wait(400);
      if (!alive(id)) return;
      await PXFx.strike(layer, reedCards[0], SUBS.lightning.amount, false);
      setHp(reed, scene.reed.hp - SUBS.lightning.amount);
      say('<strong>3 damage</strong>, whatever cards got played.');
    } else if (sub === 'seismic') {
      await fx(reed);
      if (!alive(id)) return;
      reedCards.forEach((el, n) => { el.innerHTML = cardArt(scene.reed.cards[n].el, scene.reed.cards[n].power); });
      await PXFx.reveal(reedCards, cardBack());
      say('Only you see it. Now you know what Reed <strong>can</strong> play.');
    } else if (sub === 'metal') {
      await fx(null);
      if (!alive(id)) return;
      say('Reed\'s fire beats your earth...');
      await PXFx.attack(layer, reedCards[0], 'fire', [{ card: yourCard, amount: 2, blocked: true }]);
      say('...and it <strong>bounces right off</strong>.');
    } else if (sub === 'healing') {
      await fx(null);
      if (!alive(id)) return;
      setHp(you, scene.you.hp + SUBS.healing.amount);
      say(`Back up to <strong>${scene.you.hp + SUBS.healing.amount} HP</strong>.`);
    } else if (sub === 'bloodbending') {
      await fx(reed);
      if (!alive(id)) return;
      say('You grab one of Reed\'s face-down cards, without seeing it...');
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

  const powerCard = (key) => `<span class="power-card">${powerArt(key)}</span>`;
  const meta = (key) => `<span class="meta">${icon(SUBS[key].element)} ${cap(SUBS[key].element)} · costs ${SUBS[key].cost} charge</span>`;

  // A: one power at a time, like flipping through a deck. Its card and line on the left, the table on the right.
  const carousel = {
    key: 'a',
    name: 'A · One at a time',
    note: 'Flip through the six powers with the arrows. Each one plays on a small table next to its card as soon as you land on it. Big and clear, but it takes six taps to see everything.',
    index: 0,
    body() {
      const key = ORDER[this.index];
      return `
        <p class="ask">Before the game, everyone secretly picks a power.</p>
        <div class="carousel">
          <div class="pc-info el-${SUBS[key].element}">
            ${powerCard(key)}
            <strong class="pc-name">${SUBS[key].name}</strong>
            ${meta(key)}
            <span class="pc-line">${LINES[key]}</span>
          </div>
          ${tableHtml(key)}
        </div>
        <p class="pw-caption" aria-live="polite">&nbsp;</p>
        <div class="pc-nav">
          <button class="action quiet small" id="prev" aria-label="Previous power">‹</button>
          <span class="dots">${ORDER.map((_, n) => `<i class="${n === this.index ? 'on' : ''}"></i>`).join('')}</span>
          <button class="action quiet small" id="nextp" aria-label="Next power">›</button>
          <button class="action quiet small" id="replay">Replay</button>
        </div>`;
    },
    mount(id) {
      const go = (d) => { this.index = (this.index + d + ORDER.length) % ORDER.length; render(); };
      help.querySelector('#prev').addEventListener('click', () => go(-1));
      help.querySelector('#nextp').addEventListener('click', () => go(1));
      help.querySelector('#replay').addEventListener('click', () => render());
      play(id, help.querySelector('.mini-table'), help.querySelector('.pw-caption'));
    },
  };

  // B: the six powers as a row of picks, like the lobby. Tap one and it plays on the table below.
  const picker = {
    key: 'b',
    name: 'B · Tap to try',
    note: 'All six powers in a row, grouped by element, the same picks you\'ll see in the lobby. Tap one and it plays on the table underneath. Matches the face-off pills from step 1.',
    index: 0,
    body() {
      const key = ORDER[this.index];
      return `
        <p class="ask">You pick one of these before the game starts. <strong>Tap one to see what it does.</strong></p>
        <div class="pk-row">${ELEMENTS.map((el) => `<div class="pk-group el-${el}">${ORDER.filter((k) => SUBS[k].element === el).map((k) => `<button class="pk ${k === key ? 'on' : ''}" data-key="${k}" aria-label="${SUBS[k].name}">${powerArt(k)}<span>${SUBS[k].name}</span></button>`).join('')}</div>`).join('')}</div>
        <div class="pk-stage">
          <p class="pk-line"><strong>${SUBS[key].name}.</strong> ${LINES[key]} ${meta(key)}</p>
          ${tableHtml(key)}
          <p class="pw-caption" aria-live="polite">&nbsp;</p>
        </div>`;
    },
    mount(id) {
      help.querySelectorAll('.pk').forEach((b) => b.addEventListener('click', () => {
        this.index = ORDER.indexOf(b.dataset.key);
        render();
      }));
      play(id, help.querySelector('.mini-table'), help.querySelector('.pw-caption'));
    },
  };

  // C: one element at a time, with its two powers side by side, so you see the choice you'd be making.
  const pairs = {
    key: 'c',
    name: 'C · Two per element',
    note: 'Three tabs: fire, earth, water. Each shows that element\'s two powers side by side, and they play one after the other. Shows the real choice: every element has two very different powers.',
    el: 'fire',
    body() {
      const keys = ORDER.filter((k) => SUBS[k].element === this.el);
      return `
        <p class="ask">Each element has two powers. Before the game, <strong>you secretly pick one.</strong></p>
        <div class="pr-tabs">${ELEMENTS.map((el) => `<button class="pr-tab el-${el} ${el === this.el ? 'on' : ''}" data-el="${el}">${icon(el)} ${cap(el)}</button>`).join('')}</div>
        <div class="pr-pair">${keys.map((k) => `<div class="pr-side el-${this.el}">
            <div class="pr-head">${powerCard(k)}<span><strong>${SUBS[k].name}</strong><small>${LINES[k]}</small></span></div>
            ${tableHtml(k)}
          </div>`).join('<span class="pr-or">or</span>')}</div>`;
    },
    async mount(id) {
      help.querySelectorAll('.pr-tab').forEach((b) => b.addEventListener('click', () => { this.el = b.dataset.el; render(); }));
      for (const table of help.querySelectorAll('.mini-table')) {
        if (!alive(id)) return;
        await play(id, table, null);
        await wait(500);
      }
    },
  };

  const DESIGNS = [carousel, picker, pairs];
  let current = DESIGNS[0];

  function render() {
    stopAll();
    const id = run;
    help.innerHTML = `
      <div class="help-head">
        <span class="dots">${Array.from({ length: 8 }, (_, n) => `<i class="${n === 3 ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool">Skip</button>
      </div>
      <h2>Choose your sub-element</h2>
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
