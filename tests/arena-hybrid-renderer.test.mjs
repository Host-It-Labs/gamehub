import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nativeRequire = createRequire(import.meta.url);
const manifest = JSON.parse(
  readFileSync(resolve(root, 'lib/games/arena/assets.json')),
);
async function asset(name) {
  const data = readFileSync(
    resolve(root, `public${manifest.models[name].path}`),
  );
  return new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
    '',
  );
}
const [figures, troops] = await Promise.all([
  asset('figures'),
  asset('troops'),
]);
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {};
  modules.set(file, exports);
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      // Only the cosmetic blob's canvas is omitted. Batches, clones, skeletons,
      // materials, the animator and terrain use their real production code.
      document: {
        createElement: () => ({
          getContext: () => ({
            createRadialGradient: () => ({ addColorStop() {} }),
            fillRect() {},
          }),
        }),
      },
      require(id) {
        if (id === 'three') return THREE;
        if (id === 'three/addons/utils/SkeletonUtils.js') return SkeletonUtils;
        if (id.startsWith('three/addons/')) return nativeRequire(id);
        const base = id.startsWith('@/')
          ? resolve(root, id.slice(2))
          : resolve(dirname(file), id);
        const source = [base, `${base}.ts`, resolve(base, 'index.ts')].find(
          (candidate) =>
            statSync(candidate, { throwIfNoEntry: false })?.isFile(),
        );
        assert.ok(source, `production runtime dependency ${id}`);
        return load(source);
      },
    },
  );
  return exports;
}
const r = {
  ...load(resolve(root, 'components/game/arena/world.ts')),
  ...load(resolve(root, 'components/game/arena/troops.ts')),
  ...load(resolve(root, 'components/game/arena/materials.ts')),
  ...load(resolve(root, 'lib/games/arena/cards.ts')),
  ...load(resolve(root, 'lib/games/arena/layout.ts')),
};
function fixture() {
  const world = {
    scene: new THREE.Scene(),
    assets: { figures, troops, textures: {} },
    materials: new r.MaterialLibrary({}),
    wind: { uWindTime: { value: 0 } },
  };
  world.instance = (gltf, name, team) =>
    r.ArenaWorld.prototype.instance.call(world, gltf, name, team);
  return { world, renderer: new r.TroopRenderer(world) };
}
function nodes(model) {
  const result = [];
  model.traverse((node) => result.push(node));
  return result;
}
function unit(card, side, id) {
  const stats = r.troopCards[card].unit;
  return {
    id,
    side,
    owner: side,
    card,
    x: 8 + side * 2,
    y: 4,
    px: 8 + side * 2,
    py: 4,
    hp: stats.hp,
    maxHp: stats.hp,
    state: 'walking',
    deployLeft: 0,
    targetId: null,
    attackTimer: stats.firstHit,
    facing: 0,
    sinceHit: 99,
    lane: 0,
    bridge: 3.5,
    power: 1,
    pace: 1,
    shield: stats.shield ?? 0,
    stun: 0,
    dash: false,
    charged: false,
    cooldown: 0,
    raged: false,
    taunt: 0,
    tauntId: null,
    slow: 0,
    slowFactor: 1,
    beat: 1,
  };
}
function tick(view, u, frame) {
  const dt = 1 / 60,
    stats = r.troopCards[u.card].unit;
  u.px = u.x;
  u.py = u.y;
  u.state = frame < 45 ? 'walking' : 'attacking';
  if (u.state === 'walking') {
    u.y += stats.speed * dt;
    u.facing = 0.35;
  } else {
    u.attackTimer -= dt;
    if (u.attackTimer <= 0) {
      u.attackTimer += stats.hitSpeed;
      u.sinceHit = 0;
    }
  }
  u.sinceHit += dt;
  view.update(u, 1, dt, (frame + 1) * dt);
}
function matrixMatches(actual, expected, message) {
  const error = Math.max(
    ...actual.elements.map((value, i) =>
      Math.abs(value - expected.elements[i]),
    ),
  );
  assert.ok(error < 2e-5, `${message}: matrix error ${error}`);
}
function assertDrawnPose(kit, ids) {
  const matrix = new THREE.Matrix4();
  for (const [i, part] of kit.parts.entries()) {
    part.batch.getMatrixAt(ids[i], matrix);
    matrixMatches(matrix, part.mesh.matrixWorld, part.mesh.name);
    assert.equal(part.batch.getGeometryIdAt(ids[i]), part.geometry);
  }
}
function rgba(part, id) {
  return part.batch.getColorAt(id, new THREE.Vector4());
}
function colourMatches(actual, expected, message) {
  for (const axis of ['r', 'g', 'b'])
    assert.ok(Math.abs(actual[axis] - expected[axis]) < 1e-6, message);
}

