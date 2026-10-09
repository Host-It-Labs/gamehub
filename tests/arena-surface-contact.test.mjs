import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {
  runtime as r,
  THREE,
  root,
  makeRenderer,
  makeWorld,
} from '../scripts/arena-audit-runtime.mjs';

let canonicalFigures;
async function figures() {
  if (canonicalFigures) return canonicalFigures;
  const manifest = JSON.parse(
    readFileSync(root + 'lib/games/arena/assets.json'),
  );
  const bytes = readFileSync(root + 'public' + manifest.models.figures.path);
  canonicalFigures = (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
  return canonicalFigures;
}

const native = new THREE.Vector3();
const cached = new THREE.Vector3();
function compare(surface, reader) {
  for (let i = 0; i < reader.count; i++) {
    surface.mesh
      .getVertexPosition(surface.indices?.[i] ?? i, native)
      .applyMatrix4(surface.mesh.matrixWorld);
    reader.read(i, cached);
    for (const axis of ['x', 'y', 'z'])
      assert.ok(
        Object.is(native[axis], cached[axis]),
        `${surface.mesh.name} point ${i} ${axis}: native ${native[axis]}, cached ${cached[axis]}`,
      );
  }
}

function smallSkin() {
  const group = new THREE.Group();
  const bones = Array.from({ length: 4 }, (_, i) => {
    const bone = new THREE.Bone();
    bone.position.set(i * 0.17, i * 0.23, i * -0.12);
    group.add(bone);
    return bone;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0.2, 0.4, -0.1, -0.3, 0.8, 0.23], 3),
  );
  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute([0, 1, 2, 3, 3, 2, 1, 0], 4),
  );
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(
      [0.1, 0.2, 0.3, 0.4, 0.4, 0.3, 0.2, 0.1],
      4,
    ),
  );
  const mesh = new THREE.SkinnedMesh(geometry);
  mesh.name = 'four-influence-skin';
  group.add(mesh);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  bones.forEach((bone, i) => bone.rotation.set(i * 0.19, i * -0.13, i * 0.07));
  group.rotation.set(0.2, -0.8, 0.1);
  group.scale.set(1.3, 0.9, 1.1);
  group.updateMatrixWorld(true);
  const surface = { mesh, indices: [1, 0] };
  return { group, mesh, bones, surface };
}

await test('cached selected skin points exactly match the canonical model through guards, body turns and portrait scales', async () => {
  const model = clone((await figures()).getObjectByName('sumo'));
  const body = new THREE.Group();
  body.add(model);
  const surfaces = ['L', 'R'].flatMap((side) =>
    r.figureSurfaces(model, 'sumo', `arm${side}`),
  );
  assert.ok(surfaces.some((surface) => surface.indices?.length > 1000));
  assert.ok(surfaces.some((surface) => !surface.mesh.isSkinnedMesh));
  const readers = surfaces.map(r.createSurfacePointReader);
  let mixed = 0;
  for (const { mesh, indices } of surfaces)
    if (mesh.isSkinnedMesh)
      for (const index of indices) {
        let influences = 0;
        for (let c = 0; c < 4; c++)
          if (mesh.geometry.attributes.skinWeight.getComponent(index, c) > 0)
            influences++;
        if (influences > 1) mixed++;
      }
  assert.ok(mixed > 100, 'blended shoulder/torso seams are included');
  for (let pose = 0; pose < 12; pose++) {
    model.scale.set(
      ...r.figureDimensions([r.TROOP_SCALE, 2.37475, 3.1211][pose % 3]),
    );
    body.position.set(2.6, pose % 4 === 0 ? 2.8 : 0, Math.sin(pose * 0.3));
    body.rotation.set(
      Math.sin(pose) * 0.08,
      pose * 0.37 - 2,
      Math.cos(pose) * 0.07,
      'YXZ',
    );
    const target =
      pose % 2
        ? { shoulder: -0.35, inward: 0.25, elbow: 0.5 }
        : { shoulder: 0.7, inward: 1.1, elbow: 1.5 };
    const fraction = [0, 0.125, 0.5, 0.875, 1, 0.25][pose % 6];
    for (const side of ['L', 'R']) {
      const sign = side === 'L' ? 1 : -1;
      model
        .getObjectByName(`sumoarm${side}`)
        .rotation.set(
          target.shoulder * fraction,
          0,
          sign * target.inward * fraction,
        );
      model
        .getObjectByName(`sumofore${side}`)
        .rotation.set(target.elbow * fraction, 0, 0);
      model
        .getObjectByName(`sumohand${side}`)
        .rotation.set(0.15 * fraction, 0, 0);
    }
    model.getObjectByName('sumotorso').rotation.x = Math.sin(pose * 0.4) * 0.13;
    // The attached skin must refresh its inverse after every preview yaw.
    body.updateMatrixWorld(true);
    for (const [i, reader] of readers.entries()) {
      reader.refresh();
      compare(surfaces[i], reader);
    }
  }
});

