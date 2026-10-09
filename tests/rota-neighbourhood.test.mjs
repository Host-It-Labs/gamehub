import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { MAP_IDS, maps } from '../lib/games/rota/maps.ts';
import { DX, DY, RAIL, ROAD } from '../lib/games/rota/pieces.ts';
import { exitSegments } from '../lib/games/rota/routes.ts';
import { FRONTAGE, HOUSE_DEPTH, RAIL_TOP } from '../lib/games/rota/scale.ts';
import {
  crossingClearance,
  NEIGHBOURHOOD_FOOT_Y,
  planNeighbourhood,
  LANE_HALF,
  RING,
  walkSpanY,
} from '../lib/games/rota/neighbourhood.ts';

const pavement = RING - LANE_HALF - 0.018;
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

function terraces(map) {
  const n = map.size;
  const depth = RING - LANE_HALF - 0.05 - HOUSE_DEPTH / 2;
  const rows = [];
  for (let side = 0; side < 4; side++) {
    for (let u = -1; u <= n + 1; u += FRONTAGE) {
      const x = side === 0 || side === 2 ? u : side === 1 ? n + depth : -depth;
      const z = side === 1 || side === 3 ? u : side === 0 ? -depth : n + depth;
      if (
        map.exits.some((e) => {
          const along =
            e.dir === 0 || e.dir === 2
              ? (e.cell % n) + 0.5
              : Math.floor(e.cell / n) + 0.5;
          return e.dir === side && Math.abs(u - along) < 0.48;
        })
      )
        continue;
      rows.push({
        x,
        z,
        rot: [Math.PI, Math.PI / 2, 0, -Math.PI / 2][side],
        houses: 1,
        windows: true,
      });
    }
  }
  rows.push({ x: 0, z: -2.2, rot: Math.PI, houses: 4, windows: true });
  rows.push({ x: n + 2.2, z: 0, rot: Math.PI / 2, houses: 4, windows: true });
  return rows;
}

await test('connected pavement loops stay off every board and protect all exit crossings', () => {
  for (const id of MAP_IDS) {
    const map = maps[id];
    const plan = planNeighbourhood(map, [], () => 0, []);
    assert.equal(plan.routes.length, 1, id);
    assert.equal(plan.routes[0].loop, true, id);
    assert.equal(
      plan.crossings.length,
      map.exits.filter((e) => !e.pier).length,
      id,
    );
    const exits = exitSegments(map);
    for (const route of plan.routes) {
      assert.ok(
        close(
          route.length,
          route.spans.reduce((sum, s) => sum + s.length, 0),
        ),
      );
      for (let i = 0; i < route.spans.length; i++) {
        const span = route.spans[i];
        const next = route.spans[(i + 1) % route.spans.length];
        assert.ok(
          close(span.b.x, next.a.x) && close(span.b.z, next.a.z),
          `${id}: disconnected pavement`,
        );
        for (const p of [span.a, span.b])
          assert.ok(
            p.x < 0 || p.x > map.size || p.z < 0 || p.z > map.size,
            `${id}: on board`,
          );
        if (span.crossing >= 0) {
          const site = plan.crossings[span.crossing];
          const e = exits[site.exitIndex];
          assert.equal(e.shape.type, 'line');
          assert.ok(close(site.x, e.shape.from.x + DX[e.shape.dir] * pavement));
          assert.ok(close(site.z, e.shape.from.z + DY[e.shape.dir] * pavement));
          assert.ok(
            close(span.length, site.halfWidth * 2),
            `${id}: crossing split into short spans`,
          );
          if (site.kind === 'rail') {
            assert.ok(close(span.a.y, site.y) && close(span.b.y, site.y));
            assert.ok(close(site.y, RAIL_TOP + 0.001));
          } else {
            assert.ok(close(walkSpanY(span, 0.5), site.y));
            assert.ok(walkSpanY(span, 0) > walkSpanY(span, 0.5));
            assert.ok(close(walkSpanY(span, 0), span.a.y));
            assert.ok(close(walkSpanY(span, 1), span.b.y));
          }
        }
      }
    }
  }
});

