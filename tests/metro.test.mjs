import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, edgeBetween, maps } from '../lib/games/metro/map.ts';
import {
  BANK_CARDS,
  DECK,
  ROUNDS,
  cardSide,
  colourOf,
  createMetro,
  fromStations,
  isMetroGame,
  legalDraws,
  lineState,
  observe,
  outcome,
  play,
  scoreSeat,
  unseen,
  validMove,
} from '../lib/games/metro/engine.ts';
import { botTurn } from '../lib/games/metro/bot.ts';
import {
  INTERCHANGE_POINTS,
  goalDone,
  interchanges,
  lineScore,
  partScore,
} from '../lib/games/metro/score.ts';

const m = maps.city;
const at = (x, y) => m.stations.find((s) => s.x === x && s.y === y).id;

/** A game whose turn shows exactly these cards, for seat 0's colour. */
function withCards(g, cards, colour) {
  const next = structuredClone(g);
  next.cards = cards;
  if (colour !== undefined) next.seats[0].order[next.round - 1] = colour;
  return next;
}

await test('the city: twelve districts, balanced shapes, one start per main district', () => {
  assert.equal(m.districts.length, 12);
  assert.equal(m.districts.filter((d) => d.outer).length, 4);
  for (const d of m.districts.filter((d) => d.outer))
    assert.equal(m.stations.filter((s) => s.district === d.id).length, 1);
  for (const d of m.districts.filter((d) => !d.outer)) {
    const shapes = new Set(
      m.stations.filter((s) => s.district === d.id).map((s) => s.shape),
    );
    assert.equal(shapes.size, 4, 'every main district holds all four shapes');
  }
  for (const side of ['moon', 'sun'])
    for (const shape of SHAPES)
      assert.equal(
        m.stations.filter((s) => s.side === side && s.shape === shape).length,
        7,
      );
  const startDistricts = m.starts.flat().map((s) => m.stations[s].district);
  assert.equal(new Set(startDistricts).size, 8);
  m.starts.forEach(([moon, sun]) => {
    assert.equal(m.stations[moon].side, 'moon');
    assert.equal(m.stations[sun].side, 'sun');
    assert.equal(m.stations[moon].shape, m.stations[sun].shape);
  });
  for (const s of m.stations) assert.ok(m.adj[s.id].length >= 2, `station ${s.id} has room`);
});

await test('a hop never passes a station, and crossing hops are known', () => {
  // (0,0) to (2,0) passes (1,0), an empty point.
  const e = edgeBetween(m, at(0, 0), at(2, 0));
  assert.ok(e !== undefined);
  assert.deepEqual(m.edges[e].via, [1]);
  // (2,0)–(3,0) are neighbours, so (0,0) cannot reach (3,0) directly.
  assert.equal(edgeBetween(m, at(0, 0), at(3, 0)), undefined);
  for (const [i, list] of m.crosses.entries())
    for (const j of list) assert.ok(m.crosses[j].includes(i));
});

await test('the deck: five cards a bank and the switch', () => {
  assert.equal(DECK.length, 11);
  assert.equal(DECK.filter((c) => cardSide(c) === 'moon').length, BANK_CARDS);
  assert.equal(DECK.filter((c) => cardSide(c) === 'sun').length, BANK_CARDS);
});

await test('the first section leaves the start on the card’s bank for a station of its shape', () => {
  const start = m.starts[0][0];
  const near = m.edges[m.adj[start][0]];
  const shape = m.stations[near.a === start ? near.b : near.a].shape;
  const g = withCards(createMetro(1, 7, { bots: [false] }), [`moon:${shape}`], 0);
  assert.deepEqual(fromStations(g, 0), [start]);
  const draws = legalDraws(g, 0);
  assert.ok(draws.length > 0);
  for (const d of draws) {
    assert.equal(d.from, start);
    assert.equal(m.stations[d.to].shape, shape);
  }
  // The Sun bank's card leaves from the Sun start instead.
  assert.deepEqual(fromStations(withCards(g, ['sun:any']), 0), [m.starts[0][1]]);
  const next = play(g, { type: 'draw', ...draws[0] }, 0);
  assert.equal(next.seats[0].sections.length, 1);
  // One section a turn.
  assert.equal(legalDraws(next, 0).length, 0);
  assert.ok(!validMove(next, { type: 'draw', ...draws[0] }, 0));
  // Undo takes it back.
  const undone = play(next, { type: 'undo' }, 0);
  assert.equal(undone.seats[0].sections.length, 0);
});

