import { useEffect } from 'react';
import type { GameId as TrioGameId } from '@/lib/games/trio/engine';
type GameId = TrioGameId | 'orin' | 'miro';
import { pauseAmbienceWhenHidden, startAmbience, stopAmbience } from '@/lib/games/ambience-player';

export const AMBIENCE_KEY = 'gamehub.ambience.v1';
export const DEFAULT_AMBIENCE = 0.6;
export function readAmbienceLevel() {
  try {
    const v = Number(localStorage.getItem(AMBIENCE_KEY) ?? String(DEFAULT_AMBIENCE));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_AMBIENCE;
  } catch {
    return DEFAULT_AMBIENCE;
  }
}
export function saveAmbienceLevel(level: number) {
  try {
    localStorage.setItem(AMBIENCE_KEY, String(level));
  } catch {
    /* Storage may be unavailable. */
  }
}

/** Keeps the world's soundscape running while a table is open; silent when either level is zero. */
export function useAmbience(id: GameId | null | undefined, volume: number, level: number, contentSet?: 'beginner' | 'intermediate') {
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
