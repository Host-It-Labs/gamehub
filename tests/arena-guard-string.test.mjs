import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
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
const candidate = resolve(
  root,
  'work/arena/2026-10-08-roster/guard/candidate-bundle.glb',
);
const figuresPath = existsSync(candidate)
  ? candidate
  : resolve(root, `public${manifest.models.figures.path}`);
async function asset(path) {
  const data = readFileSync(path);
  return new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
    '',
  );
}
const [figures, troops, towers, cartoonTowers] = await Promise.all([
  asset(figuresPath),
  asset(resolve(root, `public${manifest.models.troops.path}`)),
  asset(resolve(root, `public${manifest.models.towers.path}`)),
  asset(resolve(root, `public${manifest.models.cartoon_towers.path}`)),
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
      // Only the cosmetic ground-shadow canvas needs a browser stub.
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
          (path) => statSync(path, { throwIfNoEntry: false })?.isFile(),
        );
        assert.ok(source, `production guard dependency ${id}`);
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
  ...load(resolve(root, 'lib/games/arena/layout.ts')),
};
const sourceGuard = figures.scene.getObjectByName('guard');
assert.ok(
  sourceGuard?.userData.bowStringMarkers,
  `${figuresPath} carries the rebuilt guard markers`,
);
const exportedPoses = JSON.parse(sourceGuard.userData.poses);
const markerNames = JSON.parse(sourceGuard.userData.bowStringMarkers);
const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const u = clamp(value);
  return u * u * (3 - 2 * u);
};
const amountFor = (raise, kick) =>
  smooth((raise - 0.7) / 0.25) * (1 - smooth((kick - 0.25) / 0.75));
const TOLERANCE = 0.003; // Three millimetres in the rendered world's units.

