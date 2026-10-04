'use client';
import { Check } from 'lucide-react';
import { boxCover } from '@/lib/games/box-covers';
import { standaloneGames } from '@/lib/games/standalone/registry';
import type { StandaloneId } from '@/lib/games/standalone/types';
import type { NextGameVote as NextVoteState } from '@/lib/online/types';
import { VoteClock } from './table-vote';

const choices: StandaloneId[] = ['impostor', 'orin', 'miro'];

/** After a party match, the next party game. The host picks it, or with
 * Votes on the table has ten seconds: the most votes starts with the same
 * players, and silence leaves the table on the results. */
export function NextGameVote({
  vote,
  viewerId,
  seats,
  disabled,
  hostName,
  onVote,
}: {
  vote: NextVoteState;
  viewerId: string;
  seats: number;
  disabled: boolean;
  hostName?: string;
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
      <h2 id="next-game-title">What next?</h2>
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
                {!vote.host && (
                  <span
                    className="vote-count"
                    aria-label={`${counts(id)} votes`}
                    data-game-motion="change"
                    data-game-motion-key={counts(id)}
                  >
                    {Array.from({ length: counts(id) }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                )}
                {mine === id && (
                  <Check className="vote-check" size={18} aria-hidden="true" />
                )}
              </button>
            );
          })}
      </div>
      {vote.host && disabled && (
        <p className="party-host-wait">{hostName ?? 'The host'} picks</p>
      )}
    </section>
  );
}
