import * as THREE from 'three';
import type { MoveContext, Moves, PartName, Pose } from './types';

/**
 * The Cowboy: a cocky frontier gunslinger. He swaggers with the rifle
 * resting on his right shoulder and his free arm swinging loose, the duster's
 * tails trailing his thighs and rippling, the hat bobbing and the
 * neckerchief's tails flying behind him. To shoot he swings the rifle down
 * to his cheek; each shot kicks his shoulders and head back, then he throws
 * the lever with a cant of the rifle before settling his eye on the target
 * again. Standing about he shifts his weight onto one hip and fidgets: tips
 * his hat, rests the rifle on his shoulder, looks the field over. He drops
 * in spinning on his heel, the coat flaring, and lands with a tip of the
 * hat.
 *
 * figure_ranger.py builds the hold across the body (both arms turned by the
 * same angle about x bring the butt to the right cheek, the left fist still
 * under the fore-end) and the joints: elbows `foreL`/`foreR` (the rifle on
 * the right forearm), `hat` on the head, the neckerchief's point `beard`
 * and its knotted tails `cape2` on the torso, the coat's halves
 * `skirtL`/`skirtR`, and the rifle's lever `extra2`.
 */

const TAU = Math.PI * 2;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const ease = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
/** 0 → 1 → 0 over [a, d], rising over [a, b] and falling over [c, d]. */
const env = (x: number, a: number, b: number, c: number, d: number) =>
  ease((x - a) / (b - a)) * (1 - ease((x - c) / (d - c)));

// ------------------------------------------------------------ the rig
// Rest positions from figure_ranger.py (Blender, z up, facing +y), turned
// into the parts' three.js frame: (x, y, z) → (x, z, -y).
const B = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

const S_R = B(0.172, 0, 0.985);
const E_R = B(0.2388, 0.0469, 0.7487);
const GRIP = B(0.046, 0.214, 0.805);
const S_L = B(-0.172, 0, 0.985);
const E_L = B(-0.2471, 0.0939, 0.7658);
const FIST_L = B(-0.0769, 0.2637, 0.6545);
/** The rifle's long axis (towards the muzzle) and its right side, in the
 *  weapon's own frame (built unrotated, so the same at rest). */
const RIFLE = B(-0.59976, 0.17993, -0.77969).normalize();
const RIFLE_X = B(0.776, 0.36849, -0.51189).normalize();

const ID = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _m0 = new THREE.Matrix4();
const _m1 = new THREE.Matrix4();

/** The turn taking the frame (u0, n0) onto (u1, n1). */
function frameTurn(
  u0: THREE.Vector3,
  n0: THREE.Vector3,
  u1: THREE.Vector3,
  n1: THREE.Vector3,
) {
  const b0 = new THREE.Vector3().crossVectors(u0, n0);
  const b1 = new THREE.Vector3().crossVectors(u1, n1);
  _m0.makeBasis(u0, n0, b0);
  _m1.makeBasis(u1, n1, b1);
  _m1.multiply(_m0.transpose());
  return new THREE.Quaternion().setFromRotationMatrix(_m1);
}

type Reach = {
  arm: THREE.Quaternion;
  fore: THREE.Quaternion;
  /** The elbow's hinge in the upper arm's own frame. */
  hinge: THREE.Vector3;
  /** The forearm's own length (elbow to fist), its twist axis. */
  along: THREE.Vector3;
};

/** Shoulder and elbow turns (each in its parent's frame) that bring the
 *  fist from `fist` to `target`, the elbow towards `pole`. */
