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
  legalMoves,
  habitats,
} from '../lib/games/trio/engine.ts';
import { moraMap } from '../lib/games/trio/mora-map.ts';
import { chooseMove, heuristic } from '../lib/games/trio/bot.ts';
const c = (kind, id = kind) => ({ kind, rank: 0, id });
const zones = (cards, at = 0) =>
  Array.from({ length: 6 }, (_, i) => (i === at ? cards : []));

await test('current habitat and food scoring matches the published rules', () => {
  assert.equal(zoneScore(zones([c(0), c(0)]), 0), 6);
  assert.equal(zoneScore(zones([c(0), c(1), c(2), c(3)], 1), 1), 0);
  assert.equal(zoneScore(zones([c(0), c(0), c(1), c(1)], 1), 1), 16);
  assert.equal(zoneScore(zones([c(0), c(0), c(1)], 1), 1), 7);
  // Root hollows hold two creatures; legacy overflow scores as two singles at most.
  assert.equal(zoneScore(zones([c(0), c(0), c(0)], 2), 2), 3);
  assert.equal(zoneScore(zones([c(0), c(0)], 2), 2), 9);
  assert.equal(zoneScore(zones([c(0), c(0), c(0)], 3), 3), 6);
  assert.equal(foodScore([c(0), c(0)], []), 7);
  assert.equal(foodScore([c(1), c(1), c(1), c(1)], []), 13);
  assert.equal(foodScore([c(2), c(2), c(2)], []), 9);
  assert.equal(foodScore([c(4)], [[c(4)]]), 5);
  assert.equal(foodScore([c(4)], []), 8);
  assert.equal(penalty({ id: 0, kind: 2, rank: 8 }, 2), 40);
});
await test('seeded matches terminate legally with conserved cards at every player count', () => {
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
            (id === 'undertow'
              ? g.seen.length
              : id === 'wildgrove'
                ? g.seen.filter(
                    (card) =>
                      !g.players.some((p) =>
                        p.zones.some((zone) =>
                          zone.some((placed) => placed.id === card.id),
                        ),
                      ),
                  ).length
                : 0);
          assert.equal(count, id === 'undertow' ? (n === 2 ? 25 : 50) : 72);
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
await test('observation conceals every other seat and server-private information', () => {
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
await test('all bot levels emit legal moves without access to hidden state', () => {
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
await test('pass validation and invalid actions leave the original game intact', () => {
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

await test('Deck-scaled exchanges preserve each hand and move the chosen cards to the neighbour', () => {
  for (const [seats, amount] of [
    [2, 3],
    [3, 4],
    [4, 3],
    [5, 3],
    [6, 2],
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
      g = play(g, { type: 'pass', cards: gifts[seat] }, seat);
    }
    assert.equal(g.phase, 'roll');
    for (let seat = 0; seat < seats; seat++) {
      assert.equal(g.players[seat].hand.length, handSize);
      for (const id of gifts[(seat + seats - 1) % seats])
        assert.ok(g.players[seat].hand.some((c) => c.id === id));
    }
  }
});

await test('an older partially confirmed pass retains three cards in both private and public views', () => {
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
  assert.ok(g.players.every((p) => p.hand.length === 12));
});

await test('shields expansion is opt-in and tokens cannot be smuggled into base moves', () => {
  const base = createGame('undertow');
  base.phase = 'play';
  assert.equal(base.shields, false);
  assert.ok(base.players.every((p) => p.wards === 0 && p.salvageClaims === 0));
  const card = base.players[0].hand[0].id;
  assert.equal(validMove(base, { type: 'play', card, ward: true }), false);
  assert.equal(validMove(base, { type: 'play', card, tack: true }), false);
  const extra = createGame('undertow', 'medium', 1, false, 3, true);
  assert.ok(extra.players.every((p) => p.wards === 2 && p.salvageClaims === 0));
  extra.phase = 'play';
  assert.equal(
    validMove(extra, {
      type: 'play',
      card: extra.players[0].hand[0].id,
      tack: true,
      ward: true,
    }),
    false,
  );
  assert.ok(isSavedGame(extra));
});

await test('removed Tack cannot bypass follow-suit or be smuggled into a legal move', () => {
  let g = createGame('undertow', 'medium', 1, false, 3, true);
  g.phase = 'play';
  g.active = 0;
  g.players[0].hand = [
    { id: 100, kind: 0, rank: 10 },
    { id: 101, kind: 2, rank: 1 },
  ];
  g.players[1].hand = [
    { id: 102, kind: 0, rank: 8 },
    { id: 103, kind: 4, rank: 5 },
  ];
  g = play(g, { type: 'play', card: 100 });
  assert.equal(validMove(g, { type: 'play', card: 103, tack: true }), false);
  assert.equal(validMove(g, { type: 'play', card: 102, tack: true }), false);
  assert.equal(validMove(g, { type: 'play', card: 102 }), true);
});

await test('Grove has six scoring areas and zero-point release available on every die face', () => {
  let g = createGame('wildgrove');
  assert.equal(g.players[0].zones.length, 7);
  assert.equal(zoneScore(zones([c(0), c(1), c(2)], 5), 5), 0);
  const board = Array.from({ length: 7 }, () => []);
  board[6] = [c(0)];
  assert.equal(zoneScore(board, 6), 0);
  board[6].push(c(1));
  assert.equal(zoneScore(board, 6), 0);
  g.roller = 1;
  for (let face = 0; face < 6; face++) {
    g.die = face;
    assert.equal(allowedZone(g, 0, c(0), 5), true);
  }
  const invalid = structuredClone(g);
  invalid.players.forEach((p) => p.zones.pop());
  assert.equal(isSavedGame(invalid), false);
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

await test('simultaneous draft choices stay private, resolve together, and survive saves', () => {
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

await test('Tide exchanges can arrive out of order and only reveal together', () => {
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
    validMove(g, { type: 'roll' }, (g.roller + 1) % g.players.length),
    false,
    'die rolls remain turn-based',
  );
});

await test('saved simultaneous choices reject malformed or mismatched pending moves', () => {
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

await test('Tide clears the previous trick and penalty suit before the next pass', () => {
  let g = createGame('undertow', 'medium', 37, false, 4);
  let steps = 0;
  let before;
  while (g.round === 1) {
    before = g;
    g = play(g, chooseMove(observe(g), 'medium'));
    assert.ok(++steps < 300);
  }
  assert.equal(g.phase, 'pass');
  assert.equal(g.hazard, -1);
  assert.deepEqual(g.trick, []);
  assert.deepEqual(g.lastTrick, []);
  const reveal = g.events.findLast((event) => event.type === 'trick');
  assert.equal(reveal.trick.length, 4);
  assert.deepEqual(reveal.trick.slice(0, 3), before.trick);
  assert.deepEqual(reveal.trick[3].card, before.players[before.active].hand[0]);
  assert.equal(reveal.hazard, before.hazard);
  for (let kind = 0; kind < 4; kind++)
    assert.equal(penalty({ id: kind, kind, rank: 9 }, g.hazard), 0);
  assert.ok(isSavedGame(g));
});

await test('Mora release removes creatures and completes a simultaneous pick without scoring', () => {
  let g = play(createGame('wildgrove'), { type: 'roll' });
  const handSize = g.players[0].hand.length;
  const released = g.players.map((p) => p.hand[0].id);
  for (let seat = 0; seat < g.players.length; seat++) {
    const move = { type: 'play', card: released[seat], zone: 5 };
    assert.ok(validMove(g, move, seat));
    g = play(g, move, seat);
  }
  assert.equal(g.pick, 2);
  assert.equal(g.phase, 'roll');
  assert.ok(g.players.every((p) => p.hand.length === handSize - 1));
  assert.ok(g.players.every((p) => p.zones.flat().length === 0));
  assert.deepEqual(
    scores(g),
    g.players.map(() => 0),
  );
  assert.ok(released.every((id) => g.seen.some((card) => card.id === id)));
  assert.ok(isSavedGame(g));
});

await test('Mora herd retains its scoring and legacy trash cannot block discarding', () => {
  assert.equal(zoneScore(zones([c(0), c(0), c(0), c(0)], 0), 0), 17);
  const g = createGame('wildgrove');
  g.players[0].zones[5] = Array.from({ length: 12 }, (_, i) => c(0, 100 + i));
  assert.ok(allowedZone(g, 0, c(0), 5));
});

await test('Mora Glasshouse trail rewards a matching pair and a different guest', () => {
  for (const [kinds, expected] of [
    [[], 0],
    [[0], 2],
    [[0, 0], 4],
    [[0, 1], 4],
    [[0, 0, 0], 6],
    [[0, 0, 1], 10],
    [[0, 1, 0], 10],
    [[0, 1, 2], 6],
  ]) {
    assert.equal(
      zoneScore(
        zones(
          kinds.map((kind) => c(kind)),
          3,
        ),
        3,
      ),
      expected,
    );
  }
});

await test('Mora Dry channel counts different species here, nothing elsewhere', () => {
  const board = Array.from({ length: 7 }, () => []);
  board[3] = [c(0), c(1)];
  board[4] = [c(0), c(0), c(2)];
  board[5] = [c(2)];
  assert.equal(zoneScore(board, 4), 4);
  board[0] = [c(2)];
  assert.equal(zoneScore(board, 4), 4);
  board[4] = [c(0), c(1), c(2)];
  assert.equal(zoneScore(board, 4), 10);
  board[4] = [c(0)];
  assert.equal(zoneScore(board, 4), 1);
});

await test('Mora lookout counts habitats with its resident species, excluding trash and itself', () => {
  const board = Array.from({ length: 7 }, () => []);
  board[6] = [c(0)];
  board[5] = [c(0)];
  board[0] = [c(1)];
  assert.equal(zoneScore(board, 6), 0);
  for (let area = 0; area < 5; area++) {
    board[area] = [c(0), c(0)];
    assert.equal(zoneScore(board, 6), (area + 1) * 2);
  }
  board[6] = [c(1)];
  assert.equal(
    zoneScore(board, 6),
    0,
    'changing the resident changes the score',
  );
  board[3].push(c(1));
  assert.equal(zoneScore(board, 6), 2);
  board[6].push(c(0));
  assert.equal(
    zoneScore(board, 6),
    2,
    'legacy overflow does not add extra lookout species',
  );
  board[6] = [];
  assert.equal(zoneScore(board, 6), 0);
});

await test('Mora bot values trail completion and avoids breaking a scoring pair on the last pick', () => {
  const g = createGame('wildgrove');
  g.phase = 'play';
  g.round = 2;
  g.pick = 6;
  g.roller = g.active = 0;
  g.players[0].zones[2] = [c(0, 101), c(0, 102)];
  g.players[0].zones[3] = [c(1, 103), c(0, 104)];
  g.players[0].hand = [c(1, 105)];
  const complete = { type: 'play', card: 105, zone: 3 };
  // A second matching creature lifts the trail from 4 to 10 points.
  assert.equal(heuristic(g, complete), 6);
  assert.deepEqual(chooseMove(observe(g), 'medium'), complete);
  g.players[0].hand = [c(0, 105)];
  assert.equal(validMove(g, { type: 'play', card: 105, zone: 2 }), false);
});

await test('Mora hard bot chooses a best final scoring move with the revised rules', () => {
  let g = createGame('wildgrove', 'medium', 19, false, 3);
  while (!(g.round === 2 && g.pick === 6 && g.phase === 'play')) {
    g = play(g, chooseMove(observe(g), 'medium'));
  }
  const observation = observe(g);
  const move = chooseMove(observation, 'hard', 1234, 2, 0);
  assert.ok(validMove(g, move));
  const bestValue = Math.max(
    ...legalMoves(observation).map((candidate) =>
      heuristic(observation, candidate),
    ),
  );
  assert.equal(heuristic(observation, move), bestValue);
});

await test('Mora sanctuary capacities include a single lookout and a two-creature hollow', () => {
  const g = createGame('wildgrove');
  g.roller = 0; // Test capacity independently from the randomized roller and die.
  for (const [zone, cap] of [
    [0, 4],
    [1, 4],
    [2, 2],
    [3, 3],
    [4, 3],
    [6, 1],
  ]) {
    g.players[0].zones[zone] = Array.from({ length: cap - 1 }, (_, i) =>
      c(0, 200 + i),
    );
    assert.equal(allowedZone(g, 0, c(1), zone), true);
    g.players[0].zones[zone].push(c(1, 210));
    assert.equal(allowedZone(g, 0, c(1), zone), false);
  }
});

await test('Mora painted spaces match every playable capacity and lie within their drop targets', () => {
  assert.equal(
    moraMap.habitats.reduce((n, art) => n + art.slots.length, 0),
    17,
  );
  for (const art of moraMap.habitats) {
    assert.equal(art.slots.length, habitats[art.zone].cap);
    const [left, top, width, height] = art.bounds;
    for (const [x, y] of art.slots) {
      assert.ok(
        x >= left && x <= left + width && y >= top && y <= top + height,
      );
    }
  }
});

await test('Elsewild rejects saves exceeding the current habitat capacities', () => {
  const g = createGame('wildgrove');
  g.players[0].zones[2] = [c(0, 500), c(0, 501), c(1, 502), c(1, 503)];
  g.players[0].zones[6] = [c(0, 504), c(1, 505), c(2, 506)];
  assert.equal(isSavedGame(g), false);
  assert.equal(allowedZone(g, 0, c(0), 2), false);
  assert.equal(allowedZone(g, 0, c(0), 6), false);
});
