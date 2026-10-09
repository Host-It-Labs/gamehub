import { Euler, Quaternion, Vector3 } from 'three';
import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves, Pose } from './types';

/*
 * The Miner (9 October 2026 rebuild, figure_miner.py): a stocky miner who
 * trudges with his pick on his right shoulder, digs to wherever he is
 * played and bursts up out of the ground, then swings the pick overhead in
 * both hands, down into whatever is in front of him.
 *
 * Both arms are posed with reach() (moves/reach.ts) from one description of
 * the haft: the right fist's grip centre on it, the haft's direction (butt
 * to head) and the way the pick's point faces. The pick rides the right
 * fist (its `weapon` joint stays at rest), so the right hand's palm and
 * fingers follow from the haft; the left fist closes on the same haft
 * 9.2 cm nearer the butt, palm mirrored, as two hands hold a bat. The
 * overhead swing turns the haft through straight up, so it never swings
 * under; the hips load the back leg in the wind-up and drive through the
 * chest into the blow.
 *
 * Everything below is in the chest's axes (three.js: x to his right, y up,
 * z back, so forward is -z), in the figure's own units, measured from the
 * chest joint. Numbers can be tuned live: window.__arenaTune = { miner: {…} }.
 */

type V3 = readonly [number, number, number];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => scale(a, 1 / Math.max(1e-9, Math.hypot(a[0], a[1], a[2])));
const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, sub(b, a), t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
const ease = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

/** The fists (figure_miner_sculpt.py): the haft's centre lies GRIP_E1 along
 *  the hand from the wrist and GRIP_E3 off the palm; the right fist holds
 *  the haft GRIP_R from the butt, the left GRIP_L. */
const GRIP_E1 = 0.06;
const GRIP_E3 = 0.03;
const GRIP_R = 0.15;
const GRIP_L = 0.058;
/** The sculpt's left fist at rest: its palm (towards the thigh) and the
 *  hand's line (wrist to knuckles), three.js axes. */
const HAND: HandRest = {
  palm: [0.9906, -0.1324, -0.0333],
  fingers: [-0.1365, -0.9607, -0.2415],
};

/** Where the haft is: the right fist's grip centre, the haft's direction
 *  (butt to head) and the point's direction (perpendicular to it). The
 *  right palm faces D x F's partner: N = D x F. */
type Haft = { g: V3; d: V3; f: V3 };

const orthoF = (d: V3, hint: V3): V3 => norm(sub(hint, scale(d, dot(hint, d))));
const haft = (g: V3, d: V3, hint: V3): Haft => {
  const dd = norm(d);
  return { g, d: dd, f: orthoF(dd, hint) };
};
const mixHaft = (a: Haft, b: Haft, t: number): Haft => {
  const d = norm(lerp3(a.d, b.d, t));
  return { g: lerp3(a.g, b.g, t), d, f: orthoF(d, lerp3(a.f, b.f, t)) };
};

/** Carried on the right shoulder: the right fist in front of the chest,
 *  the haft resting on the trapezius, the head behind and above it. */
const CARRY = haft([0.165, 0.025, -0.165], [-0.02, 0.205, 0.205], [0, 1, -0.9]);
/** The swing, by the haft's angle in the chest's plane (0 straight up,
 *  + forward, - back) and where the right fist is. At the blow the chest is
 *  bent well forward, so a haft pointing forward and up in its frame lies
 *  level in the world and drives the point straight down: the fists stay
 *  crosswise to the forearms all the way round, as real wrists allow. */
type Key = { phi: number; g: V3; poleR: V3; poleL: V3 };
const READY: Key = { phi: -0.75, g: [0.04, 0.06, -0.17], poleR: [0.5, -1, 0.15], poleL: [-0.5, -0.8, 0.5] };
const WIND: Key = { phi: -2.35, g: [0.15, 0.33, 0.04], poleR: [0.2, -0.3, -0.9], poleL: [-0.25, -0.5, -0.8] };
/** The top of the swing: the fists lead over the head while the pick's
 *  head still trails behind; it whips over as they drop. */
