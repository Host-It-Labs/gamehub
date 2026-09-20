import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
mkdirSync('public/art/optimized', { recursive: true });
for (const name of ['roka', 'talo', 'soma'])
  for (const variant of ['landscape', 'portrait']) {
    const base = `${name}-world-${variant}-v1`,
      out = `public/art/optimized/${base}.webp`;
    if (!existsSync(out))
      await sharp(`public/art/${base}.png`)
        .webp({ quality: 88, effort: 6 })
        .toFile(out);
  }
for (const name of ['roka-rescue', 'talo-relic', 'soma-repair']) {
  const out = `public/art/optimized/${name}-token-v1.webp`;
  if (!existsSync(out))
    await sharp(`public/art/${name}-token-v1.png`)
      .resize(256, 256, { fit: 'inside' })
      .webp({ quality: 90, effort: 6 })
      .toFile(out);
}
