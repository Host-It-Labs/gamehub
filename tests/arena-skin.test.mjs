import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const canvas = {
  width: 0,
  height: 0,
  getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
  }),
};
const modules = new Map();
const motionMath = Object.create(Math);
motionMath.random = () => 0.5;
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
      Math: motionMath,
      document: { createElement: () => ({ ...canvas }) },
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
        assert.ok(source, `skin runtime dependency ${id}`);
        return load(source);
      },
    },
  );
  return exports;
}
const r = {
  ...load(resolve(root, 'components/game/arena/world.ts')),
  ...load(resolve(root, 'components/game/arena/troops.ts')),
  ...load(resolve(root, 'components/game/arena/effects.ts')),
  ...load(resolve(root, 'components/game/arena/view.ts')),
  ...load(resolve(root, 'components/game/arena/materials.ts')),
  ...load(resolve(root, 'lib/games/arena/cards.ts')),
  ...load(resolve(root, 'lib/games/arena/engine.ts')),
  ...load(resolve(root, 'lib/games/arena/layout.ts')),
};

/** A real weighted mesh with blended knee/ankle vertices, plus ordinary
 *  belt/face attachments. The GPU is the only piece this fixture omits. */
function skinSource() {
  const model = new THREE.Group();
  model.name = 'sumo';
  const bones = [];
  const joint = (part, parent, x, y, z = 0) => {
    const bone = new THREE.Bone();
    bone.name = `sumo${part}`;
    bone.position.set(x, y, z);
    parent.add(bone);
    bones.push(bone);
    return bone;
  };
  const pelvis = joint('root', model, 0, 0);
  const torso = joint('torso', pelvis, 0, 0.85);
  const head = joint('head', torso, 0, 0.85);
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? -1 : 1;
    const hip = joint(`leg${side}`, pelvis, sign * 0.21, 0.85);
    const knee = joint(`knee${side}`, hip, 0, -0.4);
    joint(`foot${side}`, knee, 0, -0.35);
    const arm = joint(`arm${side}`, torso, sign * 0.34, 0.58);
    const elbow = joint(`fore${side}`, arm, sign * 0.1, -0.25);
    joint(`hand${side}`, elbow, 0, -0.22);
  }
  const positions = [],
    weights = [],
    indices = [];
  const patch = (part, x, y, z, width, height, blend) => {
    const index = bones.findIndex((bone) => bone.name === `sumo${part}`);
    const other = blend
      ? bones.findIndex((bone) => bone.name === `sumo${blend}`)
      : index;
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      positions.push(x + dx * width, y + dy * height, z);
      indices.push(index, other, 0, 0);
      weights.push(blend ? 0.75 : 1, blend ? 0.25 : 0, 0, 0);
    }
  };
  patch('torso', 0, 0.95, -0.24, 0.3, 0.35);
  patch('head', 0, 1.7, -0.16, 0.19, 0.2);
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? -1 : 1;
    patch(`foot${side}`, sign * 0.21, 0.06, -0.35, 0.1, 0.06, `knee${side}`);
    patch(`hand${side}`, sign * 0.44, 0.95, -0.12, 0.08, 0.1);
    patch(`fore${side}`, sign * 0.43, 1.1, -0.06, 0.07, 0.14, `arm${side}`);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute(indices, 4),
  );
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(weights, 4),
  );
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: '#b77b56' });
  material.name = 'plain:brown';
  const skin = new THREE.SkinnedMesh(geometry, material);
  skin.name = 'sumoskin';
  model.add(skin);
  model.updateMatrixWorld(true);
  skin.bind(new THREE.Skeleton(bones));
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.48), material);
  belt.name = 'sumobelt';
  torso.add(belt);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), material);
  eye.name = 'sumoeyeL';
  head.add(eye);
  model.updateMatrixWorld(true);
  return model;
}
function fixture() {
  const figures = new THREE.Group();
  figures.add(skinSource());
  const troops = new THREE.Group();
  const cadet = new THREE.Group();
  cadet.name = 'archers';
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 1, 0.3),
    new THREE.MeshStandardMaterial(),
  );
  mesh.name = 'archerstorso';
  mesh.material.name = 'plain:grey';
  cadet.add(mesh);
  troops.add(cadet);
  const world = {
    scene: new THREE.Scene(),
    assets: {
      figures: { scene: figures },
      troops: { scene: troops },
      textures: {},
    },
    materials: new r.MaterialLibrary({}),
    wind: { uWindTime: { value: 0 } },
  };
  world.instance = (gltf, name, team) =>
    r.ArenaWorld.prototype.instance.call(world, gltf, name, team);
  const renderer = new r.TroopRenderer(world);
  return { world, renderer, source: figures.getObjectByName('sumo') };
}

