import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { Euler, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../components/game/arena/moves/gladiator.ts', import.meta.url),
      'utf8',
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports, Math },
);
const { gladiator, gladiatorSolePenetration } = exports;

function frame(shield, memo = {}, swing = 0) {
  const requested = new Map();
  const p = Object.fromEntries(
    [
      'torsoX',
      'torsoY',
      'torsoZ',
      'headX',
      'headY',
      'armL',
      'armR',
      'armLz',
      'armRz',
      'weapon',
      'lean',
      'roll',
      'lunge',
    ].map((key) => [key, 0]),
  );
  p.armL = swing;
  gladiator.pose(
    {
      unit: { id: 7, shield },
      memo,
      dt: 1 / 60,
      t: 2,
      walk: 1,
      aim: 0,
      idle: 0,
      idleFor: 0,
      wind: 0,
      since: 99,
      reduced: false,
      flinch: 0,
      deploy: 1,
      fwdL: 0.5,
      hipL: 0.2,
      hipR: -0.2,
      pass: 0.6,
      accel: 0,
      lateral: 0,
      turn: 0,
      want(part, x = 0, y = 0, z = 0) {
        requested.set(part, [x, y, z]);
      },
    },
    p,
  );
  return { p, requested };
}

await test('Gladiator releases and recovers the walking shield arm continuously', () => {
  const memo = {};
  frame(650, memo);
  let previous = memo.shieldMix;
  for (let i = 0; i < 120; i++) {
    frame(0, memo);
    assert.ok(memo.shieldMix < previous, 'spent shield lowers smoothly');
    previous = memo.shieldMix;
  }
  const low = { ...memo };
  const freeSwing =
    frame(0, { ...low }, 0.6).p.armL - frame(0, { ...low }, 0).p.armL;
  assert.ok(freeSwing > 0.59, 'lowered shield arm restores its walking swing');
  const refilled = frame(1, memo).requested.get('handL')[0];
  assert.ok(Number.isFinite(refilled));
  assert.ok(
    memo.shieldMix > previous,
    'first refill starts raising the actual hand',
  );
  for (let i = 0; i < 120; i++) frame(650, memo);
  const held = { ...memo };
  const carrySwing =
    frame(650, { ...held }, 0.6).p.armL - frame(650, { ...held }, 0).p.armL;
  assert.ok(
    Math.abs(carrySwing - 0.12) < 0.001,
    'recharged shield settles into steady carriage',
  );
  assert.equal(
    frame(0).requested.get('handL')[0],
    frame(650).requested.get('handL')[0],
    'fresh placement preview still carries its shield',
  );
});

await test('Gladiator keeps equipment rigid within the fist and compensates at the wrists', () => {
  const f = frame(650);
  assert.deepEqual([...f.requested.get('weapon')], [0, 0, 0]);
  assert.deepEqual([...f.requested.get('shield')], [0, 0, 0]);
  assert.ok(f.requested.has('handR') && f.requested.has('handL'));
});

