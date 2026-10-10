import test from 'node:test';
import assert from 'node:assert/strict';
import {
  standaloneGames,
  actingSeats,
  botMove,
  decisionKey,
  deadline,
  observe,
  play,
  tick,
  validMove,
} from '../lib/games/standalone/registry.ts';
import {
  campReady,
  createTriviaState,
  isTriviaMode,
  triviaCosts,
  triviaExpedition,
  triviaGameRoundLimit,
  triviaModeOf,
  triviaOf,
  triviaReward,
  triviaRoundLimit,
  remainingTriviaGames,
  triviaStandings,
  triviaWinners,
} from '../lib/games/party/trivia.ts';
import { createSabi, seatTotals } from '../lib/games/party/tribu.ts';
import { places } from '../lib/games/party/geography.ts';
import { yearEvents } from '../lib/games/party/year-events.ts';
import { timeline } from '../lib/games/party/year-events.ts';
import { maxRounds, sets, validVote } from '../lib/games/party/vote.ts';

const entry = standaloneGames.miro;
const create = (mode, n = 3, seed = 41, votes = false) =>
  entry.create(n, seed, 'medium', undefined, undefined, undefined, votes, mode);
const saved = (g) => entry.isSavedGame(JSON.parse(JSON.stringify(g)));
/** A save made under rules 2 (4 October 2026): one round of each game, a
 * floor per 100 points and route Expedition. New matches use rules 3; these
 * saves must keep loading and playing to their end. */
const createRules2 = (...args) => {
  const g = create(...args),
    t = g.tribu.trivia;
  t.rules = 2;
  delete t.length;
  for (const p of t.players) delete p.finds;
  if (t.mode === 'expedition') t.stage = 'camp';
  assert.ok(saved(g));
  return g;
};
const createLegacy = (...args) => {
  const g = createRules2(...args);
  delete g.tribu.trivia.rules;
  assert.ok(saved(g));
  return g;
};
const apply = (g, move, seat = 0) => {
  assert.ok(
    validMove(g, move, seat),
    `${g.kind}/${g.phase}: ${JSON.stringify(move)}`,
  );
  const next = play(g, move, seat, 1000);
  assert.notEqual(next, g);
  assert.ok(
    saved(next),
    `${next.kind}/${next.phase}: save round ${next.round}`,
  );
  return next;
};
const orderFor = (points) =>
  points === 100
    ? [0, 1, 2, 3, 4]
    : points === 50
      ? [1, 0, 3, 2, 4]
      : [4, 3, 2, 1, 0];
/** Scores real questions through their regular moves, with no state edits. */
function round(g, scores = g.seats.map(() => 300)) {
  for (let s = 0; s < g.seats.length; s++) {
    if (g.kind === 'miro') {
      for (let prompt = 0; prompt < 3; prompt++) {
        const target = places[g.cityIds[prompt]];
        g = apply(
          g,
          { type: 'pin', prompt, lat: target.lat, lng: target.lng },
          s,
        );
      }
      g = apply(g, { type: 'lock' }, s);
    } else if (g.kind === 'order') {
      const perPrompt =
        scores[s] === 300
          ? [100, 100, 100]
          : scores[s] === 150
            ? [50, 50, 50]
            : scores[s] === 100
              ? [100, 0, 0]
              : [0, 0, 0];
      for (let step = 0; step < 3; step++)
        g = apply(
          g,
          { type: 'arrange', step, order: orderFor(perPrompt[step]) },
          s,
        );
      g = apply(g, { type: 'lock' }, s);
    } else {
      const values =
        g.kind === 'year'
          ? g.events.map((id) =>
              scores[s] === 300 ? yearEvents[id].year : timeline[0],
            )
          : g.questions.map((q) => q.answer * (scores[s] === 300 ? 1 : 3));
      g = apply(g, { type: 'lock', values }, s);
    }
  }
  assert.equal(g.phase, 'reveal');
  const key = decisionKey(g);
  assert.equal(tick(g), g, 'a reveal never advances itself');
  assert.equal(decisionKey(g), key);
  while (g.phase === 'reveal') g = apply(g, { type: 'next' });
  assert.equal(g.phase, 'vote');
  return g;
}
function plans(
  g,
  routes = g.seats.map(() => 'trail'),
  purchases = g.seats.map(() => null),
) {
  for (let s = 0; s < g.seats.length; s++)
    g = apply(
      g,
      { type: 'trivia-plan', route: routes[s], purchase: purchases[s] },
      s,
    );
  assert.ok(campReady(g));
  return g;
}

