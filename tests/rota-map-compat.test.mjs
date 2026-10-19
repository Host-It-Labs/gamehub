import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.ts';
import { RotaRooms } from '../server/rota.ts';
import { botRound } from '../lib/games/rota/bot.ts';
import { canPlace } from '../lib/games/rota/board.ts';
import {
  createRota,
  isRotaGame,
  mapOf,
  noExtensions,
  observe,
  play,
  sheetOf,
  validMove,
} from '../lib/games/rota/engine.ts';

/** A persisted first-round state from before maps had a version field.
 * Keep its dimensions and duration independent of the current definitions. */
function legacySave(map, rockfall = false) {
  const capital = map === 'capital';
  const dice = ['road-straight', 'rail-straight', 'road-curve', 'station-straight'];
  return {
    kind: 'rota', version: 1, rules: 1, revision: 0, rngState: 101,
    difficulty: 'easy', map,
    ext: { ...noExtensions, rockfall },
    round: 1, rounds: capital ? 8 : 7,
    dice, rolls: [dice], towns: [], plans: [], strikes: [-1],
    seats: [{
      name: 'Ann', bot: false, cells: Array(capital ? 64 : 49).fill(null),
      draft: [], specials: [], rubble: [], plans: [], locked: false,
    }],
    over: false, final: null, log: [{ id: 0, text: `Round 1 of ${capital ? 8 : 7}` }],
  };
}

function finish(g) {
  const rounds = g.rounds;
  for (let i = 0; i < rounds && !g.over; i++) {
    for (const move of botRound(g, 0)) {
      assert.ok(validMove(g, move, 0), `${g.map}: ${JSON.stringify(move)}`);
      g = play(g, move, 0);
    }
    assert.ok(isRotaGame(JSON.parse(JSON.stringify(g))), `${g.map} remains resumable`);
  }
  assert.ok(g.over, `${g.map} finishes after its saved number of rounds`);
  return g;
}

await test('unversioned saves retain their original dimensions, terrain and duration', () => {
  for (const map of ['meadow', 'harbour', 'ridge', 'capital']) {
    const g = JSON.parse(JSON.stringify(legacySave(map)));
    assert.ok(isRotaGame(g), `${map} remains readable`);
    const m = mapOf(g);
    assert.equal(m.size, map === 'capital' ? 8 : 7);
    assert.equal(m.rounds, map === 'capital' ? 8 : 7);
    assert.equal(sheetOf(g, 0).cells.length, m.size ** 2);
    assert.equal(observe(g, 0).mapVersion, undefined);
    assert.equal(mapOf(observe(g, 0)), m);
  }
  const harbour = legacySave('harbour');
  assert.deepEqual(mapOf(harbour).sea, [34, 41, 48, 40, 47, 46]);
  assert.ok(validMove(harbour, { type: 'place', die: 0, cell: 33, o: 1 }, 0),
    'the original road pier at (5,4) still accepts a route');
  const ridge = legacySave('ridge');
  assert.deepEqual(mapOf(ridge).peaks, [15, 9, 39, 33]);
  ridge.seats[0].cells[14] = { p: 'road-straight', o: 1, r: 1 };
  assert.ok(canPlace(sheetOf(ridge, 0), 'road-straight', 1, 15));
  assert.ok(!canPlace(sheetOf(ridge, 0), 'road-tee', 1, 15),
    'the original peak cell still requires a straight tunnel');
});

await test('save validation rejects a mismatched or unknown map version', () => {
  for (const map of ['harbour', 'ridge']) {
    const current = createRota(1, 101, { map });
    assert.equal(current.mapVersion, 2);
    assert.ok(isRotaGame(JSON.parse(JSON.stringify(current))));
    const missingVersion = structuredClone(current);
    delete missingVersion.mapVersion;
    assert.ok(!isRotaGame(missingVersion), `${map} cannot reinterpret a larger board as legacy`);
    assert.ok(!isRotaGame({ ...legacySave(map), mapVersion: 2 }),
      `${map} cannot reinterpret legacy cell indices as current`);
    for (const mapVersion of [null, 1, 3, '2'])
      assert.ok(!isRotaGame({ ...current, mapVersion }), `${map}: ${mapVersion}`);
  }
  assert.ok(!isRotaGame({ ...legacySave('capital'), mapVersion: 2 }));
});

await test('legacy maps finish and Rockfall keeps the original cell coordinates', () => {
  for (const map of ['meadow', 'harbour', 'ridge', 'capital']) {
    const g = finish(legacySave(map, true));
    const m = mapOf(g);
    assert.equal(g.mapVersion, undefined);
    assert.equal(g.rolls.length, map === 'capital' ? 8 : 7);
    assert.equal(g.strikes.length, g.rounds);
    for (const cell of g.strikes.filter((c) => c >= 0)) {
      assert.ok(cell < m.size ** 2);
      assert.ok(!m.sea.includes(cell) && !m.peaks.includes(cell));
      assert.ok(!m.exits.some((e) => e.cell === cell));
    }
    assert.ok(Number.isFinite(g.final[0].total));
  }
});

await test('online launch excludes Capital and rematches migrate old rooms to current maps', () => {
  const db = openDatabase(':memory:');
  try {
    const rooms = new RotaRooms(db, { inline: true });
    const person = { id: 'ann', name: 'Ann', userId: null, sessionHash: '', expires: 0 };
    const setup = { map: 'meadow', ext: { ...noExtensions }, difficulty: 'easy', seats: 1 };
    assert.throws(
      () => rooms.launch(null, person.id, [person], { ...setup, map: 'capital' }),
      /Choose a map/,
    );
    for (const map of ['harbour', 'ridge', 'capital']) {
      const token = rooms.launch(null, person.id, [person], setup);
      const row = db.prepare('SELECT state FROM rota_rooms WHERE token=?').get(token);
      const state = JSON.parse(row.state);
      state.game = legacySave(map);
      state.setup.map = map;
      db.prepare('UPDATE rota_rooms SET state=? WHERE token=?').run(JSON.stringify(state), token);
      const resumed = new RotaRooms(db, { inline: true }).get(token, person);
      assert.equal(resumed.game.map, map);
      assert.equal(resumed.game.rounds, map === 'capital' ? 8 : 7);
      assert.equal(resumed.game.seats[0].cells.length, map === 'capital' ? 64 : 49);
      state.game = finish(state.game);
      db.prepare('UPDATE rota_rooms SET state=? WHERE token=?').run(JSON.stringify(state), token);
      const next = rooms.again(token, person).game;
      assert.equal(next.mapVersion, 2);
      assert.equal(next.map, map === 'capital' ? 'meadow' : map);
      assert.equal(next.rounds, map === 'harbour' ? 10 : map === 'ridge' ? 14 : 7);
      assert.ok(isRotaGame(next));
    }
  } finally {
    db.close();
  }
});
