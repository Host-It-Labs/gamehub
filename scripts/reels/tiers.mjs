#!/usr/bin/env node
/**
 * Cuts the lighter versions of the library footage from the full-HD
 * masters `record.mjs` films: <game>-<shape>-720.mp4 (1280×720 or 720×1280)
 * and <game>-<shape>-360.mp4 (640×360 or 360×640). The library plays the
 * lightest cut that still covers the screen (`reelTier` in
 * lib/games/library-reels.ts), so phones, game cards and weak devices skip
 * the full file. Masters may be tagged full range (yuvj420p); every cut is
 * written as standard limited-range BT.709 so all clips show the same colour.
 * Cuts keep the master's 60 frames a second. A game whose driver compresses
 * its master harder (`crf` in scripts/reels/games/<game>.mjs, for busy art)
 * has its cuts compressed as hard: a cut's crf is its own or the master's
 * plus its `step`, whichever is higher, so a phone's 720p cut stays well
 * under the master's size.
 *
 *   node scripts/reels/tiers.mjs [game ...] [--dir public/reels]
 *
 * With no game it cuts every master in the folder. record.mjs runs it after
 * filming.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const TIERS = [
  { suffix: '720', long: 1280, short: 720, crf: 24, step: 0 },
  { suffix: '360', long: 640, short: 360, crf: 26, step: 2 },
];

/** The master's x264 crf for a game and shape: its driver's, or 23. */
export async function masterCrf(game, shape) {
  const driver = await import(`./games/${game}.mjs`).catch(() => ({}));
  return driver.crf?.[shape] ?? 23;
}

/** Writes both cuts of one master (`<dir>/<game>-<shape>.mp4`), filmed at
 * `crf`. */
export function cutTiers(dir, game, shape, crf = 23) {
  const master = join(dir, `${game}-${shape}.mp4`);
  for (const tier of TIERS) {
    const [w, h] =
      shape === 'tall' ? [tier.short, tier.long] : [tier.long, tier.short];
    const file = join(dir, `${game}-${shape}-${tier.suffix}.mp4`);
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      master,
      '-vf',
      `scale=${w}:${h}:flags=lanczos:in_range=auto:out_range=tv,format=yuv420p`,
      '-c:v',
      'libx264',
      '-threads',
      '4',
      '-profile:v',
      'high',
      '-crf',
      String(Math.max(tier.crf, crf + tier.step)),
      '-preset',
      'slow',
      '-g',
      '120',
      '-color_range',
      'tv',
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-movflags',
      '+faststart',
      '-an',
      file,
    ]);
    console.log(
      `${game}-${shape}-${tier.suffix}: ${(statSync(file).size / 1024).toFixed(0)} KB`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--dir');
  const dir = resolve(at >= 0 ? args[at + 1] : 'public/reels');
  const games = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--dir');
  for (const name of readdirSync(dir).sort()) {
    const m = name.match(/^(.+)-(wide|tall)\.mp4$/);
    if (!m || (games.length && !games.includes(m[1]))) continue;
    cutTiers(dir, m[1], m[2], await masterCrf(m[1], m[2]));
  }
}
