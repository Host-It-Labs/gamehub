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

/** Dial: one player at a time sees a hidden point on a spectrum and gives a
 * one-line clue; everyone else privately turns their dial to where they think
 * it sits. A round gives every player one turn as the clue-giver. */
export type DialMove =
  | { type: 'card'; target: number }
  | { type: 'clue'; text: string }
  | { type: 'dial'; value: number }
  | { type: 'vote'; choice: RoundChoice }
  /** Locking may carry the final dial position, so one move settles both. */
  | { type: 'lock'; value?: number }
  | { type: 'unlock' | 'next' };
export type DialGuess = { value: number; locked: boolean };
export type DialGame = StandaloneBase & {
  kind: 'dial';
  rules: 1;
  mode: 'individual';
  /** Everyone plays for themselves; kept so shared party screens can group seats. */
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'clue' | 'guess' | 'reveal' | 'vote';
  /** Whose turn it is to give the clue. */
  target: number;
  /** Two spectrums the clue-giver chooses between; only they see them before the clue. */
  offers: number[];
  card: number | null;
  /** 0–100 along the spectrum; hidden from everyone but the clue-giver until the reveal. */
  point: number;
  clue: string;
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
    phase: 'clue',
    target: 0,
    offers: [],
    card: null,
    point: 50,
    clue: '',
    guesses: [],
    scores: Array(n).fill(0),
    deck: [],
    vote: null,
    result: null,
  };
  turn(g);
  note(g, `Round 1: ${g.seats[0]} gives the first clue.`);
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
function turn(g: DialGame) {
  g.phase = 'clue';
  g.offers = draw(g);
  // The first spectrum shows at once; the clue-giver may swap to the other.
  g.card = g.offers[0];
  g.clue = '';
  // Keep the point off the extreme ends so every band is reachable.
  g.point = 5 + Math.floor(roll(g) * 91);
  g.guesses = g.seats.map(() => null);
  g.result = null;
}
export function actingSeats(g: DialGame): number[] {
  if (g.over) return [];
  if (g.phase === 'clue') return [g.target];
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
    if (seat !== g.target) return false;
    if (m.type === 'card')
      return Number.isInteger(m.target) && g.offers.includes(m.target);
    if (m.type === 'clue')
      return (
        g.card !== null &&
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
    if (m.type === 'card') n.card = m.target;
    if (m.type === 'clue') {
      n.clue = cleanClue(m.text);
      n.phase = 'guess';
      note(n, `${n.seats[s]}'s clue: “${n.clue}”.`, s);
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
      turn(n);
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
  const gains = g.seats.map(() => 0),
    values = g.guesses.map((b) => b?.value ?? -1);
  let total = 0;
  for (let s = 0; s < g.seats.length; s++) {
    if (s === g.target) continue;
    gains[s] = points(values[s], g.point);
    total += gains[s];
  }
  // The clue-giver earns the average of what their clue won for everyone else.
  gains[g.target] = Number((total / (g.seats.length - 1)).toFixed(2));
  g.scores = g.scores.map((v, i) => v + gains[i]);
  g.result = { point: g.point, guesses: values, gains };
  g.phase = 'reveal';
  note(
    g,
    `The point was at ${g.point}. ${g.seats.map((name, i) => `${name} +${gains[i]}`).join(', ')}.`,
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
  g.target = 0;
  turn(g);
  note(g, `Round ${g.round}: ${g.seats[0]} gives the first clue.`);
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
  const giver = viewer === n.target;
  if (!giver && n.phase === 'clue') {
    n.offers = [];
    n.card = null;
  }
  if (!giver && n.phase !== 'reveal') n.point = -1;
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
    if (g.card === null) return { type: 'card', target: g.offers[0] };
    const sp = spectrums[g.card];
    return {
      type: 'clue',
      text:
        g.point < 35
          ? `Quite ${sp.left.toLowerCase()}`
          : g.point > 65
            ? `Quite ${sp.right.toLowerCase()}`
            : 'Somewhere in the middle',
    };
  }
  const b = g.guesses[s];
  if (b) return { type: 'lock' };
  // Bots never see the hidden point; they read the clue's direction only.
  const clue = g.clue.toLowerCase(),
    sp = g.card === null ? null : spectrums[g.card];
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
    ids = (a: unknown) =>
      Array.isArray(a) && a.every((i) => Number.isInteger(i) && !!spectrums[i]);
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
    ids(g.offers) &&
    (g.card === null || g.offers.includes(g.card)) &&
    Number.isInteger(g.point) &&
    g.point >= 0 &&
    g.point <= 100 &&
    typeof g.clue === 'string' &&
    g.clue.length <= clueLimit &&
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
