import test from 'node:test';
import assert from 'node:assert/strict';
import {
  standaloneGames,
  actingSeats,
  decisionKey,
  observe,
  play,
  validMove,
} from '../lib/games/standalone/registry.ts';
import {
  campReady,
  canExtendTrivia,
  collectionScore,
  currentDraft,
  draftOrder,
  draftPicker,
  findCounts,
  findGain,
  placementBlocks,
  remainingTriviaGames,
  triangle,
  triviaGameRoundLimit,
  triviaOf,
  triviaStandings,
  triviaWinners,
} from '../lib/games/party/trivia.ts';
import {
  createTriviaLabGame,
  simulateTriviaLabRound,
} from '../components/game/trivia-3d/trivia-lab-game.ts';
import { seatTotals } from '../lib/games/party/tribu.ts';
import { sets } from '../lib/games/party/vote.ts';

const entry = standaloneGames.miro;
const create = (mode, n = 3, length = 4, seed = 41) =>
  entry.create(n, seed, 'medium', undefined, undefined, undefined, false, mode, length);
const saved = (g) => entry.isSavedGame(JSON.parse(JSON.stringify(g)));
const apply = (g, move, seat = 0) => {
  assert.ok(validMove(g, move, seat), `${g.phase}: ${JSON.stringify(move)}`);
  const next = play(g, move, seat, 1000);
  assert.notEqual(next, g);
  assert.ok(saved(next), `saved after ${JSON.stringify(move)}`);
  return next;
};
const refuse = (g, move, seat = 0) => {
  assert.equal(validMove(g, move, seat), false, JSON.stringify(move));
  assert.equal(play(g, move, seat, 1000), g);
};
/** One whole round with exactly these round scores (0, 150 or 300 each),
 * through real answers, locks, reveals and host picks. */
const round = (g, scores) => simulateTriviaLabRound(g, scores);
/** Each picker in turn takes the first find left on the mat. */
function draftFirst(g) {
  while (draftPicker(g) !== null) {
    const d = currentDraft(g);
    const find = d.offer.findIndex((_, i) => !d.picks.includes(i));
    g = apply(g, { type: 'trivia-pick', find }, draftPicker(g));
  }
  return g;
}
const find = (kind, size = 1) => ({ kind, size });

await test('placement blocks: first earns one per player, each place below one fewer, ties share the higher place', () => {
  assert.deepEqual(placementBlocks([300, 200, 100, 0]), [4, 3, 2, 1]);
  assert.deepEqual(placementBlocks([0, 100, 300, 200]), [1, 2, 4, 3]);
  // Two tied first of four get 4 each, the next 2; a tie for last shares 1.
  assert.deepEqual(placementBlocks([300, 300, 150, 0]), [4, 4, 2, 1]);
  assert.deepEqual(placementBlocks([300, 150, 150, 0]), [4, 3, 3, 1]);
  assert.deepEqual(placementBlocks([300, 150, 0, 0]), [4, 3, 2, 2]);
  assert.deepEqual(placementBlocks([90, 90, 90, 90]), [4, 4, 4, 4]);
  // Two players up to the six-seat maximum.
  assert.deepEqual(placementBlocks([10, 20]), [1, 2]);
  assert.deepEqual(placementBlocks([5, 5]), [2, 2]);
  assert.deepEqual(
    placementBlocks([300, 250, 200, 150, 100, 50]),
    [6, 5, 4, 3, 2, 1],
  );
  assert.deepEqual(
    placementBlocks([50, 300, 50, 300, 0, 120]),
    [3, 6, 3, 6, 1, 4],
  );
  for (let n = 2; n <= 6; n++) {
    const scores = Array.from({ length: n }, (_, s) => s * 10);
    const blocks = placementBlocks(scores);
    assert.equal(Math.max(...blocks), n, 'first place earns one per player');
    assert.equal(Math.min(...blocks), 1, 'last place still builds');
  }
});

