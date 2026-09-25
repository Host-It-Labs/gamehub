/** Lucky's ticket books. Every book is a small puzzle printed under foil: the
 * generator lays out one ticket, `openSeal` applies the book's rule when a seal
 * comes open, and `settled` says when nothing more can be won. The same code
 * runs on the server (authority) and in the browser (instant feedback). */
export type Mechanic =
  | 'seven'
  | 'twins'
  | 'path'
  | 'ladder'
  | 'mine'
  | 'sunmoon'
  | 'chart'
  | 'crown';
export type Face =
  | 'seven'
  | 'cherry'
  | 'bell'
  | 'clover'
  | 'coin'
  | 'star'
  | 'moon'
  | 'sun'
  | 'diamond'
  | 'ruby'
  | 'gold'
  | 'dynamite'
  | 'rose'
  | 'ship'
  | 'crown'
  | 'horseshoe'
  | 'water'
  | 'blank'
  | 'number';
export type Level = {
  cols: number;
  rows: number;
  /** Mistakes allowed before the ticket ends (Lucky Seven: misses). */
  lives: number;
  /** Sevens, numbers, bands, dynamite, spare givens: one count per book. */
  count: number;
  /** Twins: how far a twin may be; Garden: hedges; Sun & Moon: signs. */
  extra?: number;
  /** Sea Chart fleets. */
  ships?: number[];
  /** Ladder: steps for a perfect climb. */
  goal?: number;
};
export const LEVEL_MULT = [1, 2, 4] as const;
/** Tickets finished in a book before its next level opens. */
export const LEVEL_AT = [0, 8, 25] as const;
export const BOOKS = [
  {
    id: 'seven',
    name: 'Lucky Seven',
    mechanic: 'seven',
    value: 1,
    price: 0,
    color: '#c8363a',
    hint: 'Arrows point to the 7',
    levels: [
      { cols: 3, rows: 3, lives: 3, count: 1 },
      { cols: 4, rows: 4, lives: 4, count: 1 },
      { cols: 5, rows: 5, lives: 5, count: 2 },
    ],
  },
  {
    id: 'twins',
    name: 'Twins',
    mechanic: 'twins',
    value: 5,
    price: 4_000,
    color: '#6d58b0',
    hint: 'Arrows point to each twin',
    levels: [
      { cols: 4, rows: 3, lives: 3, count: 0, extra: 1 },
      { cols: 4, rows: 4, lives: 3, count: 0, extra: 2 },
      { cols: 5, rows: 4, lives: 2, count: 0, extra: 4 },
    ],
  },
  {
    id: 'path',
    name: 'Garden',
    mechanic: 'path',
    value: 25,
    price: 300_000,
    color: '#4f8a4b',
    hint: 'One path through every seal',
    levels: [
      { cols: 3, rows: 3, lives: 1, count: 3 },
      { cols: 4, rows: 4, lives: 1, count: 4 },
      { cols: 5, rows: 5, lives: 1, count: 5, extra: 5 },
    ],
  },
  {
    id: 'ladder',
    name: 'Ladder',
    mechanic: 'ladder',
    value: 125,
    price: 80_000_000,
    color: '#e0702c',
    hint: 'Always higher',
    levels: [
      { cols: 2, rows: 4, lives: 1, count: 4, goal: 4 },
      { cols: 3, rows: 4, lives: 1, count: 4, goal: 6 },
      { cols: 3, rows: 5, lives: 1, count: 3, goal: 6 },
    ],
  },
  {
    id: 'mine',
    name: 'Gold Mine',
    mechanic: 'mine',
    value: 625,
    price: 3_000_000_000,
    color: '#9a6a36',
    hint: 'Numbers count the dynamite',
    levels: [
      { cols: 4, rows: 4, lives: 1, count: 2 },
      { cols: 5, rows: 5, lives: 1, count: 4 },
      { cols: 6, rows: 6, lives: 1, count: 7 },
    ],
  },
  {
    id: 'sunmoon',
    name: 'Sun & Moon',
    mechanic: 'sunmoon',
    value: 3_125,
    price: 1_500_000_000_000,
    color: '#2e4f93',
    hint: 'Scratch only the moons',
    levels: [
      { cols: 4, rows: 4, lives: 3, count: 3 },
      { cols: 6, rows: 6, lives: 2, count: 3 },
      { cols: 6, rows: 6, lives: 2, count: 0, extra: 8 },
    ],
  },
  {
    id: 'chart',
    name: 'Sea Chart',
    mechanic: 'chart',
    value: 15_625,
    price: 400_000_000_000_000,
    color: '#2f7a86',
    hint: 'Edge numbers count the ships',
    levels: [
      { cols: 5, rows: 5, lives: 5, count: 0, ships: [3, 2, 2] },
      { cols: 6, rows: 6, lives: 5, count: 0, ships: [4, 3, 2, 2] },
      { cols: 6, rows: 6, lives: 4, count: 0, ships: [3, 3, 2, 2, 1, 1] },
    ],
  },
  {
    id: 'crown',
    name: 'Crown Jewels',
    mechanic: 'crown',
    value: 78_125,
    price: 4_000_000_000_000_000,
    color: '#a32638',
    hint: 'One crown per row, column and colour',
    levels: [
      { cols: 5, rows: 5, lives: 3, count: 0 },
      { cols: 6, rows: 6, lives: 3, count: 0 },
      { cols: 7, rows: 7, lives: 2, count: 0 },
    ],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  mechanic: Mechanic;
  value: number;
  price: number;
  color: string;
  hint: string;
  levels: readonly Level[];
}[];
export type PackId = (typeof BOOKS)[number]['id'];
export type Pack = (typeof BOOKS)[number];
export type Cell = {
  face: Face;
  /** Prize units this seal pays when it counts. */
  prize: number;
  mask: string;
  revealed: boolean;
  /** Scratched open by the player while the ticket was live. */
  picked?: boolean;
  /** Counts toward the payout. */
  paid?: boolean;
  /** Printed without foil (Sun & Moon givens, the mine entrance). */
  given?: boolean;
  /** Ladder value, dynamite count, or the Garden checkpoint printed on foil. */
  n?: number;
  /** 0–7 clockwise from east: printed toward a twin, found toward a seven. */
  dir?: number;
  /** Twin pair, ladder band, crown region. */
  group?: number;
};
export type ScratchTicket = {
  id: number;
  pack: PackId;
  level: number;
  cols: number;
  rows: number;
  cells: Cell[];
  order: number[];
  sequence: number;
  lives: number;
  mistakes: number;
  /** Garden: last seal on the path; Ladder: last number; Twins: open seal. */
  last: number;
  /** Garden: next checkpoint number. */
  next: number;
  steps: number;
  /** Sink bonuses and other prize units on top of the seals. */
  bonus: number;
  /** Garden hedges between cells, as a*64+b with a < b. */
  walls?: number[];
  /** Sun & Moon printed signs: [a, b, same]. */
  signs?: [number, number, boolean][];
  /** Sea Chart ships, and the counts printed on the edges. */
  ships?: number[][];
  rowCounts?: number[];
  colCounts?: number[];
  ended: boolean;
  perfect: boolean;
  star: boolean;
  claimed: boolean;
  payout: number;
  lastAt: number;
};
export const MASK_SIDE = 8;
export type Rand = () => number;
export function bookFor(id: PackId): Pack {
  return BOOKS.find((p) => p.id === id) ?? BOOKS[0];
}
export function levelFor(id: PackId, level: number): Level {
  const levels = bookFor(id).levels;
  return levels[Math.max(0, Math.min(levels.length - 1, level))];
}
const pick = <T>(list: readonly T[], r: Rand) =>
  list[Math.floor(r() * list.length)];
function shuffle<T>(list: T[], r: Rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
function weighted(table: readonly [Face, number, number][], r: Rand) {
  let x = r() * table.reduce((n, [, , w]) => n + w, 0);
  for (const [face, prize, w] of table)
    if ((x -= w) < 0) return { face, prize };
  return { face: table[0][0], prize: table[0][1] };
}
/** Right, down-right, down, down-left, left, up-left, up, up-right. */
export const DIR8 = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const;
export function dirTo(cols: number, from: number, to: number) {
  const dx = Math.sign((to % cols) - (from % cols)),
    dy = Math.sign(Math.floor(to / cols) - Math.floor(from / cols));
  return DIR8.findIndex(([x, y]) => x === dx && y === dy);
}
export function neighbours(
  cols: number,
  rows: number,
  i: number,
  eight = false,
) {
  const x = i % cols,
    y = Math.floor(i / cols),
    out: number[] = [];
  for (const [dx, dy] of eight ? DIR8 : DIR8.filter((_, d) => d % 2 === 0)) {
    const nx = x + dx,
      ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx);
  }
  return out;
}
const edge = (a: number, b: number) => Math.min(a, b) * 64 + Math.max(a, b);
const blank = (face: Face, prize = 0): Cell => ({
  face,
  prize,
  mask: '0'.repeat(MASK_SIDE ** 2),
  revealed: false,
});

// ---- Generators ---------------------------------------------------------

const SEVEN_FACES: [Face, number, number][] = [
  ['coin', 1, 45],
  ['cherry', 2, 30],
  ['bell', 3, 17],
  ['clover', 5, 8],
];
const TWIN_FACES: [Face, number][] = [
  ['diamond', 4],
  ['ruby', 4],
  ['clover', 3],
  ['horseshoe', 3],
  ['star', 2],
  ['moon', 2],
  ['sun', 2],
  ['bell', 2],
  ['cherry', 1],
  ['rose', 1],
];
const PATH_FACES: [Face, number, number][] = [
  ['coin', 1, 50],
  ['rose', 2, 35],
  ['star', 3, 15],
];
const GEMS: [Face, number, number][] = [
  ['gold', 1, 50],
  ['ruby', 2, 30],
  ['diamond', 3, 20],
];

function sevens(l: Level, r: Rand) {
  const n = l.cols * l.rows,
    at = shuffle([...Array(n).keys()], r).slice(0, l.count);
  return Array.from({ length: n }, (_, i) => {
    if (at.includes(i)) return blank('seven', 10);
    const { face, prize } = weighted(SEVEN_FACES, r);
    return blank(face, prize);
  });
}
/** Pairs twins along straight lines no further than `reach`. */
function twins(l: Level, r: Rand) {
  const n = l.cols * l.rows,
    reach = l.extra ?? 1;
  for (let attempt = 0; attempt < 200; attempt++) {
    const mate = Array<number>(n).fill(-1);
    const fill = (): boolean => {
      const a = mate.indexOf(-1);
      if (a < 0) return true;
      const options: number[] = [];
      const x = a % l.cols,
        y = Math.floor(a / l.cols);
      for (const [dx, dy] of DIR8)
        for (let k = 1; k <= reach; k++) {
          const nx = x + dx * k,
            ny = y + dy * k;
          if (nx < 0 || ny < 0 || nx >= l.cols || ny >= l.rows) break;
          const b = ny * l.cols + nx;
          if (mate[b] < 0 && b !== a) options.push(b);
        }
      for (const b of shuffle(options, r)) {
        mate[a] = b;
        mate[b] = a;
        if (fill()) return true;
        mate[a] = mate[b] = -1;
      }
      return false;
    };
    if (!fill()) continue;
    const faces = shuffle([...TWIN_FACES], r),
      cells: Cell[] = [];
    let group = 0;
    const groups = Array<number>(n).fill(-1);
    for (let i = 0; i < n; i++)
      if (groups[i] < 0) groups[i] = groups[mate[i]] = group++;
    for (let i = 0; i < n; i++) {
      const [face, prize] = faces[groups[i] % faces.length];
      cells.push({
        ...blank(face, prize),
        group: groups[i],
        dir: dirTo(l.cols, i, mate[i]),
      });
    }
    return cells;
  }
  throw new Error('Could not print a Twins ticket.');
}
/** A random Hamiltonian path by backbite moves on a serpentine start. */
export function randomPath(cols: number, rows: number, r: Rand) {
  let path = Array.from({ length: cols * rows }, (_, i) => {
    const y = Math.floor(i / cols),
      x = y % 2 ? cols - 1 - (i % cols) : i % cols;
    return y * cols + x;
  });
  for (let move = 0; move < cols * rows * 30; move++) {
    if (r() < 0.5) path.reverse();
    const options = neighbours(cols, rows, path[0]).filter(
      (q) => q !== path[1],
    );
    if (!options.length) continue;
    const k = path.indexOf(pick(options, r));
    path = [...path.slice(0, k).reverse(), ...path.slice(k)];
  }
  return path;
}
function garden(l: Level, r: Rand) {
  const n = l.cols * l.rows,
    path = randomPath(l.cols, l.rows, r);
  const cells = Array.from({ length: n }, () => {
    const { face, prize } = weighted(PATH_FACES, r);
    return blank(face, prize);
  });
  const stops = shuffle(
    [...Array(n - 2).keys()].map((i) => i + 1),
    r,
  )
    .slice(0, l.count - 2)
    .sort((a, b) => a - b);
  [0, ...stops, n - 1].forEach((at, k) => (cells[path[at]].n = k + 1));
  const used = new Set(path.slice(1).map((c, i) => edge(path[i], c)));
  const free: number[] = [];
  for (let i = 0; i < n; i++)
    for (const j of neighbours(l.cols, l.rows, i))
      if (i < j && !used.has(edge(i, j))) free.push(edge(i, j));
  return { cells, walls: shuffle(free, r).slice(0, l.extra ?? 0) };
}
function ladder(l: Level, r: Rand) {
  const n = l.cols * l.rows,
    values = shuffle(
      [...Array(n).keys()].map((i) => i + 1),
      r,
    ),
    band = n / l.count;
  return values.map((v) => ({
    ...blank('number'),
    n: v,
    group: Math.floor((v - 1) / band),
  }));
}
function mine(l: Level, r: Rand) {
  const n = l.cols * l.rows,
    start = Math.floor(r() * n),
    near = new Set([start, ...neighbours(l.cols, l.rows, start, true)]);
  const spots = shuffle(
    [...Array(n).keys()].filter((i) => !near.has(i)),
    r,
  ).slice(0, l.count);
  const cells = Array.from({ length: n }, (_, i) => {
    if (spots.includes(i)) return blank('dynamite');
    const { face, prize } = weighted(GEMS, r);
    return blank(face, prize);
  });
  cells.forEach((c, i) => {
    if (c.face !== 'dynamite')
      c.n = neighbours(l.cols, l.rows, i, true).filter((j) =>
        spots.includes(j),
      ).length;
  });
  cells[start].given = true;
  cells[start].revealed = true;
  cells[start].prize = 0;
  cells[start].mask = '1'.repeat(MASK_SIDE ** 2);
  return cells;
}
/** Counts Sun & Moon completions (up to `limit`) for the fixed cells. */
export function tangoSolutions(
  cols: number,
  rows: number,
  fixed: (boolean | null)[],
  signs: [number, number, boolean][],
  limit = 2,
  r?: Rand,
  out?: boolean[],
) {
  const grid: (boolean | null)[] = fixed.map((v) => v),
    n = cols * rows;
  let found = 0;
  const ok = (i: number) => {
    const x = i % cols,
      y = Math.floor(i / cols),
      v = grid[i];
    if (x >= 2 && grid[i - 1] === v && grid[i - 2] === v) return false;
    if (y >= 2 && grid[i - cols] === v && grid[i - 2 * cols] === v)
      return false;
    let row = 0,
      col = 0;
    for (let k = 0; k < cols; k++) if (grid[y * cols + k] === v) row++;
    for (let k = 0; k < rows; k++) if (grid[k * cols + x] === v) col++;
    if (row > cols / 2 || col > rows / 2) return false;
    for (const [a, b, same] of signs)
      if ((a === i || b === i) && grid[a] !== null && grid[b] !== null)
        if ((grid[a] === grid[b]) !== same) return false;
    return true;
  };
  const walk = (i: number) => {
    if (found >= limit) return;
    if (i === n) {
      if (!found && out) grid.forEach((v, k) => (out[k] = !!v));
      found++;
      return;
    }
    if (fixed[i] !== null) {
      if (ok(i)) walk(i + 1);
      return;
    }
    for (const v of r && r() < 0.5 ? [false, true] : [true, false]) {
      grid[i] = v;
      if (ok(i)) walk(i + 1);
      grid[i] = null;
    }
  };
  walk(0);
  return found;
}
function sunmoon(l: Level, r: Rand) {
  const n = l.cols * l.rows,
    moon: boolean[] = [];
  tangoSolutions(l.cols, l.rows, Array(n).fill(null), [], 1, r, moon);
  const signs: [number, number, boolean][] = [];
  if (l.extra) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n; i++)
      for (const j of neighbours(l.cols, l.rows, i))
        if (i < j) pairs.push([i, j]);
    for (const [a, b] of shuffle(pairs, r).slice(0, l.extra))
      signs.push([a, b, moon[a] === moon[b]]);
  }
  // Take givens away while the answer stays unique, then hand back `count`.
  const shown: (boolean | null)[] = [...moon],
    removed: number[] = [];
  for (const i of shuffle([...Array(n).keys()], r)) {
    shown[i] = null;
    if (tangoSolutions(l.cols, l.rows, shown, signs) === 1) removed.push(i);
    else shown[i] = moon[i];
  }
  for (const i of removed.slice(0, l.count)) shown[i] = moon[i];
  const cells = moon.map((m, i) => {
    const c = blank(m ? 'moon' : 'sun', m ? 3 : 0);
    if (shown[i] !== null) {
      c.given = true;
      c.revealed = true;
      c.prize = 0;
      c.mask = '1'.repeat(MASK_SIDE ** 2);
    }
    return c;
  });
  return { cells, signs };
}
function chart(l: Level, r: Rand) {
  const n = l.cols * l.rows;
  for (let attempt = 0; attempt < 500; attempt++) {
    const taken = new Set<number>(),
      ships: number[][] = [];
    let failed = false;
    for (const length of l.ships ?? []) {
      let placed = false;
      for (let t = 0; t < 60 && !placed; t++) {
        const across = r() < 0.5,
          x = Math.floor(r() * (across ? l.cols - length + 1 : l.cols)),
          y = Math.floor(r() * (across ? l.rows : l.rows - length + 1));
        const body = Array.from(
          { length },
          (_, k) => (y + (across ? 0 : k)) * l.cols + x + (across ? k : 0),
        );
        if (
          body.some(
            (c) =>
              taken.has(c) ||
              neighbours(l.cols, l.rows, c, true).some((d) => taken.has(d)),
          )
        )
          continue;
        body.forEach((c) => taken.add(c));
        ships.push(body);
        placed = true;
      }
      if (!placed) failed = true;
    }
    if (failed) continue;
    const cells = Array.from({ length: n }, (_, i) =>
      taken.has(i) ? blank('ship', 2) : blank('water'),
    );
    const rowCounts = Array.from(
      { length: l.rows },
      (_, y) =>
        cells
          .slice(y * l.cols, (y + 1) * l.cols)
          .filter((c) => c.face === 'ship').length,
    );
    const colCounts = Array.from(
      { length: l.cols },
      (_, x) =>
        cells.filter((c, i) => i % l.cols === x && c.face === 'ship').length,
    );
    return { cells, ships, rowCounts, colCounts };
  }
  throw new Error('Could not print a Sea Chart ticket.');
}
/** Counts Crown Jewels answers (up to `limit`) for a region map. */
export function crownSolutions(size: number, regions: number[], limit = 2) {
  let found = 0;
  const cols = new Set<number>(),
    used = new Set<number>();
  const walk = (y: number, prev: number) => {
    if (found >= limit) return;
    if (y === size) {
      found++;
      return;
    }
    for (let x = 0; x < size; x++) {
      const g = regions[y * size + x];
      if (cols.has(x) || used.has(g) || (y && Math.abs(x - prev) <= 1))
        continue;
      cols.add(x);
      used.add(g);
      walk(y + 1, x);
      cols.delete(x);
      used.delete(g);
    }
  };
  walk(0, -9);
  return found;
}
function crown(l: Level, r: Rand) {
  const size = l.cols,
    n = size * size;
  let best: { regions: number[]; queens: number[] } | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const queens: number[] = [];
    const place = (y: number): boolean => {
      if (y === size) return true;
      for (const x of shuffle([...Array(size).keys()], r)) {
        if (queens.includes(x) || (y && Math.abs(x - queens[y - 1]) <= 1))
          continue;
        queens.push(x);
        if (place(y + 1)) return true;
        queens.pop();
      }
      return false;
    };
    if (!place(0)) continue;
    const regions = Array<number>(n).fill(-1);
    queens.forEach((x, y) => (regions[y * size + x] = y));
    for (let left = n - size; left > 0;) {
      const frontier: [number, number][] = [];
      for (let i = 0; i < n; i++)
        if (regions[i] < 0)
          for (const j of neighbours(size, size, i))
            if (regions[j] >= 0) frontier.push([i, regions[j]]);
      const [i, g] = pick(frontier, r);
      regions[i] = g;
      left--;
    }
    best = { regions, queens: queens.map((x, y) => y * size + x) };
    if (crownSolutions(size, regions) === 1) break;
  }
  const cells = Array.from({ length: n }, (_, i) => ({
    ...(best!.queens.includes(i) ? blank('crown', 6) : blank('blank')),
    group: best!.regions[i],
  }));
  return cells;
}

