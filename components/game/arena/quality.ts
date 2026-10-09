import { nativeRatio } from '../render-quality.ts';

/** Quality changes rendering cost, never the scene's art or model set. */
export type Quality = {
  tier: 'hq' | 'lite';
  shadowSize: number;
  pixelRatio: number;
  props: number;
};

/** The top rung is the screen's native density on every device. The frame
 * pacer starts a weaker device lower (`startLevel`), lowers shadows and
 * render resolution when needed, then recovers quality. Full-resolution
 * surface sources and identical scenery stay loaded. */
export function pickQuality(): Quality {
  return {
    tier: 'hq',
    shadowSize: 4096,
    pixelRatio: nativeRatio(),
    props: 1,
  };
}

/** Keep desktop at native density and dense screens at least 1.5×.
 * Frame pacing may reduce shadows, but never make a 1× canvas sub-native. */
export function resolutionFloor(pixelRatio: number) {
  return Math.min(1, 1.5 / pixelRatio);
}
