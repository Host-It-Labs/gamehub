import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeServer } from '../server/index.ts';
import { cards } from '../lib/games/arena/cards.ts';
import { nearestLegal } from '../lib/games/arena/engine.ts';
import { checksum, replay } from '../lib/games/arena/net.ts';

const origin = 'http://localhost:3017';

/** A server on a free port with a faster Arena clock. */
async function fixture(arena = {}) {
  const app = await makeServer({
    database: ':memory:',
    origin,
    bots: false,
    arena,
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
      listen(path, handle) {
        return listen(
          fetch(base + path, {
            headers: { Cookie: cookie, Origin: origin },
            signal: controller.signal,
          }),
          handle,
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

/** Reads an event stream in the background into `events`. */
function listen(pending, handle = () => {}) {
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
          if (data === undefined) continue;
          stream.events.push({ event, data });
          handle(event, data);
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      stream.done = true;
    });
  return stream;
}

/**
 * A device following a room: it keeps the match from its snapshot and
 * replays every tick's cards, checking each server checksum.
 */
function follow(c, room) {
  const f = {
    room: null,
    match: null,
    horizon: 0,
    plays: new Map(),
    seen: [],
    sums: new Map(),
    verified: [],
    drift: [],
    gaps: 0,
    snapshots: 0,
    gone: false,
  };
  f.stream = c.listen(`${room}/events`, (event, data) => {
    if (event === 'snapshot') {
      f.room = data.room;
      f.match = data.match;
      f.horizon = data.horizon;
      f.plays = new Map();
      f.snapshots++;
    } else if (event === 'room') f.room = data;
    else if (event === 'gone') f.gone = true;
    else if (event === 'message' && f.match) {
      if (data.h !== f.horizon + 1) f.gaps++;
      for (const play of data.c ?? []) {
        f.seen.push(play);
        f.plays.set(play[0], [...(f.plays.get(play[0]) ?? []), play]);
      }
      replay(f.match, data.h, f.plays);
      f.horizon = data.h;
      if (data.k) {
        f.sums.set(data.k[0], data.k[1]);
        const ok =
          f.match.tick === data.k[0] && checksum(f.match) === data.k[1];
        (ok ? f.verified : f.drift).push(data.k[0]);
      }
    }
  });
  return f;
}

async function until(condition, what, timeout = 8000) {
  const end = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** A signed-in host with guests at a table, every guest's table stream open. */
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
const roomOf = (url) => url.replace('/arena/', '/api/arena/');
/** The most expensive card in a player's hand. */
const dearest = (m, player) => {
  const hand = m.players[player].hand.cards;
  return hand.reduce(
    (best, id, i) => (cards[id].cost > cards[hand[best]].cost ? i : best),
    0,
  );
};
/** A troop card's slot, since the Meteor may land anywhere. */
const troopSlot = (m, player) =>
  m.players[player].hand.cards.findIndex((id) => cards[id].kind === 'troop');

await test('a duel launched from a table seats its two people on opposite sides and hands the table off', async () => {
  const { app, client, close } = await fixture();
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'brawl',
          difficulty: 'easy',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'duel',
          difficulty: 'expert',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'duel',
          difficulty: 'easy',
          teams: { stranger: 0 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'duel',
          difficulty: 'easy',
          teams: { [host.id]: 2 },
        })
      ).status,
      400,
    );
    // Two people on one side do not fit a duel.
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'duel',
          difficulty: 'easy',
          teams: { [host.id]: 1, [guest.id]: 1 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await guest.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'duel',
          difficulty: 'easy',
        })
      ).status,
      403,
    );
    // Guests can suggest Arena to the host.
    const t = (await guest.request(path)).data;
    const voted = await guest.request(`${path}/commands`, {
      revision: t.revision,
      matchId: t.matchId,
      requestId: randomUUID(),
      action: { type: 'vote', gameId: 'arena' },
    });
    assert.equal(voted.status, 200);
    assert.deepEqual(voted.data.votes.arena, [guest.id]);
    const launched = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'duel',
      difficulty: 'easy',
    });
    assert.equal(launched.status, 200);
    assert.match(launched.data.url, /^\/arena\/[A-Za-z0-9_-]{32}$/);
    const handoff = (await guest.request(path)).data.handoff;
    assert.equal(handoff.kind, 'arena');
    assert.equal(handoff.url, launched.data.url);
    const room = roomOf(launched.data.url);
    const mine = (await host.request(room)).data;
    assert.deepEqual(mine.room.seats, [
      { name: 'Host', bot: false, connected: false },
      { name: 'Guest', bot: false, connected: false },
    ]);
    assert.equal(mine.room.you, 0);
    assert.equal(mine.room.host, true);
    assert.equal(mine.room.mode, 'duel');
    assert.equal(mine.room.status, 'waiting');
    assert.equal(mine.room.round, 1);
    assert.equal(mine.room.table, path.split('/').pop());
    assert.equal(mine.match.players.length, 2);
    assert.equal(mine.horizon, 0);
    const theirs = (await guest.request(room)).data;
    assert.equal(theirs.room.you, 1);
    assert.equal(theirs.room.host, false);
    assert.equal(theirs.match.players[1].side, 1);

    // Nobody else may watch, play or listen.
    const outsider = client();
    await outsider.request('/api/auth/signup', {
      name: 'Outsider',
      email: 'out@example.com',
      password: 'test-password-123',
    });
    assert.equal((await outsider.request(room)).status, 403);
    assert.equal((await client().request(room)).status, 403);
    assert.equal(
      (
        await outsider.request(`${room}/commands`, {
          round: 1,
          slot: 0,
          x: 3.5,
          y: 10,
        })
      ).status,
      403,
    );
    assert.equal((await outsider.request(`${room}/again`, {})).status, 403);
    const denied = outsider.listen(`${room}/events`);
    await until(() => denied.done, 'refused stream');
    assert.equal(denied.status, 403);
    assert.equal(
      (await host.request(`/api/arena/${'x'.repeat(32)}`)).status,
      404,
    );

    // Relaunching abandons the first room: anyone still in it is told.
    const watcher = follow(host, room);
    await until(() => watcher.snapshots === 1, 'snapshot');
    const again = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'duel',
      difficulty: 'hard',
    });
    assert.equal(again.status, 200);
    assert.notEqual(again.data.url, launched.data.url);
    await until(() => watcher.gone, 'gone event');
    assert.equal((await host.request(room)).status, 404);
    // A room nobody opens is swept after the idle period.
    const second = roomOf(again.data.url);
    assert.equal((await host.request(second)).status, 200);
    app.arena.sweep(Date.now() + 10 * 60_000);
    assert.equal((await host.request(second)).status, 404);
  } finally {
    await close();
  }
});

