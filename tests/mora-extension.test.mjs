import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, scores, wildTrailsBreakdown, isSavedGame, legalMoves, play } from '../lib/games/trio/engine.ts';

const creature = (kind) => ({ id: kind, rank: 0, kind });
void test('Wild Trails counts distinct habitats, excludes trash, and awards diversity once', () => {
  const zones = [[creature(0), creature(0)], [creature(0), creature(1)], [creature(0), creature(2)], [creature(3)], [creature(4)], [creature(5)], []];
  assert.equal(wildTrailsBreakdown(zones).total, 3);
  zones[6].push(creature(5));
  assert.equal(wildTrailsBreakdown(zones).total, 8);
  zones[4].push(creature(0));
  assert.equal(wildTrailsBreakdown(zones).total, 8);
});
void test('Wild Trails is opt-in, Mora-only, and rejects missing goal definitions', () => {
  const base = createGame('wildgrove');
  const expanded = createGame('wildgrove', 'medium', 1, false, 3, false, false, false, true);
  assert.equal(expanded.sanctuaryGoalsEnabled, true);
  assert.equal(isSavedGame(expanded), true);
  delete base.sanctuaryGoalsEnabled;
  // Mirror terraces: two species living in both Courtyard and Roof garden.
  expanded.sanctuaryGoals = [3, 6, 9];
  assert.equal(isSavedGame(base), true);
  for (const g of [base, expanded]) g.players[0].zones = [[creature(0), creature(1)], [creature(0), creature(1)], [], [], [], [], []];
  assert.equal(scores(expanded)[0] - scores(base)[0], 5);
  assert.equal(createGame('midnight', 'medium', 1, false, 3, false, false, false, true).sanctuaryGoalsEnabled, false);
  assert.equal(isSavedGame({ ...expanded, sanctuaryGoalsEnabled: 'yes' }), false);
});
void test('expanded Mora completes with legal moves and survives serialization', () => {
  let g = createGame('wildgrove', 'medium', 9, false, 3, false, false, false, true);
  let turns = 0;
  while (g.phase !== 'over' && turns++ < 100) {
    g = play(g, legalMoves(g)[0]);
  }
  assert.equal(g.phase, 'over');
  assert.equal(isSavedGame(JSON.parse(JSON.stringify(g))), true);
  assert.ok(scores(g).every(Number.isFinite));
});

void test('new goals are seeded, distinct, varied between matches and public to every player', async () => {
  const { sanctuaryGoals, observe } = await import('../lib/games/trio/engine.ts');
  const sets = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const g = createGame('wildgrove', 'medium', seed, false, 3, false, false, false, true);
    assert.equal(g.sanctuaryGoals.length, 3);
    assert.equal(new Set(g.sanctuaryGoals).size, 3);
    assert.ok(g.sanctuaryGoals.every((id) => sanctuaryGoals[id]));
    assert.deepEqual(g.sanctuaryGoals, createGame('wildgrove', 'medium', seed, false, 3, false, false, false, true).sanctuaryGoals);
    for (let viewer = 0; viewer < 3; viewer++) assert.deepEqual(observe(g, viewer).sanctuaryGoals, g.sanctuaryGoals);
    assert.ok(isSavedGame(JSON.parse(JSON.stringify(g))));
    sets.add(g.sanctuaryGoals.join(','));
  }
  assert.ok(sets.size > 10);
});

void test('goal scoring uses only the drawn goals and rejects invalid saved goals', async () => {
  const { sanctuaryGoalProgress, sanctuaryBonus } = await import('../lib/games/trio/engine.ts');
  const zones = [[creature(0), creature(0)], [creature(0), creature(1), creature(2), creature(3)], [creature(1), creature(1)], [creature(0), creature(2), creature(3)], [creature(4)], [creature(5)], [creature(0)]];
  assert.equal(sanctuaryGoalProgress(zones, 0).points, 5);
  assert.equal(sanctuaryGoalProgress(zones, 6).points, 0); // Species 5 is only in trash.
  assert.equal(sanctuaryGoalProgress(zones, 7).points, 4);
  assert.equal(sanctuaryGoalProgress(zones, 8).points, 5);
  assert.equal(sanctuaryGoalProgress(zones, 9).points, 4);
  assert.equal(sanctuaryGoalProgress(zones, 10).points, 4);
  assert.equal(sanctuaryGoalProgress(zones, 11).points, 5);
  assert.equal(sanctuaryBonus(zones, [0, 6, 9]), 9);
  const g = createGame('wildgrove', 'medium', 42, false, 3, false, false, false, true);
  for (const goals of [[0, 0, 1], [0, 1], [0, 1, 99], [0, 1, '2']]) assert.equal(isSavedGame({ ...g, sanctuaryGoals: goals }), false);
});

void test('every game randomizes its starting seat without skipping simultaneous players', async () => {
  const { readySeats, passCount, simultaneous } = await import('../lib/games/trio/engine.ts');
  for (const id of ['undertow', 'wildgrove', 'midnight']) {
    for (let seats = 2; seats <= 6; seats++) {
      const starts = new Set();
      for (let sample = 1; sample <= 300; sample++) {
        const seed = Math.imul(sample, 2654435761) >>> 0;
        let g = createGame(id, 'medium', seed, false, seats);
        starts.add(g.firstPlayer);
        assert.equal(g.active, g.firstPlayer);
        assert.equal(g.roller, g.firstPlayer);
        assert.equal(isSavedGame(g), true);
        assert.equal(isSavedGame({ ...g, firstPlayer: seats }), false);
        if (sample > 30) continue;
        if (id === 'undertow') {
          for (let actor = seats - 1; actor >= 0; actor--) g = play(g, { type: 'pass', cards: g.players[actor].hand.slice(0, passCount(g)).map((c) => c.id) }, actor);
          assert.equal(g.active, g.firstPlayer);
        }
        if (g.phase === 'roll') g = play(g, { type: 'roll' });
        assert.equal(g.active, g.firstPlayer);
        if (simultaneous(g)) assert.deepEqual(readySeats(g), Array(seats).fill(false));
        let turns = 0;
        while (g.phase !== 'over' && turns++ < 500) {
          const move = g.phase === 'pass' ? { type: 'pass', cards: g.players[g.active].hand.slice(0, passCount(g)).map((c) => c.id) } : legalMoves(g)[0];
          g = play(g, move);
          assert.ok(isSavedGame(g), `${id}/${seats}/${sample}/${turns}`);
        }
        assert.equal(g.phase, 'over');
      }
      assert.equal(starts.size, seats);
    }
  }
});
