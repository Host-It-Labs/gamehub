// Plays many Alto matches between bots and prints how the upgrades, cargo and
// scores come out. Usage:
//   node --experimental-strip-types scripts/alto-balance.mjs [games] [options json] [levels] [players]
// e.g. node --experimental-strip-types scripts/alto-balance.mjs 200 '{"plans":"random","orders":true}'
import {
  createAlto,
  play,
  breakdown,
  winners,
  actingSeats,
  hold,
  turnsPerSeason,
} from '../lib/games/alto/engine.ts';
import { botMove } from '../lib/games/alto/bot.ts';
import { goods, planById } from '../lib/games/alto/content.ts';

const games = Number(process.argv[2] ?? 100);
const extra = JSON.parse(process.argv[3] ?? '{}');
const levels = (process.argv[4] ?? 'medium').split(',');
const sizes = (process.argv[5] ?? '2,3,4,5,6').split(',').map(Number);

for (const n of sizes) {
  const stats = {
    total: 0,
    top: 0,
    margin: 0,
    builds: 0,
    leftover: 0,
    alone: 0,
    flights: 0,
    parts: {},
    plan: {},
    offered: {},
    win: {},
    holds: 0,
    income: 0,
    perYear: [0, 0, 0],
    pile: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    pileN: [0, 0, 0, 0],
    pileMax: [0, 0, 0, 0],
    kindTaken: [0, 0, 0, 0],
  };
  for (let k = 0; k < games; k++) {
    let g = createAlto(n, 1000 + k * 7919 + n, 'medium', {
      length: 'standard',
      plans: 'first',
      ...extra,
    });
    g.difficulty = levels[0];
    for (const id of g.plans.flat())
      stats.offered[id] = (stats.offered[id] ?? 0) + 1;
    let guard = 0;
    while (!g.over && guard++ < 500) {
      for (const s of actingSeats(g)) {
        const probe = { ...g, difficulty: levels[s % levels.length] };
        const m = botMove(probe, s);
        const next = play(g, m, s);
        if (next === g)
          throw new Error(`bot move refused: ${JSON.stringify(m)}`);
        g = next;
        if (g.over) break;
      }
    }
    const b = g.players.map((_, s) => breakdown(g, s));
    const sc = b.map((x) => x.total).sort((a, c) => c - a);
    stats.total += b.reduce((a, x) => a + x.total, 0) / n;
    stats.top += sc[0];
    stats.margin += sc[0] - sc[1];
    const win = new Set(winners(g));
    g.players.forEach((p, s) => {
      stats.builds += p.built.length / n;
      stats.leftover += p.stock.reduce((a, v) => a + v, 0) / n;
      stats.holds += hold(p) / n;
      for (const [key, v] of Object.entries(b[s]))
        if (key !== 'total') stats.parts[key] = (stats.parts[key] ?? 0) + v / n;
      for (const id of p.built) {
        stats.plan[id] = (stats.plan[id] ?? 0) + 1;
        stats.perYear[planById[id].season - 1] += 1 / n;
        if (win.has(s)) stats.win[id] = (stats.win[id] ?? 0) + 1;
      }
    });
    const per = turnsPerSeason(g);
    for (const r of g.history) {
      stats.income +=
        (r.takes.reduce((a, v) => a + v, 0) +
          r.bonus.reduce((a, v) => a + v, 0)) /
        n;
      stats.flights += r.visits.length;
      r.visits.forEach((i, s) => {
        stats.alone += r.visits.filter((j) => j === i).length === 1 ? 1 : 0;
        stats.kindTaken[g.islands[i].good] += r.takes[s] + r.bonus[s];
      });
      // Piles as the ships arrive on the year's last turn.
      if (r.turn === per)
        r.piles.forEach((v, i) => {
          stats.pile[r.season - 1][g.islands[i].good] += v;
          if (r.season === 1) stats.pileN[g.islands[i].good]++;
        });
      r.piles.forEach(
        (v, i) =>
          (stats.pileMax[g.islands[i].good] = Math.max(
            stats.pileMax[g.islands[i].good],
            v,
          )),
      );
    }
  }
  const f = (v) => (v / games).toFixed(1);
  console.log(
    `\n${n} players — avg ${f(stats.total)}, winner ${f(stats.top)}, margin ${f(stats.margin)}, built ${f(stats.builds)} (per year ${stats.perYear.map(f).join('/')}), hold ${f(stats.holds)}, cargo left ${f(stats.leftover)}, alone ${((stats.alone / stats.flights) * 100).toFixed(0)}%, loaded ${f(stats.income)}`,
  );
  console.log(
    '  points:',
    Object.entries(stats.parts)
      .map(([k, v]) => `${k} ${f(v)}`)
      .join(', '),
  );
  console.log(
    '  piles at each year end (avg per planet of that kind):',
    goods
      .map(
        (name, k) =>
          `${name} ${stats.pile.map((y) => (y[k] / Math.max(1, stats.pileN[k])).toFixed(1)).join('/')} max ${stats.pileMax[k]}`,
      )
      .join(' · '),
  );
  console.log(
    '  loaded per player by kind:',
    goods
      .map(
        (name, k) => `${name} ${(stats.kindTaken[k] / games / n).toFixed(1)}`,
      )
      .join(', '),
  );
  const rows = Object.entries(stats.offered).sort(
    (a, b) =>
      planById[a[0]].season - planById[b[0]].season ||
      (stats.plan[b[0]] ?? 0) / b[1] - (stats.plan[a[0]] ?? 0) / a[1],
  );
  console.log(
    '  upgrades (built by % of players when offered · win share when built, fair ' +
      (100 / n).toFixed(0) +
      '):',
  );
  console.log(
    '  ' +
      rows
        .map(
          ([id, offered]) =>
            `${planById[id].name} ${(((stats.plan[id] ?? 0) / offered / n) * 100).toFixed(0)}%·${stats.plan[id] ? (((stats.win[id] ?? 0) / stats.plan[id]) * 100).toFixed(0) : '-'}`,
        )
        .join('  '),
  );
}
