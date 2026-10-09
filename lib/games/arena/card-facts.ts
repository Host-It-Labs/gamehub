import {
  cards,
  SHIELD_DELAY,
  SHIELD_RECHARGE,
  troopCards,
  type CardId,
  type UnitStats,
} from './cards.ts';
import { levelScale, type Boost } from './engine.ts';

/**
 * What a card's stats panel shows (`components/game/arena/card-info.tsx`),
 * read from the card's own numbers in `cards.ts` with the owner's level and
 * boosts applied the way `summon` and `deploy` in the engine apply them. A
 * stat is an icon, a value and a short label; each ability is one short
 * line made from its fields, keyed by the field it comes from.
 */
export type StatKey =
  | 'hp'
  | 'damage'
  | 'dps'
  | 'hitSpeed'
  | 'range'
  | 'speed'
  | 'targets'
  | 'splash'
  | 'towerDamage'
  | 'radius'
  | 'delay';

export type Stat = { key: StatKey; label: string; value: string };
export type Ability = { key: string; text: string };

export type CardFacts = {
  id: CardId;
  name: string;
  cost: number;
  kind: 'troop' | 'spell';
  /** Troops placed by one card. */
  count: number;
  /** One or two words each: Tank, Fighter, Spell. */
  roles: string[];
  flying: boolean;
  /** 1 is the base; Quest upgrades raise it. */
  level: number;
  stats: Stat[];
  abilities: Ability[];
};

/** The fields every troop has, shown as stats rather than ability lines;
 *  any other field of `UnitStats` is an ability and must get a line. */
export const BASE_FIELDS = [
  'hp',
  'damage',
  'hitSpeed',
  'firstHit',
  'range',
  'sight',
  'speed',
  'radius',
  'mass',
  'flying',
  'targets',
  'splash',
  'projectile',
] as const;

/** The ability fields that have their own line, in the order shown. */
export const ABILITY_FIELDS = [
  'leap',
  'spin',
  'rage',
  'shield',
  'heal',
  'burrow',
  'deathBlast',
  'chain',
  'stun',
  'minRange',
  'armour',
  'taunt',
  'knockback',
  'tackle',
  'spawn',
  'aura',
  'follows',
  'cone',
  'slow',
] as const;

const ROLE: Record<string, string> = {
  tank: 'Tank',
  swarm: 'Swarm',
  fighter: 'Fighter',
  ranged: 'Ranged',
  air: 'Air',
  splash: 'Splash',
  siege: 'Siege',
  support: 'Support',
  control: 'Control',
};
const roleName = (tag: string) =>
  ROLE[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);

/** A number as the panel prints it: at most two decimals, no trailing zeros. */
export const fmt = (n: number) => String(Math.round(n * 100) / 100);
const tiles = (n: number) => `${fmt(n)} ${n === 1 ? 'tile' : 'tiles'}`;
const seconds = (n: number) => `${fmt(n)} s`;
const share = (f: number) => (f === 0.5 ? 'half' : `${fmt(f * 100)}%`);

const TARGETS: Record<UnitStats['targets'], string> = {
  any: 'Air & ground',
  ground: 'Ground',
  buildings: 'Towers',
};

/** Names of the troop cards at or above a mass, for "not the Dino". */
function heavy(mass: number) {
  return Object.values(troopCards)
    .filter((c) => c.unit.mass >= mass)
    .map((c) => c.name);
}
/** " (not the Dino)" when some troops are too heavy to be pushed. */
const except = (mass: number) => {
  const names = heavy(mass);
  return names.length ? ` (not the ${list(names)})` : '';
};
/** The card that releases a token troop (the Beekeeper's Bee). */
const parentOf = (id: CardId) =>
  Object.values(troopCards).find((c) => c.unit.spawn?.unit === id)?.id;
const list = (names: string[]) =>
  names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;

type Scale = { hp: number; power: number; pace: number };

/** One line per ability field present on a troop, in a fixed order
 *  (`ABILITY_FIELDS`; the tests check that every field has its line). */
