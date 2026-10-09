import { yearEvents, timeline, type YearEra } from './year-events.ts';
import { assertSeats } from './groups.ts';
import {
  shuffle,
  roll,
  note,
  type Difficulty,
  type StandaloneBase,
} from '../standalone/types.ts';
import {
  voteClosed,
  isChoice,
  validVote,
  endRound,
  closeRound,
  botChoice,
  voters,
  type RoundChoice,
  type RoundVote,
  type SetGame,
} from './vote.ts';
import type { TribuState } from './tribu-state.ts';

/** Years, after the timeline dailies: three events a round, one from before
 * 1800, one from 1800–1949 and one since 1950, in a shuffled order. Everyone
 * places a marker on the timeline for each, locks once, and the host reveals
 * them one at a time. Played inside Quiz. */
export type YearMove =
  | { type: 'guess'; step: number; value: number }
  /** Locks all three; may carry them so the last drag and the lock land together. */
  | { type: 'lock'; values?: number[] }
  | { type: 'vote'; choice: RoundChoice }
  | { type: 'unlock' | 'next' };
export type YearGuess = { values: (number | null)[]; locked: boolean };
export type YearGame = StandaloneBase & {
  kind: 'year';
  rules: 1;
  mode: 'individual';
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'guess' | 'reveal' | 'vote';
  /** The round's three event ids. */
  events: number[];
  /** The event being revealed; 0 while guessing. */
  step: number;
  guesses: YearGuess[];
  scores: number[];
  /** Event ids already dealt this match. */
  used: number[];
  vote: RoundVote | null;
  /** Points per revealed event, per seat. */
  gains: number[][];
  tribu?: TribuState;
  handoff?: SetGame | null;
};
export const eventsPerRound = 3;
/** Older events give more room: their years off count for less, so a
 * medieval event and last decade's score alike (2 October 2026). */
export const eraFactor: Record<YearEra, number> = {
  old: 5,
  modern: 2,
  recent: 1,
};
/** Counted years off → points out of 100, straight lines between the
 * marks. */
export const yearCurve = [
  [0, 100],
  [1, 80],
  [2, 70],
  [4, 55],
  [8, 40],
  [15, 20],
  [30, 0],
] as const;
/** The era a year falls in, for scoring. */
export function eraOf(year: number): YearEra {
  return year < 1800 ? 'old' : year < 1950 ? 'modern' : 'recent';
}
export function points(guess: number, year: number) {
  const d = Math.abs(guess - year) / eraFactor[eraOf(year)];
  if (d <= yearCurve[0][0]) return yearCurve[0][1];
  for (let i = 1; i < yearCurve.length; i++) {
    const [d1, p1] = yearCurve[i],
      [d0, p0] = yearCurve[i - 1];
    if (d <= d1) return Math.round(p0 + ((d - d0) / (d1 - d0)) * (p1 - p0));
  }
  return 0;
}
const eras: YearEra[] = ['old', 'modern', 'recent'];
export function createGame(
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
  used: readonly number[] = [],
): YearGame {
  assertSeats(n, 'individual');
  const g: YearGame = {
    kind: 'year',
    version: 1,
    rules: 1,
    rngState: seed >>> 0,
    difficulty,
    seats: Array.from({ length: n }, (_, i) => (i ? `Player ${i + 1}` : 'You')),
    revision: 0,
    log: [],
    over: false,
    mode: 'individual',
    teams: Array.from({ length: n }, (_, i) => i),
    round: 1,
    tutorial: false,
    lesson: 0,
    phase: 'guess',
    events: [],
    step: 0,
    guesses: [],
    scores: Array(n).fill(0),
    used: [...used],
    vote: null,
    gains: [],
  };
  deal(g);
  return g;
}
function deal(g: YearGame) {
  const used = new Set(g.used);
  g.events = shuffle(
    eras.map((era) => {
      const pool = yearEvents.filter((e) => e.era === era && !e.retired),
        fresh = pool.filter((e) => !used.has(e.id));
      const pick = shuffle(fresh.length ? fresh : pool, () => roll(g))[0];
      return pick.id;
    }),
    () => roll(g),
  );
  g.used.push(...g.events);
  g.phase = 'guess';
  g.step = 0;
  g.vote = null;
  g.gains = [];
  g.guesses = g.seats.map(() => ({
    values: Array(eventsPerRound).fill(null),
    locked: false,
  }));
  note(g, `Round ${g.round}: three events to place in time.`);
}
export function actingSeats(g: YearGame): number[] {
  if (g.over || g.phase === 'reveal') return [];
  if (g.phase === 'vote') return voters(g);
  return g.seats.flatMap((_, s) => (g.guesses[s].locked ? [] : [s]));
}
const isYear = (v: unknown): v is number =>
  Number.isInteger(v) &&
  (v as number) >= timeline[0] &&
  (v as number) <= timeline[1];
