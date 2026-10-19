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
    text: 'Spend the first year fitting out your ship. Parts carry more, reward a new route or bring a second cargo home. Base modules arrive later, to turn your ship’s strengths into points.',
  },
  {
    target: 'season',
    title: 'Refit your ship',
    text: 'Keep building earlier parts in later years. Year 2 opens level II refits, and Year 3 opens level III. A refit replaces the part’s old effect with the stronger one shown; it uses your build for that flight.',
  },
  {
    target: 'season',
    title: 'Three years',
    text: `Six more upgrades arrive each year, and earlier ones stay available. Use Ship and Base to browse. At the end, every ${leftoverPer} cargo left score 1, and the most points wins.`,
  },
];
