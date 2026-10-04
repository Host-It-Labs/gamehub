import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.ts';
import { Tables, nextGameWinner } from '../server/tables.ts';
import { flagContent, flaggedTitle } from '../server/content-flags.ts';
import { makeServer } from '../server/index.ts';
import * as dial from '../lib/games/party/dial.ts';
import * as ranking from '../lib/games/party/ranking.ts';
import * as geography from '../lib/games/party/geography.ts';
import * as sizes from '../lib/games/party/size.ts';
import * as coins from '../lib/games/party/coins.ts';
import * as year from '../lib/games/party/year.ts';
import * as order from '../lib/games/party/order.ts';
import {
  openVote,
  voteResult,
  voteClosed,
  roundVoteMs,
} from '../lib/games/party/vote.ts';
import {
  standaloneGames,
  botMove,
  decisionKey,
  deadline,
  tick,
} from '../lib/games/standalone/registry.ts';
import { spectrums } from '../lib/games/party/spectrums.ts';
import { topics } from '../lib/games/party/catalog.ts';
import { seatTotals } from '../lib/games/party/tribu.ts';
import { skipOpening } from './tribu-helpers.mjs';

await test('round votes: most votes wins, silence does not count, a tie keeps playing', () => {
  const v = openVote(5, 1000, true);
  assert.equal(v.endsAt, 1000 + roundVoteMs);
  assert.equal(voteClosed(v, 1000), false);
  assert.equal(voteClosed(v, 1000 + roundVoteMs), true);
  assert.equal(voteResult(v), 'more');
  v.choices = ['finish', null, null, null, null];
  assert.equal(voteResult(v), 'finish');
  v.choices = ['finish', 'more', null, null, null];
  assert.equal(voteResult(v), 'more');
  v.choices = ['finish', 'more', 'finish', null, 'more'];
  assert.equal(voteResult(v), 'more');
  v.choices = ['finish', 'finish', 'finish', 'finish', 'finish'];
  assert.equal(voteClosed(v, 1000), true);
  assert.equal(openVote(3, 1000, false).endsAt, null);
  // Tribu: the game being played keeps any tie it is in and an empty vote.
  const t = openVote(4, 0, true, ['orin', 'dial', 'finish']);
  assert.equal(voteResult(t, 'dial'), 'dial');
  t.choices = ['orin', 'finish', null, null];
  assert.equal(voteResult(t, 'dial'), 'orin', 'a tie without the current game plays on');
  t.choices = ['orin', 'dial', null, null];
  assert.equal(voteResult(t, 'dial'), 'dial');
  t.choices = ['finish', 'finish', 'orin', null];
  assert.equal(voteResult(t, 'dial'), 'finish');
  // The opening vote has no current game: an empty or tied vote is drawn.
  const o = openVote(2, 0, true, ['orin', 'dial'], true);
  assert.equal(voteResult(o, null, () => 1), 'dial');
  o.choices = ['orin', null];
  assert.equal(voteResult(o, null, () => 1), 'orin');
});

function playRound(g, now) {
  const e = standaloneGames[g.kind];
  for (let i = 0; i < 400 && g.phase !== 'vote' && !g.over; i++) {
    if (g.phase === 'reveal') g = e.play(g, { type: 'next' }, 0, now);
    else {
      const s = e.actingSeats(g)[0];
      g = e.play(g, botMove(g, s), s, now);
    }
  }
  return g;
}

const engines = { dial, orin: ranking, miro: geography, size: sizes, coins, year, order };
const allGames = ['orin', 'dial', 'coins', 'miro', 'size', 'year', 'order'];

