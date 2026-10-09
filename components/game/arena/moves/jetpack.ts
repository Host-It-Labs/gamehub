import * as THREE from 'three';
import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves, PartName, Pose } from './types.ts';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

type V3 = readonly [number, number, number];
type Side = 'L' | 'R';
const HAND: HandRest = { palm: [1, 0, 0] };
// Canonical left-arm goals; reach mirrors them for the gripping right
// hand. Her wrist leads the shot, below and outside the bubble helmet.
const AIM: ArmGoal = {
  hand: [-0.035, -0.2, -0.375],
  pole: [-0.6, -1, 0.25],
};
const CHECK: ArmGoal = {
  hand: [-0.025, -0.27, -0.16],
  pole: [-0.6, -1, 0.3],
  palm: [0.9, 0.1, -0.3],
  fingers: [0, -0.8, -0.6],
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
function relaxed(c: MoveContext, side: Side): ArmGoal {
  return {
    hand: mirrored(joint(c, `fore${side}`).add(joint(c, `hand${side}`)), side),
    pole: mirrored(joint(c, `fore${side}`), side),
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
/** The solver works in the arm's parent axes. Compensate this figure's
 * small clavicle protraction there, rather than altering solved angles. */
function inClavicle(
  c: MoveContext,
  side: Side,
  goal: ArmGoal,
  clav: THREE.Quaternion,
): ArmGoal {
  const mirror = side === 'L' ? 1 : -1;
  const offset = joint(c, `arm${side}`);
  const shift = offset.clone().sub(offset.applyQuaternion(clav));
  const inverse = clav.clone().invert();
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
    forearmRoll: 0.7,
  };
}
function aimFrame(p: Pose) {
  // The receiver rests 45° down. Move the entire glove through its rest
  // palm/finger frame to level it, countering the spine and thrust lean.
  return new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(-p.lean, 0, p.roll, 'YXZ'))
    .multiply(rotation(-p.torsoX * 0.45, p.torsoY * 0.45, p.torsoZ * 0.45))
    .multiply(rotation(-p.torsoX * 0.55, p.torsoY * 0.55, p.torsoZ * 0.55))
    .invert()
    .multiply(rotation(Math.PI / 4));
}

/** A rocketeer carried by thrust. The authored rest has hanging arms and
 * a blaster angled 45 degrees down; aim moves the entire gripping hand.
 * The engine still owns the .30s first shot and .60s repeat interval. */
export const jetpack: Moves = {
  style: {
    gait: { like: 'glide', arms: 0, lean: 0 },
    attack: 'custom',
    windup: 0.15,
    lunge: 0,
    snap: 32,
    flyHeight: 1.95,
  },
  carriage: {
    twist: 0,
    hips: 0,
    chestRoll: 0,
    nod: 0,
    armOut: 0,
    bounce: 0,
    weaponArm: 0,
  },
  stiff: {
    torso: 0.86,
    chest: 0.82,
    clavR: 1,
    armR: 1.1,
    foreR: 1.1,
    handR: 1.1,
    weapon: 1.1,
    armL: 0.8,
    foreL: 0.72,
    handL: 0.62,
    neck: 0.85,
    head: 0.8,
    legL: 0.7,
    legR: 0.7,
    kneeL: 0.78,
    kneeR: 0.78,
    footL: 0.6,
    footR: 0.6,
    hair: 0.54,
    hat: 1,
    cape: 0.4,
    cape2: 0.28,
    extra: 0.8,
  },
  damping: {
    torso: 0.82,
    chest: 0.83,
    clavR: 1,
    armR: 1,
    foreR: 1,
    handR: 1,
    weapon: 1,
    neck: 0.85,
    head: 0.85,
    hair: 0.78,
    cape: 0.58,
    cape2: 0.48,
    extra: 0.78,
  },
  pose(c, p) {
    const detail = c.reduced ? 0 : 1;
    const breathe = Math.sin(c.t * 2.15) * detail;
    const hover = Math.sin(c.t * 2.5 - 0.6) * detail;
    const drift = Math.sin(c.t * 0.73) * detail;
    const launch = c.deploy < 1 ? 1 - ease(c.deploy / 0.76) : 0;
    const bank = clamp(-c.turn * 0.14 - c.lateral * 0.018, 0.24);
    const surge = clamp(c.accel * 0.014, 0.11);
    const charge = c.wind * c.aim;
    const impact = c.strike * c.aim;
    const recoil = pulse(c.since, 0, 0.045, 0.2) * c.aim;
    const settle = pulse(c.since, 0.08, 0.18, 0.35) * c.aim;
    const idleTime =
      c.idleFor > 2.6 ? (c.idleFor + c.unit.id * 0.41) % 10.7 : -1;
    const checkGlove = pulse(idleTime, 3.6, 4.2, 5.4) * c.idle * detail;
    const scan = pulse(idleTime, 7.1, 7.7, 9.2) * c.idle * detail;

    // Speed loads the pack forward; braking restores a vertical hover.
    // Recoil starts sharply at the shot, then thrust catches it once.
    p.lift += (hover * 0.037 + drift * 0.018 - recoil * 0.009) * c.size;
    p.lean += c.walk * 0.2 + surge - recoil * 0.038;
    p.roll += bank + drift * 0.013 * c.idle;
    p.torsoX += breathe * 0.0065 - charge * 0.015 + settle * 0.009;
    p.torsoY += c.aim * 0.065 - charge * 0.028 + recoil * 0.021;
    p.torsoZ += c.flinch * 0.055;
    p.headX -= c.walk * 0.13 + surge * 0.6;
    p.headX += checkGlove * 0.15 - c.flinch * 0.065;
    p.headY += scan * 0.28 + clamp(c.turn * 0.075, 0.12);
    p.lunge -= recoil * 0.042;

    // No walking cycle in the air. A small asymmetric knee fold carries
    // the boots behind her; ankles remain loose rather than pedalling.
    const trail = c.walk * 0.22 + surge * 0.8 + launch * 0.13;
    const legDrift = hover * 0.026;
    c.want('legL', 0.17 - trail + legDrift, 0, -0.024 - bank * 0.15);
    c.want('kneeL', -0.51 - trail * 0.48 - recoil * 0.055);
    c.want('footL', 0.28 + legDrift * 0.4);
    c.want('legR', 0.04 - trail - legDrift, 0, 0.024 - bank * 0.15);
    c.want('kneeR', -0.32 - trail * 0.38 - recoil * 0.04);
    c.want('footR', 0.21 - legDrift * 0.4);

    // Hovering shoulders stay relaxed; the free wrist trails her thrust
    // with a bent elbow, and its small cuff check stays below the glass.
    const restL = relaxed(c, 'L');
    const restR = relaxed(c, 'R');
    const left: ArmGoal = blend(
      {
        ...restL,
        hand: [
          restL.hand[0] - c.walk * 0.005 - bank * 0.012,
          restL.hand[1] + c.walk * 0.011 + c.flinch * 0.017,
          restL.hand[2] + c.walk * 0.055 + surge * 0.045,
        ],
      },
      CHECK,
      checkGlove,
    );
    const carry: ArmGoal = {
      ...restR,
      hand: [
        restR.hand[0],
        restR.hand[1] + breathe * 0.002 + launch * 0.008,
        restR.hand[2] + c.walk * 0.01,
      ],
    };
    const firing: ArmGoal = {
      ...AIM,
      hand: [
        AIM.hand[0] - c.flinch * 0.005,
        AIM.hand[1] - charge * 0.012 + recoil * 0.012 - settle * 0.004,
        AIM.hand[2] + charge * 0.028 - impact * 0.006 + recoil * 0.036,
      ],
      ...facing(c, 'R', aimFrame(p)),
    };
    const right = blend(carry, firing, ease(c.aim));
    const protract = c.aim * 0.065 - charge * 0.008;
    const shrug = c.aim * 0.022;
    const trailShoulder = c.walk * 0.018;
    c.want('clavR', 0, protract, shrug);
    c.want('clavL', 0, trailShoulder, 0);
    reach(
      c,
      'R',
      inClavicle(c, 'R', right, rotation(0, protract, shrug)),
      HAND,
    );
    reach(
      c,
      'L',
      inClavicle(c, 'L', left, rotation(0, trailShoulder, 0)),
      HAND,
    );
    // The barrel never aims independently inside the fingers.
    p.weapon = 0;

    // The glass collar follows the head without a loose helmet wobble.
    c.want('hat', 0, 0, 0);
    c.want('neck', -surge * 0.12 + recoil * 0.014);
    c.want(
      'hair',
      clamp(-c.accel * 0.003, 0.012) * detail,
      clamp(-c.turn * 0.018, 0.022) * detail,
      clamp(-c.lateral * 0.004, 0.018) * detail,
    );
    const scarfPitch =
      clamp(-c.accel * 0.01 + c.vertical * 0.004, 0.075) +
      c.walk * 0.038 +
      recoil * 0.028 +
      c.flinch * 0.06;
    c.want(
      'cape',
      scarfPitch * detail,
      clamp(-c.turn * 0.08, 0.15) * detail,
      clamp(-c.lateral * 0.017, 0.09) * detail,
    );
    c.want(
      'cape2',
      (scarfPitch * 0.7 + Math.sin(c.t * 5.3 - 0.8) * 0.016) * detail,
      clamp(-c.turn * 0.1, 0.18) * detail,
      clamp(-c.lateral * 0.022, 0.12) * detail,
    );
    // The nozzles remain rigid on the pack; only their tapered flames lag
    // the thrust vector. This avoids the whole tank wagging on each shot.
    c.want(
      'extra',
      -surge * 0.5 +
        c.walk * 0.045 +
        launch * 0.04 +
        Math.sin(c.t * 27) * 0.018 * detail,
      0,
      bank * 0.22 + Math.sin(c.t * 31 + 0.7) * 0.013 * detail,
    );
  },
  arrive(d) {
    return {
      drop: -1.1 * (1 - ease(d / 0.7)) + pulse(d, 0.54, 0.72, 0.98) * 0.11,
      squash: 1,
      twirl: (1 - ease(d / 0.72)) * 0.16,
    };
  },
};
