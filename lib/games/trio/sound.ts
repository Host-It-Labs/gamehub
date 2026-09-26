import type { Event, GameId } from './engine';
import { gameSound } from '../game-sound.ts';
export { audioContext } from '../audio-context.ts';

/** Every table uses the same quiet cues, including callers without a game id. */
export function cue(kind: string, volume = 0.5, variant = 0, id = 'global') {
  gameSound(id, kind, volume, variant);
}

export function eventCue(event: Event, id: GameId, volume: number) {
  // A resolved trick is table bookkeeping. Only the visible final scores play
  // the score cue, so neither of these events announces somebody else's win.
  if (event.type === 'trick' || event.type === 'finish') return;
  cue('place', volume, event.kind ?? 0, id);
}
