import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';
import {
  botMove,
  decisionKey,
  standaloneGames,
} from '../lib/games/standalone/registry.ts';
import { campReady, remainingTriviaGames } from '../lib/games/party/trivia.ts';
import { sets } from '../lib/games/party/vote.ts';

const actor = (id, user = false) => ({
  id,
  name: id,
  userId: user ? id : null,
  sessionHash: 'test',
  expires: Date.now() + 99_999,
});
const host = actor('host', true);
const guest = actor('guest');
const spectator = actor('spectator');
const settings = {
  type: 'configure',
  gameId: 'miro',
  capacity: 2,
  difficulty: 'medium',
};
function setup(path = ':memory:') {
  const db = openDatabase(path);
  db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?,?)').run(
    host.id,
    'host@test.invalid',
    host.name,
    'unused',
  );
  const online = new Set([host.id, guest.id, spectator.id]);
  const tables = new Tables(db, (_, id) => online.has(id));
  const table = tables.join(tables.create(host).token, guest);
  return { db, tables, table, online };
}
function command(tables, table, action, who = host, revision = table.revision) {
  return tables.command(table.token, who, {
    requestId: randomUUID(),
    revision,
    matchId: table.matchId,
    action,
  });
}
function move(tables, table, value, who = host, revision = table.revision) {
  return command(
    tables,
    table,
    { type: 'adventure-move', move: value, key: decisionKey(table.adventure) },
    who,
    revision,
  );
}
const modeOf = (table) => table.adventure.tribu.trivia.mode;
const stateOf = (table, who, tables) =>
  tables.view(table, who).adventure.tribu.trivia;

await test('Trivia mode is a shared host setting with exact enum validation and atomic errors', () => {
  const { db, tables, table } = setup();
  try {
    assert.equal(table.triviaMode, 'quick');
    for (const who of [host, guest])
      assert.equal(tables.view(table, who).triviaMode, 'quick');
    assert.throws(
      () => command(tables, table, { ...settings, triviaMode: 'tower' }, guest),
      { status: 403 },
    );
    for (const triviaMode of [null, '', 'Tower', 'classic', true, 1, {}, []]) {
      assert.throws(
        () =>
          command(tables, table, { ...settings, openSetup: true, triviaMode }),
        /Invalid Trivia mode/,
      );
      assert.deepEqual(
        tables.get(table.token),
        table,
        'failed setup leaves no partial changes',
      );
    }
    assert.throws(
      () =>
        command(tables, table, {
          ...settings,
          gameId: 'orin',
          triviaMode: 'tower',
        }),
      /belongs to Trivia/,
    );
    let t = command(tables, table, {
      ...settings,
      triviaMode: 'tower',
      openSetup: true,
    });
    for (const who of [host, guest]) {
      const view = tables.view(t, who);
      assert.equal(view.triviaMode, 'tower');
      assert.equal(view.setupOpen, true);
    }
    t = command(tables, t, { ...settings, difficulty: 'hard' });
    assert.equal(
      t.triviaMode,
      'tower',
      'unrelated setup changes keep the format',
    );
    t = command(tables, t, { type: 'start' });
    assert.throws(
      () => command(tables, t, { ...settings, triviaMode: 'expedition' }),
      /Return to the lobby/,
    );
    assert.equal(modeOf(t), 'tower');
  } finally {
    db.close();
  }
});

