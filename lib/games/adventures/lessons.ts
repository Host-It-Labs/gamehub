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
      text: 'Choose one of three prepared topics. Put its five answers in S, A, B, C and D, exactly one per tier. S is your favourite; D is your least favourite. Your order stays private. Lock when ready; you can unlock until everyone has locked.',
    },
    {
      title: 'Read the player',
      text: 'Play individually with 2–6 players, or in two teams with 4 or 6. Everyone prepares a private list at once. Each list then takes a turn in the spotlight. In teams, only the opposing team guesses; discuss over your call and let the named captain lock the shared guess. In individual mode, everyone except the owner makes a separate private guess.',
    },
    {
      title: 'Reveal together',
      text: 'All eligible guesses lock before any answer is revealed. Earn one point per exact tier and two extra for a perfect five. Nobody sees the other team’s draft. Every player presses Continue to move on.',
    },
    {
      title: 'Two rounds, fresh topics',
      text: 'Every player is guessed once per round. After two rounds the player or team with most points wins; equal scores tie. Solo bots provide practice guesses, not a model of your personal tastes. In practice, Advance time plays bots; Start real game begins a fresh match.',
    },
  ],
  vela: [
    {
      title: 'Two lists, one fox',
      text: 'Choose one of two factual top-five cards. Its order is fixed by a cited source, year and measurement. Type one plausible sixth answer outside that list. Everyone prepares privately at the same time. Duplicate answers are rejected; avoid alternate spellings of a real entry.',
    },
    {
      title: 'Find the fake and rank the facts',
      text: 'The six answers are shuffled. Drag the five real entries into factual order and put the decoy in the Fox row. In individual mode everyone except the author guesses privately. In team mode only the opposing team guesses; everyone may edit its shared draft, but only the rotating captain locks it.',
    },
    {
      title: 'Facts score, foxes bite',
      text: 'Score one point for each factual answer in its exact position, plus three for putting the decoy in Fox: eight points for a perfect guess. The author or their team earns two bluff points for each opposing player or team that misses the decoy. No confidence bets. All guesses lock before the reveal.',
    },
    {
      title: 'Check the source',
      text: 'The reveal shows the answer, measured values, year, scope and source link. Cards rank reporting economies: territories may be included and missing data is excluded. Every player authors one list per round, for two rounds. Highest score wins; ties share victory. Continue advances only when everyone is ready.',
    },
  ],
  miro: [
    {
      title: 'One shared world',
      text: 'Atlas gives everyone the exact same five capital cities and the exact same task each round. Play individually with 2–6 people, or in exactly two equal teams with 4 or 6. Every team has the same number of guesses and scoring opportunities. There is no speed bonus or time pressure.',
    },
    {
      title: 'Build your route',
      text: 'Drag the cities west-to-east, north-to-south, or nearest-to-farthest from the named shared city. Directional rounds use signed longitude or latitude; distance rounds use great-circle distance. Spin and zoom the unlabelled globe to think it through. The capital markers appear only at the reveal.',
    },
    {
      title: 'Talk, lock, reveal',
      text: 'Everyone can stay on the same call. Keep your answer private, or discuss with your teammates and move the shared draft. One rotating captain locks each team’s answer. You may unlock until the final team locks. The globe reveals all correct locations only after every answer is locked.',
    },
    {
      title: 'Six fair rounds',
      text: 'Earn one point for each city in its exact position and two bonus points for a perfect five. Everyone presses Continue before the next shared challenge. After six rounds the highest score wins; ties share victory. Coordinates are approximate World Bank capital locations; reveal links let you check them. Practice bots make illustrative guesses, not expert geography predictions.',
    },
  ],
};
export function practice(
  kind: StandaloneId,
  seats: number,
  difficulty: AnyGame['difficulty'],
  step = 0,
  mode: 'teams' | 'individual' = 'individual',
): AnyGame {
  const g = standaloneGames[kind].create(seats, 4817, difficulty, mode);
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
