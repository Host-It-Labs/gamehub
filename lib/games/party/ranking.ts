import { topics } from './catalog.ts';
import { groups, assertSeats, groupName } from './groups.ts';
export { groupName, teamNames } from './groups.ts';
import {
  shuffle,
  roll,
  note,
  type Difficulty,
  type StandaloneBase,
} from '../standalone/types.ts';
export type RankingMove =
  | { type: 'topic'; target: number }
  | { type: 'arrange'; order: number[] }
  | { type: 'lock' | 'unlock' | 'ready' | 'refresh' };
type Ballot = {
  topic: number;
  order: number[];
  locked: boolean;
};
type Guess = { order: number[]; locked: boolean };
export type RankingGame = StandaloneBase & {
  kind: 'orin';
  rules: 6;
  mode: 'teams' | 'individual';
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'rank' | 'guess' | 'reveal';
  offers: number[][];
  refreshes?: number[];
  topicOrders?: Record<number, number[]>[];
  ballots: (Ballot | null)[];
  target: number;
  guesses: (Guess | null)[];
  scores: number[];
  ready: boolean[];
  deck: number[];
  teams: number[];
  lastAction: string;
  result: null | {
    order: number[];
    guesses: (Guess | null)[];
    gains: number[];
  };
};
export const tiers = ['1st', '2nd', '3rd', '4th', '5th'];
export function count(_g?: RankingGame) {
  return 5;
}
export function createGame(
  kind: 'orin',
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
  mode: 'teams' | 'individual' = 'individual',
  _seen: ReadonlySet<string> = new Set(),
  teams?: number[],
): RankingGame {
  if (kind !== 'orin') throw new Error('Unknown ranking game.');
  assertSeats(n, mode);
  const g: RankingGame = {
    kind,
    version: 1,
    rules: 6,
    rngState: seed >>> 0,
    difficulty,
    seats: Array.from({ length: n }, (_, i) => (i ? `Player ${i + 1}` : 'You')),
    revision: 0,
    log: [],
    over: false,
    mode,
    round: 1,
    tutorial: false,
    lesson: 0,
    phase: 'rank',
    offers: [],
    ballots: [],
    target: 0,
    guesses: Array.from({ length: mode === 'teams' ? n + 2 : n }, () => null),
    scores: Array(mode === 'teams' ? 2 : n).fill(0),
    ready: [],
    deck: [],
    teams: groups(n, mode, teams),
    lastAction: '',
    result: null,
  };
  g.deck = shuffle(
    topics.map((t) => t.id),
    () => roll(g),
  );

  deal(g);
  return g;
}
function deal(g: RankingGame) {
  g.phase = 'rank';
  g.target = 0;
  g.result = null;
  g.guesses = Array.from({ length: guessCount(g) }, () => null);
  g.ready = g.seats.map(() => false);
  g.offers = g.seats.map(() => g.deck.splice(0, 3));
  g.ballots = g.seats.map(() => null);
  g.refreshes = g.seats.map(() => 0);
  g.topicOrders = g.seats.map(() => ({}));
  note(g, `Round ${g.round}: everyone prepares a private ranking at once.`);
}
export function guessCount(g: RankingGame) {
  return g.mode === 'teams' ? g.seats.length + 2 : g.scores.length;
}
export function guessSlot(g: RankingGame, seat: number) {
  return g.mode === 'teams' && g.teams[seat] === g.teams[g.target]
    ? seat + 2
    : g.teams[seat];
}
export function guessTeam(g: RankingGame, slot: number) {
  return slot >= 2 && g.mode === 'teams' ? g.teams[slot - 2] : slot;
}
export function guessName(g: RankingGame, slot: number) {
  return slot >= 2 && g.mode === 'teams'
    ? g.seats[slot - 2]
    : groupName(g, slot);
}
export function guessingTeams(g: RankingGame) {
  return [
    ...new Set(
      g.seats.flatMap((_, seat) =>
        seat !== g.target ? [guessSlot(g, seat)] : [],
      ),
    ),
  ];
}
export function captain(g: RankingGame, team: number) {
  if (g.mode === 'teams' && team >= 2) return team - 2;
  const seats = g.teams.flatMap((t, s) =>
    t === team && s !== g.target ? [s] : [],
  );
  return seats[(g.target + g.round - 1) % seats.length];
}
export function guessPoints(
  order: number[],
  answer: number[],
  _kind?: RankingGame['kind'],
) {
  const hits = order.slice(0, 5).filter((v, i) => v === answer[i]).length;
  return hits + (hits === 5 ? 2 : 0);
}
export function actingSeats(g: RankingGame): number[] {
  if (g.over) return [];
  if (g.phase === 'rank')
    return g.seats.flatMap((_, s) => (!g.ballots[s]?.locked ? [s] : []));
  if (g.phase === 'guess')
    return guessingTeams(g).flatMap((t) =>
      !g.guesses[t]?.locked ? [captain(g, t)] : [],
    );
  return g.seats.flatMap((_, s) => (!g.ready[s] ? [s] : []));
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
  if (Object.keys(m).some((k) => !['type', 'target', 'order'].includes(k)))
    return false;
  if (g.phase === 'reveal') return m.type === 'ready' && !g.ready[seat];
  if (g.phase === 'rank') {
    const b = g.ballots[seat];
    if (m.type === 'unlock') return !!b?.locked;
    if (b?.locked) return false;
    if (m.type === 'refresh') return (g.refreshes?.[seat] ?? 0) < 2;
    if (m.type === 'topic')
      return Number.isInteger(m.target) && g.offers[seat].includes(m.target);
    if (m.type === 'arrange') return !!b && permutation(m.order, count(g));
    return m.type === 'lock' && !!b && permutation(b.order, count(g));
  }
  const t = guessSlot(g, seat);
  if (seat === g.target || !guessingTeams(g).includes(t)) return false;
  const b = g.guesses[t];
  if (m.type === 'unlock') return !!b?.locked && captain(g, t) === seat;
  if (b?.locked) return false;
  if (m.type === 'arrange') return permutation(m.order, count(g));
  return m.type === 'lock' && captain(g, t) === seat;
}
export function play(g: RankingGame, m: RankingMove, s: number): RankingGame {
  if (!validMove(g, m, s)) return g;
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
        ? { topic: n.offers[s][0], order: [0, 1, 2, 3, 4], locked: false }
        : null;
    }
    if (m.type === 'topic') {
      n.ballots[s] = {
        topic: m.target,
        order: n.topicOrders?.[s]?.[m.target]
          ? [...n.topicOrders[s][m.target]]
          : Array.from({ length: count(n) }, (_, i) => i),
        locked: false,
      };
    }
    if (m.type === 'arrange') n.ballots[s]!.order = [...m.order];
    if (m.type === 'lock') {
      const ballot = n.ballots[s]!;

      ballot.locked = true;
    }
    if (m.type === 'unlock') n.ballots[s]!.locked = false;
    if (n.ballots.every((b) => b?.locked)) {
      n.phase = 'guess';
      note(
        n,
        `Read ${n.seats[n.target]}'s list. ${n.mode === 'teams' ? 'Opponents share a guess. The author’s teammates guess silently on their own; their scores are averaged.' : 'Everyone else guesses privately.'}`,
      );
    }
  } else if (n.phase === 'guess') {
    const t = guessSlot(n, s);
    if (m.type === 'arrange')
      n.guesses[t] = {
        order: [...m.order],
        locked: false,
      };
    if (m.type === 'lock') {
      n.guesses[t] ??= {
        order: Array.from({ length: count(n) }, (_, i) => i),
        locked: false,
      };
      n.guesses[t]!.locked = true;
    }
    if (m.type === 'unlock') n.guesses[t]!.locked = false;
    if (guessingTeams(n).every((t) => n.guesses[t]?.locked)) {
      const answer = n.ballots[n.target]!.order,
        gains = n.scores.map(() => 0);
      for (const team of guessingTeams(n)) {
        const guess = n.guesses[team]!;
        const scoringTeam = guessTeam(n, team);
        const divisor = guessingTeams(n).filter(
          (slot) => guessTeam(n, slot) === scoringTeam,
        ).length;
        gains[scoringTeam] +=
          guessPoints(guess.order, answer, n.kind) / divisor;
      }
      n.scores = n.scores.map((v, i) => v + gains[i]);
      n.result = {
        order: [...answer],
        guesses: structuredClone(n.guesses),
        gains,
      };
      n.phase = 'reveal';
      n.ready = n.seats.map(() => false);
      note(
        n,
        `${n.seats[n.target]}'s list revealed. ${n.scores.map((_, i) => `${groupName(n, i)} +${gains[i]}`).join(', ')}.`,
      );
    }
  } else if (m.type === 'ready') {
    n.ready[s] = true;
    if (n.ready.every(Boolean)) {
      if (n.round === 2 && n.target === n.seats.length - 1) {
        n.over = true;
        note(n, 'Both rounds complete.');
        return n;
      }
      n.target++;
      n.result = null;
      n.guesses = Array.from({ length: guessCount(n) }, () => null);
      n.ready = n.seats.map(() => false);
      if (n.target < n.seats.length) n.phase = 'guess';
      else {
        n.round++;
        deal(n);
      }
    }
  }
  return n;
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
  n.ballots = n.ballots.map((b, s) =>
    b
      ? {
          topic:
            s === viewer || (n.phase !== 'rank' && s === n.target)
              ? b.topic
              : -1,
          locked: b.locked,
          order:
            s === viewer || (s === n.target && n.phase === 'reveal')
              ? [...b.order]
              : [],
        }
      : null,
  );
  n.guesses = n.guesses.map((b, t) =>
    b
      ? {
          ...b,
          order:
            n.phase === 'reveal' ||
            (viewer !== n.target && guessSlot(n, viewer) === t)
              ? [...b.order]
              : [],
        }
      : null,
  );
  return n;
}
export function botMove(g: RankingGame, s: number): RankingMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'reveal') return { type: 'ready' };
  if (g.phase === 'rank') {
    const b = g.ballots[s];
    if (!b)
      return {
        type: 'topic',
        target: g.offers[s][(s + g.round) % g.offers[s].length],
      };

    // A stable per-seat permutation, based only on this player's visible topic.
    const order = Array.from({ length: count(g) }, (_, i) => i).sort(
      (a, b) =>
        (((a + 1) * 7919 + (s + 3) * 3571 + g.ballots[s]!.topic * 101) % 97) -
        (((b + 1) * 7919 + (s + 3) * 3571 + g.ballots[s]!.topic * 101) % 97),
    );
    if (b.order.join() !== order.join()) return { type: 'arrange', order };
    return { type: 'lock' };
  }
  const t = guessSlot(g, s);
  if (permutation(g.guesses[t]?.order, count(g))) return { type: 'lock' };
  // Bots never see a target's hidden preference and never pretend to infer it.
  let seed = (g.target + 1) * 31337 + (t + 1) * 7717 + g.round * 131;
  const order = shuffle(
    Array.from({ length: count(g) }, (_, i) => i),
    () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    },
  );
  return { type: 'arrange', order };
}
