import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { makeServer } from '../server/index.ts';

const origin = 'http://localhost:3017';
const password = 'test-only-password-123';
async function fixture() {
  const app = await makeServer({
    database: ':memory:',
    origin,
    bots: false,
    rota: { inline: true },
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  function client() {
    let cookie = '';
    return {
      cookie: () => cookie,
      async request(path, input, extra = {}) {
        const r = await fetch(base + path, {
          method: input === undefined ? 'GET' : 'POST',
          headers: {
            origin,
            cookie,
            ...(input === undefined
              ? {}
              : { 'content-type': 'application/json' }),
            ...extra,
          },
          body: input === undefined ? undefined : JSON.stringify(input),
        });
        const set = r.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        return { status: r.status, data: await r.json(), setCookie: set };
      },
    };
  }
  const person = client();
  const signup = await person.request('/api/auth/signup', {
    name: 'Player',
    email: 'player@example.test',
    password,
  });
  assert.equal(signup.status, 200);
  return { app, base, client, person, recoveryCode: signup.data.recoveryCode };
}

await test('guest signup preserves Puzzles identity and access, then deletion removes the retained guest', async () => {
  const { app, client } = await fixture();
  try {
    const guest = client();
    const created = await guest.request('/api/folio', {
      name: 'Guest before signup',
      seats: 1,
      difficulty: 1,
    });
    assert.equal(created.status, 200);
    const path = `/api/folio/${created.data.token}`;
    const guestId = created.data.viewerId;
    assert.equal(typeof guestId, 'string');
    assert.equal((await guest.request('/api/session')).data.user, null);
    assert.ok(app.db.prepare('SELECT 1 FROM guests WHERE id=?').get(guestId));
    const signup = await guest.request('/api/auth/signup', {
      name: 'Account after signup',
      email: 'upgraded-guest@example.test',
      password,
    });
    assert.equal(signup.status, 200);
    const session = await guest.request('/api/session');
    assert.equal(session.data.user.id, guestId);
    assert.equal(session.data.guest, null);
    const resumed = await guest.request(path);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.data.joined, true);
    assert.equal(resumed.data.viewerId, guestId);
    assert.equal(resumed.data.hostId, guestId);
    assert.equal(resumed.data.canLead, true);
    assert.deepEqual(resumed.data.game, created.data.game);
    assert.ok((await guest.request('/api/folio')).data.some((run) => run.token === created.data.token));
    assert.ok(app.db.prepare('SELECT 1 FROM guests WHERE id=?').get(guestId), 'the original guest identity remains available until account deletion');
    assert.equal((await guest.request('/api/account/delete', { password })).status, 200);
    assert.equal(app.db.prepare('SELECT 1 FROM users WHERE id=?').get(guestId), undefined);
    assert.equal(app.db.prepare('SELECT 1 FROM guests WHERE id=?').get(guestId), undefined);
    assert.equal(app.db.prepare('SELECT 1 FROM sessions WHERE user_id=? OR guest_id=?').get(guestId, guestId), undefined);
    assert.equal(app.db.prepare('SELECT 1 FROM folio_runs WHERE token=?').get(created.data.token), undefined);
  } finally {
    await app.close();
  }
});

await test('an account request with a held body cannot mutate a logged-out session', async () => {
  const { app, base, person } = await fixture();
  let held;
  try {
    const body = JSON.stringify({ name: 'Changed after logout' });
    const accepted = new Promise((resolve) => app.server.once('request', resolve));
    const completed = new Promise((resolve, reject) => {
      held = httpRequest(`${base}/api/account/profile`, {
        method: 'POST',
        headers: { origin, cookie: person.cookie(), 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      }, (response) => {
        let value = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { value += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(value) }));
        response.on('error', reject);
      });
      held.on('error', reject);
      held.write(body.slice(0, 1));
    });
    await accepted;
    assert.equal((await person.request('/api/auth/logout', {})).status, 200);
    held.end(body.slice(1));
    const response = await completed;
    assert.equal(response.status, 401);
    assert.equal(app.db.prepare('SELECT name FROM users WHERE email=?').get('player@example.test').name, 'Player');
  } finally {
    held?.destroy();
    await app.close();
  }
});

await test('account creation issues hashed one-time recovery and private session data', async () => {
  const { app, person, client, recoveryCode } = await fixture();
  try {
    assert.match(recoveryCode, /^[A-Za-z0-9_-]{32}$/);
    const recovery = app.db.prepare('SELECT * FROM account_recovery').get();
    assert.notEqual(recovery.hash, recoveryCode);
    assert.equal(recovery.hash.length, 64);
    const session = await person.request('/api/session');
    assert.equal(session.data.user.email, 'player@example.test');
    assert.equal(JSON.stringify(session).includes('recoveryCode'), false);
    assert.deepEqual((await client().request('/api/session')).data, {
      user: null,
      guest: null,
    });
    assert.equal(
      (await client().request('/api/account/profile', { name: 'Intruder' }))
        .status,
      401,
    );
    assert.equal(
      (
        await person.request(
          '/api/account/profile',
          { name: 'Wrong' },
          { origin: 'https://evil.test' },
        )
      ).status,
      403,
    );
  } finally {
    await app.close();
  }
});

