import type { Moves } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, start: number, peak: number, end: number) =>
  ease((t - start) / (peak - start)) *
  (1 - ease((t - peak) / (end - peak)));

/** A honeybee has flight muscles, a watchful head and a heavy abdomen.
 * Wings beat at their forward hinges; the abdomen folds beneath the head
 * for the sting, rather than treating a nose-first bump as the attack. */
export const bee: Moves = {
  style: {
    attack: 'custom',
    windup: 0.12,
    lunge: 0.2,
    snap: 70,
    flyHeight: 1.25,
    bob: 0,
    sway: 0,
    armSwing: 0,
    lean: 0,
  },
  carriage: {
    twist: 0,
    hips: 0,
    chestRoll: 0,
    nod: 0,
    armOut: 0,
    bounce: 0,
    weaponArm: 0,
  },
  // Fast functional wingbeats follow the flight-muscle target directly.
  // Slow cloth-like springs would erase them and waste work on the swarm.
  stiff: {
    wingL: 0,
    wingR: 0,
    head: 0.7,
    tail: 2.2,
    tail2: 1.05,
    antenna: 0.24,
    armL: 0.55,
    armR: 0.55,
    extra: 0.42,
    extra2: 0.42,
  },
  damping: {
    head: 0.9,
    tail: 1,
    tail2: 0.92,
    antenna: 0.44,
    armL: 0.78,
    armR: 0.78,
    extra: 0.72,
    extra2: 0.72,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const wind = c.wind * c.aim;
    // Begin the dart on the engine hit itself; the shared strike curve
    // supplies its brief follow-through after contact.
    const contact = c.since < 0.11 ? 1 - ease(c.since / 0.11) : 0;
    const hit = Math.max(c.strike, contact) * c.aim;
    const follow = pulse(c.since, 0.025, 0.085, 0.23) * c.aim;
    const settle = pulse(c.since, 0.13, 0.22, 0.37) * c.aim;
    const breathe = Math.sin(c.t * 3.4) * cosmetic;
    const fidget =
      c.idleFor > 1.8
        ? pulse((c.idleFor - 1.8) % 5.1, 0, 0.17, 0.48) * cosmetic * c.idle
        : 0;

    const buzz = Math.sin(c.t * 72);
    const amplitude = c.reduced ? 0.2 : 0.65 + c.walk * 0.09 + wind * 0.05;
    const beat = buzz * amplitude;
    const sweep = c.walk * 0.035 + wind * 0.04 - hit * 0.02;
    // Local Z is the forward hinge after Blender's +Y -> Three's -Z.
    c.want('wingL', sweep, 0, -0.19 - beat);
    c.want('wingR', sweep, 0, 0.19 + beat);

    p.lift +=
      (breathe * 0.009 + Math.sin(c.t * 1.7) * 0.007 * cosmetic) * c.size;
    p.lift += (wind * 0.018 - hit * 0.012 + settle * 0.006) * c.size;
    p.lean =
      c.walk * 0.11 + clamp(c.accel * 0.008, 0.095) -
      wind * 0.075 - hit * 0.18 + settle * 0.025;
    p.roll =
      clamp(c.turn * 0.13, 0.3) +
      Math.sin(c.t * 2.2) * 0.025 * cosmetic * (1 - c.aim) +
      c.flinch * 0.17;
    p.yawKick = fidget * 0.075 + clamp(c.lateral * 0.004, 0.045);
    p.lunge += -wind * 0.024 + hit * 0.14 - settle * 0.013 - c.flinch * 0.024;
    p.torsoX = -breathe * 0.007 + wind * 0.03 - hit * 0.075 + c.flinch * 0.04;
    p.torsoY = clamp(-c.turn * 0.04, 0.075);
    p.torsoZ = clamp(-c.lateral * 0.005, 0.045);
    p.headX = -p.lean * 0.5 + wind * 0.025 - c.flinch * 0.10;
    p.headY = clamp(c.turn * 0.12, 0.18) + fidget * 0.11;

    // The whole abdomen curls around its narrow thorax attachment. The
    // tiny stinger finishes the arc, then both settle without a second jab.
    c.want(
      'tail',
      wind * 1.65 + hit * 2.5 + follow * 0.075 - settle * 0.035 +
        c.walk * 0.045 + c.flinch * 0.12,
      clamp(-c.turn * 0.055, 0.11),
      clamp(-c.lateral * 0.007, 0.06),
    );
    c.want('tail2', wind * 0.02 + hit * 0.025 + follow * 0.015);

    const legTuck = wind * 0.15 + hit * 0.28 + follow * 0.08;
    const legLag = clamp(-c.accel * 0.009, 0.075);
    const legOpen = wind * 0.16 + hit * 0.42 + follow * 0.08;
    c.want('armL', legLag + legTuck + fidget * 0.09, 0, -legOpen);
    c.want('armR', legLag + legTuck - fidget * 0.035, 0, legOpen);
    const rearTuck = legLag * 0.7 + legTuck * 0.65 + c.flinch * 0.12;
    c.want('extra', rearTuck, 0, legOpen);
    c.want('extra2', rearTuck, 0, -legOpen);
    c.want(
      'antenna',
      clamp(-c.accel * 0.02 + c.vertical * 0.005, 0.15) -
        wind * 0.035 + hit * 0.13 + c.flinch * 0.18 + fidget * 0.08,
      clamp(-c.turn * 0.075, 0.15),
      clamp(-c.lateral * 0.016, 0.15),
    );
  },
  arrive(d) {
    const emerge = ease(d / 0.72);
    return {
      drop: -0.18 * (1 - emerge) + Math.sin(Math.PI * d) * 0.018,
      squash: 1,
      twirl: 0.055 * (1 - ease(d / 0.8)),
    };
  },
};
