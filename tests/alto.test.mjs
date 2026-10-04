import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actingSeats,
  breakdown,
  buildable,
  canUndo,
  createAlto,
  decisionKey,
  discount,
  flagScores,
  hold,
  isAltoSave,
  observe,
  payment,
  planScore,
  play,
  raceValue,
  scores,
  shareBonus,
  totalTurns,
  validMove,
  winners,
} from '../lib/games/alto/engine.ts';
import { botMove } from '../lib/games/alto/bot.ts';
import {
  baseHold,
  captains,
  firstFlight,
  flagPoints,
  growthFor,
  islandCount,
  lengths,
  pileCap,
  plans,
  plansPerSeason,
  planById,
  startPile,
  windBonus,
} from '../lib/games/alto/content.ts';
import { effectRule, effectShort } from '../lib/games/alto/text.ts';
import { altoLessons } from '../lib/games/alto/lessons.ts';

const choose = (g, seat, island, build) =>
  play(g, { type: 'choose', island, ...(build ? { build } : {}) }, seat);
/** Everyone flies; `picks[seat]` is an island or [island, plan]. */
function turn(g, picks) {
  for (const [seat, pick] of picks.entries()) {
    const [island, build] = Array.isArray(pick) ? pick : [pick];
    const next = choose(g, seat, island, build);
    assert.notEqual(
      next,
      g,
      `seat ${seat} could not choose ${JSON.stringify(pick)}`,
    );
    g = next;
  }
  return g;
}
function playOut(g, style) {
  let guard = 0;
  while (!g.over && guard++ < 400)
    for (const s of actingSeats(g)) {
      const m = botMove(g, s, style);
      const next = play(g, m, s);
      assert.notEqual(next, g, `bot move refused: ${JSON.stringify(m)}`);
      g = next;
      if (g.over) break;
    }
  return g;
}

void test('a match lays out two more islands than players, and every plan of every season', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const g = createAlto(n, 7);
    assert.equal(g.islands.length, islandCount(n));
    assert.equal(g.islands.length, n + 2);
    assert.ok(g.islands.every((i) => i.pile === startPile));
    assert.deepEqual(g.plans, firstFlight());
    assert.equal(g.phase, 'plan');
    assert.deepEqual(g.players[0].stock, [1, 1, 1, 0]);
    assert.equal(hold(g.players[0]), baseHold);
  }
  // Glass stays rare: one glass island until the biggest table.
  assert.equal(createAlto(5, 1).islands.filter((i) => i.good === 3).length, 1);
  assert.equal(createAlto(6, 1).islands.filter((i) => i.good === 3).length, 2);
  // Random plans: six a season from that season's pool, never repeated.
  const r = createAlto(4, 99, 'medium', {
    length: 'standard',
    plans: 'random',
  });
  r.plans.forEach((ids, s) => {
    assert.equal(ids.length, plansPerSeason);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => planById[id].season === s + 1));
  });
  assert.throws(() => createAlto(1, 1));
  assert.throws(() => createAlto(7, 1));
});

void test('payments use the goods first, then two of any others for each one short', () => {
  assert.deepEqual(payment([1, 1, 1, 0], [1, 1, 1, 0]), [1, 1, 1, 0]);
  // Short one wood: two of the most plentiful others pay for it.
  assert.deepEqual(payment([2, 0, 0, 0], [1, 3, 1, 0]), [1, 2, 0, 0]);
  assert.equal(payment([2, 0, 0, 0], [1, 1, 0, 0]), null);
  // Glass goes last among equals.
  assert.deepEqual(payment([0, 0, 0, 1], [1, 0, 0, 1]), [0, 0, 0, 1]);
  assert.deepEqual(payment([0, 0, 0, 1], [1, 1, 0, 0]), [1, 1, 0, 0]);
  // A discount takes a good you are short of off first.
  assert.deepEqual(payment([2, 1, 0, 1], [2, 1, 0, 0], 1), [2, 1, 0, 0]);
});

