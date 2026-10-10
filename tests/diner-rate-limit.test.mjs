import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { makeServer } from '../server/index.ts';
import { newSession } from '../server/auth.ts';

const origin = 'http://localhost:3017';
const ip = '192.0.2.1';

async function fixture(t, count = 4) {
  const environment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  t.after(() => {
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
  });
  const start = Date.now();
  let now = start;
  t.mock.method(Date, 'now', () => now);
  const app = await makeServer({
    database: ':memory:',
    origin,
    bots: false,
    // Keep simulation timers separate from the mocked limiter clock.
    diner: { joinMs: 180_000 },
  });
  t.after(() => app.close());
  const actors = Array.from({ length: count }, (_, i) => {
    const id = `waiter-${i}`;
    app.db.prepare('INSERT INTO guests VALUES (?,?)').run(id, id);
    return {
      id,
      name: id,
      cookie: newSession(app.db, id, false, false).split(';')[0],
      sequence: 0,
    };
  });
  // Eight waiters behind one NAT play in two four-seat rooms.
  for (let i = 0; i < count; i += 4) {
    const members = actors.slice(i, i + 4);
    const room = app.diner.launch(`table-${i}`, members[0].id, members, {
      level: 1,
    });
    for (const actor of members) actor.path = `/api/diner/${room}`;
  }

  // Invoke the real HTTP handler without a listener, including its IP and
  // actor limiters, session lookup, body validation and seat authorization.
  const handle = app.server.listeners('request')[0];
  async function request(actor, options = {}) {
    const method = options.method ?? 'POST';
    const input = options.input ?? {
      round: 1,
      frames: [[++actor.sequence, 16, 0, 0]],
    };
    const req = Readable.from(
      method === 'POST' ? [Buffer.from(JSON.stringify(input))] : [],
    );
    Object.assign(req, {
      method,
      url: options.path ?? `${actor.path}/input`,
      socket: { remoteAddress: options.ip ?? ip },
      headers: {
        origin,
        cookie: actor.cookie,
        'content-type': 'application/json',
        ...options.headers,
      },
    });
    let status;
    let data;
    const res = {
      headersSent: false,
      setHeader() {},
      writeHead(code) {
        status = code;
        this.headersSent = true;
      },
      end(value) {
        data = JSON.parse(value);
      },
    };
    await handle(req, res);
    return { status, data };
  }
  return { app, actors, request, at: (ms) => { now = start + ms; } };
}

for (const count of [4, 8]) {
  await test(`${count} Diner actors on one IP sustain 20 inputs/second each for two minutes`, async (t) => {
    const { app, actors, request, at } = await fixture(t, count);
    for (let tick = 0; tick < 2400; tick++) {
      at(tick * 50);
      for (const actor of actors) {
        const response = await request(actor);
        assert.equal(response.status, 200, `${actor.id} at ${tick * 50}ms`);
        assert.deepEqual(response.data, { ok: true });
      }
    }
    for (const room of app.diner.rooms.values())
      for (const seat of room.seats) assert.equal(seat.received, 2400);
    assert.equal(
      (await request(actors[0], { path: '/api/session', method: 'GET' })).status,
      200,
      'input leaves the shared API bucket untouched',
    );
  });
}

await test('Diner input rejects an IP flood above 12,000/minute and resets at the window boundary', async (t) => {
  const { actors, request, at } = await fixture(t, 8);
  // 250 requests/second in aggregate, below the actor cap of 700/10 seconds.
  for (let i = 0; i < 12_000; i++) {
    at(i * 4);
    assert.equal((await request(actors[i % actors.length])).status, 200);
  }
  at(48_000);
  assert.equal((await request(actors[0])).status, 429);
  assert.equal(
    (await request(actors[0], { ip: '192.0.2.2' })).status,
    200,
    'another IP has its own input budget',
  );
  assert.equal(
    (await request(actors[0], { path: '/api/session', method: 'GET' })).status,
    200,
    'an input flood does not exhaust the shared API bucket',
  );
  at(59_999);
  assert.equal((await request(actors[0])).status, 429);
  at(60_000);
  assert.equal((await request(actors[0])).status, 200);
});

await test('non-input Diner requests and other APIs still share the 600/minute bucket', async (t) => {
  const { actors, request, at } = await fixture(t);
  const actor = actors[0];
  const routes = [
    { path: actor.path, method: 'GET', status: 200 },
    { path: `${actor.path}/again`, status: 409 },
    {
      path: `${actor.path}/events`,
      method: 'GET',
      headers: { origin: 'https://elsewhere.test' },
      status: 403,
    },
    { path: `${actor.path}/input`, method: 'GET', status: 405 },
    { path: `${actor.path}/input/extra`, status: 404 },
    { path: '/api/diner/invalid/input', status: 404 },
    { path: '/api/session', method: 'GET', status: 200 },
  ];
  for (let i = 0; i < 600; i++) {
    const route = routes[i % routes.length];
    assert.equal((await request(actor, route)).status, route.status);
  }
  for (const route of routes)
    assert.equal((await request(actor, route)).status, 429, route.path);
  assert.equal(
    (await request(actor)).status,
    200,
    'the input budget is independent of the exhausted shared bucket',
  );
  at(60_000);
  assert.equal((await request(actor, routes[0])).status, 200);
});

await test('Diner keeps its per-actor limit of 700 inputs per ten seconds', async (t) => {
  const { actors, request, at } = await fixture(t);
  for (let i = 0; i < 700; i++)
    assert.equal((await request(actors[0])).status, 200);
  assert.equal((await request(actors[0])).status, 429);
  assert.equal(
    (await request(actors[0], { ip: '192.0.2.2' })).status,
    429,
    'changing IP does not bypass the actor limit',
  );
  assert.equal((await request(actors[1])).status, 200);
  at(10_000);
  assert.equal((await request(actors[0])).status, 200);
});

await test('Diner input still requires the correct origin, a live session and an authorized seat', async (t) => {
  const { app, actors, request } = await fixture(t, 8);
  const actor = actors[0];
  for (const badOrigin of ['https://elsewhere.test', undefined])
    assert.equal(
      (await request(actor, { headers: { origin: badOrigin } })).status,
      403,
    );
  for (const cookie of ['', 'gamehub_session=invalid'])
    assert.equal((await request(actor, { headers: { cookie } })).status, 403);
  assert.equal(
    (await request(actors[4], { path: `${actor.path}/input` })).status,
    403,
    'a signed-in waiter from another room cannot steer this seat',
  );
  assert.equal(
    (await request(actor, { headers: { 'content-type': 'text/plain' } })).status,
    415,
  );
  assert.equal(
    (await request(actor, { input: { round: 1, frames: [[1, 40, 0, 0]] } })).status,
    400,
  );
  app.db.prepare('UPDATE sessions SET expires=? WHERE guest_id=?').run(Date.now(), actor.id);
  assert.equal((await request(actor)).status, 403, 'an expired session is refused');
});
