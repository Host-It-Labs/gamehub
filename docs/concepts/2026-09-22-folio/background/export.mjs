// Run from the repository root: node docs/concepts/2026-09-22-folio/background/export.mjs
import sharp from 'sharp';
const dir = 'docs/concepts/2026-09-22-folio/background';
for (const [src, name, widths] of [
  ['bg-landscape-a.png', 'folio-bg-landscape', [1536, 960]],
  ['bg-portrait-a.png', 'folio-bg-portrait', [1024]],
])
  for (const w of widths)
    await sharp(`${dir}/${src}`)
      .resize({ width: w })
      .webp({ quality: 78 })
      .toFile(`public/art/folio/${name}-${w}.webp`);
