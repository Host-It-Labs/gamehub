// Keep generated PNG sources; publish responsive WebP derivatives with alpha intact.
import sharp from 'sharp';
import { access, mkdir, writeFile } from 'node:fs/promises';
// Superseded PNG sources live in the artwork archive outside the repo; skip what is not here.
const archived = async (source) => {
  try {
    await access(source);
    return false;
  } catch {
    console.warn(`skip ${source} (archived source)`);
    return true;
  }
};
const covers = [
  'blackwake-cover-v1',
  'elsewild-cover-v1',
  'nightshift-cover-v1',
  'box-undertow-v3',
  'box-wildgrove-v3',
  'box-midnight-v3',
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
  if (await archived(`public/art/${name}.png`)) continue;
  await sharp(`public/art/${name}.png`)
    .resize({ width: 1560, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(`public/art/optimized/${name}.webp`);
}
// Illustrated world scenes and their crops belong to optimize-paper-worlds.mjs,
// which also knows about the variants and encodes the full scene one step
// lighter. Running both would quietly re-encode the same files two ways.
if (!(await archived('public/art/mora-paper-fibers-v1.png'))) {
  await sharp('public/art/mora-paper-fibers-v1.png')
    .webp({ quality: 85 })
    .toFile('public/art/optimized/mora-paper-fibers-v1.webp');
}

// Observatory's full-screen scenery stays static and compact.
if (!(await archived('public/art/observatory-surroundings-v1.png'))) {
  await sharp('public/art/observatory-surroundings-v1.png')
    .webp({ quality: 76, effort: 6 })
    .toFile('public/art/optimized/observatory-surroundings-v1.webp');
}

for (const set of [
  'elsewild-inland',
  'elsewild-coast',
  'nightshift-lane',
  'nightshift-alley',
]) {
  for (let kind = 0; kind < 6; kind++) {
    const name = `${set}-${kind}-v1`;
    if (await archived(`public/art/${name}.png`)) continue;
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

// Preserve the shared generated-title cover derivatives and responsive entries.
await import('./optimize-box-covers.mjs');
await import('./optimize-wide-covers.mjs');
