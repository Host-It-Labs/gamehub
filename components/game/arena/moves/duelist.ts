import type { MoveContext, Moves, Pose } from './types';

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const clamp = (v: number, m: number) => (v < -m ? -m : v > m ? m : v);
const ease = (t: number) => t * t * (3 - 2 * t);
/** Out fast, settle slow. */
const out3 = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
/** 0 → 1 → 0 over 0..1, eased at both ends. */
const bump = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t));
/** A fidget's weight between `a` and `b` (seconds): in over `rise`, out
 *  over `fall`, held between. */
const span = (x: number, a: number, b: number, rise: number, fall: number) =>
  ease(clamp01((x - a) / rise)) * (1 - ease(clamp01((x - (b - fall)) / fall)));

/** World units per model unit, before the figure's own size (troops.ts
 *  draws figures TROOP_SCALE = 1.75 high). */
const MODEL = 1.75;
/** The banner's pole leans back this far (radians) from upright. */
const BANNER_LEAN = 0.2;

/** The attack's beats (seconds): the anticipation before the hit, the cut
 *  on it, the held follow-through and the recovery to guard. */
const ANTICIPATE = 0.6;
const CUT = 0.07;
const HOLD = 0.4;
const RECOVER = 0.42;

/** One moment of a blow: both arms' turn (the two fists share the hilt, so
 *  only their common turn about x keeps both on it), the blade in the
 *  fists, the chest's bend, turn and tilt, the head (eyes on the target),
 *  and the whole body. */
type Beat = {
  arms: number;
  blade: number;
  bend: number;
  turn: number;
  tilt: number;
  headX: number;
  headY: number;
  lean: number;
  lunge: number;
  yaw: number;
  squash: number;
};

const GUARD: Beat = {
  arms: 0.14,
  blade: -0.04,
  bend: 0.06,
  turn: 0.05,
  tilt: 0,
  headX: -0.04,
  headY: -0.05,
  lean: 0.03,
  lunge: 0,
  yaw: 0,
  squash: 1,
};
/** The big cut: the katana lifted high over the head, the blade dropping
 *  down the back, the chest coiled right and arched back... */
const RAISE: Beat = {
  arms: 2.32,
  blade: 0.34,
  bend: -0.17,
  turn: -0.32,
  tilt: 0.06,
  headX: 0.12,
  headY: 0.26,
  lean: -0.06,
  lunge: -0.06,
  yaw: -0.06,
  squash: 1.025,
};
/** ...then one diagonal stroke down through the target to low in front,
 *  bent into it, a long step forward. */
const CLEAVE: Beat = {
  arms: -0.42,
  blade: -0.25,
  bend: 0.4,
  turn: 0.3,
  tilt: -0.2,
  headX: -0.24,
  headY: -0.24,
  lean: 0.17,
  lunge: 0.42,
  yaw: 0.14,
  squash: 0.955,
};
/** The level cut: coiled far round to the right with the blade laid flat
 *  at the waist... */
const COIL: Beat = {
  arms: -0.08,
  blade: -0.5,
  bend: 0.14,
  turn: -0.92,
  tilt: 0.04,
  headX: -0.02,
  headY: 0.95,
  lean: 0.03,
  lunge: -0.08,
  yaw: -0.36,
  squash: 0.98,
};
/** ...then whipped round to the left through the target. */
const SWEEP: Beat = {
  arms: 0.06,
  blade: -0.45,
  bend: 0.22,
  turn: 0.78,
  tilt: -0.08,
  headX: -0.06,
  headY: -0.86,
  lean: 0.1,
  lunge: 0.32,
  yaw: 0.42,
  squash: 0.97,
};
/** The landing crouch: each leg's thigh (hip to knee pivot) and shin
 *  (knee to ankle pivot) as built, (forward, up) in model units
 *  (figure_duelist.py's wide stance, cut by articulation.py at 0.36 and
 *  0.10). */
const LEGS = {
  L: { thigh: [-0.021, -0.24], shin: [-0.052, -0.26] },
  R: { thigh: [0.066, -0.24], shin: [-0.004, -0.26] },
} as const;
const CROUCH = 0.17;

/** Hip, knee and ankle turns that lift the ankle `drop` towards the hip
 *  (model units) straight up, the knee bending forward and the sole kept
 *  level. */
