import test from 'node:test';
import assert from 'node:assert/strict';
import { Accounts } from '../server/accounts.ts';
import { openDatabase } from '../server/database.ts';
import { hashPassword, newSession, identity, token } from '../server/auth.ts';
import { ArenaRooms } from '../server/arena.ts';
import { DinerRooms } from '../server/diner.ts';
import { createGame, isSavedGame, legalMoves, passCount, play, revealingTrick } from '../lib/games/trio/engine.ts';

await test('deletion anonymizes shared seat names and identity keys without losing the other player', async () => {
  const db = openDatabase(':memory:');
  try {
    const password = 'account-privacy-test-password';
    const hash = await hashPassword(password);
    const id = token(), other = token();
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(id, 'deleted@example.test', 'Private Name', hash);
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(other, 'remaining@example.test', 'Remaining', hash);
    db.prepare('INSERT INTO guests VALUES (?,?)').run(id, 'Private Guest Name');
    newSession(db, id, false, false);
    const who = identity(db, { headers: { cookie: newSession(db, id, true, false).split(';')[0] } });
    const shared = token();
    db.prepare('INSERT INTO tables VALUES (?,?,?)').run(shared, other, JSON.stringify({
      owner: other,
      members: [{ id, name: 'Private Name' }, { id: other, name: 'Remaining' }],
      seats: [{ id, name: 'Old Private Name' }, { id: other, name: 'Remaining' }],
      game: { players: [{ name: 'Old Private Name' }, { name: 'Remaining' }] },
      adventure: { seats: ['Old Private Name', 'Remaining'], log: [{ id: 0, text: 'Everyone locks.' }, { id: 1, text: 'Old Private Name wins.' }] },
      nextVote: { ballots: { [id]: 'orin', [other]: 'miro' } },
    }));
    const run = token();
    db.prepare('INSERT INTO folio_runs VALUES (?,?)').run(run, JSON.stringify({ host: id, votes: { [id]: 'node-1', [other]: 'node-2' } }));
    db.prepare('INSERT INTO folio_members VALUES (?,?,?,?,?)').run(run, id, 'Private Name', 1, 1);
    db.prepare('INSERT INTO folio_members VALUES (?,?,?,?,?)').run(run, other, 'Remaining', 2, 2);
    db.exec('CREATE TABLE rota_rooms (token TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL)');
    const rota = token();
    db.prepare('INSERT INTO rota_rooms VALUES (?,?,?)').run(rota, JSON.stringify({
      owner: id, members: [{ id, name: 'Private Name' }, { id: other, name: 'Remaining' }], seats: [id, other],
      game: { seats: [{ name: 'Old Private Name', score: 30 }, { name: 'Remaining', score: 60 }] },
    }), 1);
    await new Accounts(db).delete(who, { password });
    for (const table of ['tables', 'folio_runs', 'rota_rooms']) {
      const row = db.prepare(`SELECT state FROM ${table}`).get();
      assert.ok(!row.state.includes(id), `${table} retains the deleted identity`);
      assert.ok(!row.state.includes('Private Name'), `${table} retains the deleted name`);
      assert.ok(row.state.includes(other));
    }
    const saved = JSON.parse(db.prepare('SELECT state FROM tables').get().state);
    assert.equal(saved.game.players[0].name, 'Deleted player');
    assert.equal(saved.adventure.seats[0], 'Deleted player');
    assert.deepEqual(saved.adventure.log, [{ id: 0, text: 'Everyone locks.' }]);
    const room = JSON.parse(db.prepare('SELECT state FROM rota_rooms').get().state);
    assert.equal(room.owner, other);
    assert.equal(room.game.seats[1].score, 60);
    assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM guests WHERE id=?').get(id).n, 0);
    assert.equal(db.prepare('SELECT count(*) n FROM sessions WHERE guest_id=?').get(id).n, 0);
  } finally { db.close(); }
});

