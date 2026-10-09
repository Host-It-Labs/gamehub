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
import {
  BLUE_HOUR,
  DUSK_SECONDS,
  duskLighting,
  DuskTransition,
  lateDusk,
} from '../lib/games/rota/daylight.ts';

// Compile the actual scene modules, without WebGL, a listener or a browser.
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
const { prepareWindows } =
  await import('../components/game/rota/three/window-lights.ts');
const { townRows } = await import('../components/game/rota/three/scenery.ts');
const { TownLayer } = await import('../components/game/rota/three/growth.ts');
const { TownLife } = await import('../components/game/rota/three/town-life.ts');
const { LanternPools } =
  await import('../components/game/rota/three/lanterns.ts');
hook.deregister();

const manifest = JSON.parse(
  readFileSync(resolve(root, 'lib/games/rota/assets.json'), 'utf8'),
);
const models = new Map();
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
for (const family of ['town', 'works']) {
  const file = Object.entries(manifest.models).find(([key]) =>
    key.startsWith(family),
  )[1];
  const bytes = readFileSync(resolve(root, `public${file.path}`));
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  for (const object of gltf.scene.children) {
    object.traverse((node) => {
      if (node.isMesh) node.geometry.userData.model = true;
    });
    models.set(object.name, object);
  }
}

await test('dusk reaches the requested hour in 2.2 seconds without restarting on board updates', () => {
  const dusk = new DuskTransition();
  dusk.set(1);
  for (let i = 0; i < 66; i++) {
    dusk.tick(1 / 60);
    dusk.set(1);
  }
  assert.ok(Math.abs(dusk.value - 0.5) < 1e-9);
  const previous = dusk.value;
  dusk.set(0.8);
  assert.equal(dusk.value, previous, 'retargeting must not jump');
  for (let i = 0; i < 133; i++) dusk.tick(1 / 60);
  assert.equal(dusk.value, 0.8);
  dusk.set(1, true);
  assert.equal(
    dusk.value,
    1,
    'still/snapshot scenes must use their exact requested hour',
  );
  dusk.set(NaN, true);
  assert.equal(dusk.value, 0);
  dusk.set(2, true);
  assert.equal(dusk.value, 1);
  assert.equal(dusk.tick(DUSK_SECONDS), false);
});

await test('late dusk preserves the reviewed rounds and has faint short shadows above 20 degrees', () => {
  const light = {
    late: 0,
    sunHeight: 0,
    sunIntensity: 0,
    skyIntensity: 0,
    shadowIntensity: 0,
    shadowRadius: 0,
  };
  for (const d of [0, 0.13, 0.5, 0.53, 0.55]) {
    assert.equal(duskLighting(d, light), light, 'reuses the supplied state');
    assert.equal(light.late, 0);
    assert.equal(light.sunHeight, 0.95 - d * 0.65);
    assert.equal(light.sunIntensity, 2.5 - d * 1.3);
    assert.equal(light.skyIntensity, 1.5 + d * 0.4);
    assert.equal(light.shadowIntensity, 1);
  }
  let lastSun = Infinity;
  let lastShadow = 1;
  for (let i = 0; i <= 1000; i++) {
    duskLighting(i / 1000, light);
    const elevation = Math.atan2(light.sunHeight, Math.hypot(0.95, 0.45));
    assert.ok(elevation > (20 * Math.PI) / 180);
    assert.ok(light.sunIntensity <= lastSun);
    assert.ok(light.shadowIntensity <= lastShadow);
    lastSun = light.sunIntensity;
    lastShadow = light.shadowIntensity;
  }
  assert.ok(light.sunIntensity < 0.4);
  assert.ok(light.shadowIntensity < 0.17);
  assert.ok(light.skyIntensity > 2.3);
  assert.equal(lateDusk(0.55), 0);
  assert.equal(lateDusk(1), 1);
  const fill = new THREE.Color(BLUE_HOUR.sky);
  assert.ok(fill.b / fill.r < 1.11, 'cool fill is desaturated, not cobalt');
  const mats = new Materials();
  mats.tick(80, 0.53);
  assert.equal(mats.late.value, 0);
  mats.tick(80, 1);
  assert.equal(mats.late.value, 1);
  for (const [family, hex] of [
    ['slate', '#5c6670'],
    ['cobble', '#5a5a5e'],
    ['brick', '#9b5440'],
  ]) {
    const m = mats.tiled(family, hex);
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.toon.vertexShader,
      fragmentShader: THREE.ShaderLib.toon.fragmentShader,
    };
    m.onBeforeCompile(shader, null);
    assert.equal(shader.uniforms.uLateDusk, mats.late);
    assert.ok(shader.fragmentShader.includes('float materialValue'));
  }
  mats.dispose();
});

