import test from 'node:test';
import assert from 'node:assert/strict';
import {
  standaloneGames,
  standaloneIds,
  observe,
  botMove,
  decisionKey,
} from '../lib/games/standalone/registry.ts';
import { topics, liveTopicIds } from '../lib/games/party/catalog.ts';
import * as ranking from '../lib/games/party/ranking.ts';

import { practice, advancePractice } from '../lib/games/adventures/lessons.ts';
import { skipOpening } from './tribu-helpers.mjs';
const permutations = (n) =>
  n === 0
    ? [[]]
    : permutations(n - 1).flatMap((p) =>
        Array.from({ length: n }, (_, i) => [
          ...p.slice(0, i),
          n - 1,
          ...p.slice(i),
        ]),
      );
function ranked(id = 'orin', n = 4) {
  let g = skipOpening(standaloneGames[id].create(n, 77, 'medium'));
  for (let s = 0; s < n; s++) {
    g = ranking.play(g, { type: 'topic', target: g.offers[s][0] }, s);
    g = ranking.play(
      g,
      {
        type: 'arrange',
        order: Array.from(
          { length: ranking.count(g) },
          (_, i) => i,
        ).toReversed(),
      },
      s,
    );

    g = ranking.play(g, { type: 'lock' }, s);
  }
  return g;
}
await test('179 original topics, 96 still dealt, have six distinct answers and fresh three-topic offers', () => {
  assert.equal(topics.length, 179);
  assert.equal(new Set(topics.map((t) => t.title)).size, 179);
  assert.equal(liveTopicIds.length, 96);
  assert.ok(liveTopicIds.every((id) => !topics[id].retired));
  assert.equal(new Set(topics.map((t) => t.category)).size, 8);
  for (const t of topics) {
    assert.equal(t.answers.length, 6);
    assert.equal(new Set(t.answers).size, 6);
    assert.ok(t.answers.every((a) => a.length > 0));
  }
  for (const id of ['orin']) {
    const g = standaloneGames[id].create(6, 5, 'medium');
    assert.equal(new Set(g.offers.flat()).size, 18);
    assert.ok(g.offers.every((a) => a.length === (3)));
  }
});
await test('every seat count completes reproducibly, preserves inputs and saves at every phase', () => {
  for (const id of standaloneIds)
    for (const seats of standaloneGames[id].seatChoices)
      for (let seed = 1; seed <= 12; seed++) {
        const e = standaloneGames[id];
        // With Votes on, so bots can vote each round away.
        let g = e.create(seats, seed, 'hard', undefined, undefined, undefined, true),
          steps = 0;
        while (!g.over && steps++ < 1000) {
          assert.ok(
            e.isSavedGame(JSON.parse(JSON.stringify(g))),
            `${id} invalid ${g.phase}`,
          );
          const before = JSON.stringify(g);
          // Reveals wait on the host alone; seat 0 stands in for them here.
          const s = g.phase === 'reveal' ? 0 : e.actingSeats(g)[0],
            m = g.phase === 'reveal' ? { type: 'next' } : botMove(g, s);
          assert.ok(m, `${id} stalled ${g.phase}`);
          assert.ok(e.validMove(g, m, s));
          // Pin the clock: end-of-round votes carry a deadline.
          const now = 1_000_000 + steps;
          const next = e.play(g, m, s, now);
          assert.deepEqual(next, e.play(g, m, s, now));
          assert.notEqual(next, g);
          assert.equal(JSON.stringify(g), before);
          assert.equal(next.revision, g.revision + 1);
          g = next;
        }
        assert.ok(g.over, `${id} did not finish`);
        assert.deepEqual(e.actingSeats(g), []);
        assert.ok(e.outcome(g).winners.length > 0);
      }
});
await test('ranking drafts, offers, future lists, guesses and seeds stay private', () => {
  let g = ranked('orin');
  assert.equal(g.phase, 'guess');
  const answer = g.ballots[0].order;
  g = ranking.play(g, { type: 'arrange', author: 0, order: [...answer] }, 1);
  for (let viewer = -1; viewer < 4; viewer++) {
    const v = observe(g, viewer);
    assert.equal(v.rngState, 0);
    assert.deepEqual(v.deck, []);
    for (let other = 0; other < 4; other++) {
      if (other === viewer) continue;
      assert.deepEqual(v.offers[other], []);
      assert.deepEqual(v.ballots[other].order, []);
      assert.equal(v.ballots[other].topic, g.ballots[other].topic);
      assert.ok(v.guesses[other].orders.every((o) => o === null));
    }
  }
  assert.deepEqual(observe(g, 1).guesses[1].orders[0], answer);
  // Before the guessing starts, other prompts are hidden too.
  const early = skipOpening(standaloneGames.orin.create(3, 4, 'medium'));
  const e1 = ranking.play(early, { type: 'topic', target: early.offers[0][0] }, 0);
  assert.equal(observe(e1, 1).ballots[0].topic, -1);
});
await test('all permutations are accepted; duplicate, incomplete, outsider and hostile moves are rejected', () => {
  for (const id of ['orin']) {
    const e = standaloneGames[id];
    let g = skipOpening(e.create(4, 1, 'easy'));
    g = e.play(g, { type: 'topic', target: g.offers[0][0] }, 0);
    if (id === 'orin')
      for (const order of permutations(ranking.count(g)))
        assert.ok(e.validMove(g, { type: 'arrange', order }, 0));
    else
      assert.equal(
        e.validMove(g, { type: 'arrange', order: [0, 1, 2, 3, 4, 5] }, 0),
        false,
      );
    for (const m of [
      null,
      {},
      [],
      { type: 'arrange', order: [0, 0, 1, 2, 3] },
      { type: 'arrange', order: [] },
      { type: 'topic', target: -1 },
      { type: 'lock', admin: true },
      { type: 'next' },
      { type: 'ready' },
    ])
      assert.equal(e.play(g, m, 0), g);
    assert.equal(e.play(g, { type: 'lock' }, -1), g);
    assert.equal(e.play(g, { type: 'lock' }, 4), g);
  }
});
await test('simultaneous ranking locks are atomic and independent of submission order', () => {
  for (const id of ['orin']) {
    let g = skipOpening(standaloneGames[id].create(4, 8, 'medium'));
    for (let s = 0; s < 4; s++)
      g = ranking.play(g, { type: 'topic', target: g.offers[s][0] }, s);

    let a = g,
      b = g;
    for (const s of [0, 1, 2]) a = ranking.play(a, { type: 'lock' }, s);
    assert.equal(a.phase, 'rank');
    assert.deepEqual(observe(a, 3).ballots[0].order, []);
    a = ranking.play(a, { type: 'lock' }, 3);
    for (const s of [3, 2, 1, 0]) b = ranking.play(b, { type: 'lock' }, s);
    assert.deepEqual(a, b);
    assert.equal(a.phase, 'guess');
  }
});
await test('withdraw before final lock; one next moves the reveal on without waiting for everyone', () => {
  let g = skipOpening(standaloneGames.orin.create(2, 33, 'medium'));
  g = ranking.play(g, { type: 'topic', target: g.offers[0][0] }, 0);
  g = ranking.play(g, { type: 'lock' }, 0);
  g = ranking.play(g, { type: 'unlock' }, 0);
  assert.equal(g.ballots[0].locked, false);
  g = ranked('orin', 2);
  g = ranking.play(g, { type: 'lock' }, 0);
  assert.equal(g.phase, 'guess');
  g = ranking.play(g, { type: 'lock' }, 1);
  assert.equal(g.phase, 'reveal');
  const key = decisionKey(g);
  assert.deepEqual(ranking.actingSeats(g), []);
  assert.equal(ranking.botMove(g, 1), null);
  assert.equal(ranking.play(g, { type: 'ready' }, 0), g);
  g = ranking.play(g, { type: 'next' }, 0);
  assert.equal(g.target, 1);
  assert.equal(g.phase, 'reveal', 'every list was guessed at once');
  assert.notEqual(decisionKey(g), key);
});
await test('save markers reject all retired games and malformed structures', () => {
  for (const id of standaloneIds) {
    const e = standaloneGames[id],
      g = e.create(4, 5, 'easy');
    for (const change of [
      { rules: 2 },
      { rules: ['dial', 'impostor'].includes(id) ? 99 : 1 },
      { seats: [] },
      { round: 0 },
      { round: 13 },
      { phase: 'unknown' },
      ['miro', 'size', 'year', 'order'].includes(id)
        ? { ready: [] }
        : id === 'impostor'
          ? { sketches: [] }
          : { guesses: [] },
      { phase: 'vote', vote: null },
      { rngState: null },
      { scores: [NaN] },
    ])
      assert.equal(e.isSavedGame({ ...g, ...change }), false);
    assert.equal(e.isSavedGame(null), false);
  }
});
await test('practice is explicit and separate from real matches', () => {
  for (const id of standaloneIds) {
    const g = practice(id, 4, 'medium', 2);
    assert.equal(g.tutorial, true);
    assert.equal(g.lesson, 2);
    const real = standaloneGames[id].create(4, 55, 'medium');
    assert.equal(real.tutorial, false);
    assert.equal(advancePractice(real), real);
  }
});
