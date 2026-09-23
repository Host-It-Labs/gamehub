import assert from 'node:assert/strict';
import test from 'node:test';
import {
  layMines,
  mines,
  neighbours,
  solvable,
} from '../lib/games/folio/kinds/mines.ts';

const CASES = [
  { level: 1, boss: false, size: 9, count: 10 },
  { level: 2, boss: false, size: 10, count: 15 },
  { level: 3, boss: false, size: 12, count: 24 },
  { level: 4, boss: false, size: 12, count: 28 },
  { level: 1, boss: true, size: 16, count: 40 },
  { level: 3, boss: true, size: 16, count: 40 },
];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);
const clone = (v) => JSON.parse(JSON.stringify(v));

function play(made, drill, allowance = made.allowance) {
  const { view, secret } = made;
  let remaining = allowance,
    spent = 0,
    solved = false,
    steps = 0;
  while (!solved && remaining > 0 && steps++ < 1000) {
    const r = mines.move(view, secret, mines[drill](view, secret));
    spent += r.cost;
    remaining -= r.cost;
    solved = r.solved;
  }
  return { solved, spent, remaining };
}

for (const ctx of CASES) {
  const label = `level ${ctx.level}${ctx.boss ? ' boss' : ''}`;
  const { size, count } = ctx;

  await test(`${label}: make is deterministic and exposes no mines`, () => {
    for (const seed of SEEDS) {
      const a = mines.make({ ...ctx, seed });
      assert.deepEqual(mines.make({ ...ctx, seed }), a);
      assert.equal(a.allowance, 1);
      assert.equal(a.view.size, size);
      assert.equal(a.view.count, count);
      assert.equal(a.secret.mines, null);
      assert.equal(a.view.mines, undefined);
    }
  });

  await test(`${label}: first open is a zero and the board is guess-free, fast`, () => {
    for (const seed of SEEDS.slice(0, 25)) {
      for (const first of [
        0,
        size - 1,
        (size * size) >> 1,
        size * size - 1,
        size + 3,
      ]) {
        const made = mines.make({ ...ctx, seed });
        const t = performance.now();
        const r = mines.move(made.view, made.secret, { open: first });
        assert.ok(performance.now() - t < 200, 'first open is fast');
        assert.equal(r.cost, 0);
        assert.equal(made.view.cells[first], 0);
        assert.equal(made.secret.mines.length, count);
        assert.ok(solvable(size, new Set(made.secret.mines), first));
        for (const n of neighbours(first, size))
          assert.ok(!made.secret.mines.includes(n));
        // Opened squares never include mines, and the view still hides them.
        assert.equal(made.view.mines, undefined);
        assert.ok(made.view.cells.every((c) => c < 9));
        assert.deepEqual(layMines(seed, size, count, first), made.secret.mines);
      }
    }
  });

  await test(`${label}: win drill clears the field without spending a life`, () => {
    for (const seed of SEEDS) {
      const made = mines.make({ ...ctx, seed });
      const r = play(made, 'win');
      assert.ok(r.solved);
      assert.equal(r.spent, 0);
      assert.equal(mines.reveal(made.view, made.secret, true), 'Field cleared');
      assert.equal(made.view.mines.length, count);
    }
  });

  await test(`${label}: lose drill spends the allowance, even with an extra life`, () => {
    for (const seed of SEEDS) {
      for (const allowance of [1, 2]) {
        const made = mines.make({ ...ctx, seed });
        const r = play(made, 'lose', allowance);
        assert.ok(!r.solved);
        assert.ok(r.spent >= allowance);
        assert.equal(made.view.cells.filter((c) => c === 9).length, allowance);
      }
    }
  });

  await test(`${label}: malformed moves throw and change nothing`, () => {
    const made = mines.make({ ...ctx, seed: 11 });
    mines.move(made.view, made.secret, { open: (size * size) >> 1 });
    const zero = made.view.cells.indexOf(0);
    const hidden = made.view.cells.indexOf(-1);
    mines.move(made.view, made.secret, { flag: hidden });
    const bad = [
      {},
      { open: -1 },
      { open: size * size },
      { open: 1.5 },
      { open: '3' },
      { open: 1, flag: 2 },
      { dig: 1 },
      { open: zero },
      { flag: zero },
      { open: hidden },
      { chord: hidden },
      { chord: zero },
    ];
    for (const m of bad) {
      const before = clone(made.view);
      assert.throws(() => mines.move(made.view, made.secret, m));
      assert.deepEqual(made.view, before);
    }
  });
}

await test('chording opens the unflagged neighbours of a satisfied number', () => {
  const made = mines.make({ level: 1, boss: false, seed: 5 });
  const { view, secret } = made;
  mines.move(view, secret, { open: 40 });
  const mineSet = new Set(secret.mines);
  const n = view.cells.findIndex(
    (c, i) =>
      c > 0 &&
      c < 9 &&
      neighbours(i, 9).some((k) => view.cells[k] === -1 && !mineSet.has(k)),
  );
  assert.ok(n >= 0);
  const around = neighbours(n, 9);
  assert.throws(() => mines.move(view, secret, { chord: n }));
  for (const k of around)
    if (mineSet.has(k)) mines.move(view, secret, { flag: k });
  const r = mines.move(view, secret, { chord: n });
  assert.equal(r.cost, 0);
  for (const k of around) assert.ok(mineSet.has(k) || view.cells[k] >= 0);
});

await test('a wrong flag makes chording hit a mine', () => {
  const made = mines.make({ level: 1, boss: false, seed: 9 });
  const { view, secret } = made;
  mines.move(view, secret, { open: 40 });
  const mineSet = new Set(secret.mines);
  const n = view.cells.findIndex(
    (c, i) =>
      c === 1 &&
      neighbours(i, 9).filter((k) => view.cells[k] === -1 && !mineSet.has(k))
        .length > 0,
  );
  assert.ok(n >= 0);
  const wrong = neighbours(n, 9).find(
    (k) => view.cells[k] === -1 && !mineSet.has(k),
  );
  mines.move(view, secret, { flag: wrong });
  const r = mines.move(view, secret, { chord: n });
  assert.equal(r.cost, 1);
  assert.equal(r.solved, false);
});
