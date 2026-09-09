import {
  rng,
  shuffled,
  deck,
  legalMoves,
  play,
  scores,
  penalty,
  zoneScore,
  foodScore,
  counts,
  type Game,
  type Observation,
  type Move,
  type Card,
  type Difficulty,
} from './engine.ts';
const best = <T>(a: T[], f: (x: T) => number) =>
  a.reduce((b, x) => (f(x) > f(b) ? x : b), a[0]);
export function heuristic(g: Game | Observation, m: Move) {
  if (m.type !== 'play') return 0;
  const p = g.players[g.active],
    c = p.hand.find((c) => c.id === m.card)!;
  if (g.id === 'undertow') {
    const lead = g.trick[0]?.card.kind ?? c.kind,
      high = Math.max(
        0,
        ...g.trick.filter((t) => t.card.kind === lead).map((t) => t.card.rank),
      );
    const wins = c.kind === lead && c.rank > high,
      pot =
        penalty(c, g.hazard) +
        g.trick.reduce((s, t) => s + penalty(t.card, g.hazard), 0);
    const last = g.trick.length === g.players.length - 1;
    return (
      (wins
        ? -pot * (last ? 1 : 0.7) - c.rank * 0.3
        : penalty(c, g.hazard) + c.rank * 0.4) +
      (m.ward ? (wins ? pot / 2 : 0) - (p.hand.length > 4 ? 5 : 2) : 0)
    );
  }
  if (g.id === 'wildgrove') {
    const z = m.zone!,
      zones = p.zones.map((x) => [...x]);
    zones[z].push(c);
    const delta = zones.reduce(
      (s, _, i) => s + zoneScore(zones, i) - zoneScore(p.zones, i),
      0,
    );
    const n = p.zones[z].filter((x) => x.kind === c.kind).length;
    const remaining = 12 - p.zones.flat().length;
    return (
      delta +
      (remaining > 2
        ? z === 0 && n % 2 === 0
          ? 1.2
          : z === 2 && n === 0
            ? 2
            : 0
        : 0)
    );
  }
  const opponents = g.players
      .filter((_, i) => i !== g.active)
      .map((p) => p.zones[0]),
    old = p.zones[0],
    n = counts(old);
  return (
    foodScore([...old, c], opponents) -
    foodScore(old, opponents) +
    (12 - old.length > 2
      ? c.kind === 0 && n[0] % 2 === 0
        ? 2
        : c.kind === 5
          ? n[5] % 3 === 0
            ? 2.3
            : n[5] % 3 === 1
              ? 3
              : 0
          : c.kind === 1 && n[1] < 4
            ? 1.4
            : 0
      : 0)
  );
}
function passMove(
  g: Game | Observation,
  difficulty: Difficulty,
  r: () => number,
): Move {
  const hand = g.players[g.active].hand;
  if (difficulty === 'easy')
    return {
      type: 'pass',
      cards: shuffled(hand, r)
        .slice(0, 3)
        .map((c) => c.id),
    };
  // High cards are dangerous even before the hazard is known; a short suit can be cleared.
  const suitCounts = Array.from(
    { length: 5 },
    (_, k) => hand.filter((c) => c.kind === k).length,
  );
  return {
    type: 'pass',
    cards: [...hand]
      .sort((a, b) => risk(b) - risk(a))
      .slice(0, 3)
      .map((c) => c.id),
  };
  function risk(c: Card) {
    return (
      c.rank +
      (c.kind === 4 ? c.rank * 0.5 : c.rank === 9 ? 5 : 0) +
      (suitCounts[c.kind] <= 3 ? 4 : 0)
    );
  }
}
export function determinize(o: Observation, r: () => number): Game {
  const knownIds = new Set(
    [...o.seen, ...o.players[o.active].hand].map((c) => c.id),
  );
  const g: Game = {
    ...structuredClone(o),
    rngState: Math.floor(r() * 4294967296),
    reserve: [],
    passes: o.players.map(() => []),
    memory: o.players.map(() => ({})),
  };
  const players = o.players.map((_, i) => i).filter((i) => i !== o.active);
  for (const i of players) {
    const memory =
      o.knownPackets[g.players[i].packet]?.filter((c) => !knownIds.has(c.id)) ??
      [];
    g.players[i].hand = memory.slice(0, o.players[i].hand.length);
    g.players[i].hand.forEach((c) => knownIds.add(c.id));
  }
  const pool = shuffled(
    deck(o.id, o.round).filter((c) => !knownIds.has(c.id)),
    r,
  );
  const slots = players
    .flatMap((i) =>
      Array.from(
        { length: o.players[i].hand.length - g.players[i].hand.length },
        () => i,
      ),
    )
    .sort((a, b) => o.voids[b].length - o.voids[a].length);
  function assign(k: number): boolean {
    if (k === slots.length) return true;
    const p = slots[k];
    for (let j = 0; j < pool.length; j++) {
      const c = pool[j];
      if (o.id === 'undertow' && o.voids[p].includes(c.kind)) continue;
      pool.splice(j, 1);
      g.players[p].hand.push(c);
      if (assign(k + 1)) return true;
      g.players[p].hand.pop();
      pool.splice(j, 0, c);
    }
    return false;
  }
  if (!assign(0)) throw new Error('Public history has no legal hidden deal');
  g.reserve = pool.slice(0, o.reserveCount);
  for (let i = 0; i < o.active && o.phase === 'pass'; i++) {
    const at = g.active;
    g.active = i;
    const m = passMove(g, 'medium', r);
    if (m.type === 'pass') g.passes[i] = m.cards;
    g.active = at;
  }
  return g;
}
export function chooseMove(
  o: Observation,
  difficulty: Difficulty = o.difficulty,
  seed = 9341 + o.revision * 7919,
  iterations = 24,
  budgetMs = 900,
): Move {
  const r = rng(seed);
  if (o.phase === 'pass') return passMove(o, difficulty, r);
  const all = legalMoves(o);
  if (!all.length) throw new Error('No legal moves');
  if (all.length === 1) return all[0];
  if (difficulty === 'easy') return all[Math.floor(r() * all.length)];
  if (difficulty === 'medium') return best(all, (m) => heuristic(o, m));
  const candidates = [...all]
    .sort((a, b) => heuristic(o, b) - heuristic(o, a))
    .slice(0, 12);
  const totals = candidates.map(() => 0);
  const me = o.active,
    start = performance.now();
  let rounds = 0;
  for (let iter = 0; iter < iterations; iter++) {
    const sample = determinize(o, r);
    for (let j = 0; j < candidates.length; j++) {
      let g = play(sample, candidates[j]);
      let steps = 0;
      while (
        g.phase !== 'over' &&
        (o.id !== 'undertow' || g.round === o.round) &&
        steps++ < 150
      ) {
        const m =
          g.phase === 'pass'
            ? passMove(g, 'medium', r)
            : best(legalMoves(g), (m) => heuristic(g, m));
        g = play(g, m);
      }
      const sc = scores(g),
        others = sc.filter((_, i) => i !== me),
        sign = o.id === 'undertow' ? -1 : 1;
      // Mean margin encourages robust scoring; closest rival keeps play competitive.
      totals[j] +=
        sign *
        (sc[me] -
          ((others.reduce((a, b) => a + b, 0) / others.length) * 0.65 +
            (o.id === 'undertow' ? Math.min(...others) : Math.max(...others)) *
              0.35));
    }
    rounds++;
    if (rounds >= 3 && performance.now() - start > budgetMs) break;
  }
  return best(
    candidates,
    (m) => totals[candidates.indexOf(m)] / rounds + heuristic(o, m) * 0.04,
  );
}
