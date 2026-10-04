import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as imp from '../lib/games/party/impostor.ts';
import { wordPairs } from '../lib/games/party/impostor-words.ts';
import {
  standaloneGames,
  decisionKey,
  deadline,
  observe,
} from '../lib/games/standalone/registry.ts';
import { practice, advancePractice } from '../lib/games/adventures/lessons.ts';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';

const NOW = 1_000_000;
const stroke = (c = 0) => ({
  c,
  w: 1,
  p: imp.packPoints([100, 100, 500, 520, 900, 880]),
});
const saved = (g) =>
  standaloneGames.impostor.isSavedGame(JSON.parse(JSON.stringify(g)));

/** Plays one round to the reveal: everyone draws a stroke and locks, writes a
 * clue, and accuses `pick(seat)`. */
function toReveal(g, pick, now = NOW) {
  for (let s = 0; s < g.seats.length; s++) {
    g = imp.play(g, { type: 'stroke', stroke: stroke() }, s, now);
    g = imp.play(g, { type: 'lock' }, s, now);
  }
  assert.equal(g.phase, 'clue');
  for (let s = 0; s < g.seats.length; s++)
    g = imp.play(g, { type: 'clue', text: s % 2 ? 'soft' : 'round' }, s, now);
  assert.equal(g.phase, 'accuse');
  for (let s = 0; s < g.seats.length; s++)
    g = imp.play(g, { type: 'accuse', target: pick(s, g) }, s, now);
  return g;
}

await test('Impostor content: forty distinct pairs of simple words', () => {
  assert.ok(wordPairs.length >= 40);
  const words = wordPairs.flatMap((p) => p.words.map((w) => w.toLowerCase()));
  assert.equal(new Set(words).size, words.length, 'every word appears once');
  for (const p of wordPairs) {
    assert.equal(p.words.length, 2);
    for (const [k, w] of p.words.entries()) {
      assert.match(w, /^[A-Z][a-z]+( [a-z]+)?$/, w);
      assert.ok(
        !imp.givesAway(p.hints[k], w),
        `${w}'s hint must not give it away`,
      );
    }
  }
});

await test('Impostor: packed points round-trip and reject junk', () => {
  const pts = [0, 1000, 37, 999, 512, 64];
  assert.deepEqual(imp.unpackPoints(imp.packPoints(pts)), pts);
  const g = imp.createGame(4, 7, 'medium', new Set(), NOW);
  assert.equal(
    imp.validMove(g, { type: 'stroke', stroke: { c: 0, w: 1, p: '!!!!' } }, 0),
    false,
  );
  assert.equal(
    imp.validMove(g, { type: 'stroke', stroke: { c: 3, w: 1, p: 'AAAA' } }, 0),
    false,
  );
  assert.equal(
    imp.validMove(g, { type: 'stroke', stroke: { c: 0, w: 1, p: 'AAA' } }, 0),
    false,
  );
  // 1001 encodes as P p; anything over 1000 is refused.
  assert.equal(
    imp.validMove(
      g,
      {
        type: 'stroke',
        stroke: {
          c: 0,
          w: 1,
          p: imp.packPoints([1000, 0]).replace(/^../, 'Pp'),
        },
      },
      0,
    ),
    false,
  );
  assert.equal(
    imp.validMove(g, { type: 'stroke', stroke: stroke(), extra: 1 }, 0),
    false,
  );
});

