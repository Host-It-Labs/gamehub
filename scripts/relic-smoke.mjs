/** Production-output smoke, isolated from the user's database. Run after npm run build. */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeServer } from '../server/index.ts';

assert.ok(
  existsSync('dist/client/index.html'),
  'Build the production client before running this smoke.',
);
const directory = mkdtempSync(join(tmpdir(), 'relic-smoke-'));
const database = join(directory, 'gamehub.sqlite');
const origin = 'http://localhost:3017';
let app;
let base;
async function boot() {
  app = await makeServer({
    database,
    origin,
    staticDir: resolve('dist/client'),
    bots: false,
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
}
function client() {
  let cookie = '';
  return async (path, input) => {
    const response = await fetch(base + path, {
      method: input === undefined ? 'GET' : 'POST',
      headers: {
        Cookie: cookie,
        Origin: origin,
        ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
    assert.equal(response.status, 200, `${path}: ${response.status}`);
    return response.json();
  };
}
try {
  await boot();
  const host = client(),
    guest = client();
  const created = await host('/api/expeditions', {
    name: 'Smoke host',
    title: 'Smoke expedition',
    world: 'dunes',
  });
  const path = `/api/expeditions/${created.token}`;
  const joined = await guest(`${path}/join`, { name: 'Smoke guest' });
  assert.equal(joined.members.length, 2);
  const opened = await guest(`${path}/commands`, {
    requestId: randomUUID(),
    action: { type: 'scratch-open', pack: 'pocket' },
  });
  const ticket = opened.game.scratch.tickets[opened.viewerId];
  const points = Array.from({ length: 66 }, (_, i) => ({
    x: i % 4 < 2 ? 0.005 : 0.995,
    y: 0.005 + Math.floor(i / 2) * 0.03,
  }));
  await guest(`${path}/commands`, {
    requestId: randomUUID(),
    action: {
      type: 'scratch-stroke',
      ticket: ticket.id,
      sequence: 0,
      tool: 'coin',
      points,
    },
  });
  const command = {
    requestId: randomUUID(),
    action: { type: 'scratch-claim', ticket: ticket.id },
  };
  const moved = await guest(`${path}/commands`, command);
  assert.ok(moved.game.coins > 0);
  assert.equal(moved.game.scratch.completed, 1);
  const sessionId = randomUUID();
  const firstPulse = await host(`${path}/activity`, {
    sessionId,
    playing: true,
  });
  assert.equal(firstPulse.game.scratch.activeMs, 0);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const secondPulse = await host(`${path}/activity`, {
    sessionId,
    playing: true,
  });
  assert.ok(secondPulse.game.scratch.activeMs > 0);
  await host(`${path}/activity`, { sessionId, playing: false });
  for (const route of ['/relic', `/expedition/${created.token}`]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /<script/);
  }
  const art = [
    '/art/relic/scratch-desk-landscape-v1.webp',
    '/art/relic/scratch-desk-portrait-v1.webp',
    '/art/optimized/box-relic-scratch-v2.webp',
    '/art/optimized/box-relic-scratch-v2-spine.webp',
  ];
  for (const width of [320, 640, 960])
    art.push(`/art/optimized/box-relic-scratch-v2-${width}.webp`);
  for (const src of art) {
    const response = await fetch(base + src);
    assert.equal(response.status, 200, src);
    assert.match(response.headers.get('content-type'), /image\/webp/);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
  await app.close();
  await boot();
  const resumed = await host(path);
  assert.equal(resumed.game.coins, moved.game.coins);
  assert.equal(resumed.members.length, 2);
  const retry = await guest(`${path}/commands`, command);
  assert.equal(retry.game.revision, moved.game.revision);
  assert.equal(retry.game.coins, moved.game.coins);
  console.log(
    `Relic production smoke passed: two guests, scratch coverage and payout, activity endpoint, disk restart, deduplicated retry, two SPA routes and ${art.length} WebP assets.`,
  );
} finally {
  await app?.close();
  rmSync(directory, { recursive: true, force: true });
}
