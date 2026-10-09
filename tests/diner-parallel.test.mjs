import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionFor,
  createConfiguredMatch,
  defaultEffects,
  HZ,
  idle,
  JUKE_PLAY,
  JUKE_REST,
  movePlayer,
  open,
  PASS_SIZE,
  POT_POURS,
  SPEED,
  spawnParty,
  step,
} from '../lib/games/diner/engine.ts';
import {
  createProfile,
  driveTo,
  runChoices,
  startRun,
} from '../lib/games/diner/campaign.ts';
import {
  COUNTER_X,
  COUNTER_Z,
  JUKEBOX,
  QUEUE,
} from '../lib/games/diner/layout.ts';

const USE = { mx: 0, mz: 0, use: true, out: false };
/** A campaign shift with chosen effects, doors open, no arrivals. */
function shift(effects = {}) {
  const { run } = startRun(createProfile(), 31);
  const config = structuredClone(
    driveTo(run, runChoices(run)[0].id).savedMatch.config,
  );
  config.effects = { ...defaultEffects(), ...effects };
  config.spec.stations = ['grill', 'fryer', 'shake', 'pie'];
  config.spec.menu = { burger: 1, fries: 1, shake: 1, pie: 1 };
  const m = createConfiguredMatch(5, config);
  open(m);
  m.next = Infinity;
  return m;
}
function place(m, x, z, face = [x, z - 1]) {
  const p = m.players[0];
  Object.assign(p, { x, px: x, z, pz: z });
  const d = Math.hypot(face[0] - x, face[1] - z) || 1;
  p.fx = (face[0] - x) / d;
  p.fz = (face[1] - z) / d;
}
const atCounter = (m, id) =>
  place(m, COUNTER_X[id], COUNTER_Z + 0.45, [COUNTER_X[id], 0]);
const press = (m) => {
  step(m, [USE]);
  return m.events.splice(0);
};
const wait = (m, ticks) => {
  for (let i = 0; i < ticks; i++) step(m, [idle]);
  m.events.length = 0;
};
/** Seats a party and takes its order, everyone wanting `dish`. */
function ordered(m, size, dish) {
  const g = spawnParty(m, size);
  while (g.state !== 'queue') step(m, [idle]);
  const t = m.tables.find((x) => x.seats >= size && x.group < 0);
  g.state = 'food';
  g.table = t.slot;
  g.slot = -1;
  t.group = g.id;
  for (const id of g.guests) {
    const x = m.guests.find((y) => y.id === id);
    x.dish = dish;
    x.state = 'sit';
  }
  return g;
}

await test('a twin grill cooks three burgers side by side', () => {
  const m = shift({ grillLanes: 3 });
  const grill = m.stations.find((s) => s.id === 'grill');
  assert.equal(grill.lanes.length, 3);
  ordered(m, 4, 'burger');
  atCounter(m, 'grill');
  press(m);
  press(m);
  press(m);
  assert.deepEqual(
    grill.lanes.map((l) => l.state),
    ['cook', 'cook', 'cook'],
  );
  assert.equal(actionFor(m, 0), null, 'every lane is busy');
});

await test('auto restock starts the next plate only while someone still needs it', () => {
  const m = shift({ restock: true });
  ordered(m, 2, 'shake');
  const shake = m.stations.find((s) => s.id === 'shake');
  atCounter(m, 'shake');
  press(m);
  while (shake.lanes[0].state !== 'ready') step(m, [idle]);
  press(m);
  assert.equal(shake.lanes[0].state, 'cook', 'the second guest still waits');
  while (shake.lanes[0].state !== 'ready') step(m, [idle]);
  press(m);
  assert.equal(shake.lanes[0].state, 'idle', 'both are covered now');
});

await test('the heat-lamp pass: full hands shelve a plate, a free hand takes one', () => {
  const m = shift({ pass: true });
  const p = m.players[0];
  p.hands = [
    { k: 'dish', dish: 'burger', burnt: false },
    { k: 'dish', dish: 'shake', burnt: false },
  ];
  atCounter(m, 'pass');
  assert.equal(actionFor(m, 0)?.kind, 'put');
  press(m);
  assert.equal(m.pass.length, 1);
  assert.equal(p.hands.length, 1);
  assert.equal(actionFor(m, 0)?.kind, 'pick');
  press(m);
  assert.equal(m.pass.length, 0);
  assert.equal(p.hands.length, 2);
  m.pass = Array.from({ length: PASS_SIZE }, () => ({
    k: 'dish',
    dish: 'pie',
    burnt: false,
  }));
  assert.notEqual(actionFor(m, 0)?.kind, 'put', 'a full shelf takes no more');
});

