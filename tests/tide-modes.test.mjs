import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  tideRanks,
  tidePenaltyRank,
  tidePenaltyValue,
  penalty,
  passCount,
  observe,
  play,
  validMove,
  isSavedGame,
} from '../lib/games/trio/engine.ts';
import { chooseMove, determinize } from '../lib/games/trio/bot.ts';

await test('both Tide modes deal equal hands and complete at every seat count with and without Safe Harbour', () => {
  for (const fast of [false, true])
    for (const expansion of [false, true])
      for (let seats = 2; seats <= 6; seats++) {
        let g = createGame(
          'undertow',
          'easy',
          42,
          false,
          seats,
          expansion,
          fast,
        );
        const total = seats === 2 ? (fast ? 15 : 25) : fast ? 25 : 50;
        assert.equal(tideRanks(g), fast ? 5 : 10);
        assert.equal(
          passCount(g),
          fast ? (seats <= 3 ? 3 : 2) : [3, 4, 3, 3, 2][seats - 2],
        );
        assert.equal(g.reserve.length, total % seats);
        assert.ok(
          g.players.every((p) => p.hand.length === Math.floor(total / seats)),
        );
        const simulation = determinize(observe(g), () => 0.5);
        const simulatedCards = [
          ...simulation.reserve,
          ...simulation.players.flatMap((p) => p.hand),
        ];
        assert.equal(new Set(simulatedCards.map((c) => c.id)).size, total);
        assert.ok(
          simulatedCards.every((c) => c.rank >= 1 && c.rank <= tideRanks(g)),
        );
        let steps = 0;
        while (g.phase !== 'over') {
          assert.ok(isSavedGame(g));
          assert.equal(
            g.reserve.length +
              g.seen.length +
              g.players.reduce((n, p) => n + p.hand.length, 0),
            total,
          );
          const move = chooseMove(observe(g), 'easy');
          assert.ok(validMove(g, move));
          g = play(g, move);
          assert.ok(++steps < 1000);
        }
      }
});

await test('only the matching 8 or fast 4 costs its mode bonus; Storm remains rank-valued', () => {
  for (const fast of [false, true]) {
    const g = createGame('undertow', 'easy', 1, false, 3, false, fast);
    for (let rank = 1; rank <= tideRanks(g); rank++) {
      assert.equal(tidePenaltyValue(g), fast ? 10 : 40);
      assert.equal(
        penalty(
          { id: rank, kind: 1, rank },
          1,
          tidePenaltyRank(g),
          tidePenaltyValue(g),
        ),
        rank === (fast ? 4 : 8) ? (fast ? 10 : 40) : 0,
      );
      assert.equal(
        penalty({ id: rank, kind: 4, rank }, 1, tidePenaltyRank(g)),
        rank,
      );
    }
    g.fastMode = 'invalid';
    assert.equal(isSavedGame(g), false);
  }
});

await test('pre-update rules versions cannot resume', () => {
  const g = createGame('undertow');
  g.version = 3;
  assert.equal(isSavedGame(g), false);
});

await test('Tide AI uses Fast mode card bounds, exchange size, and hazard value', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const g = createGame('undertow', difficulty, 77, false, 3, false, true);
    const move = chooseMove(observe(g), difficulty);
    assert.equal(move.type, 'pass');
    assert.equal(move.cards.length, 3);
    assert.ok(validMove(g, move));

    const playState = play(g, move);
    assert.ok(playState.players.every((p) => p.hand.every((c) => c.rank <= 5)));
    assert.equal(tidePenaltyValue(playState), 10);
  }
});
