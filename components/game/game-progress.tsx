import type { ReactNode } from 'react';
import './game-progress.css';
import './mobile-hud.css';

/**
 * Game progress. A `round` count is a pill centred on the top bar; other
 * progress (Relic's ticket tally) stays beneath the back control. Games whose
 * length changes as they go (Know Me, Quiz) show no round count at all.
 */
export function GameProgress({
  label,
  round = false,
  children,
}: {
  label: string;
  round?: boolean;
  /** Drawn after the label, e.g. a track of the whole match. */
  children?: ReactNode;
}) {
  return (
    <output
      className={`game-progress ${round ? 'is-round' : ''}`}
      data-game-motion="change"
      data-game-motion-key={label}
      aria-label={label}
    >
      {label}
      {children}
    </output>
  );
}
