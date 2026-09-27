import {
  cards,
  deck,
  isSpell,
  troopCards,
  type CardId,
  type ProjectileKind,
  type SpellId,
  type TroopId,
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
export const READY = 2;
export const DEPLOY_TIME = 1;
export const START_ELIXIR = 5;
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
  /** Radians, 0 facing +y (towards the bot). */
  facing: number;
  /** Seconds since the last hit landed, for the swing animation. */
  sinceHit: number;
  /** The lane it walks: the side of the field its card was dropped on
   *  (0 left, 1 right, as field x). Shoves, formations and walking round a
   *  tower never change it; only chasing a troop across the middle does. */
  lane: 0 | 1;
  bridge: number;
};

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
export type ImpactKind = ProjectileKind | SpellId;

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
  | { type: 'hit'; id: number; x: number; y: number; damage: number }
  | { type: 'swing'; id: number }
  | { type: 'shot'; id: number; kind: ProjectileKind }
  | {
      type: 'impact';
      kind: ImpactKind;
      x: number;
      y: number;
      splash: number;
    }
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

export type Player = {
  side: Side;
  elixir: number;
  hand: Hand;
  /** Elixir spent, for the results. */
  spent: number;
};

export type Match = {
  version: 4;
  mode: Mode;
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

export const seatCount = (mode: Mode) => (mode === 'team' ? 4 : 2);
export const sideOf = (player: number): Side => (player % 2) as Side;

export function createMatch(
  seed: number,
  difficulty: Difficulty = 'medium',
  mode: Mode = 'duel',
) {
  const m: Match = {
    version: 4,
    mode,
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
    const order = shuffled(m, deck);
    m.players.push({
      side: sideOf(i),
      elixir: START_ELIXIR,
      hand: { cards: order.slice(0, 4), queue: order.slice(4) },
      spent: 0,
    });
  }
  const hp = mode === 'team' ? TEAM_TOWER_HP : 1;
  const hit = mode === 'team' ? TEAM_TOWER_DAMAGE : 1;
  for (const side of [0, 1] as Side[]) {
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
        active: t.kind === 'princess',
        destroyed: false,
      });
    }
  }
  return m;
}

export const elixirMultiplier = (m: Match) =>
  m.phase === 'overtime'
    ? 2.5
    : m.phase === 'battle' && m.time >= DOUBLE_FROM
      ? 2
      : 1;