function marker(kit, name) {
  const full = name.startsWith('guard') ? name : `guard.${name}`;
  const found = kit.model.getObjectByName(
    THREE.PropertyBinding.sanitizeNodeName(full),
  );
  assert.ok(found, `exported marker ${full}`);
  return found;
}
function stringRings(kit) {
  const rings = [];
  const controller = marker(kit, markerNames.controller);
  kit.model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || !mesh.name.includes('linen-string')) return;
    const joints = mesh.geometry.attributes.skinIndex;
    const weights = mesh.geometry.attributes.skinWeight;
    const indices = [];
    for (let i = 0; i < joints.count; i++)
      for (let component = 0; component < 4; component++)
        if (
          weights.getComponent(i, component) > 0.99999 &&
          mesh.skeleton.bones[joints.getComponent(i, component)].name ===
            controller.name
        ) {
          indices.push(i);
          break;
        }
    assert.ok(indices.length >= 8, `${mesh.name} has a weighted centre ring`);
    rings.push({ mesh, indices });
  });
  assert.equal(rings.length, 2, 'both visible string segments are measured');
  return rings;
}
function fixture({ stretch = false } = {}) {
  const world = {
    scene: new THREE.Scene(),
    assets: { figures, troops, towers, cartoonTowers, textures: {} },
    materials: new r.MaterialLibrary({}),
    wind: { uWindTime: { value: 0 } },
    towers: new Map(),
    ambient: { chimneys: [] },
    viewSide: 0,
    towerScale: r.TOWER_SCALE,
    guardScale: Math.sqrt(1.05 / 0.8),
  };
  world.instance = (gltf, name, team) =>
    r.ArenaWorld.prototype.instance.call(world, gltf, name, team);
  const renderer = new r.TroopRenderer(world);
  const towerStates = [0, 1].flatMap((side) =>
    [0, 1].map((lane) => ({
      id: side * 3 + lane + 1,
      side,
      kind: 'princess',
      x: lane ? 14.5 : 3.5,
      y: side ? 28 : 4,
      active: true,
      destroyed: false,
    })),
  );
  r.ArenaWorld.prototype.placeTowers.call(world, { towers: towerStates });
  const guards = [];
  for (const tower of towerStates) {
    const { guardSpot } = world.towers.get(tower.id);
    assert.ok(guardSpot, 'actual small-tower guard attachment');
    if (stretch) guardSpot.scale.multiply(new THREE.Vector3(1.08, 0.96, 0.91));
    const crew = new r.TowerCrew(world, renderer, tower, tower.side);
    const kit = crew.guard.kit;
    guards.push({ tower, crew, kit, rings: stringRings(kit) });
  }
  const write = renderer.write.bind(renderer);
  let beforeWrite;
  renderer.write = (kit, ids) => {
    beforeWrite?.(kit);
    write(kit, ids);
  };
  return {
    world,
    renderer,
    guards,
    beforeWrite(callback) {
      beforeWrite = callback;
    },
    dispose() {
      for (const { crew } of guards) crew.dispose();
      renderer.dispose();
      r.ArenaWorld.prototype.clearTowers.call(world);
    },
  };
}
function targetFor(tower, variant = 0) {
  return new THREE.Vector3(
    ...r.toWorld(
      variant ? (tower.x < 9 ? 13 : 5) : tower.x + 1,
      tower.side ? 17 - variant * 2 : 15 + variant * 2,
    ),
  );
}
function verifyContact(guard, metrics, label) {
  const { kit, crew, rings } = guard;
  const kick = crew.recoil ** 2;
  const amount = amountFor(crew.raise, kick);
  const brace = marker(kit, markerNames.brace).getWorldPosition(
    new THREE.Vector3(),
  );
  const nock = marker(kit, markerNames.nock).getWorldPosition(
    new THREE.Vector3(),
  );
  const centre = marker(kit, markerNames.centre).getWorldPosition(
    new THREE.Vector3(),
  );
  // Acquisition deliberately approaches the nock from the brace. Measure
  // that blend here, then direct nock contact once the arrow is latched.
  const desired = brace.clone().lerp(nock, amount);
  const error = centre.distanceTo(desired);
  metrics.marker = Math.max(metrics.marker, error);
  assert.ok(error <= TOLERANCE, `${label}: marker contact ${error}`);
  const point = new THREE.Vector3();
  for (const { mesh, indices } of rings) {
    const middle = new THREE.Vector3();
    for (const index of indices)
      middle.add(
        mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld),
      );
    middle.multiplyScalar(1 / indices.length);
    const visibleError = middle.distanceTo(desired);
    metrics.surface = Math.max(metrics.surface, visibleError);
    assert.ok(
      visibleError <= TOLERANCE,
      `${label}: ${mesh.name} visible contact ${visibleError}`,
    );
    if (crew.raise >= 0.95 && kick <= 0.25) {
      const nockError = middle.distanceTo(nock);
      metrics.nock = Math.max(metrics.nock, nockError);
      assert.ok(
        nockError <= TOLERANCE,
        `${label}: visible nock/string ${nockError}`,
      );
    }
  }
  if (kick >= 1 || crew.raise <= 0.7)
    assert.ok(
      centre.distanceTo(brace) <= TOLERANCE,
      `${label}: string rests at the brace`,
    );
  assert.equal(
    kit.rig.arrow.node.scale.x,
    kick > 0.25 ? 0 : 1,
    `${label}: arrow hide/reappearance`,
  );
}
const metrics = () => ({ marker: 0, surface: 0, nock: 0 });

