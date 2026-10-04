import type { Difficulty, Outcome, StandaloneId } from './types.ts';
import * as ranking from '../party/ranking.ts';
import * as geography from '../party/geography.ts';
import * as dial from '../party/dial.ts';
import * as sizes from '../party/size.ts';
import * as coins from '../party/coins.ts';
import * as year from '../party/year.ts';
import * as order from '../party/order.ts';
import * as impostor from '../party/impostor.ts';
import { maxRounds, setOf } from '../party/vote.ts';
import {
  createSabi,
  createTribu,
  seatTotals,
  setNames,
  settle,
} from '../party/tribu.ts';
import {
  groups,
  validTeams,
  groupName,
  partySeats,
  type PartyMode,
} from '../party/groups.ts';
export type AnyGame =
  | ranking.RankingGame
  | geography.GeoGame
  | dial.DialGame
  | sizes.SizeGame
  | coins.CoinsGame
  | year.YearGame
  | order.OrderGame
  | impostor.ImpostorGame;
export type AnyMove =
  | ranking.RankingMove
  | geography.GeoMove
  | dial.DialMove
  | sizes.SizeMove
  | coins.CoinsMove
  | year.YearMove
  | order.OrderMove
  | impostor.ImpostorMove;
export type StandaloneEntry = {
  id: StandaloneId;
  name: string;
  seatChoices: number[];
  defaultSeats: number;
  create: (
    n: number,
    seed: number,
    d: Difficulty,
    mode?: PartyMode,
    seen?: ReadonlySet<string>,
    teams?: number[],
    /** The table votes between rounds; otherwise the host picks. */
    votes?: boolean,
  ) => AnyGame;
  play: typeof play;
  botMove: typeof botMove;
  actingSeats: typeof actingSeats;
  legalMoves: typeof legalMoves;
  validMove: typeof validMove;
  outcome: typeof outcome;
  progress: (g: AnyGame) => { label: string; detail: string };
  isSavedGame: (g: unknown) => g is AnyGame;
};
/** Each party game's rules module, by its storage id. */
type Engine = {
  observe: (g: never, viewer: number) => AnyGame;
  actingSeats: (g: never) => number[];
  validMove: (g: never, m: unknown, s: number) => boolean;
  play: (g: never, m: never, s: number, now?: number) => AnyGame;
  botMove: (g: never, s: number) => AnyMove | null;
  tick: (g: never, now?: number) => AnyGame;
};
const engines = {
  orin: ranking,
  dial,
  coins,
  miro: geography,
  size: sizes,
  year,
  order,
  impostor,
} as unknown as Record<StandaloneId, Engine>;
const engine = (g: AnyGame) => engines[g.kind];
export function observe(g: AnyGame, viewer: number): AnyGame {
  return engine(g).observe(g as never, viewer);
}
export function actingSeats(g: AnyGame) {
  return engine(g).actingSeats(g as never);
}
export function validMove(g: AnyGame, m: unknown, s: number) {
  return engine(g).validMove(g as never, m, s);
}
/** `now` only matters for server-owned deadlines; tests pin it. */
export function play(
  g: AnyGame,
  m: AnyMove,
  s: number,
  now = Date.now(),
): AnyGame {
  return settle(engine(g).play(g as never, m as never, s, now)) as AnyGame;
}
export function botMove(g: AnyGame, s: number): AnyMove | null {
  const v = observe(g, s);
  return engine(v).botMove(v as never, s);
}
/** What the current decision is, so bots and reconnects key on it. */
export function decisionKey(g: AnyGame) {
  const at =
    g.kind === 'miro'
      ? `${g.challenge}:${g.turn}`
      : 'step' in g
        ? g.step
        : g.target;
  return `${g.kind}:${g.rules}:${g.round}:${g.phase}:${at}`;
}
/** When the table's next server-owned deadline falls, or null: Atlas team
 * discussions and every timed end-of-round vote. Private guesses remain untimed. */
