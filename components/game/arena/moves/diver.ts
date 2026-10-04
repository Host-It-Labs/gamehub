import type { Moves } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

/** Lead boots plant heavily; the wrench and its gripping hand share one
 * wrist. The helmet steadies after each step, start, turn and impact. */
export const diver: Moves = {
  style: {
    gait: { like: 'heavy', stride: 0.56, arms: 0.28, width: 1.05, nod: 0.025 },
    attack: 'custom',
    windup: 0.55,
    lunge: 0.22,
    snap: 24,
    heavy: true,
  },
  carriage: {
    twist: 0.12,
    hips: 0.07,
    chestRoll: 0.25,
    nod: 0.025,
    armOut: 0.1,
    bounce: 0.035,
    weaponArm: 0.2,
  },
  stiff: { head: 0.52, foreL: 0.7, handL: 0.46, handR: 0.8, weapon: 1 },
  damping: { head: 0.7, foreL: 0.65, handL: 0.46, handR: 0.8, weapon: 1 },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const step = Math.cos((c.cycle - 0.13) * Math.PI * 4) * c.walk;
    const breath = Math.sin(c.t * 1.3) * c.idle * cosmetic;
    const idleTime =
      c.idleFor > 1.5 ? (c.idleFor + c.unit.id * 0.31) % 8.5 : -1;
    const inspect = pulse(idleTime, 2, 2.8, 4.2) * c.idle * cosmetic;
    const shoulder = pulse(idleTime, 5.5, 6.1, 7.2) * c.idle * cosmetic;
    const land = c.deploy < 1 ? pulse(c.deploy, 0.28, 0.55, 1) : 0;
    const up = ease(c.wind) * c.aim;
    const blow = c.strike * c.aim;
    const follow = pulse(c.since, 0.03, 0.14, 0.55) * c.aim;
    const hurt = c.flinch;

    // The free elbow trails the step. He rolls a shoulder or checks the
    // wrench while waiting, then counterbalances its long overhead swing.
    p.armR -= c.swingR * 0.7;
    p.armR +=
      up * 2.0 - blow * 1.35 - follow * 0.18 + inspect * 0.4 + land * 0.24;
    p.armRz += up * 0.12 + hurt * 0.1;
    p.armL += c.aim * 0.22 + up * 0.25 - blow * 0.18 + shoulder * 0.45;
    p.armLz -= c.aim * 0.18 + shoulder * 0.2;
    c.want('foreR', -up * 0.58 + blow * 0.22 - inspect * 0.3 + hurt * 0.16);
    c.want(
      'foreL',
      -c.walk * (0.08 + Math.max(0, c.fwdL) * 0.14) - shoulder * 0.4,
    );
    c.want(
      'handR',
      up * 0.22 +
        blow * 0.46 +
        follow * 0.13 -
        inspect * 0.12 +
        clamp(-c.accel * 0.018 + c.vertical * 0.008, 0.12),
      0,
      clamp(-c.lateral * 0.018 - c.turn * 0.04, 0.12) + hurt * 0.1,
    );
    c.want('handL', -0.03 * step * cosmetic, clamp(-c.turn * 0.08, 0.12));
    // The complete tool follows the fist, never rotating out of its grip.
    p.weapon = 0;
    p.torsoX +=
      breath * 0.014 -
      up * 0.16 +
      blow * 0.28 +
      follow * 0.08 -
      hurt * 0.09 +
      land * 0.05;
    p.torsoY += up * 0.25 - blow * 0.23 - shoulder * 0.15;
    p.headX +=
      -0.018 * step * cosmetic + inspect * 0.16 - blow * 0.08 - hurt * 0.06;
    p.headY += inspect * 0.18 - shoulder * 0.28 + clamp(c.turn * 0.08, 0.13);
    p.lean += -up * 0.025 + blow * 0.065;
    p.lunge += blow * 0.12;
    p.squash *= 1 + breath * 0.004 - blow * 0.045 - land * 0.04;
  },
  arrive(d) {
    const fall = ease(d / 0.28);
    const impact = pulse(d, 0.28, 0.35, 0.54);
    return {
      drop: (1 - fall) * 2.5 + pulse(d, 0.4, 0.58, 0.82) * 0.12,
      squash: 1 - impact * 0.17,
      twirl: 0,
    };
  },
};
