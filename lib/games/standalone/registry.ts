import type { Difficulty, Outcome, StandaloneId } from './types.ts';
import * as ranking from '../party/ranking.ts';
import * as geography from '../party/geography.ts';
import { topics } from '../party/catalog.ts';
import {
  groups,
  validTeams,
  groupName,
  partySeats,
  type PartyMode,
} from '../party/groups.ts';
export type AnyGame = ranking.RankingGame | geography.GeoGame;
export type AnyMove = ranking.RankingMove | geography.GeoMove;
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
export function observe(g: AnyGame, viewer: number): AnyGame {
  return g.kind === 'miro'
    ? geography.observe(g, viewer)
    : ranking.observe(g, viewer);
}
export function actingSeats(g: AnyGame) {
  return g.kind === 'miro' ? geography.actingSeats(g) : ranking.actingSeats(g);
}
export function validMove(g: AnyGame, m: unknown, s: number) {
  return g.kind === 'miro'
    ? geography.validMove(g, m, s)
    : ranking.validMove(g, m, s);
}
export function play(g: AnyGame, m: AnyMove, s: number): AnyGame {
  return g.kind === 'miro'
    ? geography.play(g, m as geography.GeoMove, s)
    : ranking.play(g, m as ranking.RankingMove, s);
}
export function botMove(g: AnyGame, s: number): AnyMove | null {
  const v = observe(g, s);
  return v.kind === 'miro' ? geography.botMove(v, s) : ranking.botMove(v, s);
}
export function decisionKey(g: AnyGame) {
  return `${g.kind}:${g.rules}:${g.round}:${g.phase}:${g.kind === 'miro' ? `${g.challenge}:${g.turn}` : g.target}`;
}
/** Atlas team discussions have a server-owned deadline; private guesses remain untimed. */
export function tick(g: AnyGame): AnyGame {
  return g.kind === 'miro' ? geography.tick(g) : g;
}
function legalMoves(g: AnyGame, s: number): AnyMove[] {
  const moves: AnyMove[] = [
    { type: 'lock' },
    { type: 'unlock' },
    { type: 'ready' },
  ];
  if (g.kind !== 'miro')
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
  const high = Math.max(...g.scores),
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
    winners = g.seats.flatMap((_, s) => (wins(g.teams[s]) ? [s] : []));
  const names = g.scores.flatMap((_, i) => (wins(i) ? [groupName(g, i)] : []));
  return {
    title: `${names.join(' & ')} ${names.length > 1 ? 'tie' : 'wins'}`,
    detail:
      g.kind === 'miro'
        ? 'Two rounds, six destinations. Points first; shortest total distance breaks a tie.'
        : 'Two rounds of reading each other.',
    winners,
    rows: g.scores.map((score, i) => ({
      name: groupName(g, i),
      value: `${Number(score.toFixed(2))} points${g.kind === 'miro' ? ` · ${Math.round(g.totalDistance[i]).toLocaleString()} km total` : ''}`,
    })),
  };
}
function saved(id: StandaloneId, value: unknown): value is AnyGame {
  try {
    if (!value || typeof value !== 'object') return false;
    const g = value as AnyGame;
    const ints = (
      a: unknown,
      len: number,
      low: number,
      high: number,
    ): a is number[] =>
      Array.isArray(a) &&
      a.length === len &&
      a.every((x) => Number.isInteger(x) && x >= low && x <= high);
    if (
      g.kind !== id ||
      g.version !== 1 ||
      g.rules !== (id === 'miro' ? 9 : 6) ||
      !Array.isArray(g.seats) ||
      !g.seats.every((s) => typeof s === 'string') ||
      !Number.isInteger(g.revision) ||
      g.revision < 0 ||
      !Number.isInteger(g.rngState) ||
      g.rngState < 0 ||
      g.rngState > 4294967295 ||
      !Number.isInteger(g.round) ||
      g.round < 1 ||
      g.round > 2 ||
      typeof g.over !== 'boolean' ||
      typeof g.tutorial !== 'boolean' ||
      !Number.isInteger(g.lesson) ||
      g.lesson < 0 ||
      g.lesson > 3 ||
      !['easy', 'medium', 'hard'].includes(g.difficulty) ||
      !Array.isArray(g.log) ||
      !g.log.every((l) => l && typeof l.text === 'string') ||
      !Array.isArray(g.ready) ||
      g.ready.length !== g.seats.length ||
      !g.ready.every((v) => typeof v === 'boolean')
    )
      return false;
    const expected = groups(g.seats.length, g.mode),
      size = g.mode === 'teams' ? 2 : g.seats.length;
    if (
      !ints(g.teams, g.seats.length, 0, size - 1) ||
      !(g.mode === 'teams'
        ? validTeams(g.teams, g.seats.length)
        : g.teams.every((t, s) => t === expected[s])) ||
      !(
        Array.isArray(g.scores) &&
        g.scores.length === size &&
        g.scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1000)
      )
    )
      return false;
    if (g.kind === 'miro') return !!geography.validState(g);
    const n = g.seats.length,
      c = ranking.count(g),
      catalog = topics,
      offers = 3;
    const guess = (b: unknown) => {
      if (b === null) return true;
      if (!b || typeof b !== 'object') return false;
      const v = b as { order: unknown; locked: unknown };
      return typeof v.locked === 'boolean' && ranking.permutation(v.order, c);
    };
    return (
      ['rank', 'guess', 'reveal'].includes(g.phase) &&
      Number.isInteger(g.target) &&
      g.target >= 0 &&
      g.target < n &&
      Array.isArray(g.deck) &&
      g.deck.every((i) => Number.isInteger(i) && !!catalog[i]) &&
      g.offers.length === n &&
      g.offers.every(
        (o) =>
          ints(o, offers, 0, catalog.length - 1) && new Set(o).size === offers,
      ) &&
      g.ballots.length === n &&
      g.ballots.every(
        (b, s) =>
          b === null ||
          (g.offers[s].includes(b.topic) &&
            ranking.permutation(b.order, c) &&
            typeof b.locked === 'boolean'),
      ) &&
      (g.phase === 'rank' || g.ballots.every((b) => b?.locked)) &&
      g.guesses.length === ranking.guessCount(g) &&
      g.guesses.every(guess) &&
      (g.phase !== 'reveal' ||
        ranking.guessingTeams(g).every((t) => g.guesses[t]?.locked)) &&
      (g.phase === 'reveal'
        ? !!g.result &&
          ranking.permutation(g.result.order, c) &&
          g.result.gains.length === size &&
          g.result.gains.every((v) => Number.isFinite(v) && v >= 0 && v <= 8) &&
          g.result.guesses.length === ranking.guessCount(g) &&
          g.result.guesses.every(guess)
        : g.result === null)
    );
  } catch {
    return false;
  }
}
export const standaloneGames = Object.fromEntries(
  (['orin', 'miro'] as const).map((id) => [
    id,
    {
      id,
      name: id === 'orin' ? 'My Top Five' : 'Atlas',
      seatChoices: partySeats,
      defaultSeats: 4,
      create: (
        n: number,
        seed: number,
        d: Difficulty,
        mode: PartyMode = 'individual',
        seen?: ReadonlySet<string>,
        teams?: number[],
      ) =>
        id === 'miro'
          ? geography.createGame(n, seed, d, mode, seen, teams)
          : ranking.createGame(id, n, seed, d, mode, seen, teams),
      play,
      botMove,
      actingSeats,
      legalMoves,
      validMove,
      outcome,
      progress: (g: AnyGame) => ({
        label: `Round ${g.round} / 2`,
        detail:
          g.kind === 'miro'
            ? g.phase === 'guess'
              ? 'Prepare all three private pins'
              : g.phase === 'reveal'
                ? 'Destination revealed'
                : `${groupName(g, geography.activeTeam(g))}: choose all three team pins`
            : g.phase === 'rank'
              ? 'Prepare privately'
              : g.phase === 'guess'
                ? `Guess ${g.seats[g.target]}'s list`
                : 'The reveal',
      }),
      isSavedGame: (g: unknown): g is AnyGame => saved(id, g),
    },
  ]),
) as Record<StandaloneId, StandaloneEntry>;
export const standaloneIds = ['orin', 'miro'] as StandaloneId[];
export const isStandaloneId = (id: string): id is StandaloneId =>
  standaloneIds.includes(id as StandaloneId);
