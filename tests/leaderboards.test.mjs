import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../server/database.ts';
import {
  Leaderboards,
  RATING_K,
  leaderboardViews,
  ratingDelta,
  rotaCoreScore,
  rotaOutcome,
  trioOutcome,
} from '../server/leaderboards.ts';
import { Tables } from '../server/tables.ts';
import { RotaRooms } from '../server/rota.ts';
import { FolioRuns } from '../server/folio.ts';
import { Expeditions } from '../server/expeditions.ts';
import { Accounts } from '../server/accounts.ts';
import { createGame, preparationKey } from '../lib/games/trio/engine.ts';
import { createRota, noExtensions } from '../lib/games/rota/engine.ts';
import { MAP_IDS } from '../lib/games/rota/maps.ts';
import { createFolio } from '../lib/games/folio/engine.ts';
import { bookXpAt } from '../lib/games/relic/scratch.ts';
import { WORLDS } from '../lib/games/relic/engine.ts';
import { STARTING_RATING } from '../lib/games/leaderboards.ts';

/** An account: public on the boards. */
function account(db, id = 'host') {
  db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?,?)').run(id, `${id}@example.test`, id, 'unused');
  return { id, userId: id, name: id, sessionHash: 'test', expires: Date.now() + 60000 };
}
/** A guest: counted, but private until they join. */
function guest(db, id = 'guest') {
  db.prepare('INSERT OR IGNORE INTO guests VALUES (?,?)').run(id, id);
  return { id, userId: null, name: id, sessionHash: 'test', expires: Date.now() + 60000 };
}
function tableFixture(who, { gameId = 'undertow', players = 4, ...overrides } = {}) {
  const game = createGame(gameId, 'hard', 42, false, players);
  return {
    token: randomUUID(),
    owner: who.id,
    gameId,
    rankedSolo: true,
    difficulty: 'hard',
    capacity: players,
    revision: 1,
    status: 'playing',
    members: [{ id: who.id, name: who.name }],
    seats: game.players.map((p, i) => ({ id: i ? `bot-${i}` : who.id, name: p.name, bot: i > 0 })),
    matchId: randomUUID(),
    game,
    botError: false,
    ...overrides,
  };
}
/** Plays a rated table to its end with these final scores (seat 0 is the player). */
function play(boards, t, values, now) {
  boards.observeTable(t);
  const previous = structuredClone(t);
  t.game.players.forEach((p, i) => {
    p.score = values[i];
  });
  t.game.phase = 'over';
  t.status = 'finished';
  if (now !== undefined) {
    const original = Date.now;
    Date.now = () => now;
    try {
      boards.observeTable(t, previous);
    } finally {
      Date.now = original;
    }
  } else boards.observeTable(t, previous);
  return t;
}
const standing = (boards, gameId, who, view) => boards.board(gameId, view, who.id).personal;

await test('rating changes follow the placing against every Hard bot, K 32 from the first game', () => {
  assert.equal(RATING_K, 32);
  assert.equal(STARTING_RATING, 1000);
  // One bot: a win, a loss and a tie at the starting rating.
  assert.equal(ratingDelta(1000, [1]), 16);
  assert.equal(ratingDelta(1000, [0]), -16);
  assert.equal(ratingDelta(1000, [0.5]), 0);
  // Three bots: first, last and second place.
  assert.equal(ratingDelta(1000, [1, 1, 1]), 28);
  assert.equal(ratingDelta(1000, [0, 0, 0]), -28);
  assert.equal(ratingDelta(1000, [1, 1, 0]), 9);
  // Five bots: more to win.
  assert.equal(ratingDelta(1000, [1, 1, 1, 1, 1]), 36);
  // A strong player gains less for the same win and loses more for a loss.
  assert.equal(ratingDelta(1200, [1]), 8);
  assert.equal(ratingDelta(1200, [0]), -24);
  // No floor: a weak player keeps falling, more slowly.
  assert.ok(ratingDelta(600, [0]) < 0 && ratingDelta(600, [0]) > -5);
});

