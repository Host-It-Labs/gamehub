/** Stable storage IDs for the three illustrated worlds pitched in
 * `docs/concepts/2026-09-19-new-game-pitches`. The public names are Orin, Vela and
 * Miro; the IDs are `coast`, `meadow` and `canal` because `orin`, `vela` and `miro`
 * are already spent on the party games that replaced the first build of these.
 * Worlds save under their own key, so a party rule change never invalidates them. */
export type WorldId = 'coast' | 'meadow' | 'canal';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type LogEntry = { id: number; seat?: number; text: string };

/** Every world match carries this; each set of rules adds its own fields. */
export type WorldBase = {
  kind: WorldId;
  version: 1;
  /** Bumped when rules change so incompatible saves are rejected on load. */
  rules: 1;
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
  rows?: { name: string; value: string }[];
};

/** Advances the saved state so a reload deals the match it would have dealt. */
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

export function note(state: WorldBase, text: string, seat?: number) {
  // A missing seat stays missing: JSON drops undefined keys, and a saved match
  // must deep-equal the one it was saved from.
  state.log.push(
    seat === undefined
      ? { id: state.log.length, text }
      : { id: state.log.length, seat, text },
  );
}

/** Seat 0 is always the device owner; every other seat is a bot in solo play. */
export const isBot = (seat: number) => seat > 0;

export const seatNames = (n: number, you: string, rest: string[]) => [
  you,
  ...rest.slice(0, n - 1),
];

export const ints = (
  a: unknown,
  len: number,
  low: number,
  high: number,
): a is number[] =>
  Array.isArray(a) &&
  a.length === len &&
  a.every((x) => Number.isInteger(x) && x >= low && x <= high);

export const bools = (a: unknown, len: number): a is boolean[] =>
  Array.isArray(a) &&
  a.length === len &&
  a.every((x) => typeof x === 'boolean');

/** Shared save-shape gate: everything in `WorldBase`, before per-game checks. */
export function validBase(g: unknown, id: WorldId): g is WorldBase {
  if (!g || typeof g !== 'object') return false;
  const b = g as WorldBase;
  return (
    b.kind === id &&
    b.version === 1 &&
    b.rules === 1 &&
    Number.isInteger(b.rngState) &&
    b.rngState >= 0 &&
    b.rngState <= 4294967295 &&
    ['easy', 'medium', 'hard'].includes(b.difficulty) &&
    Array.isArray(b.seats) &&
    b.seats.length > 0 &&
    b.seats.every((s) => typeof s === 'string' && s.length > 0) &&
    Number.isInteger(b.revision) &&
    b.revision >= 0 &&
    Array.isArray(b.log) &&
    b.log.every(
      (l) =>
        !!l &&
        typeof l.text === 'string' &&
        Number.isInteger(l.id) &&
        (l.seat === undefined ||
          (Number.isInteger(l.seat) && l.seat >= 0 && l.seat < b.seats.length)),
    ) &&
    typeof b.over === 'boolean'
  );
}
