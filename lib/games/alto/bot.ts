import {
  flagPoints,
  leftoverPer,
  orderById,
  planById,
  type Effect,
  type Goods,
  type Plan,
} from './content.ts';
import {
  aloneBonus,
  buildable,
  currentPlans,
  discount,
  fillable,
  hold,
  raceValue,
  shareBonus,
  familyCount,
  yieldBonus,
  totalTurns,
  turnNumber,
  turnsPerSeason,
  type AltoGame,
  type AltoMove,
  type AltoPlayer,
  type Choice,
} from './engine.ts';

/**
 * Alto's bots. Every bot reads the whole table the way a player can: the
 * piles, everyone's holds and needs, the plans still to come. It guesses
 * where the others will fly, then picks the build and the island with the
 * best expected worth. Easy bots guess loosely and play a little at random;
 * hard bots think one step further about where the others will go.
 */

type Weights = { goods: Goods; worth: number; want: Goods };

/** How much a good is worth to this player right now, in points. */
function weights(g: AltoGame, seat: number): Weights {
  const p = g.players[seat];
  const now = turnNumber(g);
  const total = totalTurns(g);
  const left = total - now; // turns after this one
  // Late goods only count as leftovers; early goods can become plans.
  const worth = left >= 2 ? 1.35 : left === 1 ? 0.9 : 1 / leftoverPer;
  const demand: Goods = [0, 0, 0, 0];
  for (let s = g.season; s <= 3; s++)
    for (const id of g.plans[s - 1]) {
      if (p.built.includes(id)) continue;
      const w = s === g.season ? 1 : s === g.season + 1 ? 0.7 : 0.45;
      planById[id].cost.forEach((c, k) => (demand[k] += c * w));
    }
  const supply = p.stock;
  const short = demand.map((d, k) => Math.max(0, d - supply[k]));
  const totalShort = short.reduce((a, b) => a + b, 0) || 1;
  const goods = short.map(
    (v) => worth * (0.75 + (0.9 * v) / totalShort),
  ) as Goods;
  // Glass is scarce and most big plans want it.
  goods[3] *= 1.15;
  const totalDemand = demand.reduce((a, b) => a + b, 0) || 1;
  const want = demand.map((d) => d / totalDemand) as Goods;
  return { goods, worth, want };
}

/** Rough chance of being alone on an island: about four flights in five at
 * two players, one in two at six. */
const aloneChance = (g: AltoGame) =>
  Math.max(0.35, 0.87 - 0.07 * g.players.length);

/** What a plan is worth to its builder over the rest of the match. */
export function planWorth(
  g: AltoGame,
  seat: number,
  id: string,
  w = weights(g, seat),
) {
  const p = g.players[seat];
  const plan = planById[id];
  const now = turnNumber(g);
  const total = total_(g);
  const flightsLeft = total - now + 1; // this turn's flight counts: builds come first
  const makesLeft = total - now + 1;
  const avg = (w.goods[0] + w.goods[1] + w.goods[2] + w.goods[3]) / 4;
  let v = 0;
  for (const e of plan.effects)
    v += effectWorth(g, p, plan, e, { flightsLeft, makesLeft, avg, w });
  // End scorers already standing gain from this plan's family, or its hold.
  for (const own of p.built) {
    for (const e of planById[own].effects) {
      if (e.type === 'per' && (!e.family || e.family === plan.family))
        v += e.points;
      if (e.type === 'perHold')
        for (const f of plan.effects)
          if (f.type === 'hold') v += e.points * f.amount;
    }
  }
  return v;
}
const total_ = (g: AltoGame) => totalTurns(g);

