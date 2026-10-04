import type { Moves } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

/** A pilot flying under thrust, rather than walking in mid-air: trailing
 * legs, counterbalanced arms, turns banked into and acceleration leaned
 * into. The antenna and bob cut settle after every turn and ray shot. */
export const jetpack: Moves = {
  style: {
    attack: 'custom',
    windup: 0.15,
    lunge: 0,
    snap: 32,
    flyHeight: 1.95,
  },
  stiff: {
    antenna: 0.26,
    hair: 0.45,
    handL: 0.48,
    handR: 1,
    armR: 1,
    foreR: 1,
    weapon: 1,
    legL: 0.65,
    legR: 0.65,
  },
  damping: {
    antenna: 0.32,
    hair: 0.55,
    handL: 0.5,
    armR: 1,
    foreR: 1,
    handR: 1,
    weapon: 1,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const bob = Math.sin(c.t * 2.6) * cosmetic;
    const drift = Math.sin(c.t * 0.9) * cosmetic;
    const sway = Math.sin(c.t * 2.6 - 0.8) * 0.07 * cosmetic;
    const t = c.idleFor > 1.6 ? (c.idleFor + c.unit.id * 0.37) % 8.5 : -1;
    const wave = pulse(t, 2.5, 3.2, 4.6) * c.idle * cosmetic;
    const glance = pulse(t, 5.7, 6.3, 7.9) * c.idle * cosmetic;
    const start = c.deploy < 1 ? 1 - ease(c.deploy / 0.75) : 0;
    const surge = clamp(c.accel * 0.018, 0.13);
    const bank = clamp(-c.turn * 0.15, 0.25);
    const hit = c.strike * c.aim;
    const up = c.wind * c.aim;
    const recoil = pulse(c.since, 0.01, 0.08, 0.27) * c.aim;
    p.lift += (bob * 0.065 + drift * 0.035) * c.size;
    p.lean += c.walk * 0.18 + surge - recoil * 0.055;
    p.roll += bank + drift * 0.025 * c.idle;
    p.torsoX -= c.walk * 0.045;
    p.headX -= c.walk * 0.1 + surge * 0.5;
    p.headY += clamp(c.turn * 0.12, 0.22) + glance * 0.38;
    const trail = c.walk * 0.23 + surge * 0.7 + start * 0.12;
    c.want('legL', 0.3 - trail + sway, 0, -0.045 - bank * 0.3);
    c.want('kneeL', -0.68 - trail * 0.45);
    c.want('footL', 0.33 + sway * 0.3);
    c.want('legR', 0.09 - trail - sway, 0, 0.045 - bank * 0.3);
    c.want('kneeR', -0.44 - trail * 0.45);
    c.want('footR', 0.28 - sway * 0.3);
    p.armL += -0.18 + wave * 1.25 + c.flinch * 0.16;
    p.armLz -= 0.3 + bank * 0.3 + bob * 0.025 + wave * 0.25;
    c.want('foreL', -wave * 0.6 - c.walk * 0.1);
    c.want('handL', 0, Math.sin(c.t * 8) * wave * 0.15);

    // Raise the whole gripping hand, then counter-pitch the wrist to keep
    // the ray gun aimed forwards; the shot kicks the muzzle by 0.1 radians.
    const arm = c.aim * 0.63 + hit * 0.08 + c.flinch * 0.12;
    const fore = -c.aim * 0.12 - hit * 0.05;
    c.want('armR', arm, 0, 0.025 * (1 - c.aim));
    c.want('foreR', fore);
    c.want('handR', -arm - fore + hit * 0.1 - up * 0.01);
    p.weapon = 0;
    p.torsoY += c.aim * 0.12;
    p.lunge -= recoil * 0.055;
    p.torsoZ += c.flinch * 0.07;
    p.headX -= c.flinch * 0.08;
    c.want(
      'antenna',
      clamp(-c.accel * 0.04 + c.vertical * 0.02, 0.3) +
        hit * 0.13 +
        c.flinch * 0.2,
      clamp(-c.turn * 0.13, 0.28),
      clamp(-c.lateral * 0.045, 0.28),
    );
    // The hair stays within the glass bubble's clearance.
    c.want(
      'hair',
      clamp(-c.accel * 0.007, 0.025) + hit * 0.02,
      clamp(-c.turn * 0.035, 0.05),
      clamp(-c.lateral * 0.008, 0.035),
    );
    c.want(
      'extra',
      Math.sin(c.t * 41) * 0.035 * cosmetic + start * 0.06,
      0,
      Math.sin(c.t * 29) * 0.035 * cosmetic + bank * 0.1,
    );
  },
  arrive(d) {
    // Fires upward from below cruising height, then catches the hover.
    return {
      drop: -1.1 * (1 - ease(d / 0.68)) + pulse(d, 0.5, 0.69, 0.95) * 0.15,
      squash: 1,
      twirl: (1 - ease(d / 0.72)) * 0.4,
    };
  },
};
