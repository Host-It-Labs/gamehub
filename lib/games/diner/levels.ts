import {
  stationDish,
  type DishId,
  type NightId,
  type StationId,
} from './content.ts';
import {
  defaultEffects,
  type DinerConfig,
  type Match,
  type ShiftEffects,
  type ShiftMechanics,
} from './engine.ts';
import { applyUpgrades, type UpgradeId } from './campaign-content.ts';
import { openTables } from './layout.ts';
import { PLACES, type PlaceId } from './road.ts';

/**
 * Free play as levels (9 October 2026). Forty short shifts in eight chapters,
 * each chapter at one place with its own crowd and trouble. Every level adds
 * something (a dish, a trouble, a booth, a piece of kit from the campaign's
 * Workshop) or turns the heat up, and the opening card says what. Finishing a
 * level (any medal, with a life left) opens the next one.
 */

/** Kit a level hands you: the Workshop's fixtures, given for free play. */
export type KitId = Extract<
  UpgradeId,
  | 'chrome-tray'
  | 'roller-skates'
  | 'coffee-urn'
  | 'heat-lamp-pass'
  | 'twin-grill'
  | 'jukebox'
>;
export const KIT: KitId[] = [
  'chrome-tray',
  'roller-skates',
  'coffee-urn',
  'heat-lamp-pass',
  'twin-grill',
  'jukebox',
];

export type Trouble =
  | 'rush'
  | 'mimics'
  | 'demanding'
  | 'spills'
  | 'power'
  | 'jams'
  | 'impatient'
  | 'big-parties';

/** One thing a level brings for the first time, for its opening card. */
export type Novelty =
  | { kind: 'basics' }
  | { kind: 'dish'; dish: DishId }
  | { kind: 'kit'; kit: KitId }
  | { kind: 'trouble'; trouble: Trouble }
  | { kind: 'booths'; count: number }
  | { kind: 'lives'; count: number }
  | { kind: 'boss' };

export type Chapter = {
  name: string;
  place: PlaceId | null;
  /** The sky and the jukebox's key. */
  night: NightId;
};
export const CHAPTERS: Chapter[] = [
  { name: 'Truck stop', place: 'truckstop', night: 1 },
  { name: 'Drive-in', place: 'drivein', night: 1 },
  { name: 'Old Town', place: 'oldtown', night: 2 },
  { name: 'Fairground', place: 'fairground', night: 2 },
  { name: 'Harbour', place: 'harbour', night: 2 },
  { name: 'Moon Mile', place: 'moonmile', night: 3 },
  { name: 'Back roads', place: null, night: 3 },
  { name: 'Midnight', place: null, night: 3 },
];
export const LEVELS_PER_CHAPTER = 5;

type Intensity = 0 | 1 | 2;
type LevelDraft = {
  name: string;
  /** Overrides the chapter's place (the mixed chapters name each level's). */
  place?: PlaceId;
  boss?: boolean;
  booths: number;
  dishes: DishId[];
  /** Kit first handed out here (it stays for every later level). */
  kit?: KitId;
  rush?: Intensity;
  mimics?: Intensity;
  demanding?: Intensity;
  spills?: Intensity;
  power?: Intensity;
  jams?: Intensity;
  /** Everyone waits less (fairground kids). */
  impatient?: boolean;
  /** Parties of three and four (truckers, families). */
  big?: boolean;
  /** Mostly pairs (the drive-in's couples). */
  pairs?: boolean;
  /** Extra heat on top of the curve, -0.1..0.1. */
  heat?: number;
};

const B: DishId[] = ['burger'];
const BS: DishId[] = ['burger', 'shake'];
const BFS: DishId[] = ['burger', 'fries', 'shake'];
const ALL: DishId[] = ['burger', 'fries', 'shake', 'pie'];

