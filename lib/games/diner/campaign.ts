import {
  nights,
  type DishId,
  type NightId,
  type StationId,
} from './content.ts';
import { openTables } from './layout.ts';
import {
  createConfiguredMatch,
  defaultEffects,
  isMatch,
  MAX_LIVES,
  type DinerConfig,
  type Match,
  type ShiftMechanics,
} from './engine.ts';
import {
  applyGear,
  applyUpgrades,
  BASE_LIVES,
  GEAR,
  GEAR_PRICE,
  gearById,
  isGearId,
  isUpgradeId,
  upgradeById,
  type Gear,
  type GearId,
  type Rarity,
  type UpgradeId,
  type UpgradeRanks,
} from './campaign-content.ts';
import {
  BOSSES,
  choicesFrom,
  makeRoad,
  nodeById,
  PLACES,
  ROAD_LEGS,
  stopIndex,
  type BossId,
  type PlaceId,
  type Reward,
  type RoadMap,
  type RoadNode,
} from './road.ts';

export * from './campaign-content.ts';

/**
 * The night route as a roguelite (8 October 2026). A run is one night on the
 * road: three legs of forks, each ending at a boss. Lives last the whole run;
 * coins pay for gas between stops and for equipment at the Garage; tokens
 * bank for the Workshop, whose upgrades make the next run easier.
 */

export type CampaignProfile = {
  v: 3;
  /** Workshop tokens, banked as each shift ends. */
  tokens: number;
  upgrades: UpgradeRanks;
  /** The furthest stop any run reached (stops driven). */
  best: number;
  runs: number;
  /** Runs that beat the third boss. */
  nights: number;
  /** Shifts survived, all runs together. */
  shifts: number;
  nextRun: number;
};

export type ShiftSettlement = {
  stop: string;
  survived: boolean;
  /** Coins the shift took, and what reached the wallet (cash rewards pay more). */
  coins: number;
  banked: number;
  lives: number;
  lost: number;
  medals: number;
  tokens: number;
  reward: Reward | null;
  boss: BossId | null;
  served: number;
  caught: number;
};

export type RunStatus =
  | 'route'
  | 'shift'
  | 'reward'
  | 'garage'
  | 'motel'
  | 'cleared'
  | 'over';

export type CampaignRun = {
  v: 3;
  id: string;
  seed: number;
  status: RunStatus;
  /** Legs generated so far (three, more in overtime); the map follows from the seed. */
  legs: number;
  /** Where the car is parked; null before the first stop. */
  at: string | null;
  visited: string[];
  lives: number;
  maxLives: number;
  /** Coins: they pay for gas and for the Garage. */
  wallet: number;
  gear: GearId[];
  /** The Workshop as it was when the run began. */
  upgradeRanks: UpgradeRanks;
  /** Equipment to choose from after a shift, or for sale at a Garage. */
  offers: GearId[];
  /** Bought at this Garage. */
  sold: GearId[];
  /** This Garage's patch-up was used. */
  patched: boolean;
  /** Lucky dice rerolls left on this leg. */
  rerolls: number;
  savedMatch: Match | null;
  lastResult: ShiftSettlement | null;
  /** Tokens this run has banked, shifts it survived and bosses it beat. */
  tokens: number;
  shifts: number;
  bosses: number;
};

export type CampaignState = {
  profile: CampaignProfile;
  run: CampaignRun | null;
};

