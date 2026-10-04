import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_IDS, maps } from '../lib/games/rota/maps.ts';
import { createRota, observe, play } from '../lib/games/rota/engine.ts';
import { botRound } from '../lib/games/rota/bot.ts';
import { emptyCells } from '../lib/games/rota/board.ts';
import { MODELS, growTown } from '../lib/games/rota/growth.ts';
import {
  cellCentre,
  pieceSegments,
  pointAt,
} from '../lib/games/rota/routes.ts';
import { RAIL, ROAD } from '../lib/games/rota/pieces.ts';

function built(map, seed, ext = {}) {
  let g = createRota(1, seed, { map, ext, difficulty: 'hard', bots: [true] });
  while (!g.over) for (const m of botRound(observe(g, 0), 0)) g = play(g, m, 0);
  return {
    map: maps[map],
    cells: g.seats[0].cells,
    rubble: g.seats[0].rubble,
    towns: g.towns,
  };
}

/** Footprint corners of a lot. */
function corners(l) {
  const m = MODELS[l.name];
  const c = Math.cos(l.rot),
    s = Math.sin(l.rot);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([i, j]) => {
    const u = (i * m.w) / 2,
      v = (j * m.d) / 2;
    return { x: l.x + u * c + v * s, z: l.z - u * s + v * c };
  });
}

function nearestRoute(sheet, x, z) {
  let d = Infinity;
  sheet.cells.forEach((c, cell) => {
    if (!c) return;
    for (const seg of pieceSegments(c.p, c.o, cellCentre(sheet.map, cell))) {
      if (seg.kind !== ROAD && seg.kind !== RAIL) continue;
      for (let i = 0; i <= 50; i++) {
        const p = pointAt(seg, i / 50);
        d = Math.min(d, Math.hypot(p.x - x, p.z - z));
      }
    }
  });
  return d;
}

await test('the town grows on every map, inside its squares and off the routes', () => {
  for (const map of MAP_IDS)
    for (const seed of [2, 9]) {
      const sheet = built(map, seed, { towns: true, rockfall: true });
      const t0 = performance.now();
      const lots = growTown(sheet);
      const ms = performance.now() - t0;
      assert.ok(ms < 1500, `${map}: growing took ${ms.toFixed(0)} ms`);
      const houses = lots.filter((l) => l.name !== 'gas_lamp');
      assert.ok(
        houses.length > 40,
        `${map}/${seed}: only ${houses.length} buildings`,
      );
      for (const l of houses) {
        const col = Math.floor(l.x),
          row = Math.floor(l.z);
        assert.equal(
          row * sheet.map.size + col,
          l.cell,
          `${l.name} strays from its square`,
        );
        for (const p of corners(l)) {
          assert.ok(
            Math.floor(p.x) === col && Math.floor(p.z) === row,
            `${map}: ${l.name} pokes out of its square`,
          );
          assert.ok(
            nearestRoute(sheet, p.x, p.z) > 0.12,
            `${map}: ${l.name} stands on a route`,
          );
        }
      }
      // Deterministic.
      assert.deepEqual(growTown(sheet), lots);
    }
});

await test('a square keeps its buildings when a piece goes down far away', () => {
  const sheet = built('meadow', 4);
  const before = growTown(sheet);
  const empty = sheet.cells.findIndex(
    (c, i) =>
      !c &&
      sheet.cells.every(
        (o, j) =>
          !o ||
          Math.abs((i % 7) - (j % 7)) +
            Math.abs(Math.floor(i / 7) - Math.floor(j / 7)) >
            2,
      ),
  );
  if (empty < 0) return;
  const cells = sheet.cells.slice();
  cells[empty] = { p: 'road-straight', o: 0, r: 9 };
  const after = growTown({ ...sheet, cells });
  const far = (l) =>
    Math.abs((l.cell % 7) - (empty % 7)) +
      Math.abs(Math.floor(l.cell / 7) - Math.floor(empty / 7)) >
    2;
  assert.deepEqual(after.filter(far), before.filter(far));
});

await test('a loop of streets becomes a block lined inside and out', () => {
  const map = maps.capital;
  const cells = emptyCells(map);
  const at = (x, y) => y * map.size + x;
  // A ring of bends round a two-by-two hole... of bends at the corners.
  cells[at(2, 2)] = { p: 'road-curve', o: 1, r: 1 };
  cells[at(3, 2)] = { p: 'road-straight', o: 1, r: 1 };
  cells[at(4, 2)] = { p: 'road-curve', o: 2, r: 1 };
  cells[at(4, 3)] = { p: 'road-straight', o: 0, r: 1 };
  cells[at(4, 4)] = { p: 'road-curve', o: 3, r: 1 };
  cells[at(3, 4)] = { p: 'road-straight', o: 1, r: 1 };
  cells[at(2, 4)] = { p: 'road-curve', o: 0, r: 1 };
  cells[at(2, 3)] = { p: 'road-straight', o: 0, r: 1 };
  const lots = growTown({ map, cells, finished: true }).filter(
    (l) => l.name !== 'gas_lamp',
  );
  assert.ok(lots.length > 20);
  // Buildings in the ring's squares face both into the hole and out.
  const mid = { x: 3.5, z: 3.5 };
  let inward = 0,
    outward = 0;
  for (const l of lots) {
    if (l.cell === at(3, 3)) continue;
    const fx = Math.sin(l.rot),
      fz = Math.cos(l.rot);
    const towards = (mid.x - l.x) * fx + (mid.z - l.z) * fz;
    if (towards > 0) inward++;
    else outward++;
  }
  assert.ok(inward > 3 && outward > 3, `inward ${inward}, outward ${outward}`);
});
