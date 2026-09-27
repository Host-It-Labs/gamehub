/**
 * Arena's eight cards: one full deck, the same for you and the bot. The
 * battle is fought by toys on a bedroom floor; ids are stable, only the
 * names and art follow the theme. Seven cards are troops, one kind of troop
 * each; the Meteor is a spell that lands anywhere on the field. Speeds are
 * tiles per second, times are seconds, ranges and radii are tiles.
 */
export type TroopId =
  | 'archers'
  | 'ogre'
  | 'imps'
  | 'duelist'
  | 'ranger'
  | 'drake'
  | 'mage';
export type SpellId = 'meteor';
export type CardId = TroopId | SpellId;

/** What a shot looks like; every kind but 'cannon' also splashes flyers. */
export type ProjectileKind =
  | 'laser'
  | 'bolt'
  | 'arrow'
  | 'fire'
  | 'bomb'
  | 'cannon';

export type UnitStats = {
  hp: number;
  damage: number;
  /** Seconds between hits once attacking. */
  hitSpeed: number;
  /** Seconds from locking on to the first hit. */
  firstHit: number;
  /** Reach beyond the target's edge. */
  range: number;
  /** How far the troop notices enemies to fight on its way. */
  sight: number;
  speed: number;
  radius: number;
  /** Heavier troops push lighter ones aside. */
  mass: number;
  flying: boolean;
  /** 'ground' troops cannot hit flyers; 'buildings' troops only hit towers. */
  targets: 'any' | 'ground' | 'buildings';
  /** Area damage radius around the point of impact. */
  splash?: number;
  projectile?: { kind: ProjectileKind; speed: number };
};

export type SpellStats = {
  /** Blast radius around the landing point, reaching the edge of what it hits. */
  radius: number;
  /** Damage to every troop of the other side inside, ground and air. */
  damage: number;
  /** Damage to every tower of the other side inside. */
  towerDamage: number;
  /** Seconds from the cast to the crash. */
  delay: number;
  /** How far troops lighter than `knockMass` are pushed from the centre. */
  knockback: number;
  knockMass: number;
};

type CardBase = {
  name: string;
  cost: number;
  /** One short line for the card inspection. */
  role: string;
};

export type TroopCard = CardBase & {
  kind: 'troop';
  id: TroopId;
  /** Troops placed per card and where they stand around the drop point. */
  formation: [number, number][];
  unit: UnitStats;
};

/** A spell plays no troop: it lands where it is cast after `spell.delay`. */
export type SpellCard = CardBase & {
  kind: 'spell';
  id: SpellId;
  spell: SpellStats;
};

export type Card = TroopCard | SpellCard;
/** The card type behind an id: `cards.ogre` is a TroopCard. */
export type CardOf<K extends CardId> = K extends SpellId
  ? SpellCard
  : TroopCard;

const melee = (radius: number) => 0.35 + radius;

