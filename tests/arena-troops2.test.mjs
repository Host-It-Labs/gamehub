import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allCards,
  allTroops,
  cards,
  troopCards,
  troopDeck,
  validDeck,
} from '../lib/games/arena/cards.ts';
import {
  TICK,
  createMatch,
  deploy,
  dist,
  step,
  summon,
} from '../lib/games/arena/engine.ts';
import { checksum } from '../lib/games/arena/net.ts';
import { botMemory, botStep } from '../lib/games/arena/bot.ts';
import { presets } from '../lib/games/arena/decks.ts';
import { LOCKED, STARTING_POOL } from '../lib/games/arena/quest.ts';

const NEW = [
  'diver',
  'sumo',
  'linebacker',
  'beekeeper',
  'drummer',
  'firefighter',
  'jetpack',
  'explorer',
];

/** A match in battle with sleeping towers, so only the troops act. */
function scene() {
  const m = createMatch(7, 'medium', 'duel');
  m.phase = 'battle';
  m.time = 10;
  for (const p of m.players) p.elixir = 10;
  for (const t of m.towers) t.active = false;
  return m;
}
/** A troop already standing on the field. */
function ready(m, player, card, x, y) {
  const u = summon(m, player, card, x, y);
  u.state = 'walking';
  u.deployLeft = 0;
  return u;
}
/** Runs whole ticks, collecting every event. */
function run(m, seconds) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += TICK) {
    step(m);
    events.push(...m.events);
    m.events.length = 0;
  }
  return events;
}

await test('eight new troop cards join the collection; the Bee is no card', () => {
  for (const id of NEW) {
    assert.ok(allCards.includes(id), id);
    assert.equal(cards[id].kind, 'troop');
    assert.ok(cards[id].cost >= 3 && cards[id].cost <= 6, id);
    assert.ok(troopCards[id].tags.length, id);
  }
  assert.equal(cards.sumo.cost, 6);
  assert.equal(cards.linebacker.cost, 3);
  for (const id of ['diver', 'sumo', 'linebacker'])
    assert.ok(troopCards[id].tags.includes('tank'), id);
  assert.ok(!allCards.includes('bee'));
  assert.ok(!allTroops.includes('bee'));
  assert.ok(troopDeck.includes('bee'), 'the renderer still needs its model');
  assert.ok(troopCards.bee.token);
  assert.ok(!validDeck(['bee', 'imps', 'archers', 'pirate', 'meteor']));
  // Every new card is in some ready-made deck, and most start in Quest.
  for (const id of NEW)
    assert.ok(
      presets.some((p) => p.cards.includes(id)),
      `${id} in no preset`,
    );
  for (const p of presets) assert.ok(validDeck(p.cards), p.id);
  const open = NEW.filter((id) => STARTING_POOL.includes(id));
  assert.ok(open.length >= 6, 'most new cards start in the Quest pool');
  for (const id of ['diver', 'linebacker'])
    assert.ok(STARTING_POOL.includes(id), id);
  for (const id of LOCKED) assert.ok(!STARTING_POOL.includes(id));
});

await test('the Diver’s armour takes a flat bite out of every hit, never all of it', () => {
  const m = scene();
  const diver = ready(m, 1, 'diver', 9, 12);
  const armour = troopCards.diver.unit.armour;
  const samurai = ready(m, 0, 'duelist', 9, 10.6);
  const events = run(m, 1);
  const hit = events.find((e) => e.type === 'hit' && e.id === diver.id);
  assert.ok(hit, 'the Samurai hit him');
  const blow = troopCards.duelist.unit.damage;
  assert.equal(hit.damage, blow - armour.flat);
  assert.equal(hit.armour, armour.flat);
  assert.equal(diver.hp, diver.maxHp - (blow - armour.flat));
  // A bee's sting is smaller than the armour: a quarter of it still lands.
  samurai.hp = 0;
  run(m, TICK);
  const before = diver.hp;
  ready(m, 0, 'bee', 9, 11.2);
  const stings = run(m, 1).filter((e) => e.type === 'hit' && e.id === diver.id);
  assert.ok(stings.length >= 1);
  const sting = troopCards.bee.unit.damage;
  assert.equal(stings[0].damage, Math.round(sting * armour.min));
  assert.equal(stings[0].armour, sting - Math.round(sting * armour.min));
  assert.ok(diver.hp < before);
});

