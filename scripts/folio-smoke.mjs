/** Production shell and assets, using an isolated in-memory database. Run after npm run build. */
import assert from 'node:assert/strict';
import { makeServer } from '../server/index.ts';
const origin = 'http://localhost:3017';
const app = await makeServer({
  database: ':memory:',
  origin,
  staticDir: 'dist/client',
  bots: false,
});
try {
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const res = await fetch(`${base}/api/folio`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Folio smoke', seats: 2 }),
  });
  assert.equal(res.status, 200);
  const run = await res.json();
  assert.equal(run.game.phase, 'lobby');
  assert.equal(run.game.map.length > 0, true);
  const preview = await fetch(`${base}/api/folio/${run.token}`);
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).joined, false);
  for (const path of ['/folio', `/folio/${run.token}`]) {
    const page = await fetch(base + path);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /html/);
    assert.match(await page.text(), /Gamehub/);
  }
  for (const suffix of ['', '-320', '-640', '-960', '-spine']) {
    const asset = await fetch(
      `${base}/art/optimized/box-folio-blind-v2${suffix}.webp`,
    );
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /webp/);
    assert.ok((await asset.arrayBuffer()).byteLength > 100);
  }
  for (const name of [
    'folio-bg-landscape-1536',
    'folio-bg-landscape-960',
    'folio-bg-portrait-1024',
  ]) {
    const asset = await fetch(`${base}/art/folio/${name}.webp`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /webp/);
  }
  console.log(
    'Folio production shell, invitation preview, two-seat lobby, cover and background assets passed. No browser interaction was tested.',
  );
} finally {
  await app.close();
}
