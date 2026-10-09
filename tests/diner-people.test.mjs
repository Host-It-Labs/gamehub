import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const root = new URL('../', import.meta.url).href;
register(
  `data:text/javascript,${encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = ${JSON.stringify(root)};
export async function resolve(spec, ctx, next) {
  let base = null;
  if (spec.startsWith('@/')) base = fileURLToPath(root + spec.slice(2));
  else if (/^\\.\\.?\\//.test(spec) && ctx.parentURL?.startsWith('file:') && !/\\.[cm]?[jt]sx?$/.test(spec)) base = fileURLToPath(new URL(spec, ctx.parentURL));
  if (base) for (const ext of ['.ts', '.tsx']) if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
  return next(spec, ctx);
}`)}`,
);

const THREE = await import('three');
const { makeMaterials } = await import('../components/game/diner/kit.ts');
const { SHIRTS } = await import('../lib/games/diner/content.ts');
const { guestFigure, waiterFigure, expression } =
  await import('../components/game/diner/people.ts');
const { HUMAN, withPeopleDetail, loft } =
  await import('../components/game/diner/people-geometry.ts');
const { poseFigure, advanceStride, footCycle } =
  await import('../components/game/diner/people-motion.ts');
const { disposeCache, releaseShared } =
  await import('../components/game/diner/model-cache.ts');
const { disposeSurfaceMaterials } =
  await import('../components/game/diner/materials.ts');

function withMaterials(run) {
  const materials = makeMaterials();
  try {
    return run(materials);
  } finally {
    disposeCache();
    disposeSurfaceMaterials(materials);
  }
}

const plain = {
  skin: 1,
  hair: 0,
  hat: 'none',
  shirt: 1,
  stripes: false,
  glasses: false,
};

await test('every outfit retains its clue colours and finite authored surfaces within the original draw budget', () =>
  withMaterials((materials) => {
    for (const [i, hat] of [
      'none',
      'cap',
      'bowler',
      'beanie',
      'cowboy',
    ].entries()) {
      for (const glasses of [false, true]) {
        const figure = guestFigure(materials, {
          ...plain,
          hat,
          glasses,
          skin: i,
          hair: i,
          shirt: i,
          stripes: i % 2 === 0,
        });
        const shirt = new THREE.Color(SHIRTS[i]);
        let colourVertices = 0;
        figure.root.traverse((node) => {
          if (!node.isMesh || node.material !== materials.cloth) return;
          const c = node.geometry.getAttribute('color');
          for (let v = 0; v < c.count; v++)
            if (
              Math.abs(c.getX(v) - shirt.r) +
                Math.abs(c.getY(v) - shirt.g) +
                Math.abs(c.getZ(v) - shirt.b) <
              1e-6
            )
              colourVertices++;
        });
        assert.ok(
          colourVertices > 1000,
          'base shirt clue keeps its exact engine colour',
        );
        for (const mood of ['rest', 'smile', 'frown', 'eat']) {
          expression(figure, mood, 0.08, 0, false);
          let calls = 0;
          figure.root.traverseVisible((node) => {
            if (!node.isMesh) return;
            calls++;
            for (const name of ['position', 'normal', 'color', 'uv']) {
              assert.ok(
                [...node.geometry.getAttribute(name).array].every(
                  Number.isFinite,
                ),
                `${hat} ${name}`,
              );
            }
          });
          assert.ok(
            calls <= 20,
            `${hat} with ${mood} and blink has ${calls} material draws`,
          );
        }
        const size = new THREE.Box3()
          .setFromObject(figure.root)
          .getSize(new THREE.Vector3());
        assert.ok(size.y > 1.25 && size.y < 1.46, `${hat} height ${size.y}`);
        assert.ok(size.x > 0.5 && size.x < 0.68, `${hat} width ${size.x}`);
        releaseShared(figure.root);
      }
    }
  }));

await test('hips, knees, ankles, shoulders, elbows and wrists remain a connected hierarchy in extreme poses', () =>
  withMaterials((materials) => {
    const figure = waiterFigure(materials, 2);
    const joints = figure.joints;
    for (const pose of [
      { moving: 0, phase: 0 },
      { moving: 1, phase: 0.8 },
      { moving: 1, phase: 4.9, carry: true },
      { moving: 0, phase: 0, gesture: 0.5 },
      { moving: 0, phase: 0, sitting: true, eating: true },
      { moving: 0, phase: 0, mopping: true },
    ]) {
      poseFigure(figure, { ...pose, time: 1.35 });
      figure.root.updateMatrixWorld(true);
      for (let i = 0; i < 2; i++) {
        assert.equal(joints.knees[i].parent, joints.hips[i]);
        assert.equal(joints.ankles[i].parent, joints.knees[i]);
        assert.equal(joints.elbows[i].parent, joints.shoulders[i]);
        assert.equal(joints.wrists[i].parent, joints.elbows[i]);
        const at = (node) => node.getWorldPosition(new THREE.Vector3());
        for (const [a, b, length] of [
          [joints.hips[i], joints.knees[i], HUMAN.thigh],
          [joints.knees[i], joints.ankles[i], HUMAN.shin],
          [joints.shoulders[i], joints.elbows[i], HUMAN.upperArm],
          [joints.elbows[i], joints.wrists[i], HUMAN.forearm],
        ])
          assert.ok(
            Math.abs(at(a).distanceTo(at(b)) - length * figure.root.scale.y) <
              1e-6,
            'joints retain bone lengths',
          );
      }
    }
  }));

await test('a planted sole stays at floor height and stays still as root advances through stance', () =>
  withMaterials((materials) => {
    const figure = waiterFigure(materials, 0);
    let last = null;
    const periodDistance = advanceStride(figure, 0, 1);
    for (let i = 0; i <= 48; i++) {
      const phase = (i / 48) * Math.PI * 2;
      figure.root.position.z = phase / periodDistance;
      poseFigure(figure, { phase, moving: 1, time: i / 60 });
      figure.root.updateMatrixWorld(true);
      for (let side = 0; side < 2; side++) {
        const cycle = footCycle(phase, side, 1);
        const ankle = figure.joints.ankles[side];
        const sole = new THREE.Vector3(0, -0.085, 0.025).applyMatrix4(
          ankle.matrixWorld,
        );
        assert.ok(
          sole.y >= -0.003,
          `sole ${side} doesn't cut through floor at ${phase}: ${sole.y}`,
        );
        if (cycle.planted) {
          assert.ok(
            Math.abs(sole.y - 0.001 * figure.root.scale.y) < 0.005,
            `stance sole planted ${sole.y}`,
          );
          if (last?.[side].planted)
            assert.ok(
              Math.abs(sole.z - last[side].z) < 0.004,
              `stance doesn't skate ${sole.z - last[side].z}`,
            );
        }
      }
      last = [0, 1].map((side) => ({
        ...footCycle(phase, side, 1),
        z: new THREE.Vector3(0, -0.085, 0.025).applyMatrix4(
          figure.joints.ankles[side].matrixWorld,
        ).z,
      }));
    }
  }));

