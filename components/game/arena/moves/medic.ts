import type { Moves } from './types';
import { Euler, Quaternion } from 'three';

const ease = (t: number) => t * t * (3 - 2 * t);
const out3 = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const span = (t: number, a: number, b: number) =>
  ease(clamp01((t - a) / 0.35)) * (1 - ease(clamp01((t - b) / 0.4)));

/** 0..1 through a heal pulse: the engine resets `sinceHit` on each one, so
 *  `since` restarts at every pulse, walking or standing. Up fast, a short
 *  hold, then down. */
function pulse(since: number) {
  if (since < 0.075) return 0.35 + out3(clamp01(since / 0.075)) * 0.65;
  if (since < 0.18) return 1;
  if (since < 0.65) return 1 - ease((since - 0.18) / 0.47);
  return 0;
}

const ARM_SWING = 0.28;
/** How much of each thigh's swing its skirt half follows. */
const SKIRT = 0.64;

const gripFrame = new Quaternion();
const gripLink = new Quaternion();
const gripAngles = new Euler();
const wristAngles = new Euler();

/** Keep the complete tonic hold within her shoulders before she reaches
 * nearby stone. This changes her carriage, never the engine clearance. */
export function medicStoneGuard(gap: number, size: number) {
  return ease(clamp01((2.6 * size - gap) / (1.3 * size)));
}

/** The Medic: a brisk, upright walk with the flask held before her, and a
 *  quick lift of the glowing flask over her head on every heal pulse. */
