import * as legacy from './legacy-content.ts';
import {
  baseHold,
  captainById,
  captains,
  firstFlight,
  flagPoints,
  goods,
  growthFor,
  islandCount,
  islands as islandList,
  leftoverPer,
  lengths,
  noGoods,
  openOrders,
  pileCap,
  orderById,
  orders as orderList,
  planById,
  plansPerSeason,
  seasonPlans,
  startPile,
  startStock,
  windBonus,
  type Effect,
  type Good,
  type Goods,
  type Length,
  type Family,
  type Plan,
} from './content.ts';

/**
 * Alto: three seasons of flights between floating islands. Every turn,
 * everyone at once picks an island to fly to and, if they like, a plan to
 * build with the goods they already hold. Alone on an island you load as much
 * as your hold carries; with others you split its cargo. Nothing is hidden
 * but the choices of the turn: every plan of the match is on the table from
 * the first turn.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PlanSet = 'first' | 'random';
export type AltoOptions = {
  length: Length;
  plans: PlanSet;
  /** Each turn the wind fills one island more; the next wind is shown. */
  winds?: boolean;
  /** Three open orders pay points for a few goods, first come first served. */
  orders?: boolean;
  /** Land alone to plant a flag; the most flags on an island scores at the end. */
  flags?: boolean;
  /** Everyone picks one of two captains who bend one rule. */
  captains?: boolean;
};
export const extensionKeys = ['winds', 'orders', 'flags', 'captains'] as const;
export type ExtensionKey = (typeof extensionKeys)[number];
export const defaultOptions = (): AltoOptions => ({
  length: 'standard',
  plans: 'first',
});

export type AltoMove =
  /** Fly to an island; optionally build a plan or fill an order first. */
  | { type: 'choose'; island: number; build?: string; order?: string }
  /** Take back a locked choice while others are still choosing. */
  | { type: 'undo' }
  | { type: 'captain'; captain: string };
export type Choice = { island: number; build?: string; order?: string };

export type AltoPlayer = {
  /** Absent on original saved matches, whose fittings keep their old effects. */
  edition?: 3;
  levels?: Record<string, number>;
  lastGood?: Good;
  builtThisYear?: number;
  stock: Goods;
  /** Plan ids in the order they were built. */
  built: string[];
  /** Points locked in when a plan was built: monuments and captains' bonuses. */
  scored: Record<string, number>;
  orders: string[];
  orderPoints: number;
  /** Flags: planted on each island. */
  flags: number[];
  captain?: string;
  captainOffer?: string[];
};

export type Report = {
  season: number;
  turn: number;
  /** The cargo on each island as the ships arrived. */
  piles: number[];
  wind: number | null;
  visits: number[];
  /** Goods loaded from the island, and more from Kites, Piers and captains. */
  takes: number[];
  bonus: number[];
  builds: (string | null)[];
  orders: (string | null)[];
  paid: Goods[];
  /** Points scored at once by this turn's build or order. */
  gained: number[];
  /** Fitted level after each build; zero when nothing was built. */
  buildLevels?: number[];
  /** Every cargo received, including a specialist's secondary output. */
  cargo?: Goods[];
  flags: (number | null)[];
  /** The season ended with this turn. */
  seasonEnd?: number;
};

export type AltoGame = {
  kind: 'alto';
  version: 1;
  rules: 2 | 3;
  rngState: number;
  difficulty: Difficulty;
  seats: string[];
  revision: number;
  over: boolean;
  tutorial: boolean;
  lesson: number;
  options: AltoOptions;
  phase: 'captain' | 'plan' | 'over';
  season: 1 | 2 | 3;
  /** Turn within the season, from 1. */
  turn: number;
  islands: { id: string; good: Good; pile: number }[];
  /** Each season's plans, laid out from the start. */
  plans: string[][];
  /** How many have built each monument so far. */
  races: Record<string, number>;
  players: AltoPlayer[];
  /** Everyone's secret choice this turn; only your own is ever sent to you. */
  pending: (Choice | null)[];
  ready: boolean[];
  /** Winds: the island the wind fills on every turn of the match. */
  winds?: number[];
  /** Orders: the open orders and the rest of the pile, next first. */
  openOrders?: string[];
  orderDeck?: string[];
  last: Report | null;
  history: Report[];
};

