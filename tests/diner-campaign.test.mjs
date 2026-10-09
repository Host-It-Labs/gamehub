import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableGear,
  BASE_LIVES,
  buyGear,
  buyUpgrade,
  canBuyUpgrade,
  checkpointRun,
  createProfile,
  driveTo,
  effectsFor,
  endRun,
  gearPrice,
  isCampaignProfile,
  isCampaignRun,
  keepDriving,
  leaveStop,
  makeOffers,
  motelRest,
  motelTune,
  patchPrice,
  patchUp,
  pickGear,
  rerollOffers,
  runActive,
  runChoices,
  runMap,
  runNode,
  settleShift,
  shiftConfig,
  startRun,
  UPGRADES,
} from '../lib/games/diner/campaign.ts';
import { HZ, isMatch, open, step } from '../lib/games/diner/engine.ts';
import {
  choicesFrom,
  LEG_SHAPE,
  makeRoad,
  ROAD_LEGS,
} from '../lib/games/diner/road.ts';
import { playShift } from '../lib/games/diner/bot.ts';

/** A finished shift, as the screen would hand it back. */
function finish(run, { stars, coins = 120, medals = 2 } = {}) {
  const m = structuredClone(run.savedMatch);
  m.tick = m.config.seconds * HZ;
  m.phase = 'over';
  m.stars = stars ?? m.stars;
  m.coins = coins;
  m.medals = medals;
  return m;
}

await test('the road: three legs of four two-way forks and a boss, every stop reachable', () => {
  for (const seed of [1, 7, 99, 12345]) {
    const map = makeRoad(seed);
    assert.equal(map.legs.length, ROAD_LEGS);
    for (const leg of map.legs) {
      for (let col = 0; col < LEG_SHAPE.length; col++)
        assert.equal(
          leg.nodes.filter((n) => n.col === col).length,
          LEG_SHAPE[col],
        );
      const boss = leg.nodes.filter((n) => n.kind === 'boss');
      assert.equal(boss.length, 1);
      assert.equal(boss[0].col, LEG_SHAPE.length - 1);
      assert.ok(
        leg.nodes.some((n) => n.kind === 'garage' || n.kind === 'motel'),
        'a quiet stop every leg',
      );
      // Every fork leads on, and every later stop has a way in.
      for (const n of leg.nodes) {
        if (n.col < LEG_SHAPE.length - 1) assert.ok(n.next.length >= 1);
        if (n.col > 0)
          assert.ok(
            leg.nodes.some((p) => p.next.includes(n.id)),
            `${n.id} has a way in`,
          );
        if (n.kind === 'shift' || n.kind === 'boss')
          assert.ok(n.reward && n.busy >= 1);
        else assert.equal(n.reward, null);
      }
    }
    assert.equal(choicesFrom(map, null).length, 2);
    assert.ok(
      choicesFrom(map, null).every((n) => n.gas === 0),
      'the first drive is free',
    );
    assert.deepEqual(makeRoad(seed), map, 'deterministic');
  }
});

await test('a run starts with the Workshop’s lives and coins, and keeps them through the night', () => {
  const plain = startRun(createProfile(), 5).run;
  assert.equal(plain.lives, BASE_LIVES);
  assert.equal(plain.wallet, 0);
  const upgraded = startRun(
    {
      ...createProfile(),
      upgrades: { 'spare-tire': 2, 'gas-can': 1, 'chrome-tray': 1 },
    },
    5,
  ).run;
  assert.equal(upgraded.maxLives, BASE_LIVES + 2);
  assert.equal(upgraded.wallet, 25);
  assert.equal(effectsFor(upgraded).hands, 3);
  // Drive to the first stop: free gas, a shift that brings the run's lives.
  let run = driveTo(plain, runChoices(plain)[0].id);
  assert.equal(run.status, 'shift');
  assert.ok(isMatch(run.savedMatch));
  assert.equal(run.savedMatch.stars, BASE_LIVES);
  assert.ok(isCampaignRun(run));
  // A shift that loses a life gives the run one life fewer.
  const m = finish(run, { stars: BASE_LIVES - 1, coins: 140 });
  const settled = settleShift(createProfile(), run, m);
  run = settled.run;
  assert.equal(run.lives, BASE_LIVES - 1);
  assert.ok(run.wallet >= 140);
  assert.ok(settled.profile.tokens > 0);
  assert.equal(run.lastResult.lost, 1);
  // Banking happens once.
  assert.deepEqual(settleShift(settled.profile, run, m), settled);
});

