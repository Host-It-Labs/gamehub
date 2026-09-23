import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  actRelic,
  advanceRelic as advanceClock,
  createRelic,
  ARTIFACTS,
  WORLDS,
  helperCost,
  helperRate,
  incomeRate,
  benchSlots,
  formatNumber,
} from '../lib/games/relic/engine.ts';
import { openDatabase } from '../server/database.ts';
import { Expeditions } from '../server/expeditions.ts';
import { makeServer } from '../server/index.ts';
const advanceRelic = (game, now) =>
  advanceClock(game, now, Math.max(0, now - game.lastAt));
const start = 1789992000000;
const make = (seed = 12) => createRelic('Our expedition', 'dunes', seed, start);
const actor = (id) => ({
  id,
  name: id,
  userId: null,
  sessionHash: 'test',
  expires: start + 1e12,
});

await test('expeditions own their seeds, boards and progress; every layer guarantees finds', () => {
  const a = make(),
    b = createRelic('Another group', 'ruins', 78, start);
  assert.notDeepEqual(a.boards.dunes, b.boards.dunes);
  for (const w of WORLDS) {
    assert.equal(a.boards[w.id].length, 20);
    assert.equal(a.boards[w.id].filter((t) => t.kind === 'find').length, 2);
  }
  actRelic(a, { type: 'dig', tile: 0, world: 'dunes', layer: 1 }, 'Jo', start);
  assert.equal(b.coins, 0);
  assert.equal(b.dug, 0);
  assert.deepEqual(b.unlocked, ['ruins']);
});

await test('manual digging pays actual damage, rewards completed layers once and preserves destinations', () => {
  const g = make();
  g.upgrades.tool = 40;
  for (let tile = 0; tile < 20; tile++)
    actRelic(g, { type: 'dig', tile, world: 'dunes', layer: 1 }, 'Jo', start);
  assert.equal(g.dug, 20);
  assert.equal(g.crates.dunes, 2);
  assert.deepEqual(g.goals, ['dig20']);
  const balance = g.coins;
  actRelic(g, { type: 'dig', tile: 0, world: 'dunes', layer: 1 }, 'Jo', start);
  assert.equal(g.coins, balance);
  actRelic(g, { type: 'descend', world: 'dunes', layer: 1 }, 'Jo', start);
  assert.equal(g.coins, balance + 25);
  assert.equal(g.layers.dunes, 2);
  assert.throws(() =>
    actRelic(g, { type: 'descend', world: 'dunes', layer: 1 }, 'Jo', start),
  );
  assert.throws(() =>
    actRelic(g, { type: 'descend', world: 'dunes', layer: 2 }, 'Jo', start),
  );
  g.coins = 20000;
  const saved = structuredClone(g.boards.dunes);
  actRelic(g, { type: 'travel', world: 'cavern' }, 'Jo', start);
  assert.equal(g.coins, 18200);
  actRelic(g, { type: 'travel', world: 'dunes' }, 'Jo', start);
  assert.equal(g.coins, 18200);
  assert.equal(g.layers.dunes, 2);
  assert.deepEqual(g.boards.dunes, saved);
});

await test('helper milestone and bulk pricing use the same economy', () => {
  const g = make();
  g.coins = 1e7;
  const clone = structuredClone(g),
    total = helperCost(g, 'brush', 10);
  for (let i = 0; i < 10; i++)
    actRelic(clone, { type: 'helper', id: 'brush', quantity: 1 }, 'Jo', start);
  actRelic(g, { type: 'helper', id: 'brush', quantity: 10 }, 'Jo', start);
  assert.equal(g.coins, clone.coins);
  assert.equal(g.coins, 1e7 - total + 400); // shared 10-helper goal
  assert.equal(helperRate(g, 'brush'), 10);
  advanceRelic(g, start + 10000);
  assert.equal(g.coins, clone.coins + 100);
  g.helpers.brush = 100;
  assert.equal(helperCost(g, 'brush'), Infinity);
});

