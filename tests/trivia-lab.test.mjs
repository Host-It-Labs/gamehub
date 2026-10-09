import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTriviaLabGame,
  simulateTriviaLabRound,
  finishTriviaLabGame,
} from '../components/game/trivia-3d/trivia-lab-game.ts';
import {
  play,
  standaloneGames,
  validMove,
} from '../lib/games/standalone/registry.ts';
import {
  campReady,
  triviaOf,
  triviaWinners,
} from '../lib/games/party/trivia.ts';
import { seatTotals } from '../lib/games/party/tribu.ts';
import { sets } from '../lib/games/party/vote.ts';
import { distance, pinPoints, places } from '../lib/games/party/geography.ts';
import { points as sizePoints } from '../lib/games/party/size.ts';
import { points as yearPoints } from '../lib/games/party/year.ts';
import { timeline, yearEvents } from '../lib/games/party/year-events.ts';
import { orderPoints } from '../lib/games/party/order.ts';

const saved = (g) =>
  standaloneGames.miro.isSavedGame(JSON.parse(JSON.stringify(g)));
function apply(g, m, seat = 0) {
  assert.ok(validMove(g, m, seat));
  const next = play(g, m, seat, 1000);
  assert.ok(saved(next));
  return next;
}
function simulate(g, scores, route) {
  const before = structuredClone(g);
  const next = simulateTriviaLabRound(g, scores, route);
  assert.deepEqual(g, before, 'simulation leaves its input intact');
  assert.notEqual(next, g);
  assert.ok(saved(next), `${next.kind}/${next.phase} is a replayable save`);
  return next;
}
function finish(g, scores, route) {
  const before = structuredClone(g);
  const next = finishTriviaLabGame(g, scores, route);
  assert.deepEqual(g, before, 'finishing leaves its input intact');
  assert.notEqual(next, g);
  assert.ok(saved(next));
  return next;
}
function scoredAnswers(g, seat) {
  const b = g.guesses[seat];
  assert.equal(b.locked, true);
  if (g.kind === 'miro')
    return b.pins.map((pin, step) =>
      pinPoints(distance(pin, places[g.cityIds[step]])),
    );
  if (g.kind === 'size')
    return b.values.map((value, step) =>
      sizePoints(value, g.questions[step].answer),
    );
  if (g.kind === 'year')
    return b.values.map((value, step) =>
      yearPoints(value, yearEvents[g.events[step]].year),
    );
  return b.orders.map(orderPoints);
}
function lockPerfect(g, seat) {
  if (g.kind === 'miro') {
    const ids = [...g.cityIds];
    for (let prompt = 0; prompt < 3; prompt++) {
      const p = places[ids[prompt]];
      g = apply(g, { type: 'pin', prompt, lat: p.lat, lng: p.lng }, seat);
    }
    return apply(g, { type: 'lock' }, seat);
  }
  if (g.kind === 'size')
    return apply(
      g,
      { type: 'lock', values: g.questions.map((q) => q.answer) },
      seat,
    );
  if (g.kind === 'year')
    return apply(
      g,
      { type: 'lock', values: g.events.map((id) => yearEvents[id].year) },
      seat,
    );
  for (let step = 0; step < 3; step++)
    g = apply(g, { type: 'arrange', step, order: [0, 1, 2, 3, 4] }, seat);
  return apply(g, { type: 'lock' }, seat);
}

await test('the lab starts both modes with named humans and no locked camp plans, using a repeatable default seed', () => {
  for (const mode of ['tower', 'expedition'])
    for (let seats = 2; seats <= 6; seats++) {
      const g = createTriviaLabGame(mode, seats);
      assert.ok(saved(g));
      assert.deepEqual(g, createTriviaLabGame(mode, seats, 731));
      assert.deepEqual(
        g.seats,
        ['Alex', 'Milo', 'Noor', 'Luna', 'Theo', 'Ines'].slice(0, seats),
      );
      assert.equal(g.phase, 'vote');
      assert.equal(g.vote.opening, true);
      assert.equal(g.vote.host, true);
      const t = triviaOf(g);
      assert.equal(t.mode, mode);
      assert.equal(t.completed, 0);
      assert.deepEqual(t.plans, Array(seats).fill(null));
      assert.deepEqual(t.ready, Array(seats).fill(false));
      assert.equal(campReady(g), false);
      assert.deepEqual(t.rounds, []);
    }
  assert.notDeepEqual(
    createTriviaLabGame('tower', 3, 731),
    createTriviaLabGame('tower', 3, 732),
  );
});

