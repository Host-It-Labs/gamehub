import assert from 'node:assert/strict';
import test from 'node:test';
import { four } from '../lib/games/folio/kinds/four.ts';
import { ANSWERS, GUESSES } from '../lib/games/folio/words.ts';

const CASES = [
  { level: 1, boss: false },
  { level: 2, boss: false },
  { level: 3, boss: false },
  { level: 4, boss: false },
  { level: 4, boss: true },
  { level: 3, boss: true },
];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);
const clone = (v) => JSON.parse(JSON.stringify(v));
const leaks = (view, answers) => {
  const text = JSON.stringify(view);
  return answers.filter((a) => text.includes(a));
};

for (const ctx of CASES) {
  const label = `level ${ctx.level}${ctx.boss ? ' boss' : ''}`;

  await test(`${label}: make is fast, deterministic and hides the answers`, () => {
    for (const seed of SEEDS) {
      const t = performance.now();
      const a = four.make({ ...ctx, seed });
      assert.ok(performance.now() - t < 100);
      assert.deepEqual(four.make({ ...ctx, seed }), a);
      assert.equal(a.allowance, ctx.boss ? 10 : 9);
      assert.equal(a.budget, 'guesses');
      assert.equal(new Set(a.secret.answers).size, 4);
      for (const w of a.secret.answers)
        assert.ok(ANSWERS.includes(w) && GUESSES.has(w));
      assert.deepEqual(leaks(a.view, a.secret.answers), []);
      assert.deepEqual(
        a.view.boards.map((b) => b.locked),
        ctx.boss ? [false, true, true, true] : [false, false, false, false],
      );
    }
  });

  await test(`${label}: the win drill solves within the allowance`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = four.make({ ...ctx, seed });
      let used = 0;
      let solved = false;
      while (!solved) {
        const r = four.move(view, secret, four.win(view, secret));
        used += r.cost;
        solved = r.solved;
        assert.ok(used <= allowance);
      }
      assert.equal(used, 4);
      view.boards.forEach((b, i) => {
        assert.equal(b.solved, i);
        assert.equal(b.marks.length, i + 1);
        assert.deepEqual(b.marks[i], [2, 2, 2, 2, 2]);
      });
    }
  });

  await test(`${label}: the lose drill spends the allowance without solving`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = four.make({ ...ctx, seed });
      let used = 0;
      while (used < allowance) {
        const r = four.move(view, secret, four.lose(view, secret));
        assert.equal(r.solved, false);
        used += r.cost;
      }
      assert.deepEqual(leaks(view, secret.answers), []);
      view.boards.forEach((b) => {
        assert.equal(b.solved, null);
        assert.equal(b.marks.length, ctx.boss && b.locked ? 0 : allowance);
      });
      four.reveal(view, secret, false);
      view.boards.forEach((b, i) => {
        assert.equal(b.answer, secret.answers[i]);
        assert.equal(b.locked, false);
        assert.equal(b.marks.length, allowance);
      });
    }
  });

  await test(`${label}: malformed and unknown guesses are rejected without change`, () => {
    const { view, secret } = four.make({ ...ctx, seed: 11 });
    four.move(view, secret, four.lose(view, secret));
    const before = clone(view);
    for (const m of [
      {},
      { guess: 12345 },
      { guess: ['CRANE'] },
      { guess: 'CRAN' },
      { guess: 'CRANES' },
      { guess: 'CR4NE' },
      { guess: 'ZZZZZ' },
      { guess: 'QXJKV' },
    ])
      assert.throws(() => four.move(view, secret, m));
    assert.throws(
      () => four.move(view, secret, { guess: 'ZZZZZ' }),
      /Not in word list/,
    );
    assert.deepEqual(view, before);
  });
}

await test('each guess is graded on every unsolved board; solved boards stop', () => {
  const { view, secret } = four.make({ level: 1, boss: false, seed: 5 });
  four.move(view, secret, { guess: secret.answers[2] });
  assert.equal(view.boards[2].solved, 0);
  four.move(view, secret, four.lose(view, secret));
  four.move(view, secret, four.lose(view, secret));
  assert.equal(view.boards[2].marks.length, 1);
  for (const i of [0, 1, 3]) assert.equal(view.boards[i].marks.length, 3);
});

await test('Sequence unlocks boards in order and grades earlier guesses retroactively', () => {
  const { view, secret } = four.make({ level: 3, boss: true, seed: 9 });
  // Solve board 4 and board 3 early: they stay hidden while locked.
  four.move(view, secret, { guess: secret.answers[3] });
  four.move(view, secret, { guess: secret.answers[2] });
  assert.equal(view.boards[0].marks.length, 2);
  for (const i of [1, 2, 3]) assert.deepEqual(view.boards[i].marks, []);
  assert.deepEqual(leaks(view, [secret.answers[0], secret.answers[1]]), []);
  four.move(view, secret, { guess: secret.answers[1] });
  assert.deepEqual(leaks(view, [secret.answers[0]]), []);
  // Solving board 1 unlocks board 2, which was already guessed at row 2, which
  // cascades into boards 3 and 4 (guessed at rows 1 and 0).
  const r = four.move(view, secret, { guess: secret.answers[0] });
  assert.equal(r.solved, true);
  assert.deepEqual(
    view.boards.map((b) => b.solved),
    [3, 2, 1, 0],
  );
  assert.equal(view.boards[1].marks.length, 3);
  assert.deepEqual(view.boards[3].marks, [[2, 2, 2, 2, 2]]);
});
