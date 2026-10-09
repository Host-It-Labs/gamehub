import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves, PartName } from './types';

// Staged only. Root copies this into moves/gunner.ts after actual motion review.
// The card still fires every 3.5 s, first hit 1.5 s; windup stays 0.55 s.
type V3 = readonly [number, number, number];
const WHEEL_R = 0.17;
// The wheel's vertical radius scales with TROOP_SCALE. figureDimensions
// broadens only the horizontal axes; the old 1.06 multiplier is stale.
const FIGURE_SCALE = 1.75;
const clamp = (x: number, cap: number) => Math.max(-cap, Math.min(cap, x));
const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const pulse = (x: number, start: number, peak: number, end: number) =>
  ease((x - start) / (peak - start)) * (1 - ease((x - peak) / (end - peak)));
const q = (a: V3) => new Quaternion().setFromEuler(new Euler(...a, 'XYZ'));
function orientation(palm: Vector3, fingers: Vector3) {
  const d = fingers.clone().normalize();
  const p = palm.clone().addScaledVector(d, -palm.dot(d)).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(p, d, p.clone().cross(d)));
}
const GRIP_ORIENTATION = orientation(new Vector3(0, 0, -1), new Vector3(0, -1, 0));
// Palm towards his face, knuckles towards the flash. This lets the hand
// turn forwards with the forearm rather than twisting sideways at mid-lift.
const SHIELD_ORIENTATION = orientation(new Vector3(0.08, -0.18, 0.97), new Vector3(-0.25, 0.95, -0.1));
const HAND: HandRest = {
  // From figure_gunner_sculpt.hand_frame(-1), normalized in Three axes.
  palm: [0.99952, -0.03013, -0.00712],
  fingers: [-0.03097, -0.97273, -0.22992],
};

/** World target relative to the independent gun; compensate waist, chest
 * and clavicle rotations before reach solves the common-axis arm chain. */
function hand(
  c: MoveContext,
  side: 'L' | 'R',
  wrist: Vector3,
  palm: Vector3,
  fingers: Vector3,
  torso: V3,
  chest: V3,
  clav: V3,
  shielding: number,
) {
  const frame = new Matrix4();
  const unit = new Vector3(1, 1, 1);
  for (const [part, angles] of [
    ['torso', torso], ['chest', chest], [`clav${side}`, clav],
  ] as [PartName, V3][]) {
    const rest = c.rest(part);
    if (!rest) return;
    frame.multiply(new Matrix4().compose(new Vector3(...rest), q(angles), unit));
  }
  const arm = c.rest(`arm${side}`);
  if (!arm) return;
  const inverseRotation = new Quaternion().setFromRotationMatrix(frame).invert();
  const local = wrist.clone().applyMatrix4(frame.clone().invert()).sub(new Vector3(...arm));
  const localPalm = palm.clone().applyQuaternion(inverseRotation);
  const localFingers = fingers.clone().applyQuaternion(inverseRotation);
  const sign = side === 'L' ? 1 : -1;
  const mirror = (v: Vector3): V3 => [v.x * sign, v.y, v.z];
  const goal: ArmGoal = {
    hand: mirror(local), palm: mirror(localPalm), fingers: mirror(localFingers),
    pole: [-0.55 - shielding * 0.2, -1 + shielding * 0.75, 0.35],
    forearmRoll: 0.65,
  };
  reach(c, side, goal, HAND);
  // Numeric goal retained for the scoped FK audit, never shared between units.
  c.memo[`gunner.wrist${side}.x`] = wrist.x;
  c.memo[`gunner.wrist${side}.y`] = wrist.y;
  c.memo[`gunner.wrist${side}.z`] = wrist.z;
}

