import countries from './size-countries.json' with { type: 'json' };
import { things, type SizeThing } from './size-things.ts';
import { assertSeats } from './groups.ts';
import {
  shuffle,
  roll,
  note,
  type Difficulty,
  type StandaloneBase,
} from '../standalone/types.ts';
import {
  openVote,
  voteClosed,
  voteResult,
  isChoice,
  maxRounds,
  type RoundChoice,
  type RoundVote,
  type SetGame,
} from './vote.ts';
import type { TribuState } from './tribu-state.ts';

/** Sizes, after Magnitudle's Size It Up: a reference silhouette stands at
 * true scale and everyone privately resizes a second silhouette to match its
 * real-world size. Each round has three comparisons: an animal, an object or
 * landmark, then a country. Everyone sizes all three, locks once, and the
 * host then reveals them one at a time. Played inside Sabi, next to Atlas. */
export type SizeMove =
  /** Sets the guess for one comparison of the round. */
  | { type: 'guess'; step: number; value: number }
  /** Locks all three guesses; may carry them, so the last drag and the lock
   * land together. */
  | { type: 'lock'; values?: number[] }
  | { type: 'vote'; choice: RoundChoice }
  | { type: 'unlock' | 'next' };
export type SizeKind = 'thing' | 'country';
export type SizeQuestion = {
  kind: SizeKind;
  /** Shown at true scale. */
  ref: string;
  /** Resized by the players. */
  target: string;
  /** The target's true size along its measured side (m, or km for
   * countries); -1 while hidden from the viewer. */
  answer: number;
};
export type SizeGuess = { values: (number | null)[]; locked: boolean };
export type SizeGame = StandaloneBase & {
  kind: 'size';
  rules: 2;
  mode: 'individual';
  /** Everyone plays for themselves; kept so shared party screens can group seats. */
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  /** Everyone guesses all three, the comparisons are revealed one by one,
   * then the round votes. */
  phase: 'guess' | 'reveal' | 'vote';
  questions: SizeQuestion[];
  /** The comparison being revealed; 0 while guessing. */
  step: number;
  /** Each seat's three guesses this round, locked together. */
  guesses: SizeGuess[];
  scores: number[];
  /** Pair keys and item ids already dealt this match, so rounds stay fresh. */
  used: string[];
  vote: RoundVote | null;
  /** Points per revealed comparison, per seat. */
  gains: number[][];
  /** Present while this game is part of a set such as Sabi. */
  tribu?: TribuState;
  /** Set when the table voted to switch games; the registry swaps the state. */
  handoff?: SetGame | null;
};
export const questionsPerRound = 3;
/** A guess is a real size in the target's unit; anything sane is allowed. */
export const guessRange = [1e-4, 1e6] as const;
/** Size It Up's curve: relative error → points out of 100, straight lines
 * between the marks. */
export const curve = [
  [0.06, 100],
  [0.12, 90],
  [0.2, 78],
  [0.32, 62],
  [0.5, 45],
  [0.75, 30],
  [1.1, 18],
  [1.6, 0],
] as const;
export function offBy(guess: number, answer: number) {
  return Math.abs(guess - answer) / answer;
}
export function points(guess: number, answer: number) {
  if (!(guess > 0) || !(answer > 0)) return 0;
  const e = offBy(guess, answer);
  if (e <= curve[0][0]) return 100;
  for (let i = 1; i < curve.length; i++) {
    const [e1, p1] = curve[i],
      [e0, p0] = curve[i - 1];
    if (e <= e1) return Math.round(p0 + ((e - e0) / (e1 - e0)) * (p1 - p0));
  }
  return 0;
}

export type SizeCountry = (typeof countries)[number];
export function country(id: string): SizeCountry | undefined {
  return countries.find((c) => c.id === id);
}
export function thing(id: string): SizeThing | undefined {
  return things.find((t) => t.id === id);
}
/** What a silhouette measures: the side, the true value and its unit. */
export function measure(kind: SizeKind, id: string) {
  if (kind === 'country') {
    const c = country(id)!;
    const wide = c.width >= c.height;
    return {
      axis: wide ? ('w' as const) : ('h' as const),
      dimension: wide ? 'east to west' : 'north to south',
      real: wide ? c.width : c.height,
      unit: 'km' as const,
    };
  }
  const t = thing(id)!;
  return {
    axis: t.axis,
    dimension: t.dimension,
    real: t.real,
    unit: 'm' as const,
  };
}
type Item = { id: string; real: number };
const pools: Record<number, Item[]> = {
  // An animal, then an object or landmark, then a country.
  0: things.filter((t) => t.sheet === 'animals'),
  1: things.filter((t) => t.sheet !== 'animals'),
  2: countries.map((c) => ({ id: c.id, real: Math.max(c.width, c.height) })),
};
const references: Record<number, Item[]> = {
  0: things,
  1: things,
  2: pools[2],
};
/** The target is between a fifth and eight times the reference, so both fit
 * on screen with a little zooming. */
