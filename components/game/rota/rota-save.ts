import {
  isRotaGame,
  type Difficulty,
  type Extensions,
  type RotaGame,
} from '@/lib/games/rota/engine';
import type { MapId } from '@/lib/games/rota/maps';

/** Where a solo match waits between visits. */
export const ROTA_SAVE = 'gamehub.rota.v1';

export type RotaChoice = {
  map: MapId;
  ext: Extensions;
  difficulty: Difficulty;
  /** Everyone at the table, you included. */
  seats: number;
  learn?: boolean;
  resume?: boolean;
};

export function readRotaSave(): RotaGame | null {
  try {
    const raw = localStorage.getItem(ROTA_SAVE);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (isRotaGame(g) && !g.over) return g;
    localStorage.removeItem(ROTA_SAVE);
  } catch {
    // A broken or blocked save starts afresh.
  }
  return null;
}

export function writeRotaSave(g: RotaGame | null) {
  try {
    if (g && !g.over) localStorage.setItem(ROTA_SAVE, JSON.stringify(g));
    else localStorage.removeItem(ROTA_SAVE);
  } catch {
    // Saving is a convenience; play goes on without it.
  }
}
