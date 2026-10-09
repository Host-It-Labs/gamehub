/**
 * Arena's cards: twenty-three troops, each a figure from a different era or
 * genre, and the Meteor, a spell that lands anywhere on the field. A deck is
 * eight of them (`deck` is the starting one); ids are stable, only the names
 * and art follow the theme. Speeds are tiles per second, times are seconds,
 * ranges and radii are tiles. The Bee is a troop no deck holds: the
 * Beekeeper releases it (`token`), so `allCards` and `allTroops` leave it
 * out while `troopDeck` (every unit that can stand on the field) keeps it.
 */
export type TroopId =
  | 'archers'
  | 'ogre'
  | 'imps'
  | 'duelist'
  | 'ranger'
  | 'drake'
  | 'mage'
  | 'pirate'
  | 'viking'
  | 'gladiator'
  | 'medic'
  | 'miner'
  | 'balloon'
  | 'inventor'
  | 'gunner'
  | 'diver'
  | 'sumo'
  | 'linebacker'
  | 'beekeeper'
  | 'drummer'
  | 'firefighter'
  | 'jetpack'
  | 'explorer'
  /** Spawned by the Beekeeper; never a card in hand. */
  | 'bee';
export type SpellId = 'meteor';
export type CardId = TroopId | SpellId;

/** Every shield starts recharging after this long without taking damage,
 *  and fills from empty in this many seconds. Card levels scale its pool
 *  and its recharge together. */
export const SHIELD_DELAY = 4;
export const SHIELD_RECHARGE = 5;

/** What a shot looks like; every kind but 'cannon' also splashes flyers. */
export type ProjectileKind =
  | 'laser'
  | 'bolt'
  | 'arrow'
  | 'fire'
  | 'bomb'
  | 'cannon'
  /** The Inventor's lightning: near instant, jumps between targets. */
  | 'zap'
  /** The Gunner's shell: a high, slow arc. */
  | 'shell'
  /** The Balloon's bomb, dropped straight down. */
  | 'drop'
  /** The Explorer's frost shot: a cold shard that slows what it hits. */
  | 'frost';

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
  /** Leaps at a troop it spots within `range`, at `speed`, and lands its
   *  first hit `bonus` times as hard. At most once every `cooldown` s. */
  leap?: { range: number; speed: number; bonus: number; cooldown: number };
  /** Strikes everything of the other side within this radius of itself. */
  spin?: number;
  /** Below `below` of its hit points it moves and strikes `boost` times
   *  as fast. */
  rage?: { below: number; boost: number };
  /** Maximum shield points: hits use these before health, with excess
   *  damage reaching health. Recharges after SHIELD_DELAY quiet seconds. */
  shield?: number;
  /** Heals friendly troops within `radius` by `amount` every `every`
   *  seconds, and never attacks. */
  heal?: { amount: number; every: number; radius: number };
  /** May be played anywhere on the field; it tunnels there for this many
   *  seconds instead of the usual deploy. */
  burrow?: number;
  /** Damage dealt around where it falls. */
  deathBlast?: { damage: number; radius: number };
  /** Each shot jumps on to up to `count` enemies in all, each within
   *  `range` of the last. */
  chain?: { count: number; range: number };
  /** Seconds a hit stops a troop from moving and attacking. */
  stun?: number;
  /** It cannot hit anything closer than this. */
  minRange?: number;
  /** Armour (the Diver): every hit on it loses `flat` damage, but always
   *  lands at least `min` of itself. Spells and towers too. */
  armour?: { flat: number; min: number };
  /** When it lands (the Sumo), enemy troops within `radius` that can hit
   *  it turn on it for `seconds`, whatever else they were after. */
  taunt?: { radius: number; seconds: number };
  /** Each blow pushes a troop lighter than `mass` this far away. */
  knockback?: { distance: number; mass: number };
  /** Its first blow on each new target (the Linebacker) is a tackle:
   *  pushes a troop lighter than `mass` `distance` away and stuns it
   *  `stun` seconds. Towers only take the blow. */
  tackle?: { distance: number; stun: number; mass: number };
  /** Releases `count` of `unit` around itself every `every` seconds,
   *  the first `first` seconds after landing (the Beekeeper). */
  spawn?: { unit: TroopId; count: number; every: number; first: number };
  /** Friends within `radius` (not itself) move and strike `boost` times
   *  as fast (the Drummer); several auras do not add up. */
  aura?: { radius: number; boost: number };
  /** Never attacks: follows the nearest friend and waits outside the
   *  reach of the tower ahead (the Medic, the Drummer, the Beekeeper). */
  follows?: true;
  /** Each blow sprays a cone (the Firefighter): everything it can hit
   *  within its range whose direction is within the cone (`cos` of the
   *  half angle, so no trigonometry), each troop lighter than `mass`
   *  pushed `push` away. */
  cone?: { cos: number; push: number; mass: number };
  /** Each hit slows the target's steps and blows to `factor` of their
   *  pace for `seconds` (the Explorer). */
  slow?: { factor: number; seconds: number };
};