await test('placings read Nox as low-score-wins and break Rota ties by loose ends', () => {
  const nox = createGame('undertow', 'hard', 1, false, 4);
  nox.players.forEach((p, i) => (p.score = [3, 5, 3, 1][i]));
  assert.deepEqual(trioOutcome(nox, 0), [1, 0.5, 0]);
  const mora = createGame('wildgrove', 'hard', 1, false, 3);
  mora.players.forEach((p, i) => (p.score = [40, 20, 40][i]));
  // Mora scores come from the board, so compare through the engine's scores.
  assert.equal(trioOutcome(mora, 0).length, 2);
  assert.deepEqual(rotaOutcome([{ total: 30, errors: -2 }, { total: 30, errors: -4 }, { total: 31, errors: -9 }], 0), [1, 0]);
  assert.deepEqual(rotaOutcome([{ total: 30, errors: -3 }, { total: 30, errors: -3 }], 0), [0.5]);
  assert.equal(
    rotaCoreScore({ exits: 10, road: 8, rail: 6, centre: 4, errors: -3, tunnels: 2, river: 9, towns: 7, plans: 5, total: 48 }),
    27,
  );
});

await test('every setup of a game feeds one rating, with wins and streaks beside it', () => {
  const db = openDatabase(':memory:');
  try {
    const who = account(db),
      boards = new Leaderboards(db);
    play(boards, tableFixture(who, { players: 4 }), [0, 5, 6, 7], 1000); // won against three bots
    play(boards, tableFixture(who, { players: 3 }), [0, 4, 9], 2000); // won against two
    play(boards, tableFixture(who, { players: 5 }), [9, 1, 2, 3, 4], 3000); // last of five
    const row = standing(boards, 'undertow', who);
    assert.equal(row.games, 3);
    assert.equal(row.wins, 2);
    assert.equal(row.streak, 0);
    assert.equal(row.bestStreak, 2);
    let expected = STARTING_RATING;
    for (const outcome of [[1, 1, 1], [1, 1], [0, 0, 0, 0]]) expected += ratingDelta(expected, outcome);
    assert.equal(row.value, expected);
    assert.deepEqual(boards.board('undertow').views.map((v) => v.key), ['rating']);
    assert.equal(db.prepare("SELECT COUNT(DISTINCT board_key) n FROM leaderboard_standings").get().n, 1);
  } finally {
    db.close();
  }
});

await test('practice, other bot levels, extra humans and finished games replayed never count', () => {
  const db = openDatabase(':memory:');
  try {
    const who = account(db),
      boards = new Leaderboards(db);
    const casual = tableFixture(who, { rankedSolo: false });
    play(boards, casual, [0, 1, 2, 3]);
    const medium = tableFixture(who, { difficulty: 'medium' });
    play(boards, medium, [0, 1, 2, 3]);
    const crowded = tableFixture(who);
    crowded.members.push({ id: 'friend', name: 'Friend' });
    play(boards, crowded, [0, 1, 2, 3]);
    assert.equal(standing(boards, 'undertow', who), null);
    const counted = play(boards, tableFixture(who), [0, 1, 2, 3]);
    boards.observeTable(counted, structuredClone(counted));
    assert.equal(standing(boards, 'undertow', who).games, 1);
  } finally {
    db.close();
  }
});

await test('a new rated game replaces the unfinished one as a loss, once', () => {
  const db = openDatabase(':memory:');
  try {
    const who = account(db),
      boards = new Leaderboards(db);
    const first = tableFixture(who, { players: 4 });
    boards.observeTable(first);
    const second = tableFixture(who, { players: 3 });
    boards.observeTable(second);
    boards.observeTable(second);
    assert.equal(db.prepare('SELECT status FROM leaderboard_runs WHERE id=?').get(`table:${first.matchId}`).status, 'forfeit');
    const row = standing(boards, 'undertow', who);
    assert.deepEqual([row.games, row.value], [1, STARTING_RATING + ratingDelta(STARTING_RATING, [0, 0, 0])]);
    // The replaced game ending later changes nothing.
    play(boards, first, [0, 1, 2, 3]);
    assert.equal(standing(boards, 'undertow', who).games, 1);
    // Another game of another title is its own unfinished game.
    const mora = tableFixture(who, { gameId: 'wildgrove', players: 2 });
    boards.observeTable(mora);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM leaderboard_runs WHERE status='active'").get().n, 2);
  } finally {
    db.close();
  }
});

