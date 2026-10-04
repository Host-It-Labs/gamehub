import { createAlto, type AltoGame } from '@/lib/games/alto/engine';
import type { AltoSetup } from './alto-box';

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** A fresh solo match from a setup; Learn marks it as practice. */
export function newAltoMatch(setup: AltoSetup, learn = false): AltoGame {
  const g = createAlto(setup.players, seed(), setup.difficulty, setup.options);
  if (learn) g.tutorial = true;
  return g;
}
