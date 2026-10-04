/**
 * Arena's walk, as plain maths (no three.js), so it can be tested.
 *
 * troops.ts plants each foot on the field in world space and solves the
 * leg onto it every frame (two-bone IK through the figure's real hip, knee
 * and ankle), so feet never slide whatever the body does: walking, turning,
 * lunging into a blow or being shoved. A walk cycle (`u`, 0..1 per two
 * steps, advanced by the distance covered) only times things: when each
 * foot lifts and lands, how high it swings, how it rolls heel to toe, and
 * the pelvis's drop at contact and rise as the legs pass. Each troop picks
 * a gait profile (below) for how heavy, long-striding and springy it is.
 */

/** How a troop walks. Lengths are in leg lengths (the hip's height above
 *  the ground), angles in radians. */
export type GaitProfile = {
  /** 0 light and springy .. 1 heavy: a deeper dip as each foot takes the
   *  weight, a longer double support, a slower, softer body. */
  weight: number;
  /** Step length at the troop's own speed (cadence follows: speed / step).
   *  About 0.55 short and quick .. 0.8 long and loping. The longest step:
   *  a slow troop takes shorter ones so it keeps its `cadence`. */
  stride: number;
  /** Steps a second at the troop's own speed, at least: about 2 for an
   *  ordinary walk, fewer for heavy bodies. The figures are drawn large
   *  for their pace, so a full stride would look like slow motion. */
  cadence: number;
  /** Rise and fall of the pelvis through each step. */
  bounce: number;
  /** Knees kept bent all the time (a crouched, sprung carriage). */
  crouch: number;
  /** Toe clearance at the height of the swing. */
  lift: number;
  /** Shoulder swing each way, opposite the legs. */
  arms: number;
  /** Elbow bend on the forward swing (figures with elbows). */
  elbow: number;
  /** Forward lean from the waist at the troop's own speed. */
  lean: number;
  /** The pelvis shifts over the planted foot, in hip widths. */
  sway: number;
  /** The pelvis drops on the swinging leg's side; the chest counters it. */
  roll: number;
  /** The pelvis turns with the forward leg; the shoulders counter it. */
  twist: number;
  /** Feet set this share of the hips' width apart (1 is the sculpt's). */
  width: number;
  /** Toe raised at heel strike, and the heel lifted at toe-off. */
  heel: number;
  toe: number;
  /** Nod of the head after each footfall (the rest of the head is held
   *  steady against the body). */
  nod: number;
};

export type GaitName =
  | 'light'
  | 'brisk'
  | 'swagger'
  | 'march'
  | 'glide'
  | 'heavy'
  | 'beast'
  | 'shuffle'
  /** The Robots' original wind-up scurry, kept as it was. */
  | 'clockwork';

/** A preset by name, or a preset with some numbers changed. */
export type GaitChoice = GaitName | (Partial<GaitProfile> & { like: GaitName });

const BRISK: GaitProfile = {
  weight: 0.35,
  stride: 0.66,
  cadence: 2,
  bounce: 0.03,
  crouch: 0.012,
  lift: 0.1,
  arms: 0.42,
  elbow: 0.35,
  lean: 0.06,
  sway: 0.32,
  roll: 0.045,
  twist: 0.09,
  width: 0.85,
  heel: 0.3,
  toe: 0.55,
  nod: 0.03,
};