await test('with Votes on, every party game ends each round in a timed vote the server closes', () => {
  for (const id of allGames) {
    // Each set plays one of its games; "keep playing" is the same game.
    const keep = id;
    let g = standaloneGames[id].create(4, 9, 'medium', 'individual', undefined, undefined, true);
    assert.equal(g.vote.opening, true);
    g = skipOpening(g, id, 5000);
    assert.equal(g.kind, id);
    g = playRound(g, 5000);
    assert.equal(g.phase, 'vote', id);
    assert.equal(deadline(g), 5000 + roundVoteMs);
    assert.deepEqual(standaloneGames[id].actingSeats(g), [0, 1, 2, 3]);
    assert.ok(
      standaloneGames[id].isSavedGame(JSON.parse(JSON.stringify(g))),
      id,
    );
    // One player votes to finish; the rest stay silent until the clock runs out.
    g = standaloneGames[id].play(
      g,
      { type: 'vote', choice: 'finish' },
      2,
      6000,
    );
    // A vote can change until the vote closes, but not be cast twice.
    assert.equal(
      standaloneGames[id].validMove(g, { type: 'vote', choice: 'finish' }, 2),
      false,
    );
    assert.equal(
      standaloneGames[id].validMove(g, { type: 'vote', choice: keep }, 2),
      true,
    );
    const changed = standaloneGames[id].play(g, { type: 'vote', choice: keep }, 2, 6000);
    assert.equal(changed.vote.choices[2], keep, id);
    assert.equal(g.over, false);
    const key = decisionKey(g);
    assert.equal(g.phase, 'vote');
    assert.equal(
      engines[g.kind].tick(g, 6000),
      g,
      'the clock has not run out',
    );
    assert.equal(tick({ ...g, vote: { ...g.vote, endsAt: 0 } }).over, true, id);
    assert.equal(decisionKey(g), key);
    // Everyone voting closes the vote at once: 2 more against 2 finish keeps playing.
    let all = g;
    for (const s of [0, 1])
      all = standaloneGames[id].play(
        all,
        { type: 'vote', choice: keep },
        s,
        6000,
      );
    all = standaloneGames[id].play(
      all,
      { type: 'vote', choice: 'finish' },
      3,
      6000,
    );
    assert.equal(all.over, false);
    assert.equal(all.round, 2);
    assert.notEqual(all.phase, 'vote');
    assert.ok(standaloneGames[id].isSavedGame(all));
    assert.equal(all.kind, id, 'the same game again');
  }
});

await test('Tribu switches games on the vote and carries everyone’s points', () => {
  let g = skipOpening(standaloneGames.orin.create(3, 12, 'medium', 'individual', undefined, undefined, true), 'orin', 100);
  g = playRound(g, 100);
  const before = seatTotals(g);
  assert.ok(before.some((v) => v > 0));
  for (const s of [0, 1]) g = standaloneGames.orin.play(g, { type: 'vote', choice: 'dial' }, s, 200);
  g = standaloneGames.orin.play(g, { type: 'vote', choice: 'orin' }, 2, 200);
  assert.equal(g.kind, 'dial');
  assert.equal(g.round, 2);
  assert.equal(g.phase, 'clue');
  assert.deepEqual(g.tribu.carry, before);
  assert.deepEqual(seatTotals(g), before);
  assert.ok(standaloneGames.orin.isSavedGame(JSON.parse(JSON.stringify(g))));
  g = playRound(g, 300);
  for (const s of [0, 1, 2]) g = standaloneGames.orin.play(g, { type: 'vote', choice: 'orin' }, s, 400);
  assert.equal(g.kind, 'orin');
  assert.equal(g.round, 3);
  assert.equal(g.phase, 'rank');
  assert.ok(seatTotals(g).every((v, s) => v >= before[s]));
  for (const s of [0, 1, 2]) g = standaloneGames.orin.play(g, { type: 'vote', choice: 'finish' }, s, 400);
  assert.equal(g.over, false, 'finish is only offered at the end of a round');
  // An opening vote nobody answers is drawn at random.
  let o = standaloneGames.orin.create(2, 5, 'medium', 'individual', undefined, undefined, true);
  o = tick({ ...o, vote: { ...o.vote, endsAt: 0 } });
  assert.ok(['orin', 'dial', 'coins'].includes(o.kind));
  assert.notEqual(o.phase, 'vote');
});

await test('practice votes wait for everyone instead of a clock', () => {
  let g = dial.createGame(3, 4, 'medium');
  g.tutorial = true;
  g = playRound(g, 100);
  assert.equal(g.vote.endsAt, null);
  assert.equal(deadline(g), null);
});

await test('Dial: a Me card places its author, and the dials aim for that', () => {
  let g = dial.createGame(2, 33);
  for (const c of g.cards) {
    assert.ok(!dial.isSelf({ card: c.offers[0] }) && dial.isSelf({ card: c.offers[1] }));
  }
  g = dial.play(g, { type: 'card', target: g.cards[0].offers[1] }, 0);
  g = dial.play(g, { type: 'place', value: 82 }, 0);
  assert.equal(g.cards[0].locked, true);
  assert.equal(dial.observe(g, 1).cards[0].placed, null, 'your place stays hidden');
  g = dial.play(g, { type: 'clue', text: 'Tea' }, 1);
  assert.equal(g.phase, 'guess');
  assert.ok(standaloneGames.dial.isSavedGame(JSON.parse(JSON.stringify(g))));
  g = dial.play(g, { type: 'lock', author: 0, value: 80 }, 1);
  g = dial.play(g, { type: 'lock', author: 1, value: 50 }, 0);
  assert.equal(g.phase, 'reveal');
  assert.equal(g.result.point, 82);
  assert.deepEqual(g.result.gains, [4, 4], 'within 2 of the place scores 4, the author the average');
  assert.equal(dial.observe(g, 1).cards[0].placed, 82);
});

