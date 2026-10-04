'use client';
import { lazy, type ReactNode } from 'react';
import type { CardId } from '@/lib/games/arena/cards';
import type { Difficulty, Mode } from '@/lib/games/arena/engine';
import ArenaGame from './arena-game';

// The roguelite's screens load only when a quest opens.
const QuestSolo = lazy(() => import('./quest-solo'));

/** What Arena's box starts on this device: a Versus battle (your deck
 *  picked over the loading screen, or drafted), or a Quest, new or
 *  continued. */
export type ArenaChoice = {
  difficulty: Difficulty;
  mode: Mode;
  learn: boolean;
  deck?: CardId[];
  /** Versus: draft the decks instead of picking one. */
  draft?: boolean;
  quest?: 'new' | 'continue';
};

export default function ArenaEntry({
  choice,
  volume,
  music,
  sound,
  onExit,
}: {
  choice: ArenaChoice;
  volume: number;
  music: number;
  sound: ReactNode;
  onExit: () => void;
}) {
  if (choice.quest)
    return (
      <QuestSolo
        resume={choice.quest === 'continue'}
        volume={volume}
        music={music}
        sound={sound}
        onExit={onExit}
      />
    );
  return (
    <ArenaGame
      difficulty={choice.difficulty}
      mode={choice.mode}
      learn={choice.learn}
      setup={{ deck: choice.deck, decks: choice.draft ? 'draft' : 'pick' }}
      volume={volume}
      music={music}
      sound={sound}
      onExit={onExit}
    />
  );
}
