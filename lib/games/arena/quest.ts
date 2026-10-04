import {
  allCards,
  cards,
  isSpell,
  troopCards,
  troopOf,
  type CardId,
  type TroopId,
} from './cards.ts';
import { presets } from './decks.ts';
import type { Boost, Difficulty, MatchOptions, Mode } from './engine.ts';

/**
 * Quest: Arena's roguelite. A run crosses three regions; each region is a
 * small map of stops in rows, walked from the bottom to its boss. Battles
 * win gold and a choice of reward (a new card, an upgrade, or a charm from
 * elites and bosses); camps rest or train; shops sell; events offer a
 * trade. Losing a battle costs a heart; the run ends with the last heart or
 * with the third boss beaten. Played alone (one against one) or with a
 * friend (two against two, the same deck each), where the table's host
 * makes the choices.
 *
 * Everything here is pure: `questAct` returns a new state, and every roll
 * comes from the run's own dice, so the server and every device agree.
 */
export type CharmId =
  | 'well'
  | 'brew'
  | 'walls'
  | 'arrows'
  | 'drums'
  | 'hide'
  | 'steel'
  | 'coin'
  | 'rock'
  | 'wind'
  | 'crown'
  | 'heart'
  | 'mentor'
  | 'haggle';

export type Charm = {
  name: string;
  /** One short line: what it does. */
  text: string;
  boost?: Boost;
};

export const charms: Record<CharmId, Charm> = {
  well: {
    name: 'Deep Well',
    text: 'Start battles with 9 elixir.',
    boost: { elixirStart: 9 },
  },
  brew: {
    name: 'Quick Brew',
    text: 'Elixir refills 12% faster.',
    boost: { elixirRate: 1.12 },
  },
  walls: {
    name: 'Stone Walls',
    text: 'Your towers have 25% more hit points.',
    boost: { towerHp: 1.25 },
  },
  arrows: {
    name: 'Sharp Arrows',
    text: 'Your towers hit 25% harder.',
    boost: { towerDamage: 1.25 },
  },
  drums: {
    name: 'War Drums',
    text: 'Your troops move 15% faster.',
    boost: { troopSpeed: 1.15 },
  },
  hide: {
    name: 'Thick Hide',
    text: 'Your troops have 12% more hit points.',
    boost: { troopHp: 1.12 },
  },
  steel: {
    name: 'Whetstone',
    text: 'Your troops hit 12% harder.',
    boost: { troopDamage: 1.12 },
  },
  coin: { name: 'Lucky Coin', text: 'Win 40% more gold.' },
  rock: {
    name: 'Heavy Rock',
    text: 'Your spells hit 40% harder.',
    boost: { spellDamage: 1.4 },
  },
  wind: {
    name: 'Second Wind',
    text: 'Gain 4 elixir when one of your towers falls.',
    boost: { towerElixir: 4 },
  },
  crown: {
    name: 'Watchful King',
    text: 'Your king shoots from the start.',
    boost: { kingAwake: true },
  },
  heart: { name: 'Spare Heart', text: 'One more heart, now and to keep.' },
  mentor: { name: 'Mentor', text: 'New cards join at level 2.' },
  haggle: { name: 'Haggler', text: 'Shop prices are a quarter lower.' },
};
export const charmIds = Object.keys(charms) as CharmId[];

export type StopKind = 'battle' | 'elite' | 'camp' | 'shop' | 'event' | 'boss';

/** Who you fight at a battle stop: a deck per enemy seat, its level and
 *  how well its bots play. */
export type Foe = {
  name: string;
  decks: CardId[][];
  level: number;
  difficulty: Difficulty;
  boost: Boost;
};

export type EventId =
  | 'smith'
  | 'dice'
  | 'shrine'
  | 'recruit'
  | 'spring'
  | 'idol'
  | 'drill'
  | 'trader';

export type QuestEvent = {
  name: string;
  text: string;
  /** The two choices; the second is always the safe one. */
  options: [string, string];
};

