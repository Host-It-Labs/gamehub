import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import * as size from '../lib/games/party/size.ts';
import { things } from '../lib/games/party/size-things.ts';
import countries from '../lib/games/party/size-countries.json' with { type: 'json' };
import silhouettes from '../lib/games/party/size-silhouettes.json' with { type: 'json' };

/** Everyone sizes all three comparisons (factors of each answer, per seat)
 * and locks once. */
function everyoneGuesses(g, factors = []) {
  for (let s = 0; s < g.seats.length; s++) {
    g.questions.forEach((q, step) => {
      const f = factors[s];
      g = size.play(
        g,
        {
          type: 'guess',
          step,
          value: q.answer * ((Array.isArray(f) ? f[step] : f) ?? 2),
        },
        s,
        0,
      );
    });
    g = size.play(g, { type: 'lock' }, s, 0);
  }
  return g;
}
/** Guesses, then the host reveals all three, through one whole round. */
function playRound(g) {
  g = everyoneGuesses(g);
  for (let step = 0; step < 3; step++) g = size.play(g, { type: 'next' }, 0, 0);
  return g;
}

await test('Size It Up’s curve: relative error to points out of 100', () => {
  assert.equal(size.points(100, 100), 100);
  assert.equal(size.points(106, 100), 100);
  assert.equal(size.points(88, 100), 90);
  assert.equal(size.points(120, 100), 78);
  assert.equal(size.points(150, 100), 45);
  // 139.7 m for a 244 m bridge is 43% off and scores 52, as on Magnitudle.
  assert.equal(size.points(139.7, 244), 52);
  assert.equal(size.points(260, 100), 0);
  assert.equal(size.points(0, 100), 0);
  assert.ok(size.points(50, 100) > size.points(40, 100));
});

await test('a round is an animal, an object or landmark, then a country', () => {
  let g = size.createGame(3, 7);
  assert.equal(g.questions.length, 3);
  assert.deepEqual(
    g.questions.map((q) => q.kind),
    ['thing', 'thing', 'country'],
  );
  assert.equal(size.thing(g.questions[0].target).sheet, 'animals');
  assert.notEqual(size.thing(g.questions[1].target).sheet, 'animals');
  assert.ok(size.validState(g));
  g = playRound(g);
  assert.equal(g.phase, 'vote');
  assert.ok(size.validState(g));
  for (let s = 0; s < 3; s++)
    g = size.play(g, { type: 'vote', choice: 'more' }, s, 0);
  assert.equal(g.round, 2);
  assert.equal(g.phase, 'guess');
  assert.equal(g.step, 0);
});

await test('every pair fits on screen and never repeats in a match', () => {
  let g = size.createGame(2, 99);
  const seen = new Set();
  for (let round = 1; round <= 12; round++) {
    for (const q of g.questions) {
      const r =
        size.measure(q.kind, q.target).real / size.measure(q.kind, q.ref).real;
      assert.ok(r >= 0.2 && r <= 8, `${q.ref}>${q.target} = ${r}`);
      assert.equal(q.answer, size.measure(q.kind, q.target).real);
      const key = `${q.ref}>${q.target}`;
      assert.ok(!seen.has(key), `repeated ${key}`);
      seen.add(key);
    }
    if (round === 12) break;
    g = playRound(g);
    for (let s = 0; s < 2; s++)
      g = size.play(g, { type: 'vote', choice: 'more' }, s, 0);
  }
});

await test('all three are sized and locked once, then revealed one at a time', () => {
  let g = size.createGame(2, 3);
  g = everyoneGuesses(g, [
    [1, 1.1, 1],
    [10, 1, 1],
  ]);
  assert.equal(g.phase, 'reveal');
  assert.equal(g.step, 0);
  assert.deepEqual(g.scores, [100, 0]);
  assert.deepEqual(g.gains, [[100, 0]]);
  assert.ok(size.validState(g));
  // Nobody but the host's Next moves on; bots don't either.
  assert.equal(size.botMove(g, 1), null);
  g = size.play(g, { type: 'next' }, 1, 0);
  assert.equal(g.phase, 'reveal');
  assert.equal(g.step, 1);
  assert.deepEqual(g.scores, [100 + size.points(1.1, 1), 100]);
  assert.ok(size.validState(g));
  g = size.play(g, { type: 'next' }, 0, 0);
  assert.equal(g.step, 2);
  assert.deepEqual(g.gains.length, 3);
  g = size.play(g, { type: 'next' }, 0, 0);
  assert.equal(g.phase, 'vote');
  assert.ok(size.validState(g));
});