const TOP: Key = { phi: -1.1, g: [0.06, 0.4, -0.12], poleR: [0.55, -0.35, -0.45], poleL: [-0.45, -0.4, -0.55] };
const HIT: Key = { phi: 1.2, g: [0.06, -0.2, -0.29], poleR: [0.3, -0.3, -0.8], poleL: [-0.3, -0.3, -0.8] };
const DIG: Key = { phi: 1.36, g: [0.065, -0.21, -0.27], poleR: [0.3, -0.4, -0.7], poleL: [-0.3, -0.4, -0.7] };
const LEVER: Key = { phi: 0.55, g: [0.06, -0.06, -0.25], poleR: [0.5, -0.8, 0.4], poleL: [-0.5, -0.8, 0.4] };

const mixKey = (a: Key, b: Key, t: number): Key => ({
  phi: a.phi + (b.phi - a.phi) * t,
  g: lerp3(a.g, b.g, t),
  poleR: lerp3(a.poleR, b.poleR, t),
  poleL: lerp3(a.poleL, b.poleL, t),
});
/** Through a list of keys, u 0..1 spread evenly over the spans. */
const path = (keys: Key[], u: number): Key => {
  const x = clamp01(u) * (keys.length - 1);
  const i = Math.min(keys.length - 2, Math.floor(x));
  return mixKey(keys[i], keys[i + 1], x - i);
};
/** The haft for a key: turned by phi, tipped a little to his right while
 *  high (over the right shoulder), the point leading the swing. */
const onArc = (k: Key): Haft => {
  const side = 0.14 * Math.max(0, Math.cos(k.phi * 0.8)) + 0.1 * Math.max(0, Math.sin(k.phi));
  const d = norm([side, Math.cos(k.phi), -Math.sin(k.phi)]);
  const lead: V3 = [0, -Math.sin(k.phi), -Math.cos(k.phi)];
  return { g: k.g, d, f: orthoF(d, lead) };
};

/** The left arm hanging free, swinging with the walk. */
const FREE_L: ArmGoal = {
  hand: [-0.07, -0.395, -0.06],
  pole: [-0.35, -1, 0.8],
  palm: [1, 0.05, -0.1],
  fingers: [-0.12, -0.96, -0.22],
};
/** The left forearm drawn across the brow under the hat's brim (wiping the
 *  sweat off). */
const WIPE: ArmGoal = {
  hand: [0.24, 0.22, -0.19],
  pole: [-0.9, -0.1, 0.1],
  palm: [0.3, -0.4, 0.85],
  fingers: [0.9, 0.3, 0.1],
};

const T = {
  ready: 0.42,
  strike: 0.1,
  dig: 0.12,
  recover: 0.55,
  windTwist: 0.45,
  hitTwist: 0.08,
  windLean: 0.1,
  hitBend: 0.52,
  crouch: 0.07,
  lunge: 0.16,
};
const live = () => {
  const t = (
    globalThis as { __arenaTune?: Record<string, Record<string, number>> }
  ).__arenaTune?.miner;
  return t ? { ...T, ...t } : T;
};

const qc = new Quaternion();
const ec = new Euler();
const v = new Vector3();
const o = new Vector3();

/** Turn a wrist target and hand axes in the chest's frame into an ArmGoal
 *  in the arm's parent (the clavicle, turned by `clav`), mirrored for the
 *  right arm as reach() expects. */
function goal(
  c: MoveContext,
  side: 'L' | 'R',
  wrist: V3,
  palm: V3,
  fingers: V3,
  pole: V3,
  clav: V3,
): ArmGoal | null {
  const cr = c.rest(`clav${side}`);
  const ar = c.rest(`arm${side}`);
  if (!cr || !ar) return null;
  qc.setFromEuler(ec.set(clav[0], clav[1], clav[2], 'XYZ')).invert();
  const local = (p: V3, offset?: readonly number[]): V3 => {
    v.set(p[0], p[1], p[2]);
    if (offset) v.sub(o.set(offset[0], offset[1], offset[2]));
    v.applyQuaternion(qc);
    return [v.x, v.y, v.z];
  };
  const m = side === 'R' ? -1 : 1;
  const mirror = (p: V3): V3 => [p[0] * m, p[1], p[2]];
  const hand = sub(local(wrist, cr), ar as V3);
  return {
    hand: mirror(hand),
    palm: mirror(local(palm)),
    fingers: mirror(local(fingers)),
    pole: mirror(local(pole)),
  };
}

