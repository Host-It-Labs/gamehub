import test from 'node:test';
import assert from 'node:assert/strict';
import * as ranking from '../lib/games/party/ranking.ts';
import { standaloneGames, standaloneIds, isStandaloneId } from '../lib/games/standalone/registry.ts';
import { libraryGames } from '../lib/games/library-fixtures.ts';
function prepared(teams) {
  let g = ranking.createGame('orin', teams.length, 19, 'medium', 'teams', new Set(), teams);
  for (let s = 0; s < teams.length; s++) {
    g = ranking.play(g, { type: 'topic', target: g.offers[s][0] }, s);
    g = ranking.play(g, { type: 'lock' }, s);
  }
  return g;
}
await test('3v2: silent teammates average against one shared opposing guess, with private live drafts', () => {
  let g = prepared([0, 0, 0, 1, 1]);
  const answer = g.ballots[0].order,
    // Guesses written as positions in the author's list.
    as = (p) => p.map((i) => answer[i]);
  assert.deepEqual(ranking.observe(g, 0).ballots[0].order, answer);
  assert.equal(ranking.validMove(g, { type: 'lock' }, 0), false);
  g = ranking.play(g, { type: 'arrange', order: answer }, 1);
  g = ranking.play(g, { type: 'arrange', order: as([1, 0, 2, 3, 4]) }, 2);
  g = ranking.play(g, { type: 'arrange', order: as([1, 2, 0, 3, 4]) }, 3);
  assert.deepEqual(ranking.observe(g, 4).guesses[1].order, as([1, 2, 0, 3, 4]));
  for (const viewer of [0, 2, 3, 4, -1]) assert.deepEqual(ranking.observe(g, viewer).guesses[3].order, []);
  assert.deepEqual(ranking.observe(g, 1).guesses[4].order, []);
  g = ranking.play(g, { type: 'lock' }, 1);
  g = ranking.play(g, { type: 'lock' }, ranking.captain(g, 1));
  assert.equal(g.phase, 'guess');
  g = ranking.play(g, { type: 'lock' }, 2);
  assert.equal(g.phase, 'reveal');
  assert.deepEqual(g.scores, [9, 6]); // (10 + 8) / 2 versus the shared 6.
  assert.ok(standaloneGames.orin.isSavedGame(g));
  assert.deepEqual(ranking.observe(g, 3).result.guesses[3].order, answer);
});
await test('closeness scoring: 2 on the spot, 1 one rank away, 10 for a perfect list', () => {
  assert.equal(ranking.guessPoints([0, 1, 2, 3, 4], [0, 1, 2, 3, 4]), ranking.perfectPoints);
  assert.equal(ranking.perfectPoints, 10);
  assert.deepEqual(ranking.guessOffsets([4, 0, 1, 2, 3], [0, 1, 2, 3, 4]), [1, 1, 1, 1, 4]);
  assert.equal(ranking.guessPoints([4, 0, 1, 2, 3], [0, 1, 2, 3, 4]), 4);
  assert.equal(ranking.guessPoints([4, 3, 2, 1, 0], [0, 1, 2, 3, 4]), 2);
});
await test('uneven teams preserve fractional averages and singleton author teams never block', () => {
  for (const teams of [[0,0,0,0,1], [0,1,1]]) {
    let g = prepared(teams);
    const answer = g.ballots[0].order;
    for (const slot of ranking.guessingTeams(g)) {
      const seat = ranking.captain(g, slot);
      g = ranking.play(g, { type: 'arrange', order: (seat === 1 ? [1,0,2,3,4] : [0,1,2,3,4]).map((i) => answer[i]) }, seat);
      g = ranking.play(g, { type: 'lock' }, seat);
    }
    assert.equal(g.phase, 'reveal');
    assert.ok(standaloneGames.orin.isSavedGame(g));
    if (teams.length === 5) assert.ok(Math.abs(g.scores[0] - 28 / 3) < 1e-9);
    else assert.equal(g.scores[0], 0);
  }
});
await test('Find the Lie is unavailable from library, online selection and direct game IDs', () => {
  assert.ok(!standaloneIds.includes('vela'));
  assert.equal(isStandaloneId('vela'), false);
  assert.ok(!libraryGames.some(g => g.id === 'vela'));
});
