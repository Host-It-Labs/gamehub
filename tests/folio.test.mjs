import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KINDS } from '../lib/games/folio/types.ts';
import { BOSS_EVERY, LANES, START_LIVES } from '../lib/games/folio/catalog.ts';
import {
  actFolio,
  choices,
  createFolio,
  levelFor,
  makeMap,
  observeFolio,
  startFolio,
} from '../lib/games/folio/engine.ts';
import { KIND_MODULES } from '../lib/games/folio/kinds/index.ts';
import { FolioRuns } from '../server/folio.ts';
import { openDatabase } from '../server/database.ts';

const now = Date.UTC(2026, 8, 22, 12);
const actor = (id, name = id) => ({
  id,
  name,
  userId: null,
  sessionHash: 'test',
  expires: now + 1e9,
});
/** Drive the open puzzle to its end with the kind's own test drill. */
function play(g, win) {
  const m = KIND_MODULES[g.puzzle.kind];
  for (let i = 0; g.phase === 'puzzle'; i++) {
    assert.ok(i < 3000, `${g.puzzle.kind} never ended`);
    const move = (win ? m.win : m.lose)(g.puzzle.view, g.secret);
    actFolio(g, { type: 'move', move }, now);
  }
}
/** Take the first open path; after a boss, take the first offered edit. */
function step(g, win) {
  const id = choices(g)[0];
  actFolio(g, { type: 'node', id }, now);
  play(g, win);
  if (g.phase === 'result')
    actFolio(
      g,
      g.edits.length ? { type: 'edit', index: 0 } : { type: 'continue' },
      now,
    );
}
/** The trail opens with two acts and grows by one after each boss. */
const OPENING_ACTS = 2;
const rowsOf = (map) => Math.max(...map.map((n) => n.row)) + 1;
/** Map invariants that edits must keep too. */
function assertMapSound(map) {
  const byId = new Map(map.map((n) => [n.id, n]));
  for (let row = 0; row < rowsOf(map); row++) {
    const kinds = map.filter((n) => n.row === row).map((n) => n.kind);
    assert.equal(new Set(kinds).size, kinds.length, 'a row repeats a game');
  }
  for (const n of map) {
    assert.ok(KINDS.includes(n.kind));
    for (const id of n.next)
      assert.notEqual(n.kind, byId.get(id).kind, 'a path repeats a game');
  }
}

await test('the route map: acts of three lanes and a lone boss, no crossings, every node reachable', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const map = makeMap(seed);
    const byId = new Map(map.map((n) => [n.id, n]));
    assert.equal(map.filter((n) => n.type === 'boss').length, OPENING_ACTS);
    assert.equal(rowsOf(map), OPENING_ACTS * BOSS_EVERY);
    for (let row = 0; row < rowsOf(map); row++) {
      const nodes = map.filter((n) => n.row === row);
      const boss = (row + 1) % BOSS_EVERY === 0;
      assert.equal(nodes.length, boss ? 1 : LANES);
      assert.ok(nodes.every((n) => n.type === (boss ? 'boss' : 'puzzle')));
      // Two diagonals between every pair of puzzle rows.
      const next = map.filter((n) => n.row === row + 1);
      if (!boss && next.length === LANES)
        assert.equal(
          nodes.flatMap((n) => n.next).length,
          LANES + LANES - 1,
          'missing diagonal',
        );
    }
    assertMapSound(map);
    for (const n of map) {
      if (n.row < rowsOf(map) - 1) assert.ok(n.next.length > 0);
      for (const id of n.next) {
        const m = byId.get(id);
        assert.equal(m.row, n.row + 1);
        if (n.type !== 'boss' && m.type !== 'boss')
          assert.ok(Math.abs(m.lane - n.lane) <= 1);
      }
    }
    // No two edges between the same pair of rows cross each other.
    for (const a of map)
      for (const b of map)
        if (a.row === b.row && a.lane < b.lane)
          for (const x of a.next)
            for (const y of b.next)
              assert.ok(byId.get(x).lane <= byId.get(y).lane, 'edges cross');
    const reached = new Set(map.filter((n) => n.row === 0).map((n) => n.id));
    for (const n of [...map].sort((a, b) => a.row - b.row))
      if (reached.has(n.id)) n.next.forEach((id) => reached.add(id));
    assert.equal(reached.size, map.length, 'unreachable node');
  }
  assert.deepEqual(makeMap(42), makeMap(42));
});

