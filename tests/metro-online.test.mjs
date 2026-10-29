import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server/index.ts';
import { MetroRooms } from '../server/metro.ts';
import { openDatabase } from '../server/database.ts';
import { botTurn } from '../lib/games/metro/bot.ts';
import {
  createMetro,
  legalDraws,
  noExtensions,
  play,
} from '../lib/games/metro/engine.ts';

const origin = 'http://localhost:3017';

async function fixture(metro = {}, options = {}) {
  const app = await makeServer({
    database: ':memory:',
    origin,
    bots: false,
    metro: { inline: true, ...metro },
    ...options,
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const controller = new AbortController();
  function client(cookie = '') {
    return {
      get cookie() {
        return cookie;
      },
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
      // A live table stream keeps the guest seated when the admin launches.
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
    base,
    client,
    close: async () => {
      controller.abort();
      await app.close();
    },
  };
}

const until = async (check, what) => {
  for (let i = 0; i < 150; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out: ${what}`);
};

async function table(client) {
  const host = client();
  const signed = await host.request('/api/auth/signup', {
    name: 'Host',
    email: 'host@example.com',
    password: 'test-password-123',
  });
  assert.equal(signed.status, 200);
  const invite = (await host.request('/api/tables', {})).data.token;
  const path = `/api/tables/${invite}`;
  host.id = (await host.request(path)).data.viewerId;
  const guest = client();
  guest.id = (
    await guest.request(`${path}/join`, { name: 'Guest' })
  ).data.viewerId;
  guest.stay(`${path}/events`);
  await until(
    async () =>
      (await host.request(path)).data.members.every(
        (m) => m.connected || m.id === host.id,
      ),
    'guest connected',
  );
  return { host, guest, path };
}

const launch = (extra = {}) => ({
  kind: 'metro',
  map: 'city',
  ext: { ...noExtensions },
  difficulty: 'medium',
  seats: 3,
  ...extra,
});
const roomOf = (url) => url.replace('/metro/', '/api/metro/');
const command = (c, room, move, requestId = randomUUID()) =>
  c.request(`${room}/commands`, { requestId, move });
const identity = (id, name) => ({
  id,
  name,
  userId: null,
  sessionHash: '',
  expires: 0,
});
const ann = identity('ann', 'Ann');
const ben = identity('ben', 'Ben');

async function playTurn(c, room) {
  const v = (await c.request(room)).data;
  for (const move of botTurn(v.game, v.viewerSeat)) {
    const r = await command(c, room, move);
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
}

// A fixed deck lets timing and Peek tests exercise the room independently
// of the random seed chosen when a table launches it.
function seededRoom(seed, extra = {}, options = {}) {
  const db = openDatabase(':memory:');
  const rooms = new MetroRooms(db, { inline: true, ...options });
  const setup = launch({ seats: 2, ...extra });
  const token = rooms.launch('table', ann.id, [ann, ben], setup);
  const state = JSON.parse(
    db.prepare('SELECT state FROM metro_rooms WHERE token=?').get(token).state,
  );
  state.game = createMetro(2, seed, {
    ...setup,
    names: [ann.name, ben.name],
    bots: [false, false],
  });
  db.prepare('UPDATE metro_rooms SET state=? WHERE token=?').run(
    JSON.stringify(state),
    token,
  );
  return {
    db,
    rooms,
    token,
    saved: () =>
      JSON.parse(
        db.prepare('SELECT state FROM metro_rooms WHERE token=?').get(token)
          .state,
      ),
  };
}

await test('a table launches Metro with people seated first and bots filling the rest', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    for (const input of [
      launch({ map: 'moon' }),
      launch({ difficulty: 'expert' }),
      launch({ ext: null }),
      launch({ ext: { goals: false } }),
      launch({ ext: { goals: 'yes', express: false } }),
      launch({ ext: { goals: false, express: 1 } }),
    ])
      assert.equal((await host.request(`${path}/launch`, input)).status, 400);
    for (const seats of [0, 1, 2.5, 7]) {
      const rejected = await host.request(`${path}/launch`, launch({ seats }));
      assert.equal(rejected.status, 409);
      assert.equal(rejected.data.error, 'Metro seats one to six players.');
    }
    assert.equal((await guest.request(`${path}/launch`, launch())).status, 403);
    const t = (await guest.request(path)).data;
    const voted = await guest.request(`${path}/commands`, {
      revision: t.revision,
      matchId: t.matchId,
      requestId: randomUUID(),
      action: { type: 'vote', gameId: 'metro' },
    });
    assert.equal(voted.status, 200, JSON.stringify(voted.data));
    assert.deepEqual(voted.data.votes.metro, [guest.id]);
    const launched = await host.request(`${path}/launch`, launch());
    assert.equal(launched.status, 200, JSON.stringify(launched.data));
    assert.match(launched.data.url, /^\/metro\/[A-Za-z0-9_-]{32}$/);
    assert.equal((await guest.request(path)).data.handoff.kind, 'metro');
    const room = roomOf(launched.data.url);
    const mine = (await host.request(room)).data;
    const theirs = (await guest.request(room)).data;
    assert.equal(mine.viewerSeat, 0);
    assert.equal(theirs.viewerSeat, 1);
    assert.ok(mine.isOwner && !theirs.isOwner);
    assert.equal(mine.ownerId, host.id);
    assert.deepEqual(
      mine.seats.map((s) => [s.name, s.bot]),
      [
        ['Host', false],
        ['Guest', false],
        ['Bot 3', true],
      ],
    );
    assert.ok(mine.game.seats[2].locked);
    assert.deepEqual(mine.game.seats[2].sections, []);
    assert.deepEqual(mine.game.deck, []);
    assert.equal(mine.game.rngState, 0);
    const stranger = client();
    await stranger.request(`${path}/join`, { name: 'Late' });
    assert.equal((await stranger.request(room)).status, 403);
    assert.equal((await command(stranger, room, { type: 'done' })).status, 403);
  } finally {
    await close();
  }
});

await test('turn drafts stay private, commands replay once, and every seat must lock to flip', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    const room = roomOf(
      (await host.request(`${path}/launch`, launch())).data.url,
    );
    let mine = (await host.request(room)).data;
    // A card can legitimately offer no draw; skipping it must still work.
    for (let i = 0; i < 12 && !legalDraws(mine.game, 0).length; i++) {
      assert.equal((await command(host, room, { type: 'done' })).status, 200);
      assert.equal((await command(guest, room, { type: 'done' })).status, 200);
      mine = (await host.request(room)).data;
    }
    const draw = legalDraws(mine.game, 0)[0];
    assert.ok(draw, 'a turn offers a section');
    const first = { type: 'draw', ...draw };
    const id = randomUUID();
    const played = await command(host, room, first, id);
    assert.equal(played.status, 200);
    const replay = await command(host, room, first, id);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.game.revision, played.data.game.revision);
    assert.equal(replay.data.game.seats[0].sections.length, 1);
    const seen = (await guest.request(room)).data;
    assert.equal(seen.game.seats[0].hidden, 1);
    assert.deepEqual(seen.game.seats[0].sections, []);
    assert.deepEqual(seen.game.deck, []);
    assert.equal((await command(host, room, first)).status, 409);
    for (const move of [
      null,
      { type: 'bogus' },
      { type: 'draw', from: -1, to: 1000 },
    ])
      assert.equal((await command(host, room, move)).status, 409);
    assert.equal(
      (await command(host, room, { type: 'done' }, 'bad')).status,
      400,
    );
    assert.equal((await command(host, room, { type: 'done' })).status, 200);
    assert.equal((await command(host, room, { type: 'done' })).status, 409);
    const waiting = (await host.request(room)).data;
    assert.equal(waiting.game.round, mine.game.round);
    assert.equal(waiting.game.turn, mine.game.turn, 'waits for the guest');
    assert.equal(
      (await command(guest, room, { type: 'done' }, id)).status,
      200,
      'request IDs are scoped to the player',
    );
    const next = (await guest.request(room)).data;
    assert.ok(
      next.game.round !== mine.game.round || next.game.turn !== mine.game.turn,
    );
    assert.equal(
      next.game.seats[0].sections.length,
      1,
      'finished turn sections become public',
    );
    assert.equal(next.game.seats[0].hidden, undefined);
    assert.ok(next.game.seats[2].locked, 'the bot locks the next turn too');
    const revision = next.game.revision;
    const lateReplay = await command(host, room, first, id);
    assert.equal(lateReplay.status, 200);
    assert.equal(
      lateReplay.data.game.revision,
      revision,
      'a delayed retry cannot play on a later turn',
    );
  } finally {
    await close();
  }
});

await test('stale turn identity is refused while current and legacy commands still work', () => {
  const { db, rooms, token, saved } = seededRoom(1);
  try {
    const { round, turn } = saved().game;
    const first = {
      requestId: randomUUID(),
      move: { type: 'done' },
      at: { round, turn },
    };
    rooms.command(token, ann, first);
    rooms.command(token, ben, {
      requestId: randomUUID(),
      move: { type: 'done' },
    });
    const before = saved();
    assert.equal(before.game.turn, turn + 1);
    const requestId = randomUUID();
    for (const at of [
      { round, turn },
      { round: round + 1, turn: before.game.turn },
      { round: String(round), turn: before.game.turn },
      { round },
      null,
      [],
      'invalid',
    ]) {
      assert.throws(
        () =>
          rooms.command(token, ann, { requestId, move: { type: 'done' }, at }),
        { status: 409, message: 'That move no longer fits.' },
      );
      assert.deepEqual(saved(), before, 'a rejected command is not saved');
    }
    const replay = rooms.command(token, ann, first);
    assert.equal(
      replay.game.revision,
      before.game.revision,
      'an accepted retry stays idempotent',
    );
    const current = rooms.command(token, ann, {
      requestId,
      move: { type: 'done' },
      at: { round: before.game.round, turn: before.game.turn },
    });
    assert.equal(current.game.seats[0].locked, true);
    assert.equal(current.game.revision, before.game.revision + 1);
  } finally {
    db.close();
  }
});

await test('an accepted undo replay after a restart cannot remove a newer section', () => {
  const { db, rooms, token, saved } = seededRoom(1);
  try {
    const draws = legalDraws(saved().game, 0);
    assert.ok(draws.length >= 2);
    const first = rooms.command(token, ann, {
      requestId: randomUUID(),
      move: { type: 'draw', ...draws[0] },
    });
    const undo = { requestId: randomUUID(), move: { type: 'undo' } };
    const undone = rooms.command(token, ann, undo);
    assert.deepEqual(undone.game.seats[0].sections, []);

    const restarted = new MetroRooms(db, { inline: true, awayMs: Infinity });
    const newer = restarted.command(token, ann, {
      requestId: randomUUID(),
      move: { type: 'draw', ...draws[1] },
    });
    assert.equal(newer.game.seats[0].sections.length, 1);
    assert.notDeepEqual(
      newer.game.seats[0].sections,
      first.game.seats[0].sections,
    );
    const before = saved();
    const replay = restarted.command(token, ann, undo);
    assert.deepEqual(replay.game, newer.game);
    assert.deepEqual(
      saved(),
      before,
      'a replay does not write or undo the new section',
    );
  } finally {
    db.close();
  }
});

await test('accepted request keys stay bounded and reset with the next match', () => {
  const { db, rooms, token, saved } = seededRoom(1);
  try {
    const ids = [];
    for (let i = 0; i < 420; i++) {
      const requestId = randomUUID();
      ids.push(`${ann.id}:${requestId}`);
      rooms.command(token, ann, {
        requestId,
        move: { type: i % 2 === 0 ? 'done' : 'reopen' },
      });
    }
    assert.deepEqual(saved().acceptedRequests, ids.slice(-400));
    const oldMatch = saved().matchId;
    let last;
    while (!saved().game.over) {
      for (const who of [ann, ben]) {
        const { round, turn } = saved().game;
        last = {
          requestId: randomUUID(),
          move: { type: 'done' },
          at: { round, turn },
        };
        rooms.command(token, who, last);
      }
    }
    rooms.again(token, ann);
    assert.notEqual(saved().matchId, oldMatch);
    assert.deepEqual(saved().acceptedRequests, []);
    assert.throws(() => rooms.command(token, ben, last), {
      status: 409,
      message: 'That move no longer fits.',
    });
    rooms.command(token, ben, { requestId: last.requestId, move: last.move });
    assert.equal(
      saved().game.seats[1].locked,
      true,
      'request keys belong only to the previous match',
    );
  } finally {
    db.close();
  }
});

await test('a poll resumes a permanent bot after restarting with the human locked', () => {
  const { db, token, saved } = seededRoom(1);
  try {
    const state = saved();
    state.members = [ann];
    state.seats[1] = null;
    state.game.seats[1].bot = true;
    state.game = play(state.game, { type: 'done' }, 0);
    db.prepare('UPDATE metro_rooms SET state=? WHERE token=?').run(
      JSON.stringify(state),
      token,
    );
    assert.equal(saved().game.seats[0].locked, true);
    assert.equal(saved().game.seats[1].locked, false);

    const restarted = new MetroRooms(db, { inline: true });
    restarted.get(token, ann);
    const after = saved().game;
    assert.equal(after.round, state.game.round);
    assert.equal(
      after.turn,
      state.game.turn + 1,
      'the bot finished the waiting turn',
    );
    assert.ok(after.seats[1].sections.some((s) => s.t === state.game.turn));
    assert.equal(after.seats[0].locked, false);
    assert.equal(
      after.seats[1].locked,
      true,
      'the bot also locks the new turn',
    );
    restarted.get(token, ann);
    assert.deepEqual(
      saved().game,
      after,
      'another poll does not replay the bot',
    );
  } finally {
    db.close();
  }
});

await test('Express Peek reveals exactly the next card, and other rounds hide the deck', () => {
  const { db, rooms, token, saved } = seededRoom(1, {
    ext: { goals: true, express: true },
  });
  const done = (who) =>
    rooms.command(token, who, {
      requestId: randomUUID(),
      move: { type: 'done' },
    });
  try {
    const full = saved().game;
    assert.equal(full.express[0], 'peek');
    assert.ok(full.deck.length > 1);
    for (const who of [ann, ben]) {
      const view = rooms.get(token, who);
      assert.deepEqual(view.game.deck, full.deck.slice(0, 1));
      assert.equal(view.game.deckSize, full.deck.length);
      assert.equal(view.game.rngState, 0);
    }
    done(ann);
    done(ben);
    assert.equal(rooms.get(token, ann).game.cards[0], full.deck[0]);
    for (let i = 0; i < 12 && saved().game.round === 1; i++) {
      done(ann);
      done(ben);
    }
    const next = rooms.get(token, ann).game;
    assert.equal(next.round, 2);
    assert.notEqual(next.express[1], 'peek');
    assert.deepEqual(next.deck, []);
    assert.equal(next.deckSize, saved().game.deck.length);
  } finally {
    db.close();
  }
});

await test('an away seat is covered after 45 seconds without losing sections already drawn', (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const { db, rooms, token, saved } = seededRoom(2);
  try {
    rooms.get(token, ann, now);
    rooms.get(token, ben, now);
    const first = {
      type: 'draw',
      ...legalDraws(rooms.get(token, ben, now).game, 1)[0],
    };
    const drafted = rooms.command(
      token,
      ben,
      { requestId: randomUUID(), move: first },
      now,
    );
    const section = drafted.game.seats[1].sections[0];
    assert.ok(section);
    rooms.command(
      token,
      ann,
      { requestId: randomUUID(), move: { type: 'done' } },
      now,
    );
    now += 44_999;
    const before = rooms.get(token, ann, now);
    assert.equal(before.seats[1].away, false);
    assert.equal(saved().game.turn, 1);
    now++;
    const covered = rooms.get(token, ann, now);
    assert.equal(covered.seats[1].away, true);
    const after = saved().game;
    assert.equal(after.turn, 2);
    assert.ok(
      after.seats[1].sections.some(
        (s) => JSON.stringify(s) === JSON.stringify(section),
      ),
    );
    const returned = rooms.get(token, ben, now);
    assert.equal(returned.seats[1].away, false);
    assert.equal(returned.seats[1].online, true);
    assert.equal(returned.seats[1].bot, false);
    assert.equal(
      returned.game.seats[1].locked,
      true,
      'the bot also locked the following turn',
    );
    const reopened = rooms.command(token, ben, {
      requestId: randomUUID(),
      move: { type: 'reopen' },
    });
    assert.equal(
      reopened.game.seats[1].locked,
      false,
      'the person can play again on return',
    );
  } finally {
    db.close();
  }
});

await test('a late away-seat bot result is dropped after the human polls again', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const { db, rooms, token, saved } = seededRoom(2, {}, { inline: false });
  const changed = [];
  rooms.onChange = (room) => changed.push(room);
  try {
    rooms.command(token, ben, {
      requestId: randomUUID(),
      move: { type: 'draw', ...legalDraws(saved().game, 1)[0] },
    });
    const before = saved();
    now += 45_000;
    rooms.get(token, ann);
    assert.equal(rooms.thinking.size, 1, 'an away-seat worker is in flight');
    rooms.get(token, ann);
    assert.equal(rooms.thinking.size, 1, 'polls share the per-turn worker');
    const returned = rooms.get(token, ben);
    assert.equal(returned.seats[1].away, false);
    assert.equal(returned.game.seats[1].locked, false);

    await until(
      () => rooms.thinking.size === 0,
      'the away-seat worker finishes',
    );
    assert.deepEqual(changed, [], 'a dropped result is not published');
    assert.deepEqual(
      saved(),
      before,
      'the worker neither draws nor locks for the returned human',
    );
    const locked = rooms.command(token, ben, {
      requestId: randomUUID(),
      move: { type: 'done' },
    });
    assert.equal(
      locked.game.seats[1].locked,
      true,
      'the human still controls the seat',
    );
  } finally {
    db.close();
  }
});

await test('a match with bots plays to the end and only the admin may start another', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    const room = roomOf(
      (
        await host.request(
          `${path}/launch`,
          launch({ ext: { goals: true, express: true } }),
        )
      ).data.url,
    );
    assert.equal((await guest.request(`${room}/again`, {})).status, 403);
    assert.equal((await host.request(`${room}/again`, {})).status, 409);
    let view = (await host.request(room)).data;
    const rounds = new Set();
    for (let turn = 0; turn < 50 && !view.game.over; turn++) {
      rounds.add(view.game.round);
      assert.ok(
        view.game.seats[2].locked,
        `bot has locked round ${view.game.round}, turn ${view.game.turn}`,
      );
      await playTurn(host, room);
      await playTurn(guest, room);
      view = (await host.request(room)).data;
    }
    assert.ok(view.game.over);
    assert.deepEqual([...rounds], [1, 2, 3, 4]);
    assert.equal(view.game.final.length, 3);
    assert.ok(
      view.game.seats[2].sections.length > 0,
      'the bot drew its own map',
    );
    assert.deepEqual(view.game.deck, []);
    assert.equal((await command(host, room, { type: 'done' })).status, 409);
    assert.equal((await guest.request(`${room}/again`, {})).status, 403);
    const again = await host.request(`${room}/again`, {});
    assert.equal(again.status, 200, JSON.stringify(again.data));
    assert.equal(again.data.game.round, 1);
    assert.equal(again.data.game.turn, 1);
    assert.equal(again.data.game.over, false);
    assert.deepEqual(again.data.game.ext, { goals: true, express: true });
    assert.deepEqual(
      again.data.seats.map((s) => s.name),
      ['Host', 'Guest', 'Bot 3'],
    );
    assert.deepEqual(again.data.game.seats[0].sections, []);
    assert.ok((await host.request(room)).data.game.seats[2].locked);
  } finally {
    await close();
  }
});

await test('a worker locks consecutive turns in the same round and publishes each change', async () => {
  const db = openDatabase(':memory:');
  const rooms = new MetroRooms(db);
  const changed = [];
  rooms.onChange = (token) => changed.push(token);
  const token = rooms.launch('table', ann.id, [ann], launch({ seats: 2 }));
  try {
    await until(
      () => rooms.get(token, ann).game.seats[1].locked,
      'worker locks the first turn',
    );
    assert.deepEqual(changed, [token]);
    rooms.command(token, ann, {
      requestId: randomUUID(),
      move: { type: 'done' },
    });
    await until(() => {
      const game = rooms.get(token, ann).game;
      return game.turn === 2 && game.seats[1].locked;
    }, 'worker locks the next turn');
    assert.equal(rooms.get(token, ann).game.round, 1);
    assert.deepEqual(changed, [token, token]);
  } finally {
    db.close();
  }
});

await test('the Metro room follows a table admin handoff', async () => {
  const { client, close } = await fixture();
  try {
    const { host, guest, path } = await table(client);
    const room = roomOf(
      (await host.request(`${path}/launch`, launch({ seats: 2 }))).data.url,
    );
    const t = (await host.request(path)).data;
    const changed = await host.request(`${path}/commands`, {
      revision: t.revision,
      matchId: t.matchId,
      requestId: randomUUID(),
      action: { type: 'owner', memberId: guest.id },
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    const mine = (await guest.request(room)).data;
    assert.equal(mine.ownerId, guest.id);
    assert.equal(mine.isOwner, true);
    assert.equal(mine.viewerSeat, 1, 'handing over does not move any seat');
    assert.equal((await host.request(room)).data.isOwner, false);
    assert.equal((await host.request(`${room}/again`, {})).status, 403);
    assert.equal(
      (await guest.request(`${room}/again`, {})).status,
      409,
      'the new admin still waits for the end',
    );
  } finally {
    await close();
  }
});

await test('the room and its drawn sections survive a server restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-metro-online-'));
  const database = join(dir, 'gamehub.sqlite');
  let app = await fixture({}, { database });
  try {
    const { host, guest, path } = await table(app.client);
    const room = roomOf(
      (await host.request(`${path}/launch`, launch())).data.url,
    );
    let before = (await host.request(room)).data;
    for (let i = 0; i < 12 && !legalDraws(before.game, 0).length; i++) {
      assert.equal((await command(host, room, { type: 'done' })).status, 200);
      assert.equal((await command(guest, room, { type: 'done' })).status, 200);
      before = (await host.request(room)).data;
    }
    const draw = legalDraws(before.game, 0)[0];
    assert.ok(draw, 'a turn offers a section to persist');
    assert.equal(
      (await command(host, room, { type: 'draw', ...draw })).status,
      200,
    );
    before = (await host.request(room)).data;
    assert.equal(before.game.seats[0].sections.length, 1);
    const cookie = host.cookie;
    await app.close();
    app = null;
    app = await fixture({}, { database });
    const restored = await app.client(cookie).request(room);
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    assert.equal(restored.data.token, before.token);
    assert.equal(restored.data.ownerId, before.ownerId);
    assert.equal(restored.data.viewerSeat, before.viewerSeat);
    assert.equal(restored.data.game.round, before.game.round);
    assert.equal(restored.data.game.turn, before.game.turn);
    assert.deepEqual(
      restored.data.game.seats[0].sections,
      before.game.seats[0].sections,
    );
    assert.deepEqual(restored.data.game.ext, before.game.ext);
    assert.ok(restored.data.game.seats[2].locked);
    assert.deepEqual(restored.data.game.deck, []);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

await test('saved rooms from an earlier Metro edition are rejected', () => {
  const { db, rooms, token, saved } = seededRoom(1);
  try {
    const state = saved();
    state.game.rules++;
    db.prepare('UPDATE metro_rooms SET state=? WHERE token=?').run(
      JSON.stringify(state),
      token,
    );
    assert.throws(() => rooms.get(token, ann), {
      status: 410,
      message: 'This match belongs to an earlier edition of Metro.',
    });
  } finally {
    db.close();
  }
});

await test('Metro setup and room URLs serve the SPA entry', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-metro-spa-'));
  const html = '<!doctype html><title>Metro route fixture</title>';
  writeFileSync(join(dir, 'index.html'), html);
  const app = await fixture({}, { staticDir: dir });
  try {
    for (const path of ['/metro', `/metro/${'a'.repeat(32)}`]) {
      const res = await fetch(app.base + path);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /^text\/html/);
      assert.equal(await res.text(), html);
    }
    assert.equal((await fetch(`${app.base}/metro/short`)).status, 404);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
