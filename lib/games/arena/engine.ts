import {
  cards,
  deck,
  isSpell,
  SHIELD_DELAY,
  SHIELD_RECHARGE,
  troopCards,
  type CardId,
  type ProjectileKind,
  type SpellId,
  type TroopId,
  type UnitStats,
} from './cards.ts';

/**
 * Arena's real-time rules: a fixed-step simulation on an 18 by 32 tile field.
 * Side 0 plays from the bottom (small y), side 1 from the top. A duel seats
 * one player a side, a team battle two, each with their own hand and elixir.
 * The state is plain data mutated in place each step; the renderer reads it
 * and drains `events` for sounds and effects. Troop cards put units on the
 * field; a spell card (the Meteor) falls where it is cast and crashes after
 * its delay, hitting everything of the other side in its circle.
 *
 * Online play runs this same simulation on every device in lockstep, so it
 * sticks to arithmetic that gives identical results in every browser: + - * /
 * and square roots, no Math.hypot or trigonometry outside of drawing hints.
 */
export type Side = 0 | 1;
export type Difficulty = 'easy' | 'medium' | 'hard';
/** One player a side, or two. */
export type Mode = 'duel' | 'team';

export const TICK = 1 / 30;
export const ARENA_MATCH_VERSION = 7;
export const WIDTH = 18;
export const LENGTH = 32;
/** The river runs across the middle, from y 15 to 17. */
export const RIVER: [number, number] = [15, 17];
export const MID = 16;
export const BRIDGES = [3.5, 14.5];
export const BRIDGE_HALF = 1;
export const REGULATION = 180;
export const OVERTIME = 60;
/** Seconds of standing still before the first second of battle. */
export const READY = 1;
export const DEPLOY_TIME = 1;
export const START_ELIXIR = 7;
export const MAX_ELIXIR = 10;
export const ELIXIR_SECONDS = 2.8;
/** The last minute of regulation runs double elixir; overtime runs at 2.5×. */
export const DOUBLE_FROM = REGULATION - 60;
/** Team battles bring twice the troops, so towers are sturdier and hit harder. */
export const TEAM_TOWER_HP = 1.7;
export const TEAM_TOWER_DAMAGE = 1.25;

export type TowerKind = 'king' | 'princess';
export type Tower = {
  id: number;
  side: Side;
  kind: TowerKind;
  /** 0 for the left lane, 1 for the right, -1 for the king. */
  lane: -1 | 0 | 1;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  range: number;
  damage: number;
  hitSpeed: number;
  cooldown: number;
  targetId: number | null;
  /** The king sleeps until hit or until one of its towers falls. */
  active: boolean;
  destroyed: boolean;
};

export type UnitState = 'deploying' | 'walking' | 'attacking';
export type Unit = {
  id: number;
  side: Side;
  /** The player who sent it. */
  owner: number;
  card: TroopId;
  x: number;
  y: number;
  /** Position one step earlier, for smooth drawing between steps. */
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  state: UnitState;
  deployLeft: number;
  targetId: number | null;
  /** Seconds until the next hit while attacking. */
  attackTimer: number;
  /** Authoritative long-body heading; old snapshots recover from side. */
  bodyDirection?: [number, number];
  /** Radians, 0 facing +y (towards the bot). */
  facing: number;
  /** Seconds since the last hit landed, for the swing animation. */
  sinceHit: number;
  /** The lane it walks: the side of the field its card was dropped on
   *  (0 left, 1 right, as field x). Shoves, formations and walking round a
   *  tower never change it; only chasing a troop across the middle does. */
  lane: 0 | 1;
  bridge: number;
  /** A clear corner on the route around a building, kept until reached.
   *  Null when walking straight to its current goal. */
  detour: { x: number; y: number; target: number | null } | null;
  /** Damage and speed multipliers from the owner's card level and boosts. */
  power: number;
  pace: number;
  /** Hit points left on a shield (0 without one). */
  shield: number;
  /** The shield's full pool, including the owner's level and boosts. */
  maxShield: number;
  /** Seconds without damage still needed before the shield recharges. */
  shieldDelay: number;
  /** Seconds it is stopped by a stun. */
  stun: number;
  /** Leaping at its target (the Pirate). */
  dash: boolean;
  /** Its next hit lands a leap's bonus. */
  charged: boolean;
  /** Seconds until it may leap again, or until the Medic's next pulse. */
  cooldown: number;
  /** Raging (the Viking below half its hit points). */
  raged: boolean;
  /** Seconds it must still fight `tauntId` (a Sumo's stomp). */
  taunt: number;
  tauntId: number | null;
  /** Seconds it is slowed (an Explorer's frost), and to what share of
   *  its pace; `slowFactor` is 1 when not slowed. */
  slow: number;
  slowFactor: number;
  /** How much faster a Drummer's beat makes it move and strike this step
   *  (1 outside every beat). */
  beat: number;
};

/*
 * What the renderer can read for the newer abilities (1 October 2026):
 * - Armour (Diver): a `hit` event on an armoured troop carries `armour`,
 *   the damage the armour took off (draw sparks).
 * - Taunt (Sumo): a `taunt` event when he lands (`ids` are the troops
 *   turned on him); each taunted unit has `taunt` > 0 and `tauntId`.
 * - Slaps (Sumo) and tackles (Linebacker): a `push` event per troop
 *   knocked back; a tackle also sends a `tackle` event and a `stun` one.
 * - Bees (Beekeeper): a `spawn` event with the new bees' ids each release;
 *   the bees are ordinary flying units of card 'bee'.
 * - Beat (Drummer): a `beat` event every half second with his aura's
 *   radius; every unit inside has `beat` > 1.
 * - Water jet (Firefighter): a `spray` event each blow, from (x, y) along
 *   the jet's axis to (tx, ty), `cos` the cone's half angle.
 * - Frost (Explorer): 'frost' shots, and a `slow` event on each troop hit;
 *   a slowed unit has `slow` > 0 and `slowFactor` < 1.
 */

/**
 * A cast spell on its way down. It lands at (x, y) when `left` runs out,
 * carrying the stats it needs so a snapshot is complete on its own.
 */
export type Spell = {
  id: number;
  side: Side;
  /** The player who cast it. */
  owner: number;
  card: SpellId;
  x: number;
  y: number;
  /** Seconds until it crashes; it falls for `delay` in all. */
  left: number;
  delay: number;
  radius: number;
  damage: number;
  towerDamage: number;
  knockback: number;
  knockMass: number;
};

/** What hit the ground: a shot, or a spell crashing. */
export type ImpactKind = ProjectileKind | SpellId | 'crash';

export type Projectile = {
  id: number;
  side: Side;
  kind: ProjectileKind;
  sourceId: number;
  targetId: number;
  x: number;
  y: number;
  /** Launch point and height, for drawing arcs. */
  sx: number;
  sy: number;
  sz: number;
  tx: number;
  ty: number;
  speed: number;
  damage: number;
  splash: number;
  /** Whether splash also reaches flyers (fire does, cannonballs do not). */
  air: boolean;
  travelled: number;
  distance: number;
  /** Seconds each troop it hits is stunned. */
  stun: number;
  /** How many more enemies it jumps on to, and how far each jump reaches. */
  chain: number;
  chainRange: number;
  /** Seconds the troop it hits is slowed, and to what share of its pace. */
  slow: number;
  slowFactor: number;
};

export type ArenaEvent =
  | {
      type: 'deploy';
      side: Side;
      player: number;
      card: CardId;
      x: number;
      y: number;
    }
  | {
      type: 'hit';
      id: number;
      x: number;
      y: number;
      damage: number;
      /** Damage the Diver's armour took off the hit. */
      armour?: number;
    }
  | { type: 'swing'; id: number }
  | { type: 'shot'; id: number; kind: ProjectileKind }
  | {
      type: 'impact';
      kind: ImpactKind;
      x: number;
      y: number;
      splash: number;
      /** Where a chained zap jumped from. */
      fx?: number;
      fy?: number;
    }
  | {
      type: 'heal';
      id: number;
      x: number;
      y: number;
      radius: number;
      /** Friendly troops whose hit points actually rose on this pulse. */
      ids?: number[];
    }
  | { type: 'leap'; id: number }
  | { type: 'shield'; id: number; x: number; y: number }
  | { type: 'emerge'; id: number; x: number; y: number }
  | { type: 'rage'; id: number }
  | { type: 'stun'; id: number; x: number; y: number }
  | {
      type: 'taunt';
      id: number;
      x: number;
      y: number;
      radius: number;
      ids: number[];
    }
  | { type: 'tackle'; id: number; target: number; x: number; y: number }
  /** A troop knocked back by `from`'s blow (a troop or falling spell). */
  | {
      type: 'push';
      id: number;
      from: number;
      x: number;
      y: number;
      /** The victim's position immediately before the push. */
      fx?: number;
      fy?: number;
    }
  | {
      type: 'spawn';
      id: number;
      card: TroopId;
      ids: number[];
      x: number;
      y: number;
    }
  | { type: 'beat'; id: number; x: number; y: number; radius: number }
  | {
      type: 'spray';
      id: number;
      x: number;
      y: number;
      tx: number;
      ty: number;
      cos: number;
    }
  | { type: 'slow'; id: number; x: number; y: number }
  | {
      type: 'death';
      id: number;
      card: TroopId;
      side: Side;
      x: number;
      y: number;
    }
  | { type: 'tower'; id: number; side: Side; kind: TowerKind }
  | { type: 'king-wakes'; side: Side }
  | { type: 'phase'; phase: Phase };

export type Phase = 'ready' | 'battle' | 'overtime' | 'over';

export type Hand = {
  /** Four cards you can play. */
  cards: CardId[];
  /** The rest of the deck in order; the first is shown as next. */
  queue: CardId[];
};

/**
 * What a player brings beyond the cards (Quest levels and charms, a boss's
 * advantages). Multipliers default to 1; tower fields are read from the
 * first player of each side.
 */
export type Boost = {
  /** Card levels, 1 the base: each level above adds 10% to a troop's hit
   *  points and damage, or to a spell's damage. */
  levels?: Partial<Record<CardId, number>>;
  troopHp?: number;
  troopDamage?: number;
  troopSpeed?: number;
  spellDamage?: number;
  /** Elixir at the start, instead of START_ELIXIR. */
  elixirStart?: number;
  elixirRate?: number;
  towerHp?: number;
  towerDamage?: number;
  /** The king is awake from the start. */
  kingAwake?: boolean;
  /** Elixir each player of the side gains when one of its towers falls. */
  towerElixir?: number;
};

export type Player = {
  side: Side;
  elixir: number;
  hand: Hand;
  /** Elixir spent, for the results. */
  spent: number;
  /** The cards this player brought (4 to 8). */
  deck: CardId[];
  boost: Boost;
};

/** How a match is set up beyond seed, difficulty and mode. */
export type MatchOptions = {
  /** A deck per seat; a missing one is the starting deck. */
  decks?: (CardId[] | undefined)[];
  boosts?: (Boost | undefined)[];
  /** Seconds of regulation time. */
  regulation?: number;
};

export type Match = {
  /** Version 5 and 6 snapshots migrate before replay or their first step. */
  version: 5 | 6 | 7;
  mode: Mode;
  /** Seconds of regulation time; overtime follows. */
  regulation: number;
  rngState: number;
  difficulty: Difficulty;
  tick: number;
  /** Seconds since the battle started (after the ready count). */
  time: number;
  phase: Phase;
  /** Seats alternate sides: a duel is [side 0, side 1], a team battle
   *  [0, 1, 0, 1], so player i plays for side i % 2. */
  players: Player[];
  towers: Tower[];
  units: Unit[];
  /** Spells cast and still falling. */
  spells: Spell[];
  projectiles: Projectile[];
  crowns: [number, number];
  nextId: number;
  winner: Side | 'draw' | null;
  events: ArenaEvent[];
};

function next(m: Match) {
  m.rngState = (Math.imul(m.rngState, 1664525) + 1013904223) >>> 0;
  return m.rngState / 4294967296;
}
export const random = next;

