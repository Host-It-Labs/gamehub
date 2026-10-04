// Alto delivery files from the chosen generations in public/art/alto (the
// space theme of 2 October 2026; prompts, picks and reasons:
// docs/concepts/2026-10-02-alto-space/README.md) and from the stills of the
// 3D planets and upgrades (public/art/alto/stills, rendered by /alto/lab?stills).
// Mechanical crops, trims, pads and resizes only; never paint over the art.
//   node scripts/alto-art.mjs
import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'public/art/alto';
const OUT = 'public/art/optimized';

/** The chosen variant of every generated image. */
const pick = {
  cover: 'box-alto-v2-a',
  wide: 'box-alto-wide-v2-b',
  skyLandscape: 'alto-space-landscape-v2-b',
  skyPortrait: 'alto-space-portrait-v2-a',
  cargo: 'alto-cargo-v2-a',
  crew: 'alto-crew-v2-a',
};
const CARGO_IDS = ['food', 'metal', 'ice', 'crystal'];
const CREW_IDS = [
  'navigator',
  'forester',
  'mason',
  'shepherd',
  'glazier',
  'scout',
  'trader',
  'architect',
];

const src = (name) => `${SRC}/${name}.png`;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
/** Alpha below this counts as empty when finding a drawing's bounds. */
const ALPHA_MIN = 24;

/** Raw RGBA of a region of a source image. */
async function region(file, box) {
  let img = sharp(file).ensureAlpha();
  if (box) img = img.extract(box);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Bounding box of the pixels whose alpha reaches ALPHA_MIN. */
function alphaBox({ data, width, height }) {
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] >= ALPHA_MIN) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error('empty drawing');
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Trim to the drawing, centre it on a transparent square whose drawing
 * leaves `margin` of the side free on every side. */
async function squarePad(raw, margin) {
  const box = alphaBox(raw);
  const side = Math.ceil(Math.max(box.width, box.height) / (1 - 2 * margin));
  const trimmed = await sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: 4 },
  })
    .extract(box)
    .png()
    .toBuffer();
  const left = Math.floor((side - box.width) / 2);
  const top = Math.floor((side - box.height) / 2);
  return sharp(trimmed)
    .extend({
      left,
      top,
      right: side - box.width - left,
      bottom: side - box.height - top,
      background: CLEAR,
    })
    .png()
    .toBuffer();
}

/** The objects of a cols x rows sheet, left to right then top to bottom, each
 * as a full-size RGBA buffer holding only that object. The drawings overhang
 * the exact grid lines a little, so each object is found as a connected shape
 * (alpha mask on 4 px blocks) and belongs to the cell holding its centre; soft
 * fringes within 16 px join the nearest shape, anything else its own cell. */
async function sheetObjects(file, cols, rows) {
  const raw = await region(file);
  const { data, width: W, height: H } = raw;
  const S = 4,
    w = Math.ceil(W / S),
    h = Math.ceil(H / S);
  const cellOf = (x, y) =>
    Math.min(rows - 1, Math.floor((y * rows) / H)) * cols +
    Math.min(cols - 1, Math.floor((x * cols) / W));
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[(y * W + x) * 4 + 3] > 56)
        mask[((y / S) | 0) * w + ((x / S) | 0)] = 1;
  const DROP = -2;
  const owner = new Int16Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    const members = [i];
    seen[i] = 1;
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0;
    for (let k = 0; k < members.length; k++) {
      const j = members[k],
        x = j % w,
        y = (j / w) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (mask[n] && !seen[n]) {
            seen[n] = 1;
            members.push(n);
          }
        }
    }
    // Isolated specks (stray sparks under 20 blocks) are dropped, not given
    // to whichever cell they happen to fall in.
    const cell =
      members.length < 20
        ? DROP
        : cellOf(((x0 + x1 + 1) / 2) * S, ((y0 + y1 + 1) / 2) * S);
    for (const j of members) owner[j] = cell;
  }
  for (let step = 0; step < 4; step++) {
    const next = owner.slice();
    for (let i = 0; i < w * h; i++) {
      if (owner[i] !== -1) continue;
      const x = i % w,
        y = (i / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && owner[ny * w + nx] >= 0) {
          next[i] = owner[ny * w + nx];
          break;
        }
      }
    }
    owner.set(next);
  }
  const objects = [];
  for (let c = 0; c < cols * rows; c++) {
    const own = Buffer.from(data);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const b = owner[((y / S) | 0) * w + ((x / S) | 0)];
        if ((b === -1 ? cellOf(x, y) : b) !== c) own[(y * W + x) * 4 + 3] = 0;
      }
    objects.push({ data: own, width: W, height: H });
  }
  return objects;
}

const webp = (buf, size, file, quality = 86) =>
  sharp(buf)
    .resize(size, size, { kernel: 'lanczos3' })
    .webp({ quality, alphaQuality: 90 })
    .toFile(`${OUT}/${file}`);

const written = [];

// Cargo: four 160 squares, 6% margin.
{
  const objects = await sheetObjects(src(pick.cargo), 2, 2);
  for (const [i, id] of CARGO_IDS.entries()) {
    const buf = await squarePad(objects[i], 0.06);
    await webp(buf, 160, `alto-cargo-${id}-v2.webp`);
    written.push(`alto-cargo-${id}-v2.webp`);
  }
}

