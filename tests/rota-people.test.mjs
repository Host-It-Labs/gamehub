import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import {
  makeResident,
  stepResident,
  heightOnRoute,
  PEOPLE_PRESENTATION_SCALE,
  WALK,
  TURN,
  INSIDE,
} from '../lib/games/rota/people.ts';
import {
  planNeighbourhood,
  LANE_HALF,
} from '../lib/games/rota/neighbourhood.ts';
import { maps } from '../lib/games/rota/maps.ts';
import { DX, DY, RAIL } from '../lib/games/rota/pieces.ts';
import { exitSegments } from '../lib/games/rota/routes.ts';
import { STREET_HALF, TRACK_CLEAR } from '../lib/games/rota/scale.ts';

const point = (x, z = 0) => ({ x, y: 0.022, z });
const span = (a, b, crossing = -1) => ({
  a,
  b,
  length: Math.hypot(b.x - a.x, b.z - a.z),
  crossing,
});
const route = (spans, doors = []) => ({
  spans,
  length: spans.reduce((n, s) => n + s.length, 0),
  doors,
  loop: false,
});
const street = route([
  span(point(0), point(0.25)),
  span(point(0.25), point(0.55), 0),
  span(point(0.55), point(1.3)),
]);
const open = [{ blocked: false, clearance: Infinity }];
const shut = [{ blocked: true, clearance: 0 }];

function exitEdgeDistance(p, exit) {
  const s = exit.shape;
  const dx = DX[s.dir] * s.length,
    dz = DY[s.dir] * s.length;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - s.from.x) * dx + (p.z - s.from.z) * dz) / (dx * dx + dz * dz),
    ),
  );
  return (
    Math.hypot(p.x - s.from.x - t * dx, p.z - s.from.z - t * dz) -
    (exit.kind === RAIL ? TRACK_CLEAR : STREET_HALF)
  );
}

function walker(index = 3, path = street) {
  const r = makeResident(path, index);
  r.distance = 0.01;
  r.direction = 1;
  r.mode = WALK;
  r.cooldown = Infinity;
  r.heading = Math.PI / 2;
  stepResident(r, 0.001, open);
  return r;
}

function advance(r, seconds, signals = open) {
  for (let i = 0; i < seconds * 60; i++) stepResident(r, 1 / 60, signals);
}

await test('people wait with the whole pram behind the kerb and require a full crossing gap', () => {
  for (const index of [0, 3]) {
    const r = walker(index);
    advance(r, 18, shut);
    assert.ok(
      r.distance + r.envelope <= 0.247,
      'leading pram/coat must remain off the crossing',
    );
    const atKerb = r.distance;
    advance(r, 2, [{ blocked: false, clearance: 0.5 }]);
    assert.equal(
      r.distance,
      atKerb,
      'a short traffic gap cannot admit a resident',
    );
    advance(r, 0.5, [
      { blocked: false, clearance: (0.3 + 2 * r.envelope) / r.speed + 1.4 },
    ]);
    assert.equal(
      r.distance,
      atKerb,
      'reserve both body extents and gate-lowering time',
    );
    advance(r, 20);
    assert.ok(r.distance > 0.55, 'a safe gap should let the resident cross');
  }
});

await test('an admitted person finishes crossing when lights close after entry', () => {
  const r = walker();
  while (r.distance < 0.3) stepResident(r, 1 / 60, open);
  const before = r.distance;
  advance(r, 9, shut);
  assert.ok(
    r.distance > 0.55,
    'a pedestrian must not strand in the train/road envelope',
  );
  assert.ok(r.distance > before);
  assert.equal(
    r.crossing,
    -1,
    'release admission after the trailing envelope clears',
  );
});