await test('window identity is shared by connected triangles but different for separate apertures', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0, 0.04, 0, 0, 0.04, 0.06, 0, 0, 0.06, 0, 0.1, 0, 0, 0.14, 0, 0,
        0.14, 0.06, 0, 0.1, 0.06, 0,
      ],
      3,
    ),
  );
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  prepareWindows(g);
  const info = g.getAttribute('aRotaWindow');
  for (let i = 1; i < 4; i++) assert.equal(info.getZ(i), info.getZ(0));
  for (let i = 5; i < 8; i++) assert.equal(info.getZ(i), info.getZ(4));
  assert.notEqual(info.getZ(0), info.getZ(4));
  assert.equal(info.getX(0), 0);
  assert.equal(info.getX(2), 1);
  assert.equal(info.getY(2), 1);
  const existing = info;
  prepareWindows(g);
  assert.equal(
    g.getAttribute('aRotaWindow'),
    existing,
    'cached geometry is not rebuilt',
  );
  g.dispose();
});

await test('moving headlights keep a stable dusk threshold while fixed gas lamps stagger', () => {
  const mats = new Materials();
  const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const fixture = (name) => {
    const group = new THREE.Group();
    group.name = name;
    const source = new THREE.MeshBasicMaterial();
    source.name = 'glow:lamp';
    const mesh = new THREE.Mesh(geometry, source);
    group.add(mesh);
    mats.dress(group);
    source.dispose();
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    };
    mesh.material.onBeforeCompile(shader, null);
    return { material: mesh.material, shader };
  };
  const car = fixture('car_saloon');
  const lamp = fixture('gas_lamp');
  const secondLamp = fixture('gas_lamp');
  assert.equal(lamp.material, secondLamp.material);
  assert.notEqual(car.material, lamp.material);
  assert.ok(!car.shader.vertexShader.includes('dot(lamp.xz'));
  assert.ok(lamp.shader.vertexShader.includes('dot(lamp.xz'));
  assert.equal(car.shader.uniforms.uTownDusk, mats.dusk);
  assert.equal(lamp.shader.uniforms.uTownDusk, mats.dusk);
  assert.notEqual(
    car.material.customProgramCacheKey(),
    lamp.material.customProgramCacheKey(),
  );
  geometry.dispose();
  mats.dispose();
});

await test('actual quantized building panes retain geometry and gain valid individual window coordinates', () => {
  const mats = new Materials();
  let panes = 0;
  let sourcePanes = 0;
  for (const name of [
    'terrace_a',
    'terrace_b',
    'terrace_tall',
    'cottage',
    'shop',
    'corner_pub',
    'mill_big',
    'mill_small',
    'town_hall',
    'station_hall',
  ]) {
    const src = models.get(name);
    assert.ok(src, `${name} source exists`);
    const before = new Map();
    src.traverse((node) => {
      if (node.isMesh) {
        before.set(
          node.geometry,
          node.geometry.getAttribute('position').array.slice(),
        );
        if (node.material.name.startsWith('glass:')) sourcePanes++;
      }
    });
    const copy = src.clone(true);
    mats.dress(copy);
    copy.traverse((node) => {
      if (!node.isMesh) return;
      assert.deepEqual(
        node.geometry.getAttribute('position').array,
        before.get(node.geometry),
        'lighting must not move or replace the source aperture',
      );
      if (!node.material.name.startsWith('glass:')) return;
      const info = node.geometry.getAttribute('aRotaWindow');
      assert.ok(info, `${name} glass has opening data`);
      for (let i = 0; i < info.count; i++) {
        assert.ok(info.getX(i) >= 0 && info.getX(i) <= 1);
        assert.ok(info.getY(i) >= 0 && info.getY(i) <= 1);
        assert.ok(info.getZ(i) >= 0 && info.getZ(i) <= 1);
        assert.ok(Number.isFinite(info.getW(i)));
      }
      const shader = {
        uniforms: {},
        vertexShader: THREE.ShaderLib.toon.vertexShader,
        fragmentShader: THREE.ShaderLib.toon.fragmentShader,
      };
      node.material.onBeforeCompile(shader, null);
      assert.equal(shader.uniforms.uTownTime, mats.time);
      assert.equal(shader.uniforms.uTownDusk, mats.dusk);
      panes++;
    });
  }
  assert.ok(sourcePanes > 0);
  assert.equal(
    panes,
    sourcePanes,
    'every real aperture gets the window shader; goods sheds without glazing need none',
  );
  mats.tick(75, 1);
  assert.equal(mats.time.value, 75);
  assert.equal(mats.dusk.value, 1);
  mats.dispose();
});