export const GAITS: Record<GaitName, GaitProfile> = {
  // Springy and quick: up on the toes, a bounce in every step, big arms.
  light: {
    ...BRISK,
    cadence: 2.2,
    weight: 0.1,
    stride: 0.64,
    bounce: 0.045,
    crouch: 0.008,
    lift: 0.13,
    arms: 0.5,
    elbow: 0.45,
    lean: 0.07,
    sway: 0.26,
    roll: 0.04,
    toe: 0.62,
    nod: 0.035,
  },
  // An ordinary purposeful walk.
  brisk: BRISK,
  // Loose and rolling: hips swinging, shoulders turning, a lazy arm.
  swagger: {
    ...BRISK,
    cadence: 1.8,
    weight: 0.4,
    stride: 0.7,
    bounce: 0.03,
    sway: 0.5,
    roll: 0.07,
    twist: 0.15,
    arms: 0.36,
    lean: 0.03,
    nod: 0.025,
  },
  // Upright and drilled: high knees, level shoulders, a crisp arm.
  march: {
    ...BRISK,
    cadence: 2.1,
    weight: 0.3,
    stride: 0.62,
    bounce: 0.025,
    lift: 0.16,
    arms: 0.5,
    elbow: 0.15,
    lean: 0.01,
    sway: 0.2,
    roll: 0.025,
    twist: 0.05,
    heel: 0.36,
  },
  // Low and level, knees bent: the body floats along over gliding feet.
  glide: {
    ...BRISK,
    cadence: 2,
    weight: 0.45,
    stride: 0.58,
    bounce: 0.012,
    crouch: 0.035,
    lift: 0.07,
    arms: 0.1,
    lean: 0.1,
    sway: 0.18,
    roll: 0.015,
    twist: 0.05,
    heel: 0.2,
    toe: 0.4,
    nod: 0.01,
  },
  // Weighty: the body sinks onto each foot, swings over a wide stance and
  // the shoulders roll with it.
  heavy: {
    ...BRISK,
    cadence: 1.7,
    weight: 0.8,
    stride: 0.6,
    bounce: 0.035,
    crouch: 0.03,
    lift: 0.085,
    arms: 0.3,
    elbow: 0.25,
    lean: 0.05,
    sway: 0.6,
    roll: 0.06,
    twist: 0.08,
    width: 1,
    heel: 0.22,
    toe: 0.45,
    nod: 0.045,
  },
  // A big animal: long slow strides, the body rolling from leg to leg.
  beast: {
    ...BRISK,
    cadence: 1.5,
    weight: 1,
    stride: 0.5,
    bounce: 0.03,
    crouch: 0.04,
    lift: 0.1,
    arms: 0.2,
    elbow: 0.2,
    lean: 0.03,
    sway: 0.5,
    roll: 0.06,
    twist: 0.06,
    width: 1,
    heel: 0.12,
    toe: 0.5,
    nod: 0.06,
  },
  // Short careful steps (pushing something heavy, a long robe).
  shuffle: {
    ...BRISK,
    cadence: 2.2,
    weight: 0.55,
    stride: 0.5,
    bounce: 0.015,
    crouch: 0.02,
    lift: 0.06,
    arms: 0.12,
    lean: 0.04,
    sway: 0.3,
    roll: 0.03,
    twist: 0.04,
    heel: 0.18,
    toe: 0.35,
  },
  clockwork: BRISK,
};

/** The profile a troop asked for. */
export function gaitOf(choice: GaitChoice | undefined, fallback: GaitName) {
  if (!choice) return GAITS[fallback];
  if (typeof choice === 'string') return GAITS[choice];
  const { like, ...rest } = choice;
  return { ...GAITS[like], ...rest };
}

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const ease = (t: number) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;

/** Share of the cycle each foot is on the ground: about 0.6 walking, more
 *  for heavy troops (a longer double support). */
export function dutyFactor(g: GaitProfile) {
  return 0.6 + g.weight * 0.04;
}

/** Step length in world units: the profile's stride of the drawn leg, or
 *  shorter if that would take fewer than `cadence` steps a second at the
 *  troop's own speed (world units a second); longer when the troop goes
 *  faster than its usual pace (sped up by a friend's drum) and shorter
 *  when slower (frozen), the cadence taking the rest. `tempo` is the
 *  troop's own small variation. */
export function stepLength(
  g: GaitProfile,
  leg: number,
  speed: number,
  ownSpeed: number,
  tempo = 1,
) {
  const own = Math.max(0.05, ownSpeed);
  const ratio = Math.max(0.25, Math.min(2, speed / own));
  const natural = Math.min(g.stride * leg, own / g.cadence);
  return (natural * Math.sqrt(ratio)) / tempo;
}

/** Periodic smooth curve through keys [(w, v)], w 0..1 (Catmull-Rom). */
function loop(keys: readonly (readonly [number, number])[], w: number) {
  const n = keys.length;
  w = ((w % 1) + 1) % 1;
  let i = 0;
  while (i < n - 1 && keys[i + 1][0] <= w) i++;
  const at = (k: number) => {
    const j = ((k % n) + n) % n;
    const wrap = Math.floor(k / n);
    return [keys[j][0] + wrap, keys[j][1]] as const;
  };
  const [w0, p0] = at(i - 1);
  const [w1, p1] = at(i);
  const [w2, p2] = at(i + 1);
  const [w3, p3] = at(i + 2);
  const t = (w - w1) / (w2 - w1);
  const m1 = ((p2 - p0) / (w2 - w0)) * (w2 - w1);
  const m2 = ((p3 - p1) / (w3 - w1)) * (w2 - w1);
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p1 +
    (t3 - 2 * t2 + t) * m1 +
    (-2 * t3 + 3 * t2) * p2 +
    (t3 - t2) * m2
  );
}

/** The pelvis through one step, `w` 0..1 from a heel strike: contact,
 *  down (lowest, the knee taking the weight), passing, up (highest, the
 *  back foot pushing off), and contact again. -1 .. 1. */
const PELVIS = [
  [0, -0.35],
  [0.16, -1],
  [0.42, 0.45],
  [0.64, 1],
] as const;
export function pelvis(w: number, g: GaitProfile) {
  const v = loop(PELVIS, w);
  // Heavy bodies sink further onto each foot than they rise.
  return v < 0 ? v * (1 + g.weight * 0.6) : v * (1 - g.weight * 0.35);
}

/** The foot's pitch (+ toe up) at `u` through one leg's cycle: toe up at
 *  heel strike, rolling flat, the heel peeling up into toe-off, then
 *  back to level through the swing and up again for the next strike. */