await test('difficulty: each act is one level harder, capped at very hard', () => {
  const acts = (d) =>
    Array.from({ length: 7 }, (_, a) => levelFor(a * BOSS_EVERY, d));
  assert.deepEqual(acts(1), [1, 2, 3, 4, 4, 4, 4]);
  assert.deepEqual(acts(2), [2, 3, 4, 4, 4, 4, 4]);
  assert.deepEqual(acts(3), [3, 4, 4, 4, 4, 4, 4]);
  const g = createFolio(5, 1, now, undefined, 3);
  assert.equal(g.difficulty, 3);
  for (const n of g.map)
    assert.equal(n.level, levelFor(n.row, 3), 'bosses share their act level');
  assert.throws(() => createFolio(5, 1, now, undefined, 4), /difficulty/);
});

await test('the trail never ends: a perfect crew keeps climbing at very hard, one act always ahead', () => {
  const ACTS = 8;
  for (let seed = 1; seed <= 30; seed++) {
    const d = 1 + (seed % 3);
    const g = createFolio(seed, 1, now, undefined, d);
    for (let r = 0; r < ACTS * BOSS_EVERY; r++) {
      step(g, true);
      assert.equal(g.phase, 'map', 'only losing ends a run');
      const act = Math.floor(r / BOSS_EVERY);
      assert.ok(
        rowsOf(g.map) >= (act + 2) * BOSS_EVERY,
        'the next act is drawn',
      );
    }
    assert.equal(g.victory, false);
    assert.equal(g.path.length, ACTS * BOSS_EVERY);
    assert.equal(g.lives, START_LIVES);
    for (const n of g.map) assert.equal(n.level, levelFor(n.row, d));
    assert.ok(
      g.map.filter((n) => n.row >= 3 * BOSS_EVERY).every((n) => n.level === 4),
    );
    assert.ok(g.struck.length <= 4, 'strikes stop while enough games are left');
    for (const n of g.map.filter((m) => m.row > g.path.length))
      assert.ok(!g.struck.includes(n.kind), 'new acts skip struck games');
    assertMapSound(g.map);
    const byId = new Map(g.map.map((n) => [n.id, n]));
    const reached = new Set(g.map.filter((n) => n.row === 0).map((n) => n.id));
    for (const n of [...g.map].sort((a, b) => a.row - b.row))
      if (reached.has(n.id)) n.next.forEach((id) => reached.add(id));
    assert.equal(reached.size, g.map.length, 'unreachable node');
    for (const n of g.map)
      for (const id of n.next) assert.equal(byId.get(id).row, n.row + 1);
    // Losing twice still ends it.
    step(g, false);
    step(g, false);
    assert.equal(g.phase, 'over');
    const visible = observeFolio(g);
    assert.ok(!('secret' in visible) && !('seed' in visible));
  }
});

await test('two lives: the first loss is survivable, the second ends the run, nothing heals', () => {
  assert.equal(START_LIVES, 2);
  for (let seed = 1; seed <= 30; seed++) {
    const g = createFolio(seed, 1, now);
    step(g, false);
    assert.equal(g.lives, 1);
    assert.equal(g.phase, 'map');
    // Wins, including a boss, never restore the lost life.
    for (let r = 1; r < BOSS_EVERY; r++) step(g, true);
    assert.equal(g.lives, 1);
    actFolio(g, { type: 'node', id: choices(g)[0] }, now);
    play(g, false);
    assert.equal(g.phase, 'over');
    assert.equal(g.lives, 0);
    assert.equal(g.victory, false);
  }
});

