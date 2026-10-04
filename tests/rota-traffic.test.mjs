import test from 'node:test';
import assert from 'node:assert/strict';
import { RAIL, ROAD, orientations } from '../lib/games/rota/pieces.ts';
import { MAP_IDS, maps } from '../lib/games/rota/maps.ts';
import { createRota, observe, play } from '../lib/games/rota/engine.ts';
import { botRound } from '../lib/games/rota/bot.ts';
import {
  TUNNEL_AT,
  cellCentre,
  network,
  pointAt,
  stationHalf,
} from '../lib/games/rota/routes.ts';
import { CARRIAGE_HALF, ROAD_TOP } from '../lib/games/rota/scale.ts';
import {
  TrafficSim,
  capsuleDist,
  turning,
} from '../lib/games/rota/traffic-sim.ts';

/** Bot-built sheets, every map, with and without the extensions. */
function sheets() {
  const out = [];
  for (const map of MAP_IDS)
    for (const ext of [{}, { rivers: true, towns: true, rockfall: true }])
      for (const seed of [3, 11]) {
        let g = createRota(1, seed, {
          map,
          ext,
          difficulty: 'hard',
          bots: [true],
        });
        while (!g.over)
          for (const m of botRound(observe(g, 0), 0)) g = play(g, m, 0);
        out.push({
          map: maps[map],
          cells: g.seats[0].cells,
          name: `${map}/${seed}/${Object.keys(ext).length}`,
        });
      }
  return out;
}

const specs = {
  [ROAD]: [
    [{ model: 'car', length: 0.15, width: 0.072 }],
    [{ model: 'van', length: 0.18, width: 0.083 }],
    [{ model: 'lorry', length: 0.25, width: 0.1 }],
  ],
  [RAIL]: [
    [
      { model: 'loco', length: 0.3, width: 0.15 },
      { model: 'wagon', length: 0.25, width: 0.148 },
    ],
    [
      { model: 'loco', length: 0.3, width: 0.15 },
      { model: 'wagon', length: 0.25, width: 0.148 },
      { model: 'wagon', length: 0.25, width: 0.148 },
      { model: 'wagon', length: 0.25, width: 0.148 },
    ],
  ],
};

/** A seeded generator, so a failure replays. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the camera sees: the board and three squares round it, except
 *  inside a railway tunnel. */
function seen(map, kind, p) {
  const n = map.size;
  const out = Math.max(-p.x, -p.z, p.x - n, p.z - n);
  if (kind === RAIL && out > TUNNEL_AT + 0.02) return false;
  return out < 3;
}

await test('traffic runs every sheet without overlaps or vanishing in view', () => {
  let totalMoved = 0;
  for (const { map, cells, name } of sheets()) {
    const rand = rng(name.length * 97 + map.size);
    const sim = new TrafficSim({
      offscreen: (x, z) => !seen(map, ROAD, { x, z }),
      make: (kind, r, long) => {
        const list = specs[kind];
        return list[
          long && kind === RAIL
            ? 1
            : Math.floor(r() * (kind === RAIL ? 1 : list.length))
        ];
      },
      rand,
    });
    sim.setNetwork(network(map, cells), (cell) => stationHalf(cells[cell].p));
    const known = new Map();
    const dt = 1 / 30;
    for (let f = 0; f < 30 * 150; f++) {
      sim.tick(dt);
      const live = sim.movers.filter((m) => m.dying === undefined);
      for (const m of live) {
        for (let i = 1; i < m.steps.length; i++) {
          const a = m.steps[i - 1],
            b = m.steps[i];
          const pa = pointAt(a.edge.seg, a.dir === 1 ? 1 : 0);
          const pb = pointAt(b.edge.seg, b.dir === 1 ? 0 : 1);
          assert.ok(
            (pa.tx * pb.tx + pa.tz * pb.tz) * a.dir * b.dir > 0.999,
            `${name}: ${m.id} takes a switchback at a junction edge`,
          );
        }
        const last = known.get(m.id);
        if (last && m.kind === RAIL)
          sim.poses(m).forEach((p, i) => {
            const j = last.cars.indexOf(m.cars[i]);
            if (j < 0) return;
            for (const axle of ['front', 'back'])
              assert.ok(
                Math.hypot(
                  p[axle].x - last.poses[j][axle].x,
                  p[axle].z - last.poses[j][axle].z,
                ) < 0.025,
                `${name}: train ${m.id} jumps or swings when reversing`,
              );
          });
      }
      // Nothing overlaps.
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i],
            b = live[j];
          if (a.kind !== b.kind) continue;
          for (const ca of sim.footprint(a))
            for (const cb of sim.footprint(b)) {
              const d = capsuleDist(ca, cb);
              assert.ok(
                d > ca.r + cb.r - 0.012,
                `${name} t=${(f * dt).toFixed(1)} ${a.kind === RAIL ? 'trains' : 'cars'} ${a.id} and ${b.id} overlap by ${(ca.r + cb.r - d).toFixed(3)}`,
              );
            }
        }
      // Vehicles only appear and leave out of sight.
      const now = new Map(live.map((m) => [m.id, m]));
      for (const m of live)
        if (!known.has(m.id) && !m.resident)
          for (const p of sim.poses(m))
            assert.ok(
              !seen(map, m.kind, p.front),
              `${name} ${m.id} appeared in view`,
            );
      for (const [id, last] of known)
        if (!now.has(id) && !last.dying && !last.wasDying)
          for (const p of last.poses)
            assert.ok(
              !seen(map, last.kind, p.front),
              `${name} ${id} vanished in view`,
            );
      known.clear();
      for (const m of sim.movers)
        known.set(m.id, {
          kind: m.kind,
          poses: sim.poses(m),
          cars: [...m.cars],
          dying: m.dying !== undefined,
          wasDying: m.dying !== undefined,
        });
      for (const m of live) totalMoved += m.speed * dt;
    }
  }
  assert.ok(totalMoved > 500, `traffic hardly moved: ${totalMoved.toFixed(0)}`);
});