function effectWorth(
  g: AltoGame,
  p: AltoPlayer,
  plan: Plan,
  e: Effect,
  c: { flightsLeft: number; makesLeft: number; avg: number; w: Weights },
): number {
  const late = (n: number) => Math.max(0, n - 1.2);
  switch (e.type) {
    case 'points':
      return e.points;
    case 'race':
      return raceValue(g, plan);
    case 'yield': {
      // Every later flight to this good's islands loads one more; how often
      // this player flies there follows how much of the good they still want.
      const often = Math.min(0.6, Math.max(0.24, c.w.want[e.good] + 0.08));
      return e.amount * late(c.flightsLeft) * often * c.w.goods[e.good] * 1.15;
    }
    case 'hold': {
      // A bigger hold helps when a share of the piles outgrows it.
      const cap = hold(p);
      const crowd = g.players.length / g.islands.length;
      const binds =
        g.islands.filter((i) => i.pile / Math.max(1, crowd * 1.4) > cap)
          .length / g.islands.length;
      return e.amount * late(c.flightsLeft) * (0.25 + 0.75 * binds) * c.avg;
    }
    case 'alone':
      return e.amount * late(c.flightsLeft) * aloneChance(g) * c.avg;
    case 'share':
      return e.amount * late(c.flightsLeft) * (1 - aloneChance(g)) * c.avg;
    case 'discount': {
      // About half the upgrades still to come get built; a discount that
      // takes off a missing cargo saves the two that would stand in for it.
      let buildsLeft = 0;
      for (let s = g.season; s <= 3; s++)
        for (const id of g.plans[s - 1])
          if (
            id !== plan.id &&
            !p.built.includes(id) &&
            (!e.family || planById[id].family === e.family)
          )
            buildsLeft += s === g.season ? 0.3 : 0.55;
      return e.amount * buildsLeft * c.avg * 1.3;
    }
    case 'per': {
      const have =
        familyCount(p, e.family) +
        (!e.family || e.family === plan.family ? 1 : 0);
      // Upgrades still to come this match, roughly two a year and one more
      // of the family in the years left.
      const more = e.family
        ? (e.family === 'base' ? 1.2 : 0.4) * (3 - g.season) +
          (e.family === 'base' ? 0.8 : 0)
        : 1.8 * (3 - g.season) + 0.6;
      return e.points * (have + more);
    }
    case 'perHold':
      return e.points * hold(p);
    case 'thrift':
      return 7 * (1 / e.per - 1 / leftoverPer);
    case 'sets':
      return e.points * Math.max(0, Math.min(...p.stock) - 0.5);
  }
}

/** The chance each other player flies to each island, from what the island is worth to them. */
function forecast(
  g: AltoGame,
  seat: number,
  sharp: number,
  known?: (Choice | null)[],
) {
  return g.players.map((_, s) => {
    if (s === seat) return g.islands.map(() => 0);
    const k = known?.[s];
    if (k) return g.islands.map((_, i) => (i === k.island ? 1 : 0));
    const w = weights(g, s);
    const cap = hold(g.players[s]);
    const values = g.islands.map(
      (island) => Math.min(island.pile, cap) * w.goods[island.good] + 0.01,
    );
    const max = Math.max(...values);
    const exp = values.map((v) => Math.exp(sharp * (v - max)));
    const z = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / z);
  });
}

/** Distribution of how many others land on each island. */
function crowd(odds: number[][], islands: number) {
  return Array.from({ length: islands }, (_, i) => {
    let dist = [1];
    for (const row of odds) {
      const q = row[i] ?? 0;
      if (!q) continue;
      const next = Array(dist.length + 1).fill(0);
      dist.forEach((v, k) => {
        next[k] += v * (1 - q);
        next[k + 1] += v * q;
      });
      dist = next;
    }
    return dist;
  });
}

function islandWorth(
  g: AltoGame,
  seat: number,
  i: number,
  dist: number[],
  w: Weights,
) {
  const p = g.players[seat];
  const island = g.islands[i];
  const cap = hold(p);
  let v = 0;
  dist.forEach((q, others) => {
    if (!q) return;
    const share = others ? Math.floor(island.pile / (others + 1)) : island.pile;
    const extra =
      (others ? shareBonus(p) : aloneBonus(p)) + yieldBonus(p, island.good);
    v += q * (Math.min(share, cap) + extra) * w.goods[island.good];
  });
  if (g.options.flags) {
    const mine = p.flags[i] ?? 0;
    const best = Math.max(
      0,
      ...g.players.map((o, s) => (s === seat ? 0 : (o.flags[i] ?? 0))),
    );
    // A flag matters most while the island's lead is close.
    const close =
      Math.abs(mine + 1 - best) <= 1 ? 1 : mine + 1 > best + 1 ? 0.25 : 0.4;
    const turnsLeft = totalTurns(g) - turnNumber(g) + 1;
    v += dist[0] * close * (flagPoints.most / Math.max(2, turnsLeft / 2.5));
  }
  return v;
}

type Option = {
  build?: string;
  order?: string;
  paid: Goods | null;
  worth: number;
};

function options(
  g: AltoGame,
  seat: number,
  w: Weights,
  style: Style = {},
): Option[] {
  const list: Option[] = [{ paid: [0, 0, 0, 0], worth: 0 }];
  for (const id of currentPlans(g)) {
    const paid = buildable(g, seat, id);
    if (!paid) continue;
    const cost = paid.reduce((a, v, k) => a + v * w.goods[k], 0);
    list.push({
      build: id,
      paid,
      worth:
        planWorth(g, seat, id, w) *
          (style[id] ?? style[planById[id].tag] ?? 1) -
        cost,
    });
  }
  for (const id of g.openOrders ?? []) {
    const paid = fillable(g, seat, id);
    if (!paid) continue;
    const cost = paid.reduce((a, v, k) => a + v * w.goods[k], 0);
    list.push({ order: id, paid, worth: orderById[id].points - cost });
  }
  return list;
}

