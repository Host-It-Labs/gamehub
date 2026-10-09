import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Construct normal Three.js geometry in Node; no WebGL, port or renderer.
const code = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    contents: `export {TownLife,planTerraceYards} from './components/game/rota/three/town-life.ts';
      export {Crossings} from './components/game/rota/three/crossings.ts';
      export {Materials} from './components/game/rota/three/materials.ts';
      export {planScenery} from './components/game/rota/three/scenery.ts';
      export {Ground} from './components/game/rota/three/ground.ts';
      export {maps,MAP_IDS} from './lib/games/rota/maps.ts';
      export {exitSegments} from './lib/games/rota/routes.ts';
      export {DX,DY,RAIL} from './lib/games/rota/pieces.ts';`,
  },
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(code.outputFiles[0].contents).toString('base64')}`
);

await test('rear-yard geometry follows real paired rows, never the site, houses or exit routes', () => {
  for (const id of api.MAP_IDS) {
    const map = api.maps[id];
    const exits = api.exitSegments(map);
    const ground = new api.Ground(map, { value: 1 });
    ground.shape({
      map,
      rivers: [],
      corridors: exits.map((e) => ({
        x0: e.shape.from.x,
        z0: e.shape.from.z,
        x1: e.shape.from.x + api.DX[e.shape.dir] * e.shape.length,
        z1: e.shape.from.z + api.DY[e.shape.dir] * e.shape.length,
      })),
    });
    const { rows } = api.planScenery({
      map,
      height: (x, z) => ground.heightAt(x, z),
      rivers: [],
      lite: false,
    });
    const yards = api.planTerraceYards(rows, map.size);
    assert.ok(
      yards.length >= 180 && yards.length <= 300,
      `${id}: insufficient bounded yard coverage`,
    );
    assert.deepEqual(
      api.planTerraceYards(rows, map.size),
      yards,
      'domestic plots must be stable',
    );
    const perimeter = yards.filter(
      (p) => Math.max(-p.x, -p.z, p.x - map.size, p.z - map.size) < 1.4,
    );
    assert.ok(perimeter.length >= 50, `${id}: the perimeter remains blank`);
    const bucket = new Map();
    for (const r of rows) {
      const c = Math.cos(r.rot),
        s = Math.sin(r.rot);
      const half = r.houses * 0.1;
      const w = Math.abs(c) * half + Math.abs(s) * 0.13;
      const d = Math.abs(s) * half + Math.abs(c) * 0.13;
      const footprint = { ...r, c, s, half };
      for (let x = Math.floor(r.x - w); x <= Math.floor(r.x + w); x++)
        for (let z = Math.floor(r.z - d); z <= Math.floor(r.z + d); z++) {
          const key = `${x}:${z}`;
          const list = bucket.get(key);
          if (list) list.push(footprint);
          else bucket.set(key, [footprint]);
        }
    }
    const life = new api.TownLife(rows, map.size, false);
    assert.equal(life.group.userData.washingLines, 44, `${id}: sparse washing`);
    for (const mesh of life.group.children.filter((m) =>
      m.name.startsWith('rota-yard-'),
    )) {
      const pos = mesh.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k),
          y = pos.getY(k),
          z = pos.getZ(k);
        assert.ok(Number.isFinite(x + y + z));
        assert.ok(
          x < 0 || x > map.size || z < 0 || z > map.size,
          `${id}: ${mesh.name} enters board`,
        );
        for (const r of bucket.get(`${Math.floor(x)}:${Math.floor(z)}`) ?? []) {
          const dx = x - r.x,
            dz = z - r.z;
          assert.ok(
            Math.abs(dx * r.c - dz * r.s) >= r.half - 0.00001 ||
              Math.abs(dx * r.s + dz * r.c) >= 0.13 - 0.00001,
            `${id}: ${mesh.name} inside terrace`,
          );
        }
        for (const e of exits) {
          const dx = api.DX[e.shape.dir],
            dz = api.DY[e.shape.dir];
          const along = (x - e.shape.from.x) * dx + (z - e.shape.from.z) * dz;
          if (along < 0 || along > e.shape.length) continue;
          const cross = Math.abs(
            (x - e.shape.from.x) * dz - (z - e.shape.from.z) * dx,
          );
          assert.ok(
            cross >= (e.kind === api.RAIL ? 0.13 : 0.2) - 0.00001,
            `${id}: ${mesh.name} occupies an exit`,
          );
        }
      }
    }
    life.dispose();
    ground.dispose();
  }
});

await test('rail deck preserves flange gaps and gate geometry has a visible white frame', () => {
  const crossing = new api.Crossings(
    {
      routes: [],
      lamps: [],
      crossings: [
        {
          x: 0,
          y: 0.039,
          z: -1.387,
          axis: 'x',
          kind: 'rail',
          halfWidth: 0.158,
          width: 0.072,
          exitIndex: 0,
        },
      ],
    },
    false,
  );
  const timber = crossing.group.getObjectByName('rota-crossing-timber').geometry
    .attributes.position;
  for (let k = 0; k < timber.count; k++) {
    assert.ok(
      Math.abs(Math.abs(timber.getX(k)) - 0.045) >= 0.0039,
      'timber covers the flange gap',
    );
    assert.ok(
      timber.getY(k) <= 0.039,
      'deck rises above the authoritative foot/rail crossing surface',
    );
  }
  const gates = crossing.group.getObjectByName('rota-level-crossing-gates');
  gates.geometry.computeBoundingBox();
  assert.ok(
    gates.geometry.boundingBox.max.y - gates.geometry.boundingBox.min.y >=
      0.027,
    'gate is still only a flat boom',
  );
  crossing.dispose();
});

await test('incidental washing reduces by tier without dropping yard structure or disposing shared surfaces', () => {
  const map = api.maps.meadow;
  const { rows } = api.planScenery({
    map,
    height: () => 0,
    rivers: [],
    lite: false,
  });
  const shared = new api.Materials();
  const life = new api.TownLife(rows, map.size, true, shared);
  const sheets = life.group.getObjectByName('rota-yard-washing');
  const bricks = life.group.getObjectByName('rota-yard-brick');
  const oldGeometry = bricks.geometry;
  life.setQuality('high');
  const full = sheets.geometry.drawRange.count;
  life.setQuality('balanced');
  const balanced = sheets.geometry.drawRange.count;
  life.setQuality('low');
  assert.ok(full > balanced && balanced > sheets.geometry.drawRange.count);
  assert.equal(bricks.geometry, oldGeometry);
  let sharedDisposed = false;
  bricks.material.addEventListener('dispose', () => {
    sharedDisposed = true;
  });
  const crossing = new api.Crossings(
    {
      routes: [],
      lamps: [],
      crossings: [
        {
          x: 0,
          y: 0.039,
          z: -1.387,
          axis: 'x',
          kind: 'rail',
          halfWidth: 0.158,
          width: 0.072,
          exitIndex: 0,
        },
      ],
    },
    true,
    shared,
  );
  let deckDisposed = false;
  crossing.group
    .getObjectByName('rota-crossing-timber')
    .material.addEventListener('dispose', () => {
      deckDisposed = true;
    });
  life.dispose();
  crossing.dispose();
  assert.equal(sharedDisposed, false, 'the world owns shared yard materials');
  assert.equal(deckDisposed, false, 'the world owns shared crossing surfaces');
  shared.dispose();
  assert.equal(sharedDisposed, true);
  assert.equal(deckDisposed, true);
});
