import type { Level } from './types.ts';

/**
 * Contract every Folio game implements on the server. Views are public and
 * sent to every player; secrets never leave the server until `reveal`.
 */
export type KindContext = {
  /** 1 easy, 2 medium, 3 hard, 4 very hard; bosses take their act's level. */
  level: Level;
  /** Boss variant: the harder published variant of the same game. */
  boss: boolean;
  seed: number;
};
export type Made<V, S> = {
  view: V;
  secret: S;
  /** The original game's own allowance, e.g. 6 guesses or 3 mistakes. */
  allowance: number;
  /** Plural noun shown next to the allowance. */
  budget: string;
};
export type MoveResult = {
  /** Allowance spent by this move; 0 for free moves such as correct placements. */
  cost: number;
  solved: boolean;
};
export type KindModule<V, S> = {
  make(ctx: KindContext): Made<V, S>;
  /**
   * Validate and apply one move, mutating the view. Throw an Error with a
   * player-facing message to reject a move without spending anything.
   */
  move(view: V, secret: S, move: Record<string, unknown>): MoveResult;
  /** Copy the solution into the view once the puzzle ends; return the answer text. */
  reveal(view: V, secret: S, won: boolean): string;
  /** Test drill: the next move of a perfect player. */
  win(view: V, secret: S): Record<string, unknown>;
  /** Test drill: the next move that spends allowance without solving. */
  lose(view: V, secret: S): Record<string, unknown>;
};
export function requireThat(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function rng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function shuffle<T>(values: readonly T[], random: () => number) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function pick<T>(values: readonly T[], random: () => number) {
  return values[Math.floor(random() * values.length)];
}
export function hash(text: string) {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
/** Wordle-style grading: 2 exact, 1 elsewhere, 0 absent; repeated letters consume occurrences. */
export function grade(guess: string, answer: string) {
  const left: (string | null)[] = answer.split('');
  const marks: number[] = guess.split('').map((c, i) => {
    if (c === left[i]) {
      left[i] = null;
      return 2;
    }
    return 0;
  });
  guess.split('').forEach((c, i) => {
    if (marks[i] === 2) return;
    const at = left.indexOf(c);
    if (at >= 0) {
      marks[i] = 1;
      left[at] = null;
    }
  });
  return marks;
}
export const int = (v: unknown, min: number, max: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
