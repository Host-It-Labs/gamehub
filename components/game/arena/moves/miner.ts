import type { Moves } from './types';

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const ease = (t: number) => t * t * (3 - 2 * t);
const out3 = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const span = (t: number, a: number, b: number) =>
  ease(clamp01((t - a) / 0.3)) * (1 - ease(clamp01((t - b) / 0.4)));

const ARM_SWING = 0.4;
/** While he digs he lies flat just under the field, so the x-ray shows a
 *  churning patch where he will come up; he rises from DEPTH (world
 *  units), below which the whole figure is hidden. */
const DIG = 0.35;
const DEPTH = 2.4;
/** Through the deployment (0..1): digging until RISE, bursting up to a
 *  hop until TOP, then landing. */
const RISE = 0.72;
const TOP = 0.86;

/** The right arm's three joints (upper arm, elbow, pick in the fist) and
 *  the left arm, at the ready (pick up in front), wound up (pick behind
 *  his head) and on the strike (pick down in front). Each turns about x,
 *  so the pick stays in the arm's plane, clear of his hat. */
const READY = { arm: 0.9, fore: -1.2, pick: -0.5, left: 0.4 };
const WOUND = { arm: 2.6, fore: -0.8, pick: -0.35, left: 1.2 };
const STRUCK = { arm: 1.05, fore: -2.2, pick: -0.75, left: 0.3 };

/** The Miner: a quick, bouncy trot with the pick on his shoulder. He digs
 *  wherever he is played, bursts up out of the ground with a spin and
 *  swings the pick overhead, down into whatever is in front of him. */
export const miner: Moves = {
  style: {
    // A quick, bouncy trot under the pick.
    gait: { like: 'light', weight: 0.25, stride: 0.6, sway: 0.34 },
    armSwing: ARM_SWING,
    lean: 0.06,
    attack: 'custom',
    windup: 0.35,
    lunge: 0.12,
    snap: 30,
  },
  carriage: {
    twist: 0.12,
    hips: 0.08,
    chestRoll: -0.45,
    nod: 0.012,
    armOut: 0.08,
    bounce: 0.014,
    weaponArm: 0,
  },
  stiff: { hat: 0.6, weapon: 0.85, foreR: 1.15 },
  damping: { hat: 0.5, weapon: 0.54 },
  arrive(d) {
    if (d < RISE) return { drop: -DIG, squash: 0.05, twirl: d * 9 };
    if (d < TOP) {
      // Up through the ground like a drill, stretched tall.
      const k = (d - RISE) / (TOP - RISE);
      return {
        drop: -DEPTH + (DEPTH + 0.45) * out3(k),
        squash: 1.14,
        twirl: -(1 - out3(k)) * Math.PI * 3,
      };
    }
    // Down onto his boots with a squash.
    const fall = clamp01((d - TOP) / 0.08);
    const land = clamp01((d - TOP - 0.08) / 0.06);
    return {
      drop: 0.45 * (1 - fall * fall),
      squash: 1.08 - fall * 0.08 - Math.sin(land * Math.PI) * 0.2,
      twirl: 0,
    };
  },
  pose(c, p) {
    const idle = c.reduced ? 0 : c.idle;
    const land = Math.pow(1 - c.pass, 4) * c.walk;
    // The pick rides on his shoulder: the right arm does not swing, the
    // pick just bounces with his step.
    p.armR -= c.swingR;
    p.armR -= land * 0.025;
    p.armR += Math.sin(c.t * 2.1) * 0.02 * idle;
    p.torsoX += Math.sin(c.t * 1.8) * 0.012 * idle;
    const lap = (c.idleFor + c.unit.id * 0.63) % 8.4;
    const awake = ease(clamp01(c.idleFor - 1)) * idle;
    const brim = span(lap, 2.0, 3.2) * awake;
    const look = span(lap, 5.6, 6.4) * awake;
    p.armL += brim * 1.3;
    p.armLz -= brim * 0.2;
    p.headX += brim * 0.08 + look * 0.16;
    p.headY -= look * 0.36;

    // Popping out of the ground: arms flung up, the pick held high.
    const up =
      c.deploy < 1
        ? ease(clamp01((c.deploy - RISE) / 0.1)) *
          (1 - ease(clamp01((c.deploy - 0.9) / 0.1)))
        : 0;
    p.armL += up * 2.3;
    p.armLz -= up * 0.3;
    p.armR += up * 0.5;

    // The swing: take the pick off the shoulder to the ready, wind it back
    // over the head leaning back, then bring it down hard in front,
    // bending into the blow.
    const a = c.aim;
    let w = c.wind;
    let s = 0;
    if (c.since < 0.075) {
      s = out3(clamp01(c.since / 0.075));
      w = 1 - s;
    } else if (c.since < 0.25) {
      s = 1;
      w = 0;
    } else if (c.since < 0.62) {
      s = 1 - ease((c.since - 0.25) / 0.37);
      w = 0;
    }
    const mix = (k: keyof typeof READY) =>
      a * (READY[k] + w * (WOUND[k] - READY[k]) + s * (STRUCK[k] - READY[k]));
    p.armR += mix('arm');
    p.armRz += a * w * 0.12;
    c.want('foreR', mix('fore') + land * 0.025);
    p.weapon += mix('pick');
    p.armL += mix('left');
    p.torsoX += a * (-w * 0.14 + s * 0.32);
    // The pick hangs off his right shoulder; the chest turns it in toward
    // the middle for the blow.
    p.torsoY += a * (-w * 0.15 + s * 0.2);
    p.headX += a * (-w * 0.1 - s * 0.15);
    p.lean += -w * 0.04 + s * 0.1;
    p.lunge += s * 0.12;
    p.squash *= 1 - s * 0.05;
    c.want(
      'foreL',
      a * (w * 0.4 + s * 0.12) + brim * 1.0 + c.walk * 0.1 * (1 + c.fwdR),
    );

    const hit = c.flinch * c.flinch;
    p.torsoZ += hit * 0.1;
    p.headY -= hit * 0.12;
    p.armL += hit * 0.2;
    p.lunge -= hit * 0.06;
    const landing = Math.sin(clamp01((c.deploy - 0.93) / 0.07) * Math.PI);
    p.torsoX += landing * 0.16;
    p.headX -= landing * 0.08;
    const soft = c.reduced ? 0.25 : 1;
    const ahead = clamp(c.accel * 0.02, 0.2) * soft;
    const across = clamp(c.lateral * 0.02, 0.2) * soft;
    const turn = clamp(c.turn * 0.05, 0.2) * soft;
    c.want(
      'hat',
      clamp(-ahead * 0.18 - land * 0.025 + hit * 0.045 + landing * 0.04, 0.07),
      0,
      clamp(-across * 0.2 + turn * 0.15, 0.045),
    );
  },
};
