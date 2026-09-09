'use client';
import {
  dice,
  suits,
  habitatOrder,
  type PublicGame,
} from '@/lib/games/trio/engine';
/** A single solid face avoids intersecting textures during a roll. */
export function Die({ g }: { g: PublicGame }) {
  const roll = [...g.events].reverse().find((e) => e.type === 'roll');
  const ready = g.phase === 'roll';
  const face = g.id === 'undertow' ? g.hazard : g.die;
  const label = ready
    ? 'Roll die'
    : g.id === 'undertow'
      ? `${suits[face] ?? '—'} 9 = 40`
      : dice[face].name;
  return (
    <span className="die-display">
      <span
        key={roll?.id ?? 'ready'}
        className={`die-solid ${roll ? 'die-bounce' : ''}`}
        aria-hidden="true"
      >
        {ready ? (
          '?'
        ) : g.id === 'undertow' ? (
          suits[face]
        ) : face < 4 ? (
          <span className="die-map">
            {Array.from({ length: 6 }, (_, i) => (
              <i
                key={i}
                className={
                  dice[face].zones.includes(habitatOrder[i]) ? 'lit' : ''
                }
              />
            ))}
          </span>
        ) : (
          dice[face].symbol
        )}
      </span>
      <span className="die-caption">{label}</span>
    </span>
  );
}
