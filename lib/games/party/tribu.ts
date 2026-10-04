import * as ranking from './ranking.ts';
import * as dial from './dial.ts';
import * as coins from './coins.ts';
import * as geography from './geography.ts';
import * as size from './size.ts';
import * as year from './year.ts';
import * as order from './order.ts';
import { openVote, sets, type SetGame, type SetId } from './vote.ts';
import type { PartyMode } from './groups.ts';
import type { TribuState } from './tribu-state.ts';
import type { Difficulty } from '../standalone/types.ts';

/** A set is one party game made of several: a match opens with a pick
 * between them, and every round ends with a pick to play the same game again,
 * switch to another, or finish. Know Me (`orin`) holds Top Five, Dial and
 * Ten Coins, about how well a table knows each other; Quiz
 * (`miro`) holds Atlas, Sizes, Years and Order, about the world. The saved
 * state is always one of the set's games; a switch replaces it with a fresh
 * game of the chosen kind that keeps the seats, the log, the round count and
 * everyone's points so far. */
export type TribuPart =
  | ranking.RankingGame
  | dial.DialGame
  | coins.CoinsGame;
export type SabiPart =
  | geography.GeoGame
  | size.SizeGame
  | year.YearGame
  | order.OrderGame;
export type SetPart = TribuPart | SabiPart;
export const partNames: Record<SetGame, string> = {
  orin: 'Top Five',
  dial: 'Dial',
  coins: 'Ten Coins',
  miro: 'Atlas',
  size: 'Sizes',
  year: 'Years',
  order: 'Order',
};
export const setNames: Record<SetId, string> = {
  orin: 'Know Me',
  miro: 'Quiz',
};

function opening<T extends SetPart>(
  g: T,
  set: SetId,
  now: number,
  votes: boolean,
): T {
  const n = g.seats.length;
  g.tribu = {
    carry: Array(n).fill(0),
    mode: g.mode,
    teams: [...g.teams],
    ...(votes ? { votes: true as const } : {}),
  };
  // The first game's deal waits behind the opening pick.
  g.phase = 'vote';
  g.vote = openVote(n, now, true, [...sets[set]], true, !votes);
  return g;
}
export function createTribu(
  n: number,
  seed: number,
  difficulty: Difficulty,
  _mode: PartyMode = 'individual',
  _seen?: ReadonlySet<string>,
  _teams?: number[],
  now = Date.now(),
  votes = false,
): ranking.RankingGame {
  return opening(
    ranking.createGame('orin', n, seed, difficulty),
    'orin',
    now,
    votes,
  );
}
export function createSabi(
  n: number,
  seed: number,
  difficulty: Difficulty,
  mode: PartyMode = 'individual',
  seen?: ReadonlySet<string>,
  teams?: number[],
  now = Date.now(),
  votes = false,
): geography.GeoGame {
  return opening(
    geography.createGame(n, seed, difficulty, mode, seen, teams),
    'miro',
    now,
    votes,
  );
}

/** Points each seat has earned this match, including the game in progress.
 * Old Atlas team games credit a team's points to each of its players. */
export function seatTotals(g: SetPart): number[] {
  const carry = g.tribu?.carry ?? g.seats.map(() => 0),
    team = g.kind === 'miro' && g.mode === 'teams';
  return g.seats.map(
    (_, s) => carry[s] + (team ? g.scores[g.teams[s]] : g.scores[s]),
  );
}

const makers: Record<
  SetGame,
  (n: number, seed: number, d: Difficulty, t: TribuState) => SetPart
> = {
  orin: (n, seed, d) => ranking.createGame('orin', n, seed, d),
  dial: (n, seed, d) => dial.createGame(n, seed, d),
  coins: (n, seed, d) => coins.createGame(n, seed, d),
  miro: (n, seed, d, t) =>
    geography.createGame(n, seed, d, t.mode, undefined, t.teams),
  size: (n, seed, d) => size.createGame(n, seed, d),
  year: (n, seed, d) => year.createGame(n, seed, d),
  order: (n, seed, d) => order.createGame(n, seed, d),
};
/** Applies a switch the table chose; any other state passes through. */
export function settle<T>(g: T): T | SetPart {
  const part = g as SetPart;
  if (!part.tribu || !part.handoff) return g;
  const t = part.tribu,
    carry = seatTotals(part);
  const next = makers[part.handoff](
    part.seats.length,
    part.rngState,
    part.difficulty,
    t,
  );
  next.seats = [...part.seats];
  next.revision = part.revision;
  next.tribu = { ...t, carry };
  next.log = [
    ...part.log,
    {
      id: part.log.length,
      text: `Round ${part.round}: the table plays ${partNames[next.kind]}.`,
    },
  ];
  return startAt(next, part.round);
}
/** A fresh game joins the match at its current round. Sizes deals by round,
 * and Atlas remembers where its places started, so both redeal for the
 * round they join. */
function startAt(g: SetPart, round: number): SetPart {
  if (g.kind === 'size') return size.startAt(g, round);
  if (g.kind === 'miro') return geography.startAt(g, round);
  g.round = round;
  return g;
}