await test('profile changes propagate to public records without publishing emails', async () => {
  const { app, person, client } = await fixture();
  try {
    const launched = await person.request('/api/solo/ranked', {
      gameId: 'undertow',
      seats: 4,
      difficulty: 'hard',
      requestId: 'profile-launch-000001',
    });
    assert.equal(launched.status, 201);
    const table = app.tables.get(launched.data.url.split('/').at(-1));
    const { Leaderboards } = await import('../server/leaderboards.ts');
    new Leaderboards(app.db).forfeit(`table:${table.matchId}`);
    assert.equal(
      (
        await person.request('/api/account/profile', {
          name: '  New public name  ',
        })
      ).data.user.name,
      'New public name',
    );
    const board = await client().request('/api/leaderboards?game=undertow');
    assert.equal(board.data.entries[0].name, 'New public name');
    assert.equal(JSON.stringify(board.data).includes('@'), false);
    assert.equal(board.data.personal, null);
    assert.equal(
      (await person.request('/api/account/profile', { name: '\u0001Bad' }))
        .status,
      400,
    );
  } finally {
    await app.close();
  }
});

await test('password changes require current password and revoke other sessions', async () => {
  const { app, person, client } = await fixture();
  try {
    const other = client();
    await other.request('/api/auth/login', {
      email: 'player@example.test',
      password,
    });
    assert.equal(
      (
        await person.request('/api/account/password', {
          currentPassword: 'wrong',
          password: 'new-test-password-123',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await person.request('/api/account/password', {
          currentPassword: password,
          password: 'short',
        })
      ).status,
      400,
    );
    const changed = await person.request('/api/account/password', {
      currentPassword: password,
      password: 'new-test-password-123',
    });
    assert.equal(changed.status, 200);
    assert.match(changed.setCookie, /HttpOnly; SameSite=Lax/);
    assert.equal((await other.request('/api/session')).data.user, null);
    assert.ok((await person.request('/api/session')).data.user);
    assert.equal(
      (
        await other.request('/api/auth/login', {
          email: 'player@example.test',
          password,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await other.request('/api/auth/login', {
          email: 'player@example.test',
          password: 'new-test-password-123',
        })
      ).status,
      200,
    );
  } finally {
    await app.close();
  }
});

await test('recovery consumes and rotates the code and revokes all earlier sessions', async () => {
  const { app, person, client, recoveryCode } = await fixture();
  try {
    const recovery = client();
    const result = await recovery.request('/api/auth/recover', {
      email: 'player@example.test',
      recoveryCode,
      password: 'recovered-test-password',
    });
    assert.equal(result.status, 200);
    assert.notEqual(result.data.recoveryCode, recoveryCode);
    assert.ok((await recovery.request('/api/session')).data.user);
    assert.equal((await person.request('/api/session')).data.user, null);
    assert.equal(
      (
        await person.request('/api/auth/recover', {
          email: 'player@example.test',
          recoveryCode,
          password,
        })
      ).status,
      401,
    );
    const bad = await person.request('/api/auth/recover', {
      email: 'missing@example.test',
      recoveryCode,
      password,
    });
    assert.equal(bad.status, 401);
    assert.equal(bad.data.error, 'Email or recovery code is incorrect.');
  } finally {
    await app.close();
  }
});

await test('recovery generation requires password and invalidates the previous code', async () => {
  const { app, person, client, recoveryCode } = await fixture();
  try {
    assert.equal(
      (
        await person.request('/api/account/recovery-code', {
          password: 'wrong',
        })
      ).status,
      401,
    );
    const next = await person.request('/api/account/recovery-code', {
      password,
    });
    assert.equal(next.status, 200);
    const visitor = client();
    assert.equal(
      (
        await visitor.request('/api/auth/recover', {
          email: 'player@example.test',
          recoveryCode,
          password,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await visitor.request('/api/auth/recover', {
          email: 'player@example.test',
          recoveryCode: next.data.recoveryCode,
          password,
        })
      ).status,
      200,
    );
  } finally {
    await app.close();
  }
});

await test('account deletion removes owned data and standings while guest games still work', async () => {
  const { app, person, client } = await fixture();
  try {
    const launched = await person.request('/api/solo/ranked', {
      gameId: 'wildgrove',
      seats: 2,
      difficulty: 'hard',
      requestId: 'delete-launch-0000001',
    });
    assert.equal(launched.status, 201);
    const table = app.tables.get(launched.data.url.split('/').at(-1));
    const { Leaderboards } = await import('../server/leaderboards.ts');
    new Leaderboards(app.db).forfeit(`table:${table.matchId}`);
    const userId = (await person.request('/api/session')).data.user.id;
    assert.equal(
      (await person.request('/api/account/delete', { password: 'wrong' }))
        .status,
      401,
    );
    assert.equal(
      (await person.request('/api/account/delete', { password })).status,
      200,
    );
    for (const tableName of [
      'users',
      'sessions',
      'account_recovery',
      'leaderboard_runs',
      'leaderboard_standings',
      'leaderboard_launches',
    ])
      assert.equal(
        app.db.prepare(`SELECT COUNT(*) n FROM ${tableName}`).get().n,
        0,
        tableName,
      );
    assert.equal(app.tables.exists(table.token), false);
    assert.equal((await person.request('/api/session')).data.user, null);
    assert.equal(
      (
        await client().request('/api/leaderboards?game=wildgrove')
      ).data.entries.some((e) => e.userId === userId),
      false,
    );
    const guestRun = await client().request('/api/folio', {
      name: 'Guest',
      seats: 1,
      difficulty: 1,
    });
    assert.equal(guestRun.status, 200);
  } finally {
    await app.close();
  }
});

await test('concurrent reuse of one recovery code can change an account only once', async () => {
  const { app, client, recoveryCode } = await fixture();
  try {
    const results = await Promise.all(
      [client(), client()].map((c, i) =>
        c.request('/api/auth/recover', {
          email: 'player@example.test',
          recoveryCode,
          password: `recovered-password-${i}`,
        }),
      ),
    );
    assert.deepEqual(
      results.map((r) => r.status).sort((a, b) => a - b),
      [200, 401],
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 1);
  } finally {
    await app.close();
  }
});