const ratio = [0.2, 8] as const;
function pick(g: SizeGame, slot: number) {
  const used = new Set(g.used),
    pairs: { ref: Item; target: Item; fresh: number }[] = [];
  for (const target of pools[slot])
    for (const ref of references[slot]) {
      const r = target.real / ref.real;
      if (
        ref.id === target.id ||
        r < ratio[0] ||
        r > ratio[1] ||
        used.has(`${ref.id}>${target.id}`)
      )
        continue;
      pairs.push({
        ref,
        target,
        fresh: Number(!used.has(target.id)) * 2 + Number(!used.has(ref.id)),
      });
    }
  const best = Math.max(...pairs.map((p) => p.fresh));
  const choice = shuffle(
    pairs.filter((p) => p.fresh === best),
    () => roll(g),
  )[0];
  g.used.push(
    `${choice.ref.id}>${choice.target.id}`,
    choice.ref.id,
    choice.target.id,
  );
  return choice;
}
function deal(g: SizeGame) {
  g.questions = [0, 1, 2].map((slot) => {
    const { ref, target } = pick(g, slot);
    return {
      kind: slot === 2 ? 'country' : 'thing',
      ref: ref.id,
      target: target.id,
      answer: target.real,
    };
  });
  g.phase = 'guess';
  g.step = 0;
  g.vote = null;
  g.gains = [];
  g.guesses = g.seats.map(() => ({
    values: Array(questionsPerRound).fill(null),
    locked: false,
  }));
  note(g, `Round ${g.round}: three silhouettes to size up.`);
}
export function createGame(
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
): SizeGame {
  assertSeats(n, 'individual');
  const g: SizeGame = {
    kind: 'size',
    version: 1,
    rules: 2,
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
    questions: [],
    step: 0,
    guesses: [],
    scores: Array(n).fill(0),
    used: [],
    vote: null,
    gains: [],
  };
  deal(g);
  return g;
}
/** Joins a set match at `round`. */
export function startAt(g: SizeGame, round: number) {
  g.round = round;
  g.used = [];
  g.log = [];
  deal(g);
  return g;
}
export function actingSeats(g: SizeGame): number[] {
  if (g.over || g.phase === 'reveal') return [];
  if (g.phase === 'vote')
    return g.seats.flatMap((_, s) => (g.vote?.choices[s] ? [] : [s]));
  return g.seats.flatMap((_, s) => (g.guesses[s].locked ? [] : [s]));
}
const isGuess = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= guessRange[0] &&
  v <= guessRange[1];
