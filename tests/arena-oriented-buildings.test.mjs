import test from 'node:test';
import assert from 'node:assert/strict';
import { troopCards } from '../lib/games/arena/cards.ts';
import {
  ARENA_MATCH_VERSION,
  TICK,
  canDeployAt,
  createMatch,
  dinoBuildingFootprint,
  dist,
  nearestLegal,
  projectTroopBuildings,
  step,
  summon,
  towerFootprint,
  towerGap,
  troopBuildingRadius,
  troopTowerGap,
  unitBodyDirection,
} from '../lib/games/arena/engine.ts';
import { checksum, snapshot } from '../lib/games/arena/net.ts';

const tower = (kind = 'king') => ({
  kind,
  x: 9,
  y: 16,
  side: 0,
  destroyed: false,
});
const gap = (t, x, y, h = [0, 1]) => troopTowerGap(t, 'ogre', x, y, h);
const clear = (m, u, h = unitBodyDirection(u), x = u.x, y = u.y) => {
  for (const t of m.towers)
    if (!t.destroyed)
      assert.ok(
        gap(t, x, y, h) >= -1e-7,
        `Dino overlaps ${t.kind}: ${gap(t, x, y, h)}`,
      );
};
function battle(side = 0, x = 6, y = 9) {
  const m = createMatch(73);
  m.phase = 'battle';
  m.time = 0;
  for (const t of m.towers) {
    t.damage = 0;
    t.active = false;
    t.hp = t.maxHp = 1e9;
  }
  const u = summon(m, side, 'ogre', x, y);
  u.deployLeft = 0;
  u.state = 'walking';
  return { m, u };
}

await test('Dino head and tail have oriented building clearance while lateral stance stays narrow', () => {
  for (const kind of ['king', 'princess']) {
    const t = tower(kind),
      h = towerFootprint[kind].half;
    assert.ok(Math.abs(gap(t, 9, 16 - h - 3.2)) < 1e-9);
    assert.ok(
      gap(t, 9, 16 - h - 3.1) < -0.09,
      'the measured off-axis bite has its margin',
    );
    assert.ok(Math.abs(gap(t, 9, 16 + h + 4.3)) < 1e-9);
    assert.ok(Math.abs(gap(t, 9 + h + 1.3, 16)) < 1e-9);
    assert.ok(
      gap(t, 9, 16 + h + 1.3) < -1,
      'legacy circle-only rear drop is illegal',
    );
    assert.ok(
      gap(t, 9, 16 - h - 3.2, [0, -1]) < 0,
      'rotating the tail towards the wall changes clearance',
    );
  }
  assert.equal(troopBuildingRadius('ogre'), 1.3);
  assert.equal(troopCards.ogre.unit.radius, 0.8);
});

await test('rotated hull agrees with independently sampled capsule clearance outside every tower face and corner', () => {
  let checked = 0;
  for (const kind of ['king', 'princess'])
    for (let a = 0; a < 16; a++) {
      const t = tower(kind),
        angle = (a * Math.PI) / 8,
        h = [Math.sin(angle), Math.cos(angle)];
      for (let x = 3; x <= 15; x += 1.5)
        for (let y = 10; y <= 22; y += 1.5) {
          let sampled = towerGap(t, x, y) - 1.3;
          for (let i = 0; i <= 256; i++) {
            const k =
              -dinoBuildingFootprint.rear +
              ((dinoBuildingFootprint.rear + dinoBuildingFootprint.front) * i) /
                256;
            sampled = Math.min(
              sampled,
              towerGap(t, x + h[0] * k, y + h[1] * k) -
                dinoBuildingFootprint.radius,
            );
          }
          const exact = gap(t, x, y, h);
          if (sampled > 0.025) {
            assert.ok(exact >= 0);
            assert.ok(Math.abs(exact - sampled) < 0.024);
          }
          if (sampled < -0.025) assert.ok(exact < 0);
          checked++;
        }
    }
  assert.ok(checked > 2000);
});

await test('legal drops and spawn recovery clear the long rear silhouette on both sides', () => {
  for (const side of [0, 1]) {
    const m = createMatch(73),
      t = m.towers.find((t) => t.kind === 'king' && t.side === side);
    const y = t.y + (side ? -1 : 1) * (towerFootprint.king.half + 1.3);
    assert.equal(canDeployAt(m, side, t.x, y, 'ogre'), false);
    const legal = nearestLegal(m, side, 'ogre', t.x, y);
    assert.ok(legal && canDeployAt(m, side, ...legal, 'ogre'));
    const u = summon(m, side, 'ogre', t.x, y);
    clear(m, u);
    assert.equal(u.px, u.x);
    assert.equal(u.py, u.y);
    const projected = projectTroopBuildings(m.towers, 'ogre', t.x, y, [
      0,
      side ? -1 : 1,
    ]);
    assert.deepEqual([u.x, u.y], projected);
  }
});

await test('version 6 snapshots acquire a deterministic heading and recover illegal old drops', () => {
  const { m, u } = battle();
  const t = m.towers.find((t) => t.kind === 'king' && t.side === 0);
  m.version = 6;
  delete u.bodyDirection;
  u.facing = 1;
  u.stun = 10;
  u.x = u.px = t.x;
  u.y = u.py = t.y + towerFootprint.king.half + 1.3;
  const copy = JSON.parse(JSON.stringify(m));
  step(m);
  step(copy);
  assert.equal(m.version, ARENA_MATCH_VERSION);
  assert.equal(
    u.facing,
    0,
    'a stopped restored figure draws its recovered side-facing hull',
  );
  assert.deepEqual(m.units[0].bodyDirection, copy.units[0].bodyDirection);
  clear(m, u);
  assert.equal(checksum(m), checksum(copy));
});

