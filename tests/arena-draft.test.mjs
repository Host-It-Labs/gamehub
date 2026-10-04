import test from 'node:test';
import assert from 'node:assert/strict';
import { makeServer } from '../server/index.ts';
import { cards, validDeck } from '../lib/games/arena/cards.ts';
import {
  KEEP,
  OFFER,
  PICK_MS,
  REVEAL_MS,
  FINAL_MS,
  ROLES,
  ROUNDS,
  advance,
  autoPick,
  buildOffers,
  choose,
  deckOf,
  decksOf,
  draftPool,
  draftView,
  fullDeck,
  newDraft,
  opponentOf,
  rate,
  rolesOf,
} from '../lib/games/arena/draft.ts';

// ---------------------------------------------------------------- the draft

void test('offers repeat by seed and differ between seeds', () => {
  for (const mode of ['duel', 'team']) {
    assert.deepEqual(buildOffers(7, mode), buildOffers(7, mode));
    assert.notDeepEqual(buildOffers(7, mode), buildOffers(8, mode));
  }
});

void test('every offer holds four cards, one per role, from the full card list', () => {
  const pool = new Set(draftPool());
  assert.ok(pool.size >= 16);
  for (const id of pool) assert.ok(rolesOf(id).length >= 1, id);
  for (const mode of ['duel', 'team'])
    for (let seed = 0; seed < 400; seed++) {
      const offers = buildOffers(seed, mode);
      assert.equal(offers.length, ROUNDS);
      for (const row of offers) {
        assert.equal(row.length, mode === 'team' ? 4 : 2);
        for (const offer of row) {
          assert.equal(offer.length, OFFER);
          offer.forEach((id, i) => {
            assert.ok(pool.has(id), id);
            assert.ok(rolesOf(id).includes(ROLES[i]), `${id} as ${ROLES[i]}`);
          });
        }
      }
    }
});

void test('a lane never sees a card twice and the Meteor appears in one offer at most', () => {
  for (const mode of ['duel', 'team'])
    for (let seed = 0; seed < 400; seed++) {
      const offers = buildOffers(seed, mode);
      const lanes =
        mode === 'team'
          ? [
              [0, 1],
              [2, 3],
            ]
          : [[0, 1]];
      for (const lane of lanes) {
        const seen = offers.flatMap((row) => lane.flatMap((s) => row[s]));
        assert.equal(new Set(seen).size, seen.length, `seed ${seed}`);
      }
      const spells = offers
        .flat()
        .filter((offer) => offer.some((id) => cards[id].kind === 'spell'));
      assert.ok(spells.length <= 1, `seed ${seed}`);
      // A duel never offers a card twice in the whole match.
      if (mode === 'duel') {
        const all = offers.flat(2);
        assert.equal(new Set(all).size, all.length);
      }
    }
});

void test('splash that only lands on towers is no answer to swarms', () => {
  assert.ok(!rolesOf('balloon').includes('splash'));
  assert.ok(rolesOf('balloon').includes('win'));
  assert.deepEqual(rolesOf('meteor'), ['support']);
  assert.ok(rolesOf('archers').includes('air'));
});

