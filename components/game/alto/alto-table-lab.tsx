'use client';
import { useState } from 'react';
import { plans } from '@/lib/games/alto/content';
import { createAlto, play, type AltoMove } from '@/lib/games/alto/engine';
import { botMove } from '@/lib/games/alto/bot';
import { AltoTable } from './alto-table';

/** Dev-only ownership/framing fixtures. They never read or write match saves. */
export function AltoTableLab({ query }: { query: string }) {
  const [g, setGame] = useState(() => {
    const params = new URLSearchParams(query);
    const seats = Math.max(2, Math.min(6, Number(params.get('seats')) || 3));
    const game = createAlto(seats, 24, 'medium', {
      length: 'standard',
      plans: 'first',
      orders: params.has('orders'),
    });
    game.season = Math.max(1, Math.min(3, Number(params.get('year')) || 2)) as
      | 1
      | 2
      | 3;
    const built = params.get('built') ?? 'rigging,sawmill,shrine,beacon,post';
    const ids =
      built === 'all'
        ? plans.map((p) => p.id)
        : built === 'none'
          ? []
          : built.split(',');
    const known = new Set(plans.map((p) => p.id));
    game.players.forEach((player) => {
      player.built = [...new Set(ids.filter((id) => known.has(id)))];
      const level = Math.max(
        1,
        Math.min(game.season, Number(params.get('level')) || 1),
      );
      player.levels = Object.fromEntries(
        player.built.map((id) => [
          id,
          plans.find((p) => p.id === id)?.family === 'ship' ? level : 1,
        ]),
      );
      player.stock = [12, 12, 12, 12];
    });
    if (params.has('long'))
      game.seats = [
        'Alexandria',
        'Christopher',
        'Emmanuelle',
        'Maximilian',
        'Sebastian',
        'Valentina',
      ].slice(0, seats);
    return game;
  });
  const move = (action: AltoMove) =>
    setGame((current) => {
      let next = play(current, action, 0);
      if (action.type === 'choose' && !new URLSearchParams(query).has('wait'))
        for (let seat = 1; seat < next.players.length; seat++) {
          const choice = botMove(next, seat);
          if (choice) next = play(next, choice, seat);
        }
      return next;
    });
  return (
    <AltoTable
      g={g}
      viewer={0}
      volume={0}
      onMove={move}
      onLeave={() => history.back()}
    />
  );
}
