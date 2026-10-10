import { orderSets, liveOrderIds } from './order-sets.ts';
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

/** Order, after the sorting dailies: three sets a round, each five things to
 * put in order by a measure (Tallest first). Everyone sorts all three, locks
 * once, and the host reveals them one at a time. Played inside Quiz. */
export type OrderMove =
  | { type: 'arrange'; step: number; order: number[] }
  /** Locks all three; may carry the last order so it lands with the lock. */
  | { type: 'lock'; step?: number; order?: number[] }
  | { type: 'vote'; choice: RoundChoice }
  | { type: 'unlock' | 'next' };
/** Orders are item indices of the set, first place first; an untouched set
 * counts in its dealt order. */
export type OrderGuess = { orders: (number[] | null)[]; locked: boolean };
export type OrderGame = StandaloneBase & {
  kind: 'order';
  rules: 1;
  mode: 'individual';
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'guess' | 'reveal' | 'vote';
  /** The round's three set ids. */
  sets: number[];
  /** The order each set is dealt in, the same for everyone. */
  dealt: number[][];
  /** The set being revealed; 0 while guessing. */
  step: number;
  guesses: OrderGuess[];
  scores: number[];
  used: number[];
  vote: RoundVote | null;
  gains: number[][];
  tribu?: TribuState;
  handoff?: SetGame | null;
};
export const setsPerRound = 3;
export const itemsPerSet = 5;
/** Points by how many pairs are the wrong way round: a perfect order
 * scores 100 like every Quiz prompt, and every wrong pair costs the same
 * 25, so 100, 75, 50, 25, then nothing (10 October 2026; it was 100, 50,
 * 20, a cliff after the first mistake). */
