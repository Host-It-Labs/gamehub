import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves } from './types';

// Staged only. One clockwork asset is instantiated at all three formation seats.
const TAU = Math.PI * 2;
const clamp = (x: number, cap: number) => Math.max(-cap, Math.min(cap, x));
const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const bump = (x: number) => x > 0 && x < 1 ? Math.sin(x * Math.PI) : 0;
const pulse = (x: number, start: number, peak: number, end: number) =>
  ease((x - start) / (peak - start)) * (1 - ease((x - peak) / (end - peak)));
const HAND: HandRest = { palm: [1, 0, 0], fingers: [-0.03933, -0.88910, -0.45635] };
const REST: ArmGoal = {
  hand: [-0.020, -0.225, -0.068], pole: [-0.015, -0.112, -0.010],
  palm: [1, 0, 0], fingers: [-0.03933, -0.88910, -0.45635],
};
const GUARD: ArmGoal = {
  hand: [-0.035, -0.061, -0.147], pole: [-0.35, -1, 0.35],
  palm: [1, 0, -0.15], fingers: [0, -0.20, -0.98],
};
const CHAMBER: ArmGoal = {
  hand: [-0.055, -0.065, -0.080], pole: [-0.6, -0.55, 0.35],
  palm: [1, 0, 0], fingers: [0, -0.10, -1],
};
const HIT: ArmGoal = {
  hand: [-0.028, -0.024, -0.224], pole: [-0.45, -1, 0.18],
  palm: [1, 0, 0], fingers: [0, -0.10, -1],
};
const FOLLOW: ArmGoal = {
  hand: [-0.026, -0.055, -0.216], pole: [-0.4, -1, 0.18],
  palm: [1, 0, 0.08], fingers: [0, -0.14, -1],
};
const COUNTER: ArmGoal = {
  hand: [-0.036, -0.091, -0.101], pole: [-0.6, -1, 0.3],
  palm: [1, 0, 0], fingers: [0, -0.28, -0.96],
};

function life(c: MoveContext) {
  const m = c.memo;
  if (m.robotSeed === undefined) {
    // A reproducible per-unit offset; no global shared state or random
    // changes when the root pauses a frame for source/runtime comparisons.
    m.robotSeed = ((c.unit.id * 73 + 19) % 997) / 997;
    m.robotWound = 0.82 + m.robotSeed * 0.18;
    m.robotRewind = 0; m.robotKey = m.robotSeed * TAU;
  }
  if (!c.reduced && c.deploy >= 1) {
    if (c.idleFor > 0.8 && m.robotRewind <= 0)
      m.robotWound = Math.max(0, m.robotWound - c.dt / (8 + m.robotSeed * 5));
    else if (c.idleFor <= 0) m.robotWound = Math.min(1, m.robotWound + c.dt * 1.5);
    if (m.robotWound < 0.10 && m.robotRewind <= 0) m.robotRewind = 1;
    if (m.robotRewind > 0) {
      m.robotRewind = Math.max(0, m.robotRewind - c.dt / 0.85);
      m.robotWound = Math.min(1, m.robotWound + c.dt * 1.5);
    }
  }
  const optional = c.reduced ? 0 : 1;
  const rewind = bump(1 - m.robotRewind) * c.idle * optional;
  const sag = (1 - m.robotWound) ** 2 * c.idle * optional * (1 - rewind);
  return { m, optional, rewind, sag };
}

function strikeGoal(since: number): ArmGoal {
  if (since < 0.055) return blend(CHAMBER, HIT, ease(since / 0.055));
  if (since < 0.145) return blend(HIT, FOLLOW, ease((since - 0.055) / 0.09));
  return blend(FOLLOW, GUARD, ease((since - 0.145) / 0.30));
}

