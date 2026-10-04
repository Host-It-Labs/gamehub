import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, play, legalMoves, observe, previewPlacement, canUndo, validMove } from '../lib/games/trio/engine.ts';

function draft(id, seats = 3, options = {}) {
  let g = createGame(id, 'easy', 925, false, seats, false, false, options.customerOrders ?? false, false, options);
  if (g.phase === 'roll') g = play(g, { type: 'roll' });
  return g;
}

for (const id of ['wildgrove', 'midnight']) for (const contentSet of ['beginner', 'intermediate']) {
  await test(`${id} ${contentSet}: private preview, undo, reload and reveal agree for every seat count`, () => {
    for (let seats = 2; seats <= 6; seats++) {
      for (const actor of [0, seats - 1]) {
        const initial = draft(id, seats, { contentSet });
        const move = legalMoves({ ...initial, active: actor }).find(m => m.zone !== 5);
        const before = structuredClone(initial);
        const optimistic = previewPlacement(observe(initial, actor), actor, move);
        assert.equal(optimistic.players[actor].hand.length, initial.players[actor].hand.length - 1);
        assert.equal(optimistic.ready[actor], true);
        const pending = play(initial, move, actor);
        const reloaded = observe(JSON.parse(JSON.stringify(pending)), actor);
        assert.deepEqual(reloaded.ownMove, move);
        const display = previewPlacement(reloaded, actor, reloaded.ownMove);
        assert.deepEqual(display.players, optimistic.players);
        assert.deepEqual(initial, before, 'preview never mutates authoritative state');
        assert.deepEqual(pending.players, before.players, 'submitted moves remain private');
        assert.deepEqual(display.events, reloaded.events, 'preview does not manufacture public events');
        assert.equal(display.pick, before.pick);
        assert.equal(canUndo(pending, actor), true);
        for (let other = 0; other < seats; other++) {
          if (other === actor) continue;
          const otherView = observe(pending, other);
          assert.equal(otherView.ownMove, undefined);
          assert.deepEqual(otherView.players[actor].zones, before.players[actor].zones);
          assert.equal(otherView.players[actor].hand.length, before.players[actor].hand.length);
        }
        const undone = play(pending, { type: 'undo' }, actor);
        assert.deepEqual(undone.players, before.players);
        assert.equal(observe(undone, actor).ownMove, undefined);
        assert.equal(validMove(undone, move, actor), true);
        let resolved = pending;
        for (let seat = 0; seat < seats; seat++) {
          if (seat !== actor) resolved = play(resolved, legalMoves({ ...resolved, active: seat })[0], seat);
        }
        assert.deepEqual(resolved.players[actor].zones, display.players[actor].zones);
        assert.equal(observe(resolved, actor).ownMove, undefined);
        assert.equal(previewPlacement(observe(resolved, actor), actor, move).players[actor].zones.flat().filter(c => c.id === move.card).length, 1);
      }
    }
  });
}

await test('Mora Roam preview spends its token only in the private copy', () => {
  const g = draft('wildgrove', 3, { roamEnabled: true });
  g.roller = 1;
  g.players[0].roams = 1;
  const move = legalMoves({ ...g, active: 0 }).find(m => m.roam);
  assert.ok(move);
  assert.equal(previewPlacement(g, 0, move).players[0].roams, 0);
  assert.equal(g.players[0].roams, 1);
});

await test('preview includes Yata order, stall and season effects exactly once', () => {
  const g = draft('midnight', 3, { customerOrders: true, specialtyStalls: true, marketSeasons: true });
  g.players.forEach(p => { p.festival = { orders: [], stalls: [] }; });
  g.seasonForecast = Array(18).fill(g.players[0].hand[0].kind);
  const move = legalMoves({ ...g, active: 0 }).find(m => m.order !== undefined && m.stall && m.card === g.players[0].hand[0].id);
  assert.ok(move);
  const preview = previewPlacement(g, 0, move);
  assert.equal(preview.players[0].seasonPoints, 2);
  assert.equal(preview.players[0].festival.orders.length, 1);
  assert.equal(preview.players[0].festival.stalls.length, 1);
  let resolved = play(g, move, 0);
  for (const actor of [1, 2]) resolved = play(resolved, legalMoves({ ...resolved, active: actor })[0], actor);
  assert.deepEqual(preview.players[0].festival, resolved.players[0].festival);
  assert.equal(preview.players[0].seasonPoints, resolved.players[0].seasonPoints);
});

await test('invalid, absent and Nox moves do not produce a draft preview', () => {
  const g = draft('midnight');
  for (const move of [undefined, { type: 'undo' }, { type: 'play', card: -1 }]) assert.equal(previewPlacement(g, 0, move), g);
  const nox = createGame('undertow', 'easy', 1, false, 3);
  assert.equal(previewPlacement(nox, 0, { type: 'play', card: nox.players[0].hand[0].id }), nox);
});
