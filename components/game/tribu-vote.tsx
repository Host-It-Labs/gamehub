'use client';
import { Check, Flag, RotateCcw } from 'lucide-react';
import {
  voteOptions,
  voteTally,
  type RoundChoice,
  type RoundVote,
} from '@/lib/games/party/vote';
import { partNames } from '@/lib/games/party/tribu';
import { VoteClock } from './table-vote';
import { AtlasMark, SizesMark } from './sabi-marks';

/** Five ranked bars, longest first. */
export function TopFiveMark() {
  return (
    <svg viewBox="0 0 64 64" className="tribu-mark" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={8}
          y={7 + i * 10.5}
          width={48 - i * 7}
          height={7.5}
          rx={3.75}
          className={`mark-bar mark-bar-${i}`}
        />
      ))}
    </svg>
  );
}
/** A half dial with its needle. */
export function DialMark() {
  return (
    <svg viewBox="0 0 64 64" className="tribu-mark" aria-hidden="true">
      <defs>
        <linearGradient id="tribu-mark-arc" x1="0" x2="1">
          <stop offset="0" stopColor="#1f9e94" />
          <stop offset=".5" stopColor="#f2b531" />
          <stop offset="1" stopColor="#e5482e" />
        </linearGradient>
      </defs>
      <path
        d="M8 46 A24 24 0 0 1 56 46"
        fill="none"
        stroke="url(#tribu-mark-arc)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path d="M32 46 L45 25" className="mark-needle" strokeWidth="4" />
      <circle cx="32" cy="46" r="5" className="mark-hub" />
    </svg>
  );
}

/** Tribu's table votes: the opening pick between its two games, and the
 * end-of-round choice to play the same game again, switch, or end. */
export function TribuVote({
  vote,
  current,
  viewer,
  disabled,
  onVote,
}: {
  vote: RoundVote;
  /** The game being played; null before the first one. */
  current: RoundChoice | null;
  viewer: number;
  disabled: boolean;
  onVote: (choice: RoundChoice) => void;
}) {
  const mine = vote.choices[viewer] ?? null,
    tally = voteTally(vote);
  return (
    <section
      className={`tribu-vote ${vote.opening ? 'is-opening' : ''}`}
      aria-label={
        vote.opening ? 'Vote for the first game' : 'Vote on what next'
      }
    >
      <VoteClock endsAt={vote.endsAt} />
      <div className="tribu-vote-options">
        {voteOptions(vote).map((choice) => {
          const again = choice === current;
          const name =
            choice === 'more' || choice === 'finish'
              ? 'End'
              : partNames[choice];
          return (
            <button
              key={choice}
              type="button"
              className={`tribu-tile tile-${choice} ${again ? 'is-again' : ''} ${mine === choice ? 'is-mine' : ''}`}
              aria-pressed={mine === choice}
              aria-label={`${again ? `${name} again` : name}, ${tally[choice]} vote${tally[choice] === 1 ? '' : 's'}`}
              disabled={disabled}
              onClick={() => mine !== choice && onVote(choice)}
            >
              <span className="tribu-tile-art">
                {choice === 'orin' ? (
                  <TopFiveMark />
                ) : choice === 'dial' ? (
                  <DialMark />
                ) : choice === 'miro' ? (
                  <AtlasMark />
                ) : choice === 'size' ? (
                  <SizesMark />
                ) : (
                  <Flag className="tribu-mark" strokeWidth={1.6} />
                )}
                {again && (
                  <RotateCcw
                    className="tribu-again"
                    size={18}
                    aria-hidden="true"
                  />
                )}
              </span>
              <strong>{name}</strong>
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
