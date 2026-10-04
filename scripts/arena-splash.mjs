/** Arena's painted screens outside the 3D battle: the loading splash and
 *  the Quest region maps, each in a wide and a tall cut, as webp under
 *  public/art/optimized (the picks are below; sources and prompts in
 *  assets/arena/concepts and docs/concepts/2026-09-29-arena-quest).
 *
 *   node scripts/arena-splash.mjs
 */
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const PICKS = {
  'arena-loading-wide': 'loading-wide-v1-b',
  'arena-loading-tall': 'loading-tall-v1-b',
  // The v2 maps (1 October 2026; docs/concepts/2026-10-01-arena-draft).
  'arena-quest-1-wide': 'quest-map-1-wide-v2-b',
  'arena-quest-1-tall': 'quest-map-1-tall-v2-b',
  'arena-quest-2-wide': 'quest-map-2-wide-v2-b',
  'arena-quest-2-tall': 'quest-map-2-tall-v2-b',
  'arena-quest-3-wide': 'quest-map-3-wide-v2-b',
  'arena-quest-3-tall': 'quest-map-3-tall-v2-a',
};

for (const [out, pick] of Object.entries(PICKS)) {
  const src = `assets/arena/concepts/${pick}.png`;
  if (!existsSync(src)) {
    console.log(`skip ${out}: ${src} missing`);
    continue;
  }
  const tall = out.endsWith('-tall');
  if (!out.startsWith('arena-quest-')) {
    await sharp(src)
      .resize(tall ? 1024 : 1600, undefined, { kernel: 'lanczos3' })
      .webp({ quality: 80, effort: 6 })
      .toFile(`public/art/optimized/${out}.webp`);
    console.log(`${out} ← ${pick}`);
    continue;
  }
  // The maps fill the whole screen, so they are never scaled down or
  // softened: the native cut for ordinary screens, and a 2x lanczos cut,
  // lightly sharpened, for high-density ones (the browser's own upscaling
  // of the native cut is what looked blurry).
  const { width } = await sharp(src).metadata();
  await sharp(src)
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(`public/art/optimized/${out}.webp`);
  await sharp(src)
    .resize(width * 2, undefined, { kernel: 'lanczos3' })
    .sharpen({ sigma: 1.1, m1: 0.6, m2: 2.2 })
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(`public/art/optimized/${out}-2x.webp`);
  console.log(`${out} (+2x) ← ${pick}`);
}
