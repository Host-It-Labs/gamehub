/** Turn Arena's generated texture sources into shipped tiles.
 *
 * For each chosen source in assets/arena/textures: make it tile without a
 * seam (a cross-fade for the older tiles, a soft ramp for the cartoon ones),
 * derive a tangent-space normal map and an AO/roughness/metal map from
 * its painted light, and write native-resolution cartoon WebP sources
 * (legacy tiles also retain 2048/1024 variants) under public/3d/arena/tex with content hashes in their
 * names. The list lands in lib/games/arena/textures.json.
 *
 *   node scripts/arena-textures.mjs
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'assets/arena/textures';
const OUT = 'public/3d/arena/tex';

/** Chosen variant, normal strength, roughness range, metalness, seam fix and
 *  tone. The cartoon tiles (v4, 27 September 2026): bright hand-painted
 *  surfaces with big simple shapes and soft painted shading, so their relief
 *  is softer and their roughness stays matte even on the light tiles; cloth,
 *  leather and metal stay from v1 for the banners and the figures.
 *
 *  `seam` per axis: 'fade' (the default) cross-fades the edges with a
 *  half-shifted copy, which hides a seam in fine photographic detail but
 *  doubles the crisp stones and joints of a cartoon tile; 'ramp' only
 *  spreads the small tone step across the edges; 'none' leaves an axis whose
 *  edge is a joint by design (stone courses, slate rows, wood planks).
 *
 *  `tone` multiplies the source's red, green and blue before anything is
 *  derived: the generated greens came out lime and the stones near white
 *  under the brighter engine light, so grass, foliage and the forest floor
 *  are pulled to a fresh, less yellow green and cobble and stone darkened
 *  by a tenth to stand out from the grass.
 *
 *  The v5 tiles (29 September 2026, docs/concepts/2026-09-29-arena-quest/
 *  textures.md) repaint the meadow, the forest floor, the lanes' terracotta
 *  clay (served as `dirt`) and the tower sandstone with medium painted
 *  shapes that read at the game's camera; their tone pulls the generated
 *  lime and orange towards jade, olive and a calmer terracotta. */
