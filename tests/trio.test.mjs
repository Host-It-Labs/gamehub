import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  play,
  validMove,
  passCount,
  scores,
  zoneScore,
  foodScore,
  observe,
  isSavedGame,
  penalty,
  allowedZone,
  dice,
  legalMoves,
} from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';
const c = (kind, id = kind) => ({ kind, rank: 0, id });
const zones = (cards, at = 0) =>
  Array.from({ length: 6 }, (_, i) => (i === at ? cards : []));

test('current habitat and food scoring matches the published rules', () => {
  assert.equal(zoneScore(zones([c(0), c(0)]), 0), 3);
  assert.equal(zoneScore(zones([c(0), c(1), c(2), c(3)], 1), 1), 16);
  assert.equal(zoneScore(zones([c(0), c(0), c(0)], 2), 2), 0);
  assert.equal(zoneScore(zones([c(0), c(0), c(1), c(1)], 2), 2), 14);
  assert.equal(zoneScore(zones([c(0), c(1), c(2)], 3), 3), 15);
  assert.equal(foodScore([c(0), c(0)], []), 7);
  assert.equal(foodScore([c(1), c(1), c(1), c(1)], []), 13);
  assert.equal(foodScore([c(2), c(2), c(2)], []), 9);
  assert.equal(foodScore([c(4)], [[c(4)]]), 5);
  assert.equal(foodScore([c(4)], []), 8);
  assert.equal(penalty({ id: 0, kind: 2, rank: 9 }, 2), 40);
});
test('seeded matches terminate legally with conserved cards at every player count', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (let n = 2; n <= 6; n++)
      for (let seed = 1; seed <= 8; seed++) {
        let g = createGame(id, 'medium', seed, false, n),
          steps = 0;
        assert.deepEqual(g, createGame(id, 'medium', seed, false, n));
        while (g.phase !== 'over') {
          assert.ok(isSavedGame(g), `${id}/${n}/${seed}/${steps}: valid save`);
          const count =
            g.reserve.length +
            g.players.reduce(
              (a, p) => a + p.hand.length + p.zones.flat().length,
              0,
            ) +
            (id === 'undertow' ? g.seen.length : 0);
          assert.equal(count, id === 'undertow' ? 60 : 72);
          const move = chooseMove(observe(g), 'medium');
          assert.ok(validMove(g, move));
          const previous = JSON.stringify(g);
          const next = play(g, move);
          assert.equal(JSON.stringify(g), previous);
          assert.equal(next.revision, g.revision + 1);
          g = next;
          assert.ok(++steps < 1500);
        }
        assert.ok(isSavedGame(g));
        assert.ok(scores(g).every(Number.isFinite));
      }
});
test('observation conceals every other seat and server-private information', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (let n = 2; n <= 6; n++) {
      const g = createGame(id, 'medium', 37, false, n);
      for (let viewer = 0; viewer < n; viewer++) {
        const view = observe(g, viewer);
        for (const key of [
          'rngState',
          'reserve',
          'passes',
          'memory',
          'pending',
        ])
          assert.equal(key in view, false);
        for (let i = 0; i < n; i++)
          if (i === viewer)
            assert.deepEqual(view.players[i].hand, g.players[i].hand);
          else
            assert.ok(
              view.players[i].hand.every(
                (c) => c.kind === -1 && c.rank === -1 && c.id < 0,
              ),
            );
      }
    }
});
test('all bot levels emit legal moves without access to hidden state', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (const difficulty of ['easy', 'medium', 'hard']) {
      let g = createGame(id, difficulty, 97, false, 3);
      for (let i = 0; i < 5; i++) {
        const move = chooseMove(observe(g), difficulty, 5, 3, 50);
        assert.ok(validMove(g, move));
        g = play(g, move);
      }
    }
});
test('pass validation and invalid actions leave the original game intact', () => {
  const g = createGame('undertow');
  const card = g.players[0].hand[0].id;
  assert.equal(
    validMove(g, { type: 'pass', cards: [card, card, card] }),
    false,
  );
  assert.equal(play(g, { type: 'play', card: -999 }), g);
  const passed = play(g, {
    type: 'pass',
    cards: g.players[0].hand.slice(0, passCount(g)).map((c) => c.id),
  });
  assert.equal(passed.active, 1);
  assert.equal(g.active, 0);
});

