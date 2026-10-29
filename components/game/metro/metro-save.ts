import {
  isMetroGame,
  type Difficulty,
  type Extensions,
  type MetroGame,
} from '@/lib/games/metro/engine';

/** Where a solo match waits between visits. */
export const METRO_SAVE = 'gamehub.metro.v1';

export type MetroChoice = {
  ext: Extensions;
  difficulty: Difficulty;
  /** Everyone at the table, you included. */
  seats: number;
  learn?: boolean;
  resume?: boolean;
};

export function readMetroSave(): MetroGame | null {
  try {
    const raw = localStorage.getItem(METRO_SAVE);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (isMetroGame(g) && !g.over) return g;
    localStorage.removeItem(METRO_SAVE);
  } catch {
    // A broken or blocked save starts afresh.
  }
  return null;
}

export function writeMetroSave(g: MetroGame | null) {
  try {
    if (g && !g.over) localStorage.setItem(METRO_SAVE, JSON.stringify(g));
    else localStorage.removeItem(METRO_SAVE);
  } catch {
    // Saving is a convenience; play goes on without it.
  }
}