await test('Dial: everyone writes a clue at once, then the table reads them in turn', () => {
  assert.deepEqual(
    [50, 52, 53, 56, 57, 60, 61, 100].map((v) => dial.points(v, 50)),
    [4, 4, 3, 3, 2, 2, 0, 0],
  );
  let g = dial.createGame(3, 21);
  assert.equal(g.phase, 'clue');
  assert.deepEqual(dial.actingSeats(g), [0, 1, 2], 'every player writes at once');
  for (const c of g.cards) {
    assert.equal(c.offers.length, 2);
    assert.equal(c.card, c.offers[0], 'the first spectrum shows at once');
  }
  const v1 = dial.observe(g, 1);
  assert.deepEqual(v1.deck, []);
  assert.equal(v1.cards[1].point, g.cards[1].point, 'you see your own point');
  assert.equal(v1.cards[0].point, -1);
  assert.equal(v1.cards[0].card, -1);
  assert.deepEqual(v1.cards[0].offers, []);
  assert.equal(
    dial.validMove(g, { type: 'card', target: g.cards[0].offers[0] }, 1),
    false,
    'you only choose between your own spectrums',
  );
  g = dial.play(g, { type: 'card', target: g.cards[0].offers[1] }, 0);
  assert.equal(g.cards[0].card, g.cards[0].offers[1]);
  assert.ok(dial.isSelf(g.cards[0]), 'the second offer is a Me card');
  assert.equal(dial.validMove(g, { type: 'clue', text: 'Tea' }, 0), false, 'a Me card takes no clue');
  g = dial.play(g, { type: 'card', target: g.cards[0].offers[0] }, 0);
  assert.equal(dial.validMove(g, { type: 'place', value: 30 }, 0), false, 'only a Me card is placed');
  assert.equal(dial.validMove(g, { type: 'clue', text: '   ' }, 0), false);
  assert.equal(
    dial.validMove(g, { type: 'clue', text: 'x'.repeat(61) }, 0),
    false,
  );
  g = dial.play(g, { type: 'clue', text: '  A   warm bath ' }, 0);
  assert.equal(g.cards[0].clue, 'A warm bath');
  assert.equal(g.cards[0].locked, true);
  assert.equal(g.phase, 'clue');
  assert.equal(dial.observe(g, 1).cards[0].clue, '', 'clues stay hidden while writing');
  assert.equal(dial.observe(g, 1).cards[0].locked, true);
  // A locked clue can reopen until everyone has locked.
  g = dial.play(g, { type: 'unlock' }, 0);
  assert.equal(g.cards[0].locked, false);
  assert.equal(g.cards[0].clue, 'A warm bath');
  g = dial.play(g, { type: 'clue', text: 'A warm bath' }, 0);
  g = dial.play(g, { type: 'clue', text: 'Tea' }, 1);
  g = dial.play(g, { type: 'clue', text: 'Snow' }, 2);
  assert.equal(g.phase, 'guess');
  assert.ok(standaloneGames.dial.isSavedGame(JSON.parse(JSON.stringify(g))));
  assert.deepEqual(dial.actingSeats(g), [0, 1, 2], 'everyone reads every clue at once');
  const seen = dial.observe(g, 1);
  for (const a of [0, 2]) {
    assert.equal(seen.cards[a].clue, g.cards[a].clue, 'every clue is public');
    assert.equal(seen.cards[a].card, g.cards[a].card);
    assert.equal(seen.cards[a].point, -1, 'points stay hidden');
  }
  assert.equal(
    dial.validMove(g, { type: 'dial', author: 1, value: 10 }, 1),
    false,
    'nobody dials their own clue',
  );
  const points = g.cards.map((c) => c.point);
  g = dial.play(g, { type: 'dial', author: 0, value: points[0] }, 1);
  assert.equal(dial.observe(g, 2).guesses[1].values[0], null, 'dials stay private');
  g = dial.play(g, { type: 'lock' }, 1);
  assert.equal(g.guesses[1].values[2], null, 'an untouched dial sits mid-way');
  g = dial.play(g, { type: 'dial', author: 1, value: points[1] }, 0);
  g = dial.play(g, { type: 'lock', author: 2, value: points[2] }, 0);
  assert.equal(g.phase, 'guess');
  g = dial.play(
    g,
    { type: 'dial', author: 0, value: points[0] > 50 ? points[0] - 8 : points[0] + 8 },
    2,
  );
  g = dial.play(g, { type: 'lock', author: 1, value: points[1] }, 2);
  assert.equal(g.phase, 'reveal', 'the reveals start once everyone has locked');
  assert.equal(g.target, 0);
  assert.equal(g.result.point, points[0]);
  assert.deepEqual(g.result.gains, [3, 4, 2]);
  assert.equal(dial.observe(g, 2).cards[0].point, points[0]);
  assert.equal(dial.observe(g, 2).cards[1].point, -1, 'later points wait their reveal');
  g = dial.play(g, { type: 'next' }, 0);
  assert.equal(g.target, 1);
  assert.equal(g.phase, 'reveal', 'the next clue is revealed straight away');
  assert.equal(g.result.gains[0], 4);
  assert.equal(g.result.gains[2], 4);
  assert.deepEqual(dial.actingSeats(g), []);
  assert.ok(standaloneGames.dial.isSavedGame(JSON.parse(JSON.stringify(g))));
});