function abilityLines(s: UnitStats, k: Scale): Ability[] {
  const out: Ability[] = [];
  const say = (key: string, text: string) => out.push({ key, text });

  if (s.leap)
    say(
      'leap',
      `Leaps at troops within ${tiles(s.leap.range)}; first hit ×${fmt(s.leap.bonus)}. Every ${seconds(s.leap.cooldown)}.`,
    );
  if (s.spin) say('spin', `Hits every enemy within ${tiles(s.spin)}.`);
  if (s.rage)
    say(
      'rage',
      `Under ${share(s.rage.below)} health: ×${fmt(s.rage.boost)} speed and hit speed.`,
    );
  if (s.shield)
    say(
      'shield',
      `A ${Math.round(s.shield * k.hp)} shield takes damage first; excess hits health. After ${seconds(SHIELD_DELAY)} without damage, refills in ${seconds(SHIELD_RECHARGE)}.`,
    );
  if (s.heal)
    say(
      'heal',
      `Heals friends within ${tiles(s.heal.radius)} by ${Math.round(s.heal.amount * k.power)} ${
        s.heal.every === 1 ? 'a second' : `every ${seconds(s.heal.every)}`
      }.${s.damage || s.follows ? '' : ' Never attacks.'}`,
    );
  if (s.burrow)
    say(
      'burrow',
      `Plays anywhere on the field; digs for ${seconds(s.burrow)}.`,
    );
  if (s.deathBlast)
    say(
      'deathBlast',
      `When it falls: ${s.deathBlast.damage} damage within ${tiles(s.deathBlast.radius)}.`,
    );
  if (s.chain)
    say(
      'chain',
      `Each shot jumps to ${s.chain.count} enemies, ${tiles(s.chain.range)} apart.`,
    );
  if (s.stun) say('stun', `Each hit stuns for ${seconds(s.stun)}.`);
  if (s.minRange)
    say('minRange', `Cannot hit anything within ${tiles(s.minRange)}.`);

  if (s.armour)
    say(
      'armour',
      `Every hit on it loses ${s.armour.flat}, but lands at least ${fmt(s.armour.min * 100)}%.`,
    );
  if (s.taunt)
    say(
      'taunt',
      `Lands with a stomp: enemy troops within ${tiles(s.taunt.radius)} turn on it for ${seconds(s.taunt.seconds)}.`,
    );
  if (s.knockback)
    say(
      'knockback',
      `Each blow pushes troops ${tiles(s.knockback.distance)} back${except(s.knockback.mass)}.`,
    );
  if (s.tackle)
    say(
      'tackle',
      `Its first blow on each target stuns it ${seconds(s.tackle.stun)} and pushes it ${tiles(s.tackle.distance)}${except(s.tackle.mass)}.`,
    );
  if (s.spawn) {
    // Its troops take its level.
    const t = troopCards[s.spawn.unit];
    const name = t.name.toLowerCase() + (s.spawn.count === 1 ? '' : 's');
    say(
      'spawn',
      `Releases ${s.spawn.count} ${name} every ${seconds(s.spawn.every)}: ${Math.round(t.unit.hp * k.hp)} hit points, ${Math.round(t.unit.damage * k.power)} damage each.`,
    );
  }
  if (s.aura)
    say(
      'aura',
      `Friends within ${tiles(s.aura.radius)} move and strike ×${fmt(s.aura.boost)}.`,
    );
  if (s.follows)
    say(
      'follows',
      s.damage ? 'Follows a friend.' : 'Follows a friend; never attacks.',
    );
  if (s.cone)
    say(
      'cone',
      `Sprays a cone: hits all in it and pushes ground troops back ${tiles(s.cone.push)}${except(s.cone.mass)}.`,
    );
  if (s.slow)
    say(
      'slow',
      `Each hit slows a troop's steps and blows by ${fmt(Math.round((1 - s.slow.factor) * 100))}% for ${seconds(s.slow.seconds)}.`,
    );
  return out;
}

/**
 * Everything a card's panel shows. `boost` is the owner's (Quest levels
 * and charms, a boss's edge); without one, the card's base numbers.
 */
export function cardFacts(id: CardId, boost?: Boost): CardFacts {
  const card = cards[id];
  // A token troop takes the level of the card that releases it.
  const leveled = parentOf(id) ?? id;
  const levels = boost?.levels?.[leveled] ?? 1;
  const level = levelScale(boost, leveled);
  if (card.kind === 'spell') {
    const s = card.spell;
    const power = level * (boost?.spellDamage ?? 1);
    return {
      id,
      name: card.name,
      cost: card.cost,
      kind: 'spell',
      count: 1,
      roles: ['Spell'],
      flying: false,
      level: levels,
      stats: [
        {
          key: 'damage',
          label: 'Damage',
          value: String(Math.round(s.damage * power)),
        },
        {
          key: 'towerDamage',
          label: 'Towers',
          value: String(Math.round(s.towerDamage * power)),
        },
        { key: 'radius', label: 'Radius', value: fmt(s.radius) },
        { key: 'delay', label: 'Falls', value: seconds(s.delay) },
        { key: 'targets', label: 'Targets', value: 'Air & ground' },
      ],
      abilities: [
        {
          key: 'anywhere',
          text: 'Cast anywhere on the field, towers too.',
        },
        {
          key: 'knockback',
          text: `Pushes troops ${tiles(s.knockback)} away${except(s.knockMass)}.`,
        },
      ],
    };
  }
  const s = card.unit;
  const k: Scale = {
    hp: level * (boost?.troopHp ?? 1),
    power: level * (boost?.troopDamage ?? 1),
    pace: boost?.troopSpeed ?? 1,
  };
  const stats: Stat[] = [
    { key: 'hp', label: 'Hit points', value: String(Math.round(s.hp * k.hp)) },
  ];
  // A troop that never attacks (the Medic) shows no attack numbers.
  const attacks = s.damage > 0;
  if (attacks) {
    const hit = Math.round(s.damage * k.power);
    stats.push(
      { key: 'damage', label: 'Damage', value: String(hit) },
      {
        key: 'dps',
        label: 'Per second',
        value: String(Math.round(hit / s.hitSpeed)),
      },
      { key: 'hitSpeed', label: 'Hit speed', value: seconds(s.hitSpeed) },
      {
        key: 'range',
        label: 'Range',
        // Melee reach is a third of a tile past the troop's own edge.
        value: s.range > s.radius + 0.4 ? fmt(s.range) : 'Melee',
      },
    );
  }
  stats.push({ key: 'speed', label: 'Speed', value: fmt(s.speed * k.pace) });
  if (attacks)
    stats.push({ key: 'targets', label: 'Targets', value: TARGETS[s.targets] });
  if (attacks && s.splash)
    stats.push({ key: 'splash', label: 'Area', value: fmt(s.splash) });
  return {
    id,
    name: card.name,
    cost: card.cost,
    kind: 'troop',
    count: card.formation.length,
    roles: card.tags.map(roleName),
    flying: s.flying,
    level: levels,
    stats,
    abilities: abilityLines(s, k),
  };
}
