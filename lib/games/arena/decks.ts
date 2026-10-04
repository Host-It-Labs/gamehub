import { deck, type CardId } from './cards.ts';

/**
 * Ready-made decks. Bots in Versus draw one at random, so a battle is not
 * always against the same eight cards; Quest foes are built from them too
 * (quest.ts). Every one is a playable eight: a win condition, an answer to
 * air, splash for swarms, something cheap and the Meteor or a stand-in.
 */
export type Preset = { id: string; name: string; cards: CardId[] };

export const presets: Preset[] = [
  { id: 'classic', name: 'Classic', cards: deck },
  {
    id: 'raiders',
    name: 'Raiders',
    cards: [
      'pirate',
      'gladiator',
      'archers',
      'balloon',
      'medic',
      'imps',
      'inventor',
      'meteor',
    ],
  },
  {
    id: 'siege',
    name: 'Siege',
    cards: [
      'gunner',
      'viking',
      'mage',
      'duelist',
      'miner',
      'imps',
      'ranger',
      'meteor',
    ],
  },
  {
    id: 'sky',
    name: 'Sky',
    cards: [
      'drake',
      'balloon',
      'archers',
      'pirate',
      'viking',
      'medic',
      'ranger',
      'meteor',
    ],
  },
  {
    id: 'stampede',
    name: 'Stampede',
    cards: [
      'ogre',
      'medic',
      'gladiator',
      'inventor',
      'imps',
      'archers',
      'miner',
      'meteor',
    ],
  },
  {
    // The Diver walks in front, shrugging off swarms; bees and frost
    // follow.
    id: 'deep',
    name: 'Deep Sea',
    cards: [
      'diver',
      'beekeeper',
      'explorer',
      'firefighter',
      'imps',
      'pirate',
      'archers',
      'meteor',
    ],
  },
  {
    // The Sumo stomps in with the Drummer behind; cheap troops in between.
    id: 'dojo',
    name: 'Dojo',
    cards: [
      'sumo',
      'drummer',
      'mage',
      'jetpack',
      'linebacker',
      'imps',
      'archers',
      'meteor',
    ],
  },
  {
    // Cheap and quick: the Linebacker leads, the Jetpack flies over.
    id: 'blitz',
    name: 'Blitz',
    cards: [
      'linebacker',
      'jetpack',
      'drummer',
      'pirate',
      'imps',
      'inventor',
      'ranger',
      'miner',
    ],
  },
  {
    // Holds the bridge with water and frost, then the Gunner shells.
    id: 'frost',
    name: 'Frost',
    cards: [
      'explorer',
      'firefighter',
      'gunner',
      'diver',
      'beekeeper',
      'drake',
      'viking',
      'meteor',
    ],
  },
];

/** A preset picked by a seed, so every device agrees. */
export function presetFor(seed: number): Preset {
  return presets[(seed >>> 0) % presets.length];
}
