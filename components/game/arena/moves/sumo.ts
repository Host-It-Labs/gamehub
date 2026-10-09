import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves, Pose } from './types';

const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));
type V3 = readonly [number, number, number];
const add = (a: V3, b: V3, k = 1): V3 => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
];

/**
 * Where his hands go (left hand, from the shoulder, in the Sumo's own units:
 * x out to his right so the left side is -x, y up, z back so forward is
 * -z). He is broad: the flank sits just outside the shoulder and the belly
 * a third of a unit in front of it, so the resting arms hang against the
 * flanks with the hands beside the belly, never out in the air.
 */
const REST: ArmGoal = {
  hand: [-0.07, -0.46, -0.17],
  pole: [-0.35, -1, 0.75],
  palm: [1, 0.1, -0.25],
};
/** Open hands up in front of the chest, palms angled in and forward,
 *  elbows down, ready to drive. */
const GUARD: ArmGoal = {
  hand: [0.12, -0.16, -0.4],
  pole: [-0.65, -1, 0.15],
  palm: [0.75, 0, -0.65],
  fingers: [0.05, 0.85, -0.55],
};
/** Drawn back beside the chest before a slap. */
const CHAMBER: ArmGoal = {
  hand: [-0.02, -0.15, -0.2],
  pole: [-0.55, -1, 0.55],
  palm: [0.15, 0, -1],
  fingers: [0, 1, 0.05],
};
/** Driven out flat at the shoulder's height, palm first. */
const SLAP: ArmGoal = {
  hand: [0.15, -0.04, -0.54],
  pole: [-0.5, -1, 0.15],
  palm: [0.12, 0.05, -1],
  fingers: [0.05, 1, 0.12],
};
/** Hands pressed on the thighs (shiko). */
const KNEES: ArmGoal = {
  hand: [-0.02, -0.4, -0.3],
  pole: [-0.8, -0.6, 0.4],
  palm: [0.2, -1, -0.1],
  fingers: [0.15, -0.3, -1],
};
/** The sculpt's own hand: the A-pose palm faces forward, fingers down. */
const HAND: HandRest = { palm: [0, 0, -1] };

/** The Sumo's other numbers, in one place so they can be tuned live in the
 *  dev lab (`window.__arenaTune = { sumo: { … } }`, see
 *  scripts/arena-troop-review.mjs --eval). */
const T = {
  crouch: 0.12,
  pitch: 0.4,
  waddle: 0.05,
  waddlePhase: 0,
  slapTwist: 0.34,
  chamberTwist: 0.26,
  slapLunge: 0.24,
  followAt: 0.36,
  follow: 0.6,
};

const live = () => {
  const t = (
    globalThis as { __arenaTune?: Record<string, Record<string, number>> }
  ).__arenaTune?.sumo;
  return t ? { ...T, ...t } : T;
};

/** A grounded wrestler: wide planted feet and low hips, the belly carried
 *  forward, arms resting round it. In a bout he settles low with both palms
 *  up and drives alternating open-hand thrusts (tsuppari) from his hips,
 *  each followed by a lighter one from the other hand. Standing about he
 *  breathes into his belly and now and then lifts a leg high to the side
 *  and stamps (shiko). He lands with the same stamp. */
