import type { Rung } from '../render-pacer';

/** Full geometry at every distance. Spend spare pixels on sharper shadows
 * when inspecting a machine. `pixelRatio` is the screen's native density:
 * dense screens draw all of it when there is room, and under load never
 * drop below 85% of the 2× the factory drew at before (nor below one
 * drawing pixel per CSS pixel). */
export function factoryQuality(pixelRatio: number, close: boolean): Rung[] {
  // Browser zoom can report DPR below one; the main renderer supersamples
  // those views to at least one drawing pixel per CSS pixel.
  pixelRatio = Math.max(1, pixelRatio || 1);
  const floor = Math.max(1, 0.85 * Math.min(pixelRatio, 2));
  const full = close ? 4096 : 2048;
  const rungs: Rung[] = [
    { resolution: 1, shadowEvery: 1, shadowSize: full },
    { resolution: 1, shadowEvery: 2, shadowSize: full },
    { resolution: 1, shadowEvery: 2, shadowSize: 2048 },
    { resolution: 0.92, shadowEvery: 2, shadowSize: 2048 },
    { resolution: 0.85, shadowEvery: 2, shadowSize: 2048 },
    { resolution: 0.72, shadowEvery: 2, shadowSize: 2048 },
    { resolution: 0.6, shadowEvery: 2, shadowSize: 2048 },
  ];
  const kept = rungs.filter((r) => r.resolution * pixelRatio >= floor - 0.001);
  return kept.filter(
    (r, i) =>
      i === 0 ||
      r.resolution !== kept[i - 1].resolution ||
      r.shadowSize !== kept[i - 1].shadowSize ||
      r.shadowEvery !== kept[i - 1].shadowEvery,
  );
}
