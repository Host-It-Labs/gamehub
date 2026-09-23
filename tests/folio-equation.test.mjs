import test from 'node:test';
import assert from 'node:assert/strict';
import {
  equation,
  parse,
  canon,
  evaluate,
} from '../lib/games/folio/kinds/equation.ts';

const CASES = [
  [1, false],
  [2, false],
  [3, false],
  [4, false],
  [3, true],
  [1, true],
];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 97 + 3);
const clone = (v) => JSON.parse(JSON.stringify(v));

function drive(made, pick) {
  const view = clone(made.view);
  let remaining = made.allowance;
  let solved = false;
  while (remaining > 0 && !solved) {
    const r = equation.move(view, made.secret, pick(view, made.secret));
    remaining -= r.cost;
    solved = r.solved;
  }
  return { view, remaining, solved };
}

await test('evaluator follows precedence and rejects malformed input', () => {
  assert.equal(evaluate('2+3*4'), 14);
  assert.equal(evaluate('20-6/3'), 18);
  assert.equal(evaluate('8-2-3'), 3);
  assert.equal(evaluate('24/4/2'), 3);
  assert.equal(evaluate('3/2*4'), 6);
  for (const bad of [
    '-1+23',
    '1++23',
    '05+12',
    '12+',
    '*12',
    '4/0+1',
    '12 +3',
    '',
  ])
    assert.equal(parse(bad) && parse(bad).den === 1 ? 'ok' : null, null, bad);
});

await test('commutative forms match only when truly commutative', () => {
  const same = (a, b) => canon(parse(a)) === canon(parse(b));
  assert.ok(same('2+3*4', '4*3+2'));
  assert.ok(same('20-3+5', '5+20-3'));
  assert.ok(same('12*2/3', '2*12/3'));
  assert.ok(!same('20-3', '3-20'));
  assert.ok(!same('12/3', '3/12'));
  assert.ok(!same('8-2-3', '8-3+2'));
});

for (const [level, boss] of CASES) {
  const label = `level ${level}${boss ? ' boss' : ''}`;
  await test(`${label}: fast, deterministic, no leak, valid content`, () => {
    for (const seed of SEEDS) {
      const t = performance.now();
      const a = equation.make({ seed, level, boss });
      assert.ok(performance.now() - t < 100, 'make is fast');
      assert.deepEqual(equation.make({ seed, level, boss }), a);
      const { answer, alts } = a.secret;
      const json = JSON.stringify(a.view);
      assert.ok(!json.includes(answer));
      assert.equal(a.view.length, boss ? 8 : 6);
      assert.equal(answer.length, a.view.length);
      assert.ok(!/(^|\D)0\d/.test(answer));
      assert.equal(evaluate(answer), a.view.target);
      assert.ok(a.view.target > 0);
      assert.ok(parse(answer).exact);
      assert.ok(/[*/]/.test(answer));
      assert.ok(alts.length >= a.allowance + 2);
      const forms = new Set([canon(parse(answer))]);
      for (const alt of alts) {
        assert.equal(alt.length, a.view.length);
        assert.equal(evaluate(alt), a.view.target);
        forms.add(canon(parse(alt)));
      }
      assert.equal(forms.size, alts.length + 1);
      assert.equal(a.allowance, 6);
      assert.equal(a.budget, 'guesses');
    }
  });
  await test(`${label}: win and lose drills`, () => {
    for (const seed of SEEDS) {
      const made = equation.make({ seed, level, boss });
      const won = drive(made, (v, s) => equation.win(v, s));
      assert.ok(won.solved && won.remaining >= 0);
      assert.ok(won.view.guesses.at(-1).marks.every((m) => m === 2));
      const lost = drive(made, (v, s) => equation.lose(v, s));
      assert.ok(!lost.solved);
      assert.equal(lost.remaining, 0);
      // With an upgrade (+1 guess) the drill still has fresh alternatives.
      const extra = drive({ ...made, allowance: made.allowance + 1 }, (v, s) =>
        equation.lose(v, s),
      );
      assert.ok(!extra.solved);
      const text = equation.reveal(lost.view, made.secret, false);
      assert.equal(lost.view.answer, made.secret.answer);
      assert.ok(text.endsWith(`= ${made.view.target}`));
    }
  });
  await test(`${label}: malformed moves throw without changing the view`, () => {
    const made = equation.make({ seed: 11, level, boss });
    const view = clone(made.view);
    const before = JSON.stringify(view);
    const L = view.length;
    const wrongValue = made.secret.alts[0].replace(/\d$/, (d) =>
      String((Number(d) + 1) % 10),
    );
    for (const guess of [
      undefined,
      42,
      null,
      '',
      '1+2',
      '1'.repeat(L + 1),
      'a'.repeat(L),
      '+'.repeat(L),
      '-' + '1'.repeat(L - 1),
      '0' + '1+2'.padStart(L - 1, '1'),
      '1/0+' + '1'.repeat(L - 4),
      wrongValue,
    ])
      assert.throws(
        () => equation.move(view, made.secret, { guess }),
        String(guess),
      );
    assert.throws(
      () => equation.move(view, made.secret, { guess: wrongValue }),
      /must equal/,
    );
    assert.equal(JSON.stringify(view), before);
  });
}

await test('a commutative reordering of the answer solves and shows the answer', () => {
  for (const seed of SEEDS) {
    const made = equation.make({ seed, level: 1, boss: false });
    const p = parse(made.secret.answer);
    // Rebuild with additive terms reversed when that keeps the first term positive.
    const terms = made.secret.answer.split(/(?=[+-])/);
    if (terms.length < 2 || terms.some((t) => t.startsWith('-'))) continue;
    const swapped = [terms[1].slice(1), ...terms.slice(2), terms[0]].join('+');
    if (swapped === made.secret.answer) continue;
    assert.equal(canon(parse(swapped)), canon(p));
    const view = clone(made.view);
    const r = equation.move(view, made.secret, { guess: swapped });
    assert.ok(r.solved);
    assert.equal(view.guesses[0].word, made.secret.answer);
    assert.ok(view.guesses[0].marks.every((m) => m === 2));
  }
});
