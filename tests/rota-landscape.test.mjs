import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Exercise the production geometry and terrain without a browser or WebGL.
const code = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    contents: `export {quays} from './components/game/rota/three/quays.ts';
      export {Materials} from './components/game/rota/three/materials.ts';
      export {Ground,WATER_Y} from './components/game/rota/three/ground.ts';
      export {planScenery} from './components/game/rota/three/scenery.ts';
      export {maps,MAP_IDS} from './lib/games/rota/maps.ts';
      export {greenBlock} from './lib/games/rota/landscape.ts';
      export {exitSegments} from './lib/games/rota/routes.ts';
      export {DX,DY,RAIL} from './lib/games/rota/pieces.ts';
      export {STREET_HALF,TRACK_CLEAR,FRONTAGE,HOUSE_DEPTH} from './lib/games/rota/scale.ts';
      export {RING} from './lib/games/rota/neighbourhood.ts';`,
  },
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(code.outputFiles[0].contents).toString('base64')}`,
);

const boardDistance = (n, x, z) =>
  Math.hypot(Math.max(0, -x, x - n), Math.max(0, -z, z - n));
const segmentDistance = (x, z, e) => {
  const dx = e.bx - e.ax, dz = e.bz - e.az;
  const t = Math.max(0, Math.min(1, ((x - e.ax) * dx + (z - e.az) * dz) / (dx ** 2 + dz ** 2)));
  return Math.hypot(x - e.ax - t * dx, z - e.az - t * dz);
};

function coast(map) {
  const sea = new Set(map.sea);
  const edges = [];
  for (let z = 0; z < map.size; z++)
    for (let x = 0; x < map.size; x++) {
      const wet = sea.has(z * map.size + x);
      if (x + 1 < map.size && wet !== sea.has(z * map.size + x + 1))
        edges.push({ ax: x + 1, az: z, bx: x + 1, bz: z + 1 });
      if (z + 1 < map.size && wet !== sea.has((z + 1) * map.size + x))
        edges.push({ ax: x, az: z + 1, bx: x + 1, bz: z + 1 });
    }
  return edges;
}

function triangles(group) {
  const result = [];
  group.updateMatrixWorld(true);
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.attributes.position;
    assert.equal(mesh.geometry.index, null, 'merged quays use ordinary triangle geometry');
    for (const attr of Object.values(mesh.geometry.attributes))
      assert.ok(Array.from(attr.array).every(Number.isFinite), 'quay attributes are finite');
    for (let i = 0; i < pos.count; i += 3)
      result.push([0, 1, 2].map((j) => [pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j)]));
  });
  return result;
}

const overlap = (lo, hi, a, b) => hi > a + 1e-6 && lo < b - 1e-6;
const span = (points, axis) => [Math.min(...points.map((p) => p[axis])), Math.max(...points.map((p) => p[axis]))];

await test('quays follow real coast edges, preserve dry cells and leave every pier route open', () => {
  const materials = new api.Materials();
  try {
    for (const id of api.MAP_IDS) {
      const map = api.maps[id];
      const group = api.quays(map, materials);
      try {
        const faces = triangles(group);
        const edges = coast(map);
        assert.ok(group.children.length <= 3, `${id}: quay draw calls grow with the coast`);
        assert.ok(new Set(group.children.map((m) => m.material)).size <= 3);
        assert.equal(faces.length > 0, edges.length > 0, `${id}: quays require an actual coastline`);
        for (const p of faces.flat())
          assert.ok(edges.some((e) => segmentDistance(p[0], p[2], e) < 0.1),
            `${id}: quay geometry leaves the land/sea boundary`);
        for (let cell = 0; cell < map.size ** 2; cell++) {
          if (map.sea.includes(cell)) continue;
          const x = cell % map.size, z = Math.floor(cell / map.size);
          for (const f of faces) {
            const [x0, x1] = span(f, 0), [z0, z1] = span(f, 2);
            assert.ok(!(overlap(x0, x1, x + 0.1, x + 0.9) && overlap(z0, z1, z + 0.1, z + 0.9)),
              `${id}: quay enters the usable core of cell ${cell}`);
          }
        }
        for (const e of map.exits.filter((exit) => exit.pier)) {
          const x = e.cell % map.size + 0.5 + api.DX[e.dir] * 0.5;
          const z = Math.floor(e.cell / map.size) + 0.5 + api.DY[e.dir] * 0.5;
          const half = e.route === api.RAIL ? api.TRACK_CLEAR : api.STREET_HALF;
          for (const f of faces) {
            const local = f.map(([px, y, pz]) => [
              (px - x) * api.DX[e.dir] + (pz - z) * api.DY[e.dir],
              y,
              (px - x) * -api.DY[e.dir] + (pz - z) * api.DX[e.dir],
            ]);
            const [a0, a1] = span(local, 0), [s0, s1] = span(local, 2);
            assert.ok(!(overlap(a0, a1, -0.03, 0.14) && overlap(s0, s1, -half, half)),
              `${id}: quay blocks the ${e.route === api.RAIL ? 'rail' : 'road'} pier at ${e.cell}`);
          }
        }
      } finally {
        for (const mesh of group.children) mesh.geometry.dispose();
      }
    }
  } finally {
    materials.dispose();
  }
});

await test('all three landscapes keep scenery dry and off routes without losing the first terrace ring', () => {
  for (const id of api.MAP_IDS) {
    const map = api.maps[id];
    const exits = api.exitSegments(map).map(({ kind, shape: s }) => ({
      kind, ax: s.from.x, az: s.from.z,
      bx: s.from.x + api.DX[s.dir] * s.length,
      bz: s.from.z + api.DY[s.dir] * s.length,
    }));
    const ground = new api.Ground(map, { value: 1 });
    try {
      ground.shape({ map, rivers: [], corridors: exits.map((e) => ({
        x0: e.ax, z0: e.az, x1: e.bx, z1: e.bz,
      })) });
      for (let cell = 0; cell < map.size ** 2; cell++) {
        const y = ground.heightAt(cell % map.size + 0.5, Math.floor(cell / map.size) + 0.5);
        assert.ok(Number.isFinite(y));
        assert.equal(y < api.WATER_Y, map.sea.includes(cell), `${id}: water disagrees with cell ${cell}`);
      }
      let ring;
      for (const lite of [false, true]) {
        const scene = api.planScenery({ map, height: (x, z) => ground.heightAt(x, z), rivers: [], lite });
        for (const item of [...scene.placements, ...scene.rows, ...scene.stacks])
          assert.ok(Object.values(item).filter((v) => typeof v === 'number').every(Number.isFinite),
            `${id}: non-finite scenery transform`);
        for (const p of scene.placements) {
          assert.ok(boardDistance(map.size, p.x, p.z) > 0.6, `${id}: ${p.name} enters the board`);
          assert.ok(ground.heightAt(p.x, p.z) >= -0.004, `${id}: ${p.name} is placed in water`);
          for (const e of exits)
            assert.ok(segmentDistance(p.x, p.z, e) > (e.kind === api.RAIL ? api.TRACK_CLEAR : api.STREET_HALF),
              `${id}: ${p.name} sits on an exit route`);
        }
        const perimeter = scene.rows.filter((row) => boardDistance(map.size, row.x, row.z) < api.RING);
        assert.ok(perimeter.length > 0, `${id}: missing terrace ring`);
        assert.ok(perimeter.some((r) => r.x < 0) && perimeter.some((r) => r.x > map.size)
          && perimeter.some((r) => r.z < 0) && perimeter.some((r) => r.z > map.size),
        `${id}: greenery removed one side of the terrace ring`);
        if (ring) assert.deepEqual(perimeter, ring, `${id}: lower quality removes the first terrace ring`);
        ring = perimeter;
        for (const row of scene.rows) {
          const half = row.houses * api.FRONTAGE / 2;
          for (const u of [-half, 0, half]) for (const v of [-api.HOUSE_DEPTH / 2, 0, api.HOUSE_DEPTH / 2]) {
            const x = row.x + u * Math.cos(row.rot) + v * Math.sin(row.rot);
            const z = row.z - u * Math.sin(row.rot) + v * Math.cos(row.rot);
            assert.ok(boardDistance(map.size, x, z) > 0.5, `${id}: terrace enters the board`);
            assert.ok(ground.heightAt(x, z) >= -0.005, `${id}: terrace extends into water`);
          }
        }
      }
      for (let x = -1; x <= map.size + 1; x++) for (let z = -1; z <= map.size + 1; z++)
        assert.ok(!api.greenBlock(id, x, z, map.size), `${id}: green district cuts the first ring`);
    } finally {
      ground.dispose();
    }
  }
});
