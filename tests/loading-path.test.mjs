import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blendPaths,
  pathAt,
  planPath,
  reach,
} from '../components/game/loading-path.ts';

/** The path sampled every frame at 60 fps. */
const frames = (path) => {
  const end = path[path.length - 1].t;
  const out = [];
  for (let t = 0; t <= end + 1e-9; t += 1 / 60) out.push(pathAt(path, t).x);
  return out;
};
const steps = (xs) => xs.slice(1).map((x, i) => x - xs[i]);

await test('a burst of progress is chased at a steady pace, never jumped', () => {
  // A large file lands at once: the real value leaps from 0 to 0.86.
  const xs = frames(planPath(0, 0, { value: 0.86, ceiling: 0.86 }));
  const d = steps(xs);
  assert.ok(Math.min(...d) >= 0, 'never goes back');
  assert.ok(
    Math.max(...d) < 0.012,
    `at most 1.2% a frame, got ${Math.max(...d)}`,
  );
  assert.ok(xs[0] === 0 && xs[1] < 0.002, 'eases out of rest');
  assert.ok(
    xs[Math.round(60 * 2.5)] > 0.75,
    'yet keeps up within a few seconds',
  );
});

await test('while a step is pending the bar creeps, slower and slower, below the stage end', () => {
  const path = planPath(0.5, 0, { value: 0.5, ceiling: 0.7 });
  const at = (s) => pathAt(path, s).x;
  assert.ok(at(1) > 0.5, 'moves at once');
  assert.ok(
    at(10) > at(5) && at(20) > at(10) && at(60) > at(20),
    'never sits still',
  );
  assert.ok(at(5) - at(0) > at(10) - at(5), 'slows as it goes');
  assert.ok(at(90) < 0.7, 'never reaches the end of the stage');
});

await test('there is always a little room to creep, even at a stage end', () => {
  assert.ok(reach(0.86, { value: 0.86, ceiling: 0.86 }) > 0.86);
  assert.equal(reach(0.4, { value: 0.2, done: true }), 1);
  // Short of done it stops just shy of full, and never behind the bar.
  assert.equal(reach(0.5, { value: 1 }), 0.995);
  assert.equal(reach(0.998, { value: 1 }), 0.998);
});

await test('done eases into exactly 100% within a moment, from any pace', () => {
  for (const [x, v] of [
    [0.2, 0],
    [0.6, 0.5],
    [0.93, 0.01],
  ]) {
    const path = planPath(x, v, { value: 0.9, done: true });
    const last = path[path.length - 1];
    assert.equal(last.x, 1);
    assert.ok(last.t < 1.2, `finishes in ${last.t.toFixed(2)} s from ${x}`);
    const d = steps(frames(path));
    assert.ok(Math.min(...d) >= 0);
    assert.ok(Math.max(...d) < 0.03, `smooth finish, max ${Math.max(...d)}`);
  }
});

await test('replanning mid-way keeps the position and pace', () => {
  const first = planPath(0, 0, { value: 0.3, ceiling: 0.86 });
  const mid = pathAt(first, 0.4);
  const second = planPath(mid.x, mid.v, { value: 0.8, ceiling: 0.86 });
  assert.equal(second[0].x, mid.x);
  const a = pathAt(first, 0.4 - 1 / 60).x;
  const b = pathAt(second, 1 / 60).x;
  // The step either side of the join is about the same size.
  const before = mid.x - a;
  const after = b - mid.x;
  assert.ok(after >= 0 && Math.abs(after - before) < 0.004);
});

await test('the path never runs backwards, even when a report is lower', () => {
  const path = planPath(0.6, 0.2, { value: 0.1, ceiling: 0.3 });
  const d = steps(frames(path));
  assert.ok(Math.min(...d) >= 0);
});

await test('a new path takes over gently, so a stall before it shows barely moves the bar', () => {
  // On screen: creeping near the end of the downloads.
  const old = planPath(0.08, 0.02, { value: 0.08, ceiling: 0.2 });
  const from = 1.2;
  const here = pathAt(old, from);
  // A burst of progress arrives; the page then stalls for 130 ms before
  // the new path reaches the screen, which kept to the old one meanwhile.
  const goal = { value: 0.4, ceiling: 0.9 };
  const next = planPath(here.x, here.v, goal);
  const path = blendPaths(old, from, goal);
  assert.equal(path[0].x, here.x);
  const stall = 0.13;
  const gap = Math.abs(pathAt(path, stall).x - pathAt(old, from + stall).x);
  assert.ok(gap < 0.004, `meets the old path after a stall, off by ${gap}`);
  const free = Math.abs(pathAt(next, stall).x - pathAt(old, from + stall).x);
  assert.ok(gap < free / 3, 'much closer than switching at once');
  const d = steps(frames(path));
  assert.ok(Math.min(...d) >= 0, 'never goes back');
  assert.ok(Math.max(...d) < 0.012, 'no jump');
  // Soon after, it is about where the new path would be.
  assert.ok(Math.abs(pathAt(path, 3).x - pathAt(next, 3).x) < 0.05);
});

await test('a blended finish still ends at exactly 100%', () => {
  const old = planPath(0.9, 0.01, { value: 0.92, ceiling: 0.99 });
  const path = blendPaths(old, 0.5, { value: 1, done: true });
  assert.equal(path[path.length - 1].x, 1);
  assert.ok(path[path.length - 1].t < 1.2);
  assert.ok(Math.min(...steps(frames(path))) >= 0);
});

await test('held long enough, a new path absorbs a long stall without a trace', () => {
  const old = planPath(0.84, 0.04, { value: 0.85, ceiling: 0.86 });
  const goal = { value: 0.94, ceiling: 0.99 };
  const path = blendPaths(old, 0.5, goal, 0.9);
  // The page stalls 770 ms before the new path reaches the screen.
  const gap = Math.abs(pathAt(path, 0.77).x - pathAt(old, 0.5 + 0.77).x);
  assert.ok(gap < 1e-6, `off by ${gap}`);
  const d = steps(frames(path));
  assert.ok(Math.min(...d) >= 0);
  assert.ok(Math.max(...d) < 0.012);
  assert.ok(pathAt(path, 4).x > 0.9, 'then goes on toward the new goal');
});
