/** Offline CPU comparison with the actual Three.js loader/decoder and Rota's
 * material tint/AO conversion. Rasterises toon bands; does not emulate the GPU
 * procedural surface/window shaders or shadows. No browser/server/GPU needed.
 * Run from the repository: node docs/concepts/2026-10-08-rota-compression/render.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import sharp from 'sharp';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const out = 'docs/concepts/2026-10-08-rota-compression';
const temp = '/private/tmp/rota-compression-review';
await mkdir(temp, { recursive: true });
const compiled = new Map();
async function compile(source) {
  if (compiled.has(source)) return compiled.get(source);
  const destination = `${temp}/${basename(source, extname(source))}.mjs`;
  compiled.set(source, destination);
  let code = ts.transpileModule(await readFile(source, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  for (const match of code.matchAll(/from ['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    const target = specifier.startsWith('.')
      ? pathToFileURL(
          await compile(resolve(dirname(source), `${specifier}.ts`)),
        ).href
      : import.meta.resolve(specifier);
    code = code.replace(match[0], `from '${target}'`);
  }
  await writeFile(destination, code);
  return destination;
}
const { Materials } = await import(
  pathToFileURL(
    await compile(resolve('components/game/rota/three/materials.ts')),
  ).href
);
const manifest = JSON.parse(await readFile('lib/games/rota/assets.json'));
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = {};
for (const [name, file] of Object.entries(manifest.models)) {
  models[name] = [];
  for (const path of [`assets/rota/build/${name}.glb`, `public${file.path}`]) {
    const bytes = await readFile(path);
    models[name].push(
      (
        await loader.parseAsync(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
          '',
        )
      ).scene,
    );
  }
}
const srgb = (v) =>
  Math.round(
    255 *
      THREE.MathUtils.clamp(
        v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055,
        0,
        1,
      ),
  );
const direction = new THREE.Vector3(0.7, 1.8, 1).normalize();
function render(root, bounds, width, height, view, spin) {
  const object = root.clone(true);
  object.traverse((o) => {
    if (o.isMesh) o.geometry = o.geometry.clone();
  });
  const materials = new Materials();
  materials.dress(object, 0, '#a93c32');
  if (spin)
    object.traverse((o) => {
      if (o.name.startsWith('wheel')) o.rotation.x += spin;
    });
  object.updateMatrixWorld(true);
  const center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) * 1.4;
  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(
    (-span * aspect) / 2,
    (span * aspect) / 2,
    span / 2,
    -span / 2,
    0.001,
    10,
  );
  const angle =
    view === 'rear'
      ? new THREE.Vector3(-0.8, 0.6, -1)
      : new THREE.Vector3(0.8, 1.3, 1);
  camera.position.copy(center).addScaledVector(angle.normalize(), 2);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const projection = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  const rgba = new Uint8Array(width * height * 4),
    depth = new Float64Array(width * height).fill(Infinity);
  for (let i = 0; i < width * height; i++)
    rgba.set([224, 221, 209, 255], i * 4);
  object.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry,
      position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal'),
      color = geometry.getAttribute('color'),
      index = geometry.index;
    const matrix = new THREE.Matrix4().multiplyMatrices(
      projection,
      mesh.matrixWorld,
    );
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const vertices = [];
    for (let i = 0; i < position.count; i++) {
      const p = new THREE.Vector3()
        .fromBufferAttribute(position, i)
        .applyMatrix4(matrix);
      const n = new THREE.Vector3()
        .fromBufferAttribute(normal, i)
        .applyNormalMatrix(normalMatrix);
      vertices.push({
        x: ((p.x + 1) * width) / 2,
        y: ((1 - p.y) * height) / 2,
        z: p.z,
        n,
        c: color ? [color.getX(i), color.getY(i), color.getZ(i)] : [1, 1, 1],
      });
    }
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3) {
      const a = vertices[index ? index.getX(i) : i],
        b = vertices[index ? index.getX(i + 1) : i + 1],
        c = vertices[index ? index.getX(i + 2) : i + 2];
      const material = Array.isArray(mesh.material)
        ? mesh.material[
            geometry.groups.find((g) => i >= g.start && i < g.start + g.count)
              ?.materialIndex ?? 0
          ]
        : mesh.material;
      const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (
        Math.abs(area) < 1e-10 ||
        (area > 0 && material.side === THREE.FrontSide)
      )
        continue;
      const xmin = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))),
        xmax = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const ymin = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))),
        ymax = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      for (let y = ymin; y <= ymax; y++)
        for (let x = xmin; x <= xmax; x++) {
          const px = x + 0.5,
            py = y + 0.5;
          const u = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area;
          const v = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
          const w = 1 - u - v;
          if (u < 0 || v < 0 || w < 0) continue;
          const z = a.z * u + b.z * v + c.z * w,
            offset = y * width + x;
          if (z >= depth[offset]) continue;
          depth[offset] = z;
          const nx = a.n.x * u + b.n.x * v + c.n.x * w,
            ny = a.n.y * u + b.n.y * v + c.n.y * w,
            nz = a.n.z * u + b.n.z * v + c.n.z * w;
          const light = Math.max(
            0,
            (nx * direction.x + ny * direction.y + nz * direction.z) /
              Math.hypot(nx, ny, nz),
          );
          const shade = material.isMeshBasicMaterial
            ? 1
            : light > 0.66
              ? 1
              : light > 0.25
                ? 178 / 255
                : 96 / 255;
          const rgb = [material.color.r, material.color.g, material.color.b];
          for (let k = 0; k < 3; k++) {
            const ao = material.vertexColors
              ? a.c[k] * u + b.c[k] * v + c.c[k] * w
              : 1;
            rgba[offset * 4 + k] = srgb(rgb[k] * ao * shade);
          }
        }
    }
  });
  materials.dispose();
  const mask = Uint8Array.from(depth, (v) => (Number.isFinite(v) ? 1 : 0));
  return { rgba, mask, width, height };
}
const samples = [
  ['vehicles', 'loco_steam'],
  ['vehicles', 'car_retro'],
  ['vehicles', 'lorry'],
  ['town', 'terrace_tall'],
  ['nature', 'oak_a'],
  ['works', 'mill_big'],
];
const rows = [],
  comparisons = [];
for (const [family, name] of samples) {
  const roots = models[family].map((scene) =>
    scene.children.find((o) => o.name === name),
  );
  const bounds = new THREE.Box3().setFromObject(roots[0]);
  const row = samples.findIndex((s) => s[1] === name);
  const pair = roots.map((root) => render(root, bounds, 480, 320, 'game', 0));
  for (let side = 0; side < 2; side++)
    rows.push({
      input: await sharp(pair[side].rgba, {
        raw: { width: 480, height: 320, channels: 4 },
      })
        .png()
        .toBuffer(),
      left: side * 480,
      top: row * 350 + 30,
    });
  let changed = 0,
    silhouette = 0,
    maxChannelError = 0;
  for (let i = 0; i < pair[0].mask.length; i++) {
    if (pair[0].mask[i] !== pair[1].mask[i]) silhouette++;
    if (!pair[0].mask[i] || !pair[1].mask[i]) continue;
    let delta = 0;
    for (let k = 0; k < 3; k++)
      delta = Math.max(
        delta,
        Math.abs(pair[0].rgba[i * 4 + k] - pair[1].rgba[i * 4 + k]),
      );
    if (delta) changed++;
    maxChannelError = Math.max(maxChannelError, delta);
  }
  comparisons.push({
    name,
    silhouettePixels: silhouette,
    changedPixels: changed,
    maxChannelError,
  });
  const label = `<svg width="960" height="30"><rect width="960" height="30" fill="#f6f2e9"/><g font-family="sans-serif" font-size="16" fill="#232b30"><text x="16" y="21">${name} · Original</text><text x="496" y="21">Meshopt</text></g></svg>`;
  rows.push({ input: Buffer.from(label), left: 0, top: row * 350 });
  if (family === 'vehicles') {
    const rear = roots.map((root) =>
      render(root, bounds, 640, 480, 'rear', 1.3),
    );
    const panels = await Promise.all(
      rear.map((p) =>
        sharp(p.rgba, {
          raw: { width: p.width, height: p.height, channels: 4 },
        })
          .png()
          .toBuffer(),
      ),
    );
    await sharp({
      create: { width: 1280, height: 480, channels: 4, background: '#e0ddd1' },
    })
      .composite(panels.map((input, i) => ({ input, left: i * 640, top: 0 })))
      .png()
      .toFile(`${out}/${name}-rear-spin.png`);
  }
}
await sharp({
  create: {
    width: 960,
    height: samples.length * 350,
    channels: 4,
    background: '#f6f2e9',
  },
})
  .composite(rows)
  .png()
  .toFile(`${out}/comparison.png`);
await writeFile(
  `${out}/render-metrics.json`,
  JSON.stringify(comparisons, null, 2) + '\n',
);
console.log(JSON.stringify(comparisons));
