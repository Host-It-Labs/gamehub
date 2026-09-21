import test from 'node:test';
import assert from 'node:assert/strict';
import { standaloneGames, botMove } from '../lib/games/standalone/registry.ts';
import { practice } from '../lib/games/adventures/lessons.ts';

import { validTeams } from '../lib/games/party/groups.ts';

for (const kind of ['orin', 'miro']) {
  await test(`${kind}: custom uneven teams survive saves, privacy and a full match`, () => {
    const teams = [1, 1, 0, 0, 0], entry = standaloneGames[kind];
    let g = entry.create(5, 391, 'hard', 'teams', undefined, teams);
    assert.deepEqual(g.teams, teams);
    assert.deepEqual(practice(kind, 5, 'hard', 0, 'teams', teams).teams, teams);
    assert.ok(entry.isSavedGame(JSON.parse(JSON.stringify(g))));
    for (let steps = 0; !g.over && steps < 1000; steps++) {
      const seat = entry.actingSeats(g)[0];
      assert.ok(Number.isInteger(seat));
      const move = botMove(g, seat);
      assert.ok(entry.validMove(g, move, seat));
      g = entry.play(g, move, seat);
      assert.ok(entry.isSavedGame(g), `${kind}/${g.phase}`);
      assert.deepEqual(g.teams, teams);
    }
    assert.ok(g.over);
    assert.equal(entry.outcome(g).rows.length, 2);
    assert.throws(() => entry.create(5, 3, 'hard', 'teams', undefined, [0,0,0,0,0]));
    const invalid = structuredClone(g); invalid.teams = [0,0,0,0,0];
    assert.equal(entry.isSavedGame(invalid), false);
  });
}

await test('Team validation rejects missing, invalid and empty teams', () => {
  for (const value of [null, [], [0,1], [0,1,2], [1,1,1]]) assert.equal(validTeams(value,3),false);
  assert.equal(validTeams([1,0,1],3),true);
});
