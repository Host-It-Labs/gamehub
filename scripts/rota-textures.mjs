/** Turn Rota's generated texture sources into shipped tiles.
 *
 * For each chosen source in assets/rota/textures (prompts and picks in
 * docs/concepts/2026-10-02-rota-3d/textures.md): pull its tone towards the
 * diorama palette, make it tile without a seam, derive a tangent-space
 * normal map and an AO/roughness/metal map from its painted light, and write
 * hashed WebP tiles under public/3d/rota/tex (albedo 2048 and 1024, normal
 * and ORM 1024). The list lands in lib/games/rota/textures.json. The seamless
 * albedo is also written as assets/rota/textures/<family>.png (1024 px) for
 * the Blender previews (assets/rota/blender/rkit.py).
 *
 *   node scripts/rota-textures.mjs              every family
 *   node scripts/rota-textures.mjs --only=brick one family
 *   node scripts/rota-textures.mjs --tiles      also write 3×3 contact sheets
 *                                               to docs/concepts/2026-10-02-rota-3d/tiles
 *
 * Directional tiles: brick, roof, slate and stone courses run along u (the
 * texture's x axis, rows stacked along v); wood planks, bark grain and the
 * field furrows run along v.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'assets/rota/textures';
const OUT = 'public/3d/rota/tex';
const MANIFEST = 'lib/games/rota/textures.json';
const TILES = 'docs/concepts/2026-10-02-rota-3d/tiles';

/** Chosen variant, normal strength, roughness range, seam fix, tone.
 *
 *  `seam` per axis: 'fade' cross-fades the edges with a copy shifted by half
 *  along that axis (fine organic detail); 'ramp' only spreads the tone step
 *  across the edges; 'fit' first crops that axis to a whole number of the
 *  pattern's measured period (brick courses, roof rows, planks, furrows), so
 *  the joints meet across the edge, then ramps the tone step; 'joints' (u
 *  only, with v fitted) cuts each course at its own vertical joints, for
 *  rows of slates, blocks or setts that share no width.
 *
 *  `tone` multiplies red, green and blue before anything is derived.
 *  `invert` reads height from dark rather than light (pale mortar sits
 *  below the bricks), and makes the crops look for light joints. */
const FADE = { x: 'fade', y: 'fade' };
export const textureSources = {
  // The generated meadow came out yellow-olive (mean #747926): more blue
  // pulls it to sage and olive without turning it blue-green.
  grass: {
    src: 'grass-v1-a',
    normal: 1.2,
    rough: [0.82, 0.95],
    seam: FADE,
    tone: [0.9, 1, 1.7],
  },
  // Furrows run along v; the crop keeps a whole number of them across u.
  field: {
    src: 'field-v1-b',
    normal: 2.2,
    rough: [0.84, 0.97],
    seam: { x: 'fit', y: 'fade' },
  },
  // Darkened to the charcoal target (#3a3d42 on average).
  asphalt: {
    src: 'asphalt-v1-b',
    normal: 1.4,
    rough: [0.78, 0.92],
    seam: FADE,
    tone: [0.78, 0.8, 0.86],
  },
  ballast: { src: 'ballast-v1-b', normal: 2.6, rough: [0.8, 0.95], seam: FADE },
  // Courses along u. Pale mortar sits below the bricks, so height is read
  // from dark.
  brick: {
    src: 'brick-v1-a',
    normal: 2.4,
    rough: [0.78, 0.92],
    seam: { x: 'fit', y: 'fit' },
    tone: [0.88, 0.9, 0.95],
    invert: true,
  },
  roof: {
    src: 'roof-v1-a',
    normal: 2.4,
    rough: [0.7, 0.88],
    seam: { x: 'fit', y: 'fit' },
    tone: [0.92, 0.92, 0.95],
  },
  // Rows along u. The slates' widths and offsets vary too much for one
  // period across u, so each row is cut at its own joints.
  slate: {
    src: 'slate-v1-a',
    normal: 2.2,
    rough: [0.55, 0.8],
    seam: { x: 'joints', y: 'fit' },
  },
  plaster: {
    src: 'plaster-v1-b',
    normal: 1.2,
    rough: [0.82, 0.94],
    seam: FADE,
    tone: [0.96, 0.96, 0.97],
  },
  // Planks along v; whole planks across u.
  wood: {
    src: 'wood-v1-b',
    normal: 1.8,
    rough: [0.7, 0.9],
    seam: { x: 'fit', y: 'fade' },
  },
  // Courses along u; blocks of varied length, so each course is cut at its
  // own joints.
  stone: {
    src: 'stone-v1-a',
    normal: 2.6,
    rough: [0.78, 0.93],
    seam: { x: 'joints', y: 'fit' },
  },
  rock: { src: 'rock-v1-a', normal: 3, rough: [0.78, 0.95], seam: FADE },
  // Lime as generated (mean #50631e): pulled to a mid olive-sage green.
  foliage: {
    src: 'foliage-v1-a',
    normal: 1.6,
    rough: [0.8, 0.92],
    seam: FADE,
    tone: [0.95, 1, 1.75],
  },
  // Grain along v: the plates' ends meet across the top edge with only the
  // tone ramped, since a cross-fade there ghosts a band of doubled plates.
  bark: {
    src: 'bark-v1-a',
    normal: 3,
    rough: [0.8, 0.95],
    seam: { x: 'fade', y: 'ramp' },
  },
  // A little less orange, towards pale golden beige.
  sand: {
    src: 'sand-v1-a',
    normal: 1.2,
    rough: [0.85, 0.97],
    seam: FADE,
    tone: [0.97, 0.97, 1.08],
  },
  // Setts in half-offset rows along u: whole periods both ways (two rows
  // along v).
  cobble: {
    src: 'cobble-v1-a',
    normal: 2.8,
    rough: [0.72, 0.93],
    seam: { x: 'fit', y: 'fit' },
  },
};

