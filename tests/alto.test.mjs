import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actingSeats,
  breakdown,
  buildable,
  canUndo,
  createAlto,
  currentPlans,
  decisionKey,
  discount,
  fillable,
  flagScores,
  hold,
  maxPlanLevel,
  nextPlan,
  ownedPlan,
  isAltoSave,
  observe,
  payment,
  planScore,
  planFor,
  planAtLevel,
  planLevel,
  play,
  raceValue,
  scores,
  shareBonus,
  totalTurns,
  turnsPerSeason,
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

/** An actual pre-refit save shape: its content and pacing must stay unchanged. */
function legacyGame(length = 'short') {
  return {
    kind: 'alto',
    version: 1,
    rules: 2,
    rngState: 3,
    difficulty: 'medium',
    seats: ['You', 'Wren'],
    revision: 0,
    over: false,
    tutorial: false,
    lesson: 0,
    options: { length, plans: 'first' },
    phase: 'plan',
    season: 1,
    turn: 1,
    islands: [
      { id: 'pinewood', good: 0, pile: 2 },
      { id: 'quarry', good: 1, pile: 2 },
      { id: 'meadow', good: 2, pile: 2 },
      { id: 'spire', good: 3, pile: 2 },
    ],
    plans: [
      ['rigging', 'sawmill', 'mason', 'fold', 'shrine', 'kite'],
      ['glassworks', 'sails', 'belltower', 'gardens', 'windmill', 'bridge'],
      [
        'lighthouse',
        'palace',
        'guildhall',
        'observatory',
        'archive',
        'fountain',
      ],
    ],
    races: {},
    players: Array.from({ length: 2 }, () => ({
      stock: [1, 1, 1, 0],
      built: [],
      scored: {},
      orders: [],
      orderPoints: 0,
      flags: [0, 0, 0, 0],
    })),
    pending: [null, null],
    ready: [false, false],
    last: null,
    history: [],
  };
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

void test('the first year invests in ships, and unlocked plans stay available', () => {
  let g = createAlto(2, 3);
  assert.equal(g.rules, 3);
  assert.equal(totalTurns(g), 30);
  assert.equal(turnsPerSeason(g), 10);
  assert.equal(
    totalTurns(createAlto(2, 3, 'medium', { length: 'short', plans: 'first' })),
    24,
  );
  assert.ok(g.players.every((p) => p.edition === 3));
  const first = [...currentPlans(g)];
  assert.ok(first.length >= 6);
  for (const id of first) {
    assert.equal(planFor(g, id).family, 'ship', id);
    assert.ok(
      planFor(g, id).effects.every(
        (e) =>
          ![
            'points',
            'race',
            'per',
            'perHold',
            'perLevel',
            'thrift',
            'sets',
          ].includes(e.type),
      ),
      id,
    );
  }
  g.players[0].stock = [20, 20, 20, 20];
  assert.equal(
    buildable(g, 0, 'shrine'),
    null,
    'points cannot be bought in year one',
  );
  assert.equal(buildable(g, 0, 'lighthouse'), null, 'later plans are not open');
  assert.equal(validMove(g, { type: 'choose', island: 9 }, 0), false);
  assert.equal(
    validMove(g, { type: 'choose', island: 0, build: 'rigging', extra: 1 }, 0),
    false,
  );
  g = turn(g, [[0, 'rigging'], 1]);
  assert.equal(breakdown(g, 0).plans, 0);
  assert.equal(breakdown(g, 0).bonus, 0);
  assert.deepEqual(g.last.gained, [0, 0]);
  while (g.season === 1) g = turn(g, [0, 1]);
  assert.ok(
    first.every((id) => currentPlans(g).includes(id)),
    'year one ships remain available',
  );
  const second = [...currentPlans(g)];
  while (g.season === 2) g = turn(g, [0, 1]);
  assert.ok(
    second.every((id) => currentPlans(g).includes(id)),
    'year two additions remain available',
  );
});

void test('ship refits unlock one tier each year, replace effects and spend before the flight', () => {
  let g = createAlto(2, 3);
  const id = 'rigging';
  const original = structuredClone(g);
  assert.equal(planLevel(g.players[0], id), 0);
  assert.equal(maxPlanLevel(g, id), 1);
  g.players[0].stock = [...nextPlan(g, g.players[0], id).cost];
  const firstCost = [...g.players[0].stock];
  g.islands[0].pile = 10;
  g = turn(g, [[0, id], 1]);
  assert.deepEqual(g.players[0].built, [id]);
  assert.equal(planLevel(g.players[0], id), 1);
  assert.deepEqual(g.last.paid[0], firstCost);
  assert.deepEqual(g.players[0].stock, [hold(g.players[0]), 0, 0, 0]);
  const levelOneHold = hold(g.players[0]);
  assert.equal(
    g.last.takes[0],
    levelOneHold,
    'new capacity works on the purchase flight',
  );
  g.players[0].stock = [30, 30, 30, 30];
  assert.equal(buildable(g, 0, id), null, 'year one cannot refit');
  g.season = 2;
  g.turn = 1;
  assert.equal(maxPlanLevel(g, id), 2);
  const next = nextPlan(g, g.players[0], id);
  g.players[0].stock = [0, 0, 0, 0];
  assert.equal(buildable(g, 0, id), null, 'refitting still requires cargo');
  g.players[0].stock = [...next.cost];
  assert.deepEqual(buildable(g, 0, id), next.cost);
  g.islands[0].pile = 10;
  g = turn(g, [[0, id], 1]);
  assert.equal(planLevel(g.players[0], id), 2);
  assert.deepEqual(
    g.players[0].built,
    [id],
    'one fitted part, never duplicate IDs',
  );
  assert.deepEqual(g.last.paid[0], next.cost);
  assert.equal(
    hold(g.players[0]),
    baseHold +
      ownedPlan(g.players[0], id).effects.find((e) => e.type === 'hold').amount,
  );
  assert.ok(hold(g.players[0]) > levelOneHold);
  assert.equal(g.last.takes[0], hold(g.players[0]));
  g.players[0].stock = [30, 30, 30, 30];
  assert.equal(buildable(g, 0, id), null, 'year two cannot take tier three');
  g.season = 3;
  g.turn = 1;
  assert.equal(maxPlanLevel(g, id), 3);
  g = turn(g, [[0, id], 1]);
  assert.equal(planLevel(g.players[0], id), 3);
  assert.deepEqual(g.players[0].built, [id]);
  assert.equal(nextPlan(g, g.players[0], id), null);
  assert.equal(
    buildable(g, 0, id),
    null,
    'maximum tier cannot be bought again',
  );
  assert.equal(breakdown(g, 0).plans, 0, 'refits do not create point copies');
  assert.equal(breakdown(g, 0).bonus, 0);
  assert.deepEqual(
    original.players[0].built,
    [],
    'play does not mutate prior state',
  );
});

void test('builders of a monument on the same turn all score the lower prize', () => {
  let g = createAlto(3, 11);
  g.season = 3;
  for (const p of g.players) p.stock = [9, 9, 9, 9];
  const monument = planFor(g, 'lighthouse');
  const ladder = monument.effects[0].ladder;
  g = turn(g, [[0, monument.id], [1, monument.id], 2]);
  assert.equal(g.players[0].scored[monument.id], ladder[1]);
  assert.equal(g.players[1].scored[monument.id], ladder[1]);
  assert.equal(g.races[monument.id], 2);
  assert.equal(raceValue(g, monument), ladder[2]);
  g = turn(g, [0, 1, [2, monument.id]]);
  assert.equal(g.players[2].scored[monument.id], ladder[2]);
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
  g.players[0].stock = [6, 6, 6, 6];
  assert.equal(fillable(g, 0, id), null, 'year one is reserved for the ship');
  assert.equal(
    validMove(g, { type: 'choose', island: 0, order: id }, 0),
    false,
  );
  g.season = 2;
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
    for (const e of [
      p.effects,
      ...(p.refits ?? []).map((refit) => refit.effects),
    ].flat()) {
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
    assert.ok(plans.filter((p) => p.season === s).length >= plansPerSeason);
  assert.equal(new Set(plans.map((p) => p.id)).size, plans.length);
  assert.ok(altoLessons.every((l) => l.title && l.text));
  assert.match(altoLessons[1].text, new RegExp(`hold of ${baseHold}`));
});

void test('ship parts load more; base modules score; each family counts on its own', () => {
  // Every upgrade belongs to exactly one family, and scorers sit in the base.
  for (const p of plans) {
    const scores = p.effects.some((e) =>
      [
        'points',
        'race',
        'per',
        'perHold',
        'perLevel',
        'thrift',
        'sets',
      ].includes(e.type),
    );
    if (scores) {
      assert.equal(p.family, 'base', p.id);
      assert.equal(
        p.season,
        3,
        `${p.id} scores only after the shipbuilding years`,
      );
    }
    if (['hold', 'yield', 'alone', 'share'].includes(p.effects[0].type))
      assert.equal(p.family, 'ship', p.id);
  }
  const g = createAlto(2, 9, 'medium', { length: 'short', plans: 'random' });
  const me = g.players[0];
  me.built = ['rigging', 'sawmill', 'shrine', 'post'];
  // Refinery: per ship level. Archive: per base module. Hangar: per hold.
  me.built.push('guildhall', 'skytower', 'archive');
  const per = (id) => planById[id].effects[0].points;
  assert.equal(planScore(me, 'guildhall'), per('guildhall') * 2);
  assert.equal(planScore(me, 'skytower'), per('skytower') * 5);
  assert.equal(planScore(me, 'archive'), per('archive') * hold(me));
  me.levels = {
    rigging: 3,
    sawmill: 2,
    shrine: 1,
    post: 1,
    guildhall: 1,
    skytower: 1,
    archive: 1,
  };
  assert.equal(
    planScore(me, 'guildhall'),
    per('guildhall') * 5,
    'two fitted parts with five levels reward deeper refits',
  );
  assert.equal(
    planScore(me, 'skytower'),
    per('skytower') * 5,
    'a refit is not another base module',
  );
  assert.equal(
    planScore(me, 'archive'),
    per('archive') * (baseHold + 3),
    'Hangar sees the replacement hold effect',
  );
  assert.equal(
    breakdown(g, 0).bonus,
    planScore(me, 'guildhall') +
      planScore(me, 'skytower') +
      planScore(me, 'archive'),
    'each scoring module counts once',
  );
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

void test('legacy saves keep their original prices, scoring, year-only catalogue and duration', () => {
  for (const [length, count] of [
    ['short', 12],
    ['standard', 18],
  ]) {
    let g = legacyGame(length);
    assert.ok(isAltoSave(g));
    assert.equal(totalTurns(g), count);
    assert.equal(planFor(g, 'shrine').season, 1);
    assert.deepEqual(planFor(g, 'shrine').cost, [1, 1, 1, 1]);
    assert.equal(maxPlanLevel(g, 'rigging'), 1);
    g.players[0].stock = [1, 2, 2, 0];
    assert.deepEqual(buildable(g, 0, 'shrine'), [1, 2, 2, 0]);
    g = turn(g, [[1, 'shrine'], 0]);
    assert.equal(planScore(g.players[0], 'shrine'), 12);
    assert.equal(breakdown(g, 0).plans, 12);
    assert.deepEqual(g.players[0].stock, [0, 2, 0, 0]);
    assert.equal(buildable(g, 0, 'shrine'), null);
    while (g.season === 1) g = turn(g, [0, 1]);
    assert.ok(
      !currentPlans(g).includes('rigging'),
      'old catalogue still rotates each year',
    );
    assert.ok(isAltoSave(JSON.parse(JSON.stringify(g))));
    g = playOut(g);
    assert.equal(g.history.length, count);
    assert.ok(isAltoSave(g));
  }
});

void test('saves reject corrupt refit ownership, editions, routes and repeated catalogue entries', () => {
  const good = createAlto(2, 4);
  good.players[0].built = ['rigging'];
  good.players[0].levels = { rigging: 1 };
  assert.ok(isAltoSave(good));
  const corruptions = [
    ['duplicate fitted part', (g) => g.players[0].built.push('rigging')],
    ['unknown fitted part', (g) => g.players[0].built.push('missing')],
    ['level zero', (g) => (g.players[0].levels.rigging = 0)],
    ['fractional level', (g) => (g.players[0].levels.rigging = 1.5)],
    ['level above maximum', (g) => (g.players[0].levels.rigging = 4)],
    ['future refit', (g) => (g.players[0].levels.rigging = 2)],
    ['unowned level', (g) => (g.players[0].levels.sawmill = 1)],
    ['unknown level', (g) => (g.players[0].levels.missing = 1)],
    ['wrong edition', (g) => (g.players[0].edition = 2)],
    ['missing edition', (g) => delete g.players[0].edition],
    ['invalid prior resource', (g) => (g.players[0].lastGood = 4)],
    ['fractional prior resource', (g) => (g.players[0].lastGood = 0.5)],
    ['duplicate catalogue entry', (g) => g.plans[0].push(g.plans[0][0])],
  ];
  for (const [reason, corrupt] of corruptions) {
    const g = structuredClone(good);
    corrupt(g);
    assert.equal(isAltoSave(g), false, reason);
  }
  const base = createAlto(2, 4);
  base.season = 3;
  base.players[0].built = ['shrine'];
  base.players[0].levels = { shrine: 2 };
  assert.equal(isAltoSave(base), false, 'base modules cannot refit');
});

void test('specialist refits produce secondary cargo on their own planet, including shared landings', () => {
  for (const id of ['sawmill', 'mason', 'fold', 'glassworks']) {
    const g = createAlto(3, 9);
    g.season = 2;
    g.players[0].built = [id];
    g.players[0].levels = { [id]: 2 };
    g.players[0].stock = [0, 0, 0, 0];
    const specialist = ownedPlan(g.players[0], id);
    const extra = specialist.effects.find((e) => e.type === 'byproduct');
    assert.ok(extra, `${id} has a secondary output at tier two`);
    assert.notEqual(extra.good, extra.cargo);
    const own = g.islands.findIndex((island) => island.good === extra.good);
    const other = g.islands.findIndex(
      (island) => island.good !== extra.good && island.good !== extra.cargo,
    );
    const spare = g.islands.findIndex((island, i) => i !== own && i !== other);
    for (const crowded of [false, true]) {
      const before = structuredClone(g);
      before.islands[own].pile = crowded ? 0 : 6;
      const after = turn(before, [own, crowded ? own : other, spare]);
      assert.equal(
        after.last.cargo[0][extra.cargo],
        extra.amount,
        `${id}: secondary cargo is independent of the shared pile`,
      );
      assert.equal(after.players[0].stock[extra.cargo], extra.amount);
      assert.equal(after.last.takes[0], crowded ? 0 : baseHold);
      assert.deepEqual(after.players[0].stock, after.last.cargo[0]);
      assert.equal(after.players[0].lastGood, extra.good);
    }
    const away = turn(structuredClone(g), [other, own, spare]);
    assert.equal(
      away.last.cargo[0][extra.cargo],
      0,
      `${id}: another planet does not trigger the secondary output`,
    );
    const finalTier = structuredClone(g);
    finalTier.season = 3;
    finalTier.players[0].levels[id] = 3;
    finalTier.islands[own].pile = 6;
    const final = turn(finalTier, [own, other, spare]);
    const finalEffects = planAtLevel(g, id, 3).effects;
    const native = finalEffects.find(
      (effect) => effect.type === 'yield',
    ).amount;
    const secondary = finalEffects.find(
      (effect) => effect.type === 'byproduct',
    ).amount;
    assert.equal(
      final.last.cargo[0][extra.good],
      baseHold + native,
      'tier three replaces the native output instead of stacking tiers',
    );
    assert.equal(
      final.last.cargo[0][extra.cargo],
      secondary,
      'secondary output counts once',
    );
  }
});

void test('route upgrades reward a different cargo, not merely a different planet, even in a crowd', () => {
  const g = createAlto(4, 19);
  g.season = 3;
  const allTiers = plans.flatMap((p) =>
    [1, 2, 3].map((level) => ({ plan: planAtLevel(g, p.id, level), level })),
  );
  const route = allTiers.find(({ plan }) =>
    plan?.effects.some((e) => e.type === 'route'),
  );
  assert.ok(route, 'a routing specialization exists');
  const bonus = route.plan.effects.find((e) => e.type === 'route').amount;
  g.players[0].built = [route.plan.id];
  g.players[0].levels = { [route.plan.id]: route.level };
  for (const crowded of [false, true]) {
    const picks = [0, crowded ? 0 : 1, 2, 3];
    const first = turn(structuredClone(g), picks);
    const same = structuredClone(g);
    same.players[0].lastGood = 0;
    const repeated = turn(same, picks);
    const different = structuredClone(g);
    different.players[0].lastGood = 1;
    const changed = turn(different, picks);
    assert.equal(
      repeated.last.bonus[0],
      first.last.bonus[0],
      'the first trip and repeated cargo earn no routing bonus',
    );
    assert.equal(changed.last.bonus[0], repeated.last.bonus[0] + bonus);
    assert.equal(changed.last.cargo[0][0], repeated.last.cargo[0][0] + bonus);
    assert.equal(changed.players[0].lastGood, 0);
  }
  const visited = turn(structuredClone(g), [0, 1, 2, 3]);
  const sameCargoElsewhere = turn(visited, [4, 1, 2, 3]);
  const sameCargoHere = turn(structuredClone(visited), [0, 1, 2, 3]);
  assert.equal(g.islands[0].good, g.islands[4].good);
  assert.equal(
    sameCargoElsewhere.last.bonus[0],
    sameCargoHere.last.bonus[0],
    'moving between two food planets is not a new cargo route',
  );
});

void test('the Trader discount resets by year and a refit uses that year’s single discount', () => {
  let g = createAlto(2, 32);
  g.players[0].captain = 'trader';
  g.players[0].stock = [20, 20, 20, 20];
  assert.equal(discount(g, g.players[0], 'ship'), 1);
  g = turn(g, [[0, 'rigging'], 1]);
  assert.equal(discount(g, g.players[0], 'ship'), 0);
  while (g.season === 1) g = turn(g, [0, 1]);
  assert.equal(discount(g, g.players[0], 'ship'), 1);
  const price = nextPlan(g, g.players[0], 'rigging').cost;
  const discountedPrice = payment(price, g.players[0].stock, 1);
  assert.deepEqual(buildable(g, 0, 'rigging'), discountedPrice);
  g = turn(g, [[0, 'rigging'], 1]);
  assert.equal(planLevel(g.players[0], 'rigging'), 2);
  assert.deepEqual(g.last.paid[0], discountedPrice);
  assert.equal(
    discount(g, g.players[0], 'ship'),
    0,
    'an existing part refit consumes the discount',
  );
});