await test('real fronts give reachable door points and side paths stay before junctions', () => {
  const map = maps.meadow;
  const rows = terraces(map);
  const plan = planNeighbourhood(map, rows, () => 0, []);
  assert.ok(plan.routes.length >= 2);
  assert.ok(plan.routes.flatMap((r) => r.doors).length > 20);
  for (const route of plan.routes) {
    for (const door of route.doors) {
      assert.ok(door.distance >= 0 && door.distance <= route.length);
      assert.equal(door.point.y, NEIGHBOURHOOD_FOOT_Y);
      assert.ok(
        rows.some((row) => {
          for (let k = 0; k < row.houses; k++) {
            const u =
              (k + 0.5) * FRONTAGE - (row.houses * FRONTAGE) / 2 - 0.045;
            const v = HOUSE_DEPTH / 2 + 0.002;
            if (
              close(
                door.point.x,
                row.x + u * Math.cos(row.rot) + v * Math.sin(row.rot),
              ) &&
              close(
                door.point.z,
                row.z - u * Math.sin(row.rot) + v * Math.cos(row.rot),
              )
            )
              return true;
          }
          return false;
        }),
        'the door does not belong to an actual house',
      );
    }
    for (const span of route.spans) {
      for (const p of [span.a, span.b]) {
        for (const row of rows) {
          const dx = p.x - row.x,
            dz = p.z - row.z;
          const x = dx * Math.cos(row.rot) - dz * Math.sin(row.rot);
          const z = dx * Math.sin(row.rot) + dz * Math.cos(row.rot);
          assert.ok(
            Math.abs(x) >= (row.houses * FRONTAGE) / 2 ||
              Math.abs(z) >= HOUSE_DEPTH / 2,
            'walk inside a terrace',
          );
        }
      }
    }
  }
});

await test('water and off-site rivers cut a ring into continuous dry arcs', () => {
  const map = maps.harbour;
  const water = (x, z) => (x > 4 && z > 4 ? -0.06 : 0);
  const river = [
    [
      { x: -4, z: 2.5 },
      { x: 0, z: 2.5 },
    ],
  ];
  const plan = planNeighbourhood(map, [], water, river);
  assert.ok(plan.routes.length > 0);
  assert.ok(plan.routes.every((r) => !r.loop));
  for (const route of plan.routes) {
    for (let i = 0; i < route.spans.length; i++) {
      const span = route.spans[i];
      if (i) {
        const before = route.spans[i - 1].b;
        assert.ok(
          close(before.x, span.a.x) &&
            close(before.y, span.a.y) &&
            close(before.z, span.a.z),
        );
      }
      for (const p of [span.a, span.b]) {
        assert.ok(water(p.x, p.z) >= 0);
        if (p.x >= -4 && p.x <= 0) assert.ok(Math.abs(p.z - 2.5) >= 0.23);
      }
    }
  }
  assert.ok(plan.crossings.every((site) => water(site.x, site.z) >= 0));
});

await test('rail sensor closes on approach, holds wagons and clears the trailing overhang', () => {
  const site = {
    x: 1.5,
    y: 0.039,
    z: -pavement,
    axis: 'x',
    kind: 'rail',
    halfWidth: 0.158,
    width: 0.072,
    exitIndex: 1,
  };
  const body = (a, b, speed = 0.2) => ({
    ax: 1.5,
    az: a,
    bx: 1.5,
    bz: b,
    width: 0.1,
    speed,
    kind: RAIL,
    exitIndex: 1,
  });
  const approaching = body(-3.1, -3.5);
  assert.ok(
    crossingClearance(site, [approaching]) > 0 &&
      crossingClearance(site, [approaching]) < 12,
  );
  assert.equal(crossingClearance(site, [body(-1, -1.6)]), 0);
  assert.equal(
    crossingClearance(site, [body(-0.6, -0.9), body(-1.35, -1.8)]),
    0,
    'a wagon remains on the walkway',
  );
  assert.equal(
    crossingClearance(site, [body(-0.6, -0.9), body(-1.1, -1.25)]),
    Infinity,
  );
  assert.equal(
    crossingClearance(site, [body(-3, -3.5, 0)]),
    Infinity,
    'a parked train elsewhere must not close it',
  );
  assert.equal(
    crossingClearance(site, [{ ...body(-3, -3.5), ax: 4, bx: 4 }]),
    Infinity,
  );
  assert.equal(
    crossingClearance(site, [{ ...body(-3, -3.5), exitIndex: 3 }]),
    Infinity,
  );
  assert.equal(
    crossingClearance(site, [body(-2.2, -1.8)]),
    Infinity,
    'a train going away must not close it',
  );
  assert.equal(
    crossingClearance(site, [body(-1, -1.6, 0)]),
    0,
    'a stopped train still occupying the deck blocks it',
  );
  // Complete forward and backward body sweeps, not merely sampled axles:
  // every overlap must block, including the rear/leading body overhang.
  for (const sign of [-1, 1]) {
    for (let mid = site.z - 1; mid <= site.z + 1; mid += 0.025) {
      const train = body(mid + sign * 0.22, mid - sign * 0.22);
      const overlapping =
        mid - 0.22 <= site.z + site.width / 2 + 0.018 &&
        mid + 0.22 >= site.z - site.width / 2 - 0.018;
      if (overlapping) assert.equal(crossingClearance(site, [train]), 0);
      else if ((site.z - train.az) * sign < 0)
        assert.equal(crossingClearance(site, [train]), Infinity);
      else assert.ok(crossingClearance(site, [train]) > 0);
    }
  }
});