await test('six production kits render each rigid attachment once at its own animated joint while skins remain independent', () => {
  const { world, renderer } = fixture();
  const views = [];
  const camera = new THREE.PerspectiveCamera();
  try {
    // Real duplicated leaf names ensure cloning does not identify parts by name.
    const source = renderer.kits.get('mage:0');
    const duplicate = source.parts
      .filter(
        ({ mesh }) =>
          !mesh.children.length && !/eye|shoe|hand|jaw|mouth/i.test(mesh.name),
      )
      .slice(-2);
    assert.equal(duplicate.length, 2);
    for (const { mesh } of duplicate) mesh.name = 'shared-decoration-name';
    let id = 1;
    for (const card of ['duelist', 'ranger', 'mage'])
      for (const team of [0, 1]) {
        const u = unit(card, team, id++);
        const view = new r.TroopView(renderer, u.id, card, team, team);
        views.push({ view, u });
        const kit = view.kit,
          original = renderer.kits.get(`${card}:${team}`);
        const copyNodes = nodes(kit.model),
          sourceNodes = nodes(original.model);
        assert.ok(
          kit.parts.length > 0 && kit.direct.meshes.length > 0,
          `${card} has both rigid and skin geometry`,
        );
        assert.equal(
          kit.parts.length + kit.direct.meshes.length,
          copyNodes.filter((node) => node.isMesh).length,
        );
        for (const part of kit.parts) {
          assert.ok(
            part.mesh === copyNodes[part.nodeIndex],
            `${card} attachment belongs to its own clone`,
          );
          assert.notEqual(part.mesh, sourceNodes[part.nodeIndex]);
          assert.equal(
            part.mesh.geometry,
            sourceNodes[part.nodeIndex].geometry,
          );
          assert.equal(
            part.mesh.material,
            sourceNodes[part.nodeIndex].material,
          );
          assert.equal(
            part.mesh.layers.mask,
            0,
            `${card} rigid clone cannot draw alongside its batch`,
          );
          assert.equal(
            part.mesh.visible,
            true,
            'rigid parents keep descendants traversable',
          );
          assert.equal(
            part.mesh.castShadow,
            false,
            'shadow is drawn by the batch only',
          );
        }
        for (const skin of kit.direct.meshes) {
          assert.equal(skin.isSkinnedMesh, true);
          assert.notEqual(
            skin.material,
            original.direct.meshes.find(
              (node) => node.geometry === skin.geometry,
            ).material,
          );
          assert.ok(skin.layers.test(camera.layers));
          assert.ok(skin.castShadow && skin.receiveShadow);
        }
        const visibleSkins = [];
        kit.group.traverseVisible((node) => {
          if (node.isSkinnedMesh) visibleSkins.push(node);
        });
        assert.equal(
          visibleSkins.length,
          kit.direct.meshes.length,
          'hidden rigid parents do not suppress skin traversal',
        );
        assert.ok(world.scene.children.includes(kit.group));
      }
    const still = renderer.kit('mage', 0),
      stillIds = renderer.add(still);
    renderer.write(still, stillIds);
    const stillMatrix = still.parts[0].mesh.matrixWorld.clone();
    const stillBones = [...still.direct.skeletons][0].boneMatrices.slice();
    const firstHead = views[0].view.kit.rig.head.node.matrixWorld.clone();
    for (let frame = 0; frame < 105; frame++) {
      if (frame === 32) renderer.setScale(2.05);
      for (const { view, u } of views) {
        tick(view, u, frame);
        assertDrawnPose(view.kit, view.ids);
      }
      renderer.flush();
    }
    assert.ok(
      views[0].view.kit.rig.head.node.matrixWorld.elements.some(
        (value, i) => Math.abs(value - firstHead.elements[i]) > 0.01,
      ),
      'production poses actually moved',
    );
    matrixMatches(
      still.parts[0].mesh.matrixWorld,
      stillMatrix,
      'posing a sibling leaves the dormant clone unchanged',
    );
    assert.deepEqual([...still.direct.skeletons][0].boneMatrices, stillBones);
    for (const { view } of views)
      assert.deepEqual(view.kit.model.scale.toArray(), [
        ...r.figureDimensions(2.05),
      ]);
    const mage = views.find(({ u }) => u.card === 'mage' && u.side === 0).view;
    assert.equal(
      mage.kit.parts.filter(
        ({ mesh }) => mesh.name === 'shared-decoration-name',
      ).length,
      2,
    );
    assertDrawnPose(mage.kit, mage.ids);
  } finally {
    renderer.dispose();
  }
});

