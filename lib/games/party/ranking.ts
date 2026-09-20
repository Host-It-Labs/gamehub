import { topics } from './catalog.ts';
import { facts } from './facts.ts';
import { groups, assertSeats, groupName } from './groups.ts';
export { groupName, teamNames } from './groups.ts';
import {
  shuffle,
  roll,
  rng,
  note,
  type Difficulty,
  type StandaloneBase,
} from '../standalone/types.ts';
export type RankingMove =
  | { type: 'topic'; target: number }
  | { type: 'decoy'; text: string }
  | { type: 'arrange'; order: number[] }
  | { type: 'lock' | 'unlock' | 'ready' };
type Ballot = {
  topic: number;
  order: number[];
  locked: boolean;
  answers?: string[];
  decoy?: string;
};
type Guess = { order: number[]; locked: boolean };
export type RankingGame = StandaloneBase & {
  kind: 'orin' | 'vela';
  rules: 5;
  mode: 'teams' | 'individual';
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'rank' | 'guess' | 'reveal';
  offers: number[][];
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
    bluff: number[];
  };
};
export const tiers = ['S', 'A', 'B', 'C', 'D'];
export function count(g: RankingGame) {
  return g.kind === 'vela' ? 6 : 5;
}
export function createGame(
  kind: 'orin' | 'vela',
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
  mode: 'teams' | 'individual' = 'individual',
): RankingGame {
  assertSeats(n, mode);
  const g: RankingGame = {
    kind,
    version: 1,
    rules: 5,
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
    guesses: Array.from({ length: mode === 'teams' ? 2 : n }, () => null),
    scores: Array(mode === 'teams' ? 2 : n).fill(0),
    ready: [],
    deck: [],
    teams: groups(n, mode),
    lastAction: '',
    result: null,
  };
  g.deck = shuffle(
    (kind === 'vela' ? facts : topics).map((t) => t.id),
    () => roll(g),
  );
  deal(g);
  return g;
}
function deal(g: RankingGame) {
  g.phase = 'rank';
  g.target = 0;
  g.result = null;
  g.guesses = g.scores.map(() => null);
  g.ready = g.seats.map(() => false);
  g.offers = g.seats.map(() => g.deck.splice(0, g.kind === 'vela' ? 2 : 3));
  g.ballots = g.seats.map(() => null);
  note(
    g,
    `Round ${g.round}: everyone prepares a private ${g.kind === 'vela' ? 'factual list and decoy' : 'ranking'} at once.`,
  );
}
export function guessingTeams(g: RankingGame) {
  return g.scores.flatMap((_, t) => (t !== g.teams[g.target] ? [t] : []));
}
export function captain(g: RankingGame, team: number) {
  const seats = g.teams.flatMap((t, s) =>
    t === team && s !== g.target ? [s] : [],
  );
  return seats[(g.target + g.round - 1) % seats.length];
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
  if (
    Object.keys(m).some((k) => !['type', 'target', 'order', 'text'].includes(k))
  )
    return false;
  if (g.phase === 'reveal') return m.type === 'ready' && !g.ready[seat];
  if (g.phase === 'rank') {
    const b = g.ballots[seat];
    if (m.type === 'unlock') return !!b?.locked;
    if (b?.locked) return false;
    if (m.type === 'topic')
      return Number.isInteger(m.target) && g.offers[seat].includes(m.target);
    if (m.type === 'decoy')
      return (
        g.kind === 'vela' &&
        !!b &&
        typeof m.text === 'string' &&
        m.text.trim().length > 0 &&
        m.text.length <= 80 &&
        !facts[b.topic].answers.some(
          (a) => a.toLocaleLowerCase() === m.text.trim().toLocaleLowerCase(),
        )
      );
    if (m.type === 'arrange')
      return g.kind === 'orin' && !!b && permutation(m.order, count(g));
    return (
      m.type === 'lock' &&
      !!b &&
      permutation(b.order, count(g)) &&
      (g.kind === 'orin' || !!b.decoy)
    );
  }
  const t = g.teams[seat];
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
    if (m.type === 'topic')
      n.ballots[s] = {
        topic: m.target,
        order: Array.from({ length: count(n) }, (_, i) => i),
        locked: false,
      };
    if (m.type === 'decoy') {
      n.ballots[s]!.decoy = m.text.trim();
      delete n.ballots[s]!.answers;
      n.ballots[s]!.order = [0, 1, 2, 3, 4, 5];
    }
    if (m.type === 'arrange') n.ballots[s]!.order = [...m.order];
    if (m.type === 'lock') {
      const ballot = n.ballots[s]!;
      if (n.kind === 'vela') {
        const trueAnswers = [...facts[ballot.topic].answers, ballot.decoy!];
        ballot.answers = shuffle(
          trueAnswers,
          rng((n.rngState ^ Math.imul(s + 1, 7919) ^ ballot.topic) >>> 0),
        );
        ballot.order = trueAnswers.map((answer) =>
          ballot.answers!.indexOf(answer),
        );
      }
      ballot.locked = true;
    }
    if (m.type === 'unlock') n.ballots[s]!.locked = false;
    if (n.ballots.every((b) => b?.locked)) {
      n.phase = 'guess';
      note(
        n,
        `Read ${n.seats[n.target]}'s list. ${n.mode === 'teams' ? 'The opposing team shares one guess.' : 'Everyone else guesses privately.'}`,
      );
    }
  } else if (n.phase === 'guess') {
    const t = n.teams[s];
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
        gains = n.scores.map(() => 0),
        bluff = n.scores.map(() => 0);
      for (const team of guessingTeams(n)) {
        const guess = n.guesses[team]!;
        const hits = guess.order
          .slice(0, 5)
          .filter((v, i) => v === answer[i]).length;
        gains[team] =
          hits +
          (n.kind === 'orin'
            ? hits === 5
              ? 2
              : 0
            : guess.order[5] === answer[5]
              ? 3
              : 0);
        if (n.kind === 'vela' && guess.order[5] !== answer[5])
          bluff[n.teams[n.target]] += 2;
      }
      n.scores = n.scores.map((v, i) => v + gains[i] + bluff[i]);
      n.result = {
        order: [...answer],
        guesses: structuredClone(n.guesses),
        gains,
        bluff,
      };
      n.phase = 'reveal';
      n.ready = n.seats.map(() => false);
      note(
        n,
        `${n.seats[n.target]}'s list revealed. ${n.scores.map((_, i) => `${groupName(n, i)} +${gains[i] + bluff[i]}`).join(', ')}.`,
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
      n.guesses = n.scores.map(() => null);
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
          ...(b.answers &&
          (s === viewer || (n.phase !== 'rank' && s === n.target))
            ? { answers: [...b.answers] }
            : {}),
          ...(b.decoy && s === viewer ? { decoy: b.decoy } : {}),
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
            (viewer !== n.target && n.teams[viewer] === t)
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
    if (g.kind === 'vela')
      return b.decoy
        ? { type: 'lock' }
        : { type: 'decoy', text: facts[b.topic].botDecoy };
    // A stable per-seat permutation, based only on this player's visible topic.
    const order = Array.from({ length: count(g) }, (_, i) => i).sort(
      (a, b) =>
        (((a + 1) * 7919 + (s + 3) * 3571 + g.ballots[s]!.topic * 101) % 97) -
        (((b + 1) * 7919 + (s + 3) * 3571 + g.ballots[s]!.topic * 101) % 97),
    );
    if (b.order.join() !== order.join()) return { type: 'arrange', order };
    return { type: 'lock' };
  }
  const t = g.teams[s];
  if (g.guesses[t]) return { type: 'lock' };
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