await test('Trivia keeps legacy Quick saves and rejects unknown mode values', () => {
  for (const mode of ['quick', 'tower', 'expedition'])
    assert.ok(isTriviaMode(mode));
  for (const bad of ['', null, [], {}, 'Tower', 'journey', 0]) {
    assert.equal(isTriviaMode(bad), false);
    assert.throws(() => create(bad));
  }
  let g = createRules2('quick');
  const retiredTeams = createSabi(
    4,
    1,
    'medium',
    'teams',
    undefined,
    [0, 1, 0, 1],
  );
  assert.equal(retiredTeams.mode, 'individual');
  assert.deepEqual(retiredTeams.teams, [0, 1, 2, 3]);
  assert.ok(saved(retiredTeams));
  assert.equal(triviaModeOf(g), 'quick');
  const earlierModesQuick = structuredClone(g);
  delete earlierModesQuick.tribu.trivia.rules;
  assert.ok(
    saved(earlierModesQuick),
    'mode metadata without the new marker remains compatible',
  );
  assert.equal(triviaGameRoundLimit(earlierModesQuick), maxRounds);
  delete g.tribu.trivia;
  assert.equal(triviaModeOf(g), 'quick');
  assert.ok(saved(g));
  g = apply(g, { type: 'vote', choice: 'year' });
  g = round(g);
  const totals = seatTotals(g);
  g = apply(g, { type: 'vote', choice: 'order' });
  assert.deepEqual(seatTotals(g), totals);
  g = round(g);
  g = apply(g, { type: 'vote', choice: 'finish' });
  assert.ok(g.over);
  assert.equal(triviaOf(g), undefined);
  assert.deepEqual(entry.outcome(g).winners, [0, 1, 2]);
});

