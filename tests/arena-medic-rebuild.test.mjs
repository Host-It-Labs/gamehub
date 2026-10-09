import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Euler, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const manifest = JSON.parse(
  readFileSync(new URL('../lib/games/arena/assets.json', import.meta.url)),
);
const modelPath = process.env.MEDIC_TEST_MODEL ?? manifest.models.figures.path;
const bytes = readFileSync(new URL(`../public${modelPath}`, import.meta.url));
const scene = (
  await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    '',
  )
).scene;
const medic = scene.getObjectByName('medic');
const skins = [];
medic?.traverse((node) => {
  if (node.isSkinnedMesh) skins.push(node);
});

await test('Medic exports connected anatomical joints and a wrist-carried tonic', () => {
  assert.ok(medic, 'the existing medic root is preserved');
  assert.ok(skins.length, 'the actual figure contains weighted surfaces');
  for (const side of ['L', 'R']) {
    for (const [part, parent] of [
      ['fore', 'arm'],
      ['hand', 'fore'],
      ['knee', 'leg'],
      ['foot', 'knee'],
    ]) {
      const joint = medic.getObjectByName(`medic${part}${side}`);
      assert.ok(joint?.isBone, `${part}${side} is an anatomical bone`);
      assert.equal(
        joint.parent,
        medic.getObjectByName(`medic${parent}${side}`),
      );
    }
  }
  assert.equal(
    medic.getObjectByName('medicweapon').parent,
    medic.getObjectByName('medichandR'),
    'the complete tonic is anchored to the gripping hand',
  );
  for (const side of ['L', 'R']) {
    assert.equal(
      medic.getObjectByName(`medicpupil${side}`).parent,
      medic.getObjectByName(`mediceye${side}`),
      'blink moves the pupil with its eye',
    );
  }
});

await test('Medic retains normalized continuous shoulder, elbow and wrist weights', () => {
  const weighted = new Set();
  const blends = new Set();
  for (const mesh of skins) {
    const indices = mesh.geometry.attributes.skinIndex;
    const weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < weights.count; i++) {
      let total = 0;
      const names = new Set();
      for (let c = 0; c < 4; c++) {
        const value = weights.getComponent(i, c);
        total += value;
        if (value < 0.015) continue;
        const name = mesh.skeleton.bones[indices.getComponent(i, c)].name;
        names.add(name);
        weighted.add(name);
      }
      assert.ok(Math.abs(total - 1) < 0.001, `normalized skin vertex ${i}`);
      for (const side of ['L', 'R']) {
        if (names.has(`medicarm${side}`) && names.has(`medicfore${side}`))
          blends.add(`elbow${side}`);
        if (names.has(`medicfore${side}`) && names.has(`medichand${side}`))
          blends.add(`wrist${side}`);
      }
    }
    assert.ok(
      !Object.keys(mesh.geometry.attributes).some((name) =>
        /^color_?\d+$/.test(name),
      ),
      'only one active pigment and AO channel is exported',
    );
  }
  for (const side of ['L', 'R']) {
    for (const part of ['arm', 'fore', 'hand'])
      assert.ok(
        weighted.has(`medic${part}${side}`),
        `${part}${side} owns real anatomy`,
      );
    assert.ok(
      blends.has(`elbow${side}`),
      `${side} elbow retains blended tissue`,
    );
    assert.ok(
      blends.has(`wrist${side}`),
      `${side} wrist retains blended tissue`,
    );
  }
});