await test('the Sumo’s landing stomp turns nearby troops on him', () => {
  const m = scene();
  const cadet = ready(m, 1, 'archers', 9, 14);
  const robot = ready(m, 0, 'imps', 12.5, 11);
  run(m, 0.2);
  assert.equal(cadet.targetId, robot.id, 'the Cadet aims at the Robot');
  const sumo = summon(m, 0, 'sumo', 8, 11);
  const events = run(m, 1.05);
  const taunt = events.find((e) => e.type === 'taunt');
  assert.ok(taunt, 'a stomp on landing');
  assert.equal(taunt.id, sumo.id);
  assert.deepEqual(taunt.ids, [cadet.id]);
  assert.equal(cadet.tauntId, sumo.id);
  assert.ok(cadet.taunt > 0);
  assert.equal(cadet.targetId, sumo.id, 'now it fights the Sumo');
  // The taunt runs out; the troop is free again.
  run(m, troopCards.sumo.unit.taunt.seconds + 0.1);
  assert.equal(cadet.taunt, 0);
  assert.equal(cadet.tauntId, null);
});

await test('the Sumo’s slaps push troops back; heavy ones stand', () => {
  const m = scene();
  const sumo = ready(m, 0, 'sumo', 9, 10);
  const pirate = ready(m, 1, 'pirate', 9, 11.4);
  pirate.stun = 3;
  const y0 = pirate.y;
  const events = run(m, 0.75);
  const push = events.find((e) => e.type === 'push' && e.id === pirate.id);
  assert.ok(push, 'slapped back');
  assert.equal(push.from, sumo.id);
  assert.ok(pirate.y > y0 + 0.5, `pushed from ${y0} to ${pirate.y}`);
  const m2 = scene();
  ready(m2, 0, 'sumo', 9, 10);
  const dino = ready(m2, 1, 'ogre', 9, 11.8);
  dino.stun = 3;
  const e2 = run(m2, 0.75);
  assert.ok(!e2.some((e) => e.type === 'push'), 'the Dino is too heavy');
});

await test('the Linebacker tackles each new target once: knocked back and stunned', () => {
  const m = scene();
  const lb = ready(m, 0, 'linebacker', 9, 10);
  const cadet = ready(m, 1, 'archers', 9, 12);
  cadet.stun = 0.3;
  const events = [];
  let y0 = 0;
  for (let t = 0; t < 4; t += TICK) {
    y0 = cadet.y;
    step(m);
    events.push(...m.events);
    const tackle = m.events.find((e) => e.type === 'tackle');
    m.events.length = 0;
    if (tackle) {
      assert.equal(tackle.id, lb.id);
      assert.equal(tackle.target, cadet.id);
      assert.ok(cadet.stun > 0.5, 'stunned');
      assert.ok(cadet.y > y0 + 1, 'knocked back');
    }
  }
  assert.equal(events.filter((e) => e.type === 'tackle').length, 1);
  assert.ok(
    events.filter((e) => e.type === 'hit' && e.id === cadet.id).length >= 2,
    'it fights on with plain blows',
  );
  // A new target is tackled again.
  const robot = ready(m, 1, 'imps', lb.x + 1.1, lb.y);
  const later = run(m, 3);
  if (cadet.hp > 0) cadet.hp = 0;
  assert.ok(
    later.some((e) => e.type === 'tackle' && e.target === robot.id) ||
      robot.hp <= 0,
  );
});