await test('generated terraces have separate sash and fanlight apertures and growing lots share the lighting', () => {
  const mats = new Materials();
  const rows = [
    {
      x: 0,
      z: -1.225,
      rot: Math.PI,
      houses: 2,
      storeys: 2,
      y: 0,
      tint: 0.3,
      windows: true,
    },
  ];
  const group = townRows(rows, mats);
  const glass = group.children.find((mesh) =>
    mesh.geometry.hasAttribute('aRotaWindow'),
  );
  const data = glass.geometry.getAttribute('aRotaWindow');
  const seeds = new Set();
  let fanlight = false;
  for (let i = 0; i < data.count; i++) {
    seeds.add(data.getZ(i));
    fanlight ||= data.getW(i) < 0.65;
  }
  assert.equal(seeds.size, 8, 'two homes: three sashes and one fanlight each');
  assert.ok(fanlight);
  assert.equal(
    group.children.length,
    5,
    'walls, roofs, surrounds, doors, panes are merged',
  );
  const town = new TownLayer(models, mats);
  town.set(
    [
      { name: 'terrace_a', x: 2.2, z: 2.2, rot: 0, cell: 16 },
      { name: 'gas_lamp', x: 2.38, z: 2.38, rot: 0, cell: 16 },
    ],
    0,
    false,
  );
  const pane = town.group.children.find(
    (m) => m.isInstancedMesh && m.geometry.hasAttribute('aRotaWindow'),
  );
  assert.ok(pane);
  town.tick(1);
  town.setQuality('low');
  town.atmosphere(3.1, 1, new THREE.Fog('#6d829a', 20, 60));
  town.dispose();
  for (const mesh of group.children) mesh.geometry.dispose();
  mats.dispose();
});

await test('local light pools have fog uniforms and yard/bird motion freezes with still', () => {
  const dusk = { value: 1 };
  const pools = new LanternPools([{ x: 0, z: -1.38 }], dusk);
  assert.equal(pools.mesh.material.uniforms.uDusk, dusk);
  assert.equal(pools.heads.material.uniforms.uDusk, dusk);
  for (const u of ['fogColor', 'fogNear', 'fogFar'])
    assert.ok(pools.mesh.material.uniforms[u]);
  const head = new THREE.Matrix4();
  pools.heads.getMatrixAt(0, head);
  assert.ok(Math.abs(head.elements[13] - 0.12) < 1e-7);
  assert.equal(pools.mesh.children[0], pools.heads);
  pools.setQuality('low');
  assert.equal(pools.heads.visible, false);
  assert.equal(pools.mesh.visible, true, 'pavement light remains at low');
  pools.setQuality('high');
  assert.equal(pools.heads.visible, true);
  const rows = Array.from({ length: 7 }, (_, i) => ({
    x: i,
    z: -1.225,
    rot: Math.PI,
    houses: 4,
    storeys: 2,
    y: 0,
    tint: 0.4,
    windows: true,
  }));
  const life = new TownLife(rows, 7, true);
  const bird = life.group.children.find((m) => m.isInstancedMesh);
  const before = bird.instanceMatrix.array.slice();
  life.tick(300);
  assert.deepEqual(bird.instanceMatrix.array, before);
  life.setQuality('low');
  assert.equal(bird.count, 0);
  life.setQuality('high');
  assert.equal(bird.count, 8);
  life.dispose();
  pools.dispose();
});
