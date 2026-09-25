// Setup-lid delivery files: the chosen wide cover of each game cut to 3:1
// (its middle band, which the brief keeps for the title and subjects), plus
// the small Mora board previews for the Board choice. Mechanical crops and
// resizes only; never paint over the generated titles.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { wideCover } from '../lib/games/box-covers.ts';

/** The accepted generation for each game (docs/concepts/2026-09-25-wide-covers).
 * Source PNGs live in the art archive beside the repo, not in git. */
const archive = process.env.ART_ARCHIVE ?? '../gamehub-art-archive/public/art';
const sources = {
  undertow: 'box-nox-wide-v1-a.png',
  wildgrove: 'box-mora-wide-v1-a.png',
  midnight: 'box-yata-wide-v1-a.png',
  orin: 'box-know-me-wide-v1-a.png',
  miro: 'box-quiz-wide-v1-b.png',
  folio: 'box-folio-wide-v1-b.png',
  // Lucky (relic) cuts its own lid in scripts/optimize-lucky-art.mjs.
};
const manifestPath = 'lib/artwork-previews.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const [id, file] of Object.entries(sources)) {
  const source = `${archive}/${file}`;
  // Without the archive the committed delivery files stay as they are.
  if (!existsSync(source)) continue;
  const cover = wideCover(id);
  const { width, height } = await sharp(source).metadata();
  const band = Math.round(width / 3);
  const cut = () =>
    sharp(source).extract({
      left: 0,
      top: Math.round((height - band) / 2),
      width,
      height: band,
    });
  const variants = [];
  for (const size of [768, 1536]) {
    const target =
      size === 1536 ? cover : cover.replace('.webp', `-${size}.webp`);
    await cut()
      .resize(size, Math.round(size / 3))
      .webp({ quality: 82 })
      .toFile(`public${target}`);
    variants.push(`${target} ${size}w`);
  }
  const preview = await cut().resize(36, 12).webp({ quality: 35 }).toBuffer();
  manifest[cover] = {
    preview: `data:image/webp;base64,${preview.toString('base64')}`,
    srcSet: variants.join(', '),
  };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// Board previews: the middle 2:1 of each Mora overview plate.
for (const [plate, name] of [
  ['mora-paper-world-landscape-v5-a-overview', 'mora-observatory-preview-v1'],
  ['mora-floodline-landscape-v5-b-overview', 'mora-floodline-preview-v1'],
]) {
  const path = `public/art/optimized/${plate}.webp`;
  const { width, height } = await sharp(path).metadata();
  const band = Math.round(width / 2);
  await sharp(path)
    .extract({
      left: 0,
      top: Math.round((height - band) / 2),
      width,
      height: band,
    })
    .resize(480, 240)
    .webp({ quality: 78 })
    .toFile(`public/art/optimized/${name}.webp`);
}
console.log(
  `Prepared ${Object.keys(sources).length} wide setup covers and 2 board previews.`,
);
