import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRelic, actRelic } from '../lib/games/relic/engine.ts';
import {
  AVERAGES,
  BOOKS,
  COIN_SIZES,
  LEVEL_AT,
  PRICE_SHARE,
  UPGRADES,
  actScratch,
  botReward,
  brushRadius,
  handFor,
  level,
  levelOpen,
  nextBook,
  prizeUnit,
  rubTicket,
  scratchFor,
  ticketPrice,
  ticketReward,
  upgradeCost,
  upgradeReady,
} from '../lib/games/relic/scratch.ts';
import {
  crownSolutions,
  dirTo,
  ladderRow,
  neighbours,
  openSeal,
  pathStep,
  printTicket,
  prizeUnits,
  sealLocked,
  suggest,
  tangoSolutions,
  twinSolutions,
} from '../lib/games/relic/books.ts';
import {
  actFactory,
  advanceFactory,
  machinePrice,
  floorSize,
} from '../lib/games/relic/factory.ts';
import { openDatabase } from '../server/database.ts';
import { Expeditions } from '../server/expeditions.ts';
const start = 1789992000000;
const FOIL = [0.72, 0.5, 0.3, 0.04];
const game = (seed = 123) =>
  createRelic('Our scratch desk', 'dunes', seed, start);
const actor = (id) => ({
  id,
  name: id,
  userId: null,
  sessionHash: 'test',
  expires: start + 1e12,
});
const rand =
  (seed = 5) =>
  () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
function unlock(g, pack) {
  for (const p of BOOKS) {
    if (!g.scratch.unlocked.includes(p.id)) g.scratch.unlocked.push(p.id);
    if (p.id === pack) break;
  }
}
/** Buys a ticket into the player's hand, finishing the one held first. */
function take(g, pack = 'seven', who = 'Jo', lvl) {
  const held = handFor(g.scratch, who);
  if (held && !held.ended) play(g, held, who);
  actScratch(g, { type: 'scratch-open', pack, level: lvl }, who, start);
  return handFor(g.scratch, who);
}
/** Plays the held ticket carefully to its end, then lets the server settle it. */
function play(g, t, who = 'Jo', r = rand()) {
  while (!t.ended) openSeal(t, suggest(t, r));
  return actScratch(
    g,
    {
      type: 'scratch-stroke',
      ticket: t.id,
      sequence: t.sequence,
      points: [{ x: 0, y: 0 }],
    },
    who,
    start,
  );
}
const x = (t, i) => i % t.cols,
  y = (t, i) => Math.floor(i / t.cols);

await test('held movement removes foil geometrically; dots and lifted coins never open a seal', () => {
  const g = game(),
    t = take(g);
  actScratch(
    g,
    {
      type: 'scratch-stroke',
      ticket: t.id,
      sequence: 0,
      points: [{ x: 0.375, y: 0.375 }],
    },
    'Jo',
    start,
  );
  assert.ok(t.cells.some((c) => c.mask.includes('1')));
  assert.ok(t.cells.every((c) => !c.revealed));
  assert.throws(
    () =>
      actScratch(
        g,
        {
          type: 'scratch-stroke',
          ticket: t.id,
          sequence: 0,
          points: [{ x: 0.375, y: 0.375 }],
        },
        'Jo',
        start,
      ),
    /syncing/,
  );
  const fast = printTicket(2, 'seven', 0, rand(8), 0, start);
  rubTicket(fast, g.scratch, [
    { x: 0.02, y: 0.375 },
    { x: 0.98, y: 0.375 },
  ]);
  for (const i of [4, 5, 6, 7]) assert.ok(fast.cells[i].mask.includes('1'));
  const lifted = printTicket(3, 'seven', 0, rand(8), 0, start);
  rubTicket(lifted, g.scratch, [{ x: 0.05, y: 0.375 }]);
  rubTicket(lifted, g.scratch, [{ x: 0.95, y: 0.375 }]);
  assert.ok(!lifted.cells[5].mask.includes('1'));
});

await test('a ticket pays the moment it is over, once, with no collect step', () => {
  const g = game(),
    t = take(g);
  assert.equal(g.coins, 0);
  assert.equal(t.cost, 0, 'an empty purse gets a free Lucky Seven I');
  const result = play(g, t);
  assert.ok(result.scratchCoins > 0);
  assert.equal(t.claimed, true);
  assert.equal(g.coins, t.payout);
  assert.equal(g.scratch.completed, 1);
  assert.equal(g.scratch.books.seven, 1);
  const again = actScratch(
    g,
    {
      type: 'scratch-stroke',
      ticket: t.id,
      sequence: t.sequence,
      points: [{ x: 0.5, y: 0.5 }],
    },
    'Jo',
    start,
  );
  assert.equal(again.scratchCoins, undefined);
  assert.equal(g.coins, t.payout);
  assert.throws(() =>
    actRelic(g, { type: 'scratch-claim', ticket: t.id }, 'Jo', start),
  );
});

await test('tickets cost half of what a careful player wins; a bad ticket loses', () => {
  const g = game();
  g.coins = 1e6;
  const price = ticketPrice(g.scratch, 'seven', 0);
  const [units, perfect] = AVERAGES.seven[0];
  assert.equal(price, Math.round(units * (1 + perfect * 2) * PRICE_SHARE));
  const t = take(g);
  assert.equal(t.cost, price);
  assert.equal(g.coins, 1e6 - price);
  // Four misses and no seven: the ticket pays its four coins at most.
  for (const i of t.cells.flatMap((c, i) => (c.face === 'seven' ? [] : [i])))
    if (!t.ended) openSeal(t, i);
  play(g, t);
  assert.ok(!t.perfect && t.payout < price, 'a failed ticket loses money');
  // Richer prizes raise prizes and prices together.
  g.scratch.upgrades.value = 1;
  assert.equal(ticketPrice(g.scratch, 'seven', 0), price * 2);
  g.scratch.upgrades.discount = 2;
  assert.equal(ticketPrice(g.scratch, 'seven', 0), Math.round(price * 2 * 0.8));
  // The house ticket is only ever Lucky Seven I.
  play(g, take(g));
  g.coins = 0;
  g.scratch.books.seven = LEVEL_AT[1];
  assert.throws(
    () => actScratch(g, { type: 'scratch-open', pack: 'seven' }, 'Jo', start),
    /more coins/,
  );
  assert.equal(take(g, 'seven', 'Jo', 0).cost, 0);
});