await test('guard copies bind at rest, share source geometry and retain the exported pose/nock contract', () => {
  const f = fixture();
  try {
    assert.equal(sourceGuard.userData.arrowOrigin, 'nock');
    assert.deepEqual(Object.keys(exportedPoses).sort(), ['draw', 'loose']);
    const contract = resolve(
      root,
      'work/arena/2026-10-08-roster/guard/poses-contract-v1.json',
    );
    if (existsSync(contract))
      assert.deepEqual(exportedPoses, JSON.parse(readFileSync(contract)));
    for (const { kit, crew, tower } of f.guards) {
      assert.ok(kit.towerString, 'contact is bound before the first pose');
      const source = f.renderer.kits.get(`guard:${tower.side}`);
      assert.ok(source.towerString, 'shared source kit binds while at rest');
      assert.ok(kit.model !== source.model, 'tower owns a pose copy');
      assert.ok(
        kit.towerString !== source.towerString,
        'contact state belongs to the pose copy',
      );
      assert.equal(kit.rig.weapon.node.parent.name, kit.rig.handR.node.name);
      assert.equal(kit.rig.offhand.node.parent.name, kit.rig.handL.node.name);
      assert.equal(kit.rig.arrow.node.parent.name, kit.rig.weapon.node.name);
      for (const part of ['wingL', 'wingR', 'extra2'])
        assert.equal(kit.rig[part].node.parent.name, kit.rig.offhand.node.name);
      const arrowRest = kit.rig.arrow.node.position.toArray();
      let heldOrigin;
      for (const [pose, kick] of [
        ['draw', 0],
        ['loose', 1],
      ]) {
        crew.raise = 1;
        crew.recoil = kick;
        crew.update(tower, targetFor(tower), 0, -tower.id / 1.6);
        f.world.scene.updateMatrixWorld(true);
        assert.equal(
          kit.group.matrixAutoUpdate,
          false,
          'the rendered skin retains its tower matrix',
        );
        const spot = f.world.towers.get(tower.id).guardSpot;
        assert.ok(
          kit.group
            .getWorldPosition(new THREE.Vector3())
            .distanceTo(spot.getWorldPosition(new THREE.Vector3())) < 1e-9,
          'scene updates leave the skin on its own tower platform',
        );
        for (const [part, [w, x, y, z]] of Object.entries(
          exportedPoses[pose],
        )) {
          const joint = kit.rig[part];
          const expected = new THREE.Quaternion()
            .setFromEuler(joint.rest)
            .multiply(new THREE.Quaternion(x, z, -y, w).normalize());
          assert.ok(
            joint.node.quaternion.angleTo(expected) < 1e-7,
            `${pose} keeps ${part}'s quaternion`,
          );
        }
        assert.deepEqual(
          kit.rig.arrow.node.position.toArray(),
          arrowRest,
          'nock origin is unchanged',
        );
        if (!kick) {
          heldOrigin = crew.bow().clone();
          assert.ok(
            heldOrigin.toArray().every(Number.isFinite),
            'held arrow supplies the projectile origin',
          );
        } else {
          assert.deepEqual(
            crew.bow().toArray(),
            heldOrigin.toArray(),
            'release keeps the existing cached projectile origin',
          );
        }
      }
    }
    for (const side of [0, 1]) {
      const [a, b] = f.guards.filter(({ tower }) => tower.side === side);
      assert.ok(a.kit !== b.kit, 'the two towers aim independently');
      assert.ok(a.kit.model !== b.kit.model, 'the two skins are independent');
      assert.ok(
        a.kit.towerString !== b.kit.towerString,
        'each tower has its own correction',
      );
      for (let i = 0; i < a.rings.length; i++) {
        assert.ok(
          a.rings[i].mesh.geometry === b.rings[i].mesh.geometry,
          'both towers share source geometry',
        );
        assert.ok(
          a.rings[i].mesh.skeleton !== b.rings[i].mesh.skeleton,
          'each string has its own posed bones',
        );
      }
    }
  } finally {
    f.dispose();
  }
});

await test('both small towers per side keep visible string contact through every raise/recoil blend before write', (t) => {
  const f = fixture({ stretch: true });
  const maximum = metrics();
  let checks = 0;
  try {
    f.renderer.setScale(2.6); // Also exercise the figure's nonuniform portrait dimensions.
    for (const guard of f.guards) {
      const { crew, tower } = guard;
      f.beforeWrite((kit) => {
        assert.equal(kit.model.name, 'guard');
        verifyContact(
          guard,
          maximum,
          `tower ${tower.id}, raise ${crew.raise}, kick ${crew.recoil ** 2}, before write`,
        );
        checks++;
      });
      for (let raise = 0; raise <= 20; raise++)
        for (let recoil = 0; recoil <= 20; recoil++) {
          crew.raise = raise / 20;
          crew.recoil = Math.sqrt(recoil / 20);
          crew.aim = Math.sin(raise + recoil + tower.id) * Math.PI;
          crew.update(
            tower,
            raise ? targetFor(tower, recoil % 2) : null,
            0,
            raise * 0.31 + recoil * 0.13,
          );
          f.world.scene.updateMatrixWorld(true);
          verifyContact(guard, maximum, `tower ${tower.id}, after write`);
        }
    }
    assert.equal(checks, 4 * 21 * 21);
    t.diagnostic(
      JSON.stringify({
        figuresPath,
        samples: checks,
        maximumWorldError: maximum,
      }),
    );
  } finally {
    f.dispose();
  }
});

