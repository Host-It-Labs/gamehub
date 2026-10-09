import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BatchedMesh, Box3, Vector3 } from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { resolutionFloor } from '../components/game/arena/quality.ts';
import { ladder } from '../components/game/arena/pacer.ts';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { troopCards, troopDeck } from '../lib/games/arena/cards.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../lib/games/arena/assets.json', import.meta.url)),
);
async function model(name) {
  const data = readFileSync(
    new URL(`../public${manifest.models[name].path}`, import.meta.url),
  );
  return (
    await new GLTFLoader().parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
      '',
    )
  ).scene;
}

await test('shared cartoon tower silhouettes stay within the existing tower size', async () => {
  const desktop = await model('towers');
  const cartoon = await model('cartoon_towers');
  for (const kind of ['king', 'princess']) {
    const a = new Box3().setFromObject(desktop.getObjectByName(kind));
    const b = new Box3().setFromObject(cartoon.getObjectByName(kind));
    const sizeA = a.getSize(new Vector3());
    const sizeB = b.getSize(new Vector3());
    for (const axis of ['x', 'y', 'z'])
      assert.ok(
        sizeB[axis] <= sizeA[axis] * 1.02,
        `${kind} ${axis}: ${sizeB[axis]} exceeds ${sizeA[axis]}`,
      );
    assert.ok(Math.abs(b.min.y) < 0.02, `${kind} stands at ground level`);
  }
});

await test('every figure keeps a naturally proportioned articulated head and its original troop root', async () => {
  const figures = await model('figures');
  for (const id of ['guard', ...troopDeck]) {
    const root = figures.getObjectByName(id);
    assert.ok(root, id);
    assert.ok(root.position.length() < 0.001, `${id} has no lineup offset`);
    const head = root.getObjectByName(`${id}head`);
    assert.ok(head, `${id} retains its head joint for animation`);
    assert.ok(Math.abs(head.scale.x - 1) < 0.001, `${id} head scale`);
    assert.ok(
      Math.abs(head.rotation.x) <= (8 * Math.PI) / 180,
      `${id} keeps a natural neck pose`,
    );
  }
});

await test('Cowboy, Samurai and Wizard keep connected arm deformation within their original geometry costs', async () => {
  const figures = await model('figures');
  // Measured from the preserved pre-rework bundle, including their costumes
  // and weapons. Detailed masters are kept separately from shipped copies.
  for (const [id, ceiling] of [
    ['ranger', 17200],
    ['duelist', 19140],
    ['mage', 18548],
  ]) {
    const root = figures.getObjectByName(id);
    let triangles = 0;
    const armJoints = new Set();
    root.traverse((node) => {
      if (!node.isMesh) return;
      triangles +=
        (node.geometry.index?.count ??
          node.geometry.attributes.position.count) / 3;
      assert.ok(
        !Object.keys(node.geometry.attributes).some((name) =>
          /^color_?\d+$/.test(name),
        ),
        `${id} has one active pigment/AO channel`,
      );
      if (!node.isSkinnedMesh) return;
      const indices = node.geometry.attributes.skinIndex;
      const weights = node.geometry.attributes.skinWeight;
      for (let vertex = 0; vertex < weights.count; vertex++)
        for (let component = 0; component < 4; component++) {
          if (weights.getComponent(vertex, component) <= 1e-6) continue;
          const name =
            node.skeleton.bones[indices.getComponent(vertex, component)].name;
          if (/^(arm|fore)[LR]$/.test(name.slice(id.length)))
            armJoints.add(name);
        }
    });
    assert.ok(triangles <= ceiling, `${id}: ${triangles} exceeds ${ceiling}`);
    for (const part of ['armL', 'armR', 'foreL', 'foreR'])
      assert.ok(armJoints.has(id + part), `${id} ${part} deforms real cloth`);
  }
});

await test('Dino visual scale survives the shared runtime scale and retains grounded feet', async () => {
  const figures = await model('figures');
  const dino = figures.getObjectByName('ogre');
  const visual = dino.getObjectByName('ogrevisual');
  assert.ok(visual, 'all dinosaur parts share an inner visual root');
  for (const value of visual.scale.toArray())
    assert.ok(Math.abs(value - 0.78) < 0.001);
  const before = new Box3().setFromObject(dino);
  assert.ok(Math.abs(before.min.y) < 0.05, 'feet remain at ground level');
  dino.scale.set(2.24, 2, 2.24);
  dino.updateMatrixWorld(true);
  const after = new Box3().setFromObject(dino);
  assert.ok(Math.abs(after.max.y / before.max.y - 2) < 0.001);
  assert.ok(Math.abs(visual.scale.x - 0.78) < 0.001);
});

await test('adaptive rendering keeps native clarity and can still lower shadows', () => {
  for (const dpr of [1, 1.25, 2, 3]) {
    const rungs = ladder(4096, resolutionFloor(dpr));
    assert.equal(rungs[0].resolution, 1);
    assert.ok(rungs.some((r) => r.shadowSize === 2048));
    for (const rung of rungs)
      assert.ok(rung.resolution * dpr >= Math.min(dpr, 1.5));
  }
});

