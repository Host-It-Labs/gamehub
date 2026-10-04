import test from 'node:test';
import assert from 'node:assert/strict';
import * as order from '../lib/games/party/order.ts';
import { orderSets, liveOrderIds } from '../lib/games/party/order-sets.ts';

await test('Order never deals the retired, too-specific sets', () => {
  const retired = orderSets.filter((s) => s.retired);
  assert.ok(
    retired.some(
      (s) => s.items[0].name === 'Jupiter' && s.title === 'Heaviest first',
    ),
    'planet masses are retired',
  );
  assert.ok(liveOrderIds.length >= 30, 'enough sets stay live');
  for (const set of orderSets)
    assert.equal(set.items.length, order.itemsPerSet, set.title);
  for (let seed = 1; seed <= 60; seed++) {
    const g = order.createGame(2, seed);
    assert.ok(
      g.sets.every((id) => !orderSets[id].retired),
      `seed ${seed}`,
    );
  }
});