await test('cached bone bounds contain actual blended skin through extreme poses and nonuniform portrait transforms', () => {
  const f = fixture();
  const kit = f.renderer.kit('sumo', 0);
  f.renderer.add(kit);
  kit.group.position.set(2.4, 0.3, -1.2);
  kit.group.scale.set(1.12, 0.97, 1.12);
  kit.body.rotation.set(-0.23, 0.7, 0.17, 'YXZ');
  const surfaces = ['footL', 'footR', 'torso', 'head'].flatMap((part) =>
    r.figureSurfaces(kit.model, 'sumo', part),
  );
  const point = new THREE.Vector3();
  const bounds = new THREE.Box3();
  for (let i = 0; i < 32; i++) {
    kit.rig.head.node.rotation.set(
      Math.sin(i * 0.7) * 0.8,
      Math.cos(i) * 0.6,
      0.1,
    );
    kit.rig.torso.node.rotation.x = Math.cos(i * 0.4) * 0.3;
    kit.rig.kneeL.node.rotation.x = Math.sin(i * 0.9) * 1.3;
    kit.rig.footL.node.rotation.set(Math.cos(i) * 0.4, 0.2, Math.sin(i) * 0.25);
    kit.rig.kneeR.node.rotation.x = Math.cos(i * 0.9) * 1.3;
    kit.rig.footR.node.rotation.x = Math.sin(i) * 0.4;
    kit.group.updateMatrixWorld(true);
    for (const surface of surfaces) {
      const local = kit.rig.footL.node.matrixWorld
        .clone()
        .invert()
        .multiply(surface.mesh.matrixWorld);
      for (const matrix of [surface.mesh.matrixWorld, local]) {
        r.surfaceBroadBounds(surface, bounds, matrix);
        for (const vertex of surface.indices ??
          Array.from(
            { length: surface.mesh.geometry.attributes.position.count },
            (_, i) => i,
          )) {
          surface.mesh.getVertexPosition(vertex, point).applyMatrix4(matrix);
          assert.ok(
            bounds.containsPoint(point),
            `${surface.mesh.name} vertex ${vertex} at pose ${i}`,
          );
        }
      }
    }
  }
  f.renderer.dispose();
});

await test('active morph deformation retains exact subset bounds', () => {
  const f = fixture();
  const kit = f.renderer.kit('sumo', 0);
  const skin = kit.model.getObjectByName('sumoskin');
  const morph = skin.geometry.attributes.position.clone();
  for (let i = 0; i < morph.count; i++) morph.setY(i, morph.getY(i) + 1.2);
  skin.geometry.morphAttributes.position = [morph];
  skin.updateMorphTargets();
  skin.morphTargetInfluences[0] = 0.6;
  kit.group.updateMatrixWorld(true);
  const surface = r
    .figureSurfaces(kit.model, 'sumo', 'head')
    .find((surface) => surface.indices);
  const broad = r.surfaceBroadBounds(surface, new THREE.Box3());
  const actual = r.posedSurfaceBounds(surface, new THREE.Box3());
  assert.ok(broad.min.distanceTo(actual.min) < 1e-10);
  assert.ok(broad.max.distanceTo(actual.max) < 1e-10);
  f.renderer.dispose();
});

