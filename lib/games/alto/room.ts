import type { AltoGame, AltoOptions, Difficulty } from './engine.ts';

/** What a seated player receives from an online Alto room. */
export type AltoView = {
  token: string;
  /** The match as this viewer may see it: nobody else's choice this turn. */
  game: AltoGame;
  viewerId: string;
  viewerSeat: number | null;
  ownerId: string;
  isOwner: boolean;
  seats: { name: string; bot: boolean; online: boolean; away: boolean }[];
};

/** What the table sends to open a room. */
export type AltoLaunch = {
  kind: 'alto';
  seats: number;
  difficulty: Difficulty;
  options: AltoOptions;
};
