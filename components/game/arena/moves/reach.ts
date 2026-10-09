import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { MoveContext, PartName } from './types';

/**
 * Arms posed by where the hand goes rather than by joint angles (8 October
 * 2026). A pose names the wrist's place relative to the shoulder, where the
 * elbow points and which way the palm faces; `reach` solves the shoulder,
 * elbow hinge and wrist from the figure's own rest bones (`c.rest`) and asks
 * for them with `c.want`. Hand-tuned Euler angles on a bind pose whose arms
 * hang out made the Sumo's arms stiff and robotic; this keeps the elbow a
 * hinge, the hand on its path and the palm where it should face.
 *
 * Everything is given for the LEFT arm, in the arm's parent's axes (three.js:
 * x to the figure's right, so the left side is -x; y up; z backwards, so
 * forward is -z), in the figure's own units; the right arm is mirrored.
 * Figures whose arm bones carry an identity rest rotation (the connected
 * skins with common-axis bones) are what this is for.
 */
export type ArmGoal = {
  /** The wrist, from the shoulder joint. */
  hand: readonly [number, number, number];
  /** Where the elbow points, from the shoulder (default down, out, back). */
  pole?: readonly [number, number, number];
  /** The way the palm faces (default in towards the body). */
  palm?: readonly [number, number, number];
  /** The way the fingers point (default on along the forearm). */
  fingers?: readonly [number, number, number];
  /** How much of the hand's roll about the forearm the forearm itself
   *  takes (pronation turns the whole radius; a forearm turning about its
   *  own axis barely changes its outline, while the same turn at the wrist
   *  wrings it). Default 0.7. */
  forearmRoll?: number;
};

/** How the figure's own hand sits at rest: the palm's facing and the
 *  fingers' direction (left hand). */
export type HandRest = {
  palm: readonly [number, number, number];
  fingers?: readonly [number, number, number];
};

const DOWN_OUT_BACK = [-0.5, -1, 0.35] as const;
const PALM_IN = [1, 0, 0] as const;

const u0 = new Vector3();
const f0 = new Vector3();
const f0b = new Vector3();
const w = new Vector3();
const n = new Vector3();
const e = new Vector3();
const uu = new Vector3();
const ff = new Vector3();
const p = new Vector3();
const d = new Vector3();
const p0 = new Vector3();
const d0 = new Vector3();
const qa = new Quaternion();
const qe = new Quaternion();
const qh = new Quaternion();
const qi = new Quaternion();
const ma = new Matrix4();
const mb = new Matrix4();
const ex = new Euler();
const tmp = new Vector3();
const tmp2 = new Vector3();
const tmp3 = new Vector3();
const X = new Vector3(1, 0, 0);
const qt = new Quaternion();
const qf = new Quaternion();
const axis = new Vector3();

const set = (v: Vector3, a: readonly number[], mirror: number) =>
  v.set(a[0] * mirror, a[1], a[2]);

/** The rotation taking the pair (a1, a2) onto (b1, b2): a1 exactly onto
 *  b1, and the plane of a1 and a2 onto the plane of b1 and b2. */
function align(
  a1: Vector3,
  a2: Vector3,
  b1: Vector3,
  b2: Vector3,
  out: Quaternion,
) {
  const frame = (v1: Vector3, v2: Vector3, m: Matrix4) => {
    tmp.copy(v1).normalize();
    tmp2.copy(v2).addScaledVector(tmp, -v2.dot(tmp));
    if (tmp2.lengthSq() < 1e-10) tmp2.set(0, 0, 1).cross(tmp);
    tmp2.normalize();
    tmp3.crossVectors(tmp, tmp2);
    m.makeBasis(tmp, tmp2, tmp3);
  };
  frame(a1, a2, ma);
  frame(b1, b2, mb);
  return out.setFromRotationMatrix(mb.multiply(ma.transpose()));
}

const TAU = Math.PI * 2;
const near = (angle: number, to: number) =>
  angle + Math.round((to - angle) / TAU) * TAU;
/**
 * The runtime springs each joint's Euler angles on their own, so a goal
 * must move continuously: of a rotation's two XYZ Euler forms (x, y, z) and
 * (x+π, π-y, z+π), each unwrapped by whole turns, ask for the one nearest
 * last frame's, kept in the troop's memo. Otherwise a wrist crossing a
 * branch would spin the long way round between frames.
 */
const want = (c: MoveContext, part: PartName, q: Quaternion) => {
  ex.setFromQuaternion(q, 'XYZ');
  const key = `reach.${part}`;
  // The first frame starts from the rest pose.
  const px = c.memo[`${key}.x`] ?? 0;
  const py = c.memo[`${key}.y`] ?? 0;
  const pz = c.memo[`${key}.z`] ?? 0;
  let [x, y, z] = [ex.x, ex.y, ex.z];
  {
    const a = [near(x, px), near(y, py), near(z, pz)];
    const b = [
      near(x + Math.PI, px),
      near(Math.PI - y, py),
      near(z + Math.PI, pz),
    ];
    const da = Math.hypot(a[0] - px, a[1] - py, a[2] - pz);
    const db = Math.hypot(b[0] - px, b[1] - py, b[2] - pz);
    [x, y, z] = da <= db ? a : b;
  }
  c.memo[`${key}.x`] = x;
  c.memo[`${key}.y`] = y;
  c.memo[`${key}.z`] = z;
  c.want(part, x, y, z);
};

