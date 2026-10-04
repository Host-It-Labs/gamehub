import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createGame,
  play,
  validMove,
  observe,
  isSavedGame,
  sanctuaryGoalProgress,
  censusBreakdown,
  totalRounds,
  scores,
  decisionKey,
} from '../lib/games/trio/engine.ts';
import { chooseMove, fallbackMove, heuristic } from '../lib/games/trio/bot.ts';
import { Tables, parseMove } from '../server/tables.ts';
import { openDatabase } from '../server/database.ts';
const make = (id, options = {}, n = 3, fast = false) =>
  createGame(
    id,
    'medium',
    42,
    false,
    n,
    id === 'undertow',
    fast,
    id === 'midnight',
    id === 'wildgrove',
    options,
  );
function firstTrick(n = 3, fast = false) {
  let g = make('undertow', { gold: true, anchor: true }, n, fast);
  while (g.phase === 'pass' || g.phase === 'roll') g = play(g, fallbackMove(g));
  return g;
}
await test('Migration is retired: a move carrying one is refused and never relocates a creature', () => {
  const g = make('wildgrove', { roamEnabled: true }, 2);
  g.phase = 'play';
  g.active = 0;
  g.roller = 0;
  const resident = g.players[0].hand.pop();
  g.players[0].zones[3].push(resident);
  const base = { type: 'play', card: g.players[0].hand[0].id, zone: 0 };
  const move = { ...base, migration: { card: resident.id, from: 3, to: 1 } };
  assert.equal(validMove(g, base, 0), true);
  assert.equal(validMove(g, move, 0), false);
  assert.equal(play(g, move, 0), g);
  assert.equal('migration' in parseMove(move), false);
  assert.equal('migration' in g, false);
});
await test('Census: the most of each species earns 3, tied leaders 1 each, released creatures never count', () => {
  const card = (kind, id) => ({ kind, id, rank: 0 });
  const board = () => Array.from({ length: 7 }, () => []);
  const a = board(), b = board(), c = board();
  a[0] = [card(0, 1), card(0, 2)];
  b[1] = [card(0, 3)];
  a[1] = [card(1, 4)];
  b[2] = [card(1, 5)];
  c[5] = [card(2, 6), card(2, 7)];
  c[3] = [card(3, 8)];
  const result = censusBreakdown([a, b, c]);
  assert.deepEqual(result.map((r) => r.points), [3 + 1, 1, 3]);
  assert.deepEqual(result[0].leads, [0]);
  assert.deepEqual(result[0].ties, [1]);
  assert.deepEqual(result[2].leads, [3]);
  const g = make('wildgrove', { census: true }, 3);
  g.players[0].zones = a;
  g.players[1].zones = b;
  g.players[2].zones = c;
  const plain = scores({ ...g, census: false });
  assert.deepEqual(scores(g).map((v, i) => v - plain[i]), [4, 1, 3]);
});
await test('coastal goals reward the A–B–A–B Pier and two lone lighthouse species', () => {
  const zones = Array.from({ length: 7 }, () => []);
  zones[3] = [0, 1, 0, 1].map((kind, id) => ({ kind, id, rank: 0 }));
  assert.equal(sanctuaryGoalProgress(zones, 10, 'intermediate').complete, true);
  zones[3][3].kind = 2;
  assert.deepEqual(sanctuaryGoalProgress(zones, 10, 'intermediate'), { progress: 3, complete: false, points: 0 });
  zones[6] = [{ kind: 4, id: 6, rank: 0 }, { kind: 5, id: 7, rank: 0 }];
  assert.equal(sanctuaryGoalProgress(zones, 8, 'intermediate').complete, true);
  zones[0] = [{ kind: 5, id: 8, rank: 0 }];
  assert.equal(sanctuaryGoalProgress(zones, 8, 'intermediate').progress, 1);
});
await test('all independent extension combinations terminate with valid state in both content sets', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (const alternate of [false, true])
      for (let seats = 2; seats <= 6; seats++)
        for (let mask = 0; mask < 8; mask++) {
          // Nox seats three to six, and four at most on the Fast deck.
          if (id === 'undertow' && (seats < 3 || (alternate && seats > 4))) continue;
          const options =
            id === 'undertow'
              ? { gold: !!(mask & 1), anchor: !!(mask & 2), dawn: !!(mask & 4) }
              : id === 'wildgrove'
                ? { roamEnabled: !!(mask & 1), census: !!(mask & 2) }
                : {
                    specialtyStalls: !!(mask & 2),
                    marketSeasons: !!(mask & 4),
                  };
          let g = createGame(
            id,
            'easy',
            93,
            false,
            seats,
            false,
            alternate,
            id === 'midnight' && !!(mask & 1),
            id === 'wildgrove' && !!(mask & 4),
            {
              ...options,
              // Mora's four boards: the Observatory, then Floodline, Sunset Motel and Glacier Dam by seat count.
              contentSet: !alternate ? 'beginner' : id === 'wildgrove' ? ['intermediate', 'desert', 'alpine'][seats % 3] : 'intermediate',
            },
          );
          let steps = 0;
          while (g.phase !== 'over') {
            assert.ok(
              isSavedGame(g),
              `${id}/${mask}/${alternate}/${g.phase}/${steps}`,
            );
            const move = fallbackMove(g);
            assert.ok(validMove(g, move));
            g = play(g, move);
            assert.ok(++steps < 1200);
          }
          assert.ok(isSavedGame(g));
          assert.ok(scores(g).every(Number.isFinite));
        }
});
await test('rules reset retains lobby identity and refuses stale moves without creating results', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      'owner',
      'owner@test.local',
      'Owner',
      'unused',
    );
    const who = { id: 'owner', userId: 'owner', name: 'Owner' };
    const tables = new Tables(db, () => true);
    let t = tables.create(who);
    t = tables.command(t.token, who, {
      requestId: randomUUID(),
      matchId: t.matchId,
      revision: t.revision,
      action: { type: 'start' },
    });
    const oldMatch = t.matchId,
      oldRevision = t.revision;
    t.game.version = 3;
    tables.save(t);
    const reopened = new Tables(db, () => true);
    const restored = reopened.get(t.token);
    assert.equal(restored.status, 'lobby');
    assert.equal(restored.game, null);
    assert.deepEqual(restored.members, t.members);
    assert.throws(() =>
      reopened.command(t.token, who, {
        requestId: randomUUID(),
        matchId: oldMatch,
        revision: oldRevision,
        action: {
          type: 'move',
          move: { type: 'roll' },
          decision: decisionKey(t.game),
        },
      }),
    );
    assert.equal(reopened.get(t.token).status, 'lobby');
  } finally {
    db.close();
  }
});
await test('Gold gives bots a reason to win a clean trick', () => {
  for (const gold of [false, true]) {
    const g = make('undertow', { gold }, 3);
    g.phase = 'play';
    g.active = 0;
    g.hazard = 0;
    g.players[0].hand = [
      { id: 800, kind: 0, rank: 1 },
      { id: 801, kind: 0, rank: 10 },
    ];
    const low = heuristic(observe(g), { type: 'play', card: 800 }),
      high = heuristic(observe(g), { type: 'play', card: 801 });
    assert.ok(gold ? high > low : low > high);
  }
});
await test('strategic Mora bots play every board legally with Roam and Census', () => {
  for (const contentSet of ['beginner', 'intermediate', 'desert', 'alpine']) {
    let g = createGame('wildgrove', 'medium', 611, false, 3, false, false, false, true, { contentSet, census: true, roamEnabled: true });
    let placed = 0;
    while (g.phase !== 'over') {
      const move = chooseMove(observe(g), 'medium');
      if (move.type === 'play') placed++;
      assert.ok(validMove(g, move));
      g = play(g, move);
      assert.ok(isSavedGame(g));
    }
    assert.equal(placed, totalRounds(g) * 6 * 3);
    assert.ok(scores(g).every((v) => Number.isFinite(v) && v > 0), `${contentSet}: ${scores(g).join(", ")}`);
  }
});