function crouch(
  leg: { thigh: readonly number[]; shin: readonly number[] },
  drop: number,
) {
  const [ty, tz] = leg.thigh;
  const [sy, sz] = leg.shin;
  const l1 = Math.hypot(ty, tz);
  const l2 = Math.hypot(sy, sz);
  const gy = ty + sy;
  const gz = tz + sz + drop;
  const d = Math.min(l1 + l2 - 1e-4, Math.hypot(gy, gz));
  const base = Math.atan2(gz, gy);
  const a = Math.acos(
    Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))),
  );
  const thigh = base + a;
  const ky = Math.cos(thigh) * l1;
  const kz = Math.sin(thigh) * l1;
  const shin = Math.atan2(gz - kz, gy - ky);
  const hip = thigh - Math.atan2(tz, ty);
  const shinTurn = shin - Math.atan2(sz, sy);
  return { hip, knee: shinTurn - hip, foot: -shinTurn };
}

/** Per-troop scratch kept in `c.memo`. */
function memo(c: MoveContext, key: string, init: () => number) {
  let v = c.memo[key];
  if (v === undefined) v = c.memo[key] = init();
  return v;
}

/** The Samurai: a low, poised glide with the katana steady in chūdan; a
 *  long wind-up and one big blow, alternating a diagonal cleave from over
 *  his head with a level sweep, each held through before he settles back
 *  to guard with a flick of the blade. Waiting, he breathes slowly, shifts
 *  his stance, glances aside and turns the blade to the light. He drops
 *  onto the field into a crouch with a cut into the ground, and rises.
 *  The tassets trail his thighs, the shoulder guards bounce, the helmet's
 *  neck guard and the chin cord's ends swing, the belt rope's ends sway
 *  and the banner on his back whips and ripples. */
