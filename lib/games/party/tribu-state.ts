import type { PartyMode } from './groups.ts';

/** What a set match (Tribu or Sabi) carries from one of its games to the
 * next. The field is called `tribu` on every game state for saved-game
 * compatibility with Tribu, the first set. */
export type TribuState = {
  /** Each seat's points from the games already played this match. */
  carry: number[];
  /** The team setup of the set's team game (Top Five, Atlas), kept while
   * the table plays its individual game (Dial, Sizes). */
  mode: PartyMode;
  teams: number[];
};