/**
 * Put one arm's hand where `goal` says. Returns false (and asks nothing)
 * when the figure lacks the arm, forearm or hand joints.
 */
export function reach(
  c: MoveContext,
  side: 'L' | 'R',
  goal: ArmGoal,
  rest: HandRest = { palm: [0, 0, -1] },
) {
  const elbow = c.rest?.(`fore${side}`);
  const wrist = c.rest?.(`hand${side}`);
  if (!elbow || !wrist) return false;
  const mirror = side === 'L' ? 1 : -1;
  // Rest directions are the figure's own: no mirroring.
  u0.set(elbow[0], elbow[1], elbow[2]);
  f0.set(wrist[0], wrist[1], wrist[2]);
  const a = u0.length();
  const b = f0.length();
  u0.normalize();
  f0.normalize();

  // The elbow: on the circle that puts the wrist on target, turned towards
  // the pole.
  set(w, goal.hand, mirror);
  const reachLen = Math.max(
    Math.abs(a - b) + 1e-4,
    Math.min((a + b) * 0.998, w.length()),
  );
  w.setLength(reachLen);
  set(n, goal.pole ?? DOWN_OUT_BACK, mirror);
  tmp.copy(w).normalize();
  n.addScaledVector(tmp, -n.dot(tmp));
  if (n.lengthSq() < 1e-8) n.set(0, -1, 0);
  n.normalize();
  const cosA = (a * a + reachLen * reachLen - b * b) / (2 * a * reachLen);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  e.copy(tmp).multiplyScalar(cosA * a).addScaledVector(n, sinA * a);
  uu.copy(e).normalize();
  ff.copy(w).sub(e).normalize();

  // The elbow is a hinge about the arm's own x: find its bend so the angle
  // between upper arm and forearm matches (u0·Rx(β)f0 = uu·ff).
  const target = uu.dot(ff);
  const A = u0.x * f0.x;
  const B = u0.y * f0.y + u0.z * f0.z;
  const C = u0.z * f0.y - u0.y * f0.z;
  const R = Math.hypot(B, C);
  const phi = Math.atan2(C, B);
  const k = Math.max(-1, Math.min(1, (target - A) / Math.max(1e-6, R)));
  const roots = [phi + Math.acos(k), phi - Math.acos(k)].map((r) =>
    Math.atan2(Math.sin(r), Math.cos(r)),
  );
  // Prefer the forward flexion nearest a natural range.
  const beta = roots.reduce((best, r) =>
    Math.abs(r - 0.8) < Math.abs(best - 0.8) ? r : best,
  );
  qe.setFromAxisAngle(X, beta);
  f0b.copy(f0).applyQuaternion(qe);

  // The upper arm: its rest pair (u0, bent forearm) onto (uu, ff).
  align(u0, f0b, uu, ff, qa);

  // The hand: palm and fingers, in the forearm's frame.
  set(p, goal.palm ?? PALM_IN, mirror);
  if (goal.fingers) set(d, goal.fingers, mirror);
  else d.copy(ff);
  qi.copy(qa).multiply(qe).invert();
  p.applyQuaternion(qi);
  d.applyQuaternion(qi);
  set(p0, rest.palm, side === 'L' ? 1 : -1);
  if (rest.fingers) set(d0, rest.fingers, side === 'L' ? 1 : -1);
  else d0.copy(f0);
  align(d0, p0, d, p, qh);

  // Split the hand's roll about the forearm (its twist about f0, the
  // forearm's own axis in its frame) between forearm and wrist.
  axis.set(qh.x, qh.y, qh.z);
  const along = axis.dot(f0);
  qt.set(f0.x * along, f0.y * along, f0.z * along, qh.w);
  if (qt.lengthSq() < 1e-10) qt.identity();
  else qt.normalize();
  let roll = 2 * Math.atan2(along, qh.w);
  roll = Math.atan2(Math.sin(roll), Math.cos(roll));
  qt.setFromAxisAngle(f0, roll * (goal.forearmRoll ?? 0.7));
  qf.copy(qe).multiply(qt);
  qh.premultiply(qt.invert());

  want(c, `arm${side}`, qa);
  want(c, `fore${side}`, qf);
  want(c, `hand${side}`, qh);
  return true;
}

/** Linear blend of two goals' vectors (for easing between poses). */
export function blend(a: ArmGoal, b: ArmGoal, t: number): ArmGoal {
  const lerp = (
    x: readonly [number, number, number] | undefined,
    y: readonly [number, number, number] | undefined,
    fallback: readonly [number, number, number],
  ) => {
    const u = x ?? fallback;
    const v = y ?? fallback;
    return [
      u[0] + (v[0] - u[0]) * t,
      u[1] + (v[1] - u[1]) * t,
      u[2] + (v[2] - u[2]) * t,
    ] as const;
  };
  return {
    hand: lerp(a.hand, b.hand, [0, -0.5, 0]),
    pole: lerp(a.pole, b.pole, DOWN_OUT_BACK),
    palm: lerp(a.palm, b.palm, PALM_IN),
    fingers:
      a.fingers || b.fingers
        ? lerp(a.fingers, b.fingers, a.fingers ?? b.fingers!)
        : undefined,
  };
}
