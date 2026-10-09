/** Rendering only: quality never changes the board, buildings or traffic.
 * Ambient residents/birds and the glow filter reduce before gameplay detail. */
export type QualityTier = 'high' | 'balanced' | 'low';

export const qualityLevels = {
  high: {
    density: 3,
    pixels: 6_000_000,
    shadow: 4096,
    samples: 4,
    detail: 1,
    people: 28,
    birds: 8,
    glow: 1,
  },
  balanced: {
    density: 2,
    pixels: 3_000_000,
    shadow: 2048,
    samples: 2,
    detail: 0.65,
    people: 18,
    birds: 5,
    glow: 0.55,
  },
  low: {
    density: 1.25,
    pixels: 1_500_000,
    shadow: 1024,
    samples: 0,
    detail: 0.3,
    people: 10,
    birds: 0,
    glow: 0,
  },
} as const;
const tiers: QualityTier[] = ['high', 'balanced', 'low'];

/** A powerful device's top step: every display pixel, up to a 6K screen at
 *  full density (the shared cap in `components/game/render-quality.ts`). */
const NATIVE_PIXELS = 6144 * 3456;

/** Use the pixels a small display can show, with a cap on huge DPR buffers.
 * Never drop below one rendering pixel per CSS pixel. `native` (the high
 * tier on a powerful device) lifts the density and budget caps. */
export function renderDensity(
  tier: QualityTier,
  dpr: number,
  width: number,
  height: number,
  native = false,
) {
  const q = qualityLevels[tier];
  const top = native && tier === 'high';
  const pixels = top ? NATIVE_PIXELS : q.pixels;
  const budget = Math.sqrt(pixels / Math.max(1, width * height));
  return Math.max(1, Math.min(dpr || 1, top ? Infinity : q.density, budget));
}

/** Dense displays start with several pixels per CSS pixel. Reserve MSAA
 * for lower display densities instead of multiplying a retina HDR buffer.
 * Use display DPR so a quality reduction cannot switch multisampling on. */
export function renderSamples(
  tier: QualityTier,
  dpr: number,
  supported: number,
) {
  return dpr >= 1.75 ? 0 : Math.min(qualityLevels[tier].samples, supported);
}

/** Start at high detail on phones too. Ignore compilation/loading and hidden
 * pages; lower one level after sustained slow frames, and recover cautiously
 * after sustained headroom. Hysteresis prevents repeated quality changes.
 *
 * The device's power (`devicePower`) sets the start: a powerful one begins
 * at native density, a step above high that only lifts the pixel caps; a
 * weak one begins at balanced. */
export class AdaptiveQuality {
  tier: QualityTier = 'high';
  /** Drawing every display pixel at the high tier. */
  native = false;
  private canNative: boolean;
  private grace = 3;
  private slow = 0;
  private fast = 0;

  constructor(power: 'high' | 'mid' | 'low' = 'mid') {
    this.canNative = this.native = power === 'high';
    if (power === 'low') this.tier = 'balanced';
  }

  reset() {
    this.grace = 3;
    this.slow = this.fast = 0;
  }

  /** A lost GPU context may be memory pressure, before frames can adapt.
   * Restore with the smallest buffers, then let sustained headroom recover. */
  pressure() {
    this.tier = 'low';
    this.native = false;
    this.reset();
  }

  sample(frameMs: number): QualityTier | null {
    if (!Number.isFinite(frameMs) || frameMs <= 0) {
      this.reset();
      return null;
    }
    // One long stall cannot drive a downgrade, but consistently very slow
    // clients must still adapt. Hidden tabs and resizes reset explicitly.
    const dt = Math.min(frameMs, 250) / 1000;
    if (this.grace > 0) {
      this.grace -= dt;
      return null;
    }
    this.slow = frameMs > 25 ? this.slow + dt : Math.max(0, this.slow - dt * 2);
    this.fast = frameMs < 19 ? this.fast + dt : 0;
    // Steps: native (when the device may), then the tiers.
    const top = this.canNative ? -1 : 0;
    const at = this.native ? -1 : tiers.indexOf(this.tier);
    const to =
      this.slow > 2.5 && at < 2
        ? at + 1
        : this.fast > 12 && at > top
          ? at - 1
          : null;
    if (to === null) return null;
    this.native = to < 0;
    this.tier = tiers[Math.max(0, to)];
    this.reset();
    return this.tier;
  }
}