void test('alone you load up to your hold; together you split evenly and the rest stays', () => {
  let g = createAlto(3, 5);
  g.islands[0].pile = 5;
  g = turn(g, [0, 0, 1]);
  const r = g.last;
  assert.deepEqual(r.visits, [0, 0, 1]);
  // 5 shared by two: 2 each, 1 stays; the island then grows.
  assert.deepEqual(r.takes, [2, 2, 2]);
  assert.equal(g.islands[0].pile, 1 + growthFor(3));
  assert.deepEqual(g.players[0].stock, [3, 1, 1, 0]);
  // Alone on the quarry: a full hold of stone.
  assert.deepEqual(g.players[2].stock, [1, 3, 1, 0]);
  assert.equal(g.islands[1].pile, 0 + growthFor(3));
  // A pile of 1 shared by two gives nothing; it stays.
  g.islands[3].pile = 1;
  g = turn(g, [3, 3, 0]);
  assert.deepEqual(g.last.takes.slice(0, 2), [0, 0]);
  // Crystal, the rare cargo, fills by one less.
  assert.equal(g.islands[3].pile, 1 + growthFor(3, 3));
  assert.equal(growthFor(4), 2);
  assert.equal(growthFor(4, 3), 1);
  assert.equal(growthFor(5), 3);
  // A full planet stops filling.
  g.islands[0].pile = pileCap - 1;
  g = turn(g, [1, 2, 3]);
  assert.equal(g.islands[0].pile, pileCap);
});

void test('builds come before flights, once each, from the season on the table', () => {
  let g = createAlto(2, 3);
  // Nothing on the table can be built with the starting goods alone.
  for (const id of g.plans[0]) assert.equal(buildable(g, 0, id), null, id);
  assert.equal(
    buildable(g, 0, 'rigging'),
    null,
    'short of wood and nothing to swap',
  );
  g.players[0].stock = [1, 2, 2, 0];
  // Short of the crystal: one spare metal and one spare ice stand in for it.
  assert.deepEqual(buildable(g, 0, 'shrine'), [1, 2, 2, 0]);
  assert.equal(
    buildable(g, 0, 'lighthouse'),
    null,
    'a later season is not open yet',
  );
  assert.equal(
    validMove(g, { type: 'choose', island: 0, build: 'lighthouse' }, 0),
    false,
  );
  assert.equal(validMove(g, { type: 'choose', island: 9 }, 0), false);
  assert.equal(
    validMove(g, { type: 'choose', island: 0, build: 'shrine', extra: 1 }, 0),
    false,
  );
  // The shrine is paid with the goods held; the flight's cargo lands after.
  g = turn(g, [[1, 'shrine'], 0]);
  assert.deepEqual(g.players[0].built, ['shrine']);
  assert.deepEqual(g.players[0].stock, [0, 2, 0, 0]);
  assert.equal(breakdown(g, 0).plans, planById.shrine.effects[0].points);
  assert.equal(buildable(g, 0, 'shrine'), null, 'each plan once');
  // Holds grow with Rigging.
  g.players[1].stock = [5, 5, 5, 5];
  g = turn(g, [2, [0, 'rigging']]);
  assert.equal(hold(g.players[1]), baseHold + 1);
});

void test('builders of a monument on the same turn all score the lower prize', () => {
  let g = createAlto(3, 11);
  g.season = 2;
  for (const p of g.players) p.stock = [9, 9, 9, 9];
  const bell = planById.belltower;
  const ladder = bell.effects[0].ladder;
  g = turn(g, [[0, 'belltower'], [1, 'belltower'], 2]);
  assert.equal(g.players[0].scored.belltower, ladder[1]);
  assert.equal(g.players[1].scored.belltower, ladder[1]);
  assert.equal(g.races.belltower, 2);
  assert.equal(raceValue(g, bell), ladder[2]);
  g = turn(g, [0, 1, [2, 'belltower']]);
  assert.equal(g.players[2].scored.belltower, ladder[2]);
});

void test('a locked pick can be taken back only while someone is still choosing', () => {
  let g = createAlto(3, 2);
  g = choose(g, 0, 1);
  assert.ok(canUndo(g, 0));
  assert.deepEqual(actingSeats(g), [1, 2]);
  g = play(g, { type: 'undo' }, 0);
  assert.equal(g.ready[0], false);
  assert.equal(g.pending[0], null);
  g = choose(g, 0, 1);
  g = choose(g, 1, 2);
  const key = decisionKey(g);
  g = choose(g, 2, 3);
  assert.notEqual(decisionKey(g), key, 'the last lock resolves the turn');
  assert.equal(canUndo(g, 0), false);
  assert.equal(validMove(g, { type: 'undo' }, 0), false);
});

