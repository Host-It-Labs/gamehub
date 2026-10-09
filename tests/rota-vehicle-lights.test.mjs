import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ROAD, RAIL } from '../lib/games/rota/pieces.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/'))
      return next(
        pathToFileURL(resolve(root, `${specifier.slice(2)}.ts`)).href,
        context,
      );
    if (
      specifier.startsWith('.') &&
      context.parentURL?.endsWith('.ts') &&
      !extname(specifier)
    )
      return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
const { Materials } =
  await import('../components/game/rota/three/materials.ts');
const { Traffic } = await import('../components/game/rota/three/traffic.ts');
const { VehicleLights, trainLampEnd, vehicleLightFade } =
  await import('../components/game/rota/three/vehicle-lights.ts');
hook.deregister();

const manifest = JSON.parse(
  readFileSync(resolve(root, 'lib/games/rota/assets.json'), 'utf8'),
);
const bytes = readFileSync(
  resolve(root, `public${manifest.models.vehicles.path}`),
);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  '',
);
const models = new Map(gltf.scene.children.map((model) => [model.name, model]));

function spec(model, flip = false) {
  const box = new THREE.Box3().setFromObject(models.get(model));
  return {
    model,
    flip,
    length: box.max.z - box.min.z,
    width: box.max.x - box.min.x,
  };
}

function dressed(model, mats) {
  return mats.dress(models.get(model).clone(true));
}

function lenses(object) {
  const out = [];
  object.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials)
      if (material.name.startsWith('glow:traffic-'))
        out.push({ mesh, material });
  });
  return out;
}

function compileHook(material) {
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
  };
  material.onBeforeCompile(shader, null);
  return shader;
}

await test('vehicle lamps fade smoothly from afternoon to fully on before dusk 0.5', () => {
  assert.equal(vehicleLightFade(0), 0);
  assert.equal(vehicleLightFade(0.12), 0);
  assert.ok(vehicleLightFade(0.13) < 0.003);
  assert.ok(Math.abs(vehicleLightFade(0.3) - 0.5) < 1e-12);
  assert.equal(vehicleLightFade(0.5), 1);
  assert.equal(vehicleLightFade(1), 1);
  assert.equal(vehicleLightFade(NaN), 0);
});

await test('real street vehicles reuse their paired warm head and red tail lens geometry', () => {
  const mats = new Materials();
  const light = new VehicleLights();
  let head;
  let tail;
  for (const model of ['car_retro', 'car_sedan', 'van', 'lorry', 'bus']) {
    const object = dressed(model, mats);
    const before = new Map();
    object.traverse((mesh) => {
      if (mesh.isMesh) before.set(mesh.name, mesh.geometry);
    });
    assert.equal(light.attach(object, spec(model), false), null);
    const lamps = lenses(object);
    assert.equal(lamps.length, 2, model);
    const h = lamps.find(({ material }) => material.name.endsWith('-head'));
    const t = lamps.find(({ material }) => material.name.endsWith('-tail'));
    assert.ok(h && t);
    assert.equal(h.mesh.geometry, before.get(h.mesh.name));
    assert.equal(t.mesh.geometry, before.get(t.mesh.name));
    assert.ok(
      new THREE.Box3().setFromObject(h.mesh).max.z < 0,
      'headlamps remain on the actual front',
    );
    assert.ok(
      new THREE.Box3().setFromObject(t.mesh).min.z > 0,
      'tails remain on the actual rear',
    );
    if (head) assert.equal(h.material, head);
    if (tail) assert.equal(t.material, tail);
    head = h.material;
    tail = t.material;
  }
  const headShader = compileHook(head);
  const tailShader = compileHook(tail);
  assert.equal(
    headShader.uniforms.uVehicleLight,
    tailShader.uniforms.uVehicleLight,
  );
  assert.equal(
    headShader.uniforms.uVehicleLight,
    light.pools.material.uniforms.uLight,
  );
  light.setDusk(0.5);
  assert.equal(headShader.uniforms.uVehicleLight.value, 1);
  assert.ok(
    !headShader.vertexShader.includes('dot(lamp.xz'),
    'movement cannot flicker headlamps',
  );
  light.dispose();
  mats.dispose();
});