export function printTicket(
  id: number,
  pack: PackId,
  level: number,
  r: Rand,
  lives: number,
  now: number,
): ScratchTicket {
  const book = bookFor(pack),
    l = levelFor(pack, level);
  const t: ScratchTicket = {
    id,
    pack,
    level: Math.max(0, Math.min(book.levels.length - 1, level)),
    cols: l.cols,
    rows: l.rows,
    cells: [],
    order: [],
    sequence: 0,
    lives: l.lives + lives,
    mistakes: 0,
    last: -1,
    next: 1,
    steps: 0,
    bonus: 0,
    ended: false,
    perfect: false,
    star: false,
    claimed: false,
    payout: 0,
    lastAt: now,
  };
  switch (book.mechanic) {
    case 'seven':
      t.cells = sevens(l, r);
      break;
    case 'twins':
      t.cells = twins(l, r);
      break;
    case 'path': {
      const g = garden(l, r);
      t.cells = g.cells;
      t.walls = g.walls;
      break;
    }
    case 'ladder':
      t.cells = ladder(l, r);
      t.last = 0;
      break;
    case 'mine':
      t.cells = mine(l, r);
      break;
    case 'sunmoon': {
      const g = sunmoon(l, r);
      t.cells = g.cells;
      t.signs = g.signs;
      break;
    }
    case 'chart': {
      const g = chart(l, r);
      t.cells = g.cells;
      t.ships = g.ships;
      t.rowCounts = g.rowCounts;
      t.colCounts = g.colCounts;
      break;
    }
    case 'crown':
      t.cells = crown(l, r);
      break;
  }
  return t;
}

