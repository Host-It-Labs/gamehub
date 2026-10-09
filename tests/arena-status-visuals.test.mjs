import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { troopCards } from '../lib/games/arena/cards.ts';
import { plainUnit } from '../lib/games/arena/engine.ts';
import { activeStatuses } from '../components/game/arena/status-state.ts';
import { fitCamera, lensFor, troopScale } from '../lib/games/arena/layout.ts';

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../components/game/arena/status.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports,
    require(id) {
      if (id === 'three') return THREE;
      if (id === './status-state') return { activeStatuses };
      throw new Error(`unexpected status dependency ${id}`);
    },
  },
);
const { TroopStatuses } = exports;
const unit = (extra = {}) => ({
  ...plainUnit,
  id: 1,
  card: 'archers',
  state: 'walking',
  hp: 304,
  maxHp: 304,
  ...extra,
});
function fixture() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 8, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const fx = new TroopStatuses(scene, camera);
  const draw = (
    units,
    { dt = 1 / 60, reduced = false, head = new THREE.Vector3(0, 3, 0) } = {},
  ) => {
    fx.begin(dt, reduced);
    for (const u of units) fx.show(u, troopCards[u.card].unit, head);
    fx.end();
  };
  const glyph = (kind) => scene.getObjectByName(`status-${kind}`);
  return { fx, scene, camera, draw, glyph };
}

await test('status duration and recipients come from the live troop, including a restored snapshot', () => {
  const u = unit({
    stun: 0.4,
    slow: 1.2,
    slowFactor: 0.6,
    beat: 1.3,
    taunt: 2,
    tauntId: 9,
  });
  assert.deepEqual(activeStatuses(u, troopCards.archers.unit), [
    'stun',
    'slow',
    'taunt',
    'haste',
  ]);
  assert.deepEqual(
    activeStatuses(
      { ...u, stun: 0, slow: 0, taunt: 0, beat: 1 },
      troopCards.archers.unit,
    ),
    [],
  );
  assert.deepEqual(
    activeStatuses({ ...u, hp: 0 }, troopCards.archers.unit),
    [],
  );
  assert.ok(
    !activeStatuses({ ...u, slowFactor: 1 }, troopCards.archers.unit).includes(
      'slow',
    ),
  );
  assert.ok(
    !activeStatuses({ ...u, tauntId: null }, troopCards.archers.unit).includes(
      'taunt',
    ),
  );
  assert.ok(
    activeStatuses(
      JSON.parse(JSON.stringify(u)),
      troopCards.archers.unit,
    ).includes('stun'),
  );
});

await test('a broken shield and a healed Viking lose their indicators immediately', () => {
  const shield = unit({ card: 'gladiator', shield: 1 });
  assert.deepEqual(activeStatuses(shield, troopCards.gladiator.unit), [
    'shield',
  ]);
  assert.deepEqual(
    activeStatuses({ ...shield, shield: 0 }, troopCards.gladiator.unit),
    [],
  );
  const viking = unit({ card: 'viking', hp: 600, maxHp: 1400, raged: true });
  assert.deepEqual(activeStatuses(viking, troopCards.viking.unit), ['rage']);
  assert.deepEqual(
    activeStatuses({ ...viking, hp: 700 }, troopCards.viking.unit),
    [],
  );
});

await test('a stun badge follows a moving flyer and disappears on expiration or removal', () => {
  const f = fixture();
  const u = unit({ card: 'jetpack', stun: 0.5 });
  for (let i = 0; i < 15; i++) {
    f.draw([u], { head: new THREE.Vector3(i, 6, 2) });
    const stars = f.glyph('stun');
    assert.equal(stars.count, 1);
    for (let j = 0; j < stars.count; j++) {
      const m = new THREE.Matrix4();
      stars.getMatrixAt(j, m);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      assert.ok(Math.abs(p.x - i) < 1 && p.y > 6);
    }
  }
  f.draw([{ ...u, stun: 0 }]);
  assert.equal(f.glyph('stun').count, 0);
  f.draw([u]);
  f.draw([]);
  assert.equal(f.glyph('stun').count, 0);
  f.fx.dispose();
  assert.equal(f.scene.children.length, 0);
});

await test('simultaneous statuses have separate silhouettes, and healing marks only its recipients', () => {
  const f = fixture();
  const a = unit({
    card: 'viking',
    hp: 600,
    maxHp: 1400,
    stun: 0.4,
    slow: 1,
    slowFactor: 0.6,
    beat: 1.3,
    taunt: 1,
    tauntId: 9,
  });
  const b = unit({ id: 2, card: 'gladiator', shield: 750 });
  f.fx.heal([2]);
  f.draw([a, b]);
  for (const name of ['slow', 'taunt', 'haste', 'rage', 'heal'])
    assert.equal(f.glyph(name).count, 1, name);
  assert.equal(f.glyph('shield'), undefined, 'shield has its own health track');
  assert.equal(f.glyph('stun').count, 1);
  f.draw([a, b], { dt: 0.8 });
  assert.equal(f.glyph('heal').count, 0);
  f.fx.heal([2]);
  f.draw([a, { ...b, hp: 0 }]);
  assert.equal(f.glyph('heal').count, 0);
  f.fx.dispose();
});

