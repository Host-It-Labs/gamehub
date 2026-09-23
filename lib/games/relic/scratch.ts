import { createFactory, type FactoryState } from './factory.ts';
/** One shared scratch room. Rewards and scratch coverage are resolved here, on
 * the server; the browser uses the same geometry for immediate foil feedback. */
export const PACKS = [
  {
    id: 'pocket',
    name: 'Pocket Change',
    mechanic: 'luck',
    columns: 3,
    rows: 3,
    value: 1,
    price: 0,
    color: '#b55e40',
    hint: 'Scratch anywhere',
  },
  {
    id: 'ribbon',
    name: 'Silver Ribbons',
    mechanic: 'rows',
    columns: 4,
    rows: 3,
    value: 8,
    price: 600,
    color: '#527c91',
    hint: 'Each row, left to right',
  },
  {
    id: 'garden',
    name: 'Secret Garden',
    mechanic: 'trail',
    columns: 4,
    rows: 3,
    value: 60,
    price: 50_000,
    color: '#60865a',
    hint: 'Follow the numbers',
  },
  {
    id: 'twins',
    name: 'Twin Moons',
    mechanic: 'pairs',
    columns: 4,
    rows: 4,
    value: 450,
    price: 2_000_000,
    color: '#8472a7',
    hint: 'Reveal matching pairs',
  },
  {
    id: 'grain',
    name: 'Copper Grain',
    mechanic: 'grain',
    columns: 4,
    rows: 4,
    value: 4_000,
    price: 80_000_000,
    color: '#af7944',
    hint: 'Rub along the arrows',
  },
  {
    id: 'lantern',
    name: 'Lantern',
    mechanic: 'lantern',
    columns: 4,
    rows: 4,
    value: 40_000,
    price: 3_000_000_000,
    color: '#c98a2e',
    hint: 'Find the lantern first',
  },
  {
    id: 'atlas',
    name: 'Golden Atlas',
    mechanic: 'atlas',
    columns: 5,
    rows: 4,
    value: 400_000,
    price: 150_000_000_000,
    color: '#b7953f',
    hint: 'Numbers in order, along the arrows',
  },
  {
    id: 'crown',
    name: 'Crown Jewels',
    mechanic: 'treasure',
    columns: 5,
    rows: 4,
    value: 5_000_000,
    price: 8_000_000_000_000,
    color: '#a33a3f',
    hint: 'Numbers count nearby crowns',
  },
] as const;
export type PackId = (typeof PACKS)[number]['id'];
export type Pack = (typeof PACKS)[number];
export const SYMBOLS = [
  'sun',
  'moon',
  'leaf',
  'star',
  'shell',
  'diamond',
] as const;
export const PATHS = [
  { id: 'scratch', name: 'Scratching', color: '#75bcbe' },
  { id: 'luck', name: 'Luck', color: '#e9bb66' },
  { id: 'payout', name: 'Payouts', color: '#d98d75' },
  { id: 'craft', name: 'Technique', color: '#b69aca' },
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
  base: number;
  growth: number;
  requires?: string;
  show: (rank: number) => string;
};
const pct = (n: number) => `${Math.round(n * 10) / 10}%`;
export const FLOOR_SIZES = [
  [8, 5],
  [10, 6],
  [12, 7],
  [14, 8],
  [16, 9],
] as const;
/** Every upgrade names the one number it changes. Within a path each upgrade
 * needs one rank of the upgrade before it. */