await test('a team launch seats the chosen side together with bot partners across the field', async () => {
  const { client, close } = await fixture();
  try {
    const { host, path, guests } = await table(client, ['Guest', 'Third']);
    const [guest, third] = guests;
    // Three people do not fit a duel.
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'duel',
          difficulty: 'easy',
        })
      ).status,
      409,
    );
    const together = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'team',
      difficulty: 'medium',
      teams: { [host.id]: 1, [guest.id]: 1, [third.id]: 0 },
    });
    assert.equal(together.status, 200);
    const view = (await guest.request(roomOf(together.data.url))).data;
    assert.deepEqual(
      view.room.seats.map((s) => [s.name, s.bot]),
      [
        ['Third', false],
        ['Host', false],
        ['Warden', true],
        ['Guest', false],
      ],
    );
    assert.equal(view.room.you, 3);
    assert.deepEqual(
      view.match.players.map((p) => p.side),
      [0, 1, 0, 1],
    );
    // Three on one side do not fit.
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'team',
          difficulty: 'hard',
          teams: { [host.id]: 0, [guest.id]: 0, [third.id]: 0 },
        })
      ).status,
      409,
    );
    // Without teams people alternate sides, starting with the host.
    const plain = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'team',
      difficulty: 'easy',
    });
    assert.deepEqual(
      (await third.request(roomOf(plain.data.url))).data.room.seats.map((s) => [
        s.name,
        s.bot,
      ]),
      [
        ['Host', false],
        ['Guest', false],
        ['Third', false],
        ['Rook', true],
      ],
    );
  } finally {
    await close();
  }
});

await test('two people on one side of a team battle get two numbered bots against them', async () => {
  const { client, close } = await fixture();
  try {
    const { host, path, guests } = await table(client);
    const launched = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'team',
      difficulty: 'hard',
      teams: { [host.id]: 0, [guests[0].id]: 0 },
    });
    const view = (await host.request(roomOf(launched.data.url))).data;
    assert.deepEqual(
      view.room.seats.map((s) => [s.name, s.bot]),
      [
        ['Host', false],
        ['Marshal 1', true],
        ['Guest', false],
        ['Marshal 2', true],
      ],
    );
  } finally {
    await close();
  }
});

