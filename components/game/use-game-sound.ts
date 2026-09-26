'use client';
import { useEffect } from 'react';
import { preloadGameSounds, stopGameSounds } from '@/lib/games/game-sound';

export function useGameSound(id: string | null | undefined, volume: number) {
  useEffect(() => {
    if (!id) return;
    if (volume > 0) preloadGameSounds(id);
    else stopGameSounds(id);
    return () => stopGameSounds(id);
  }, [id, volume]);
}
