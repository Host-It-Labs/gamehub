import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch,
  open,
  step,
  spawnParty,
  actionFor,
  outTarget,
  movePlayer,
  membersOf,
  medalsFor,
  HZ,
  SPEED,
  idle,
} from '../lib/games/diner/engine.ts';
import {
  dishes,
  sameOutfit,
  nights,
  coop,
} from '../lib/games/diner/content.ts';
import {
  COUNTER_X,
  COUNTER_Z,
  boothRect,
  route,
  obstacles,
  slide,
} from '../lib/games/diner/layout.ts';
import {
  botInput,
  botMemory,
  oddOneOut,
  playShift,
} from '../lib/games/diner/bot.ts';

const USE = { mx: 0, mz: 0, use: true, out: false };
const OUT = { mx: 0, mz: 0, use: false, out: true };

/** Steps with idle inputs, collecting events. */
function wait(m, ticks, events = []) {
  for (let i = 0; i < ticks && m.phase !== 'over'; i++) {
    step(m, []);
    events.push(...m.events.splice(0));
  }
  return events;
}
function until(m, condition, what, limit = 60 * HZ) {
  const events = [];
  for (let i = 0; i < limit; i++) {
    if (condition()) return events;
    step(m, []);
    events.push(...m.events.splice(0));
  }
  throw new Error(`timed out waiting for ${what}`);
}
/** Puts a waiter at a spot facing a point. */
function place(m, x, z, face = [x, z - 1], pi = 0) {
  const p = m.players[pi];
  p.x = p.px = x;
  p.z = p.pz = z;
  const dx = face[0] - x,
    dz = face[1] - z;
  const d = Math.hypot(dx, dz) || 1;
  p.fx = dx / d;
  p.fz = dz / d;
}
function press(m, input = USE, pi = 0) {
  const inputs = m.players.map((_, i) => (i === pi ? input : idle));
  step(m, inputs);
  return m.events.splice(0);
}
const atCounter = (m, id, pi = 0) =>
  place(m, COUNTER_X[id], COUNTER_Z + 0.45, [COUNTER_X[id], 0], pi);
function atTable(m, slot, pi = 0) {
  const t = m.tables.find((x) => x.slot === slot);
  const r = boothRect(t);
  place(m, t.x, r.z1 + 0.4, [t.x, t.z], pi);
}
function atGuest(m, guest, pi = 0) {
  place(m, guest.x, guest.z + 0.55, [guest.x, guest.z], pi);
}
const party = (m, g) => membersOf(m, g);

function fresh(night = 1, names = ['A']) {
  const m = createMatch(12345, night, names);
  open(m);
  m.next = Infinity; // Tests bring their own guests.
  return m;
}

await test('a whole visit: seat, order, cook, serve, eat, pay, clear and wash', () => {
  const m = fresh();
  const g = spawnParty(m, 2);
  until(m, () => g.state === 'queue', 'the party to line up');
  atGuest(m, party(m, g)[0]);
  assert.equal(actionFor(m, 0)?.kind, 'lead');
  press(m);
  assert.equal(g.state, 'follow');
  assert.equal(m.players[0].lead, g.id);
  assert.deepEqual(m.players[0].hands, [], 'leading needs no hands');
  // A two-seat booth fits a party of two.
  atTable(m, 0);
  assert.equal(actionFor(m, 0)?.kind, 'seat');
  let events = press(m);
  assert.ok(events.some((e) => e.type === 'seat' && e.table === 0));
  assert.equal(m.players[0].lead, -1);
  events = until(m, () => g.state === 'order', 'the bell');
  assert.ok(events.some((e) => e.type === 'bell'));
  atTable(m, 0);
  assert.equal(actionFor(m, 0)?.kind, 'order');
  press(m);
  assert.equal(g.state, 'food');
  for (const guest of party(m, g))
    assert.ok(['burger', 'shake'].includes(guest.dish));
  // Cook and serve each guest's dish.
  for (const guest of party(m, g)) {
    const station = dishes[guest.dish].station;
    atCounter(m, station);
    assert.equal(actionFor(m, 0)?.kind, 'cook');
    press(m);
    assert.equal(
      m.stations.find((s) => s.id === station).lanes[0].state,
      'cook',
    );
    until(
      m,
      () => m.stations.find((s) => s.id === station).lanes[0].state === 'ready',
      'the dish',
    );
    atCounter(m, station);
    assert.equal(actionFor(m, 0)?.kind, 'take');
    press(m);
    assert.deepEqual(m.players[0].hands, [
      { k: 'dish', dish: guest.dish, burnt: false },
    ]);
    atTable(m, 0);
    assert.equal(actionFor(m, 0)?.kind, 'serve');
    press(m);
    assert.deepEqual(m.players[0].hands, []);
  }
  assert.equal(g.state, 'eat');
  events = until(m, () => m.tables[0].dirty, 'the bill');
  const paid = events.find((e) => e.type === 'pay');
  assert.ok(paid.coins >= 20 && paid.coins <= 30, `paid ${paid.coins}`);
  assert.equal(m.coins, 0, 'coins wait on the table');
  atTable(m, 0);
  assert.equal(actionFor(m, 0)?.kind, 'clear');
  press(m);
  assert.equal(m.coins, paid.coins);
  assert.deepEqual(m.players[0].hands, [{ k: 'dirty', n: 2 }]);
  assert.equal(m.tables[0].dirty, false);
  atCounter(m, 'sink');
  assert.equal(actionFor(m, 0)?.kind, 'wash');
  press(m);
  assert.deepEqual(m.players[0].hands, []);
  until(m, () => !m.groups.length, 'the party to leave');
  assert.equal(m.stars, 5);
});