await test('gas: paid on the way; an empty wallet costs a life instead', () => {
  let { run } = startRun(createProfile(), 21);
  run = driveTo(run, runChoices(run)[0].id);
  run = settleShift(
    createProfile(),
    run,
    finish(run, { coins: 0, medals: 0 }),
  ).run;
  while (run.status === 'reward') run = pickGear(run, run.offers[0]);
  const next = runChoices(run)[0];
  assert.ok(next.gas > 0);
  const broke = { ...run, wallet: 0 };
  const pushed = driveTo(broke, next.id);
  assert.equal(pushed.lives, run.lives - 1);
  assert.equal(pushed.wallet, 0);
  const rich = { ...run, wallet: 500 };
  const paid = driveTo(rich, next.id);
  assert.equal(paid.wallet, 500 - next.gas);
  assert.equal(paid.lives, run.lives);
  // Pushing the car with the last life ends the run.
  assert.equal(driveTo({ ...broke, lives: 1 }, next.id).status, 'over');
});

await test('difficulty climbs every stop, and each leg adds dishes, booths and trouble', () => {
  const { run } = startRun(createProfile(), 3);
  const map = runMap(run);
  const configs = map.legs.flatMap((leg) =>
    leg.nodes
      .filter((n) => n.kind === 'shift' || n.kind === 'boss')
      .map((n) => [n, shiftConfig(run, n)]),
  );
  const at = (leg, col) =>
    configs.filter(([n]) => n.leg === leg && n.col === col).map(([, c]) => c);
  const first = at(0, 0)[0],
    last = at(2, 3)[0] ?? at(2, 4)[0];
  assert.ok(
    last.spec.interval[0] < first.spec.interval[0] * 0.75,
    'guests come faster',
  );
  assert.ok(
    last.spec.patience.queue < first.spec.patience.queue,
    'and wait less',
  );
  assert.ok(
    last.spec.tables.length > first.spec.tables.length,
    'booths are added',
  );
  assert.deepEqual(first.spec.stations, ['grill', 'shake']);
  assert.ok(at(1, 0)[0].spec.stations.includes('pie'));
  assert.equal(first.spec.mimics, 0, 'no mimics on the first leg');
  assert.ok(
    at(1, 1).every((c) => c.spec.mimics > 0),
    'mimics from the second leg',
  );
  for (const [n, c] of configs) {
    assert.equal(c.place, n.place);
    assert.ok(
      c.spec.targets[0] < c.spec.targets[1] &&
        c.spec.targets[1] < c.spec.targets[2],
    );
    if (n.boss)
      assert.ok(c.seconds > (n.leg === 0 ? 100 : n.leg === 1 ? 110 : 120));
  }
  // Places differ: the drive-in rushes, the harbour spills, the Moon Mile browns out.
  for (const [n, c] of configs) {
    if (n.boss) continue;
    if (n.place === 'drivein') assert.ok(c.mechanics.rush);
    if (n.place === 'harbour') assert.ok(c.mechanics.spills);
    if (n.place === 'moonmile')
      assert.ok(c.mechanics.power && c.mechanics.jams);
  }
});

