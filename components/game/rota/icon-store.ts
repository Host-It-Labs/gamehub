import type { PieceId } from '@/lib/games/rota/pieces';

/**
 * Pictures of each piece as a 3D tile (three/icons.ts), once the board has
 * rendered them. Kept apart from three.js so the drawn icons can read it
 * without loading the 3D code.
 */
const store = new Map<PieceId, string>();
const listeners = new Set<() => void>();

export const iconFor = (p: PieceId) => store.get(p);
export const iconVersion = () => store.size;
export function subscribeIcons(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function setIcon(p: PieceId, url: string) {
  store.set(p, url);
  for (const fn of listeners) fn();
}
