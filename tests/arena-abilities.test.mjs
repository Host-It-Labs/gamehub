import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allCards,
  cards,
  deck,
  troopCards,
  validDeck,
} from '../lib/games/arena/cards.ts';
import {
  OVERTIME,
  TICK,
  advance,
  canDeployAt,
  canPlayAt,
  clock,
  createMatch,
  deploy,
  step,
  summon,
} from '../lib/games/arena/engine.ts';
import { checksum } from '../lib/games/arena/net.ts';

/** A match in battle with nothing on the field and full elixir. */
function battle(options) {
  const m = createMatch(7, 'medium', 'duel', options);
  m.phase = 'battle';
  m.time = 10;
  for (const p of m.players) p.elixir = 10;
  return m;
}
/** A troop already standing on the field. */
function ready(m, player, card, x, y) {
  const u = summon(m, player, card, x, y);
  u.state = 'walking';
  u.deployLeft = 0;
  return u;
}
const run = (m, seconds) => {
  for (let t = 0; t < seconds; t += TICK) step(m);
};

await test('twenty-three troops and the Meteor make the collection', () => {
  assert.equal(allCards.length, 24);
  assert.equal(new Set(allCards).size, 24);
  for (const id of allCards) assert.ok(cards[id].name && cards[id].cost > 0);
  assert.ok(validDeck(deck));
  assert.ok(!validDeck([...deck, 'pirate']), 'nine cards');
  assert.ok(!validDeck(['archers', 'archers', 'imps', 'ogre', 'mage']));
  assert.ok(!validDeck(['archers', 'imps', 'ogre', 'mage']), 'too few');
  assert.ok(!validDeck(['archers', 'imps', 'ogre', 'mage', 'knight']));
});

await test('each player can bring their own deck', () => {
  const mine = ['pirate', 'viking', 'gladiator', 'medic', 'miner', 'balloon'];
  const m = createMatch(3, 'medium', 'duel', { decks: [mine] });
  const held = [...m.players[0].hand.cards, ...m.players[0].hand.queue];
  assert.deepEqual([...held].sort(), [...mine].sort());
  assert.deepEqual(
    [...m.players[1].hand.cards, ...m.players[1].hand.queue].sort(),
    [...deck].sort(),
  );
});

await test('a shorter battle keeps its own clock and double elixir minute', () => {
  const m = createMatch(3, 'medium', 'duel', { regulation: 120 });
  assert.equal(clock(m), 120);
  advance(m, 1.05);
  m.time = 61;
  const before = m.players[0].elixir;
  step(m);
  assert.ok(m.players[0].elixir - before > (1 / 2.8) * TICK * 1.5);
  m.time = 120;
  step(m);
  assert.equal(m.phase, 'overtime');
  m.time = 120 + OVERTIME;
  step(m);
  assert.equal(m.phase, 'over');
});

await test('the Pirate leaps at a troop in reach and lands a double blow', () => {
  const m = battle();
  const pirate = ready(m, 0, 'pirate', 9, 10);
  const foe = ready(m, 1, 'gladiator', 9, 12.8);
  foe.shield = 0;
  foe.hp = foe.maxHp = 5000;
  foe.pace = 0;
  let leapt = false;
  let first = 0;
  for (let i = 0; i < 90 && !first; i++) {
    step(m);
    if (m.events.some((e) => e.type === 'leap' && e.id === pirate.id))
      leapt = true;
    const hit = m.events.find((e) => e.type === 'hit' && e.id === foe.id);
    if (hit) first = hit.damage;
    m.events.length = 0;
  }
  assert.ok(leapt, 'it leapt');
  assert.equal(first, troopCards.pirate.unit.damage * 2);
  // The next blow is a plain one.
  let second = 0;
  for (let i = 0; i < 60 && !second; i++) {
    step(m);
    const hit = m.events.find((e) => e.type === 'hit' && e.id === foe.id);
    if (hit) second = hit.damage;
    m.events.length = 0;
  }
  assert.equal(second, troopCards.pirate.unit.damage);
});

