import test from 'node:test';
import assert from 'node:assert/strict';
import { spellCards, troopCards } from '../lib/games/arena/cards.ts';
import {
  MID,
  TICK,
  createMatch,
  deploy,
  step,
  summon,
} from '../lib/games/arena/engine.ts';

/** Still troops and sleeping towers make each ability's recipients clear. */
function scene() {
  const m = createMatch(7);
  m.phase = 'battle';
  m.time = 10;
  for (const p of m.players) p.elixir = 10;
  for (const t of m.towers) t.active = false;
  return m;
}

function ready(m, player, card, x, y) {
  const u = summon(m, player, card, x, y);
  u.state = 'walking';
  u.deployLeft = 0;
  u.pace = 0;
  u.stun = 99;
  return u;
}

function run(m, seconds) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += TICK) {
    m.events.length = 0;
    step(m);
    events.push(...m.events);
  }
  return events;
}

function meteor(m, x, y) {
  m.players[0].hand.cards[0] = 'meteor';
  const result = deploy(m, 0, 0, x, y);
  assert.ok(result.ok);
  const spell = m.spells.at(-1);
  spell.left = TICK;
  return spell;
}

await test('heal events identify only allied troops whose health actually rose', () => {
  const m = scene();
  const medic = ready(m, 0, 'medic', 9, 8);
  medic.stun = 0;
  medic.cooldown = 0;
  medic.hp -= 100;
  const injured = ready(m, 0, 'pirate', 9, 10);
  injured.hp -= 100;
  const clipped = ready(m, 0, 'archers', 11, 8);
  clipped.hp -= 5;
  const full = ready(m, 0, 'archers', 7, 8);
  const outside = ready(m, 0, 'archers', 4, 8);
  outside.hp -= 100;
  const enemy = ready(m, 1, 'ogre', 9, 6);
  enemy.hp -= 100;
  const dead = ready(m, 0, 'archers', 7, 10);
  dead.hp = 0;
  const hp = new Map(m.units.map((u) => [u.id, u.hp]));
  const towerHp = m.towers.map((t) => t.hp);
  const pulse = run(m, TICK).find((e) => e.type === 'heal');

  assert.ok(pulse);
  assert.equal(pulse.id, medic.id, 'the event still names the caster');
  assert.equal(pulse.x, 9);
  assert.equal(pulse.y, 8);
  assert.equal(pulse.radius, troopCards.medic.unit.heal.radius);
  assert.deepEqual(pulse.ids, [injured.id, clipped.id]);
  assert.equal(
    injured.hp,
    hp.get(injured.id) + troopCards.medic.unit.heal.amount,
  );
  assert.equal(clipped.hp, clipped.maxHp, 'health still caps at full');
  for (const u of [medic, full, outside, enemy, dead])
    assert.equal(u.hp, hp.get(u.id), `${u.card} is not healed`);
  assert.deepEqual(
    m.towers.map((t) => t.hp),
    towerHp,
    'towers are not healed',
  );
});

await test('a heal pulse with no injured recipient keeps the caster event and empty ids', () => {
  const m = scene();
  const medic = ready(m, 0, 'medic', 9, 8);
  medic.stun = 0;
  medic.cooldown = 0;
  ready(m, 0, 'pirate', 9, 10);
  const pulse = run(m, TICK).find((e) => e.type === 'heal');
  assert.ok(pulse, 'the flask still pulses');
  assert.equal(pulse.id, medic.id);
  assert.deepEqual(pulse.ids, [], 'no green recipient effect at full health');
});

await test('slaps and tackles report each victim position before and after the shove', () => {
  for (const card of ['sumo', 'linebacker']) {
    const m = scene();
    const source = ready(m, 0, card, 9, 10);
    source.stun = 0;
    const y = card === 'sumo' ? 11.4 : 11.2;
    const victim = ready(m, 1, 'pirate', 9, y);
    const events = run(m, troopCards[card].unit.firstHit + 2 * TICK);
    const push = events.find((e) => e.type === 'push' && e.id === victim.id);
    const ability =
      troopCards[card].unit.knockback ?? troopCards[card].unit.tackle;
    assert.ok(push, `${card} pushes the target`);
    assert.equal(push.from, source.id);
    assert.equal(push.fx, 9);
    assert.equal(push.fy, y);
    assert.equal(push.x, 9);
    assert.equal(push.y, push.fy + ability.distance);
    assert.equal(victim.hp, victim.maxHp - troopCards[card].unit.damage);
    if (card === 'linebacker')
      assert.ok(events.some((e) => e.type === 'stun' && e.id === victim.id));
  }
});