await test('Trivia setup survives game switches, admin handover, and a database restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-trivia-mode-'));
  const path = join(dir, 'tables.sqlite');
  const app = setup(path);
  let reopened;
  let initialClosed = false;
  try {
    let t = command(app.tables, app.table, {
      ...settings,
      triviaMode: 'expedition',
    });
    t = command(app.tables, t, { ...settings, gameId: 'orin' });
    assert.equal(t.triviaMode, 'expedition');
    t = command(app.tables, t, { type: 'owner', memberId: guest.id });
    assert.equal(t.owner, guest.id);
    t = command(app.tables, t, settings, guest);
    assert.equal(t.triviaMode, 'expedition');
    app.db.close();
    initialClosed = true;
    reopened = openDatabase(path);
    const tables = new Tables(reopened, () => true);
    t = tables.get(t.token);
    assert.equal(t.triviaMode, 'expedition');
    assert.equal(t.owner, guest.id);
    for (const who of [host, guest])
      assert.equal(tables.view(t, who).triviaMode, 'expedition');
    t = command(tables, t, { type: 'start' }, guest);
    assert.equal(modeOf(t), 'expedition');
  } finally {
    if (!initialClosed) app.db.close();
    reopened?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const triviaMode of ['quick', 'tower', 'expedition']) {
  await test(`${triviaMode}: practice keeps the setup and begin-match creates the selected real format`, () => {
    const { db, tables, table } = setup();
    try {
      let t = command(tables, table, { ...settings, triviaMode });
      t = command(tables, t, { type: 'start', learning: true });
      assert.equal(t.adventure.tutorial, true);
      assert.equal(t.triviaMode, triviaMode);
      const practiceId = t.matchId;
      t = command(tables, t, { type: 'begin-match' });
      assert.equal(t.adventure.tutorial, false);
      assert.notEqual(t.matchId, practiceId);
      assert.equal(modeOf(t), triviaMode);
      assert.deepEqual(t.adventure.seats, [host.name, guest.name]);
      assert.throws(
        () =>
          command(
            tables,
            { ...t, matchId: practiceId },
            {
              type: 'adventure-move',
              move: { type: 'next' },
              key: decisionKey(t.adventure),
            },
          ),
        { status: 409 },
        'a command from practice cannot apply to the real match',
      );
    } finally {
      db.close();
    }
  });
}

await test('old or invalid stored Trivia preferences migrate to Quick', () => {
  const { db, tables, table } = setup();
  try {
    for (const value of [undefined, null, 'retired-format', 4]) {
      const legacy = { ...table };
      if (value === undefined) delete legacy.triviaMode;
      else legacy.triviaMode = value;
      tables.save(legacy);
      const recovered = new Tables(db, () => true).get(table.token);
      assert.equal(recovered.triviaMode, 'quick');
      assert.equal(recovered.revision, table.revision + 1);
      assert.equal(tables.view(recovered, guest).triviaMode, 'quick');
    }
  } finally {
    db.close();
  }
});

await test('Expedition camp plans stay private, accept simultaneous commands, and wait for the host', () => {
  const { db, tables, table } = setup();
  try {
    let t = command(tables, table, { ...settings, triviaMode: 'expedition' });
    t = command(tables, t, { type: 'start' });
    t = tables.join(t.token, spectator);
    assert.equal(tables.view(t, spectator).viewerSeat, null);
    assert.equal(stateOf(t, host, tables).stage, 'camp');
    assert.throws(
      () => move(tables, t, { type: 'vote', choice: 'year' }),
      { status: 409 },
      'the host waits until every player locks a plan',
    );
    for (const value of [
      { type: 'trivia-plan', route: 'trail', purchase: null },
      { type: 'vote', choice: 'year' },
      { type: 'trivia-unlock' },
    ])
      assert.throws(() => move(tables, t, value, spectator), { status: 403 });
    const initialRevision = t.revision;
    const initialKey = decisionKey(t.adventure);
    const privatePlan = {
      type: 'trivia-plan',
      route: 'summit',
      purchase: null,
    };
    t = move(tables, t, privatePlan, guest);
    assert.deepEqual(stateOf(t, guest, tables).plans[1], {
      route: 'summit',
      purchase: null,
    });
    assert.equal(stateOf(t, host, tables).plans[1], null);
    assert.equal(stateOf(t, spectator, tables).plans[1], null);
    assert.equal(stateOf(t, guest, tables).ready[1], true);
    assert.throws(
      () =>
        move(
          tables,
          t,
          { type: 'trivia-plan', route: 'river', purchase: null },
          guest,
        ),
      { status: 409 },
    );
    t = move(tables, t, { type: 'trivia-unlock' }, guest);
    assert.equal(stateOf(t, guest, tables).ready[1], false);
    t = move(tables, t, privatePlan, guest);
    const snapshot = structuredClone(t.adventure);
    const restored = new Tables(db, () => true).get(t.token);
    assert.equal(restored.status, 'playing');
    assert.deepEqual(restored.adventure, snapshot);
    assert.equal(stateOf(restored, host, tables).plans[1], null);
    t = move(
      tables,
      restored,
      { type: 'trivia-plan', route: 'trail', purchase: null },
      host,
      initialRevision,
    );
    assert.equal(
      decisionKey(t.adventure),
      initialKey,
      'other players locking does not discard simultaneous plans',
    );
    assert.deepEqual(t.adventure.tribu.trivia.ready, [true, true]);
    assert.equal(stateOf(t, host, tables).plans[1], null);
    assert.equal(stateOf(t, guest, tables).plans[0], null);
    assert.deepEqual(stateOf(t, spectator, tables).plans, [null, null]);
    tables.adventureTick(t.token, initialKey);
    assert.deepEqual(
      tables.get(t.token),
      t,
      'all plans locked still waits for the host',
    );
    assert.throws(
      () => move(tables, t, { type: 'vote', choice: 'year' }, guest),
      { status: 403 },
    );
    t = move(tables, t, { type: 'vote', choice: 'year' });
    assert.equal(t.adventure.kind, 'year');
    assert.equal(t.adventure.tribu.trivia.stage, 'challenge');
    assert.throws(
      () =>
        command(
          tables,
          t,
          { type: 'adventure-move', move: privatePlan, key: initialKey },
          guest,
          initialRevision,
        ),
      { status: 409 },
      'the old camp decision cannot apply after the challenge begins',
    );
  } finally {
    db.close();
  }
});