await test('Impostor: one secret word each, the impostor gets the neighbour', () => {
  for (const n of imp.seatChoices) {
    const g = imp.createGame(n, 1000 + n, 'medium', new Set(), NOW);
    const pair = wordPairs[g.pair];
    assert.equal(g.impostors.length, imp.impostorCount(n));
    const crowd = g.words.find((_, s) => !g.impostors.includes(s));
    const odd = g.words[g.impostors[0]];
    assert.notEqual(crowd, odd);
    const abc = (a, b) => a.localeCompare(b);
    assert.deepEqual([crowd, odd].sort(abc), [...pair.words].sort(abc));
    assert.equal(g.drawEndsAt, NOW + imp.drawMs);
    assert.ok(saved(g));
    // Each seat sees only its own word, and never who the impostor is.
    for (let v = 0; v < n; v++) {
      const view = imp.observe(g, v);
      assert.equal(view.pair, -1);
      assert.deepEqual(view.impostors, []);
      assert.equal(view.words.filter(Boolean).length, 1);
      assert.equal(view.words[v], g.words[v]);
      assert.deepEqual(view.deck, []);
    }
  }
  assert.throws(() => imp.createGame(2, 1));
  assert.throws(() => imp.createGame(9, 1));
});

await test('Impostor: drawings stay private until everyone is done', () => {
  let g = imp.createGame(4, 11, 'medium', new Set(), NOW);
  assert.deepEqual(imp.actingSeats(g), [0, 1, 2, 3]);
  g = imp.play(g, { type: 'stroke', stroke: stroke() }, 0, NOW);
  g = imp.play(g, { type: 'stroke', stroke: stroke(1) }, 0, NOW);
  g = imp.play(g, { type: 'undo' }, 0, NOW);
  assert.equal(g.sketches[0].strokes.length, 1);
  assert.equal(imp.observe(g, 1).sketches[0].strokes.length, 0);
  g = imp.play(g, { type: 'lock' }, 0, NOW);
  assert.equal(
    imp.validMove(g, { type: 'stroke', stroke: stroke() }, 0),
    false,
  );
  assert.ok(imp.validMove(g, { type: 'unlock' }, 0));
  assert.deepEqual(imp.actingSeats(g), [1, 2, 3]);
  assert.ok(imp.observe(g, 2).sketches[0].locked);
  // Clear empties a card; an empty card has nothing to undo.
  g = imp.play(g, { type: 'stroke', stroke: stroke() }, 1, NOW);
  g = imp.play(g, { type: 'clear' }, 1, NOW);
  assert.equal(imp.validMove(g, { type: 'undo' }, 1), false);
  assert.ok(saved(g));
});

await test('Impostor: the clock locks every card, even blank ones', () => {
  let g = imp.createGame(3, 12, 'medium', new Set(), NOW);
  g = imp.play(g, { type: 'stroke', stroke: stroke() }, 1, NOW);
  assert.equal(deadline(g), NOW + imp.drawMs);
  assert.equal(imp.tick(g, NOW + 10), g, 'nothing happens before the clock');
  const later = NOW + imp.drawMs + 1;
  // A late stroke lands on the locked cards instead.
  const late = imp.play(g, { type: 'stroke', stroke: stroke() }, 0, later);
  assert.equal(late.phase, 'clue');
  assert.equal(late.sketches[0].strokes.length, 0);
  assert.equal(late.sketches[1].strokes.length, 1);
  assert.ok(late.sketches.every((k) => k.locked));
  assert.equal(late.drawEndsAt, null);
  assert.equal(imp.tick(g, later).phase, 'clue');
  assert.ok(saved(late));
});

await test('Impostor: clues are one short word that never names your own', () => {
  let g = imp.createGame(4, 13, 'medium', new Set(), NOW);
  for (let s = 0; s < 4; s++) g = imp.play(g, { type: 'lock' }, s, NOW);
  assert.equal(g.phase, 'clue');
  const own = g.words[0];
  assert.equal(imp.validMove(g, { type: 'clue', text: own }, 0), false);
  assert.equal(
    imp.validMove(g, { type: 'clue', text: `big ${own.toUpperCase()}!` }, 0),
    false,
  );
  assert.equal(imp.validMove(g, { type: 'clue', text: '   ' }, 0), false);
  assert.equal(
    imp.validMove(g, { type: 'clue', text: 'x'.repeat(imp.clueLimit + 1) }, 0),
    false,
  );
  g = imp.play(g, { type: 'clue', text: '  quiet   ' }, 0, NOW);
  assert.equal(g.clues[0].text, 'quiet');
  assert.equal(imp.observe(g, 1).clues[0].text, '');
  assert.ok(imp.observe(g, 1).clues[0].locked);
  // Every drawing is public once the clues start.
  assert.equal(imp.observe(g, 1).sketches[0].locked, true);
  assert.ok(imp.givesAway('spiderman', 'Spider web'));
  assert.ok(!imp.givesAway('sticky', 'Spider web'));
});

