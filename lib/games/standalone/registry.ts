import type { Difficulty, Outcome, StandaloneId } from './types.ts';
import * as ranking from '../party/ranking.ts';
import * as geography from '../party/geography.ts';
import * as dial from '../party/dial.ts';
import * as sizes from '../party/size.ts';
import { maxRounds, setOf, validVote } from '../party/vote.ts';
import { topics } from '../party/catalog.ts';
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
  | sizes.SizeGame;
export type AnyMove =
  | ranking.RankingMove
  | geography.GeoMove
  | dial.DialMove
  | sizes.SizeMove;
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
    : g.kind === 'dial'
      ? dial.observe(g, viewer)
      : g.kind === 'size'
        ? sizes.observe(g, viewer)
        : ranking.observe(g, viewer);
}
export function actingSeats(g: AnyGame) {
  return g.kind === 'miro'
    ? geography.actingSeats(g)
    : g.kind === 'dial'
      ? dial.actingSeats(g)
      : g.kind === 'size'
        ? sizes.actingSeats(g)
        : ranking.actingSeats(g);
}
export function validMove(g: AnyGame, m: unknown, s: number) {
  return g.kind === 'miro'
    ? geography.validMove(g, m, s)
    : g.kind === 'dial'
      ? dial.validMove(g, m, s)
      : g.kind === 'size'
        ? sizes.validMove(g, m, s)
        : ranking.validMove(g, m, s);
}
/** `now` only matters for server-owned deadlines; tests pin it. */
export function play(
  g: AnyGame,
  m: AnyMove,
  s: number,
  now = Date.now(),
): AnyGame {
  return settle(
    g.kind === 'miro'
      ? geography.play(g, m as geography.GeoMove, s, now)
      : g.kind === 'dial'
        ? dial.play(g, m as dial.DialMove, s, now)
        : g.kind === 'size'
          ? sizes.play(g, m as sizes.SizeMove, s, now)
          : ranking.play(g, m as ranking.RankingMove, s, now),
  );
}
export function botMove(g: AnyGame, s: number): AnyMove | null {
  const v = observe(g, s);
  return v.kind === 'miro'
    ? geography.botMove(v, s)
    : v.kind === 'dial'
      ? dial.botMove(v, s)
      : v.kind === 'size'
        ? sizes.botMove(v, s)
        : ranking.botMove(v, s);
}
export function decisionKey(g: AnyGame) {
  return `${g.kind}:${g.rules}:${g.round}:${g.phase}:${g.kind === 'miro' ? `${g.challenge}:${g.turn}` : g.kind === 'size' ? g.step : g.target}`;
}
/** When the table's next server-owned deadline falls, or null: Atlas team
 * discussions and every end-of-round vote. Private guesses remain untimed. */
