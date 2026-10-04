import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cards,
  deck,
  isSpell,
  troopCards,
  troopDeck,
} from '../lib/games/arena/cards.ts';
import {
  BRIDGES,
  BRIDGE_HALF,
  DOUBLE_FROM,
  ELIXIR_SECONDS,
  OVERTIME,
  READY,
  REGULATION,
  RIVER,
  MID,
  TICK,
  advance,
  canDeployAt,
  canPlayAt,
  clock,
  createMatch,
  deploy,
  elixirMultiplier,
  dist,
  step,
} from '../lib/games/arena/engine.ts';
import { botMemory, botStep } from '../lib/games/arena/bot.ts';
import { checksum, replay, snapshot } from '../lib/games/arena/net.ts';

const battle = (seed = 7, difficulty = 'medium', mode = 'duel') => {
  const m = createMatch(seed, difficulty, mode);
  advance(m, READY + TICK);
  assert.equal(m.phase, 'battle');
  return m;
};
/** Put a card in slot 0 of a player's hand, whatever was dealt. */
const give = (m, player, id) => {
  const hand = m.players[player].hand;
  const at = hand.cards.indexOf(id);
  if (at >= 0) return at;
  const q = hand.queue.indexOf(id);
  [hand.cards[0], hand.queue[q]] = [hand.queue[q], hand.cards[0]];
  return 0;
};
const tower = (m, side, kind, lane) =>
  m.towers.find(
    (t) =>
      t.side === side &&
      t.kind === kind &&
      (lane === undefined || t.lane === lane),
  );

await test('a full deck of eight cards deals four to each hand', () => {
  assert.equal(deck.length, 8);
  assert.equal(new Set(deck).size, 8);
  const m = createMatch(1);
  assert.equal(m.players.length, 2);
  for (const player of m.players) {
    const { cards: hand, queue } = player.hand;
    assert.equal(hand.length, 4);
    assert.equal(queue.length, 4);
    assert.deepEqual([...hand, ...queue].sort(), [...deck].sort());
    assert.equal(player.elixir, 7);
  }
  assert.deepEqual(
    m.players.map((p) => p.side),
    [0, 1],
  );
  assert.equal(m.towers.length, 6);
  assert.equal(m.phase, 'ready');
  assert.equal(clock(m), REGULATION);
});

await test('nothing can be played during the ready count', () => {
  const m = createMatch(2);
  assert.equal(deploy(m, 0, 0, 9, 10).ok, false);
  advance(m, READY + TICK);
  assert.equal(m.phase, 'battle');
});

await test('solo and team openings are playable after one second and fill in 8.4 seconds', () => {
  for (const mode of ['duel', 'team']) {
    const m = createMatch(42, 'medium', mode);
    for (let tick = 0; tick < 29; tick++) step(m);
    assert.equal(m.phase, 'ready');
    for (const p of m.players) assert.equal(p.elixir, 7);
    step(m);
    // Floating point sums can put the crossing on the next fixed tick.
    if (m.phase === 'ready') step(m);
    assert.equal(m.phase, 'battle');
    assert.equal(
      m.events.filter((e) => e.type === 'phase' && e.phase === 'battle').length,
      1,
    );
    for (const p of m.players) assert.equal(p.elixir, 7);
    advance(m, 8.4 + TICK);
    for (const p of m.players) assert.equal(p.elixir, 10);
  }
});

await test('played cards go to the back of the deck and the next card comes in', () => {
  const m = battle();
  const hand = m.players[0].hand;
  const played = hand.cards[1];
  const upcoming = hand.queue[0];
  m.players[0].elixir = 10;
  assert.ok(deploy(m, 0, 1, 9, 10).ok);
  assert.equal(hand.cards[1], upcoming);
  assert.equal(hand.queue.at(-1), played);
  assert.equal(hand.queue.length, 4);
  assert.equal(m.players[0].elixir, 10 - cards[played].cost);
});

await test('cards need enough elixir and a spot on your own half', () => {
  const m = battle();
  m.players[0].elixir = 10;
  assert.equal(canDeployAt(m, 0, 9, 10), true);
  assert.equal(canDeployAt(m, 0, 9, 16), false, 'the river');
  assert.equal(canDeployAt(m, 0, 9, 20), false, 'the enemy half');
  assert.equal(canDeployAt(m, 0, 3.5, 6.5), false, 'on a tower');
  assert.equal(canDeployAt(m, 1, 9, 20), true);
  assert.equal(canDeployAt(m, 1, 9, 10), false);
  const slot = give(m, 0, 'ogre');
  m.players[0].elixir = 4;
  assert.deepEqual(deploy(m, 0, slot, 9, 10), { ok: false, reason: 'elixir' });
});

await test('a fallen princess tower opens a pocket on its lane', () => {
  const m = battle();
  const left = tower(m, 1, 'princess', 0);
  assert.equal(canDeployAt(m, 0, 4, 19), false);
  left.hp = 0;
  left.destroyed = true;
  assert.equal(canDeployAt(m, 0, 4, 19), true);
  assert.equal(canDeployAt(m, 0, 14, 19), false, 'the other lane stays shut');
  assert.equal(canDeployAt(m, 0, 4, 24), false, 'only a few rows deep');
});

await test('elixir refills every 2.8 seconds, twice as fast in the last minute', () => {
  const m = battle();
  const p = m.players[0];
  p.elixir = 0;
  advance(m, ELIXIR_SECONDS);
  assert.ok(Math.abs(p.elixir - 1) < 0.02, `got ${p.elixir}`);
  m.time = DOUBLE_FROM;
  p.elixir = 0;
  advance(m, ELIXIR_SECONDS);
  assert.ok(Math.abs(p.elixir - 2) < 0.04, `got ${p.elixir}`);
  p.elixir = 9.99;
  advance(m, 5);
  assert.equal(p.elixir, 10);
});

await test('overtime refills 2.5 elixir per base interval for every solo and team seat', () => {
  for (const mode of ['duel', 'team']) {
    const m = battle(7, 'medium', mode);
    m.time = DOUBLE_FROM - TICK;
    assert.equal(elixirMultiplier(m), 1);
    m.time = DOUBLE_FROM;
    assert.equal(elixirMultiplier(m), 2);
    m.time = REGULATION - TICK / 2;
    step(m);
    assert.equal(m.phase, 'overtime');
    assert.equal(elixirMultiplier(m), 2.5);
    for (const p of m.players) p.elixir = 0;
    advance(m, ELIXIR_SECONDS);
    for (const p of m.players) {
      assert.ok(Math.abs(p.elixir - 2.5) < 0.04, `${mode}: got ${p.elixir}`);
      p.elixir = 9.99;
    }
    step(m);
    for (const p of m.players) assert.equal(p.elixir, 10);
  }
});

