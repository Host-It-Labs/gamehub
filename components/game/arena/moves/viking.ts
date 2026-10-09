import type { Moves } from './types';
import type { BufferGeometry, Mesh, Object3D } from 'three';

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

/** Begin lifting the complete two-hand hold before its long blade reaches
 *  nearby stone. The radius scales with the displayed figure, while the
 *  engine's body clearance and attack range remain unchanged. */
export function vikingStoneGuard(gap: number, size: number) {
  return ease((2.6 * size - gap) / (1.3 * size));
}

const soleVertices = new WeakMap<BufferGeometry, number[]>();

/** The sculpt's rounded boot sole needs its actual posed contact, including
 *  the small sideways roll during a planted spin. */
export function vikingSolePenetration(
  foot: Object3D,
  groundAt: (x: number, z: number) => number,
) {
  const point = foot.position.clone();
  let lift = 0;
  foot.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    const vertices = geometry.attributes.position;
    let indices = soleVertices.get(geometry);
    if (!indices) {
      indices = geometry.index
        ? [...new Set(geometry.index.array)]
        : Array.from({ length: vertices.count }, (_, i) => i);
      soleVertices.set(geometry, indices);
    }
    for (const index of indices) {
      mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
      lift = Math.max(lift, groundAt(point.x, point.z) - point.y);
    }
  });
  return lift;
}

/** The Viking: a heavy, rolling stomp with the long axe held low across
 *  him. Each hit is one full turn of the body with the axe swung out level,
 *  so it sweeps everyone round him; below half health he rages, hunched,
 *  trembling and spinning faster. */
export const viking: Moves = {
  style: {
    // Heavy and rolling: the weight thrown from foot to foot.
    gait: { like: 'heavy', stride: 0.62, sway: 0.7, roll: 0.07, twist: 0.1 },
    armSwing: 0.08,
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
    bounce: 0.012,
    weaponArm: 1,
  },
  stiff: {
    armL: 0.95,
    armR: 0.95,
    foreL: 0.95,
    foreR: 0.95,
    handL: 0.95,
    handR: 0.95,
    weapon: 0.95,
    beard: 0.35,
    skirtL: 0.6,
    skirtR: 0.6,
  },
  damping: {
    armL: 0.92,
    armR: 0.92,
    foreL: 0.92,
    foreR: 0.92,
    handL: 0.92,
    handR: 0.92,
    weapon: 0.92,
    beard: 0.52,
    skirtL: 0.58,
    skirtR: 0.58,
  },
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
    const guard = clamp01(c.memo.vikingStoneGuard ?? 0);

    // Keep the gaze still between deliberate glances. The pelvis carries
    // his weight; the chest counters it, rather than all links rocking as
    // one stiff block. A guarded hold keeps the accepted stone silhouette.
    p.headX *= 1 - c.idle;
    p.headY *= 1 - c.idle;
    p.roll *= 1 - c.idle;
    const resting = ease(c.idleFor / 1.1) * idle * (1 - guard);
    const weight = Math.sin(c.t * 0.48 + u.id * 0.31) * resting;
    p.roll += weight * 0.012;
    p.torsoZ -= weight * 0.01;

    // The authored elbows and wrists form one two-handed hold. Both
    // shoulders pitch about the same x axis, so that whole hold lifts as
    // one unit. Independent forearm/haft springs would pull the hands off
    // the shaft during the circular strike and after a sudden stop.
    c.want('foreL', 0);
    c.want('foreR', 0);
    c.want('handL', 0);
    c.want('handR', 0);
    c.want('weapon', 0);

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
    // Accelerate from the loaded stance, sweep quickly through the hit,
    // then spend the rest of the original spin time braking the long axe.
    // One complete turn and both rage/normal durations stay unchanged.
    const e = s >= 0 ? 1 - Math.pow(1 - s, 2.65) : 0;
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
    const recovery =
      ease((c.since - spinTime + 0.045) / 0.11) *
      (1 - ease((c.since - spinTime - 0.065) / 0.18)) *
      c.aim;
    p.torsoX += recovery * 0.045 * (1 - guard);
    p.headX -= recovery * 0.02;
    p.armL += recovery * 0.055;
    p.armR += recovery * 0.055;

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

    // The planted heavy stride lowers his chest while the feet bend.
    // Hold the long axe above the field through that compression and
    // recovery. Both shoulders keep the same pitch; the level spin and
    // its timing retain their existing authored sweep.
    const clearance = (1 - hold) * (0.32 + rage * 0.12);
    p.armL = Math.max(p.armL, clearance);
    p.armR = Math.max(p.armR, clearance);

    // A level sweep fits open ground; beside a tower he raises the same
    // locked hold over the coping. Both shoulders travel together, so
    // neither fist leaves the shaft and the complete body turn remains.
    const guarded = Math.max(p.armL, 2.15 * guard);
    p.armL = p.armR = guarded;
    // A quick turn beside coping keeps the chest level instead of
    // banking the outside sleeve into a corner merlon.
    if (guard > 0) {
      p.roll -= clamp(c.turn * 0.05, 0.12) * guard;
      p.torsoZ *= 1 - guard;
      // The rage hunch stays on open ground. Against stone he braces
      // upright under the raised axe, keeping elbows and beard clear.
      p.torsoX *= 1 - guard;
      p.lean *= 1 - guard;
    }

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
