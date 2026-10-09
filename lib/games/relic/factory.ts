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
  starPays,
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
  | 'printer'
  | 'belt'
  | 'bot'
  | 'cashier'
  | 'splitter'
  | 'lamp'
  | 'stamper'
  | 'gilder'
  | 'charm'
  | 'bundler';
export const ORDER: MachineKind[] = [
  'printer',
  'belt',
  'bot',
  'cashier',
  'splitter',
  'lamp',
  'stamper',
  'gilder',
  'charm',
  'bundler',
];
export type MachineFamily = 'make' | 'move' | 'work' | 'sell' | 'boost';
export const MACHINES: Record<
  MachineKind,
  {
    name: string;
    does: string;
    family: MachineFamily;
    base: number;
    growth: number;
    turns: boolean;
  }
> = {
  belt: {
    name: 'Belt',
    does: 'Carries tickets the way it points. Drag to draw.',
    family: 'move',
    base: 5,
    growth: 1.03,
    turns: true,
  },
  printer: {
    name: 'Printer',
    does: 'Prints blank tickets of its book.',
    family: 'make',
    base: 300,
    growth: 2.3,
    turns: true,
  },
  bot: {
    name: 'Scratch bot',
    does: 'Scratches one blank ticket at a time.',
    family: 'work',
    base: 1_200,
    growth: 2.3,
    turns: true,
  },
  cashier: {
    name: 'Cashier',
    does: 'Sells scratched tickets from any side.',
    family: 'sell',
    base: 200,
    growth: 2.1,
    turns: false,
  },
  splitter: {
    name: 'Splitter',
    does: 'Deals tickets to its front, left and right in turn.',
    family: 'move',
    base: 300,
    growth: 1.6,
    turns: true,
  },
  lamp: {
    name: 'Turbo',
    does: 'Printers and bots beside it work 40% faster.',
    family: 'boost',
    base: 5_000,
    growth: 2.4,
    turns: false,
  },
  stamper: {
    name: 'Stamper',
    does: 'Stamps each ticket once: it sells for ×1.3.',
    family: 'work',
    base: 40_000,
    growth: 2.3,
    turns: true,
  },
  gilder: {
    name: 'Gilder',
    does: 'Gilds each ticket once: it sells for ×1.6.',
    family: 'work',
    base: 600_000_000,
    growth: 2.3,
    turns: true,
  },
  charm: {
    name: 'Charm',
    does: 'Printers in its glow print 5% more star tickets.',
    family: 'boost',
    base: 200_000_000_000,
    growth: 2.5,
    turns: false,
  },
  bundler: {
    name: 'Bundler',
    does: 'Ties 3 scratched tickets into one worth ×1.5.',
    family: 'work',
    base: 200_000_000_000_000,
    growth: 2.5,
    turns: true,
  },
};
export const BLUEPRINTS: { id: string; price: number; kinds: MachineKind[] }[] =
  [
    {
      id: 'starter',
      price: 1_000,
      kinds: ['printer', 'belt', 'bot', 'cashier'],
    },
    { id: 'splitter', price: 1_500, kinds: ['splitter'] },
    { id: 'lamp', price: 8_000, kinds: ['lamp'] },
    { id: 'stamper', price: 60_000, kinds: ['stamper'] },
    // The later blueprints arrive with the later books (Ladder, Gold Mine,
    // Sun & Moon), so the factory keeps growing through the whole game.
    { id: 'gilder', price: 1_000_000_000, kinds: ['gilder'] },
    { id: 'charm', price: 300_000_000_000, kinds: ['charm'] },
    { id: 'bundler', price: 300_000_000_000_000, kinds: ['bundler'] },
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
  /** Tickets a printer has printed: the browser restarts its ring on each. */
  printed?: number;
};
export type FactoryState = {
  version: 2;
  blueprints: string[];
  machines: Machine[];
  nextItem: number;
  clock: number;
  earned: number;
  sold: number;
  /** Smoothed coins per second from cashiers. */
  rate: number;
};
export type FactoryCell = { x: number; y: number };
export type FactoryEdit = {
  remove?: FactoryCell[];
  arrange?: { x: number; y: number; to: FactoryCell; dir: Dir }[];
  build?: {
    kind: MachineKind;
    x: number;
    y: number;
    dir: Dir;
    book?: PackId;
  }[];
};
export type FactoryAction =
  | { type: 'factory-blueprint'; id: string }
  | ({ type: 'factory-edit' } & FactoryEdit)
  | { type: 'factory-book'; cells: FactoryCell[]; book: PackId };
