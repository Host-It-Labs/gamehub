// Fresh renders of the attached space hardware from /alto/lab?stills=modules.
// Save window.altoStills PNGs in public/art/alto/stills-v3 before running:
//   node --experimental-strip-types scripts/alto-module-art.mjs
// Only trims, transparent padding and resizing; source renders stay intact.
import sharp from 'sharp';
import { moduleArtIds } from '../lib/games/alto/art.ts';

const clear = { r: 0, g: 0, b: 0, alpha: 0 };
for (const id of moduleArtIds) {
  const source = `public/art/alto/stills-v3/upgrade-${id}.png`;
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width,
    y0 = info.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] >= 24) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) throw new Error(`Empty module render: ${id}`);
  const width = x1 - x0 + 1,
    height = y1 - y0 + 1;
  const side = Math.ceil(Math.max(width, height) / 0.9);
  const left = Math.floor((side - width) / 2);
  const top = Math.floor((side - height) / 2);
  const padded = await sharp(source)
    .extract({ left: x0, top: y0, width, height })
    .extend({
      left,
      top,
      right: side - width - left,
      bottom: side - height - top,
      background: clear,
    })
    .png()
    .toBuffer();
  await sharp(padded)
    .resize(256, 256, { kernel: 'lanczos3' })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(`public/art/optimized/alto-upgrade-${id}-v3.webp`);
}
console.log(`${moduleArtIds.length} space-hardware thumbnails written.`);
