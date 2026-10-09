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
const canvasDocument = {
  createElement() {
    const canvas = { width: 0, height: 0 };
    const context = {
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (image) => (canvas.pixels = image.data),
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
    };
    canvas.getContext = () => context;
    return canvas;
  },
};
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
    document: canvasDocument,
    require(id) {
      if (id === 'three') return THREE;
      if (id.endsWith('RoundedBoxGeometry.js')) return { RoundedBoxGeometry };
      if (id.endsWith('BufferGeometryUtils.js')) return { mergeGeometries };
      if (id.startsWith('@/')) return load(resolve(root, id.slice(2) + '.ts'));
      return load(resolve(dirname(file), id.endsWith('.ts') ? id : `${id}.ts`));
    },
  });
  return exports;
}
const { buildModel, beltModel, pose, MACHINE_COLOUR, PAD_COLOUR } = load(
  resolve(root, 'components/game/relic-factory/models.ts'),
);
const { rail } = load(resolve(root, 'components/game/relic-factory/kit.ts'));
const { makeMaterials, reachTexture, REACH_STYLE } = load(
  resolve(root, 'components/game/relic-factory/look.ts'),
);
const kinds = [
  'printer',
  'bot',
  'cashier',
  'splitter',
  'lamp',
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
  energy: overrides.boost ? 1 : 0,
  spin: 2.7,
  ...overrides,
});
function posed(kind, name, c) {
  const output = { p: new THREE.Vector3(), r: new THREE.Euler(), s: 1 };
  pose(kind, name, context(c), output);
  return output;
}

const { boosted, deadEnd, statusOf } = load(
  resolve(root, 'components/game/relic-factory/status.ts'),
);
const { ORDER } = load(resolve(root, 'lib/games/relic/factory.ts'));
const machine = (kind, x, y, extra = {}) => ({
  kind,
  x,
  y,
  dir: 0,
  t: 0,
  item: null,
  output: null,
  ...extra,
});

await test('the ten-machine palette owns the brief colours, with no retired ink model', () => {
  assert.deepEqual(Array.from(ORDER), [
    'printer',
    'belt',
    'bot',
    'cashier',
    'splitter',
    'lamp',
    'stamper',
    'gilder',
    'charm',
    'bundler',
  ]);
  assert.deepEqual(
    Object.keys(MACHINE_COLOUR).sort((a, b) => a.localeCompare(b)),
    Array.from(ORDER).sort((a, b) => a.localeCompare(b)),
  );
  // 9 October 2026: the same hues, muted to sit on the green desk.
  assert.equal(MACHINE_COLOUR.printer, '#4f73a6');
  assert.equal(MACHINE_COLOUR.bot, '#d4844a');
  assert.equal(MACHINE_COLOUR.cashier, '#3f8c69');
  assert.equal(MACHINE_COLOUR.lamp, '#7c6aa8');
  assert.equal(MACHINE_COLOUR.stamper, '#bf5446');
  assert.equal(MACHINE_COLOUR.gilder, '#d6ac57');
  assert.equal(MACHINE_COLOUR.charm, '#a58cc0');
  assert.equal(MACHINE_COLOUR.bundler, '#bf6a8f');
  assert.equal(PAD_COLOUR.belt, PAD_COLOUR.splitter);
});

await test('each toy keeps exactly one larger fixed status lamp above its own structure', () => {
  for (const [kind, model] of Object.entries(models)) {
    const lamps = model.parts.filter((p) => p.tint === 'status');
    assert.equal(
      lamps.length,
      1,
      `${kind}: one lamp, not status-coloured eyes`,
    );
    const lamp = lamps[0];
    assert.ok(
      lamp.pivot.x < 0 && lamp.pivot.z < 0,
      `${kind}: consistent upper back-left location`,
    );
    const g = Object.values(lamp.geos)[0];
    g.computeBoundingBox();
    assert.ok(
      g.boundingBox.max.x - g.boundingBox.min.x >= 0.099,
      `${kind}: readable status bulb`,
    );
    for (const state of [
      context(),
      context({ status: 'work', work: 1, boost: true, since: 0 }),
      context({ status: 'stuck' }),
    ]) {
      const o = posed(kind, lamp.name, state);
      assert.equal(
        o.p.length(),
        0,
        `${kind}: lamp is not carried by an unrelated animation`,
      );
      assert.equal(o.r.x + o.r.y + o.r.z, 0);
      assert.equal(o.s, 1);
    }
  }
});

