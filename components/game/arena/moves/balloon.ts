import { Euler, Quaternion, Vector3 } from 'three';
import type { ArmGoal } from './reach.ts';
import { blend, reach } from './reach.ts';
import type { MoveContext, Moves } from './types';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const ease = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const bump = (n: number, a: number, b: number) => Math.sin(Math.PI * clamp((n - a) / (b - a), 0, 1));
const HAND_REST = { palm: [1, 0, 0] as const };

function wrist(c: MoveContext, side: 'L' | 'R', point: readonly number[],
  chest: readonly [number, number, number], clav: readonly [number, number, number],
  palm: readonly number[]): ArmGoal {
  const mirror = side === 'L' ? 1 : -1;
  const qChest = new Quaternion().setFromEuler(new Euler(...chest));
  const qClav = new Quaternion().setFromEuler(new Euler(...clav));
  const parent = qChest.clone().multiply(qClav);
  const shoulder = new Vector3(...(c.rest('chest') ?? [0, -.3615, .01696]))
    .add(new Vector3(...(c.rest(`clav${side}`) ?? [mirror * -.0248, .05456, -.00124])).applyQuaternion(qChest))
    .add(new Vector3(...(c.rest(`arm${side}`) ?? [mirror * -.08432, .00434, .00372])).applyQuaternion(parent));
  const inverse = parent.clone().invert();
  const hand = new Vector3(point[0], point[1] - .64, point[2]).sub(shoulder).applyQuaternion(inverse);
  const pole = new Vector3(mirror * -.13, -.17, .025).applyQuaternion(inverse);
  const p = new Vector3(...palm).applyQuaternion(inverse);
  const vector = (v: Vector3) => [v.x * mirror, v.y, v.z] as const;
  // Fingers continue along the solved forearm into the cupped grip. Forcing
  // them downward while lifting a wrist above its elbow wrung the hand.
  return { hand: vector(hand), pole: vector(pole), palm: vector(p) };
}

/** Fixed rack pivot (Blender z .215); shell offset (forward .125, up .09).
 * The same curve positions both wrists and the shell. Release completes on
 * the engine hit; its post-hit stow passes into the basket, then recovery
 * returns the empty palms to the rim. Real-render grip sheets are mandatory. */
export function bombMotion(c: MoveContext) {
  let angle = 1.6, dy = -.22;
  if (c.aim > 0 && c.since >= 0 && c.since < .18) {
    const t = ease(c.since / .18);
    angle = lerp(-.32, 1.6, t); dy = -.22 * t;
  } else if (c.aim > 0 && c.wind > 0) {
    const load = ease(c.wind * 1.6);
    angle = lerp(1.6, .65, load); dy = -.22 * (1 - load);
    if (c.toHit < .10) angle = lerp(.65, -.32, ease(1 - c.toHit / .10));
  }
  return { angle, dy, center: [0, .215 + .125 * Math.sin(angle) + .09 * Math.cos(angle) + dy,
    -(.125 * Math.cos(angle) - .09 * Math.sin(angle))] as const };
}

/** Preserve cards.ts: 520 damage, 3 s hits, firstHit 1 s, tower-only drop,
 * splash 1, death blast 240/radius 2. The original .7 s wind-up remains.
 * Both hands cup the bomb, hips/chest load for the heave, then open and
 * follow it over the front rim. The basket and scarf carry the inertia. */
