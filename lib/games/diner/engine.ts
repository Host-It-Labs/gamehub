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
  type Night,
  type StationId,
} from './content.ts';
import {
  boothHz,
  COUNTER_X,
  DOOR_IN,
  DOOR_OUT,
  FRONT_Z,
  JUKEBOX,
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
  TABLE_ORDER,
  TABLES,
} from './layout.ts';
import { isPlaceId, type BossId, type PlaceId } from './road.ts';

/**
 * Diner's rules as a pure simulation: a fixed step of 1/30 s, a seeded
 * random number generator kept in the state, plain data only. The same
 * seed and the same inputs always give the same shift, so the server can
 * run it for a table and the tests can replay it.
 */
export const HZ = 30;
export const TICK = 1 / HZ;
export const SHIFT = 180;
/** No new party in the last seconds of a shift. */
const LAST_CALL = 22;
export const SPEED = 4.6;
/** Crossing goo slows you to this share of your speed. */
export const GOO_SLOW = 0.45;
const GUEST_SPEED = 2.7;
const STORM_SPEED = 3.6;
const GOO_SPEED = 5.2;
const COUNTDOWN_TICKS = 3 * HZ;
/** How far you reach: counter spots, booths, a waiting party, the queue. */
const REACH_SPOT = 0.82;
const REACH_TABLE = 0.66;
const REACH_GUEST = 0.9;
const REACH_OUT = 1.55;
const TRAIL = 48;

/** Campaign rules are plain data. Online rooms continue to use the three nights. */
export type ShiftEffects = {
  cook: Partial<Record<StationId, number>>;
  burn: number;
  patience: { queue: number; order: number; food: number };
  read: number;
  eat: number;
  mop: number;
  price: number;
  tip: number;
  bounty: number;
  servicePatience: number;
  seatPatience: number;
  combo: number;
  comboWindow: number;
  rubberBoots: boolean;
  repairPower: number;
  jamInterval: number;
  backupPower: boolean;
  autoWash: boolean;
  autoCash: boolean;
  salvage: number;
  shields: number;
  mimicInsurance: boolean;
  vipTip: number;
  cleanBursts: boolean;
  uniformOrders: boolean;
  restock: boolean;
  starter: StationId[];
  mopCoins: number;
  /** Plates one waiter can hold; the Chrome tray makes it three. */
  hands: number;
  /** Roller skates: the Dash button. */
  dash: boolean;
  /** Workshop fixtures: the heat-lamp pass, the coffee urn, the jukebox. */
  pass: boolean;
  coffee: boolean;
  jukebox: boolean;
  /** Order pad: booths are reached from this many times further. */
  reach: number;
  /** Twin grill: a third grill lane. */
  grillLanes: number;
  /** Golden spatula: nothing burns. */
  noBurn: boolean;
};
export type ShiftMechanics = {
  /** Rushes and brownouts begin after one period, for `length` seconds. */
  rush?: { every: number; length: number; pace: number };
  jams?: { every: number; taps: number };
  power?: { every: number; length: number; rate: number };
  demanding?: { chance: number; patience: number; bonus: number };
  spills?: { every: number };
};
export type DinerConfig = {
  v: 2;
  /** A campaign stop, or one of free play's levels (lib/games/diner/levels.ts). */
  mode: 'campaign' | 'level';
  /** Free play: the level's number. */
  level?: number;
  runId: string;
  /** The road stop this shift is played at (lib/games/diner/road.ts). */
  stop: string;
  /** Stops driven so far in the run, counting from zero. */
  stage: number;
  place: PlaceId;
  boss: BossId | null;
  title: string;
  night: NightId;
  seconds: number;
  /** Lives carried in from the run, and the most the run allows. */
  lives: number;
  maxLives: number;
  /** A campaign spec has only finite numbers, including firstMimic. */
  spec: Night;
  effects: ShiftEffects;
  mechanics: ShiftMechanics;
};
export type ShiftActivity = {
  combo: number;
  comboBest: number;
  lastServe: number;
  repairs: number;
  vipServed: number;
  tips: number;
  shields: number;
  nextJam: number;
  nextSpill: number;
  rush: boolean;
  power: boolean;
};

export const defaultEffects = (): ShiftEffects => ({
  cook: {},
  burn: 1,
  patience: { queue: 1, order: 1, food: 1 },
  read: 1,
  eat: 1,
  mop: 1,
  price: 0,
  tip: 1,
  bounty: 0,
  servicePatience: 0,
  seatPatience: 0,
  combo: 0,
  comboWindow: 12,
  rubberBoots: false,
  repairPower: 1,
  jamInterval: 1,
  backupPower: false,
  autoWash: false,
  autoCash: false,
  salvage: 0,
  shields: 0,
  mimicInsurance: false,
  vipTip: 0,
  cleanBursts: false,
  uniformOrders: false,
  restock: false,
  starter: [],
  mopCoins: 0,
  hands: 2,
  dash: false,
  pass: false,
  coffee: false,
  jukebox: false,
  reach: 1,
  grillLanes: 2,
  noBurn: false,
});

