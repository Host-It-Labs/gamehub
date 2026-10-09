import { useEffect } from 'react';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import type { ContentSet, GameId as TrioGameId } from '@/lib/games/trio/engine';
type GameId =
  | TrioGameId
  | 'orin'
  | 'miro'
  | 'dial'
  | 'size'
  | 'coins'
  | 'year'
  | 'order'
  | 'impostor';
import { pauseAmbienceWhenHidden, startAmbience, stopAmbience } from '@/lib/games/ambience-player';

export const AMBIENCE_KEY = 'gamehub.ambience.v1';
export const DEFAULT_AMBIENCE = 0.6;
export function readAmbienceLevel() {
  return readAudioLevel(AMBIENCE_KEY, DEFAULT_AMBIENCE);
}
export function saveAmbienceLevel(level: number) {
  saveAudioLevel(level, AMBIENCE_KEY);
}

/** Keeps the world's soundscape running while a table is open; silent when either level is zero. */
export function useAmbience(id: GameId | null | undefined, volume: number, level: number, contentSet?: ContentSet) {
  const effective = volume * level;
  // Starting an already running world only adjusts its level, so this is safe to re-run.
  useEffect(() => {
    startAmbience(id, effective, contentSet);
  }, [id, effective, contentSet]);
  useEffect(() => {
    const release = pauseAmbienceWhenHidden();
    return () => {
      release();
      stopAmbience();
    };
  }, []);
}
