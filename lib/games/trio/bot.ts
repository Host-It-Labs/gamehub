import {
  rng,
  migratedZones,
  passCount,
  shuffled,
  legalMoves,
  play,
  scores,
  penalty,
  tidePenaltyRank,
  tidePenaltyValue,
  tideRanks,
  tideDeck,
  zoneScore,
  lowTide,
  sanctuaryBonus,
  foodScore,
  festivalBreakdown,
  orderProgress,
  counts,
  habitats,
  type Game,
  type Observation,
  type Move,
  type Card,
  type Difficulty,
} from './engine.ts';
const best = <T>(a: T[], f: (x: T) => number) => {
  let winner = a[0];
  let value = f(winner);
  for (let i = 1; i < a.length; i++) {
    const next = f(a[i]);
    if (next > value) {
      winner = a[i];
      value = next;
    }
  }
  return winner;
};
export function heuristic(g: Game | Observation, m: Move, lookahead = 3) {
  if (m.type === 'salvage') {
    if (!m.claim) return 0;
    const hand = g.players[g.active].hand;
    const strengths = Array.from({ length: 5 }, (_, kind) => {
      const ranks = hand.filter((c) => c.kind === kind).map((c) => c.rank);
      if (!ranks.length) return 0;
      const edge = lowTide(g)
        ? (tideRanks(g) + 1 - Math.min(...ranks)) / tideRanks(g)
        : Math.max(...ranks) / tideRanks(g);
      return edge ** Math.max(1, g.players.length - 1);
    });
    const chance = strengths.reduce((a, b) => a + b, 0) / 5;
    return 9 * chance - 3 - (hand.length > 4 ? 0.7 : 0.15);
  }
  if (m.type !== 'play') return 0;
  const p = g.players[g.active],
    c = p.hand.find((c) => c.id === m.card)!;
  if (g.id === 'undertow') {
    const lead = g.trick[0]?.card.kind ?? c.kind,
      high = Math.max(
        0,
        ...g.trick.filter((t) => t.card.kind === lead).map((t) => t.card.rank),
      );
    const wins =
        c.kind === lead &&
        (lowTide(g)
          ? c.rank <
            Math.min(
              ...g.trick
                .filter((t) => t.card.kind === lead)
                .map((t) => t.card.rank),
            )
          : c.rank > high),
      pot =
        penalty(c, g.hazard, tidePenaltyRank(g), tidePenaltyValue(g)) +
        g.trick.reduce(
          (s, t) =>
            s +
            penalty(t.card, g.hazard, tidePenaltyRank(g), tidePenaltyValue(g)),
          0,
        );
    const last = g.trick.length === g.players.length - 1;
    const strength = lowTide(g) ? tideRanks(g) + 1 - c.rank : c.rank;
    const captureChance = wins
      ? last
        ? 1
        : (strength / tideRanks(g)) ** (g.players.length - g.trick.length - 1)
      : 0;
    const myClaim = (g.salvageClaimants ?? []).includes(g.active);
    // Revealed claims are public: deny a rival's −6 reward / +3 failure swing
    // when taking the ordinary penalties is cheaper. Never inspect hidden hands.
    const rivalsClaiming = (g.salvageClaimants ?? []).filter(
      (seat) => seat !== g.active,
    ).length;
    const salvageValue =
      captureChance *
      9 *
      (myClaim ? 1 : rivalsClaiming ? 1 / (g.players.length - 1) : 0);
    return (
      (wins
        ? -pot * (last ? 1 : 0.7) - strength * 0.3
        : penalty(c, g.hazard, tidePenaltyRank(g), tidePenaltyValue(g)) +
          strength * 0.4) +
      (m.ward ? (wins ? pot / 2 : 0) - (p.hand.length > 4 ? 5 : 2) : 0) +
      salvageValue
    );
  }
  if (g.id === 'wildgrove') {
    const z = m.zone!;
    if (z === 5) return 0;
    const zones = m.migration
      ? migratedZones(p.zones, m.migration)
      : p.zones.map((area) => [...area]);
    (zones[z] ??= []).push(c);
    const remaining = Math.max(0, (3 - g.round) * 6 - g.pick);
    const value = (areas: Card[][]) =>
      areas.reduce(
        (sum, _, zone) => sum + zoneScore(areas, zone, g.contentSet),
        0,
      ) +
      (g.sanctuaryGoalsEnabled
        ? sanctuaryBonus(areas, g.sanctuaryGoals, g.contentSet)
        : 0);
    const current = value(zones);
    let potential = 0;
    // A short completion search values unfinished pairs, herds, and trails
    // using the actual scoring rules, without looking at hidden hands. Charge
    // three points per future pick so speculative completions are not free.
    const depth = Math.max(
      0,
      Math.min(lookahead, remaining, habitats[z].cap - zones[z].length),
    );
    const extend = (steps: number, firstKind: number) => {
      if (steps > 0)
        potential = Math.max(potential, value(zones) - current - 3 * steps);
      if (steps === depth) return;
      for (let kind = firstKind; kind < 6; kind++) {
        zones[z].push({ id: -1, rank: 0, kind });
        extend(steps + 1, z === 3 ? 0 : kind);
        zones[z].pop();
      }
    };
    extend(0, 0);
    return (
      current -
      value(p.zones) +
      potential * 0.65 -
      (m.migration && remaining > 3 ? 1.5 : 0) -
      (m.roam ? (remaining > 3 ? 1.5 : 0.3) : 0)
    );
  }

  const opponents = g.players
      .filter((_, i) => i !== g.active)
      .map((p) => p.zones[0]),
    old = p.zones[0],
    n = counts(old);
  let festivalValue = 0;
  if ((g.customerOrders || g.specialtyStalls) && p.festival) {
    const after = structuredClone(p);
    after.zones[0].push(c);
    if (m.order !== undefined) after.festival!.orders.push(m.order);
    if (m.stall)
      after.festival!.stalls.push({
        kind: c.kind,
        from: after.zones[0].length,
      });
    festivalValue = festivalBreakdown(after).total - festivalBreakdown(p).total;
    const order = after.festival!.orders[g.round - 1];
    const beforeProgress = orderProgress(old.slice((g.round - 1) * 6), order);
    const afterProgress = orderProgress(
      after.zones[0].slice((g.round - 1) * 6),
      order,
    );
    // Value useful progress, but do not double-count the completion reward.
    if (afterProgress < 3)
      festivalValue += (afterProgress - beforeProgress) * 1.8;
    if (m.stall) {
      const future = 12 - after.zones[0].length;
      const inHand = p.hand.filter(
        (card) => card.id !== c.id && card.kind === c.kind,
      ).length;
      festivalValue += Math.min(4, future * 0.25 + inHand * 0.7) - 1;
    }
  }
  return (
    (g.marketSeasons &&
    c.kind === g.seasonForecast?.[(g.round - 1) * 6 + g.pick - 1]
      ? 2
      : 0) +
    festivalValue +
    foodScore([...old, c], opponents, g.contentSet) -
    foodScore(old, opponents, g.contentSet) +
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
        .slice(0, passCount(g))
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
      .slice(0, passCount(g))
      .map((c) => c.id),
  };
  function risk(c: Card) {
    return (
      c.rank +
      (c.kind === 4
        ? c.rank * 0.5
        : c.rank === tidePenaltyRank(g)
          ? tidePenaltyValue(g)
          : 0) +
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
  if (o.phase === 'salvage') {
    g.ready = o.players.map((p, i) => i === o.trickLeader || !p.salvageClaims);
    g.pending = o.players.map(() => null);
  }
  // Model unrevealed simultaneous choices without reading opponents’ submissions.
  if (o.phase === 'pass' || (o.phase === 'play' && o.id !== 'undertow')) {
    g.ready = o.players.map(() => false);
    delete g.pending;
  }
  const players = o.players.map((_, i) => i).filter((i) => i !== o.active);
  for (const i of players) {
    const memory =
      o.knownPackets[g.players[i].packet]?.filter((c) => !knownIds.has(c.id)) ??
      [];
    g.players[i].hand = memory.slice(0, o.players[i].hand.length);
    g.players[i].hand.forEach((c) => knownIds.add(c.id));
  }
  const pool = shuffled(
    tideDeck(o).filter((c) => !knownIds.has(c.id)),
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
/** Rollouts play plain placements: migrations and roams multiply the legal
 *  moves several times over and are only worth weighing for the real choice. */
/** Rollouts value moves with a one-step completion search: cheap enough
 *  that many more determinizations fit the budget, which beat a deeper
 *  search with a single sample in hard-versus-medium trials. */
const ROLLOUT_LOOKAHEAD = 1;
function rolloutMoves(g: Game): Move[] {
  const all = legalMoves(g);
  if (g.id !== 'wildgrove') return all;
  const plain = all.filter(
    (m) => m.type !== 'play' || (!m.migration && !m.roam),
  );
  return plain.length ? plain : all;
}
export function chooseMove(
  o: Observation,
  difficulty: Difficulty = o.difficulty,
  seed = 9341 + o.revision * 7919,
  iterations = 24,
  budgetMs = o.id === 'wildgrove' ? 600 : 900,
): Move {
  const r = rng(seed);
  if (o.phase === 'pass') return passMove(o, difficulty, r);
  const all = legalMoves(o);
  if (!all.length) throw new Error('No legal moves');
  if (all.length === 1) return all[0];
  if (difficulty === 'easy') return all[Math.floor(r() * all.length)];
  if (difficulty === 'medium') {
    if (o.id !== 'wildgrove') return best(all, (m) => heuristic(o, m));
    // Seeded tie-breaking avoids always preferring the first habitat when
    // several plans have effectively equal value.
    return best(
      all.map((move) => ({ move, value: heuristic(o, move) + r() * 0.1 })),
      (candidate) => candidate.value,
    ).move;
  }
  const ranked = all.map((move) => ({ move, value: heuristic(o, move) }));
  const distinct = new Set<string>();
  const candidates = ranked
    .sort((a, b) => b.value - a.value)
    .filter(({ move }) => {
      if (o.id !== 'wildgrove' || move.type !== 'play') return true;
      const key = `${o.players[o.active].hand.find((card) => card.id === move.card)?.kind}:${move.zone}:${!!move.roam}:${JSON.stringify(move.migration)}`;
      if (distinct.has(key)) return false;
      distinct.add(key);
      return true;
    })
    .slice(0, 12)
    .map(({ move }) => move);
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
            : best(rolloutMoves(g), (m) => heuristic(g, m, ROLLOUT_LOOKAHEAD));
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
    if (
      rounds >= (o.id === 'wildgrove' ? 1 : 3) &&
      performance.now() - start > budgetMs
    )
      break;
  }
  return best(
    candidates,
    (m) => totals[candidates.indexOf(m)] / rounds + heuristic(o, m) * 0.04,
  );
}

/** A fast, deterministic safety move used when the strategic worker cannot reply. */
export function fallbackMove(g: Game | Observation, actor = g.active): Move {
  const state = { ...g, active: actor };
  if (state.phase === 'pass')
    return {
      type: 'pass',
      cards: state.players[actor].hand
        .slice(0, passCount(state))
        .map((card) => card.id),
    };
  const moves = legalMoves(state);
  if (!moves.length) throw new Error('No legal fallback move');
  return moves[0];
}