export const medic: Moves = {
  style: {
    gait: 'brisk',
    armSwing: ARM_SWING,
    lean: 0.05,
    attack: 'custom',
    windup: 0.3,
    lunge: 0,
    snap: 28,
  },
  carriage: {
    twist: 0.09,
    hips: 0.08,
    chestRoll: -0.65,
    nod: 0.01,
    armOut: 0,
    bounce: 0.012,
    weaponArm: 0.3,
  },
  stiff: {
    armR: 1.3,
    foreR: 1.3,
    handR: 1.3,
    weapon: 1.3,
    hat: 0.55,
    hair: 0.48,
    skirtL: 0.6,
    skirtR: 0.6,
  },
  damping: {
    armR: 0.95,
    foreR: 0.95,
    handR: 0.95,
    weapon: 0.95,
    hat: 0.52,
    hair: 0.46,
    skirtL: 0.46,
    skirtR: 0.46,
  },
  arrive(d) {
    const fall = clamp01(d / 0.32);
    const land = clamp01((d - 0.32) / 0.23);
    return {
      drop: d < 0.32 ? 2 * (1 - fall * fall) : 0,
      squash: 1 - Math.sin(land * Math.PI) * 0.06,
      twirl: 0,
    };
  },
  pose(c, p) {
    const stone = clamp01(c.memo.medicStoneGuard ?? 0);
    const preparing =
      c.unit.cooldown > 0 && c.unit.cooldown < 0.18
        ? ease(clamp01(1 - c.unit.cooldown / 0.18)) * 0.35
        : 0;
    const k = Math.max(pulse(c.since), preparing);
    const idle = c.reduced ? 0 : c.idle * (1 - k);
    p.headX *= 1 - c.idle;
    p.headY *= 1 - c.idle;
    p.roll *= 1 - c.idle;
    const weight =
      Math.sin(c.t * 0.58 + c.unit.id * 0.37) *
      idle *
      ease(clamp01(c.idleFor / 1.1)) *
      (1 - stone);
    p.roll += weight * 0.009;
    p.torsoZ -= weight * 0.007;
    p.torsoX += Math.sin(c.t * 1.8) * 0.008 * idle;

    // The flask arm barely swings as she walks, the flask kept level.
    p.armR -= c.swingR * 0.86;
    const bob = Math.sin(c.t * 1.7) * 0.014 * idle;
    p.armR += bob;
    let fore = -bob * 0.5;
    // Between pulses she checks the flask at eye level, then settles her
    // satchel strap with the free hand. Both gestures stay on planted feet.
    const lap = (c.idleFor + c.unit.id * 0.61) % 8.7;
    const awake = ease(clamp01(c.idleFor - 1)) * idle;
    const inspect = span(lap, 1.5, 3.1) * awake * (1 - stone * 0.8);
    const strap = span(lap, 5.4, 6.5) * awake;
    p.armR += inspect * 0.42;
    fore -= inspect * 0.18;
    p.headX += inspect * 0.14;
    p.headY -= inspect * 0.16;
    p.armL += strap * 0.45;
    p.armLz -= strap * 0.08;
    // The free arm hangs against her side, elbow soft, rather than held out
    // from the tunic (9 October: it read as a stiff A-pose).
    p.armLz += 0.13 * (1 - strap) * (1 - stone);
    c.want(
      'foreL',
      0.16 + c.walk * 0.08 * (1 + c.fwdR) + strap * 0.55 + k * 0.12,
    );

    // The pulse: flask up and forward over her head, upright in the fist,
    // her chin lifting after it, a small rise onto her toes.
    p.armR += k * (1.55 + stone * 0.2);
    p.armRz += k * 0.14;
    fore -= k * (0.66 + stone * 0.24);
    // At stone the elbow folds in and the lift travels above her shoulder.
    // The wrist below levels the entire grip after this shorter arc.
    p.armR += stone * k * 0.4;
    p.armRz -= stone * (0.45 + k * 0.2);
    fore += stone * (0.9 - k * 0.3);
    c.want('foreR', fore);
    p.headX -= k * 0.16;
    p.torsoX -= k * 0.05;
    p.armL += k * 0.12;
    p.armLz -= k * 0.1;
    // Give the relaxed free fingertips clearance past dressed stone edges.
    p.armLz += stone * 0.035;
    p.lean -= k * 0.03;
    // The pulse reads in her arm and shoulders, without a hop each second.
    p.torsoY += k * 0.08;
    p.headY -= k * 0.08;
    const hit = c.flinch * c.flinch;
    p.torsoX += hit * 0.06;
    p.torsoZ -= hit * 0.07;
    p.headX -= hit * 0.06;
    p.armL += hit * 0.12;
    // The wrist levels the complete grip: hand and tonic move together.
    // Invert the actual ordered body/chest/shoulder/elbow frames. Adding
    // their pitches cannot cancel the shoulder roll during a close heal.
    // The body's facing remains free, so the emblem still faces with her.
    gripFrame.setFromEuler(gripAngles.set(-p.lean, 0, p.roll, 'YXZ'));
    gripFrame.multiply(
      gripLink.setFromEuler(
        gripAngles.set(-p.torsoX, p.torsoY, p.torsoZ, 'XYZ'),
      ),
    );
    gripFrame.multiply(
      gripLink.setFromEuler(gripAngles.set(p.armR, 0, p.armRz, 'XYZ')),
    );
    gripFrame.multiply(
      gripLink.setFromEuler(gripAngles.set(fore, 0, 0, 'XYZ')),
    );
    wristAngles.setFromQuaternion(gripFrame.invert(), 'XYZ');
    c.want('handR', wristAngles.x, wristAngles.y, wristAngles.z);
    p.weapon = 0;

    const soft = c.reduced ? 0.25 : 1;
    const ahead = clamp(c.accel * 0.016, 0.18) * soft;
    const across = clamp(c.lateral * 0.018, 0.18) * soft;
    const turn = clamp(c.turn * 0.05, 0.2) * soft;
    const land = Math.pow(1 - c.pass, 4) * c.walk;
    const hang = p.torsoX + p.lean * 0.55;
    c.want(
      'skirtL',
      c.hipL * SKIRT + hang - ahead,
      -p.torsoY * 0.8,
      -land * 0.04 - across + turn,
    );
    c.want(
      'skirtR',
      c.hipR * SKIRT + hang - ahead,
      -p.torsoY * 0.8,
      land * 0.04 - across + turn,
    );
    c.want(
      'hat',
      clamp(-ahead * 0.2 + land * 0.025 + hit * 0.035, 0.05),
      0,
      clamp(-across * 0.15 + turn * 0.12, 0.04),
    );
    c.want(
      'hair',
      clamp(-ahead * 0.4 + land * 0.035 + hit * 0.06, 0.1),
      0,
      clamp(-across * 0.4 + turn * 0.35, 0.1),
    );
  },
};
