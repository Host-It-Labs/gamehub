import { Euler, Quaternion, Vector3 } from 'three';
import { reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves } from '@/components/game/arena/moves/types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (value: number) => {
  const v = Math.max(0, Math.min(1, value));
  return v * v * (3 - 2 * v);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));
type V3 = readonly [number, number, number];
const REST_WRIST: V3 = [0.271, 0.518, -0.076];
const GRIP_OFFSET: V3 = [-0.044, -0.048, -0.032];
const SHOULDER: V3 = [0.207, 0.992, 0.003];
const CLAV: V3 = [0.053, 1.013, 0.003];
const ELBOW: V3 = [0.261, 0.742, -0.01];
const AXIS = new Vector3(0, 0.28, -0.96).normalize();
const DOWN = new Vector3(0, -AXIS.z, AXIS.y).negate();
const HAND: HandRest = {
  palm: [1, 0, 0],
  fingers: DOWN.toArray() as [number, number, number],
};

const vector = (v: V3, side: 'L' | 'R') =>
  new Vector3(v[0] * (side === 'R' ? 1 : -1), v[1], v[2]);
const leftFrame = (v: Vector3, side: 'L' | 'R'): V3 => [
  v.x * (side === 'L' ? 1 : -1),
  v.y,
  v.z,
];
const rotation = (x: number, y = 0, z = 0) =>
  new Quaternion().setFromEuler(new Euler(x, y, z, 'XYZ'));

/** Place a palm around a rigid tool frame, compensating for the anatomical
 * clavicle's moved shoulder before asking the shared arm solver. Both
 * hands have the same world orientation in the spray and stay on the
 * same nozzle. The source's right grip is 0.195 units behind the left. */
function grip(
  c: MoveContext,
  side: 'L' | 'R',
  centre: Vector3,
  tool: Quaternion,
  active: number,
  restPole: boolean,
) {
  const sign = side === 'R' ? 1 : -1;
  const clav = rotation(0, sign * active * 0.065, sign * active * 0.015);
  const pivot = vector(CLAV, side);
  const shoulder = vector(SHOULDER, side)
    .sub(pivot)
    .applyQuaternion(clav)
    .add(pivot);
  const offset = vector(GRIP_OFFSET, side).applyQuaternion(tool);
  const inverse = clav.clone().invert();
  const wrist = centre
    .clone()
    .sub(offset)
    .sub(shoulder)
    .applyQuaternion(inverse);
  // A hanging arm's lateral rest slope leaves a small minimum bend for
  // the common-axis elbow hinge. Keep cosmetic carriage inside that real
  // envelope; the spray targets are comfortably inside it already.
  const upper = c.rest(`fore${side}`);
  const lower = c.rest(`hand${side}`);
  if (upper && lower) {
    const u = new Vector3(...upper),
      f = new Vector3(...lower);
    const a = u.length(),
      b = f.length();
    u.normalize();
    f.normalize();
    const maximumDot =
      u.x * f.x + Math.hypot(u.y * f.y + u.z * f.z, u.z * f.y - u.y * f.z);
    const maximum = Math.sqrt(a * a + b * b + 2 * a * b * maximumDot) * 0.995;
    if (wrist.length() > maximum) wrist.setLength(maximum);
  }
  const palm = new Vector3(-sign, 0, 0)
    .applyQuaternion(tool)
    .applyQuaternion(inverse);
  const fingers = DOWN.clone().applyQuaternion(tool).applyQuaternion(inverse);
  const natural = vector(ELBOW, side).sub(vector(SHOULDER, side));
  const pole = restPole
    ? natural
    : natural
        .lerp(new Vector3(sign * 0.6, -1, 0.28), active)
        .applyQuaternion(inverse);
  const goal: ArmGoal = {
    hand: leftFrame(wrist, side),
    pole: leftFrame(pole, side),
    palm: leftFrame(palm, side),
    fingers: leftFrame(fingers, side),
    forearmRoll: 0.7,
  };
  c.want(`clav${side}`, 0, sign * active * 0.065, sign * active * 0.015);
  reach(c, side, goal, HAND);
}

/** An experienced brigade man: a steady walk with one carrying hand and
 * one free hand. Before the water opens he settles into planted knees,
 * catches the branch pipe with the forward hand and braces through his
 * waist. Pressure rocks the whole stance back, then the nozzle settles.
 * Gameplay timing remains the existing 0.2 second wind-up. */
