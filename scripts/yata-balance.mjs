// Reproducible medium-bot comparison of the legacy and three-round Side B menus.
// Simulation is a tuning aid, not a substitute for human playtesting.
import {
  createGame,
  play,
  observe,
  counts,
  foodBreakdown,
  scores,
  festivalBreakdown,
} from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';
const output = [];
for (const rounds of [2, 3])
  for (const seats of [2, 3, 6])
    for (const extensions of [false, true]) {
      const stats = {
        rounds,
        seats,
        extensions,
        games: 40,
        score: 0,
        byDish: Array(6).fill(0),
        picked: Array(6).fill(0),
        bonus: 0,
        season: 0,
        types: 0,
      };
      for (let seed = 1; seed <= 40; seed++) {
        let g = createGame(
          'midnight',
          'medium',
          seed,
          false,
          seats,
          false,
          false,
          extensions,
          false,
          {
            contentSet: rounds === 3 ? 'intermediate' : 'beginner',
            specialtyStalls: extensions,
            marketSeasons: extensions,
          },
        );
        g.contentSet = 'intermediate';
        while (g.phase !== 'over') {
          g = play(g, chooseMove(observe(g), 'medium'));
        }
        g.players.forEach((p, i) => {
          stats.score += scores(g)[i];
          stats.bonus += festivalBreakdown(p).total;
          stats.season += p.seasonPoints ?? 0;
          const c = counts(p.zones[0]);
          stats.types += c.filter(Boolean).length;
          const sc = foodBreakdown(
            p.zones[0],
            g.players.filter((_, j) => j !== i).map((p) => p.zones[0]),
            g.contentSet,
          );
          for (let k = 0; k < 6; k++) {
            stats.byDish[k] += sc[k];
            stats.picked[k] += c[k];
          }
        });
      }
      const n = stats.games * seats;
      for (const key of ['score', 'bonus', 'season', 'types'])
        stats[key] = +(stats[key] / n).toFixed(2);
      for (const key of ['byDish', 'picked'])
        stats[key] = stats[key].map((v) => +(v / n).toFixed(2));
      output.push(stats);
    }
console.log(JSON.stringify(output, null, 2));
