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
      text: 'All eligible guesses lock before any answer is revealed. Earn one point per exact position and two extra for a perfect five. The author’s teammates earn the average of their individual scores for that list; the opposing team earns its shared guess score. Nobody sees another private guess before reveal. Shared teammates see ranking changes while dragging. Every player presses Continue to move on.',
    },
    {
      title: 'Two rounds, fresh topics',
      text: 'Every player is guessed once per round. After two rounds the player or team with most points wins; equal scores tie. Solo bots provide practice guesses, not a model of your personal tastes. In practice, Advance time plays bots; Start real game begins a fresh match.',
    },
  ],
  miro: [
    {
      title: 'Two rounds, six places',
      text: 'Round one uses medium destinations; round two uses hard destinations. Each round runs Places (town and country), Photos, then Three facts, with one shared destination per category. Play individually or choose two teams with 2–6 players. Five players can split three against two.',
    },
    {
      title: 'Prepare all three private pins',
      text: 'At the start of each round, complete Places, Photos and Three facts independently, in any order. Switch tabs freely: your pins are preserved. Rotate and zoom the globe to refine each guess, then lock all three together. Even teammates cannot see your pins until everyone locks all three. Only then does each team discuss all three categories in a single turn; all pins stay frozen for the entire round.',
    },
    {
      title: 'One team speaks at a time',
      text: 'All stay on the same call. The first round’s starting team is chosen at random; the other team starts round two. Each team has 60 seconds to discuss all three destinations. One captain chooses a frozen teammate pin for each category and confirms all three together before the other team takes its turn. Captains stay the same throughout a round; not everyone needs to be captain. At the deadline, unchosen answers use the captain’s frozen pins. The other team listens, then takes its turn. Practice has no timer. After both teams confirm, reveal the three destinations one at a time. Individual mode starts revealing immediately after all private guesses lock.',
    },
    {
      title: 'Closest wins',
      text: 'Reveal the destination after both teams choose. Each destination awards one point for the closest pin and one bonus point to every team within 100 km. Equally close pins share the closest point. After two rounds, most points wins; lowest total distance breaks a points tie. Exact distance ties share victory. Photo credits and location references are available at reveal. Practice bots are illustrative opponents, not geography experts.',
    },
  ],
};
export function practice(
  kind: StandaloneId,
  seats: number,
  difficulty: AnyGame['difficulty'],
  step = 0,
  mode: 'teams' | 'individual' = 'individual',
  teams?: number[],
): AnyGame {
  const g = standaloneGames[kind].create(seats, 4817, difficulty, mode, undefined, teams);
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
