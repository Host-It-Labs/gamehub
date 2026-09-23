import assert from 'node:assert/strict';
import test from 'node:test';
import { code, score } from '../lib/games/folio/kinds/code.ts';

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

await test('scoring follows classic Mastermind counting with repeats', () => {
  assert.deepEqual(score([0, 1, 2, 3], [0, 1, 2, 3]), { black: 4, white: 0 });
  assert.deepEqual(score([3, 2, 1, 0], [0, 1, 2, 3]), { black: 0, white: 4 });
  assert.deepEqual(score([0, 0, 1, 1], [0, 1, 0, 2]), { black: 1, white: 2 });
  assert.deepEqual(score([0, 0, 0, 0], [0, 1, 2, 3]), { black: 1, white: 0 });
  assert.deepEqual(score([1, 0, 0, 0], [0, 1, 1, 1]), { black: 0, white: 2 });
  assert.deepEqual(score([4, 4, 5, 5], [0, 1, 2, 3]), { black: 0, white: 0 });
  assert.deepEqual(score([0, 1, 2, 3, 4], [4, 1, 2, 3, 0]), {
    black: 3,
    white: 2,
  });
});

for (const ctx of CASES) {
  const label = `level ${ctx.level}${ctx.boss ? ' boss' : ''}`;
  const pegs = ctx.boss ? 5 : 4;
  const colours = ctx.boss ? 8 : 6;
  const rows = ctx.boss ? 12 : 10;

  await test(`${label}: make is fast, deterministic and hides the code`, () => {
    for (const seed of SEEDS) {
      const t = performance.now();
      const a = code.make({ ...ctx, seed });
      assert.ok(performance.now() - t < 50);
      assert.deepEqual(code.make({ ...ctx, seed }), a);
      assert.equal(a.allowance, rows);
      assert.equal(a.budget, 'rows');
      assert.deepEqual(a.view, {
        pegs,
        colours,
        rows,
        repeats: ctx.level > 1,
        guesses: [],
      });
      assert.equal(a.secret.answer.length, pegs);
      for (const c of a.secret.answer)
        assert.ok(Number.isInteger(c) && c >= 0 && c < colours);
      if (ctx.level === 1) assert.equal(new Set(a.secret.answer).size, pegs);
      if (ctx.level === 4 && !ctx.boss)
        assert.ok(new Set(a.secret.answer).size < pegs, 'very hard repeats');
      assert.ok(!JSON.stringify(a.view).includes('answer'));
    }
  });

  await test(`${label}: codes vary across seeds`, () => {
    const seen = new Set(
      SEEDS.map((seed) => code.make({ ...ctx, seed }).secret.answer.join()),
    );
    assert.ok(seen.size > 20);
  });

  await test(`${label}: the win drill solves on the first row`, () => {
    for (const seed of SEEDS) {
      const { view, secret } = code.make({ ...ctx, seed });
      const r = code.move(view, secret, code.win(view, secret));
      assert.deepEqual(r, { cost: 1, solved: true });
      assert.deepEqual(view.guesses[0], {
        code: secret.answer,
        black: pegs,
        white: 0,
      });
      assert.equal(code.reveal(view, secret, true).split(' · ').length, pegs);
      assert.deepEqual(view.answer, secret.answer);
    }
  });

  await test(`${label}: the lose drill spends every row (plus an upgrade row) without solving`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = code.make({ ...ctx, seed });
      for (let used = 0; used < allowance + 1; used++) {
        const r = code.move(view, secret, code.lose(view, secret));
        assert.deepEqual(r, { cost: 1, solved: false });
        const last = view.guesses.at(-1);
        assert.deepEqual(
          { black: last.black, white: last.white },
          score(last.code, secret.answer),
        );
      }
      assert.equal(
        new Set(view.guesses.map((g) => g.code.join())).size,
        allowance + 1,
      );
      assert.equal(view.answer, undefined);
      code.reveal(view, secret, false);
      assert.deepEqual(view.answer, secret.answer);
    }
  });

  await test(`${label}: malformed and repeated rows are rejected without changing the view`, () => {
    const { view, secret } = code.make({ ...ctx, seed: 11 });
    code.move(view, secret, code.lose(view, secret));
    const before = clone(view);
    const bad = [
      {},
      { guess: 'RGBY' },
      { guess: [0, 1, 2] },
      { guess: Array(pegs + 1).fill(0) },
      { guess: [...Array(pegs - 1).fill(0), colours] },
      { guess: [...Array(pegs - 1).fill(0), -1] },
      { guess: [...Array(pegs - 1).fill(0), 1.5] },
      { guess: [...Array(pegs - 1).fill(0), '1'] },
      { guess: [...Array(pegs - 1).fill(0), null] },
      { guess: [...before.guesses[0].code] },
    ];
    for (const m of bad) {
      assert.throws(() => code.move(view, secret, m));
      assert.deepEqual(view, before);
    }
    // Guesses may repeat colours even when the code does not.
    assert.doesNotThrow(() =>
      code.move(view, secret, { guess: Array(pegs).fill(colours - 1) }),
    );
  });
}
