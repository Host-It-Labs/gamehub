'use client';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
import {
  dice,
  tidePenaltyRank,
  tidePenaltyValue,
  suits,
  habitatOrder,
  type PublicGame,
} from '@/lib/games/trio/engine';
/** A single solid face avoids intersecting textures during a roll. */
export function Die({ g }: { g: PublicGame }) {
  const roll = [...g.events].reverse().find((e) => e.type === 'roll');
  const pending = g.id === 'undertow' && g.phase === 'pass';
  const ready = g.phase === 'roll';
  const face = g.id === 'undertow' ? g.hazard : g.die;
  const label = pending
    ? 'Rolls after passing'
    : ready
      ? 'Rolling…'
      : g.id === 'undertow'
        ? `${suits[face] ?? '—'} ${tidePenaltyRank(g)} = ${tidePenaltyValue(g)}`
        : dice[face].name;
  return (
    <span className="die-display">
      <span
        key={roll?.id ?? 'ready'}
        className={`die-solid ${roll && !pending && !ready ? 'die-bounce' : ''}`}
        aria-hidden="true"
      >
        {ready || pending ? (
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

export function DieControl({ g, viewer }: { g: PublicGame; viewer?: number }) {
  const exempt = g.id === 'wildgrove' && viewer === g.roller;
  return (
    <Popover>
      <PopoverTrigger
        className={`dice-token ${exempt ? 'die-exempt' : ''}`}
        data-coach="die"
        aria-label={
          exempt
            ? 'You are the roller. The placement die does not restrict you.'
            : 'Die result and rule'
        }
      >
        <Die g={g} />
        {exempt && <span className="roller-badge">ROLLER</span>}
      </PopoverTrigger>
      <PopoverContent className="die-help" side="top" align="end">
        <PopoverTitle>
          {g.id === 'undertow' ? 'Penalty die' : 'Placement die'}
        </PopoverTitle>
        {g.id === 'undertow' && g.phase === 'pass' ? (
          <p>
            The penalty suit is unknown. The die rolls after everyone has
            passed.
          </p>
        ) : g.phase === 'roll' ? (
          <p>The die rolls automatically.</p>
        ) : g.id === 'undertow' ? (
          <p>
            The {suits[g.hazard]} {tidePenaltyRank(g)} is worth{' '}
            {tidePenaltyValue(g)} penalty points this round. The die rolls after
            everyone has passed their cards.
          </p>
        ) : (
          <>
            <p>
              <b>{dice[g.die].name}:</b> {dice[g.die].rule}
            </p>
            <p>
              {g.players[g.roller].name} can use any habitat with space.
              Everyone else follows the die. Releasing a creature is always
              available and scores nothing.
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
