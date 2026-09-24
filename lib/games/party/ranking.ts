import { liveTopicIds } from './catalog.ts';
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
  | { type: 'vote'; choice: RoundChoice }
  | { type: 'lock' | 'unlock' | 'next' | 'refresh' };
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
  phase: 'rank' | 'guess' | 'reveal' | 'vote';
  /** The ten-second keep-going-or-finish vote after each round's last reveal. */
  vote?: RoundVote | null;
  offers: number[][];
  refreshes?: number[];
  topicOrders?: Record<number, number[]>[];
  ballots: (Ballot | null)[];
  target: number;
  guesses: (Guess | null)[];
  scores: number[];
  /** Kept for saved games; reveals now advance on the host's single `next`. */
  ready: boolean[];
  deck: number[];
  teams: number[];
  lastAction: string;
  /** Present while this game is part of a Tribu match. */
  tribu?: TribuState;
  /** Set when the table voted to switch games; the registry swaps the state. */
  handoff?: SetGame | null;
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
export function guessPoints(
  order: number[],
  answer: number[],
  _kind?: RankingGame['kind'],
) {
  return guessOffsets(order.slice(0, 5), answer.slice(0, 5)).reduce(
    (sum, d) => sum + itemPoints(d),
    0,
  );
}
export function actingSeats(g: RankingGame): number[] {
  if (g.over) return [];
  if (g.phase === 'rank')
    return g.seats.flatMap((_, s) => (!g.ballots[s]?.locked ? [s] : []));
  if (g.phase === 'guess')
    return guessingTeams(g).flatMap((t) =>
      !g.guesses[t]?.locked ? [captain(g, t)] : [],
    );
  if (g.phase === 'vote')
    return g.seats.flatMap((_, s) => (g.vote?.choices[s] ? [] : [s]));
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
    Object.keys(m).some((k) => !['type', 'target', 'order', 'choice'].includes(k))
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
  } else if (n.phase === 'vote') {
    if (m.type === 'vote') n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return closeRound(n);
  } else if (m.type === 'next') {
    if (n.target === n.seats.length - 1) {
      n.phase = 'vote';
      n.vote = openVote(
        n.seats.length,
        now,
        !n.tutorial,
        n.tribu ? ['orin', 'dial', 'finish'] : undefined,
      );
      note(n, `Round ${n.round} complete. Another round?`);
      return n;
    }
    n.target++;
    n.result = null;
    n.guesses = Array.from({ length: guessCount(n) }, () => null);
    if (n.target < n.seats.length) n.phase = 'guess';
    else {
      n.round++;
      deal(n);
    }
  }
  return n;
}
function closeRound(g: RankingGame): RankingGame {
  const opening = !!g.vote!.opening;
  const choice = voteResult(g.vote!, opening ? null : g.tribu ? 'orin' : 'more', (n) =>
    Math.floor(roll(g) * n),
  );
  g.vote = null;
  if (opening) {
    // Tribu's first vote: the deal is ready, or the table goes to Dial.
    if (choice === 'dial') g.handoff = 'dial';
    else g.phase = 'rank';
    note(g, `The table chose ${choice === 'dial' ? 'Dial' : 'My Top Five'}.`);
    return g;
  }
  if (choice === 'finish' || g.round >= maxRounds) {
    // The finished table keeps the last reveal on screen.
    g.phase = 'reveal';
    g.over = true;
    note(g, `The table finished after ${g.round} round${g.round === 1 ? '' : 's'}.`);
    return g;
  }
  g.round++;
  if (choice === 'dial') {
    g.handoff = 'dial';
    return g;
  }
  g.target = 0;
  deal(g);
  return g;
}
/** The server owns the vote deadline; players who stay silent don't count. */
export function tick(g: RankingGame, now = Date.now()): RankingGame {
  if (g.over || g.phase !== 'vote' || !g.vote || !voteClosed(g.vote, now))
    return g;
  const n = structuredClone(g);
  n.revision++;
  return closeRound(n);
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
  // Practice bots play the classic two rounds, then vote to finish.
  if (g.phase === 'vote')
    return {
      type: 'vote',
      choice: g.vote?.opening
        ? s % 2
          ? 'dial'
          : 'orin'
        : g.round >= 2
          ? 'finish'
          : g.tribu
            ? 'orin'
            : 'more',
    };
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
