import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';
import * as ranking from '../lib/games/party/ranking.ts';
import * as coins from '../lib/games/party/coins.ts';
import * as year from '../lib/games/party/year.ts';
import * as order from '../lib/games/party/order.ts';
import { coinPrompts } from '../lib/games/party/coin-prompts.ts';
import { yearEvents } from '../lib/games/party/year-events.ts';
import { orderSets } from '../lib/games/party/order-sets.ts';
import {
  standaloneGames,
  botMove,
  decisionKey,
  deadline,
} from '../lib/games/standalone/registry.ts';
import { seatTotals } from '../lib/games/party/tribu.ts';

const saved = (g) =>
  standaloneGames[g.kind].isSavedGame(JSON.parse(JSON.stringify(g)));
/** Drives a round with bots; the host (seat 0) presses Next. Every state
 * along the way must save. */
function playRound(g, now = 1000) {
  const e = standaloneGames[g.kind];
  for (let i = 0; i < 600 && g.phase !== 'vote' && !g.over; i++) {
    if (g.phase === 'reveal') g = e.play(g, { type: 'next' }, 0, now);
    else {
      const s = e.actingSeats(g)[0];
      const m = botMove(g, s);
      assert.ok(m, `${g.kind} ${g.phase}: a bot move for seat ${s}`);
      g = e.play(g, m, s, now);
    }
    assert.ok(saved(g), `${g.kind} saves in ${g.phase}`);
  }
  return g;
}

await test('by default the host picks: no clock, nobody else waited on, the first pick settles it', () => {
  let g = standaloneGames.orin.create(3, 7, 'medium');
  assert.equal(g.vote.opening, true);
  assert.equal(g.vote.host, true);
  assert.equal(g.vote.endsAt, null);
  assert.equal(deadline(g), null);
  assert.deepEqual(standaloneGames.orin.actingSeats(g), []);
  assert.deepEqual(g.vote.options, ['orin', 'dial', 'coins']);
  assert.ok(saved(g));
  g = standaloneGames.orin.play(g, { type: 'vote', choice: 'coins' }, 0);
  assert.equal(g.kind, 'coins', 'the host’s pick starts at once');
  assert.equal(g.phase, 'answer');
  g = playRound(g);
  assert.equal(g.phase, 'vote');
  assert.equal(g.vote.host, true);
  assert.deepEqual(g.vote.options, ['orin', 'dial', 'coins', 'finish']);
  const before = seatTotals(g);
  g = standaloneGames.orin.play(g, { type: 'vote', choice: 'dial' }, 0);
  assert.equal(g.kind, 'dial');
  assert.equal(g.round, 2);
  assert.deepEqual(seatTotals(g), before, 'points carry across');
  g = playRound(g);
  g = standaloneGames.orin.play(g, { type: 'vote', choice: 'finish' }, 0);
  assert.equal(g.over, true);
  // Quiz offers its four games the same way.
  const q = standaloneGames.miro.create(2, 3, 'medium');
  assert.deepEqual(q.vote.options, ['miro', 'size', 'year', 'order']);
  assert.equal(q.vote.host, true);
});

await test('Top Five: everyone guesses every other list at once, then the lists are revealed in turn', () => {
  let g = ranking.createGame('orin', 3, 41);
  for (let s = 0; s < 3; s++) {
    g = ranking.play(g, { type: 'topic', target: g.offers[s][0] }, s);
    g = ranking.play(g, { type: 'lock' }, s);
  }
  assert.equal(g.phase, 'guess');
  assert.deepEqual(ranking.actingSeats(g), [0, 1, 2]);
  const v1 = ranking.observe(g, 1);
  assert.equal(
    v1.ballots[0].topic,
    g.ballots[0].topic,
    'every prompt is public',
  );
  assert.deepEqual(v1.ballots[0].order, [], 'lists stay private');
  assert.equal(
    ranking.validMove(
      g,
      { type: 'arrange', author: 1, order: [0, 1, 2, 3, 4] },
      1,
    ),
    false,
    'nobody guesses their own list',
  );
  const perfect = g.ballots[0].order;
  g = ranking.play(g, { type: 'arrange', author: 0, order: perfect }, 1);
  assert.equal(
    ranking.observe(g, 2).guesses[1].orders[0],
    null,
    'guesses stay private',
  );
  for (const s of [0, 1, 2]) g = ranking.play(g, { type: 'lock' }, s);
  assert.equal(g.phase, 'reveal');
  assert.equal(g.target, 0);
  assert.equal(g.result.gains[1], ranking.perfectPoints);
  assert.equal(
    g.result.gains[0],
    0,
    'the author scores nothing on their own list',
  );
  assert.deepEqual(ranking.observe(g, 2).ballots[0].order, perfect);
  assert.deepEqual(
    ranking.observe(g, 2).ballots[1].order,
    [],
    'later lists wait',
  );
  const after = [...g.scores];
  g = ranking.play(g, { type: 'next' }, 0);
  assert.equal(g.target, 1);
  assert.equal(g.phase, 'reveal');
  assert.ok(
    g.scores.every((v, s) => v >= after[s]),
    'points land as each list is revealed',
  );
  g = ranking.play(g, { type: 'next' }, 0);
  g = ranking.play(g, { type: 'next' }, 0);
  assert.equal(g.phase, 'vote');
  assert.ok(saved(g));
});

