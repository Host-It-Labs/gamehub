'use client';
import type { CSSProperties } from 'react';
import type { SetGame } from '@/lib/games/party/vote';
import { partNames } from '@/lib/games/party/tribu';
import { introMs } from './game-intro';
import { quizMarks, quizTone } from './quiz-pick';
import './quiz-intro.css';

/** The splash that opens each Quiz game picked at the table, the same
 * second-long burst as Know Me's but on the measuring desk: the game's
 * cutting mat slides in under the lamp, its mark lands with a motion of its
 * own (Atlas' globe spins and takes a pin, Sizes' block grows beside the
 * tape, Years' pin arcs onto the ruler, Order's cards stand up one by one),
 * its name lands on an index card, then it all zooms away. Never takes
 * input; skipped under reduced motion. */
export function QuizIntro({ game }: { game: SetGame }) {
  const Mark = quizMarks[game];
  return (
    <div
      className={`quiz-intro qi-${game} qc-tone-${quizTone(game)}`}
      style={{ '--qi-ms': `${introMs}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="qi-mat" />
      <span className="qi-mark">{Mark && <Mark />}</span>
      <strong className="qi-name">{partNames[game]}</strong>
    </div>
  );
}
