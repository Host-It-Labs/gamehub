import {
  coop,
  dishes,
  HATS,
  MIMIC_BOUNTY,
  nights,
  OUTFIT,
  PRICE,
  SHIRTS,
  SKINS,
  HAIRS,
  STARS,
  stationDish,
  TIP,
  type CounterId,
  type DishId,
  type Look,
  type NightId,
  type StationId,
} from './content.ts';
import {
  boothHz,
  COUNTER_X,
  DOOR_IN,
  DOOR_OUT,
  obstacles,
  PLAYER_R,
  QUEUE,
  queueSpot,
  rectDistance,
  boothRect,
  route,
  seatOffset,
  slide,
  SPAWNS,
  spotDistance,
  TABLES,
} from './layout.ts';

/**
 * Diner's rules as a pure simulation: a fixed step of 1/30 s, a seeded
 * random number generator kept in the state, plain data only. The same
 * seed and the same inputs always give the same shift, so the server can
 * run it for a table and the tests can replay it.
 */
export const HZ = 30;
export const TICK = 1 / HZ;
export const SHIFT = 180;
const SHIFT_TICKS = SHIFT * HZ;
/** No new party in the last seconds of a shift. */
const LAST_CALL = 22;
export const SPEED = 4.2;
/** Crossing goo slows you to this share of your speed. */
export const GOO_SLOW = 0.45;
const GUEST_SPEED = 2.5;
const STORM_SPEED = 3.6;
const GOO_SPEED = 5.2;
const READ_TICKS = Math.round(2.4 * HZ);
const EAT_TICKS = 6 * HZ;
const MOP_TICKS = Math.round(1.5 * HZ);
const COUNTDOWN_TICKS = 3 * HZ;
/** How far you reach: counter spots, booths, a waiting party, the queue. */
const REACH_SPOT = 0.82;
const REACH_TABLE = 0.66;
const REACH_GUEST = 0.9;
const REACH_OUT = 1.55;
const TRAIL = 48;

export type Input = {
  /** Where the stick or keys point, -1 to 1 on each axis (x right, z down). */
  mx: number;
  mz: number;
  /** Pressed on this tick. */
  use: boolean;
  out: boolean;
};
export const idle: Input = { mx: 0, mz: 0, use: false, out: false };