await test('all walking figures have independent knee and ankle joints', async () => {
  const figures = await model('figures');
  for (const id of [
    'guard',
    ...troopDeck.filter((id) => !troopCards[id].unit.flying),
  ]) {
    for (const side of ['L', 'R']) {
      const hip = figures.getObjectByName(`${id}leg${side}`);
      const knee = figures.getObjectByName(`${id}knee${side}`);
      const foot = figures.getObjectByName(`${id}foot${side}`);
      assert.ok(knee && foot, `${id} ${side} has both bending joints`);
      assert.equal(knee.parent?.name, hip?.name);
      assert.equal(foot.parent?.name, knee?.name);
      const before = new Vector3();
      figures.updateMatrixWorld(true);
      foot.getWorldPosition(before);
      knee.rotation.x -= 0.7;
      figures.updateMatrixWorld(true);
      const after = new Vector3();
      foot.getWorldPosition(after);
      assert.ok(
        before.distanceTo(after) > 0.015,
        `${id} heel actually moves independently of the thigh`,
      );
    }
  }
});

await test('rigid figure parts remain compatible with material batching alongside connected skins', async () => {
  const figures = await model('figures');
  // Batched as the game does (TroopRenderer): per material and attribute
  // layout, so cloth with its wave uv set has a batch of its own.
  const layout = (g) =>
    Object.keys(g.attributes)
      .sort()
      .map((n) => {
        const a = g.getAttribute(n);
        return `${n}${a.itemSize}${a.normalized ? 'n' : ''}${a.array.constructor.name}`;
      })
      .join(',');
  const groups = new Map();
  for (const figure of figures.children) {
    figure.traverse((node) => {
      if (!node.isMesh || node.isSkinnedMesh) return;
      const key = `${node.material.uuid}|${layout(node.geometry)}`;
      const entry = groups.get(key) ?? { material: node.material, list: [] };
      entry.list.push(node.geometry);
      groups.set(key, entry);
    });
  }
  for (const { material, list: geometries } of groups.values()) {
    const vertices = geometries.reduce(
      (n, g) => n + g.attributes.position.count,
      0,
    );
    const indices = geometries.reduce((n, g) => n + g.index.count, 0);
    const batch = new BatchedMesh(1, vertices, indices, material);
    try {
      for (const geometry of geometries) batch.addGeometry(geometry);
    } finally {
      batch.dispose();
    }
  }
});

await test('exported skins keep local bones, normalized weights and real independent deformation', async (t) => {
  const figures = await model('figures');
  const originals = [];
  figures.traverse((node) => {
    if (node.isSkinnedMesh) originals.push(node);
  });
  if (!originals.length)
    return t.skip('replacement skinned asset is not merged yet');
  const copy = cloneSkeleton(figures);
  const point = new Vector3();
  const moved = new Vector3();
  for (const skin of originals) {
    const cloned = copy.getObjectByName(skin.name);
    assert.ok(cloned?.isSkinnedMesh);
    assert.notEqual(cloned.skeleton, skin.skeleton);
    assert.equal(cloned.geometry, skin.geometry);
    const indices = skin.geometry.attributes.skinIndex;
    const weights = skin.geometry.attributes.skinWeight;
    assert.equal(indices.count, skin.geometry.attributes.position.count);
    assert.equal(weights.count, indices.count);
    let influenced = -1;
    let boneIndex = -1;
    for (let i = 0; i < weights.count; i++) {
      let sum = 0;
      for (let component = 0; component < 4; component++) {
        const weight = weights.getComponent(i, component);
        const index = indices.getComponent(i, component);
        assert.ok(weight >= 0 && Number.isFinite(weight));
        assert.ok(index >= 0 && index < skin.skeleton.bones.length);
        sum += weight;
        if (weight > 0.4 && influenced < 0) {
          influenced = i;
          boneIndex = index;
        }
      }
      assert.ok(
        Math.abs(sum - 1) < 0.001,
        `${skin.name} vertex ${i} weights sum to ${sum}`,
      );
    }
    assert.ok(influenced >= 0);
    for (let i = 0; i < skin.skeleton.bones.length; i++) {
      assert.notEqual(cloned.skeleton.bones[i], skin.skeleton.bones[i]);
      assert.ok(copy.getObjectById(cloned.skeleton.bones[i].id));
    }
    figures.updateMatrixWorld(true);
    copy.updateMatrixWorld(true);
    cloned.getVertexPosition(influenced, point);
    const original = skin.getVertexPosition(influenced, new Vector3());
    cloned.skeleton.bones[boneIndex].position.x += 0.1;
    copy.updateMatrixWorld(true);
    cloned.getVertexPosition(influenced, moved);
    assert.ok(moved.distanceTo(point) > 0.035, `${skin.name} actually deforms`);
    assert.ok(
      skin.getVertexPosition(influenced, new Vector3()).distanceTo(original) <
        1e-8,
      'posing the copy preserves the source',
    );
  }
});
