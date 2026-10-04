import type { Moves } from './types';

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const span = (t: number, a: number, b: number) =>
  ease(clamp01((t - a) / 0.45)) * (1 - ease(clamp01((t - b) / 0.5)));

/** The wheels' radius in the figure (WHEEL_R in figure_gunner.py), and
 *  the figure's usual scale on the field (TROOP_SCALE in troops.ts; x and
 *  z are drawn a little wider, figureDimensions). */
const WHEEL_R = 0.17;
const FIGURE_SCALE = 1.75 * 1.06;

/** Sagittal vectors from figure_gunner.py's two identical mirrored arms.
 *  The upper arm ends at the real elbow; the second vector ends at the
 *  centre of the fist, including the wrist. */
const SHOULDER = [0.0581967436, 0.979396291] as const;
const UPPER = [0.0868014181, -0.219935193] as const;
const LOWER = [0.2050018383, -0.1194610981] as const;
const rotate = (y: number, z: number, a: number) => ({
  y: y * Math.cos(a) - z * Math.sin(a),
  z: y * Math.sin(a) + z * Math.cos(a),
});

/** Keep each fist on the bar while the chest bends and the carriage
 *  bucks. Only x rotations are needed: the sculpt's hand/elbow x offsets
 *  remain fixed, and the mirrored arms reach the same height and depth. */
function handsOnBar(bend: number, carriage: number) {
  const bar = rotate(-0.25, 0.47, carriage);
  const local = rotate(bar.y + 0.6, bar.z + 0.17 - 0.68, bend);
  const y = local.y - SHOULDER[0];
  const z = local.z + 0.68 - SHOULDER[1];
  const l1 = Math.hypot(...UPPER);
  const l2 = Math.hypot(...LOWER);
  const distance = Math.min(l1 + l2 - 1e-6, Math.max(1e-6, Math.hypot(y, z)));
  const angle = Math.acos(
    clamp((l1 * l1 + distance * distance - l2 * l2) / (2 * l1 * distance), 1),
  );
  const upper = Math.atan2(z, y) - angle;
  const lower = Math.atan2(z - Math.sin(upper) * l1, y - Math.cos(upper) * l1);
  const arm = upper - Math.atan2(UPPER[1], UPPER[0]);
  return { arm, fore: lower - Math.atan2(LOWER[1], LOWER[0]) - arm };
}

/**
 * The Gunner: short, steady steps behind his gun, both fists on the push
 * bar, the wheels rolling with the ground covered. To fire he plants his
 * feet and ducks his head away; the barrel kicks up and the whole gun
 * jolts back on its wheels, then he leans in and runs it back up, re-lays
 * the barrel and waits out the slow reload.
 */
