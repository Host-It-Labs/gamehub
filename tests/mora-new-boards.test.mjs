import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zoneScore,
  habitatsFor,
  sanctuaryGoalsFor,
  sanctuaryGoalProgress,
  totalRounds,
  supplyPerKind,
  createGame,
  isSavedGame,
  dice,
} from '../lib/games/trio/engine.ts';

let id = 0;
const board = (areas) =>
  Array.from({ length: 7 }, (_, z) =>
    (areas[z] ?? []).map((kind) => ({ id: id++, kind, rank: 0 })),
  );

await test('Sunset Motel scoring', () => {
  const s = (areas, zone) => zoneScore(board(areas), zone, 'desert');
  // Pool: biggest group 3 each, the rest 1 each.
  assert.equal(s({ 0: [0, 0, 0, 1, 2] }, 0), 3 * 3 + 2);
  // Rooms: at most two species.
  assert.equal(s({ 1: [0, 0, 1, 1] }, 1), 12);
  assert.equal(s({ 1: [0, 0, 0] }, 1), 9);
  assert.equal(s({ 1: [0, 1, 2] }, 1), 0);
  // Garage looks at the Road; the Sign looks at the Pool.
  assert.equal(s({ 2: [0, 1, 2], 3: [0, 2] }, 2), 4 + 1 + 4);
  assert.equal(s({ 6: [3, 4], 0: [3] }, 6), 4 + 1);
  // Road: in order, 1 each or 3 when it matches the one before.
  assert.equal(s({ 3: [0, 0, 1, 1, 1] }, 3), 1 + 3 + 1 + 3 + 3);
  // Diner: a creature with no match here.
  assert.equal(s({ 4: [0, 1, 1, 2] }, 4), 6);
  // Release never scores or counts.
  assert.equal(s({ 5: [0, 0], 6: [0] }, 6), 1);
});

await test('Glacier Dam scoring', () => {
  const s = (areas, zone) => zoneScore(board(areas), zone, 'alpine');
  assert.equal(s({ 0: [0, 0, 0, 1, 1, 2] }, 0), 6 + 3 + 1);
  assert.equal(s({ 1: [0, 0, 1, 1, 2] }, 1), 14 - 2);
  assert.equal(s({ 2: [3, 3, 3, 3] }, 2), 16);
  assert.equal(s({ 2: [3, 3, 3, 4] }, 2), 0);
  // Spillway: a step scores only when no earlier step holds its species.
  assert.equal(s({ 3: [0, 1, 0, 2, 1] }, 3), 1 + 2 + 0 + 4 + 0);
  // Ice cave: habitats holding its species, this one included, up to 3.
  assert.equal(s({ 4: [0, 1], 0: [0], 1: [0], 2: [0] }, 4), 3 + 1);
  // Summit hut: other creatures of its species, up to 4.
  assert.equal(s({ 6: [0, 1], 0: [0, 0, 0, 0, 0, 0], 1: [1] }, 6), 4 + 1);
});

await test('new boards keep the die groups, their round counts and a full supply', () => {
  for (const set of ['desert', 'alpine']) {
    const caps = habitatsFor(set).map((h) => h.cap);
    // The four biggest habitats are always zones 0, 1, 3 and 4.
    const others = [2, 6].map((z) => caps[z]);
    for (const z of dice[2].zones)
      assert.ok(
        others.every((cap) => caps[z] > cap),
        `${set} zone ${z}`,
      );
    const rounds = totalRounds({
      id: 'wildgrove',
      contentSet: set,
      players: [],
    });
    assert.equal(rounds, set === 'alpine' ? 4 : 3);
    assert.equal(
      supplyPerKind({ id: 'wildgrove', contentSet: set }) * 6,
      rounds * 6 * 6,
    );
    const spaces = caps.filter((_, z) => z !== 5).reduce((a, b) => a + b, 0);
    assert.equal(spaces, set === 'alpine' ? 28 : 23);
    assert.equal(sanctuaryGoalsFor(set).length, 12);
    for (let seats = 2; seats <= 6; seats++)
      assert.ok(
        isSavedGame(
          createGame(
            'wildgrove',
            'easy',
            seats,
            false,
            seats,
            false,
            false,
            false,
            true,
            { contentSet: set, census: true },
          ),
        ),
      );
  }
});

await test('new board goals measure what their pictures show', () => {
  const goal = (set, name) =>
    sanctuaryGoalsFor(set).findIndex((g) => g.name === name);
  // Long drive: four of one species in a row on the Road.
  assert.equal(
    sanctuaryGoalProgress(
      board({ 3: [0, 1, 1, 1, 1] }),
      goal('desert', 'Long drive'),
      'desert',
    ).complete,
    true,
  );
  assert.equal(
    sanctuaryGoalProgress(
      board({ 3: [1, 1, 0, 1, 1] }),
      goal('desert', 'Long drive'),
      'desert',
    ).progress,
    2,
  );
  assert.equal(
    sanctuaryGoalProgress(
      board({ 4: [0, 1, 2, 3] }),
      goal('desert', 'Diner regulars'),
      'desert',
    ).complete,
    true,
  );
  assert.equal(
    sanctuaryGoalProgress(
      board({ 2: [4, 4, 4, 4] }),
      goal('alpine', 'Full cabin'),
      'alpine',
    ).complete,
    true,
  );
  assert.equal(
    sanctuaryGoalProgress(
      board({ 3: [0, 1, 2, 3, 4] }),
      goal('alpine', 'Clean steps'),
      'alpine',
    ).complete,
    true,
  );
});
