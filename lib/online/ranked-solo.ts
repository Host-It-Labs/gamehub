import type { Difficulty, GameId, GameOptions } from '../games/trio/engine.ts';
import type { Extensions } from '../games/rota/engine.ts';
import type { MapId } from '../games/rota/maps.ts';
import { api, requestId } from './client.ts';

/** Ranked matches are created on the server; local saves never become scores. */
export type RankedSoloLaunch =
  | (GameOptions & {
      gameId: GameId;
      seats: number;
      difficulty: 'hard';
      fastMode: boolean;
      customerOrders: boolean;
      sanctuaryGoalsEnabled: boolean;
    })
  | {
      gameId: 'rota';
      seats: number;
      /** Hard with bots; alone there are no bots and any level is sent. */
      difficulty: Difficulty;
      map: MapId;
      ext: Extensions;
    };

/** `name` lets a first-time guest be known to the server without typing
 *  anything: the rated game silently opens a guest session under it. */
export type RankedSoloRequest = RankedSoloLaunch & { requestId: string; name?: string };

/** Keep an uncertain request's identity so retrying cannot abandon its match. */
export function rankedSoloRequest(choice: RankedSoloLaunch, previous?: RankedSoloRequest, name?: string): RankedSoloRequest {
  const extra = name ? { name } : {};
  if (previous) {
    const { requestId: previousId, name: _name, ...settings } = previous;
    if (JSON.stringify(settings) === JSON.stringify(choice))
      return { ...choice, ...extra, requestId: previousId };
  }
  return { ...choice, ...extra, requestId: requestId() };
}

/** Accept only a room in this application, even if a failed proxy returns a URL. */
export function rankedSoloPath(value: unknown, gameId: RankedSoloLaunch['gameId']): string {
  const prefix = gameId === 'rota' ? 'rota' : 'table';
  if (typeof value !== 'string' || !new RegExp(`^/${prefix}/[A-Za-z0-9_-]{8,80}$`).test(value))
    throw new Error('The rated game could not be opened. Please try again.');
  return value;
}

export async function launchRankedSolo(choice: RankedSoloRequest): Promise<string> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const { name, ...launch } = choice;
  try {
    const result = await Promise.race([
      // A first-time guest becomes known in a step of its own, so retrying a
      // launch whose answer was lost always comes from the same player.
      api('/api/guest', name ? { name } : {}).then(() => api<{ url: unknown }>('/api/solo/ranked', launch)),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('The connection is taking too long. Try again to reopen the same match.')), 15_000);
      }),
    ]);
    return rankedSoloPath(result?.url, choice.gameId);
  } finally {
    clearTimeout(timeout);
  }
}
