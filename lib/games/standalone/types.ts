/** Stable storage IDs for the party games. Tribu is `orin` (with Dial inside
 * it) and Sabi is `miro` (with Sizes inside it). Public names live in the
 * registry. The rules marker rejects saves from their retired predecessors. */
export type Difficulty = 'easy' | 'medium' | 'hard';
export type StandaloneId = 'orin' | 'miro' | 'dial' | 'size';

export type LogEntry = { id: number; seat?: number; text: string };

/** Every standalone match carries this; the rules add their own fields. */
export type StandaloneBase = {
  kind: StandaloneId;
  version: 1;
  rngState: number;
  difficulty: Difficulty;
  seats: string[];
  /** Bumped on every applied move so the table can key transitions. */
  revision: number;
  log: LogEntry[];
  over: boolean;
};

/** How a finished match reads on the results plate. */
export type Outcome = {
  /** Headline, e.g. "The coast held" or "Saffron wins". */
  title: string;
  detail: string;
  /** Seats that won; empty when everybody lost together. */
  winners: number[];
  /** Per-seat figure for the score rows, or undefined for shared results.
   * `seat` lets results colour a row by its player; `points` lets them count
   * up to it. */
  rows?: { name: string; value: string; seat?: number; points?: number }[];
};

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Advances the saved state so a reload deals the same match it would have. */
export function roll<T extends { rngState: number }>(state: T) {
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

export function shuffle<T>(list: T[], next: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function note(state: StandaloneBase, text: string, seat?: number) {
  // A missing seat stays missing: JSON drops undefined keys, and a saved match
  // must deep-equal the one it was saved from.
  state.log.push(
    seat === undefined
      ? { id: state.log.length, text }
      : { id: state.log.length, seat, text },
  );
}

/** Bot seats are every seat but yours; seat 0 is always the device owner. */
export const isBot = (seat: number) => seat > 0;
