import * as THREE from 'three';
import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves, PartName, Pose } from './types';

const TAU = Math.PI * 2;
const clamp = (v: number, n: number) => Math.max(-n, Math.min(n, v));
const ease = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));
type V3 = readonly [number, number, number];
type Side = 'L' | 'R';
const HAND: HandRest = { palm: [1, 0, 0] };
// All goals describe the LEFT arm. The right wrist comes slightly inward
// on a puff, leaving room for the other hand to reach the bellows without
// a straight elbow or a shoulder twisted out of its socket.
const PUFF: ArmGoal = {
  hand: [0.07, -0.195, -0.28],
  pole: [-0.5, -1, 0.3],
};
const vector = (a: readonly number[]) => new THREE.Vector3(...(a as V3));
const mirrored = (v: THREE.Vector3, side: Side): V3 => [
  v.x * (side === 'L' ? 1 : -1),
  v.y,
  v.z,
];
const joint = (c: MoveContext, part: PartName) =>
  vector(c.rest(part) ?? [0, 0, 0]);
const rotation = (x = 0, y = 0, z = 0) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
const solved = (c: MoveContext, part: PartName) =>
  rotation(
    c.memo[`reach.${part}.x`] ?? 0,
    c.memo[`reach.${part}.y`] ?? 0,
    c.memo[`reach.${part}.z`] ?? 0,
  );
const shoulder = (c: MoveContext, side: Side, clav?: THREE.Quaternion) =>
  joint(c, `clav${side}`).add(
    joint(c, `arm${side}`).applyQuaternion(clav ?? new THREE.Quaternion()),
  );
function relaxed(c: MoveContext, side: Side): ArmGoal {
  return {
    hand: mirrored(joint(c, `fore${side}`).add(joint(c, `hand${side}`)), side),
    pole: mirrored(joint(c, `fore${side}`).normalize(), side),
    palm: [1, 0, 0],
    fingers: mirrored(joint(c, `hand${side}`), side),
  };
}
function facing(c: MoveContext, side: Side, q: THREE.Quaternion) {
  return {
    palm: mirrored(
      new THREE.Vector3(side === 'L' ? 1 : -1, 0, 0).applyQuaternion(q),
      side,
    ),
    fingers: mirrored(joint(c, `hand${side}`).applyQuaternion(q), side),
  };
}
/** Interpolate the hand's frame without cancelling opposed finger goals. */
function orientedBlend(a: ArmGoal, b: ArmGoal, t: number): ArmGoal {
  const frame = (goal: ArmGoal) => {
    const fingers = vector(goal.fingers!).normalize();
    const palm = vector(goal.palm!);
    palm.addScaledVector(fingers, -palm.dot(fingers)).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(palm, fingers.clone().cross(palm), fingers),
    );
  };
  const q = frame(a).slerp(frame(b), t);
  return {
    ...blend(a, b, t),
    palm: vector([1, 0, 0]).applyQuaternion(q).toArray() as unknown as V3,
    fingers: vector([0, 0, 1]).applyQuaternion(q).toArray() as unknown as V3,
  };
}
/** Goals live in one chest frame; move them into each clavicle's frame
 * after the small natural shoulder protraction. IK remains reach's job. */
function inClavicle(
  c: MoveContext,
  side: Side,
  goal: ArmGoal,
  clav: THREE.Quaternion,
): ArmGoal {
  const mirror = side === 'L' ? 1 : -1;
  const inverse = clav.clone().invert();
  const shift = shoulder(c, side).sub(shoulder(c, side, clav));
  const point = (v: V3) =>
    mirrored(
      new THREE.Vector3(v[0] * mirror, v[1], v[2])
        .add(shift)
        .applyQuaternion(inverse),
      side,
    );
  const direction = (v: V3) =>
    mirrored(
      new THREE.Vector3(v[0] * mirror, v[1], v[2]).applyQuaternion(inverse),
      side,
    );
  return {
    hand: point(goal.hand),
    pole: goal.pole ? point(goal.pole) : undefined,
    palm: direction(goal.palm ?? [1, 0, 0]),
    fingers: goal.fingers ? direction(goal.fingers) : undefined,
    forearmRoll: side === 'L' ? 0.58 : 0.7,
  };
}
/** Read only the rotations the shared solver has just produced. This is
 * forward kinematics for prop contact, not a second arm solver. */