void test('a view hides the others’ picks, later orders and later winds', () => {
  let g = createAlto(4, 21, 'medium', {
    length: 'standard',
    plans: 'first',
    orders: true,
    winds: true,
    captains: true,
  });
  const offer = g.players[1].captainOffer;
  const seen = observe(g, 0);
  assert.equal(seen.rngState, 0);
  assert.equal(seen.players[1].captainOffer, undefined);
  assert.ok(seen.players[0].captainOffer.length === 2);
  for (const [s, p] of g.players.entries())
    g = play(g, { type: 'captain', captain: p.captainOffer[0] }, s);
  assert.equal(g.phase, 'plan');
  assert.ok(offer);
  g = choose(g, 1, 2);
  const v = observe(g, 0);
  assert.equal(v.pending[1], null);
  assert.equal(v.ready[1], true);
  assert.deepEqual(observe(g, 1).pending[1], { island: 2 });
  assert.equal(v.orderDeck.length, 1, 'only the next order shows');
  assert.equal(
    v.winds.filter((w) => w >= 0).length,
    2,
    'the wind now and the next one',
  );
  assert.equal(
    observe(g, null).pending.every((p) => p === null),
    true,
  );
});

void test('captains are two different offers each, and the match starts once all have picked', () => {
  let g = createAlto(4, 8, 'medium', {
    length: 'short',
    plans: 'first',
    captains: true,
  });
  assert.equal(g.phase, 'captain');
  const offered = g.players.flatMap((p) => p.captainOffer);
  assert.equal(
    new Set(offered).size,
    8,
    'eight captains, each offered once at four players',
  );
  assert.equal(validMove(g, { type: 'choose', island: 0 }, 0), false);
  assert.equal(validMove(g, { type: 'captain', captain: 'nobody' }, 0), false);
  for (const [s, p] of g.players.entries()) {
    const pick = p.captainOffer.includes('glazier')
      ? 'glazier'
      : p.captainOffer[0];
    g = play(g, { type: 'captain', captain: pick }, s);
  }
  assert.equal(g.phase, 'plan');
  const glazier = g.players.find((p) => p.captain === 'glazier');
  if (glazier) assert.equal(glazier.stock[3], 3);
  const navigator = g.players.find((p) => p.captain === 'navigator');
  if (navigator) assert.equal(shareBonus(navigator), 1);
  assert.equal(captains.length, 8);
});

void test('winds fill one island more; flags reward landing alone', () => {
  let g = createAlto(2, 4, 'medium', {
    length: 'short',
    plans: 'first',
    winds: true,
    flags: true,
  });
  const wind = g.winds[0];
  assert.equal(g.islands[wind].pile, startPile + windBonus);
  assert.ok(
    g.winds.every((w, t) => t === 0 || w !== g.winds[t - 1]),
    'never twice running',
  );
  g = turn(g, [0, 1]);
  assert.deepEqual(g.players[0].flags.slice(0, 2), [1, 0]);
  assert.deepEqual(g.players[1].flags.slice(0, 2), [0, 1]);
  g = turn(g, [0, 0]);
  assert.equal(g.players[0].flags[0], 1, 'shared: no flag');
  assert.deepEqual(flagScores(g), [flagPoints.most, flagPoints.most]);
  g.players[1].flags[0] = 1;
  assert.deepEqual(flagScores(g), [
    flagPoints.tied + 0,
    flagPoints.most + flagPoints.tied,
  ]);
});

void test('orders are filled instead of a plan, first come, and replaced from the pile', () => {
  let g = createAlto(3, 17, 'medium', {
    length: 'standard',
    plans: 'first',
    orders: true,
  });
  const id = g.openOrders[0];
  const next = g.orderDeck[0];
  for (const p of g.players) p.stock = [6, 6, 6, 6];
  assert.equal(
    validMove(g, { type: 'choose', island: 0, order: id, build: 'shrine' }, 0),
    false,
  );
  g = play(g, { type: 'choose', island: 0, order: id }, 0);
  g = play(g, { type: 'choose', island: 1, order: id }, 1);
  g = choose(g, 2, 2);
  assert.ok(!g.openOrders.includes(id));
  assert.ok(g.openOrders.includes(next));
  assert.equal(g.players[0].orderPoints, g.players[1].orderPoints);
  assert.ok(g.players[0].orderPoints > 0);
  assert.equal(breakdown(g, 0).orders, g.players[0].orderPoints);
});