await test('a bot failure voids the game without touching an earlier rating', () => {
  const db = openDatabase(':memory:');
  try {
    const who = account(db),
      tables = new Tables(db, () => true),
      boards = new Leaderboards(db);
    play(boards, tableFixture(who), [0, 1, 2, 3]);
    const before = standing(boards, 'undertow', who).value;
    let t = tables.createSolo(who);
    const command = (action) => {
      t = tables.command(t.token, who, { requestId: randomUUID(), revision: t.revision, matchId: t.matchId, action });
    };
    assert.throws(() => command({ type: 'configure', gameId: 'undertow', capacity: 4, difficulty: 'easy' }), /hard AI/);
    command({ type: 'configure', gameId: 'undertow', capacity: 4, difficulty: 'hard' });
    command({ type: 'start' });
    assert.throws(() => tables.join(t.token, account(db, 'other')), /solo match/);
    assert.equal(tables.list(who).length, 0);
    tables.botMove(t.token, preparationKey(t.game, 1), null, 1);
    assert.equal(db.prepare('SELECT status FROM leaderboard_runs WHERE id=?').get(`table:${t.matchId}`).status, 'disqualified');
    t = tables.get(t.token);
    t.game.phase = 'over';
    t.status = 'finished';
    t.game.players.forEach((p, i) => (p.score = i));
    tables.save(t);
    assert.deepEqual([standing(boards, 'undertow', who).value, standing(boards, 'undertow', who).games], [before, 1]);
  } finally {
    db.close();
  }
});

await test('guests are counted privately, with the place they would take', () => {
  const db = openDatabase(':memory:');
  try {
    const boards = new Leaderboards(db);
    const strong = account(db, 'strong'),
      weak = account(db, 'weak'),
      visitor = guest(db, 'visitor');
    play(boards, tableFixture(strong), [0, 1, 2, 3]);
    play(boards, tableFixture(strong), [0, 1, 2, 3]);
    play(boards, tableFixture(weak), [9, 1, 2, 3]);
    play(boards, tableFixture(visitor), [0, 1, 2, 3]);
    const view = boards.board('undertow', 'rating', visitor.id);
    assert.deepEqual(view.entries.map((e) => e.userId), ['strong', 'weak']);
    assert.equal(view.total, 2);
    assert.equal(view.personal.public, false);
    assert.equal(view.personal.rank, 2);
    assert.equal(view.personal.name, 'visitor');
    assert.equal(boards.board('undertow', 'rating', 'strong').personal.public, true);
    assert.equal(boards.me(visitor.id)[0].public, false);
    assert.deepEqual(boards.me(null), []);
  } finally {
    db.close();
  }
});

await test('Rota: Hard bots feed its rating, alone feeds a best score per map without extension bonuses', () => {
  const db = openDatabase(':memory:');
  try {
    const who = account(db),
      rooms = new RotaRooms(db, { inline: true, awayMs: 1 }),
      boards = new Leaderboards(db);
    const token = rooms.launch(null, who.id, [who], { map: 'meadow', ext: { ...noExtensions, rivers: true }, difficulty: 'easy', seats: 1, rankedSolo: true }, 1);
    const read = () => JSON.parse(db.prepare('SELECT state FROM rota_rooms WHERE token=?').get(token).state);
    const finish = (b) => {
      const state = read();
      const old = structuredClone(state);
      state.game.over = true;
      state.game.final = [b];
      boards.observeRota(state, old);
      db.prepare('UPDATE rota_rooms SET state=? WHERE token=?').run(JSON.stringify(state), token);
      return state;
    };
    const breakdown = (core, bonus) => ({ exits: core, road: 0, rail: 0, centre: 0, errors: 0, tunnels: 0, river: bonus, towns: 0, plans: 0, total: core + bonus });
    rooms.get(token, who, 100000);
    assert.equal(read().game.revision, 0, 'a bot never covers a rated player');
    finish(breakdown(31, 40));
    assert.equal(standing(boards, 'rota', who, 'meadow').value, 31);
    rooms.again(token, who);
    finish(breakdown(19, 0));
    const row = standing(boards, 'rota', who, 'meadow');
    assert.deepEqual([row.value, row.games], [31, 2]);
    assert.equal(standing(boards, 'rota', who, 'harbour'), null);
    assert.equal(boards.result(`/rota/${token}`, who.id).runValue, 19);
    assert.equal(boards.result(`/rota/${token}`, who.id).newBest, false);
    // Against Hard bots: the game's one rating, ties broken by loose ends.
    const room = { token: randomUUID(), matchId: randomUUID(), rankedSolo: true, owner: who.id, members: [who], seats: [who.id, null], game: createRota(2, 42, { difficulty: 'hard' }) };
    boards.observeRota(room);
    const before = structuredClone(room);
    room.game.over = true;
    room.game.final = [{ total: 30, errors: -2 }, { total: 30, errors: -4 }];
    boards.observeRota(room, before);
    assert.equal(standing(boards, 'rota', who).value, STARTING_RATING + 16);
    // One best-score board per map Rota offers for a new match.
    assert.deepEqual(leaderboardViews('rota').map((v) => v.key), ['rating', ...MAP_IDS]);
  } finally {
    db.close();
  }
});

