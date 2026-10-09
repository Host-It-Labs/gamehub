import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIELD_DELAY,
  SHIELD_RECHARGE,
  troopCards,
} from '../lib/games/arena/cards.ts';
import {
  ARENA_MATCH_VERSION,
  TICK,
  createMatch,
  step,
  summon,
  towerFootprint,
  troopTowerGap,
  upgradeMatch,
} from '../lib/games/arena/engine.ts';
import { checksum, replay, snapshot } from '../lib/games/arena/net.ts';

function battle(boosts) {
  const m = createMatch(137, 'medium', 'duel', { boosts });
  m.phase = 'battle';
  m.time = 0;
  for (const t of m.towers) {
    t.damage = 0;
    t.active = false;
  }
  return m;
}

function legacy(m) {
  m.version = 5;
  for (const u of m.units) {
    delete u.maxShield;
    delete u.shieldDelay;
    delete u.detour;
    delete u.bodyDirection;
  }
  return JSON.parse(JSON.stringify(m));
}

await test('a version 5 snapshot retains live HP and shield while restoring boosted capacities and body clearance', () => {
  const m = battle([{ levels: { gladiator: 3 }, troopHp: 1.1 }]);
  const g = summon(m, 0, 'gladiator', 9, 10);
  Object.assign(g, { hp: 381, maxHp: 686, shield: 123 });
  const p = summon(m, 1, 'pirate', 9, 23);
  const d = summon(m, 0, 'ogre', 9, 10);
  const t = m.towers.find((t) => t.kind === 'king' && t.side === 0);
  Object.assign(d, {
    x: t.x,
    px: t.x,
    y: t.y + towerFootprint.king.half + 1.3,
    py: t.y + towerFootprint.king.half + 1.3,
    facing: 1,
    stun: 10,
  });
  const old = legacy(m);
  const pools = old.units.map(({ hp, maxHp, shield }) => [hp, maxHp, shield]);
  upgradeMatch(old);
  assert.equal(old.version, ARENA_MATCH_VERSION);
  assert.deepEqual(
    old.units.map(({ hp, maxHp, shield }) => [hp, maxHp, shield]),
    pools,
    'migration does not apply the new base HP to a living legacy troop',
  );
  const [gladiator, pirate, dino] = old.units;
  assert.equal(
    gladiator.maxShield,
    Math.round(troopCards.gladiator.unit.shield * 1.2 * 1.1),
  );
  assert.equal(gladiator.shieldDelay, SHIELD_DELAY);
  assert.equal(pirate.id, p.id);
  assert.equal(pirate.maxShield, 0);
  assert.equal(pirate.shieldDelay, 0);
  assert.ok(old.units.every((u) => u.detour === null));
  assert.deepEqual(dino.bodyDirection, [0, 1]);
  assert.equal(dino.facing, 0);
  assert.equal(dino.px, dino.x);
  assert.equal(dino.py, dino.y);
  for (const tower of old.towers)
    assert.ok(
      troopTowerGap(tower, 'ogre', dino.x, dino.y, dino.bodyDirection) >= -1e-7,
    );
  const once = structuredClone(old);
  upgradeMatch(old);
  assert.deepEqual(old, once, 'migration is idempotent');
});

await test('legacy spent shields wait four quiet seconds and no remaining old shield is discarded', () => {
  for (const remaining of [0, 75, 750]) {
    const m = battle();
    const g = summon(m, 0, 'gladiator', 9, 10);
    Object.assign(g, {
      hp: 280,
      maxHp: 520,
      shield: remaining,
      state: 'walking',
      deployLeft: 0,
      stun: 100,
    });
    const old = legacy(m);
    for (let i = 0; i < SHIELD_DELAY / TICK; i++) step(old);
    const u = old.units[0];
    assert.ok(Math.abs(u.shield - remaining) < 1e-8);
    assert.equal(
      u.maxShield,
      Math.max(remaining, troopCards.gladiator.unit.shield),
    );
    assert.equal(u.hp, 280);
    assert.equal(u.maxHp, 520);
    step(old);
    assert.ok(
      Math.abs(
        u.shield -
          Math.min(
            u.maxShield,
            remaining + (u.maxShield / SHIELD_RECHARGE) * TICK,
          ),
      ) < 1e-8,
    );
    assert.ok(Number.isFinite(checksum(old)));
  }
});

await test('legacy shield recovery is generic and keeps recorded recharge state and routes', () => {
  const stats = troopCards.archers.unit;
  stats.shield = 100;
  try {
    const m = battle([{ levels: { archers: 3 }, troopHp: 1.1 }]);
    summon(m, 0, 'archers', 9, 10).shield = 13;
    const old = legacy(m);
    upgradeMatch(old);
    assert.equal(old.units[0].maxShield, 132);
    assert.equal(old.units[0].shield, 13);
    assert.equal(old.units[0].shieldDelay, SHIELD_DELAY);
    const v6 = snapshot(old);
    v6.version = 6;
    Object.assign(v6.units[0], {
      maxShield: 147,
      shieldDelay: 1.725,
      detour: { x: 7, y: 11, target: 4 },
    });
    const live = structuredClone(v6.units[0]);
    upgradeMatch(v6);
    assert.deepEqual(v6.units[0], live);
  } finally {
    delete stats.shield;
  }
});

await test('zero-tick replay upgrades version 5 snapshots deterministically, including finished battles', () => {
  for (const phase of ['battle', 'over']) {
    const m = battle();
    summon(m, 0, 'gladiator', 9, 10).shield = 42;
    const a = legacy(m);
    a.phase = phase;
    const b = JSON.parse(JSON.stringify(a));
    upgradeMatch(a);
    replay(b, b.tick, new Map());
    assert.deepEqual(b, a);
    assert.equal(checksum(b), checksum(a));
    const restored = JSON.parse(JSON.stringify(snapshot(b)));
    assert.equal(checksum(restored), checksum(b));
    for (let i = 0; i < 60; i++) {
      step(a);
      step(restored);
      assert.equal(checksum(a), checksum(restored));
    }
  }
});
