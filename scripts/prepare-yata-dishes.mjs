import sharp from 'sharp';
import { readFile, copyFile, access } from 'node:fs/promises';

const directory = 'public/art/yata-dishes-v2';
const { dishes } = JSON.parse(
  await readFile(`${directory}/provenance.json`, 'utf8'),
);
const tiles = [];
for (const [index, dish] of dishes.entries()) {
  const name = `yata-counter-${dish.set}-${dish.kind}-v2`;
  const source = `${directory}/${name}.png`;
  try {
    await access(source);
  } catch {
    await copyFile(dish.source, source);
  }
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error(`${name}: generated alpha missing`);
  const output = `public/art/optimized/${name}.webp`;
  await sharp(source)
    .resize(512, 512, { fit: 'contain', background: '#00000000' })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(output);
  const stats = await sharp(output).stats();
  if (stats.channels[3]?.min !== 0)
    throw new Error(`${name}: transparent pixels missing`);
  const tile = await sharp(output)
    .resize(240, 240)
    .flatten({ background: '#efe2c6' })
    .png()
    .toBuffer();
  tiles.push({
    input: tile,
    left: (index % 6) * 240,
    top: Math.floor(index / 6) * 240,
  });
  console.log(`${name}: ${metadata.width}x${metadata.height}, alpha intact`);
}
await sharp({
  create: { width: 1440, height: 480, channels: 4, background: '#efe2c6' },
})
  .composite(tiles)
  .png()
  .toFile(`${directory}/contact-sheet.png`);
