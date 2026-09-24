import { play } from '../lib/games/standalone/registry.ts';

/** A set (Tribu, Sabi) opens with a vote between its games; tests that drive one game
 * directly vote everyone for it first. */
export function skipOpening(g, choice = g.kind, now = 1_000_000) {
  if (!g.vote?.opening) return g;
  for (let s = 0; s < g.seats.length; s++)
    g = play(g, { type: 'vote', choice }, s, now);
  return g;
}