export type Input = {
  /** Where the stick or keys point, -1 to 1 on each axis (x right, z down). */
  mx: number;
  mz: number;
  /** Pressed on this tick. */
  use: boolean;
  out: boolean;
  /** Roller skates only. */
  dash?: boolean;
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

/** What a waiter holds. A stack of dirty plates fills every hand. */
export type Item =
  | { k: 'dish'; dish: DishId; burnt: boolean }
  | { k: 'dirty'; n: number }
  | { k: 'pot'; pours: number };
/** Pours in a fresh coffee pot, and what one pour gives back. */
export const POT_POURS = 3;
const POUR = 0.4;
/** A party is poured for only while its patience is below this. */
const POUR_BELOW = 0.65;
const DASH_TICKS = 7;
const DASH_COOL = 48;
const DASH_SPEED = 2.6;
/** The jukebox pauses everyone's patience for a song, then rests. */
export const JUKE_PLAY = 8;
export const JUKE_REST = 45;
export const PASS_SIZE = 3;

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
  /** Oldest first. */
  hands: Item[];
  /** The party following you, or -1. Leading needs no hands. */
  lead: number;
  /** Ticks of dash left, and ticks until it is ready again. */
  dash: number;
  dashCool: number;
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
  /** Demanding parties are marked before seating and pay extra. */
  demanding?: boolean;
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
export type StationSlotId = number;
export type StationSlot = {
  state: StationState;
  /** Ticks left cooking, or ticks since ready. */
  t: number;
};
export type Station = {
  id: StationId;
  /** Lanes cook side by side: two per machine, three on a twin grill. */
  lanes: StationSlot[];
  /** Use repairs a jam; cooking and burning pause until it is cleared. */
  jam?: number;
};

/** Every timed machine has two lanes (a twin grill three). Pie is instant. */
export const stationCapacity = (id: StationId, grillLanes = 2) =>
  id === 'pie' ? 1 : id === 'grill' ? grillLanes : 2;

export const stationSlots = (s: Station): readonly StationSlot[] => s.lanes;

/** Cooking and fresh plates already cover orders; burnt plates do not. */
export const stationStock = (s: Station) =>
  s.lanes.filter((slot) => slot.state === 'cook' || slot.state === 'ready')
    .length;

/** The first lane available to start, without disturbing its neighbours. */
export function stationOpenSlot(s: Station): StationSlotId | null {
  const at = s.lanes.findIndex((slot) => slot.state === 'idle');
  return at < 0 ? null : at;
}

/** Take the oldest fresh plate first, then a burnt plate to clear the lane. */
export function stationTakeSlot(s: Station): StationSlotId | null {
  let best: number | null = null;
  s.lanes.forEach((slot, i) => {
    if (slot.state === 'ready' && (best === null || slot.t > s.lanes[best].t))
      best = i;
  });
  if (best !== null) return best;
  const burnt = s.lanes.findIndex((slot) => slot.state === 'burnt');
  return burnt < 0 ? null : burnt;
}

function createStation(id: StationId, ready = false, grillLanes = 2): Station {
  return {
    id,
    lanes: Array.from({ length: stationCapacity(id, grillLanes) }, (_, i) => ({
      state: ready && i === 0 && id !== 'pie' ? 'ready' : 'idle',
      t: 0,
    })),
  };
}

export type Puddle = { id: number; x: number; z: number; r: number };

export type DinerEvent =
  | { type: 'arrive'; group: number }
  | { type: 'lead'; group: number; player: number }
  | { type: 'return'; group: number; player: number }
  | { type: 'seat'; group: number; table: number; player: number }
  | { type: 'bell'; table: number }
  | { type: 'order'; table: number; player: number }
  | { type: 'cook'; station: StationId; player: number; slot?: StationSlotId }
  | { type: 'ready'; station: StationId; slot?: StationSlotId }
  | { type: 'smoke'; station: StationId; slot?: StationSlotId }
  | { type: 'burnt'; station: StationId; slot?: StationSlotId }
  | {
      type: 'take';
      station: StationId;
      player: number;
      dish: DishId;
      burnt: boolean;
      slot?: StationSlotId;
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
  | { type: 'pour'; group: number; player: number }
  | { type: 'pot'; player: number }
  | { type: 'put'; player: number; dish: DishId }
  | { type: 'pick'; player: number; dish: DishId }
  | { type: 'juke'; player: number }
  | { type: 'dash'; player: number }
  | { type: 'jam'; station: StationId }
  | { type: 'repair'; station: StationId; player: number; left: number }
  | { type: 'rush'; active: boolean }
  | { type: 'power'; active: boolean }
  | { type: 'combo'; combo: number; coins: number }
  | { type: 'shield'; left: number }
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
  v: 2;
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
  /** Plates waiting under the heat lamps (the Workshop's pass), oldest first. */
  pass: Item[];
  /** Ticks the jukebox still plays (patience paused), and rests after. */
  juke: { play: number; rest: number };
  coins: number;
  /** Lives. A campaign brings its run's lives in and takes them back out. */
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
  config?: DinerConfig;
  activity?: ShiftActivity;
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
  return withCrew(nights[night].tables, players);
}
/** Three or four waiters open the next booth in line, if one is left. */
export function withCrew(tables: readonly number[], players: number) {
  const open = [...tables];
  if (players >= 3) {
    const next = TABLE_ORDER.find((i) => !open.includes(i));
    if (next !== undefined) open.push(next);
  }
  return open.sort((a, b) => a - b);
}

const newTable = (slot: number): Table => ({
  slot,
  x: TABLES[slot].x,
  z: TABLES[slot].z,
  seats: TABLES[slot].seats,
  group: -1,
  dirty: false,
  coins: 0,
  plates: 0,
});

export function createMatch(
  seed: number,
  night: NightId = 1,
  names: string[] = ['You'],
): Match {
  const n = Math.max(1, Math.min(4, names.length));
  const scale = coop(n).targets;
  const spec = nights[night];
  const m: Match = {
    v: 2,
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
      hands: [],
      lead: -1,
      dash: 0,
      dashCool: 0,
      mop: 0,
      mopping: -1,
      trail: [],
      seq: 0,
    })),
    guests: [],
    groups: [],
    tables: tableSlots(night, n).map(newTable),
    stations: spec.stations.map((id) => createStation(id)),
    puddles: [],
    pass: [],
    juke: { play: 0, rest: 0 },
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

/** Free-play nights stay as they are; a campaign brings its own finite rules. */
export function createConfiguredMatch(
  seed: number,
  config: DinerConfig,
  names: string[] = ['You'],
): Match {
  if (!isDinerConfig(config)) throw new Error('Invalid Diner shift rules');
  const m = createMatch(seed, config.night, names);
  m.config = JSON.parse(JSON.stringify(config)) as DinerConfig;
  const spec = m.config.spec;
  m.tables = withCrew(spec.tables, m.players.length).map(newTable);
  m.stations = spec.stations.map((id) =>
    createStation(
      id,
      config.effects.starter.includes(id),
      config.effects.grillLanes,
    ),
  );
  m.stars = config.lives;
  const scale = coop(m.players.length).targets;
  m.targets = spec.targets.map(
    (t) => Math.round((t * scale) / 5) * 5,
  ) as Match['targets'];
  m.activity = {
    combo: 0,
    comboBest: 0,
    lastServe: -1,
    repairs: 0,
    vipServed: 0,
    tips: 0,
    shields: config.effects.shields,
    nextJam: config.mechanics.jams
      ? Math.round(
          config.mechanics.jams.every * config.effects.jamInterval * HZ,
        )
      : 0,
    nextSpill: config.mechanics.spills
      ? Math.round(config.mechanics.spills.every * HZ)
      : 0,
    rush: false,
    power: true,
  };
  return m;
}

export const matchSpec = (m: Match): Night => m.config?.spec ?? nights[m.night];
export const matchEffects = (m: Match): ShiftEffects =>
  m.config?.effects ?? DEFAULT_EFFECTS;
const DEFAULT_EFFECTS = Object.freeze(defaultEffects());
export const shiftDuration = (m: Match) => m.config?.seconds ?? SHIFT;
export const cookSeconds = (m: Match, station: StationId) =>
  dishes[stationDish[station]].cook * (m.config?.effects.cook[station] ?? 1);
