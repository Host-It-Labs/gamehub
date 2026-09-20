import test from 'node:test';
import assert from 'node:assert/strict';
import * as geo from '../lib/games/party/geography.ts';
import {
  standaloneGames,
  observe,
  decisionKey,
} from '../lib/games/standalone/registry.ts';

await test('Atlas gives exactly the same public task to every team, hiding all opposing drafts', () => {
  for (const n of [4, 6]) {
    let g = geo.createGame(n, 57, 'medium', 'teams');
    assert.equal(g.scores.length, 2);
    assert.equal(g.teams.filter((t) => t === 0).length, n / 2);
    g = geo.play(g, { type: 'arrange', order: [4, 3, 2, 1, 0] }, 0);
    for (let s = -1; s < n; s++) {
      const v = observe(g, s);
      assert.deepEqual(v.cities, g.cities);
      assert.equal(v.challenge, g.challenge);
      assert.deepEqual(v.anchor, g.anchor);
      assert.deepEqual(v.cityIds, []);
      assert.deepEqual(v.deck, []);
      assert.equal(v.result, null);
      assert.deepEqual(
        v.guesses[0].order,
        s >= 0 && g.teams[s] === 0 ? [4, 3, 2, 1, 0] : [],
      );
    }
    assert.equal(
      geo.validMove(g, { type: 'lock' }, 2),
      false,
      'teammates edit, captain locks',
    );
  }
});
await test('Identical answers score identically, no reveal before everyone locks, submission order is irrelevant', () => {
  for (const mode of ['individual', 'teams']) {
    let g = geo.createGame(6, 11, 'hard', mode);
    const answer = geo.solution(g);
    for (let t = 0; t < g.scores.length; t++)
      g = geo.play(g, { type: 'arrange', order: answer }, geo.captain(g, t));
    const seats = g.scores.map((_, t) => geo.captain(g, t));
    let a = g,
      b = g;
    for (const s of seats.slice(0, -1)) {
      a = geo.play(a, { type: 'lock' }, s);
      assert.equal(a.phase, 'guess');
      assert.equal(a.result, null);
    }
    a = geo.play(a, { type: 'lock' }, seats.at(-1));
    for (const s of seats.toReversed()) b = geo.play(b, { type: 'lock' }, s);
    assert.deepEqual(a, b);
    assert.equal(a.phase, 'reveal');
    assert.ok(a.result.gains.every((v) => v === 7));
    assert.deepEqual(a.result.order, answer);
    assert.ok(standaloneGames.miro.isSavedGame(a));
    const original = decisionKey(a);
    a = geo.play(a, { type: 'ready' }, 0);
    assert.equal(a.phase, 'reveal');
    assert.equal(decisionKey(a), original);
  }
});
await test('All six rounds use unambiguous coordinates and the same metric for each participant', () => {
  for (let seed = 1; seed <= 80; seed++) {
    let g = geo.createGame(4, seed, 'medium', 'teams');
    const challenges = [];
    while (!g.over) {
      const order = geo.solution(g),
        v = geo.values(g);
      challenges.push(g.challenge);
      assert.equal(new Set(g.cityIds).size, 5);
      for (let i = 1; i < 5; i++)
        assert.ok(
          v[order[i]] - v[order[i - 1]] >
            (g.challenge === 'distance' ? 150 : 3),
        );
      for (let t = 0; t < 2; t++) {
        const s = geo.captain(g, t);
        g = geo.play(g, { type: 'arrange', order }, s);
        g = geo.play(g, { type: 'lock' }, s);
      }
      assert.deepEqual(g.result.order, order);
      assert.ok(
        g.result.places.every((p) =>
          p.source.startsWith('https://api.worldbank.org/'),
        ),
      );
      for (let s = 0; s < 4; s++) g = geo.play(g, { type: 'ready' }, s);
      assert.ok(standaloneGames.miro.isSavedGame(g));
    }
    assert.deepEqual(challenges, [
      'west-east',
      'north-south',
      'distance',
      'west-east',
      'north-south',
      'distance',
    ]);
    assert.deepEqual(g.scores, [42, 42]);
  }
});
await test('Great-circle distances handle poles and the date line', () => {
  assert.equal(geo.distance({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(
    Math.abs(
      geo.distance({ lat: 0, lng: 179 }, { lat: 0, lng: -179 }) - 222.39,
    ) < 1,
  );
  assert.ok(
    Math.abs(
      geo.distance({ lat: 90, lng: 0 }, { lat: -90, lng: 0 }) - 20015.09,
    ) < 1,
  );
});
await test('Malformed moves, outsider input, locked edits and retired saves are rejected', () => {
  let g = geo.createGame(3, 14);
  for (const move of [
    null,
    [],
    {},
    { type: 'arrange', order: [0, 0, 1, 2, 3] },
    { type: 'arrange', order: [0, 1, 2, 3, 4], score: 7 },
    { type: 'ready' },
  ])
    assert.equal(geo.play(g, move, 0), g);
  assert.equal(geo.play(g, { type: 'lock' }, -1), g);
  assert.equal(geo.play(g, { type: 'lock' }, 3), g);
  g = geo.play(g, { type: 'lock' }, 0);
  assert.equal(geo.play(g, { type: 'arrange', order: [4, 3, 2, 1, 0] }, 0), g);
  g = geo.play(g, { type: 'unlock' }, 0);
  assert.equal(g.guesses[0].locked, false);
  assert.equal(
    standaloneGames.miro.isSavedGame({ ...g, rules: 3, phase: 'race' }),
    false,
  );
});