await test('Tower builds by placement through real rounds and saves, with points only breaking ties', () => {
  let g = createTriviaLabGame('tower', 4);
  const rounds = [
    [300, 150, 150, 0],
    [0, 300, 150, 150],
    [150, 0, 300, 300],
    [300, 300, 300, 300],
  ];
  const expected = [
    [4, 3, 3, 1],
    [1, 4, 3, 3],
    [2, 1, 4, 4],
    [4, 4, 4, 4],
  ];
  const floors = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) {
    g = round(g, rounds[r]);
    const t = triviaOf(g);
    assert.deepEqual(t.rounds[r].blocks, expected[r]);
    expected[r].forEach((b, s) => (floors[s] += b));
    assert.deepEqual(
      t.players.map((p) => p.floors),
      floors,
    );
    assert.equal(play(g, { type: 'next' }, 0), g, 'blocks land once');
  }
  assert.deepEqual(floors, [11, 12, 14, 12]);
  assert.deepEqual(
    triviaOf(g).players.map((p) => p.victories),
    [2, 2, 2, 2],
  );
  assert.deepEqual(seatTotals(g), [750, 750, 900, 750]);
  assert.deepEqual(triviaWinners(g), [2]);
  assert.deepEqual(
    triviaStandings(g).map((p) => p.seat),
    [2, 1, 3, 0],
  );
  assert.deepEqual(g.vote.options, ['more', 'finish']);
  g = apply(g, { type: 'vote', choice: 'finish' });
  assert.ok(g.over);
  assert.match(entry.outcome(g).rows[0].value, /14 floors/);
  // Equal towers fall back on total points.
  let tie = createTriviaLabGame('tower', 3);
  tie = round(tie, [300, 0, 0]);
  tie = round(tie, [0, 150, 0]);
  assert.deepEqual(
    triviaOf(tie).players.map((p) => p.floors),
    [5, 5, 4],
  );
  assert.deepEqual(triviaWinners(tie), [0], 'more points win a height tie');
});

await test('Tower and Expedition last 4 or 8 rounds, each game once in every block of four', () => {
  for (const mode of ['tower', 'expedition']) {
    assert.throws(() => create(mode, 3, 6), /4 or 8/);
    assert.equal(triviaGameRoundLimit(create(mode)), 4);
    let g = create(mode, 3, 8);
    assert.equal(triviaOf(g).length, 8);
    assert.equal(triviaGameRoundLimit(g), 8);
    const order = ['year', 'order', 'miro', 'size', 'size', 'miro', 'order', 'year'];
    for (let r = 0; r < 8; r++) {
      g = draftFirst(g);
      for (const played of order.slice(r - (r % 4), r))
        refuse(g, { type: 'vote', choice: played });
      refuse(g, { type: 'vote', choice: 'finish' });
      refuse(g, { type: 'vote', choice: 'more' });
      g = apply(g, { type: 'vote', choice: order[r] });
      g = round(g, [300, 150, 0]);
      assert.equal(triviaOf(g).completed, r + 1);
      if (r === 3)
        assert.deepEqual(
          g.vote.options,
          sets.miro,
          'a new block of four offers every game again',
        );
    }
    g = draftFirst(g);
    assert.deepEqual(g.vote.options, ['more', 'finish']);
    const repeated = structuredClone(g);
    repeated.tribu.trivia.rounds[5].kind = 'order';
    assert.equal(saved(repeated), false, 'no repeat inside a block');
    g = apply(g, { type: 'vote', choice: 'finish' });
    assert.ok(g.over);
    assert.equal(entry.outcome(g).detail, '8 rounds');
  }
});

