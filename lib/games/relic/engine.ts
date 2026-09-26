import { actFactory, advanceFactory, type FactoryAction } from './factory.ts';
import {
  actScratch,
  createScratch,
  type ScratchAction,
  type ScratchResult,
  type ScratchState,
} from './scratch.ts';
/** Relic's authoritative, clock-driven economy. No client clocks or random inputs. */
export const WORLDS = [
  {
    id: 'dunes',
    name: 'Amber dunes',
    subtitle: 'Warm sand. Ancient giants.',
    color: '#dc9b59',
    unlock: 0,
    description: 'Fossils, sunstone and curious desert keepsakes.',
  },
  {
    id: 'cavern',
    name: 'Velvet cavern',
    subtitle: 'A little light beneath the world.',
    color: '#83d7ce',
    unlock: 1800,
    description: 'Luminous crystals and treasures from the deep.',
  },
  {
    id: 'ruins',
    name: 'The quiet garden',
    subtitle: 'Something beautiful, left behind.',
    color: '#a4be7a',
    unlock: 12000,
    description: 'Mossy ceramics, lost toys and tiny forgotten gods.',
  },
] as const;
export type WorldId = (typeof WORLDS)[number]['id'];
export type Rarity = 'common' | 'unusual' | 'rare' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'unusual', 'rare', 'legendary'];
export type Artifact = {
  id: string;
  name: string;
  world: WorldId;
  rarity: Rarity;
  shape: 'shell' | 'bone' | 'crystal' | 'vase' | 'leaf' | 'idol';
  color: string;
  story: string;
  layer: number;
};
const names = {
  dunes: [
    'Pocket ammonite',
    'Honey stone',
    'Little backbone',
    'Desert rose',
    'Spiral sun',
    'Amber feather',
    'Moon snail',
    'Sleeping tusk',
    'Glass scarab',
    'Golden nautilus',
    'Starlight egg',
    'The gentle giant',
  ],
  cavern: [
    'Mint quartz',
    'Violet tooth',
    'Glow pebble',
    'Copper bloom',
    'Crystal moth',
    'Ribbon geode',
    'Frozen echo',
    'Silver lantern',
    'Midnight prism',
    'Aurora heart',
    'A bottled star',
    'The deep crown',
  ],
  ruins: [
    'Tea for two',
    'Moss button',
    'Clay bird',
    'Garden bell',
    'Little guardian',
    'Painted leaf',
    'Rain cup',
    'Sleepy fox',
    'Jade blossom',
    'The first seed',
    'Tiny moon temple',
    'The smiling sun',
  ],
};
const shapes: Artifact['shape'][] = [
  'shell',
  'crystal',
  'bone',
  'crystal',
  'idol',
  'leaf',
  'shell',
  'bone',
  'idol',
  'shell',
  'vase',
  'bone',
];
const stories = [
  'Small enough for a pocket. Somehow worth a whole afternoon.',
  'It catches the light a little differently every time you look.',
  'Somebody, somewhere, would have been very fond of this.',
  'A quiet reminder that beautiful things take their time.',
  'The expedition unanimously agrees: this one has character.',
  'Found under a very ordinary-looking patch of earth.',
];
export const ARTIFACTS: Artifact[] = WORLDS.flatMap((world) =>
  names[world.id].map((name, i) => ({
    id: `${world.id}-${i}`,
    name,
    world: world.id,
    rarity: RARITIES[Math.floor(i / 3)],
    shape:
      world.id === 'ruins'
        ? (['vase', 'leaf', 'idol'][i % 3] as Artifact['shape'])
        : world.id === 'cavern'
          ? i % 3 === 2
            ? 'idol'
            : 'crystal'
          : shapes[i],
    color: ['#edba6c', '#8edacd', '#dfa5c1', '#d6e39c'][Math.floor(i / 3)],
    story: stories[i % stories.length],
    layer: [1, 3, 8, 16][Math.floor(i / 3)],
  })),
);
export const HELPERS = [
  {
    id: 'brush',
    name: 'Brush buddy',
    description: 'A little friend with a very big brush.',
    cost: 25,
    income: 0.5,
    survey: 0.0007,
    icon: 'brush',
  },
  {
    id: 'sieve',
    name: 'Sand sifter',
    description: 'Every grain gets a second look.',
    cost: 220,
    income: 3.5,
    survey: 0.0015,
    icon: 'sieve',
  },
  {
    id: 'cart',
    name: 'Rail rover',
    description: 'Tiny tracks. Seriously useful.',
    cost: 2200,
    income: 25,
    survey: 0.003,
    icon: 'cart',
  },
  {
    id: 'drill',
    name: 'Gentle drill',
    description: 'Precision excavation. Absolutely no hurry.',
    cost: 24000,
    income: 180,
    survey: 0.005,
    icon: 'drill',
  },
  {
    id: 'balloon',
    name: 'Survey balloon',
    description: 'Big discoveries from a little higher up.',
    cost: 280000,
    income: 1400,
    survey: 0.008,
    icon: 'balloon',
  },
] as const;
export type HelperId = (typeof HELPERS)[number]['id'];
export const UPGRADES = [
  {
    id: 'tool',
    name: 'Better brush',
    description: '+2 digging strength per level.',
    cost: 35,
    growth: 1.65,
    max: 40,
  },
  {
    id: 'boots',
    name: 'Lucky pockets',
    description: '+25% coins from every touch per level.',
    cost: 80,
    growth: 1.8,
    max: 30,
  },
  {
    id: 'bench',
    name: 'Restoration tools',
    description: 'Restore finds faster. Unlocks a second and third bench.',
    cost: 120,
    growth: 2.2,
    max: 10,
  },
  {
    id: 'curator',
    name: 'Night curator',
    description:
      'Automatically opens crates and restores finds, while you play any room.',
    cost: 650,
    growth: 1,
    max: 1,
  },
  {
    id: 'trade',
    name: 'Museum shop',
    description: 'Automatically sells restored duplicates for bonus coins.',
    cost: 1400,
    growth: 1,
    max: 1,
  },
  {
    id: 'research',
    name: 'Field research',
    description: '+20% helper income per level. Keeps every discovery.',
    cost: 10000,
    growth: 2,
    max: 30,
  },
] as const;
export type UpgradeId = (typeof UPGRADES)[number]['id'];
export const DECOR = [
  { id: 'linen', name: 'Linen & oak', cost: 0 },
  { id: 'velvet', name: 'Midnight velvet', cost: 900 },
  { id: 'botanical', name: 'Botanical house', cost: 4500 },
  { id: 'gold', name: 'Golden gallery', cost: 25000 },
] as const;
export type DecorId = (typeof DECOR)[number]['id'];
export type Tile = {
  hp: number;
  max: number;
  kind: 'sand' | 'stone' | 'gem' | 'find';
};
export type Find = { count: number; firstBy: string; foundAt: number };
export type Job = {
  id: number;
  artifact: string;
  startedAt: number;
  finishesAt: number;
  by: string;
};
export type Entry = { id: number; text: string; at: number };
export type RelicGame = {
  version: 1;
  scratch?: ScratchState;
  /** Read once when migrating the retired room prototype. */
  arcade?: unknown;
  seed: number;
  name: string;
  startedAt: number;
  lastAt: number;
  revision: number;
  world: WorldId;
  unlocked: WorldId[];
  layers: Record<WorldId, number>;
  boards: Record<WorldId, Tile[]>;
  coins: number;
  /** Development only: keeps the purse full; the server refuses it in production. */
  devUnlimited?: boolean;
  earned: number;
  helpers: Record<HelperId, number>;
  upgrades: Record<UpgradeId, number>;
  crates: Record<WorldId, number>;
  survey: number;
  jobs: Job[];
  nextId: number;
  collection: Record<string, Find>;
  displays: (string | null)[];
  decor: DecorId;
  ownedDecor: DecorId[];
  dug: number;
  goals: string[];
  journal: Entry[];
  lastFind: string | null;
};
export type RelicAction =
  | ScratchAction
  | FactoryAction
  | { type: 'dig'; tile: number; world: WorldId; layer: number }
  | { type: 'descend'; world: WorldId; layer: number }
  | { type: 'helper'; id: HelperId; quantity: 1 | 10 }
  | { type: 'upgrade'; id: UpgradeId }
  | { type: 'restore'; world: WorldId }
  | { type: 'travel'; world: WorldId }
  | { type: 'display'; artifact: string | null; slot: number }
  | { type: 'decor'; id: DecorId }
  | { type: 'rename'; name: string }
  | { type: 'dev-unlimited'; on: boolean };