function shuffled(m: Match, list: CardId[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next(m) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Where each side's towers stand. The bot's mirror yours across the river. */
export const towerLayout: {
  kind: TowerKind;
  lane: -1 | 0 | 1;
  x: number;
  y: number;
}[] = [
  { kind: 'king', lane: -1, x: 9, y: 3 },
  { kind: 'princess', lane: 0, x: 3.5, y: 6.5 },
  { kind: 'princess', lane: 1, x: 14.5, y: 6.5 },
];
export const towerStats = {
  king: { hp: 4824, damage: 109, hitSpeed: 1, range: 7, radius: 2 },
  princess: { hp: 3052, damage: 109, hitSpeed: 0.8, range: 7.5, radius: 1.5 },
};

/** Mirror a y coordinate onto the other side of the field. */
export const flipY = (y: number) => LENGTH - y;

/** Distance without Math.hypot, whose last digit differs between browsers. */
export const dist = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy);

/** The largest drawn tower bases, including the king's projecting door.
 *  These rounded squares are solid on every camera; combat radii remain
 *  the circles in towerStats. The renderer must never grow shells beyond
 *  these footprints at 0.9 times the native shell size. */
export const towerFootprint: Record<
  TowerKind,
  { half: number; corner: number }
> = {
  king: { half: 1.8, corner: 0.18 },
  princess: { half: 1.314, corner: 0.18 },
};

/** A drawn troop's body and normal stride, at the largest portrait scale.
 *  Weapons can reach beyond the body; the Dino also has an oriented hull. This
 *  clearance only concerns buildings: troop spacing and bridge widths
 *  retain their gameplay radii. Longer animated strides shorten near walls. */
const BUILDING_RADII: Partial<Record<TroopId, number>> = {
  ogre: 1.3,
  sumo: 1.3,
  archers: 1.03,
  duelist: 1.38,
  gladiator: 1.2,
  mage: 1.33,
};
export const troopBuildingRadius = (card: TroopId) =>
  BUILDING_RADII[card] ?? troopCards[card].unit.radius * 2.1;

/** Signed distance from a point to a building's solid edge. */
export function towerGap(t: Tower, x: number, y: number) {
  const { half, corner } = towerFootprint[t.kind];
  const core = half - corner;
  const dx = Math.abs(x - t.x) - core;
  const dy = Math.abs(y - t.y) - core;
  return (
    dist(Math.max(dx, 0), Math.max(dy, 0)) +
    Math.min(Math.max(dx, dy), 0) -
    corner
  );
}

/** The surface normal at a point on or inside an expanded building. */
export function towerNormal(t: Tower, x: number, y: number): [number, number] {
  const core = towerFootprint[t.kind].half - towerFootprint[t.kind].corner;
  const dx = x - t.x;
  const dy = y - t.y;
  const nx = dx - clamp(dx, -core, core);
  const ny = dy - clamp(dy, -core, core);
  const d = dist(nx, ny);
  if (d > 1e-9) return [nx / d, ny / d];
  if (Math.abs(dx) > Math.abs(dy)) return [dx < 0 ? -1 : 1, 0];
  return [0, dy < 0 ? -1 : dy > 0 ? 1 : t.side === 0 ? 1 : -1];
}

/** At the largest phone scale: a narrow head/countertail capsule and the
 *  ordinary 1.3-tile stance. Troop separation and bridges remain unchanged. */
export const dinoBuildingFootprint = { radius: 0.85, front: 2.35, rear: 3.45 };
export type BodyDirection = readonly [number, number];
const forward: BodyDirection = [0, 1];
export const unitBodyDirection = (
  u: Pick<Unit, 'bodyDirection' | 'side'>,
): BodyDirection => u.bodyDirection ?? (u.side === 0 ? forward : [0, -1]);
type Hull = {
  points: number[];
  directionX: number;
  directionY: number;
  winding: number;
  radius: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};
const dinoHulls: Record<TowerKind, WeakMap<BodyDirection, Hull>> = {
  king: new WeakMap(),
  princess: new WeakMap(),
};

/** Minkowski difference of a tower's square core and the capsule axis.
 *  Six ordered vertices avoid a hull sort; rounding is applied separately. */
function dinoHull(kind: TowerKind, direction: BodyDirection): Hull {
  const cache = dinoHulls[kind];
  const [fx, fy] = direction;
  const old = cache.get(direction);
  if (old && old.directionX === fx && old.directionY === fy) return old;
  const sx = fx < 0 ? -1 : 1;
  const sy = fy < 0 ? -1 : 1;
  const core = towerFootprint[kind].half - towerFootprint[kind].corner;
  const { front, rear, radius } = dinoBuildingFootprint;
  const ax = -front * fx,
    ay = -front * fy;
  const bx = rear * fx,
    by = rear * fy;
  const cx = core * sx,
    cy = core * sy;
  const made = {
    directionX: fx,
    directionY: fy,
    points: [
      ax - cx,
      ay - cy,
      ax + cx,
      ay - cy,
      bx + cx,
      by - cy,
      bx + cx,
      by + cy,
      bx - cx,
      by + cy,
      ax - cx,
      ay + cy,
    ],
    winding: sx * sy,
    radius: towerFootprint[kind].corner + radius,
    minX: Math.min(ax, bx) - core,
    maxX: Math.max(ax, bx) + core,
    minY: Math.min(ay, by) - core,
    maxY: Math.max(ay, by) + core,
  };
  cache.set(direction, made);
  return made;
}

function hullContact(
  hull: Hull,
  x: number,
  y: number,
): [number, number, number] {
  const p = hull.points;
  let inside = true,
    best = Infinity,
    qx = 0,
    qy = 0,
    nx = 0,
    ny = 1;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    const dx = p[j] - p[i],
      dy = p[j + 1] - p[i + 1];
    const size2 = dx * dx + dy * dy;
    if (size2 < 1e-18) continue;
    const rx = x - p[i],
      ry = y - p[i + 1];
    if ((dx * ry - dy * rx) * hull.winding < -1e-10) inside = false;
    const at = clamp((rx * dx + ry * dy) / size2, 0, 1);
    const cx = p[i] + dx * at,
      cy = p[i + 1] + dy * at;
    const ox = x - cx,
      oy = y - cy,
      d2 = ox * ox + oy * oy;
    if (d2 < best) {
      best = d2;
      qx = cx;
      qy = cy;
      const size = Math.sqrt(size2);
      nx = (dy * hull.winding) / size;
      ny = (-dx * hull.winding) / size;
    }
  }
  const d = Math.sqrt(best);
  if (d > 1e-9) {
    nx = ((x - qx) / d) * (inside ? -1 : 1);
    ny = ((y - qy) / d) * (inside ? -1 : 1);
  }
  return [(inside ? -d : d) - hull.radius, nx, ny];
}

function troopContact(
  t: Tower,
  card: TroopId,
  x: number,
  y: number,
  direction: BodyDirection,
): [number, number, number] {
  const gap = towerGap(t, x, y) - troopBuildingRadius(card);
  if (card === 'ogre') {
    const contact = hullContact(dinoHull(t.kind, direction), x - t.x, y - t.y);
    if (contact[0] < gap) return contact;
  }
  const [nx, ny] = towerNormal(t, x, y);
  return [gap, nx, ny];
}

/** Pure signed clearance of the complete building hull (zero is contact). */
export function troopTowerGap(
  t: Tower,
  card: TroopId,
  x: number,
  y: number,
  direction: BodyDirection = forward,
) {
  const body = towerGap(t, x, y) - troopBuildingRadius(card);
  return card === 'ogre'
    ? Math.min(
        body,
        hullContact(dinoHull(t.kind, direction), x - t.x, y - t.y)[0],
      )
    : body;
}

function troopTowerClear(
  t: Tower,
  card: TroopId,
  x: number,
  y: number,
  direction: BodyDirection,
  margin = 0,
) {
  if (towerGap(t, x, y) - troopBuildingRadius(card) < margin - 1e-9)
    return false;
  if (card !== 'ogre') return true;
  const hull = dinoHull(t.kind, direction),
    r = hull.radius + margin;
  if (
    x - t.x < hull.minX - r ||
    x - t.x > hull.maxX + r ||
    y - t.y < hull.minY - r ||
    y - t.y > hull.maxY + r
  )
    return true;
  return hullContact(hull, x - t.x, y - t.y)[0] >= margin - 1e-9;
}

/** Pure recovery projection, shared by deployment, snapshots and audits.
 *  Normal walking uses swept contacts rather than this recovery jump. */
export function projectTroopBuildings(
  towers: readonly Tower[],
  card: TroopId,
  x: number,
  y: number,
  direction: BodyDirection = forward,
  margin = 0,
): [number, number] {
  const s = troopCards[card].unit;
  if (s.flying) return [x, y];
  const ox = x,
    oy = y;
  const clear = (cx: number, cy: number) =>
    towers.every(
      (t) => t.destroyed || troopTowerClear(t, card, cx, cy, direction, margin),
    );
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const t of towers) {
      if (t.destroyed) continue;
      const [gap, nx, ny] = troopContact(t, card, x, y, direction);
      if (gap >= margin - 1e-9) continue;
      x = clamp(x + nx * (margin - gap + 1e-6), s.radius, WIDTH - s.radius);
      y = clamp(y + ny * (margin - gap + 1e-6), s.radius, LENGTH - s.radius);
      changed = true;
    }
    if (!changed) {
      if (!inRiver(x, y, s.radius)) return [x, y];
      break;
    }
  }
  if (clear(x, y) && !inRiver(x, y, s.radius)) return [x, y];
  const xs = [ox, x, s.radius, WIDTH - s.radius],
    ys = [oy, y, s.radius, LENGTH - s.radius];
  for (const t of towers) {
    if (t.destroyed) continue;
    const edge =
      towerFootprint[t.kind].half + troopBuildingRadius(card) + margin + 1e-6;
    xs.push(
      clamp(t.x - edge, s.radius, WIDTH - s.radius),
      clamp(t.x + edge, s.radius, WIDTH - s.radius),
    );
    ys.push(
      clamp(t.y - edge, s.radius, LENGTH - s.radius),
      clamp(t.y + edge, s.radius, LENGTH - s.radius),
    );
    if (card === 'ogre') {
      const hull = dinoHull(t.kind, direction);
      for (let i = 0; i < hull.points.length; i += 2) {
        xs.push(
          clamp(
            t.x + hull.points[i] - hull.radius - margin - 1e-6,
            s.radius,
            WIDTH - s.radius,
          ),
          clamp(
            t.x + hull.points[i] + hull.radius + margin + 1e-6,
            s.radius,
            WIDTH - s.radius,
          ),
        );
        ys.push(
          clamp(
            t.y + hull.points[i + 1] - hull.radius - margin - 1e-6,
            s.radius,
            LENGTH - s.radius,
          ),
          clamp(
            t.y + hull.points[i + 1] + hull.radius + margin + 1e-6,
            s.radius,
            LENGTH - s.radius,
          ),
        );
      }
    }
  }
  let best = Infinity;
  const uniqueYs = [...new Set(ys)];
  for (const cx of new Set(xs))
    for (const cy of uniqueYs) {
      if (inRiver(cx, cy, s.radius) || !clear(cx, cy)) continue;
      const d2 = (cx - ox) * (cx - ox) + (cy - oy) * (cy - oy);
      if (d2 < best) {
        best = d2;
        x = cx;
        y = cy;
      }
    }
  return [x, y];
}

function hullEntry(hull: Hull, x: number, y: number, vx: number, vy: number) {
  const p = hull.points,
    r = hull.radius,
    speed2 = vx * vx + vy * vy;
  if (speed2 <= 1e-18) return null;
  if (
    Math.min(x, x + vx) > hull.maxX + r ||
    Math.max(x, x + vx) < hull.minX - r ||
    Math.min(y, y + vy) > hull.maxY + r ||
    Math.max(y, y + vy) < hull.minY - r
  )
    return null;
  let best = Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length,
      k = (i + p.length - 2) % p.length;
    const dx = p[j] - p[i],
      dy = p[j + 1] - p[i + 1],
      len = dist(dx, dy);
    if (len > 1e-9) {
      const nx = (dy * hull.winding) / len,
        ny = (-dx * hull.winding) / len;
      const into = vx * nx + vy * ny;
      if (into < -1e-9) {
        const at = (r - (x - p[i]) * nx - (y - p[i + 1]) * ny) / into;
        const along =
          ((x + vx * at - p[i]) * dx + (y + vy * at - p[i + 1]) * dy) / len;
        if (at >= -1e-9 && at <= 1 && along >= -1e-9 && along <= len + 1e-9)
          best = Math.min(best, Math.max(0, at));
      }
    }
    const cx = x - p[i],
      cy = y - p[i + 1],
      b = cx * vx + cy * vy,
      c = cx * cx + cy * cy - r * r;
    const discr = b * b - speed2 * c;
    if (discr < 0) continue;
    const at = (-b - Math.sqrt(discr)) / speed2;
    if (at < -1e-9 || at > 1) continue;
    const qx = cx + vx * at,
      qy = cy + vy * at;
    if (
      qx * (p[i] - p[k]) + qy * (p[i + 1] - p[k + 1]) < -1e-9 ||
      qx * dx + qy * dy > 1e-9 ||
      qx * vx + qy * vy >= -1e-9
    )
      continue;
    best = Math.min(best, Math.max(0, at));
  }
  return best === Infinity ? null : best;
}

