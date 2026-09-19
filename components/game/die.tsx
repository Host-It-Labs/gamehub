'use client';
import type { CSSProperties } from 'react';
import { PlayerStatus } from './player-status';
import { MoraDieSymbol, moraDieLabels } from './mora-symbols';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
import {
  placementDieRule,
  tidePenaltyRank,
  tidePenaltyValue,
  suits,
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
        : moraDieLabels[face];
  if (g.id === 'wildgrove' || g.id === 'undertow') {
    const nox = g.id === 'undertow';
    // Face i sits on a real cube; the cube turns so the rolled face comes to the front.
    const rest = [[0, 0], [0, -90], [0, 180], [0, 90], [-90, 0], [90, 0]][face] ?? [0, 0];
    return (
      <span className="die-display">
        <span className="die-cube-scene" aria-hidden="true">
          <span
            key={roll?.id ?? 'ready'}
            className={`die-cube ${roll && !ready && !pending ? 'die-rolling' : ''}`}
            style={{ '--rx': `${rest[0]}deg`, '--ry': `${rest[1]}deg` } as CSSProperties}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`die-face die-face-${i}`}>
                {ready || pending ? (
                  '?'
                ) : nox ? (
                  // Four suits on six faces: the last two repeat spades and hearts.
                  <span className={`die-suit suit-${i % 4}`}>{suits[i % 4]}</span>
                ) : (
                  <MoraDieSymbol face={i} />
                )}
              </span>
            ))}
          </span>
        </span>
        <span className="die-caption">{label}</span>
      </span>
    );
  }
  return (
    <span className="die-display">
      <span
        key={roll?.id ?? 'ready'}
        className={`die-solid ${roll && !pending && !ready ? 'die-bounce' : ''}`}
        aria-hidden="true"
      >
        {ready || pending ? '?' : <MoraDieSymbol face={face} />}
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
        {exempt && <PlayerStatus state={g.phase === 'roll' ? 'deciding' : 'ready'} roller />}
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
              <b>{moraDieLabels[g.die]}:</b> {placementDieRule(g.die, g.contentSet)}
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
