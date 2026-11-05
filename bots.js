// Bot players. They decide only from viewFor(), the same information a person would have.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.PXBots = factory(root.PX);
})(typeof self !== 'undefined' ? self : this, function (PX) {
  const { BEATS, SUBS } = PX;

  function livingRivals(view) {
    return view.players.filter((p) => p.alive && p.index !== view.me);
  }

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  // How likely each rival is to play each element, given what can be seen.
  function predict(view, rival, readCalls = true) {
    const known = view.knowledge && view.knowledge.target === rival.index ? view.knowledge : null;
    const els = PX.elementsFor(view.elementCount);
    const weights = {};
    for (const el of els) weights[el] = 1;

    if (known && known.forcedId) {
      const forced = known.hand.find((c) => c.id === known.forcedId);
      for (const el of els) weights[el] = el === forced.el ? 1 : 0;
      return { weights, power: forced.power };
    }
    if (known) {
      for (const el of els) weights[el] = 0;
      for (const c of known.hand) weights[c.el] += 1;
    } else {
      weights[rival.element] += 0.6;
      if (rival.faceUp) weights[rival.faceUp.el] += 0.5;
    }
    const total = els.reduce((sum, el) => sum + weights[el], 0);
    for (const el of els) weights[el] /= total;

    // A call is evidence both ways: a player who always lies has just ruled that element out.
    if (readCalls && rival.call && (!known || weights[rival.call] > 0)) {
      const trust = (rival.callsKept + 1.2) / (rival.callsMade + 2);
      const others = els.filter((el) => el !== rival.call);
      const otherTotal = others.reduce((sum, el) => sum + weights[el], 0);
      if (otherTotal > 0) {
        for (const el of others) weights[el] = (weights[el] / otherTotal) * (1 - trust);
        weights[rival.call] = trust;
      }
    }
    return { weights, power: 3.5 };
  }

  function chooseCardSmart(view, rng, readCalls = true) {
    const me = view.players[view.me];
    const table = BEATS[view.elementCount];
    const rivals = livingRivals(view).map((r) => ({ r, ...predict(view, r, readCalls) }));
    let best = null;
    let bestScore = -Infinity;

    for (const card of view.hand) {
      let gain = 0;
      let loss = 0;
      let missChance = 1;
      const doubled = me.primed && card.el === 'fire' ? 2 : 1;
      for (const { r, weights } of rivals) {
        const hitChance = table[card.el].reduce((sum, el) => sum + (weights[el] || 0), 0);
        const hurtChance = Object.keys(table)
          .filter((el) => table[el].includes(card.el))
          .reduce((sum, el) => sum + (weights[el] || 0), 0);
        // Damage comes from who you beat, so judge the card on the chance of beating each rival.
        const above = (card.power - 1) / 5;
        const below = (6 - card.power) / 5;
        const sameChance = weights[card.el] || 0;
        const dealt = doubled * (hitChance * (1 + above) + sameChance * above);
        const taken = hurtChance * (1 + below) + sameChance * below;
        gain += 3 * dealt * (r.hp <= 2 ? 1.6 : 1) * (r.shield > 0 ? 0.1 : 1);
        loss += 3 * taken;
        missChance *= 1 - (hitChance + sameChance * above);
      }
      if (me.shield > 0) loss = 0;
      const charge = (card.el === me.element ? 1 + (1 - missChance) : 0) + (card.el === view.myCall ? PX.CONFIG.callBonus : 0);
      const score = gain - 0.8 * loss + 1.2 * charge - 0.1 * card.power + (rng() - 0.5) * 2.4;
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }
    return best.id;
  }

  function chooseAbilitySmart(view, rng) {
    const me = view.players[view.me];
    const sub = SUBS[me.sub];
    if (me.charge < sub.cost) return null;
    const rivals = livingRivals(view);
    if (!rivals.length) return null;
    const weakest = rivals.slice().sort((a, b) => a.hp - b.hp)[0];
    const strongest = rivals.slice().sort((a, b) => b.hp + b.charge - (a.hp + a.charge))[0];

    switch (me.sub) {
      case 'healing':
        return me.hp <= 9 ? {} : null;
      case 'flight':
        return me.hp <= 9 ? {} : null;
      case 'metal':
        return me.hp <= 8 && me.shield === 0 ? {} : null;
      case 'combustion':
        return !me.primed && view.hand.some((c) => c.el === 'fire' && c.power >= 4) ? {} : null;
      case 'lightning':
        return { target: weakest.hp <= 3 ? weakest.index : strongest.index };
      case 'seismic':
        return { target: strongest.index };
      case 'bloodbending':
        return { target: weakest.index, slot: Math.floor(rng() * Math.max(1, weakest.faceDownCount)) };
      case 'vacuum':
        return { target: strongest.index };
      default:
        return null;
    }
  }

  // honesty: how often the bot calls the element it currently means to play.
  // readCalls: whether it uses other players' calls when predicting them.
  function makeSmart({ honesty = 0.6, readCalls = true } = {}) {
    return {
      ability: chooseAbilitySmart,
      call(view, rng) {
        const plannedId = view.forcedId || chooseCardSmart(view, rng, readCalls);
        const planned = view.hand.find((c) => c.id === plannedId);
        if (rng() < honesty) return planned.el;
        return pick(PX.elementsFor(view.elementCount).filter((el) => el !== planned.el), rng);
      },
      card: (view, rng) => chooseCardSmart(view, rng, readCalls),
    };
  }

  const STRATEGIES = {
    smart: makeSmart(),
    random: {
      ability(view, rng) {
        const me = view.players[view.me];
        if (me.charge < SUBS[me.sub].cost || rng() < 0.5) return null;
        const rivals = livingRivals(view);
        if (!rivals.length) return null;
        const target = pick(rivals, rng);
        return { target: target.index, slot: Math.floor(rng() * Math.max(1, target.faceDownCount)) };
      },
      call(view, rng) {
        return pick(PX.elementsFor(view.elementCount), rng);
      },
      card(view, rng) {
        return pick(view.hand, rng).id;
      },
    },
  };

  function chooseVote(view, rng) {
    return pick(PX.elementsFor(view.elementCount), rng);
  }

  return { STRATEGIES, makeSmart, chooseVote, predict };
});