export const burnSeconds = (m: Match, station: StationId) => {
  const secs = dishes[stationDish[station]].burn;
  return secs === null || m.config?.effects.noBurn
    ? null
    : secs * (m.config?.effects.burn ?? 1);
};
export const mopSeconds = (m: Match) => 1.5 * (m.config?.effects.mop ?? 1);
export const readSeconds = (m: Match) => 2.4 * (m.config?.effects.read ?? 1);
export const eatSeconds = (m: Match) => 6 * (m.config?.effects.eat ?? 1);
function periodic(tick: number, every: number, length: number) {
  const period = Math.round(every * HZ);
  return tick >= period && tick % period < Math.round(length * HZ);
}
export const isRush = (m: Match) => {
  const r = m.config?.mechanics.rush;
  return !!r && periodic(m.tick, r.every, r.length);
};
export const powerOnline = (m: Match) => {
  const p = m.config?.mechanics.power;
  return (
    !p ||
    !!m.config?.effects.backupPower ||
    !periodic(m.tick, p.every, p.length)
  );
};

/** A campaign shift is survived when the shift ends with a life left. */
export const campaignShiftWon = (m: Match) => m.phase === 'over' && m.stars > 0;

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
export const clock = (m: Match) =>
  Math.max(0, (shiftDuration(m) * HZ - m.tick) / HZ);
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
  id === 'sink' ||
  id === 'bin' ||
  (id === 'pass'
    ? !!m.config?.effects.pass
    : id === 'coffee'
      ? !!m.config?.effects.coffee
      : !!stationById(m, id));

