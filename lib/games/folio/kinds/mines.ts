import {
  hash,
  int,
  requireThat,
  rng,
  shuffle,
  type KindModule,
} from '../kind.ts';

/**
 * Classic Minesweeper. Cells are row-major. In `cells`, -1 is hidden, 0..8 an
 * opened square showing its neighbouring mine count, and 9 a mine that was
 * opened (only possible when an extra life let play continue).
 */
export type MinesView = {
  size: number;
  count: number;
  cells: number[];
  flags: boolean[];
  /** Bumped on every accepted open or chord, with the square it started from. */
  turn: number;
  last: number;
  /** Mine squares, filled in by reveal only. */
  mines?: number[];
};
type MinesSecret = { seed: number; mines: number[] | null };
export const MINE = 9;
const SIZES: Record<string, [number, number]> = {
  '1': [9, 10],
  '2': [10, 15],
  '3': [12, 24],
  '4': [12, 28],
  boss: [16, 40],
};
const MAX_ATTEMPTS = 400;

export function neighbours(i: number, size: number) {
  const x = i % size,
    y = (i - x) / size,
    out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size)
        out.push(ny * size + nx);
    }
  return out;
}
function counts(size: number, mineSet: Set<number>) {
  return Array.from({ length: size * size }, (_, i) =>
    mineSet.has(i)
      ? MINE
      : neighbours(i, size).filter((n) => mineSet.has(n)).length,
  );
}

/**
 * Deterministic no-guess solver: starting from `first`, clears the board with
 * single-square rules, pairwise (subset/overlap) constraint reasoning and the
 * global mine count. Returns true when every safe square is deduced.
 */
export function solvable(size: number, mineSet: Set<number>, first: number) {
  const total = size * size,
    nums = counts(size, mineSet),
    nb = Array.from({ length: total }, (_, i) => neighbours(i, size));
  const open = new Uint8Array(total),
    mine = new Uint8Array(total);
  let opened = 0,
    marked = 0;
  const safeTarget = total - mineSet.size;
  const reveal = (start: number) => {
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      if (open[i]) continue;
      if (nums[i] === MINE) return false;
      open[i] = 1;
      opened++;
      if (nums[i] === 0) for (const n of nb[i]) if (!open[n]) stack.push(n);
    }
    return true;
  };
  if (!reveal(first)) return false;
  while (opened < safeTarget) {
    let progress = false;
    type C = { cells: number[]; left: number };
    const cons: C[] = [];
    for (let i = 0; i < total; i++) {
      if (!open[i] || !nums[i]) continue;
      const cells: number[] = [];
      let left = nums[i];
      for (const n of nb[i]) {
        if (mine[n]) left--;
        else if (!open[n]) cells.push(n);
      }
      if (!cells.length) continue;
      if (left === 0) {
        for (const c of cells) if (!open[c]) reveal(c);
        progress = true;
      } else if (left === cells.length) {
        for (const c of cells)
          if (!mine[c]) {
            mine[c] = 1;
            marked++;
          }
        progress = true;
      } else cons.push({ cells, left });
    }
    if (progress) continue;
    // Pairwise reasoning: if A needs as many more mines than B as A has
    // squares outside B, those squares are mines and B's own squares are safe.
    const byCell = new Map<number, number[]>();
    cons.forEach((c, k) =>
      c.cells.forEach((cell) => {
        const list = byCell.get(cell);
        if (list) list.push(k);
        else byCell.set(cell, [k]);
      }),
    );
    for (let a = 0; a < cons.length && !progress; a++) {
      const A = cons[a];
      const partners = new Set<number>();
      for (const cell of A.cells)
        for (const k of byCell.get(cell)!) if (k !== a) partners.add(k);
      for (const b of partners) {
        const B = cons[b];
        const onlyA = A.cells.filter((c) => !B.cells.includes(c));
        if (A.left - B.left !== onlyA.length) continue;
        const onlyB = B.cells.filter((c) => !A.cells.includes(c));
        if (!onlyA.length && !onlyB.length) continue;
        for (const c of onlyA)
          if (!mine[c]) {
            mine[c] = 1;
            marked++;
          }
        for (const c of onlyB) if (!open[c]) reveal(c);
        progress = true;
        break;
      }
    }
    if (progress) continue;
    // Global count: every mine found means the rest is safe, and vice versa.
    const unknown: number[] = [];
    for (let i = 0; i < total; i++) if (!open[i] && !mine[i]) unknown.push(i);
    const leftMines = mineSet.size - marked;
    if (leftMines === 0) {
      for (const c of unknown) reveal(c);
      continue;
    }
    if (leftMines === unknown.length) return opened === safeTarget;
    return false;
  }
  return true;
}