/** The forty levels, chapter by chapter. Numbers follow from the curve below. */
const DRAFTS: LevelDraft[] = [
  // 1 · Truck stop: the basics, one thing at a time.
  { name: 'First burger', booths: 2, dishes: B, heat: -0.06 },
  { name: 'Shakes', booths: 2, dishes: BS, heat: -0.04 },
  { name: 'Third booth', booths: 3, dishes: BS },
  { name: 'Truckers', booths: 3, dishes: BS, big: true },
  { name: 'Convoy', boss: true, booths: 4, dishes: BS, big: true, rush: 1 },
  // 2 · Drive-in: fries, the Chrome tray and rushes at intermission.
  { name: 'Fries', booths: 3, dishes: BFS, kit: 'chrome-tray', heat: -0.05 },
  { name: 'Intermission', booths: 4, dishes: BFS, rush: 1 },
  { name: 'Car hop', booths: 4, dishes: BFS, pairs: true, rush: 1 },
  { name: 'Double feature', booths: 4, dishes: BFS, rush: 2 },
  {
    name: 'Late show',
    boss: true,
    booths: 5,
    dishes: BFS,
    rush: 2,
    pairs: true,
  },
  // 3 · Old Town: mimics, Out! and roller skates to catch them.
  {
    name: 'Lookalikes',
    booths: 4,
    dishes: BFS,
    mimics: 0,
    kit: 'roller-skates',
    heat: -0.06,
  },
  { name: 'Odd one out', booths: 4, dishes: BFS, mimics: 1 },
  { name: 'Market day', booths: 5, dishes: BFS, mimics: 1, big: true },
  { name: 'Twins', booths: 5, dishes: BFS, mimics: 2, big: true },
  {
    name: 'The Critic',
    boss: true,
    booths: 5,
    dishes: BFS,
    mimics: 1,
    demanding: 2,
  },
  // 4 · Fairground: pie, impatient kids and the coffee urn.
  { name: 'Pie', booths: 4, dishes: ALL, kit: 'coffee-urn', heat: -0.05 },
  { name: 'Sugar rush', booths: 5, dishes: ALL, impatient: true },
  { name: 'Carousel', booths: 5, dishes: ALL, impatient: true, rush: 1 },
  {
    name: 'Family day',
    booths: 5,
    dishes: ALL,
    impatient: true,
    big: true,
    mimics: 1,
  },
  {
    name: 'Fireworks',
    boss: true,
    booths: 6,
    dishes: ALL,
    impatient: true,
    rush: 2,
    mimics: 1,
  },
  // 5 · Harbour: spills to mop and the heat-lamp pass.
  {
    name: 'Wet deck',
    booths: 5,
    dishes: ALL,
    spills: 0,
    kit: 'heat-lamp-pass',
    heat: -0.05,
  },
  { name: 'Fish fry', booths: 5, dishes: ALL, spills: 1, demanding: 0 },
  { name: 'High tide', booths: 5, dishes: ALL, spills: 2, mimics: 1 },
  {
    name: 'Sailors',
    booths: 6,
    dishes: ALL,
    spills: 1,
    big: true,
    demanding: 1,
  },
  {
    name: 'Storm',
    boss: true,
    booths: 6,
    dishes: ALL,
    spills: 2,
    rush: 2,
    mimics: 1,
  },
  // 6 · Moon Mile: brownouts, jams and the twin grill.
  {
    name: 'Brownout',
    booths: 5,
    dishes: ALL,
    power: 0,
    kit: 'twin-grill',
    heat: -0.05,
  },
  { name: 'Jammed', booths: 5, dishes: ALL, jams: 1, power: 0 },
  { name: 'Static', booths: 6, dishes: ALL, power: 1, jams: 1, mimics: 1 },
  {
    name: 'Moonrise',
    booths: 6,
    dishes: ALL,
    power: 1,
    jams: 1,
    demanding: 1,
    spills: 0,
  },
  {
    name: 'Midnight feast',
    boss: true,
    booths: 6,
    dishes: ALL,
    power: 2,
    jams: 2,
    rush: 1,
    mimics: 2,
  },
  // 7 · Back roads: every place again, with the jukebox.
  {
    name: 'Night shift',
    place: 'truckstop',
    booths: 6,
    dishes: ALL,
    kit: 'jukebox',
    big: true,
    rush: 1,
    mimics: 1,
    heat: -0.04,
  },
  {
    name: 'Back row',
    place: 'drivein',
    booths: 6,
    dishes: ALL,
    rush: 2,
    pairs: true,
    demanding: 1,
  },
  {
    name: 'Full moon',
    place: 'oldtown',
    booths: 6,
    dishes: ALL,
    mimics: 2,
    demanding: 1,
    spills: 0,
  },
  {
    name: 'Last ride',
    place: 'fairground',
    booths: 6,
    dishes: ALL,
    impatient: true,
    rush: 1,
    jams: 1,
    mimics: 1,
  },
  {
    name: 'Rush hour',
    place: 'harbour',
    boss: true,
    booths: 6,
    dishes: ALL,
    rush: 2,
    spills: 1,
    demanding: 1,
    mimics: 2,
  },
  // 8 · Midnight: everything, faster, with three lives.
  {
    name: 'Insomnia',
    place: 'moonmile',
    booths: 6,
    dishes: ALL,
    power: 1,
    jams: 1,
    mimics: 2,
    rush: 1,
  },
  {
    name: 'Graveyard shift',
    place: 'oldtown',
    booths: 6,
    dishes: ALL,
    mimics: 2,
    demanding: 2,
    spills: 1,
  },
  {
    name: 'Neon',
    place: 'drivein',
    booths: 6,
    dishes: ALL,
    rush: 2,
    power: 1,
    jams: 1,
    mimics: 1,
  },
  {
    name: 'Witching hour',
    place: 'fairground',
    booths: 6,
    dishes: ALL,
    impatient: true,
    rush: 2,
    spills: 1,
    mimics: 2,
  },
  {
    name: 'Last order',
    place: 'moonmile',
    boss: true,
    booths: 6,
    dishes: ALL,
    rush: 2,
    power: 2,
    jams: 2,
    spills: 1,
    demanding: 1,
    mimics: 2,
  },
];

