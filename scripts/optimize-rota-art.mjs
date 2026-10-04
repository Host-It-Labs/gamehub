// Rota's delivery files: the chosen square cover (1024 square, spine and
// responsive sizes) and the wide lid cover cut to its middle 3:1 band.
// Mechanical crops and resizes only; never paint over the generated title.
// Sources and prompts: docs/concepts/2026-09-29-rota-covers. The PNGs live
// in the art archive beside the repo (ART_ARCHIVE), not in git.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { boxCover, wideCover } from '../lib/games/box-covers.ts';

const archive = process.env.ART_ARCHIVE ?? '../gamehub-art-archive/public/art';
const find = (file) =>
  [`${archive}/${file}`, `public/art/${file}`].find((p) => existsSync(p));
const square = find('box-rota-v2-a.png');
const wide = find('box-rota-wide-v1-b.png');
if (!square || !wide) {
  // Without the sources the committed delivery files stay as they are.
  console.log('Rota cover sources not found; nothing to do.');
  process.exit(0);
}
const manifestPath = 'lib/artwork-previews.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const cover = boxCover('rota');
await sharp(square).resize(1024, 1024).webp({ quality: 88 }).toFile(`public${cover}`);
await sharp(`public${cover}`)
  .extract({ left: 0, top: 0, width: 64, height: 1024 })
  .webp({ quality: 88 })
  .toFile(`public${cover.replace('.webp', '-spine.webp')}`);
const squares = [];
for (const width of [320, 640]) {
  const target = cover.replace('.webp', `-${width}.webp`);
  await sharp(`public${cover}`).resize(width, width).webp({ quality: 88 }).toFile(`public${target}`);
  squares.push(`${target} ${width}w`);
}
squares.push(`${cover} 1024w`);
manifest[cover] = {
  preview: `data:image/webp;base64,${(await sharp(`public${cover}`).resize(24, 24).webp({ quality: 35 }).toBuffer()).toString('base64')}`,
  srcSet: squares.join(', '),
};

const lid = wideCover('rota');
const { width, height } = await sharp(wide).metadata();
const band = Math.round(width / 3);
const cut = () =>
  sharp(wide).extract({ left: 0, top: Math.round((height - band) / 2), width, height: band });
const lids = [];
for (const size of [768, 1536]) {
  const target = size === 1536 ? lid : lid.replace('.webp', `-${size}.webp`);
  await cut().resize(size, Math.round(size / 3)).webp({ quality: 82 }).toFile(`public${target}`);
  lids.push(`${target} ${size}w`);
}
manifest[lid] = {
  preview: `data:image/webp;base64,${(await cut().resize(36, 12).webp({ quality: 35 }).toBuffer()).toString('base64')}`,
  srcSet: lids.join(', '),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Prepared the Rota square cover, spine, sizes and wide lid.');