await test('a samurai crosses at a bridge, stays out of the water and hits a tower', () => {
  const m = battle();
  const slot = give(m, 0, 'duelist');
  const [id] = deploy(m, 0, slot, 3, 12).ids;
  const target = tower(m, 1, 'princess', 0);
  const maxHp = target.hp;
  for (let i = 0; i < 30 * 40 && target.hp === maxHp; i++) {
    step(m);
    const u = m.units.find((x) => x.id === id);
    if (!u) break;
    if (u.y > RIVER[0] && u.y < RIVER[1])
      assert.ok(
        BRIDGES.some((b) => Math.abs(u.x - b) <= BRIDGE_HALF),
        `in the water at ${u.x.toFixed(2)},${u.y.toFixed(2)}`,
      );
    // Keep the samurai alive so the walk can finish.
    u.hp = u.maxHp;
  }
  assert.ok(target.hp < maxHp, 'the tower took damage');
});

await test('the drake flies straight over the river', () => {
  const m = battle();
  const slot = give(m, 0, 'drake');
  const [id] = deploy(m, 0, slot, 9, 13).ids;
  let crossedOffBridge = false;
  for (let i = 0; i < 30 * 12; i++) {
    step(m);
    const u = m.units.find((x) => x.id === id);
    if (!u) break;
    u.hp = u.maxHp;
    if (
      u.y > RIVER[0] &&
      u.y < RIVER[1] &&
      !BRIDGES.some((b) => Math.abs(u.x - b) <= BRIDGE_HALF)
    )
      crossedOffBridge = true;
  }
  assert.ok(crossedOffBridge);
});

await test('the ogre ignores troops and walks to a tower', () => {
  const m = battle();
  const a = give(m, 0, 'ogre');
  for (const p of m.players) p.elixir = 10;
  const [ogre] = deploy(m, 0, a, 14, 13).ids;
  const b = give(m, 1, 'duelist');
  deploy(m, 1, b, 14.5, 18);
  for (let i = 0; i < 30 * 30; i++) {
    step(m);
    const u = m.units.find((x) => x.id === ogre);
    if (!u) break;
    if (u.targetId !== null) {
      const t = m.towers.find((x) => x.id === u.targetId);
      assert.ok(t, 'the ogre only ever targets towers');
    }
  }
});

await test('ground-only troops cannot hit the drake', () => {
  const m = battle();
  for (const p of m.players) p.elixir = 10;
  const a = give(m, 0, 'drake');
  const [drake] = deploy(m, 0, a, 9, 14).ids;
  const b = give(m, 1, 'duelist');
  const [samurai] = deploy(m, 1, b, 9, 17.5).ids;
  for (let i = 0; i < 30 * 6; i++) {
    step(m);
    const k = m.units.find((x) => x.id === samurai);
    if (k) assert.notEqual(k.targetId, drake);
  }
});

await test('towers shoot the imps down', () => {
  const m = battle();
  const slot = give(m, 1, 'imps');
  const ids = deploy(m, 1, slot, 3.5, 19).ids;
  assert.equal(ids.length, 3);
  advance(m, 25);
  const left = tower(m, 0, 'princess', 0);
  assert.ok(left.hp < left.maxHp, 'the imps did some damage');
  assert.equal(
    m.units.filter((u) => ids.includes(u.id)).length,
    0,
    'the imps are gone',
  );
});

await test('splash damage reaches every troop in the blast', () => {
  const m = battle();
  for (const p of m.players) p.elixir = 10;
  const a = give(m, 0, 'mage');
  deploy(m, 0, a, 9, 12);
  const b = give(m, 1, 'imps');
  const imps = deploy(m, 1, b, 9, 17.5).ids;
  const hits = new Set();
  for (let i = 0; i < 30 * 8; i++) {
    step(m);
    for (const e of m.events.splice(0))
      if (e.type === 'hit' && imps.includes(e.id)) hits.add(e.id);
  }
  assert.ok(hits.size >= 2, `mage splashed ${hits.size} imps`);
});

await test('a destroyed princess tower scores a crown and wakes the king', () => {
  const m = battle();
  const left = tower(m, 1, 'princess', 0);
  const king = tower(m, 1, 'king');
  assert.equal(king.active, false);
  left.hp = 1;
  m.players[0].elixir = 10;
  const slot = give(m, 0, 'archers');
  deploy(m, 0, slot, 3.5, 14);
  advance(m, 20);
  assert.equal(left.destroyed, true);
  assert.equal(m.crowns[0], 1);
  assert.equal(king.active, true);
});

await test('the king falling ends the match with three crowns', () => {
  const m = battle();
  const king = tower(m, 1, 'king');
  king.hp = 1;
  king.active = true;
  for (const lane of [0, 1]) {
    const t = tower(m, 1, 'princess', lane);
    t.hp = 0;
    t.destroyed = true;
  }
  m.players[0].elixir = 10;
  const slot = give(m, 0, 'drake');
  deploy(m, 0, slot, 9, 14);
  advance(m, 30);
  assert.equal(m.phase, 'over');
  assert.equal(m.winner, 0);
  assert.equal(m.crowns[0], 3);
});

await test('level crowns at full time go to sudden-death overtime', () => {
  const m = battle();
  m.time = REGULATION - TICK / 2;
  step(m);
  assert.equal(m.phase, 'overtime');
  // The first tower to fall in overtime wins.
  const right = tower(m, 1, 'princess', 1);
  right.hp = 1;
  m.players[0].elixir = 10;
  const slot = give(m, 0, 'archers');
  deploy(m, 0, slot, 14.5, 14);
  advance(m, 20);
  assert.equal(m.phase, 'over');
  assert.equal(m.winner, 0);
});

await test('after overtime the weaker tower loses, equal towers draw', () => {
  const a = battle();
  a.time = REGULATION + OVERTIME - TICK / 2;
  a.phase = 'overtime';
  tower(a, 1, 'princess', 0).hp = 100;
  step(a);
  assert.equal(a.phase, 'over');
  assert.equal(a.winner, 0);
  const b = battle();
  b.time = REGULATION + OVERTIME - TICK / 2;
  b.phase = 'overtime';
  step(b);
  assert.equal(b.winner, 'draw');
});

