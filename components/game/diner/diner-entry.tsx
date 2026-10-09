'use client';
import type { ReactNode } from 'react';
import { DinerCampaign } from './diner-campaign';
import { DinerLevels } from './diner-levels';

/**
 * What Diner's box starts on this device: the campaign (a new run, or the
 * one under way), or free play's levels (the grid, or one level straight
 * away).
 */
export type DinerChoice = {
  mode: 'campaign' | 'levels';
  learn: boolean;
  /** Levels: open this one at once. */
  level?: number;
};

export default function DinerEntry({
  choice,
  volume,
  music,
  sound,
  onExit,
}: {
  choice: DinerChoice;
  volume: number;
  music: number;
  sound: ReactNode;
  onExit: () => void;
}) {
  if (choice.mode === 'campaign')
    return (
      <DinerCampaign
        volume={volume}
        music={music}
        sound={sound}
        onExit={onExit}
        learn={choice.learn}
      />
    );
  return (
    <DinerLevels
      volume={volume}
      music={music}
      sound={sound}
      onExit={onExit}
      learn={choice.learn}
      start={choice.level}
    />
  );
}