/** How far a tile's opposite edges differ, compared with neighbouring rows or
 * columns inside, along one axis ('x' compares left and right edges). */
function seamRatio(px, w, h, axis) {
  let edge = 0;
  let inner = 0;
  const get = (x, y, c) => px[(y * w + x) * 3 + c];
  if (axis === 'x')
    for (let y = 0; y < h; y++)
      for (let c = 0; c < 3; c++) {
        edge += Math.abs(get(w - 1, y, c) - get(0, y, c));
        inner += Math.abs(get(w / 2, y, c) - get(w / 2 - 1, y, c));
      }
  else
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        edge += Math.abs(get(x, h - 1, c) - get(x, 0, c));
        inner += Math.abs(get(x, h / 2, c) - get(x, h / 2 - 1, c));
      }
  return edge / Math.max(1, inner);
}

/** Cross-fade a band along two opposite edges with a copy of the tile shifted
 * by half along that axis only, so rows of stones or planks stay aligned. */
function makeSeamless(px, w, h, band, axis) {
  if (!band) return px;
  const out = new Float32Array(px.length);
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = axis === 'x' ? Math.min(x, w - 1 - x) : Math.min(y, h - 1 - y);
      const keep = smooth(d / band);
      const sx = axis === 'x' ? (x + w / 2) % w : x;
      const sy = axis === 'y' ? (y + h / 2) % h : y;
      for (let c = 0; c < 3; c++)
        out[(y * w + x) * 3 + c] =
          px[(y * w + x) * 3 + c] * keep +
          px[(sy * w + sx) * 3 + c] * (1 - keep);
    }
  return out;
}

/** Spread the step between two opposite edges over a band on each side, as
 * a smooth offset per row (or column). Only the step's slow variation along
 * the edge is removed, never the detail. */
function rampSeam(px, w, h, band, axis) {
  const out = Float32Array.from(px);
  const along = axis === 'x' ? h : w;
  const size = axis === 'x' ? w : h;
  const at = (i, d) => (axis === 'x' ? i * w + d : d * w + i);
  const smooth = (t) => t * t * (3 - 2 * t);
  const r = 6;
  for (let c = 0; c < 3; c++) {
    const step = new Float32Array(along);
    for (let i = 0; i < along; i++)
      step[i] = px[at(i, 0) * 3 + c] - px[at(i, size - 1) * 3 + c];
    for (let i = 0; i < along; i++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += step[(i + k + along) % along];
      const half = sum / (2 * r + 1) / 2;
      for (let d = 0; d < band; d++) {
        const weight = half * (1 - smooth(d / band));
        out[at(i, d) * 3 + c] -= weight;
        out[at(i, size - 1 - d) * 3 + c] += weight;
      }
    }
  }
  return out;
}

