import type { ShiftEffects } from './engine.ts';
import type { StationId } from './content.ts';

/**
 * The night route's content (8 October 2026): equipment you find during a
 * run, and the Workshop's permanent upgrades to the diner car. Every item
 * changes how a shift plays; none is a bare few percent.
 */

export type GearIcon =
  | 'grill'
  | 'fries'
  | 'shake'
  | 'pie'
  | 'clock'
  | 'heart'
  | 'coins'
  | 'eye'
  | 'tools'
  | 'bolt'
  | 'wash'
  | 'mop'
  | 'plate'
  | 'star'
  | 'tray'
  | 'skate'
  | 'coffee'
  | 'music'
  | 'tire'
  | 'fuel'
  | 'dice'
  | 'map'
  | 'neon'
  | 'patio';

export type Rarity = 'common' | 'uncommon' | 'rare';
export type GearId =
  | 'turbo-grill'
  | 'quick-blender'
  | 'heat-lamps'
  | 'picture-menus'
  | 'express-eaters'
  | 'welcome-mat'
  | 'warm-plates'
  | 'tip-jar'
  | 'house-special'
  | 'auto-restock'
  | 'set-menu'
  | 'order-pad'
  | 'combo-till'
  | 'cash-runner'
  | 'dishwasher'
  | 'prep-shelf'
  | 'rubber-boots'
  | 'night-watch'
  | 'toolbox'
  | 'backup-battery'
  | 'chrome-tray'
  | 'roller-skates'
  | 'safety-net'
  | 'golden-spatula'
  | 'second-wind';

export type Gear = {
  id: GearId;
  name: string;
  description: string;
  icon: GearIcon;
  rarity: Rarity;
  /** First leg it can turn up on (troubles it answers start there). */
  leg: number;
  /** Used at once instead of kept: never owned, may come up again. */
  instant?: boolean;
};

export const GEAR: Gear[] = [
  {
    id: 'turbo-grill',
    name: 'Turbo grill',
    description: 'Burgers and fries cook 40% faster.',
    icon: 'grill',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'quick-blender',
    name: 'Quick blender',
    description: 'Shakes blend twice as fast.',
    icon: 'shake',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'heat-lamps',
    name: 'Heat lamps',
    description: 'Ready plates wait three times as long before they burn.',
    icon: 'grill',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'picture-menus',
    name: 'Picture menus',
    description: 'Guests are ready to order as soon as they sit.',
    icon: 'clock',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'express-eaters',
    name: 'Express eaters',
    description: 'Guests eat twice as fast, so booths free up sooner.',
    icon: 'plate',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'welcome-mat',
    name: 'Welcome mat',
    description: 'The line waits 50% longer.',
    icon: 'heart',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'warm-plates',
    name: 'Warm plates',
    description:
      'Seated guests wait 40% longer for their order and their food.',
    icon: 'heart',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'tip-jar',
    name: 'Tip jar',
    description: 'Tips are doubled.',
    icon: 'coins',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'house-special',
    name: 'House special',
    description: 'Every guest who pays spends 3 coins more.',
    icon: 'coins',
    rarity: 'common',
    leg: 0,
  },
  {
    id: 'auto-restock',
    name: 'Auto restock',
    description:
      'Taking a plate starts the next one when someone still needs it.',
    icon: 'grill',
    rarity: 'uncommon',
    leg: 0,
  },
  {
    id: 'set-menu',
    name: 'Set menu',
    description: 'Everyone in a party orders the same dish.',
    icon: 'plate',
    rarity: 'uncommon',
    leg: 0,
  },
  {
    id: 'order-pad',
    name: 'Order pad',
    description: 'Take orders and serve from twice as far away.',
    icon: 'clock',
    rarity: 'uncommon',
    leg: 0,
  },
  {
    id: 'combo-till',
    name: 'Combo till',
    description:
      'Serve plates within 10 seconds of each other: +3, +6, then +9 coins.',
    icon: 'coins',
    rarity: 'uncommon',
    leg: 0,
  },
  {
    id: 'cash-runner',
    name: 'Cash runner',
    description: "Guests' coins go straight into the till.",
    icon: 'coins',
    rarity: 'uncommon',
    leg: 0,
  },
  {
    id: 'dishwasher',
    name: 'Dishwasher',
    description: 'Cleared plates wash themselves; your hands stay free.',
    icon: 'wash',
    rarity: 'uncommon',
    leg: 0,
  },
  {
    id: 'prep-shelf',
    name: 'Prep shelf',
    description: 'Every shift opens with a burger and a shake ready.',
    icon: 'plate',
    rarity: 'uncommon',
    leg: 0,
  },
  {
    id: 'rubber-boots',
    name: 'Rubber boots',
    description: 'Puddles and goo never slow you down.',
    icon: 'mop',
    rarity: 'uncommon',
    leg: 1,
  },
  {
    id: 'night-watch',
    name: 'Night watch',
    description: 'Every mimic you catch pays 15 coins more.',
    icon: 'eye',
    rarity: 'uncommon',
    leg: 1,
  },
  {
    id: 'toolbox',
    name: 'Toolbox',
    description: 'One tap fixes a jam, and jams come half as often.',
    icon: 'tools',
    rarity: 'uncommon',
    leg: 1,
  },
  {
    id: 'backup-battery',
    name: 'Backup battery',
    description: 'Brownouts never slow the kitchen.',
    icon: 'bolt',
    rarity: 'uncommon',
    leg: 2,
  },
  {
    id: 'chrome-tray',
    name: 'Chrome tray',
    description: 'Carry three plates at once.',
    icon: 'tray',
    rarity: 'rare',
    leg: 0,
  },
  {
    id: 'roller-skates',
    name: 'Roller skates',
    description: 'Dash across the patio.',
    icon: 'skate',
    rarity: 'rare',
    leg: 0,
  },
  {
    id: 'safety-net',
    name: 'Safety net',
    description: 'The first life you would lose in each shift is saved.',
    icon: 'star',
    rarity: 'rare',
    leg: 0,
  },
  {
    id: 'golden-spatula',
    name: 'Golden spatula',
    description: 'Nothing burns, ever.',
    icon: 'grill',
    rarity: 'rare',
    leg: 0,
  },
  {
    id: 'second-wind',
    name: 'Second wind',
    description: 'Two lives back, now.',
    icon: 'heart',
    rarity: 'rare',
    leg: 0,
    instant: true,
  },
];
export const gearById = (id: GearId) => GEAR.find((g) => g.id === id)!;
export const isGearId = (v: unknown): v is GearId =>
  typeof v === 'string' && GEAR.some((g) => g.id === v);