await test('independent skin kits deform and move without changing another unit, the source or rigid batches', () => {
  const f = fixture();
  const a = f.renderer.kit('sumo', 0),
    b = f.renderer.kit('sumo', 0);
  const skinA = a.model.getObjectByName('sumoskin'),
    skinB = b.model.getObjectByName('sumoskin');
  const original = f.source.getObjectByName('sumoskin');
  assert.notEqual(a, b);
  assert.notEqual(skinA.skeleton, skinB.skeleton);
  assert.notEqual(skinA.skeleton.bones[0], original.skeleton.bones[0]);
  assert.equal(skinA.geometry, original.geometry);
  assert.notEqual(skinA.material, skinB.material);
  assert.equal(f.renderer.kit('archers', 0), f.renderer.kit('archers', 0));
  f.renderer.add(a);
  f.renderer.add(b);
  f.renderer.write(a, []);
  f.renderer.write(b, []);
  const foot = r
    .figureSurfaces(a.model, 'sumo', 'footL')
    .find((surface) => surface.indices);
  assert.ok(
    foot.indices.length > 0 &&
      foot.indices.length < skinA.geometry.attributes.position.count,
  );
  const index = foot.indices[0];
  const before = skinA
    .getVertexPosition(index, new THREE.Vector3())
    .applyMatrix4(skinA.matrixWorld);
  const other = skinB
    .getVertexPosition(index, new THREE.Vector3())
    .applyMatrix4(skinB.matrixWorld);
  a.rig.kneeL.node.rotation.x = -0.6;
  a.group.position.x = 4;
  f.renderer.write(a, []);
  const after = skinA
    .getVertexPosition(index, new THREE.Vector3())
    .applyMatrix4(skinA.matrixWorld);
  assert.ok(after.distanceTo(before) > 3);
  assert.ok(
    skinB
      .getVertexPosition(index, new THREE.Vector3())
      .applyMatrix4(skinB.matrixWorld)
      .distanceTo(other) < 1e-8,
  );
  assert.equal(b.rig.kneeL.node.rotation.x, b.rig.kneeL.rest.x);
  assert.equal(
    original.skeleton.bones.find((bone) => bone.name === 'sumokneeL').rotation
      .x,
    0,
  );
  assert.ok(a.model.getObjectByName('sumobelt').parent === a.rig.torso.node);
  assert.ok(
    a.direct.meshes.every((mesh) => mesh.castShadow && mesh.receiveShadow),
  );
  f.renderer.setScale(3.1);
  assert.deepEqual(
    a.model.scale.toArray(),
    Array.from(r.figureDimensions(3.1)),
  );
  assert.deepEqual(
    b.model.scale.toArray(),
    Array.from(r.figureDimensions(3.1)),
  );
  f.renderer.dispose();
});

await test('skin tint survives batch x-ray changes, team layers are distinct and cleanup only frees owned resources', () => {
  const f = fixture();
  const library = f.renderer.kits
    .get('sumo:0')
    .model.getObjectByName('sumoskin').material;
  const texture = new THREE.Texture();
  library.map = texture;
  const a = f.renderer.kit('sumo', 0),
    b = f.renderer.kit('sumo', 1);
  f.renderer.add(a);
  f.renderer.add(b);
  const skin = a.model.getObjectByName('sumoskin');
  const original = f.source.getObjectByName('sumoskin');
  const white = new THREE.Color(1, 1, 1);
  const frost = new THREE.Color(0.68, 0.88, 1.18);
  f.renderer.colour(a, [], frost);
  const colour = skin.material.color.clone();
  f.renderer.xray(true);
  f.renderer.xray(false);
  assert.ok(skin.material.color.equals(colour));
  assert.ok(skin.layers.isEnabled(r.SKIN_XRAY_LAYERS[0]));
  assert.ok(!skin.layers.isEnabled(r.XRAY_LAYER));
  assert.ok(
    b.direct.meshes.every((mesh) =>
      mesh.layers.isEnabled(r.SKIN_XRAY_LAYERS[1]),
    ),
  );
  assert.ok(f.renderer.hasSkinTeam(0) && f.renderer.hasSkinTeam(1));
  f.renderer.colour(a, [], white);
  assert.ok(skin.material.color.equals(a.direct.colours.get(skin.material)));
  let geometryDisposals = 0,
    libraryDisposals = 0,
    unitDisposals = 0,
    boneDisposals = 0,
    textureDisposals = 0;
  original.geometry.addEventListener('dispose', () => geometryDisposals++);
  library.addEventListener('dispose', () => libraryDisposals++);
  texture.addEventListener('dispose', () => textureDisposals++);
  assert.equal(skin.material.map, texture);
  skin.material.addEventListener('dispose', () => unitDisposals++);
  skin.skeleton.computeBoneTexture();
  skin.skeleton.boneTexture.addEventListener('dispose', () => boneDisposals++);
  f.renderer.remove(a, []);
  f.renderer.remove(a, []);
  assert.equal(a.group.parent, null);
  assert.equal(unitDisposals, 1);
  assert.equal(boneDisposals, 1);
  assert.equal(geometryDisposals, 0);
  assert.equal(libraryDisposals, 0);
  assert.equal(textureDisposals, 0);
  assert.ok(!f.renderer.hasSkinTeam(0) && f.renderer.hasSkinTeam(1));
  assert.ok(b.group.parent === f.world.scene);
  f.renderer.dispose();
  assert.equal(geometryDisposals, 0);
  assert.equal(textureDisposals, 0);
});