// Crew: 192 squares, 4% margin.
{
  const objects = await sheetObjects(src(pick.crew), 4, 2);
  for (const [i, id] of CREW_IDS.entries()) {
    const buf = await squarePad(objects[i], 0.04);
    await webp(buf, 192, `alto-crew-${id}-v2.webp`);
    written.push(`alto-crew-${id}-v2.webp`);
  }
}

// Stills of the 3D planets (400) and upgrades (256), trimmed and squared.
{
  const dir = `${SRC}/stills`;
  for (const file of existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.png'))
    : []) {
    const name = file.replace('.png', '');
    const planet = name.startsWith('planet-');
    const buf = await squarePad(
      await region(`${dir}/${file}`),
      planet ? 0.02 : 0.05,
    );
    const out = `alto-${name}-v2.webp`;
    await webp(buf, planet ? 400 : 256, out);
    written.push(out);
  }
}

// Space plates: full size plus lighter 768- and 512-wide copies.
for (const [name, base] of [
  [pick.skyLandscape, 'alto-space-landscape-v2'],
  [pick.skyPortrait, 'alto-space-portrait-v2'],
]) {
  const { width } = await sharp(src(name)).metadata();
  await sharp(src(name)).webp({ quality: 80 }).toFile(`${OUT}/${base}.webp`);
  for (const w of [768, 512]) {
    if (w >= width) continue;
    await sharp(src(name))
      .resize({ width: w, kernel: 'lanczos3' })
      .webp({ quality: 76 })
      .toFile(`${OUT}/${base}-${w}.webp`);
  }
  written.push(`${base}.webp`);
}

// Library covers, delivered as every other box cover (scripts/optimize-box-covers.mjs,
// scripts/optimize-wide-covers.mjs): the square with its spine strip and 320/640
// copies, the 3:1 setup lid cut from the middle band of the wide generation.
{
  const previewsPath = 'lib/artwork-previews.json';
  const previews = JSON.parse(await readFile(previewsPath, 'utf8'));
  const cover = '/art/optimized/box-alto-blind-v2.webp';
  await sharp(src(pick.cover))
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .webp({ quality: 88 })
    .toFile(`public${cover}`);
  await sharp(`public${cover}`)
    .extract({ left: 0, top: 0, width: 64, height: 1024 })
    .webp({ quality: 88 })
    .toFile(`public${cover.replace('.webp', '-spine.webp')}`);
  const variants = [];
  for (const width of [320, 640]) {
    const target = cover.replace('.webp', `-${width}.webp`);
    await sharp(`public${cover}`)
      .resize(width, width)
      .webp({ quality: 88 })
      .toFile(`public${target}`);
    variants.push(`${target} ${width}w`);
  }
  variants.push(`${cover} 1024w`);
  const tiny = await sharp(`public${cover}`)
    .resize(24, 24)
    .webp({ quality: 35 })
    .toBuffer();
  previews[cover] = {
    preview: `data:image/webp;base64,${tiny.toString('base64')}`,
    srcSet: variants.join(', '),
  };

  const wideSrc = src(pick.wide);
  const wide = '/art/optimized/box-alto-wide-v2.webp';
  const { width, height } = await sharp(wideSrc).metadata();
  const band = Math.round(width / 3);
  const cut = () =>
    sharp(wideSrc).extract({
      left: 0,
      top: Math.round((height - band) / 2),
      width,
      height: band,
    });
  const wideSet = [];
  for (const size of [768, 1536]) {
    const target =
      size === 1536 ? wide : wide.replace('.webp', `-${size}.webp`);
    await cut()
      .resize(size, Math.round(size / 3))
      .webp({ quality: 82 })
      .toFile(`public${target}`);
    wideSet.push(`${target} ${size}w`);
  }
  const wideTiny = await cut().resize(36, 12).webp({ quality: 35 }).toBuffer();
  previews[wide] = {
    preview: `data:image/webp;base64,${wideTiny.toString('base64')}`,
    srcSet: wideSet.join(', '),
  };
  await writeFile(previewsPath, `${JSON.stringify(previews, null, 2)}\n`);
  written.push('box-alto-blind-v2.webp', 'box-alto-wide-v2.webp');
}

// Contact sheet of every delivery file on a mid-blue ground, in the order written.
{
  const TILE = 256,
    GAP = 16,
    COLS = 8;
  const rows = Math.ceil(written.length / COLS);
  const composites = [];
  for (const [i, file] of written.entries()) {
    const img = await sharp(`${OUT}/${file}`)
      .resize(TILE, TILE, { fit: 'inside' })
      .png()
      .toBuffer();
    const { width, height } = await sharp(img).metadata();
    const x = GAP + (i % COLS) * (TILE + GAP) + Math.floor((TILE - width) / 2);
    const y =
      GAP +
      Math.floor(i / COLS) * (TILE + GAP) +
      Math.floor((TILE - height) / 2);
    composites.push({ input: img, left: x, top: y });
  }
  await sharp({
    create: {
      width: GAP + COLS * (TILE + GAP),
      height: GAP + rows * (TILE + GAP),
      channels: 4,
      background: { r: 22, g: 29, b: 68, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile('docs/concepts/2026-10-02-alto-space/contact-sheet.png');
}
console.log(
  `Alto: ${written.length} delivery images (plus their smaller copies) and the contact sheet.`,
);