await test('restoration reveals and credits its discoverer, exhibits auto-fill, duplicates retain history', () => {
  const g = make();
  g.crates.dunes = 20;
  const result = actRelic(
    g,
    { type: 'restore', world: 'dunes' },
    'Mara',
    start,
  );
  assert.ok(ARTIFACTS.some((a) => a.id === result.artifact));
  assert.equal(Object.keys(g.collection).length, 0);
  assert.throws(
    () => actRelic(g, { type: 'restore', world: 'dunes' }, 'Jo', start),
    /busy/,
  );
  advanceRelic(g, start + 26000);
  assert.equal(g.collection[result.artifact].firstBy, 'Mara');
  assert.equal(g.displays[0], result.artifact);
  assert.ok(incomeRate(g) > 0);
  actRelic(
    g,
    { type: 'display', artifact: result.artifact, slot: 4 },
    'Jo',
    start + 26000,
  );
  assert.equal(g.displays[0], null);
  assert.equal(g.displays[4], result.artifact);
  assert.throws(() =>
    actRelic(
      g,
      { type: 'display', artifact: 'ruins-11', slot: 2 },
      'Jo',
      start + 26000,
    ),
  );
  g.upgrades.bench = 5;
  assert.equal(benchSlots(g), 3);
  g.upgrades.curator = 1;
  g.upgrades.trade = 1;
  advanceRelic(g, start + 3600000);
  assert.equal(
    Object.values(g.collection).reduce((n, a) => n + a.count, 0),
    20,
  );
  assert.equal(g.collection[result.artifact].firstBy, 'Mara');
});

await test('one active interval matches repeated active intervals, including automated finds, restoration and income changes', () => {
  const one = make(91);
  one.helpers.brush = 20;
  one.helpers.cart = 4;
  one.upgrades.curator = 1;
  one.upgrades.trade = 1;
  one.upgrades.bench = 5;
  one.layers.dunes = 20;
  one.crates.dunes = 4;
  const many = structuredClone(one);
  advanceRelic(one, start + 3600000);
  for (let ms = 1000; ms <= 3600000; ms += 1000) advanceRelic(many, start + ms);
  assert.ok(
    Math.abs(one.coins - many.coins) < 0.001,
    `${one.coins} vs ${many.coins}`,
  );
  assert.ok(Math.abs(one.earned - many.earned) < 0.001);
  assert.equal(one.seed, many.seed);
  assert.deepEqual(Object.keys(one.collection), Object.keys(many.collection));
  for (const id of Object.keys(one.collection))
    assert.equal(one.collection[id].count, many.collection[id].count);
  assert.deepEqual(one.crates, many.crates);
  assert.equal(one.jobs.length, many.jobs.length);
  assert.ok(Math.abs(one.survey - many.survey) < 1e-6);
  assert.ok(Object.keys(one.collection).length >= 6);
});

await test('absence pauses every legacy system, preserving inventory and remaining restoration time', () => {
  const g = make();
  g.helpers.brush = 1;
  g.crates.ruins = 2;
  g.crates.dunes = 1;
  actRelic(g, { type: 'restore', world: 'dunes' }, 'Jo', start);
  const duration = g.jobs[0].finishesAt - start;
  advanceClock(g, start + 14 * 86400000);
  assert.equal(g.coins, 0);
  assert.equal(g.crates.ruins, 2);
  assert.equal(g.jobs[0].finishesAt - g.lastAt, duration);
  assert.equal(Object.keys(g.collection).length, 0);
  advanceClock(g, g.lastAt + 1000, 1000);
  assert.equal(g.coins, 0.5);
  assert.equal(g.jobs[0].finishesAt - g.lastAt, duration - 1000);
});

