/** Impostor's secret words. Each pair is two things that draw alike but are
 * not the same: the table gets one word, the impostor the other, and nobody
 * is told which side they are on. Every word must be quick to draw with a
 * finger, known worldwide in simple English, and free of brands and people.
 * The second entry of each word is what practice bots write as their one
 * word.
 *
 * Retired pairs keep their id so saved games still render them; they are
 * never dealt again. Ids are positions in this list: only ever append. */
export type WordPair = {
  id: number;
  words: [string, string];
  hints: [string, string];
  retired?: true;
};
const rows: [string, string, string, string][] = [
  ['Cat', 'purr', 'Fox', 'sly'],
  ['Guitar', 'strum', 'Violin', 'bow'],
  ['Rocket', 'launch', 'Lighthouse', 'coast'],
  ['Snowman', 'winter', 'Scarecrow', 'field'],
  ['Shark', 'teeth', 'Dolphin', 'clever'],
  ['Volcano', 'lava', 'Mountain', 'climb'],
  ['Igloo', 'ice', 'Tent', 'camping'],
  ['Pirate', 'treasure', 'Cowboy', 'horse'],
  ['Bee', 'honey', 'Ladybug', 'spots'],
  ['Apple', 'crunch', 'Tomato', 'sauce'],
  ['Spider', 'web', 'Octopus', 'ink'],
  ['Ghost', 'boo', 'Jellyfish', 'sting'],
  ['Dragon', 'fire', 'Dinosaur', 'fossil'],
  ['Robot', 'metal', 'Astronaut', 'space'],
  ['Whale', 'ocean', 'Submarine', 'dive'],
  ['Cactus', 'desert', 'Pineapple', 'juice'],
  ['Kite', 'wind', 'Balloon', 'party'],
  ['Burger', 'bun', 'Cake', 'birthday'],
  ['Ice cream', 'cold', 'Microphone', 'sing'],
  ['Wizard', 'spell', 'Santa', 'gifts'],
  ['Clock', 'time', 'Compass', 'north'],
  ['Castle', 'king', 'Sandcastle', 'bucket'],
  ['Beach', 'waves', 'Desert', 'camel'],
  ['Train', 'station', 'Snake', 'hiss'],
  ['Pizza', 'cheese', 'Watermelon', 'seeds'],
  ['Tree', 'leaves', 'Broccoli', 'green'],
  ['Mushroom', 'forest', 'Umbrella', 'rain'],
  ['Hedgehog', 'spikes', 'Hairbrush', 'morning'],
  ['Lion', 'roar', 'Sun', 'warm'],
  ['Rainbow', 'colours', 'Bridge', 'river'],
  ['Glasses', 'see', 'Bicycle', 'pedal'],
  ['Turtle', 'slow', 'Snail', 'slime'],
  ['Moon', 'night', 'Banana', 'peel'],
  ['Teapot', 'pour', 'Watering can', 'garden'],
  ['Tiger', 'jungle', 'Zebra', 'savanna'],
  ['Piano', 'concert', 'Keyboard', 'typing'],
  ['Ring', 'wedding', 'Donut', 'sugar'],
  ['Basketball', 'hoop', 'Orange', 'vitamin'],
  ['Snowflake', 'cold', 'Star', 'shine'],
  ['Spider web', 'sticky', 'Dartboard', 'aim'],
];
export const wordPairs: WordPair[] = rows.map(([a, ha, b, hb], id) => ({
  id,
  words: [a, b],
  hints: [ha, hb],
}));
export const livePairIds = wordPairs.filter((p) => !p.retired).map((p) => p.id);