await test('4 more carries the same towers and finds on, up to twelve rounds, and only after the last round', () => {
  for (const mode of ['tower', 'expedition']) {
    let g = createTriviaLabGame(mode, 3);
    g = round(g, [300, 150, 0]);
    g = draftFirst(g);
    assert.equal(canExtendTrivia(g), false);
    refuse(g, { type: 'vote', choice: 'more' });
    for (let r = 1; r < 4; r++) g = draftFirst(round(g, [300, 150, 0]));
    if (mode === 'expedition') {
      // The fourth draft is done; reopen it to show 4 more waits for it.
      const open = structuredClone(g);
      const d = currentDraft(open);
      const undone = d.picks.splice(1);
      for (const i of undone)
        open.tribu.trivia.players[d.order[d.picks.length + undone.indexOf(i)]].finds.pop();
      assert.ok(saved(open));
      refuse(open, { type: 'vote', choice: 'more' });
    }
    const before = structuredClone(triviaOf(g));
    const key = decisionKey(g);
    g = apply(g, { type: 'vote', choice: 'more' });
    const t = triviaOf(g);
    assert.equal(t.length, 8);
    assert.notEqual(decisionKey(g), key);
    assert.deepEqual(t.players, before.players, 'nothing restarts');
    assert.deepEqual(t.rounds, before.rounds);
    assert.equal(g.round, 4);
    assert.equal(g.over, false);
    assert.deepEqual(g.vote.options, sets.miro);
    assert.ok(g.vote.host);
    for (let r = 4; r < 8; r++) g = draftFirst(round(g, [0, 150, 300]));
    assert.deepEqual(g.vote.options, ['more', 'finish']);
    g = apply(g, { type: 'vote', choice: 'more' });
    for (let r = 8; r < 12; r++) g = draftFirst(round(g, [0, 150, 300]));
    assert.equal(triviaOf(g).length, 12);
    assert.deepEqual(
      g.vote.options,
      ['finish'],
      'the party round limit ends it',
    );
    refuse(g, { type: 'vote', choice: 'more' });
    g = apply(g, { type: 'vote', choice: 'finish' });
    assert.ok(g.over);
    assert.equal(g.round, 12);
    if (mode === 'tower')
      assert.deepEqual(
        triviaOf(g).players.map((p) => p.floors),
        [3 * 4 + 1 * 8, 2 * 12, 1 * 4 + 3 * 8],
      );
    else
      assert.ok(triviaOf(g).players.every((p) => p.finds.length === 12));
  }
});

await test('draft order follows the round, then who is behind, then fewer points, then a turning seat', () => {
  assert.deepEqual(draftOrder([100, 300, 200], [0, 0, 0], [0, 0, 0], 1), [1, 2, 0]);
  // A tie on the round: the player behind on the expedition picks first.
  assert.deepEqual(draftOrder([300, 300, 0], [9, 4, 0], [0, 0, 0], 1), [1, 0, 2]);
  // Still tied: fewer total points first.
  assert.deepEqual(draftOrder([300, 300, 0], [4, 4, 0], [900, 600, 0], 1), [1, 0, 2]);
  // Still tied: seat order, starting one seat later each round.
  assert.deepEqual(draftOrder([5, 5, 5], [0, 0, 0], [0, 0, 0], 3), [0, 1, 2]);
  assert.deepEqual(draftOrder([5, 5, 5], [0, 0, 0], [0, 0, 0], 1), [1, 2, 0]);
  assert.deepEqual(draftOrder([5, 5, 5], [0, 0, 0], [0, 0, 0], 2), [2, 0, 1]);
});

await test('collections score 1, 3, 6, 10 a kind, a big find counting twice', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(triangle), [1, 3, 6, 10, 15, 21]);
  const finds = [
    find('gold'),
    find('gold'),
    find('fern', 2),
    find('crystal'),
  ];
  assert.deepEqual(findCounts(finds), [1, 0, 2, 2]);
  assert.equal(collectionScore(finds), 1 + 3 + 3);
  assert.equal(collectionScore([]), 0);
  assert.equal(findGain(finds, find('gold')), 3, 'a third gold is worth 3');
  assert.equal(findGain(finds, find('gold', 2)), 3 + 4);
  assert.equal(findGain(finds, find('fossil')), 1);
});

