import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  createGame,
  play,
  observe,
  isSavedGame,
  totalRounds,
  supplyPerKind,
  counts,
  scores,
  foodBreakdown,
  foodsFor,
  tokenImage,
  yataContentSets,
  yataMenuNames,
  yataMenuLevels,
  yataRounds,
  yataWorldFor,
} from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';

const create = (contentSet, seats = 3, mask = 0, seed = 11) =>
  createGame(
    'midnight',
    'medium',
    seed,
    false,
    seats,
    false,
    false,
    !!(mask & 1),
    false,
    {
      contentSet,
      specialtyStalls: !!(mask & 2),
      marketSeasons: !!(mask & 4),
    },
  );
/** Cards of the given kinds, in order: [kind, kind, …]. */
const hand = (...kinds) => kinds.map((kind, id) => ({ id, kind, rank: 0 }));
const many = (kind, n) => Array(n).fill(kind);
const score = (set, mine, ...others) =>
  foodBreakdown(
    hand(...mine),
    others.map((o) => hand(...o)),
    set,
  );

await test('Yata offers Tokyo, Bangkok, Mexico and Puebla with 2, 3, 3 and 4 rounds', () => {
  assert.deepEqual(
    yataContentSets.map((set) => yataMenuNames[set]),
    ['Tokyo', 'Bangkok', 'Mexico', 'Puebla'],
  );
  assert.deepEqual(
    yataContentSets.map((set) => yataMenuLevels[set]),
    ['Beginner', 'Intermediate', 'Intermediate', 'Advanced'],
  );
  assert.deepEqual(yataContentSets.map(yataRounds), [2, 3, 3, 4]);
  assert.deepEqual(yataContentSets.map(yataWorldFor), [
    'counter',
    'counter',
    'plaza',
    'plaza',
  ]);
  for (const set of yataContentSets) {
    const g = create(set);
    assert.equal(totalRounds(g), yataRounds(set));
    assert.equal(supplyPerKind(g), yataRounds(set) * 6);
    assert.equal(
      g.menuRounds,
      yataRounds(set) > 2 ? yataRounds(set) : undefined,
    );
    assert.equal(foodsFor(set).length, 6);
    assert.equal(new Set(foodsFor(set).map((f) => f.name)).size, 6);
  }
});

await test('Mexico and Puebla deal every pick at every seat count and extension combination', () => {
  for (const set of ['plaza', 'fiesta'])
    for (const seats of [2, 4, 6])
      for (const mask of [0, 7]) {
        let g = create(set, seats, mask, 5 + seats);
        const rounds = yataRounds(set);
        assert.deepEqual(
          counts([...g.reserve, ...g.players.flatMap((p) => p.hand)]),
          Array(6).fill(rounds * 6),
        );
        if (g.customerOrders)
          assert.equal(new Set(g.festivalOffers.flat()).size, rounds * 3);
        if (g.marketSeasons) assert.equal(g.seasonForecast.length, rounds * 6);
        while (g.phase !== 'over') {
          g = play(g, chooseMove(observe(g), 'medium'));
          assert.ok(isSavedGame(g));
        }
        assert.equal(g.round, rounds);
        for (const p of g.players) assert.equal(p.zones[0].length, rounds * 6);
        assert.ok(scores(g).every(Number.isFinite));
      }
});

await test('Mexico scores match its rules', () => {
  const s = (mine, ...others) =>
    score('plaza', mine, ...(others.length ? others : [[]]));
  assert.equal(s(many(0, 6))[0], 14); // Tacos: 12 + 2
  assert.equal(s([...many(0, 3), 1, 1])[1], 6); // 2 Salsa with 3 Tacos
  assert.equal(s([...many(0, 6), 1, 1])[1], 10); // capped at 5 each
  assert.equal(s(many(2, 3), [2, 2], [2])[2], 14); // Elote: most
  assert.equal(s(many(2, 2), [2, 2, 2], [2])[2], 8); // second most
  assert.equal(s(many(2, 2), [2, 2], [2])[2], 8); // tie for most halves it
  assert.equal(s(many(2, 1), [2, 2], [2, 2])[2], 2); // tie for most leaves no second
  assert.equal(s(many(2, 1), [2, 2, 2], [2])[2], 4); // second, tied, halves to 2
  assert.equal(s(many(3, 6))[3], 20); // Tamales 18 + 2
  assert.equal(s([4, 4, 0, 1, 2])[4], 10); // Guacamole: 4 dish types, 2 missing: 2 × 5
  assert.equal(s([4, 4, 0, 1])[4], 14); // 3 missing: 2 × 7
});

await test('Puebla scores match its rules', () => {
  const s = (mine, ...others) =>
    score('fiesta', mine, ...(others.length ? others : [[]]));
  assert.equal(s(many(0, 6))[0], 21); // Quesadilla pairs 5 + 7 + 9
  assert.equal(s(many(0, 5))[0], 12);
  assert.equal(s([1], [1, 1, 1], [])[1], 2); // Pozole in the middle
  assert.equal(s([], [1, 1, 1], [1])[1], -8); // the fewest, zero included
  assert.equal(s(many(1, 3), [1], [])[1], 14); // the most
  assert.equal(s([], [1])[1], 0); // nobody loses at two players
  assert.equal(s(many(1, 2), [1, 1], [])[1], 8); // tie for most: +4 each
  assert.equal(s(many(2, 4))[2], 12); // Mole
  assert.equal(s(many(2, 6))[2], 24);
  assert.equal(s([3, 3], [3, 3, 3], [3])[3], 8); // Tostada, not the most
  assert.equal(s([3, 3], [3, 3], [3])[3], 0); // tied for most
  assert.equal(s(many(4, 3))[4], 12); // Cactus odd
  assert.equal(s(many(4, 4))[4], 4); // even
  // Flan: one from round 2, two from round 4 (picks 19 onward).
  const flan = [...many(0, 6), 5, ...many(0, 11), 5, 5];
  assert.equal(s(flan)[5], 14);
});

await test('Mexican saves must carry their round count; Bangkok keeps unmarked two-round saves', () => {
  for (const set of ['plaza', 'fiesta']) {
    const g = create(set);
    assert.ok(isSavedGame(g));
    assert.equal(isSavedGame({ ...g, menuRounds: undefined }), false);
    assert.equal(
      isSavedGame({ ...g, menuRounds: set === 'plaza' ? 4 : 3 }),
      false,
    );
  }
  const bangkok = create('intermediate');
  assert.ok(isSavedGame({ ...bangkok, menuRounds: undefined }));
  assert.equal(isSavedGame({ ...create('beginner'), menuRounds: 3 }), false);
  assert.equal(
    isSavedGame({ ...create('plaza'), contentSet: 'desert' }),
    false,
  );
});

await test('every Yata dish has its token art', () => {
  for (const set of yataContentSets)
    for (let kind = 0; kind < 6; kind++)
      assert.ok(
        existsSync(`public${tokenImage(kind, true, set)}`),
        `${set} ${kind}: ${tokenImage(kind, true, set)}`,
      );
});
