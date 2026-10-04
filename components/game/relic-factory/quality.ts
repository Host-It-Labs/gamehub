import type { Rung } from '../arena/pacer';

/** Full geometry at every distance. Spend spare pixels on sharper shadows
 * when inspecting a machine; under load preserve at least 85% of native
 * resolution (and never fewer than one drawing pixel per CSS pixel). */
export function factoryQuality(pixelRatio: number, close: boolean): Rung[] {
  // Browser zoom can report DPR below one; the main renderer supersamples
  // those views to at least one drawing pixel per CSS pixel.
  pixelRatio = Math.max(1, pixelRatio || 1);
  const full = close ? 4096 : 2048;
  const rungs: Rung[] = [
    { resolution: 1, shadowEvery: 1, shadowSize: full },
    { resolution: 1, shadowEvery: 2, shadowSize: full },
    { resolution: 1, shadowEvery: 2, shadowSize: 2048 },
    { resolution: 0.92, shadowEvery: 2, shadowSize: 2048 },
    { resolution: 0.85, shadowEvery: 2, shadowSize: 2048 },
  ];
  return rungs.filter(
    (r, i) =>
      r.resolution * pixelRatio >= 1 &&
      (i === 0 ||
        r.resolution !== rungs[i - 1].resolution ||
        r.shadowSize !== rungs[i - 1].shadowSize ||
        r.shadowEvery !== rungs[i - 1].shadowEvery),
  );
}
