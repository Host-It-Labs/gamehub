import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RAIL,
  RIVER,
  ROAD,
  SPECIALS,
  orient,
  orientations,
  pieces,
} from '../lib/games/rota/pieces.ts';
import { MAP_IDS, maps } from '../lib/games/rota/maps.ts';
import {
  canPlace,
  emptyCells,
  longest,
  looseEnds,
  networks,
  quickLongest,
  sheet,
} from '../lib/games/rota/board.ts';
import {
  RIVER_POINTS,
  OUTLET_POINTS,
  TUNNEL_POINTS,
  exitPoints,
  hasLoop,
  plans,
  score,
  scoreParts,
} from '../lib/games/rota/score.ts';
import {
  EXTENSIONS,
  actingSeats,
  canFinish,
  createRota,
  isRotaGame,
  observe,
  outcome,
  owed,
  planPoints,
  play,
  specialsLeft,
  scoreSeat,
  sheetOf,
  validMove,
} from '../lib/games/rota/engine.ts';
import { botRound } from '../lib/games/rota/bot.ts';

const meadow = maps.meadow;
const at = (x, y, size = 7) => y * size + x;
/** A sheet from a list of [x, y, piece, orientation]. */
function build(map, list, rubble = [], towns = []) {
  const cells = emptyCells(map);
  for (const [x, y, p, o] of list) cells[at(x, y, map.size)] = { p, o, r: 1 };
  return sheet(map, cells, rubble, towns);
}
/** Plays every seat's round with the bots until the match ends. */
function finish(g) {
  let guard = 0;
  while (!g.over) {
    assert.ok(guard++ < 400, 'match never ended');
    for (const s of actingSeats(g))
      for (const m of botRound(g, s)) {
        assert.ok(validMove(g, m, s), `bot move refused: ${JSON.stringify(m)}`);
        g = play(g, m, s);
      }
  }
  return g;
}

await test('pieces turn and flip into their distinct orientations', () => {
  assert.equal(orientations('road-straight').length, 2);
  assert.equal(orientations('road-curve').length, 4);
  assert.equal(orientations('road-tee').length, 4);
  assert.equal(orientations('road-cross').length, 1);
  assert.equal(orientations('overpass').length, 2);
  // A corner station flips into a mirror image that no turn reaches.
  assert.equal(orientations('station-curve').length, 8);
  assert.equal(orientations('station-straight').length, 4);
  assert.deepEqual(orient('road-curve', 1).edges, [0, ROAD, ROAD, 0]);
  assert.deepEqual(orient('station-curve', 4).edges, [ROAD, 0, 0, RAIL]);
  for (const p of SPECIALS) assert.equal(pieces[p].group, 'special');
  assert.ok(pieces.overpass.junction && pieces['station-curve'].station);
  assert.ok(!pieces.overpass.station && !pieces['road-cross'].junction);
});

await test('every map has twelve or sixteen exits on free edges and one centre', () => {
  for (const id of MAP_IDS) {
    const m = maps[id];
    assert.equal(m.exits.length, m.size === 8 ? 16 : 12, id);
    const seen = new Set();
    for (const e of m.exits) {
      const key = `${e.cell}:${e.dir}`;
      assert.ok(!seen.has(key), `${id} repeats an exit`);
      seen.add(key);
      assert.ok(!m.sea.includes(e.cell) && !m.peaks.includes(e.cell), id);
      const x = (e.cell % m.size) + [0, 1, 0, -1][e.dir],
        y = Math.floor(e.cell / m.size) + [-1, 0, 1, 0][e.dir];
      const outside = x < 0 || y < 0 || x >= m.size || y >= m.size;
      assert.ok(outside || (e.pier && m.sea.includes(y * m.size + x)), id);
    }
    const roads = m.exits.filter((e) => e.route === ROAD).length;
    assert.equal(
      roads,
      m.exits.length / 2,
      `${id} balances road and rail exits`,
    );
    assert.ok(m.centre.length >= 9);
  }
});