export function deadline(g: AnyGame): number | null {
  if (g.over || g.tutorial) return null;
  if (g.kind === 'impostor') return impostor.deadline(g);
  if (g.phase === 'vote') return g.vote?.endsAt ?? null;
  return g.kind === 'miro' && g.phase === 'discuss' ? g.discussionEndsAt : null;
}
export function tick(g: AnyGame): AnyGame {
  return settle(engine(g).tick(g as never)) as AnyGame;
}
function legalMoves(g: AnyGame, s: number): AnyMove[] {
  const moves: AnyMove[] = [
    { type: 'lock' },
    { type: 'unlock' },
    { type: 'next' },
  ];
  if (g.kind === 'orin')
    moves.push(
      ...(g.offers[s] ?? []).map((target) => ({
        type: 'topic' as const,
        target,
      })),
    );
  const bot = botMove(g, s);
  if (bot) moves.push(bot);
  return moves.filter((m) => validMove(g, m, s));
}
function outcome(g: AnyGame): Outcome {
  // Impostor keeps its points on the seats, like a set's running totals.
  if (g.tribu || g.kind === 'impostor') {
    const totals = g.kind === 'impostor' ? g.scores : seatTotals(g),
      top = Math.max(...totals),
      winners = g.seats.flatMap((_, s) =>
        Math.abs(totals[s] - top) < 1e-9 ? [s] : [],
      );
    return {
      title: `${winners.map((s) => g.seats[s]).join(' & ')} ${winners.length > 1 || g.seats[winners[0]] === 'You' ? (winners.length > 1 ? 'tie' : 'win') : 'wins'}`,
      detail: `${g.round} round${g.round === 1 ? '' : 's'}`,
      winners,
      rows: g.seats
        .map((name, s) => ({
          name,
          value: `${Number(totals[s].toFixed(2))}`,
          seat: s,
          points: Number(totals[s].toFixed(2)),
        }))
        .sort((a, b) => totals[b.seat] - totals[a.seat]),
    };
  }
  // A game played outside a set: only old saves and tests.
  const team = g.kind === 'miro' && g.mode === 'teams',
    high = Math.max(...g.scores),
    bestDistance =
      g.kind === 'miro'
        ? Math.min(
            ...g.totalDistance
              .filter((_, t) => Math.abs(g.scores[t] - high) < 1e-9)
              .map((d) => Math.round(d * 1000)),
          )
        : 0,
    wins = (t: number) =>
      Math.abs(g.scores[t] - high) < 1e-9 &&
      (g.kind !== 'miro' ||
        Math.round(g.totalDistance[t] * 1000) === bestDistance),
    winners = g.seats.flatMap((_, s) =>
      wins(team ? g.teams[s] : s) ? [s] : [],
    );
  const names = g.scores.flatMap((_, i) => (wins(i) ? [groupName(g, i)] : []));
  return {
    title: `${names.join(' & ')} ${names.length > 1 ? 'tie' : 'wins'}`,
    detail: `${g.round} round${g.round === 1 ? '' : 's'}`,
    winners,
    rows: g.scores.map((score, i) => ({
      name: groupName(g, i),
      value: `${Number(score.toFixed(2))} points${g.kind === 'miro' ? ` · ${Math.round(g.totalDistance[i]).toLocaleString()} km total` : ''}`,
      points: Number(score.toFixed(2)),
    })),
  };
}
/** Each game's rules marker; older markers are retired rules. */
const rulesMarker: Record<StandaloneId, number> = {
  orin: 7,
  dial: 3,
  coins: 1,
  miro: 10,
  size: 2,
  year: 1,
  order: 1,
  impostor: 1,
};
function saved(id: StandaloneId, value: unknown): value is AnyGame {
  try {
    if (!value || typeof value !== 'object') return false;
    const g = value as AnyGame;
    if (
      // A set match may be playing any of its games under any of their ids.
      (g.kind !== id &&
        !(
          g.tribu !== undefined &&
          id !== 'impostor' &&
          setOf(g.kind) === setOf(id)
        )) ||
      !(g.kind in rulesMarker) ||
      g.version !== 1 ||
      g.rules !== rulesMarker[g.kind] ||
      !Array.isArray(g.seats) ||
      !g.seats.every((s) => typeof s === 'string') ||
      !Number.isInteger(g.revision) ||
      g.revision < 0 ||
      !Number.isInteger(g.rngState) ||
      g.rngState < 0 ||
      g.rngState > 4294967295 ||
      !Number.isInteger(g.round) ||
      g.round < 1 ||
      g.round > maxRounds ||
      typeof g.over !== 'boolean' ||
      typeof g.tutorial !== 'boolean' ||
      !Number.isInteger(g.lesson) ||
      g.lesson < 0 ||
      g.lesson > 3 ||
      !['easy', 'medium', 'hard'].includes(g.difficulty) ||
      !Array.isArray(g.log) ||
      !g.log.every((l) => l && typeof l.text === 'string')
    )
      return false;
    if (g.tribu !== undefined) {
      const t = g.tribu;
      if (
        !t ||
        !Array.isArray(t.carry) ||
        t.carry.length !== g.seats.length ||
        !t.carry.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e6) ||
        !['individual', 'teams'].includes(t.mode) ||
        !Array.isArray(t.teams) ||
        (t.votes !== undefined && t.votes !== true) ||
        groups(
          g.seats.length,
          t.mode,
          t.mode === 'teams' ? t.teams : undefined,
        ).join() !== t.teams.join() ||
        (g.handoff !== undefined && g.handoff !== null)
      )
        return false;
    }
    if (g.kind === 'miro') {
      const size = g.mode === 'teams' ? 2 : g.seats.length,
        expected = groups(g.seats.length, g.mode);
      return (
        Array.isArray(g.ready) &&
        g.ready.length === g.seats.length &&
        g.ready.every((v) => typeof v === 'boolean') &&
        Array.isArray(g.teams) &&
        g.teams.length === g.seats.length &&
        (g.mode === 'teams'
          ? validTeams(g.teams, g.seats.length)
          : g.teams.every((t, s) => t === expected[s])) &&
        Array.isArray(g.scores) &&
        g.scores.length === size &&
        g.scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e5) &&
        !!geography.validState(g)
      );
    }
    if (
      !Array.isArray(g.scores) ||
      g.scores.length !== g.seats.length ||
      !g.scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e5)
    )
      return false;
    return (
      engines[g.kind] as unknown as { validState: (g: AnyGame) => boolean }
    ).validState(g);
  } catch {
    return false;
  }
}
/** Every party game's storage id. The games inside a set keep their ids for
 * saved states; the library offers only the sets. */
