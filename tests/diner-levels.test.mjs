import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createConfiguredMatch,
  isDinerConfig,
  isMatch,
  open,
  step,
} from '../lib/games/diner/engine.ts';
import { playShift } from '../lib/games/diner/bot.ts';
import {
  CHAPTERS,
  KIT,
  LEVEL_COUNT,
  LEVELS,
  levelConfig,
  levelPassed,
  LEVELS_PER_CHAPTER,
} from '../lib/games/diner/levels.ts';
import {
  makeRoad,
  LEG_SHAPE,
  choicesFrom,
  nodeById,
} from '../lib/games/diner/road.ts';
import {
  columnIndex,
  junction,
  LOT_R,
  lotAt,
  roadPieces,
  roamBand,
  START,
  stopPoint,
} from '../components/game/diner/overworld-layout.ts';

await test('forty levels in eight chapters, every one a valid shift', () => {
  assert.equal(LEVEL_COUNT, 40);
  assert.equal(CHAPTERS.length * LEVELS_PER_CHAPTER, LEVEL_COUNT);
  for (const l of LEVELS) {
    const c = levelConfig(l.id);
    assert.ok(isDinerConfig(c), `level ${l.id} rules`);
    assert.ok(
      l.targets[0] < l.targets[1] && l.targets[1] < l.targets[2],
      `level ${l.id} medals climb`,
    );
    assert.ok(l.tables.length >= 2 && l.tables.length <= 6);
    const m = createConfiguredMatch(l.id * 17, c);
    assert.ok(isMatch(m), `level ${l.id} match`);
    assert.equal(m.stars, l.lives);
  }
  // Every chapter ends on a boss.
  for (let c = 0; c < CHAPTERS.length; c++)
    assert.ok(LEVELS[c * LEVELS_PER_CHAPTER + 4].boss);
});

await test('levels get harder: faster guests, less patience, more trouble', () => {
  const first = LEVELS[0];
  const last = LEVELS.at(-1);
  // Guests a minute: arrivals times the average party.
  const flow = (l) => {
    const total = l.sizes.reduce((a, b) => a + b, 0);
    const party = l.sizes.reduce((a, w, i) => a + w * (i + 1), 0) / total;
    return (60 / ((l.interval[0] + l.interval[1]) / 2)) * party;
  };
  assert.ok(flow(last) > flow(first) * 1.5, 'many more guests a minute');
  assert.ok(last.patience.order < first.patience.order, 'patience shrinks');
  assert.ok(last.troubles.length >= 5);
  assert.ok(last.lives < first.lives);
  assert.ok(last.tables.length > first.tables.length);
  const chapterFlow = (ch) => {
    const ls = LEVELS.filter((l) => l.chapter === ch);
    return ls.reduce((a, l) => a + flow(l), 0) / ls.length;
  };
  assert.ok(chapterFlow(7) > chapterFlow(0) * 1.4);
});

await test('each piece of kit arrives once, says so, and stays', () => {
  for (const kit of KIT) {
    const firsts = LEVELS.filter((l) =>
      l.novelties.some((n) => n.kind === 'kit' && n.kit === kit),
    );
    assert.equal(firsts.length, 1, `${kit} is introduced once`);
    for (const l of LEVELS.filter((x) => x.id >= firsts[0].id))
      assert.ok(l.kit.includes(kit), `${kit} stays on level ${l.id}`);
  }
  assert.ok(LEVELS[0].novelties.some((n) => n.kind === 'basics'));
  // Each dish and each trouble is announced the first time it shows up.
  for (const l of LEVELS)
    for (const t of l.troubles) {
      const before = LEVELS.filter(
        (x) => x.id < l.id && x.troubles.includes(t),
      );
      if (!before.length)
        assert.ok(
          l.novelties.some((n) => n.kind === 'trouble' && n.trouble === t),
          `${t} new on ${l.id}`,
        );
    }
});

await test('a level is passed with a medal and a life left', () => {
  const m = createConfiguredMatch(9, levelConfig(1));
  open(m);
  playShift(m, true, 12);
  assert.equal(m.phase, 'over');
  assert.equal(levelPassed(m), m.stars > 0 && m.medals > 0);
  const lost = structuredClone(m);
  lost.stars = 0;
  assert.equal(levelPassed(lost), false);
});

await test('three waiters open one more booth on a level', () => {
  const solo = createConfiguredMatch(3, levelConfig(5));
  const crew = createConfiguredMatch(3, levelConfig(5), ['A', 'B', 'C']);
  assert.equal(crew.tables.length, Math.min(6, solo.tables.length + 1));
  assert.ok(isMatch(crew));
  for (let i = 0; i < 60; i++) step(crew, []);
});

await test('every fork is a choice between two different places', () => {
  for (const seed of [1, 7, 42, 99, 1234]) {
    const map = makeRoad(seed);
    for (const leg of map.legs)
      LEG_SHAPE.forEach((count, col) => {
        const nodes = leg.nodes.filter((n) => n.col === col);
        assert.equal(nodes.length, count);
        if (count === 2) {
          assert.notEqual(
            nodes[0].place,
            nodes[1].place,
            `seed ${seed} leg ${leg.index} col ${col}`,
          );
          const shifts = nodes.filter((n) => n.kind === 'shift');
          if (shifts.length === 2)
            assert.notEqual(shifts[0].reward, shifts[1].reward, 'a real trade');
        }
        // Either stop leads on to every stop of the next fork.
        if (col < LEG_SHAPE.length - 1)
          for (const n of nodes)
            assert.equal(n.next.length, LEG_SHAPE[col + 1]);
      });
    assert.equal(choicesFrom(map, null).length, 2);
  }
});

await test('the road map: lots apart, roads joined, and the truck kept to the fork', () => {
  const map = makeRoad(7);
  const nodes = map.legs.flatMap((l) => l.nodes);
  for (const a of nodes)
    for (const b of nodes)
      if (a !== b) {
        const p = stopPoint(a),
          q = stopPoint(b);
        assert.ok(
          Math.hypot(p.x - q.x, p.z - q.z) > LOT_R * 2.5,
          'lots never overlap',
        );
      }
  const pieces = roadPieces(map);
  for (const n of nodes) {
    const p = stopPoint(n);
    const ends = pieces
      .filter((r) => r.stop === n.id)
      .flatMap((r) => [r.points[0], r.points.at(-1)]);
    assert.ok(
      ends.some((e) => Math.hypot(e.x - p.x, e.z - p.z) < 1e-6),
      `road reaches ${n.id}`,
    );
    const g = columnIndex(n);
    const band = roamBand(g);
    assert.ok(
      p.z < band.south && p.z > band.north && Math.abs(p.x) < band.east,
      `${n.id} reachable while choosing`,
    );
    assert.equal(lotAt([n], p)?.id, n.id);
  }
  assert.ok(START.z > junction(0).z);
  assert.equal(nodeById(map, '0-0-0') ? true : false, true);
});