await test('Trivia challenge selection follows the picked leader and permits only seated fallback while away', () => {
  const { db, tables, table, online } = setup();
  try {
    let t = command(tables, table, { ...settings, triviaMode: 'tower' });
    t = command(tables, t, { type: 'host', memberId: guest.id });
    t = command(tables, t, { type: 'start' });
    t = tables.join(t.token, spectator);
    assert.equal(tables.view(t, host).canAdvance, false);
    assert.equal(tables.view(t, guest).canAdvance, true);
    assert.throws(
      () => move(tables, t, { type: 'vote', choice: 'size' }),
      { status: 403 },
      'being the admin does not override the match leader',
    );
    t = move(tables, t, { type: 'vote', choice: 'size' }, guest);
    assert.equal(t.adventure.kind, 'size');
    assert.equal(modeOf(t), 'tower');
    const actors = [host, guest];
    for (let steps = 0; t.adventure.phase !== 'reveal'; steps++) {
      assert.ok(steps < 40, 'the challenge reaches its reveal');
      const g = t.adventure;
      const seat = standaloneGames[g.kind].actingSeats(g)[0];
      assert.ok(Number.isInteger(seat));
      const value = botMove(g, seat);
      assert.ok(value);
      t = move(tables, t, value, actors[seat]);
    }
    assert.throws(() => move(tables, t, { type: 'next' }), { status: 403 });
    t = move(tables, t, { type: 'next' }, guest);
    online.delete(guest.id);
    assert.equal(tables.view(t, host).canAdvance, true);
    assert.equal(tables.view(t, spectator).canAdvance, false);
    assert.throws(() => move(tables, t, { type: 'next' }, spectator), {
      status: 403,
    });
    t = move(tables, t, { type: 'next' });
    assert.equal(modeOf(t), 'tower');
    assert.throws(
      () =>
        move(tables, t, {
          type: 'trivia-plan',
          route: 'trail',
          purchase: null,
        }),
      { status: 409 },
      'the fallback still obeys the current phase',
    );
  } finally {
    db.close();
  }
});

await test('the host next-game choice starts Trivia with its retained format and existing human seats', () => {
  const { db, tables, table } = setup();
  try {
    let t = command(tables, table, { ...settings, triviaMode: 'expedition' });
    t = command(tables, t, { ...settings, gameId: 'orin' });
    t = command(tables, t, { type: 'start' });
    const actors = [host, guest];
    for (let steps = 0; t.status === 'playing'; steps++) {
      assert.ok(steps < 500, 'Know Me reaches the next-game choice');
      const g = t.adventure;
      if (g.phase === 'vote') {
        t = move(tables, t, {
          type: 'vote',
          choice: g.vote.opening ? 'orin' : 'finish',
        });
      } else if (g.phase === 'reveal') {
        t = move(tables, t, { type: 'next' });
      } else {
        const seat = standaloneGames[g.kind].actingSeats(g)[0];
        assert.ok(Number.isInteger(seat));
        const value = botMove(g, seat);
        assert.ok(value, `${g.kind} has a legal private choice`);
        t = move(tables, t, value, actors[seat]);
      }
    }
    const previousMatch = t.matchId;
    assert.equal(t.status, 'finished');
    t = command(tables, t, { type: 'next-game', gameId: 'miro' });
    assert.equal(t.gameId, 'miro');
    assert.equal(t.status, 'playing');
    assert.equal(modeOf(t), 'expedition');
    assert.notEqual(t.matchId, previousMatch);
    assert.deepEqual(
      t.seats.map((s) => s.id),
      [host.id, guest.id],
    );
    assert.ok(t.seats.every((s) => !s.bot));
  } finally {
    db.close();
  }
});