await test('the what-next vote picks the most popular party game and starts it with the same players', () => {
  assert.equal(nextGameWinner({ endsAt: 0, ballots: {} }), null);
  assert.equal(
    nextGameWinner({ endsAt: 0, ballots: { a: 'orin', b: 'orin', c: 'miro' } }),
    'orin',
  );
  assert.equal(
    nextGameWinner({ endsAt: 0, ballots: { a: 'orin', b: 'miro' } }, () => 1),
    'miro',
  );

  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      'host',
      'host@example.com',
      'host',
      'unused',
    );
    const who = (id, user = false) => ({
      id,
      name: id,
      userId: user ? id : null,
      sessionHash: 't',
      expires: Date.now() + 99999,
    });
    const tables = new Tables(db, () => true),
      host = who('host', true),
      guest = who('guest');
    const cmd = (t, actor, action) =>
      tables.command(t.token, actor, {
        action,
        requestId: randomUUID(),
        revision: t.revision,
        matchId: t.matchId,
      });
    let t = tables.create(host);
    t = cmd(t, host, {
      type: 'configure',
      gameId: 'orin',
      difficulty: 'medium',
      capacity: 2,
      partyVotes: true,
    });
    t = tables.join(t.token, guest);
    t = cmd(t, host, { type: 'start' });
    const actors = [host, guest];
    for (let i = 0; i < 400 && t.status === 'playing'; i++) {
      const g = t.adventure,
        key = decisionKey(g);
      if (g.phase === 'reveal') {
        t = cmd(t, host, {
          type: 'adventure-move',
          move: { type: 'next' },
          key,
        });
        continue;
      }
      if (g.phase === 'vote') {
        const choice = g.vote.opening ? 'orin' : 'finish';
        t = cmd(t, actors[0], {
          type: 'adventure-move',
          move: { type: 'vote', choice },
          key,
        });
        t = cmd(t, actors[1], {
          type: 'adventure-move',
          move: { type: 'vote', choice },
          key: decisionKey(t.adventure),
        });
        continue;
      }
      const s = standaloneGames.orin.actingSeats(g)[0];
      t = cmd(t, actors[s], {
        type: 'adventure-move',
        move: botMove(g, s),
        key,
      });
    }
    assert.equal(t.status, 'finished');
    assert.equal(t.adventure.round, 1, 'the table finished after one round');
    assert.ok(t.nextVote && t.nextVote.endsAt > Date.now());
    assert.deepEqual(tables.view(t, guest).nextVote.ballots, {});
    assert.throws(
      () => cmd(t, host, { type: 'next-game', gameId: 'undertow' }),
      /Unknown game/,
    );
    assert.throws(
      () => cmd(t, host, { type: 'next-game', gameId: 'dial' }),
      /Unknown game/,
      'Dial is played inside Tribu',
    );
    t = cmd(t, host, { type: 'next-game', gameId: 'orin' });
    t = cmd(t, host, { type: 'next-game', gameId: 'miro' });
    assert.equal(t.status, 'finished');
    const oldMatch = t.matchId;
    // A stale revision still counts: votes land while others vote.
    t = tables.command(t.token, guest, {
      action: { type: 'next-game', gameId: 'miro' },
      requestId: randomUUID(),
      revision: t.revision - 1,
      matchId: t.matchId,
    });
    assert.equal(t.status, 'playing');
    assert.equal(t.gameId, 'miro');
    assert.equal(t.adventure.kind, 'miro');
    assert.deepEqual(t.adventure.seats, ['host', 'guest']);
    assert.notEqual(t.matchId, oldMatch);
    assert.equal(t.nextVote, null);

    // Nobody votes: the clock closes the vote and the table stays on the results.
    const stored = tables.get(t.token);
    stored.status = 'finished';
    stored.nextVote = { endsAt: Date.now() - 1, ballots: {} };
    tables.save(stored);
    tables.nextGameTick(t.token);
    const after = tables.get(t.token);
    assert.equal(after.status, 'finished');
    assert.equal(after.nextVote, null);
  } finally {
    db.close();
  }
});

