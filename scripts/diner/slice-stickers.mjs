// Cuts a generated sticker sheet (stickers on flat mid-grey) into single
// transparent WebP images, named in reading order.
// Usage: node scripts/diner/slice-stickers.mjs <sheet.png> <outDir> <size> <name,name,...>
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const [sheet, outDir, sizeArg, namesArg] = process.argv.slice(2);
const names = namesArg.split(',');
const size = Number(sizeArg);
const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x, y) => (y * W + x) * 4;
// The background grey, sampled from the corners.
let gr = 0, gg = 0, gb = 0;
for (const [x, y] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]) {
  const i = px(x, y);
  gr += data[i] / 4; gg += data[i + 1] / 4; gb += data[i + 2] / 4;
}
const dist = (i) => Math.hypot(data[i] - gr, data[i + 1] - gg, data[i + 2] - gb);
// Flood fill the background (and the anti-aliased fringe) from the border.
const bg = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, 0, x, H - 1);
for (let y = 0; y < H; y++) stack.push(0, y, W - 1, y);
while (stack.length) {
  const y = stack.pop(), x = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const k = y * W + x;
  if (bg[k] || dist(k * 4) > 46) continue;
  bg[k] = 1;
  stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
}
// Alpha: none on flat grey, partial on the fringe, with the grey un-mixed.
const out = Buffer.from(data);
for (let k = 0; k < W * H; k++) {
  if (!bg[k]) continue;
  const i = k * 4;
  const a = Math.min(1, Math.max(0, (dist(i) - 12) / 34));
  if (a <= 0) { out[i + 3] = 0; continue; }
  for (const [c, g] of [[0, gr], [1, gg], [2, gb]]) out[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * g) / a)));
  out[i + 3] = Math.round(a * 255);
}
// Connected stickers (foreground = not background).
const label = new Int32Array(W * H).fill(-1);
const blobs = [];
for (let k = 0; k < W * H; k++) {
  if (bg[k] || label[k] >= 0) continue;
  const id = blobs.length;
  const b = { x0: W, y0: H, x1: 0, y1: 0, n: 0, sx: 0, sy: 0 };
  const q = [k];
  label[k] = id;
  while (q.length) {
    const c = q.pop();
    const x = c % W, y = (c - x) / W;
    b.n++; b.sx += x; b.sy += y;
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    for (const n of [c + 1, c - 1, c + W, c - W]) {
      if (n < 0 || n >= W * H || bg[n] || label[n] >= 0) continue;
      if (Math.abs((n % W) - x) > 1) continue;
      label[n] = id;
      q.push(n);
    }
  }
  blobs.push(b);
}
const big = blobs.filter((b) => b.n > (W * H) / 400);
// Reading order: rows by centre height, then left to right.
big.sort((a, b) => a.sy / a.n - b.sy / b.n);
const rows = [];
for (const b of big) {
  const cy = b.sy / b.n;
  const row = rows.find((r) => Math.abs(r.cy - cy) < H / 10);
  if (row) row.items.push(b); else rows.push({ cy, items: [b] });
}
const ordered = rows.flatMap((r) => r.items.sort((a, b) => a.sx / a.n - b.sx / b.n));
if (ordered.length !== names.length) {
  console.error(`expected ${names.length} stickers, found ${ordered.length}`);
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const full = sharp(out, { raw: { width: W, height: H, channels: 4 } });
const png = await full.png().toBuffer();
for (const [i, b] of ordered.entries()) {
  const pad = 3;
  const left = Math.max(0, b.x0 - pad), top = Math.max(0, b.y0 - pad);
  const w = Math.min(W - left, b.x1 - b.x0 + 1 + pad * 2), h = Math.min(H - top, b.y1 - b.y0 + 1 + pad * 2);
  await sharp(png)
    .extract({ left, top, width: w, height: h })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, alphaQuality: 95 })
    .toFile(`${outDir}/${names[i]}.webp`);
  console.log(names[i], `${w}x${h}`);
}