await test('a burger left on the grill burns and only goes in the bin', () => {
  const m = fresh();
  atCounter(m, 'grill');
  press(m);
  const grill = m.stations.find((s) => s.id === 'grill');
  const events = until(
    m,
    () => grill.lanes[0].state === 'burnt',
    'burning',
    20 * HZ,
  );
  assert.ok(events.some((e) => e.type === 'ready'));
  assert.ok(events.some((e) => e.type === 'smoke'));
  assert.ok(events.some((e) => e.type === 'burnt'));
  atCounter(m, 'grill');
  press(m);
  assert.deepEqual(m.players[0].hands, [
    { k: 'dish', dish: 'burger', burnt: true },
  ]);
  // A burnt plate is never served.
  const g = spawnParty(m, 1);
  until(m, () => g.state === 'queue', 'the party');
  m.players[0].hands = [];
  atGuest(m, party(m, g)[0]);
  press(m);
  atTable(m, 0);
  press(m);
  until(m, () => g.state === 'order', 'the bell');
  atTable(m, 0);
  press(m);
  party(m, g)[0].dish = 'burger';
  m.players[0].hands = [{ k: 'dish', dish: 'burger', burnt: true }];
  atTable(m, 0);
  assert.notEqual(actionFor(m, 0)?.kind, 'serve');
  atCounter(m, 'bin');
  assert.equal(actionFor(m, 0)?.kind, 'bin');
  press(m);
  assert.deepEqual(m.players[0].hands, []);
  assert.equal(m.stats.burnt, 1);
});

await test('a party left waiting too long walks out and takes a star', () => {
  const m = fresh();
  const g = spawnParty(m, 3);
  const events = until(m, () => g.state === 'leave', 'the walk-out', 70 * HZ);
  assert.ok(events.some((e) => e.type === 'impatient'));
  assert.ok(events.some((e) => e.type === 'storm'));
  assert.equal(m.stars, 4);
  assert.equal(g.angry, true);
  // Patience only runs while someone is waiting on you.
  const h = spawnParty(m, 1);
  until(m, () => h.state === 'queue', 'the party');
  atGuest(m, party(m, h)[0]);
  press(m);
  const before = h.patience;
  wait(m, 10 * HZ);
  assert.equal(h.patience, before, 'following costs no patience');
});