const bandFor = (ratio, size) =>
  ratio < 1.25
    ? 0
    : Math.round(size * (ratio < 1.8 ? 0.03 : ratio < 3 ? 0.06 : 0.1));

/** The pattern's repeat along one axis, in pixels (fractional): the lag with
 * the strongest autocorrelation of the detrended luminance, refined over as
 * many repeats as fit in four fifths of the tile. */
function measurePeriod(px, w, h, axis) {
  const size = axis === 'x' ? w : h;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    lum[i] = px[i * 3] * 0.299 + px[i * 3 + 1] * 0.587 + px[i * 3 + 2] * 0.114;
  // Remove each line's mean (across the axis), so slow tone drifts do not win.
  const mean = new Float32Array(axis === 'x' ? h : w);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) mean[axis === 'x' ? y : x] += lum[y * w + x];
  for (let i = 0; i < mean.length; i++) mean[i] /= size;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) lum[y * w + x] -= mean[axis === 'x' ? y : x];
  const corr = (lag) => {
    let s = 0;
    let n = 0;
    const step = 2;
    for (let y = 0; y < (axis === 'y' ? h - lag : h); y += step)
      for (let x = 0; x < (axis === 'x' ? w - lag : w); x += step) {
        const j = axis === 'x' ? y * w + x + lag : (y + lag) * w + x;
        s += lum[y * w + x] * lum[j];
        n++;
      }
    return s / Math.max(1, n);
  };
  const lo = Math.round(size / 40);
  const hi = Math.round(size / 3);
  const c = new Float32Array(hi + 2);
  for (let lag = lo - 1; lag <= hi + 1; lag++) c[lag] = corr(lag);
  // First strong local peak: the smallest lag whose peak reaches 80 % of the
  // best, so a double period never beats the true one.
  let best = 0;
  for (let lag = lo; lag <= hi; lag++) best = Math.max(best, c[lag]);
  let p0 = lo;
  for (let lag = lo; lag <= hi; lag++)
    if (c[lag] >= c[lag - 1] && c[lag] >= c[lag + 1] && c[lag] >= best * 0.8) {
      p0 = lag;
      break;
    }
  const m = Math.max(1, Math.floor((size * 0.8) / p0));
  let bestLag = m * p0;
  let bestVal = -Infinity;
  for (let lag = m * p0 - m; lag <= m * p0 + m; lag++) {
    if (lag >= size) break;
    const v = corr(lag);
    if (v > bestVal) {
      bestVal = v;
      bestLag = lag;
    }
  }
  return { period: bestLag / m, strength: bestVal / Math.max(1e-6, corr(0)) };
}

/** Crop an axis to `length` lines (a whole number of periods). The start is
 * the line that best matches the line one length further on, so the wrap
 * continues the pattern, with a small preference for joints (dark lines, or
 * light ones when `pale` joints such as mortar), where a leftover step hides.
 * Returns the new pixels and size, and where the crop started. */
function cropAxis(px, w, h, axis, length, pale) {
  const size = axis === 'x' ? w : h;
  const across = axis === 'x' ? h : w;
  const at = (line, i, c) =>
    axis === 'x' ? px[(i * w + line) * 3 + c] : px[(line * w + i) * 3 + c];
  let off = 0;
  let best = Infinity;
  for (let o = 0; o + length < size; o++) {
    let diff = 0;
    let lum = 0;
    for (let i = 0; i < across; i++) {
      for (let c = 0; c < 3; c++)
        diff += Math.abs(at(o, i, c) - at(o + length, i, c));
      lum += at(o, i, 0) * 0.299 + at(o, i, 1) * 0.587 + at(o, i, 2) * 0.114;
    }
    diff /= across * 3;
    lum /= across;
    const cost = diff + 0.3 * (pale ? 255 - lum : lum);
    if (cost < best) {
      best = cost;
      off = o;
    }
  }
  const nw = axis === 'x' ? length : w;
  const nh = axis === 'y' ? length : h;
  const out = new Float32Array(nw * nh * 3);
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++) {
      const sx = axis === 'x' ? x + off : x;
      const sy = axis === 'y' ? y + off : y;
      for (let c = 0; c < 3; c++)
        out[(y * nw + x) * 3 + c] = px[(sy * w + sx) * 3 + c];
    }
  return { px: out, w: nw, h: nh, off };
}

