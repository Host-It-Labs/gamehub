/**
 * Diner's content: three nights, four dishes and the parts guests are dressed
 * in. Little of it, on purpose (3 October 2026): every night has its own
 * identity and every look part reads at play size on a phone.
 */

export type DishId = 'burger' | 'shake' | 'pie' | 'fries';
/** Where things happen along the back counter. */
export type StationId = 'grill' | 'fryer' | 'shake' | 'pie';
export type CounterId = StationId | 'sink' | 'bin';

export type Dish = {
  name: string;
  station: StationId;
  /** Seconds from Use to a plate; 0 is instant. */
  cook: number;
  /** Seconds a ready plate waits before it burns; null never spoils. */
  burn: number | null;
};

export const dishes: Record<DishId, Dish> = {
  burger: { name: 'Burger', station: 'grill', cook: 4, burn: 8 },
  shake: { name: 'Milkshake', station: 'shake', cook: 3, burn: null },
  pie: { name: 'Pie', station: 'pie', cook: 0, burn: null },
  fries: { name: 'Fries', station: 'fryer', cook: 5, burn: 8 },
};
export const DISHES = Object.keys(dishes) as DishId[];
export const stationDish: Record<StationId, DishId> = {
  grill: 'burger',
  fryer: 'fries',
  shake: 'shake',
  pie: 'pie',
};

export type NightId = 1 | 2 | 3;
export type Night = {
  id: NightId;
  name: string;
  stations: StationId[];
  /** Table slots open this night (layout.ts TABLES). */
  tables: number[];
  /** Relative odds of each dish on an order. */
  menu: Partial<Record<DishId, number>>;
  /** Seconds between arrivals for one waiter: [shortest, longest]. */
  interval: [number, number];
  /** Odds of a party of one, two, three and four. */
  sizes: [number, number, number, number];
  /** Share of parties of three or four with a mimic in them. */
  mimics: number;
  /** No mimic before this second; the first one comes alone, to a quiet door. */
  firstMimic: number;
  /** Seconds of patience while waiting in line, for the order and for food. */
  patience: { queue: number; order: number; food: number };
  /** Coins for one, two and three medals with one waiter. */
  targets: [number, number, number];
};

export const nights: Record<NightId, Night> = {
  1: {
    id: 1,
    name: 'Opening',
    stations: ['grill', 'shake'],
    tables: [0, 1, 3],
    menu: { burger: 3, shake: 2 },
    interval: [12, 17],
    sizes: [0.3, 0.45, 0.15, 0.1],
    mimics: 0,
    firstMimic: Infinity,
    patience: { queue: 50, order: 32, food: 55 },
    targets: [90, 170, 250],
  },
  2: {
    id: 2,
    name: 'Regulars',
    stations: ['grill', 'shake', 'pie'],
    tables: [0, 1, 2, 3],
    menu: { burger: 3, shake: 2, pie: 2 },
    interval: [11, 15],
    sizes: [0.15, 0.4, 0.27, 0.18],
    mimics: 0.4,
    firstMimic: 30,
    patience: { queue: 45, order: 30, food: 52 },
    targets: [110, 200, 290],
  },
  3: {
    id: 3,
    name: 'Full moon',
    stations: ['grill', 'fryer', 'shake', 'pie'],
    tables: [0, 1, 2, 3, 4],
    menu: { burger: 3, shake: 2, pie: 2, fries: 3 },
    interval: [9.5, 13],
    sizes: [0.1, 0.35, 0.3, 0.25],
    mimics: 0.6,
    firstMimic: 12,
    patience: { queue: 42, order: 28, food: 50 },
    targets: [130, 230, 320],
  },
};
export const NIGHTS: NightId[] = [1, 2, 3];
export const isNight = (n: unknown): n is NightId =>
  n === 1 || n === 2 || n === 3;

/** Coins for a guest who pays, and the most one guest tips. */
export const PRICE = 10;
export const TIP = 5;
/** Coins for throwing out a mimic. */
export const MIMIC_BOUNTY = 15;
export const STARS = 5;
export const MAX_PLAYERS = 4;

/** With more waiters guests come faster and the medals ask for more. */
const PACE = [1, 1.6, 2.1, 2.5];
const TARGETS = [1, 1.7, 2.2, 2.6];
export const coop = (players: number) => {
  const n = Math.max(1, Math.min(4, Math.round(players))) - 1;
  return { pace: PACE[n], targets: TARGETS[n] };
};

// ---------------------------------------------------------------- looks

/**
 * A guest is dressed from a few clear parts. Everyone in a party wears the
 * same outfit (hat, shirt colour, stripes, glasses); skin and hair differ
 * from person to person and are never a clue. A mimic copies the outfit but
 * gets exactly one of those four parts wrong.
 */
export type HatId = 'none' | 'cap' | 'bowler' | 'beanie' | 'cowboy';
export const HATS: HatId[] = ['none', 'cap', 'bowler', 'beanie', 'cowboy'];
export type Look = {
  skin: number;
  hair: number;
  hat: HatId;
  shirt: number;
  stripes: boolean;
  glasses: boolean;
};
export type OutfitPart = 'hat' | 'shirt' | 'stripes' | 'glasses';
export const OUTFIT: OutfitPart[] = ['hat', 'shirt', 'stripes', 'glasses'];

export const SKINS = ['#f6d3b3', '#e8b48c', '#c98d62', '#9c6440', '#6e4329'];
export const HAIRS = ['#2b1d16', '#6b3d1f', '#c98a3d', '#e9d18a', '#8d8d93'];
/** Shirt colours that stay apart under the diner's warm light. */
export const SHIRTS = [
  '#e2463c', // cherry
  '#3e7fd8', // sky
  '#f2c234', // mustard
  '#37a865', // green
  '#f07fb4', // bubblegum
  '#2d2e38', // black
];
export const SHIRT_NAMES = ['red', 'blue', 'yellow', 'green', 'pink', 'black'];
export const HAT_COLOURS: Record<Exclude<HatId, 'none'>, string> = {
  cap: '#d8322b',
  bowler: '#26242a',
  beanie: '#f0a12a',
  cowboy: '#b9834c',
};

export const sameOutfit = (a: Look, b: Look) =>
  a.hat === b.hat &&
  a.shirt === b.shirt &&
  a.stripes === b.stripes &&
  a.glasses === b.glasses;

/** Which outfit part differs between two looks (null when none, or several). */
export function outfitDifference(a: Look, b: Look): OutfitPart | null {
  const parts = OUTFIT.filter((p) => a[p] !== b[p]);
  return parts.length === 1 ? parts[0] : null;
}

/** A short plain description, for screen readers. */
export function describeLook(l: Look) {
  const bits = [
    l.hat === 'none'
      ? 'no hat'
      : `a ${l.hat === 'cap' ? 'red cap' : l.hat === 'bowler' ? 'bowler hat' : l.hat === 'beanie' ? 'orange beanie' : 'cowboy hat'}`,
    `a ${l.stripes ? 'striped ' : ''}${SHIRT_NAMES[l.shirt]} shirt`,
  ];
  if (l.glasses) bits.push('dark glasses');
  return bits.join(', ');
}