await test('the starting deck holds seven troops and the Meteor, a spell', () => {
  assert.deepEqual(
    deck.map((id) => cards[id].name),
    [
      'Cadets',
      'Dino',
      'Robots',
      'Samurai',
      'Cowboy',
      'Biplane',
      'Wizard',
      'Meteor',
    ],
  );
  assert.equal('knight' in cards, false);
  assert.equal(cards.meteor.kind, 'spell');
  assert.equal(isSpell('meteor'), true);
  assert.equal(isSpell('archers'), false);
  // Every troop card, the starting seven first.
  assert.deepEqual(
    troopDeck.slice(0, 7),
    deck.filter((id) => id !== 'meteor'),
  );
  // Twenty-three troop cards and the Beekeeper's Bee.
  assert.equal(troopDeck.length, 24);
  for (const id of troopDeck) {
    assert.equal(cards[id].kind, 'troop');
    assert.equal(troopCards[id], cards[id]);
  }
  assert.equal(cards.meteor.cost, 4);
  assert.deepEqual(cards.meteor.spell, {
    radius: 2.5,
    damage: 600,
    towerDamage: 190,
    delay: 1,
    knockback: 0.6,
    knockMass: 10,
  });
  // Toy shots: ray guns for the Cadets and the tower guards, bombs for the Biplane.
  assert.equal(cards.archers.unit.projectile.kind, 'laser');
  assert.equal(cards.drake.unit.projectile.kind, 'bomb');
  assert.equal(cards.mage.unit.projectile.kind, 'fire');
  assert.equal(cards.ranger.unit.projectile.kind, 'bolt');
});

await test('the Meteor may land anywhere on the field; troops keep to their half', () => {
  const m = battle();
  for (const [x, y] of [
    [9, 25],
    [3.5, 25.5],
    [9, 29],
    [9, 16],
    [3.5, 6.5],
    [0.5, 0.5],
    [17.5, 31.5],
  ])
    for (const side of [0, 1])
      assert.equal(
        canPlayAt(m, side, 'meteor', x, y),
        true,
        `${side} at ${x},${y}`,
      );
  for (const [x, y] of [
    [0.4, 10],
    [9, 31.6],
    [18, 5],
    [Number.NaN, 5],
  ])
    assert.equal(
      canPlayAt(m, 0, 'meteor', x, y),
      false,
      `off the field at ${x},${y}`,
    );
  assert.equal(
    canPlayAt(m, 0, 'archers', 9, 25),
    false,
    'troops not past the river',
  );
  assert.equal(canPlayAt(m, 0, 'archers', 3.5, 6.5), false, 'nor on a tower');
  assert.equal(canPlayAt(m, 0, 'archers', 9, 10), true);
});

await test('casting the Meteor spends elixir and cycles the hand but puts no troop down', () => {
  const m = battle();
  const seat = m.players[0];
  const slot = give(m, 0, 'meteor');
  const upcoming = seat.hand.queue[0];
  seat.elixir = 10;
  m.events.length = 0;
  const cast = deploy(m, 0, slot, 9, 25);
  assert.equal(cast.ok, true);
  assert.equal(m.units.length, 0);
  assert.equal(m.spells.length, 1);
  const [spell] = m.spells;
  assert.deepEqual(
    [
      spell.id,
      spell.side,
      spell.owner,
      spell.card,
      spell.x,
      spell.y,
      spell.left,
    ],
    [cast.ids[0], 0, 0, 'meteor', 9, 25, 1],
  );
  assert.equal(seat.elixir, 6);
  assert.equal(seat.spent, 4);
  assert.equal(seat.hand.cards[slot], upcoming);
  assert.equal(seat.hand.queue.at(-1), 'meteor');
  assert.deepEqual(m.events, [
    { type: 'deploy', side: 0, player: 0, card: 'meteor', x: 9, y: 25 },
  ]);
  // It needs its four elixir like any card.
  const again = give(m, 0, 'meteor');
  seat.elixir = 3.9;
  assert.deepEqual(deploy(m, 0, again, 9, 25), { ok: false, reason: 'elixir' });
});

await test('the Meteor crashes a second after the cast, not before', () => {
  const m = battle();
  for (const p of m.players) p.elixir = 10;
  const cadets = deploy(m, 1, give(m, 1, 'archers'), 9, 22).ids;
  deploy(m, 0, give(m, 0, 'meteor'), 9, 22);
  m.events.length = 0;
  for (let i = 1; i < 30; i++) {
    step(m);
    assert.equal(m.spells.length, 1, `still falling after ${i} steps`);
    for (const u of m.units) assert.equal(u.hp, u.maxHp);
    assert.ok(!m.events.some((e) => e.type === 'impact' || e.type === 'hit'));
  }
  step(m);
  assert.equal(m.spells.length, 0);
  const impact = m.events.find((e) => e.type === 'impact');
  assert.deepEqual(impact, {
    type: 'impact',
    kind: 'meteor',
    x: 9,
    y: 22,
    splash: 2.5,
  });
  // 600 is more than a Cadet can take.
  assert.equal(m.units.filter((u) => cadets.includes(u.id)).length, 0);
  assert.equal(m.events.filter((e) => e.type === 'death').length, 2);
});

/** A planted troop of `player`, dropped on its half and moved to (x, y). */
const plant = (m, player, id, x, y) => {
  m.players[player].elixir = 10;
  const drop = m.players[player].side === 0 ? 10 : 22;
  const [uid] = deploy(m, player, give(m, player, id), 9, drop).ids;
  const u = m.units.find((e) => e.id === uid);
  u.x = u.px = x;
  u.y = u.py = y;
  return u;
};
const crash = (m, player, x, y) => {
  m.players[player].elixir = 10;
  assert.ok(deploy(m, player, give(m, player, 'meteor'), x, y).ok);
  for (let i = 0; i < 30; i++) step(m);
  assert.equal(m.spells.length, 0);
};

await test('the Meteor hits ground and air troops in its circle and knocks light ones back', () => {
  const m = battle();
  const r = cards.meteor.spell.radius;
  // Just inside the circle (to the troop's edge), just outside, and heavy.
  const plane = plant(m, 1, 'drake', 9 + r + 0.6 - 0.05, 22);
  const samurai = plant(m, 1, 'duelist', 9 - (r + 0.5 + 0.05), 22);
  const dino = plant(m, 1, 'ogre', 9, 23);
  const cowboy = plant(m, 1, 'ranger', 9, 20);
  crash(m, 0, 9, 22);
  assert.equal(plane.hp, plane.maxHp - 600, 'flyers are hit');
  assert.equal(samurai.hp, samurai.maxHp, 'outside the circle');
  assert.equal(dino.hp, dino.maxHp - 600);
  assert.equal(cowboy.hp, cowboy.maxHp - 600);
  // Light troops fly 0.6 tiles straight out; the Dino stands firm.
  assert.ok(
    Math.abs(plane.x - (9 + r + 0.55 + 0.6)) < 1e-9,
    `plane at ${plane.x}`,
  );
  assert.ok(Math.abs(plane.y - 22) < 1e-9);
  assert.ok(Math.abs(cowboy.y - 19.4) < 1e-9, `cowboy at ${cowboy.y}`);
  assert.deepEqual([dino.x, dino.y], [9, 23]);
  assert.deepEqual([samurai.x, samurai.y], [9 - (r + 0.55), 22]);
});

