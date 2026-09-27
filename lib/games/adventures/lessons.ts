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
import { roundVoteMs } from '../party/vote.ts';

const seconds = roundVoteMs / 1000;
const percent = (e: number) => `${Math.round(e * 100)}%`;
const vote = (again: string, other: string) =>
  `the table has ${seconds} seconds to vote: ${again} again, ${other}, or End. Points carry across both games, and the most points wins.`;
const [closeOff, closeScore] = curve[0];
const halfScore = curve.find(([e]) => e === 0.5)![1];
const [farOff, farScore] = curve[curve.length - 1];

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
    {
      title: 'Guess each list',
      text: 'Then each list takes a turn. Everyone but its author ranks it the way they think the author did, and locks. You can unlock until everyone has locked.',
    },
    {
      title: 'Closer scores more',
      text: `Each answer scores ${nearPoints[0]} on the author’s exact rank and ${nearPoints[1]} one rank away, so a perfect list scores ${perfectPoints}. The author scores nothing on their own list. The host presses Next to move on.`,
    },
    {
      title: 'Another round?',
      text: `When every list is done, ${vote('Top Five', 'Dial')}`,
    },
  ],
  dial: [
    {
      title: 'Everyone writes a clue',
      text: 'Everyone gets their own spectrum at once. Pick one of two, such as Cold – Hot, see its hidden point and type a short clue that sits right there. You can unlock until everyone has locked.',
    },
    {
      title: 'Read the clues',
      text: 'The clues come up one after the other. Everyone but the author turns their own dial to where they think the point is, and locks. The author stays quiet.',
    },
    {
      title: 'Closer scores more',
      text: `On the 0–100 dial, within ${bands[0]} of the point scores ${dialPoints(bands[0], 0)}, within ${bands[1]} scores ${dialPoints(bands[1], 0)} and within ${bands[2]} scores ${dialPoints(bands[2], 0)}. The author earns the average of everyone’s points. The host presses Next for the next clue.`,
    },
    {
      title: 'Another round?',
      text: `When every clue is read, ${vote('Dial', 'Top Five')}`,
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
    {
      title: 'Another round?',
      text: `After the final, ${vote('Atlas', 'Sizes')}`,
    },
  ],
  size: [
    {
      title: 'Size it up',
      text: 'One silhouette stands at its true size. Resize the red one to its own real size beside it. Each round has 3: an animal, an object or landmark, then a country.',
    },
    {
      title: 'Resize and lock',
      text: 'Pull the red silhouette’s corner handle, or pinch, to resize it. Size all three, then lock once. You can unlock until everyone has locked.',
    },
    {
      title: 'Closer scores more',
      text: `Within ${percent(closeOff)} of the true size scores ${closeScore}. Half off scores ${halfScore}, and ${percent(farOff)} off or more scores ${farScore}. The host reveals the three one at a time.`,
    },
    {
      title: 'Another round?',
      text: `After the third reveal, ${vote('Sizes', 'Atlas')}`,
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
