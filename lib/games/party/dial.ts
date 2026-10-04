import { spectrums, liveSpectrumIds, liveSelfIds } from './spectrums.ts';
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

/** Dial: everyone at once sees a hidden point on a spectrum of their own and
 * writes a one-line clue for it, like Top Five's private lists, or takes the
 * round's "Me" card instead and places themselves on it (Night owl – Early
 * bird). Then everyone at once turns a dial for every other player and locks
 * once; the answers are revealed one after the other. */
export type DialMove =
  | { type: 'card'; target: number }
  | { type: 'clue'; text: string }
  /** Places the author on a "Me" card and locks it. */
  | { type: 'place'; value: number }
  | { type: 'dial'; author: number; value: number }
  | { type: 'vote'; choice: RoundChoice }
  /** Locking may carry the last dial turned, so one move settles both. */
  | { type: 'lock'; author?: number; value?: number }
  | { type: 'unlock' | 'next' };
/** One player's dials for every other clue, locked together; a dial left
 * untouched sits in the middle. */
export type DialGuess = { values: (number | null)[]; locked: boolean };
/** One player's clue for the round. Hidden fields read -1 (or empty) for
 * everyone else until the table reaches it. */
export type DialCard = {
  /** Two spectrums the author chooses between: a clue spectrum and, since
   * the "Me" cards, one to place themselves on. */
  offers: number[];
  card: number;
  /** 0–100 along the spectrum; the author's secret until the reveal. */
  point: number;
  clue: string;
  /** Where the author placed themselves on a "Me" card; hidden like `point`. */
  placed?: number | null;
  locked: boolean;
};
/** Whether a card is a "Me" card. */
export function isSelf(c: Pick<DialCard, 'card'>) {
  return !!spectrums[c.card]?.self;
}
/** The point a card's dials aim for: the hidden point, or where the author
 * placed themselves; -1 while unknown. */
