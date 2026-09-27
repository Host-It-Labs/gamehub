import { isPhone } from '../mobile-viewport';

/** How much the device draws; kept free of three.js so the setup box stays light. */
export type Quality = {
  tier: 'hq' | 'lite';
  shadowSize: number;
  pixelRatio: number;
  /** Scenery density, 1 on desktops. */
  props: number;
};

/**
 * Every device starts at its best: phones at their screen's full density
 * with desktop-size shadow maps, and the pacer (pacer.ts) steps down only as
 * far as frames slip on that device, climbing back when there is room.
 * Phones keep the 1024 tiles, whose texels still outnumber the screen's
 * pixels at phone size, and a few fewer props (they never see the valley's
 * sides).
 */
export function pickQuality(): Quality {
  const small =
    isPhone() ||
    (typeof window !== 'undefined' &&
      Math.min(window.screen.width, window.screen.height) < 700 &&
      window.matchMedia('(pointer: coarse)').matches);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return small
    ? {
        tier: 'lite',
        shadowSize: 4096,
        pixelRatio: Math.min(dpr, 3),
        props: 0.75,
      }
    : { tier: 'hq', shadowSize: 4096, pixelRatio: Math.min(dpr, 2), props: 1 };
}