/** What a troop is good at, for the bot and the card inspection. */
export type TroopTag =
  | 'tank'
  | 'swarm'
  | 'fighter'
  | 'ranged'
  | 'air'
  | 'splash'
  | 'siege'
  | 'support'
  /** Holds troops back: slows, pushes or stops them. */
  | 'control';

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
  tags: TroopTag[];
  /** Troops placed per card and where they stand around the drop point. */
  formation: [number, number][];
  unit: UnitStats;
  /** Only ever spawned by another troop (the Bee): never in a deck. */
  token?: true;
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
    tags: ['ranged', 'swarm'],
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
    tags: ['tank', 'siege'],
    name: 'Dino',
    cost: 5,
    formation: [[0, 0]],
    role: 'A big, slow dinosaur that only goes for towers.',
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
    tags: ['swarm'],
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
    tags: ['fighter'],
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
    tags: ['ranged'],
    name: 'Cowboy',
    cost: 4,
    formation: [[0, 0]],
    role: 'Long-range rifle for ground and air.',
    unit: {
      hp: 721,
      damage: 200,
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
    tags: ['air', 'splash'],
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
    tags: ['ranged', 'splash'],
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
  pirate: {
    kind: 'troop',
    id: 'pirate',
    tags: ['fighter'],
    name: 'Pirate',
    cost: 3,
    formation: [[0, 0]],
    role: 'A quick, cheap cutlass. Leaps at the first enemy he sees and hits it twice as hard.',
    unit: {
      hp: 690,
      damage: 150,
      hitSpeed: 0.9,
      firstHit: 0.3,
      range: melee(0.4),
      sight: 5.5,
      speed: 1.5,
      radius: 0.4,
      mass: 4,
      flying: false,
      targets: 'ground',
      leap: { range: 3.5, speed: 6, bonus: 2, cooldown: 3 },
    },
  },
  viking: {
    kind: 'troop',
    id: 'viking',
    tags: ['fighter', 'splash'],
    name: 'Viking',
    cost: 4,
    formation: [[0, 0]],
    role: 'Swings his axe all round, hitting everyone near him. Fights faster when hurt.',
    unit: {
      hp: 1400,
      damage: 180,
      hitSpeed: 1.3,
      firstHit: 0.5,
      range: melee(0.5),
      sight: 5.5,
      speed: 1,
      radius: 0.5,
      mass: 6,
      flying: false,
      targets: 'ground',
      spin: 1.4,
      rage: { below: 0.5, boost: 1.35 },
    },
  },
  gladiator: {
    kind: 'troop',
    id: 'gladiator',
    tags: ['tank', 'fighter'],
    name: 'Gladiator',
    cost: 3,
    formation: [[0, 0]],
    role: 'His shield takes hits before his health and recharges out of danger.',
    unit: {
      hp: 850,
      damage: 125,
      hitSpeed: 1.1,
      firstHit: 0.4,
      range: melee(0.45),
      sight: 5.5,
      speed: 1,
      radius: 0.45,
      mass: 5,
      flying: false,
      targets: 'ground',
      shield: 650,
    },
  },
  medic: {
    kind: 'troop',
    id: 'medic',
    tags: ['support'],
    name: 'Medic',
    cost: 3,
    formation: [[0, 0]],
    role: 'Follows your troops and heals everyone around her. She never fights.',
    unit: {
      hp: 780,
      damage: 0,
      hitSpeed: 1,
      firstHit: 1,
      range: 0,
      sight: 7,
      speed: 1.1,
      radius: 0.4,
      mass: 3,
      flying: false,
      targets: 'ground',
      heal: { amount: 70, every: 1, radius: 3 },
    },
  },
  miner: {
    kind: 'troop',
    id: 'miner',
    tags: ['siege'],
    name: 'Miner',
    cost: 3,
    formation: [[0, 0]],
    role: 'Digs to any spot on the field, even beside their towers, then swings his pick.',
    unit: {
      hp: 1000,
      damage: 140,
      hitSpeed: 1.2,
      firstHit: 0.5,
      range: melee(0.45),
      sight: 5.5,
      speed: 1.5,
      radius: 0.45,
      mass: 5,
      flying: false,
      targets: 'ground',
      burrow: 2,
    },
  },
  balloon: {
    kind: 'troop',
    id: 'balloon',
    tags: ['tank', 'air', 'siege'],
    name: 'Balloon',
    cost: 5,
    formation: [[0, 0]],
    role: 'Floats slowly to their towers and drops heavy bombs. Crashes with a bang.',
    unit: {
      hp: 1650,
      damage: 520,
      hitSpeed: 3,
      firstHit: 1,
      range: 0.3,
      sight: 7.5,
      speed: 0.9,
      radius: 0.6,
      mass: 6,
      flying: true,
      targets: 'buildings',
      splash: 1,
      projectile: { kind: 'drop', speed: 8 },
      deathBlast: { damage: 240, radius: 2 },
    },
  },
  inventor: {
    kind: 'troop',
    id: 'inventor',
    tags: ['ranged', 'splash'],
    name: 'Inventor',
    cost: 4,
    formation: [[0, 0]],
    role: 'Her lightning jumps to three enemies and stops each one for a moment.',
    unit: {
      hp: 640,
      damage: 150,
      hitSpeed: 1.6,
      firstHit: 0.6,
      range: 4.5,
      sight: 5.5,
      speed: 1,
      radius: 0.45,
      mass: 4,
      flying: false,
      targets: 'any',
      projectile: { kind: 'zap', speed: 40 },
      chain: { count: 3, range: 2.5 },
      stun: 0.5,
    },
  },
  gunner: {
    kind: 'troop',
    id: 'gunner',
    tags: ['siege', 'splash'],
    name: 'Gunner',
    cost: 4,
    formation: [[0, 0]],
    role: 'Wheels a cannon that outranges towers. Slow, and helpless up close.',
    unit: {
      hp: 700,
      damage: 180,
      hitSpeed: 3.5,
      firstHit: 1.5,
      range: 9.5,
      sight: 9.5,
      speed: 0.6,
      radius: 0.55,
      mass: 7,
      flying: false,
      targets: 'ground',
      splash: 1.3,
      minRange: 3,
      projectile: { kind: 'shell', speed: 9 },
    },
  },
  diver: {
    kind: 'troop',
    id: 'diver',
    tags: ['tank', 'fighter'],
    name: 'Diver',
    cost: 5,
    formation: [[0, 0]],
    role: 'A brass diving suit: every hit on him does 45 less, though at least a quarter gets through. Slow; fights anything on the ground.',
    unit: {
      hp: 2400,
      damage: 190,
      hitSpeed: 1.4,
      firstHit: 0.5,
      range: melee(0.65),
      sight: 5.5,
      speed: 0.75,
      radius: 0.65,
      mass: 14,
      flying: false,
      targets: 'ground',
      armour: { flat: 45, min: 0.25 },
    },
  },
  sumo: {
    kind: 'troop',
    id: 'sumo',
    tags: ['tank', 'fighter', 'control'],
    name: 'Sumo',
    cost: 6,
    formation: [[0, 0]],
    role: 'Huge and very slow. His landing stomp makes troops nearby fight him for 3 seconds; his slaps push them back.',
    unit: {
      hp: 4000,
      damage: 230,
      hitSpeed: 1.6,
      firstHit: 0.6,
      range: melee(0.85),
      sight: 5.5,
      speed: 0.6,
      radius: 0.85,
      mass: 20,
      flying: false,
      targets: 'ground',
      taunt: { radius: 4.5, seconds: 3 },
      knockback: { distance: 1, mass: 12 },
    },
  },
  linebacker: {
    kind: 'troop',
    id: 'linebacker',
    tags: ['tank', 'fighter'],
    name: 'Linebacker',
    cost: 3,
    formation: [[0, 0]],
    role: 'Quick for her size. Her first hit on each new target is a tackle: it flies back and stops for a second.',
    unit: {
      hp: 1350,
      damage: 125,
      hitSpeed: 1.1,
      firstHit: 0.3,
      range: melee(0.5),
      sight: 5.5,
      speed: 1.6,
      radius: 0.5,
      mass: 9,
      flying: false,
      targets: 'ground',
      tackle: { distance: 1.5, stun: 1, mass: 12 },
    },
  },
  beekeeper: {
    kind: 'troop',
    id: 'beekeeper',
    tags: ['support', 'swarm'],
    name: 'Beekeeper',
    cost: 4,
    formation: [[0, 0]],
    role: 'Fragile. Follows your troops and lets out three bees every 4.5 seconds. She never fights.',
    unit: {
      hp: 520,
      damage: 0,
      hitSpeed: 1,
      firstHit: 1,
      range: 0,
      sight: 7,
      speed: 1,
      radius: 0.45,
      mass: 3,
      flying: false,
      targets: 'ground',
      follows: true,
      spawn: { unit: 'bee', count: 3, every: 4.5, first: 1 },
    },
  },
  drummer: {
    kind: 'troop',
    id: 'drummer',
    tags: ['support'],
    name: 'Drummer',
    cost: 3,
    formation: [[0, 0]],
    role: 'Follows your troops; friends near him move and strike 30% faster. He never fights.',
    unit: {
      hp: 750,
      damage: 0,
      hitSpeed: 1,
      firstHit: 1,
      range: 0,
      sight: 7,
      speed: 1.5,
      radius: 0.4,
      mass: 3,
      flying: false,
      targets: 'ground',
      follows: true,
      aura: { radius: 3.5, boost: 1.3 },
    },
  },
  firefighter: {
    kind: 'troop',
    id: 'firefighter',
    tags: ['control', 'splash'],
    name: 'Firefighter',
    cost: 4,
    formation: [[0, 0]],
    role: 'Sprays a short cone of water: steady damage to everything on the ground in it, and pushes it back.',
    unit: {
      hp: 950,
      damage: 80,
      hitSpeed: 0.4,
      firstHit: 0.4,
      range: 3,
      sight: 5.5,
      speed: 1,
      radius: 0.45,
      mass: 5,
      flying: false,
      targets: 'ground',
      cone: { cos: 0.8, push: 0.18, mass: 12 },
    },
  },
  jetpack: {
    kind: 'troop',
    id: 'jetpack',
    tags: ['air', 'ranged'],
    name: 'Jetpack',
    cost: 4,
    formation: [[0, 0]],
    role: 'Flies fast and fires quick blaster shots at ground and air. Fragile.',
    unit: {
      hp: 850,
      damage: 115,
      hitSpeed: 0.6,
      firstHit: 0.3,
      range: 3,
      sight: 5.5,
      speed: 1.8,
      radius: 0.45,
      mass: 3,
      flying: true,
      targets: 'any',
      projectile: { kind: 'laser', speed: 16 },
    },
  },
  explorer: {
    kind: 'troop',
    id: 'explorer',
    tags: ['ranged', 'control'],
    name: 'Explorer',
    cost: 4,
    formation: [[0, 0]],
    role: 'Frost shots at ground and air. Each hit slows the target by 40% for a moment.',
    unit: {
      hp: 700,
      damage: 140,
      hitSpeed: 1.2,
      firstHit: 0.5,
      range: 5,
      sight: 5.5,
      speed: 1,
      radius: 0.45,
      mass: 4,
      flying: false,
      targets: 'any',
      projectile: { kind: 'frost', speed: 14 },
      slow: { factor: 0.6, seconds: 1.5 },
    },
  },
  bee: {
    kind: 'troop',
    id: 'bee',
    tags: ['swarm', 'air'],
    name: 'Bee',
    cost: 0,
    token: true,
    formation: [[0, 0]],
    role: 'A Beekeeper’s bee: tiny, fast and gone in a swat.',
    unit: {
      hp: 90,
      damage: 40,
      hitSpeed: 0.8,
      firstHit: 0.3,
      range: melee(0.25),
      sight: 5.5,
      speed: 2.4,
      radius: 0.25,
      mass: 1,
      flying: true,
      targets: 'any',
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

/** Every troop that can stand on the field, spawned ones (the Bee) too. */
const everyTroop = Object.keys(troopCards) as TroopId[];
/** Every troop a deck may hold, in the order the collection shows them. */
export const allTroops = everyTroop.filter((id) => !troopCards[id].token);
/** Every card, in the order the collection shows them. */
export const allCards = [
  ...allTroops,
  ...(Object.keys(spellCards) as SpellId[]),
] as CardId[];
/** Whether a card may go in a deck (the Bee may not). */
export const playable = (id: CardId) => isSpell(id) || !troopCards[id].token;

/** The deck everyone starts with, and the one a new player holds. */
export const DECK_SIZE = 8;
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
/** Every troop, spawned ones too, for code that needs unit stats or
 *  models. */
export const troopDeck: TroopId[] = everyTroop;

/** A deck from untrusted input: known cards, no repeats, 5 to 8 of them. */
export function validDeck(value: unknown, min = 5): value is CardId[] {
  return (
    Array.isArray(value) &&
    value.length >= min &&
    value.length <= DECK_SIZE &&
    new Set(value).size === value.length &&
    value.every(
      (c) => typeof c === 'string' && c in cards && playable(c as CardId),
    )
  );
}
