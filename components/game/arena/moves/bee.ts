import type { Moves } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

/** A tiny, purposeful flyer: clear head, eyes and antennae above a wing
 * blur, banks into its path, then curls the abdomen and darts to sting.
 * It emerges from the hive, rather than falling out of the sky. */
export const bee: Moves = {
  style: {
    attack: 'custom',
    windup: 0.12,
    lunge: 0.2,
    snap: 70,
    flyHeight: 1.25,
  },
  stiff: { wingL: 1.8, wingR: 1.8, antenna: 0.25, head: 0.5, tail: 0.65 },
  damping: { wingL: 0.9, wingR: 0.9, antenna: 0.32, tail: 0.55 },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const buzz = Math.sin(c.t * 60);
    // Wingbeats carry flight; the cosmetic sideways wander is optional.
    c.want('wingL', 0, 0.2, -0.35 - buzz * (c.reduced ? 0.2 : 0.6));
    c.want('wingR', 0, -0.2, 0.35 + buzz * (c.reduced ? 0.2 : 0.6));
    p.lift +=
      (Math.sin(c.t * 7.3) * 0.045 + Math.sin(c.t * 3.1) * 0.035) *
      c.size *
      cosmetic;
    p.roll +=
      Math.sin(c.t * 4.7) * 0.09 * cosmetic + clamp(-c.turn * 0.13, 0.32);
    p.yawKick += Math.sin(c.t * 2.9) * 0.13 * (1 - c.aim) * cosmetic;
    const wind = c.wind * c.aim;
    const hit = c.strike * c.aim;
    const recover = pulse(c.since, 0.02, 0.08, 0.3) * c.aim;
    p.lean +=
      c.walk * 0.08 + clamp(c.accel * 0.01, 0.1) - wind * 0.12 + hit * 0.34;
    p.lunge += hit * 0.12;
    p.torsoX += wind * 0.1 - recover * 0.08;
    p.headX -= wind * 0.1 + hit * 0.15;
    p.headY += clamp(c.turn * 0.13, 0.25);
    c.want(
      'tail',
      wind * 0.22 + hit * 0.4 - recover * 0.15,
      clamp(-c.turn * 0.1, 0.2),
    );
    c.want(
      'antenna',
      clamp(-c.accel * 0.04 + c.vertical * 0.015, 0.3) +
        hit * 0.13 +
        c.flinch * 0.22,
      clamp(-c.turn * 0.12, 0.25),
      clamp(-c.lateral * 0.04, 0.27),
    );
    p.roll += c.flinch * 0.17;
  },
  arrive(d) {
    return {
      drop: 0,
      squash: 0.2 + 0.8 * ease(d / 0.6),
      twirl: (1 - ease(d / 0.5)) * 0.18,
    };
  },
};