await test('each player holds one ticket; another waits until it is over', () => {
  const g = game();
  g.coins = 1e6;
  const t = take(g);
  assert.throws(
    () => actScratch(g, { type: 'scratch-open', pack: 'seven' }, 'Jo', start),
    /Finish the ticket/,
  );
  const other = take(g, 'seven', 'Mara');
  assert.notEqual(other.id, t.id);
  assert.equal(handFor(g.scratch, 'Jo'), t);
  play(g, t);
  const next = take(g);
  assert.equal(handFor(g.scratch, 'Jo'), next);
  assert.equal(handFor(g.scratch, 'Mara'), other);
});

await test('insurance refunds part of a losing ticket; a lucky draw is free', () => {
  const g = game();
  g.coins = 1e6;
  g.scratch.upgrades.insurance = 2;
  const t = take(g);
  for (const i of t.cells.flatMap((c, i) => (c.face === 'seven' ? [] : [i])))
    if (!t.ended) openSeal(t, i);
  const before = g.coins;
  play(g, t);
  assert.equal(t.refund, Math.floor((t.cost - t.payout) * 0.5));
  assert.equal(g.coins, before + t.payout + t.refund);
  g.scratch.upgrades.freebie = 4;
  let free = 0;
  for (let i = 0; i < 80; i++) if (take(g).cost === 0) free++;
  assert.ok(free > 8 && free < 35, String(free));
});

await test('books open their harder levels by being played; any open level can be chosen', () => {
  const g = game();
  assert.equal(levelOpen(g.scratch, 'seven'), 0);
  g.coins = 1e9;
  assert.throws(() => take(g, 'seven', 'Jo', 1), /Play that book more/);
  assert.throws(() => take(g, 'seven', 'Jo', -1));
  assert.throws(() => take(g, 'seven', 'Jo', 1.5));
  g.scratch.books.seven = LEVEL_AT[1];
  assert.equal(levelOpen(g.scratch, 'seven'), 1);
  assert.equal(take(g, 'seven', 'Jo', 1).cells.length, 25);
  assert.equal(take(g, 'seven', 'Jo', 0).cells.length, 16);
  assert.equal(take(g).level, 1, 'the highest open level by default');
  g.scratch.books.seven = LEVEL_AT[2];
  assert.equal(take(g).cells.length, 30);
  // Early print opens levels sooner.
  g.scratch.books.twins = 4;
  g.scratch.upgrades.early = 3;
  assert.equal(levelOpen(g.scratch, 'twins'), 1);
  // Harder levels are worth more for every prize unit.
  assert.ok(
    prizeUnit(g.scratch, 'seven', 2) > prizeUnit(g.scratch, 'seven', 0) * 3,
  );
});

await test('Lucky Seven: every miss points toward a seven; the misses left scratch themselves', () => {
  for (let seed = 1; seed < 40; seed++) {
    const t = printTicket(1, 'seven', 0, rand(seed), 0, start),
      seven = t.cells.findIndex((c) => c.face === 'seven');
    assert.equal(t.cells.length, 16);
    assert.equal(t.cells.filter((c) => c.face === 'seven').length, 1);
    const first = seven === 5 ? 0 : 5;
    openSeal(t, first);
    assert.equal(t.cells[first].dir, dirTo(4, first, seven));
    assert.equal(t.cells[first].n, undefined, 'no distance without the helper');
    assert.equal(t.mistakes, 1);
    openSeal(t, seven);
    assert.ok(t.ended && t.perfect, 'finding the seven ends the ticket');
    assert.equal(t.mistakes, 1);
    // The three misses left were scratched for their coins.
    assert.equal(t.cells.filter((c) => c.auto).length, 3);
    assert.equal(t.cells.filter((c) => c.paid).length, 5);
  }
  const hot = printTicket(1, 'seven', 1, rand(3), { helper: 1 }, start),
    miss = hot.cells.findIndex((c) => c.face !== 'seven');
  openSeal(hot, miss);
  const sevens = hot.cells.flatMap((c, i) => (c.face === 'seven' ? [i] : []));
  assert.equal(
    hot.cells[miss].n,
    Math.min(
      ...sevens.map((i) =>
        Math.max(
          Math.abs(x(hot, i) - x(hot, miss)),
          Math.abs(y(hot, i) - y(hot, miss)),
        ),
      ),
    ),
  );
  const lost = printTicket(1, 'seven', 0, rand(3), 0, start);
  for (const i of lost.cells
    .map((_, i) => i)
    .filter((i) => lost.cells[i].face !== 'seven')
    .slice(0, 4))
    openSeal(lost, i);
  assert.ok(lost.ended && !lost.perfect);
  assert.ok(
    lost.cells.every((c) => c.revealed),
    'the rest shows what it hid',
  );
});

