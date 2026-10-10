/** Build Arena's shipped 3D assets and their manifest.
 *
 *   node scripts/arena-assets.mjs            models and cards (fast)
 *   node scripts/arena-assets.mjs --textures also re-process the textures
 *   node scripts/arena-assets.mjs --only=troops,towers
 *
 * Models are Blender scripts in assets/arena/blender (towers, troops, props,
 * figures),
 * run headless and exported to GLB; card portraits come from
 * assets/arena/cards. Everything lands in public/3d/arena with a content
 * hash in its name, listed in lib/games/arena/assets.json, which the game's
 * loader and scripts/production-assets.mjs read.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const BLENDER =
  process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const MODELS = ['towers', 'troops', 'props', 'figures', 'cartoon_towers'];
/** The chosen portrait per card: each character as polished cartoon art,
 *  caught in action (attacking, charging, casting, firing, bracing), as many
 *  troops as the card deploys, in front of its era (1 October 2026, v7; see
 *  docs/concepts/2026-10-01-arena-draft/portraits.md). The v1–v6 sets are
 *  kept beside them in assets/arena/cards. Dino and Sumo use fresh v9 portraits
 *  matching their quality-first rebuild (concepts/2026-10-04-arena-quality-rebuild).
 *  Cowboy, Samurai and Wizard use fresh portraits matching the three-character
 *  rebuild (concepts/2026-10-04-arena-three-characters). Viking, Gladiator and
 *  Medic use fresh v8 portraits (concepts/2026-10-04-arena-viking-gladiator-medic).
 *  v13 (9 October 2026) gave every card but the Samurai and Cowboy a painted
 *  semi-realistic look (concepts/2026-10-09-arena-portraits/v13). v14
 *  (10 October 2026) replaces every card but the Cowboy with one cartoon set
 *  matching the 3D figures, from text alone
 *  (concepts/2026-10-10-arena-portraits). */
const CARD_ART = {
  archers: 'v14-a',
  ogre: 'v14-b',
  imps: 'v14-b',
  duelist: 'v14-a',
  ranger: 'v10-b',
  drake: 'v14-b',
  mage: 'v14-b',
  meteor: 'v14-b',
  pirate: 'v14-a',
  viking: 'v14-a',
  gladiator: 'v14-b',
  medic: 'v14-b',
  miner: 'v14-a',
  balloon: 'v14-b',
  inventor: 'v14-b',
  gunner: 'v14-a',
  // The eight troops of 1 October 2026 (docs/concepts/2026-10-01-arena-draft).
  diver: 'v14-a',
  sumo: 'v14-b',
  linebacker: 'v14-a',
  beekeeper: 'v14-b',
  drummer: 'v14-b',
  firefighter: 'v14-b',
  jetpack: 'v14-b',
  explorer: 'v14-b',
};
const CARDS = Object.keys(CARD_ART);
const MANIFEST = 'lib/games/arena/assets.json';

const args = process.argv.slice(2);
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const want = (name) => !only || only.includes(name);

const hashed = (buffer) =>
  createHash('sha256').update(buffer).digest('hex').slice(0, 8);

async function clean(dir, prefix) {
  await mkdir(dir, { recursive: true });
  for (const f of await readdir(dir))
    if (f.startsWith(prefix + '-')) await rm(`${dir}/${f}`);
}

if (args.includes('--textures'))
  execFileSync(process.execPath, ['scripts/arena-textures.mjs'], {
    stdio: 'inherit',
  });

const previous = existsSync(MANIFEST)
  ? JSON.parse(await readFile(MANIFEST, 'utf8'))
  : { models: {}, cards: {} };
