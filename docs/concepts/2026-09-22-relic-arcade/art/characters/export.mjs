import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = 'docs/concepts/2026-09-22-relic-arcade/art/characters';
const bosses = `${root}/sources/bosses-v1.png`;
const cover = `${root}/sources/cover-v1.png`;
await sharp(bosses).webp({ quality: 92, alphaQuality: 100 }).toFile('public/art/relic/arcade-bosses-v1.webp');
await sharp(cover).webp({ quality: 90 }).toFile('public/art/optimized/box-relic-arcade-v1.webp');
for (const width of [320, 640, 960]) {
  await sharp(cover).resize(width, width).webp({ quality: 88 }).toFile(`public/art/optimized/box-relic-arcade-v1-${width}.webp`);
}
const coverMeta = await sharp(cover).metadata();
await sharp(cover).extract({ left: 0, top: 0, width: 150, height: coverMeta.height }).webp({ quality: 88 }).toFile('public/art/optimized/box-relic-arcade-v1-spine.webp');
await sharp(cover).resize(160, 160).png().toFile(`${root}/cover-thumbnail-160.png`);
await sharp(bosses).flatten({ background: '#ece5d6' }).resize(1152).png().toFile(`${root}/bosses-v1-alpha-preview.png`);

const { data, info } = await sharp(bosses).raw().toBuffer({ resolveWithObject: true });
const bounds = [];
for (let region = 0; region < 3; region++) {
  let left = info.width, top = info.height, right = 0, bottom = 0, boundaryPixels = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = region * 512; x < (region + 1) * 512; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 127) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      if (x === region * 512 || x === (region + 1) * 512 - 1) boundaryPixels++;
    }
  }
  bounds.push({ character: ['owl', 'tortoise', 'golem'][region], region, left, top, right, bottom, boundaryPixels });
}
let transparentPixels = 0, alphaMin = 255, alphaMax = 0;
for (let i = 3; i < data.length; i += 4) {
  alphaMin = Math.min(alphaMin, data[i]); alphaMax = Math.max(alphaMax, data[i]);
  if (data[i] === 0) transparentPixels++;
}
const sourceNames = ['bosses-v1-initial.png', 'bosses-v1.png', 'cover-v1.png'];
const sourceFiles = await Promise.all(sourceNames.map(async (name) => {
  const path = `${root}/sources/${name}`;
  const buffer = await fs.readFile(path);
  const { width, height, hasAlpha } = await sharp(buffer).metadata();
  return { path, width, height, hasAlpha, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
}));
await fs.writeFile(`${root}/provenance.json`, JSON.stringify({
  generatedAt: '2026-09-22',
  generator: 'Built-in image_gen.imagegen',
  originalBrief: 'Original magical mechanical skill arcade, written-only brief; no previous artwork supplied or opened.',
  prompts: ['bosses-v1.prompt.txt', 'cover-v1.prompt.txt', 'bosses-v1-spacing-edit.prompt.txt'],
  generationCache: '/Users/williamguinaudie/.codex/generated_images/01a0c9ca-5a9f-7160-b7d9-015edf02a201',
  generatedFiles: {
    initialBosses: 'exec-ad359716-1bc6-473f-941a-2256665baf7c.png',
    cover: 'exec-31bb5d7b-5370-433d-91e6-800386d6802e.png',
    spacingEditBosses: 'exec-f5f99fb5-a7ad-473d-92ae-3cfcbea1ec81.png'
  },
  editReference: 'sources/bosses-v1-initial.png (only the new generated character sheet)',
  sources: sourceFiles,
  exports: {
    bosses: 'public/art/relic/arcade-bosses-v1.webp',
    cover: 'public/art/optimized/box-relic-arcade-v1.webp',
    responsiveWidths: [320, 640, 960],
    spine: { path: 'public/art/optimized/box-relic-arcade-v1-spine.webp', sourceCrop: { left: 0, top: 0, width: 150, height: coverMeta.height } }
  },
  validation: {
    alpha: { min: alphaMin, max: alphaMax, transparentPixels, totalPixels: info.width * info.height },
    opaqueBoundsAtAlpha128: bounds,
    title: 'Relic', titleVisuallyReviewed: true, thumbnailPixels: 160,
    notes: [
      'Initial atlas rejected for cross-third silhouette overlap; retained for provenance.',
      'Spacing edit is used. Complete silhouettes are visible. One tortoise antialiased edge pixel touches x=512, inside the middle third.',
      'Golem crown rises above the requested 20% upper margin to y=141 (13.8%); full crown fits its third and remains visible.',
      'Requested cover size was 1024x1024; generator returned a 1254x1254 square. Native export preserves this resolution.',
      'Atlas preserves genuine generated alpha; RGB under transparent pixels can look like a dark glow in some previews. Flattened inspection shows clean character cutouts.',
      'Runtime WebP conversion preserves alpha. No previous cover images were opened or supplied.'
    ]
  }
}, null, 2) + '\n');
console.log(JSON.stringify({ bounds, alphaMin, alphaMax, transparentPixels, coverNative: [coverMeta.width, coverMeta.height] }, null, 2));