await test('throwing out a mimic pays; throwing out a real guest costs a star', () => {
  const m = fresh(2);
  const g = spawnParty(m, 4, true);
  until(m, () => g.state === 'queue', 'the party');
  const members = party(m, g);
  const mimic = members.find((x) => x.mimic);
  const real = members.filter((x) => !x.mimic);
  assert.equal(members.filter((x) => x.mimic).length, 1);
  // Everyone else wears the same outfit; the mimic gets one part wrong.
  for (const x of real) assert.ok(sameOutfit(x.look, real[0].look));
  assert.ok(!sameOutfit(mimic.look, real[0].look));
  assert.equal(
    oddOneOut(members.map((x) => ({ id: x.id, look: x.look }))),
    mimic.id,
  );
  g.patience = 0.4;
  atGuest(m, mimic);
  assert.equal(outTarget(m, 0), mimic.id);
  const events = press(m, OUT);
  assert.ok(events.some((e) => e.type === 'reveal' && e.guest === mimic.id));
  assert.equal(m.coins, 15);
  assert.equal(m.stats.caught, 1);
  assert.equal(g.guests.length, 3);
  assert.ok(g.patience > 0.99, 'the rest of the party is happy again');
  assert.equal(mimic.state, 'goo');
  // A real guest thrown out takes the whole party with them.
  const h = spawnParty(m, 3);
  until(m, () => h.state === 'queue', 'the second party');
  const guest = party(m, h)[0];
  atGuest(m, guest);
  assert.equal(outTarget(m, 0), guest.id);
  const after = press(m, OUT);
  assert.ok(after.some((e) => e.type === 'wrong'));
  assert.equal(h.state, 'leave');
  assert.equal(m.stars, 4);
  assert.equal(m.stats.wrong, 1);
});

await test('an unspotted mimic bursts out with the bill and leaves goo to mop', () => {
  const m = fresh(2);
  const g = spawnParty(m, 3, true);
  until(m, () => g.state === 'queue', 'the party');
  atGuest(m, party(m, g)[0]);
  press(m);
  atTable(m, 1);
  press(m);
  until(m, () => g.state === 'order', 'the bell');
  atTable(m, 1);
  press(m);
  for (const x of party(m, g)) {
    m.players[0].hands = [{ k: 'dish', dish: x.dish, burnt: false }];
    atTable(m, 1);
    press(m);
  }
  assert.equal(g.state, 'eat');
  const events = until(m, () => m.puddles.length > 0, 'the burst', 10 * HZ);
  assert.ok(events.some((e) => e.type === 'burst'));
  assert.equal(
    m.tables.find((t) => t.slot === 1).coins,
    0,
    'the mimic took the bill',
  );
  assert.equal(m.stats.burst, 1);
  // Goo slows you down.
  const u = m.puddles[0];
  place(m, u.x - 0.2, u.z);
  const p = m.players[0];
  movePlayer(m, 0, { mx: 1, mz: 0, use: false, out: false });
  const slowed = p.x - p.px;
  place(m, 5, 2.5);
  movePlayer(m, 0, { mx: 1, mz: 0, use: false, out: false });
  const free = p.x - p.px;
  assert.ok(slowed < free * 0.6, `${slowed} vs ${free}`);
  assert.ok(Math.abs(free - SPEED / HZ) < 1e-6);
  // Use in the puddle mops it in a second and a half.
  place(m, u.x, u.z);
  p.hands = [];
  assert.equal(actionFor(m, 0)?.kind, 'mop');
  press(m);
  assert.ok(p.mop > 0);
  // Mopping holds you in place.
  step(m, [{ mx: 1, mz: 0, use: false, out: false }]);
  assert.equal(p.x, u.x);
  const done = wait(m, 2 * HZ);
  assert.ok(done.some((e) => e.type === 'mopped'));
  assert.equal(m.puddles.length, 0);
});

