/** B3 private draft; install together with the reviewed new sculpt only. */
import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { Moves } from '@/components/game/arena/moves/types';

const limit = (n: number, k: number) => Math.max(-k, Math.min(k, n));
const ease = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

// Native LEFT wrist paths, relative to the shoulder, Three axes. Each is
// reachable by the new 0.216 / 0.214 arm. Her palm is inward in the bind.
const REST: ArmGoal = { hand: [-0.022, -0.421, -0.063], pole: [-0.08, -1, 0.65], palm: [1, 0, 0] };
const READY: ArmGoal = { hand: [0.06, -0.20, -0.30], pole: [-0.5, -1, 0.40], palm: [0.8, 0.05, -0.3] };
const LOAD: ArmGoal = { hand: [-0.025, -0.25, -0.13], pole: [-0.4, -1, 0.7], palm: [0.9, 0, -0.25] };
const OPEN: ArmGoal = { hand: [-0.08, -0.10, -0.385], pole: [-0.7, -0.7, 0.1], palm: [0.8, 0.05, -0.4], fingers: [0.1, -0.5, -0.8] };
const WRAP: ArmGoal = { hand: [0.14, -0.12, -0.335], pole: [-0.6, -0.8, 0.1], palm: [0.9, 0, 0.25], fingers: [0.3, -0.6, -0.7] };
// The ordinary hit is a lineman's two-hand punch: hands cocked at the
// chest with the elbows tight, sink, then both heels of the hands drive
// out at chest height as the hips extend, and snap back to the cocked set.
const SET: ArmGoal = { hand: [0.07, -0.2, -0.17], pole: [-0.35, -1, 0.5], palm: [0.35, 0, -0.94], fingers: [0.1, 0.99, 0.04], forearmRoll: 0.6 };
const COCK: ArmGoal = { hand: [0.055, -0.215, -0.085], pole: [-0.3, -1, 0.85], palm: [0.35, 0, -0.94], fingers: [0.1, 0.99, 0.04], forearmRoll: 0.6 };
const PUNCH: ArmGoal = { hand: [0.085, -0.07, -0.385], pole: [-0.6, -1, 0.1], palm: [0.3, 0.05, -0.95], fingers: [0.05, 0.99, 0.06], forearmRoll: 0.6 };
const HAND: HandRest = { palm: [1, 0, 0] };

