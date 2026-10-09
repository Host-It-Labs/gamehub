#!/usr/bin/env node
/**
 * Whole, deterministic night routes. No invented wins, lives or shift income.
 * node --experimental-strip-types scripts/diner/balance.mjs --seeds=80 --out=after.json
 * --pause=36 --upgrades=none|full|coffee-urn:1,spare-tire:2 selects one cohort.
 * --source=docs/concepts/2026-10-08-diner-car/balance/before replays the baseline.
 * --progression=12 follows twelve independent players buying the Workshop.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  open,
  HZ,
  step,
  actionFor,
  createConfiguredMatch,
} from '../../lib/games/diner/engine.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = resolve(root, 'docs/concepts/2026-10-08-diner-car/balance');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (!a.startsWith('--')) throw new Error(`Expected --option=value: ${a}`);
    const [key, ...value] = a.slice(2).split('=');
    return [key, value.length ? value.join('=') : 'true'];
  }),
);
const allowed = [
  'seeds',
  'start',
  'pause',
  'upgrades',
  'source',
  'out',
  'progression',
  'probes',
  'audit',
  'help',
];
for (const key of Object.keys(args))
  if (!allowed.includes(key)) throw new Error(`Unknown option: --${key}`);
if (args.help) {
  console.log(
    'Diner balance: --seeds=80 --start=1 [--pause=20 --upgrades=full] [--source=<baseline directory>] [--out=<balance filename>] [--progression=12] [--probes=40] [--audit=true]',
  );
  process.exit(0);
}
function integer(value, fallback, min, max) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new Error(`Expected integer ${min}..${max}, got ${value}`);
  return n;
}
const count = integer(args.seeds, 80, 1, 10000);
const start = integer(args.start, 1, 0, 4294957295);
const source = resolve(root, args.source ?? 'lib/games/diner');
const c = await import(pathToFileURL(resolve(source, 'campaign.ts')).href);
const b = await import(pathToFileURL(resolve(source, 'bot.ts')).href);
const road = await import(pathToFileURL(resolve(source, 'road.ts')).href);
const full = Object.fromEntries(c.UPGRADES.map((u) => [u.id, u.max]));
function ranks(value = 'none') {
  if (value === 'full') return { ...full };
  if (value === 'none') return {};
  const out = {};
  for (const part of value.split(',')) {
    const [id, n] = part.split(':');
    const u = c.UPGRADES.find((x) => x.id === id);
    if (!u || n === undefined)
      throw new Error(`Unknown Workshop rank: ${part}`);
    out[id] = integer(n, 0, 0, u.max);
  }
  return out;
}
// This ranking uses only equipment descriptions and current, visible health.
const GEAR_VALUE = {
  'safety-net': 100,
  'roller-skates': 95,
  'chrome-tray': 90,
  'order-pad': 85,
  'warm-plates': 80,
  'welcome-mat': 76,
  'auto-restock': 72,
  dishwasher: 70,
  'set-menu': 68,
  'picture-menus': 65,
  'turbo-grill': 62,
  'golden-spatula': 60,
  'heat-lamps': 58,
  'express-eaters': 56,
  'cash-runner': 54,
  'quick-blender': 52,
  'prep-shelf': 50,
  'combo-till': 48,
  'tip-jar': 46,
  'house-special': 44,
  toolbox: 74,
  'rubber-boots': 64,
  'backup-battery': 66,
  'night-watch': 42,
};
const value = (id, run) =>
  id === 'second-wind'
    ? run.maxLives - run.lives >= 2
      ? 120
      : run.lives < run.maxLives
        ? 78
        : -1
    : (GEAR_VALUE[id] ?? 0);
const bestGear = (run, offers = run.offers) =>
  [...offers].sort(
    (a, z) => value(z, run) - value(a, run) || a.localeCompare(z),
  )[0];
/** A simple local fork policy; it never looks ahead at hidden offers or RNG. */
function chooseFork(run) {
  const hurt = run.lives <= run.maxLives - 2;
  const score = (n) => {
    let v =
      n.reward === 'rare'
        ? 60
        : n.reward === 'gear'
          ? 50
          : n.reward === 'cash'
            ? 25
            : 10;
    if (n.reward === 'life') v = hurt ? 90 : run.lives < run.maxLives ? 45 : 0;
    if (n.kind === 'motel') v = hurt ? 110 : run.lives < run.maxLives ? 70 : 35;
    if (n.kind === 'garage') {
      const spare = run.wallet - n.gas;
      v = spare >= c.GEAR_PRICE.common + 15 * n.leg ? 75 : -10;
      if (hurt && spare >= c.patchPrice({ ...run, at: n.id })) v += 30;
    }
    if (run.wallet < n.gas) v -= 35;
    return v - n.busy * 3;
  };
  return [...c.runChoices(run)].sort(
    (a, z) => score(z) - score(a) || a.id.localeCompare(z.id),
  )[0];
}

