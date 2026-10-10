import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeServer } from '../server/index.ts';

const originalEnvironment = process.env.NODE_ENV;
function setEnvironment(value) {
  if (value === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
}

// Diner is public since 10 October 2026: it shows and plays in every
// environment, like every other game.
await test('Diner appears in the library, on its shelf and in the showcase in every environment', async () => {
  try {
    for (const mode of ['development', 'production', 'test', undefined]) {
      setEnvironment(mode);
      const library = await import(
        `../lib/games/library-fixtures.ts?mode=${mode}`
      );
      assert.ok(library.libraryGames.some((game) => game.id === 'diner'));
      assert.ok(library.gameByLibraryId('diner'));
      assert.ok(library.playableGame('diner'));
      for (const sections of [library.librarySections, library.tableSections])
        assert.ok(
          sections.some((section) => section.games.includes('diner')),
        );
      assert.deepEqual(library.showcaseGames.slice(0, 5), [
        'arena',
        'rota',
        'wildgrove',
        'diner',
        'alto',
      ]);
      assert.ok(library.longGames.includes('diner'));
      const reels = await import(`../lib/games/library-reels.ts?mode=${mode}`);
      assert.ok(reels.reelFor('diner'));
      assert.ok(reels.reelAssets().includes('/reels/diner-wide.mp4'));
    }
  } finally {
    setEnvironment(originalEnvironment);
  }
});

await test('Diner routes, room launch and lobby votes work in every environment', async () => {
  const staticDir = mkdtempSync(join(tmpdir(), 'gamehub-diner-gate-'));
  writeFileSync(
    join(staticDir, 'index.html'),
    '<!doctype html><title>Gamehub</title>',
  );
  const origin = 'http://localhost:3017';
  try {
    for (const mode of ['development', 'production', 'test', undefined]) {
      setEnvironment(mode);
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
          assert.equal((await request(path)).status, 200, `${mode}: ${path}`);
          assert.equal(
            (await request(`${path}?dev=1&dev_session=fake`)).status,
            200,
          );
        }
        assert.equal((await request('/arena')).status, 200);

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
        assert.equal(voted.status, 200, `${mode}: lobby vote`);
        const launch = await request(`${path}/launch?dev=1`, {
          kind: 'diner',
          level: 1,
        });
        assert.equal(launch.status, 200, `${mode}: launch`);
        const { url } = await launch.json();
        assert.match(url, /^\/diner\/[A-Za-z0-9_-]{32}$/);
        assert.equal(
          (await request(url.replace('/diner/', '/api/diner/'))).status,
          200,
        );
      } finally {
        await app.close();
      }
    }
  } finally {
    setEnvironment(originalEnvironment);
    rmSync(staticDir, { recursive: true, force: true });
  }
});
