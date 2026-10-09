import { reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves, Pose } from './types';

/**
 * The Pirate (9 October 2026), for the sculpted figure (figure_pirate.py):
 * connected skin on common-axis bones with chest and clavicles, arms posed
 * through `reach` (moves/reach.ts) by where the wrist goes, where the
 * elbow points and which way the palm faces.
 *
 * She swaggers with her free hand loose and the cutlass carried low and
 * forward; stands with that hand on her hip and now and then raises the
 * blade in a salute, rocks it and flicks it down. In a fight she settles
 * low, right shoulder leading, blade up; each slash loads hips and
 * shoulders against it, cuts fast through the hit, follows through and
 * recovers, forehand and backhand in turn, the free arm flung against the
 * blade. She leaps at a new target blade high, free arm back (her card),
 * and lands crouched. Braid, bandana tails, sash tails and the waistcoat's
 * skirts trail her.
 */

type V3 = readonly [number, number, number];
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 2.2);
const pulse = (t: number, a: number, b: number, c: number, d: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - c) / (d - c)));
const add = (a: V3, b: V3, k = 1): V3 => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, add(b, a, -1), t);
/** Spherical blend of two directions (stays unit, no collapse). */
const slerp = (a: V3, b: V3, t: number): V3 => {
  const c = Math.max(-1, Math.min(1, dot(a, b)));
  const w = Math.acos(c);
  if (w < 1e-4) return unit(lerp3(a, b, t));
  const s = Math.sin(w);
  return unit(
    add(scale(a, Math.sin((1 - t) * w) / s), b, Math.sin(t * w) / s),
  );
};
const mirror = (v: V3): V3 => [-v[0], v[1], v[2]];

/** Both hands at rest (left hand, three.js axes: x right, y up, z back):
 *  palms towards the thighs, fingers down and a little forward. */
const HAND: HandRest = {
  palm: [0.99, -0.09, -0.03],
  fingers: [-0.1, -0.94, -0.33],
};

/** The cutlass in the right fist: the grip lies across the curled fingers
 *  (17° from the knuckle line), so the blade's direction and the way its
 *  edge faces fix the fingers and the palm. */
const GRIP_TILT = 0.296;
function bladeHand(blade: V3, edge: V3) {
  const b = unit(blade);
  const e = unit(add(edge, b, -dot(edge, b)));
  const c = Math.sqrt(1 - GRIP_TILT * GRIP_TILT);
  const fingers = unit(add(scale(e, c), b, GRIP_TILT));
  const thumb = unit(add(b, fingers, -dot(b, fingers)));
  const palm = cross(thumb, fingers);
  return { fingers, palm };
}

/** A sword-arm key: the wrist from the right shoulder, the elbow's pole,
 *  the blade's direction and its edge, in the figure's own axes (right
 *  arm, actual side: +x is her right). */
type Sword = { hand: V3; pole: V3; blade: V3; edge: V3 };
/** A free-arm key (left arm, actual side). */
type Free = { hand: V3; pole: V3; palm: V3; fingers: V3 };
/** Body numbers that travel with a key. */
type Body = {
  turn: number;
  bend: number;
  lean: number;
  lunge: number;
  roll: number;
  crouch: number;
};

const swordGoal = (k: Sword): ArmGoal => {
  const { fingers, palm } = bladeHand(k.blade, k.edge);
  return {
    hand: mirror(k.hand),
    pole: mirror(k.pole),
    palm: mirror(palm),
    fingers: mirror(fingers),
  };
};
const freeGoal = (k: Free): ArmGoal => ({
  hand: k.hand,
  pole: k.pole,
  palm: k.palm,
  fingers: k.fingers,
});
const mixSword = (a: Sword, b: Sword, t: number): Sword => ({
  hand: lerp3(a.hand, b.hand, t),
  pole: slerp(unit(a.pole), unit(b.pole), t),
  blade: slerp(unit(a.blade), unit(b.blade), t),
  edge: slerp(unit(a.edge), unit(b.edge), t),
});
const mixFree = (a: Free, b: Free, t: number): Free => ({
  hand: lerp3(a.hand, b.hand, t),
  pole: slerp(unit(a.pole), unit(b.pole), t),
  palm: slerp(unit(a.palm), unit(b.palm), t),
  fingers: slerp(unit(a.fingers), unit(b.fingers), t),
});
const mixBody = (a: Body, b: Body, t: number): Body => ({
  turn: a.turn + (b.turn - a.turn) * t,
  bend: a.bend + (b.bend - a.bend) * t,
  lean: a.lean + (b.lean - a.lean) * t,
  lunge: a.lunge + (b.lunge - a.lunge) * t,
  roll: a.roll + (b.roll - a.roll) * t,
  crouch: a.crouch + (b.crouch - a.crouch) * t,
});

