'use client';
import { useEffect, useState, type RefObject } from 'react';
import { reelTier, type ReelTier } from '@/lib/games/library-reels';
import { devicePower, nativeRatio } from './render-quality';

/**
 * Whether a media query matches, kept current as it changes. Null until the
 * browser has answered, so nothing that depends on it (which clip to load,
 * whether to move at all) starts on a guess.
 */
export function useMedia(query: string) {
  const [matches, setMatches] = useState<boolean | null>(null);
  useEffect(() => {
    const list = matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener('change', sync);
    return () => list.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

/** Hover previews: a mouse, motion allowed and no data saver. */
export function usePreviews() {
  const hover = useMedia('(hover: hover) and (pointer: fine)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  return hover === true && reduced === false && !saveData();
}

const saveData = () =>
  typeof navigator !== 'undefined' &&
  !!(navigator as { connection?: { saveData?: boolean } }).connection
    ?.saveData;

const RANK: Record<ReelTier, number> = { '360': 0, '720': 1, full: 2 };

/**
 * The footage cut that covers `ref`'s box on this screen and device
 * (`reelTier`): the full-HD master on a big dense screen, a lighter cut on a
 * phone, a game card or a weak device. Null until measured. It only ever
 * grows for a shape, so a playing clip is never swapped for a worse one.
 */
export function useReelTier(
  ref: RefObject<HTMLElement | null>,
  shape: 'wide' | 'tall',
) {
  const [state, setState] = useState<{ shape: string; tier: ReelTier } | null>(
    null,
  );
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const next = reelTier(shape, r.width, r.height, nativeRatio(), {
        power: devicePower(),
        saveData: saveData(),
      });
      setState((was) =>
        was?.shape === shape && RANK[was.tier] >= RANK[next]
          ? was
          : { shape, tier: next },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, shape]);
  return state?.shape === shape ? state.tier : null;
}
