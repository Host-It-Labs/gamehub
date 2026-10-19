import type { CSSProperties } from 'react';
import './player-mark.css';

/** A steady hue per player, so the same person keeps one colour everywhere. */
export function playerHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** A round initial for a player: boards, the account chip, result cards. */
export function PlayerMark({
  id,
  name,
  size = 36,
  className = '',
}: {
  id: string;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`player-mark ${className}`}
      aria-hidden="true"
      style={{ '--mark-hue': playerHue(id), '--mark-size': `${size}px` } as CSSProperties}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