export const imps: Moves = {
  style: {
    // Retain the existing clockwork leg routine and its small-step timing.
    gait: 'clockwork', stride: 0.2, legSwing: 0.6,
    armSwing: 0.46, bob: 0.06, sway: 0.16, lean: 0.05,
    attack: 'custom', windup: 0.3, lunge: 0.17, snap: 42,
  },
  carriage: { twist: 0.08, hips: 0.03, chestRoll: 0.5, nod: 0.05, armOut: 0, bounce: 0.04, weaponArm: 1 },
  stiff: {
    head: 0.75, antenna: 0.3, extra: 2.0, extra2: 0.85,
    armL: 1.1, armR: 1.1, foreL: 1.1, foreR: 1.1,
    handL: 1.1, handR: 1.1, offhand: 1.9, weapon: 1.9,
  },
  damping: {
    head: 0.5, antenna: 0.25, extra: 0.8, extra2: 0.45,
    armL: 0.78, armR: 0.78, foreL: 0.78, foreR: 0.78,
    handL: 0.78, handR: 0.78, offhand: 0.6, weapon: 0.6,
  },
  pose(c, p) {
    const { m, optional, rewind, sag } = life(c);
    const a = ease(c.aim);
    const wind = ease(c.wind) * a;
    const next = (c.hits + 1) % 2 === 0 ? 'R' : 'L';
    const last = c.hits % 2 === 0 ? 'R' : 'L';
    const activeHit = c.since >= 0 && c.since < 0.445 ? a : 0;
    const loaded = a * (c.since >= 0 && c.since < 0.13 ? 1 - ease(c.since / 0.13) : ease(c.wind));
    const impact = pulse(c.since, 0, 0.055, 0.31) * a;
    const fireSide = last === 'R' ? 1 : -1;
    const loading = c.since >= 0 && c.since < 0.13 ? last : next;
    const loadSide = loading === 'R' ? 1 : -1;
    const flinch = c.flinch;
    const idle = c.idle * optional;
    const ready = ease((c.idleFor - 1.0) / 0.6) * idle;
    const look = pulse((c.idleFor + m.robotSeed * 7) % 8.6, 2, 2.2, 3.5) * ready;
    const tick = Math.sin(c.time * 31 + m.robotSeed * 8) * idle * (1 - sag);
    const hop = Math.abs(Math.sin(TAU * (c.cycle - 0.05))) ** 1.5;
    const walkLean = (0.05 + (1 - c.pass) * 0.03) * c.walk;
    const step = Math.cos(c.cycle * TAU);
    const weight = Math.cos((c.cycle - 0.30) * TAU);
    p.lift += hop * 0.022 * c.size * c.walk;
    p.lift += bump((1 - m.robotRewind - 0.43) / 0.4) * 0.07 * c.size * idle;
    p.lunge = impact * 0.17;
    p.lean = 0.05 * c.walk * 0.35 + impact * 0.07 - loaded * 0.035;
    p.squash *= 1 - loaded * 0.025 - impact * 0.025;
    // Retain the clockwork carriage over the unchanged walkingLeg routine,
    // and replace the shared organic idle with deliberate machine ticks.
    p.torsoX = walkLean + sag * 0.14 + tick * 0.008;
    p.torsoY = step * (0.08 + 0.03) * c.walk + fireSide * impact * 0.25 - loadSide * loaded * 0.20;
    p.torsoZ = weight * 0.16 * 0.5 * c.walk + Math.sin(TAU * c.cycle) * 0.025 * c.walk + tick * 0.004;
    p.roll = weight * 0.16 * c.walk + Math.sin(TAU * (c.cycle - 0.12)) * 0.035 * c.walk + fireSide * impact * 0.035;
    p.headY = look * (m.robotSeed < 0.5 ? -0.5 : 0.5) - p.torsoY * 0.6;
    p.headX = -walkLean * 0.6 + Math.cos((c.cycle - 0.14) * TAU * 2) * 0.05 * c.walk
      + sag * 0.14 + loaded * 0.04 - impact * 0.05;
    p.armL = p.armR = p.armLz = p.armRz = 0;

    for (const side of ['L', 'R'] as const) {
      const phase = TAU * (c.cycle + (side === 'R' ? 0.5 : 0));
      const wrist = [...REST.hand] as [number, number, number];
      wrist[1] += (1 - Math.cos(phase)) * 0.017 * c.walk - sag * 0.006;
      wrist[2] += Math.sin(phase) * 0.058 * c.walk;
      // Swing in a small arc so the wrist never asks for a straight-chain
      // extension that the forward elbow hinge cannot actually reach.
      const elbow = c.rest(`fore${side}`), hand = c.rest(`hand${side}`);
      if (elbow && hand) {
        const A = Math.hypot(...elbow), B = Math.hypot(...hand);
        const safe = (A + B) * 0.96;
        const length = Math.hypot(...wrist);
        if (length > safe && c.walk > 0) for (let k = 0; k < 3; k++) wrist[k] *= safe / length;
      }
      let goal = blend({ ...REST, hand: wrist }, GUARD, a);
      if (next === side) goal = blend(goal, CHAMBER, wind);
      if (activeHit > 0) goal = blend(goal, side === last ? strikeGoal(c.since)
        : blend(GUARD, COUNTER, pulse(c.since, 0, 0.09, 0.445)), activeHit);
      if (rewind > 0) goal = blend(goal, GUARD, rewind * 0.7);
      if (flinch > 0) goal = blend(goal, GUARD, flinch * 0.45);
      const air = c.deploy < 0.26 ? 1 : 1 - ease((c.deploy - 0.26) / 0.12);
      if (air > 0) goal = blend(goal, { hand: [-0.062, 0.065, -0.127], pole: [-1, 0.1, 0.25],
        palm: [1, 0, -0.2], fingers: [0, 0.6, -0.8] }, air);
      reach(c, side, goal, HAND);
      // These are true jaw hinges under each solved wrist. The wrist itself
      // never serves as a claw-opening control.
      const opening = loaded * (loading === side ? 0.45 : 0.14) + c.walk * 0.13 + flinch * 0.22 + rewind * 0.20;
      const closing = activeHit * (side === last ? ease(c.since / 0.055) * (1 - ease((c.since - 0.20) / 0.22)) : 0);
      c.want(side === 'L' ? 'offhand' : 'weapon', -Math.max(0, opening * (1 - closing)));
    }

    // Minimal body response under reduced motion; the optional high-frequency
    // rattle is reserved for the full motion setting.
    p.torsoX -= flinch * 0.055;
    p.headX -= flinch * 0.07;
    p.roll += optional * Math.sin(c.time * 43) * flinch * 0.035;
    c.want('torso', -p.torsoX, p.torsoY, p.torsoZ);
    c.want('head', -p.headX + clamp(-c.vertical * 0.003, 0.05), p.headY,
      -p.torsoZ * 0.25 * c.walk + optional * rewind * Math.sin(c.time * 25) * 0.04);
    c.want('antenna', clamp(optional * (c.accel * 0.016 - c.vertical * 0.003) + impact * 0.18 - loaded * 0.07 - flinch * 0.16, 0.30),
      0, clamp(optional * (-c.lateral * 0.018 - c.turn * 0.025 + rewind * Math.sin(c.time * 24) * 0.15), 0.30));
    c.want('extra', -a * 0.16 - flinch * 0.40 - sag * 0.25);
    c.want('extra2', -0.0, 0, -(1 - 2 * m.robotWound) * optional * 0.8 - impact * 0.15);
    const whirr = c.walk * 9 + a * 4 + impact * 9 + idle * (1.5 - sag) + rewind * 16;
    m.robotKey += Math.max(0, c.dt) * whirr;
    // Spin is written directly by the runtime and therefore may accumulate.
    c.want('spin', 0, 0, -m.robotKey);
  },
  arrive(d) {
    if (d < 0.26) return { drop: (1 - ease(d / 0.26)) * 3.4, squash: 1.02, twirl: (1 - ease(d / 0.26)) * 1.6 };
    return {
      drop: bump((d - 0.26) / 0.18) * 0.36 + bump((d - 0.44) / 0.10) * 0.10 + bump((d - 0.54) / 0.07) * 0.025,
      squash: 1 - bump((d - 0.26) / 0.07) * 0.10 - bump((d - 0.44) / 0.045) * 0.035,
      twirl: Math.sin((d - 0.26) * 30) * 0.13 * (1 - ease((d - 0.26) / 0.40)),
    };
  },
};
