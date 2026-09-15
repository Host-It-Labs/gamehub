'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Native overflow region must support keyboard scrolling. */
import { Fragment } from 'react';
import { scores, habitats, zoneScore, type PublicGame } from '@/lib/games/trio/engine';
import type { Inspect } from './interactions';
import { Board } from './boards';

export function OpponentBoards({ g, viewer, inspect }: { g: PublicGame; viewer: number; inspect: Inspect }) {
  const n = g.players.length;
  const totals = scores(g);
  // Rotate the circular seating order so You sits between the adjacent boards.
  const before = Math.floor(n / 2);
  const seats = Array.from({ length: n }, (_, i) => (viewer - before + i + n) % n);
  return <aside className="opponent-boards" aria-label="Boards in seating order">
    <div className="opponent-board-scroll" tabIndex={0} aria-label="Scroll boards in seating order">
      {seats.map((player, i) => <Fragment key={player}>
        {player === viewer ? <div className="your-seat" aria-label={`You, seat ${viewer + 1}`}><span aria-hidden="true">●</span> You</div> : <section>
          <h3><span>{g.players[player].name}</span><b>{totals[player]} pts</b></h3>
          <Board g={g} player={player} viewer={viewer} mini inspect={inspect} />
          {g.id === 'wildgrove' && <dl className="compact-habitat-scores">
            {[0, 1, 2, 3, 4, 6].map((zone) => <div key={zone}><dt>{habitats[zone].name}</dt><dd>{zoneScore(g.players[player].zones, zone)} pts</dd></div>)}
          </dl>}
        </section>}
        {i < seats.length - 1 && <span className="seat-pass-arrow" aria-label={g.round % 2 ? 'Pass down' : 'Pass up'}>{g.round % 2 ? '↓' : '↑'}</span>}
      </Fragment>)}
    </div>
  </aside>;
}