await test('water pushes identify every light ground recipient, excluding heavy, flying and deploying troops', () => {
  const m = scene();
  const firefighter = ready(m, 0, 'firefighter', 9, 10);
  firefighter.stun = 0;
  const front = ready(m, 1, 'pirate', 9, 12.2);
  const side = ready(m, 1, 'pirate', 10.3, 12.4);
  const heavy = ready(m, 1, 'ogre', 7.6, 12.4);
  const flyer = ready(m, 1, 'jetpack', 9, 12.6);
  const deploying = ready(m, 1, 'archers', 10.3, 10.8);
  deploying.state = 'deploying';
  deploying.deployLeft = 10;
  const behind = ready(m, 1, 'pirate', 9, 7.6);
  const events = run(m, troopCards.firefighter.unit.firstHit + 2 * TICK);
  const pushes = events.filter((e) => e.type === 'push');

  assert.deepEqual(
    pushes.map((e) => e.id).sort((a, b) => a - b),
    [front.id, side.id].sort((a, b) => a - b),
  );
  for (const push of pushes) {
    assert.equal(push.from, firefighter.id);
    assert.ok(push.y > push.fy, 'the water pushes down its cone');
    assert.ok(
      Math.abs(
        Math.hypot(push.x - push.fx, push.y - push.fy) -
          troopCards.firefighter.unit.cone.push,
      ) < 1e-9,
      'the reported push matches the actual water displacement',
    );
  }
  assert.ok(
    front.hp < front.maxHp && side.hp < side.maxHp && heavy.hp < heavy.maxHp,
  );
  assert.equal(flyer.hp, flyer.maxHp, 'water still cannot hit flyers');
  assert.equal(
    behind.hp,
    behind.maxHp,
    'water still cannot hit behind its cone',
  );
  assert.ok(events.some((e) => e.type === 'spray' && e.id === firefighter.id));
});

await test('Meteor pushes name the spell and exact origins while preserving damage and mass immunity', () => {
  const m = scene();
  const light = ready(m, 1, 'pirate', 8, 10);
  const flyer = ready(m, 1, 'jetpack', 11, 10);
  const heavy = ready(m, 1, 'ogre', 9, 12.5);
  const friend = ready(m, 0, 'pirate', 9, 8);
  const outside = ready(m, 1, 'pirate', 14, 10);
  const spell = meteor(m, 9, 10);
  const events = run(m, TICK);
  const pushes = events.filter((e) => e.type === 'push');

  assert.deepEqual(
    pushes.map((e) => e.id),
    [light.id, flyer.id],
  );
  assert.deepEqual(
    pushes.map((e) => [e.fx, e.fy]),
    [
      [8, 10],
      [11, 10],
    ],
  );
  for (const push of pushes) {
    assert.equal(push.from, spell.id, 'a Meteor has its own entity id');
    assert.ok(
      Math.abs(
        Math.hypot(push.x - push.fx, push.y - push.fy) -
          spellCards.meteor.spell.knockback,
      ) < 1e-9,
    );
  }
  for (const u of [light, flyer, heavy])
    assert.equal(
      u.hp,
      u.maxHp - spellCards.meteor.spell.damage,
      'damage is unchanged',
    );
  assert.equal(heavy.x, 9);
  assert.equal(heavy.y, 12.5, 'the Dino still resists the push');
  assert.equal(friend.hp, friend.maxHp, 'the Meteor still ignores allies');
  assert.equal(outside.hp, outside.maxHp, 'its reach is unchanged');
  assert.ok(events.some((e) => e.type === 'impact' && e.kind === 'meteor'));
});

await test('reported Meteor pushes stop at the bridge middle and omit a fully blocked shove', () => {
  for (const y of [15.95, MID - 0.001]) {
    const m = scene();
    const target = ready(m, 1, 'pirate', 3.5, y);
    meteor(m, 3.5, 15.3);
    const push = run(m, TICK).find(
      (e) => e.type === 'push' && e.id === target.id,
    );
    assert.equal(target.y, MID - 0.001, 'a ground troop stays on its bank');
    if (y < MID - 0.001) {
      assert.ok(push);
      assert.equal(push.fx, 3.5);
      assert.equal(push.fy, y);
      assert.equal(push.x, 3.5);
      assert.equal(
        push.y,
        MID - 0.001,
        'the effect ends at the clamped destination',
      );
    } else assert.equal(push, undefined, 'no displacement means no skid');
    assert.equal(target.hp, target.maxHp - spellCards.meteor.spell.damage);
  }
});
