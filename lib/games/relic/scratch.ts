import { createFactory, type FactoryState } from './factory.ts';
import {
  BOOKS,
  LEVEL_AT,
  LEVEL_MULT,
  MASK_SIDE,
  bookFor,
  openSeal,
  prizeUnits,
  printTicket,
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
  show: (rank: number) => string;
};
export const FLOOR_SIZES = [
  [8, 5],
  [10, 6],
  [12, 7],
  [14, 8],
  [16, 9],
] as const;
export const COIN_SIZES = [1, 1.35, 1.75, 2.2] as const;
export const FOIL_OPENS = [0.72, 0.5, 0.3, 0.04] as const;
export const JACKPOTS = [3, 5, 8, 12, 20] as const;
export const STREAK_STEPS = [0, 0.1, 0.25, 0.5] as const;
/** Tickets waiting on one player's table. */
export const TABLE_MAX = 12;
const times = (n: number) => `×${n}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
/** Every upgrade names the one number it changes, and every rank is a big
 * step. Within a path each upgrade needs one rank of the upgrade before it. */
const K = 1e3,
  M = 1e6,
  B = 1e9,
  T = 1e12;
const upgrade = (u: Omit<Upgrade, 'max'>): Upgrade => ({
  ...u,
  max: u.prices.length,
});
export const UPGRADES: Upgrade[] = [
  upgrade({
    id: 'coin',
    path: 'scratch',
    name: 'Bigger coin',
    label: 'Coin size',
    prices: [200, 80 * K, 50 * M],
    show: (r) => times(COIN_SIZES[r]),
  }),
  upgrade({
    id: 'foil',
    path: 'scratch',
    name: 'Thin foil',
    label: 'Seal opens at',
    prices: [5 * K, 10 * M, 20 * B],
    requires: 'coin',
    show: (r) => (r === FOIL_OPENS.length - 1 ? 'a touch' : pct(FOIL_OPENS[r])),
  }),
  upgrade({
    id: 'value',
    path: 'payout',
    name: 'Richer prizes',
    label: 'Every prize',
    prices: [
      500,
      12.5 * K,
      300 * K,
      8 * M,
      200 * M,
      5 * B,
      120 * B,
      3 * T,
      80 * T,
      2000 * T,
      50_000 * T,
      1_200_000 * T,
    ],
    show: (r) => times(2 ** r),
  }),
  upgrade({
    id: 'jackpot',
    path: 'payout',
    name: 'Jackpot',
    label: 'Perfect ticket',
    prices: [20 * K, 5 * M, 2 * B, 1 * T],
    requires: 'value',
    show: (r) => times(JACKPOTS[r]),
  }),
  upgrade({
    id: 'golden',
    path: 'payout',
    name: 'Golden touch',
    label: 'All earnings',
    prices: [2 * M, 2 * B, 2 * T, 2000 * T],
    requires: 'jackpot',
    show: (r) => times(2 ** r),
  }),
  upgrade({
    id: 'extra',
    path: 'luck',
    name: 'Second chance',
    label: 'Extra mistakes',
    prices: [3 * K, 5 * M, 10 * B],
    show: (r) => `+${r}`,
  }),
  upgrade({
    id: 'star',
    path: 'luck',
    name: 'Star tickets',
    label: 'Star (×5) chance',
    prices: [30 * K, 5 * M, 1 * B, 200 * B, 40 * T],
    requires: 'extra',
    show: (r) => pct(starChance(r)),
  }),
  upgrade({
    id: 'streak',
    path: 'luck',
    name: 'Hot streak',
    label: 'Per perfect in a row',
    prices: [1 * M, 2 * B, 5 * T],
    requires: 'star',
    show: (r) => `+${pct(STREAK_STEPS[r])}`,
  }),
  upgrade({
    id: 'printers',
    path: 'factory',
    name: 'Fast printers',
    label: 'Print speed',
    prices: [3 * K, 90 * K, 2.7 * M, 80 * M, 2.4 * B, 72 * B, 2 * T, 65 * T],
    show: (r) => times(Math.round(1.5 ** r * 10) / 10),
  }),
  upgrade({
    id: 'bots',
    path: 'factory',
    name: 'Fast bots',
    label: 'Bot speed',
    prices: [
      5 * K,
      150 * K,
      4.5 * M,
      135 * M,
      4 * B,
      120 * B,
      3.6 * T,
      110 * T,
    ],
    requires: 'printers',
    show: (r) => times(Math.round(1.5 ** r * 10) / 10),
  }),
  upgrade({
    id: 'cashiers',
    path: 'factory',
    name: 'Clever bots',
    label: 'Bot skill',
    prices: [50 * K, 10 * M, 2 * B, 400 * B, 80 * T],
    requires: 'bots',
    show: (r) => pct(botSkill(r)),
  }),
  upgrade({
    id: 'floor',
    path: 'factory',
    name: 'Bigger floor',
    label: 'Floor size',
    prices: [20 * K, 5 * M, 1 * B, 300 * B],
    requires: 'cashiers',
    show: (r) => FLOOR_SIZES[r].join(' × '),
  }),
];
export type ScratchState = {
  version: 3;
  upgrades: Record<string, number>;
  unlocked: PackId[];
  /** Each player's table of tickets, oldest first. */
  tickets: Record<string, ScratchTicket[]>;
  /** Perfect tickets in a row, per player. */
  streaks: Record<string, number>;
  nextId: number;
  completed: number;
  earned: number;
  activeMs: number;
  /** Tickets finished per book; they open the book's levels. */
  books: Partial<Record<PackId, number>>;
  best: number;
  migrationCredit: number;
  factory: FactoryState;
};
export type ScratchHost = {
  scratch?: ScratchState;
  arcade?: unknown;
  coins: number;
  earned: number;
  seed: number;
};
export type ScratchPoint = { x: number; y: number };
export type ScratchAction =
  | { type: 'scratch-open'; pack: PackId; level?: number }
  | {
      type: 'scratch-stroke';
      ticket: number;
      sequence: number;
      tool?: 'coin';
      points: ScratchPoint[];
    }
  | { type: 'scratch-book'; pack: PackId }
  | { type: 'scratch-upgrade'; id: string };
export type ScratchResult = {
  scratchCoins?: number;
  scratchComplete?: boolean;
  scratchPerfect?: boolean;
  scratchReveals?: number;
};
export function createScratch(): ScratchState {
  return {
    version: 3,
    upgrades: {},
    unlocked: ['seven'],
    tickets: {},
    streaks: {},
    nextId: 1,
    completed: 0,
    earned: 0,
    activeMs: 0,
    books: {},
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
  return s;
}
export function scratchFor(g: ScratchHost): ScratchState {
  const version = (g.scratch as { version?: number } | undefined)?.version;
  if (version === 1 || version === 2)
    g.scratch = migrate(g, g.scratch as unknown as OldScratch);
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
/** The highest level of a book this desk has played its way into. */
export function levelOpen(s: ScratchState, id: PackId) {
  const played = s.books[id] ?? 0;
  return LEVEL_AT.filter((n) => played >= n).length - 1;
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
    LEVEL_MULT[Math.max(0, Math.min(2, lvl))] *
    2 ** level(s, 'value') *
    2 ** level(s, 'golden')
  );
}
export function streakBonus(s: ScratchState, streak: number) {
  return 1 + streak * STREAK_STEPS[Math.min(level(s, 'streak'), 3)];
}
/** A finished ticket's coins. */
export function ticketReward(t: ScratchTicket, s: ScratchState, streak = 0) {
  return Math.floor(
    prizeUnit(s, t.pack, t.level) *
      prizeUnits(t) *
      (t.perfect ? jackpot(s) : 1) *
      (t.star ? 5 : 1) *
      streakBonus(s, streak),
  );
}
/** Average prize units and perfect rate per book level for a careful player,
 * measured with `suggest` over 2 000 tickets each (scripts/lucky-averages). */
export const AVERAGES: Record<PackId, [number, number][]> = {
  seven: [
    [16, 1],
    [18, 1],
    [22, 0.2],
  ],
  twins: [
    [28, 1],
    [38, 1],
    [45, 0.7],
  ],
  path: [
    [15, 1],
    [26, 1],
    [41, 1],
  ],
  ladder: [
    [21, 1],
    [20, 0.5],
    [12, 0.2],
  ],
  mine: [
    [21, 0.75],
    [29, 0.55],
    [36, 0.4],
  ],
  sunmoon: [
    [13, 1],
    [36, 1],
    [47, 1],
  ],
  chart: [
    [28, 1],
    [44, 1],
    [44, 0.85],
  ],
  crown: [
    [30, 1],
    [36, 1],
    [42, 1],
  ],
};
/** What a factory bot's ticket pays on average: a bot plays the book's
 * highest open level, at its skill, without stars or streaks. */
export function botReward(s: ScratchState, id: PackId) {
  const lvl = levelOpen(s, id),
    [units, perfect] = AVERAGES[id]?.[lvl] ?? [10, 0];
  const skill = botSkill(level(s, 'cashiers'));
  return (
    prizeUnit(s, id, lvl) *
    units *
    skill *
    (1 + perfect * skill * (jackpot(s) - 1))
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

/** The foil is an 8x8 bitmap per seal. Both ends of every movement segment are
 * sampled geometrically, so fast strokes never leave holes or teleport
 * scratches. A seal that comes open applies its book's rule at once; once the
 * ticket is over the rest of the stroke does nothing. */
export function rubTicket(
  ticket: ScratchTicket,
  s: ScratchState,
  points: ScratchPoint[],
) {
  const radius = brushRadius(s),
    threshold = Math.ceil(MASK_SIDE ** 2 * foilOpens(s)),
    { cols, rows } = ticket;
  let reveals = 0;
  for (let p = 0; p < points.length && !ticket.ended; p++) {
    const a = points[p ? p - 1 : p],
      b = points[p],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    const candidates: { index: number; along: number }[] = [];
    ticket.cells.forEach((cell, index) => {
      if (cell.revealed) return;
      const col = index % cols,
        row = Math.floor(index / cols),
        mask = cell.mask.split('');
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
/** Pays a finished ticket once. */
function settle(
  g: ScratchHost,
  s: ScratchState,
  t: ScratchTicket,
  actor: string,
) {
  const streak = s.streaks[actor] ?? 0;
  t.payout = ticketReward(t, s, streak);
  t.claimed = true;
  s.streaks[actor] = t.perfect ? Math.min(10, streak + 1) : 0;
  s.completed++;
  s.books[t.pack] = (s.books[t.pack] ?? 0) + 1;
  s.best = Math.max(s.best, t.payout);
  earn(g, t.payout);
}
export function tableFor(s: ScratchState, actor: string) {
  return (s.tickets[actor] ??= []);
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
    g.coins -= cost;
    s.upgrades[u.id] = level(s, u.id) + 1;
    return {};
  }
  if (action.type === 'scratch-book') {
    const next = nextBook(s);
    if (!next || next.id !== action.pack)
      throw new Error('Unlock the books in order.');
    if (g.coins < next.price) throw new Error('You need more coins for that.');
    g.coins -= next.price;
    s.unlocked.push(next.id);
    return {};
  }
  const table = tableFor(s, actorId);
  if (action.type === 'scratch-open') {
    if (!BOOKS.some((p) => p.id === action.pack) || !packOpen(s, action.pack))
      throw new Error('Unlock that ticket book first.');
    const lvl = action.level ?? levelOpen(s, action.pack);
    if (!Number.isInteger(lvl) || lvl < 0 || lvl > levelOpen(s, action.pack))
      throw new Error('Play that book more to open this level.');
    if (table.filter((t) => !t.claimed).length >= TABLE_MAX)
      throw new Error('Your table is full. Scratch a ticket first.');
    const ticket = printTicket(
      s.nextId++,
      action.pack,
      lvl,
      () => random(g),
      level(s, 'extra'),
      now,
    );
    ticket.star = random(g) < starChance(level(s, 'star'));
    table.push(ticket);
    // Finished tickets stay briefly so their result can be shown.
    const done = table.filter((t) => t.claimed);
    for (const t of done.slice(0, Math.max(0, done.length - 3)))
      table.splice(table.indexOf(t), 1);
    return {};
  }
  const ticket = table.find((t) => t.id === action.ticket);
  if (!ticket)
    throw new Error('Your ticket changed. Your table is refreshing.');
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
      action.points.length > 80 ||
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
    const revealed = ticket.ended ? 0 : rubTicket(ticket, s, action.points);
    ticket.sequence++;
    ticket.lastAt = now;
    if (!ticket.ended) return { scratchReveals: revealed };
    settle(g, s, ticket, actorId);
    return {
      scratchReveals: revealed,
      scratchComplete: true,
      scratchCoins: ticket.payout,
      scratchPerfect: ticket.perfect,
    };
  }
  throw new Error('Unknown scratch action.');
}