await test('the Viking hits everyone around him and rages when hurt', () => {
  const m = battle();
  const viking = ready(m, 0, 'viking', 9, 10);
  const a = ready(m, 1, 'imps', 9, 11);
  const b = ready(m, 1, 'imps', 10.1, 10);
  const c = ready(m, 1, 'imps', 7.9, 10);
  for (const u of [a, b, c]) u.pace = 0;
  run(m, 1.2);
  for (const u of [a, b, c]) assert.ok(u.hp <= 0 || u.hp < u.maxHp, u.id);
  viking.hp = viking.maxHp * 0.4;
  m.events.length = 0;
  step(m);
  assert.ok(viking.raged);
});

await test('the Gladiator’s shield takes the hits before his hit points', () => {
  const m = battle();
  const g = ready(m, 0, 'gladiator', 9, 10);
  const shield = g.shield;
  assert.equal(shield, troopCards.gladiator.unit.shield);
  const foe = ready(m, 1, 'duelist', 9, 11);
  foe.pace = 0;
  let broke = false;
  for (let i = 0; i < 200 && !broke; i++) {
    step(m);
    broke = m.events.some((e) => e.type === 'shield' && e.id === g.id);
    m.events.length = 0;
  }
  assert.ok(broke, 'the shield broke');
  // The Samurai's 720 blow broke a 650 shield without touching hit points.
  assert.equal(g.hp, g.maxHp);
  assert.equal(g.shield, 0);
});

await test('the Medic heals troops around her and never attacks', () => {
  const m = battle();
  const medic = ready(m, 0, 'medic', 9, 8);
  // The Dino only hits towers, so nothing here fights but the foe.
  const friend = ready(m, 0, 'ogre', 9, 9);
  friend.pace = 0;
  friend.hp = 500;
  const foe = ready(m, 1, 'ogre', 9.6, 6.9);
  foe.pace = 0;
  foe.hp = foe.maxHp = 9999;
  // Towers stand aside so only the Medic could hurt the foe.
  for (const t of m.towers) t.active = false;
  run(m, 2.1);
  assert.ok(friend.hp >= 500 + troopCards.medic.unit.heal.amount * 2 - 1);
  assert.equal(foe.hp, 9999, 'she never hits');
  assert.ok(medic.hp > 0);
});

await test('the Miner may go anywhere on the field and pops up after digging', () => {
  const m = battle();
  // Deep on the other side, next to their small tower but not on it.
  assert.equal(canDeployAt(m, 0, 3.5, 22), false);
  assert.equal(canPlayAt(m, 0, 'miner', 3.5, 23.4), true);
  assert.equal(canPlayAt(m, 0, 'miner', 3.5, 25.5), false, 'not on a tower');
  assert.equal(canPlayAt(m, 0, 'miner', 9, 16), false, 'not in the river');
  m.players[0].hand.cards[0] = 'miner';
  const r = deploy(m, 0, 0, 3.5, 23.4);
  assert.ok(r.ok);
  const u = m.units.find((x) => x.id === r.ids[0]);
  assert.equal(u.deployLeft, troopCards.miner.unit.burrow);
  let emerged = false;
  for (let i = 0; i < 70 && !emerged; i++) {
    step(m);
    emerged = m.events.some((e) => e.type === 'emerge' && e.id === u.id);
    m.events.length = 0;
  }
  assert.ok(emerged);
});

await test('the Balloon crashes onto what is below when it falls', () => {
  const m = battle();
  const balloon = ready(m, 0, 'balloon', 9, 20);
  const below = ready(m, 1, 'imps', 9, 20.5);
  below.pace = 0;
  balloon.hp = 0;
  step(m);
  assert.ok(m.events.some((e) => e.type === 'impact' && e.kind === 'crash'));
  assert.ok(below.hp < below.maxHp);
});

await test('the Inventor’s lightning jumps to three troops and stuns each', () => {
  const m = battle();
  ready(m, 0, 'inventor', 9, 8);
  const foes = [
    ready(m, 1, 'imps', 9, 12),
    ready(m, 1, 'imps', 10.5, 13),
    ready(m, 1, 'imps', 8, 13.5),
    ready(m, 1, 'imps', 16, 14.5),
  ];
  for (const f of foes) {
    f.pace = 0;
    f.hp = f.maxHp = 5000;
  }
  const stunned = new Set();
  for (let i = 0; i < 60; i++) {
    step(m);
    for (const e of m.events) if (e.type === 'stun') stunned.add(e.id);
    m.events.length = 0;
  }
  assert.equal(stunned.size, 3);
  assert.ok(!stunned.has(foes[3].id), 'too far to jump to');
});

