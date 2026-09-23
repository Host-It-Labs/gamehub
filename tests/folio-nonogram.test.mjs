import assert from 'node:assert/strict';
import test from 'node:test';
import { nonogram } from '../lib/games/folio/kinds/nonogram.ts';
import { BIG, SMALL } from '../lib/games/folio/nonogram-data.ts';
import {
  cluesOf,
  difficulty,
  solve,
} from '../scripts/folio-nonogram-check.mjs';

const CASES = [
  { level: 1, boss: false },
  { level: 2, boss: false },
  { level: 3, boss: false },
  { level: 4, boss: false },
  { level: 4, boss: true },
  { level: 3, boss: true },
];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);
const label = (c) => (c.boss ? 'boss' : `level ${c.level}`);

await test('every picture is uniquely solvable by pure line logic', () => {
  assert.ok(SMALL.length >= 24 && BIG.length >= 8);
  for (const { set, size } of [
    { set: SMALL, size: 10 },
    { set: BIG, size: 15 },
  ])
    for (const p of set) {
      assert.equal(p.rows.length, size, p.name);
      for (const r of p.rows)
        assert.match(r, new RegExp(`^[#.]{${size}}$`), p.name);
      const { rows, cols } = cluesOf(p.rows);
      const s = solve(rows, cols);
      assert.ok(s.solved, `${p.name} needs guessing`);
      assert.equal(
        s.grid.map((v) => (v ? '#' : '.')).join(''),
        p.rows.join(''),
        p.name,
      );
    }
  const names = [...SMALL, ...BIG].map((p) => p.name);
  assert.equal(new Set(names).size, names.length, 'names are unique');
});

await test('levels rank by difficulty and each level has pictures', () => {
  const mean = (l) => {
    const s = SMALL.filter((p) => p.level === l).map(
      (p) => difficulty(p.rows).score,
    );
    assert.ok(s.length >= 8, `level ${l} has at least 8 pictures`);
    return s.reduce((a, b) => a + b, 0) / s.length;
  };
  assert.ok(mean(1) < mean(2) && mean(2) < mean(3));
});

for (const c of CASES) {
  await test(`${label(c)}: make is fast, deterministic and leaks nothing`, () => {
    for (const seed of SEEDS) {
      const t = performance.now();
      const a = nonogram.make({ ...c, seed });
      assert.ok(performance.now() - t < 50);
      assert.deepEqual(a, nonogram.make({ ...c, seed }));
      assert.equal(a.allowance, 3);
      assert.equal(a.view.size, c.boss ? 15 : 10);
      const json = JSON.stringify(a.view);
      assert.ok(!json.includes(a.secret.name));
      assert.ok(!json.includes('#'));
      assert.ok(!('solution' in a.view));
      // Clues match the secret picture.
      assert.deepEqual(cluesOf(a.secret.rows), {
        rows: a.view.rows,
        cols: a.view.cols,
      });
    }
  });
  await test(`${label(c)}: the win drill solves within the allowance`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = nonogram.make({ ...c, seed });
      let spent = 0,
        solved = false,
        steps = 0;
      while (!solved) {
        assert.ok(steps++ < 400);
        const r = nonogram.move(view, secret, nonogram.win(view, secret));
        spent += r.cost;
        solved = r.solved;
      }
      assert.equal(spent, 0);
      assert.ok(spent < allowance);
      assert.equal(
        nonogram.reveal(view, secret, true)[0],
        secret.name[0].toUpperCase(),
      );
      assert.deepEqual(view.solution, secret.rows);
      // Every blank ends crossed by the auto-cross of finished lines.
      assert.ok(!view.cells.includes(0));
    }
  });
  await test(`${label(c)}: the lose drill spends the allowance without solving`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = nonogram.make({ ...c, seed });
      let spent = 0;
      while (spent < allowance) {
        const r = nonogram.move(view, secret, nonogram.lose(view, secret));
        assert.equal(r.solved, false);
        assert.equal(r.cost, 1);
        spent += r.cost;
      }
      assert.equal(view.wrong.length, allowance);
      for (const w of view.wrong) assert.equal(view.cells[w], 2);
    }
  });
}

await test('malformed moves throw and leave the view alone', () => {
  const { view, secret } = nonogram.make({ level: 1, boss: false, seed: 5 });
  const before = JSON.stringify(view);
  const bad = [
    {},
    { cells: [0] },
    { cells: [0], mark: 'paint' },
    { cells: [], mark: 'fill' },
    { cells: [-1], mark: 'fill' },
    { cells: [100], mark: 'fill' },
    { cells: [1.5], mark: 'fill' },
    { cells: ['1'], mark: 'fill' },
    { cells: 3, mark: 'fill' },
    { cells: [0, 2], mark: 'fill' },
    { cells: [0, 11], mark: 'fill' },
    { cells: [9, 10], mark: 'fill' },
    { cells: [0, 1, 1], mark: 'fill' },
    { cells: [0, 10, 20, 21], mark: 'cross' },
    { cells: Array.from({ length: 11 }, (_, i) => i), mark: 'cross' },
  ];
  for (const m of bad) {
    assert.throws(() => nonogram.move(view, secret, m));
    assert.equal(JSON.stringify(view), before);
  }
});

await test('drag rules: in-order processing, stop at the first mistake, skip marked cells', () => {
  const { view, secret } = nonogram.make({ level: 1, boss: false, seed: 11 });
  const n = view.size;
  const isFill = (i) => secret.rows[Math.floor(i / n)][i % n] === '#';
  // Find a row with a blank after a filled cell.
  let r = 0;
  while (!secret.rows[r].includes('#.')) r++;
  const cut = secret.rows[r].indexOf('#.');
  const row = Array.from({ length: n }, (_, c) => r * n + c);
  const res = nonogram.move(view, secret, { cells: row, mark: 'fill' });
  assert.equal(res.cost, 1);
  for (const c of row.slice(0, cut + 1))
    assert.equal(view.cells[c], isFill(c) ? 1 : 2);
  assert.deepEqual(view.wrong, [row[cut + 1]]);
  assert.equal(view.cells[row[cut + 1]], 2);
  // Processing stopped at the mistake: later picture squares stay empty.
  for (const c of row.slice(cut + 2))
    if (isFill(c)) assert.equal(view.cells[c], 0);
  // Crossing a picture square is a mistake that fills it.
  const target = view.cells.findIndex((m, i) => m === 0 && isFill(i));
  const r2 = nonogram.move(view, secret, { cells: [target], mark: 'cross' });
  assert.equal(r2.cost, 1);
  assert.equal(view.cells[target], 1);
  assert.ok(view.wrong.includes(target));
  // Marked squares cannot be marked again.
  assert.throws(() =>
    nonogram.move(view, secret, { cells: [target], mark: 'fill' }),
  );
});

await test('a finished line crosses its blanks', () => {
  const { view, secret } = nonogram.make({ level: 2, boss: false, seed: 2 });
  const n = view.size;
  const r = view.rows.findIndex((c) => c.length > 0);
  const want = secret.rows[r]
    .split('')
    .flatMap((ch, c) => (ch === '#' ? [r * n + c] : []));
  for (const c of want)
    nonogram.move(view, secret, { cells: [c], mark: 'fill' });
  for (let c = 0; c < n; c++)
    assert.equal(view.cells[r * n + c], secret.rows[r][c] === '#' ? 1 : 2);
  assert.equal(view.wrong.length, 0);
});
