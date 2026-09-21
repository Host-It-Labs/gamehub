// Mechanical delivery derivatives only: never paint over generated cover titles.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { boxCover } from '../lib/games/box-covers.ts';
const ids = ['undertow', 'wildgrove', 'midnight', 'orin', 'miro'];
const manifestPath = 'lib/artwork-previews.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const id of ids) {
  const cover = boxCover(id);
  const path = `public${cover}`;
  const metadata = await sharp(path).metadata();
  if (metadata.width !== 1024 || metadata.height !== 1024) throw new Error(`${id}: expected a 1024-square cover`);
  // Outer paper/scene texture wraps the narrow spine, avoiding the central title.
  await sharp(path).extract({ left: 0, top: 0, width: 64, height: 1024 })
    .webp({ quality: 88 }).toFile(path.replace('.webp', '-spine.webp'));
  const variants = [];
  for (const width of [320, 640]) {
    const target = cover.replace('.webp', `-${width}.webp`);
    await sharp(path).resize(width, width).webp({ quality: 88 }).toFile(`public${target}`);
    variants.push(`${target} ${width}w`);
  }
  variants.push(`${cover} 1024w`);
  const preview = await sharp(path).resize(24,24).webp({ quality: 35 }).toBuffer();
  manifest[cover] = { preview: `data:image/webp;base64,${preview.toString('base64')}`, srcSet: variants.join(', ') };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${ids.length} square covers, narrow spine textures and responsive variants.`);
