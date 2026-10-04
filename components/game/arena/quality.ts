/** Quality changes rendering cost, never the scene's art or model set. */
export type Quality = {
  tier: 'hq' | 'lite';
  shadowSize: number;
  pixelRatio: number;
  props: number;
};

/** Start at native screen density on every device. The measured frame pacer
 * lowers shadows and render resolution when needed, then recovers quality.
 * Full-resolution surface sources and identical scenery stay loaded. */
export function pickQuality(): Quality {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return {
    tier: 'hq',
    shadowSize: 4096,
    pixelRatio: Math.min(dpr, 3),
    props: 1,
  };
}

/** Keep desktop at native density and dense screens at least 1.5×.
 * Frame pacing may reduce shadows, but never make a 1× canvas sub-native. */
export function resolutionFloor(pixelRatio: number) {
  return Math.min(1, 1.5 / pixelRatio);
}
