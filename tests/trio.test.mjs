import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  play,
  validMove,
  scores,
  zoneScore,
  foodScore,
  observe,
  isSavedGame,
  penalty,
} from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';
const c = (kind, id = kind) => ({ kind, rank: 0, id });
const zones = (cards, at = 0) =>
  Array.from({ length: 6 }, (_, i) => (i === at ? cards : []));

test('current habitat and food scoring matches the published rules', () => {
  assert.equal(zoneScore(zones([c(0), c(0)]), 0), 8);
  assert.equal(zoneScore(zones([c(0), c(1), c(2), c(3)], 1), 1), 16);
  assert.equal(zoneScore(zones([c(0), c(0), c(0)], 2), 2), 0);
  assert.equal(zoneScore(zones([c(0), c(0), c(1), c(1)], 2), 2), 14);
  assert.equal(zoneScore(zones([c(0), c(1), c(2)], 3), 3), 15);
  assert.equal(foodScore([c(0), c(0)], []), 7);
  assert.equal(foodScore([c(1), c(1), c(1), c(1)], []), 13);
  assert.equal(foodScore([c(2), c(2), c(2)], []), 9);
  assert.equal(foodScore([c(4)], [[c(4)]]), 5);
  assert.equal(foodScore([c(4)], []), 8);
  assert.equal(penalty({ id: 0, kind: 2, rank: 9 }, 2), 40);
});
test('seeded matches terminate legally with conserved cards at every player count', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (let n = 2; n <= 6; n++)
      for (let seed = 1; seed <= 8; seed++) {
        let g = createGame(id, 'medium', seed, false, n),
          steps = 0;
        assert.deepEqual(g, createGame(id, 'medium', seed, false, n));
        while (g.phase !== 'over') {
          assert.ok(isSavedGame(g), `${id}/${n}/${seed}/${steps}: valid save`);
          const count =
            g.reserve.length +
            g.players.reduce(
              (a, p) => a + p.hand.length + p.zones.flat().length,
              0,
            ) +
            (id === 'undertow' ? g.seen.length : 0);
          assert.equal(count, id === 'undertow' ? 60 : 72);
          const move = chooseMove(observe(g), 'medium');
          assert.ok(validMove(g, move));
          const previous = JSON.stringify(g);
          const next = play(g, move);
          assert.equal(JSON.stringify(g), previous);
          assert.equal(next.revision, g.revision + 1);
          g = next;
          assert.ok(++steps < 1500);
        }
        assert.ok(isSavedGame(g));
        assert.ok(scores(g).every(Number.isFinite));
      }
});
test('observation conceals every other seat and server-private information', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (let n = 2; n <= 6; n++) {
      const g = createGame(id, 'medium', 37, false, n);
      for (let viewer = 0; viewer < n; viewer++) {
        const view = observe(g, viewer);
        for (const key of ['rngState', 'reserve', 'passes', 'memory'])
          assert.equal(key in view, false);
        for (let i = 0; i < n; i++)
          if (i === viewer)
            assert.deepEqual(view.players[i].hand, g.players[i].hand);
          else
            assert.ok(
              view.players[i].hand.every(
                (c) => c.kind === -1 && c.rank === -1 && c.id < 0,
              ),
            );
      }
    }
});
test('all bot levels emit legal moves without access to hidden state', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (const difficulty of ['easy', 'medium', 'hard']) {
      let g = createGame(id, difficulty, 97, false, 3);
      for (let i = 0; i < 5; i++) {
        const move = chooseMove(observe(g), difficulty, 5, 3, 50);
        assert.ok(validMove(g, move));
        g = play(g, move);
      }
    }
});
test('pass validation and invalid actions leave the original game intact', () => {
  const g = createGame('undertow');
  const card = g.players[0].hand[0].id;
  assert.equal(
    validMove(g, { type: 'pass', cards: [card, card, card] }),
    false,
  );
  assert.equal(play(g, { type: 'play', card: -999 }), g);
  const passed = play(g, {
    type: 'pass',
    cards: g.players[0].hand.slice(0, 3).map((c) => c.id),
  });
  assert.equal(passed.active, 1);
  assert.equal(g.active, 0);
});
