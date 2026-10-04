import type { Moves } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));
/** Stick tip comes down quickly, rebounds, then returns to the high point. */
function stroke(u: number) {
  const x = ((u % 1) + 1) % 1;
  return x < 0.18 ? 1 - ease(x / 0.18) : ease((x - 0.18) / 0.58);
}

/** A crisp parade march. The wrists drive alternating strokes and carry
 * their sticks; the suspended drum, short tails and pompom follow the
 * actual steps, acceleration and beat instead of moving as one block. */
export const drummer: Moves = {
  style: {
    gait: { like: 'march', stride: 0.6, arms: 0.05, twist: 0.06 },
    attack: 'custom',
    windup: 0.2,
    lunge: 0,
    snap: 40,
  },
  carriage: {
    twist: 0.06,
    hips: 0.05,
    chestRoll: 0.25,
    nod: 0.02,
    armOut: 0,
    bounce: 0,
    weaponArm: 0,
  },
  stiff: {
    handL: 1.2,
    handR: 1.2,
    extra: 0.45,
    hat: 0.42,
    antenna: 0.25,
    skirtL: 0.4,
    skirtR: 0.4,
  },
  damping: {
    handL: 0.9,
    handR: 0.9,
    extra: 0.5,
    hat: 0.45,
    antenna: 0.3,
    skirtL: 0.42,
    skirtR: 0.42,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const active = c.reduced ? (c.since < 0.18 ? 1 : 0) : 1;
    const accent = Math.max(0, 1 - c.since / 0.12);
    const u = c.since / 0.5;
    const r = stroke(u * 2) * (1 + accent * 0.6) * active;
    const l = stroke(u * 2 + 0.5) * active;
    const t = c.idleFor > 1.7 ? (c.idleFor + c.unit.id * 0.29) % 8 : -1;
    const listen = pulse(t, 2, 2.7, 4) * c.idle * cosmetic;
    const flourish = pulse(t, 5.1, 5.7, 7.1) * c.idle * cosmetic;
    const land = c.deploy < 1 ? pulse(c.deploy, 0.3, 0.52, 0.9) : 0;
    p.armL -= c.swingL;
    p.armR -= c.swingR;
    p.armR += r * 0.05 + flourish * 0.1 + land * 0.05;
    p.armL += l * 0.045 + flourish * 0.1;
    c.want('foreR', r * 0.27);
    c.want('foreL', l * 0.25);
    c.want(
      'handR',
      r * 0.44 + flourish * 0.15,
      0,
      Math.sin(c.t * 13) * flourish * 0.08,
    );
    c.want('handL', l * 0.4 - flourish * 0.1);
    // Sticks stay fixed in the hands throughout every stroke.
    p.weapon = 0;
    p.offhand = 0;
    p.headX -= accent * 0.055;
    p.headY += listen * 0.35;
    p.torsoX += accent * 0.02 + Math.sin(c.t * 1.5) * 0.01 * c.idle * cosmetic;
    p.torsoZ += c.flinch * 0.08;
    const step = Math.cos((c.cycle - 0.15) * Math.PI * 4) * c.walk * cosmetic;
    const drift = clamp(-c.accel * 0.02, 0.13);
    const turn = clamp(-c.turn * 0.08, 0.16);
    c.want(
      'extra',
      step * 0.035 + drift - accent * 0.025,
      turn,
      clamp(-c.lateral * 0.025, 0.13) +
        Math.sin(c.cycle * Math.PI * 2) * 0.035 * c.walk * cosmetic,
    );
    c.want(
      'hat',
      step * 0.018 + clamp(-c.accel * 0.012, 0.06) + c.flinch * 0.06,
      turn * 0.3,
      clamp(-c.lateral * 0.012, 0.06),
    );
    c.want(
      'antenna',
      step * 0.05 +
        clamp(-c.accel * 0.03 + c.vertical * 0.02, 0.24) +
        accent * 0.1 +
        c.flinch * 0.2,
      turn,
      clamp(-c.lateral * 0.035, 0.24),
    );
    c.want('skirtL', -Math.max(0, c.hipL) * 0.35 + drift, turn);
    c.want('skirtR', -Math.max(0, c.hipR) * 0.35 + drift, turn);
  },
  arrive(d) {
    return {
      drop: (1 - ease(d / 0.28)) * 2 + pulse(d, 0.3, 0.44, 0.64) * 0.14,
      squash: 1 - pulse(d, 0.28, 0.35, 0.5) * 0.12,
      twirl: 0,
    };
  },
};
