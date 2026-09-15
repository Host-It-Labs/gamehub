'use client';
import { useSyncExternalStore } from 'react';
import type { GameId } from '@/lib/games/trio/engine';

const changed = 'gamehub:advanced-view';
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(changed, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(changed, notify);
  };
}
export function useAdvancedView(game: GameId | undefined) {
  const key = `gamehub.advanced.${game}.v1`;
  const enabled = useSyncExternalStore(subscribe, () => {
    if (!game || game === 'undertow') return false;
    try { return localStorage.getItem(key) === 'true'; } catch { return false; }
  }, () => false);
  return [enabled, (value: boolean) => {
    if (!game || game === 'undertow') return;
    try { localStorage.setItem(key, String(value)); } catch { return; }
    window.dispatchEvent(new Event(changed));
  }] as const;
}