await test('Twins: side-by-side pairs share a number and the ticket splits exactly one way', () => {
  for (const lvl of [0, 1, 2]) {
    const l = BOOKS[1].levels[lvl];
    for (let seed = 1; seed < 8; seed++) {
      const t = printTicket(1, 'twins', lvl, rand(seed + lvl * 10), 0, start);
      assert.equal(t.cells.length, l.cols * l.rows);
      for (let i = 0; i < t.cells.length; i++) {
        const mates = t.cells.flatMap((c, j) =>
          j !== i && c.group === t.cells[i].group ? [j] : [],
        );
        assert.equal(mates.length, 1);
        assert.ok(neighbours(t.cols, t.rows, i).includes(mates[0]));
        assert.equal(t.cells[mates[0]].n, t.cells[i].n);
        assert.ok(t.cells[i].n >= 1 && t.cells[i].n <= l.count);
      }
      const numbers = t.cells.map((c) => c.n);
      assert.equal(twinSolutions(t.cols, t.rows, numbers), 1);
      // Many seals have more than one twin to choose from.
      const unsure = numbers.filter(
        (v, i) =>
          neighbours(t.cols, t.rows, i).filter((j) => numbers[j] === v).length >
          1,
      ).length;
      assert.ok(unsure >= 4, `level ${lvl}: ${unsure} unsure seals`);
    }
  }
  const t = printTicket(1, 'twins', 0, rand(9), 0, start),
    twin = (i) =>
      t.cells.findIndex((c, j) => j !== i && c.group === t.cells[i].group);
  openSeal(t, 0);
  openSeal(t, twin(0));
  assert.ok(t.cells[0].paid && t.cells[twin(0)].paid);
  const a = t.cells.findIndex((c) => !c.revealed),
    b = t.cells.findIndex((c, j) => !c.revealed && j !== a && j !== twin(a));
  openSeal(t, a);
  openSeal(t, b);
  assert.equal(t.mistakes, 1);
  assert.ok(!t.cells[b].paid && t.cells[twin(b)].revealed, 'b spends its twin');
  assert.ok(!t.cells[a].paid, 'a still waits for its twin');
  openSeal(t, twin(a));
  assert.ok(t.cells[a].paid && t.cells[twin(a)].paid);
  const pairs = printTicket(1, 'twins', 1, rand(2), { helper: 2 }, start);
  assert.equal(pairs.cells.filter((c) => c.given && c.paid).length, 4);
});

await test('Garden: numbers lie in order along one full path; hedges never block it; a wrong step costs a heart', () => {
  for (const lvl of [0, 1, 2]) {
    const l = BOOKS[2].levels[lvl],
      t = printTicket(1, 'path', lvl, rand(lvl + 11), 0, start);
    const numbers = t.cells.filter((c) => c.n !== undefined).map((c) => c.n);
    assert.deepEqual(
      numbers.sort((a, b) => a - b),
      Array.from({ length: l.count }, (_, i) => i + 1),
    );
    assert.equal(t.walls.length, l.extra ?? 0);
    // A careful player walks every seal: the puzzle can always be finished.
    const walk = structuredClone(t),
      r = rand(1);
    while (!walk.ended) openSeal(walk, suggest(walk, r));
    assert.equal(walk.perfect, true, `level ${lvl}`);
    for (let k = 1; k < walk.order.length; k++) {
      const [a, b] = [walk.order[k - 1], walk.order[k]];
      assert.ok(neighbours(walk.cols, walk.rows, a).includes(b));
      assert.ok(!t.walls.includes(Math.min(a, b) * 64 + Math.max(a, b)));
    }
  }
  const t = printTicket(1, 'path', 2, rand(4), 0, start),
    two = t.cells.findIndex((c) => c.n === 2);
  assert.equal(pathStep(t, -1, two), false, 'the walk starts at 1');
  openSeal(t, two);
  assert.ok(t.ended && !t.perfect && prizeUnits(t) === 0);
  const map = printTicket(1, 'path', 0, rand(4), { helper: 2 }, start);
  assert.equal(map.cells.filter((c) => c.n !== undefined).length, 6);
});

await test('Ladder: scratch ▲ or ▼ on each rung; only the next rung can be scratched', () => {
  const l = BOOKS[3].levels[0],
    t = printTicket(1, 'ladder', 0, rand(2), 0, start);
  assert.equal(t.cells.length, 3 * l.rows);
  const cards = Array.from(
    { length: l.rows },
    (_, row) => t.cells[row * 3 + 1].n,
  );
  assert.equal(new Set(cards).size, l.rows, 'one deck, no card twice');
  assert.ok(cards.every((n) => n >= 1 && n <= l.count));
  assert.ok(t.cells.slice(-3).every((c) => c.given && c.revealed));
  assert.equal(t.last, cards.at(-1));
  assert.equal(ladderRow(t), l.rows - 2);
  assert.ok(sealLocked(t, 1), 'cards are never scratched');
  assert.ok(sealLocked(t, 0), 'higher rungs wait');
  assert.equal(openSeal(t, 0), false);
  // Climb: bet right on the first rung, wrong on the second.
  const row = ladderRow(t) * 3,
    up = cards[l.rows - 2] > t.last;
  openSeal(t, row + (up ? 0 : 2));
  assert.ok(t.cells[row + (up ? 0 : 2)].paid);
  assert.ok(t.cells[row + 1].revealed && t.cells[row + (up ? 2 : 0)].revealed);
  assert.equal(t.steps, 1);
  const next = ladderRow(t) * 3,
    higher = cards[l.rows - 3] > t.last;
  openSeal(t, next + (higher ? 2 : 0));
  assert.equal(t.mistakes, 1);
  assert.equal(prizeUnits(t), 1, 'the first rung pays one, the next two');
  while (!t.ended) openSeal(t, suggest(t, rand(1)));
  assert.ok(!t.perfect);
  const rope = printTicket(1, 'ladder', 0, rand(2), { helper: 1 }, start),
    r = ladderRow(rope) * 3;
  openSeal(rope, r + (cards[l.rows - 2] > rope.last ? 2 : 0));
  assert.equal(rope.mistakes, 0, 'the rope forgives one wrong guess');
  assert.equal(rope.rope, 0);
});

await test('Gold Mine: numbers count the dynamite, empty ground opens around it, dynamite ends the dig', () => {
  for (let seed = 1; seed < 12; seed++) {
    const t = printTicket(1, 'mine', 1, rand(seed), 0, start);
    assert.equal(
      t.cells.filter((c) => c.face === 'dynamite').length,
      BOOKS[4].levels[1].count,
    );
    t.cells.forEach((c, i) => {
      if (c.face === 'dynamite') return;
      const around = neighbours(t.cols, t.rows, i, true).filter(
        (j) => t.cells[j].face === 'dynamite',
      );
      assert.equal(c.n, around.length);
    });
    const entrance = t.cells.findIndex((c) => c.given);
    assert.equal(t.cells[entrance].n, 0);
    const zero = t.cells.findIndex(
      (c, i) => !c.revealed && c.n === 0 && i !== entrance,
    );
    if (zero >= 0) {
      openSeal(t, zero);
      for (const j of neighbours(t.cols, t.rows, zero, true))
        assert.ok(t.cells[j].revealed, 'empty ground opens its neighbours');
    }
    if (!t.ended)
      openSeal(
        t,
        t.cells.findIndex((c) => c.face === 'dynamite'),
      );
    assert.ok(t.ended);
  }
  const marked = printTicket(1, 'mine', 0, rand(5), { helper: 2 }, start),
    flags = marked.cells.flatMap((c, i) => (c.flag ? [i] : []));
  assert.equal(flags.length, 2);
  assert.ok(flags.every((i) => marked.cells[i].face === 'dynamite'));
  assert.ok(flags.every((i) => sealLocked(marked, i)));
  assert.equal(openSeal(marked, flags[0]), false, 'marked dynamite is safe');
});