await test('people turn at open ends and only vanish at an actual doorway', () => {
  const path = route(
    [span(point(0), point(0.32))],
    [{ distance: 0.15, point: point(0.15, -0.035) }],
  );
  const r = walker(3, path);
  r.cooldown = 0;
  for (let i = 0; i < 1200 && r.mode !== INSIDE; i++)
    stepResident(r, 1 / 60, []);
  assert.equal(r.mode, INSIDE);
  assert.equal(r.visible, false);
  assert.ok(Math.abs(r.x - 0.15) < 1e-9);
  assert.ok(Math.abs(r.z + 0.035) < 1e-9);
  advance(r, 35, []);
  assert.equal(r.visible, true);
  assert.ok(r.distance >= 0 && r.distance <= path.length);

  const end = walker(3, route([span(point(0), point(0.15))]));
  for (let i = 0; i < 900 && end.mode !== TURN; i++)
    stepResident(end, 1 / 60, []);
  assert.equal(end.mode, TURN);
  assert.equal(end.distance, end.route.length);
  const heading = end.heading;
  stepResident(end, 1 / 60, []);
  assert.ok(
    Math.abs(end.heading - heading) <= 0.041,
    'heading must turn smoothly',
  );
  advance(end, 2, []);
  assert.equal(end.direction, -1);
  assert.ok(end.distance < end.route.length);
});

await test('residents remain finite, bounded and on paths over long safety cycles', () => {
  for (let index = 0; index < 28; index++) {
    const r = makeResident(street, index);
    for (let i = 0; i < 7200; i++) {
      stepResident(r, 1 / 60, i % 1200 < 500 ? shut : open);
      for (const k of ['distance', 'x', 'y', 'z', 'heading', 'phase'])
        assert.ok(Number.isFinite(r[k]), k);
      assert.ok(r.distance >= 0 && r.distance <= street.length);
      assert.equal(r.z, 0);
      assert.equal(r.y, 0.022);
    }
  }
});

// Node has no browser/ports here. Compile the actual renderer's TS in-process
// so geometry, instancing and contact can be tested without a WebGL canvas.
// This loader is private to this test worker and changes no repository files.
const root = fileURLToPath(new URL('../', import.meta.url));
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/'))
      return next(
        pathToFileURL(resolve(root, `${specifier.slice(2)}.ts`)).href,
        context,
      );
    if (
      specifier.startsWith('.') &&
      context.parentURL?.endsWith('.ts') &&
      !extname(specifier)
    )
      return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
const { People } = await import('../components/game/rota/three/people.ts');
hook.deregister();

const plan = {
  routes: [route([span(point(-1.387, -1), point(-1.387, 6))])],
  crossings: [],
  lamps: [],
};
const matrix = new THREE.Matrix4();

await test('authored resident proportions retain planted feet and handle contact at the requested visibility scale', () => {
  const people = new People(plan, false, false);
  try {
    const heads = people.group.children.filter((m) =>
      m.name.includes('-head-'),
    );
    for (const head of heads) {
      head.geometry.computeBoundingBox();
      assert.ok(
        head.geometry.boundingBox.max.y < 0.073,
        'retain the unchanged adult source anatomy',
      );
    }
    const bodies = people.group.children.filter((m) =>
      m.name.includes('-coat-'),
    );
    for (const body of bodies) {
      body.geometry.computeBoundingBox();
      assert.ok(
        body.geometry.boundingBox.max.x - body.geometry.boundingBox.min.x <
          0.02,
        'shoulders must have normal human proportions',
      );
    }

    const r = people.residents[3];
    r.distance = 2;
    r.direction = 1;
    r.phase = 0.08;
    r.heading = r.targetHeading = 0;
    r.mode = WALK;
    r.velocity = r.speed;
    r.motion = 1;
    r.cooldown = Infinity;
    people.tick(1 / 60, 0, []);
    const shoes = people.group.children.find(
      (m) => m.name === 'rota-people-shoes',
    );
    shoes.getMatrixAt(6, matrix);
    const planted = new THREE.Vector3().setFromMatrixPosition(matrix);
    for (let i = 0; i < 8; i++) people.tick(1 / 60, (i + 1) / 60, []);
    shoes.getMatrixAt(6, matrix);
    assert.ok(
      planted.distanceTo(new THREE.Vector3().setFromMatrixPosition(matrix)) <
        1e-6,
      'stance foot must cancel body travel',
    );

    const pram = people.group.children.find(
      (m) => m.name === 'rota-people-coach-pram',
    );
    const hands = people.group.children.find(
      (m) => m.name === 'rota-people-hands',
    );
    pram.getMatrixAt(0, matrix);
    const handle = new THREE.Vector3(-0.009, 0.036, 0.013).applyMatrix4(matrix);
    hands.getMatrixAt(0, matrix);
    const palm = new THREE.Vector3(0, 0.0015, 0).applyMatrix4(matrix);
    assert.ok(
      palm.distanceTo(handle) < 5e-7,
      `palm must actually meet pram handle: ${palm.distanceTo(handle)}`,
    );
    assert.equal(people.residents[1].style, 2);
    assert.equal(people.residents[1].size, 0.68 * PEOPLE_PRESENTATION_SCALE);
    assert.ok(people.residents[1].size * 0.071 < 0.066);
    for (const r of people.residents)
      if (r.style !== 2) {
        assert.ok(r.size >= 0.955 * PEOPLE_PRESENTATION_SCALE);
        assert.ok(r.size <= 1.025 * PEOPLE_PRESENTATION_SCALE);
        assert.ok(r.envelope >= 0.022 * PEOPLE_PRESENTATION_SCALE);
      }
    assert.ok(people.group.children.every((m) => m.isInstancedMesh));
  } finally {
    people.dispose();
  }
});

