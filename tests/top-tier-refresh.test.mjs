import test from 'node:test';
import assert from 'node:assert/strict';
import * as ranking from '../lib/games/party/ranking.ts';

await test('Each player can refresh twice per round, with fresh topics every round of a full six-player game', () => {
  let g = ranking.createGame('orin', 6, 123);
  for (let round = 1; round <= 2; round++) {
    // Nine topics a seat each round; the deck refills once it runs low.
    const seen = new Set();
    assert.deepEqual(g.refreshes, [0, 0, 0, 0, 0, 0]);
    for (let seat = 0; seat < 6; seat++) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        assert.equal(g.offers[seat].length, 3);
        for (const id of g.offers[seat]) {
          assert.ok(!seen.has(id));
          seen.add(id);
        }
        g = ranking.play(g, { type: 'topic', target: g.offers[seat][0] }, seat);
        if (attempt < 2) {
          const old = g;
          g = ranking.play(g, { type: 'refresh' }, seat);
          assert.equal(g.ballots[seat].topic, g.offers[seat][0]);
          assert.deepEqual(g.ballots[seat].order, [0, 1, 2, 3, 4]);
          assert.equal(g.refreshes[seat], attempt + 1);
          assert.deepEqual(
            g.offers[(seat + 1) % 6],
            old.offers[(seat + 1) % 6],
          );
          assert.deepEqual(ranking.observe(g, (seat + 1) % 6).offers[seat], []);
        }
      }
      assert.equal(ranking.play(g, { type: 'refresh' }, seat), g);
      g = ranking.play(g, { type: 'lock' }, seat);
      assert.equal(ranking.validMove(g, { type: 'refresh' }, seat), false);
    }
    assert.equal(seen.size, 54);
    while (!g.over && g.round === round) {
      if (g.phase === 'reveal') {
        g = ranking.play(g, { type: 'next' }, 0);
        continue;
      }
      const seat = ranking.actingSeats(g)[0];
      g = ranking.play(g, ranking.botMove(g, seat), seat);
    }
  }
  assert.ok(g.over);
});

await test('Refresh respects locks, phases, game kind and older saves', () => {
  let g = ranking.createGame('orin', 2, 7);
  delete g.refreshes;
  g = ranking.play(g, { type: 'refresh' }, 0);
  assert.equal(g.refreshes[0], 1);
  g = ranking.play(g, { type: 'topic', target: g.offers[0][0] }, 0);
  g = ranking.play(g, { type: 'lock' }, 0);
  assert.equal(ranking.validMove(g, { type: 'refresh' }, 0), false);
  assert.equal(
    ranking.validMove({ ...g, phase: 'guess' }, { type: 'refresh' }, 1),
    false,
  );

});

await test('Switching topics restores private orders, including after serialization', () => {
  let g = ranking.createGame('orin', 3, 77);
  const [a, b] = g.offers[0];
  const first = [4, 0, 3, 1, 2],
    second = [2, 1, 0, 4, 3];
  g = ranking.play(g, { type: 'topic', target: a }, 0);
  g = ranking.play(g, { type: 'arrange', order: first }, 0);
  g = ranking.play(g, { type: 'topic', target: b }, 0);
  g = ranking.play(g, { type: 'arrange', order: second }, 0);
  g = ranking.play(
    JSON.parse(JSON.stringify(g)),
    { type: 'topic', target: a },
    0,
  );
  assert.deepEqual(g.ballots[0].order, first);
  g = ranking.play(g, { type: 'topic', target: b }, 0);
  assert.deepEqual(g.ballots[0].order, second);
  assert.deepEqual(ranking.observe(g, 0).topicOrders[0][a], first);
  for (const viewer of [-1, 1, 2]) {
    assert.deepEqual(ranking.observe(g, viewer).topicOrders[0], {});
    assert.deepEqual(ranking.observe(g, viewer).ballots[0].order, []);
  }
  g = ranking.play(g, { type: 'refresh' }, 0);
  assert.equal(g.phase, 'rank');
  assert.ok(g.ballots[0]);
  assert.equal(g.ballots[0].topic, g.offers[0][0]);
});

await test('Refreshing the initial chooser does not select a list', () => {
  const g = ranking.play(
    ranking.createGame('orin', 2, 11),
    { type: 'refresh' },
    0,
  );
  assert.equal(g.ballots[0], null);
});
