import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, play, observe, legalMoves, passCount, canUndo, validMove, isSavedGame } from '../lib/games/trio/engine.ts';

const choice = (g, seat) => g.phase === 'pass'
  ? { type: 'pass', cards: g.players[seat].hand.slice(0, passCount(g)).map(card => card.id) }
  : legalMoves({ ...observe(g, seat), active: seat })[0];

for (const id of ['undertow', 'wildgrove', 'midnight']) {
  await test(`${id}: an unrevealed choice can be withdrawn without changing cards or revealing others`, () => {
    let g = createGame(id, 'medium', 88, false, 3);
    if (g.phase === 'roll') g = play(g, { type: 'roll' }, g.active);
    const hands = structuredClone(g.players.map(p => p.hand));
    g = play(g, choice(g, 0), 0);
    assert.equal(canUndo(observe(g, 0), 0), true);
    assert.equal(canUndo(observe(g, 1), 1), false);
    const invalid = play(g, { type: 'undo' }, 1);
    assert.equal(invalid, g);
    const revision = g.revision;
    const undone = play(g, { type: 'undo' }, 0);
    assert.equal(undone.revision, revision + 1);
    assert.equal(undone.pending[0], null);
    assert.equal(undone.ready[0], false);
    assert.deepEqual(undone.players.map(p => p.hand), hands);
    assert.equal('pending' in observe(undone, 1), false);
    assert.equal(isSavedGame(undone), true);
    assert.equal(validMove(undone, choice(undone, 0), 0), true);
    g = undone;
    for (let seat = 0; seat < 3; seat++) g = play(g, choice(g, seat), seat);
    assert.equal(canUndo(observe(g, 0), 0), false);
    assert.equal(play(g, { type: 'undo' }, 0), g);
  });
}
await test('withdrawing a migration leaves the original creature and its permit untouched', () => {
  let g = createGame('wildgrove', 'medium', 91, false, 3, false, false, false, false, { migration: true });
  g = play(g, { type: 'roll' }, g.active);
  const migrant = g.players[0].hand.shift();
  g.players[0].zones[0].push(migrant);
  const zones = structuredClone(g.players[0].zones);
  const m = legalMoves({ ...observe(g, 0), active: 0 }).find(m => m.migration);
  assert.ok(m, 'a migration is available');
  g = play(g, m, 0);
  g = play(g, { type: 'undo' }, 0);
  assert.deepEqual(g.players[0].zones, zones);
  assert.equal(g.players[0].migrations, 1);
});