function reach(
  s: THREE.Vector3,
  e0: THREE.Vector3,
  fist: THREE.Vector3,
  target: THREE.Vector3,
  pole: THREE.Vector3,
): Reach {
  const l1 = e0.distanceTo(s);
  const l2 = fist.distanceTo(e0);
  const d = target.clone().sub(s);
  const dist = Math.min(d.length(), (l1 + l2) * 0.999);
  const dn = d.normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const side = pole.clone().sub(s);
  side.addScaledVector(dn, -side.dot(dn)).normalize();
  const e1 = s.clone().addScaledVector(dn, a).addScaledVector(side, h);
  const u0 = e0.clone().sub(s).normalize();
  const w0 = fist.clone().sub(e0).normalize();
  const n0 = new THREE.Vector3().crossVectors(u0, w0).normalize();
  const u1 = e1.clone().sub(s).normalize();
  const w1 = target.clone().sub(e1).normalize();
  const n1 = new THREE.Vector3().crossVectors(u1, w1).normalize();
  const arm = frameTurn(u0, n0, u1, n1);
  // The forearm turns about the elbow's hinge (n0 in the arm's own frame)
  // from its rest direction onto the target's.
  const local = w1.clone().applyQuaternion(arm.clone().invert());
  const angle = Math.atan2(_a.crossVectors(w0, local).dot(n0), w0.dot(local));
  const fore = new THREE.Quaternion().setFromAxisAngle(n0, angle);
  return { arm, fore, hinge: n0, along: w0 };
}

/** The same reach with a twist about the forearm that puts the fist as
 *  close to the rifle's whole frame as it can, including its roll. The
 *  wrist's remaining turn then stays small throughout the lift. */
function twistAmount(r: Reach, dir: THREE.Vector3, roll: number) {
  const hand = r.arm.clone().multiply(r.fore);
  const turn = aimRifle(hand, dir, roll);
  // Project the remaining quaternion onto the forearm's twist axis. Using
  // the whole frame avoids the wrist suddenly rolling to the other side
  // when the rifle's long axis passes nearly along the forearm.
  const along = r.along.x * turn.x + r.along.y * turn.y + r.along.z * turn.z;
  return 2 * Math.atan2(along, turn.w);
}

/** The rifle turned so it points along `dir` (world, i.e. the torso's
 *  frame) and rolled `roll` about itself, as a weapon turn inside a
 *  forearm whose world turn is `hand`. */
function aimRifle(hand: THREE.Quaternion, dir: THREE.Vector3, roll: number) {
  const point = new THREE.Quaternion().setFromUnitVectors(
    RIFLE,
    dir.clone().normalize(),
  );
  const spin = new THREE.Quaternion().setFromAxisAngle(RIFLE, roll);
  return hand.clone().invert().multiply(point).multiply(spin);
}

/** The rifle's roll about its length on the shoulder (its top outwards). */
const CARRY_ROLL = 0;
// The rifle carried on the right shoulder, pointing up and back past the
// hat's brim, the fist in front of the shoulder at the stock's wrist.
const CARRY_DIR = B(0.06, -0.65, 0.76);
const CARRY_GRIP = B(0.22, 0.17, 0.885);
const CARRY_POLE = B(0.35, -0.05, 0.5);
// First take the whole rifle clear of the coat, then turn it up in front
// of the shoulder, and only then lay it back. Lowering retraces this path.
const OUT_GRIP = B(0.32, 0.31, 0.86);
const HIGH_GRIP = B(0.3, 0.29, 0.985);
const OUT_POLE = B(0.5, -0.04, 0.68);
const HIGH_DIR = B(0.25, 0.7, 0.67).normalize();
const HIGH_ROLL = 1.35;
// The free left arm hanging loose at his side, the elbow barely bent.
const HANG_L = reach(
  S_L,
  E_L,
  FIST_L,
  B(-0.232, 0.02, 0.52),
  B(-0.3, -0.5, 0.8),
);
// The left fist up at the hat's brim, front left.
const TIP_L = reach(S_L, E_L, FIST_L, B(-0.065, 0.15, 1.23), B(-0.6, 0.1, 0.5));
// The left fist on his hip, elbow out (weight on one leg).
const HIP_L = reach(S_L, E_L, FIST_L, B(-0.2, 0.02, 0.66), B(-0.9, -0.2, 0.75));
// Aiming: both arms raised together about x (see the note at the top).
const AIM_ARM = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.3, 0, 0));

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _previous = new THREE.Vector3();
const _angles = new THREE.Vector3();

