import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

/** Trim Yata's fresh Blender stills and their contact shadows into a 4:3
 *  frame. Tokyo v2 is built by assets/yata/blender/tokyo_toon.py.
 *  `node scripts/yata-dish-renders.mjs [tokyo] [source-directory] [v2]`
 *  Pass the old source directory and v1 to reproduce the original exports. */
const menu = process.argv[2] ?? 'tokyo';
const version = process.argv[4] ?? 'v2';
const source = process.argv[3] ?? (version === 'v1'
  ? `assets/yata/renders/${menu}`
  : `assets/yata/renders/${menu}-toon-${version}`);
const width = 720;
const height = 540;
const margin = 0.02;
const kinds = [0, 1, 2, 3, 4, 5];
const tiles = [];
await mkdir('public/art/optimized', { recursive: true });
for (const kind of kinds) {
  const input = `${source}/${menu}-${kind}.png`;
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) throw new Error(`${input}: render has no alpha`);
  // v2 renders clean transparent film directly: retain the modeled contact
  // shadow and full opacity of the cel colours. Only legacy v1 needs the
  // ambient shadow-catcher cleanup used by its original export.
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (version === 'v1') {
    const floor = 26;
    const fade = 0.12 * info.width;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        const edge = Math.min(1, Math.min(x, y, info.width - 1 - x, info.height - 1 - y) / fade);
        data[i + 3] = Math.round(Math.max(0, (data[i + 3] - floor) / (255 - floor)) * 255 * edge);
      }
  }
  const cleaned = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  // Trim where the dish and its shadow are still visible.
  let [left, top, right, bottom] = [info.width, info.height, 0, 0];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 10) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left || bottom < top) throw new Error(`${input}: empty render`);
  const inner = [Math.round(width * (1 - 2 * margin)), Math.round(height * (1 - 2 * margin))];
  const dish = await cleaned
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(inner[0], inner[1], { fit: 'contain', background: '#00000000' })
    .png()
    .toBuffer();
  const output = `public/art/optimized/yata-dish3d-${menu}-${kind}-${version}.webp`;
  await sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite([{ input: dish, gravity: 'center' }])
    // Lossless colour and alpha keep the cel bands and ink edges clean.
    .webp(version === 'v1'
      ? { quality: 88, alphaQuality: 90, effort: 6 }
      : { lossless: true, effort: 6 })
    .toFile(output);
  tiles.push(await sharp(output).resize(360, 270).flatten({ background: '#c7352b' }).png().toBuffer());
  console.log(`${output}: from ${right - left + 1}x${bottom - top + 1} of ${meta.width}x${meta.height}`);
}
// Contact sheet on the red enamel for review.
await sharp({ create: { width: 360 * 3, height: 270 * 2, channels: 3, background: '#c7352b' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % 3) * 360, top: Math.floor(i / 3) * 270 })))
  .png()
  .toFile(`${source}/contact-sheet.png`);
