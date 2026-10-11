/** The one on-screen cue every game shares: a soft glow round the edge of
 *  the screen when it becomes your turn. It shows with sound muted too. */
export const TURN_EVENT = 'gamehub:turn';

export function signalTurn() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TURN_EVENT));
}