/** Rows whose units (slates, ashlar blocks) have no common width still tile
 * along u if every row is cut at its own vertical joints: each course of
 * height `period` is cropped from a joint in its left half to a joint about
 * `W` further on, resampled to `W` and turned back to its original phase, so
 * the wrap lands on a joint at a different place in every course. Returns
 * the new pixels and width and the worst stretch. */
function jointCut(px, w, h, period, pale) {
  const bands = Math.round(h / period);
  const lum = (x, y) =>
    px[(y * w + x) * 3] * 0.299 +
    px[(y * w + x) * 3 + 1] * 0.587 +
    px[(y * w + x) * 3 + 2] * 0.114;
  const rows = [];
  for (let b = 0; b < bands; b++) {
    const y0 = Math.round(b * period);
    const y1 = b === bands - 1 ? h : Math.round((b + 1) * period);
    // Column profile over the course's middle, smoothed a little.
    const a0 = Math.round(y0 + (y1 - y0) * 0.2);
    const a1 = Math.round(y0 + (y1 - y0) * 0.8);
    const raw = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = a0; y < a1; y++) s += lum(x, y);
      raw[x] = (pale ? -1 : 1) * (s / Math.max(1, a1 - a0));
    }
    const prof = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++)
        s += raw[Math.min(w - 1, Math.max(0, x + k))];
      prof[x] = s / 5;
    }
    const sorted = Float32Array.from(prof).sort();
    const median = sorted[Math.floor(w / 2)];
    const low = sorted[Math.floor(w * 0.01)];
    const limit = median - 0.45 * (median - low);
    const joints = [];
    for (let x = 3; x < w - 3; x++)
      if (prof[x] <= limit && prof[x] <= prof[x - 1] && prof[x] < prof[x + 1]) {
        const last = joints[joints.length - 1];
        if (last !== undefined && x - last < 12) {
          if (prof[x] < prof[last]) joints[joints.length - 1] = x;
        } else joints.push(x);
      }
    rows.push({ y0, y1, joints });
  }
  // The common width: the one every course can match most closely.
  let best = { W: w, worst: Infinity, cuts: [], cost: Infinity };
  for (let W = Math.round(w * 0.45); W <= Math.round(w * 0.97); W++) {
    let worst = 0;
    const cuts = [];
    for (const { joints } of rows) {
      let pick = null;
      for (const j0 of joints) {
        if (j0 > w * 0.5) break;
        for (const j1 of joints) {
          if (j1 <= j0) continue;
          const e = Math.abs(j1 - j0 - W);
          if (!pick || e < pick.e) pick = { j0, j1, e };
        }
      }
      if (!pick) {
        worst = Infinity;
        break;
      }
      worst = Math.max(worst, pick.e / W);
      cuts.push(pick);
    }
    // Least stretch, but not at the cost of half the resolution.
    const cost = worst + 0.1 * (1 - W / w);
    if (cost <= best.cost) best = { W, worst, cuts, cost };
  }
  const { W, cuts } = best;
  const out = new Float32Array(W * h * 3);
  rows.forEach(({ y0, y1 }, b) => {
    const { j0, j1 } = cuts[b];
    // Each course turns back to where it sat, so the cuts (and the courses'
    // own offsets) do not line up into one vertical joint.
    const shift = Math.round((j0 * W) / (j1 - j0));
    for (let y = y0; y < y1; y++)
      for (let x = 0; x < W; x++) {
        const u = (((x - shift) % W) + W) % W;
        const sx = j0 + (u / W) * (j1 - j0);
        const x0 = Math.floor(sx);
        const t = sx - x0;
        const x1 = Math.min(w - 1, x0 + 1);
        for (let c = 0; c < 3; c++)
          out[(y * W + x) * 3 + c] =
            px[(y * w + x0) * 3 + c] * (1 - t) + px[(y * w + x1) * 3 + c] * t;
      }
  });
  return { px: out, w: W, stretch: best.worst };
}

function blurWrap(src, w, h, radius) {
  // Box blur, three passes, wrapping at the edges so the result still tiles.
  const a = Float32Array.from(src);
  const b = new Float32Array(a.length);
  const r = Math.max(1, Math.round(radius));
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += a[y * w + ((k + w) % w)];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = sum / (2 * r + 1);
        sum += a[y * w + ((x + r + 1) % w)] - a[y * w + ((x - r + w) % w)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += b[((k + h) % h) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum / (2 * r + 1);
        sum += b[((y + r + 1) % h) * w + x] - b[((y - r + h) % h) * w + x];
      }
    }
  }
  return a;
}

