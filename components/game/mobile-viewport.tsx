'use client';
import { useEffect } from 'react';
import { Smartphone } from 'lucide-react';
import './mobile-viewport.css';

/** A phone: touch first, and a short side under 600 px. */
export const isPhone = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches &&
  Math.min(window.screen.width, window.screen.height) < 600;

let optedOut = false;
/** Leaving fullscreen from the menu is respected for the rest of the visit. */
export const optOutOfFullscreen = () => {
  optedOut = true;
};

/** Portrait lock only works in fullscreen on the browsers that support it. */
export async function lockPortrait() {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (mode: string) => Promise<void>;
  };
  try {
    await orientation?.lock?.('portrait');
  } catch {
    // Unsupported (iOS Safari, desktop): the rotate screen covers landscape.
  }
}

/**
 * Phones play full screen and upright (24 September 2026). Browsers only allow
 * fullscreen from a tap, so any tap while a game is open asks for it (and the
 * portrait lock) until the player leaves fullscreen from the menu. Where the
 * browser cannot lock, a landscape phone sees a rotate screen instead.
 */
export function MobileViewport() {
  useEffect(() => {
    const onTap = (event: MouseEvent) => {
      const target = event.target as Element | null;
      // The menu's own fullscreen toggle handles its tap.
      if (target?.closest?.('[data-fullscreen-toggle]')) return;
      if (optedOut || document.fullscreenElement || !isPhone()) return;
      // A game is open, or this tap starts one (setup Play / Continue).
      if (
        !document.querySelector(
          '.at-table, .folio-world, .relic-scratch-room',
        ) &&
        !target?.closest?.('[data-starts-game]')
      )
        return;
      const root = document.documentElement;
      if (!root.requestFullscreen) return;
      root
        .requestFullscreen({ navigationUI: 'hide' })
        .then(lockPortrait)
        .catch(() => {});
    };
    document.addEventListener('click', onTap, true);
    return () => document.removeEventListener('click', onTap, true);
  }, []);
  return (
    <div className="rotate-to-portrait" aria-live="polite">
      <Smartphone aria-hidden="true" />
      <p>Turn your phone upright to play</p>
    </div>
  );
}