export const duelist: Moves = {
  style: {
    // Low and level, knees bent, the feet skimming: quick light steps
    // with the body floating over them.
    gait: {
      like: 'glide',
      // Both bent elbows keep the same hilt while the shoulders turn together.
      elbow: 0,
      cadence: 2.15,
      stride: 0.6,
      crouch: 0.05,
      bounce: 0.014,
      lift: 0.065,
      sway: 0.22,
      roll: 0.014,
      twist: 0.1,
      heel: 0.16,
      toe: 0.36,
      nod: 0.012,
    },
    armSwing: 0.07,
    twoHanded: true,
    lean: 0.15,
    attack: 'custom',
    windup: 0.42,
    lunge: 0.42,
    snap: 34,
  },
  carriage: {
    twist: 0.05,
    hips: 0.07,
    chestRoll: -0.5,
    nod: 0.012,
    armOut: 0,
    bounce: 0.03,
    weaponArm: 1,
  },
  stiff: {
    skirtL: 0.62,
    skirtR: 0.62,
    sleeveL: 0.5,
    sleeveR: 0.5,
    hat: 0.5,
    beard: 0.38,
    tail: 0.4,
    cape: 0.36,
  },
  damping: {
    skirtL: 0.42,
    skirtR: 0.42,
    sleeveL: 0.36,
    sleeveR: 0.36,
    hat: 0.4,
    beard: 0.32,
    tail: 0.32,
    cape: 0.26,
    weapon: 0.5,
  },
  arrive(d) {
    // A leap in: falling fast, half a turn into his facing, and a hard
    // landing (the crouch itself is in `pose`).
    const f = clamp01(d / 0.26);
    const drop = d < 0.26 ? (1 - f * f) * 2.8 : 0;
    const twirl = d < 0.26 ? -(1 - f) * (1 - f) * Math.PI : 0;
    const land = clamp01((d - 0.26) / 0.12);
    const squash =
      d < 0.26 ? 1.04 : 1 - Math.sin(land * Math.PI) * 0.1 * (1 - land * 0.5);
    return { drop, squash, twirl };
  },
  pose(c, p) {
    const { aim, walk, idle } = c;
    const t = c.t;
    const seed = memo(c, 'seed', () => Math.random() * 40);

    // ---- The blow. The coming one alternates with the hits: the wind-up
    // belongs to the next hit, the follow-through to the one just landed.
    const nextLevel = (c.hits + 1) % 2 === 1;
    const lastLevel = c.hits % 2 === 1;
    const W = nextLevel ? COIL : RAISE;
    const S = lastLevel ? SWEEP : CLEAVE;
    // A long rise that slows into a held, trembling top.
    const x = clamp01((ANTICIPATE - c.toHit) / ANTICIPATE);
    const rise =
      x < 0.62 ? 0.9 * ease(x / 0.62) : 0.9 + 0.1 * ((x - 0.62) / 0.38);
    const since = c.since;
    let through = 0;
    if (since < CUT) through = out3(since / CUT);
    else if (since < CUT + HOLD) through = 1 - 0.08 * ((since - CUT) / HOLD);
    else if (since < CUT + HOLD + RECOVER)
      through = 0.92 * (1 - ease((since - CUT - HOLD) / RECOVER));
    // The engine's timer restarts on the hit: the wind-up only while the
    // stroke is not still out.
    const wind = c.toHit < ANTICIPATE && through === 0 ? rise * aim : 0;
    const strike = through * aim;
    const beat = (k: keyof Beat) =>
      aim * GUARD[k] + wind * (W[k] - GUARD[k]) + strike * (S[k] - GUARD[k]);
    // The diagonal comes down from alternate shoulders.
    const side = Math.floor(c.hits / 2) % 2 === 0 ? 1 : -1;
    let arms = beat('arms');
    let blade = beat('blade');
    p.torsoX += beat('bend');
    p.torsoY += beat('turn');
    p.torsoZ += beat('tilt') * (lastLevel ? 1 : side);
    p.headX += beat('headX');
    p.headY += beat('headY');
    p.lean += beat('lean');
    // The step into the blow is quick and short: he draws back to half of
    // it while he holds the follow-through (the figures are drawn larger
    // than their footing, so a held lunge would run into the target).
    const reach =
      since < CUT ? 1 : 1 - 0.5 * ease(clamp01((since - CUT) / 0.22));
    p.lunge +=
      aim * GUARD.lunge +
      wind * (W.lunge - GUARD.lunge) +
      strike * (S.lunge - GUARD.lunge) * reach;
    p.yawKick += beat('yaw');
    p.squash *= 1 + (beat('squash') - aim);
    // Tension at the top of the rise: a fine tremble in the raised blade.
    arms += wind * x * x * Math.sin(t * 47) * 0.012;
    // Sinking into the stance through the stroke (the feet stay planted).
    p.lift -= strike * 0.022 * c.size;
    // Back to guard with a flick of the blade (chiburi) and a breath out.
    const back = (since - CUT - HOLD) / RECOVER;
    if (back > 0 && back < 1 && aim > 0.05) {
      const flick = bump(clamp01(back / 0.45));
      blade += flick * 0.55 * aim;
      arms += flick * 0.22 * aim;
      p.headX -= flick * 0.04;
    }

    // ---- Waiting: still and poised, but alive.
    // The shared idle looks round and rocks; he holds his gaze instead.
    p.headY -= (Math.sin(t * 0.61) * 0.3 + Math.sin(t * 1.7) * 0.08) * idle;
    p.headX -= Math.sin(t * 1.3) * 0.04 * idle;
    p.roll -= Math.sin(t * 0.9) * 0.02 * idle;
    // Slow, deep breaths: the chest and the shoulders rise with each.
    const breath = Math.sin(t * 1.5);
    p.torsoX += breath * 0.02 * idle - 0.015 * idle;
    arms += breath * 0.03 * idle;
    // Fidgets, by how long he has stood: settling into the stance as he
    // stops, then a glance aside, the blade turned to catch the light and
    // a shift of weight, round and round.
    const still = c.idleFor;
    const settle = bump(clamp01(still / 0.9)) * idle;
    p.lift -= settle * 0.026 * c.size;
    p.roll += settle * Math.sin(still * 7) * 0.03;
    blade -= settle * 0.08;
    const round = still + (seed % 8);
    const lap = round % 8.5;
    const odd = Math.floor(round / 8.5) % 2 === 0 ? 1 : -1;
    const awake = clamp01(still - 1) * idle;
    const glance = span(lap, 1.2, 2.6, 0.14, 0.22) * awake;
    p.headY += glance * 0.48 * odd;
    p.headX -= glance * 0.04;
    p.torsoY += glance * 0.1 * odd;
    const shine = span(lap, 3.6, 5.9, 0.5, 0.6) * awake;
    // Lifted a little, the blade rolls in his fists (about its own length,
    // so the hilt stays in both hands) and he looks along it.
    arms += shine * 0.32;
    const roll = shine * Math.sin((lap - 3.6) * 2.4) * 0.5;
    p.headX += shine * 0.14;
    p.headY -= shine * 0.22;
    const shift = span(lap, 6.6, 8.0, 0.35, 0.5) * awake;
    p.roll += shift * 0.05 * odd;
    p.torsoZ -= shift * 0.06 * odd;
    p.lift -= shift * 0.015 * c.size;

    // ---- On the move: the shoulders and the blade bob on each step, the
    // chest turns a little further against the hips and the head rides
    // level, a touch forward, eyes on what is ahead.
    const land = Math.pow(1 - c.pass, 4) * walk;
    arms -= land * 0.035;
    blade += land * 0.05;
    p.torsoX += land * 0.02;
    p.torsoY += (c.fwdL - c.fwdR) * 0.03 * walk;
    p.headY -= (c.fwdL - c.fwdR) * 0.025 * walk;
    p.headX += 0.05 * walk;

    // ---- Hit: knocked aside, the guard dropping and the blade wobbling,
    // then straight back up.
    const lastFlinch = c.memo.flinch ?? 0;
    if (c.flinch > lastFlinch + 0.2)
      c.memo.hitSide = Math.random() < 0.5 ? -1 : 1;
    c.memo.flinch = c.flinch;
    const hitSide = c.memo.hitSide ?? 1;
    const f = c.flinch * c.flinch;
    p.torsoY += f * 0.24 * hitSide;
    p.torsoZ += f * 0.1 * hitSide;
    p.headY -= f * 0.18 * hitSide;
    arms -= f * 0.3;
    blade += f * 0.3;
    p.lunge -= f * 0.12;

    // ---- Deploying: a leap down, landing in a crouch with a cut into
    // the ground, then up into guard.
    const d = c.deploy;
    let tuck = 0;
    let low = 0;
    if (d < 1) {
      const air = d < 0.26 ? 1 : 0;
      tuck = air * (0.6 + 0.4 * clamp01(d / 0.2));
      low = d < 0.26 ? 0 : d < 0.62 ? 1 : 1 - ease((d - 0.62) / 0.34);
      // In the air the blade is high; on landing it is driven down and
      // held low; rising, it comes back up with a flick to guard.
      const slam = d < 0.26 ? 0 : out3(clamp01((d - 0.26) / 0.06));
      const up = ease(clamp01((d - 0.62) / 0.3));
      const deployArms = air * 2.1 + (1 - air) * (-0.62 * slam * (1 - up));
      const deployBlade = air * 0.1 + (1 - air) * (-0.5 * slam * (1 - up));
      arms = arms * up + deployArms;
      blade += deployBlade + bump(clamp01((d - 0.7) / 0.25)) * 0.5;
      p.torsoX += low * 0.42 - air * 0.12;
      p.headX -= low * 0.32 - air * 0.15;
      p.lean += low * 0.06;
      p.torsoY += low * 0.18 - air * 0.2;
      p.headY -= low * 0.15;
    }

    // Both fists on the hilt: the arms turn together.
    // Connected sleeves now have real elbow bones, held in the authored
    // two-handed guard instead of inheriting independent walking bends.
    c.want('foreL', 0);
    c.want('foreR', 0);
    p.armL += arms;
    p.armR += arms;
    // The blade's own turns in the fists: tipping (x), and rolling about
    // its length (the katana leans 30 degrees right and 36 up from the
    // fists; small turns about that axis, in three.js terms).
    const ax = 0.405;
    const ay = 0.588;
    const az = -0.7;
    c.want('weapon', p.weapon + blade + roll * ax, roll * ay, roll * az);

    // ---- The legs in the crouch: off the ground solver while it lasts,
    // the body lowered so the feet stay on the field.
    const bend = Math.max(tuck * 0.55, low) * CROUCH;
    if (bend > 0.001) {
      for (const s of ['L', 'R'] as const) {
        const j = crouch(LEGS[s], bend);
        const lift = tuck * (s === 'L' ? 0.25 : 0.45);
        c.want(`leg${s}`, j.hip + lift);
        c.want(`knee${s}`, j.knee - tuck * 0.5);
        c.want(`foot${s}`, j.foot + tuck * 0.35);
      }
      p.lift -= low * CROUCH * MODEL * c.size;
    }

    secondary(c, p, arms);
  },
};

