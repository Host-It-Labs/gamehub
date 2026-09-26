import { gameSound } from '../game-sound.ts';
import type { StandaloneId } from '../standalone/types';
/** Party families use the same quiet cues as the strategy games. */
export function adventureCue(id: StandaloneId, kind: string, volume: number) {
  gameSound(id, kind, volume);
}
