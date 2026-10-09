import { dutyFactor, weightSide } from '@/lib/games/arena/gait';
import type { Moves } from './types';

const TAU = Math.PI * 2;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const ease = (t: number) => t * t * (3 - 2 * t);
const wrap01 = (w: number) => ((w % 1) + 1) % 1;
/** A bump over `k` 0..1: up quickly, down slowly. */
const hump = (k: number) =>
  k <= 0 || k >= 1 ? 0 : Math.sin(Math.PI * Math.pow(k, 0.6));

/** One footfall through a step (`w` 0..1 from the heel strike): the weight
 *  slams onto the foot in a few hundredths of the step, then eases off. */
function thud(w: number) {
  w = wrap01(w);
  if (w < 0.08) return Math.sin((w / 0.08) * (Math.PI / 2));
  return Math.exp(-(w - 0.08) / 0.15);
}

/** The bite: wind-up and hit seconds. The engine strikes on the hit. */
const BITE = 0.07;
const BACK = 0.55;

/** Idle fidgets and how long each lasts (seconds). */
const FIDGETS = ['sniff', 'tilt', 'swish', 'twitch', 'roar'] as const;
type Fidget = (typeof FIDGETS)[number];
const LENGTH: Record<Fidget, number> = {
  sniff: 1.7,
  tilt: 1.6,
  swish: 1.6,
  twitch: 0.8,
  roar: 2.3,
};
/** The order they come in (the roar now and then, not every time). */
const ROUND: Fidget[] = ['tilt', 'sniff', 'roar', 'swish', 'twitch'];

/** A roar over `k` 0..1: a breath in (head down, jaw shut), then rearing
 *  up with the jaw wide and a shake of the head, and back down. Returns
 *  how far into the open roar it is (0..1) and the breath in (0..1). */
function roarShape(k: number) {
  const breath = hump(clamp01(k / 0.28));
  const open =
    k < 0.22
      ? 0
      : k < 0.36
        ? ease((k - 0.22) / 0.14)
        : k < 0.78
          ? 1
          : 1 - ease((k - 0.78) / 0.22);
  return { breath, open };
}

/** The Dino: a matte T-rex with big planted feet. A heavy stomp, the body
 *  sinking onto each foot, the head and tail counterbalancing it (the
 *  head nods a beat after each step, the tail swings against the hips and
 *  follows through link by link), the little arms bouncing. Idle he
 *  breathes, sniffs, tilts his head, swishes his tail, twitches his claws
 *  and now and then roars. The bite draws back with the jaw wide, snaps
 *  forward and tugs; a hit makes him flinch and shake it off; he lands
 *  with a stomp and a roar. */
