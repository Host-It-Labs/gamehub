import type { MoveContext, Moves, Pose } from './types';

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const clamp01 = (t: number) => clamp(t, 0, 1);
const ease = (t: number) => t * t * (3 - 2 * t);
const out3 = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
/** 0..1..0 over a span: in over `a` seconds, out over `b`. */
const envelope = (t: number, span: number, a = 0.22, b = 0.3) =>
  t < 0 || t > span ? 0 : ease(clamp01(t / a)) * ease(clamp01((span - t) / b));
/** A bump 0..1..0 between two moments. */
const bump = (t: number, from: number, to: number) =>
  t <= from || t >= to ? 0 : Math.sin(((t - from) / (to - from)) * Math.PI);

/** The arm's lift that holds the ray gun level, and the chest's turn that
 *  goes with it (figure_archers.py models the gun for these). */
const AIM = 1.47;
const TURN = 0.18;

/** The ray gun carried up at the ready: the upper arm a little forward and
 *  out, the forearm raised, the muzzle tipped up past level. */
const CARRY = { arm: 0.62, out: 0.02, fore: 1.75, gun: 0.32 };

/** Idle fidgets, chosen at random per cadet. */
const TWIRL = 0;
const SALUTE = 1;
const CHECK = 2;
const WAVE = 3;
const FIDGETS = 4;
const SPAN = [1.0, 1.5, 1.7, 1.7];

/** A cadet's own numbers, made the first time it is posed (Moves objects
 *  are shared by every cadet; each keeps its state in `c.memo`). */
function self(c: MoveContext) {
  const m = c.memo;
  if (m.seed === undefined) {
    m.seed = Math.random();
    // Left-handed helpers steady the gun with the free hand; the others
    // hold it out for balance.
    m.steady = Math.random() < 0.5 ? 1 : 0;
    m.side = Math.random() < 0.5 ? -1 : 1;
    m.fid = -1;
    m.next = 0.6 + Math.random() * 1.6;
    m.last = -1;
    m.spins = 0;
    m.lookAt = 0;
    m.lookY = 0;
    m.lookX = 0;
    m.was = 0;
    m.pitch = 0;
    m.rollW = 0;
    m.dPitch = 0;
    m.dRoll = 0;
    m.hitSide = 1;
    m.flinch = 0;
  }
  return m;
}

/** The idle fidget under way (kind and seconds into it), choosing the next
 *  one now and then; anything but standing about cancels it. */
function fidget(c: MoveContext, m: Record<string, number>) {
  if (c.idleFor <= 0) {
    if (m.fid === TWIRL && m.was - m.start > SPAN[TWIRL] * 0.45) m.spins += 1;
    m.fid = -1;
    m.next = 0.5 + Math.random() * 1.5;
    m.was = 0;
    return { kind: -1, at: 0 };
  }
  m.was = c.idleFor;
  if (m.fid < 0 && c.idleFor >= m.next) {
    let kind = Math.floor(Math.random() * FIDGETS);
    if (kind === m.last) kind = (kind + 1 + Math.floor(m.seed * 3)) % FIDGETS;
    m.fid = kind;
    m.last = kind;
    m.start = c.idleFor;
    m.side = Math.random() < 0.5 ? -1 : 1;
  }
  if (m.fid >= 0) {
    const at = c.idleFor - m.start;
    if (at > SPAN[m.fid]) {
      if (m.fid === TWIRL) m.spins += 1;
      m.fid = -1;
      m.next = c.idleFor + 1.4 + Math.random() * 2.6;
      return { kind: -1, at: 0 };
    }
    return { kind: m.fid, at };
  }
  return { kind: -1, at: 0 };
}

/** Where the cadet looks while standing about: a new glance every second
 *  or two, held, then another. */
function glance(c: MoveContext, m: Record<string, number>) {
  if (c.time >= m.lookAt) {
    m.lookAt = c.time + 0.8 + Math.random() * 1.8;
    m.lookY = (Math.random() - 0.5) * 1.1;
    m.lookX = (Math.random() - 0.4) * 0.16;
  }
}