await test('Medic upper-arm tissue stays on its upper arm when the bent elbow lifts', () => {
  medic.updateMatrixWorld(true);
  const skin = skins.find((mesh) => mesh.userData.continuousSkin);
  assert.ok(skin, 'the joined skin is retained as weighted anatomy');
  skin.skeleton.update();
  for (const side of ['L', 'R']) {
    const upper = medic.getObjectByName(`medicarm${side}`);
    const elbow = medic.getObjectByName(`medicfore${side}`);
    const at = upper
      .getWorldPosition(new Vector3())
      .lerp(elbow.getWorldPosition(new Vector3()), 0.25);
    // The internal arm center is close to the separate torso surface.
    // Sample its lateral tissue at the same proximal longitudinal anchor,
    // rather than accidentally testing the adjacent chest after tailoring.
    at.x += (side === 'R' ? 1 : -1) * 0.04;
    let nearest = -1;
    let distance = Infinity;
    for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
      const p = skin
        .getVertexPosition(i, new Vector3())
        .applyMatrix4(skin.matrixWorld);
      const d = p.distanceToSquared(at);
      if (d < distance) {
        distance = d;
        nearest = i;
      }
    }
    assert.ok(
      distance < 0.06 ** 2,
      `${side} arm has tissue at its anatomical anchor`,
    );
    let influence = 0;
    let forearm = 0;
    for (let component = 0; component < 4; component++) {
      const bone =
        skin.skeleton.bones[
          skin.geometry.attributes.skinIndex.getComponent(nearest, component)
        ];
      if (bone === upper)
        influence += skin.geometry.attributes.skinWeight.getComponent(
          nearest,
          component,
        );
      if (bone === elbow)
        forearm += skin.geometry.attributes.skinWeight.getComponent(
          nearest,
          component,
        );
    }
    assert.ok(
      influence > 0.55 && forearm < 0.08,
      `${side} proximal upper arm retains upper-arm ownership`,
    );
  }
});

await test('Medic tailoring retains the complete shirt and both sleeves', () => {
  medic.updateMatrixWorld(true);
  const tailoring = skins.filter((mesh) => mesh.userData.weightedTailoring);
  assert.ok(tailoring.length, 'the uniform follows the anatomical rig');
  const bounds = new Box3();
  for (const mesh of tailoring) bounds.union(new Box3().setFromObject(mesh));
  assert.ok(
    bounds.min.x < -0.17 && bounds.max.x > 0.17,
    'closed sleeve construction keeps cloth on both shoulders',
  );
  assert.ok(
    bounds.max.y - bounds.min.y > 0.35,
    'sewing the sleeves preserves the full shirt instead of only its last operand',
  );
});

await test('Medic exposed medial upper arm is not pulled back into the shirt by torso weights', () => {
  medic.updateMatrixWorld(true);
  const skin = skins.find((mesh) => mesh.userData.continuousSkin);
  skin.skeleton.update();
  // This visible vertex below the right cuff produced the reviewed chest
  // ribbons when its torso ownership was almost one half.
  const at = new Vector3(0.1474, 0.7574, -0.0298);
  let nearest = -1;
  let distance = Infinity;
  for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
    const p = skin
      .getVertexPosition(i, new Vector3())
      .applyMatrix4(skin.matrixWorld);
    const d = p.distanceToSquared(at);
    if (d < distance) {
      distance = d;
      nearest = i;
    }
  }
  assert.ok(
    distance < 0.015 ** 2,
    'the authored medial arm surface remains present',
  );
  const influence = {};
  for (let c = 0; c < 4; c++) {
    const bone =
      skin.skeleton.bones[
        skin.geometry.attributes.skinIndex.getComponent(nearest, c)
      ];
    influence[bone.name] =
      (influence[bone.name] ?? 0) +
      skin.geometry.attributes.skinWeight.getComponent(nearest, c);
  }
  assert.ok(
    (influence.medicarmR ?? 0) > 0.92,
    'the exposed distal upper arm follows its upper-arm bone',
  );
  assert.ok(
    (influence.medictorso ?? 0) < 0.02,
    'the torso cannot drag the medial arm down into chest ribbons',
  );
});