for (const mode of ['tower', 'expedition']) {
  await test(`${mode}: all four complete lab rounds produce the exact chosen scores through real answers`, () => {
    let g = createTriviaLabGame(mode, 3);
    const scores = [0, 150, 300];
    for (let round = 0; round < sets.miro.length; round++) {
      g = simulate(g, scores, 'summit');
      const t = triviaOf(g);
      assert.equal(g.kind, sets.miro[round]);
      assert.equal(t.completed, round + 1);
      assert.equal(g.over, false, 'the fourth result still waits for Finish');
      assert.equal(g.phase, 'vote');
      assert.deepEqual(t.roundScores, scores);
      assert.deepEqual(
        t.rounds.map((r) => r.kind),
        sets.miro.slice(0, round + 1),
      );
      for (let seat = 0; seat < scores.length; seat++) {
        const gains = scoredAnswers(g, seat);
        assert.equal(gains.length, 3);
        assert.equal(
          gains.reduce((a, b) => a + b, 0),
          scores[seat],
        );
      }
    }
    assert.deepEqual(seatTotals(g), [0, 600, 1200]);
    assert.deepEqual(triviaWinners(g), [2]);
    if (mode === 'tower') {
      assert.deepEqual(
        triviaOf(g).players.map((p) => p.floors),
        [0, 4, 20],
      );
      assert.deepEqual(
        triviaOf(g).players.map((p) => p.victories),
        [0, 0, 4],
      );
    } else {
      assert.ok(campReady(g));
      assert.deepEqual(triviaOf(g).ready, [false, false, false]);
      assert.deepEqual(
        triviaOf(g).players.map((p) => p.distance),
        [0, 0, 12],
      );
      assert.deepEqual(
        triviaOf(g).players.map((p) => p.trophies),
        [0, 0, 4],
      );
      assert.ok(
        triviaOf(g).players.every((p) => p.coins === 0 && p.supplies === 0),
      );
    }
    g = simulate(g, scores, 'summit');
    assert.equal(g.over, true);
    assert.deepEqual(
      simulate(g, scores, 'trail'),
      g,
      'finished matches remain unchanged',
    );
    assert.deepEqual(finish(g, scores, 'river'), g);
  });
}

await test('Years lab guesses score exactly 0, 150 and 300 with legal integer years across dealt eras', () => {
  for (let seed = 0; seed < 32; seed++) {
    let g = createTriviaLabGame('tower', 3, seed);
    g = apply(g, { type: 'vote', choice: 'year' });
    g = simulate(g, [0, 150, 300], 'trail');
    assert.deepEqual(triviaOf(g).roundScores, [0, 150, 300], `seed ${seed}`);
    assert.equal(g.gains.length, 3);
    for (let seat = 0; seat < 3; seat++) {
      assert.ok(
        g.guesses[seat].values.every(
          (value) =>
            Number.isInteger(value) &&
            value >= timeline[0] &&
            value <= timeline[1],
        ),
      );
      assert.equal(
        scoredAnswers(g, seat).reduce((a, b) => a + b, 0),
        [0, 150, 300][seat],
      );
    }
  }
});

await test('the lab preserves every mini-game answer already locked instead of overwriting its real score', () => {
  for (const kind of sets.miro) {
    let g = createTriviaLabGame('tower', 3);
    g = apply(g, { type: 'vote', choice: kind });
    g = lockPerfect(g, 0);
    const locked = structuredClone(g.guesses[0]);
    g = simulate(g, [0, 150, 300], 'trail');
    assert.deepEqual(
      g.guesses[0],
      locked,
      `${kind}: the locked answers survive`,
    );
    assert.deepEqual(triviaOf(g).roundScores, [300, 150, 300]);
    assert.deepEqual(triviaOf(g).roundWinners, [0, 2]);
  }
});

await test('a lab round already partway through its reveal keeps the locked answers and earlier gains', () => {
  let g = createTriviaLabGame('tower', 3);
  g = apply(g, { type: 'vote', choice: 'year' });
  for (let seat = 0; seat < 3; seat++) g = lockPerfect(g, seat);
  g = apply(g, { type: 'next' });
  assert.equal(g.step, 1);
  assert.deepEqual(g.scores, [200, 200, 200]);
  const guesses = structuredClone(g.guesses);
  const earlierGains = structuredClone(g.gains);
  g = simulate(g, [0, 0, 0], 'trail');
  assert.deepEqual(g.guesses, guesses);
  assert.deepEqual(g.gains.slice(0, 2), earlierGains);
  assert.deepEqual(triviaOf(g).roundScores, [300, 300, 300]);
  assert.equal(triviaOf(g).completed, 1);
});

await test('partial Expedition camp locks are legally unlocked before applying the selected route to everyone', () => {
  let g = createTriviaLabGame('expedition', 3);
  g = apply(g, { type: 'trivia-plan', route: 'summit', purchase: null }, 0);
  g = apply(g, { type: 'trivia-plan', route: 'river', purchase: null }, 1);
  assert.equal(campReady(g), false);
  g = simulate(g, [0, 150, 300], 'trail');
  assert.deepEqual(triviaOf(g).rounds[0].routes, ['trail', 'trail', 'trail']);
  assert.deepEqual(
    triviaOf(g).players.map((p) => p.distance),
    [1, 1, 1],
  );
});