// ---------------------------------------------------------------- keys
// Shoulder-relative wrists in metres of the figure (upper arm 0.216,
// forearm 0.203). Forward is -z.

/** The blade carried low and forward, edge down: walking and standing. */
const CARRY: Sword = {
  hand: [0.09, -0.37, -0.12],
  pole: [0.45, -1, 0.55],
  blade: [0.16, -0.38, -1],
  edge: [0, -1, 0.4],
};
/** Standing: the blade's tip lowered beside her right boot, clear of the
 *  legs. */
const LOW: Sword = {
  hand: [0.115, -0.385, -0.085],
  pole: [0.5, -1, 0.5],
  blade: [0.58, -0.68, -0.45],
  edge: [0, -0.3, -1],
};
/** Ready: fist in front of the body at the waist, elbow in by her side,
 *  blade up and forward towards the foe. */
const GUARD: Sword = {
  hand: [0.0, -0.26, -0.25],
  pole: [0.25, -1, 0.25],
  blade: [-0.12, 0.55, -1],
  edge: [0, -0.9, -0.5],
};
/** Forehand: fist by the ear, blade laid back over the right shoulder. */
const FORE_WIND: Sword = {
  hand: [0.12, 0.03, 0.07],
  pole: [1, 0.15, 0.55],
  blade: [0.25, 0.6, 0.8],
  edge: [0.45, 0.8, -0.35],
};
/** The cut's top: fist high in front of the shoulder, blade up and on. */
const FORE_TOP: Sword = {
  hand: [0.04, -0.02, -0.3],
  pole: [1, -0.25, 0.2],
  blade: [-0.25, 1, -0.55],
  edge: [0, -0.35, -1],
};
/** Contact: the arm long, low across to the left, the edge leading. */
const FORE_CUT: Sword = {
  hand: [-0.08, -0.28, -0.34],
  pole: [0.7, -0.6, 0.6],
  blade: [-0.4, -0.5, -0.77],
  edge: [-0.4, -0.85, 0.25],
};
/** Through: carried on past the left hip. */
const FORE_THROUGH: Sword = {
  hand: [-0.16, -0.36, -0.2],
  pole: [0.6, -0.8, 0.8],
  blade: [-0.75, -0.6, -0.2],
  edge: [-0.2, -1, 0.3],
};
/** Backhand: fist across in front of the left breast, blade back over the
 *  left shoulder. */
const BACK_WIND: Sword = {
  hand: [-0.15, -0.15, -0.11],
  pole: [0.45, -0.6, -1],
  blade: [-0.5, 0.5, 0.75],
  edge: [-0.65, 0.3, -0.5],
};
const BACK_TOP: Sword = {
  hand: [0.0, -0.15, -0.32],
  pole: [0.65, -0.8, 0.2],
  blade: [-0.35, 0.3, -1],
  edge: [1, 0, -0.1],
};
/** Contact: a flat sweep across in front of her to the right, the edge
 *  leading. */
const BACK_CUT: Sword = {
  hand: [0.11, -0.25, -0.32],
  pole: [0.3, -1, 0.3],
  blade: [0.7, -0.12, -0.7],
  edge: [0.65, -0.1, 0.7],
};
/** Through: the fist stays in front of her right hip, not out sideways. */
const BACK_THROUGH: Sword = {
  hand: [0.06, -0.32, -0.27],
  pole: [0.3, -1, 0.45],
  blade: [0.85, -0.38, -0.36],
  edge: [0.35, -0.2, 0.9],
};
/** Idle salute: blade upright before her face. */
const SALUTE: Sword = {
  hand: [0.03, -0.13, -0.17],
  pole: [0.8, -1, 0.25],
  blade: [0.02, 1, -0.12],
  edge: [0, 0, -1],
};
/** In the air: blade high and forward (her card). */
const LEAP_SWORD: Sword = {
  hand: [0.07, 0.15, -0.21],
  pole: [1, -0.35, 0.25],
  // Back in the chest's frame: the trunk pitches forward in the air, so
  // the blade stands high over her head as it does on her card.
  blade: [0.1, 1, 0.3],
  edge: [0, 0.3, -1],
};

