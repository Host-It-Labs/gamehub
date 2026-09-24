// Builds the Sizes silhouette sheets: generated black-on-white 4x4 sheets become
// white alpha masks plus a per-cell bounding-box table.
// Usage: node scripts/build-sizes-silhouettes.mjs [animals=path] [objects=path] [landmarks=path]
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCES = {
  animals: 'public/art/sizes-sil-animals-v1-a.png',
  objects: 'public/art/sizes-sil-objects-v1-b.png',
  landmarks: 'public/art/sizes-sil-landmarks-v1-a.png',
};
for (const arg of process.argv.slice(2)) {
  const [sheet, path] = arg.split('=');
  if (!(sheet in SOURCES) || !path) throw new Error(`Bad argument ${arg}; expected <sheet>=<path>`);
  SOURCES[sheet] = path;
}

const SIZE = 1536;
const GRID = 4;
const CELL = SIZE / GRID;
const DARK = 70; // grey at or below: fully opaque
const LIGHT = 185; // grey at or above: fully transparent
const MIN_AREA = 40;

async function build(sheet, source) {
  const grey = await sharp(source)
    .flatten({ background: '#ffffff' })
    .resize(SIZE, SIZE, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  const n = SIZE * SIZE;
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const g = grey[i];
    alpha[i] = g <= DARK ? 255 : g >= LIGHT ? 0 : Math.round((255 * (LIGHT - g)) / (LIGHT - DARK));
  }

  // Label solid components (alpha >= 128, 8-connected).
  const label = new Int32Array(n).fill(-1);
  const comps = [];
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (alpha[start] < 128 || label[start] !== -1) continue;
    const id = comps.length;
    const comp = { area: 0, sx: 0, sy: 0, x0: SIZE, y0: SIZE, x1: -1, y1: -1, pixels: [] };
    let top = 0;
    stack[top++] = start;
    label[start] = id;
    while (top) {
      const p = stack[--top];
      const x = p % SIZE;
      const y = (p - x) / SIZE;
      comp.area++;
      comp.sx += x;
      comp.sy += y;
      comp.pixels.push(p);
      if (x < comp.x0) comp.x0 = x;
      if (x > comp.x1) comp.x1 = x;
      if (y < comp.y0) comp.y0 = y;
      if (y > comp.y1) comp.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
          const q = ny * SIZE + nx;
          if (alpha[q] >= 128 && label[q] === -1) {
            label[q] = id;
            stack[top++] = q;
          }
        }
      }
    }
    comps.push(comp);
  }

  // Drop specks, keep the antialias fringe only next to kept pixels.
  const kept = new Uint8Array(n);
  for (const comp of comps) {
    if (comp.area < MIN_AREA) for (const p of comp.pixels) alpha[p] = 0;
    else for (const p of comp.pixels) kept[p] = 1;
  }
  for (let i = 0; i < n; i++) {
    if (alpha[i] === 0 || alpha[i] >= 128) continue;
    const x = i % SIZE;
    const y = (i - x) / SIZE;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++)
      for (let dx = -2; dx <= 2 && !near; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && kept[ny * SIZE + nx]) near = true;
      }
    if (!near) alpha[i] = 0;
  }

  // Assign blobs to the cell containing their centroid and measure each cell.
  const boxes = Array.from({ length: GRID * GRID }, () => ({ x0: SIZE, y0: SIZE, x1: -1, y1: -1, blobs: 0 }));
  const warnings = [];
  for (const comp of comps) {
    if (comp.area < MIN_AREA) continue;
    const cx = comp.sx / comp.area;
    const cy = comp.sy / comp.area;
    const col = Math.min(GRID - 1, Math.floor(cx / CELL));
    const row = Math.min(GRID - 1, Math.floor(cy / CELL));
    const cell = row * GRID + col;
    const box = boxes[cell];
    box.blobs++;
    box.x0 = Math.min(box.x0, comp.x0);
    box.y0 = Math.min(box.y0, comp.y0);
    box.x1 = Math.max(box.x1, comp.x1);
    box.y1 = Math.max(box.y1, comp.y1);
  }
  const result = boxes.map((box, cell) => {
    const row = Math.floor(cell / GRID);
    const col = cell % GRID;
    if (box.x1 < 0) {
      warnings.push(`cell ${cell + 1} is empty`);
      return { x: 0, y: 0, w: 0, h: 0 };
    }
    const out = { x: box.x0, y: box.y0, w: box.x1 - box.x0 + 1, h: box.y1 - box.y0 + 1 };
    if (box.x0 < col * CELL || box.y0 < row * CELL || box.x1 >= (col + 1) * CELL || box.y1 >= (row + 1) * CELL)
      warnings.push(`cell ${cell + 1} crosses its cell edge`);
    if (out.w <= 20 || out.h <= 20) warnings.push(`cell ${cell + 1} is tiny (${out.w}x${out.h})`);
    if (box.blobs > 1) warnings.push(`cell ${cell + 1} has ${box.blobs} separate blobs`);
    return out;
  });

  const rgba = Buffer.alloc(n * 4, 255);
  for (let i = 0; i < n; i++) rgba[i * 4 + 3] = alpha[i];
  const target = `public/art/optimized/sizes-sil-${sheet}-v1.webp`;
  await sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .webp({ lossless: true, alphaQuality: 100, effort: 6 })
    .toFile(target);
  console.log(`${sheet}: ${source} -> ${target}${warnings.length ? `\n  ${warnings.join('\n  ')}` : ''}`);
  return result;
}

const sheets = {};
for (const [sheet, source] of Object.entries(SOURCES)) sheets[sheet] = await build(sheet, source);
await writeFile('lib/games/party/size-silhouettes.json', `${JSON.stringify({ size: SIZE, sheets }, null, 2)}\n`);
console.log('Wrote lib/games/party/size-silhouettes.json');