await test('commands are checked against the battle: phase, round, spot and elixir', async () => {
  const { client, close } = await fixture({ tickMs: 10, startDelayMs: 20 });
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    const url = (
      await host.request(`${path}/launch`, {
        kind: 'arena',
        mode: 'duel',
        difficulty: 'easy',
      })
    ).data.url;
    const room = roomOf(url);
    const play = (who, input) =>
      who.request(`${room}/commands`, {
        round: 1,
        slot: 0,
        x: 3.5,
        y: 10,
        ...input,
      });
    // Nobody is connected yet, so the battle has not begun.
    let refused = await play(host, {});
    assert.equal(refused.status, 409);
    assert.equal(refused.data.reason, 'phase');
    for (const input of [
      { slot: 4 },
      { slot: 1.5 },
      { x: 3.3 },
      { y: 32 },
      { x: '3' },
      { round: 'one' },
    ])
      assert.equal(
        (await play(host, input)).status,
        400,
        JSON.stringify(input),
      );
    const mine = follow(host, room);
    const theirs = follow(guest, room);
    await until(() => mine.room?.status === 'playing', 'the battle to start');
    assert.equal(
      mine.room.seats.every((s) => s.connected),
      true,
    );
    await until(() => mine.match?.phase === 'battle', 'the ready count');
    refused = await play(host, { round: 2 });
    assert.equal(refused.data.reason, 'round');
    // A troop past the river or on a tower is refused.
    const troop = troopSlot(mine.match, 0);
    refused = await play(host, { slot: troop, y: 25 });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.reason, 'place');
    assert.equal(
      (await play(host, { slot: troop, x: 9, y: 3 })).data.reason,
      'place',
    );
    assert.equal(
      (await play(guest, { slot: troopSlot(theirs.match, 1), y: 10 })).data
        .reason,
      'place',
    );
    assert.equal((await host.request(`${room}/again`, {})).status, 409);
    // The dearest card leaves too little elixir for the dearest one after it.
    const first = dearest(mine.match, 0);
    // The drawn card may be a long Dino, whose full body needs more clearance.
    const firstAt = nearestLegal(
      mine.match,
      0,
      mine.match.players[0].hand.cards[first],
      3.5,
      10,
    );
    assert.ok(firstAt, 'the first card has a legal deployment');
    const played = await play(host, {
      slot: first,
      x: firstAt[0],
      y: firstAt[1],
    });
    assert.deepEqual(played.data, { ok: true });
    await until(() => mine.seen.some((p) => p[1] === 0), 'the card to land');
    assert.deepEqual(mine.seen[0].slice(1), [0, first, ...firstAt]);
    const second = dearest(mine.match, 0);
    const secondAt = nearestLegal(
      mine.match,
      0,
      mine.match.players[0].hand.cards[second],
      14.5,
      10,
    );
    assert.ok(secondAt, 'the elixir check uses a legal deployment');
    refused = await play(host, {
      slot: second,
      x: secondAt[0],
      y: secondAt[1],
    });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.reason, 'elixir');
    assert.equal(typeof refused.data.error, 'string');
    // The guest plays from the top half.
    const guestAt = nearestLegal(
      theirs.match,
      1,
      theirs.match.players[1].hand.cards[0],
      14.5,
      22,
    );
    assert.ok(guestAt, 'the guest card has a legal deployment');
    assert.deepEqual(
      (await play(guest, { x: guestAt[0], y: guestAt[1] })).data,
      { ok: true },
    );
    await until(() => theirs.seen.some((p) => p[1] === 1), 'the guest card');
    await until(
      () => mine.verified.length >= 2 && theirs.verified.length >= 2,
      'checksums',
    );
    assert.deepEqual(mine.drift, []);
    assert.deepEqual(theirs.drift, []);
  } finally {
    await close();
  }
});