await test('Ten Coins: split ten coins your way, then read everyone’s split', () => {
  for (const p of coinPrompts) {
    assert.equal(p.options.length, coins.optionsPerPrompt, p.text);
    assert.equal(new Set(p.options).size, 4, p.text);
    assert.ok(
      p.options.every((o) => o.length <= 16),
      p.text,
    );
  }
  assert.deepEqual(
    [
      [
        [4, 3, 2, 1],
        [4, 3, 2, 1],
      ],
      [
        [3, 3, 2, 2],
        [4, 3, 2, 1],
      ],
      [
        [3, 3, 2, 2],
        [7, 1, 1, 1],
      ],
      [
        [0, 0, 0, 10],
        [10, 0, 0, 0],
      ],
    ].map(([a, b]) => coins.readPoints(a, b)),
    [10, 8, 2, 0],
    'ten for a perfect read, two less a coin out of place',
  );
  let g = coins.createGame(3, 9);
  assert.equal(g.phase, 'answer');
  assert.equal(coins.validMove(g, { type: 'lock' }, 0), false, 'all ten first');
  assert.equal(
    coins.validMove(g, { type: 'coins', option: 0, value: 11 }, 0),
    false,
  );
  g = coins.play(g, { type: 'coins', option: 0, value: 6 }, 0);
  assert.equal(
    coins.validMove(g, { type: 'coins', option: 1, value: 5 }, 0),
    false,
    'never more than ten',
  );
  // Switching prompts empties the split.
  g = coins.play(g, { type: 'prompt', target: g.cards[0].offers[1] }, 0);
  assert.deepEqual(g.cards[0].coins, [0, 0, 0, 0]);
  const splits = [
    [7, 1, 1, 1],
    [3, 3, 2, 2],
    [0, 5, 5, 0],
  ];
  for (let s = 0; s < 3; s++) {
    splits[s].forEach((value, option) => {
      g = coins.play(g, { type: 'coins', option, value }, s);
    });
    g = coins.play(g, { type: 'lock' }, s);
  }
  assert.equal(g.phase, 'guess');
  const v1 = coins.observe(g, 1);
  assert.deepEqual(v1.cards[0].coins, [-1, -1, -1, -1], 'splits stay hidden');
  assert.equal(v1.cards[0].prompt, g.cards[0].prompt, 'prompts show');
  assert.deepEqual(v1.cards[0].offers, []);
  // Seat 1 reads seat 0 perfectly; everyone else guesses an even split.
  for (let s = 0; s < 3; s++)
    for (let a = 0; a < 3; a++) {
      if (a === s) continue;
      const guess = s === 1 && a === 0 ? splits[0] : [3, 3, 2, 2];
      guess.forEach((value, option) => {
        g = coins.play(g, { type: 'coins', option, value, author: a }, s);
      });
    }
  assert.equal(
    coins.validMove(g, { type: 'coins', option: 0, value: 1, author: 0 }, 0),
    false,
    'nobody guesses themselves',
  );
  for (const s of [0, 1, 2]) g = coins.play(g, { type: 'lock' }, s);
  assert.equal(g.phase, 'reveal');
  assert.deepEqual(g.result.coins, splits[0]);
  assert.deepEqual(g.result.gains, [0, 10, 2]);
  assert.deepEqual(coins.observe(g, 2).cards[1].coins, [-1, -1, -1, -1]);
  g = coins.play(g, { type: 'next' }, 0);
  assert.deepEqual(g.result.gains, [10, 0, 10]);
  g = coins.play(g, { type: 'next' }, 0);
  assert.deepEqual(
    g.result.gains,
    [0, 0, 0],
    'five coins out of place scores nothing',
  );
  assert.deepEqual(g.scores, [10, 10, 12]);
  assert.ok(saved(g));
});