await test('the camp draft: one more find than players, one big, picked in placement order with denial', () => {
  let g = createTriviaLabGame('expedition', 4);
  g = round(g, [150, 300, 0, 150]);
  const d = currentDraft(g);
  assert.equal(d.offer.length, 5);
  assert.equal(d.offer.filter((f) => f.size === 2).length, 1);
  assert.deepEqual(d.order, [1, 3, 0, 2], 'ties on 150 go to the turning seat');
  assert.equal(campReady(g), false);
  assert.deepEqual(actingSeats(g), [1], 'the table waits for one picker');
  refuse(g, { type: 'vote', choice: 'size' });
  for (const seat of [0, 2, 3, -1, 9]) refuse(g, { type: 'trivia-pick', find: 0 }, seat);
  for (const bad of [-1, 5, 1.5, '0', null])
    refuse(g, { type: 'trivia-pick', find: bad }, 1);
  refuse(g, { type: 'trivia-pick', find: 0, extra: true }, 1);
  refuse(g, { type: 'trivia-pick' }, 1);
  // The winner takes the big find; nobody after can take it.
  const big = d.offer.findIndex((f) => f.size === 2);
  const keys = new Set([decisionKey(g)]);
  g = apply(g, { type: 'trivia-pick', find: big }, 1);
  keys.add(decisionKey(g));
  assert.deepEqual(triviaOf(g).players[1].finds, [d.offer[big]]);
  refuse(g, { type: 'trivia-pick', find: big }, 3);
  assert.deepEqual(actingSeats(g), [3]);
  const rest = d.offer.map((_, i) => i).filter((i) => i !== big);
  g = apply(g, { type: 'trivia-pick', find: rest[0] }, 3);
  keys.add(decisionKey(g));
  g = apply(g, { type: 'trivia-pick', find: rest[1] }, 0);
  keys.add(decisionKey(g));
  // Last place chooses between the last two; the other is lost.
  assert.equal(draftPicker(g), 2);
  refuse(g, { type: 'trivia-pick', find: rest[0] }, 2);
  g = apply(g, { type: 'trivia-pick', find: rest[3] }, 2);
  keys.add(decisionKey(g));
  assert.equal(keys.size, 5, 'every pick is its own decision');
  assert.ok(campReady(g));
  assert.deepEqual(actingSeats(g), []);
  assert.deepEqual(
    triviaOf(g).players.map((p) => p.finds.length),
    [1, 1, 1, 1],
  );
  assert.equal(
    triviaOf(g).players.flatMap((p) => p.finds).length,
    4,
    'the leftover find goes to nobody',
  );
  refuse(g, { type: 'trivia-pick', find: rest[2] }, 2);
  // Everyone sees the same public draft.
  for (const viewer of [0, 1, 2, 3, -1])
    assert.deepEqual(
      triviaOf(observe(g, viewer)).rounds[0].draft,
      triviaOf(g).rounds[0].draft,
    );
  g = apply(g, { type: 'vote', choice: 'size' });
  assert.equal(triviaOf(g).stage, 'challenge');
  assert.equal(currentDraft(g), null);
  refuse(g, { type: 'trivia-pick', find: rest[2] }, 2);
});

