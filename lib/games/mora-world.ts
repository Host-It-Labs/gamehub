import landscape from './observatory-art.json' with { type: 'json' };
import portrait from './observatory-portrait-art.json' with { type: 'json' };
import registry from './observatory-variants.json' with { type: 'json' };
export type PaperWorld = typeof landscape;
export type PaperWorldVariant = {
  id: string; orientation: 'landscape' | 'portrait'; label: string;
  source: string; image: string; boardImage: string; overviewImage: string;
};
const variants = registry as PaperWorldVariant[];
/** Alternative renderings of the same measured geometry (candidate generations). */
export const paperWorldVariants = (tall = false): PaperWorldVariant[] =>
  variants.filter((v) => v.orientation === (tall ? 'portrait' : 'landscape'));
const variantWorlds = new Map<string, PaperWorld>();
/** Stable object identity per (orientation, variant), so scene effects keyed on it do not rerun. */
export function paperWorldFor(tall = false, variant?: string | null): PaperWorld {
  const base = tall ? portrait : landscape;
  const v = variant ? paperWorldVariants(tall).find((x) => x.id === variant) : undefined;
  if (!v) return base;
  const key = `${tall ? 'p' : 'l'}:${v.id}`;
  let world = variantWorlds.get(key);
  if (!world) {
    world = { ...base, source: v.source, image: v.image, boardImage: v.boardImage, overviewImage: v.overviewImage };
    variantWorlds.set(key, world);
  }
  return world;
}

export type Box = { x: number; y: number; width: number; height: number };
type Range = [number, number];
const intersect = (a: Range, b: Range): Range => [Math.max(a[0], b[0]), Math.min(a[1], b[1])];
const clamp = (v: number, [lo, hi]: Range) => Math.max(lo, Math.min(hi, v));

/** The smallest source box holding every pad, label, standee and Release.
 *  This, not the looser crop, is what must stay clear of the UI bands. */
export function paperWorldPlayBox(art: PaperWorld) {
  const xs: number[] = [], ys: number[] = [];
  for (const h of art.habitats) {
    const [x, y, w, hh] = h.bounds;
    xs.push(x, x + w, h.label[0] - 90, h.label[0] + 90); ys.push(y, y + hh, h.label[1] + 28);
    for (const [sx, sy] of h.slots) { xs.push(sx - h.tokenWidth / 2, sx + h.tokenWidth / 2); ys.push(sy - h.tokenWidth * 0.7, sy + h.tokenWidth * 0.4); }
  }
  xs.push(art.release[0] - 60, art.release[0] + 60); ys.push(art.release[1] - 25, art.release[1] + 25);
  const left = Math.min(...xs), top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/** The geometry any full-table scene needs: source size, gameplay crop and complete landmarks. */
export type SceneArt = {
  width: number; height: number;
  crop: { left: number; top: number; width: number; height: number };
  landmarks: { protectedBounds: { name: string; bounds: number[] }[] };
};
export type PlayBox = { left: number; top: number; width: number; height: number };

/**
 * Places one uniformly scaled scene on the whole table surface.
 * Hard rule: the play box (pads, labels, Release; or a table with its seats) stays inside the safe stage.
 * Preferred: the scenery covers the entire surface, eating into the outer scenery.
 * Then: complete landmarks stay visible, and the crop is centered in the stage.
 * Returns the crop's position relative to the surface, plus the full image box.
 */
export function frameScene(
  art: SceneArt,
  box: PlayBox,
  surface: { width: number; height: number },
  safe?: Box,
  options: { lean?: number; air?: number; nudge?: number } = {},
) {
  const c = art.crop;
  const W = Math.max(1, surface.width), H = Math.max(1, surface.height);
  const given = safe ?? { x: 0, y: 0, width: W, height: H };
  // The stage's vertical edges are reserves with their own gaps, so the play
  // box may lean a little into each of them: a 16:9 screen then covers at 100% zoom.
  const tall = art.height > art.width;
  const lean = Math.max(1, given.height) * (options.lean ?? (tall ? 0 : 0.06));
  const stage = { ...given, y: given.y - lean, height: given.height + 2 * lean };
  const sw = Math.max(1, stage.width), sh = Math.max(1, stage.height);
  const air = box.width * (options.air ?? (tall ? 0.03 : 0));
  const play = { left: box.left - air, top: box.top, width: box.width + 2 * air, height: box.height };
  const fit = Math.min(sw / play.width, sh / play.height);
  const cover = Math.max(W / art.width, H / art.height);
  const scale = Math.max(1e-3, Math.min(fit, cover));
  const boxes = art.landmarks.protectedBounds.map((l) => l.bounds);
  const marks = {
    left: Math.min(...boxes.map((b) => b[0])),
    top: Math.min(...boxes.map((b) => b[1])),
    right: Math.max(...boxes.map((b) => b[0] + b[2])),
    bottom: Math.max(...boxes.map((b) => b[1] + b[3])),
  };
  const axis = (
    size: number, stageStart: number, stageSize: number,
    cropStart: number, cropSize: number, artSize: number,
    markStart: number, markEnd: number, bias = 0,
  ) => {
    // Feasible image origins, from the hard crop rule down to soft preferences.
    let range: Range = [
      stageStart - cropStart * scale,
      stageStart + stageSize - (cropStart + cropSize) * scale,
    ];
    const soft: Range[] = [
      [size - artSize * scale, 0],
      [size - markEnd * scale, -markStart * scale],
    ];
    for (const s of soft) {
      const i = intersect(range, s);
      if (i[0] <= i[1] + 1e-9) range = i;
    }
    // Prefer the centred position, but stay as close to full coverage as the
    // hard rule allows: a sub-pixel shortfall must not become a visible band.
    let preferred = stageStart + (stageSize - cropSize * scale) / 2 - cropStart * scale + bias;
    if (soft[0][0] <= soft[0][1]) preferred = clamp(preferred, soft[0]);
    // When the scene is narrower than the surface, centre it so any margin is symmetric.
    else preferred = (size - artSize * scale) / 2;
    return clamp(preferred, range);
  };
  const nudge = options.nudge ?? (tall ? -0.03 : 0);
  const ix = axis(W, stage.x, sw, play.left, play.width, art.width, marks.left, marks.right, nudge * W);
  const iy = axis(H, stage.y, sh, play.top, play.height, art.height, marks.top, marks.bottom);
  const image = { x: ix, y: iy, width: art.width * scale, height: art.height * scale };
  return {
    scale,
    x: ix + c.left * scale,
    y: iy + c.top * scale,
    width: c.width * scale,
    height: c.height * scale,
    image,
    covers:
      ix <= 1e-6 && iy <= 1e-6 &&
      ix + image.width >= W - 1e-6 && iy + image.height >= H - 1e-6,
  };
}

/** Mora: the play box is derived from the measured pads, labels and Release. */
export function paperWorldFrame(
  art: PaperWorld,
  surface: { width: number; height: number },
  safe?: Box,
) {
  return frameScene(art, paperWorldPlayBox(art), surface, safe);
}

/** Where the full source lands on the surface, given the crop's on-screen box. */
export function sceneTarget(art: SceneArt, board: { x: number; y: number; width: number }) {
  const scale = board.width / art.crop.width;
  return {
    x: board.x - art.crop.left * scale,
    y: board.y - art.crop.top * scale,
    width: art.width * scale,
    height: art.height * scale,
  };
}

export function paperWorldTarget(art: PaperWorld, board: { x: number; y: number; width: number }) {
  return sceneTarget(art, board);
}