const REST_L: Free = {
  hand: [-0.075, -0.404, -0.046],
  pole: [-0.35, -1, 0.3],
  palm: [0.99, -0.09, -0.03],
  fingers: [-0.1, -0.94, -0.33],
};
/** Hand on the hip, the elbow back more than out. */
const HIP_L: Free = {
  hand: [-0.004, -0.192, 0.026],
  pole: [-0.7, -0.4, 0.75],
  palm: [1, 0.05, 0.15],
  fingers: [0.1, -0.55, -0.83],
};
/** Fighting: hanging close, the hand just in front of the hip by the
 *  coat's front edge, elbow soft. */
const READY_L: Free = {
  hand: [-0.035, -0.345, -0.115],
  pole: [-0.3, -1, 0.5],
  palm: [0.9, -0.15, -0.35],
  fingers: [-0.05, -0.85, -0.5],
};
/** Reaching on towards the foe while the blade is drawn back. */
const AIM_L: Free = {
  hand: [-0.03, -0.2, -0.27],
  pole: [-0.5, -1, 0.15],
  palm: [0.25, -0.35, -0.9],
  fingers: [0, 0.35, -1],
};
/** Flung back against the cut (her card). */
const BACK_L: Free = {
  hand: [-0.14, -0.27, 0.18],
  pole: [-0.35, -1, -0.25],
  palm: [0.1, -0.4, 0.9],
  fingers: [-0.45, -0.1, 0.9],
};

const STILL: Body = { turn: 0, bend: 0, lean: 0, lunge: 0, roll: 0, crouch: 0 };
const B_GUARD: Body = { turn: 0.16, bend: 0.05, lean: 0.02, lunge: 0, roll: 0, crouch: 0.013 };
const B_FWIND: Body = { turn: -0.36, bend: -0.04, lean: -0.035, lunge: -0.04, roll: 0.045, crouch: 0.02 };
const B_FTOP: Body = { turn: -0.08, bend: 0.05, lean: 0.03, lunge: 0.05, roll: 0, crouch: 0.016 };
const B_FCUT: Body = { turn: 0.3, bend: 0.14, lean: 0.1, lunge: 0.22, roll: -0.045, crouch: 0.024 };
const B_FTHRU: Body = { turn: 0.36, bend: 0.16, lean: 0.09, lunge: 0.18, roll: -0.05, crouch: 0.026 };
const B_BWIND: Body = { turn: 0.4, bend: 0.03, lean: -0.02, lunge: -0.03, roll: -0.04, crouch: 0.02 };
const B_BTOP: Body = { turn: 0.18, bend: 0.06, lean: 0.03, lunge: 0.05, roll: 0, crouch: 0.016 };
const B_BCUT: Body = { turn: -0.16, bend: 0.11, lean: 0.09, lunge: 0.19, roll: 0.04, crouch: 0.024 };
const B_BTHRU: Body = { turn: -0.16, bend: 0.12, lean: 0.08, lunge: 0.15, roll: 0.04, crouch: 0.024 };

type Keys = {
  wind: Sword;
  top: Sword;
  cut: Sword;
  thru: Sword;
  bw: Body;
  bt: Body;
  bc: Body;
  bh: Body;
};
const FOREHAND: Keys = {
  wind: FORE_WIND,
  top: FORE_TOP,
  cut: FORE_CUT,
  thru: FORE_THROUGH,
  bw: B_FWIND,
  bt: B_FTOP,
  bc: B_FCUT,
  bh: B_FTHRU,
};
const BACKHAND: Keys = {
  wind: BACK_WIND,
  top: BACK_TOP,
  cut: BACK_CUT,
  thru: BACK_THROUGH,
  bw: B_BWIND,
  bt: B_BTOP,
  bc: B_BCUT,
  bh: B_BTHRU,
};

