import { note, roll } from '../standalone/types.ts';
import type { TribuState } from './tribu-state.ts';

/** What closes every party-game round. A set of games (Know Me, Quiz) offers
 * its games and finishing, and opens every match with a pick between its
 * games. By default the table host picks (`host`); with Votes on in setup,
 * the table has ten seconds to vote instead: the most popular choice wins,
 * players who stay silent don't count, and a tie or an empty vote keeps the
 * table playing. A game played on its own votes to play another round or
 * finish. */
export type SetGame =
  | 'orin'
  | 'dial'
  | 'coins'
  | 'miro'
  | 'size'
  | 'year'
  | 'order';
export type RoundChoice = 'more' | 'finish' | SetGame;
/** Each set's games, keyed by the set's library id (its first game). */
export const sets = {
  orin: ['orin', 'dial', 'coins'],
  miro: ['miro', 'size', 'year', 'order'],
} as const satisfies Record<string, readonly SetGame[]>;
export type SetId = keyof typeof sets;
export function setOf(kind: string): SetId {
  return (sets.orin as readonly string[]).includes(kind) ? 'orin' : 'miro';
}
/** The games inside Know Me. */
export type TribuGame = (typeof sets.orin)[number];
export const tribuGames: TribuGame[] = [...sets.orin];
const allChoices: RoundChoice[] = [
  'more',
  'finish',
  ...sets.orin,
  ...sets.miro,
];
export type RoundVote = {
  /** Server-owned deadline; null in practice and when the host picks. */
  endsAt: number | null;
  choices: (RoundChoice | null)[];
  /** What this vote offers; absent on older saves, which offered more/finish. */
  options?: RoundChoice[];
  /** The set's first pick, before any game has been played. */
  opening?: true;
  /** The table host picks alone: the first choice made settles it. */
  host?: true;
};
export const roundVoteMs = 10_000;
/** Enough rounds for a long evening, and a bound for saved-game validation. */
export const maxRounds = 12;
const classic: RoundChoice[] = ['more', 'finish'];

export function openVote(
  seats: number,
  now: number,
  timed: boolean,
  options: RoundChoice[] = classic,
  opening = false,
  host = false,
): RoundVote {
  return {
    endsAt: timed && !host ? now + roundVoteMs : null,
    choices: Array.from({ length: seats }, () => null),
    ...(options === classic ? {} : { options: [...options] }),
    ...(opening ? { opening: true as const } : {}),
    ...(host ? { host: true as const } : {}),
  };
}
/** Whether the table votes between rounds: only when setup turned Votes on. */
export function tableVotes(g: { tribu?: TribuState }) {
  return !g.tribu || g.tribu.votes === true;
}
export function voteOptions(v: RoundVote | null | undefined) {
  return v?.options ?? classic;
}
export function isChoice(c: unknown, v?: RoundVote | null): c is RoundChoice {
  return typeof c === 'string' && voteOptions(v).includes(c as RoundChoice);
}
export function voteClosed(v: RoundVote, now: number) {
  if (v.host) return v.choices.some((c) => c !== null);
  return (
    v.choices.every((c) => c !== null) || (v.endsAt !== null && now >= v.endsAt)
  );
}
export function voteTally(v: RoundVote) {
  const tally = Object.fromEntries(allChoices.map((c) => [c, 0])) as Record<
    RoundChoice,
    number
  >;
  for (const c of v.choices) if (c) tally[c]++;
  return tally;
}
/** The winning choice. `keep` is what continuing means (another round, or the
 * game being played); it wins any tie it is part of and an empty vote. A tie
 * without it prefers playing over finishing, then `pick` settles it. */
