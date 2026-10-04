import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  play,
  legalMoves,
  observe,
  isSavedGame,
  totalRounds,
  supplyPerKind,
  passingStep,
  counts,
  scores,
  foodScore,
  festivalBreakdown,
} from '../lib/games/trio/engine.ts';
import { heuristic, chooseMove, determinize } from '../lib/games/trio/bot.ts';

const create = (seats, mask, seed = 73, contentSet = 'intermediate') =>
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
const bestMove = (g) => {
  const view = observe(g);
  return legalMoves(view).reduce((best, move) =>
    heuristic(view, move) > heuristic(view, best) ? move : best,
  );
};

await test('Side B completes 18 private, conserved picks at every seat count and extension combination', () => {
  for (let seats = 2; seats <= 6; seats++)
    for (let mask = 0; mask < 8; mask++) {
      let g = create(seats, mask);
      assert.equal(totalRounds(g), 3);
      assert.equal(supplyPerKind(g), 18);
      assert.deepEqual(
        counts([...g.reserve, ...g.players.flatMap((p) => p.hand)]),
        Array(6).fill(18),
      );
      if (g.customerOrders)
        assert.equal(new Set(g.festivalOffers.flat()).size, 9);
      if (g.marketSeasons)
        for (let round = 0; round < 3; round++)
          assert.equal(
            new Set(g.seasonForecast.slice(round * 6, round * 6 + 6)).size,
            6,
          );
      const rounds = new Set();
      let steps = 0;
      while (g.phase !== 'over') {
        assert.ok(isSavedGame(g), `${seats}/${mask}/${g.round}/${g.pick}`);
        rounds.add(g.round);
        assert.equal(passingStep(g), g.round === 2 ? -1 : 1);
        const all = [
          ...g.reserve,
          ...g.players.flatMap((p) => [...p.hand, ...p.zones[0]]),
        ];
        assert.equal(all.length, 108);
        assert.equal(new Set(all.map((c) => c.id)).size, 108);
        const actor = g.active;
        const move = bestMove(g);
        assert.ok(
          Number.isFinite(heuristic(observe(g), move)),
          'stalls alone must have a finite bot value',
        );
        const before = g.players[actor].zones[0].length;
        g = play(g, move);
        if (g.ready?.some(Boolean)) {
          assert.equal(
            g.players[actor].zones[0].length,
            before,
            'pending dishes remain private',
          );
          assert.equal('ownMove' in observe(g, (actor + 1) % seats), false);
        }
        g = JSON.parse(JSON.stringify(g));
        assert.ok(++steps <= seats * 18);
      }
      assert.deepEqual([...rounds], [1, 2, 3]);
      assert.equal(steps, seats * 18);
      assert.ok(isSavedGame(g));
      g.players.forEach((p, seat) => {
        assert.equal(p.zones[0].length, 18);
        assert.equal(p.hand.length, 0);
        assert.equal(p.festival?.orders.length ?? 0, g.customerOrders ? 3 : 0);
        const bonus = festivalBreakdown(p);
        assert.ok(bonus.stalls.length <= 2);
        assert.ok(bonus.stalls.every((stall) => stall.points <= 6));
        assert.ok(
          bonus.orders.every(
            (order) => order.points === 0 || order.points === 7,
          ),
        );
        const season = g.marketSeasons
          ? p.zones[0].reduce(
              (sum, c, i) => sum + (c.kind === g.seasonForecast[i] ? 2 : 0),
              0,
            )
          : 0;
        assert.equal(p.seasonPoints ?? 0, season);
        assert.equal(
          scores(g)[seat],
          foodScore(
            p.zones[0],
            g.players.filter((_, i) => i !== seat).map((p) => p.zones[0]),
            g.contentSet,
          ) +
            bonus.total +
            season,
        );
      });
    }
});

