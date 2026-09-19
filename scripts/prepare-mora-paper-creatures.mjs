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
    version: 1,
    padding: 2,
    bounds: [
      [26, 49, 492, 461],
      [548, 74, 979, 477],
      [1085, 65, 1512, 484],
      [24, 576, 486, 968],
      [525, 571, 1011, 922],
      [1043, 577, 1518, 926],
    ],
  },
};

await fs.mkdir(path.join(root, 'public/art/optimized'), { recursive: true });
for (const [set, { version, padding, bounds }] of Object.entries(sets)) {
  const source = path.join(
    root,
    `public/art/mora-paper-${set}-atlas-v${version}.png`,
  );
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
console.log('Prepared 12 Mora paper creature sprites from source atlases.');
