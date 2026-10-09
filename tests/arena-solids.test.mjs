import test from 'node:test';
import assert from 'node:assert/strict';
import { troopCards, troopDeck } from '../lib/games/arena/cards.ts';
import {
  createMatch,
  isGroundProjectile,
  plainShot,
  step,
  summon,
  towerFootprint,
  towerGap,
  troopBuildingRadius,
} from '../lib/games/arena/engine.ts';
import { checksum, snapshot } from '../lib/games/arena/net.ts';

function scene(kind = 'princess', side = 0) {
  const m = createMatch(43);
  m.phase = 'battle';
  m.time = 0;
  const tower = m.towers.find((t) => t.kind === kind && t.side === side);
  tower.x = 9;
  tower.y = side === 0 ? 9 : 23;
  tower.active = false;
  tower.damage = 0;
  tower.hp = tower.maxHp = 1e9;
  m.towers = [tower];
  return { m, tower };
}

function ready(m, player, card, x, y, still = false) {
  const u = summon(m, player, card, x, y);
  u.state = 'walking';
  u.deployLeft = 0;
  if (still) u.stun = 100;
  return u;
}

function assertClear(m, u) {
  if (troopCards[u.card].unit.flying) return;
  const radius = troopBuildingRadius(u.card);
  for (const t of m.towers) {
    if (t.destroyed) continue;
    for (let i = 0; i <= 4; i++) {
      const k = i / 4;
      const x = u.px + (u.x - u.px) * k;
      const y = u.py + (u.y - u.py) * k;
      assert.ok(
        towerGap(t, x, y) >= radius - 1e-6,
        `${u.card} overlaps ${t.kind} at ${x},${y}`,
      );
    }
  }
}

await test('standing towers eject even a centre spawn and preserve full body clearance', () => {
  for (const kind of ['king', 'princess']) {
    for (const card of troopDeck.filter((id) => !troopCards[id].unit.flying)) {
      const { m, tower } = scene(kind);
      const u = summon(m, 0, card, tower.x, tower.y);
      assertClear(m, u);
      assert.equal(u.x, u.px);
      assert.equal(u.y, u.py);
      step(m);
      assertClear(m, u);
    }
  }
});

await test('overlapping castle clearances recover a spawn or restored position in one tick', () => {
  for (const side of [0, 1])
    for (const x of [4.9, 13.1])
      for (const card of ['ogre', 'sumo', 'duelist', 'mage', 'archers']) {
        const m = createMatch(43);
        m.phase = 'battle';
        m.time = 0;
        const y = side === 0 ? 5.3 : 26.7;
        const u = summon(m, side, card, x, y);
        assertClear(m, u);
        // Old snapshots or a lab setup can also inject an unsafe position.
        u.x = u.px = x;
        u.y = u.py = y;
        step(m);
        assertClear(m, u);
      }
});

await test('every ground body walks around an allied tower and keeps interpolation outside it', () => {
  for (const card of troopDeck.filter((id) => !troopCards[id].unit.flying)) {
    const { m, tower } = scene('princess');
    const goal = { ...tower, id: m.nextId++, side: 1, y: 26, lane: 0 };
    m.towers.push(goal);
    const u = ready(m, 0, card, tower.x, 5);
    for (let i = 0; i < 30 * 35 && u.y < 14; i++) {
      step(m);
      assertClear(m, u);
      m.events.length = 0;
    }
    assert.ok(u.y >= 14, `${card} gets past its own building`);
  }
});

await test('ground melee reaches tower corners without entering their solid footprint', () => {
  for (const kind of ['king', 'princess']) {
    for (const card of [
      'gladiator',
      'duelist',
      'ogre',
      'sumo',
      'pirate',
      'viking',
    ]) {
      const { m, tower } = scene(kind, 1);
      const outside =
        towerFootprint[kind].half + troopBuildingRadius(card) + 0.8;
      const u = ready(m, 0, card, tower.x - outside, tower.y - outside);
      for (let i = 0; i < 30 * 10 && tower.hp === tower.maxHp; i++) {
        step(m);
        assertClear(m, u);
      }
      assert.ok(tower.hp < tower.maxHp, `${card} strikes the ${kind}'s corner`);
    }
  }
});

