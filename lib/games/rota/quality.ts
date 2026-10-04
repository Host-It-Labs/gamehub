/** Rendering only: quality never changes the board, scenery or simulation. */
export type QualityTier = 'high' | 'balanced' | 'low';

export const qualityLevels = {
  high: { density: 3, pixels: 6_000_000, shadow: 4096, samples: 4, detail: 1 },
  balanced: {
    density: 2,
    pixels: 3_000_000,
    shadow: 2048,
    samples: 2,
    detail: 0.65,
  },
  low: {
    density: 1.25,
    pixels: 1_500_000,
    shadow: 1024,
    samples: 0,
    detail: 0.3,
  },
} as const;
const tiers: QualityTier[] = ['high', 'balanced', 'low'];

/** Use the pixels a small display can show, with a cap on huge DPR buffers.
 * Never drop below one rendering pixel per CSS pixel. */
export function renderDensity(
  tier: QualityTier,
  dpr: number,
  width: number,
  height: number,
) {
  const q = qualityLevels[tier];
  const budget = Math.sqrt(q.pixels / Math.max(1, width * height));
  return Math.max(1, Math.min(dpr || 1, q.density, budget));
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
 * after sustained headroom. Hysteresis prevents repeated quality changes. */
export class AdaptiveQuality {
  tier: QualityTier = 'high';
  private grace = 3;
  private slow = 0;
  private fast = 0;

  reset() {
    this.grace = 3;
    this.slow = this.fast = 0;
  }

  /** A lost GPU context may be memory pressure, before frames can adapt.
   * Restore with the smallest buffers, then let sustained headroom recover. */
  pressure() {
    this.tier = 'low';
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
    const at = tiers.indexOf(this.tier);
    const next =
      this.slow > 2.5 && at < 2
        ? tiers[at + 1]
        : this.fast > 12 && at > 0
          ? tiers[at - 1]
          : null;
    if (next) {
      this.tier = next;
      this.reset();
    }
    return next;
  }
}