await test('nobody stays stuck for long', () => {
  for (const { map, cells, name } of sheets()) {
    const sim = new TrafficSim({
      offscreen: (x, z) => !seen(map, ROAD, { x, z }),
      make: (kind, r) => specs[kind][Math.floor(r() * specs[kind].length)],
      rand: rng(5),
    });
    sim.setNetwork(network(map, cells), (cell) => stationHalf(cells[cell].p));
    const still = new Map();
    const last = new Map();
    for (let f = 0; f < 30 * 120; f++) {
      sim.tick(1 / 30);
      const progressed = new Set();
      for (const m of sim.movers) {
        const poses = sim.poses(m);
        const p = poses[0].front;
        const prev = last.get(m.id);
        const moving = !prev || Math.hypot(p.x - prev.x, p.z - prev.z) > 0.0001;
        last.set(m.id, p);
        if (moving) progressed.add(m.id);
      }
      for (const m of sim.movers) {
        // A queue is making progress while its front car or the owner of
        // its next crossing moves. Waiting behind that traffic is natural;
        // a stopped queue, or endless turn retries, must still be detected.
        let ahead = m;
        const visited = new Set();
        while (ahead.waitingFor && !visited.has(ahead.id)) {
          visited.add(ahead.id);
          ahead = sim.movers.find((o) => o.id === ahead.waitingFor);
          if (!ahead || progressed.has(ahead.id)) break;
        }
        const moving =
          progressed.has(m.id) || (ahead && progressed.has(ahead.id));
        still.set(m.id, moving ? 0 : (still.get(m.id) ?? 0) + 1 / 30);
        assert.ok(
          still.get(m.id) < 25,
          `${name}: ${m.kind === RAIL ? 'train' : 'car'} ${m.id} stuck`,
        );
      }
    }
  }
});

await test('a station is a destination, never a way through', () => {
  const map = maps.meadow;
  const cells = Array(map.size * map.size).fill(null);
  const exit = map.exits.findIndex((e) => e.route === ROAD && e.dir === 0);
  const c = map.exits[exit].cell;
  // A street from the exit down into a grand station, and on out of it.
  cells[c] = { p: 'road-straight', o: 0, r: 1 };
  cells[c + map.size] = { p: 'station-cross', o: 0, r: 1 };
  cells[c + map.size * 2] = { p: 'road-straight', o: 0, r: 1 };
  const sim = new TrafficSim({
    offscreen: (x, z) => !seen(map, ROAD, { x, z }),
    make: () => specs[ROAD][1],
    rand: rng(9),
  });
  sim.setNetwork(network(map, cells), (cell) => stationHalf(cells[cell].p));
  const centre = cellCentre(map, c + map.size);
  let served = 0;
  for (let f = 0; f < 30 * 90; f++) {
    sim.tick(1 / 30);
    for (const m of sim.movers) {
      for (const p of sim.poses(m)) {
        // Nobody drives into the shed.
        const inside =
          Math.abs(p.front.x - centre.x) < 0.2 - 0.01 &&
          Math.abs(p.front.z - centre.z) < 0.2 - 0.01;
        assert.ok(!inside, 'a van drove into the goods shed');
      }
      if (m.turn && m.served?.startsWith('c:')) served++;
    }
  }
  assert.ok(served > 0, 'no van called at the station');
});

