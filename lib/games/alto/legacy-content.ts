/** Frozen rules-2 catalogue: existing saved and online matches keep these
 * costs, effects and lengths. Balance new matches in content.ts instead. */
/**
 * Alto's content: the four kinds of cargo, the planets, every upgrade, the
 * crew and the orders. Everything a match can offer is data here, so the
 * rules, the table, the rules text and the bots read the same numbers.
 *
 * The code keeps its first words (goods, islands, plans, captains, winds)
 * and their ids, so saves and online rooms stay valid; players see cargo,
 * planets, upgrades, crew and comets.
 */

/** Food, metal, ice and crystal, always in this order; crystal is the rare one. */
export const goods = ['Food', 'Metal', 'Ice', 'Crystal'] as const;
export type Good = 0 | 1 | 2 | 3;
/** An amount of each good, indexed by `Good`. */
export type Goods = [number, number, number, number];
export const noGoods = (): Goods => [0, 0, 0, 0];

export type Island = { id: string; name: string; good: Good };
/**
 * The planets in play: two more than the players. The first four carry one
 * kind of cargo each; bigger tables add a second of each, crystal last, so
 * crystal stays rare.
 */
export const islands: Island[] = [
  { id: 'pinewood', name: 'Orchard', good: 0 },
  { id: 'quarry', name: 'Rust', good: 1 },
  { id: 'meadow', name: 'Frost', good: 2 },
  { id: 'spire', name: 'Prism', good: 3 },
  { id: 'grove', name: 'Pumpkin', good: 0 },
  { id: 'cliffs', name: 'Anvil', good: 1 },
  { id: 'downs', name: 'Floe', good: 2 },
  { id: 'shard', name: 'Shard', good: 3 },
];
export const islandCount = (players: number) => players + 2;
/** Every planet fills up by this much each turn; more at the biggest tables.
 *  Crystal, the rare cargo, fills by one less. */
export const growthFor = (players: number, good: Good = 0) =>
  (players >= 5 ? 3 : 2) - (good === 3 ? 1 : 0);
/** What each planet holds when the match starts. */
export const startPile = 2;
/** A planet never holds more than this; a full planet stops filling. */
export const pileCap = 10;
/** Cargo a ship carries home from one flight before any Cargo Pod or Trailer. */
export const baseHold = 2;
/** Every player starts with one food, one metal and one ice. */
export const startStock = (): Goods => [1, 1, 1, 0];
/** Leftover cargo at the end: every this many score 1. */
export const leftoverPer = 3;

/** What an upgrade does once it is bolted onto your ship. */
export type Effect =
  /** Your ship carries more home from each flight. */
  | { type: 'hold'; amount: number }
  /** Landing on a planet of this cargo, you take this many more. */
  | { type: 'yield'; good: Good; amount: number }
  /** Alone on a planet, you take this many more. */
  | { type: 'alone'; amount: number }
  /** Sharing a planet, you take this many more. */
  | { type: 'share'; amount: number }
  /** Every later upgrade (of this family, if given) costs this much less cargo, any kind. */
  | { type: 'discount'; amount: number; family?: Family }
  | { type: 'points'; points: number }
  /** Trophies: the first to build it scores the most. */
  | { type: 'race'; ladder: number[] }
  /** At the end: points for each upgrade you own of this family (any upgrade without one). */
  | { type: 'per'; points: number; family?: Family }
  /** At the end: points for every cargo your ship holds. */
  | { type: 'perHold'; points: number }
  /** At the end: leftover cargo scores 1 for every `per` instead of three. */
  | { type: 'thrift'; per: number }
  /** At the end: points for every set of all four kinds of cargo left over. */
  | { type: 'sets'; points: number };
/** The model's kind: tools load more of one cargo, gear carries more,
 *  trophies and extras score. Players only see the two families. */
export type Tag = 'workshop' | 'ship' | 'monument' | 'civic';
/** Ship parts bolt onto your ship and load more cargo; base modules are the
 *  building blocks of your home base and score points. */
export type Family = 'ship' | 'base';
export const familyOf = (tag: Tag): Family =>
  tag === 'workshop' || tag === 'ship' ? 'ship' : 'base';

export type Plan = {
  id: string;
  name: string;
  season: 1 | 2 | 3;
  cost: Goods;
  tag: Tag;
  family: Family;
  effects: Effect[];
};

const plan = (
  id: string,
  name: string,
  season: Plan['season'],
  cost: Goods,
  tag: Tag,
  effects: Effect[],
): Plan => ({ id, name, season, cost, tag, family: familyOf(tag), effects });

