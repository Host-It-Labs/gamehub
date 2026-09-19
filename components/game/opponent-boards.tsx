'use client';
import { useEffect, useRef } from 'react';
import { ArrowRight, Footprints, MoveRight } from 'lucide-react';
import { foodsFor, scores, type PublicGame } from '@/lib/games/trio/engine';
import type { Inspect } from './interactions';
import { SanctuaryBadges } from './mora-extension';
import { Board } from './boards';
import { FestivalSummary } from './yatai-festival';

/** Public progress only: never expose a hand or an uncommitted decision. */
export function PlayerResources({ g, player, inspect, compact = false }: { g: PublicGame; player: number; inspect?: Inspect; compact?: boolean }) {
  const p = g.players[player];
  if (compact && g.id === 'wildgrove')
    return <div className="player-resources compact">
      {(g.roamEnabled || g.migration) && <dl className="nature-reserves">
        {g.roamEnabled && <div title="Roam uses left"><dt><Footprints size={16} aria-hidden="true" /><span className="sr-only">Roam</span></dt><dd>{p.roams ?? 0}</dd></div>}
        {g.migration && <div title="Migration uses left"><dt><MoveRight size={16} aria-hidden="true" /><span className="sr-only">Migration</span></dt><dd>{p.migrations ?? 0}</dd></div>}
      </dl>}
      {g.sanctuaryGoalsEnabled && <SanctuaryBadges zones={p.zones} goals={g.sanctuaryGoals} contentSet={g.contentSet} inspect={inspect} />}
    </div>;
  return <div className="player-resources">
    <FestivalSummary g={g} player={player} />
    {g.id === 'midnight' && <dl className="nature-reserves">
      {g.specialtyStalls && <div><dt>Stall permits</dt><dd>{Math.max(0, 2 - (p.festival?.stalls.length ?? 0))} / 2 left</dd></div>}
      {g.specialtyStalls && p.festival?.stalls.map(stall => <div key={stall.kind}><dt>{foodsFor(g.contentSet)[stall.kind].name} stall</dt><dd>Open</dd></div>)}
      {g.marketSeasons && <div><dt>Market Seasons</dt><dd>{p.seasonPoints ?? 0} pts</dd></div>}
    </dl>}
    {g.id === 'wildgrove' && <>
      {(g.roamEnabled || g.migration) && <dl className="nature-reserves">
        {g.roamEnabled && <div><dt><Footprints size={18} aria-hidden="true" />Roam</dt><dd>{p.roams ?? 0} / 2 left</dd></div>}
        {g.migration && <div><dt><MoveRight size={18} aria-hidden="true" />Migration</dt><dd>{p.migrations ?? 0} / 1 left</dd></div>}
      </dl>}
      {g.sanctuaryGoalsEnabled && <SanctuaryBadges zones={p.zones} goals={g.sanctuaryGoals} contentSet={g.contentSet} inspect={inspect} />}
    </>}
  </div>;
}

export function OpponentBoards({ g, viewer, inspect, selected = viewer }: {
  g: PublicGame; viewer: number; inspect: Inspect; selected?: number;
}) {
  const selectedRef = useRef<HTMLElement>(null);
  const totals = scores(g);
  // Drafting passes forward in round one and backward in round two.
  const direction = g.round % 2 ? 1 : -1;
  const seats = Array.from({ length: g.players.length }, (_, i) => (viewer + i * direction + g.players.length) % g.players.length);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  const others = seats.filter(player => player !== viewer);
  return <div className={`all-boards-grid seats-${others.length}`}>
    {/* One line: the whole passing cycle, ending where it started. */}
    <nav className="table-passing-order" aria-label={`Passing order this round, ${g.round % 2 ? 'forward' : 'back the other way'}`}>
      {[...seats, seats[0]].map((seat, i) => <span key={i} className={seat === viewer ? 'your-seat' : ''}>
        <b>{seat === viewer ? 'You' : g.players[seat].name}</b>
        {i < seats.length && <ArrowRight size={18} aria-label={`passes to ${i + 1 < seats.length ? g.players[seats[i + 1]].name : 'you'}`} />}
      </span>)}
    </nav>
    {others.map(player => <section key={player} ref={player === selected ? selectedRef : undefined}
      className={`table-board-card ${player === selected ? 'is-selected' : ''}`}
      aria-label={g.players[player].name}>
      <h3>
        <span>{g.players[player].name}</span>
        <PlayerResources g={g} player={player} inspect={inspect} compact />
        <b>{totals[player]} pts</b>
      </h3>
      <Board g={g} player={player} viewer={viewer} mini inspect={inspect} />
    </section>)}
  </div>;
}