await test('a piece must join an exit or a matching route and never clash', () => {
  const empty = build(meadow, []);
  // The top exit at x=1 is a road: a road straight joins it, a rail cannot.
  assert.ok(canPlace(empty, 'road-straight', 0, at(1, 0)));
  assert.ok(!canPlace(empty, 'rail-straight', 0, at(1, 0)));
  // Floating in the middle joins nothing.
  assert.ok(!canPlace(empty, 'road-straight', 0, at(3, 3)));
  const one = build(meadow, [[1, 0, 'road-straight', 0]]);
  assert.ok(canPlace(one, 'road-straight', 0, at(1, 1)));
  // A rail facing the road below it clashes.
  assert.ok(!canPlace(one, 'rail-straight', 0, at(1, 1)));
  // A station turns the road into a rail.
  assert.ok(canPlace(one, 'station-straight', 0, at(1, 1)));
  // Occupied squares take nothing.
  assert.ok(!canPlace(one, 'road-straight', 0, at(1, 0)));
});

await test('sea, rubble, peaks and towns limit where pieces go', () => {
  const harbour = sheet(maps.harbour, emptyCells(maps.harbour));
  for (const c of maps.harbour.sea)
    assert.ok(!canPlace(harbour, 'road-cross', 0, c));
  // Piers are exits into the sea.
  const pier = maps.harbour.exits.find((e) => e.pier && e.route === ROAD);
  assert.ok(canPlace(harbour, 'road-straight', 1, pier.cell));
  const ridge = maps.ridge;
  const peak = ridge.peaks[0];
  const around = build(ridge, [[0, 2, 'road-straight', 1]]);
  // (1,2) is a peak next to the left exit: only a straight may go there.
  assert.equal(peak, at(1, 2));
  assert.ok(canPlace(around, 'road-straight', 1, peak));
  assert.ok(!canPlace(around, 'road-tee', 1, peak));
  const rubble = build(meadow, [], [at(1, 0)]);
  assert.ok(!canPlace(rubble, 'road-straight', 0, at(1, 0)));
  const town = build(meadow, [[1, 0, 'road-straight', 0]], [], [at(1, 1)]);
  assert.ok(!canPlace(town, 'road-straight', 0, at(1, 1)));
  assert.ok(canPlace(town, 'station-straight', 0, at(1, 1)));
  assert.ok(canPlace(town, 'overpass', 0, at(1, 1)));
});

await test('rivers start at the edge, never clash with roads and leave no loose ends', () => {
  const empty = build(meadow, []);
  // A river may flow in from any edge that is not an exit.
  assert.ok(canPlace(empty, 'river-straight', 0, at(0, 0)));
  assert.ok(!canPlace(empty, 'river-straight', 1, at(3, 3)));
  // The road exit at (1,0) north refuses a river.
  assert.ok(!canPlace(empty, 'river-straight', 0, at(1, 0)));
  const s = build(meadow, [
    [0, 0, 'river-straight', 0],
    [0, 1, 'river-straight', 0],
  ]);
  assert.equal(looseEnds(s).length, 0);
  const river = longest(s, RIVER);
  assert.equal(river.length, 2);
  assert.ok(!river.outlet);
  const across = build(
    meadow,
    Array.from({ length: 7 }, (_, y) => [0, y, 'river-straight', 0]),
  );
  const full = longest(across, RIVER);
  assert.equal(full.length, 7);
  assert.ok(full.outlet);
  assert.equal(score(across, { rivers: true }).river, 7 * 2 + 3);
});

await test('networks: overpasses keep crossings apart, stations join them', () => {
  // Road from the top exit (1,0) down to (1,2); a rail crosses (1,1).
  const over = build(meadow, [
    [1, 0, 'road-straight', 0],
    [1, 1, 'overpass', 0],
    [0, 1, 'rail-straight', 1],
    [2, 1, 'rail-straight', 1],
  ]);
  assert.equal(networks(over).length, 2);
  const station = build(meadow, [
    [1, 0, 'road-straight', 0],
    [1, 1, 'station-straight', 0],
  ]);
  assert.equal(networks(station).length, 1);
  assert.equal(exitPoints(0, 12), 0);
  assert.equal(exitPoints(1, 12), 0);
  assert.equal(exitPoints(2, 12), 4);
  assert.equal(exitPoints(3, 12), 8);
  assert.equal(exitPoints(12, 12), 48);
});

