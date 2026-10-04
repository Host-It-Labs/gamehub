'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  createRota,
  observe,
  play,
  type Extension,
  type RotaGame,
} from '@/lib/games/rota/engine';
import { botRound } from '@/lib/games/rota/bot';
import { MAP_IDS, type MapId } from '@/lib/games/rota/maps';
import { RotaTable } from './rota-table';

/**
 * Dev-only bench at /rota/lab: a match on any map with any extensions,
 * fast-forwarded by bots playing your seat too, so the 3D board can be
 * checked full of routes. Query: ?map=harbour&rounds=4&ext=rivers,towns&seats=3.
 */
function start(): RotaGame {
  const q = new URLSearchParams(window.location.search);
  const map = (MAP_IDS as readonly string[]).includes(q.get('map') ?? '')
    ? (q.get('map') as MapId)
    : 'meadow';
  const ext = Object.fromEntries(
    (['rivers', 'plans', 'towns', 'rockfall'] as Extension[]).map((e) => [
      e,
      (q.get('ext') ?? '').split(',').includes(e),
    ]),
  ) as Record<Extension, boolean>;
  const seats = Math.max(1, Math.min(6, Number(q.get('seats') ?? 2)));
  let g = createRota(seats, Number(q.get('seed') ?? 7), {
    map,
    ext,
    difficulty: 'hard',
    bots: Array.from({ length: seats }, (_, i) => i > 0),
  });
  const rounds = Math.max(0, Number(q.get('rounds') ?? 3));
  for (let r = 0; r < rounds && !g.over; r++)
    for (let s = 0; s < seats; s++)
      for (const m of botRound(observe(g, s), s)) g = play(g, m, s);
  return g;
}

const noop = () => () => {};
export default function RotaLab() {
  // Client only: the bench reads the address bar.
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return client ? <Bench /> : null;
}

function Bench() {
  const [g, setG] = useState<RotaGame>(start);
  useEffect(() => {
    (window as unknown as { rotaLab: unknown }).rotaLab = {
      get: () => g,
      /** Let a bot build your round too. */
      auto: () =>
        setG((cur) => {
          let next = cur;
          for (const m of botRound(observe(cur, 0), 0)) next = play(next, m, 0);
          return next;
        }),
    };
  }, [g]);
  // Bots build their rounds as in a solo match.
  useEffect(() => {
    if (g.over) return;
    const bot = g.seats.findIndex((s) => s.bot && !s.locked);
    if (bot < 0) return;
    const t = setTimeout(() => {
      setG((cur) => {
        let next = cur;
        for (const m of botRound(observe(cur, bot), bot))
          next = play(next, m, bot);
        return next;
      });
    }, 60);
    return () => clearTimeout(t);
  }, [g]);
  const view = useMemo(() => observe(g, 0), [g]);
  return (
    <RotaTable
      g={view}
      seat={0}
      onMove={(m) => setG((cur) => play(cur, m, 0))}
      onLeave={() => (window.location.href = '/')}
      onAgain={() => setG(() => start())}
      volume={0}
      onVolume={() => {}}
    />
  );
}