await test('road sensor respects both lanes and the reused buffer count', () => {
  const site = {
    x: 3.5,
    y: 0.013,
    z: -pavement,
    axis: 'x',
    kind: 'road',
    halfWidth: 0.18,
    width: 0.088,
    exitIndex: 2,
  };
  const car = {
    ax: 3.575,
    az: -2.2,
    bx: 3.575,
    bz: -2.36,
    width: 0.07,
    speed: 0.32,
    kind: ROAD,
  };
  assert.ok(
    crossingClearance(site, [car]) > 2 && crossingClearance(site, [car]) < 3,
  );
  const stale = { ...car, az: -1.3, bz: -1.5 };
  assert.ok(crossingClearance(site, [car, stale], 1) > 2);
  assert.equal(crossingClearance(site, [car, stale], 2), 0);
  assert.equal(
    crossingClearance(site, [{ ...stale, ax: 3.425, bx: 3.425 }]),
    0,
  );
  const alongX = { ...site, x: -pavement, z: 3.5, axis: 'z' };
  assert.equal(
    crossingClearance(alongX, [
      { ...stale, ax: stale.az, bx: stale.bz, az: stale.ax, bz: stale.bx },
    ]),
    0,
  );
  const accelerating = { ...car, speed: 0.03, maxSpeed: 0.34 };
  assert.ok(
    crossingClearance(site, [accelerating]) < 3,
    'a slowly starting car will accelerate before reaching the zebra',
  );
  const restarting = { ...accelerating, speed: 0, restartIn: 0.5 };
  assert.ok(
    crossingClearance(site, [restarting]) > 2.5 &&
      crossingClearance(site, [restarting]) < 3.5,
  );
  assert.equal(
    crossingClearance(site, [{ ...accelerating, speed: 0 }]),
    Infinity,
    'an unknown stationary queue must not hold the crossing forever',
  );
});

await test('warning lights wait for admitted walkers before gates lower, then reopen after the rear clears', async () => {
  // The renderer is constructed in Node without WebGL or a listener. Bundle
  // its normal imports once so the test uses the actual Three.js meshes.
  const { outputFiles } = await build({
    entryPoints: [
      fileURLToPath(
        new URL('../components/game/rota/three/crossings.ts', import.meta.url),
      ),
    ],
    tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  const { Crossings } = await import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`
  );
  const rail = {
    x: 1.5,
    z: -pavement,
    y: 0.039,
    axis: 'x',
    kind: 'rail',
    halfWidth: 0.158,
    width: 0.072,
    exitIndex: 1,
  };
  const road = {
    ...rail,
    x: 3.5,
    y: 0.013,
    kind: 'road',
    halfWidth: 0.18,
    width: 0.088,
    exitIndex: 2,
  };
  const plan = { routes: [], lamps: [], crossings: [rail, road] };
  const crossing = new Crossings(plan, false);
  const gates = crossing.group.getObjectByName('rota-level-crossing-gates');
  const original = gates.instanceMatrix.array.slice();
  const approaching = {
    ax: rail.x,
    bx: rail.x,
    az: rail.z - 1,
    bz: rail.z - 1.4,
    width: 0.1,
    speed: 0.2,
    kind: RAIL,
    exitIndex: 1,
  };
  const occupancy = new Uint8Array([1, 0]);
  crossing.sense([approaching], 1);
  for (let i = 0; i < 12; i++) crossing.tick(0.1, i / 10, 1, occupancy);
  assert.equal(
    crossing.states[0].blocked,
    true,
    'new walkers receive a warning immediately',
  );
  assert.deepEqual(
    gates.instanceMatrix.array,
    original,
    'the admitted walker keeps the lifting gates raised',
  );
  occupancy[0] = 0;
  for (let i = 0; i < 9; i++) crossing.tick(0.1, i / 10, 1, occupancy);
  assert.notDeepEqual(
    gates.instanceMatrix.array,
    original,
    'gates lower when the last companion leaves',
  );
  crossing.sense([], 0);
  crossing.tick(0.1, 2, 1, occupancy);
  assert.equal(
    crossing.states[0].blocked,
    true,
    'reopening has a rear-clear dwell',
  );
  for (let i = 0; i < 30; i++) crossing.tick(0.1, 2 + i / 10, 1, occupancy);
  assert.equal(crossing.states[0].blocked, false);
  assert.equal(crossing.states[0].clearance, Infinity);
  assert.deepEqual(gates.instanceMatrix.array, original);
  const still = new Crossings(plan, true);
  still.sense([approaching], 1);
  still.tick(0.1, 1, 0.5);
  const lights = still.group.getObjectByName('rota-crossing-lenses');
  const colour = lights.instanceColor.array.slice();
  still.tick(0.1, 100, 0.5);
  assert.deepEqual(
    lights.instanceColor.array,
    colour,
    'reduced motion freezes flashing',
  );
  still.tick(0.1, 100, 1);
  assert.notDeepEqual(
    lights.instanceColor.array,
    colour,
    'requested dusk still changes light',
  );
  crossing.dispose();
  still.dispose();
  assert.equal(crossing.group.children.length, 0);
  assert.equal(still.group.children.length, 0);
});