await test('live Arena and Diner rooms forget a deleted player and preserve the remaining crew', () => {
  const arena = new ArenaRooms(), diner = new DinerRooms();
  const id = token(), other = token();
  const members = [{ id, name: 'Private Name' }, { id: other, name: 'Remaining' }];
  try {
    const arenaTable = token(), dinerTable = token();
    const arenaToken = arena.launch(arenaTable, id, members, { mode: 'duel', difficulty: 'hard' });
    const dinerToken = diner.launch(dinerTable, id, members, { level: 1 });
    arena.forgetUser(id, [arenaTable]);
    diner.forgetUser(id, [dinerTable]);
    const battle = arena.rooms.get(arenaToken), shift = diner.rooms.get(dinerToken);
    assert.equal(battle.owner, other);
    assert.equal(battle.seats[0].id, null);
    assert.equal(battle.seats[0].name, 'Deleted player');
    assert.equal(shift.owner, other);
    assert.equal(shift.seats[0].id, '');
    assert.equal(shift.match.players[0].name, 'Deleted player');
    assert.equal(battle.table, null);
    assert.equal(shift.table, null);
    arena.forgetUser(other);
    diner.forgetUser(other);
    assert.equal(arena.rooms.size, 0);
    assert.equal(diner.rooms.size, 0);
  } finally { arena.close(); diner.close(); }
});

await test('deletion anonymizes real Trio event text while retaining trick history and playable state', async () => {
  const db = openDatabase(':memory:');
  try {
    const password = 'trio-event-privacy-password';
    const hash = await hashPassword(password);
    const id = token(), other = token(), table = token();
    const oldName = 'Private [Name]';
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(id, 'trio-deleted@example.test', 'Private Name', hash);
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(other, 'trio-remaining@example.test', 'Remaining', hash);
    const who = identity(db, { headers: { cookie: newSession(db, id, true, false).split(';')[0] } });
    let game = createGame('undertow', 'hard', 17, false, 3);
    game.players.forEach((player, index) => { player.name = [oldName, 'Remaining', 'Bot'][index]; });
    for (let step = 0; step < 20 && !revealingTrick(game); step++) {
      const move = game.phase === 'pass'
        ? { type: 'pass', cards: game.players[game.active].hand.slice(0, passCount(game)).map((card) => card.id) }
        : legalMoves(game)[0];
      game = play(game, move);
    }
    assert.ok(isSavedGame(game));
    assert.ok(revealingTrick(game));
    assert.ok(game.events.some((event) => event.text.includes(oldName)));
    const beforeEvents = JSON.parse(JSON.stringify(game.events));
    db.prepare('INSERT INTO tables VALUES (?,?,?)').run(table, other, JSON.stringify({
      owner: other,
      members: [{ id, name: 'Private Name' }, { id: other, name: 'Remaining' }],
      seats: [{ id, name: oldName }, { id: other, name: 'Remaining' }, { id: 'bot-2', name: 'Bot', bot: true }],
      game,
    }));
    await new Accounts(db).delete(who, { password });
    const saved = JSON.parse(db.prepare('SELECT state FROM tables WHERE token=?').get(table).state).game;
    assert.ok(isSavedGame(saved));
    assert.equal(revealingTrick(saved), true);
    assert.equal(saved.events.length, beforeEvents.length);
    assert.deepEqual(saved.events.map(({ text: _text, ...metadata }) => metadata), beforeEvents.map(({ text: _text, ...metadata }) => metadata));
    assert.deepEqual(saved.events.map((event) => event.text), beforeEvents.map((event) => event.text.replaceAll(oldName, 'Deleted player')));
    assert.ok(!JSON.stringify(saved).includes(oldName));
    const next = play(saved, legalMoves(saved)[0]);
    assert.ok(next.revision > saved.revision);
    assert.ok(isSavedGame(next));
  } finally { db.close(); }
});
