import * as ranking from './ranking.ts';
import * as dial from './dial.ts';
import * as geography from './geography.ts';
import * as size from './size.ts';
import { openVote, sets, type SetGame, type SetId } from './vote.ts';
import type { PartyMode } from './groups.ts';
import type { Difficulty } from '../standalone/types.ts';

/** A set is one party game made of two: a match opens with a vote between
 * them, and every round ends with a vote to play the same game again, switch
 * to the other one, or finish. Tribu (`orin`) holds Top Five and Dial, about
 * how well a table knows each other; Sabi (`miro`) holds Atlas and Sizes,
 * about the world. The saved state is always one of the set's games; a
 * switch replaces it with a fresh game of the other kind that keeps the
 * seats, the log, the round count and everyone's points so far. */
export type TribuPart = ranking.RankingGame | dial.DialGame;
export type SabiPart = geography.GeoGame | size.SizeGame;
export type SetPart = TribuPart | SabiPart;
export const partNames: Record<SetGame, string> = {
  orin: 'Top Five',
  dial: 'Dial',
  miro: 'Atlas',
  size: 'Sizes',
};
export const setNames: Record<SetId, string> = { orin: 'Know Me', miro: 'Quiz' };

function opening<T extends SetPart>(g: T, set: SetId, now: number): T {
  const n = g.seats.length;
  g.tribu = { carry: Array(n).fill(0), mode: g.mode, teams: [...g.teams] };
  // The team game's first deal waits behind the opening vote.
  g.phase = 'vote';
  g.vote = openVote(n, now, true, [...sets[set]], true);
  return g;
}
export function createTribu(
  n: number,
  seed: number,
  difficulty: Difficulty,
  mode: PartyMode = 'individual',
  seen?: ReadonlySet<string>,
  teams?: number[],
  now = Date.now(),
): ranking.RankingGame {
  return opening(
    ranking.createGame('orin', n, seed, difficulty, mode, seen, teams),
    'orin',
    now,
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
): geography.GeoGame {
  return opening(
    geography.createGame(n, seed, difficulty, mode, seen, teams),
    'miro',
    now,
  );
}

/** Points each seat has earned this match, including the game in progress.
 * Team games credit a team's points to each of its players. */
export function seatTotals(g: SetPart): number[] {
  const carry = g.tribu?.carry ?? g.seats.map(() => 0),
    solo = g.kind === 'dial' || g.kind === 'size';
  return g.seats.map(
    (_, s) => carry[s] + (solo ? g.scores[s] : g.scores[g.teams[s]]),
  );
}

/** Applies a switch the table voted for; any other state passes through. */
export function settle<T>(g: T): T | SetPart {
  const part = g as SetPart;
  if (!part.tribu || !part.handoff) return g;
  const t = part.tribu,
    n = part.seats.length,
    carry = seatTotals(part),
    { rngState: seed, difficulty } = part;
  const next: SetPart =
    part.handoff === 'dial'
      ? dial.createGame(n, seed, difficulty)
      : part.handoff === 'size'
        ? size.createGame(n, seed, difficulty)
        : part.handoff === 'miro'
          ? geography.createGame(
              n,
              seed,
              difficulty,
              t.mode,
              undefined,
              t.teams,
            )
          : ranking.createGame(
              'orin',
              n,
              seed,
              difficulty,
              t.mode,
              undefined,
              t.teams,
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
/** A fresh game joins the match at its current round. Sizes deals by round
 * (things on odd rounds, countries on even), and Atlas remembers where its
 * places started, so both redeal for the round they join. */
function startAt(g: SetPart, round: number): SetPart {
  if (g.kind === 'size') return size.startAt(g, round);
  if (g.kind === 'miro') return geography.startAt(g, round);
  g.round = round;
  return g;
}
