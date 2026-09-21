/** Vela — two teams race kites along a silk ribbon strung across a spring meadow.
 *
 * Every flier commits one card face down and they all turn over together, so a
 * team's move is the sum of what its own fliers chose without being able to see
 * one another's hands. The sum is divided by the number of fliers on the team, so
 * a pair of fliers and a trio race at the same pace and the ribbon is the same
 * length at every table size. Teams are always even; an odd table is trimmed
 * rather than handing one kite a second pair of hands.
 *
 * Scissors cut the other team's tail: each pair of scissors played takes the
 * single strongest gust the opposing team played that round, before the average.
 */
import {
  type Difficulty,
  type LogEntry,
  type Outcome,
  type WorldBase,
  ints,
  isBot,
  note,
  roll,
  shuffle,
  validBase,
} from './types.ts';

/** Ribbon segments, west bank to east bank. */
export const TRACK = 24;
export const HAND = 4;
/** A meadow that never resolves is still a result; the longer kite takes it. */
export const ROUND_CAP = 40;
/** Scissors. Every other card is its own wind value, 1 to 5. */
export const SCISSORS = 0;
const DECK = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, SCISSORS, SCISSORS];

export const teamNames = ['Vermilion', 'Saffron'] as const;
export const seatChoices = [2, 4, 6];
export const defaultSeats = 4;

export type MeadowGame = WorldBase & {
  kind: 'meadow';
  /** 0 vermilion, 1 saffron; seats alternate so seat 0 always flies vermilion. */
  teams: number[];
  /** Each kite's segment on the ribbon. */
  at: number[];
  /** Segments that carry a painted gust swirl. */
  gusts: boolean[];
  hands: number[][];
  decks: number[][];
  discards: number[][];
  /** The card each flier has committed this round, face down, or -1. */
  commits: number[];
  round: number;
  phase: 'commit' | 'reveal';
  /** Everyone acknowledges the turn-over before the next round is dealt. */
  ready: boolean[];
  last: {
    cards: number[];
    cut: number[];
    gains: number[];
    lifted: boolean[];
  } | null;
  /** Scissors each team has spent all match; a dead heat goes to the honest fliers. */
  shears: number[];
  /** The winning team, or -1 for a level meadow. Null while the race is on. */
  winner: number | null;
};

export type MeadowMove =
  | { type: 'commit'; slot: number }
  | { type: 'withdraw' }
  | { type: 'ready' };

export const perTeam = (seats: number) => seats / 2;
export const teamOf = (seat: number) => seat % 2;
const teamSeats = (g: MeadowGame, team: number) =>
  g.seats.flatMap((_, s) => (g.teams[s] === team ? [s] : []));

function refill(g: MeadowGame, seat: number) {
  while (g.hands[seat].length < HAND) {
    if (!g.decks[seat].length) {
      if (!g.discards[seat].length) break;
      g.decks[seat] = shuffle(g.discards[seat], () => roll(g));
      g.discards[seat] = [];
    }
    g.hands[seat].push(g.decks[seat].shift()!);
  }
}

export function createGame(
  seats: number,
  seed: number,
  difficulty: Difficulty,
  names?: string[],
): MeadowGame {
  // Teams are always even, so an odd table is trimmed rather than left lopsided.
  const n = seats % 2 === 0 ? seats : seats - 1;
  const g: MeadowGame = {
    kind: 'meadow',
    version: 1,
    rules: 1,
    rngState: seed >>> 0,
    difficulty,
    seats:
      names?.slice(0, n) ??
      ['You', 'Rilla', 'Osk', 'Pim', 'Nedda', 'Cass'].slice(0, n),
    revision: 0,
    log: [] as LogEntry[],
    over: false,
    teams: Array.from({ length: n }, (_, s) => teamOf(s)),
    at: [0, 0],
    gusts: Array<boolean>(TRACK).fill(false),
    hands: Array.from({ length: n }, () => [] as number[]),
    decks: Array.from({ length: n }, () => [] as number[]),
    discards: Array.from({ length: n }, () => [] as number[]),
    commits: Array<number>(n).fill(-1),
    round: 1,
    phase: 'commit',
    ready: Array<boolean>(n).fill(false),
    last: null,
    shears: [0, 0],
    winner: null,
  };
  // A deterministic scatter: the same seed always paints the same meadow.
  for (let i = 3; i < TRACK - 2; i++) if (roll(g) < 0.22) g.gusts[i] = true;
  for (let s = 0; s < n; s++) {
    g.decks[s] = shuffle(DECK, () => roll(g));
    refill(g, s);
  }
  note(g, `The kites are up. ${TRACK} segments of ribbon to the far bank.`);
  return g;
}