/** Everything that hangs or stands on him, lagging the body. */
function secondary(c: MoveContext, p: Pose, arms: number) {
  const { walk } = c;
  const ahead = clamp(c.accel * 0.024, 0.3);
  const across = clamp(c.lateral * 0.024, 0.3);
  const upward = clamp(c.vertical * 0.012, 0.35);
  const turn = clamp(c.turn * 0.06, 0.3);
  // A thump as each foot takes the weight.
  const land = Math.pow(1 - c.pass, 4) * walk;
  const flinch = c.flinch * c.flinch;

  // Kusazuri: each side's tassets follow its thigh (closely, as the leg
  // pushes them), hang straight whatever the chest does, swing back as he
  // sets off and flare out on landings, turns and blows.
  const hang = p.torsoX + p.lean * 0.6;
  for (const [s, hip, out] of [
    ['L', c.hipL, -1],
    ['R', c.hipR, 1],
  ] as const) {
    const flare =
      0.02 * walk +
      Math.abs(hip) * 0.08 +
      land * 0.05 -
      upward * 0.5 +
      flinch * 0.08;
    c.want(
      `skirt${s}`,
      hip * 0.78 + hang - ahead + flinch * 0.1,
      -p.torsoY * 0.35,
      out * flare - p.torsoZ * 0.7 - across + turn,
    );
  }

  // Sode: hung from the shoulders, they stay low as the arms lift (most
  // of the arms' turn taken back), riding up and out over the raised
  // elbows; they bounce out on each step and on landings, and swing with
  // the body.
  const lifted = clamp01(arms / 2.3);
  for (const [s, out] of [
    ['L', -1],
    ['R', 1],
  ] as const) {
    c.want(
      `sleeve${s}`,
      -Math.max(0, arms) * 0.64 - ahead * 0.8 + flinch * 0.15,
      0,
      out *
        (lifted * 0.24 +
          land * 0.07 -
          upward * 0.6 +
          flinch * 0.1 +
          0.01 * walk) -
        across +
        turn,
    );
  }

  // The helmet's neck guard (shikoro) flares and sways behind the head.
  c.want(
    'hat',
    -ahead * 0.5 + land * 0.04 + flinch * 0.1 - (p.headX + p.torsoX) * 0.15,
    0,
    -across * 0.5 + turn * 0.6 - upward * 0.2 * (c.memo.hitSide ?? 1),
  );

  // The chin cord's ends hang under the chin whatever the head does,
  // swing on the steps and whip in the blow (never back into the throat).
  const chin = p.headX + p.torsoX + p.lean;
  c.want(
    'beard',
    Math.max(-0.05, chin * 0.8 - ahead * 1.2 + land * 0.12 + flinch * 0.3),
    0,
    -p.roll - p.torsoZ - across * 1.4 + turn * 1.2 + Math.sin(c.t * 2.1) * 0.03,
  );

  // The belt rope's ends, over the front left tassets: they move with the
  // tassets and a little ahead of them, swinging on their own.
  const tassets = c.hipL * 0.78 + hang;
  c.want(
    'tail',
    tassets + Math.max(0, 0.04 - ahead) + land * 0.06 + flinch * 0.2,
    0,
    -p.torsoZ * 0.8 - across * 1.3 + turn * 1.2 + Math.sin(c.t * 1.7) * 0.025,
  );

  // The banner: its pole whips back as he sets off and forward as he
  // stops, leans out in turns, sways on the steps and shakes in the blow.
  const strike = clamp01(c.aim) * (c.since < 0.35 ? 1 - c.since / 0.35 : 0);
  c.want(
    'cape',
    // Leaning back off his shoulders, clear of the helmet's crest from
    // the game's high camera, and kept nearer upright as he bends.
    BANNER_LEAN +
      ahead * 0.7 -
      land * 0.025 +
      strike * 0.08 +
      flinch * 0.12 +
      (p.torsoX + p.lean) * 0.3,
    0,
    across * 0.8 - turn * 0.9 + (c.fwdL - c.fwdR) * 0.02 * walk,
  );
}