export const gunner: Moves = {
  style: {
    gait: { like: 'shuffle', stride: 0.46, bounce: 0, crouch: 0, sway: 0, roll: 0, twist: 0 },
    armSwing: 0, twoHanded: true, lean: 0,
    attack: 'custom', windup: 0.55, lunge: 0, snap: 30,
  },
  carriage: { twist: 0, hips: 0, chestRoll: 0, nod: 0.01, armOut: 0, bounce: 0, weaponArm: 0 },
  stiff: {
    torso: 1, chest: 1, clavL: 1, clavR: 1,
    armL: 1, armR: 1, foreL: 1, foreR: 1, handL: 1, handR: 1,
    offhand: 1, extra: 1.2, hat: 0.52, hair: 0.4,
  },
  damping: {
    torso: 0.82, chest: 0.82, clavL: 0.82, clavR: 0.82,
    armL: 0.82, armR: 0.82, foreL: 0.82, foreR: 0.82, handL: 0.82, handR: 0.82,
    offhand: 0.82, extra: 0.82, hat: 0.64, hair: 0.56,
  },
  arrive(d) {
    const fall = ease(d / 0.34);
    return { drop: (1 - fall) * 2.1, squash: 1, twirl: 0 };
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const a = ease(c.aim);
    // Continuous at the hit: the loaded stance holds for the first frames,
    // then the recoil transfers through the waist and shoulders.
    const brace = a * (c.since < 0.08 ? 1 - ease(c.since / 0.08) : ease(c.wind));
    const recoil = a * pulse(c.since, 0, 0.055, 1.25);
    const hit = a * pulse(c.since, 0, 0.045, 0.38);
    const runUp = a * pulse(c.since, 0.30, 0.75, 1.35);
    const shield = a * (c.since < 0.20 ? 1 : c.since < 0.68 ? 1 - ease((c.since - 0.20) / 0.48) : ease((c.wind - 0.30) / 0.70));
    const idleReady = ease((c.idleFor - 1.5) / 0.8) * c.idle * cosmetic;
    const lap = (c.idleFor + c.unit.id * 0.37) % 10.5;
    const sight = pulse(lap, 2, 2.9, 4.2) * idleReady;
    const scan = pulse(lap, 6.3, 7.1, 8.5) * idleReady;
    const breath = Math.sin(c.t * 1.2) * 0.004 * c.idle * cosmetic;
    const shove = (1 - c.pass) * c.walk * 0.035;
    const flinch = c.flinch * c.flinch;
    const landing = c.deploy < 1 ? pulse(c.deploy, 0.34, 0.40, 0.63) : 0;
    const torso: V3 = [-0.028 - shove - brace * 0.028 + recoil * 0.045 - runUp * 0.040, 0, 0];
    const chest: V3 = [-breath - brace * 0.020 + hit * 0.065 - sight * 0.025 + flinch * 0.020, 0, 0];

    // Wheels and carriage cannot breathe, squash or roll with the person.
    p.lean = p.roll = p.lift = 0;
    p.squash = 1; p.torsoX = -torso[0]; p.torsoY = p.torsoZ = 0;
    p.armL = p.armR = p.armLz = p.armRz = 0;
    p.lunge = -0.15 * recoil;
    p.offhand = 0; p.weapon = 0;
    c.want('torso', ...torso); c.want('chest', ...chest);
    c.want('offhand', 0); c.want('weapon', 0);
    const bar = new Vector3(0, 0.640, -0.350);
    for (const side of ['L', 'R'] as const) {
      const sign = side === 'L' ? -1 : 1;
      const clav: V3 = [0, sign * a * 0.015, sign * shield * (side === 'L' ? 0.055 : 0)];
      c.want(`clav${side}`, ...clav);
      // Grip's centre is 0.060 along the fingers and 0.030 off the palm.
      const fingers = new Vector3(0, -1, 0);
      const palm = new Vector3(0, 0, -1);
      const grip = bar.clone(); grip.x = sign * 0.145;
      const wrist = grip.clone().addScaledVector(fingers, -0.060).addScaledVector(palm, -0.030);
      const shielding = side === 'L' ? shield : 0;
      if (shielding > 0) {
        wrist.lerp(new Vector3(-0.190, 1.238, -0.174), shielding);
        // The fingers reverse direction. Slerp a complete orthogonal hand
        // frame so the midpoint never collapses or flips through the wrist.
        const turning = GRIP_ORIENTATION.clone().slerp(SHIELD_ORIENTATION, shielding);
        fingers.set(0, 1, 0).applyQuaternion(turning);
        palm.set(1, 0, 0).applyQuaternion(turning);
      }
      hand(c, side, wrist, palm, fingers, torso, chest, clav, shielding);
    }
    // A quick muzzle kick, a heavy settling barrel and two slow re-lays.
    const relay = c.since > 1.5 && c.since < 2.4 ? Math.sin((c.since - 1.5) / 0.9 * Math.PI * 2) * 0.025 : 0;
    c.want('extra', a * (0.13 + relay) + hit * 0.25);
    p.headY = shield * 0.30 - sight * 0.15 + scan * 0.35 + flinch * 0.13;
    p.headX = shield * 0.05 - hit * 0.10 + sight * 0.12 - flinch * 0.065;
    c.want('head', -p.headX, p.headY, 0);
    c.want('neck', -shield * 0.025, -flinch * 0.035, 0);
    c.want('hat', cosmetic * clamp(c.accel * 0.004 + c.vertical * 0.003, 0.025) + hit * 0.045 + landing * 0.035 + flinch * 0.030,
      0, cosmetic * clamp(-c.turn * 0.009 - c.lateral * 0.005, 0.045));
    c.want('hair', cosmetic * clamp(c.accel * 0.006, 0.025), 0, cosmetic * clamp(-c.turn * 0.015, 0.03));
    // Travel is in world units; recoil rolls the wheels backwards too.
    c.want('wheels', -(c.travel + p.lunge * c.size) / (WHEEL_R * FIGURE_SCALE * c.size));
  },
};
