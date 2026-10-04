import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allCards,
  cards,
  playable,
  troopCards,
} from '../lib/games/arena/cards.ts';
import {
  ABILITY_FIELDS,
  BASE_FIELDS,
  cardFacts,
} from '../lib/games/arena/card-facts.ts';
import { createMatch, deploy, summon } from '../lib/games/arena/engine.ts';

const stat = (f, key) => f.stats.find((s) => s.key === key)?.value;
const every = [...allCards, ...Object.keys(troopCards)];

await test('every card has a panel with clean numbers', () => {
  for (const id of new Set(every)) {
    const f = cardFacts(id);
    assert.equal(f.name, cards[id].name);
    assert.equal(f.cost, cards[id].cost);
    assert.equal(f.level, 1);
    assert.ok(f.roles.length > 0, `${id} has a role`);
    for (const s of f.stats)
      assert.ok(
        s.value && !/NaN|undefined|Infinity/.test(s.value),
        `${id} ${s.key}: ${s.value}`,
      );
    for (const a of f.abilities)
      assert.ok(
        a.text.length > 8 && !/NaN|undefined|Infinity|\[object/.test(a.text),
        `${id} ${a.key}: ${a.text}`,
      );
  }
});

await test('every ability field of every troop has its own line', () => {
  const known = new Set([...BASE_FIELDS, ...ABILITY_FIELDS]);
  for (const [id, card] of Object.entries(troopCards)) {
    const f = cardFacts(id);
    for (const [field, value] of Object.entries(card.unit)) {
      assert.ok(known.has(field), `${id}.${field} needs a line in card-facts`);
      if (BASE_FIELDS.includes(field) || value === undefined) continue;
      assert.ok(
        f.abilities.some((a) => a.key === field),
        `${id} shows ${field}`,
      );
    }
  }
});

await test('troop stats are the card numbers', () => {
  for (const [id, card] of Object.entries(troopCards)) {
    const s = card.unit;
    const f = cardFacts(id);
    assert.equal(stat(f, 'hp'), String(s.hp));
    assert.equal(f.count, card.formation.length);
    assert.equal(f.flying, s.flying);
    assert.equal(stat(f, 'speed'), String(s.speed));
    if (s.damage > 0) {
      assert.equal(stat(f, 'damage'), String(s.damage));
      assert.equal(stat(f, 'dps'), String(Math.round(s.damage / s.hitSpeed)));
      assert.equal(stat(f, 'hitSpeed'), `${s.hitSpeed} s`);
      assert.equal(
        stat(f, 'range'),
        s.range > s.radius + 0.4 ? String(s.range) : 'Melee',
      );
      assert.equal(stat(f, 'splash'), s.splash ? String(s.splash) : undefined);
    } else {
      assert.equal(stat(f, 'damage'), undefined, `${id} never attacks`);
    }
  }
  const cadets = cardFacts('archers');
  assert.equal(stat(cadets, 'targets'), 'Air & ground');
  assert.equal(stat(cardFacts('ogre'), 'targets'), 'Towers');
  assert.equal(stat(cardFacts('duelist'), 'targets'), 'Ground');
  assert.equal(stat(cardFacts('duelist'), 'range'), 'Melee');
  assert.equal(
    stat(cardFacts('ranger'), 'range'),
    String(troopCards.ranger.unit.range),
  );
  assert.equal(stat(cardFacts('balloon'), 'range'), 'Melee');
  assert.equal(
    stat(cardFacts('firefighter'), 'range'),
    String(troopCards.firefighter.unit.range),
  );
});

await test('levels and boosts change the numbers as the engine does', () => {
  const boost = {
    levels: { duelist: 3, gladiator: 2, meteor: 2 },
    troopHp: 1.1,
    troopDamage: 1.2,
    troopSpeed: 1.1,
    spellDamage: 1.5,
  };
  const m = createMatch(1, 'medium', 'duel', { boosts: [boost] });
  for (const id of ['duelist', 'gladiator', 'archers']) {
    const u = summon(m, 0, id, 9, 5);
    const f = cardFacts(id, boost);
    assert.equal(stat(f, 'hp'), String(u.maxHp), `${id} hit points`);
    assert.equal(
      stat(f, 'damage'),
      String(Math.round(troopCards[id].unit.damage * u.power)),
      `${id} damage`,
    );
    assert.equal(
      stat(f, 'speed'),
      String(Math.round(troopCards[id].unit.speed * u.pace * 100) / 100),
    );
  }
  assert.equal(cardFacts('duelist', boost).level, 3);
  const glad = summon(m, 0, 'gladiator', 9, 5);
  assert.ok(
    cardFacts('gladiator', boost).abilities.some((a) =>
      a.text.includes(String(glad.shield)),
    ),
    'the shield grows with the level',
  );
  // The Meteor: deploy carries its damage on the falling spell.
  m.phase = 'battle';
  m.players[0].elixir = 10;
  m.players[0].hand.cards[0] = 'meteor';
  deploy(m, 0, 0, 9, 20);
  const rock = m.spells[m.spells.length - 1];
  const meteor = cardFacts('meteor', boost);
  assert.equal(stat(meteor, 'damage'), String(rock.damage));
  assert.equal(stat(meteor, 'towerDamage'), String(rock.towerDamage));
  assert.equal(
    stat(cardFacts('meteor'), 'damage'),
    String(cards.meteor.spell.damage),
  );
  assert.equal(
    stat(cardFacts('meteor'), 'towerDamage'),
    String(cards.meteor.spell.towerDamage),
  );
});

await test('ability lines carry their numbers', () => {
  const u = (id) => troopCards[id].unit;
  const line = (id, key) =>
    cardFacts(id).abilities.find((a) => a.key === key)?.text ?? '';
  // Each line must carry these numbers from the card, in this order.
  const has = (id, key, ...numbers) => {
    const text = line(id, key);
    let from = 0;
    for (const n of numbers) {
      const at = text.indexOf(String(Math.round(n * 100) / 100), from);
      assert.ok(at >= 0, `${id} ${key}: "${text}" lacks ${n}`);
      from = at;
    }
  };
  has(
    'pirate',
    'leap',
    u('pirate').leap.range,
    u('pirate').leap.bonus,
    u('pirate').leap.cooldown,
  );
  has('viking', 'spin', u('viking').spin);
  has('viking', 'rage', u('viking').rage.boost);
  has('gladiator', 'shield', u('gladiator').shield);
  has('medic', 'heal', u('medic').heal.radius, u('medic').heal.amount);
  has('miner', 'burrow', u('miner').burrow);
  has(
    'balloon',
    'deathBlast',
    u('balloon').deathBlast.damage,
    u('balloon').deathBlast.radius,
  );
  has(
    'inventor',
    'chain',
    u('inventor').chain.count,
    u('inventor').chain.range,
  );
  has('inventor', 'stun', u('inventor').stun);
  has('gunner', 'minRange', u('gunner').minRange);
  has('diver', 'armour', u('diver').armour.flat, u('diver').armour.min * 100);
  has('sumo', 'taunt', u('sumo').taunt.radius, u('sumo').taunt.seconds);
  has('sumo', 'knockback', u('sumo').knockback.distance);
  has(
    'linebacker',
    'tackle',
    u('linebacker').tackle.stun,
    u('linebacker').tackle.distance,
  );
  const spawn = u('beekeeper').spawn;
  has(
    'beekeeper',
    'spawn',
    spawn.count,
    spawn.every,
    u(spawn.unit).hp,
    u(spawn.unit).damage,
  );
  assert.match(line('beekeeper', 'follows'), /never attacks/);
  has('drummer', 'aura', u('drummer').aura.radius, u('drummer').aura.boost);
  has('firefighter', 'cone', u('firefighter').cone.push);
  has(
    'explorer',
    'slow',
    Math.round((1 - u('explorer').slow.factor) * 100),
    u('explorer').slow.seconds,
  );
  // Pushes name the troops too heavy to move.
  const heavy = (mass) =>
    Object.values(troopCards)
      .filter((c) => c.unit.mass >= mass)
      .map((c) => c.name);
  for (const name of heavy(u('sumo').knockback.mass))
    assert.ok(line('sumo', 'knockback').includes(name), `not the ${name}`);
  const meteor = cardFacts('meteor')
    .abilities.map((a) => a.text)
    .join(' ');
  for (const name of heavy(cards.meteor.spell.knockMass))
    assert.ok(meteor.includes(name), `the Meteor does not push the ${name}`);
});

await test('the browser offers only playable cards', () => {
  assert.ok(!allCards.includes('bee'));
  assert.ok(allCards.every((id) => playable(id)));
});

await test('a bee takes the level of the Beekeeper that releases it', () => {
  const boost = { levels: { beekeeper: 3 } };
  const m = createMatch(1, 'medium', 'duel', { boosts: [boost] });
  const keeper = summon(m, 0, 'beekeeper', 9, 5);
  const bee = summon(m, 0, 'bee', 9, 5, 0, { card: 'beekeeper', deploy: 0.3 });
  const f = cardFacts('bee', boost);
  assert.equal(f.level, 3);
  assert.equal(stat(f, 'hp'), String(bee.maxHp));
  assert.match(
    cardFacts('beekeeper', boost).abilities.find((a) => a.key === 'spawn').text,
    new RegExp(`${bee.maxHp} hit points`),
  );
  assert.ok(keeper.maxHp > troopCards.beekeeper.unit.hp);
});
