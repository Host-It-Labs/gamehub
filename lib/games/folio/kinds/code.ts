import { int, requireThat, rng, shuffle, type KindModule } from '../kind.ts';

export type CodeRow = { code: number[]; black: number; white: number };
export type CodeView = {
  /** Holes per row: 4, or 5 for Super Mastermind. */
  pegs: number;
  /** Colours to choose from: 6, or 8 for Super Mastermind. */
  colours: number;
  /** Rows on the board, as printed on the original. */
  rows: number;
  /** Whether the hidden code may repeat a colour. */
  repeats: boolean;
  guesses: CodeRow[];
  /** The hidden code, copied in on reveal. */
  answer?: number[];
};
type CodeSecret = { answer: number[] };

/** Classic Mastermind scoring: blacks exact, whites common colours minus blacks. */
export function score(guess: readonly number[], answer: readonly number[]) {
  let black = 0;
  const g: Record<number, number> = {};
  const a: Record<number, number> = {};
  guess.forEach((c, i) => {
    if (c === answer[i]) black++;
    g[c] = (g[c] ?? 0) + 1;
    a[answer[i]] = (a[answer[i]] ?? 0) + 1;
  });
  let common = 0;
  for (const c in g) common += Math.min(g[c], a[c] ?? 0);
  return { black, white: common - black };
}

/** Peg names, matching the palette in components/game/folio-kinds/code.tsx. */
const NAMES = [
  'Red',
  'Blue',
  'Yellow',
  'Green',
  'Purple',
  'Sky',
  'Pink',
  'Brown',
];
const same = (x: readonly number[], y: readonly number[]) =>
  x.length === y.length && x.every((v, i) => v === y[i]);

export const code: KindModule<CodeView, CodeSecret> = {
  make({ seed, boss, level }) {
    const random = rng(seed);
    const pegs = boss ? 5 : 4;
    const colours = boss ? 8 : 6;
    const rows = boss ? 12 : 10;
    const repeats = boss || level > 1;
    const roll = () =>
      Array.from({ length: pegs }, () => Math.floor(random() * colours));
    let answer = repeats
      ? roll()
      : shuffle(
          Array.from({ length: colours }, (_, i) => i),
          random,
        ).slice(0, pegs);
    // Very hard codes always repeat a colour, the hardest codes to read.
    while (!boss && level === 4 && new Set(answer).size === pegs)
      answer = roll();
    return {
      view: { pegs, colours, rows, repeats, guesses: [] },
      secret: { answer },
      allowance: rows,
      budget: 'rows',
    };
  },
  move(view, secret, move) {
    const guess = move.guess;
    requireThat(
      Array.isArray(guess) && guess.length === view.pegs,
      `Fill all ${view.pegs} holes`,
    );
    requireThat(
      guess.every((c) => int(c, 0, view.colours - 1)),
      'Unknown colour',
    );
    const row = guess as number[];
    requireThat(
      !view.guesses.some((g) => same(g.code, row)),
      'Already played that row',
    );
    const { black, white } = score(row, secret.answer);
    view.guesses.push({ code: [...row], black, white });
    return { cost: 1, solved: black === view.pegs };
  },
  reveal(view, secret) {
    view.answer = [...secret.answer];
    return secret.answer.map((c) => NAMES[c]).join(' · ');
  },
  win: (_view, secret) => ({ guess: [...secret.answer] }),
  lose(view, secret) {
    const total = view.colours ** view.pegs;
    for (let n = 0; n < total; n++) {
      const c = Array.from(
        { length: view.pegs },
        (_, i) => Math.floor(n / view.colours ** i) % view.colours,
      );
      if (same(c, secret.answer) || view.guesses.some((g) => same(g.code, c)))
        continue;
      return { guess: c };
    }
    return { guess: [...secret.answer] };
  },
};