await test('two hands: give first, then take, then start; never a dish nobody needs', () => {
  const m = fresh();
  const shake = m.stations.find((s) => s.id === 'shake');
  // Nobody has ordered: the machine makes one ahead, then stops.
  atCounter(m, 'shake');
  assert.equal(actionFor(m, 0)?.kind, 'cook');
  press(m);
  assert.equal(shake.lanes[0].state, 'cook');
  assert.equal(actionFor(m, 0), null, 'no second shake nobody wants');
  until(m, () => shake.lanes[0].state === 'ready', 'the shake');
  assert.equal(actionFor(m, 0)?.kind, 'take');
  press(m);
  assert.deepEqual(m.players[0].hands, [
    { k: 'dish', dish: 'shake', burnt: false },
  ]);
  // Pressing again with a shake in hand does not start another.
  assert.equal(actionFor(m, 0), null);
  // Two guests ordered shakes: one is in hand, so one more may start.
  const g = spawnParty(m, 2);
  until(m, () => g.state === 'queue', 'the party');
  atGuest(m, party(m, g)[0]);
  press(m);
  atTable(m, 0);
  press(m);
  until(m, () => g.state === 'order', 'the bell');
  atTable(m, 0);
  press(m);
  for (const x of party(m, g)) x.dish = 'shake';
  atCounter(m, 'shake');
  assert.equal(actionFor(m, 0)?.kind, 'cook');
  press(m);
  assert.equal(actionFor(m, 0), null, 'both shakes are covered');
  // A second free hand takes the next ready plate.
  until(
    m,
    () => shake.lanes.some((l) => l.state === 'ready'),
    'the second shake',
  );
  assert.equal(actionFor(m, 0)?.kind, 'take');
  press(m);
  assert.equal(m.players[0].hands.length, 2);
  // Full hands take nothing more, but still start a needed dish.
  shake.lanes[1] = { state: 'ready', t: 0 };
  assert.notEqual(actionFor(m, 0)?.kind, 'take');
  // Serving gives the wanted plate before anything else.
  atTable(m, 0);
  assert.equal(actionFor(m, 0)?.kind, 'serve');
  press(m);
  press(m);
  assert.deepEqual(m.players[0].hands, []);
  assert.equal(g.state, 'eat');
});

await test('leading needs no hands; a stack of dirty plates fills both', () => {
  const m = fresh();
  m.players[0].hands = [{ k: 'dish', dish: 'burger', burnt: false }];
  const g = spawnParty(m, 2);
  until(m, () => g.state === 'queue', 'the party');
  atGuest(m, party(m, g)[0]);
  assert.equal(actionFor(m, 0)?.kind, 'lead', 'plates in hand can still lead');
  press(m);
  assert.equal(m.players[0].lead, g.id);
  atTable(m, 0);
  assert.equal(actionFor(m, 0)?.kind, 'seat');
  press(m);
  assert.equal(m.players[0].hands.length, 1);
  // A dirty table needs empty hands, and its plates fill every hand.
  m.tables[1].dirty = true;
  m.tables[1].plates = 3;
  atTable(m, 1);
  assert.notEqual(actionFor(m, 0)?.kind, 'clear');
  m.players[0].hands = [];
  assert.equal(actionFor(m, 0)?.kind, 'clear');
  press(m);
  assert.deepEqual(m.players[0].hands, [{ k: 'dirty', n: 3 }]);
  atCounter(m, 'pie');
  assert.notEqual(actionFor(m, 0)?.kind, 'take');
  // A party only sits at a booth big enough for it.
  m.players[0].hands = [];
  const big = spawnParty(m, 4);
  until(m, () => big.state === 'queue', 'the big party');
  atGuest(m, party(m, big)[0]);
  press(m);
  atTable(m, 0);
  assert.notEqual(
    actionFor(m, 0)?.kind,
    'seat',
    'a two-seat booth is too small',
  );
});

await test('the same seed and inputs give the same shift', () => {
  function run() {
    const m = createMatch(777, 3, ['A', 'B']);
    open(m);
    let r = 99;
    const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
    const log = [];
    for (let i = 0; i < 40 * HZ; i++) {
      const inputs = m.players.map(() => ({
        mx: rnd() * 2 - 1,
        mz: rnd() * 2 - 1,
        use: rnd() < 0.08,
        out: rnd() < 0.01,
      }));
      step(m, inputs);
      log.push(m.events.splice(0).length);
    }
    return JSON.stringify({ m, log });
  }
  assert.equal(run(), run());
  const a = createMatch(1, 2);
  const b = createMatch(2, 2);
  open(a);
  open(b);
  wait(a, 20 * HZ);
  wait(b, 20 * HZ);
  assert.notDeepEqual(
    a.guests.map((x) => x.look),
    b.guests.map((x) => x.look),
  );
});

await test('more waiters bring more guests and ask for more coins', () => {
  const one = createMatch(5, 1, ['A']);
  const two = createMatch(5, 1, ['A', 'B']);
  const four = createMatch(5, 1, ['A', 'B', 'C', 'D']);
  assert.deepEqual(one.targets, nights[1].targets);
  assert.ok(two.targets[2] > one.targets[2] * 1.5);
  assert.ok(four.targets[2] > two.targets[2]);
  assert.ok(coop(4).pace > coop(2).pace);
  // Three or four waiters get one more booth.
  assert.equal(four.tables.length, one.tables.length + 1);
  for (const m of [one, two, four]) {
    open(m);
    playShift(m, true, 20);
  }
  assert.ok(two.stats.guests > one.stats.guests);
  assert.ok(four.stats.guests > two.stats.guests);
});