export const linebacker: Moves = {
  style: {
    gait: { like: 'brisk', stride: 0.69, cadence: 2.65, arms: 0.45, lean: 0.12, lift: 0.10, bounce: 0.019, width: 1.04, crouch: 0.025 },
    attack: 'custom', windup: 0.24, lunge: 0.42, snap: 34,
  },
  carriage: { twist: 0.16, hips: 0.09, chestRoll: 0.16, nod: 0.016, armOut: 0, bounce: 0, weaponArm: 1 },
  stiff: { foreL: 1, foreR: 1, handL: 1.05, handR: 1.05, hair: 0.32, sleeveL: 0.75, sleeveR: 0.75 },
  damping: { foreL: 0.82, foreR: 0.82, handL: 0.88, handR: 0.88, hair: 0.43, sleeveL: 0.75, sleeveR: 0.75 },
  pose(c, p) {
    // Preserve charge through the engine's hit, which clears unit.charged.
    if (c.memo.hit !== c.hits) {
      c.memo.hit = c.hits;
      c.memo.tackle = c.unit.charged || c.memo.charging === 1 ? 1 : 0;
    }
    c.memo.charging = c.unit.charged ? 1 : 0;
    const tackle = c.unit.charged || (c.memo.tackle === 1 && c.since < 0.6);
    const cosmetic = c.reduced ? 0 : 1;
    const breath = Math.sin(c.t * 1.7) * c.idle * cosmetic;
    const fidgetTime = c.idleFor > 1.8 ? (c.idleFor + c.unit.id * 0.39) % 8.7 : -1;
    const settle = pulse(fidgetTime, 2.8, 3.45, 4.9) * c.idle * cosmetic;
    const scan = pulse(fidgetTime, 5.8, 6.4, 7.9) * c.idle * cosmetic;
    const wind = ease(c.wind);
    const hit = c.strike;
    const through = pulse(c.since, 0, 0.055, 0.25);
    const wrap = pulse(c.since, 0.045, 0.14, 0.46);
    const land = c.deploy < 1 ? pulse(c.deploy, 0.29, 0.37, 0.64) : 0;
    const swing = (amount: number): ArmGoal => ({
      ...REST,
      hand: [REST.hand[0], REST.hand[1] + Math.abs(amount) * 0.022 + breath * 0.002,
        REST.hand[2] - amount * 0.17],
    });
    // Elbow and loose wrist lag the gait rather than rigidly following it.
    const rush = c.unit.charged ? c.walk * (1 - c.aim) : 0;
    let left = blend(swing(p.armL), c.unit.charged ? READY : SET, Math.max(c.aim, rush * 0.86, settle * 0.65));
    let right = blend(swing(p.armR), c.unit.charged ? READY : SET, Math.max(c.aim, rush * 0.86, settle * 0.65));
    // Run into the tackle with hips lowered and the pads leading. The bind
    // stays relaxed; the planted-leg solver absorbs this vertical offset.
    p.torsoX += rush * 0.21;
    p.headX -= rush * 0.14;
    p.lift -= c.size * rush * 0.061;
    p.lean += rush * 0.055;
    if (c.aim > 0.001) {
      let lead = blend(READY, LOAD, wind);
      if (tackle) {
        lead = blend(lead, OPEN, Math.max(hit, through));
        lead = blend(lead, WRAP, wrap * 0.88);
        left = blend(left, lead, c.aim);
        right = blend(right, { ...lead, hand: [lead.hand[0] + 0.012, lead.hand[1] - 0.018, lead.hand[2] + 0.008] }, c.aim);
        p.torsoX += c.aim * (0.48 + wind * 0.18 + hit * 0.32 + wrap * 0.10);
        p.torsoY += c.aim * (-wind * 0.20 + hit * 0.32 + wrap * 0.18);
        p.headX -= c.aim * (0.29 + hit * 0.16);
        p.lift -= c.size * c.aim * (0.105 + wind * 0.040 + hit * 0.018);
        p.lunge += c.aim * (hit * 0.26 + through * 0.08 - wind * 0.045);
        p.lean += hit * c.aim * 0.09;
        p.roll -= hit * c.aim * 0.035;
      } else {
        // Alternate which shoulder leads so repeated hits are not clones.
        const side = c.hits % 2 === 0 ? 1 : -1;
        const out = Math.max(hit, through * 0.85);
        const set = blend(SET, COCK, wind * (1 - hit));
        const shove = blend(set, PUNCH, out);
        const recoil = pulse(c.since, 0.2, 0.32, 0.6);
        const leadArm = blend(shove, SET, recoil * 0.5);
        const trail = { ...leadArm, hand: [leadArm.hand[0], leadArm.hand[1] - 0.01, leadArm.hand[2] + 0.03 * out] as const };
        left = blend(left, side > 0 ? leadArm : trail, c.aim);
        right = blend(right, side > 0 ? trail : leadArm, c.aim);
        // Sit low and loaded, then fire the hips up and through the hands.
        p.torsoX += c.aim * (0.5 + wind * 0.12 - hit * 0.04 + through * 0.1);
        p.torsoY += side * c.aim * (wind * 0.07 - hit * 0.12);
        p.headX -= c.aim * (0.34 + wind * 0.06 - hit * 0.08);
        p.lift -= c.size * c.aim * (0.1 + wind * 0.05 - hit * 0.04);
        p.lunge += c.aim * (hit * 0.17 + through * 0.06 - wind * 0.03);
        p.lean += c.aim * (hit * 0.06 - wind * 0.02);
        p.roll += side * c.aim * hit * 0.02;
        p.squash *= 1 - c.aim * (wind * 0.012 - hit * 0.008);
      }
    }
    // Absorb one landing with planted feet; the ground solver owns all legs.
    p.lift -= c.size * (land * 0.085 + settle * 0.012);
    p.torsoX += land * 0.12 + settle * 0.05 + breath * 0.010;
    p.headX -= land * 0.075;
    p.headY += scan * 0.36;
    p.roll += settle * 0.014;
    p.torsoY -= c.flinch * 0.15;
    p.torsoX -= c.flinch * 0.085;
    p.headX -= c.flinch * 0.11;
    p.squash *= 1 + breath * 0.003 - c.flinch * 0.013;
    left = blend(left, READY, c.flinch * 0.25);
    right = blend(right, READY, c.flinch * 0.25);
    reach(c, 'L', left, HAND);
    reach(c, 'R', right, HAND);
    c.want('hair', cosmetic * (limit(-c.accel * 0.030 + c.vertical * 0.014, 0.25) + hit * 0.17 + c.flinch * 0.20),
      cosmetic * limit(-c.turn * 0.15, 0.29), cosmetic * limit(-c.lateral * 0.034, 0.22));
    // Small pad recoil at the girdle. These are caps, not hanging sleeves.
    c.want('sleeveL', cosmetic * limit(-c.accel * 0.005, 0.035), 0, -Math.max(0, -p.armLz) * 0.12);
    c.want('sleeveR', cosmetic * limit(-c.accel * 0.005, 0.035), 0, Math.max(0, p.armRz) * 0.12);
  },
  arrive(d) {
    const fall = ease(d / 0.29);
    return { drop: (1 - fall * fall) * 2.3, squash: 1 - pulse(d, 0.29, 0.37, 0.60) * 0.035, twirl: 0 };
  },
};
