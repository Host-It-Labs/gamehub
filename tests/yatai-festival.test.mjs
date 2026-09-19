import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  play,
  legalMoves,
  validMove,
  observe,
  isSavedGame,
  scores,
  foodScore,
  festivalBreakdown,
  availableOrders,
  festivalOrders,
} from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';
import { parseMove, Tables } from '../server/tables.ts';
import { openDatabase } from '../server/database.ts';
import { randomUUID } from 'node:crypto';
const create = (n = 3, seed = 51) =>
  createGame('midnight', 'medium', seed, false, n, false, false, true, false, {
    specialtyStalls: true,
  });
const card = (kind, id) => ({ id, kind, rank: 0 });

await test('base games retain their rules and reject expansion actions', () => {
  const base = createGame('midnight');
  assert.ok(isSavedGame(base));
  assert.equal(base.players[0].festival, undefined);
  assert.equal(legalMoves(base).length, 6);
  assert.equal(
    validMove(base, {
      type: 'play',
      card: base.players[0].hand[0].id,
      order: 0,
    }),
    false,
  );
  assert.equal(
    validMove(base, {
      type: 'play',
      card: base.players[0].hand[0].id,
      stall: true,
    }),
    false,
  );
  delete base.customerOrders;
  assert.ok(isSavedGame(base), 'old saves need no migration');
});
await test('orders and stalls lock privately and reveal simultaneously', () => {
  let g = create();
  const offered = availableOrders(1, g);
  const first = {
    type: 'play',
    card: g.players[0].hand[0].id,
    order: offered[1],
    stall: true,
  };
  assert.equal(
    validMove(g, {
      ...first,
      order: festivalOrders.findIndex((_, id) => !offered.includes(id)),
    }),
    false,
  );
  assert.equal(validMove(g, { type: 'play', card: first.card }), false);
  g = play(g, first, 0);
  assert.ok(isSavedGame(g));
  assert.deepEqual(observe(g, 1).players[0].festival, {
    orders: [],
    stalls: [],
  });
  assert.equal('pending' in observe(g, 1), false);
  const resumed = JSON.parse(JSON.stringify(g));
  for (let i = 1; i < 3; i++)
    g = play(
      g,
      { type: 'play', card: g.players[i].hand[0].id, order: offered[0] },
      i,
    );
  let recovered = resumed;
  for (let i = 1; i < 3; i++)
    recovered = play(
      recovered,
      {
        type: 'play',
        card: recovered.players[i].hand[0].id,
        order: offered[0],
      },
      i,
    );
  assert.deepEqual(
    JSON.parse(JSON.stringify(recovered)),
    JSON.parse(JSON.stringify(g)),
  );
  assert.deepEqual(g.players[0].festival.orders, [offered[1]]);
  assert.equal(g.players[0].festival.stalls.length, 1);
  assert.equal(festivalBreakdown(g.players[0]).stalls[0].points, 0);
  assert.equal(
    validMove(g, { type: 'play', card: g.players[0].hand[0].id, order: 0 }),
    false,
  );
});
await test('orders are round-local and stalls reward only later matches, capped at six', () => {
  const g = create();
  const p = g.players[0];
  p.zones[0] = [0, 0, 4, 0, 0, 0, 0, 3, 3, 0, 0, 0].map(card);
  p.festival = { orders: [0, 3], stalls: [{ kind: 0, from: 2 }] };
  let result = festivalBreakdown(p);
  assert.deepEqual(
    result.orders.map((o) => o.points),
    [7, 7],
  );
  assert.equal(result.stalls[0].points, 6);
  assert.equal(
    scores(g)[0],
    foodScore(
      p.zones[0],
      g.players.slice(1).map((p) => p.zones[0]),
    ) + 20,
  );
  p.zones[0][2].kind = 2;
  p.zones[0][9].kind = 4;
  result = festivalBreakdown(p);
  assert.equal(result.orders[0].points, 0, 'round two cannot finish round one');
  p.festival.stalls = [{ kind: 0, from: 12 }];
  assert.equal(
    festivalBreakdown(p).stalls[0].points,
    0,
    'earlier dishes cannot score retrospectively',
  );
});
await test('permits cannot be reused or spent twice on the same dish', () => {
  const g = create();
  const p = g.players[0];
  p.festival.stalls = [{ kind: p.hand[0].kind, from: 1 }];
  assert.equal(
    validMove(g, {
      type: 'play',
      card: p.hand[0].id,
      order: availableOrders(1, g)[0],
      stall: true,
    }),
    false,
  );
  p.festival.stalls.push({ kind: (p.hand[0].kind + 1) % 6, from: 2 });
  assert.ok(legalMoves(g).every((m) => !m.stall));
  const damaged = create();
  damaged.players[0].festival.orders = [99];
  assert.equal(isSavedGame(damaged), false);
});
await test('online parsing preserves expansion choices and rejects malformed values', () => {
  const move = { type: 'play', card: 3, order: 2, stall: true };
  assert.deepEqual(parseMove(move), move);
  for (const invalid of [
    { order: festivalOrders.length },
    { order: -1 },
    { order: '1' },
    { stall: 1 },
  ])
    assert.throws(() => parseMove({ ...move, ...invalid }));
});
await test('bots finish expansion matches with valid saves and unchanged drafting at 2–6 seats', () => {
  for (let seats = 2; seats <= 6; seats++) {
    let g = create(seats, seats * 31);
    let picks = 0;
    while (g.phase !== 'over') {
      assert.ok(isSavedGame(g), `save at ${seats}/${picks}`);
      const m = chooseMove(observe(g), 'medium');
      assert.ok(validMove(g, m));
      g = play(g, m);
      assert.ok(++picks <= seats * 12);
      assert.equal(new Set(g.events.map((e) => e.id)).size, g.events.length);
    }
    assert.ok(isSavedGame(g));
    assert.equal(picks, seats * 12);
    assert.equal(
      g.reserve.length + g.players.flatMap((p) => p.zones[0]).length,
      72,
    );
    assert.ok(
      g.players.every(
        (p) => p.zones[0].length === 12 && p.festival.orders.length === 2,
      ),
    );
    assert.ok(g.players.every((p) => festivalBreakdown(p).total <= 26));
  }
  const g = create(2);
  assert.ok(validMove(g, chooseMove(observe(g), 'hard', 44, 1, 50)));
});

