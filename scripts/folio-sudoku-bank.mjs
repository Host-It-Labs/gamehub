#!/usr/bin/env node
/**
 * Builds Folio's Sudoku bank: unique-solution puzzles graded by a
 * human-technique solver, written to lib/games/folio/sudoku-data.ts.
 * The runtime picks one per seed and disguises it with symmetry transforms.
 *
 *   node scripts/folio-sudoku-bank.mjs [perTier=48] [seed=20260922]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PER = Number(process.argv[2] ?? 48);
let state = Number(process.argv[3] ?? 20260922) >>> 0;
const random = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 4294967296;
};
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const UNITS = [];
for (let i = 0; i < 9; i++) {
  UNITS.push(Array.from({ length: 9 }, (_, j) => i * 9 + j));
  UNITS.push(Array.from({ length: 9 }, (_, j) => j * 9 + i));
  const r = Math.floor(i / 3) * 3;
  const c = (i % 3) * 3;
  UNITS.push(
    Array.from(
      { length: 9 },
      (_, j) => (r + Math.floor(j / 3)) * 9 + c + (j % 3),
    ),
  );
}
const ROWS = UNITS.filter((_, i) => i % 3 === 0);
const COLS = UNITS.filter((_, i) => i % 3 === 1);
const BOXES = UNITS.filter((_, i) => i % 3 === 2);
const PEERS = Array.from({ length: 81 }, (_, cell) => {
  const set = new Set();
  for (const u of UNITS)
    if (u.includes(cell)) for (const p of u) if (p !== cell) set.add(p);
  return [...set];
});
const ALL = 0x1ff;
const bits = (m) => {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
};
const digitOf = (m) => 31 - Math.clz32(m) + 1;

/** Count solutions up to `limit`; optionally randomised to build full grids. */
function solve(grid, limit = 2, randomise = false) {
  const g = [...grid];
  let count = 0;
  let first = null;
  const rec = () => {
    let best = -1;
    let bestMask = 0;
    let bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let used = 0;
      for (const p of PEERS[i]) if (g[p]) used |= 1 << (g[p] - 1);
      const mask = ALL & ~used;
      const n = bits(mask);
      if (n === 0) return false;
      if (n < bestN) {
        best = i;
        bestMask = mask;
        bestN = n;
        if (n === 1) break;
      }
    }
    if (best < 0) {
      count++;
      if (!first) first = [...g];
      return count >= limit;
    }
    let digits = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
    if (randomise) digits = shuffle(digits);
    for (const d of digits) {
      g[best] = d;
      if (rec()) return true;
    }
    g[best] = 0;
    return false;
  };
  rec();
  return { count, first };
}

/**
 * Human-style grading. Returns the hardest technique tier the puzzle needed:
 * 1 singles, 2 locked candidates, 3 naked/hidden pairs and triples,
 * 4 X-wing/swordfish, 5 beyond (stuck).
 */