await test('the knock-back never carries a ground troop across the river', () => {
  // On the bank: shoved towards the water, it steps back onto its own bank.
  const a = battle();
  const cowboy = plant(a, 1, 'ranger', 9, 17.6);
  const plane = plant(a, 1, 'drake', 9, 17.6);
  crash(a, 0, 9, 19.5);
  assert.equal(cowboy.hp, cowboy.maxHp - 600);
  assert.ok(cowboy.y > RIVER[1], `cowboy at ${cowboy.y}`);
  // Flyers go where they are pushed.
  assert.ok(Math.abs(plane.y - 17) < 1e-9, `plane at ${plane.y}`);
  // On a bridge: shoved along it, it stops at the middle.
  const b = battle();
  const samurai = plant(b, 1, 'duelist', 3.5, 16.2);
  crash(b, 0, 3.5, 18);
  assert.equal(samurai.hp, samurai.maxHp - 600);
  assert.ok(samurai.y > MID && samurai.y < 16.2, `samurai at ${samurai.y}`);
  assert.ok(Math.abs(samurai.x - 3.5) <= BRIDGE_HALF);
});

await test('towers take 190 from the Meteor, a sleeping king wakes and a weak tower falls', () => {
  const m = battle();
  const left = tower(m, 1, 'princess', 0);
  const right = tower(m, 1, 'princess', 1);
  const king = tower(m, 1, 'king');
  // Right on a tower, on the enemy half.
  crash(m, 0, left.x, left.y);
  assert.equal(left.hp, left.maxHp - 190);
  assert.equal(king.hp, king.maxHp, 'the king is out of the circle');
  assert.equal(king.active, false);
  m.events.length = 0;
  crash(m, 0, king.x, king.y);
  assert.equal(king.hp, king.maxHp - 190);
  assert.equal(king.active, true);
  assert.ok(m.events.some((e) => e.type === 'king-wakes' && e.side === 1));
  // The finisher: a tower with 190 or less left falls for a crown.
  right.hp = 150;
  crash(m, 0, right.x + 3, right.y);
  assert.equal(right.destroyed, true);
  assert.equal(m.crowns[0], 1);
  // Team towers are sturdier but take the same.
  const team = battle(3, 'medium', 'team');
  const t = tower(team, 0, 'princess', 0);
  crash(team, 3, t.x, t.y);
  assert.equal(t.hp, t.maxHp - 190);
});

await test('two matches with the same casts stay identical, and the checksum covers spells', () => {
  const script = [
    [5, 1, 'archers', 9, 22],
    [6, 1, 'imps', 5, 20],
    [12, 0, 'meteor', 8.5, 21],
    [30, 0, 'duelist', 4, 12],
    [44, 1, 'meteor', 4.5, 12.5],
    [45, 0, 'drake', 12, 13],
    [80, 1, 'mage', 12, 24],
  ];
  const run = () => {
    const m = battle(21);
    const sums = [];
    let impacts = 0;
    for (let t = 0; t < 30 * 8; t++) {
      for (const [at, player, id, x, y] of script)
        if (at === t) {
          m.players[player].elixir = 10;
          assert.ok(deploy(m, player, give(m, player, id), x, y).ok);
        }
      step(m);
      impacts += m.events.filter(
        (e) => e.type === 'impact' && e.kind === 'meteor',
      ).length;
      m.events.length = 0;
      sums.push(checksum(m));
    }
    return { m, sums, impacts };
  };
  const a = run();
  const b = run();
  assert.equal(a.impacts, 2);
  assert.deepEqual(a.sums, b.sums);
  assert.equal(JSON.stringify(snapshot(a.m)), JSON.stringify(snapshot(b.m)));
  // A falling spell is part of the fingerprint: where, when and whether.
  const m = battle();
  m.players[0].elixir = 10;
  deploy(m, 0, give(m, 0, 'meteor'), 9, 25);
  const sum = checksum(m);
  assert.equal(checksum(snapshot(m)), sum);
  const moved = snapshot(m);
  moved.spells[0].x = 9.5;
  assert.notEqual(checksum(moved), sum);
  const later = snapshot(m);
  later.spells[0].left -= TICK;
  assert.notEqual(checksum(later), sum);
  const gone = snapshot(m);
  gone.spells = [];
  assert.notEqual(checksum(gone), sum);
  // So is the order of the hand.
  const swapped = snapshot(m);
  const hand = swapped.players[0].hand.cards;
  [hand[0], hand[1]] = [hand[1], hand[0]];
  assert.notEqual(checksum(swapped), sum);
});

/** Bots in every seat; `top` plays side 1, `bottom` side 0. */
function botMatch(seed, top, bottom, mode = 'duel') {
  const m = createMatch(seed, top, mode);
  const bots = m.players.map((p, i) =>
    botMemory(i, p.side === 1 ? top : bottom, seed),
  );
  let guard = 0;
  while (m.phase !== 'over' && guard++ < 30 * 300) {
    for (const mem of bots) {
      const move = botStep(m, mem);
      if (move) assert.ok(deploy(m, move.player, move.slot, move.x, move.y).ok);
    }
    step(m);
    m.events.length = 0;
    for (const u of m.units) {
      assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y));
      if (
        !cards[u.card].unit.flying &&
        u.y > RIVER[0] + 0.05 &&
        u.y < RIVER[1] - 0.05
      )
        assert.ok(
          BRIDGES.some((b) => Math.abs(u.x - b) <= BRIDGE_HALF + 0.01),
          `${u.card} in the water at ${u.x.toFixed(2)},${u.y.toFixed(2)}`,
        );
    }
  }
  return m;
}

await test('bot against bot always finishes, deterministically', () => {
  const a = botMatch(11, 'medium', 'medium');
  const b = botMatch(11, 'medium', 'medium');
  assert.equal(a.phase, 'over');
  assert.deepEqual(a.crowns, b.crowns);
  assert.equal(a.tick, b.tick);
  const spent = a.players.map((p) => p.spent);
  assert.ok(spent[0] > 20 && spent[1] > 20, `spent ${spent.join(', ')}`);
});

await test('harder bots beat easier ones most of the time', () => {
  for (const [top, bottom] of [
    ['hard', 'easy'],
    ['medium', 'easy'],
    ['hard', 'medium'],
  ]) {
    let upper = 0;
    let lower = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const m = botMatch(seed * 97, top, bottom);
      if (m.winner === 1) upper++;
      else if (m.winner === 0) lower++;
    }
    assert.ok(upper > lower, `${top} ${upper}, ${bottom} ${lower}`);
  }
});