await test('online configuration, learning restart, and persisted match keep Lantern Festival', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      'host',
      'festival@example.com',
      'Host',
      'unused',
    );
    const host = {
      id: 'host',
      userId: 'host',
      name: 'Host',
      sessionHash: 'test',
      expires: Date.now() + 99999,
    };
    const tables = new Tables(db, () => true);
    let t = tables.create(host);
    const command = (action) => {
      t = tables.command(t.token, host, {
        action,
        requestId: randomUUID(),
        revision: t.revision,
        matchId: t.matchId,
      });
    };
    command({
      type: 'configure',
      gameId: 'midnight',
      difficulty: 'medium',
      capacity: 2,
      customerOrders: true,
      specialtyStalls: true,
    });
    command({
      type: 'configure',
      gameId: 'midnight',
      difficulty: 'easy',
      capacity: 3,
    });
    assert.equal(
      tables.view(t, host).customerOrders,
      true,
      'other settings preserve the expansion',
    );
    command({ type: 'start', learning: true });
    assert.equal(t.game.customerOrders, true);
    command({ type: 'begin-match' });
    assert.equal(t.game.customerOrders, true);
    const move = {
      type: 'play',
      card: t.game.players[0].hand[0].id,
      order: availableOrders(1, t.game)[2],
      stall: true,
    };
    command({ type: 'move', move });
    t = tables.get(t.token);
    assert.equal(t.game.customerOrders, true);
    assert.deepEqual(t.game.pending[0], move);
    assert.ok(isSavedGame(t.game));
    assert.equal('pending' in tables.view(t, host).game, false);
  } finally {
    db.close();
  }
});

await test('menu offers vary by seed, persist publicly, and reject missing offers', () => {
  const a = create(3, 5),
    b = create(3, 19);
  assert.notDeepEqual(a.festivalOffers, b.festivalOffers);
  assert.deepEqual(a.festivalOffers, create(3, 5).festivalOffers);
  assert.equal(new Set(a.festivalOffers.flat()).size, 6);
  assert.deepEqual(observe(a, 1).festivalOffers, a.festivalOffers);
  assert.ok(isSavedGame(JSON.parse(JSON.stringify(a))));
  assert.ok(
    legalMoves(a).every((move) => availableOrders(1, a).includes(move.order)),
  );
  const legacy = create();
  delete legacy.festivalOffers;
  assert.deepEqual(availableOrders(1, legacy), [0, 1, 2]);
  assert.equal(isSavedGame(legacy), false);
  for (const offers of [
    [
      [0, 0, 1],
      [2, 3, 4],
    ],
    [
      [999, 1, 2],
      [3, 4, 5],
    ],
    [[0, 1, 2]],
  ]) {
    assert.equal(isSavedGame({ ...a, festivalOffers: offers }), false);
  }
});
