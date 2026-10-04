import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';
import { observe, preparationKey } from '../lib/games/trio/engine.ts';
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
  // A successful join in these unit fixtures represents an active SSE client.
  const joinTable = tables.join.bind(tables);
  tables.join = (invite, who) => {
    const result = joinTable(invite, who);
    online.add(who.id);
    return result;
  };
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

await test('full human and mixed games for all three games and all supported seat counts', () => {
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
              tables.botMove(
                t.token,
                preparationKey(g, g.active),
                move,
                g.active,
              );
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
await test('an invalid or missing bot-worker result falls back to a legal move', () => {
  const { db, tables, host } = setup();
  try {
    let t = tables.create(host);
    t = command(tables, t, host, {
      type: 'configure',
      gameId: 'undertow',
      difficulty: 'medium',
      capacity: 2,
    });
    t = command(tables, t, host, { type: 'start' });
    t = command(tables, t, host, {
      type: 'move',
      move: chooseMove({ ...observe(t.game, 0), active: 0 }, 'medium'),
    });
    assert.equal(t.seats[t.game.active].bot, true);
    const revision = t.revision;
    tables.botMove(
      t.token,
      preparationKey(t.game, t.game.active),
      null,
      t.game.active,
    );
    t = tables.get(t.token);
    assert.equal(t.botError, false);
    assert.ok(t.revision > revision);
  } finally {
    db.close();
  }
});
await test('ownership, revisions, idempotency, waiters, bot replacement and reusable links', () => {
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
      action: {
        type: 'move',
        move: chooseMove({ ...observe(t.game, 0), active: 0 }),
      },
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
await test('persistent match and deduplication survive reopening SQLite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-test-'));
  const path = join(dir, 'data.sqlite');
  let app = setup(path);
  const host = app.host;
  try {
    let t = app.tables.create(host);
    t = command(app.tables, t, host, { type: 'start' });
    const req = {
      action: {
        type: 'move',
        move: chooseMove({ ...observe(t.game, 0), active: 0 }),
      },
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

await test('host extension choice reaches the shared game, and Nox seats three or more', () => {
  const { db, tables, host } = setup();
  try {
    let t = tables.create(host);
    t = command(tables, t, host, {
      type: 'configure',
      gameId: 'undertow',
      capacity: 2,
      difficulty: 'medium',
      gold: true,
      anchor: true,
    });
    // Two seats are no longer a Nox table: the nearest allowed count is three.
    assert.equal(t.capacity, 3);
    t = tables.join(t.token, actor('guest'));
    assert.equal(tables.view(t, host).gold, true);
    assert.equal(tables.view(t, host).anchor, true);
    // The Fast deck deals four hands at most.
    t = command(tables, t, host, { type: 'configure', gameId: 'undertow', capacity: 6, difficulty: 'medium', fastMode: true });
    assert.equal(t.capacity, 4);
    t = command(tables, t, host, { type: 'configure', gameId: 'undertow', capacity: 3, difficulty: 'medium', fastMode: false });
    t = command(tables, t, host, { type: 'start' });
    assert.equal(t.game.gold, true);
    assert.equal(t.game.anchor, true);
    assert.equal(t.game.players.length, 3);
    t = command(tables, t, host, {
      type: 'move',
      move: {
        type: 'pass',
        cards: t.game.players[0].hand.slice(0, 4).map((c) => c.id),
      },
    });
    assert.notEqual(t.game.active, 0);
  } finally {
    db.close();
  }
});

await test('simultaneous human commands from the same update are accepted once per seat', () => {
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

await test('lobby suggestions are shared, toggle per member, and disappear when a guest leaves', () => {
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

await test('shared practice accepts moves while only the host controls lessons and a fresh real match', () => {
  const { db, tables, host } = setup();
  try {
    for (const gameId of ['undertow', 'wildgrove', 'midnight']) {
      const guest = actor('guest');
      // Nox needs three players: a second guest takes the third seat.
      const third = actor('third-guest');
      let t = tables.join(tables.create(host).token, guest);
      if (gameId === 'undertow') t = tables.join(t.token, third);
      const people = gameId === 'undertow' ? [host, guest, third] : [host, guest];
      t = command(tables, t, host, {
        type: 'configure',
        gameId,
        difficulty: 'medium',
        capacity: people.length,
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
        t = command(tables, t, people[seat], {
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

await test('Tide Fast mode survives settings, shared practice, and match start', () => {
  const { db, tables, host } = setup();
  try {
    let t = tables.create(host);
    const settings = {
      type: 'configure',
      gameId: 'undertow',
      difficulty: 'easy',
      capacity: 3,
      gold: true,
    };
    t = command(tables, t, host, { ...settings, fastMode: true });
    assert.equal(tables.view(t, host).fastMode, true);
    t = command(tables, t, host, settings);
    assert.equal(t.fastMode, true);
    assert.throws(() =>
      command(tables, t, host, { ...settings, fastMode: 'yes' }),
    );
    t = command(tables, t, host, { type: 'start', learning: true });
    assert.equal(t.game.fastMode, true);
    assert.equal(t.game.gold, true);
    assert.ok(
      t.game.players.every(
        (p) => p.hand.length === 10 && p.hand.every((c) => c.rank <= (c.kind === 4 ? 10 : 5)),
      ),
    );
    t = command(tables, t, host, { type: 'begin-match' });
    assert.equal(t.game.fastMode, true);
    assert.equal(t.game.tutorial, false);
  } finally {
    db.close();
  }
});

await test('online players can withdraw their hidden commitment but never undo a revealed pick', () => {
  const { db, tables, host } = setup();
  const guest = actor('undo-guest');
  try {
    let t = tables.create(host);
    t = command(tables, t, host, { type: 'configure', gameId: 'midnight', capacity: 2, difficulty: 'medium' });
    t = tables.join(t.token, guest);
    t = command(tables, t, host, { type: 'start' });
    const hand = structuredClone(t.game.players[0].hand);
    const move = { type: 'play', card: hand[0].id };
    t = command(tables, t, host, { type: 'move', move });
    assert.equal(t.game.ready[0], true);
    t = command(tables, t, host, { type: 'move', move: { type: 'undo' } });
    assert.equal(t.game.ready[0], false);
    assert.deepEqual(t.game.players[0].hand, hand);
    t = command(tables, t, host, { type: 'move', move });
    t = command(tables, t, guest, { type: 'move', move: { type: 'play', card: t.game.players[1].hand[0].id } });
    assert.throws(() => command(tables, t, host, { type: 'move', move: { type: 'undo' } }));
  } finally { db.close(); }
});

await test('shared lobby setup persists, follows the host, and rejects guest changes', () => {
  const { db, tables, host } = setup();
  try {
    let t = tables.create(host);
    const guest = actor('setup-guest');
    t = tables.join(t.token, guest);
    assert.equal(tables.view(t, guest).setupOpen, false);
    t = command(tables, t, host, { type: 'configure', gameId: 'wildgrove', difficulty: 'medium', capacity: 4, openSetup: true });
    let view = tables.view(tables.get(t.token), guest);
    assert.equal(view.setupOpen, true);
    assert.equal(view.gameId, 'wildgrove');
    for (const action of [
      { type: 'setup', open: false },
      { type: 'configure', gameId: 'midnight', difficulty: 'hard', capacity: 4 },
      { type: 'start' },
    ]) assert.throws(() => command(tables, t, guest, action), /Only the host/);
    t = command(tables, t, host, { type: 'configure', gameId: 'wildgrove', difficulty: 'hard', capacity: 4, contentSet: 'alpine', census: true });
    view = tables.view(tables.get(t.token), guest);
    assert.equal(view.setupOpen, true);
    assert.equal(view.difficulty, 'hard');
    assert.equal(view.census, true);
    assert.equal(view.contentSet, 'alpine');
    // Mora's boards are Mora's alone.
    assert.throws(() => command(tables, t, host, { type: 'configure', gameId: 'midnight', difficulty: 'hard', capacity: 4, contentSet: 'alpine' }), /content set/);
    t = tables.join(t.token, actor('late-setup-guest'));
    assert.equal(tables.view(t, actor('late-setup-guest')).setupOpen, true);
    t = command(tables, t, host, { type: 'setup', open: false });
    assert.equal(tables.view(t, guest).setupOpen, false);
    t = command(tables, t, host, { type: 'setup', open: true });
    t = command(tables, t, host, { type: 'start', learning: true });
    assert.equal(tables.view(t, guest).setupOpen, false);
    assert.equal(tables.view(t, guest).game.tutorial, true);
    assert.throws(() => command(tables, t, host, { type: 'setup', open: true }), /Return to the lobby/);
    t = command(tables, t, host, { type: 'abandon' });
    assert.equal(tables.view(t, guest).setupOpen, false);
  } finally { db.close(); }
});

await test('the admin role passes on: an explicit leave, a hand-over, and staying away', () => {
  const { db, tables, host, online } = setup();
  try {
    const guest = actor('guest'),
      late = actor('late');
    let t = tables.create(host);
    t = tables.join(t.token, guest);
    t = tables.join(t.token, late);
    // Handing the table over by hand.
    t = command(tables, t, host, { type: 'owner', memberId: 'guest' });
    assert.equal(t.owner, 'guest');
    assert.equal(tables.view(t, guest).isHost, true);
    assert.equal(tables.view(t, host).isHost, false);
    assert.throws(
      () => command(tables, t, host, { type: 'owner', memberId: 'host' }),
      { status: 403 },
    );
    t = command(tables, t, guest, { type: 'owner', memberId: 'host' });
    // The admin leaving the lobby hands it to the earliest joiner still here.
    online.delete('guest');
    t = command(tables, t, host, { type: 'leave' });
    assert.equal(t.owner, 'late');
    assert.equal(t.members.some((m) => m.id === 'host'), false);
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('ann', 'ann@example.com', 'ann', 'unused');
    const ann = actor('ann', true);
    t = tables.join(t.token, ann);
    t = command(tables, t, late, { type: 'owner', memberId: 'ann' });
    assert.equal(
      db.prepare('SELECT owner FROM tables WHERE token=?').get(t.token).owner,
      'ann',
      'a signed-in admin finds it among their tables',
    );
    assert.equal(tables.list(ann).length, 1);
    t = command(tables, t, ann, { type: 'owner', memberId: 'late' });
    t = command(tables, t, late, { type: 'remove', memberId: 'ann' });
    // Away long enough, the admin gives way to a player who is still here.
    t = command(tables, t, late, {
      type: 'configure',
      gameId: 'midnight',
      difficulty: 'easy',
      capacity: 2,
    });
    online.add('guest');
    t = command(tables, t, late, { type: 'start' });
    online.delete('late');
    online.delete('guest');
    assert.equal(tables.handOverIfAway(t.token), null, 'nobody else is here');
    online.add('guest');
    t = tables.handOverIfAway(t.token);
    assert.equal(t.owner, 'guest');
    assert.equal(tables.view(t, guest).canAdvance, true);
    online.add('late');
    assert.equal(tables.handOverIfAway(t.token), null, 'the admin is here');
    // The last player out of the lobby closes the table.
    t = command(tables, t, guest, { type: 'abandon' });
    t = command(tables, t, guest, { type: 'remove', memberId: 'late' });
    t = command(tables, t, guest, { type: 'leave' });
    assert.equal(t.status, 'closed');
  } finally {
    db.close();
  }
});
