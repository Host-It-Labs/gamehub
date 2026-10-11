import type { SoundBook } from './cues.ts';
import { alto } from './books/alto.ts';
import { arena } from './books/arena.ts';
import { impostor } from './books/impostor.ts';
import { knowMe } from './books/know-me.ts';
import { lucky } from './books/lucky.ts';
import { mora } from './books/mora.ts';
import { nox } from './books/nox.ts';
import { puzzles } from './books/puzzles.ts';
import { quiz } from './books/quiz.ts';
import { rota } from './books/rota.ts';
import { shared } from './books/shared.ts';
import { yata } from './books/yata.ts';

/** Every game's synthesised sounds, in library order. Diner keeps its own
 *  (`components/game/diner/sound.ts`). */
export const soundBooks: SoundBook[] = [
  shared,
  nox,
  mora,
  yata,
  knowMe,
  quiz,
  impostor,
  puzzles,
  lucky,
  rota,
  alto,
  arena,
];

/** Stable game ids (and the games inside Know Me and Quiz) to their book. */
const byGame: Record<string, SoundBook> = {
  undertow: nox,
  wildgrove: mora,
  midnight: yata,
  orin: knowMe,
  dial: knowMe,
  coins: knowMe,
  miro: quiz,
  size: quiz,
  year: quiz,
  order: quiz,
  impostor,
  folio: puzzles,
  relic: lucky,
  rota,
  alto,
  arena,
};
export const bookFor = (id: string): SoundBook | undefined => byGame[id];

/** When a game has no cue of a kind, the nearest one it has stands in. */
const STAND_INS: Record<string, string[]> = {
  tap: ['select', 'pickup'],
  pickup: ['select'],
  select: ['pickup'],
  drop: ['pickup', 'select'],
  move: ['place'],
  place: ['move'],
  submit: ['move', 'place'],
  reward: ['reveal'],
};

/** The cue a game plays for a kind of moment. Your turn is the same in
 *  every game; everything else is the game's own. */
export function cueFor(
  id: string,
  kind: string,
): { book: SoundBook; name: string } | undefined {
  if (kind === 'turn') return { book: shared, name: 'turn' };
  const book = byGame[id];
  if (!book || book.silent?.includes(kind)) return undefined;
  for (const k of [kind, ...(STAND_INS[kind] ?? [])]) {
    if (book.cues[`${id}:${k}`]) return { book, name: `${id}:${k}` };
    if (book.cues[k] && !k.includes(':')) return { book, name: k };
  }
  return undefined;
}