export function deadline(g: AnyGame): number | null {
  if (g.over || g.tutorial) return null;
  if (g.phase === 'vote') return g.vote?.endsAt ?? null;
  return g.kind === 'miro' && g.phase === 'discuss' ? g.discussionEndsAt : null;
}
export function tick(g: AnyGame): AnyGame {
  return settle(
    g.kind === 'miro'
      ? geography.tick(g)
      : g.kind === 'dial'
        ? dial.tick(g)
        : g.kind === 'size'
          ? sizes.tick(g)
          : ranking.tick(g),
  );
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
  if (g.tribu) {
    const totals = seatTotals(g),
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
    winners = g.seats.flatMap((_, s) =>
      wins(g.kind === 'dial' || g.kind === 'size' ? s : g.teams[s]) ? [s] : [],
    );
  const names = g.scores.flatMap((_, i) => (wins(i) ? [groupName(g, i)] : []));
  return {
    title: `${names.join(' & ')} ${names.length > 1 ? 'tie' : 'wins'}`,
    detail:
      g.kind === 'miro'
        ? `${g.round} round${g.round === 1 ? '' : 's'}, ${g.round * 3} destinations. Points first; shortest total distance breaks a tie.`
        : g.kind === 'dial'
          ? `${g.round} round${g.round === 1 ? '' : 's'} of reading each other’s clues.`
          : `${g.round} round${g.round === 1 ? '' : 's'} of reading each other.`,
    winners,
    rows: g.scores.map((score, i) => ({
      name: groupName(g, i),
      value: `${Number(score.toFixed(2))} points${g.kind === 'miro' ? ` · ${Math.round(g.totalDistance[i]).toLocaleString()} km total` : ''}`,
      points: Number(score.toFixed(2)),
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
      // A set match may be playing either of its games under either id.
      (g.kind !== id &&
        !(g.tribu !== undefined && setOf(g.kind) === setOf(id))) ||
      g.version !== 1 ||
      g.rules !==
        (g.kind === 'miro'
          ? 10
          : g.kind === 'size'
            ? 2
            : g.kind === 'dial'
              ? 1
              : 6) ||
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
        groups(
          g.seats.length,
          t.mode,
          t.mode === 'teams' ? t.teams : undefined,
        ).join() !== t.teams.join() ||
        (g.handoff !== undefined && g.handoff !== null)
      )
        return false;
    }
    if (g.kind === 'dial' || g.kind === 'size')
      return (
        g.scores.length === g.seats.length &&
        g.scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e5) &&
        (g.kind === 'dial' ? dial.validState(g) : sizes.validState(g))
      );
    if (
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
        g.scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e5)
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
      ['rank', 'guess', 'reveal', 'vote'].includes(g.phase) &&
      (g.phase === 'vote'
        ? validVote(g.vote, n)
        : g.vote === undefined || g.vote === null) &&
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
      (g.phase === 'rank' ||
        !!g.vote?.opening ||
        g.ballots.every((b) => b?.locked)) &&
      g.guesses.length === ranking.guessCount(g) &&
      g.guesses.every(guess) &&
      (g.phase !== 'reveal' ||
        ranking.guessingTeams(g).every((t) => g.guesses[t]?.locked)) &&
      (g.phase === 'reveal' || (g.phase === 'vote' && !g.vote?.opening)
        ? !!g.result &&
          ranking.permutation(g.result.order, c) &&
          g.result.gains.length === size &&
          g.result.gains.every(
            (v) => Number.isFinite(v) && v >= 0 && v <= ranking.perfectPoints,
          ) &&
          g.result.guesses.length === ranking.guessCount(g) &&
          g.result.guesses.every(guess)
        : g.result === null)
    );
  } catch {
    return false;
  }
}
export const standaloneGames = Object.fromEntries(
  (['orin', 'miro', 'dial', 'size'] as const).map((id) => [
    id,
    {
      id,
      // Dial is played inside Tribu and Sizes inside Sabi; their ids stay
      // for saved states.
      name: setNames[setOf(id)],
      seatChoices: partySeats,
      defaultSeats: 4,
      // Tribu and Sabi are always everyone for themselves; team play was retired.
      create: (
        n: number,
        seed: number,
        d: Difficulty,
        _mode?: PartyMode,
        seen?: ReadonlySet<string>,
      ) =>
        setOf(id) === 'miro'
          ? createSabi(n, seed, d, 'individual', seen)
          : createTribu(n, seed, d, 'individual', seen),
      play,
      botMove,
      actingSeats,
      legalMoves,
      validMove,
      outcome,
      progress: (g: AnyGame) => ({
        label: `Round ${g.round}`,
        detail:
          g.phase === 'vote'
            ? g.vote?.opening
              ? 'Choose the first game'
              : 'Another round?'
            : g.kind === 'miro'
              ? g.phase === 'guess'
                ? 'Prepare all three private pins'
                : g.phase === 'reveal'
                  ? 'Destination revealed'
                  : `${groupName(g, geography.activeTeam(g))}: choose all three team pins`
              : g.kind === 'size'
                ? g.phase === 'guess'
                  ? 'Size things up'
                  : 'The reveal'
                : g.kind === 'dial'
                  ? g.phase === 'clue'
                    ? `${g.seats[g.target]} gives a clue`
                    : g.phase === 'guess'
                      ? `Read ${g.seats[g.target]}'s clue`
                      : 'The reveal'
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
export const standaloneIds = ['orin', 'miro', 'dial', 'size'] as StandaloneId[];
/** The party games the library and the online catalog offer. Dial is played
 * inside Tribu (`orin`) and Sizes inside Sabi (`miro`); their ids stay for
 * saved states and old tables. */
export const publicStandaloneIds = ['orin', 'miro'] as StandaloneId[];
export const isStandaloneId = (id: string): id is StandaloneId =>
  standaloneIds.includes(id as StandaloneId);