void test('bots finish every setup in its number of turns, and saves round-trip', () => {
  for (const n of [2, 3, 4, 6])
    for (const length of Object.keys(lengths)) {
      const options = {
        length,
        plans: n % 2 ? 'random' : 'first',
        winds: n > 2,
        orders: n > 3,
        flags: true,
        captains: n !== 3,
      };
      let g = createAlto(n, 1000 + n, n === 6 ? 'hard' : 'medium', options);
      g.difficulty = ['easy', 'medium', 'hard'][n % 3];
      let turns = 0;
      while (!g.over) {
        const before = g.history.length;
        for (const s of actingSeats(g)) {
          const m = botMove(g, s);
          g = play(g, m, s);
          if (g.over) break;
        }
        if (g.history.length > before) turns++;
        assert.ok(
          isAltoSave(JSON.parse(JSON.stringify(g))),
          'a saved match restores',
        );
        assert.ok(turns <= totalTurns(g));
      }
      assert.equal(turns, 3 * lengths[length]);
      assert.equal(g.phase, 'over');
      const sc = scores(g);
      assert.ok(sc.every((v) => Number.isInteger(v) && v >= 0));
      assert.ok(winners(g).length >= 1);
      assert.equal(botMove(g, 0), null);
    }
  assert.equal(isAltoSave({ kind: 'alto' }), false);
  assert.equal(isAltoSave(null), false);
});

void test('bots pick different islands often enough to share and to fly alone', () => {
  let alone = 0,
    flights = 0;
  for (let k = 0; k < 6; k++) {
    const g = playOut(createAlto(4, 50 + k));
    for (const r of g.history)
      for (const v of r.visits) {
        flights++;
        if (r.visits.filter((w) => w === v).length === 1) alone++;
      }
  }
  const share = alone / flights;
  assert.ok(share > 0.25 && share < 0.8, `alone share ${share}`);
});

void test('every plan has words for its card, its rule and its lesson numbers', () => {
  for (const p of plans) {
    assert.ok(p.effects.length > 0, p.id);
    for (const e of p.effects) {
      assert.ok(effectShort(e).length > 0, p.id);
      assert.match(effectRule(e), /\.$/, p.id);
    }
    assert.ok(
      p.cost.reduce((a, b) => a + b, 0) >= 2,
      `${p.id} costs something`,
    );
  }
  // Each season's pool holds enough plans to draw from at random.
  for (const s of [1, 2, 3])
    assert.ok(plans.filter((p) => p.season === s).length > plansPerSeason);
  assert.equal(new Set(plans.map((p) => p.id)).size, plans.length);
  assert.ok(altoLessons.every((l) => l.title && l.text));
  assert.match(altoLessons[1].text, new RegExp(`hold of ${baseHold}`));
});

void test('ship parts load more; base modules score; each family counts on its own', () => {
  // Every upgrade belongs to exactly one family, and scorers sit in the base.
  for (const p of plans) {
    const scores = p.effects.some((e) =>
      ['points', 'race', 'per', 'perHold', 'thrift', 'sets'].includes(e.type),
    );
    if (scores) assert.equal(p.family, 'base', p.id);
    if (['hold', 'yield', 'alone', 'share'].includes(p.effects[0].type))
      assert.equal(p.family, 'ship', p.id);
  }
  const g = createAlto(2, 9, 'medium', { length: 'short', plans: 'random' });
  const me = g.players[0];
  me.built = ['rigging', 'sawmill', 'shrine', 'post'];
  // Factory: per ship part. Museum: per base module. Garage: per hold.
  me.built.push('guildhall', 'skytower', 'archive');
  const per = (id) => planById[id].effects[0].points;
  assert.equal(planScore(me, 'guildhall'), per('guildhall') * 2);
  assert.equal(planScore(me, 'skytower'), per('skytower') * 5);
  assert.equal(planScore(me, 'archive'), per('archive') * hold(me));
  // The Toolbox takes one off base modules only.
  me.built = ['post'];
  assert.equal(discount(g, me, 'base'), 1);
  assert.equal(discount(g, me, 'ship'), 0);
  me.built = ['market'];
  assert.equal(discount(g, me, 'ship'), 1);
  // The Architect: base modules cost one less.
  me.built = [];
  me.captain = 'architect';
  assert.equal(discount(g, me, 'base'), 1);
  assert.equal(discount(g, me, 'ship'), 0);
});