await test('a new Rota town alone drops the unfinished one without any loss', () => {
  const db = openDatabase(':memory:');
  try {
    const who = guest(db),
      rooms = new RotaRooms(db, { inline: true }),
      boards = new Leaderboards(db);
    const first = rooms.launch(null, who.id, [who], { map: 'meadow', ext: noExtensions, difficulty: 'medium', seats: 1, rankedSolo: true });
    rooms.launch(null, who.id, [who], { map: 'ridge', ext: noExtensions, difficulty: 'medium', seats: 1, rankedSolo: true });
    const firstRun = JSON.parse(db.prepare('SELECT state FROM rota_rooms WHERE token=?').get(first).state).matchId;
    assert.equal(db.prepare('SELECT status FROM leaderboard_runs WHERE id=?').get(`rota:${firstRun}`).status, 'abandoned');
    assert.deepEqual(boards.me(who.id), []);
    assert.equal(boards.active(who.id).length, 1);
    // One unfinished Rota game across kinds: a game with bots replaces the town alone.
    const room = { token: randomUUID(), matchId: randomUUID(), rankedSolo: true, owner: who.id, members: [who], seats: [who.id, null], game: createRota(2, 42, { difficulty: 'hard' }) };
    boards.observeRota(room);
    assert.deepEqual(boards.active(who.id).map((a) => a.kind), ['rating']);
    // And a town alone afterwards ends that rated game as a loss.
    rooms.launch(null, who.id, [who], { map: 'meadow', ext: noExtensions, difficulty: 'easy', seats: 1, rankedSolo: true });
    assert.equal(db.prepare('SELECT status FROM leaderboard_runs WHERE id=?').get(`rota:${room.matchId}`).status, 'forfeit');
    assert.equal(standing(boards, 'rota', who).games, 1);
  } finally {
    db.close();
  }
});

await test('Puzzles counts finished solo runs per starting level, a guest’s too', () => {
  const db = openDatabase(':memory:');
  try {
    const who = guest(db),
      boards = new Leaderboards(db),
      runs = new FolioRuns(db);
    const created = runs.create(who, { name: 'guest', seats: 1, difficulty: 2 });
    assert.equal(db.prepare('SELECT actor_id FROM leaderboard_runs').get().actor_id, who.id);
    const finish = (id, difficulty, count, extra = {}) => {
      const g = { ...createFolio(42, 1, Date.now(), undefined, difficulty), ...extra };
      boards.startFolio(id, g, who.id);
      g.path = Array.from({ length: count + 2 }, (_, i) => ({ id: String(i), won: i < count }));
      g.phase = 'over';
      boards.observeFolio(id, g, [who.id]);
    };
    finish('easy', 1, 9, { victory: true });
    finish('medium', 2, 7);
    finish('practice', 2, 20, { practice: { kind: 'word', boss: false } });
    finish('team', 2, 20, { seats: 2 });
    assert.equal(standing(boards, 'folio', who, 'easy').value, 9);
    assert.equal(standing(boards, 'folio', who, 'easy').wins, 1);
    assert.equal(standing(boards, 'folio', who, 'medium').value, 7);
    assert.equal(standing(boards, 'folio', who, 'medium').wins, 0);
    // Several runs at once are fine for Puzzles.
    assert.equal(db.prepare("SELECT status FROM leaderboard_runs WHERE id=?").get(`folio:${created.token}`).status, 'active');
    boards.forfeit(`folio:${created.token}`);
    const invalid = { ...createFolio(42, 1, 1), phase: 'over', path: Array.from({ length: 99 }, (_, i) => ({ id: String(i), won: true })) };
    boards.observeFolio(created.token, invalid, [who.id]);
    assert.equal(standing(boards, 'folio', who, 'medium').value, 7);
  } finally {
    db.close();
  }
});