// Randomness: the same generator as the other standalone games.
function roll(g: { rngState: number }) {
  g.rngState = (Math.imul(g.rngState, 1664525) + 1013904223) >>> 0;
  return g.rngState / 4294967296;
}
function shuffle<T>(list: T[], g: { rngState: number }): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(roll(g) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const turnsPerSeason = (
  g: Pick<AltoGame, 'options'> & Partial<Pick<AltoGame, 'rules'>>,
) => (g.rules === 2 ? legacy.lengths : lengths)[g.options.length];
export const totalTurns = (
  g: Pick<AltoGame, 'options'> & Partial<Pick<AltoGame, 'rules'>>,
) => 3 * turnsPerSeason(g);
/** 1-based turn across the whole match. */
export const turnNumber = (
  g: Pick<AltoGame, 'options' | 'season' | 'turn'> &
    Partial<Pick<AltoGame, 'rules'>>,
) => (g.season - 1) * turnsPerSeason(g) + g.turn;
export const seatNames = ['You', 'Wren', 'Juno', 'Tavi', 'Ossa', 'Pim'];

export function createAlto(
  players: number,
  seed: number,
  difficulty: Difficulty = 'medium',
  options: AltoOptions = defaultOptions(),
): AltoGame {
  if (!Number.isInteger(players) || players < 2 || players > 6)
    throw new Error('Alto seats two to six.');
  const opts: AltoOptions = { ...defaultOptions(), ...options };
  const g: AltoGame = {
    kind: 'alto',
    version: 1,
    rules: 3,
    rngState: seed >>> 0,
    difficulty,
    seats: seatNames.slice(0, players),
    revision: 0,
    over: false,
    tutorial: false,
    lesson: 0,
    options: opts,
    phase: opts.captains ? 'captain' : 'plan',
    season: 1,
    turn: 1,
    islands: islandList
      .slice(0, islandCount(players))
      .map((i) => ({ id: i.id, good: i.good, pile: startPile })),
    plans: [],
    races: {},
    players: [],
    pending: Array(players).fill(null),
    ready: Array(players).fill(false),
    last: null,
    history: [],
  };
  g.plans =
    opts.plans === 'random'
      ? [1, 2, 3].map((s) =>
          shuffle(seasonPlans(s as Plan['season']), g)
            .slice(0, plansPerSeason)
            // The table lays each season out in the catalogue's order.
            .sort((a, b) => planIndex(a.id) - planIndex(b.id))
            .map((p) => p.id),
        )
      : firstFlight();
  const offers = opts.captains
    ? shuffle(
        captains.map((c) => c.id),
        g,
      )
    : [];
  for (let s = 0; s < players; s++)
    g.players.push({
      edition: 3,
      levels: {},
      builtThisYear: 0,
      stock: startStock(),
      built: [],
      scored: {},
      orders: [],
      orderPoints: 0,
      flags: g.islands.map(() => 0),
      ...(opts.captains
        ? {
            captainOffer: [
              offers[(2 * s) % offers.length],
              offers[(2 * s + 1) % offers.length],
            ],
          }
        : {}),
    });
  if (opts.winds) {
    // Never the same island twice running, so the wind always moves.
    const winds: number[] = [];
    for (let t = 0; t < totalTurns(g); t++) {
      let w = Math.floor(roll(g) * g.islands.length);
      if (w === winds.at(-1))
        w =
          (w + 1 + Math.floor(roll(g) * (g.islands.length - 1))) %
          g.islands.length;
      winds.push(w);
    }
    g.winds = winds;
    g.islands[winds[0]].pile += windBonus;
  }
  if (opts.orders) {
    const deck = shuffle(
      orderList.map((o) => o.id),
      g,
    );
    g.openOrders = deck.slice(0, openOrders);
    g.orderDeck = deck.slice(openOrders);
  }
  return g;
}
const planOrder = new Map(
  [1, 2, 3].flatMap((s) =>
    seasonPlans(s as Plan['season']).map(
      (p, i) => [p.id, s * 100 + i] as const,
    ),
  ),
);
const planIndex = (id: string) => planOrder.get(id) ?? 0;

// ——— Effects and payments ———

/** Original saves keep their catalogue and effects; helpers without a game use
 * the player's edition. New players always carry edition: 3. */
export const planFor = (g: Pick<AltoGame, 'rules'>, id: string): Plan =>
  (g.rules === 2 ? legacy.planById[id] : planById[id]) as Plan;
export const captainFor = (g: Pick<AltoGame, 'rules'>, id: string) =>
  (g.rules === 2 ? legacy.captainById : captainById)[id];
export const playerCaptain = (p: AltoPlayer, id: string) =>
  (p.edition === 3 ? captainById : legacy.captainById)[id];
export function planLevel(p: AltoPlayer, id: string) {
  return p.built.includes(id)
    ? p.edition === 3
      ? (p.levels?.[id] ?? 1)
      : 1
    : 0;
}
export function planAtLevel(
  g: Pick<AltoGame, 'rules'>,
  id: string,
  level: number,
): Plan {
  const base = planFor(g, id);
  if (!base) return base;
  const refit = level > 1 ? base.refits?.[level - 2] : undefined;
  return { ...base, ...refit, level };
}
export function ownedPlan(p: AltoPlayer, id: string): Plan {
  return planAtLevel(
    { rules: p.edition === 3 ? 3 : 2 },
    id,
    Math.max(1, planLevel(p, id)),
  );
}
export function maxPlanLevel(
  g: Pick<AltoGame, 'rules' | 'season'>,
  id: string,
) {
  const plan = planFor(g, id);
  return g.rules === 3 && plan?.refits
    ? Math.min(g.season, plan.refits.length + 1)
    : 1;
}
export function nextPlan(
  g: Pick<AltoGame, 'rules' | 'plans' | 'season'>,
  p: AltoPlayer,
  id: string,
): Plan | null {
  if (!planFor(g, id) || !currentPlans(g).includes(id)) return null;
  const level = planLevel(p, id) + 1;
  if (level > maxPlanLevel(g, id)) return null;
  return planAtLevel(g, id, level);
}
const effectCache = new WeakMap<
  AltoPlayer,
  { key: string; effects: Effect[] }
>();
export function effectsOf(p: AltoPlayer): Effect[] {
  const key = `${p.edition ?? 2}:${p.captain ?? ''}:${p.built.map((id) => `${id}:${p.levels?.[id] ?? 1}`).join(',')}`;
  const cached = effectCache.get(p);
  if (cached?.key === key) return cached.effects;
  const effects: Effect[] = [
    ...(p.captain ? (playerCaptain(p, p.captain)?.effects ?? []) : []),
    ...p.built.flatMap((id) => ownedPlan(p, id)?.effects ?? []),
  ];
  effectCache.set(p, { key, effects });
  return effects;
}
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
function effectTotal(p: AltoPlayer, type: Effect['type']) {
  return sum(
    effectsOf(p).map((e) => (e.type === type && 'amount' in e ? e.amount : 0)),
  );
}
export function hold(p: AltoPlayer) {
  return baseHold + effectTotal(p, 'hold');
}
export function aloneBonus(p: AltoPlayer) {
  return effectTotal(p, 'alone');
}
export function shareBonus(p: AltoPlayer) {
  return effectTotal(p, 'share');
}
/** More of a good on every flight to its islands, from workshops. */
export function yieldBonus(p: AltoPlayer, good: Good) {
  return sum(
    effectsOf(p).map((e) =>
      e.type === 'yield' && e.good === good ? e.amount : 0,
    ),
  );
}
/** Route rewards require a real earlier flight, and compare cargo kinds. */
export function routeBonus(p: AltoPlayer, good: Good) {
  return p.lastGood !== undefined && p.lastGood !== good
    ? effectTotal(p, 'route')
    : 0;
}
export function byproductBonus(p: AltoPlayer, good: Good): Goods {
  const cargo = noGoods();
  for (const e of effectsOf(p))
    if (e.type === 'byproduct' && e.good === good) cargo[e.cargo] += e.amount;
  return cargo;
}
/** Pure collection calculation, shared by resolution and bots. */
export function flightCargo(
  p: AltoPlayer,
  good: Good,
  share: number,
  alone: boolean,
) {
  const take = Math.min(share, hold(p));
  const cargo = byproductBonus(p, good);
  cargo[good] +=
    take +
    (alone ? aloneBonus(p) : shareBonus(p)) +
    yieldBonus(p, good) +
    routeBonus(p, good);
  return { take, bonus: cargo.reduce((a, n) => a + n, 0) - take, cargo };
}
export function shipLevels(p: AltoPlayer) {
  return p.built.reduce(
    (n, id) => n + (ownedPlan(p, id)?.family === 'ship' ? planLevel(p, id) : 0),
    0,
  );
}

/** Cargo off a build: Toolboxes (base modules only) and Workbenches, and the
 *  Trader's first build of a year. Orders take no discount. */
export function discount(
  g: Pick<AltoGame, 'season'>,
  p: AltoPlayer,
  family?: Family,
) {
  const trader =
    p.captain === 'trader' &&
    (p.edition === 3
      ? (p.builtThisYear ?? 0) === 0
      : !p.built.some((id) => legacy.planById[id].season === g.season))
      ? 1
      : 0;
  const off = sum(
    effectsOf(p).map((e) =>
      e.type === 'discount' && (!e.family || e.family === family)
        ? e.amount
        : 0,
    ),
  );
  return off + trader;
}

/** A cost once a discount is off it: off the goods you are short of first,
 *  otherwise off the rarest good on the bill. */
export function discounted(cost: Goods, stock: Goods, off = 0): Goods {
  const need = [...cost] as Goods;
  for (let d = 0; d < off; d++) {
    let k = -1;
    let worst = 0;
    for (let i = 0; i < 4; i++) {
      const short = need[i] - stock[i];
      if (need[i] > 0 && short > worst) {
        worst = short;
        k = i;
      }
    }
    // Nothing short: the discount takes the rarest good off the bill.
    if (k < 0)
      for (let i = 3; i >= 0; i--)
        if (need[i] > 0) {
          k = i;
          break;
        }
    if (k < 0) break;
    need[k]--;
  }
  return need;
}

/**
 * What a cost takes from a stock: the goods themselves, and for each good you
 * are short of, two of any others. Discounts come off the goods you are short
 * of first. Surplus goods go most plentiful first, glass last. Null when the
 * stock cannot pay.
 */
export function payment(cost: Goods, stock: Goods, off = 0): Goods | null {
  const need = discounted(cost, stock, off);
  const paid = noGoods();
  let short = 0;
  for (let i = 0; i < 4; i++) {
    paid[i] = Math.min(need[i], stock[i]);
    short += need[i] - paid[i];
  }
  let owed = short * 2;
  while (owed > 0) {
    let k = -1;
    for (let i = 0; i < 4; i++) {
      const spare = stock[i] - paid[i];
      if (spare <= 0) continue;
      // Most plentiful first; among equals the cheapest, so glass goes last.
      if (k < 0 || spare > stock[k] - paid[k]) k = i;
    }
    if (k < 0) return null;
    paid[k]++;
    owed--;
  }
  return paid;
}

export function currentPlans(
  g: Pick<AltoGame, 'plans' | 'season'> & Partial<Pick<AltoGame, 'rules'>>,
) {
  return g.rules === 2
    ? (g.plans[g.season - 1] ?? [])
    : g.plans.slice(0, g.season).flat();
}
/** Whether a player may build this plan now, and what it would take. */
export function buildable(g: AltoGame, seat: number, id: string): Goods | null {
  const p = g.players[seat];
  const plan = nextPlan(g, p, id);
  if (!plan) return null;
  return payment(plan.cost, p.stock, discount(g, p, plan.family));
}
export function fillable(g: AltoGame, seat: number, id: string): Goods | null {
  if (
    !g.options.orders ||
    !g.openOrders?.includes(id) ||
    (g.rules === 3 && g.season === 1)
  )
    return null;
  const order = orderById[id];
  return order ? payment(order.cost, g.players[seat].stock, 0) : null;
}
/** A monument's points for the next builder. */
export function raceValue(g: Pick<AltoGame, 'races'>, plan: Plan) {
  const race = plan.effects.find((e) => e.type === 'race');
  if (!race || race.type !== 'race') return 0;
  const n = g.races[plan.id] ?? 0;
  return race.ladder[Math.min(n, race.ladder.length - 1)];
}

// ——— Turns ———

export function actingSeats(g: AltoGame): number[] {
  if (g.over || g.phase === 'over') return [];
  if (g.phase === 'captain')
    return g.players.flatMap((p, s) => (p.captain ? [] : [s]));
  return g.ready.flatMap((r, s) => (r ? [] : [s]));
}
export function canUndo(g: AltoGame, seat: number) {
  return (
    g.phase === 'plan' &&
    !g.over &&
    g.ready[seat] === true &&
    g.ready.some((r) => !r)
  );
}
export function decisionKey(g: Pick<AltoGame, 'season' | 'turn' | 'phase'>) {
  return `alto:${g.season}:${g.turn}:${g.phase}`;
}

export function validMove(
  g: AltoGame,
  m: unknown,
  seat: number,
): m is AltoMove {
  if (
    !m ||
    typeof m !== 'object' ||
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat >= g.players.length ||
    g.over
  )
    return false;
  const move = m as Record<string, unknown>;
  const keys = Object.keys(move);
  if (move.type === 'undo') return keys.length === 1 && canUndo(g, seat);
  if (move.type === 'captain')
    return (
      keys.every((k) => k === 'type' || k === 'captain') &&
      g.phase === 'captain' &&
      !g.players[seat].captain &&
      typeof move.captain === 'string' &&
      !!g.players[seat].captainOffer?.includes(move.captain)
    );
  if (move.type !== 'choose' || g.phase !== 'plan' || g.ready[seat])
    return false;
  if (!keys.every((k) => ['type', 'island', 'build', 'order'].includes(k)))
    return false;
  if (
    !Number.isInteger(move.island) ||
    (move.island as number) < 0 ||
    (move.island as number) >= g.islands.length
  )
    return false;
  if (move.build !== undefined && move.order !== undefined) return false;
  if (
    move.build !== undefined &&
    (typeof move.build !== 'string' || !buildable(g, seat, move.build))
  )
    return false;
  if (
    move.order !== undefined &&
    (typeof move.order !== 'string' || !fillable(g, seat, move.order))
  )
    return false;
  return true;
}

export function play(state: AltoGame, m: AltoMove, seat: number): AltoGame {
  if (!validMove(state, m, seat)) return state;
  const g = structuredClone(state);
  g.revision++;
  if (m.type === 'captain') {
    const p = g.players[seat];
    p.captain = m.captain;
    delete p.captainOffer;
    const start = captainFor(g, m.captain).start;
    if (start) start.forEach((v, k) => (p.stock[k] += v));
    if (g.players.every((q) => q.captain)) g.phase = 'plan';
    return g;
  }
  if (m.type === 'undo') {
    g.pending[seat] = null;
    g.ready[seat] = false;
    return g;
  }
  g.pending[seat] = {
    island: m.island,
    ...(m.build ? { build: m.build } : {}),
    ...(m.order ? { order: m.order } : {}),
  };
  g.ready[seat] = true;
  if (g.ready.every(Boolean)) resolve(g);
  return g;
}

/** Everyone has chosen: build, then fly; the next turn fills the islands. */
function resolve(g: AltoGame) {
  const n = g.players.length;
  const choices = g.pending.map((c) => c!);
  const report: Report = {
    season: g.season,
    turn: g.turn,
    piles: g.islands.map((i) => i.pile),
    wind: g.winds ? g.winds[turnNumber(g) - 1] : null,
    visits: choices.map((c) => c.island),
    takes: Array(n).fill(0),
    bonus: Array(n).fill(0),
    builds: choices.map((c) => c.build ?? null),
    orders: choices.map((c) => c.order ?? null),
    paid: choices.map(() => noGoods()),
    gained: Array(n).fill(0),
    buildLevels: Array(n).fill(0),
    cargo: Array.from({ length: n }, noGoods),
    flags: Array(n).fill(null),
  };
  // Builds, all at once: every builder of a monument this turn scores the same.
  const raceBuilders: Record<string, number[]> = {};
  choices.forEach((c, s) => {
    const p = g.players[s];
    if (c.build) {
      const plan = nextPlan(g, p, c.build)!;
      const paid = payment(plan.cost, p.stock, discount(g, p, plan.family))!;
      for (let k = 0; k < 4; k++) p.stock[k] -= paid[k];
      report.paid[s] = paid;
      if (!p.built.includes(plan.id)) p.built.push(plan.id);
      if (p.edition === 3) {
        p.levels![plan.id] = plan.level ?? 1;
        p.builtThisYear = (p.builtThisYear ?? 0) + 1;
      }
      report.buildLevels![s] = plan.level ?? 1;
      if (plan.effects.some((e) => e.type === 'race'))
        (raceBuilders[plan.id] ??= []).push(s);
      report.gained[s] = sum(
        plan.effects.map((e) => (e.type === 'points' ? e.points : 0)),
      );
    } else if (c.order) {
      const order = orderById[c.order];
      const paid = payment(order.cost, p.stock, 0)!;
      for (let k = 0; k < 4; k++) p.stock[k] -= paid[k];
      report.paid[s] = paid;
      p.orders.push(order.id);
      p.orderPoints += order.points;
      report.gained[s] = order.points;
    }
  });
  for (const [id, seats] of Object.entries(raceBuilders)) {
    const plan = planFor(g, id);
    // Builders on the same turn all score the prize of the last of them.
    const value = raceValue(
      { races: { [id]: (g.races[id] ?? 0) + seats.length - 1 } },
      plan,
    );
    for (const s of seats) {
      g.players[s].scored[id] = value;
      report.gained[s] = value;
    }
    g.races[id] = (g.races[id] ?? 0) + seats.length;
  }
  if (g.openOrders) {
    const filled = new Set(choices.flatMap((c) => (c.order ? [c.order] : [])));
    g.openOrders = g.openOrders.flatMap((id) => {
      if (!filled.has(id)) return [id];
      const next = g.orderDeck!.shift();
      return next ? [next] : [];
    });
  }
  // Flights: alone you load up to your hold; together you split evenly, rounding down.
  g.islands.forEach((island, i) => {
    const visitors = choices.flatMap((c, s) => (c.island === i ? [s] : []));
    if (!visitors.length) return;
    const alone = visitors.length === 1;
    const share = alone
      ? island.pile
      : Math.floor(island.pile / visitors.length);
    for (const s of visitors) {
      const p = g.players[s];
      const load = flightCargo(p, island.good, share, alone);
      island.pile -= load.take;
      load.cargo.forEach((amount, good) => (p.stock[good] += amount));
      report.takes[s] = load.take;
      report.bonus[s] = load.bonus;
      report.cargo![s] = load.cargo;
      if (p.edition === 3) p.lastGood = island.good;
      if (alone && g.options.flags) {
        p.flags[i]++;
        report.flags[s] = i;
      }
    }
  });
  g.pending = Array(n).fill(null);
  g.ready = Array(n).fill(false);
  const last = g.turn === turnsPerSeason(g);
  if (last) report.seasonEnd = g.season;
  g.last = report;
  g.history.push(report);
  if (last && g.season === 3) {
    g.phase = 'over';
    g.over = true;
    return;
  }
  if (last) {
    g.season = (g.season + 1) as AltoGame['season'];
    g.turn = 1;
    for (const p of g.players) if (p.edition === 3) p.builtThisYear = 0;
  } else g.turn++;
  for (const island of g.islands)
    island.pile = Math.min(pileCap, island.pile + growthFor(n, island.good));
  if (g.winds) {
    const hit = g.islands[g.winds[turnNumber(g) - 1]];
    hit.pile = Math.min(pileCap, hit.pile + windBonus);
  }
}

// ——— Scores ———

export type Breakdown = {
  plans: number;
  /** End-of-game plan scores: Gardens, Guild Hall and the like. */
  bonus: number;
  orders: number;
  flags: number;
  leftover: number;
  total: number;
};
export function familyCount(p: AltoPlayer, family?: Family) {
  return p.built.filter((id) => !family || ownedPlan(p, id)?.family === family)
    .length;
}
export const totalGoods = (p: AltoPlayer) => sum(p.stock);
export function leftoverScore(p: AltoPlayer) {
  const thrift = effectsOf(p).find((e) => e.type === 'thrift');
  const per = thrift && thrift.type === 'thrift' ? thrift.per : leftoverPer;
  const sets =
    sum(effectsOf(p).map((e) => (e.type === 'sets' ? e.points : 0))) *
    Math.min(...p.stock);
  return Math.floor(totalGoods(p) / per) + sets;
}
/** Flags: each island's most flags scores; a tie scores less for each. */
export function flagScores(g: AltoGame) {
  const scores = g.players.map(() => 0);
  if (!g.options.flags) return scores;
  g.islands.forEach((_, i) => {
    const top = Math.max(...g.players.map((p) => p.flags[i] ?? 0));
    if (top <= 0) return;
    const leaders = g.players.flatMap((p, s) =>
      (p.flags[i] ?? 0) === top ? [s] : [],
    );
    for (const s of leaders)
      scores[s] += leaders.length === 1 ? flagPoints.most : flagPoints.tied;
  });
  return scores;
}
/** Points a plan earns its owner now: its own score or, for end scorers, what it would score if the match ended. */
export function planScore(p: AltoPlayer, id: string) {
  const plan = ownedPlan(p, id);
  if (!plan) return 0;
  let points = p.scored[id] ?? 0;
  for (const e of plan.effects) {
    if (e.type === 'points') points += e.points;
    if (e.type === 'per') points += e.points * familyCount(p, e.family);
    if (e.type === 'perHold') points += e.points * hold(p);
    if (e.type === 'perLevel') points += e.points * shipLevels(p);
  }
  return points;
}
export function breakdown(g: AltoGame, seat: number): Breakdown {
  const p = g.players[seat];
  let plans = 0,
    bonus = 0;
  for (const id of p.built) {
    const plan = ownedPlan(p, id);
    const own = planScore(p, id);
    if (
      plan.effects.some(
        (e) =>
          e.type === 'per' || e.type === 'perHold' || e.type === 'perLevel',
      )
    )
      bonus += own;
    else plans += own;
  }
  const flags = flagScores(g)[seat];
  const leftover = leftoverScore(p);
  return {
    plans,
    bonus,
    orders: p.orderPoints,
    flags,
    leftover,
    total: plans + bonus + p.orderPoints + flags + leftover,
  };
}
export const scores = (g: AltoGame) =>
  g.players.map((_, s) => breakdown(g, s).total);
/** Most points; a tie goes to more goods left, and a tie after that is shared. */
export function winners(g: AltoGame) {
  const sc = scores(g);
  const top = Math.max(...sc);
  const tied = g.players.flatMap((_, s) => (sc[s] === top ? [s] : []));
  const most = Math.max(...tied.map((s) => totalGoods(g.players[s])));
  return tied.filter((s) => totalGoods(g.players[s]) === most);
}

// ——— Visibility and saves ———

/** A player's view: nobody else's choice this turn, and no future orders past the next one. */
export function observe(g: AltoGame, viewer: number | null): AltoGame {
  const v = structuredClone(g);
  v.rngState = 0;
  v.pending = g.pending.map((c, s) => (s === viewer ? c : null));
  if (v.orderDeck) v.orderDeck = v.orderDeck.slice(0, 1);
  // Winds: the one blowing now and the next one are known, no further.
  if (v.winds) {
    const now = turnNumber(g) - 1;
    v.winds = v.winds.map((w, t) => (t <= now + 1 ? w : -1));
  }
  // Captain offers are private until everyone has picked.
  v.players.forEach((p, s) => {
    if (s !== viewer) delete p.captainOffer;
  });
  return v;
}

const isGoods = (x: unknown): x is Goods =>
  Array.isArray(x) &&
  x.length === 4 &&
  x.every((v) => Number.isInteger(v) && v >= 0 && v <= 999);
/** A stored match is only restored when every field has the shape this version plays. */
export function isAltoSave(x: unknown): x is AltoGame {
  try {
    const g = x as AltoGame;
    if (
      !g ||
      typeof g !== 'object' ||
      g.kind !== 'alto' ||
      g.version !== 1 ||
      (g.rules !== 2 && g.rules !== 3)
    )
      return false;
    const n = g.seats?.length;
    if (
      !Number.isInteger(n) ||
      n < 2 ||
      n > 6 ||
      !g.seats.every((s) => typeof s === 'string')
    )
      return false;
    if (!['easy', 'medium', 'hard'].includes(g.difficulty)) return false;
    if (
      !g.options ||
      !(g.options.length in lengths) ||
      !['first', 'random'].includes(g.options.plans)
    )
      return false;
    if (
      !['captain', 'plan', 'over'].includes(g.phase) ||
      g.over !== (g.phase === 'over')
    )
      return false;
    if (
      ![1, 2, 3].includes(g.season) ||
      !Number.isInteger(g.turn) ||
      g.turn < 1 ||
      g.turn > turnsPerSeason(g)
    )
      return false;
    if (!Array.isArray(g.islands) || g.islands.length !== islandCount(n))
      return false;
    if (
      !g.islands.every(
        (i, k) =>
          i.id === islandList[k].id &&
          i.good === islandList[k].good &&
          Number.isInteger(i.pile) &&
          i.pile >= 0,
      )
    )
      return false;
    if (!Array.isArray(g.plans) || g.plans.length !== 3) return false;
    if (
      !g.plans.every(
        (ids, s) =>
          Array.isArray(ids) &&
          ids.length === plansPerSeason &&
          new Set(ids).size === ids.length &&
          ids.every((id) => planFor(g, id)?.season === s + 1),
      )
    )
      return false;
    if (!Array.isArray(g.players) || g.players.length !== n) return false;
    for (const p of g.players) {
      if (
        !isGoods(p.stock) ||
        !Array.isArray(p.built) ||
        new Set(p.built).size !== p.built.length ||
        !p.built.every((id) => !!planFor(g, id) && g.plans.flat().includes(id))
      )
        return false;
      if (g.rules === 3) {
        if (
          p.edition !== 3 ||
          !p.levels ||
          typeof p.levels !== 'object' ||
          Array.isArray(p.levels)
        )
          return false;
        if (
          p.lastGood !== undefined &&
          (![0, 1, 2, 3].includes(p.lastGood) || !Number.isInteger(p.lastGood))
        )
          return false;
        if (
          !Number.isInteger(p.builtThisYear) ||
          p.builtThisYear! < 0 ||
          p.builtThisYear! > turnsPerSeason(g)
        )
          return false;
        if (
          Object.entries(p.levels).some(
            ([id, level]) =>
              !p.built.includes(id) ||
              !Number.isInteger(level) ||
              level < 1 ||
              level > maxPlanLevel(g, id) ||
              planFor(g, id)?.season > g.season,
          )
        )
          return false;
        if (p.built.some((id) => p.levels?.[id] === undefined)) return false;
      } else if (p.edition !== undefined || p.levels !== undefined)
        return false;
      if (!Array.isArray(p.flags) || p.flags.length !== g.islands.length)
        return false;
      if (p.captain !== undefined && !captainById[p.captain]) return false;
    }
    if (
      !Array.isArray(g.pending) ||
      g.pending.length !== n ||
      !Array.isArray(g.ready) ||
      g.ready.length !== n
    )
      return false;
    if (
      g.options.winds &&
      (!Array.isArray(g.winds) || g.winds.length !== totalTurns(g))
    )
      return false;
    if (
      g.options.orders &&
      (!Array.isArray(g.openOrders) ||
        !g.openOrders.every((id) => !!orderById[id]))
    )
      return false;
    return Array.isArray(g.history) && Number.isInteger(g.revision);
  } catch {
    return false;
  }
}

export const goodName = (k: Good) => goods[k];