/** Resample float RGB to a square of `size` through sharp (lanczos). */
async function toSquare(px, w, h, size) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < buf.length; i++)
    buf[i] = Math.max(0, Math.min(255, Math.round(px[i])));
  const { data } = await sharp(buf, {
    raw: { width: w, height: h, channels: 3 },
  })
    .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Float32Array.from(data);
}

async function processTexture(name, spec, tiles) {
  const { data, info } = await sharp(`${SRC}/${spec.src}.png`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tone = spec.tone ?? [1, 1, 1];
  let w = info.width - (info.width % 2);
  let h = info.height - (info.height % 2);
  let px = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++)
        px[(y * w + x) * 3 + c] = data[(y * info.width + x) * 3 + c] * tone[c];
  const seam = { x: 'fade', y: 'fade', ...spec.seam };
  const notes = [];
  // Whole periods first (v before u, so courses are known), so the joints
  // of directional tiles meet.
  let course = 0;
  for (const axis of ['y', 'x']) {
    if (seam[axis] !== 'fit') continue;
    const size = axis === 'x' ? w : h;
    const { period, strength } = measurePeriod(px, w, h, axis);
    if (strength < 0.25) {
      // No clear repeat: cross-fade that axis instead.
      notes.push(`${axis} no period (r ${strength.toFixed(2)}), faded`);
      seam[axis] = 'fade';
      continue;
    }
    // One period short of the most that fit, so the start can find a joint.
    const n = Math.max(1, Math.floor(size / period) - 1);
    const length = Math.round(n * period);
    let off;
    ({ px, w, h, off } = cropAxis(px, w, h, axis, length, spec.invert));
    if (axis === 'y') course = period;
    notes.push(
      `${axis} period ${period.toFixed(1)} × ${n} from ${off} (r ${strength.toFixed(2)})`,
    );
  }
  if (seam.x === 'joints') {
    if (!course) throw new Error(`${name}: joints along u need fitted courses`);
    let stretch;
    let cut = jointCut(px, w, h, course, spec.invert);
    // Keep the courses' proportions: as many whole courses as the cut width.
    const keep = Math.max(1, Math.round(cut.w / course));
    if (keep < Math.round(h / course)) {
      h = Math.round(keep * course);
      px = px.slice(0, w * h * 3);
      cut = jointCut(px, w, h, course, spec.invert);
    }
    ({ px, w, stretch } = cut);
    notes.push(
      `x cut at joints to ${w} × ${h} (stretch ≤ ${(stretch * 100).toFixed(1)} %)`,
    );
  }
  // Back to a square before the seams are blended.
  const work = Math.min(w, h) - (Math.min(w, h) % 2);
  if (w !== work || h !== work) {
    px = await toSquare(px, w, h, work);
    w = h = work;
  }
  const rx = seamRatio(px, w, h, 'x');
  const ry = seamRatio(px, w, h, 'y');
  const fix = (img, axis, ratio, size) =>
    seam[axis] === 'none'
      ? img
      : seam[axis] === 'ramp' || seam[axis] === 'fit' || seam[axis] === 'joints'
        ? rampSeam(img, w, h, Math.round(size * 0.03), axis)
        : makeSeamless(img, w, h, bandFor(ratio, size), axis);
  const tile = fix(fix(px, 'x', rx, w), 'y', ry, h);
  // Height from painted light: broad forms plus fine detail.
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    lum[i] =
      (tile[i * 3] * 0.299 +
        tile[i * 3 + 1] * 0.587 +
        tile[i * 3 + 2] * 0.114) /
      255;
  const shade = spec.invert ? lum.map((v) => 1 - v) : lum;
  const fine = blurWrap(shade, w, h, 1);
  const broad = blurWrap(shade, w, h, 6);
  const height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) height[i] = fine[i] * 0.6 + broad[i] * 0.4;
  const cavity = blurWrap(height, w, h, 10);
  const normal = Buffer.alloc(w * h * 3);
  const orm = Buffer.alloc(w * h * 3);
  const at = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  const [roughLo, roughHi] = spec.rough;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      // OpenGL convention (green up), as three.js expects.
      let nx = -dx * spec.normal;
      let ny = dy * spec.normal;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = y * w + x;
      normal[i * 3] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[i * 3 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal[i * 3 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      const ao = Math.min(1, Math.max(0.45, 1 - (cavity[i] - height[i]) * 2.2));
      // Lit tops are a little smoother than the shaded hollows.
      const rough = roughHi - (roughHi - roughLo) * Math.min(1, lum[i] * 1.2);
      orm[i * 3] = Math.round(ao * 255);
      orm[i * 3 + 1] = Math.round(rough * 255);
      orm[i * 3 + 2] = 0; // nothing in the diorama's tiles is metal
    }
  const albedo = Buffer.alloc(w * h * 3);
  for (let i = 0; i < albedo.length; i++)
    albedo[i] = Math.max(0, Math.min(255, Math.round(tile[i])));
  const raw = { raw: { width: w, height: h, channels: 3 } };
  const files = {};
  for (const { kind, buffer, quality, sizes } of [
    { kind: 'albedo', buffer: albedo, quality: 90, sizes: [2048, 1024] },
    { kind: 'normal', buffer: normal, quality: 94, sizes: [1024] },
    { kind: 'orm', buffer: orm, quality: 90, sizes: [1024] },
  ])
    for (const size of sizes) {
      const out = await sharp(buffer, raw)
        .resize(size, size, { kernel: 'lanczos3' })
        .webp({ quality, effort: 6, smartSubsample: true })
        .toBuffer();
      const hash = createHash('sha256').update(out).digest('hex').slice(0, 8);
      const file = `${name}-${kind}-${size}-${hash}.webp`;
      await writeFile(`${OUT}/${file}`, out);
      files[`${kind}${size}`] = {
        path: `/3d/rota/tex/${file}`,
        bytes: out.length,
      };
    }
  // The Blender previews read the seamless albedo by family name.
  const preview = await sharp(albedo, raw)
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(`${SRC}/${name}.png`, preview);
  if (tiles) {
    const cell = 512;
    const one = await sharp(preview).resize(cell, cell).png().toBuffer();
    const composite = [];
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++)
        composite.push({ input: one, left: i * cell, top: j * cell });
    await sharp({
      create: {
        width: cell * 3,
        height: cell * 3,
        channels: 3,
        background: '#000',
      },
    })
      .composite(composite)
      .png()
      .toFile(`${TILES}/${name}.png`);
  }
  const mean = [0, 1, 2].map((c) => {
    let s = 0;
    for (let i = c; i < albedo.length; i += 3) s += albedo[i];
    return Math.round(s / (albedo.length / 3));
  });
  console.log(
    `${name.padEnd(8)} ${spec.src.padEnd(14)} #${mean
      .map((v) => v.toString(16).padStart(2, '0'))
      .join(
        '',
      )}  seams x ${rx.toFixed(2)} (${seam.x}) y ${ry.toFixed(2)} (${seam.y})${
      notes.length ? `  ${notes.join(', ')}` : ''
    }  ${Object.values(files)
      .reduce((s, f) => s + f.bytes, 0)
      .toLocaleString()} bytes`,
  );
  return {
    albedo: { hq: files.albedo2048, lite: files.albedo1024 },
    normal: files.normal1024,
    orm: files.orm1024,
  };
}

const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
const tiles = process.argv.includes('--tiles');
await mkdir(OUT, { recursive: true });
await mkdir('lib/games/rota', { recursive: true });
if (tiles) await mkdir(TILES, { recursive: true });
let manifest = {};
if (only)
  try {
    manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    manifest = {};
  }
const hashed = /^([a-z]+)-(albedo|normal|orm)-\d+-[0-9a-f]{8}\.webp$/;
for (const [name, spec] of Object.entries(textureSources)) {
  if (only && name !== only) continue;
  // Clear this family's old hashed tiles first.
  for (const f of await readdir(OUT))
    if (hashed.exec(f)?.[1] === name) await rm(`${OUT}/${f}`);
  manifest[name] = await processTexture(name, spec, tiles);
}
const ordered = Object.fromEntries(
  Object.keys(textureSources)
    .filter((name) => manifest[name])
    .map((name) => [name, manifest[name]]),
);
await writeFile(MANIFEST, `${JSON.stringify(ordered, null, 2)}\n`);
