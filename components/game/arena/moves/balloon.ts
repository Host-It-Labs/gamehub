import type { Moves } from './types';

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const clamp01 = (t: number) => clamp(t, 0, 1);
const ease = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const span = (t: number, a: number, b: number) =>
  ease((t - a) / 0.45) * (1 - ease((t - b) / 0.5));

/**
 * The Balloon: the envelope bobs and rocks on the air while the basket
 * hangs on its ropes below, trailing a little as it goes and swinging out
 * of turns. To bomb, the aviatrix looks down over her right side, reaches
 * to the rack and flings the bomb out; the balloon, lighter, rises a touch.
 * It floats down onto the field instead of dropping.
 */
export const balloon: Moves = {
  style: {
    stride: 1,
    legSwing: 0,
    armSwing: 0,
    bob: 0,
    sway: 0,
    lean: 0,
    attack: 'custom',
    windup: 0.7,
    lunge: 0,
    // Soft springs: the basket (and her head) lag the envelope.
    snap: 12,
  },
  stiff: {
    basket: 0.65,
    head: 0.9,
    cape: 0.35,
    hair: 0.5,
    foreR: 1.6,
    foreL: 1.6,
  },
  damping: { basket: 0.46, cape: 0.38, hair: 0.46 },
  pose(c, p) {
    const { t, walk, aim } = c;
    const free = c.reduced ? 0 : 1;
    const soft = c.reduced ? 0.25 : 1;
    const turn = c.turn;
    let wind = c.wind;
    let strike = 0;
    if (c.since < 0.12) {
      strike = 1 - Math.pow(1 - clamp01(c.since / 0.12), 3);
      wind = 1 - strike;
    } else if (c.since < 0.3) {
      strike = 1;
      wind = 0;
    } else if (c.since < 0.72) {
      strike = 1 - ease((c.since - 0.3) / 0.42);
      wind = 0;
    }
    wind *= aim;
    strike *= aim;

    // Bob and rock gently, a little forward while under way.
    const rock = Math.sin(t * 0.9) * 0.022 * free + walk * 0.04;
    const tilt = Math.sin(t * 0.71 + 0.5) * 0.028 * free;
    p.lift +=
      (Math.sin(t * 1.25) * 0.055 + Math.sin(t * 0.53 + 1) * 0.03) * free;
    p.torsoX = rock;
    p.torsoY = Math.sin(t * 0.37) * 0.035 * free;
    p.torsoZ = tilt;
    p.lean = 0;
    p.roll = 0;

    // The basket mostly stays plumb under the envelope's rocking, trails
    // back while moving and swings out of turns (the view turns the figure
    // left, +y, as the engine's facing falls).
    const out = clamp(turn * 0.065 + c.lateral * 0.018, -0.25, 0.25) * soft;
    const ahead = clamp(c.accel * 0.025, -0.22, 0.22) * soft;
    const reach = wind * (1 - strike);
    const swing = Math.sin(t * 1.6 + 0.4) * 0.015 * free;
    const hit = c.flinch * c.flinch;
    c.want(
      'basket',
      rock * 0.8 - walk * 0.06 - ahead + swing + strike * 0.04 + hit * 0.08,
      0,
      -tilt * 0.8 +
        out +
        Math.sin(t * 1.3) * 0.012 * free -
        strike * 0.045 +
        hit * 0.07,
    );

    // A bomb gone: lighter, the balloon rises a little and settles.
    const since = c.since;
    p.lift += aim * Math.exp(-since * 1.1) * (1 - Math.exp(-since * 8)) * 0.2;

    // She looks about while flying; to bomb she looks down to her right.
    const lap = (c.idleFor + c.unit.id * 0.57) % 9.6;
    const awake = ease(c.idleFor - 1) * c.idle * free;
    const scan = span(lap, 1.2, 3.1) * awake;
    const check = span(lap, 5.3, 6.7) * awake;
    p.headY += scan * 0.44 - check * 0.24 - aim * 0.45;
    p.headX += aim * 0.25 + reach * 0.1;
    p.headX += check * 0.16 - hit * 0.08;
    // Her right arm reaches out and down to the rack, then flings out and
    // up over the side; her left hand keeps the rim.
    p.armR += -0.35 * reach + 0.35 * strike;
    p.armRz += 0.85 * reach + 1.3 * strike;
    // Her left fist stays on the rim. The new elbow bends on the reach,
    // opens as the bomb leaves, then folds back to the rim on recovery.
    p.armL = 0;
    p.armLz = 0;
    c.want('foreL', 0);
    c.want('foreR', -reach * 0.35 + strike * 0.38);
    c.want(
      'cape',
      -ahead * 0.7 + walk * 0.08 + strike * 0.08 + hit * 0.1,
      clamp(turn * 0.045, -0.15, 0.15) * soft,
      clamp(-c.lateral * 0.018 + turn * 0.045, -0.2, 0.2) * soft +
        Math.sin(t * 1.6) * 0.035 * free,
    );
    c.want(
      'hair',
      clamp(-ahead * 0.2 + hit * 0.05, -0.08, 0.08),
      0,
      clamp(out * 0.3, -0.09, 0.09),
    );
  },
  arrive(d) {
    // Float down from high up with a slow turn, sink a touch below the
    // flying height and rise back to it.
    const k = clamp01(d / 0.9);
    const e = 1 - (1 - k) * (1 - k) * (1 - k);
    const dip = Math.sin(clamp01((d - 0.72) / 0.28) * Math.PI) * 0.14;
    return { drop: (1 - e) * 3.4 - dip, squash: 1, twirl: (1 - e) * 0.9 };
  },
};
