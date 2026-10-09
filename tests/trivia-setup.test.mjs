import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';
import { useTriviaSetupMode } from '../components/online/use-trivia-setup.ts';
import {
  triviaSetupConfiguration,
  triviaSetupLink,
  triviaSetupMode,
} from '../lib/online/trivia-setup.ts';

const search = (path) => new URL(path, 'https://gamehub.test').search;
const host = { id: 'host', userId: 'host', name: 'Host' };
const guest = { id: 'guest', userId: null, name: 'Guest' };

await test('server rendering and the hydration snapshot do not read browser query state', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let reads = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      get location() {
        reads++;
        throw new Error('Browser query must wait until hydration finishes.');
      },
    },
  });
  function BackLink() {
    return createElement('a', { href: triviaSetupLink('/tables', useTriviaSetupMode()) }, 'Back');
  }
  try {
    assert.equal(renderToString(createElement(BackLink)), '<a href="/tables">Back</a>');
    assert.equal(reads, 0);
  } finally {
    if (before) Object.defineProperty(globalThis, 'window', before);
    else delete globalThis.window;
  }
});

await test('a bounded Trivia pick travels through tables, login, and a table without accepting redirects', () => {
  for (const mode of ['quick', 'tower', 'expedition']) {
    const library = triviaSetupLink('/tables', mode);
    assert.equal(library, `/tables?trivia=${mode}`);
    const login = triviaSetupLink('/auth', triviaSetupMode(search(library)));
    assert.equal(login, `/auth?trivia=${mode}`);
    const loggedIn = triviaSetupLink('/tables', triviaSetupMode(search(login)));
    assert.equal(loggedIn, library);
    const table = triviaSetupLink(
      '/table/chosen-table',
      triviaSetupMode(search(loggedIn)),
    );
    assert.equal(table, `/table/chosen-table?trivia=${mode}`);
  }
  const external =
    '?trivia=expedition&redirect=https://elsewhere.invalid&next=//elsewhere.invalid';
  assert.equal(
    triviaSetupLink('/auth', triviaSetupMode(external)),
    '/auth?trivia=expedition',
  );
});

await test('unknown, malformed, and duplicate mode requests are ignored', () => {
  for (const query of [
    '',
    '?mode=expedition',
    '?trivia=',
    '?trivia=Tower',
    '?trivia=unknown',
    '?trivia=null',
    '?trivia=%5B%5D',
    '?trivia=quick&trivia=expedition',
    '?trivia=quick&trivia=quick',
  ])
    assert.equal(triviaSetupMode(query), null, query);
  assert.equal(triviaSetupLink('/tables', null), '/tables');
});

await test('consuming the request preserves other query values and development session fragments', () => {
  const original = '/table/chosen-table?lang=en#dev-session=guest-session';
  const requested = triviaSetupLink(original, 'tower');
  assert.equal(
    requested,
    '/table/chosen-table?lang=en&trivia=tower#dev-session=guest-session',
  );
  assert.equal(triviaSetupLink(requested, null), original);
  assert.equal(triviaSetupMode(search(triviaSetupLink(requested, null))), null);
});

await test('a picked mode opens a new or existing owned lobby without starting a match', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      host.id,
      'host@test.invalid',
      host.name,
      'unused',
    );
    const tables = new Tables(db, () => true);
    let t = tables.create(host);
    for (const mode of ['tower', 'expedition']) {
      const view = tables.view(t, host);
      const request = triviaSetupConfiguration(
        view,
        triviaSetupMode(search(triviaSetupLink(`/table/${t.token}`, mode))),
      );
      assert.deepEqual(request, {
        type: 'configure',
        gameId: 'miro',
        triviaMode: mode,
        capacity: t.capacity,
        difficulty: t.difficulty,
        openSetup: true,
      });
      t = tables.command(t.token, host, {
        requestId: randomUUID(),
        matchId: t.matchId,
        revision: t.revision,
        action: request,
      });
      assert.equal(t.status, 'lobby');
      assert.equal(t.gameId, 'miro');
      assert.equal(t.triviaMode, mode);
      assert.equal(t.setupOpen, true);
      assert.equal(t.matchId, null);
      assert.equal(t.game, null);
      assert.equal(t.adventure, undefined);
      t = tables.join(t.token, guest);
      assert.equal(tables.view(t, guest).triviaMode, mode);
    }
  } finally {
    db.close();
  }
});

await test('handoff refuses active matches, external rooms, another admin, invalid modes, and too many people', () => {
  const lobby = {
    isHost: true,
    status: 'lobby',
    capacity: 8,
    difficulty: 'hard',
    members: [
      { id: 'host', bot: false },
      { id: 'guest', bot: false },
    ],
    game: null,
    adventure: null,
    handoff: null,
  };
  assert.equal(
    triviaSetupConfiguration(lobby, 'tower').capacity,
    6,
    'fit Trivia without removing people',
  );
  const variants = [
    { ...lobby, isHost: false },
    { ...lobby, status: 'playing' },
    { ...lobby, status: 'finished' },
    { ...lobby, status: 'closed' },
    { ...lobby, game: {} },
    { ...lobby, adventure: {} },
    { ...lobby, handoff: { kind: 'folio', url: '/folio/active', at: 1 } },
    {
      ...lobby,
      members: Array.from({ length: 7 }, (_, id) => ({ id, bot: false })),
    },
  ];
  for (const table of variants) {
    const before = structuredClone(table);
    assert.equal(triviaSetupConfiguration(table, 'expedition'), null);
    assert.deepEqual(table, before, 'ignored requests do not alter the table');
  }
  for (const mode of [null, undefined, 'Tower', 'other', true, [], {}])
    assert.equal(triviaSetupConfiguration(lobby, mode), null);
});
