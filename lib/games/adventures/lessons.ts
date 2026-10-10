import type { StandaloneId } from '../standalone/types.ts';
import {
  standaloneGames,
  type AnyGame,
  botMove,
} from '../standalone/registry.ts';
import { nearPoints, perfectPoints } from '../party/ranking.ts';
import { bands, points as dialPoints } from '../party/dial.ts';
import { maxPinPoints, pinCurve } from '../party/geography.ts';
import { curve } from '../party/size.ts';
import { coinCost, perfectRead, totalCoins } from '../party/coins.ts';
import { eraFactor, yearCurve } from '../party/year.ts';
import { pairCost, pairPoints } from '../party/order.ts';
import { roundVoteMs } from '../party/vote.ts';
import {
  drawMs,
  escapePoints,
  foundPoints,
} from '../party/impostor.ts';

const seconds = roundVoteMs / 1000;
const percent = (e: number) => `${Math.round(e * 100)}%`;
const next = (again: string, set: string) =>
  `the host picks: ${again} again, another ${set} game, or End. With Votes on in setup, the table has ${seconds} seconds to vote instead. Points carry across the games, and the most points wins.`;
const [closeOff, closeScore] = curve[0];
const [farOff, farScore] = curve[curve.length - 1];
const lastYears = yearCurve[yearCurve.length - 1][0];
const guessAll =
  'Then everyone at once guesses every other player. Tap a face to switch between them, and lock once when all are done. You can unlock until everyone has locked.';

/** The practice coach's four steps per game: a short heading and a line or
 * two each. Numbers come from the engines. The How to play is
 * `components/game/party-rules.tsx`. */
export const adventureLessons: Record<
  StandaloneId,
  { title: string; text: string }[]
