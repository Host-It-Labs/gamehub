import type { MoveContext, Moves } from './types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const span = (t: number, a: number, b: number) =>
  ease((t - a) / 0.3) * (1 - ease((t - b) / 0.4));

/** The right arm's turns for one moment of a slash: raised forward (x),
 *  out to the side (z), the elbow's bend and the blade's tilt in the fist. */
type Arm = {
  x: number;
  z: number;
  fore: number;
  blade: number;
  twist: number;
  bend: number;
};

/** Cutlass up and forward, ready. */
const GUARD: Arm = {
  x: 0.55,
  z: 0.1,
  fore: 0.5,
  blade: 0,
  twist: 0,
  bend: 0.04,
};
/** Forehand: the fist high by the right ear, the blade laid back over the
 *  hat, then one diagonal cut down and across in front of her. */
const FORE_WIND: Arm = {
  x: 0.6,
  z: 1.5,
  fore: 1.4,
  blade: 0.3,
  twist: -0.38,
  bend: -0.06,
};
const FORE_CUT: Arm = {
  x: 1.15,
  z: -0.3,
  fore: 0.05,
  blade: -0.6,
  twist: 0.4,
  bend: 0.2,
};
/** Backhand: the fist to the left shoulder, then a flat sweep out right. */
const BACK_WIND: Arm = {
  x: 0.9,
  z: -0.7,
  fore: 1.5,
  blade: 0.2,
  twist: 0.4,
  bend: 0,
};
const BACK_CUT: Arm = {
  x: 1.3,
  z: 0.7,
  fore: 0.1,
  blade: -0.1,
  twist: -0.35,
  bend: 0.15,
};

const STYLE = {
  // Quick and springy, up on her toes.
  gait: { like: 'light', sway: 0.36, roll: 0.05, twist: 0.12 } as const,
  armSwing: 0.38,
  lean: 0.08,
  attack: 'custom' as const,
  windup: 0.28,
  lunge: 0.22,
  snap: 30,
};

const LEAP_TIME = 0.5;
const LEAP_HEIGHT = 0.4;

function leap(c: MoveContext) {
  const dashing = c.unit.dash;
  let mix = c.memo.leapMix ?? 0;
  mix += ((dashing ? 1 : 0) - mix) * (1 - Math.exp(-c.dt * 14));
  if (!dashing && mix < 0.002) mix = 0;
  c.memo.leapMix = mix;
  const air = (c.memo.leapTime = dashing ? (c.memo.leapTime ?? 0) + c.dt : 0);
  const arc = dashing ? Math.sin(Math.PI * Math.min(1, air / LEAP_TIME)) : 0;
  return { mix, arc };
}

/** The Pirate: a quick swagger, alternating cutlass slashes, a hand on
 *  her hip while she waits, the braid swinging; leaps at a new target. */