export const sumo: Moves = {
  style: {
    gait: {
      like: 'heavy',
      stride: 0.42,
      cadence: 1.9,
      bounce: 0.012,
      crouch: 0.07,
      lift: 0.05,
      arms: 0.09,
      elbow: 0.12,
      lean: 0.07,
      sway: 0.65,
      roll: 0.06,
      twist: 0.06,
      width: 1.32,
      heel: 0.08,
      toe: 0.28,
      weight: 1,
      nod: 0.02,
    },
    attack: 'custom',
    windup: 0.38,
    lunge: 0.32,
    snap: 25,
    heavy: true,
  },
  carriage: {
    twist: 0.08,
    hips: 0.06,
    chestRoll: 0.12,
    nod: 0.02,
    armOut: 0,
    bounce: 0,
    weaponArm: 1,
  },
  stiff: {
    hair: 0.45,
    extra: 0.3,
    handL: 0.9,
    handR: 0.9,
    foreL: 0.9,
    foreR: 0.9,
  },
  damping: {
    hair: 0.42,
    extra: 0.38,
    handL: 0.7,
    handR: 0.7,
    foreL: 0.66,
    foreR: 0.66,
  },
  pose(c, p) {
    const k = live();
    const cosmetic = c.reduced ? 0 : 1;
    const breath = Math.sin(c.t * 1.2) * cosmetic;
    const ready = c.aim;
    const rest = 1 - ready;

    // Shiko now and then while he stands about: a slow weight shift onto
    // one leg, the other lifted high to the side, held, then stamped.
    const idleTime = c.idleFor > 1.5 ? (c.idleFor + c.unit.id * 0.71) % 9 : -1;
    const shikoSide = Math.floor((c.idleFor + c.unit.id * 0.71) / 9) % 2;
    const shift = pulse(idleTime, 5.2, 5.9, 7.7) * c.idle * cosmetic;
    const raise = pulse(idleTime, 5.7, 6.5, 7.15) * c.idle * cosmetic;
    const stamp = pulse(idleTime, 7.15, 7.25, 7.9) * c.idle * cosmetic;
    const press = Math.max(shift, stamp);

    // Resting hands swing a little with the walk (the shared swing is in
    // p.armL / p.armR, + forward) and rise with the breath.
    const restL = add(REST.hand, [0, breath * 0.006, -p.armL * 0.28]);
    const restR = add(REST.hand, [0, breath * 0.006, -p.armR * 0.28]);
    let left: ArmGoal = blend(
      { ...REST, hand: restL },
      KNEES,
      press,
    );
    let right: ArmGoal = blend(
      { ...REST, hand: restR },
      KNEES,
      press,
    );

    // The bout: settle low, palms up in front of the chest.
    if (ready > 0.001) {
      const pump = Math.sin(c.t * 5.5) * 0.012 * cosmetic;
      const guardL: ArmGoal = { ...GUARD, hand: add(GUARD.hand, [0, pump, 0]) };
      const guardR: ArmGoal = {
        ...GUARD,
        hand: add(GUARD.hand, [0, -pump, 0]),
      };
      p.lift -= c.size * (k.crouch + Math.sin(c.t * 5.5) * 0.006) * ready;
      p.torsoX += k.pitch * ready;
      p.headX -= k.pitch * 0.75 * ready;

      // The striking hand alternates; anticipation belongs to the hand that
      // will land, so the hands never swap on the blow.
      const strikeRight = (c.hits + (c.wind > 0 ? 1 : 0)) % 2 === 1;
      const side = strikeRight ? 1 : -1;
      const wind = c.wind;
      const hit = c.strike;
      // Through and settling after the blow, and the other hand's lighter
      // follow-up slap a beat later.
      const through = pulse(c.since, 0.0, 0.07, 0.32);
      const second =
        pulse(c.since, k.followAt, k.followAt + 0.07, k.followAt + 0.32) *
        k.follow;
      const lead = Math.max(hit, through);
      const leadGoal = blend(blend(guardL, CHAMBER, wind), SLAP, lead);
      const backGoal = blend(
        blend(guardR, CHAMBER, lead * 0.85),
        SLAP,
        second,
      );
      const [goalL, goalR] = strikeRight
        ? [backGoal, leadGoal]
        : [leadGoal, backGoal];
      left = blend(left, goalL, ready);
      right = blend(right, goalR, ready);
      // The hips load away from the slap and turn in behind it; the body
      // rocks back in the wind-up and drives forward through the blow.
      p.torsoY +=
        (side * (wind * k.chamberTwist - lead * k.slapTwist) +
          side * second * k.slapTwist * 0.6) *
        ready;
      p.torsoX += (lead * 0.06 - wind * 0.05 + second * 0.03) * ready;
      p.headY += side * (wind * 0.08 - lead * 0.1) * ready;
      p.lunge += (lead * k.slapLunge - wind * 0.06 + second * 0.07) * ready;
      p.lean += (lead * 0.05 - wind * 0.03) * ready;
      p.roll += side * (wind * 0.03 - lead * 0.04) * ready;
      p.squash *= 1 - lead * 0.03 * ready;
    }

    // The waddle: his whole bulk rolls over each planted foot in turn, the
    // chest riding with it rather than staying level, the free arm swinging
    // out a little as the body rolls away from it.
    const rock = Math.sin((c.cycle + k.waddlePhase) * Math.PI * 2) * c.walk;
    p.roll += rock * k.waddle;
    p.torsoZ += rock * k.waddle * 0.8;
    p.headY -= rock * 0.04;

    // Shiko: weight over the standing leg, the chest leaning hard over it,
    // the other leg swung high to the side with a bent knee; then the stamp
    // drops the hips into a deep squat, hands pressing on the knees.
    if (shift > 0.001 || stamp > 0.001) {
      const s = shikoSide ? 1 : -1;
      p.roll += s * (shift * 0.1 + raise * 0.14);
      p.torsoZ -= s * (shift * 0.12 + raise * 0.3);
      p.headY += s * shift * 0.12;
      p.headX -= raise * 0.1;
      p.lift -= c.size * (stamp * 0.16 + shift * 0.05 - raise * 0.04);
      p.torsoX += stamp * 0.22 + shift * 0.1 - raise * 0.08;
      if (raise > 0.001) {
        const leg = shikoSide ? 'R' : 'L';
        const out = shikoSide ? 1 : -1;
        c.want(`leg${leg}`, raise * 0.3, 0, out * raise * 1.05);
        c.want(`knee${leg}`, -raise * 0.55);
        c.want(`foot${leg}`, raise * 0.25, 0, -out * raise * 0.3);
      }
    }

    // Hit: the chest rocks back and the belly takes it.
    p.torsoZ += c.flinch * 0.06;
    p.squash *= 1 - c.flinch * 0.04;
    p.headX -= c.flinch * 0.1;

    // Breathing into the belly; the chest barely moves.
    p.squash *= 1 + breath * 0.007 * rest;
    p.torsoX += breath * 0.01 * rest;

    reach(c, 'L', left, HAND);
    reach(c, 'R', right, HAND);

    // The topknot and the mawashi's knot lag the body.
    c.want(
      'hair',
      clamp(-c.accel * 0.018 + c.vertical * 0.008, 0.1) + c.flinch * 0.15,
      clamp(-c.turn * 0.07, 0.12),
      clamp(-c.lateral * 0.02, 0.12),
    );
    c.want(
      'extra',
      clamp(-c.accel * 0.035, 0.22) + c.flinch * 0.12 + stamp * 0.1,
      clamp(-c.turn * 0.09, 0.24),
      clamp(-c.lateral * 0.025, 0.22),
    );

    // Landing: the same stamp, hips first, then one leg up and down.
    if (c.deploy < 1) landing(c, p);
  },
  arrive(d) {
    const fall = clamp01(d / 0.3);
    const land = pulse(d, 0.3, 0.38, 0.58);
    const stamp = pulse(d, 0.8, 0.84, 0.96);
    return {
      drop: (1 - fall * fall) * 2.6,
      squash: 1 - land * 0.03 - stamp * 0.012,
      twirl: 0,
    };
  },
};

function landing(c: MoveContext, p: Pose) {
  const land = pulse(c.deploy, 0.3, 0.38, 0.6);
  const raise = pulse(c.deploy, 0.58, 0.72, 0.8);
  const stamp = pulse(c.deploy, 0.8, 0.84, 0.97);
  p.lift -= c.size * (land * 0.16 + stamp * 0.16 - raise * 0.04);
  p.torsoX += land * 0.2 + stamp * 0.2 - raise * 0.06;
  p.headX -= land * 0.1;
  p.torsoZ += raise * 0.3;
  p.roll += raise * 0.14;
  if (raise > 0.001) {
    c.want('legL', raise * 0.3, 0, -raise * 1.2);
    c.want('kneeL', -raise * 0.55);
    c.want('footL', raise * 0.25, 0, raise * 0.3);
  }
}
