import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';
import { observe } from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';
const actor = (id, user = false) => ({
  id,
  name: id,
  userId: user ? id : null,
  sessionHash: 'test',
  expires: Date.now() + 99999,
});
function setup(path = ':memory:') {
  const db = openDatabase(path);
  db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?,?)').run(
    'host',
    'host@example.com',
    'host',
    'unused',
  );
  const online = new Set();
  const tables = new Tables(db, (_, id) => online.has(id));
  return { db, tables, online, host: actor('host', true) };
}
function command(tables, t, who, action, requestId = randomUUID()) {
  return tables.command(t.token, who, {
    action,
    requestId,
    revision: t.revision,
    matchId: t.matchId,
  });
}

test('full human and mixed games for all three games and all supported seat counts', () => {
  const { db, tables, host } = setup();
  try {
    for (const gameId of ['undertow', 'wildgrove', 'midnight'])
      for (let n = 2; n <= 6; n++)
        for (const humans of [n, 1]) {
          let t = tables.create(host);
          const actors = [host];
          t = command(tables, t, host, {
            type: 'configure',
            gameId,
            difficulty: 'medium',
            capacity: n,
          });
          for (let i = 1; i < humans; i++) {
            actors.push(actor(`guest${i}`));
            t = tables.join(t.token, actors[i]);
          }
          t = command(tables, t, host, { type: 'start' });
          const match = t.matchId;
          let steps = 0;
          while (t.status === 'playing') {
            for (let viewer = 0; viewer < humans; viewer++) {
              const v = tables.view(t, actors[viewer]);
              assert.equal(v.viewerSeat, viewer);
              assert.equal('knownPackets' in v.game, false);
              assert.equal('rngState' in v.game, false);
            }
            const g = t.game,
              move = chooseMove(observe(g), 'medium');
            if (t.seats[g.active].bot) {
              tables.botMove(t.token, t.revision, move);
              t = tables.get(t.token);
            } else
              t = command(tables, t, actors[g.active], { type: 'move', move });
            assert.ok(++steps < 1500);
            assert.equal(t.matchId, match);
          }
          assert.equal(t.status, 'finished');
          t = command(tables, t, host, { type: 'abandon' });
          assert.equal(t.status, 'lobby');
          assert.equal(t.game, null);
          t = command(tables, t, host, { type: 'close' });
        }
  } finally {
    db.close();
  }
});
test('ownership, revisions, idempotency, waiters, bot replacement and reusable links', () => {
  const { db, tables, host, online } = setup();
  try {
    let t = tables.create(host);
    const guest = actor('guest');
    t = tables.join(t.token, guest);
    assert.throws(() => command(tables, t, guest, { type: 'start' }), {
      status: 403,
    });
    t = command(tables, t, host, {
      type: 'configure',
      gameId: 'midnight',
      difficulty: 'easy',
      capacity: 2,
    });
    assert.throws(() => tables.join(t.token, actor('full')), { status: 409 });
    t = command(tables, t, host, { type: 'start' });
    const req = {
      action: { type: 'move', move: chooseMove(observe(t.game)) },
      requestId: randomUUID(),
      revision: t.revision,
      matchId: t.matchId,
    };
    assert.throws(() => tables.command(t.token, guest, req), { status: 400 });
    const first = tables.command(t.token, host, req);
    const duplicate = tables.command(t.token, host, req);
    assert.equal(JSON.stringify(first), JSON.stringify(duplicate));
    assert.throws(
      () => tables.command(t.token, host, { ...req, requestId: randomUUID() }),
      { status: 409 },
    );
    assert.throws(
      () =>
        tables.command(t.token, host, { ...req, action: { type: 'close' } }),
      { status: 409 },
    );
    t = tables.join(t.token, actor('waiting'));
    assert.equal(tables.view(t, actor('waiting')).game, null);
    assert.equal(tables.view(t, guest).viewerSeat, 1);
    online.add('guest');
    assert.throws(
      () => command(tables, t, host, { type: 'replace', memberId: 'guest' }),
      { status: 409 },
    );
    online.delete('guest');
    t = command(tables, t, host, { type: 'replace', memberId: 'guest' });
    assert.equal(tables.view(t, guest).game, null);
    assert.throws(
      () => command(tables, t, guest, { type: 'move', move: { type: 'roll' } }),
      { status: 403 },
    );
    const same = tables.join(t.token, guest);
    assert.equal(same.members.length, 3);
    t = command(tables, t, host, { type: 'abandon' });
    t = command(tables, t, host, { type: 'remove', memberId: 'waiting' });
    t = command(tables, t, host, {
      type: 'configure',
      gameId: 'wildgrove',
      difficulty: 'medium',
      capacity: 2,
    });
    t = command(tables, t, host, { type: 'start' });
    assert.equal(t.game.id, 'wildgrove');
    assert.equal(tables.view(t, guest).viewerSeat, 1);
    t = command(tables, t, host, { type: 'close' });
    assert.throws(() => tables.join(t.token, guest), { status: 410 });
  } finally {
    db.close();
  }
});
test('persistent match and deduplication survive reopening SQLite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-test-'));
  const path = join(dir, 'data.sqlite');
  let app = setup(path);
  const host = app.host;
  try {
    let t = app.tables.create(host);
    t = command(app.tables, t, host, { type: 'start' });
    const req = {
      action: { type: 'move', move: chooseMove(observe(t.game)) },
      requestId: randomUUID(),
      revision: t.revision,
      matchId: t.matchId,
    };
    const saved = app.tables.command(t.token, host, req);
    app.db.close();
    app = setup(path);
    assert.equal(
      JSON.stringify(app.tables.get(t.token)),
      JSON.stringify(saved),
    );
    assert.equal(
      JSON.stringify(app.tables.command(t.token, host, req)),
      JSON.stringify(saved),
    );
  } finally {
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('host expansion choice reaches shared game and five-card exchange is accepted', () => {
  const { db, tables, host } = setup();
  try {
    let t = tables.create(host);
    t = command(tables, t, host, {
      type: 'configure',
      gameId: 'undertow',
      capacity: 2,
      difficulty: 'medium',
      starter: true,
    });
    t = tables.join(t.token, actor('guest'));
    assert.equal(tables.view(t, host).starter, true);
    t = command(tables, t, host, { type: 'start' });
    assert.equal(t.game.starter, true);
    assert.ok(t.game.players.every((p) => p.wards === 2 && p.calms === 1));
    t = command(tables, t, host, {
      type: 'move',
      move: {
        type: 'pass',
        cards: t.game.players[0].hand.slice(0, 5).map((c) => c.id),
      },
    });
    assert.equal(t.game.active, 1);
  } finally {
    db.close();
  }
});

test('simultaneous human commands from the same update are accepted once per seat', () => {
  const { db, tables, host } = setup();
  const guest = actor('guest');
  let t = tables.create(host);
  t = command(tables, t, host, {
    type: 'configure',
    gameId: 'midnight',
    difficulty: 'easy',
    capacity: 2,
  });
  t = tables.join(t.token, guest);
  t = command(tables, t, host, { type: 'start' });
  const token = t.token;
  const snapshot = structuredClone(t);
  const original = structuredClone(tables.get(token).game.players);
  const key = `${snapshot.game.round}:${snapshot.game.pick}:${snapshot.game.phase}`;
  const submit = (who, move) =>
    tables.command(token, who, {
      requestId: randomUUID(),
      matchId: snapshot.matchId,
      revision: snapshot.revision,
      action: { type: 'move', move, decision: key },
    });
  const first = { type: 'play', card: original[1].hand[0].id };
  submit(guest, first);
  assert.deepEqual(tables.get(token).game.players, original);
  assert.throws(() => submit(guest, first), { status: 403 });
  submit(host, { type: 'play', card: original[0].hand[0].id });
  assert.equal(tables.get(token).game.pick, 2);
  assert.throws(
    () => submit(host, { type: 'play', card: original[0].hand[1].id }),
    { status: 409 },
  );
  db.close();
});

test('lobby suggestions are shared, toggle per member, and disappear when a guest leaves', () => {
  const { db, tables, host } = setup();
  try {
    const guest = actor('guest');
    let t = tables.join(tables.create(host).token, guest);
    t = command(tables, t, guest, { type: 'vote', gameId: 'midnight' });
    t = command(tables, t, host, { type: 'vote', gameId: 'midnight' });
    assert.deepEqual(tables.view(tables.get(t.token), guest).votes.midnight, [
      'guest',
      'host',
    ]);
    assert.equal(t.gameId, 'undertow');
    assert.throws(
      () =>
        command(tables, t, guest, {
          type: 'configure',
          gameId: 'midnight',
          difficulty: 'easy',
          capacity: 2,
        }),
      { status: 403 },
    );
    assert.throws(
      () => command(tables, t, guest, { type: 'vote', gameId: 'unknown' }),
      { status: 400 },
    );
    t = command(tables, t, guest, { type: 'vote', gameId: 'midnight' });
    assert.deepEqual(t.votes.midnight, ['host']);
    t = command(tables, t, guest, { type: 'vote', gameId: 'wildgrove' });
    t = command(tables, t, guest, { type: 'leave' });
    assert.deepEqual(t.votes.wildgrove, []);
    t = command(tables, t, host, { type: 'start' });
    assert.throws(
      () => command(tables, t, host, { type: 'vote', gameId: 'midnight' }),
      { status: 409 },
    );
  } finally {
    db.close();
  }
});

test('shared practice accepts moves while only the host controls lessons and a fresh real match', () => {
  const { db, tables, host } = setup();
  try {
    for (const gameId of ['undertow', 'wildgrove', 'midnight']) {
      const guest = actor('guest');
      let t = tables.join(tables.create(host).token, guest);
      t = command(tables, t, host, {
        type: 'configure',
        gameId,
        difficulty: 'medium',
        capacity: 2,
      });
      t = command(tables, t, host, { type: 'start', learning: true });
      const practiceId = t.matchId;
      assert.equal(tables.view(t, guest).game.tutorial, true);
      assert.throws(
        () => command(tables, t, guest, { type: 'lesson', step: 1 }),
        { status: 403 },
      );
      assert.throws(() => command(tables, t, guest, { type: 'begin-match' }), {
        status: 403,
      });
      assert.throws(
        () => command(tables, t, host, { type: 'lesson', step: 999 }),
        { status: 400 },
      );
      t = command(tables, t, host, { type: 'lesson', step: 1 });
      assert.equal(tables.view(tables.get(t.token), guest).game.lesson, 1);
      for (let i = 0; i < 6; i++) {
        const seat = t.game.active;
        t = command(tables, t, seat === 0 ? host : guest, {
          type: 'move',
          move: chooseMove(observe(t.game)),
        });
        assert.equal(t.game.lesson, 1);
      }
      t = tables.join(t.token, actor('late-guest'));
      t = command(tables, t, host, { type: 'begin-match' });
      assert.equal(tables.view(t, actor('late-guest')).viewerSeat, null);
      assert.notEqual(t.matchId, practiceId);
      assert.equal(t.game.tutorial, false);
      assert.equal(t.game.round, 1);
      assert.equal(t.game.lesson, 0);
      assert.equal(tables.view(t, guest).viewerSeat, 1);
      assert.throws(
        () => command(tables, t, host, { type: 'lesson', step: 1 }),
        { status: 409 },
      );
      assert.throws(() => command(tables, t, host, { type: 'begin-match' }), {
        status: 409,
      });
      command(tables, t, host, { type: 'close' });
    }
  } finally {
    db.close();
  }
});