export function grade(grid) {
  const g = [...grid];
  const cand = g.map((v) => (v ? 0 : ALL));
  for (let i = 0; i < 81; i++)
    if (g[i]) for (const p of PEERS[i]) cand[p] &= ~(1 << (g[i] - 1));
  const place = (i, d) => {
    g[i] = d;
    cand[i] = 0;
    for (const p of PEERS[i]) cand[p] &= ~(1 << (d - 1));
  };
  let tier = 1;
  let singlesOnly = 0;
  const step = () => {
    for (let i = 0; i < 81; i++)
      if (!g[i] && bits(cand[i]) === 1) {
        place(i, digitOf(cand[i]));
        return 1;
      }
    for (const u of UNITS)
      for (let d = 0; d < 9; d++) {
        const at = u.filter((c) => !g[c] && cand[c] & (1 << d));
        if (at.length === 1 && !u.some((c) => g[c] === d + 1)) {
          place(at[0], d + 1);
          return 1;
        }
      }
    // Locked candidates: pointing and claiming.
    for (const [a, list] of [
      [BOXES, [...ROWS, ...COLS]],
      [[...ROWS, ...COLS], BOXES],
    ])
      for (const u of a)
        for (let d = 0; d < 9; d++) {
          const at = u.filter((c) => cand[c] & (1 << d));
          if (at.length < 2) continue;
          for (const v of list) {
            if (v === u || !at.every((c) => v.includes(c))) continue;
            let hit = false;
            for (const c of v)
              if (!u.includes(c) && cand[c] & (1 << d)) {
                cand[c] &= ~(1 << d);
                hit = true;
              }
            if (hit) return 2;
          }
        }
    // Naked and hidden subsets of size 2 and 3.
    for (const k of [2, 3])
      for (const u of UNITS) {
        const open = u.filter((c) => !g[c]);
        for (const combo of combos(open, k)) {
          const m = combo.reduce((a, c) => a | cand[c], 0);
          if (bits(m) !== k) continue;
          let hit = false;
          for (const c of open)
            if (!combo.includes(c) && cand[c] & m) {
              cand[c] &= ~m;
              hit = true;
            }
          if (hit) return 3;
        }
        const digits = [];
        for (let d = 0; d < 9; d++)
          if (open.some((c) => cand[c] & (1 << d))) digits.push(d);
        for (const combo of combos(digits, k)) {
          const m = combo.reduce((a, d) => a | (1 << d), 0);
          const at = open.filter((c) => cand[c] & m);
          if (at.length !== k) continue;
          let hit = false;
          for (const c of at)
            if (cand[c] & ~m) {
              cand[c] &= m;
              hit = true;
            }
          if (hit) return 3;
        }
      }
    // X-wing and swordfish on rows and columns.
    for (const k of [2, 3])
      for (const [base, cover] of [
        [ROWS, COLS],
        [COLS, ROWS],
      ])
        for (let d = 0; d < 9; d++) {
          const lines = base
            .map((u, i) => ({
              i,
              at: u
                .map((c, j) => (cand[c] & (1 << d) ? j : -1))
                .filter((j) => j >= 0),
            }))
            .filter((l) => l.at.length >= 2 && l.at.length <= k);
          for (const combo of combos(lines, k)) {
            const spots = new Set(combo.flatMap((l) => l.at));
            if (spots.size !== k) continue;
            const rows = new Set(combo.map((l) => l.i));
            let hit = false;
            for (const j of spots)
              cover[j].forEach((c, i) => {
                if (!rows.has(i) && cand[c] & (1 << d)) {
                  cand[c] &= ~(1 << d);
                  hit = true;
                }
              });
            if (hit) return 4;
          }
        }
    return 0;
  };
  while (g.includes(0)) {
    const t = step();
    if (!t) return { tier: 5, singlesOnly };
    if (t === 1 && tier === 1) singlesOnly++;
    tier = Math.max(tier, t);
  }
  return { tier, singlesOnly };
}
function* combos(list, k, from = 0, acc = []) {
  if (acc.length === k) {
    yield acc;
    return;
  }
  for (let i = from; i < list.length; i++)
    yield* combos(list, k, i + 1, [...acc, list[i]]);
}

function fullGrid() {
  return solve(Array(81).fill(0), 1, true).first;
}
/** Remove clues in random order while the puzzle stays unique and `keep` allows it. */
function carve(solution, target, maxTier) {
  const g = [...solution];
  let givens = 81;
  for (const i of shuffle([...Array(81).keys()])) {
    if (givens <= target) break;
    const v = g[i];
    g[i] = 0;
    if (solve(g, 2).count !== 1 || (maxTier && grade(g).tier > maxTier))
      g[i] = v;
    else givens--;
  }
  return { g, givens };
}

const TIERS = [
  // level 1 easy: 38–42 givens, singles only.
  { name: 'easy', min: 38, max: 42, lo: 1, hi: 1 },
  // level 2 medium: 31–34 givens, singles or locked candidates.
  { name: 'medium', min: 31, max: 34, lo: 1, hi: 2 },
  // level 3 hard: 26–30 givens, needs locked candidates or subsets.
  { name: 'hard', min: 26, max: 30, lo: 2, hi: 3 },
  // boss expert: 22–25 givens, needs subsets or fish.
  { name: 'expert', min: 22, max: 25, lo: 3, hi: 4 },
];
const bank = {};
for (const t of TIERS) {
  const out = [];
  let tries = 0;
  while (out.length < PER) {
    tries++;
    const sol = fullGrid();
    const target = t.min + Math.floor(random() * (t.max - t.min + 1));
    const { g, givens } = carve(sol, target, t.hi <= 2 ? t.hi : 0);
    if (givens < t.min || givens > t.max) continue;
    const { tier } = grade(g);
    if (tier < t.lo || tier > t.hi) continue;
    out.push({ p: g.join(''), s: sol.join(''), tier, givens });
  }
  console.log(`${t.name}: ${out.length} puzzles in ${tries} tries`);
  bank[t.name] = out;
}

const lines = [
  '// Generated by scripts/folio-sudoku-bank.mjs. Do not edit by hand.',
  '// Each entry is [puzzle, solution] as 81-digit strings (0 = empty).',
  '// Tiers: easy = singles only, medium = up to locked candidates,',
  '// hard = needs locked candidates or subsets, expert = needs subsets or fish.',
  'export const SUDOKU_BANK: Record<"easy" | "medium" | "hard" | "expert", [string, string][]> = {',
];
for (const t of TIERS) {
  lines.push(`  ${t.name}: [`);
  for (const e of bank[t.name]) lines.push(`    ['${e.p}', '${e.s}'],`);
  lines.push('  ],');
}
lines.push('};', '');
const target = fileURLToPath(
  new URL('../lib/games/folio/sudoku-data.ts', import.meta.url),
);
writeFileSync(target, lines.join('\n'));
console.log(`wrote ${target}`);