await test('rewards: equipment picks, cash pays more, a life heals, losing every life ends it', () => {
  const profile = createProfile();
  const base = startRun(profile, 11).run;
  const stop = runChoices(base)[0];
  const at = (reward) => {
    const run = driveTo(base, stop.id);
    const node = runNode(run);
    node.reward = reward; // the map is shared; restored below
    return run;
  };
  const original = stop.reward;
  try {
    let run = at('gear');
    let out = settleShift(profile, run, finish(run));
    assert.equal(out.run.status, 'reward');
    assert.equal(out.run.offers.length, 3);
    const pick = out.run.offers[0];
    const picked = pickGear(out.run, pick);
    assert.equal(picked.status, 'route');
    assert.ok(picked.gear.includes(pick) || pick === 'second-wind');
    run = at('cash');
    out = settleShift(profile, run, finish(run, { coins: 100 }));
    assert.equal(out.run.wallet, run.wallet + 150);
    run = at('life');
    const hurt = {
      ...run,
      lives: 2,
      savedMatch: { ...run.savedMatch, stars: 2 },
    };
    out = settleShift(profile, hurt, finish(hurt, { stars: 2 }));
    assert.equal(out.run.lives, 3);
    run = at('gear');
    out = settleShift(profile, run, finish(run, { stars: 0 }));
    assert.equal(out.run.status, 'over');
    assert.equal(runActive(out.run), false);
  } finally {
    stop.reward = original;
  }
});

await test('equipment offers never repeat what the run owns or the Workshop gives', () => {
  const { run } = startRun(
    { ...createProfile(), upgrades: { 'roller-skates': 1, 'chrome-tray': 1 } },
    4,
  );
  const owned = { ...run, gear: ['turbo-grill', 'tip-jar'] };
  const gear = availableGear(owned, 2).map((g) => g.id);
  for (const id of ['turbo-grill', 'tip-jar', 'roller-skates', 'chrome-tray'])
    assert.ok(!gear.includes(id), id);
  assert.ok(
    !availableGear(owned, 0).some((g) => g.leg > 0),
    'later troubles wait for their leg',
  );
  for (let salt = 0; salt < 20; salt++) {
    const offers = makeOffers(owned, 'normal', salt);
    assert.equal(new Set(offers).size, offers.length);
    assert.ok(offers.every((id) => gear.includes(id)));
  }
  const rare = makeOffers({ ...run, gear: [] }, 'rare', 0).map((id) => id);
  assert.ok(rare.length === 3);
  // Lucky dice reroll once per leg.
  const lucky = {
    ...run,
    status: 'reward',
    offers: makeOffers(run, 'normal', 0),
    rerolls: 1,
  };
  const rolled = rerollOffers(lucky);
  assert.equal(rolled.rerolls, 0);
  assert.deepEqual(rerollOffers(rolled), rolled);
});

await test('the Garage sells equipment and repairs; the Motel heals or tunes', () => {
  // Find a seed whose first leg has a Garage in reach.
  let run = null;
  for (let seed = 1; seed < 200 && !run; seed++) {
    let r = startRun(createProfile(), seed).run;
    for (let i = 0; i < 4 && r.status !== 'garage'; i++) {
      const garage = runChoices(r).find((n) => n.kind === 'garage');
      if (garage) {
        r = driveTo({ ...r, wallet: 1000 }, garage.id);
        break;
      }
      r = driveTo(r, runChoices(r).find((n) => n.kind === 'shift').id);
      r = settleShift(createProfile(), r, finish(r)).run;
      while (r.status === 'reward') r = pickGear(r, r.offers[0]);
    }
    if (r.status === 'garage') run = r;
  }
  assert.ok(run, 'a garage within reach');
  const id = run.offers[0];
  const price = gearPrice(run, id);
  const bought = buyGear(run, id);
  assert.equal(bought.wallet, run.wallet - price);
  assert.deepEqual(buyGear(bought, id), bought, 'sold once');
  const hurt = { ...bought, lives: 1 };
  const patched = patchUp(hurt);
  assert.equal(patched.lives, 2);
  assert.equal(patched.wallet, hurt.wallet - patchPrice(hurt));
  assert.deepEqual(patchUp(patched), patched, 'one patch per stop');
  assert.equal(leaveStop(patched).status, 'route');
  const motel = { ...patched, status: 'motel', offers: [], sold: [] };
  assert.equal(motelRest(motel).lives, Math.min(motel.maxLives, 4));
  const tuned = motelTune(motel);
  assert.equal(tuned.status, 'reward');
  assert.equal(tuned.offers.length, 3);
});