/** Live tuning in the lab: window.__arenaTune = { pirate: { … } }. */
const T = {
  /** Lab only: scan > 0 replaces the slash's clock with a slow sweep from
   *  scanFrom over scanSpan seconds (scan is its speed), scanBack picks
   *  the backhand. */
  scan: 0,
  scanFrom: -0.4,
  scanSpan: 1,
  scanBack: 0,
  /** Lab only: leap > 0 makes her leap in place every 1.6 s. */
  leap: 0,
  windAt: 0.34,
  holdAt: 0.09,
  cutAt: 0.065,
  contact: 0.025,
  through: 0.19,
  recover: 0.46,
  arc: 0.14,
};
const live = () => {
  const t = (
    globalThis as { __arenaTune?: Record<string, Record<string, number>> }
  ).__arenaTune?.pirate;
  return t ? { ...T, ...t } : T;
};

/** Where one slash is at t seconds from its hit (negative before):
 *  the sword key, the free arm's key and the body. */
function slash(t: number, back: boolean) {
  const k = live();
  const { wind, top, cut, thru, bw, bt, bc, bh } = back ? BACKHAND : FOREHAND;
  // The free arm: forward while the blade loads, flung back on the cut
  // (the backhand opens the other way: it pulls in across the body).
  const freeWind = back ? READY_L : AIM_L;
  const freeCut = back ? AIM_L : BACK_L;
  let sword: Sword;
  let free: Free;
  let body: Body;
  if (t < -k.windAt) {
    sword = GUARD;
    free = READY_L;
    body = B_GUARD;
  } else if (t < -k.holdAt) {
    // Anticipation: hips and shoulders load against the coming cut.
    const s = ease((t + k.windAt) / (k.windAt - k.holdAt));
    sword = mixSword(GUARD, wind, s);
    free = mixFree(READY_L, freeWind, s);
    body = mixBody(B_GUARD, bw, s);
  } else if (t < -k.cutAt) {
    // The held instant at the top of the wind-up, still creeping on.
    const s = (t + k.holdAt) / (k.holdAt - k.cutAt);
    sword = mixSword(wind, top, s * 0.08);
    free = freeWind;
    body = mixBody(bw, bt, s * 0.06);
  } else if (t < k.contact) {
    // The cut: accelerating from the top, through the hit.
    const s = easeIn((t + k.cutAt) / (k.cutAt + k.contact));
    const swing = s < 0.5 ? mixSword(wind, top, s * 2) : mixSword(top, cut, s * 2 - 1);
    // The fist travels on an arc in front of the body, not through it.
    const out = Math.sin(s * Math.PI) * k.arc;
    sword = { ...swing, hand: add(swing.hand, [0, 0.02, -out]) };
    free = mixFree(freeWind, freeCut, easeOut(s));
    body = s < 0.5 ? mixBody(bw, bt, s * 2) : mixBody(bt, bc, s * 2 - 1);
  } else if (t < k.through) {
    // Follow-through, slowing.
    const s = easeOut((t - k.contact) / (k.through - k.contact));
    sword = mixSword(cut, thru, s);
    free = freeCut;
    body = mixBody(bc, bh, s);
  } else {
    // Recovery to the guard.
    const s = ease((t - k.through) / (k.recover - k.through));
    sword = mixSword(thru, GUARD, s);
    free = mixFree(freeCut, READY_L, s);
    body = mixBody(bh, B_GUARD, s);
  }
  return { sword, free, body };
}

const LEAP_TIME = 0.5;
const LEAP_HEIGHT = 0.4;

function leap(c: MoveContext) {
  const dashing = live().leap > 0 ? c.time % 1.6 < LEAP_TIME : c.unit.dash;
  let mix = c.memo.leapMix ?? 0;
  mix += ((dashing ? 1 : 0) - mix) * (1 - Math.exp(-c.dt * 14));
  if (!dashing && mix < 0.002) mix = 0;
  c.memo.leapMix = mix;
  const air = (c.memo.leapTime = dashing ? (c.memo.leapTime ?? 0) + c.dt : 0);
  const arc = dashing ? Math.sin(Math.PI * Math.min(1, air / LEAP_TIME)) : 0;
  return { mix, arc };
}