await test('After Hours and existing Side B saves keep two rounds and their original supply and extensions', () => {
  for (const contentSet of ['beginner', 'intermediate']) {
    let g = create(6, 7, 91, 'beginner');
    // This is the shape of a pre-update Side B save: identical two-round
    // supply and extension data, alternate dishes, no duration marker.
    g.contentSet = contentSet;
    assert.equal(g.menuRounds, undefined);
    assert.equal(totalRounds(g), 2);
    assert.equal(supplyPerKind(g), 12);
    while (g.phase !== 'over') {
      assert.ok(isSavedGame(g));
      g = play(g, bestMove(g));
    }
    assert.ok(isSavedGame(g));
    assert.equal(g.round, 2);
    assert.ok(g.players.every((p) => p.zones[0].length === 12));
  }
});

await test('third-round extension data and duration markers are validated on reload', () => {
  const g = create(6, 7);
  for (const menuRounds of [0, 2, 4, '3', null])
    assert.equal(isSavedGame({ ...g, menuRounds }), false);
  assert.equal(isSavedGame({ ...g, contentSet: 'beginner' }), false);
  assert.equal(
    isSavedGame({ ...g, seasonForecast: g.seasonForecast.slice(0, 12) }),
    false,
  );
  assert.equal(
    isSavedGame({ ...g, festivalOffers: g.festivalOffers.slice(0, 2) }),
    false,
  );
  const bad = structuredClone(g);
  bad.seasonForecast[17] = bad.seasonForecast[16];
  assert.equal(isSavedGame(bad), false);
});

await test('third-round bot choices remain legal at each difficulty, including stalls without orders', () => {
  let g = create(6, 2);
  while (g.round < 3) g = play(g, bestMove(g));
  for (const level of ['easy', 'medium', 'hard']) {
    const move = chooseMove(observe(g), level, 2, 3, 20);
    assert.ok(
      legalMoves(g).some(
        (legal) => JSON.stringify(legal) === JSON.stringify(move),
      ),
    );
  }
});

await test('hard bots simulate the full six-dish supply, including round-three hands', () => {
  let g = create(6, 0);
  for (let round = 1; round <= 3; round++) {
    while (g.round < round) g = play(g, bestMove(g));
    const sampled = determinize(observe(g), () => 0.5);
    const all = [
      ...sampled.reserve,
      ...sampled.players.flatMap((p) => [...p.hand, ...p.zones[0]]),
    ];
    assert.deepEqual(counts(all), Array(6).fill(18));
    assert.equal(new Set(all.map((c) => c.id)).size, 108);
    assert.equal(sampled.reserve.length, g.reserve.length);
    assert.ok(sampled.players.every((p) => p.hand.length === 6));
  }
});

await test('online Side B restarts from practice and reloads round-three private choices', async () => {
  const { openDatabase } = await import('../server/database.ts');
  const { Tables } = await import('../server/tables.ts');
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      'host',
      'yata@example.invalid',
      'Host',
      'unused',
    );
    const host = { id: 'host', userId: 'host', name: 'Host' };
    let tables = new Tables(db, () => true);
    let t = tables.create(host);
    const command = (action) => {
      t = tables.command(t.token, host, {
        action,
        requestId: crypto.randomUUID(),
        revision: t.revision,
        matchId: t.matchId,
      });
    };
    command({
      type: 'configure',
      gameId: 'midnight',
      capacity: 6,
      difficulty: 'medium',
      contentSet: 'intermediate',
      customerOrders: true,
      specialtyStalls: true,
      marketSeasons: true,
    });
    command({ type: 'start', learning: true });
    assert.equal(totalRounds(t.game), 3);
    command({ type: 'begin-match' });
    while (t.game.round < 3) t.game = play(t.game, bestMove(t.game));
    tables.save(t);
    tables = new Tables(db, () => true);
    t = tables.get(t.token);
    assert.equal(totalRounds(t.game), 3);
    assert.equal(t.game.round, 3);
    assert.ok(isSavedGame(t.game));
    const move = bestMove({ ...t.game, active: 0 });
    command({ type: 'move', move });
    assert.deepEqual(tables.get(t.token).game.pending[0], move);
    const view = tables.view(t, host).game;
    assert.equal(view.menuRounds, 3);
    assert.equal('pending' in view, false);
    assert.equal(view.festivalOffers.length, 3);
    assert.equal(view.seasonForecast.length, 18);
  } finally {
    db.close();
  }
});
