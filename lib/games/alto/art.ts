import { plans, type Good } from './content.ts';

/** Alto artwork: the space set is v2; the attached hardware renders are v3.
 * See scripts/alto-art.mjs and scripts/alto-module-art.mjs. */
const art = (name: string) => `/art/optimized/${name}.webp`;
export const goodIds = ['food', 'metal', 'ice', 'crystal'] as const;
export const goodArt = (good: Good) => art(`alto-cargo-${goodIds[good]}-v2`);
/** Every upgrade is a live 3D object (components/game/alto/alto-ship.ts and
 *  the upgrade files beside it): ship parts bolt onto every ship that owns
 *  them, base modules are the building blocks of each player's base
 *  (alto-base.ts), and all of them stand in the shop. */
export const modelledPlans = plans.map((p) => p.id);
/** A still of a modelled upgrade (rendered from its 3D object), for the places
 *  that show a picture rather than the live object. */
export const moduleArtIds = plans
  .filter((p) => p.family === 'base' || p.id === 'windmill')
  .map((p) => p.id);
export const planArt = (id: string) =>
  modelledPlans.includes(id)
    ? art(`alto-upgrade-${id}-${moduleArtIds.includes(id) ? 'v3' : 'v2'}`)
    : null;
/** A still of a planet, rendered from its 3D model, for inspections. */
export const planetArt = (id: string) => art(`alto-planet-${id}-v2`);
export const captainArt = (id: string) => art(`alto-crew-${id}-v2`);
export const skyArt = {
  landscape: art('alto-space-landscape-v2'),
  landscapeSmall: art('alto-space-landscape-v2-768'),
  portrait: art('alto-space-portrait-v2'),
  portraitSmall: art('alto-space-portrait-v2-512'),
};
/** Every Alto image the game can show, for the production asset list. */
export function altoAssets(
  islandIds: string[],
  planIds: string[],
  captainIds: string[],
) {
  return [
    ...goodIds.map((_, k) => goodArt(k as Good)),
    ...islandIds.map(planetArt),
    ...planIds.flatMap((id) => planArt(id) ?? []),
    ...captainIds.map(captainArt),
    ...Object.values(skyArt),
  ];
}

/** Seat colours: each player's ship stripe, badge and flags. */
export const seatColours = [
  '#e0584c',
  '#2c9d98',
  '#dca128',
  '#7c63c8',
  '#3b8fd5',
  '#62a64b',
];
/** The three seasons of the rules are three years. */
export const seasonNames = ['Year 1', 'Year 2', 'Year 3'] as const;