function fixture(entries, make = () => null, rand = rng(7)) {
  const map = { ...maps.meadow, exits: [] };
  const cells = Array(map.size ** 2).fill(null);
  for (const [cell, p, o = 0] of entries) cells[cell] = { p, o, r: 1 };
  const sim = new TrafficSim({ offscreen: () => true, make, rand });
  const net = network(map, cells);
  sim.setNetwork(net, (cell) => stationHalf(cells[cell].p));
  return { sim, net, map, cells };
}

function assertPoseClose(a, b, message) {
  for (const axle of ['front', 'back'])
    for (const axis of ['x', 'y', 'z'])
      assert.ok(Math.abs(a[axle][axis] - b[axle][axis]) < 1e-9, message);
}

function lineNet(kind, lengths) {
  let z = 0;
  const edges = lengths.map((length, i) => {
    const edge = {
      id: `${i}:line`,
      a: `n:${i}`,
      b: `n:${i + 1}`,
      length,
      seg: {
        kind,
        shape: { type: 'line', from: { x: 2, z }, dir: 2, length },
        at: { x: 0, z: 0 },
        lift: 'flat',
        junction: false,
        station: false,
      },
    };
    z += length;
    return edge;
  });
  const at = new Map();
  for (const e of edges)
    for (const n of [e.a, e.b]) at.set(n, [...(at.get(n) ?? []), e]);
  return { edges, at, gates: [] };
}

await test('forks and crosses never switch to an opposite tangent at a cut side', () => {
  for (const p of ['road-tee', 'road-cross', 'rail-tee', 'rail-cross'])
    for (const o of orientations(p)) {
      const { sim, net } = fixture([[24, p, o]]);
      for (const e of net.edges)
        for (const node of [e.a, e.b])
          assert.equal(
            sim.ways(node, e, e.seg.kind).length,
            0,
            `${p}/${o}/${node}`,
          );
      // Nor may a car's or train's trailing axles use that switchback.
      const edge = net.edges[0];
      const car = specs[edge.seg.kind][0];
      const m = sim.mover(edge.seg.kind, [...car], [{ edge, dir: 1 }], 0.1);
      assert.equal(sim.extendBack(m, 0.7), false);
      assert.equal(
        m.head,
        0.1,
        'extending a short trail moved the whole vehicle',
      );
      assert.equal(m.steps.length, 1);
    }
});

await test('a short cut fork branch is avoided while the through route still runs', () => {
  for (const kind of [ROAD, RAIL]) {
    const p = kind === ROAD ? 'road' : 'rail';
    const { sim, net } = fixture([
      [17, `${p}-straight`],
      [24, `${p}-tee`],
      [31, `${p}-straight`],
      [38, `${p}-straight`],
    ]);
    const entry = net.edges.find((e) => e.id.startsWith('17:'));
    const cars = kind === ROAD ? specs[ROAD][1] : specs[RAIL][1];
    const m = sim.mover(kind, [...cars], [{ edge: entry, dir: 1 }], 0.9);
    assert.equal(sim.ways(entry.b, entry, kind).length, 2);
    for (let i = 0; i < 60; i++) {
      const next = sim.choose(m, entry.b, entry);
      assert.ok(next, 'all traffic was excluded from the fork');
      assert.equal(
        next.edge.seg.shape.type,
        'straight',
        'traffic took the cut curve',
      );
    }
  }
});

await test('a queued car leaves the next junction for the car in front', () => {
  const { sim, net } = fixture([
    [17, 'road-straight'],
    [24, 'road-tee'],
    [31, 'road-straight'],
  ]);
  const entry = net.edges.find((e) => e.id.startsWith('17:'));
  const behind = sim.mover(
    ROAD,
    [...specs[ROAD][0]],
    [{ edge: entry, dir: 1 }],
    0.6,
  );
  const ahead = sim.mover(
    ROAD,
    [...specs[ROAD][0]],
    [{ edge: entry, dir: 1 }],
    0.9,
  );
  behind.resident = ahead.resident = true;
  behind.speed = ahead.speed = 0;
  // Deliberately advance the following car first.
  sim.movers.push(behind, ahead);
  sim.tick(1 / 30);
  assert.equal(
    behind.steps.length,
    1,
    'the following car reserved the next junction',
  );
  assert.ok(
    ahead.blocks.has('1:24'),
    'the leading car could not reserve the junction',
  );
});