await test('the Beekeeper releases bees every few seconds; bees fly and sting', () => {
  const m = scene();
  const keeper = summon(m, 0, 'beekeeper', 9, 8);
  const spawn = troopCards.beekeeper.unit.spawn;
  const events = run(m, 1 + spawn.first + spawn.every + 0.1);
  const releases = events.filter((e) => e.type === 'spawn');
  assert.equal(releases.length, 2);
  for (const r of releases) {
    assert.equal(r.id, keeper.id);
    assert.equal(r.card, 'bee');
    assert.equal(r.ids.length, spawn.count);
  }
  const bees = m.units.filter((u) => u.card === 'bee');
  assert.equal(bees.length, spawn.count * 2);
  for (const b of bees) {
    assert.equal(b.side, 0);
    assert.equal(b.owner, 0);
    assert.ok(troopCards[b.card].unit.flying);
  }
  // She never attacks; her bees go for what they can reach, flyers too.
  assert.ok(!events.some((e) => e.type === 'swing' && e.id === keeper.id));
  const m2 = scene();
  ready(m2, 0, 'bee', 9, 12);
  const plane = ready(m2, 1, 'drake', 9, 13.5);
  plane.stun = 5;
  const e2 = run(m2, 1.5);
  assert.ok(e2.some((e) => e.type === 'hit' && e.id === plane.id));
});

await test('the Drummer’s beat makes friends nearby move and strike faster', () => {
  const m = scene();
  const drummer = ready(m, 0, 'drummer', 9, 8);
  const near = ready(m, 0, 'duelist', 9.6, 8.5);
  const far = ready(m, 0, 'duelist', 3, 8.5);
  const n0 = [near.x, near.y];
  const f0 = [far.x, far.y];
  const events = run(m, 0.6);
  const boost = troopCards.drummer.unit.aura.boost;
  assert.equal(near.beat, boost);
  assert.equal(far.beat, 1);
  assert.equal(drummer.beat, 1, 'not himself');
  const dn = dist(near.x - n0[0], near.y - n0[1]);
  const df = dist(far.x - f0[0], far.y - f0[1]);
  assert.ok(dn > df * 1.2, `near ${dn} vs far ${df}`);
  assert.ok(events.some((e) => e.type === 'beat' && e.id === drummer.id));
  assert.ok(!events.some((e) => e.type === 'swing' && e.id === drummer.id));
  // Blows too: a beaten Samurai lands more of them in the same time.
  const hits = (withDrum) => {
    const s = scene();
    const tank = ready(s, 1, 'ogre', 9, 12);
    tank.stun = 99;
    tank.hp = tank.maxHp = 1e6;
    ready(s, 0, 'duelist', 9, 10.5);
    if (withDrum) ready(s, 0, 'drummer', 8, 10);
    return run(s, 8).filter((e) => e.type === 'hit' && e.id === tank.id).length;
  };
  assert.ok(hits(true) > hits(false), 'more blows with the beat');
});

await test('the Firefighter’s jet hits a cone of ground troops and pushes them back', () => {
  const m = scene();
  const ff = ready(m, 0, 'firefighter', 9, 10);
  const front = ready(m, 1, 'imps', 9, 12.2);
  const side = ready(m, 1, 'imps', 9.7, 12.4);
  const behind = ready(m, 1, 'imps', 9, 7.6);
  const flyer = ready(m, 1, 'jetpack', 9, 12.6);
  for (const u of [front, side, behind, flyer]) u.stun = 5;
  const y0 = [front.y, side.y];
  const events = run(m, troopCards.firefighter.unit.firstHit + 2 * TICK);
  const spray = events.find((e) => e.type === 'spray');
  assert.ok(spray, 'a jet');
  assert.equal(spray.id, ff.id);
  assert.ok(spray.ty > spray.y, 'aimed up the field');
  assert.ok(front.hp < front.maxHp && side.hp < side.maxHp, 'both soaked');
  assert.ok(front.y > y0[0] && side.y > y0[1], 'both pushed back');
  assert.equal(behind.hp, behind.maxHp, 'not behind her');
  assert.equal(flyer.hp, flyer.maxHp, 'not flyers');
  // Steady: it keeps spraying.
  const more = run(m, 1.2).filter((e) => e.type === 'spray');
  assert.ok(more.length >= 2);
});