/** The Cadets: alert rookies in pressure suits. A grounded, brisk walk
 *  with the ray gun carried at the ready, a stance that kicks with every
 *  shot, a firm landing and a jolt when hit; standing about they look
 *  round, check their ray guns, salute and wave. The antenna and visor
 *  bounces on everything they do. */
export const archers: Moves = {
  style: {
    gait: {
      like: 'light',
      cadence: 2.2,
      stride: 0.66,
      bounce: 0.022,
      crouch: 0.022,
      lift: 0.09,
      arms: 0.4,
      elbow: 0.3,
      lean: 0,
      sway: 0.34,
      roll: 0.03,
      twist: 0.08,
      heel: 0.2,
      toe: 0.4,
      nod: 0.016,
    },
    lean: 0,
    attack: 'custom',
    windup: 0.22,
    lunge: 0,
    snap: 30,
  },
  stiff: { antenna: 0.42, hat: 0.9, handL: 0.8, foreL: 0.85, weapon: 1.1 },
  damping: { antenna: 0.24, hat: 0.4, handL: 0.45, foreL: 0.5, weapon: 0.55 },
  pose(c, p) {
    const m = self(c);
    const { walk, aim, idle, wind, strike, size } = c;
    const free = 1 - aim;
    const cyc = c.cycle * TAU;

    // ---- Walking: the knees absorb each footfall; a small shoulder
    // response keeps the head and pressure suit steady.
    const late = Math.cos(cyc * 2 - 1.1);
    p.squash *= 1 + walk * 0.008 * (c.pass - 0.55);
    p.headX += walk * late * 0.012;
    p.headY += walk * Math.sin(cyc) * 0.06;
    p.torsoZ += walk * Math.sin(cyc) * 0.03;
    // Chest up: a light rookie walks tall, the spine near vertical (the
    // shared walk's lean and surge are taken back too).
    p.torsoX = Math.min(p.torsoX, 0.02 + aim) - walk * 0.08;
    p.lean = Math.min(p.lean, 0.01 + aim);

    // ---- The ray gun at the ready: carried up, the forearm raised and
    // the muzzle tipped to the sky, bobbing after each step. The gun arm
    // keeps a little of the shared swing.
    const step = -Math.cos(cyc * 2 - 0.9);
    p.armR -= c.swingR * 0.75;
    p.armR += free * (CARRY.arm + walk * step * 0.04);
    p.armRz += free * CARRY.out;
    let foreR = free * (CARRY.fore + walk * step * 0.12);
    let gun = free * (CARRY.gun - walk * step * 0.1);
    gun += Math.sin(c.t * 1.9) * 0.04 * idle;

    // The free arm swings loose: the elbow bends on the forward swing, the
    // hand flops a beat behind it.
    const elbowLate = -Math.cos(cyc - 0.9);
    // The shared swing leans forward; even it out so the arm hangs and
    // swings as far back as forward, the elbow only trailing a little.
    p.armL -= walk * 0.05;
    let foreL = 0.12 + walk * (0.05 + 0.18 * Math.max(0, elbowLate));
    let foreLz = 0;
    let handLx = walk * Math.sin(cyc - 0.4) * 0.16 - 0.06;
    let handLz = 0;

    // ---- Attacking: a low ready stance between shots, the chest turned
    // to bring the gun to the eye, the gun held level; each shot kicks the
    // muzzle up, the shoulder back and the antenna with it.
    const kick = strike;
    const sway = Math.sin(c.t * 2.6) * 0.02;
    p.armR += aim * (AIM + sway - wind * 0.05 + kick * 0.18);
    foreR += aim * (kick * 0.42 - wind * 0.04);
    gun += aim * (kick * 0.3);
    p.torsoY += aim * (TURN - kick * 0.1);
    p.torsoX += aim * (0.12 + wind * 0.04) - kick * 0.1;
    p.headX += aim * 0.02 - kick * 0.12;
    // Eyes stay on the target as the chest turns.
    p.headY -= aim * TURN * 0.6;
    p.lean += -kick * 0.12 + wind * 0.02;
    p.lunge -= kick * 0.07;
    // (Kept within the ground solver's reach, so the knees take it.)
    p.lift -= aim * (0.03 + Math.sin(c.t * 3.1) * 0.004 - kick * 0.012) * size;
    p.squash *= 1 - kick * 0.03;
    if (m.steady) {
      // The free hand steadies the gun hand from below.
      p.armL += aim * (1.05 - kick * 0.12);
      p.armLz += aim * 0.42;
      foreL += aim * (0.55 + kick * 0.1);
      handLx += aim * 0.25;
    } else {
      // The free arm out behind for balance, swung back by each shot.
      p.armL += aim * (-0.35 - kick * 0.25);
      p.armLz -= aim * 0.32;
      foreL += aim * 0.5;
      handLx -= aim * 0.15;
    }

    // ---- Standing about: breathing, glancing round and shifting weight.
    glance(c, m);
    p.squash *= 1 + Math.sin(c.t * 1.8 + m.seed * 6) * 0.003 * idle;
    p.headY += idle * m.lookY;
    p.headX += idle * m.lookX;
    p.roll += idle * Math.sin(c.t * 0.8 + m.seed * 4) * 0.025;
    p.torsoY += idle * m.lookY * 0.25;

    // ---- Fidgets.
    const { kind, at } = fidget(c, m);
    const span = kind >= 0 ? SPAN[kind] : 1;
    const e = kind >= 0 ? envelope(at, span) * idle : 0;
    let twirl = m.spins * TAU;
    if (kind === TWIRL) {
      // Up, a spin of the gun round the trigger finger, caught.
      const s = ease(clamp01((at - 0.2) / 0.55));
      twirl += s * TAU;
      p.armR += e * 0.12;
      foreR -= e * 0.35;
      p.headY -= e * 0.25 + idle * m.lookY * e;
      p.headX += e * 0.12;
    } else if (kind === SALUTE) {
      // Heels together, chin up, the flat hand snapped to the visor.
      const snap = out3(clamp01(at / 0.2)) * ease(clamp01((span - at) / 0.3));
      const sal = snap * idle;
      p.armL += sal * 0.85;
      p.armLz -= sal * 1.3;
      foreL += sal * 2.05;
      foreLz -= sal * 0.3;
      handLz += sal * 0.45;
      handLx -= sal * 0.25;
      p.headX -= sal * 0.1;
      p.headY -= idle * m.lookY * sal;
      p.torsoX -= sal * 0.05;
    } else if (kind === CHECK) {
      // The gun brought up before the visor, turned to look it over,
      // a nod.
      p.armR += e * 0.35;
      p.armRz -= e * 0.38;
      foreR += e * 0.45;
      gun -= e * (0.9 + Math.sin(at * 5) * 0.25);
      p.headY -= e * 0.32 + idle * m.lookY * e;
      p.headX += e * (0.18 + bump(at, 1.15, 1.45) * 0.15);
      p.torsoY -= e * 0.1;
    } else if (kind === WAVE) {
      // A big wave to the other cadet: the hand up beside the helmet,
      // swept from side to side, flapping at the wrist.
      const w = Math.sin(at * 13);
      p.armL += e * 0.55;
      p.armLz -= e * 1.45;
      foreL += e * 1.95;
      foreLz -= e * w * 0.4;
      handLz += e * w * 0.35;
      p.headY += -idle * m.lookY * e + e * 0.35;
      p.roll += e * 0.04;
    }
    gun += twirl;

    // ---- Arriving: one landing, knees absorbing it, then the gun ready.
    if (c.deploy < 1) {
      const d = c.deploy;
      const fall = d < 0.26 ? 1 - d / 0.26 : 0;
      const tuck = fall > 0 ? 0.65 * fall : 0;
      // The legs are the cadet's only while tucked: the ground solver
      // plants them again where they land.
      if (tuck > 0.01) {
        c.want('legL', 0.7 * tuck);
        c.want('kneeL', -1.15 * tuck);
        c.want('footL', 0.35 * tuck);
        c.want('legR', 0.25 * tuck);
        c.want('kneeR', -0.9 * tuck);
        c.want('footR', 0.3 * tuck);
      }
      p.armLz -= tuck * 1.3;
      p.armRz += tuck * 0.5;
      p.armR += tuck * 0.8;
      // The landing: a crouch, then up with the gun to the sky.
      const ready = bump(d, 0.3, 1);
      p.armR += ready * 0.6;
      foreR += ready * 0.4;
      p.headX -= ready * 0.12;
    }

    // ---- Hit: a jolt back, arms flung out, a stagger to one side.
    if (c.flinch > m.flinch + 0.5) m.hitSide = -m.hitSide;
    m.flinch = c.flinch;
    const f = c.flinch * c.flinch;
    p.armLz -= f * 0.7;
    p.armL += f * 0.3;
    p.armRz += f * 0.3;
    foreR -= f * 0.35;
    foreL += f * 0.5;
    p.headX -= f * 0.12;
    p.torsoZ += f * 0.14 * m.hitSide;
    p.roll += f * 0.05 * m.hitSide;
    p.headY += f * 0.2 * m.hitSide;

    c.want('foreR', foreR);
    c.want('weapon', gun);
    c.want('foreL', foreL, 0, foreLz);
    c.want('handL', handLx, 0, handLz);

    soft(c, p, m);
  },
  arrive(d) {
    // One firm contact at d 0.26, with no second hop or twirl.
    const fall = clamp01(d / 0.26);
    const drop = (1 - fall * fall) * 2.8;
    const land = bump(d, 0.26, 0.42);
    const settle = bump(d, 0.42, 0.52);
    return {
      drop,
      squash: d < 0.26 ? 1.02 : 1 - land * 0.1 + settle * 0.012,
      twirl: 0,
    };
  },
};

