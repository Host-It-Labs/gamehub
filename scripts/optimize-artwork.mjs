// Keep generated PNG sources; publish responsive WebP derivatives with alpha intact.
import sharp from 'sharp';
import portraitArt from '../lib/games/observatory-portrait-art.json' with { type: 'json' };
import observatoryArt from '../lib/games/observatory-art.json' with { type: 'json' };
import { mkdir, writeFile } from 'node:fs/promises';
const covers = [
  'blackwake-cover-v1',
  'elsewild-cover-v1',
  'nightshift-cover-v1',
  'box-undertow-v1',
  'box-wildgrove-v1',
  'box-midnight-v1',
  'box-undertow-v2',
  'box-wildgrove-v2',
  'box-midnight-v2',
];
await mkdir('public/art/optimized', { recursive: true });
const manifest = {};
for (const name of covers) {
  const source = `public/art/${name}.png`;
  const preview = await sharp(source)
    .resize(24)
    .webp({ quality: 35 })
    .toBuffer();
  const variants = [];
  const { width: sourceWidth } = await sharp(source).metadata();
  for (const width of new Set(
    [320, 640, 960].map((w) => Math.min(w, sourceWidth)),
  )) {
    const filename = `${name}-${width}.webp`;
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(`public/art/optimized/${filename}`);
    variants.push(`/art/optimized/${filename} ${width}w`);
  }
  manifest[`/art/${name}.png`] = {
    preview: `data:image/webp;base64,${preview.toString('base64')}`,
    srcSet: variants.join(', '),
  };
}
for (const name of [
  'blackwake-table-v1',
  'elsewild-observatory-v3',
  'observatory-diorama-v1',
  'observatory-diorama-v2',
  'observatory-paper-v3',
  'observatory-unified-v1',
  'observatory-panorama-v2',
  'observatory-paperland-v4',
  'elsewild-lagoon-v3',
  'floodline-paper-v1',
]) {
  await sharp(`public/art/${name}.png`)
    .resize({ width: 1560, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(`public/art/optimized/${name}.webp`);
}
// Preserve native scene resolution; the gameplay crop shares the geometry manifest.
for (const art of [observatoryArt, portraitArt]) {
  await sharp(`public${art.source}`).webp({ quality: 94 }).toFile(`public${art.image}`);
  await sharp(`public${art.source}`).extract(art.crop).webp({ quality: 94 }).toFile(`public${art.boardImage}`);
  await sharp(`public${art.source}`).extract(art.overview).webp({ quality: 94 }).toFile(`public${art.overviewImage}`);
}
await sharp('public/art/mora-paper-fibers-v1.png').webp({quality:85}).toFile('public/art/optimized/mora-paper-fibers-v1.webp');

// Observatory's full-screen scenery stays static and compact.
await sharp('public/art/observatory-surroundings-v1.png')
  .webp({ quality: 76, effort: 6 })
  .toFile('public/art/optimized/observatory-surroundings-v1.webp');

for (const set of [
  'elsewild-inland',
  'elsewild-coast',
  'nightshift-lane',
  'nightshift-alley',
]) {
  for (let kind = 0; kind < 6; kind++) {
    const name = `${set}-${kind}-v1`;
    await sharp(`public/art/${name}.png`)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(`public/art/optimized/${name}.webp`);
  }
}
await writeFile(
  'lib/artwork-previews.json',
  JSON.stringify(manifest, null, 2) + '\n',
);

// Rebuild new Mora sprites from their preserved alpha atlases.
await import('./prepare-mora-paper-creatures.mjs');
