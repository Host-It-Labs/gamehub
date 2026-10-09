import test from 'node:test';
import assert from 'node:assert/strict';
import { RAIL, ROAD } from '../lib/games/rota/pieces.ts';
import { maps } from '../lib/games/rota/maps.ts';
import { network, stationHalf } from '../lib/games/rota/routes.ts';
import { TrafficSim } from '../lib/games/rota/traffic-sim.ts';
import { Passengers, groundAt } from '../lib/games/rota/passengers.ts';
import {
  CARRIAGE_HALF,
  PLATFORM_EDGE,
  PLATFORM_OUT,
  STATION_LEVEL,
  STATION_STEPS,
} from '../lib/games/rota/scale.ts';

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

const railcar = { model: 'dmu_car', length: 0.34, width: 0.143 };

/** A street from the north edge and a railway from the south both run
 *  into the station on square 17. */
function station(seed, still = false) {
  const map = {
    ...maps.meadow,
    exits: [
      { cell: 3, dir: 0, route: ROAD },
      { cell: 45, dir: 2, route: RAIL },
    ],
  };
  const cells = Array(49).fill(null);
  for (const [c, p] of [
    [3, 'road-straight'],
    [10, 'road-straight'],
    [17, 'station-straight'],
    [24, 'rail-straight'],
    [31, 'rail-straight'],
    [38, 'rail-straight'],
    [45, 'rail-straight'],
  ])
    cells[c] = { p, o: 0, r: 1 };
  const net = network(map, cells);
  const sim = new TrafficSim({
    offscreen: (x, z) => z < -2.5 || z > 9.5,
    make: (kind) =>
      kind === ROAD
        ? [{ model: 'car_retro', length: 0.15, width: 0.066 }]
        : [railcar, { ...railcar, flip: true }],
    rand: rng(seed),
  });
  const pax = new Passengers(sim, { still });
  sim.onArrive((m) => pax.arrive(m));
  const half = (c) => stationHalf(cells[c].p);
  sim.setNetwork(net, half);
  pax.setNetwork(net, half);
  return { sim, pax };
}

/** Along and across a stub from its station's centre. */
const local = (s, x, z) => ({
  a: (x - s.x) * s.ux + (z - s.z) * s.uz,
  l: (x - s.x) * s.vx + (z - s.z) * s.vz,
});

await test('car passengers step out at the kerb, climb the steps and go in', () => {
  const { sim, pax } = station(3);
  const seen = new Map();
  for (let f = 0; f < 30 * 150; f++) {
    sim.tick(1 / 30);
    pax.tick(1 / 30);
    for (const w of pax.walkers) {
      if (w.stub.kind !== ROAD || !w.visible) continue;
      const r = seen.get(w.id) ?? {
        car: w.vehicle !== undefined && w.crouch > 0.5,
        pavement: false,
        bank: false,
        last: null,
        stub: w.stub,
      };
      const { a, l } = local(w.stub, w.x, w.z);
      if (a > w.stub.half + STATION_STEPS && Math.abs(l) > CARRIAGE_HALF + 0.01)
        r.pavement = true;
      if (a < w.stub.half) r.bank = true;
      const leg = w.legs[w.at];
      if (leg?.k === 'walk' && leg.y === undefined && w.at > 0)
        assert.ok(
          w.y > groundAt(w.stub, w.x, w.z) - 0.008,
          `passenger ${w.id} sank into the ground`,
        );
      r.last = { a, l };
      seen.set(w.id, r);
    }
  }
  const off = [...seen.entries()].filter(([, r]) => r.car);
  assert.ok(off.length >= 3, `only ${off.length} passengers got out of cars`);
  const gone = new Set(pax.walkers.map((w) => w.id));
  let through = 0;
  for (const [id, r] of off) {
    if (gone.has(id)) continue;
    assert.ok(r.pavement, `passenger ${id} never stepped up onto the pavement`);
    assert.ok(r.bank, `passenger ${id} went in without climbing the steps`);
    assert.ok(
      Math.abs(r.last.a - r.stub.hall) < 0.05 && Math.abs(r.last.l) < 0.04,
      `passenger ${id} vanished away from the station door`,
    );
    through++;
  }
  assert.ok(through >= 2, 'no car passenger made it into the station');
});

await test('railcar passengers step down onto the platforms; those waiting are aboard before it leaves', () => {
  const { sim, pax } = station(5);
  let calls = 0,
    alighted = 0;
  const boarding = new Map();
  for (let f = 0; f < 30 * 200; f++) {
    sim.tick(1 / 30);
    pax.tick(1 / 30);
    for (const m of sim.movers) {
      if (m.kind !== RAIL) continue;
      if (m.call && m.wait > 0) {
        if (!boarding.has(m.id)) calls++;
        boarding.set(m.id, true);
      } else if (boarding.has(m.id) && m.speed > 0.01) {
        // Under way: everyone who was getting in is in.
        const left = pax.walkers.filter(
          (w) => w.vehicle === m.id && w.boarding && !w.done,
        );
        assert.equal(
          left.length,
          0,
          `train ${m.id} left people on the platform`,
        );
        boarding.delete(m.id);
      }
    }
    for (const w of pax.walkers) {
      if (w.stub.kind !== RAIL || !w.visible) continue;
      const leg = w.legs[w.at];
      const { a, l } = local(w.stub, w.x, w.z);
      if (
        leg?.k === 'walk' &&
        leg.y === undefined &&
        a > w.stub.half + 0.01 &&
        w.y > STATION_LEVEL - 0.004
      ) {
        alighted++;
        assert.ok(
          Math.abs(l) > PLATFORM_EDGE - 0.002 && Math.abs(l) < PLATFORM_OUT,
          `passenger ${w.id} walked off the platform (across ${l.toFixed(3)})`,
        );
      }
    }
  }
  assert.ok(calls >= 2, `the railcar called only ${calls} times`);
  assert.ok(alighted > 0, 'nobody walked along the platforms');
});

await test('a car stands until its passengers are clear of its doors', () => {
  const { sim, pax } = station(11);
  let turns = 0;
  const was = new Map();
  for (let f = 0; f < 30 * 150; f++) {
    sim.tick(1 / 30);
    pax.tick(1 / 30);
    for (const m of sim.movers) {
      if (m.kind !== ROAD) continue;
      const turning = !!m.turn;
      if (turning && !was.get(m.id)) {
        turns++;
        for (const w of pax.walkers)
          if (w.vehicle === m.id)
            assert.ok(
              w.done || (w.legs[w.at]?.k !== 'duck' && w.at > 1),
              `car ${m.id} drove off with someone at its door`,
            );
      }
      was.set(m.id, turning);
    }
  }
  assert.ok(turns >= 3, `only ${turns} cars turned round at the station`);
});

await test('reduced motion: nobody appears and traffic keeps its usual stops', () => {
  const { sim, pax } = station(7, true);
  for (let f = 0; f < 30 * 60; f++) {
    sim.tick(1 / 30);
    pax.tick(1 / 30);
  }
  assert.equal(pax.walkers.length, 0);
});
