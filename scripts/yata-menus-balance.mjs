// Medium-bot comparison of Yata's four menus (Tokyo, Bangkok, Mexico, Puebla):
// mean points per player and, per dish, portions picked and points per portion.
// A tuning aid, not a substitute for human playtesting.
//   node --experimental-strip-types scripts/yata-menus-balance.mjs [seeds]
import {
  createGame,
  play,
  observe,
  counts,
  foodBreakdown,
  scores,
  foodsFor,
  yataContentSets,
  yataMenuNames,
} from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';
const seeds = Number(process.argv[2] ?? 20);
for (const set of yataContentSets)
  for (const seats of [2, 4, 6]) {
    const points = Array(6).fill(0),
      picked = Array(6).fill(0);
    let total = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      let g = createGame(
        'midnight',
        'medium',
        seed,
        false,
        seats,
        false,
        false,
        false,
        false,
        { contentSet: set },
      );
      while (g.phase !== 'over') g = play(g, chooseMove(observe(g), 'medium'));
      total += scores(g).reduce((a, b) => a + b, 0);
      g.players.forEach((p, i) => {
        const b = foodBreakdown(
          p.zones[0],
          g.players.filter((_, j) => j !== i).map((q) => q.zones[0]),
          set,
        );
        const c = counts(p.zones[0]);
        for (let k = 0; k < 6; k++) {
          points[k] += b[k];
          picked[k] += c[k];
        }
      });
    }
    const n = seeds * seats;
    console.log(
      `${yataMenuNames[set]}, ${seats} seats: ${(total / n).toFixed(1)} points per player`,
    );
    console.log(
      foodsFor(set)
        .map(
          (f, k) =>
            `  ${f.name.padEnd(11)} ${(picked[k] / n).toFixed(1)} picked, ${(points[k] / Math.max(1, picked[k])).toFixed(2)} per pick`,
        )
        .join('\n'),
    );
  }
