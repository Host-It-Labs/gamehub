import { readFileSync } from 'node:fs';

/**
 * What a cue's measured level depends on: the synthesiser, the shared
 * instruments, the output and room code, and the cue's own book file. Node
 * only (the level script and the tests); a change to any of them asks for
 * `node scripts/sound-levels.mjs` again.
 */
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');
const toolkit = ['synth.ts', 'kit.ts', 'cues.ts'].map(read).join('\n');

export function cueFingerprint(book: string, cue: string) {
  let h = 0x811c9dc5;
  for (const ch of `${toolkit}\n${read(`books/${book}.ts`)}\n${cue}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
