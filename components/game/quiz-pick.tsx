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
import {
  AtlasMark,
  OrderMark,
  QuizEndMark,
  QuizMoreMark,
  SizesMark,
  YearsMark,
} from './sabi-marks';
import './quiz-pick.css';

/** Quiz's marks, one desk object per game, on the cards and the splash. */
export const quizMarks: Partial<Record<RoundChoice, ComponentType>> = {
  miro: AtlasMark,
  size: SizesMark,
  year: YearsMark,
  order: OrderMark,
  more: QuizMoreMark,
  finish: QuizEndMark,
};

/** The colour family of a card: a Quiz game, Trivia's 4 more, or End. */
export function quizTone(choice: RoundChoice) {
  return choice === 'finish' ? 'end' : choice;
}

/** Quiz's table pick: the opening pick between its games and the
 * end-of-round choice (again, switch, End). Each game is an index card from
 * the measuring desk with a window of cutting mat in its own colour, its
 * mark on the mat and its name on the ruled card. Cards deal onto the desk,
 * lift on hover, and a picked one takes an enamel pin. The host picks alone
 * unless the table votes. */
export function QuizPick({
  vote,
  current,
  viewer,
  disabled,
  hostName,
  showHostWait = true,
  onVote,
}: {
  vote: RoundVote;
  /** The game being played; null before the first one. */
  current: RoundChoice | null;
  viewer: number;
  disabled: boolean;
  hostName?: string;
  showHostWait?: boolean;
  onVote: (choice: RoundChoice) => void;
}) {
  const mine = vote.choices[viewer] ?? null,
    tally = voteTally(vote),
    options = voteOptions(vote),
    games = options.filter((o) => o !== 'finish' && o !== 'more').length;
  return (
    <section
      className={`quiz-pick ${vote.opening ? 'is-opening' : ''} ${vote.host ? 'is-host-pick' : ''}`}
      aria-label={vote.opening ? 'The first game' : 'What next'}
    >
      <VoteClock endsAt={vote.endsAt} />
      {showHostWait && vote.host && disabled && (
        <p className="party-host-wait">{hostName ?? 'The host'} picks</p>
      )}
      <div
        className={`quiz-pick-row ${games < options.length ? 'has-end' : ''}`}
        style={{ '--n': options.length } as CSSProperties}
        data-games={games}
      >
        {options.map((choice, i) => {
          const again = choice === current,
            end = choice === 'finish',
            // Only Trivia's fixed matches offer more: four more rounds.
            name = end ? 'End' : choice === 'more' ? '4 more' : partNames[choice],
            Mark = quizMarks[choice];
          return (
            <button
              key={choice}
              type="button"
              className={`quiz-card qc-tone-${quizTone(choice)} ${end ? 'is-end' : ''} ${again ? 'is-again' : ''} ${mine === choice ? 'is-mine' : ''} ${mine && mine !== choice ? 'is-other' : ''}`}
              style={{ '--i': i } as CSSProperties}
              aria-pressed={mine === choice}
              aria-label={`${again ? `${name} again` : name}${vote.host ? '' : `, ${tally[choice]} vote${tally[choice] === 1 ? '' : 's'}`}`}
              disabled={disabled}
              onClick={() => mine !== choice && onVote(choice)}
            >
              <span className="qc-mat">{Mark && <Mark />}</span>
              <strong className="qc-name">{name}</strong>
              {again && (
                <span className="qc-again" aria-hidden="true">
                  <RotateCcw size={16} />
                </span>
              )}
              {!vote.host && (
                <span
                  className="qc-votes"
                  aria-hidden="true"
                  data-game-motion="change"
                  data-game-motion-key={tally[choice]}
                >
                  {Array.from({ length: tally[choice] }, (_, k) => (
                    <i key={k} />
                  ))}
                </span>
              )}
              {mine === choice && (
                <span className="qc-pin" aria-hidden="true">
                  <Check size={18} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