/** Patience drain per tick in a state (0: none). */
function drain(m: Match, state: GroupState, g?: Group) {
  const p = matchSpec(m).patience;
  const secs =
    state === 'queue' || state === 'arrive'
      ? p.queue
      : state === 'order'
        ? p.order
        : state === 'food'
          ? p.food
          : 0;
  const key =
    state === 'queue' || state === 'arrive'
      ? 'queue'
      : state === 'order'
        ? 'order'
        : 'food';
  // The jukebox's song pauses everyone's patience.
  if (m.juke.play > 0) return 0;
  const modifier = m.config?.effects.patience[key] ?? 1;
  const demand = g?.demanding
    ? (m.config?.mechanics.demanding?.patience ?? 1)
    : 1;
  return secs ? 1 / (secs * modifier * demand * HZ) : 0;
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
  | 'mop'
  | 'repair'
  | 'put'
  | 'pick'
  | 'pot'
  | 'refill'
  | 'stow'
  | 'pour'
  | 'juke';
export type UseAction = {
  kind: UseKind;
  group?: number;
  table?: number;
  counter?: CounterId;
  /** The machine lane the one Use action will start or collect. */
  slot?: StationSlotId;
  puddle?: number;
  /** The dish involved: cooked, taken, served, binned or shelved. */
  dish?: DishId;
  /** Which held item it gives (an index into the waiter's hands). */
  hand?: number;
};

const facing = (p: Player, x: number, z: number) => {
  const dx = x - p.x,
    dz = z - p.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  return d < 1e-6 ? 1 : (dx * p.fx + dz * p.fz) / d;
};

/** How many more things a waiter can pick up. Dirty plates fill every hand. */
export function freeHands(m: Match, p: Player) {
  if (p.hands.some((i) => i.k === 'dirty')) return 0;
  return Math.max(0, matchEffects(m).hands - p.hands.length);
}

/** Seated guests who ordered a dish and still wait for it. */
export function dishDemand(m: Match, dish: DishId) {
  let n = 0;
  const waiting = new Set(
    m.groups.filter((g) => g.state === 'food').map((g) => g.id),
  );
  for (const x of m.guests)
    if (
      waiting.has(x.group) &&
      x.dish === dish &&
      !x.served &&
      x.state !== 'goo'
    )
      n++;
  return n;
}

/** Plates of a dish already on their way: cooking, ready, held or shelved. */
export function dishSupply(m: Match, dish: DishId) {
  let n = 0;
  for (const s of m.stations)
    if (stationDish[s.id] === dish) n += stationStock(s);
  const fresh = (i: Item) => i.k === 'dish' && i.dish === dish && !i.burnt;
  for (const p of m.players) n += p.hands.filter(fresh).length;
  n += m.pass.filter(fresh).length;
  return n;
}

/**
 * A machine starts a dish only while guests still need more of it; when
 * nobody has ordered it, it makes one ahead. Pressing Use again after taking
 * a plate therefore never starts one nobody wants.
 */
export const mayStart = (m: Match, dish: DishId) =>
  dishSupply(m, dish) < Math.max(1, dishDemand(m, dish));

/** The held dish a party wants, oldest first, or -1. */
function wantedHand(m: Match, p: Player, g: Group) {
  const members = membersOf(m, g);
  return p.hands.findIndex(
    (i) =>
      i.k === 'dish' &&
      !i.burnt &&
      members.some((x) => x.dish === i.dish && !x.served),
  );
}

/** The plate the bin should take: burnt first, then one nobody wants. */
function binHand(m: Match, p: Player) {
  const burnt = p.hands.findIndex((i) => i.k === 'dish' && i.burnt);
  if (burnt >= 0) return burnt;
  const spare = p.hands.findIndex(
    (i) => i.k === 'dish' && dishDemand(m, i.dish) === 0,
  );
  if (spare >= 0) return spare;
  return p.hands.findIndex((i) => i.k === 'dish');
}

const potHand = (p: Player) => p.hands.findIndex((i) => i.k === 'pot');

/**
 * What Use would do now for a player, or null. At every target Use first
 * gives what it wants, then takes what is ready, then starts what is needed;
 * between targets the nearest one you face wins.
 */
export function actionFor(m: Match, pi: number): UseAction | null {
  const p = m.players[pi];
  if (!p || m.phase !== 'open' || p.mop > 0) return null;
  const fx = matchEffects(m);
  const free = freeHands(m, p);
  let best = null as UseAction | null;
  let score = Infinity;
  const offer = (a: UseAction, d: number, x: number, z: number) => {
    const s = d - 0.35 * facing(p, x, z);
    if (s < score) {
      score = s;
      best = a;
    }
  };
  const hasDirty = p.hands.some((i) => i.k === 'dirty');
  const pot = potHand(p);
  // Counter spots.
  for (const id of Object.keys(COUNTER_X) as CounterId[]) {
    if (!hasCounter(m, id)) continue;
    const d = spotDistance(p.x, p.z, id);
    if (d > REACH_SPOT) continue;
    const at: [number, number] = [COUNTER_X[id], 1.2];
    if (id === 'sink') {
      if (hasDirty) offer({ kind: 'wash', counter: id }, d, ...at);
      continue;
    }
    if (id === 'bin') {
      const hand = binHand(m, p);
      if (hand >= 0) {
        const item = p.hands[hand] as Extract<Item, { k: 'dish' }>;
        offer({ kind: 'bin', counter: id, dish: item.dish, hand }, d, ...at);
      }
      continue;
    }
    if (id === 'pass') {
      const hand = p.hands.findIndex((i) => i.k === 'dish');
      if (free === 0 && hand >= 0 && m.pass.length < PASS_SIZE) {
        const item = p.hands[hand] as Extract<Item, { k: 'dish' }>;
        offer({ kind: 'put', counter: id, dish: item.dish, hand }, d, ...at);
      } else if (free > 0 && m.pass.length) {
        const item = m.pass[0] as Extract<Item, { k: 'dish' }>;
        offer({ kind: 'pick', counter: id, dish: item.dish }, d, ...at);
      }
      continue;
    }
    if (id === 'coffee') {
      if (pot >= 0) {
        const held = p.hands[pot] as Extract<Item, { k: 'pot' }>;
        // A used pot is refilled; a full one goes back on the warmer.
        offer(
          {
            kind: held.pours < POT_POURS ? 'refill' : 'stow',
            counter: id,
            hand: pot,
          },
          d,
          ...at,
        );
      } else if (free > 0) offer({ kind: 'pot', counter: id }, d, ...at);
      continue;
    }
    const s = stationById(m, id)!;
    const dish = stationDish[id];
    if (s.jam) {
      offer({ kind: 'repair', counter: id }, d - 0.05, ...at);
      continue;
    }
    if (dishes[dish].cook === 0) {
      if (free > 0 && mayStart(m, dish))
        offer({ kind: 'take', counter: id, dish, slot: 0 }, d, ...at);
      continue;
    }
    const take = free > 0 ? stationTakeSlot(s) : null;
    const start = stationOpenSlot(s);
    if (take !== null)
      offer({ kind: 'take', counter: id, dish, slot: take }, d, ...at);
    else if (start !== null && mayStart(m, dish))
      offer({ kind: 'cook', counter: id, dish, slot: start }, d + 0.05, ...at);
  }
  // The jukebox plays when it has rested.
  if (fx.jukebox && !m.juke.play && !m.juke.rest) {
    const d = Math.hypot(JUKEBOX.x - p.x, JUKEBOX.z - p.z) - JUKEBOX.r;
    if (d <= REACH_SPOT) offer({ kind: 'juke' }, d, JUKEBOX.x, JUKEBOX.z);
  }
  // Booths.
  const lead = p.lead >= 0 ? groupById(m, p.lead) : undefined;
  for (const t of m.tables) {
    const d = rectDistance(p.x, p.z, boothRect(t));
    if (d > REACH_TABLE * fx.reach) continue;
    const g = t.group >= 0 ? groupById(m, t.group) : undefined;
    if (lead && t.group < 0 && !t.dirty && t.seats >= lead.guests.length) {
      offer({ kind: 'seat', table: t.slot, group: lead.id }, d, t.x, t.z);
      continue;
    }
    if (g?.state === 'food') {
      const hand = wantedHand(m, p, g);
      if (hand >= 0) {
        const item = p.hands[hand] as Extract<Item, { k: 'dish' }>;
        offer(
          { kind: 'serve', table: t.slot, group: g.id, dish: item.dish, hand },
          d,
          t.x,
          t.z,
        );
        continue;
      }
    }
    if (
      g &&
      pot >= 0 &&
      g.patience < POUR_BELOW &&
      (g.state === 'read' || g.state === 'order' || g.state === 'food')
    ) {
      offer(
        { kind: 'pour', table: t.slot, group: g.id, hand: pot },
        d,
        t.x,
        t.z,
      );
      continue;
    }
    if (g?.state === 'order')
      offer({ kind: 'order', table: t.slot, group: g.id }, d, t.x, t.z);
    else if (t.dirty && t.group < 0 && !p.hands.length)
      offer({ kind: 'clear', table: t.slot }, d, t.x, t.z);
  }
  // Waiting parties, and taking a led party back to its spot.
  for (const g of m.groups) {
    if (g.state === 'queue') {
      for (const x of membersOf(m, g)) {
        const d = Math.hypot(x.x - p.x, x.z - p.z) - 0.1;
        if (d > REACH_GUEST) continue;
        if (pot >= 0 && g.patience < POUR_BELOW)
          offer({ kind: 'pour', group: g.id, hand: pot }, d, x.x, x.z);
        else if (!lead) offer({ kind: 'lead', group: g.id }, d, x.x, x.z);
      }
    }
    if (g.state === 'follow' && lead?.id === g.id && g.slot >= 0) {
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
export const hasMimics = (m: Match) => matchSpec(m).mimics > 0;

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
  if (m.activity && m.activity.shields > 0) {
    m.activity.shields--;
    m.events.push({ type: 'shield', left: m.activity.shields });
    return;
  }
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
  if (m.activity) m.activity.combo = 0;
  loseStar(m);
  if (g.leader >= 0) {
    const p = m.players[g.leader];
    if (p?.lead === g.id) p.lead = -1;
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

function startCooking(m: Match, s: Station, slot: StationSlotId, pi: number) {
  const lane = s.lanes[slot];
  lane.state = 'cook';
  lane.t = Math.round(cookSeconds(m, s.id) * HZ);
  m.events.push({ type: 'cook', station: s.id, player: pi, slot });
}

function doUse(m: Match, pi: number) {
  const p = m.players[pi];
  const a = actionFor(m, pi);
  if (!a) {
    m.events.push({ type: 'deny', player: pi });
    return;
  }
  const fx = matchEffects(m);
  switch (a.kind) {
    case 'lead': {
      const g = groupById(m, a.group!)!;
      g.state = 'follow';
      g.leader = pi;
      g.t = 0;
      p.lead = g.id;
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
      p.lead = -1;
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
      g.patience = Math.min(1, g.patience + 0.2 + fx.seatPatience);
      t.group = g.id;
      p.lead = -1;
      seatGuests(m, g, t);
      m.events.push({ type: 'seat', group: g.id, table: t.slot, player: pi });
      break;
    }
    case 'order': {
      const g = groupById(m, a.group!)!;
      const menu = matchSpec(m).menu;
      const uniform = fx.uniformOrders ? weighted<DishId>(m, menu) : null;
      for (const x of membersOf(m, g))
        x.dish = uniform ?? weighted<DishId>(m, menu);
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
      p.hands.splice(a.hand!, 1);
      g.patience = Math.min(1, g.patience + 0.12 + fx.servicePatience);
      m.stats.served++;
      if (m.activity && m.config) {
        const act = m.activity;
        act.combo =
          act.lastServe >= 0 && m.tick - act.lastServe <= fx.comboWindow * HZ
            ? act.combo + 1
            : 1;
        act.lastServe = m.tick;
        act.comboBest = Math.max(act.comboBest, act.combo);
        if (g.demanding && !x.mimic) act.vipServed++;
        const coins = Math.min(3, act.combo - 1) * fx.combo;
        if (coins > 0) {
          m.coins += coins;
          m.events.push({ type: 'combo', combo: act.combo, coins });
        }
      }
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
      if (!fx.autoWash) p.hands = [{ k: 'dirty', n: Math.max(1, t.plates) }];
      t.dirty = false;
      t.coins = 0;
      t.plates = 0;
      break;
    }
    case 'cook': {
      const s = stationById(m, a.counter as StationId)!;
      startCooking(m, s, a.slot ?? 0, pi);
      break;
    }
    case 'take': {
      const s = stationById(m, a.counter as StationId)!;
      const slot = a.slot ?? 0;
      const lane = s.lanes[slot];
      const burnt = lane.state === 'burnt';
      p.hands.push({ k: 'dish', dish: stationDish[s.id], burnt });
      lane.state = 'idle';
      lane.t = 0;
      m.events.push({
        type: 'take',
        station: s.id,
        player: pi,
        dish: stationDish[s.id],
        burnt,
        slot,
      });
      if (
        !burnt &&
        fx.restock &&
        cookSeconds(m, s.id) > 0 &&
        dishDemand(m, stationDish[s.id]) > dishSupply(m, stationDish[s.id])
      )
        startCooking(m, s, slot, pi);
      break;
    }
    case 'wash':
      p.hands = p.hands.filter((i) => i.k !== 'dirty');
      m.events.push({ type: 'wash', player: pi });
      break;
    case 'bin': {
      const [item] = p.hands.splice(a.hand!, 1);
      if (item?.k === 'dish' && item.burnt) m.coins += fx.salvage;
      m.events.push({ type: 'bin', player: pi });
      break;
    }
    case 'put': {
      const [item] = p.hands.splice(a.hand!, 1);
      m.pass.push(item);
      m.events.push({ type: 'put', player: pi, dish: a.dish! });
      break;
    }
    case 'pick': {
      const item = m.pass.shift()!;
      p.hands.push(item);
      m.events.push({ type: 'pick', player: pi, dish: a.dish! });
      break;
    }
    case 'pot':
      p.hands.push({ k: 'pot', pours: POT_POURS });
      m.events.push({ type: 'pot', player: pi });
      break;
    case 'refill':
      p.hands[a.hand!] = { k: 'pot', pours: POT_POURS };
      m.events.push({ type: 'pot', player: pi });
      break;
    case 'stow':
      p.hands.splice(a.hand!, 1);
      m.events.push({ type: 'pot', player: pi });
      break;
    case 'pour': {
      const g = groupById(m, a.group!)!;
      const pot = p.hands[a.hand!] as Extract<Item, { k: 'pot' }>;
      pot.pours--;
      // An empty pot goes back on the warmer by itself.
      if (pot.pours <= 0) p.hands.splice(a.hand!, 1);
      g.patience = Math.min(1, g.patience + POUR);
      if (g.patience >= 0.3) g.low = false;
      m.events.push({ type: 'pour', group: g.id, player: pi });
      break;
    }
    case 'juke':
      m.juke.play = JUKE_PLAY * HZ;
      m.events.push({ type: 'juke', player: pi });
      break;
    case 'mop':
      p.mop = Math.round(mopSeconds(m) * HZ);
      p.mopping = a.puddle!;
      m.events.push({ type: 'mop', player: pi, puddle: a.puddle! });
      break;
    case 'repair': {
      const s = stationById(m, a.counter as StationId)!;
      s.jam = Math.max(0, (s.jam ?? 0) - fx.repairPower);
      if (!s.jam && m.activity) m.activity.repairs++;
      m.events.push({ type: 'repair', station: s.id, player: pi, left: s.jam });
      break;
    }
  }
}

function doOut(m: Match, pi: number, target: number | null) {
  if (!hasMimics(m)) return;
  const x = target === null ? undefined : guestById(m, target);
  const g = x ? groupById(m, x.group) : undefined;
  // The guest you aimed at is already gone (another waiter was quicker).
  if (
    !x ||
    !g ||
    x.state === 'goo' ||
    x.state === 'gone' ||
    g.state === 'leave'
  ) {
    m.events.push({ type: 'deny', player: pi });
    return;
  }
  if (!x.mimic) {
    m.stats.wrong++;
    m.events.push({ type: 'wrong', guest: x.id, player: pi });
    storm(m, g);
    return;
  }
  // Caught: the mimic pops back into goo and flees.
  m.stats.caught++;
  const bounty = MIMIC_BOUNTY + (m.config?.effects.bounty ?? 0);
  m.coins += bounty;
  m.events.push({
    type: 'reveal',
    guest: x.id,
    player: pi,
    x: x.x,
    z: x.z,
    coins: bounty,
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
  const spec = matchSpec(m);
  const secs = m.tick / HZ;
  if (secs > shiftDuration(m) - LAST_CALL) return;
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
  const pace =
    coop(m.players.length).pace *
    (isRush(m) ? m.config!.mechanics.rush!.pace : 1);
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
  if (m.config?.mechanics.demanding)
    g.demanding = rand(m) < m.config.mechanics.demanding.chance;
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
  if (p.dashCool > 0) p.dashCool--;
  if (p.mop > 0) {
    p.dash = 0;
    return;
  }
  if (input.dash && !p.dashCool && matchEffects(m).dash) {
    p.dash = DASH_TICKS;
    p.dashCool = DASH_COOL;
    m.events.push({ type: 'dash', player: pi });
  }
  let [mx, mz] = quantize(input.mx, input.mz);
  let len = Math.sqrt(mx * mx + mz * mz);
  // A dash with the stick at rest goes the way you face.
  if (p.dash > 0 && len < 0.01) {
    [mx, mz, len] = [p.fx, p.fz, 1];
  }
  if (len < 0.01) return;
  let speed = SPEED;
  if (p.dash > 0) {
    p.dash--;
    speed *= DASH_SPEED / Math.max(0.35, len);
  }
  if (m.puddles.some((u) => Math.hypot(u.x - p.x, u.z - p.z) < u.r))
    speed *= m.config?.effects.rubberBoots ? 1 : GOO_SLOW;
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
    g.t >= Math.round(readSeconds(m) * HZ) &&
    members.every((x) => x.state === 'sit')
  ) {
    g.state = 'order';
    g.t = 0;
    m.events.push({ type: 'bell', table: g.table });
  }
  if (g.state === 'eat' && g.t >= Math.round(eatSeconds(m) * HZ)) {
    pay(m, g);
    return;
  }
  g.patience -= drain(m, g.state, g);
  if (!g.low && g.patience < 0.3 && drain(m, g.state, g) > 0) {
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
  let tips = 0;
  for (const x of members) {
    if (x.mimic) continue;
    const tip = Math.round(TIP * g.patience * (m.config?.effects.tip ?? 1));
    tips += tip;
    coins += PRICE + (m.config?.effects.price ?? 0) + tip;
    if (g.demanding)
      coins +=
        (m.config?.mechanics.demanding?.bonus ?? 0) +
        (m.config?.effects.vipTip ?? 0);
  }
  if (mimic) {
    // Unspotted, the mimic bursts out with the bill.
    m.stats.burst++;
    const hz = boothHz(t.seats);
    const id = m.nextId++;
    const px = t.x + (rand(m) - 0.5) * 0.8;
    const pz = Math.min(FRONT_Z - 0.5, t.z + hz + 0.75);
    if (!m.config?.effects.cleanBursts) {
      m.puddles.push({ id, x: px, z: pz, r: 0.62 });
      m.events.push({ type: 'puddle', puddle: id });
    }
    m.events.push({
      type: 'burst',
      guest: mimic.id,
      table: t.slot,
      x: mimic.x,
      z: mimic.z,
    });
    mimic.state = 'goo';
    leaveDiner(m, mimic, GOO_SPEED, t);
    coins = m.config?.effects.mimicInsurance ? Math.floor(coins / 2) : 0;
    tips = m.config?.effects.mimicInsurance ? Math.floor(tips / 2) : 0;
    if (coins) m.events.push({ type: 'pay', table: t.slot, coins });
  } else {
    m.events.push({ type: 'pay', table: t.slot, coins });
  }
  if (m.activity) m.activity.tips += tips;
  t.dirty = true;
  if (m.config?.effects.autoCash) {
    m.coins += coins;
    t.coins = 0;
  } else t.coins = coins;
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
  if (s.jam) return;
  const burn = burnSeconds(m, s.id);
  s.lanes.forEach((lane, slot) => {
    if (lane.state === 'cook') {
      lane.t -= powerOnline(m) ? 1 : m.config!.mechanics.power!.rate;
      if (lane.t <= 0) {
        lane.state = 'ready';
        lane.t = 0;
        m.events.push({ type: 'ready', station: s.id, slot });
      }
    } else if (lane.state === 'ready') {
      lane.t++;
      if (burn === null) return;
      const ticks = Math.round(burn * HZ);
      if (lane.t === Math.round(ticks * 0.5))
        m.events.push({ type: 'smoke', station: s.id, slot });
      if (lane.t >= ticks) {
        lane.state = 'burnt';
        lane.t = 0;
        m.stats.burnt++;
        m.events.push({ type: 'burnt', station: s.id, slot });
      }
    }
  });
}

function updateMechanics(m: Match) {
  const c = m.config;
  const a = m.activity;
  if (!c || !a) return;
  const rush = isRush(m);
  if (rush !== a.rush) {
    a.rush = rush;
    m.events.push({ type: 'rush', active: rush });
    if (rush) m.next = Math.min(m.next, m.tick);
  }
  const power = powerOnline(m);
  if (power !== a.power) {
    a.power = power;
    m.events.push({ type: 'power', active: power });
  }
  if (c.mechanics.jams && a.nextJam > 0 && m.tick >= a.nextJam) {
    a.nextJam += Math.round(
      c.mechanics.jams.every * c.effects.jamInterval * HZ,
    );
    const available = m.stations.filter(
      (s) => !s.jam && dishes[stationDish[s.id]].cook > 0,
    );
    if (available.length) {
      const s = pick(m, available);
      s.jam = c.mechanics.jams.taps;
      m.events.push({ type: 'jam', station: s.id });
    }
  }
  if (c.mechanics.spills && a.nextSpill > 0 && m.tick >= a.nextSpill) {
    a.nextSpill += Math.round(c.mechanics.spills.every * HZ);
    if (m.puddles.length < 12) {
      const t = pick(m, m.tables);
      const id = m.nextId++;
      m.puddles.push({
        id,
        x: t.x + (rand(m) - 0.5) * 0.6,
        z: Math.min(FRONT_Z - 0.6, t.z + boothHz(t.seats) + 0.8),
        r: 0.55,
      });
      m.events.push({ type: 'puddle', puddle: id });
    }
  }
  if (a.lastServe >= 0 && m.tick - a.lastServe > c.effects.comboWindow * HZ)
    a.combo = 0;
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
  // Everyone aims before anyone acts: two waiters throwing out the same
  // mimic never turn the second throw onto a real guest.
  const aims = m.players.map((_, i) =>
    inputs[i]?.out && !inputs[i]?.use ? outTarget(m, i) : null,
  );
  m.players.forEach((p, i) => {
    const input = inputs[i];
    if (p.mop > 0) {
      if (--p.mop === 0) {
        const at = m.puddles.findIndex((u) => u.id === p.mopping);
        if (at >= 0) {
          m.puddles.splice(at, 1);
          m.coins += m.config?.effects.mopCoins ?? 0;
          m.events.push({ type: 'mopped', puddle: p.mopping });
        }
        p.mopping = -1;
      }
      return;
    }
    if (input?.use) doUse(m, i);
    else if (input?.out) doOut(m, i, aims[i]);
  });
  // Someone else finished mopping the same puddle.
  for (const p of m.players)
    if (p.mop > 0 && !m.puddles.some((u) => u.id === p.mopping)) {
      p.mop = 0;
      p.mopping = -1;
    }
  updateMechanics(m);
  if (m.juke.play > 0 && --m.juke.play === 0) m.juke.rest = JUKE_REST * HZ;
  else if (m.juke.rest > 0) m.juke.rest--;
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
  if (m.stars <= 0 || m.tick >= Math.round(shiftDuration(m) * HZ)) finish(m);
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

/** Whether a parsed value looks like a match this code can run. Never throws. */
export function isMatch(v: unknown): v is Match {
  try {
    return matchShape(v);
  } catch {
    return false;
  }
}
function matchShape(v: unknown): v is Match {
  const m = v as Match;
  const pos = (p: {
    x: number;
    z: number;
    px: number;
    pz: number;
    fx: number;
    fz: number;
  }) => [p.x, p.z, p.px, p.pz, p.fx, p.fz].every((n) => finite(n, -100, 100));
  return (
    !!m &&
    typeof m === 'object' &&
    m.v === 2 &&
    [1, 2, 3].includes(m.night) &&
    integer(m.seed, 0, 4294967295) &&
    integer(m.rng, -2147483648, 2147483647) &&
    integer(m.tick, 0) &&
    ['ready', 'open', 'over'].includes(m.phase) &&
    integer(m.countdown, 0, 3 * HZ) &&
    Array.isArray(m.players) &&
    m.players.length >= 1 &&
    m.players.length <= 4 &&
    m.players.every(
      (p) =>
        p &&
        typeof p.name === 'string' &&
        p.name.length <= 200 &&
        pos(p) &&
        typeof p.moving === 'boolean' &&
        Array.isArray(p.hands) &&
        p.hands.length <= MAX_HANDS &&
        p.hands.every(validItem) &&
        integer(p.lead, -1) &&
        integer(p.dash, 0, DASH_TICKS) &&
        integer(p.dashCool, 0, DASH_COOL) &&
        integer(p.mop, 0, 10 * HZ) &&
        integer(p.mopping, -1) &&
        integer(p.seq, 0) &&
        Array.isArray(p.trail) &&
        p.trail.length <= TRAIL * 2 &&
        p.trail.length % 2 === 0 &&
        p.trail.every((n) => finite(n, -100, 100)),
    ) &&
    Array.isArray(m.guests) &&
    m.guests.length <= 100 &&
    m.guests.every(
      (g) =>
        g &&
        integer(g.id, 1) &&
        integer(g.group, 1) &&
        pos(g) &&
        typeof g.mimic === 'boolean' &&
        typeof g.served === 'boolean' &&
        integer(g.seat, -1, 3) &&
        (g.dish === null || Object.hasOwn(dishes, g.dish)) &&
        ['walk', 'wait', 'follow', 'sit', 'goo', 'gone'].includes(g.state) &&
        finite(g.speed, 0, 100) &&
        Array.isArray(g.path) &&
        g.path.length <= 128 &&
        g.path.every(
          (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            p.every((n) => finite(n, -100, 100)),
        ) &&
        g.look &&
        integer(g.look.skin, 0, SKINS.length - 1) &&
        integer(g.look.hair, 0, HAIRS.length - 1) &&
        HATS.includes(g.look.hat) &&
        integer(g.look.shirt, 0, SHIRTS.length - 1) &&
        typeof g.look.stripes === 'boolean' &&
        typeof g.look.glasses === 'boolean',
    ) &&
    Array.isArray(m.groups) &&
    m.groups.length <= 50 &&
    m.groups.every(
      (g) =>
        g &&
        integer(g.id, 1) &&
        [
          'arrive',
          'queue',
          'follow',
          'read',
          'order',
          'food',
          'eat',
          'leave',
        ].includes(g.state) &&
        integer(g.t, 0) &&
        finite(g.patience, 0, 1) &&
        integer(g.slot, -1, QUEUE.length - 1) &&
        integer(g.table, -1, TABLES.length - 1) &&
        integer(g.leader, -1, m.players.length - 1) &&
        Array.isArray(g.guests) &&
        g.guests.length <= 4 &&
        g.guests.every(
          (id) => integer(id, 1) && m.guests.some((x) => x.id === id),
        ) &&
        typeof g.angry === 'boolean' &&
        typeof g.low === 'boolean' &&
        (g.demanding === undefined || typeof g.demanding === 'boolean'),
    ) &&
    Array.isArray(m.tables) &&
    m.tables.length >= 1 &&
    m.tables.length <= TABLES.length &&
    unique(m.tables.map((t) => t.slot)) &&
    m.tables.every(
      (t) =>
        t &&
        integer(t.slot, 0, TABLES.length - 1) &&
        t.x === TABLES[t.slot].x &&
        t.z === TABLES[t.slot].z &&
        t.seats === TABLES[t.slot].seats &&
        integer(t.group, -1) &&
        (t.group === -1 || m.groups.some((g) => g.id === t.group)) &&
        typeof t.dirty === 'boolean' &&
        integer(t.coins, 0) &&
        integer(t.plates, 0, 4),
    ) &&
    Array.isArray(m.stations) &&
    m.stations.length >= 1 &&
    m.stations.length <= 4 &&
    unique(m.stations.map((s) => s.id)) &&
    m.stations.every(
      (s) =>
        s &&
        Object.hasOwn(stationDish, s.id) &&
        Array.isArray(s.lanes) &&
        s.lanes.length >= 1 &&
        s.lanes.length <= 3 &&
        s.lanes.every(validStationSlot) &&
        (s.jam === undefined || integer(s.jam, 0, 5)),
    ) &&
    Array.isArray(m.pass) &&
    m.pass.length <= PASS_SIZE &&
    m.pass.every((i) => validItem(i) && i.k === 'dish') &&
    !!m.juke &&
    integer(m.juke.play, 0, JUKE_PLAY * HZ) &&
    integer(m.juke.rest, 0, JUKE_REST * HZ) &&
    Array.isArray(m.puddles) &&
    m.puddles.length <= 100 &&
    m.puddles.every(
      (p) =>
        p &&
        integer(p.id, 1) &&
        finite(p.x, -100, 100) &&
        finite(p.z, -100, 100) &&
        finite(p.r, 0.1, 2),
    ) &&
    integer(m.coins, 0) &&
    integer(m.stars, 0, MAX_LIVES) &&
    Array.isArray(m.targets) &&
    m.targets.length === 3 &&
    m.targets.every((n) => integer(n, 1)) &&
    finite(m.next, 0) &&
    typeof m.mimicSeen === 'boolean' &&
    integer(m.nextId, 1) &&
    integer(m.medals, 0, 3) &&
    m.stats &&
    ['guests', 'served', 'caught', 'wrong', 'stormed', 'burst', 'burnt'].every(
      (k) => integer(m.stats[k as keyof Stats], 0),
    ) &&
    Array.isArray(m.events) &&
    m.events.length <= 10000 &&
    (m.config === undefined ||
      (isDinerConfig(m.config) &&
        isShiftActivity(m.activity) &&
        m.night === m.config.night &&
        withCrew(m.config.spec.tables, m.players.length).length ===
          m.tables.length &&
        m.config.spec.tables.every((slot) =>
          m.tables.some((t) => t.slot === slot),
        ) &&
        m.config.spec.stations.length === m.stations.length &&
        m.config.spec.stations.every((id) =>
          m.stations.some((s) => s.id === id),
        ))) &&
    consistentEntities(m)
  );
}

const finite = (
  v: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (
  v: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): v is number => finite(v, min, max) && Number.isInteger(v);
const unique = (v: unknown[]) => new Set(v).size === v.length;

/** The most hands (the Chrome tray) and lives (the Workshop's spare tires) any shift allows. */
const MAX_HANDS = 4;
export const MAX_LIVES = 9;

function validItem(v: unknown): v is Item {
  const i = v as Item;
  return (
    !!i &&
    typeof i === 'object' &&
    (i.k === 'dish'
      ? Object.hasOwn(dishes, i.dish) && typeof i.burnt === 'boolean'
      : i.k === 'dirty'
        ? integer(i.n, 1, 4)
        : i.k === 'pot' && integer(i.pours, 1, POT_POURS))
  );
}

function validStationSlot(v: unknown): v is StationSlot {
  const s = v as StationSlot;
  return (
    !!s &&
    typeof s === 'object' &&
    ['idle', 'cook', 'ready', 'burnt'].includes(s.state) &&
    finite(s.t, 0, 600 * HZ)
  );
}

function consistentEntities(m: Match) {
  const ids = [...m.guests, ...m.groups, ...m.puddles].map((x) => x.id);
  return (
    unique(ids) &&
    ids.every((id) => id < m.nextId) &&
    m.guests.every((x) => m.groups.some((g) => g.id === x.group)) &&
    m.groups.every((g) => {
      return (
        (g.state !== 'follow' ||
          (g.leader >= 0 && m.players[g.leader]?.lead === g.id)) &&
        (!['read', 'order', 'food', 'eat'].includes(g.state) ||
          m.tables.some((t) => t.slot === g.table && t.group === g.id))
      );
    }) &&
    m.players.every(
      (p, i) =>
        (p.lead < 0 ||
          m.groups.some(
            (g) => g.id === p.lead && g.state === 'follow' && g.leader === i,
          )) &&
        (p.mop === 0 || m.puddles.some((u) => u.id === p.mopping)),
    )
  );
}

export function isDinerConfig(v: unknown): v is DinerConfig {
  try {
    return configShape(v);
  } catch {
    return false;
  }
}
function configShape(v: unknown): v is DinerConfig {
  const c = v as DinerConfig;
  if (
    !c ||
    typeof c !== 'object' ||
    c.v !== 2 ||
    (c.mode !== 'campaign' && c.mode !== 'level') ||
    (c.level !== undefined && !integer(c.level, 1, 999)) ||
    typeof c.runId !== 'string' ||
    c.runId.length < 1 ||
    c.runId.length > 100 ||
    typeof c.stop !== 'string' ||
    c.stop.length < 1 ||
    c.stop.length > 40 ||
    typeof c.title !== 'string' ||
    c.title.length < 1 ||
    c.title.length > 100 ||
    !integer(c.stage, 0) ||
    !isPlaceId(c.place) ||
    !(c.boss === null || ['last-bus', 'critic', 'feast'].includes(c.boss)) ||
    ![1, 2, 3].includes(c.night) ||
    !finite(c.seconds, 30, 600) ||
    !integer(c.maxLives, 1, MAX_LIVES) ||
    !integer(c.lives, 1, c.maxLives)
  )
    return false;
  const n = c.spec;
  if (
    !n ||
    n.id !== c.night ||
    typeof n.name !== 'string' ||
    !Array.isArray(n.stations) ||
    n.stations.length < 1 ||
    n.stations.length > 4 ||
    !unique(n.stations) ||
    !n.stations.every((id) => Object.hasOwn(stationDish, id)) ||
    !Array.isArray(n.tables) ||
    n.tables.length < 1 ||
    n.tables.length > TABLES.length ||
    !unique(n.tables) ||
    !n.tables.every((id) => integer(id, 0, TABLES.length - 1)) ||
    !n.menu ||
    typeof n.menu !== 'object' ||
    Object.keys(n.menu).length < 1 ||
    Object.entries(n.menu).some(
      ([id, w]) =>
        !Object.hasOwn(dishes, id) ||
        !n.stations.includes(dishes[id as DishId].station) ||
        !finite(w, 0.01, 100),
    ) ||
    !Array.isArray(n.interval) ||
    n.interval.length !== 2 ||
    !n.interval.every((x) => finite(x, 1, 120)) ||
    n.interval[1] < n.interval[0] ||
    !Array.isArray(n.sizes) ||
    n.sizes.length !== 4 ||
    !n.sizes.every((x) => finite(x, 0, 100)) ||
    n.sizes.reduce((a, b) => a + b, 0) <= 0 ||
    !finite(n.mimics, 0, 1) ||
    !finite(n.firstMimic, 0, 601) ||
    !n.patience ||
    !['queue', 'order', 'food'].every((k) =>
      finite(n.patience[k as keyof Night['patience']], 5, 1000),
    ) ||
    !Array.isArray(n.targets) ||
    n.targets.length !== 3 ||
    !n.targets.every((x) => integer(x, 1, 1000000)) ||
    n.targets[0] > n.targets[1] ||
    n.targets[1] > n.targets[2]
  )
    return false;
  const e = c.effects;
  if (
    !e ||
    !e.cook ||
    typeof e.cook !== 'object' ||
    Array.isArray(e.cook) ||
    Object.entries(e.cook).some(
      ([id, x]) => !Object.hasOwn(stationDish, id) || !finite(x, 0.15, 3),
    ) ||
    !e.patience ||
    !['queue', 'order', 'food'].every((k) =>
      finite(e.patience[k as keyof ShiftEffects['patience']], 0.2, 10),
    ) ||
    !['burn', 'read', 'eat', 'mop', 'tip', 'jamInterval'].every((k) =>
      finite(e[k as keyof ShiftEffects], 0.1, 10),
    ) ||
    !['price', 'bounty', 'combo', 'salvage', 'vipTip', 'mopCoins'].every((k) =>
      integer(e[k as keyof ShiftEffects], 0, 100),
    ) ||
    !['servicePatience', 'seatPatience'].every((k) =>
      finite(e[k as keyof ShiftEffects], 0, 1),
    ) ||
    !finite(e.comboWindow, 1, 120) ||
    !integer(e.repairPower, 1, 5) ||
    !integer(e.shields, 0, 5) ||
    ![
      'rubberBoots',
      'backupPower',
      'autoWash',
      'autoCash',
      'mimicInsurance',
      'cleanBursts',
      'uniformOrders',
      'restock',
      'dash',
      'pass',
      'coffee',
      'jukebox',
      'noBurn',
    ].every((k) => typeof e[k as keyof ShiftEffects] === 'boolean') ||
    !integer(e.hands, 1, MAX_HANDS) ||
    !finite(e.reach, 1, 3) ||
    !integer(e.grillLanes, 2, 3) ||
    !Array.isArray(e.starter) ||
    e.starter.length > 4 ||
    !unique(e.starter) ||
    !e.starter.every((id) => Object.hasOwn(stationDish, id))
  )
    return false;
  const a = c.mechanics;
  return (
    !!a &&
    typeof a === 'object' &&
    !Array.isArray(a) &&
    (!a.rush ||
      (finite(a.rush.every, 5, 600) &&
        finite(a.rush.length, 1, a.rush.every - 1) &&
        finite(a.rush.pace, 1, 4))) &&
    (!a.jams || (finite(a.jams.every, 5, 600) && integer(a.jams.taps, 1, 5))) &&
    (!a.power ||
      (finite(a.power.every, 5, 600) &&
        finite(a.power.length, 1, a.power.every - 1) &&
        finite(a.power.rate, 0.1, 1))) &&
    (!a.demanding ||
      (finite(a.demanding.chance, 0, 1) &&
        finite(a.demanding.patience, 0.2, 1) &&
        integer(a.demanding.bonus, 0, 100))) &&
    (!a.spills || finite(a.spills.every, 5, 600))
  );
}

function isShiftActivity(v: unknown): v is ShiftActivity {
  const a = v as ShiftActivity;
  return (
    !!a &&
    typeof a === 'object' &&
    [
      'combo',
      'comboBest',
      'repairs',
      'vipServed',
      'tips',
      'shields',
      'nextJam',
      'nextSpill',
    ].every((k) => integer(a[k as keyof ShiftActivity], 0)) &&
    integer(a.lastServe, -1) &&
    typeof a.rush === 'boolean' &&
    typeof a.power === 'boolean'
  );
}