await test('scoring counts exits, longest routes, centre and loose ends', () => {
  // Top road exit (1,0) to the left rail exit (0,5) via a station: 2 exits.
  const s = build(meadow, [
    [1, 0, 'road-straight', 0],
    [1, 1, 'road-straight', 0],
    [1, 2, 'road-straight', 0],
    [1, 3, 'road-straight', 0],
    [1, 4, 'station-straight', 0],
    [1, 5, 'rail-curve', 3],
    [0, 5, 'rail-straight', 1],
  ]);
  const nets = networks(s);
  assert.equal(nets.length, 1);
  assert.equal(nets[0].exits.length, 2);
  assert.equal(looseEnds(s).length, 0);
  const b = score(s);
  assert.equal(b.exits, 4);
  assert.equal(b.road, 5);
  assert.equal(b.rail, 3);
  assert.equal(b.centre, 0);
  assert.equal(b.errors, 0);
  assert.equal(b.total, 4 + 5 + 3);
  // A spur off the road into open ground is a loose end.
  const spur = build(meadow, [
    [1, 0, 'road-tee', 0],
    [1, 1, 'road-straight', 0],
  ]);
  assert.equal(looseEnds(spur).length, 2);
  assert.equal(score(spur).errors, -2);
  assert.equal(quickLongest(s, ROAD), 5);
});

await test('a loop and the longest path around it', () => {
  const ring = build(meadow, [
    [2, 2, 'road-curve', 1],
    [3, 2, 'road-curve', 2],
    [3, 3, 'road-curve', 3],
    [2, 3, 'road-curve', 0],
  ]);
  assert.ok(hasLoop(ring));
  assert.equal(longest(ring, ROAD).length, 4);
  assert.equal(looseEnds(ring).length, 0);
  assert.equal(score(ring).centre, 4);
});

await test('plans score more for the first round anyone completes them', () => {
  let g = createRota(2, 11, { ext: { plans: true }, bots: [true, true] });
  assert.equal(g.plans.length, 3);
  g.seats[0].plans = [2, 0, 5];
  g.seats[1].plans = [3, 0, 5];
  const [a, , c] = g.plans.map((id) => plans[id]);
  assert.equal(planPoints(g, 0), a.first + c.first);
  assert.equal(planPoints(g, 1), a.later + c.first);
  g = finish(g);
  assert.ok(g.final.every((b, i) => b.plans === planPoints(g, i)));
});

await test('a round needs every placeable die and allows one special', () => {
  let g = createRota(1, 5, { bots: [false] });
  assert.ok(!canFinish(g, 0));
  assert.ok(!validMove(g, { type: 'done' }, 0));
  assert.equal(specialsLeft(g, 0).length, 6);
  const moves = botRound({ ...g, difficulty: 'hard' }, 0);
  for (const m of moves.slice(0, -1)) g = play(g, m, 0);
  assert.equal(owed(g, 0).length, 0);
  // Undo and turn only reach this round's pieces.
  const before = g.seats[0].draft.length;
  g = play(g, { type: 'undo' }, 0);
  assert.equal(g.seats[0].draft.length, before - 1);
  g = play(g, moves[before - 1], 0);
  g = play(g, { type: 'done' }, 0);
  assert.equal(g.round, 2);
  assert.equal(g.seats[0].draft.length, 0);
  assert.ok(!validMove(g, { type: 'undo' }, 0));
});

await test('specials: one a round, three a match, each once', () => {
  const g = createRota(1, 3, {});
  g.seats[0].specials = [{ p: 'road-cross', r: 1 }];
  assert.equal(specialsLeft(g, 0).length, 0, 'one a round');
  g.round = 2;
  assert.deepEqual(specialsLeft(g, 0), SPECIALS.slice(1));
  g.seats[0].specials.push(
    { p: 'rail-cross', r: 2 },
    { p: 'station-cross', r: 3 },
  );
  g.round = 4;
  assert.equal(specialsLeft(g, 0).length, 0, 'three a match');
});

await test('others see only locked-in rounds', () => {
  let g = createRota(2, 9, { bots: [false, true] });
  const moves = botRound(g, 1);
  g = play(g, moves[0], 1);
  const seen = observe(g, 0);
  assert.equal(seen.rngState, 0);
  assert.equal(seen.seats[1].cells.filter(Boolean).length, 0);
  assert.equal(seen.seats[1].hidden, 1);
  assert.equal(observe(g, 1).seats[1].cells.filter(Boolean).length, 1);
});