function bellows(c: MoveContext, clav: THREE.Quaternion, press: number) {
  const arm = clav.clone().multiply(solved(c, 'armR'));
  const fore = arm.clone().multiply(solved(c, 'foreR'));
  const hand = fore.clone().multiply(solved(c, 'handR'));
  const wrist = shoulder(c, 'R', clav)
    .add(joint(c, 'foreR').applyQuaternion(arm))
    .add(joint(c, 'handR').applyQuaternion(fore));
  const hinge = wrist
    .add(joint(c, 'weapon').applyQuaternion(hand))
    .add(joint(c, 'extra2').applyQuaternion(hand));
  const board = hand.multiply(rotation(press));
  // Source board centre is 52mm above its hinge. Contact is 8mm higher
  // and 4mm behind it, on the back face of the moving wooden board.
  const surface = hinge.add(
    new THREE.Vector3(0, 0.06, 0.004).applyQuaternion(board),
  );
  // Fingers cross the board diagonally towards the holding hand; this
  // follows the forearm instead of folding the wrist down at a right angle.
  const fingers = new THREE.Vector3(0.98, -0.2, 0)
    .normalize()
    .applyQuaternion(board);
  const palm = new THREE.Vector3(0, 0, -1).applyQuaternion(board);
  const target = surface
    .addScaledVector(fingers, -0.054)
    .addScaledVector(palm, -0.022)
    .sub(shoulder(c, 'L'));
  return {
    hand: target.toArray() as unknown as V3,
    pole: new THREE.Vector3(0.2, -1, -0.6)
      .normalize()
      .toArray() as unknown as V3,
    palm: palm.toArray() as unknown as V3,
    fingers: fingers.toArray() as unknown as V3,
  };
}
function upright(p: Pose) {
  // The spine is split 45/55 by TroopView. Counter its goal, including
  // the whole-body lean/roll. The resting grip is level; the puff tips
  // the entire glove and smoker together by .82 radians.
  return new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(-p.lean, 0, p.roll, 'YXZ'))
    .multiply(rotation(-p.torsoX * 0.45, p.torsoY * 0.45, p.torsoZ * 0.45))
    .multiply(rotation(-p.torsoX * 0.55, p.torsoY * 0.55, p.torsoZ * 0.55))
    .invert();
}

/** Deliberate short steps under a hive; anticipation, an on-event squeeze,
 * a small follow-through and quiet recovery from each bee release. */