await test('invalid prices, quantities, destinations and names cannot corrupt an expedition', () => {
  const g = make();
  g.coins = 1000;
  for (const action of [
    { type: 'helper', id: 'brush', quantity: -1 },
    { type: 'helper', id: 'brush' },
    { type: 'helper', id: '__proto__', quantity: 1 },
    { type: 'upgrade', id: '__proto__' },
    { type: 'dig', world: 'dunes', layer: 1, tile: 1.5 },
    { type: 'dig', world: 'dunes', layer: 1, tile: 20 },
    { type: 'travel', world: '__proto__' },
    { type: 'rename', name: 'x\u0000y' },
    { type: 'display', slot: -1, artifact: null },
    { type: 'decor', id: '__proto__' },
    { type: 'pay', coins: 1e18 },
  ])
    assert.throws(() => actRelic(g, action, 'Jo', start));
  assert.equal(g.coins, 1000);
  assert.equal(g.helpers.brush, 0);
  assert.equal(formatNumber(1250), '1.25K');
  assert.equal(formatNumber(0), '0');
});

await test('SQLite reload retains separate crews, exact actions and collections', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relic-persistence-')),
    path = join(dir, 'test.sqlite');
  let db = openDatabase(path);
  try {
    let expeditions = new Expeditions(db);
    const a = expeditions.create(
      actor('Jo'),
      { title: 'Jo and Mara', world: 'dunes' },
      start,
    );
    const b = expeditions.create(
      actor('Jo'),
      { title: 'Jo and Ren', world: 'cavern' },
      start,
    );
    expeditions.join(a.token, actor('Mara'), start);
    expeditions.join(b.token, actor('Ren'), start);
    const command = {
      requestId: randomUUID(),
      action: { type: 'dig', tile: 0, world: 'dunes', layer: 1 },
    };
    const first = expeditions.command(a.token, actor('Jo'), command, start);
    const repeated = expeditions.command(a.token, actor('Jo'), command, start);
    assert.equal(first.game.coins, repeated.game.coins);
    assert.equal(first.game.revision, repeated.game.revision);
    assert.throws(
      () =>
        expeditions.command(
          a.token,
          actor('Jo'),
          { ...command, action: { ...command.action, tile: 1 } },
          start,
        ),
      /already been used/,
    );
    assert.throws(() => expeditions.get(a.token, actor('Ren'), start), /Join/);
    assert.equal(expeditions.get(b.token, actor('Jo'), start).game.coins, 0);
    db.close();
    db = openDatabase(path);
    expeditions = new Expeditions(db);
    assert.equal(
      expeditions.get(a.token, actor('Mara'), start).game.coins,
      first.game.coins,
    );
    assert.equal(expeditions.list(actor('Jo')).length, 2);
    assert.equal(expeditions.list(actor('Mara'))[0].name, 'Jo and Mara');
    assert.equal(
      expeditions.command(a.token, actor('Jo'), command, start).game.coins,
      first.game.coins,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

await test('dev unlimited coins keep the purse full only in development', () => {
  const db = openDatabase(':memory:'),
    env = process.env.NODE_ENV;
  try {
    const expeditions = new Expeditions(db);
    const a = expeditions.create(
      actor('Jo'),
      { title: 'Jo', world: 'dunes' },
      start,
    );
    const send = (action) =>
      expeditions.command(
        a.token,
        actor('Jo'),
        { requestId: randomUUID(), action },
        start,
      );
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => send({ type: 'dev-unlimited', on: true }),
      /only available in development/,
    );
    process.env.NODE_ENV = 'development';
    assert.equal(send({ type: 'dev-unlimited', on: true }).game.coins, 1e15);
    const bought = send({ type: 'scratch-book', pack: 'ribbon' });
    assert.equal(bought.game.coins, 1e15);
    const off = send({ type: 'dev-unlimited', on: false });
    assert.equal(off.game.devUnlimited, false);
  } finally {
    process.env.NODE_ENV = env;
    db.close();
  }
});

await test('schema version 3 upgrades without losing existing account or table records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relic-migration-')),
    path = join(dir, 'test.sqlite');
  let db = openDatabase(path);
  try {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      'u',
      'u@example.test',
      'User',
      'unused',
    );
    db.prepare('INSERT INTO tables VALUES (?,?,?)').run('t', 'u', '{}');
    db.exec(
      'DROP TABLE folio_commands; DROP TABLE folio_members; DROP TABLE folio_runs; DROP TABLE expedition_commands; DROP TABLE expedition_members; DROP TABLE expeditions; PRAGMA user_version=3',
    );
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 5);
    assert.equal(db.prepare('SELECT name FROM users').get().name, 'User');
    assert.equal(db.prepare('SELECT token FROM tables').get().token, 't');
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM expeditions').get().n,
      0,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

