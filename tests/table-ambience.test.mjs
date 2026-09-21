import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';

const host = { id: 'host', userId: 'host', name: 'Host' };
const guest = { id: 'guest', userId: null, name: 'Guest' };
function setup() {
  const db = openDatabase(':memory:');
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
    'host',
    'host@test.invalid',
    'Host',
    'unused',
  );
  const tables = new Tables(db, () => true);
  const table = tables.join(tables.create(host).token, guest);
  return { db, tables, table };
}
function command(tables, table, action, who = host) {
  return tables.command(table.token, who, {
    requestId: randomUUID(),
    revision: table.revision,
    matchId: table.matchId,
    action,
  });
}
await test('multiplayer ambience defaults off, only the host can change it, and all viewers agree', () => {
  const { db, tables, table } = setup();
  try {
    assert.equal(table.ambienceEnabled, false);
    for (const viewer of [host, guest])
      assert.equal(tables.view(table, viewer).ambienceEnabled, false);
    assert.throws(
      () => command(tables, table, { type: 'ambience', enabled: true }, guest),
      /Only the host/,
    );
    for (const enabled of ['true', 1, null, undefined])
      assert.throws(
        () => command(tables, table, { type: 'ambience', enabled }),
        /Invalid ambience/,
      );
    let t = command(tables, table, { type: 'ambience', enabled: true });
    for (const viewer of [host, guest])
      assert.equal(tables.view(t, viewer).ambienceEnabled, true);
    assert.equal(t.revision, table.revision + 1);
    const restored = new Tables(db, () => true).get(t.token);
    assert.equal(restored.ambienceEnabled, true);
    t = command(tables, t, { type: 'ambience', enabled: false });
    for (const viewer of [host, guest])
      assert.equal(tables.view(t, viewer).ambienceEnabled, false);
    const legacy = { ...t };
    delete legacy.ambienceEnabled;
    tables.save(legacy);
    assert.equal(
      new Tables(db, () => true).view(tables.get(t.token), guest)
        .ambienceEnabled,
      false,
    );
  } finally {
    db.close();
  }
});
for (const gameId of ['undertow', 'wildgrove', 'midnight', 'orin', 'miro']) {
  await test(`${gameId}: ambience can change during play without changing the match`, () => {
    const { db, tables, table } = setup();
    try {
      let t = command(tables, table, {
        type: 'configure',
        gameId,
        difficulty: 'medium',
        capacity: 2,
      });
      t = command(tables, t, { type: 'start' });
      assert.equal(tables.view(t, guest).ambienceEnabled, false);
      const state = JSON.parse(JSON.stringify(t.game ?? t.adventure)),
        matchId = t.matchId;
      t = command(tables, t, { type: 'ambience', enabled: true });
      assert.equal(tables.view(t, guest).ambienceEnabled, true);
      assert.deepEqual(t.game ?? t.adventure, state);
      assert.equal(t.matchId, matchId);
      t = command(tables, t, { type: 'ambience', enabled: false });
      assert.equal(tables.view(t, guest).ambienceEnabled, false);
      assert.deepEqual(t.game ?? t.adventure, state);
    } finally {
      db.close();
    }
  });
}
await test('retired game tables recover to a usable lobby without the removed engines', () => {
  const { db, tables, table } = setup();
  try {
    for (const gameId of ['vela', 'coast', 'meadow', 'canal']) {
      tables.save({
        ...table,
        gameId,
        status: 'playing',
        matchId: 'old-match',
        adventure: { kind: gameId },
        seats: [host, guest],
      });
      const restored = new Tables(db, () => true).get(table.token);
      assert.equal(restored.gameId, 'undertow');
      assert.equal(restored.status, 'lobby');
      assert.equal(restored.adventure, null);
      assert.equal(restored.matchId, null);
      assert.equal(restored.members.length, 2);
      assert.throws(() =>
        command(tables, restored, {
          type: 'configure',
          gameId,
          difficulty: 'medium',
          capacity: 2,
        }),
      );
    }
  } finally {
    db.close();
  }
});
