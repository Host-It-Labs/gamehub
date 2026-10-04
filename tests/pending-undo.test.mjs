import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, play, observe, legalMoves, passCount, canUndo, validMove, isSavedGame, upgradeSave } from '../lib/games/trio/engine.ts';

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
await test('a locked Migration move from an old save is withdrawn, not replayed', () => {
  let g = createGame('wildgrove', 'medium', 91, false, 3, false, false, false, false, {});
  g = play(g, { type: 'roll' }, g.active);
  const legacy = structuredClone(g);
  legacy.migration = true;
  legacy.players.forEach((p) => { p.migrations = 1; });
  const card = legacy.players[0].hand[0].id;
  legacy.pending = [{ type: 'play', card, zone: 0, migration: { card: 1, from: 0, to: 1 } }, null, null];
  legacy.ready = [true, false, false];
  const upgraded = upgradeSave(legacy);
  assert.equal(isSavedGame(upgraded), true);
  assert.equal(upgraded.pending[0], null);
  assert.equal(upgraded.ready[0], false);
  assert.equal('migration' in upgraded, false);
  assert.equal(upgraded.players.some((p) => 'migrations' in p), false);
});