await test('a team battle seats two players a side with sturdier towers', () => {
  const m = battle(3, 'medium', 'team');
  assert.deepEqual(
    m.players.map((p) => p.side),
    [0, 1, 0, 1],
  );
  const duel = createMatch(3);
  const king = tower(m, 0, 'king');
  assert.ok(king.maxHp > tower(duel, 0, 'king').maxHp * 1.5);
  assert.ok(king.damage > tower(duel, 0, 'king').damage);
  // Teammates share a half but keep their own hands and elixir.
  m.players[2].elixir = 10;
  const slot = give(m, 2, 'duelist');
  const [id] = deploy(m, 2, slot, 12, 10).ids;
  const samurai = m.units.find((u) => u.id === id);
  assert.equal(samurai.side, 0);
  assert.equal(samurai.owner, 2);
  assert.equal(m.players[0].elixir, 7);
  assert.equal(m.players[2].elixir, 10 - cards.duelist.cost);
  assert.equal(deploy(m, 3, 0, 12, 10).ok, false, 'not on the other half');
});

await test('a team battle between bots finishes', () => {
  const m = botMatch(5, 'hard', 'medium', 'team');
  assert.equal(m.phase, 'over');
  assert.ok(m.players.every((p) => p.spent > 10));
});

/** The bot's first decision to throw the Meteor within a few tries. */
const meteorMove = (m, mem, tries = 30) => {
  for (let i = 0; i < tries; i++) {
    mem.nextThink = 0;
    const move = botStep(m, mem);
    const hand = m.players[mem.player].hand.cards;
    if (move && hand[move.slot] === 'meteor') return move;
  }
  return null;
};

await test('every bot finishes a weak tower with the Meteor', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const m = battle(5, level);
    const mem = botMemory(1, level, 5);
    give(m, 1, 'meteor');
    m.players[1].elixir = 6;
    const target = tower(m, 0, 'princess', 1);
    target.hp = 150;
    const move = meteorMove(m, mem);
    assert.ok(move, `${level} throws it`);
    assert.ok(
      dist(move.x - target.x, move.y - target.y) <=
        cards.meteor.spell.radius + target.radius,
      `${level} aims at ${move.x},${move.y}`,
    );
    assert.ok(deploy(m, move.player, move.slot, move.x, move.y).ok);
    for (let i = 0; i < 30; i++) step(m);
    assert.equal(target.destroyed, true, level);
    assert.equal(m.crowns[1], 1);
  }
});

await test('the hard bot throws the Meteor where walking support troops will be', () => {
  const m = battle(9, 'hard');
  for (const p of m.players) p.elixir = 10;
  const ids = [
    ...deploy(m, 0, give(m, 0, 'archers'), 12, 9).ids,
    ...deploy(m, 0, give(m, 0, 'mage'), 12, 7.8).ids,
  ];
  // Let them get walking up the lane.
  for (let i = 0; i < 45; i++) step(m);
  const walkers = m.units.filter((u) => ids.includes(u.id));
  assert.ok(walkers.every((u) => u.state === 'walking' && u.y > u.py));
  const y = walkers.reduce((sum, u) => sum + u.y, 0) / walkers.length;
  const mem = botMemory(1, 'hard', 9);
  give(m, 1, 'meteor');
  m.players[1].elixir = 10;
  const move = meteorMove(m, mem, 1);
  assert.ok(move, 'hard casts at once');
  assert.ok(move.y > y + 0.5, `leads them: ${move.y} ahead of ${y.toFixed(2)}`);
  assert.ok(deploy(m, move.player, move.slot, move.x, move.y).ok);
  for (let i = 0; i < 30; i++) step(m);
  const left = m.units.filter((u) => ids.includes(u.id));
  assert.deepEqual(
    left.map((u) => u.card),
    ['mage'],
    'both Cadets are gone and the Wizard is hurt',
  );
  assert.ok(left[0].hp <= left[0].maxHp - 600);
});

await test('bots keep the Meteor for targets worth more than the rock', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const m = battle(4, level);
    for (const p of m.players) p.elixir = 10;
    // Three Robots alone are worth less than the Meteor.
    deploy(m, 0, give(m, 0, 'imps'), 9, 12);
    for (let i = 0; i < 40; i++) step(m);
    const mem = botMemory(1, level, 4);
    give(m, 1, 'meteor');
    m.players[1].elixir = 10;
    assert.equal(meteorMove(m, mem, 20), null, level);
  }
});

await test('lockstep: a replayed match matches the original tick for tick', () => {
  // The "server" plays bots straight into its match and records each card.
  const server = createMatch(42, 'hard', 'team');
  const client = snapshot(server);
  const bots = server.players.map((p, i) => botMemory(i, 'hard', 42));
  const plays = new Map();
  const sums = new Map();
  let meteors = 0;
  let midair = 0;
  while (server.phase !== 'over' && server.tick < 30 * 90) {
    step(server);
    for (const mem of bots) {
      const move = botStep(server, mem);
      const card = move && server.players[move.player].hand.cards[move.slot];
      if (move && deploy(server, move.player, move.slot, move.x, move.y).ok) {
        const list = plays.get(server.tick) ?? [];
        list.push([server.tick, move.player, move.slot, move.x, move.y]);
        plays.set(server.tick, list);
        if (card === 'meteor') meteors++;
      }
    }
    if (server.tick % 30 === 0) {
      sums.set(server.tick, checksum(server));
      if (server.spells.length) midair++;
    }
  }
  // The bots threw Meteors, some still falling at a checksum.
  assert.ok(meteors > 2 && midair > 0, `${meteors} meteors, ${midair} midair`);
  let checked = 0;
  replay(client, server.tick, plays, (m) => {
    const want = sums.get(m.tick);
    if (want === undefined) return;
    assert.equal(checksum(m), want, `drift at tick ${m.tick}`);
    checked++;
  });
  assert.ok(checked > 60);
  assert.equal(checksum(client), checksum(server));
  assert.deepEqual(client.crowns, server.crowns);
  // A snapshot restarts a match exactly where it was.
  assert.equal(checksum(snapshot(server)), checksum(server));
});

