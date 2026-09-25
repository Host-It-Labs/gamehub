import {
  FLOOR_SIZES,
  PACKS,
  botReward,
  earn,
  level,
  packFor,
  packOpen,
  scratchFor,
  starChance,
  type PackId,
  type ScratchHost,
  type ScratchState,
} from './scratch.ts';
/** The ticket factory: a shared grid of machines that prints, scratches and
 * sells tickets while someone is actively playing. The same deterministic step
 * runs on the server and, for smooth motion, in the browser. */
export const TICK_MS = 500;
export type Dir = 0 | 1 | 2 | 3;
/** Right, down, left, up. */
export const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
export type MachineKind =
  | 'belt'
  | 'printer'
  | 'bot'
  | 'cashier'
  | 'splitter'
  | 'lamp'
  | 'ink'
  | 'stamper'
  | 'gilder'
  | 'charm'
  | 'bundler';
export const MACHINES: Record<
  MachineKind,
  { name: string; does: string; base: number; growth: number; turns: boolean }
> = {
  belt: {
    name: 'Belt',
    does: 'Moves tickets. Drag to draw a line.',
    base: 5,
    growth: 1.03,
    turns: true,
  },
  printer: {
    name: 'Printer',
    does: 'Prints a blank ticket every 4 s.',
    base: 300,
    growth: 2.3,
    turns: true,
  },
  bot: {
    name: 'Scratch bot',
    does: 'Scratches one blank ticket at a time.',
    base: 1_200,
    growth: 2.3,
    turns: true,
  },
  cashier: {
    name: 'Cashier',
    does: 'Sells scratched tickets, two per second.',
    base: 200,
    growth: 2.1,
    turns: false,
  },
  splitter: {
    name: 'Splitter',
    does: 'Shares tickets between its front and sides.',
    base: 300,
    growth: 1.6,
    turns: true,
  },
  lamp: {
    name: 'Lamp',
    does: 'Touching bots scratch 40% faster.',
    base: 5_000,
    growth: 2.4,
    turns: false,
  },
  ink: {
    name: 'Ink well',
    does: 'Touching printers print 40% faster.',
    base: 12_000,
    growth: 2.4,
    turns: false,
  },
  stamper: {
    name: 'Stamper',
    does: 'Blank tickets passing through pay ×1.3.',
    base: 40_000,
    growth: 2.3,
    turns: true,
  },
  gilder: {
    name: 'Gilder',
    does: 'Scratched tickets passing through pay ×1.25.',
    base: 600_000,
    growth: 2.3,
    turns: true,
  },
  charm: {
    name: 'Charm',
    does: 'Touching printers print +5% star tickets (×5).',
    base: 12_000_000,
    growth: 2.5,
    turns: false,
  },
  bundler: {
    name: 'Bundler',
    does: 'Packs 3 scratched tickets into one worth ×1.5.',
    base: 200_000_000,
    growth: 2.5,
    turns: true,
  },
};
export const BLUEPRINTS: { id: string; price: number; kinds: MachineKind[] }[] =
  [
    {
      id: 'starter',
      price: 1_000,
      kinds: ['belt', 'printer', 'bot', 'cashier'],
    },
    { id: 'splitter', price: 1_500, kinds: ['splitter'] },
    { id: 'lamp', price: 8_000, kinds: ['lamp'] },
    { id: 'ink', price: 20_000, kinds: ['ink'] },
    { id: 'stamper', price: 60_000, kinds: ['stamper'] },
    { id: 'gilder', price: 1_000_000, kinds: ['gilder'] },
    { id: 'charm', price: 20_000_000, kinds: ['charm'] },
    { id: 'bundler', price: 300_000_000, kinds: ['bundler'] },
  ];