export function actingSeats(g: MeadowGame): number[] {
  if (g.over) return [];
  return g.phase === 'commit'
    ? g.seats.flatMap((_, s) => (g.commits[s] < 0 ? [s] : []))
    : g.seats.flatMap((_, s) => (g.ready[s] ? [] : [s]));
}

/** A face-down card is face down: teammates included. */
export function observe(g: MeadowGame, viewer: number): MeadowGame {
  if (g.phase === 'reveal') return g;
  return {
    ...g,
    hands: g.hands.map((h, s) => (s === viewer ? h : h.map(() => -1))),
    decks: g.decks.map((d, s) => (s === viewer ? d : d.map(() => -1))),
    discards: g.discards.map((d, s) => (s === viewer ? d : d.map(() => -1))),
    commits: g.commits.map((c, s) => (s === viewer ? c : c < 0 ? -1 : -2)),
  };
}

export function validMove(g: MeadowGame, m: unknown, seat: number): boolean {
  if (g.over || !m || typeof m !== 'object') return false;
  if (!Number.isInteger(seat) || seat < 0 || seat >= g.seats.length)
    return false;
  const move = m as MeadowMove;
  if (move.type === 'ready') return g.phase === 'reveal' && !g.ready[seat];
  if (move.type === 'withdraw')
    return g.phase === 'commit' && g.commits[seat] >= 0;
  if (move.type !== 'commit') return false;
  return (
    g.phase === 'commit' &&
    g.commits[seat] < 0 &&
    Number.isInteger(move.slot) &&
    move.slot >= 0 &&
    move.slot < g.hands[seat].length &&
    g.hands[seat][move.slot] >= 0
  );
}

export function legalMoves(g: MeadowGame, seat: number): MeadowMove[] {
  const moves: MeadowMove[] = [
    { type: 'ready' },
    { type: 'withdraw' },
    ...g.hands[seat].map((_, slot) => ({ type: 'commit' as const, slot })),
  ];
  return moves.filter((m) => validMove(g, m, seat));
}

/** Where a kite ends up after a move, including the gust it may catch. */
export function landing(g: MeadowGame, from: number, gain: number) {
  const to = Math.min(TRACK - 1, from + gain);
  const lifted = gain > 0 && g.gusts[to] && to < TRACK - 1;
  return { to: lifted ? Math.min(TRACK - 1, to + 2) : to, lifted };
}

