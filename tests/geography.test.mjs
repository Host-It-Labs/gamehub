import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import * as geo from '../lib/games/party/geography.ts';
import {
  standaloneGames,
  observe,
  decisionKey,
  botMove,
} from '../lib/games/standalone/registry.ts';
import photos from '../lib/games/party/geo-places.json' with { type: 'json' };
import names from '../lib/games/party/geo-names.json' with { type: 'json' };
const places = geo.places;
const entry = standaloneGames.miro;
function pinAndLock(
  g,
  seat,
  pair = [
    { lat: 15, lng: 20 },
    { lat: -30, lng: 120 },
  ],
) {
  for (let prompt = 0; prompt < 3; prompt++)
    g = geo.play(
      g,
      {
        type: 'pin',
        prompt,
        lat: (pair[prompt] ?? pair[0]).lat,
        lng: (pair[prompt] ?? pair[0]).lng,
      },
      seat,
    );
  return geo.play(g, { type: 'lock' }, seat);
}
/** Host Next; after a round's last reveal everyone votes, which ends the vote. */
function next(g, choice = 'more') {
  g = geo.play(g, { type: 'next' }, 0);
  if (g.phase === 'vote')
    for (let s = 0; s < g.seats.length; s++)
      g = geo.play(g, { type: 'vote', choice }, s);
  return g;
}
function choose(g) {
  const team = geo.activeTeam(g),
    seat = geo.captain(g, team);
  for (const prompt of [2, 0, 1]) {
    g = geo.play(g, { type: 'choose', prompt, seat }, seat);
    if (prompt !== 1) assert.equal(geo.play(g, { type: 'lock' }, seat), g);
  }
  return geo.play(g, { type: 'lock' }, seat);
}
await test('private pins hide even from teammates until all players freeze their guesses', () => {
  for (const n of [4, 6]) {
    let g = geo.createGame(n, 57, 'medium', 'teams');
    g = pinAndLock(g, 0);
    for (let s = -1; s < n; s++) {
      const v = observe(g, s);
      assert.deepEqual(v.prompts, g.prompts);
      assert.deepEqual(v.cityIds, []);
      assert.deepEqual(v.deck, []);
      assert.equal(v.rngState, 0);
      assert.deepEqual(
        v.guesses[0].pins,
        s === 0 ? g.guesses[0].pins : [null, null, null],
      );
      assert.equal(v.result, null);
    }
    assert.equal(geo.play(g, { type: 'pin', prompt: 0, lat: 0, lng: 0 }, 0), g);
    for (let s = 1; s < n; s++) g = pinAndLock(g, s);
    assert.equal(g.phase, 'discuss');
    for (let s = -1; s < n; s++)
      for (let other = 0; other < n; other++)
        assert.deepEqual(
          observe(g, s).guesses[other].pins,
          g.teams[s] === g.teams[other]
            ? g.guesses[other].pins
            : [null, null, null],
        );
  }
});
await test('each captain selects all three frozen teammate pins before switching teams; neither reveals early', () => {
  let g = geo.createGame(4, 3, 'medium', 'teams');
  for (let s = 0; s < 4; s++) g = pinAndLock(g, s);
  const team = geo.activeTeam(g),
    cap = geo.captain(g, team),
    opponent = geo.captain(g, 1 - team);
  assert.deepEqual(geo.actingSeats(g), [cap]);
  assert.equal(
    geo.play(g, { type: 'choose', prompt: 0, seat: opponent }, cap),
    g,
  );
  assert.equal(
    geo.play(g, { type: 'choose', prompt: 0, seat: opponent }, opponent),
    g,
  );
  assert.equal(
    geo.play(g, { type: 'pin', prompt: 0, lat: 10, lng: 10 }, cap),
    g,
  );
  assert.equal(geo.play(g, { type: 'lock' }, cap), g);
  const key = decisionKey(g);
  g = choose(g);
  assert.notEqual(decisionKey(g), key);
  assert.equal(g.phase, 'discuss');
  assert.equal(g.result, null);
  assert.equal(geo.activeTeam(g), 1 - team);
  assert.deepEqual(observe(g, opponent).choices[team].seats, [
    null,
    null,
    null,
  ]);
  assert.equal(geo.play(g, { type: 'choose', prompt: 0, seat: cap }, cap), g);
  g = choose(g);
  assert.equal(g.phase, 'reveal');
  assert.equal(g.result.places.length, 1);
  assert.deepEqual(g.result.pins[0], g.result.pins[1]);
  assert.equal(g.result.gains[0], g.result.gains[1]);
  assert.ok(entry.isSavedGame(g));
  assert.deepEqual(geo.actingSeats(g), []);
  assert.equal(geo.play(g, { type: 'ready' }, 0), g);
  g = geo.play(g, { type: 'next' }, 2);
  assert.equal(g.phase, 'reveal');
  assert.equal(g.challenge, 'hard');
  assert.equal(g.discussionEndsAt, null);
});
await test('every round runs an easier place, a harder place, then a photographed final', () => {
  for (const mode of ['individual', 'teams'])
    for (const n of mode === 'teams' ? [4, 6] : [2, 3, 4, 5, 6])
      for (let seed = 1; seed <= 15; seed++) {
        let g = geo.createGame(n, seed, 'easy', mode),
          guard = 0;
        assert.equal(new Set(g.deck).size, g.deck.length);
        assert.ok(g.deck.length >= 36, 'twelve rounds of places');
        const rounds = new Map();
        while (!g.over) {
          assert.ok(guard++ < 200);
          assert.ok(entry.isSavedGame(g), `${mode}/${n}/${g.phase}`);
          assert.deepEqual(
            g.prompts.slice(0, 2).map((p) => p.difficulty),
            ['medium', 'hard'],
          );
          rounds.set(`${g.round}:${g.challenge}`, g.challenge);
          assert.ok(
            g.prompts.every((p, i) =>
              geo.challenges[i] === 'final'
                ? p.photo && p.facts.length === 2 && p.title === ''
                : p.photo === null && p.facts.length === 0 && p.title,
            ),
          );
          if (g.phase === 'reveal') {
            // Reveals wait on the host alone; no bot moves the table on.
            assert.equal(botMove(g, 0), null);
            g = geo.play(g, { type: 'next' }, 0);
            continue;
          }
          const seat = geo.actingSeats(g)[0],
            m = botMove(g, seat);
          assert.ok(m);
          assert.ok(geo.validMove(g, m, seat));
          const observed = observe(g, seat);
          assert.deepEqual(geo.botMove(observed, seat), m);
          g = geo.play(g, m, seat);
        }
        assert.ok(entry.isSavedGame(g));
        assert.deepEqual(
          [...rounds.values()],
          ['easy', 'hard', 'final', 'easy', 'hard', 'final'],
        );
        assert.deepEqual(geo.actingSeats(g), []);
      }
});
await test('scoring rewards closeness, allows shared closest points, and breaks match ties by total distance', () => {
  let g = geo.createGame(2, 12);
  const targets = g.cityIds.map((i) => places[i]);
  g = pinAndLock(g, 0, targets);
  g = pinAndLock(g, 1, [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 0 },
  ]);
  assert.deepEqual(g.result.gains, [100, 0]);
  assert.deepEqual(g.result.distances[0], [0]);
  assert.equal(
    entry.outcome({ ...g, scores: [3, 3], totalDistance: [300, 400] }).title,
    'You wins',
  );
  assert.deepEqual(
    entry.outcome({ ...g, scores: [3, 3], totalDistance: [300, 400] }).winners,
    [0],
  );
  assert.deepEqual(
    entry.outcome({ ...g, scores: [3, 3], totalDistance: [300, 300] }).winners,
    [0, 1],
  );
});
await test('malformed moves, unfinished locks, outsiders and retired ordering saves are rejected', () => {
  let g = geo.createGame(4, 14, 'medium', 'teams');
  for (const m of [
    null,
    [],
    {},
    { type: 'arrange', order: [0, 1, 2, 3, 4] },
    { type: 'pin', prompt: 3, lat: 0, lng: 0 },
    { type: 'pin', prompt: 0, lat: NaN, lng: 0 },
    { type: 'pin', prompt: 0, lat: 91, lng: 0 },
    { type: 'pin', prompt: 0, lat: 0, lng: Infinity },
    { type: 'pin', prompt: 0, lat: 0, lng: 181 },
    { type: 'pin', prompt: 0, lat: 0, lng: 0, score: 9 },
    { type: 'lock' },
    { type: 'next' },
    { type: 'unlock' },
  ])
    assert.equal(geo.play(g, m, 0), g);
  assert.equal(geo.play(g, { type: 'pin', prompt: 0, lat: 0, lng: 0 }, -1), g);
  assert.equal(geo.play(g, { type: 'pin', prompt: 0, lat: 0, lng: 0 }, 4), g);
  assert.equal(entry.isSavedGame({ ...g, rules: 5 }), false);
  assert.equal(entry.isSavedGame({ ...g, rules: 6 }), false);
  assert.equal(entry.isSavedGame({ ...g, rules: 7 }), false);
  assert.equal(entry.isSavedGame({ ...g, rules: 8 }), false);
  assert.equal(entry.isSavedGame({ ...g, challenge: 'invalid' }), false);
  assert.equal(entry.isSavedGame({ ...g, round: 3 }), false);
  assert.equal(entry.isSavedGame({ ...g, deck: [0, 0, 0, 0, 0, 0] }), false);
  g = pinAndLock(g, 0);
  assert.equal(geo.play(g, { type: 'unlock' }, 0), g);
});
await test('named places cover the world, skip the headline cities and never repeat a final', () => {
  const key = (p) => `${p.country}:${p.name}`;
  assert.equal(new Set(names.map(key)).size, names.length);
  for (const p of photos) assert.ok(!names.some((n) => key(n) === key(p)));
  for (const difficulty of ['medium', 'hard']) {
    const list = names.filter((p) => p.difficulty === difficulty);
    assert.ok(list.length >= 36, difficulty);
    assert.ok(new Set(list.map((p) => p.region)).size >= 7, difficulty);
  }
  for (const p of names) {
    assert.ok(geo.isPin(p), p.name);
    assert.ok(p.source.startsWith('https://en.wikipedia.org/'));
    assert.ok(
      !['Paris', 'London', 'New York', 'Rome', 'Tokyo'].includes(p.name),
    );
  }
});
await test('great-circle distance handles poles and the date line', () => {
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
await test('photo pool has local real images, provenance, two clues, and broad geographical coverage', async () => {
  assert.ok(photos.length >= 12);
  assert.equal(new Set(photos.map((p) => p.photo)).size, photos.length);
  assert.equal(new Set(photos.map((p) => p.region)).size, 6);
  for (const p of photos) {
    assert.ok(geo.isPin(p));
    assert.equal(p.facts.length, 2);
    // Clues never give the place or its country away.
    for (const f of p.facts) {
      assert.ok(!f.includes(p.country), `${p.name}: ${f}`);
      for (const word of p.name.split(/[\s-]+/).filter((w) => w.length > 3))
        assert.ok(!f.includes(word), `${p.name}: ${f}`);
    }
    assert.ok(p.source.startsWith('https://en.wikipedia.org/'));
    assert.ok(p.photoSource.startsWith('https://commons.wikimedia.org/'));
    assert.ok(p.artist && p.license);
    const file = new URL(`../public${p.photo}`, import.meta.url);
    assert.ok((await stat(file)).size > 10000);
    const bytes = await readFile(file);
    assert.ok(bytes[0] === 0xff && bytes[1] === 0xd8, p.photo);
  }
});
await test('discussion deadlines advance atomically, preserve chosen pins, and fall back only to frozen captain pins', () => {
  let g = geo.createGame(4, 4, 'medium', 'teams');
  for (let s = 0; s < 4; s++) g = pinAndLock(g, s);
  const team = geo.activeTeam(g),
    cap = geo.captain(g, team),
    other = g.teams.findIndex((t, s) => t === team && s !== cap);
  const deadline = g.discussionEndsAt;
  assert.ok(deadline > Date.now());
  assert.equal(geo.tick(g, deadline - 1), g);
  g = geo.play(g, { type: 'choose', prompt: 0, seat: other }, cap);
  const next = geo.tick(g, deadline);
  assert.equal(next.revision, g.revision + 1);
  assert.deepEqual(next.choices[team].seats, [other, cap, cap]);
  assert.equal(next.choices[team].locked, true);
  assert.equal(next.result, null);
  assert.equal(next.discussionEndsAt, deadline + 60_000);
  assert.ok(entry.isSavedGame(next));
  const revealed = geo.tick(next, next.discussionEndsAt);
  assert.equal(revealed.phase, 'reveal');
  assert.equal(revealed.discussionEndsAt, null);
  assert.ok(entry.isSavedGame(revealed));
  assert.equal(geo.tick(revealed, deadline + 60_000), revealed);
  // A captain's late submission cannot change the frozen timeout outcome.
  const late = geo.play(
    g,
    { type: 'choose', prompt: 0, seat: cap },
    cap,
    deadline + 1,
  );
  assert.deepEqual(late.choices[team].seats, [other, cap, cap]);
});
await test('practice has no deadline and old or malformed timed state is rejected', () => {
  let g = geo.createGame(4, 4, 'medium', 'teams');
  g.tutorial = true;
  for (let s = 0; s < 4; s++) g = pinAndLock(g, s);
  assert.equal(g.discussionEndsAt, null);
  assert.equal(geo.tick(g, Date.now() + 999999), g);
  assert.ok(entry.isSavedGame(g));
  assert.equal(entry.isSavedGame({ ...g, tutorial: false }), false);
});

await test('teams take one complete turn each per round; the starting team alternates only between rounds', () => {
  for (const n of [4, 5, 6])
    for (let seed = 1; seed <= 12; seed++) {
      let g = geo.createGame(n, seed, 'medium', 'teams');
      for (let round = 1; round <= 2; round++) {
        assert.equal(g.round, round);
        assert.equal(g.phase, 'guess');
        assert.ok(
          g.guesses.every((b) => !b.locked && b.pins.every((p) => p === null)),
        );
        for (let seat = 0; seat < n; seat++) g = pinAndLock(g, seat);
        const first = geo.activeTeam(g);
        assert.equal(first, (g.firstTeam + round - 1) % 2);
        const cap = geo.captain(g, first),
          key = decisionKey(g);
        g = choose(g);
        assert.equal(g.phase, 'discuss');
        assert.notEqual(decisionKey(g), key);
        assert.equal(geo.activeTeam(g), 1 - first);
        assert.equal(geo.captain(g, first), cap);
        assert.equal(g.result, null);
        g = choose(g);
        const choices = structuredClone(g.choices);
        for (const category of geo.challenges) {
          assert.equal(g.phase, 'reveal');
          assert.equal(g.challenge, category);
          assert.deepEqual(g.choices, choices);
          assert.equal(g.discussionEndsAt, null);
          assert.ok(entry.isSavedGame(g));
          assert.equal(g.over, false);
          g = next(g, round === 2 ? 'finish' : 'more');
        }
      }
      assert.equal(g.over, true);
      assert.equal(g.round, 2);
      assert.equal(g.challenge, 'final');
    }
});

await test('all three categories are prepared independently before any discussion, and stay frozen through the round', () => {
  let g = geo.createGame(4, 80, 'medium', 'teams');
  for (const [seat, prompt] of [
    [0, 2],
    [1, 1],
    [2, 0],
    [3, 2],
    [0, 0],
    [1, 2],
    [2, 2],
    [3, 1],
  ]) {
    g = geo.play(
      g,
      { type: 'pin', prompt, lat: seat * 10, lng: prompt * 20 },
      seat,
    );
    assert.equal(g.phase, 'guess');
    assert.equal(geo.play(g, { type: 'lock' }, seat), g);
    for (let other = 0; other < 4; other++)
      if (other !== seat)
        assert.deepEqual(geo.observe(g, other).guesses[seat].pins, [
          null,
          null,
          null,
        ]);
  }
  for (let seat = 0; seat < 3; seat++) g = pinAndLock(g, seat);
  assert.equal(g.phase, 'guess');
  assert.equal(g.discussionEndsAt, null);
  g = pinAndLock(g, 3);
  const frozen = structuredClone(g.guesses);
  assert.equal(g.phase, 'discuss');
  assert.equal(g.challenge, 'easy');
  for (let category = 0; category < 3; category++) {
    for (let seat = 0; seat < 4; seat++)
      for (let prompt = 0; prompt < 3; prompt++)
        assert.equal(
          geo.play(g, { type: 'pin', prompt, lat: 1, lng: 1 }, seat),
          g,
        );
    if (category === 0) {
      g = choose(g);
      g = choose(g);
    }
    assert.equal(g.result.places[0].name, places[g.cityIds[category]].name);
    assert.deepEqual(
      geo.observe(g, -1).guesses[0].pins,
      frozen[0].pins.map((pin, i) => (i === category ? pin : null)),
    );
    assert.deepEqual(g.guesses, frozen);
    g = next(g);
  }
  assert.equal(g.round, 2);
  assert.equal(g.phase, 'guess');
  assert.ok(
    g.guesses.every((b) => !b.locked && b.pins.every((p) => p === null)),
  );
});

await test('team tabs preserve independent selections, captain stays fixed, and each revealed category uses its selected pin', () => {
  let g = geo.createGame(6, 87, 'medium', 'teams');
  for (let seat = 0; seat < 6; seat++)
    g = pinAndLock(
      g,
      seat,
      [0, 1, 2].map((prompt) => ({
        lat: seat * 10 + prompt,
        lng: seat * 20 + prompt,
      })),
    );
  const chosen = [];
  for (let turn = 0; turn < 2; turn++) {
    const team = geo.activeTeam(g),
      cap = geo.captain(g, team),
      deadline = g.discussionEndsAt;
    const members = g.teams.flatMap((t, seat) => (t === team ? [seat] : []));
    chosen[team] = members;
    for (const prompt of [1, 2, 0]) {
      g = geo.play(g, { type: 'choose', prompt, seat: members[prompt] }, cap);
      assert.equal(geo.activeTeam(g), team);
      assert.equal(geo.captain(g, team), cap);
      assert.equal(g.discussionEndsAt, deadline);
      assert.equal(g.result, null);
      assert.ok(entry.isSavedGame(g));
    }
    assert.deepEqual(g.choices[team].seats, members);
    assert.equal(geo.play(g, { type: 'choose', prompt: 3, seat: cap }, cap), g);
    const malformed = structuredClone(g);
    malformed.choices[team].seats = [cap];
    assert.equal(entry.isSavedGame(malformed), false);
    g = geo.play(g, { type: 'lock' }, cap);
  }
  const frozen = structuredClone(g.guesses);
  for (let prompt = 0; prompt < 3; prompt++) {
    for (const team of [0, 1])
      assert.deepEqual(g.result.pins[team], [
        frozen[chosen[team][prompt]].pins[prompt],
      ]);
    g = geo.play(g, { type: 'next' }, 0);
  }
});