/** The wrists and hand axes that put both fists on the haft. */
function grips(h: Haft) {
  const n = cross(h.d, h.f);
  const wristR = sub(sub(h.g, scale(h.f, GRIP_E1)), scale(n, GRIP_E3));
  const gl = add(h.g, h.d, GRIP_L - GRIP_R);
  const wristL = add(sub(gl, scale(h.f, GRIP_E1)), n, GRIP_E3);
  return {
    right: { wrist: wristR, palm: n, fingers: h.f },
    left: { wrist: wristL, palm: scale(n, -1), fingers: h.f },
  };
}

/** The swing for a moment of the attack: `since` the last blow and
 *  `toHit` the next, both seconds. */
function attackKey(since: number, toHit: number, k: typeof T) {
  const recovering = since < k.recover;
  // Into the ground just after the blow, levered out, back to the ready.
  const after = (): Key =>
    since < k.dig
      ? mixKey(HIT, DIG, ease(since / k.dig))
      : path([DIG, LEVER, READY], ease((since - k.dig) / (k.recover - k.dig)));
  // The blow: over the top and down, accelerating into the hit.
  if (toHit < k.strike) {
    const u = 1 - toHit / k.strike;
    return { key: path([WIND, TOP, HIT], u * u * (1.5 - 0.5 * u)), wind: 1 - u, hit: u, dig: 0 };
  }
  // Wind-up: up behind the right shoulder (from wherever the recovery is).
  if (toHit < k.ready) {
    const w = ease((k.ready - toHit) / (k.ready - k.strike));
    return { key: mixKey(recovering ? after() : READY, WIND, w), wind: w, hit: 0, dig: 0 };
  }
  if (recovering) {
    const d = since < k.dig ? ease(since / k.dig) : 1 - ease((since - k.dig) / (k.recover - k.dig));
    return { key: after(), wind: 0, hit: since < k.dig ? 1 : d, dig: d };
  }
  return { key: READY, wind: 0, hit: 0, dig: 0 };
}

