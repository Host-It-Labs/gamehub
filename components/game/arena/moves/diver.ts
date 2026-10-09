import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { Moves } from '@/components/game/arena/moves/types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));
// The loaded glove passes round the outside of the corselet. A straight
// interpolation through the shoulder would fold the elbow beyond 140°.
const around = (a: ArmGoal, b: ArmGoal, t: number): ArmGoal => {
  const goal = blend(a, b, t);
  return {
    ...goal,
    hand: [
      goal.hand[0] - Math.sin(t * Math.PI) * 0.14,
      goal.hand[1],
      goal.hand[2],
    ],
  };
};

// Left-arm coordinates; reach mirrors the right. The relaxed rig's
// wrist is 5.1 cm outside, 47.3 cm below and 7.7 cm ahead of its shoulder.
const REST: ArmGoal = {
  hand: [-0.051, -0.473, -0.077],
  pole: [-0.04, -0.246, -0.016],
  palm: [1, 0, 0],
};
const CARRY: ArmGoal = {
  ...REST,
  fingers: [0, -0.28, -0.96],
};
const READY: ArmGoal = {
  hand: [-0.085, -0.35, -0.25],
  pole: [-0.65, -1, 0.45],
  palm: [1, 0, 0],
  fingers: [0, -0.4, -0.9165],
};
const COIL: ArmGoal = {
  hand: [-0.1, 0.09, 0.19],
  pole: [-0.65, -0.35, 0.65],
  palm: [1, 0, 0],
  fingers: [0, 0.35, -0.9367],
};
const IMPACT: ArmGoal = {
  hand: [-0.095, -0.22, -0.39],
  pole: [-0.7, -1, 0.18],
  palm: [1, 0, 0],
  fingers: [0, -0.985, 0.173],
};
const THROUGH: ArmGoal = {
  ...IMPACT,
  hand: [-0.1, -0.32, -0.31],
  fingers: [0, -0.94, 0.3412],
};
const BALANCE: ArmGoal = {
  hand: [-0.08, -0.34, -0.14],
  pole: [-0.7, -1, 0.5],
  palm: [1, 0.05, -0.1],
};
const HAND_L: HandRest = { palm: [1, 0, 0] };
const HAND_R: HandRest = { palm: [1, 0, 0], fingers: [0, -0.28, -0.96] };

/** A padded, lead-booted diver. One large wrench stays fixed inside the
 * right glove. Its arc is led by the hips, loaded overhead, driven through
 * the hit and settled. Wrists and elbow poles name that arc; the shared
 * solver poses the new rig. Keep the existing 0.55 s windup and gameplay. */
