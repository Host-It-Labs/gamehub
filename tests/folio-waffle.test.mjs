import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  waffle,
  waffleMarks,
  minSwaps,
  bestSwap,
  isHole,
} from '../lib/games/folio/kinds/waffle.ts';
import { WAFFLES, DELUXE } from '../lib/games/folio/waffle-data.ts';
import { GUESSES } from '../lib/games/folio/words.ts';

const CASES = [
  { level: 1, boss: false },
  { level: 2, boss: false },
  { level: 3, boss: false },
  { level: 4, boss: false },
  { level: 4, boss: true },
  { level: 3, boss: true },
];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);
const unpack = (s) => s.split('').map((c) => (c === '.' ? '' : c));

function words(cells, size) {
  const out = [];
  for (let r = 0; r < size; r += 2)
    out.push(cells.slice(r * size, r * size + size).join(''));
  for (let c = 0; c < size; c += 2)
    out.push(
      Array.from({ length: size }, (_, r) => cells[r * size + c]).join(''),
    );
  return out;
}

/** Brute-force fewest swaps by breadth-first search (small boards only). */
function bfsSwaps(letters, solution) {
  const goal = solution.join('|');
  let frontier = [letters];
  const seen = new Set([letters.join('|')]);
  for (let depth = 0; depth < 8; depth++) {
    const next = [];
    for (const s of frontier) {
      if (s.join('|') === goal) return depth;
      const loose = s
        .map((_, i) => i)
        .filter((i) => s[i] && s[i] !== solution[i]);
      for (const i of loose)
        for (const j of loose)
          if (i < j && s[i] !== s[j]) {
            const t = [...s];
            [t[i], t[j]] = [t[j], t[i]];
            const key = t.join('|');
            if (!seen.has(key)) {
              seen.add(key);
              next.push(t);
            }
          }
    }
    frontier = next;
  }
  return Infinity;
}

await test('bank: common words, exact 10/20-swap scrambles', () => {
  assert.ok(WAFFLES.length >= 40);
  assert.ok(DELUXE.length >= 10);
  const enable = (() => {
    try {
      return new Set(
        readFileSync(
          process.env.ENABLE_WORDS ??
            '/private/tmp/claude-501/-Users-williamguinaudie-Documents-code-gamehub/69faa78f-6a97-4131-9931-eb7a04140141/scratchpad/enable1.txt',
          'utf8',
        )
          .split(/\s+/)
          .map((w) => w.toUpperCase()),
      );
    } catch {
      return null;
    }
  })();
  const seen = new Set();
  for (const [bank, size, par, greens] of [
    [WAFFLES, 5, 10, [8, 6, 5]],
    [DELUXE, 7, 20, [10]],
  ])
    for (const [grid, ...scrambles] of bank) {
      const solution = unpack(grid);
      assert.equal(solution.length, size * size);
      solution.forEach((c, i) => assert.equal(c === '', isHole(i, size)));
      const ws = words(solution, size);
      for (const w of ws) {
        if (size === 5) assert.ok(GUESSES.has(w), w);
        else if (enable) assert.ok(enable.has(w), w);
        assert.ok(!seen.has(w), `repeated word ${w}`);
        seen.add(w);
      }
      scrambles.forEach((s, n) => {
        const letters = unpack(s);
        assert.deepEqual(
          [...letters].sort((x, y) => x.localeCompare(y)),
          [...solution].sort((x, y) => x.localeCompare(y)),
          'same letters',
        );
        const marks = waffleMarks(letters, solution, size);
        assert.equal(marks.filter((m) => m === 2).length, greens[n]);
        assert.equal(minSwaps(letters, solution), par);
        // No word starts fully solved.
        assert.ok(words(letters, size).every((w, k) => w !== ws[k]));
      });
    }
});

