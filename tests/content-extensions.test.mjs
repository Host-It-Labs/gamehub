import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  play,
  validMove,
  legalMoves,
  isSavedGame,
  observe,
  scores,
  zoneScore,
  foodBreakdown,
  cardName,
  sanctuaryGoalsFor,
} from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';
const card = (kind, id = kind, rank = 0) => ({ kind, id, rank });
const zones = (...areas) =>
  Array.from({ length: 7 }, (_, i) =>
    (areas[i] ?? []).map((k, j) => card(k, i * 20 + j)),
  );

await test('Floodline habitats reward exact pairs, an all-different beach, the Pier alternation and exclusivity', () => {
  const z = zones(
    [0, 0, 1, 1, 2],
    [0, 1, 2, 3, 4],
    [2, 2, 2],
    [4, 5, 4, 5],
    [5, 5, 2],
    [],
    [3],
  );
  assert.deepEqual(
    [0, 1, 2, 3, 4, 6].map((i) => zoneScore(z, i, 'intermediate')),
    // Pools 7+7+1; beach 5×3; mangrove trio; pier 8+6; each cave 5 echoes the Pier's two, the cave 2 is capped at three; the lighthouse 3 lives elsewhere too.
    [15, 15, 12, 14, 7, 0],
  );
  // One repeat collapses the Nesting beach to a point per creature.
  z[1] = [card(0), card(1), card(2), card(2)];
  assert.equal(zoneScore(z, 1, 'intermediate'), 4);
  z[1] = [card(0), card(1), card(2)];
  assert.equal(zoneScore(z, 1, 'intermediate'), 9);
  // A third creature of a species spoils its pair.
  z[0] = [card(0), card(0), card(0), card(1)];
  assert.equal(zoneScore(z, 0, 'intermediate'), 1);
  assert.equal(zoneScore(z, 0), 11);
  // The Pier bonus needs the full A–B–A–B run, in order.
  z[3] = [card(4), card(5), card(5), card(4)];
  assert.equal(zoneScore(z, 3, 'intermediate'), 8);
});
await test('Observatory habitats ask one plain question each', () => {
  const z = zones([], [0, 0, 1, 1], [], [2, 2, 2], [3, 4, 5], [], []);
  assert.equal(zoneScore(z, 1), 16);
  z[1] = [card(0), card(0), card(1), card(2)];
  assert.equal(zoneScore(z, 1), 7);
  z[1] = [card(0), card(0), card(0), card(0)];
  assert.equal(zoneScore(z, 1), 16);
  // The Glasshouse trail echoes species kept in another habitat.
  assert.equal(zoneScore(z, 3), 0);
  z[3] = [card(0), card(3)];
  assert.equal(zoneScore(z, 3), 6);
  // The Dry channel only needs to be full.
  assert.equal(zoneScore(z, 4), 6);
  z[4] = [card(3), card(3)];
  assert.equal(zoneScore(z, 4), 0);
  z[2] = [card(0), card(0)];
  assert.equal(zoneScore(z, 2), 9);
  z[2] = [card(0), card(1)];
  assert.equal(zoneScore(z, 2), 3);
});
await test('intermediate dishes have independent scoring and explicit downside', () => {
  const cards = [0, 0, 0, 1, 2, 2, 2, 2, 3, 3, 3, 4, 5].map((k, i) =>
    card(k, i),
  );
  assert.deepEqual(
    foodBreakdown(cards, [[card(1), card(1)]], 'intermediate'),
    [7, 9, 4, 15, 4, 0],
  );
  assert.equal(foodBreakdown(cards, [[]], 'intermediate')[1], 2);
  assert.equal(cardName('midnight', card(0), 'intermediate'), 'Bao');
  // Goals never name a species; habitat-specific ones use the coastal habitat names.
  assert.ok(sanctuaryGoalsFor('intermediate').every((goal) => goal.kind === undefined));
  assert.doesNotMatch(sanctuaryGoalsFor('intermediate')[3].rule, /Courtyard|Roof garden/);
  assert.match(sanctuaryGoalsFor('intermediate')[8].rule, /Lighthouse/);
});
await test('Roam enforces die, capacity and private locking', () => {
  let g = createGame(
    'wildgrove',
    'easy',
    1,
    false,
    2,
    false,
    false,
    false,
    true,
    { roamEnabled: true },
  );
  g.phase = 'play';
  g.roller = 1;
  g.active = 0;
  g.die = 4;
  g.players[0].zones[0] = [card(0, 100)];
  g.players[0].hand[0] = card(0, 101);
  const roam = { type: 'play', card: 101, zone: 0, roam: true };
  assert.equal(validMove(g, { type: 'play', card: 101, zone: 0 }, 0), false);
  assert.equal(validMove(g, roam, 0), true);
  assert.equal(validMove(g, { ...roam, nurture: true }, 0), false);
  g = play(g, roam, 0);
  assert.equal(
    g.players[0].roams,
    1,
    'not spent or revealed until all players lock',
  );
  assert.equal('pending' in observe(g, 1), false);
  g = play(g, legalMoves(g)[0]);
  assert.equal(g.players[0].roams, 0);
  g.phase = 'play';
  g.active = 0;
  g.roller = 0;
  g.players[0].hand[0] = card(0, 102);
  assert.equal(
    validMove(g, { type: 'play', card: 102, zone: 0, nurture: true }, 0),
    false,
  );
  g.phase = 'play';
  g.active = 0;
  g.players[0].zones[0] = Array.from({ length: 4 }, (_, i) => card(0, 200 + i));
  assert.equal(
    legalMoves(g).some((m) => m.zone === 0),
    false,
  );
});
await test('Turning Tide changes only the led-suit winner on even tricks', () => {
  for (const pick of [1, 2]) {
    let g = createGame(
      'undertow',
      'easy',
      7,
      false,
      3,
      true,
      false,
      false,
      false,
      { turningTide: true },
    );
    g.phase = 'play';
    g.active = 0;
    g.pick = pick;
    g.hazard = 0;
    g.players[0].hand = [card(0, 1, 3), card(1, 10, 1)];
    g.players[1].hand = [card(0, 2, 8), card(1, 11, 2)];
    g.players[2].hand = [card(4, 3, 1), card(1, 12, 3)];
    for (let actor = 0; actor < 3; actor++)
      g = play(g, { type: 'play', card: actor + 1 }, actor);
    assert.equal(g.active, pick === 1 ? 1 : 0);
    assert.equal(g.players[g.active].score, 41);
  }
});
await test('all extensions compose across content, seat counts and saved pending choices', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (const contentSet of id === 'undertow'
      ? ['beginner']
      : ['beginner', 'intermediate'])
      for (const count of [2, 3, 6]) {
        let g = createGame(
          id,
          'easy',
          521 + count,
          false,
          count,
          true,
          true,
          true,
          true,
          {
            contentSet,
            roamEnabled: true,
            turningTide: true,
            marketSeasons: true,
          },
        );
        let steps = 0;
        while (g.phase !== 'over') {
          assert.ok(
            isSavedGame(g),
            `${id}/${contentSet}/${count} invalid save at ${g.round}:${g.pick}`,
          );
          const move = chooseMove(observe(g), 'easy');
          assert.ok(validMove(g, move));
          const next = play(g, move);
          assert.notEqual(next, g);
          g = next;
          assert.ok(++steps < 1000);
        }
        assert.ok(isSavedGame(g));
        assert.ok(scores(g).every(Number.isFinite));
        if (id === 'midnight')
          for (const p of g.players)
            assert.equal(
              p.seasonPoints,
              p.zones[0].reduce(
                (sum, c, i) => sum + (c.kind === g.seasonForecast[i] ? 2 : 0),
                0,
              ),
            );
      }
});
await test('new save fields reject malformed content, forecasts and charges', () => {
  const g = createGame(
    'midnight',
    'easy',
    1,
    false,
    2,
    false,
    false,
    false,
    false,
    { marketSeasons: true, contentSet: 'intermediate' },
  );
  assert.ok(isSavedGame(g));
  assert.equal(isSavedGame({ ...g, contentSet: 'unknown' }), false);
  assert.equal(isSavedGame({ ...g, roamEnabled: true }), false);
  assert.equal(isSavedGame({ ...g, seasonForecast: Array(12).fill(0) }), false);
  g.players[0].seasonPoints = 2;
  assert.equal(isSavedGame(g), false);
});

