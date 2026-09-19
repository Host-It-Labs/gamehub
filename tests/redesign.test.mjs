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
  migratedZones,
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
  let g = make('undertow', { salvage: true }, n, fast);
  while (g.phase === 'pass' || g.phase === 'roll') g = play(g, fallbackMove(g));
  return g;
}
await test('Salvage locks privately, survives JSON, reveals together, and cannot be duplicated', () => {
  let g = firstTrick();
  assert.equal(g.phase, 'salvage');
  assert.ok(isSavedGame(g));
  const leader = g.trickLeader,
    actor = g.active;
  assert.equal(validMove(g, { type: 'salvage', claim: true }, leader), false);
  const original = g;
  g = play(g, { type: 'salvage', claim: true }, actor);
  assert.notEqual(g, original);
  assert.ok(isSavedGame(g));
  assert.equal(
    g.players[actor].salvageClaims,
    1,
    'token does not reveal the claim early',
  );
  for (let viewer = 0; viewer < g.players.length; viewer++) {
    const view = observe(g, viewer);
    assert.equal('pending' in view, false);
    assert.deepEqual(view.salvageClaimants, []);
    assert.equal(view.players[actor].salvageClaims, 1);
  }
  assert.equal(play(g, { type: 'salvage', claim: false }, actor), g);
  const saved = JSON.parse(JSON.stringify(g));
  const move = { type: 'salvage', claim: false };
  const resumed = play(saved, move);
  g = play(g, move);
  assert.deepEqual(
    JSON.parse(JSON.stringify(resumed)),
    JSON.parse(JSON.stringify(g)),
  );
  assert.equal(g.phase, 'play');
  assert.equal(g.active, leader);
  assert.equal(g.players[actor].salvageClaims, 0);
  assert.deepEqual(g.salvageClaimants, [actor]);
});
await test('Salvage scores after Shields, penalizes unsuccessful claimants, and supports low tide', () => {
  for (const turningTide of [false, true]) {
    let g = make('undertow', { salvage: true, turningTide });
    g.phase = 'play';
    g.active = 0;
    g.pick = turningTide ? 2 : 1;
    g.hazard = 3;
    g.trickLeader = 0;
    g.salvageClaimants = [1, 2];
    g.players[1].salvageClaims = 0;
    g.players[2].salvageClaims = 0;
    const ranks = turningTide ? [4, 1, 2] : [1, 4, 2];
    g.players.forEach((p, i) => {
      p.hand = [
        { id: 900 + i, kind: 4, rank: ranks[i] },
        { id: 910 + i, kind: 1, rank: 1 },
      ];
    });
    for (let i = 0; i < 3; i++)
      g = play(g, {
        type: 'play',
        card: 900 + i,
        ...(i === 1 ? { ward: true } : {}),
      });
    assert.equal(g.players[1].score, -2, 'ceil(7/2) − 6');
    assert.equal(g.players[2].score, 3);
    assert.equal(g.players[1].wards, 1);
    assert.deepEqual(
      g.events.findLast((e) => e.type === 'trick').scoreChanges,
      [0, -2, 3],
    );
    assert.equal(g.phase, 'play', 'no final-trick claims');
  }
});
await test('Salvage bots can prefer abstaining or claiming from public information', () => {
  const g = firstTrick(2, true);
  const actor = g.active;
  g.players[actor].hand = Array.from({ length: 5 }, (_, kind) => ({
    id: 800 + kind,
    kind,
    rank: 1,
  }));
  assert.ok(heuristic(observe(g), { type: 'salvage', claim: true }) < 0);
  g.players[actor].hand = g.players[actor].hand.map((c) => ({ ...c, rank: 5 }));
  assert.ok(heuristic(observe(g), { type: 'salvage', claim: true }) > 0);
  assert.equal(chooseMove(observe(g), 'medium').claim, true);
});
await test('Migration and Roam combine atomically and preserve creature order', () => {
  let g = make('wildgrove', { migration: true, roamEnabled: true }, 2);
  g.phase = 'play';
  g.active = 0;
  g.roller = 1;
  g.die = 4;
  const resident = g.players[0].hand.pop();
  g.players[0].zones[3].push(resident);
  const from = 3,
    to = 0,
    card = g.players[0].hand[0].id;
  const migration = { card: resident.id, from, to };
  const move = { type: 'play', card, zone: to, migration, roam: true };
  assert.equal(
    validMove(g, { ...move, roam: false }, 0),
    false,
    'destination becomes occupied before normal placement',
  );
  assert.equal(validMove(g, move, 0), true);
  assert.equal(
    validMove(g, { ...move, migration: { ...migration, to: 5 } }, 0),
    false,
  );
  assert.deepEqual(parseMove(move), move);
  const before = g;
  g = play(g, move, 0);
  assert.equal(g.players[0].migrations, 1);
  assert.deepEqual(g.players[0].zones, before.players[0].zones);
  g = play(g, fallbackMove(g));
  assert.equal(g.players[0].migrations, 0);
  assert.equal(g.players[0].roams, 1);
  assert.deepEqual(
    g.players[0].zones[0].map((c) => c.id),
    [resident.id, card],
  );
  assert.deepEqual(g.players[0].zones[3], []);
  const zones = Array.from({ length: 7 }, () => []);
  zones[3] = [{ id: 1 }, { id: 2 }, { id: 3 }];
  zones[0] = [{ id: 4 }];
  const moved = migratedZones(zones, { card: 2, from: 3, to: 0 });
  assert.deepEqual(
    moved[3].map((c) => c.id),
    [1, 3],
  );
  assert.deepEqual(
    moved[0].map((c) => c.id),
    [4, 2],
  );
});
await test('coastal goals reward A–B–A and occupied habitats without Beacon species', () => {
  const zones = Array.from({ length: 7 }, () => []);
  zones[3] = [0, 1, 0].map((kind, id) => ({ kind, id, rank: 0 }));
  assert.equal(sanctuaryGoalProgress(zones, 10, 'intermediate').complete, true);
  zones[3][2].kind = 2;
  assert.equal(
    sanctuaryGoalProgress(zones, 10, 'intermediate').complete,
    false,
  );
  zones[6] = [{ kind: 5, id: 6, rank: 0 }];
  zones[0] = [{ kind: 0, id: 7, rank: 0 }];
  zones[1] = [{ kind: 1, id: 8, rank: 0 }];
  assert.equal(sanctuaryGoalProgress(zones, 11, 'intermediate').complete, true);
});
await test('all independent extension combinations terminate with valid state in both content sets', () => {
  for (const id of ['undertow', 'wildgrove', 'midnight'])
    for (const alternate of [false, true])
      for (let seats = 2; seats <= 6; seats++)
        for (let mask = 0; mask < 8; mask++) {
          const options =
            id === 'undertow'
              ? { turningTide: !!(mask & 2), salvage: !!(mask & 4) }
              : id === 'wildgrove'
                ? { roamEnabled: !!(mask & 1), migration: !!(mask & 2) }
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
            id === 'undertow' && !!(mask & 1),
            alternate,
            id === 'midnight' && !!(mask & 1),
            id === 'wildgrove' && !!(mask & 4),
            { ...options, contentSet: alternate ? 'intermediate' : 'beginner' },
          );
          let steps = 0;
          while (g.phase !== 'over') {
            assert.ok(
              isSavedGame(g),
              `${id}/${mask}/${alternate}/${g.phase}/${steps}`,
            );
            const move =
              g.phase === 'salvage'
                ? { type: 'salvage', claim: true }
                : fallbackMove(g);
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
await test('a revealed Salvage claim gives opponents a reason to contest a clean trick', () => {
  const g = make('undertow', { salvage: true }, 2);
  g.phase = 'play';
  g.active = 0;
  g.hazard = 2;
  g.players[0].hand = [
    { id: 800, kind: 0, rank: 1 },
    { id: 801, kind: 0, rank: 10 },
  ];
  const low = { type: 'play', card: 800 },
    high = { type: 'play', card: 801 };
  g.salvageClaimants = [];
  assert.ok(heuristic(observe(g), low) > heuristic(observe(g), high));
  g.salvageClaimants = [1];
  assert.ok(heuristic(observe(g), high) > heuristic(observe(g), low));
});
await test('strategic Elsewild bots use Migration legally in both content sets', () => {
  for (const contentSet of ['beginner', 'intermediate']) {
    let g = createGame(
      'wildgrove',
      'medium',
      611,
      false,
      3,
      false,
      false,
      false,
      true,
      { contentSet, migration: true, roamEnabled: true },
    );
    let migrations = 0;
    while (g.phase !== 'over') {
      const move = chooseMove(observe(g), 'medium');
      if (move.type === 'play' && move.migration) migrations++;
      assert.ok(validMove(g, move));
      g = play(g, move);
      assert.ok(isSavedGame(g));
    }
    assert.equal(migrations, 3);
  }
});

await test('capture events remain ordered and self-contained across round changes and reconnects', () => {
  for (const fast of [false, true])
    for (const seats of [2, 6]) {
      let g = firstTrick(seats, fast),
        lastEvent = g.events.at(-1).id;
      const total = Array(seats).fill(0);
      while (g.phase !== 'over') {
        const beforeRound = g.round;
        if (g.phase === 'salvage') {
          assert.ok(g.players[0].hand.length > 1);
          assert.ok(
            g.players.some(
              (p, seat) => seat !== g.trickLeader && p.salvageClaims > 0,
            ),
          );
        }
        g = play(
          g,
          g.phase === 'salvage'
            ? { type: 'salvage', claim: true }
            : fallbackMove(g),
        );
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
        if (g.round !== beforeRound)
          assert.ok(g.players.every((p) => p.salvageClaims === 1));
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
await test('invalid Migration cannot spend a token or partially relocate a creature', () => {
  const g = make('wildgrove', { migration: true }, 2);
  g.phase = 'play';
  g.active = 0;
  g.roller = 0;
  const resident = g.players[0].hand.pop();
  g.players[0].zones[0].push(resident);
  g.players[0].zones[6].push({ id: 850, kind: 1, rank: 0 });
  const base = { type: 'play', card: g.players[0].hand[0].id, zone: 2 };
  for (const migration of [
    { card: resident.id, from: 0, to: 0 },
    { card: resident.id, from: 0, to: 6 },
    { card: resident.id, from: 0, to: 5 },
    { card: resident.id, from: 5, to: 1 },
    { card: 9999, from: 0, to: 1 },
  ]) {
    assert.equal(validMove(g, { ...base, migration }), false);
    assert.equal(play(g, { ...base, migration }), g);
  }
  g.players[0].migrations = 0;
  assert.equal(
    validMove(g, { ...base, migration: { card: resident.id, from: 0, to: 1 } }),
    false,
  );
  assert.deepEqual(g.players[0].zones[0], [resident]);
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
