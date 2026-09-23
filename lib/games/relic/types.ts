import type { ActionResult, RelicGame, WorldId } from './engine.ts';
export type ExpeditionMember = { id: string; name: string; online: boolean };
export type ExpeditionView = {
  token: string;
  game: RelicGame;
  members: ExpeditionMember[];
  viewerId: string;
  serverNow: number;
  result?: ActionResult;
};
export type ExpeditionSummary = {
  token: string;
  name: string;
  world: WorldId;
  members: string[];
  finds: number;
  tickets?: number;
  layer: number;
  lastAt: number;
};