export const pirate: Moves = {
  style: STYLE,
  carriage: {
    twist: 0.13,
    hips: 0.09,
    chestRoll: -0.45,
    nod: 0.012,
    armOut: 0.1,
    bounce: 0.012,
    weaponArm: 0.45,
  },
  stiff: {
    hat: 0.55,
    tail: 0.42,
    tail2: 0.32,
    tail3: 0.27,
    skirtL: 0.62,
    skirtR: 0.62,
  },
  damping: {
    hat: 0.5,
    tail: 0.4,
    tail2: 0.34,
    tail3: 0.3,
    skirtL: 0.46,
    skirtR: 0.46,
  },
  arrive(d) {
    const fall = clamp01(d / 0.3);
    const land = clamp01((d - 0.3) / 0.23);
    return {
      drop: d < 0.3 ? 2.4 * (1 - fall * fall) : 0,
      squash: 1 - Math.sin(land * Math.PI) * 0.08,
      twirl: -(1 - ease(d / 0.3)) * 0.6,
    };
  },
  pose(c, p) {
    const { aim, walk } = c;
    const idle = c.reduced ? 0 : c.idle;
    // The slash passes continuously from its anticipation to the cut, is
    // held for a beat, then settles back to guard instead of snapping home.
    let wind = c.wind;
    let strike = 0;
    if (c.since < 0.055) {
      strike = 1 - Math.pow(1 - clamp01(c.since / 0.055), 3);
      wind = 1 - strike;
    } else if (c.since < 0.16) {
      strike = 1;
      wind = 0;
    } else if (c.since < 0.4) {
      strike = 1 - ease((c.since - 0.16) / 0.24);
      wind = 0;
    }
    wind *= aim;
    strike *= aim;
    // The coming blow alternates with the hits: the wind-up belongs to
    // the next hit, the strike to the one just landed.
    const nextFore = (c.hits + 1) % 2 === 0;
    const W =
      c.since < 0.4
        ? c.hits % 2 === 0
          ? FORE_WIND
          : BACK_WIND
        : nextFore
          ? FORE_WIND
          : BACK_WIND;
    const S = c.hits % 2 === 0 ? FORE_CUT : BACK_CUT;
    const arm = (k: keyof Arm) =>
      aim * GUARD[k] + wind * (W[k] - GUARD[k]) + strike * (S[k] - GUARD[k]);

    p.armR += arm('x');
    p.armRz += arm('z');
    p.weapon += arm('blade');
    const twist = arm('twist');
    p.torsoY += twist;
    p.torsoX += arm('bend');
    // Eyes stay on the target while the shoulders turn.
    p.headY -= twist * 0.7;
    p.headX += wind * 0.05 - strike * 0.05;
    p.lean += strike * 0.1 - wind * 0.04;
    p.lunge += strike * STYLE.lunge;
    p.roll += (nextFore ? -1 : 1) * wind * 0.05;
    // The free hand out for balance, swung back as the cut goes through.
    p.armL += aim * 0.35 - strike * (S === FORE_CUT ? 0.55 : 0.1);
    p.armLz -= aim * 0.3;

    // Waiting: the left fist on her hip, the weight on one leg.
    p.armL += idle * 0.12;
    p.armLz -= idle * 0.62;
    p.roll += idle * Math.sin(c.t * 0.7) * 0.025;
    p.headY += idle * 0.1;
    // A quick look down the cutlass, then a glance over her free shoulder.
    // The hand on her hip remains there: no detached fingers or tool swap.
    const lap = (c.idleFor + c.unit.id * 0.71) % 8.2;
    const awake = ease(c.idleFor - 1) * idle;
    const inspect = span(lap, 1.6, 3.0) * awake;
    const look = span(lap, 5.0, 6.0) * awake;
    p.armR += inspect * 0.42;
    p.armRz += inspect * 0.12;
    p.weapon -= inspect * 0.24;
    p.headX += inspect * 0.14;
    p.headY -= inspect * 0.25;
    p.headY += look * 0.55;
    p.torsoY += look * 0.08;
    const hit = c.flinch * c.flinch;
    p.torsoZ -= hit * 0.11;
    p.headY += hit * 0.15;
    p.armR -= hit * 0.18;
    p.lunge -= hit * 0.08;

    // Elbows: a little flex on the forward swing of each arm.
    let foreR = arm('fore') + walk * (1 - aim) * 0.1 * (1 + c.fwdL);
    let foreL = aim * 0.6 + walk * (1 - aim) * 0.12 * (1 + c.fwdR);
    let foreLz = idle * 1.25;
    foreL += idle * 0.45;

    // The leap: a crouched lunge in the air, legs split, blade raised.
    const { mix: d, arc } = leap(c);
    // The thighs as the ground solver turned them (troops.ts).
    let hipL = c.hipL;
    let hipR = c.hipR;
    if (d > 0) {
      // In the air the legs are hers: sprung from where they were into the
      // split, and planted again where they land.
      const keep = 1 - d;
      hipL = hipL * keep + 0.95 * d;
      hipR = hipR * keep - 0.6 * d;
      c.want('legL', hipL);
      c.want('kneeL', -1.1 * d);
      c.want('footL', 0.2 * d);
      c.want('legR', hipR);
      c.want('kneeR', -0.5 * d);
      c.want('footR', 0.5 * d);
      p.torsoX += 0.35 * d;
      p.torsoY -= 0.2 * d;
      p.headX -= 0.25 * d;
      p.armR += 1.45 * d;
      p.armRz += 0.3 * d;
      p.weapon += 0.3 * d;
      p.armL -= 0.8 * d;
      p.armLz -= 0.4 * d;
      foreR += 0.5 * d;
      foreL += 0.3 * d;
      foreLz *= keep;
      p.lean += 0.2 * d;
      p.lift += arc * LEAP_HEIGHT * c.size;
      p.squash *= 1 - 0.06 * d * (1 - arc);
    }
    c.want('foreR', foreR);
    c.want('foreL', foreL, 0, foreLz);

    // The waistcoat's skirts trail the thighs and hang against the bend.
    const soft = c.reduced ? 0.25 : 1;
    const ahead = clamp(c.accel * 0.018, 0.22) * soft;
    const across = clamp(c.lateral * 0.02, 0.22) * soft;
    const turn = clamp(c.turn * 0.05, 0.24) * soft;
    const land = Math.pow(1 - c.pass, 4) * walk;
    const hang = p.torsoX + p.lean * 0.6;
    c.want(
      'skirtL',
      hipL * 0.62 + hang - ahead,
      -p.torsoY * 0.35,
      -land * 0.04 - across + turn,
    );
    c.want(
      'skirtR',
      hipR * 0.62 + hang - ahead,
      -p.torsoY * 0.35,
      land * 0.04 - across + turn,
    );
    // The braid hangs from the nape against every nod and bend, bounces
    // on each step, swings with the hips and flies back in a leap.
    c.want(
      'tail',
      p.headX +
        p.torsoX +
        p.lean * 0.8 -
        ahead -
        c.pass * 0.05 * walk -
        0.4 * d +
        hit * 0.1,
      -p.headY * 0.15,
      -p.roll * 0.8 - across + turn + (c.fwdL - c.fwdR) * 0.04 * walk,
    );
    c.want(
      'tail2',
      -ahead * 0.65 - d * 0.18 + land * 0.025,
      0,
      turn * 0.65 - across * 0.7,
    );
    c.want(
      'tail3',
      -ahead * 0.45 - d * 0.1 + land * 0.04,
      0,
      turn * 0.8 - across * 0.55,
    );
    c.want(
      'hat',
      clamp(-ahead * 0.25 - land * 0.035 + hit * 0.04, 0.07),
      0,
      clamp(-across * 0.2 + turn * 0.15, 0.04),
    );
  },
};