await test('Impostor: accusing the impostor scores, an escape scores more', () => {
  let g = imp.createGame(5, 14, 'medium', new Set(), NOW);
  const [bad] = g.impostors;
  const other = (s) => (s === bad ? (bad + 1) % 5 : bad);
  g = toReveal(g, other);
  assert.equal(g.phase, 'vote');
  assert.deepEqual(g.result.caught, [bad]);
  for (let s = 0; s < 5; s++)
    assert.equal(g.result.gains[s], s === bad ? 0 : imp.foundPoints);
  assert.ok(g.vote.host, 'the host picks what next by default');
  // Everything is shown at the reveal.
  assert.deepEqual(imp.observe(g, 0).impostors, [bad]);
  assert.equal(imp.observe(g, 0).words.filter(Boolean).length, 5);
  assert.ok(saved(g));

  let h = imp.createGame(5, 15, 'medium', new Set(), NOW);
  const [odd] = h.impostors;
  const innocent = (odd + 1) % 5;
  h = toReveal(h, (s) => (s === innocent ? (innocent + 1) % 5 : innocent));
  assert.deepEqual(h.result.caught, []);
  assert.equal(h.result.gains[odd], imp.escapePoints);
  assert.equal(h.result.tally[innocent], 4);
});

await test('Impostor: a tie at the top still catches the impostor', () => {
  let g = imp.createGame(4, 16, 'medium', new Set(), NOW);
  const [bad] = g.impostors;
  const others = [0, 1, 2, 3].filter((s) => s !== bad);
  // Two on the impostor, two on one innocent player.
  g = toReveal(g, (s) =>
    s === others[0] || s === others[1]
      ? bad
      : s === bad
        ? others[2]
        : others[2] === s
          ? others[0]
          : others[2],
  );
  const top = Math.max(...g.result.tally);
  assert.equal(g.result.tally[bad], top);
  assert.deepEqual(g.result.caught, [bad]);
});

await test('Impostor: two impostors from seven players, and the role goes round', () => {
  let g = imp.createGame(7, 17, 'medium', new Set(), NOW);
  assert.equal(g.impostors.length, 2);
  assert.equal(g.words[g.impostors[0]], g.words[g.impostors[1]]);
  const seen = new Set(g.impostors);
  for (let round = 0; round < 3; round++) {
    g = toReveal(g, (s) => (s + 1) % 7);
    g = imp.play(g, { type: 'vote', choice: 'more' }, 0, NOW);
    assert.equal(g.phase, 'draw');
    for (const s of g.impostors) seen.add(s);
  }
  assert.equal(
    seen.size,
    7,
    'nobody plays impostor twice before everyone has once',
  );
  assert.ok(g.turns.every((t) => t >= 1 && t <= 2));
});

await test('Impostor: the host picks another round or the end', () => {
  let g = imp.createGame(3, 18, 'medium', new Set(), NOW);
  const pair = g.pair;
  g = toReveal(g, (s) => (s + 1) % 3);
  g = imp.play(g, { type: 'vote', choice: 'more' }, 1, NOW + 5);
  assert.equal(g.round, 2);
  assert.equal(g.phase, 'draw');
  assert.notEqual(g.pair, pair);
  assert.equal(g.drawEndsAt, NOW + 5 + imp.drawMs);
  g = toReveal(g, (s) => (s + 2) % 3);
  g = imp.play(g, { type: 'vote', choice: 'finish' }, 0, NOW);
  assert.ok(g.over);
  assert.equal(g.phase, 'reveal');
  assert.ok(saved(g));
  const result = standaloneGames.impostor.outcome(g);
  assert.ok(result.winners.length >= 1);
  assert.equal(result.rows.length, 3);

  // With votes on, the table has ten seconds and silence keeps playing.
  let v = imp.createGame(3, 19, 'medium', new Set(), NOW, true);
  v = toReveal(v, (s) => (s + 1) % 3);
  assert.ok(!v.vote.host);
  assert.ok(v.vote.endsAt > NOW);
  v = imp.tick(v, v.vote.endsAt);
  assert.equal(v.phase, 'draw');
  assert.equal(v.round, 2);
});