await test('a Meteor cast online lands on the enemy half the same on every device', async () => {
  const { app, client, close } = await fixture({ tickMs: 3, startDelayMs: 20 });
  try {
    const { host, path, guests } = await table(client);
    const url = (
      await host.request(`${path}/launch`, {
        kind: 'arena',
        mode: 'duel',
        difficulty: 'easy',
      })
    ).data.url;
    const room = roomOf(url);
    // Deal the host the Meteor before anyone has the room open.
    const server = app.arena.rooms.get(url.split('/').pop()).match;
    const hand = server.players[0].hand;
    if (!hand.cards.includes('meteor')) {
      const q = hand.queue.indexOf('meteor');
      [hand.cards[0], hand.queue[q]] = [hand.queue[q], hand.cards[0]];
    }
    const slot = hand.cards.indexOf('meteor');
    const mine = follow(host, room);
    const theirs = follow(guests[0], room);
    await until(
      () => mine.match?.phase === 'battle' && theirs.match?.phase === 'battle',
      'the battle',
    );
    assert.equal(mine.match.players[0].hand.cards[slot], 'meteor');
    const target = (m) =>
      m.towers.find(
        (t) => t.side === 1 && t.kind === 'princess' && t.lane === 0,
      );
    const { x, y } = target(mine.match);
    // A troop may not go there; the Meteor may, right on their tower.
    const command = (input) =>
      host.request(`${room}/commands`, { round: 1, x, y, ...input });
    assert.equal(
      (await command({ slot: troopSlot(mine.match, 0) })).data.reason,
      'place',
    );
    assert.equal(
      (await command({ slot, x: 18 })).status,
      400,
      'but not off the field',
    );
    assert.deepEqual((await command({ slot })).data, { ok: true });
    await until(() => mine.seen.length === 1, 'the cast');
    const at = mine.seen[0][0];
    await until(
      () => [mine, theirs].every((f) => f.verified.some((t) => t >= at + 30)),
      'a checksum after the crash',
    );
    // One checksum fell while the rock was still in the air.
    assert.ok(mine.verified.some((t) => t >= at && t < at + 30));
    assert.deepEqual(mine.drift, []);
    assert.deepEqual(theirs.drift, []);
    for (const m of [mine.match, theirs.match, server]) {
      assert.equal(target(m).hp, target(m).maxHp - 190);
      assert.equal(m.spells.length, 0);
      assert.equal(m.players[0].hand.queue.at(-1), 'meteor');
    }
  } finally {
    await close();
  }
});

await test('two devices replaying the stream reach the server checksum with human and bot cards', async () => {
  const { app, client, close } = await fixture({ tickMs: 3, startDelayMs: 20 });
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    const url = (
      await host.request(`${path}/launch`, {
        kind: 'arena',
        mode: 'team',
        difficulty: 'hard',
        teams: { [host.id]: 0, [guest.id]: 0 },
      })
    ).data.url;
    const room = roomOf(url);
    const mine = follow(host, room);
    const theirs = follow(guest, room);
    await until(
      () => mine.match?.phase === 'battle' && theirs.match?.phase === 'battle',
      'the battle',
    );
    // Both people spend big, which invites the bots across the river.
    for (const [who, f, player, x] of [
      [host, mine, 0, 3.5],
      [guest, theirs, 2, 14.5],
    ]) {
      const slot = dearest(f.match, player);
      const seat = f.match.players[player];
      const at = nearestLegal(f.match, seat.side, seat.hand.cards[slot], x, 11);
      assert.ok(at, 'the selected card has a legal deployment');
      assert.deepEqual(
        (
          await who.request(`${room}/commands`, {
            round: 1,
            slot,
            x: at[0],
            y: at[1],
          })
        ).data,
        { ok: true },
      );
    }
    const people = (p) => p[1] === 0 || p[1] === 2;
    await until(() => {
      const last = Math.max(
        ...mine.seen.filter((p) => !people(p)).map((p) => p[0]),
        -1,
      );
      return (
        mine.seen.filter(people).length === 2 &&
        last > 0 &&
        mine.verified.some((t) => t > last) &&
        theirs.verified.some((t) => t > last)
      );
    }, 'bot cards and a checksum after them');
    assert.deepEqual(mine.drift, []);
    assert.deepEqual(theirs.drift, []);
    assert.equal(mine.gaps + theirs.gaps, 0);
    const shared = Math.min(mine.horizon, theirs.horizon);
    const upTo = (f) => JSON.stringify(f.seen.filter((p) => p[0] <= shared));
    assert.equal(upTo(mine), upTo(theirs));
    const server = app.arena.rooms.get(url.split('/').pop()).match;
    assert.ok(server.tick >= mine.horizon);
    // A device that resyncs from a snapshot mid-battle carries on in step.
    const snap = (await host.request(room)).data;
    assert.equal(snap.horizon, snap.match.tick);
    await until(
      () => mine.verified.some((t) => t > snap.horizon),
      'a checksum after the snapshot',
    );
    const at = mine.verified.find((t) => t > snap.horizon);
    const plays = new Map();
    for (const p of mine.seen)
      if (p[0] > snap.horizon && p[0] <= at)
        plays.set(p[0], [...(plays.get(p[0]) ?? []), p]);
    replay(snap.match, at, plays);
    assert.equal(snap.match.tick, at);
    assert.equal(checksum(snap.match), mine.sums.get(at));
  } finally {
    await close();
  }
});

