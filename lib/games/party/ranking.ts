import { liveTopicIds, topics } from './catalog.ts';
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
import { assertSeats } from './groups.ts';
export { groupName, teamNames } from './groups.ts';
import {
  shuffle,
  roll,
  note,
  type Difficulty,
  type StandaloneBase,
} from '../standalone/types.ts';

/** Top Five: everyone at once picks a prompt and ranks its five answers the
 * way they really feel. Then everyone at once ranks every other player's
 * list the way they think its author did, and locks once. The lists are
 * then revealed one after the other, and the host moves the table on. */
export type RankingMove =
  | { type: 'topic'; target: number }
  /** Your own list while ranking; `author`'s list while guessing. */
  | { type: 'arrange'; order: number[]; author?: number }
  | { type: 'vote'; choice: RoundChoice }
  | { type: 'lock' | 'unlock' | 'next' | 'refresh' };
export type Ballot = {
  topic: number;
  order: number[];
  locked: boolean;
};
/** One player's guesses at every other list, locked together. An author's
 * list left untouched counts in its dealt order. */
export type Guess = { orders: (number[] | null)[]; locked: boolean };
export type RankingGame = StandaloneBase & {
  kind: 'orin';
  rules: 7;
  /** Everyone plays for themselves; kept so shared party screens can group seats. */
  mode: 'individual';
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'rank' | 'guess' | 'reveal' | 'vote';
  vote?: RoundVote | null;
  offers: number[][];
  refreshes?: number[];
  topicOrders?: Record<number, number[]>[];
  ballots: (Ballot | null)[];
  /** Whose list is being revealed. */
  target: number;
  guesses: Guess[];
  scores: number[];
  deck: number[];
  lastAction: string;
  /** Present while this game is part of a Know Me match. */
  tribu?: TribuState;
  /** Set when the table chose another game; the registry swaps the state. */
  handoff?: SetGame | null;
  result: null | {
    order: number[];
    /** Every guesser's order for this list; null for the author. */
    guesses: (number[] | null)[];
    gains: number[];
  };
};
export const tiers = ['1st', '2nd', '3rd', '4th', '5th'];
export function count(_g?: RankingGame) {
  return 5;
}
const identity = () => [0, 1, 2, 3, 4];
export function createGame(
  kind: 'orin',
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
): RankingGame {
  if (kind !== 'orin') throw new Error('Unknown ranking game.');
  assertSeats(n, 'individual');
  const g: RankingGame = {
    kind,
    version: 1,
    rules: 7,
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
    phase: 'rank',
    offers: [],
    ballots: [],
    target: 0,
    guesses: [],
    scores: Array(n).fill(0),
    deck: [],
    lastAction: '',
    result: null,
  };
  g.deck = shuffle(liveTopicIds, () => roll(g));
  deal(g);
  return g;
}
function deal(g: RankingGame) {
  // Three offers plus two refreshes per seat; reshuffle unseen-this-pass topics
  // back in when a long evening runs the deck low.
  if (g.deck.length < g.seats.length * 9)
    g.deck.push(
      ...shuffle(
        liveTopicIds.filter((id) => !g.deck.includes(id)),
        () => roll(g),
      ),
    );
  g.phase = 'rank';
  g.vote = null;
  g.target = 0;
  g.result = null;
  g.guesses = g.seats.map(() => ({
    orders: g.seats.map(() => null),
    locked: false,
  }));
  g.offers = g.seats.map(() => g.deck.splice(0, 3));
  g.ballots = g.seats.map(() => null);
  g.refreshes = g.seats.map(() => 0);
  g.topicOrders = g.seats.map(() => ({}));
  note(g, `Round ${g.round}: everyone prepares a private ranking at once.`);
}
/** Points for one answer by how many places the guess put it from the
 * author's rank, like Dial's bands: 2 on the spot, 1 one place off. */