export const UPGRADES: Upgrade[] = [
  {
    id: 'coin',
    path: 'scratch',
    name: 'Bigger coin',
    label: 'Coin size',
    max: 10,
    base: 40,
    growth: 2.2,
    show: (r) => pct(100 + r * 8),
  },
  {
    id: 'foil',
    path: 'scratch',
    name: 'Thin foil',
    label: 'Seal opens at',
    max: 8,
    base: 300,
    growth: 2.6,
    requires: 'coin',
    show: (r) => pct(72 - r * 3),
  },
  {
    id: 'quick',
    path: 'scratch',
    name: 'Quick finish',
    label: 'Rest clears at',
    max: 5,
    base: 25_000,
    growth: 4,
    requires: 'foil',
    show: (r) => (r ? pct(100 - r * 5) + ' open' : 'never'),
  },
  {
    id: 'lucky',
    path: 'luck',
    name: 'Lucky symbols',
    label: 'Big prize chance',
    max: 10,
    base: 60,
    growth: 2.3,
    show: (r) => pct((odds(r, 0).six + odds(r, 0).twelve) * 100),
  },
  {
    id: 'star',
    path: 'luck',
    name: 'Star tickets',
    label: 'Star (×3) chance',
    max: 10,
    base: 800,
    growth: 2.5,
    requires: 'lucky',
    show: (r) => pct(starChance(r) * 100),
  },
  {
    id: 'jackpot',
    path: 'luck',
    name: 'Jackpot',
    label: '×50 seal chance',
    max: 5,
    base: 60_000,
    growth: 4,
    requires: 'star',
    show: (r) => pct(odds(0, r).jackpot * 100),
  },
  {
    id: 'value',
    path: 'payout',
    name: 'Richer prizes',
    label: 'Prize value',
    max: 40,
    base: 25,
    growth: 1.9,
    show: (r) => pct(100 + r * 10),
  },
  {
    id: 'foilpay',
    path: 'payout',
    name: 'Foil refund',
    label: 'Foil pay',
    max: 10,
    base: 500,
    growth: 2.4,
    requires: 'value',
    show: (r) => pct(100 + r * 25),
  },
  {
    id: 'tenth',
    path: 'payout',
    name: 'Lucky tenth',
    label: 'Every 10th ticket',
    max: 5,
    base: 20_000,
    growth: 5,
    requires: 'foilpay',
    show: (r) => (r ? `×${1.5 + r * 0.5}` : '×1'),
  },
  {
    id: 'golden',
    path: 'payout',
    name: 'Golden touch',
    label: 'All earnings',
    max: 10,
    base: 50_000_000,
    growth: 6,
    requires: 'tenth',
    show: (r) => pct(100 + r * 25),
  },
  {
    id: 'bonus',
    path: 'craft',
    name: 'Craft bonus',
    label: 'Perfect technique',
    max: 10,
    base: 800,
    growth: 2.4,
    show: (r) => `+${pct(45 + r * 15)}`,
  },
  {
    id: 'steady',
    path: 'craft',
    name: 'Steady hand',
    label: 'Free technique',
    max: 5,
    base: 6_000,
    growth: 3,
    requires: 'bonus',
    show: (r) => `+${pct(r * 5)}`,
  },
  {
    id: 'streak',
    path: 'craft',
    name: 'Hot streak',
    label: 'Per streak step',
    max: 10,
    base: 50_000,
    growth: 2.8,
    requires: 'steady',
    show: (r) => `+${pct(r)}`,
  },
  {
    id: 'printers',
    path: 'factory',
    name: 'Fast printers',
    label: 'Print speed',
    max: 30,
    base: 2_000,
    growth: 2.1,
    show: (r) => pct(100 + r * 15),
  },
  {
    id: 'bots',
    path: 'factory',
    name: 'Fast bots',
    label: 'Bot speed',
    max: 30,
    base: 3_000,
    growth: 2.1,
    requires: 'printers',
    show: (r) => pct(100 + r * 15),
  },
  {
    id: 'cashiers',
    path: 'factory',
    name: 'Better cashiers',
    label: 'Factory sales',
    max: 30,
    base: 5_000,
    growth: 2.2,
    requires: 'bots',
    show: (r) => pct(100 + r * 10),
  },
  {
    id: 'floor',
    path: 'factory',
    name: 'Bigger floor',
    label: 'Floor size',
    max: FLOOR_SIZES.length - 1,
    base: 5_000,
    growth: 12,
    requires: 'cashiers',
    show: (r) => FLOOR_SIZES[r].join(' × '),
  },
];
export const MASK_SIDE = 8;
export type ScratchPoint = { x: number; y: number };
export type ScratchCell = {
  symbol: number;
  prize: number;
  mask: string;
  revealed: boolean;
  direction: 'h' | 'v';
  aligned: number;
  rubbed: number;
  /** The lantern of a lantern ticket, or a crown of a treasure ticket. */
  special?: boolean;
};
export type ScratchTicket = {
  id: number;
  pack: PackId;
  cells: ScratchCell[];
  trail: number[];
  order: number[];
  sequence: number;
  star: boolean;
  claimed: boolean;
  payout: number;
  quality: number;
  streak: number;
  lastAt: number;
};
export type ScratchState = {
  version: 2;
  upgrades: Record<string, number>;
  unlocked: PackId[];
  tickets: Record<string, ScratchTicket>;
  nextId: number;
  completed: number;
  earned: number;
  activeMs: number;
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
export type ScratchAction =
  | { type: 'scratch-open'; pack: PackId }
  | {
      type: 'scratch-stroke';
      ticket: number;
      sequence: number;
      tool?: 'coin';
      points: ScratchPoint[];
    }
  | { type: 'scratch-claim'; ticket: number }
  | { type: 'scratch-book'; pack: PackId }
  | { type: 'scratch-upgrade'; id: string };
export type ScratchResult = {
  scratchCoins?: number;
  scratchComplete?: boolean;
  scratchQuality?: number;
  scratchReveals?: number;
};
export function createScratch(): ScratchState {
  return {
    version: 2,
    upgrades: {},
    unlocked: ['pocket'],
    tickets: {},
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
type LegacyScratch = Omit<ScratchState, 'version' | 'upgrades' | 'unlocked'> & {
  version: 1;
  skills?: Record<string, number>;
};
/** Version 1 had a 72-node atlas that unlocked books. Books stay unlocked; every
 * other rank is refunded at the price that was paid. */
function migrateV1(g: ScratchHost, old: LegacyScratch): ScratchState {
  const s = createScratch();
  const skills = old.skills ?? {};
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
  let refund = 0;
  for (const [id, raw] of Object.entries(skills)) {
    const n = Number.isFinite(raw)
      ? Math.max(0, Math.min(12, Math.floor(raw)))
      : 0;
    if (!n) continue;
    const feature = /^feature-(\w+)$/.exec(id)?.[1];
    if (feature) {
      if (PACKS.some((p) => p.id === feature))
        s.unlocked.push(feature as PackId);
      else refund += oneTime[feature] ?? 0;
      continue;
    }
    const match = /^(\w+)-(\d)$/.exec(id),
      b = branches.indexOf(match?.[1] ?? '');
    if (!match || b < 0) continue;
    const cost = Math.ceil((16 + b * 6) * 2.65 ** Number(match[2]));
    for (let r = 0; r < n; r++) refund += Math.ceil(cost * 1.42 ** r);
  }
  s.tickets = old.tickets ?? {};
  for (const ticket of Object.values(s.tickets))
    if (!s.unlocked.includes(ticket.pack)) s.unlocked.push(ticket.pack);
  s.nextId = old.nextId ?? 1;
  s.completed = old.completed ?? 0;
  s.earned = old.earned ?? 0;
  s.activeMs = old.activeMs ?? 0;
  s.books = old.books ?? {};
  s.best = old.best ?? 0;
  s.migrationCredit = (old.migrationCredit ?? 0) + refund;
  g.coins = Math.min(1e18, g.coins + refund);
  return s;
}
export function scratchFor(g: ScratchHost): ScratchState {
  if ((g.scratch as { version?: number } | undefined)?.version === 1)
    g.scratch = migrateV1(g, g.scratch as unknown as LegacyScratch);
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
        const raw = old?.skills?.[`${room}-${id}`];
        const n =
          typeof raw === 'number' && Number.isFinite(raw)
            ? Math.max(0, Math.min(max, Math.floor(raw)))
            : 0;
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
export function level(s: ScratchState, id: string) {
  return s.upgrades[id] ?? 0;
}
export function upgradeFor(id: string) {
  return UPGRADES.find((u) => u.id === id);
}
export function upgradeCost(s: ScratchState, u: Upgrade) {
  return Math.ceil(u.base * u.growth ** level(s, u.id));
}
export function upgradeReady(s: ScratchState, u: Upgrade) {
  return (
    (!u.requires || level(s, u.requires) > 0) &&
    (u.path !== 'factory' || s.factory.blueprints.includes('starter'))
  );
}
export function packFor(id: PackId): Pack {
  return PACKS.find((p) => p.id === id) ?? PACKS[0];
}
export function packOpen(s: ScratchState, id: PackId) {
  return s.unlocked.includes(id);
}
/** Books are bought in order: the next locked book is the only one for sale. */
export function nextBook(s: ScratchState) {
  return PACKS.find((p) => !packOpen(s, p.id));
}
export function brushRadius(s: ScratchState) {
  return 0.03 * (1 + level(s, 'coin') * 0.08);
}
export function odds(lucky: number, jackpot: number) {
  const j = jackpot * 0.004,
    twelve = 0.02 + lucky * 0.004,
    six = 0.1 + lucky * 0.011,
    three = 0.32;
  return { jackpot: j, twelve, six, three, one: 1 - j - twelve - six - three };
}
export function starChance(rank: number) {
  return 0.01 + rank * 0.005;
}
/** The average printed prize multiplier of one seal. */
export function averagePrize(s: ScratchState) {
  const o = odds(level(s, 'lucky'), level(s, 'jackpot'));
  return o.jackpot * 50 + o.twelve * 12 + o.six * 6 + o.three * 3 + o.one;
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
function prizeRoll(g: ScratchHost, s: ScratchState) {
  const o = odds(level(s, 'lucky'), level(s, 'jackpot')),
    r = random(g);
  if (r < o.jackpot) return 50;
  if (r < o.jackpot + o.twelve) return 12;
  if (r < o.jackpot + o.twelve + o.six) return 6;
  if (r < o.jackpot + o.twelve + o.six + o.three) return 3;
  return 1;
}
function newTicket(
  g: ScratchHost,
  pack: PackId,
  previous: ScratchTicket | undefined,
  now: number,
): ScratchTicket {
  const s = scratchFor(g),
    p = packFor(pack),
    size = p.columns * p.rows;
  const cells: ScratchCell[] = Array.from({ length: size }, (_, i) => ({
    symbol:
      p.mechanic === 'pairs'
        ? Math.floor(i / 2) % SYMBOLS.length
        : Math.floor(random(g) * SYMBOLS.length),
    prize: prizeRoll(g, s),
    mask: '0'.repeat(MASK_SIDE ** 2),
    revealed: false,
    direction: random(g) < 0.5 ? 'h' : 'v',
    aligned: 0,
    rubbed: 0,
  }));
  if (p.mechanic === 'pairs')
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(random(g) * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
  if (p.mechanic === 'lantern' || p.mechanic === 'treasure') {
    const pool = Array.from({ length: size }, (_, i) => i);
    for (let n = 0; n < (p.mechanic === 'lantern' ? 1 : 3); n++) {
      const index = pool.splice(Math.floor(random(g) * pool.length), 1)[0];
      cells[index].special = true;
      cells[index].prize = 12;
    }
  }
  // A connected, visible path, mirrored on each issue to avoid one memorized swipe.
  const mirror = random(g) < 0.5;
  const trail = Array.from({ length: size }, (_, i) => {
    const row = Math.floor(i / p.columns),
      col = row % 2 ? p.columns - 1 - (i % p.columns) : i % p.columns;
    return row * p.columns + (mirror ? p.columns - col - 1 : col);
  }).slice(0, p.mechanic === 'atlas' ? 14 : 8);
  return {
    id: s.nextId++,
    pack,
    cells,
    trail,
    order: [],
    sequence: 0,
    star: random(g) < starChance(level(s, 'star')),
    claimed: false,
    payout: 0,
    quality: 0,
    streak: previous?.streak ?? 0,
    lastAt: now,
  };
}
/** Crowns among the eight neighbours: the printed clue on a treasure seal. */
export function crownClue(ticket: ScratchTicket, index: number) {
  const p = packFor(ticket.pack),
    col = index % p.columns,
    row = Math.floor(index / p.columns);
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = col + dx,
        y = row + dy;
      if ((dx || dy) && x >= 0 && y >= 0 && x < p.columns && y < p.rows)
        n += ticket.cells[y * p.columns + x].special ? 1 : 0;
    }
  return n;
}
/** Seals next to the lantern are warm. */
export function lanternWarm(ticket: ScratchTicket, index: number) {
  return crownClue(ticket, index) > 0;
}
/** The foil is an 8x8 bitmap per seal. Both ends of every movement segment are
 * sampled geometrically, so fast strokes never leave holes or teleport scratches. */
export function rubTicket(
  ticket: ScratchTicket,
  s: ScratchState,
  points: ScratchPoint[],
) {
  const pack = packFor(ticket.pack),
    radius = brushRadius(s),
    threshold = 0.72 - level(s, 'foil') * 0.03;
  let reveals = 0;
  const reveal = (index: number) => {
    const cell = ticket.cells[index];
    cell.revealed = true;
    cell.mask = '1'.repeat(MASK_SIDE ** 2);
    ticket.order.push(index);
    reveals++;
  };
  for (let p = 0; p < points.length; p++) {
    const a = points[p ? p - 1 : p],
      b = points[p],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    const revealCandidates: { index: number; along: number }[] = [];
    ticket.cells.forEach((cell, index) => {
      if (cell.revealed) return;
      const col = index % pack.columns,
        row = Math.floor(index / pack.columns),
        mask = cell.mask.split('');
      for (let bit = 0; bit < mask.length; bit++) {
        if (mask[bit] === '1') continue;
        // Match the inset foil rectangle drawn by ScratchSurface.
        const x =
          (col + 0.12 + (((bit % MASK_SIDE) + 0.5) / MASK_SIDE) * 0.76) /
          pack.columns;
        const y =
          (row +
            0.12 +
            ((Math.floor(bit / MASK_SIDE) + 0.5) / MASK_SIDE) * 0.76) /
          pack.rows;
        const along = length
          ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length))
          : 0;
        if (Math.hypot(x - a.x - dx * along, y - a.y - dy * along) > radius)
          continue;
        mask[bit] = '1';
        cell.rubbed++;
        if (
          length &&
          (cell.direction === 'h' ? Math.abs(dx) : Math.abs(dy)) /
            Math.sqrt(length) >=
            0.8
        )
          cell.aligned++;
      }
      cell.mask = mask.join('');
      if (cell.rubbed >= Math.ceil(mask.length * threshold)) {
        const cx = (col + 0.5) / pack.columns,
          cy = (row + 0.5) / pack.rows;
        revealCandidates.push({
          index,
          along: length ? ((cx - a.x) * dx + (cy - a.y) * dy) / length : 0,
        });
      }
    });
    revealCandidates
      .sort((a, b) => a.along - b.along)
      .forEach(({ index }) => reveal(index));
  }
  const quick = level(s, 'quick');
  if (
    quick &&
    reveals &&
    ticket.order.length >= ticket.cells.length * (1 - quick * 0.05)
  )
    ticket.cells.forEach((cell, index) => {
      if (!cell.revealed) reveal(index);
    });
  return reveals;
}
export function technique(ticket: ScratchTicket, s: ScratchState) {
  const p = packFor(ticket.pack),
    order = ticket.order,
    size = ticket.cells.length;
  if (p.mechanic === 'luck') return 0;
  let quality = 0;
  if (p.mechanic === 'rows') {
    let good = 0;
    for (let row = 0; row < p.rows; row++) {
      const rowOrder = order.filter((i) => Math.floor(i / p.columns) === row);
      for (let col = 0; col < p.columns; col++)
        if (rowOrder[col] === row * p.columns + col) good++;
    }
    quality = good / size;
  }
  if (p.mechanic === 'pairs') {
    let good = 0;
    for (let i = 0; i + 1 < order.length; i += 2)
      if (ticket.cells[order[i]].symbol === ticket.cells[order[i + 1]].symbol)
        good += 2;
    quality = good / size;
  }
  if (p.mechanic === 'trail' || p.mechanic === 'atlas') {
    const good = ticket.trail.filter(
      (index, step) => order[step] === index,
    ).length;
    quality = good / ticket.trail.length;
  }
  if (p.mechanic === 'grain' || p.mechanic === 'atlas') {
    const aligned = ticket.cells.reduce((sum, cell) => sum + cell.aligned, 0),
      rubbed = ticket.cells.reduce((sum, cell) => sum + cell.rubbed, 0);
    const grain = rubbed ? aligned / rubbed : 0;
    quality = p.mechanic === 'atlas' ? quality * 0.6 + grain * 0.4 : grain;
  }
  if (p.mechanic === 'lantern') {
    // Every seal opened after the lantern counts.
    const at = order.findIndex((i) => ticket.cells[i].special);
    quality = at < 0 ? 0 : (size - 1 - at) / (size - 1);
  }
  if (p.mechanic === 'treasure') {
    let last = -1;
    order.forEach((i, step) => {
      if (ticket.cells[i].special) last = step;
    });
    quality = last < 0 ? 0 : Math.min(1, (size - 1 - last) / (size - 3));
  }
  return Math.min(1, quality + level(s, 'steady') * 0.05);
}
function earnings(s: ScratchState) {
  return 1 + level(s, 'golden') * 0.25;
}
/** Paper and printed prizes, before technique, streaks and editions. */
function baseReward(s: ScratchState, pack: Pack, prizes: number) {
  const size = pack.columns * pack.rows;
  return (
    prizes * pack.value * (1 + level(s, 'value') * 0.1) +
    pack.value * size * (1 + level(s, 'foilpay') * 0.25)
  );
}
/** What an untouched ticket pays on average when a factory bot scratches it. */
export function botReward(s: ScratchState, id: PackId) {
  const pack = packFor(id);
  return (
    baseReward(s, pack, averagePrize(s) * pack.columns * pack.rows) *
    earnings(s) *
    (1 + level(s, 'cashiers') * 0.1)
  );
}
export function ticketReward(ticket: ScratchTicket, s: ScratchState) {
  const p = packFor(ticket.pack),
    quality = technique(ticket, s);
  const prizes = ticket.cells.reduce((n, cell) => n + cell.prize, 0);
  const craft = 1 + quality * (0.45 + level(s, 'bonus') * 0.15);
  const streak = 1 + ticket.streak * level(s, 'streak') * 0.01;
  const tenth =
    level(s, 'tenth') && (s.completed + 1) % 10 === 0
      ? 1.5 + level(s, 'tenth') * 0.5
      : 1;
  return Math.floor(
    baseReward(s, p, prizes) *
      craft *
      streak *
      tenth *
      (ticket.star ? 3 : 1) *
      earnings(s),
  );
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
  let ticket = s.tickets[actorId];
  if (action.type === 'scratch-open') {
    if (!PACKS.some((p) => p.id === action.pack) || !packOpen(s, action.pack))
      throw new Error('Unlock that ticket book first.');
    if (ticket && !ticket.claimed)
      throw new Error('Finish the ticket on your desk first.');
    ticket = newTicket(g, action.pack, ticket, now);
    s.tickets[actorId] = ticket;
    return {};
  }
  if (!ticket || action.ticket !== ticket.id)
    throw new Error('Your ticket changed. Your desk is refreshing.');
  if (ticket.claimed) {
    if (action.type === 'scratch-claim') return {};
    throw new Error('This ticket has already been collected.');
  }
  if (action.type === 'scratch-stroke') {
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
    const revealed = rubTicket(ticket, s, action.points);
    ticket.sequence++;
    ticket.lastAt = now;
    return {
      scratchReveals: revealed,
      scratchComplete: ticket.cells.every((c) => c.revealed),
    };
  }
  if (action.type === 'scratch-claim') {
    if (!ticket.cells.every((c) => c.revealed))
      throw new Error('Scratch every seal before collecting this ticket.');
    ticket.quality = technique(ticket, s);
    ticket.streak =
      packFor(ticket.pack).mechanic === 'luck'
        ? ticket.streak
        : ticket.quality >= 0.65
          ? Math.min(10, ticket.streak + 1)
          : Math.max(0, ticket.streak - 1);
    ticket.payout = ticketReward(ticket, s);
    ticket.claimed = true;
    s.completed++;
    s.books[ticket.pack] = (s.books[ticket.pack] ?? 0) + 1;
    s.best = Math.max(s.best, ticket.payout);
    earn(g, ticket.payout);
    return {
      scratchCoins: ticket.payout,
      scratchQuality: ticket.quality,
      scratchComplete: true,
    };
  }
  throw new Error('Unknown scratch action.');
}
