// Hit effects: each element has its own wind-up, projectile, impact and reaction on the struck card.
//   Fire: a fireball arcs over and bursts into flame and sparks.
//   Water: a whirlpool tightens into an orb, then a high-pressure jet blasts the target and splashes.
//   Earth: a rock rises out of the card, is hurled in a heavy arc and shatters. The table shakes.
// Sub-element abilities have their own effects on the players' seats, and Lightning strikes at the reveal.
// Particles are drawn on a canvas over the page. GSAP drives the cards and the timing.
(function (root) {
  const ELEMENTS = {
    fire: { colors: ['#FFF8E1', '#FFE08A', '#FFB13B', '#FF7A1A', '#E4512B', '#8E1F12'], smoke: '#2B1D1F' },
    water: { colors: ['#FFFFFF', '#DDF3FB', '#9FD6F0', '#4FA9E3', '#2B8FD6', '#175E99'] },
    earth: { colors: ['#E8CF8E', '#C9A05A', '#A9772A', '#7A5420', '#5A3D1C', '#3A2712'], dust: '#9C8463' },
  };

  // Colors for the sub-element abilities.
  const POWERS = {
    lightning: ['#FFFFFF', '#CFE0FF', '#7FA6FF', '#4A66E0'],
    blood: ['#FFB0B0', '#C0182B', '#5E0612'],
    steel: ['#FFFFFF', '#E3E8EE', '#AEB8C4', '#7C8794', '#4B5560'],
    heal: ['#F2FFFB', '#B8F5E4', '#5FD9B8', '#2BA88A'],
    sparks: ['#FFFFFF', '#FFF2C0', '#FFC857'],
  };

  const sprites = new Map();

  // A soft round glow in one color, drawn once and reused for every particle of that color.
  function glow(color) {
    if (sprites.has(color)) return sprites.get(color);
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color + 'CC');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    sprites.set(color, c);
    return c;
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  // An irregular rock outline, as points around a unit circle.
  function rockShape(corners = Math.round(rand(5, 8))) {
    const pts = [];
    for (let i = 0; i < corners; i++) {
      const a = (i / corners) * Math.PI * 2 + rand(-0.25, 0.25);
      const r = rand(0.65, 1);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  // A point on the curve from a to b that bends through c.
  function curve(a, c, b, t) {
    return {
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
    };
  }

  // One full-screen canvas. It must live inside the open <dialog> to draw above it.
  function createLayer(host) {
    const canvas = document.createElement('canvas');
    canvas.className = 'fx-layer';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let running = false;
    let last = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    addEventListener('resize', resize);

    function colorAt(p, t) {
      return p.colors[Math.min(p.colors.length - 1, Math.floor(t * p.colors.length))];
    }

    // A straight jet of water from its tail to its head, widest at the front.
    function drawJet(p) {
      const a = { x: p.from.x + (p.to.x - p.from.x) * p.tail, y: p.from.y + (p.to.y - p.from.y) * p.tail };
      const b = { x: p.from.x + (p.to.x - p.from.x) * p.head, y: p.from.y + (p.to.y - p.from.y) * p.head };
      for (const [scale, color, alpha] of [[2.1, p.colors[4], 0.3], [1.3, p.colors[3], 0.95], [0.8, p.colors[2], 1], [0.32, '#FFFFFF', 1]]) {
        const w = p.width * scale;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(a.x + p.nx * w * 0.2, a.y + p.ny * w * 0.2);
        ctx.lineTo(b.x + p.nx * w * 0.5, b.y + p.ny * w * 0.5);
        ctx.lineTo(b.x - p.nx * w * 0.5, b.y - p.ny * w * 0.5);
        ctx.lineTo(a.x - p.nx * w * 0.2, a.y - p.ny * w * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, w * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // A jagged bolt that re-forks every frame, so it flickers.
    function drawBolt(p) {
      const dx = p.to.x - p.from.x;
      const dy = p.to.y - p.from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const pts = [p.from];
      const n = 9;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const off = rand(-1, 1) * p.jag * Math.sin(Math.PI * t);
        pts.push({ x: p.from.x + dx * t + nx * off, y: p.from.y + dy * t + ny * off });
      }
      pts.push(p.to);
      const base = ctx.globalAlpha;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const [w, color, a] of [[p.width * 3.2, p.colors[2], 0.35], [p.width * 1.4, p.colors[1], 0.9], [p.width * 0.6, '#FFFFFF', 1]]) {
        ctx.globalAlpha = base * a;
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
    }

    // A thin, writhing tendril reaching from one point to another, thinnest at its tip.
    function drawTendril(p, now) {
      const n = 28;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = p.tail + (p.head - p.tail) * (i / n);
        const at = curve(p.from, p.bend, p.to, t);
        const wave = Math.sin(t * 11 + p.phase - now / 70) * p.width * 2.2 * Math.sin(Math.PI * Math.min(1, t * 1.2));
        pts.push({ x: at.x + p.nx * wave, y: at.y + p.ny * wave });
      }
      const base = ctx.globalAlpha;
      ctx.lineCap = 'round';
      for (const [scale, color, a] of [[3, p.colors[2], 0.45], [1.5, p.colors[1], 1], [0.4, p.colors[0], 0.85]]) {
        ctx.globalAlpha = base * a;
        ctx.strokeStyle = color;
        for (let i = 1; i <= n; i++) {
          ctx.lineWidth = Math.max(0.8, p.width * scale * (1 - 0.6 * (i / n)));
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      }
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles = particles.filter((p) => p.fixed || p.delay > 0 || (p.age += dt) < p.life);
      for (const p of particles) {
        if (p.delay > 0) { p.delay -= dt; continue; }
        const t = p.fixed ? 0 : p.age / p.life;
        if (p.orbit && dt > 0) {
          // Spirals inward around a center, faster as it closes in.
          p.spin += p.spinAccel * dt;
          p.angle += p.spin * dt;
          p.radius *= Math.exp(-p.shrink * dt);
          const x = p.cx + Math.cos(p.angle) * p.radius;
          const y = p.cy + Math.sin(p.angle) * p.radius * 0.8;
          p.vx = (x - p.x) / dt;
          p.vy = (y - p.y) / dt;
          p.x = x;
          p.y = y;
        } else if (!p.fixed) {
          p.spin += p.spinAccel * dt;
          const drag = Math.exp(-p.drag * dt);
          p.vx *= drag;
          p.vy = p.vy * drag + p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          if (p.floor && p.y > p.floor && p.vy > 0) {
            p.y = p.floor;
            p.vy *= -0.35;
            p.vx *= 0.6;
            p.spin *= 0.5;
          }
        }
        const size = p.size * (1 + (p.grow || 0) * t);
        ctx.globalCompositeOperation = p.blend;
        ctx.globalAlpha = p.alpha * (p.fade === false ? 1 : 1 - t * t);

        if (p.shape === 'jet') {
          drawJet(p);
        } else if (p.shape === 'bolt') {
          drawBolt(p);
        } else if (p.shape === 'tendril') {
          drawTendril(p, now);
        } else if (p.shape === 'swirl') {
          // Three arcs spinning around one center, like water being drawn into a whirlpool.
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1.5, p.width * (1 - t * 0.5));
          for (let k = 0; k < 3; k++) {
            const start = p.rot + k * 2.094;
            ctx.strokeStyle = p.colors[k % p.colors.length];
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(1, (size / 2) * (1 - k * 0.18)), start, start + 1.9);
            ctx.stroke();
          }
        } else if (p.shape === 'ring' || p.shape === 'ripple') {
          ctx.strokeStyle = p.colors[0];
          ctx.lineWidth = Math.max(1, (p.shape === 'ring' ? 10 : 4) * (1 - t));
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, size / 2, p.shape === 'ripple' ? size * 0.16 : size / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.shape === 'drop') {
          // Stretched along its direction of travel, like a flying droplet.
          const speed = Math.hypot(p.vx, p.vy);
          const length = size * (1 + Math.min(speed / 260, 2.2));
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillStyle = colorAt(p, t);
          ctx.beginPath();
          ctx.ellipse(0, 0, length / 2, size / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha *= 0.7;
          ctx.beginPath();
          ctx.ellipse(length * 0.12, -size * 0.15, length * 0.18, size * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.shape === 'shard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * size, y * size) : ctx.moveTo(x * size, y * size)));
          ctx.closePath();
          ctx.fillStyle = colorAt(p, t);
          ctx.fill();
          ctx.lineWidth = Math.max(1, size * 0.12);
          ctx.strokeStyle = '#2A1B0E';
          ctx.stroke();
          // A lit edge on the top-left facets.
          ctx.beginPath();
          ctx.moveTo(p.pts[p.pts.length - 1][0] * size * 0.8, p.pts[p.pts.length - 1][1] * size * 0.8);
          ctx.lineTo(p.pts[0][0] * size * 0.8, p.pts[0][1] * size * 0.8);
          ctx.strokeStyle = '#F2DCA0';
          ctx.globalAlpha *= 0.6;
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.drawImage(glow(colorAt(p, t)), p.x - size / 2, p.y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (particles.length) requestAnimationFrame(frame);
      else running = false;
    }

    function add(p) {
      const particle = {
        vx: 0, vy: 0, gravity: 0, drag: 0, alpha: 1, age: 0, life: 1, delay: 0, rot: 0, spin: 0, spinAccel: 0, blend: 'lighter', ...p,
      };
      particles.push(particle);
      if (!running) {
        running = true;
        last = performance.now();
        requestAnimationFrame(frame);
      }
      return particle;
    }

    function remove(p) { particles = particles.filter((q) => q !== p); }
    function clear() { particles = []; }

    host.appendChild(canvas);
    return { canvas, add, remove, clear };
  }

  // Shared card reactions.

  function flash(card, filter, glowColor, spread = 28) {
    gsap.fromTo(card, { filter }, { filter: 'brightness(1) saturate(1)', duration: 0.6, ease: 'power2.out', clearProps: 'filter' });
    gsap.fromTo(card, { boxShadow: `0 0 0 3px ${glowColor}, 0 0 ${spread}px ${glowColor}` },
      { boxShadow: '0 0 0 0px rgba(0,0,0,0), 0 0 0px rgba(0,0,0,0)', duration: 0.8, ease: 'power2.out', clearProps: 'boxShadow' });
  }

  // Dark jagged cracks spreading from the middle of a card, then fading.
  function crack(card, amount) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 140');
    svg.setAttribute('class', 'fx-crack');
    const lines = amount >= 2 ? 7 : 5;
    for (let i = 0; i < lines; i++) {
      let x = 50 + rand(-6, 6);
      let y = 66 + rand(-6, 6);
      const angle = (i / lines) * Math.PI * 2 + rand(-0.3, 0.3);
      let d = `M${x} ${y}`;
      const steps = Math.round(rand(3, 5));
      for (let s = 0; s < steps; s++) {
        const reach = rand(9, 16);
        x += Math.cos(angle + rand(-0.6, 0.6)) * reach;
        y += Math.sin(angle + rand(-0.6, 0.6)) * reach;
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      for (const [stroke, width] of [['#F2DCA0', 4], ['#24170B', 2.4]]) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', width);
        path.setAttribute('opacity', stroke === '#F2DCA0' ? 0.35 : 1);
        svg.appendChild(path);
      }
    }
    card.appendChild(svg);
    gsap.timeline({ onComplete: () => svg.remove() })
      .fromTo(svg, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.12, ease: 'power2.out' })
      .to(svg, { opacity: 0, duration: 0.6, ease: 'power1.in' }, '+=0.7');
  }

  // Each element: wind-up on the attacker, the flight to each target, the impact, and how the struck card reacts.
  const STYLES = {
    fire: {
      launchAt: 0.14,
      windup(layer, card, at) {
        gsap.timeline()
          .to(card, { y: -12, scale: 1.08, duration: 0.18, ease: 'power2.out' })
          .to(card, { y: 0, scale: 1, duration: 0.3, ease: 'power2.inOut' }, 0.24);
        const c = ELEMENTS.fire.colors;
        for (let i = 0; i < 14; i++) {
          layer.add({
            x: at.x + rand(-at.w / 2, at.w / 2), y: at.y + rand(-at.h / 4, at.h / 2),
            vx: rand(-30, 30), vy: rand(-220, -90), drag: 1.5, size: rand(8, 16), life: rand(0.35, 0.6), colors: c.slice(1),
          });
        }
      },
      launch(layer, tl, from, to, start, onImpact) {
        const c = ELEMENTS.fire.colors;
        const bend = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 50 - Math.hypot(to.x - from.x, to.y - from.y) * 0.18 };
        const outer = layer.add({ x: from.x, y: from.y, fixed: true, size: 84, colors: [c[3]], alpha: 0.85 });
        const core = layer.add({ x: from.x, y: from.y, fixed: true, size: 34, colors: [c[0]] });
        const path = { t: 0 };
        tl.to(path, {
          t: 1,
          duration: 0.4,
          ease: 'power1.in',
          onUpdate() {
            const at = curve(from, bend, to, path.t);
            core.x = outer.x = at.x;
            core.y = outer.y = at.y;
            for (let i = 0; i < 3; i++) {
              layer.add({
                x: at.x + rand(-5, 5), y: at.y + rand(-5, 5), vx: rand(-40, 40), vy: rand(-60, 20), drag: 2, gravity: -50,
                size: rand(16, 30), grow: -0.5, life: rand(0.22, 0.42), colors: c.slice(1),
              });
            }
            if (Math.random() < 0.35) {
              layer.add({
                x: at.x, y: at.y, vx: rand(-15, 15), vy: rand(-50, -20), drag: 1, size: rand(14, 22), grow: 1.2,
                life: rand(0.5, 0.8), delay: 0.12, alpha: 0.18, colors: [ELEMENTS.fire.smoke], blend: 'source-over',
              });
            }
          },
          onComplete() {
            layer.remove(core);
            layer.remove(outer);
            onImpact();
          },
        }, start);
      },
      impact(layer, at, amount) {
        const c = ELEMENTS.fire.colors;
        const big = amount >= 2 ? 1.6 : 1;
        layer.add({ x: at.x, y: at.y, size: 150 * big, grow: 0.6, life: 0.2, colors: [c[0], c[1]] });
        layer.add({ x: at.x, y: at.y, size: 40, grow: 5 * big, life: 0.35, shape: 'ring', colors: [c[1]] });
        for (let i = 0; i < 26 * big; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(220, 620) * big;
          layer.add({
            x: at.x, y: at.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 120, drag: 3.2, gravity: 520,
            size: rand(6, 12), life: rand(0.4, 0.8), colors: c,
          });
        }
        for (let i = 0; i < 12 * big; i++) {
          layer.add({
            x: at.x + rand(-at.w / 3, at.w / 3), y: at.y + rand(-at.h / 4, at.h / 4),
            vx: rand(-90, 90), vy: rand(-200, -40), drag: 2.4, gravity: -120,
            size: rand(30, 56), grow: 0.4, life: rand(0.45, 0.85), colors: c.slice(1),
          });
        }
        // Smoke rises once the flash has gone, so it never muddies the hit.
        for (let i = 0; i < 5; i++) {
          layer.add({
            x: at.x + rand(-at.w / 3, at.w / 3), y: at.y - at.h * 0.2 + rand(-10, 10), vx: rand(-25, 25), vy: rand(-80, -40), drag: 0.6,
            size: rand(26, 38), grow: 1.6, life: rand(0.8, 1.2), delay: rand(0.22, 0.38), alpha: 0.18,
            colors: [ELEMENTS.fire.smoke], blend: 'source-over',
          });
        }
      },
      react(card, amount) {
        const push = amount >= 2 ? 14 : 8;
        gsap.fromTo(card, { x: 0 }, { keyframes: { x: [-push, push * 0.8, -push * 0.5, push * 0.25, 0] }, duration: 0.4, ease: 'none' });
        flash(card, 'brightness(2.4) saturate(1.4)', ELEMENTS.fire.colors[3]);
      },
    },

    water: {
      launchAt: 0.5,
      windup(layer, card, at) {
        const c = ELEMENTS.water.colors;
        // The card twists as it pulls the water in, then snaps back as it fires.
        gsap.timeline()
          .to(card, { rotation: -5, scale: 1.06, duration: 0.45, ease: 'power2.in' })
          .to(card, { rotation: 0, scale: 1, duration: 0.3, ease: 'back.out(3)' });
        // A whirlpool of arcs that spins faster as it tightens.
        for (const delay of [0, 0.07, 0.14]) {
          layer.add({
            shape: 'swirl', x: at.x, y: at.y, size: at.h * 1.3, grow: -0.85, life: 0.5 - delay, delay,
            rot: rand(0, 6.28), spin: 9, spinAccel: 45, width: 4, colors: [c[2], c[3], c[1]], alpha: 0.9,
          });
        }
        // Droplets spiralling in toward the middle...
        for (let i = 0; i < 26; i++) {
          const angle = (i / 26) * Math.PI * 2;
          const radius = rand(at.h * 0.5, at.h * 0.8);
          layer.add({
            shape: 'drop', blend: 'source-over', orbit: true, cx: at.x, cy: at.y, angle, radius,
            x: at.x + Math.cos(angle) * radius, y: at.y + Math.sin(angle) * radius * 0.8,
            shrink: rand(3.5, 5), spin: 8, spinAccel: 30, size: rand(4, 7), life: rand(0.42, 0.5), colors: [c[2], c[1], c[0]],
          });
        }
        // ...gather into a bright orb that fires.
        const orb = layer.add({ fixed: true, x: at.x, y: at.y, size: 0, colors: [c[2]] });
        const core = layer.add({ fixed: true, x: at.x, y: at.y, size: 0, colors: ['#FFFFFF'] });
        gsap.to(orb, { size: 76, duration: 0.48, ease: 'power2.in' });
        gsap.to(core, { size: 32, duration: 0.48, ease: 'power2.in' });
        gsap.delayedCall(0.66, () => { layer.remove(orb); layer.remove(core); });
      },
      launch(layer, tl, from, to, start, onImpact) {
        const c = ELEMENTS.water.colors;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const jet = layer.add({
          shape: 'jet', fixed: true, blend: 'source-over', from, to, nx: -dy / len, ny: dx / len, head: 0, tail: 0, width: 18, colors: c,
        });
        // Spray streaking along the jet in the direction it fires.
        const spray = () => {
          for (let i = 0; i < 4; i++) {
            const t = jet.tail + (jet.head - jet.tail) * Math.random();
            const speed = rand(700, 1200);
            const side = rand(-1, 1) * jet.width * 0.6;
            layer.add({
              shape: 'drop', blend: 'source-over', x: from.x + dx * t + (-dy / len) * side, y: from.y + dy * t + (dx / len) * side,
              vx: (dx / len) * speed, vy: (dy / len) * speed, drag: 6, size: rand(3, 5), life: rand(0.12, 0.22), colors: [c[0], c[1]],
            });
          }
        };
        // It reaches the target almost instantly, holds a moment, then the tail catches up.
        tl.to(jet, { head: 1, duration: 0.12, ease: 'power1.in', onUpdate: spray, onComplete: onImpact }, start);
        tl.to(jet, { width: 7, duration: 0.3, ease: 'power1.out', onUpdate: spray }, start + 0.12);
        tl.to(jet, { tail: 1, duration: 0.16, ease: 'power2.in', onComplete: () => layer.remove(jet) }, start + 0.26);
      },
      impact(layer, at, amount) {
        const c = ELEMENTS.water.colors;
        const big = amount >= 2 ? 1.5 : 1;
        const surface = at.y + at.h * 0.1;
        layer.add({ x: at.x, y: at.y, size: 120 * big, grow: 0.5, life: 0.22, colors: [c[1], c[2]], alpha: 0.45 });
        // A crown of droplets thrown upward that rain back down.
        for (let i = 0; i < 34 * big; i++) {
          const angle = -Math.PI / 2 + rand(-1.15, 1.15);
          const speed = rand(260, 560) * big;
          layer.add({
            shape: 'drop', blend: 'source-over', x: at.x + rand(-at.w / 4, at.w / 4), y: surface,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 0.8, gravity: 1300,
            size: rand(4, 9), life: rand(0.6, 1), colors: [c[0], c[2], c[3], c[4]],
          });
        }
        for (let i = 0; i < 3; i++) {
          layer.add({ shape: 'ripple', blend: 'source-over', x: at.x, y: at.y + at.h * 0.42, size: 30, grow: 4 * big, life: 0.7, delay: i * 0.12, colors: [c[1]] });
        }
        for (let i = 0; i < 6; i++) {
          layer.add({
            x: at.x + rand(-at.w / 2, at.w / 2), y: at.y + rand(-at.h / 3, at.h / 3), vx: rand(-50, 50), vy: rand(-40, 10), drag: 1,
            size: rand(40, 70), grow: 0.8, life: rand(0.6, 0.9), alpha: 0.2, colors: [c[1]],
          });
        }
        // Water runs off the bottom of the card afterward.
        for (let i = 0; i < 5 * big; i++) {
          layer.add({
            shape: 'drop', blend: 'source-over', x: at.x + rand(-at.w * 0.4, at.w * 0.4), y: at.y + at.h / 2,
            vx: 0, vy: rand(10, 40), gravity: 700, size: rand(4, 6), life: 0.6, delay: rand(0.25, 0.8), colors: [c[2], c[3]],
          });
        }
      },
      react(card, amount, from, to) {
        // Shoved back along the line of the blast, then springing back.
        const k = amount >= 2 ? 1.5 : 1;
        const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        const ux = (to.x - from.x) / len;
        const uy = (to.y - from.y) / len;
        gsap.fromTo(card, { x: 0, y: 0, skewX: 0 }, {
          keyframes: { x: [ux * 18 * k, ux * -5, ux * 2, 0], y: [uy * 18 * k, uy * -5, uy * 2, 0], skewX: [ux * 7 * k, ux * -4, 1, 0] },
          duration: 0.5, ease: 'none',
        });
        flash(card, 'brightness(1.6) saturate(0.7)', ELEMENTS.water.colors[3], 22);
      },
    },

    earth: {
      launchAt: 0.12,
      windup(layer, card, at) {
        // A stomp: the card drops and kicks up dust.
        gsap.timeline()
          .to(card, { y: 7, scaleY: 0.94, duration: 0.1, ease: 'power3.in', transformOrigin: '50% 100%' })
          .to(card, { y: 0, scaleY: 1, duration: 0.3, ease: 'back.out(3)' });
        for (let i = 0; i < 8; i++) {
          const side = i % 2 ? 1 : -1;
          layer.add({
            blend: 'source-over', x: at.x + side * rand(0, at.w / 2), y: at.y + at.h / 2,
            vx: side * rand(60, 160), vy: rand(-40, -10), drag: 2.5, size: rand(22, 34), grow: 1, life: rand(0.5, 0.8),
            alpha: 0.5, colors: [ELEMENTS.earth.dust],
          });
        }
      },
      launch(layer, tl, from, to, start, onImpact) {
        const c = ELEMENTS.earth.colors;
        const lift = 90 + Math.hypot(to.x - from.x, to.y - from.y) * 0.3;
        const rise = { x: from.x, y: from.y - from.h * 0.55 };
        const bend = { x: (rise.x + to.x) / 2, y: Math.min(rise.y, to.y) - lift };
        const rock = layer.add({
          shape: 'shard', fixed: true, blend: 'source-over', x: from.x, y: from.y + from.h * 0.3,
          size: 26, pts: rockShape(7), colors: [c[2]], alpha: 0,
        });
        // The rock rises out of the attacker's card...
        tl.to(rock, { y: rise.y, alpha: 1, rot: -0.6, duration: 0.2, ease: 'power2.out' }, start);
        // ...then is hurled in a high, heavy arc.
        const path = { t: 0 };
        tl.to(path, {
          t: 1,
          duration: 0.46,
          ease: 'power2.in',
          onUpdate() {
            const at = curve(rise, bend, to, path.t);
            rock.x = at.x;
            rock.y = at.y;
            rock.rot = -0.6 + path.t * 7;
            if (Math.random() < 0.5) {
              layer.add({
                blend: 'source-over', x: at.x + rand(-6, 6), y: at.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-20, 10), drag: 1.5,
                size: rand(14, 22), grow: 1.2, life: rand(0.4, 0.6), alpha: 0.35, colors: [ELEMENTS.earth.dust],
              });
            }
            if (Math.random() < 0.15) {
              layer.add({
                shape: 'shard', blend: 'source-over', x: at.x, y: at.y, vx: rand(-40, 40), vy: rand(-20, 40), gravity: 1200,
                spin: rand(-8, 8), size: rand(3, 5), pts: rockShape(5), life: 0.6, colors: [c[3]],
              });
            }
          },
          onComplete() {
            layer.remove(rock);
            onImpact();
          },
        }, start + 0.22);
      },
      impact(layer, at, amount) {
        const c = ELEMENTS.earth.colors;
        const big = amount >= 2 ? 1.5 : 1;
        const floor = at.y + at.h / 2 + 6;
        // The rock bursts into chunks that bounce on the table.
        for (let i = 0; i < 14 * big; i++) {
          const angle = -Math.PI / 2 + rand(-1.4, 1.4);
          const speed = rand(180, 480) * big;
          layer.add({
            shape: 'shard', blend: 'source-over', x: at.x + rand(-8, 8), y: at.y + rand(-8, 8),
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 0.6, gravity: 1500, floor,
            spin: rand(-12, 12), size: rand(5, 13) * (i < 3 ? 1.5 : 1), pts: rockShape(), life: rand(0.8, 1.15),
            colors: [c[1], c[2], c[3]], fade: true,
          });
        }
        // Dust rolls out low along the table.
        for (let i = 0; i < 12 * big; i++) {
          const side = i % 2 ? 1 : -1;
          layer.add({
            blend: 'source-over', x: at.x + rand(-at.w / 3, at.w / 3), y: at.y + rand(0, at.h / 2),
            vx: side * rand(80, 260) * big, vy: rand(-90, -10), drag: 2.2, size: rand(30, 50), grow: 1.3,
            life: rand(0.7, 1.1), alpha: 0.5, colors: [ELEMENTS.earth.dust],
          });
        }
        layer.add({ blend: 'source-over', x: at.x, y: at.y, size: 110 * big, grow: 0.5, life: 0.3, colors: [ELEMENTS.earth.dust], alpha: 0.55 });
      },
      react(card, amount) {
        const k = amount >= 2 ? 1.5 : 1;
        gsap.fromTo(card, { y: 0, scaleY: 1 }, {
          keyframes: { y: [10 * k, -3, 1, 0], scaleY: [0.9, 1.03, 1, 1] },
          duration: 0.45, ease: 'none', transformOrigin: '50% 100%',
        });
        flash(card, 'brightness(0.6) sepia(0.6)', ELEMENTS.earth.colors[3], 18);
        crack(card, amount);
        // The whole table takes the hit.
        const table = card.closest('[data-fx-shake]');
        if (table) {
          gsap.fromTo(table, { x: 0, y: 0 }, {
            keyframes: { x: [-4 * k, 4 * k, -2 * k, 1, 0], y: [3 * k, -2 * k, 1, 0, 0] }, duration: 0.35, ease: 'none', clearProps: 'transform',
          });
        }
      },
    },
  };

  // Sub-element abilities

  // A short word that pops up over a seat, like "Bloodbent" or "+2 HP".
  const stacked = new WeakMap();
  function popLabel(host, el, text, color) {
    const r = el.getBoundingClientRect();
    const level = stacked.get(el) || 0;
    stacked.set(el, level + 1);
    const label = document.createElement('span');
    label.className = 'fx-label';
    label.textContent = text;
    label.style.color = color;
    label.style.left = `${r.left + r.width / 2}px`;
    label.style.top = `${r.top + r.height * 0.35 - level * 30}px`;
    host.appendChild(label);
    gsap.set(label, { xPercent: -50, yPercent: -50 });
    gsap.timeline({ onComplete: () => { label.remove(); stacked.set(el, Math.max(0, (stacked.get(el) || 1) - 1)); } })
      .fromTo(label, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3)' })
      .to(label, { y: -26, opacity: 0, duration: 0.45, ease: 'power1.in' }, '+=0.75');
  }

  // Metal on metal: a steel ring and a spray of hot sparks.
  function clang(layer, at) {
    layer.add({ x: at.x, y: at.y, size: 36, grow: 3, life: 0.3, shape: 'ring', colors: [POWERS.steel[1]] });
    layer.add({ x: at.x, y: at.y, size: 90, grow: 0.3, life: 0.14, colors: [POWERS.steel[0]] });
    for (let i = 0; i < 18; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(250, 520);
      layer.add({
        x: at.x, y: at.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80, drag: 2.5, gravity: 900,
        size: rand(4, 7), life: rand(0.3, 0.55), colors: POWERS.sparks,
      });
    }
  }

  // A point on the edge of an element's box, and the direction pointing out from it.
  function edgePoint(at, angle) {
    const cx = Math.cos(angle);
    const cy = Math.sin(angle);
    const scale = Math.min(Math.abs((at.w / 2) / (cx || 1e-6)), Math.abs((at.h / 2) / (cy || 1e-6)));
    return { x: at.x + cx * scale, y: at.y + cy * scale, ox: cx, oy: cy };
  }

  // A point a fraction of the way around a box's edge, and the direction pointing out from it.
  function perimeterPoint(at, f) {
    const w = at.w;
    const h = at.h;
    let d = (((f % 1) + 1) % 1) * 2 * (w + h);
    const left = at.x - w / 2;
    const top = at.y - h / 2;
    if (d < w) return { x: left + d, y: top, ox: 0, oy: -1 };
    d -= w;
    if (d < h) return { x: left + w, y: top + d, ox: 1, oy: 0 };
    d -= h;
    if (d < w) return { x: left + w - d, y: top + h, ox: 0, oy: 1 };
    d -= w;
    return { x: left, y: top + h - d, ox: -1, oy: 0 };
  }

  const ABILITY_FX = {
    // The seat bursts into flame. It keeps glowing until the boosted fire card is played.
    combustion(layer, host, user) {
      const u = center(user);
      const c = ELEMENTS.fire.colors;
      flash(user, 'brightness(1.5) saturate(1.3)', c[3], 30);
      for (let i = 0; i < 28; i++) {
        layer.add({
          x: u.x + rand(-u.w / 2, u.w / 2), y: u.y + u.h / 2 - 4, vx: rand(-30, 30), vy: rand(-320, -150), drag: 1.8, gravity: -60,
          size: rand(26, 50), grow: 0.3, life: rand(0.5, 0.9), colors: c.slice(1),
        });
      }
      for (let i = 0; i < 18; i++) {
        layer.add({
          x: u.x + rand(-u.w / 2, u.w / 2), y: u.y + rand(-u.h / 4, u.h / 2), vx: rand(-60, 60), vy: rand(-420, -200), drag: 1.5, gravity: 300,
          size: rand(4, 8), life: rand(0.5, 0.9), colors: c,
        });
      }
      popLabel(host, user, 'Combustion', c[2]);
      return 1.1;
    },

    // Sparks crackle across the user's seat, then one arcs onto the target to mark them.
    lightning(layer, host, user, target) {
      const u = center(user);
      const inside = (at) => ({ x: at.x + rand(-at.w / 2.4, at.w / 2.4), y: at.y + rand(-at.h / 2.6, at.h / 2.6) });
      flash(user, 'brightness(1.6) saturate(0.6)', POWERS.lightning[2], 26);
      for (let k = 0; k < 5; k++) {
        layer.add({ shape: 'bolt', from: inside(u), to: inside(u), jag: 10, width: 2, life: 0.16, delay: k * 0.11, colors: POWERS.lightning });
      }
      if (target) {
        const t = center(target);
        gsap.delayedCall(0.55, () => {
          for (let k = 0; k < 3; k++) {
            layer.add({ shape: 'bolt', from: inside(t), to: inside(t), jag: 8, width: 1.6, life: 0.14, delay: k * 0.1, colors: POWERS.lightning });
          }
          flash(target, 'brightness(1.4) saturate(0.6)', POWERS.lightning[2], 18);
          popLabel(host, target, 'Targeted', POWERS.lightning[1]);
        });
      }
      popLabel(host, user, 'Lightning', POWERS.lightning[1]);
      return 1.2;
    },

    // A stomp, then shockwaves roll across the table to the player being read.
    seismic(layer, host, user, target) {
      const u = center(user);
      const c = ELEMENTS.earth.colors;
      gsap.timeline()
        .to(user, { y: 5, duration: 0.08, ease: 'power3.in' })
        .to(user, { y: 0, duration: 0.3, ease: 'back.out(3)' });
      for (let i = 0; i < 8; i++) {
        layer.add({
          blend: 'source-over', x: u.x + rand(-u.w / 2, u.w / 2), y: u.y + u.h / 2, vx: rand(-120, 120), vy: rand(-50, -10),
          drag: 2.5, size: rand(20, 32), grow: 1, life: rand(0.5, 0.8), alpha: 0.5, colors: [ELEMENTS.earth.dust],
        });
      }
      if (target) {
        const t = center(target);
        for (let k = 0; k <= 6; k++) {
          const f = k / 6;
          const x = u.x + (t.x - u.x) * f;
          const y = u.y + (t.y - u.y) * f;
          layer.add({ shape: 'ripple', x, y, size: 44, grow: 3, life: 0.5, delay: 0.12 + k * 0.07, colors: [c[0]] });
          layer.add({
            blend: 'source-over', x, y, vx: rand(-60, 60), vy: rand(-40, -10), drag: 2, size: rand(24, 36), grow: 1,
            life: 0.6, delay: 0.12 + k * 0.07, alpha: 0.4, colors: [ELEMENTS.earth.dust],
          });
          layer.add({
            shape: 'shard', blend: 'source-over', x, y, vx: rand(-40, 40), vy: rand(-220, -120), gravity: 1200, spin: rand(-10, 10),
            size: rand(3, 6), pts: rockShape(5), life: 0.5, delay: 0.12 + k * 0.07, colors: [c[2]],
          });
        }
        gsap.delayedCall(0.6, () => {
          flash(target, 'brightness(1.2) sepia(0.5)', c[1], 20);
          gsap.fromTo(target, { y: 0 }, { keyframes: { y: [-4, 2, 0] }, duration: 0.25, ease: 'none' });
          popLabel(host, target, 'Sensed', c[0]);
        });
      }
      popLabel(host, user, 'Seismic Sense', c[0]);
      return 1.2;
    },

    // Steel plates slam in from every side and lock around the seat with a clang.
    metal(layer, host, user) {
      const u = center(user);
      const pieces = Math.round(Math.min(32, Math.max(16, (u.w + u.h) / 22)));
      for (let i = 0; i < pieces; i++) {
        const e = perimeterPoint(u, i / pieces);
        layer.add({
          shape: 'shard', blend: 'source-over', x: e.x + e.ox * 70, y: e.y + e.oy * 70, vx: -e.ox * 260, vy: -e.oy * 260,
          drag: 3.5, rot: rand(0, 6), spin: rand(-6, 6), size: rand(7, 12), pts: rockShape(4), life: 0.32, fade: false, colors: POWERS.steel.slice(1),
        });
      }
      gsap.delayedCall(0.28, () => {
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) clang(layer, { x: u.x + (sx * u.w) / 2, y: u.y + (sy * u.h) / 2 });
        flash(user, 'brightness(1.8) saturate(0)', POWERS.steel[2], 24);
        gsap.fromTo(user, { scale: 1.03 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
      });
      popLabel(host, user, 'Metalbending', POWERS.steel[1]);
      return 1.0;
    },

    // Glowing water rises and circles the seat.
    healing(layer, host, user) {
      const u = center(user);
      flash(user, 'brightness(1.35)', POWERS.heal[2], 28);
      layer.add({ shape: 'swirl', x: u.x, y: u.y, size: u.h * 1.6, grow: -0.3, life: 0.9, spin: 6, width: 4, colors: POWERS.heal.slice(1) });
      for (let i = 0; i < 26; i++) {
        layer.add({
          x: u.x + rand(-u.w / 2, u.w / 2), y: u.y + u.h / 2 - rand(0, 10), vx: rand(-15, 15), vy: rand(-220, -110), drag: 1,
          size: rand(10, 22), life: rand(0.6, 1), colors: POWERS.heal,
        });
      }
      popLabel(host, user, `+2 HP`, POWERS.heal[1]);
      return 1.1;
    },

    // Red tendrils reach across and take hold of the target.
    bloodbending(layer, host, user, target) {
      popLabel(host, user, 'Bloodbending', POWERS.blood[0]);
      if (!target) return 0.8;
      const u = center(user);
      const t = center(target);
      const dx = t.x - u.x;
      const dy = t.y - u.y;
      const len = Math.hypot(dx, dy) || 1;
      for (let k = 0; k < 3; k++) {
        const tendril = layer.add({
          shape: 'tendril', fixed: true, blend: 'source-over', from: { x: u.x + (k - 1) * 18, y: u.y }, to: { x: t.x + (k - 1) * 22, y: t.y },
          bend: { x: (u.x + t.x) / 2 + (k - 1) * 30, y: (u.y + t.y) / 2 - 40 + (k - 1) * 35 }, nx: -dy / len, ny: dx / len,
          head: 0, tail: 0, width: 6, phase: k * 2.1, colors: POWERS.blood,
        });
        gsap.timeline({ onComplete: () => layer.remove(tendril) })
          .to(tendril, { head: 1, duration: 0.5, ease: 'power2.out', delay: k * 0.06 })
          .to(tendril, { tail: 1, duration: 0.35, ease: 'power2.in' }, '+=0.45');
      }
      gsap.delayedCall(0.5, () => {
        // A dark red aura closes in around the target as the grip takes hold.
        for (let i = 0; i < 16; i++) {
          const e = edgePoint(t, (i / 16) * Math.PI * 2);
          layer.add({
            blend: 'source-over', x: e.x + e.ox * 40, y: e.y + e.oy * 40, vx: -e.ox * 120, vy: -e.oy * 120, drag: 3,
            size: rand(26, 40), life: rand(0.5, 0.8), alpha: 0.5, colors: [POWERS.blood[1], POWERS.blood[2]],
          });
        }
        flash(target, 'brightness(0.8) saturate(1.8)', POWERS.blood[1], 26);
        gsap.fromTo(target, { x: 0 }, { keyframes: { x: [-3, 3, -2, 2, -1, 0] }, duration: 0.5, ease: 'none' });
        popLabel(host, target, 'Bloodbent', POWERS.blood[0]);
      });
      return 1.4;
    },
  };

  // Plays one ability on the table. user and target are the players' seats.
  function ability(layer, host, sub, user, target) {
    const play = ABILITY_FX[sub];
    if (!play) return Promise.resolve();
    const seconds = play(layer, host, user, target || null);
    return new Promise((resolve) => gsap.delayedCall(seconds, resolve));
  }

  // Lightning at the reveal: bolts crash down from above onto the target's card.
  function strike(layer, card, amount, isBlocked) {
    return new Promise((resolve) => {
      const to = center(card);
      const from = () => ({ x: to.x + rand(-60, 60), y: Math.max(0, to.y - 420) });
      const tl = gsap.timeline({ onComplete: resolve });
      [0, 0.09, 0.2].forEach((at, k) => {
        tl.add(() => layer.add({ shape: 'bolt', from: from(), to: { x: to.x + rand(-6, 6), y: to.y }, jag: 34, width: k === 1 ? 5 : 3.5, life: 0.18, colors: POWERS.lightning }), at);
      });
      tl.add(() => {
        layer.add({ x: to.x, y: to.y, size: 280, grow: 0.3, life: 0.22, colors: [POWERS.lightning[0], POWERS.lightning[1]] });
        layer.add({ x: to.x, y: to.y, size: 40, grow: 4, life: 0.3, shape: 'ring', colors: [POWERS.lightning[1]] });
        for (let i = 0; i < 22; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(200, 520);
          layer.add({
            x: to.x, y: to.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 3, gravity: 500,
            size: rand(4, 8), life: rand(0.3, 0.6), colors: POWERS.lightning,
          });
        }
        if (isBlocked) {
          blocked(layer, card, 'fire', to);
        } else {
          gsap.fromTo(card, { x: 0 }, { keyframes: { x: [-12, 10, -6, 3, 0] }, duration: 0.4, ease: 'none' });
          flash(card, 'brightness(2.6) saturate(0)', POWERS.lightning[2], 34);
          damageNumber(card, amount);
        }
      }, 0.06);
      tl.to({}, { duration: 0.6 });
    });
  }

  // The card's damage so far pops up over it. Each new hit adds to it, so "-1" becomes "-2".
  function damageNumber(card, amount) {
    const holder = card.parentElement;
    let label = holder.querySelector('.fx-dmg');
    if (!label) {
      label = document.createElement('span');
      label.className = 'fx-dmg';
      label.dataset.total = '0';
      holder.appendChild(label);
      gsap.set(label, { xPercent: -50 });
    }
    const total = Number(label.dataset.total) + amount;
    label.dataset.total = String(total);
    label.textContent = `-${total}`;
    gsap.fromTo(label, { scale: 0.2, y: 0, opacity: 1 }, { scale: amount >= 2 ? 1.5 : 1.2, y: -24, duration: 0.4, ease: 'back.out(3)', overwrite: true });
  }

  // A shielded card: a small burst, a steel flash, and "Blocked" instead of a number.
  function blocked(layer, card, kind, to) {
    clang(layer, to);
    flash(card, 'brightness(1.5) saturate(0)', POWERS.steel[2], 22);
    gsap.fromTo(card, { x: 0 }, { keyframes: { x: [-4, 3, -1, 0] }, duration: 0.25, ease: 'none' });
    const holder = card.parentElement;
    if (holder.querySelector('.fx-dmg')) return;
    const label = document.createElement('span');
    label.className = 'fx-dmg fx-blocked';
    label.textContent = 'Blocked';
    holder.appendChild(label);
    gsap.set(label, { xPercent: -50 });
    gsap.fromTo(label, { scale: 0.2, y: 0 }, { scale: 1, y: -24, duration: 0.4, ease: 'back.out(3)' });
  }

  // One attacker hits one or more cards at once. Resolves when the last impact has settled.
  // Each target is { card, amount, blocked?, onHit? }.
  function attack(layer, fromCard, kind, targets) {
    const style = STYLES[kind];
    return new Promise((resolve) => {
      const from = center(fromCard);
      const tl = gsap.timeline({ onComplete: resolve });
      tl.add(() => style.windup(layer, fromCard, from), 0);
      for (const target of targets) {
        const to = center(target.card);
        style.launch(layer, tl, from, to, style.launchAt, () => {
          if (target.blocked) {
            blocked(layer, target.card, kind, to);
          } else {
            style.impact(layer, to, target.amount);
            style.react(target.card, target.amount, from, to);
            damageNumber(target.card, target.amount);
          }
          if (target.onHit) target.onHit();
        });
      }
      tl.to({}, { duration: 0.6 });
    });
  }

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.PXFx = { createLayer, attack, ability, strike, reducedMotion, ELEMENTS };
})(typeof self !== 'undefined' ? self : this);