export function footPitch(u: number, duty: number, g: GaitProfile) {
  u = ((u % 1) + 1) % 1;
  const flat = 0.12 * duty;
  const rise = 0.55 * duty;
  if (u < flat) return g.heel * (1 - ease(u / flat));
  if (u < rise) return 0;
  if (u < duty) return -g.toe * ease((u - rise) / (duty - rise));
  const k = (u - duty) / (1 - duty);
  if (k < 0.65) return -g.toe + (g.toe + g.heel * 0.4) * ease(k / 0.65);
  return g.heel * (0.4 + 0.6 * ease((k - 0.65) / 0.35));
}

/** Through a swing (`k` 0..1): how far the foot has travelled from where
 *  it lifted to where it lands, and how high it is (0..1 of the profile's
 *  lift). The foot leaves late and arrives early, slowing to set down. */
export function swing(k: number): { travel: number; height: number } {
  k = clamp01(k);
  const travel = ease(clamp01((k - 0.04) / 0.9));
  // Highest a little before the middle (the knee folds early), set down
  // softly.
  const height = Math.pow(Math.sin(Math.PI * Math.pow(k, 0.85)), 1.4);
  return { travel, height };
}

/** Polynomial smooth minimum. */
export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

/** A leg as sculpted, in the figure's own units, about its hip pivot:
 *  `y` up, `z` back (three.js: the model faces -z). */
export type LegShape = {
  /** Hip to knee and knee to ankle, in the leg's plane. */
  thigh: { y: number; z: number };
  shin: { y: number; z: number };
};

/** Turns (radians, +forward, about x) that put the ankle at (`y`, `z`)
 *  from the hip, the knee bending forward, as offsets from the sculpt.
 *  Out of reach, the leg points straight at the target. */
export function solveLeg(leg: LegShape, y: number, z: number) {
  const l1 = Math.hypot(leg.thigh.y, leg.thigh.z);
  const l2 = Math.hypot(leg.shin.y, leg.shin.z);
  // Angles from straight down, forward (-z) positive.
  const rest1 = Math.atan2(-leg.thigh.z, -leg.thigh.y);
  const rest2 = Math.atan2(-leg.shin.z, -leg.shin.y);
  const reach = Math.hypot(y, z);
  const d = Math.max(Math.abs(l1 - l2) + 1e-4, Math.min(reach, l1 + l2 - 1e-5));
  const aim = Math.atan2(-z, -y);
  const cos1 = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const cos2 = (l2 * l2 + d * d - l1 * l1) / (2 * l2 * d);
  const a1 = aim + Math.acos(Math.max(-1, Math.min(1, cos1)));
  const a2 = aim - Math.acos(Math.max(-1, Math.min(1, cos2)));
  const hip = a1 - rest1;
  const knee = a2 - rest2 - hip;
  return { hip, knee, stretch: reach / (l1 + l2) };
}

/** The phase of the cycle's step `w` (0..1 from each heel strike) and
 *  which leg is in front, for the pelvis and arms. */
export function stepPhase(u: number) {
  u = ((u % 1) + 1) % 1;
  return { w: (u * 2) % 1, left: u < 0.5 };
}

/** +1 while the weight is on the left foot (its mid-stance), -1 on the
 *  right, smoothly between: the pelvis shifts and drops with it. */
export function weightSide(u: number, duty: number) {
  return Math.cos((u - duty / 2) * TAU);
}

/** Distance-driven joint poses: a planted foot, bent-knee recovery and
 *  toe-off, as offsets from the sculpt's natural stance in radians. The
 *  Robots still walk on this; other troops' skirts may read it too. */
export function walkingLeg(phase: number, swing: number) {
  const u = ((phase % 1) + 1) % 1;
  const stance = 0.6;
  const k = Math.max(0, (u - stance) / (1 - stance));
  const ease = k * k * (3 - 2 * k);
  const forward = u < stance ? 1 - (2 * u) / stance : -1 + 2 * ease;
  const lift = Math.sin(Math.PI * k);
  const settle = u < stance ? Math.sin((u / stance) * Math.PI) * 0.065 : 0;
  const hip = forward * swing * 0.68 + lift * 0.44;
  const knee = -lift * 0.95 - settle;
  const toeOff =
    u > 0.42 && u < stance
      ? Math.sin(((u - 0.42) / (stance - 0.42)) * Math.PI) * 0.18
      : 0;
  return { hip, knee, ankle: -(hip + knee) + toeOff };
}

/** Lower the hip by the height that rotations would steal from the planted
 * foot. Offsets include the sculpt's original bent-knee shape. */
export function legLowering(
  pose: ReturnType<typeof walkingLeg>,
  upper: { y: number; z: number },
  lower: { y: number; z: number },
  support: number,
) {
  const angle = pose.hip + pose.knee;
  const raised =
    upper.y * Math.cos(pose.hip) -
    upper.z * Math.sin(pose.hip) +
    lower.y * Math.cos(angle) -
    lower.z * Math.sin(angle) -
    upper.y -
    lower.y;
  return -raised * support;
}