export const diver: Moves = {
  style: {
    gait: {
      like: 'heavy',
      stride: 0.48,
      arms: 0.18,
      width: 1.08,
      cadence: 1.9,
      lift: 0.065,
      bounce: 0.01,
      nod: 0.016,
    },
    attack: 'custom',
    windup: 0.55,
    lunge: 0.22,
    snap: 30,
    heavy: true,
  },
  carriage: {
    twist: 0.09,
    hips: 0.07,
    chestRoll: 0.22,
    nod: 0.016,
    armOut: 0,
    bounce: 0.008,
    weaponArm: 0.25,
  },
  stiff: {
    head: 0.65,
    armR: 1.2,
    foreR: 1.2,
    handR: 1.2,
    weapon: 1.2,
    armL: 0.9,
    foreL: 0.9,
    handL: 0.85,
    beard: 0.42,
    cape: 0.43,
    cape2: 0.32,
    sleeveL: 0.9,
    sleeveR: 0.9,
  },
  damping: {
    head: 0.85,
    armR: 0.94,
    foreR: 0.94,
    handR: 0.94,
    weapon: 0.94,
    armL: 0.78,
    foreL: 0.78,
    handL: 0.78,
    beard: 0.68,
    cape: 0.72,
    cape2: 0.68,
    sleeveL: 0.9,
    sleeveR: 0.9,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const phase = c.idleFor > 1.8 ? (c.idleFor + c.unit.id * 0.37) % 10.5 : -1;
    const inspect = pulse(phase, 2.4, 3.2, 4.8) * c.idle * cosmetic;
    const shift = pulse(phase, 7.1, 7.9, 9.3) * c.idle * cosmetic;
    const breath = Math.sin(c.t * 1.65) * c.idle * cosmetic;
    const step = Math.cos((c.cycle - 0.14) * Math.PI * 4) * c.walk;
    const ready = ease(c.aim);
    // On the first strike frame wind resets. Retain the loaded pose until
    // strike has crossed its short arc, instead of dropping to ready for
    // one frame and raising it again.
    const load = Math.max(ease(c.wind), 1 - ease(c.since / 0.14));
    const hit = c.strike;
    const follow = pulse(c.since, 0.06, 0.19, 0.52);
    const land = c.deploy < 1 ? pulse(c.deploy, 0.3, 0.37, 0.65) : 0;

    const free: ArmGoal = {
      ...REST,
      hand: [
        REST.hand[0],
        REST.hand[1] + breath * 0.003,
        REST.hand[2] - c.swingL * 0.16,
      ],
    };
    const carried: ArmGoal = {
      ...CARRY,
      hand: [
        CARRY.hand[0],
        CARRY.hand[1] + inspect * 0.07,
        CARRY.hand[2] - c.swingR * 0.035 - inspect * 0.045,
      ],
    };
    let right = around(READY, COIL, load);
    right = around(right, IMPACT, hit);
    right = blend(right, THROUGH, follow);
    right = blend(carried, right, ready);
    let left = blend(free, BALANCE, ready);
    left = {
      ...left,
      hand: [
        left.hand[0] - load * ready * 0.025,
        left.hand[1] + load * ready * 0.06,
        left.hand[2] + follow * ready * 0.04,
      ],
    };
    // Most roll is in the forearm. A loaded wrist has little independent
    // twist; the glove's authored palm/fingers keep their wrench grip.
    reach(c, 'R', { ...right, forearmRoll: 0.35 }, HAND_R);
    reach(c, 'L', { ...left, forearmRoll: 0.65 }, HAND_L);
    p.weapon = 0;
    c.want('weapon', 0, 0, 0);

    p.lift -= c.size * (ready * (load * 0.034 + hit * 0.022) + land * 0.055);
    p.torsoX +=
      breath * 0.011 +
      ready * (-load * 0.12 + hit * 0.13 + follow * 0.1) -
      c.flinch * 0.08 +
      land * 0.055;
    p.torsoY +=
      ready * (load * 0.25 - hit * 0.25 - follow * 0.15) - shift * 0.065;
    p.torsoZ += ready * (-load * 0.035 + follow * 0.025) + c.flinch * 0.075;
    p.headX += -step * 0.011 * cosmetic + inspect * 0.1 - hit * ready * 0.06;
    p.headY += inspect * 0.16 + shift * 0.13 - load * ready * 0.12;
    p.lean += ready * (-load * 0.023 + hit * 0.045 + follow * 0.022);
    p.roll += shift * 0.01 - c.flinch * 0.025;
    p.lunge += ready * (hit * 0.055 + follow * 0.025);
    p.squash *= 1 + breath * 0.002 - follow * ready * 0.012 - land * 0.01;

    c.want(
      'beard',
      (clamp(-c.accel * 0.009 + c.vertical * 0.004, 0.035) +
        step * 0.007 +
        follow * ready * 0.018) *
        cosmetic,
      clamp(-c.turn * 0.025, 0.04) * cosmetic,
      clamp(-c.lateral * 0.007, 0.035) * cosmetic,
    );
    // The air hose also whips on a hit.
    c.want(
      'cape',
      (clamp(-c.accel * 0.012, 0.065) +
        follow * ready * 0.035 +
        c.flinch * 0.05) *
        cosmetic,
      clamp(-c.turn * 0.032, 0.075) * cosmetic,
      clamp(-c.lateral * 0.009, 0.05) * cosmetic,
    );
    c.want(
      'cape2',
      (clamp(-c.accel * 0.018 + c.vertical * 0.007, 0.095) -
        follow * ready * 0.042) *
        cosmetic,
      clamp(-c.turn * 0.065, 0.105) * cosmetic,
      clamp(-c.lateral * 0.014, 0.075) * cosmetic,
    );
    // Shoulder plates use the solved shoulder, rather than the cancelled
    // shared gait swing. Their overlap must be checked in the raised views.
    for (const side of ['L', 'R'] as const) {
      c.want(
        `sleeve${side}`,
        (c.memo[`reach.arm${side}.x`] ?? 0) * 0.2,
        (c.memo[`reach.arm${side}.y`] ?? 0) * 0.15,
        (c.memo[`reach.arm${side}.z`] ?? 0) * 0.3,
      );
    }
  },
  arrive(d) {
    return {
      drop: (1 - ease(d / 0.3)) * 2.35,
      squash: 1 - pulse(d, 0.3, 0.35, 0.57) * 0.035,
      twirl: 0,
    };
  },
};
