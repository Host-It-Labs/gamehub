/**
 * Gameplay footage for the library: a short silent loop of each game playing
 * itself with its interface hidden, recorded by `scripts/reels/record.mjs`.
 * Wide clips are filmed on a desktop screen, tall ones on a phone, so each
 * device sees the game as it would play it there. Each clip has a still of
 * its first frame that shows while the clip loads.
 */
export type Reel = {
  wide: string;
  tall: string;
  wideStill: string;
  tallStill: string;
};

/** Each clip comes in three cuts (`scripts/reels/tiers.mjs`): the full-HD
 *  master and lighter 720p and 360p copies. */
export type ReelTier = 'full' | '720' | '360';

/** Pixels along each cut's long edge. */
const LONG_EDGE: Record<ReelTier, number> = {
  full: 1920,
  '720': 1280,
  '360': 640,
};

/**
 * The lightest cut that still covers a box `width`×`height` CSS pixels on a
 * `dpr` screen, the clip filling it edge to edge (object-fit: cover). A cut
 * may be stretched by up to a sixth before the next one up is worth it. A
 * weak device stops at 720p; data saver takes the smallest.
 */
export function reelTier(
  shape: 'wide' | 'tall',
  width: number,
  height: number,
  dpr: number,
  opts: { power?: 'high' | 'mid' | 'low'; saveData?: boolean } = {},
): ReelTier {
  if (opts.saveData) return '360';
  // Cover: the clip's long edge spans the box's long side, or more.
  const aspect = 16 / 9;
  const long =
    shape === 'wide'
      ? Math.max(width, height * aspect)
      : Math.max(height, width * aspect);
  const need = long * Math.max(1, dpr || 1);
  const pick: ReelTier =
    need <= LONG_EDGE['360'] * 1.15
      ? '360'
      : need <= LONG_EDGE['720'] * 1.15
        ? '720'
        : 'full';
  return opts.power === 'low' && pick === 'full' ? '720' : pick;
}

/** The file for one shape and cut of a reel. */
export const reelSource = (
  reel: Reel,
  shape: 'wide' | 'tall',
  tier: ReelTier,
) => {
  const master = reel[shape];
  return tier === 'full' ? master : master.replace(/\.mp4$/, `-${tier}.mp4`);
};

/** Every cut of a reel, for the asset allowlist. */
const cuts = (reel: Reel) =>
  (['wide', 'tall'] as const).flatMap((shape) =>
    (['720', '360'] as const).map((tier) => reelSource(reel, shape, tier)),
  );

/** Games with recorded footage; any other game shows its cover. */
const filmed: readonly string[] = [
  'arena',
  'undertow',
  'wildgrove',
  'midnight',
  'folio',
  'relic',
  'rota',
  'alto',
  'diner',
  'impostor',
  'orin',
  'miro',
];

const reel = (id: string): Reel => ({
  wide: `/reels/${id}-wide.mp4`,
  tall: `/reels/${id}-tall.mp4`,
  wideStill: `/reels/${id}-wide.jpg`,
  tallStill: `/reels/${id}-tall.jpg`,
});

export const reelFor = (id: string): Reel | undefined =>
  filmed.includes(id) ? reel(id) : undefined;

/** Every served footage file, for the production asset allowlist. */
export const reelAssets = () =>
  filmed.flatMap((id) => [...Object.values(reel(id)), ...cuts(reel(id))]);

/**
 * Whether a refused `play()` means the footage won't play here: the browser
 * blocks autoplay, or can't play the file. A request that a pause or a new
 * source interrupted (an AbortError) says nothing about the footage.
 */
export const playRefused = (error: unknown) =>
  (error as { name?: unknown } | null)?.name !== 'AbortError';