/** Input-only observations: counters, parties, outfits and the player's hands. */
function play(match, pause, audit) {
  open(match);
  if (!audit)
    return {
      match: b.playShift(match, true, pause, (match.config.seconds + 1) * HZ),
      tools: {},
    };
  const memories = match.players.map(() => b.botMemory());
  const tools = {};
  for (
    let tick = 0;
    tick <= match.config.seconds * HZ && match.phase !== 'over';
    tick++
  ) {
    const claims = new Set();
    const inputs = match.players.map((_, pi) =>
      b.botInput(match, pi, memories[pi], claims, true, pause),
    );
    const intents = inputs.map((input, pi) =>
      input.use ? actionFor(match, pi)?.kind : input.out ? 'out' : null,
    );
    step(match, inputs);
    for (const e of match.events) tools[e.type] = (tools[e.type] ?? 0) + 1;
    for (const [pi, kind] of intents.entries()) {
      if (
        kind &&
        match.events.some((e) => e.type === 'deny' && e.player === pi)
      )
        tools.deniedIntent = (tools.deniedIntent ?? 0) + 1;
    }
    tools.maxHands = Math.max(
      tools.maxHands ?? 0,
      ...match.players.map((p) => p.hands.length),
    );
    match.events.length = 0;
  }
  return { match, tools };
}

function simulate(seed, pause, upgrades, suppliedProfile, audit = false) {
  let { profile, run } = c.startRun(
    suppliedProfile ?? { ...c.createProfile(), upgrades },
    seed,
  );
  const stops = [],
    equipment = [];
  let record;
  for (
    let guard = 0;
    guard < 120 && run.status !== 'over' && run.status !== 'cleared';
    guard++
  ) {
    if (run.status === 'route') {
      const node = chooseFork(run);
      if (!node) throw new Error(`No reachable fork, seed ${seed}`);
      const before = run;
      run = c.driveTo(run, node.id);
      record = {
        stop: run.visited.length,
        node: node.id,
        leg: node.leg + 1,
        kind: node.kind,
        place: node.place,
        boss: node.boss,
        busy: node.busy,
        reward: node.reward,
        gas: node.gas,
        pushed: before.wallet < node.gas,
        walletBefore: before.wallet,
        walletAfterGas: run.wallet,
        livesBefore: before.lives,
        gasLost: before.lives - run.lives,
        shiftLost: 0,
        coins: 0,
        tokens: 0,
        medals: 0,
        survived: false,
        tools: {},
      };
      stops.push(record);
    } else if (run.status === 'shift') {
      const { match, tools } = play(
        structuredClone(run.savedMatch),
        pause,
        audit,
      );
      if (match.phase !== 'over')
        throw new Error(`Shift timed out, seed ${seed}`);
      const settled = c.settleShift(profile, run, match);
      if (settled.run === run)
        throw new Error(`Settlement refused, seed ${seed}`);
      ({ profile, run } = settled);
      Object.assign(record, {
        shiftLost: run.lastResult.lost,
        coins: match.coins,
        tokens: run.lastResult.tokens,
        medals: run.lastResult.medals,
        survived: run.lastResult.survived,
        banked: run.lastResult.banked,
        targets: match.targets,
        served: match.stats.served,
        caught: match.stats.caught,
        wrong: match.stats.wrong,
        burnt: match.stats.burnt,
        tools,
      });
    } else if (run.status === 'reward') {
      let id = bestGear(run);
      if (run.rerolls > 0 && value(id, run) < 65) {
        run = c.rerollOffers(run);
        id = bestGear(run);
      }
      equipment.push({ stop: record.stop, id, from: 'reward', price: 0 });
      run = c.pickGear(run, id);
    } else if (run.status === 'garage') {
      // Keep enough for the next drive; the policy cannot foresee its exact fork.
      const reserve = road.gasFor(
        c.runNode(run).leg,
        c.runNode(run).col + 1,
        2,
      );
      if (run.lives < run.maxLives && run.wallet >= c.patchPrice(run) + reserve)
        run = c.patchUp(run);
      for (const id of [...run.offers].sort(
        (a, z) => value(z, run) - value(a, run),
      )) {
        const price = c.gearPrice(run, id);
        if (run.wallet < price + reserve || value(id, run) < 0) continue;
        equipment.push({ stop: record.stop, id, from: 'garage', price });
        run = c.buyGear(run, id);
      }
      run = c.leaveStop(run);
      record.survived = true;
    } else if (run.status === 'motel') {
      run = run.lives < run.maxLives ? c.motelRest(run) : c.motelTune(run);
      record.survived = true;
    } else throw new Error(`Unexpected status ${run.status}`);
    if (record)
      Object.assign(record, { walletAfter: run.wallet, livesAfter: run.lives });
  }
  if (!['over', 'cleared'].includes(run.status))
    throw new Error(`Run timed out, seed ${seed}`);
  return {
    seed,
    pause,
    reached: run.visited.length,
    cleared: run.status === 'cleared',
    bosses: run.bosses,
    wallet: run.wallet,
    tokens: run.tokens,
    lost: stops.reduce((sum, s) => sum + s.gasLost + s.shiftLost, 0),
    pushed: stops.filter((s) => s.pushed).length,
    equipment,
    stops,
    profile,
  };
}
const mean = (a) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0);
const quantile = (a, q) => {
  const sorted = [...a].sort((x, y) => x - y);
  const at = (sorted.length - 1) * q;
  return sorted.length
    ? sorted[Math.floor(at)] +
        (sorted[Math.ceil(at)] - sorted[Math.floor(at)]) * (at % 1)
    : null;
};
const distribution = (a) =>
  Object.fromEntries(
    [...new Set(a)]
      .sort((x, y) => x - y)
      .map((n) => [n, a.filter((x) => x === n).length]),
  );