await test('beating the third boss: keep driving into overtime, or finish', () => {
  const { run } = startRun(createProfile(), 8);
  const map = runMap(run);
  const boss = map.legs[2].nodes.find((n) => n.kind === 'boss');
  const before = map.legs[2].nodes.find((n) => n.col === 3);
  let at = { ...run, at: before.id, visited: [before.id] };
  at = driveTo(at, boss.id);
  assert.equal(at.status, 'shift');
  const out = settleShift(createProfile(), at, finish(at));
  let after = out.run;
  while (after.status === 'reward') after = pickGear(after, after.offers[0]);
  assert.equal(after.status, 'cleared');
  assert.equal(out.profile.nights, 1);
  const more = keepDriving(after);
  assert.equal(more.legs, ROAD_LEGS + 1);
  assert.equal(runChoices(more)[0].leg, ROAD_LEGS);
  assert.equal(endRun(after).status, 'over');
  // The overtime boss also ends its leg and offers another.
  const overMap = runMap(more);
  const overBoss = overMap.legs[ROAD_LEGS].nodes.find((n) => n.kind === 'boss');
  const overBefore = overMap.legs[ROAD_LEGS].nodes.find((n) => n.col === 3);
  let o = driveTo(
    {
      ...more,
      at: overBefore.id,
      visited: [...more.visited, overBefore.id],
      wallet: 999,
    },
    overBoss.id,
  );
  const overOut = settleShift(out.profile, o, finish(o));
  o = overOut.run;
  while (o.status === 'reward') o = pickGear(o, o.offers[0]);
  assert.equal(o.status, 'cleared');
  assert.equal(
    overOut.profile.nights,
    out.profile.nights,
    'only the first night counts as a night',
  );
  assert.equal(keepDriving(o).legs, ROAD_LEGS + 2);
});

await test('the Workshop needs enough tokens for each rank', () => {
  let profile = { ...createProfile(), tokens: 30 };
  assert.ok(canBuyUpgrade(profile, 'gas-can'));
  assert.ok(!canBuyUpgrade(profile, 'chrome-tray'));
  profile = buyUpgrade(profile, 'gas-can');
  assert.equal(profile.tokens, 5);
  assert.equal(profile.upgrades['gas-can'], 1);
  assert.deepEqual(
    buyUpgrade(profile, 'gas-can'),
    profile,
    'too poor for rank 2',
  );
  assert.ok(isCampaignProfile(profile));
  for (const u of UPGRADES) assert.equal(u.costs.length, u.max);
});

await test('a checkpoint keeps the whole simulation; stale or foreign matches are refused', () => {
  let { run } = startRun(createProfile(), 13);
  run = driveTo(run, runChoices(run)[0].id);
  const m = structuredClone(run.savedMatch);
  open(m);
  for (let i = 0; i < 5 * HZ; i++) step(m, []);
  const saved = checkpointRun(run, m);
  assert.equal(saved.savedMatch.tick, m.tick);
  assert.ok(isCampaignRun(saved));
  const older = structuredClone(run.savedMatch);
  assert.deepEqual(checkpointRun(saved, older), saved, 'never rolled back');
  const foreign = structuredClone(m);
  foreign.config.runId = 'someone-else';
  assert.deepEqual(checkpointRun(saved, foreign), saved);
});

await test('the ramp: a slow, careful bot with no upgrades runs out of lives before the end of the night', () => {
  let profile = createProfile();
  let { run } = startRun(profile, 77);
  for (
    let guard = 0;
    guard < 40 && run.status !== 'over' && run.status !== 'cleared';
    guard++
  ) {
    if (run.status === 'route')
      run = driveTo(
        run,
        runChoices(run).find((n) => n.kind !== 'garage')?.id ??
          runChoices(run)[0].id,
      );
    else if (run.status === 'shift') {
      const m = run.savedMatch;
      open(m);
      playShift(m, true, 36);
      ({ profile, run } = settleShift(profile, run, m));
    } else if (run.status === 'reward') run = pickGear(run, run.offers[0]);
    else if (run.status === 'garage') run = leaveStop(run);
    else if (run.status === 'motel') run = motelRest(run);
  }
  assert.equal(run.status, 'over');
  assert.ok(
    run.visited.length >= 2 && run.visited.length <= 11,
    `stopped at ${run.visited.length}`,
  );
  assert.ok(profile.tokens > 0);
});
