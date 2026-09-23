import test from 'node:test';
import assert from 'node:assert/strict';
import { sudoku } from '../lib/games/folio/kinds/sudoku.ts';
import { SUDOKU_BANK } from '../lib/games/folio/sudoku-data.ts';

const CASES = [
  { level: 1, boss: false, tier: 'easy', min: 38, max: 42 },
  { level: 2, boss: false, tier: 'medium', min: 31, max: 34 },
  { level: 3, boss: false, tier: 'hard', min: 26, max: 30 },
  { level: 4, boss: false, tier: 'expert', min: 22, max: 25 },
  { level: 3, boss: true, tier: 'expert', min: 22, max: 25 },
];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);

const PEERS = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9),
    c = i % 9,
    b = Math.floor(r / 3) * 3 * 9 + Math.floor(c / 3) * 3;
  const s = new Set();
  for (let k = 0; k < 9; k++) {
    s.add(r * 9 + k);
    s.add(k * 9 + c);
    s.add(b + Math.floor(k / 3) * 9 + (k % 3));
  }
  s.delete(i);
  return [...s];
});
function count(grid, limit = 2) {
  const g = [...grid];
  let n = 0;
  const rec = () => {
    let best = -1,
      opts = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const o = [];
      for (let d = 1; d <= 9; d++)
        if (!PEERS[i].some((p) => g[p] === d)) o.push(d);
      if (!o.length) return;
      if (!opts || o.length < opts.length) [best, opts] = [i, o];
    }
    if (best < 0) return void n++;
    for (const d of opts) {
      g[best] = d;
      rec();
      if (n >= limit) return;
    }
    g[best] = 0;
  };
  rec();
  return n;
}
function singlesSolvable(grid) {
  const g = [...grid];
  const opts = (i) =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
      (d) => !PEERS[i].some((p) => g[p] === d),
    );
  for (let progress = true; progress;) {
    progress = false;
    for (let i = 0; i < 81; i++)
      if (!g[i]) {
        const o = opts(i);
        if (o.length === 1) [g[i], progress] = [o[0], true];
      }
    for (let u = 0; u < 27 && !progress; u++) {
      const cells = Array.from({ length: 9 }, (_, k) =>
        u < 9
          ? u * 9 + k
          : u < 18
            ? k * 9 + (u - 9)
            : Math.floor((u - 18) / 3) * 27 +
              ((u - 18) % 3) * 3 +
              Math.floor(k / 3) * 9 +
              (k % 3),
      );
      for (let d = 1; d <= 9 && !progress; d++) {
        if (cells.some((c) => g[c] === d)) continue;
        const at = cells.filter((c) => !g[c] && opts(c).includes(d));
        if (at.length === 1) [g[at[0]], progress] = [d, true];
      }
    }
  }
  return !g.includes(0);
}
const valid = (s) =>
  s.every((d, i) => d >= 1 && d <= 9 && PEERS[i].every((p) => s[p] !== d));

await test('bank puzzles are unique, consistent and within their givens range', () => {
  for (const c of CASES)
    for (const [p, s] of SUDOKU_BANK[c.tier]) {
      const g = [...p].map(Number);
      const sol = [...s].map(Number);
      const givens = g.filter(Boolean).length;
      assert.ok(
        givens >= c.min && givens <= c.max,
        `${c.tier} givens ${givens}`,
      );
      assert.ok(valid(sol));
      assert.ok(g.every((d, i) => !d || d === sol[i]));
      assert.equal(count(g), 1, `${c.tier} unique`);
      if (c.tier === 'easy')
        assert.ok(singlesSolvable(g), 'easy needs singles only');
      if (c.tier === 'hard' || c.tier === 'expert')
        assert.ok(!singlesSolvable(g), `${c.tier} needs more than singles`);
    }
});

