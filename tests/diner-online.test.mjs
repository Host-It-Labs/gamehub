import test from 'node:test';
import assert from 'node:assert/strict';
import { makeServer } from '../server/index.ts';
import { createMatch, open, step } from '../lib/games/diner/engine.ts';
import {
  encodeFrame,
  decodeFrame,
  packMatch,
  unpackMatch,
} from '../lib/games/diner/room.ts';

const origin = 'http://localhost:3017';
// Diner is an unreleased game: its online fixtures exercise the dev server.
process.env.NODE_ENV = 'development';

/** A server on a free port with a faster Diner clock. */
async function fixture(diner = {}) {
  const app = await makeServer({
    database: ':memory:',
    origin,
    bots: false,
    diner,
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const controller = new AbortController();
  function client() {
    let cookie = '';
    return {
      async request(path, input) {
        const res = await fetch(base + path, {
          method: input === undefined ? 'GET' : 'POST',
          headers: {
            Cookie: cookie,
            Origin: origin,
            ...(input === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          body: input === undefined ? undefined : JSON.stringify(input),
        });
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        return { status: res.status, data: await res.json() };
      },
      listen(path) {
        return listen(
          fetch(base + path, {
            headers: { Cookie: cookie, Origin: origin },
            signal: controller.signal,
          }),
        );
      },
    };
  }
  return {
    app,
    client,
    close: async () => {
      controller.abort();
      await app.close();
    },
  };
}

/** Reads an event stream in the background. */
function listen(pending) {
  const stream = { events: [], status: 0, done: false };
  void pending
    .then(async (res) => {
      stream.status = res.status;
      if (res.status !== 200) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        for (let at; (at = buffer.indexOf('\n\n')) >= 0;) {
          const block = buffer.slice(0, at);
          buffer = buffer.slice(at + 2);
          let event = 'message';
          let data;
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: '))
              data = JSON.parse(line.slice(6));
          }
          if (data !== undefined) stream.events.push({ event, data });
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      stream.done = true;
    });
  return stream;
}
const last = (s, event) =>
  s.events.filter((e) => e.event === event).at(-1)?.data;
async function until(condition, what, timeout = 8000) {
  const end = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function table(client, names = ['Guest']) {
  const host = client();
  await host.request('/api/auth/signup', {
    name: 'Host',
    email: 'host@example.com',
    password: 'test-password-123',
  });
  const invite = (await host.request('/api/tables', {})).data.token;
  const path = `/api/tables/${invite}`;
  host.id = (await host.request(path)).data.viewerId;
  const guests = [];
  for (const name of names) {
    const g = client();
    g.id = (await g.request(`${path}/join`, { name })).data.viewerId;
    g.table = g.listen(`${path}/events`);
    guests.push(g);
  }
  await until(
    () => guests.every((g) => g.table.events.length),
    'table streams',
  );
  return { host, path, guests };
}
const roomOf = (url) => url.replace('/diner/', '/api/diner/');

await test('a table launches a diner and every waiter steers their own', async () => {
  const { client, close } = await fixture({ tickMs: 4, joinMs: 5000 });
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    assert.equal(
      (await host.request(`${path}/launch`, { kind: 'diner', night: 9 }))
        .status,
      400,
    );
    assert.equal(
      (await guest.request(`${path}/launch`, { kind: 'diner', night: 1 }))
        .status,
      403,
    );
    const launched = await host.request(`${path}/launch`, {
      kind: 'diner',
      night: 2,
    });
    assert.equal(launched.status, 200);
    assert.match(launched.data.url, /^\/diner\/[A-Za-z0-9_-]{32}$/);
    assert.equal((await guest.request(path)).data.handoff.kind, 'diner');
    const room = roomOf(launched.data.url);
    const mine = (await host.request(room)).data;
    assert.deepEqual(mine.room.seats, [
      { name: 'Host', connected: false },
      { name: 'Guest', connected: false },
    ]);
    assert.equal(mine.room.you, 0);
    assert.equal(mine.room.host, true);
    assert.equal(mine.room.night, 2);
    assert.equal(mine.room.status, 'waiting');
    const m0 = unpackMatch(mine.snap.m);
    assert.equal(m0.players.length, 2);
    assert.equal(m0.phase, 'ready');
    assert.equal((await guest.request(room)).data.room.you, 1);

    // Nobody else may open, steer or listen.
    const outsider = client();
    await outsider.request('/api/auth/signup', {
      name: 'Out',
      email: 'out@example.com',
      password: 'test-password-123',
    });
    assert.equal((await outsider.request(room)).status, 403);
    assert.equal(
      (
        await outsider.request(`${room}/input`, {
          round: 1,
          frames: [[1, 16, 0, 0]],
        })
      ).status,
      403,
    );
    const denied = outsider.listen(`${room}/events`);
    await until(() => denied.done, 'refused stream');
    assert.equal(denied.status, 403);
    // Malformed steps are refused.
    assert.equal(
      (
        await host.request(`${room}/input`, {
          round: 1,
          frames: [[1, 40, 0, 0]],
        })
      ).status,
      400,
    );
    assert.equal(
      (await host.request(`${room}/input`, { round: 1, frames: 'go' })).status,
      400,
    );

    // Everyone here: the doors open after a short countdown.
    const a = host.listen(`${room}/events`);
    const b = guest.listen(`${room}/events`);
    await until(
      () => last(a, 'room')?.status === 'playing',
      'the shift to start',
    );
    await until(
      () => last(a, 'snap') && unpackMatch(last(a, 'snap').m).phase === 'open',
      'the doors to open',
    );
    assert.ok(
      a.events.some(
        (e) => e.event === 'snap' && e.data.e.some((x) => x.type === 'open'),
      ),
    );

    // The host walks right; the guest stands still.
    const start = unpackMatch(last(a, 'snap').m);
    const frames = [];
    for (let seq = 1; seq <= 30; seq++)
      frames.push(encodeFrame(seq, { mx: 1, mz: 0, use: false, out: false }));
    assert.equal(
      (
        await host.request(`${room}/input`, {
          round: 1,
          frames: frames.slice(0, 20),
        })
      ).status,
      200,
    );
    // Repeated steps are ignored; new ones join the queue.
    await host.request(`${room}/input`, {
      round: 1,
      frames: frames.slice(10, 30),
    });
    await until(() => last(a, 'snap')?.a[0] === 30, 'all thirty steps applied');
    const moved = unpackMatch(last(a, 'snap').m);
    assert.ok(
      moved.players[0].x > start.players[0].x + 2,
      `host at ${moved.players[0].x}`,
    );
    assert.equal(moved.players[1].x, start.players[1].x);
    // A press with nothing in reach says no.
    await host.request(`${room}/input`, {
      round: 1,
      frames: [encodeFrame(31, { mx: 0, mz: 0, use: true, out: false })],
    });
    await until(
      () =>
        a.events.some(
          (e) =>
            e.event === 'snap' &&
            e.data.e.some((x) => x.type === 'deny' && x.player === 0),
        ),
      'a refusal',
    );
    // Steps for another shift are ignored.
    assert.deepEqual(
      (
        await guest.request(`${room}/input`, {
          round: 7,
          frames: [encodeFrame(1, { mx: 1, mz: 0, use: false, out: false })],
        })
      ).data,
      { ok: false },
    );
    assert.equal(last(b, 'room').you, 1);
  } finally {
    await close();
  }
});

await test('a shift opens without a waiter who never comes, and the host starts the next', async () => {
  const { client, close } = await fixture({ tickMs: 0.1, joinMs: 150 });
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    const launched = await host.request(`${path}/launch`, {
      kind: 'diner',
      night: 1,
    });
    const room = roomOf(launched.data.url);
    const a = host.listen(`${room}/events`);
    await until(
      () => last(a, 'room')?.status === 'playing',
      'opening without the guest',
      3000,
    );
    assert.equal(last(a, 'room').seats[1].connected, false);
    assert.equal(
      (await host.request(`${room}/again`, {})).status,
      409,
      'not while the shift is on',
    );
    // At this clock a whole shift takes about a second.
    await until(
      () => last(a, 'room')?.status === 'over',
      'the shift to end',
      15000,
    );
    const end = unpackMatch(last(a, 'snap').m);
    assert.equal(end.phase, 'over');
    assert.ok(
      a.events.some(
        (e) => e.event === 'snap' && e.data.e.some((x) => x.type === 'end'),
      ),
    );
    assert.equal((await guest.request(`${room}/again`, {})).status, 403);
    assert.equal(
      (await host.request(`${room}/again`, { night: 4 })).status,
      400,
    );
    assert.equal(
      (await host.request(`${room}/again`, { night: 3 })).status,
      200,
    );
    await until(() => last(a, 'room')?.round === 2, 'the second shift');
    assert.equal(last(a, 'room').night, 3);
    assert.equal(last(a, 'room').status, 'playing');
  } finally {
    await close();
  }
});

await test('a table of five is too many waiters', async () => {
  const { client, close } = await fixture();
  try {
    const { host, path } = await table(client, ['B', 'C', 'D', 'E']);
    assert.equal(
      (await host.request(`${path}/launch`, { kind: 'diner', night: 1 }))
        .status,
      409,
    );
  } finally {
    await close();
  }
});

await test('a packed match comes back the same', () => {
  const m = createMatch(42, 3, ['A', 'B']);
  open(m);
  for (let i = 0; i < 30 * 40; i++)
    step(m, [{ mx: 0.5, mz: 0.25, use: i % 50 === 0, out: false }]);
  const back = unpackMatch(JSON.parse(packMatch(m)));
  assert.equal(back.guests.length, m.guests.length);
  for (const [i, g] of m.guests.entries()) {
    const h = back.guests[i];
    assert.deepEqual(h.look, g.look);
    assert.equal(h.mimic, g.mimic);
    assert.equal(h.state, g.state);
    assert.ok(Math.abs(h.x - g.x) < 0.001);
  }
  assert.deepEqual(back.tables, m.tables);
  assert.deepEqual(back.stations, m.stations);
  assert.equal(back.players[0].x.toFixed(2), m.players[0].x.toFixed(2));
  assert.deepEqual(back.players[0].carry, m.players[0].carry);
  assert.ok(
    packMatch(m).length < JSON.stringify(m).length / 2,
    'much smaller than plain JSON',
  );
  // Input steps survive the round trip.
  assert.deepEqual(
    decodeFrame(encodeFrame(9, { mx: -0.5, mz: 1, use: true, out: true })),
    { mx: -0.5, mz: 1, use: true, out: true },
  );
});
