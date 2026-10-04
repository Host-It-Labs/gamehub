import type { Moves } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

/** A steady walk carrying the nozzle. Both grips remain attached: the
 * shoulders turn together, and the elbows/wrists hold their sculpted
 * angles. Water pressure drives his whole stance back before it settles. */
export const firefighter: Moves = {
  style: {
    gait: { like: 'brisk', stride: 0.64, arms: 0.12, weight: 0.6 },
    twoHanded: true,
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
    bounce: 0.025,
    weaponArm: 1,
  },
  stiff: {
    armL: 1,
    armR: 1,
    foreL: 1,
    foreR: 1,
    handL: 1,
    handR: 1,
    weapon: 1,
    hat: 0.5,
    cape: 0.48,
    cape2: 0.35,
  },
  damping: {
    armL: 1,
    armR: 1,
    foreL: 1,
    foreR: 1,
    handL: 1,
    handR: 1,
    weapon: 1,
    hat: 0.6,
    cape: 0.6,
    cape2: 0.55,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const t = c.idleFor > 1.6 ? (c.idleFor + c.unit.id * 0.41) % 8 : -1;
    const check = pulse(t, 2, 2.8, 4.3) * c.idle * cosmetic;
    const survey = pulse(t, 5.1, 5.8, 7.3) * c.idle * cosmetic;
    const landing = c.deploy < 1 ? pulse(c.deploy, 0.3, 0.52, 0.95) : 0;
    const a = c.aim;
    const pressure = c.strike * a;
    const brace = ease(c.wind) * a;
    const recoil = pulse(c.since, 0.02, 0.1, 0.35) * a;
    const shudder = Math.sin(c.t * 34) * 0.012 * a * cosmetic;
    // The sculpt already carries the nozzle facing forward, 0.05 radians
    // above level. Cancel that small pitch instead of aiming at the sky.
    const lift =
      -a * 0.05 + pressure * 0.025 + shudder + check * 0.12 + landing * 0.05;
    p.armL += lift;
    p.armR += lift;
    // A shared shoulder turn is the exact rigid transform of both hands
    // around this two-hand tool. Independent elbow kicks break that hold.
    c.want('foreL', 0);
    c.want('foreR', 0);
    c.want('handL', 0);
    c.want('handR', 0);
    p.weapon = 0;
    p.torsoX += -a * 0.07 - pressure * 0.04 + brace * 0.025;
    p.torsoY += a * Math.sin(c.t * 1.6) * 0.045 * cosmetic;
    p.headX += a * 0.04 + check * 0.18 - pressure * 0.06;
    p.headY += survey * 0.38;
    p.lean -= recoil * 0.035;
    p.lunge -= a * 0.025 + pressure * 0.045;
    p.squash *= 1 - a * 0.015 - landing * 0.025;
    p.torsoZ += c.flinch * 0.09;
    const step = Math.cos((c.cycle - 0.14) * Math.PI * 4) * c.walk * cosmetic;
    c.want(
      'hat',
      step * 0.012 +
        clamp(-c.accel * 0.01 + c.vertical * 0.005, 0.04) +
        c.flinch * 0.045,
      clamp(-c.turn * 0.025, 0.06),
      clamp(-c.lateral * 0.012, 0.05),
    );
    // Two links keep the hose's mouth at the nozzle while the trailing
    // length counter-bends and drags behind it.
    c.want(
      'cape',
      -p.armR * 0.7 + clamp(-c.accel * 0.016, 0.08),
      clamp(-c.turn * 0.04, 0.12),
      clamp(-c.lateral * 0.013, 0.08),
    );
    c.want(
      'cape2',
      -p.armR * 0.3 + clamp(-c.accel * 0.024, 0.12),
      clamp(-c.turn * 0.09, 0.18),
      clamp(-c.lateral * 0.024, 0.15),
    );
  },
  arrive(d) {
    return {
      drop: (1 - ease(d / 0.3)) * 2.2 + pulse(d, 0.34, 0.46, 0.67) * 0.1,
      squash: 1 - pulse(d, 0.3, 0.36, 0.54) * 0.13,
      twirl: 0,
    };
  },
};
