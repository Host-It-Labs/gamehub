import { requireThat, rng, type KindModule } from '../kind.ts';
import { BIG, SMALL } from '../nonogram-data.ts';

/** Cell marks: 0 empty, 1 filled, 2 crossed (marked blank). */
export type NonogramMark = 0 | 1 | 2;
export type NonogramView = {
  size: number;
  /** Run lengths per row, top to bottom; an empty row is []. */
  rows: number[][];
  /** Run lengths per column, left to right. */
  cols: number[][];
  /** Row-major marks, size × size. */
  cells: NonogramMark[];
  /** Cells marked by a mistake: a red cross, or a red-outlined fill. */
  wrong: number[];
  big: boolean;
  /** Set on reveal. */
  solution?: string[];
  name?: string;
};
type NonogramSecret = { rows: string[]; name: string };

const runs = (line: boolean[]) => {
  const out: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
};
const filled = (secret: NonogramSecret, i: number, size: number) =>
  secret.rows[Math.floor(i / size)][i % size] === '#';
const line = (size: number, index: number, isRow: boolean) =>
  Array.from({ length: size }, (_, k) =>
    isRow ? index * size + k : k * size + index,
  );

/** Like Nonogram.com: a finished row or column crosses its remaining blanks. */
function autoCross(view: NonogramView) {
  const { size, cells } = view;
  for (const isRow of [true, false])
    for (let i = 0; i < size; i++) {
      const idx = line(size, i, isRow);
      const need = (isRow ? view.rows : view.cols)[i].reduce(
        (a, b) => a + b,
        0,
      );
      if (idx.filter((c) => cells[c] === 1).length === need)
        for (const c of idx) if (cells[c] === 0) cells[c] = 2;
    }
}
const solvedBy = (view: NonogramView, secret: NonogramSecret) =>
  view.cells.every((m, i) => m === 1 || !filled(secret, i, view.size));

export const nonogram: KindModule<NonogramView, NonogramSecret> = {
  make({ seed, level, boss }) {
    const pool = boss
      ? BIG
      : SMALL.filter((p) => p.level === Math.min(3, level));
    const random = rng(seed);
    random();
    const pic = pool[Math.floor(random() * pool.length)];
    const size = pic.rows.length;
    const grid = pic.rows.map((r) => r.split('').map((c) => c === '#'));
    return {
      view: {
        size,
        rows: grid.map(runs),
        cols: Array.from({ length: size }, (_, c) =>
          runs(grid.map((r) => r[c])),
        ),
        cells: Array.from({ length: size * size }, () => 0 as const),
        wrong: [],
        big: boss,
      },
      secret: { rows: [...pic.rows], name: pic.name },
      allowance: 3,
      budget: 'lives',
    };
  },
  move(view, secret, move) {
    const { size } = view;
    const { cells, mark } = move;
    requireThat(mark === 'fill' || mark === 'cross', 'Choose fill or cross.');
    requireThat(
      Array.isArray(cells) &&
        cells.length >= 1 &&
        cells.length <= size &&
        cells.every((c) => Number.isInteger(c) && c >= 0 && c < size * size),
      'Pick squares on the grid.',
    );
    const list = cells as number[];
    if (list.length > 1) {
      const step = list[1] - list[0];
      const sameRow = Math.abs(step) === 1;
      requireThat(
        sameRow || Math.abs(step) === size,
        'Mark one straight line at a time.',
      );
      for (let k = 1; k < list.length; k++) {
        requireThat(
          list[k] - list[k - 1] === step,
          'Mark one straight line at a time.',
        );
        if (sameRow)
          requireThat(
            Math.floor(list[k] / size) === Math.floor(list[0] / size),
            'Mark one straight line at a time.',
          );
      }
    }
    requireThat(
      list.some((c) => view.cells[c] === 0),
      'Those squares are already marked.',
    );
    let cost = 0;
    for (const c of list) {
      if (view.cells[c] !== 0) continue;
      const should = filled(secret, c, size);
      if (mark === 'fill') {
        if (should) view.cells[c] = 1;
        else {
          view.cells[c] = 2;
          view.wrong.push(c);
          cost = 1;
          break;
        }
      } else if (!should) view.cells[c] = 2;
      else {
        view.cells[c] = 1;
        view.wrong.push(c);
        cost = 1;
        break;
      }
    }
    autoCross(view);
    return { cost, solved: solvedBy(view, secret) };
  },
  reveal(view, secret) {
    view.solution = [...secret.rows];
    view.name = secret.name;
    return secret.name.replace(/^./, (c) => c.toUpperCase());
  },
  win(view, secret) {
    const i = view.cells.findIndex(
      (m, c) => m === 0 && filled(secret, c, view.size),
    );
    return { cells: [i], mark: 'fill' };
  },
  lose(view, secret) {
    const i = view.cells.findIndex(
      (m, c) => m === 0 && !filled(secret, c, view.size),
    );
    if (i >= 0) return { cells: [i], mark: 'fill' };
    // Every blank is already crossed: crossing a picture square is also a mistake.
    return { ...nonogram.win(view, secret), mark: 'cross' };
  },
};
