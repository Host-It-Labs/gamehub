/** Dedicated square, full-bleed covers with titles generated into the artwork.
 * Keys are stable library IDs, not public game names. */
const coverSlugs: Record<string, string> = {
  undertow: 'nox',
  wildgrove: 'mora',
  midnight: 'yata',
  orin: 'know-me',
  miro: 'trivia',
  relic: 'lucky',
  // Folio's public name is Puzzles since 9 October 2026; the ID stays.
  folio: 'puzzles',
  arena: 'arena',
  rota: 'rota',
  metro: 'metro',
  alto: 'alto',
  impostor: 'impostor',
  diner: 'diner',
};

/** Cover versions other than 1, shared by the square and the wide cover. */
const coverVersions: Record<string, number> = {
  undertow: 2,
  // Arena v3 (10 October 2026): cartoon covers matching the v14 card set.
  arena: 3,
  alto: 2,
  // Rota v5 (10 October 2026): laying streets and rails, drawn as the game's
  // own pieces in soft daylight, the title made of them (v3 dusk, v4 vivid).
  rota: 5,
  diner: 4,
};

export function boxCover(id: string) {
  // Relic was renamed Lucky on 25 September 2026; the ID stays.
  if (id === 'relic') return '/art/optimized/box-lucky-v1.webp';
  // Yata's cover follows its flat toon table art (25 September 2026).
  if (id === 'midnight') return '/art/optimized/box-yata-toon-v1.webp';
  // Mora's cover shows the game's own world and animals (27 September 2026).
  if (id === 'wildgrove') return '/art/optimized/box-mora-game-v2.webp';
  const slug = coverSlugs[id];
  // Nox moved to its flat treasure-map poster cover on 26 September 2026;
  // Arena to cartoon covers matching its loading screen on 1 October 2026;
  // Alto to its space covers on 2 October 2026.
  // Puzzles, Rota (its mill town) and Diner (the diner car and its server)
  // got fresh covers on 9 October 2026; Diner again on 10 October 2026, its
  // server a young man with only a light softness.
  return slug ? `/art/optimized/box-${slug}-blind-v${coverVersions[id] ?? 1}.webp` : undefined;
}

/** Dedicated 3:1 covers for the setup lid, titles generated into the art.
 * Games without one fall back to their square cover. */
const wideCovers = new Set(Object.keys(coverSlugs));
export function wideCover(id: string) {
  if (id === 'wildgrove') return '/art/optimized/box-mora-game-wide-v2.webp';
  return wideCovers.has(id)
    ? `/art/optimized/box-${coverSlugs[id]}-wide-v${coverVersions[id] ?? 1}.webp`
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