await test('another seat’s guess and the answer stay hidden until the reveal', () => {
  let g = size.createGame(3, 11);
  g = size.play(g, { type: 'lock', values: [42, 43, 44] }, 1, 0);
  const view = size.observe(g, 0);
  assert.deepEqual(view.guesses[1].values, [null, null, null]);
  assert.equal(view.guesses[1].locked, true);
  assert.ok(view.questions.every((q) => q.answer === -1));
  assert.deepEqual(size.observe(g, 1).guesses[1].values, [42, 43, 44]);
  g = everyoneGuesses(g);
  const reveal = size.observe(g, 0);
  assert.ok(reveal.questions[0].answer > 0);
  assert.equal(reveal.questions[1].answer, -1);
  assert.equal(reveal.guesses[1].values[0], 42);
  assert.equal(reveal.guesses[1].values[1], null);
  assert.ok(
    reveal.guesses[0].values.every((v) => v > 0),
    'your own stay',
  );
  g = size.play(g, { type: 'next' }, 0, 0);
  const next = size.observe(g, 0);
  assert.deepEqual(next.guesses[1].values, [42, 43, null]);
});

await test('a lock needs a guess, can be undone, and rejects bad values', () => {
  let g = size.createGame(2, 5);
  assert.equal(size.play(g, { type: 'lock' }, 0, 0), g);
  for (const value of [0, -1, NaN, Infinity, 1e7])
    assert.equal(size.play(g, { type: 'guess', step: 0, value }, 0, 0), g);
  for (const step of [-1, 3, 0.5, undefined])
    assert.equal(size.play(g, { type: 'guess', step, value: 5 }, 0, 0), g);
  assert.equal(
    size.play(g, { type: 'guess', step: 0, value: 5, question: 0 }, 0, 0),
    g,
  );
  g = size.play(g, { type: 'guess', step: 0, value: 1234.5678 }, 0, 0);
  assert.equal(g.guesses[0].values[0], 1235);
  // Every comparison needs a size before the lock.
  assert.equal(size.play(g, { type: 'lock' }, 0, 0), g);
  g = size.play(g, { type: 'guess', step: 1, value: 2 }, 0, 0);
  g = size.play(g, { type: 'guess', step: 2, value: 3 }, 0, 0);
  g = size.play(g, { type: 'lock' }, 0, 0);
  assert.ok(g.guesses[0].locked);
  assert.equal(size.play(g, { type: 'guess', step: 0, value: 3 }, 0, 0), g);
  g = size.play(g, { type: 'unlock' }, 0, 0);
  assert.equal(g.guesses[0].locked, false);
  // A lock can carry all three sizes in one move.
  g = size.play(g, { type: 'lock', values: [7, 8, 9] }, 0, 0);
  assert.deepEqual(g.guesses[0].values, [7, 8, 9]);
  assert.ok(g.guesses[0].locked);
  for (const values of [[1, 2], [1, 2, -2], 5])
    assert.equal(
      size.play(g, { type: 'lock', values }, 1, 0).revision,
      g.revision,
    );
  assert.ok(size.validState(g));
});

await test('bots never see answers and finish their turns', () => {
  let g = size.createGame(3, 21);
  for (let s = 0; s < 3; s++) {
    let guard = 0;
    while (!g.guesses[s].locked && guard++ < 10)
      g = size.play(g, size.botMove(size.observe(g, s), s), s, 0);
  }
  assert.equal(g.phase, 'reveal');
});

await test('catalogue data is complete and every silhouette has a box', async () => {
  const cells = new Set(things.map((t) => `${t.sheet}:${t.cell}`));
  assert.equal(cells.size, things.length);
  assert.equal(things.length, 48);
  for (const t of things) {
    assert.ok(t.real > 0 && t.fact && t.name, t.id);
    assert.ok(['h', 'w'].includes(t.axis), t.id);
    const box = silhouettes.sheets[t.sheet][t.cell];
    assert.ok(box.w > 20 && box.h > 20, t.id);
  }
  for (const sheet of ['animals', 'objects', 'landmarks'])
    assert.ok(
      (await stat(`public/art/optimized/sizes-sil-${sheet}-v1.webp`)).size > 0,
    );
  for (const c of countries)
    assert.ok(
      c.area > 0 && c.width > 0 && c.height > 0 && c.path.startsWith('M'),
      c.id,
    );
});