function troopBuildingEntry(
  m: Match,
  u: Unit,
  x: number,
  y: number,
  vx: number,
  vy: number,
  except?: Tower,
  direction = unitBodyDirection(u),
) {
  let best = buildingEntry(
    m,
    x,
    y,
    vx,
    vy,
    troopBuildingRadius(u.card),
    except,
  );
  if (u.card !== 'ogre') return best;
  for (const t of m.towers) {
    if (t.destroyed || t === except) continue;
    const at = hullEntry(dinoHull(t.kind, direction), x - t.x, y - t.y, vx, vy);
    if (at !== null && (!best || at < best.at)) best = { tower: t, at };
  }
  return best;
}

/** Fixed numeric rotation keeps collision independent of browser trig. */
const TURN_COS = 0.9950041652780258,
  TURN_SIN = 0.09983341664682815;
function turnDino(m: Match, u: Unit, wx: number, wy: number) {
  const d = dist(wx, wy);
  if (d < 1e-9) return;
  const tx = wx / d,
    ty = wy / d,
    [hx, hy] = unitBodyDirection(u);
  const dot = hx * tx + hy * ty,
    cross = hx * ty - hy * tx;
  if (dot > 1 - 1e-14) {
    u.facing = Math.atan2(hx, hy);
    return;
  }
  const sign = cross < 0 ? -1 : cross > 0 ? 1 : u.id % 2 ? 1 : -1;
  const nx = dot >= TURN_COS ? tx : hx * TURN_COS - hy * TURN_SIN * sign;
  const ny = dot >= TURN_COS ? ty : hy * TURN_COS + hx * TURN_SIN * sign;
  const at = (fraction: number): [number, number] => {
    const x = hx + (nx - hx) * fraction,
      y = hy + (ny - hy) * fraction,
      size = dist(x, y);
    return [x / size, y / size];
  };
  const safe = (fraction: number) => {
    for (let i = 0; i <= 32; i++) {
      const k = i / 32,
        heading = at(fraction * k);
      const x = u.px + (u.x - u.px) * k,
        y = u.py + (u.y - u.py) * k;
      if (
        m.towers.some(
          (t) =>
            !t.destroyed &&
            !troopTowerClear(t, u.card, x, y, heading, 0.0001 * k),
        )
      )
        return false;
    }
    return true;
  };
  let fraction = 1;
  if (!safe(1)) {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (safe(mid)) lo = mid;
      else hi = mid;
    }
    fraction = lo;
  }
  u.bodyDirection = at(fraction);
  u.facing = Math.atan2(u.bodyDirection[0], u.bodyDirection[1]);
}

/** First entry of a segment into a rounded square expanded by padding.
 *  Exact face/corner intersections prevent long shoves and fast leaps
 *  tunnelling through a building whose far side is otherwise clear. */
function towerEntry(
  t: Tower,
  x: number,
  y: number,
  vx: number,
  vy: number,
  padding: number,
) {
  const { half, corner } = towerFootprint[t.kind];
  const core = half - corner;
  const r = corner + padding;
  const ox = x - t.x;
  const oy = y - t.y;
  const speed2 = vx * vx + vy * vy;
  if (speed2 <= 1e-18) return null;
  let best = Infinity;
  for (const sign of [-1, 1]) {
    if (sign * vx < -1e-9) {
      const at = (sign * (core + r) - ox) / vx;
      if (at >= -1e-9 && at <= 1 && Math.abs(oy + vy * at) <= core)
        best = Math.min(best, Math.max(0, at));
    }
    if (sign * vy < -1e-9) {
      const at = (sign * (core + r) - oy) / vy;
      if (at >= -1e-9 && at <= 1 && Math.abs(ox + vx * at) <= core)
        best = Math.min(best, Math.max(0, at));
    }
    for (const sy of [-1, 1]) {
      const cx = ox - sign * core;
      const cy = oy - sy * core;
      const b = cx * vx + cy * vy;
      const c = cx * cx + cy * cy - r * r;
      const discriminant = b * b - speed2 * c;
      if (discriminant < 0) continue;
      const at = (-b - Math.sqrt(discriminant)) / speed2;
      if (at < -1e-9 || at > 1) continue;
      const qx = ox + vx * at;
      const qy = oy + vy * at;
      if (sign * qx < core - 1e-9 || sy * qy < core - 1e-9) continue;
      if ((qx - sign * core) * vx + (qy - sy * core) * vy >= -1e-9) continue;
      best = Math.min(best, Math.max(0, at));
    }
  }
  return best === Infinity ? null : best;
}

function buildingEntry(
  m: Match,
  x: number,
  y: number,
  vx: number,
  vy: number,
  padding = 0,
  except?: Tower,
) {
  let best: { tower: Tower; at: number } | null = null;
  for (const t of m.towers) {
    if (t.destroyed || t === except) continue;
    const at = towerEntry(t, x, y, vx, vy, padding);
    if (at !== null && (!best || at < best.at)) best = { tower: t, at };
  }
  return best;
}

/** Pure contact query shared by the tick and interpolated drawing. An
 *  elevated guard shot, lobbed shell or flying bomb can clear buildings;
 *  every ground-level shot stops at the first solid facade. */
export const isGroundProjectile = (p: Pick<Projectile, 'sz' | 'kind'>) =>
  p.sz <= 1.5 && p.kind !== 'shell' && p.kind !== 'bomb' && p.kind !== 'drop';

export function projectileWall(
  m: Match,
  p: Projectile,
  dx: number,
  dy: number,
) {
  if (!isGroundProjectile(p)) return null;
  // Old snapshots allowed shots through buildings. A recovered low shot
  // already inside stone is absorbed immediately, before the swept entry
  // query (which assumes an outside origin) can carry it out the far side.
  for (const tower of m.towers)
    if (!tower.destroyed && towerGap(tower, p.x, p.y) < -1e-9)
      return { tower, at: 0 };
  return buildingEntry(m, p.x, p.y, dx, dy);
}

/** Recover old/injected positions and formation offsets deterministically. */
function clearBuildings(m: Match, u: Unit) {
  const s = unitStats(u);
  if (s.flying) return;
  if (u.card === 'ogre') {
    if (!u.bodyDirection) u.bodyDirection = [...unitBodyDirection(u)];
    const [x, y] = projectTroopBuildings(
      m.towers,
      u.card,
      u.x,
      u.y,
      u.bodyDirection,
    );
    const recovered = x !== u.x || y !== u.y;
    u.x = x;
    u.y = y;
    if (
      recovered &&
      m.towers.some(
        (t) =>
          !t.destroyed &&
          troopTowerGap(t, u.card, u.px, u.py, u.bodyDirection) < -1e-9,
      )
    ) {
      u.px = x;
      u.py = y;
    }
    return;
  }
  const padding = troopBuildingRadius(u.card);
  let recovered = false;
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const t of m.towers) {
      if (t.destroyed) continue;
      const gap = towerGap(t, u.x, u.y);
      if (gap >= padding - 1e-9) continue;
      const [nx, ny] = towerNormal(t, u.x, u.y);
      const move = padding - gap + 1e-6;
      let x = clamp(u.x + nx * move, s.radius, WIDTH - s.radius);
      let y = clamp(u.y + ny * move, s.radius, LENGTH - s.radius);
      // Behind a king, the nearest projection can be outside the field.
      // Pick the nearest feasible side instead of pushing back into it.
      if (towerGap(t, x, y) < padding - 1e-9) {
        let best = Infinity;
        const edge = towerFootprint[t.kind].half + padding + 1e-6;
        for (const [sx, sy] of [
          [0, 1],
          [-1, 0],
          [1, 0],
          [0, -1],
        ]) {
          const cx = clamp(
            sx ? t.x + sx * edge : u.x,
            s.radius,
            WIDTH - s.radius,
          );
          const cy = clamp(
            sy ? t.y + sy * edge : u.y,
            s.radius,
            LENGTH - s.radius,
          );
          if (towerGap(t, cx, cy) < padding - 1e-9) continue;
          const dx = cx - u.x;
          const dy = cy - u.y;
          const d = dx * dx + dy * dy;
          if (d < best) {
            best = d;
            x = cx;
            y = cy;
          }
        }
      }
      u.x = x;
      u.y = y;
      changed = true;
      recovered = true;
    }
    if (!changed) break;
  }
  if (!recovered) return;
  const clear = (x: number, y: number) =>
    m.towers.every((t) => t.destroyed || towerGap(t, x, y) >= padding - 1e-9);
  if (!clear(u.x, u.y)) {
    // Alternating projections can approach an overlapping pair of bases
    // without clearing both. Only for that recovery case, try their face
    // boundaries together; the fixed candidate set also has field corners.
    const xs = [u.x, s.radius, WIDTH - s.radius];
    const ys = [u.y, s.radius, LENGTH - s.radius];
    for (const t of m.towers) {
      if (t.destroyed) continue;
      const edge = towerFootprint[t.kind].half + padding + 1e-6;
      for (const sign of [-1, 1]) {
        xs.push(clamp(t.x + sign * edge, s.radius, WIDTH - s.radius));
        ys.push(clamp(t.y + sign * edge, s.radius, LENGTH - s.radius));
      }
    }
    let best = Infinity;
    let tx = u.x;
    let ty = u.y;
    for (const x of xs)
      for (const y of ys) {
        if (inRiver(x, y, s.radius) || !clear(x, y)) continue;
        const dx = x - u.x;
        const dy = y - u.y;
        const distance = dx * dx + dy * dy;
        if (distance < best) {
          best = distance;
          tx = x;
          ty = y;
        }
      }
    u.x = tx;
    u.y = ty;
  }
  // An invalid restored position should snap clear rather than interpolate
  // from inside stone. Ordinary swept movement keeps its previous position.
  if (!clear(u.px, u.py)) {
    u.px = u.x;
    u.py = u.y;
  }
}

function moveBody(m: Match, u: Unit, vx: number, vy: number) {
  if (!unitStats(u).flying) {
    clearBuildings(m, u);
    const hit = troopBuildingEntry(m, u, u.x, u.y, vx, vy);
    if (hit) {
      const at = Math.max(0, hit.at - 1e-6);
      vx *= at;
      vy *= at;
    }
  }
  u.x += vx;
  u.y += vy;
}

export const seatCount = (mode: Mode) => (mode === 'team' ? 4 : 2);
export const sideOf = (player: number): Side => (player % 2) as Side;

/** A card's level multiplier: +10% a level above the first. */
export const levelScale = (boost: Boost | undefined, card: CardId) =>
  1 + 0.1 * Math.max(0, (boost?.levels?.[card] ?? 1) - 1);

export function createMatch(
  seed: number,
  difficulty: Difficulty = 'medium',
  mode: Mode = 'duel',
  options: MatchOptions = {},
) {
  const m: Match = {
    version: ARENA_MATCH_VERSION,
    mode,
    regulation: options.regulation ?? REGULATION,
    rngState: seed >>> 0,
    difficulty,
    tick: 0,
    time: -READY,
    phase: 'ready',
    players: [],
    towers: [],
    units: [],
    spells: [],
    projectiles: [],
    crowns: [0, 0],
    nextId: 1,
    winner: null,
    events: [],
  };
  for (let i = 0; i < seatCount(mode); i++) {
    const own = options.decks?.[i];
    const cardsOf = own && own.length >= 5 ? own : deck;
    const boost = options.boosts?.[i] ?? {};
    const order = shuffled(m, cardsOf);
    m.players.push({
      side: sideOf(i),
      elixir: boost.elixirStart ?? START_ELIXIR,
      hand: { cards: order.slice(0, 4), queue: order.slice(4) },
      spent: 0,
      deck: [...cardsOf],
      boost,
    });
  }
  for (const side of [0, 1] as Side[]) {
    const boost = m.players[side].boost;
    const hp = (mode === 'team' ? TEAM_TOWER_HP : 1) * (boost.towerHp ?? 1);
    const hit =
      (mode === 'team' ? TEAM_TOWER_DAMAGE : 1) * (boost.towerDamage ?? 1);
    for (const t of towerLayout) {
      const s = towerStats[t.kind];
      m.towers.push({
        id: m.nextId++,
        side,
        kind: t.kind,
        lane: t.lane,
        x: t.x,
        y: side === 0 ? t.y : flipY(t.y),
        hp: Math.round(s.hp * hp),
        maxHp: Math.round(s.hp * hp),
        radius: s.radius,
        range: s.range,
        damage: Math.round(s.damage * hit),
        hitSpeed: s.hitSpeed,
        cooldown: 0,
        targetId: null,
        active: t.kind === 'princess' || !!boost.kingAwake,
        destroyed: false,
      });
    }
  }
  return m;
}

