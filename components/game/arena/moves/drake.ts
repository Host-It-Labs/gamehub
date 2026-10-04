import type { MoveContext, Moves } from './types';

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const clamp01 = (t: number) => clamp(t, 0, 1);
const smooth = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
/** 0 at `a`, up to 1 halfway and back to 0 at `b` (either order). */
const bump = (t: number, a: number, b: number) =>
  Math.sin(Math.PI * clamp01((t - a) / (b - a)));
/** Advance a phase kept in memo at `rate` radians a second (wrapped). */
function phase(c: MoveContext, key: string, rate: number, seed = 0) {
  const m = c.memo;
  m[key] =
    ((m[key] ?? ((c.unit.id * 0.618 + seed) % 1) * TAU) + c.dt * rate) % TAU;
  return m[key];
}

/** Bomb run timing (seconds), against the engine's 1.5 s between hits:
 *  a little climb, the dive, the drop on the hit, the pull-up after. */
const RISE = 0.8;
const DIVE = 0.5;
const PULL = 0.7;
const DIVE_DEPTH = 0.5;

/** The idle fidgets, each `FIDGET` seconds long. */
const FIDGET = 1.8;

/**
 * The Biplane: a tin biplane flown by a cartoon ace. It bobs and rocks on
 * the air, banks into its turns with the ailerons, rudder and elevators
 * working, the pilot leaning in and looking where he goes, his scarf
 * streaming and swinging out of the turns. For each bomb it climbs a
 * touch, noses over into a dive with the pilot peering down over the
 * side, lets the bomb go at the bottom and pulls up hard, rolling out
 * of it while he punches the air or gives a thumbs-up; the next bomb is
 * lowered from the belly. It swoops in from behind to deploy with the
 * engine spinning up, lurches and wobbles when hit, and while it waits
 * the pilot looks around, peers over the side or waves.
 */