await test('Sun & Moon: the printed seals and signs have exactly one answer; a sun costs a mistake', () => {
  for (const lvl of [0, 1, 2]) {
    const t = printTicket(1, 'sunmoon', lvl, rand(lvl + 21), 0, start);
    const fixed = t.cells.map((c) => (c.given ? c.face === 'moon' : null));
    assert.equal(
      tangoSolutions(t.cols, t.rows, fixed, t.signs ?? []),
      1,
      `level ${lvl}`,
    );
    for (let r = 0; r < t.rows; r++)
      assert.equal(
        t.cells
          .slice(r * t.cols, (r + 1) * t.cols)
          .filter((c) => c.face === 'moon').length,
        t.cols / 2,
      );
    for (const [a, b, same] of t.signs ?? [])
      assert.equal(t.cells[a].face === t.cells[b].face, same);
    const sun = t.cells.findIndex((c) => !c.given && c.face === 'sun');
    openSeal(t, sun);
    assert.equal(t.mistakes, 1);
    for (const [i, c] of t.cells.entries())
      if (!c.revealed && c.face === 'moon') openSeal(t, i);
    assert.ok(t.ended && t.perfect);
  }
  assert.equal(printTicket(1, 'sunmoon', 2, rand(4), 0, start).signs.length, 8);
});

await test('Sea Chart: edge numbers count ship parts, ships never touch, a sunk ship pays a bonus', () => {
  for (const lvl of [0, 1, 2]) {
    const t = printTicket(1, 'chart', lvl, rand(lvl + 31), 0, start);
    assert.deepEqual(
      t.ships.map((s) => s.length),
      BOOKS[6].levels[lvl].ships,
    );
    for (let r = 0; r < t.rows; r++)
      assert.equal(
        t.rowCounts[r],
        t.cells.filter((c, i) => y(t, i) === r && c.face === 'ship').length,
      );
    for (let c = 0; c < t.cols; c++)
      assert.equal(
        t.colCounts[c],
        t.cells.filter((cell, i) => x(t, i) === c && cell.face === 'ship')
          .length,
      );
    t.ships.forEach((ship, s) => {
      for (const cell of ship)
        for (const n of neighbours(t.cols, t.rows, cell, true))
          assert.ok(!t.ships.some((other, o) => o !== s && other.includes(n)));
    });
    for (const cell of t.ships[0]) openSeal(t, cell);
    assert.equal(t.bonus, t.ships[0].length * 2);
  }
  const sonar = printTicket(1, 'chart', 0, rand(5), { helper: 2 }, start);
  assert.equal(
    sonar.cells.filter((c) => c.given && c.paid && c.face === 'ship').length,
    2,
  );
});

await test('a golden seal pays ten times its prize', () => {
  const t = printTicket(1, 'seven', 0, rand(6), { gold: 1 }, start),
    gold = t.cells.findIndex((c) => c.gold);
  assert.ok(gold >= 0 && t.cells[gold].prize > 0);
  t.cells[gold].paid = true;
  assert.equal(prizeUnits(t), t.cells[gold].prize * 10);
  assert.ok(
    !printTicket(1, 'seven', 0, rand(6), 0, start).cells.some((c) => c.gold),
  );
});

await test('Crown Jewels: one crown per row, column and colour, never touching, with exactly one answer', () => {
  for (const lvl of [0, 1, 2]) {
    const t = printTicket(1, 'crown', lvl, rand(lvl + 41), 0, start),
      crowns = t.cells.flatMap((c, i) => (c.face === 'crown' ? [i] : []));
    assert.equal(crowns.length, t.cols);
    assert.equal(new Set(crowns.map((i) => x(t, i))).size, t.cols);
    assert.equal(new Set(crowns.map((i) => y(t, i))).size, t.cols);
    assert.equal(new Set(crowns.map((i) => t.cells[i].group)).size, t.cols);
    for (const a of crowns)
      for (const b of crowns)
        if (a !== b)
          assert.ok(
            Math.max(Math.abs(x(t, a) - x(t, b)), Math.abs(y(t, a) - y(t, b))) >
              1,
          );
    assert.equal(
      crownSolutions(
        t.cols,
        t.cells.map((c) => c.group),
      ),
      1,
      `level ${lvl}`,
    );
  }
});

await test('the factory averages still match what a careful player earns', () => {
  for (const book of BOOKS)
    book.levels.forEach((_, lvl) => {
      const r = rand(lvl + 7);
      let units = 0,
        perfect = 0;
      for (let i = 0; i < 300; i++) {
        const t = printTicket(1, book.id, lvl, r, 0, start);
        while (!t.ended) openSeal(t, suggest(t, r));
        units += prizeUnits(t);
        perfect += t.perfect ? 1 : 0;
      }
      const [u, p] = AVERAGES[book.id][lvl];
      assert.ok(
        Math.abs(units / 300 - u) / u < 0.12,
        `${book.id} ${lvl}: ${units / 300} units`,
      );
      assert.ok(
        Math.abs(perfect / 300 - p) < 0.12,
        `${book.id} ${lvl}: ${perfect / 300} perfect`,
      );
    });
});