await test('carry palms meet the tray and the dish stays level through movement; reduced idle is calm', () =>
  withMaterials((materials) => {
    const figure = waiterFigure(materials, 1);
    poseFigure(figure, { time: 1, phase: 1.8, moving: 1, carry: true });
    figure.root.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 1, 0).transformDirection(
      figure.hold.matrixWorld,
    );
    assert.ok(normal.y > 0.999, 'tray remains level');
    for (const wrist of figure.joints.wrists) {
      const palm = new THREE.Vector3(0, -0.025, 0.03).applyMatrix4(
        wrist.matrixWorld,
      );
      const tray = figure.hold.getWorldPosition(new THREE.Vector3());
      assert.ok(
        Math.abs(palm.y - tray.y) < 0.05,
        'palm reaches tray underside',
      );
      assert.ok(Math.abs(palm.z - tray.z) < 0.07, 'palm supports tray depth');
    }
    poseFigure(figure, { time: 1, phase: 0, moving: 0, reduced: true });
    const snapshot = figure.root.toJSON();
    poseFigure(figure, { time: 3, phase: 0, moving: 0, reduced: true });
    assert.deepEqual(
      figure.root.toJSON(),
      snapshot,
      'reduced idle has no continuing decorative motion',
    );
  }));

await test('continuous knees and elbows have normalized skinning and each actor frees its own bone texture on removal', () =>
  withMaterials((materials) => {
    const a = waiterFigure(materials, 0),
      b = waiterFigure(materials, 0);
    const skins = [];
    a.root.traverse((node) => {
      if (node.isSkinnedMesh) skins.push(node);
    });
    assert.equal(skins.length, 4);
    const scene = new THREE.Scene();
    scene.add(a.root, b.root);
    let freed = 0;
    for (const mesh of skins) {
      const weights = mesh.geometry.getAttribute('skinWeight');
      for (let i = 0; i < weights.count; i++)
        assert.ok(
          Math.abs(
            weights.getX(i) +
              weights.getY(i) +
              weights.getZ(i) +
              weights.getW(i) -
              1,
          ) < 1e-6,
        );
      mesh.skeleton.computeBoneTexture();
      mesh.skeleton.boneTexture.addEventListener('dispose', () => freed++);
    }
    poseFigure(a, { time: 1, phase: 1.2, moving: 1, carry: true });
    a.root.updateMatrixWorld(true);
    for (const mesh of skins) {
      const position = mesh.geometry.getAttribute('position');
      const point = new THREE.Vector3();
      for (let i = 0; i < position.count; i += 37) {
        mesh.getVertexPosition(i, point);
        assert.ok(
          Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            Number.isFinite(point.z),
        );
      }
    }
    scene.remove(a.root);
    assert.equal(freed, 4, 'removed actor frees four private bone textures');
    assert.ok(skins.every((mesh) => mesh.skeleton.boneTexture === null));
    const other = [];
    b.root.traverse((node) => {
      if (node.isSkinnedMesh) other.push(node);
    });
    assert.equal(
      other[0].geometry,
      skins[0].geometry,
      'clones share cloth geometry',
    );
    assert.notEqual(
      other[0].skeleton,
      skins[0].skeleton,
      'clones keep independent animation',
    );
    scene.remove(b.root);
    releaseShared(a.root);
    releaseShared(b.root);
  }));