await test('capture events remain ordered and self-contained across round changes and reconnects', () => {
  for (const fast of [false, true])
    for (const seats of fast ? [3, 4] : [3, 6]) {
      let g = firstTrick(seats, fast),
        lastEvent = g.events.at(-1).id;
      const total = Array(seats).fill(0);
      while (g.phase !== 'over') {
        g = play(g, fallbackMove(g));
        const events = g.events.filter((e) => e.id > lastEvent);
        for (const event of events) {
          assert.ok(event.id > lastEvent);
          lastEvent = event.id;
          if (event.type !== 'trick') continue;
          assert.equal(event.trick.length, seats);
          assert.equal(new Set(event.trick.map((t) => t.player)).size, seats);
          assert.equal(event.scoreChanges.length, seats);
          assert.ok(event.hazard >= 0 && event.hazard < 4);
          event.scoreChanges.forEach((delta, seat) => {
            total[seat] += delta;
          });
        }
        const reconnect = JSON.parse(JSON.stringify(g));
        assert.ok(isSavedGame(reconnect));
        assert.deepEqual(
          observe(reconnect).events,
          JSON.parse(JSON.stringify(observe(g).events)),
        );
      }
      assert.deepEqual(
        g.players.map((p) => p.score),
        total,
      );
    }
});
await test('local move preparation survives another seat locking and expires with its own decision', async () => {
  const { preparationKey, canAct } =
    await import('../lib/games/trio/engine.ts');
  let g = make('midnight', {}, 3);
  const own = 0,
    other = 1;
  const draftKey = preparationKey(observe(g, own), own);
  assert.ok(canAct(g, own));
  g = play(g, fallbackMove({ ...observe(g, other), active: other }), other);
  assert.equal(preparationKey(observe(g, own), own), draftKey);
  g = play(g, fallbackMove({ ...observe(g, own), active: own }), own);
  assert.notEqual(preparationKey(observe(g, own), own), draftKey);
});