void test('a duel: kept cards stay, leftovers go across, eight different cards each', () => {
  let d = newDraft(11, 'duel', [false, false], 0);
  assert.equal(d.stage, 'pick');
  const mine = d.offers[0][0].slice(0, 2);
  const theirs = d.offers[0][1].slice(2, 4);
  // One card is a choice in progress; it does not lock.
  d = choose(d, 0, [mine[0]], 10);
  assert.equal(d.locked[0][0], false);
  d = choose(d, 0, mine, 20);
  assert.equal(d.locked[0][0], true);
  // A locked seat cannot change its mind; a card not offered is refused.
  assert.equal(choose(d, 0, [mine[1]], 21), null);
  assert.equal(choose(d, 1, ['nope', theirs[0]], 21), null);
  assert.equal(choose(d, 1, [theirs[0], theirs[0]], 21), null);
  d = choose(d, 1, theirs, 30);
  assert.equal(d.stage, 'reveal');
  assert.equal(d.endsAt, 30 + REVEAL_MS);
  assert.deepEqual(deckOf(d, 0), [
    ...mine,
    ...d.offers[0][1].filter((id) => !theirs.includes(id)),
  ]);
  assert.deepEqual(deckOf(d, 1), [
    ...theirs,
    ...d.offers[0][0].filter((id) => !mine.includes(id)),
  ]);
  d = advance(d, 30 + REVEAL_MS);
  assert.equal(d.round, 1);
  assert.equal(d.stage, 'pick');
  d = choose(d, 0, d.offers[1][0].slice(1, 3), 100);
  d = choose(d, 1, d.offers[1][1].slice(0, 2), 110);
  d = advance(d, 110 + REVEAL_MS);
  assert.equal(d.stage, 'final');
  d = advance(d, 110 + REVEAL_MS + FINAL_MS);
  assert.equal(d.stage, 'done');
  for (const deck of decksOf(d)) {
    assert.ok(fullDeck(deck));
    assert.ok(validDeck(deck));
  }
});

void test('the clock keeps your choice and fills the rest with the highest-rated cards', () => {
  let d = newDraft(3, 'duel', [false, false], 1000);
  const offer = d.offers[0][0];
  const first = offer[3];
  d = choose(d, 0, [first], 1500);
  const expected = autoPick(d, 0);
  assert.equal(expected[0], first);
  assert.equal(expected.length, KEEP);
  const rest = offer.filter((id) => id !== first);
  const best = rest.reduce((a, b) =>
    rate(b, [first]) > rate(a, [first]) ? b : a,
  );
  assert.equal(expected[1], best);
  // Nothing before the deadline; at the deadline both seats are filled in.
  assert.equal(advance(d, 1000 + PICK_MS - 1), d);
  d = advance(d, 1000 + PICK_MS);
  assert.equal(d.stage, 'reveal');
  assert.deepEqual(d.picks[0][0], expected);
  assert.equal(d.picks[0][1].length, KEEP);
  // A draft nobody touches still ends with full decks.
  const idle = advance(
    newDraft(4, 'team', [false, false, false, false], 0),
    1e7,
  );
  assert.equal(idle.stage, 'done');
  for (const deck of decksOf(idle)) assert.ok(fullDeck(deck));
});

void test('bots pick at once with the same rating, every round', () => {
  let d = newDraft(21, 'duel', [false, true], 0);
  assert.equal(d.locked[0][1], true);
  assert.equal(d.locked[0][0], false);
  const fresh = newDraft(21, 'duel', [false, false], 0);
  assert.deepEqual(d.picks[0][1], autoPick(fresh, 1));
  d = choose(d, 0, d.offers[0][0].slice(0, 2), 50);
  assert.equal(d.stage, 'reveal');
  d = advance(d, 50 + REVEAL_MS);
  assert.equal(d.round, 1);
  assert.equal(d.locked[1][1], true);
  assert.equal(d.picks[1][1].length, KEEP);
});

void test('2 v 2: leftovers go to the lane opponent, teammates see each other', () => {
  let d = newDraft(5, 'team', [false, true, false, true], 0);
  assert.equal(opponentOf(0), 1);
  assert.equal(opponentOf(2), 3);
  const view = draftView(d, 0, 100);
  assert.equal(view.mate, 2);
  assert.equal(view.opponent, 1);
  assert.equal(view.left, PICK_MS - 100);
  assert.deepEqual(view.rounds[0].mate.offer, d.offers[0][2]);
  // The teammate's choice in progress shows live.
  d = choose(d, 2, [d.offers[0][2][1]], 200);
  assert.deepEqual(draftView(d, 0, 200).rounds[0].mate.picks, [
    d.offers[0][2][1],
  ]);
  // The other side's offers are never shown, only what came across.
  assert.equal(JSON.stringify(view).includes('"offers"'), false);
  assert.equal(view.rounds[0].received, null);
  d = choose(d, 0, d.offers[0][0].slice(0, 2), 300);
  d = choose(d, 2, d.offers[0][2].slice(1, 3), 300);
  const after = draftView(d, 0, 300);
  assert.equal(d.stage, 'reveal');
  assert.deepEqual(
    after.rounds[0].received,
    d.offers[0][1].filter((id) => !d.picks[0][1].includes(id)),
  );
  // Seat 2's leftovers went to seat 3, not to seat 1.
  const three = deckOf(d, 3);
  for (const id of d.offers[0][2].filter((c) => !d.picks[0][2].includes(c)))
    assert.ok(three.includes(id));
  d = advance(d, 1e7);
  assert.equal(d.stage, 'done');
  const decks = decksOf(d);
  for (const deck of decks) assert.ok(fullDeck(deck));
});

