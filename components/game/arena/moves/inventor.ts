import type { Moves } from './types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const span = (t: number, a: number, b: number) =>
  ease((t - a) / 0.35) * (1 - ease((t - b) / 0.45));

const ARM_SWING = 0.36;
/** How much of each thigh's swing its coat tail follows. */
const TAILS = 0.66;

/** The Inventor: a quick, eager walk with a bounce, the coil's ball bobbing
 *  behind her head; to attack she draws the wand back by her shoulder while
 *  it crackles, then thrusts it at the target as the lightning leaps. */
export const inventor: Moves = {
  style: {
    // Quick and eager, a bounce in it.
    gait: { like: 'light', stride: 0.62, arms: ARM_SWING },
    armSwing: ARM_SWING,
    lean: 0.04,
    attack: 'custom',
    windup: 0.4,
    lunge: 0.12,
    snap: 30,
  },
  carriage: {
    twist: 0.12,
    hips: 0.09,
    chestRoll: -0.5,
    nod: 0.014,
    armOut: 0.08,
    bounce: 0.012,
    weaponArm: 0.55,
  },
  stiff: { extra: 0.42, hair: 0.4, hat: 0.43, skirtL: 0.6, skirtR: 0.6 },
  damping: { extra: 0.36, hair: 0.4, hat: 0.42, skirtL: 0.45, skirtR: 0.45 },
  arrive(d) {
    const fall = clamp01(d / 0.3);
    const land = clamp01((d - 0.3) / 0.24);
    return {
      drop: d < 0.3 ? 2.2 * (1 - fall * fall) : 0,
      squash: 1 - Math.sin(land * Math.PI) * 0.065,
      twirl: (1 - ease(d / 0.3)) * 0.4,
    };
  },
  pose(c, p) {
    const { aim, walk, t } = c;
    const idle = c.reduced ? 0 : c.idle;
    let wind = c.wind;
    let strike = 0;
    if (c.since < 0.055) {
      strike = 1 - Math.pow(1 - clamp01(c.since / 0.055), 3);
      wind = 1 - strike;
    } else if (c.since < 0.17) {
      strike = 1;
      wind = 0;
    } else if (c.since < 0.48) {
      strike = 1 - ease((c.since - 0.17) / 0.31);
      wind = 0;
    }
    wind *= aim;
    strike *= aim;
    // The coat tails trail the thighs.
    const hipL = c.hipL;
    const hipR = c.hipR;

    // The wand arm swings half as much as the other.
    p.armR -= c.swingR * 0.5;

    // Crackle: a fast, uneven shake that grows through the charge.
    const buzz = c.reduced
      ? 0
      : wind * (Math.sin(t * 39) * 0.012 + Math.sin(t * 27) * 0.008);

    // Ready at aim; drawn back and up by the shoulder on the charge; the
    // arm shoots straight at the target on the hit.
    p.armR += aim * 0.7 - wind * 0.15 + strike * 0.6 + buzz;
    p.armRz += wind * 0.3 + strike * 0.05;
    let fore = -aim * 0.2 + wind * 1.55 - strike * 0.35 - buzz * 0.6;
    p.weapon += -aim * 0.1 - wind * 0.5 - strike * 0.2;
    // Right shoulder back as she coils, then thrown forward; the head keeps
    // her eyes on the target.
    p.torsoY += aim * 0.06 - wind * 0.2 + strike * 0.24;
    p.headY += wind * 0.18 - strike * 0.2;
    p.torsoX += -wind * 0.06 + strike * 0.1;
    p.lean += strike * 0.06 - wind * 0.03;
    p.lunge += strike * 0.12;
    p.armL += aim * 0.25 + wind * 0.45 - strike * 0.4;
    p.armLz -= wind * 0.25 + strike * 0.3;
    p.roll += buzz * 0.2;
    // She checks the wand's tip, then looks back at her coil, keeping the
    // instrument in her right hand throughout.
    const lap = (c.idleFor + c.unit.id * 0.59) % 8.9;
    const awake = ease(c.idleFor - 1) * idle;
    const check = span(lap, 1.4, 3.2) * awake;
    const coil = span(lap, 5.7, 6.8) * awake;
    p.armR += check * 0.38;
    fore += check * 0.5;
    p.weapon -= check * 0.25;
    p.headX += check * 0.13;
    p.headY -= check * 0.2;
    p.headY += coil * 0.48;
    p.torsoY += coil * 0.1;
    p.armL += check * 0.2;
    c.want('foreL', walk * 0.1 * (1 + c.fwdR) + wind * 0.3 + check * 0.25);
    const hit = c.flinch * c.flinch;
    p.torsoZ -= hit * 0.08;
    p.headY += hit * 0.12;
    p.armR -= hit * 0.12;
    fore += hit * 0.12;
    p.lunge -= hit * 0.06;
    c.want('foreR', fore);
    const landing = Math.sin(clamp01((c.deploy - 0.28) / 0.3) * Math.PI);
    p.torsoX += landing * 0.1;
    p.headX -= landing * 0.06;
    const soft = c.reduced ? 0.25 : 1;
    const ahead = clamp(c.accel * 0.02, 0.22) * soft;
    const across = clamp(c.lateral * 0.02, 0.2) * soft;
    const turn = clamp(c.turn * 0.05, 0.22) * soft;
    const up = clamp(c.vertical * 0.012, 0.2) * soft;
    const land = Math.pow(1 - c.pass, 4) * walk;
    // The tails hang from the torso: turn them back against its twist so
    // they stay square over the legs.
    const hang = p.torsoX + p.lean * 0.6;
    c.want(
      'skirtL',
      hipL * TAILS + hang - ahead,
      -p.torsoY * 0.85,
      -land * 0.045 - across + turn,
    );
    c.want(
      'skirtR',
      hipR * TAILS + hang - ahead,
      -p.torsoY * 0.85,
      land * 0.045 - across + turn,
    );

    // The coil's ball: a gentle throb standing, a bob that lags each step,
    // rising and shivering as it charges, kicked back on the zap.
    const throb = Math.sin(t * 2.4) * 0.006 * idle;
    const step = -c.pass * 0.012 * walk;
    c.want(
      'extra',
      ahead * 0.65 - land * 0.04 + buzz - strike * 0.12 + hit * 0.08,
      0,
      across * 0.65 - turn * 0.6 + buzz,
      throb + step - up * 0.02 + wind * 0.01 - strike * 0.006,
    );
    for (const [part, side] of [
      ['hair', -1],
      ['hat', 1],
    ] as const)
      c.want(
        part,
        clamp(ahead * 0.3 + land * 0.045 - hit * 0.08, 0.12),
        0,
        clamp(
          across * 0.35 - turn * 0.45 + side * (land * 0.025 - up * 0.12),
          0.12,
        ),
      );
  },
};
