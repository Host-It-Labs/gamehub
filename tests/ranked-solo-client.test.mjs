import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { launchRankedSolo, rankedSoloPath, rankedSoloRequest } from '../lib/online/ranked-solo.ts';
import { useRatedSolo } from '../lib/online/use-rated-solo.ts';

await test('ranked launch only accepts the expected internal authoritative game room', () => {
  for (const game of ['undertow', 'wildgrove', 'midnight'])
    assert.equal(rankedSoloPath('/table/abcdEFGH_123-456', game), '/table/abcdEFGH_123-456');
  assert.equal(rankedSoloPath('/rota/abcdEFGH_123-456', 'rota'), '/rota/abcdEFGH_123-456');
  for (const url of [
    'https://elsewhere.invalid/table/abcdefgh', '//elsewhere.invalid/table/abcdefgh',
    '/table/abcdefgh?next=elsewhere', '/table/abcdefgh#secret', '/table/../abcdefgh',
    '/table/abcdefgh/more', '/table/short', '/rota/abcdefgh', '/auth', null, {},
  ]) assert.throws(() => rankedSoloPath(url, 'undertow'));
  assert.throws(() => rankedSoloPath('/table/abcdefgh', 'rota'));
});

await test('rated launch makes sure of a guest first, then sends settings only to a server-created room', async (t) => {
  const choice = {
    gameId: 'wildgrove', seats: 4, difficulty: 'hard', contentSet: 'alpine',
    fastMode: false, customerOrders: false, sanctuaryGoalsEnabled: true, census: true,
    requestId: 'same-request-0123456789',
  };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push([path, JSON.parse(options.body)]);
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    return new Response(JSON.stringify(path === '/api/guest' ? { name: 'Ada', guest: true } : { url: '/table/abcdefgh' }), { status: 200 });
  });
  assert.equal(await launchRankedSolo({ ...choice, name: 'Ada' }), '/table/abcdefgh');
  assert.deepEqual(calls, [['/api/guest', { name: 'Ada' }], ['/api/solo/ranked', choice]]);
});

await test('session expiration and failed ranked launches surface an error without creating a local result', async (t) => {
  const choice = {
    gameId: 'rota', seats: 1, difficulty: 'hard', map: 'meadow',
    ext: { rivers: false, plans: false, towns: false, rockfall: false },
    requestId: 'same-request-0123456789',
  };
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({ error: 'Sign in to play ranked.' }), { status: 401 },
  ));
  await assert.rejects(launchRankedSolo(choice), { status: 401, message: 'Sign in to play ranked.' });
});

await test('retrying unchanged settings keeps the request id; choosing another setup starts another attempt', () => {
  const choice = {
    gameId: 'undertow', seats: 3, difficulty: 'hard',
    fastMode: false, customerOrders: false, sanctuaryGoalsEnabled: false,
  };
  const first = rankedSoloRequest(choice);
  assert.match(first.requestId, /^[a-f0-9]{32}$/);
  const retried = rankedSoloRequest({ ...choice }, first);
  assert.deepEqual(retried, first);
  assert.notEqual(rankedSoloRequest({ ...choice, gold: true }, first).requestId, first.requestId);
});

await test('a guest name rides along with a first rated launch, and retrying keeps the request', () => {
  const choice = {
    gameId: 'midnight', seats: 4, difficulty: 'hard',
    fastMode: false, customerOrders: false, sanctuaryGoalsEnabled: false,
  };
  const first = rankedSoloRequest(choice, undefined, 'Ada');
  assert.equal(first.name, 'Ada');
  assert.equal(rankedSoloRequest(choice, first, 'Ada').requestId, first.requestId);
  assert.equal(rankedSoloRequest(choice).name, undefined);
});

await test('server-rendered setup shows no account prompt and asks the server nothing while rendering', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request during render'); });
  function Setup() {
    const rated = useRatedSolo();
    assert.equal(rated.busy, false);
    assert.equal(rated.error, '');
    assert.equal(rated.activeFor('undertow'), undefined);
    return createElement('button', null, 'Play');
  }
  assert.equal(renderToString(createElement(Setup)), '<button>Play</button>');
  assert.equal(fetch.mock.callCount(), 0);
});
