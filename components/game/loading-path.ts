/**
 * The path a loading bar takes: never the raw progress, which arrives in
 * bursts (a large file lands at once, a 3D scene builds in one long step),
 * but a calm chase of it. The bar moves forward only, with limited speed
 * and acceleration; while a long step is pending it creeps toward the end
 * of that stage, slower and slower, so it never sits still; and once the
 * game is ready it eases into 100%. `planPath` works the whole path out
 * ahead from where the bar is now, so it can run as one compositor
 * animation (`loading-bar.ts`) that keeps moving while the page is busy.
 */

/** Chase gain toward the reported value, per second. */
const CHASE = 3;
/** Fastest pace while loading, in bar widths per second. */
const PACE = 0.55;
/** Creep gain toward the end of the stage while nothing new arrives. */
const CREEP = 0.12;
/** Room the bar may always creep into past the reported value. */
const HEADROOM = 0.03;
/** The finish: gain, fastest and slowest pace into 100%. */
const FINISH = 6;
const FINISH_PACE = 1.6;
const FINISH_MIN = 0.35;
/** Acceleration and braking, in bar widths per second squared. */
const ACCEL = 2.5;
const BRAKE = 5;
/** How far ahead a pending path is worked out, in seconds. */
const HORIZON = 90;
const STEP = 1 / 120;

export type PathPoint = {
  /** Seconds from the start of the path. */
  t: number;
  /** The bar's fill, 0 to 1. */
  x: number;
  /** Its pace, in bar widths per second. */
  v: number;
};

export type PathGoal = {
  /** The real progress, 0 to 1. */
  value: number;
  /** The end of the current stage: the furthest the bar creeps on its own. */
  ceiling?: number;
  /** Everything is ready: ease into 100%. */
  done?: boolean;
};

/** The furthest the bar may go for a goal, starting from `x`. */
export function reach(x: number, goal: PathGoal) {
  if (goal.done) return 1;
  const value = Math.min(1, Math.max(x, goal.value));
  const ceiling = Math.max(goal.ceiling ?? 0, value + HEADROOM);
  return Math.max(x, Math.min(0.995, ceiling));
}

/**
 * The bar's path from fill `x` at pace `v` toward `goal`, sampled densely
 * where it changes fast and sparsely as it settles. It ends at exactly 1
 * when the goal is done, and otherwise runs a long way ahead, creeping.
 */
export function planPath(x: number, v: number, goal: PathGoal): PathPoint[] {
  x = Math.min(1, Math.max(0, x));
  v = Math.max(0, v);
  const done = !!goal.done;
  const target = Math.min(1, Math.max(x, goal.value));
  const cap = reach(x, goal);
  const out: PathPoint[] = [{ t: 0, x, v }];
  if (x >= 1) return out;
  let t = 0;
  let next = 1 / 30;
  while (t < HORIZON) {
    let want: number;
    if (done)
      want = Math.min(FINISH_PACE, Math.max(FINISH_MIN, (1 - x) * FINISH));
    else {
      const chase = x < target ? Math.min(PACE, (target - x) * CHASE) : 0;
      want = Math.max(chase, (cap - x) * CREEP);
    }
    const dv = want - v;
    v = Math.max(0, v + Math.max(-BRAKE * STEP, Math.min(ACCEL * STEP, dv)));
    x += v * STEP;
    t += STEP;
    if (done && x >= 1) {
      out.push({ t, x: 1, v: 0 });
      return out;
    }
    if (x > cap) {
      x = cap;
      v = 0;
    }
    if (t >= next) {
      out.push({ t, x, v });
      // Fine while it moves quickly, coarser once it only creeps.
      next += t < 3 ? 1 / 30 : t < 12 ? 1 / 4 : 1 / 2;
    }
  }
  return out;
}

/** Where a path is `t` seconds in. */
export function pathAt(path: PathPoint[], t: number): PathPoint {
  if (t <= 0 || path.length === 1) return path[0];
  const last = path[path.length - 1];
  if (t >= last.t) return last;
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = path[lo];
  const b = path[hi];
  const k = (t - a.t) / (b.t - a.t || 1);
  return { t, x: a.x + (b.x - a.x) * k, v: a.v + (b.v - a.v) * k };
}

/** How long a new path takes to take over from the one on screen (s). */
const BLEND = 0.5;

/**
 * The bar's path toward a new goal, taking over gently from the path on
 * screen (`old`, `from` seconds in). The bar can only change paths at the
 * next frame the page gets to draw, sometimes after a long stall during
 * which the old path played on. So the new path first keeps exactly to
 * the old one for `hold` seconds (the longest stall it absorbs without a
 * trace), then its pace eases from the old path's to a fresh plan's, and
 * it plans on from wherever that leaves it.
 */
export function blendPaths(
  old: PathPoint[],
  from: number,
  goal: PathGoal,
  hold = 0,
): PathPoint[] {
  const out: PathPoint[] = [];
  let t = 0;
  let next = 0;
  // Keep to the old path.
  for (; t < hold - 1e-9; t += 1 / 30) {
    const p = pathAt(old, from + t);
    out.push({ t, x: p.x, v: p.v });
  }
  t = hold;
  const at = pathAt(old, from + hold);
  out.push({ t, x: at.x, v: at.v });
  // Then ease from its pace onto a fresh plan's.
  const fresh = planPath(at.x, at.v, goal);
  const cap = reach(at.x, goal);
  let x = at.x;
  let v = at.v;
  let u = 0;
  next = 1 / 60;
  while (u < BLEND - 1e-9) {
    u += STEP;
    const s = Math.min(1, u / BLEND);
    const w = s * s * (3 - 2 * s);
    v = Math.max(
      0,
      (1 - w) * pathAt(old, from + hold + u).v + w * pathAt(fresh, u).v,
    );
    x = Math.min(cap, x + v * STEP);
    if (goal.done && x >= 1) {
      out.push({ t: hold + u, x: 1, v: 0 });
      return out;
    }
    if (u >= next - 1e-9) {
      out.push({ t: hold + u, x, v });
      next += 1 / 60;
    }
  }
  for (const p of planPath(x, v, goal).slice(1))
    out.push({ t: hold + u + p.t, x: p.x, v: p.v });
  return out;
}