await test('acquisition joins late, release returns to brace, and repeated fire stays in contact at 30/60/120 Hz', (t) => {
  const maximum = metrics();
  let samples = 0;
  for (const hz of [30, 60, 120]) {
    const f = fixture();
    try {
      const seen = {
        acquisition: false,
        draw: false,
        loose: false,
        recovery: false,
        reacquisition: false,
      };
      for (let frame = 0; frame <= hz * 5; frame++) {
        const time = frame / hz;
        if (frame === hz * 3) f.renderer.setScale(2.4);
        for (const guard of f.guards) {
          const { crew, tower } = guard;
          const aiming = (time >= 0.3 && time < 2.5) || time >= 3.3;
          if (
            [hz, Math.round(hz * 1.7), Math.round(hz * 2.3), hz * 4].includes(
              frame,
            )
          )
            crew.shot();
          crew.update(
            tower,
            aiming ? targetFor(tower, time >= 3.3 ? 1 : 0) : null,
            1 / hz,
            time,
          );
          f.world.scene.updateMatrixWorld(true);
          verifyContact(
            guard,
            maximum,
            `${hz} Hz, tower ${tower.id}, ${time}s`,
          );
          samples++;
          if (aiming && crew.raise > 0.7 && crew.raise < 0.95)
            seen.acquisition = true;
          if (crew.raise >= 0.95 && crew.recoil === 0) seen.draw = true;
          if (crew.recoil ** 2 > 0.25) seen.loose = true;
          if (crew.recoil > 0 && crew.recoil ** 2 <= 0.25) seen.recovery = true;
          if (time >= 3.3 && crew.raise > 0.7 && crew.raise < 0.95)
            seen.reacquisition = true;
        }
      }
      for (const [phase, observed] of Object.entries(seen))
        assert.ok(observed, `${phase} exercised at ${hz} Hz`);
    } finally {
      f.dispose();
    }
  }
  t.diagnostic(JSON.stringify({ samples, maximumWorldError: maximum }));
});

await test('controller positions reset on all axes without accumulating or affecting the other tower', () => {
  const f = fixture();
  try {
    for (const [index, guard] of f.guards.entries()) {
      const { kit, crew, tower } = guard;
      const other = f.guards[index ^ 1];
      const source = f.renderer.kits.get(`guard:${tower.side}`);
      const sourceRest = source.rig.extra2.node.position.toArray();
      crew.raise = 0.87;
      crew.recoil = Math.sqrt(0.2);
      crew.aim = index * 0.7;
      crew.update(tower, targetFor(tower), 0, 1.3);
      const controller = kit.rig.extra2.node;
      const corrected = controller.position.clone();
      const ownMatrix = controller.matrixWorld.toArray();
      for (let pass = 0; pass < 12; pass++) {
        controller.position.add(new THREE.Vector3(0.14, -0.21, 0.35));
        crew.update(tower, targetFor(tower), 0, 1.3);
        assert.ok(
          controller.position.distanceTo(corrected) < 1e-10,
          'all position axes reset before the pose',
        );
      }
      other.crew.raise = 1;
      other.crew.shot();
      other.crew.update(other.tower, targetFor(other.tower, 1), 0, 2.1);
      assert.deepEqual(
        controller.matrixWorld.toArray(),
        ownMatrix,
        'other tower does not change this pose',
      );
      assert.deepEqual(
        source.rig.extra2.node.position.toArray(),
        sourceRest,
        'shared source stays at rest',
      );
      const measured = metrics();
      verifyContact(
        guard,
        measured,
        `tower ${tower.id} after other tower's shot`,
      );
      verifyContact(other, measured, `tower ${other.tower.id} at release`);
    }
  } finally {
    f.dispose();
  }
});