export const gunner: Moves = {
  style: {
    // Short, braced steps behind the gun. The gun is part of his body, so
    // the pelvis stays level and square (its wheels would leave the
    // ground or skid sideways).
    gait: {
      like: 'shuffle',
      stride: 0.46,
      bounce: 0.006,
      crouch: 0,
      sway: 0,
      roll: 0,
      twist: 0,
    },
    armSwing: 0,
    twoHanded: true,
    // Leaning the whole body would sink the gun's wheels: the lean is
    // sculpted into his upper body instead.
    lean: 0,
    attack: 'custom',
    windup: 0.55,
    lunge: 0,
    snap: 24,
  },
  carriage: {
    twist: 0,
    hips: 0,
    chestRoll: 0,
    nod: 0.01,
    armOut: 0,
    bounce: 0,
    weaponArm: 0,
  },
  stiff: {
    torso: 1,
    armL: 1,
    armR: 1,
    foreL: 1,
    foreR: 1,
    offhand: 1,
    extra: 1.15,
    hat: 0.42,
  },
  damping: {
    torso: 0.75,
    armL: 0.75,
    armR: 0.75,
    foreL: 0.75,
    foreR: 0.75,
    offhand: 0.75,
    hat: 0.4,
  },
  arrive(d) {
    const fall = clamp01(d / 0.34);
    const land = clamp01((d - 0.34) / 0.22);
    return {
      drop: d < 0.34 ? 2.1 * (1 - fall * fall) : 0,
      squash: 1 - Math.sin(land * Math.PI) * 0.035,
      twirl: 0,
    };
  },
  pose(c, p) {
    const { walk, aim, wind, since } = c;
    const idle = c.reduced ? 0 : c.idle;
    const still = 1 - walk;
    let strike = 0;
    if (since < 0.07) strike = 1 - Math.pow(1 - clamp01(since / 0.07), 3);
    else if (since < 0.2) strike = 1;
    else if (since < 0.65) strike = 1 - ease((since - 0.2) / 0.45);
    strike *= aim;

    // Both fists stay on the bar: no arm swing, no chest twist.
    p.armL = 0;
    p.armR = 0;
    p.armLz = 0;
    p.armRz = 0;
    p.torsoY = 0;
    p.torsoZ = 0;
    // A small shove into the bar on each step.
    p.torsoX = (1 - c.pass) * 0.03 * walk;

    // The shot: jolt back fast, hold, then he runs the gun back up.
    const kick =
      since < 0.06
        ? since / 0.06
        : since < 0.3
          ? 1
          : since < 1.3
            ? 1 - ease((since - 0.3) / 1)
            : 0;
    const recoil = kick * aim;
    const runUp =
      since > 0.3 && since < 1.3 ? Math.sin(((since - 0.3) / 1) * Math.PI) : 0;
    p.lunge += -0.16 * recoil;
    p.torsoX += aim * 0.04 + wind * 0.05 - strike * 0.12 + runUp * aim * 0.1;
    p.squash *= 1 - aim * 0.02 - wind * 0.025;
    // He turns his head from the blast and squints, then looks back to the
    // target.
    p.headY += wind * 0.4 + strike * 0.25;
    p.headX += wind * 0.08 - strike * 0.15;

    // A braced stance while firing: left foot forward, right back, knees
    // bent (only standing still, so it never fights the walk).
    if (walk < 0.05 && aim > 0.02) {
      const b = aim * still;
      c.want('legL', 0.2 * b, 0, 0);
      c.want('kneeL', -0.28 * b);
      c.want('footL', 0.08 * b);
      c.want('legR', -0.22 * b, 0, 0);
      c.want('kneeR', -0.06 * b);
      c.want('footR', 0.28 * b);
      p.lift -= 0.02 * b;
    }

    // The barrel: laid up for range, kicking on the shot, then re-laid with
    // two small corrections before the next.
    const relay =
      since > 1.5 && since < 2.4
        ? Math.sin(((since - 1.5) / 0.9) * Math.PI * 2) * 0.035
        : 0;
    c.want('extra', aim * (0.16 + relay) + strike * 0.32);
    // The carriage bucks a little on the shot.
    p.offhand += strike * 0.04;

    // Waiting for a target: inspect the bore, then scan the lane over it.
    // He keeps both hands on the push bar, rather than miming a reload
    // through the carriage or taking a hand off without a matching joint.
    const lap = (c.idleFor + c.unit.id * 0.41) % 9.3;
    const awake = ease(clamp01(c.idleFor - 1)) * idle;
    const sight = span(lap, 1.5, 3.2) * awake;
    const scan = span(lap, 5.4, 6.8) * awake;
    p.headX += sight * 0.13;
    p.headY += -sight * 0.18 + scan * 0.4;
    p.torsoX += sight * 0.025;
    const hit = c.flinch * c.flinch;
    p.headY += hit * 0.15;
    p.headX -= hit * 0.08;
    // The arm solve and chest share their spring response. The hands stay
    // close to the bar through the slower brace and recovery as well as
    // through the carriage's small kick.
    const hands = handsOnBar(p.torsoX, p.offhand);
    c.want('torso', -p.torsoX, 0, 0);
    for (const side of ['L', 'R'] as const) {
      c.want(`arm${side}`, hands.arm);
      c.want(`fore${side}`, hands.fore);
    }
    const soft = c.reduced ? 0.25 : 1;
    const ahead = clamp(c.accel * 0.015, 0.16) * soft;
    const across = clamp(c.lateral * 0.016, 0.16) * soft;
    const turn = clamp(c.turn * 0.04, 0.18) * soft;
    const land = Math.pow(1 - c.pass, 4) * walk;
    c.want(
      'hat',
      ahead * 0.4 + land * 0.055 + strike * 0.13 + hit * 0.08,
      0,
      across * 0.4 - turn * 0.55,
    );

    // Wheels roll with the ground covered, recoil included.
    const r = WHEEL_R * FIGURE_SCALE * c.size;
    c.want('wheels', -(c.travel + p.lunge * c.size) / r);
  },
};
