import {
  createProfile,
  startCampaign,
  routeChoices,
  chooseRoute,
  settleShift,
  selectUpgrade,
  UPGRADES,
} from '../../../../lib/games/diner/campaign.ts';
import { open, campaignShiftWon } from '../../../../lib/games/diner/engine.ts';
import { playShift } from '../../../../lib/games/diner/bot.ts';
import { writeFileSync } from 'node:fs';

const pause = Number(process.argv[2] ?? 20);
const veteran = process.argv.includes('--veteran');
const priority = [
  'dishwasher',
  'cash-runner',
  'turbo-grill',
  'quiet-blender',
  'heat-lamps',
  'express-service',
  'set-menu',
  'auto-restock',
  'warm-greeting',
  'welcome-mat',
  'tip-jar',
  'house-special',
  'combo-till',
  'hot-plates',
  'table-bells',
  'tool-roll',
  'maintenance-kit',
  'backup-battery',
  'vip-service',
  'night-watch',
  'rubber-boots',
  'safety-net',
  'prep-shelf',
  'crisp-fryer',
  'fast-mop',
  'bill-insurance',
  'spill-guard',
  'printed-menus',
  'mop-bounty',
  'scrap-bin',
  'fresh-stock',
  'shift-shield',
  'tip-night',
];
const samples = [];
for (const seed of [11, 22, 33, 44, 55, 66, 77, 88, 99, 111]) {
  let p = createProfile();
  if (veteran)
    p = {
      ...p,
      upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, u.max])),
      bestStage: 18,
    };
  let { profile, run } = startCampaign(p, seed);
  const shifts = [];
  for (let stage = 0; stage < 18; stage++) {
    const route = routeChoices(run).sort((a, b) => {
      const score = (r) =>
        (r.config.mechanics.jams && !r.config.effects.repairPower
          ? 5
          : r.config.mechanics.jams
            ? 2
            : 0) +
        (r.config.mechanics.power && !r.config.effects.backupPower ? 2 : 0) +
        (r.config.mechanics.spills ? 1 : 0) +
        (r.config.mechanics.rush ? 1 : 0);
      return score(a) - score(b);
    })[0];
    run = chooseRoute(run, route.id);
    const m = run.savedMatch;
    open(m);
    playShift(m, true, pause);
    shifts.push({
      stage: stage + 1,
      boss: m.config.boss,
      route: route.name,
      coins: m.coins,
      stars: m.stars,
      served: m.stats.served,
      caught: m.stats.caught,
      repairs: m.activity.repairs,
      vip: m.activity.vipServed,
      burnt: m.stats.burnt,
      goal: m.config.goal,
      won: campaignShiftWon(m),
    });
    ({ profile, run } = settleShift(profile, run, m));
    if (run.status === 'failed') break;
    const pick = [...run.offers].sort(
      (a, b) => priority.indexOf(a) - priority.indexOf(b),
    )[0];
    run = selectUpgrade(run, pick);
  }
  samples.push({
    seed,
    reached: shifts.length,
    cleared: shifts.filter((s) => s.won).length,
    status: run.status,
    earned: run.earned,
    perks: run.perks,
    shifts,
  });
}
const file = new URL(
  `diner-balance-${veteran ? 'veteran' : 'fresh'}-${pause}.json`,
  import.meta.url,
);
writeFileSync(file, JSON.stringify({ pause, veteran, samples }, null, 2));
console.log(
  JSON.stringify(
    {
      file: file.pathname,
      pause,
      veteran,
      completed: samples.filter((s) => s.status === 'complete').length,
      meanCleared: samples.reduce((a, s) => a + s.cleared, 0) / samples.length,
      samples: samples.map((s) => ({
        seed: s.seed,
        cleared: s.cleared,
        earned: s.earned,
        last: s.shifts.at(-1),
      })),
    },
    null,
    2,
  ),
);
