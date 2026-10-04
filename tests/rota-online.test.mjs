import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeServer } from '../server/index.ts';
import { RotaRooms } from '../server/rota.ts';
import { openDatabase } from '../server/database.ts';
import { botRound } from '../lib/games/rota/bot.ts';
import { noExtensions } from '../lib/games/rota/engine.ts';

const origin = 'http://localhost:3017';

async function fixture(rota = {}) {
  const app = await makeServer({
    database: ':memory:',
    origin,
    bots: false,
    rota: { inline: true, ...rota },
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
            ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body: input === undefined ? undefined : JSON.stringify(input),
        });
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        return { status: res.status, data: await res.json() };
      },
      // Keeps a table stream open so the table counts this person as here.
      stay(path) {
        void fetch(base + path, {
          headers: { Cookie: cookie, Origin: origin },
          signal: controller.signal,
        })
          .then((res) => res.body?.getReader().read())
          .catch(() => {});
      },
    };
  }
  return {
    client,
    close: async () => {
      controller.abort();
      await app.close();
    },
  };
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
  await host.request('/api/auth/signup', {
    name: 'Host',
    email: 'host@example.com',
    password: 'test-password-123',
  });
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
  kind: 'rota',
  map: 'meadow',
  ext: { ...noExtensions },
  difficulty: 'medium',
  seats: 3,
  ...extra,
});
const roomOf = (url) => url.replace('/rota/', '/api/rota/');
const command = (c, room, move, requestId = randomUUID()) =>
  c.request(`${room}/commands`, { requestId, move });
/** Plays a seat's whole round the way a bot would, from what it may see. */
async function playRound(c, room) {
  const v = (await c.request(room)).data;
  for (const move of botRound(v.game, v.viewerSeat)) {
    const r = await command(c, room, move);
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
}

await test('a table launches Rota with everyone seated and bots in the rest', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    const bad = [
      launch({ map: 'moon' }),
      launch({ difficulty: 'expert' }),
      launch({ ext: { rivers: 'yes' } }),
    ];
    for (const input of bad)
      assert.equal((await host.request(`${path}/launch`, input)).status, 400);
    assert.equal((await host.request(`${path}/launch`, launch({ seats: 1 }))).status, 409);
    assert.equal((await host.request(`${path}/launch`, launch({ seats: 7 }))).status, 409);
    assert.equal((await guest.request(`${path}/launch`, launch())).status, 403);
    // Guests may suggest Rota to the admin.
    const t = (await guest.request(path)).data;
    const voted = await guest.request(`${path}/commands`, {
      revision: t.revision,
      matchId: t.matchId,
      requestId: randomUUID(),
      action: { type: 'vote', gameId: 'rota' },
    });
    assert.equal(voted.status, 200);
    assert.deepEqual(voted.data.votes.rota, [guest.id]);
    const launched = await host.request(`${path}/launch`, launch());
    assert.equal(launched.status, 200, JSON.stringify(launched.data));
    assert.match(launched.data.url, /^\/rota\/[A-Za-z0-9_-]{32}$/);
    const handoff = (await guest.request(path)).data.handoff;
    assert.equal(handoff.kind, 'rota');
    const room = roomOf(launched.data.url);
    const mine = (await host.request(room)).data;
    const theirs = (await guest.request(room)).data;
    assert.equal(mine.viewerSeat, 0);
    assert.equal(theirs.viewerSeat, 1);
    assert.ok(mine.isOwner && !theirs.isOwner);
    assert.deepEqual(mine.seats.map((s) => [s.name, s.bot]), [
      ['Host', false],
      ['Guest', false],
      ['Bot 3', true],
    ]);
    // The bot has already built and locked its round, out of sight.
    assert.ok(mine.game.seats[2].locked);
    assert.equal(mine.game.seats[2].cells.filter(Boolean).length, 0);
    assert.ok(mine.game.seats[2].hidden > 0);
    assert.equal(mine.game.rngState, 0);
    // Strangers cannot open the room.
    const stranger = client();
    await stranger.request(`${path}/join`, { name: 'Late' });
    assert.equal((await stranger.request(room)).status, 403);
  } finally {
    await close();
  }
});

await test('each seat builds in private and the round resolves when all are done', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    const room = roomOf((await host.request(`${path}/launch`, launch())).data.url);
    const v = (await host.request(room)).data;
    const [first] = botRound(v.game, 0);
    const id = randomUUID();
    assert.equal((await command(host, room, first, id)).status, 200);
    // The same request twice lands once.
    assert.equal((await command(host, room, first, id)).status, 200);
    let seen = (await guest.request(room)).data;
    assert.equal(seen.game.seats[0].hidden, 1);
    assert.equal(seen.game.seats[0].cells.filter(Boolean).length, 0);
    assert.equal((await host.request(room)).data.game.seats[0].draft.length, 1);
    // A move that no longer fits is refused.
    assert.equal((await command(host, room, first)).status, 409);
    assert.equal((await command(host, room, { type: 'done' })).status, 409);
    // Finish both rounds.
    for (const m of botRound((await host.request(room)).data.game, 0))
      assert.equal((await command(host, room, m)).status, 200);
    assert.equal((await host.request(room)).data.game.round, 1, 'waits for the guest');
    await playRound(guest, room);
    seen = (await guest.request(room)).data;
    assert.equal(seen.game.round, 2);
    // Last round's pieces are now public.
    assert.ok(seen.game.seats[0].cells.filter(Boolean).length >= 4);
    assert.equal(seen.game.seats[0].hidden, undefined);
  } finally {
    await close();
  }
});

await test('a player away too long has a bot build their round', async () => {
  const { client, close } = await fixture({ awayMs: 150, onlineMs: 100 });
  try {
    const { host, path } = await table(client);
    const room = roomOf((await host.request(`${path}/launch`, launch({ seats: 2 }))).data.url);
    await playRound(host, room);
    await new Promise((r) => setTimeout(r, 200));
    const v = (await host.request(room)).data;
    assert.ok(v.seats[1].away);
    await until(async () => (await host.request(room)).data.game.round === 2, 'the away seat is covered');
  } finally {
    await close();
  }
});

await test('a match plays to the end and only the admin starts another', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    const room = roomOf(
      (await host.request(`${path}/launch`, launch({ seats: 2, ext: { rivers: true, plans: true, towns: true, rockfall: true } }))).data.url,
    );
    for (let round = 1; round <= 7; round++) {
      assert.equal((await guest.request(`${room}/again`, {})).status, 403);
      await playRound(host, room);
      await playRound(guest, room);
    }
    const end = (await host.request(room)).data;
    assert.ok(end.game.over);
    assert.equal(end.game.final.length, 2);
    assert.equal((await guest.request(`${room}/again`, {})).status, 403);
    const again = await host.request(`${room}/again`, {});
    assert.equal(again.status, 200);
    assert.equal(again.data.game.round, 1);
    assert.ok(!again.data.game.over);
  } finally {
    await close();
  }
});

await test('rooms survive a restart', () => {
  const db = openDatabase(':memory:');
  const rooms = new RotaRooms(db, { inline: true });
  const token = rooms.launch('table', 'a', [{ id: 'a', name: 'Ann' }], launch({ seats: 2 }));
  const again = new RotaRooms(db, { inline: true });
  const view = again.get(token, { id: 'a', name: 'Ann', userId: null, sessionHash: '', expires: 0 });
  assert.equal(view.viewerSeat, 0);
  assert.ok(view.game.seats[1].locked, 'the bot had built its round');
});