test('Papayoo-sized exchanges preserve each hand and move the chosen cards to the neighbour', () => {
  for (const [seats, amount] of [
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 4],
    [6, 3],
  ]) {
    let g = createGame('undertow', 'medium', 719, false, seats);
    assert.equal(passCount(g), amount);
    const handSize = g.players[0].hand.length;
    const gifts = g.players.map((p) =>
      p.hand.slice(0, amount).map((c) => c.id),
    );
    for (let seat = 0; seat < seats; seat++) {
      assert.equal(
        validMove(g, { type: 'pass', cards: gifts[seat].slice(1) }),
        false,
      );
      g = play(g, { type: 'pass', cards: gifts[seat] });
    }
    assert.equal(g.phase, 'roll');
    for (let seat = 0; seat < seats; seat++) {
      assert.equal(g.players[seat].hand.length, handSize);
      for (const id of gifts[(seat + seats - 1) % seats])
        assert.ok(g.players[seat].hand.some((c) => c.id === id));
    }
  }
});

test('an older partially confirmed pass retains three cards in both private and public views', () => {
  let g = createGame('undertow', 'medium', 182, false, 4);
  delete g.passCards;
  g.passes[0] = g.players[0].hand.slice(0, 3).map((c) => c.id);
  g.active = 1;
  while (g.phase === 'pass') {
    assert.equal(passCount(g), 3);
    const publicView = observe(g);
    assert.equal(passCount(publicView), 3);
    const move = chooseMove(publicView, 'easy');
    assert.equal(move.cards.length, 3);
    g = play(g, move);
  }
  assert.ok(g.players.every((p) => p.hand.length === 15));
});

test('starter expansion is opt-in and tokens cannot be smuggled into base moves', () => {
  const base = createGame('undertow');
  base.phase = 'play';
  assert.equal(base.starter, false);
  assert.ok(base.players.every((p) => p.wards === 0 && p.calms === 0));
  const card = base.players[0].hand[0].id;
  assert.equal(validMove(base, { type: 'play', card, ward: true }), false);
  assert.equal(validMove(base, { type: 'play', card, calm: true }), false);
  const extra = createGame('undertow', 'medium', 1, false, 3, true);
  assert.ok(extra.players.every((p) => p.wards === 2 && p.calms === 1));
  extra.phase = 'play';
  assert.ok(
    validMove(extra, {
      type: 'play',
      card: extra.players[0].hand[0].id,
      calm: true,
      ward: true,
    }),
  );
  assert.ok(isSavedGame(extra));
});

test('Calm cancels only the highest Storm before shields, and is spent on a loss', () => {
  const setup = (rank = 12) => {
    const g = createGame('undertow', 'medium', 1, false, 3, true);
    g.phase = 'play';
    g.hazard = 0;
    g.active = 0;
    g.players[0].hand = [
      { id: 100, kind: 0, rank },
      { id: 101, kind: 2, rank: 1 },
    ];
    g.players[1].hand = [
      { id: 102, kind: 0, rank: 9 },
      { id: 103, kind: 2, rank: 2 },
    ];
    g.players[2].hand = [
      { id: 104, kind: 4, rank: 8 },
      { id: 105, kind: 2, rank: 3 },
    ];
    return g;
  };
  let g = play(setup(), { type: 'play', card: 100, calm: true, ward: true });
  g = play(g, { type: 'play', card: 102 });
  g = play(g, { type: 'play', card: 104 });
  assert.equal(g.players[0].score, 20);
  assert.equal(g.players[0].calms, 0);
  assert.equal(g.players[0].wards, 1);
  assert.equal(validMove(g, { type: 'play', card: 101, calm: true }), false);
  let loss = play(setup(1), { type: 'play', card: 100, calm: true });
  loss = play(loss, { type: 'play', card: 102 });
  loss = play(loss, { type: 'play', card: 104 });
  assert.equal(loss.players[0].calms, 0);
  assert.equal(loss.players[1].score, 48);
});

test('Grove has distinct herd, odd-count, and exclusive-species choices', () => {
  assert.equal(zoneScore(zones([c(0), c(0), c(0), c(1)]), 0), 6);
  assert.equal(zoneScore(zones([c(0), c(0)], 4), 4), 0);
  assert.equal(zoneScore(zones([c(0), c(0), c(0)], 4), 4), 4);
  const board = zones([c(0), c(1)], 3);
  assert.equal(zoneScore(board, 3), 10);
  board[5].push(c(0));
  assert.equal(zoneScore(board, 3), 5);
});

test('expanded bot matches finish and refresh tokens on each deal', () => {
  let g = createGame('undertow', 'medium', 31, false, 3, true),
    steps = 0;
  while (g.phase !== 'over') {
    const round = g.round;
    g = play(g, chooseMove(observe(g), 'medium'));
    assert.ok(isSavedGame(g));
    if (round !== g.round)
      assert.ok(g.players.every((p) => p.wards === 2 && p.calms === 1));
    assert.ok(++steps < 500);
  }
});

