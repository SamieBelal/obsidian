// Mock designs for the tutorial's "Everyone at once" page: four players flip together and every card
// fights every other card. Damage comes from the engine's own rule, so the numbers match the game.
// Pick a design with the tabs at the top, or open mock-everyone.html#b to go straight to one.
(function () {
  const { matchupDamage } = PX;
  const { cardArt, cardBack } = PXArt;
  const help = document.getElementById('help');
  const tabs = document.getElementById('mock-tabs');
  const note = document.getElementById('mock-note');
  const layer = PXFx.createLayer(document.body);

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const TABLE = [
    { name: 'You', card: { el: 'fire', power: 4 } },
    { name: 'Reed', card: { el: 'earth', power: 5 } },
    { name: 'Mia', card: { el: 'water', power: 2 } },
    { name: 'Jo', card: { el: 'fire', power: 6 } },
  ];
  const dmg = (from, to) => (from === to ? 0 : matchupDamage(3, TABLE[from].card, TABLE[to].card));
  // Who hits seat i, and for how much.
  const hitsOn = (i) => TABLE.map((p, j) => ({ from: j, amount: dmg(j, i) })).filter((h) => h.amount > 0);
  const lost = (i) => hitsOn(i).reduce((sum, h) => sum + h.amount, 0);
  const label = (c) => `${cap(c.el)} ${c.power}`;

  let run = 0;
  const alive = (id) => id === run;
  function stopAll() {
    run += 1;
    gsap.globalTimeline.getChildren().forEach((t) => t.kill());
    layer.clear();
    document.querySelectorAll('.fx-label').forEach((el) => el.remove());
  }

  const tableHtml = () => `<ul class="tut-board ev-board">${TABLE.map((p, i) => `<li class="tut-seat ev-seat${i === 0 ? ' tut-you' : ''}" data-seat="${i}">
      <span class="tut-name">${p.name}</span>
      <span class="slot"><span class="card">${cardBack()}</span></span>
      <span class="ev-result"></span>
    </li>`).join('')}</ul>`;

  const seatEl = (i) => help.querySelector(`[data-seat="${i}"]`);
  const cardEl = (i) => seatEl(i).querySelector('.card');

  async function flipAll() {
    TABLE.forEach((p, i) => { cardEl(i).innerHTML = cardArt(p.card.el, p.card.power); });
    await gsap.fromTo(TABLE.map((_, i) => cardEl(i)), { rotationY: 90, transformPerspective: 600 }, { rotationY: 0, duration: 0.28, stagger: 0.08, ease: 'back.out(2)' });
  }

  // Under each seat: what they lost, and who it came from.
  function showResults() {
    TABLE.forEach((p, i) => {
      const hits = hitsOn(i);
      seatEl(i).querySelector('.ev-result').innerHTML = hits.length
        ? `<strong class="bad">-${lost(i)} HP</strong>${hits.map((h) => `${TABLE[h.from].name} ${h.amount}`).join(', ')}`
        : '<strong class="good">No damage</strong>';
    });
  }

  // Plays one player's hits: everyone their card beats gets hit at the same time.
  function attackFrom(i) {
    const targets = TABLE.map((_, j) => ({ card: cardEl(j), amount: dmg(i, j) })).filter((t) => t.amount > 0);
    return targets.length ? PXFx.attack(layer, cardEl(i), TABLE[i].card.el, targets) : Promise.resolve();
  }

  const intro = '<p class="ask ev-ask">It’s not one on one. <strong>Your card fights every other card on the table.</strong></p>';

  // A: from your seat. Your three fights play one at a time, everything else dimmed. Then the whole table.
  const MINE = [1, 2, 3].map((j) => {
    const you = TABLE[0].card;
    const them = TABLE[j];
    const out = dmg(0, j);
    const inn = dmg(j, 0);
    let text;
    if (out) text = `Your fire beats ${them.name}’s ${them.card.el}. <strong>${them.name} loses ${out}.</strong>`;
    else if (inn && them.card.el === you.el) text = `${them.name}’s fire is bigger than yours. <strong>You lose ${inn}.</strong>`;
    else if (inn) text = `${them.name}’s ${them.card.el} beats your fire. <strong>You lose ${inn}.</strong>`;
    else text = `Same card. Nothing happens.`;
    return { j, out, inn, text };
  });
  const yours = {
    key: 'a',
    name: 'A · From your seat',
    note: 'Starts with just you. After the flip, your three fights play one at a time while the rest of the table dims: you hit Reed, Mia hits you, Jo hits you. Then a button plays the whole table, so you see everyone fights everyone.',
    body: () => `${intro}${tableHtml()}<p class="fo-caption" aria-live="polite">&nbsp;</p><div class="buttons center"><button class="action small" id="all" hidden>Watch the whole table</button></div>`,
    async mount(id) {
      const caption = help.querySelector('.fo-caption');
      help.querySelector('#all').addEventListener('click', () => this.whole(run));
      await wait(500);
      await flipAll();
      if (!alive(id)) return;
      await wait(400);
      for (const m of MINE) {
        if (!alive(id)) return;
        help.querySelectorAll('.ev-seat').forEach((s, k) => s.classList.toggle('dim', k !== 0 && k !== m.j));
        caption.innerHTML = `<span class="ev-vs">You vs ${TABLE[m.j].name}</span>${m.text}`;
        await wait(700);
        if (!alive(id)) return;
        if (m.out) await PXFx.attack(layer, cardEl(0), TABLE[0].card.el, [{ card: cardEl(m.j), amount: m.out }]);
        if (m.inn) await PXFx.attack(layer, cardEl(m.j), TABLE[m.j].card.el, [{ card: cardEl(0), amount: m.inn }]);
        await wait(900);
      }
      if (!alive(id)) return;
      help.querySelectorAll('.ev-seat').forEach((s) => s.classList.remove('dim'));
      caption.innerHTML = `<span class="dmg">You lose ${lost(0)}</span><strong>Mia and Jo both beat you, so both hits count.</strong>`;
      help.querySelector('#all').hidden = false;
    },
    // Resets the table and plays every player's hits.
    async whole(id) {
      stopAll();
      id = run;
      help.querySelector('.ev-board').outerHTML = tableHtml();
      help.querySelector('#all').hidden = true;
      const caption = help.querySelector('.fo-caption');
      caption.innerHTML = 'And everyone else’s cards fight too.';
      await flipAll();
      for (let i = 0; i < TABLE.length; i++) {
        if (!alive(id)) return;
        await attackFrom(i);
      }
      if (!alive(id)) return;
      showResults();
      caption.innerHTML = '<strong>Add up everyone who beat you. That’s what you lose.</strong>';
    },
  };

  // B: the whole table, one attacker at a time, with pills to replay each player's hits.
  const turns = {
    key: 'b',
    name: 'B · One player at a time',
    note: 'The whole table flips, then each player’s hits play in turn with a pill lit for whoever is attacking. Damage numbers stack up on each card (Reed’s goes -1, then -3). At the end each seat shows what they lost and from whom.',
    body: () => `${intro}${tableHtml()}
      <div class="fo-pills" role="group" aria-label="Players">${TABLE.map((p, i) => `<button class="fo-pill ev-pill" data-from="${i}">${p.name}</button>`).join('')}</div>
      <p class="fo-caption" aria-live="polite">&nbsp;</p>
      <div class="buttons center"><button class="action quiet small" id="again" hidden>Watch again</button></div>`,
    async mount(id) {
      const caption = help.querySelector('.fo-caption');
      help.querySelector('#again').addEventListener('click', () => render());
      const pills = [...help.querySelectorAll('.ev-pill')];
      await wait(500);
      caption.innerHTML = 'Everyone flips at once...';
      await flipAll();
      for (let i = 0; i < TABLE.length; i++) {
        if (!alive(id)) return;
        pills.forEach((p, k) => p.classList.toggle('on', k === i));
        const hit = TABLE.map((p, j) => ({ j, amount: dmg(i, j) })).filter((h) => h.amount > 0);
        const who = i === 0 ? 'Your' : `${TABLE[i].name}’s`;
        caption.innerHTML = `<span class="ev-vs">${who} ${label(TABLE[i].card).toLowerCase()}</span>${hit.length ? `hits ${hit.map((h) => (h.j === 0 ? 'you' : TABLE[h.j].name)).join(' and ')}.` : 'beats nobody.'}`;
        await wait(500);
        if (!alive(id)) return;
        await attackFrom(i);
        await wait(500);
      }
      if (!alive(id)) return;
      pills.forEach((p) => p.classList.remove('on'));
      showResults();
      caption.innerHTML = '<strong>Add up everyone who beat you. That’s what you lose.</strong>';
      help.querySelector('#again').hidden = false;
    },
  };

  // C: guess first. The cards flip, you guess what you'll lose, then watch to check.
  const guess = {
    key: 'c',
    name: 'C · Guess first',
    note: 'A quick quiz: the cards flip and you guess how much you’ll lose before anything happens. Then your fights play out and it tells you if you were right. Makes you actually look at every card on the table.',
    body: () => `${intro}${tableHtml()}<div class="ask-box" aria-live="polite"></div>`,
    async mount(id) {
      const box = help.querySelector('.ask-box');
      await wait(500);
      await flipAll();
      if (!alive(id)) return;
      seatEl(0).classList.add('ev-me');
      box.innerHTML = `<strong>How much will you lose?</strong><span>Check your fire 4 against each card.</span>
        <div class="ask-buttons">${[0, 1, 2, 3].map((n) => `<button class="action quiet" data-guess="${n}">${n}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-guess]').forEach((b) => b.addEventListener('click', async () => {
        const n = Number(b.dataset.guess);
        box.innerHTML = '';
        for (const m of MINE) {
          if (!alive(id)) return;
          if (m.inn) await PXFx.attack(layer, cardEl(m.j), TABLE[m.j].card.el, [{ card: cardEl(0), amount: m.inn }]);
        }
        if (!alive(id)) return;
        const right = n === lost(0);
        box.innerHTML = `<strong class="${right ? 'good' : 'bad'}">${right ? 'Right!' : `Not quite. You lose ${lost(0)}.`}</strong>
          <span>Mia’s water beats your fire, and Jo’s fire is bigger. Reed can’t touch you: your fire beats earth.</span>
          <div class="ask-buttons"><button class="action small" id="all">Watch the whole table</button></div>`;
        box.querySelector('#all').addEventListener('click', async () => {
          box.innerHTML = '';
          stopAll();
          const id2 = run;
          help.querySelector('.ev-board').outerHTML = tableHtml();
          await flipAll();
          for (let i = 0; i < TABLE.length; i++) {
            if (!alive(id2)) return;
            await attackFrom(i);
          }
          if (!alive(id2)) return;
          showResults();
          box.innerHTML = '<strong>Add up everyone who beat you.</strong><span>That’s what you lose.</span><div class="ask-buttons"><button class="action quiet small" id="again">Try again</button></div>';
          box.querySelector('#again').addEventListener('click', () => render());
        });
      }));
    },
  };

  const DESIGNS = [yours, turns, guess];
  let current = DESIGNS[0];

  function render() {
    stopAll();
    const id = run;
    help.innerHTML = `
      <div class="help-head">
        <span class="dots">${Array.from({ length: 8 }, (_, n) => `<i class="${n === 5 ? 'on' : ''}"></i>`).join('')}</span>
        <button class="tool">Skip</button>
      </div>
      <h2>Everyone at once</h2>
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