// ---- Rules ---------------------------------------------------------------

const mechanicOf = (t: ScratchTicket) => bookFor(t.pack).mechanic;
function nearestSeven(t: ScratchTicket, from: number) {
  let best = -1,
    distance = Infinity;
  t.cells.forEach((c, i) => {
    if (c.face !== 'seven' || c.revealed) return;
    const d = Math.max(
      Math.abs((i % t.cols) - (from % t.cols)),
      Math.abs(Math.floor(i / t.cols) - Math.floor(from / t.cols)),
    );
    if (d < distance) [best, distance] = [i, d];
  });
  return best;
}
/** Whether stepping from `a` to `b` is a legal Garden move. */
export function pathStep(t: ScratchTicket, a: number, b: number) {
  const cell = t.cells[b];
  if (cell.revealed) return false;
  if (cell.n !== undefined && cell.n !== t.next) return false;
  if (a < 0) return cell.n === 1;
  return (
    neighbours(t.cols, t.rows, a).includes(b) && !t.walls?.includes(edge(a, b))
  );
}
/** Opens one seal and applies the book's rule. */
export function openSeal(t: ScratchTicket, index: number) {
  const cell = t.cells[index];
  if (t.ended || !cell || cell.revealed) return false;
  const step = mechanicOf(t) === 'path' && pathStep(t, t.last, index);
  cell.revealed = true;
  cell.picked = true;
  cell.mask = '1'.repeat(MASK_SIDE ** 2);
  t.order.push(index);
  const miss = () => {
    t.mistakes++;
  };
  switch (mechanicOf(t)) {
    case 'seven': {
      cell.paid = true;
      if (cell.face !== 'seven') {
        const to = nearestSeven(t, index);
        if (to >= 0) cell.dir = dirTo(t.cols, index, to);
        miss();
      }
      break;
    }
    case 'twins': {
      const open = t.last >= 0 ? t.cells[t.last] : null;
      if (!open) t.last = index;
      else {
        if (open.group === cell.group) open.paid = cell.paid = true;
        else miss();
        t.last = -1;
      }
      break;
    }
    case 'path':
      if (step) {
        cell.paid = true;
        if (cell.n !== undefined) t.next++;
        t.last = index;
        t.steps++;
      } else miss();
      break;
    case 'ladder':
      if ((cell.n ?? 0) > t.last) {
        t.last = cell.n ?? 0;
        t.steps++;
        cell.prize = t.steps;
        cell.paid = true;
      } else miss();
      break;
    case 'mine':
      if (cell.face === 'dynamite') miss();
      else {
        cell.paid = true;
        // Empty ground opens its neighbours, like any good mine.
        const flood = [index];
        while (flood.length) {
          const at = flood.pop()!;
          if (t.cells[at].n !== 0) continue;
          for (const j of neighbours(t.cols, t.rows, at, true)) {
            const c = t.cells[j];
            if (c.revealed || c.face === 'dynamite') continue;
            c.revealed = c.picked = c.paid = true;
            c.mask = '1'.repeat(MASK_SIDE ** 2);
            t.order.push(j);
            flood.push(j);
          }
        }
      }
      break;
    case 'sunmoon':
    case 'crown':
      if (cell.face === 'moon' || cell.face === 'crown') cell.paid = true;
      else miss();
      break;
    case 'chart':
      if (cell.face === 'ship') {
        cell.paid = true;
        const ship = t.ships?.find((s) => s.includes(index));
        if (ship?.every((i) => t.cells[i].revealed)) t.bonus += ship.length * 2;
      } else miss();
      break;
  }
  if (settled(t)) end(t);
  return true;
}
/** Whether the ticket can still win anything. */
export function settled(t: ScratchTicket) {
  if (t.mistakes >= t.lives) return true;
  const hidden = t.cells.filter((c) => !c.revealed);
  if (!hidden.length) return true;
  switch (mechanicOf(t)) {
    case 'seven':
    case 'twins':
      return false;
    case 'path':
      return !t.cells.some((_, i) => pathStep(t, t.last, i));
    case 'ladder':
      return !hidden.some((c) => (c.n ?? 0) > t.last);
    case 'mine':
      return hidden.every((c) => c.face === 'dynamite');
    case 'sunmoon':
      return !hidden.some((c) => c.face === 'moon');
    case 'chart':
      return !hidden.some((c) => c.face === 'ship');
    case 'crown':
      return !hidden.some((c) => c.face === 'crown');
  }
}
export function isPerfect(t: ScratchTicket) {
  const cells = t.cells;
  switch (mechanicOf(t)) {
    case 'seven':
      return cells.every((c) => c.face !== 'seven' || c.picked);
    case 'twins':
      return cells.every((c) => c.paid);
    case 'path':
      return cells.every((c) => c.paid);
    case 'ladder':
      return t.steps >= (levelFor(t.pack, t.level).goal ?? Infinity);
    case 'mine':
      return cells.every((c) => c.face === 'dynamite' || c.given || c.paid);
    case 'sunmoon':
      return cells.every((c) => c.face !== 'moon' || c.given || c.paid);
    case 'chart':
      return cells.every((c) => c.face !== 'ship' || c.paid);
    case 'crown':
      return cells.every((c) => c.face !== 'crown' || c.paid);
  }
}
/** The ticket is over: every other seal shows what it hid. */
function end(t: ScratchTicket) {
  t.ended = true;
  t.perfect = isPerfect(t);
  for (const c of t.cells)
    if (!c.revealed) {
      c.revealed = true;
      c.mask = '1'.repeat(MASK_SIDE ** 2);
    }
}
/** Prize units that count: paid seals plus bonuses. */
export function prizeUnits(t: ScratchTicket) {
  return t.cells.reduce((n, c) => n + (c.paid ? c.prize : 0), 0) + t.bonus;
}