test('placement die maps directly to board rows and columns', () => {
  const g = createGame('wildgrove');
  g.roller = 1;
  for (const [face, expected] of [
    [0, [0, 1, 2]],
    [1, [3, 4, 6]],
    [2, [0, 1, 3, 4]],
    [3, [1, 2, 4, 6]],
  ]) {
    g.die = face;
    assert.deepEqual(dice[face].zones, expected);
    assert.deepEqual(
      [0, 1, 2, 3, 4, 6].filter((z) => allowedZone(g, 0, c(0), z)),
      expected,
    );
  }
  g.players[0].zones[0] = [c(0)];
  g.die = 4;
  assert.equal(allowedZone(g, 0, c(1), 0), false);
  g.die = 5;
  assert.equal(allowedZone(g, 0, c(1), 0), true);
  assert.equal(allowedZone(g, 0, c(0), 0), false);
});

test('Grove has six scoring areas and a one-point overflow available on every die face', () => {
  let g = createGame('wildgrove');
  assert.equal(g.players[0].zones.length, 7);
  assert.equal(zoneScore(zones([c(0), c(1), c(2)], 5), 5), 3);
  const board = Array.from({ length: 7 }, () => []);
  board[6] = [c(0)];
  assert.equal(zoneScore(board, 6), 8);
  board[6].push(c(1));
  assert.equal(zoneScore(board, 6), 0);
  g.roller = 1;
  for (let face = 0; face < 6; face++) {
    g.die = face;
    assert.equal(allowedZone(g, 0, c(0), 5), true);
  }
  // A six-zone save remains playable and gains the extra area on its next move.
  g.players.forEach((p) => p.zones.pop());
  assert.equal(isSavedGame(g), true);
  g.roller = g.active;
  g = play(g, { type: 'roll' });
  assert.equal(g.players[0].zones.length, 7);
  const move = legalMoves(g).find((m) => m.zone === 6);
  assert.ok(move);
  let next = play(g, move);
  assert.equal(
    next.players[g.active].zones[6].length,
    0,
    'placement stays private until every choice is ready',
  );
  while (next.pick === g.pick && next.phase === 'play')
    next = play(next, legalMoves(next)[0]);
  assert.equal(next.players[g.active].zones[6].length, 1);
  assert.equal(isSavedGame(next), true);
});

test('simultaneous draft choices stay private, resolve together, and survive saves', () => {
  for (const id of ['wildgrove', 'midnight']) {
    let g = createGame(id, 'easy', 925, false, 3);
    if (g.phase === 'roll') g = play(g, { type: 'roll' });
    const original = structuredClone(g);
    for (const actor of [2, 0, 1]) {
      const move = legalMoves({ ...g, active: actor })[0];
      const revision = g.revision;
      g = play(g, move, actor);
      assert.equal(g.revision, revision + 1);
      assert.equal(isSavedGame(g), true);
      assert.ok(!('pending' in observe(g, 0)));
      if (actor !== 1) {
        assert.deepEqual(
          g.players,
          original.players,
          'no early reveal or packet rotation',
        );
        assert.equal(
          validMove(g, move, actor),
          false,
          'a seat cannot submit twice',
        );
        g = JSON.parse(JSON.stringify(g));
      }
    }
    assert.equal(g.pick, original.pick + 1);
    g.players.forEach((p, i) =>
      assert.equal(p.hand.length, original.players[i].hand.length - 1),
    );
    assert.equal(g.pending, undefined);
  }
});

test('Tide exchanges can arrive out of order and only reveal together', () => {
  let g = createGame('undertow', 'easy', 771, false, 3);
  const original = structuredClone(g.players);
  for (const actor of [2, 0, 1]) {
    const cards = g.players[actor].hand.slice(0, passCount(g)).map((c) => c.id);
    g = play(g, { type: 'pass', cards }, actor);
    if (actor !== 1) {
      assert.deepEqual(g.players, original);
      assert.equal(g.phase, 'pass');
      assert.ok(!('pending' in observe(g, 1)));
    }
  }
  assert.equal(g.phase, 'roll');
  assert.notDeepEqual(g.players[0].hand, original[0].hand);
  assert.equal(
    validMove(g, { type: 'roll' }, 1),
    false,
    'die rolls remain turn-based',
  );
});

test('saved simultaneous choices reject malformed or mismatched pending moves', () => {
  const initial = createGame('midnight', 'easy', 932, false, 3);
  const g = play(initial, legalMoves({ ...initial, active: 2 })[0], 2);
  for (const mutate of [
    (s) => {
      s.ready = [false];
    },
    (s) => {
      s.pending = null;
    },
    (s) => {
      s.ready[2] = false;
    },
    (s) => {
      s.pending[2].card = -100;
    },
    (s) => {
      s.pending[2] = null;
    },
    (s) => {
      s.phase = 'roll';
    },
  ]) {
    const broken = structuredClone(g);
    mutate(broken);
    assert.equal(isSavedGame(broken), false);
  }
});
