import type { Difficulty, Extensions, MetroGame } from './engine.ts';
import type { MapId } from './map.ts';

/** What a seated player receives from an online Metro room. */
export type MetroView = {
  token: string;
  /** The match as this viewer may see it: others' turn in play is hidden,
   *  and so is the order of the cards to come. */
  game: MetroGame;
  viewerId: string;
  viewerSeat: number | null;
  ownerId: string;
  isOwner: boolean;
  seats: { name: string; bot: boolean; online: boolean; away: boolean }[];
};

/** What a table sends to open an online Metro room. */
export type MetroLaunch = {
  kind: 'metro';
  map: MapId;
  ext: Extensions;
  difficulty: Difficulty;
  seats: number;
};
