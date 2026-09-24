'use client';
import { Check } from 'lucide-react';
import { boxCover } from '@/lib/games/box-covers';
import { standaloneGames } from '@/lib/games/standalone/registry';
import type { StandaloneId } from '@/lib/games/standalone/types';
import { VoteClock } from './table-vote';

const choices: StandaloneId[] = ['orin', 'miro'];

/** Ten seconds after a party match to pick the next party game. The most votes
 * starts with the same players; silence leaves the table on the results. */
export function NextGameVote({
  vote,
  viewerId,
  seats,
  disabled,
  onVote,
}: {
  vote: { endsAt: number; ballots: Record<string, StandaloneId> };
  viewerId: string;
  seats: number;
  disabled: boolean;
  onVote: (id: StandaloneId) => void;
}) {
  const mine = vote.ballots[viewerId],
    counts = (id: StandaloneId) =>
      Object.values(vote.ballots).filter((v) => v === id).length;
  return (
    <section
      className="table-vote next-game-vote"
      aria-labelledby="next-game-title"
    >
      <span className="party-eyebrow">WHAT NEXT?</span>
      <h2 id="next-game-title">Vote for the next game</h2>
      <VoteClock endsAt={vote.endsAt} />
      <div className="vote-options">
        {choices
          .filter((id) => standaloneGames[id].seatChoices.includes(seats))
          .map((id) => {
            const cover = boxCover(id);
            return (
              <button
                key={id}
                type="button"
                className={`vote-option next-game-option ${mine === id ? 'is-mine' : ''}`}
                aria-pressed={mine === id}
                disabled={disabled}
                onClick={() => onVote(id)}
              >
                {cover ? (
                  <img src={cover} alt="" />
                ) : (
                  <span
                    className={`next-game-cover cover-${id}`}
                    aria-hidden="true"
                  >
                    {standaloneGames[id].name}
                  </span>
                )}
                <strong className="next-game-name">
                  {standaloneGames[id].name}
                </strong>
                <span className="vote-count" aria-label={`${counts(id)} votes`}>
                  {Array.from({ length: counts(id) }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
                {mine === id && (
                  <Check className="vote-check" size={18} aria-hidden="true" />
                )}
              </button>
            );
          })}
      </div>
      <p className="vote-note">
        Most votes starts with everyone here. You can change your vote until the
        time runs out.
      </p>
    </section>
  );
}