await test('Lucky keeps the best solo desk, a guest’s too, and drops shared or assisted desks', () => {
  const db = openDatabase(':memory:'),
    environment = process.env.NODE_ENV;
  try {
    const who = guest(db),
      other = account(db, 'other'),
      desks = new Expeditions(db),
      boards = new Leaderboards(db);
    const create = () => desks.create(who, { title: 'My desk', world: WORLDS[0].id });
    const progress = (token, level) => {
      const game = JSON.parse(db.prepare('SELECT state FROM expeditions WHERE token=?').get(token).state);
      game.scratch.xp.seven = bookXpAt(game.scratch, level);
      db.prepare('UPDATE expeditions SET state=? WHERE token=?').run(JSON.stringify(game), token);
      desks.get(token, who);
    };
    const row = () => standing(boards, 'relic', who);
    const first = create(),
      second = create();
    progress(first.token, 4);
    progress(second.token, 7);
    assert.deepEqual([row().value, row().games], [6, 2]);
    desks.join(second.token, other);
    assert.equal(row().value, 3);
    desks.remove(second.token, other);
    progress(second.token, 10);
    assert.equal(row().value, 3);
    desks.remove(first.token, who);
    assert.equal(row().value, 3, 'a deleted solo desk keeps what it earned');
    process.env.NODE_ENV = 'development';
    const assisted = create();
    progress(assisted.token, 9);
    assert.equal(row().value, 8);
    desks.command(assisted.token, who, { requestId: randomUUID(), action: { type: 'dev-unlimited', on: true } });
    assert.equal(row().value, 3);
  } finally {
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
    db.close();
  }
});

await test('public boards show fifty, share tied places, find you lower down and never show emails', () => {
  const db = openDatabase(':memory:');
  try {
    const boards = new Leaderboards(db);
    for (let i = 0; i < 55; i++) {
      const who = account(db, `player-${String(i).padStart(2, '0')}`);
      const g = createFolio(42, 1, 1000, undefined, 1);
      boards.startFolio(who.id, g, who.id);
      g.phase = 'over';
      g.path = Array.from({ length: i < 2 ? 60 : 55 - i }, (_, n) => ({ id: String(n), won: true }));
      boards.observeFolio(who.id, g, [who.id]);
    }
    const response = boards.board('folio', 'easy', 'player-54');
    assert.equal(response.entries.length, 50);
    assert.deepEqual(response.entries.slice(0, 3).map((e) => e.rank), [1, 1, 3]);
    assert.equal(response.personal.rank, 55);
    assert.equal(response.total, 55);
    assert.equal(JSON.stringify(response).includes('@example.test'), false);
    db.prepare('UPDATE users SET name=? WHERE id=?').run('New name', 'player-54');
    assert.equal(boards.board('folio', 'easy', 'player-54').personal.name, 'New name');
    assert.throws(() => boards.board('unknown'), /Choose a game/);
    assert.equal(boards.board('folio', 'arbitrary').selectedView, 'easy');
  } finally {
    db.close();
  }
});

await test('a guest logging in merges into the account in play order, once', () => {
  const db = openDatabase(':memory:');
  try {
    const boards = new Leaderboards(db),
      accounts = new Accounts(db),
      tables = new Tables(db, () => true);
    const member = account(db, 'member'),
      visitor = guest(db, 'visitor');
    play(boards, tableFixture(visitor), [0, 1, 2, 3], 1000);
    play(boards, tableFixture(member), [9, 1, 2, 3], 2000);
    play(boards, tableFixture(visitor), [0, 1, 2, 3], 3000);
    // Unfinished: the guest's Nox clashes with the account's; the guest's Mora does not.
    const theirs = tableFixture(visitor);
    boards.observeTable(theirs);
    const mine = tableFixture(member);
    boards.observeTable(mine);
    let mora = tables.createSolo(visitor);
    mora = tables.command(mora.token, visitor, { requestId: randomUUID(), revision: mora.revision, matchId: null, action: { type: 'configure', gameId: 'wildgrove', capacity: 2, difficulty: 'hard' } });
    mora = tables.command(mora.token, visitor, { requestId: randomUUID(), revision: mora.revision, matchId: null, action: { type: 'start' } });
    accounts.adoptGuest(visitor.id, member.id, 4000);
    accounts.adoptGuest(visitor.id, member.id, 5000);
    let expected = STARTING_RATING;
    for (const outcome of [[1, 1, 1], [0, 0, 0], [1, 1, 1], [0, 0, 0]]) expected += ratingDelta(expected, outcome);
    const row = standing(boards, 'undertow', member);
    assert.deepEqual([row.games, row.value, row.public], [4, expected, true]);
    assert.equal(standing(boards, 'undertow', visitor), null);
    assert.equal(db.prepare('SELECT status FROM leaderboard_runs WHERE id=?').get(`table:${theirs.matchId}`).status, 'forfeit');
    assert.equal(db.prepare('SELECT status FROM leaderboard_runs WHERE id=?').get(`table:${mine.matchId}`).status, 'active');
    // The guest's unfinished Mora table now belongs to the account.
    const moved = tables.get(mora.token);
    assert.equal(moved.owner, member.id);
    assert.equal(moved.seats.find((s) => !s.bot).id, member.id);
    assert.equal(db.prepare('SELECT owner FROM tables WHERE token=?').get(mora.token).owner, member.id);
    // Its action receipts moved too, so a retried move is still recognised.
    assert.deepEqual(db.prepare('SELECT DISTINCT actor FROM commands WHERE table_token=?').all(mora.token).map((r) => r.actor), [member.id]);
    assert.equal(boards.active(member.id).length, 2);
  } finally {
    db.close();
  }
});