await test('first-frame placement and distant online corrections do not fling a walking phase', () =>
  withMaterials((materials) => {
    const figure = waiterFigure(materials, 0);
    const before = 1.2;
    for (const distance of [8.8, NaN, -2])
      assert.ok(
        Math.abs(advanceStride(figure, before, distance) - before) < 1e-12,
      );
    assert.ok(
      advanceStride(figure, 1e8, 0.08) < 8,
      'long-running phase stays bounded',
    );
    poseFigure(figure, {
      time: 1,
      phase: before,
      moving: 1,
      dt: 1 / 60,
      reduced: true,
    });
    figure.root.position.z = 8.8;
    poseFigure(figure, {
      time: 1 + 1 / 60,
      phase: before,
      moving: 0,
      dt: 1 / 60,
      reduced: true,
    });
    assert.ok(
      figure.body.position.y > -0.09,
      'placement discards old planted anchors',
    );
    figure.root.updateMatrixWorld(true);
    for (const ankle of figure.joints.ankles) {
      const local = figure.root.worldToLocal(
        ankle.getWorldPosition(new THREE.Vector3()),
      );
      assert.ok(
        Math.abs(local.z) < 0.001,
        'teleported feet stand beneath the new root',
      );
    }
  }));

await test('starting and stopping keep planted soles still while the free foot settles without snapping', () =>
  withMaterials((materials) => {
    const figure = waiterFigure(materials, 0);
    const dt = 1 / 120;
    let phase = 0;
    let before = null;
    let stoppedSettling = false;
    for (let frame = 0; frame <= 384; frame++) {
      const time = frame * dt;
      const moving = time >= 0.5 && time < 2.7;
      const travel = moving ? 1.3 * dt : time >= 2.7 && time < 2.82 ? 0.002 : 0;
      figure.root.position.z += travel;
      phase = advanceStride(figure, phase, travel);
      poseFigure(figure, { time, phase, moving: +moving, dt, reduced: true });
      figure.root.updateMatrixWorld(true);
      const points = figure.joints.ankles.map((joint) =>
        joint.getWorldPosition(new THREE.Vector3()),
      );
      const contact = figure.root.userData.dinerFootContact;
      for (let i = 0; i < 2; i++) {
        if (contact[i]) {
          assert.ok(
            Math.abs(points[i].y - 0.086 * figure.root.scale.y) < 0.0007,
            `planted ankle ${i} keeps sole on floor at ${time}: ${JSON.stringify(points[i].toArray())}, body=${figure.body.position.y}, phase=${phase}`,
          );
          if (before?.contact[i])
            assert.ok(
              points[i].distanceTo(before.points[i]) < 0.001,
              `planted foot ${i} stays still at ${time}`,
            );
        }
        if (before)
          assert.ok(
            points[i].distanceTo(before.points[i]) < 0.055,
            'feet move continuously at 120 Hz',
          );
      }
      if (time >= 2.7 && contact.some((value) => !value))
        stoppedSettling = true;
      before = { points, contact };
    }
    assert.ok(stoppedSettling, 'stopping uses a lifted catch step');
    for (const ankle of figure.joints.ankles) {
      const local = figure.root.worldToLocal(
        ankle.getWorldPosition(new THREE.Vector3()),
      );
      assert.ok(
        Math.abs(local.z) < 0.0001,
        'settled shoes return beneath the hips',
      );
    }
  }));

