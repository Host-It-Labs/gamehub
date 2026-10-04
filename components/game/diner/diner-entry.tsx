'use client';
import { useState, type ReactNode } from 'react';
import type { NightId } from '@/lib/games/diner/content';
import DinerGame from './diner-game';
import { rememberNight } from './diner-store';
import { SoloSession } from './session';

/** What Diner's box starts on this device. */
export type DinerChoice = { night: NightId; learn: boolean };

/** A solo shift: you and the diner, for one night at a time. */
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
  const [session] = useState(() => new SoloSession(choice.night));
  return (
    <DinerGame
      session={session}
      volume={volume}
      music={music}
      sound={sound}
      learn={choice.learn}
      onExit={onExit}
      onNight={rememberNight}
    />
  );
}