export const beekeeper: Moves = {
  style: {
    gait: {
      like: 'brisk',
      stride: 0.56,
      cadence: 2.35,
      arms: 0.26,
      weight: 0.62,
      bounce: 0.02,
    },
    attack: 'custom',
    windup: 0.3,
    lunge: 0,
    snap: 30,
  },
  carriage: {
    twist: 0.07,
    hips: 0.055,
    chestRoll: -0.18,
    nod: 0.014,
    armOut: 0,
    bounce: 0.013,
    weaponArm: 0.16,
  },
  stiff: {
    armL: 1.12,
    foreL: 1.12,
    handL: 1.12,
    armR: 1.12,
    foreR: 1.12,
    handR: 1.12,
    weapon: 1.12,
    hat: 0.52,
    cape: 0.3,
    skirtL: 0.82,
    skirtR: 0.82,
    extra: 0.72,
    extra2: 1.25,
    hair: 0.6,
  },
  damping: {
    armL: 1,
    foreL: 1,
    handL: 1,
    armR: 1,
    foreR: 1,
    handR: 1,
    weapon: 1,
    hat: 0.68,
    cape: 0.48,
    skirtL: 1,
    skirtR: 1,
    extra: 0.88,
    extra2: 0.94,
    hair: 0.75,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    // Supports release while walking. sinceHit resets on each spawn;
    // cooldown retains the engine's first 1s / subsequent 4.5s schedule.
    const cooldown = c.unit.cooldown ?? Infinity;
    const prepare =
      c.deploy >= 1 && cooldown > 0 ? ease((0.3 - cooldown) / 0.3) : 0;
    const released = 1 - ease((c.since - 0.14) / 0.6);
    const ready = Math.max(prepare, released);
    const squeeze = pulse(c.since, -0.025, 0.045, 0.18);
    const follow = pulse(c.since, 0.045, 0.16, 0.48);
    const breath = Math.sin(c.t * 1.65) * c.idle * cosmetic;
    const lap = c.idleFor > 1.8 ? (c.idleFor + c.unit.id * 0.31) % 11.6 : -1;
    const glance = pulse(lap, 2.7, 3.1, 4.2) * c.idle * cosmetic * (1 - ready);
    const settle = pulse(lap, 7.3, 7.7, 8.8) * c.idle * cosmetic * (1 - ready);
    const step = Math.cos((c.cycle - 0.1) * TAU * 2) * c.walk;
    const flinch = c.flinch * c.flinch;
    const landing = c.deploy < 1 ? pulse(c.deploy, 0.34, 0.46, 0.78) : 0;

    p.torsoX +=
      0.026 * c.walk +
      breath * 0.01 +
      prepare * 0.028 -
      follow * 0.02 +
      flinch * 0.075 +
      landing * 0.06;
    p.torsoY += ready * 0.055 + follow * 0.035 - glance * 0.05;
    p.torsoZ +=
      Math.sin(c.t * 0.7) * 0.012 * c.idle * cosmetic - flinch * 0.055;
    p.headX += ready * 0.025 - flinch * 0.045 - landing * 0.04;
    p.headY += glance * 0.34 + clamp(c.turn * 0.065, 0.12);

    const boardAngle = -squeeze * 0.18;
    const restR = relaxed(c, 'R');
    const restL = relaxed(c, 'L');
    const carry: ArmGoal = {
      ...restR,
      hand: [
        restR.hand[0],
        restR.hand[1] + 0.004 + breath * 0.003 + landing * 0.012,
        restR.hand[2] - p.armR * 0.018,
      ],
      ...facing(c, 'R', upright(p)),
    };
    const puff: ArmGoal = {
      ...PUFF,
      hand: [
        PUFF.hand[0],
        PUFF.hand[1] - prepare * 0.009 + squeeze * 0.005,
        PUFF.hand[2] + prepare * 0.018 - squeeze * 0.007 + follow * 0.012,
      ],
      ...facing(c, 'R', upright(p).multiply(rotation(0.82))),
    };
    const right = orientedBlend(carry, puff, ready);
    const leftRest: ArmGoal = {
      ...restL,
      hand: [
        restL.hand[0] - clamp(c.turn * 0.009, 0.009) * cosmetic,
        restL.hand[1] +
          0.004 +
          c.walk * 0.014 +
          breath * 0.003 +
          settle * 0.005 +
          flinch * 0.015,
        restL.hand[2] - p.armL * 0.15 - settle * 0.012,
      ],
      fingers: [
        restL.fingers![0],
        restL.fingers![1],
        restL.fingers![2] - p.armL * 0.035,
      ],
    };

    // The shoulders protract a little with the reach. Goals are moved
    // into those frames before solving, so neither hand loses its prop.
    const clavR = rotation(0, ready * 0.06, ready * 0.014);
    const clavL = rotation(0, -ready * 0.065, -ready * 0.012);
    c.want('clavR', 0, ready * 0.06, ready * 0.014);
    c.want('clavL', 0, -ready * 0.065, -ready * 0.012);
    if (reach(c, 'R', inClavicle(c, 'R', right, clavR), HAND)) {
      const press = bellows(c, clavR, boardAngle);
      const leftReady = ease(ready);
      const leftPath = orientedBlend(leftRest, press, leftReady);
      const arc = Math.sin(leftReady * Math.PI);
      leftPath.hand = [
        leftPath.hand[0],
        leftPath.hand[1] + arc * 0.1,
        leftPath.hand[2] - arc * 0.03,
      ];
      // Take the elbow around the outside while its plane turns from a
      // hanging arm to the forward press, avoiding a near-straight flip.
      leftPath.pole = [
        leftPath.pole![0] - arc * 0.1,
        leftPath.pole![1],
        leftPath.pole![2],
      ];
      reach(c, 'L', inClavicle(c, 'L', leftPath, clavL), HAND);
    } else {
      reach(c, 'L', leftRest, HAND);
    }
    // Only the bellows moves inside the prop. The smoker itself remains
    // rigidly attached to the right glove, including through the recoil.
    p.weapon = 0;
    c.want('extra2', boardAngle);

    const surge = clamp(-c.accel * 0.018, 0.12) * cosmetic;
    const side = clamp(-c.lateral * 0.015 - c.turn * 0.045, 0.13) * cosmetic;
    c.want(
      'skirtL',
      c.hipL * 0.9 + surge * 0.35 + landing * 0.035,
      -p.torsoY * 0.35,
      side,
    );
    c.want(
      'skirtR',
      c.hipR * 0.9 + surge * 0.35 + landing * 0.035,
      -p.torsoY * 0.35,
      side,
    );
    c.want(
      'hat',
      (clamp(-c.accel * 0.011 + c.vertical * 0.004, 0.055) + step * 0.009) *
        cosmetic +
        flinch * 0.025,
      clamp(-c.turn * 0.027, 0.045) * cosmetic,
      side * 0.3,
    );
    c.want(
      'cape',
      surge * 1.25 + follow * 0.035 * cosmetic + flinch * 0.06,
      clamp(-c.turn * 0.07, 0.16) * cosmetic,
      side * 0.9 + flinch * 0.025,
    );
    c.want('hair', surge * 0.12, side * 0.1, side * 0.1);
    // The loaded wooden hive moves much less than the veil.
    c.want(
      'extra',
      (step * 0.008 + surge * 0.28) * cosmetic + landing * 0.02,
      clamp(-c.turn * 0.015, 0.035) * cosmetic,
      side * 0.18,
    );
  },
  arrive(d) {
    return {
      drop: 1.7 * (1 - ease(d / 0.34)),
      squash: 1 - pulse(d, 0.34, 0.43, 0.67) * 0.025,
      twirl: 0,
    };
  },
};