export const elixirMultiplier = (m: Match) =>
  m.phase === 'overtime'
    ? 2.5
    : m.phase === 'battle' && m.time >= m.regulation - 60
      ? 2
      : 1;

/** Seconds left on the clock: regulation first, then overtime. */
export function clock(m: Match) {
  if (m.phase === 'ready') return m.regulation;
  if (m.phase === 'overtime')
    return Math.max(0, m.regulation + OVERTIME - m.time);
  if (m.phase === 'over') return 0;
  return Math.max(0, m.regulation - m.time);
}

export const onBridge = (x: number, y: number, margin = 0) =>
  y > RIVER[0] - margin &&
  y < RIVER[1] + margin &&
  BRIDGES.some((b) => Math.abs(x - b) <= BRIDGE_HALF);

const inRiver = (x: number, y: number, r: number) =>
  y > RIVER[0] - r &&
  y < RIVER[1] + r &&
  !BRIDGES.some((b) => Math.abs(x - b) <= BRIDGE_HALF - r * 0.6);

/** Whether (x, y) is on the field at all: anywhere a spell may land. */
export const onField = (x: number, y: number) =>
  x >= 0.5 && x <= WIDTH - 0.5 && y >= 0.5 && y <= LENGTH - 0.5;

function clearDrop(m: Match, side: Side, x: number, y: number, card?: CardId) {
  const troop = card && !isSpell(card) ? troopCards[card] : undefined;
  const padding = troop ? troopBuildingRadius(troop.id) : 0.2;
  const dir = side === 0 ? 1 : -1;
  return (troop?.formation ?? [[0, 0]]).every(
    ([ox, oy]) =>
      !m.towers.some(
        (t) =>
          !t.destroyed &&
          (troop
            ? troopTowerGap(t, troop.id, x + ox * dir, y + oy * dir, [0, dir]) <
              0
            : towerGap(t, x + ox * dir, y + oy * dir) < padding),
      ),
  );
}

/** Whether a side may drop a troop at (x, y) right now. A troop that
 *  burrows (the Miner) may go anywhere on the field off the water. */
export function canDeployAt(
  m: Match,
  side: Side,
  x: number,
  y: number,
  card?: CardId,
) {
  if (!onField(x, y)) return false;
  const burrows = !!card && !isSpell(card) && !!troopCards[card].unit.burrow;
  if (burrows) return !inRiver(x, y, 0.3) && clearDrop(m, side, x, y, card);
  // Your own half, or a pocket past the river once that lane's tower fell.
  const own = side === 0 ? y <= RIVER[0] - 0.5 : y >= RIVER[1] + 0.5;
  let pocket = false;
  if (!own) {
    for (const t of m.towers) {
      if (t.side === side || t.kind !== 'princess' || !t.destroyed) continue;
      const sameLane = t.lane === 0 ? x < WIDTH / 2 : x >= WIDTH / 2;
      const depth = side === 0 ? y <= 21.5 : y >= flipY(21.5);
      const past = side === 0 ? y >= RIVER[1] + 0.5 : y <= RIVER[0] - 0.5;
      if (sameLane && depth && past) pocket = true;
    }
  }
  if (!own && !pocket) return false;
  return clearDrop(m, side, x, y, card);
}

/** Whether a side may play this card at (x, y): troops by `canDeployAt`,
 *  spells anywhere on the field, on either half and on towers. */
export function canPlayAt(
  m: Match,
  side: Side,
  card: CardId,
  x: number,
  y: number,
) {
  return isSpell(card) ? onField(x, y) : canDeployAt(m, side, x, y, card);
}

/** Where a card dropped at (x, y) goes: the nearest spot on the half-tile
 *  grid where `canPlayAt` holds (a spell's spot is simply held on the
 *  field). Null only if nowhere is legal. Ties go to the first spot in
 *  row order, so every device picks the same one. */
export function nearestLegal(
  m: Match,
  side: Side,
  card: CardId,
  x: number,
  y: number,
): [number, number] | null {
  const hx = Math.min(WIDTH - 0.5, Math.max(0.5, Math.round(x * 2) / 2));
  const hy = Math.min(LENGTH - 0.5, Math.max(0.5, Math.round(y * 2) / 2));
  if (canPlayAt(m, side, card, hx, hy)) return [hx, hy];
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let j = 1; j < LENGTH * 2; j++) {
    const gy = j / 2;
    const dy = gy - y;
    if (dy * dy >= bestD) continue;
    for (let i = 1; i < WIDTH * 2; i++) {
      const gx = i / 2;
      const d = (gx - x) * (gx - x) + dy * dy;
      if (d < bestD && canPlayAt(m, side, card, gx, gy)) {
        bestD = d;
        best = [gx, gy];
      }
    }
  }
  return best;
}

/** Something of the other side that would shoot a troop card dropped at
 *  (x, y): its centre and the reach of its attack, measured to the dropped
 *  troop's centre (its range plus that troop's radius). */
export type Threat = { id: number; x: number; y: number; reach: number };

/** What would be in reach of a troop card dropped at (x, y) by `side`: the
 *  other side's standing, awake towers and its troops that can hit this
 *  troop (ground-only troops never reach a flyer, the Dino only towers).
 *  For the placement warning; spells threaten nothing. */
export function threatsAt(
  m: Match,
  side: Side,
  card: CardId,
  x: number,
  y: number,
): Threat[] {
  if (isSpell(card)) return [];
  const c = troopCards[card];
  const dir = side === 0 ? 1 : -1;
  const spots = c.formation.map(
    ([ox, oy]) => [x + ox * dir, y + oy * dir] as const,
  );
  const r = c.unit.radius;
  const out: Threat[] = [];
  const reaches = (ex: number, ey: number, reach: number) =>
    spots.some(([sx, sy]) => dist(sx - ex, sy - ey) <= reach);
  for (const t of m.towers) {
    if (t.side === side || t.destroyed || !t.active) continue;
    if (reaches(t.x, t.y, t.range + r))
      out.push({ id: t.id, x: t.x, y: t.y, reach: t.range + r });
  }
  for (const u of m.units) {
    if (u.side === side || u.hp <= 0) continue;
    const s = unitStats(u);
    if (s.targets === 'buildings' || supports(s)) continue;
    if (s.targets === 'ground' && c.unit.flying) continue;
    if (reaches(u.x, u.y, s.range + r))
      out.push({ id: u.id, x: u.x, y: u.y, reach: s.range + r });
  }
  return out;
}

export type DeployResult =
  /** The new units' ids, or the falling spell's. */
  | { ok: true; ids: number[] }
  | { ok: false; reason: 'phase' | 'card' | 'elixir' | 'place' };

/** Plays the card in `slot` of a player's hand at (x, y): a troop card puts
 *  its units down, a spell card starts falling there. */
export function deploy(
  m: Match,
  player: number,
  slot: number,
  x: number,
  y: number,
): DeployResult {
  if (m.phase !== 'battle' && m.phase !== 'overtime')
    return { ok: false, reason: 'phase' };
  const seat = m.players[player];
  if (!seat) return { ok: false, reason: 'card' };
  const side = seat.side;
  const hand = seat.hand;
  const id = hand.cards[slot];
  if (!id) return { ok: false, reason: 'card' };
  const card = cards[id];
  if (seat.elixir < card.cost) return { ok: false, reason: 'elixir' };
  if (!canPlayAt(m, side, id, x, y)) return { ok: false, reason: 'place' };
  seat.elixir -= card.cost;
  seat.spent += card.cost;
  hand.cards[slot] = hand.queue.shift()!;
  hand.queue.push(id);
  const ids: number[] = [];
  m.events.push({ type: 'deploy', side, player, card: id, x, y });
  const boost = seat.boost;
  const level = levelScale(boost, id);
  if (card.kind === 'spell') {
    const s = card.spell;
    const power = level * (boost.spellDamage ?? 1);
    const spell: Spell = {
      id: m.nextId++,
      side,
      owner: player,
      card: card.id,
      x,
      y,
      left: s.delay,
      delay: s.delay,
      radius: s.radius,
      damage: Math.round(s.damage * power),
      towerDamage: Math.round(s.towerDamage * power),
      knockback: s.knockback,
      knockMass: s.knockMass,
    };
    m.spells.push(spell);
    ids.push(spell.id);
    return { ok: true, ids };
  }
  // The bot's formation faces the other way. Every troop of a card takes
  // the lane of the spot it was dropped on.
  const dir = side === 0 ? 1 : -1;
  const lane = laneAt(x);
  for (const [ox, oy] of card.formation)
    ids.push(summon(m, player, card.id, x + ox * dir, y + oy * dir, lane).id);
  return { ok: true, ids };
}

/**
 * Puts one troop of `card` on the field for `player` at (x, y), deploying,
 * with the player's level and boosts. `deploy` calls it for every troop of
 * a card; tests and the lab use it to set up a scene.
 */
export function summon(
  m: Match,
  player: number,
  card: TroopId,
  x: number,
  y: number,
  lane: 0 | 1 = laneAt(x),
  /** A troop spawned by another (a Bee) takes its parent's level and a
   *  shorter deploy. */
  parent?: { card: TroopId; deploy: number },
): Unit {
  const seat = m.players[player];
  const side = seat.side;
  const boost = seat.boost;
  const level = levelScale(boost, parent?.card ?? card);
  const stats = troopCards[card].unit;
  const hp = Math.round(stats.hp * level * (boost.troopHp ?? 1));
  const shield = Math.round((stats.shield ?? 0) * level * (boost.troopHp ?? 1));
  const ux = clamp(x, stats.radius, WIDTH - stats.radius);
  const uy = clamp(y, stats.radius, LENGTH - stats.radius);
  const u: Unit = {
    id: m.nextId++,
    side,
    owner: player,
    card,
    x: ux,
    y: uy,
    px: ux,
    py: uy,
    hp,
    maxHp: hp,
    state: 'deploying',
    deployLeft: parent?.deploy ?? stats.burrow ?? DEPLOY_TIME,
    targetId: null,
    attackTimer: stats.firstHit,
    facing: side === 0 ? 0 : Math.PI,
    ...(card === 'ogre'
      ? { bodyDirection: [0, side === 0 ? 1 : -1] as [number, number] }
      : {}),
    sinceHit: 99,
    lane,
    bridge: -1,
    detour: null,
    power: level * (boost.troopDamage ?? 1),
    pace: boost.troopSpeed ?? 1,
    shield,
    maxShield: shield,
    shieldDelay: 0,
    stun: 0,
    dash: false,
    charged: false,
    cooldown: stats.heal
      ? stats.heal.every
      : stats.spawn
        ? stats.spawn.first
        : stats.aura
          ? BEAT
          : 0,
    raged: false,
    taunt: 0,
    tauntId: null,
    slow: 0,
    slowFactor: 1,
    beat: 1,
  };
  clearBuildings(m, u);
  u.px = u.x;
  u.py = u.y;
  m.units.push(u);
  return u;
}

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

type Body = { x: number; y: number };

/** The ability fields of a troop that has none in play, for code that
 *  builds units by hand (the lab, the shader warm-up, tests). */
export const plainUnit = {
  power: 1,
  pace: 1,
  shield: 0,
  maxShield: 0,
  shieldDelay: 0,
  stun: 0,
  dash: false,
  charged: false,
  cooldown: 0,
  raged: false,
  taunt: 0,
  tauntId: null,
  slow: 0,
  slowFactor: 1,
  beat: 1,
  detour: null,
} satisfies Partial<Unit>;

/** The stun and chain fields of a shot that has none. */
export const plainShot = {
  stun: 0,
  chain: 0,
  chainRange: 0,
  slow: 0,
  slowFactor: 1,
} satisfies Partial<Projectile>;
export const unitStats = (u: Unit) => troopCards[u.card].unit;
/** A troop that never attacks: it follows its friends (the Medic, the
 *  Drummer, the Beekeeper). */
export const supports = (s: UnitStats) => !!(s.follows || s.heal);
/** Seconds between a Drummer's beats (the aura itself is steady). */
export const BEAT = 0.5;
/** Where spawned troops (bees) appear around their parent, its facing
 *  forward. */
const SPAWN_SPOTS: [number, number][] = [
  [0, 0.6],
  [-0.55, -0.3],
  [0.55, -0.3],
  [-0.6, 0.35],
  [0.6, 0.35],
  [0, -0.65],
];

function findById(m: Match, id: number | null): Unit | Tower | undefined {
  if (id === null) return undefined;
  for (const u of m.units) if (u.id === id) return u.hp > 0 ? u : undefined;
  for (const t of m.towers) if (t.id === id) return t.destroyed ? undefined : t;
  return undefined;
}
const isTower = (b: Unit | Tower): b is Tower => 'kind' in b;
const radiusOf = (b: Unit | Tower) =>
  isTower(b) ? b.radius : unitStats(b).radius;