export function validMove(
  g: YearGame,
  move: unknown,
  seat: number,
): move is YearMove {
  if (
    g.over ||
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat >= g.seats.length ||
    !move ||
    typeof move !== 'object' ||
    Array.isArray(move)
  )
    return false;
  const m = move as YearMove;
  const keys =
    m.type === 'guess'
      ? ['type', 'step', 'value']
      : m.type === 'lock'
        ? ['type', 'values']
        : m.type === 'vote'
          ? ['type', 'choice']
          : ['type'];
  if (Object.keys(m).some((k) => !keys.includes(k))) return false;
  if (g.phase === 'reveal') return m.type === 'next';
  if (g.phase === 'vote')
    return (
      m.type === 'vote' &&
      isChoice(m.choice, g.vote) &&
      g.vote?.choices[seat] !== m.choice
    );
  const b = g.guesses[seat];
  if (m.type === 'unlock') return b.locked;
  if (b.locked) return false;
  if (m.type === 'guess')
    return (
      Number.isInteger(m.step) &&
      m.step >= 0 &&
      m.step < eventsPerRound &&
      isYear(m.value)
    );
  return (
    m.type === 'lock' &&
    (m.values === undefined
      ? b.values.every((v) => v !== null)
      : Array.isArray(m.values) &&
        m.values.length === eventsPerRound &&
        m.values.every(isYear))
  );
}
function reveal(g: YearGame) {
  const e = yearEvents[g.events[g.step]];
  const gains = g.guesses.map((b) =>
    b.values[g.step] === null ? 0 : points(b.values[g.step]!, e.year),
  );
  g.gains.push(gains);
  g.scores = g.scores.map((v, s) => v + gains[s]);
  g.phase = 'reveal';
  note(
    g,
    `${e.text}: ${e.year}. ${g.seats.map((name, s) => `${name} +${gains[s]}`).join(', ')}.`,
  );
}
export function play(
  g: YearGame,
  m: YearMove,
  s: number,
  now = Date.now(),
): YearGame {
  if (!validMove(g, m, s)) return g;
  if (g.phase === 'vote' && g.vote && voteClosed(g.vote, now))
    return tick(g, now);
  const n = structuredClone(g);
  n.revision++;
  if (n.phase === 'guess') {
    const b = n.guesses[s];
    if (m.type === 'guess') b.values[m.step] = m.value;
    if (m.type === 'lock') {
      if (m.values) b.values = [...m.values];
      b.locked = true;
    }
    if (m.type === 'unlock') b.locked = false;
    if (n.guesses.every((x) => x.locked)) {
      n.step = 0;
      reveal(n);
    }
  } else if (n.phase === 'reveal') {
    if (n.step < eventsPerRound - 1) {
      n.step++;
      reveal(n);
    } else endRound(n, now);
  } else if (m.type === 'vote') {
    n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return close(n);
  }
  return n;
}
function close(g: YearGame) {
  return closeRound(g, deal);
}
export function tick(g: YearGame, now = Date.now()): YearGame {
  if (g.over || g.phase !== 'vote' || !g.vote || !voteClosed(g.vote, now))
    return g;
  const n = structuredClone(g);
  n.revision++;
  return close(n);
}
/** How many events the viewer may see answered. */
export function shown(g: YearGame) {
  return g.phase === 'guess' ? 0 : g.step + 1;
}
export function observe(g: YearGame, viewer: number): YearGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.used = [];
  const open = shown(n);
  // Another seat's markers stay hidden until their event is revealed.
  n.guesses = n.guesses.map((b, s) =>
    s === viewer
      ? b
      : { ...b, values: b.values.map((v, i) => (i < open ? v : null)) },
  );
  return n;
}
export function botMove(g: YearGame, s: number): YearMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'vote') return { type: 'vote', choice: botChoice(g, s) };
  const b = g.guesses[s],
    step = b.values.findIndex((v) => v === null);
  if (step < 0) return { type: 'lock' };
  // Bots guess from the event's era only, never its year.
  const era = yearEvents[g.events[step]].era,
    [lo, hi] =
      era === 'old'
        ? [1000, 1799]
        : era === 'modern'
          ? [1800, 1949]
          : [1950, 2024];
  const h = (s * 7919 + g.events[step] * 104729 + g.round * 31) >>> 0;
  return { type: 'guess', step, value: lo + (h % (hi - lo + 1)) };
}
export function validState(g: YearGame) {
  const n = g.seats.length,
    revealed = g.phase === 'guess' ? 0 : g.step + 1,
    id = (i: unknown) => Number.isInteger(i) && !!yearEvents[i as number];
  return (
    g.rules === 1 &&
    g.mode === 'individual' &&
    Array.isArray(g.teams) &&
    g.teams.length === n &&
    g.teams.every((t, s) => t === s) &&
    Array.isArray(g.scores) &&
    g.scores.length === n &&
    g.scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e5) &&
    ['guess', 'reveal', 'vote'].includes(g.phase) &&
    (g.phase === 'vote' ? validVote(g.vote, n) : !g.vote) &&
    Number.isInteger(g.step) &&
    g.step >= 0 &&
    g.step < eventsPerRound &&
    (g.phase !== 'guess' || g.step === 0) &&
    (g.phase !== 'vote' || g.step === eventsPerRound - 1) &&
    Array.isArray(g.used) &&
    g.used.every(id) &&
    Array.isArray(g.events) &&
    g.events.length === eventsPerRound &&
    g.events.every(id) &&
    Array.isArray(g.guesses) &&
    g.guesses.length === n &&
    g.guesses.every(
      (b) =>
        !!b &&
        typeof b.locked === 'boolean' &&
        Array.isArray(b.values) &&
        b.values.length === eventsPerRound &&
        b.values.every((v) => v === null || isYear(v)) &&
        (!b.locked || b.values.every((v) => v !== null)),
    ) &&
    (g.phase === 'guess' || g.guesses.every((b) => b.locked)) &&
    Array.isArray(g.gains) &&
    g.gains.length === revealed &&
    g.gains.every(
      (v) =>
        Array.isArray(v) &&
        v.length === n &&
        v.every((x) => Number.isInteger(x) && x >= 0 && x <= 100),
    )
  );
}