await test('HTTP group invitations, simultaneous purchases, deduplication and production routes', async () => {
  const origin = 'http://localhost:3017';
  const app = await makeServer({ database: ':memory:', origin, bots: false });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const client = () => {
    let cookie = '';
    return async (path, body, customHeaders = {}) => {
      const response = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Origin: origin,
          Cookie: cookie,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...customHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
      return {
        status: response.status,
        data: await response.json(),
        headers: response.headers,
      };
    };
  };
  try {
    const host = client(),
      guest = client(),
      outsider = client();
    assert.deepEqual((await outsider('/api/expeditions')).data, []);
    const created = await host('/api/expeditions', {
      name: 'Jo',
      title: 'Our fossil club',
      world: 'dunes',
    });
    assert.equal(created.status, 200);
    assert.match(created.headers.get('set-cookie'), /HttpOnly/);
    const invite = created.data.token,
      path = `/api/expeditions/${invite}`;
    assert.equal((await outsider(path)).status, 401);
    assert.equal((await guest(path + '/join', { name: 'Mara' })).status, 200);
    assert.equal(
      (await guest('/api/expeditions')).data[0].name,
      'Our fossil club',
    );
    assert.equal((await host(path)).data.members.length, 2);
    const state = (await host(path)).data.game;
    state.coins = 25;
    app.db
      .prepare('UPDATE expeditions SET state=? WHERE token=?')
      .run(JSON.stringify(state), invite);
    const purchases = await Promise.all(
      [host, guest].map((who) =>
        who(path + '/commands', {
          requestId: randomUUID(),
          action: { type: 'helper', id: 'brush', quantity: 1 },
        }),
      ),
    );
    assert.deepEqual(
      purchases.map((r) => r.status).sort((a, b) => a - b),
      [200, 400],
    );
    assert.equal((await host(path)).data.game.helpers.brush, 1);
    const command = {
      requestId: randomUUID(),
      action: { type: 'dig', tile: 7, world: 'dunes', layer: 1 },
    };
    const parallel = await Promise.all([
      guest(path + '/commands', command),
      guest(path + '/commands', command),
    ]);
    assert.equal(parallel[0].status, 200);
    assert.equal(parallel[1].status, 200);
    assert.equal(
      parallel[0].data.game.revision,
      parallel[1].data.game.revision,
    );
    assert.equal(
      parallel[0].data.game.boards.dunes[7].hp,
      state.boards.dunes[7].hp - 1,
    );
    const invalid = await host(path + '/commands', {
      requestId: randomUUID(),
      action: { type: 'helper', id: 'brush' },
    });
    assert.equal(invalid.status, 400);
    assert.equal((await host(path)).data.game.helpers.brush, 1);
    for (let i = 0; i < 4; i++)
      assert.equal(
        (await client()(path + '/join', { name: `Explorer ${i}` })).status,
        200,
      );
    assert.equal(
      (await client()(path + '/join', { name: 'Seventh' })).status,
      409,
    );
    assert.equal((await guest(path + '/join', {})).status, 200);
    const other = await host('/api/expeditions', {
      title: 'Other friends',
      world: 'ruins',
    });
    assert.equal((await host('/api/expeditions')).data.length, 2);
    assert.equal(
      (await guest(`/api/expeditions/${other.data.token}`)).status,
      403,
    );
    assert.equal((await host(path)).headers.get('cache-control'), 'no-store');
    if (process.env.NODE_ENV !== 'development')
      assert.equal(
        (
          await host(path + '/commands', command, {
            Origin: 'https://other.test',
          })
        ).status,
        403,
      );
  } finally {
    await app.close();
  }
});