await test('blended skin toes keep actual deformed vertices outside stone through approach and attack', () => {
  const f = fixture();
  f.renderer.setScale(3.1211);
  const a = new r.TroopView(f.renderer, 1, 'sumo', 0, 0);
  const b = new r.TroopView(f.renderer, 2, 'sumo', 0, 0);
  const [constrained, free] = [...f.renderer.directKits];
  const t = { kind: 'king', side: 1, x: 9, y: 16, destroyed: false };
  const stats = r.troopCards.sumo.unit;
  const u = {
    ...r.plainUnit,
    id: 1,
    side: 0,
    owner: 0,
    card: 'sumo',
    x: 13,
    y: 16,
    px: 13,
    py: 16,
    state: 'walking',
    hp: stats.hp,
    maxHp: stats.hp,
    deployLeft: 0,
    facing: -Math.PI / 2,
    sinceHit: 99,
    attackTimer: stats.firstHit,
    beat: 1.35,
    pace: 1.2,
  };
  const point = new THREE.Vector3();
  const clearance = (kit) => {
    let gap = Infinity;
    for (const side of ['L', 'R'])
      for (const { mesh, indices } of r.figureSurfaces(
        kit.model,
        'sumo',
        `foot${side}`,
      ))
        for (const i of indices) {
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
          gap = Math.min(gap, r.towerGap(t, point.x + 9, 16 - point.z));
        }
    return gap;
  };
  let freeGap = Infinity;
  for (let i = 0; i < 240; i++) {
    u.px = u.x;
    u.py = u.y;
    u.x =
      t.x +
      r.towerFootprint.king.half +
      r.troopBuildingRadius('sumo') +
      0.002 +
      Math.max(0, 0.6 - (stats.speed * 1.62 * i) / 60);
    u.state = i < 100 ? 'walking' : 'attacking';
    u.sinceHit += 1 / 60;
    if (u.state === 'attacking') {
      u.attackTimer -= 1 / 60;
      if (u.attackTimer <= 0) {
        u.attackTimer += stats.hitSpeed;
        u.sinceHit = 0;
      }
    }
    a.update(u, 1, 1 / 60, i / 60, [t]);
    b.update({ ...u, id: 2 }, 1, 1 / 60, i / 60);
    assert.ok(
      clearance(constrained) >= -0.001,
      `posed skin toes enter the wall at frame ${i}`,
    );
    freeGap = Math.min(freeGap, clearance(free));
  }
  assert.ok(
    freeGap < -0.01,
    `unconstrained blended toes demonstrate contact (${freeGap})`,
  );
  f.renderer.dispose();
});

