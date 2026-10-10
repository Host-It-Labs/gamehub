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
import {
  campReady,
  collectionScore,
  currentDraft,
  extendTrivia,
  finalTriviaCamp,
  isTriviaCamp,
  isTriviaExtension,
  triviaCampSeats,
  type TriviaLength,
  observeTrivia,
  playTriviaMove,
  prepareTriviaPick,
  settleTrivia,
  triviaModeOf,
  triviaOf,
  triviaStandings,
  triviaWinners,
  validTriviaMove,
  validTriviaState,
  type TriviaMode,
  type TriviaMove,
} from '../party/trivia.ts';
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
  | impostor.ImpostorMove
  | TriviaMove;
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
    /** Trivia's overarching match; absent on earlier saves and callers. */
    triviaMode?: TriviaMode,
    /** Tower and Expedition: 4 or 8 rounds. */
    triviaRounds?: TriviaLength,
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
  return observeTrivia(engine(g).observe(g as never, viewer), viewer);
}
export function actingSeats(g: AnyGame) {
  if (isTriviaCamp(g)) return triviaCampSeats(g);
  return engine(g).actingSeats(g as never);
}
export function validMove(g: AnyGame, m: unknown, s: number) {
  const type =
    m && typeof m === 'object' ? (m as { type?: unknown }).type : undefined;
  if (
    type === 'trivia-plan' ||
    type === 'trivia-unlock' ||
    type === 'trivia-pick' ||
    type === 'trivia-pick-for'
  )
    return validTriviaMove(g, m, s);
  if (isTriviaCamp(g) && (type !== 'vote' || !campReady(g))) return false;
  return engine(g).validMove(g as never, m, s);
}
/** `now` only matters for server-owned deadlines; tests pin it. */
export function play(
  g: AnyGame,
  m: AnyMove,
  s: number,
  now = Date.now(),
): AnyGame {
  if (!validMove(g, m, s)) return g;
  if (
    m.type === 'trivia-plan' ||
    m.type === 'trivia-unlock' ||
    m.type === 'trivia-pick' ||
    m.type === 'trivia-pick-for'
  )
    return playTriviaMove(g, m, s);
  // The host's 4 more carries the same towers or finds on.
  if (isTriviaExtension(g, m)) return extendTrivia(g);
  const ready = isTriviaCamp(g) ? prepareTriviaPick(g) : g;
  return settleTrivia(
    settle(engine(ready).play(ready as never, m as never, s, now)),
  ) as AnyGame;
}
export function botMove(g: AnyGame, s: number): AnyMove | null {
  if (isTriviaCamp(g) || (g.phase === 'vote' && g.vote?.host)) return null;
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
  const trivia = triviaOf(g);
  return `${g.kind}:${g.rules}:${g.round}:${g.phase}:${at}${trivia ? `:trivia:${trivia.mode}:${trivia.stage}:${trivia.completed}${trivia.rules === 3 ? `:${trivia.length}:${currentDraft(g)?.picks.length ?? '-'}` : ''}` : ''}`;
}
/** When the table's next server-owned deadline falls, or null: Atlas team
 * discussions and every timed end-of-round vote. Private guesses remain untimed. */
export function deadline(g: AnyGame): number | null {
  if (g.over || g.tutorial) return null;
  if (isTriviaCamp(g)) return null;
  if (g.kind === 'impostor') return impostor.deadline(g);
  if (g.phase === 'vote') return g.vote?.endsAt ?? null;
  return g.kind === 'miro' && g.phase === 'discuss' ? g.discussionEndsAt : null;
}
export function tick(g: AnyGame): AnyGame {
  if (isTriviaCamp(g) || (triviaModeOf(g) !== 'quick' && g.phase === 'vote'))
    return g;
  return settleTrivia(settle(engine(g).tick(g as never))) as AnyGame;
}
function legalMoves(g: AnyGame, s: number): AnyMove[] {
  const moves: AnyMove[] = [
    { type: 'lock' },
    { type: 'unlock' },
    { type: 'next' },
  ];
  const draft = currentDraft(g);
  if (draft)
    draft.offer.forEach((_, find) => moves.push({ type: 'trivia-pick', find }));
  else if (isTriviaCamp(g)) {
    moves.push({ type: 'trivia-unlock' });
    const routes = finalTriviaCamp(g)
      ? [null]
      : (['trail', 'river', 'summit'] as const);
    for (const route of routes)
      for (const purchase of [null, 'trophy', 'supplies'] as const)
        moves.push({ type: 'trivia-plan', route, purchase });
  }
  if (g.phase === 'vote')
    for (const choice of g.vote?.options ?? ['more', 'finish'])
      moves.push({ type: 'vote', choice });
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
  const trivia = triviaOf(g);
  if (trivia && trivia.mode !== 'quick') {
    const part = g as geography.GeoGame,
      winners = triviaWinners(part),
      standings = triviaStandings(part);
    return {
      title: `${winners.map((s) => g.seats[s]).join(' & ')} ${winners.length > 1 ? 'tie' : g.seats[winners[0]] === 'You' ? 'win' : 'wins'}`,
      detail: `${trivia.completed} round${trivia.completed === 1 ? '' : 's'}`,
      winners,
      rows: standings.map((p) => ({
        name: g.seats[p.seat],
        value:
          trivia.mode === 'tower'
            ? `${p.floors} floors · ${p.victories} victories · ${p.rawPoints} points`
            : trivia.rules === 3
              ? `${collectionScore(p.finds)} from ${p.finds?.length ?? 0} finds · ${p.rawPoints} points`
              : trivia.rules === 2
              ? `${p.distance} steps · ${p.trophies} checkpoints · ${p.rawPoints} points`
              : `${p.trophies} trophies · ${p.distance} steps · ${p.coins} coins · ${p.rawPoints} points`,
        seat: p.seat,
        points: p.score,
      })),
    };
  }
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
      if (!validTriviaState(g)) return false;
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
  if (isTriviaCamp(g))
    return triviaOf(g)?.rules === 3
      ? 'Pick a find'
      : finalTriviaCamp(g)
        ? 'The final camp'
        : 'Choose a route at camp';
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
        triviaMode: TriviaMode = 'quick',
        triviaRounds: TriviaLength = 4,
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
                triviaMode,
                triviaRounds,
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
export const publicStandaloneIds = [
  'orin',
  'miro',
  'impostor',
] as StandaloneId[];
export const isStandaloneId = (id: string): id is StandaloneId =>
  standaloneIds.includes(id as StandaloneId);
