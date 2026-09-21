import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actingSeats,
  botMove,
  outcome,
  play,
  progress,
  validMove,
  worldGames,
  worldIds,
} from '../lib/games/worlds/registry.ts';
import * as coast from '../lib/games/worlds/orin.ts';
import * as meadow from '../lib/games/worlds/vela.ts';
import * as canal from '../lib/games/worlds/miro.ts';
import { worldLibraryGames } from '../lib/games/library-fixtures.ts';

/** Plays a whole match with bots, whatever shape the turn order takes. */
function finish(g, skill) {
  let guard = 0;
  while (!g.over) {
    assert.ok(guard++ < 3000, `${g.kind} finishes`);
    const waiting = actingSeats(g);
    assert.ok(waiting.length, `${g.kind} is always waiting on somebody`);
    let moved = false;
    for (const seat of waiting) {
      if (g.over) break;
      const view = skill ? { ...g, difficulty: skill(seat, g) } : g;
      const move = botMove(view, seat);
      if (!move) continue;
      const next = play(g, move, seat);
      if (next !== g) {
        g = next;
        moved = true;
      }
    }
    assert.ok(moved, `${g.kind} always has a move for somebody`);
  }
  return g;
}

const rate = (runs, predicate) => runs.filter(predicate).length / runs.length;

await test('every world plays through at every table size it offers', () => {
  for (const id of worldIds) {
    const entry = worldGames[id];
    assert.equal(entry.id, id, 'an entry knows its own id');
    assert.ok(entry.seatChoices.length, `${id} offers a table size`);
    assert.ok(
      entry.seatChoices.includes(entry.defaultSeats),
      `${id} defaults to a size it offers`,
    );
    for (const seats of entry.seatChoices) {
      const done = finish(entry.create(seats, seats * 977 + 5, 'medium'));
      assert.equal(done.over, true, `${id} at ${seats} ends`);
      const result = outcome(done);
      assert.ok(result.title.length, `${id} has a headline`);
      assert.ok(Array.isArray(result.winners), `${id} names its winners`);
      assert.ok(progress(done).label.length, `${id} reports progress`);
      assert.ok(
        entry.isSavedGame(JSON.parse(JSON.stringify(done))),
        `${id} survives a save round trip`,
      );
    }
  }
});

await test('a saved world match must match the rules it was saved from', () => {
  for (const id of worldIds) {
    const entry = worldGames[id];
    const g = entry.create(entry.defaultSeats, 424242, 'medium');
    assert.ok(entry.isSavedGame(JSON.parse(JSON.stringify(g))));
    for (const broken of [
      { ...g, rules: 2 },
      { ...g, version: 2 },
      { ...g, kind: 'somewhere-else' },
      { ...g, seats: [] },
      { ...g, rngState: -1 },
      { ...g, difficulty: 'impossible' },
      { ...g, log: [{ id: 0 }] },
    ])
      assert.equal(
        entry.isSavedGame(broken),
        false,
        `${id} rejects a save it cannot trust`,
      );
    for (const other of worldIds)
      if (other !== id)
        assert.equal(
          worldGames[other].isSavedGame(g),
          false,
          `${other} rejects a ${id} save`,
        );
  }
});

await test('Orin: a careful watch holds the coast and a careless one loses it', () => {
  const held = (seats, difficulty) => {
    const runs = [];
    for (let i = 0; i < 260; i++)
      runs.push(finish(coast.createGame(seats, i * 7919 + 13, difficulty)));
    return rate(runs, (g) => g.held === true);
  };
  for (const seats of coast.seatChoices) {
    const careless = held(seats, 'easy'),
      skilled = held(seats, 'hard');
    // Measured, not guessed. In a cooperative game bot difficulty is bot skill,
    // so a careless crew makes Orin harder rather than easier.
    assert.ok(
      skilled >= 0.72 && skilled <= 0.95,
      `a skilled watch at ${seats} holds ${(skilled * 100).toFixed(0)}%`,
    );
    assert.ok(
      careless >= 0.12 && careless <= 0.45,
      `a careless watch at ${seats} holds ${(careless * 100).toFixed(0)}%`,
    );
    assert.ok(skilled > careless + 0.25, `skill decides the coast at ${seats}`);
  }
});

