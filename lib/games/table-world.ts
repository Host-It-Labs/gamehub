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
  /** Yata: the wooden ledge in front of the counter where the hand lies. */
  ledge?: { left: number; top: number; width: number; height: number };
};
export type TableWorldGame = 'undertow' | 'midnight';
export type TableWorldVariant = {
  id: string; game: TableWorldGame; orientation: 'landscape' | 'portrait'; label: string;
  source: string; image: string; overviewImage: string;
};
const variants = registry as TableWorldVariant[];
const bases: Record<TableWorldGame, { landscape: TableWorld; portrait: TableWorld }> = {
  undertow: { landscape: noxLandscape as TableWorld, portrait: noxPortrait as TableWorld },
  // Yata has no seat ring or seats: its players hang in the pennant row, not on the counter rim.
  midnight: { landscape: yataLandscape as unknown as TableWorld, portrait: yataPortrait as unknown as TableWorld },
};
export const isTableWorldGame = (id: string): id is TableWorldGame => id === 'undertow' || id === 'midnight';

/** When a table world switches to its tall plate. Yata's landscape counter, menu
 *  boards and ledge only fill the screen above about 13:10, so squarish windows
 *  and tablets take the tall counter too; short landscape phones keep the wide
 *  plate with side rails. The CSS uses the same query (table-worlds.css §5). */
export const tallWorldQuery = (game?: string) =>
  game === 'midnight' ? '(orientation: portrait), (max-aspect-ratio: 13/10) and (min-height: 501px)' : '(orientation: portrait)';

/** Alternative renderings of the same measured geometry (candidate generations). */
export const tableWorldVariants = (game: TableWorldGame, tall = false): TableWorldVariant[] =>
  variants.filter((v) => v.game === game && v.orientation === (tall ? 'portrait' : 'landscape'));

const cache = new Map<string, TableWorld>();
/** Stable object identity per (game, orientation, variant), so scene effects keyed on it do not rerun. */
export function tableWorldFor(game: TableWorldGame, tall = false, variant?: string | null): TableWorld {
  const base = bases[game][tall ? 'portrait' : 'landscape'];
  const accepted = game === 'midnight' ? 'yata-counter-b' : variant;
  const v = accepted ? tableWorldVariants(game, tall).find((x) => x.id === accepted) : undefined;
  if (!v) return base;
  const key = `${game}:${tall ? 'p' : 'l'}:${v.id}`;
  let world = cache.get(key);
  if (!world) {
    world = { ...base, source: v.source, image: v.image, overviewImage: v.overviewImage };
    cache.set(key, world);
  }
  return world;
}

/** What must stay inside the safe stage: the table and, for Nox, the seat ring around it.
 *  Yata's wide plate also keeps its menu boards and the ledge the hand lies on. */
export function tableWorldPlayBox(art: TableWorld) {
  const ring = art.seatRing ?? art.table;
  if (!art.ledge) return { left: ring.left, top: ring.top, width: ring.width, height: ring.height };
  const boxes = [ring, art.ledge, ...(art.signboards ?? [])];
  const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width)), bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

export function tableWorldFrame(art: TableWorld, surface: { width: number; height: number }, safe?: Box) {
  const tall = art.height > art.width;
  // Card tables read best centred; the seat ring already carries its own air.
  // The ledge sits at the stage's lower edge, so it may not lean past it.
  return frameScene(art, tableWorldPlayBox(art), surface, safe, { lean: tall || art.ledge ? 0 : 0.05, air: 0, nudge: 0 });
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
