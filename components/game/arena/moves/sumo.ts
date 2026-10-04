import type { Moves } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

/** A broad planted roll, a breathing belly, two open palms. Each slap
 * coils from its own hip, drives through and recovers before switching. */
export const sumo: Moves = {
  style: {
    gait: { like: 'heavy', stride: 0.5, arms: 0.16, width: 1.15, weight: 0.95 },
    attack: 'custom',
    windup: 0.38,
    lunge: 0.32,
    snap: 25,
    heavy: true,
  },
  carriage: {
    twist: 0.15,
    hips: 0.1,
    chestRoll: 0.25,
    nod: 0.025,
    armOut: 0.14,
    bounce: 0,
    weaponArm: 1,
  },
  stiff: { hair: 0.45, extra: 0.3, handL: 1, handR: 1 },
  damping: { hair: 0.42, extra: 0.38, handL: 0.85, handR: 0.85 },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const breath = Math.sin(c.t * 1.25) * c.idle * cosmetic;
    const idleTime = c.idleFor > 1.3 ? (c.idleFor + c.unit.id * 0.43) % 8 : -1;
    const stretch = pulse(idleTime, 2.5, 3.1, 4.6) * c.idle * cosmetic;
    const palms = pulse(idleTime, 5.6, 6.1, 7.2) * c.idle * cosmetic;
    // Hits increments on impact. Anticipation belongs to that upcoming
    // hand, avoiding a hand swap on the blow.
    const right = (c.hits + (c.wind > 0 ? 1 : 0)) % 2 === 1;
    const side = right ? 1 : -1;
    const up = ease(c.wind) * c.aim;
    const hit = c.strike * c.aim;
    const follow = pulse(c.since, 0.03, 0.13, 0.5) * c.aim;
    const thrust = 0.3 * c.aim - up * 0.22 + hit * 1.16 + follow * 0.12;
    const bend = -0.4 * c.aim - up * 0.85 + hit * 1.08;
    const wrist = 0.2 * c.aim + hit * 0.78;
    p.armLz -= 0.12 + stretch * 0.36;
    p.armRz += 0.12 + stretch * 0.36;
    p.armL += right ? c.aim * 0.25 + palms * 0.2 : thrust + palms * 0.2;
    p.armR += right ? thrust + palms * 0.2 : c.aim * 0.25 + palms * 0.2;
    c.want('foreL', (right ? -c.aim * 0.75 : bend) - palms * 0.4 - 0.08);
    c.want('foreR', (right ? bend : -c.aim * 0.75) - palms * 0.4 - 0.08);
    c.want(
      'handL',
      (right ? 0 : wrist) - palms * 0.25,
      right ? 0 : wrist * 0.8,
      -stretch * 0.12,
    );
    c.want(
      'handR',
      (right ? wrist : 0) - palms * 0.25,
      right ? -wrist * 0.8 : 0,
      stretch * 0.12,
    );
    p.torsoY += side * (up * 0.27 - hit * 0.34 - follow * 0.06);
    p.torsoX += c.aim * 0.08 + hit * 0.16 + breath * 0.016 - stretch * 0.04;
    p.headX -= c.aim * 0.1 + stretch * 0.1;
    p.headY += side * up * 0.13 - c.flinch * 0.2;
    p.lunge += hit * 0.15;
    p.squash *= 1 + breath * 0.008 - hit * 0.04;
    p.torsoZ += c.flinch * 0.1;
    c.want(
      'hair',
      clamp(-c.accel * 0.018 + c.vertical * 0.008, 0.1) + c.flinch * 0.15,
      clamp(-c.turn * 0.07, 0.12),
      clamp(-c.lateral * 0.02, 0.12),
    );
    c.want(
      'extra',
      clamp(-c.accel * 0.035, 0.22) + hit * 0.16 + c.flinch * 0.12,
      clamp(-c.turn * 0.09, 0.24),
      clamp(-c.lateral * 0.025, 0.22),
    );
    // Only the landing stomp takes a foot away from the planted solver.
    if (c.deploy < 1) {
      const raise = Math.sin(clamp01((c.deploy - 0.35) / 0.4) * Math.PI);
      c.want('legL', raise * 0.35, 0, -raise * 0.75);
      c.want('kneeL', -raise * 0.7);
      p.torsoZ += raise * 0.2;
      p.roll += raise * 0.1;
      p.armLz -= raise * 0.5;
      p.armRz += raise * 0.5;
    }
  },
  arrive(d) {
    const fall = clamp01(d / 0.3);
    const land = pulse(d, 0.3, 0.36, 0.46);
    const stamp = pulse(d, 0.72, 0.76, 0.84);
    return {
      drop: (1 - fall * fall) * 2.6 + pulse(d, 0.35, 0.43, 0.54) * 0.12,
      squash: 1 - land * 0.22 - stamp * 0.1,
      twirl: 0,
    };
  },
};