await test('flagged prompts are logged once per player with their title', async () => {
  assert.equal(flaggedTitle('orin', 0), topics[0].title);
  assert.equal(
    flaggedTitle('dial', 1),
    `${spectrums[1].left} – ${spectrums[1].right}`,
  );
  assert.equal(flaggedTitle('orin', 9999), null);
  assert.equal(flaggedTitle('orin', '3'), null);
  assert.equal(flaggedTitle('miro', 0), null);
  const db = openDatabase(':memory:');
  try {
    flagContent(db, { id: 'g1', userId: null }, 'orin', 4, topics[4].title);
    flagContent(db, { id: 'g1', userId: null }, 'orin', 4, topics[4].title);
    flagContent(db, { id: 'g2', userId: null }, 'orin', 4, topics[4].title);
    assert.deepEqual(
      db
        .prepare(
          'SELECT game_id, content_key, title, count(*) n FROM content_flags GROUP BY 1,2,3',
        )
        .all()
        .map((r) => ({ ...r })),
      [{ game_id: 'orin', content_key: '4', title: topics[4].title, n: 2 }],
    );
  } finally {
    db.close();
  }
  const origin = 'http://localhost:3017';
  const app = await makeServer({ database: ':memory:', origin, bots: false });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const post = (body, cookie = '') =>
      fetch(base + '/api/content-flags', {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify(body),
      });
    assert.equal((await post({ gameId: 'orin', key: 1 })).status, 401);
    const signup = await fetch(base + '/api/auth/signup', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Flagger',
        email: 'flag@example.com',
        password: 'test-password-123',
      }),
    });
    const cookie = signup.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (await post({ gameId: 'orin', key: 99999 }, cookie)).status,
      400,
    );
    const ok = await post({ gameId: 'dial', key: 2 }, cookie);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { flagged: true });
  } finally {
    await app.close();
  }
});

await test('development: the host’s pick in the opening vote starts that game at once', () => {
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      'host',
      'host@example.com',
      'host',
      'unused',
    );
    const who = (id, user = false) => ({
      id,
      name: id,
      userId: user ? id : null,
      sessionHash: 't',
      expires: Date.now() + 99999,
    });
    const tables = new Tables(db, () => true),
      host = who('host', true),
      guest = who('guest');
    const cmd = (t, actor, action) =>
      tables.command(t.token, actor, {
        action,
        requestId: randomUUID(),
        revision: t.revision,
        matchId: t.matchId,
      });
    let t = tables.create(host);
    t = cmd(t, host, {
      type: 'configure',
      gameId: 'orin',
      difficulty: 'medium',
      capacity: 2,
      partyVotes: true,
    });
    t = tables.join(t.token, guest);
    t = cmd(t, host, { type: 'start' });
    assert.equal(t.adventure.vote.opening, true);
    // A guest's vote alone still waits for the table.
    t = cmd(t, guest, {
      type: 'adventure-move',
      move: { type: 'vote', choice: 'orin' },
      key: decisionKey(t.adventure),
    });
    assert.equal(t.adventure.phase, 'vote');
    t = cmd(t, host, {
      type: 'adventure-move',
      move: { type: 'vote', choice: 'dial' },
      key: decisionKey(t.adventure),
    });
    assert.equal(t.adventure.kind, 'dial');
    assert.notEqual(t.adventure.phase, 'vote');
  } finally {
    db.close();
    process.env.NODE_ENV = env;
  }
});
