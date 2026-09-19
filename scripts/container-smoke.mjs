import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const image = process.argv[2] ?? 'gamehub:test';
const name = `gamehub-smoke-${Date.now()}`,
  volume = `${name}-data`;
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8' }).trim();
let base, cookie;
async function request(path, input) {
  const r = await fetch(base + path, {
    method: input === undefined ? 'GET' : 'POST',
    headers: {
      Origin: 'http://localhost:8080',
      Cookie: cookie ?? '',
      ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  cookie = r.headers.get('set-cookie')?.split(';')[0] ?? cookie;
  assert.ok(r.ok, `${path}: ${r.status}`);
  return r.json();
}
/** Bot seats think server-side after a command, so a command's reply is already
 *  stale. Wait for the revision to stop moving before snapshotting, otherwise a
 *  restart races the bots and persistence looks broken. */
async function settle(path) {
  let last = -1,
    quiet = 0;
  for (let i = 0; i < 80; i++) {
    const current = await request(path);
    quiet = current.revision === last ? quiet + 1 : 0;
    last = current.revision;
    if (quiet >= 4) return current;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Match did not settle');
}
try {
  docker('volume', 'create', volume);
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-p',
    '127.0.0.1::8080',
    '-e',
    'PUBLIC_ORIGIN=http://localhost:8080',
    '-v',
    `${volume}:/data`,
    image,
  );
  base = `http://${docker('port', name, '8080/tcp').split('\n')[0]}`;
  async function ready() {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(base + '/api/health');
        if (r.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('Container did not become healthy');
  }
  await ready();
  assert.equal((await fetch(base + '/auth')).status, 200);
  await request('/api/auth/signup', {
    name: 'Smoke',
    email: 'smoke@example.com',
    password: 'smoke-test-password',
  });
  const t = await request('/api/tables', {});
  const path = `/api/tables/${t.token}`;
  let state = await request(path);
  await request(path + '/commands', {
    requestId: crypto.randomUUID(),
    revision: state.revision,
    matchId: state.matchId,
    action: { type: 'start' },
  });
  state = await settle(path);
  docker('restart', name);
  base = `http://${docker('port', name, '8080/tcp').split('\n')[0]}`;
  await ready();
  const restored = await request(path);
  assert.equal(restored.matchId, state.matchId);
  assert.deepEqual(restored.game, state.game);
  assert.equal((await request('/api/session')).user.name, 'Smoke');
  assert.equal(docker('exec', name, 'id', '-u'), '1000');
  console.log(
    'Container health, SPA routes, accounts, match/session persistence and non-root runtime passed.',
  );
} finally {
  try {
    docker('rm', '-f', name);
  } catch {}
  try {
    docker('volume', 'rm', volume);
  } catch {}
}