/**
 * Every upgrade. Each trip's First Flight upgrades come first, in the order
 * the shop lays them out; the rest join them when the shop is drawn at
 * random. Tools load one more of their cargo on every flight to it, so an
 * early one pays for itself several times; trophies pay most to whoever
 * builds them first.
 */
export const plans: Plan[] = [
  // Year 1: fit out your ship.
  plan('rigging', 'Cargo Pod', 1, [1, 2, 2, 0], 'ship', [
    { type: 'hold', amount: 1 },
  ]),
  plan('sawmill', 'Harvester', 1, [0, 1, 2, 0], 'workshop', [
    { type: 'yield', good: 0, amount: 1 },
  ]),
  plan('mason', 'Drill', 1, [2, 0, 1, 0], 'workshop', [
    { type: 'yield', good: 1, amount: 1 },
  ]),
  plan('fold', 'Scoop', 1, [1, 2, 0, 0], 'workshop', [
    { type: 'yield', good: 2, amount: 1 },
  ]),
  plan('shrine', 'Telescope', 1, [1, 1, 1, 1], 'monument', [
    { type: 'points', points: 12 },
  ]),
  plan('kite', 'Radar', 1, [1, 1, 1, 1], 'ship', [
    { type: 'alone', amount: 1 },
  ]),
  plan('pier', 'Robot Arm', 1, [1, 1, 2, 0], 'ship', [
    { type: 'share', amount: 1 },
  ]),
  plan('beacon', 'Beacon', 1, [0, 1, 1, 1], 'monument', [
    { type: 'race', ladder: [11, 10, 9, 8, 7, 6] },
  ]),
  plan('post', 'Fabricator', 1, [2, 1, 1, 1], 'civic', [
    { type: 'discount', amount: 1, family: 'base' },
  ]),
  // Year 2: crystal, bigger holds, the first big scores.
  plan('glassworks', 'Cutter', 2, [1, 0, 1, 0], 'workshop', [
    { type: 'yield', good: 3, amount: 1 },
  ]),
  plan('sails', 'Trailer', 2, [2, 1, 1, 1], 'ship', [
    { type: 'hold', amount: 1 },
  ]),
  plan('belltower', 'Dish', 2, [1, 2, 1, 1], 'monument', [
    { type: 'race', ladder: [12, 10, 9, 8, 7, 6] },
  ]),
  plan('gardens', 'Garden', 2, [1, 1, 1, 1], 'civic', [
    { type: 'per', points: 1 },
  ]),
  plan('windmill', 'Cooler', 2, [0, 2, 1, 1], 'workshop', [
    { type: 'yield', good: 0, amount: 1 },
    { type: 'yield', good: 2, amount: 1 },
  ]),
  plan('bridge', 'Statue', 2, [1, 1, 2, 1], 'monument', [
    { type: 'points', points: 11 },
  ]),
  plan('market', 'Workshop', 2, [1, 1, 2, 1], 'civic', [
    { type: 'discount', amount: 1 },
  ]),
  plan('balloon', 'Sidecar', 2, [2, 1, 2, 1], 'ship', [
    { type: 'hold', amount: 1 },
    { type: 'alone', amount: 1 },
  ]),
  plan('harbor', 'Magnet', 2, [1, 2, 1, 1], 'ship', [
    { type: 'share', amount: 2 },
  ]),
  // Year 3: build up your base.
  plan('lighthouse', 'Signal Tower', 3, [2, 2, 2, 2], 'monument', [
    { type: 'race', ladder: [14, 12, 10, 9, 8, 7] },
  ]),
  plan('palace', 'Habitat', 3, [2, 3, 2, 3], 'monument', [
    { type: 'race', ladder: [17, 15, 13, 11, 10, 9] },
  ]),
  plan('guildhall', 'Refinery', 3, [1, 1, 2, 1], 'civic', [
    { type: 'per', points: 2, family: 'ship' },
  ]),
  plan('observatory', 'Observatory', 3, [2, 1, 1, 3], 'monument', [
    { type: 'points', points: 10 },
  ]),
  plan('archive', 'Hangar', 3, [1, 2, 2, 1], 'civic', [
    { type: 'perHold', points: 3 },
  ]),
  plan('fountain', 'Water Tank', 3, [2, 1, 2, 1], 'monument', [
    { type: 'points', points: 9 },
  ]),
  plan('treasury', 'Vault', 3, [1, 2, 1, 1], 'civic', [
    { type: 'thrift', per: 2 },
  ]),
  plan('skytower', 'Archive', 3, [2, 1, 2, 2], 'monument', [
    { type: 'per', points: 2, family: 'base' },
  ]),
  plan('bazaar', 'Cargo Hub', 3, [1, 1, 1, 1], 'civic', [
    { type: 'sets', points: 4 },
  ]),
];
export const planById = Object.fromEntries(
  plans.map((p) => [p.id, p]),
) as Record<string, Plan>;
/** Upgrades each year lays out. */
export const plansPerSeason = 6;
export const seasonPlans = (season: Plan['season']) =>
  plans.filter((p) => p.season === season);
