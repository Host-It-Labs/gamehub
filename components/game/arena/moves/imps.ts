import type { MoveContext, Moves, Pose } from './types';

const TAU = Math.PI * 2;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const clamp = (v: number, a: number) => (v < -a ? -a : v > a ? a : v);
const bump = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t));

const STYLE = {
  // The old wind-up scurry (troops.ts, `walkingLeg`), a little bouncier.
  gait: 'clockwork' as const,
  stride: 0.2,
  legSwing: 0.6,
  armSwing: 0.46,
  bob: 0.06,
  sway: 0.16,
  lean: 0.05,
  attack: 'custom' as const,
  windup: 0.3,
  lunge: 0.17,
  snap: 42,
};

/** The jab arm's shoulder turns forward with +y on the torso. */
const TWIST = 1;
/** The lids (`extra`) fully over the eyes. */
const SHUT = -2.0;

/** The landing's bounces: start, length, height (world units) and squash. */
const CLATTER: [number, number, number, number][] = [
  [0.26, 0.18, 0.5, 0.3],
  [0.44, 0.1, 0.15, 0.14],
  [0.54, 0.06, 0.05, 0.08],
  [0.6, 0.04, 0.02, 0.05],
];

/** Per-troop scratch (`c.memo`), set up on the first frame. */
function memo(c: MoveContext) {
  const m = c.memo;
  if (m.r === undefined) {
    m.r = Math.random();
    m.key = Math.random() * TAU;
    // How wound up the spring is: 1 fresh, running down while it idles.
    m.wound = 0.75 + Math.random() * 0.25;
    m.shake = 0;
    m.lookAt = 0;
    m.tilt = 0;
    m.lookNext = 0.4 + Math.random() * 2;
    m.blink = 0;
    m.blinkNext = 0.5 + Math.random() * 3;
    m.turns = 0;
    m.spinT = -1;
    m.spinDir = 1;
    m.lastSpin = -99;
    m.fl = 0;
    m.kick = 0;
    m.pp = 0;
    m.pv = 0;
    m.rp = 0;
    m.rv = 0;
    m.needle = 0;
  }
  return m;
}

/** Idle: the spring runs down (key slowing, body sagging, lids drooping)
 *  until the robot shakes itself back up with a hop; between times it
 *  ticks, swivels its head to look at its neighbours and blinks. Returns
 *  the sag (0..1) and the shake's envelope. */
function idleLife(c: MoveContext, m: Record<string, number>, p: Pose) {
  const { dt, idle } = c;
  const standing = c.deploy >= 1 ? idle : 0;
  // The shared idle drifts the head smoothly; a robot snaps instead.
  p.headY -= (Math.sin(c.t * 0.61) * 0.3 + Math.sin(c.t * 1.7) * 0.08) * idle;
  p.headX -= Math.sin(c.t * 1.3) * 0.04 * idle;
  p.roll -= Math.sin(c.t * 0.9) * 0.02 * idle;

  if (c.idleFor > 0.6 && m.shake <= 0)
    m.wound = Math.max(0, m.wound - dt / (7 + 5 * m.r));
  else if (c.idleFor <= 0) m.wound = Math.min(1, m.wound + dt * 1.5);
  // Out of spring: shiver, rattle and hop back up.
  if (m.wound < 0.1 && m.shake <= 0) m.shake = 1;
  let env = 0;
  let pop = 0;
  if (m.shake > 0) {
    m.shake = Math.max(0, m.shake - dt / 1.1);
    const k = 1 - m.shake;
    m.wound = Math.min(1, m.wound + dt * 1.6);
    env = bump(k) * standing;
    pop = bump((k - 0.55) / 0.35) * standing;
  }
  const run = 1 - m.wound;
  const sag = run * run * standing * (1 - env);

  // Slumped forward, head and arms dropping as it runs down.
  p.torsoX += sag * 0.24;
  p.headX += sag * 0.32;
  p.armL -= sag * 0.12;
  p.armR -= sag * 0.12;
  p.armLz += sag * 0.05;
  p.armRz -= sag * 0.05;
  p.squash *= 1 - sag * 0.025;

  // Ticking: a tiny clockwork tremor, gone as the spring runs out.
  const tick = Math.sin(c.time * 31 + m.r * 9) * standing * m.wound * (1 - env);
  p.torsoZ += tick * 0.01;
  p.headY += tick * 0.012;

  // The shake: a hard shiver, the head rattling, arms flicked out, then a
  // hop as it springs back up.
  p.roll += Math.sin(c.time * 47 + m.r * 5) * 0.075 * env;
  p.torsoY += Math.sin(c.time * 37) * 0.12 * env;
  p.headY += Math.sin(c.time * 29 + 1) * 0.22 * env;
  p.armL += env * 0.55 + pop * 0.5;
  p.armR += env * 0.55 + pop * 0.5;
  p.armLz -= env * 0.35;
  p.armRz += env * 0.35;
  p.lift += pop * 0.13 * c.size;
  p.squash *= 1 + pop * 0.04;

  // Looking round at its neighbours: snap to a bearing, hold, snap again.
  m.lookNext -= dt;
  if (m.lookNext <= 0) {
    const side = Math.random() < 0.5 ? -1 : 1;
    m.lookAt = Math.random() < 0.3 ? 0 : side * (0.45 + Math.random() * 0.55);
    m.tilt = (Math.random() - 0.5) * 0.32;
    m.lookNext = 1.1 + Math.random() * 2.6;
  }
  const look = standing * (1 - sag * 1.6) * (1 - env);
  p.headY += m.lookAt * Math.max(0, look);
  return { sag, env, pop, look: Math.max(0, look) };
}

