// Card art. Fire, water and earth use the painted cards in art/cards. Each one already shows its number,
// so a small number badge only appears on tiny cards, where the painted one is too small to read (see style.css).
// Any other element falls back to the drawn woodblock-style prints below, which get denser as power rises.
(function (root) {
  const COLORS = {
    fire: { ground: '#7E1D16', mid: '#D9411E', top: '#F6A623', ink: '#FFF3DC' },
    water: { ground: '#0E3F73', mid: '#1C7FC4', top: '#BFE3F2', ink: '#FFF3DC' },
    earth: { ground: '#4A331A', mid: '#A9772A', top: '#E0BC6B', ink: '#FFF3DC' },
    air: { ground: '#CFE3DC', mid: '#6FA39B', top: '#2F6C6A', ink: '#1E2A2C' },
  };

  function flames(power, c) {
    const count = power + 1;
    const width = 100 / count;
    let shapes = '';
    for (let layer = 0; layer < 2; layer++) {
      const height = (50 + power * 13) * (layer ? 0.62 : 1);
      for (let i = 0; i < count; i++) {
        const x = i * width + (layer ? width * 0.35 : 0) - 8;
        const w = width * 1.5;
        const h = height * (0.78 + 0.22 * ((i * 7 + power) % 3) / 2);
        const tip = x + w * (i % 2 ? 0.68 : 0.32);
        shapes += `<path fill="${layer ? c.top : c.mid}" d="M${x} 140 C${x} ${140 - h * 0.45},${tip - 10} ${140 - h * 0.55},${tip} ${140 - h} C${tip + 4} ${140 - h * 0.6},${x + w} ${140 - h * 0.45},${x + w} 140 Z"/>`;
      }
    }
    return shapes;
  }

  function waves(power, c) {
    const rows = power + 1;
    const r = 15;
    const step = r * 0.82;
    let shapes = '';
    for (let row = 0; row < rows; row++) {
      const y = 148 - (rows - 1 - row) * step * 1.35;
      const offset = row % 2 ? r : 0;
      for (let x = -r + offset; x <= 100 + r; x += r * 2) {
        for (const [radius, fill] of [[r, c.top], [r * 0.76, c.mid], [r * 0.5, c.top], [r * 0.26, c.mid]]) {
          shapes += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;
        }
      }
    }
    return shapes;
  }

  function strata(power, c) {
    const layers = power + 1;
    let shapes = '';
    for (let n = 0; n < layers; n++) {
      const base = 140 - ((layers - n) * (14 + power * 1.6));
      const seed = (n + 1) * (power + 3);
      const pts = [[0, 140], [0, base + (seed % 11)]];
      for (let x = 12; x < 100; x += 17) {
        const rise = ((seed * x * 7) % 26) - 12;
        pts.push([x, base + rise]);
      }
      pts.push([100, base + ((seed * 3) % 13)], [100, 140]);
      shapes += `<polygon fill="${n % 2 ? c.top : c.mid}" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
    }
    return shapes;
  }

  function currents(power, c) {
    const positions = [[32, 100], [70, 66], [28, 44], [72, 112], [48, 72], [76, 26]];
    let shapes = '';
    for (let n = 0; n < power; n++) {
      const [x, y] = positions[n];
      const size = 11 + power * 1.3;
      const loop = `M${x - size * 2.2} ${y + size} H${x} a${size} ${size} 0 1 0 ${-size} ${-size} a${size * 0.5} ${size * 0.5} 0 1 1 ${size * 0.5} ${-size * 0.5}`;
      shapes += `<path d="${loop}" fill="none" stroke="${n % 2 ? c.mid : c.top}" stroke-width="${3 + power * 0.5}" stroke-linecap="round"/>`;
    }
    return shapes;
  }

  const PATTERNS = { fire: flames, water: waves, earth: strata, air: currents };

  const PAINTED = ['fire', 'water', 'earth'];
  const DIR = 'art/cards/';

  function cardArt(el, power, showNumber = true) {
    if (PAINTED.includes(el)) {
      return `<img class="card-img" src="${DIR}${el}-${power}.webp" alt="" draggable="false">${showNumber ? `<span class="card-num" aria-hidden="true">${power}</span>` : ''}`;
    }
    return drawnArt(el, power, showNumber);
  }

  function drawnArt(el, power, showNumber) {
    const c = COLORS[el];
    const number = showNumber
      ? `<text x="9" y="31" font-size="30" fill="${c.ink}" stroke="${el === 'air' ? '#CFE3DC' : c.ground}" stroke-width="5" paint-order="stroke" class="card-number">${power}</text>`
      : '';
    return `<svg viewBox="0 0 100 140" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="100" height="140" fill="${c.ground}"/>${PATTERNS[el](power, c)}${number}</svg>`;
  }

  function cardBack() {
    return `<img class="card-img" src="${DIR}back.webp" alt="" draggable="false">`;
  }

  // Load every card up front, so cards never pop in blank when they flip over.
  if (typeof Image !== 'undefined') {
    for (const el of PAINTED) for (let p = 1; p <= 6; p++) new Image().src = `${DIR}${el}-${p}.webp`;
    new Image().src = `${DIR}back.webp`;
  }

  root.PXArt = { cardArt, cardBack, COLORS };
})(typeof self !== 'undefined' ? self : this);
