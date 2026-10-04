import type { Event, GameId } from './engine';
import { gameSound } from '../game-sound.ts';
export { audioContext } from '../audio-context.ts';

/** Each table uses its own quiet actions and universal turn/results cues, including callers without a game id. */
export function cue(kind: string, volume = 0.5, variant = 0, id = 'global') {
  gameSound(id, kind, volume, variant);
}

export function eventCue(event: Event, id: GameId, volume: number) {
  // Draft games already play the actor's private placement immediately. Their
  // resolution, bot placements, packet passes and auto-rolls must stay silent.
  // Nox alone exposes sequential plays by the other seats on the shared table.
  if (id !== 'undertow' || event.type !== 'play') return;
  cue('place', volume, event.kind ?? 0, id);
}
