import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Load the authored geometry and animator directly; only the browser renderer
// is absent. Three's add-ons are the real installed implementations.
const root = fileURLToPath(new URL('..', import.meta.url));
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {};
  modules.set(file, exports);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    Float32Array,
    require(id) {
      if (id === 'three') return THREE;
      if (id.endsWith('RoundedBoxGeometry.js')) return { RoundedBoxGeometry };
      if (id.endsWith('BufferGeometryUtils.js')) return { mergeGeometries };
      return load(resolve(dirname(file), `${id}.ts`));
    },
  });
  return exports;
}
const { buildModel, beltModel, pose } = load(
  resolve(root, 'components/game/relic-factory/models.ts'),
);
const { rail } = load(resolve(root, 'components/game/relic-factory/kit.ts'));
const { makeMaterials } = load(
  resolve(root, 'components/game/relic-factory/look.ts'),
);
const kinds = [
  'printer',
  'bot',
  'cashier',
  'splitter',
  'lamp',
  'ink',
  'stamper',
  'gilder',
  'charm',
  'bundler',
];
const models = Object.fromEntries(
  kinds.map((kind) => [kind, buildModel(kind)]),
);
const belts = Object.fromEntries(
  ['straight', 'left', 'right'].map((shape) => [shape, beltModel(shape)]),
);
const geometries = (model) => [
  ...Object.values(model.body),
  ...(model.parts?.flatMap((part) => Object.values(part.geos)) ?? []),
  ...(model.top ? [model.top] : []),
];
const context = (overrides = {}) => ({
  t: 1.4,
  work: -1,
  status: 'idle',
  since: 99,
  turn: 0,
  boost: false,
  hold: 0,
  seed: 0.3,
  ...overrides,
});
function posed(kind, name, c) {
  const output = { p: new THREE.Vector3(), r: new THREE.Euler(), s: 1 };
  pose(kind, name, context(c), output);
  return output;
}

await test('every detailed model remains a bounded collection of instanced material batches', () => {
  let total = 0;
  for (const [kind, model] of Object.entries({ ...models, ...belts })) {
    const geos = geometries(model);
    assert.ok(geos.length <= 13, `${kind}: too many material batches`);
    const triangles = geos.reduce(
      (sum, geo) =>
        sum + (geo.index?.count ?? geo.getAttribute('position').count) / 3,
      0,
    );
    total += triangles;
    assert.ok(
      triangles <= (model.parts ? 12_000 : 3_000),
      `${kind}: ${triangles} triangles`,
    );
    for (const geo of geos) {
      const positions = geo.getAttribute('position');
      for (const name of ['normal', 'uv'])
        assert.equal(
          geo.getAttribute(name).count,
          positions.count,
          `${kind}: ${name} merge contract`,
        );
      for (const [name, attribute] of Object.entries(geo.attributes))
        for (const value of attribute.array)
          assert.ok(Number.isFinite(value), `${kind}: non-finite ${name}`);
    }
  }
  assert.ok(total < 100_000, `${total} shared template triangles`);
});

await test('static and animated silhouettes stay inside their cell and the camera height allowance', () => {
  const point = new THREE.Vector3(),
    matrix = new THREE.Matrix4(),
    scale = new THREE.Vector3();
  const states = [
    context(),
    ...[0, 0.25, 0.75, 0.99, 1].map((work) =>
      context({ status: 'work', work, boost: true, hold: 3 }),
    ),
    ...[0, 0.08, 0.2, 0.65].map((since) => context({ since })),
    context({ status: 'stuck' }),
    context({ status: 'full', turn: Math.PI / 2 }),
  ];
  function check(kind, geometry, transform, height) {
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(transform);
      assert.ok(
        Math.abs(point.x) <= 0.501 && Math.abs(point.z) <= 0.501,
        `${kind}: extends into another cell at ${point.toArray().join(', ')}`,
      );
      assert.ok(
        point.y >= -0.001 && point.y <= height + 0.005,
        `${kind}: exceeds declared height ${height} at ${point.y}`,
      );
    }
  }
  for (const [kind, model] of Object.entries(models)) {
    assert.ok(model.height <= 0.9, `${kind}: camera allowance`);
    for (const geometry of Object.values(model.body))
      check(kind, geometry, matrix.identity(), model.height);
    for (const c of states)
      for (const part of model.parts) {
        const motion = posed(kind, part.name, c);
        matrix
          .makeRotationFromEuler(motion.r)
          .scale(scale.setScalar(motion.s))
          .setPosition(part.pivot.clone().add(motion.p));
        for (const geometry of Object.values(part.geos))
          check(kind, geometry, matrix, model.height);
      }
  }
  for (const [shape, model] of Object.entries(belts))
    for (const geometry of geometries(model))
      check(shape, geometry, matrix.identity(), 0.15);
});