await test('press and scrubbing contact points meet tickets rather than floating or penetrating the platen', () => {
  const stamp = models.stamper.parts.find((p) => p.name === 'stamp');
  stamp.geos.dark.computeBoundingBox();
  const contact =
    stamp.pivot.y +
    stamp.geos.dark.boundingBox.min.y +
    posed('stamper', 'stamp', { work: 1, status: 'work' }).p.y;
  assert.ok(
    Math.abs(contact - (models.stamper.rest.y + 0.004)) < 0.006,
    'rubber stamp contacts the ticket',
  );
  const arm = models.bot.parts.find((p) => p.name === 'arm');
  arm.geos.metal.computeBoundingBox();
  const coin =
    arm.pivot.y +
    arm.geos.metal.boundingBox.min.y +
    posed('bot', 'arm', { status: 'work', work: 0.5, t: 0 }).p.y;
  assert.ok(
    Math.abs(coin - (models.bot.rest.y + 0.004)) < 0.009,
    'scratching coin contacts the ticket',
  );
  assert.ok(
    models.bundler.height < models.printer.height - 0.15,
    'packing bench stays lower than the printer',
  );
});

await test('boost lamps help working printers and bots in all eight surrounding cells', () => {
  const lamp = machine('lamp', 3, 3),
    neighbours = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (dx || dy)
        neighbours.push(
          machine(dx === dy ? 'printer' : 'bot', 3 + dx, 3 + dy, {
            item: dx === dy ? null : { id: 1 },
          }),
        );
  const f = {
    machines: [
      lamp,
      ...neighbours,
      machine('printer', 5, 3),
      machine('bot', 3, 1, { item: { id: 2 } }),
    ],
  };
  assert.equal(boosted(f, lamp).length, 8);
  assert.equal(statusOf(f, lamp), 'work');
  neighbours.forEach((m) => (m.output = { id: 99 }));
  assert.equal(
    boosted(f, lamp).length,
    0,
    'blocked targets do not brighten the reach',
  );
  assert.equal(statusOf(f, lamp), 'idle');
});

await test('charm reach includes diagonal printers, but not bots or empty space', () => {
  const charm = machine('charm', 1, 1);
  const f = {
    machines: [
      charm,
      machine('printer', 0, 0),
      machine('printer', 2, 2),
      machine('bot', 0, 2, { item: { id: 1 } }),
      machine('printer', 3, 1),
    ],
  };
  assert.deepEqual(
    Array.from(boosted(f, charm), (m) => [m.x, m.y]),
    [
      [0, 0],
      [2, 2],
    ],
  );
  assert.equal(boosted(f, machine('belt', 1, 1)).length, 0);
});

await test('stuck detection follows engine ports, with all-side cashier intake', () => {
  for (const dir of [0, 1, 2, 3]) {
    const a = machine('stamper', 1, 1, { stuck: 21 });
    assert.equal(
      deadEnd({ machines: [a, machine('cashier', 2, 1, { dir })] }, a),
      false,
    );
    assert.equal(
      deadEnd({ machines: [a, machine('bot', 2, 1, { dir: 2 })] }, a),
      true,
      'a front-facing port rejects entry',
    );
    assert.equal(
      deadEnd({ machines: [a, machine('bot', 2, 1, { dir: 0 })] }, a),
      false,
    );
  }
});

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

await test('the turbo shows its rotor from both 46-degree factory camera directions', () => {
  const turbo = models.lamp;
  assert.ok(
    turbo.height <= 0.6,
    'the rotor stays below neighbouring tall machines',
  );
  const rotor = turbo.parts.find((p) => p.name === 'rotor');
  const material = new THREE.MeshBasicMaterial();
  const group = new THREE.Group();
  for (const geo of Object.values(turbo.body))
    group.add(new THREE.Mesh(geo, material));
  for (const part of turbo.parts)
    for (const geo of Object.values(part.geos)) {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.copy(part.pivot);
      mesh.userData.rotor = part === rotor;
      group.add(mesh);
    }
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const pitch = (46 * Math.PI) / 180;
  for (const direction of [
    new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)),
    new THREE.Vector3(Math.cos(pitch), Math.sin(pitch), 0),
  ]) {
    ray.set(
      rotor.pivot.clone().addScaledVector(direction, 3),
      direction.clone().negate(),
    );
    assert.ok(
      ray.intersectObject(group, true)[0]?.object.userData.rotor,
      `${direction.toArray().join(', ')}: the hub is in view`,
    );
  }
  material.dispose();
});