await test('Gladiator grips and garment waist stay attached through joint extremes', async () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL('../lib/games/arena/assets.json', import.meta.url),
      'utf8',
    ),
  );
  const path = process.env.ARENA_GLADIATOR_REVIEW_GLTF
    ? resolve(process.env.ARENA_GLADIATOR_REVIEW_GLTF)
    : new URL(`../public${manifest.models.figures.path}`, import.meta.url);
  const bytes = readFileSync(path);
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const root = scene.getObjectByName('gladiator');
  assert.ok(root);
  const joint = (name) => {
    const node = root.getObjectByName('gladiator' + name);
    assert.ok(node, name + ' exists');
    return node;
  };
  let skin;
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.userData.continuousSkin) skin = o;
  });
  assert.ok(skin, 'one connected skin carries the anatomical deformation');
  const positions = skin.geometry.attributes.position;
  root.updateMatrixWorld(true);
  // The connected toes live on the skin beside the skeleton, outside the
  // ankle's child traversal. A rolled sole must measure their posed shape.
  const foot = joint('footL');
  const footRest = foot.quaternion.clone();
  const footIndex = skin.skeleton.bones.indexOf(foot);
  const skinIndices = skin.geometry.attributes.skinIndex;
  const skinWeights = skin.geometry.attributes.skinWeight;
  const toeIndices = [];
  for (let index = 0; index < positions.count; index++)
    for (let component = 0; component < 4; component++)
      if (
        skinIndices.getComponent(index, component) === footIndex &&
        skinWeights.getComponent(index, component) > 0.01
      ) {
        toeIndices.push(index);
        break;
      }
  assert.ok(toeIndices.length, 'ankle has an actual weighted skin surface');
  foot.quaternion.multiply(new Quaternion().setFromEuler(new Euler(0, 0, 0.4)));
  root.updateMatrixWorld(true);
  skin.skeleton.update();
  assert.ok(
    gladiatorSolePenetration([{ mesh: skin, indices: toeIndices }], () => 0) >
      0.001,
    'sole contact sees connected toes after the actual ankle rolls',
  );
  foot.quaternion.copy(footRest);
  root.updateMatrixWorld(true);
  skin.skeleton.update();
  const grips = [];
  for (const [side, tool] of [
    ['L', 'shield'],
    ['R', 'weapon'],
  ]) {
    const hand = joint('hand' + side);
    const equipment = joint(tool);
    assert.equal(equipment.parent?.name, hand?.name);
    assert.equal(hand.parent?.name, joint('fore' + side)?.name);
    const centre = equipment.getWorldPosition(new Vector3());
    const candidates = [];
    for (let i = 0; i < positions.count; i++) {
      const world = skin.localToWorld(
        new Vector3().fromBufferAttribute(positions, i),
      );
      const distance = world.distanceTo(centre);
      if (distance < 0.018)
        candidates.push({ i, distance, local: equipment.worldToLocal(world) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    assert.ok(candidates.length > 0, side + ' grip has actual contacting skin');
    grips.push({ equipment, samples: candidates.slice(0, 16) });
  }
  const torso = joint('torso');
  const garments = [];
  root.traverse((o) => {
    // glTF represents a mesh with several material primitives as a group;
    // custom extras belong to that node rather than its skinned children.
    if (
      !o.isSkinnedMesh ||
      !(o.userData.garmentLining || o.parent?.userData.garmentLining)
    )
      return;
    const samples = [];
    const points = o.geometry.attributes.position;
    for (let index = 0; index < points.count; index++) {
      const world = o.localToWorld(
        new Vector3().fromBufferAttribute(points, index),
      );
      if (world.y > 0.61 && world.y < 0.651)
        samples.push({ index, local: torso.worldToLocal(world) });
    }
    assert.ok(samples.length, 'garment has actual cloth at the fixed waist');
    garments.push({ mesh: o, samples: samples.slice(0, 16) });
  });
  assert.ok(
    garments.length,
    'flexible garment tops connect the belt and swinging hem',
  );
  const rest = new Map();
  for (const part of [
    'armL',
    'foreL',
    'handL',
    'armR',
    'foreR',
    'handR',
    'torso',
    'skirtL',
    'skirtR',
  ])
    rest.set(part, joint(part).quaternion.clone());
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    root.rotation.y = t * Math.PI * 2;
    for (const [part, q] of rest) {
      const angle =
        part === 'torso'
          ? -0.22 + t * 0.3
          : part.startsWith('skirt')
            ? -0.25 + t * 0.65
            : part.startsWith('arm')
              ? -0.6 + t * 1.8
              : part.startsWith('fore')
                ? 0.75 - t * 1.4
                : -0.4 + t * 0.8;
      joint(part)
        .quaternion.copy(q)
        .multiply(
          new Quaternion().setFromEuler(
            new Euler(
              angle,
              part === 'foreR' ? t * 1.05 : part === 'handR' ? t * 0.3 : 0,
              0,
            ),
          ),
        );
    }
    root.updateMatrixWorld(true);
    skin.skeleton.update();
    for (const { equipment, samples } of grips)
      for (const { i: index, local } of samples) {
        const actual = new Vector3().fromBufferAttribute(positions, index);
        skin.applyBoneTransform(index, actual);
        skin.localToWorld(actual);
        const expected = equipment.localToWorld(local.clone());
        assert.ok(
          actual.distanceTo(expected) < 0.0001,
          'skin grip stays within 0.1 mm of its equipment',
        );
      }
    for (const { mesh, samples } of garments) {
      mesh.skeleton.update();
      for (const { index, local } of samples) {
        const actual = new Vector3().fromBufferAttribute(
          mesh.geometry.attributes.position,
          index,
        );
        mesh.applyBoneTransform(index, actual);
        mesh.localToWorld(actual);
        assert.ok(
          actual.distanceTo(torso.localToWorld(local.clone())) < 0.0001,
          'garment waist stays within 0.1 mm of the torso while the skirt swings',
        );
      }
    }
  }
});