await test('edits: offered only after a boss, balanced, optional and sound', () => {
  let strikes = 0,
    swaps = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const g = createFolio(seed, 1, now);
    for (let r = 0; r < BOSS_EVERY - 1; r++) {
      actFolio(g, { type: 'node', id: choices(g)[0] }, now);
      play(g, true);
      assert.deepEqual(g.edits, [], 'no edits after a normal stop');
      actFolio(g, { type: 'continue' }, now);
    }
    actFolio(g, { type: 'node', id: choices(g)[0] }, now);
    play(g, true);
    assert.equal(g.phase, 'result');
    assert.ok(g.edits.length >= 2 && g.edits.length <= 3);
    const bossRow = BOSS_EVERY - 1;
    for (const e of g.edits) {
      assert.ok(e.changes.length > 0);
      for (const c of e.changes) {
        const n = g.map.find((m) => m.id === c.node);
        assert.ok(n.row > bossRow, 'edits only touch the trail ahead');
        assert.equal(n.kind, e.kind);
        assert.notEqual(c.to, e.kind);
      }
      if (e.type === 'swap') {
        swaps++;
        assert.equal(e.changes.length, 1);
        const n = g.map.find((m) => m.id === e.changes[0].node);
        assert.equal(n.type, 'puzzle');
        assert.equal(Math.floor(n.row / BOSS_EVERY), 1, 'swaps are next act');
      } else strikes++;
    }
    assert.throws(() => actFolio(g, { type: 'edit', index: 9 }, now));
    const pick = seed % g.edits.length,
      edit = g.edits[pick];
    const h = structuredClone(g);
    actFolio(g, { type: 'edit', index: pick }, now);
    assert.equal(g.phase, 'map');
    assertMapSound(g.map);
    if (edit.type === 'strike') {
      assert.deepEqual(g.struck, [edit.kind]);
      assert.ok(
        g.map.every((n) => n.row <= bossRow || n.kind !== edit.kind),
        'a struck game is gone from the trail ahead',
      );
    }
    const before = structuredClone(h.map);
    actFolio(h, { type: 'continue' }, now);
    assert.deepEqual(h.map, before, 'leaving the trail as it is');
    // Keep striking through the run; the map stays sound as it grows.
    for (let r = 0; r < 5 * BOSS_EVERY; r++) step(g, true);
    assert.equal(g.phase, 'map');
    assertMapSound(g.map);
  }
  assert.ok(strikes > 0 && swaps > 0);
});

await test('actions are validated: closed paths, puzzles out of phase, malformed moves', () => {
  const g = createFolio(9, 1, now);
  const closed = g.map.find((n) => n.row === 2).id;
  assert.throws(
    () => actFolio(g, { type: 'node', id: closed }, now),
    /not open/,
  );
  assert.throws(() => actFolio(g, { type: 'give-up' }, now), /Open a puzzle/);
  actFolio(g, { type: 'node', id: choices(g)[0] }, now);
  assert.throws(() => actFolio(g, { type: 'move', move: null }, now));
  assert.throws(() => actFolio(g, { type: 'move', move: [1] }, now));
  assert.throws(() => actFolio(g, { type: 'edit', index: 0 }, now));
  assert.throws(() => actFolio(g, { type: 'continue' }, now));
  const lobby = createFolio(10, 3, now);
  assert.equal(lobby.phase, 'lobby');
  assert.throws(() =>
    actFolio(lobby, { type: 'node', id: choices(lobby)[0] }, now),
  );
  startFolio(lobby, 2, now);
  assert.equal(lobby.seats, 2);
  assert.equal(lobby.phase, 'map');
  assert.throws(() => startFolio(lobby, 2, now), /already started/);
});