await test('boosters turn continuously: the spin follows the eased energy, never the raw boost flag', () => {
  for (const [kind, name] of [
    ['lamp', 'rotor'],
    ['charm', 'clover'],
  ]) {
    // Flipping boost alone (a neighbour starting or stopping) moves nothing.
    const on = posed(kind, name, { boost: true, energy: 0.4, spin: 3 }),
      off = posed(kind, name, { boost: false, energy: 0.4, spin: 3 });
    assert.equal(on.r.y, off.r.y, `${kind}: no jump when boost flips`);
    // A small step of spin is a small turn.
    const a = posed(kind, name, { spin: 3 }),
      b = posed(kind, name, { spin: 3.01 });
    assert.ok(Math.abs(a.r.y - b.r.y) < 0.1, `${kind}: smooth turn`);
  }
  const slow = posed('lamp', 'needle', { energy: 0, t: 0, seed: 0 }),
    fast = posed('lamp', 'needle', { energy: 1, t: 0, seed: 0 });
  assert.ok(
    new THREE.Quaternion()
      .setFromEuler(slow.r)
      .angleTo(new THREE.Quaternion().setFromEuler(fast.r)) > 2,
    'the dial needle swings into the red while boosting',
  );
});

await test('booster pools colour the diagonal cells, feather at the boundary and visibly strengthen at work', () => {
  for (const sparkles of [false, true]) {
    const texture = reachTexture(sparkles);
    const alpha = (x, y) => texture.image.pixels[(y * 256 + x) * 4 + 3] / 255;
    assert.ok(alpha(128, 128) > 0.85);
    assert.ok(alpha(0, 128) < 0.002, 'the square edge fades smoothly');
    for (const x of [43, 128, 213])
      for (const y of [43, 128, 213])
        assert.ok(
          alpha(x, y) > 0.74,
          'reach remains strong at all eight neighbour centres',
        );
    for (const style of Object.values(REACH_STYLE)) {
      assert.ok(alpha(43, 43) * style.idle > 0.12, 'idle reach is readable');
      assert.ok(
        style.boost * 0.945 > style.idle * 1.5,
        'the lowest active pulse still brightens clearly',
      );
    }
    texture.dispose();
  }
  assert.ok(REACH_STYLE.charm.idle < REACH_STYLE.lamp.idle);
  assert.ok(REACH_STYLE.charm.boost < REACH_STYLE.lamp.boost);
});

await test('the world applies pool states and clips each 3x3 square without recentering its falloff', () => {
  const file = resolve(root, 'components/game/relic-factory/world.ts');
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const owner = source.statements.find(
    (s) => ts.isClassDeclaration(s) && s.name?.text === 'FactoryWorld',
  );
  const method = owner.members.find(
    (m) => m.name?.getText(source) === 'drawReach',
  );
  const code = ts.transpileModule(
    `export class ReachProbe { ${method.getText(source)} }`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    REACH_STYLE,
    tmpM: new THREE.Matrix4(),
    tmpC: new THREE.Color(),
  });
  const probe = new exports.ReachProbe();
  probe.opts = { reduced: true };
  probe.time = 12;
  probe.floor = { width: 5, height: 5 };
  probe.hidden = new Set(['hidden']);
  probe.views = new Map([
    ['lamp', { key: 'lamp', kind: 'lamp', m: { x: 0, y: 0 }, boost: false }],
    ['charm', { key: 'charm', kind: 'charm', m: { x: 4, y: 4 }, boost: true }],
    ['hidden', { key: 'hidden', kind: 'lamp', m: { x: 2, y: 2 }, boost: true }],
    ['printer', { key: 'printer', kind: 'printer', m: { x: 1, y: 1 } }],
  ]);
  const matrices = [];
  probe.reachPools = {
    setMatrixAt: (i, m) => (matrices[i] = m.clone()),
    instanceMatrix: {},
  };
  probe.poolData = new THREE.InstancedBufferAttribute(new Float32Array(16), 4);
  probe.poolClip = new THREE.InstancedBufferAttribute(new Float32Array(16), 4);
  probe.drawReach();
  assert.equal(probe.reachPools.count, 2);
  const near = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≈ ${expected}`);
  near(probe.poolData.getW(0), REACH_STYLE.lamp.idle);
  near(probe.poolData.getW(1), REACH_STYLE.charm.boost);
  assert.deepEqual(
    new THREE.Vector3().setFromMatrixPosition(matrices[0]).toArray(),
    [1, 0.007, 1],
  );
  assert.deepEqual(
    new THREE.Vector3().setFromMatrixPosition(matrices[1]).toArray(),
    [4, 0.007, 4],
  );
  assert.deepEqual(
    new THREE.Vector3().setFromMatrixScale(matrices[0]).toArray(),
    [2, 1, 2],
  );
  near(probe.poolClip.getX(0), 1 / 3);
  near(probe.poolClip.getY(0), 0);
  near(probe.poolClip.getX(1), 0);
  near(probe.poolClip.getY(1), 1 / 3);
  for (let i = 0; i < 2; i++) {
    near(probe.poolClip.getZ(i), 2 / 3);
    near(probe.poolClip.getW(i), 2 / 3);
  }
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