await test('a bot stands in for someone who never connects, until they arrive', async () => {
  const { client, close } = await fixture({
    tickMs: 3,
    startDelayMs: 20,
    startTimeoutMs: 300,
    awayMs: 100,
  });
  try {
    const { host, path, guests } = await table(client);
    const url = (
      await host.request(`${path}/launch`, {
        kind: 'arena',
        mode: 'duel',
        difficulty: 'hard',
      })
    ).data.url;
    const room = roomOf(url);
    const mine = follow(host, room);
    await until(() => mine.snapshots === 1, 'snapshot');
    assert.equal(mine.room.status, 'waiting');
    // The guest never shows, so the battle starts without them.
    await until(() => mine.room.status === 'playing', 'the start timeout');
    assert.deepEqual(
      mine.room.seats.map((s) => s.connected),
      [true, false],
    );
    await until(() => mine.match.phase === 'battle', 'the battle');
    await host.request(`${room}/commands`, {
      round: 1,
      slot: dearest(mine.match, 0),
      x: 3.5,
      y: 11,
    });
    await until(
      () => mine.seen.some((p) => p[1] === 1),
      'the stand-in to play',
    );
    // Once the guest opens the room, the stand-in stops.
    const theirs = follow(guests[0], room);
    await until(
      () => mine.room.seats[1].connected && theirs.snapshots === 1,
      'the guest',
    );
    const from = mine.horizon;
    await until(() => mine.horizon > from + 200, 'more ticks');
    assert.equal(mine.seen.filter((p) => p[1] === 1 && p[0] > from).length, 0);
    assert.deepEqual(mine.drift, []);
    assert.deepEqual(theirs.drift, []);
    assert.ok(theirs.verified.length > 0);
  } finally {
    await close();
  }
});

await test('the host starts the next battle once one is over; the old round is refused', async () => {
  const { client, close } = await fixture({ tickMs: 0.1, startDelayMs: 10 });
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    const url = (
      await host.request(`${path}/launch`, {
        kind: 'arena',
        mode: 'duel',
        difficulty: 'easy',
      })
    ).data.url;
    const room = roomOf(url);
    const mine = follow(host, room);
    const theirs = follow(guest, room);
    // Nobody plays: the clock runs out and the battle ends level.
    await until(
      () => mine.room?.status === 'over' && theirs.room?.status === 'over',
      'the end',
      15000,
    );
    assert.equal(mine.match.phase, 'over');
    assert.equal(mine.match.winner, 'draw');
    assert.equal(mine.verified.at(-1), mine.match.tick);
    assert.deepEqual(mine.drift, []);
    assert.equal(mine.gaps, 0);
    assert.equal((await guest.request(`${room}/again`, {})).status, 403);
    const next = await host.request(`${room}/again`, {});
    assert.deepEqual(next.data, { ok: true });
    await until(
      () => mine.snapshots === 2 && theirs.snapshots === 2,
      'the new battle',
    );
    assert.equal(theirs.room.round, 2);
    assert.equal(theirs.room.status, 'playing');
    const refused = await guest.request(`${room}/commands`, {
      round: 1,
      slot: 0,
      x: 3.5,
      y: 22,
    });
    assert.equal(refused.data.reason, 'round');
  } finally {
    await close();
  }
});