await test('practice runs are one puzzle of the chosen game, including boss variants', () => {
  for (const kind of KINDS)
    for (const boss of [false, true]) {
      const g = createFolio(11, 1, now, { kind, boss });
      assert.equal(g.phase, 'puzzle');
      assert.equal(g.puzzle.kind, kind);
      assert.equal(g.puzzle.boss, boss);
      play(g, true);
      assert.equal(g.phase, 'over');
      assert.equal(g.victory, true);
    }
});

await test('tables lock who plays: seats, names per table, lobby start, capacity and membership', () => {
  const db = openDatabase(':memory:'),
    runs = new FolioRuns(db);
  try {
    const a = actor('A', 'Account name'),
      b = actor('B'),
      c = actor('C'),
      d = actor('D');
    const solo = runs.create(a, { name: 'Will' }, now);
    assert.equal(solo.game.phase, 'map');
    assert.equal(solo.members[0].name, 'Will');
    const second = runs.create(a, { seats: 1 }, now);
    assert.notEqual(second.token, solo.token, 'several runs at once');
    assert.equal(second.members[0].name, 'Account name');
    const table = runs.create(a, { seats: 3, name: 'Host' }, now);
    assert.equal(table.game.phase, 'lobby');
    const preview = runs.get(table.token, null, now);
    assert.equal(preview.joined, false);
    assert.equal(preview.members[0].name, 'Host');
    assert.ok(!JSON.stringify(preview).includes('"secret"'));
    assert.throws(
      () =>
        runs.command(
          table.token,
          b,
          { requestId: randomUUID(), revision: 0, action: { type: 'start' } },
          now,
        ),
      /Join/,
    );
    assert.equal(
      runs.join(table.token, b, { name: 'Sam' }, now).game.phase,
      'lobby',
    );
    const full = runs.join(table.token, c, { name: 'Lee' }, now);
    assert.equal(full.game.phase, 'map', 'last seat starts the run');
    assert.deepEqual(
      full.members.map((m) => m.name),
      ['Host', 'Sam', 'Lee'],
    );
    assert.throws(
      () => runs.join(table.token, d, { name: 'Late' }, now),
      /locked/,
    );
    assert.equal(runs.join(table.token, b, {}, now).members.length, 3);
    // Lobby can be started early; that locks the seat count.
    const early = runs.create(b, { seats: 3, name: 'Sam' }, now);
    runs.join(early.token, c, { name: 'Lee' }, now);
    const started = runs.command(
      early.token,
      b,
      { requestId: randomUUID(), revision: 0, action: { type: 'start' } },
      now,
    );
    assert.equal(started.game.seats, 2);
    assert.equal(started.game.phase, 'map');
    assert.throws(
      () => runs.join(early.token, d, { name: 'D' }, now),
      /locked/,
    );
    assert.throws(() => runs.create(a, { seats: 4 }, now), /seats/);
    assert.equal(runs.list(a).length, 3);
  } finally {
    db.close();
  }
});

await test('commands: stale revisions, idempotent retries and hidden secrets', () => {
  const db = openDatabase(':memory:'),
    runs = new FolioRuns(db);
  try {
    const a = actor('A'),
      b = actor('B');
    const v = runs.create(a, { seats: 2 }, now);
    runs.join(v.token, b, { name: 'B' }, now);
    const g = runs.get(v.token, a, now).game;
    const command = {
      requestId: randomUUID(),
      revision: g.revision,
      action: {
        type: 'node',
        id: g.map.find((n) => n.row === 0 && n.type === 'puzzle').id,
      },
    };
    const opened = runs.command(v.token, a, command, now);
    assert.equal(opened.game.phase, 'puzzle');
    assert.equal(
      runs.command(v.token, a, command, now).game.revision,
      opened.game.revision,
    );
    assert.throws(
      () =>
        runs.command(v.token, b, { ...command, requestId: randomUUID() }, now),
      /teammate/,
    );
    assert.throws(
      () =>
        runs.command(
          v.token,
          a,
          { ...command, action: { type: 'give-up' } },
          now,
        ),
      /already used/,
    );
    assert.ok(!JSON.stringify(opened).includes('"secret"'));
    assert.ok(!JSON.stringify(opened).includes('"seed"'));
    const lost = runs.command(
      v.token,
      b,
      {
        requestId: randomUUID(),
        revision: opened.game.revision,
        action: { type: 'give-up' },
      },
      now,
    );
    assert.equal(lost.game.lives, 1);
    assert.equal(lost.game.phase, 'result');
  } finally {
    db.close();
  }
});