/** First Flight: the same eighteen upgrades every match, the way to learn. */
export const firstFlight = () =>
  [1, 2, 3].map((s) =>
    seasonPlans(s as Plan['season'])
      .slice(0, plansPerSeason)
      .map((p) => p.id),
  );

/** Crew (the Captains extension): each player picks one of two at the start.
 * Most work like an upgrade built before the first turn; the Trader bends a
 * rule. */
export type Captain = {
  id: string;
  name: string;
  text: string;
  effects: Effect[];
  start?: Goods;
};
export const captains: Captain[] = [
  {
    id: 'navigator',
    name: 'Pilot',
    text: 'Sharing a planet, take 1 more.',
    effects: [{ type: 'share', amount: 1 }],
  },
  {
    id: 'forester',
    name: 'Farmer',
    text: 'Start with 2 more food. On food planets, take 1 more.',
    effects: [{ type: 'yield', good: 0, amount: 1 }],
    start: [2, 0, 0, 0],
  },
  {
    id: 'mason',
    name: 'Miner',
    text: 'Start with 2 more metal. On metal planets, take 1 more.',
    effects: [{ type: 'yield', good: 1, amount: 1 }],
    start: [0, 2, 0, 0],
  },
  {
    id: 'shepherd',
    name: 'Ice Fisher',
    text: 'Start with 2 more ice. On ice planets, take 1 more.',
    effects: [{ type: 'yield', good: 2, amount: 1 }],
    start: [0, 0, 2, 0],
  },
  {
    id: 'glazier',
    name: 'Jeweller',
    text: 'Start with 3 crystal. On crystal planets, take 1 more.',
    effects: [{ type: 'yield', good: 3, amount: 1 }],
    start: [0, 0, 0, 3],
  },
  {
    id: 'scout',
    name: 'Scout',
    text: 'Alone on a planet, take 1 more.',
    effects: [{ type: 'alone', amount: 1 }],
  },
  {
    id: 'trader',
    name: 'Trader',
    text: 'Start with 1 crystal. Your first upgrade each year costs 1 cargo less.',
    effects: [],
    start: [0, 0, 0, 1],
  },
  {
    id: 'architect',
    name: 'Architect',
    text: 'Base modules cost 1 cargo less.',
    effects: [{ type: 'discount', amount: 1, family: 'base' }],
  },
];
export const captainById = Object.fromEntries(
  captains.map((c) => [c.id, c]),
) as Record<string, Captain>;

/** Orders: a little cargo for points, first come first served. */
export type Order = { id: string; cost: Goods; points: number };
export const orders: Order[] = [
  { id: 'o1', cost: [2, 1, 0, 0], points: 3 },
  { id: 'o2', cost: [0, 2, 1, 0], points: 3 },
  { id: 'o3', cost: [1, 0, 2, 0], points: 3 },
  { id: 'o4', cost: [2, 2, 0, 0], points: 5 },
  { id: 'o5', cost: [0, 2, 2, 0], points: 5 },
  { id: 'o6', cost: [2, 0, 2, 0], points: 5 },
  { id: 'o7', cost: [1, 1, 1, 0], points: 4 },
  { id: 'o8', cost: [1, 0, 0, 1], points: 4 },
  { id: 'o9', cost: [0, 1, 0, 1], points: 4 },
  { id: 'o10', cost: [0, 0, 1, 1], points: 4 },
  { id: 'o11', cost: [1, 1, 1, 1], points: 7 },
  { id: 'o12', cost: [3, 0, 0, 1], points: 6 },
  { id: 'o13', cost: [0, 3, 0, 1], points: 6 },
  { id: 'o14', cost: [0, 0, 3, 1], points: 6 },
  { id: 'o15', cost: [0, 0, 0, 2], points: 5 },
  { id: 'o16', cost: [2, 2, 2, 0], points: 8 },
];
export const orderById = Object.fromEntries(
  orders.map((o) => [o.id, o]),
) as Record<string, Order>;
/** Orders open at once. */
export const openOrders = 3;

/** Winds (players see comets): the planet a comet hits gains this much more. */
export const windBonus = 3;
/** Flags: at the end, each planet's most flags scores this; ties score the second value each. */
export const flagPoints = { most: 5, tied: 2 };

/** How long a match runs: turns in each of the three trips (seasons in the code). */
export const lengths = { short: 4, standard: 6 } as const;
export type Length = keyof typeof lengths;