await test('Orin: hands are private and the bell is the only word', () => {
  const g = coast.createGame(3, 9001, 'medium');
  const view = coast.observe(g, 0);
  assert.deepEqual(view.hands[0], g.hands[0], 'you see your own tools');
  for (const seat of [1, 2])
    assert.ok(
      view.hands[seat].every((c) => c < 0),
      'another keeperholds their tools face down',
    );
  assert.ok(
    view.deck.every((c) => c < 0),
    'the issue deck is not readable',
  );
  // A hidden card cannot be played, so an observed state cannot leak a move.
  assert.equal(
    coast.validMove(view, { type: 'tool', slot: 0, station: 0 }, 1),
    false,
  );
  const rung = coast.play(g, { type: 'bell', station: 4 }, 0);
  assert.equal(rung.signals[0], 4, 'the bell marks a station');
  assert.equal(rung.turns, g.turns, 'ringing is not a turn');
  assert.equal(
    coast.validMove(rung, { type: 'bell', station: 2 }, 0),
    false,
    'one bell each, and it is spent',
  );
});

await test('Orin: a watch is four turns whatever the crew size', () => {
  for (const seats of coast.seatChoices) {
    let g = coast.createGame(seats, 31337, 'hard');
    const watch = g.watch;
    let turns = 0;
    while (g.watch === watch && !g.over) {
      g = coast.play(g, { type: 'stand' }, g.actor);
      turns++;
      assert.ok(turns <= coast.TURNS, 'a watch never runs long');
    }
    assert.equal(turns, coast.TURNS, `${seats} keepers still stand four turns`);
  }
});

await test('Vela: the meadow is level between the colours and rarely a draw', () => {
  for (const seats of meadow.seatChoices) {
    const runs = [];
    for (let i = 0; i < 400; i++)
      runs.push(finish(meadow.createGame(seats, i * 7919 + 101, 'hard')));
    const vermilion = rate(runs, (g) => g.winner === 0),
      saffron = rate(runs, (g) => g.winner === 1),
      level = rate(runs, (g) => g.winner === -1);
    assert.ok(
      Math.abs(vermilion - saffron) < 0.12,
      `the colours are within a few points at ${seats}: ${(vermilion * 100).toFixed(0)}/${(saffron * 100).toFixed(0)}`,
    );
    assert.ok(
      level < 0.04,
      `a level meadow is rare at ${seats}: ${(level * 100).toFixed(1)}%`,
    );
  }
});

await test('Vela: teams are always even and a face-down card stays down', () => {
  const trimmed = meadow.createGame(5, 77, 'medium');
  assert.equal(
    trimmed.seats.length,
    4,
    'an odd table is trimmed, not lopsided',
  );
  assert.equal(
    trimmed.teams.filter((t) => t === 0).length,
    trimmed.teams.filter((t) => t === 1).length,
    'the two teams are the same size',
  );
  let g = meadow.createGame(4, 4242, 'medium');
  g = meadow.play(g, { type: 'commit', slot: 0 }, 0);
  const teammate = g.teams.findIndex((t, s) => s !== 0 && t === g.teams[0]);
  const view = meadow.observe(g, teammate);
  assert.equal(
    view.commits[0],
    -2,
    'a teammate sees only that you have chosen',
  );
  assert.ok(
    view.hands[0].every((c) => c < 0),
    'a teammate cannot read your hand',
  );
  assert.equal(
    meadow.observe(g, 0).commits[0],
    g.commits[0],
    'you can see what you committed',
  );
  const back = meadow.play(g, { type: 'withdraw' }, 0);
  assert.equal(
    back.commits[0],
    -1,
    'nothing has turned over, so it can come back',
  );
  assert.equal(
    back.hands[0].length,
    meadow.HAND,
    'the card returns to the hand',
  );
});

await test('Miro: the merchants take between half and four fifths of the seasons', () => {
  for (const seats of canal.seatChoices) {
    const runs = [];
    for (let i = 0; i < 400; i++)
      runs.push(finish(canal.createGame(seats, i * 7919 + 55, 'hard')));
    const merchants = rate(runs, (g) => g.winner === 0);
    assert.ok(
      merchants >= 0.5 && merchants <= 0.8,
      `merchants take ${(merchants * 100).toFixed(0)}% at ${seats}`,
    );
    const careless = [];
    for (let i = 0; i < 300; i++)
      careless.push(finish(canal.createGame(seats, i * 7919 + 55, 'easy')));
    assert.ok(
      rate(careless, (g) => g.winner === 0) < merchants,
      `a careless quay at ${seats} is caught out more often`,
    );
  }
});

