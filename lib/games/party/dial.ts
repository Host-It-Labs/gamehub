import { spectrums, liveSpectrumIds } from './spectrums.ts';
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

/** Dial: everyone at once sees a hidden point on a spectrum of their own and
 * writes a one-line clue for it, like Top Five's private lists. Then the
 * table reads the clues one after the other; everyone but the author
 * privately turns their dial to where they think the point sits. */
export type DialMove =
  | { type: 'card'; target: number }
  | { type: 'clue'; text: string }
  | { type: 'dial'; value: number }
  | { type: 'vote'; choice: RoundChoice }
  /** Locking may carry the final dial position, so one move settles both. */
  | { type: 'lock'; value?: number }
  | { type: 'unlock' | 'next' };
export type DialGuess = { value: number; locked: boolean };
/** One player's clue for the round. Hidden fields read -1 (or empty) for
 * everyone else until the table reaches it. */
export type DialCard = {
  /** Two spectrums the author chooses between. */
  offers: number[];
  card: number;
  /** 0–100 along the spectrum; the author's secret until the reveal. */
  point: number;
  clue: string;
  locked: boolean;
};
export type DialGame = StandaloneBase & {
  kind: 'dial';
  rules: 2;
  mode: 'individual';
  /** Everyone plays for themselves; kept so shared party screens can group seats. */
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'clue' | 'guess' | 'reveal' | 'vote';
  /** Whose clue the table is reading (guess and reveal). */
  target: number;
  cards: DialCard[];
  guesses: (DialGuess | null)[];
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
function draw(g: DialGame) {
  // Older saves may still hold retired spectrums in the deck.
  g.deck = g.deck.filter((id) => !spectrums[id]?.retired);
  if (g.deck.length < 2)
    g.deck.push(
      ...shuffle(
        liveSpectrumIds.filter((id) => !g.deck.includes(id)),
        () => roll(g),
      ),
    );
  return g.deck.splice(0, 2);
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
      locked: false,
    };
  });
  g.guesses = g.seats.map(() => null);
  g.result = null;
  note(g, `Round ${g.round}: everyone writes a clue at once.`);
}
/** The clue the table is reading now. */
export function current(g: DialGame): DialCard {
  return g.cards[g.target];
}
export function actingSeats(g: DialGame): number[] {
  if (g.over) return [];
  if (g.phase === 'clue')
    return g.seats.flatMap((_, s) => (g.cards[s].locked ? [] : [s]));
  if (g.phase === 'guess')
    return g.seats.flatMap((_, s) =>
      s !== g.target && !g.guesses[s]?.locked ? [s] : [],
    );
  if (g.phase === 'vote')
    return g.seats.flatMap((_, s) => (g.vote?.choices[s] ? [] : [s]));
  return [];
}
function cleanClue(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}
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
      (k) => !['type', 'target', 'text', 'value', 'choice'].includes(k),
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
    if (m.type === 'clue')
      return (
        typeof m.text === 'string' &&
        cleanClue(m.text).length > 0 &&
        cleanClue(m.text).length <= clueLimit
      );
    return false;
  }
  if (seat === g.target) return false;
  const b = g.guesses[seat];
  if (m.type === 'unlock') return !!b?.locked;
  if (b?.locked) return false;
  if (m.type === 'dial' || (m.type === 'lock' && m.value !== undefined))
    return Number.isFinite(m.value) && m.value! >= 0 && m.value! <= 100;
  return m.type === 'lock';
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
    if (m.type === 'unlock') c.locked = false;
    if (n.cards.every((c) => c.locked)) {
      n.phase = 'guess';
      n.target = 0;
      note(n, `Read ${n.seats[0]}'s clue: “${n.cards[0].clue}”.`, 0);
    }
  } else if (n.phase === 'guess') {
    if (m.type === 'dial')
      n.guesses[s] = { value: Math.round(m.value), locked: false };
    if (m.type === 'lock') {
      n.guesses[s] ??= { value: 50, locked: false };
      if (m.value !== undefined) n.guesses[s]!.value = Math.round(m.value);
      n.guesses[s]!.locked = true;
    }
    if (m.type === 'unlock') n.guesses[s]!.locked = false;
    if (n.seats.every((_, i) => i === n.target || n.guesses[i]?.locked))
      reveal(n);
  } else if (n.phase === 'reveal') {
    if (n.target < n.seats.length - 1) {
      n.target++;
      n.phase = 'guess';
      n.guesses = n.seats.map(() => null);
      n.result = null;
      note(
        n,
        `Read ${n.seats[n.target]}'s clue: “${n.cards[n.target].clue}”.`,
        n.target,
      );
    } else {
      n.phase = 'vote';
      n.vote = openVote(
        n.seats.length,
        now,
        !n.tutorial,
        n.tribu ? ['orin', 'dial', 'finish'] : undefined,
      );
      note(n, `Round ${n.round} complete. Another round?`);
    }
  } else if (m.type === 'vote') {
    n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return close(n);
  }
  return n;
}
function reveal(g: DialGame) {
  const point = current(g).point,
    gains = g.seats.map(() => 0),
    values = g.guesses.map((b) => b?.value ?? -1);
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
    `The point was at ${point}. ${g.seats.map((name, i) => `${name} +${gains[i]}`).join(', ')}.`,
  );
}
function close(g: DialGame): DialGame {
  const choice = voteResult(g.vote!, g.tribu ? 'dial' : 'more', (n) =>
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
  if (choice === 'orin') {
    g.handoff = 'orin';
    return g;
  }
  deal(g);
  return g;
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
      : // The table sees the clue it is reading, and its point once revealed.
        n.phase !== 'clue' && s === n.target
        ? { ...c, offers: [], point: shown ? c.point : -1 }
        : { offers: [], card: -1, point: -1, clue: '', locked: c.locked },
  );
  if (n.phase === 'guess')
    n.guesses = n.guesses.map((b, s) =>
      b && s !== viewer ? { value: -1, locked: b.locked } : b,
    );
  return n;
}
export function botMove(g: DialGame, s: number): DialMove | null {
  if (!actingSeats(g).includes(s)) return null;
  // Practice bots play the classic two rounds, then vote to finish.
  if (g.phase === 'vote')
    return {
      type: 'vote',
      choice: g.round >= 2 ? 'finish' : g.tribu ? 'dial' : 'more',
    };
  if (g.phase === 'clue') {
    const c = g.cards[s],
      sp = spectrums[c.card];
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
  const b = g.guesses[s];
  if (b) return { type: 'lock' };
  // Bots never see the hidden point; they read the clue's direction only.
  const c = current(g),
    clue = c.clue.toLowerCase(),
    sp = spectrums[c.card];
  const base = !sp
    ? 50
    : clue.includes(sp.left.toLowerCase())
      ? 22
      : clue.includes(sp.right.toLowerCase())
        ? 78
        : 50;
  return { type: 'dial', value: base + ((s * 7 + g.round * 3) % 11) - 5 };
}
export function validState(g: DialGame) {
  const n = g.seats.length,
    id = (i: unknown) => Number.isInteger(i) && !!spectrums[i as number],
    ids = (a: unknown) => Array.isArray(a) && a.every(id);
  return (
    g.mode === 'individual' &&
    Array.isArray(g.teams) &&
    g.teams.length === n &&
    g.teams.every((t, s) => t === s) &&
    ['clue', 'guess', 'reveal', 'vote'].includes(g.phase) &&
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
        typeof c.locked === 'boolean' &&
        (!c.locked || c.clue.length > 0) &&
        (g.phase === 'clue' || c.locked),
    ) &&
    Array.isArray(g.guesses) &&
    g.guesses.length === n &&
    g.guesses.every(
      (b) =>
        b === null ||
        (Number.isInteger(b.value) &&
          b.value >= 0 &&
          b.value <= 100 &&
          typeof b.locked === 'boolean'),
    ) &&
    (g.phase === 'vote') === !!g.vote &&
    (g.phase === 'reveal' || g.phase === 'vote') === !!g.result
  );
}
