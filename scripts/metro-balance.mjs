// Metro balance runs: whole matches played by bots in every seat, with the
// average total and what it is made of. These measure the bots, not people.
//
//   node --experimental-strip-types scripts/metro-balance.mjs [seats] [level] [games] [ext]
//   node --experimental-strip-types scripts/metro-balance.mjs 4 hard 8 goals,express
import { createMetro, observe, play } from '../lib/games/metro/engine.ts';
import { botTurn } from '../lib/games/metro/bot.ts';

const [seats, level, games, ext] = [
  Number(process.argv[2] ?? 4),
  process.argv[3] ?? 'hard',
  Number(process.argv[4] ?? 6),
  process.argv[5] ?? '',
];
const totals = [];
const sum = { lines: 0, inter: 0, goals: 0, joins: 0 };
const start = Date.now();
for (let k = 0; k < games; k++) {
  let g = createMetro(seats, 1000 + k * 7, {
    difficulty: level,
    bots: Array(seats).fill(true),
    ext: { goals: ext.includes('goals'), express: ext.includes('express') },
  });
  for (let guard = 0; guard < 500 && !g.over; guard++)
    for (let s = 0; s < seats; s++)
      if (!g.seats[s].locked)
        for (const m of botTurn(observe(g, s), s)) g = play(g, m, s);
  if (!g.over) throw new Error(`match ${k} did not finish`);
  for (const f of g.final) {
    totals.push(f.total);
    sum.lines += f.lines;
    sum.inter += f.interchanges.points;
    sum.goals += f.goalPoints;
  }
  for (const s of g.seats) sum.joins += s.lines.filter((l) => l.joined).length;
}
const n = totals.length;
const avg = (v) => (v / n).toFixed(1);
console.log(
  `${level}, ${seats} seat${seats > 1 ? 's' : ''}, ${games} matches, ${ext || 'no extensions'}: ` +
    `total ${avg(totals.reduce((a, b) => a + b, 0))} (${Math.min(...totals)}–${Math.max(...totals)}), ` +
    `lines ${avg(sum.lines)}, interchanges ${avg(sum.inter)}, goals ${avg(sum.goals)}, ` +
    `joined lines ${avg(sum.joins)} of 4, ${((Date.now() - start) / games).toFixed(0)} ms a match`,
);
