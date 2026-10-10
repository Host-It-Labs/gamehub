import test from 'node:test';
import assert from 'node:assert/strict';
import { byRecent, parseLastPlayed } from '../lib/games/library-recent.ts';

const defaults = [
  'arena',
  'rota',
  'wildgrove',
  'diner',
  'alto',
  'midnight',
  'undertow',
  'folio',
  'relic',
  'miro',
  'impostor',
  'orin',
];

await test('nothing played keeps the documented order', () => {
  assert.deepEqual(byRecent(defaults, {}), defaults);
});

await test('played games lead, most recent first; the rest keep their order', () => {
  const played = { folio: 300, impostor: 200, rota: 100 };
  assert.deepEqual(byRecent(defaults, played), [
    'folio',
    'impostor',
    'rota',
    'arena',
    'wildgrove',
    'diner',
    'alto',
    'midnight',
    'undertow',
    'relic',
    'miro',
    'orin',
  ]);
});

await test('a shelf only reorders its own games', () => {
  const quick = ['arena', 'rota', 'wildgrove', 'alto', 'midnight', 'undertow'];
  assert.deepEqual(byRecent(quick, { undertow: 5, folio: 9, alto: 7 }), [
    'alto',
    'undertow',
    'arena',
    'rota',
    'wildgrove',
    'midnight',
  ]);
});

await test('broken or odd storage reads as nothing played', () => {
  assert.deepEqual(parseLastPlayed('not json'), {});
  assert.deepEqual(parseLastPlayed('[1,2]'), {});
  assert.deepEqual(parseLastPlayed(null), {});
  assert.deepEqual(
    parseLastPlayed('{"arena":12,"rota":"x","alto":-1,"nox":null}'),
    { arena: 12 },
  );
});