export type Item = {
  id: number;
  book: PackId;
  done: boolean;
  mult: number;
  star: boolean;
  stamped?: boolean;
  gilded?: boolean;
  /** A bundle's frozen sale value. */
  value?: number;
};
export type Machine = {
  kind: MachineKind;
  x: number;
  y: number;
  dir: Dir;
  book?: PackId;
  t: number;
  /** Belts and splitters carry one ticket; machines take one in, give one out. */
  item: Item | null;
  output: Item | null;
  hold?: Item[];
  turn?: number;
  stuck?: number;
};
export type FactoryState = {
  blueprints: string[];
  machines: Machine[];
  nextItem: number;
  clock: number;
  earned: number;
  sold: number;
  /** Smoothed coins per second from cashiers. */
  rate: number;
};
export type FactoryAction =
  | { type: 'factory-blueprint'; id: string }
  | {
      type: 'factory-build';
      pieces: { kind: MachineKind; x: number; y: number; dir: Dir }[];
    }
  | { type: 'factory-remove'; cells: { x: number; y: number }[] }
  | { type: 'factory-rotate'; x: number; y: number }
  | { type: 'factory-book'; x: number; y: number; book: PackId };
export function createFactory(): FactoryState {
  return {
    blueprints: [],
    machines: [],
    nextItem: 1,
    clock: 0,
    earned: 0,
    sold: 0,
    rate: 0,
  };
}
export function floorSize(s: ScratchState) {
  const [width, height] = FLOOR_SIZES[level(s, 'floor')] ?? FLOOR_SIZES[0];
  return { width, height };
}
export function kindOpen(f: FactoryState, kind: MachineKind) {
  return BLUEPRINTS.some(
    (b) => b.kinds.includes(kind) && f.blueprints.includes(b.id),
  );
}
export function machinePrice(f: FactoryState, kind: MachineKind, extra = 0) {
  const n = f.machines.filter((m) => m.kind === kind).length + extra;
  return Math.ceil(MACHINES[kind].base * MACHINES[kind].growth ** n);
}
/** Removing gives back what the last one of that kind cost. */
export function machineRefund(f: FactoryState, kind: MachineKind) {
  return machinePrice(f, kind, -1);
}
export function bestBook(s: ScratchState): PackId {
  return [...PACKS].reverse().find((p) => packOpen(s, p.id))?.id ?? 'seven';
}
export const PRINT_TICKS = 8;
/** Bigger books take bots longer: more seals and finer foil. */
export function scratchTicks(book: PackId) {
  const l = packFor(book).levels[0],
    index = PACKS.findIndex((x) => x.id === book);
  return Math.round(((12 * l.cols * l.rows) / 9) * 1.5 ** index);
}
const key = (x: number, y: number) => y * 64 + x;
export function machineAt(f: FactoryState, x: number, y: number) {
  return f.machines.find((m) => m.x === x && m.y === y);
}
function neighbours(at: Map<number, Machine>, m: Machine) {
  return DIRS.map(([dx, dy]) => at.get(key(m.x + dx, m.y + dy))).filter(
    (n): n is Machine => !!n,
  );
}
export function boost(f: FactoryState, m: Machine) {
  const at = new Map(f.machines.map((n) => [key(n.x, n.y), n]));
  return boostWith(at, m);
}
function boostWith(at: Map<number, Machine>, m: Machine) {
  const near = neighbours(at, m);
  const count = (kind: MachineKind) =>
    near.filter((n) => n.kind === kind).length;
  return {
    speed:
      m.kind === 'bot'
        ? 1 + count('lamp') * 0.4
        : m.kind === 'printer'
          ? 1 + count('ink') * 0.4
          : 1,
    stars: m.kind === 'printer' ? count('charm') * 0.05 : 0,
  };
}
export function itemValue(s: ScratchState, item: Item) {
  return (
    item.value ?? botReward(s, item.book) * item.mult * (item.star ? 5 : 1)
  );
}
function random(g: ScratchHost) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
/** Where a machine may send the ticket it holds, in order of preference. */
function exits(m: Machine): Dir[] {
  if (m.kind !== 'splitter') return [m.dir];
  const all = [m.dir, ((m.dir + 3) % 4) as Dir, ((m.dir + 1) % 4) as Dir];
  const start = (m.turn ?? 0) % 3;
  return [...all.slice(start), ...all.slice(0, start)];
}
function facing(m: Machine, other: Machine) {
  const [dx, dy] = DIRS[m.dir];
  return m.x + dx === other.x && m.y + dy === other.y;
}
function step(g: ScratchHost, s: ScratchState, f: FactoryState) {
  const at = new Map(f.machines.map((m) => [key(m.x, m.y), m]));
  const printSpeed = 1.5 ** level(s, 'printers'),
    botSpeed = 1.5 ** level(s, 'bots');
  for (const m of f.machines) {
    if (m.kind === 'printer' && !m.output) {
      const b = boostWith(at, m);
      m.t += printSpeed * b.speed;
      if (m.t >= PRINT_TICKS) {
        m.t -= PRINT_TICKS;
        const book = m.book && packOpen(s, m.book) ? m.book : 'seven';
        m.output = {
          id: f.nextItem++,
          book,
          done: false,
          mult: 1,
          star: random(g) < starChance(level(s, 'star')) + b.stars,
        };
      }
    } else if (m.kind === 'bot' && m.item && !m.output) {
      m.t += botSpeed * boostWith(at, m).speed;
      if (m.t >= scratchTicks(m.item.book)) {
        m.t = 0;
        m.item.done = true;
        m.output = m.item;
        m.item = null;
      }
    } else if ((m.kind === 'stamper' || m.kind === 'gilder') && m.item) {
      if (!m.output && ++m.t >= 2) {
        const item = m.item;
        if (m.kind === 'stamper' && !item.done && !item.stamped) {
          item.mult *= 1.3;
          item.stamped = true;
        }
        if (m.kind === 'gilder' && item.done && !item.gilded && !item.value) {
          item.mult *= 1.25;
          item.gilded = true;
        }
        m.output = item;
        m.item = null;
        m.t = 0;
      }
    } else if (m.kind === 'bundler' && (m.hold?.length ?? 0) >= 3) {
      if (!m.output && ++m.t >= 2) {
        const pack = m.hold!.splice(0, 3);
        m.output = {
          id: f.nextItem++,
          book: pack.reduce(
            (best, i) =>
              PACKS.findIndex((p) => p.id === i.book) >
              PACKS.findIndex((p) => p.id === best)
                ? i.book
                : best,
            pack[0].book,
          ),
          done: true,
          mult: 1,
          star: false,
          value: pack.reduce((n, i) => n + itemValue(s, i), 0) * 1.5,
        };
        m.t = 0;
      }
    }
  }
  const moved = new Set<number>(),
    tried = new Set<Machine>(),
    sold = new Map<Machine, number>();
  let income = 0;
  function accept(target: Machine, item: Item, from: Machine) {
    switch (target.kind) {
      case 'belt':
      case 'splitter':
        return !target.item && !facing(target, from);
      case 'bot':
        return !target.item && !item.done && !facing(target, from);
      case 'stamper':
      case 'gilder':
        return !target.item && !facing(target, from);
      case 'cashier':
        return item.done && (sold.get(target) ?? 0) < 1;
      case 'bundler':
        return (
          item.done &&
          !item.value &&
          (target.hold?.length ?? 0) < 3 &&
          !facing(target, from)
        );
      default:
        return false;
    }
  }
  const carriers = f.machines.filter(
    (m) =>
      m.kind === 'belt' ||
      m.kind === 'splitter' ||
      m.kind === 'printer' ||
      m.kind === 'bot' ||
      m.kind === 'stamper' ||
      m.kind === 'gilder' ||
      m.kind === 'bundler',
  );
  for (let pass = 0, changed = true; changed && pass < 80; pass++) {
    changed = false;
    for (const m of carriers) {
      const slot =
        m.kind === 'belt' || m.kind === 'splitter' ? 'item' : 'output';
      const item = m[slot];
      if (!item || moved.has(item.id)) continue;
      tried.add(m);
      for (const dir of exits(m)) {
        const [dx, dy] = DIRS[dir],
          target = at.get(key(m.x + dx, m.y + dy));
        if (!target || !accept(target, item, m)) continue;
        m[slot] = null;
        moved.add(item.id);
        changed = true;
        if (m.kind === 'splitter') m.turn = ((m.turn ?? 0) + 1) % 3;
        if (target.kind === 'cashier') {
          sold.set(target, (sold.get(target) ?? 0) + 1);
          const value = itemValue(s, item);
          income += value;
          f.sold++;
        } else if (target.kind === 'bundler') (target.hold ??= []).push(item);
        else target.item = item;
        break;
      }
    }
  }
  for (const m of carriers) {
    const item = m.kind === 'belt' || m.kind === 'splitter' ? m.item : m.output;
    m.stuck =
      item && tried.has(m) && !moved.has(item.id) ? (m.stuck ?? 0) + 1 : 0;
  }
  if (income) {
    earn(g, income);
    f.earned += income;
  }
  f.rate = f.rate * 0.96 + income * (1000 / TICK_MS) * 0.04;
}
/** Runs whole ticks for confirmed active time, carrying the remainder. */
export function advanceFactory(g: ScratchHost, ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const s = scratchFor(g),
    f = s.factory;
  s.activeMs += ms;
  f.clock += ms;
  const ticks = Math.floor(f.clock / TICK_MS);
  f.clock -= ticks * TICK_MS;
  if (!f.machines.length) return;
  for (let i = 0; i < Math.min(ticks, 20000); i++) step(g, s, f);
}
function cell(v: unknown, max: number) {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) < max;
}
export function actFactory(g: ScratchHost, action: FactoryAction) {
  const s = scratchFor(g),
    f = s.factory,
    { width, height } = floorSize(s);
  if (action.type === 'factory-blueprint') {
    const b = BLUEPRINTS.find((b) => b.id === action.id);
    if (!b || f.blueprints.includes(b.id))
      throw new Error('That machine is already yours or unknown.');
    if (b.id !== 'starter' && !f.blueprints.includes('starter'))
      throw new Error('Open the factory first.');
    if (g.coins < b.price) throw new Error('You need more coins for that.');
    g.coins -= b.price;
    f.blueprints.push(b.id);
    return;
  }
  if (action.type === 'factory-build') {
    if (
      !Array.isArray(action.pieces) ||
      !action.pieces.length ||
      action.pieces.length > 64
    )
      throw new Error('Choose where to build.');
    const taken = new Set(f.machines.map((m) => key(m.x, m.y))),
      added: Record<string, number> = {};
    let cost = 0;
    for (const p of action.pieces) {
      if (!p || !(p.kind in MACHINES) || !kindOpen(f, p.kind))
        throw new Error('Buy that machine first.');
      if (!cell(p.x, width) || !cell(p.y, height))
        throw new Error('Build inside the factory floor.');
      if (!cell(p.dir, 4)) throw new Error('Choose a direction.');
      if (taken.has(key(p.x, p.y))) throw new Error('That space is taken.');
      taken.add(key(p.x, p.y));
      cost += machinePrice(f, p.kind, added[p.kind] ?? 0);
      added[p.kind] = (added[p.kind] ?? 0) + 1;
    }
    if (g.coins < cost) throw new Error('You need more coins for that.');
    g.coins -= cost;
    for (const p of action.pieces)
      f.machines.push({
        kind: p.kind,
        x: p.x,
        y: p.y,
        dir: p.dir,
        t: 0,
        item: null,
        output: null,
        ...(p.kind === 'printer' ? { book: bestBook(s) } : {}),
      });
    f.machines.sort((a, b) => a.y - b.y || a.x - b.x);
    return;
  }
  if (action.type === 'factory-remove') {
    if (
      !Array.isArray(action.cells) ||
      !action.cells.length ||
      action.cells.length > 64
    )
      throw new Error('Choose what to remove.');
    for (const c of action.cells) {
      const m = c && machineAt(f, c.x, c.y);
      if (!m) continue;
      const refund = machineRefund(f, m.kind);
      f.machines.splice(f.machines.indexOf(m), 1);
      g.coins = Math.min(1e18, g.coins + refund);
    }
    return;
  }
  const m = machineAt(f, action.x, action.y);
  if (!m) throw new Error('There is no machine there.');
  if (action.type === 'factory-rotate') {
    m.dir = ((m.dir + 1) % 4) as Dir;
    m.turn = 0;
    return;
  }
  if (action.type === 'factory-book') {
    if (m.kind !== 'printer') throw new Error('Only printers print tickets.');
    if (!PACKS.some((p) => p.id === action.book) || !packOpen(s, action.book))
      throw new Error('Unlock that ticket book first.');
    m.book = action.book;
    return;
  }
  throw new Error('Unknown factory action.');
}
