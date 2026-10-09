import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../components/game/arena/moves/viking.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports, Math },
);
const { viking, vikingStoneGuard, vikingSolePenetration } = exports;

function sample(overrides = {}) {
  const claimed = new Map();
  const context = {
    unit: { id: 7, hp: 1400, maxHp: 1400 },
    t: 0,
    dt: 1 / 60,
    idle: 0,
    idleFor: 0,
    reduced: false,
    since: 1,
    aim: 0,
    wind: 0,
    walk: 0,
    pass: 0,
    strike: 0,
    flinch: 0,
    deploy: 1,
    size: 1,
    accel: 0,
    lateral: 0,
    turn: 0,
    hipL: 0,
    hipR: 0,
    memo: {},
    ...overrides,
    want(part, x = 0, y = 0, z = 0) {
      claimed.set(part, [x, y, z]);
    },
  };
  const pose = {
    torsoX: 0,
    torsoY: 0,
    torsoZ: 0,
    headX: 0,
    headY: 0,
    armL: 0,
    armR: 0,
    yawKick: 0,
    lean: 0,
    roll: 0,
    lift: 0,
    lunge: 0,
    squash: 1,
  };
  viking.pose(context, pose);
  return { claimed, pose };
}

await test('Viking holds the same physical two-hand grip through its complete motion states', () => {
  for (const reduced of [false, true])
    for (const hp of [1400, 600])
      for (const guard of [0, 0.5, 1])
        for (let frame = 0; frame <= 100; frame++) {
          const t = frame / 100;
          const { claimed, pose } = sample({
            reduced,
            unit: { id: 7, hp, maxHp: 1400 },
            memo: { rage: hp < 700 ? 1 : 0, vikingStoneGuard: guard },
            t: t * 10,
            since: t * 0.8,
            aim: 1,
            wind: 1 - t,
            walk: t,
            pass: t,
            strike: Math.sin(t * Math.PI),
            flinch: t,
            deploy: t,
            accel: Math.sin(t * 10) * 15,
            lateral: Math.cos(t * 8) * 9,
            turn: Math.sin(t * 7) * 4,
            idle: 1 - t,
            idleFor: t * 9.4,
          });
          assert.equal(
            pose.armL,
            pose.armR,
            `equal shoulder pitch, hp=${hp}, t=${t}`,
          );
          for (const joint of ['foreL', 'foreR', 'handL', 'handR', 'weapon'])
            assert.deepEqual(
              [...claimed.get(joint)],
              [0, 0, 0],
              `${joint} keeps the authored grip`,
            );
          assert.ok(
            Object.values(pose).every(Number.isFinite),
            'pose stays finite',
          );
          assert.ok(pose.armL >= guard * 2.15, 'stone guard lifts both fists');
        }
  for (const size of [1, 1.356999, 1.7835]) {
    assert.equal(
      vikingStoneGuard(Infinity, size),
      0,
      'no stone means free carry',
    );
    assert.equal(
      vikingStoneGuard(1.3 * size, size),
      1,
      'guard is ready before contact',
    );
    assert.equal(
      vikingStoneGuard(2.6 * size, size),
      0,
      'approach starts smoothly',
    );
    assert.ok(vikingStoneGuard(2 * size, size) > 0);
  }
});

await test('Viking keeps its normal and rage spin duration and grounded circular strike', () => {
  for (const [hp, duration] of [
    [1400, 0.5],
    [600, 0.4],
  ]) {
    const early = sample({
      unit: { id: 1, hp, maxHp: 1400 },
      aim: 1,
      since: 0,
    });
    const late = sample({
      unit: { id: 1, hp, maxHp: 1400 },
      aim: 1,
      since: duration * 0.9999,
    });
    assert.ok(early.pose.yawKick < 0, 'coils to the right');
    assert.ok(
      Math.abs(late.pose.yawKick - Math.PI * 2) < 0.001,
      'completes one full sweep',
    );
    const after = sample({
      unit: { id: 1, hp, maxHp: 1400 },
      aim: 1,
      since: duration,
    });
    assert.equal(
      after.pose.yawKick,
      0,
      'recovery starts at the same gameplay time',
    );
    assert.equal(after.pose.lift, 0, 'does not hop between hits');
  }
});

await test('Viking exported pivots preserve shaft contact when the whole axe hold pitches', async () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL('../lib/games/arena/assets.json', import.meta.url),
      'utf8',
    ),
  );
  const path = process.env.ARENA_VIKING_REVIEW_GLTF
    ? resolve(process.env.ARENA_VIKING_REVIEW_GLTF)
    : new URL(`../public${manifest.models.figures.path}`, import.meta.url);
  const bytes = readFileSync(path);
  const scene = (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
  const root = scene.getObjectByName('viking');
  assert.ok(root, 'Viking root is preserved');
  const joint = (name) => {
    const node = root.getObjectByName(`viking${name}`);
    assert.ok(node, `${name} joint exists`);
    return node;
  };
  const left = joint('armL');
  const right = joint('armR');
  const weapon = joint('weapon');
  assert.equal(joint('foreL').parent, left);
  assert.equal(joint('foreR').parent, right);
  assert.equal(joint('handL').parent, joint('foreL'));
  assert.equal(joint('handR').parent, joint('foreR'));
  assert.equal(weapon.parent?.name, joint('handR')?.name);
  assert.ok(
    Math.abs(left.position.y - right.position.y) < 1e-6,
    'shoulders share height',
  );
  assert.ok(
    Math.abs(left.position.z - right.position.z) < 1e-6,
    'shoulders share depth',
  );
  const toRuntime = (v) => new Vector3(v[0], v[2], -v[1]);
  const localGrip = (hand) => toRuntime(hand.userData.gripCentre);
  // Geometry carries grip centres relative to the actual wrist pivots.
  // This checks the exported hierarchy, not a duplicate of sculpt math.
  for (let step = 0; step <= 48; step++) {
    left.rotation.x = right.rotation.x = -0.15 + (step / 48) * 2.35;
    root.rotation.y = (step / 48) * Math.PI * 2;
    root.updateMatrixWorld(true);
    const l = joint('handL').localToWorld(localGrip(joint('handL')));
    const r = joint('handR').localToWorld(localGrip(joint('handR')));
    const axe = weapon.getWorldPosition(new Vector3());
    assert.ok(
      r.distanceTo(axe) < 1e-5,
      'dominant fist stays on the exported axe pivot',
    );
    assert.ok(
      Math.abs(l.distanceTo(r) - 0.24) < 1e-5,
      'offhand stays at its authored haft distance',
    );
  }
});

await test('Viking sole clearance follows the posed surface and excludes unused vertices', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [0, 0.1, 0, 0.1, 0.2, 0.1, -0.1, 0.2, 0.1, 0, -10, 0],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2]);
  const sole = new Mesh(geometry);
  sole.scale.set(1.12, 0.92, 1.12);
  sole.position.y = -0.12;
  const foot = new Group();
  foot.add(sole);
  foot.rotation.z = 0.2;
  foot.position.set(3, -0.01, 2);
  foot.updateMatrixWorld(true);
  const lift = 0.014 + 0.028 * Math.cos(0.2);
  assert.ok(Math.abs(vikingSolePenetration(foot, () => 0.004) - lift) < 1e-6);
  foot.position.y += 0.1;
  foot.updateMatrixWorld(true);
  assert.equal(
    vikingSolePenetration(foot, () => 0.004),
    0,
  );
});