await test('coffee: a pot from the urn calms a waiting party, three pours a pot', () => {
  const m = shift({ coffee: true });
  atCounter(m, 'coffee');
  assert.equal(actionFor(m, 0)?.kind, 'pot');
  press(m);
  assert.deepEqual(m.players[0].hands, [{ k: 'pot', pours: POT_POURS }]);
  const g = spawnParty(m, 2);
  while (g.state !== 'queue') step(m, [idle]);
  g.patience = 0.3;
  const x = m.guests.find((y) => y.id === g.guests[0]);
  place(m, x.x, x.z + 0.55, [x.x, x.z]);
  assert.equal(actionFor(m, 0)?.kind, 'pour');
  press(m);
  assert.ok(g.patience > 0.65);
  assert.equal(m.players[0].hands[0].pours, POT_POURS - 1);
  assert.equal(
    actionFor(m, 0)?.kind,
    'lead',
    'a calm party is led, not poured for',
  );
});

await test('the jukebox pauses everyone’s patience for a song, then rests', () => {
  const m = shift({ jukebox: true });
  const g = spawnParty(m, 2);
  while (g.state !== 'queue') step(m, [idle]);
  place(m, JUKEBOX.x - 0.9, JUKEBOX.z, [JUKEBOX.x, JUKEBOX.z]);
  assert.equal(actionFor(m, 0)?.kind, 'juke');
  press(m);
  const before = g.patience;
  wait(m, (JUKE_PLAY - 1) * HZ);
  assert.equal(g.patience, before, 'nobody loses patience during the song');
  wait(m, 2 * HZ);
  assert.ok(g.patience < before);
  assert.ok(m.juke.rest > 0 && m.juke.rest <= JUKE_REST * HZ);
  assert.notEqual(actionFor(m, 0)?.kind, 'juke', 'it rests between songs');
});

await test('roller skates: a short dash with a cooldown', () => {
  const m = shift({ dash: true });
  place(m, 5, 6);
  const p = m.players[0];
  movePlayer(m, 0, { mx: 1, mz: 0, use: false, out: false, dash: true });
  const fast = p.x - p.px;
  assert.ok(fast > (SPEED / HZ) * 2, `dashed ${fast}`);
  for (let i = 0; i < 10; i++)
    movePlayer(m, 0, { mx: 1, mz: 0, use: false, out: false });
  const normal = p.x - p.px;
  assert.ok(Math.abs(normal - SPEED / HZ) < 1e-6);
  movePlayer(m, 0, { mx: 1, mz: 0, use: false, out: false, dash: true });
  assert.ok(Math.abs(p.x - p.px - SPEED / HZ) < 1e-6, 'still cooling down');
  const plain = shift();
  place(plain, 5, 6);
  movePlayer(plain, 0, { mx: 1, mz: 0, use: false, out: false, dash: true });
  assert.ok(
    Math.abs(plain.players[0].x - plain.players[0].px - SPEED / HZ) < 1e-6,
    'no skates, no dash',
  );
});

await test('a chrome tray carries three plates', () => {
  const m = shift({ hands: 3 });
  ordered(m, 4, 'pie');
  atCounter(m, 'pie');
  press(m);
  press(m);
  press(m);
  assert.equal(m.players[0].hands.length, 3);
  assert.notEqual(actionFor(m, 0)?.kind, 'take');
  assert.ok(QUEUE.length > 0);
});

await test('a full coffee pot goes back on the warmer, so hands can clear a table', () => {
  const m = shift({ coffee: true });
  atCounter(m, 'coffee');
  press(m);
  assert.equal(actionFor(m, 0)?.kind, 'stow');
  press(m);
  assert.deepEqual(m.players[0].hands, []);
  press(m);
  m.players[0].hands[0].pours = 1;
  assert.equal(actionFor(m, 0)?.kind, 'refill');
});