const flying = (b: Unit | Tower) => !isTower(b) && unitStats(b).flying;
const edge = (a: Body, b: Unit | Tower) =>
  dist(a.x - b.x, a.y - b.y) - radiusOf(b);

/** Ground melee can strike the solid edge from outside its larger drawn
 *  body. Ranged reach retains the card's existing combat circle. */
function attackEdge(u: Unit, b: Unit | Tower) {
  const s = unitStats(u);
  if (isTower(b) && !s.flying && !s.projectile && !s.cone)
    return (
      troopTowerGap(
        b,
        u.card,
        u.x,
        u.y,
        u.card === 'ogre'
          ? (() => {
              const dx = b.x - u.x,
                dy = b.y - u.y,
                d = dist(dx, dy) || 1;
              return [dx / d, dy / d] as const;
            })()
          : unitBodyDirection(u),
      ) + s.radius
    );
  return edge(u, b);
}

/** Whether a ground attack has a clear line between two positions. */
export function clearAttackLine(
  m: Match,
  from: Body,
  to: Body,
  except?: Tower,
) {
  return !buildingEntry(
    m,
    from.x,
    from.y,
    to.x - from.x,
    to.y - from.y,
    0,
    except,
  );
}

/** A high bomb arc or flyer clears buildings. Ground-level attacks need
 *  a clear line, excluding only the tower they intend to strike. */
function visibleAttack(m: Match, u: Unit, target: Unit | Tower) {
  const s = unitStats(u);
  if (s.flying || s.projectile?.kind === 'shell') return true;
  return clearAttackLine(m, u, target, isTower(target) ? target : undefined);
}

/** Can this unit (or tower) hit that body at all. */
function canTarget(targets: 'any' | 'ground' | 'buildings', b: Unit | Tower) {
  if (targets === 'buildings') return isTower(b);
  if (targets === 'ground') return !flying(b);
  return true;
}

/** The lane of a spot on the field: left or right of the middle. */
export const laneAt = (x: number): 0 | 1 => (x < WIDTH / 2 ? 0 : 1);

/** The enemy tower a troop heads for when nothing is in sight: its lane's
 *  small tower, then the king, then whatever still stands. */