await test('lines extend from either end, never loop, and never cross', () => {
  let g = createMetro(1, 3, { bots: [false] });
  g.seats[0].order[0] = 0;
  const start = m.starts[0][0];
  // Draw by hand: any first hop, then check a later hop from the far end.
  g = withCards(g, ['moon:any']);
  const first = legalDraws(g, 0)[0];
  g = play(g, { type: 'draw', ...first }, 0);
  assert.deepEqual(g.seats[0].boxed, [first.to], 'a wild card boxes the station');
  g = play(g, { type: 'done' }, 0);
  g = withCards(g, ['moon:any']);
  const num = (a, b) => a - b;
  const froms = fromStations(g, 0).sort(num);
  assert.deepEqual(froms, [start, first.to].sort(num));
  for (const d of legalDraws(g, 0)) {
    const ls = lineState(g, 0);
    assert.ok(!ls.halves[0].has(d.to), 'no station twice on a line');
    const e = edgeBetween(m, d.from, d.to);
    for (const s of g.seats[0].sections) assert.ok(!m.crosses[e].includes(s.e));
  }
});

await test('scoring: districts times the busiest district, plus 10 for joining', () => {
  // Hand-made line: three stations in one district, one in another.
  const part = partScore(m, [0, 1, 2, 3].map((i) => i), null);
  assert.equal(part.points, part.districts * part.most);
  // Join red's two starts along a path found by search, then score.
  const [moon, sun] = m.starts[0];
  const prev = new Map([[moon, -1]]);
  const queue = [moon];
  while (queue.length) {
    const u = queue.shift();
    if (u === sun) break;
    for (const e of m.adj[u]) {
      const v = m.edges[e].a === u ? m.edges[e].b : m.edges[e].a;
      if (!prev.has(v)) {
        prev.set(v, u);
        queue.push(v);
      }
    }
  }
  const path = [];
  for (let v = sun; v !== -1; v = prev.get(v)) path.push(v);
  const sections = path
    .slice(1)
    .map((v, i) => ({ e: edgeBetween(m, v, path[i]), c: 0, r: 1, t: i + 1, from: v }));
  const line = lineScore(m, sections, 0);
  assert.ok(line.joined);
  assert.equal(line.bonus, 10);
  assert.equal(line.parts.length, 1);
  assert.equal(line.total, line.parts[0].points + 10);
  // Two halves score apart and without the bonus.
  const split = lineScore(m, sections.slice(0, 1), 0);
  assert.equal(split.joined, false);
  assert.equal(split.bonus, 0);
  // Outskirts counts an outer district three times; Double doubles the busiest.
  const corner = m.stations.find((s) => m.districts[s.district].outer).id;
  assert.equal(partScore(m, [corner], 'outskirts').districts, 3);
  assert.equal(partScore(m, [corner], 'double').most, 2);
});

await test('interchanges score 2, 5 and 9, and a boxed one counts twice', () => {
  const s = at(3, 2);
  const lines = m.adj[s].slice(0, 4).map((e, c) => ({ e, c, r: c + 1, t: 1, from: s }));
  assert.equal(interchanges(m, lines.slice(0, 2), []).points, INTERCHANGE_POINTS[2]);
  assert.equal(interchanges(m, lines.slice(0, 3), []).points, INTERCHANGE_POINTS[3]);
  assert.equal(interchanges(m, lines.slice(0, 2), [s]).points, 2 * INTERCHANGE_POINTS[2]);
  // A boxed station on one line only is not an interchange.
  assert.equal(interchanges(m, lines.slice(0, 1), [s]).points, 0);
});

await test('the switch: one section from anywhere on each half', () => {
  let g = createMetro(1, 11, { bots: [false] });
  g.seats[0].order[0] = 1;
  g = withCards(g, ['moon:any']);
  const a = legalDraws(g, 0)[0];
  g = play(play(g, { type: 'draw', ...a }, 0), { type: 'done' }, 0);
  g = withCards(g, ['moon:any']);
  const b = legalDraws(g, 0).find((d) => d.from === a.to);
  if (b) g = play(play(g, { type: 'draw', ...b }, 0), { type: 'done' }, 0);
  g = withCards(g, ['sw', 'sun:any']);
  const froms = new Set(fromStations(g, 0));
  // Every station of the Moon half, the middle included, and the Sun start.
  for (const st of lineState(g, 0).halves[0]) assert.ok(froms.has(st));
  assert.ok(froms.has(m.starts[1][1]));
  const moonDraw = legalDraws(g, 0).find((d) => lineState(g, 0).halves[0].has(d.from));
  g = play(g, { type: 'draw', ...moonDraw }, 0);
  // The second section must come from the other half.
  for (const d of legalDraws(g, 0)) assert.ok(lineState(g, 0).halves[1].has(d.from));
});