export const pairCost = 25;
export const pairPoints = [100, 75, 50, 25] as const;
/** Pairs of things the wrong way round. */
export function wrongPairs(order: number[]) {
  let wrong = 0;
  for (let i = 0; i < order.length; i++)
    for (let j = i + 1; j < order.length; j++) if (order[i] > order[j]) wrong++;
  return wrong;
}
export function orderPoints(order: number[]) {
  // Item i belongs in place i.
  return (pairPoints as readonly number[])[wrongPairs(order)] ?? 0;
}
export function permutation(a: unknown): a is number[] {
  return (
    Array.isArray(a) &&
    a.length === itemsPerSet &&
    new Set(a).size === itemsPerSet &&
    a.every((v) => Number.isInteger(v) && v >= 0 && v < itemsPerSet)
  );
}
export function createGame(
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
  used: readonly number[] = [],
): OrderGame {
  assertSeats(n, 'individual');
  const g: OrderGame = {
    kind: 'order',
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
    sets: [],
    dealt: [],
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
const inOrder = (o: number[]) => o.every((v, i) => v === i);
function deal(g: OrderGame) {
  const used = new Set(g.used),
    fresh = liveOrderIds.filter((id) => !used.has(id)),
    pool = fresh.length >= setsPerRound ? fresh : liveOrderIds;
  g.sets = shuffle(pool, () => roll(g)).slice(0, setsPerRound);
  g.used.push(...g.sets);
  g.dealt = g.sets.map(() => {
    let o = [0, 1, 2, 3, 4];
    // Never deal a set already sorted.
    while (inOrder(o)) o = shuffle(o, () => roll(g));
    return o;
  });
  g.phase = 'guess';
  g.step = 0;
  g.vote = null;
  g.gains = [];
  g.guesses = g.seats.map(() => ({
    orders: Array(setsPerRound).fill(null),
    locked: false,
  }));
  note(g, `Round ${g.round}: three sets to put in order.`);
}
/** A player's order for one set, untouched sets as dealt. */
export function orderAt(g: OrderGame, s: number, step: number) {
  return g.guesses[s]?.orders[step] ?? g.dealt[step];
}
export function actingSeats(g: OrderGame): number[] {
  if (g.over || g.phase === 'reveal') return [];
  if (g.phase === 'vote') return voters(g);
  return g.seats.flatMap((_, s) => (g.guesses[s].locked ? [] : [s]));
}
export function validMove(
  g: OrderGame,
  move: unknown,
  seat: number,
): move is OrderMove {
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
  const m = move as OrderMove;
  const keys =
    m.type === 'arrange' || m.type === 'lock'
      ? ['type', 'step', 'order']
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
  const step = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) < setsPerRound;
  if (m.type === 'arrange') return step(m.step) && permutation(m.order);
  if (m.type === 'lock')
    return m.step === undefined && m.order === undefined
      ? true
      : step(m.step) && permutation(m.order);
  return false;
}
function reveal(g: OrderGame) {
  const gains = g.seats.map((_, s) => orderPoints(orderAt(g, s, g.step)));
  g.gains.push(gains);
  g.scores = g.scores.map((v, s) => v + gains[s]);
  g.phase = 'reveal';
  note(
    g,
    `${orderSets[g.sets[g.step]].title}: ${g.seats.map((name, s) => `${name} +${gains[s]}`).join(', ')}.`,
  );
}
export function play(
  g: OrderGame,
  m: OrderMove,
  s: number,
  now = Date.now(),
): OrderGame {
  if (!validMove(g, m, s)) return g;
  if (g.phase === 'vote' && g.vote && voteClosed(g.vote, now))
    return tick(g, now);
  const n = structuredClone(g);
  n.revision++;
  if (n.phase === 'guess') {
    const b = n.guesses[s];
    if ((m.type === 'arrange' || m.type === 'lock') && m.order)
      b.orders[m.step!] = [...m.order];
    if (m.type === 'lock') b.locked = true;
    if (m.type === 'unlock') b.locked = false;
    if (n.guesses.every((x) => x.locked)) {
      n.step = 0;
      reveal(n);
    }
  } else if (n.phase === 'reveal') {
    if (n.step < setsPerRound - 1) {
      n.step++;
      reveal(n);
    } else endRound(n, now);
  } else if (m.type === 'vote') {
    n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return close(n);
  }
  return n;
}
function close(g: OrderGame) {
  return closeRound(g, deal);
}
export function tick(g: OrderGame, now = Date.now()): OrderGame {
  if (g.over || g.phase !== 'vote' || !g.vote || !voteClosed(g.vote, now))
    return g;
  const n = structuredClone(g);
  n.revision++;
  return close(n);
}
export function shown(g: OrderGame) {
  return g.phase === 'guess' ? 0 : g.step + 1;
}
export function observe(g: OrderGame, viewer: number): OrderGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.used = [];
  const open = shown(n);
  n.guesses = n.guesses.map((b, s) =>
    s === viewer
      ? b
      : { ...b, orders: b.orders.map((o, i) => (i < open ? o : null)) },
  );
  return n;
}
export function botMove(g: OrderGame, s: number): OrderMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'vote') return { type: 'vote', choice: botChoice(g, s) };
  const step = g.guesses[s].orders.findIndex((o) => o === null);
  if (step < 0) return { type: 'lock' };
  // Bots swap two neighbours of the dealt order: a hunch, never the answer.
  const order = [...g.dealt[step]],
    i = (s + step + g.round) % (itemsPerSet - 1);
  [order[i], order[i + 1]] = [order[i + 1], order[i]];
  return { type: 'arrange', step, order };
}
export function validState(g: OrderGame) {
  const n = g.seats.length,
    revealed = g.phase === 'guess' ? 0 : g.step + 1,
    id = (i: unknown) => Number.isInteger(i) && !!orderSets[i as number];
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
    g.step < setsPerRound &&
    (g.phase !== 'guess' || g.step === 0) &&
    (g.phase !== 'vote' || g.step === setsPerRound - 1) &&
    Array.isArray(g.used) &&
    g.used.every(id) &&
    Array.isArray(g.sets) &&
    g.sets.length === setsPerRound &&
    g.sets.every(id) &&
    Array.isArray(g.dealt) &&
    g.dealt.length === setsPerRound &&
    g.dealt.every(permutation) &&
    Array.isArray(g.guesses) &&
    g.guesses.length === n &&
    g.guesses.every(
      (b) =>
        !!b &&
        typeof b.locked === 'boolean' &&
        Array.isArray(b.orders) &&
        b.orders.length === setsPerRound &&
        b.orders.every((o) => o === null || permutation(o)),
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