/** Stick values travel as sixteenths so every device moves the same. */
export function quantize(mx: number, mz: number): [number, number] {
  let x = Math.max(-1, Math.min(1, Number.isFinite(mx) ? mx : 0));
  let z = Math.max(-1, Math.min(1, Number.isFinite(mz) ? mz : 0));
  const len = Math.sqrt(x * x + z * z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return [Math.round(x * 16) / 16, Math.round(z * 16) / 16];
}

export type Carry =
  | { k: 'dish'; dish: DishId; burnt: boolean }
  | { k: 'dirty'; n: number }
  | { k: 'lead'; group: number }
  | null;

export type Player = {
  name: string;
  x: number;
  z: number;
  px: number;
  pz: number;
  /** Facing, a unit vector. */
  fx: number;
  fz: number;
  /** Moving this tick (for the walk). */
  moving: boolean;
  carry: Carry;
  /** Ticks of mopping left, and the puddle being mopped. */
  mop: number;
  mopping: number;
  /** Recent positions, newest last, as x, z pairs: the party follows them. */
  trail: number[];
  /** The last input step applied (online, for your own device's prediction). */
  seq: number;
};

export type GuestState = 'walk' | 'wait' | 'follow' | 'sit' | 'goo' | 'gone';
export type Guest = {
  id: number;
  group: number;
  look: Look;
  mimic: boolean;
  x: number;
  z: number;
  px: number;
  pz: number;
  fx: number;
  fz: number;
  state: GuestState;
  path: [number, number][];
  speed: number;
  /** Seat at the table, or -1. */
  seat: number;
  dish: DishId | null;
  served: boolean;
};

export type GroupState =
  | 'arrive'
  | 'queue'
  | 'follow'
  | 'read'
  | 'order'
  | 'food'
  | 'eat'
  | 'leave';
export type Group = {
  id: number;
  state: GroupState;
  /** Ticks in this state. */
  t: number;
  /** 1 full, 0 gone. */
  patience: number;
  /** Queue spot while waiting (kept while following), else -1. */
  slot: number;
  table: number;
  leader: number;
  guests: number[];
  /** Left in a huff. */
  angry: boolean;
  /** Warned that patience is low. */
  low: boolean;
};

export type Table = {
  slot: number;
  x: number;
  z: number;
  seats: 2 | 4;
  group: number;
  dirty: boolean;
  coins: number;
  plates: number;
};

export type StationState = 'idle' | 'cook' | 'ready' | 'burnt';
export type Station = {
  id: StationId;
  state: StationState;
  /** Ticks left cooking, or ticks since ready. */
  t: number;
};

export type Puddle = { id: number; x: number; z: number; r: number };

export type DinerEvent =
  | { type: 'arrive'; group: number }
  | { type: 'lead'; group: number; player: number }
  | { type: 'return'; group: number; player: number }
  | { type: 'seat'; group: number; table: number; player: number }
  | { type: 'bell'; table: number }
  | { type: 'order'; table: number; player: number }
  | { type: 'cook'; station: StationId; player: number }
  | { type: 'ready'; station: StationId }
  | { type: 'smoke'; station: StationId }
  | { type: 'burnt'; station: StationId }
  | {
      type: 'take';
      station: StationId;
      player: number;
      dish: DishId;
      burnt: boolean;
    }
  | {
      type: 'serve';
      table: number;
      player: number;
      dish: DishId;
      guest: number;
    }
  | { type: 'eat'; table: number }
  | { type: 'pay'; table: number; coins: number }
  | { type: 'clear'; table: number; player: number; coins: number }
  | { type: 'wash'; player: number }
  | { type: 'bin'; player: number }
  | { type: 'impatient'; group: number }
  | { type: 'storm'; group: number; x: number; z: number }
  | { type: 'star'; stars: number }
  | {
      type: 'reveal';
      guest: number;
      player: number;
      x: number;
      z: number;
      coins: number;
    }
  | { type: 'wrong'; guest: number; player: number }
  | { type: 'burst'; guest: number; table: number; x: number; z: number }
  | { type: 'puddle'; puddle: number }
  | { type: 'mop'; player: number; puddle: number }
  | { type: 'mopped'; puddle: number }
  | { type: 'deny'; player: number }
  | { type: 'open' }
  | { type: 'end'; medals: number };

export type Stats = {
  guests: number;
  served: number;
  caught: number;
  wrong: number;
  stormed: number;
  burst: number;
  burnt: number;
};

export type Match = {
  v: 1;
  night: NightId;
  seed: number;
  rng: number;
  tick: number;
  phase: 'ready' | 'open' | 'over';
  /** Ticks left in the countdown before opening (0: none running). */
  countdown: number;
  players: Player[];
  guests: Guest[];
  groups: Group[];
  tables: Table[];
  stations: Station[];
  puddles: Puddle[];
  coins: number;
  stars: number;
  /** Coins for one, two and three medals with this many waiters. */
  targets: [number, number, number];
  /** Tick of the next arrival. */
  next: number;
  /** A mimic has come in already tonight. */
  mimicSeen: boolean;
  nextId: number;
  stats: Stats;
  medals: number;
  events: DinerEvent[];
};

// ---------------------------------------------------------------- random

function rand(m: Match) {
  m.rng = (m.rng + 0x6d2b79f5) | 0;
  let t = m.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(m: Match, list: readonly T[]) =>
  list[Math.floor(rand(m) * list.length)];
function weighted<T extends string | number>(
  m: Match,
  odds: Partial<Record<T, number>> | number[],
): T {
  const entries = Array.isArray(odds)
    ? odds.map((w, i) => [i, w] as [T, number])
    : (Object.entries(odds) as [T, number][]);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand(m) * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return Array.isArray(odds) ? (Number(k) as T) : k;
  }
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------- setup

/** Tables open with this many waiters: three or four waiters get one more. */
export function tableSlots(night: NightId, players: number) {
  const open = [...nights[night].tables];
  if (players >= 3)
    for (const i of [2, 4])
      if (!open.includes(i)) {
        open.push(i);
        break;
      }
  return open.sort((a, b) => a - b);
}

export function createMatch(
  seed: number,
  night: NightId = 1,
  names: string[] = ['You'],
): Match {
  const n = Math.max(1, Math.min(4, names.length));
  const scale = coop(n).targets;
  const spec = nights[night];
  const m: Match = {
    v: 1,
    night,
    seed: seed >>> 0,
    rng: seed | 0,
    tick: 0,
    phase: 'ready',
    countdown: 0,
    players: names.slice(0, n).map((name, i) => ({
      name,
      x: SPAWNS[i][0],
      z: SPAWNS[i][1],
      px: SPAWNS[i][0],
      pz: SPAWNS[i][1],
      fx: 0,
      fz: 1,
      moving: false,
      carry: null,
      mop: 0,
      mopping: -1,
      trail: [],
      seq: 0,
    })),
    guests: [],
    groups: [],
    tables: tableSlots(night, n).map((slot) => ({
      slot,
      x: TABLES[slot].x,
      z: TABLES[slot].z,
      seats: TABLES[slot].seats,
      group: -1,
      dirty: false,
      coins: 0,
      plates: 0,
    })),
    stations: spec.stations.map((id) => ({ id, state: 'idle', t: 0 })),
    puddles: [],
    coins: 0,
    stars: STARS,
    targets: spec.targets.map((t) => Math.round((t * scale) / 5) * 5) as [
      number,
      number,
      number,
    ],
    next: HZ,
    mimicSeen: false,
    nextId: 1,
    stats: {
      guests: 0,
      served: 0,
      caught: 0,
      wrong: 0,
      stormed: 0,
      burst: 0,
      burnt: 0,
    },
    medals: 0,
    events: [],
  };
  return m;
}

/** Opens the doors now (solo), or after a short countdown (online). */
export function open(m: Match, countdown = false) {
  if (m.phase !== 'ready') return;
  if (countdown) {
    if (!m.countdown) m.countdown = COUNTDOWN_TICKS;
    return;
  }
  m.phase = 'open';
  m.countdown = 0;
  m.events.push({ type: 'open' });
}

/** Seconds left in the shift. */
export const clock = (m: Match) => Math.max(0, (SHIFT_TICKS - m.tick) / HZ);
export const playing = (m: Match) => m.phase === 'open';

export function medalsFor(m: Match) {
  if (m.stars <= 0) return 0;
  return m.targets.filter((t) => m.coins >= t).length;
}

// ---------------------------------------------------------------- lookups

const tableAt = (m: Match, slot: number) =>
  m.tables.find((t) => t.slot === slot);
const groupById = (m: Match, id: number) => m.groups.find((g) => g.id === id);
const guestById = (m: Match, id: number) => m.guests.find((g) => g.id === id);
export const membersOf = (m: Match, g: Group) =>
  g.guests.map((id) => guestById(m, id)).filter((x): x is Guest => !!x);
const stationById = (m: Match, id: StationId) =>
  m.stations.find((s) => s.id === id);
const hasCounter = (m: Match, id: CounterId) =>
  id === 'sink' || id === 'bin' || !!stationById(m, id);

/** Patience drain per tick in a state (0: none). */
function drain(m: Match, state: GroupState) {
  const p = nights[m.night].patience;
  const secs =
    state === 'queue' || state === 'arrive'
      ? p.queue
      : state === 'order'
        ? p.order
        : state === 'food'
          ? p.food
          : 0;
  return secs ? 1 / (secs * HZ) : 0;
}

// ---------------------------------------------------------------- actions

export type UseKind =
  | 'lead'
  | 'return'
  | 'seat'
  | 'order'
  | 'serve'
  | 'clear'
  | 'cook'
  | 'take'
  | 'wash'
  | 'bin'
  | 'mop';
export type UseAction = {
  kind: UseKind;
  group?: number;
  table?: number;
  counter?: CounterId;
  puddle?: number;
  /** The dish involved: cooked, taken or served. */
  dish?: DishId;
};

const facing = (p: Player, x: number, z: number) => {
  const dx = x - p.x,
    dz = z - p.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  return d < 1e-6 ? 1 : (dx * p.fx + dz * p.fz) / d;
};

/** What Use would do now for a player, or null. */
export function actionFor(m: Match, pi: number): UseAction | null {
  const p = m.players[pi];
  if (!p || m.phase !== 'open' || p.mop > 0) return null;
  let best = null as UseAction | null;
  let score = Infinity;
  const offer = (a: UseAction, d: number, x: number, z: number) => {
    const s = d - 0.35 * facing(p, x, z);
    if (s < score) {
      score = s;
      best = a;
    }
  };
  const carry = p.carry;
  // Counter spots.
  for (const id of Object.keys(COUNTER_X) as CounterId[]) {
    if (!hasCounter(m, id)) continue;
    const d = spotDistance(p.x, p.z, id);
    if (d > REACH_SPOT) continue;
    const at: [number, number] = [COUNTER_X[id], 1.2];
    if (id === 'sink') {
      if (carry?.k === 'dirty') offer({ kind: 'wash', counter: id }, d, ...at);
      continue;
    }
    if (id === 'bin') {
      if (carry?.k === 'dish')
        offer({ kind: 'bin', counter: id, dish: carry.dish }, d, ...at);
      continue;
    }
    const s = stationById(m, id)!;
    const dish = stationDish[id];
    if (s.state === 'ready' || s.state === 'burnt') {
      if (!carry) offer({ kind: 'take', counter: id, dish }, d, ...at);
    } else if (s.state === 'idle') {
      if (dishes[dish].cook === 0) {
        if (!carry) offer({ kind: 'take', counter: id, dish }, d, ...at);
      } else offer({ kind: 'cook', counter: id, dish }, d + 0.05, ...at);
    }
  }
  // Booths.
  for (const t of m.tables) {
    const d = rectDistance(p.x, p.z, boothRect(t));
    if (d > REACH_TABLE) continue;
    const g = t.group >= 0 ? groupById(m, t.group) : undefined;
    if (carry?.k === 'lead') {
      const lead = groupById(m, carry.group);
      if (lead && t.group < 0 && !t.dirty && t.seats >= lead.guests.length)
        offer({ kind: 'seat', table: t.slot, group: lead.id }, d, t.x, t.z);
      continue;
    }
    if (g?.state === 'order')
      offer({ kind: 'order', table: t.slot, group: g.id }, d, t.x, t.z);
    else if (g?.state === 'food' && carry?.k === 'dish' && !carry.burnt) {
      const wants = membersOf(m, g).some(
        (x) => x.dish === carry.dish && !x.served,
      );
      if (wants)
        offer(
          { kind: 'serve', table: t.slot, group: g.id, dish: carry.dish },
          d,
          t.x,
          t.z,
        );
    } else if (t.dirty && t.group < 0 && !carry)
      offer({ kind: 'clear', table: t.slot }, d, t.x, t.z);
  }
  // Waiting parties, and taking a led party back to its spot.
  for (const g of m.groups) {
    if (g.state === 'queue' && !carry) {
      for (const x of membersOf(m, g)) {
        const d = Math.hypot(x.x - p.x, x.z - p.z) - 0.1;
        if (d <= REACH_GUEST) offer({ kind: 'lead', group: g.id }, d, x.x, x.z);
      }
    }
    if (
      g.state === 'follow' &&
      carry?.k === 'lead' &&
      carry.group === g.id &&
      g.slot >= 0
    ) {
      const q = QUEUE[g.slot];
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d <= 1.25) offer({ kind: 'return', group: g.id }, d + 0.3, q.x, q.z);
    }
  }
  if (best) return best;
  const puddle = m.puddles.find(
    (u) => Math.hypot(u.x - p.x, u.z - p.z) < u.r + 0.15,
  );
  return puddle ? { kind: 'mop', puddle: puddle.id } : null;
}

/** Nights without mimics (Night 1) have no Out! at all. */
export const hasMimics = (m: Match) => nights[m.night].mimics > 0;

/** The guest Out! would throw out now: the nearest one in front of you. */
export function outTarget(m: Match, pi: number): number | null {
  const p = m.players[pi];
  if (!p || m.phase !== 'open' || p.mop > 0 || !hasMimics(m)) return null;
  let best: number | null = null;
  let score = Infinity;
  for (const g of m.groups) {
    if (g.state === 'arrive' || g.state === 'leave') continue;
    for (const x of membersOf(m, g)) {
      if (x.state === 'goo' || x.state === 'gone') continue;
      const d = Math.hypot(x.x - p.x, x.z - p.z);
      if (d > REACH_OUT) continue;
      const f = facing(p, x.x, x.z);
      if (d > 0.7 && f < 0.25) continue;
      const s = d - 0.6 * f;
      if (s < score) {
        score = s;
        best = x.id;
      }
    }
  }
  return best;
}

function walk(x: Guest, points: [number, number][], speed = GUEST_SPEED) {
  x.path = points;
  x.speed = speed;
  if (x.state !== 'goo') x.state = 'walk';
}

function seatGuests(m: Match, g: Group, t: Table) {
  const hz = boothHz(t.seats);
  const open = t.seats === 4 ? [0, 1, 2, 3] : [0, 1];
  membersOf(m, g).forEach((x, i) => {
    x.seat = open[i];
    const [ox, oz] = seatOffset(t.seats, x.seat);
    const enter: [number, number] = [t.x + ox, t.z + hz + 0.3];
    walk(x, [
      ...route(
        m.tables.map((s) => s.slot),
        [x.x, x.z],
        enter,
      ),
      [t.x + ox, t.z + oz],
    ]);
  });
}

function leaveDiner(m: Match, x: Guest, speed: number, t?: Table) {
  const slots = m.tables.map((s) => s.slot);
  const start: [number, number] = [x.x, x.z];
  const legs: [number, number][] = [];
  if (x.seat >= 0) {
    t ??= m.tables.find((s) => s.group === x.group);
    if (t) {
      const [ox] = seatOffset(t.seats, x.seat);
      const out: [number, number] = [t.x + ox, t.z + boothHz(t.seats) + 0.3];
      legs.push(out);
      start[0] = out[0];
      start[1] = out[1];
    }
  }
  legs.push(...route(slots, start, [DOOR_IN.x, DOOR_IN.z]), [
    DOOR_OUT.x,
    DOOR_OUT.z + (x.id % 3) * 0.15 - 0.15,
  ]);
  x.seat = -1;
  walk(x, legs, speed);
}

function loseStar(m: Match) {
  m.stars = Math.max(0, m.stars - 1);
  m.events.push({ type: 'star', stars: m.stars });
}

/** A party walks out in a huff: a star goes with them. */
function storm(m: Match, g: Group) {
  if (g.state === 'leave') return;
  const members = membersOf(m, g);
  const cx = members.reduce((s, x) => s + x.x, 0) / Math.max(1, members.length);
  const cz = members.reduce((s, x) => s + x.z, 0) / Math.max(1, members.length);
  m.events.push({ type: 'storm', group: g.id, x: cx, z: cz });
  m.stats.stormed++;
  loseStar(m);
  if (g.leader >= 0) {
    const p = m.players[g.leader];
    if (p?.carry?.k === 'lead' && p.carry.group === g.id) p.carry = null;
  }
  const t = g.table >= 0 ? tableAt(m, g.table) : undefined;
  if (t) {
    const plates = members.filter((x) => x.served).length;
    t.group = -1;
    t.dirty = plates > 0;
    t.plates = plates;
    t.coins = 0;
  }
  for (const x of members) {
    if (x.state === 'goo') continue;
    x.dish = null;
    leaveDiner(m, x, STORM_SPEED, t);
  }
  g.state = 'leave';
  g.angry = true;
  g.slot = -1;
  g.leader = -1;
  g.t = 0;
}

function maybeEat(m: Match, g: Group) {
  if (g.state !== 'food') return;
  const members = membersOf(m, g).filter((x) => x.state !== 'goo');
  if (members.length && members.every((x) => x.served)) {
    g.state = 'eat';
    g.t = 0;
    if (g.table >= 0) m.events.push({ type: 'eat', table: g.table });
  }
}

function doUse(m: Match, pi: number) {
  const p = m.players[pi];
  const a = actionFor(m, pi);
  if (!a) {
    m.events.push({ type: 'deny', player: pi });
    return;
  }
  switch (a.kind) {
    case 'lead': {
      const g = groupById(m, a.group!)!;
      g.state = 'follow';
      g.leader = pi;
      g.t = 0;
      p.carry = { k: 'lead', group: g.id };
      // The party lines up behind you, the trail starts here.
      p.trail = [];
      for (const x of membersOf(m, g)) {
        x.state = 'follow';
        x.path = [];
      }
      m.events.push({ type: 'lead', group: g.id, player: pi });
      break;
    }
    case 'return': {
      const g = groupById(m, a.group!)!;
      g.state = 'queue';
      g.leader = -1;
      p.carry = null;
      const members = membersOf(m, g);
      members.forEach((x, i) =>
        walk(x, [queueSpot(g.slot, i, members.length)]),
      );
      m.events.push({ type: 'return', group: g.id, player: pi });
      break;
    }
    case 'seat': {
      const g = groupById(m, a.group!)!;
      const t = tableAt(m, a.table!)!;
      g.state = 'read';
      g.t = 0;
      g.table = t.slot;
      g.slot = -1;
      g.leader = -1;
      g.patience = Math.min(1, g.patience + 0.2);
      t.group = g.id;
      p.carry = null;
      seatGuests(m, g, t);
      m.events.push({ type: 'seat', group: g.id, table: t.slot, player: pi });
      break;
    }
    case 'order': {
      const g = groupById(m, a.group!)!;
      const menu = nights[m.night].menu;
      for (const x of membersOf(m, g)) x.dish = weighted<DishId>(m, menu);
      g.state = 'food';
      g.t = 0;
      g.patience = Math.min(1, g.patience + 0.15);
      m.events.push({ type: 'order', table: a.table!, player: pi });
      break;
    }
    case 'serve': {
      const g = groupById(m, a.group!)!;
      const x = membersOf(m, g).find((y) => y.dish === a.dish && !y.served)!;
      x.served = true;
      p.carry = null;
      g.patience = Math.min(1, g.patience + 0.12);
      m.stats.served++;
      m.events.push({
        type: 'serve',
        table: a.table!,
        player: pi,
        dish: a.dish!,
        guest: x.id,
      });
      maybeEat(m, g);
      break;
    }
    case 'clear': {
      const t = tableAt(m, a.table!)!;
      m.coins += t.coins;
      m.events.push({
        type: 'clear',
        table: t.slot,
        player: pi,
        coins: t.coins,
      });
      p.carry = { k: 'dirty', n: Math.max(1, t.plates) };
      t.dirty = false;
      t.coins = 0;
      t.plates = 0;
      break;
    }
    case 'cook': {
      const s = stationById(m, a.counter as StationId)!;
      s.state = 'cook';
      s.t = Math.round(dishes[stationDish[s.id]].cook * HZ);
      m.events.push({ type: 'cook', station: s.id, player: pi });
      break;
    }
    case 'take': {
      const s = stationById(m, a.counter as StationId)!;
      const burnt = s.state === 'burnt';
      p.carry = { k: 'dish', dish: stationDish[s.id], burnt };
      s.state = 'idle';
      s.t = 0;
      m.events.push({
        type: 'take',
        station: s.id,
        player: pi,
        dish: stationDish[s.id],
        burnt,
      });
      break;
    }
    case 'wash':
      p.carry = null;
      m.events.push({ type: 'wash', player: pi });
      break;
    case 'bin':
      p.carry = null;
      m.events.push({ type: 'bin', player: pi });
      break;
    case 'mop':
      p.mop = MOP_TICKS;
      p.mopping = a.puddle!;
      m.events.push({ type: 'mop', player: pi, puddle: a.puddle! });
      break;
  }
}

function doOut(m: Match, pi: number) {
  if (!hasMimics(m)) return;
  const id = outTarget(m, pi);
  if (id === null) {
    m.events.push({ type: 'deny', player: pi });
    return;
  }
  const x = guestById(m, id)!;
  const g = groupById(m, x.group)!;
  if (!x.mimic) {
    m.stats.wrong++;
    m.events.push({ type: 'wrong', guest: x.id, player: pi });
    storm(m, g);
    return;
  }
  // Caught: the mimic pops back into goo and flees.
  m.stats.caught++;
  m.coins += MIMIC_BOUNTY;
  m.events.push({
    type: 'reveal',
    guest: x.id,
    player: pi,
    x: x.x,
    z: x.z,
    coins: MIMIC_BOUNTY,
  });
  g.guests = g.guests.filter((y) => y !== x.id);
  g.patience = 1;
  g.low = false;
  x.state = 'goo';
  x.dish = null;
  x.served = false;
  leaveDiner(m, x, GOO_SPEED);
  maybeEat(m, g);
}

// ---------------------------------------------------------------- arrivals

function dressParty(
  m: Match,
  size: number,
  mimic: boolean,
): { looks: Look[]; mimicAt: number } {
  const roll = rand(m);
  const hat = roll < 0.36 ? 'none' : pick(m, HATS.slice(1));
  const outfit = {
    hat,
    shirt: Math.floor(rand(m) * SHIRTS.length),
    stripes: rand(m) < 0.35,
    glasses: rand(m) < 0.3,
  };
  const looks: Look[] = Array.from({ length: size }, () => ({
    skin: Math.floor(rand(m) * SKINS.length),
    hair: Math.floor(rand(m) * HAIRS.length),
    ...outfit,
  }));
  if (!mimic) return { looks, mimicAt: -1 };
  const at = Math.floor(rand(m) * size);
  const part = pick(m, OUTFIT);
  const l = looks[at];
  if (part === 'hat')
    l.hat = pick(
      m,
      HATS.filter((h) => h !== l.hat),
    );
  else if (part === 'shirt') {
    const others = SHIRTS.map((_, i) => i).filter((i) => i !== l.shirt);
    l.shirt = pick(m, others);
  } else if (part === 'stripes') l.stripes = !l.stripes;
  else l.glasses = !l.glasses;
  return { looks, mimicAt: at };
}

function spawn(m: Match) {
  const spec = nights[m.night];
  const secs = m.tick / HZ;
  if (secs > SHIFT - LAST_CALL) return;
  const waiting = m.groups.filter((g) => g.slot >= 0).length;
  if (waiting >= QUEUE.length) return;
  let size = weighted<number>(m, spec.sizes) + 1;
  let mimic = false;
  if (secs >= spec.firstMimic) {
    if (!m.mimicSeen) {
      // The first mimic of the night comes alone, to a quiet door (or a
      // little later, if the door never goes quiet).
      if (waiting === 0 || secs >= spec.firstMimic + 25) {
        size = Math.max(3, size);
        mimic = true;
      }
    } else if (size >= 3) mimic = rand(m) < spec.mimics;
  }
  spawnParty(m, size, mimic);
  const [lo, hi] = spec.interval;
  const pace = coop(m.players.length).pace;
  m.next = m.tick + Math.round(((lo + rand(m) * (hi - lo)) * HZ) / pace);
}

/**
 * A party of `size` comes in and walks to the free queue spot nearest the
 * door; `mimic` hides one in it (parties of three or four only). Returns
 * the party, or null when the line is full.
 */
export function spawnParty(m: Match, size: number, mimic = false) {
  const taken = new Set(m.groups.filter((g) => g.slot >= 0).map((g) => g.slot));
  const slot = QUEUE.findIndex((_, i) => !taken.has(i));
  if (slot < 0) return null;
  size = Math.max(1, Math.min(4, Math.round(size)));
  mimic = mimic && size >= 3;
  if (mimic) m.mimicSeen = true;
  const { looks, mimicAt } = dressParty(m, size, mimic);
  const g: Group = {
    id: m.nextId++,
    state: 'arrive',
    t: 0,
    patience: 1,
    slot,
    table: -1,
    leader: -1,
    guests: [],
    angry: false,
    low: false,
  };
  const slots = m.tables.map((t) => t.slot);
  looks.forEach((look, i) => {
    const x: Guest = {
      id: m.nextId++,
      group: g.id,
      look,
      mimic: i === mimicAt,
      x: DOOR_OUT.x - i * 0.35,
      z: DOOR_OUT.z + (i % 2) * 0.2 - 0.1,
      px: 0,
      pz: 0,
      fx: 1,
      fz: 0,
      state: 'walk',
      path: [],
      speed: GUEST_SPEED,
      seat: -1,
      dish: null,
      served: false,
    };
    x.px = x.x;
    x.pz = x.z;
    walk(x, [
      [DOOR_IN.x, DOOR_IN.z],
      ...route(slots, [DOOR_IN.x, DOOR_IN.z], queueSpot(slot, i, looks.length)),
    ]);
    m.guests.push(x);
    g.guests.push(x.id);
  });
  m.stats.guests += size;
  m.groups.push(g);
  m.events.push({ type: 'arrive', group: g.id });
  return g;
}

// ---------------------------------------------------------------- movement

/**
 * One tick of a waiter's own movement: the stick, goo and walls. Your own
 * device runs this too, ahead of the server, so moving never waits.
 */
export function movePlayer(m: Match, pi: number, input: Input) {
  const p = m.players[pi];
  p.px = p.x;
  p.pz = p.z;
  p.moving = false;
  if (p.mop > 0) return;
  const [mx, mz] = quantize(input.mx, input.mz);
  const len = Math.sqrt(mx * mx + mz * mz);
  if (len < 0.01) return;
  let speed = SPEED;
  if (m.puddles.some((u) => Math.hypot(u.x - p.x, u.z - p.z) < u.r))
    speed *= GOO_SLOW;
  const [nx, nz] = slide(
    p.x,
    p.z,
    mx * speed * TICK,
    mz * speed * TICK,
    PLAYER_R,
    obstacles(m.tables.map((t) => t.slot)),
  );
  p.fx = mx / len;
  p.fz = mz / len;
  p.moving = Math.abs(nx - p.x) + Math.abs(nz - p.z) > 0.002;
  p.x = nx;
  p.z = nz;
  if (p.moving) {
    const n = p.trail.length;
    if (
      n < 2 ||
      Math.hypot(p.trail[n - 2] - p.x, p.trail[n - 1] - p.z) > 0.12
    ) {
      p.trail.push(p.x, p.z);
      if (p.trail.length > TRAIL * 2) p.trail.splice(0, 2);
    }
  }
}

/** The point a distance back along a player's trail. */
function trailPoint(p: Player, back: number): [number, number] | null {
  let x = p.x,
    z = p.z,
    left = back;
  for (let i = p.trail.length - 2; i >= 0; i -= 2) {
    const tx = p.trail[i],
      tz = p.trail[i + 1];
    const d = Math.hypot(tx - x, tz - z);
    if (d >= left && d > 0) {
      const f = left / d;
      return [x + (tx - x) * f, z + (tz - z) * f];
    }
    left -= d;
    x = tx;
    z = tz;
  }
  return p.trail.length ? [x, z] : null;
}

function moveGuest(m: Match, x: Guest) {
  x.px = x.x;
  x.pz = x.z;
  if (x.state === 'follow') {
    const g = groupById(m, x.group);
    const p = g ? m.players[g.leader] : undefined;
    if (!g || !p) return;
    const k = g.guests.indexOf(x.id);
    const target = trailPoint(p, 0.75 * (k + 1));
    if (!target) return;
    const dx = target[0] - x.x,
      dz = target[1] - x.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.04) return;
    const step = Math.min(d, (SPEED * 1.25 + d * 2) * TICK);
    x.x += (dx / d) * step;
    x.z += (dz / d) * step;
    x.fx = dx / d;
    x.fz = dz / d;
    return;
  }
  if (!x.path.length) return;
  let budget = x.speed * TICK;
  while (budget > 0 && x.path.length) {
    const [tx, tz] = x.path[0];
    const dx = tx - x.x,
      dz = tz - x.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-6) {
      x.fx = dx / d;
      x.fz = dz / d;
    }
    if (d <= budget) {
      x.x = tx;
      x.z = tz;
      budget -= d;
      x.path.shift();
    } else {
      x.x += (dx / d) * budget;
      x.z += (dz / d) * budget;
      budget = 0;
    }
  }
  if (!x.path.length) {
    if (x.state === 'goo' || groupById(m, x.group)?.state === 'leave') {
      if (x.x <= DOOR_OUT.x + 0.05) x.state = 'gone';
    } else if (x.state === 'walk') {
      const g = groupById(m, x.group);
      x.state = g && g.table >= 0 ? 'sit' : 'wait';
      if (x.state === 'sit' && g) {
        const t = tableAt(m, g.table);
        if (t) {
          // Face the table.
          x.fx = t.x > x.x ? 1 : -1;
          x.fz = 0;
        }
      } else {
        x.fx = 0;
        x.fz = 1;
      }
    }
  }
}