await test('books are bought in order with coins, each far dearer than the last', () => {
  const g = game();
  assert.deepEqual(g.scratch.unlocked, ['seven']);
  assert.throws(
    () => actScratch(g, { type: 'scratch-book', pack: 'path' }, 'Jo', start),
    /order/,
  );
  assert.throws(
    () => actScratch(g, { type: 'scratch-book', pack: 'twins' }, 'Jo', start),
    /more coins/,
  );
  const prices = BOOKS.map((p) => p.price);
  assert.equal(prices[0], 0);
  for (let i = 2; i < prices.length; i++)
    assert.ok(prices[i] / prices[i - 1] >= 10, BOOKS[i].id);
  g.coins = 1e18;
  for (const p of BOOKS.slice(1)) {
    const before = g.coins;
    actScratch(g, { type: 'scratch-book', pack: p.id }, 'Jo', start);
    assert.equal(g.coins, before - p.price);
  }
  assert.equal(nextBook(g.scratch), undefined);
});

await test('every upgrade rank is a big step, priced along one ladder, bought in path order', () => {
  assert.equal(new Set(UPGRADES.map((u) => u.id)).size, UPGRADES.length);
  const g = game();
  g.coins = 1e300;
  assert.throws(
    () => actScratch(g, { type: 'scratch-upgrade', id: 'foil' }, 'Jo', start),
    /before it/,
  );
  assert.throws(
    () =>
      actScratch(g, { type: 'scratch-upgrade', id: 'printers' }, 'Jo', start),
    /before it|factory/,
  );
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  assert.ok(
    !upgradeReady(
      g.scratch,
      UPGRADES.find((u) => u.id === 'mine-prize'),
    ),
  );
  unlock(g, 'crown');
  assert.ok(UPGRADES.length >= 40, `${UPGRADES.length} upgrades`);
  for (const u of UPGRADES) {
    if (u.requires) assert.ok(UPGRADES.some((p) => p.id === u.requires));
    assert.ok(upgradeReady(g.scratch, u), u.id);
    for (let r = 1; r < u.prices.length; r++)
      assert.ok(u.prices[r] / u.prices[r - 1] >= 5, `${u.id} rank ${r}`);
    const shown = new Set([u.show(0)]);
    while (level(g.scratch, u.id) < u.max) {
      const cost = upgradeCost(g.scratch, u),
        coins = g.coins;
      actScratch(g, { type: 'scratch-upgrade', id: u.id }, 'Jo', start);
      assert.equal(g.coins, coins - cost);
      shown.add(u.show(level(g.scratch, u.id)));
    }
    assert.equal(
      shown.size,
      u.max + 1,
      `${u.id} changes its number every rank`,
    );
    assert.throws(
      () => actScratch(g, { type: 'scratch-upgrade', id: u.id }, 'Jo', start),
      /complete/,
    );
  }
  assert.equal(brushRadius(g.scratch), 0.03 * COIN_SIZES.at(-1));
  assert.deepEqual(floorSize(g.scratch), { width: 16, height: 9 });
  assert.throws(() =>
    actScratch(g, { type: 'scratch-upgrade', id: '__proto__' }, 'Jo', start),
  );
});

await test('payout upgrades double prizes, raise the jackpot and forgive mistakes', () => {
  const g = game(),
    t = take(g);
  play(g, t);
  const plain = ticketReward(t, g.scratch);
  const boosted = (id, rank = 1) => {
    const copy = structuredClone(g.scratch);
    copy.upgrades[id] = rank;
    return ticketReward(t, copy);
  };
  assert.equal(boosted('value'), Math.floor(plain * 2));
  assert.equal(boosted('seven-prize'), Math.floor(plain * 1.5));
  assert.ok(boosted('jackpot') >= plain * (5 / 3) - 1);
  assert.ok(boosted('hearts') > plain, 'hearts left pay a bonus');
  assert.ok(boosted('collector') > plain);
  g.scratch.upgrades.extra = 2;
  assert.equal(take(g).lives, BOOKS[0].levels[0].lives + 2);
  // A star ticket pays five times over, more with Bright stars.
  assert.equal(
    ticketReward({ ...t, star: true }, g.scratch),
    ticketReward(t, g.scratch) * 5,
  );
  g.scratch.upgrades.starpower = 1;
  assert.equal(
    ticketReward({ ...t, star: true }, g.scratch),
    ticketReward(t, g.scratch) * 8,
  );
  // Quick hands pays for a ticket finished in time.
  g.scratch.upgrades.quick = 1;
  assert.equal(
    ticketReward({ ...t, quick: true }, g.scratch),
    Math.floor(ticketReward({ ...t, quick: false }, g.scratch) * 1.25),
  );
});

await test('bad strokes, locked books and unaffordable upgrades reject without changing anything', () => {
  const g = game(),
    t = take(g),
    before = JSON.stringify(t);
  for (const points of [
    [],
    [{ x: NaN, y: 0.5 }],
    [{ x: 2, y: 0.5 }],
    Array(81).fill({ x: 0.5, y: 0.5 }),
  ])
    assert.throws(() =>
      actScratch(
        g,
        { type: 'scratch-stroke', ticket: t.id, sequence: 0, points },
        'Jo',
        start,
      ),
    );
  assert.equal(JSON.stringify(t), before);
  assert.throws(() => take(g, 'crown'), /Unlock/);
  assert.throws(
    () => actScratch(g, { type: 'scratch-upgrade', id: 'coin' }, 'Jo', start),
    /more coins/,
  );
  assert.throws(
    () =>
      actScratch(
        g,
        {
          type: 'scratch-stroke',
          ticket: 999,
          sequence: 0,
          points: [{ x: 0, y: 0 }],
        },
        'Jo',
        start,
      ),
    /refreshing/,
  );
});

await test('old room investments are refunded exactly once while purse and keepsakes survive', () => {
  const g = game();
  delete g.scratch;
  g.coins = 123;
  g.arcade = {
    skills: { 'darts-power': 2, 'forge-auto': 1 },
    rooms: { forge: { unlocked: true }, bells: { unlocked: true } },
  };
  const s = scratchFor(g);
  assert.equal(s.migrationCredit, 25 + 47 + 180 + 350 + 1500);
  assert.equal(g.coins, 123 + s.migrationCredit);
  assert.equal(g.arcade, undefined);
  const coins = g.coins;
  scratchFor(g);
  assert.equal(g.coins, coins);
});

