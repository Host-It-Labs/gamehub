import test from 'node:test';
import assert from 'node:assert/strict';
import { botInput, botMemory } from '../../../../lib/games/diner/bot.ts';
import {
  createConfiguredMatch,
  defaultEffects,
  open,
  step,
  spawnParty,
} from '../../../../lib/games/diner/engine.ts';
import {
  createProfile,
  startRun,
  runChoices,
  shiftConfig,
} from '../../../../lib/games/diner/campaign.ts';
import {
  COUNTER_X,
  COUNTER_Z,
  JUKEBOX,
  QUEUE,
} from '../../../../lib/games/diner/layout.ts';

function fixture(effects = {}) {
  const { run } = startRun(createProfile(), 19);
  const config = shiftConfig(run, runChoices(run)[0]);
  config.effects = { ...defaultEffects(), ...effects };
  config.spec.stations = ['grill', 'fryer', 'shake', 'pie'];
  const m = createConfiguredMatch(19, config, ['Bot']);
  open(m);
  m.next = 999999;
  m.events.length = 0;
  return m;
}
function at(m, x, z) {
  Object.assign(m.players[0], { x, px: x, z, pz: z, fx: 0, fz: -1 });
}
function atCounter(m, id) {
  at(m, COUNTER_X[id], COUNTER_Z + 0.48);
}
function ordered(m, dish, size = 3) {
  const g = spawnParty(m, size);
  const t = m.tables.find((x) => x.seats >= size);
  Object.assign(g, { state: 'food', table: t.slot, slot: -1 });
  t.group = g.id;
  for (const id of g.guests)
    Object.assign(
      m.guests.find((x) => x.id === id),
      { state: 'sit', dish, served: false, path: [] },
    );
  return g;
}
function press(m) {
  const input = botInput(m, 0, botMemory(), new Set(), true, 20);
  assert.equal(input.use, true);
  step(m, [input]);
}

test('the waiter batches two and three wanted plates without overfilling', () => {
  for (const hands of [2, 3]) {
    const m = fixture({ hands });
    ordered(m, 'pie', 4);
    atCounter(m, 'pie');
    for (let i = 0; i < hands; i++) press(m);
    assert.equal(m.players[0].hands.length, hands);
    assert.equal(
      botInput(m, 0, botMemory()).use,
      false,
      'full hands start delivery',
    );
  }
});
test('the pass shelves a spare and later retrieves its wanted FIFO plate', () => {
  const m = fixture({ pass: true });
  const g = ordered(m, 'pie', 3);
  g.state = 'read';
  for (const x of m.guests) x.dish = null;
  m.players[0].hands = [
    { k: 'dish', dish: 'burger', burnt: false },
    { k: 'dish', dish: 'shake', burnt: false },
  ];
  atCounter(m, 'pass');
  press(m);
  assert.equal(m.pass.length, 1);
  assert.equal(m.pass[0].dish, 'burger');
  g.state = 'food';
  for (const x of m.guests) x.dish = 'burger';
  press(m);
  assert.equal(m.pass.length, 0);
  assert.equal(m.players[0].hands.at(-1).dish, 'burger');
});
test('coffee is fetched for a low party and poured only below 65 percent', () => {
  const m = fixture({ coffee: true });
  const g = spawnParty(m, 2);
  Object.assign(g, { state: 'queue', patience: 0.25 });
  m.guests.forEach((x, i) =>
    Object.assign(x, {
      state: 'wait',
      path: [],
      x: QUEUE[g.slot].x + (i - 0.5) * 0.5,
      z: QUEUE[g.slot].z,
    }),
  );
  atCounter(m, 'coffee');
  press(m);
  assert.equal(m.players[0].hands[0].k, 'pot');
  at(m, QUEUE[g.slot].x + 0.3, QUEUE[g.slot].z + 0.6);
  press(m);
  assert.ok(g.patience > 0.64);
  assert.equal(m.players[0].hands[0].pours, 2);
  g.patience = 0.9;
  press(m);
  assert.equal(
    m.players[0].lead,
    g.id,
    'a calm party is led rather than poured for',
  );
});
test('several low parties get a song when the jukebox is ready', () => {
  const m = fixture({ jukebox: true });
  for (let i = 0; i < 2; i++) {
    const g = spawnParty(m, 2);
    Object.assign(g, { state: 'queue', patience: 0.2 });
  }
  at(m, JUKEBOX.x - 0.9, JUKEBOX.z);
  press(m);
  assert.ok(m.juke.play > 0);
});
test('Dash is used on a long straight walk, respects its cooldown and equipment', () => {
  for (const dash of [false, true]) {
    const m = fixture({ dash });
    ordered(m, 'burger');
    atCounter(m, 'bin');
    assert.equal(botInput(m, 0, botMemory()).dash, dash);
    m.players[0].dashCool = 20;
    assert.equal(botInput(m, 0, botMemory()).dash, false);
  }
});
test('hidden mimic flags, RNG and pending arrivals cannot change bot inputs', () => {
  const m = fixture();
  const g = ordered(m, 'burger');
  g.patience = 0.4;
  const input = botInput(m, 0, botMemory());
  const hidden = structuredClone(m);
  hidden.rng = 1234567;
  hidden.next += 9999;
  for (const x of hidden.guests)
    Object.defineProperty(x, 'mimic', {
      get() {
        throw new Error('The bot peeked');
      },
    });
  assert.deepEqual(botInput(hidden, 0, botMemory()), input);
});
test('the action pause is spent on idle input before planning resumes', () => {
  const m = fixture();
  ordered(m, 'pie');
  atCounter(m, 'pie');
  const mem = botMemory();
  const action = botInput(m, 0, mem, new Set(), true, 20);
  assert.equal(action.use, true);
  step(m, [action]);
  for (let i = 0; i < 20; i++)
    assert.deepEqual(botInput(m, 0, mem, new Set(), true, 20), {
      mx: 0,
      mz: 0,
      use: false,
      out: false,
      dash: false,
    });
  assert.equal(botInput(m, 0, mem, new Set(), true, 20).use, true);
});
