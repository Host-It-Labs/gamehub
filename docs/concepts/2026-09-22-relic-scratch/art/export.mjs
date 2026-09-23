import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = 'docs/concepts/2026-09-22-relic-scratch/art';
const sources = ['landscape-v1-initial.png', 'portrait-v1-initial.png', 'landscape-v1.png', 'portrait-v1.png', 'cover-v1.png'];
const prompts = ['landscape-v1.prompt.txt', 'portrait-v1.prompt.txt', 'cover-v1.prompt.txt', 'landscape-v1-clearance-edit.prompt.txt', 'portrait-v1-clearance-edit.prompt.txt'];
const outputs = [];
const write = async (input, path, transform) => {
  let pipeline = sharp(input);
  if (transform) pipeline = transform(pipeline);
  await pipeline.webp({ quality: 86 }).toFile(path);
  outputs.push(path);
};
await write(`${root}/sources/landscape-v1.png`, 'public/art/relic/scratch-desk-landscape-v1.webp');
await write(`${root}/sources/portrait-v1.png`, 'public/art/relic/scratch-desk-portrait-v1.webp');
const cover = `${root}/sources/cover-v1.png`;
const coverMetadata = await sharp(cover).metadata();
await write(cover, 'public/art/optimized/box-relic-scratch-v1.webp');
for (const width of [320, 640, 960]) {
  await write(cover, `public/art/optimized/box-relic-scratch-v1-${width}.webp`, image => image.resize(width, width));
}
const spineCrop = { left: 0, top: 0, width: 150, height: coverMetadata.height };
await write(cover, 'public/art/optimized/box-relic-scratch-v1-spine.webp', image => image.extract(spineCrop));
await sharp(cover).resize(160, 160).png().toFile(`${root}/cover-thumbnail-160.png`);
await sharp(`${root}/sources/landscape-v1.png`).extract({ left: 269, top: 179, width: 998, height: 666 }).resize(749, 500).png().toFile(`${root}/landscape-clear-region.png`);
await sharp(`${root}/sources/portrait-v1.png`).extract({ left: 77, top: 292, width: 870, height: 983 }).resize(435, 492).png().toFile(`${root}/portrait-clear-region.png`);
const describe = async path => {
  const buffer = await fs.readFile(path);
  const { width, height, format, hasAlpha } = await sharp(buffer).metadata();
  return { path, width, height, format, hasAlpha, bytes: buffer.byteLength, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
};
const sourceData = await Promise.all(sources.map(source => describe(`${root}/sources/${source}`)));
const exportData = await Promise.all(outputs.map(describe));
const promptData = await Promise.all(prompts.map(async prompt => {
  const path = `${root}/${prompt}`;
  const buffer = await fs.readFile(path);
  return { path, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
}));
await fs.writeFile(`${root}/provenance.json`, JSON.stringify({
  generatedAt: '2026-09-22',
  generator: 'Built-in image_gen.imagegen',
  mode: 'Three independent fresh written-only briefs, followed by one local placement correction per desk plate.',
  generationCache: '/Users/williamguinaudie/.codex/generated_images/01a0ca05-3c5e-7271-bb71-2d2796e3febc',
  cacheFiles: {
    'landscape-v1-initial.png': 'exec-798628f0-9f3e-471e-a5c8-89dc7249911b.png',
    'portrait-v1-initial.png': 'exec-2d85ccd2-73ee-4a9a-8472-c51f09de4074.png',
    'cover-v1.png': 'exec-81a5768c-ef6c-456b-8e37-3f92ccf32e94.png',
    'landscape-v1.png': 'exec-67ebd810-ac4e-470a-82b7-3ba642a96922.png',
    'portrait-v1.png': 'exec-b9444aee-3faf-4e27-b260-5f314254d281.png'
  },
  requestedDimensions: { landscape: [1536, 1024], portrait: [1024, 1536], cover: [1024, 1024] },
  sourceFiles: sourceData,
  promptFiles: promptData,
  exports: exportData,
  exportSettings: { webpQuality: 86, preserveNativeResolution: true, responsiveCoverWidths: [320, 640, 960], spineCrop },
  geometry: {
    type: 'Decorative full-bleed background, zero painted gameplay targets; all props are crop-safe peripheral decoration.',
    landscapeIntendedCalmRectangle: { left: 269, top: 179, width: 998, height: 666 },
    portraitIntendedCalmRectangle: { left: 77, top: 292, width: 870, height: 983 },
    protectedLandmarks: [],
    lighting: 'Upper-left marigold light; shadows down and right.',
    camera: 'Straight-down plane parallel to screen, no tilted play surface.'
  },
  review: {
    sourceImagesVisuallyInspected: true,
    coverTitle: 'Relic',
    coverTitleSpellingCorrect: true,
    thumbnailReviewSize: 160,
    oldImageReferences: false,
    nativeCoverDimensionDeviation: 'Requested 1024x1024; returned 1254x1254; native resolution preserved.',
    notes: [
      'Initial landscape brush and portrait bottom cluster encroached on the requested calm region; sources retained and corrected.',
      'Landscape correction clears the lower-left region. A small decorative foil curl at the extreme lower-right corner of the intended rectangle is retained; it is peripheral texture, not a gameplay landmark.',
      'Portrait correction moves the roller and brush below the intended calm region.',
      'Cover is a full-bleed square with one exact title and two partly scratched moon tickets.',
      'Static source-art and thumbnail review only; no browser, touch, gameplay alignment or live viewport acceptance is claimed.',
      'The artwork is one static plate per orientation. No animation layer masks are included.'
    ]
  }
}, null, 2) + '\n');
console.log(JSON.stringify(exportData, null, 2));