export const nearPoints = [2, 1] as const;
/** A perfect list: every answer on the spot. */
export const perfectPoints = nearPoints[0] * 5;
/** How far the guess put each of the author's answers, in the author's order. */
export function guessOffsets(order: number[], answer: number[]) {
  return answer.map((v, i) => Math.abs(order.indexOf(v) - i));
}
export function itemPoints(offset: number) {
  return nearPoints[offset] ?? 0;
}
export function guessPoints(order: number[], answer: number[]) {
  return guessOffsets(order.slice(0, 5), answer.slice(0, 5)).reduce(
    (sum, d) => sum + itemPoints(d),
    0,
  );
}
/** The order a guesser has for `author`'s list, untouched lists as dealt. */
export function guessOrder(g: RankingGame, guesser: number, author: number) {
  return g.guesses[guesser]?.orders[author] ?? identity();
}
export function actingSeats(g: RankingGame): number[] {
  if (g.over) return [];
  if (g.phase === 'rank')
    return g.seats.flatMap((_, s) => (!g.ballots[s]?.locked ? [s] : []));
  if (g.phase === 'guess')
    return g.seats.flatMap((_, s) => (g.guesses[s].locked ? [] : [s]));
  if (g.phase === 'vote') return voters(g);
  // Reveals wait on the table host only; see `next`.
  return [];
}
export function permutation(a: unknown, n: number): a is number[] {
  return (
    Array.isArray(a) &&
    a.length === n &&
    new Set(a).size === n &&
    a.every((v) => Number.isInteger(v) && v >= 0 && v < n)
  );
}
export function validMove(
  g: RankingGame,
  move: unknown,
  seat: number,
): move is RankingMove {
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
  const m = move as RankingMove;
  if (
    Object.keys(m).some(
      (k) => !['type', 'target', 'order', 'choice', 'author'].includes(k),
    )
  )
    return false;
  if (g.phase === 'vote')
    return (
      m.type === 'vote' &&
      isChoice(m.choice, g.vote) &&
      g.vote?.choices[seat] !== m.choice
    );
  // The engine accepts `next` from any seat; the table decides who hosts.
  if (g.phase === 'reveal') return m.type === 'next';
  if (g.phase === 'rank') {
    const b = g.ballots[seat];
    if (m.type === 'unlock') return !!b?.locked;
    if (b?.locked) return false;
    if (m.type === 'refresh') return (g.refreshes?.[seat] ?? 0) < 2;
    if (m.type === 'topic')
      return Number.isInteger(m.target) && g.offers[seat].includes(m.target);
    if (m.type === 'arrange')
      return !!b && m.author === undefined && permutation(m.order, count(g));
    return m.type === 'lock' && !!b && permutation(b.order, count(g));
  }
  const b = g.guesses[seat];
  if (m.type === 'unlock') return b.locked;
  if (b.locked) return false;
  if (m.type === 'arrange')
    return (
      Number.isInteger(m.author) &&
      m.author !== seat &&
      m.author! >= 0 &&
      m.author! < g.seats.length &&
      permutation(m.order, count(g))
    );
  return m.type === 'lock';
}
export function play(
  g: RankingGame,
  m: RankingMove,
  s: number,
  now = Date.now(),
): RankingGame {
  if (!validMove(g, m, s)) return g;
  if (g.phase === 'vote' && g.vote && voteClosed(g.vote, now))
    return tick(g, now);
  const n = structuredClone(g);
  n.revision++;
  n.lastAction = m.type;
  if (n.phase === 'rank') {
    if (m.type === 'topic' || m.type === 'refresh') {
      n.topicOrders ??= n.seats.map(() => ({}));
      const previous = n.ballots[s];
      if (previous) n.topicOrders[s][previous.topic] = [...previous.order];
    }
    if (m.type === 'refresh') {
      n.refreshes ??= n.seats.map(() => 0);
      n.refreshes[s]++;
      n.offers[s] = n.deck.splice(0, 3);
      n.ballots[s] = n.ballots[s]
        ? { topic: n.offers[s][0], order: identity(), locked: false }
        : null;
    }
    if (m.type === 'topic')
      n.ballots[s] = {
        topic: m.target,
        order: n.topicOrders?.[s]?.[m.target]
          ? [...n.topicOrders[s][m.target]]
          : identity(),
        locked: false,
      };
    if (m.type === 'arrange') n.ballots[s]!.order = [...m.order];
    if (m.type === 'lock') n.ballots[s]!.locked = true;
    if (m.type === 'unlock') n.ballots[s]!.locked = false;
    if (n.ballots.every((b) => b?.locked)) {
      n.phase = 'guess';
      note(n, 'Everyone guesses every other list at once.');
    }
  } else if (n.phase === 'guess') {
    const b = n.guesses[s];
    if (m.type === 'arrange') b.orders[m.author!] = [...m.order];
    if (m.type === 'lock') b.locked = true;
    if (m.type === 'unlock') b.locked = false;
    if (n.guesses.every((x) => x.locked)) {
      n.target = 0;
      reveal(n);
    }
  } else if (n.phase === 'vote') {
    if (m.type === 'vote') n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return close(n);
  } else if (m.type === 'next') {
    if (n.target === n.seats.length - 1) endRound(n, now);
    else {
      n.target++;
      reveal(n);
    }
  }
  return n;
}
/** Scores the list being revealed; points land as its reveal does. */
function reveal(g: RankingGame) {
  const answer = g.ballots[g.target]!.order,
    guesses = g.seats.map((_, s) =>
      s === g.target ? null : guessOrder(g, s, g.target),
    ),
    gains = guesses.map((o) => (o ? guessPoints(o, answer) : 0));
  g.scores = g.scores.map((v, i) => v + gains[i]);
  g.result = { order: [...answer], guesses, gains };
  g.phase = 'reveal';
  note(
    g,
    `${g.seats[g.target]}'s list revealed. ${g.seats.map((name, i) => `${name} +${gains[i]}`).join(', ')}.`,
  );
}
function close(g: RankingGame) {
  return closeRound(g, deal, (x) => {
    x.phase = 'rank';
  });
}
/** The server owns the vote deadline; players who stay silent don't count. */
export function tick(g: RankingGame, now = Date.now()): RankingGame {
  if (g.over || g.phase !== 'vote' || !g.vote || !voteClosed(g.vote, now))
    return g;
  const n = structuredClone(g);
  n.revision++;
  return close(n);
}
export function observe(g: RankingGame, viewer: number): RankingGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.deck = [];
  n.topicOrders = n.topicOrders?.map((orders, s) =>
    s === viewer ? orders : {},
  );
  n.lastAction = n.phase;
  n.offers = n.offers.map((v, s) => (s === viewer ? v : []));
  // Every prompt is public once the guessing starts; lists stay private
  // until their own reveal.
  n.ballots = n.ballots.map((b, s) =>
    b
      ? {
          topic: s === viewer || n.phase !== 'rank' ? b.topic : -1,
          locked: b.locked,
          order:
            s === viewer ||
            (s === n.target && n.phase !== 'rank' && n.phase !== 'guess')
              ? [...b.order]
              : [],
        }
      : null,
  );
  n.guesses = n.guesses.map((b, s) =>
    s === viewer ? b : { orders: b.orders.map(() => null), locked: b.locked },
  );
  return n;
}
/** A stable per-seat order for a topic, never based on hidden lists. */
function hunch(seed: number) {
  return shuffle(identity(), () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
}
export function botMove(g: RankingGame, s: number): RankingMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'vote') return { type: 'vote', choice: botChoice(g, s) };
  if (g.phase === 'rank') {
    const b = g.ballots[s];
    if (!b)
      return {
        type: 'topic',
        target: g.offers[s][(s + g.round) % g.offers[s].length],
      };
    const order = hunch((s + 3) * 3571 + b.topic * 101);
    if (b.order.join() !== order.join()) return { type: 'arrange', order };
    return { type: 'lock' };
  }
  const author = g.seats.findIndex(
    (_, a) => a !== s && !g.guesses[s].orders[a],
  );
  if (author < 0) return { type: 'lock' };
  return {
    type: 'arrange',
    author,
    order: hunch((author + 1) * 31337 + (s + 1) * 7717 + g.round * 131),
  };
}
export function validState(g: RankingGame) {
  const n = g.seats.length,
    c = count(g),
    ints = (a: unknown, len: number, high: number) =>
      Array.isArray(a) &&
      a.length === len &&
      a.every((x) => Number.isInteger(x) && x >= 0 && x <= high);
  return (
    g.rules === 7 &&
    g.mode === 'individual' &&
    Array.isArray(g.teams) &&
    g.teams.length === n &&
    g.teams.every((t, s) => t === s) &&
    Array.isArray(g.scores) &&
    g.scores.length === n &&
    g.scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e5) &&
    ['rank', 'guess', 'reveal', 'vote'].includes(g.phase) &&
    (g.phase === 'vote'
      ? validVote(g.vote, n)
      : g.vote === undefined || g.vote === null) &&
    Number.isInteger(g.target) &&
    g.target >= 0 &&
    g.target < n &&
    Array.isArray(g.deck) &&
    g.deck.every((i) => Number.isInteger(i) && !!topics[i]) &&
    Array.isArray(g.offers) &&
    g.offers.length === n &&
    g.offers.every(
      (o) => ints(o, 3, topics.length - 1) && new Set(o).size === 3,
    ) &&
    Array.isArray(g.ballots) &&
    g.ballots.length === n &&
    g.ballots.every(
      (b, s) =>
        b === null ||
        (g.offers[s].includes(b.topic) &&
          permutation(b.order, c) &&
          typeof b.locked === 'boolean'),
    ) &&
    (g.phase === 'rank' ||
      !!g.vote?.opening ||
      g.ballots.every((b) => b?.locked)) &&
    Array.isArray(g.guesses) &&
    g.guesses.length === n &&
    g.guesses.every(
      (b, s) =>
        !!b &&
        typeof b.locked === 'boolean' &&
        Array.isArray(b.orders) &&
        b.orders.length === n &&
        b.orders.every((o, a) => o === null || (a !== s && permutation(o, c))),
    ) &&
    (g.phase !== 'reveal' || g.over || g.guesses.every((b) => b.locked)) &&
    (g.phase === 'reveal' || (g.phase === 'vote' && !g.vote?.opening)
      ? !!g.result &&
        permutation(g.result.order, c) &&
        Array.isArray(g.result.gains) &&
        g.result.gains.length === n &&
        g.result.gains.every(
          (v) => Number.isFinite(v) && v >= 0 && v <= perfectPoints,
        ) &&
        Array.isArray(g.result.guesses) &&
        g.result.guesses.length === n &&
        g.result.guesses.every((o) => o === null || permutation(o, c))
      : g.result === null)
  );
}
