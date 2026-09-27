'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Footprints, MoveRight, Store } from 'lucide-react';
import { passingStep, scores, type PublicGame } from '@/lib/games/trio/engine';
import type { Inspect } from './interactions';
import { SanctuaryBadges } from './mora-extension';
import { Board } from './boards';
import { FestivalSummary } from './yatai-festival';
import { SeasonTrack } from './new-extensions';
import './others-panel.css';

/** Public progress only: never expose a hand or an uncommitted decision.
 *  Where a stall opened shows on the mat itself, so only the permits left do here. */
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
  const permits = Math.max(0, 2 - (p.festival?.stalls.length ?? 0));
  return <div className={`player-resources ${compact ? 'compact' : ''}`}>
    <FestivalSummary g={g} player={player} />
    {g.id === 'midnight' && (g.specialtyStalls || g.marketSeasons) && <dl className="nature-reserves">
      {g.specialtyStalls && <div className={`stall-permits ${permits ? '' : 'spent'}`} title="Stall permits left">
        <dt><Store size={18} aria-hidden="true" /><span className="sr-only">Stall permits left</span></dt><dd>{permits}</dd>
      </div>}
    </dl>}
    {g.id === 'midnight' && g.marketSeasons && <SeasonTrack g={g} player={player} results />}
    {g.id === 'wildgrove' && <>
      {(g.roamEnabled || g.migration) && <dl className="nature-reserves">
        {g.roamEnabled && <div><dt><Footprints size={18} aria-hidden="true" />Roam</dt><dd>{p.roams ?? 0} left</dd></div>}
        {g.migration && <div><dt><MoveRight size={18} aria-hidden="true" />Migration</dt><dd>{p.migrations ?? 0} / 1 left</dd></div>}
      </dl>}
      {g.sanctuaryGoalsEnabled && <SanctuaryBadges zones={p.zones} goals={g.sanctuaryGoals} contentSet={g.contentSet} inspect={inspect} />}
    </>}
  </div>;
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

/** Others: the passing loop on top, then every opponent's mat in the order the
 *  cards travel, drawn the way this screen draws the viewer's own board. */
export function OpponentBoards({ g, viewer, inspect, selected = viewer }: {
  g: PublicGame; viewer: number; inspect: Inspect; selected?: number;
}) {
  const cards = useRef(new Map<number, HTMLElement>());
  const [focus, setFocus] = useState<number | null>(selected === viewer ? null : selected);
  const totals = scores(g);
  // Drafting passes forward in round one and backward in round two.
  const direction = passingStep(g);
  const seats = Array.from({ length: g.players.length }, (_, i) => (viewer + i * direction + g.players.length) % g.players.length);
  const others = seats.filter(player => player !== viewer);
  const name = (seat: number) => (seat === viewer ? 'You' : g.players[seat].name);
  function show(player: number) {
    setFocus(player);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cards.current.get(player)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }
  useEffect(() => {
    if (selected !== viewer) cards.current.get(selected)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected, viewer]);
  return <div className="others-panel" data-game={g.id}>
    {/* The whole passing cycle as one loop: along the row, then back to you underneath. */}
    <nav className="passing-loop" aria-label={`Passing order this round, ${direction === 1 ? 'forward' : 'back the other way'}`}>
      <ol>
        {seats.map((seat, i) => <li key={seat} className={seat === viewer ? 'is-you' : ''}>
          <button type="button" className="passing-seat" disabled={seat === viewer} onClick={() => show(seat)}
            aria-label={`${name(seat)} passes to ${name(seats[(i + 1) % seats.length])}`}>
            <span className={`avatar avatar-${seat}`} aria-hidden="true">{initial(g.players[seat].name)}</span>
            <span className="passing-name">{name(seat)}</span>
          </button>
          {i < seats.length - 1 && <ChevronRight className="passing-arrow" size={16} aria-hidden="true" />}
        </li>)}
      </ol>
    </nav>
    <div className={`others-grid seats-${others.length}`} tabIndex={-1}>
      {others.map(player => <section key={player}
        ref={(node) => { if (node) cards.current.set(player, node); else cards.current.delete(player); }}
        className={`others-card ${player === focus ? 'is-selected' : ''}`}
        aria-label={g.players[player].name}>
        <header className="others-card-head">
          <div className="others-head-row">
            <span className={`avatar avatar-${player}`} aria-hidden="true">{initial(g.players[player].name)}</span>
            <h3>{g.players[player].name}</h3>
            <PlayerResources g={g} player={player} inspect={inspect} compact />
            <b className="others-score">{totals[player]}<small> pts</small></b>
          </div>
        </header>
        <Board g={g} player={player} viewer={viewer} mini inspect={inspect} />
      </section>)}
    </div>
  </div>;
}
