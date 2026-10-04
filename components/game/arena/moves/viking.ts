import type { Moves } from './types';

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const span = (t: number, a: number, b: number) =>
  ease((t - a) / 0.4) * (1 - ease((t - b) / 0.5));

/** How much of each thigh's swing its half of the tunic's skirt follows. */
const SKIRT = 0.6;
/** The arms' turn that lays the axe level, pointing out forward left, its
 *  blade flat and leading (figure_viking.py builds the hold for it). */
const LEVEL = 0.84;
/** How far he coils to the right before the spin. */
const COIL = 0.8;

/** The Viking: a heavy, rolling stomp with the long axe held low across
 *  him. Each hit is one full turn of the body with the axe swung out level,
 *  so it sweeps everyone round him; below half health he rages, hunched,
 *  trembling and spinning faster. */
export const viking: Moves = {
  style: {
    // Heavy and rolling: the weight thrown from foot to foot.
    gait: { like: 'heavy', stride: 0.62, sway: 0.7, roll: 0.07, twist: 0.1 },
    armSwing: 0.1,
    lean: 0.05,
    attack: 'custom',
    windup: 0.32,
    lunge: 0.08,
    snap: 22,
    heavy: true,
    twoHanded: true,
  },
  carriage: {
    twist: 0.1,
    hips: 0.08,
    chestRoll: -0.25,
    nod: 0.016,
    armOut: 0,
    bounce: 0.022,
    weaponArm: 1,
  },
  stiff: { beard: 0.35, skirtL: 0.6, skirtR: 0.6, weapon: 0.85 },
  damping: { beard: 0.42, skirtL: 0.44, skirtR: 0.44, weapon: 0.58 },
  arrive(d) {
    const fall = clamp01(d / 0.32);
    const land = clamp01((d - 0.32) / 0.25);
    return {
      drop: d < 0.32 ? 2.2 * (1 - fall * fall) : 0,
      squash: 1 - Math.sin(land * Math.PI) * 0.1,
      twirl: 0,
    };
  },
  pose(c, p) {
    const u = c.unit;
    const furious = u.hp < u.maxHp / 2;
    const rage = (c.memo.rage =
      (c.memo.rage ?? 0) +
      ((furious ? 1 : 0) - (c.memo.rage ?? 0)) * (1 - Math.exp(-c.dt * 9)));
    const spinTime = furious ? 0.4 : 0.5;
    const idle = c.reduced ? 0 : c.idle;

    // Heavy feet: the body sinks as each foot lands.
    const land = Math.pow(1 - c.pass, 6);
    p.squash *= 1 - land * 0.04 * c.walk;
    p.torsoX += land * 0.03 * c.walk;

    // Standing: deep breaths and the axe rocking in his fists.
    const breath = Math.sin(c.t * 1.6);
    p.torsoX += breath * 0.015 * idle;
    const lap = (c.idleFor + u.id * 0.47) % 9.4;
    const awake = ease(c.idleFor - 1) * idle;
    // He lifts the axe to feel its balance, keeping both fists on the
    // haft, then scans each flank from the same broad planted stance.
    const weigh = span(lap, 1.2, 3.4) * awake;
    const look = span(lap, 5.6, 6.8) * awake;
    const idleArms = breath * 0.02 * idle + weigh * 0.2;
    p.armL += idleArms;
    p.armR += idleArms;
    p.headX += weigh * 0.035;
    p.headY +=
      look * 0.44 * (Math.floor((c.idleFor + u.id * 0.47) / 9.4) % 2 ? -1 : 1);
    p.torsoY += look * 0.06;

    // The attack: the axe comes up off the ground, he coils to the right
    // with it level, then pivots right round to the left. The turn starts
    // from the coil, so the blade
    // passes in front of him on the hit and ends facing the target again.
    const s = c.since < spinTime && c.aim > 0.02 ? c.since / spinTime : -1;
    const spinning = s >= 0 ? 1 : 0;
    const e = s >= 0 ? 1 - Math.pow(1 - s, 2.2) : 0;
    const wind = spinning ? 1 - e : c.wind;
    const ready = c.aim * (0.3 + rage * 0.1);
    const hold = Math.max(c.wind, spinning);
    const arms = ready + hold * (LEVEL - ready);
    p.armL += arms;
    p.armR += arms;
    const turn = s >= 0 ? -COIL * (1 - e) + e * Math.PI * 2 : -COIL * c.wind;
    p.yawKick += turn;
    p.torsoY += -wind * 0.3 + Math.sin(Math.PI * e) * 0.25;
    p.headY += wind * 0.35;
    p.lean += -wind * 0.05 + Math.sin(Math.PI * clamp01(s)) * 0.06;
    // No hop on every hit: he transfers weight into the turn and settles
    // on the field as the axe finishes its sweep.
    p.lift -= Math.sin(Math.PI * clamp01(s)) * 0.015 * c.size * spinning;
    p.lunge += Math.sin(Math.PI * clamp01(s)) * 0.08;
    p.squash *= 1 - c.strike * 0.04;

    // Rage: hunched over the axe, chin jutting, shoulders heaving and a
    // tremble through him.
    if (rage > 0.001) {
      const heave = c.reduced ? 0 : Math.sin(c.t * 5.2);
      p.torsoX += rage * (0.2 + heave * 0.016);
      p.headX -= rage * 0.17;
      p.lean += rage * 0.04;
      p.torsoZ += c.reduced ? 0 : rage * Math.sin(c.t * 19) * 0.009;
      // The axe comes up off the ground as he bends over it.
      p.armL += rage * 0.2 * (1 - c.aim);
      p.armR += rage * 0.2 * (1 - c.aim);
      p.squash *= 1 - rage * (heave * 0.5 + 0.5) * 0.01;
    }

    const hit = c.flinch * c.flinch;
    p.torsoX += hit * 0.08;
    p.torsoZ += hit * 0.07;
    p.headX -= hit * 0.05;
    p.armL -= hit * 0.12;
    p.armR -= hit * 0.12;
    const landing = Math.sin(clamp01((c.deploy - 0.3) / 0.35) * Math.PI);
    p.torsoX += landing * 0.14;
    p.headX -= landing * 0.08;
    p.armL += landing * 0.14;
    p.armR += landing * 0.14;

    // The beard lies on his chest: nodding forward would bury it.
    p.headX = Math.min(p.headX, 0.06);

    // The tunic's split skirt trails the thighs and hangs level whatever
    // the chest does.
    const soft = c.reduced ? 0.25 : 1;
    const ahead = clamp(c.accel * 0.017, 0.18) * soft;
    const across = clamp(c.lateral * 0.018, 0.18) * soft;
    const turnLag = clamp(c.turn * 0.05, 0.18) * soft;
    const sweep = spinning * Math.sin(Math.PI * e) * 0.1;
    const hang = p.torsoX * 0.8;
    c.want(
      'skirtL',
      c.hipL * SKIRT + hang - ahead,
      -p.torsoY * 0.35,
      -land * 0.035 * c.walk - sweep - across + turnLag,
    );
    c.want(
      'skirtR',
      c.hipR * SKIRT + hang - ahead,
      -p.torsoY * 0.35,
      land * 0.035 * c.walk + sweep - across + turnLag,
    );
    c.want(
      'beard',
      Math.max(
        -0.035,
        (p.headX + p.torsoX) * 0.65 -
          ahead * 0.4 +
          land * 0.045 * c.walk +
          hit * 0.07,
      ),
      0,
      clamp(-p.torsoZ * 0.55 - across * 0.65 + turnLag * 0.8 + sweep, 0.23),
    );
  },
};