export const createProfile = (): CampaignProfile => ({
  v: 3,
  tokens: 0,
  upgrades: {},
  best: 0,
  runs: 0,
  nights: 0,
  shifts: 0,
  nextRun: 1,
});

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** A stable seed for an offer or a shift, independent of simulation RNG. */
function mix(seed: number, a: number, b: number) {
  let n =
    (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
function random(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const maps = new Map<string, RoadMap>();
/** The run's road, regenerated from its seed. */
export function runMap(run: Pick<CampaignRun, 'seed' | 'legs'>): RoadMap {
  const key = `${run.seed}:${run.legs}`;
  let map = maps.get(key);
  if (!map) {
    map = makeRoad(run.seed, run.legs);
    if (maps.size > 8) maps.clear();
    maps.set(key, map);
  }
  return map;
}
export const runNode = (run: CampaignRun) =>
  run.at ? (nodeById(runMap(run), run.at) ?? null) : null;
/** Stops you can drive to now. */
export const runChoices = (run: CampaignRun): RoadNode[] =>
  run.status === 'route' ? choicesFrom(runMap(run), runNode(run)) : [];
/** Stops driven, counting the one you are at. */
export const stopsDriven = (run: CampaignRun) => run.visited.length;

export function startRun(
  profile: CampaignProfile,
  seed: number,
): CampaignState & { run: CampaignRun } {
  if (!isCampaignProfile(profile) || !Number.isFinite(seed))
    throw new Error('Invalid Diner campaign');
  const s = seed >>> 0;
  const ranks = { ...profile.upgrades };
  const maxLives = BASE_LIVES + (ranks['spare-tire'] ?? 0);
  return {
    profile: {
      ...profile,
      runs: profile.runs + 1,
      nextRun: profile.nextRun + 1,
    },
    run: {
      v: 3,
      id: `${profile.nextRun.toString(36)}-${s.toString(36)}`,
      seed: s,
      status: 'route',
      legs: ROAD_LEGS,
      at: null,
      visited: [],
      lives: maxLives,
      maxLives,
      wallet: 25 * (ranks['gas-can'] ?? 0),
      gear: [],
      upgradeRanks: ranks,
      offers: [],
      sold: [],
      patched: false,
      rerolls: ranks['lucky-dice'] ? 1 : 0,
      savedMatch: null,
      lastResult: null,
      tokens: 0,
      shifts: 0,
      bosses: 0,
    },
  };
}

// ---------------------------------------------------------------- shifts

const STATION_ORDER: StationId[] = ['grill', 'fryer', 'shake', 'pie'];
const MENU: Record<DishId, number> = { burger: 3, fries: 3, shake: 2, pie: 2 };
/** The dish each place's crowd orders twice as often. */
const FAVOURITE: Record<PlaceId, DishId> = {
  truckstop: 'burger',
  drivein: 'shake',
  fairground: 'pie',
  harbour: 'fries',
  oldtown: 'pie',
  moonmile: 'fries',
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A shift's effects: the Workshop's upgrades, then the run's equipment. */
export function effectsFor(run: Pick<CampaignRun, 'upgradeRanks' | 'gear'>) {
  const e = defaultEffects();
  applyUpgrades(e, run.upgradeRanks);
  for (const id of run.gear) applyGear(e, id);
  return e;
}

/**
 * The shift at a stop. Difficulty climbs with every stop driven: guests come
 * faster, wait less and come in bigger parties; booths and dishes are added;
 * each leg brings new trouble, and the place's crowd decides which.
 */
export function shiftConfig(run: CampaignRun, node: RoadNode): DinerConfig {
  const s = stopIndex(node.leg, node.col);
  const leg = node.leg;
  const over = Math.max(0, leg - 2);
  const busy = Math.max(1, node.busy);
  const night: NightId = leg === 0 ? 1 : leg === 1 ? 2 : 3;
  const seconds =
    (leg === 0 ? 100 : leg === 1 ? 110 : 120) + (node.boss ? 20 : 0);
  const rand = random(mix(run.seed, s, 101));
  const spec = copy(nights[night]);
  const place = node.place;

  const stations = STATION_ORDER.filter(
    (id) =>
      id === 'grill' ||
      id === 'shake' ||
      (id === 'fryer' && s >= 2) ||
      (id === 'pie' && leg >= 1),
  );
  spec.stations = stations;
  const menu: Partial<Record<DishId, number>> = {};
  for (const id of stations) {
    const dish: DishId =
      id === 'grill' ? 'burger' : id === 'fryer' ? 'fries' : id;
    menu[dish] = MENU[dish] * (FAVOURITE[place] === dish ? 2 : 1);
  }
  spec.menu = menu;

  const ranks = run.upgradeRanks;
  const count =
    (leg === 0
      ? node.col < 2
        ? 3
        : 4
      : leg === 1
        ? node.col < 2
          ? 4
          : 5
        : node.col < 2
          ? 5
          : 6) + (ranks['bigger-patio'] ? 1 : 0);
  spec.tables = openTables(count);

  const pace = (1 - 0.09 * (busy - 1)) * Math.pow(0.95, over);
  const lo = Math.max(4.6, 12.5 - 0.84 * s) * pace;
  spec.interval = [lo, lo + Math.max(2.2, 4 - 0.12 * s)];
  const grow = Math.min(1, s / 12);
  spec.sizes = [
    lerp(0.32, 0.08, grow),
    lerp(0.45, 0.3, grow),
    lerp(0.15, 0.34, grow),
    lerp(0.08, 0.28, grow),
  ];
  const calm = (1 - 0.05 * (busy - 1)) * Math.pow(0.96, over);
  spec.patience = {
    queue: Math.max(24, 48 - 1.8 * s) * calm,
    order: Math.max(16, 30 - 1.2 * s) * calm,
    food: Math.max(28, 52 - 2 * s) * calm,
  };
  spec.mimics =
    leg >= 1 ? Math.min(0.85, 0.3 + 0.04 * node.col + 0.05 * over) : 0;
  spec.firstMimic = 18;

  const mechanics: ShiftMechanics = {};
  switch (place) {
    case 'truckstop':
      spec.sizes = [
        spec.sizes[0] * 0.4,
        spec.sizes[1],
        spec.sizes[2] * 1.4,
        spec.sizes[3] * 1.6,
      ];
      spec.patience.queue *= 1.15;
      break;
    case 'drivein':
      mechanics.rush = { every: 38, length: 12, pace: 1.9 };
      spec.sizes = [
        spec.sizes[0],
        spec.sizes[1] * 1.8,
        spec.sizes[2] * 0.7,
        spec.sizes[3] * 0.5,
      ];
      break;
    case 'fairground':
      spec.patience.queue *= 0.82;
      spec.patience.order *= 0.82;
      spec.patience.food *= 0.82;
      break;
    case 'harbour':
      mechanics.spills = { every: 24 };
      break;
    case 'oldtown':
      if (leg >= 1) {
        spec.mimics = Math.min(0.9, spec.mimics * 1.8);
        spec.firstMimic = 10;
      }
      break;
    case 'moonmile':
      mechanics.power = { every: 34, length: 11, rate: 0.35 };
      mechanics.jams = { every: 33, taps: 2 };
      break;
  }
  if (leg >= 1) {
    mechanics.demanding ??= { chance: 0.25, patience: 0.8, bonus: 6 };
    if (busy >= 2 && !mechanics.jams) mechanics.jams = { every: 45, taps: 1 };
  }
  if (leg >= 2) {
    // The Moon Mile mixes every crowd's trouble: one more per stop.
    const extra = (['rush', 'spills', 'power', 'jams'] as const).filter(
      (k) => !mechanics[k],
    );
    const k = extra[Math.floor(rand() * extra.length)];
    if (k === 'rush') mechanics.rush = { every: 40, length: 11, pace: 1.8 };
    else if (k === 'spills') mechanics.spills = { every: 30 };
    else if (k === 'power')
      mechanics.power = { every: 38, length: 10, rate: 0.4 };
    else if (k === 'jams') mechanics.jams = { every: 38, taps: 2 };
  }
  switch (node.boss) {
    case 'last-bus':
      mechanics.rush = { every: 24, length: 16, pace: 2.5 };
      spec.sizes = [0.05, 0.3, 0.35, 0.3];
      break;
    case 'critic':
      mechanics.demanding = { chance: 1, patience: 0.75, bonus: 8 };
      spec.mimics = Math.max(spec.mimics, 0.5);
      spec.firstMimic = 15;
      break;
    case 'feast':
      mechanics.rush = { every: 36, length: 13, pace: 1.9 };
      mechanics.jams = { every: 30, taps: 2 };
      mechanics.power = { every: 41, length: 11, rate: 0.35 };
      mechanics.spills = { every: 32 };
      mechanics.demanding = { chance: 0.5, patience: 0.78, bonus: 6 };
      spec.mimics = Math.max(spec.mimics, 0.7);
      spec.firstMimic = 12;
      break;
  }
  if (spec.mimics <= 0) spec.firstMimic = seconds + 1;

  // Medals: about half, three quarters and all of what a sharp waiter takes.
  const total = spec.sizes.reduce((a, b) => a + b, 0);
  const party = spec.sizes.reduce((a, w, i) => a + w * (i + 1), 0) / total;
  const arrivals =
    ((seconds - 22) / ((spec.interval[0] + spec.interval[1]) / 2)) *
    (mechanics.rush ? 1.2 : 1);
  const expected = arrivals * party * 10;
  const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  spec.targets = [
    round5(expected * 0.5),
    round5(expected * 0.75),
    round5(expected),
  ];
  spec.name = node.boss ? BOSSES[node.boss].name : PLACES[place].name;

  return {
    v: 2,
    mode: 'campaign',
    runId: run.id,
    stop: node.id,
    stage: run.visited.length - (run.at === node.id ? 1 : 0),
    place,
    boss: node.boss,
    title: spec.name,
    night,
    seconds,
    lives: Math.max(1, run.lives),
    maxLives: run.maxLives,
    spec,
    effects: effectsFor(run),
    mechanics,
  };
}

/** The names of the trouble a shift brings, for its fork and opening card. */
export function troubleNames(c: Pick<DinerConfig, 'mechanics' | 'spec'>) {
  const out: string[] = [];
  if (c.mechanics.rush) out.push('Rushes');
  if (c.spec.mimics > 0) out.push('Mimics');
  if (c.mechanics.demanding) out.push('Big spenders');
  if (c.mechanics.jams) out.push('Jams');
  if (c.mechanics.spills) out.push('Spills');
  if (c.mechanics.power) out.push('Brownouts');
  return out;
}

// ---------------------------------------------------------------- driving

/**
 * Drive to a stop. Gas is paid on the way; if the wallet cannot cover it, it
 * empties and pushing the car costs a life.
 */
export function driveTo(
  run: CampaignRun,
  id: string,
  names: string[] = ['You'],
): CampaignRun {
  if (run.status !== 'route') return run;
  const node = runChoices(run).find((n) => n.id === id);
  if (!node) return run;
  const next: CampaignRun = {
    ...run,
    at: node.id,
    visited: [...run.visited, node.id],
    offers: [],
    sold: [],
    patched: false,
    lastResult: null,
  };
  if (node.col === 0 && node.leg > 0)
    next.rerolls = run.upgradeRanks['lucky-dice'] ? 1 : 0;
  if (next.wallet >= node.gas) next.wallet -= node.gas;
  else {
    next.wallet = 0;
    next.lives = Math.max(0, next.lives - 1);
    if (!next.lives) return { ...next, status: 'over' };
  }
  if (node.kind === 'garage')
    return { ...next, status: 'garage', offers: makeOffers(next, 'garage', 0) };
  if (node.kind === 'motel') return { ...next, status: 'motel' };
  const config = shiftConfig(next, node);
  return {
    ...next,
    status: 'shift',
    savedMatch: createConfiguredMatch(
      mix(run.seed, stopIndex(node.leg, node.col), node.lane * 10 + 17),
      config,
      names,
    ),
  };
}

function matchesRun(run: CampaignRun, m: Match) {
  const saved = run.savedMatch;
  return (
    run.status === 'shift' &&
    !!saved &&
    isMatch(m) &&
    m.config?.runId === run.id &&
    m.config.stop === run.at &&
    m.seed === saved.seed &&
    JSON.stringify(m.config) === JSON.stringify(saved.config) &&
    m.tick >= saved.tick &&
    (saved.phase !== 'over' || m.phase === 'over') &&
    m.stars <= saved.stars
  );
}

/** Keeps paths, trails, simulation RNG and all in-flight actions. */
export function checkpointRun(run: CampaignRun, match: Match): CampaignRun {
  if (!matchesRun(run, match)) return run;
  const savedMatch = copy(match);
  savedMatch.events = [];
  return { ...run, savedMatch };
}

/** The shift is over: bank it once, then pay the fork's reward. */
export function settleShift(
  profile: CampaignProfile,
  run: CampaignRun,
  match: Match,
): CampaignState {
  if (
    !matchesRun(run, match) ||
    match.phase !== 'over' ||
    (match.stars > 0 && match.tick < Math.round(match.config!.seconds * 30))
  )
    return { profile, run };
  const node = runNode(run)!;
  const survived = match.stars > 0;
  const cash = survived && node.reward === 'cash';
  const banked = Math.round(match.coins * (cash ? 1.5 : 1));
  const medals = survived ? match.medals : 0;
  const tokens =
    (survived ? 20 + medals + (node.boss ? 10 : 0) : 0) +
    Math.floor(match.coins / 40);
  const lastResult: ShiftSettlement = {
    stop: node.id,
    survived,
    coins: match.coins,
    banked,
    lives: match.stars,
    lost: Math.max(0, run.lives - match.stars),
    medals,
    tokens,
    reward: survived ? node.reward : null,
    boss: node.boss,
    served: match.stats.served,
    caught: match.stats.caught,
  };
  // The last leg built so far ends the night (the third, then each overtime leg).
  const finalBoss = node.kind === 'boss' && node.leg === run.legs - 1;
  const nightBeaten = node.kind === 'boss' && node.leg === ROAD_LEGS - 1;
  let next: CampaignRun = {
    ...run,
    savedMatch: null,
    lives: match.stars,
    wallet: run.wallet + banked,
    tokens: run.tokens + tokens,
    shifts: run.shifts + (survived ? 1 : 0),
    bosses: run.bosses + (survived && node.boss ? 1 : 0),
    lastResult,
  };
  if (!survived) next = { ...next, status: 'over' };
  else if (node.reward === 'gear' || node.reward === 'rare') {
    const offers = makeOffers(
      next,
      node.reward === 'rare' ? 'rare' : 'normal',
      0,
    );
    next = offers.length
      ? { ...next, status: 'reward', offers }
      : { ...next, status: finalBoss ? 'cleared' : 'route' };
  } else if (node.reward === 'life')
    next = {
      ...next,
      lives: Math.min(next.maxLives, next.lives + 1),
      status: finalBoss ? 'cleared' : 'route',
    };
  else next = { ...next, status: finalBoss ? 'cleared' : 'route' };
  return {
    profile: {
      ...profile,
      tokens: profile.tokens + tokens,
      best: Math.max(profile.best, run.visited.length),
      shifts: profile.shifts + (survived ? 1 : 0),
      nights: profile.nights + (survived && nightBeaten ? 1 : 0),
    },
    run: next,
  };
}

// ---------------------------------------------------------------- equipment

const POOLS: Record<'normal' | 'rare' | 'garage', Record<Rarity, number>> = {
  normal: { common: 60, uncommon: 35, rare: 5 },
  rare: { common: 0, uncommon: 35, rare: 65 },
  garage: { common: 45, uncommon: 40, rare: 15 },
};

/** Equipment the run can still use: not owned, and not already given by the Workshop. */
export function availableGear(run: CampaignRun, leg: number): Gear[] {
  const e = effectsFor(run);
  return GEAR.filter(
    (g) =>
      g.leg <= leg &&
      (g.instant ? run.lives < run.maxLives : !run.gear.includes(g.id)) &&
      !(g.id === 'chrome-tray' && e.hands >= 3) &&
      !(g.id === 'roller-skates' && e.dash),
  );
}

export function makeOffers(
  run: CampaignRun,
  pool: keyof typeof POOLS,
  salt: number,
): GearId[] {
  const node = runNode(run);
  const leg = node?.leg ?? 0;
  const rand = random(
    mix(
      run.seed,
      run.visited.length * 7 + salt,
      pool === 'garage' ? 3 : pool === 'rare' ? 5 : 1,
    ),
  );
  const left = [...availableGear(run, leg)];
  const weights = POOLS[pool];
  const out: GearId[] = [];
  while (out.length < 3 && left.length) {
    const total = left.reduce((a, g) => a + (weights[g.rarity] || 0.01), 0);
    let r = rand() * total;
    let at = left.length - 1;
    for (let i = 0; i < left.length; i++) {
      r -= weights[left[i].rarity] || 0.01;
      if (r < 0) {
        at = i;
        break;
      }
    }
    out.push(left.splice(at, 1)[0].id);
  }
  return out;
}

function gainGear(run: CampaignRun, id: GearId): CampaignRun {
  const g = gearById(id);
  if (g.instant)
    return id === 'second-wind'
      ? { ...run, lives: Math.min(run.maxLives, run.lives + 2) }
      : run;
  return { ...run, gear: [...run.gear, id] };
}

/** After the reward, the road goes on, or the night is beaten. */
function afterStop(run: CampaignRun): CampaignRun['status'] {
  const node = runNode(run);
  return node?.kind === 'boss' && node.leg === run.legs - 1
    ? 'cleared'
    : 'route';
}

export function pickGear(run: CampaignRun, id: GearId): CampaignRun {
  if (run.status !== 'reward' || !run.offers.includes(id)) return run;
  return { ...gainGear(run, id), offers: [], status: afterStop(run) };
}

export function rerollOffers(run: CampaignRun): CampaignRun {
  if (run.status !== 'reward' || run.rerolls <= 0) return run;
  const node = runNode(run);
  const pool = node?.reward === 'rare' || node?.boss ? 'rare' : 'normal';
  return {
    ...run,
    rerolls: run.rerolls - 1,
    offers: makeOffers(run, pool, 1 + run.rerolls),
  };
}

export const gearPrice = (run: CampaignRun, id: GearId) =>
  GEAR_PRICE[gearById(id).rarity] + 15 * (runNode(run)?.leg ?? 0);
export const patchPrice = (run: CampaignRun) =>
  70 + 20 * (runNode(run)?.leg ?? 0);

export function buyGear(run: CampaignRun, id: GearId): CampaignRun {
  if (
    run.status !== 'garage' ||
    !run.offers.includes(id) ||
    run.sold.includes(id) ||
    run.wallet < gearPrice(run, id)
  )
    return run;
  return {
    ...gainGear(run, id),
    wallet: run.wallet - gearPrice(run, id),
    sold: [...run.sold, id],
  };
}

export function patchUp(run: CampaignRun): CampaignRun {
  if (
    run.status !== 'garage' ||
    run.patched ||
    run.lives >= run.maxLives ||
    run.wallet < patchPrice(run)
  )
    return run;
  return {
    ...run,
    lives: run.lives + 1,
    wallet: run.wallet - patchPrice(run),
    patched: true,
  };
}

export function leaveStop(run: CampaignRun): CampaignRun {
  return run.status === 'garage'
    ? { ...run, offers: [], sold: [], status: 'route' }
    : run;
}

/** The Motel: sleep (two lives back) or tune the car (pick equipment). */
export function motelRest(run: CampaignRun): CampaignRun {
  return run.status === 'motel'
    ? { ...run, lives: Math.min(run.maxLives, run.lives + 2), status: 'route' }
    : run;
}
export function motelTune(run: CampaignRun): CampaignRun {
  if (run.status !== 'motel') return run;
  const offers = makeOffers(run, 'normal', 9);
  return offers.length ? { ...run, status: 'reward', offers } : run;
}

/** After the third boss: keep driving into overtime legs. */
export function keepDriving(run: CampaignRun): CampaignRun {
  return run.status === 'cleared'
    ? { ...run, legs: run.legs + 1, status: 'route' }
    : run;
}

/** Ends the run where it is. Banked tokens and the Workshop stay. */
export function endRun(run: CampaignRun): CampaignRun {
  return run.status === 'over'
    ? run
    : { ...run, status: 'over', savedMatch: null, offers: [], sold: [] };
}

// ---------------------------------------------------------------- workshop

export function upgradeCost(profile: CampaignProfile, id: UpgradeId) {
  return upgradeById(id).costs[profile.upgrades[id] ?? 0] ?? null;
}
export function canBuyUpgrade(profile: CampaignProfile, id: UpgradeId) {
  const cost = upgradeCost(profile, id);
  return cost !== null && profile.tokens >= cost;
}
export function buyUpgrade(
  profile: CampaignProfile,
  id: UpgradeId,
): CampaignProfile {
  if (!isUpgradeId(id) || !canBuyUpgrade(profile, id)) return profile;
  return {
    ...profile,
    tokens: profile.tokens - upgradeCost(profile, id)!,
    upgrades: { ...profile.upgrades, [id]: (profile.upgrades[id] ?? 0) + 1 },
  };
}
/** Workshop purchases wait until no run is under way. */
export const runActive = (run: CampaignRun | null) =>
  !!run && run.status !== 'over';

// ---------------------------------------------------------------- checks

const integer = (
  v: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
function validRanks(v: unknown): v is UpgradeRanks {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.entries(v).every(
      ([id, rank]) => isUpgradeId(id) && integer(rank, 0, upgradeById(id).max),
    )
  );
}
export function isCampaignProfile(v: unknown): v is CampaignProfile {
  const p = v as CampaignProfile;
  if (!p || typeof p !== 'object') return false;
  return (
    !!p &&
    typeof p === 'object' &&
    p.v === 3 &&
    validRanks(p.upgrades) &&
    ['tokens', 'best', 'runs', 'nights', 'shifts'].every((k) =>
      integer(p[k as keyof CampaignProfile]),
    ) &&
    integer(p.nextRun, 1)
  );
}
const STATUSES: RunStatus[] = [
  'route',
  'shift',
  'reward',
  'garage',
  'motel',
  'cleared',
  'over',
];
/** Whether saved data is a run this code can continue. Never throws. */
export function isCampaignRun(v: unknown): v is CampaignRun {
  try {
    return runShape(v);
  } catch {
    return false;
  }
}
function runShape(v: unknown): v is CampaignRun {
  const r = v as CampaignRun;
  if (
    !r ||
    typeof r !== 'object' ||
    r.v !== 3 ||
    typeof r.id !== 'string' ||
    r.id.length < 1 ||
    r.id.length > 100 ||
    !integer(r.seed, 0, 4294967295) ||
    !STATUSES.includes(r.status) ||
    !integer(r.legs, ROAD_LEGS, 60) ||
    !(r.at === null || typeof r.at === 'string') ||
    !Array.isArray(r.visited) ||
    r.visited.length > r.legs * 5 ||
    !r.visited.every((id) => typeof id === 'string') ||
    (r.at !== null && r.visited.at(-1) !== r.at) ||
    !integer(r.maxLives, 1, MAX_LIVES) ||
    !integer(r.lives, 0, r.maxLives) ||
    !integer(r.wallet) ||
    !Array.isArray(r.gear) ||
    new Set(r.gear).size !== r.gear.length ||
    !r.gear.every((id) => isGearId(id) && !gearById(id).instant) ||
    !validRanks(r.upgradeRanks) ||
    !Array.isArray(r.offers) ||
    r.offers.length > 3 ||
    !r.offers.every(isGearId) ||
    !Array.isArray(r.sold) ||
    !r.sold.every((id) => r.offers.includes(id)) ||
    typeof r.patched !== 'boolean' ||
    !integer(r.rerolls, 0, 3) ||
    !['tokens', 'shifts', 'bosses'].every((k) =>
      integer(r[k as keyof CampaignRun]),
    )
  )
    return false;
  const map = runMap(r);
  if (r.at !== null && !nodeById(map, r.at)) return false;
  if (r.status === 'shift') {
    if (
      !isMatch(r.savedMatch) ||
      r.savedMatch.events.length !== 0 ||
      r.savedMatch.config?.runId !== r.id ||
      r.savedMatch.config.stop !== r.at
    )
      return false;
  } else if (r.savedMatch !== null) return false;
  if (r.status !== 'reward' && r.status !== 'garage' && r.offers.length)
    return false;
  return r.lastResult === null || typeof r.lastResult === 'object';
}