await test('Years and Order score out of 100 per prompt and reveal one at a time', () => {
  assert.deepEqual(
    [0, 2, 5, 10, 120, 500].map((d) => year.points(1900 + d, 1900)),
    [100, 80, 66, 51, 0, 0],
  );
  assert.equal(year.points(1896, 1900), 70);
  // Older events give more room: 25 years off before 1800 scores like 5
  // years off since 1950.
  assert.equal(year.points(1240, 1215), year.points(1974, 1969));
  assert.equal(year.points(1215 + 150, 1215), 0);
  assert.equal(year.points(1969 + 30, 1969), 0);
  // Order: 100, then 50 for one pair the wrong way round, 20 for two.
  assert.equal(order.orderPoints([0, 1, 2, 3, 4]), 100);
  assert.equal(order.orderPoints([1, 0, 2, 3, 4]), 50);
  assert.equal(order.orderPoints([1, 0, 3, 2, 4]), 20);
  assert.equal(order.orderPoints([0, 2, 3, 1, 4]), 20);
  assert.equal(order.orderPoints([4, 3, 2, 1, 0]), 0);
  for (const set of orderSets)
    assert.equal(set.items.length, order.itemsPerSet, set.title);
  let g = year.createGame(2, 11);
  assert.deepEqual(
    g.events.map((id) => yearEvents[id].era).sort(),
    ['modern', 'old', 'recent'],
    'one event per era',
  );
  const truth = g.events.map((id) => yearEvents[id].year);
  g = year.play(g, { type: 'lock', values: truth }, 0);
  assert.deepEqual(year.observe(g, 1).guesses[0].values, [null, null, null]);
  g = year.play(g, { type: 'lock', values: truth.map((y) => y + 10) }, 1);
  assert.equal(g.phase, 'reveal');
  assert.deepEqual(g.gains[0], [100, year.points(truth[0] + 10, truth[0])]);
  assert.ok(g.gains[0][1] > 0 && g.gains[0][1] < 100);
  assert.deepEqual(year.observe(g, 1).guesses[0].values, [
    truth[0],
    null,
    null,
  ]);
  g = year.play(g, { type: 'next' }, 1);
  assert.equal(g.step, 1);
  let o = order.createGame(2, 12);
  assert.ok(
    o.dealt.every((d) => d.join() !== '0,1,2,3,4'),
    'never dealt sorted',
  );
  o = order.play(o, { type: 'lock', step: 0, order: [0, 1, 2, 3, 4] }, 0);
  o = order.play(o, { type: 'lock' }, 1);
  assert.equal(o.gains[0][0], 100);
  assert.equal(
    o.gains[0][1],
    order.orderPoints(o.dealt[0]),
    'untouched counts as dealt',
  );
  assert.ok(saved(o));
});

await test('every Know Me and Quiz game plays whole rounds and saves at every step', () => {
  for (const kind of ['orin', 'dial', 'coins', 'miro', 'size', 'year', 'order'])
    for (const n of [2, 6]) {
      let g = standaloneGames[kind].create(n, 17 + n, 'medium');
      g = standaloneGames[kind].play(g, { type: 'vote', choice: kind }, 0);
      assert.equal(g.kind, kind);
      g = playRound(g);
      assert.equal(g.phase, 'vote', kind);
      g = standaloneGames[kind].play(g, { type: 'vote', choice: kind }, 0);
      assert.equal(g.round, 2);
      g = playRound(g);
      assert.equal(g.phase, 'vote');
    }
});

await test('online: unless the table votes, only the host picks between rounds and the next game', () => {
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
    assert.equal(t.partyVotes, false, 'Votes are off by default');
    t = tables.join(t.token, guest);
    t = cmd(t, host, { type: 'start' });
    assert.equal(t.adventure.vote.host, true);
    assert.throws(
      () =>
        cmd(t, guest, {
          type: 'adventure-move',
          move: { type: 'vote', choice: 'dial' },
          key: decisionKey(t.adventure),
        }),
      /host picks/,
    );
    t = cmd(t, host, {
      type: 'adventure-move',
      move: { type: 'vote', choice: 'coins' },
      key: decisionKey(t.adventure),
    });
    assert.equal(t.adventure.kind, 'coins');
    const actors = [host, guest];
    for (let i = 0; i < 200 && t.status === 'playing'; i++) {
      const g = t.adventure,
        key = decisionKey(g);
      if (g.phase === 'reveal')
        t = cmd(t, host, {
          type: 'adventure-move',
          move: { type: 'next' },
          key,
        });
      else if (g.phase === 'vote')
        t = cmd(t, host, {
          type: 'adventure-move',
          move: { type: 'vote', choice: 'finish' },
          key,
        });
      else {
        const s = standaloneGames.coins.actingSeats(g)[0];
        t = cmd(t, actors[s], {
          type: 'adventure-move',
          move: botMove(g, s),
          key,
        });
      }
    }
    assert.equal(t.status, 'finished');
    assert.equal(t.nextVote.host, true);
    assert.equal(t.nextVote.endsAt, null);
    assert.throws(
      () => cmd(t, guest, { type: 'next-game', gameId: 'miro' }),
      /host picks/,
    );
    t = cmd(t, host, { type: 'next-game', gameId: 'miro' });
    assert.equal(t.status, 'playing', 'the host’s pick starts at once');
    assert.equal(t.adventure.kind, 'miro');
    assert.equal(t.adventure.vote.host, true);
  } finally {
    db.close();
  }
});
