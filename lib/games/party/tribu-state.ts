import type { PartyMode } from './groups.ts';
import type { TriviaState } from './trivia.ts';

/** What a set match (Know Me or Quiz) carries from one of its games to the
 * next. The field is called `tribu` on every game state for saved-game
 * compatibility with Tribu, the first set. */
export type TribuState = {
  /** Each seat's points from the games already played this match. */
  carry: number[];
  /** The team setup of the set's team game (Atlas), kept while the table
   * plays its other games. */
  mode: PartyMode;
  teams: number[];
  /** The table votes between rounds; otherwise the host picks. */
  votes?: true;
  /** Trivia's overarching match, independent of the current mini-game. */
  trivia?: TriviaState;
};