export const standaloneIds = [
  'orin',
  'miro',
  'dial',
  'size',
  'coins',
  'year',
  'order',
  'impostor',
] as StandaloneId[];
function progressDetail(g: AnyGame) {
  if (g.phase === 'vote')
    return g.vote?.opening ? 'Choose the first game' : 'What next?';
  if (g.phase === 'reveal') return 'The reveal';
  switch (g.kind) {
    case 'miro':
      return g.phase === 'guess'
        ? 'Prepare all three private pins'
        : `${groupName(g, geography.activeTeam(g))}: choose all three team pins`;
    case 'size':
      return 'Size things up';
    case 'year':
      return 'Place the years';
    case 'order':
      return 'Put things in order';
    case 'impostor':
      return g.phase === 'draw'
        ? 'Draw your word'
        : g.phase === 'clue'
          ? 'Write one word'
          : 'Find the impostor';
    case 'dial':
      return g.phase === 'clue' ? 'Write your clue' : 'Read every clue';
    case 'coins':
      return g.phase === 'answer' ? 'Split your coins' : 'Guess every split';
    default:
      return g.phase === 'rank' ? 'Prepare privately' : 'Guess every list';
  }
}
export const standaloneGames = Object.fromEntries(
  standaloneIds.map((id) => [
    id,
    {
      id,
      // The games inside a set are played under the set's name.
      name: id === 'impostor' ? 'Impostor' : setNames[setOf(id)],
      seatChoices: id === 'impostor' ? impostor.seatChoices : partySeats,
      defaultSeats: id === 'impostor' ? 5 : 4,
      // Know Me and Quiz are always everyone for themselves; team play was retired.
      create: (
        n: number,
        seed: number,
        d: Difficulty,
        _mode?: PartyMode,
        seen?: ReadonlySet<string>,
        _teams?: number[],
        votes = false,
      ) =>
        id === 'impostor'
          ? impostor.createGame(n, seed, d, seen, Date.now(), votes)
          : setOf(id) === 'miro'
          ? createSabi(
              n,
              seed,
              d,
              'individual',
              seen,
              undefined,
              Date.now(),
              votes,
            )
          : createTribu(
              n,
              seed,
              d,
              'individual',
              seen,
              undefined,
              Date.now(),
              votes,
            ),
      play,
      botMove,
      actingSeats,
      legalMoves,
      validMove,
      outcome,
      progress: (g: AnyGame) => ({
        label: `Round ${g.round}`,
        detail: progressDetail(g),
      }),
      isSavedGame: (g: unknown): g is AnyGame => saved(id, g),
    },
  ]),
) as Record<StandaloneId, StandaloneEntry>;
/** The party games the library and the online catalog offer: the two sets
 * and Impostor. */
export const publicStandaloneIds = ['orin', 'miro', 'impostor'] as StandaloneId[];
export const isStandaloneId = (id: string): id is StandaloneId =>
  standaloneIds.includes(id as StandaloneId);