/** Garage prices, in coins. */
export const GEAR_PRICE: Record<Rarity, number> = {
  common: 75,
  uncommon: 125,
  rare: 200,
};

/** Apply one owned item to a shift's effects. */
export function applyGear(e: ShiftEffects, id: GearId) {
  switch (id) {
    case 'turbo-grill':
      e.cook.grill = (e.cook.grill ?? 1) * 0.6;
      e.cook.fryer = (e.cook.fryer ?? 1) * 0.6;
      break;
    case 'quick-blender':
      e.cook.shake = (e.cook.shake ?? 1) * 0.5;
      break;
    case 'heat-lamps':
      e.burn *= 3;
      break;
    case 'picture-menus':
      e.read = 0.1;
      break;
    case 'express-eaters':
      e.eat *= 0.5;
      break;
    case 'welcome-mat':
      e.patience.queue *= 1.5;
      break;
    case 'warm-plates':
      e.patience.order *= 1.4;
      e.patience.food *= 1.4;
      break;
    case 'tip-jar':
      e.tip *= 2;
      break;
    case 'house-special':
      e.price += 3;
      break;
    case 'auto-restock':
      e.restock = true;
      break;
    case 'set-menu':
      e.uniformOrders = true;
      break;
    case 'order-pad':
      e.reach = 2;
      break;
    case 'combo-till':
      e.combo += 3;
      e.comboWindow = 10;
      break;
    case 'cash-runner':
      e.autoCash = true;
      break;
    case 'dishwasher':
      e.autoWash = true;
      break;
    case 'prep-shelf':
      addStock(e, ['grill', 'shake']);
      break;
    case 'rubber-boots':
      e.rubberBoots = true;
      break;
    case 'night-watch':
      e.bounty += 15;
      break;
    case 'toolbox':
      e.repairPower = 5;
      e.jamInterval *= 2;
      break;
    case 'backup-battery':
      e.backupPower = true;
      break;
    case 'chrome-tray':
      e.hands = Math.max(e.hands, 3);
      break;
    case 'roller-skates':
      e.dash = true;
      break;
    case 'safety-net':
      e.shields++;
      break;
    case 'golden-spatula':
      e.noBurn = true;
      break;
    case 'second-wind':
      break;
  }
}
const addStock = (e: ShiftEffects, ids: StationId[]) => {
  e.starter = [...new Set([...e.starter, ...ids])];
};

