// Each crew's win rate and points in bot matches with the Crew extension on.
//   node --experimental-strip-types scripts/alto-crew.mjs [games] [sizes]
import {
  createAlto,
  play,
  winners,
  actingSeats,
  scores,
} from '../lib/games/alto/engine.ts';
import { botMove } from '../lib/games/alto/bot.ts';
import { captains } from '../lib/games/alto/content.ts';

const games = Number(process.argv[2] ?? 300);
for (const n of (process.argv[3] ?? '2,4,6').split(',').map(Number)) {
  const stat = Object.fromEntries(
    captains.map((c) => [c.id, { seats: 0, wins: 0, points: 0, edge: 0 }]),
  );
  for (let k = 0; k < games; k++) {
    let g = createAlto(n, 17 + k * 7919 + n, 'medium', {
      length: 'standard',
      plans: 'random',
      captains: true,
    });
    let guard = 0;
    while (!g.over && guard++ < 500)
      for (const s of actingSeats(g)) {
        g = play(g, botMove(g, s), s);
        if (g.over) break;
      }
    const w = winners(g);
    const sc = scores(g);
    const avg = sc.reduce((a, b) => a + b, 0) / n;
    g.players.forEach((p, s) => {
      const c = stat[p.captain];
      c.seats++;
      c.points += sc[s];
      c.edge += sc[s] - avg;
      if (w.includes(s)) c.wins += 1 / w.length;
    });
  }
  console.log(
    `${n} players: ` +
      captains
        .map((c) => {
          const x = stat[c.id];
          return `${c.name} ${x.seats ? ((x.wins / x.seats) * n * 100).toFixed(0) : '-'}% (${x.seats ? (x.edge / x.seats >= 0 ? '+' : '') + (x.edge / x.seats).toFixed(1) : '-'})`;
        })
        .join(' · '),
  );
}