await test('rules 2 saves play each full mini-game once for 2–6 humans, while Quick permits repeats', () => {
  const choices = [
    'miro',
    'size',
    'year',
    'order',
    'miro',
    'size',
    'year',
    'order',
  ];
  for (const mode of ['quick', 'tower', 'expedition']) {
    for (let n = 2; n <= 6; n++) {
      let g = createRules2(mode, n, n * 13);
      const length = mode === 'quick' ? 8 : sets.miro.length;
      assert.equal(triviaOf(g).rules, 2);
      assert.equal(
        triviaRoundLimit(mode),
        mode === 'quick' ? maxRounds : sets.miro.length,
      );
      assert.ok(saved(g));
      for (let r = 0; r < length; r++) {
        if (mode === 'expedition') g = plans(g);
        const ledger = structuredClone(triviaOf(g));
        const totals = seatTotals(g);
        const choice = choices[r];
        const fromSave = JSON.parse(JSON.stringify(g));
        g = apply(g, { type: 'vote', choice });
        assert.deepEqual(play(fromSave, { type: 'vote', choice }, 0, 1000), g);
        assert.deepEqual(
          seatTotals(g),
          totals,
          'a handoff cannot add raw points',
        );
        assert.equal(g.round, r + 1);
        assert.equal(triviaOf(g).completed, r);
        assert.deepEqual(triviaOf(g).players, ledger.players);
        if (r >= 4) {
          if (choice === 'miro')
            assert.ok(
              g.cityIds.every((id) => !ledger.content.miro.includes(id)),
            );
          else if (choice === 'size')
            assert.ok(
              g.questions.every(
                (q) => !ledger.content.size.includes(`${q.ref}>${q.target}`),
              ),
            );
          else
            assert.ok(
              (choice === 'year' ? g.events : g.sets).every(
                (id) => !ledger.content[choice].includes(id),
              ),
            );
        }
        g = round(g);
        const t = triviaOf(g);
        const accounted = structuredClone(t);
        assert.equal(play(g, { type: 'next' }, 0), g);
        assert.deepEqual(
          triviaOf(tick(g)),
          accounted,
          'awards settle exactly once',
        );
        assert.equal(t.completed, r + 1);
        assert.equal(t.rounds.length, r + 1);
        assert.deepEqual(t.roundScores, Array(n).fill(300));
        assert.deepEqual(t.basePoints, Array(n).fill((r + 1) * 300));
        assert.equal(g.over, false, 'even the final awards wait for the host');
        assert.equal(
          tick(g),
          g,
          'nothing advances at camp or the host chooser',
        );
        for (let s = 0; s < n; s++) assert.equal(botMove(g, s), null);
        if (mode !== 'quick') {
          assert.equal(deadline(g), null);
          assert.ok(g.vote.host);
          assert.equal(
            validMove(g, { type: 'vote', choice: 'finish' }, 0),
            r + 1 === length,
          );
          assert.deepEqual(
            g.vote.options,
            r + 1 === length
              ? ['finish']
              : sets.miro.filter(
                  (kind) => !choices.slice(0, r + 1).includes(kind),
                ),
          );
          assert.deepEqual(
            remainingTriviaGames(g),
            sets.miro.filter((kind) => !choices.slice(0, r + 1).includes(kind)),
          );
          for (const played of choices.slice(0, r + 1))
            assert.equal(
              validMove(g, { type: 'vote', choice: played }, 0),
              false,
              'a fixed match cannot repeat a game',
            );
        }
      }
      if (mode === 'expedition') {
        assert.ok(campReady(g));
        assert.deepEqual(actingSeats(g), []);
        assert.deepEqual(
          triviaOf(g).ready,
          Array(n).fill(false),
          'there is no final route lock',
        );
      }
      g = apply(g, { type: 'vote', choice: 'finish' });
      assert.ok(g.over);
      assert.deepEqual(
        entry.outcome(g).winners,
        Array.from({ length: n }, (_, s) => s),
      );
      assert.equal(entry.outcome(g).detail, `${length} rounds`);
      if (mode === 'tower')
        assert.ok(
          triviaOf(g).players.every(
            (p) => p.floors === 20 && p.victories === 4,
          ),
        );
      if (mode === 'expedition')
        assert.ok(
          triviaOf(g).players.every(
            (p) =>
              p.trophies === 1 &&
              p.coins === 0 &&
              p.supplies === 0 &&
              p.distance === 4,
          ),
        );
    }
  }
});