await test('fully locked Expedition camp routes stay committed when the lab selects another route', () => {
  let g = createTriviaLabGame('expedition', 3);
  const routes = ['trail', 'river', 'summit'];
  for (let seat = 0; seat < 3; seat++)
    g = apply(
      g,
      { type: 'trivia-plan', route: routes[seat], purchase: null },
      seat,
    );
  assert.ok(campReady(g));
  assert.equal(validMove(g, { type: 'trivia-unlock' }, 0), false);
  g = simulate(g, [0, 150, 300], 'trail');
  assert.deepEqual(triviaOf(g).rounds[0].routes, routes);
  assert.deepEqual(
    triviaOf(g).players.map((p) => p.distance),
    [1, 2, 3],
  );
  assert.deepEqual(
    triviaOf(g).players.map((p) => p.trophies),
    [0, 0, 1],
  );
});

await test('finishing a lab match preserves prior rounds, a chosen game order and current progress', () => {
  let g = createTriviaLabGame('tower', 3);
  g = simulate(g, [300, 150, 0], 'trail');
  const first = structuredClone(triviaOf(g).rounds[0]);
  g = apply(g, { type: 'vote', choice: 'order' });
  g = simulate(g, [0, 300, 150], 'trail');
  const prefix = structuredClone(triviaOf(g).rounds);
  const totals = seatTotals(g);
  g = finish(g, [150, 0, 300], 'trail');
  assert.equal(g.over, true);
  assert.equal(triviaOf(g).completed, 4);
  assert.deepEqual(triviaOf(g).rounds.slice(0, 2), prefix);
  assert.deepEqual(triviaOf(g).rounds[0], first);
  assert.deepEqual(
    triviaOf(g).rounds.map((r) => r.kind),
    ['miro', 'order', 'size', 'year'],
  );
  assert.deepEqual(
    seatTotals(g),
    totals.map((score, seat) => score + [150, 0, 300][seat] * 2),
  );
});

await test('lab Finish reaches tied maximum states for 2–6 humans and restart returns a clean opening', () => {
  for (const mode of ['tower', 'expedition'])
    for (let seats = 2; seats <= 6; seats++) {
      const opening = createTriviaLabGame(mode, seats);
      const g = finish(opening, Array(seats).fill(300), 'summit');
      const t = triviaOf(g);
      assert.equal(g.over, true);
      assert.equal(t.completed, 4);
      assert.deepEqual(
        triviaWinners(g),
        Array.from({ length: seats }, (_, seat) => seat),
      );
      assert.ok(
        t.players.every((p) =>
          mode === 'tower'
            ? p.floors === 20 && p.victories === 4
            : p.distance === 12 && p.trophies === 4,
        ),
      );
      assert.deepEqual(
        createTriviaLabGame(mode, seats),
        opening,
        'restart clears all earned progress',
      );
    }
});

await test('lab routes and raw-score ties use the real Expedition reward and winner rules', () => {
  for (const [route, distances, trophies] of [
    ['trail', [4, 4, 4], [1, 1, 1]],
    ['river', [4, 8, 8], [1, 2, 2]],
    ['summit', [0, 0, 12], [0, 0, 4]],
  ]) {
    const g = finish(
      createTriviaLabGame('expedition', 3),
      [0, 150, 300],
      route,
    );
    assert.deepEqual(
      triviaOf(g).players.map((p) => p.distance),
      distances,
    );
    assert.deepEqual(
      triviaOf(g).players.map((p) => p.trophies),
      trophies,
    );
    assert.deepEqual(triviaWinners(g), [2]);
  }
  const none = finish(createTriviaLabGame('expedition', 2), [0, 0], 'summit');
  assert.deepEqual(
    triviaOf(none).players.map((p) => p.distance),
    [0, 0],
  );
  assert.deepEqual(triviaWinners(none), [0, 1]);
});

await test('invalid lab state, score choices and routes are refused without mutating the supplied game', () => {
  for (const mode of ['quick', 'other', null])
    assert.throws(() => createTriviaLabGame(mode, 3));
  for (const seats of [1, 7, 2.5])
    assert.throws(() => createTriviaLabGame('tower', seats));
  const g = createTriviaLabGame('expedition', 3);
  const before = structuredClone(g);
  for (const scores of [[], [300, 150], [0, 100, 300], [0, NaN, 300]])
    for (const helper of [simulateTriviaLabRound, finishTriviaLabGame])
      assert.throws(() => helper(g, scores, 'trail'), /points/);
  for (const helper of [simulateTriviaLabRound, finishTriviaLabGame]) {
    assert.throws(() => helper(g, [0, 150, 300], 'ocean'), /Trail/);
    assert.throws(
      () =>
        helper(
          standaloneGames.miro.create(3, 731, 'medium'),
          [0, 150, 300],
          'trail',
        ),
      /current Tower or Expedition/,
    );
  }
  const legacy = structuredClone(g);
  delete legacy.tribu.trivia.rules;
  assert.throws(
    () => simulateTriviaLabRound(legacy, [0, 150, 300], 'trail'),
    /current Tower or Expedition/,
  );
  assert.deepEqual(g, before);
});