/** Seconds left on the clock: regulation first, then overtime. */
export function clock(m: Match) {
  if (m.phase === 'ready') return REGULATION;
  if (m.phase === 'overtime')
    return Math.max(0, REGULATION + OVERTIME - m.time);
  if (m.phase === 'over') return 0;
  return Math.max(0, REGULATION - m.time);
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

/** Whether a side may drop a troop at (x, y) right now. */
export function canDeployAt(m: Match, side: Side, x: number, y: number) {
  if (!onField(x, y)) return false;
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
  return !m.towers.some(
    (t) => !t.destroyed && dist(x - t.x, y - t.y) < t.radius + 0.2,
  );
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
  return isSpell(card) ? onField(x, y) : canDeployAt(m, side, x, y);
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
    if (s.targets === 'buildings') continue;
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
  if (card.kind === 'spell') {
    const s = card.spell;
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
      damage: s.damage,
      towerDamage: s.towerDamage,
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
  for (const [ox, oy] of card.formation) {
    const ux = clamp(x + ox * dir, card.unit.radius, WIDTH - card.unit.radius);
    const uy = clamp(y + oy * dir, card.unit.radius, LENGTH - card.unit.radius);
    const u: Unit = {
      id: m.nextId++,
      side,
      owner: player,
      card: card.id,
      x: ux,
      y: uy,
      px: ux,
      py: uy,
      hp: card.unit.hp,
      maxHp: card.unit.hp,
      state: 'deploying',
      deployLeft: DEPLOY_TIME,
      targetId: null,
      attackTimer: card.unit.firstHit,
      facing: side === 0 ? 0 : Math.PI,
      sinceHit: 99,
      lane,
      bridge: -1,
    };
    m.units.push(u);
    ids.push(u.id);
  }
  return { ok: true, ids };
}

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

type Body = { x: number; y: number };
export const unitStats = (u: Unit) => troopCards[u.card].unit;

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
  const current = findById(m, u.targetId);
  // Once swinging, a troop stays on its target while it can reach it.
  if (current && u.state === 'attacking' && edge(u, current) <= s.range + 0.1)
    return current;
  let best: Unit | Tower | undefined;
  let bestD = Infinity;
  if (s.targets !== 'buildings') {
    for (const e of m.units) {
      if (e.side === u.side || e.hp <= 0 || e.state === 'deploying') continue;
      if (!canTarget(s.targets, e)) continue;
      const d = edge(u, e);
      if (d <= s.sight && d < bestD) {
        bestD = d;
        best = e;
      }
    }
  }
  for (const t of m.towers) {
    if (t.side === u.side || t.destroyed) continue;
    const d = edge(u, t);
    if (d <= s.sight && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ?? laneTower(m, u);
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
 * step against `separate`'s push-out for good). The keep-off circle is the
 * one `separate` enforces. It turns to the side its goal lies on; dead ahead
 * it passes on the side facing the middle of the field, then towards the
 * river. The tower it is walking to is left alone: it stops in range.
 */
function skirt(
  m: Match,
  u: Unit,
  target: Unit | Tower,
  vx: number,
  vy: number,
  step: number,
): [number, number] {
  const s = unitStats(u);
  if (s.flying) return [vx, vy];
  for (const t of m.towers) {
    if (t.destroyed || t === target) continue;
    const min = t.radius + s.radius * 0.8;
    const ox = u.x - t.x;
    const oy = u.y - t.y;
    const qx = ox + vx * step;
    const qy = oy + vy * step;
    if (qx * qx + qy * qy >= min * min) continue;
    const o = dist(ox, oy);
    if (o < 0.001) continue;
    const nx = ox / o;
    const ny = oy / o;
    const into = vx * nx + vy * ny;
    if (into >= 0) continue;
    // What is left of the step once the part into the tower is taken out.
    let tx = vx - into * nx;
    let ty = vy - into * ny;
    let tl = dist(tx, ty);
    if (tl < 1e-9) {
      tx = -ny;
      ty = nx;
      const inward = tx * (WIDTH / 2 - t.x);
      const forward = ty * (MID - u.y);
      if ((inward !== 0 ? inward : forward !== 0 ? forward : tx) < 0) {
        tx = -tx;
        ty = -ty;
      }
      tl = 1;
    }
    vx = tx / tl;
    vy = ty / tl;
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
    }
    return;
  }
  if (target.hp <= 0) return;
  target.hp -= amount;
  m.events.push({
    type: 'hit',
    id: target.id,
    x: target.x,
    y: target.y,
    damage: amount,
  });
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
) {
  for (const e of m.units) {
    if (e.side === side || e.hp <= 0) continue;
    const f = unitStats(e).flying;
    if ((f && !air) || (!f && !ground)) continue;
    if (dist(e.x - x, e.y - y) <= radius + unitStats(e).radius)
      damage(m, e, amount, side);
  }
  for (const t of m.towers) {
    if (t.side === side || t.destroyed || !ground) continue;
    if (dist(t.x - x, t.y - y) <= radius + t.radius) damage(m, t, amount, side);
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
    air: kind !== 'cannon',
    travelled: 0,
    distance: Math.max(0.01, d),
  });
  m.events.push({ type: 'shot', id: sourceId, kind });
}

function stepUnits(m: Match) {
  for (const u of m.units) {
    u.px = u.x;
    u.py = u.y;
    if (u.hp <= 0) continue;
    const s = unitStats(u);
    u.sinceHit += TICK;
    if (u.state === 'deploying') {
      u.deployLeft -= TICK;
      if (u.deployLeft <= 0) u.state = 'walking';
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
      if (u.state === 'attacking') u.state = 'walking';
    }
    const reach = edge(u, target);
    if (reach <= s.range) {
      u.state = 'attacking';
      u.facing = Math.atan2(target.x - u.x, target.y - u.y);
      u.attackTimer -= TICK;
      if (u.attackTimer <= 0) {
        u.attackTimer += s.hitSpeed;
        u.sinceHit = 0;
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
            s.damage,
            s.splash ?? 0,
          );
        } else {
          m.events.push({ type: 'swing', id: u.id });
          if (s.splash)
            splashAt(
              m,
              u.side,
              target.x,
              target.y,
              s.splash,
              s.damage,
              true,
              true,
            );
          else damage(m, target, s.damage, u.side);
        }
      }
      continue;
    }
    u.state = 'walking';
    u.attackTimer = s.firstHit;
    const [wx, wy] = steer(u, target.x, target.y, isTower(target));
    const dx = wx - u.x;
    const dy = wy - u.y;
    const d = dist(dx, dy);
    if (d > 0.001) {
      const step = Math.min(d, s.speed * TICK);
      const [vx, vy] = skirt(m, u, target, dx / d, dy / d, step);
      u.x += vx * step;
      u.y += vy * step;
      // Turn smoothly towards the direction of travel.
      const want = Math.atan2(vx, vy);
      let turn = want - u.facing;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      u.facing += turn * Math.min(1, TICK * 10);
    }
  }
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
      a.x -= nx * push * 2 * wa;
      a.y -= ny * push * 2 * wa;
      b.x += nx * push * 2 * wb;
      b.y += ny * push * 2 * wb;
    }
  }
  for (const u of live) {
    const s = unitStats(u);
    if (!s.flying) {
      for (const t of m.towers) {
        if (t.destroyed) continue;
        const dx = u.x - t.x;
        const dy = u.y - t.y;
        const d = dist(dx, dy) || 0.001;
        const min = t.radius + s.radius * 0.8;
        if (d < min) {
          u.x = t.x + (dx / d) * min;
          u.y = t.y + (dy / d) * min;
        }
      }
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
    const y0 = e.y;
    e.x += nx * s.knockback;
    e.y += ny * s.knockback;
    // A ground troop shoved along a bridge stops at its middle.
    const crossed = y0 < MID ? e.y >= MID : e.y < MID;
    if (!st.flying && crossed) e.y = y0 < MID ? MID - 0.001 : MID + 0.001;
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
    if (d <= step) {
      p.x = p.tx;
      p.y = p.ty;
      p.travelled = p.distance;
      p.speed = 0;
      if (p.splash > 0)
        splashAt(m, p.side, p.x, p.y, p.splash, p.damage, p.air, true);
      else if (target) damage(m, target, p.damage, p.side);
      m.events.push({
        type: 'impact',
        kind: p.kind,
        x: p.x,
        y: p.y,
        splash: p.splash,
      });
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    p.travelled += step;
  }
  if (m.projectiles.some((p) => p.speed <= 0))
    m.projectiles = m.projectiles.filter((p) => p.speed > 0);
}

function sweepDead(m: Match) {
  for (const u of m.units)
    if (u.hp <= 0)
      m.events.push({
        type: 'death',
        id: u.id,
        card: u.card,
        side: u.side,
        x: u.x,
        y: u.y,
      });
  if (m.units.some((u) => u.hp <= 0)) m.units = m.units.filter((u) => u.hp > 0);
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
  if (m.phase === 'battle' && m.time >= REGULATION) {
    if (a !== b) return finish(m, a > b ? 0 : 1);
    m.phase = 'overtime';
    m.events.push({ type: 'phase', phase: 'overtime' });
    return;
  }
  if (m.phase === 'overtime' && m.time >= REGULATION + OVERTIME) {
    if (a !== b) return finish(m, a > b ? 0 : 1);
    // Still level: the side whose weakest tower is lower loses.
    const mine = lowestTower(m, 0);
    const theirs = lowestTower(m, 1);
    finish(m, mine === theirs ? 'draw' : mine > theirs ? 0 : 1);
  }
}

/** Advances the match by one fixed tick. */
export function step(m: Match) {
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
    p.elixir = Math.min(MAX_ELIXIR, p.elixir + rate * TICK);
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
