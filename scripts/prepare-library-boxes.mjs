import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

// Measured boundaries in the newly generated 1536 × 1024 flat print sheets.
// Keep a few pixels clear of the decorative division on both extracted faces.
const sheets = [
  ['undertow', 1236, 1254],
  ['wildgrove', 1268, 1288],
  ['midnight', 1244, 1254],
  ['orin', 1252, 1268],
  ['vela', 1261, 1271],
  ['miro', 1266, 1288],
];
const root = 'public/art/library-boxes-v4';
const tiles = [];
const manifest = [];
for (const [id, frontEnd, spineStart] of sheets) {
  const source = `${root}/${id}-source.png`;
  const { width, height } = await sharp(source).metadata();
  if (width !== 1536 || height !== 1024) throw new Error(`Unexpected source size: ${id}`);
  const front = `public/art/optimized/box-${id}-v4-front.webp`;
  const spine = `public/art/optimized/box-${id}-v4-spine.webp`;
  await sharp(source).extract({ left: 0, top: 0, width: frontEnd, height }).resize({ width: 960 }).webp({ quality: 88 }).toFile(front);
  await sharp(source).extract({ left: spineStart, top: 0, width: width - spineStart, height }).resize({ height: 960 }).webp({ quality: 88 }).toFile(spine);
  const tile = await sharp(source).resize(480, 320).png().toBuffer();
  tiles.push({ input: tile, left: (tiles.length % 2) * 480, top: Math.floor(tiles.length / 2) * 320 });
  manifest.push({ id, source, front, spine, frontCrop: [0, 0, frontEnd, height], spineCrop: [spineStart, 0, width - spineStart, height] });
}
await sharp({ create: { width: 960, height: 960, channels: 3, background: '#e8e1d4' } }).composite(tiles).png().toFile(`${root}/contact-sheet.png`);
await writeFile(`${root}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${sheets.length} fronts and companion spines.`);