await test('curved belt tops and bevelled rails face outwards without faceted curve normals', () => {
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const geometric = new THREE.Vector3(),
    authored = new THREE.Vector3();
  for (const belt of Object.values(belts)) {
    const top = belt.top,
      position = top.getAttribute('position'),
      index = top.index;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i));
      b.fromBufferAttribute(position, index.getX(i + 1));
      c.fromBufferAttribute(position, index.getX(i + 2));
      geometric.crossVectors(b.sub(a), c.sub(a));
      assert.ok(geometric.y > 0, 'the moving belt surface must face up');
    }
    const edge = rail(belt.path, 0.035, 0.05, 0.075);
    const p = edge.getAttribute('position'),
      n = edge.getAttribute('normal');
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i);
      b.fromBufferAttribute(p, i + 1);
      c.fromBufferAttribute(p, i + 2);
      geometric.crossVectors(b.sub(a), c.sub(a)).normalize();
      authored.fromBufferAttribute(n, i);
      assert.ok(
        geometric.dot(authored) > 0.98,
        'rail winding and smooth outward normals must agree',
      );
    }
    edge.dispose();
    assert.ok(
      belt.path.every(
        (point) => Math.abs(point.x) <= 0.501 && Math.abs(point.z) <= 0.501,
      ),
    );
    if (belt.path.length > 2)
      assert.ok(
        belt.path.length >= 33,
        'quarter turns retain their close-view silhouette',
      );
  }
});

await test('presses meet the ticket at completion and release without a second impact', () => {
  for (const { kind, name, travel, release } of [
    { kind: 'printer', name: 'press', travel: 0.07, release: 0.32 },
    { kind: 'stamper', name: 'stamp', travel: 0.16, release: 0.26 },
  ]) {
    assert.ok(
      Math.abs(posed(kind, name, { status: 'work', work: 0 }).p.y) < 1e-8,
    );
    assert.equal(posed(kind, name, { status: 'work', work: 1 }).p.y, -travel);
    assert.equal(posed(kind, name, { since: 0 }).p.y, -travel);
    assert.ok(Math.abs(posed(kind, name, { since: release }).p.y) < 1e-8);
    let previous = -travel;
    for (let i = 1; i <= 20; i++) {
      const y = posed(kind, name, { since: (release * i) / 20 }).p.y;
      assert.ok(y >= previous, 'the return stroke only rises');
      previous = y;
    }
  }
});

await test('rollers and ribbon spools return to a matching orientation at job boundaries', () => {
  for (const [kind, name] of [
    ['printer', 'roll'],
    ['printer', 'drum'],
    ['gilder', 'brush'],
    ['bundler', 'spool'],
  ]) {
    const start = new THREE.Quaternion().setFromEuler(
      posed(kind, name, { status: 'work', work: 0 }).r,
    );
    const end = new THREE.Quaternion().setFromEuler(
      posed(kind, name, { status: 'work', work: 1 }).r,
    );
    assert.ok(
      start.angleTo(end) < 1e-6,
      `${kind} ${name}: no snap when the next job starts`,
    );
  }
  assert.equal(posed('ink', 'bubble0', { boost: false }).s, 0.001);
  assert.equal(
    posed('charm', 'clover', { boost: false, t: 1 }).r.y,
    posed('charm', 'clover', { boost: false, t: 10 }).r.y,
  );
  assert.equal(
    posed('splitter', 'wheel', { turn: 0.7 }).r.y,
    posed('splitter', 'arrow', { turn: 0.7 }).r.y,
  );
});

await test('material response distinguishes coated enamel, metal, rubber, paper and glass', () => {
  const materials = makeMaterials();
  assert.ok(materials.gloss.clearcoat > 0);
  assert.ok(materials.metal.metalness > 0.8);
  assert.ok(materials.dark.roughness > materials.paint.roughness);
  assert.ok(materials.paint.roughness > materials.gloss.roughness);
  assert.ok(materials.glass.transparent && !materials.glass.depthWrite);
  assert.equal(
    materials.glass.transmission,
    0,
    'glass must not add a scene transmission pass',
  );
  for (const material of Object.values(materials)) material.dispose();
});

for (const model of [...Object.values(models), ...Object.values(belts)])
  for (const geometry of geometries(model)) geometry.dispose();
