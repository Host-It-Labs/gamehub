import { createFactory, migrateFactory, type FactoryState } from './factory.ts';
import {
  BOOKS,
  LEVEL_AT,
  LEVEL_MULT,
  MASK_SIDE,
  bookFor,
  openSeal,
  prizeUnits,
  printTicket,
  sealLocked,
  type Cell,
  type Pack,
  type PackId,
  type ScratchTicket,
} from './books.ts';
export {
  BOOKS,
  LEVEL_AT,
  LEVEL_MULT,
  MASK_SIDE,
  type Cell,
  type Pack,
  type PackId,
  type ScratchTicket,
};
/** One shared scratch room. Tickets, rewards and foil coverage are resolved
 * here, on the server; the browser runs the same code for instant feedback. */
export const PACKS = BOOKS;
export const packFor = bookFor;
export type ScratchCell = Cell;
export const PATHS = [
  { id: 'scratch', name: 'Scratching', color: '#75bcbe' },
  { id: 'luck', name: 'Luck', color: '#e9bb66' },
  { id: 'payout', name: 'Payouts', color: '#d98d75' },
  { id: 'shop', name: 'Shop', color: '#c792d8' },
  { id: 'books', name: 'Books', color: '#8fb7e6' },
  { id: 'factory', name: 'Factory', color: '#91b282' },
] as const;
export type PathId = (typeof PATHS)[number]['id'];
export type Upgrade = {
  id: string;
  path: PathId;
  name: string;
  /** What changes, in a few words, shown with the value before and after. */
  label: string;
  max: number;
  /** The price of each rank, spread over the whole game. */
  prices: readonly number[];
  requires?: string;
  /** Book upgrades need their book on the shelf. */
  book?: PackId;
  /** Where the node sits in its path's little tree: column, row. */
  at: [number, number];
  show: (rank: number) => string;
};
export const FLOOR_SIZES = [
  [8, 5],
  [10, 6],
  [12, 7],
  [14, 8],
  [16, 9],
] as const;
export const COIN_SIZES = [1, 1.35, 1.75, 2.2, 2.8] as const;
export const FOIL_OPENS = [0.72, 0.5, 0.3, 0.04] as const;
export const QUICK_BONUS = [0, 0.25, 0.5, 1] as const;
export const JACKPOTS = [3, 5, 8, 12, 20] as const;
export const STAR_PAYS = [5, 8, 12] as const;
export const STREAK_STEPS = [0, 0.1, 0.25, 0.5] as const;
export const GOLD_CHANCE = [0, 0.15, 0.3, 0.5, 0.8] as const;
export const HEART_BONUS = [0, 0.05, 0.1, 0.2, 0.35] as const;
export const DISCOUNTS = [0, 0.1, 0.2, 0.3, 0.4] as const;
/** Loyalty card: every this many bought tickets, the next one is free. */
export const LOYALTY = [0, 10, 7, 5] as const;
export const FREE_CHANCE = [0, 0.05, 0.1, 0.15, 0.25] as const;
export const EARLY = [1, 0.7, 0.5, 0.3] as const;
/** A book's own prize upgrade, per rank; factory sales, per rank. */
export const BOOK_BOOST = 1.5;
export const SALES = 1.4;
/** A ticket costs this share of what a careful player wins on average. */
export const PRICE_SHARE = 0.5;
/** Book XP is saved and shown as whole numbers: a careful ticket of
 * difficulty ∞ earns about this much. */
export const XP_SCALE = 100;
/** Each difficulty's share of `XP_SCALE` (I, II, III, ∞): ∞ levels a book
 * fastest; easier tickets still count, only more slowly. */
export const XP_WEIGHTS = [0.1, 0.25, 0.5, 1] as const;
/** The most one ticket's quality can be worth: twice the careful average. */
export const QUALITY_CAP = 2;
/** Difficulty ∞ opens at this book level: once level 3 is complete. */
export const INFINITY_AT = 4;
/** The book level at which each difficulty (I, II, III, ∞) opens. */
export const DIFFICULTY_AT = [1, 2, 3, INFINITY_AT] as const;
/** Book level 4 needs this many careful ∞ tickets' worth of XP after level
 * 3 (×XP_SCALE), level 5 twice as many, then three times..., reduced by
 * Early print. */
