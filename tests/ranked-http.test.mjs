import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeServer } from '../server/index.ts';
import { createGame } from '../lib/games/trio/engine.ts';
import { Expeditions } from '../server/expeditions.ts';
import { WORLDS } from '../lib/games/relic/engine.ts';

const origin = 'http://localhost:3017';
const noExtensions = { rivers: false, plans: false, towns: false, rockfall: false };
async function fixture() {
  const app = await makeServer({ database: ':memory:', origin, bots: false, rota: { inline: true } });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  function client() {
    let cookie = '';
    return async (path, input, headers = {}) => {
      const response = await fetch(base + path, {
        method: input === undefined ? 'GET' : 'POST',
        headers: {
          Cookie: cookie, Origin: origin,
          ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: input === undefined ? undefined : JSON.stringify(input),
      });
      const set = response.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      return { status: response.status, data: await response.json() };
    };
  }
  async function account(name, request = client()) {
    assert.equal((await request('/api/auth/signup', {
      name, email: `${name.toLowerCase()}@example.test`, password: 'ranked-fixture-password',
    })).status, 200);
    return request;
  }
  /** A guest as the setup makes one: known to the server before launching. */
  async function guest(name) {
    const request = client();
    assert.equal((await request('/api/guest', name ? { name } : {})).status, 200);
    return request;
  }
  /** Ends a rated table with these scores (seat 0 is the player) on the server. */
  function finishTable(url, values) {
    const t = app.tables.get(url.split('/').at(-1));
    t.game.players.forEach((p, i) => (p.score = values[i]));
    t.game.phase = 'over';
    t.status = 'finished';
    app.tables.save(t);
  }
  return { app, client, account, guest, finishTable };
}
const trio = (gameId, overrides = {}) => ({
  gameId, seats: 3, difficulty: 'hard', fastMode: false,
  customerOrders: false, sanctuaryGoalsEnabled: false, requestId: randomUUID(), ...overrides,
});

await test('a guest with no session starts a rated game: the server knows them from then on', async () => {
  const { app, client } = await fixture();
  try {
    const visitor = client();
    assert.equal((await visitor('/api/session')).data.user, null);
    assert.deepEqual((await visitor('/api/solo/ranked')).data, []);
    assert.deepEqual((await visitor('/api/leaderboards/me')).data, []);
    // Without a session a launch is refused; setup says hello first.
    assert.equal((await visitor('/api/solo/ranked', trio('undertow'))).status, 401);
    assert.deepEqual((await visitor('/api/guest', { name: 'Ada' })).data, { name: 'Ada', guest: true });
    assert.deepEqual((await visitor('/api/guest', { name: 'Someone else' })).data, { name: 'Ada', guest: true });
    const launch = await visitor('/api/solo/ranked', trio('undertow'));
    assert.equal(launch.status, 201, JSON.stringify(launch.data));
    assert.match(launch.data.url, /^\/table\/[A-Za-z0-9_-]{32}$/);
    const session = (await visitor('/api/session')).data;
    assert.deepEqual([session.user, session.guest], [null, { name: 'Ada' }]);
    const view = await visitor(launch.data.url.replace('/table/', '/api/tables/'));
    assert.equal(view.status, 200);
    assert.equal(view.data.rankedSolo, true);
    assert.equal(view.data.game.difficulty, 'hard');
    const active = (await visitor('/api/solo/ranked')).data;
    assert.deepEqual(active.map((a) => [a.gameId, a.kind, a.url, a.label, a.round, a.rounds]), [['undertow', 'rating', launch.data.url, '3 players · Full deck', 1, 3]]);
    // A nameless first launch is a Guest.
    const anonymous = client();
    assert.equal((await anonymous('/api/guest', {})).status, 200);
    assert.equal((await anonymous('/api/solo/ranked', trio('midnight'))).status, 201);
    assert.equal((await anonymous('/api/session')).data.guest.name, 'Guest');
    // Easy is never rated; it stays on the device.
    assert.equal((await visitor('/api/solo/ranked', trio('wildgrove', { difficulty: 'easy' }))).status, 400);
    const local = createGame('undertow', 'easy', 123, false, 3);
    assert.equal(local.difficulty, 'easy');
  } finally { await app.close(); }
});

await test('a guest’s finished game is private, then public the moment they join', async () => {
  const { app, client, account, guest, finishTable } = await fixture();
  try {
    const rival = await account('Rival');
    const rivalGame = await rival('/api/solo/ranked', trio('undertow'));
    finishTable(rivalGame.data.url, [9, 1, 2]);
    const visitor = await guest('Bea');
    const launch = await visitor('/api/solo/ranked', trio('undertow'));
    finishTable(launch.data.url, [0, 4, 5]);
    const result = await visitor(`/api/leaderboards/result?url=${encodeURIComponent(launch.data.url)}`);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.deepEqual([result.data.before, result.data.public, result.data.rank, result.data.counted], [1000, false, 1, true]);
    assert.equal(result.data.delta > 0, true);
    let board = (await visitor('/api/leaderboards?game=undertow')).data;
    assert.deepEqual(board.entries.map((e) => e.name), ['Rival']);
    assert.deepEqual([board.personal.public, board.personal.rank, board.total], [false, 1, 1]);
    await account('Bea', visitor);
    board = (await client()('/api/leaderboards?game=undertow')).data;
    assert.deepEqual(board.entries.map((e) => e.name), ['Bea', 'Rival']);
    assert.equal((await visitor('/api/leaderboards/me')).data[0].public, true);
    assert.equal((await rival(`/api/leaderboards/result?url=${encodeURIComponent(launch.data.url)}`)).status, 404);
  } finally { await app.close(); }
});

await test('a guest logging in brings their results and unfinished rated game to the account', async () => {
  const { app, account, guest, finishTable } = await fixture();
  try {
    const member = await account('Member');
    const earlier = await member('/api/solo/ranked', trio('undertow'));
    finishTable(earlier.data.url, [0, 1, 2]);
    const kept = await member('/api/solo/ranked', trio('midnight'));
    await member('/api/auth/logout', {});
    const visitor = await guest('Visitor');
    const played = await visitor('/api/solo/ranked', trio('undertow'));
    finishTable(played.data.url, [0, 1, 2]);
    const moraLaunch = trio('wildgrove', { seats: 2 });
    const unfinished = await visitor('/api/solo/ranked', moraLaunch);
    // Both have an unfinished Yata: the account's stays, the guest's goes for good.
    const clash = await visitor('/api/solo/ranked', trio('midnight'));
    assert.equal((await visitor('/api/auth/login', { email: 'member@example.test', password: 'ranked-fixture-password' })).status, 200);
    const me = (await visitor('/api/leaderboards/me')).data;
    assert.deepEqual(me.filter((row) => row.gameId === 'undertow').map((row) => [row.games, row.public]), [[2, true]]);
    const active = (await visitor('/api/solo/ranked')).data;
    const byUrl = (a, b) => a.localeCompare(b);
    assert.deepEqual(active.map((a) => a.url).sort(byUrl), [unfinished.data.url, kept.data.url].sort(byUrl));
    assert.equal(app.tables.exists(clash.data.url.split('/').at(-1)), false);
    assert.equal(me.find((row) => row.gameId === 'midnight')?.games, 1, 'the settled guest game counts as a loss');
    const view = await visitor(unfinished.data.url.replace('/table/', '/api/tables/'));
    assert.equal(view.status, 200);
    assert.equal(view.data.viewerSeat, 0);
    assert.equal(view.data.isHost, true);
    // A launch whose answer was lost before logging in still finds its game.
    const retried = await visitor('/api/solo/ranked', moraLaunch);
    assert.deepEqual([retried.status, retried.data.url], [200, unfinished.data.url]);
    assert.equal((await visitor('/api/solo/ranked')).data.length, 2);
  } finally { await app.close(); }
});

await test('rated Rota: alone at any level for a best score, with bots only against Hard, one at a time', async () => {
  const { app, guest } = await fixture();
  try {
    const visitor = await guest('Rotan');
    const alone = await visitor('/api/solo/ranked', {
      gameId: 'rota', difficulty: 'medium', seats: 1, map: 'harbour',
      ext: { ...noExtensions, plans: true }, score: 999999, won: true, requestId: randomUUID(),
    });
    assert.equal(alone.status, 201, JSON.stringify(alone.data));
    assert.match(alone.data.url, /^\/rota\/[A-Za-z0-9_-]{32}$/);
    const view = await visitor(`/api${alone.data.url}`);
    assert.equal(view.data.rankedSolo, true);
    assert.equal(view.data.game.ext.plans, true);
    assert.equal((await visitor('/api/solo/ranked', { gameId: 'rota', difficulty: 'easy', seats: 3, map: 'meadow', ext: noExtensions, requestId: randomUUID() })).status, 400);
    assert.equal((await visitor('/api/solo/ranked')).data[0].kind, 'score');
    // One unfinished Rota game: a game with bots drops the town alone, without a loss.
    const together = await visitor('/api/solo/ranked', { gameId: 'rota', difficulty: 'hard', seats: 3, map: 'meadow', ext: noExtensions, requestId: randomUUID() });
    assert.equal(together.status, 201);
    const active = (await visitor('/api/solo/ranked')).data;
    assert.deepEqual(active.map((a) => [a.label, a.kind]), [['Meadow · 3 players', 'rating']]);
    assert.deepEqual(app.db.prepare('SELECT board_key, status FROM leaderboard_runs ORDER BY board_key').all().map((r) => [r.board_key, r.status]), [['rota:harbour', 'abandoned'], ['rota:rating', 'active']]);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM leaderboard_standings').get().n, 0);
  } finally { await app.close(); }
});

await test('invalid rated settings leave no tables, rooms or runs behind', async () => {
  const { app, guest } = await fixture();
  try {
    const visitor = await guest('Invalid');
    for (const input of [
      { requestId: randomUUID() }, trio('arena'), trio('undertow', { difficulty: 'easy' }), trio('undertow', { requestId: 'bad' }),
      trio('undertow', { requestId: undefined }), trio('wildgrove', { seats: 99 }), trio('midnight', { contentSet: 'unknown' }),
      trio('wildgrove', { census: 'yes' }),
      { gameId: 'rota', difficulty: 'hard', seats: 1, map: 'missing', ext: noExtensions, requestId: randomUUID() },
      { gameId: 'rota', difficulty: 'hard', seats: 1, map: 'meadow', ext: {}, requestId: randomUUID() },
    ]) {
      const result = await visitor('/api/solo/ranked', input);
      assert.ok([400, 409].includes(result.status), JSON.stringify([input, result]));
    }
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM tables').get().n, 0);
    assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='rota_rooms'").get().n === 0 || app.db.prepare('SELECT COUNT(*) AS n FROM rota_rooms').get().n === 0, true);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM leaderboard_runs').get().n, 0);
  } finally { await app.close(); }
});

await test('a lost launch response can be retried without another game or a forfeit', async () => {
  const { app, guest } = await fixture();
  try {
    const visitor = await guest('Retry');
    for (const input of [
      trio('undertow'),
      { gameId: 'rota', difficulty: 'hard', seats: 1, map: 'meadow', ext: noExtensions, requestId: randomUUID() },
    ]) {
      const first = await visitor('/api/solo/ranked', input);
      assert.equal(first.status, 201, JSON.stringify(first.data));
      // JSON key order does not change the identity of an already-sent request.
      const retried = await visitor('/api/solo/ranked', Object.fromEntries(Object.entries(input).reverse()));
      assert.deepEqual([retried.status, retried.data], [200, first.data]);
      assert.equal((await visitor('/api/solo/ranked', { ...input, seats: 4 })).status, 409);
    }
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM leaderboard_runs').get().n, 2);
    assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM leaderboard_runs WHERE status='active'").get().n, 2);
    // Retrying the hello is harmless too: the same guest stays.
    assert.equal((await visitor('/api/guest', { name: 'Retry' })).data.name, 'Retry');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM guests').get().n, 1);
  } finally { await app.close(); }
});

await test('starting another rated game of the same game ends the old one as a loss and sweeps its table', async () => {
  const { app, account } = await fixture();
  try {
    const host = await account('ReplaceHost');
    const first = await host('/api/solo/ranked', trio('undertow'));
    const next = await host('/api/solo/ranked', trio('undertow', { seats: 4 }));
    const now = Date.now();
    app.sweep(now);
    app.sweep(now + 11 * 60_000);
    assert.deepEqual((await host('/api/solo/ranked')).data.map((a) => a.url), [next.data.url]);
    assert.equal(app.tables.exists(first.data.url.split('/').at(-1)), false);
    assert.equal(app.tables.exists(next.data.url.split('/').at(-1)), true);
    const me = (await host('/api/leaderboards/me')).data[0];
    assert.deepEqual([me.games, me.value < 1000], [1, true]);
  } finally { await app.close(); }
});

await test('paused rated games survive the idle cleanup of friends tables', async () => {
  const { app, account } = await fixture();
  try {
    const host = await account('PauseHost');
    const launch = await host('/api/solo/ranked', trio('midnight'));
    const casual = await host('/api/tables', {});
    assert.equal(casual.status, 201);
    const now = Date.now();
    app.sweep(now);
    app.sweep(now + 11 * 60_000);
    assert.equal((await host(launch.data.url.replace('/table/', '/api/tables/'))).status, 200);
    assert.equal((await host('/api/solo/ranked')).data[0].label, '3 players · Tokyo');
    assert.deepEqual((await host('/api/tables')).data, []);
  } finally { await app.close(); }
});

await test('Puzzles and Lucky runs are not limited and never block a rated game', async () => {
  const { app, account } = await fixture();
  try {
    const host = await account('DeskHost');
    const user = (await host('/api/session')).data.user;
    const who = { id: user.id, userId: user.id, name: user.name, sessionHash: '', expires: Date.now() + 10000 };
    const desks = new Expeditions(app.db);
    for (let i = 0; i < 8; i++) desks.create(who, { title: `Desk ${i}`, world: WORLDS[0].id });
    assert.equal(app.db.prepare("SELECT COUNT(*) n FROM leaderboard_runs WHERE status='active'").get().n, 8);
    assert.equal((await host('/api/solo/ranked', trio('wildgrove'))).status, 201);
    assert.equal((await host('/api/solo/ranked')).data.length, 1);
  } finally { await app.close(); }
});

await test('ending a rated game is owner-only, durable and idempotent, for a guest owner too', async () => {
  const { app, account, client, guest } = await fixture();
  try {
    const visitor = await guest('Ender');
    const other = await account('AbandonOther');
    const stranger = client();
    for (const input of [
      trio('undertow', { gold: true }),
      { gameId: 'rota', difficulty: 'hard', seats: 2, map: 'meadow', ext: noExtensions, requestId: randomUUID() },
    ]) {
      const launch = await visitor('/api/solo/ranked', input);
      assert.equal(launch.status, 201, JSON.stringify(launch.data));
      const url = launch.data.url;
      const active = (await visitor('/api/solo/ranked')).data.find((item) => item.url === url);
      assert.ok(active.label.includes(input.gameId === 'rota' ? 'Meadow' : 'Gold'));
      assert.equal((await stranger('/api/solo/ranked/abandon', { url })).status, 401);
      assert.equal((await other('/api/solo/ranked/abandon', { url })).status, 403);
      assert.equal((await visitor('/api/solo/ranked/abandon', { url }, { Origin: 'https://outside.example' })).status, 403);
      assert.equal((await visitor('/api/solo/ranked/abandon', { url })).status, 200);
      assert.equal((await visitor('/api/solo/ranked/abandon', { url })).status, 200);
      assert.equal((await visitor('/api/solo/ranked')).data.some((item) => item.url === url), false);
      const path = url.startsWith('/rota/') ? `/api${url}` : url.replace('/table/', '/api/tables/');
      assert.equal((await visitor(path)).status, 404);
    }
    const me = (await visitor('/api/leaderboards/me')).data;
    assert.deepEqual(me.map((row) => [row.gameId, row.games, row.wins]).sort(), [['rota', 1, 0], ['undertow', 1, 0]]);
    assert.equal((await visitor('/api/solo/ranked/abandon', { url: 'https://outside.example' })).status, 400);
    const casual = await other('/api/tables', {});
    assert.equal((await visitor('/api/solo/ranked/abandon', { url: `/table/${casual.data.token}` })).status, 403);
    assert.equal(app.tables.exists(casual.data.token), true);
  } finally { await app.close(); }
});

await test('the result of a game is only for its player and waits until it ends', async () => {
  const { app, client, guest, finishTable } = await fixture();
  try {
    const visitor = await guest('Result');
    const launch = await visitor('/api/solo/ranked', trio('undertow'));
    const path = `/api/leaderboards/result?url=${encodeURIComponent(launch.data.url)}`;
    assert.equal((await visitor(path)).status, 409);
    assert.equal((await client()(path)).status, 404);
    assert.equal((await visitor('/api/leaderboards/result?url=https://outside.example')).status, 400);
    finishTable(launch.data.url, [5, 1, 9]);
    const result = (await visitor(path)).data;
    assert.deepEqual([result.metric, result.runValue, result.delta, result.streak], ['rating', 5, 0, 0]);
  } finally { await app.close(); }
});