// ---------------------------------------------------------------- the step

function updateGroup(m: Match, g: Group) {
  g.t++;
  const members = membersOf(m, g);
  if (g.state === 'leave') {
    return;
  }
  if (g.state === 'arrive' && members.every((x) => x.state === 'wait')) {
    g.state = 'queue';
    g.t = 0;
  }
  if (
    g.state === 'read' &&
    g.t >= READ_TICKS &&
    members.every((x) => x.state === 'sit')
  ) {
    g.state = 'order';
    g.t = 0;
    m.events.push({ type: 'bell', table: g.table });
  }
  if (g.state === 'eat' && g.t >= EAT_TICKS) {
    pay(m, g);
    return;
  }
  g.patience -= drain(m, g.state);
  if (!g.low && g.patience < 0.3 && drain(m, g.state) > 0) {
    g.low = true;
    m.events.push({ type: 'impatient', group: g.id });
  }
  if (g.patience >= 0.3) g.low = false;
  if (g.patience <= 0) {
    g.patience = 0;
    storm(m, g);
  }
}

function pay(m: Match, g: Group) {
  const t = tableAt(m, g.table)!;
  const members = membersOf(m, g);
  const mimic = members.find((x) => x.mimic && x.state !== 'goo');
  let coins = 0;
  if (mimic) {
    // Unspotted, the mimic bursts out with the bill.
    m.stats.burst++;
    const hz = boothHz(t.seats);
    const id = m.nextId++;
    const px = t.x + (rand(m) - 0.5) * 0.8;
    const pz = Math.min(10.2, t.z + hz + 0.75);
    m.puddles.push({ id, x: px, z: pz, r: 0.62 });
    m.events.push({
      type: 'burst',
      guest: mimic.id,
      table: t.slot,
      x: mimic.x,
      z: mimic.z,
    });
    m.events.push({ type: 'puddle', puddle: id });
    mimic.state = 'goo';
    leaveDiner(m, mimic, GOO_SPEED, t);
  } else {
    for (const x of members)
      if (!x.mimic) coins += PRICE + Math.round(TIP * g.patience);
    m.events.push({ type: 'pay', table: t.slot, coins });
  }
  t.dirty = true;
  t.coins = coins;
  t.plates = members.filter((x) => x.served).length;
  t.group = -1;
  for (const x of members)
    if (x.state !== 'goo') {
      x.dish = null;
      leaveDiner(m, x, GUEST_SPEED, t);
    }
  g.state = 'leave';
  g.t = 0;
}

