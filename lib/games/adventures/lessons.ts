import type { StandaloneId } from '../standalone/types.ts';
import {
  standaloneGames,
  type AnyGame,
  botMove,
} from '../standalone/registry.ts';
export const adventureLessons: Record<
  StandaloneId,
  { title: string; text: string }[]
> = {
  orin: [
    {
      title: 'Everyone ranks at once',
      text: 'Choose one of three prepared topics. You can refresh all three choices twice per round; refreshing an open list selects the first fresh topic. Switching topics restores your previous order. Rank the five answers from 1st (your favourite) to 5th (your least favourite). Your order stays private. Lock when ready; you can unlock until everyone has locked.',
    },
    {
      title: 'Read the player',
      text: 'Play individually with 2–6 players, or in two customizable teams with 2–6 players, including uneven teams. Everyone prepares a private list at once. Each list then takes a turn in the spotlight. In teams, opponents discuss one shared guess and the captain locks it. The author’s teammates each guess privately and silently; the author stays silent throughout. In individual mode, everyone except the owner makes a separate private guess.',
    },
    {
      title: 'Reveal together',
      text: 'All eligible guesses lock before any answer is revealed. Each answer scores by how close you put it: two points on the right rank, one point a single rank away, so a perfect five earns ten. The author’s teammates earn the average of their individual scores for that list; the opposing team earns its shared guess score. Nobody sees another private guess before reveal. Shared teammates see ranking changes while dragging. The host presses Next to move on.',
    },
    {
      title: 'Another round?',
      text: 'Every player is guessed once per round. After each round everyone has ten seconds to vote: another round or finish. The most votes wins, silent players don’t count, and a tie keeps playing. When the table finishes, the player or team with most points wins; equal scores tie. Then ten seconds to vote which party game comes next. Spot a prompt that falls flat? Flag it so we can replace it. Solo bots provide practice guesses, not a model of your personal tastes. In practice, Advance time plays bots; Start real game begins a fresh match.',
    },
  ],
  miro: [
    {
      title: 'Two places and a final',
      text: 'Each round has three places. First a named town or city, then a harder one, then the final: a photograph and two clues, with no name given. Play individually or in two teams with 2–6 players. Five players can split three against two.',
    },
    {
      title: 'Pin all three privately',
      text: 'Pin the three places in any order; switch tabs freely and your pins stay put. Spin and zoom the globe to refine each pin, then lock all three together. Even teammates cannot see your pins until everyone has locked.',
    },
    {
      title: 'One team speaks at a time',
      text: 'In teams, each team then has 60 seconds to talk it over. Its captain picks one teammate’s frozen pin for each place and confirms all three before the other team takes its turn. At the deadline, unpicked places use the captain’s own pins. Practice has no timer. Individual play goes straight to the reveal.',
    },
    {
      title: 'Closest wins',
      text: 'The host reveals the places one at a time. The closest pin scores 50, and every pin within 100 km scores 50 more; equally close pins share the 50. After the final, everyone has ten seconds to vote: Atlas again, Sizes, or End. Points carry across both games; lowest total distance breaks an Atlas points tie. Photo credits and sources are at each reveal.',
    },
  ],
  size: [
    {
      title: 'Size it up',
      text: 'One silhouette stands at its true size; resize the other to match its real-world size. Each round brings three: an animal, an object or landmark, then a country measured east to west or north to south.',
    },
    {
      title: 'Drag, stretch, lock',
      text: 'Drag the red silhouette to move it and pull its corner handle, or pinch, to resize it. Zoom the board out when you need room. Lock your guess; you can unlock until everyone has locked. Everyone plays for themselves.',
    },
    {
      title: 'Closer scores more',
      text: 'Each reveal shows the true size behind every guess. Within 6% scores 100; 12% off scores 90, 20% off 78, 32% off 62, half off 45, and anything 160% off or more scores nothing. Sizes are typical adult or standard figures, printed with each answer. The host moves on.',
    },
    {
      title: 'Another round?',
      text: 'After each round everyone has ten seconds to vote: Sizes again, Atlas, or End. Points carry across both games; the most points wins.',
    },
  ],
  dial: [
    {
      title: 'One clue, one hidden point',
      text: 'Each turn one player is the clue-giver. They pick one of two spectrums, such as Cold – Hot, and only they see where the hidden point sits on it. They type one short clue: something that sits exactly there, like “A bath” for a point a little towards Hot. No numbers, no pointing.',
    },
    {
      title: 'Turn your own dial',
      text: 'Everyone else reads the clue and privately turns their dial to where they think the point is. Talk it over if you like, but each player locks their own dial. The clue-giver stays quiet. You can unlock until everyone has locked.',
    },
    {
      title: 'Closer scores more',
      text: 'Within 2 of the point scores 4, within 6 scores 3, within 10 scores 2. The clue-giver earns the average of what everyone scored, so a good clue pays. The host presses Next to move on to the next clue-giver.',
    },
    {
      title: 'Another round?',
      text: 'Every player gives one clue per round. After each round everyone has ten seconds to vote: another round or finish. The most votes wins and a tie keeps playing. Most points wins; equal scores tie. Then ten seconds to vote which party game comes next.',
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