await test('version 2 desks keep their books, factory and floor; every other rank is refunded', () => {
  const g = game();
  g.coins = 10;
  const factory = structuredClone(g.scratch.factory);
  factory.blueprints = ['starter'];
  factory.machines = [
    {
      kind: 'printer',
      x: 0,
      y: 0,
      dir: 0,
      book: 'twins',
      t: 0,
      item: null,
      output: { id: 1, book: 'ribbon', done: false, mult: 1, star: false },
    },
  ];
  g.scratch = {
    version: 2,
    upgrades: { coin: 2, value: 1, floor: 2 },
    unlocked: ['pocket', 'ribbon', 'garden', 'twins'],
    tickets: { Jo: { id: 3, pack: 'ribbon', claimed: false } },
    nextId: 9,
    completed: 30,
    earned: 999,
    activeMs: 5,
    books: { pocket: 20, twins: 4 },
    best: 50,
    migrationCredit: 7,
    factory,
  };
  const s = scratchFor(g);
  assert.equal(s.version, 4);
  assert.deepEqual(s.unlocked, ['seven', 'twins', 'path', 'ladder']);
  const refund = 40 + Math.ceil(40 * 2.2) + 25;
  assert.equal(s.migrationCredit, 7 + refund);
  assert.equal(g.coins, 10 + refund);
  assert.equal(s.upgrades.floor, 2);
  assert.equal(level(s, 'coin'), 0);
  assert.deepEqual(s.books, { seven: 20, ladder: 4 });
  assert.deepEqual(s.hands, {});
  assert.equal(s.factory.machines[0].book, 'ladder');
  assert.equal(s.factory.machines[0].output.book, 'twins');
  assert.equal(s.nextId, 9);
  scratchFor(g);
  assert.equal(g.coins, 10 + refund);
});

await test('version 1 saves keep their books and get their atlas ranks back', () => {
  const g = game();
  g.coins = 10;
  g.scratch = {
    version: 1,
    skills: { 'tools-0': 2, 'feature-ribbon': 1, 'feature-press': 1 },
    tickets: {},
    nextId: 4,
    completed: 30,
    earned: 999,
    activeMs: 0,
    books: { pocket: 30 },
    best: 50,
    migrationCredit: 0,
  };
  const s = scratchFor(g);
  assert.equal(s.version, 4);
  assert.deepEqual(s.unlocked, ['seven', 'twins']);
  assert.equal(s.migrationCredit, 16 + 23 + 160);
  assert.equal(g.coins, 10 + 199);
  assert.equal(s.books.seven, 30);
});

await test('version 3 desks keep everything but the free tickets on their tables', () => {
  const g = game();
  g.coins = 55;
  g.scratch = {
    ...structuredClone(g.scratch),
    version: 3,
    upgrades: { coin: 1 },
    unlocked: ['seven', 'twins'],
    tickets: { Jo: [printTicket(1, 'seven', 0, rand(), 0, start)] },
    books: { seven: 12 },
  };
  delete g.scratch.hands;
  const s = scratchFor(g);
  assert.equal(s.version, 4);
  assert.deepEqual(s.hands, {});
  assert.equal(s.tickets, undefined);
  assert.deepEqual(s.unlocked, ['seven', 'twins']);
  assert.equal(level(s, 'coin'), 1);
  assert.equal(g.coins, 55);
});