await test('future body-yaw contact previews use the attached skin inverse for that same pose', async () => {
  const renderer = makeRenderer(makeWorld(await figures(), new THREE.Group()));
  renderer.setScale(3.1211);
  const view = new r.TroopView(renderer, 1, 'sumo', 0, 0);
  const tower = { kind: 'king', side: 1, x: 9, y: 16, destroyed: false };
  const stats = r.troopCards.sumo.unit;
  const unit = {
    ...r.plainUnit,
    id: 1,
    card: 'sumo',
    side: 0,
    owner: 0,
    x: 13.3,
    y: 16.4,
    px: 13.25,
    py: 16.38,
    state: 'walking',
    hp: stats.hp,
    maxHp: stats.hp,
    facing: -Math.PI / 2,
    deployLeft: 0,
    sinceHit: 99,
    attackTimer: stats.firstHit,
    pace: 1.35,
    beat: 1.35,
  };
  view.update(unit, 0, 1 / 60, 1 / 60, [tower], 0.9);
  let previews = 0;
  const base = new THREE.Vector4();
  const transformed = new THREE.Vector4();
  const matrix = new THREE.Matrix4();
  const expected = new THREE.Vector3();
  view.kit.model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    mesh.getVertexPosition = function (index, target) {
      const local = THREE.SkinnedMesh.prototype.getVertexPosition.call(
        this,
        index,
        target,
      );
      // Matching attached bind inverse/world transforms cancel. Compute
      // the weighted world point independently of either transform.
      const attributes = this.geometry.attributes;
      base
        .set(
          attributes.position.getX(index),
          attributes.position.getY(index),
          attributes.position.getZ(index),
          1,
        )
        .applyMatrix4(this.bindMatrix);
      expected.set(0, 0, 0);
      for (let c = 0; c < 4; c++) {
        const weight = attributes.skinWeight.getComponent(index, c);
        if (!weight) continue;
        const bone = attributes.skinIndex.getComponent(index, c);
        matrix.multiplyMatrices(
          this.skeleton.bones[bone].matrixWorld,
          this.skeleton.boneInverses[bone],
        );
        transformed.copy(base).applyMatrix4(matrix);
        expected.x += transformed.x * weight;
        expected.y += transformed.y * weight;
        expected.z += transformed.z * weight;
      }
      const actual = local.clone().applyMatrix4(this.matrixWorld);
      assert.ok(
        actual.distanceTo(expected) < 1e-12,
        'preview yaw and attached inverse agree',
      );
      if (
        Math.abs(view.kit.body.rotation.y - view.facing - view.yawKick) > 0.05
      )
        previews++;
      return local;
    };
  });
  view.clearArms(false, true, view.facing + 1.1);
  assert.ok(previews > 100, 'the future-turn sweep was actually sampled');
  renderer.remove(view.kit, view.ids);
  renderer.dispose();
});

