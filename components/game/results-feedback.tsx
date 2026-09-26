'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { gameSound } from '@/lib/games/game-sound';
import {
  createResultsFeedback,
  scheduleResultsFeedback,
} from '@/lib/games/results-feedback';
import './results-feedback.css';

/** Keep this hook on the table, outside any conditionally mounted dialog. */
export function useResultsFeedback(
  id: string,
  finished: boolean,
  visible: boolean,
  volume: number,
) {
  const feedback = useRef(createResultsFeedback());
  useEffect(
    () =>
      scheduleResultsFeedback(feedback.current, finished, visible, volume, () =>
        gameSound(id, 'scores', volume),
      ),
    [id, finished, visible, volume],
  );
}

/** One quiet rim of sparks around the winner's scores, with no layout space
 * or pointer targets. Reduced motion keeps only the small gold ornaments. */
export function WinnerCelebration({ won }: { won: boolean }) {
  if (!won) return null;
  return (
    <div className="results-celebration" aria-hidden="true">
      {[0, 1, 2].map((burst) => (
        <span
          className="results-firework"
          key={burst}
          style={{ '--burst-index': burst } as CSSProperties}
        >
          {Array.from({ length: 8 }, (_, ray) => (
            <i key={ray} style={{ '--ray': ray } as CSSProperties} />
          ))}
        </span>
      ))}
      <span className="results-winner-ornament">✧</span>
      <span className="results-winner-ornament">✧</span>
    </div>
  );
}