await test('the camera keeps the whole field between the top bar and the hand', async () => {
  const THREE = await import('three');
  const { fitCamera, lensFor, mirrorCamera, pointsFor } =
    await import('../lib/games/arena/layout.ts');
  for (const frame of [
    { width: 390, height: 844, top: 60, bottom: 170 },
    { width: 375, height: 667, top: 56, bottom: 160 },
    { width: 1920, height: 969, top: 60, bottom: 160 },
    { width: 1512, height: 982, top: 60, bottom: 150 },
    { width: 1280, height: 720, top: 56, bottom: 150 },
    { width: 820, height: 1180, top: 60, bottom: 170 },
    { width: 1133, height: 744, top: 60, bottom: 150 },
    { width: 932, height: 430, top: 56, bottom: 120 },
    { width: 1024.5, height: 584.5, top: 56, bottom: 130 },
  ]) {
    const lens = lensFor(frame);
    const keyPoints = pointsFor(lens);
    const cam = fitCamera(frame, lens);
    const camera = new THREE.PerspectiveCamera(
      cam.fov,
      frame.width / frame.height,
      0.5,
      500,
    );
    camera.position.set(...cam.position);
    camera.lookAt(new THREE.Vector3(...cam.target));
    camera.updateMatrixWorld();
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;
    for (const p of keyPoints) {
      const v = new THREE.Vector3(...p).project(camera);
      const x = (v.x * 0.5 + 0.5) * frame.width;
      const y = (-v.y * 0.5 + 0.5) * frame.height;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    const label = `${frame.width}x${frame.height}`;
    assert.ok(top >= frame.top - 1, `${label}: top ${top.toFixed(0)}`);
    assert.ok(
      bottom <= frame.height - frame.bottom + 1,
      `${label}: bottom ${bottom.toFixed(0)}`,
    );
    assert.ok(
      left >= -1 && right <= frame.width + 1,
      `${label}: sides ${left.toFixed(0)}–${right.toFixed(0)}`,
    );
    // And it uses the room: the field fills the free height or the width.
    const usedH = (bottom - top) / (frame.height - frame.top - frame.bottom);
    const usedW = (right - left) / frame.width;
    assert.ok(
      Math.max(usedH, usedW) > 0.93,
      `${label}: uses ${usedH.toFixed(2)} / ${usedW.toFixed(2)}`,
    );
    // Phones keep the steep view down the field; wide screens look across
    // it (2 October 2026), where the field is drawn far larger.
    if (frame.width < frame.height) {
      assert.equal(lens.elevation, 70);
      assert.ok(!lens.side, `${label} looks down the field`);
    }
    if (frame.width / frame.height > 1.7) {
      assert.ok(lens.side, `${label} looks across the field`);
      const length = (c) => {
        const cam2 = new THREE.PerspectiveCamera(
          c.fov,
          frame.width / frame.height,
          0.5,
          500,
        );
        cam2.position.set(...c.position);
        cam2.lookAt(new THREE.Vector3(...c.target));
        cam2.updateMatrixWorld();
        const [a, b] = [13, -13].map((z) => {
          const v = new THREE.Vector3(0, 0, z).project(cam2);
          return [v.x * frame.width, v.y * frame.height];
        });
        return Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
      };
      const down = fitCamera(frame, { elevation: 42, fov: 36, wide: 1 });
      assert.ok(
        length(cam) > length(down) * 1.4,
        `${label}: king to king ${length(cam).toFixed(0)} px, not ${length(down).toFixed(0)}`,
      );
    }
    // Level on both sides: the field is centred across the screen.
    assert.ok(
      Math.abs(left + right - frame.width) < 2,
      `${label}: off-centre ${left.toFixed(0)}–${right.toFixed(0)}`,
    );
    const flipped = mirrorCamera(cam);
    assert.deepEqual(flipped.position, [
      -cam.position[0],
      cam.position[1],
      -cam.position[2],
    ]);
  }
});

// Troops walking round their own towers (27 September 2026): heading
// straight through a tower's centre used to cancel every step against the
// push-out, so a troop dropped right behind its small tower stood there for
// good. Each troop must reach its bridge within its straight walk × 1.6 + 2 s.
await test('troops walk round their own towers to the bridge', async () => {
  const { DEPLOY_TIME, flipY } = await import('../lib/games/arena/engine.ts');
  const kinds = ['imps', 'duelist', 'ogre', 'archers', 'mage', 'ranger'];
  // Side 0 spots; side 1 plays them mirrored across the river.
  const spots = [
    ['behind left', 3.5, 4.5],
    ['far behind left', 3.5, 2.5],
    ['behind-inside left', 4.8, 4.8],
    ['inside left', 5.3, 6.5],
    ['outside left', 1.6, 6.5],
    ['behind right', 14.5, 4.5],
    ['far behind right', 14.5, 2.5],
    ['behind-inside right', 13.2, 4.8],
    ['inside right', 12.7, 6.5],
    ['beside the king', 6.6, 3],
    ['behind the king', 10, 0.7],
  ];
  const late = [];
  for (const side of [0, 1])
    for (const [name, x, y] of spots)
      for (const kind of kinds) {
        const m = battle(11);
        m.players[side].elixir = 10;
        const played = deploy(
          m,
          side,
          give(m, side, kind),
          x,
          side ? flipY(y) : y,
        );
        assert.ok(played.ok, `${kind} ${name}`);
        const walks = played.ids.map((id) => {
          const u = m.units.find((v) => v.id === id);
          const bx = u.x < 9 ? BRIDGES[0] : BRIDGES[1];
          const by = side ? RIVER[1] : RIVER[0];
          const straight =
            dist(bx - u.x, by - u.y) / troopCards[kind].unit.speed;
          return { id, limit: DEPLOY_TIME + straight * 1.6 + 2, at: null };
        });
        const start = m.time;
        while (walks.some((w) => w.at === null) && m.time - start < 40) {
          step(m);
          for (const w of walks) {
            const u = m.units.find((v) => v.id === w.id);
            if (w.at === null && (side ? u.y <= RIVER[1] : u.y >= RIVER[0]))
              w.at = m.time - start;
          }
        }
        for (const w of walks)
          if (w.at === null || w.at > w.limit)
            late.push(
              `side ${side} ${kind} ${name}: ${w.at === null ? 'never' : w.at.toFixed(1) + ' s'} (limit ${w.limit.toFixed(1)} s)`,
            );
      }
  assert.deepEqual(late, []);
});

await test('a card dropped on an illegal spot goes to the nearest legal one', async () => {
  const { nearestLegal } = await import('../lib/games/arena/engine.ts');
  const m = battle();
  // A legal spot stays where it is (on the half-tile grid).
  assert.deepEqual(nearestLegal(m, 0, 'duelist', 9.2, 9.9), [9, 10]);
  // Over the river or the enemy half: pulled back to the edge of your half.
  assert.deepEqual(nearestLegal(m, 0, 'duelist', 9, 16), [9, 14.5]);
  assert.deepEqual(nearestLegal(m, 0, 'duelist', 6.1, 25), [6, 14.5]);
  assert.deepEqual(nearestLegal(m, 1, 'duelist', 9, 16), [9, 17.5]);
  // On a standing tower: to the nearest spot just off it.
  for (const side of [0, 1]) {
    const king = m.towers.find((t) => t.side === side && t.kind === 'king');
    for (const t of m.towers.filter((t) => t.side === side)) {
      const spot = nearestLegal(m, side, 'imps', t.x + 0.1, t.y + 0.1);
      assert.ok(spot && canDeployAt(m, side, spot[0], spot[1]));
      assert.ok(
        dist(spot[0] - t.x, spot[1] - t.y) <= t.radius + 1,
        `${t.kind}: ${spot.join(', ')}`,
      );
    }
    assert.ok(king);
  }
  // Off the field: clamped inside it.
  assert.deepEqual(nearestLegal(m, 0, 'archers', -3, -2), [0.5, 0.5]);
  // Spells land anywhere on the field, towers included.
  assert.deepEqual(nearestLegal(m, 0, 'meteor', 9, 29), [9, 29]);
  assert.deepEqual(nearestLegal(m, 0, 'meteor', 30, 40), [17.5, 31.5]);
  // Once an enemy small tower falls, its pocket counts as legal.
  const left = m.towers.find((t) => t.side === 1 && t.lane === 0);
  left.hp = 0;
  left.destroyed = true;
  assert.deepEqual(nearestLegal(m, 0, 'duelist', 4, 20), [4, 20]);
  assert.deepEqual(nearestLegal(m, 0, 'duelist', 4, 24), [4, 21.5]);
  // Every result is legal and no farther than the point itself would be
  // from any other legal spot on the grid.
  for (let i = 0; i < 200; i++) {
    const x = ((i * 37) % 200) / 10 - 1;
    const y = ((i * 53) % 340) / 10 - 1;
    const spot = nearestLegal(m, 0, 'ogre', x, y);
    assert.ok(spot && canPlayAt(m, 0, 'ogre', spot[0], spot[1]));
  }
});

// Dinos at the bridges (27 September 2026): two of a side arriving side by
// side pushed each other off the bridge line into the bank for good, and
// Dinos of both sides meeting head-on (they only hit towers) shoved evenly
// forever. Each must start on a tower within its walk × 1.6 + 2 s.
await test('Dinos queue and pass each other at the bridges', async () => {
  const { DEPLOY_TIME, flipY } = await import('../lib/games/arena/engine.ts');
  const drops = [];
  for (const lane of BRIDGES) {
    for (const side of [0, 1])
      for (const [a, b, y] of [
        [-0.5, 0.5, 10],
        [-1.5, 1.5, 9],
        [0, 0.5, 12],
      ])
        drops.push([
          `side ${side} pair ${a}/${b} lane ${lane}`,
          [
            [side, lane + a, y],
            [side, lane + b, y],
          ],
        ]);
    drops.push(
      [
        `head-on lane ${lane}`,
        [
          [0, lane, 10],
          [1, lane, 10],
        ],
      ],
      [
        `head-on lane ${lane}, one ahead`,
        [
          [0, lane, 9],
          [1, lane, 12],
        ],
      ],
      [
        `two a side lane ${lane}`,
        [
          [0, lane - 0.5, 10],
          [0, lane + 0.5, 10],
          [1, lane - 0.5, 10],
          [1, lane + 0.5, 10],
        ],
      ],
    );
  }
  const late = [];
  for (const [name, spots] of drops) {
    const m = battle(3);
    const walks = spots.map(([side, x, y]) => {
      m.players[side].elixir = 10;
      const played = deploy(
        m,
        side,
        give(m, side, 'ogre'),
        x,
        side ? flipY(y) : y,
      );
      assert.ok(played.ok, name);
      const u = m.units.find((v) => v.id === played.ids[0]);
      const t = tower(m, 1 - side, 'princess', u.x < 9 ? 0 : 1);
      const walk = dist(t.x - u.x, t.y - u.y) - t.radius - 1.15;
      return {
        id: u.id,
        side,
        limit: DEPLOY_TIME + (walk / troopCards.ogre.unit.speed) * 1.6 + 2,
        at: null,
      };
    });
    const start = m.time;
    while (walks.some((w) => w.at === null) && m.time - start < 60) {
      step(m);
      m.events.length = 0;
      for (const w of walks) {
        const u = m.units.find((v) => v.id === w.id);
        if (w.at === null && u?.state === 'attacking') w.at = m.time - start;
      }
    }
    for (const w of walks)
      if (w.at === null || w.at > w.limit)
        late.push(
          `${String(name)}, side ${String(w.side)}: ${w.at === null ? 'never' : w.at.toFixed(1) + ' s'} (limit ${w.limit.toFixed(1)} s)`,
        );
  }
  assert.deepEqual(late, []);
});

await test('troops grow on every screen and portrait phones retain their extra size', async () => {
  const { lensFor, troopScale } = await import('../lib/games/arena/layout.ts');
  const phone = lensFor({ width: 390, height: 844, top: 60, bottom: 170 });
  const desk = lensFor({ width: 1440, height: 900, top: 60, bottom: 160 });
  // 18%, then another 15% on 2 October 2026.
  assert.ok(troopScale(phone, true) >= 3 && troopScale(phone, true) <= 3.25);
  assert.ok(troopScale(desk, false) > 2.3 && troopScale(desk, false) < 2.45);
  assert.equal(troopScale(desk, true), troopScale(desk, false));
  assert.ok(troopScale(phone, false) < troopScale(phone, true));
});

// Lanes (27 September 2026, William: "I clearly place my person to the left
// and they still end up going on the right lane"). Every troop of a card
// keeps the lane of the spot it was dropped on, and a lane whose small tower
// fell leads to the king by its own bridge, never over to the other lane.
await test('troops keep the lane they were dropped in', () => {
  const crossing = (m, ids) => {
    const at = new Map();
    for (let i = 0; i < 30 * 30 && at.size < ids.length; i++) {
      step(m);
      for (const id of ids) {
        const u = m.units.find((v) => v.id === id);
        if (u && !at.has(id) && u.y >= RIVER[0]) at.set(id, u.x);
      }
    }
    return ids.map((id) => at.get(id));
  };
  // Three Robots dropped just left of the middle: the right-hand one stands
  // over the middle line but walks the left lane with the others.
  let m = battle(21);
  m.players[0].elixir = 10;
  let { ids } = deploy(m, 0, give(m, 0, 'imps'), 8.7, 9);
  assert.ok(
    m.units.some((u) => ids.includes(u.id) && u.x > 9),
    'one robot starts right of the middle',
  );
  for (const x of crossing(m, ids))
    assert.ok(
      Math.abs(x - BRIDGES[0]) <= BRIDGE_HALF + 0.05,
      `crossed at ${x}`,
    );
  // The left small tower down: a Samurai dropped on the left goes on over
  // the left bridge towards the king.
  m = battle(22);
  tower(m, 1, 'princess', 0).hp = 0;
  tower(m, 1, 'princess', 0).destroyed = true;
  m.players[0].elixir = 10;
  ({ ids } = deploy(m, 0, give(m, 0, 'duelist'), 3, 4));
  const [x] = crossing(m, ids);
  assert.ok(Math.abs(x - BRIDGES[0]) <= BRIDGE_HALF + 0.05, `crossed at ${x}`);
  const samurai = m.units.find((u) => u.id === ids[0]);
  assert.equal(
    m.towers.find((t) => t.id === samurai.targetId)?.kind ?? 'king',
    'king',
  );
});

// The placement warning (27 September 2026): what would shoot a troop
// dropped at a spot.
await test('the placement warning names what would shoot a dropped troop', async () => {
  const { threatsAt } = await import('../lib/games/arena/engine.ts');
  const m = battle(31);
  const left = tower(m, 1, 'princess', 0);
  const king = tower(m, 1, 'king');
  // Deep in your half nothing reaches.
  assert.deepEqual(threatsAt(m, 0, 'duelist', 3.5, 5), []);
  // Just short of the enemy's left small tower once its pocket opens: in
  // its range, the sleeping king's not.
  left.hp = 1;
  const near = threatsAt(m, 0, 'duelist', left.x, left.y - 7);
  assert.deepEqual(
    near.map((t) => t.id),
    [left.id],
  );
  king.active = true;
  assert.ok(
    threatsAt(m, 0, 'duelist', 9, king.y - 7.2).some((t) => t.id === king.id),
  );
  // An enemy Samurai reaches ground troops beside it, never a Biplane.
  m.players[1].elixir = 10;
  const [id] = deploy(m, 1, give(m, 1, 'duelist'), 9, 17.5).ids;
  const samurai = m.units.find((u) => u.id === id);
  samurai.y = 13;
  assert.ok(threatsAt(m, 0, 'imps', 9, 12).some((t) => t.id === id));
  assert.ok(!threatsAt(m, 0, 'drake', 9, 12).some((t) => t.id === id));
  // Spells threaten nothing.
  assert.deepEqual(threatsAt(m, 0, 'meteor', 9, 12), []);
});

// The pacer (27 September 2026): phones start at their best and step down
// only as far as frames slip, then climb back without hunting.
await test('the pacer steps down under load, climbs back and does not hunt', async () => {
  const { Pacer, ladder } = await import('../components/game/arena/pacer.ts');
  const rungs = ladder(4096, 0.4);
  assert.equal(rungs[0].resolution, 1);
  assert.equal(rungs[0].shadowEvery, 1);
  assert.ok(rungs.at(-1).resolution >= 0.4 - 1e-9);
  const seen = [];
  const pacer = new Pacer(rungs, (r) => seen.push(r));
  let now = 1000;
  /** Run `ms` of a 60 Hz screen where a frame takes `cost` ms to draw. */
  const run = (ms, cost) => {
    const end = now + ms;
    while (now < end) {
      now += Math.max(16.7, cost());
      pacer.frame(now);
    }
  };
  // Heavy: every other frame misses its slot.
  let n = 0;
  run(8000, () => (n++ % 2 ? 33.4 : 16.7));
  const low = pacer.level;
  assert.ok(low >= 2, `stepped down to ${low}`);
  // Room again: it climbs back to the top.
  run(40000, () => 16.7);
  assert.equal(pacer.level, 0);
  // A device that slips only at the top rung settles one below and does
  // not keep retrying it every few seconds.
  const changes = () => seen.length;
  const cost = () => (pacer.level === 0 ? (n++ % 2 ? 33.4 : 16.7) : 16.7);
  run(6000, cost);
  const before = changes();
  run(15000, cost);
  assert.ok(changes() - before <= 2, `${changes() - before} changes in 15 s`);
  assert.equal(pacer.level, 1);
});

await test('a troop pursues its existing enemy through a walk tick beside a nearer tower', () => {
  const m = battle();
  const a = deploy(m, 0, give(m, 0, 'duelist'), 9, 12);
  const b = deploy(m, 1, give(m, 1, 'ranger'), 9, 20);
  assert.ok(a.ok && b.ok);
  const attacker = m.units.find((u) => u.id === a.ids[0]);
  const enemy = m.units.find((u) => u.id === b.ids[0]);
  const nearerTower = tower(m, 1, 'princess', 0);
  attacker.x = nearerTower.x;
  attacker.y = nearerTower.y - 2;
  enemy.x = nearerTower.x + 3;
  enemy.y = nearerTower.y - 2;
  attacker.state = 'walking';
  enemy.state = 'walking';
  attacker.targetId = enemy.id;
  step(m);
  assert.equal(
    attacker.targetId,
    enemy.id,
    'crowd movement does not steal the troop lock',
  );
  enemy.hp = 0;
  step(m);
  assert.notEqual(attacker.targetId, enemy.id, 'a dead target is released');
});

await test('a target that leaves sight can be released for a nearby enemy', () => {
  const m = battle();
  const a = deploy(m, 0, give(m, 0, 'duelist'), 9, 12);
  const b = deploy(m, 1, give(m, 1, 'ranger'), 9, 20);
  assert.ok(a.ok && b.ok);
  const attacker = m.units.find((u) => u.id === a.ids[0]);
  const enemy = m.units.find((u) => u.id === b.ids[0]);
  attacker.state = 'walking';
  enemy.state = 'walking';
  attacker.targetId = enemy.id;
  step(m);
  assert.notEqual(attacker.targetId, enemy.id);
});

await test('towers stand taller than the troops, larger still on portrait phones', async () => {
  const { lensFor, towerScale, troopScale } =
    await import('../lib/games/arena/layout.ts');
  const wide = lensFor({ width: 1280, height: 800, top: 56, bottom: 150 });
  const phone = lensFor({ width: 390, height: 844, top: 60, bottom: 170 });
  // A model at 1.0 fills its footprint; both are drawn at least that size.
  assert.ok(towerScale(wide) >= 1);
  assert.ok(towerScale(phone) > towerScale(wide));
  // The troops grow on phones too, the towers keep ahead of them.
  assert.ok(
    towerScale(phone) / towerScale(wide) >=
      (troopScale(phone, true) / troopScale(wide, false)) * 0.9,
  );
});