function losses(stops) {
  return {
    n: stops.length,
    meanShiftLost: mean(stops.map((s) => s.shiftLost)),
    meanGasLost: mean(stops.map((s) => s.gasLost)),
    survival: mean(stops.map((s) => Number(s.survived))),
    meanCoins: mean(stops.map((s) => s.coins)),
    meanWallet: mean(stops.map((s) => s.walletAfter)),
    zeroMedals: stops.filter((s) => s.medals === 0).length,
    pushed: stops.filter((s) => s.pushed).length,
  };
}
function summarize(name, runs) {
  const shifts = runs
    .flatMap((r) => r.stops)
    .filter((s) => s.kind === 'shift' || s.kind === 'boss');
  const allStops = runs.flatMap((r) => r.stops);
  const gear = runs.flatMap((r) => r.equipment);
  const counts = (items) =>
    Object.fromEntries(
      [...new Set(items)]
        .sort((a, z) => a.localeCompare(z))
        .map((id) => [id, items.filter((x) => x === id).length]),
    );
  return {
    name,
    n: runs.length,
    pause: runs[0].pause,
    medianReached: quantile(
      runs.map((r) => r.reached),
      0.5,
    ),
    reachedP10: quantile(
      runs.map((r) => r.reached),
      0.1,
    ),
    reachedP90: quantile(
      runs.map((r) => r.reached),
      0.9,
    ),
    reached10: runs.filter((r) => r.reached >= 10).length / runs.length,
    cleared: runs.filter((r) => r.cleared).length / runs.length,
    medianDeath: quantile(
      runs.filter((r) => !r.cleared).map((r) => r.reached),
      0.5,
    ),
    stopsReached: distribution(runs.map((r) => r.reached)),
    meanWallet: mean(runs.map((r) => r.wallet)),
    medianWallet: quantile(
      runs.map((r) => r.wallet),
      0.5,
    ),
    meanTokens: mean(runs.map((r) => r.tokens)),
    medianTokens: quantile(
      runs.map((r) => r.tokens),
      0.5,
    ),
    minTokens: Math.min(...runs.map((r) => r.tokens)),
    firstUpgrade: mean(
      runs.map((r) =>
        Number(r.tokens >= Math.min(...c.UPGRADES.flatMap((u) => u.costs))),
      ),
    ),
    meanLost: mean(runs.map((r) => r.lost)),
    pushedRuns: runs.filter((r) => r.pushed).length,
    byStop: Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [
        i + 1,
        losses(allStops.filter((s) => s.stop === i + 1)),
      ]),
    ),
    byPlace: Object.fromEntries(
      road.PLACE_IDS.map((id) => [
        id,
        losses(shifts.filter((s) => s.place === id && !s.boss)),
      ]),
    ),
    byBoss: Object.fromEntries(
      Object.keys(road.BOSSES).map((id) => [
        id,
        losses(shifts.filter((s) => s.boss === id)),
      ]),
    ),
    forks: counts(allStops.map((s) => `${s.kind}:${s.reward ?? '-'}`)),
    equipment: counts(gear.map((g) => `${g.from}:${g.id}`)),
    tools: Object.fromEntries(
      [
        'put',
        'pick',
        'pot',
        'pour',
        'juke',
        'dash',
        'deny',
        'deniedIntent',
      ].map((k) => [
        k,
        allStops.reduce((sum, s) => sum + (s.tools[k] ?? 0), 0),
      ]),
    ),
  };
}

