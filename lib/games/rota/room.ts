import type { RotaGame } from './engine.ts';

/** What a seated player receives from an online Rota room. */
export type RotaView = {
  token: string;
  /** Private ranked solo saves resume from the leaderboards. */
  rankedSolo?: boolean;
  /** The match as this viewer may see it: others' round in play is hidden. */
  game: RotaGame;
  viewerId: string;
  viewerSeat: number | null;
  ownerId: string;
  isOwner: boolean;
  seats: { name: string; bot: boolean; online: boolean; away: boolean }[];
};