export const ogre: Moves = {
  style: {
    // Heavy and rolling but not slow: limbs at about two steps a second.
    gait: {
      like: 'beast',
      cadence: 1.85,
      stride: 0.52,
      bounce: 0.028,
      crouch: 0.03,
      lift: 0.13,
      sway: 0.55,
      roll: 0.045,
      twist: 0.05,
      heel: 0.16,
      toe: 0.32,
      nod: 0,
      arms: 0.1,
      elbow: 0,
    },
    armSwing: 0.1,
    lean: 0.06,
    attack: 'custom',
    windup: 0.6,
    lunge: 0.36,
    snap: 20,
    heavy: true,
  },
  carriage: {
    twist: 0.1,
    hips: 0.07,
    chestRoll: 0.35,
    nod: 0.07,
    armOut: 0.05,
    bounce: 0.05,
    weaponArm: 1,
  },
  // The tail is a soft chain, each link looser than the last; the little
  // forearms flop; the jaw snaps.
  stiff: {
    tail: 0.5,
    tail2: 0.44,
    tail3: 0.38,
    foreL: 0.75,
    foreR: 0.75,
    jaw: 1.9,
    head: 0.62,
  },
  damping: {
    tail: 0.48,
    tail2: 0.38,
    tail3: 0.32,
    foreL: 0.42,
    foreR: 0.42,
    head: 0.55,
    jaw: 0.5,
  },
  pose(c, p) {
    const { walk, aim, idle, memo } = c;
    const g = c.gait;
    const w = (c.cycle * 2) % 1;
    // +1 with the weight on the left foot, -1 on the right.
    const ws = weightSide(c.cycle, dutyFactor(g));
    const phase = c.cycle * TAU;
    const turn = Math.max(-2.5, Math.min(2.5, c.turn));
    const accel = Math.max(-4, Math.min(4, c.accel));

    // Pieces of the pose built up below and handed out at the end.
    let headX = 0;
    let headY = 0;
    let headZ = 0;
    let headDy = 0;
    let jaw = 0;
    let foreL = 0.12;
    let foreR = 0.12;
    const tail = [
      [0, 0],
      [0, 0],
      [0, 0],
    ];

    // ---- Walking: a heavy stomp.
    const hit = thud(w) * walk;
    const late = thud(w - 0.12) * walk;
    const later = thud(w - 0.22) * walk;
    // The body drops onto the foot, squashes a touch and rolls over it.
    p.lift -= hit * 0.032 * c.size;
    p.squash *= 1 - hit * 0.022;
    p.torsoX += hit * 0.04 - late * 0.015;
    p.torsoZ += ws * 0.05 * walk;
    p.roll += ws * 0.012 * walk;
    // The head lifts against the drop, then nods a beat later and bobs.
    headX += -hit * 0.04 + late * 0.12 - later * 0.03;
    headDy += -late * 0.05;
    headY += ws * 0.03 * walk;
    jaw += late * 0.07;
    // The tail swings against the hips, each link a little later, and
    // droops a beat after each footfall.
    for (let k = 0; k < 3; k++) {
      const lag = 0.55 * (k + 1);
      tail[k][1] +=
        Math.cos(phase - TAU * (dutyFactor(g) / 2) - lag) *
        (0.07 + k * 0.03) *
        walk;
      tail[k][0] += thud(w - 0.06 - k * 0.08) * (0.035 + k * 0.012) * walk;
    }
    // The little arms flop down as the foot lands and spring back; the
    // forearms a moment later.
    p.armL += -thud(w - 0.03) * 0.2 * walk + 0.12 * walk;
    p.armR += -thud(w - 0.03) * 0.2 * walk + 0.12 * walk;
    foreL += thud(w - 0.1) * 0.35 * walk + Math.max(0, c.fwdR) * 0.12 * walk;
    foreR += thud(w - 0.1) * 0.35 * walk + Math.max(0, c.fwdL) * 0.12 * walk;

    // Motion the soft parts lag: turning swings the tail out, speeding up
    // drops it, braking lifts it.
    for (let k = 0; k < 3; k++) {
      tail[k][1] += -turn * (0.06 + k * 0.025);
      tail[k][0] += accel * (0.012 + k * 0.006);
    }
    headY += turn * 0.07;

    // ---- Standing: breathing and fidgets.
    const breath = Math.sin(c.t * 1.7);
    p.torsoX -= breath * 0.018 * idle;
    p.squash *= 1 + breath * 0.008 * idle;
    jaw += (breath * 0.5 + 0.5) * 0.05 * idle;
    foreL += (breath * 0.5 + 0.5) * 0.08 * idle;
    foreR += (breath * 0.5 + 0.5) * 0.08 * idle;
    // A slow shift of weight and a lazy tail.
    p.roll += Math.sin(c.t * 0.45) * 0.018 * idle;
    p.torsoZ += Math.sin(c.t * 0.45 + 0.6) * 0.02 * idle;
    for (let k = 0; k < 3; k++)
      tail[k][1] += Math.sin(c.t * 0.9 - k * 0.7) * (0.05 + k * 0.03) * idle;

    // Fidgets, timed by how long he has stood about.
    if (c.idleFor < 0.05 || memo.next === undefined) {
      memo.next = 1.2 + Math.random() * 1.5;
      memo.start = -1;
    }
    if (memo.start < 0 && c.idleFor > memo.next) {
      memo.kind = ((memo.kind ?? -1) + 1) % ROUND.length;
      memo.start = c.idleFor;
      memo.side = Math.random() < 0.5 ? -1 : 1;
    }
    if (memo.start >= 0) {
      const kind = ROUND[memo.kind];
      const k = (c.idleFor - memo.start) / LENGTH[kind];
      if (k >= 1) {
        memo.start = -1;
        memo.next = c.idleFor + 1.6 + Math.random() * 2.2;
      } else {
        const e = hump(k) * idle;
        const sd = memo.side;
        switch (kind) {
          case 'sniff': {
            // Nose up into the air, turned to one side, three quick sniffs.
            headX -= e * 0.16;
            headY += e * sd * 0.28;
            const sniffs =
              k > 0.25 && k < 0.75 ? Math.sin((k - 0.25) * TAU * 6) : 0;
            headX += sniffs * 0.025 * e;
            headDy += Math.max(0, sniffs) * 0.012 * e;
            p.torsoX -= e * 0.05;
            break;
          }
          case 'tilt': {
            // A curious tilt of the head, held, then the other way a touch.
            const back = k > 0.55 ? ease((k - 0.55) / 0.45) : 0;
            headZ += e * sd * 0.28 * (1 - back * 1.6);
            headY += e * sd * 0.18;
            headX += e * 0.05;
            break;
          }
          case 'swish': {
            // A big lazy wave down the tail.
            for (let j = 0; j < 3; j++)
              tail[j][1] +=
                Math.sin(k * TAU * 1.5 - j * 0.9) * (0.12 + j * 0.06) * e * sd;
            p.torsoY += Math.sin(k * TAU * 1.5 + 0.5) * 0.04 * e * sd;
            break;
          }
          case 'twitch': {
            // The little claws flex twice.
            const flex = Math.max(0, Math.sin(k * TAU * 2));
            foreL += flex * 0.5 * idle;
            foreR += flex * 0.45 * idle;
            p.armL += e * 0.2;
            p.armR += e * 0.2;
            headX += e * 0.08;
            break;
          }
          case 'roar': {
            const { breath: inhale, open } = roarShape(k);
            const r = open * idle;
            const b = inhale * idle;
            // Breath in: head down and back a little, chest swelling.
            headX += b * 0.1;
            p.torsoX -= b * 0.05;
            p.squash *= 1 + b * 0.02;
            // The roar: rearing, head up and out, jaw wide, arms out, the
            // tail low behind him, the head shaking.
            p.torsoX -= r * 0.16;
            p.lean -= r * 0.05;
            headX -= r * 0.32;
            headY += Math.sin(c.t * 26) * 0.035 * r;
            headZ += Math.sin(c.t * 19) * 0.03 * r;
            jaw += r * 0.85;
            p.armL += r * 0.4;
            p.armR += r * 0.4;
            foreL += r * 0.5;
            foreR += r * 0.5;
            p.squash *= 1 - Math.sin(c.t * 40) * 0.004 * r;
            for (let j = 0; j < 3; j++) tail[j][0] += r * (0.06 + j * 0.03);
            break;
          }
        }
      }
    }

    // ---- The bite.
    if (aim > 0.01) {
      const since = c.since;
      // The snap and the follow-through after the hit.
      const snap =
        since < BITE
          ? 1 - Math.pow(1 - since / BITE, 3)
          : since < BITE + BACK
            ? 1 - ease((since - BITE) / BACK)
            : 0;
      const bite = snap * aim;
      const tug =
        since < 0.75 ? Math.sin(since * 22) * Math.exp(-since * 4.5) * aim : 0;
      const wind = c.wind;
      // Ready: a level forward skull, jaw ajar and small arms braced.
      headX += aim * 0.04;
      jaw += aim * 0.14;
      p.armL += aim * 0.35;
      p.armR += aim * 0.35;
      p.torsoX += aim * 0.015;
      for (let k = 0; k < 3; k++) tail[k][0] -= aim * (0.03 + k * 0.01);
      // Draw the weight back over the hips as the jaw opens. The horizontal
      // T-rex neck stays restrained rather than craning up for a peck.
      p.torsoX -= wind * 0.09;
      headX -= wind * 0.1;
      jaw += wind * 0.85;
      p.lean -= wind * 0.025;
      p.lunge -= wind * 0.06;
      // Coil down onto the haunches, ready to spring.
      p.lift -= wind * 0.03 * c.size;
      p.armL += wind * 0.3;
      p.armR += wind * 0.3;
      foreL += wind * 0.4;
      foreR += wind * 0.4;
      for (let k = 0; k < 3; k++) tail[k][0] += wind * (0.07 + k * 0.03);
      // Snap the jaw forward through the same impact beat. A small weight
      // transfer and neck dip keep the snout above the ground.
      p.torsoX += bite * 0.12;
      headX += bite * 0.12;
      jaw -= bite * 0.14;
      p.lean += bite * 0.035;
      p.lunge += bite * 0.32;
      p.squash *= 1 - bite * 0.03;
      p.lift -= bite * 0.012 * c.size;
      // The tug: the head wrenches side to side, the shoulders with it,
      // the tail whipping up and round.
      const sideOf = c.hits % 2 === 0 ? 1 : -1;
      headY += tug * 0.28 * sideOf;
      headZ += tug * 0.1 * sideOf;
      p.torsoY += tug * 0.12 * sideOf;
      for (let k = 0; k < 3; k++) {
        tail[k][0] -= bite * (0.12 + k * 0.05);
        tail[k][1] -= tug * (0.06 + k * 0.05) * sideOf;
      }
    }

    // ---- A hit: a jolt, the jaw snapping open, a shake of the head.
    if (c.flinch > (memo.flinch ?? 0) + 0.2) {
      memo.hitAt = c.time;
      memo.hitSide = Math.random() < 0.5 ? -1 : 1;
    }
    memo.flinch = c.flinch;
    const sinceHurt = c.time - (memo.hitAt ?? -99);
    if (sinceHurt < 0.7) {
      const calm = 1 - aim * 0.5;
      const jolt = Math.exp(-sinceHurt * 9) * calm;
      const shake = Math.sin(sinceHurt * 24) * Math.exp(-sinceHurt * 5) * calm;
      const sd = memo.hitSide;
      jaw += jolt * 0.45;
      headX -= jolt * 0.12;
      headY += shake * 0.2 * sd;
      headZ += jolt * 0.18 * sd;
      p.torsoZ += jolt * 0.08 * sd;
      p.lean -= jolt * 0.06;
      p.squash *= 1 - jolt * 0.035;
      p.armL += jolt * 0.45;
      p.armR += jolt * 0.45;
      foreL += jolt * 0.6;
      foreR += jolt * 0.6;
      for (let k = 0; k < 3; k++) {
        tail[k][0] -= jolt * (0.12 + k * 0.05);
        tail[k][1] += shake * (0.08 + k * 0.05) * sd;
      }
    }

    // ---- Landing: legs tucked under him as he falls, a stomp, a roar.
    if (c.deploy < 1) {
      const d = c.deploy;
      const air = 1 - clamp01((d - 0.22) / 0.1);
      if (air > 0) {
        c.want('legL', 0.35 * air, 0, 0);
        c.want('kneeL', -0.5 * air);
        c.want('footL', 0.25 * air);
        c.want('legR', 0.2 * air, 0, 0);
        c.want('kneeR', -0.35 * air);
        c.want('footR', 0.2 * air);
        p.armL += 0.5 * air;
        p.armR += 0.5 * air;
        foreL += 0.6 * air;
        foreR += 0.6 * air;
        jaw += 0.3 * air;
        for (let k = 0; k < 3; k++) tail[k][0] -= (0.1 + k * 0.05) * air;
      }
      // The roar once he is down.
      const k = clamp01((d - 0.42) / 0.58);
      if (k > 0) {
        const { breath: inhale, open } = roarShape(k);
        headX += inhale * 0.12 - open * 0.34;
        p.torsoX += inhale * 0.06 - open * 0.15;
        jaw += open * 0.9;
        headY += Math.sin(c.t * 26) * 0.04 * open;
        p.armL += open * 0.45;
        p.armR += open * 0.45;
        foreL += open * 0.5;
        foreR += open * 0.5;
        for (let j = 0; j < 3; j++) tail[j][0] += open * (0.05 + j * 0.03);
      }
    }

    // Hand out the head (it stays level as the body rolls), the jaw, the
    // tail links, the elbows.
    const hx = p.headX + headX;
    // (The shared look-about, gentler: the whole neck turns with it.)
    const hy = p.headY * (1 - 0.35 * idle) + headY;
    c.want('head', -hx, hy, -(p.roll + p.torsoZ) * 0.75 * walk + headZ, headDy);
    p.headX = hx;
    p.headY = hy;
    // A jaw opens with a negative turn; it hangs open a little at rest.
    c.want('jaw', -Math.max(-0.12, Math.min(0.72, p.jaw + jaw)));
    // The long horizontal counterweight follows the hips with progressively
    // smaller angular travel. Its mass bends gently through the connected skin.
    const tailPitch = (v: number, limit: number) =>
      Math.max(-limit, Math.min(limit, v * 0.55));
    const tailYaw = (v: number, limit: number) =>
      Math.max(-limit, Math.min(limit, v * 0.65));
    c.want(
      'tail',
      tailPitch(tail[0][0], 0.07),
      tailYaw(p.tailY + tail[0][1], 0.14),
      0,
    );
    c.want('tail2', tailPitch(tail[1][0], 0.065), tailYaw(tail[1][1], 0.12), 0);
    c.want('tail3', tailPitch(tail[2][0], 0.055), tailYaw(tail[2][1], 0.1), 0);
    c.want('foreL', foreL);
    c.want('foreR', foreR);
  },
  arrive(d) {
    // Dropped straight down, heavy: no twirl, a deep squash as he lands
    // and a little rebound; then he stands and roars (in `pose`).
    const fall = clamp01(d / 0.26);
    let drop = (1 - fall * fall) * 3.2;
    let squash = fall < 1 ? 1.05 : 1;
    if (d >= 0.26) {
      const land = clamp01((d - 0.26) / 0.16);
      squash = 1 - Math.sin(land * Math.PI) * 0.26 * (1 - land * 0.3);
      drop += Math.sin(clamp01((d - 0.3) / 0.14) * Math.PI) * 0.06;
    }
    return { drop, squash, twirl: 0 };
  },
};