export const miner: Moves = {
  style: {
    // A stocky man's heavy trudge: short steps, the weight rolling from
    // foot to foot, the free arm swinging from a relaxed shoulder.
    gait: {
      like: 'heavy',
      stride: 0.52,
      cadence: 2.0,
      weight: 0.85,
      bounce: 0.03,
      crouch: 0.035,
      lift: 0.07,
      arms: 0.22,
      elbow: 0.2,
      lean: 0.07,
      sway: 0.7,
      roll: 0.07,
      twist: 0.07,
      width: 1.08,
      nod: 0.03,
    },
    lean: 0.07,
    attack: 'custom',
    windup: 0.42,
    lunge: 0.14,
    snap: 26,
    twoHanded: true,
  },
  carriage: {
    twist: 0.07,
    hips: 0.06,
    chestRoll: 0.25,
    nod: 0.03,
    armOut: 0,
    bounce: 0,
    weaponArm: 0,
  },
  // Both arms on matched, firm springs so the fists stay on the haft
  // through the swing; the hat on a softer one.
  stiff: {
    armL: 1.5,
    armR: 1.5,
    foreL: 1.5,
    foreR: 1.5,
    handL: 1.5,
    handR: 1.5,
    clavL: 1.2,
    clavR: 1.2,
    hat: 0.55,
  },
  damping: {
    armL: 0.72,
    armR: 0.72,
    foreL: 0.72,
    foreR: 0.72,
    handL: 0.72,
    handR: 0.72,
    hat: 0.45,
  },
  arrive(d) {
    // Tunnelling (hidden, troops.ts) until RISE, then up out of the ground
    // in a burst, a hop above it, down onto his boots.
    if (d < RISE) return { drop: -UNDER, squash: 1, twirl: 0 };
    if (d < PEAK) {
      const k = (d - RISE) / (PEAK - RISE);
      const out = 1 - (1 - k) * (1 - k);
      return {
        drop: -DEPTH + (DEPTH + HOP) * out,
        squash: 1.1 - 0.1 * k,
        twirl: -(1 - out) * 1.4,
      };
    }
    const fall = clamp01((d - PEAK) / 0.06);
    const land = pulse(d, PEAK + 0.05, PEAK + 0.075, PEAK + 0.13);
    return { drop: HOP * (1 - fall * fall), squash: 1 - land * 0.12, twirl: 0 };
  },
  pose(c, p) {
    const k = live();
    const cosmetic = c.reduced ? 0 : 1;
    const breath = Math.sin(c.t * 1.6) * cosmetic;
    const aim = c.aim;

    // ---- idle fidgets (standing about): a forearm wiped across the
    // brow, the pick hitched up on the shoulder, a look round.
    const lap = c.idleFor > 1.2 ? (c.idleFor + c.unit.id * 0.83) % 10 : -1;
    const awake = ease(c.idleFor - 1.2) * c.idle * cosmetic;
    const wipe = pulse(lap, 2.0, 2.6, 4.0) * awake;
    const wipeAcross = clamp01((lap - 2.5) / 1.2);
    const hitch = pulse(lap, 6.0, 6.18, 6.6) * awake;
    const look = pulse(lap, 7.6, 8.2, 9.4) * awake;

    // ---- the pick: on the shoulder, or in both hands for the attack.
    const bob = Math.cos(c.cycle * Math.PI * 4) * c.walk;
    const carry: Haft = {
      ...CARRY,
      g: add(CARRY.g, [0, 0.006 * bob + 0.004 * breath + 0.03 * hitch, 0]),
    };
    const swing = attackKey(c.since, c.toHit, k);
    // Bursting out of the ground he holds it up overhead in both hands.
    const rise = c.deploy < 1 ? pulse(c.deploy, RISE - 0.01, RISE + 0.05, PEAK + 0.08) : 0;
    const key = rise > 0.001 ? mixKey(swing.key, TOP, rise) : swing.key;
    const hold = Math.max(ease(aim * 1.1), rise);
    const h = mixHaft(carry, onArc(key), hold);
    const g = grips(h);

    // Shoulders: lifted as the hands go up, the right one forward.
    const lift = clamp01((g.right.wrist[1] - 0.12) / 0.25);
    const clavR: V3 = [0, 0.04 + 0.06 * swing.hit * aim, 0.04 + 0.18 * lift + 0.05 * hitch];
    const clavL: V3 = [0, -0.05 * aim - 0.1 * swing.hit * aim, -0.12 * lift * aim];
    c.want('clavR', clavR[0], clavR[1], clavR[2]);
    c.want('clavL', clavL[0], clavL[1], clavL[2]);
    c.want('weapon', 0, 0, 0);

    const poleR: V3 = norm(lerp3([0.55, -0.7, 0.5], key.poleR, hold));
    const right = goal(c, 'R', g.right.wrist, g.right.palm, g.right.fingers, poleR, clavR);
    const poleL: V3 = norm(key.poleL);
    const onHaft = goal(c, 'L', g.left.wrist, g.left.palm, g.left.fingers, poleL, clavL);

    // The free left arm swings with the walk (the shared swing is p.armL,
    // + forward) and wipes the brow now and then.
    let free: ArmGoal = { ...FREE_L, hand: add(FREE_L.hand, [0, 0.004 * breath, -p.armL * 0.3]) };
    if (wipe > 0.001) {
      const across = add(WIPE.hand, [-0.12 + 0.2 * wipeAcross, 0.01 * Math.sin(wipeAcross * 6), 0]);
      free = blend(free, { ...WIPE, hand: across }, wipe);
    }
    const leftOn = Math.max(ease(aim * 1.25), rise);
    if (right) reach(c, 'R', right, HAND);
    if (onHaft) reach(c, 'L', leftOn > 0.999 ? onHaft : blend(free, onHaft, leftOn), HAND);

    // ---- the body.
    // Breathing in the chest; standing about he settles his weight.
    p.torsoX += breath * 0.012 * (1 - aim);
    p.squash *= 1 + breath * 0.006 * (1 - aim);
    p.headY += look * 0.5 * Math.sin(c.unit.id * 2.1 + 1) - wipe * 0.1;
    p.headX += look * 0.08 + wipe * 0.12;
    p.roll += hitch * 0.02;

    // The attack: the hips and chest load to the right and lean back in
    // the wind-up (weight onto the back leg), then drive round and down
    // through the blow; the knees give as the point bites.
    const wind = swing.wind * aim;
    const hit = swing.hit * aim;
    const dig = swing.dig * aim;
    // (+y turns the chest to his left: the right shoulder comes forward.)
    p.torsoY += -k.windTwist * wind + k.hitTwist * hit * (1 - dig * 0.3);
    p.torsoX += -k.windLean * wind + k.hitBend * hit + 0.1 * dig;
    p.headX += -0.08 * wind - 0.22 * hit;
    p.headY += -0.15 * wind + 0.1 * hit;
    p.roll += 0.05 * wind - 0.04 * hit;
    p.lean += -0.03 * wind + 0.05 * hit;
    p.lunge += -0.04 * wind + k.lunge * hit;
    p.yawKick += -0.12 * wind + 0.03 * hit;
    p.lift -= c.size * (k.crouch * (0.4 + 0.6 * hit + 0.5 * dig) + 0.02 * wind) * aim;
    p.squash *= 1 - 0.03 * dig;

    // Hit: rocked back on his heels, head snapped round, the arms tighten.
    const hurt = c.flinch * c.flinch;
    p.torsoX -= hurt * 0.16;
    p.torsoZ += hurt * 0.08;
    p.headY -= hurt * 0.14;
    p.headX -= hurt * 0.1;
    p.lunge -= hurt * 0.07;

    // Up out of the ground: the pick held high in both hands as he bursts
    // out, the knees tucked, then the landing squats him down.
    if (c.deploy < 1) burst(c, p);

    // The hat lags the head a little.
    const soft = c.reduced ? 0.3 : 1;
    c.want(
      'hat',
      clamp(-c.accel * 0.004 - bob * 0.01 + hurt * 0.05 - c.vertical * 0.004, 0.08) * soft,
      0,
      clamp(-c.lateral * 0.004 + c.turn * 0.02, 0.05) * soft,
    );
  },
};

/** Through the deployment (0..1): tunnelling (hidden) until RISE, bursting
 *  up to a hop until PEAK, then landing. */
const RISE = 0.72;
const PEAK = 0.86;
/** Lying just under the field while he digs; he rises from DEPTH. */
const UNDER = 0.35;
const DEPTH = 1.7;
const HOP = 0.28;

function burst(c: MoveContext, p: Pose) {
  const d = c.deploy;
  const up = pulse(d, RISE, RISE + 0.04, PEAK + 0.06);
  const land = pulse(d, PEAK + 0.05, PEAK + 0.08, 1);
  p.torsoX += -0.12 * up + 0.3 * land;
  p.headX += -0.1 * up - 0.12 * land;
  p.lift -= c.size * 0.12 * land;
  if (up > 0.001) {
    // Knees tucked up as he clears the hole.
    for (const side of ['L', 'R'] as const) {
      c.want(`leg${side}`, up * 0.7, 0, (side === 'L' ? -1 : 1) * up * 0.08);
      c.want(`knee${side}`, -up * 1.2);
      c.want(`foot${side}`, up * 0.4);
    }
  }
}
