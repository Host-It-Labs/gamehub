import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

/** The toon dishes (25 September 2026): each picked source is trimmed to its
 *  drawing and padded to the same margin, so every dish reads at one size. */
const directory = 'public/art/yata-dishes-v3';
const { dishes } = JSON.parse(
  await readFile(`${directory}/provenance.json`, 'utf8'),
);
const size = 512;
const margin = 0.05;
const tiles = [];
for (const [index, dish] of dishes.entries()) {
  const name = `yata-counter-${dish.set}-${dish.kind}-v3`;
  const source = `${directory}/${name}-${dish.pick}.png`;
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error(`${name}: generated alpha missing`);
  const inner = Math.round(size * (1 - 2 * margin));
  const drawing = await sharp(source)
    .trim({ threshold: 10 })
    .resize(inner, inner, { fit: 'contain', background: '#00000000' })
    .toBuffer();
  const output = `public/art/optimized/${name}.webp`;
  await sharp({
    create: { width: size, height: size, channels: 4, background: '#00000000' },
  })
    .composite([{ input: drawing, gravity: 'center' }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(output);
  const stats = await sharp(output).stats();
  if (stats.channels[3]?.min !== 0)
    throw new Error(`${name}: transparent pixels missing`);
  const tile = await sharp(output)
    .resize(240, 240)
    .flatten({ background: '#c7352b' })
    .png()
    .toBuffer();
  tiles.push({
    input: tile,
    left: (index % 6) * 240,
    top: Math.floor(index / 6) * 240,
  });
  console.log(
    `${name}: ${dish.pick} from ${metadata.width}x${metadata.height}`,
  );
}
await sharp({
  create: { width: 1440, height: 480, channels: 4, background: '#c7352b' },
})
  .composite(tiles)
  .png()
  .toFile(`${directory}/contact-sheet.png`);