await test('exact solver agrees with brute force on shuffled small boards', () => {
  const solution = unpack(WAFFLES[0][0]);
  let random = 12345;
  const next = () =>
    (random = (random * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let trial = 0; trial < 60; trial++) {
    const letters = [...solution];
    const tiles = letters.map((_, i) => i).filter((i) => letters[i]);
    for (let s = 0; s < 1 + (trial % 5); s++) {
      const i = tiles[Math.floor(next() * tiles.length)];
      const j = tiles[Math.floor(next() * tiles.length)];
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    assert.equal(minSwaps(letters, solution), bfsSwaps(letters, solution));
  }
  // Repeated letters open shortcuts that a plain permutation count misses.
  const sol = ['A', 'B', 'A', 'B'];
  assert.equal(minSwaps(['B', 'A', 'B', 'A'], sol), 2);
  assert.equal(minSwaps(['B', 'A', 'A', 'B'], sol), 1);
});

await test('colours follow Waffle, including repeated letters and crossings', () => {
  const size = 5;
  const solution = unpack('ABCDEF.G.HIJKLMN.O.PQRSTU');
  const letters = [...solution];
  // Row 0 ABCDE -> swap A and C: both yellow in the row.
  [letters[0], letters[2]] = [letters[2], letters[0]];
  let marks = waffleMarks(letters, solution, size);
  assert.equal(marks[0], 1);
  assert.equal(marks[2], 1);
  // A letter from another word entirely is grey.
  const far = [...solution];
  [far[1], far[23]] = [far[23], far[1]]; // B <-> T: row0 pos1 and row4 pos3, no shared word
  marks = waffleMarks(far, solution, size);
  assert.equal(marks[1], 0);
  assert.equal(marks[23], 0);
  // Crossing tile: in column 0's word but not row 0's -> yellow via column.
  const cross = [...solution];
  [cross[0], cross[10]] = [cross[10], cross[0]]; // A <-> I (both in column 0)
  marks = waffleMarks(cross, solution, size);
  assert.equal(marks[0], 1);
  assert.equal(marks[10], 1);
  // Duplicates: yellows consume the solution word's unmatched letters, left to right.
  const dsol = unpack('SPEEDX.Y.ZQRSTUV.W.ABCDFG');
  const d = [...dsol];
  d[0] = 'E';
  d[1] = 'E';
  d[2] = 'S';
  d[3] = 'P';
  // Row 0 E E S P D against SPEED: D green; S, P and both E are unmatched, so all yellow.
  marks = waffleMarks(d, dsol, size);
  assert.deepEqual(marks.slice(0, 5), [1, 1, 1, 1, 2]);
  const d2 = [...dsol];
  d2[0] = 'E';
  d2[1] = 'E';
  d2[20] = 'S';
  d2[21] = 'P';
  // Row0 E E E E D vs SPEED: greens at 2,3,4; no E left -> 0 and 1 grey (1 is non-crossing).
  marks = waffleMarks(d2, dsol, size);
  assert.deepEqual(marks.slice(0, 5), [0, 0, 2, 2, 2]);
  const d3 = [...dsol];
  d3[1] = 'E';
  d3[2] = 'P';
  d3[3] = 'X'; // pull X (row 1 col 0) into row 0
  d3[5] = 'E';
  // Row0 S E P X D vs SPEED: S green, E yellow (one E free at 2,3), P yellow, X grey.
  marks = waffleMarks(d3, dsol, size);
  assert.deepEqual(marks.slice(0, 5), [2, 1, 1, 0, 2]);
});

for (const ctx of CASES) {
  const label = `level ${ctx.level}${ctx.boss ? ' boss' : ''}`;
  await test(`${label}: fast, deterministic, no leaks`, () => {
    for (const seed of SEEDS) {
      const t = performance.now();
      const a = waffle.make({ ...ctx, seed });
      assert.ok(performance.now() - t < 50);
      const b = waffle.make({ ...ctx, seed });
      assert.deepEqual(a, b);
      assert.equal(a.allowance, ctx.boss ? 25 : 15);
      assert.equal(a.budget, 'swaps');
      assert.equal(a.view.size, ctx.boss ? 7 : 5);
      const json = JSON.stringify(a.view);
      assert.ok(!json.includes('solution'));
      assert.ok(!json.includes(a.secret.solution.join('')));
      assert.equal(
        minSwaps(a.view.letters, a.secret.solution),
        ctx.boss ? 20 : 10,
      );
    }
  });
  await test(`${label}: win drill solves in the minimum`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = waffle.make({ ...ctx, seed });
      let spent = 0,
        solved = false;
      while (!solved) {
        const r = waffle.move(view, secret, waffle.win(view, secret));
        spent += r.cost;
        solved = r.solved;
        assert.ok(spent <= allowance);
      }
      assert.equal(spent, view.par);
      assert.ok(view.marks.every((m) => m === 2 || m === -1));
      waffle.reveal(view, secret, true);
      assert.deepEqual(view.solution, secret.solution);
    }
  });
  await test(`${label}: lose drill spends the allowance`, () => {
    for (const seed of SEEDS) {
      const { view, secret, allowance } = waffle.make({ ...ctx, seed });
      let spent = 0;
      while (spent < allowance) {
        const r = waffle.move(view, secret, waffle.lose(view, secret));
        assert.equal(r.solved, false);
        spent += r.cost;
      }
      const answer = waffle.reveal(view, secret, false);
      assert.ok(answer.length > 0);
    }
  });
  await test(`${label}: malformed moves throw and change nothing`, () => {
    const { view, secret } = waffle.make({ ...ctx, seed: 99 });
    const n = view.size * view.size;
    const green = view.marks.indexOf(2);
    const loose = view.marks
      .map((m, i) => (m === 0 || m === 1 ? i : -1))
      .filter((i) => i >= 0);
    const same = loose.flatMap((i) =>
      loose
        .filter((j) => j > i && view.letters[j] === view.letters[i])
        .map((j) => [i, j]),
    )[0];
    const hole = view.size + 1;
    const bad = [
      {},
      { a: 0 },
      { a: '0', b: '1' },
      { a: 0.5, b: 2 },
      { a: -1, b: 2 },
      { a: n, b: 0 },
      { a: loose[0], b: loose[0] },
      { a: hole, b: loose[0] },
      { a: green, b: loose[0] },
      ...(same ? [{ a: same[0], b: same[1] }] : []),
    ];
    const before = JSON.stringify(view);
    for (const m of bad) assert.throws(() => waffle.move(view, secret, m));
    assert.equal(JSON.stringify(view), before);
  });
}

await test('best swap always turns a tile green', () => {
  const [grid, scrambled] = WAFFLES[3];
  const solution = unpack(grid),
    letters = unpack(scrambled);
  const [a, b] = bestSwap(letters, solution);
  [letters[a], letters[b]] = [letters[b], letters[a]];
  assert.ok(letters[a] === solution[a] || letters[b] === solution[b]);
  assert.equal(minSwaps(letters, solution), 9);
});