const textures = JSON.parse(
  await readFile('lib/games/arena/textures.json', 'utf8'),
);
const models = { ...previous.models };
await mkdir('work/arena', { recursive: true });
for (const name of MODELS) {
  const script = `assets/arena/blender/${name}.py`;
  if (!want(name) || !existsSync(script)) continue;
  const raw = `work/arena/${name}.glb`;
  console.log(`Blender: ${name}`);
  const log = execFileSync(
    BLENDER,
    ['-b', '--factory-startup', '--python', script, '--', raw],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (/Traceback|Error:/.test(log) && !log.includes('EXPORTED'))
    throw new Error(`${name} failed:\n${log.slice(-3000)}`);
  for (const line of log.split('\n'))
    if (/^(TROOP|FIGURE) /.test(line))
      console.log('  ' + line.split(', parts')[0]);
  const buffer = await readFile(raw);
  await clean('public/3d/arena/models', name);
  const file = `${name}-${hashed(buffer)}.glb`;
  await writeFile(`public/3d/arena/models/${file}`, buffer);
  models[name] = { path: `/3d/arena/models/${file}`, bytes: buffer.length };
  console.log(`  ${file} ${(buffer.length / 1024).toFixed(0)} KiB`);
}

// A card rebuild lists exactly the deck's cards (the Knight left in v2).
const cards = want('cards') ? {} : { ...previous.cards };
if (want('cards')) {
  await clean('public/3d/arena/cards', '');
  for (const f of await readdir('public/3d/arena/cards'))
    await rm(`public/3d/arena/cards/${f}`);
  for (const id of CARDS) {
    const src = `assets/arena/cards/card-${id}-${CARD_ART[id]}.png`;
    const buffer = await sharp(src)
      .resize(480, 480, { kernel: 'lanczos3' })
      .webp({ quality: 86, effort: 6 })
      .toBuffer();
    const file = `${id}-${hashed(buffer)}.webp`;
    await writeFile(`public/3d/arena/cards/${file}`, buffer);
    cards[id] = { path: `/3d/arena/cards/${file}`, bytes: buffer.length };
  }
}

// Library covers: the square box (with its spine strip and responsive sizes)
// and the 3:1 setup lid cut from the middle band of the wide generation.
if (want('covers')) {
  const previewsPath = 'lib/artwork-previews.json';
  const previews = JSON.parse(await readFile(previewsPath, 'utf8'));
  // Cartoon covers matching the v14 card set (v6, 10 October 2026), served as v3.
  const square = 'assets/arena/concepts/box-arena-square-v6-a.png';
  const cover = '/art/optimized/box-arena-blind-v3.webp';
  await sharp(square)
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .webp({ quality: 88 })
    .toFile(`public${cover}`);
  await sharp(`public${cover}`)
    .extract({ left: 0, top: 0, width: 64, height: 1024 })
    .webp({ quality: 88 })
    .toFile(`public${cover.replace('.webp', '-spine.webp')}`);
  const variants = [];
  for (const width of [320, 640]) {
    const target = cover.replace('.webp', `-${width}.webp`);
    await sharp(`public${cover}`)
      .resize(width, width)
      .webp({ quality: 88 })
      .toFile(`public${target}`);
    variants.push(`${target} ${width}w`);
  }
  variants.push(`${cover} 1024w`);
  const tiny = await sharp(`public${cover}`)
    .resize(24, 24)
    .webp({ quality: 35 })
    .toBuffer();
  previews[cover] = {
    preview: `data:image/webp;base64,${tiny.toString('base64')}`,
    srcSet: variants.join(', '),
  };
  const wideSrc = 'assets/arena/concepts/box-arena-wide-v6-b.png';
  const wide = '/art/optimized/box-arena-wide-v3.webp';
  const { width, height } = await sharp(wideSrc).metadata();
  const band = Math.round(width / 3);
  const cut = () =>
    sharp(wideSrc).extract({
      left: 0,
      top: Math.round((height - band) / 2),
      width,
      height: band,
    });
  const wideSet = [];
  for (const size of [768, 1536]) {
    const target =
      size === 1536 ? wide : wide.replace('.webp', `-${size}.webp`);
    await cut()
      .resize(size, Math.round(size / 3))
      .webp({ quality: 82 })
      .toFile(`public${target}`);
    wideSet.push(`${target} ${size}w`);
  }
  const wideTiny = await cut().resize(36, 12).webp({ quality: 35 }).toBuffer();
  previews[wide] = {
    preview: `data:image/webp;base64,${wideTiny.toString('base64')}`,
    srcSet: wideSet.join(', '),
  };
  await writeFile(previewsPath, `${JSON.stringify(previews, null, 2)}\n`);
  console.log('Covers: square, spine and wide lid written.');
}

await writeFile(
  MANIFEST,
  `${JSON.stringify({ textures, models, cards }, null, 2)}\n`,
);
const all = [
  ...Object.values(textures).flatMap((t) => [
    t.albedo.hq,
    t.albedo.lite,
    t.normal,
    t.orm,
  ]),
  ...Object.values(models),
  ...Object.values(cards),
];
console.log(
  `Manifest: ${all.length} files, ${(all.reduce((s, f) => s + f.bytes, 0) / 1024 / 1024).toFixed(1)} MiB`,
);
