import type { Moves } from './types';
import type { BufferGeometry, Mesh } from 'three';

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
  armSwing: 0.24,
  lean: 0.07,
  attack: 'custom' as const,
  windup: 0.34,
  lunge: 0.24,
  snap: 24,
};

/** Settle into a short, sideways sword stroke before reaching nearby stone.
 * The visual figure size controls the transition; engine range is unchanged. */
export function gladiatorStoneGuard(gap: number, size: number) {
  return ease((2.6 * size - gap) / (1.3 * size));
}

const soleVertices = new WeakMap<BufferGeometry, number[]>();

/** Evaluate the sandal and its blended ankle skin in the current pose.
 * Arena supplies the foot's weighted surfaces: the skin is a sibling of
 * the bones, so traversing the ankle alone would miss the actual toes. */
export function gladiatorSolePenetration(
  surfaces: readonly { mesh: Mesh; indices?: number[] }[],
  groundAt: (x: number, z: number) => number,
) {
  const point = surfaces[0]?.mesh.position.clone();
  if (!point) return 0;
  let lift = 0;
  for (const { mesh, indices: subset } of surfaces) {
    const geometry = mesh.geometry;
    let indices = subset ?? soleVertices.get(geometry);
    if (!indices) {
      indices = geometry.index
        ? [...new Set(geometry.index.array)]
        : Array.from(
            { length: geometry.attributes.position.count },
            (_, i) => i,
          );
      soleVertices.set(geometry, indices);
    }
    for (const index of indices) {
      mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
      lift = Math.max(lift, groundAt(point.x, point.z) - point.y);
    }
  }
  return lift;
}

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
    armOut: 0,
    bounce: 0.012,
    weaponArm: 0.75,
  },
  stiff: {
    armL: 0.95,
    foreL: 0.95,
    handL: 0.95,
    shield: 0.95,
    armR: 1.2,
    foreR: 1.2,
    handR: 1.2,
    weapon: 1.2,
    hair: 0.4,
    skirtL: 0.6,
    skirtR: 0.6,
  },
  damping: {
    armL: 0.92,
    foreL: 0.92,
    handL: 0.92,
    shield: 0.92,
    armR: 0.92,
    foreR: 0.92,
    handR: 0.92,
    weapon: 0.92,
    hair: 0.46,
    skirtL: 0.56,
    skirtR: 0.56,
  },
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
    const stone = clamp01(c.memo.gladiatorStoneGuard ?? 0);
    const idle = c.reduced ? 0 : c.idle;
    p.headX *= 1 - c.idle;
    p.headY *= 1 - c.idle;
    p.roll *= 1 - c.idle;
    const weight =
      Math.sin(c.t * 0.53 + c.unit.id * 0.29) *
      idle *
      ease(c.idleFor / 1.1) *
      (1 - stone);
    p.roll += weight * 0.01;
    p.torsoZ -= weight * 0.008;
    p.torsoX += Math.sin(c.t * 1.65) * 0.009 * idle;
    let wind = c.wind;
    let strike = 0;
    if (c.since < 0.055) {
      strike = 1 - Math.pow(1 - clamp01(c.since / 0.055), 3);
      wind = 1 - strike;
    } else if (c.since < 0.12) {
      strike = 1;
      wind = 0;
    } else if (c.since < 0.44) {
      strike = 1 - ease((c.since - 0.12) / 0.32);
      wind = 0;
    }
    wind *= aim;
    strike *= aim;
    const follow =
      ease((c.since - 0.045) / 0.065) *
      (1 - ease((c.since - 0.16) / 0.2)) *
      aim *
      (1 - stone);
    // The shield's hit points: once spent it hangs at his side. Units
    // built by hand (the lab, placement previews) carry none at all, so
    // only a shield seen holding and then emptied counts as spent.
    const hp = c.unit.shield;
    if (hp > 0) c.memo.shieldSeen = 1;
    const holding = hp > 0 || !c.memo.shieldSeen ? 1 : 0;
    const hold = (c.memo.shieldMix =
      (c.memo.shieldMix ?? holding) +
      (holding - (c.memo.shieldMix ?? holding)) * (1 - Math.exp(-c.dt * 10)));
    // Beside stone a spent scutum stays tucked in its actual fist. In
    // open ground the empty shield still hangs and swings freely.
    const carry = hold + (1 - hold) * stone;
    const up = aim * hold;
    const hit = c.flinch * c.flinch;

    // The shield arm: steady (hardly any swing while he walks), up to the
    // chin on guard, lowered a little while he waits.
    p.armL *= 1 - carry * 0.8;
    p.armL +=
      up * 0.3 -
      idle * carry * 0.05 -
      (1 - carry) * 0.12 -
      stone * carry * 0.16;
    p.armLz -= (1 - carry) * 0.18;
    let foreL = up * 0.3 - idle * carry * 0.12 - (1 - carry) * 0.5;
    foreL += strike * up * 0.06 + hit * hold * 0.1;
    foreL += stone * carry * 0.2;

    // The sword arm: drawn back to the hip on guard, further on the
    // wind-up, then a straight thrust past the shield's right edge; the
    // blade stays level through it all.
    const lap = (c.idleFor + c.unit.id * 0.53) % 8.8;
    const awake = ease(c.idleFor - 1) * idle;
    const inspect = span(lap, 2.0, 3.4) * awake;
    const glance = span(lap, 5.6, 6.7) * awake;
    const armR =
      aim * (-0.22 - stone * 0.08) +
      wind * (-0.24 - stone * 0.06) +
      strike * (1.4 - stone * 0.75) +
      inspect * 0.38 -
      hit * 0.15;
    const foreR =
      aim * (0.44 + stone * 0.06) +
      wind * (0.35 + stone * 0.1) -
      strike * (0.67 - stone * 0.47) +
      inspect * 0.15;
    p.armR += armR;
    p.armRz += strike * -0.1;
    p.weapon += -(armR + foreR) * 0.92 + idle * Math.sin(c.t * 0.9) * 0.08;
    // The shoulders turn back behind the wind-up and drive into the thrust.
    const twist = aim * -0.1 - wind * 0.22 + strike * 0.42;
    p.torsoY += twist;
    p.torsoX += aim * 0.1 + strike * 0.12 - wind * 0.04;
    p.torsoX += follow * 0.035;
    p.torsoY += follow * 0.045;
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
    // At a wall the feet and torso brace while the blade travels alongside
    // the face. Rotating the actual forearm/wrist keeps the fist and grip
    // together rather than steering the sword separately through stone.
    p.lunge *= 1 - stone;
    p.torsoX -= stone * (aim * 0.1 + strike * 0.12);
    p.lean -= stone * strike * 0.08;
    // On landing the shield leads, the sword stays clear behind it.
    const landing = Math.sin(clamp01((c.deploy - 0.28) / 0.3) * Math.PI);
    p.armL += landing * 0.12 * hold;
    p.torsoX += landing * 0.1;
    p.headX -= landing * 0.06;

    c.want('foreL', foreL);
    // Compensate the final arm and chest pose, including landing and
    // deflection, so the shield remains an upright surface in the fist.
    const shield =
      carry * (-(p.armL + foreL) + p.torsoX + p.lean) + (1 - carry) * 0.3;
    // Carry the equipment with each actual fist. Compensation at an
    // equipment-only pivot would turn its grip out of the fingers.
    c.want('handL', shield, hit * hold * 0.08, hit * hold * 0.1);
    c.want('shield', 0);
    c.want(
      'foreR',
      foreR + walk * (1 - aim) * 0.1 * (1 + c.fwdL),
      stone * (0.85 + strike * 0.2),
    );
    c.want('handR', p.weapon, stone * 0.3);
    c.want('weapon', 0);

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