/**
 * Fixed-route income sensitivity, separate from the playable runs: cap each
 * shift just below bronze and pay the real gas and actual Garage bill.
 * This is a wallet ledger, not a claim that the capped run survives its shifts.
 */
function medalFreeLedger(runs) {
  const legs = [[], [], []];
  for (const r of runs) {
    let wallet = (r.profile?.upgrades?.['gas-can'] ?? 0) * 25;
    for (const s of r.stops) {
      const before = wallet;
      wallet = Math.max(0, wallet - s.gas);
      const income = s.targets ? Math.min(s.coins, s.targets[0] - 1) : 0;
      wallet += Math.round(
        income * (s.survived && s.reward === 'cash' ? 1.5 : 1),
      );
      const spent =
        s.kind === 'garage' ? Math.max(0, s.walletAfterGas - s.walletAfter) : 0;
      wallet = Math.max(0, wallet - spent);
      legs[s.leg - 1].push({ wallet, pushed: before < s.gas });
    }
  }
  return legs.map((stops, i) => ({
    leg: i + 1,
    n: stops.length,
    meanWallet: mean(stops.map((s) => s.wallet)),
    pushed: stops.filter((s) => s.pushed).length,
  }));
}

const cohorts =
  args.pause !== undefined || args.upgrades !== undefined
    ? [
        {
          name: 'custom',
          pause: integer(args.pause, 20, 0, 300),
          upgrades: ranks(args.upgrades),
        },
      ]
    : [
        { name: 'newcomer', pause: 36, upgrades: {} },
        { name: 'sharp', pause: 20, upgrades: {} },
        { name: 'workshop', pause: 20, upgrades: full },
      ];
const results = [];
for (const cohort of cohorts) {
  const runs = Array.from({ length: count }, (_, i) =>
    simulate(
      start + i,
      cohort.pause,
      cohort.upgrades,
      undefined,
      args.audit === 'true',
    ),
  );
  results.push({
    ...cohort,
    summary: summarize(cohort.name, runs),
    medalFreeLedger: medalFreeLedger(runs),
    runs: runs.map(({ profile: _profile, ...r }) => r),
  });
  console.log(JSON.stringify(results.at(-1).summary));
}