await test('weighted arms fold beside a friendly wall through approach, turn and deployment and return to the authored carriage', () => {
  const f = fixture();
  f.renderer.setScale(3.1211);
  const constrained = new r.TroopView(f.renderer, 1, 'sumo', 0, 0);
  const free = new r.TroopView(f.renderer, 2, 'sumo', 0, 0);
  const t = { kind: 'king', side: 0, x: 9, y: 16, destroyed: false };
  const m = r.createMatch(51);
  const u = r.summon(m, 0, 'sumo', 13.8, 16);
  u.deployLeft = 0;
  u.state = 'walking';
  u.pace = 1.35;
  const restPositions = [
    'armL',
    'armR',
    'foreL',
    'foreR',
    'handL',
    'handR',
  ].map((part) => [part, constrained.kit.rig[part].node.position.clone()]);
  const point = new THREE.Vector3();
  const clearance = (kit) => {
    let minimum = Infinity;
    for (const side of ['L', 'R'])
      for (const { mesh, indices } of r.figureSurfaces(
        kit.model,
        'sumo',
        `arm${side}`,
      ))
        for (const index of indices ??
          Array.from(
            { length: mesh.geometry.attributes.position.count },
            (_, i) => i,
          )) {
          mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
          minimum = Math.min(
            minimum,
            r.towerStoneGap(t, point.x, point.y, point.z, 0.9),
          );
        }
    return minimum;
  };
  let freeGap = Infinity;
  let maximumStep = 0;
  let worstStep;
  let previous;
  const armPose = (view) =>
    ['armL', 'armR', 'foreL', 'foreR'].flatMap((part) => {
      const rotation = view.kit.rig[part].node.rotation;
      return [rotation.x, rotation.y, rotation.z];
    });
  for (let i = 0; i < 480; i++) {
    u.px = u.x;
    u.py = u.y;
    const contactX =
      t.x + r.towerFootprint.king.half + r.troopBuildingRadius('sumo') + 0.002;
    u.x =
      contactX +
      (i < 180
        ? Math.max(0, 0.9 - i * 0.01)
        : Math.min(1.7, (i - 180) * 0.015));
    u.y = t.y + Math.sin(i / 60) * 0.08;
    u.facing = Math.sin(i / 80) * 0.18;
    if (i >= 120 && i < 150) {
      u.state = 'deploying';
      u.deployLeft = r.DEPLOY_TIME * (1 - (i - 120) / 30);
    } else {
      u.state = 'walking';
      u.deployLeft = 0;
    }
    constrained.update(u, 0.5, 1 / 60, i / 60, [t], 0.9);
    free.update({ ...u, id: 2 }, 0.5, 1 / 60, i / 60, [], 0.9);
    assert.ok(
      clearance(constrained.kit) >= -0.001,
      `weighted arm enters stone at frame ${i}`,
    );
    freeGap = Math.min(freeGap, clearance(free.kit));
    for (const [part, position] of restPositions)
      assert.ok(
        constrained.kit.rig[part].node.position.distanceTo(position) < 1e-8,
        `${part} must keep its anatomical attachment`,
      );
    const current = armPose(constrained);
    if (previous && !(i >= 120 && i <= 150))
      for (let axis = 0; axis < current.length; axis++) {
        const step = Math.abs(current[axis] - previous[axis]);
        if (step <= maximumStep) continue;
        maximumStep = step;
        worstStep = {
          frame: i,
          part: ['armL', 'armR', 'foreL', 'foreR'][Math.floor(axis / 3)],
          axis: ['x', 'y', 'z'][axis % 3],
        };
      }
    previous = current;
  }
  assert.ok(
    freeGap < -0.03,
    `free weighted arms demonstrate the defect (${freeGap})`,
  );
  assert.ok(
    maximumStep < 0.2,
    `approaching and returning arm poses stay continuous (${maximumStep}, ${JSON.stringify(worstStep)})`,
  );
  const a = armPose(constrained),
    b = armPose(free);
  assert.ok(
    a.every((x, i) => Math.abs(x - b[i]) < 0.005),
    'arm springs return to the authored free gait after leaving stone',
  );
  f.renderer.dispose();
});

