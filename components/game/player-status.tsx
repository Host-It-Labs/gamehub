/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Composite SVG state icons need one accessible name. */
import { Check, Dice5, Hourglass, Pause } from 'lucide-react';

/** The shared visual vocabulary for turn state, independent of a game's skin. */
export function PlayerStatus({ state, roller = false }: {
  state: 'deciding' | 'ready' | 'waiting' | 'offline'; roller?: boolean;
}) {
  const label = { deciding: 'Choosing a move', ready: 'Move locked', waiting: 'Waiting for turn', offline: 'Reconnecting' }[state];
  const Icon = state === 'ready' ? Check : state === 'deciding' ? Hourglass : Pause;
  return <span className="player-status-icons" data-game-motion="change" data-game-motion-key={`${state}:${roller}`}>
    <span className={`turn-state turn-state-${state}`} role="img" aria-label={label} title={label}><Icon size={14} aria-hidden="true" /></span>
    {roller && <span className="turn-roller" role="img" aria-label="Rolls the placement die" title="Rolls the placement die"><Dice5 size={14} aria-hidden="true" /></span>}
  </span>;
}
