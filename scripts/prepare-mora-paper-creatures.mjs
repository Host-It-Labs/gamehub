import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Inclusive alpha bounds measured from each generated atlas. Grid slicing would
// clip the fox, marten and hare because their silhouettes cross nominal cells.
const sets = {
  inland: {
    version: 2,
    padding: 6,
    bounds: [
      [43, 53, 533, 478],
      [643, 49, 913, 494],
      [1099, 53, 1443, 475],
      [40, 591, 500, 946],
      [597, 624, 966, 949],
      [1099, 509, 1433, 975],
    ],
  },
  coast: {
    // Floodline Station v2 atlas (19 September 2026): crab, turtle, seal, octopus, tern, seahorse.
    version: 2,
    padding: 6,
    bounds: [
      [56, 98, 464, 448],
      [532, 127, 986, 447],
      [1036, 120, 1493, 417],
      [47, 561, 477, 926],
      [532, 562, 1010, 910],
      [1147, 528, 1387, 942],
    ],
  },
};

await fs.mkdir(path.join(root, 'public/art/optimized'), { recursive: true });
for (const [set, { version, padding, bounds }] of Object.entries(sets)) {
  const source = path.join(
    root,
    `public/art/mora-paper-${set}-atlas-v${version}${set === 'coast' ? '-a' : ''}.png`,
  );
  try {
    await fs.access(source);
  } catch {
    // Retired atlases live outside the repo; their sprites are already delivered.
    console.warn(`skipping ${set}: ${path.relative(root, source)} is not in the repo`);
    continue;
  }
  for (const [kind, [x0, y0, x1, y1]] of bounds.entries()) {
    // Preserve the original generated alpha; no color key or masking is used.
    const sprite = await sharp(source)
      .extract({
        left: x0 - padding,
        top: y0 - padding,
        width: x1 - x0 + 1 + padding * 2,
        height: y1 - y0 + 1 + padding * 2,
      })
      .resize(460, 460, { fit: 'inside' })
      .toBuffer();
    const { width, height } = await sharp(sprite).metadata();
    await sharp({
      create: { width: 512, height: 512, channels: 4, background: '#00000000' },
    })
      .composite([
        {
          input: sprite,
          left: Math.floor((512 - width) / 2),
          top: Math.floor((512 - height) / 2),
        },
      ])
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(
        path.join(
          root,
          `public/art/optimized/mora-paper-${set}-${kind}-v${version}.webp`,
        ),
      );
  }
}
console.log('Prepared Mora paper creature sprites from the atlases present in public/art.');