/** Equivalent XYZ angles nearest a previous pose, for the Euler springs. */
function nearestAngles(
  q: THREE.Quaternion,
  previous: THREE.Vector3,
  out: THREE.Vector3,
) {
  _e.setFromQuaternion(q, 'XYZ');
  const { x: px, y: py, z: pz } = previous;
  const near = (angle: number, previous: number) =>
    angle + Math.round((previous - angle) / TAU) * TAU;
  let x = near(_e.x, px);
  let y = near(_e.y, py);
  let z = near(_e.z, pz);
  const ax = near(_e.x + Math.PI, px);
  const ay = near(Math.PI - _e.y, py);
  const az = near(_e.z + Math.PI, pz);
  if (
    (ax - px) ** 2 + (ay - py) ** 2 + (az - pz) ** 2 <
    (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2
  ) {
    x = ax;
    y = ay;
    z = az;
  }
  return out.set(x, y, z);
}

/** Ask for a joint's turn given as a quaternion, plus small extra turns. */
function wantQ(
  c: MoveContext,
  part: PartName,
  q: THREE.Quaternion,
  dx = 0,
  dy = 0,
  dz = 0,
) {
  const key = `rifle:${part}`;
  _previous.set(
    c.memo[`${key}:x`] ?? 0,
    c.memo[`${key}:y`] ?? 0,
    c.memo[`${key}:z`] ?? 0,
  );
  const { x, y, z } = nearestAngles(q, _previous, _angles);
  c.memo[`${key}:x`] = x;
  c.memo[`${key}:y`] = y;
  c.memo[`${key}:z`] = z;
  c.want(part, x + dx, y + dy, z + dz);
}

type RiflePose = {
  at: number;
  arm: THREE.Vector3;
  fore: THREE.Vector3;
  gun: THREE.Vector3;
};

// Solve four comfortable holds once, then interpolate the actual spring
// channels. A fresh quaternion solve every frame can cross an XYZ gimbal
// even when its endpoints look right, rushing a wrist through a half turn.
const CARRY_POSES: RiflePose[] = [];
for (const [at, grip, pole, dir, roll] of [
  [0, GRIP, E_R, RIFLE, CARRY_ROLL],
  [0.3, OUT_GRIP, OUT_POLE, RIFLE, CARRY_ROLL],
  [0.75, HIGH_GRIP, OUT_POLE, HIGH_DIR, HIGH_ROLL],
  [1, CARRY_GRIP, CARRY_POLE, CARRY_DIR, CARRY_ROLL],
] as const) {
  const hold = reach(S_R, E_R, GRIP, grip, pole);
  hold.fore.multiply(
    new THREE.Quaternion().setFromAxisAngle(
      hold.along,
      twistAmount(hold, dir, roll),
    ),
  );
  const hand = hold.arm.clone().multiply(hold.fore);
  const previous = CARRY_POSES.at(-1);
  CARRY_POSES.push({
    at,
    arm: nearestAngles(
      hold.arm,
      previous?.arm ?? _previous.set(0, 0, 0),
      new THREE.Vector3(),
    ),
    fore: nearestAngles(
      hold.fore,
      previous?.fore ?? _previous.set(0, 0, 0),
      new THREE.Vector3(),
    ),
    gun: nearestAngles(
      aimRifle(hand, dir, roll),
      previous?.gun ?? _previous.set(0, 0, 0),
      new THREE.Vector3(),
    ),
  });
}
const _carryArm = new THREE.Vector3();
const _carryFore = new THREE.Vector3();
const _carryGun = new THREE.Vector3();

function carryPose(carry: number, aim: number) {
  const i = carry < 0.3 ? 0 : carry < 0.75 ? 1 : 2;
  const from = CARRY_POSES[i];
  const to = CARRY_POSES[i + 1];
  const amount = ease((carry - from.at) / (to.at - from.at));
  _carryArm
    .copy(from.arm)
    .lerp(to.arm, amount)
    .multiplyScalar(1 - aim);
  _carryArm.x += 1.3 * aim;
  _carryFore
    .copy(from.fore)
    .lerp(to.fore, amount)
    .multiplyScalar(1 - aim);
  _carryGun
    .copy(from.gun)
    .lerp(to.gun, amount)
    .multiplyScalar(1 - aim);
}

/** A turn of `angle` about a fixed axis, as a quaternion (reused). */
function about(axis: THREE.Vector3, angle: number, out = _q2) {
  return out.setFromAxisAngle(axis, angle);
}

// ------------------------------------------------------------ fidgets

/** Idle fidgets, in turn: tip the hat, rest the rifle on his shoulder,
 *  a hand on his hip while he looks the field over. */
const FIDGETS = [
  { kind: 'tip', time: 1.7 },
  { kind: 'shoulder', time: 3.4 },
  { kind: 'hip', time: 3.2 },
] as const;

const STYLE = {
  // A cocky, rolling swagger: hips swinging over each planted foot,
  // shoulders rolling against them, a spring in the step; limbs quick
  // enough that the large figure never looks slowed down.
  gait: {
    like: 'swagger',
    cadence: 2.05,
    stride: 0.66,
    sway: 0.58,
    roll: 0.085,
    twist: 0.17,
    bounce: 0.04,
    lift: 0.115,
    lean: 0.0,
    nod: 0.03,
    arms: 0.42,
  } as const,
  armSwing: 0.42,
  lean: 0.0,
  attack: 'custom' as const,
  windup: 0.28,
  lunge: 0,
  snap: 30,
};

export const ranger: Moves = {
  style: STYLE,
  carriage: {
    twist: 0.16,
    hips: 0.08,
    chestRoll: 0.25,
    nod: 0.035,
    armOut: 0.06,
    bounce: 0.07,
    weaponArm: 0,
  },
  // Cloth, hat and scarf on soft springs that overshoot and settle.
  stiff: {
    hat: 0.36,
    beard: 0.34,
    cape2: 0.26,
    skirtL: 0.42,
    skirtR: 0.42,
    extra2: 1.6,
    foreL: 0.8,
    armR: 1,
    foreR: 1,
    weapon: 1,
  },
  damping: {
    hat: 0.36,
    beard: 0.32,
    cape2: 0.3,
    skirtL: 0.42,
    skirtR: 0.42,
    foreL: 0.5,
    // The gun and both links of its arm track together without overshoot.
    armR: 1,
    foreR: 1,
    weapon: 1,
  },
  arrive(d) {
    // Dropped in spinning a full turn on his heel, landing in a crouch
    // that he springs up out of.
    const fall = clamp01(d / 0.24);
    let drop = (1 - fall * fall) * 2.9;
    const s = clamp01(d / 0.52);
    const twirl = -Math.pow(1 - s, 2.2) * TAU;
    let squash = 1.04;
    if (d >= 0.24) {
      const b = clamp01((d - 0.24) / 0.2);
      drop += Math.sin(b * Math.PI) * 0.22;
      squash = 1 - Math.sin(clamp01((d - 0.24) / 0.12) * Math.PI) * 0.22;
      squash -= Math.sin(clamp01((d - 0.44) / 0.1) * Math.PI) * 0.05;
    }
    return { drop, squash, twirl };
  },
  pose(c, p) {
    const m = c.memo;
    const { walk, aim, idle } = c;
    const dt = Math.min(0.1, c.dt);
    const step = Math.cos(c.cycle * TAU);
    const settle = Math.cos((c.cycle - 0.14) * TAU * 2);
    const land = Math.pow(1 - c.pass, 5);

    // ---------------------------------------------- idle fidgets
    if (c.idleFor < 0.05 || m.next === undefined) {
      m.fid = -1;
      m.next = 1.8 + ((c.unit.id * 0.37) % 1) * 1.4;
    }
    let fidW = 0;
    let fidK = -1;
    let fidS = 0;
    if (c.idleFor > m.next) {
      if (m.fid < 0) {
        m.count = (m.count ?? c.unit.id) + 1;
        m.fid = m.count % FIDGETS.length;
        m.fidAt = c.idleFor;
      }
      const f = FIDGETS[m.fid];
      fidS = (c.idleFor - m.fidAt) / f.time;
      if (fidS >= 1) {
        m.fid = -1;
        m.next = c.idleFor + 2.2 + ((m.count * 0.61) % 1) * 2;
      } else {
        fidK = m.fid;
        fidW = env(fidS, 0, 0.22, 0.75, 1) * idle;
      }
    }
    const kind = fidK >= 0 ? FIDGETS[fidK].kind : null;
    const tipW = kind === 'tip' ? fidW : 0;
    const hipW = kind === 'hip' ? fidW : 0;

    // ---------------------------------------------- arriving
    // After landing: the rifle swung onto his shoulder and a tip of the
    // hat with the free hand.
    const arriving = c.deploy < 1 ? 1 : 0;
    const landed = arriving * env(c.deploy, 0.3, 0.5, 0.92, 1.0);
    const greet = arriving * env(c.deploy, 0.5, 0.66, 0.84, 0.98);

    // ---------------------------------------------- the carry
    // Walking (and resting it between fidgets) the rifle lies on his
    // shoulder; it comes down as he stops and as he takes aim.
    const carryGoal =
      Math.max(walk, kind === 'shoulder' ? fidW * 1.05 : 0, landed) * (1 - aim);
    m.carry =
      (m.carry ?? 0) +
      (Math.min(1, carryGoal) - (m.carry ?? 0)) *
        Math.min(1, dt * (carryGoal > (m.carry ?? 0) ? 3.6 : 6.5));
    const carry = ease(m.carry);
    // Clear the shoulder along the carry path before raising the two-hand
    // aim. The cheek hold and every shooting/lever pose stay the same.
    const aimHold = aim * (1 - ease(carry / 0.3));
    carryPose(carry, aimHold);

    // ---------------------------------------------- the shot
    // Since the last shot: the kick (shared strike), then the lever thrown
    // with a cant of the rifle, then the eye back down the barrel.
    const since = c.since;
    const shooting = aim > 0.02 ? aim : 0;
    const kick = c.strike * shooting;
    const lever = shooting * env(since, 0.26, 0.36, 0.5, 0.62);
    const throwL = shooting * env(since, 0.3, 0.38, 0.44, 0.54);
    const settleIn = c.wind * shooting;

    // ---------------------------------------------- the body
    // Swagger: chest out, the shoulders rolling with each step and dipping
    // over the planted foot, a bounce through the shoulders after landing.
    p.torsoX += -0.035 * walk + land * 0.025 * walk;
    p.torsoZ += -step * 0.05 * walk;
    p.torsoY += step * 0.04 * walk;
    p.headX += settle * 0.02 * walk;
    p.headY -= step * 0.04 * walk;
    p.roll += step * 0.012 * walk;

    // Standing: slow breaths, the weight settled on his right hip, now and
    // then the other.
    const breath = Math.sin(c.t * 1.7);
    const sideways = Math.sin(c.t * 0.23 + c.unit.id) > -0.35 ? 1 : -1;
    m.hip = (m.hip ?? 1) + (sideways - (m.hip ?? 1)) * Math.min(1, dt * 1.5);
    p.torsoX += breath * 0.018 * idle;
    p.squash *= 1 + breath * 0.006 * idle;
    p.roll += m.hip * 0.045 * idle * (1 - fidW * 0.3);
    p.torsoZ -= m.hip * 0.07 * idle;
    p.torsoY += m.hip * 0.06 * idle;
    // Looking the field over (the shared look-around), more with a hand on
    // his hip; down at the brim as he tips his hat.
    p.headY *= 1 - 0.85 * Math.max(tipW, greet);
    p.headY += Math.sin(c.t * 0.5 + 1) * 0.25 * hipW;
    p.headX += tipW * 0.12 + greet * 0.1;

    // Aiming: the right shoulder back, the eye down the barrel; leaning
    // into it as he settles, thrown back by each kick.
    p.torsoY += -0.55 * aim + kick * 0.1 - lever * 0.08;
    p.headY += 0.45 * aim - kick * 0.06;
    p.headX += -kick * 0.2 + settleIn * 0.04 + lever * 0.1;
    p.torsoX += settleIn * 0.04 - kick * 0.1 + lever * 0.04;
    p.lean += settleIn * 0.03 - kick * 0.16;
    p.lunge -= kick * 0.12;
    p.roll -= kick * 0.03;
    p.squash *= 1 - kick * 0.03;

    // Hit: a stagger, the rifle jerking up, then a shake of the head.
    const f = c.flinch;
    if (f > 0.85 && (m.hitAt ?? -9) < c.time - 0.3) m.hitAt = c.time;
    const shake = clamp01(1 - (c.time - (m.hitAt ?? -9)) / 0.7);
    p.torsoY -= f * 0.22;
    p.torsoZ += f * 0.08;
    p.torsoX -= f * 0.08;
    p.headY += Math.sin((1 - shake) * 18) * 0.16 * shake * (1 - f);

    // ---------------------------------------------- the arms
    // The right arm: the hold across the body, the carry on the shoulder,
    // the aim; the rifle rides on the forearm.
    // A bob on the shoulder after each footfall; the kick throws the
    // muzzle up; the lever throw drops the rifle from the cheek.
    const armRx =
      -settle * 0.035 * walk * carry +
      kick * 0.09 -
      lever * 0.3 +
      f * 0.16 +
      breath * 0.02 * idle;
    c.want('armR', _carryArm.x + armRx, _carryArm.y, _carryArm.z);
    c.want('foreR', _carryFore.x, _carryFore.y, _carryFore.z);
    // The rifle: on the shoulder, along the forearm, canted over as the
    // lever is thrown (rolled about its own length).
    const gun = _q.setFromEuler(_e.set(_carryGun.x, _carryGun.y, _carryGun.z));
    gun.multiply(about(RIFLE, -lever * 0.55));
    wantQ(c, 'weapon', gun, -kick * 0.2 - settle * 0.03 * walk * carry);
    // The lever: thrown open and snapped shut.
    const leverQ = about(RIFLE_X, throwL * 0.95, _q);
    wantQ(c, 'extra2', leverQ);

    // The left arm: under the fore-end in the hold and the aim; free and
    // swinging loose while he carries the rifle; up at the brim to tip the
    // hat; on his hip.
    const free = ease(carry / 0.3) * (1 - tipW - greet);
    const armL = _q
      .copy(ID)
      .slerp(HANG_L.arm, free)
      .slerp(HIP_L.arm, hipW)
      .slerp(TIP_L.arm, Math.max(tipW, greet))
      .slerp(AIM_ARM, aimHold);
    // The loose arm swings with the opposite leg, the elbow flexing a
    // moment later on the forward swing.
    const sw = c.swingL * 1.15;
    const armLx =
      sw * free +
      kick * 0.09 -
      lever * 0.3 +
      f * 0.16 +
      breath * 0.02 * idle * (1 - free);
    wantQ(c, 'armL', armL, armLx, 0, -0.06 * free * walk);
    const late = -Math.cos((c.cycle - 0.16) * TAU);
    const flex =
      free * walk * (0.05 + 0.14 * Math.max(0, late)) +
      tipW * Math.sin(Math.PI * clamp01((fidS - 0.3) / 0.35)) * 0.25;
    const foreL = _q2
      .copy(ID)
      .slerp(HANG_L.fore, free)
      .slerp(HIP_L.fore, hipW)
      .slerp(TIP_L.fore, Math.max(tipW, greet));
    foreL.multiply(_q.setFromAxisAngle(HANG_L.hinge, flex));
    wantQ(c, 'foreL', foreL);

    // ---------------------------------------------- soft parts
    hat(c, p, tipW, greet, kick, f);
    cloth(c, p, kick, f);
  },
};

/** The hat rides the head on a soft spring: it lags each push and stop,
 *  bounces on the steps and kicks, leans out in turns, pops on a hit, and
 *  tips forward under his fingers. */
function hat(
  c: MoveContext,
  p: Pose,
  tipW: number,
  greet: number,
  kick: number,
  f: number,
) {
  const tip = Math.max(tipW, greet);
  // The brim pinched and tipped down at the middle of the gesture.
  const pinch = tip * Math.sin(Math.PI * clamp01(c.memo.tipS ?? 0));
  c.memo.tipS = tip > 0.02 ? (c.memo.tipS ?? 0) + c.dt / 0.9 : 0;
  const rx =
    // Lagging the body's pushes (the top stays behind), and the head's nods.
    c.accel * 0.02 -
    p.headX * 0.25 +
    // A little bob after each footfall.
    Math.cos((c.cycle - 0.22) * TAU * 2) * 0.035 * c.walk +
    kick * 0.22 +
    f * 0.35 -
    pinch * 0.32;
  const rz = -c.lateral * 0.012 + c.turn * 0.05 - p.roll * 0.6;
  const dy = -c.vertical * 0.0005 + kick * 0.008 + f * 0.022 + pinch * 0.012;
  c.want('hat', rx, Math.sin(c.t * 0.4) * 0.03 * c.idle, rz, dy);
}

/** The duster's tails, the neckerchief's point and its flying tails. */
function cloth(c: MoveContext, p: Pose, kick: number, f: number) {
  const walk = c.walk;
  const spin = c.deploy < 1 ? 1 - c.deploy : 0;
  // The coat's halves trail the thighs (as troops.ts hangs them) and lag
  // his pushes and stops, swinging back and forth, barely sideways: the
  // drape ripple carries the life. Only the deploy spin flares them out.
  // They take back only half the chest's turn: further against the coat
  // above would bare its lining.
  const lag = Math.max(-0.12, Math.min(0.12, -c.accel * 0.025));
  const flare = spin * 0.4;
  for (const [side, out, hip] of [
    ['L', -1, c.hipL],
    ['R', 1, c.hipR],
  ] as const) {
    c.want(
      `skirt${side}`,
      hip * (hip > 0 ? 0.56 : 0.62) +
        p.torsoX +
        p.lean * 0.5 -
        0.04 * walk +
        lag -
        kick * 0.05 -
        f * 0.08,
      -p.torsoY * 0.5,
      out * flare +
        Math.max(
          -0.05,
          Math.min(
            0.05,
            out * (0.008 * walk + Math.abs(hip) * 0.03) - p.torsoZ * 0.8,
          ),
        ),
    );
  }
  // The point hangs from the neck: kept off his chest, it swings forward
  // as he stops or bends, side to side with his roll.
  const hang = p.torsoX + p.lean * 0.6;
  c.want(
    'beard',
    Math.max(
      -0.02,
      hang + c.accel * -0.03 + (1 - c.pass) * 0.05 * walk + kick * 0.12,
    ),
    0,
    -(p.roll + p.torsoZ) * 0.9 + Math.sin(c.cycle * TAU) * 0.08 * walk,
  );
  // The tails fly back off his shoulder as he walks, more as he speeds up,
  // whip in his turns and spins, and never lie into his back.
  const fly =
    0.16 *
      walk *
      Math.min(1.3, (c.speed / Math.max(0.3, c.speed + 0.2)) * 1.6) +
    Math.max(0, c.accel) * 0.03 +
    spin * 0.6 +
    kick * 0.15 +
    f * 0.25 +
    (1 - c.pass) * 0.06 * walk;
  c.want(
    'cape2',
    Math.min(0.04, -fly + Math.min(0, hang) * 0.6),
    -c.turn * 0.06,
    -(p.roll + p.torsoZ) * 0.7 +
      c.lateral * 0.01 +
      Math.sin(c.t * 2.3) * 0.04 * walk,
  );
}