await test('rockfall leaves rubble on empty squares only', () => {
  let g = createRota(1, 21, {
    ext: { rockfall: true },
    bots: [true],
    difficulty: 'hard',
  });
  for (const m of botRound(g, 0)) g = play(g, m, 0);
  assert.equal(g.strikes[0], -1, 'no rockfall in the first round');
  const strike = g.strikes[1];
  assert.ok(strike >= 0);
  const filled = !!g.seats[0].cells[strike];
  for (const m of botRound(g, 0)) {
    g = play(g, m, 0);
  }
  const hasRubble = g.seats[0].rubble.includes(strike);
  assert.equal(hasRubble, !g.seats[0].cells[strike]);
  void filled;
});

await test('bots finish every map and extension with valid moves', () => {
  for (const map of MAP_IDS)
    for (const ext of [
      {},
      Object.fromEntries(EXTENSIONS.map((e) => [e, true])),
    ]) {
      let g = createRota(3, 101, {
        map,
        ext,
        difficulty: 'medium',
        bots: [true, true, true],
      });
      g = finish(g);
      assert.equal(g.final.length, 3);
      const o = outcome(g);
      assert.ok(o.winners.length >= 1);
      assert.ok(
        isRotaGame(JSON.parse(JSON.stringify(g))),
        `${map} survives a save`,
      );
    }
});

await test('the points panel workings add up to the score', () => {
  for (const map of MAP_IDS) {
    const ext = Object.fromEntries(EXTENSIONS.map((e) => [e, true]));
    const g = finish(
      createRota(2, 202, {
        map,
        ext,
        difficulty: 'medium',
        bots: [true, true],
      }),
    );
    for (const seat of [0, 1]) {
      const b = scoreSeat(g, seat);
      const p = scoreParts(sheetOf(g, seat), { rivers: true, towns: g.towns });
      assert.equal(
        p.networks.reduce((a, n) => a + n.points, 0),
        b.exits,
        `${map} exits`,
      );
      assert.equal(p.road, b.road);
      assert.equal(p.rail, b.rail);
      assert.equal(p.centre.built, b.centre);
      assert.equal(p.tunnels * TUNNEL_POINTS, b.tunnels);
      assert.equal(
        p.river.length * RIVER_POINTS + (p.river.outlet ? OUTLET_POINTS : 0),
        b.river,
      );
      assert.equal(
        p.towns.reduce((a, t) => a + t.points, 0),
        b.towns,
      );
      assert.equal(-p.loose, b.errors);
    }
  }
});

await test('the same seed rolls the same match', () => {
  const a = finish(createRota(2, 77, { map: 'ridge', bots: [true, true] }));
  const b = finish(createRota(2, 77, { map: 'ridge', bots: [true, true] }));
  assert.deepEqual(a.rolls, b.rolls);
  assert.deepEqual(a.final, b.final);
});

await test('saved states are checked before they are trusted', () => {
  const g = createRota(2, 1, {});
  assert.ok(isRotaGame(g));
  assert.ok(!isRotaGame({ ...g, map: 'moon' }));
  assert.ok(!isRotaGame({ ...g, version: 2 }));
  assert.ok(!isRotaGame({ ...g, dice: ['road-straight'] }));
  assert.ok(!isRotaGame(null));
});

await test('the Rota box has its square cover, spine, sizes and wide lid', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const { boxCover, wideCover } = await import('../lib/games/box-covers.ts');
  const manifest = JSON.parse(
    readFileSync('lib/artwork-previews.json', 'utf8'),
  );
  const cover = boxCover('rota');
  const lid = wideCover('rota');
  for (const path of [
    cover,
    cover.replace('.webp', '-spine.webp'),
    cover.replace('.webp', '-320.webp'),
    cover.replace('.webp', '-640.webp'),
    lid,
    lid.replace('.webp', '-768.webp'),
  ])
    assert.ok(existsSync(`public${path}`), path);
  assert.ok(manifest[cover]?.srcSet && manifest[lid]?.srcSet);
});