await test('the result of a finished game reads its rating change, place and streak', () => {
  const db = openDatabase(':memory:');
  try {
    const boards = new Leaderboards(db);
    const who = account(db),
      rival = account(db, 'rival');
    play(boards, tableFixture(rival), [0, 1, 2, 3], 500);
    const first = tableFixture(who);
    boards.observeTable(first);
    assert.throws(() => boards.result(`/table/${first.token}`, who.id), /still on/);
    play(boards, first, [0, 1, 2, 3], 1000);
    const opening = boards.result(`/table/${first.token}`, who.id);
    assert.deepEqual([opening.before, opening.after, opening.delta, opening.previousRank], [1000, 1028, 28, null]);
    assert.equal(opening.rank, 1);
    const second = play(boards, tableFixture(who, { players: 3 }), [0, 1, 2], 2000);
    const result = boards.result(`/table/${second.token}`, who.id);
    assert.equal(result.before, 1028);
    assert.equal(result.delta, ratingDelta(1028, [1, 1]));
    assert.deepEqual([result.rank, result.total, result.streak, result.counted, result.public], [1, 2, 2, true, true]);
    assert.throws(() => boards.result(`/table/${second.token}`, 'rival'), /not rated/);
    assert.throws(() => boards.result('/table/unknown-room', who.id), /not rated/);
  } finally {
    db.close();
  }
});

await test('account deletion forgets every run, standing and launch', () => {
  const db = openDatabase(':memory:');
  try {
    const boards = new Leaderboards(db),
      who = account(db);
    play(boards, tableFixture(who), [0, 1, 2, 3]);
    boards.recordLaunch(who.id, 'request-0000000001', '{}', '/table/x');
    boards.forget(who.id);
    for (const table of ['leaderboard_runs', 'leaderboard_standings', 'leaderboard_launches'])
      assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, table);
  } finally {
    db.close();
  }
});

await test('the v8 migration keeps accounts and tables, and guests can then own a rated table', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-ranking-'));
  const path = join(dir, 'test.sqlite');
  let db = openDatabase(path);
  try {
    const who = account(db);
    db.prepare('INSERT INTO tables VALUES (?,?,?)').run('kept-table', who.id, '{"token":"kept-table"}');
    db.prepare('INSERT INTO commands VALUES (?,?,?,?)').run('kept-table', who.id, 'r1', '{}');
    // The unreleased first layout: rebuilt on open.
    db.exec(`DROP TABLE leaderboard_launches; DROP TABLE leaderboard_standings; DROP TABLE leaderboard_runs;
      CREATE TABLE leaderboard_runs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, board_key TEXT NOT NULL, status TEXT NOT NULL, value INTEGER, created_at INTEGER NOT NULL, finished_at INTEGER);
      CREATE TABLE leaderboard_records (board_key TEXT, user_id TEXT);
      CREATE TABLE leaderboard_boards (key TEXT);
      PRAGMA user_version=7`);
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 8);
    assert.equal(db.prepare('SELECT owner FROM tables WHERE token=?').get('kept-table').owner, who.id);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM commands').get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('leaderboard_records','leaderboard_boards')").get().n, 0);
    const visitor = guest(db);
    const t = new Tables(db, () => true).createSolo(visitor);
    assert.equal(db.prepare('SELECT owner FROM tables WHERE token=?').get(t.token).owner, visitor.id);
    const boards = new Leaderboards(db);
    play(boards, tableFixture(visitor), [0, 1, 2, 3]);
    db.close();
    db = openDatabase(path);
    assert.equal(new Leaderboards(db).board('undertow', 'rating', visitor.id).personal.games, 1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