await test('Medic keeps its grip attached through the complete heal and recovery excursion', () => {
  const copy = cloneSkeleton(medic);
  const hand = copy.getObjectByName('medichandR');
  const tool = copy.getObjectByName('medicweapon');
  copy.updateMatrixWorld(true);
  const grip = hand.worldToLocal(tool.getWorldPosition(new Vector3()));
  const original = new Map();
  for (const name of ['armR', 'foreR', 'handR']) {
    const bone = copy.getObjectByName(`medic${name}`);
    original.set(name, bone.quaternion.clone());
  }
  for (let i = 0; i <= 32; i++) {
    const k = Math.sin((i / 32) * Math.PI);
    for (const [part, x, z] of [
      ['armR', 1.75 * k, 0.14 * k],
      ['foreR', -0.9 * k, 0],
      ['handR', -0.85 * k, -0.14 * k],
    ]) {
      copy
        .getObjectByName(`medic${part}`)
        .quaternion.copy(original.get(part))
        .multiply(new Quaternion().setFromEuler(new Euler(x, 0, z)));
    }
    copy.updateMatrixWorld(true);
    const actual = hand.worldToLocal(tool.getWorldPosition(new Vector3()));
    assert.ok(actual.distanceTo(grip) < 1e-5, `fixed grip at heal sample ${i}`);
    copy.traverse((node) => {
      if (!node.isSkinnedMesh) return;
      node.skeleton.update();
      const count = node.geometry.attributes.position.count;
      for (
        let vertex = 0;
        vertex < count;
        vertex += Math.max(1, Math.floor(count / 100))
      ) {
        const p = node.getVertexPosition(vertex, new Vector3());
        assert.ok(
          p.toArray().every(Number.isFinite),
          'no invalid deformed anatomy',
        );
      }
    });
  }
  assert.notEqual(
    hand,
    medic.getObjectByName('medichandR'),
    'instances have independent bones',
  );
  copy.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(copy);
  assert.ok(
    bounds.max.y - bounds.min.y > 1.2,
    'the adult figure retains its standing scale',
  );
});

await test('Medic runtime preserves its reviewed quality allocation and green medical palette', () => {
  let triangles = 0;
  let meshes = 0;
  let green = false;
  medic.traverse((node) => {
    if (!node.isMesh) return;
    meshes++;
    triangles +=
      (node.geometry.index?.count ?? node.geometry.attributes.position.count) /
      3;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    green ||= mats.some((mat) => mat.name.includes('medic-green-master'));
  });
  assert.ok(green, 'the medical emblem palette is green');
  if (process.env.MEDIC_TEST_SOURCE === '1') {
    assert.ok(
      medic.userData.unoptimized,
      'the explicit source override remains unreduced',
    );
    assert.ok(triangles > 16408, 'detailed source is retained separately');
  } else {
    assert.equal(
      medic.userData.unoptimized,
      false,
      'the shipped copy is the reviewed reduction',
    );
    assert.ok(
      // The inherited 16,408 ceiling visibly collapsed finger valleys,
      // oval eyes, flat bands and cloth hems. Parent accepted V10 at
      // 56,916 after matched static views, motion and stone contacts.
      triangles <= 57000,
      `${triangles} triangles exceeds the reviewed 57000 allocation`,
    );
    assert.ok(meshes <= 53, `${meshes} primitives exceeds the reviewed 53`);
    assert.equal(skins.length, 12, '12 primitives preserve continuous skin and weighted cloth');
    assert.equal(meshes - skins.length, 41, '41 rigid primitives use the existing batch renderer');
  }
});

await test(
  'Medic runtime keeps transferred normals and its reviewed green-emblem finish',
  { skip: process.env.MEDIC_TEST_SOURCE === '1' },
  () => {
    assert.equal(
      medic.userData.arenaReviewedAO,
      1,
      'the collector preserves reviewed AO',
    );
    assert.match(
      medic.userData.aoContract,
      /isolated AO128 distance\.22 seed65/,
    );
    let emblems = 0;
    medic.traverse((node) => {
      if (!node.isMesh) return;
      const normal = node.geometry.attributes.normal;
      assert.ok(normal, 'authored surface normals are exported');
      for (
        let i = 0;
        i < normal.count;
        i += Math.max(1, Math.floor(normal.count / 100))
      ) {
        const length = new Vector3().fromBufferAttribute(normal, i).length();
        assert.ok(
          Math.abs(length - 1) < 0.002,
          'retained normal is finite and normalized',
        );
      }
      const mats = Array.isArray(node.material)
        ? node.material
        : [node.material];
      if (!mats.some((m) => m.name.includes('medic-green-master'))) return;
      emblems++;
      const color = node.geometry.attributes.color;
      assert.ok(color, 'medical emblems carry the reviewed AO');
      for (let i = 0; i < color.count; i++) {
        assert.ok(
          Math.min(color.getX(i), color.getY(i), color.getZ(i)) > 0.96,
          'nearly touching cloth cannot bake the green emblem black',
        );
      }
    });
    assert.ok(
      emblems >= 3,
      'cap, armband, satchel and tonic retain green identity',
    );
  },
);