export const events: Record<EventId, QuestEvent> = {
  smith: {
    name: 'Wandering Smith',
    text: 'A smith offers to sharpen your troops.',
    options: ['Pay 30 gold: upgrade two cards', 'Leave'],
  },
  dice: {
    name: 'Dice Game',
    text: 'A grinning stranger rattles two dice.',
    options: ['Bet 30 gold: win 70 or lose it', 'Leave'],
  },
  shrine: {
    name: 'Old Shrine',
    text: 'A charm glows on a mossy altar.',
    options: ['Take a charm, lose a heart', 'Leave'],
  },
  recruit: {
    name: 'Recruit',
    text: 'A troop asks to join you.',
    options: ['Welcome them', 'Leave'],
  },
  spring: {
    name: 'Healing Spring',
    text: 'Clear water bubbles from the rocks.',
    options: ['Drink: one heart back', 'Fill a flask: 25 gold'],
  },
  idol: {
    name: 'Golden Idol',
    text: 'A heavy idol sits unguarded.',
    options: ['Take it: 80 gold, foes 15% tougher this region', 'Leave'],
  },
  drill: {
    name: 'Training Yard',
    text: 'An old sergeant drills your weakest troop.',
    options: ['Train: upgrade your lowest card', 'Leave'],
  },
  trader: {
    name: 'Trader',
    text: 'A trader wants one of your cards.',
    options: ['Sell a random card for 60 gold', 'Leave'],
  },
};
const eventIds = Object.keys(events) as EventId[];

export type Stop = {
  id: number;
  /** 0 at the bottom; the boss is on the last row. */
  row: number;
  /** 0 to 2, left to right. */
  col: number;
  kind: StopKind;
  /** Stops on the next row this one leads to. */
  next: number[];
  foe?: Foe;
  event?: EventId;
};

export type Offer =
  | { kind: 'card'; card: CardId }
  | { kind: 'upgrade'; card: CardId }
  | { kind: 'charm'; charm: CharmId };

export type Ware = Offer & { price: number; sold: boolean };

/** Two cards taken together at the start of a run. */
export type Bundle = [CardId, CardId];

export type Screen =
  /** The start: three rounds, each three bundles of two cards; one is
   *  taken each round, so the run begins with six cards. `seen` is every
   *  card offered so far, kept out of later rounds while others remain. */
  | { kind: 'draft'; round: number; bundles: Bundle[]; seen: CardId[] }
  | { kind: 'map' }
  | { kind: 'battle'; stop: number }
  | {
      kind: 'reward';
      stop: number;
      won: boolean;
      gold: number;
      offers: Offer[];
      /** A boss beaten: the next region (or the end) follows. */
      boss: boolean;
    }
  /** The deck is full: pick the card the new one replaces. */
  | { kind: 'swap'; card: CardId; after: 'map' | 'region' }
  | { kind: 'camp'; stop: number }
  | { kind: 'shop'; stop: number; wares: Ware[] }
  | { kind: 'event'; stop: number; event: EventId; card?: CardId }
  | { kind: 'won' }
  | { kind: 'lost' };

export type QuestState = {
  version: 1;
  seed: number;
  rng: number;
  /** One player, or two sharing the run. */
  players: 1 | 2;
  /** 0, 1 or 2. */
  region: number;
  stops: Stop[];
  /** The stop last reached in this region, or null before the first. */
  at: number | null;
  /** Every stop reached in this region, in order. */
  trail: number[];
  hearts: number;
  maxHearts: number;
  gold: number;
  deck: CardId[];
  levels: Partial<Record<CardId, number>>;
  charms: CharmId[];
  /** Cards that may turn up as rewards. */
  pool: CardId[];
  /** Foes are this much tougher for the rest of the region (the Idol). */
  curse: number;
  /** Battles won this run. */
  wins: number;
  /** Cards unlocked by this run's bosses, for the collection to keep. */
  unlocked: CardId[];
  screen: Screen;
};

export type QuestAction =
  | { type: 'bundle'; bundle: number }
  | { type: 'go'; stop: number }
  | { type: 'result'; won: boolean; crowns: number }
  | { type: 'take'; offer: number }
  | { type: 'skip' }
  | { type: 'swap'; out: CardId | null }
  | { type: 'rest' }
  | { type: 'train'; card: CardId }
  | { type: 'buy'; ware: number }
  | { type: 'remove'; card: CardId }
  | { type: 'leave' }
  | { type: 'choose'; option: 0 | 1 };

export const REGIONS = [
  { name: 'Greenwood' },
  { name: 'Sunstone' },
  { name: 'Frostpeak' },
];
/** Rows of stops before the boss's row. */
export const ROWS = 5;
export const MAX_LEVEL = 5;
export const DECK_MAX = 8;
export const DECK_MIN = 5;
/** Quest battles are shorter than Versus ones. */
export const QUEST_REGULATION = 120;
/** The fixed deck runs began with before the draft (1 October 2026); a
 *  ready-made playable six. */
export const START_DECK: CardId[] = [
  'imps',
  'archers',
  'pirate',
  'gladiator',
  'ranger',
  'meteor',
];
/** Cards that join the reward pool one per boss beaten, across runs. */
// Every tank but the Sumo starts in the pool (the Dino, the Diver, the
// Linebacker, the Gladiator), so an early deck never lacks a front line.
export const LOCKED: CardId[] = [
  'viking',
  'miner',
  'sumo',
  'inventor',
  'drummer',
  'balloon',
  'gunner',
];
export const STARTING_POOL = allCards.filter((c) => !LOCKED.includes(c));

