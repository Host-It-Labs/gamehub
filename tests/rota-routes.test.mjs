import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIECE_IDS,
  RAIL,
  RIVER,
  ROAD,
  orient,
  orientations,
} from '../lib/games/rota/pieces.ts';
import { maps } from '../lib/games/rota/maps.ts';
import { emptyCells } from '../lib/games/rota/board.ts';
import {
  across,
  cellCentre,
  exitSegments,
  liftAt,
  network,
  pieceSegments,
  pointAt,
  segLength,
} from '../lib/games/rota/routes.ts';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const MID = [
  [0, -0.5],
  [0.5, 0],
  [0, 0.5],
  [-0.5, 0],
];

await test('every piece draws its sides: each route side is an end of a segment', () => {
  for (const p of PIECE_IDS)
    for (const o of orientations(p)) {
      const t = orient(p, o);
      const segs = pieceSegments(p, o, { x: 0, z: 0 });
      t.edges.forEach((kind, d) => {
        if (!kind) return;
        const ends = segs
          .filter((s) => s.kind === kind)
          .flatMap((s) => [pointAt(s, 0), pointAt(s, 1)]);
        assert.ok(
          ends.some((e) => close(e.x, MID[d][0]) && close(e.z, MID[d][1])),
          `${p}/${o} side ${d}`,
        );
      });
    }
});

await test('paths are continuous, with unit tangents along the way of travel', () => {
  for (const p of PIECE_IDS)
    for (const s of pieceSegments(p, 0, { x: 3.5, z: 2.5 })) {
      const len = segLength(s.shape);
      let prev = pointAt(s, 0);
      for (let i = 1; i <= 40; i++) {
        const q = pointAt(s, i / 40);
        assert.ok(close(Math.hypot(q.tx, q.tz), 1, 1e-6));
        const step = Math.hypot(q.x - prev.x, q.z - prev.z);
        assert.ok(close(step, len / 40, 1e-3), `${p} ${s.shape.type}`);
        // The tangent points the way the path goes.
        assert.ok((q.x - prev.x) * q.tx + (q.z - prev.z) * q.tz > 0);
        prev = q;
      }
    }
});

await test('decks rise over the route below and meet the ground at the sides', () => {
  const segs = pieceSegments('overpass', 0, { x: 0, z: 0 });
  const road = segs.find((s) => s.kind === ROAD);
  const rail = segs.find((s) => s.kind === RAIL);
  assert.equal(road.lift, 'overpass');
  assert.equal(rail.lift, 'cutting');
  assert.equal(liftAt(road.lift, 0), 0);
  assert.equal(liftAt(rail.lift, 1), 0);
  // A level deck over the cutting, its underside (road top 0.012, deck
  // 0.025 thick) clear of the tallest engine (0.216 over its root).
  assert.equal(liftAt(road.lift, 0.4), liftAt(road.lift, 0.6));
  assert.ok(
    liftAt(road.lift, 0.5) + 0.012 - 0.025 - (liftAt(rail.lift, 0.5) + 0.216) >
      0.015,
  );
  const bridge = pieceSegments('rail-bridge', 0, { x: 0, z: 0 });
  assert.equal(bridge.find((s) => s.kind === RAIL).lift, 'bridge');
  assert.equal(bridge.find((s) => s.kind === RIVER).lift, 'flat');
});

await test('stations end their routes at the building in the middle', () => {
  const segs = pieceSegments('station-cross', 0, { x: 0, z: 0 });
  assert.equal(segs.length, 4);
  for (const s of segs) {
    assert.equal(s.shape.type, 'stub');
    assert.ok(s.station);
  }
});

await test('the network joins neighbours and reaches the exits', () => {
  const map = maps.meadow;
  const cells = emptyCells(map);
  // Meadow's top-left exit is a road leaving square B1 northwards.
  const exit = map.exits.findIndex((e) => e.route === ROAD && e.dir === 0);
  const c = map.exits[exit].cell;
  cells[c] = { p: 'road-straight', o: 0, r: 1 };
  cells[c + map.size] = { p: 'road-straight', o: 0, r: 1 };
  const net = network(map, cells);
  const board = net.edges.filter((e) => !e.exit);
  assert.equal(board.length, 2);
  // The two squares share the node between them.
  const shared = [board[0].a, board[0].b].filter((k) =>
    [board[1].a, board[1].b].includes(k),
  );
  assert.equal(shared.length, 1);
  // That exit's run is a gate into the network; the others lead nowhere.
  assert.ok(net.gates.some((g) => g.edge.exit.index === exit));
  assert.equal(net.gates.length, 1);
  const gate = net.gates[0];
  assert.equal(across(gate.edge, gate.node), gate.edge.a);
});

await test('exit runs leave the board straight out from their side', () => {
  for (const map of Object.values(maps)) {
    const runs = exitSegments(map);
    map.exits.forEach((e, i) => {
      const start = pointAt(runs[i], 0),
        end = pointAt(runs[i], 1);
      const c = cellCentre(map, e.cell);
      assert.ok(close(Math.hypot(start.x - c.x, start.z - c.z), 0.5));
      if (e.pier) {
        // A pier reaches across the sea square beyond it.
        const sq =
          Math.floor(end.z - 0.01 * Math.sign(end.z - start.z)) * map.size +
          Math.floor(end.x - 0.01 * Math.sign(end.x - start.x));
        assert.ok(map.sea.includes(sq), `${map.id} pier ${i}`);
      } else {
        const out = Math.max(
          -end.x,
          -end.z,
          end.x - map.size,
          end.z - map.size,
        );
        // Streets run out of the frame; rails into their tunnel.
        assert.ok(out > (e.route === ROAD ? 5 : 3), `${map.id} exit ${i}`);
      }
    });
  }
});
