/** Build Rota's shipped 3D assets and their manifest.
 *
 *   node scripts/rota-assets.mjs              compress and hash the built models
 *   node scripts/rota-assets.mjs --blender    rebuild the models in Blender first
 *   node scripts/rota-assets.mjs --blender --only=vehicles,nature
 *
 * Models are Blender scripts in assets/rota/blender (vehicles, buildings,
 * nature), run headless into assets/rota/build/<name>.glb. This optimises a
 * copy (the Blender masters stay untouched), hashes the compressed bytes in
 * public/3d/rota/models, and writes
 * lib/games/rota/assets.json from them. The tiles of
 * lib/games/rota/textures.json (scripts/rota-textures.mjs) are no longer
 * listed: the board is flat-coloured.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const BLENDER =
  process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const MODELS = ['vehicles', 'nature', 'town', 'works'];
const OUT = 'public/3d/rota/models';
const MANIFEST = 'lib/games/rota/assets.json';
const UV_BITS = 14;

/** Share compressed streams, not meshes or nodes. With the pinned 4.5.0
 * writer, the default groups ARRAY_BUFFER by accessor parent, producing
 * thousands of tiny views. Packing compatible streams gives four views per
 * file: less JSON/codec overhead and only four decoder calls. */
class PackedMeshoptCompression extends EXTMeshoptCompression {
  prewrite(context, type) {
    if (type === PropertyType.ACCESSOR)
      context.accessorUsageGroupedByParent.delete('ARRAY_BUFFER');
    return super.prewrite(context, type);
  }
}

/** Keep repeating UVs as floats: KHR_mesh_quantization's [0,1] UV grid cannot
 * represent them. Round only insignificant mantissa bits, without clamping,
 * rescaling, or requiring a texture transform the procedural shaders ignore. */
function quantizeUVs(document) {
  const seen = new Set();
  for (const mesh of document.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives()) {
      const uv = primitive.getAttribute('TEXCOORD_0');
      if (!uv || seen.has(uv)) continue;
      seen.add(uv);
      const values = uv.getArray();
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value === 0) continue;
        const step = 2 ** (Math.floor(Math.log2(Math.abs(value))) - UV_BITS);
        values[i] = Math.round(value / step) * step;
      }
    }
}

const args = process.argv.slice(2);
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const want = (name) => !only || only.includes(name);

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions([...ALL_EXTENSIONS, PackedMeshoptCompression])
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
const keep = {
  keepAttributes: true, // Physical UVs and baked AO are used by Materials.dress.
  keepLeaves: true,
  keepExtras: true, // Wheel radii and material hex colours belong to the runtime.
  keepIndices: true,
};

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
  const original = await readFile(src);
  const document = await io.readBinary(original);
  await document.transform(
    dedup({ keepUniqueNames: true }),
    prune(keep),
    // Same size-oriented reordering as meshopt({ level: 'high' }); no weld,
    // instancing or simplification that could change normals or named pivots.
    reorder({ encoder: MeshoptEncoder, target: 'size', cleanup: false }),
  );
  quantizeUVs(document);
  await document.transform(
    quantize({
      pattern: /^(POSITION|COLOR_\d+)$/,
      quantizationVolume: 'mesh',
      quantizePosition: 16,
      // AO is softened to 38% contrast at runtime; 8 bits are visually enough.
      quantizeColor: 8,
      // 'high' mode encodes normals with its 8-bit octahedral filter.
      cleanup: false,
    }),
    prune(keep),
  );
  // FILTER is glTF Transform's 'high' meshopt mode. The loader always has a
  // decoder, so mark it required: no uncompressed fallback bytes are shipped.
  document
    .createExtension(PackedMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const buffer = await io.writeBinary(document);
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 8);
  const destination = `${name}-${hash}.glb`;
  await writeFile(`${OUT}/${destination}`, buffer);
  for (const f of await readdir(OUT))
    if (f.startsWith(`${name}-`) && f.endsWith('.glb') && f !== destination)
      await rm(`${OUT}/${f}`);
  models[name] = {
    path: `/3d/rota/models/${name}-${hash}.glb`,
    bytes: buffer.length,
  };
  console.log(
    `${name}: ${original.length.toLocaleString('en-US')} -> ${buffer.length.toLocaleString('en-US')} bytes (${(original.length / buffer.length).toFixed(2)}x smaller)`,
  );
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