await test('reduced motion retains still status silhouettes and phone scaling enlarges them', () => {
  const f = fixture();
  const u = unit({ stun: 0.5 });
  f.draw([u], { reduced: true });
  const before = Array.from(f.glyph('stun').instanceMatrix.array.slice(0, 48));
  f.draw([u], { dt: 0.5, reduced: true });
  assert.deepEqual(
    Array.from(f.glyph('stun').instanceMatrix.array.slice(0, 48)),
    before,
  );
  f.fx.size *= 1.5;
  f.draw([u], { reduced: true });
  const m = new THREE.Matrix4();
  f.glyph('stun').getMatrixAt(0, m);
  assert.ok(
    new THREE.Vector3().setFromMatrixScale(m).x >
      Math.hypot(before[0], before[1], before[2]) * 1.4,
  );
  f.fx.dispose();
});

await test('dense swarms retain every status without per-troop meshes or stale instances', () => {
  const f = fixture();
  const units = Array.from({ length: 140 }, (_, id) =>
    unit({ id, card: 'bee', stun: 0.5, slow: 1, slowFactor: 0.6 }),
  );
  f.draw(units);
  assert.equal(f.glyph('stun').count, 140);
  assert.equal(f.glyph('slow').count, 140);
  assert.equal(
    f.scene.children.length,
    12,
    'six shared symbol and enamel plate pairs',
  );
  for (const mesh of f.scene.children) {
    assert.ok(mesh.count <= mesh.instanceMatrix.count);
    for (const n of mesh.instanceMatrix.array.slice(0, mesh.count * 16))
      assert.ok(Number.isFinite(n));
  }
  f.draw([units[0]]);
  assert.equal(f.glyph('stun').count, 1);
  assert.equal(f.glyph('slow').count, 1);
  f.fx.dispose();
});

await test('simultaneous badges form one spaced camera-facing row above the recipient', () => {
  const f = fixture();
  const u = unit({
    card: 'viking',
    hp: 600,
    maxHp: 1400,
    stun: 1,
    slow: 1,
    slowFactor: 0.6,
    beat: 1.3,
    taunt: 1,
    tauntId: 9,
  });
  f.draw([u], { reduced: true });
  const inverse = f.camera.quaternion.clone().invert();
  const positions = ['stun', 'slow', 'taunt', 'haste', 'rage'].map((kind) => {
    const mesh = f.glyph(kind);
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const p = new THREE.Vector3().setFromMatrixPosition(matrix);
    const plate = f.scene.getObjectByName(`status-${kind}-plate`);
    plate.getMatrixAt(0, matrix);
    const radius = new THREE.Vector3().setFromMatrixScale(matrix).x;
    return {
      p: p.sub(new THREE.Vector3(0, 3, 0)).applyQuaternion(inverse),
      radius,
    };
  });
  for (let i = 0; i < positions.length; i++) {
    assert.ok(positions[i].p.y > positions[i].radius);
    if (!i) continue;
    assert.ok(Math.abs(positions[i].p.y - positions[i - 1].p.y) < 1e-5);
    assert.ok(
      positions[i].p.x - positions[i - 1].p.x > positions[i].radius * 2,
    );
  }
  f.fx.dispose();
});

await test('status badges clear both shield tracks and the shield icon across camera breakpoints', () => {
  for (const [width, height] of [
    [390, 844],
    [600, 700],
    [1024, 600],
    [768.5, 1024.25],
    [1280, 720],
  ]) {
    const f = fixture();
    const frame = { width, height, top: 60, bottom: 150 };
    const lens = lensFor(frame);
    const camera = fitCamera(frame, lens);
    f.camera.position.set(...camera.position);
    f.camera.lookAt(...camera.target);
    f.camera.aspect = width / height;
    f.camera.fov = camera.fov;
    f.camera.updateProjectionMatrix();
    f.camera.updateMatrixWorld(true);
    f.fx.size = troopScale(lens, width <= 600);
    const track = ((width <= 600 ? 4 : 5) * f.fx.size) / 1.75;
    f.fx.hud(height, track);
    for (const z of [-9.5, 0, 9.5]) {
      const head = new THREE.Vector3(-5.5, 3, z);
      f.draw([unit({ card: 'gladiator', shield: 100, stun: 1 })], {
        head,
        reduced: true,
      });
      const plate = f.scene.getObjectByName('status-stun-plate');
      const matrix = new THREE.Matrix4();
      plate.getMatrixAt(0, matrix);
      const bottom = new THREE.Vector3().setFromMatrixPosition(matrix);
      const radius = new THREE.Vector3().setFromMatrixScale(matrix).x;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
        f.camera.quaternion,
      );
      bottom.addScaledVector(up, -radius);
      const bottomPx = ((1 - bottom.project(f.camera).y) * height) / 2;
      const anchor = head.clone();
      anchor.y += f.fx.size * 0.13;
      const tracksTop =
        ((1 - anchor.project(f.camera).y) * height) / 2 - (track * 2 + 5);
      const iconTop = tracksTop - Math.max(0, 7 - (track + 2) / 2);
      assert.ok(
        iconTop - bottomPx >= 4.8,
        `${width}x${height}, z${z}: gap ${iconTop - bottomPx}`,
      );
    }
    f.fx.dispose();
  }
});
