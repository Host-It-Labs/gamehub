import { Euler, Quaternion, Vector3 } from 'three';
import type { ArmGoal } from './reach.ts';
import { blend, reach } from './reach.ts';
import type { MoveContext, Moves } from './types';

const TAU = Math.PI * 2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const bump = (n: number, a: number, b: number) => Math.sin(Math.PI * clamp((n - a) / (b - a), 0, 1));
const HAND_REST = { palm: [1, 0, 0] as const };

function phase(c: MoveContext, key: string, rate: number) {
  const k = `drake.${key}`;
  c.memo[k] = ((c.memo[k] ?? (c.unit.id * 0.618 % 1) * TAU) + c.dt * rate) % TAU;
  return c.memo[k];
}

/** Wrist target in airframe coordinates, converted into this shoulder's
 * parent. Compensate chest/clavicle bends so the rim grip stays on the craft.
 * Angles are only used for the spine; every arm runs through shared reach. */
function wrist(c: MoveContext, side: 'L' | 'R', point: readonly number[],
  chest: readonly [number, number, number], clav: readonly [number, number, number],
  palm: readonly number[] = [0, -1, 0], fingers: readonly number[] = [0, 0, -1]): ArmGoal {
  const mirror = side === 'L' ? 1 : -1;
  const qChest = new Quaternion().setFromEuler(new Euler(...chest));
  const qClav = new Quaternion().setFromEuler(new Euler(...clav));
  const parent = qChest.clone().multiply(qClav);
  const shoulder = new Vector3(...(c.rest('chest') ?? [0, .076, .23956]))
    .add(new Vector3(...(c.rest(`clav${side}`) ?? [mirror * -.0128, .02816, -.00064])).applyQuaternion(qChest))
    .add(new Vector3(...(c.rest(`arm${side}`) ?? [mirror * -.04352, .00224, .00192])).applyQuaternion(parent));
  const inverse = parent.clone().invert();
  const hand = new Vector3(point[0], point[1] - .42, point[2]).sub(shoulder).applyQuaternion(inverse);
  const pole = new Vector3(mirror * -.08, -.13, .045).applyQuaternion(inverse);
  const p = new Vector3(...palm).applyQuaternion(inverse);
  const f = new Vector3(...fingers).applyQuaternion(inverse);
  const vector = (v: Vector3) => [v.x * mirror, v.y, v.z] as const;
  return { hand: vector(hand), pole: vector(pole), palm: vector(p), fingers: vector(f) };
}

/** No gameplay changes: 161 damage, 1.5 s hits, firstHit .5, bomb splash
 * 1.2 and projectile speed 10 remain owned by cards.ts/engine.ts. Keep the
 * shipped .35 s wind-up, .8 s climb/.5 s dive/.7 s pull-up and belly reload.
 * Arms stay on the coaming; the ace loads into the dive, watches the drop
 * and recovers. No cheerful pumping or hand-tuned arm Euler trajectories. */