await test('outward train lamps swap white and red on reversal without lighting coupling ends', () => {
  assert.equal(trainLampEnd(0, 4, false, false), -1);
  assert.equal(trainLampEnd(3, 4, false, true), -1);
  assert.equal(trainLampEnd(0, 4, true, true), -1);
  assert.equal(trainLampEnd(3, 4, true, false), -1);
  assert.equal(trainLampEnd(1, 4, false, false), 0);
  const mats = new Materials();
  const light = new VehicleLights();
  for (const model of ['loco_steam', 'loco_diesel']) {
    const front = dressed(model, mats);
    const rear = dressed(model, mats);
    const first = light.attach(front, spec(model), true);
    const last = light.attach(rear, spec(model, true), true);
    rear.rotation.y = Math.PI;
    assert.ok(first.slots.length > 0 && last.slots.length > 0);
    light.train(first, 0, 4, false);
    light.train(last, 3, 4, false);
    assert.equal(first.material.name, 'glow:traffic-head');
    assert.equal(last.material.name, 'glow:traffic-tail');
    for (const rig of [first, last]) {
      const shader = compileHook(rig.material);
      assert.ok(shader.vertexShader.includes('vVehicleZ = transformed.z'));
      assert.ok(shader.fragmentShader.includes('vVehicleZ * -1.0'));
      const mesh = rig.slots[0].mesh;
      const bounds = new THREE.Box3().setFromBufferAttribute(
        mesh.geometry.getAttribute('position'),
      );
      assert.ok(
        bounds.min.z < 0 && bounds.max.z > 0,
        'both actual engine end fittings are present',
      );
    }
    const frontMatrix = front.matrix.clone();
    const rearHeading = rear.rotation.y;
    light.train(last, 0, 4, true);
    light.train(first, 3, 4, true);
    assert.equal(last.material.name, 'glow:traffic-head');
    assert.equal(first.material.name, 'glow:traffic-tail');
    assert.deepEqual(front.matrix.elements, frontMatrix.elements);
    assert.equal(rear.rotation.y, rearHeading);
  }
  light.dispose();
  mats.dispose();
});

await test('headlight pools sit ahead of the car, keep its bridge slope, and simplify on low tier', () => {
  const light = new VehicleLights();
  const car = spec('car_retro');
  const object = new THREE.Group();
  object.position.set(2, 0.2, 3);
  object.rotation.set(0.12, Math.PI / 3, 0, 'YXZ');
  light.setDusk(0);
  light.begin();
  light.road(object, car);
  light.end();
  assert.equal(light.pools.count, 0);
  light.setDusk(0.5);
  light.begin();
  light.road(object, car);
  light.end();
  assert.equal(light.pools.count, 1);
  const matrix = new THREE.Matrix4();
  light.pools.getMatrixAt(0, matrix);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const local = position
    .clone()
    .sub(object.position)
    .applyQuaternion(object.quaternion.clone().invert());
  assert.ok(local.z < -car.length / 2);
  assert.ok(Math.abs(local.x) < 1e-7);
  assert.ok(Math.abs(local.y - 0.0025) < 1e-7);
  assert.ok(quaternion.angleTo(object.quaternion) < 0.001);
  assert.ok(scale.x <= 0.12 && scale.z <= 0.36);
  const buffer = light.pools.instanceMatrix.array;
  light.setQuality('low');
  assert.equal(light.pools.material.uniforms.uQuality.value, 0.3);
  light.begin();
  light.road(object, car);
  light.end();
  assert.equal(light.pools.count, 1, 'low quality preserves useful lamp pools');
  assert.equal(light.pools.instanceMatrix.array, buffer);
  object.scale.setScalar(0.4);
  light.begin();
  light.road(object, car);
  light.end();
  light.pools.getMatrixAt(0, matrix);
  matrix.decompose(position, quaternion, scale);
  const small = position
    .clone()
    .sub(object.position)
    .applyQuaternion(object.quaternion.clone().invert());
  assert.ok(
    Math.abs(small.z / local.z - 0.4) < 1e-6,
    'a shrinking car retains its pool at its own bumper',
  );
  light.clear();
  assert.equal(light.pools.count, 0);
  light.dispose();
});