await test('frost, cloth flutter and xray preserve both production paths and exclude tower guards', () => {
  const { renderer } = fixture();
  const frost = new THREE.Color('#9edaff');
  const guards = renderer.kit('guard', 0),
    guardIds = renderer.add(guards, false);
  const hidden = renderer.kit('mage', 0),
    hiddenIds = renderer.add(hidden, false);
  try {
    const kits = [0, 1].map((team) => {
      const kit = renderer.kit('mage', team),
        ids = renderer.add(kit);
      renderer.write(kit, ids);
      renderer.colour(kit, ids, frost);
      renderer.flutter(kit, ids, 0.65, frost);
      const drape = kit.parts.findIndex((part) => part.drape);
      assert.ok(
        drape >= 0 && kit.parts[drape].batch.customDepthMaterial,
        'rigid cloth has a matching wind shadow',
      );
      for (const [material, base] of kit.direct.colours)
        colourMatches(
          material.color,
          base.clone().multiply(frost),
          'skin frost tint',
        );
      return { kit, ids, drape, before: rgba(kit.parts[drape], ids[drape]) };
    });
    assert.ok(renderer.hasSkinTeam(0) && renderer.hasSkinTeam(1));
    for (const skin of hidden.direct.meshes)
      for (const layer of r.SKIN_XRAY_LAYERS)
        assert.equal(
          skin.layers.isEnabled(layer),
          false,
          'guard-like skin does not draw through scenery',
        );
    renderer.xray(true);
    for (const { kit, ids, drape, before } of kits) {
      assert.equal(rgba(kit.parts[drape], ids[drape]).w, before.w);
      assert.ok(Math.abs(before.w - 1.65) < 1e-6);
      assert.ok(
        kit.direct.meshes.every((skin) =>
          skin.layers.isEnabled(r.SKIN_XRAY_LAYERS[kit.team]),
        ),
      );
      for (const [material, base] of kit.direct.colours)
        colourMatches(
          material.color,
          base.clone().multiply(frost),
          'skin keeps frost during silhouette override',
        );
      for (const [i, part] of kit.parts.entries())
        assert.equal(part.batch.getVisibleAt(ids[i]), true);
    }
    for (const [i, part] of guards.parts.entries())
      assert.equal(part.batch.getVisibleAt(guardIds[i]), false);
    for (const [i, part] of hidden.parts.entries())
      assert.equal(part.batch.getVisibleAt(hiddenIds[i]), false);
    renderer.xray(false);
    for (const { kit, ids, drape, before } of kits) {
      assert.deepEqual(
        rgba(kit.parts[drape], ids[drape]).toArray(),
        before.toArray(),
        'xray restores cloth tint and flutter alpha',
      );
      for (const [i, part] of kit.parts.entries()) {
        const colour = part.batch.getColorAt(ids[i], new THREE.Color());
        colourMatches(colour, frost, 'all rigid frost tints survive xray');
      }
    }
    for (const [i, part] of guards.parts.entries())
      assert.equal(part.batch.getVisibleAt(guardIds[i]), true);
    renderer.remove(guards, guardIds);
    renderer.remove(hidden, hiddenIds);
  } finally {
    renderer.dispose();
  }
});

