/**
 * Diner's illustrated pictures (8 October 2026): sticker icons and the
 * places' postcards, cut from generated sheets by
 * `scripts/diner/slice-stickers.mjs` (sources and prompts in
 * docs/concepts/2026-10-08-diner-car/art).
 */
export const DINER_ICON_ART = [
  'burger',
  'shake',
  'fries',
  'pie',
  'burnt',
  'dirty',
  'coffee',
  'bell',
  'menu',
  'eat',
  'coin',
  'heart',
  'token',
  'fuel',
  'repair',
  'coins',
  'mop',
  'wash',
  'bin',
  'music',
  'skate',
  'tray',
  'tire',
  'dice',
  'map',
  'neon',
  'crate',
  'bolt',
  'clock',
  'eye',
  'star',
  'hand',
] as const;
export type DinerIconArt = (typeof DINER_ICON_ART)[number];
export const dinerIconUrl = (name: DinerIconArt) =>
  `/art/diner/icons/${name}.webp`;

export const DINER_PLACE_ART = [
  'truckstop',
  'drivein',
  'fairground',
  'harbour',
  'oldtown',
  'moonmile',
  'garage',
  'motel',
] as const;
export type DinerPlaceArt = (typeof DINER_PLACE_ART)[number];
export const dinerPlaceUrl = (name: DinerPlaceArt) =>
  `/art/diner/places/${name}.webp`;

export const dinerArtAssets = () => [
  ...DINER_ICON_ART.map(dinerIconUrl),
  ...DINER_PLACE_ART.map(dinerPlaceUrl),
];
