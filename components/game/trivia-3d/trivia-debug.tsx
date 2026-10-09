'use client';

import { useState } from 'react';
import {
  Blocks,
  Map,
  FastForward,
  RotateCcw,
  Play,
  Trophy,
} from 'lucide-react';
import type { AnyGame } from '@/lib/games/standalone/registry';
import {
  campReady,
  triviaOf,
  triviaRoutes,
  type TriviaRoute,
} from '@/lib/games/party/trivia';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  createTriviaLabGame,
  simulateTriviaLabRound,
  finishTriviaLabGame,
} from './trivia-lab-game.ts';
import './trivia-debug.css';

type Scores = 'mixed' | 'perfect' | 'miss';

export function TriviaDebug({
  game,
  open,
  onOpenChange,
  onGame,
  onReplay,
}: {
  game: AnyGame;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGame: (game: AnyGame) => void;
  onReplay: () => void;
}) {
  const [scores, setScores] = useState<Scores>('mixed');
  const [route, setRoute] = useState<TriviaRoute>('summit');
  const trivia = triviaOf(game)!;
  const mode = trivia.mode === 'expedition' ? 'expedition' : 'tower';
  const lockedRoutes =
    trivia.stage === 'camp' && campReady(game) && trivia.completed < 4;
  const points = game.seats.map((_, seat): 0 | 150 | 300 =>
    scores === 'perfect'
      ? 300
      : scores === 'miss'
        ? 0
        : ([300, 150, 0] as const)[seat % 3],
  );
  const apply = (next: AnyGame) => {
    onOpenChange(false);
    onGame(next);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="trivia-debug"
        finalFocus={() =>
          document.querySelector<HTMLButtonElement>('[aria-label="Game menu"]')
        }
      >
        <DialogTitle>Debug</DialogTitle>
        <DialogDescription>
          Test the 3D worlds without answering trivia.
        </DialogDescription>
        <div className="trivia-debug-modes" aria-label="Test mode">
          {(['tower', 'expedition'] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => {
                if (id !== mode)
                  onGame(createTriviaLabGame(id, game.seats.length));
              }}
            >
              {id === 'tower' ? (
                <Blocks aria-hidden="true" />
              ) : (
                <Map aria-hidden="true" />
              )}
              {id === 'tower' ? 'Tower' : 'Expedition'}
            </button>
          ))}
        </div>
        <div className="trivia-debug-settings">
          <label>
            Players
            <select
              value={game.seats.length}
              onChange={(event) =>
                onGame(createTriviaLabGame(mode, Number(event.target.value)))
              }
            >
              {[2, 3, 4, 5, 6].map((count) => (
                <option value={count} key={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scores
            <select
              value={scores}
              onChange={(event) => setScores(event.target.value as Scores)}
            >
              <option value="mixed">Mixed: 300 / 150 / 0</option>
              <option value="perfect">Everyone: 300</option>
              <option value="miss">Everyone: 0</option>
            </select>
          </label>
          {mode === 'expedition' && (
            <label>
              Route
              <select
                value={lockedRoutes ? 'locked' : route}
                disabled={lockedRoutes}
                onChange={(event) =>
                  setRoute(event.target.value as TriviaRoute)
                }
              >
                {lockedRoutes && (
                  <option value="locked">Current locked routes</option>
                )}
                {triviaRoutes.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <output aria-label="Completed rounds">{trivia.completed} / 4</output>
        </div>
        <div className="trivia-debug-actions">
          <button
            type="button"
            className="trivia-debug-primary"
            disabled={game.over || trivia.completed === 4}
            onClick={() => apply(simulateTriviaLabRound(game, points, route))}
          >
            <FastForward aria-hidden="true" />
            Simulate round
          </button>
          <button
            type="button"
            disabled={game.over}
            onClick={() => apply(finishTriviaLabGame(game, points, route))}
          >
            <Trophy aria-hidden="true" />
            Results
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onReplay();
            }}
          >
            <Play aria-hidden="true" />
            Replay animation
          </button>
          <button
            type="button"
            onClick={() => onGame(createTriviaLabGame(mode, game.seats.length))}
          >
            <RotateCcw aria-hidden="true" />
            Restart
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