for (const triviaMode of ['tower', 'expedition']) {
  await test(`${triviaMode}: a stored Everyone votes preference cannot replace the host's match-end choice`, () => {
    const { db, tables, table } = setup();
    try {
      let t = command(tables, table, {
        ...settings,
        triviaMode,
        partyVotes: true,
      });
      t = command(tables, t, { type: 'start' });
      assert.equal(t.partyVotes, true);
      assert.equal(t.adventure.tribu.votes, undefined);
      const actors = [host, guest];
      const length = sets.miro.length;
      for (let steps = 0; t.status === 'playing'; steps++) {
        assert.ok(steps < 600, 'the fixed match reaches its final choice');
        const g = t.adventure;
        const trivia = g.tribu.trivia;
        if (trivia.stage === 'camp' && !campReady(g)) {
          const seat = trivia.ready.findIndex((ready) => !ready);
          const before = JSON.stringify(tables.get(t.token));
          for (const purchase of ['trophy', 'supplies'])
            assert.throws(
              () =>
                move(
                  tables,
                  t,
                  { type: 'trivia-plan', route: 'trail', purchase },
                  actors[seat],
                ),
              { status: 409 },
              'the simplified Expedition refuses purchase commands',
            );
          assert.equal(
            JSON.stringify(tables.get(t.token)),
            before,
            'rejected purchases are atomic',
          );
          t = move(
            tables,
            t,
            {
              type: 'trivia-plan',
              route: 'trail',
              purchase: null,
            },
            actors[seat],
          );
        } else if (g.phase === 'vote') {
          if (trivia.completed < length) {
            const before = JSON.stringify(tables.get(t.token));
            assert.throws(
              () => move(tables, t, { type: 'vote', choice: 'finish' }),
              { status: 409 },
              'the host must play all four rounds',
            );
            for (const round of trivia.rounds)
              assert.throws(
                () => move(tables, t, { type: 'vote', choice: round.kind }),
                { status: 409 },
                'a spoofed repeat choice is refused',
              );
            assert.equal(
              JSON.stringify(tables.get(t.token)),
              before,
              'rejected picks do not advance the match',
            );
          } else {
            if (triviaMode === 'expedition') {
              assert.deepEqual(trivia.plans, [null, null]);
              assert.deepEqual(
                trivia.ready,
                [false, false],
                'final Finish needs no extra player locks',
              );
            }
            assert.throws(
              () => move(tables, t, { type: 'vote', choice: 'finish' }, guest),
              { status: 403 },
              'only the host finishes',
            );
            tables.adventureTick(t.token, decisionKey(g));
            assert.deepEqual(
              tables.get(t.token),
              JSON.parse(JSON.stringify(t)),
              'the final choice waits for the host',
            );
          }
          t = move(tables, t, {
            type: 'vote',
            choice:
              trivia.completed === length
                ? 'finish'
                : remainingTriviaGames(g)[0],
          });
        } else if (g.phase === 'reveal') {
          t = move(tables, t, { type: 'next' });
        } else {
          const seat = standaloneGames[g.kind].actingSeats(g)[0];
          assert.ok(Number.isInteger(seat));
          const value = botMove(g, seat);
          assert.ok(value);
          t = move(tables, t, value, actors[seat]);
        }
      }
      assert.equal(t.adventure.tribu.trivia.completed, length);
      assert.equal(
        new Set(t.adventure.tribu.trivia.rounds.map((round) => round.kind))
          .size,
        length,
      );
      assert.equal(
        t.partyVotes,
        true,
        'keep the preference for later Quick games',
      );
      assert.deepEqual(t.nextVote, {
        endsAt: null,
        ballots: {},
        host: true,
      });
      assert.throws(
        () => command(tables, t, { type: 'next-game', gameId: 'miro' }, guest),
        { status: 403 },
      );
      tables.nextGameTick(t.token);
      assert.deepEqual(
        tables.get(t.token),
        JSON.parse(JSON.stringify(t)),
        'no deadline can start another game',
      );
      t = command(tables, t, { type: 'next-game', gameId: 'miro' });
      assert.equal(t.status, 'playing');
      assert.equal(modeOf(t), triviaMode);
      assert.equal(t.adventure.vote.host, true);
    } finally {
      db.close();
    }
  });
}