await test('a long shove stops the countertail at the near facade rather than tunnelling across the tower', () => {
  const { m } = battle();
  const t = m.towers.find((t) => t.kind === 'king' && t.side === 0);
  Object.assign(t, { x: 9, y: 6 });
  m.towers = [t];
  m.units = [];
  const attacker = summon(m, 1, 'sumo', 9, 14);
  const victim = summon(m, 0, 'ogre', 9, 13);
  Object.assign(attacker, { state: 'walking', deployLeft: 0 });
  Object.assign(victim, {
    state: 'walking',
    deployLeft: 0,
    stun: 100,
    hp: 5000,
    maxHp: 5000,
  });
  // A deliberately strong impulse exercises swept geometry; ordinary
  // Sumo cannot move this heavy Dino. Restore the card's actual balance.
  const knockback = troopCards.sumo.unit.knockback;
  const original = { ...knockback };
  Object.assign(knockback, { distance: 8, mass: 20 });
  try {
    let push;
    for (let i = 0; i < 30 && !push; i++) {
      m.events.length = 0;
      step(m);
      push = m.events.find((e) => e.type === 'push' && e.id === victim.id);
    }
    assert.ok(push);
    assert.ok(push.y >= t.y + towerFootprint.king.half + 4.3);
    assert.ok(
      push.fy - push.y < 1,
      'the eight-tile impulse is clipped at its first contact',
    );
    assert.equal(push.y, victim.y);
    for (let i = 0; i <= 16; i++)
      clear(
        m,
        victim,
        unitBodyDirection(victim),
        push.fx + ((push.x - push.fx) * i) / 16,
        push.fy + ((push.y - push.fy) * i) / 16,
      );
  } finally {
    Object.assign(knockback, original);
  }
});

await test('ordinary face, corner and side attacks stop outside the oriented hull at every speed', () => {
  for (const kind of ['king', 'princess'])
    for (const [nx, ny] of [
      [0, -1],
      [-Math.SQRT1_2, -Math.SQRT1_2],
      [-1, 0],
    ])
      for (const pace of [1, 1.35, 1.75]) {
        const { m } = battle();
        const t = m.towers.find((t) => t.kind === kind && t.side === 1);
        Object.assign(t, { x: 9, y: 26 });
        m.towers = [t];
        m.units = [];
        const u = summon(m, 0, 'ogre', 9 + nx * 8, 26 + ny * 8);
        Object.assign(u, { state: 'walking', deployLeft: 0, pace });
        for (let i = 0; i < 30 * 12 && t.hp === t.maxHp; i++) {
          step(m);
          clear(m, u);
        }
        assert.ok(t.hp < t.maxHp, `${kind} ${nx},${ny} at ${pace} lands a hit`);
        assert.ok(gap(t, u.x, u.y, unitBodyDirection(u)) > 0.15);
      }
});

await test('Dino turns and snapshot replay use arithmetic heading rather than trig drawing hints', () => {
  const { m, u } = battle(0, 12, 10),
    copy = snapshot(m);
  const saved = {
    sin: Math.sin,
    cos: Math.cos,
    hypot: Math.hypot,
    atan2: Math.atan2,
  };
  try {
    Math.sin =
      Math.cos =
      Math.hypot =
        () => {
          throw new Error('collision must not call trig/hypot');
        };
    for (let i = 0; i < 360; i++) {
      Math.atan2 = saved.atan2;
      step(m);
      Math.atan2 = (x, y) => saved.atan2(x, y) + 0.123;
      step(copy);
      assert.equal(checksum(m), checksum(copy));
    }
  } finally {
    Object.assign(Math, saved);
  }
  const changed = snapshot(m);
  changed.units[0].bodyDirection[0] += 0.001;
  assert.notEqual(checksum(changed), checksum(m));
  assert.ok(u.y >= 15, 'the Dino reaches its bridge');
});

await test('natural Dino routes and gradual turns stay clear between ticks without recovery jumps', () => {
  for (const side of [0, 1])
    for (const [x, y] of [
      [3.5, 3],
      [7, 6],
      [12, 9],
      [14.5, 3],
    ]) {
      const { m, u } = battle(side, x, side ? 32 - y : y);
      let reached = false,
        maxStep = 0;
      for (let i = 0; i < 30 * 40; i++) {
        const old = [u.x, u.y],
          heading = [...unitBodyDirection(u)];
        step(m);
        clear(m, u);
        maxStep = Math.max(maxStep, dist(u.x - old[0], u.y - old[1]));
        const after = unitBodyDirection(u);
        for (let j = 0; j <= 8; j++) {
          const k = j / 8,
            hx = heading[0] + (after[0] - heading[0]) * k,
            hy = heading[1] + (after[1] - heading[1]) * k,
            n = dist(hx, hy);
          clear(
            m,
            u,
            [hx / n, hy / n],
            old[0] + (u.x - old[0]) * k,
            old[1] + (u.y - old[1]) * k,
          );
        }
        assert.ok(
          heading[0] * after[0] + heading[1] * after[1] >= 0.995 - 1e-8,
          'bounded 0.1-radian turn',
        );
        if (side ? u.y <= 17 : u.y >= 15) {
          reached = true;
          break;
        }
      }
      assert.ok(
        maxStep <= troopCards.ogre.unit.speed * TICK + 1e-5,
        `ordinary route jumps ${maxStep}`,
      );
      assert.ok(reached, `side ${side} Dino from ${x},${y} reaches bridge`);
    }
});