await test('near residential fronts stay represented at every quality with bounded flags and soft contact shadows', () => {
  const map = maps.meadow;
  const rows = [
    { x: 2.6, z: -0.825, rot: 0, houses: 5, windows: true },
    { x: 7.825, z: 2.4, rot: -Math.PI / 2, houses: 5, windows: true },
    { x: 2.4, z: 7.825, rot: Math.PI, houses: 5, windows: true },
    { x: -0.825, z: 2.6, rot: Math.PI / 2, houses: 5, windows: true },
  ];
  const plan = planNeighbourhood(map, rows, () => 0, []);
  const near = plan.routes.filter((r) => r.near);
  assert.equal(near.length, 4, 'a real front-space walk on each clear side');
  for (const r of near) {
    assert.ok(
      r.doors.length > 0,
      'each walk has actual doors across its clear front space',
    );
    assert.ok(
      r.spans.every((s) => s.crossing === -1),
      'near walks stop before exits',
    );
    for (const s of r.spans)
      for (const p of [s.a, s.b]) {
        assert.ok(
          Math.abs(Math.max(-p.x, -p.z, p.x - map.size, p.z - map.size) - 0.2) <
            1e-6,
        );
      }
  }
  const people = new People(plan, true, false);
  try {
    for (const [tier, count] of [
      ['low', 10],
      ['balanced', 18],
      ['high', 28],
    ]) {
      people.setQuality(tier);
      assert.equal(people.count, count);
      assert.ok(
        people.residents.slice(0, count).filter((r) => r.route.near).length >=
          8,
      );
      assert.equal(
        new Set(people.residents.slice(0, 8).map((r) => r.route)).size,
        4,
      );
    }
    const paths = people.group.children.find(
      (m) => m.name === 'rota-residential-frontpaths',
    );
    assert.ok(
      paths.isMesh && !paths.isInstancedMesh,
      'all new flags share one static draw',
    );
    const p = paths.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++)
      assert.ok(
        p.getX(i) < 0 ||
          p.getX(i) > map.size ||
          p.getZ(i) < 0 ||
          p.getZ(i) > map.size,
        'no flag enters the playing squares',
      );
    const shadows = people.group.children.find(
      (m) => m.name === 'rota-people-contact-shadow',
    );
    assert.equal(shadows.count, 28);
    assert.equal(shadows.material.depthWrite, false);
    assert.ok(shadows.material.fog && shadows.material.uniforms.fogColor);
    shadows.getMatrixAt(0, matrix);
    paths.geometry.computeBoundingBox();
    assert.ok(
      new THREE.Vector3().setFromMatrixPosition(matrix).y >
        paths.geometry.boundingBox.max.y,
      'contact shadow lies above the flag tops',
    );
    assert.ok(
      new THREE.Vector3().setFromMatrixPosition(matrix).y < 0.003,
      'contact shadow is grounded',
    );
    const coats = people.group.children.find(
      (m) => m.name === 'rota-people-coat-1',
    );
    const tint = new THREE.Color();
    coats.getColorAt(0, tint);
    assert.ok(
      tint.r > 0.5 && tint.g > 0.5,
      'the pusher wears a readable cream mac',
    );
    const scarves = people.group.children.find(
      (m) => m.name === 'rota-people-head-1',
    );
    const colours = scarves.geometry.getAttribute('aScarfTint');
    assert.ok(colours.getX(1) > colours.getY(1), 'a restrained red scarf');
    assert.ok(colours.getY(2) > colours.getX(2), 'a restrained green scarf');
    assert.ok(
      scarves.geometry.getAttribute('aScarf'),
      'skin is separate from the scarf tint',
    );
  } finally {
    people.dispose();
  }
});

