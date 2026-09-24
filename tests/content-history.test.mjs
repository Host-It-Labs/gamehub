import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';
import { standaloneGames } from '../lib/games/standalone/registry.ts';
import { createGame as rankingGame } from '../lib/games/party/ranking.ts';
import { placeHistoryKey, createGame as geographyGame } from '../lib/games/party/geography.ts';

const who = id => ({ id, userId: id, name: id });
const command = (tables, t, action) => tables.command(t.token, who('host'), {
  requestId: randomUUID(), revision: t.revision, matchId: t.matchId, action,
});
for (const gameId of ['miro']) await test(`${gameId}: account union, guests, tutorials and new tables`, () => {
  const db = openDatabase(':memory:');
  try {
    for (const id of ['host', 'friend']) db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(id, `${id}@test.invalid`, id, 'unused');
    let tables = new Tables(db, () => true);
    let t = tables.create(who('host'));
    t = command(tables, t, { type: 'configure', gameId, difficulty: 'medium', capacity: 4 });
    t = tables.join(t.token, who('friend'));
    t = tables.join(t.token, { id: 'guest', userId: null, name: 'Guest' });
    t = tables.join(t.token, { id: 'guest2', userId: null, name: 'Guest 2' });
    t = command(tables, t, { type: 'start', learning: true });
    assert.equal(db.prepare('SELECT count(*) AS n FROM user_content_history').get().n, 0);
    t = command(tables, t, { type: 'begin-match' });
    const keys = t.adventure.cityIds.map(placeHistoryKey);
    for (const id of ['host', 'friend']) {
      const saved = db.prepare('SELECT content_key FROM user_content_history WHERE user_id=?').all(id).map(r => r.content_key);
      assert.deepEqual(new Set(saved), new Set(keys));
    }
    tables.save(t); // Repeated saves do not duplicate history.
    assert.equal(db.prepare('SELECT count(*) AS n FROM user_content_history').get().n, keys.length * 2);
    tables = new Tables(db, () => true);
    let next = tables.create(who('host'));
    next = command(tables, next, { type: 'configure', gameId, difficulty: 'medium', capacity: 2 });
    next = tables.join(next.token, { id: 'guest3', userId: null, name: 'Guest 3' });
    next = command(tables, next, { type: 'start' });
    const fresh = next.adventure.cityIds.map(placeHistoryKey);
    assert.ok(fresh.every(key => !keys.includes(key)));
    const friendOnly = 'friend-only';
    db.prepare('INSERT INTO user_content_history VALUES (?,?,?)').run('friend', gameId, friendOnly);
    assert.ok(tables.contentHistory(t).has(friendOnly));
    assert.ok(!tables.contentHistory(next).has(friendOnly));
  } finally { db.close(); }
});
await test('exhausted pools remain playable and My Top Five ignores history', () => {
  for (const id of ['miro', 'orin']) {
    const base = id === 'miro' ? standaloneGames[id].create(6, 42, 'medium') : rankingGame(id, 6, 42, 'medium', 'individual');
    const keys = id === 'miro' ? base.deck.map(placeHistoryKey) : [...base.deck, ...base.offers.flat()].map(String);
    const seen = new Set(keys);
    const next = id === 'miro' ? geographyGame(6, 42, 'medium', 'individual', seen) : rankingGame(id, 6, 42, 'medium', 'individual', seen);
    assert.equal(new Set(next.deck).size, next.deck.length);
    if (id === 'orin') assert.deepEqual(next, base);
    if (id === 'miro') assert.equal(next.deck.length, base.deck.length);
  }
});

await test('version 2 databases migrate and retain history across disk reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-history-'));
  const path = join(dir, 'test.sqlite');
  let db;
  try {
    db = openDatabase(path);
    db.exec('DROP TABLE content_flags; DROP TABLE folio_commands; DROP TABLE folio_members; DROP TABLE folio_runs; DROP TABLE user_content_history; DROP TABLE expedition_commands; DROP TABLE expedition_members; DROP TABLE expeditions; PRAGMA user_version=2');
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('host', 'host@test.invalid', 'Host', 'unused');
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
    db.prepare('INSERT INTO user_content_history VALUES (?,?,?)').run('host', 'miro', 'place:example');
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT content_key FROM user_content_history').get().content_key, 'place:example');
    assert.equal(db.prepare('SELECT name FROM users').get().name, 'Host');
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});