export const drake: Moves = {
  style: {
    attack: 'bomb',
    windup: 0.35,
    lunge: 0,
    snap: 10,
  },
  stiff: {
    // The pilot lags the plane a little; his arms are quick to cheer.
    neck: 0.8,
    head: 0.7,
    armL: 1.2,
    armR: 1.4,
    foreL: 1.3,
    foreR: 1.5,
    // Control surfaces are quick; the scarf lively.
    wingL: 1.8,
    wingR: 1.8,
    tail: 1.6,
    extra: 1.4,
    cape: 1.1,
    torso: 2.2,
    // Driven directly.
    weapon: 0,
    wheels: 0,
  },
  damping: {
    cape: 0.32,
    neck: 0.5,
    head: 0.55,
    armR: 0.5,
    torso: 0.35,
  },
  pose(c, p) {
    const m = c.memo;
    const { dt, aim, walk, idle } = c;
    const flying = c.deploy >= 1 ? 1 : 0;

    // ---- Being hit: a lurch, then a wobble that settles (seconds since
    // the hit, kept per plane).
    if (m.hitAge === undefined) m.hitAge = 9;
    if (c.flinch > (m.flinch ?? 0) + 0.25) {
      m.hitAge = 0;
      m.hitSide = Math.random() < 0.5 ? -1 : 1;
    }
    m.flinch = c.flinch;
    m.hitAge += dt;
    const hitK = Math.exp(-m.hitAge * 2.6);
    const wobble = m.hitAge < 3 ? hitK * Math.sin(m.hitAge * 11) : 0;
    const jolt = m.hitAge < 3 ? Math.exp(-m.hitAge * 7) : 0;
    // The drop in height eases in (the height is not sprung).
    const lurch =
      m.hitAge < 3
        ? (1 - Math.exp(-m.hitAge * 22)) * Math.exp(-m.hitAge * 4.5)
        : 0;
    const hitSide = m.hitSide ?? 1;

    // ---- The bomb run.
    const since = c.since;
    const toHit = c.toHit;
    const post = since < PULL;
    let height = 0;
    let nose = 0;
    let dive = 0;
    if (post) {
      // Pulled up out of the dive, climbing past level and settling.
      height =
        -DIVE_DEPTH * (1 - smooth(since / 0.42)) +
        0.12 * bump(since, 0.2, PULL);
      nose = 0.38 * (1 - smooth(since / 0.1)) - 0.42 * bump(since, 0, 0.62);
      dive = 1 - smooth(since / 0.3);
    } else {
      // A little climb, then over into the dive.
      height =
        0.11 * bump(toHit, RISE, DIVE) - DIVE_DEPTH * smooth(1 - toHit / DIVE);
      nose =
        -0.14 * bump(toHit, RISE, DIVE) + 0.42 * smooth((DIVE - toHit) / 0.22);
      dive = smooth(1 - toHit / DIVE);
    }
    // Which way it rolls out of the pull-up, and what the pilot does about
    // the hit, alternate.
    const odd = c.hits % 2 === 1;
    const rollOut = (odd ? -1 : 1) * 0.22 * bump(since, 0.05, PULL + 0.2);
    // The bomb: gone into the belly when it drops, lowered again to
    // reload before the next.
    const stowed =
      aim > 0.3 && since < 1.1 ? 1 - smooth((since - 0.75) / 0.3) : 0;
    c.want('weapon', 0, 0, 0, 0.115 * stowed);

    // ---- Deploying: it swoops in from behind and above, banked, nose
    // down, levels out low and climbs back to its height (`arrive` has
    // the height); the engine spins up.
    const d = c.deploy;
    const e = 1 - d;
    const swoop = d < 1 ? e : 0;
    p.lunge -= swoop * swoop * 2.4;
    p.lean +=
      swoop > 0 ? 0.42 * (1 - smooth(d / 0.55)) - 0.3 * bump(d, 0.45, 1) : 0;
    p.roll += swoop > 0 ? 0.85 * e * e * e - 0.18 * bump(d, 0.55, 1) : 0;

    // ---- Flight: bob and rock on the air, faster under way (phases kept
    // in memo, so a changing rate never jumps).
    const bob = phase(c, 'bob', 2.0 + 0.6 * walk, 0.1);
    const rock = phase(c, 'rock', 1.25, 0.37);
    const drift = phase(c, 'drift', 0.55, 0.73);
    p.lift +=
      Math.sin(bob) * (0.12 + 0.04 * walk) +
      Math.sin(drift) * 0.07 +
      aim * height -
      0.5 * lurch;
    p.lean +=
      Math.cos(bob) * 0.035 + walk * 0.06 + aim * nose - jolt * 0.12 * flying;
    // Bank into turns (the turn is + to the left, and so is the roll).
    const bank = clamp(c.turn * 0.45 + c.lateral * -0.02, -0.75, 0.75);
    p.roll +=
      bank +
      Math.sin(rock) * (0.05 + 0.07 * idle) +
      aim * rollOut +
      0.32 * wobble * hitSide;
    // Waiting about, it noses lazily from side to side.
    p.yawKick += Math.sin(drift + 1) * 0.12 * idle + 0.16 * wobble * hitSide;
    // A little forward into the dive.
    p.lunge += aim * dive * 0.22;

    // The airframe shudders on a hit and buzzes a touch with the engine.
    const buzz = Math.sin(phase(c, 'buzz', 47)) * 0.004;
    c.want(
      'torso',
      0.1 * wobble - 0.08 * jolt + buzz,
      -0.08 * wobble * hitSide,
      0.18 * wobble * hitSide + buzz,
    );

    // ---- Propeller and wheels. The engine winds up as it deploys and
    // roars in the dive.
    const revs = d < 1 ? 0.25 + 0.75 * smooth(d / 0.7) : 1;
    c.want(
      'spin',
      0,
      0,
      -phase(c, 'prop', 52 * revs * (1 + 0.35 * aim * dive)),
    );
    // The wheels are still turning from take-off: fast as it arrives,
    // easing to a lazy freewheel.
    m.wheelRate =
      (m.wheelRate ?? 14) +
      (2.2 + 2 * walk - (m.wheelRate ?? 14)) * Math.min(1, dt * 0.6);
    c.want('wheels', -phase(c, 'wheel', m.wheelRate));

    // ---- Control surfaces, following what the plane is asked to do: the
    // ailerons lead the roll, the elevators the pitch, the rudder the turn.
    const rollGoal = p.roll;
    const pitchGoal = p.lean;
    m.rollLag =
      (m.rollLag ?? 0) + (rollGoal - (m.rollLag ?? 0)) * Math.min(1, dt * 5);
    m.pitchLag =
      (m.pitchLag ?? 0) + (pitchGoal - (m.pitchLag ?? 0)) * Math.min(1, dt * 5);
    const ail = clamp(
      (rollGoal - m.rollLag) * 2.2 + rollGoal * 0.35,
      -0.55,
      0.55,
    );
    // Banking left: the left aileron's trailing edge up, the right down.
    c.want('wingL', -ail + 0.25 * wobble);
    c.want('wingR', ail - 0.25 * wobble);
    const elev = clamp(
      (pitchGoal - m.pitchLag) * 1.8 + pitchGoal * 0.5,
      -0.5,
      0.5,
    );
    c.want('tail', elev + 0.2 * wobble);
    const rud = clamp(
      -c.turn * 0.35 - Math.sin(drift + 1) * 0.15 * idle,
      -0.45,
      0.45,
    );
    c.want('extra', 0, rud + 0.3 * wobble * hitSide, 0);

    // ---- The pilot.
    // Idle fidgets: after a few seconds stood waiting, now and then he
    // peers over one side, waves, or looks back over his shoulder.
    if (c.idleFor <= 0) {
      m.nextFidget = 2.2 + Math.random() * 1.5;
      m.fidgetAt = -9;
    } else if (c.idleFor > (m.nextFidget ?? 2.5)) {
      m.fidgetAt = c.idleFor;
      m.fidgetKind = ((m.fidgetKind ?? -1) + 1) % 3;
      m.fidgetSide = Math.random() < 0.5 ? -1 : 1;
      m.nextFidget = c.idleFor + FIDGET + 2.5 + Math.random() * 2;
    }
    const fAge = c.idleFor - (m.fidgetAt ?? -9);
    const fid = fAge < FIDGET ? Math.sin(Math.PI * clamp01(fAge / FIDGET)) : 0;
    const fSide = m.fidgetSide ?? 1;
    const peer = m.fidgetKind === 0 ? fid : 0;
    const wave = m.fidgetKind === 1 ? fid : 0;
    const back = m.fidgetKind === 2 ? fid : 0;

    // His body leans into the bank (further than the plane), forward into
    // the dive and is pressed back in the pull-up; ducks on a hit.
    const lookSide = odd ? -1 : 1;
    const g = aim * (post ? bump(since, 0, 0.55) : 0);
    const peerAttack =
      aim * (post ? 1 - smooth((since - 0.15) / 0.3) : smooth(1 - toHit / 0.9));
    c.want(
      'neck',
      -0.22 * aim * dive + 0.2 * g - 0.2 * peer + 0.25 * jolt,
      0.25 * back * fSide,
      bank * 0.5 +
        Math.sin(rock + 0.6) * 0.04 +
        0.3 * peer * fSide +
        0.22 * peerAttack * lookSide -
        0.2 * wobble * hitSide,
    );
    // His head looks into turns, about while waiting, down over the side
    // at the target (and after the falling bomb), stays fairly level as the
    // plane rolls; thrown back by a hit.
    const look = Math.sin(drift + 0.4) * 0.5 + Math.sin(rock * 2 + 0.3) * 0.12;
    c.want(
      'head',
      // + tips the head back.
      -0.45 * peerAttack - 0.35 * peer + 0.45 * jolt + 0.05 * Math.sin(bob + 1),
      c.turn * 0.25 +
        look * idle * (1 - fid) +
        0.55 * peerAttack * lookSide +
        0.4 * peer * fSide +
        1.1 * back * fSide,
      -bank * 0.35 + 0.15 * peer * fSide,
    );

    // Arms: hands on the rim. After the drop he punches the air (odd
    // hits) or gives a thumbs-up out to the side (even); waves while
    // waiting; flung up by a hit.
    const cheer = aim * (post || since < 1.2 ? bump(since, 0.18, 1.15) : 0);
    const punch = odd ? cheer : 0;
    const thumbs = odd ? 0 : cheer;
    const shake = Math.sin(phase(c, 'shake', 17)) * 0.18 * punch;
    // Right arm: the fist straight up overhead, pumping; or out to the
    // side, the forearm up, thumb up.
    c.want(
      'armR',
      2.3 * punch + 1.5 * thumbs + 0.25 * jolt + shake,
      -0.4 * thumbs,
      -0.1 * punch + 0.7 * thumbs + 0.2 * jolt,
    );
    c.want(
      'foreR',
      -1.0 * punch - 0.75 * thumbs - shake * 0.8,
      -0.5 * punch,
      0,
    );
    // Left arm: grips the rim; waves while waiting, the forearm up and
    // swinging from side to side.
    const waveSwing = Math.sin(phase(c, 'wave', 9)) * 0.42 * wave;
    c.want(
      'armL',
      2.1 * wave + 0.25 * jolt,
      0.2 * wave,
      -0.5 * wave - 0.2 * jolt,
    );
    c.want('foreL', -0.75 * wave, 0, waveSwing);

    // ---- The scarf: streams behind, flutters, swings out of turns,
    // droops as the plane climbs and flicks up as it dives.
    const flap = phase(c, 'flap', 9.5, 0.21);
    const flip = phase(c, 'flip', 6.1, 0.55);
    c.want(
      'cape',
      clamp(
        Math.sin(flap) * 0.07 +
          c.vertical * 0.015 -
          aim * nose * 0.25 -
          0.08 * walk +
          0.2 * jolt,
        -0.35,
        0.12,
      ),
      Math.sin(flip) * 0.3,
      clamp(c.turn * 0.35 - bank * 0.3 + Math.sin(flip + 2) * 0.08, -0.5, 0.5),
    );
  },
  arrive(d) {
    // Down from high above in a long swoop, through its flying height and
    // back up to it (the swoop's run in from behind, bank and nose are in
    // the pose).
    const k = smooth(d / 0.8);
    const dip = bump(d, 0.55, 1) * 0.35;
    return {
      drop: (1 - k) * (1 - k) * 3.2 - dip,
      squash: 1,
      twirl: (1 - k) * (1 - k) * 0.7,
    };
  },
};