/** Keeps goods for a plan the bot cannot pay yet but soon could, instead of spending them on less. */
function savingFor(g: AltoGame, seat: number, w: Weights) {
  const p = g.players[seat];
  let best = 0;
  for (const id of currentPlans(g)) {
    if (p.built.includes(id) || buildable(g, seat, id)) continue;
    const cost = planById[id].cost;
    const missing =
      cost.reduce((a, c, k) => a + Math.max(0, c - p.stock[k]), 0) -
      discount(g, p, planById[id].family);
    if (missing > 3 || g.turn >= turnsPerSeason(g)) continue;
    best = Math.max(
      best,
      planWorth(g, seat, id, w) -
        cost.reduce((a, c, k) => a + c * w.goods[k], 0),
    );
  }
  return best;
}

/** A leaning toward some kinds of plans, for balance tests: a tag or a plan id → multiplier. */
export type Style = Partial<Record<string, number>>;

export function botMove(
  g: AltoGame,
  seat: number,
  style: Style = {},
): AltoMove | null {
  if (g.over) return null;
  const p = g.players[seat];
  const random = seededRandom(g, seat);
  if (g.phase === 'captain') {
    const offer = p.captainOffer;
    if (!offer?.length) return null;
    const pick =
      g.difficulty === 'easy'
        ? offer[Math.floor(random() * offer.length)]
        : offer.reduce((a, b) => (captainRank[b] > captainRank[a] ? b : a));
    return { type: 'captain', captain: pick };
  }
  if (g.ready[seat]) return null;
  const noise =
    g.difficulty === 'easy' ? 0.9 : g.difficulty === 'medium' ? 0.25 : 0.05;
  const w = weights(g, seat);
  let odds = forecast(g, seat, g.difficulty === 'easy' ? 0.3 : 1.2);
  if (g.difficulty === 'hard') {
    // Think one step further: the others also expect to meet each other.
    const guesses = g.players.map((_, s) =>
      s === seat ? null : { island: bestIsland(g, s, forecast(g, s, 1.2)) },
    );
    odds = odds.map((row, s) =>
      s === seat
        ? row
        : row.map(
            (v, i) => 0.55 * v + 0.45 * (guesses[s]?.island === i ? 1 : 0),
          ),
    );
  }
  const dist = crowd(odds, g.islands.length);
  const saving = savingFor(g, seat, w);
  // The build: the best worth over the islands it leaves open.
  const flights = g.islands.map((_, i) => islandWorth(g, seat, i, dist[i], w));
  let build: Option | null = null;
  let buildValue = -Infinity;
  for (const o of options(g, seat, w, style)) {
    // Building something smaller than the plan being saved for costs that plan.
    const worth =
      o.build || o.order ? o.worth - (o.worth < saving ? saving * 0.35 : 0) : 0;
    const v = worth + (random() - 0.5) * noise * 2;
    if (v > buildValue) {
      buildValue = v;
      build = o;
    }
  }
  // The island: a weighted draw, so bots that think alike do not all fly together.
  const temper =
    g.difficulty === 'easy' ? 1.1 : g.difficulty === 'medium' ? 0.45 : 0.3;
  const top = Math.max(...flights);
  const weightsOf = flights.map((v) => Math.exp((v - top) / temper));
  const total = weightsOf.reduce((a, b) => a + b, 0);
  let pick = random() * total;
  let island = 0;
  for (; island < flights.length - 1; island++) {
    pick -= weightsOf[island];
    if (pick <= 0) break;
  }
  return {
    type: 'choose',
    island,
    ...(build?.build ? { build: build.build } : {}),
    ...(build?.order ? { order: build.order } : {}),
  };
}

function bestIsland(g: AltoGame, seat: number, odds: number[][]) {
  const w = weights(g, seat);
  const dist = crowd(odds, g.islands.length);
  let best = 0,
    value = -Infinity;
  for (let i = 0; i < g.islands.length; i++) {
    const v = islandWorth(g, seat, i, dist[i], w);
    if (v > value) {
      value = v;
      best = i;
    }
  }
  return best;
}

/** A bot's own dice: repeatable for a given table state, so a reload asks the same. */
function seededRandom(g: AltoGame, seat: number) {
  let s =
    (g.rngState ^
      Math.imul(g.revision + 1, 2654435761) ^
      (seat * 97 + g.season * 7919 + g.turn * 104729)) >>>
    0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** How the bots rank the captains they are offered. */
const captainRank: Record<string, number> = {
  navigator: 6,
  forester: 5,
  mason: 5,
  shepherd: 5,
  trader: 4,
  glazier: 4,
  scout: 3,
  architect: 3,
};