export const balloon: Moves = {
  style: { gait: 'glide', armSwing: 0, lean: 0, bob: 0, sway: 0,
    attack: 'custom', windup: .7, lunge: 0, snap: 12 },
  carriage: { twist: 0, hips: 0, chestRoll: 0, nod: 0, armOut: 0, bounce: 0, weaponArm: 0 },
  stiff: { basket: .65, torso: .8, chest: 1.25, neck: 1.15, head: 1.2,
    armL: 1.7, armR: 1.7, foreL: 1.7, foreR: 1.7, handL: 1.7, handR: 1.7,
    clavL: 1.7, clavR: 1.7, cape: .35, cape2: .24, hair: .5, weapon: 0 },
  damping: { basket: .54, cape: .44, cape2: .38, hair: .55, chest: .8,
    armL: .82, armR: .82, foreL: .82, foreR: .82, handL: .82, handR: .82 },
  pose(c, p) {
    const free = c.reduced ? 0 : 1;
    const tilt = .024 * Math.sin(c.t * .71 + .5) * free;
    const rock = .02 * Math.sin(c.t * .9) * free + .035 * c.walk;
    const turn = clamp(c.turn * .065 + c.lateral * .018, -.22, .22);
    const ahead = clamp(c.accel * .025, -.18, .18);
    const hit = c.flinch * c.flinch;
    p.lift += (.055 * Math.sin(c.t * 1.25) + .03 * Math.sin(c.t * .53 + 1)) * free;
    p.lean = 0; p.roll = 0;
    c.want('torso', -rock, .03 * Math.sin(c.t * .37) * free, tilt);
    c.want('basket', rock * .8 - c.walk * .06 - ahead + .08 * hit,
      0, -tilt * .8 + turn + .08 * hit);
    const attack = c.aim;
    const bomb = bombMotion(c);
    c.want('weapon', bomb.angle, 0, 0, bomb.dy);
    const release = attack * (c.since >= 0 && c.since < .60 ? 1 - ease((c.since - .08) / .52) : 0);
    const load = attack * c.wind;
    const heave = attack * ease(1 - c.toHit / .10) * (c.since > .7 ? 1 : 0);
    const chest: [number, number, number] = [.045 * load - .11 * heave - .075 * release + .09 * hit, 0, -.025 * load];
    c.want('chest', ...chest); c.want('neck', -.055 * load - .04 * release + .10 * hit, 0, 0);
    const lap = (c.idleFor + c.unit.id * .57) % 9.6;
    const scan = free * c.idle * ease(c.idleFor - 1) * bump(lap, 2, 4.4);
    c.want('head', -.18 * attack - .04 * load + .10 * hit,
      .30 * scan + clamp(c.turn * .14, -.18, .18), -turn * .12);
    for (const arm of ['L', 'R'] as const) {
      const sign = arm === 'L' ? -1 : 1;
      const clav: [number, number, number] = [0, sign * -.035 * load, sign * .028 * heave];
      c.want(`clav${arm}`, ...clav);
      const rim = wrist(c, arm, [sign * .116, .235, -.136], chest, clav, [0, -1, 0]);
      const carryCenter = c.since >= 0 && c.since < .6
        ? [0, .2605, -.14697] : bomb.center;
      const carry = wrist(c, arm, [carryCenter[0] + sign * .043, carryCenter[1] - .022, carryCenter[2]],
        chest, clav, [-sign, 0, 0]);
      const out = wrist(c, arm, [sign * .062, .276, -.189], chest, clav,
        [0, -.6, -1]);
      const grasp = attack * ease(c.wind * 2);
      const post = attack * (c.since >= 0 && c.since < .7 ? 1 - ease((c.since - .36) / .34) : 0);
      let goal = blend(rim, carry, Math.max(grasp, post));
      goal = blend(goal, out, release * ease(c.since / .065));
      // The palm cups the underside, and its roll is shared with the
      // forearm. Continue the fingers along it to avoid a wrist flip.
      reach(c, arm, { ...goal, forearmRoll: .65 }, HAND_REST);
    }
    // A lighter basket rises slightly after the drop; no envelope squash.
    if (c.since >= 0) p.lift += attack * Math.exp(-c.since * 1.1) * (1 - Math.exp(-c.since * 8)) * .20;
    c.want('cape', -.04 * c.walk - ahead * .4 + .04 * release + .06 * hit,
      clamp(c.turn * .06, -.16, .16), -.08 * turn + .025 * Math.sin(c.t * 1.6) * free);
    c.want('cape2', -.025 * ahead + .04 * hit, 0, .022 * Math.sin(c.t * 2.1 + .4) * free);
    c.want('hair', clamp(-ahead * .2 + .06 * hit, -.08, .08), 0, clamp(turn * .25, -.08, .08));
    for (const part of ['legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR'] as const) c.want(part, 0);
  },
  arrive(d) {
    const k = clamp(d / .9, 0, 1), e = 1 - (1 - k) ** 3;
    return { drop: (1 - e) * 3.4 - bump(d, .72, 1) * .14,
      squash: 1, twirl: (1 - e) * .9 };
  },
};