await test('the Gunner outranges towers and ignores anything too close', () => {
  const m = battle();
  const gunner = ready(m, 0, 'gunner', 3.5, 14);
  let shotAtTower = false;
  for (let i = 0; i < 30 * 8 && !shotAtTower; i++) {
    step(m);
    shotAtTower = m.projectiles.some(
      (p) => p.sourceId === gunner.id && p.kind === 'shell',
    );
  }
  assert.ok(shotAtTower);
  const tower = m.towers.find((t) => t.side === 1 && t.lane === 0);
  const d = Math.sqrt((gunner.x - tower.x) ** 2 + (gunner.y - tower.y) ** 2);
  assert.ok(d - tower.radius > tower.range, 'out of the tower’s reach');
  // A troop right next to it is never its target.
  const m2 = battle();
  const g2 = ready(m2, 0, 'gunner', 9, 8);
  const close = ready(m2, 1, 'imps', 9, 9.5);
  close.pace = 0;
  run(m2, 2);
  assert.notEqual(g2.targetId, close.id);
});

await test('card levels and boosts raise hit points, damage, towers and elixir', () => {
  const boost = {
    levels: { archers: 3 },
    troopDamage: 1.1,
    towerHp: 1.5,
    elixirStart: 9,
    kingAwake: true,
  };
  const m = createMatch(4, 'medium', 'duel', { boosts: [boost] });
  assert.equal(m.players[0].elixir, 9);
  const king = m.towers.find((t) => t.side === 0 && t.kind === 'king');
  assert.equal(king.maxHp, Math.round(4824 * 1.5));
  assert.ok(king.active);
  const theirs = m.towers.find((t) => t.side === 1 && t.kind === 'king');
  assert.equal(theirs.maxHp, 4824);
  const cadet = summon(m, 0, 'archers', 9, 8);
  assert.equal(cadet.maxHp, Math.round(304 * 1.2));
  assert.ok(Math.abs(cadet.power - 1.2 * 1.1) < 1e-9);
});

await test('a fallen tower refills its side with a Second Wind', () => {
  const m = battle({ boosts: [{ towerElixir: 4 }] });
  m.players[0].elixir = 2;
  const tower = m.towers.find((t) => t.side === 0 && t.kind === 'princess');
  tower.hp = 1;
  ready(m, 1, 'ogre', tower.x, tower.y + tower.radius + 0.9);
  for (let i = 0; i < 90 && !tower.destroyed; i++) step(m);
  assert.ok(tower.destroyed);
  assert.ok(m.players[0].elixir >= 6 - 1e-9);
});

await test('shields and stuns count in the online checksum', () => {
  const m = battle();
  const g = ready(m, 0, 'gladiator', 9, 10);
  const before = checksum(m);
  g.shield -= 1;
  assert.notEqual(checksum(m), before);
});

await test('bots play every ready-made deck to a finish, legally', async () => {
  const { presets } = await import('../lib/games/arena/decks.ts');
  const { botMemory, botStep } = await import('../lib/games/arena/bot.ts');
  const played = new Set();
  presets.forEach((a, i) => {
    const b = presets[(i + 1) % presets.length];
    for (const mode of ['duel', 'team']) {
      const decks =
        mode === 'duel'
          ? [a.cards, b.cards]
          : [a.cards, b.cards, b.cards, a.cards];
      const m = createMatch(31 + i, 'hard', mode, { decks });
      const bots = m.players.map((_, p) => botMemory(p, 'hard', 31 + i));
      let guard = 0;
      while (m.phase !== 'over' && guard++ < 30 * 300) {
        for (const mem of bots) {
          const move = botStep(m, mem);
          if (move) {
            const card = m.players[move.player].hand.cards[move.slot];
            const r = deploy(m, move.player, move.slot, move.x, move.y);
            assert.ok(r.ok, `${card} at ${move.x},${move.y}: ${r.reason}`);
            played.add(card);
          }
        }
        step(m);
        m.events.length = 0;
        for (const u of m.units)
          assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y), u.card);
      }
      assert.equal(m.phase, 'over', `${a.id} v ${b.id} ${mode}`);
    }
  });
  // Every card gets played by some bot.
  for (const id of allCards) assert.ok(played.has(id), `${id} never played`);
});
