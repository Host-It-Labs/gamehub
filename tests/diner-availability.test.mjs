import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isGameAvailable } from '../lib/games/availability.ts';
import { makeServer } from '../server/index.ts';

const originalEnvironment = process.env.NODE_ENV;
function setEnvironment(value) {
  if (value === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
}

await test('Diner appears on both shelves and resolves only in development', async () => {
  try {
    for (const mode of ['development', 'production', 'test', undefined]) {
      setEnvironment(mode);
      const available = mode === 'development';
      assert.equal(isGameAvailable('diner'), available);
      assert.equal(isGameAvailable('arena'), true);
      const library = await import(
        `../lib/games/library-fixtures.ts?mode=${mode}`
      );
      assert.equal(
        library.libraryGames.some((game) => game.id === 'diner'),
        available,
      );
      assert.equal(!!library.gameByLibraryId('diner'), available);
      assert.equal(!!library.playableGame('diner'), available);
      for (const sections of [library.librarySections, library.tableSections])
        assert.equal(
          sections.some((section) => section.games.includes('diner')),
          available,
        );
    }
  } finally {
    setEnvironment(originalEnvironment);
  }
});

await test('Diner routes, room launch and lobby votes enforce the development gate', async () => {
  const staticDir = mkdtempSync(join(tmpdir(), 'gamehub-diner-gate-'));
  writeFileSync(
    join(staticDir, 'index.html'),
    '<!doctype html><title>Gamehub</title>',
  );
  const origin = 'http://localhost:3017';
  try {
    for (const mode of ['development', 'production', 'test', undefined]) {
      setEnvironment(mode);
      const available = mode === 'development';
      const app = await makeServer({
        database: ':memory:',
        staticDir,
        origin,
        bots: false,
      });
      try {
        await new Promise((resolve) =>
          app.server.listen(0, '127.0.0.1', resolve),
        );
        const base = `http://127.0.0.1:${app.server.address().port}`;
        let cookie = '';
        async function request(path, input) {
          const response = await fetch(base + path, {
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
          const session = response.headers.get('set-cookie');
          if (session) cookie = session.split(';')[0];
          return response;
        }
        for (const path of ['/diner', `/diner/${'a'.repeat(32)}`]) {
          assert.equal(
            (await request(path)).status,
            available ? 200 : 404,
            `${mode}: ${path}`,
          );
          assert.equal(
            (await request(`${path}?dev=1&dev_session=fake`)).status,
            available ? 200 : 404,
          );
          if (!available)
            assert.equal(
              (await fetch(base + path, { method: 'HEAD' })).status,
              404,
            );
        }
        assert.equal((await request('/arena')).status, 200);
        if (!available)
          for (const action of ['', '/events', '/input', '/again']) {
            const endpoint = `/api/diner/${'a'.repeat(32)}${action}?dev=1`;
            assert.equal((await request(endpoint)).status, 404);
            assert.equal((await request(endpoint, {})).status, 404);
          }

        assert.equal(
          (
            await request('/api/auth/signup', {
              name: 'Host',
              email: 'host@example.com',
              password: 'test-password-123',
            })
          ).status,
          200,
        );
        const table = await (await request('/api/tables', {})).json();
        const path = `/api/tables/${table.token}`;
        const view = await (await request(path)).json();
        const voted = await request(`${path}/commands`, {
          revision: view.revision,
          matchId: view.matchId,
          requestId: randomUUID(),
          action: { type: 'vote', gameId: 'diner' },
        });
        assert.equal(
          voted.status,
          available ? 200 : 400,
          `${mode}: lobby vote`,
        );
        const launch = await request(`${path}/launch?dev=1`, {
          kind: 'diner',
          level: 1,
        });
        assert.equal(launch.status, available ? 200 : 404, `${mode}: launch`);
        if (available) {
          const { url } = await launch.json();
          assert.match(url, /^\/diner\/[A-Za-z0-9_-]{32}$/);
          assert.equal(
            (await request(url.replace('/diner/', '/api/diner/'))).status,
            200,
          );
        } else {
          assert.equal(app.diner.rooms.size, 0);
          assert.equal((await (await request(path)).json()).handoff, null);
        }
      } finally {
        await app.close();
      }
    }
  } finally {
    setEnvironment(originalEnvironment);
    rmSync(staticDir, { recursive: true, force: true });
  }
});