export const BOOK_LEVEL_STEP = 15;
/** Additive prize/price bonus per book level beyond 3, avoiding exponential inflation. */
export const BOOK_LEVEL_GAIN = 0.5;
const times = (n: number) => `×${Math.round(n * 100) / 100}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const K = 1e3,
  M = 1e6,
  B = 1e9,
  T = 1e12;
const Qa = 1e15;
/** `n` prices from `first` to `last`, each the same big step up, rounded to
 * two significant figures. */
const span = (first: number, last: number, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const v = first * (last / first) ** (n > 1 ? i / (n - 1) : 0),
      unit = 10 ** Math.floor(Math.log10(v) - 1);
    return Math.round(v / unit) * unit;
  });
const upgrade = (u: Omit<Upgrade, 'max'>): Upgrade => ({
  ...u,
  max: u.prices.length,
});
/** Each book's helper: how many ranks, what it is called and what it shows. */
const HELPERS: Record<
  PackId,
  { name: string; label: string; ranks: number; show: (r: number) => string }
> = {
  seven: {
    name: 'Hot and cold',
    label: 'Misses show distance',
    ranks: 1,
    show: (r) => (r ? 'on' : 'off'),
  },
  twins: {
    name: 'Matchmaker',
    label: 'Pairs printed open',
    ranks: 2,
    show: String,
  },
  path: {
    name: 'Garden map',
    label: 'Extra numbers',
    ranks: 2,
    show: (r) => `+${r}`,
  },
  ladder: {
    name: 'Safety rope',
    label: 'Wrong guesses forgiven',
    ranks: 2,
    show: String,
  },
  mine: {
    name: 'Metal detector',
    label: 'Dynamite marked',
    ranks: 3,
    show: String,
  },
  sunmoon: {
    name: 'Almanac',
    label: 'Extra printed seals',
    ranks: 2,
    show: (r) => `+${r}`,
  },
  chart: { name: 'Sonar', label: 'Ship parts shown', ranks: 2, show: String },
  crown: {
    name: 'Royal decree',
    label: 'Crowns shown',
    ranks: 1,
    show: String,
  },
};
/** Every upgrade names the one number it changes, and every rank is a big
 * step. An upgrade opens once one rank of the upgrade before it is bought. */
export const UPGRADES: Upgrade[] = [
  upgrade({
    id: 'coin',
    path: 'scratch',
    name: 'Bigger coin',
    label: 'Coin size',
    at: [0.5, 0],
    prices: span(150, 5 * B, 4),
    show: (r) => times(COIN_SIZES[r]),
  }),
  upgrade({
    id: 'foil',
    path: 'scratch',
    name: 'Thin foil',
    label: 'Seal opens at',
    at: [0.5, 1],
    prices: span(2 * K, 50 * B, 3),
    requires: 'coin',
    show: (r) => (r === FOIL_OPENS.length - 1 ? 'a touch' : pct(FOIL_OPENS[r])),
  }),
  upgrade({
    id: 'quick',
    path: 'scratch',
    name: 'Quick hands',
    label: 'Fast ticket bonus',
    at: [0.5, 2],
    prices: span(40 * K, 500 * T, 3),
    requires: 'foil',
    show: (r) => `+${pct(QUICK_BONUS[r])}`,
  }),
  upgrade({
    id: 'extra',
    path: 'luck',
    name: 'Second chance',
    label: 'Extra mistakes',
    at: [0.5, 0],
    prices: span(1 * K, 50 * T, 3),
    show: (r) => `+${r}`,
  }),
  upgrade({
    id: 'star',
    path: 'luck',
    name: 'Star tickets',
    label: 'Star chance',
    at: [0, 1],
    prices: span(10 * K, 1 * Qa, 5),
    requires: 'extra',
    show: (r) => pct(starChance(r)),
  }),
  upgrade({
    id: 'goldseal',
    path: 'luck',
    name: 'Golden seal',
    label: 'Golden seal (×10) chance',
    at: [1, 1],
    prices: span(25 * K, 100 * T, 4),
    requires: 'extra',
    show: (r) => pct(GOLD_CHANCE[r]),
  }),
  upgrade({
    id: 'starpower',
    path: 'luck',
    name: 'Bright stars',
    label: 'A star ticket pays',
    at: [0, 2],
    prices: span(50 * M, 50 * Qa, 2),
    requires: 'star',
    show: (r) => times(STAR_PAYS[r]),
  }),
  upgrade({
    id: 'streak',
    path: 'luck',
    name: 'Hot streak',
    label: 'Per perfect in a row',
    at: [1, 2],
    prices: span(5 * M, 5 * Qa, 3),
    requires: 'goldseal',
    show: (r) => `+${pct(STREAK_STEPS[r])}`,
  }),
  upgrade({
    id: 'value',
    path: 'payout',
    name: 'Richer prizes',
    label: 'Prizes and prices',
    at: [0.5, 0],
    prices: [
      400,
      10 * K,
      250 * K,
      6 * M,
      150 * M,
      4 * B,
      100 * B,
      2.5 * T,
      60 * T,
      1500 * T,
      40_000 * T,
      1_000_000 * T,
    ],
    show: (r) => times(2 ** r),
  }),
  upgrade({
    id: 'jackpot',
    path: 'payout',
    name: 'Jackpot',
    label: 'A perfect ticket pays',
    at: [0, 1],
    prices: span(5 * K, 5 * Qa, 4),
    requires: 'value',
    show: (r) => times(JACKPOTS[r]),
  }),
  upgrade({
    id: 'hearts',
    path: 'payout',
    name: 'Heart bonus',
    label: 'Per heart left',
    at: [1, 1],
    prices: span(15 * K, 10 * Qa, 4),
    requires: 'value',
    show: (r) => `+${pct(HEART_BONUS[r])}`,
  }),
  upgrade({
    id: 'golden',
    path: 'payout',
    name: 'Golden touch',
    label: 'Everything won',
    at: [0, 2],
    prices: span(1 * M, 10 * Qa, 4),
    requires: 'jackpot',
    show: (r) => times(2 ** r),
  }),
  upgrade({
    id: 'mastery',
    path: 'payout',
    name: 'Mastery',
    label: 'Level III pays',
    at: [1, 2],
    prices: span(50 * M, 50 * Qa, 3),
    requires: 'hearts',
    show: (r) => times(levelMult(r, 2)),
  }),
  upgrade({
    id: 'collector',
    path: 'payout',
    name: 'Collector',
    label: 'Per book on the shelf',
    at: [0.5, 3],
    prices: span(1 * T, 100 * Qa, 3),
    requires: 'golden',
    show: (r) => `+${r * 5}%`,
  }),
  upgrade({
    id: 'discount',
    path: 'shop',
    name: 'Bulk discount',
    label: 'Ticket prices',
    at: [0.5, 0],
    prices: span(600, 1 * T, 4),
    show: (r) => (r ? `−${pct(DISCOUNTS[r])}` : 'full'),
  }),
  upgrade({
    id: 'loyalty',
    path: 'shop',
    name: 'Loyalty card',
    label: 'A free ticket',
    at: [0, 1],
    prices: span(8 * K, 10 * T, 3),
    requires: 'discount',
    show: (r) => (r ? `every ${LOYALTY[r]}th` : 'never'),
  }),
  upgrade({
    id: 'freebie',
    path: 'shop',
    name: 'Lucky draw',
    label: 'Free ticket chance',
    at: [1, 1],
    prices: span(20 * K, 1 * Qa, 4),
    requires: 'discount',
    show: (r) => pct(FREE_CHANCE[r]),
  }),
  upgrade({
    id: 'early',
    path: 'shop',
    name: 'Early print',
    label: 'Book XP per level',
    at: [0.5, 2],
    prices: span(100 * K, 100 * T, 3),
    requires: 'loyalty',
    show: (r) => pct(EARLY[r]),
  }),
  ...BOOKS.flatMap((b, i) => {
    const base = Math.max(500, b.price),
      help = HELPERS[b.id];
    return [
      upgrade({
        id: `${b.id}-prize`,
        path: 'books',
        name: b.name,
        label: `${b.name} prizes`,
        at: [0, i],
        book: b.id,
        prices: [base, base * 30, base * 900].filter((p) => p < 1e18),
        show: (r) => times(BOOK_BOOST ** r),
      }),
      upgrade({
        id: `${b.id}-help`,
        path: 'books',
        name: help.name,
        label: help.label,
        at: [1, i],
        book: b.id,
        requires: `${b.id}-prize`,
        prices: [base * 2, base * 60, base * 1800]
          .slice(0, help.ranks)
          .filter((p) => p < 1e18),
        show: help.show,
      }),
    ];
  }),
  upgrade({
    id: 'printers',
    path: 'factory',
    name: 'Fast printers',
    label: 'Print speed',
    at: [0.5, 0],
    prices: span(3 * K, 1 * Qa, 8),
    show: (r) => times(Math.round(1.5 ** r * 10) / 10),
  }),
  upgrade({
    id: 'bots',
    path: 'factory',
    name: 'Fast bots',
    label: 'Bot speed',
    at: [0, 1],
    prices: span(5 * K, 2 * Qa, 8),
    requires: 'printers',
    show: (r) => times(Math.round(1.5 ** r * 10) / 10),
  }),
  upgrade({
    id: 'sales',
    path: 'factory',
    name: 'Salesmanship',
    label: 'Factory sales',
    at: [1, 1],
    prices: span(100 * K, 10 * Qa, 4),
    requires: 'printers',
    show: (r) => times(SALES ** r),
  }),
  upgrade({
    id: 'cashiers',
    path: 'factory',
    name: 'Clever bots',
    label: 'Bot skill',
    at: [0, 2],
    prices: span(50 * K, 100 * T, 5),
    requires: 'bots',
    show: (r) => pct(botSkill(r)),
  }),
  upgrade({
    id: 'wholesale',
    path: 'factory',
    name: 'Wholesale',
    label: 'Machine prices',
    at: [1, 2],
    prices: span(200 * K, 1 * Qa, 3),
    requires: 'sales',
    show: (r) => (r ? `−${r * 20}%` : 'full'),
  }),
  upgrade({
    id: 'floor',
    path: 'factory',
    name: 'Bigger floor',
    label: 'Floor size',
    at: [0.5, 3],
    prices: span(20 * K, 1 * T, 4),
    requires: 'cashiers',
    show: (r) => FLOOR_SIZES[r].join(' × '),
  }),
];
export type ScratchState = {
  version: 5;
  upgrades: Record<string, number>;
  unlocked: PackId[];
  /** The ticket each player holds: being scratched, or just paid out. */
  hands: Record<string, ScratchTicket>;
  /** Perfect tickets in a row, per player. */
  streaks: Record<string, number>;
  nextId: number;
  completed: number;
  earned: number;
  activeMs: number;
  /** Tickets finished per book. */
  books: Partial<Record<PackId, number>>;
  /** Book XP per book, shared by the desk: it sets the book level, which
   * opens the difficulties (`bookExperience`, `levelOpen`). */
  xp: Partial<Record<PackId, number>>;
  /** Version 4 and older: difficulty III tickets per book, read once by the
   * migration to XP. */
  top?: Partial<Record<PackId, number>>;
  /** Recent purchases, level-ups and payouts, newest last, for the other
   * players' notifications. */
  feed?: FeedEntry[];
  feedId?: number;
  best: number;
  migrationCredit: number;
  factory: FactoryState;
  /** Tickets bought since the Loyalty card last gave one free. */
  punches?: number;
};
export type FeedEntry = {
  id: number;
  at: number;
  /** The member who did it. */
  by: string;
  kind:
    | 'book'
    | 'upgrade'
    | 'blueprint'
    | 'machine'
    | 'win'
    | 'level'
    | 'infinity'
    | 'max';
  /** A book, upgrade, blueprint or machine id. */
  what: string;
  /** The upgrade's new rank, the book level reached minus one ('level'),
   * the ticket's difficulty ('win'), 3 ('infinity'), or how many machines. */
  n?: number;
  /** What a ticket paid and what it cost. */
  amount?: number;
  cost?: number;
};
/** Keeps the last few entries: enough for everyone polling to see each one. */
export function announce(s: ScratchState, entry: Omit<FeedEntry, 'id'>) {
  s.feedId = (s.feedId ?? 0) + 1;
  s.feed = [...(s.feed ?? []), { id: s.feedId, ...entry }].slice(-24);
}
export type ScratchHost = {
  scratch?: ScratchState;
  arcade?: unknown;
  coins: number;
  earned: number;
  seed: number;
};
export type ScratchPoint = { x: number; y: number };
export type ScratchAction =
  /** Buys a ticket into your hand. */
  | { type: 'scratch-open'; pack: PackId; level?: number }
  | {
      type: 'scratch-stroke';
      ticket: number;
      sequence: number;
      tool?: 'coin';
      points: ScratchPoint[];
      /** Points that start a new stroke (see `rubTicket`). */
      breaks?: number[];
    }
  | { type: 'scratch-book'; pack: PackId }
  | { type: 'scratch-upgrade'; id: string };
export type ScratchResult = {
  scratchCost?: number;
  scratchFree?: boolean;
  scratchCoins?: number;
  scratchComplete?: boolean;
  scratchPerfect?: boolean;
  scratchReveals?: number;
};
export function createScratch(): ScratchState {
  return {
    version: 5,
    upgrades: {},
    unlocked: ['seven'],
    hands: {},
    streaks: {},
    nextId: 1,
    completed: 0,
    earned: 0,
    activeMs: 0,
    books: {},
    xp: {},
    feed: [],
    feedId: 0,
    best: 0,
    migrationCredit: 0,
    factory: createFactory(),
  };
}

// ---- Saves ---------------------------------------------------------------

/** Books before 25 September 2026, in order; each maps to the new book in
 * the same place on the shelf. */
const OLD_BOOKS = [
  'pocket',
  'ribbon',
  'garden',
  'twins',
  'grain',
  'lantern',
  'atlas',
  'crown',
];
const renamed = (id: string) =>
  BOOKS[OLD_BOOKS.indexOf(id)]?.id ??
  (BOOKS.some((b) => b.id === id) ? (id as PackId) : 'seven');
const OLD_INSURANCE = span(8 * K, 10 * T, 3);
/** Version 2 upgrade prices, refunded rank by rank. The floor keeps its rank. */
const OLD_UPGRADES: Record<string, [number, number]> = {
  coin: [40, 2.2],
  foil: [300, 2.6],
  quick: [25_000, 4],
  lucky: [60, 2.3],
  star: [800, 2.5],
  jackpot: [60_000, 4],
  value: [25, 1.9],
  foilpay: [500, 2.4],
  tenth: [20_000, 5],
  golden: [50_000_000, 6],
  bonus: [800, 2.4],
  steady: [6_000, 3],
  streak: [50_000, 2.8],
  printers: [2_000, 2.1],
  bots: [3_000, 2.1],
  cashiers: [5_000, 2.2],
};
type OldScratch = {
  version: 1 | 2;
  skills?: Record<string, number>;
  upgrades?: Record<string, number>;
  unlocked?: string[];
  nextId?: number;
  completed?: number;
  earned?: number;
  activeMs?: number;
  books?: Record<string, number>;
  best?: number;
  migrationCredit?: number;
  tickets?: Record<string, { pack?: string }>;
  factory?: FactoryState;
};
const count = (raw: unknown, max: number) =>
  typeof raw === 'number' && Number.isFinite(raw)
    ? Math.max(0, Math.min(max, Math.floor(raw)))
    : 0;
/** Version 1 had a 72-node atlas; version 2 had small upgrades and one
 * ticket per player. Books stay unlocked, every rank is refunded at the price
 * paid, the factory keeps its machines, and unfinished tickets are retired. */
function migrate(g: ScratchHost, old: OldScratch): ScratchState {
  const s = createScratch();
  let refund = 0;
  const open = new Set<string>(['pocket', ...(old.unlocked ?? [])]);
  if (old.version === 1) {
    const branches = ['tools', 'fortune', 'craft', 'press', 'album', 'mastery'];
    const oneTime: Record<string, number> = {
      press: 160,
      reclaim: 420,
      streak: 1600,
      album: 9000,
      double: 24000,
      guide: 48000,
      master: 350000,
    };
    for (const [id, raw] of Object.entries(old.skills ?? {})) {
      const n = count(raw, 12);
      if (!n) continue;
      const feature = /^feature-(\w+)$/.exec(id)?.[1];
      if (feature) {
        if (OLD_BOOKS.includes(feature)) open.add(feature);
        else refund += oneTime[feature] ?? 0;
        continue;
      }
      const match = /^(\w+)-(\d)$/.exec(id),
        b = branches.indexOf(match?.[1] ?? '');
      if (!match || b < 0) continue;
      const cost = Math.ceil((16 + b * 6) * 2.65 ** Number(match[2]));
      for (let r = 0; r < n; r++) refund += Math.ceil(cost * 1.42 ** r);
    }
    for (const t of Object.values(old.tickets ?? {}))
      if (t?.pack) open.add(t.pack);
  } else {
    for (const [id, raw] of Object.entries(old.upgrades ?? {})) {
      if (id === 'floor') {
        s.upgrades.floor = count(raw, FLOOR_SIZES.length - 1);
        continue;
      }
      const price = OLD_UPGRADES[id];
      if (!price) continue;
      for (let r = 0; r < count(raw, 60); r++)
        refund += Math.ceil(price[0] * price[1] ** r);
    }
  }
  s.unlocked = BOOKS.filter(
    (b, i) => open.has(OLD_BOOKS[i]) || open.has(b.id),
  ).map((b) => b.id);
  if (!s.unlocked.includes('seven')) s.unlocked.unshift('seven');
  s.nextId = count(old.nextId, 1e12) || 1;
  s.completed = count(old.completed, 1e15);
  s.earned = Math.max(0, Number(old.earned) || 0);
  s.activeMs = Math.max(0, Number(old.activeMs) || 0);
  for (const [id, n] of Object.entries(old.books ?? {})) {
    const to = renamed(id);
    s.books[to] = (s.books[to] ?? 0) + count(n, 1e12);
  }
  s.best = Math.max(0, Number(old.best) || 0);
  if (old.factory) {
    s.factory = old.factory;
    for (const m of s.factory.machines) {
      if (m.book) m.book = renamed(m.book);
      for (const item of [m.item, m.output, ...(m.hold ?? [])])
        if (item) item.book = renamed(item.book);
    }
  }
  s.migrationCredit = (Number(old.migrationCredit) || 0) + refund;
  g.coins = Math.min(1e18, g.coins + refund);
  migrateBookXp(s);
  return s;
}
/** Version 4 and older counted tickets: books opened II and III after 8 and
 * 25 tickets, then difficulty III tickets (`top`) raised the level by 15, 30,
 * 45... Each book gets the XP that puts it at the same level with the same
 * fraction of the way to the next one, so books past level 3 keep ∞ open. */
function migrateBookXp(s: ScratchState) {
  s.xp = {};
  for (const b of BOOKS) {
    const played = count(s.books[b.id], 1e15);
    const opened =
      played >= levelAt(s, 2) ? 2 : played >= levelAt(s, 1) ? 1 : 0;
    if (opened < 2) {
      s.xp[b.id] =
        bookXpAt(s, opened + 1) +
        (played - levelAt(s, opened)) * XP_SCALE * xpWeight(opened);
      continue;
    }
    const top = count(s.top?.[b.id], Number.MAX_SAFE_INTEGER),
      step = bookStep(s),
      ranks = triangularRank(top, step);
    s.xp[b.id] = Math.min(
      Number.MAX_SAFE_INTEGER,
      bookXpAt(s, 3 + ranks) +
        (top - (step * ranks * (ranks + 1)) / 2) * XP_SCALE,
    );
  }
  delete s.top;
  (s as { version: number }).version = 5;
}
export function scratchFor(g: ScratchHost): ScratchState {
  const version = (g.scratch as { version?: number } | undefined)?.version;
  if (version === 1 || version === 2)
    g.scratch = migrate(g, g.scratch as unknown as OldScratch);
  if (version === 3) {
    // Tables of free tickets became one bought ticket in hand; the free
    // tickets still on the tables are retired and nothing else changes.
    const old = g.scratch as unknown as {
      tickets?: unknown;
      hands: Record<string, ScratchTicket>;
      version: number;
    };
    delete old.tickets;
    old.hands = {};
    old.version = 4;
  }
  if (!g.scratch) {
    g.scratch = createScratch();
    // Keep the shared purse and refund the old room investments once. Old saved
    // state is accepted only as migration input; it never runs another room.
    const old = g.arcade as
      | {
          skills?: Record<string, number>;
          rooms?: Record<string, { unlocked?: boolean }>;
        }
      | undefined;
    const legacy = [
      ['power', 25, 8],
      ['focus', 45, 4],
      ['auto', 60, 8],
      ['combo', 110, 5],
      ['double', 160, 3],
      ['yield', 120, 6],
      ['link', 220, 5],
      ['pierce', 360, 4],
      ['bounty', 420, 4],
      ['mastery', 900, 5],
    ] as const;
    for (const [roomIndex, room] of ['darts', 'forge', 'bells'].entries()) {
      if (old?.rooms?.[room]?.unlocked)
        g.scratch.migrationCredit += [0, 350, 1500][roomIndex];
      for (const [id, base, max] of legacy) {
        const n = count(old?.skills?.[`${room}-${id}`], max);
        for (let i = 0; i < n; i++)
          g.scratch.migrationCredit += Math.ceil(
            base * (1 + roomIndex * 2) * 1.85 ** i,
          );
      }
    }
    g.coins = Math.min(1e18, g.coins + g.scratch.migrationCredit);
    delete g.arcade;
  }
  if (version === 3 || version === 4) migrateBookXp(g.scratch);
  g.scratch.xp ??= {};
  g.scratch.factory ??= createFactory();
  // Insurance (until 9 October 2026) gave back part of a losing ticket; a
  // ticket can now simply lose. Its ranks are refunded and the Loyalty card
  // takes its place in the shop.
  const insured = count(g.scratch.upgrades.insurance, OLD_INSURANCE.length);
  if (insured) {
    const refund = OLD_INSURANCE.slice(0, insured).reduce((a, b) => a + b, 0);
    g.coins = Math.min(1e18, g.coins + refund);
  }
  delete g.scratch.upgrades.insurance;
  const factoryRefund = migrateFactory(g.scratch.factory);
  if (factoryRefund) g.coins = Math.min(1e18, g.coins + factoryRefund);
  return g.scratch;
}

// ---- Economy -------------------------------------------------------------

export function level(s: ScratchState, id: string) {
  return s.upgrades[id] ?? 0;
}
export function upgradeFor(id: string) {
  return UPGRADES.find((u) => u.id === id);
}
export function upgradeCost(s: ScratchState, u: Upgrade) {
  return u.prices[level(s, u.id)] ?? Infinity;
}
export function upgradeReady(s: ScratchState, u: Upgrade) {
  return (
    (!u.requires || level(s, u.requires) > 0) &&
    (!u.book || packOpen(s, u.book)) &&
    (u.path !== 'factory' || s.factory.blueprints.includes('starter'))
  );
}
export function packOpen(s: ScratchState, id: PackId) {
  return s.unlocked.includes(id);
}
/** Books are bought in order: the next locked book is the only one for sale. */
export function nextBook(s: ScratchState) {
  return BOOKS.find((p) => !packOpen(s, p.id));
}
/** Careful tickets' worth of XP before difficulty `k` (I, II, III) opens,
 * shortened by Early print. */
export function levelAt(s: ScratchState, k: number) {
  if (k < 0 || k >= LEVEL_AT.length) return Infinity;
  return Math.ceil(
    LEVEL_AT[k] * EARLY[Math.min(level(s, 'early'), EARLY.length - 1)],
  );
}
/** Careful ∞ tickets' worth of XP for book level 4; later levels need two,
 * three, four... times as much. */
function bookStep(s: ScratchState) {
  return Math.ceil(
    BOOK_LEVEL_STEP * EARLY[Math.min(level(s, 'early'), EARLY.length - 1)],
  );
}
/** How many triangular steps (step, 2·step, 3·step...) fit in `total`. */
function triangularRank(total: number, step: number) {
  // Inverted in constant time, even for very large totals.
  let ranks = Math.floor((Math.sqrt(1 + (8 * total) / step) - 1) / 2);
  const threshold = (rank: number) => (step * rank * (rank + 1)) / 2;
  if (threshold(ranks + 1) <= total) ranks++;
  if (threshold(ranks) > total) ranks--;
  return Math.max(0, ranks);
}
/** A difficulty's share of a full XP unit (`XP_WEIGHTS`). */
export function xpWeight(lvl: number): number {
  return XP_WEIGHTS[
    Math.max(0, Math.min(XP_WEIGHTS.length - 1, Math.floor(lvl) || 0))
  ];
}
/** The book XP at which book level `bookLvl` starts: level 2 after 8 careful
 * difficulty I tickets (10 XP each), level 3 after 17 careful II tickets
 * (25 XP each), then 15, 30, 45... careful ∞ tickets (100 XP each) per level.
 * Early print shortens every step. */
export function bookXpAt(s: ScratchState, bookLvl: number): number {
  const lvl = Math.floor(bookLvl);
  if (lvl <= 1) return 0;
  const second = levelAt(s, 1) * XP_SCALE * xpWeight(0);
  if (lvl === 2) return second;
  const third =
      second + (levelAt(s, 2) - levelAt(s, 1)) * XP_SCALE * xpWeight(1),
    ranks = lvl - 3;
  return third + (bookStep(s) * XP_SCALE * ranks * (ranks + 1)) / 2;
}
/** The desk's book XP for one book: a whole number, never negative. */
export function bookXp(s: ScratchState, id: PackId) {
  return count(s.xp?.[id], Number.MAX_SAFE_INTEGER);
}
/** The book level and the XP gathered toward the next one (`current` of
 * `needed`, whole numbers). Levels never stop; each beyond 3 adds
 * `BOOK_LEVEL_GAIN` to prizes and prices. */
export function bookExperience(
  s: ScratchState,
  id: PackId,
): { level: number; current: number; needed: number } {
  const xp = bookXp(s, id),
    second = bookXpAt(s, 2),
    third = bookXpAt(s, 3);
  if (xp < second) return { level: 1, current: xp, needed: second };
  if (xp < third)
    return { level: 2, current: xp - second, needed: third - second };
  const step = bookStep(s) * XP_SCALE,
    beyond = xp - third,
    ranks = triangularRank(beyond, step);
  return {
    level: 3 + ranks,
    current: beyond - (step * ranks * (ranks + 1)) / 2,
    needed: step * (ranks + 1),
  };
}
export function bookLevel(s: ScratchState, id: PackId) {
  return bookExperience(s, id).level;
}
/** The highest difficulty open for a book: II at book level 2, III at 3 and
 * ∞ (3) at `INFINITY_AT`. Any easier difficulty can still be chosen. */
export function levelOpen(s: ScratchState, id: PackId): 0 | 1 | 2 | 3 {
  const lvl = bookLevel(s, id);
  return lvl >= INFINITY_AT ? 3 : lvl >= 3 ? 2 : lvl >= 2 ? 1 : 0;
}
/** Book XP still missing before difficulty `k` opens (0 once it is open). */
export function xpToOpen(s: ScratchState, id: PackId, k: number) {
  const at = DIFFICULTY_AT[Math.max(0, Math.min(DIFFICULTY_AT.length - 1, k))];
  return Math.max(0, bookXpAt(s, at) - bookXp(s, id));
}
/** Book XP still missing before difficulty ∞ opens, for its lock. */
export function xpToInfinity(s: ScratchState, id: PackId) {
  return xpToOpen(s, id, 3);
}
/** The difficulty factory printers print and bots play: the highest open,
 * but never ∞, which stays a hand-played ticket. */
export function printLevel(s: ScratchState, id: PackId) {
  return Math.min(LEVEL_AT.length - 1, levelOpen(s, id));
}
export function bookBonus(s: ScratchState, id: PackId) {
  return 1 + Math.max(0, bookLevel(s, id) - 3) * BOOK_LEVEL_GAIN;
}
export function levelProgress(s: ScratchState, id: PackId) {
  const { current, needed } = bookExperience(s, id);
  return Math.max(0, Math.min(1, current / needed));
}
/** A difficulty's prize multiplier (`LEVEL_MULT`). Mastery raises the step
 * from I to II and II to III; ∞ adds its own fixed step on top of III. */
export function levelMult(mastery: number, lvl: number) {
  const d = Math.max(0, Math.min(LEVEL_MULT.length - 1, Math.floor(lvl) || 0));
  return (
    (LEVEL_MULT[1] + mastery * 0.5) ** Math.min(2, d) *
    (d === 3 ? LEVEL_MULT[3] / LEVEL_MULT[2] : 1)
  );
}
export function brushRadius(s: ScratchState) {
  return 0.03 * COIN_SIZES[Math.min(level(s, 'coin'), COIN_SIZES.length - 1)];
}
export function foilOpens(s: ScratchState) {
  return FOIL_OPENS[Math.min(level(s, 'foil'), FOIL_OPENS.length - 1)];
}
export function starChance(rank: number) {
  return rank ? 0.02 + rank * 0.04 : 0.02;
}
export function starPays(s: ScratchState) {
  return STAR_PAYS[Math.min(level(s, 'starpower'), STAR_PAYS.length - 1)];
}
export function jackpot(s: ScratchState) {
  return JACKPOTS[Math.min(level(s, 'jackpot'), JACKPOTS.length - 1)];
}
export function botSkill(rank: number) {
  return 0.5 + rank * 0.1;
}
/** What one prize unit on this ticket is worth. */
export function prizeUnit(s: ScratchState, id: PackId, lvl: number) {
  return (
    bookFor(id).value *
    bookBonus(s, id) *
    levelMult(level(s, 'mastery'), lvl) *
    2 ** level(s, 'value') *
    2 ** level(s, 'golden') *
    BOOK_BOOST ** level(s, `${id}-prize`) *
    (1 + level(s, 'collector') * 0.05 * s.unlocked.length)
  );
}
export function streakBonus(s: ScratchState, streak: number) {
  return 1 + streak * STREAK_STEPS[Math.min(level(s, 'streak'), 3)];
}
/** A careful player's prize units on average, with the plain ×3 jackpot. */
function expectedUnits(id: PackId, lvl: number) {
  const [units, perfect] = AVERAGES[id]?.[lvl] ?? [10, 0];
  return units * (1 + perfect * (JACKPOTS[0] - 1));
}
/** How well a finished ticket was played, for book XP: the prize units it
 * won (golden seals and the jackpot upgrades left out, a perfect ticket's
 * plain ×3 jackpot kept, so hitting the jackpot is the big bonus) over what a
 * careful player wins on average at that book and difficulty. Half the
 * average or less (a losing ticket) earns nothing, the average earns 1, and
 * it stops at `QUALITY_CAP`. */
export function ticketQuality(t: ScratchTicket): number {
  if (!t.ended) return 0;
  const units =
    t.cells.reduce((sum, c) => sum + (c.paid ? c.prize : 0), 0) + t.bonus;
  const ratio =
    (units * (t.perfect ? JACKPOTS[0] : 1)) / expectedUnits(t.pack, t.level);
  if (!(ratio > 0.5)) return 0;
  return ratio < 1 ? 2 * ratio - 1 : Math.min(QUALITY_CAP, ratio);
}
/** The whole book XP a finished ticket earns: `XP_SCALE` × its difficulty's
 * weight × its quality, never more than the current level's whole step, so
 * one ticket can never skip a level. */
export function ticketXp(t: ScratchTicket, s: ScratchState): number {
  return Math.min(
    bookExperience(s, t.pack).needed,
    Math.round(XP_SCALE * xpWeight(t.level) * ticketQuality(t)),
  );
}
/** What a ticket costs: half of what a careful player wins with it on
 * average, so a careless or unlucky ticket can lose. Richer prizes raise the
 * stakes; the jackpot, stars, streaks and the shop tilt the odds. */
export function ticketPrice(s: ScratchState, id: PackId, lvl: number) {
  return Math.max(
    1,
    Math.round(
      prizeUnit(s, id, lvl) *
        expectedUnits(id, lvl) *
        PRICE_SHARE *
        (1 - DISCOUNTS[Math.min(level(s, 'discount'), DISCOUNTS.length - 1)]),
    ),
  );
}
/** The house gives a Lucky Seven I when the purse cannot pay for one. */
export function houseTicket(
  s: ScratchState,
  coins: number,
  id: PackId,
  lvl: number,
) {
  return id === 'seven' && lvl === 0 && coins < ticketPrice(s, id, 0);
}
/** The Loyalty card's free ticket is the next one. */
export function loyaltyDue(s: ScratchState) {
  const every = LOYALTY[Math.min(level(s, 'loyalty'), LOYALTY.length - 1)];
  return every > 0 && (s.punches ?? 0) >= every - 1;
}
/** Seconds a ticket may take for the quick-hands bonus. */
export function quickSeconds(t: ScratchTicket) {
  return 8 + t.cells.length * 0.8;
}
/** Hearts still left when a ticket ends. */
export function heartsLeft(t: ScratchTicket) {
  return Math.max(0, t.lives - t.mistakes);
}
/** A finished ticket's coins. */
export function ticketReward(t: ScratchTicket, s: ScratchState, streak = 0) {
  const quick =
    t.quick && level(s, 'quick')
      ? 1 + QUICK_BONUS[Math.min(level(s, 'quick'), 3)]
      : 1;
  const hearts =
    1 + heartsLeft(t) * HEART_BONUS[Math.min(level(s, 'hearts'), 4)];
  return Math.floor(
    prizeUnit(s, t.pack, t.level) *
      prizeUnits(t) *
      (t.perfect ? jackpot(s) : 1) *
      (t.star ? starPays(s) : 1) *
      streakBonus(s, streak) *
      quick *
      hearts,
  );
}
/** Average prize units and perfect rate per difficulty (I, II, III, ∞) for a
 * careful player, measured with `suggest` over 2 000 tickets each. */
export const AVERAGES: Record<PackId, [number, number][]> = {
  seven: [
    [18, 1],
    [29, 0.92],
    [32.5, 0.35],
    [39, 0.13],
  ],
  twins: [
    [57.5, 1],
    [57.5, 1],
    [57.5, 1],
    [72, 1],
  ],
  path: [
    [26, 1],
    [41, 1],
    [53, 0.82],
    [42, 0.4],
  ],
  ladder: [
    [12, 0.27],
    [21, 0.14],
    [22, 0.07],
    [24, 0.06],
  ],
  mine: [
    [29.5, 0.6],
    [36, 0.38],
    [40, 0.19],
    [38, 0.1],
  ],
  sunmoon: [
    [34.5, 1],
    [41.5, 1],
    [47, 1],
    [81.5, 1],
  ],
  chart: [
    [31, 0.95],
    [45.5, 0.9],
    [49, 0.58],
    [56, 0.41],
  ],
  crown: [
    [36, 1],
    [42, 1],
    [48, 1],
    [48, 1],
  ],
};
/** What a factory bot's ticket pays on average: a bot plays the book's
 * `printLevel` (never ∞), at its skill, without stars or streaks. */
export function botReward(s: ScratchState, id: PackId) {
  const lvl = printLevel(s, id),
    [units, perfect] = AVERAGES[id]?.[lvl] ?? [10, 0];
  const skill = botSkill(level(s, 'cashiers'));
  return (
    prizeUnit(s, id, lvl) *
    units *
    skill *
    (1 + perfect * skill * (jackpot(s) - 1)) *
    SALES ** level(s, 'sales')
  );
}
function random(g: ScratchHost) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
export function earn(g: ScratchHost, amount: number) {
  const n = Math.max(0, Math.min(1e18 - g.coins, amount));
  g.coins += n;
  g.earned = Math.min(1e18, g.earned + n);
  scratchFor(g).earned += n;
}

// ---- Scratching ----------------------------------------------------------

/** Most points one stroke command may carry; the browser merges queued
 * batches up to this, so a slow connection never builds a backlog. */
export const STROKE_POINTS = 300;
/** The foil is an 8x8 bitmap per seal. Both ends of every movement segment are
 * sampled geometrically, so fast strokes never leave holes or teleport
 * scratches. A seal that comes open applies its book's rule at once; once the
 * ticket is over the rest of the stroke does nothing. Locked seals keep their
 * foil. `breaks` lists the points that start a new stroke: the coin was
 * lifted before them, so no segment joins them to the point before. */
export function rubTicket(
  ticket: ScratchTicket,
  s: ScratchState,
  points: ScratchPoint[],
  breaks: readonly number[] = [],
) {
  const radius = brushRadius(s),
    threshold = Math.ceil(MASK_SIDE ** 2 * foilOpens(s)),
    { cols, rows } = ticket;
  // The centres of a seal's foil bits span this much of its cell.
  const inset = 0.1 + 0.4 / MASK_SIDE;
  let reveals = 0;
  for (let p = 0; p < points.length && !ticket.ended; p++) {
    const a = points[p && !breaks.includes(p) ? p - 1 : p],
      b = points[p],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    const left = Math.min(a.x, b.x),
      right = Math.max(a.x, b.x),
      top = Math.min(a.y, b.y),
      bottom = Math.max(a.y, b.y);
    const candidates: { index: number; along: number }[] = [];
    ticket.cells.forEach((cell, index) => {
      if (cell.revealed || sealLocked(ticket, index)) return;
      const col = index % cols,
        row = Math.floor(index / cols);
      // A seal beyond the coin's reach keeps its foil; it only needs counting.
      const gapX = Math.max(
          0,
          (col + inset) / cols - right,
          left - (col + 1 - inset) / cols,
        ),
        gapY = Math.max(
          0,
          (row + inset) / rows - bottom,
          top - (row + 1 - inset) / rows,
        );
      if (gapX * gapX + gapY * gapY > radius * radius) {
        let rubbed = 0;
        for (let bit = 0; bit < cell.mask.length; bit++)
          if (cell.mask.charCodeAt(bit) === 49) rubbed++;
        if (rubbed >= threshold) {
          const cx = (col + 0.5) / cols,
            cy = (row + 0.5) / rows;
          candidates.push({
            index,
            along: length ? ((cx - a.x) * dx + (cy - a.y) * dy) / length : 0,
          });
        }
        return;
      }
      const mask = cell.mask.split('');
      let rubbed = 0;
      for (let bit = 0; bit < mask.length; bit++) {
        if (mask[bit] === '1') {
          rubbed++;
          continue;
        }
        // Match the inset foil rectangle drawn by ScratchSurface.
        const x =
          (col + 0.1 + (((bit % MASK_SIDE) + 0.5) / MASK_SIDE) * 0.8) / cols;
        const y =
          (row +
            0.1 +
            ((Math.floor(bit / MASK_SIDE) + 0.5) / MASK_SIDE) * 0.8) /
          rows;
        const along = length
          ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length))
          : 0;
        if (Math.hypot(x - a.x - dx * along, y - a.y - dy * along) > radius)
          continue;
        mask[bit] = '1';
        rubbed++;
      }
      cell.mask = mask.join('');
      if (rubbed >= threshold) {
        const cx = (col + 0.5) / cols,
          cy = (row + 0.5) / rows;
        candidates.push({
          index,
          along: length ? ((cx - a.x) * dx + (cy - a.y) * dy) / length : 0,
        });
      }
    });
    for (const { index } of candidates.sort((a, b) => a.along - b.along)) {
      if (ticket.ended) break;
      if (openSeal(ticket, index)) reveals++;
    }
  }
  return reveals;
}
/** Tells the desk a book gained a level ('level', `n` is the level minus
 * one) and, the first time, that its ∞ difficulty opened ('infinity'). */
function announceBookProgress(
  s: ScratchState,
  id: PackId,
  before: { level: number; open: number },
  actor: string,
  now: number,
) {
  const reached = bookLevel(s, id);
  if (reached > before.level)
    announce(s, {
      at: now,
      by: actor,
      kind: 'level',
      what: id,
      n: reached - 1,
    });
  if (before.open < 3 && levelOpen(s, id) === 3)
    announce(s, { at: now, by: actor, kind: 'infinity', what: id, n: 3 });
}
/** Pays a finished ticket and adds the book XP it earned, once. */
function settle(
  g: ScratchHost,
  s: ScratchState,
  t: ScratchTicket,
  actor: string,
  now: number,
) {
  const streak = s.streaks[actor] ?? 0;
  t.quick = now - (t.bornAt ?? now) <= quickSeconds(t) * 1000;
  t.payout = ticketReward(t, s, streak);
  t.claimed = true;
  s.streaks[actor] = t.perfect ? Math.min(10, streak + 1) : 0;
  s.completed++;
  const before = { level: bookLevel(s, t.pack), open: levelOpen(s, t.pack) };
  t.xp = ticketXp(t, s);
  s.xp[t.pack] = Math.min(Number.MAX_SAFE_INTEGER, bookXp(s, t.pack) + t.xp);
  s.books[t.pack] = (s.books[t.pack] ?? 0) + 1;
  s.best = Math.max(s.best, t.payout);
  earn(g, t.payout);
  announce(s, {
    at: now,
    by: actor,
    kind: 'win',
    what: t.pack,
    n: t.level,
    amount: t.payout,
    cost: t.cost ?? 0,
  });
  announceBookProgress(s, t.pack, before, actor, now);
}
export function handFor(s: ScratchState, actor: string) {
  return s.hands[actor] as ScratchTicket | undefined;
}
export function actScratch(
  g: ScratchHost,
  action: ScratchAction,
  actorId: string,
  now: number,
): ScratchResult {
  const s = scratchFor(g);
  if (action.type === 'scratch-upgrade') {
    const u = upgradeFor(action.id);
    if (!u || level(s, u.id) >= u.max)
      throw new Error('That upgrade is complete or unknown.');
    if (!upgradeReady(s, u))
      throw new Error('Buy the upgrade before it first.');
    const cost = upgradeCost(s, u);
    if (g.coins < cost) throw new Error('You need more coins for that.');
    // Early print shortens every level, so books may level up at once.
    const before =
      u.id === 'early'
        ? s.unlocked.map((id) => ({
            id,
            level: bookLevel(s, id),
            open: levelOpen(s, id),
          }))
        : [];
    g.coins -= cost;
    s.upgrades[u.id] = level(s, u.id) + 1;
    announce(s, {
      at: now,
      by: actorId,
      kind: 'upgrade',
      what: u.id,
      n: s.upgrades[u.id],
    });
    for (const b of before) announceBookProgress(s, b.id, b, actorId, now);
    return {};
  }
  if (action.type === 'scratch-book') {
    const next = nextBook(s);
    if (!next || next.id !== action.pack)
      throw new Error('Unlock the books in order.');
    if (g.coins < next.price) throw new Error('You need more coins for that.');
    g.coins -= next.price;
    s.unlocked.push(next.id);
    announce(s, { at: now, by: actorId, kind: 'book', what: next.id });
    return {};
  }
  const hand = handFor(s, actorId);
  if (action.type === 'scratch-open') {
    if (!BOOKS.some((p) => p.id === action.pack) || !packOpen(s, action.pack))
      throw new Error('Unlock that ticket book first.');
    const lvl = action.level ?? levelOpen(s, action.pack);
    if (!Number.isInteger(lvl) || lvl < 0 || lvl > levelOpen(s, action.pack))
      throw new Error('Play that book more to open this level.');
    if (hand && !hand.ended)
      throw new Error('Finish the ticket in your hand first.');
    const free = houseTicket(s, g.coins, action.pack, lvl),
      loyal = !free && loyaltyDue(s),
      price = ticketPrice(s, action.pack, lvl);
    if (!free && !loyal && g.coins < price)
      throw new Error('You need more coins for that ticket.');
    const lucky =
      !free &&
      !loyal &&
      level(s, 'freebie') > 0 &&
      random(g) < FREE_CHANCE[Math.min(level(s, 'freebie'), 4)];
    const cost = free || loyal || lucky ? 0 : price;
    // Bought tickets punch the Loyalty card; its free ticket starts it over.
    if (loyal) s.punches = 0;
    else if (cost) s.punches = (s.punches ?? 0) + 1;
    g.coins -= cost;
    const ticket = printTicket(
      s.nextId++,
      action.pack,
      lvl,
      () => random(g),
      {
        lives: level(s, 'extra'),
        gold: GOLD_CHANCE[Math.min(level(s, 'goldseal'), 4)],
        helper: level(s, `${action.pack}-help`),
      },
      now,
    );
    ticket.star = random(g) < starChance(level(s, 'star'));
    ticket.cost = cost;
    s.hands[actorId] = ticket;
    return { scratchCost: cost, scratchFree: lucky || free || loyal };
  }
  const ticket = hand?.id === action.ticket ? hand : undefined;
  if (!ticket) throw new Error('Your ticket changed. Your desk is refreshing.');
  if (action.type === 'scratch-stroke') {
    if (ticket.claimed) return { scratchComplete: true };
    if (action.tool !== undefined && action.tool !== 'coin')
      throw new Error('Scratch with the coin.');
    if (
      !Number.isInteger(action.sequence) ||
      action.sequence !== ticket.sequence
    )
      throw new Error('Your scratching is syncing. Try that stroke again.');
    if (
      !Array.isArray(action.points) ||
      action.points.length < 1 ||
      action.points.length > STROKE_POINTS ||
      action.points.some(
        (p) =>
          !p ||
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          p.x < 0 ||
          p.x > 1 ||
          p.y < 0 ||
          p.y > 1,
      )
    )
      throw new Error('Scratch inside the ticket.');
    const breaks = action.breaks ?? [];
    if (
      !Array.isArray(breaks) ||
      breaks.length > action.points.length ||
      breaks.some(
        (b, i) =>
          !Number.isInteger(b) ||
          b < 1 ||
          b >= action.points.length ||
          (i > 0 && b <= breaks[i - 1]),
      )
    )
      throw new Error('Scratch inside the ticket.');
    const revealed = ticket.ended
      ? 0
      : rubTicket(ticket, s, action.points, breaks);
    ticket.sequence++;
    ticket.lastAt = now;
    if (!ticket.ended) return { scratchReveals: revealed };
    settle(g, s, ticket, actorId, now);
    return {
      scratchReveals: revealed,
      scratchComplete: true,
      scratchCoins: ticket.payout,
      scratchPerfect: ticket.perfect,
    };
  }
  throw new Error('Unknown scratch action.');
}
