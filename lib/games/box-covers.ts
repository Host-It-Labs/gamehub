/** Dedicated square, full-bleed covers with titles generated into the artwork.
 * Keys are stable library IDs, not public game names. */
const coverSlugs: Record<string, string> = {
  undertow: 'nox',
  wildgrove: 'mora',
  midnight: 'yata',
  orin: 'know-me',
  miro: 'quiz',
  relic: 'lucky',
  folio: 'folio',
};

export function boxCover(id: string) {
  // Relic was renamed Lucky on 25 September 2026; the ID stays.
  if (id === 'relic') return '/art/optimized/box-lucky-v1.webp';
  // Yata's cover follows its flat toon table art (25 September 2026).
  if (id === 'midnight') return '/art/optimized/box-yata-toon-v1.webp';
  const slug = coverSlugs[id];
  const version = id === 'folio' ? 2 : 1;
  return slug ? `/art/optimized/box-${slug}-blind-v${version}.webp` : undefined;
}

/** Dedicated 3:1 covers for the setup lid, titles generated into the art.
 * Games without one fall back to their square cover. */
const wideCovers = new Set(Object.keys(coverSlugs));
export function wideCover(id: string) {
  return wideCovers.has(id)
    ? `/art/optimized/box-${coverSlugs[id]}-wide-v1.webp`
    : undefined;
}

export function printedBoxArt(id: string) {
  const cover = boxCover(id);
  return cover
    ? {
        cover,
        spine: cover.replace('.webp', '-spine.webp'),
        coverIncludesTitle: true,
      }
    : {};
}