await test('the Explorer’s frost slows the target’s steps and blows', () => {
  const m = scene();
  ready(m, 0, 'explorer', 9, 8);
  const samurai = ready(m, 1, 'duelist', 9, 12.8);
  const slow = troopCards.explorer.unit.slow;
  let moved = null;
  for (let t = 0; t < 3 && moved === null; t += TICK) {
    step(m);
    const chilled = m.events.some(
      (e) => e.type === 'slow' && e.id === samurai.id,
    );
    m.events.length = 0;
    if (chilled) {
      assert.ok(samurai.slow > 0);
      assert.equal(samurai.slowFactor, slow.factor);
      step(m);
      m.events.length = 0;
      moved = dist(samurai.x - samurai.px, samurai.y - samurai.py);
    }
  }
  assert.ok(moved !== null, 'frost landed');
  const full = troopCards.duelist.unit.speed * TICK;
  assert.ok(moved < full * (slow.factor + 0.1), `${moved} of ${full}`);
  // It wears off.
  samurai.stun = 0;
  for (const u of m.units) if (u.card === 'explorer') u.hp = 0;
  run(m, slow.seconds + 0.2);
  assert.equal(samurai.slow, 0);
  assert.equal(samurai.slowFactor, 1);
});

await test('the Jetpack flies: ground-only troops cannot touch her, she shoots them', () => {
  const m = scene();
  const jet = ready(m, 1, 'jetpack', 9, 13);
  const samurai = ready(m, 0, 'duelist', 9, 11);
  assert.ok(troopCards.jetpack.unit.flying);
  const events = run(m, 1.5);
  assert.notEqual(samurai.targetId, jet.id);
  assert.equal(jet.hp, jet.maxHp);
  assert.ok(events.some((e) => e.type === 'shot' && e.id === jet.id));
  assert.ok(samurai.hp < samurai.maxHp);
});

/** A whole bot match, returning its checksum at the end. */
function botMatch(seed, decks, mode = 'duel') {
  const m = createMatch(seed, 'hard', mode, { decks });
  const bots = m.players.map((_, p) => botMemory(p, 'hard', seed));
  let guard = 0;
  const played = new Set();
  while (m.phase !== 'over' && guard++ < 30 * 300) {
    for (const mem of bots) {
      const move = botStep(m, mem);
      if (!move) continue;
      const card = m.players[move.player].hand.cards[move.slot];
      const r = deploy(m, move.player, move.slot, move.x, move.y);
      assert.ok(r.ok, `${card}: ${r.reason}`);
      played.add(card);
    }
    step(m);
    m.events.length = 0;
    for (const u of m.units)
      assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y), u.card);
  }
  assert.equal(m.phase, 'over');
  return { sum: checksum(m), tick: m.tick, played };
}

await test('the same seed and cards give the same battle, bees and all', () => {
  const deep = presets.find((p) => p.id === 'deep').cards;
  const dojo = presets.find((p) => p.id === 'dojo').cards;
  const blitz = presets.find((p) => p.id === 'blitz').cards;
  const frost = presets.find((p) => p.id === 'frost').cards;
  const a = botMatch(11, [deep, dojo]);
  const b = botMatch(11, [deep, dojo]);
  assert.equal(a.sum, b.sum);
  assert.equal(a.tick, b.tick);
  const c = botMatch(12, [deep, dojo]);
  assert.notEqual(a.sum, c.sum);
  const t1 = botMatch(5, [blitz, frost, frost, blitz], 'team');
  const t2 = botMatch(5, [blitz, frost, frost, blitz], 'team');
  assert.equal(t1.sum, t2.sum);
  const played = new Set([...a.played, ...c.played, ...t1.played]);
  for (const id of NEW) assert.ok(played.has(id), `${id} never played`);
});
