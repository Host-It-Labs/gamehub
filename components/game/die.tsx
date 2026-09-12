'use client';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
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
    ? 'Rolling…'
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

export function DieControl({ g }: { g: PublicGame }) {
  return (
    <Popover>
      <PopoverTrigger
        className="dice-token"
        data-coach="die"
        aria-label="Die result and rule"
      >
        <Die g={g} />
      </PopoverTrigger>
      <PopoverContent className="die-help" side="top" align="end">
        <PopoverTitle>
          {g.id === 'undertow' ? 'Penalty die' : 'Placement die'}
        </PopoverTitle>
        {g.phase === 'roll' ? (
          <p>The die rolls automatically.</p>
        ) : g.id === 'undertow' ? (
          <p>
            The {suits[g.hazard]} 9 is worth 40 penalty points this round. The
            die rolls after everyone has passed their cards.
          </p>
        ) : (
          <>
            <p>
              <b>{dice[g.die].name}:</b> {dice[g.die].rule}
            </p>
            <p>
              {g.players[g.roller].name} can use any habitat with space.
              Everyone else follows the die. The Riverbank is always available.
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