const bosses = [
  { name: 'Captain Redtide', preset: 'raiders' },
  { name: 'The Sand King', preset: 'stampede' },
  { name: 'The Frost Warlord', preset: 'siege' },
];
const foeNames = [
  'Rook',
  'Warden',
  'Marshal',
  'Brute',
  'Sentry',
  'Raider',
  'Keeper',
  'Scout',
];

// ------------------------------------------------------------------ dice

function roll(q: QuestState) {
  q.rng = (Math.imul(q.rng, 1664525) + 1013904223) >>> 0;
  return q.rng / 4294967296;
}
const pick = <T>(q: QuestState, list: readonly T[]) =>
  list[Math.floor(roll(q) * list.length)];
function shuffle<T>(q: QuestState, list: readonly T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(roll(q) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------ maps

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
const harder = (d: Difficulty, by: number) =>
  difficulties[Math.min(2, difficulties.indexOf(d) + by)];

function foeFor(q: QuestState, kind: StopKind, row: number): Foe {
  const region = q.region;
  const seats = q.players;
  const base: Difficulty =
    region === 0
      ? row < 2
        ? 'easy'
        : 'medium'
      : region === 1
        ? 'medium'
        : 'hard';
  if (kind === 'boss') {
    const boss = bosses[region];
    const deck = presets.find((p) => p.id === boss.preset)!.cards;
    return {
      name: boss.name,
      decks: Array.from({ length: seats }, () => deck),
      level: region + 2,
      difficulty: 'hard',
      boost: {
        towerHp: 1.4 + region * 0.15,
        towerDamage: 1.15,
        kingAwake: true,
      },
    };
  }
  const decks = Array.from({ length: seats }, () => pick(q, presets).cards);
  const elite = kind === 'elite';
  return {
    name: pick(q, foeNames),
    decks,
    level: 1 + region + (elite ? 1 : 0) + (row >= 3 ? 1 : 0),
    difficulty: elite ? harder(base, 1) : base,
    boost: elite ? { troopHp: 1.12, towerHp: 1.2 } : {},
  };
}

/** A region's map: rows of up to three stops, each leading to one to
 *  three stops on the next row, ending in the boss. */
function makeMap(q: QuestState): Stop[] {
  const rows: Stop[][] = [];
  let id = 0;
  for (let row = 0; row < ROWS; row++) {
    // Three stops, or two with one gap after the first row.
    let cols = [0, 1, 2];
    if (row > 0 && roll(q) < 0.4) {
      const gap = Math.floor(roll(q) * 3);
      cols = cols.filter((c) => c !== gap);
    }
    rows.push(
      cols.map((col) => ({
        id: id++,
        row,
        col,
        kind: kindFor(q, row),
        next: [],
      })),
    );
  }
  // Make sure each region has somewhere to rest before the boss and a
  // shop somewhere along the way.
  const last = rows[ROWS - 1];
  if (!last.some((s) => s.kind === 'camp')) last[0].kind = 'camp';
  const middle = rows.slice(1, ROWS - 1).flat();
  if (!middle.some((s) => s.kind === 'shop')) pick(q, middle).kind = 'shop';
  const boss: Stop = { id: id++, row: ROWS, col: 1, kind: 'boss', next: [] };
  for (let row = 0; row < ROWS; row++) {
    const here = rows[row];
    const there = row + 1 < ROWS ? rows[row + 1] : [boss];
    for (const s of here) {
      const near = there.filter(
        (t) => Math.abs(t.col - s.col) <= 1 || there.length === 1,
      );
      const reach = near.length
        ? near
        : [
            there.reduce((a, b) =>
              Math.abs(b.col - s.col) < Math.abs(a.col - s.col) ? b : a,
            ),
          ];
      // One or two ways on; the straight one when there is one.
      const straight = reach.find((t) => t.col === s.col);
      const ways = new Set<number>();
      ways.add((straight ?? pick(q, reach)).id);
      if (reach.length > 1 && roll(q) < 0.55) ways.add(pick(q, reach).id);
      s.next = [...ways].sort((a, b) => a - b);
    }
    // Nothing on the next row is left unreachable.
    for (const t of there)
      if (!here.some((s) => s.next.includes(t.id))) {
        const from = here.reduce((a, b) =>
          Math.abs(b.col - t.col) < Math.abs(a.col - t.col) ? b : a,
        );
        from.next = [...from.next, t.id].sort((a, b) => a - b);
      }
  }
  const all = [...rows.flat(), boss];
  for (const s of all) {
    if (s.kind === 'battle' || s.kind === 'elite' || s.kind === 'boss')
      s.foe = foeFor(q, s.kind, s.row);
    if (s.kind === 'event') s.event = pick(q, eventIds);
  }
  return all;
}

function kindFor(q: QuestState, row: number): StopKind {
  if (row === 0) return 'battle';
  const r = roll(q);
  if (row === ROWS - 1) return r < 0.5 ? 'camp' : r < 0.75 ? 'shop' : 'battle';
  if (row === 1) return r < 0.6 ? 'battle' : r < 0.85 ? 'event' : 'shop';
  return r < 0.42
    ? 'battle'
    : r < 0.6
      ? 'elite'
      : r < 0.78
        ? 'event'
        : r < 0.9
          ? 'shop'
          : 'camp';
}

// ------------------------------------------------------------------ draft

/** Rounds of the starting draft; each adds a bundle of two cards. */
export const DRAFT_ROUNDS = 3;
const BUNDLES = 3;

/**
 * Roughly how strong a card is on its own, for building hard choices: 3 a
 * standout, 2 solid, 1 weak or awkward alone. Cards not listed count as
 * solid.
 */
const TIER: Partial<Record<CardId, 1 | 2 | 3>> = {
  ogre: 3,
  mage: 3,
  duelist: 3,
  drake: 3,
  meteor: 3,
  viking: 3,
  balloon: 3,
  sumo: 3,
  imps: 1,
  medic: 1,
  gunner: 1,
  drummer: 1,
};
const tier = (c: CardId) => TIER[c] ?? 2;

/** Something that takes towers: a tank, a siege troop, or a big ground
 *  brawler (1200 hit points or more). */
export function isWinCard(c: CardId): boolean {
  const t = troopOf(c);
  if (!t) return false;
  return (
    t.tags.includes('tank') ||
    t.tags.includes('siege') ||
    (!t.unit.flying && t.unit.hp >= 1200 && t.unit.targets !== 'buildings')
  );
}
/** A troop that shoots flyers down. */
export function isAirAnswer(c: CardId): boolean {
  const t = troopOf(c);
  return !!t && t.unit.targets === 'any' && t.unit.damage > 0;
}
/** A deck that can win: something for towers and something for the air. */
export const playableDeck = (deck: CardId[]) =>
  deck.some(isWinCard) && deck.some(isAirAnswer);

/**
 * Whether a deck taken so far can still end playable with `left` rounds to
 * go: a missing role needs enough cards of it on offer to put one in every
 * bundle of a later round.
 */
function completable(q: QuestState, deck: CardId[], left: number) {
  if (playableDeck(deck)) return true;
  if (left <= 0) return false;
  const free = q.pool.filter((c) => !deck.includes(c));
  const wins = free.filter(isWinCard);
  const airs = free.filter(isAirAnswer);
  const needWin = !deck.some(isWinCard);
  const needAir = !deck.some(isAirAnswer);
  if (needWin && wins.length < BUNDLES) return false;
  if (needAir && airs.length < BUNDLES) return false;
  // Both missing: one of each in every bundle, or a card that is both.
  if (needWin && needAir)
    return (
      new Set([...wins, ...airs]).size >= BUNDLES * 2 ||
      free.some((c) => isWinCard(c) && isAirAnswer(c))
    );
  return true;
}

/**
 * One round's three bundles. Each round tries a shape that makes the pick
 * hard (a standout card tied to a weak one against two solid pairs; a tank
 * with nothing for the air against two air answers; the Meteor against two
 * troops), with fresh cards first, and keeps only offers where every bundle
 * still leads to a playable deck; the last round completes it whatever is
 * taken.
 */
function draftRound(q: QuestState, round: number, seen: CardId[]): Bundle[] {
  const left = DRAFT_ROUNDS - round - 1;
  const free = q.pool.filter((c) => !q.deck.includes(c));
  const fresh = free.filter((c) => !seen.includes(c));
  // Fresh cards when there are enough for a round, else anything free.
  const source = fresh.length >= BUNDLES * 2 ? fresh : free;
  const ok = (bundles: Bundle[]) =>
    bundles.length === BUNDLES &&
    new Set(bundles.flat()).size === BUNDLES * 2 &&
    bundles.every((b) => completable(q, [...q.deck, ...b], left));
  const draw = (
    taken: Set<CardId>,
    list: CardId[],
    test: (c: CardId) => boolean = () => true,
  ) => {
    const c = shuffle(q, list).find((x) => !taken.has(x) && test(x));
    if (c) taken.add(c);
    return c;
  };
  const shapes = [
    // A standout with a weak or awkward partner against two solid pairs.
    (list: CardId[]) => {
      const t = new Set<CardId>();
      const star = draw(t, list, (c) => tier(c) === 3);
      const weak = draw(t, list, (c) => tier(c) === 1);
      const rest = [0, 1, 2, 3].map(() => draw(t, list, (c) => tier(c) === 2));
      return [star, weak, ...rest];
    },
    // A tank with nothing for the air against two air answers.
    (list: CardId[]) => {
      const t = new Set<CardId>();
      const tank = draw(t, list, (c) => isWinCard(c) && !isAirAnswer(c));
      const bare = draw(t, list, (c) => !isAirAnswer(c));
      const air1 = draw(t, list, isAirAnswer);
      const x1 = draw(t, list);
      const air2 = draw(t, list, isAirAnswer);
      const x2 = draw(t, list);
      return [tank, bare, air1, x1, air2, x2];
    },
    // The Meteor against two troops.
    (list: CardId[]) => {
      const t = new Set<CardId>();
      const spell = draw(t, list, isSpell);
      const rest = [0, 1, 2, 3, 4].map(() =>
        draw(t, list, (c) => !isSpell(c)),
      );
      return [spell, ...rest];
    },
    // Anything.
    (list: CardId[]) => {
      const t = new Set<CardId>();
      return [0, 1, 2, 3, 4, 5].map(() => draw(t, list));
    },
  ];
  const pair = (cs: (CardId | undefined)[]): Bundle[] | null =>
    cs.every(Boolean)
      ? [0, 1, 2].map((i) => [cs[i * 2]!, cs[i * 2 + 1]!] as Bundle)
      : null;
  for (const list of source === free ? [free] : [source, free])
    for (let tries = 0; tries < 40; tries++) {
      const shape = shapes[Math.floor(roll(q) * shapes.length)];
      const bundles = pair(shape(list));
      if (bundles && ok(bundles)) return shuffle(q, bundles);
    }
  // A round built straight from what the deck still needs.
  const t = new Set<CardId>();
  const needWin = !q.deck.some(isWinCard);
  const needAir = !q.deck.some(isAirAnswer);
  const bundles: Bundle[] = [];
  for (let i = 0; i < BUNDLES; i++) {
    const a = draw(t, free, (c) =>
      needWin ? isWinCard(c) : needAir ? isAirAnswer(c) : true,
    );
    const b = draw(t, free, (c) =>
      needWin && needAir ? isAirAnswer(c) : true,
    );
    if (a && b) bundles.push([a, b]);
  }
  return bundles;
}

function draftScreen(q: QuestState, round: number, seen: CardId[]): Screen {
  const bundles = draftRound(q, round, seen);
  return {
    kind: 'draft',
    round,
    bundles,
    seen: [...new Set([...seen, ...bundles.flat()])],
  };
}

/**
 * A run saved before the draft, still on its charm pick, starts its draft
 * instead (nothing was chosen yet); anything else loads as it was.
 */
export function upgradeQuest(q: QuestState): QuestState {
  if ((q.screen.kind as string) !== 'start') return q;
  const u = clone(q);
  u.deck = [];
  u.levels = {};
  u.screen = draftScreen(u, 0, []);
  return u;
}

// ------------------------------------------------------------------ runs

/** A new run. `unlocked` are cards earlier runs added to the pool. */
export function newQuest(
  seed: number,
  players: 1 | 2 = 1,
  unlocked: CardId[] = [],
): QuestState {
  const q: QuestState = {
    version: 1,
    seed: seed >>> 0,
    rng: (seed ^ 0x51ed270b) >>> 0,
    players,
    region: 0,
    stops: [],
    at: null,
    trail: [],
    hearts: 3,
    maxHearts: 3,
    gold: 0,
    deck: [],
    levels: {},
    charms: [],
    pool: [...STARTING_POOL, ...LOCKED.filter((c) => unlocked.includes(c))],
    curse: 0,
    wins: 0,
    unlocked: [],
    screen: { kind: 'map' },
  };
  q.stops = makeMap(q);
  q.screen = draftScreen(q, 0, []);
  return q;
}

export const levelOf = (q: QuestState, card: CardId) => q.levels[card] ?? 1;

/** Stops you may go to next. */
export function reachable(q: QuestState): number[] {
  if (q.at === null) return q.stops.filter((s) => s.row === 0).map((s) => s.id);
  return q.stops.find((s) => s.id === q.at)?.next ?? [];
}

/** Your side's boost for a battle: card levels and charms. */
export function playerBoost(q: QuestState): Boost {
  const b: Boost = { levels: { ...q.levels } };
  for (const id of q.charms) {
    const c = charms[id].boost;
    if (!c) continue;
    for (const [k, v] of Object.entries(c) as [keyof Boost, unknown][]) {
      if (k === 'levels') continue;
      if (typeof v === 'number' && k !== 'elixirStart' && k !== 'towerElixir')
        (b as Record<string, number>)[k] =
          ((b as Record<string, number>)[k] ?? 1) * v;
      else (b as Record<string, unknown>)[k] = v;
    }
  }
  return b;
}

/** The foe's boost: its level on every card, its own edge and the curse. */
export function foeBoost(q: QuestState, foe: Foe): Boost {
  const levels: Partial<Record<CardId, number>> = {};
  for (const deck of foe.decks) for (const c of deck) levels[c] = foe.level;
  return {
    ...foe.boost,
    levels,
    troopHp: (foe.boost.troopHp ?? 1) * (1 + q.curse),
  };
}

/** How the battle at a stop is set up: the mode, seats and bots. */
export function battleSetup(
  q: QuestState,
  stop: Stop,
): {
  mode: Mode;
  difficulty: Difficulty;
  options: MatchOptions;
} {
  const foe = stop.foe!;
  const mine = playerBoost(q);
  const theirs = foeBoost(q, foe);
  const mode: Mode = q.players === 2 ? 'team' : 'duel';
  // Seats alternate sides: yours are the even ones.
  const seats = mode === 'team' ? 4 : 2;
  const decks: CardId[][] = [];
  const boosts: Boost[] = [];
  for (let i = 0; i < seats; i++) {
    decks.push(
      i % 2 === 0 ? q.deck : (foe.decks[Math.floor(i / 2)] ?? foe.decks[0]),
    );
    boosts.push(i % 2 === 0 ? mine : theirs);
  }
  return {
    mode,
    difficulty: foe.difficulty,
    options: { decks, boosts, regulation: QUEST_REGULATION },
  };
}

const clone = (q: QuestState): QuestState => structuredClone(q);
const hasCharm = (q: QuestState, c: CharmId) => q.charms.includes(c);
const price = (q: QuestState, base: number) =>
  Math.round(base * (hasCharm(q, 'haggle') ? 0.75 : 1));

function addCharm(q: QuestState, c: CharmId) {
  if (q.charms.includes(c)) return;
  q.charms.push(c);
  if (c === 'heart') {
    q.maxHearts++;
    q.hearts++;
  }
}

/** A new card for the deck: straight in, or a swap when the deck is full. */
function addCard(
  q: QuestState,
  card: CardId,
  after: 'map' | 'region',
): boolean {
  if (q.deck.includes(card)) return false;
  if (hasCharm(q, 'mentor')) q.levels[card] = Math.max(2, levelOf(q, card));
  if (q.deck.length < DECK_MAX) {
    q.deck.push(card);
    return false;
  }
  q.screen = { kind: 'swap', card, after };
  return true;
}

function upgrade(q: QuestState, card: CardId) {
  q.levels[card] = Math.min(MAX_LEVEL, levelOf(q, card) + 1);
}

const upgradable = (q: QuestState) =>
  q.deck.filter((c) => levelOf(q, c) < MAX_LEVEL);
const newCards = (q: QuestState) => q.pool.filter((c) => !q.deck.includes(c));

/** Three rewards after a battle: cards and an upgrade, or charms from an
 *  elite or a boss. */
function offersFor(q: QuestState, kind: StopKind): Offer[] {
  if (kind === 'elite' || kind === 'boss') {
    const free = charmIds.filter((c) => !q.charms.includes(c));
    return shuffle(q, free)
      .slice(0, 3)
      .map((charm) => ({ kind: 'charm', charm }));
  }
  const out: Offer[] = shuffle(q, newCards(q))
    .slice(0, 2)
    .map((card) => ({ kind: 'card', card }));
  const up = upgradable(q);
  if (up.length) out.push({ kind: 'upgrade', card: pick(q, up) });
  return out;
}

function stockFor(q: QuestState): Ware[] {
  const wares: Ware[] = shuffle(q, newCards(q))
    .slice(0, 3)
    .map((card) => ({
      kind: 'card',
      card,
      price: price(q, 45 + cards[card].cost * 5),
      sold: false,
    }));
  const free = charmIds.filter((c) => !q.charms.includes(c));
  if (free.length)
    wares.push({
      kind: 'charm',
      charm: pick(q, free),
      price: price(q, 110),
      sold: false,
    });
  const up = upgradable(q);
  if (up.length)
    wares.push({
      kind: 'upgrade',
      card: pick(q, up),
      price: price(q, 50),
      sold: false,
    });
  return wares;
}

/** The price to take a card out of the deck at a shop. */
export const removePrice = (q: QuestState) => price(q, 40);

function goldFor(q: QuestState, kind: StopKind, crowns: number) {
  const base = kind === 'boss' ? 60 : kind === 'elite' ? 40 : 20;
  return Math.round((base + 5 * crowns) * (hasCharm(q, 'coin') ? 1.4 : 1));
}

/** After a boss: the next region, or the end of the run. */
function nextRegion(q: QuestState) {
  if (q.region >= REGIONS.length - 1) {
    q.screen = { kind: 'won' };
    return;
  }
  q.region++;
  q.at = null;
  q.trail = [];
  q.curse = 0;
  q.stops = makeMap(q);
  q.screen = { kind: 'map' };
}

/** A boss beaten unlocks the next locked card for good. */
function unlockOne(q: QuestState) {
  const next = LOCKED.find((c) => !q.pool.includes(c));
  if (!next) return;
  q.pool.push(next);
  q.unlocked.push(next);
}

/**
 * Applies one choice to the run and returns the new state, or null when
 * the choice is not allowed on the current screen.
 */
export function questAct(
  state: QuestState,
  action: QuestAction,
): QuestState | null {
  const q = clone(state);
  const screen = q.screen;
  switch (action.type) {
    case 'bundle': {
      if (screen.kind !== 'draft') return null;
      const bundle = screen.bundles[action.bundle];
      if (!bundle) return null;
      for (const c of bundle) if (!q.deck.includes(c)) q.deck.push(c);
      q.screen =
        screen.round + 1 < DRAFT_ROUNDS
          ? draftScreen(q, screen.round + 1, screen.seen)
          : { kind: 'map' };
      return q;
    }
    case 'go': {
      if (screen.kind !== 'map' || !reachable(q).includes(action.stop))
        return null;
      const stop = q.stops.find((s) => s.id === action.stop)!;
      q.at = stop.id;
      q.trail.push(stop.id);
      if (stop.foe) q.screen = { kind: 'battle', stop: stop.id };
      else if (stop.kind === 'camp') q.screen = { kind: 'camp', stop: stop.id };
      else if (stop.kind === 'shop')
        q.screen = { kind: 'shop', stop: stop.id, wares: stockFor(q) };
      else {
        const event = stop.event ?? 'spring';
        const card =
          event === 'recruit'
            ? pick(q, newCards(q).length ? newCards(q) : q.pool)
            : undefined;
        q.screen = { kind: 'event', stop: stop.id, event, card };
      }
      return q;
    }
    case 'result': {
      if (screen.kind !== 'battle') return null;
      const stop = q.stops.find((s) => s.id === screen.stop)!;
      const boss = stop.kind === 'boss';
      if (!action.won) {
        q.hearts--;
        if (q.hearts <= 0) {
          q.screen = { kind: 'lost' };
          return q;
        }
        // A boss must be beaten: its battle waits on the map again.
        if (boss) {
          q.at = stop.id;
          q.screen = { kind: 'battle', stop: stop.id };
          return q;
        }
        q.screen = {
          kind: 'reward',
          stop: stop.id,
          won: false,
          gold: 0,
          offers: [],
          boss: false,
        };
        return q;
      }
      q.wins++;
      const gold = goldFor(
        q,
        stop.kind,
        Math.max(0, Math.min(3, action.crowns)),
      );
      q.gold += gold;
      if (boss) {
        q.hearts = Math.min(q.maxHearts, q.hearts + 1);
        unlockOne(q);
      }
      q.screen = {
        kind: 'reward',
        stop: stop.id,
        won: true,
        gold,
        offers: offersFor(q, stop.kind),
        boss,
      };
      return q;
    }
    case 'take': {
      if (screen.kind !== 'reward') return null;
      const offer = screen.offers[action.offer];
      if (!offer) return null;
      const after = screen.boss ? 'region' : 'map';
      if (offer.kind === 'charm') addCharm(q, offer.charm);
      else if (offer.kind === 'upgrade') upgrade(q, offer.card);
      else if (addCard(q, offer.card, after)) return q;
      if (after === 'region') nextRegion(q);
      else q.screen = { kind: 'map' };
      return q;
    }
    case 'skip': {
      if (screen.kind !== 'reward') return null;
      if (screen.boss) nextRegion(q);
      else q.screen = { kind: 'map' };
      return q;
    }
    case 'swap': {
      if (screen.kind !== 'swap') return null;
      if (action.out !== null) {
        const i = q.deck.indexOf(action.out);
        if (i < 0) return null;
        q.deck[i] = screen.card;
      }
      if (screen.after === 'region') nextRegion(q);
      else q.screen = { kind: 'map' };
      return q;
    }
    case 'rest': {
      if (screen.kind !== 'camp' || q.hearts >= q.maxHearts) return null;
      q.hearts++;
      q.screen = { kind: 'map' };
      return q;
    }
    case 'train': {
      if (screen.kind !== 'camp' || !q.deck.includes(action.card)) return null;
      if (levelOf(q, action.card) >= MAX_LEVEL) return null;
      upgrade(q, action.card);
      q.screen = { kind: 'map' };
      return q;
    }
    case 'buy': {
      if (screen.kind !== 'shop') return null;
      const ware = screen.wares[action.ware];
      if (!ware || ware.sold || q.gold < ware.price) return null;
      // A card needs room: take one out first (`remove`).
      if (
        ware.kind === 'card' &&
        (q.deck.includes(ware.card) || q.deck.length >= DECK_MAX)
      )
        return null;
      q.gold -= ware.price;
      ware.sold = true;
      if (ware.kind === 'charm') addCharm(q, ware.charm);
      else if (ware.kind === 'upgrade') upgrade(q, ware.card);
      else addCard(q, ware.card, 'map');
      return q;
    }
    case 'remove': {
      if (screen.kind !== 'shop' || q.deck.length <= DECK_MIN) return null;
      const i = q.deck.indexOf(action.card);
      if (i < 0 || q.gold < removePrice(q)) return null;
      q.gold -= removePrice(q);
      q.deck.splice(i, 1);
      return q;
    }
    case 'leave': {
      if (screen.kind !== 'shop' && screen.kind !== 'camp') return null;
      q.screen = { kind: 'map' };
      return q;
    }
    case 'choose': {
      if (screen.kind !== 'event') return null;
      q.screen = { kind: 'map' };
      if (action.option === 1) {
        if (screen.event === 'spring') q.gold += 25;
        return q;
      }
      switch (screen.event) {
        case 'smith': {
          if (q.gold < 30) return null;
          q.gold -= 30;
          for (const c of shuffle(q, upgradable(q)).slice(0, 2)) upgrade(q, c);
          break;
        }
        case 'dice': {
          if (q.gold < 30) return null;
          q.gold += roll(q) < 0.5 ? 40 : -30;
          break;
        }
        case 'shrine': {
          if (q.hearts <= 1) return null;
          const free = charmIds.filter(
            (c) => !q.charms.includes(c) && c !== 'heart',
          );
          if (free.length) addCharm(q, pick(q, free));
          q.hearts--;
          break;
        }
        case 'recruit': {
          if (screen.card) addCard(q, screen.card, 'map');
          break;
        }
        case 'spring': {
          q.hearts = Math.min(q.maxHearts, q.hearts + 1);
          break;
        }
        case 'idol': {
          q.gold += 80;
          q.curse += 0.15;
          break;
        }
        case 'drill': {
          const up = upgradable(q);
          if (up.length)
            upgrade(
              q,
              up.reduce((a, b) => (levelOf(q, b) < levelOf(q, a) ? b : a)),
            );
          break;
        }
        case 'trader': {
          if (q.deck.length <= DECK_MIN) return null;
          const out = pick(q, q.deck);
          q.deck.splice(q.deck.indexOf(out), 1);
          q.gold += 60;
          break;
        }
      }
      return q;
    }
  }
  // An action from an older client (the charm pick) or a typo.
  return null;
}

/** Whether a choice on the current event can be made at all. */
export function eventAllowed(q: QuestState): boolean {
  const s = q.screen;
  if (s.kind !== 'event') return false;
  switch (s.event) {
    case 'smith':
    case 'dice':
      return q.gold >= 30;
    case 'shrine':
      return q.hearts > 1;
    case 'trader':
      return q.deck.length > DECK_MIN;
    default:
      return true;
  }
}

/** A saved run read back from untrusted storage. */
export function validQuest(value: unknown): value is QuestState {
  if (!value || typeof value !== 'object') return false;
  const q = value as QuestState;
  return (
    q.version === 1 &&
    Array.isArray(q.deck) &&
    q.deck.every((c) => c in cards) &&
    Array.isArray(q.stops) &&
    Array.isArray(q.trail) &&
    typeof q.hearts === 'number' &&
    !!q.screen &&
    typeof q.screen.kind === 'string'
  );
}

/** Troop cards in a deck, for code that needs the figures. */
export const troopsOf = (deck: CardId[]) =>
  deck.filter((c): c is TroopId => !isSpell(c) && c in troopCards);