await test('unprotected path ends reserve the enlarged pram turn outside exits and lane junctions', () => {
  const map = maps.meadow;
  // The north row begins beside the road at x=1.5; the outer rows previously
  // ended only 0.04 from a lane edge, inside the enlarged pram's turn.
  const rows = [
    { x: 2, z: -0.825, rot: 0, houses: 5, windows: true },
    { x: 7.825, z: 2.4, rot: -Math.PI / 2, houses: 5, windows: true },
    { x: 2.4, z: 7.825, rot: Math.PI, houses: 5, windows: true },
    { x: -0.825, z: 2.6, rot: Math.PI / 2, houses: 5, windows: true },
    { x: 0, z: -2.2, rot: Math.PI, houses: 4, windows: true },
    { x: 9.2, z: 0, rot: Math.PI / 2, houses: 4, windows: true },
  ];
  const plan = planNeighbourhood(map, rows, () => 0, []);
  const near = plan.routes.filter((r) => r.near);
  const exits = exitSegments(map).filter((e) => e.shape.type === 'line');
  const envelope = makeResident(near[0], 0).envelope;
  assert.ok(Math.abs(envelope - 0.0897) < 1e-9);
  assert.equal(near.length, 4);
  assert.equal(
    plan.crossings.length,
    map.exits.length,
    'explicit protected crossings remain complete',
  );
  for (const r of near) {
    for (const p of [r.spans[0].a, r.spans.at(-1).b])
      for (const exit of exits)
        assert.ok(
          exitEdgeDistance(p, exit) >= envelope,
          'the full turning companion stays beyond the exit paving/rail edge',
        );
    for (const door of r.doors)
      for (const exit of exits)
        assert.ok(
          exitEdgeDistance(door.point, exit) >= envelope,
          'doorway turns keep the same companion clearance',
        );
  }
  const outer = plan.routes.filter(
    (r) =>
      !r.near &&
      !r.loop &&
      r.spans.every((s) => s.crossing === -1) &&
      (r.spans[0].a.z < -2 || r.spans[0].a.x > map.size + 2),
  );
  assert.equal(outer.length, 2, 'retain both outer residential walks');
  for (const r of outer) {
    const alongX =
      Math.abs(r.spans[0].a.x - r.spans[0].b.x) >
      Math.abs(r.spans[0].a.z - r.spans[0].b.z);
    for (const p of [r.spans[0].a, r.spans.at(-1).b]) {
      const u = alongX ? p.x : p.z;
      assert.ok(
        Math.abs(u - (Math.round(u - 0.5) + 0.5)) - LANE_HALF >= envelope,
        'an open-end pram turn cannot enter an unprotected back-lane junction',
      );
    }
  }
  const people = new People(plan, true, false);
  try {
    assert.equal(
      new Set(people.residents.slice(0, 8).map((r) => r.route)).size,
      4,
      'clipping preserves the first eight residents across all four near walks',
    );
    const p = people.group
      .getObjectByName('rota-residential-frontpaths')
      .geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++)
      for (const exit of exits)
        assert.ok(
          exitEdgeDistance({ x: p.getX(i), z: p.getZ(i) }, exit) > 0,
          'flags and door branches remain outside the physical exit corridor',
        );
  } finally {
    people.dispose();
  }
});