await test('skin foot and torso subsets use deformed geometry and a field unit keeps its independent death pose', () => {
  const f = fixture();
  const view = new r.TroopView(f.renderer, 1, 'sumo', 0, 0);
  const kit = [...f.renderer.directKits][0];
  const unit = {
    ...r.plainUnit,
    id: 1,
    side: 0,
    owner: 0,
    card: 'sumo',
    x: 4,
    y: 4,
    px: 4,
    py: 4,
    state: 'walking',
    hp: 1440,
    maxHp: 1440,
    deployLeft: 0,
    facing: 0,
    sinceHit: 99,
    attackTimer: 1,
  };
  view.update(unit, 1, 1 / 60, 0);
  const surface = r
    .figureSurfaces(kit.model, 'sumo', 'footL')
    .find((part) => part.indices);
  const before = r.posedSurfaceBounds(surface, new THREE.Box3()).clone();
  kit.rig.kneeL.node.rotation.x -= 0.65;
  f.renderer.write(kit, []);
  const after = r.posedSurfaceBounds(surface, new THREE.Box3());
  assert.ok(
    after
      .getCenter(new THREE.Vector3())
      .distanceTo(before.getCenter(new THREE.Vector3())) > 0.1,
  );
  const torso = r.figureSurfaces(kit.model, 'sumo', 'torso');
  assert.ok(torso.some((part) => part.indices?.length));
  assert.ok(!torso.some((part) => part.mesh.name === 'sumoeyeL'));
  const skin = kit.model.getObjectByName('sumoskin');
  view.dying = 0;
  assert.equal(view.fade(0.3), false);
  assert.ok(Math.abs(kit.body.rotation.z) > 0.5);
  assert.equal(view.fade(0.5), true);
  assert.ok(kit.body.scale.x < 0.01);
  skin.skeleton.computeBoneTexture();
  view.dispose();
  assert.equal(skin.skeleton.boneTexture, null);
  f.renderer.dispose();
});

await test('ghost changes and disposal release preview skeleton textures without freeing shared sculpt data', () => {
  const f = fixture();
  const ghost = new r.Ghost(f.world);
  ghost.show('sumo', 4, 4, true);
  const preview = ghost.group.getObjectByName('sumoskin');
  const original = f.source.getObjectByName('sumoskin');
  assert.notEqual(preview.skeleton, original.skeleton);
  assert.notEqual(preview.skeleton.bones[0], original.skeleton.bones[0]);
  preview.skeleton.computeBoneTexture();
  let disposed = 0,
    sharedDisposed = 0;
  preview.skeleton.boneTexture.addEventListener('dispose', () => disposed++);
  original.geometry.addEventListener('dispose', () => sharedDisposed++);
  ghost.show('archers', 4, 4, true);
  assert.equal(disposed, 1);
  assert.equal(sharedDisposed, 0);
  ghost.show('sumo', 4, 4, true);
  const second = ghost.group.getObjectByName('sumoskin');
  second.skeleton.computeBoneTexture();
  ghost.dispose();
  assert.equal(second.skeleton.boneTexture, null);
  assert.equal(sharedDisposed, 0);
  f.renderer.dispose();
});

await test('the x-ray mark includes skins but batch and per-team silhouettes draw distinct layers and restore render state', () => {
  const masks = [],
    overrides = [];
  const camera = new THREE.PerspectiveCamera();
  const scene = new THREE.Scene();
  const renderer = {
    autoClear: true,
    shadowMap: { autoUpdate: true },
    render(s, c) {
      masks.push(c.layers.mask);
      overrides.push(s.overrideMaterial);
    },
  };
  const host = Object.create(r.ArenaView.prototype);
  host.world = { renderer, scene, camera };
  host.troopRenderer = { xray() {}, hasSkinTeam: () => true };
  host.ghost = { group: { visible: false } };
  host.xray = {
    mark: new THREE.MeshBasicMaterial(),
    troops: new THREE.MeshBasicMaterial(),
  };
  host.skinXray = [
    new THREE.MeshBasicMaterial({ color: 'blue' }),
    new THREE.MeshBasicMaterial({ color: 'red' }),
  ];
  const mask = camera.layers.mask;
  host.drawXray();
  assert.deepEqual(masks, [
    (1 << r.XRAY_LAYER) |
      (1 << r.SKIN_XRAY_LAYERS[0]) |
      (1 << r.SKIN_XRAY_LAYERS[1]),
    1 << r.XRAY_LAYER,
    1 << r.SKIN_XRAY_LAYERS[0],
    1 << r.SKIN_XRAY_LAYERS[1],
  ]);
  assert.equal(overrides[0], host.xray.mark);
  assert.equal(overrides[2], host.skinXray[0]);
  assert.equal(overrides[3], host.skinXray[1]);
  assert.equal(camera.layers.mask, mask);
  assert.equal(scene.overrideMaterial, null);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.shadowMap.autoUpdate, true);
});