const RAMP = { x: 'ramp', y: 'ramp' };
export const textureSources = {
  grass: {
    src: 'grass-v5-b',
    normal: 0.9,
    rough: [0.82, 0.95],
    seam: RAMP,
    native: true,
    tone: [1.1, 0.95, 1.5],
  },
  cobble: {
    src: 'cobble-v4-b',
    normal: 2.8,
    rough: [0.72, 0.93],
    seam: RAMP,
    tone: [0.9, 0.9, 0.9],
  },
  // The lanes' terracotta clay (the tile is still called dirt in the game).
  dirt: {
    src: 'path-v5-a',
    normal: 0.8,
    rough: [0.84, 0.97],
    seam: RAMP,
    native: true,
    tone: [0.94, 1.18, 1.4],
  },
  pebbles: {
    src: 'pebbles-v4-a',
    normal: 2.6,
    rough: [0.45, 0.72],
    seam: RAMP,
  },
  forest: {
    src: 'forest-v5-a',
    normal: 0.9,
    rough: [0.84, 0.96],
    seam: RAMP,
    native: true,
    tone: [0.98, 1.04, 1.5],
  },
  stone: {
    src: 'stone-v5-b',
    normal: 0.7,
    rough: [0.78, 0.9],
    seam: RAMP,
    native: true,
  },
  slate: {
    src: 'slate-v4-b',
    normal: 2.4,
    rough: [0.55, 0.8],
    seam: { x: 'ramp', y: 'none' },
  },
  wood: {
    src: 'wood-v4-a',
    normal: 1.8,
    rough: [0.7, 0.9],
    seam: { x: 'none', y: 'ramp' },
  },
  rock: { src: 'rock-v4-b', normal: 3, rough: [0.78, 0.95], seam: RAMP },
  bark: { src: 'bark-v4-a', normal: 3, rough: [0.8, 0.95], seam: RAMP },
  foliage: {
    src: 'cartoon-v2/foliage',
    normal: 0.12,
    rough: [0.8, 0.9],
    seam: RAMP,
    native: true,
  },
  cloth: { src: 'cloth-v1-a', normal: 1.6, rough: [0.8, 0.95] },
  leather: { src: 'leather-v1-b', normal: 2.2, rough: [0.45, 0.75] },
  metal: { src: 'metal-v1-b', normal: 3, rough: [0.28, 0.5], metal: 1 },
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
 * a smooth offset per row (or column), so a cartoon tile's crisp shapes stay
 * single. Only the step's slow variation along the edge is removed, never
 * the detail. */
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

async function processTexture(name, spec) {
  const { data, info } = await sharp(`${SRC}/${spec.src}.png`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tone = spec.tone ?? [1, 1, 1];
  // Work on an even size so the half offset lands on whole pixels.
  const w = info.width - (info.width % 2);
  const h = info.height - (info.height % 2);
  const px = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++)
        px[(y * w + x) * 3 + c] = data[(y * info.width + x) * 3 + c] * tone[c];
  const rx = seamRatio(px, w, h, 'x');
  const ry = seamRatio(px, w, h, 'y');
  const seam = { x: 'fade', y: 'fade', ...spec.seam };
  const fix = (img, axis, ratio, size) =>
    seam[axis] === 'none'
      ? img
      : seam[axis] === 'ramp'
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
  const fine = blurWrap(lum, w, h, 1);
  const broad = blurWrap(lum, w, h, 6);
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
      const rough = roughHi - (roughHi - roughLo) * Math.min(1, lum[i] * 1.2);
      orm[i * 3] = Math.round(ao * 255);
      orm[i * 3 + 1] = Math.round(rough * 255);
      orm[i * 3 + 2] = spec.metal ? 255 : 0;
    }
  const albedo = Buffer.alloc(w * h * 3);
  for (let i = 0; i < albedo.length; i++)
    albedo[i] = Math.max(0, Math.min(255, Math.round(tile[i])));
  const raw = { raw: { width: w, height: h, channels: 3 } };
  const files = {};
  for (const { kind, buffer, quality } of [
    { kind: 'albedo', buffer: albedo, quality: 90 },
    { kind: 'normal', buffer: normal, quality: 94 },
    { kind: 'orm', buffer: orm, quality: 90 },
  ]) {
    for (const size of kind === 'albedo'
      ? spec.native
        ? [w]
        : [2048, 1024]
      : [1024]) {
      // Normal and material maps top out at 1024 even on desktops.
      if (kind !== 'albedo' && size !== 1024) continue;
      const out = await sharp(buffer, raw)
        .resize(size, size, { kernel: 'lanczos3' })
        .webp({ quality, effort: 6, smartSubsample: true })
        .toBuffer();
      const hash = createHash('sha256').update(out).digest('hex').slice(0, 8);
      const file = `${name}-${kind}-${size}-${hash}.webp`;
      await writeFile(`${OUT}/${file}`, out);
      files[`${kind}${size}`] = {
        path: `/3d/arena/tex/${file}`,
        bytes: out.length,
      };
    }
  }
  console.log(
    `${name.padEnd(8)} seams x ${rx.toFixed(2)} (${seam.x}) y ${ry.toFixed(2)} (${seam.y})  ${Object.values(
      files,
    )
      .reduce((s, f) => s + f.bytes, 0)
      .toLocaleString()} bytes`,
  );
  return {
    albedo: {
      hq: files[`albedo${spec.native ? w : 2048}`],
      lite: spec.native ? files[`albedo${w}`] : files.albedo1024,
    },
    normal: files.normal1024,
    orm: files.orm1024,
  };
}

await mkdir(OUT, { recursive: true });
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
const manifest = only
  ? JSON.parse(await readFile('lib/games/arena/textures.json', 'utf8'))
  : {};
for (const f of await readdir(OUT))
  if (!only || f.startsWith(`${only}-`)) await rm(`${OUT}/${f}`);
for (const [name, spec] of Object.entries(textureSources))
  if (!only || name === only) manifest[name] = await processTexture(name, spec);
await writeFile(
  'lib/games/arena/textures.json',
  `${JSON.stringify(manifest, null, 2)}\n`,
);