/** The antenna and the visor, from how the body moves: the antenna's tip
 *  lags every push, landing, turn, nod and shot and whips past, the visor
 *  bounces on its hinges. */
function soft(c: MoveContext, p: Pose, m: Record<string, number>) {
  const dt = Math.max(1e-3, c.dt);
  const pitch = p.torsoX + p.headX + p.lean - p.lunge * 0.8;
  const roll = p.roll + p.torsoZ;
  const k = Math.min(1, dt * 20);
  m.dPitch += ((pitch - m.pitch) / dt - m.dPitch) * k;
  m.dRoll += ((roll - m.rollW) / dt - m.dRoll) * k;
  m.pitch = pitch;
  m.rollW = roll;
  const vertical = clamp(c.vertical, -30, 30);
  const ax =
    0.03 * clamp(c.accel, -10, 10) -
    0.009 * vertical +
    0.05 * clamp(m.dPitch, -6, 6) +
    0.12 * c.flinch;
  const az =
    0.022 * clamp(c.lateral, -10, 10) -
    0.07 * clamp(c.turn, -6, 6) -
    0.06 * clamp(m.dRoll, -6, 6) +
    Math.sin(c.t * 1.3) * 0.03 * c.idle;
  c.want('antenna', clamp(ax, -0.6, 0.6), 0, clamp(az, -0.6, 0.6));
  // The visor rides up a touch on the move and drops a little for the
  // shot (game face), bouncing on each landing.
  const lid =
    -0.004 * vertical -
    0.25 * c.aim +
    0.06 * c.walk -
    0.1 * c.flinch +
    0.02 * clamp(m.dPitch, -6, 6);
  c.want('hat', clamp(lid, -0.32, 0.25));
}
