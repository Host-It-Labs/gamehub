/** Dedicated square, full-bleed covers with titles generated into the artwork.
 * Keys are stable library IDs, not public game names. */
const coverSlugs: Record<string, string> = {
  undertow: 'nox',
  wildgrove: 'mora',
  midnight: 'yata',
  orin: 'know-me',
  miro: 'quiz',
  relic: 'relic',
  folio: 'folio',
};

export function boxCover(id: string) {
  if (id === 'relic') return '/art/optimized/box-relic-scratch-v2.webp';
  const slug = coverSlugs[id];
  const version = id === 'midnight' || id === 'folio' ? 2 : 1;
  return slug ? `/art/optimized/box-${slug}-blind-v${version}.webp` : undefined;
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
