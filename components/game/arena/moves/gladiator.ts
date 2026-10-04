import type { Moves } from './types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const span = (t: number, a: number, b: number) =>
  ease((t - a) / 0.4) * (1 - ease((t - b) / 0.4));

const STYLE = {
  // A soldier's steady, upright tread under the weight of the shield.
  gait: { like: 'brisk', weight: 0.55, stride: 0.62, sway: 0.4 } as const,
  armSwing: 0.32,
  lean: 0.07,
  attack: 'custom' as const,
  windup: 0.34,
  lunge: 0.24,
  snap: 24,
};

/** The Gladiator: the big shield held steady in front, raised to the chin
 *  in a fight while the short sword is drawn back and thrust past its
 *  edge; the kilt's strips trail the legs. Once `unit.shield` is spent
 *  the shield arm hangs at his side. */
export const gladiator: Moves = {
  style: STYLE,
  carriage: {
    twist: 0.08,
    hips: 0.07,
    chestRoll: -0.6,
    nod: 0.012,
    armOut: 0.04,
    bounce: 0.012,
    weaponArm: 0.75,
  },
  stiff: { shield: 1.15, hair: 0.4, skirtL: 0.6, skirtR: 0.6 },
  damping: { shield: 0.64, hair: 0.38, skirtL: 0.46, skirtR: 0.46 },
  arrive(d) {
    const fall = clamp01(d / 0.3);
    const land = clamp01((d - 0.3) / 0.22);
    return {
      drop: d < 0.3 ? 2.2 * (1 - fall * fall) : 0,
      squash: 1 - Math.sin(land * Math.PI) * 0.065,
      twirl: 0,
    };
  },
  pose(c, p) {
    const { aim, walk } = c;
    const idle = c.reduced ? 0 : c.idle;
    let wind = c.wind;
    let strike = 0;
    if (c.since < 0.065) {
      strike = 1 - Math.pow(1 - clamp01(c.since / 0.065), 3);
      wind = 1 - strike;
    } else if (c.since < 0.2) {
      strike = 1;
      wind = 0;
    } else if (c.since < 0.48) {
      strike = 1 - ease((c.since - 0.2) / 0.28);
      wind = 0;
    }
    wind *= aim;
    strike *= aim;
    // The shield's hit points: once spent it hangs at his side. Units
    // built by hand (the lab, placement previews) carry none at all, so
    // only a shield seen holding and then emptied counts as spent.
    const hp = c.unit.shield;
    if (hp > 0) c.memo.shieldSeen = 1;
    const holding = hp > 0 || !c.memo.shieldSeen ? 1 : 0;
    const hold = (c.memo.shieldMix =
      (c.memo.shieldMix ?? holding) +
      (holding - (c.memo.shieldMix ?? holding)) * (1 - Math.exp(-c.dt * 10)));
    const up = aim * hold;
    const hit = c.flinch * c.flinch;

    // The shield arm: steady (hardly any swing while he walks), up to the
    // chin on guard, lowered a little while he waits.
    p.armL *= hold ? 0.2 : 1;
    p.armL += up * 0.3 - idle * hold * 0.05 - (1 - hold) * 0.12;
    p.armLz -= (1 - hold) * 0.18;
    let foreL = up * 0.3 - idle * hold * 0.12 - (1 - hold) * 0.5;
    foreL += strike * up * 0.06 + hit * hold * 0.1;

    // The sword arm: drawn back to the hip on guard, further on the
    // wind-up, then a straight thrust past the shield's right edge; the
    // blade stays level through it all.
    const lap = (c.idleFor + c.unit.id * 0.53) % 8.8;
    const awake = ease(c.idleFor - 1) * idle;
    const inspect = span(lap, 2.0, 3.4) * awake;
    const glance = span(lap, 5.6, 6.7) * awake;
    const armR =
      aim * -0.3 + wind * -0.3 + strike * 1.55 + inspect * 0.38 - hit * 0.15;
    const foreR = aim * 0.5 + wind * 0.45 - strike * 0.75 + inspect * 0.15;
    p.armR += armR;
    p.armRz += strike * -0.1;
    p.weapon += -(armR + foreR) * 0.92 + idle * Math.sin(c.t * 0.9) * 0.08;
    // The shoulders turn back behind the wind-up and drive into the thrust.
    const twist = aim * -0.1 - wind * 0.22 + strike * 0.42;
    p.torsoY += twist;
    p.torsoX += aim * 0.1 + strike * 0.12 - wind * 0.04;
    p.headY -= twist * 0.75;
    p.headX += up * 0.06;
    p.lean += strike * 0.08 - wind * 0.03;
    p.lunge += strike * STYLE.lunge;
    p.roll -= wind * 0.03;
    p.headX += inspect * 0.16;
    p.headY += -inspect * 0.25 + glance * 0.4;
    p.torsoY += glance * 0.06 - hit * 0.12;
    p.torsoZ += hit * 0.08;
    p.lunge -= hit * 0.08;
    // On landing the shield leads, the sword stays clear behind it.
    const landing = Math.sin(clamp01((c.deploy - 0.28) / 0.3) * Math.PI);
    p.armL += landing * 0.12 * hold;
    p.torsoX += landing * 0.1;
    p.headX -= landing * 0.06;

    c.want('foreL', foreL);
    // Compensate the final arm and chest pose, including landing and
    // deflection, so the shield remains an upright surface in the fist.
    const shield =
      hold * (-(p.armL + foreL) + p.torsoX + p.lean) + (1 - hold) * 0.3;
    c.want('shield', shield, hit * hold * 0.08, hit * hold * 0.1);
    c.want('foreR', foreR + walk * (1 - aim) * 0.1 * (1 + c.fwdL));

    // The kilt's halves trail the thighs and hang against the bend.
    const soft = c.reduced ? 0.25 : 1;
    const ahead = clamp(c.accel * 0.016, 0.2) * soft;
    const across = clamp(c.lateral * 0.018, 0.18) * soft;
    const turn = clamp(c.turn * 0.045, 0.2) * soft;
    const land = Math.pow(1 - c.pass, 4) * walk;
    const hang = p.torsoX + p.lean * 0.6;
    c.want(
      'skirtL',
      c.hipL * 0.62 + hang - ahead,
      -p.torsoY * 0.35,
      -land * 0.035 - across + turn,
    );
    c.want(
      'skirtR',
      c.hipR * 0.62 + hang - ahead,
      -p.torsoY * 0.35,
      land * 0.035 - across + turn,
    );
    c.want(
      'hair',
      clamp(ahead * 0.45 + land * 0.07 - hit * 0.1, 0.18),
      0,
      clamp(across * 0.5 - turn * 0.65, 0.2),
    );
  },
};
