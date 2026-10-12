import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  dawnValue,
  goldValue,
  seatRange,
  stormRanks,
  tideDeck,
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
      for (let seats = 3; seats <= (fast ? 4 : 6); seats++) {
        let g = createGame(
          'undertow',
          'easy',
          42,
          false,
          seats,
          expansion,
          fast,
        );
        const total = fast ? 30 : 60;
        assert.equal(tideRanks(g), fast ? 5 : 10);
        assert.equal(passCount(g), fast ? 3 : 5);
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
          simulatedCards.every(
            (c) => c.rank >= 1 && c.rank <= (c.kind === 4 ? stormRanks(g) : tideRanks(g)),
          ),
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
      assert.equal(tidePenaltyValue(g), fast ? 20 : 40);
      assert.equal(
        penalty(
          { id: rank, kind: 1, rank },
          1,
          tidePenaltyRank(g),
          tidePenaltyValue(g),
        ),
        rank === (fast ? 4 : 8) ? (fast ? 20 : 40) : 0,
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
    assert.ok(
      playState.players.every((p) =>
        p.hand.every((c) => c.rank <= (c.kind === 4 ? 10 : 5)),
      ),
    );
    assert.equal(tidePenaltyValue(playState), 20);
  }
});

await test('the Fast deck is the normal deck halved in every way', () => {
  const normal = { fastMode: false, round: 1 },
    fast = { fastMode: true, round: 1 };
  const suit = (g, kind) => tideDeck(g).filter((c) => c.kind === kind);
  // Plain suits 1–10 and Storm 1–20, as in Papayoo; Fast is 1–5 and 1–10.
  for (const kind of [0, 1, 2, 3]) {
    assert.deepEqual(suit(normal, kind).map((c) => c.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(suit(fast, kind).map((c) => c.rank), [1, 2, 3, 4, 5]);
  }
  assert.deepEqual(suit(normal, 4).map((c) => c.rank), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(suit(fast, 4).map((c) => c.rank), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.equal(tideDeck(normal).length, 60);
  assert.equal(tideDeck(fast).length, 30);
  assert.equal(new Set(tideDeck(normal).map((c) => c.id)).size, 60);
  for (const value of [tidePenaltyRank, tidePenaltyValue, goldValue, dawnValue, tideRanks, stormRanks])
    assert.equal(value(fast) * 2, value(normal), value.name);
  for (const seats of [3, 4])
    assert.equal(
      passCount({ players: Array(seats), fastMode: true }),
      Math.ceil(passCount({ players: Array(seats), fastMode: false }) / 2),
    );
});

await test('Nox seats three to six, and four at most on the Fast deck', () => {
  assert.deepEqual(seatRange('undertow'), [3, 6]);
  assert.deepEqual(seatRange('undertow', true), [3, 4]);
  assert.deepEqual(seatRange('wildgrove', true), [2, 6]);
  assert.throws(() => createGame('undertow', 'easy', 1, false, 2));
  assert.throws(() => createGame('undertow', 'easy', 1, false, 5, false, true));
  assert.ok(createGame('undertow', 'easy', 1, false, 6).players.length === 6);
  // Two-player and large Fast saves no longer resume.
  const duel = createGame('undertow', 'easy', 1, false, 3);
  duel.players.pop();
  assert.equal(isSavedGame(duel), false);
  const crowded = createGame('undertow', 'easy', 1, false, 5);
  crowded.fastMode = true;
  assert.equal(isSavedGame(crowded), false);
});