await test('Impostor: fresh pairs come first', () => {
  const seen = new Set(wordPairs.slice(0, 30).map((p) => imp.pairKey(p.id)));
  const g = imp.createGame(4, 20, 'medium', seen, NOW);
  assert.ok(g.pair >= 30);
  assert.ok(g.deck.slice(0, 9).every((id) => id >= 30));
});

await test('Impostor: bots finish a practice round from what they can see', () => {
  let g = practice('impostor', 4, 'medium');
  assert.equal(deadline(g), null);
  for (let i = 0; i < 4 && !g.over; i++) {
    // Seat 0 plays along; the coach moves everyone else.
    for (const m of [{ type: 'stroke', stroke: stroke() }, { type: 'lock' }])
      if (standaloneGames.impostor.validMove(g, m, 0))
        g = standaloneGames.impostor.play(g, m, 0);
    if (g.phase === 'clue' && !g.clues[0].locked)
      g = standaloneGames.impostor.play(g, { type: 'clue', text: 'maybe' }, 0);
    if (g.phase === 'accuse' && !g.accusations[0].locked)
      g = standaloneGames.impostor.play(g, { type: 'accuse', target: 1 }, 0);
    g = advancePractice(g, 0);
  }
  assert.equal(g.phase, 'vote');
  assert.ok(g.result);
  assert.ok(saved(g));
});

await test('Impostor online: private words per seat, moves keyed to the round', async () => {
  const db = openDatabase(':memory:');
  for (let i = 0; i < 3; i++)
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      `u${i}`,
      `u${i}@example.com`,
      `P${i}`,
      'unused',
    );
  const tables = new Tables(db, () => true);
  const people = Array.from({ length: 3 }, (_, i) => ({
    id: `u${i}`,
    name: `P${i}`,
    userId: `u${i}`,
    sessionHash: 't',
    expires: Date.now() + 99999,
  }));
  let t = tables.create(people[0]);
  const cmd = (who, action) =>
    (t = tables.command(t.token, who, {
      action,
      requestId: randomUUID(),
      revision: t.revision,
      matchId: t.matchId,
    }));
  cmd(people[0], {
    type: 'configure',
    gameId: 'impostor',
    difficulty: 'medium',
    capacity: 3,
  });
  for (const p of people.slice(1)) t = tables.join(t.token, p);
  cmd(people[0], { type: 'start' });
  assert.equal(t.status, 'playing');
  const g = t.adventure;
  assert.equal(g.kind, 'impostor');
  for (const [s, p] of people.entries()) {
    const view = tables.view(t, p).adventure;
    assert.equal(view.words.filter(Boolean).length, 1);
    assert.equal(view.pair, -1);
    cmd(p, {
      type: 'adventure-move',
      move: { type: 'stroke', stroke: stroke() },
      key: decisionKey(t.adventure),
    });
    cmd(p, {
      type: 'adventure-move',
      move: { type: 'lock' },
      key: decisionKey(t.adventure),
    });
    assert.equal(t.adventure.sketches[s].locked, true);
  }
  assert.equal(t.adventure.phase, 'clue');
  assert.equal(observe(t.adventure, 0).sketches[1].strokes.length, 1);
  // A finished match records the pair so the table gets fresh ones next time.
  assert.ok(tables.contentHistory(t).has(imp.pairKey(g.pair)));
});