await test('point caches refresh candidate matrices and rebuild changed vertex, weight, bind and skeleton inputs', () => {
  const { group, mesh, bones, surface } = smallSkin();
  const reader = r.createSurfacePointReader(surface);
  reader.refresh();
  assert.equal(reader.mode, 'cached');
  compare(surface, reader);
  reader.read(0, cached);
  const before = cached.clone();
  bones[1].rotation.x += 0.7;
  group.updateMatrixWorld(true);
  mesh.getVertexPosition(1, native).applyMatrix4(mesh.matrixWorld);
  assert.ok(native.distanceTo(before) > 0.01, 'omitted refresh is detected');
  reader.refresh();
  compare(surface, reader);
  for (const name of ['position', 'skinWeight', 'skinIndex']) {
    mesh.geometry.setAttribute(name, mesh.geometry.attributes[name].clone());
    reader.refresh();
    compare(surface, reader);
    const attribute = mesh.geometry.attributes[name];
    if (name === 'position') attribute.setX(0, attribute.getX(0) + 0.03);
    if (name === 'skinWeight') attribute.setX(0, attribute.getX(0) + 0.02);
    if (name === 'skinIndex') attribute.setX(0, 2);
    attribute.needsUpdate = true;
    reader.refresh();
    compare(surface, reader);
  }
  const position = mesh.geometry.attributes.position;
  const interleaved = new THREE.InterleavedBuffer(
    new Float32Array(position.count * 5),
    5,
  );
  for (let i = 0; i < position.count; i++)
    interleaved.array.set(
      [position.getX(i), position.getY(i), position.getZ(i)],
      i * 5 + 1,
    );
  mesh.geometry.setAttribute(
    'position',
    new THREE.InterleavedBufferAttribute(interleaved, 3, 1),
  );
  reader.refresh();
  compare(surface, reader);
  interleaved.array[1] += 0.05;
  interleaved.needsUpdate = true;
  reader.refresh();
  compare(surface, reader);
  mesh.bindMatrix.elements[12] += 0.02;
  reader.refresh();
  compare(surface, reader);
  mesh.skeleton = mesh.skeleton.clone();
  reader.refresh();
  compare(surface, reader);
  surface.indices = [0, 1];
  reader.refresh();
  compare(surface, reader);
});

await test('morphs, custom skin methods and rigid attachments use their native posed point path', () => {
  const { group, mesh, surface } = smallSkin();
  const reader = r.createSurfacePointReader(surface);
  const morph = mesh.geometry.attributes.position.clone();
  for (let i = 0; i < morph.count; i++) morph.setY(i, morph.getY(i) + 0.15);
  mesh.geometry.morphAttributes.position = [morph];
  mesh.updateMorphTargets();
  mesh.morphTargetInfluences[0] = 0.6;
  reader.refresh();
  assert.equal(reader.mode, 'native');
  compare(surface, reader);
  mesh.morphTargetInfluences[0] = 0;
  reader.refresh();
  assert.equal(reader.mode, 'cached');
  compare(surface, reader);
  const nativePoint = mesh.getVertexPosition.bind(mesh);
  mesh.getVertexPosition = function (index, target) {
    return nativePoint(index, target).addScalar(0.01);
  };
  reader.refresh();
  assert.equal(reader.mode, 'native');
  compare(surface, reader);
  delete mesh.getVertexPosition;
  const nativeBone = mesh.applyBoneTransform.bind(mesh);
  mesh.applyBoneTransform = function (index, target) {
    return nativeBone(index, target).addScalar(-0.02);
  };
  reader.refresh();
  assert.equal(reader.mode, 'native');
  compare(surface, reader);
  const rigid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.1));
  group.add(rigid);
  group.updateMatrixWorld(true);
  const piece = { mesh: rigid };
  const rigidReader = r.createSurfacePointReader(piece);
  rigidReader.refresh();
  assert.equal(rigidReader.mode, 'native');
  compare(piece, rigidReader);
});

await test('threshold-only arm stone tests preserve the original union at exact and near-boundary clearances', () => {
  let seed = 1931;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (const kind of ['king', 'princess'])
    for (const side of [0, 1])
      for (const scale of [0.85, 0.9]) {
        const t = { kind, side, x: 9, y: 16, destroyed: false };
        for (let i = 0; i < 2000; i++) {
          const x = (random() - 0.5) * 9;
          const y = random() * 5 - 0.4;
          const z = (random() - 0.5) * 9;
          const gap = r.towerArmGap(t, x, y, z, scale);
          for (const margin of [0.04, 0.18, gap, gap - 1e-14, gap + 1e-14])
            assert.equal(
              r.towerArmBlocked(t, x, y, z, scale, margin),
              gap < margin,
              `${kind}/${side}/${scale} ${[x, y, z].join(',')} at ${margin}`,
            );
        }
      }
});