export const LEVEL_COUNT = DRAFTS.length;
export const isLevelId = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= LEVEL_COUNT;

export type Level = {
  id: number;
  chapter: number;
  name: string;
  place: PlaceId;
  boss: boolean;
  night: NightId;
  seconds: number;
  lives: number;
  stations: StationId[];
  tables: number[];
  menu: Partial<Record<DishId, number>>;
  interval: [number, number];
  sizes: [number, number, number, number];
  patience: { queue: number; order: number; food: number };
  mimics: number;
  firstMimic: number;
  mechanics: ShiftMechanics;
  /** Everything the level hands you, oldest first. */
  kit: KitId[];
  troubles: Trouble[];
  /** What this level brings for the first time. */
  novelties: Novelty[];
  /** Coins for bronze, silver and gold with one waiter. */
  targets: [number, number, number];
};

/** The dish each place's crowd orders twice as often. */
const FAVOURITE: Record<PlaceId, DishId> = {
  truckstop: 'burger',
  drivein: 'shake',
  fairground: 'pie',
  harbour: 'fries',
  oldtown: 'pie',
  moonmile: 'fries',
};
const BASE_MENU: Record<DishId, number> = {
  burger: 3,
  fries: 3,
  shake: 2,
  pie: 2,
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round = (n: number, step = 0.1) =>
  Math.round(Math.round(n / step) * step * 1000) / 1000;

/**
 * Medal targets in coins, one waiter, measured with the bot on the level's
 * own rules (scripts/diner/levels-balance.mjs): bronze is what a steady
 * player takes, gold needs sharp play. Null falls back to the estimate.
 */
const MEASURED: ([number, number, number] | null)[] = [
  [50, 115, 130], // 1 First burger
  [70, 115, 150], // 2 Shakes
  [60, 100, 135], // 3 Third booth
  [85, 115, 140], // 4 Truckers
  [100, 155, 195], // 5 Convoy
  [85, 130, 165], // 6 Fries
  [75, 115, 145], // 7 Intermission
  [75, 120, 150], // 8 Car hop
  [75, 125, 175], // 9 Double feature
  [100, 165, 195], // 10 Late show
  [120, 180, 225], // 11 Lookalikes
  [130, 200, 235], // 12 Odd one out
  [135, 200, 240], // 13 Market day
  [145, 210, 255], // 14 Twins
  [235, 350, 405], // 15 The Critic
  [105, 155, 215], // 16 Pie
  [95, 155, 205], // 17 Sugar rush
  [100, 165, 210], // 18 Carousel
  [140, 180, 240], // 19 Family day
  [140, 200, 235], // 20 Fireworks
  [120, 170, 225], // 21 Wet deck
  [135, 190, 240], // 22 Fish fry
  [125, 180, 235], // 23 High tide
  [150, 210, 285], // 24 Sailors
  [160, 225, 260], // 25 Storm
  [130, 180, 225], // 26 Brownout
  [130, 190, 225], // 27 Jammed
  [125, 180, 240], // 28 Static
  [140, 195, 260], // 29 Moonrise
  [180, 230, 265], // 30 Midnight feast
  [175, 225, 270], // 31 Night shift
  [145, 195, 230], // 32 Back row
  [195, 245, 335], // 33 Full moon
  [150, 195, 240], // 34 Last ride
  [220, 275, 330], // 35 Rush hour
  [165, 210, 265], // 36 Insomnia
  [275, 345, 430], // 37 Graveyard shift
  [175, 220, 270], // 38 Neon
  [160, 200, 260], // 39 Witching hour
  [205, 255, 305], // 40 Last order
];

/** How hard a level is, 0 (the first) to about 1 (the last). */
function heatOf(index: number, d: LevelDraft) {
  const chapter = Math.floor(index / LEVELS_PER_CHAPTER);
  const step = index % LEVELS_PER_CHAPTER;
  const base = [0, 0.12, 0.33, 0.37, 0.44, 0.5, 0.56, 0.61][chapter];
  return Math.max(
    0,
    base + step * 0.028 + (d.boss ? 0.035 : 0) + (d.heat ?? 0),
  );
}

function build(index: number, d: LevelDraft, before: Level | null): Level {
  const chapter = Math.floor(index / LEVELS_PER_CHAPTER);
  const c = CHAPTERS[chapter];
  const place = d.place ?? c.place ?? 'truckstop';
  const h = heatOf(index, d);
  const seconds =
    [90, 100, 110, 110, 120, 120, 130, 140][chapter] + (d.boss ? 20 : 0);
  const lives = chapter >= 7 ? 3 : chapter >= 4 ? 4 : 5;

  const stations = (['grill', 'fryer', 'shake', 'pie'] as StationId[]).filter(
    (s) => d.dishes.includes(stationDish[s]),
  );
  const menu: Partial<Record<DishId, number>> = {};
  for (const dish of d.dishes)
    menu[dish] =
      BASE_MENU[dish] *
      (FAVOURITE[place] === dish && d.dishes.length > 1 ? 2 : 1);

  let lo = lerp(13.5, 5.4, h);
  let sizes: Level['sizes'] = [
    lerp(0.36, 0.07, h),
    lerp(0.46, 0.3, h),
    lerp(0.12, 0.33, h),
    lerp(0.06, 0.3, h),
  ];
  if (d.big)
    sizes = [sizes[0] * 0.35, sizes[1] * 0.8, sizes[2] * 1.4, sizes[3] * 1.7];
  if (d.pairs) {
    sizes = [sizes[0] * 0.8, sizes[1] * 2, sizes[2] * 0.6, sizes[3] * 0.4];
    // Pairs come more often: the same guests in smaller parties.
    lo *= 0.82;
  }
  if (d.big) lo *= 1.12;
  // Every trouble takes time away from serving: guests come a little less
  // often and wait a little longer for each one, so a level is hard because
  // of its trouble, not because trouble piles onto the busiest pace.
  const kinds = (
    ['rush', 'mimics', 'demanding', 'spills', 'power', 'jams'] as const
  ).filter((k) => d[k] !== undefined);
  const weight = kinds.reduce((a, k) => a + 1 + (d[k] ?? 0) * 0.5, 0);
  lo *= 1 + 0.05 * weight;
  const hi = lo + lerp(4.5, 2.4, h);
  const calm = (d.impatient ? 0.8 : 1) * (1 + 0.025 * weight);
  const patience = {
    queue: round(lerp(54, 27, h) * calm),
    order: round(lerp(35, 17, h) * calm),
    food: round(lerp(60, 30, h) * calm),
  };
  const mechanics: ShiftMechanics = {};
  if (d.rush !== undefined)
    mechanics.rush = [
      { every: 42, length: 11, pace: 1.8 },
      { every: 36, length: 13, pace: 2 },
      { every: 30, length: 14, pace: 2.3 },
    ][d.rush];
  if (d.spills !== undefined)
    mechanics.spills = { every: [28, 21, 15][d.spills] };
  if (d.power !== undefined)
    mechanics.power = [
      { every: 40, length: 10, rate: 0.45 },
      { every: 34, length: 11, rate: 0.38 },
      { every: 28, length: 12, rate: 0.3 },
    ][d.power];
  if (d.jams !== undefined)
    mechanics.jams = [
      { every: 44, taps: 1 },
      { every: 34, taps: 2 },
      { every: 26, taps: 2 },
    ][d.jams];
  if (d.demanding !== undefined)
    mechanics.demanding = [
      { chance: 0.2, patience: 0.82, bonus: 6 },
      { chance: 0.35, patience: 0.8, bonus: 6 },
      { chance: 1, patience: 0.75, bonus: 8 },
    ][d.demanding];
  const mimics = d.mimics === undefined ? 0 : [0.3, 0.5, 0.7][d.mimics];
  // The very first mimic comes alone; after that they come early.
  const firstMimic =
    d.mimics === undefined ? seconds + 1 : before?.mimics ? 12 : 25;

  const kit = [...(before?.kit ?? [])];
  if (d.kit && !kit.includes(d.kit)) kit.push(d.kit);
  const troubles: Trouble[] = [];
  if (mechanics.rush) troubles.push('rush');
  if (mimics > 0) troubles.push('mimics');
  if (mechanics.demanding) troubles.push('demanding');
  if (mechanics.spills) troubles.push('spills');
  if (mechanics.power) troubles.push('power');
  if (mechanics.jams) troubles.push('jams');
  if (d.impatient) troubles.push('impatient');
  if (d.big) troubles.push('big-parties');

  const level: Level = {
    id: index + 1,
    chapter,
    name: d.name,
    place,
    boss: !!d.boss,
    night: c.night,
    seconds,
    lives,
    stations,
    tables: openTables(d.booths),
    menu,
    interval: [round(lo), round(hi)],
    sizes: sizes.map((n) => round(n, 0.01)) as Level['sizes'],
    patience,
    mimics,
    firstMimic,
    mechanics,
    kit,
    troubles,
    novelties: [],
    targets: [0, 0, 0],
  };
  level.targets = MEASURED[index] ?? estimateTargets(level);
  return level;
}

/** An estimate from the flow of guests: what arrives, at ten coins and a tip. */
function estimateTargets(l: Level): [number, number, number] {
  const total = l.sizes.reduce((a, b) => a + b, 0);
  const party = l.sizes.reduce((a, w, i) => a + w * (i + 1), 0) / total;
  const rush = l.mechanics.rush;
  const boost = rush ? 1 + ((rush.pace - 1) * rush.length) / rush.every : 1;
  const arrivals =
    ((l.seconds - 22) / ((l.interval[0] + l.interval[1]) / 2)) * boost;
  const expected = arrivals * party * 12.5 * (1 - l.mimics * 0.15);
  const h = Math.min(1, (l.id - 1) / (LEVEL_COUNT - 1));
  const r5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  return [
    r5(expected * lerp(0.36, 0.52, h)),
    r5(expected * lerp(0.6, 0.74, h)),
    r5(expected * lerp(0.82, 0.92, h)),
  ];
}

/** What changed since the levels before: the first time anything shows up. */
function novelties(level: Level, before: Level[]): Novelty[] {
  const out: Novelty[] = [];
  if (level.id === 1) out.push({ kind: 'basics' });
  const seenDishes = new Set(
    before.flatMap((l) => l.stations.map((s) => stationDish[s])),
  );
  for (const s of level.stations) {
    const dish = stationDish[s];
    if (level.id > 1 && !seenDishes.has(dish)) out.push({ kind: 'dish', dish });
  }
  const prevKit = before.at(-1)?.kit ?? [];
  for (const k of level.kit)
    if (!prevKit.includes(k)) out.push({ kind: 'kit', kit: k });
  const seenTrouble = new Set(before.flatMap((l) => l.troubles));
  for (const t of level.troubles)
    if (!seenTrouble.has(t)) out.push({ kind: 'trouble', trouble: t });
  const most = Math.max(0, ...before.map((l) => l.tables.length));
  if (level.id > 1 && level.tables.length > most)
    out.push({ kind: 'booths', count: level.tables.length });
  const fewest = Math.min(Infinity, ...before.map((l) => l.lives));
  if (level.lives < fewest) out.push({ kind: 'lives', count: level.lives });
  if (level.boss) out.push({ kind: 'boss' });
  return out;
}

export const LEVELS: readonly Level[] = (() => {
  const out: Level[] = [];
  DRAFTS.forEach((d, i) => {
    const level = build(i, d, out[i - 1] ?? null);
    level.novelties = novelties(level, out);
    out.push(level);
  });
  return out;
})();

export const levelById = (id: number) => LEVELS[id - 1];
export const chapterLevels = (chapter: number) =>
  LEVELS.filter((l) => l.chapter === chapter);
export const levelPlaceName = (l: Level) => PLACES[l.place].name;

/** The level's kit as a shift's effects. */
export function levelEffects(l: Level): ShiftEffects {
  const e = defaultEffects();
  applyUpgrades(e, Object.fromEntries(l.kit.map((k) => [k, 1])));
  return e;
}

/** A level's shift rules, ready for createConfiguredMatch. */
export function levelConfig(id: number): DinerConfig {
  const l = levelById(id);
  if (!l) throw new Error('Unknown Diner level');
  return {
    v: 2,
    mode: 'level',
    level: l.id,
    runId: 'levels',
    stop: `L${l.id}`,
    stage: l.id - 1,
    place: l.place,
    boss: null,
    title: l.name,
    night: l.night,
    seconds: l.seconds,
    lives: l.lives,
    maxLives: l.lives,
    spec: {
      id: l.night,
      name: l.name,
      stations: [...l.stations],
      tables: [...l.tables],
      menu: { ...l.menu },
      interval: [...l.interval],
      sizes: [...l.sizes],
      mimics: l.mimics,
      firstMimic: l.firstMimic,
      patience: { ...l.patience },
      targets: [...l.targets],
    },
    effects: levelEffects(l),
    mechanics: JSON.parse(JSON.stringify(l.mechanics)) as ShiftMechanics,
  };
}

/** A level is finished with a medal and a life left; that opens the next. */
export const levelPassed = (m: Match) =>
  m.phase === 'over' && m.stars > 0 && m.medals > 0;
export const matchLevel = (m: Match) =>
  m.config?.mode === 'level' && m.config.level
    ? (levelById(m.config.level) ?? null)
    : null;
