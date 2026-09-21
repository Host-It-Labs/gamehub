/** What each world tells a player who has never seen it. Kept beside the rules
 * rather than in the table, so the setup leaflet and the in-game rules panel
 * always read the same words. */
import type { WorldId } from './types.ts';

export type Lesson = { title: string; text: string };

export const worldLessons: Record<WorldId, Lesson[]> = {
  coast: [
    {
      title: 'Hold four lamps',
      text: 'Seven lighthouses stand west to east. Five watches have to end with at least four of them still burning. Lose that and the coast goes dark for everyone at once — Orin is won or lost together.',
    },
    {
      title: 'Spend a tool each turn',
      text: 'A watch is four keeper turns however many keepers are on duty, so a lone keeper takes all four and a crew of four takes one each. A wick relights a lighthouse the fog has not reached; a lamp reaches into the fog; a shutter carries one lighthouse through the coming gale; a rope pulls one out of the fog for good.',
    },
    {
      title: 'The night takes two',
      text: 'When a watch ends the gale puts out the two westernmost lamps nobody shuttered, then the fog comes one station further in and everything it holds goes out. Shutters are cleared every watch. Ropes are not.',
    },
    {
      title: 'One bell each',
      text: 'You cannot see anyone else’s tools and you may not say what you are holding. The only thing you may say all night is one bell, which marks a single station and means nothing more than that.',
    },
  ],
  meadow: [
    {
      title: 'Two kites, one ribbon',
      text: 'Vermilion and Saffron race along twenty-four segments of silk. Reach the far bank first and the meadow is yours. Teams are always even, so an odd table is trimmed rather than handing one kite a spare pair of hands.',
    },
    {
      title: 'Everyone commits at once',
      text: 'Every flier lays one card face down and they all turn over together — teammates included. Your team moves by the total of its own cards divided by the number of fliers on it, so a pair and a trio race at the same pace.',
    },
    {
      title: 'Scissors cut the tail',
      text: 'A pair of scissors takes the single strongest gust the other team played that round, before the total is shared out. Two scissors take their two strongest. Play them when the other kite is about to take the bank.',
    },
    {
      title: 'Gusts and dead heats',
      text: 'A kite that lands exactly on a painted gust is carried two more segments. If both kites touch the bank on the same breath the stronger pull takes it, then the longer chase, and last of all the team that reached for the scissors less often.',
    },
  ],
  canal: [
    {
      title: 'Five runs, one smuggler',
      text: 'One trader is secretly the smuggler, and it can be you. The quay needs three runs delivered clean before it will sign the season off. The smuggler needs three spoiled — four at a table of three, where they are aboard almost every run.',
    },
    {
      title: 'The pilot sails',
      text: 'Each run the pilot picks the crew and is always aboard it, because a quay that let the pilot stay ashore would simply stop sending whoever it suspected. The tiller passes along after every run.',
    },
    {
      title: 'The quay can refuse',
      text: 'Before a crew sails, every trader shows a hand. A majority sends it; anything less turns it away and the tiller passes on. The quay can refuse twice in a run — the third crew sails whatever anyone thinks, so refusing is a check, not a way to stall.',
    },
    {
      title: 'Name them at the end',
      text: 'Everyone aboard loads one cargo face down. Merchants can only load clean; one rotten hold spoils the whole run. Three clean runs are not enough on their own — the quay then has to name the smuggler, and a quay that cannot agree names nobody.',
    },
  ],
};

/** The one line each world puts above its title. */
export const worldTagline: Record<WorldId, string> = {
  coast: 'THE SERVICE DOES NOT SPEAK',
  meadow: 'EVERY FLIER TURNS OVER TOGETHER',
  canal: 'ONE OF THESE HOLDS IS ROTTEN',
};