await test('hybrid removal and disposal release both paths exactly once without freeing shared production resources', () => {
  const { world, renderer } = fixture();
  const live = [];
  let ownedDisposed = 0,
    ownedTotal = 0,
    sharedDisposed = 0,
    batchesDisposed = 0;
  const shared = new Set();
  for (const kit of renderer.kits.values())
    kit.model.traverse((node) => {
      if (node.isMesh) {
        shared.add(node.geometry);
        shared.add(node.material);
      }
    });
  for (const resource of shared)
    resource.addEventListener('dispose', () => {
      sharedDisposed++;
    });
  for (const batch of renderer.batches.values())
    batch.addEventListener('dispose', () => {
      batchesDisposed++;
    });
  const batchTotal = renderer.batches.size;
  for (let i = 0; i < 18; i++) {
    const kit = renderer.kit(['duelist', 'ranger', 'mage'][i % 3], i % 2),
      ids = renderer.add(kit);
    kit.group.position.set(i, 0, i / 3);
    renderer.write(kit, ids);
    live.push({ kit, ids });
    for (const material of kit.direct.materials) {
      ownedTotal++;
      material.addEventListener('dispose', () => {
        ownedDisposed++;
      });
    }
    for (const skeleton of kit.direct.skeletons) {
      skeleton.computeBoneTexture();
      ownedTotal++;
      skeleton.boneTexture.addEventListener('dispose', () => {
        ownedDisposed++;
      });
    }
  }
  const activeInstances = () =>
    [...renderer.batches.values()].reduce(
      (count, batch) => count + batch.instanceCount,
      0,
    );
  assert.equal(
    activeInstances(),
    live.reduce((count, { kit }) => count + kit.parts.length, 0),
  );
  assert.ok(
    [...renderer.batches.values()].some((batch) => batch.maxInstanceCount > 64),
    'real attachment populations grow batch capacity',
  );
  const { kit, ids } = live[0],
    before = activeInstances();
  // Existing callers use [] for direct skins. The hybrid owns both allocations.
  renderer.remove(kit, []);
  assert.equal(activeInstances(), before - kit.parts.length);
  const disposedAfterFirst = ownedDisposed;
  renderer.remove(kit, ids);
  assert.equal(activeInstances(), before - kit.parts.length);
  assert.equal(
    ownedDisposed,
    disposedAfterFirst,
    'repeated removal has no second disposal',
  );
  for (const entry of live.slice(1)) assertDrawnPose(entry.kit, entry.ids);
  const replacement = renderer.kit('duelist', 0),
    replacementIds = renderer.add(replacement);
  renderer.write(replacement, replacementIds);
  assertDrawnPose(replacement, replacementIds);
  renderer.remove(replacement, replacementIds);
  renderer.dispose();
  assert.equal(
    ownedDisposed,
    ownedTotal,
    'every tracked owned skin material and bone texture is disposed once',
  );
  assert.equal(
    sharedDisposed,
    0,
    'unit removal never owns source geometry or library material',
  );
  assert.equal(batchesDisposed, batchTotal);
  assert.equal(renderer.directKits.size, 0);
  assert.equal(renderer.directIds.size, 0);
  assert.ok(
    !world.scene.children.some(
      (node) =>
        node.isBatchedMesh || live.some(({ kit }) => kit.group === node),
    ),
  );
  renderer.dispose();
  assert.equal(batchesDisposed, batchTotal, 'renderer disposal is idempotent');
  assert.equal(ownedDisposed, ownedTotal);
  assert.equal(sharedDisposed, 0);
});
