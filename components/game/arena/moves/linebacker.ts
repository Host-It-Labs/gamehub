import type { Moves } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

/** A fast, planted athlete. Her first contact is a shoulder tackle;
 * follow-up blows drive the forearms together. The ponytail trails her
 * acceleration and turns, and whips through a tackle or hit. */
export const linebacker: Moves = {
  style: {
    gait: { like: 'light', stride: 0.74, arms: 0.55, lean: 0.12, lift: 0.13 },
    attack: 'custom',
    windup: 0.24,
    lunge: 0.42,
    snap: 34,
  },
  carriage: {
    twist: 0.19,
    hips: 0.1,
    chestRoll: 0.1,
    nod: 0.015,
    armOut: 0.08,
    bounce: 0,
    weaponArm: 1,
  },
  stiff: { hair: 0.32, foreL: 0.9, foreR: 0.9, handL: 0.52, handR: 0.52 },
  damping: { hair: 0.34, handL: 0.5, handR: 0.5 },
  pose(c, p) {
    const m = c.memo;
    // A troop owns its tackle memory. Another player or a recycled unit
    // id cannot leave a stale entry in a global map.
    if (m.hit !== c.hits) {
      m.hit = c.hits;
      m.tackle = c.unit.charged || m.charging === 1 ? 1 : 0;
    }
    m.charging = c.unit.charged ? 1 : 0;
    const tackle = c.unit.charged || (m.tackle === 1 && c.since < 0.6);
    const a = c.aim;
    const up = ease(c.wind) * a;
    const hit = c.strike * a;
    const follow = pulse(c.since, 0.03, 0.15, 0.55) * a;
    const cosmetic = c.reduced ? 0 : 1;
    const t = c.idleFor > 1.5 ? (c.idleFor + c.unit.id * 0.39) % 7.5 : -1;
    const ready = pulse(t, 2, 2.7, 3.9) * c.idle * cosmetic;
    const scan = pulse(t, 4.6, 5.3, 6.9) * c.idle * cosmetic;
    const land = c.deploy < 1 ? pulse(c.deploy, 0.3, 0.52, 0.96) : 0;
    const elbows =
      c.walk * (0.08 + 0.22 * Math.max(0, Math.sin(c.cycle * Math.PI * 2)));
    p.torsoX += a * 0.32 + ready * 0.14 + land * 0.1;
    p.headX -= a * 0.22 + ready * 0.08;
    p.headY += scan * 0.45;
    p.lift -= a * 0.035 * c.size;
    p.armL += a * 0.35 + ready * 0.24;
    p.armR += a * 0.35 + ready * 0.24;
    let foreL = -a * 0.75 - ready * 0.3 - elbows;
    let foreR = -a * 0.75 - ready * 0.3 - (0.3 * c.walk - elbows);
    if (tackle) {
      p.torsoX += up * 0.12 + hit * 0.33 + follow * 0.1;
      p.torsoY += -up * 0.24 + hit * 0.4;
      p.armR += hit * 0.64;
      p.armRz += hit * 0.35;
      p.armL += hit * 0.75;
      p.armLz -= hit * 0.3;
      foreR -= hit * 0.25;
      foreL -= hit * 0.2;
      p.lean += hit * 0.16;
      p.lunge += hit * 0.28;
      p.headX -= hit * 0.12;
    } else {
      p.armL += -up * 0.16 + hit * 0.64;
      p.armR += -up * 0.16 + hit * 0.64;
      foreL += up * 0.2 + hit * 0.58;
      foreR += up * 0.2 + hit * 0.58;
      p.torsoX += hit * 0.1;
      p.lunge += hit * 0.1;
    }
    c.want('foreL', foreL);
    c.want('foreR', foreR);
    c.want('handL', clamp(-c.accel * 0.012, 0.12) + hit * 0.1);
    c.want('handR', clamp(-c.accel * 0.012, 0.12) + hit * 0.1);
    c.want(
      'hair',
      clamp(-c.accel * 0.04 + c.vertical * 0.016, 0.4) +
        hit * 0.3 +
        c.flinch * 0.32,
      clamp(-c.turn * 0.2, 0.38),
      clamp(-c.lateral * 0.04, 0.3),
    );
    p.torsoY -= c.flinch * 0.18;
    p.torsoX -= c.flinch * 0.08;
    p.squash *= 1 - a * 0.025 - hit * 0.035;
  },
  arrive(d) {
    const fall = ease(d / 0.26);
    return {
      drop: (1 - fall) * 2.3 + pulse(d, 0.3, 0.45, 0.64) * 0.2,
      squash: 1 - pulse(d, 0.26, 0.34, 0.5) * 0.16,
      twirl: (1 - ease(d / 0.45)) * -0.45,
    };
  },
};
