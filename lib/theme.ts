import { useSyncExternalStore } from 'react';
import { DARK_QUERY as QUERY, THEME_KEY as KEY } from './theme-script';

/**
 * Light or dark for the menus (library, tables, setup). Games keep their own
 * worlds. The page follows the system until the player picks the other look;
 * picking the look the system already has goes back to following it.
 */
export type Theme = 'light' | 'dark';

function chosen(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}
function system(): Theme {
  return matchMedia(QUERY).matches ? 'dark' : 'light';
}
export function currentTheme(): Theme {
  return chosen() ?? system();
}

const listeners = new Set<() => void>();
let listeningMedia: MediaQueryList | undefined;
function sync() {
  document.documentElement.dataset.theme = currentTheme();
}
function apply() {
  sync();
  for (const listener of listeners) listener();
}
export function setTheme(theme: Theme) {
  try {
    if (theme === system()) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* Preference is optional. */
  }
  apply();
}

function onStorage(event: StorageEvent) {
  if (event.key === KEY) apply();
}
function subscribe(listener: () => void) {
  if (!listeners.size) {
    listeningMedia = matchMedia(QUERY);
    listeningMedia.addEventListener('change', apply);
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  sync();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    listeningMedia?.removeEventListener('change', apply);
    listeningMedia = undefined;
    window.removeEventListener('storage', onStorage);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light');
}