// ---- Players used by tests and the factory's averages --------------------

/** A careful player's next seal, seeing only what the ticket shows. The
 * logic puzzles (Sun & Moon, Crown Jewels) have one answer, so a careful
 * player reads it; the others use the printed clues. */
export function suggest(t: ScratchTicket, r: Rand): number {
  const hidden = t.cells.flatMap((c, i) => (c.revealed ? [] : [i]));
  const x = (i: number) => i % t.cols,
    y = (i: number) => Math.floor(i / t.cols);
  switch (mechanicOf(t)) {
    case 'seven': {
      const candidates = hidden.filter((i) =>
        t.order.every((j) => {
          const c = t.cells[j];
          return c.dir === undefined || dirTo(t.cols, j, i) === c.dir;
        }),
      );
      if (!candidates.length) return pick(hidden, r);
      const cx = (t.cols - 1) / 2,
        cy = (t.rows - 1) / 2;
      // Scratch toward the middle of what is left: every arrow halves it.
      const mx = candidates.reduce((n, i) => n + x(i), 0) / candidates.length,
        my = candidates.reduce((n, i) => n + y(i), 0) / candidates.length;
      return candidates.sort(
        (a, b) =>
          Math.hypot(
            x(a) - (t.order.length ? mx : cx),
            y(a) - (t.order.length ? my : cy),
          ) -
          Math.hypot(
            x(b) - (t.order.length ? mx : cx),
            y(b) - (t.order.length ? my : cy),
          ),
      )[0];
    }
    case 'twins': {
      const mateOf = (a: number) =>
        hidden.filter((b) => {
          if (b === a) return false;
          const ca = t.cells[a],
            cb = t.cells[b];
          return (
            dirTo(t.cols, a, b) === ca.dir &&
            dirTo(t.cols, b, a) === cb.dir &&
            Math.max(Math.abs(x(a) - x(b)), Math.abs(y(a) - y(b))) <=
              (levelFor(t.pack, t.level).extra ?? 1) &&
            (x(a) === x(b) ||
              y(a) === y(b) ||
              Math.abs(x(a) - x(b)) === Math.abs(y(a) - y(b)))
          );
        });
      if (t.last >= 0) {
        const options = mateOf(t.last);
        return options.length ? pick(options, r) : pick(hidden, r);
      }
      const sure = hidden.find((a) => mateOf(a).length === 1);
      return sure ?? pick(hidden, r);
    }
    case 'path': {
      const legal = hidden.filter((i) => pathStep(t, t.last, i));
      // Look ahead for a full route; fall back to any legal step.
      const route = gardenRoute(t);
      return route ?? (legal.length ? pick(legal, r) : pick(hidden, r));
    }
    case 'ladder': {
      // Stay in this band while a higher number is at least as likely as not.
      const size = t.cells.length / levelFor(t.pack, t.level).count;
      const band = t.steps ? Math.floor((t.last - 1) / size) : -1;
      const here = hidden.filter((i) => t.cells[i].group === band);
      const higher = here.filter((i) => (t.cells[i].n ?? 0) > t.last);
      if (here.length && higher.length * 2 >= here.length) return pick(here, r);
      const up = hidden
        .filter((i) => (t.cells[i].group ?? 0) > band)
        .sort((a, b) => (t.cells[a].group ?? 0) - (t.cells[b].group ?? 0));
      const next = up.filter((i) => t.cells[i].group === t.cells[up[0]]?.group);
      return next.length ? pick(next, r) : pick(hidden, r);
    }
    case 'mine': {
      // Simple deduction: a number whose hidden neighbours all must be safe
      // or all must be dynamite; otherwise the least crowded guess.
      const safe = new Set<number>(),
        boom = new Set<number>();
      for (let pass = 0; pass < 4; pass++)
        t.cells.forEach((c, i) => {
          if (!c.revealed || c.face === 'dynamite' || c.n === undefined) return;
          const around = neighbours(t.cols, t.rows, i, true).filter(
            (j) => !t.cells[j].revealed,
          );
          const known =
            around.filter((j) => boom.has(j)).length +
            neighbours(t.cols, t.rows, i, true).filter(
              (j) => t.cells[j].revealed && t.cells[j].face === 'dynamite',
            ).length;
          const open = around.filter((j) => !boom.has(j) && !safe.has(j));
          if (known === c.n) open.forEach((j) => safe.add(j));
          else if (known + open.length === c.n)
            open.forEach((j) => boom.add(j));
        });
      const sure = hidden.find((i) => safe.has(i));
      if (sure !== undefined) return sure;
      const guesses = hidden.filter((i) => !boom.has(i));
      return pick(guesses.length ? guesses : hidden, r);
    }
    case 'sunmoon':
    case 'crown': {
      const goal = mechanicOf(t) === 'sunmoon' ? 'moon' : 'crown';
      return hidden.find((i) => t.cells[i].face === goal) ?? hidden[0];
    }
    case 'chart': {
      const hits = t.cells.flatMap((c, i) =>
        c.revealed && c.face === 'ship' ? [i] : [],
      );
      const sunk = (i: number) =>
        t.ships?.find((s) => s.includes(i))?.every((j) => t.cells[j].revealed);
      const around = hidden.filter((i) =>
        hits.some((h) => !sunk(h) && neighbours(t.cols, t.rows, h).includes(i)),
      );
      const score = (i: number) => {
        const rowLeft =
          (t.rowCounts?.[y(i)] ?? 0) -
          t.cells.filter(
            (c, j) => y(j) === y(i) && c.revealed && c.face === 'ship',
          ).length;
        const colLeft =
          (t.colCounts?.[x(i)] ?? 0) -
          t.cells.filter(
            (c, j) => x(j) === x(i) && c.revealed && c.face === 'ship',
          ).length;
        const nearSunk = neighbours(t.cols, t.rows, i, true).some(
          (j) => t.cells[j].revealed && t.cells[j].face === 'ship' && sunk(j),
        );
        return rowLeft <= 0 || colLeft <= 0 || nearSunk
          ? -1
          : rowLeft * colLeft;
      };
      const pool = (around.length ? around : hidden).sort(
        (a, b) => score(b) - score(a),
      );
      return pool[0];
    }
  }
}
/** The first step of a full Garden route from here, if one exists. */
function gardenRoute(t: ScratchTicket): number | null {
  const n = t.cells.length,
    seen = t.cells.map((c) => c.revealed),
    numbers = t.cells.filter((c) => c.n !== undefined).length;
  let budget = 20000;
  const walk = (at: number, next: number, count: number): boolean => {
    if (--budget < 0) return false;
    if (count === n) return next > numbers;
    for (const i of neighbours(t.cols, t.rows, at)) {
      const c = t.cells[i];
      if (seen[i] || t.walls?.includes(edge(at, i))) continue;
      if (c.n !== undefined && c.n !== next) continue;
      seen[i] = true;
      const ok = walk(i, c.n !== undefined ? next + 1 : next, count + 1);
      seen[i] = false;
      if (ok) return true;
    }
    return false;
  };
  const open = seen.filter(Boolean).length;
  for (let i = 0; i < n; i++) {
    if (!pathStep(t, t.last, i)) continue;
    const c = t.cells[i];
    seen[i] = true;
    const ok = walk(i, c.n !== undefined ? t.next + 1 : t.next, open + 1);
    seen[i] = false;
    if (ok) return i;
  }
  return null;
}
