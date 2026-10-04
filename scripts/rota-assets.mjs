/** Build Rota's shipped 3D assets and their manifest.
 *
 *   node scripts/rota-assets.mjs              hash the built models (fast)
 *   node scripts/rota-assets.mjs --blender    rebuild the models in Blender first
 *   node scripts/rota-assets.mjs --blender --only=vehicles,nature
 *
 * Models are Blender scripts in assets/rota/blender (vehicles, buildings,
 * nature), run headless into assets/rota/build/<name>.glb. This copies each
 * into public/3d/rota/models with a content hash in its name and writes
 * lib/games/rota/assets.json from them. The tiles of
 * lib/games/rota/textures.json (scripts/rota-textures.mjs) are no longer
 * listed: the board is flat-coloured.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const BLENDER =
  process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const MODELS = ['vehicles', 'nature', 'town', 'works'];
const OUT = 'public/3d/rota/models';
const MANIFEST = 'lib/games/rota/assets.json';

const args = process.argv.slice(2);
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const want = (name) => !only || only.includes(name);

if (args.includes('--blender'))
  for (const name of MODELS.filter(want))
    execFileSync(
      BLENDER,
      [
        '-b',
        '--factory-startup',
        '--python',
        `assets/rota/blender/${name}.py`,
        '--',
        `assets/rota/build/${name}.glb`,
      ],
      { stdio: 'inherit' },
    );

await mkdir(OUT, { recursive: true });
const models = {};
for (const name of MODELS) {
  const src = `assets/rota/build/${name}.glb`;
  if (!existsSync(src)) continue;
  const buffer = await readFile(src);
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 8);
  for (const f of await readdir(OUT))
    if (f.startsWith(`${name}-`) && f !== `${name}-${hash}.glb`)
      await rm(`${OUT}/${f}`);
  await writeFile(`${OUT}/${name}-${hash}.glb`, buffer);
  models[name] = {
    path: `/3d/rota/models/${name}-${hash}.glb`,
    bytes: buffer.length,
  };
}
// The cel-shaded look (2 October 2026) draws no photographic tiles; set
// ROTA_TILES=1 to list lib/games/rota/textures.json again.
const textures =
  process.env.ROTA_TILES && existsSync('lib/games/rota/textures.json')
    ? JSON.parse(await readFile('lib/games/rota/textures.json', 'utf8'))
    : {};
await writeFile(MANIFEST, JSON.stringify({ textures, models }, null, 2) + '\n');
const total = (set) =>
  Object.values(textures).reduce(
    (s, t) => s + t.albedo[set].bytes + t.normal.bytes + t.orm.bytes,
    0,
  ) + Object.values(models).reduce((s, m) => s + m.bytes, 0);
console.log(
  `Rota assets: ${Object.keys(models).join(', ') || 'no models'}; hq ${(total('hq') / 1e6).toFixed(1)} MB, lite ${(total('lite') / 1e6).toFixed(1)} MB`,
);