export type ActionResult = ScratchResult & {
  coins?: number;
  cleared?: boolean;
  crate?: boolean;
  artifact?: string;
};
const MAX_COINS = 1e18;
const DEV_COINS = 1e17;
function devRefill(g: RelicGame) {
  if (g.devUnlimited) g.coins = Math.max(g.coins, DEV_COINS);
}
export function random(g: RelicGame) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
function board(g: RelicGame, world: WorldId) {
  const layer = g.layers[world];
  return Array.from({ length: 20 }, (_, i): Tile => {
    const r = random(g);
    const kind =
      i === 7 || i === 16
        ? 'find'
        : r < 0.18
          ? 'gem'
          : r < 0.4
            ? 'stone'
            : 'sand';
    const hp = Math.ceil(
      (2 + Math.sqrt(layer) * 1.3) * (kind === 'stone' ? 1.5 : 1),
    );
    return { hp, max: hp, kind };
  });
}
export function createRelic(
  name: string,
  world: WorldId,
  seed: number,
  now: number,
): RelicGame {
  if (!WORLDS.some((w) => w.id === world))
    throw new Error('Choose an expedition landscape.');
  const g: RelicGame = {
    version: 1,
    scratch: createScratch(),
    seed: seed >>> 0,
    name,
    startedAt: now,
    lastAt: now,
    revision: 0,
    world,
    unlocked: [world],
    layers: { dunes: 1, cavern: 1, ruins: 1 },
    boards: { dunes: [], cavern: [], ruins: [] },
    coins: 0,
    earned: 0,
    helpers: { brush: 0, sieve: 0, cart: 0, drill: 0, balloon: 0 },
    upgrades: {
      tool: 0,
      boots: 0,
      bench: 0,
      curator: 0,
      trade: 0,
      research: 0,
    },
    crates: { dunes: 0, cavern: 0, ruins: 0 },
    survey: 0,
    jobs: [],
    nextId: 1,
    collection: {},
    displays: Array(6).fill(null),
    decor: 'linen',
    ownedDecor: ['linen'],
    dug: 0,
    goals: [],
    journal: [],
    lastFind: null,
  };
  for (const w of WORLDS) g.boards[w.id] = board(g, w.id);
  return g;
}
export function helperMultiplier(count: number) {
  return 2 ** [10, 25, 50, 100].filter((n) => count >= n).length;
}
export function helperRate(g: RelicGame, id: HelperId) {
  const helper = HELPERS.find((h) => h.id === id)!;
  return (
    helper.income *
    g.helpers[id] *
    helperMultiplier(g.helpers[id]) *
    (1 + g.upgrades.research * 0.2)
  );
}
export function museumRate(g: RelicGame) {
  return ARTIFACTS.reduce(
    (sum, a) =>
      sum +
      (g.collection[a.id] ? [0.15, 0.5, 2, 8][RARITIES.indexOf(a.rarity)] : 0),
    0,
  );
}
export function incomeRate(g: RelicGame) {
  return HELPERS.reduce((s, h) => s + helperRate(g, h.id), museumRate(g));
}
export function surveyRate(g: RelicGame) {
  return Math.min(
    1 / 30,
    HELPERS.reduce((s, h) => s + h.survey * g.helpers[h.id], 0),
  );
}
export function toolPower(g: RelicGame) {
  return 1 + 2 * g.upgrades.tool;
}
export function benchSlots(g: RelicGame) {
  return 1 + Number(g.upgrades.bench >= 2) + Number(g.upgrades.bench >= 5);
}
export function helperCost(g: RelicGame, id: HelperId, quantity = 1) {
  const h = HELPERS.find((x) => x.id === id);
  if (
    !h ||
    (quantity !== 1 && quantity !== 10) ||
    g.helpers[id] + quantity > 100
  )
    return Infinity;
  return Array.from({ length: quantity }, (_, n) =>
    Math.ceil(h.cost * 1.16 ** (g.helpers[id] + n)),
  ).reduce((a, b) => a + b, 0);
}
export function upgradeCost(g: RelicGame, id: UpgradeId) {
  const u = UPGRADES.find((x) => x.id === id);
  return !u || g.upgrades[id] >= u.max
    ? Infinity
    : Math.ceil(u.cost * u.growth ** g.upgrades[id]);
}
function earn(g: RelicGame, coins: number) {
  g.coins = Math.min(MAX_COINS, g.coins + coins);
  g.earned = Math.min(MAX_COINS, g.earned + coins);
}
function spend(g: RelicGame, cost: number) {
  if (!Number.isFinite(cost) || cost < 0 || g.coins + 1e-8 < cost)
    throw new Error('Keep digging — you need a few more coins.');
  g.coins = Math.max(0, g.coins - cost);
}
function log(g: RelicGame, text: string, now: number) {
  g.journal.unshift({ id: g.nextId++, text, at: now });
  g.journal = g.journal.slice(0, 30);
}
function selectArtifact(g: RelicGame, world: WorldId) {
  const eligible = ARTIFACTS.filter(
    (a) => a.world === world && a.layer <= g.layers[world],
  );
  // New discoveries have a gentle bias. Even rare finds eventually feel reachable.
  const weights = eligible.map(
    (a) =>
      [12, 6, 2, 0.65][RARITIES.indexOf(a.rarity)] *
      (g.collection[a.id] ? 1 : 2),
  );
  let pick = random(g) * weights.reduce((a, b) => a + b, 0);
  return (
    eligible.find((_, i) => (pick -= weights[i]) < 0) ??
    eligible[eligible.length - 1]
  );
}
function beginRestoration(
  g: RelicGame,
  world: WorldId,
  by: string,
  now: number,
) {
  if (g.crates[world] < 1)
    throw new Error('Uncover a find or let your helpers fill a crate first.');
  if (g.jobs.length >= benchSlots(g))
    throw new Error('All restoration benches are busy.');
  const artifact = selectArtifact(g, world);
  g.crates[world]--;
  const seconds =
    (25 + RARITIES.indexOf(artifact.rarity) * 20) /
    (1 + g.upgrades.bench * 0.3);
  g.jobs.push({
    id: g.nextId++,
    artifact: artifact.id,
    startedAt: now,
    finishesAt: now + seconds * 1000,
    by,
  });
  return artifact.id;
}
export const GOALS = [
  {
    id: 'dig20',
    name: 'A little deeper',
    description: 'Clear 20 patches',
    target: 20,
    reward: 60,
  },
  {
    id: 'find3',
    name: 'A collection begins',
    description: 'Restore 3 different finds',
    target: 3,
    reward: 150,
  },
  {
    id: 'crew10',
    name: 'Many tiny hands',
    description: 'Hire 10 helpers',
    target: 10,
    reward: 400,
  },
  {
    id: 'dig200',
    name: 'Layers of stories',
    description: 'Clear 200 patches',
    target: 200,
    reward: 2000,
  },
  {
    id: 'find12',
    name: 'Worth a visit',
    description: 'Restore 12 different finds',
    target: 12,
    reward: 6000,
  },
  {
    id: 'world3',
    name: 'Our little world',
    description: 'Visit all 3 landscapes',
    target: 3,
    reward: 15000,
  },
  {
    id: 'find36',
    name: 'A cabinet of wonders',
    description: 'Restore all 36 finds',
    target: 36,
    reward: 250000,
  },
] as const;
export function goalProgress(g: RelicGame, id: string) {
  return id.startsWith('dig')
    ? g.dug
    : id.startsWith('find')
      ? Object.keys(g.collection).length
      : id === 'world3'
        ? g.unlocked.length
        : Object.values(g.helpers).reduce((a, b) => a + b, 0);
}
function goals(g: RelicGame, now: number) {
  for (const goal of GOALS)
    if (!g.goals.includes(goal.id) && goalProgress(g, goal.id) >= goal.target) {
      g.goals.push(goal.id);
      earn(g, goal.reward);
      log(g, `${goal.name} · +${goal.reward.toLocaleString('en')} coins`, now);
    }
}
function finishJobs(g: RelicGame, now: number) {
  const done = g.jobs.filter((j) => j.finishesAt <= now + 0.001);
  g.jobs = g.jobs.filter((j) => j.finishesAt > now + 0.001);
  for (const job of done) {
    const a = ARTIFACTS.find((a) => a.id === job.artifact)!;
    const existing = g.collection[a.id];
    if (existing) {
      existing.count++;
      if (g.upgrades.trade)
        earn(g, [12, 45, 180, 900][RARITIES.indexOf(a.rarity)]);
    } else {
      g.collection[a.id] = {
        count: 1,
        firstBy: job.by,
        foundAt: job.finishesAt,
      };
      const free = g.displays.indexOf(null);
      if (free !== -1) g.displays[free] = a.id;
      log(g, `${job.by} discovered ${a.name}`, job.finishesAt);
    }
    g.lastFind = a.id;
  }
  if (done.length) goals(g, now);
}
/** Absence never earns anything. Only server-confirmed activity advances production. */
export function advanceRelic(g: RelicGame, now: number, activeMs = 0) {
  if (!Number.isFinite(now) || now < g.lastAt) return;
  if (!Number.isFinite(activeMs) || activeMs < 0) return;
  const end = now;
  let cursor = now - activeMs;
  for (const job of g.jobs) {
    job.startedAt += cursor - g.lastAt;
    job.finishesAt += cursor - g.lastAt;
  }
  advanceFactory(g, activeMs);
  if (!activeMs) {
    g.lastAt = now;
    return;
  }
  const findRate = surveyRate(g);
  while (cursor < end) {
    finishJobs(g, cursor);
    if (g.upgrades.curator) {
      for (const world of WORLDS)
        while (g.crates[world.id] > 0 && g.jobs.length < benchSlots(g))
          beginRestoration(g, world.id, 'The night curator', cursor);
    }
    let next = end;
    for (const job of g.jobs) next = Math.min(next, job.finishesAt);
    if (g.upgrades.curator && g.jobs.length < benchSlots(g) && findRate > 0)
      next = Math.min(
        next,
        cursor + Math.max(0.001, ((1 - g.survey) / findRate) * 1000),
      );
    const seconds = Math.max(0, next - cursor) / 1000;
    earn(g, incomeRate(g) * seconds);
    const progress = g.survey + findRate * seconds;
    const crates = Math.floor(progress + 1e-9);
    g.crates[g.world] += crates;
    g.survey = Math.max(0, progress - crates);
    cursor = next;
  }
  finishJobs(g, end);
  if (g.upgrades.curator)
    for (const world of WORLDS)
      while (g.crates[world.id] > 0 && g.jobs.length < benchSlots(g))
        beginRestoration(g, world.id, 'The night curator', end);
  g.lastAt = now;
}
export function actRelic(
  g: RelicGame,
  action: RelicAction,
  actor: string,
  now: number,
  actorId = actor,
): ActionResult {
  advanceRelic(g, now);
  devRefill(g);
  let result: ActionResult = {};
  switch (action.type) {
    case 'dev-unlimited':
      g.devUnlimited = action.on === true;
      break;
    case 'scratch-open':
    case 'scratch-stroke':
    case 'scratch-book':
    case 'scratch-upgrade':
      result = actScratch(g, action, actorId, now);
      break;
    case 'factory-blueprint':
    case 'factory-build':
    case 'factory-remove':
    case 'factory-rotate':
    case 'factory-move':
    case 'factory-book':
      actFactory(g, action);
      break;
    case 'dig': {
      if (action.world !== g.world || action.layer !== g.layers[g.world])
        throw new Error('The expedition has moved. Your view is refreshing.');
      if (
        !Number.isInteger(action.tile) ||
        action.tile < 0 ||
        action.tile >= 20
      )
        throw new Error('Choose a patch to excavate.');
      const tile = g.boards[g.world][action.tile];
      if (!tile.hp) return result;
      const hit = Math.min(tile.hp, toolPower(g));
      tile.hp -= hit;
      const coins =
        hit *
        (1 + g.upgrades.boots * 0.25) *
        (1 + (g.layers[g.world] - 1) * 0.15) *
        (tile.kind === 'gem' ? 3 : 1);
      earn(g, coins);
      result = { coins, cleared: tile.hp === 0, crate: false };
      if (tile.hp === 0) {
        g.dug++;
        if (tile.kind === 'find') {
          g.crates[g.world]++;
          result.crate = true;
        }
      }
      break;
    }
    case 'descend':
      if (action.world !== g.world || action.layer !== g.layers[g.world])
        throw new Error('This layer has already changed.');
      if (g.boards[g.world].some((t) => t.hp > 0))
        throw new Error('Finish clearing this layer first.');
      earn(g, 25 * g.layers[g.world]);
      g.layers[g.world]++;
      g.boards[g.world] = board(g, g.world);
      log(
        g,
        `${actor} opened layer ${g.layers[g.world]} of ${WORLDS.find((w) => w.id === g.world)!.name}`,
        now,
      );
      break;
    case 'helper':
      if (action.quantity !== 1 && action.quantity !== 10)
        throw new Error('Choose one or ten helpers.');
      spend(g, helperCost(g, action.id, action.quantity));
      g.helpers[action.id] += action.quantity;
      break;
    case 'upgrade':
      spend(g, upgradeCost(g, action.id));
      g.upgrades[action.id]++;
      break;
    case 'restore':
      if (!WORLDS.some((w) => w.id === action.world))
        throw new Error('Choose a landscape.');
      result.artifact = beginRestoration(g, action.world, actor, now);
      break;
    case 'travel': {
      const world = WORLDS.find((w) => w.id === action.world);
      if (!world) throw new Error('Choose a landscape.');
      if (!g.unlocked.includes(world.id)) {
        spend(g, world.unlock || 1800);
        g.unlocked.push(world.id);
      }
      g.world = world.id;
      break;
    }
    case 'display':
      if (
        !Number.isInteger(action.slot) ||
        action.slot < 0 ||
        action.slot >= 6 ||
        (action.artifact !== null &&
          !ARTIFACTS.some(
            (a) => a.id === action.artifact && g.collection[a.id],
          ))
      )
        throw new Error('Choose a restored find and a museum plinth.');
      g.displays = g.displays.map((id) => (id === action.artifact ? null : id));
      g.displays[action.slot] = action.artifact;
      break;
    case 'decor': {
      const decor = DECOR.find((d) => d.id === action.id);
      if (!decor) throw new Error('Choose a museum style.');
      if (!g.ownedDecor.includes(decor.id)) {
        spend(g, decor.cost);
        g.ownedDecor.push(decor.id);
      }
      g.decor = decor.id;
      break;
    }
    case 'rename': {
      if (typeof action.name !== 'string')
        throw new Error('Name your expedition.');
      const name = action.name.trim();
      if (
        !name ||
        name.length > 40 ||
        name
          .split('')
          .some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
      )
        throw new Error('Use a name of 1–40 characters.');
      g.name = name;
      break;
    }
    default:
      throw new Error('Unknown expedition action.');
  }
  goals(g, now);
  devRefill(g);
  g.revision++;
  return result;
}
export function formatNumber(n: number) {
  if (!Number.isFinite(n)) return 'Max';
  if (n < 1000) return Math.floor(n).toLocaleString('en');
  const scales: [number, string][] = [
    [1e18, 'Qi'],
    [1e15, 'Qa'],
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  const [size, suffix] = scales.find(([size]) => n >= size)!;
  return `${(n / size).toFixed(n / size < 10 ? 2 : 1).replace(/\.0+$|(?<=\.[0-9])0$/, '')}${suffix}`;
}
