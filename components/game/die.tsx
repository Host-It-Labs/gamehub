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
  goldValue,
  tideRanks,
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
          <p>The die rolls once everyone has passed.</p>
        ) : g.phase === 'roll' ? (
          <p>The die is rolling.</p>
        ) : g.id === 'undertow' ? (
          <>
            <p>
              This round the{' '}
              <b>
                {suits[g.hazard]} {tidePenaltyRank(g)}
              </b>{' '}
              is worth <b>{tidePenaltyValue(g)}</b> penalty points.
            </p>
            {g.gold && (
              <p>
                The{' '}
                <b>
                  {suits[g.hazard]} {tideRanks(g)}
                </b>{' '}
                is Gold: it takes <b>{goldValue(g)}</b> off.
              </p>
            )}
          </>
        ) : (
          <>
            <p>
              <b>{moraDieLabels[g.die]}:</b> {placementDieRule(g.die, g.contentSet)}
            </p>
            <p>
              {exempt ? (
                <>
                  You are the <b>roller</b>: use any habitat with space.
                </>
              ) : (
                <>
                  The roller, <b>{g.players[g.roller].name}</b>, may use any
                  habitat with space.
                </>
              )}{' '}
              Release is always allowed and scores 0.
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