await test('a car reserves a way out of touching junctions before entering them', () => {
  const { sim, net } = fixture([
    [17, 'road-straight'],
    [24, 'road-tee'],
    [31, 'road-tee'],
    [38, 'road-straight'],
  ]);
  const entry = net.edges.find((e) => e.id.startsWith('17:'));
  const second = net.edges.find(
    (e) => e.id.startsWith('31:') && e.seg.shape.type === 'straight',
  );
  const m = sim.mover(
    ROAD,
    [...specs[ROAD][0]],
    [{ edge: entry, dir: 1 }],
    0.8,
  );
  const blocked = sim.mover(
    ROAD,
    [...specs[ROAD][0]],
    [{ edge: second, dir: 1 }],
    0.5,
  );
  sim.claim(blocked, second);
  sim.advance(m, 1 / 30);
  assert.equal(
    m.steps.length,
    1,
    'a car entered a crossing whose way out was held',
  );
  assert.equal(
    m.blocks.size,
    0,
    'waiting for the second junction blocked the first',
  );
  sim.release(blocked);
  sim.advance(m, 1 / 30);
  assert.ok(m.blocks.has('1:24') && m.blocks.has('1:31'));
});

await test('a curved connector between two junctions stays clear until its way out is reserved', () => {
  const { sim, net } = fixture([
    [17, 'road-straight'],
    [24, 'road-tee'],
    [31, 'road-curve'],
    [32, 'road-cross'],
    [33, 'road-straight', 1],
  ]);
  const entry = net.edges.find((e) => e.id.startsWith('17:'));
  const far = net.edges.find((e) => e.id.startsWith('32:'));
  const m = sim.mover(
    ROAD,
    [...specs[ROAD][1]],
    [{ edge: entry, dir: 1 }],
    0.8,
  );
  const blocker = sim.mover(
    ROAD,
    [...specs[ROAD][0]],
    [{ edge: far, dir: 1 }],
    0.5,
  );
  sim.claim(blocker, far);
  sim.advance(m, 1 / 30);
  assert.equal(
    m.steps.length,
    1,
    'a car entered a curved corridor without a way out',
  );
  assert.equal(m.blocks.size, 0);
  sim.release(blocker);
  sim.advance(m, 1 / 30);
  for (const cell of [24, 31, 32])
    assert.ok(
      m.blocks.has(`1:${cell}`),
      `the corridor did not reserve cell ${cell}`,
    );
});

await test('short wharves are not mistaken for hidden road or railway exits', () => {
  for (const kind of [ROAD, RAIL]) {
    const net = lineNet(kind, [1, 1]);
    net.edges[1].exit = { index: 0, pier: true };
    net.edges[1].b = 'x:0';
    const sim = new TrafficSim({ offscreen: () => true, make: () => null });
    sim.setNetwork(net, () => 0);
    const m = sim.mover(
      kind,
      [...specs[kind][0]],
      [{ edge: net.edges[0], dir: 1 }],
      0.8,
    );
    assert.equal(sim.choose(m, net.edges[0].b, net.edges[0]), null);
  }
});

await test('a car turns on steering arcs wholly between the kerbs without a finish jump', () => {
  for (const car of [specs[ROAD][0][0], specs[ROAD][1][0]]) {
    const net = lineNet(ROAD, [4]);
    const sim = new TrafficSim({
      offscreen: () => true,
      make: () => null,
      rand: rng(8),
    });
    sim.setNetwork(net, () => 0);
    const m = sim.mover(ROAD, [car], [{ edge: net.edges[0], dir: 1 }], 2);
    const before = sim.poses(m)[0];
    assert.equal(sim.turnRound(m), true);
    assertPoseClose(sim.poses(m)[0], before, 'the turn jumped at its start');
    let prev;
    for (let i = 0; i <= 600; i++) {
      m.turn.t = i / 600;
      const p = turning(m.turn);
      for (const along of [-car.length / 2, car.length / 2])
        for (const side of [-car.width / 2, car.width / 2]) {
          const x = p.x - Math.sin(p.yaw) * along - Math.cos(p.yaw) * side;
          assert.ok(
            Math.abs(x - 2) < CARRIAGE_HALF,
            'a body corner swept beyond the kerb',
          );
        }
      if (
        prev &&
        Math.hypot(p.x - prev.x, p.z - prev.z) > 1e-8 &&
        p.reverse === prev.reverse
      ) {
        const dx = p.x - prev.x,
          dz = p.z - prev.z;
        const yaw = (p.yaw + prev.yaw) / 2;
        const sign = p.reverse ? -1 : 1;
        assert.ok(
          ((dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) * sign) /
            Math.hypot(dx, dz) >
            0.99999,
          'the car slid sideways while its heading turned independently',
        );
      }
      prev = p;
      assert.equal(sim.poses(m)[0].front.y, ROAD_TOP);
    }
    const end = sim.poses(m)[0];
    m.turn = undefined;
    assertPoseClose(
      sim.poses(m)[0],
      end,
      'the turn jumped into its departure lane',
    );
  }
});