for (const c of CASES) {
  const label = `${c.tier} (level ${c.level}${c.boss ? ', boss' : ''})`;
  await test(`${label}: make is fast, deterministic, unique and leak-free`, () => {
    for (const seed of SEEDS) {
      const t = performance.now();
      const a = sudoku.make({ level: c.level, boss: c.boss, seed });
      assert.ok(performance.now() - t < 50);
      assert.deepEqual(sudoku.make({ level: c.level, boss: c.boss, seed }), a);
      assert.equal(a.allowance, 3);
      assert.equal(a.budget, 'mistakes');
      assert.equal(a.view.tier, c.tier);
      const sol = a.secret.solution;
      assert.ok(valid(sol));
      assert.ok(a.view.grid.every((d, i) => !d || d === sol[i]));
      assert.equal(count(a.view.grid), 1);
      const text = JSON.stringify(a.view);
      assert.ok(!text.includes('solution'));
      assert.ok(!text.includes(sol.join(',')));
    }
  });
  await test(`${label}: the win drill solves without mistakes`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = sudoku.make({
        level: c.level,
        boss: c.boss,
        seed,
      });
      let spent = 0,
        solved = false,
        steps = 0;
      while (!solved && steps++ < 81) {
        const r = sudoku.move(view, secret, sudoku.win(view, secret));
        spent += r.cost;
        solved = r.solved;
      }
      assert.ok(solved);
      assert.equal(spent, 0);
      assert.ok(spent < allowance);
      sudoku.reveal(view, secret, true);
      assert.deepEqual(view.solution, secret.solution);
    }
  });
  await test(`${label}: the lose drill spends the allowance without solving`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = sudoku.make({
        level: c.level,
        boss: c.boss,
        seed,
      });
      let spent = 0;
      for (let k = 0; k < allowance + 1; k++) {
        const r = sudoku.move(view, secret, sudoku.lose(view, secret));
        assert.equal(r.solved, false);
        assert.equal(r.cost, 1);
        spent += r.cost;
      }
      assert.ok(spent >= allowance);
      const cell = view.wrong.findIndex(Boolean);
      assert.ok(cell >= 0);
      assert.notEqual(view.wrong[cell], secret.solution[cell]);
      assert.equal(view.grid[cell], 0);
    }
  });
}

await test('malformed and illegal moves throw without changing the view', () => {
  const { view, secret } = sudoku.make({ level: 2, boss: false, seed: 11 });
  const empty = view.grid.findIndex((d) => !d);
  const given = view.grid.findIndex(Boolean);
  const before = JSON.stringify(view);
  for (const m of [
    {},
    { cell: -1, digit: 1 },
    { cell: 81, digit: 1 },
    { cell: 1.5, digit: 1 },
    { cell: '3', digit: 1 },
    { cell: empty },
    { cell: empty, digit: 0 },
    { cell: empty, digit: 10 },
    { cell: empty, digit: '4' },
    { cell: empty, erase: true },
    { cell: empty, erase: 'yes', digit: 1 },
    { cell: given, digit: view.grid[given] },
    { cell: given, erase: true },
  ])
    assert.throws(() => sudoku.move(view, secret, m));
  assert.equal(JSON.stringify(view), before);
});

await test('wrong digits stay in red until erased or overwritten; correct digits lock', () => {
  const { view, secret } = sudoku.make({ level: 1, boss: false, seed: 5 });
  const cell = view.grid.findIndex((d) => !d);
  const right = secret.solution[cell];
  const wrong = (right % 9) + 1;
  assert.deepEqual(sudoku.move(view, secret, { cell, digit: wrong }), {
    cost: 1,
    solved: false,
  });
  assert.equal(view.wrong[cell], wrong);
  assert.throws(() => sudoku.move(view, secret, { cell, digit: wrong }));
  assert.deepEqual(sudoku.move(view, secret, { cell, erase: true }), {
    cost: 0,
    solved: false,
  });
  assert.equal(view.wrong[cell], 0);
  sudoku.move(view, secret, { cell, digit: wrong });
  assert.deepEqual(sudoku.move(view, secret, { cell, digit: right }), {
    cost: 0,
    solved: false,
  });
  assert.equal(view.grid[cell], right);
  assert.equal(view.wrong[cell], 0);
  assert.throws(() => sudoku.move(view, secret, { cell, digit: wrong }));
  assert.throws(() => sudoku.move(view, secret, { cell, erase: true }));
});
