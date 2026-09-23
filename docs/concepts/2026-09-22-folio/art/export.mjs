// Delivery derivatives only; generated title and illustration are unchanged.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = 'docs/concepts/2026-09-22-folio/art';
const generated = '/Users/williamguinaudie/.codex/generated_images/01a0ca16-c81e-79f3-8d71-b0172fca8a8b/exec-d442375e-fe52-490b-a42e-7709418a763e.png';
const source = `${root}/sources/cover-v1.png`;
const target = 'public/art/optimized/box-folio-blind-v1.webp';
await mkdir(`${root}/sources`, { recursive: true });
await mkdir('public/art/optimized', { recursive: true });
try { await readFile(source); } catch { await copyFile(generated, source); }
const metadata = await sharp(source).metadata();
if (metadata.width !== metadata.height) throw new Error('Folio cover must be square');
await sharp(source).webp({ quality: 90 }).toFile(target);
for (const width of [320, 640, 960]) {
  await sharp(source).resize(width, width).webp({ quality: 88 }).toFile(target.replace('.webp', `-${width}.webp`));
}
// Match the shared cover pattern: texture from the outer 1/16 of the source.
const spineWidth = Math.round(metadata.width / 16);
await sharp(source).extract({ left: 0, top: 0, width: spineWidth, height: metadata.height }).resize({ height: 960 }).webp({ quality: 88 }).toFile(target.replace('.webp', '-spine.webp'));
await sharp(source).resize(160, 160).png().toFile(`${root}/cover-thumbnail-160.png`);
const preview = await sharp(source).resize(24, 24).webp({ quality: 35 }).toBuffer();
const coverUrl = target.replace(/^public/, '');
await writeFile(`${root}/preview-entry.json`, JSON.stringify({
  [coverUrl]: {
    preview: `data:image/webp;base64,${preview.toString('base64')}`,
    srcSet: [320, 640, 960].map(width => `${coverUrl.replace('.webp', `-${width}.webp`)} ${width}w`).concat(`${coverUrl} ${metadata.width}w`).join(', '),
  },
}, null, 2) + '\n');
const checksum = createHash('sha256').update(await readFile(source)).digest('hex');
await writeFile(`${root}/provenance.json`, JSON.stringify({
  game: 'Folio',
  version: 'cover-v1',
  created: '2026-09-22',
  generator: 'built-in image_gen.imagegen',
  mode: 'generate',
  useCase: 'stylized-concept',
  references: [],
  prompt: `${root}/cover-v1.prompt.txt`,
  generatedSource: generated,
  archivedSource: source,
  sourceDimensions: { width: metadata.width, height: metadata.height },
  sourceSha256: checksum,
  final: target,
  derivatives: [320, 640, 960].map(width => target.replace('.webp', `-${width}.webp`)).concat(target.replace('.webp', '-spine.webp')),
  operations: ['PNG source preserved unchanged', 'WebP encoding', 'proportional resizing', 'outer-left texture strip for spine'],
  review: {
    title: 'Exact Folio spelling, one occurrence, large cobalt lettering',
    composition: 'Square full-bleed illustration; no border, mat or box mockup',
    motif: 'Folded newspaper mountain trail, sunrise, letter tiles, numbers, crossword and pencil',
    thumbnail: '160px thumbnail reviewed separately',
    browserOrTouch: 'Not checked in this asset task',
  },
}, null, 2) + '\n');
console.log(JSON.stringify({ source, target, nativeSize: metadata.width, spineWidth }, null, 2));