await test('reduced motion freezes locomotion; quality changes only the drawing budget', () => {
  const people = new People(plan, true, false);
  try {
    const before = people.residents.map((r) => [
      r.x,
      r.y,
      r.z,
      r.phase,
      r.heading,
    ]);
    const shoes = people.group.children.find(
      (m) => m.name === 'rota-people-shoes',
    );
    const poses = shoes.instanceMatrix.array.slice();
    people.tick(10, 10, shut);
    assert.deepEqual(
      people.residents.map((r) => [r.x, r.y, r.z, r.phase, r.heading]),
      before,
    );
    assert.deepEqual(shoes.instanceMatrix.array, poses);
    people.setQuality('low');
    assert.equal(shoes.count, 20);
    people.setQuality('balanced');
    assert.equal(shoes.count, 36);
    people.setQuality('high');
    assert.equal(shoes.count, 56);
    assert.deepEqual(
      people.residents.map((r) => [r.x, r.y, r.z, r.phase, r.heading]),
      before,
    );
  } finally {
    people.dispose();
  }
});

await test('feet and pram follow raised crossing approaches; gate occupancy includes companions', () => {
  const a = point(-1.387, 0),
    b = point(-1.387, 0.1),
    c = point(-1.387, 0.22),
    d = point(-1.387, 0.58);
  a.y = b.y = 0.0015;
  c.y = d.y = 0.039;
  const path = route([span(a, b), span(b, c), span(c, d, 0)]);
  const people = new People(
    { routes: [path], crossings: [], lamps: [] },
    false,
    false,
  );
  try {
    for (let i = 1; i < people.residents.length; i++)
      people.residents[i].visible = false;
    const r = people.residents[0];
    r.distance = 0.165;
    r.direction = 1;
    r.mode = WALK;
    r.heading = r.targetHeading = 0;
    r.phase = 0.1;
    r.motion = 1;
    r.cooldown = Infinity;
    people.tick(1 / 60, 0, open);

    const pram = people.group.children.find(
      (m) => m.name === 'rota-people-coach-pram',
    );
    const hands = people.group.children.find(
      (m) => m.name === 'rota-people-hands',
    );
    pram.getMatrixAt(0, matrix);
    const handle = new THREE.Vector3(-0.009, 0.036, 0.013).applyMatrix4(matrix);
    hands.getMatrixAt(0, matrix);
    const palm = new THREE.Vector3(0, 0.0015, 0).applyMatrix4(matrix);
    assert.ok(
      palm.distanceTo(handle) < 5e-7,
      'hands keep hold while the pram pitches up a ramp',
    );

    const shoes = people.group.children.find(
      (m) => m.name === 'rota-people-shoes',
    );
    shoes.getMatrixAt(0, matrix);
    const foot = new THREE.Vector3().setFromMatrixPosition(matrix);
    const ground = heightOnRoute(r, foot.z - r.z);
    assert.ok(
      Math.abs(foot.y - ground) < 1e-7,
      'stance foot must meet the ramp, not the actor origin height',
    );
    assert.ok(
      r.crossing === 0,
      'the pram leading extent reserves the crossing on approach',
    );
    const flags = new Uint8Array(1);
    people.fillCrossingOccupancy(flags);
    assert.equal(flags[0], 1);
    r.distance = path.length - 0.02;
    people.tick(1 / 60, 0, shut);
    people.fillCrossingOccupancy(flags);
    assert.equal(
      flags[0],
      1,
      'the gate stays protected while the trailing companion has not cleared',
    );
  } finally {
    people.dispose();
  }
});