function resolve(g: MeadowGame) {
  const size = perTeam(g.seats.length);
  const cards = g.commits.map((c) => c);
  const wind: number[][] = [0, 1].map((t) =>
    teamSeats(g, t)
      .map((s) => cards[s])
      .filter((c) => c > SCISSORS)
      .sort((a, b) => b - a),
  );
  const cut = [0, 1].map(
    (t) => teamSeats(g, t).filter((s) => cards[s] === SCISSORS).length,
  );
  // Each pair of scissors takes the strongest gust the other team had.
  for (const t of [0, 1]) for (let i = 0; i < cut[t]; i++) wind[1 - t].shift();
  const totals = [0, 1].map((t) => wind[t].reduce((a, b) => a + b, 0));
  const gains = totals.map((total) => Math.round(total / size));
  const from = [...g.at];
  const lifted = [false, false];
  // How far the wind would have carried the kite if the bank were not there.
  const reach = [0, 0];
  for (const t of [0, 1]) {
    g.shears[t] += cut[t];
    const land = landing(g, g.at[t], gains[t]);
    reach[t] = from[t] + gains[t] + (land.lifted ? 2 : 0);
    g.at[t] = land.to;
    lifted[t] = land.lifted;
  }
  g.last = { cards, cut, gains, lifted };
  for (const t of [0, 1]) {
    const named = teamSeats(g, t)
      .map((s) => (cards[s] === SCISSORS ? 'scissors' : String(cards[s])))
      .join(' + ');
    note(
      g,
      `${teamNames[t]} plays ${named} — ${gains[t]} segment${gains[t] === 1 ? '' : 's'}${lifted[t] ? ', and catches a gust' : ''}.`,
    );
  }
  for (const s of g.seats.keys()) {
    g.discards[s].push(cards[s]);
    g.commits[s] = -1;
  }
  const home = [0, 1].filter((t) => g.at[t] >= TRACK - 1);
  if (home.length === 1) finish(g, home[0]);
  else if (home.length === 2) {
    // Both banks on the same breath. The stronger pull takes it; failing that
    // the longer chase, then the raw wind before it was shared out. Only two
    // kites that did the identical thing from the identical segment tie.
    const order: [number, boolean][] = [
      [reach[0] - reach[1], true],
      [gains[0] - gains[1], true],
      [from[0] - from[1], false],
      [totals[0] - totals[1], true],
      [g.shears[0] - g.shears[1], false],
    ];
    const decided = order.find(([diff]) => diff !== 0);
    finish(g, decided ? (decided[0] > 0 === decided[1] ? 0 : 1) : -1);
  } else if (g.round >= ROUND_CAP) {
    finish(g, g.at[0] === g.at[1] ? -1 : g.at[0] > g.at[1] ? 0 : 1);
  }
  g.phase = 'reveal';
  g.ready = g.seats.map(() => false);
}

function finish(g: MeadowGame, winner: number) {
  g.over = true;
  g.winner = winner;
  note(
    g,
    winner < 0
      ? 'A level meadow: both kites reach the far bank together.'
      : `${teamNames[winner]} reaches the far bank.`,
  );
}

export function play(g: MeadowGame, m: MeadowMove, seat: number): MeadowGame {
  if (!validMove(g, m, seat)) return g;
  const next: MeadowGame = {
    ...g,
    at: [...g.at],
    hands: g.hands.map((h) => [...h]),
    decks: g.decks.map((d) => [...d]),
    discards: g.discards.map((d) => [...d]),
    commits: [...g.commits],
    ready: [...g.ready],
    shears: [...g.shears],
    log: [...g.log],
    revision: g.revision + 1,
  };
  if (m.type === 'commit') {
    next.commits[seat] = next.hands[seat].splice(m.slot, 1)[0];
    if (next.commits.every((c) => c >= 0)) resolve(next);
    return next;
  }
  if (m.type === 'withdraw') {
    // Nothing has turned over yet, so a commitment can still be taken back.
    next.hands[seat].push(next.commits[seat]);
    next.commits[seat] = -1;
    return next;
  }
  next.ready[seat] = true;
  if (next.ready.every(Boolean) && !next.over) {
    next.round += 1;
    next.phase = 'commit';
    next.ready = next.seats.map(() => false);
    for (const s of next.seats.keys()) refill(next, s);
    note(next, `Round ${next.round}.`);
  }
  return next;
}

/** How a flier plays when they are paying attention. */
function chosen(g: MeadowGame, seat: number): number {
  const team = g.teams[seat],
    mine = g.at[team],
    theirs = g.at[1 - team];
  const hand = g.hands[seat];
  const winds = hand.flatMap((c, i) => (c > SCISSORS ? [[c, i] as const] : []));
  const shears = hand.flatMap((c, i) => (c === SCISSORS ? [i] : []));
  if (!winds.length) return shears[0] ?? 0;
  const strongest = winds.reduce((a, b) => (b[0] > a[0] ? b : a));
  // Cut when the other kite is about to take the bank, or has pulled away.
  const threatened = theirs >= TRACK - 6 && theirs >= mine;
  const trailing = theirs - mine >= 4;
  if (shears.length && (threatened || trailing) && mine < TRACK - 6)
    return shears[0];
  return strongest[1];
}