await test('online settings preserve both extensions and content through practice and match start', async () => {
  const { openDatabase } = await import('../server/database.ts');
  const { Tables } = await import('../server/tables.ts');
  const db = openDatabase(':memory:');
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
    'host',
    'host@example.com',
    'Host',
    'unused',
  );
  const host = {
    id: 'host',
    name: 'Host',
    userId: 'host',
    sessionHash: 'test',
    expires: Date.now() + 99999,
  };
  const tables = new Tables(db, () => true);
  try {
    for (const gameId of ['wildgrove', 'midnight', 'undertow']) {
      let table = tables.create(host);
      const command = (action) =>
        (table = tables.command(table.token, host, {
          action,
          requestId: crypto.randomUUID(),
          revision: table.revision,
          matchId: table.matchId,
        }));
      command({
        type: 'configure',
        gameId,
        difficulty: 'easy',
        capacity: 3,
        contentSet: gameId === 'undertow' ? 'beginner' : 'intermediate',
        shields: true,
        customerOrders: true,
        sanctuaryGoalsEnabled: true,
        roamEnabled: true,
        turningTide: true,
        marketSeasons: true,
      });
      command({ type: 'configure', gameId, difficulty: 'medium', capacity: 3 });
      const view = tables.view(table, host);
      assert.equal(
        view.contentSet,
        gameId === 'undertow' ? 'beginner' : 'intermediate',
      );
      const key =
        gameId === 'undertow'
          ? 'turningTide'
          : gameId === 'wildgrove'
            ? 'roamEnabled'
            : 'marketSeasons';
      const first =
        gameId === 'undertow'
          ? 'shields'
          : gameId === 'wildgrove'
            ? 'sanctuaryGoalsEnabled'
            : 'customerOrders';
      assert.equal(view[key], true);
      assert.equal(view[first], true);
      command({ type: 'start', learning: true });
      assert.equal(table.game[key], true);
      assert.equal(table.game[first], true);
      command({ type: 'begin-match' });
      assert.equal(table.game.contentSet, view.contentSet);
      assert.equal(table.game[key], true);
      assert.equal(table.game[first], true);
      assert.ok(isSavedGame(table.game));
    }
  } finally {
    db.close();
  }
});