await test('rules 3 saves replay every block and pick, and refuse edited awards', () => {
  let tower = createTriviaLabGame('tower', 3);
  tower = round(tower, [300, 150, 0]);
  let exp = createTriviaLabGame('expedition', 3);
  exp = round(exp, [300, 150, 0]);
  exp = apply(exp, { type: 'trivia-pick', find: 0 }, 0);
  const done = draftFirst(round(draftFirst(exp), [0, 150, 300]));
  assert.ok(saved(tower) && saved(exp) && saved(done));
  const cases = [
    [tower, (t) => (t.rounds[0].blocks = [3, 3, 1])],
    [tower, (t) => (t.players[2].floors += 1)],
    [tower, (t) => (t.players[0].victories = 0)],
    [tower, (t) => delete t.length],
    [tower, (t) => (t.length = 6)],
    [tower, (t) => (t.length = 16)],
    [tower, (t) => (t.rules = 2)],
    [tower, (t) => (t.plans[0] = { route: 'trail', purchase: null })],
    [tower, (t) => (t.activeRoutes[1] = 'summit')],
    [tower, (t) => (t.stage = 'camp')],
    [exp, (t) => (t.stage = 'challenge')],
    [exp, (t) => t.players[1].finds.push({ kind: 'gold', size: 1 })],
    [exp, (t) => (t.rounds[0].draft.order = [1, 0, 2])],
    [exp, (t) => (t.rounds[0].draft.picks = [0, 0])],
    [exp, (t) => (t.rounds[0].draft.picks = [9])],
    [exp, (t) => t.rounds[0].draft.offer.forEach((f) => (f.size = 2))],
    [exp, (t) => t.rounds[0].draft.offer.forEach((f) => (f.size = 1))],
    [exp, (t) => (t.rounds[0].draft.offer[0].kind = 'diamond')],
    [exp, (t) => t.rounds[0].draft.offer.pop()],
    [exp, (t) => (t.rounds[0].draft.extra = true)],
    [exp, (t) => delete t.rounds[0].draft],
    [exp, (t) => (t.rounds[0].blocks = [3, 2, 1])],
    [done, (t) => t.rounds[0].draft.picks.pop()],
  ];
  for (const [g, mutate] of cases) {
    const bad = structuredClone(g);
    mutate(triviaOf(bad));
    assert.equal(saved(bad), false, mutate.toString());
  }
});

await test('rules 2 Tower saves keep their floor-per-100 scoring under the new engine', () => {
  const g = create('tower', 2);
  const t = triviaOf(g);
  t.rules = 2;
  delete t.length;
  assert.ok(saved(g));
  assert.equal(triviaGameRoundLimit(g), 4);
  let next = apply(g, { type: 'vote', choice: 'order' });
  for (let s = 0; s < 2; s++) {
    for (let step = 0; step < 3; step++)
      next = apply(next, { type: 'arrange', step, order: s ? [1, 0, 3, 2, 4] : [0, 1, 2, 3, 4] }, s);
    next = apply(next, { type: 'lock' }, s);
  }
  while (next.phase === 'reveal') next = apply(next, { type: 'next' });
  const after = triviaOf(next);
  assert.equal(after.rules, 2);
  assert.equal(after.rounds[0].blocks, undefined);
  // 300 points: 3 floors and the round win's 2; 150 points: 1 floor.
  assert.deepEqual(
    after.players.map((p) => p.floors),
    [5, 1],
  );
  assert.deepEqual(next.vote.options, remainingTriviaGames(next));
});

await test('picking for an away player takes the find that adds most to their collection, ties to the first', () => {
  let g = createTriviaLabGame('expedition', 3);
  g = round(g, [300, 150, 0]);
  g = draftFirst(g);
  g = round(g, [0, 150, 300]);
  const d = currentDraft(g),
    picker = draftPicker(g);
  const finds = triviaOf(g).players[picker].finds;
  const gains = d.offer.map((f) => findGain(finds, f));
  const best = gains.indexOf(Math.max(...gains));
  refuse(g, { type: 'trivia-pick-for', find: 0 }, 0);
  const keyBefore = decisionKey(g);
  g = apply(g, { type: 'trivia-pick-for' }, 0);
  assert.notEqual(decisionKey(g), keyBefore);
  assert.deepEqual(currentDraft(g).picks, [best]);
  assert.deepEqual(triviaOf(g).players[picker].finds.at(-1), d.offer[best]);
  assert.equal(triviaOf(g).players[0].finds.length, picker === 0 ? 2 : 1);
  g = draftFirst(g);
  refuse(g, { type: 'trivia-pick-for' }, 0);
});