await test('a ranged troop circles into firing line instead of shooting through an allied tower', () => {
  const { m, tower } = scene('princess');
  const u = ready(m, 0, 'archers', tower.x, 6.2);
  // The long Dino hull no longer fits this narrow behind-tower fixture.
  const target = ready(m, 1, 'pirate', tower.x, 12, true);
  target.hp = target.maxHp = 1e9;
  step(m);
  assert.ok(
    !m.events.some(
      (e) =>
        e.type === 'shot' &&
        m.projectiles.some((p) => p.id === e.id && p.sourceId === u.id),
    ),
  );
  for (let i = 0; i < 30 * 20 && target.hp === target.maxHp; i++) {
    step(m);
    assertClear(m, u);
  }
  assert.ok(
    target.hp < target.maxHp,
    'it eventually finds an unobstructed firing line',
  );
  assert.equal(tower.hp, tower.maxHp, 'the allied tower is not damaged');
});

await test('even a long shove stops at the near wall and reports its final contact position', () => {
  const stats = troopCards.sumo.unit.knockback;
  const old = stats.distance;
  stats.distance = 8;
  try {
    const { m, tower } = scene('king');
    ready(m, 1, 'sumo', 9, 13.7);
    const victim = ready(m, 0, 'pirate', 9, 12.4, true);
    victim.hp = victim.maxHp = 5000;
    let push;
    for (let i = 0; i < 30 && !push; i++) {
      m.events.length = 0;
      step(m);
      push = m.events.find((e) => e.type === 'push' && e.id === victim.id);
    }
    assert.ok(push);
    assert.ok(
      push.y > tower.y,
      'it stays on the near side instead of tunnelling through',
    );
    assert.ok(
      towerGap(tower, push.x, push.y) >= troopBuildingRadius(victim.card),
    );
    assert.equal(push.y, victim.y);
    assertClear(m, victim);
    tower.destroyed = true;
    for (let i = 0; i < 30 * 3 && victim.y > tower.y; i++) step(m);
    assert.ok(
      victim.y < tower.y,
      'a ruined building no longer blocks the shove',
    );
  } finally {
    stats.distance = old;
  }
});

function shot(m, target, side, kind = 'laser', sz = 1) {
  m.projectiles.push({
    ...plainShot,
    id: m.nextId++,
    sourceId: -1,
    targetId: target.id,
    side,
    kind,
    sz,
    x: 9,
    y: 13,
    sx: 9,
    sy: 13,
    tx: target.x,
    ty: target.y,
    speed: 60,
    damage: 100,
    splash: 0,
    air: true,
    travelled: 0,
    distance: 0,
  });
}

await test('ground shots hit the first solid wall, including one exposed by a moving target', () => {
  for (const side of [0, 1]) {
    const { m, tower } = scene('king');
    const target = ready(m, side ? 0 : 1, 'ogre', 9, 5, true);
    const hp = target.hp;
    shot(m, target, side);
    for (let i = 0; i < 5 && m.projectiles.length; i++) step(m);
    assert.equal(m.projectiles.length, 0);
    assert.equal(target.hp, hp, 'the protected troop is not hit');
    assert.equal(tower.hp, tower.maxHp - (side === tower.side ? 0 : 100));
    const impact = m.events.find((e) => e.type === 'impact');
    assert.ok(impact);
    assert.ok(Math.abs(towerGap(tower, impact.x, impact.y)) < 1e-8);
  }
});