function line(g) {
  g.coins = 1e6;
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  actFactory(g, {
    type: 'factory-build',
    pieces: [
      { kind: 'printer', x: 0, y: 0, dir: 0 },
      { kind: 'belt', x: 1, y: 0, dir: 0 },
      { kind: 'bot', x: 2, y: 0, dir: 0 },
      { kind: 'belt', x: 3, y: 0, dir: 0 },
      { kind: 'cashier', x: 4, y: 0, dir: 0 },
    ],
  });
  g.coins = 0;
}
await test('the factory still opens at 1K; a printer, a bot and a cashier sell scratched tickets', () => {
  const g = game();
  g.coins = 999;
  assert.throws(
    () => actFactory(g, { type: 'factory-blueprint', id: 'starter' }),
    /more coins/,
  );
  line(g);
  advanceFactory(g, 60000);
  const f = g.scratch.factory;
  // The bot is the bottleneck: one Lucky Seven ticket every 10.5 seconds.
  assert.ok(f.sold >= 5 && f.sold <= 6, String(f.sold));
  const each = botReward(g.scratch, 'seven'),
    stars = Math.round((g.coins - f.sold * each) / (4 * each));
  assert.ok(Math.abs(g.coins - (f.sold + 4 * stars) * each) < 1e-6);
});
await test('layout matters: blank tickets never reach a cashier, turning a belt stops the line', () => {
  const g = game();
  g.coins = 1e6;
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  actFactory(g, {
    type: 'factory-build',
    pieces: [
      { kind: 'printer', x: 0, y: 0, dir: 0 },
      { kind: 'belt', x: 1, y: 0, dir: 0 },
      { kind: 'cashier', x: 2, y: 0, dir: 0 },
    ],
  });
  const coins = g.coins;
  advanceFactory(g, 30000);
  assert.equal(g.coins, coins);
  const h = game();
  line(h);
  actFactory(h, { type: 'factory-rotate', x: 3, y: 0 });
  advanceFactory(h, 30000);
  assert.equal(h.scratch.factory.sold, 0);
});
await test('lamps next to bots raise throughput; fast bots and printers multiply it', () => {
  const base = game();
  line(base);
  advanceFactory(base, 120000);
  const lit = game();
  line(lit);
  lit.coins = 1e7;
  actFactory(lit, { type: 'factory-blueprint', id: 'lamp' });
  actFactory(lit, {
    type: 'factory-build',
    pieces: [
      { kind: 'lamp', x: 2, y: 1, dir: 0 },
      { kind: 'lamp', x: 2, y: 2, dir: 0 },
    ],
  });
  advanceFactory(lit, 120000);
  assert.ok(lit.scratch.factory.sold > base.scratch.factory.sold * 1.25);
  const fast = game();
  line(fast);
  fast.scratch.upgrades.bots = 2;
  advanceFactory(fast, 120000);
  assert.ok(fast.scratch.factory.sold > base.scratch.factory.sold * 1.5);
});
await test('building is paid, validated and atomic; removing refunds the last price', () => {
  const g = game();
  assert.throws(
    () =>
      actFactory(g, {
        type: 'factory-build',
        pieces: [{ kind: 'belt', x: 0, y: 0, dir: 0 }],
      }),
    /Buy/,
  );
  g.coins = 1000;
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  assert.equal(g.coins, 0);
  g.coins = 2000;
  for (const pieces of [
    [{ kind: 'belt', x: 8, y: 0, dir: 0 }],
    [{ kind: 'belt', x: 0, y: 0, dir: 4 }],
    [
      { kind: 'belt', x: 0, y: 0, dir: 0 },
      { kind: 'belt', x: 0, y: 0, dir: 1 },
    ],
    [{ kind: 'lamp', x: 0, y: 0, dir: 0 }],
    [
      { kind: 'bot', x: 0, y: 0, dir: 0 },
      { kind: 'bot', x: 1, y: 0, dir: 0 },
    ],
  ])
    assert.throws(() => actFactory(g, { type: 'factory-build', pieces }));
  assert.equal(g.coins, 2000);
  const price = machinePrice(g.scratch.factory, 'bot');
  actFactory(g, {
    type: 'factory-build',
    pieces: [{ kind: 'bot', x: 0, y: 0, dir: 0 }],
  });
  assert.ok(machinePrice(g.scratch.factory, 'bot') > price);
  actFactory(g, { type: 'factory-remove', cells: [{ x: 0, y: 0 }] });
  assert.equal(g.coins, 2000);
});
await test('a placed machine can be dragged to an empty cell with what it holds', () => {
  const g = game();
  line(g);
  advanceFactory(g, 3000);
  const printer = g.scratch.factory.machines.find((m) => m.kind === 'printer');
  assert.throws(
    () =>
      actFactory(g, { type: 'factory-move', x: 0, y: 0, to: { x: 1, y: 0 } }),
    /taken/,
  );
  assert.throws(
    () =>
      actFactory(g, { type: 'factory-move', x: 0, y: 0, to: { x: 40, y: 0 } }),
    /inside/,
  );
  const t = printer.t;
  actFactory(g, { type: 'factory-move', x: 0, y: 0, to: { x: 0, y: 3 } });
  assert.equal(printer.x, 0);
  assert.equal(printer.y, 3);
  assert.equal(printer.t, t);
  assert.equal(g.scratch.factory.machines.length, 5);
  // Wholesale makes every machine cheaper.
  const price = machinePrice(g.scratch.factory, 'bot', 0, g.scratch);
  g.scratch.upgrades.wholesale = 1;
  const cheaper = machinePrice(g.scratch.factory, 'bot', 0, g.scratch);
  assert.ok(cheaper < price && cheaper >= Math.floor(price * 0.8));
});
await test('printers print the chosen unlocked book, and better books sell for more', () => {
  const g = game();
  line(g);
  assert.throws(
    () => actFactory(g, { type: 'factory-book', x: 0, y: 0, book: 'twins' }),
    /Unlock/,
  );
  unlock(g, 'twins');
  actFactory(g, { type: 'factory-book', x: 0, y: 0, book: 'twins' });
  advanceFactory(g, 120000);
  assert.ok(g.coins > 4 * botReward(g.scratch, 'twins'));
  assert.ok(botReward(g.scratch, 'twins') > botReward(g.scratch, 'seven') * 5);
});

await test('server hands are per member, retries do not pay twice, and reloading keeps foil', () => {
  const db = openDatabase(':memory:');
  try {
    let e = new Expeditions(db);
    const host = actor('Jo'),
      guest = actor('Mara');
    const made = e.create(host, { title: 'Scratch', world: 'dunes' }, start);
    e.join(made.token, guest, start);
    const command = (who, action, id = randomUUID()) =>
      e.command(made.token, who, { requestId: id, action }, start);
    const h = command(host, { type: 'scratch-open', pack: 'seven' });
    command(guest, { type: 'scratch-open', pack: 'seven' });
    const mine = h.game.scratch.hands.Jo;
    assert.throws(
      () =>
        command(guest, {
          type: 'scratch-stroke',
          ticket: mine.id,
          sequence: 0,
          points: [{ x: 0.5, y: 0.5 }],
        }),
      /changed/,
    );
    // Scratch three seals away from the seven, one stroke each, then the rest.
    let view = h;
    const seals = mine.cells.map((_, i) => i);
    for (const i of seals) {
      const t = view.game.scratch.hands.Jo;
      if (t.claimed) break;
      if (t.cells[i].revealed) continue;
      const copy = structuredClone(t),
        points = [];
      for (let line = 0; line < 14; line++) {
        const yy = 0.12 + line * 0.055,
          [from, to] = line % 2 ? [0.86, 0.14] : [0.14, 0.86];
        points.push(
          { x: ((i % 4) + from) / 4, y: (Math.floor(i / 4) + yy) / 4 },
          { x: ((i % 4) + to) / 4, y: (Math.floor(i / 4) + yy) / 4 },
        );
      }
      const stroke = {
          type: 'scratch-stroke',
          ticket: copy.id,
          sequence: copy.sequence,
          points,
        },
        id = randomUUID();
      view = command(host, stroke, id);
      const repeated = command(host, stroke, id);
      assert.equal(repeated.game.coins, view.game.coins);
    }
    const done = view.game.scratch.hands.Jo;
    assert.ok(done.claimed && done.payout > 0);
    assert.equal(view.game.coins, done.payout);
    e = new Expeditions(db);
    const resumed = e.get(made.token, host, start);
    assert.ok(resumed.game.scratch.hands.Jo.cells.every((c) => c.revealed));
    assert.equal(resumed.game.scratch.hands.Mara.sequence, 0);
  } finally {
    db.close();
  }
});

