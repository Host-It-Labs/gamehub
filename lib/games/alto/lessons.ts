import { baseHold, growthFor, leftoverPer } from './content.ts';

/** Learn: a practice match against bots with a short coach, one idea a step.
 *  `target` names the part of the table the coach points at (data-coach). */
export const altoLessons: { target: string; title: string; text: string }[] = [
  {
    target: 'islands',
    title: 'Pick a planet',
    text: 'Tap a planet to fly there. Everyone picks at once, and nobody sees your pick until all ships leave.',
  },
  {
    target: 'islands',
    title: 'Alone or together',
    text: `Alone, you load the whole pile, up to your hold of ${baseHold}. With others, you split it evenly and the rest stays. Planets fill by ${growthFor(2)} each turn, so a quiet planet grows.`,
  },
  {
    target: 'hand',
    title: 'Build first',
    text: 'Before you pick a planet, you may tap an upgrade you can pay for. It is built with the cargo you already hold; the new cargo arrives after.',
  },
  {
    target: 'hand',
    title: 'Ship or base',
    text: 'Blue ship parts bolt onto your ship and load more cargo. Gold base modules build up your home base and score points; trophies pay most to the first builder.',
  },
  {
    target: 'season',
    title: 'Three years',
    text: `Each year the shop holds its own upgrades; they leave when it ends. At the end, every ${leftoverPer} cargo left score 1, and the most points wins.`,
  },
];
