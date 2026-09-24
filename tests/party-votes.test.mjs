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

await test('every party game ends each round in a timed vote the server closes', () => {
  for (const id of ['orin', 'miro', 'dial', 'size']) {
    // Each set plays one of its games; "keep playing" is the same game.
    const keep = id;
    let g = standaloneGames[id].create(4, 9, 'medium', 'individual', undefined, undefined);
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
      { dial, orin: ranking, miro: geography, size: sizes }[g.kind].tick(g, 6000),
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
  let g = skipOpening(standaloneGames.orin.create(3, 12, 'medium'), 'orin', 100);
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
  let o = standaloneGames.orin.create(2, 5, 'medium', 'individual', undefined, undefined, 0);
  o = tick({ ...o, vote: { ...o.vote, endsAt: 0 } });
  assert.ok(['orin', 'dial'].includes(o.kind));
  assert.notEqual(o.phase, 'vote');
});

await test('practice votes wait for everyone instead of a clock', () => {
  let g = dial.createGame(3, 4, 'medium');
  g.tutorial = true;
  g = playRound(g, 100);
  assert.equal(g.vote.endsAt, null);
  assert.equal(deadline(g), null);
});

await test('Dial scores bands, rewards the clue-giver with the average and keeps the point private', () => {
  assert.deepEqual(
    [50, 52, 53, 56, 57, 60, 61, 100].map((v) => dial.points(v, 50)),
    [4, 4, 3, 3, 2, 2, 0, 0],
  );
  let g = dial.createGame(3, 21);
  assert.equal(g.phase, 'clue');
  assert.equal(g.offers.length, 2);
  for (const viewer of [1, 2]) {
    const v = dial.observe(g, viewer);
    assert.equal(v.point, -1);
    assert.deepEqual(v.offers, []);
    assert.deepEqual(v.deck, []);
  }
  assert.equal(dial.observe(g, 0).point, g.point);
  assert.equal(g.card, g.offers[0], 'the first spectrum shows at once');
  assert.equal(dial.observe(g, 1).card, null);
  assert.equal(
    dial.validMove(g, { type: 'card', target: g.offers[0] }, 1),
    false,
  );
  g = dial.play(g, { type: 'card', target: g.offers[1] }, 0);
  assert.equal(dial.validMove(g, { type: 'clue', text: '   ' }, 0), false);
  assert.equal(
    dial.validMove(g, { type: 'clue', text: 'x'.repeat(61) }, 0),
    false,
  );
  g = dial.play(g, { type: 'clue', text: '  A   warm bath ' }, 0);
  assert.equal(g.clue, 'A warm bath');
  assert.equal(g.phase, 'guess');
  assert.equal(
    dial.validMove(g, { type: 'dial', value: 10 }, 0),
    false,
    'the clue-giver never guesses',
  );
  const point = g.point;
  g = dial.play(g, { type: 'dial', value: point }, 1);
  assert.equal(dial.observe(g, 2).guesses[1].value, -1);
  assert.equal(dial.observe(g, 2).point, -1);
  g = dial.play(g, { type: 'lock' }, 1);
  g = dial.play(
    g,
    { type: 'lock', value: point > 50 ? point - 8 : point + 8 },
    2,
  );
  assert.equal(g.phase, 'reveal');
  assert.deepEqual(g.result.gains, [3, 4, 2]);
  assert.deepEqual(g.scores, [3, 4, 2]);
  assert.equal(dial.observe(g, 2).point, point);
  g = dial.play(g, { type: 'next' }, 0);
  assert.equal(g.target, 1);
  assert.equal(g.phase, 'clue');
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