await test('Miro: only the smuggler carries rot, and only they know', () => {
  let g = canal.createGame(5, 2468, 'medium');
  const merchant = g.seats.findIndex((_, s) => s !== g.smuggler);
  assert.equal(
    canal.observe(g, merchant).smuggler,
    -1,
    'a merchant is not told who it is',
  );
  assert.equal(
    canal.observe(g, g.smuggler).smuggler,
    g.smuggler,
    'the smuggler knows themselves',
  );
  // Get one crew aboard so there is a hold to load.
  while (g.phase !== 'load') {
    for (const seat of canal.actingSeats(g)) {
      const m = canal.botMove(g, seat);
      if (m) g = canal.play(g, m, seat);
    }
  }
  for (const seat of g.crew) {
    assert.equal(
      canal.validMove(g, { type: 'load', rot: true }, seat),
      seat === g.smuggler,
      'rot is the smuggler’s alone',
    );
    assert.equal(
      canal.validMove(g, { type: 'load', rot: false }, seat),
      true,
      'anyone aboard may load clean',
    );
  }
  const ashore = g.seats.findIndex((_, s) => !g.crew.includes(s));
  if (ashore >= 0)
    assert.equal(
      canal.validMove(g, { type: 'load', rot: false }, ashore),
      false,
      'a trader ashore loads nothing',
    );
});

await test('Miro: the pilot is always aboard their own run', () => {
  for (const seats of canal.seatChoices) {
    let g = canal.createGame(seats, seats * 31 + 7, 'hard');
    let guard = 0;
    while (!g.over && guard++ < 400) {
      if (g.phase === 'crew') {
        for (const m of canal.legalMoves(g, g.pilot))
          if (m.type === 'crew')
            assert.ok(
              m.seats.includes(g.pilot),
              'no crew the pilot could send leaves them ashore',
            );
      }
      if (g.phase === 'approve' || g.phase === 'load')
        assert.ok(g.crew.includes(g.pilot), 'the pilot sails their own run');
      let moved = false;
      for (const seat of canal.actingSeats(g)) {
        const m = canal.botMove(g, seat);
        if (!m) continue;
        const next = canal.play(g, m, seat);
        if (next !== g) {
          g = next;
          moved = true;
        }
      }
      if (!moved) break;
    }
    assert.equal(g.over, true, `a ${seats} trader season ends`);
  }
});

await test('a world refuses a move from the wrong seat or the wrong phase', () => {
  for (const id of worldIds) {
    const entry = worldGames[id];
    const g = entry.create(entry.defaultSeats, 8080, 'medium');
    assert.equal(validMove(g, null, 0), false, 'nothing is not a move');
    assert.equal(validMove(g, { type: 'nonsense' }, 0), false);
    assert.equal(validMove(g, { type: 'nonsense' }, -1), false);
    assert.equal(
      validMove(g, { type: 'nonsense' }, g.seats.length + 4),
      false,
      'there is no such seat',
    );
    const before = JSON.stringify(g);
    assert.equal(
      play(g, { type: 'nonsense' }, 0),
      g,
      'a bad move changes nothing',
    );
    assert.equal(JSON.stringify(g), before, 'and leaves the state untouched');
  }
});

await test('every world is a real entry in the library', () => {
  for (const id of worldIds) {
    const game = worldLibraryGames[id];
    assert.ok(game, `${id} is on a shelf`);
    assert.equal(game.worldId, id, 'the library points back at the rules');
    assert.equal(game.name, worldGames[id].name, 'one name in both places');
    assert.ok(game.world.length, `${id} says what it is`);
    assert.deepEqual(
      game.players,
      [
        Math.min(...worldGames[id].seatChoices),
        Math.max(...worldGames[id].seatChoices),
      ],
      `${id} advertises the table sizes it actually offers`,
    );
  }
});