function updateStation(m: Match, s: Station) {
  const dish = dishes[stationDish[s.id]];
  if (s.state === 'cook') {
    s.t--;
    if (s.t <= 0) {
      s.state = 'ready';
      s.t = 0;
      m.events.push({ type: 'ready', station: s.id });
    }
  } else if (s.state === 'ready' && dish.burn !== null) {
    s.t++;
    const burn = dish.burn * HZ;
    if (s.t === Math.round(burn * 0.5))
      m.events.push({ type: 'smoke', station: s.id });
    if (s.t >= burn) {
      s.state = 'burnt';
      s.t = 0;
      m.stats.burnt++;
      m.events.push({ type: 'burnt', station: s.id });
    }
  }
}

function finish(m: Match) {
  m.phase = 'over';
  m.medals = medalsFor(m);
  m.events.push({ type: 'end', medals: m.medals });
}

/**
 * One fixed step. `inputs` holds one input per player (missing ones stand
 * still). Events for the view and the sound pile up in `m.events` until the
 * caller drains them.
 */
export function step(m: Match, inputs: readonly (Input | undefined)[]) {
  if (m.phase === 'over') return;
  m.players.forEach((_, i) => movePlayer(m, i, inputs[i] ?? idle));
  if (m.phase === 'ready') {
    if (m.countdown > 0 && --m.countdown === 0) open(m);
    return;
  }
  m.tick++;
  m.players.forEach((p, i) => {
    const input = inputs[i];
    if (p.mop > 0) {
      if (--p.mop === 0) {
        const at = m.puddles.findIndex((u) => u.id === p.mopping);
        if (at >= 0) {
          m.puddles.splice(at, 1);
          m.events.push({ type: 'mopped', puddle: p.mopping });
        }
        p.mopping = -1;
      }
      return;
    }
    if (input?.use) doUse(m, i);
    else if (input?.out) doOut(m, i);
  });
  // Someone else finished mopping the same puddle.
  for (const p of m.players)
    if (p.mop > 0 && !m.puddles.some((u) => u.id === p.mopping)) {
      p.mop = 0;
      p.mopping = -1;
    }
  if (m.tick >= m.next) spawn(m);
  for (const g of m.groups) updateGroup(m, g);
  for (const x of m.guests) moveGuest(m, x);
  for (const s of m.stations) updateStation(m, s);
  // Forget whoever has left, and parties with nobody left inside.
  m.guests = m.guests.filter((x) => x.state !== 'gone');
  m.groups = m.groups.filter(
    (g) =>
      g.state !== 'leave' ||
      g.guests.some((id) => m.guests.some((x) => x.id === id)),
  );
  for (const g of m.groups)
    if (g.state === 'leave')
      g.guests = g.guests.filter((id) => m.guests.some((x) => x.id === id));
  if (m.stars <= 0 || m.tick >= SHIFT_TICKS) finish(m);
}

/** Medals on a scale the results and the setup box share. */
export function result(m: Match) {
  return {
    coins: m.coins,
    stars: m.stars,
    medals: m.phase === 'over' ? m.medals : medalsFor(m),
    targets: m.targets,
    stats: m.stats,
  };
}

/** Whether a parsed value looks like a match this code can run. */
export function isMatch(v: unknown): v is Match {
  const m = v as Match;
  return (
    !!m &&
    typeof m === 'object' &&
    m.v === 1 &&
    Array.isArray(m.players) &&
    Array.isArray(m.guests) &&
    Array.isArray(m.groups) &&
    Array.isArray(m.tables) &&
    Array.isArray(m.stations)
  );
}
