'use client';
import { useSyncExternalStore } from 'react';

/** Which candidate artwork a world shows. Remembered per browser and per game; a
 *  temporary review aid, harmless when only one variant is registered. */
const KEY = 'gamehub.observatory-variant.v1';
const keyFor = (game?: string) => (game && game !== 'wildgrove' ? `gamehub.art-variant.${game}.v1` : KEY);
const listeners = new Set<() => void>();
function read(game?: string) {
  try { return localStorage.getItem(keyFor(game)); } catch { return null; }
}
export function setArtVariant(id: string | null, game?: string) {
  try {
    if (id) localStorage.setItem(keyFor(game), id);
    else localStorage.removeItem(keyFor(game));
  } catch {}
  listeners.forEach((l) => l());
}
export function useArtVariant(game?: string): [string | null, (id: string | null) => void] {
  const value = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => read(game),
    () => null,
  );
  return [value, (id) => setArtVariant(id, game)];
}
