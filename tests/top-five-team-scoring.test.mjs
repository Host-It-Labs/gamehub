import test from 'node:test';
import assert from 'node:assert/strict';
import * as ranking from '../lib/games/party/ranking.ts';
import { standaloneIds, isStandaloneId } from '../lib/games/standalone/registry.ts';
import { libraryGames } from '../lib/games/library-fixtures.ts';
// Team play was retired from Top Five with all-at-once guessing (29 September 2026).
await test('closeness scoring: 2 on the spot, 1 one rank away, 10 for a perfect list', () => {
  assert.equal(ranking.guessPoints([0, 1, 2, 3, 4], [0, 1, 2, 3, 4]), ranking.perfectPoints);
  assert.equal(ranking.perfectPoints, 10);
  assert.deepEqual(ranking.guessOffsets([4, 0, 1, 2, 3], [0, 1, 2, 3, 4]), [1, 1, 1, 1, 4]);
  assert.equal(ranking.guessPoints([4, 0, 1, 2, 3], [0, 1, 2, 3, 4]), 4);
  assert.equal(ranking.guessPoints([4, 3, 2, 1, 0], [0, 1, 2, 3, 4]), 2);
});
await test('Find the Lie is unavailable from library, online selection and direct game IDs', () => {
  assert.ok(!standaloneIds.includes('vela'));
  assert.equal(isStandaloneId('vela'), false);
  assert.ok(!libraryGames.some(g => g.id === 'vela'));
});