await test('a round ends on the turn the fifth card of a bank flips', () => {
  let g = createMetro(2, 5, { bots: [false, true] });
  let rounds = 0;
  let turns = 0;
  for (let guard = 0; guard < 200 && !g.over; guard++) {
    const round = g.round;
    g = play(play(g, { type: 'done' }, 0), { type: 'done' }, 1);
    turns++;
    if (g.round !== round || g.over) {
      rounds++;
      assert.ok(turns >= 5 && turns <= 9, `round lasted ${turns} turns`);
      turns = 0;
    }
  }
  assert.equal(rounds, ROUNDS);
  assert.ok(g.over);
  assert.equal(g.final.length, 2);
});

await test('everyone draws all four colours, one a round', () => {
  for (const n of [1, 2, 3, 4, 6]) {
    const g = createMetro(n, 9);
    for (const s of g.seats) assert.deepEqual([...s.order].sort((a, b) => a - b), [0, 1, 2, 3]);
    if (n > 1 && n <= 4) {
      const firsts = g.seats.map((s) => s.order[0]);
      assert.equal(new Set(firsts).size, n, 'no two seats share a colour in a round');
    }
  }
});

await test('others see your turn only once it is done, and never the pile', () => {
  let g = createMetro(2, 21, { bots: [false, false] });
  const d = legalDraws(g, 0)[0];
  if (d) g = play(g, { type: 'draw', ...d }, 0);
  const seen = observe(g, 1);
  assert.equal(seen.seats[0].sections.length, 0);
  assert.equal(seen.seats[0].hidden, d ? 1 : undefined);
  assert.deepEqual(seen.deck, []);
  assert.equal(seen.deckSize, g.deck.length);
  assert.equal(observe(g, 0).seats[0].sections.length, d ? 1 : 0);
  assert.equal(unseen(seen).length, DECK.length - g.shown.length);
});

await test('peek shows the next card to everyone', () => {
  const g = createMetro(2, 2, { ext: { express: true } });
  g.express[0] = 'peek';
  assert.deepEqual(observe(g, 1).deck, g.deck.slice(0, 1));
});

await test('saves are checked before they are trusted', () => {
  const g = createMetro(3, 4, { ext: { goals: true, express: true } });
  assert.ok(isMetroGame(g));
  assert.ok(isMetroGame(JSON.parse(JSON.stringify(g))));
  assert.ok(!isMetroGame({ ...g, rules: 99 }));
  assert.ok(!isMetroGame({ ...g, seats: [] }));
  assert.equal(g.goals.length, 2);
  assert.equal(g.express.length, ROUNDS);
  assert.notEqual(g.express[0], 'parallel');
});

await test('bots finish whole matches in every setup, and Hard beats Easy', () => {
  const avg = (difficulty, ext) => {
    let sum = 0;
    for (let k = 0; k < 3; k++) {
      let g = createMetro(3, 100 + k, { difficulty, ext, bots: [true, true, true] });
      for (let guard = 0; guard < 300 && !g.over; guard++)
        for (let s = 0; s < 3; s++)
          if (!g.seats[s].locked)
            for (const mv of botTurn(observe(g, s), s)) {
              assert.ok(validMove(g, mv, s), 'bots only make legal moves');
              g = play(g, mv, s);
            }
      assert.ok(g.over);
      assert.ok(outcome(g).winners.length >= 1);
      g.seats.forEach((_, i) => {
        assert.equal(scoreSeat(g, i).total, g.final[i].total);
        for (const id of g.goals)
          assert.equal(
            g.final[i].goals.includes(id),
            goalDone(m, id, g.seats[i].sections, g.seats[i].boxed),
          );
      });
      sum += g.final.reduce((t, f) => t + f.total, 0) / 3;
    }
    return sum / 3;
  };
  const hard = avg('hard', { goals: true, express: true });
  const easy = avg('easy', {});
  avg('medium', { goals: true });
  assert.ok(hard > easy, `hard ${hard} vs easy ${easy}`);
});

await test('a colour belongs to its round', () => {
  const g = createMetro(4, 12);
  g.seats.forEach((s, i) => assert.equal(colourOf(g, i), s.order[0]));
});
