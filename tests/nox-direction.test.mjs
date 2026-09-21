import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, play, passCount, legalMoves, tableOrderStep } from '../lib/games/trio/engine.ts';

await test('the displayed Nox direction agrees with delivered cards and trick order', () => {
  for (const count of [3, 4, 5, 6]) {
    for (const round of [1, 2]) {
      let g = createGame('undertow', 'medium', 719, false, count);
      g.round = round;
      const step = tableOrderStep(g);
      assert.equal(step, round === 1 ? 1 : -1);
      const gifts = g.players.map(p => p.hand.slice(0, passCount(g)).map(c => c.id));
      for (let seat = 0; seat < count; seat++) g = play(g, { type: 'pass', cards: gifts[seat] }, seat);
      for (let seat = 0; seat < count; seat++) {
        const recipient = (seat + step + count) % count;
        for (const id of gifts[seat]) assert.ok(g.players[recipient].hand.some(c => c.id === id));
      }
      g = play(g, { type: 'roll' }, g.active);
      assert.equal(tableOrderStep(g), 1);
      const actor = g.active;
      g = play(g, legalMoves(g)[0], actor);
      assert.equal(g.active, (actor + 1) % count);
    }
  }
});