const progression = [];
const buyingOrder = [
  'spare-tire',
  'roller-skates',
  'chrome-tray',
  'coffee-urn',
  'jukebox',
  'twin-grill',
  'spare-tire',
  'gas-can',
  'neon-sign',
  'heat-lamp-pass',
  'bigger-patio',
  'neon-sign',
  'gas-can',
  'lucky-dice',
  'road-atlas',
];
for (let player = 0; player < integer(args.progression, 0, 0, 100); player++) {
  let profile = c.createProfile();
  const history = [];
  for (
    let index = 0;
    index < 100 &&
    !c.UPGRADES.every((u) => (profile.upgrades[u.id] ?? 0) === u.max);
    index++
  ) {
    const run = simulate(
      (start + player * 1000 + index) >>> 0,
      20,
      profile.upgrades,
      profile,
    );
    profile = run.profile;
    const bought = [];
    // Buy useful tools early, one rank at a time. No upgrades change mid-run.
    for (const id of buyingOrder) {
      if (!c.canBuyUpgrade(profile, id)) continue;
      profile = c.buyUpgrade(profile, id);
      bought.push(id);
    }
    history.push({
      seed: run.seed,
      reached: run.reached,
      cleared: run.cleared,
      tokens: run.tokens,
      bank: profile.tokens,
      bought,
    });
  }
  progression.push({
    player,
    runsToMax: c.UPGRADES.every((u) => profile.upgrades[u.id] === u.max)
      ? history.length
      : null,
    history,
  });
}
if (progression.length)
  console.log(
    JSON.stringify({
      progression: {
        n: progression.length,
        median: quantile(
          progression
            .filter((p) => p.runsToMax !== null)
            .map((p) => p.runsToMax),
          0.5,
        ),
        min: Math.min(...progression.map((p) => p.runsToMax ?? Infinity)),
        max: Math.max(...progression.map((p) => p.runsToMax ?? Infinity)),
        incomplete: progression.filter((p) => p.runsToMax === null).length,
      },
    }),
  );
// Isolated native-leg shifts, always starting with the cohort's full lives,
// with no found gear or fork-selection bias. These are not whole runs.
const probes = [];
const probeCount = integer(args.probes, 0, 0, 1000);
if (probeCount) {
  const situations = [
    ...road.PLACE_IDS.map((place) => ({
      place,
      boss: null,
      leg: ['truckstop', 'drivein'].includes(place)
        ? 0
        : place === 'moonmile'
          ? 2
          : 1,
    })),
    ...Object.entries(road.BOSSES).map(([boss, { place }], leg) => ({
      place,
      boss,
      leg,
    })),
  ];
  for (const upgrades of [{}, full])
    for (const situation of situations) {
      const samples = [];
      for (let i = 0; i < probeCount; i++) {
        const seed = start + i;
        const { run } = c.startRun({ ...c.createProfile(), upgrades }, seed);
        const native = c
          .runMap(run)
          .legs[situation.leg].nodes.find(
            (n) =>
              n.col === (situation.boss ? 4 : 3) &&
              n.kind === (situation.boss ? 'boss' : 'shift'),
          );
        const node = { ...native, ...situation, busy: 3 };
        const config = c.shiftConfig(run, node);
        const { match } = play(
          createConfiguredMatch(seed, config, ['Bot']),
          20,
          false,
        );
        samples.push({
          seed,
          lost: run.lives - match.stars,
          survived: match.stars > 0,
          coins: match.coins,
        });
      }
      probes.push({
        cohort: Object.keys(upgrades).length ? 'workshop' : 'sharp',
        ...situation,
        n: probeCount,
        meanLost: mean(samples.map((s) => s.lost)),
        survived: mean(samples.map((s) => Number(s.survived))),
        samples,
      });
    }
  console.log(
    JSON.stringify({ probes: probes.map(({ samples: _samples, ...s }) => s) }),
  );
}
const fingerprints = {};
for (const name of ['bot', 'campaign', 'campaign-content', 'road'])
  fingerprints[name] = createHash('sha256')
    .update(await readFile(resolve(source, `${name}.ts`)))
    .digest('hex');
for (const name of ['engine', 'content', 'layout'])
  fingerprints[name] = createHash('sha256')
    .update(await readFile(resolve(root, `lib/games/diner/${name}.ts`)))
    .digest('hex');
fingerprints.simulator = createHash('sha256')
  .update(await readFile(fileURLToPath(import.meta.url)))
  .digest('hex');
const report = {
  method: {
    start,
    count,
    source: relative(root, source),
    audit: args.audit === 'true',
    HZ,
    workshopCost: c.UPGRADES.flatMap((u) => u.costs).reduce((a, n) => a + n, 0),
    fingerprints,
  },
  results,
  progression,
  probes,
};
if (args.out) {
  const path = resolve(evidence, args.out);
  if (relative(evidence, path).startsWith('..'))
    throw new Error('--out must be inside the balance evidence directory');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
}
