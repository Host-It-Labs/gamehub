import assert from 'node:assert/strict';
import test from 'node:test';
import { groups, POOLS } from '../lib/games/folio/kinds/groups.ts';

const CASES = [
  { level: 1, boss: false },
  { level: 2, boss: false },
  { level: 3, boss: false },
  { level: 4, boss: false },
  { level: 4, boss: true },
  { level: 3, boss: true },
];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);

await test('content: every puzzle is four clean groups of four', () => {
  assert.ok(POOLS['1'].length >= 8);
  assert.ok(POOLS['2'].length >= 8);
  assert.ok(POOLS['3'].length >= 8);
  assert.ok(POOLS.boss.length >= 6);
  for (const [pool, puzzles] of Object.entries(POOLS))
    for (const puzzle of puzzles) {
      const label = `${pool}: ${puzzle.map((g) => g.name).join(', ')}`;
      assert.equal(puzzle.length, 4, label);
      assert.deepEqual(
        puzzle.map((g) => g.level).sort((a, b) => a - b),
        [1, 2, 3, 4],
        label,
      );
      const words = puzzle.flatMap((g) => g.words);
      assert.equal(words.length, 16, label);
      assert.equal(new Set(words).size, 16, `duplicate word in ${label}`);
      assert.equal(new Set(puzzle.map((g) => g.name)).size, 4, label);
      for (const w of words) {
        assert.match(w, /^[A-Z]+( [A-Z]+)?$/, `${w} in ${label}`);
        assert.ok(w.length <= 12, `${w} too long`);
        for (const part of w.split(' '))
          assert.ok(part.length <= 10, `${w} too long`);
      }
    }
});

for (const { level, boss } of CASES) {
  const tag = `level ${level}${boss ? ' boss' : ''}`;
  await test(`${tag}: make is fast, deterministic and hides the answer`, () => {
    for (const seed of SEEDS) {
      const t = performance.now();
      const a = groups.make({ level, boss, seed });
      assert.ok(performance.now() - t < 50);
      const b = groups.make({ level, boss, seed });
      assert.deepEqual(a, b);
      assert.equal(a.allowance, boss ? 3 : 4);
      assert.equal(a.view.words.length, 16);
      const json = JSON.stringify(a.view);
      for (const g of a.secret.groups)
        assert.ok(!json.includes(g.name), `leaks ${g.name}`);
    }
  });

  await test(`${tag}: the win drill solves without a mistake`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = groups.make({ level, boss, seed });
      let spent = 0,
        solved = false,
        steps = 0;
      while (!solved) {
        const r = groups.move(view, secret, groups.win(view, secret));
        spent += r.cost;
        solved = r.solved;
        assert.ok(++steps <= 4);
      }
      assert.ok(spent < allowance);
      assert.equal(view.solved.length, 4);
      groups.reveal(view, secret, true);
      assert.ok(view.solved.every((b) => !b.revealed));
    }
  });

  await test(`${tag}: the lose drill spends the allowance without solving`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = groups.make({ level, boss, seed });
      let spent = 0;
      while (spent < allowance) {
        const r = groups.move(view, secret, groups.lose(view, secret));
        assert.equal(r.solved, false);
        assert.equal(r.cost, 1);
        spent += r.cost;
      }
      const answer = groups.reveal(view, secret, false);
      assert.equal(view.solved.length, 4);
      assert.ok(view.solved.every((b) => b.revealed));
      for (const g of secret.groups) assert.ok(answer.includes(g.name));
    }
  });

  await test(`${tag}: malformed and repeated moves are rejected for free`, () => {
    const { view, secret } = groups.make({ level, boss, seed: 11 });
    const w = view.words;
    const bad = [
      {},
      { words: 'ABCD' },
      { words: w.slice(0, 3) },
      { words: w.slice(0, 5) },
      { words: [w[0], w[0], w[1], w[2]] },
      { words: [w[0], w[1], w[2], 4] },
      { words: [w[0], w[1], w[2], 'NOT A WORD'] },
      { words: [w[0], w[1], w[2], w[3].toLowerCase()] },
    ];
    const before = JSON.stringify(view);
    for (const m of bad) assert.throws(() => groups.move(view, secret, m));
    assert.equal(JSON.stringify(view), before);

    const wrong = groups.lose(view, secret);
    groups.move(view, secret, wrong);
    const after = JSON.stringify(view);
    assert.throws(
      () => groups.move(view, secret, { words: [...wrong.words].reverse() }),
      /Already guessed!/,
    );
    assert.equal(JSON.stringify(view), after);

    const right = groups.win(view, secret);
    groups.move(view, secret, right);
    assert.throws(
      () => groups.move(view, secret, right),
      /no longer on the board/,
    );
  });
}

await test('three of a group is "one away" and still costs a mistake', () => {
  const { view, secret } = groups.make({ level: 1, boss: false, seed: 5 });
  const [a, b] = secret.groups;
  const r = groups.move(view, secret, {
    words: [...a.words.slice(0, 3), b.words[0]],
  });
  assert.equal(r.cost, 1);
  assert.equal(view.tries.at(-1).verdict, 1);
  const r2 = groups.move(view, secret, {
    words: [...a.words.slice(0, 2), ...b.words.slice(0, 2)],
  });
  assert.equal(r2.cost, 1);
  assert.equal(view.tries.at(-1).verdict, 0);
});
