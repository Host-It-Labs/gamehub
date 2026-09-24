/** The ten-second table vote that closes every party-game round. A set of
 * games (Tribu: Top Five and Dial; Sabi: Atlas and Sizes) votes between its
 * games and finishing, and opens every match with a vote between its games.
 * A game played on its own votes to play another round or finish. The most
 * popular choice wins; players who stay silent don't count, and a tie or an
 * empty vote keeps the table playing. */
export type SetGame = 'orin' | 'dial' | 'miro' | 'size';
export type RoundChoice = 'more' | 'finish' | SetGame;
/** Each set's games, keyed by the set's library id (its first game). */
export const sets = {
  orin: ['orin', 'dial'],
  miro: ['miro', 'size'],
} as const satisfies Record<string, readonly SetGame[]>;
export type SetId = keyof typeof sets;
export function setOf(kind: SetGame): SetId {
  return kind === 'orin' || kind === 'dial' ? 'orin' : 'miro';
}
/** The games inside Tribu. */
export type TribuGame = (typeof sets.orin)[number];
export const tribuGames: TribuGame[] = [...sets.orin];
const allChoices: RoundChoice[] = ['more', 'finish', 'orin', 'dial', 'miro', 'size'];
export type RoundVote = {
  /** Server-owned deadline; null in practice, where the vote waits for everyone. */
  endsAt: number | null;
  choices: (RoundChoice | null)[];
  /** What this vote offers; absent on older saves, which offered more/finish. */
  options?: RoundChoice[];
  /** Tribu's first vote, before any game has been played. */
  opening?: true;
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
): RoundVote {
  return {
    endsAt: timed ? now + roundVoteMs : null,
    choices: Array.from({ length: seats }, () => null),
    ...(options === classic ? {} : { options: [...options] }),
    ...(opening ? { opening: true as const } : {}),
  };
}
export function voteOptions(v: RoundVote | null | undefined) {
  return v?.options ?? classic;
}
export function isChoice(c: unknown, v?: RoundVote | null): c is RoundChoice {
  return typeof c === 'string' && voteOptions(v).includes(c as RoundChoice);
}
export function voteClosed(v: RoundVote, now: number) {
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
        r.options.length >= 2 &&
        r.options.every((o) => allChoices.includes(o)))) &&
    (r.opening === undefined || r.opening === true) &&
    Array.isArray(r.choices) &&
    r.choices.length === seats &&
    r.choices.every((c) => c === null || isChoice(c, r))
  );
}