export const troopCards: Record<TroopId, TroopCard> = {
  archers: {
    kind: 'troop',
    id: 'archers',
    name: 'Cadets',
    cost: 3,
    formation: [
      [-0.6, 0],
      [0.6, 0],
    ],
    role: 'Two space cadets whose ray guns hit ground and air.',
    unit: {
      hp: 304,
      damage: 107,
      hitSpeed: 0.9,
      firstHit: 0.4,
      range: 5,
      sight: 5.5,
      speed: 1,
      radius: 0.4,
      mass: 3,
      flying: false,
      targets: 'any',
      projectile: { kind: 'laser', speed: 14 },
    },
  },
  ogre: {
    kind: 'troop',
    id: 'ogre',
    name: 'Dino',
    cost: 5,
    formation: [[0, 0]],
    role: 'A big, slow rubber dinosaur that only goes for towers.',
    unit: {
      hp: 4091,
      damage: 254,
      hitSpeed: 1.5,
      firstHit: 0.6,
      range: melee(0.8),
      sight: 7.5,
      speed: 0.75,
      radius: 0.8,
      mass: 18,
      flying: false,
      targets: 'buildings',
    },
  },
  imps: {
    kind: 'troop',
    id: 'imps',
    name: 'Robots',
    cost: 2,
    formation: [
      [0, 0.45],
      [-0.5, -0.35],
      [0.5, -0.35],
    ],
    role: 'Three quick wind-up robots. Cheap, fragile, fast.',
    unit: {
      hp: 202,
      damage: 120,
      hitSpeed: 1.1,
      firstHit: 0.3,
      range: melee(0.35),
      sight: 5.5,
      speed: 2,
      radius: 0.35,
      mass: 2,
      flying: false,
      targets: 'ground',
    },
  },
  duelist: {
    kind: 'troop',
    id: 'duelist',
    name: 'Samurai',
    cost: 4,
    formation: [[0, 0]],
    role: 'One huge sword blow at a time. Melts tanks.',
    unit: {
      hp: 1361,
      damage: 720,
      hitSpeed: 1.6,
      firstHit: 0.6,
      range: melee(0.5),
      sight: 5,
      speed: 1.5,
      radius: 0.5,
      mass: 5,
      flying: false,
      targets: 'ground',
    },
  },
  ranger: {
    kind: 'troop',
    id: 'ranger',
    name: 'Cowboy',
    cost: 4,
    formation: [[0, 0]],
    role: 'Long-range rifle for ground and air.',
    unit: {
      hp: 721,
      damage: 217,
      hitSpeed: 1,
      firstHit: 0.5,
      range: 6,
      sight: 6.5,
      speed: 1,
      radius: 0.45,
      mass: 4,
      flying: false,
      targets: 'any',
      projectile: { kind: 'bolt', speed: 16 },
    },
  },
  drake: {
    kind: 'troop',
    id: 'drake',
    name: 'Biplane',
    cost: 4,
    formation: [[0, 0]],
    role: 'Flies over the river and drops bombs that burst in an area.',
    unit: {
      hp: 1152,
      damage: 161,
      hitSpeed: 1.5,
      firstHit: 0.5,
      range: 3.5,
      sight: 5.5,
      speed: 1.5,
      radius: 0.6,
      mass: 5,
      flying: true,
      targets: 'any',
      splash: 1.2,
      projectile: { kind: 'bomb', speed: 10 },
    },
  },
  mage: {
    kind: 'troop',
    id: 'mage',
    name: 'Wizard',
    cost: 5,
    formation: [[0, 0]],
    role: 'Hurls fireballs that burn everything nearby.',
    unit: {
      hp: 721,
      damage: 281,
      hitSpeed: 1.4,
      firstHit: 0.6,
      range: 5.5,
      sight: 5.5,
      speed: 1,
      radius: 0.45,
      mass: 4,
      flying: false,
      targets: 'any',
      splash: 1.5,
      projectile: { kind: 'fire', speed: 10 },
    },
  },
};

export const spellCards: Record<SpellId, SpellCard> = {
  meteor: {
    kind: 'spell',
    id: 'meteor',
    name: 'Meteor',
    cost: 4,
    role: 'Drop it anywhere: it crashes a second later and hits everything in its circle, towers too.',
    spell: {
      radius: 2.5,
      damage: 600,
      // Crown towers take less, as from a Fireball.
      towerDamage: 190,
      delay: 1,
      knockback: 0.6,
      knockMass: 10,
    },
  },
};

export const cards: { readonly [K in CardId]: CardOf<K> } = {
  ...troopCards,
  ...spellCards,
};

export const isSpell = (id: CardId): id is SpellId =>
  cards[id].kind === 'spell';
export const isTroop = (id: CardId): id is TroopId =>
  cards[id].kind === 'troop';
/** The troop behind a card, or undefined for a spell. */
export const troopOf = (id: CardId): TroopCard | undefined =>
  isSpell(id) ? undefined : troopCards[id];

export const deck: CardId[] = [
  'archers',
  'ogre',
  'imps',
  'duelist',
  'ranger',
  'drake',
  'mage',
  'meteor',
];
/** The deck's troops, for code that needs unit stats or models. */
export const troopDeck: TroopId[] = deck.filter(isTroop);