// ---------------------------------------------------------------- the room

const origin = 'http://localhost:3017';

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

/** A device's view of a room: the newest room view and match. */
function follow(c, room) {
  const f = { room: null, match: null, snapshots: 0 };
  f.stream = c.listen(`${room}/events`, (event, data) => {
    if (event === 'snapshot') {
      f.room = data.room;
      f.match = data.match;
      f.snapshots++;
    } else if (event === 'room') f.room = data;
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
const sorted = (list) => [...list].sort((a, b) => a.localeCompare(b));

const heavy = [
  'pirate',
  'viking',
  'gladiator',
  'medic',
  'miner',
  'balloon',
  'inventor',
  'gunner',
];
const classic = [
  'ogre',
  'drake',
  'mage',
  'ranger',
  'duelist',
  'imps',
  'archers',
  'meteor',
];

await test('the deck phase: everyone picks, Ready from all starts the battle with those decks', async () => {
  const { client, close } = await fixture({ tickMs: 0.1, startDelayMs: 10 });
  try {
    const { host, path, guests } = await table(client);
    const [guest] = guests;
    assert.equal(
      (
        await host.request(`${path}/launch`, {
          kind: 'arena',
          mode: 'duel',
          difficulty: 'easy',
          decks: 'shuffle',
        })
      ).status,
      400,
    );
    const launched = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'duel',
      difficulty: 'easy',
      decks: 'pick',
    });
    const room = roomOf(launched.data.url);
    const first = (await host.request(room)).data;
    assert.equal(first.room.status, 'deck');
    assert.equal(first.room.decks, 'pick');
    assert.deepEqual(first.room.ready, [false, false]);
    // The clock only starts once everyone has the room open.
    assert.equal(first.room.left, undefined);
    const mine = follow(host, room);
    const theirs = follow(guest, room);
    await until(() => mine.room?.left > 0, 'the deck clock');
    assert.ok(mine.room.left <= 30_000);
    // Cards cannot be played before the battle.
    assert.equal(
      (
        await host.request(`${room}/commands`, {
          round: 1,
          slot: 0,
          x: 3.5,
          y: 10,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await host.request(`${room}/deck`, {
          deck: heavy,
          ready: true,
          loaded: true,
        })
      ).status,
      200,
    );
    await until(() => theirs.room?.ready?.[0] === true, 'the ready dot');
    assert.equal(theirs.room.status, 'deck');
    assert.equal(
      (
        await guest.request(`${room}/deck`, {
          deck: classic,
          ready: true,
          loaded: true,
        })
      ).status,
      200,
    );
    await until(
      () => ['playing', 'over'].includes(mine.room?.status),
      'the battle',
    );
    assert.deepEqual(sorted(mine.match.players[0].deck), sorted(heavy));
    assert.deepEqual(sorted(mine.match.players[1].deck), sorted(classic));
    // Bots never hold up the phase; the next battle opens a new one.
    await until(() => mine.room?.status === 'over', 'the end', 30_000);
    assert.equal((await host.request(`${room}/again`, {})).status, 200);
    await until(() => mine.room?.status === 'deck', 'a new deck phase');
    assert.deepEqual(mine.room.ready, [false, false]);
  } finally {
    await close();
  }
});

await test('the deck phase ends at its cap with the deck each person has', async () => {
  const { client, close } = await fixture({
    tickMs: 5,
    startDelayMs: 10,
    deckMs: 150,
    joinMs: 100,
    startTimeoutMs: 100,
  });
  try {
    const { host, path, guests } = await table(client, ['Guest', 'Third']);
    const [guest] = guests;
    const launched = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'team',
      difficulty: 'easy',
      decks: 'pick',
      deck: heavy,
      teams: { [host.id]: 0, [guest.id]: 1 },
    });
    const room = roomOf(launched.data.url);
    const mine = follow(host, room);
    follow(guest, room);
    // Third never opens the room: the clock starts after the join wait.
    await host.request(`${room}/deck`, { deck: classic, ready: false });
    await until(() => mine.room?.status === 'playing', 'the cap', 12_000);
    const seats = mine.room.seats;
    const seatOf = (name) => seats.findIndex((s) => s.name === name);
    assert.deepEqual(
      sorted(mine.match.players[seatOf('Host')].deck),
      sorted(classic),
    );
    assert.equal(mine.match.players[seatOf('Third')].deck.length, 8);
  } finally {
    await close();
  }
});

await test('a drafted room: offers from the room, live picks, the clock and bots, then the drafted decks play', async () => {
  const { client, close } = await fixture({
    tickMs: 5,
    startDelayMs: 10,
    draftTimes: { pick: 400, reveal: 30, final: 30 },
  });
  try {
    const { host, path, guests } = await table(client, ['Guest']);
    const [guest] = guests;
    const launched = await host.request(`${path}/launch`, {
      kind: 'arena',
      mode: 'team',
      difficulty: 'easy',
      decks: 'draft',
      teams: { [host.id]: 0, [guest.id]: 0 },
    });
    const room = roomOf(launched.data.url);
    const first = (await host.request(room)).data;
    assert.equal(first.room.status, 'draft');
    assert.equal(first.room.draft, null);
    const mine = follow(host, room);
    const theirs = follow(guest, room);
    await until(
      () => mine.room?.draft && theirs.room?.draft,
      'the first offers',
    );
    const view = mine.room.draft;
    const me = mine.room.you;
    const mate = theirs.room.you;
    assert.equal(view.mate, mate);
    assert.equal(view.round, 0);
    assert.equal(view.rounds[0].offer.length, 4);
    // The bots across are in at once.
    assert.equal(view.locked[view.opponent], true);
    // Picks name the round; the teammate sees a choice in progress.
    const offer = view.rounds[0].offer;
    assert.equal(
      (await host.request(`${room}/draft`, { round: 1, picks: [offer[0]] }))
        .status,
      409,
    );
    assert.equal(
      (await host.request(`${room}/draft`, { round: 0, picks: ['nope'] }))
        .status,
      409,
    );
    assert.equal(
      (await host.request(`${room}/draft`, { round: 0, picks: [offer[0]] }))
        .status,
      200,
    );
    await until(
      () => theirs.room?.draft?.rounds[0].mate.picks[0] === offer[0],
      'the live pick',
    );
    await host.request(`${room}/draft`, {
      round: 0,
      picks: [offer[0], offer[1]],
    });
    // The guest says nothing: the clock picks for them.
    await until(() => mine.room?.draft?.round === 1, 'round two', 4000);
    const second = mine.room.draft;
    assert.deepEqual(second.rounds[0].picks, [offer[0], offer[1]]);
    assert.equal(second.rounds[0].received.length, 2);
    // Loaded devices let the battle start as soon as the draft ends.
    await host.request(`${room}/deck`, { loaded: true });
    await guest.request(`${room}/deck`, { loaded: true });
    // A drafted room ignores a deck sent to it.
    assert.equal(
      (await guest.request(`${room}/deck`, { deck: classic })).status,
      200,
    );
    await until(() => mine.room?.status === 'playing', 'the battle', 6000);
    const decks = mine.match.players.map((p) => p.deck);
    for (const deck of decks) {
      assert.equal(deck.length, 8);
      assert.equal(new Set(deck).size, 8);
    }
    const held = [...second.rounds[0].picks, ...second.rounds[0].received];
    for (const id of held) assert.ok(decks[me].includes(id), id);
  } finally {
    await close();
  }
});