const care: Record<Difficulty, number> = { easy: 0.3, medium: 0.7, hard: 1 };

export function botMove(g: MeadowGame, seat: number): MeadowMove | null {
  if (g.over && g.phase !== 'reveal') return null;
  if (g.phase === 'reveal') return g.ready[seat] ? null : { type: 'ready' };
  if (g.commits[seat] >= 0 || !g.hands[seat].length) return null;
  const dice = { rngState: g.rngState + seat * 2654435761 };
  if (roll(dice) >= care[g.difficulty])
    return {
      type: 'commit',
      slot: Math.floor(roll(dice) * g.hands[seat].length),
    };
  return { type: 'commit', slot: chosen(g, seat) };
}

export function outcome(g: MeadowGame): Outcome {
  const level = g.winner === null || g.winner < 0;
  return {
    title: level ? 'A level meadow' : `${teamNames[g.winner!]} wins`,
    detail: level
      ? 'Both kites touch the far bank on the same breath.'
      : `${g.round} round${g.round === 1 ? '' : 's'} of wind and shears.`,
    winners: level
      ? g.seats.map((_, s) => s)
      : g.seats.flatMap((_, s) => (g.teams[s] === g.winner ? [s] : [])),
    rows: [0, 1].map((t) => ({
      name: teamNames[t],
      value: `segment ${g.at[t] + 1} of ${TRACK}`,
    })),
  };
}

export function progress(g: MeadowGame) {
  return {
    label: `Round ${g.round}`,
    detail: g.over
      ? outcome(g).detail
      : g.phase === 'commit'
        ? 'Choose a card face down; every flier turns over together'
        : `${teamNames[0]} ${g.at[0] + 1} · ${teamNames[1]} ${g.at[1] + 1}`,
  };
}

export function validState(g: unknown): g is MeadowGame {
  if (!validBase(g, 'meadow')) return false;
  const m = g as MeadowGame;
  const n = m.seats.length;
  const cards = (a: unknown, hidden = false): a is number[] =>
    Array.isArray(a) &&
    a.every((c) => Number.isInteger(c) && c >= (hidden ? -1 : 0) && c <= 5);
  return (
    seatChoices.includes(n) &&
    ints(m.teams, n, 0, 1) &&
    m.teams.every((t, s) => t === teamOf(s)) &&
    ints(m.at, 2, 0, TRACK - 1) &&
    ints(m.shears, 2, 0, 500) &&
    Array.isArray(m.gusts) &&
    m.gusts.length === TRACK &&
    m.gusts.every((x) => typeof x === 'boolean') &&
    Array.isArray(m.hands) &&
    m.hands.length === n &&
    m.hands.every((h) => h.length <= HAND && cards(h, true)) &&
    m.decks.length === n &&
    m.decks.every((d) => cards(d, true)) &&
    m.discards.length === n &&
    m.discards.every((d) => cards(d, true)) &&
    ints(m.commits, n, -2, 5) &&
    Number.isInteger(m.round) &&
    m.round >= 1 &&
    m.round <= ROUND_CAP &&
    ['commit', 'reveal'].includes(m.phase) &&
    Array.isArray(m.ready) &&
    m.ready.length === n &&
    m.ready.every((x) => typeof x === 'boolean') &&
    (m.last === null ||
      (ints(m.last.cards, n, -2, 5) &&
        ints(m.last.cut, 2, 0, n) &&
        ints(m.last.gains, 2, 0, 5) &&
        Array.isArray(m.last.lifted) &&
        m.last.lifted.length === 2)) &&
    (m.winner === null ||
      (Number.isInteger(m.winner) && m.winner >= -1 && m.winner <= 1)) &&
    (m.over ? m.winner !== null : m.winner === null)
  );
}

export { isBot };