export const drake: Moves = {
  style: { gait: 'glide', armSwing: 0, lean: 0, bob: 0, sway: 0,
    attack: 'bomb', windup: .35, lunge: 0, snap: 10 },
  carriage: { twist: 0, hips: 0, chestRoll: 0, nod: 0, armOut: 0, bounce: 0, weaponArm: 0 },
  stiff: { torso: 2.2, chest: .9, neck: .8, head: .85, armL: 1.6, armR: 1.6,
    foreL: 1.6, foreR: 1.6, handL: 1.6, handR: 1.6, clavL: 1.6, clavR: 1.6,
    wingL: 1.8, wingR: 1.8, tail: 1.6, extra: 1.4, cape: .55, cape2: .34,
    weapon: 0, wheels: 0, spin: 0 },
  damping: { torso: .56, chest: .64, neck: .64, head: .68, cape: .48, cape2: .39,
    armL: .8, armR: .8, foreL: .8, foreR: .8, handL: .8, handR: .8 },
  pose(c, p) {
    const free = c.reduced ? 0 : 1;
    const { aim, walk, idle } = c;
    const since = c.since;
    const post = since >= 0 && since < .7;
    const dive = post ? 1 - smooth(since / .3) : smooth(1 - c.toHit / .5);
    const height = post
      ? -.5 * (1 - smooth(since / .42)) + .12 * bump(since, .2, .7)
      : .11 * bump(c.toHit, .8, .5) - .5 * smooth(1 - c.toHit / .5);
    const nose = post
      ? .38 * (1 - smooth(since / .1)) - .42 * bump(since, 0, .62)
      : -.14 * bump(c.toHit, .8, .5) + .42 * smooth((.5 - c.toHit) / .22);
    const side = c.hits % 2 ? -1 : 1;
    const recover = post ? bump(since, 0, .65) * aim : 0;
    const bank = clamp(c.turn * .45 - c.lateral * .02, -.65, .65);
    const hit = c.flinch * c.flinch;
    const bob = phase(c, 'bob', free * (2 + .6 * walk));
    const rock = phase(c, 'rock', free * 1.25);
    const drift = phase(c, 'drift', free * .55);
    p.lift += aim * height + free * (.12 * Math.sin(bob) + .05 * Math.sin(drift)) - .14 * hit;
    p.lean += .05 * walk + aim * nose + .025 * Math.cos(bob) * free - .13 * hit;
    p.roll += bank + .04 * Math.sin(rock) * free + side * .18 * bump(since, .05, .9) * aim + .12 * hit;
    p.yawKick += .07 * Math.sin(drift) * idle * free;
    p.lunge += aim * dive * .22;

    // Direct mechanical rotation remains functional under reduced motion.
    const revs = c.deploy < 1 ? .25 + .75 * smooth(c.deploy / .7) : 1;
    c.want('spin', 0, 0, -phase(c, 'prop', 52 * revs * (1 + .35 * aim * dive)));
    c.want('wheels', -phase(c, 'wheel', (1 - c.deploy) * 14 + 2.2 + 2 * walk));
    const ail = clamp(bank * .42 + side * recover * .07, -.5, .5);
    c.want('wingL', -ail + .12 * hit); c.want('wingR', ail - .12 * hit);
    c.want('tail', clamp(aim * nose * .65 + .08 * hit, -.45, .45));
    c.want('extra', 0, clamp(-c.turn * .35 + .1 * hit, -.4, .4), 0);
    c.want('torso', -.055 * hit, -.06 * hit, .08 * hit);
    const stowed = aim > .3 && since >= 0 && since < 1.1 ? 1 - smooth((since - .75) / .3) : 0;
    c.want('weapon', 0, 0, 0, .115 * stowed);

    // A timed instrument/goggle check, never an A-pose or a victory wave.
    const lap = (c.idleFor + c.unit.id * .37) % 10.7;
    const check = free * idle * smooth(c.idleFor - 2) * bump(lap, 4.5, 6.3);
    const chest: [number, number, number] = [-.10 * aim * dive + .07 * recover + .11 * hit, 0, bank * .12];
    c.want('chest', ...chest); c.want('neck', .04 * recover - .05 * aim * dive, 0, 0);
    c.want('head', -.30 * aim * dive + .12 * hit,
      clamp(c.turn * .22 + .22 * Math.sin(drift) * idle * free + .3 * check, -.5, .5), -bank * .14);
    for (const arm of ['L', 'R'] as const) {
      const sign = arm === 'L' ? -1 : 1;
      const clav: [number, number, number] = [0, sign * .025 * aim * dive, sign * .014 * hit];
      c.want(`clav${arm}`, ...clav);
      // Palm centre lies about .016 ahead of the wrist on the coaming's
      // front quarter (native ellipse rx .0672, ry .0903, centre y -.225).
      const grip = wrist(c, arm, [sign * .049, .491, .181], chest, clav);
      const inspect = wrist(c, arm, [sign * .029, .598, .206], chest, clav,
        [-sign, 0, 0], [0, 1, 0]);
      reach(c, arm, blend(grip, inspect, arm === 'R' ? check : 0), HAND_REST);
    }
    c.want('cape', clamp(-.035 * walk + .05 * aim * nose + .06 * hit, -.18, .16),
      .04 * Math.sin(phase(c, 'silk', free * 6.8)) * free, clamp(c.turn * .16 - bank * .16, -.25, .25));
    c.want('cape2', .025 * Math.sin(phase(c, 'silkTip', free * 9)) * free + .08 * hit, 0, -.08 * bank);
    // Own the tucked legs so no airborne arm/gait fallback asks them to walk.
    for (const part of ['legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR'] as const) c.want(part, 0);
    const d = c.deploy, e = 1 - d;
    if (d < 1) {
      p.lunge -= e * e * 2.4;
      p.lean += .42 * (1 - smooth(d / .55)) - .30 * bump(d, .45, 1);
      p.roll += .85 * e * e * e - .18 * bump(d, .55, 1);
    }
  },
  arrive(d) {
    const k = smooth(d / .8);
    return { drop: (1 - k) ** 2 * 3.2 - bump(d, .55, 1) * .35,
      squash: 1, twirl: (1 - k) ** 2 * .7 };
  },
};