/** Four significant figures: a drag cannot say more than that. */
export const tidy = (v: number) => Number(v.toPrecision(4));
export function validMove(
  g: SizeGame,
  move: unknown,
  seat: number,
): move is SizeMove {
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
  const m = move as SizeMove;
  const keys =
    m.type === 'guess'
      ? ['type', 'step', 'value']
      : m.type === 'lock'
        ? ['type', 'values']
        : m.type === 'vote'
          ? ['type', 'choice']
          : ['type'];
  if (Object.keys(m).some((k) => !keys.includes(k))) return false;
  // The engine accepts `next` from any seat; the table decides who hosts.
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
      m.step < questionsPerRound &&
      isGuess(m.value)
    );
  return (
    m.type === 'lock' &&
    (m.values === undefined
      ? b.values.every((v) => v !== null)
      : Array.isArray(m.values) &&
        m.values.length === questionsPerRound &&
        m.values.every(isGuess))
  );
}
function reveal(g: SizeGame) {
  const q = g.questions[g.step];
  const gains = g.guesses.map((b) => points(b.values[g.step] ?? 0, q.answer));
  g.gains.push(gains);
  g.scores = g.scores.map((v, s) => v + gains[s]);
  g.phase = 'reveal';
  note(
    g,
    `${label(q)}: ${g.seats.map((name, s) => `${name} +${gains[s]}`).join(', ')}.`,
  );
}
export function play(
  g: SizeGame,
  m: SizeMove,
  s: number,
  now = Date.now(),
): SizeGame {
  if (!validMove(g, m, s)) return g;
  if (g.phase === 'vote' && g.vote && voteClosed(g.vote, now))
    return tick(g, now);
  const n = structuredClone(g);
  n.revision++;
  if (n.phase === 'guess') {
    const b = n.guesses[s];
    if (m.type === 'guess') b.values[m.step] = tidy(m.value);
    if (m.type === 'lock') {
      if (m.values) b.values = m.values.map(tidy);
      b.locked = true;
    }
    if (m.type === 'unlock') b.locked = false;
    if (n.guesses.every((x) => x.locked)) {
      n.step = 0;
      reveal(n);
    }
  } else if (n.phase === 'reveal') {
    if (n.step < questionsPerRound - 1) {
      n.step++;
      reveal(n);
    } else {
      n.phase = 'vote';
      n.vote = openVote(
        n.seats.length,
        now,
        !n.tutorial,
        n.tribu ? ['miro', 'size', 'finish'] : undefined,
      );
      note(n, `Round ${n.round} complete. Another round?`);
    }
  } else if (m.type === 'vote') {
    n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return close(n);
  }
  return n;
}
function close(g: SizeGame): SizeGame {
  const choice = voteResult(g.vote!, g.tribu ? 'size' : 'more', (n) =>
    Math.floor(roll(g) * n),
  );
  g.vote = null;
  if (choice === 'finish' || g.round >= maxRounds) {
    // The finished table keeps the last reveal on screen.
    g.phase = 'reveal';
    g.over = true;
    note(
      g,
      `The table finished after ${g.round} round${g.round === 1 ? '' : 's'}.`,
    );
    return g;
  }
  g.round++;
  if (choice === 'miro') {
    g.handoff = 'miro';
    return g;
  }
  deal(g);
  return g;
}
/** The server owns the vote deadline. Silent players don't count. */
export function tick(g: SizeGame, now = Date.now()): SizeGame {
  if (g.over || g.phase !== 'vote' || !g.vote || !voteClosed(g.vote, now))
    return g;
  const n = structuredClone(g);
  n.revision++;
  return close(n);
}
/** How many comparisons the viewer may see answered. */
function shown(g: SizeGame) {
  return g.phase === 'guess' ? 0 : g.step + 1;
}
export function observe(g: SizeGame, viewer: number): SizeGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.used = [];
  const open = shown(n);
  n.questions = n.questions.map((q, i) =>
    i < open ? q : { ...q, answer: -1 },
  );
  // Another seat's guesses stay hidden until their comparison is revealed.
  n.guesses = n.guesses.map((b, s) =>
    s === viewer
      ? b
      : { ...b, values: b.values.map((v, i) => (i < open ? v : null)) },
  );
  return n;
}
export function label(q: Pick<SizeQuestion, 'kind' | 'target'>) {
  return q.kind === 'country'
    ? (country(q.target)?.name ?? q.target)
    : (thing(q.target)?.name ?? q.target);
}
export function botMove(g: SizeGame, s: number): SizeMove | null {
  if (!actingSeats(g).includes(s)) return null;
  // Practice bots play two rounds, then vote to finish.
  if (g.phase === 'vote')
    return {
      type: 'vote',
      choice: g.round >= 2 ? 'finish' : g.tribu ? 'size' : 'more',
    };
  const b = g.guesses[s];
  const step = b.values.findIndex((v) => v === null);
  if (step < 0) return { type: 'lock' };
  // Bots never see the answer: a rough hunch around the reference.
  const q = g.questions[step];
  let hash = s * 97 + g.round * 131 + step * 43;
  for (const ch of q.ref + q.target)
    hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  return {
    type: 'guess',
    step,
    value: tidy(
      measure(q.kind, q.ref).real * 10 ** ((hash % 1000) / 700 - 0.5),
    ),
  };
}
export function validState(g: SizeGame) {
  const n = g.seats.length;
  const known = (q: SizeQuestion) =>
    q.kind === 'country'
      ? !!country(q.ref) && !!country(q.target)
      : !!thing(q.ref) && !!thing(q.target);
  const revealed = g.phase === 'guess' ? 0 : g.step + 1;
  return (
    g.rules === 2 &&
    g.mode === 'individual' &&
    Array.isArray(g.teams) &&
    g.teams.length === n &&
    g.teams.every((t, s) => t === s) &&
    ['guess', 'reveal', 'vote'].includes(g.phase) &&
    Number.isInteger(g.step) &&
    g.step >= 0 &&
    g.step < questionsPerRound &&
    (g.phase !== 'guess' || g.step === 0) &&
    (g.phase !== 'vote' || g.step === questionsPerRound - 1) &&
    Array.isArray(g.used) &&
    g.used.every((u) => typeof u === 'string') &&
    Array.isArray(g.questions) &&
    g.questions.length === questionsPerRound &&
    g.questions.every(
      (q, i) =>
        q &&
        q.kind === (i === 2 ? 'country' : 'thing') &&
        known(q) &&
        q.answer === measure(q.kind, q.target).real,
    ) &&
    Array.isArray(g.guesses) &&
    g.guesses.length === n &&
    g.guesses.every(
      (b) =>
        b &&
        typeof b.locked === 'boolean' &&
        Array.isArray(b.values) &&
        b.values.length === questionsPerRound &&
        b.values.every((v) => v === null || isGuess(v)) &&
        (!b.locked || b.values.every((v) => v !== null)),
    ) &&
    (g.phase === 'guess' || g.guesses.every((b) => b.locked)) &&
    (g.phase === 'vote') === !!g.vote &&
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
