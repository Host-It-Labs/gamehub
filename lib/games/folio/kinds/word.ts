import { grade, pick, requireThat, rng, type KindModule } from '../kind.ts';
import { ANSWERS, answersFor, GUESSES } from '../words.ts';

export type WordView = {
  rows: number;
  hard: boolean;
  guesses: { word: string; marks: number[] }[];
  answer?: string;
};
type WordSecret = { answer: string };
const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th'][n];

/** Wordle's Hard Mode: revealed hints must be used in later guesses. */
export function hardModeProblem(
  guess: string,
  history: { word: string; marks: number[] }[],
) {
  for (const h of history) {
    for (let i = 0; i < 5; i++)
      if (h.marks[i] === 2 && guess[i] !== h.word[i])
        return `${ordinal(i)} letter must be ${h.word[i]}`;
    const need: Record<string, number> = {};
    h.word.split('').forEach((c, i) => {
      if (h.marks[i] > 0) need[c] = (need[c] ?? 0) + 1;
    });
    for (const [c, n] of Object.entries(need))
      if (guess.split(c).length - 1 < n) return `Guess must contain ${c}`;
  }
  return null;
}
export const word: KindModule<WordView, WordSecret> = {
  make({ seed, boss, level }) {
    const answer = pick(answersFor(level), rng(seed));
    return {
      view: { rows: 6, hard: boss, guesses: [] },
      secret: { answer },
      allowance: 6,
      budget: 'guesses',
    };
  },
  move(view, secret, move) {
    const guess =
      typeof move.guess === 'string' ? move.guess.toUpperCase() : '';
    requireThat(/^[A-Z]{5}$/.test(guess), 'Not enough letters');
    requireThat(
      GUESSES.has(guess) || guess === secret.answer,
      'Not in word list',
    );
    if (view.hard) {
      const problem = hardModeProblem(guess, view.guesses);
      requireThat(!problem, problem!);
    }
    view.guesses.push({ word: guess, marks: grade(guess, secret.answer) });
    return { cost: 1, solved: guess === secret.answer };
  },
  reveal(view, secret) {
    view.answer = secret.answer;
    return secret.answer;
  },
  win: (_view, secret) => ({ guess: secret.answer }),
  lose(view, secret) {
    const candidate = ANSWERS.find(
      (w) =>
        w !== secret.answer &&
        !view.guesses.some((g) => g.word === w) &&
        (!view.hard || !hardModeProblem(w, view.guesses)),
    );
    // In hard mode a legal wrong guess always exists unless only the answer fits.
    return { guess: candidate ?? secret.answer };
  },
};
