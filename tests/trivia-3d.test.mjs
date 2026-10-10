import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createTriviaTower,
  batchSettledTowerFloors,
} from '../components/game/trivia-3d/tower-model.ts';
import {
  createTriviaExpedition,
  createTriviaTraveller,
} from '../components/game/trivia-3d/expedition-model.ts';

function near(actual, expected, tolerance = 1e-6, label = 'value') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} differs from ${expected} by more than ${tolerance}`,
  );
}

function nearArray(actual, expected, tolerance = 1e-6, label = 'array') {
  assert.equal(actual.length, expected.length, `${label} length`);
  for (let i = 0; i < actual.length; i++)
    near(actual[i], expected[i], tolerance, `${label}[${i}]`);
}

/** Expand instances to their actual world transforms, without a renderer. */
function drawEntries(root) {
  root.updateWorldMatrix(true, true);
  const entries = [];
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const count = object instanceof THREE.InstancedMesh ? object.count : 1;
    for (let i = 0; i < count; i++) {
      const matrix = object.matrixWorld.clone();
      if (object instanceof THREE.InstancedMesh) {
        const instance = new THREE.Matrix4();
        object.getMatrixAt(i, instance);
        matrix.multiply(instance);
      }
      entries.push({
        geometry: object.geometry,
        material: object.material,
        matrix,
        mesh: object,
      });
    }
  });
  return entries;
}

function triangles(entries) {
  return entries.reduce(
    (sum, { geometry }) =>
      sum +
      (geometry.index?.count ?? geometry.getAttribute('position').count) / 3,
    0,
  );
}

/** Tight vertex bounds avoid the extra volume from transformed local AABBs. */
function visibleBounds(root) {
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const { geometry, matrix } of drawEntries(root)) {
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++)
      bounds.expandByPoint(
        point.fromBufferAttribute(position, i).applyMatrix4(matrix),
      );
  }
  return bounds;
}

function compareBounds(actual, expected, label, tolerance = 2e-6) {
  nearArray(
    actual.min.toArray(),
    expected.min.toArray(),
    tolerance,
    `${label} min`,
  );
  nearArray(
    actual.max.toArray(),
    expected.max.toArray(),
    tolerance,
    `${label} max`,
  );
}

function assertGeometry(root) {
  const seen = new Set();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || seen.has(object.geometry)) return;
    const geometry = object.geometry;
    seen.add(geometry);
    const position = geometry.getAttribute('position');
    assert.ok(position?.count > 0, `${object.name} has positions`);
    assert.equal(position.itemSize, 3);
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      assert.equal(
        attribute.count,
        position.count,
        `${object.name} ${name} count`,
      );
      for (let i = 0; i < attribute.count; i++)
        for (let component = 0; component < attribute.itemSize; component++)
          assert.ok(
            Number.isFinite(attribute.getComponent(i, component)),
            `${object.name} ${name} is finite at ${i},${component}`,
          );
    }
    assert.equal(
      geometry.getAttribute('normal')?.itemSize,
      3,
      `${object.name} normals`,
    );
    const count = geometry.index?.count ?? position.count;
    assert.equal(count % 3, 0, `${object.name} complete triangles`);
    if (geometry.index)
      for (const index of geometry.index.array)
        assert.ok(
          Number.isInteger(index) && index >= 0 && index < position.count,
          `${object.name} index ${index} is in range`,
        );
    for (const group of geometry.groups)
      assert.ok(
        group.start >= 0 &&
          group.count >= 0 &&
          group.start + group.count <= count,
        `${object.name} material group is in range`,
      );
  });
  assert.ok(seen.size > 0, 'model has authored geometry');
}

function observeDisposal(root) {
  const resources = new Set();
  const instances = new Set();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry);
    if (object instanceof THREE.InstancedMesh) instances.add(object);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      resources.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) resources.add(value);
    }
  });
  const events = new Map();
  for (const resource of [...resources, ...instances]) {
    events.set(resource, 0);
    resource.addEventListener('dispose', () =>
      events.set(resource, events.get(resource) + 1),
    );
  }
  return { resources, instances, events };
}

function showFloors(tower, count) {
  tower.floors.forEach((floor, i) => {
    floor.visible = i < count;
  });
  tower.crown.position.y = tower.baseHeight + count * tower.floorHeight;
}

function compareSourceInstances(source, runtime) {
  assert.equal(
    runtime.length,
    source.length,
    'every source piece is submitted once',
  );
  const remaining = [...source];
  for (const actual of runtime) {
    const index = remaining.findIndex(
      (expected) =>
        actual.geometry === expected.geometry &&
        actual.material === expected.material &&
        actual.matrix.elements.every(
          (value, i) => Math.abs(value - expected.matrix.elements[i]) < 1e-6,
        ),
    );
    assert.notEqual(
      index,
      -1,
      'instance retains source geometry, material and world transform',
    );
    remaining.splice(index, 1);
  }
  assert.equal(remaining.length, 0, 'no source piece is lost or duplicated');
}

function dynamicState(root) {
  root.updateWorldMatrix(true, true);
  const result = [];
  root.traverse((object) => {
    if (!object.userData.triviaDynamic) return;
    result.push({
      name: object.name,
      type: object.type,
      visible: object.visible,
      matrix: object.matrixWorld.elements.slice(),
      positions:
        object instanceof THREE.Mesh
          ? Array.from(object.geometry.getAttribute('position').array)
          : [],
    });
  });
  return result;
}

function compareDynamic(source, runtime, label) {
  assert.equal(
    runtime.length,
    source.length,
    `${label} animation boundary count`,
  );
  assert.ok(source.length >= 2, `${label} has independent moving parts`);
  source.forEach((expected, i) => {
    const actual = runtime[i];
    assert.equal(actual.name, expected.name, `${label} boundary identity`);
    assert.equal(actual.type, expected.type, `${label} boundary type`);
    assert.equal(
      actual.visible,
      expected.visible,
      `${label} boundary visibility`,
    );
    nearArray(
      actual.matrix,
      expected.matrix,
      1e-6,
      `${label} ${expected.name} transform`,
    );
    nearArray(
      actual.positions,
      expected.positions,
      1e-6,
      `${label} ${expected.name} vertices`,
    );
  });
}

await test('Tower geometry is finite and each earned floor stays one grounded architectural tier, including legacy 25-floor saves', () => {
  const tower = createTriviaTower('#cf593e', 25);
  const current = createTriviaTower('#48a4a7');
  const clamped = createTriviaTower('#485baf', 99);
  const tallest = createTriviaTower('#9c6bc4', 72);
  try {
    assert.equal(
      current.floors.length,
      20,
      'new matches use twenty available tiers',
    );
    assert.equal(
      tower.floors.length,
      25,
      'legacy five-round saves can show all twenty-five tiers',
    );
    assert.equal(
      tallest.floors.length,
      72,
      'six players over twelve placement rounds can reach 72 tiers',
    );
    assert.equal(
      clamped.floors.length,
      72,
      'invalid larger requests stay bounded',
    );
    assertGeometry(tower.root);
    assert.ok(
      tower.floors.every((floor) => !floor.visible),
      'source starts without earned floors',
    );
    near(visibleBounds(tower.root).min.y, 0, 1e-6, 'foundation rests at zero');
    for (let i = 0; i < tower.floors.length; i++) {
      const floor = tower.floors[i];
      near(
        floor.position.y,
        tower.baseHeight + i * tower.floorHeight,
        1e-10,
        'tier placement',
      );
      const saved = floor.visible;
      floor.visible = true;
      const bounds = visibleBounds(floor);
      near(bounds.min.y, floor.position.y, 1e-6, 'tier lower contact');
      near(
        bounds.max.y,
        floor.position.y + tower.floorHeight,
        1e-6,
        'tier upper contact',
      );
      floor.visible = saved;
    }
  } finally {
    tower.dispose();
    current.dispose();
    clamped.dispose();
    tallest.dispose();
  }
});

await test('settled Tower instances preserve source world transforms, bounds and every triangle through growing and shrinking counts', () => {
  const tower = createTriviaTower('#cf593e', 25);
  tower.root.position.set(2.6, -0.15, 8.9);
  tower.root.rotation.set(0.12, 0.81, -0.03);
  tower.root.scale.set(1.1, 1.24, 0.93);
  tower.floors[2].rotation.set(0.07, -0.08, 0.11);
  tower.floors[2].scale.set(1.03, 0.985, 0.99);
  const batch = batchSettledTowerFloors(tower);
  try {
    assert.equal(
      batchSettledTowerFloors(tower),
      batch,
      'one batch owns source visibility',
    );
    for (const count of [0, 1, 3, 5, 20, 25, 3, 0, 25]) {
      batch.release();
      showFloors(tower, count);
      const source = drawEntries(tower.root);
      const sourceBounds = visibleBounds(tower.root);
      const groupTransforms = tower.floors.map((floor) =>
        floor.matrix.toArray(),
      );
      batch.sync(count);
      const runtime = drawEntries(tower.root);
      compareSourceInstances(source, runtime);
      assert.equal(
        triangles(runtime),
        triangles(source),
        `${count} tiers keep every triangle`,
      );
      compareBounds(visibleBounds(tower.root), sourceBounds, `${count} tiers`);
      tower.floors.forEach((floor, i) =>
        nearArray(
          floor.matrix.toArray(),
          groupTransforms[i],
          0,
          'editable tier transform',
        ),
      );
      const draws = new Set(runtime.map((entry) => entry.mesh)).size;
      if (count >= 20)
        assert.ok(
          draws < source.length / 2,
          'settling materially reduces draws',
        );
      if (count === 0)
        assert.equal(
          batch.root.visible,
          false,
          'zero settled tiers draw no instances',
        );
    }
    batch.release();
    assert.ok(
      tower.floors.every((floor) =>
        floor.children.every((mesh) => mesh.visible),
      ),
      'release restores all source meshes',
    );
  } finally {
    tower.dispose();
  }
});

await test('batching settled Tower floors leaves unfinished floor drop hooks and the roof/cloth dynamic', () => {
  const tower = createTriviaTower('#3c73d9');
  const batch = batchSettledTowerFloors(tower);
  try {
    showFloors(tower, 7);
    const falling = tower.floors[6];
    falling.position.y += 0.72;
    falling.rotation.y = 0.08;
    const before = drawEntries(tower.root);
    const crownPosition = tower.crown.position.clone();
    batch.sync(3);
    compareSourceInstances(before, drawEntries(tower.root));
    tower.floors.forEach((floor, i) => {
      assert.equal(floor.visible, i < 7, 'scene keeps floor-group visibility');
      assert.ok(
        floor.children.every((mesh) => mesh.visible === i >= 3),
        'only settled mesh children hide',
      );
    });
    const oldWorld = drawEntries(falling).map((entry) =>
      entry.matrix.elements.slice(),
    );
    falling.position.y -= 0.31;
    const movedWorld = drawEntries(falling);
    assert.ok(
      movedWorld.some((entry, i) =>
        entry.matrix.elements.some((value, j) => value !== oldWorld[i][j]),
      ),
      'unfinished geometry follows its original drop pivot',
    );
    assert.ok(
      tower.crown.position.equals(crownPosition),
      'batch never repositions crown',
    );
    assert.ok(
      tower.flag.visible && tower.flag.parent === tower.crown,
      'cloth remains attached to dynamic crown',
    );
  } finally {
    tower.dispose();
  }
});

await test('Tower cloth waves at the free edge, holds its pole attachment and restores exact quiet folds under reduced motion', () => {
  const tower = createTriviaTower('#d86399');
  try {
    const positions = tower.flag.geometry.getAttribute('position');
    const rest = positions.array.slice();
    const anchors = [];
    for (let i = 0; i < positions.count; i++)
      if (positions.getX(i) === 0) anchors.push(i);
    assert.ok(anchors.length >= 2, 'cloth has a full fixed edge');
    let movement = 0;
    for (const time of [0.15, 1.3, 2.7, 4.2]) {
      tower.wave(time);
      for (const i of anchors)
        nearArray(
          Array.from(positions.array.slice(i * 3, i * 3 + 3)),
          Array.from(rest.slice(i * 3, i * 3 + 3)),
          0,
          'cloth fixed edge',
        );
      for (let i = 0; i < rest.length; i++)
        movement = Math.max(movement, Math.abs(positions.array[i] - rest[i]));
      assertGeometry(tower.flag);
    }
    assert.ok(movement > 0.01, 'free cloth edge visibly deforms');
    tower.wave(42, true);
    assert.deepEqual(
      positions.array,
      rest,
      'reduced motion restores authored rest',
    );
    tower.wave(99, true);
    assert.deepEqual(
      positions.array,
      rest,
      'quiet folds are independent of clock',
    );
  } finally {
    tower.dispose();
  }
});

await test('Tower source and instance resources dispose once in either teardown order', () => {
  for (const batchFirst of [false, true]) {
    const tower = createTriviaTower('#329674', 25);
    showFloors(tower, 25);
    const batch = batchSettledTowerFloors(tower);
    batch.sync(25);
    const observed = observeDisposal(tower.root);
    assert.ok(
      observed.instances.size > 0,
      'instance matrix resources are observed',
    );
    if (batchFirst) {
      batch.dispose();
      batch.dispose();
      for (const resource of observed.resources)
        assert.equal(
          observed.events.get(resource),
          0,
          'instance teardown does not free source buffers/materials',
        );
    }
    tower.dispose();
    tower.dispose();
    batch.dispose();
    batch.dispose();
    assert.equal(batch.root.parent, null, 'instance subtree detaches');
    for (const [resource, count] of observed.events)
      assert.equal(count, 1, `${resource.type ?? 'geometry'} disposes once`);
  }
});

await test('Expedition and traveller source/runtime copies keep valid geometry, triangles, bounds and moving pivots', () => {
  for (const factory of [
    (runtime) => createTriviaExpedition({ runtime }),
    (runtime) => createTriviaTraveller('#db923e', { runtime }),
  ]) {
    const source = factory(false);
    const runtime = factory(true);
    try {
      assertGeometry(source.root);
      assertGeometry(runtime.root);
      const original = dynamicState(source.root);
      const sourceDraws = drawEntries(source.root).length;
      const runtimeDraws = drawEntries(runtime.root).length;
      assert.ok(
        runtimeDraws < sourceDraws / 2,
        'static consolidation materially reduces draws',
      );
      let changed = false;
      for (const time of [0, 0.75, 1.9, 3.1]) {
        if ('point' in source) {
          source.update(time, false);
          runtime.update(time, false);
        } else {
          source.update(time, true, false);
          runtime.update(time, true, false);
        }
        const actual = dynamicState(source.root);
        compareDynamic(actual, dynamicState(runtime.root), source.root.name);
        changed ||= actual.some((state, i) =>
          state.matrix.some((value, j) => value !== original[i].matrix[j]),
        );
        assert.equal(
          triangles(drawEntries(runtime.root)),
          triangles(drawEntries(source.root)),
          'runtime preserves visible triangle count',
        );
        compareBounds(
          visibleBounds(runtime.root),
          visibleBounds(source.root),
          'moving source/runtime',
        );
      }
      // Correctly call each factory's reduced-motion signature.
      if ('point' in source) {
        source.update(33, true);
        runtime.update(33, true);
      } else {
        source.update(33, true, true);
        runtime.update(33, true, true);
      }
      compareDynamic(
        dynamicState(source.root),
        dynamicState(runtime.root),
        'reduced source/runtime',
      );
      assert.ok(
        changed,
        'moving parts retain actual motion after consolidation',
      );
    } finally {
      source.dispose();
      runtime.dispose();
    }
  }
});

await test('Expedition trail and clustered lane samples stay grounded, with finite unit normals and safe endpoint clamping', () => {
  const world = createTriviaExpedition();
  try {
    for (const distance of [-5, 0, 0.5, 3, 5.4, 6.2, 9, 11.5, 12, 18, NaN]) {
      for (const lateral of [-0.35, 0, 0.35]) {
        const point = world.point(distance, lateral);
        assert.ok(
          point.toArray().every(Number.isFinite),
          'all samples remain finite',
        );
        const surface = world.surfaceAt(point.x, point.z);
        nearArray(
          point.toArray(),
          surface.toArray(),
          1e-10,
          'token foot samples its actual local surface',
        );
        const normal = world.normalAt(point.x, point.z);
        assert.ok(normal.toArray().every(Number.isFinite));
        near(normal.length(), 1, 1e-10, 'surface normal is unit length');
        assert.ok(normal.y > 0, 'surface normal faces upward');
      }
    }
    assert.ok(
      world.point(-5).equals(world.point(0)),
      'negative progress clamps to start',
    );
    assert.ok(
      world.point(18).equals(world.point(12)),
      'excess progress clamps to summit',
    );
    assert.ok(
      world.point(NaN).equals(world.point(0)),
      'invalid progress starts safely',
    );
    const left = world.point(6, -0.35);
    const right = world.point(6, 0.35);
    near(
      Math.hypot(left.x - right.x, left.z - right.z),
      0.7,
      1e-10,
      'two-abreast lane spacing',
    );
    world.root.updateWorldMatrix(true, true);
    const ray = new THREE.Raycaster();
    for (let step = 0; step <= 60; step++) {
      const point = world.point(step / 5);
      ray.set(
        new THREE.Vector3(point.x, 10, point.z),
        new THREE.Vector3(0, -1, 0),
      );
      const hit = ray.intersectObject(world.root, true)[0];
      assert.ok(hit, 'every trail foot has a modeled surface beneath it');
      const gap = point.y - hit.point.y;
      assert.ok(
        gap >= -0.05 && gap <= 0.05,
        `trail surface contact ${step}: ${gap}`,
      );
    }
  } finally {
    world.dispose();
  }
});

await test('traveller rocking keeps its contact plate planted throughout a complete movement cycle and settles under reduced motion', () => {
  for (const runtime of [false, true]) {
    const traveller = createTriviaTraveller('#9c6bc4', { runtime });
    try {
      const initial = visibleBounds(traveller.root);
      assert.ok(
        initial.min.y >= -1e-6 && initial.min.y <= 0.006,
        'contact plate rests within six millimetres of its ground origin',
      );
      const boot = traveller.root.children.find(
        (object) =>
          object instanceof THREE.Group && object.userData.triviaDynamic,
      );
      assert.ok(boot, 'traveller retains its articulated boot pivot');
      const quiet = dynamicState(traveller.root);
      let changed = false;
      for (let frame = 0; frame <= 36; frame++) {
        traveller.update(frame / 12, true, false);
        const bounds = visibleBounds(traveller.root);
        near(bounds.min.y, initial.min.y, 1e-6, 'contact plate stays planted');
        assert.ok(
          bounds.min.y >= -1e-6,
          'boot never sinks through the surface',
        );
        const bootContact = visibleBounds(boot).min.y;
        assert.ok(
          bootContact >= 0.03 && bootContact <= 0.065,
          'rolling sole remains close above its contact plate without sinking or floating',
        );
        changed ||= dynamicState(traveller.root).some((part, i) =>
          part.matrix.some((value, j) => value !== quiet[i].matrix[j]),
        );
      }
      assert.ok(changed, 'boot and badge move on their original pivots');
      traveller.update(55, true, true);
      compareDynamic(dynamicState(traveller.root), quiet, 'quiet traveller');
      compareBounds(
        visibleBounds(traveller.root),
        initial,
        'quiet traveller bounds',
      );
    } finally {
      traveller.dispose();
    }
  }
});

await test('Expedition and traveller release observable geometry, material and texture resources exactly once', () => {
  for (const runtime of [false, true])
    for (const model of [
      createTriviaExpedition({ runtime }),
      createTriviaTraveller('#e35a42', { runtime }),
    ]) {
      const observed = observeDisposal(model.root);
      model.dispose();
      model.dispose();
      assert.ok(
        [...observed.resources].some(
          (resource) => resource instanceof THREE.Texture,
        ),
        'material textures are observed',
      );
      for (const [resource, count] of observed.events)
        assert.equal(
          count,
          1,
          `${resource.type ?? 'geometry'} resource released once`,
        );
    }
});
