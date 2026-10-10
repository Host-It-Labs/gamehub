// Mechanical delivery derivatives only: never paint over generated cover titles.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { boxCover } from '../lib/games/box-covers.ts';
const ids = ['undertow', 'wildgrove', 'midnight', 'orin', 'miro', 'impostor', 'diner', 'folio'];
// Chosen generations whose 1024 square is written here from the source PNG
// (docs/concepts/2026-10-03-impostor-diner-covers). The PNGs live in the art
// archive beside the repo (ART_ARCHIVE), not in git; without them the
// committed delivery files stay as they are.
const archive = process.env.ART_ARCHIVE ?? '../gamehub-art-archive/public/art';
const sources = {
  impostor: 'box-impostor-v2-a.png',
  diner: 'diner-square-b.png',
  folio: 'puzzles-square-a.png',
  miro: 'box-trivia-square-v1.png',
};
// Trivia's fresh sources stay in the workspace with their exact prompts;
// other accepted covers retain the sibling archive convention.
const triviaSources = 'assets/art/trivia/2026-10-04/sources';
// Puzzles (folio) and Diner covers of 9 October 2026 keep their chosen
// sources beside their exact prompts.
const freshSources = 'docs/concepts/2026-10-09-puzzles-rota-diner-covers/sources';
// Diner's cover of 10 October 2026 (a subtler cook).
const dinerSources = 'docs/concepts/2026-10-10-diner-cook/sources';
const roots = { miro: triviaSources, folio: freshSources, diner: dinerSources };
// Optional ids on the command line limit the run to those covers.
const only = process.argv.slice(2);
const manifestPath = 'lib/artwork-previews.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const id of only.length ? ids.filter((id) => only.includes(id)) : ids) {
  const cover = boxCover(id);
  const path = `public${cover}`;
  const source = sources[id] && `${roots[id] ?? archive}/${sources[id]}`;
  if (source && existsSync(source))
    await sharp(source).resize(1024, 1024).webp({ quality: 88 }).toFile(path);
  const metadata = await sharp(path).metadata();
  if (metadata.width !== 1024 || metadata.height !== 1024) throw new Error(`${id}: expected a 1024-square cover`);
  // Outer paper/scene texture wraps the narrow spine, avoiding the central title.
  await sharp(path).extract({ left: 0, top: 0, width: 64, height: 1024 })
    .webp({ quality: 88 }).toFile(path.replace('.webp', '-spine.webp'));
  const variants = [];
  for (const width of [320, 640]) {
    const target = cover.replace('.webp', `-${width}.webp`);
    await sharp(path).resize(width, width).webp({ quality: 88 }).toFile(`public${target}`);
    variants.push(`${target} ${width}w`);
  }
  variants.push(`${cover} 1024w`);
  const preview = await sharp(path).resize(24,24).webp({ quality: 35 }).toBuffer();
  manifest[cover] = { preview: `data:image/webp;base64,${preview.toString('base64')}`, srcSet: variants.join(', ') };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${ids.length} square covers, narrow spine textures and responsive variants.`);