export function voteResult(
  v: RoundVote,
  keep: RoundChoice | null = 'more',
  pick: (n: number) => number = () => 0,
): RoundChoice {
  if (v.host) {
    const chosen = v.choices.find((c) => c !== null);
    if (chosen) return chosen;
  }
  const tally = voteTally(v),
    options = voteOptions(v),
    top = Math.max(...options.map((o) => tally[o]));
  if (top === 0 && keep) return keep;
  let tied = options.filter((o) => tally[o] === top);
  if (keep && tied.includes(keep)) return keep;
  if (tied.length > 1) tied = tied.filter((o) => o !== 'finish');
  return tied[tied.length > 1 ? pick(tied.length) % tied.length : 0];
}
export function validVote(v: unknown, seats: number): v is RoundVote {
  if (!v || typeof v !== 'object') return false;
  const r = v as RoundVote;
  return (
    (r.endsAt === null || Number.isFinite(r.endsAt)) &&
    (r.options === undefined ||
      (Array.isArray(r.options) &&
        (r.options.length >= 2 ||
          (r.options.length === 1 && r.host === true)) &&
        new Set(r.options).size === r.options.length &&
        r.options.every((o) => allChoices.includes(o)))) &&
    (r.opening === undefined || r.opening === true) &&
    (r.host === undefined || (r.host === true && r.endsAt === null)) &&
    Array.isArray(r.choices) &&
    r.choices.length === seats &&
    r.choices.every((c) => c === null || isChoice(c, r))
  );
}

/** The state every party game shares around its round vote. */
type RoundGame = {
  kind: SetGame;
  seats: string[];
  round: number;
  phase: string;
  over: boolean;
  tutorial: boolean;
  rngState: number;
  log: { id: number; seat?: number; text: string }[];
  vote?: RoundVote | null;
  tribu?: TribuState;
  handoff?: SetGame | null;
  version: 1;
  difficulty: 'easy' | 'medium' | 'hard';
  revision: number;
};
/** Opens the pick (or the vote) that closes a round. A set offers each of its
 * games, less any `without` (Atlas out of places), and End. */
export function endRound(
  g: RoundGame,
  now: number,
  without: SetGame[] = [],
): void {
  const host = !tableVotes(g);
  g.phase = 'vote';
  g.vote = openVote(
    g.seats.length,
    now,
    !g.tutorial,
    g.tribu
      ? [...sets[setOf(g.kind)].filter((k) => !without.includes(k)), 'finish']
      : undefined,
    false,
    host,
  );
  note(
    g as never,
    `Round ${g.round} complete. ${host ? 'The host picks what next.' : 'Another round?'}`,
  );
}
/** Settles a closed vote. The opening pick starts the chosen game (`begin`
 * when it is this one); a round's end finishes the match, deals the same game
 * again (`deal`), or hands the table to another game of the set. */
export function closeRound<G extends RoundGame>(
  g: G,
  deal: (g: G) => void,
  begin: (g: G) => void = deal,
): G {
  const v = g.vote!,
    opening = !!v.opening,
    options = voteOptions(v);
  const keep = opening
    ? null
    : g.tribu
      ? options.includes(g.kind)
        ? g.kind
        : (options.find((o) => o !== 'finish') ?? null)
      : 'more';
  const choice = voteResult(v, keep, (n) => Math.floor(roll(g) * n));
  g.vote = null;
  if (opening) {
    if (choice !== g.kind && choice !== 'more' && choice !== 'finish')
      g.handoff = choice;
    else begin(g);
    note(g as never, `The table chose ${choice}.`);
    return g;
  }
  if (choice === 'finish' || g.round >= maxRounds) {
    // The finished table keeps the last reveal on screen.
    g.phase = 'reveal';
    g.over = true;
    note(
      g as never,
      `The table finished after ${g.round} round${g.round === 1 ? '' : 's'}.`,
    );
    return g;
  }
  g.round++;
  if (choice !== g.kind && choice !== 'more') {
    g.handoff = choice;
    return g;
  }
  deal(g);
  return g;
}
/** What practice bots vote: the game in play for two rounds, then End. */
export function botChoice(g: RoundGame, s: number): RoundChoice {
  const options = voteOptions(g.vote);
  if (g.vote?.opening) return options[s % options.length];
  if (g.round >= 2) return 'finish';
  return options.includes(g.kind) ? g.kind : options[0];
}
/** Who the vote waits on: everyone still silent, or nobody when the host
 * picks (the table decides who hosts). */
export function voters(g: { seats: string[]; vote?: RoundVote | null }) {
  if (!g.vote || g.vote.host) return [];
  return g.seats.flatMap((_, s) => (g.vote!.choices[s] ? [] : [s]));
}