await test('legacy Tower retains five rounds, settles shared victories once, and breaks equal floors by raw points', () => {
  let g = createLegacy('tower', 2, 22, true);
  assert.equal(triviaGameRoundLimit(g), 5);
  assert.ok(g.vote.host, 'fixed modes ignore the optional table vote');
  assert.equal(g.tribu.votes, undefined);
  const scores = [
    [300, 150],
    [100, 300],
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  for (let i = 0; i < 5; i++) {
    g = apply(g, { type: 'vote', choice: 'order' });
    g = round(g, scores[i]);
    const accounted = structuredClone(triviaOf(g));
    assert.equal(play(g, { type: 'next' }, 0), g);
    assert.equal(tick(g), g);
    assert.deepEqual(
      triviaOf(g),
      accounted,
      'reload/tick/duplicate Next never add floors',
    );
  }
  assert.deepEqual(
    triviaOf(g).players.map((p) => p.floors),
    [12, 12],
  );
  assert.deepEqual(
    triviaOf(g).players.map((p) => p.victories),
    [4, 4],
  );
  assert.deepEqual(seatTotals(g), [400, 450]);
  assert.deepEqual(triviaWinners(g), [1]);
  g = apply(g, { type: 'vote', choice: 'finish' });
  assert.deepEqual(entry.outcome(g).winners, [1]);
  assert.equal(entry.outcome(g).rows[0].seat, 1);
  assert.match(entry.outcome(g).rows[0].value, /12 floors.*450 points/);
});

await test('Expedition route thresholds award only automatic steps, with clear fallback risks', () => {
  assert.deepEqual(triviaExpedition, { checkpointSteps: 3, maxSteps: 12 });
  assert.deepEqual(triviaReward('trail', 0), {
    distance: 1,
    success: true,
  });
  assert.deepEqual(triviaReward('river', 149), {
    distance: 1,
    success: false,
  });
  assert.deepEqual(triviaReward('river', 150), {
    distance: 2,
    success: true,
  });
  assert.deepEqual(triviaReward('summit', 239), {
    distance: 0,
    success: false,
  });
  assert.deepEqual(triviaReward('summit', 240), {
    distance: 3,
    success: true,
  });
});

await test('legacy Expedition retains eight rounds, the atomic shop, supplies cap, and final trophy', () => {
  let g = createLegacy('expedition', 2);
  assert.equal(triviaGameRoundLimit(g), 8);
  const purchases = [
    [null, null],
    [null, 'trophy'],
    ['supplies', 'supplies'],
    [null, 'supplies'],
    [null, 'supplies'],
    [null, 'trophy'],
    [null, 'trophy'],
    [null, 'trophy'],
  ];
  for (let r = 0; r < 8; r++) {
    const before = structuredClone(triviaOf(g).players);
    if (r === 5)
      assert.equal(
        validMove(
          g,
          { type: 'trivia-plan', route: 'summit', purchase: 'supplies' },
          1,
        ),
        false,
      );
    g = plans(g, ['trail', 'summit'], purchases[r]);
    assert.deepEqual(
      triviaOf(g).players,
      before,
      'locking neither spends nor gives rewards',
    );
    assert.equal(
      play(g, { type: 'trivia-plan', route: 'trail', purchase: null }, 0),
      g,
    );
    assert.equal(
      play(g, { type: 'trivia-unlock' }, 0),
      g,
      'the last lock commits everyone until the host starts',
    );
    g = apply(g, { type: 'vote', choice: 'order' });
    for (let s = 0; s < 2; s++)
      assert.equal(
        triviaOf(g).players[s].coins,
        before[s].coins - (purchases[r][s] ? triviaCosts[purchases[r][s]] : 0),
      );
    g = round(g);
    assert.equal(
      play(g, { type: 'vote', choice: 'finish' }, 0),
      g,
      'the final camp still needs private locks',
    );
  }
  assert.deepEqual(
    triviaOf(g).players.map((p) => ({
      coins: p.coins,
      distance: p.distance,
      trophies: p.trophies,
      supplies: p.supplies,
    })),
    [
      { coins: 24, distance: 8, trophies: 0, supplies: 1 },
      { coins: 45, distance: 24, trophies: 4, supplies: 3 },
    ],
  );
  assert.equal(
    validMove(g, { type: 'trivia-plan', route: 'trail', purchase: null }, 0),
    false,
    'no ninth route',
  );
  assert.equal(
    validMove(g, { type: 'trivia-plan', route: null, purchase: 'supplies' }, 0),
    false,
    'supplies cannot help after the last round',
  );
  g = plans(g, [null, null], ['trophy', 'trophy']);
  const before = structuredClone(triviaOf(g).players);
  assert.equal(
    before[0].coins,
    24,
    'the final purchase also waits for the host',
  );
  g = apply(g, { type: 'vote', choice: 'finish' });
  assert.deepEqual(
    triviaOf(g).players.map((p) => ({ coins: p.coins, trophies: p.trophies })),
    [
      { coins: 16, trophies: 1 },
      { coins: 37, trophies: 5 },
    ],
  );
  assert.equal(g.round, 8);
  assert.deepEqual(entry.outcome(g).winners, [1]);
  assert.match(
    entry.outcome(g).rows[0].value,
    /5 trophies.*24 steps.*37 coins.*2400 points/,
  );
  assert.equal(play(g, { type: 'vote', choice: 'finish' }, 0), g);
});

await test('Expedition awards each third step automatically and finishes without a shop or final locks', () => {
  let g = createRules2('expedition', 2);
  const choices = ['order', 'year', 'size', 'miro'];
  for (let r = 0; r < choices.length; r++) {
    const before = structuredClone(triviaOf(g).players);
    for (const purchase of ['trophy', 'supplies']) {
      const move = { type: 'trivia-plan', route: 'summit', purchase };
      assert.equal(validMove(g, move, 0), false);
      assert.equal(play(g, move, 0), g);
    }
    g = plans(g, ['trail', 'summit']);
    assert.deepEqual(
      triviaOf(g).players,
      before,
      'route locks do not alter scores',
    );
    g = apply(g, { type: 'vote', choice: choices[r] });
    assert.deepEqual(triviaOf(g).players, before, 'starting spends nothing');
    g = round(g);
    const t = triviaOf(g);
    assert.deepEqual(
      t.players.map((p) => p.distance),
      [r + 1, (r + 1) * 3],
    );
    assert.deepEqual(
      t.players.map((p) => p.trophies),
      [Math.floor((r + 1) / 3), r + 1],
    );
    assert.ok(t.players.every((p) => p.coins === 0 && p.supplies === 0));
    assert.ok(
      t.rounds.every((round) => round.purchases.every((p) => p === null)),
    );
    assert.deepEqual(t.finalPurchases, [null, null]);
  }
  assert.ok(campReady(g));
  assert.deepEqual(actingSeats(g), []);
  for (const move of [
    { type: 'trivia-plan', route: null, purchase: null },
    { type: 'trivia-plan', route: 'trail', purchase: null },
    { type: 'trivia-unlock' },
    { type: 'vote', choice: 'order' },
  ]) {
    assert.equal(validMove(g, move, 0), false);
    assert.equal(play(g, move, 0), g);
  }
  const final = JSON.parse(JSON.stringify(g));
  g = apply(g, { type: 'vote', choice: 'finish' });
  assert.deepEqual(play(final, { type: 'vote', choice: 'finish' }, 0, 1000), g);
  assert.equal(g.round, 4);
  assert.deepEqual(entry.outcome(g).winners, [1]);
  assert.match(
    entry.outcome(g).rows[0].value,
    /12 steps.*4 checkpoints.*1200 points/,
  );
  assert.doesNotMatch(entry.outcome(g).rows[0].value, /coins|supplies/);
  assert.equal(entry.outcome(g).rows[0].points, 12);
  assert.equal(play(g, { type: 'vote', choice: 'finish' }, 0), g);
});

await test('Expedition applies route risk to a whole round and furthest distance wins before points', () => {
  let g = createRules2('expedition', 3);
  const choices = ['order', 'year', 'size', 'miro'];
  const routes = ['summit', 'river', 'trail'];
  const distances = [
    [0, 2, 1],
    [3, 4, 2],
    [6, 6, 3],
    [9, 8, 4],
  ];
  for (let r = 0; r < choices.length; r++) {
    g = plans(g, routes);
    g = apply(g, { type: 'vote', choice: choices[r] });
    g = round(g, r === 0 ? [0, 150, 100] : [300, 300, 300]);
    assert.deepEqual(
      triviaOf(g).players.map((p) => p.distance),
      distances[r],
    );
    assert.deepEqual(
      triviaOf(g).players.map((p) => p.trophies),
      distances[r].map((steps) => Math.floor(steps / 3)),
    );
  }
  assert.deepEqual(seatTotals(g), [900, 1050, 1000]);
  assert.deepEqual(
    triviaWinners(g),
    [0],
    'distance decides before total question points',
  );
  g = apply(g, { type: 'vote', choice: 'finish' });
  assert.deepEqual(entry.outcome(g).winners, [0]);
});

await test('fixed Trivia rejects repeated ledger kinds, spoofed choices and premature Finish saves', () => {
  for (const mode of ['tower', 'expedition']) {
    let g = createRules2(mode, 2);
    if (mode === 'expedition') g = plans(g);
    g = apply(g, { type: 'vote', choice: 'year' });
    g = round(g);
    const expanded = structuredClone(g);
    expanded.vote.options.push('year');
    assert.equal(
      saved(expanded),
      false,
      'completed games cannot return to the host pick',
    );
    const earlyFinish = structuredClone(g);
    earlyFinish.vote.options = ['finish'];
    assert.equal(
      saved(earlyFinish),
      false,
      'four complete rounds are required',
    );
    if (mode === 'expedition') g = plans(g);
    g = apply(g, { type: 'vote', choice: 'order' });
    const repeatedChallenge = structuredClone(g);
    repeatedChallenge.tribu.trivia.rounds[0].kind = 'order';
    assert.equal(
      saved(repeatedChallenge),
      false,
      'an active fixed challenge cannot repeat a completed game',
    );
    g = round(g);
    const repeatedLedger = structuredClone(g);
    repeatedLedger.tribu.trivia.rounds[0].kind = 'order';
    assert.equal(
      saved(repeatedLedger),
      false,
      'a fixed ledger cannot contain duplicate games',
    );
  }
});

await test('Expedition camps keep plans private through the last lock, and support editing before it', () => {
  let g = createRules2('expedition', 3);
  const key = decisionKey(g);
  g = apply(g, { type: 'trivia-plan', route: 'river', purchase: null }, 0);
  assert.deepEqual(actingSeats(g), [1, 2]);
  assert.equal(
    decisionKey(g),
    key,
    'simultaneous plans share a stable decision',
  );
  assert.equal(validMove(g, { type: 'trivia-unlock' }, 0), true);
  g = apply(g, { type: 'trivia-unlock' }, 0);
  assert.deepEqual(
    triviaOf(g).plans[0],
    { route: 'river', purchase: null },
    'editing preserves the earlier choice',
  );
  g = apply(g, { type: 'trivia-plan', route: 'summit', purchase: null }, 0);
  g = apply(g, { type: 'trivia-plan', route: 'river', purchase: null }, 1);
  g = apply(g, { type: 'trivia-plan', route: 'trail', purchase: null }, 2);
  assert.ok(campReady(g));
  for (const viewer of [-1, 0, 1, 2, 99]) {
    const seen = observe(g, viewer);
    assert.deepEqual(
      triviaOf(seen).plans,
      triviaOf(g).plans.map((p, s) => (s === viewer ? p : null)),
    );
    assert.deepEqual(triviaOf(seen).ready, [true, true, true]);
    assert.deepEqual(triviaOf(seen).content, {
      miro: [],
      size: [],
      year: [],
      order: [],
    });
    assert.deepEqual(triviaOf(seen).activeRoutes, [null, null, null]);
    assert.deepEqual(triviaOf(seen).rounds, []);
    assert.equal(
      validMove(
        g,
        { type: 'trivia-plan', route: 'trail', purchase: null },
        viewer,
      ),
      false,
    );
  }
  assert.equal(g.phase, 'vote');
  assert.equal(tick(g), g);
  assert.deepEqual(actingSeats(g), []);
  assert.equal(validMove(g, { type: 'trivia-unlock' }, 0), false);
  assert.equal(validMove(g, { type: 'vote', choice: 'order' }, -1), false);
  assert.equal(validMove(g, { type: 'vote', choice: 'order' }, 99), false);
  const launched = apply(g, { type: 'vote', choice: 'order' });
  assert.deepEqual(triviaOf(launched).activeRoutes, [
    'summit',
    'river',
    'trail',
  ]);
  assert.deepEqual(triviaOf(launched).plans, [null, null, null]);
  assert.notEqual(decisionKey(launched), key);
  const tampered = structuredClone(g);
  tampered.tribu.trivia.futureSchedule = ['an unrevealed answer'];
  assert.equal(saved(tampered), false);
  assert.equal(
    Object.hasOwn(triviaOf(observe(tampered, -1)), 'futureSchedule'),
    false,
  );
});

await test('Trivia validates exact purchase, route and state shapes without changing rejected moves', () => {
  let g = createRules2('expedition', 2);
  for (const move of [
    { type: 'trivia-plan', route: null, purchase: null },
    { type: 'trivia-plan', route: 'ocean', purchase: null },
    { type: 'trivia-plan', route: 'trail', purchase: 'trophy' },
    { type: 'trivia-plan', route: 'trail', purchase: 'supplies' },
    { type: 'trivia-plan', route: 'trail', purchase: 'coins' },
    { type: 'trivia-plan', route: 'trail' },
    { type: 'trivia-plan', route: 'trail', purchase: null, coins: 100 },
    { type: 'trivia-unlock' },
    { type: 'vote', choice: 'year' },
    { type: 'next' },
    { type: 'lock' },
  ]) {
    assert.equal(validMove(g, move, 0), false);
    assert.equal(play(g, move, 0), g);
  }
  g = plans(g);
  g = apply(g, { type: 'vote', choice: 'year' });
  g = round(g);
  for (const mutate of [
    (t) => {
      t.rules = 3;
    },
    (t) => {
      t.mode = 'bogus';
    },
    (t) => {
      t.stage = 'challenge';
    },
    (t) => {
      t.completed++;
    },
    (t) => {
      t.accountedRound--;
    },
    (t) => {
      t.basePoints[0]++;
    },
    (t) => {
      t.players[0].coins++;
    },
    (t) => {
      t.players[0].trophies++;
    },
    (t) => {
      t.players[0].supplies++;
    },
    (t) => {
      t.players[0].distance++;
    },
    (t) => {
      t.players[0].floors++;
    },
    (t) => {
      t.ready[0] = true;
    },
    (t) => {
      t.plans[0] = { route: 'trail', purchase: 'trophy' };
    },
    (t) => {
      t.activeRoutes[0] = 'summit';
    },
    (t) => {
      t.activePurchases[0] = 'trophy';
    },
    (t) => {
      t.finalPurchases[0] = 'trophy';
    },
    (t) => {
      t.roundScores[0]--;
    },
    (t) => {
      t.roundWinners = [];
    },
    (t) => {
      t.rounds[0].scores[0]--;
    },
    (t) => {
      t.rounds[0].purchases[0] = 'trophy';
    },
    (t) => {
      t.content.year = [999999];
    },
    (t) => {
      t.futureSchedule = [123];
    },
  ]) {
    const bad = structuredClone(g);
    mutate(triviaOf(bad));
    assert.equal(saved(bad), false, mutate.toString());
  }
  const nullMetadata = structuredClone(g);
  nullMetadata.tribu.trivia = null;
  assert.equal(saved(nullMetadata), false);
  const foreignMetadata = standaloneGames.orin.create(2, 2, 'medium');
  foreignMetadata.tribu.trivia = createTriviaState(2);
  assert.equal(standaloneGames.orin.isSavedGame(foreignMetadata), false);
  assert.ok(
    validVote(
      { endsAt: null, host: true, choices: [null, null], options: ['finish'] },
      2,
    ),
  );
  assert.equal(
    validVote({ endsAt: null, choices: [null, null], options: ['finish'] }, 2),
    false,
  );
  assert.ok(
    validVote(
      { endsAt: null, host: true, choices: [null, null], options: ['year'] },
      2,
    ),
    'the host can pick the last remaining game',
  );
  assert.equal(
    validVote({ endsAt: null, choices: [null, null], options: ['year'] }, 2),
    false,
  );
  assert.equal(
    validVote(
      {
        endsAt: null,
        host: true,
        choices: [null, null],
        options: ['year', 'year'],
      },
      2,
    ),
    false,
  );
});

await test('legacy Expedition retains trophy, distance, coin and point tie-breaks', () => {
  const state = createTriviaState(6, 'expedition');
  delete state.rules;
  state.players[0] = {
    ...state.players[0],
    trophies: 3,
    distance: 1,
    coins: 1,
  };
  state.players[1] = {
    ...state.players[1],
    trophies: 2,
    distance: 24,
    coins: 99,
  };
  state.players[2] = {
    ...state.players[2],
    trophies: 2,
    distance: 23,
    coins: 99,
  };
  state.players[3] = {
    ...state.players[3],
    trophies: 2,
    distance: 23,
    coins: 98,
  };
  state.players[4] = {
    ...state.players[4],
    trophies: 2,
    distance: 23,
    coins: 98,
  };
  state.players[5] = {
    ...state.players[5],
    trophies: 2,
    distance: 23,
    coins: 98,
  };
  const g = {
    kind: 'year',
    seats: ['A', 'B', 'C', 'D', 'E', 'F'],
    mode: 'individual',
    teams: [0, 1, 2, 3, 4, 5],
    scores: [0, 0, 0, 40, 20, 40],
    round: 1,
    phase: 'reveal',
    over: true,
    tribu: { carry: [0, 0, 0, 0, 0, 0], mode: 'individual', trivia: state },
  };
  assert.deepEqual(
    triviaStandings(g).map((p) => p.seat),
    [0, 1, 2, 3, 5, 4],
  );
  assert.deepEqual(triviaWinners(g), [0]);
  state.players[0] = { ...state.players[3] };
  state.players[1] = { ...state.players[3] };
  state.players[2] = { ...state.players[3] };
  assert.deepEqual(triviaWinners(g), [3, 5]);
});

await test('Expedition ranks distance, then raw points, and shares exact ties', () => {
  const state = createTriviaState(4, 'expedition');
  state.rules = 2;
  delete state.length;
  for (let s = 0; s < 4; s++) {
    state.players[s].distance = s === 0 ? 6 : 7;
    state.players[s].trophies = 2;
  }
  const g = {
    kind: 'year',
    seats: ['A', 'B', 'C', 'D'],
    mode: 'individual',
    teams: [0, 1, 2, 3],
    scores: [1200, 700, 800, 800],
    round: 4,
    phase: 'reveal',
    over: true,
    tribu: { carry: [0, 0, 0, 0], mode: 'individual', trivia: state },
  };
  assert.deepEqual(
    triviaStandings(g).map((p) => p.seat),
    [2, 3, 1, 0],
  );
  assert.deepEqual(
    triviaStandings(g).map((p) => p.score),
    [7, 7, 7, 6],
  );
  assert.deepEqual(triviaWinners(g), [2, 3]);
});

await test('observed challenges keep future decks and opponents guesses out of Trivia metadata', () => {
  let g = createRules2('expedition', 2);
  for (const kind of ['year', 'order', 'size', 'miro']) {
    g = plans(g, ['trail', 'summit']);
    g = apply(g, { type: 'vote', choice: kind });
    const v = observe(g, 0);
    assert.equal(v.rngState, 0);
    assert.deepEqual(triviaOf(v).content, {
      miro: [],
      size: [],
      year: [],
      order: [],
    });
    assert.equal(triviaOf(v).rounds.length, g.round - 1);
    if (kind === 'miro') {
      assert.deepEqual(v.deck, []);
      assert.deepEqual(v.cityIds, []);
      assert.deepEqual(v.guesses[1].pins, [null, null, null]);
    } else {
      assert.deepEqual(v.used, []);
      if (kind === 'order')
        assert.deepEqual(v.guesses[1].orders, [null, null, null]);
      else assert.deepEqual(v.guesses[1].values, [null, null, null]);
      if (kind === 'size') assert.ok(v.questions.every((q) => q.answer === -1));
    }
    g = round(g);
  }
});