await test('strategic bots finish intermediate games with both extensions', () => {
  for (const id of ['wildgrove', 'midnight']) {
    let g = createGame(id, 'medium', 912, false, 2, false, false, true, true, {
      contentSet: 'intermediate',
      roamEnabled: true,
      marketSeasons: true,
    });
    while (g.phase !== 'over') {
      const move = chooseMove(
        observe(g),
        g.pick === 6 ? 'hard' : 'medium',
        921 + g.revision,
        1,
        10,
      );
      assert.ok(validMove(g, move));
      g = play(g, move);
    }
    assert.ok(isSavedGame(g));
    assert.ok(scores(g).every(Number.isFinite));
  }
});

await test('Floodline cave, mangrove and lighthouse offer distinct risks', () => {
  const z = zones([1, 1, 1, 2], [], [0, 0], [], [1, 2], [], [3]);
  assert.equal(zoneScore(z, 2, 'intermediate'), 2);
  // Each cave creature echoes its species elsewhere, capped at three.
  assert.equal(zoneScore(z, 4, 'intermediate'), 3 + 1);
  assert.equal(zoneScore(z, 6, 'intermediate'), 4);
  z[2] = [card(0), card(0), card(0)];
  z[6] = [card(3), card(3)];
  assert.equal(zoneScore(z, 2, 'intermediate'), 12);
  // Two lighthouse keepers of one species see each other.
  assert.equal(zoneScore(z, 6, 'intermediate'), 0);
  z[6] = [card(3), card(4)];
  assert.equal(zoneScore(z, 6, 'intermediate'), 8);
  z[0] = [card(3)];
  assert.equal(zoneScore(z, 6, 'intermediate'), 4);
});