await test('dev auto-win solves the open puzzle only in development', () => {
  const db = openDatabase(':memory:'),
    runs = new FolioRuns(db),
    env = process.env.NODE_ENV;
  try {
    const a = actor('A');
    const v = runs.create(a, { seats: 1 }, now);
    const g = runs.get(v.token, a, now).game;
    const opened = runs.command(
      v.token,
      a,
      {
        requestId: randomUUID(),
        revision: g.revision,
        action: {
          type: 'node',
          id: g.map.find((n) => n.row === 0 && n.type === 'puzzle').id,
        },
      },
      now,
    );
    const win = () =>
      runs.command(
        v.token,
        a,
        {
          requestId: randomUUID(),
          revision: opened.game.revision,
          action: { type: 'dev-win' },
        },
        now,
      );
    process.env.NODE_ENV = 'production';
    assert.throws(win, /only available in development/);
    process.env.NODE_ENV = 'development';
    const won = win();
    assert.equal(won.game.result.won, true);
    assert.equal(won.game.lives, opened.game.lives);
    assert.equal(won.game.path.at(-1).won, true);
  } finally {
    process.env.NODE_ENV = env;
    db.close();
  }
});

await test('saves survive a reopen; runs from the first test edition are retired, not crashed on', () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-'));
  let db;
  try {
    const path = join(dir, 'test.sqlite');
    db = openDatabase(path);
    let runs = new FolioRuns(db);
    const a = actor('A');
    const v = runs.create(a, { name: 'A' }, now);
    db.prepare('INSERT INTO folio_runs VALUES (?,?)').run(
      'old',
      '{"version":1}',
    );
    db.prepare('INSERT INTO folio_members VALUES (?,?,?,?,?)').run(
      'old',
      'A',
      'A',
      now,
      now,
    );
    db.close();
    db = openDatabase(path);
    runs = new FolioRuns(db);
    assert.deepEqual(runs.get(v.token, a, now).game, v.game);
    assert.deepEqual(
      runs.list(a).map((s) => s.token),
      [v.token],
    );
    assert.throws(() => runs.get('old', a, now), /earlier test edition/);
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

await test('Folio HTTP flow: guest names, invite preview, seats, CSRF and retries', async () => {
  const { makeServer } = await import('../server/index.ts');
  const origin = 'http://localhost:3017';
  const app = await makeServer({ database: ':memory:', origin, bots: false });
  try {
    await new Promise((resolve, reject) => {
      app.server.once('error', reject);
      app.server.listen(0, '127.0.0.1', resolve);
    });
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const client = () => {
      let cookie = '';
      return async (path, body, requestOrigin = origin) => {
        const res = await fetch(base + path, {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            Cookie: cookie,
            Origin: requestOrigin,
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (res.headers.get('set-cookie'))
          cookie = res.headers.get('set-cookie').split(';')[0];
        return { status: res.status, value: await res.json() };
      };
    };
    const a = client(),
      b = client(),
      c = client();
    assert.equal(
      (
        await a(
          '/api/folio',
          { name: 'Jo', seats: 2 },
          'https://untrusted.test',
        )
      ).status,
      403,
    );
    const created = await a('/api/folio', { name: 'Jo', seats: 2 });
    assert.equal(created.status, 200);
    assert.equal(created.value.game.phase, 'lobby');
    const path = `/api/folio/${created.value.token}`;
    const preview = await b(path);
    assert.equal(preview.status, 200);
    assert.equal(preview.value.joined, false);
    assert.equal(preview.value.members[0].name, 'Jo');
    assert.equal(
      (await b(`${path}/join`, {})).status,
      400,
      'a guest needs a name',
    );
    const joined = await b(`${path}/join`, { name: 'Sam' });
    assert.equal(joined.status, 200);
    assert.equal(joined.value.game.phase, 'map');
    assert.equal((await c(`${path}/join`, { name: 'Late' })).status, 409);
    const first = joined.value.game.map.find(
      (n) => n.row === 0 && n.type === 'puzzle',
    );
    const action = {
      revision: joined.value.game.revision,
      requestId: randomUUID(),
      action: { type: 'node', id: first.id },
    };
    const opened = await a(`${path}/commands`, action);
    assert.equal(opened.status, 200);
    assert.equal(opened.value.game.phase, 'puzzle');
    assert.ok(
      !('secret' in opened.value.game) && !('seed' in opened.value.game),
    );
    assert.equal(
      (await a(`${path}/commands`, action)).value.game.revision,
      opened.value.game.revision,
    );
    assert.equal(
      (await b(`${path}/commands`, { ...action, requestId: randomUUID() }))
        .status,
      409,
    );
    const second = await a('/api/folio', { name: 'Jo' });
    assert.notEqual(second.value.token, created.value.token);
    assert.equal((await a('/api/folio')).value.length, 2);
  } finally {
    await app.close();
  }
});

await test('version four migration preserves existing expedition and account records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-migration-'));
  let db;
  try {
    const path = join(dir, 'test.sqlite');
    db = openDatabase(path);
    db.prepare('INSERT INTO expeditions VALUES (?,?)').run(
      'existing-expedition',
      '{"name":"Keep me"}',
    );
    db.prepare('INSERT INTO guests VALUES (?,?)').run(
      'existing-guest',
      'Keep this guest',
    );
    db.exec(
      'DROP TABLE content_flags; DROP TABLE folio_commands; DROP TABLE folio_members; DROP TABLE folio_runs; PRAGMA user_version=4',
    );
    db.close();
    db = undefined;
    db = openDatabase(path);
    assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 5);
    assert.equal(
      db.prepare('SELECT state FROM expeditions').get().state,
      '{"name":"Keep me"}',
    );
    assert.equal(
      db.prepare('SELECT name FROM guests').get().name,
      'Keep this guest',
    );
    assert.equal(
      new FolioRuns(db).create(actor('existing-guest'), {}, now).game.phase,
      'map',
    );
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

await test('deleting a run takes it off your list; the run goes once nobody is left', () => {
  const db = openDatabase(':memory:'),
    runs = new FolioRuns(db);
  try {
    const a = actor('A'),
      b = actor('B');
    const solo = runs.create(a, { name: 'Ann' }, now);
    assert.deepEqual(runs.remove(solo.token, a), { deleted: true });
    assert.ok(!runs.list(a).some((r) => r.token === solo.token));
    assert.throws(() => runs.get(solo.token, a, now), /could not be found/);
    const table = runs.create(a, { seats: 2, name: 'Ann' }, now);
    runs.join(table.token, b, { name: 'Bo' }, now);
    assert.throws(
      () => runs.remove(table.token, actor('C')),
      /not in your list/,
    );
    runs.remove(table.token, a);
    assert.equal(runs.list(a).length, 0);
    assert.deepEqual(
      runs.get(table.token, b, now).members.map((m) => m.name),
      ['Bo'],
      'the others keep playing',
    );
    runs.remove(table.token, b);
    assert.throws(() => runs.get(table.token, b, now), /could not be found/);
  } finally {
    db.close();
  }
});