/** The Robots: tin wind-up toys. A jaunty clockwork scurry with little
 *  hops, arms pumping and claws clacking, the head jiggling on its neck
 *  and the springy antenna lagging every move; alternate snapping jabs;
 *  idling, the spring runs down until it shakes itself back up; a hit
 *  makes it shudder and sometimes spins its head right round. */
export const imps: Moves = {
  style: STYLE,
  // Clockwork: a stiff little body rocking over quick feet.
  carriage: {
    twist: 0.08,
    hips: 0.03,
    chestRoll: 0.5,
    nod: 0.05,
    armOut: 0.1,
    bounce: 0.04,
    weaponArm: 1,
  },
  stiff: {
    head: 0.72,
    antenna: 0.3,
    extra: 2.6,
    extra2: 0.8,
    armL: 1.15,
    armR: 1.15,
    foreL: 1.1,
    foreR: 1.1,
    handL: 1.9,
    handR: 1.9,
  },
  damping: {
    head: 0.34,
    antenna: 0.14,
    extra: 0.85,
    extra2: 0.28,
    handL: 0.45,
    handR: 0.45,
  },
  pose(c, p) {
    const m = memo(c);
    const { walk, aim, wind, strike, dt, size } = c;
    const live = idleLife(c, m, p);

    // ---- the walk: a jaunty rock and little hops, arms pumping.
    const hop = Math.pow(Math.abs(Math.sin(TAU * (c.cycle - 0.05))), 1.5);
    p.lift += hop * 0.028 * size * walk;
    p.roll += Math.sin(TAU * (c.cycle - 0.12)) * 0.035 * walk;
    let foreL = walk * (0.15 + Math.max(0, c.swingL) * 1.1);
    let foreR = walk * (0.15 + Math.max(0, c.swingR) * 1.1);
    foreL -= Math.min(0, c.swingL) * 0.25 * walk;
    foreR -= Math.min(0, c.swingR) * 0.25 * walk;
    // Claws clack open and shut with the steps.
    let handL = -walk * (0.16 + 0.16 * Math.sin(TAU * c.cycle * 2));
    let handR = -walk * (0.16 + 0.16 * Math.sin(TAU * c.cycle * 2 + 1.6));
    foreL -= live.sag * 0.3;
    foreR -= live.sag * 0.3;

    // ---- the jab: claws up, one arm cocked back with the claw gaping,
    // then thrust straight out and snapped shut, the body twisting
    // behind it and hopping in; the other arm pulls back.
    const nextR = (c.hits + 1) % 2 === 0;
    const lastR = c.hits % 2 === 0;
    const g = aim * (0.72 + m.r * 0.12);
    p.armL += g;
    p.armR += g;
    foreL += aim * 0.95;
    foreR += aim * 0.95;
    handL -= aim * 0.22;
    handR -= aim * 0.22;
    p.torsoX += aim * 0.05;
    p.headX += aim * 0.06;
    // Wind-up, on the arm about to strike.
    const ws = nextR ? 1 : -1;
    if (nextR) {
      p.armR -= wind * 0.6;
      foreR += wind * 0.55;
      handR -= wind * 0.6;
      p.armL += wind * 0.15;
    } else {
      p.armL -= wind * 0.6;
      foreL += wind * 0.55;
      handL -= wind * 0.6;
      p.armR += wind * 0.15;
    }
    p.torsoY -= TWIST * ws * wind * 0.32;
    p.lean -= wind * 0.05;
    p.squash *= 1 - wind * 0.05;
    // The strike, on the arm that just hit.
    const ss = lastR ? 1 : -1;
    if (lastR) {
      p.armR += strike * 0.62;
      foreR -= strike * 1.55;
      handR += strike * 0.36;
      p.armL -= strike * 0.3;
      foreL += strike * 0.25;
    } else {
      p.armL += strike * 0.62;
      foreL -= strike * 1.55;
      handL += strike * 0.36;
      p.armR -= strike * 0.3;
      foreR += strike * 0.25;
    }
    const twist = TWIST * (ss * strike * 0.42 - ws * wind * 0.32);
    p.torsoY += TWIST * ss * strike * 0.42;
    // Eyes stay on the target while the shoulders turn.
    p.headY -= twist * 0.6;
    p.roll += ss * strike * 0.07;
    p.lean += strike * 0.09;
    p.lunge += strike * STYLE.lunge;
    p.lift += strike * 0.045 * size;
    // A braced stance while it fights: one foot forward.
    const fw = m.r < 0.5 ? 1 : -1;
    const stance = aim * (1 - walk);
    if (stance > 0.01) {
      const a = 0.2 * stance * fw;
      c.want('legL', a, 0, -0.04 * stance);
      c.want('footL', -a);
      c.want('legR', -a * 0.7, 0, 0.04 * stance);
      c.want('footR', a * 0.7);
    }

    // ---- a hit: shudder, lids slammed, sometimes the head spins round.
    if (c.flinch > m.fl + 0.3) {
      m.kick = (Math.random() - 0.5) * 2;
      if (
        m.spinT < 0 &&
        c.time - m.lastSpin > 2.5 &&
        Math.random() < 0.35 &&
        c.deploy >= 1
      ) {
        m.spinT = 0;
        m.lastSpin = c.time;
        m.spinDir = Math.random() < 0.5 ? -1 : 1;
      }
    }
    m.fl = c.flinch;
    const f = c.flinch;
    p.roll += Math.sin(c.time * 53) * 0.08 * f;
    p.torsoY += Math.sin(c.time * 41 + 1) * 0.12 * f;
    p.armL += f * 0.35;
    p.armR += f * 0.35;
    p.armLz -= f * 0.25;
    p.armRz += f * 0.25;
    handL -= f * 0.5;
    handR -= f * 0.5;
    let spin = 0;
    if (m.spinT >= 0) {
      m.spinT += dt / 0.6;
      const k = Math.min(1, m.spinT);
      spin = (1 - Math.pow(1 - k, 3)) * TAU * m.spinDir;
      if (m.spinT >= 1) {
        m.turns += TAU * m.spinDir;
        m.turns %= TAU * 4;
        m.spinT = -1;
        spin = 0;
      }
    }

    // ---- deploying: tossed in arms flailing and legs apart, then a
    // clattering landing (see `arrive`).
    const d = c.deploy;
    if (d < 1) {
      const air = d < 0.26 ? 1 : clamp01(1 - (d - 0.26) / 0.08);
      const rattle = d >= 0.26 ? bump((d - 0.26) / 0.4) : 0;
      const flail = Math.sin(c.time * 17 + m.r * 6);
      p.armL += air * (2.1 + flail * 0.45);
      p.armR += air * (2.1 - flail * 0.45);
      p.armLz -= air * 0.4;
      p.armRz += air * 0.4;
      foreL += air * 0.4;
      foreR += air * 0.4;
      handL -= air * 0.7;
      handR -= air * 0.7;
      p.yawKick += air * (m.r - 0.5) * 1.2;
      c.want('legL', 0.35 * air, 0, -0.08 * air);
      c.want('legR', -0.3 * air, 0, 0.08 * air);
      c.want('kneeL', -0.35 * air);
      c.want('kneeR', -0.2 * air);
      p.roll += Math.sin(c.time * 50 + m.r * 4) * 0.06 * rattle;
      p.torsoY += Math.sin(c.time * 43) * 0.08 * rattle;
      p.armL += Math.sin(c.time * 39) * 0.25 * rattle;
      p.armR -= Math.sin(c.time * 39) * 0.25 * rattle;
    }

    c.want('foreL', foreL);
    c.want('foreR', foreR);
    c.want('handL', Math.max(-1, Math.min(0.12, handL)));
    c.want('handR', Math.max(-1, Math.min(0.12, handR)));

    // ---- the head on its neck: it jiggles with every hop and landing,
    // a little behind the body's rock.
    const jig = clamp(-c.vertical * 0.0045, 0.12);
    const headX = p.headX + jig + live.pop * -0.15;
    const headZ =
      -(p.roll + p.torsoZ) * 0.35 * walk +
      m.tilt * live.look +
      Math.sin(TAU * (c.cycle - 0.3)) * 0.06 * walk;
    const headDy = clamp(-c.vertical * 0.00035, 0.008);
    c.want('head', -headX, p.headY + m.turns + spin, headZ, headDy);

    // ---- the antenna: springy, lagging the head's swings and the body's
    // starts, stops, hops and turns, whipping on every jab.
    const pitch = p.lean + p.torsoX + headX;
    const roll = p.roll + p.torsoZ + headZ;
    if (dt > 0) {
      const a = Math.min(1, dt * 18);
      m.pv += ((pitch - m.pp) / dt - m.pv) * a;
      m.rv += ((roll - m.rp) / dt - m.rv) * a;
    }
    m.pp = pitch;
    m.rp = roll;
    c.want(
      'antenna',
      clamp(
        m.pv * 0.07 +
          c.accel * 0.025 -
          c.vertical * 0.005 +
          strike * 0.35 -
          wind * 0.12 -
          f * 0.45,
        0.8,
      ),
      0,
      clamp(
        -m.rv * 0.07 +
          c.lateral * 0.025 -
          c.turn * 0.04 +
          m.kick * f * 0.35 +
          live.env * Math.sin(c.time * 23) * 0.3,
        0.8,
      ),
    );

    // ---- the eyes: blinking, squinting at a target, drooping as it runs
    // down, slammed shut when hit, wide as it springs back.
    m.blinkNext -= dt;
    if (m.blinkNext <= 0) {
      m.blink = 1e-4;
      m.blinkNext = Math.random() < 0.22 ? 0.3 : 1.6 + Math.random() * 3.6;
    }
    let blink = 0;
    if (m.blink > 0) {
      m.blink += dt / 0.2;
      blink = bump(m.blink);
      if (m.blink >= 1) m.blink = 0;
    }
    const aloft = d < 0.3 ? 1 : 0;
    c.want(
      'extra',
      Math.max(
        SHUT,
        SHUT * (blink + f * 0.8) -
          live.sag * 0.95 -
          aim * 0.28 -
          strike * 0.15 +
          (live.env + aloft) * 0.3,
      ),
    );

    // ---- the key whirs (faster on the move and fighting, slowing as the
    // spring runs down, racing as it is wound back).
    m.key +=
      dt *
      ((2.4 + walk * 7 + aim * 3 + strike * 12) * (1 - 0.85 * live.sag) +
        live.env * 26);
    c.want('spin', 0, 0, -m.key);

    // ---- the gauge reads the spring: full on the move, falling as it
    // runs down, flicking when hit.
    const reading =
      -1 +
      2 * m.wound +
      Math.sin(c.time * 19 + m.r * 7) * 0.06 * (walk + aim) +
      m.kick * f * 0.8 +
      strike * 0.25;
    c.want('extra2', 0, 0, -clamp(reading, 1.1) * 1.15);
  },
  // Tossed onto the field tumbling, it lands with a crash and clatters:
  // a big bounce, two rattling hops and a last tick, the body twisting
  // back and forth as it settles.
  arrive(d) {
    const fall = clamp01(d / 0.26);
    if (d < 0.26)
      return {
        drop: (1 - fall * fall) * 3.4,
        squash: 1.05,
        twirl: (1 - fall) * (1 - fall) * 3.4,
      };
    let drop = 0;
    let squash = 1;
    for (const [t0, len, h, sq] of CLATTER) {
      drop += bump((d - t0) / len) * h;
      squash -= bump((d - t0) / 0.07) * sq;
    }
    const s = d - 0.26;
    const twirl = Math.sin(s * 38) * 0.28 * Math.max(0, 1 - s / 0.4);
    return { drop, squash, twirl };
  },
};