export function aim(c: DialCard) {
  return isSelf(c) ? (c.placed ?? -1) : c.point;
}
export type DialGame = StandaloneBase & {
  kind: 'dial';
  rules: 3;
  mode: 'individual';
  /** Everyone plays for themselves; kept so shared party screens can group seats. */
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'clue' | 'guess' | 'reveal' | 'vote';
  /** Whose clue is being revealed. */
  target: number;
  cards: DialCard[];
  guesses: DialGuess[];
  scores: number[];
  deck: number[];
  vote: RoundVote | null;
  result: null | { point: number; guesses: number[]; gains: number[] };
  /** Present while this game is part of a Tribu match. */
  tribu?: TribuState;
  /** Set when the table voted to switch games; the registry swaps the state. */
  handoff?: SetGame | null;
};
export const clueLimit = 60;
/** Distance bands around the hidden point: 4, 3, 2 points, then nothing. */
export const bands = [2, 6, 10] as const;
export function points(guess: number, point: number) {
  const d = Math.abs(guess - point);
  return d <= bands[0] ? 4 : d <= bands[1] ? 3 : d <= bands[2] ? 2 : 0;
}
export function createGame(
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
): DialGame {
  assertSeats(n, 'individual');
  const g: DialGame = {
    kind: 'dial',
    version: 1,
    rules: 3,
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
    phase: 'clue',
    target: 0,
    cards: [],
    guesses: [],
    scores: Array(n).fill(0),
    deck: [],
    vote: null,
    result: null,
  };
  deal(g);
  return g;
}
/** One clue spectrum and one "Me" card from the shared deck. */
function draw(g: DialGame) {
  // Older saves may still hold retired spectrums in the deck.
  g.deck = g.deck.filter((id) => spectrums[id] && !spectrums[id].retired);
  for (const pool of [liveSpectrumIds, liveSelfIds])
    if (!g.deck.some((id) => pool.includes(id)))
      g.deck.push(
        ...shuffle(
          pool.filter((id) => !g.deck.includes(id)),
          () => roll(g),
        ),
      );
  const clue = g.deck.findIndex((id) => !spectrums[id].self);
  const [a] = g.deck.splice(clue, 1);
  const self = g.deck.findIndex((id) => spectrums[id].self);
  const [b] = g.deck.splice(self, 1);
  return [a, b];
}
/** Everyone gets two spectrums and a hidden point at once. */
function deal(g: DialGame) {
  g.phase = 'clue';
  g.target = 0;
  g.cards = g.seats.map(() => {
    const offers = draw(g);
    return {
      offers,
      // The first spectrum shows at once; the author may swap to the other.
      card: offers[0],
      // Keep the point off the extreme ends so every band is reachable.
      point: 5 + Math.floor(roll(g) * 91),
      clue: '',
      placed: null,
      locked: false,
    };
  });
  g.guesses = g.seats.map(() => ({
    values: g.seats.map(() => null),
    locked: false,
  }));
  g.vote = null;
  g.result = null;
  note(g, `Round ${g.round}: everyone writes a clue at once.`);
}
/** The clue being revealed. */
export function current(g: DialGame): DialCard {
  return g.cards[g.target];
}
/** Where a guesser's dial for `author` sits; untouched dials sit mid-way. */
export function dialAt(g: DialGame, guesser: number, author: number) {
  return g.guesses[guesser]?.values[author] ?? 50;
}
export function actingSeats(g: DialGame): number[] {
  if (g.over) return [];
  if (g.phase === 'clue')
    return g.seats.flatMap((_, s) => (g.cards[s].locked ? [] : [s]));
  if (g.phase === 'guess')
    return g.seats.flatMap((_, s) => (g.guesses[s].locked ? [] : [s]));
  if (g.phase === 'vote') return voters(g);
  return [];
}
function cleanClue(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}
const dialValue = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
export function validMove(
  g: DialGame,
  move: unknown,
  seat: number,
): move is DialMove {
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
  const m = move as DialMove;
  if (
    Object.keys(m).some(
      (k) =>
        !['type', 'target', 'text', 'value', 'choice', 'author'].includes(k),
    )
  )
    return false;
  if (g.phase === 'reveal') return m.type === 'next';
  if (g.phase === 'vote')
    return (
      m.type === 'vote' &&
      isChoice(m.choice, g.vote) &&
      g.vote?.choices[seat] !== m.choice
    );
  if (g.phase === 'clue') {
    const c = g.cards[seat];
    if (m.type === 'unlock') return c.locked;
    if (c.locked) return false;
    if (m.type === 'card')
      return Number.isInteger(m.target) && c.offers.includes(m.target);
    if (m.type === 'place') return isSelf(c) && dialValue(m.value);
    if (m.type === 'clue')
      return (
        !isSelf(c) &&
        typeof m.text === 'string' &&
        cleanClue(m.text).length > 0 &&
        cleanClue(m.text).length <= clueLimit
      );
    return false;
  }
  const b = g.guesses[seat];
  if (m.type === 'unlock') return b.locked;
  if (b.locked) return false;
  const author = (a: unknown) =>
    Number.isInteger(a) &&
    a !== seat &&
    (a as number) >= 0 &&
    (a as number) < g.seats.length;
  if (m.type === 'dial') return author(m.author) && dialValue(m.value);
  if (m.type === 'lock')
    return m.author === undefined && m.value === undefined
      ? true
      : author(m.author) && dialValue(m.value);
  return false;
}
export function play(
  g: DialGame,
  m: DialMove,
  s: number,
  now = Date.now(),
): DialGame {
  if (!validMove(g, m, s)) return g;
  if (g.phase === 'vote' && g.vote && voteClosed(g.vote, now))
    return tick(g, now);
  const n = structuredClone(g);
  n.revision++;
  if (n.phase === 'clue') {
    const c = n.cards[s];
    if (m.type === 'card') c.card = m.target;
    if (m.type === 'clue') {
      c.clue = cleanClue(m.text);
      c.locked = true;
    }
    if (m.type === 'place') {
      c.placed = Math.round(m.value);
      c.locked = true;
    }
    if (m.type === 'unlock') c.locked = false;
    if (n.cards.every((c) => c.locked)) {
      n.phase = 'guess';
      n.target = 0;
      note(n, 'Everyone reads every other clue at once.');
    }
  } else if (n.phase === 'guess') {
    const b = n.guesses[s];
    if ((m.type === 'dial' || m.type === 'lock') && m.author !== undefined)
      b.values[m.author] = Math.round(m.value!);
    if (m.type === 'lock') b.locked = true;
    if (m.type === 'unlock') b.locked = false;
    if (n.guesses.every((x) => x.locked)) {
      n.target = 0;
      reveal(n);
    }
  } else if (n.phase === 'reveal') {
    if (n.target < n.seats.length - 1) {
      n.target++;
      reveal(n);
    } else endRound(n, now);
  } else if (m.type === 'vote') {
    n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return close(n);
  }
  return n;
}
function reveal(g: DialGame) {
  const point = aim(current(g)),
    gains = g.seats.map(() => 0),
    values = g.seats.map((_, s) =>
      s === g.target ? -1 : dialAt(g, s, g.target),
    );
  let total = 0;
  for (let s = 0; s < g.seats.length; s++) {
    if (s === g.target) continue;
    gains[s] = points(values[s], point);
    total += gains[s];
  }
  // The author earns the average of what their clue won for everyone else.
  gains[g.target] = Number((total / (g.seats.length - 1)).toFixed(2));
  g.scores = g.scores.map((v, i) => v + gains[i]);
  g.result = { point, guesses: values, gains };
  g.phase = 'reveal';
  note(
    g,
    `${g.seats[g.target]}'s point was at ${point}. ${g.seats.map((name, i) => `${name} +${gains[i]}`).join(', ')}.`,
  );
}
function close(g: DialGame): DialGame {
  return closeRound(g, deal);
}
/** The server owns the vote deadline. Silent players don't count. */
export function tick(g: DialGame, now = Date.now()): DialGame {
  if (g.over || g.phase !== 'vote' || !g.vote || !voteClosed(g.vote, now))
    return g;
  const n = structuredClone(g);
  n.revision++;
  return close(n);
}
export function observe(g: DialGame, viewer: number): DialGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.deck = [];
  const shown = n.phase === 'reveal' || n.phase === 'vote';
  n.cards = n.cards.map((c, s) =>
    s === viewer
      ? c
      : // Every clue and spectrum is public once the guessing starts; a
        // point only at its own reveal.
        n.phase !== 'clue'
        ? {
            ...c,
            offers: [],
            point: shown && s === n.target ? c.point : -1,
            placed: shown && s === n.target ? (c.placed ?? null) : null,
          }
        : {
            offers: [],
            card: -1,
            point: -1,
            clue: '',
            placed: null,
            locked: c.locked,
          },
  );
  n.guesses = n.guesses.map((b, s) =>
    s === viewer ? b : { values: b.values.map(() => null), locked: b.locked },
  );
  return n;
}
export function botMove(g: DialGame, s: number): DialMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'vote') return { type: 'vote', choice: botChoice(g, s) };
  if (g.phase === 'clue') {
    const c = g.cards[s],
      sp = spectrums[c.card];
    if (isSelf(c)) return { type: 'place', value: c.point };
    return {
      type: 'clue',
      text:
        c.point < 35
          ? `Quite ${sp.left.toLowerCase()}`
          : c.point > 65
            ? `Quite ${sp.right.toLowerCase()}`
            : 'Somewhere in the middle',
    };
  }
  const author = g.seats.findIndex(
    (_, a) => a !== s && g.guesses[s].values[a] === null,
  );
  if (author < 0) return { type: 'lock' };
  // Bots never see the hidden point; they read the clue's direction only.
  const c = g.cards[author],
    clue = c.clue.toLowerCase(),
    sp = spectrums[c.card];
  const base = !sp
    ? 50
    : clue.includes(sp.left.toLowerCase())
      ? 22
      : clue.includes(sp.right.toLowerCase())
        ? 78
        : 50;
  return {
    type: 'dial',
    author,
    value: base + ((s * 7 + author * 5 + g.round * 3) % 11) - 5,
  };
}
export function validState(g: DialGame) {
  const n = g.seats.length,
    id = (i: unknown) => Number.isInteger(i) && !!spectrums[i as number],
    ids = (a: unknown) => Array.isArray(a) && a.every(id);
  return (
    g.rules === 3 &&
    g.mode === 'individual' &&
    Array.isArray(g.teams) &&
    g.teams.length === n &&
    g.teams.every((t, s) => t === s) &&
    ['clue', 'guess', 'reveal', 'vote'].includes(g.phase) &&
    (g.phase === 'vote' ? validVote(g.vote, n) : !g.vote) &&
    Number.isInteger(g.target) &&
    g.target >= 0 &&
    g.target < n &&
    ids(g.deck) &&
    Array.isArray(g.cards) &&
    g.cards.length === n &&
    g.cards.every(
      (c) =>
        !!c &&
        ids(c.offers) &&
        c.offers.length === 2 &&
        c.offers.includes(c.card) &&
        Number.isInteger(c.point) &&
        c.point >= 0 &&
        c.point <= 100 &&
        typeof c.clue === 'string' &&
        c.clue.length <= clueLimit &&
        (c.placed === undefined ||
          c.placed === null ||
          (Number.isInteger(c.placed) && c.placed >= 0 && c.placed <= 100)) &&
        typeof c.locked === 'boolean' &&
        (!c.locked ||
          (isSelf(c) ? Number.isInteger(c.placed) : c.clue.length > 0)) &&
        (g.phase === 'clue' || c.locked),
    ) &&
    Array.isArray(g.guesses) &&
    g.guesses.length === n &&
    g.guesses.every(
      (b, s) =>
        !!b &&
        typeof b.locked === 'boolean' &&
        Array.isArray(b.values) &&
        b.values.length === n &&
        b.values.every(
          (v, a) =>
            v === null ||
            (a !== s && Number.isInteger(v) && v >= 0 && v <= 100),
        ),
    ) &&
    (g.phase === 'reveal' || g.phase === 'vote') === !!g.result
  );
}