await test('activity is counted once across members and tabs, with no earnings after absence or restart', () => {
  const db = openDatabase(':memory:');
  try {
    let e = new Expeditions(db);
    const host = actor('Jo'),
      guest = actor('Mara'),
      made = e.create(host, { title: 'Scratch', world: 'dunes' }, start);
    e.join(made.token, guest, start);
    line(made.game);
    db.prepare('UPDATE expeditions SET state=? WHERE token=?').run(
      JSON.stringify(made.game),
      made.token,
    );
    const reference = (ms) => {
      const copy = structuredClone(made.game);
      advanceFactory(copy, ms);
      return copy.coins;
    };
    const one = randomUUID(),
      two = randomUUID();
    const pulse = (who, id, ms, playing = true) =>
      e.activity(made.token, who, { sessionId: id, playing }, start + ms).game;
    const active = (g) => g.scratch.activeMs;
    assert.equal(active(pulse(host, one, 1000)), 0);
    assert.equal(active(pulse(guest, two, 1000)), 0);
    assert.equal(active(pulse(host, one, 2000)), 1000);
    assert.equal(active(pulse(guest, two, 2000)), 1000);
    pulse(host, one, 2500, false);
    assert.equal(active(pulse(guest, two, 3000)), 2000);
    pulse(guest, two, 4000, false);
    assert.equal(active(pulse(host, one, 86400000)), 2000);
    let g = pulse(host, one, 86401000);
    assert.equal(active(g), 3000);
    assert.equal(g.coins, reference(3000));
    e = new Expeditions(db);
    assert.equal(active(pulse(host, one, 86402000)), 3000);
    for (let s = 2; s < 40; s++) g = pulse(host, one, 86401000 + s * 1000);
    assert.equal(active(g), 41000);
    assert.equal(g.coins, reference(41000));
  } finally {
    db.close();
  }
});

await test('a careful player with simple factory lines opens the factory in minutes and every book in hours', () => {
  const g = game(7),
    s = g.scratch,
    reached = {},
    r = rand(3);
  let lines = 0;
  function buy(minute) {
    for (let bought = true; bought;) {
      bought = false;
      const book = nextBook(s);
      if (book && g.coins >= book.price) {
        actScratch(g, { type: 'scratch-book', pack: book.id }, 'Jo', start);
        reached[book.id] = minute;
        for (const m of s.factory.machines)
          if (m.kind === 'printer')
            actFactory(g, {
              type: 'factory-book',
              x: m.x,
              y: m.y,
              book: book.id,
            });
        bought = true;
        continue;
      }
      if (!s.factory.blueprints.includes('starter')) {
        if (g.coins >= 1000) {
          actFactory(g, { type: 'factory-blueprint', id: 'starter' });
          reached.factory = minute;
          bought = true;
        }
        continue;
      }
      const f = s.factory,
        cost =
          machinePrice(f, 'printer', 0, s) +
          machinePrice(f, 'bot', 0, s) +
          machinePrice(f, 'cashier', 0, s) +
          machinePrice(f, 'belt', 0, s) +
          machinePrice(f, 'belt', 1, s);
      if (
        lines < floorSize(s).height &&
        g.coins >= cost &&
        (!book || cost < book.price / 2)
      ) {
        const y = lines++;
        actFactory(g, {
          type: 'factory-build',
          pieces: [
            { kind: 'printer', x: 0, y, dir: 0 },
            { kind: 'belt', x: 1, y, dir: 0 },
            { kind: 'bot', x: 2, y, dir: 0 },
            { kind: 'belt', x: 3, y, dir: 0 },
            { kind: 'cashier', x: 4, y, dir: 0 },
          ],
        });
        bought = true;
        continue;
      }
      const u = UPGRADES.filter(
        (u) => upgradeReady(s, u) && level(s, u.id) < u.max,
      ).sort((a, b) => upgradeCost(s, a) - upgradeCost(s, b))[0];
      if (
        u &&
        g.coins >= upgradeCost(s, u) &&
        (!book || upgradeCost(s, u) < book.price / 4)
      ) {
        actScratch(g, { type: 'scratch-upgrade', id: u.id }, 'Jo', start);
        bought = true;
      }
    }
  }
  // The newest book the purse can pay for, at its highest open level.
  const choose = () => {
    for (const id of [...s.unlocked].reverse())
      for (let l = levelOpen(s, id); l >= 0; l--)
        if (g.coins >= ticketPrice(s, id, l)) return [id, l];
    return ['seven', 0];
  };
  let now = start;
  for (let minute = 1; minute <= 16 * 60 && nextBook(s); minute++) {
    // A minute of play: three seconds a ticket plus the seals scratched.
    for (let seconds = 0; seconds < 60;) {
      const [id, l] = choose();
      actScratch(g, { type: 'scratch-open', pack: id, level: l }, 'Jo', now);
      const t = handFor(s, 'Jo');
      let picks = 0;
      while (!t.ended) {
        openSeal(t, suggest(t, r));
        picks++;
      }
      const seal = Math.max(
        0.4,
        (1.6 * (FOIL[level(s, 'foil')] / 0.72)) / COIN_SIZES[level(s, 'coin')],
      );
      seconds += 3 + picks * seal;
      now += (3 + picks * seal) * 1000;
      actScratch(
        g,
        {
          type: 'scratch-stroke',
          ticket: t.id,
          sequence: t.sequence,
          points: [{ x: 0, y: 0 }],
        },
        'Jo',
        now,
      );
    }
    advanceFactory(g, 60000);
    buy(minute);
  }
  assert.equal(nextBook(s), undefined);
  assert.ok(reached.factory <= 4, `factory at ${reached.factory} min`);
  assert.ok(reached.twins <= 10, `twins at ${reached.twins} min`);
  assert.ok(reached.mine >= 35, `gold mine at ${reached.mine} min`);
  assert.ok(reached.ladder >= 15, `ladder at ${reached.ladder} min`);
  assert.ok(reached.crown >= 4 * 60, `crown at ${reached.crown} min`);
});