export const firefighter: Moves = {
  style: {
    gait: { like: 'brisk', stride: 0.64, arms: 0.16, weight: 0.6, elbow: 0.12 },
    attack: 'custom',
    windup: 0.2,
    lunge: 0,
    snap: 30,
  },
  carriage: {
    twist: 0.1,
    hips: 0.05,
    chestRoll: 0.2,
    nod: 0.02,
    armOut: 0,
    bounce: 0.012,
    weaponArm: 0.25,
  },
  stiff: {
    armL: 1,
    armR: 1,
    foreL: 1,
    foreR: 1,
    handL: 1,
    handR: 1,
    clavL: 1,
    clavR: 1,
    weapon: 1,
    hat: 0.58,
    cape: 0.6,
    cape2: 0.46,
  },
  damping: {
    armL: 0.86,
    armR: 0.86,
    foreL: 0.86,
    foreR: 0.86,
    handL: 0.86,
    handR: 0.86,
    clavL: 0.86,
    clavR: 0.86,
    weapon: 0.86,
    hat: 0.7,
    cape: 0.7,
    cape2: 0.66,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const a = ease(c.aim);
    const idleTime = c.idleFor > 1.6 ? (c.idleFor + c.unit.id * 0.41) % 8 : -1;
    const inspect = pulse(idleTime, 2, 2.8, 4.3) * c.idle * cosmetic;
    const survey = pulse(idleTime, 5.1, 5.8, 7.3) * c.idle * cosmetic;
    const landing = c.deploy < 1 ? pulse(c.deploy, 0.3, 0.52, 0.95) : 0;
    const breath = Math.sin(c.t * 1.3) * 0.006 * c.idle * cosmetic;
    const wind = ease(c.wind) * a;
    const pressure = c.strike * a;
    const recoil = pulse(c.since, 0.02, 0.1, 0.35) * a;
    const vibration = Math.sin(c.t * 24) * 0.006 * a * cosmetic;

    const restR = vector(REST_WRIST, 'R').add(vector(GRIP_OFFSET, 'R'));
    restR.y += breath + inspect * 0.07 + landing * 0.012;
    restR.z -= c.swingR * 0.055 * (1 - a) + inspect * 0.022;
    const carry = rotation(inspect * 0.12);
    const spray = rotation(
      -Math.atan2(0.28, 0.96) + wind * 0.035 + vibration,
      Math.sin(c.t * 1.6) * 0.015 * a * cosmetic,
    );
    const tool = carry.slerp(spray, a);
    const pressureGrip = new Vector3(0.105, 0.795, -0.155);
    pressureGrip.y -= pressure * 0.007;
    pressureGrip.z += wind * 0.012 + recoil * 0.019;
    const right = restR.lerp(pressureGrip, a);
    const restL = vector(REST_WRIST, 'L').add(vector(GRIP_OFFSET, 'L'));
    restL.y += breath;
    restL.z -= c.swingL * 0.14 * (1 - a);
    const forward = right
      .clone()
      .add(AXIS.clone().applyQuaternion(tool).multiplyScalar(0.195));
    const left = restL.lerp(forward, a);
    const leftTool = rotation(0).slerp(tool, a);

    grip(c, 'R', right, tool, a, a === 0);
    grip(c, 'L', left, leftTool, a, a === 0);
    // Prop bone remains fixed inside the sculpted right grip. Independent
    // weapon rotation would wrench the handle through its fingers.
    c.want('weapon', 0);
    p.weapon = 0;
    p.lift -= c.size * (a * 0.035 + pressure * 0.012 + landing * 0.04);
    p.torsoX += -a * 0.055 - pressure * 0.035 + wind * 0.02;
    p.torsoY += a * Math.sin(c.t * 1.6) * 0.025 * cosmetic;
    p.headX += a * 0.04 + inspect * 0.13 - pressure * 0.025;
    p.headY += survey * 0.33;
    p.lean -= recoil * 0.025;
    p.lunge -= a * 0.025 + pressure * 0.035;
    p.squash *= 1 - pressure * 0.008 - landing * 0.018;
    p.torsoZ += c.flinch * 0.075;
    p.headX -= c.flinch * 0.055;

    // The heavy brass helmet jolts a little on a hit.
    c.want(
      'hat',
      cosmetic * clamp(-c.accel * 0.004 + c.vertical * 0.004, 0.02) + cosmetic * c.flinch * 0.06,
      cosmetic * clamp(-c.turn * 0.012, 0.025),
      cosmetic * clamp(-c.lateral * 0.004, 0.025),
    );
    // The two hose links trail from the coupling. They may bend softly;
    // the mouth's attachment is the weapon itself, never a free translation.
    c.want(
      'cape',
      cosmetic * clamp(-c.accel * 0.012, 0.045),
      cosmetic * clamp(-c.turn * 0.02, 0.045),
      cosmetic * clamp(-c.lateral * 0.006, 0.035),
    );
    c.want(
      'cape2',
      cosmetic * clamp(-c.accel * 0.02, 0.075),
      cosmetic * clamp(-c.turn * 0.04, 0.08),
      cosmetic * clamp(-c.lateral * 0.01, 0.055),
    );
  },
  arrive(d) {
    return {
      drop: (1 - ease(d / 0.3)) * 2.2,
      squash: 1 - pulse(d, 0.3, 0.36, 0.54) * 0.025,
      twirl: 0,
    };
  },
};
