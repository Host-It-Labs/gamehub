import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// assets.ts imports its manifest through `@/` as plain JSON; serve it as a
// module so the real loader runs here, against an in-memory network.
const root = new URL('../', import.meta.url).href;
register(
  `data:text/javascript,${encodeURIComponent(`
import { readFileSync } from 'node:fs';
const root = ${JSON.stringify(root)};
export async function resolve(spec, ctx, next) {
  return next(spec.startsWith('@/') ? root + spec.slice(2) : spec, ctx);
}
export async function load(url, ctx, next) {
  if (!url.endsWith('.json')) return next(url, ctx);
  const source = 'export default ' + readFileSync(new URL(url), 'utf8');
  return { format: 'module', source, shortCircuit: true };
}`)}`,
);
const { loadFiles } = await import('../components/game/arena/assets.ts');

/** A network whose bytes the test hands out by hand. */
function network() {
  const requests = new Map();
  globalThis.fetch = async (path, { signal } = {}) => {
    const request = { aborted: false, controller: null };
    requests.set(path, request);
    const body = new ReadableStream({
      start(controller) {
        request.controller = controller;
      },
    });
    signal?.addEventListener('abort', () => {
      request.aborted = true;
      request.controller.error(signal.reason);
    });
    return new Response(body, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  };
  return {
    requests,
    send: (path, n) => requests.get(path).controller.enqueue(new Uint8Array(n)),
    end: (path) => requests.get(path).controller.close(),
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

await test('a game that leaves while following the prefetch lets go of its download, which carries on', async () => {
  const net = network();
  const file = { path: '/arena/shared-a.glb', bytes: 10 };
  const prefetched = [];
  const prefetch = loadFiles([file], (p) => prefetched.push(p.loaded));
  await settle();
  net.send(file.path, 3);
  await settle();

  const abort = new AbortController();
  const heard = [];
  const game = loadFiles([file], (p) => heard.push(p.loaded), abort.signal);
  await settle();
  assert.deepEqual(heard, [3], 'joins with the bytes so far');
  net.send(file.path, 2);
  await settle();
  assert.deepEqual(heard, [3, 5], 'then follows each chunk');

  abort.abort();
  await assert.rejects(game, { name: 'AbortError' });
  net.send(file.path, 5);
  net.end(file.path);
  const blobs = await prefetch;
  await settle();
  assert.deepEqual(heard, [3, 5], 'hears nothing after leaving');
  assert.equal(blobs.get(file.path).size, 10, 'the prefetch gets the file');
  assert.equal(prefetched.at(-1), 10);
  assert.equal(net.requests.size, 1, 'one download, never restarted');
  assert.equal(net.requests.get(file.path).aborted, false, 'never cancelled');
});

await test('a follower that stays gets the file and every byte of it', async () => {
  const net = network();
  const file = { path: '/arena/shared-b.glb', bytes: 8 };
  const prefetch = loadFiles([file], () => {});
  await settle();
  net.send(file.path, 4);
  await settle();
  const heard = [];
  const game = loadFiles(
    [file],
    (p) => heard.push(p),
    new AbortController().signal,
  );
  await settle();
  net.send(file.path, 4);
  net.end(file.path);
  const [mine, theirs] = await Promise.all([game, prefetch]);
  assert.equal(mine.get(file.path), theirs.get(file.path), 'the same blob');
  assert.deepEqual(heard.at(-1), { loaded: 8, total: 8, cached: false });
});

await test('a follower aborted before it joins never subscribes', async () => {
  const net = network();
  const file = { path: '/arena/shared-c.glb', bytes: 4 };
  const prefetch = loadFiles([file], () => {});
  await settle();
  const abort = new AbortController();
  abort.abort();
  const heard = [];
  await assert.rejects(
    loadFiles([file], (p) => heard.push(p), abort.signal),
    { name: 'AbortError' },
  );
  net.send(file.path, 4);
  net.end(file.path);
  await prefetch;
  assert.deepEqual(heard, []);
});