/** Mines for a board whose first open is `first`: a zero, solvable without guessing. */
export function layMines(
  seed: number,
  size: number,
  count: number,
  first: number,
) {
  const random = rng(hash(`mines:${seed}:${first}`));
  const keep = new Set([first, ...neighbours(first, size)]);
  const pool = Array.from({ length: size * size }, (_, i) => i).filter(
    (i) => !keep.has(i),
  );
  let fallback: number[] | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const mines = shuffle(pool, random)
      .slice(0, count)
      .sort((a, b) => a - b);
    fallback ??= mines;
    if (solvable(size, new Set(mines), first)) return mines;
  }
  return fallback!;
}

function openFrom(view: MinesView, nums: number[], start: number) {
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (view.cells[i] !== -1 || view.flags[i]) continue;
    view.cells[i] = nums[i];
    if (nums[i] === 0) for (const n of neighbours(i, view.size)) stack.push(n);
  }
}
function numbers(view: MinesView, secret: MinesSecret) {
  return counts(view.size, new Set(secret.mines));
}
const solvedBoard = (view: MinesView) =>
  view.cells.filter((c) => c >= 0 && c < MINE).length ===
  view.size * view.size - view.count;

const centreOf = (size: number) => (size >> 1) * size + (size >> 1);

export const mines: KindModule<MinesView, MinesSecret> = {
  make({ seed, level, boss }) {
    const [size, count] = SIZES[boss ? 'boss' : String(level)];
    return {
      view: {
        size,
        count,
        cells: Array(size * size).fill(-1),
        flags: Array(size * size).fill(false),
        turn: 0,
        last: -1,
      },
      secret: { seed, mines: null },
      allowance: 1,
      budget: 'lives',
    };
  },
  move(view, secret, move) {
    const keys = Object.keys(move);
    requireThat(keys.length === 1, 'Use the board to play.');
    const [kind] = keys;
    requireThat(
      kind === 'open' || kind === 'flag' || kind === 'chord',
      'Use the board to play.',
    );
    const i = move[kind];
    requireThat(
      int(i, 0, view.size * view.size - 1),
      'That square is not on the board.',
    );
    const at = i as number;
    if (kind === 'flag') {
      requireThat(view.cells[at] === -1, 'That square is already open.');
      view.flags[at] = !view.flags[at];
      return { cost: 0, solved: false };
    }
    if (kind === 'open') {
      requireThat(view.cells[at] === -1, 'That square is already open.');
      requireThat(!view.flags[at], 'Remove the flag first.');
      if (!secret.mines)
        secret.mines = layMines(secret.seed, view.size, view.count, at);
      const nums = numbers(view, secret);
      view.turn++;
      view.last = at;
      if (nums[at] === MINE) {
        view.cells[at] = MINE;
        return { cost: 1, solved: false };
      }
      openFrom(view, nums, at);
      return { cost: 0, solved: solvedBoard(view) };
    }
    const n = view.cells[at];
    requireThat(n > 0 && n < MINE, 'Chord on an opened number.');
    const around = neighbours(at, view.size);
    const marked = around.filter(
      (c) => view.flags[c] || view.cells[c] === MINE,
    ).length;
    requireThat(
      marked === n,
      `Flag ${n} square${n === 1 ? '' : 's'} around it first.`,
    );
    const targets = around.filter(
      (c) => view.cells[c] === -1 && !view.flags[c],
    );
    requireThat(targets.length, 'Nothing left to open around it.');
    const nums = numbers(view, secret);
    view.turn++;
    view.last = at;
    let cost = 0;
    for (const c of targets) {
      if (nums[c] === MINE) {
        view.cells[c] = MINE;
        cost++;
      } else openFrom(view, nums, c);
    }
    return { cost, solved: !cost && solvedBoard(view) };
  },
  reveal(view, secret, won) {
    secret.mines ??= layMines(
      secret.seed,
      view.size,
      view.count,
      centreOf(view.size),
    );
    view.mines = [...secret.mines];
    if (won) for (const m of secret.mines) view.flags[m] = true;
    return won ? 'Field cleared' : `${view.count} mines`;
  },
  win(view, secret) {
    const centre = centreOf(view.size);
    if (!secret.mines)
      return view.flags[centre] ? { flag: centre } : { open: centre };
    const mineSet = new Set(secret.mines);
    const safe = view.cells.findIndex((c, i) => c === -1 && !mineSet.has(i));
    return view.flags[safe] ? { flag: safe } : { open: safe };
  },
  lose(view, secret) {
    if (!secret.mines) return { open: centreOf(view.size) };
    const target = secret.mines.find(
      (m) => view.cells[m] === -1 && !view.flags[m],
    );
    if (target !== undefined) return { open: target };
    const flagged = secret.mines.find((m) => view.cells[m] === -1)!;
    return { flag: flagged };
  },
};
