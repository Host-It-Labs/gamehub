import { int, requireThat, rng, shuffle, type KindModule } from '../kind.ts';
import { SUDOKU_BANK } from '../sudoku-data.ts';

/**
 * Classic 9×9 Sudoku with the Sudoku.com / NYT rule: a wrong number is a
 * mistake and stays on the board in red until erased; the third mistake ends
 * the puzzle. `grid` holds givens and correct placements only.
 */
export type SudokuView = {
  tier: 'easy' | 'medium' | 'hard' | 'expert';
  /** 81 cells, 0 = empty. Givens plus digits placed correctly. */
  grid: number[];
  /** 81 flags: 1 for starting numbers. */
  given: number[];
  /** 81 cells: a wrong digit a player entered (shown in red), else 0. */
  wrong: number[];
  /** The full solution, only after the puzzle ends. */
  solution?: number[];
};
type SudokuSecret = { solution: number[] };

const TIERS = ['easy', 'medium', 'hard', 'expert'] as const;

/** Relabel digits, permute rows/cols within bands, permute bands/stacks, maybe transpose. */
function disguise(puzzle: string, solution: string, random: () => number) {
  const digits = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)];
  const lines = () =>
    shuffle([0, 1, 2], random).flatMap((band) =>
      shuffle([0, 1, 2], random).map((r) => band * 3 + r),
    );
  const rows = lines();
  const cols = lines();
  const flip = random() < 0.5;
  const map = (s: string) =>
    Array.from({ length: 81 }, (_, i) => {
      let r = rows[Math.floor(i / 9)];
      let c = cols[i % 9];
      if (flip) [r, c] = [c, r];
      return digits[Number(s[r * 9 + c])];
    });
  return { grid: map(puzzle), solution: map(solution) };
}

export const sudoku: KindModule<SudokuView, SudokuSecret> = {
  make({ seed, level, boss }) {
    const random = rng(seed);
    const tier = boss ? 'expert' : TIERS[Math.min(4, Math.max(1, level)) - 1];
    const bank = SUDOKU_BANK[tier];
    const [p, s] = bank[Math.floor(random() * bank.length)];
    const { grid, solution } = disguise(p, s, random);
    return {
      view: {
        tier,
        grid,
        given: grid.map((d) => (d ? 1 : 0)),
        wrong: grid.map(() => 0),
      },
      secret: { solution },
      allowance: 3,
      budget: 'mistakes',
    };
  },
  move(view, secret, move) {
    const cell = move.cell;
    requireThat(int(cell, 0, 80), 'Pick a square');
    const i = cell as number;
    requireThat(
      !view.grid[i],
      view.given[i] ? 'That number is given' : 'That square is already solved',
    );
    if (move.erase === true) {
      requireThat(
        move.digit === undefined,
        'Erase or enter a number, not both',
      );
      requireThat(view.wrong[i], 'Nothing to erase');
      view.wrong[i] = 0;
      return { cost: 0, solved: false };
    }
    requireThat(move.erase === undefined || move.erase === false, 'Bad erase');
    requireThat(int(move.digit, 1, 9), 'Pick a number from 1 to 9');
    const d = move.digit as number;
    requireThat(view.wrong[i] !== d, 'That number is already there');
    if (secret.solution[i] === d) {
      view.grid[i] = d;
      view.wrong[i] = 0;
      return { cost: 0, solved: view.grid.every((v) => v) };
    }
    view.wrong[i] = d;
    return { cost: 1, solved: false };
  },
  reveal(view, secret, won) {
    view.solution = [...secret.solution];
    return won ? 'Grid complete' : 'The solution is filled in';
  },
  win(view, secret) {
    const cell = view.grid.findIndex((v) => !v);
    return { cell, digit: secret.solution[cell] };
  },
  lose(view, secret) {
    const cell = view.grid.findIndex((v) => !v);
    let digit = (secret.solution[cell] % 9) + 1;
    if (digit === view.wrong[cell]) digit = (digit % 9) + 1;
    if (digit === secret.solution[cell]) digit = (digit % 9) + 1;
    return { cell, digit };
  },
};
