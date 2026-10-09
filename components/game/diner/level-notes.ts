import type { KitId, Novelty, Trouble } from '@/lib/games/diner/levels';
import type { DishId } from '@/lib/games/diner/content';
import type { IconName } from './icons';

/**
 * The words and pictures for what a level brings (9 October 2026): one short
 * line each, in the rules' voice. Numbers follow the engine.
 */
export type Note = { icon: IconName; title: string; line: string };

const DISH: Record<DishId, Note> = {
  burger: {
    icon: 'burger',
    title: 'Burgers',
    line: 'The grill takes 4 seconds. A burger burns 8 seconds after it is ready.',
  },
  shake: {
    icon: 'shake',
    title: 'Milkshakes',
    line: 'The shake machine takes 3 seconds. Shakes never spoil.',
  },
  fries: {
    icon: 'fries',
    title: 'Fries',
    line: 'The fryer takes 5 seconds. Fries burn 8 seconds after.',
  },
  pie: {
    icon: 'pie',
    title: 'Pie',
    line: 'A slice is ready the moment you take it.',
  },
};

export const KIT_NOTES: Record<KitId, Note> = {
  'chrome-tray': {
    icon: 'tray',
    title: 'Chrome tray',
    line: 'Carry three plates at once.',
  },
  'roller-skates': {
    icon: 'skate',
    title: 'Roller skates',
    line: 'Dash across the patio in a quick burst.',
  },
  'coffee-urn': {
    icon: 'coffee',
    title: 'Coffee urn',
    line: 'Take a pot and pour for a waiting party: they calm right down.',
  },
  'heat-lamp-pass': {
    icon: 'eat',
    title: 'Heat-lamp pass',
    line: 'A shelf for three plates. Full hands put one down, a free hand picks one up.',
  },
  'twin-grill': {
    icon: 'burger',
    title: 'Twin grill',
    line: 'The grill cooks three burgers at once.',
  },
  jukebox: {
    icon: 'music',
    title: 'Jukebox',
    line: "Play a song: everyone's patience stops for 8 seconds.",
  },
};

export const TROUBLE_NOTES: Record<Trouble, Note> = {
  rush: {
    icon: 'bell',
    title: 'Rushes',
    line: 'Now and then a wave of guests arrives at once.',
  },
  mimics: {
    icon: 'out',
    title: 'Mimics',
    line: 'One guest in a party gets one detail wrong. Face them and press Out!',
  },
  demanding: {
    icon: 'star',
    title: 'Big spenders',
    line: 'Starred parties wait less and pay more.',
  },
  spills: {
    icon: 'mop',
    title: 'Spills',
    line: 'Puddles slow you down. Stand in one and press Use to mop it.',
  },
  power: {
    icon: 'bolt',
    title: 'Brownouts',
    line: 'The lights dip and the kitchen cooks slower.',
  },
  jams: {
    icon: 'repair',
    title: 'Jams',
    line: 'A machine jams. Press Use at it to fix it.',
  },
  impatient: {
    icon: 'clock',
    title: 'Impatient crowd',
    line: 'Everyone waits a little less.',
  },
  'big-parties': {
    icon: 'seat',
    title: 'Big parties',
    line: 'Mostly parties of three and four.',
  },
};

export function noteFor(n: Novelty): Note {
  switch (n.kind) {
    case 'basics':
      return {
        icon: 'hand',
        title: 'Run the patio',
        line: 'Seat guests, take orders, cook, serve and clear the tables.',
      };
    case 'dish':
      return DISH[n.dish];
    case 'kit':
      return KIT_NOTES[n.kit];
    case 'trouble':
      return TROUBLE_NOTES[n.trouble];
    case 'booths':
      return {
        icon: 'seat',
        title: `${n.count} booths`,
        line: 'More room, and more guests to fill it.',
      };
    case 'lives':
      return {
        icon: 'heart',
        title: `${n.count} lives`,
        line: 'A walk-out or a wrong Out! costs one.',
      };
    case 'boss':
      return {
        icon: 'star',
        title: 'Boss',
        line: 'The hardest shift of the chapter.',
      };
  }
}

/** Campaign troubles arrive as names; map the ones the levels also use. */
const BY_NAME: Record<string, Trouble> = {
  Rushes: 'rush',
  Mimics: 'mimics',
  'Big spenders': 'demanding',
  Spills: 'spills',
  Brownouts: 'power',
  Jams: 'jams',
};
export const troubleNote = (name: string): Note =>
  BY_NAME[name]
    ? TROUBLE_NOTES[BY_NAME[name]]
    : { icon: 'star', title: name, line: '' };
