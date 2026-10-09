'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandaloneTable } from '../standalone-table';
import TriviaScene from './trivia-scene';
import { TriviaDebug } from './trivia-debug';
import { createTriviaLabGame } from './trivia-lab-game.ts';
import {
  standaloneGames,
  play,
  validMove,
  type AnyGame,
  type AnyMove,
} from '@/lib/games/standalone/registry';
import { places } from '@/lib/games/party/geography';
import { yearEvents, timeline } from '@/lib/games/party/year-events';
import { triviaOf, type TriviaMode } from '@/lib/games/party/trivia';

/** The review bench uses real engine moves, including all three prompts.
 * Its route is development-only; it is never a playable production match. */
function fixture(
  mode: TriviaMode,
  count: number,
  seats: number,
  final: boolean,
  long: boolean,
) {
  let g: AnyGame = standaloneGames.miro.create(
    seats,
    731,
    'medium',
    undefined,
    undefined,
    undefined,
    false,
    mode,
  );
  g.seats = (
    long
      ? [
          'Alexandria Montgomery',
          'Maximilien Alexander',
          'Charlotte Elizabeth',
          'Christopher Sebastian',
          'Anastasia Gabrielle',
          'Valentina Josephine',
        ]
      : ['Alex', 'Milo', 'Noor', 'Luna', 'Theo', 'Ines']
  ).slice(0, seats);
  const move = (m: AnyMove, seat = 0) => {
    if (!validMove(g, m, seat))
      throw new Error(
        `Invalid review move: ${g.kind}/${g.phase} ${m.type}, seat ${seat}`,
      );
    g = play(g, m, seat, 1000);
  };
  const routes = ['summit', 'river', 'trail'] as const;
  for (let round = 0; round < count; round++) {
    if (mode === 'expedition')
      for (let seat = 0; seat < seats; seat++)
        move(
          { type: 'trivia-plan', route: routes[seat % 3], purchase: null },
          seat,
        );
    move({
      type: 'vote',
      choice: (['miro', 'size', 'year', 'order'] as const)[round],
    });
    for (let seat = 0; seat < seats; seat++) {
      if (g.kind === 'miro') {
        for (let prompt = 0; prompt < 3; prompt++) {
          const place = places[g.cityIds[prompt]];
          move(
            {
              type: 'pin',
              prompt,
              lat: Math.min(85, place.lat + seat * 4),
              lng: place.lng,
            },
            seat,
          );
        }
        move({ type: 'lock' }, seat);
      } else if (g.kind === 'size') {
        move(
          {
            type: 'lock',
            values: g.questions.map((q) => q.answer * (1 + seat * 0.22)),
          },
          seat,
        );
      } else if (g.kind === 'year') {
        move(
          {
            type: 'lock',
            values: g.events.map((id) =>
              Math.min(timeline[1], yearEvents[id].year + seat * 5),
            ),
          },
          seat,
        );
      } else if (g.kind === 'order') {
        for (let step = 0; step < 3; step++)
          move(
            {
              type: 'arrange',
              step,
              order: seat % 2 ? [1, 0, 2, 3, 4] : [0, 1, 2, 3, 4],
            },
            seat,
          );
        move({ type: 'lock' }, seat);
      }
    }
    for (let step = 0; step < 4 && g.phase === 'reveal'; step++)
      move({ type: 'next' });
  }
  if (final && count === 4) move({ type: 'vote', choice: 'finish' });
  else if (mode === 'expedition' && count < 4)
    for (let seat = 1; seat < seats; seat++)
      move(
        { type: 'trivia-plan', route: routes[seat % 3], purchase: null },
        seat,
      );
  return g;
}

export default function TriviaLab() {
  const q = useSearchParams();
  const [debug, setDebug] = useState(q?.has('debug') ?? false);
  const [take, setTake] = useState(0);
  const [game, setGame] = useState<AnyGame>(() =>
    fixture(
      q?.get('mode') === 'expedition' ? 'expedition' : 'tower',
      Math.max(0, Math.min(4, Number(q?.get('completed') ?? 2))),
      Math.max(2, Math.min(6, Number(q?.get('players') ?? 4))),
      q?.has('final') ?? false,
      q?.has('long') ?? false,
    ),
  );
  if (q?.has('source')) {
    const view = q.get('view');
    const floors = Math.max(0, Math.min(25, Number(q.get('floors') ?? 5)));
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#e9e3d4' }}>
        <TriviaScene
          mode={q.get('mode') === 'expedition' ? 'expedition' : 'tower'}
          players={Array.from(
            { length: Math.max(1, Math.min(6, Number(q.get('players') ?? 1))) },
            () => ({
              floors,
              previousFloors: 0,
              distance: Number(q.get('distance') ?? 9),
              previousDistance: 6,
            }),
          )}
          animate={q.has('motion')}
          source={!q.has('runtime')}
          review={
            view === 'front' ||
            view === 'side' ||
            view === 'rear' ||
            view === 'clay'
              ? view
              : undefined
          }
        />
      </div>
    );
  }
  return (
    <>
      <StandaloneTable
        key={take}
        g={game}
        online
        viewerSeat={0}
        hostSeat={0}
        volume={0}
        onDebug={() => setDebug(true)}
        animateTriviaResults
        onHome={() => window.location.assign('/')}
        onMove={(move) => setGame((g) => play(g, move, 0, 1000))}
        onNew={() =>
          setGame(
            createTriviaLabGame(
              triviaOf(game)!.mode === 'expedition' ? 'expedition' : 'tower',
              game.seats.length,
            ),
          )
        }
      />
      <TriviaDebug
        game={game}
        open={debug}
        onOpenChange={setDebug}
        onGame={setGame}
        onReplay={() => setTake((n) => n + 1)}
      />
    </>
  );
}