> = {
  orin: [
    {
      title: 'Rank your list',
      text: 'Pick one of 3 prompts and rank its 5 answers from 1st to 5th, the way you really feel. You may refresh the prompts twice a round. Lock your private list when you are done.',
    },
    { title: 'Guess every list', text: guessAll },
    {
      title: 'Closer scores more',
      text: `The lists are revealed one by one, and the host presses Next. Each answer scores ${nearPoints[0]} on the author’s exact rank and ${nearPoints[1]} one rank away, so a perfect list scores ${perfectPoints}. The author scores nothing on their own list.`,
    },
    {
      title: 'What next?',
      text: `When every list is revealed, ${next('Top Five', 'Know Me')}`,
    },
  ],
  dial: [
    {
      title: 'Everyone writes a clue',
      text: 'Everyone gets their own spectrum at once, such as Cold – Hot: see its hidden point and type a short clue that sits right there. Or take the Me card, such as Night owl – Early bird, and turn the dial to where you really are. You can unlock until everyone has locked.',
    },
    {
      title: 'Turn every dial',
      text: 'Then everyone at once turns a dial for every other clue. Tap a face to switch clues, and lock once when all are done.',
    },
    {
      title: 'Closer scores more',
      text: `The clues are revealed one by one. On the 0–100 dial, within ${bands[0]} of the point scores ${dialPoints(bands[0], 0)}, within ${bands[1]} scores ${dialPoints(bands[1], 0)} and within ${bands[2]} scores ${dialPoints(bands[2], 0)}. The author earns the average of everyone’s points.`,
    },
    {
      title: 'What next?',
      text: `When every clue is revealed, ${next('Dial', 'Know Me')}`,
    },
  ],
  coins: [
    {
      title: 'Split your coins',
      text: `Everyone gets their own prompt at once, such as A perfect weekend: Sleep, Friends, Adventure, Food. Pick one of two and share exactly ${totalCoins} coins between its options, the way you really are. Then lock.`,
    },
    { title: 'Guess every split', text: guessAll },
    {
      title: 'Closer scores more',
      text: `The splits are revealed one by one, and the host presses Next. A perfect read scores ${perfectRead}, and every coin out of place costs ${coinCost}. The author scores nothing on their own split.`,
    },
    {
      title: 'What next?',
      text: `When every split is revealed, ${next('Ten Coins', 'Know Me')}`,
    },
  ],
  miro: [
    {
      title: 'Two places and a final',
      text: 'Each round has 3 places: a named town or city, a harder one, then a photo with two clues and no name.',
    },
    {
      title: 'Pin all three',
      text: 'Tap the globe to drop a pin for each place. Your pins stay put when you switch places. Lock all three together: a lock is final.',
    },
    {
      title: 'Closer scores more',
      text: `The places are revealed one by one, and the host presses Next to move on. Every pin scores up to ${maxPinPoints} by how far it landed: within ${pinCurve[0][0]} km scores ${maxPinPoints}, ${pinCurve[3][0]} km off scores ${pinCurve[3][1]}, and ${pinCurve[pinCurve.length - 1][0].toLocaleString('en')} km or more scores nothing.`,
    },
    { title: 'What next?', text: `After the final, ${next('Atlas', 'Trivia')}` },
  ],
  size: [
    {
      title: 'Size it up',
      text: 'The cream piece stands at its true size. Make the red one its own real size beside it. Each round has 3: an animal, an object or landmark, then a country, lying flat like a map.',
    },
    {
      title: 'Resize and lock',
      text: 'Slide the tape on the right, pull the red piece’s knob, or pinch to resize it. Drag a piece to move it, the mat to look around. Size all three, then lock once.',
    },
    {
      title: 'Closer scores more',
      text: `Within ${percent(closeOff - 1)} of the true size scores ${closeScore}. ${farOff === 2 ? 'Twice or half the size' : `${farOff} times too big or small`} scores ${farScore}: double and half cost the same. The host reveals the three one at a time.`,
    },
    {
      title: 'What next?',
      text: `After the third reveal, ${next('Sizes', 'Trivia')}`,
    },
  ],
  year: [
    {
      title: 'Three events',
      text: 'Each round has 3 events: one from before 1800, one from 1800 to 1949 and one since 1950, in any order.',
    },
    {
      title: 'Place and lock',
      text: 'Drag the marker along the timeline to the year you think it happened, and fine-tune on the close-up ruler. Place all three, then lock once.',
    },
    {
      title: 'Closer scores more',
      text: `The right year scores ${yearCurve[0][1]}. Older events give more room: nothing at ${lastYears * eraFactor.old} years off before 1800, ${lastYears * eraFactor.modern} from 1800 to 1949 and ${lastYears} since 1950. The host reveals the three one at a time.`,
    },
    {
      title: 'What next?',
      text: `After the third reveal, ${next('Years', 'Trivia')}`,
    },
  ],
  order: [
    {
      title: 'Put them in order',
      text: 'Each round has 3 sets of five things, such as buildings to put tallest first. Drag them into order.',
    },
    {
      title: 'Sort and lock',
      text: 'Sort all three sets, then lock once. You can unlock until everyone has locked.',
    },
    {
      title: 'Closer scores more',
      text: `A perfect order scores ${pairPoints[0]}. Every pair of things the wrong way round costs ${pairCost}, down to nothing. The host reveals the three one at a time.`,
    },
    {
      title: 'What next?',
      text: `After the third reveal, ${next('Order', 'Trivia')}`,
    },
  ],
  impostor: [
    {
      title: 'Draw your word',
      text: `Everyone gets a secret word, such as Cat. The impostor gets a close one, such as Fox, and nobody is told who it is: maybe it is you. Draw your word in ${drawMs / 1000} seconds, without letters.`,
    },
    {
      title: 'One word',
      text: 'Every drawing goes up on the board. Write one word that fits your own word, without giving it away. If the drawings look wrong to you, you may be the impostor: blend in.',
    },
    {
      title: 'Accuse',
      text: `Then everyone accuses one player and locks. Accusing an impostor scores ${foundPoints}. An impostor without the most accusations escapes and scores ${escapePoints}.`,
    },
    {
      title: 'What next?',
      text: `The reveal shows both words. Then the host picks another round or End. With Votes on in setup, the table has ${seconds} seconds to vote instead. The most points wins.`,
    },
  ],
};
export function practice(
  kind: StandaloneId,
  seats: number,
  difficulty: AnyGame['difficulty'],
  step = 0,
): AnyGame {
  const g = standaloneGames[kind].create(seats, 4817, difficulty);
  g.tutorial = true;
  g.lesson = step;
  return g;
}
export function advancePractice(game: AnyGame, viewer = 0): AnyGame {
  if (!game.tutorial || game.over) return game;
  let g = game;
  const e = standaloneGames[g.kind];
  for (let i = 0; i < 24; i++) {
    const seat = e.actingSeats(g).find((s) => s !== viewer);
    if (seat === undefined) break;
    const m = botMove(g, seat);
    if (!m) break;
    const n = e.play(g, m, seat);
    if (n === g) break;
    g = n;
    if (g.phase !== game.phase || g.round !== game.round || g.over) break;
  }
  return g;
}