await test('nights add stations, booths and mimics', () => {
  assert.deepEqual(
    createMatch(1, 1).stations.map((s) => s.id),
    ['grill', 'shake'],
  );
  assert.deepEqual(
    createMatch(1, 3).stations.map((s) => s.id),
    ['grill', 'fryer', 'shake', 'pie'],
  );
  assert.equal(createMatch(1, 3).tables.length, 5);
  // Night 1 has no mimics; Night 2's first one comes to a quiet door.
  const first = createMatch(9, 1);
  open(first);
  wait(first, 170 * HZ);
  assert.equal(
    first.guests.some((x) => x.mimic) || first.stats.caught || first.mimicSeen,
    false,
  );
  const second = createMatch(9, 2);
  open(second);
  until(second, () => second.mimicSeen, 'the first mimic', 90 * HZ);
  const g = second.groups.find((x) => party(second, x).some((y) => y.mimic));
  assert.ok(g && g.guests.length >= 3);
});

await test('a party walks around the booths, never through them', () => {
  const tables = [0, 1, 2, 3, 4, 5];
  const o = obstacles(tables);
  const path = route(tables, [5.2, 9.0], [11.6, 2.6]);
  let [x, z] = [5.2, 9.0];
  for (const [tx, tz] of path) {
    const n = Math.ceil(Math.hypot(tx - x, tz - z) / 0.05);
    for (let i = 1; i <= n; i++) {
      const px = x + ((tx - x) * i) / n,
        pz = z + ((tz - z) * i) / n;
      for (const r of o.rects)
        assert.ok(
          !(px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1),
          `through a booth at ${px},${pz}`,
        );
    }
    [x, z] = [tx, tz];
  }
  // Walls and booths stop a waiter.
  let [sx, sz] = [5.2, 5.4];
  for (let i = 0; i < 40; i++) [sx, sz] = slide(sx, sz, 0, -SPEED / HZ, 0.3, o);
  assert.ok(
    sz >= boothRect({ x: 5.2, z: 3.85, seats: 2 }).z1 + 0.29,
    `stopped at ${sx},${sz}`,
  );
  for (let i = 0; i < 80; i++) [sx, sz] = slide(sx, sz, -SPEED / HZ, 0, 0.3, o);
  assert.ok(Math.abs(sx - 0.3) < 1e-9, 'the left wall stops you');
});

await test('a greedy bot earns two or three medals on Night 1', () => {
  const medals = [];
  for (const seed of [11, 22, 33, 44]) {
    const m = createMatch(seed, 1, ['Bot']);
    open(m);
    playShift(m, true, 20);
    assert.equal(m.phase, 'over');
    medals.push(m.medals);
    assert.equal(m.medals, medalsFor(m));
  }
  assert.ok(
    medals.every((x) => x >= 2),
    `medals ${medals.join(', ')}`,
  );
});

await test('the bot spots mimics by their outfit and never throws out a real guest', () => {
  const m = createMatch(31, 3, ['Bot']);
  open(m);
  const mem = botMemory();
  for (let i = 0; i < 180 * HZ && m.phase !== 'over'; i++) {
    step(m, [botInput(m, 0, mem)]);
    m.events.length = 0;
  }
  assert.ok(m.stats.caught >= 2, `caught ${m.stats.caught}`);
  assert.equal(m.stats.wrong, 0);
});

await test('two waiters throwing out the same mimic never hit a real guest', () => {
  const m = fresh(2, ['A', 'B']);
  const g = spawnParty(m, 4, true);
  until(m, () => g.state === 'queue', 'the party');
  const mimic = party(m, g).find((x) => x.mimic);
  for (const pi of [0, 1]) atGuest(m, mimic, pi);
  assert.equal(outTarget(m, 0), mimic.id);
  assert.equal(outTarget(m, 1), mimic.id);
  step(m, [OUT, OUT]);
  const events = m.events.splice(0);
  assert.equal(events.filter((e) => e.type === 'reveal').length, 1);
  assert.ok(events.some((e) => e.type === 'deny' && e.player === 1));
  assert.equal(m.stats.wrong, 0);
  assert.equal(m.stars, 5);
});
