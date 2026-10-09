import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRelic, actRelic } from '../lib/games/relic/engine.ts';
import {
  AVERAGES,
  BOOKS,
  COIN_SIZES,
  LEVEL_AT,
  LEVEL_MULT,
  BOOK_LEVEL_STEP,
  BOOK_LEVEL_GAIN,
  DIFFICULTY_AT,
  INFINITY_AT,
  QUALITY_CAP,
  XP_SCALE,
  XP_WEIGHTS,
  bookLevel,
  bookExperience,
  bookXpAt,
  levelMult,
  levelProgress,
  printLevel,
  ticketQuality,
  ticketXp,
  xpToInfinity,
  xpToOpen,
  PRICE_SHARE,
  STROKE_POINTS,
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
  upgradeFor,
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
  BLUEPRINTS,
  MACHINES,
  ORDER,
  TICK_MS,
  actFactory,
  advanceFactory,
  boost,
  boosted,
  editCost,
  intakes,
  itemValue,
  machineAt,
  machinePrice,
  machineRefund,
  floorSize,
  outlets,
  printTicks,
  reach,
} from '../lib/games/relic/factory.ts';
import { openDatabase } from '../server/database.ts';
import { Expeditions } from '../server/expeditions.ts';
import { seedLuckyWorkshop } from '../server/dev-lucky.ts';
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
  g.scratch.xp.seven = bookXpAt(g.scratch, 2);
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

await test('a losing ticket loses; the Loyalty card and a lucky draw give free tickets', () => {
  const g = game();
  g.coins = 1e6;
  const t = take(g);
  for (const i of t.cells.flatMap((c, i) => (c.face === 'seven' ? [] : [i])))
    if (!t.ended) openSeal(t, i);
  const before = g.coins;
  play(g, t);
  assert.ok(t.payout < t.cost);
  assert.equal(t.refund, undefined);
  assert.equal(g.coins, before + t.payout);
  // Every 7th ticket is free at rank 2: six bought, the seventh free.
  g.scratch.upgrades.loyalty = 2;
  g.scratch.punches = 0;
  const costs = [];
  for (let i = 0; i < 14; i++) {
    const next = take(g);
    costs.push(next.cost);
    play(g, next);
  }
  assert.deepEqual(
    costs.map((c) => c === 0),
    [
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ],
  );
  delete g.scratch.upgrades.loyalty;
  g.scratch.upgrades.freebie = 4;
  let free = 0;
  for (let i = 0; i < 80; i++) if (take(g).cost === 0) free++;
  assert.ok(free > 8 && free < 35, String(free));
});

await test('saved Insurance ranks are refunded once and the upgrade is gone', () => {
  const g = game();
  g.coins = 100;
  g.scratch.upgrades.insurance = 2;
  scratchFor(g);
  assert.equal(g.coins, 100 + 8_000 + 280_000_000);
  assert.equal(g.scratch.upgrades.insurance, undefined);
  scratchFor(g);
  assert.equal(g.coins, 100 + 8_000 + 280_000_000);
  assert.ok(!upgradeFor('insurance'));
  assert.equal(upgradeFor('early').requires, 'loyalty');
});

