'use client';
import type { ComponentType, CSSProperties } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import {
  voteOptions,
  voteTally,
  type RoundChoice,
  type RoundVote,
} from '@/lib/games/party/vote';
import { partNames } from '@/lib/games/party/tribu';
import { VoteClock } from './table-vote';
import { AtlasMark, OrderMark, SizesMark, YearsMark } from './sabi-marks';
import { CoinsMark, DialMark, EndMark, TopFiveMark } from './know-me-marks';
import './set-pick.css';

/** Every game's mark, shared by the pick tiles and the starting burst. */
export const setMarks: Record<RoundChoice, ComponentType> = {
  orin: TopFiveMark,
  dial: DialMark,
  coins: CoinsMark,
  miro: AtlasMark,
  size: SizesMark,
  year: YearsMark,
  order: OrderMark,
  more: EndMark,
  finish: EndMark,
};

/** A set's table picks: the opening pick between its games, and the
 * end-of-round choice to play the same game again, switch, or end. The host
 * picks alone unless the table votes. */
export function TribuVote({
  vote,
  current,
  viewer,
  disabled,
  hostName,
  onVote,
}: {
  vote: RoundVote;
  /** The game being played; null before the first one. */
  current: RoundChoice | null;
  viewer: number;
  disabled: boolean;
  hostName?: string;
  onVote: (choice: RoundChoice) => void;
}) {
  const mine = vote.choices[viewer] ?? null,
    tally = voteTally(vote),
    options = voteOptions(vote);
  return (
    <section
      className={`tribu-vote ${vote.opening ? 'is-opening' : ''} ${vote.host ? 'is-host-pick' : ''}`}
      aria-label={vote.opening ? 'The first game' : 'What next'}
    >
      <VoteClock endsAt={vote.endsAt} />
      {vote.host && disabled && (
        <p className="party-host-wait">{hostName ?? 'The host'} picks</p>
      )}
      <div
        className={`tribu-vote-options ${options.length > 3 ? 'is-many' : ''}`}
        style={{ '--n': options.length } as CSSProperties}
        data-games={
          options.filter((o) => o !== 'finish' && o !== 'more').length
        }
      >
        {options.map((choice, i) => {
          const again = choice === current;
          const name =
              choice === 'more' || choice === 'finish'
                ? 'End'
                : partNames[choice],
            Mark = setMarks[choice];
          return (
            <button
              key={choice}
              type="button"
              className={`tribu-tile tile-${choice} ${again ? 'is-again' : ''} ${mine === choice ? 'is-mine' : ''} ${mine && mine !== choice ? 'is-other' : ''}`}
              style={{ '--i': i } as CSSProperties}
              aria-pressed={mine === choice}
              aria-label={`${again ? `${name} again` : name}${vote.host ? '' : `, ${tally[choice]} vote${tally[choice] === 1 ? '' : 's'}`}`}
              disabled={disabled}
              onClick={() => mine !== choice && onVote(choice)}
            >
              <span className="tribu-tile-art">
                <span className="tile-rays" aria-hidden="true" />
                <Mark />
                {again && (
                  <RotateCcw
                    className="tribu-again"
                    size={18}
                    aria-hidden="true"
                  />
                )}
              </span>
              <strong className="tribu-tile-name">{name}</strong>
              {!vote.host && (
                <span
                  className="vote-count"
                  aria-hidden="true"
                  data-game-motion="change"
                  data-game-motion-key={tally[choice]}
                >
                  {Array.from({ length: tally[choice] }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
              )}
              {mine === choice && (
                <Check className="vote-check" size={18} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