function laneTower(m: Match, u: Unit): Tower | undefined {
  let king: Tower | undefined;
  for (const t of m.towers) {
    if (t.side === u.side || t.destroyed) continue;
    if (t.kind === 'princess' && t.lane === u.lane) return t;
    if (t.kind === 'king') king = t;
  }
  if (king) return king;
  let best: Tower | undefined;
  let bestD = Infinity;
  for (const t of m.towers) {
    if (t.side === u.side || t.destroyed) continue;
    const d = dist(u.x - t.x, u.y - t.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function acquire(m: Match, u: Unit) {
  const s = unitStats(u);
  // Only a siege gun has a blind spot; a flyer right over a ground troop
  // (a bee on the Diver's helmet) is at a negative edge and still hits it.
  const near = s.minRange ?? -Infinity;
  // A Sumo's stomp: it fights him while the taunt lasts, wherever he is.
  if (u.taunt > 0) {
    const sumo = findById(m, u.tauntId);
    if (sumo && !isTower(sumo) && sumo.side !== u.side) {
      if (edge(u, sumo) >= near) return sumo;
    } else {
      u.taunt = 0;
      u.tauntId = null;
    }
  }
  const current = findById(m, u.targetId);
  // Keep a living troop target through crowd separation and pursuit. A
  // one-tick walk between swings must not hand the lock to a nearer tower.
  // Tower approach is still interruptible by defending troops.
  if (
    current &&
    current.side !== u.side &&
    canTarget(s.targets, current) &&
    edge(u, current) >= near
  ) {
    const reach = edge(u, current);
    if (
      !isTower(current) &&
      current.state !== 'deploying' &&
      reach <= s.sight + 0.25
    )
      return current;
    if (
      isTower(current) &&
      u.state === 'attacking' &&
      attackEdge(u, current) <= s.range + 0.1
    )
      return current;
  }
  let best: Unit | Tower | undefined;
  let bestD = Infinity;
  if (s.targets !== 'buildings') {
    for (const e of m.units) {
      if (e.side === u.side || e.hp <= 0 || e.state === 'deploying') continue;
      if (!canTarget(s.targets, e)) continue;
      const d = edge(u, e);
      if (d <= s.sight && d >= near && d < bestD) {
        bestD = d;
        best = e;
      }
    }
  }
  for (const t of m.towers) {
    if (t.side === u.side || t.destroyed) continue;
    const d = edge(u, t);
    if (d <= s.sight && d >= near && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ?? laneTower(m, u);
}

/** The nearest living friendly troop a support follows, other supports
 *  and spawned bees aside. */
function nearestFriend(m: Match, u: Unit, sight: number) {
  let best: Unit | undefined;
  let bestD = Infinity;
  for (const f of m.units) {
    if (f === u || f.side !== u.side || f.hp <= 0) continue;
    if (supports(unitStats(f)) || troopCards[f.card].token) continue;
    const d = dist(f.x - u.x, f.y - u.y);
    if (d <= sight && d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/** Where a ground troop walks next on its way to (tx, ty); `own` is true
 *  when the goal is a tower, whose lane's bridge it crosses. */
function steer(u: Unit, tx: number, ty: number, own = false): [number, number] {
  if (unitStats(u).flying) return [tx, ty];
  const mySide = u.y < MID ? 0 : 1;
  const theirSide = ty < MID ? 0 : 1;
  if (onBridge(u.x, u.y, 0.3)) {
    // On a bridge: keep to its centre line until off the far end.
    const b = BRIDGES.reduce((p, c) =>
      Math.abs(c - u.x) < Math.abs(p - u.x) ? c : p,
    );
    const exitY = theirSide === 0 ? RIVER[0] - 0.4 : RIVER[1] + 0.4;
    if (theirSide === 0 ? u.y > exitY : u.y < exitY) return [b, exitY];
    return [tx, ty];
  }
  if (mySide === theirSide) return [tx, ty];
  // Towards a tower, cross at the lane's own bridge; after a troop, at the
  // bridge that makes the shortest walk.
  const b = own
    ? BRIDGES[u.lane]
    : BRIDGES.reduce((p, c) =>
        Math.abs(u.x - c) + Math.abs(tx - c) <
        Math.abs(u.x - p) + Math.abs(tx - p)
          ? c
          : p,
      );
  const entryY = mySide === 0 ? RIVER[0] - 0.2 : RIVER[1] + 0.2;
  return [b, entryY];
}

/**
 * A ground troop's step direction (vx, vy) bent round any standing tower it
 * would walk into, so it slides along the tower at full speed instead of
 * pushing into it (heading straight at a tower's centre used to cancel the
 * step against `separate`'s push-out for good). The solid footprint is the
 * one `separate` enforces. It turns to the side its goal lies on; dead ahead
 * it passes on the side facing the middle of the field, then towards the
 * river. The goal's building is solid too; melee stops at its outside edge.
 */
function skirt(
  m: Match,
  u: Unit,
  wx: number,
  wy: number,
  vx: number,
  vy: number,
  step: number,
): [number, number] {
  const s = unitStats(u);
  if (s.flying) return [vx, vy];
  const hit = troopBuildingEntry(m, u, u.x, u.y, vx * step, vy * step);
  if (hit) {
    const t = hit.tower;
    const [, nx, ny] = troopContact(
      t,
      u.card,
      u.x + vx * step * hit.at,
      u.y + vy * step * hit.at,
      unitBodyDirection(u),
    );
    const into = vx * nx + vy * ny;
    if (into >= 0) return [vx, vy];
    // Pick the side from the waypoint relative to the building, not the
    // troop's changing position. A flat wall otherwise reverses its
    // tangent after every sidestep towards a centred goal.
    let tx = -ny;
    let ty = nx;
    const towards = tx * (wx - t.x) + ty * (wy - t.y);
    const inward = tx * (WIDTH / 2 - t.x);
    const forward = ty * (MID - t.y);
    const choice =
      Math.abs(towards) > 1e-9
        ? towards
        : inward !== 0
          ? inward
          : forward !== 0
            ? forward
            : tx;
    if (choice < 0) {
      tx = -tx;
      ty = -ty;
    }
    vx = tx;
    vy = ty;
  }
  return [vx, vy];
}

/** A second melee body approaches the side of an ally already fighting
 *  a tower instead of walking into its back until the building falls. */
function flank(
  m: Match,
  u: Unit,
  target: Unit | Tower | null,
  vx: number,
  vy: number,
  by: number,
): [number, number] {
  const s = unitStats(u);
  if (!target || !isTower(target) || s.flying || s.projectile || s.cone)
    return [vx, vy];
  for (const friend of m.units) {
    if (
      friend === u ||
      friend.side !== u.side ||
      friend.hp <= 0 ||
      friend.state !== 'attacking' ||
      friend.targetId !== target.id ||
      unitStats(friend).flying
    )
      continue;
    const min = s.radius + unitStats(friend).radius + 0.03;
    const ox = u.x - friend.x;
    const oy = u.y - friend.y;
    const qx = ox + vx * by;
    const qy = oy + vy * by;
    if (qx * qx + qy * qy >= min * min) continue;
    const d = dist(ox, oy);
    if (d < 1e-9) continue;
    const nx = ox / d;
    const ny = oy / d;
    const into = vx * nx + vy * ny;
    if (into >= 0) continue;
    let tx = vx - into * nx;
    let ty = vy - into * ny;
    let size = dist(tx, ty);
    if (size < 1e-9) {
      tx = -ny;
      ty = nx;
      if (tx * (WIDTH / 2 - target.x) < 0) {
        tx = -tx;
        ty = -ty;
      }
      size = 1;
    }
    vx = tx / size;
    vy = ty / size;
  }
  return [vx, vy];
}

function damage(m: Match, target: Unit | Tower, amount: number, from: Side) {
  if (isTower(target)) {
    if (target.destroyed) return;
    target.hp -= amount;
    if (target.kind === 'king' && !target.active) wake(m, target.side);
    m.events.push({
      type: 'hit',
      id: target.id,
      x: target.x,
      y: target.y,
      damage: amount,
    });
    if (target.hp <= 0) {
      target.hp = 0;
      target.destroyed = true;
      target.targetId = null;
      m.events.push({
        type: 'tower',
        id: target.id,
        side: target.side,
        kind: target.kind,
      });
      if (target.kind === 'king') m.crowns[from] = 3;
      else {
        m.crowns[from] = Math.min(3, m.crowns[from] + 1);
        wake(m, target.side);
      }
      const back = m.players.find((p) => p.side === target.side)?.boost
        .towerElixir;
      if (back)
        for (const p of m.players)
          if (p.side === target.side)
            p.elixir = Math.min(MAX_ELIXIR, p.elixir + back);
    }
    return;
  }
  if (target.hp <= 0) return;
  // Armour takes a flat bite out of every hit, but never all of it.
  const armour = unitStats(target).armour;
  let blocked = 0;
  if (armour) {
    const kept = Math.max(
      Math.round(amount * armour.min),
      amount - armour.flat,
    );
    blocked = amount - kept;
    amount = kept;
  }
  if (target.maxShield > 0 && amount > 0) target.shieldDelay = SHIELD_DELAY;
  const absorbed = Math.min(target.shield, amount);
  if (absorbed > 0) {
    target.shield -= absorbed;
    if (target.shield === 0) {
      m.events.push({
        type: 'shield',
        id: target.id,
        x: target.x,
        y: target.y,
      });
    }
  }
  target.hp -= amount - absorbed;
  m.events.push({
    type: 'hit',
    id: target.id,
    x: target.x,
    y: target.y,
    damage: amount,
    ...(blocked > 0 ? { armour: blocked } : {}),
  });
}

/** Pushes a troop (nx, ny) by `by` tiles; a ground troop never crosses the
 *  middle of the river (it stops at a bridge's middle), and `separate`
 *  settles it clear of the water and the towers afterwards. */
function shove(m: Match, e: Unit, nx: number, ny: number, by: number) {
  const y0 = e.y;
  moveBody(m, e, nx * by, ny * by);
  const crossed = y0 < MID ? e.y >= MID : e.y < MID;
  if (!unitStats(e).flying && crossed)
    e.y = y0 < MID ? MID - 0.001 : MID + 0.001;
}

/** The unit vector from a to b; dead on top of it, towards the far side
 *  of `a`'s field. */
function away(a: Unit, b: Body): [number, number] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = dist(dx, dy);
  if (d > 1e-6) return [dx / d, dy / d];
  return [0, a.side === 0 ? 1 : -1];
}

/** A blow that knocks its target back (a slap, a tackle). */
function knock(
  m: Match,
  u: Unit,
  target: Unit | Tower,
  distance: number,
  mass: number,
) {
  if (isTower(target) || target.hp <= 0 || target.state === 'deploying') return;
  if (unitStats(target).mass >= mass) return;
  const [nx, ny] = away(u, target);
  const { x: fx, y: fy } = target;
  shove(m, target, nx, ny, distance);
  pushed(m, target, u.id, fx, fy);
}

/** Presentation only: report the movement the existing push rules made. */
function pushed(m: Match, target: Unit, from: number, fx: number, fy: number) {
  if (target.x === fx && target.y === fy) return;
  m.events.push({
    type: 'push',
    id: target.id,
    from,
    x: target.x,
    y: target.y,
    fx,
    fy,
  });
}

/** Frost: the target's steps and blows run at `factor` for `seconds`. */
function chill(
  m: Match,
  target: Unit | Tower,
  seconds: number,
  factor: number,
) {
  if (isTower(target) || target.hp <= 0 || seconds <= 0) return;
  target.slow = Math.max(target.slow, seconds);
  target.slowFactor = Math.min(target.slowFactor, factor);
  m.events.push({ type: 'slow', id: target.id, x: target.x, y: target.y });
}

/** The Sumo lands: every enemy troop nearby that can hit him turns on him. */
function stomp(m: Match, u: Unit, taunt: { radius: number; seconds: number }) {
  const ids: number[] = [];
  for (const e of m.units) {
    if (e.side === u.side || e.hp <= 0) continue;
    const s = unitStats(e);
    if (supports(s) || !canTarget(s.targets, u)) continue;
    if (dist(e.x - u.x, e.y - u.y) > taunt.radius + s.radius) continue;
    e.taunt = taunt.seconds;
    e.tauntId = u.id;
    ids.push(e.id);
  }
  m.events.push({
    type: 'taunt',
    id: u.id,
    x: u.x,
    y: u.y,
    radius: taunt.radius,
    ids,
  });
}

/**
 * The Firefighter's jet: a cone from the troop towards its target. Every
 * enemy it can hit inside (within its range of the troop, edge to edge,
 * and within the cone) takes the blow, and ground troops lighter than the
 * cone's mass are pushed along the jet. A tower it aims at takes the blow
 * too.
 */
function spray(
  m: Match,
  u: Unit,
  s: UnitStats,
  target: Unit | Tower,
  amount: number,
) {
  const cone = s.cone!;
  const [nx, ny] = away(u, target);
  for (const e of m.units) {
    if (e.side === u.side || e.hp <= 0) continue;
    if (!canTarget(s.targets, e)) continue;
    const es = unitStats(e);
    const dx = e.x - u.x;
    const dy = e.y - u.y;
    const d = dist(dx, dy);
    if (d - es.radius > s.range + 0.05) continue;
    // Inside the cone, or right against the nozzle.
    if (d > es.radius + s.radius && dx * nx + dy * ny < cone.cos * d) continue;
    if (!visibleAttack(m, u, e)) continue;
    damage(m, e, amount, u.side);
    if (!es.flying && e.state !== 'deploying' && es.mass < cone.mass) {
      const { x: fx, y: fy } = e;
      shove(m, e, nx, ny, cone.push);
      pushed(m, e, u.id, fx, fy);
    }
  }
  if (isTower(target)) damage(m, target, amount, u.side);
  const reach = s.range + s.radius;
  m.events.push({
    type: 'spray',
    id: u.id,
    x: u.x,
    y: u.y,
    tx: u.x + nx * reach,
    ty: u.y + ny * reach,
    cos: cone.cos,
  });
}

/** A spawner (the Beekeeper) lets out its troops around itself. */
function release(m: Match, u: Unit, spawn: NonNullable<UnitStats['spawn']>) {
  const dir = u.side === 0 ? 1 : -1;
  const ids: number[] = [];
  for (let i = 0; i < spawn.count; i++) {
    const [ox, oy] = SPAWN_SPOTS[i % SPAWN_SPOTS.length];
    const bee = summon(
      m,
      u.owner,
      spawn.unit,
      u.x + ox * dir,
      u.y + oy * dir,
      u.lane,
      { card: u.card, deploy: 0.3 },
    );
    ids.push(bee.id);
  }
  m.events.push({
    type: 'spawn',
    id: u.id,
    card: spawn.unit,
    ids,
    x: u.x,
    y: u.y,
  });
}

function stun(m: Match, target: Unit | Tower, seconds: number) {
  if (isTower(target) || target.hp <= 0 || seconds <= 0) return;
  target.stun = Math.max(target.stun, seconds);
  target.dash = false;
  if (target.state === 'attacking')
    target.attackTimer = Math.max(
      target.attackTimer,
      unitStats(target).firstHit,
    );
  m.events.push({ type: 'stun', id: target.id, x: target.x, y: target.y });
}

function wake(m: Match, side: Side) {
  const king = m.towers.find((t) => t.side === side && t.kind === 'king');
  if (king && !king.active && !king.destroyed) {
    king.active = true;
    m.events.push({ type: 'king-wakes', side });
  }
}

function splashAt(
  m: Match,
  side: Side,
  x: number,
  y: number,
  radius: number,
  amount: number,
  air: boolean,
  ground: boolean,
  /** Melee swings cannot pass through an intervening building. */
  source?: Unit,
) {
  for (const e of m.units) {
    if (e.side === side || e.hp <= 0) continue;
    const f = unitStats(e).flying;
    if ((f && !air) || (!f && !ground)) continue;
    if (source && !visibleAttack(m, source, e)) continue;
    if (dist(e.x - x, e.y - y) <= radius + unitStats(e).radius)
      damage(m, e, amount, side);
  }
  for (const t of m.towers) {
    if (t.side === side || t.destroyed || !ground) continue;
    const reach = source
      ? attackEdge(source, t)
      : dist(t.x - x, t.y - y) - t.radius;
    if (reach <= radius && (!source || visibleAttack(m, source, t)))
      damage(m, t, amount, side);
  }
}

function launch(
  m: Match,
  side: Side,
  sourceId: number,
  from: { x: number; y: number },
  height: number,
  target: Unit | Tower,
  kind: ProjectileKind,
  speed: number,
  amount: number,
  splash: number,
  stats?: UnitStats,
) {
  const d = dist(target.x - from.x, target.y - from.y);
  m.projectiles.push({
    id: m.nextId++,
    side,
    kind,
    sourceId,
    targetId: target.id,
    x: from.x,
    y: from.y,
    sx: from.x,
    sy: from.y,
    sz: height,
    tx: target.x,
    ty: target.y,
    speed,
    damage: amount,
    splash,
    // Cannonballs, shells and dropped bombs roll along the ground.
    air: kind !== 'cannon' && kind !== 'shell' && kind !== 'drop',
    travelled: 0,
    distance: Math.max(0.01, d),
    stun: stats?.stun ?? 0,
    chain: stats?.chain ? stats.chain.count - 1 : 0,
    chainRange: stats?.chain?.range ?? 0,
    slow: stats?.slow?.seconds ?? 0,
    slowFactor: stats?.slow?.factor ?? 1,
  });
  m.events.push({ type: 'shot', id: sourceId, kind });
}

/** Every Drummer's beat, before anyone moves: friends inside it get the
 *  strongest aura they stand in (auras do not add up). */
function beats(m: Match) {
  for (const u of m.units) u.beat = 1;
  for (const d of m.units) {
    if (d.hp <= 0 || d.state === 'deploying') continue;
    const aura = unitStats(d).aura;
    if (!aura) continue;
    for (const f of m.units) {
      if (f === d || f.side !== d.side || f.hp <= 0) continue;
      if (dist(f.x - d.x, f.y - d.y) <= aura.radius + unitStats(f).radius)
        f.beat = Math.max(f.beat, aura.boost);
    }
  }
}

function stepUnits(m: Match) {
  beats(m);
  // Tick every shield before any melee hit, so a hit restarts a full delay
  // regardless of the attacker's position in the unit list.
  for (const u of m.units) {
    if (u.hp <= 0 || u.maxShield <= 0) continue;
    // Refill only the part of this tick after the quiet delay expires.
    // Real elapsed time governs shields: haste, frost and stun do not.
    const quiet = Math.max(0, TICK - u.shieldDelay);
    u.shieldDelay = Math.max(0, u.shieldDelay - TICK);
    if (quiet > 0 && u.shield < u.maxShield)
      u.shield = Math.min(
        u.maxShield,
        u.shield + (u.maxShield / SHIELD_RECHARGE) * quiet,
      );
  }
  // Bees let out this step are in the list too; they only start deploying.
  for (const u of m.units) {
    u.px = u.x;
    u.py = u.y;
    if (u.hp <= 0) continue;
    const s = unitStats(u);
    u.sinceHit += TICK;
    if (u.cooldown > 0 && !supports(s)) u.cooldown -= TICK;
    if (u.taunt > 0) {
      u.taunt -= TICK;
      if (u.taunt <= 0) {
        u.taunt = 0;
        u.tauntId = null;
      }
    }
    if (u.slow > 0) {
      u.slow -= TICK;
      if (u.slow <= 0) {
        u.slow = 0;
        u.slowFactor = 1;
      }
    }
    if (u.state === 'deploying') {
      u.deployLeft -= TICK;
      if (u.deployLeft <= 0) {
        u.state = 'walking';
        if (s.burrow)
          m.events.push({ type: 'emerge', id: u.id, x: u.x, y: u.y });
        if (s.taunt) stomp(m, u, s.taunt);
      }
      continue;
    }
    if (u.stun > 0) {
      u.stun -= TICK;
      continue;
    }
    // Rage: faster steps and blows once badly hurt.
    let quick = 1;
    if (s.rage && u.hp < u.maxHp * s.rage.below) {
      quick = s.rage.boost;
      if (!u.raged) {
        u.raged = true;
        m.events.push({ type: 'rage', id: u.id });
      }
    }
    // A Drummer's beat and an Explorer's frost speed up or slow down both
    // the steps and the countdown to the next blow.
    const tempo = u.beat * (u.slow > 0 ? u.slowFactor : 1);
    const speed = s.speed * u.pace * quick * tempo;
    if (supports(s)) {
      support(m, u, s, speed);
      continue;
    }
    const target = acquire(m, u);
    if (!target) continue;
    // A troop chasing another may follow it over the middle, and then walks
    // on in the lane it ended up in (a tile of give either way).
    if (!isTower(target)) {
      if (u.lane === 0 && u.x > WIDTH / 2 + 1) u.lane = 1;
      else if (u.lane === 1 && u.x < WIDTH / 2 - 1) u.lane = 0;
    }
    if (target.id !== u.targetId) {
      u.targetId = target.id;
      u.attackTimer = s.firstHit;
      u.dash = false;
      // A new target: the Linebacker's next blow is a tackle.
      if (s.tackle) u.charged = true;
      if (u.state === 'attacking') u.state = 'walking';
    }
    const reach = attackEdge(u, target);
    let aligned = true;
    if (u.card === 'ogre' && reach <= s.range) {
      const dx = target.x - u.x,
        dy = target.y - u.y,
        d = dist(dx, dy) || 1;
      turnDino(m, u, dx, dy);
      const [hx, hy] = unitBodyDirection(u);
      aligned = (hx * dx) / d + (hy * dy) / d > 0.9999;
    }
    if (reach <= s.range && visibleAttack(m, u, target) && aligned) {
      u.detour = null;
      if (u.dash) {
        // Landing a leap: the blow falls at once, twice as hard.
        u.dash = false;
        u.charged = true;
        u.attackTimer = 0;
      }
      u.state = 'attacking';
      if (u.card !== 'ogre')
        u.facing = Math.atan2(target.x - u.x, target.y - u.y);
      u.attackTimer -= TICK * tempo;
      if (u.attackTimer <= 0) {
        u.attackTimer += s.hitSpeed / quick;
        u.sinceHit = 0;
        let amount = Math.round(s.damage * u.power);
        if (u.charged && s.leap) amount = Math.round(amount * s.leap.bonus);
        const tackling = u.charged && !!s.tackle;
        u.charged = false;
        if (s.projectile) {
          launch(
            m,
            u.side,
            u.id,
            u,
            s.flying ? 2.2 : 1,
            target,
            s.projectile.kind,
            s.projectile.speed,
            amount,
            s.splash ?? 0,
            s,
          );
        } else {
          m.events.push({ type: 'swing', id: u.id });
          if (s.cone) spray(m, u, s, target, amount);
          else if (s.spin)
            // All the way round: everything near the troop itself.
            splashAt(
              m,
              u.side,
              u.x,
              u.y,
              s.spin,
              amount,
              s.targets === 'any',
              true,
              u,
            );
          else if (s.splash)
            splashAt(
              m,
              u.side,
              target.x,
              target.y,
              s.splash,
              amount,
              true,
              true,
            );
          else damage(m, target, amount, u.side);
          if (s.stun) stun(m, target, s.stun);
          if (s.slow) chill(m, target, s.slow.seconds, s.slow.factor);
          if (s.knockback)
            knock(m, u, target, s.knockback.distance, s.knockback.mass);
          if (tackling && s.tackle && !isTower(target) && target.hp > 0) {
            m.events.push({
              type: 'tackle',
              id: u.id,
              target: target.id,
              x: target.x,
              y: target.y,
            });
            knock(m, u, target, s.tackle.distance, s.tackle.mass);
            stun(m, target, s.tackle.stun);
          }
        }
      }
      continue;
    }
    u.state = 'walking';
    u.attackTimer = s.firstHit;
    // A leap at a troop that has come into reach.
    if (
      s.leap &&
      !u.dash &&
      u.cooldown <= 0 &&
      !isTower(target) &&
      reach <= s.leap.range
    ) {
      u.dash = true;
      u.cooldown = s.leap.cooldown;
      m.events.push({ type: 'leap', id: u.id });
    }
    walkTowards(
      m,
      u,
      target,
      target.x,
      target.y,
      u.dash && s.leap ? s.leap.speed : speed,
      u.card === 'ogre' && reach <= s.range,
    );
  }
}

/** One step towards (tx, ty) on the way to `target`, round towers and over
 *  the bridges, turning smoothly. */
function walkTowards(
  m: Match,
  u: Unit,
  target: Unit | Tower | null,
  tx: number,
  ty: number,
  speed: number,
  turned = false,
) {
  clearBuildings(m, u);
  let [wx, wy] = steer(u, tx, ty, !!target && isTower(target));
  if (!unitStats(u).flying) {
    const goal =
      target &&
      isTower(target) &&
      troopTowerGap(target, u.card, wx, wy, unitBodyDirection(u)) < 0
        ? target
        : undefined;
    const blocked = troopBuildingEntry(
      m,
      u,
      u.x,
      u.y,
      wx - u.x,
      wy - u.y,
      goal,
    );
    if (!blocked) u.detour = null;
    else {
      const old = u.detour;
      if (
        !old ||
        old.target !== (target?.id ?? null) ||
        dist(old.x - u.x, old.y - u.y) < unitStats(u).radius + 0.1 ||
        ((u.card !== 'ogre' || m.tick % 12 === 0) &&
          troopBuildingEntry(m, u, u.x, u.y, old.x - u.x, old.y - u.y, goal))
      ) {
        const point = routeCorner(m, u, wx, wy, goal);
        u.detour = point ? { ...point, target: target?.id ?? null } : null;
      }
      if (u.detour) {
        wx = u.detour.x;
        wy = u.detour.y;
      }
    }
  }
  let bodyAim: BodyDirection | undefined;
  if (u.card === 'ogre') {
    const dx = wx - u.x,
      dy = wy - u.y,
      d = dist(dx, dy);
    if (d > 1e-9) {
      const heading: BodyDirection = [dx / d, dy / d];
      bodyAim = heading;
      if (
        m.towers.some(
          (t) =>
            !t.destroyed && troopTowerGap(t, u.card, u.x, u.y, heading) < 0.05,
        )
      ) {
        // Make room for the next turn at walking speed, never by a recovery
        // teleport or by pointing the long body through the facade.
        const [x, y] = projectTroopBuildings(
          m.towers,
          u.card,
          u.x,
          u.y,
          heading,
          // Match the graph's corner clearance. A larger margin cannot fit
          // between a princess facade and the field edge, causing retreat
          // and approach to repeat even though the full hull fits the lane.
          0.02,
        );
        if (dist(x - u.x, y - u.y) > 0.01) {
          wx = x;
          wy = y;
        }
      }
    }
  }
  const dx = wx - u.x;
  const dy = wy - u.y;
  const d = dist(dx, dy);
  if (d <= 0.001) return;
  const step = Math.min(d, speed * TICK);
  const [fx, fy] = flank(m, u, target, dx / d, dy / d, step);
  const [vx, vy] = skirt(m, u, wx, wy, fx, fy, step);
  moveBody(m, u, vx * step, vy * step);
  // Turn smoothly towards the direction of travel.
  if (u.card === 'ogre') {
    if (!turned) {
      const aim = bodyAim ?? [fx, fy];
      turnDino(m, u, aim[0], aim[1]);
    }
    return;
  }
  const want = Math.atan2(vx, vy);
  let turn = want - u.facing;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  u.facing += turn * Math.min(1, TICK * 10);
}

/** A visibility graph of the six buildings' expanded corners. Most steps
 *  walk straight; a blocked path chooses the shortest clear route once
 *  per corner. This also handles the inner king/tower corridor being too
 *  tight for a large body, without an inward-only steering deadlock. */
function routeCorner(m: Match, u: Unit, x: number, y: number, except?: Tower) {
  const s = unitStats(u);
  const padding = troopBuildingRadius(u.card);
  const points = [
    { x: u.x, y: u.y },
    { x, y },
  ];
  for (const t of m.towers) {
    if (t.destroyed || t === except) continue;
    const size = towerFootprint[t.kind].half + padding + 0.02;
    const core = towerFootprint[t.kind].half - towerFootprint[t.kind].corner;
    const add = (ox: number, oy: number) => {
      const cx = t.x + ox;
      const cy = t.y + oy;
      if (
        cx < s.radius ||
        cx > WIDTH - s.radius ||
        cy < s.radius ||
        cy > LENGTH - s.radius
      )
        return false;
      if (cy < MID !== u.y < MID || inRiver(cx, cy, s.radius)) return false;
      if (
        m.towers.some(
          (e) =>
            !e.destroyed &&
            !troopTowerClear(e, u.card, cx, cy, unitBodyDirection(u)),
        )
      )
        return false;
      points.push({ x: cx, y: cy });
      return true;
    };
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        // Two expanded bases can block an outer box corner while a
        // rounded face tip still gives a clear way out.
        if (!add(sx * size, sy * size)) {
          add(sx * core, sy * size);
          add(sx * size, sy * core);
        }
      }
    if (u.card === 'ogre') {
      const hull = dinoHull(t.kind, unitBodyDirection(u));
      for (let i = 0; i < hull.points.length; i += 2) {
        const j = (i + 2) % hull.points.length,
          k = (i + hull.points.length - 2) % hull.points.length;
        const ax = hull.points[i] - hull.points[k],
          ay = hull.points[i + 1] - hull.points[k + 1],
          al = dist(ax, ay) || 1;
        const bx = hull.points[j] - hull.points[i],
          by = hull.points[j + 1] - hull.points[i + 1],
          bl = dist(bx, by) || 1;
        const nx = (ay / al + by / bl) * hull.winding,
          ny = (-ax / al - bx / bl) * hull.winding,
          n = dist(nx, ny) || 1;
        add(
          hull.points[i] + (nx / n) * (hull.radius + 0.03) * 1.42,
          hull.points[i + 1] + (ny / n) * (hull.radius + 0.03) * 1.42,
        );
      }
    }
  }
  const lengths = points.map(() => Infinity);
  const previous = points.map(() => -1);
  const seen = new Set<number>();
  lengths[0] = 0;
  for (let n = 0; n < points.length; n++) {
    let current = -1;
    for (let i = 0; i < points.length; i++)
      if (!seen.has(i) && (current < 0 || lengths[i] < lengths[current]))
        current = i;
    if (current < 0 || lengths[current] === Infinity) return null;
    if (current === 1) {
      let next = current;
      while (previous[next] > 0) next = previous[next];
      return points[next];
    }
    seen.add(current);
    const from = points[current];
    for (let i = 1; i < points.length; i++) {
      if (seen.has(i)) continue;
      const to = points[i];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = lengths[current] + dist(dx, dy);
      if (
        length >= lengths[i] ||
        troopBuildingEntry(m, u, from.x, from.y, dx, dy, except)
      )
        continue;
      lengths[i] = length;
      previous[i] = current;
    }
  }
  return null;
}

/**
 * A support that never attacks. The Medic's pulse heals every friendly
 * troop around her (never towers, never herself); the Beekeeper lets out
 * her bees; the Drummer beats (his aura works all the time, see `beats`).
 * Each follows the nearest friend, standing a step behind it, and with
 * nobody to follow walks its lane and waits outside the reach of the tower
 * ahead.
 */
function support(m: Match, u: Unit, s: UnitStats, speed: number) {
  u.cooldown -= TICK;
  if (u.cooldown <= 0) {
    u.sinceHit = 0;
    if (s.heal) {
      const heal = s.heal;
      u.cooldown += heal.every;
      const amount = Math.round(heal.amount * u.power);
      const ids: number[] = [];
      for (const f of m.units) {
        if (f === u || f.side !== u.side || f.hp <= 0) continue;
        if (dist(f.x - u.x, f.y - u.y) > heal.radius + unitStats(f).radius)
          continue;
        const before = f.hp;
        f.hp = Math.min(f.maxHp, f.hp + amount);
        if (f.hp > before) ids.push(f.id);
      }
      m.events.push({
        type: 'heal',
        id: u.id,
        x: u.x,
        y: u.y,
        radius: heal.radius,
        ids,
      });
    } else if (s.spawn) {
      u.cooldown += s.spawn.every;
      release(m, u, s.spawn);
    } else {
      u.cooldown += BEAT;
      if (s.aura)
        m.events.push({
          type: 'beat',
          id: u.id,
          x: u.x,
          y: u.y,
          radius: s.aura.radius,
        });
    }
  }
  const friend = nearestFriend(m, u, s.sight * 2);
  if (friend) {
    u.targetId = null;
    const d = dist(friend.x - u.x, friend.y - u.y);
    const keep = unitStats(friend).radius + s.radius + 0.9;
    if (d <= keep) {
      u.state = 'attacking';
      if (d > 0.001) u.facing = Math.atan2(friend.x - u.x, friend.y - u.y);
      return;
    }
    u.state = 'walking';
    walkTowards(m, u, null, friend.x, friend.y, speed);
    return;
  }
  const tower = laneTower(m, u);
  if (!tower) return;
  // Wait just outside the tower's reach.
  if (edge(u, tower) <= tower.range + s.radius + 1) {
    u.state = 'attacking';
    return;
  }
  u.state = 'walking';
  walkTowards(m, u, tower, tower.x, tower.y, speed);
}

/**
 * How two overlapping ground troops (b is (dx, dy) from a, closer than
 * `min`) push apart where the plain push would jam them for good, as
 * [nx, ny, push] like `separate`'s; null keeps the plain push.
 * - Two of a side too wide to walk a bridge side by side (two Dinos) queue
 *   near it: the push runs along the lane, the one ahead (the earlier on a
 *   tie) going first, instead of sideways off the bridge line into the bank.
 * - Troops of both sides that ignore each other (Dinos only hit towers)
 *   pass on a bridge, which is too narrow to go round, and elsewhere
 *   sidestep across the lane, each to its own right on a tie.
 */
function laneShove(
  a: Unit,
  b: Unit,
  dx: number,
  dy: number,
  min: number,
): [number, number, number] | null {
  const sa = unitStats(a);
  const sb = unitStats(b);
  if (a.side !== b.side) {
    if (canTarget(sa.targets, b) || canTarget(sb.targets, a)) return null;
    const band = (u: Unit, r: number) =>
      u.y > RIVER[0] - r && u.y < RIVER[1] + r;
    if (band(a, sa.radius) || band(b, sb.radius)) return [0, 0, 0];
    const need = Math.sqrt(min * min - dy * dy);
    const sx = dx > 0 ? 1 : dx < 0 ? -1 : a.side === 0 ? -1 : 1;
    return [sx, 0, (need - Math.abs(dx)) * 0.5];
  }
  const room = 2 * BRIDGE_HALF - (sa.radius + sb.radius) * 0.6;
  if (min <= room) return null;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  if (my <= RIVER[0] - 1.5 || my >= RIVER[1] + 1.5) return null;
  if (!BRIDGES.some((c) => Math.abs(mx - c) < BRIDGE_HALF + 1.5)) return null;
  const need = Math.sqrt(min * min - dx * dx);
  const forward = a.side === 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : dy < 0 ? -1 : a.id < b.id ? -forward : forward;
  return [0, sy, (need - Math.abs(dy)) * 0.5];
}

/** Troops shove each other apart and stay out of towers and the water. */
function separate(m: Match) {
  const live = m.units.filter((u) => u.hp > 0);
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    const sa = unitStats(a);
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j];
      const sb = unitStats(b);
      if (sa.flying !== sb.flying) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = sa.radius + sb.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const lane = sa.flying ? null : laneShove(a, b, dx, dy, min);
      const d = Math.sqrt(d2) || 0.001;
      const push = lane ? lane[2] : (min - d) * 0.5;
      const nx = lane ? lane[0] : d2 ? dx / d : 1;
      const ny = lane ? lane[1] : d2 ? dy / d : 0;
      // Deploying troops are planted; the rest share the push by mass.
      const wa = a.state === 'deploying' ? 0 : sb.mass / (sa.mass + sb.mass);
      const wb = b.state === 'deploying' ? 0 : sa.mass / (sa.mass + sb.mass);
      moveBody(m, a, -nx * push * 2 * wa, -ny * push * 2 * wa);
      moveBody(m, b, nx * push * 2 * wb, ny * push * 2 * wb);
    }
  }
  for (const u of live) {
    const s = unitStats(u);
    if (!s.flying) {
      clearBuildings(m, u);
      if (inRiver(u.x, u.y, s.radius)) {
        // Step back onto the nearer bank.
        u.y = u.y < MID ? RIVER[0] - s.radius : RIVER[1] + s.radius;
      }
    }
    u.x = clamp(u.x, s.radius, WIDTH - s.radius);
    u.y = clamp(u.y, s.radius, LENGTH - s.radius);
  }
}

/**
 * Falling spells count down and crash: damage to every troop of the other
 * side inside the circle, ground and air, less to towers, and light troops
 * knocked straight away from the centre. The push never carries a ground
 * troop to the other side of the river; `separate` then settles it clear of
 * the water and the towers.
 */
function stepSpells(m: Match) {
  if (!m.spells.length) return;
  const falling: Spell[] = [];
  for (const s of m.spells) {
    s.left -= TICK;
    // Half a tick of slack, so a one-second fall lands on the 30th step.
    if (s.left < TICK / 2) crash(m, s);
    else falling.push(s);
  }
  m.spells = falling;
}

function crash(m: Match, s: Spell) {
  for (const e of m.units) {
    if (e.side === s.side || e.hp <= 0) continue;
    const st = unitStats(e);
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const d = dist(dx, dy);
    if (d > s.radius + st.radius) continue;
    damage(m, e, s.damage, s.side);
    if (st.mass >= s.knockMass) continue;
    // Straight out from the centre; dead centre pushes towards their side.
    const nx = d > 1e-6 ? dx / d : 0;
    const ny = d > 1e-6 ? dy / d : s.side === 0 ? 1 : -1;
    const fx = e.x;
    const y0 = e.y;
    moveBody(m, e, nx * s.knockback, ny * s.knockback);
    // A ground troop shoved along a bridge stops at its middle.
    const crossed = y0 < MID ? e.y >= MID : e.y < MID;
    if (!st.flying && crossed) e.y = y0 < MID ? MID - 0.001 : MID + 0.001;
    pushed(m, e, s.id, fx, y0);
  }
  for (const t of m.towers) {
    if (t.side === s.side || t.destroyed) continue;
    if (dist(t.x - s.x, t.y - s.y) <= s.radius + t.radius)
      damage(m, t, s.towerDamage, s.side);
  }
  m.events.push({
    type: 'impact',
    kind: s.card,
    x: s.x,
    y: s.y,
    splash: s.radius,
  });
}

function stepTowers(m: Match) {
  for (const t of m.towers) {
    if (t.destroyed || !t.active) continue;
    t.cooldown = Math.max(0, t.cooldown - TICK);
    let target = findById(m, t.targetId) as Unit | undefined;
    if (
      !target ||
      isTower(target) ||
      dist(target.x - t.x, target.y - t.y) - unitStats(target).radius > t.range
    ) {
      target = undefined;
      let bestD = Infinity;
      for (const u of m.units) {
        if (u.side === t.side || u.hp <= 0 || u.state === 'deploying') continue;
        const d = dist(u.x - t.x, u.y - t.y) - unitStats(u).radius;
        if (d <= t.range && d < bestD) {
          bestD = d;
          target = u;
        }
      }
      t.targetId = target?.id ?? null;
    }
    if (target && t.cooldown <= 0) {
      t.cooldown = t.hitSpeed;
      launch(
        m,
        t.side,
        t.id,
        t,
        t.kind === 'king' ? 4.2 : 3.6,
        target,
        // The small towers' guards are longbow archers.
        t.kind === 'king' ? 'cannon' : 'arrow',
        t.kind === 'king' ? 12 : 16,
        t.damage,
        0,
      );
    }
  }
}

function stepProjectiles(m: Match) {
  for (const p of m.projectiles) {
    const target = findById(m, p.targetId);
    // Shots home in on their target and fly on to its last spot if it falls.
    if (target) {
      p.tx = target.x;
      p.ty = target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = dist(dx, dy);
    const step = p.speed * TICK;
    p.distance = p.travelled + d;
    const by = Math.min(d, step);
    const vx = d ? (dx / d) * by : 0;
    const vy = d ? (dy / d) * by : 0;
    // Guards fire from above the roof; lobbed shells and flying bombs
    // clear buildings. Every ground-level shot stops at the first wall,
    // including a target that moved behind it after the shot left.
    const wall = projectileWall(m, p, vx, vy);
    if (wall || d <= step) {
      p.x += vx * (wall?.at ?? 1);
      p.y += vy * (wall?.at ?? 1);
      p.travelled += by * (wall?.at ?? 1);
      p.distance = p.travelled;
      p.speed = 0;
      const hit = wall
        ? wall.tower.side !== p.side
          ? wall.tower
          : undefined
        : target;
      if (p.splash > 0)
        splashAt(m, p.side, p.x, p.y, p.splash, p.damage, p.air, true);
      else if (hit) damage(m, hit, p.damage, p.side);
      if (hit && p.stun) stun(m, hit, p.stun);
      if (hit && p.slow) chill(m, hit, p.slow, p.slowFactor);
      m.events.push({
        type: 'impact',
        kind: p.kind,
        x: p.x,
        y: p.y,
        splash: p.splash,
      });
      if (p.chain > 0 && hit) jump(m, p, hit);
      continue;
    }
    p.x += vx;
    p.y += vy;
    p.travelled += step;
  }
  if (m.projectiles.some((p) => p.speed <= 0))
    m.projectiles = m.projectiles.filter((p) => p.speed > 0);
}

/**
 * A chained shot jumps from the troop it hit to the nearest other enemy
 * troop within reach (never a tower, never one already hit), hitting and
 * stunning each in turn, up to its count.
 */
function jump(m: Match, p: Projectile, first: Unit | Tower) {
  const hit = new Set<number>([first.id]);
  let from: Body = first;
  for (let n = 0; n < p.chain; n++) {
    let best: Unit | undefined;
    let bestD = Infinity;
    for (const e of m.units) {
      if (e.side === p.side || e.hp <= 0 || hit.has(e.id)) continue;
      if (e.state === 'deploying') continue;
      if (
        buildingEntry(
          m,
          from.x,
          from.y,
          e.x - from.x,
          e.y - from.y,
          0,
          'kind' in from ? (from as Tower) : undefined,
        )
      )
        continue;
      const d = dist(e.x - from.x, e.y - from.y) - unitStats(e).radius;
      if (d <= p.chainRange && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return;
    hit.add(best.id);
    damage(m, best, p.damage, p.side);
    stun(m, best, p.stun);
    m.events.push({
      type: 'impact',
      kind: p.kind,
      x: best.x,
      y: best.y,
      splash: 0,
      fx: from.x,
      fy: from.y,
    });
    from = best;
  }
}

/** Fallen troops leave the field; a Balloon crashes onto what is below. */
function sweepDead(m: Match) {
  const gone = new Set<number>();
  for (let again = true; again;) {
    again = false;
    for (const u of m.units) {
      if (u.hp > 0 || gone.has(u.id)) continue;
      gone.add(u.id);
      again = true;
      m.events.push({
        type: 'death',
        id: u.id,
        card: u.card,
        side: u.side,
        x: u.x,
        y: u.y,
      });
      const blast = unitStats(u).deathBlast;
      if (blast) {
        splashAt(m, u.side, u.x, u.y, blast.radius, blast.damage, false, true);
        m.events.push({
          type: 'impact',
          kind: 'crash',
          x: u.x,
          y: u.y,
          splash: blast.radius,
        });
      }
    }
  }
  if (gone.size) m.units = m.units.filter((u) => u.hp > 0);
}

function lowestTower(m: Match, side: Side) {
  return Math.min(
    ...m.towers.filter((t) => t.side === side && !t.destroyed).map((t) => t.hp),
    Infinity,
  );
}

function finish(m: Match, winner: Side | 'draw') {
  m.phase = 'over';
  m.winner = winner;
  m.projectiles = [];
  m.spells = [];
  m.events.push({ type: 'phase', phase: 'over' });
}

function checkEnd(m: Match, crownsBefore: [number, number]) {
  const [a, b] = m.crowns;
  if (a === 3 || b === 3) return finish(m, a === 3 ? 0 : 1);
  if (
    m.phase === 'overtime' &&
    (a !== crownsBefore[0] || b !== crownsBefore[1])
  )
    return finish(m, a > b ? 0 : 1);
  if (m.phase === 'battle' && m.time >= m.regulation) {
    if (a !== b) return finish(m, a > b ? 0 : 1);
    m.phase = 'overtime';
    m.events.push({ type: 'phase', phase: 'overtime' });
    return;
  }
  if (m.phase === 'overtime' && m.time >= m.regulation + OVERTIME) {
    if (a !== b) return finish(m, a > b ? 0 : 1);
    // Still level: the side whose weakest tower is lower loses.
    const mine = lowestTower(m, 0);
    const theirs = lowestTower(m, 1);
    finish(m, mine === theirs ? 'draw' : mine > theirs ? 0 : 1);
  }
}

/** Restore fields absent from older snapshots without rescaling live health
 *  or shield points. Version 7 also gives the long Dino a side-facing hull. */
export function upgradeMatch(m: Match) {
  const legacy = m.version !== ARENA_MATCH_VERSION;
  m.version = ARENA_MATCH_VERSION;
  for (const u of m.units) {
    if (u.maxShield === undefined) {
      const boost = m.players[u.owner]?.boost;
      // Version 5 stored only the remaining shield. Infer the new capacity
      // from the owner's saved boosts, while retaining any larger old pool.
      u.maxShield = Math.max(
        u.shield,
        Math.round(
          (troopCards[u.card].unit.shield ?? 0) *
            levelScale(boost, u.card) *
            (boost?.troopHp ?? 1),
        ),
      );
    }
    u.shieldDelay ??= u.maxShield > 0 ? SHIELD_DELAY : 0;
    u.detour ??= null;
    if (u.card === 'ogre' && !u.bodyDirection) {
      u.bodyDirection = [...unitBodyDirection(u)];
      u.facing = u.side === 0 ? 0 : Math.PI;
      clearBuildings(m, u);
      if (legacy) {
        u.px = u.x;
        u.py = u.y;
      }
    }
  }
}

/** Advances the match by one fixed tick. */
export function step(m: Match) {
  upgradeMatch(m);
  if (m.phase === 'over') return;
  m.tick++;
  m.time += TICK;
  if (m.phase === 'ready') {
    if (m.time >= 0) {
      m.time = 0;
      m.phase = 'battle';
      m.events.push({ type: 'phase', phase: 'battle' });
    }
    return;
  }
  const rate = elixirMultiplier(m) / ELIXIR_SECONDS;
  for (const p of m.players)
    p.elixir = Math.min(
      MAX_ELIXIR,
      p.elixir + rate * (p.boost.elixirRate ?? 1) * TICK,
    );
  const crownsBefore: [number, number] = [m.crowns[0], m.crowns[1]];
  stepUnits(m);
  // After the troops move, so a knock-back is drawn over the step and the
  // separation pass settles it.
  stepSpells(m);
  separate(m);
  stepTowers(m);
  stepProjectiles(m);
  sweepDead(m);
  checkEnd(m, crownsBefore);
}

/** Runs whole ticks for `seconds` of real time; returns leftover seconds. */
export function advance(m: Match, seconds: number) {
  let left = seconds;
  while (left >= TICK && m.phase !== 'over') {
    step(m);
    left -= TICK;
  }
  return left;
}

export const standingTowers = (m: Match, side: Side) =>
  m.towers.filter((t) => t.side === side && !t.destroyed);

/** Elixir each side has spent, for the results. */
export const spentBy = (m: Match, side: Side) =>
  m.players.reduce((sum, p) => sum + (p.side === side ? p.spent : 0), 0);