const STYLE = {
  // A confident roll from the hips: quick (she is a fast, cheap fighter),
  // swaying over each planted foot, shoulders turning against the stride.
  gait: {
    like: 'swagger',
    cadence: 2.05,
    stride: 0.66,
    sway: 0.42,
    roll: 0.06,
    twist: 0.14,
    bounce: 0.035,
    lean: 0.05,
    arms: 0.4,
    elbow: 0.35,
    toe: 0.55,
  } as const,
  attack: 'custom' as const,
  windup: 0.28,
  lunge: 0.22,
  snap: 30,
};

export const pirate: Moves = {
  style: STYLE,
  carriage: {
    twist: 0.13,
    hips: 0.09,
    chestRoll: -0.4,
    nod: 0.012,
    armOut: 0,
    bounce: 0,
    weaponArm: 0.35,
  },
  stiff: {
    hat: 0.6,
    hair: 0.36,
    tail: 0.4,
    tail2: 0.3,
    tail3: 0.26,
    extra: 0.34,
    skirtL: 0.58,
    skirtR: 0.58,
    foreL: 0.95,
    foreR: 1.05,
    handL: 1,
    handR: 1.15,
    weapon: 1.2,
  },
  damping: {
    hat: 0.5,
    hair: 0.36,
    tail: 0.38,
    tail2: 0.32,
    tail3: 0.3,
    extra: 0.34,
    skirtL: 0.44,
    skirtR: 0.44,
    foreL: 0.68,
    foreR: 0.72,
    handL: 0.7,
    handR: 0.74,
  },
  arrive(d) {
    // Dropped in spinning a turn and a half, she lands crouched (the
    // pose holds the crouch and the flourish that follows).
    const fall = clamp01(d / 0.3);
    const land = pulse(d, 0.3, 0.36, 0.44, 0.62);
    return {
      drop: d < 0.3 ? 2.4 * (1 - fall * fall) : 0,
      squash: 1 - land * 0.07,
      twirl: -(1 - ease(d / 0.3)) * 3.2,
    };
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const aim = c.aim;
    const walk = c.walk;
    const idle = c.idle;
    const size = c.size;

    // ------------------------------------------------ standing and walking
    // The free arm hangs loose and swings with the stride (the shared
    // swing is in p.armL), its elbow lagging; standing, it goes to the hip.
    const swing = p.armL;
    const restL: Free = {
      ...REST_L,
      hand: add(REST_L.hand, [
        -0.01 * Math.abs(swing),
        0.06 * swing * swing + 0.012 * Math.max(0, swing),
        -swing * 0.36,
      ]),
    };
    const hipHold = ease((c.idleFor - 0.35) / 0.6) * idle;
    let free = mixFree(restL, HIP_L, hipHold);

    // The cutlass carried low and forward, a short swing with the stride
    // and a small bob after each step.
    const carrySwing = p.armR;
    const bob = Math.cos((c.cycle - 0.2) * Math.PI * 4) * 0.012 * walk;
    let sword: Sword = {
      ...CARRY,
      hand: add(CARRY.hand, [0, bob + 0.03 * carrySwing * carrySwing, -carrySwing * 0.25]),
      blade: unit(add(CARRY.blade, [0, -bob * 2 + carrySwing * 0.25, 0])),
    };
    sword = mixSword(sword, LOW, idle * (1 - aim));
    let body: Body = STILL;

    // Idle: a lively stance, weight shifting from foot to foot; now and
    // then she raises the blade in a salute, rocks it, flicks it down.
    const lap = (c.idleFor + c.unit.id * 0.71) % 8.6;
    const awake = ease((c.idleFor - 1.2) / 0.8) * idle * cosmetic;
    const salute = pulse(lap, 1.9, 2.45, 3.25, 3.42) * awake;
    const rock = Math.sin((lap - 2.45) * 9) * pulse(lap, 2.45, 2.6, 3.0, 3.25) * awake;
    const flick = pulse(lap, 3.25, 3.36, 3.42, 3.8) * awake;
    const glance = pulse(lap, 5.3, 5.75, 6.5, 7.0) * awake;
    if (salute > 0.001 || flick > 0.001) {
      const up = mixSword(sword, SALUTE, salute);
      sword = {
        ...up,
        blade: unit(add(up.blade, [rock * 0.35, 0, 0])),
        edge: unit(add(up.edge, [rock * 0.2, 0, 0])),
      };
      // The flick: the blade whips down and out past the right thigh.
      sword = mixSword(sword, {
        hand: [0.12, -0.38, -0.08],
        pole: [0.6, -1, 0.4],
        blade: [0.55, -0.8, -0.35],
        edge: [0.6, 0.2, 0.8],
      }, flick * 0.85);
    }
    const sway = Math.sin(c.t * 0.85 + c.unit.id) * idle * cosmetic;
    p.roll += sway * 0.022;
    p.torsoZ -= sway * 0.03;
    p.torsoY += sway * 0.04 + glance * 0.12;
    p.headY += -sway * 0.05 + glance * 0.55 - salute * 0.12;
    p.headX += salute * 0.16 - flick * 0.05;
    p.torsoX -= salute * 0.03;

    // ------------------------------------------------ fighting
    if (aim > 0.001) {
      const recent = c.since < 0.55;
      const index = recent ? c.hits - 1 : c.hits;
      let back = ((index % 2) + 2) % 2 === 1;
      let t = recent ? c.since : -c.toHit;
      const tune = live();
      if (tune.scan > 0) {
        t = tune.scanFrom + ((c.time * tune.scan) % tune.scanSpan);
        back = tune.scanBack > 0;
      }
      const s = slash(t, back);
      sword = mixSword(sword, s.sword, aim);
      free = mixFree(free, s.free, aim);
      body = mixBody(STILL, s.body, aim);
    }

    // ------------------------------------------------ the leap
    const { mix: d, arc } = leap(c);
    let hipL = c.hipL;
    let hipR = c.hipR;
    if (d > 0.001) {
      sword = mixSword(sword, LEAP_SWORD, d);
      free = mixFree(free, BACK_L, d);
      const keep = 1 - d;
      hipL = hipL * keep + 0.95 * d;
      hipR = hipR * keep - 0.6 * d;
      c.want('legL', hipL);
      c.want('kneeL', -1.15 * d);
      c.want('footL', 0.25 * d);
      c.want('legR', hipR);
      c.want('kneeR', -0.55 * d);
      c.want('footR', 0.5 * d);
      p.torsoX += 0.32 * d;
      p.torsoY += 0.12 * d;
      p.headX -= 0.24 * d;
      p.lean += 0.2 * d;
      p.lift += arc * LEAP_HEIGHT * size;
      p.squash *= 1 - 0.05 * d * (1 - arc);
    }

    // ------------------------------------------------ landing
    if (c.deploy < 1) {
      const land = pulse(c.deploy, 0.3, 0.36, 0.55, 0.8);
      const rise = pulse(c.deploy, 0.6, 0.78, 0.9, 1.0);
      body = mixBody(body, { turn: 0.25, bend: 0.3, lean: 0.06, lunge: 0, roll: 0, crouch: 0.09 }, land);
      sword = mixSword(sword, GUARD, Math.max(land, rise));
      free = mixFree(free, READY_L, land);
      p.headX -= land * 0.15;
    }

    // ------------------------------------------------ body
    p.torsoY += body.turn;
    // The eyes stay on the foe while the shoulders turn.
    p.headY -= body.turn * 0.75;
    p.torsoX += body.bend;
    p.lean += body.lean;
    p.lunge += body.lunge;
    p.roll += body.roll;
    p.lift -= body.crouch * size;
    p.headX -= body.bend * 0.45;

    // Hit: the sword arm jerks, the free hand flies up, the trunk twists.
    const hit = c.flinch * c.flinch;
    p.torsoZ -= hit * 0.1;
    p.torsoY -= hit * 0.12;
    p.headY += hit * 0.15;
    sword = { ...sword, hand: add(sword.hand, [0.02 * hit, 0.05 * hit, 0.06 * hit]) };
    free = { ...free, hand: add(free.hand, [-0.04 * hit, 0.08 * hit, 0.04 * hit]) };

    // Breathing in the chest.
    p.torsoX += Math.sin(c.t * 1.9) * 0.012 * (1 - aim * 0.5) * cosmetic;

    reach(c, 'R', swordGoal(sword), HAND);
    reach(c, 'L', freeGoal(free), HAND);
    c.want('weapon', 0);

    secondary(c, p, d, hipL, hipR);
  },
};

