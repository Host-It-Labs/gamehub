import noxLandscape from './nox-world-landscape.json' with { type: 'json' };
import noxPortrait from './nox-world-portrait.json' with { type: 'json' };
import yataLandscape from './yata-world-landscape.json' with { type: 'json' };
import yataPortrait from './yata-world-portrait.json' with { type: 'json' };
import registry from './table-world-variants.json' with { type: 'json' };
import { frameScene, sceneTarget, type Box } from './mora-world.ts';

/** A full-table environment plate for a card game: the painted table (or
 *  counter) is the only playable landmark; everything else is expendable scenery. */
export type TableWorld = typeof noxLandscape & {
  seatRing?: { left: number; top: number; width: number; height: number };
  signboards?: { left: number; top: number; width: number; height: number }[];
};
export type TableWorldGame = 'undertow' | 'midnight';
export type TableWorldVariant = {
  id: string; game: TableWorldGame; orientation: 'landscape' | 'portrait'; label: string;
  source: string; image: string; overviewImage: string;
};
const variants = registry as TableWorldVariant[];
const bases: Record<TableWorldGame, { landscape: TableWorld; portrait: TableWorld }> = {
  undertow: { landscape: noxLandscape as TableWorld, portrait: noxPortrait as TableWorld },
  midnight: { landscape: yataLandscape as TableWorld, portrait: yataPortrait as TableWorld },
};
export const isTableWorldGame = (id: string): id is TableWorldGame => id === 'undertow' || id === 'midnight';

/** Alternative renderings of the same measured geometry (candidate generations). */
export const tableWorldVariants = (game: TableWorldGame, tall = false): TableWorldVariant[] =>
  variants.filter((v) => v.game === game && v.orientation === (tall ? 'portrait' : 'landscape'));

const cache = new Map<string, TableWorld>();
/** Stable object identity per (game, orientation, variant), so scene effects keyed on it do not rerun. */
export function tableWorldFor(game: TableWorldGame, tall = false, variant?: string | null): TableWorld {
  const base = bases[game][tall ? 'portrait' : 'landscape'];
  const v = variant ? tableWorldVariants(game, tall).find((x) => x.id === variant) : undefined;
  if (!v) return base;
  const key = `${game}:${tall ? 'p' : 'l'}:${v.id}`;
  let world = cache.get(key);
  if (!world) {
    world = { ...base, source: v.source, image: v.image, overviewImage: v.overviewImage };
    cache.set(key, world);
  }
  return world;
}

/** What must stay inside the safe stage: the table and, for Nox, the seat ring around it. */
export function tableWorldPlayBox(art: TableWorld) {
  const ring = art.seatRing ?? art.table;
  return { left: ring.left, top: ring.top, width: ring.width, height: ring.height };
}

export function tableWorldFrame(art: TableWorld, surface: { width: number; height: number }, safe?: Box) {
  const tall = art.height > art.width;
  // Card tables read best centred; the seat ring already carries its own air.
  return frameScene(art, tableWorldPlayBox(art), surface, safe, { lean: tall ? 0 : 0.05, air: 0, nudge: 0 });
}

export const tableWorldTarget = (art: TableWorld, board: { x: number; y: number; width: number }) => sceneTarget(art, board);

/** A source box expressed as percentages of the gameplay crop, for absolutely positioned DOM. */
export function cropPercent(art: { crop: TableWorld['crop'] }, box: { left: number; top: number; width: number; height: number }) {
  const c = art.crop;
  return {
    left: `${((box.left - c.left) / c.width) * 100}%`,
    top: `${((box.top - c.top) / c.height) * 100}%`,
    width: `${(box.width / c.width) * 100}%`,
    height: `${(box.height / c.height) * 100}%`,
  };
}
