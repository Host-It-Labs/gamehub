/**
 * Folio Nonogram content check: every picture must be uniquely solvable by
 * pure line logic (no guessing), and levels must rank by difficulty.
 * Run: node --experimental-strip-types scripts/folio-nonogram-check.mjs
 */
export function clueOf(line) {
  const out = [];
  let run = 0;
  for (const v of line) {
    if (v) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
}
export function solveLine(clue, line) {
  const n = line.length,
    k = clue.length;
  const F = Array.from({ length: n + 2 }, () =>
    Array.from({ length: k + 1 }, () => false),
  );
  for (let j = 0; j <= k; j++) F[n][j] = j === k;
  F[n + 1] = F[n];
  const blockOk = (i, j) => {
    const L = clue[j];
    if (i + L > n) return false;
    for (let x = i; x < i + L; x++) if (line[x] === 0) return false;
    return !(i + L < n && line[i + L] === 1);
  };
  for (let i = n - 1; i >= 0; i--)
    for (let j = k; j >= 0; j--) {
      let ok = line[i] !== 1 && F[i + 1][j];
      if (!ok && j < k && blockOk(i, j))
        ok = F[Math.min(i + clue[j] + 1, n)][j + 1];
      F[i][j] = ok;
    }
  if (!F[0][0]) return null;
  const canF = Array.from({ length: n }, () => false),
    canB = Array.from({ length: n }, () => false);
  const seen = Array.from({ length: n + 1 }, () =>
    Array.from({ length: k + 1 }, () => false),
  );
  seen[0][0] = true;
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= k; j++) {
      if (!seen[i][j] || !F[i][j]) continue;
      if (line[i] !== 1 && F[i + 1][j]) {
        canB[i] = true;
        seen[i + 1][j] = true;
      }
      if (j < k && blockOk(i, j)) {
        const nx = Math.min(i + clue[j] + 1, n);
        if (F[nx][j + 1]) {
          for (let x = i; x < i + clue[j]; x++) canF[x] = true;
          if (i + clue[j] < n) canB[i + clue[j]] = true;
          seen[nx][j + 1] = true;
        }
      }
    }
  return line.map((v, i) => (canF[i] && canB[i] ? -1 : canF[i] ? 1 : 0));
}
/** Pure line logic from an empty grid; passes counts full sweeps that changed something. */
export function solve(rows, cols) {
  const h = rows.length,
    w = cols.length;
  const g = Array.from({ length: w * h }, () => -1);
  let passes = 0,
    changed = true;
  while (changed) {
    changed = false;
    passes++;
    for (let r = 0; r < h; r++) {
      const line = g.slice(r * w, r * w + w);
      const out = solveLine(rows[r], line);
      if (!out) return { grid: g, solved: false, contradiction: true, passes };
      out.forEach((v, c) => {
        if (v !== line[c]) {
          g[r * w + c] = v;
          changed = true;
        }
      });
    }
    for (let c = 0; c < w; c++) {
      const line = Array.from({ length: h }, (_, r) => g[r * w + c]);
      const out = solveLine(cols[c], line);
      if (!out) return { grid: g, solved: false, contradiction: true, passes };
      out.forEach((v, r) => {
        if (v !== line[r]) {
          g[r * w + c] = v;
          changed = true;
        }
      });
    }
  }
  return { grid: g, solved: !g.includes(-1), passes: passes - 1 };
}
export function cluesOf(pic) {
  const w = pic[0].length;
  const cells = pic.map((r) => r.split('').map((c) => (c === '#' ? 1 : 0)));
  return {
    rows: cells.map(clueOf),
    cols: Array.from({ length: w }, (_, c) => clueOf(cells.map((r) => r[c]))),
  };
}
/** Difficulty: sweeps needed, plus how little a first row pass settles. */
export function difficulty(pic) {
  const { rows, cols } = cluesOf(pic);
  const s = solve(rows, cols);
  const n = rows.length;
  let first = 0;
  for (const c of rows)
    first += solveLine(
      c,
      Array.from({ length: n }, () => -1),
    ).filter((v) => v !== -1).length;
  return {
    solved: s.solved,
    passes: s.passes,
    score: s.passes + (1 - first / (n * n)) * 3,
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const { SMALL, BIG } = await import('../lib/games/folio/nonogram-data.ts');
  let bad = 0;
  for (const { set, size } of [
    { set: SMALL, size: 10 },
    { set: BIG, size: 15 },
  ]) {
    for (const p of set) {
      const d = difficulty(p.rows);
      const shape =
        p.rows.length === size &&
        p.rows.every((r) => r.length === size && /^[#.]+$/.test(r));
      if (!d.solved || !shape) bad++;
      console.log(
        `${size}×${size} L${p.level} ${d.solved && shape ? 'ok ' : 'BAD'} ${p.name.padEnd(20)} passes=${d.passes} score=${d.score.toFixed(2)}`,
      );
    }
  }
  const mean = (l) => {
    const s = SMALL.filter((p) => p.level === l).map(
      (p) => difficulty(p.rows).score,
    );
    return s.reduce((a, b) => a + b, 0) / s.length;
  };
  console.log(
    `mean score L1 ${mean(1).toFixed(2)} · L2 ${mean(2).toFixed(2)} · L3 ${mean(3).toFixed(2)}`,
  );
  if (bad || !(mean(1) < mean(2) && mean(2) < mean(3))) {
    console.error(`${bad} picture(s) fail`);
    process.exit(1);
  }
}
