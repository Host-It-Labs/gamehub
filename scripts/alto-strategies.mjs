// Pits bots with different leanings against each other in Alto and prints
// each leaning's win rate, so no single kind of plan wins by itself.
//   node --experimental-strip-types scripts/alto-strategies.mjs [games] [options json]
import {
  createAlto,
  play,
  winners,
  actingSeats,
  scores,
} from '../lib/games/alto/engine.ts';
import { botMove } from '../lib/games/alto/bot.ts';

const games = Number(process.argv[2] ?? 200);
const extra = JSON.parse(process.argv[3] ?? '{}');
const styles = {
  plain: {},
  engine: { workshop: 1.6, ship: 1.4, monument: 0.8 },
  monuments: { monument: 1.5, workshop: 0.7, ship: 0.7 },
  ships: { ship: 1.8, workshop: 0.9 },
  civic: { civic: 1.6, monument: 0.9 },
  refits: { refit: 1.6 },
  breadth: { refit: 0 },
};
const names = Object.keys(styles);
for (const n of [2, 3, 4, 6]) {
  const wins = Object.fromEntries(names.map((k) => [k, 0]));
  const seats = Object.fromEntries(names.map((k) => [k, 0]));
  const points = Object.fromEntries(names.map((k) => [k, 0]));
  for (let k = 0; k < games; k++) {
    let g = createAlto(n, 7 + k * 104729 + n, 'medium', {
      length: 'standard',
      plans: 'first',
      ...extra,
    });
    const lean = g.players.map((_, s) => names[(k + s * 3) % names.length]);
    let guard = 0;
    while (!g.over && guard++ < 500)
      for (const s of actingSeats(g)) {
        g = play(g, botMove(g, s, styles[lean[s]]), s);
        if (g.over) break;
      }
    const w = new Set(winners(g));
    const sc = scores(g);
    lean.forEach((l, s) => {
      seats[l]++;
      points[l] += sc[s];
      if (w.has(s)) wins[l] += 1 / w.size;
    });
  }
  console.log(
    `${n} players: ` +
      names
        .map(
          (l) =>
            `${l} ${((wins[l] / seats[l]) * n * 100).toFixed(0)}% (${(points[l] / seats[l]).toFixed(1)})`,
        )
        .join(' · ') +
      '   (100% = fair share)',
  );
}