await test('source and runtime copies retain every material channel, clue palette and exact joint motion', () =>
  withMaterials((materials) => {
    const entries = [
      ...[0, 1, 2, 3].map((seat) => ({ seat })),
      ...['none', 'cap', 'bowler', 'beanie', 'cowboy'].map((hat, i) => ({
        look: {
          ...plain,
          hat,
          skin: i,
          hair: i,
          shirt: i,
          stripes: i % 2 === 0,
          glasses: i % 2 === 1,
        },
      })),
    ];
    const collect = (figure) => {
      const meshes = [];
      figure.root.traverseVisible((node) => {
        if (node.isMesh) meshes.push(node);
      });
      return meshes;
    };
    const triangleCount = (meshes) =>
      meshes.reduce(
        (total, mesh) =>
          total +
          (mesh.geometry.index?.count ??
            mesh.geometry.getAttribute('position').count) /
            3,
        0,
      );
    const palette = (meshes) => {
      const colours = new Set();
      for (const mesh of meshes) {
        if (mesh.material === materials.skin) continue; // The cheeks have a continuous authored gradient.
        const colour = mesh.geometry.getAttribute('color');
        for (let i = 0; i < colour.count; i++)
          colours.add(
            [colour.getX(i), colour.getY(i), colour.getZ(i)]
              .map((c) => c.toFixed(6))
              .join(':'),
          );
      }
      return colours;
    };
    for (const entry of entries) {
      const create = (detail) =>
        entry.look
          ? guestFigure(materials, entry.look, detail)
          : waiterFigure(materials, entry.seat, detail);
      const source = create('source'),
        runtime = create('runtime'),
        implicit = create();
      const sourceMeshes = collect(source),
        runtimeMeshes = collect(runtime),
        defaultMeshes = collect(implicit);
      assert.equal(
        sourceMeshes.length,
        runtimeMeshes.length,
        'sampling keeps every material draw',
      );
      assert.ok(
        triangleCount(runtimeMeshes) < triangleCount(sourceMeshes) * 0.6,
        'runtime sampling measurably reduces submitted geometry',
      );
      assert.deepEqual(
        palette(sourceMeshes),
        palette(runtimeMeshes),
        'all authored clothing, hat, glasses and hair colours remain exact',
      );
      for (let i = 0; i < sourceMeshes.length; i++) {
        assert.equal(sourceMeshes[i].material, runtimeMeshes[i].material);
        assert.equal(
          sourceMeshes[i].isSkinnedMesh,
          runtimeMeshes[i].isSkinnedMesh,
        );
        assert.notEqual(
          sourceMeshes[i].geometry,
          runtimeMeshes[i].geometry,
          'source and runtime caches cannot alias',
        );
        assert.equal(
          runtimeMeshes[i].geometry,
          defaultMeshes[i].geometry,
          'the actual game defaults to runtime',
        );
      }
      for (const pose of [
        { moving: 1, phase: 4.9, carry: true },
        { moving: 0, phase: 0, gesture: 0.5 },
        { moving: 0, phase: 0, sitting: true, eating: true },
        { moving: 0, phase: 0, mopping: true },
      ]) {
        for (const figure of [source, runtime]) {
          poseFigure(figure, { ...pose, time: 1.35 });
          figure.root.updateMatrixWorld(true);
        }
        for (const name of Object.keys(source.joints))
          for (let side = 0; side < 2; side++)
            assert.deepEqual(
              source.joints[name][side].matrixWorld.elements,
              runtime.joints[name][side].matrixWorld.elements,
              'sampling does not alter joint contact, anatomy or motion',
            );
        if (source.hold)
          assert.deepEqual(
            source.hold.matrixWorld.elements,
            runtime.hold.matrixWorld.elements,
          );
      }
      for (const figure of [source, runtime, implicit])
        releaseShared(figure.root);
    }
  }));

await test('a failed or nested runtime build cannot lower the detailed master sampling', () => {
  const rings = [
    { y: 0, w: 0.2, front: 0.14, back: 0.12 },
    { y: 0.1, w: 0.18, front: 0.12, back: 0.1 },
  ];
  const master = loft(rings);
  assert.throws(
    () =>
      withPeopleDetail('runtime', () => {
        const runtime = loft(rings);
        assert.ok(
          runtime.getAttribute('position').count <
            master.getAttribute('position').count,
        );
        withPeopleDetail('source', () => {
          const nestedMaster = loft(rings);
          assert.deepEqual(
            nestedMaster.getAttribute('position').array,
            master.getAttribute('position').array,
          );
          nestedMaster.dispose();
        });
        runtime.dispose();
        throw new Error('failed geometry import');
      }),
    /failed geometry import/,
  );
  const after = loft(rings);
  assert.deepEqual(
    after.getAttribute('position').array,
    master.getAttribute('position').array,
  );
  assert.deepEqual(after.index.array, master.index.array);
  master.dispose();
  after.dispose();
});