await test('lobbed shells, flying bombs and elevated tower shots can clear a building', () => {
  for (const [kind, sz] of [
    ['shell', 1],
    ['bomb', 2.2],
    ['laser', 5],
  ]) {
    const { m, tower } = scene('king');
    const target = ready(m, 1, 'ogre', 9, 5, true);
    const hp = target.hp;
    shot(m, target, 0, kind, sz);
    for (let i = 0; i < 10 && m.projectiles.length; i++) step(m);
    assert.equal(target.hp, hp - 100, kind);
    assert.equal(tower.hp, tower.maxHp, kind);
  }
});

await test('shot elevation and kind affect both facade collision and the online checksum', () => {
  const { m, tower } = scene('princess');
  const target = ready(m, 0, 'pirate', 9, 5, true);
  shot(m, target, 1, 'laser', 0.8);
  const p = m.projectiles[0];
  p.y = p.sy = tower.y + towerFootprint.princess.half + 0.2;
  const elevated = snapshot(m);
  elevated.projectiles[0].sz = 3.6;
  const lobbed = ['shell', 'bomb', 'drop'].map((kind) => {
    const copy = snapshot(m);
    copy.projectiles[0].kind = kind;
    assert.notEqual(checksum(copy), checksum(m), kind);
    assert.equal(isGroundProjectile(copy.projectiles[0]), false);
    return copy;
  });
  assert.notEqual(checksum(elevated), checksum(m));
  assert.equal(isGroundProjectile(p), true);
  assert.equal(isGroundProjectile(elevated.projectiles[0]), false);
  for (const copy of [m, elevated, ...lobbed]) step(copy);
  assert.equal(tower.hp, tower.maxHp - p.damage);
  assert.equal(m.projectiles.length, 0);
  for (const copy of [elevated, ...lobbed]) {
    assert.equal(copy.towers[0].hp, tower.maxHp);
    assert.equal(copy.projectiles.length, 1);
  }
});

await test('low shots restored inside friendly stone are absorbed immediately in version 5 and 6 snapshots', () => {
  for (const version of [5, 6]) {
    const { m, tower } = scene('princess');
    const target = ready(m, 1, 'pirate', 9, 5, true);
    const hp = target.hp;
    shot(m, target, 0, 'laser', 0.8);
    Object.assign(m.projectiles[0], {
      x: tower.x,
      y: tower.y,
      sx: tower.x,
      sy: tower.y,
    });
    m.version = version;
    if (version === 5)
      for (const u of m.units) {
        delete u.maxShield;
        delete u.shieldDelay;
        delete u.detour;
      }
    const elevated = snapshot(m);
    elevated.projectiles[0].sz = 3.6;
    step(m);
    assert.equal(m.projectiles.length, 0);
    assert.equal(target.hp, hp);
    assert.equal(
      tower.hp,
      tower.maxHp,
      'friendly buildings absorb without taking damage',
    );
    const impact = m.events.find((event) => event.type === 'impact');
    assert.ok(impact);
    assert.deepEqual([impact.x, impact.y], [tower.x, tower.y]);
    step(elevated);
    assert.equal(
      elevated.projectiles.length,
      1,
      'an elevated shot can leave the keep',
    );
    for (let i = 0; i < 3; i++) step(m);
    assert.equal(
      target.hp,
      hp,
      'the recovered low shot never reaches the protected target',
    );
  }
});

await test('building routing and rechargeable shields replay identically from a snapshot', () => {
  const { m, tower } = scene('princess');
  const u = ready(m, 0, 'gladiator', tower.x, 6.2);
  const enemy = ready(m, 1, 'gladiator', tower.x, 11.6, true);
  u.shield = 0;
  u.shieldDelay = 1;
  const copy = snapshot(m);
  for (let i = 0; i < 30 * 20; i++) {
    step(m);
    step(copy);
    assert.equal(checksum(m), checksum(copy));
  }
  assert.ok(enemy.hp < enemy.maxHp || enemy.shield < enemy.maxShield);
});
