import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeServer } from '../server/index.ts';
import { AltoRooms } from '../server/alto.ts';
import { openDatabase } from '../server/database.ts';
import { botMove } from '../lib/games/alto/bot.ts';
import { totalTurns } from '../lib/games/alto/engine.ts';

const origin = 'http://localhost:3017';

async function fixture(alto = {}) {
  const app = await makeServer({ database: ':memory:', origin, bots: false, alto: { inline: true, ...alto } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const controller = new AbortController();
  function client() {
    let cookie = '';
    return {
      async request(path, input) {
        const res = await fetch(base + path, {
          method: input === undefined ? 'GET' : 'POST',
          headers: { Cookie: cookie, Origin: origin, ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) },
          body: input === undefined ? undefined : JSON.stringify(input),
        });
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        return { status: res.status, data: await res.json() };
      },
      stay(path) {
        void fetch(base + path, { headers: { Cookie: cookie, Origin: origin }, signal: controller.signal })
          .then((res) => res.body?.getReader().read())
          .catch(() => {});
      },
    };
  }
  return { client, close: async () => { controller.abort(); await app.close(); } };
}
const until = async (check, what) => {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out: ${what}`);
};
async function table(client) {
  const host = client();
  await host.request('/api/auth/signup', { name: 'Host', email: 'host@example.com', password: 'test-password-123' });
  const invite = (await host.request('/api/tables', {})).data.token;
  const path = `/api/tables/${invite}`;
  host.id = (await host.request(path)).data.viewerId;
  const guest = client();
  guest.id = (await guest.request(`${path}/join`, { name: 'Guest' })).data.viewerId;
  guest.stay(`${path}/events`);
  await until(async () => (await host.request(path)).data.members.every((m) => m.connected || m.id === host.id), 'guest connected');
  return { host, guest, path };
}
const launch = (extra = {}) => ({
  kind: 'alto',
  seats: 3,
  difficulty: 'medium',
  options: { length: 'short', plans: 'first' },
  ...extra,
});
const roomOf = (url) => url.replace('/alto/', '/api/alto/');
const command = (c, room, move, requestId = randomUUID()) => c.request(`${room}/commands`, { requestId, move });
/** Picks like a bot would, from what this seat may see. */
async function pick(c, room) {
  const v = (await c.request(room)).data;
  const r = await command(c, room, botMove(v.game, v.viewerSeat));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}

await test('a table launches Alto with everyone seated and a bot in the rest', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    for (const input of [
      launch({ difficulty: 'expert' }),
      launch({ options: { length: 'forever', plans: 'first' } }),
      launch({ options: { length: 'short', plans: 'first', winds: 'yes' } }),
    ])
      assert.equal((await host.request(`${path}/launch`, input)).status, 400);
    assert.equal((await host.request(`${path}/launch`, launch({ seats: 1 }))).status, 409);
    assert.equal((await host.request(`${path}/launch`, launch({ seats: 7 }))).status, 409);
    assert.equal((await guest.request(`${path}/launch`, launch())).status, 403);
    const t = (await guest.request(path)).data;
    const voted = await guest.request(`${path}/commands`, {
      revision: t.revision,
      matchId: t.matchId,
      requestId: randomUUID(),
      action: { type: 'vote', gameId: 'alto' },
    });
    assert.equal(voted.status, 200);
    assert.deepEqual(voted.data.votes.alto, [guest.id]);
    const launched = await host.request(`${path}/launch`, launch({ options: { length: 'short', plans: 'first', winds: true, flags: true } }));
    assert.equal(launched.status, 200, JSON.stringify(launched.data));
    assert.match(launched.data.url, /^\/alto\/[A-Za-z0-9_-]{32}$/);
    assert.equal((await guest.request(path)).data.handoff.kind, 'alto');
    const room = roomOf(launched.data.url);
    const mine = (await host.request(room)).data;
    const theirs = (await guest.request(room)).data;
    assert.equal(mine.viewerSeat, 0);
    assert.equal(theirs.viewerSeat, 1);
    assert.ok(mine.isOwner && !theirs.isOwner);
    assert.deepEqual(mine.seats.map((s) => [s.name, s.bot]), [['Host', false], ['Guest', false], ['Bot 3', true]]);
    assert.ok(mine.game.options.winds && mine.game.options.flags);
    // The bot has already picked, out of sight.
    assert.ok(mine.game.ready[2]);
    assert.equal(mine.game.pending[2], null);
    assert.equal(mine.game.rngState, 0);
    const stranger = client();
    await stranger.request(`${path}/join`, { name: 'Late' });
    assert.equal((await stranger.request(room)).status, 403);
  } finally {
    await close();
  }
});

await test('picks stay secret until the last seat locks, and can be taken back before', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    const room = roomOf((await host.request(`${path}/launch`, launch())).data.url);
    const id = randomUUID();
    assert.equal((await command(host, room, { type: 'choose', island: 1 }, id)).status, 200);
    // The same request twice lands once.
    assert.equal((await command(host, room, { type: 'choose', island: 1 }, id)).status, 200);
    let seen = (await guest.request(room)).data;
    assert.equal(seen.game.pending[0], null);
    assert.ok(seen.game.ready[0]);
    assert.deepEqual((await host.request(room)).data.game.pending[0], { island: 1 });
    assert.equal((await command(host, room, { type: 'choose', island: 2 })).status, 409, 'already locked');
    assert.equal((await command(host, room, { type: 'undo' })).status, 200);
    assert.equal((await command(host, room, { type: 'choose', island: 2 })).status, 200);
    assert.equal((await host.request(room)).data.game.turn, 1, 'waits for the guest');
    await pick(guest, room);
    seen = (await guest.request(room)).data;
    assert.equal(seen.game.turn, 2);
    assert.equal(seen.game.last.visits[0], 2, 'the turn’s flights are public once it resolves');
    assert.equal((await command(host, room, { type: 'undo' })).status, 409);
  } finally {
    await close();
  }
});

await test('a player away too long has a bot fly for them', async () => {
  const { client, close } = await fixture({ awayMs: 150, onlineMs: 100 });
  try {
    const { host, path } = await table(client);
    const room = roomOf((await host.request(`${path}/launch`, launch({ seats: 2 }))).data.url);
    await pick(host, room);
    await new Promise((r) => setTimeout(r, 200));
    assert.ok((await host.request(room)).data.seats[1].away);
    await until(async () => (await host.request(room)).data.game.turn === 2, 'the away seat is covered');
  } finally {
    await close();
  }
});

await test('a match plays to the end and only the admin starts another', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    const room = roomOf(
      (await host.request(`${path}/launch`, launch({ seats: 2, options: { length: 'short', plans: 'random', orders: true, captains: true } }))).data.url,
    );
    let v = (await host.request(room)).data;
    const turns = totalTurns(v.game);
    for (let guard = 0; !v.game.over && guard < 3 * turns + 6; guard++) {
      assert.equal((await guest.request(`${room}/again`, {})).status, 403);
      await pick(host, room);
      await pick(guest, room);
      v = (await host.request(room)).data;
    }
    assert.ok(v.game.over);
    assert.equal(v.game.history.length, turns);
    assert.equal((await guest.request(`${room}/again`, {})).status, 403);
    const again = await host.request(`${room}/again`, {});
    assert.equal(again.status, 200);
    assert.ok(!again.data.game.over);
    assert.equal(again.data.game.phase, 'captain');
    assert.deepEqual(again.data.game.seats, ['Host', 'Guest']);
  } finally {
    await close();
  }
});

void test('rooms survive a restart', () => {
  const db = openDatabase(':memory:');
  const rooms = new AltoRooms(db, { inline: true });
  const token = rooms.launch('table', 'a', [{ id: 'a', name: 'Ann' }], launch({ seats: 2 }));
  const again = new AltoRooms(db, { inline: true });
  const view = again.get(token, { id: 'a', name: 'Ann', userId: null, sessionHash: '', expires: 0 });
  assert.equal(view.viewerSeat, 0);
  assert.ok(view.game.ready[1], 'the bot had picked');
});