await test('a table plays a Quest together: the host chooses, the guest suggests, battles report back', async () => {
  const { app, client, close } = await fixture({ tickMs: 2, startDelayMs: 10 });
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    const launched = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'team',
      difficulty: 'easy',
      quest: true,
      unlocked: ['viking', 'nonsense'],
    });
    assert.equal(launched.status, 200);
    const room = roomOf(launched.data.url);
    const first = (await guest.request(room)).data;
    assert.equal(first.room.status, 'map');
    assert.equal(first.room.quest.players, 2);
    assert.ok(first.room.quest.pool.includes('viking'));
    assert.equal(first.room.seats.length, 4);
    assert.ok(!first.room.seats[0].bot && !first.room.seats[2].bot);
    // The run opens on its draft. Only the host takes a bundle; the
    // guest's pick is a suggestion everyone sees.
    assert.equal(first.room.quest.screen.kind, 'draft');
    assert.deepEqual(first.room.quest.deck, []);
    assert.equal(
      (await guest.request(`${room}/quest`, { type: 'bundle', bundle: 1 }))
        .status,
      403,
    );
    assert.equal(
      (await guest.request(`${room}/quest`, { suggest: 'bundle:1' })).status,
      200,
    );
    const suggested = (await host.request(room)).data.room.suggestions;
    assert.deepEqual(suggested, [{ key: 'bundle:1', name: 'Guest' }]);
    for (let round = 0; round < 3; round++)
      assert.equal(
        (await host.request(`${room}/quest`, { type: 'bundle', bundle: 1 }))
          .status,
        200,
      );
    // The old charm pick is gone.
    assert.equal(
      (await host.request(`${room}/quest`, { type: 'charm', charm: 'well' }))
        .status,
      409,
    );
    const map = (await host.request(room)).data.room;
    assert.equal(map.quest.deck.length, 6);
    assert.equal(map.quest.screen.kind, 'map');
    assert.deepEqual(map.suggestions, []);
    // A battle stop starts a two against two battle with the run's deck.
    const stop = map.quest.stops.find((s) => s.row === 0).id;
    assert.equal(
      (
        await host.request(`${room}/quest`, {
          type: 'result',
          won: true,
          crowns: 3,
        })
      ).status,
      400,
    );
    assert.equal(
      (await host.request(`${room}/quest`, { type: 'go', stop })).status,
      200,
    );
    const battle = (await host.request(room)).data;
    assert.equal(battle.room.status, 'waiting');
    assert.equal(battle.match.mode, 'team');
    assert.equal(battle.match.regulation, 120);
    assert.deepEqual(
      [...battle.match.players[0].deck].sort((a, b) => a.localeCompare(b)),
      [...map.quest.deck].sort((a, b) => a.localeCompare(b)),
    );
    // Say the battle was won with two crowns; the host continues.
    const live = app.arena.rooms.get(room.split('/').pop());
    live.status = 'over';
    live.match.phase = 'over';
    live.match.winner = 0;
    live.match.crowns = [2, 0];
    assert.equal((await guest.request(`${room}/again`, {})).status, 403);
    assert.equal((await host.request(`${room}/again`, {})).status, 200);
    const after = (await host.request(room)).data.room;
    assert.equal(after.status, 'map');
    assert.equal(after.quest.screen.kind, 'reward');
    assert.ok(after.quest.gold > 0);
  } finally {
    await close();
  }
});

await test('each player brings a Versus deck; a waiting battle deals it at once', async () => {
  const { client, close } = await fixture();
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    const mine = [
      'pirate',
      'viking',
      'gladiator',
      'medic',
      'miner',
      'balloon',
      'inventor',
      'gunner',
    ];
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'duel',
          difficulty: 'easy',
          deck: ['archers'],
        })
      ).status,
      400,
    );
    const launched = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'duel',
      difficulty: 'easy',
      deck: mine,
    });
    const room = roomOf(launched.data.url);
    const first = (await host.request(room)).data;
    const seat = first.room.you;
    assert.deepEqual(
      [...first.match.players[seat].deck].sort((a, b) => a.localeCompare(b)),
      [...mine].sort((a, b) => a.localeCompare(b)),
    );
    const theirs = [
      'ogre',
      'drake',
      'mage',
      'ranger',
      'duelist',
      'imps',
      'archers',
      'meteor',
    ];
    assert.equal(
      (await guest.request(`${room}/deck`, { deck: theirs })).status,
      200,
    );
    const next = (await guest.request(room)).data;
    assert.deepEqual(
      [...next.match.players[next.room.you].deck].sort((a, b) =>
        a.localeCompare(b),
      ),
      [...theirs].sort((a, b) => a.localeCompare(b)),
    );
    assert.equal(
      (await guest.request(`${room}/deck`, { deck: ['x'] })).status,
      400,
    );
  } finally {
    await close();
  }
});
