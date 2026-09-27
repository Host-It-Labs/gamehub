// Mora's game-true covers (27 September 2026): same delivery steps as
// scripts/optimize-box-covers.mjs and scripts/optimize-wide-covers.mjs, Mora only.
// Run from the repo root: node docs/concepts/2026-09-27-mora-phone-boards/mora-covers.mjs
// The source PNGs live in the art archive beside the repo, not in git.
const archive = process.env.ART_ARCHIVE ?? '../gamehub-art-archive/public/art';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const manifestPath = 'lib/artwork-previews.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
// Square: 1024 master, spine, 320/640.
const cover = '/art/optimized/box-mora-game-v2.webp';
await sharp(`${archive}/box-mora-game-v2-a.png`).resize(1024, 1024).webp({ quality: 90 }).toFile(`public${cover}`);
await sharp(`public${cover}`).extract({ left: 0, top: 0, width: 64, height: 1024 }).webp({ quality: 88 }).toFile(`public${cover.replace('.webp', '-spine.webp')}`);
const variants = [];
for (const width of [320, 640]) {
  const target = cover.replace('.webp', `-${width}.webp`);
  await sharp(`public${cover}`).resize(width, width).webp({ quality: 88 }).toFile(`public${target}`);
  variants.push(`${target} ${width}w`);
}
variants.push(`${cover} 1024w`);
manifest[cover] = { preview: `data:image/webp;base64,${(await sharp(`public${cover}`).resize(24, 24).webp({ quality: 35 }).toBuffer()).toString('base64')}`, srcSet: variants.join(', ') };
// Wide: the middle 3:1 band.
const wide = '/art/optimized/box-mora-game-wide-v2.webp';
const source = `${archive}/box-mora-game-wide-v2-d.png`;
const { width, height } = await sharp(source).metadata();
const band = Math.round(width / 3);
const cut = () => sharp(source).extract({ left: 0, top: Math.round((height - band) / 2), width, height: band });
const wv = [];
for (const size of [768, 1536]) {
  const target = size === 1536 ? wide : wide.replace('.webp', `-${size}.webp`);
  await cut().resize(size, Math.round(size / 3)).webp({ quality: 82 }).toFile(`public${target}`);
  wv.push(`${target} ${size}w`);
}
manifest[wide] = { preview: `data:image/webp;base64,${(await cut().resize(36, 12).webp({ quality: 35 }).toBuffer()).toString('base64')}`, srcSet: wv.join(', ') };
for (const old of ['/art/optimized/box-mora-blind-v1.webp', '/art/optimized/box-mora-wide-v1.webp']) delete manifest[old];
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Mora covers ready');