function mover(cars, kind = RAIL) {
  return {
    id: 8,
    kind,
    cars,
    pushed: false,
    age: 1,
    speed: 0,
    max: 0.2,
    turn: undefined,
    blocks: new Set(),
  };
}

function pose(z = 0) {
  return {
    front: { x: 2, y: 0.012, z: z - 0.1 },
    back: { x: 2, y: 0.012, z: z + 0.1 },
  };
}

await test('Traffic preserves physical top-and-tail bodies and wheel contact when a train reverses', () => {
  const mats = new Materials();
  const traffic = new Traffic(models, mats, 0, () => false);
  const cars = [
    spec('loco_steam'),
    spec('wagon_box'),
    spec('loco_steam', true),
  ];
  const train = mover(cars);
  const positions = new Map(cars.map((car, i) => [car, pose(i * 0.4)]));
  traffic.sim.movers = [train];
  traffic.sim.tick = () => {};
  traffic.sim.poses = (m) => m.cars.map((car) => positions.get(car));
  traffic.setDusk(1);
  traffic.tick(0, false);
  const wraps = traffic.group.children.filter((node) => node.isGroup);
  assert.equal(wraps.length, 3);
  const first = wraps[0];
  const last = wraps[2];
  assert.equal(
    last.children[0].rotation.y,
    Math.PI,
    'tail engine still faces outward',
  );
  const firstPose = first.position.clone();
  const lastPose = last.position.clone();
  const firstHeading = first.quaternion.clone();
  const lastHeading = last.quaternion.clone();
  assert.ok(lenses(first)[0].material.name.endsWith('-head'));
  assert.ok(lenses(last)[0].material.name.endsWith('-tail'));
  train.cars.reverse();
  train.pushed = true;
  traffic.tick(0, false);
  assert.deepEqual(first.position.toArray(), firstPose.toArray());
  assert.deepEqual(last.position.toArray(), lastPose.toArray());
  assert.deepEqual(first.quaternion.toArray(), firstHeading.toArray());
  assert.deepEqual(last.quaternion.toArray(), lastHeading.toArray());
  assert.ok(lenses(first)[0].material.name.endsWith('-tail'));
  assert.ok(lenses(last)[0].material.name.endsWith('-head'));
  traffic.dispose();
  mats.dispose();
});

await test('Traffic retains wheel spin, still scenes, warm-up and correct light cleanup', () => {
  const mats = new Materials();
  const traffic = new Traffic(models, mats, 0, () => false);
  const car = mover([spec('car_retro')], ROAD);
  const carPose = pose();
  let ticks = 0;
  traffic.sim.tick = () => {
    ticks++;
  };
  traffic.sim.setNetwork = (net) => {
    traffic.sim.net = net;
  };
  traffic.sim.poses = () => [carPose];
  traffic.setNetwork({}, () => 0);
  traffic.sim.movers = [car];
  traffic.setDusk(1);
  traffic.tick(0, false);
  assert.equal(ticks, 1, 'still does not consume the warm-up');
  traffic.tick(1 / 60, true);
  assert.equal(
    ticks,
    452,
    '450 warm-up steps and the normal frame are preserved',
  );
  const wrap = traffic.group.children.find((node) => node.isGroup);
  let wheel;
  wrap.traverse((node) => {
    if (!wheel && node.name.startsWith('wheel')) wheel = node;
  });
  assert.ok(wheel);
  const before = wheel.rotation.x;
  carPose.front.x += 0.02;
  carPose.back.x += 0.02;
  traffic.tick(1 / 60, true);
  assert.notEqual(wheel.rotation.x, before);
  const after = wheel.rotation.x;
  traffic.tick(0, false);
  assert.equal(wheel.rotation.x, after);
  const pools = traffic.group.getObjectByName('vehicle-headlight-pools');
  assert.equal(pools.count, 1);
  traffic.sim.movers = [];
  traffic.tick(0, false);
  assert.equal(pools.count, 0);
  assert.equal(traffic.group.children.filter((node) => node.isGroup).length, 0);
  let geometryDisposals = 0;
  pools.geometry.addEventListener('dispose', () => geometryDisposals++);
  traffic.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(traffic.group.children.length, 0);
  mats.dispose();
});