/** The braid, the bandana's tails, the sash's tails and the hat: soft
 *  parts that lag the body, swing with the hips and fly in a leap. */
function secondary(
  c: MoveContext,
  p: Pose,
  leapMix: number,
  hipL: number,
  hipR: number,
) {
  const soft = c.reduced ? 0.25 : 1;
  const ahead = clamp(c.accel * 0.02, 0.24) * soft;
  const across = clamp(c.lateral * 0.022, 0.24) * soft;
  const turn = clamp(c.turn * 0.06, 0.26) * soft;
  const up = clamp(c.vertical * 0.012, 0.2) * soft;
  const step = Math.pow(1 - c.pass, 4) * c.walk;
  const hips = (c.fwdL - c.fwdR) * 0.05 * c.walk;
  const hit = c.flinch * c.flinch;
  // The braid hangs from the nape: tipped back with every forward bend
  // and nod (it hangs straight down while the head goes on), bouncing on
  // each step, swinging with the hips and the turns, streaming in a leap.
  const bend = p.headX + p.torsoX + p.lean * 0.8;
  c.want(
    'tail',
    bend * 0.9 - ahead - up - step * 0.05 - 0.45 * leapMix + hit * 0.12,
    -p.headY * 0.2,
    -p.roll * 0.8 - across + turn + hips,
  );
  c.want(
    'tail2',
    -ahead * 0.7 - up * 0.6 - leapMix * 0.2 + step * 0.03,
    0,
    turn * 0.7 - across * 0.7 + hips * 0.6,
  );
  c.want(
    'tail3',
    -ahead * 0.5 - up * 0.5 - leapMix * 0.12 + step * 0.045,
    0,
    turn * 0.85 - across * 0.6 + hips * 0.5,
  );
  // The bandana's tails flutter behind the knot.
  c.want(
    'hair',
    -ahead * 1.2 - up * 0.8 - leapMix * 0.4 + Math.sin(c.t * 7.3) * 0.05 * c.walk * soft,
    turn * 0.5,
    -across * 0.9 + Math.sin(c.t * 5.1) * 0.04 * c.walk * soft,
  );
  // The sash's tails hang from the knot at her left hip.
  c.want(
    'extra',
    c.hipL * 0.35 - ahead * 0.8 - up * 0.5 - leapMix * 0.35 + step * 0.03,
    0,
    -across * 0.7 + turn * 0.4 - p.torsoZ * 0.5,
  );
  // The waistcoat's skirts hang from the waist under the sash: each half
  // trails its thigh (back with it, but less far forward: the
  // thigh passes through the open front, and a half swung further would
  // push its back panel into the seat) and flares a little as it goes,
  // hanging nearly plumb against the trunk's bend (tipping a little with
  // the pelvis, so the seat stays behind it); no twist, which would push a
  // half's back panel into the seat. They stream back in a leap.
  for (const [side, out, hip] of [
    ['L', -1, hipL],
    ['R', 1, hipR],
  ] as const) {
    c.want(
      `skirt${side}`,
      hip * (hip > 0 ? 0.4 : 0.62) +
        p.torsoX * 0.25 +
        p.lean * 0.5 -
        0.03 * c.walk -
        ahead * 0.5 -
        up * 0.3 -
        0.22 * leapMix,
      0,
      out * (0.012 * c.walk + Math.abs(hip) * 0.06 + 0.05 * leapMix) -
        p.torsoZ * 0.6 -
        across * 0.4,
    );
  }
  // The tricorne sits firm; it only settles after a jolt.
  c.want(
    'hat',
    clamp(-ahead * 0.2 - step * 0.03 + hit * 0.05 - leapMix * 0.06, 0.08),
    0,
    clamp(-across * 0.18 + turn * 0.12, 0.05),
  );
}