export function createFactory(): FactoryState {
  return {
    version: 2,
    blueprints: [],
    machines: [],
    nextItem: 1,
    clock: 0,
    earned: 0,
    sold: 0,
    rate: 0,
  };
}
/** Upgrades a saved factory once; the caller credits the duplicate blueprint. */
export function migrateFactory(f: FactoryState): number {
  if (f.version === 2) return 0;
  f.machines = f.machines.filter((m) => {
    if ((m.kind as string) === 'ink') {
      m.kind = 'lamp';
      m.dir = 0;
      return true;
    }
    return ORDER.includes(m.kind);
  });
  let refund = 0;
  if (f.blueprints.includes('ink')) {
    if (f.blueprints.includes('lamp')) refund = 20_000;
    f.blueprints = [
      ...new Set(f.blueprints.map((id) => (id === 'ink' ? 'lamp' : id))),
    ];
  }
  f.version = 2;
  return refund;
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
/** Wholesale takes a fifth off every machine per rank. */
export function machinePrice(
  f: FactoryState,
  kind: MachineKind,
  extra = 0,
  s?: ScratchState,
) {
  const n = f.machines.filter((m) => m.kind === kind).length + extra;
  return Math.ceil(
    MACHINES[kind].base *
      MACHINES[kind].growth ** n *
      (1 - (s ? level(s, 'wholesale') : 0) * 0.2),
  );
}
/** Removing gives back what the last one of that kind costs now. */
export function machineRefund(
  f: FactoryState,
  kind: MachineKind,
  s?: ScratchState,
) {
  return machinePrice(f, kind, -1, s);
}
export function bestBook(s: ScratchState): PackId {
  return [...PACKS].reverse().find((p) => packOpen(s, p.id))?.id ?? 'seven';
}
/** Bigger books take bots longer: more seals and finer foil. */
export function scratchTicks(book: PackId) {
  const l = packFor(book).levels[0],
    index = PACKS.findIndex((x) => x.id === book);
  return Math.round(((12 * l.cols * l.rows) / 9) * 1.5 ** index);
}
/** One printer keeps this many scratch bots busy (a splitter's three exits),
 * on every book, while Fast printers and Fast bots have the same rank. */
export const BOTS_PER_PRINTER = 3;
/** Ticks a printer takes per ticket of `book`: a third of a bot's. */
export function printTicks(book: PackId) {
  return Math.max(1, Math.round(scratchTicks(book) / BOTS_PER_PRINTER));
}
const key = (x: number, y: number) => y * 64 + x;
export function machineAt(f: FactoryState, x: number, y: number) {
  return f.machines.find((m) => m.x === x && m.y === y);
}
/** The eight cells around a booster, including diagonals. */
export function reach(x: number, y: number): FactoryCell[] {
  const cells: FactoryCell[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (dx || dy) cells.push({ x: x + dx, y: y + dy });
  return cells;
}
/** Machines currently helped by this booster. */
export function boosted(f: FactoryState, booster: Machine): Machine[] {
  if (booster.kind !== 'lamp' && booster.kind !== 'charm') return [];
  return f.machines.filter(
    (m) =>
      (m.kind === 'printer' || (booster.kind === 'lamp' && m.kind === 'bot')) &&
      Math.abs(m.x - booster.x) <= 1 &&
      Math.abs(m.y - booster.y) <= 1 &&
      (m.x !== booster.x || m.y !== booster.y),
  );
}
function neighbours(at: Map<number, Machine>, m: Machine) {
  return reach(m.x, m.y)
    .map(({ x, y }) => at.get(key(x, y)))
    .filter((n): n is Machine => !!n);
}
export function boost(
  f: FactoryState,
  m: Machine,
): { speed: number; stars: number } {
  const at = new Map(f.machines.map((n) => [key(n.x, n.y), n]));
  return boostWith(at, m);
}
function boostWith(at: Map<number, Machine>, m: Machine) {
  const near = neighbours(at, m);
  const count = (kind: MachineKind) =>
    near.filter((n) => n.kind === kind).length;
  return {
    speed:
      m.kind === 'bot' || m.kind === 'printer' ? 1 + count('lamp') * 0.4 : 1,
    stars: m.kind === 'printer' ? count('charm') * 0.05 : 0,
  };
}
export function itemValue(s: ScratchState, item: Item) {
  return (
    (item.value ?? botReward(s, item.book) * (item.star ? starPays(s) : 1)) *
    item.mult
  );
}
function random(g: ScratchHost) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
/** Intake directions point from the machine toward the source cell. */
export function intakes(kind: MachineKind, dir: Dir): Dir[] {
  if (kind === 'printer' || kind === 'lamp' || kind === 'charm') return [];
  if (kind === 'cashier') return [0, 1, 2, 3];
  return [
    ((dir + 2) % 4) as Dir,
    ((dir + 3) % 4) as Dir,
    ((dir + 1) % 4) as Dir,
  ];
}
/** Outlet directions point from the machine toward the destination cell. */
export function outlets(kind: MachineKind, dir: Dir): Dir[] {
  if (kind === 'cashier' || kind === 'lamp' || kind === 'charm') return [];
  if (kind === 'splitter')
    return [dir, ((dir + 3) % 4) as Dir, ((dir + 1) % 4) as Dir];
  return [dir];
}
/** Where a machine may send the ticket it holds, in order of preference. */
function exits(m: Machine): Dir[] {
  const all = outlets(m.kind, m.dir);
  if (m.kind !== 'splitter') return all;
  const start = (m.turn ?? 0) % 3;
  return [...all.slice(start), ...all.slice(0, start)];
}
function step(g: ScratchHost, s: ScratchState, f: FactoryState) {
  const at = new Map(f.machines.map((m) => [key(m.x, m.y), m]));
  const printSpeed = 1.5 ** level(s, 'printers'),
    botSpeed = 1.5 ** level(s, 'bots');
  for (const m of f.machines) {
    if (m.kind === 'printer' && !m.output) {
      const b = boostWith(at, m),
        book = m.book && packOpen(s, m.book) ? m.book : 'seven',
        ticks = printTicks(book);
      m.t += printSpeed * b.speed;
      if (m.t >= ticks) {
        m.t = Math.min(m.t - ticks, ticks);
        m.printed = (m.printed ?? 0) + 1;
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
        if (m.kind === 'stamper' && !item.stamped) {
          item.mult *= 1.3;
          item.stamped = true;
        }
        if (m.kind === 'gilder' && !item.gilded) {
          item.mult *= 1.6;
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
  function accept(target: Machine, item: Item, from: Dir) {
    if (!intakes(target.kind, target.dir).includes(from)) return false;
    switch (target.kind) {
      case 'belt':
      case 'splitter':
        return !target.item;
      case 'bot':
        return !target.item && !item.done;
      case 'stamper':
      case 'gilder':
        return !target.item;
      case 'cashier':
        return item.done && (sold.get(target) ?? 0) < 1;
      case 'bundler':
        return item.done && !item.value && (target.hold?.length ?? 0) < 3;
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
        if (!target || !accept(target, item, ((dir + 2) % 4) as Dir)) continue;
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
function editList<T>(list: T[] | undefined, message: string): T[] {
  if (list === undefined) return [];
  if (!Array.isArray(list) || list.length > 144) throw new Error(message);
  return list;
}
/** Builds a detached plan: validation and prices never change live machines. */
function planEdit(f: FactoryState, s: ScratchState, edit: FactoryEdit) {
  if (!edit || typeof edit !== 'object')
    throw new Error('Choose what to edit.');
  const remove = editList(edit.remove, 'Choose what to remove.'),
    arrange = editList(edit.arrange, 'Choose what to move.'),
    build = editList(edit.build, 'Choose where to build.');
  if (!remove.length && !arrange.length && !build.length)
    throw new Error('Choose what to edit.');
  const { width, height } = floorSize(s),
    remaining = [...f.machines],
    pricing = { ...f, machines: remaining },
    removed = new Set<number>();
  // Exact integer totals keep small purchases visible beside huge refunds.
  let refund = BigInt(0),
    cost = BigInt(0);
  for (const c of remove) {
    if (!c || !cell(c.x, width) || !cell(c.y, height))
      throw new Error('Remove it inside the factory floor.');
    const k = key(c.x, c.y);
    if (removed.has(k)) throw new Error('Choose each machine once.');
    removed.add(k);
    const m = machineAt(pricing, c.x, c.y);
    if (!m) throw new Error('There is no machine there.');
    refund += BigInt(machineRefund(pricing, m.kind, s));
    remaining.splice(remaining.indexOf(m), 1);
  }
  const group = new Set<Machine>(),
    moves: { machine: Machine; to: FactoryCell; dir: Dir }[] = [];
  for (const c of arrange) {
    if (
      !c ||
      !cell(c.x, width) ||
      !cell(c.y, height) ||
      !c.to ||
      !cell(c.to.x, width) ||
      !cell(c.to.y, height)
    )
      throw new Error('Move it inside the factory floor.');
    const m = machineAt(pricing, c.x, c.y);
    if (!m) throw new Error('There is no machine there.');
    if (group.has(m)) throw new Error('Choose each machine once.');
    if (MACHINES[m.kind].turns && !cell(c.dir, 4))
      throw new Error('Choose a direction.');
    group.add(m);
    moves.push({
      machine: m,
      to: c.to,
      dir: MACHINES[m.kind].turns ? c.dir : 0,
    });
  }
  const taken = new Set(
    remaining.filter((m) => !group.has(m)).map((m) => key(m.x, m.y)),
  );
  for (const { to } of moves) {
    const k = key(to.x, to.y);
    if (taken.has(k)) throw new Error('That space is taken.');
    taken.add(k);
  }
  for (const p of build) {
    if (!p || !Object.hasOwn(MACHINES, p.kind) || !kindOpen(f, p.kind))
      throw new Error('Buy that machine first.');
    if (!cell(p.x, width) || !cell(p.y, height))
      throw new Error('Build inside the factory floor.');
    if (MACHINES[p.kind].turns && !cell(p.dir, 4))
      throw new Error('Choose a direction.');
    const k = key(p.x, p.y);
    if (taken.has(k)) throw new Error('That space is taken.');
    taken.add(k);
    cost += BigInt(machinePrice(pricing, p.kind, 0, s));
    remaining.push({
      kind: p.kind,
      x: p.x,
      y: p.y,
      dir: MACHINES[p.kind].turns ? p.dir : 0,
      t: 0,
      item: null,
      output: null,
      ...(p.kind === 'printer'
        ? {
            book:
              p.book &&
              PACKS.some((b) => b.id === p.book) &&
              packOpen(s, p.book)
                ? p.book
                : bestBook(s),
          }
        : {}),
    });
  }
  return {
    cost: Number(cost),
    refund: Number(refund),
    net: Number(cost - refund),
    machines: remaining,
    moves,
  };
}
/** Validates an edit without changing the factory. `net` is the coin charge
 * (negative for a refund), kept precise even when the gross totals are huge. */
export function editCost(
  f: FactoryState,
  s: ScratchState,
  edit: FactoryEdit,
): { cost: number; refund: number; net: number } {
  const { cost, refund, net } = planEdit(f, s, edit);
  return { cost, refund, net };
}
export function actFactory(g: ScratchHost, action: FactoryAction): void {
  const s = scratchFor(g),
    f = s.factory;
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
  if (action.type === 'factory-edit') {
    const plan = planEdit(f, s, action);
    if (g.coins < plan.net) throw new Error('You need more coins for that.');
    // Settle the complete edit before clamping, so refunds can fund its builds.
    g.coins = Math.min(1e18, g.coins - plan.net);
    for (const { machine: m, to, dir } of plan.moves) {
      if (m.dir !== dir) m.turn = 0;
      m.x = to.x;
      m.y = to.y;
      m.dir = dir;
      m.stuck = 0;
    }
    f.machines = plan.machines.sort((a, b) => a.y - b.y || a.x - b.x);
    return;
  }
  if (action.type === 'factory-book') {
    if (!PACKS.some((p) => p.id === action.book) || !packOpen(s, action.book))
      throw new Error('Unlock that ticket book first.');
    if (
      !Array.isArray(action.cells) ||
      !action.cells.length ||
      action.cells.length > 144
    )
      throw new Error('Choose your printers.');
    const { width, height } = floorSize(s),
      printers = new Set<Machine>();
    for (const c of action.cells) {
      if (!c || !cell(c.x, width) || !cell(c.y, height))
        throw new Error('Choose inside the factory floor.');
      const m = machineAt(f, c.x, c.y);
      if (m?.kind === 'printer') printers.add(m);
    }
    if (!printers.size) throw new Error('Only printers print tickets.');
    for (const m of printers) m.book = action.book;
    return;
  }
  throw new Error('Unknown factory action.');
}
