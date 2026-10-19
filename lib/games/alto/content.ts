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
  | { type: 'sets'; points: number }
  /** Changing cargo kind from the previous flight loads extra cargo. */
  | { type: 'route'; amount: number }
  /** A specialist produces a second cargo on flights to its chosen kind. */
  | { type: 'byproduct'; good: Good; cargo: Good; amount: number }
  /** At the end, score each fitted ship level, including refits. */
  | { type: 'perLevel'; points: number };
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
  /** The inspection/build view's level; catalogue entries start at one. */
  level?: number;
  /** Replacement effects and marginal costs for Mk II and Mk III. */
  refits?: { cost: Goods; effects: Effect[] }[];
};

const plan = (
  id: string,
  name: string,
  season: Plan['season'],
  cost: Goods,
  tag: Tag,
  effects: Effect[],
): Plan => ({ id, name, season, cost, tag, family: familyOf(tag), effects });

/** Ship fittings stay available. Mk II opens in Year 2, Mk III in Year 3.
 * Refits replace a fitting's effects; their costs pay only for the refit. */
const ship = (
  id: string,
  name: string,
  season: Plan['season'],
  cost: Goods,
  tag: Tag,
  effects: Effect[],
  refits: NonNullable<Plan['refits']>,
): Plan => ({ ...plan(id, name, season, cost, tag, effects), refits });
export const plans: Plan[] = [
  // Year 1: fit out your ship.
  ship(
    'rigging',
    'Cargo Pod',
    1,
    [2, 4, 2, 0],
    'ship',
    [{ type: 'hold', amount: 1 }],
    [
      { cost: [1, 2, 1, 1], effects: [{ type: 'hold', amount: 2 }] },
      { cost: [2, 2, 1, 1], effects: [{ type: 'hold', amount: 3 }] },
    ],
  ),
  ship(
    'sawmill',
    'Harvester',
    1,
    [0, 2, 4, 0],
    'workshop',
    [{ type: 'yield', good: 0, amount: 1 }],
    [
      {
        cost: [1, 1, 1, 1],
        effects: [
          { type: 'yield', good: 0, amount: 2 },
          { type: 'byproduct', good: 0, cargo: 1, amount: 1 },
        ],
      },
      {
        cost: [1, 1, 2, 1],
        effects: [
          { type: 'yield', good: 0, amount: 3 },
          { type: 'byproduct', good: 0, cargo: 1, amount: 2 },
        ],
      },
    ],
  ),
  ship(
    'mason',
    'Drill',
    1,
    [4, 0, 2, 0],
    'workshop',
    [{ type: 'yield', good: 1, amount: 1 }],
    [
      {
        cost: [1, 1, 1, 1],
        effects: [
          { type: 'yield', good: 1, amount: 2 },
          { type: 'byproduct', good: 1, cargo: 2, amount: 1 },
        ],
      },
      {
        cost: [1, 1, 2, 1],
        effects: [
          { type: 'yield', good: 1, amount: 3 },
          { type: 'byproduct', good: 1, cargo: 2, amount: 2 },
        ],
      },
    ],
  ),
  ship(
    'fold',
    'Scoop',
    1,
    [2, 4, 0, 0],
    'workshop',
    [{ type: 'yield', good: 2, amount: 1 }],
    [
      {
        cost: [1, 1, 1, 1],
        effects: [
          { type: 'yield', good: 2, amount: 2 },
          { type: 'byproduct', good: 2, cargo: 0, amount: 1 },
        ],
      },
      {
        cost: [1, 1, 2, 1],
        effects: [
          { type: 'yield', good: 2, amount: 3 },
          { type: 'byproduct', good: 2, cargo: 0, amount: 2 },
        ],
      },
    ],
  ),
  ship(
    'kite',
    'Radar',
    1,
    [2, 2, 2, 2],
    'ship',
    [{ type: 'route', amount: 1 }],
    [
      {
        cost: [1, 1, 2, 2],
        effects: [
          { type: 'route', amount: 1 },
          { type: 'alone', amount: 1 },
        ],
      },
      {
        cost: [2, 2, 3, 2],
        effects: [
          { type: 'route', amount: 2 },
          { type: 'alone', amount: 1 },
        ],
      },
    ],
  ),
  ship(
    'pier',
    'Robot Arm',
    1,
    [2, 2, 2, 0],
    'ship',
    [{ type: 'share', amount: 1 }],
    [
      { cost: [1, 2, 2, 1], effects: [{ type: 'share', amount: 2 }] },
      { cost: [2, 2, 2, 1], effects: [{ type: 'share', amount: 3 }] },
    ],
  ),
  ship(
    'glassworks',
    'Cutter',
    1,
    [2, 2, 2, 0],
    'workshop',
    [{ type: 'yield', good: 3, amount: 2 }],
    [
      {
        cost: [1, 1, 1, 1],
        effects: [
          { type: 'yield', good: 3, amount: 2 },
          { type: 'byproduct', good: 3, cargo: 0, amount: 1 },
        ],
      },
      {
        cost: [1, 1, 2, 1],
        effects: [
          { type: 'yield', good: 3, amount: 3 },
          { type: 'byproduct', good: 3, cargo: 0, amount: 2 },
        ],
      },
    ],
  ),
  // Year 2: hybrid fittings and infrastructure.
  ship(
    'sails',
    'Trailer',
    2,
    [4, 2, 2, 2],
    'ship',
    [
      { type: 'hold', amount: 1 },
      { type: 'share', amount: 1 },
    ],
    [
      {
        cost: [2, 2, 2, 2],
        effects: [
          { type: 'hold', amount: 2 },
          { type: 'share', amount: 1 },
        ],
      },
      {
        cost: [3, 3, 3, 3],
        effects: [
          { type: 'hold', amount: 2 },
          { type: 'share', amount: 2 },
        ],
      },
    ],
  ),
  ship(
    'windmill',
    'Cooler',
    2,
    [1, 2, 2, 1],
    'workshop',
    [
      { type: 'yield', good: 0, amount: 1 },
      { type: 'yield', good: 2, amount: 1 },
    ],
    [
      {
        cost: [2, 3, 2, 2],
        effects: [
          { type: 'yield', good: 0, amount: 2 },
          { type: 'yield', good: 2, amount: 2 },
        ],
      },
      {
        cost: [3, 4, 3, 3],
        effects: [
          { type: 'yield', good: 0, amount: 2 },
          { type: 'yield', good: 2, amount: 2 },
          { type: 'route', amount: 1 },
        ],
      },
    ],
  ),
  ship(
    'balloon',
    'Sidecar',
    2,
    [4, 2, 4, 2],
    'ship',
    [
      { type: 'hold', amount: 1 },
      { type: 'alone', amount: 1 },
    ],
    [
      {
        cost: [3, 2, 2, 2],
        effects: [
          { type: 'hold', amount: 2 },
          { type: 'alone', amount: 1 },
        ],
      },
      {
        cost: [4, 3, 3, 3],
        effects: [
          { type: 'hold', amount: 2 },
          { type: 'alone', amount: 2 },
        ],
      },
    ],
  ),
  ship(
    'harbor',
    'Magnet',
    2,
    [2, 4, 2, 2],
    'ship',
    [
      { type: 'share', amount: 2 },
      { type: 'yield', good: 1, amount: 1 },
    ],
    [
      {
        cost: [2, 3, 1, 2],
        effects: [
          { type: 'share', amount: 3 },
          { type: 'yield', good: 1, amount: 1 },
        ],
      },
      {
        cost: [3, 4, 2, 3],
        effects: [
          { type: 'share', amount: 3 },
          { type: 'yield', good: 1, amount: 2 },
        ],
      },
    ],
  ),
  plan('post', 'Fabricator', 2, [1, 1, 1, 1], 'civic', [
    { type: 'discount', amount: 1, family: 'base' },
  ]),
  plan('market', 'Workshop', 2, [1, 2, 2, 1], 'civic', [
    { type: 'discount', amount: 1, family: 'ship' },
  ]),
  // Year 3: score the ship and base you chose to build.
  plan('guildhall', 'Refinery', 3, [5, 5, 5, 5], 'civic', [
    { type: 'perLevel', points: 3 },
  ]),
  plan('archive', 'Hangar', 3, [5, 7, 5, 3], 'civic', [
    { type: 'perHold', points: 6 },
  ]),
  plan('gardens', 'Garden', 3, [4, 4, 4, 3], 'civic', [
    { type: 'per', points: 2 },
  ]),
  plan('lighthouse', 'Signal Tower', 3, [5, 7, 5, 7], 'monument', [
    { type: 'race', ladder: [44, 40, 36, 32, 30, 28] },
  ]),
  plan('shrine', 'Telescope', 3, [5, 5, 5, 5], 'monument', [
    { type: 'points', points: 34 },
  ]),
  plan('bazaar', 'Cargo Hub', 3, [2, 1, 2, 1], 'civic', [
    { type: 'sets', points: 3 },
  ]),
  plan('beacon', 'Beacon', 3, [3, 5, 5, 5], 'monument', [
    { type: 'race', ladder: [34, 32, 30, 28, 26, 24] },
  ]),
  plan('belltower', 'Dish', 3, [5, 5, 5, 5], 'monument', [
    { type: 'race', ladder: [40, 36, 34, 32, 30, 28] },
  ]),
  plan('bridge', 'Statue', 3, [5, 5, 5, 3], 'monument', [
    { type: 'points', points: 30 },
  ]),
  plan('palace', 'Habitat', 3, [7, 7, 7, 7], 'monument', [
    { type: 'race', ladder: [54, 48, 44, 40, 36, 34] },
  ]),
  plan('observatory', 'Observatory', 3, [4, 4, 4, 6], 'monument', [
    { type: 'per', points: 6, family: 'ship' },
  ]),
  plan('fountain', 'Water Tank', 3, [5, 3, 7, 3], 'monument', [
    { type: 'points', points: 30 },
  ]),
  plan('treasury', 'Vault', 3, [2, 2, 2, 2], 'civic', [
    { type: 'thrift', per: 1 },
  ]),
  plan('skytower', 'Archive', 3, [5, 5, 5, 5], 'monument', [
    { type: 'per', points: 8, family: 'base' },
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
export const lengths = { short: 8, standard: 10 } as const;
export type Length = keyof typeof lengths;