// ---------------------------------------------------------------- workshop

export type UpgradeId =
  | 'spare-tire'
  | 'gas-can'
  | 'neon-sign'
  | 'coffee-urn'
  | 'bigger-patio'
  | 'twin-grill'
  | 'roller-skates'
  | 'heat-lamp-pass'
  | 'jukebox'
  | 'chrome-tray'
  | 'lucky-dice'
  | 'road-atlas';

export type Upgrade = {
  id: UpgradeId;
  name: string;
  description: string;
  max: number;
  /** Tokens for each rank. */
  costs: number[];
  icon: GearIcon;
};

/** Cheapest first: a first run usually buys one. */
export const UPGRADES: Upgrade[] = [
  {
    id: 'gas-can',
    name: 'Gas can',
    description: 'Start every run with 25 coins per rank.',
    max: 2,
    costs: [25, 305],
    icon: 'fuel',
  },
  {
    id: 'spare-tire',
    name: 'Spare tire',
    description: 'One more life per rank.',
    max: 2,
    costs: [155, 480],
    icon: 'tire',
  },
  {
    id: 'coffee-urn',
    name: 'Coffee urn',
    description:
      'Fetch a pot from the urn and pour for a waiting party: they calm right down.',
    max: 1,
    costs: [320],
    icon: 'coffee',
  },
  {
    id: 'neon-sign',
    name: 'Neon sign',
    description: 'Every guest who pays spends 2 coins more per rank.',
    max: 2,
    costs: [250, 575],
    icon: 'neon',
  },
  {
    id: 'bigger-patio',
    name: 'Bigger patio',
    description: 'One more booth from the very first stop.',
    max: 1,
    costs: [410],
    icon: 'patio',
  },
  {
    id: 'twin-grill',
    name: 'Twin grill',
    description: 'The grill cooks three burgers at once.',
    max: 1,
    costs: [480],
    icon: 'grill',
  },
  {
    id: 'roller-skates',
    name: 'Roller skates',
    description: 'Every run starts with Dash.',
    max: 1,
    costs: [560],
    icon: 'skate',
  },
  {
    id: 'heat-lamp-pass',
    name: 'Heat-lamp pass',
    description:
      'A shelf for three plates. Full hands put a plate down; a free hand picks one up.',
    max: 1,
    costs: [480],
    icon: 'plate',
  },
  {
    id: 'jukebox',
    name: 'Jukebox',
    description:
      "Play a song and everyone's patience stops for 8 seconds. It rests 45 seconds between songs.",
    max: 1,
    costs: [645],
    icon: 'music',
  },
  {
    id: 'lucky-dice',
    name: 'Lucky dice',
    description: 'Reroll the equipment on offer once per leg.',
    max: 1,
    costs: [410],
    icon: 'dice',
  },
  {
    id: 'road-atlas',
    name: 'Road atlas',
    description: 'See what the stops after next will pay.',
    max: 1,
    costs: [320],
    icon: 'map',
  },
  {
    id: 'chrome-tray',
    name: 'Chrome tray',
    description: 'Every run starts with three hands for plates.',
    max: 1,
    costs: [805],
    icon: 'tray',
  },
];
export const upgradeById = (id: UpgradeId) =>
  UPGRADES.find((u) => u.id === id)!;
export const isUpgradeId = (v: unknown): v is UpgradeId =>
  typeof v === 'string' && UPGRADES.some((u) => u.id === v);
export type UpgradeRanks = Partial<Record<UpgradeId, number>>;

/** Lives a run starts with, before the Workshop. */
export const BASE_LIVES = 4;

export function applyUpgrades(e: ShiftEffects, ranks: UpgradeRanks) {
  e.price += 2 * (ranks['neon-sign'] ?? 0);
  if (ranks['coffee-urn']) e.coffee = true;
  if (ranks['twin-grill']) e.grillLanes = 3;
  if (ranks['roller-skates']) e.dash = true;
  if (ranks['heat-lamp-pass']) e.pass = true;
  if (ranks.jukebox) e.jukebox = true;
  if (ranks['chrome-tray']) e.hands = Math.max(e.hands, 3);
}