await test('book levels open the harder difficulties, ∞ last; any open level can be chosen', () => {
  const g = game();
  assert.equal(levelOpen(g.scratch, 'seven'), 0);
  g.coins = 1e9;
  assert.throws(() => take(g, 'seven', 'Jo', 1), /Play that book more/);
  assert.throws(() => take(g, 'seven', 'Jo', -1));
  assert.throws(() => take(g, 'seven', 'Jo', 1.5));
  assert.deepEqual(DIFFICULTY_AT, [1, 2, 3, INFINITY_AT]);
  // II and III open after about 8 and 25 careful tickets' worth of XP.
  assert.equal(bookXpAt(g.scratch, 2), LEVEL_AT[1] * XP_SCALE * XP_WEIGHTS[0]);
  assert.equal(
    bookXpAt(g.scratch, 3),
    bookXpAt(g.scratch, 2) +
      (LEVEL_AT[2] - LEVEL_AT[1]) * XP_SCALE * XP_WEIGHTS[1],
  );
  g.scratch.xp.seven = bookXpAt(g.scratch, 2) - 1;
  assert.equal(levelOpen(g.scratch, 'seven'), 0);
  assert.equal(xpToOpen(g.scratch, 'seven', 1), 1);
  g.scratch.xp.seven++;
  assert.equal(levelOpen(g.scratch, 'seven'), 1);
  assert.equal(xpToOpen(g.scratch, 'seven', 1), 0);
  assert.equal(take(g, 'seven', 'Jo', 1).cells.length, 25);
  assert.equal(take(g, 'seven', 'Jo', 0).cells.length, 16);
  assert.equal(take(g).level, 1, 'the highest open level by default');
  g.scratch.xp.seven = bookXpAt(g.scratch, 3);
  assert.equal(take(g).cells.length, 30);
  // ∞ opens once book level 3 is complete.
  assert.equal(INFINITY_AT, 4);
  assert.equal(levelOpen(g.scratch, 'seven'), 2);
  assert.equal(
    xpToInfinity(g.scratch, 'seven'),
    bookXpAt(g.scratch, 3) + BOOK_LEVEL_STEP * XP_SCALE - g.scratch.xp.seven,
  );
  assert.throws(() => take(g, 'seven', 'Jo', 3), /Play that book more/);
  g.scratch.xp.seven = bookXpAt(g.scratch, INFINITY_AT);
  assert.equal(xpToInfinity(g.scratch, 'seven'), 0);
  assert.equal(levelOpen(g.scratch, 'seven'), 3);
  const endless = take(g);
  assert.equal(endless.level, 3);
  assert.equal(endless.cells.length, 42);
  assert.equal(take(g, 'seven', 'Jo', 2).cells.length, 30);
  // Early print shortens every step, the way to ∞ included.
  g.scratch.xp.twins = 4 * XP_SCALE * XP_WEIGHTS[0];
  g.scratch.upgrades.early = 3;
  assert.equal(levelOpen(g.scratch, 'twins'), 1);
  assert.ok(xpToInfinity(g.scratch, 'twins') < bookXpAt(game().scratch, 4) / 2);
  // Harder levels are worth more for every prize unit; ∞ the most.
  assert.ok(
    prizeUnit(g.scratch, 'seven', 2) > prizeUnit(g.scratch, 'seven', 0) * 3,
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((l) => levelMult(0, l)),
    [...LEVEL_MULT],
  );
  assert.ok(levelMult(3, 3) > levelMult(3, 2));
  // Factory printers never print ∞.
  assert.equal(printLevel(g.scratch, 'seven'), 2);
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
  for (const lvl of [0, 1, 2, 3]) {
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

/** A full Garden walk from 1 through every seal, numbers in order, never
 * across a hedge, found by an unhurried search. */
function gardenWalk(t) {
  const n = t.cells.length,
    count = t.cells.filter((c) => c.n !== undefined).length,
    seen = Array(n).fill(false),
    route = [];
  const go = (at, next) => {
    seen[at] = true;
    route.push(at);
    if (route.length === n && next > count) return true;
    for (const j of neighbours(t.cols, t.rows, at)) {
      const c = t.cells[j];
      if (seen[j] || t.walls.includes(Math.min(at, j) * 64 + Math.max(at, j)))
        continue;
      if (c.n !== undefined && c.n !== next) continue;
      if (go(j, c.n !== undefined ? next + 1 : next)) return true;
    }
    seen[at] = false;
    route.pop();
    return false;
  };
  assert.ok(
    go(
      t.cells.findIndex((c) => c.n === 1),
      2,
    ),
    'a full walk exists',
  );
  return route;
}
await test('Garden: numbers lie in order along one full path; hedges never block it; a wrong step costs a heart', () => {
  for (const lvl of [0, 1, 2, 3]) {
    const l = BOOKS[2].levels[lvl],
      t = printTicket(1, 'path', lvl, rand(lvl + 11), 0, start);
    const numbers = t.cells.filter((c) => c.n !== undefined).map((c) => c.n);
    assert.deepEqual(
      numbers.sort((a, b) => a - b),
      Array.from({ length: l.count }, (_, i) => i + 1),
    );
    assert.equal(t.walls.length, l.extra ?? 0);
    // Every seal lies on one full walk, so the puzzle can always be finished:
    // follow the route a patient search finds.
    const walk = structuredClone(t);
    for (const i of gardenWalk(t)) openSeal(walk, i);
    assert.equal(walk.perfect, true, `level ${lvl}`);
    if (lvl < 3) {
      const careful = structuredClone(t),
        r = rand(1);
      while (!careful.ended) openSeal(careful, suggest(careful, r));
      assert.equal(careful.perfect, true, `careful player, level ${lvl}`);
    }
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
  for (const lvl of [0, 1, 2, 3]) {
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
  for (const lvl of [0, 1, 2, 3]) {
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
  for (const lvl of [0, 1, 2, 3]) {
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
    Array(STROKE_POINTS + 1).fill({ x: 0.5, y: 0.5 }),
  ])
    assert.throws(() =>
      actScratch(
        g,
        { type: 'scratch-stroke', ticket: t.id, sequence: 0, points },
        'Jo',
        start,
      ),
    );
  // A new stroke starts inside the command, after its first point, in order.
  for (const breaks of [[0], [3], [2, 1], [1, 1], [1.5], 'x'])
    assert.throws(() =>
      actScratch(
        g,
        {
          type: 'scratch-stroke',
          ticket: t.id,
          sequence: 0,
          points: Array(3).fill({ x: 0.5, y: 0.5 }),
          breaks,
        },
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
  delete factory.version;
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
  assert.equal(s.version, 5);
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
  assert.equal(s.factory.version, 2);
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
  assert.equal(s.version, 5);
  assert.deepEqual(s.unlocked, ['seven', 'twins']);
  assert.equal(s.migrationCredit, 16 + 23 + 160);
  assert.equal(g.coins, 10 + 199);
  assert.equal(s.books.seven, 30);
  assert.equal(s.factory.version, 2);
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
  delete g.scratch.factory.version;
  const s = scratchFor(g);
  assert.equal(s.version, 5);
  assert.deepEqual(s.hands, {});
  assert.equal(s.tickets, undefined);
  assert.deepEqual(s.unlocked, ['seven', 'twins']);
  assert.equal(level(s, 'coin'), 1);
  assert.equal(g.coins, 55);
  assert.equal(s.factory.version, 2);
});

await test('factory version 1 ink wells become lamps once, refunding an owned lamp blueprint and keeping ticket marks', () => {
  const g = game();
  g.coins = 123;
  const f = g.scratch.factory;
  f.version = 1;
  f.blueprints = ['starter', 'ink', 'lamp', 'stamper'];
  const ticket = {
    id: 42,
    book: 'twins',
    done: true,
    mult: 2.08,
    star: true,
    stamped: true,
    gilded: true,
    value: 900,
  };
  const ink = {
    kind: 'ink',
    x: 3,
    y: 2,
    dir: 0,
    t: 4,
    item: { ...ticket, id: 40 },
    output: { ...ticket, id: 41 },
    hold: [ticket],
  };
  f.machines = [ink, { ...ink, kind: 'unknown-machine', x: 4 }];
  f.nextItem = 43;
  f.clock = 150;
  f.sold = 9;
  f.earned = 77;
  f.rate = 12;
  const held = structuredClone(ink);
  const s = scratchFor(g);
  assert.equal(s.factory, f);
  assert.equal(f.version, 2);
  assert.deepEqual(f.blueprints, ['starter', 'lamp', 'stamper']);
  assert.deepEqual(f.machines, [{ ...held, kind: 'lamp' }]);
  assert.equal(g.coins, 20_123);
  assert.deepEqual(
    [f.nextItem, f.clock, f.sold, f.earned, f.rate],
    [43, 150, 9, 77, 12],
  );
  const saved = structuredClone(g);
  scratchFor(g);
  assert.deepEqual(g, saved, 'the second load changes nothing');
  scratchFor(saved);
  assert.deepEqual(saved, g, 'a serialized reload does not pay again');
});
await test('every scratch migration upgrades old factories; ink-only ownership transfers and refunds stay capped', () => {
  for (const version of [1, 2, 3, 4]) {
    const g = game();
    g.coins = 456;
    g.scratch.version = version;
    g.scratch.factory.version = 1;
    g.scratch.factory.blueprints = ['starter', 'ink'];
    g.scratch.factory.machines = [
      {
        kind: 'ink',
        x: 1,
        y: 1,
        dir: 0,
        t: 0,
        item: null,
        output: null,
      },
    ];
    const s = scratchFor(g);
    assert.equal(s.version, 5, `scratch version ${version}`);
    assert.equal(s.factory.version, 2);
    assert.deepEqual(s.factory.blueprints, ['starter', 'lamp']);
    assert.equal(machineAt(s.factory, 1, 1).kind, 'lamp');
    assert.equal(g.coins, 456, 'ink-only ownership is not refunded');
  }
  const g = game();
  g.coins = 1e18 - 10_000;
  g.scratch.factory.version = 1;
  g.scratch.factory.blueprints = ['ink', 'lamp'];
  scratchFor(g);
  assert.equal(g.coins, 1e18);
  scratchFor(g);
  assert.equal(g.coins, 1e18);
});

await test('factory palette has exactly ten machines, plain families and the seven era-priced blueprints', () => {
  assert.deepEqual(ORDER, [
    'printer',
    'belt',
    'bot',
    'cashier',
    'splitter',
    'lamp',
    'stamper',
    'gilder',
    'charm',
    'bundler',
  ]);
  assert.deepEqual(Object.keys(MACHINES).sort(), [...ORDER].sort());
  assert.deepEqual(
    ORDER.map((kind) => MACHINES[kind].family),
    [
      'make',
      'move',
      'work',
      'sell',
      'move',
      'boost',
      'work',
      'work',
      'boost',
      'work',
    ],
  );
  assert.deepEqual(
    BLUEPRINTS.map((b) => [b.id, b.price]),
    [
      ['starter', 1_000],
      ['splitter', 1_500],
      ['lamp', 8_000],
      ['stamper', 60_000],
      ['gilder', 1e9],
      ['charm', 300e9],
      ['bundler', 300e12],
    ],
  );
  assert.deepEqual(BLUEPRINTS[0].kinds, ORDER.slice(0, 4));
  assert.equal(MACHINES.lamp.base, 5_000);
});
await test('factory port helpers expose lenient intakes, fixed outlets and the splitter front-left-right order', () => {
  for (const kind of ['printer', 'lamp', 'charm'])
    assert.deepEqual(intakes(kind, 0), []);
  for (const kind of ['cashier', 'lamp', 'charm'])
    assert.deepEqual(outlets(kind, 0), []);
  assert.deepEqual(intakes('cashier', 3), [0, 1, 2, 3]);
  assert.deepEqual(outlets('printer', 2), [2]);
  assert.deepEqual(outlets('splitter', 0), [0, 3, 1]);
  assert.deepEqual(outlets('splitter', 3), [3, 2, 0]);
  for (const kind of [
    'belt',
    'splitter',
    'bot',
    'stamper',
    'gilder',
    'bundler',
  ]) {
    assert.deepEqual(intakes(kind, 0), [2, 3, 1]);
    assert.deepEqual(intakes(kind, 2), [0, 1, 3]);
    if (kind !== 'splitter') assert.deepEqual(outlets(kind, 1), [1]);
  }
});

function line(g) {
  g.coins = 1e6;
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  actFactory(g, {
    type: 'factory-edit',
    build: [
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
    type: 'factory-edit',
    build: [
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
  actFactory(h, {
    type: 'factory-edit',
    arrange: [{ x: 3, y: 0, to: { x: 3, y: 0 }, dir: 1 }],
  });
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
    type: 'factory-edit',
    build: [
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
        type: 'factory-edit',
        build: [{ kind: 'belt', x: 0, y: 0, dir: 0 }],
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
    assert.throws(() => actFactory(g, { type: 'factory-edit', build: pieces }));
  assert.equal(g.coins, 2000);
  const price = machinePrice(g.scratch.factory, 'bot');
  actFactory(g, {
    type: 'factory-edit',
    build: [{ kind: 'bot', x: 0, y: 0, dir: 0 }],
  });
  assert.ok(machinePrice(g.scratch.factory, 'bot') > price);
  assert.equal(machineRefund(g.scratch.factory, 'bot'), price);
  actFactory(g, { type: 'factory-edit', remove: [{ x: 0, y: 0 }] });
  assert.equal(g.coins, 2000);
});
await test('a placed machine can be dragged to an empty cell with what it holds', () => {
  const g = game();
  line(g);
  advanceFactory(g, 3000);
  const printer = g.scratch.factory.machines.find((m) => m.kind === 'printer');
  assert.throws(
    () =>
      actFactory(g, {
        type: 'factory-edit',
        arrange: [{ x: 0, y: 0, to: { x: 1, y: 0 }, dir: 0 }],
      }),
    /taken/,
  );
  assert.throws(
    () =>
      actFactory(g, {
        type: 'factory-edit',
        arrange: [{ x: 0, y: 0, to: { x: 40, y: 0 }, dir: 0 }],
      }),
    /inside/,
  );
  const t = printer.t;
  actFactory(g, {
    type: 'factory-edit',
    arrange: [{ x: 0, y: 0, to: { x: 0, y: 3 }, dir: 0 }],
  });
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
    () =>
      actFactory(g, {
        type: 'factory-book',
        cells: [{ x: 0, y: 0 }],
        book: 'twins',
      }),
    /Unlock/,
  );
  unlock(g, 'twins');
  actFactory(g, {
    type: 'factory-book',
    cells: [{ x: 0, y: 0 }],
    book: 'twins',
  });
  advanceFactory(g, 120000);
  assert.ok(g.scratch.factory.sold >= 4);
  assert.ok(g.coins >= 4 * botReward(g.scratch, 'twins'));
  assert.ok(botReward(g.scratch, 'twins') > botReward(g.scratch, 'seven') * 5);
});

await test('a failed factory-edit changes no machines, held tickets, coins or other state', () => {
  const g = game();
  line(g);
  advanceFactory(g, 7_000);
  g.coins = 5_000;
  const remove = [{ x: 1, y: 0 }],
    arrange = [{ x: 0, y: 0, to: { x: 0, y: 1 }, dir: 1 }],
    belt = { kind: 'belt', x: 1, y: 0, dir: 0 };
  for (const edit of [
    {},
    { remove: [], arrange: [], build: [] },
    { remove: null },
    { arrange: {} },
    { build: 'belt' },
    { remove: [{ x: 7, y: 4 }] },
    {
      remove: [
        { x: 1, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    { remove: [{ x: -1, y: 0 }] },
    { remove, arrange: [{ x: 1, y: 0, to: { x: 0, y: 1 }, dir: 0 }] },
    { remove, arrange: [...arrange, ...arrange] },
    {
      remove,
      arrange: [...arrange, { x: 2, y: 0, to: { x: 0, y: 1 }, dir: 0 }],
    },
    { remove, arrange: [{ x: 0, y: 0, to: { x: 2, y: 0 }, dir: 0 }] },
    { remove, arrange: [{ x: 0, y: 0, to: { x: 8, y: 1 }, dir: 0 }] },
    { remove, arrange: [{ ...arrange[0], dir: 4 }] },
    { remove, arrange, build: [belt, { ...belt, x: 0, y: 1 }] },
    { remove, arrange, build: [belt, { ...belt, x: 8, y: 1 }] },
    { remove, arrange, build: [belt, { ...belt, x: 2, y: 1, dir: 4 }] },
    { remove, arrange, build: [belt, { ...belt, x: 2, y: 1, kind: 'lamp' }] },
    { remove, arrange, build: [belt, { ...belt, x: 2, y: 1, kind: 'ink' }] },
    ...['constructor', '__proto__'].map((kind) => ({
      remove,
      arrange,
      build: [{ ...belt, kind }],
    })),
  ]) {
    const before = structuredClone(g);
    assert.throws(() => editCost(g.scratch.factory, g.scratch, edit), Error);
    assert.deepEqual(g, before, 'a rejected preview is pure');
    assert.throws(
      () => actFactory(g, { type: 'factory-edit', ...edit }),
      Error,
    );
    assert.deepEqual(g, before, 'a rejected edit is atomic');
  }
  const expensive = {
    remove,
    arrange,
    build: Array.from({ length: 4 }, (_, x) => ({
      kind: 'bot',
      x,
      y: 2,
      dir: 0,
    })),
  };
  const before = structuredClone(g);
  assert.ok(editCost(g.scratch.factory, g.scratch, expensive).net > g.coins);
  assert.throws(
    () => actFactory(g, { type: 'factory-edit', ...expensive }),
    /more coins/,
  );
  assert.deepEqual(
    g,
    before,
    'affordability fails before any refund or arrangement lands',
  );
});
await test('factory-edit caps each list at 144 and accepts a whole 16x9 floor', () => {
  const g = game();
  g.coins = 1e6;
  g.scratch.upgrades.floor = 4;
  g.scratch.factory.blueprints = ['starter'];
  const build = Array.from({ length: 144 }, (_, i) => ({
    kind: 'belt',
    x: i % 16,
    y: Math.floor(i / 16),
    dir: 0,
  }));
  for (const key of ['remove', 'arrange', 'build']) {
    const before = structuredClone(g);
    assert.throws(() =>
      actFactory(g, { type: 'factory-edit', [key]: Array(145).fill(build[0]) }),
    );
    assert.deepEqual(g, before);
  }
  actFactory(g, { type: 'factory-edit', build });
  assert.equal(g.scratch.factory.machines.length, 144);
  actFactory(g, {
    type: 'factory-edit',
    arrange: build.map((c) => ({
      x: c.x,
      y: c.y,
      to: { x: 15 - c.x, y: 8 - c.y },
      dir: 2,
    })),
  });
  assert.ok(g.scratch.factory.machines.every((m) => m.dir === 2));
  actFactory(g, {
    type: 'factory-edit',
    remove: build.map(({ x, y }) => ({ x, y })),
  });
  assert.equal(g.scratch.factory.machines.length, 0);
  assert.equal(g.coins, 1e6);
});
await test('arrange swaps occupied cells, then rotates a 2x2 group in place with its tickets', () => {
  const g = game(),
    f = g.scratch.factory;
  g.coins = 1e6;
  f.blueprints = ['starter', 'splitter'];
  actFactory(g, {
    type: 'factory-edit',
    build: [
      { kind: 'printer', x: 0, y: 0, dir: 0 },
      { kind: 'belt', x: 1, y: 0, dir: 0 },
      { kind: 'splitter', x: 0, y: 1, dir: 0 },
      { kind: 'cashier', x: 1, y: 1, dir: 3 },
    ],
  });
  const printer = machineAt(f, 0, 0),
    belt = machineAt(f, 1, 0),
    splitter = machineAt(f, 0, 1),
    cashier = machineAt(f, 1, 1);
  const ticket = {
    id: 99,
    book: 'seven',
    done: false,
    mult: 1.3,
    star: true,
    stamped: true,
  };
  printer.output = ticket;
  printer.t = 3;
  belt.item = { ...ticket, id: 100 };
  splitter.item = { ...ticket, id: 101 };
  splitter.turn = 2;
  actFactory(g, {
    type: 'factory-edit',
    arrange: [
      { x: 0, y: 0, to: { x: 1, y: 0 }, dir: 0 },
      { x: 1, y: 0, to: { x: 0, y: 0 }, dir: 0 },
    ],
  });
  assert.equal(machineAt(f, 1, 0), printer);
  assert.equal(machineAt(f, 0, 0), belt);
  const before = f.machines.map((m) => ({
    m,
    x: m.x,
    y: m.y,
    dir: m.dir,
    item: m.item,
    output: m.output,
    t: m.t,
  }));
  const coins = g.coins;
  actFactory(g, {
    type: 'factory-edit',
    arrange: before.map(({ x, y, dir }) => ({
      x,
      y,
      to: { x: 1 - y, y: x },
      dir: (dir + 1) % 4,
    })),
  });
  for (const { m, x, y, item, output, t } of before) {
    assert.equal(machineAt(f, 1 - y, x), m);
    assert.equal(m.item, item);
    assert.equal(m.output, output);
    assert.equal(m.t, t);
  }
  assert.equal(printer.output, ticket);
  assert.equal(cashier.dir, 0);
  assert.equal(splitter.turn, 0);
  splitter.turn = 2;
  actFactory(g, {
    type: 'factory-edit',
    arrange: [
      { x: splitter.x, y: splitter.y, to: { x: 0, y: 2 }, dir: splitter.dir },
    ],
  });
  assert.equal(
    splitter.turn,
    2,
    'moving without changing direction keeps the next outlet',
  );
  assert.equal(g.coins, coins);
});
await test('editCost matches running prices and refunds; building/removing and removing/rebuilding are money-neutral', () => {
  for (const wholesale of [0, 1, 3]) {
    const g = game(),
      s = g.scratch,
      f = s.factory;
    g.coins = 1e7;
    s.upgrades.wholesale = wholesale;
    f.blueprints = ['starter'];
    actFactory(g, {
      type: 'factory-edit',
      build: [{ kind: 'bot', x: 0, y: 0, dir: 0 }],
    });
    const build = [
        { kind: 'bot', x: 1, y: 0, dir: 0 },
        { kind: 'belt', x: 2, y: 0, dir: 0 },
        { kind: 'bot', x: 3, y: 0, dir: 1 },
        { kind: 'belt', x: 4, y: 0, dir: 0 },
      ],
      remove = build.map(({ x, y }) => ({ x, y }));
    const coins = g.coins,
      before = structuredClone(g),
      quote = editCost(f, s, { build });
    assert.deepEqual(g, before, 'preview does not mutate anything');
    const expected =
      machinePrice(f, 'bot', 0, s) +
      machinePrice(f, 'bot', 1, s) +
      machinePrice(f, 'belt', 0, s) +
      machinePrice(f, 'belt', 1, s);
    assert.deepEqual(quote, { cost: expected, refund: 0, net: expected });
    actFactory(g, { type: 'factory-edit', build });
    assert.equal(g.coins, coins - quote.net);
    assert.equal(editCost(f, s, { remove }).refund, quote.cost);
    actFactory(g, { type: 'factory-edit', remove });
    assert.equal(g.coins, coins, 'build then remove is free');
    actFactory(g, { type: 'factory-edit', build });
    const paid = g.coins;
    actFactory(g, { type: 'factory-edit', remove: [...remove].reverse() });
    actFactory(g, { type: 'factory-edit', build: [...build].reverse() });
    assert.equal(g.coins, paid, 'remove then rebuild is free in either order');
    // Refunds fund replacement builds, and arrangement frees a build cell.
    g.coins = 0;
    const edit = {
      remove: [
        { x: 1, y: 0 },
        { x: 3, y: 0 },
      ],
      arrange: [{ x: 2, y: 0, to: { x: 2, y: 1 }, dir: 1 }],
      build: [
        { kind: 'bot', x: 2, y: 0, dir: 0 },
        { kind: 'belt', x: 1, y: 0, dir: 0 },
      ],
    };
    const preview = editCost(f, s, edit);
    assert.ok(preview.net < 0);
    actFactory(g, { type: 'factory-edit', ...edit });
    assert.equal(g.coins, -preview.net);
    assert.equal(machineAt(f, 2, 1).kind, 'belt');
    assert.equal(machineAt(f, 2, 0).kind, 'bot');
  }
});
await test('large refund-funded edits keep small charges exact and clamp excess refunds', () => {
  const g = game(),
    s = g.scratch,
    f = s.factory;
  s.upgrades.floor = 4;
  f.blueprints = BLUEPRINTS.map((b) => b.id);
  const build = Array.from({ length: 10 }, (_, x) => ({
    kind: 'bundler',
    x,
    y: 0,
    dir: 0,
  }));
  f.machines = build.map((m) => ({ ...m, t: 0, item: null, output: null }));
  const edit = {
    remove: build.map(({ x, y }) => ({ x, y })),
    build: [...build].reverse(),
  };
  g.coins = 12_345;
  assert.equal(editCost(f, s, edit).net, 0);
  actFactory(g, { type: 'factory-edit', ...edit });
  assert.equal(g.coins, 12_345);
  const beltEdit = {
    ...edit,
    build: [...edit.build, { kind: 'belt', x: 10, y: 0, dir: 0 }],
  };
  assert.equal(editCost(f, s, beltEdit).net, 5);
  actFactory(g, { type: 'factory-edit', ...beltEdit });
  assert.equal(
    g.coins,
    12_340,
    'large offsetting totals never swallow a belt purchase',
  );
  const botEdit = {
    ...edit,
    build: [...edit.build, { kind: 'bot', x: 11, y: 0, dir: 0 }],
  };
  g.coins = 1_199;
  const before = structuredClone(g);
  assert.equal(editCost(f, s, botEdit).net, 1_200);
  assert.throws(
    () => actFactory(g, { type: 'factory-edit', ...botEdit }),
    /more coins/,
  );
  assert.deepEqual(g, before);
  g.coins = 1e18;
  actFactory(g, { type: 'factory-edit', ...edit });
  assert.equal(g.coins, 1e18, 'a same-edit rebuild preserves a full purse');
  actFactory(g, { type: 'factory-edit', remove: edit.remove });
  assert.equal(g.coins, 1e18, 'a refund cannot exceed the purse cap');
});
await test('build books fall back to the best open book and factory-book changes every selected printer atomically', () => {
  const g = game(),
    s = g.scratch,
    f = s.factory;
  g.coins = 1e6;
  unlock(g, 'twins');
  f.blueprints = ['starter'];
  actFactory(g, {
    type: 'factory-edit',
    build: [
      { kind: 'printer', x: 0, y: 0, dir: 0, book: 'seven' },
      { kind: 'printer', x: 1, y: 0, dir: 0, book: 'crown' },
      { kind: 'printer', x: 2, y: 0, dir: 0 },
      { kind: 'bot', x: 3, y: 0, dir: 0, book: 'twins' },
    ],
  });
  assert.deepEqual(
    f.machines.map((m) => m.book),
    ['seven', 'twins', 'twins', undefined],
  );
  const cells = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 7, y: 4 },
  ];
  const held = { id: 88, book: 'seven', done: false, mult: 1, star: false };
  machineAt(f, 0, 0).output = held;
  for (const action of [
    { type: 'factory-book', cells, book: 'crown' },
    { type: 'factory-book', cells: [{ x: 3, y: 0 }], book: 'seven' },
    {
      type: 'factory-book',
      cells: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
      ],
      book: 'twins',
    },
  ]) {
    const before = structuredClone(g);
    assert.throws(() => actFactory(g, action));
    assert.deepEqual(g, before);
  }
  actFactory(g, { type: 'factory-book', cells, book: 'twins' });
  assert.deepEqual(
    f.machines.map((m) => m.book),
    ['twins', 'twins', 'twins', undefined],
  );
  assert.equal(machineAt(f, 0, 0).output, held);
  assert.equal(held.book, 'seven', 'book changes keep tickets already printed');
  actFactory(g, {
    type: 'factory-book',
    cells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    book: 'seven',
  });
  assert.equal(
    machineAt(f, 2, 0).book,
    'twins',
    'unselected printers keep their book',
  );
});
await test('lamp 3x3 reach speeds a diagonal printer and bot, with additive lamps and useful booster targets', () => {
  const g = game(),
    s = g.scratch,
    f = s.factory;
  g.coins = 1e6;
  f.blueprints = ['starter', 'lamp'];
  actFactory(g, {
    type: 'factory-edit',
    build: [
      { kind: 'printer', x: 0, y: 0, dir: 2 },
      { kind: 'bot', x: 2, y: 2, dir: 0 },
      { kind: 'lamp', x: 1, y: 1, dir: 0 },
      { kind: 'belt', x: 2, y: 1, dir: 0 },
      { kind: 'printer', x: 4, y: 0, dir: 0 },
    ],
  });
  const lamp = machineAt(f, 1, 1),
    printer = machineAt(f, 0, 0),
    bot = machineAt(f, 2, 2);
  assert.deepEqual(reach(1, 1), [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ]);
  assert.deepEqual(boosted(f, lamp), [printer, bot]);
  assert.deepEqual(boost(f, printer), { speed: 1.4, stars: 0 });
  assert.deepEqual(boost(f, bot), { speed: 1.4, stars: 0 });
  assert.deepEqual(boost(f, machineAt(f, 4, 0)), { speed: 1, stars: 0 });
  assert.deepEqual(boosted(f, printer), []);
  bot.item = { id: 90, book: 'seven', done: false, mult: 1, star: false };
  advanceFactory(g, TICK_MS);
  assert.equal(printer.t, 1.4);
  assert.equal(bot.t, 1.4);
  actFactory(g, {
    type: 'factory-edit',
    build: [{ kind: 'lamp', x: 1, y: 2, dir: 0 }],
  });
  assert.equal(boost(f, bot).speed, 1.8);
  assert.equal(boost(f, printer).speed, 1.4);
});
await test('charm diagonal reach adds star chance to printers and uses the same seeded roll', () => {
  const g = game(),
    f = g.scratch.factory;
  g.coins = 1e15;
  f.blueprints = ['starter', 'charm'];
  actFactory(g, {
    type: 'factory-edit',
    build: [
      { kind: 'printer', x: 0, y: 0, dir: 2 },
      { kind: 'bot', x: 2, y: 0, dir: 0 },
    ],
  });
  const printer = machineAt(f, 0, 0);
  printer.t = printTicks('seven') - 1;
  g.seed = 2_060;
  const plain = structuredClone(g);
  actFactory(g, {
    type: 'factory-edit',
    build: [{ kind: 'charm', x: 1, y: 1, dir: 0 }],
  });
  const charm = machineAt(f, 1, 1);
  assert.deepEqual(boosted(f, charm), [printer]);
  assert.deepEqual(boost(f, printer), { speed: 1, stars: 0.05 });
  assert.deepEqual(boost(f, machineAt(f, 2, 0)), { speed: 1, stars: 0 });
  advanceFactory(plain, TICK_MS);
  advanceFactory(g, TICK_MS);
  assert.equal(machineAt(plain.scratch.factory, 0, 0).output.star, false);
  assert.equal(
    printer.output.star,
    true,
    'the charm turns a 2–7% roll into a star',
  );
  assert.equal(g.seed, plain.seed, 'boosts do not consume extra random rolls');
  actFactory(g, {
    type: 'factory-edit',
    build: [{ kind: 'charm', x: 0, y: 1, dir: 0 }],
  });
  assert.equal(boost(f, printer).stars, 0.1);
});
await test('stamper and gilder stack once on blank, scratched, starred and bundled tickets', () => {
  for (const original of [
    { done: false, star: false },
    { done: true, star: false },
    { done: true, star: true },
    { done: true, star: false, value: 100 },
    { done: true, star: false, mult: 2.08, stamped: true, gilded: true },
  ]) {
    const g = game(),
      s = g.scratch,
      f = s.factory;
    g.coins = 1e12;
    f.blueprints = ['starter', 'stamper', 'gilder'];
    actFactory(g, {
      type: 'factory-edit',
      build: ['stamper', 'gilder', 'stamper', 'gilder'].map((kind, x) => ({
        kind,
        x,
        y: 0,
        dir: 0,
      })),
    });
    const item = { id: 70, book: 'seven', mult: 1, ...original },
      initial = itemValue(s, item);
    machineAt(f, 0, 0).item = item;
    advanceFactory(g, 8_000);
    assert.equal(machineAt(f, 3, 0).output, item);
    assert.equal(item.mult, 2.08);
    assert.equal(item.stamped, true);
    assert.equal(item.gilded, true);
    assert.equal(item.done, original.done);
    const expected = original.stamped ? initial : initial * 2.08;
    assert.ok(Math.abs(itemValue(s, item) - expected) < 1e-9);
  }
});
await test('a bundle freezes 1.5 times three scratched ticket values, then receives fresh stamp and gild marks', () => {
  const g = game(),
    s = g.scratch,
    f = s.factory;
  g.coins = 1e15;
  f.blueprints = BLUEPRINTS.map((b) => b.id);
  actFactory(g, {
    type: 'factory-edit',
    build: ['bundler', 'stamper', 'gilder', 'cashier'].map((kind, x) => ({
      kind,
      x,
      y: 0,
      dir: 0,
    })),
  });
  const hold = Array.from({ length: 3 }, (_, i) => ({
      id: 50 + i,
      book: 'seven',
      done: true,
      mult: 2.08,
      star: i === 0,
      stamped: true,
      gilded: true,
    })),
    frozen = hold.reduce((sum, item) => sum + itemValue(s, item), 0) * 1.5;
  machineAt(f, 0, 0).hold = hold;
  g.coins = 0;
  advanceFactory(g, 2 * TICK_MS);
  const bundle = machineAt(f, 1, 0).item;
  assert.equal(bundle.value, frozen);
  assert.equal(bundle.mult, 1);
  assert.equal(bundle.done, true);
  assert.equal(bundle.stamped, undefined);
  assert.equal(bundle.gilded, undefined);
  assert.equal(machineAt(f, 0, 0).hold.length, 0);
  // Later book progress changes ordinary values, but never this frozen sum.
  s.xp.seven = bookXpAt(s, 4);
  advanceFactory(g, 5_000);
  assert.equal(bundle.mult, 2.08);
  assert.equal(bundle.stamped, true);
  assert.equal(bundle.gilded, true);
  assert.equal(f.sold, 1);
  assert.ok(Math.abs(g.coins - frozen * 2.08) < 1e-9);
});
await test('factory stepping stays deterministic across browser-sized increments and serialized reloads', () => {
  const g = game();
  line(g);
  g.coins = 1e15;
  g.scratch.factory.blueprints.push('lamp', 'charm', 'stamper', 'gilder');
  actFactory(g, {
    type: 'factory-edit',
    remove: [
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ],
    build: [
      { kind: 'stamper', x: 1, y: 0, dir: 0 },
      { kind: 'gilder', x: 3, y: 0, dir: 0 },
      { kind: 'lamp', x: 1, y: 1, dir: 0 },
      { kind: 'charm', x: 0, y: 1, dir: 0 },
    ],
  });
  const split = JSON.parse(JSON.stringify(g));
  advanceFactory(g, 60_250);
  for (let i = 0; i < 241; i++) advanceFactory(split, 250);
  assert.deepEqual(split, g);
});
await test('server factory edits and book choices persist, retries charge once, and failures leave the saved floor intact', () => {
  const db = openDatabase(':memory:');
  try {
    let service = new Expeditions(db);
    const host = actor('Jo'),
      made = service.create(host, { title: 'Factory', world: 'dunes' }, start);
    made.game.coins = 1e6;
    db.prepare('UPDATE expeditions SET state=? WHERE token=?').run(
      JSON.stringify(made.game),
      made.token,
    );
    const command = (action, requestId = randomUUID()) =>
      service.command(made.token, host, { requestId, action }, start);
    command({ type: 'scratch-book', pack: 'twins' });
    command({ type: 'factory-blueprint', id: 'starter' });
    const action = {
        type: 'factory-edit',
        build: [
          { kind: 'printer', x: 0, y: 0, dir: 0, book: 'seven' },
          { kind: 'printer', x: 1, y: 0, dir: 1, book: 'twins' },
          { kind: 'belt', x: 2, y: 0, dir: 0 },
          { kind: 'bot', x: 3, y: 0, dir: 0 },
        ],
      },
      id = randomUUID();
    const paid = command(action, id);
    service = new Expeditions(db);
    const retry = command(action, id);
    assert.equal(retry.game.coins, paid.game.coins);
    assert.deepEqual(retry.game.scratch.factory, paid.game.scratch.factory);
    assert.deepEqual(
      retry.game.scratch.feed
        .filter((e) => e.kind === 'machine')
        .map((e) => [e.what, e.n]),
      [
        ['printer', 2],
        ['bot', 1],
      ],
    );
    const readSaved = () =>
      db.prepare('SELECT state FROM expeditions WHERE token=?').get(made.token)
        .state;
    const saved = readSaved();
    assert.throws(
      () =>
        command({
          type: 'factory-edit',
          remove: [{ x: 0, y: 0 }],
          arrange: [{ x: 1, y: 0, to: { x: 0, y: 0 }, dir: 2 }],
          build: [{ kind: 'bot', x: 3, y: 0, dir: 0 }],
        }),
      /taken/,
    );
    assert.equal(readSaved(), saved);
    command({
      type: 'factory-edit',
      arrange: [
        { x: 0, y: 0, to: { x: 1, y: 0 }, dir: 0 },
        { x: 1, y: 0, to: { x: 0, y: 0 }, dir: 1 },
      ],
    });
    const view = command({
      type: 'factory-book',
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      book: 'twins',
    });
    service = new Expeditions(db);
    const restored = service.get(made.token, host, start);
    assert.equal(restored.game.coins, view.game.coins);
    assert.deepEqual(restored.game.scratch.factory, view.game.scratch.factory);
    assert.ok(
      restored.game.scratch.factory.machines
        .filter((m) => m.kind === 'printer')
        .every((m) => m.book === 'twins'),
    );
    for (const type of [
      'factory-build',
      'factory-remove',
      'factory-rotate',
      'factory-move',
      'factory-shift',
    ])
      assert.throws(() => command({ type }), /Unknown/);
  } finally {
    db.close();
  }
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

/** The foil rule before seals out of the coin's reach were skipped: every
 * bit of every seal measured against every segment. */
function slowRub(ticket, s, points, breaks = []) {
  const radius = brushRadius(s),
    threshold = Math.ceil(64 * FOIL[level(s, 'foil')]),
    { cols, rows } = ticket;
  for (let p = 0; p < points.length && !ticket.ended; p++) {
    const a = points[p && !breaks.includes(p) ? p - 1 : p],
      b = points[p],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy,
      candidates = [];
    ticket.cells.forEach((cell, index) => {
      if (cell.revealed || sealLocked(ticket, index)) return;
      const col = index % cols,
        row = Math.floor(index / cols),
        mask = cell.mask.split('');
      let rubbed = 0;
      for (let bit = 0; bit < 64; bit++) {
        if (mask[bit] === '1') {
          rubbed++;
          continue;
        }
        const x = (col + 0.1 + (((bit % 8) + 0.5) / 8) * 0.8) / cols,
          y = (row + 0.1 + ((Math.floor(bit / 8) + 0.5) / 8) * 0.8) / rows;
        const along = length
          ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length))
          : 0;
        if (Math.hypot(x - a.x - dx * along, y - a.y - dy * along) > radius)
          continue;
        mask[bit] = '1';
        rubbed++;
      }
      cell.mask = mask.join('');
      if (rubbed >= threshold) {
        const cx = (col + 0.5) / cols,
          cy = (row + 0.5) / rows;
        candidates.push({
          index,
          along: length ? ((cx - a.x) * dx + (cy - a.y) * dy) / length : 0,
        });
      }
    });
    for (const { index } of candidates.sort((a, b) => a.along - b.along)) {
      if (ticket.ended) break;
      openSeal(ticket, index);
    }
  }
}
await test('skipping seals beyond the coin changes nothing; queued strokes sent as one match strokes sent apart', () => {
  const g = game(),
    r = rand(21);
  for (const book of ['seven', 'twins', 'ladder', 'mine']) {
    unlock(g, book);
    for (let n = 0; n < 6; n++) {
      const a = printTicket(n, book, n % 3, rand(n + 40), 0, start),
        b = structuredClone(a);
      const points = Array.from({ length: 60 }, () => ({ x: r(), y: r() })),
        breaks = [15, 31, 44];
      rubTicket(a, g.scratch, points, breaks);
      slowRub(b, g.scratch, points, breaks);
      assert.deepEqual(a, b, `${book} ${n}`);
    }
  }
  // The browser rubs every point against the one before as it moves; the
  // server gets the same points, merged into one command with its breaks.
  const t = printTicket(9, 'seven', 1, rand(3), 0, start),
    one = structuredClone(t),
    apart = structuredClone(t);
  const strokes = [
    [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.2 },
      { x: 0.9, y: 0.15 },
    ],
    [
      { x: 0.2, y: 0.8 },
      { x: 0.3, y: 0.5 },
    ],
    [{ x: 0.7, y: 0.7 }],
  ];
  for (const stroke of strokes)
    stroke.forEach((p, i) =>
      rubTicket(apart, g.scratch, i ? [stroke[i - 1], p] : [p]),
    );
  rubTicket(one, g.scratch, strokes.flat(), [3, 5]);
  assert.deepEqual(
    one.cells.map((c) => [c.mask, c.revealed]),
    apart.cells.map((c) => [c.mask, c.revealed]),
  );
});
await test('every book costs several times the book before it, at every level', () => {
  const s = game().scratch;
  for (let i = 1; i < BOOKS.length; i++)
    for (let l = 0; l < 4; l++) {
      const ratio =
        ticketPrice(s, BOOKS[i].id, l) / ticketPrice(s, BOOKS[i - 1].id, l);
      // ∞ sizes differ more between books; a later book still costs more.
      const [low, high] = l < 3 ? [2.5, 16] : [1.4, 32];
      assert.ok(
        ratio >= low && ratio <= high,
        `${BOOKS[i].id} ${l}: ×${ratio.toFixed(2)}`,
      );
    }
});
/** A ticket of `pack` at `lvl` played carefully to its end, outside a desk. */
function careful(pack, lvl, seed = 3) {
  const r = rand(seed),
    t = printTicket(1, pack, lvl, r, 0, start);
  while (!t.ended) openSeal(t, suggest(t, r));
  return t;
}
await test('book XP rewards how well a ticket went, ∞ fastest, and can never skip a level', () => {
  const s = game().scratch;
  s.xp.crown = s.xp.twins = s.xp.ladder = bookXpAt(s, INFINITY_AT);
  // Crown Jewels always pays the careful average, so quality is exactly 1.
  const crowns = [0, 1, 2, 3].map((l) => careful('crown', l));
  assert.ok(crowns.every((t) => t.perfect && ticketQuality(t) === 1));
  const xp = crowns.map((t) => ticketXp(t, s));
  assert.deepEqual(
    xp,
    XP_WEIGHTS.map((w) => w * XP_SCALE),
  );
  assert.ok(xp[3] > xp[2] && xp[2] > xp[1] && xp[1] > xp[0]);
  // A messy ticket earns little or nothing; a perfect one the most.
  const messy = printTicket(1, 'crown', 3, rand(3), 0, start);
  openSeal(
    messy,
    messy.cells.findIndex((c) => c.face !== 'crown'),
  );
  assert.ok(messy.ended && !messy.perfect);
  assert.equal(ticketQuality(messy), 0);
  assert.equal(ticketXp(messy, s), 0);
  const twins = printTicket(1, 'twins', 2, rand(4), 0, start),
    mate = (i) =>
      twins.cells.findIndex(
        (c, j) => j !== i && c.group === twins.cells[i].group,
      );
  openSeal(twins, 0);
  openSeal(twins, mate(0));
  const a = twins.cells.findIndex((c) => !c.revealed);
  openSeal(twins, a);
  openSeal(
    twins,
    twins.cells.findIndex((c, j) => !c.revealed && j !== mate(a)),
  );
  assert.ok(twins.ended && !twins.perfect && ticketQuality(twins) === 0);
  // Below half the careful average earns nothing; quality is capped.
  const ladders = Array.from({ length: 40 }, (_, i) =>
    careful('ladder', 3, i + 1),
  );
  const perfect = ladders.find((t) => t.perfect),
    poor = ladders.find((t) => !t.perfect && prizeUnits(t) < 6);
  assert.ok(perfect && poor);
  assert.equal(ticketQuality(perfect), QUALITY_CAP);
  assert.equal(ticketXp(perfect, s), QUALITY_CAP * XP_SCALE);
  assert.equal(ticketQuality(poor), 0);
  // Golden seals and upgrades never buy experience.
  const plain = careful('seven', 2, 8),
    gilded = structuredClone(plain);
  gilded.cells.find((c) => c.paid && c.prize).gold = true;
  assert.equal(ticketQuality(gilded), ticketQuality(plain));
  // Over many careful tickets the average quality is close to one.
  for (const [pack, lvl] of [
    ['seven', 0],
    ['path', 1],
    ['chart', 3],
  ]) {
    let total = 0;
    for (let i = 1; i <= 60; i++) total += ticketQuality(careful(pack, lvl, i));
    assert.ok(
      total / 60 > 0.6 && total / 60 < 1.3,
      `${pack} ${lvl}: ${total / 60}`,
    );
  }
  // One ticket never gives more than the current level's whole step.
  const early = game().scratch;
  early.upgrades.early = 3;
  assert.ok(ticketXp(perfect, early) <= bookExperience(early, 'ladder').needed);
  // Even with Early print, every level's step is longer than the best
  // ticket of the hardest difficulty open at that level.
  for (let lvl = 1; lvl < 30; lvl++) {
    const hardest = lvl >= INFINITY_AT ? 3 : lvl - 1;
    assert.ok(
      bookXpAt(early, lvl + 1) - bookXpAt(early, lvl) >
        QUALITY_CAP * XP_SCALE * XP_WEIGHTS[hardest],
      `level ${lvl}`,
    );
  }
});
await test('book levels continue beyond III, scaling prices and rewards together and announcing levels and ∞', () => {
  const g = game();
  g.coins = 1e30;
  unlock(g, 'crown');
  const s = g.scratch;
  s.xp.crown = bookXpAt(s, 3) - 1;
  assert.equal(levelOpen(s, 'crown'), 1);
  const before = botReward(s, 'crown');
  let t = take(g, 'crown', 'Jo', 1);
  play(g, t);
  assert.equal(t.xp, XP_WEIGHTS[1] * XP_SCALE);
  assert.equal(levelOpen(s, 'crown'), 2);
  assert.ok(
    botReward(s, 'crown') > before * 1.3,
    'the factory prints level III',
  );
  assert.deepEqual(
    s.feed.slice(-2).map((e) => [e.kind, e.what, e.n]),
    [
      ['win', 'crown', 1],
      ['level', 'crown', 2],
    ],
  );
  const top = botReward(s, 'crown');
  // III, then ∞ when level 3 is complete.
  s.xp.crown = bookXpAt(s, INFINITY_AT) - 1;
  assert.equal(bookLevel(s, 'crown'), 3);
  assert.ok(levelProgress(s, 'crown') > 0.99);
  t = take(g, 'crown', 'Jo', 2);
  play(g, t);
  assert.equal(t.xp, XP_WEIGHTS[2] * XP_SCALE);
  assert.equal(bookLevel(s, 'crown'), 4);
  assert.equal(levelOpen(s, 'crown'), 3);
  assert.deepEqual(
    s.feed.slice(-3).map((e) => [e.kind, e.what, e.n]),
    [
      ['win', 'crown', 2],
      ['level', 'crown', 3],
      ['infinity', 'crown', 3],
    ],
  );
  assert.equal(printLevel(s, 'crown'), 2, 'the factory keeps printing III');
  const reward = botReward(s, 'crown');
  assert.ok(Math.abs(reward / top - (1 + BOOK_LEVEL_GAIN)) < 1e-9);
  const xp = bookExperience(s, 'crown');
  assert.equal(xp.needed, 2 * BOOK_LEVEL_STEP * XP_SCALE);
  assert.equal(xp.current, XP_WEIGHTS[2] * XP_SCALE - 1);
  // ∞ levels twice as fast as III and ten times as fast as I.
  const at = s.xp.crown;
  t = take(g, 'crown', 'Jo', 3);
  assert.equal(t.cols * t.rows, 64);
  play(g, t);
  assert.equal(s.xp.crown - at, XP_SCALE);
  play(g, take(g, 'crown', 'Jo', 0));
  assert.equal(s.xp.crown - at, XP_SCALE + XP_SCALE * XP_WEIGHTS[0]);
  assert.ok(
    !s.feed.slice(-2).some((e) => e.kind === 'infinity'),
    '∞ is announced once',
  );
  // Level 5 adds another half of the level 3 value to prices and sales.
  const price = ticketPrice(s, 'crown', 3);
  s.xp.crown = bookXpAt(s, 5);
  assert.equal(
    bookExperience(s, 'crown').needed,
    3 * BOOK_LEVEL_STEP * XP_SCALE,
  );
  assert.ok(Math.abs(ticketPrice(s, 'crown', 3) / price - 2 / 1.5) < 0.01);
  assert.ok(Math.abs(botReward(s, 'crown') / reward - 2 / 1.5) < 1e-9);
  // Early print can raise levels at once; the desk hears about it.
  s.xp.seven = bookXpAt(s, INFINITY_AT) - 1;
  s.upgrades.loyalty = 1;
  actScratch(g, { type: 'scratch-upgrade', id: 'early' }, 'Jo', start);
  assert.equal(levelOpen(s, 'seven'), 3);
  assert.deepEqual(
    s.feed.slice(-3).map((e) => [e.kind, e.what]),
    [
      ['upgrade', 'early'],
      ['level', 'seven'],
      ['infinity', 'seven'],
    ],
  );
  // The feed stays short.
  assert.ok(s.feed.length <= 24);
  assert.ok(s.feed.every((e, i, all) => !i || e.id > all[i - 1].id));
});
await test('purchases are announced with who made them; belts and tidying are not', () => {
  const g = game();
  g.coins = 1e9;
  actRelic(g, { type: 'scratch-book', pack: 'twins' }, 'Ann', start, 'ann');
  actRelic(g, { type: 'scratch-upgrade', id: 'coin' }, 'Ann', start, 'ann');
  actRelic(g, { type: 'factory-blueprint', id: 'starter' }, 'Bo', start, 'bo');
  actRelic(
    g,
    {
      type: 'factory-edit',
      build: [
        { kind: 'printer', x: 0, y: 0, dir: 0 },
        { kind: 'belt', x: 1, y: 0, dir: 0 },
        { kind: 'bot', x: 2, y: 0, dir: 0 },
        { kind: 'bot', x: 2, y: 1, dir: 0 },
      ],
    },
    'Bo',
    start,
    'bo',
  );
  actRelic(
    g,
    {
      type: 'factory-edit',
      arrange: [{ x: 1, y: 0, to: { x: 1, y: 0 }, dir: 1 }],
    },
    'Bo',
    start,
    'bo',
  );
  assert.deepEqual(
    g.scratch.feed.map((e) => [e.by, e.kind, e.what, e.n]),
    [
      ['ann', 'book', 'twins', undefined],
      ['ann', 'upgrade', 'coin', 1],
      ['bo', 'blueprint', 'starter', undefined],
      ['bo', 'machine', 'printer', 1],
      ['bo', 'machine', 'bot', 2],
    ],
  );
});
await test('a selection of machines moves and turns together, never onto another machine', () => {
  const g = game();
  line(g);
  advanceFactory(g, 3000);
  const f = g.scratch.factory,
    cells = [0, 1, 2].map((x) => ({ x, y: 0 }));
  const shift = (dx, dy) =>
    cells.map((c) => ({
      ...c,
      to: { x: c.x + dx, y: c.y + dy },
      dir: machineAt(f, c.x, c.y).dir,
    }));
  const held = f.machines.find((m) => m.x === 1).item?.id;
  assert.throws(
    () => actFactory(g, { type: 'factory-edit', arrange: shift(1, 0) }),
    /taken/,
  );
  assert.throws(
    () => actFactory(g, { type: 'factory-edit', arrange: shift(0, -1) }),
    /inside/,
  );
  // Moving along itself is fine: the group only has to land on free floor.
  actFactory(g, { type: 'factory-edit', arrange: shift(0, 2) });
  assert.deepEqual(
    f.machines.filter((m) => m.y === 2).map((m) => [m.kind, m.x]),
    [
      ['printer', 0],
      ['belt', 1],
      ['bot', 2],
    ],
  );
  assert.equal(machineAt(f, 1, 2).item?.id, held);
  actFactory(g, {
    type: 'factory-edit',
    arrange: [...cells.map((c) => ({ x: c.x, y: 2 })), { x: 4, y: 0 }].map(
      (c) => ({
        ...c,
        to: c,
        dir: 1,
      }),
    ),
  });
  assert.deepEqual(
    f.machines.map((m) => [m.kind, m.dir]),
    [
      ['belt', 0],
      ['cashier', 0],
      ['printer', 1],
      ['belt', 1],
      ['bot', 1],
    ],
  );
});
await test('one printer keeps three bots busy on every book; faster bots need lamps', () => {
  const run = (book, pieces, bots = 0) => {
    const g = game();
    g.scratch.upgrades.bots = bots;
    line(g);
    unlock(g, book);
    g.coins = 1e6;
    actFactory(g, {
      type: 'factory-edit',
      remove: [1, 2, 3, 4].map((x) => ({ x, y: 0 })),
    });
    actFactory(g, {
      type: 'factory-edit',
      arrange: [{ x: 0, y: 0, to: { x: 0, y: 1 }, dir: 0 }],
    });
    g.coins = 1e6;
    actFactory(g, { type: 'factory-blueprint', id: 'splitter' });
    actFactory(g, { type: 'factory-blueprint', id: 'lamp' });
    actFactory(g, { type: 'factory-edit', build: pieces });
    actFactory(g, { type: 'factory-book', cells: [{ x: 0, y: 1 }], book });
    advanceFactory(g, 30 * 60000);
    return g.scratch.factory.sold;
  };
  const p = (kind, x, y) => ({ kind, x, y, dir: 0 });
  for (const book of ['twins', 'ladder']) {
    const one = run(book, [
      p('belt', 1, 1),
      p('bot', 2, 1),
      p('belt', 3, 1),
      p('cashier', 4, 1),
    ]);
    // Printer → splitter → three bots, each into its own cashier.
    const line = [
      p('splitter', 1, 1),
      p('bot', 2, 1),
      p('cashier', 3, 1),
      p('bot', 1, 0),
      p('cashier', 2, 0),
      p('bot', 1, 2),
      p('cashier', 2, 2),
    ];
    const three = run(book, line);
    assert.ok(three >= one * 2.8, `${book}: ${one} → ${three}`);
    // Fast bots outrun the printer until a lamp reaches it.
    const fast = run(book, line, 1),
      lit = run(book, [...line, p('lamp', 0, 0)], 1);
    assert.ok(fast < three * 1.1, `${book}: ${three} → ${fast}`);
    assert.ok(lit > fast * 1.3, `${book}: ${fast} → ${lit}`);
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
              cells: [{ x: m.x, y: m.y }],
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
          type: 'factory-edit',
          build: [
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
  // Uncapped levels and ∞ bring the careful-player run to about 2h37.
  assert.ok(reached.crown >= 2.5 * 60, `crown at ${reached.crown} min`);
});

await test('version 4 desks keep every book level and its progress as XP, and books past level 3 open ∞', () => {
  const old = (books, top, early = 0) => {
    const g = game();
    Object.assign(g.scratch, { version: 4, books, top, upgrades: { early } });
    delete g.scratch.xp;
    return JSON.parse(JSON.stringify(g));
  };
  const g = old(
    { seven: 5, twins: 20, path: 100, ladder: 100, mine: 1e9 },
    { path: 0, ladder: 22, mine: 1e9 },
  );
  const s = scratchFor(g);
  assert.equal(s.version, 5);
  assert.equal(s.top, undefined);
  const level = (id) => [bookLevel(s, id), levelOpen(s, id)];
  assert.deepEqual(level('seven'), [1, 0]);
  assert.equal(levelProgress(s, 'seven'), 5 / 8);
  assert.deepEqual(level('twins'), [2, 1]);
  assert.equal(levelProgress(s, 'twins'), 12 / 17);
  assert.deepEqual(level('path'), [3, 2]);
  assert.equal(levelProgress(s, 'path'), 0);
  // 22 hard tickets were level 4 and 7 of the 30 toward level 5.
  assert.deepEqual(level('ladder'), [4, 3]);
  assert.deepEqual(bookExperience(s, 'ladder'), {
    level: 4,
    current: 7 * XP_SCALE,
    needed: 2 * BOOK_LEVEL_STEP * XP_SCALE,
  });
  const huge = bookExperience(s, 'mine');
  assert.ok(
    huge.level > 100 && huge.current >= 0 && huge.current < huge.needed,
  );
  assert.equal(levelOpen(s, 'mine'), 3);
  assert.ok(Number.isFinite(ticketPrice(s, 'mine', 3)));
  assert.ok(Number.isFinite(botReward(s, 'mine')));
  assert.deepEqual(level('crown'), [1, 0]);
  // Early print kept its shorter steps: five hard tickets were level 4.
  const e = scratchFor(
    old({ seven: 100, twins: 100 }, { seven: 4, twins: 5 }, 3),
  );
  assert.equal(bookLevel(e, 'seven'), 3);
  assert.equal(bookLevel(e, 'twins'), 4);
  assert.equal(levelOpen(e, 'twins'), 3);
  // Migrating once is enough: a reload changes nothing.
  const again = JSON.parse(JSON.stringify({ ...g, scratch: s }));
  assert.deepEqual(scratchFor(again).xp, s.xp);
});
await test('unbounded book levels remain finite at large XP', () => {
  const s = game().scratch;
  for (const xp of [1e4, 1e6, 1e9, 1e12, 1e15, Number.MAX_SAFE_INTEGER]) {
    s.xp.seven = xp;
    const e = bookExperience(s, 'seven');
    assert.ok(e.level > 4 && e.current >= 0 && e.current < e.needed);
    assert.ok([e.level, e.current, e.needed].every(Number.isInteger));
    assert.equal(levelOpen(s, 'seven'), 3);
    assert.ok(Number.isFinite(ticketPrice(s, 'seven', 3)));
    assert.ok(Number.isFinite(botReward(s, 'seven')));
  }
  s.xp.seven = -5;
  assert.equal(bookLevel(s, 'seven'), 1);
  s.xp.seven = 'lots';
  assert.equal(bookLevel(s, 'seven'), 1);
});
await test('Twins begins at the former second difficulty and keeps distinct steps', () => {
  const levels = BOOKS.find((b) => b.id === 'twins').levels;
  assert.deepEqual(levels, [
    { cols: 6, rows: 4, lives: 2, count: 3 },
    { cols: 6, rows: 4, lives: 2, count: 2 },
    { cols: 6, rows: 4, lives: 1, count: 2 },
    { cols: 6, rows: 5, lives: 1, count: 2 },
  ]);
});
await test('∞ is a harder ticket of the same puzzle in every book, phone sized and fairly priced', () => {
  for (const b of BOOKS) {
    const [iii, inf] = [b.levels[2], b.levels[3]];
    assert.equal(b.levels.length, 4);
    assert.ok(
      inf.cols <= 8 && inf.rows <= 11 && inf.cols * inf.rows <= 64,
      b.id,
    );
    // Never smaller. A careful player hits the jackpot less often, or, where
    // the careful player reads the one answer, the grid is bigger or allows
    // fewer mistakes.
    const [p3, pInf] = [AVERAGES[b.id][2][1], AVERAGES[b.id][3][1]];
    assert.ok(inf.cols * inf.rows >= iii.cols * iii.rows, b.id);
    assert.ok(
      pInf < p3 ||
        (pInf === 1 &&
          (inf.cols * inf.rows > iii.cols * iii.rows || inf.lives < iii.lives)),
      b.id,
    );
    // Every ∞ ticket prints, can be finished by a careful player, and the
    // logic books keep exactly one answer.
    for (let seed = 1; seed <= 4; seed++) {
      const t = careful(b.id, 3, seed);
      assert.equal(t.level, 3);
      assert.equal(t.cells.length, inf.cols * inf.rows);
      assert.ok(t.ended);
      const fresh = printTicket(1, b.id, 3, rand(seed), 0, start);
      if (b.id === 'twins')
        assert.equal(
          twinSolutions(
            fresh.cols,
            fresh.rows,
            fresh.cells.map((c) => c.n),
          ),
          1,
        );
      if (b.id === 'sunmoon')
        assert.equal(
          tangoSolutions(
            fresh.cols,
            fresh.rows,
            fresh.cells.map((c) => (c.given ? c.face === 'moon' : null)),
            fresh.signs,
          ),
          1,
        );
      if (b.id === 'crown')
        assert.equal(
          crownSolutions(
            fresh.cols,
            fresh.cells.map((c) => c.group),
          ),
          1,
        );
      if (b.id === 'seven')
        assert.equal(
          fresh.cells.filter((c) => c.face === 'seven').length,
          inf.count,
        );
      if (b.id === 'mine')
        assert.equal(
          fresh.cells.filter((c) => c.face === 'dynamite').length,
          inf.count,
        );
      if (b.id === 'ladder')
        assert.equal(
          new Set(fresh.cells.filter((c) => c.group === 1).map((c) => c.n))
            .size,
          inf.rows,
        );
    }
    // The price follows the same rule: half the careful player's winnings.
    const s = game().scratch,
      [units, perfect] = AVERAGES[b.id][3];
    assert.equal(
      ticketPrice(s, b.id, 3),
      Math.round(
        prizeUnit(s, b.id, 3) * units * (1 + perfect * 2) * PRICE_SHARE,
      ),
    );
  }
});
await test('dev workshop is a separate persisted, joinable and table-compatible save, rejected in production', () => {
  const previous = process.env.NODE_ENV;
  const db = openDatabase(':memory:');
  try {
    const service = new Expeditions(db);
    const input = { title: 'Workshop', world: 'dunes', devPreset: 'workshop' };
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => service.create(actor('Jo'), input, start),
      /only available in development/,
    );
    assert.throws(
      () => seedLuckyWorkshop(game()),
      /only available in development/,
    );
    process.env.NODE_ENV = 'development';
    const normal = service.create(
      actor('Jo'),
      { title: 'Keep me', world: 'dunes' },
      start,
    );
    const view = service.create(actor('Jo'), input, start);
    assert.notEqual(view.token, normal.token);
    assert.equal(
      service.get(normal.token, actor('Jo'), start).game.scratch.completed,
      0,
    );
    const g = view.game,
      s = g.scratch;
    assert.equal(s.unlocked.length, 8);
    assert.ok(
      UPGRADES.every((u) => s.upgrades[u.id] >= 0 && s.upgrades[u.id] <= u.max),
    );
    // High levels everywhere; ∞ open on every book but Crown Jewels, whose
    // lock shows how far it still is.
    assert.ok(BOOKS.every((b) => bookLevel(s, b.id) >= 3));
    assert.deepEqual(
      BOOKS.filter((b) => levelOpen(s, b.id) === 3).map((b) => b.id),
      BOOKS.slice(0, -1).map((b) => b.id),
    );
    assert.ok(BOOKS.slice(0, -1).every((b) => bookLevel(s, b.id) >= 10));
    assert.equal(levelOpen(s, 'crown'), 2);
    assert.ok(xpToInfinity(s, 'crown') > 0);
    assert.equal(s.factory.machines.length, 68);
    assert.equal(s.factory.version, 2);
    assert.deepEqual(
      s.factory.blueprints,
      BLUEPRINTS.map((b) => b.id),
    );
    assert.deepEqual(
      new Set(s.factory.machines.map((m) => m.kind)),
      new Set(ORDER),
    );
    assert.deepEqual(
      new Set(
        s.factory.machines
          .filter((m) => m.kind === 'printer')
          .map((m) => m.book),
      ),
      new Set(BOOKS.map((b) => b.id)),
    );
    assert.equal(
      new Set(s.factory.machines.map((m) => `${m.x},${m.y}`)).size,
      68,
    );
    assert.ok(s.factory.machines.every((m) => m.x < 16 && m.y < 9));
    assert.ok(s.factory.machines.some((m) => m.item || m.output));
    assert.ok(s.factory.sold > 0);
    const sold = s.factory.sold;
    advanceFactory(g, 60000);
    assert.ok(s.factory.sold > sold);
    assert.ok(
      s.factory.machines.some((m) => m.output && m.stuck > 0),
      'queues remain',
    );
    assert.ok(s.upgrades.bots < s.upgrades.printers);
    const joined = service.join(view.token, actor('Bo'), start);
    assert.equal(joined.members.length, 2);
    assert.equal(joined.game.scratch.completed, s.completed);
    service.seatTable(
      view.token,
      actor('Jo'),
      [actor('Jo'), actor('Bo'), actor('Ann')],
      start,
    );
    assert.equal(
      service.get(view.token, actor('Ann'), start).members.length,
      3,
    );
    assert.equal(service.list(actor('Jo')).length, 2);
  } finally {
    db.close();
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

await test('the dev workshop sells through every finished route and splitter branch, with just one unfinished queue', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    const g = game();
    seedLuckyWorkshop(g);
    const reset = (route) => {
      const copy = structuredClone(g),
        f = copy.scratch.factory;
      f.machines = f.machines.filter(
        (m) => route(m) || MACHINES[m.kind].family === 'boost',
      );
      for (const m of f.machines) {
        m.t = 0;
        m.item = null;
        m.output = null;
        delete m.hold;
        delete m.turn;
        delete m.stuck;
      }
      f.clock = 0;
      f.sold = 0;
      f.rate = 0;
      return copy;
    };
    const garden = (m) =>
      (m.y === 5 && m.x >= 1 && m.x <= 5) ||
      (m.x === 3 && m.y >= 3 && m.y <= 7);
    for (const route of [
      (m) => m.y === 1 && m.x <= 6,
      (m) => m.y === 1 && m.x >= 8,
      garden,
      ...[
        [8, 3],
        [12, 3],
        [8, 5],
        [12, 5],
        [8, 7],
      ].map(
        ([x, y]) =>
          (m) =>
            m.y === y && m.x >= x && m.x < x + 4,
      ),
    ]) {
      const copy = reset(route);
      advanceFactory(copy, 120_000);
      assert.ok(
        copy.scratch.factory.sold > 0,
        'each finished line sells in the warmup',
      );
    }
    for (const [x, y] of [
      [5, 5],
      [3, 3],
      [3, 7],
    ]) {
      const copy = reset(garden);
      copy.scratch.factory.machines = copy.scratch.factory.machines.filter(
        (m) => m.kind !== 'cashier' || (m.x === x && m.y === y),
      );
      advanceFactory(copy, 120_000);
      assert.ok(
        copy.scratch.factory.sold > 0,
        'every splitter branch reaches its cashier',
      );
    }
    const copy = reset((m) => m.y === 8 && m.x <= 3);
    advanceFactory(copy, 120_000);
    assert.equal(copy.scratch.factory.sold, 0);
    assert.ok(
      copy.scratch.factory.machines
        .filter((m) => m.y === 8)
        .every((m) => (m.item || m.output) && m.stuck > 20),
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
