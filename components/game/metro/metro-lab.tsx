'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  EXTENSIONS,
  createMetro,
  observe,
  play,
  type Extension,
  type MetroGame,
  type MetroMove,
} from '@/lib/games/metro/engine';
import { botTurn } from '@/lib/games/metro/bot';
import { MetroTable } from './metro-table';

/**
 * Dev-only bench at /metro/lab: a match fast-forwarded by bots playing your
 * seat too, so the map can be checked full of lines. Query:
 * ?seats=3&turns=14&ext=goals,express&seed=7 (turns=99 plays to the end).
 */
function start(): MetroGame {
  const q = new URLSearchParams(window.location.search);
  const ext = Object.fromEntries(
    EXTENSIONS.map((e) => [e, (q.get('ext') ?? '').split(',').includes(e)]),
  ) as Record<Extension, boolean>;
  const seats = Math.max(1, Math.min(6, Number(q.get('seats') ?? 3)));
  let g = createMetro(seats, Number(q.get('seed') ?? 7), {
    ext,
    difficulty: 'hard',
    bots: Array.from({ length: seats }, (_, i) => i > 0),
  });
  const turns = Math.max(0, Number(q.get('turns') ?? 10));
  for (let t = 0; t < turns && !g.over; t++)
    for (let s = 0; s < seats; s++)
      for (const m of botTurn(observe(g, s), s)) g = play(g, m, s);
  return g;
}

const noop = () => () => {};
export default function MetroLab() {
  // Client only: the bench reads the address bar.
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return client ? <Bench /> : null;
}

function Bench() {
  const [g, setG] = useState<MetroGame>(start);
  useEffect(() => {
    (window as unknown as { metroLab: unknown }).metroLab = {
      get: () => g,
      /** Let a bot draw your turn too. */
      auto: () =>
        setG((cur) => {
          let next = cur;
          for (const m of botTurn(observe(cur, 0), 0)) next = play(next, m, 0);
          return next;
        }),
      /** The moves a bot would make for your turn, without playing them. */
      plan: () => botTurn(observe(g, 0), 0),
      /** Play one move on your map, as a tap would. */
      play: (m: MetroMove) => setG((cur) => play(cur, m, 0)),
    };
  }, [g]);
  // Bots draw their turns as in a solo match.
  useEffect(() => {
    if (g.over) return;
    const bot = g.seats.findIndex((s) => s.bot && !s.locked);
    if (bot < 0) return;
    const t = setTimeout(() => {
      setG((cur) => {
        let next = cur;
        for (const m of botTurn(observe(cur, bot), bot)) next = play(next, m, bot);
        return next;
      });
    }, 60);
    return () => clearTimeout(t);
  }, [g]);
  const view = useMemo(() => observe(g, 0), [g]);
  return (
    <div className="app at-table metro">
      <MetroTable
        g={view}
        seat={0}
        onMove={(m) => setG((cur) => play(cur, m, 0))}
        onLeave={() => (window.location.href = '/')}
        onAgain={() => setG(() => start())}
        volume={0}
        onVolume={() => {}}
      />
    </div>
  );
}