await test('a lorry stays out of roads without enough room for its body to turn', () => {
  const net = lineNet(ROAD, [4]);
  const sim = new TrafficSim({
    offscreen: () => true,
    make: () => specs[ROAD][2],
    rand: rng(1),
  });
  sim.setNetwork(net, () => 0);
  const m = sim.mover(
    ROAD,
    specs[ROAD][2],
    [{ edge: net.edges[0], dir: 1 }],
    2,
  );
  assert.equal(sim.turnRound(m), false);
  sim.spawn();
  assert.equal(
    sim.movers.length,
    0,
    'a lorry spawned on a road it cannot leave',
  );
});

await test('a train keeps every physical axle and heading in place when the trail reverses', () => {
  const { sim, net } = fixture([
    [17, 'overpass', 1],
    [24, 'rail-curve'],
    [25, 'rail-straight', 1],
  ]);
  const a = net.edges.find(
    (e) => e.id.startsWith('17:') && e.seg.kind === RAIL,
  );
  const b = net.edges.find((e) => e.id.startsWith('24:'));
  const c = net.edges.find((e) => e.id.startsWith('25:'));
  const m = sim.mover(
    RAIL,
    [...specs[RAIL][1]],
    [
      { edge: a, dir: 1 },
      { edge: b, dir: 1 },
      { edge: c, dir: -1 },
    ],
    1.9,
  );
  const cars = [...m.cars];
  const before = sim.poses(m);
  sim.reverse(m);
  sim
    .poses(m)
    .forEach((p, i) =>
      assertPoseClose(
        p,
        before[cars.indexOf(m.cars[i])],
        'a train car moved or swung at reversal',
      ),
    );
  sim.reverse(m);
  sim
    .poses(m)
    .forEach((p, i) =>
      assertPoseClose(p, before[i], 'a second reversal shifted the train'),
    );
});

await test('a short resident railway receives only a consist whose axles fit real track', () => {
  const made = specs[RAIL][1];
  const sim = new TrafficSim({
    offscreen: () => true,
    make: () => made,
    rand: () => 0,
  });
  const net = lineNet(RAIL, [0.8, 0.8]);
  sim.setNetwork(net, () => 0);
  sim.spawn();
  assert.equal(sim.movers.length, 1);
  assert.equal(
    sim.movers[0].cars.length,
    1,
    'a long train was squeezed onto a short siding',
  );
  assert.equal(made.length, 4, 'the shared factory spec lost wagons');
  for (let f = 0; f < 30 * 90; f++) {
    sim.tick(1 / 30);
    for (const m of sim.movers)
      for (const p of sim.poses(m))
        assert.ok(
          Math.hypot(p.front.x - p.back.x, p.front.z - p.back.z) > 0.179,
          'two axles were clamped onto the same end of track',
        );
  }
});

await test('reduced motion parks routes and manoeuvres in place', () => {
  const net = lineNet(ROAD, [4]);
  const sim = new TrafficSim({
    offscreen: () => true,
    make: () => specs[ROAD][0],
    rand: rng(2),
  });
  sim.setNetwork(net, () => 0);
  const m = sim.mover(
    ROAD,
    [...specs[ROAD][0]],
    [{ edge: net.edges[0], dir: 1 }],
    2,
  );
  m.resident = true;
  sim.movers.push(m);
  assert.equal(sim.turnRound(m), true);
  m.turn.t = 0.4;
  const before = sim.poses(m)[0];
  sim.tick(5, false);
  assert.equal(sim.movers.length, 1);
  assert.equal(m.turn.t, 0.4);
  assertPoseClose(sim.poses(m)[0], before, 'a parked manoeuvre moved');
});
