import test from 'node:test';
import assert from 'node:assert/strict';
import * as ranking from '../lib/games/party/ranking.ts';
import { standaloneGames } from '../lib/games/standalone/registry.ts';


const fill = (g) => {
  for (let s = 0; s < g.seats.length; s++) {
    g = ranking.play(g, { type: 'topic', target: g.offers[s][0] }, s);

    g = ranking.play(g, { type: 'lock' }, s);
  }
  return g;
};
await test('My Top Five supports 2–6 individuals and 2–6 players in two teams', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const g = fill(ranking.createGame('orin', n, 77));
    assert.equal(g.phase, 'guess');
    assert.equal(g.scores.length, n);
    assert.deepEqual(
      ranking.guessingTeams(g),
      Array.from({ length: n - 1 }, (_, i) => i + 1),
    );
    assert.ok(standaloneGames.orin.isSavedGame(g));

  }
  for (const n of [2, 3, 4, 5, 6]) {
    const g = fill(ranking.createGame('orin', n, 77, 'medium', 'teams'));
    assert.deepEqual(ranking.guessingTeams(g), [1, ...Array.from({ length: Math.ceil(n / 2) - 1 }, (_, i) => 4 + i * 2)]);
    assert.equal(g.teams.filter((t) => t === 0).length, Math.ceil(n / 2));
    assert.equal(ranking.validMove(g, { type: 'lock' }, 2), n > 2);
  }
});
await test('Individual drafts are private and reveal waits for every guess', () => {
  let g = fill(ranking.createGame('orin', 5, 33));
  g = ranking.play(g, { type: 'arrange', order: [4, 3, 2, 1, 0] }, 1);
  assert.deepEqual(ranking.observe(g, 2).guesses[1].order, []);
  assert.deepEqual(ranking.observe(g, -1).ballots[0].order, []);
  for (let s = 1; s < 4; s++) {
    g = ranking.play(g, { type: 'lock' }, s);
    assert.equal(g.phase, 'guess');
  }
  g = ranking.play(g, { type: 'lock' }, 4);
  assert.equal(g.phase, 'reveal');
  assert.equal(g.result.gains.length, 5);
});


await test('Every supported ranking table finishes two rounds without deadlocks or invalid saves', () => {
  for (const kind of ['orin'])
    for (const mode of ['individual', 'teams'])
      for (const n of [2, 3, 4, 5, 6]) {
        let g = ranking.createGame(kind, n, 829, 'medium', mode);
        let steps = 0;
        while (!g.over && steps++ < 1000) {
          const actor = ranking.actingSeats(g)[0];
          assert.notEqual(actor, undefined);
          const move = ranking.botMove(ranking.observe(g, actor), actor);
          assert.ok(move);
          const next = ranking.play(g, move, actor);
          assert.notEqual(next, g);
          g = next;
          assert.ok(
            standaloneGames[kind].isSavedGame(g),
            `${kind}/${mode}/${n}/${g.phase}`,
          );
        }
        assert.ok(g.over, `${kind}/${mode}/${n} should finish`);
      }
});
