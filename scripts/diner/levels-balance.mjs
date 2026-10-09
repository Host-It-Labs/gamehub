#!/usr/bin/env node
/**
 * Free-play levels, played by the greedy bot (lib/games/diner/bot.ts).
 * node --experimental-strip-types scripts/diner/levels-balance.mjs --seeds=16 [--levels=1-40] [--json]
 *
 * Two players per level: a sharp one (0.67 s between actions) and a careful
 * one (1.2 s). Prints coins (median and quartiles), lives left, how often
 * each clears bronze, silver and gold with the current targets, and the
 * targets the measurements suggest.
 */
import { createConfiguredMatch, open } from '../../lib/games/diner/engine.ts';
import { playShift } from '../../lib/games/diner/bot.ts';
import { LEVELS, levelConfig } from '../../lib/games/diner/levels.ts';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);
const seeds = Number(args.seeds ?? 16);
const [from, to] = (args.levels ?? `1-${LEVELS.length}`).split('-').map(Number);
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
};
const r5 = (n) => Math.max(5, Math.round(n / 5) * 5);

function cohort(id, pause) {
  const out = [];
  for (let s = 0; s < seeds; s++) {
    const m = createConfiguredMatch(1000 + s * 7919 + id * 31, levelConfig(id));
    open(m);
    playShift(m, true, pause);
    out.push({ coins: m.coins, stars: m.stars, medals: m.medals });
  }
  return out;
}

const rows = [];
for (const level of LEVELS) {
  if (level.id < from || level.id > (to ?? from)) continue;
  const sharp = cohort(level.id, 20);
  const careful = cohort(level.id, 36);
  const coins = (c) => c.map((x) => (x.stars > 0 ? x.coins : 0));
  const rate = (c, n) =>
    c.filter((x) => x.stars > 0 && x.medals >= n).length / c.length;
  const row = {
    id: level.id,
    name: level.name,
    targets: level.targets,
    sharp: {
      p25: quantile(coins(sharp), 0.25),
      p50: quantile(coins(sharp), 0.5),
      p75: quantile(coins(sharp), 0.75),
      lives: quantile(
        sharp.map((x) => x.stars),
        0.5,
      ),
      alive: sharp.filter((x) => x.stars > 0).length / sharp.length,
      bronze: rate(sharp, 1),
      silver: rate(sharp, 2),
      gold: rate(sharp, 3),
    },
    careful: {
      p50: quantile(coins(careful), 0.5),
      lives: quantile(
        careful.map((x) => x.stars),
        0.5,
      ),
      alive: careful.filter((x) => x.stars > 0).length / careful.length,
      bronze: rate(careful, 1),
      silver: rate(careful, 2),
    },
  };
  // Suggested: bronze about what a careful player takes early on and what a
  // sharp player's weaker shifts take late on; silver a sharp player's usual
  // shift; gold a sharp player's good one.
  const h = (level.id - 1) / (LEVELS.length - 1);
  const raw = (c) => c.map((x) => x.coins);
  const silver = quantile(raw(sharp), 0.4) * 0.95;
  const bronze = Math.min(
    silver * 0.8,
    (1 - h) * quantile(raw(careful), 0.5) * 0.8 +
      h * quantile(raw(sharp), 0.25) * 0.85,
  );
  row.suggest = [
    r5(bronze),
    r5(silver),
    r5(Math.max(silver * 1.12, quantile(raw(sharp), 0.8))),
  ];
  rows.push(row);
  if (!args.json) {
    const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
    console.log(
      `${String(level.id).padStart(2)} ${level.name.padEnd(16)} t=${level.targets.join('/').padEnd(12)} ` +
        `sharp ${Math.round(row.sharp.p25)}/${Math.round(row.sharp.p50)}/${Math.round(row.sharp.p75)} ♥${row.sharp.lives} live${pct(row.sharp.alive)} ` +
        `B${pct(row.sharp.bronze)} S${pct(row.sharp.silver)} G${pct(row.sharp.gold)} | ` +
        `careful ${Math.round(row.careful.p50)} ♥${row.careful.lives} live${pct(row.careful.alive)} B${pct(row.careful.bronze)} S${pct(row.careful.silver)} ` +
        `→ ${row.suggest.join('/')}`,
    );
  }
}
if (args.json) console.log(JSON.stringify(rows, null, 2));
if (args.write) {
  // Rewrite the MEASURED table in levels.ts with the suggestions.
  const { readFile, writeFile } = await import('node:fs/promises');
  const file = new URL('../../lib/games/diner/levels.ts', import.meta.url);
  const src = await readFile(file, 'utf8');
  const all = LEVELS.map(
    (l) => rows.find((r) => r.id === l.id)?.suggest ?? l.targets,
  );
  const table = `const MEASURED: ([number, number, number] | null)[] = [\n${all
    .map((t, i) => `  [${t.join(', ')}], // ${i + 1} ${LEVELS[i].name}`)
    .join('\n')}\n];`;
  const next = src.replace(
    /const MEASURED: \(\[number, number, number\] \| null\)\[\] = \[[\s\S]*?\n\];|const MEASURED: \(\[number, number, number\] \| null\)\[\] = \[\];/,
    table,
  );
  if (next === src) throw new Error('MEASURED table not found');
  await writeFile(file, next);
  console.log('wrote targets to lib/games/diner/levels.ts');
}
