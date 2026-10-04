// How strong each Alto upgrade is: one bot leans hard toward it (or never
// builds it) against plain bots, and its win rate is compared with a fair
// share. A big gap between leaning and avoiding means the upgrade decides
// matches by itself; a negative one means it is a trap.
//   node --experimental-strip-types scripts/alto-strength.mjs [games] [players] [options json]
import {
  createAlto,
  play,
  winners,
  actingSeats,
  scores,
} from '../lib/games/alto/engine.ts';
import { botMove } from '../lib/games/alto/bot.ts';
import { planById, plans } from '../lib/games/alto/content.ts';

const games = Number(process.argv[2] ?? 300);
const n = Number(process.argv[3] ?? 4);
const extra = JSON.parse(process.argv[4] ?? '{}');
const random = extra.plans === 'random';

function run(style, offered) {
  let wins = 0,
    points = 0,
    built = 0,
    count = 0;
  for (let k = 0; k < games; k++) {
    let g = createAlto(n, 31 + k * 104729 + n, 'medium', {
      length: 'standard',
      plans: 'first',
      ...extra,
    });
    if (offered && !g.plans.flat().includes(offered)) continue;
    count++;
    // The leaning seat moves round the table so seat order never counts.
    const lean = k % n;
    let guard = 0;
    while (!g.over && guard++ < 500)
      for (const s of actingSeats(g)) {
        g = play(g, botMove(g, s, s === lean ? style : {}), s);
        if (g.over) break;
      }
    const w = winners(g);
    if (w.includes(lean)) wins += 1 / w.length;
    points += scores(g)[lean] - scores(g).reduce((a, b) => a + b, 0) / n;
    if (offered && g.players[lean].built.includes(offered)) built++;
  }
  return {
    win: (wins / count) * n * 100,
    edge: points / count,
    built: (built / count) * 100,
    count,
  };
}

const ids = process.argv[5]
  ? process.argv[5].split(',')
  : plans.map((p) => p.id);
console.log(
  `${n} players, ${games} games each${random ? ' (random sets)' : ''} — 100 = fair share`,
);
console.log(
  'upgrade        year  lean win (built%)  avoid win   gap   lean pts  avoid pts',
);
for (const id of ids) {
  if (
    !random &&
    !createAlto(n, 1, 'medium', {
      length: 'standard',
      plans: 'first',
      ...extra,
    })
      .plans.flat()
      .includes(id)
  )
    continue;
  const lean = run({ [id]: 3 }, id);
  const avoid = run({ [id]: 0 }, id);
  const p = planById[id];
  console.log(
    `${(p.name + '          ').slice(0, 14)} ${p.season}    ${lean.win.toFixed(0).padStart(4)} (${lean.built.toFixed(0).padStart(3)}%)    ${avoid.win.toFixed(0).padStart(5)}   ${(lean.win - avoid.win).toFixed(0).padStart(4)}   ${lean.edge.toFixed(1).padStart(6)}   ${avoid.edge.toFixed(1).padStart(6)}`,
  );
}
