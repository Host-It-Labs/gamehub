#!/usr/bin/env node
// Loudness-match every synthesised cue (lib/games/sound): render each one
// offline in headless Chrome, measure its loudest 50 ms, and write the gain
// that brings it to the `loud` target its book gives into
// lib/games/sound/levels.json. Run it after adding or changing a cue, with
// the dev server up:
//
//   node scripts/sound-levels.mjs [http://localhost:3017] [--check]
//
// --check only reports cues more than 2.5 dB off their target (cues with
// random grains vary a little between renders) or peaking above -3 dBFS.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { soundBooks } from '../lib/games/sound/index.ts';
import { cueFingerprint } from '../lib/games/sound/fingerprint.ts';

const args = process.argv.slice(2);
const check = args.includes('--check');
const origin =
  args.find((a) => a.startsWith('http')) ?? 'http://localhost:3017';
const chrome =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 400);
const profile = await mkdtemp(join(tmpdir(), 'sound-levels-'));
const browser = spawn(
  chrome,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
// Known from the start, so closing works even if Chrome already died.
let running = true;
const gone = new Promise((resolve) =>
  browser.once('exit', () => {
    running = false;
    resolve();
  }),
);
browser.once('error', (error) =>
  fail(`could not start Chrome: ${error.message}`),
);
const deadline = setTimeout(
  () => fail('timed out after three minutes'),
  180_000,
);

async function close() {
  if (running) browser.kill();
  await Promise.race([gone, new Promise((r) => setTimeout(r, 5000))]);
  await rm(profile, { recursive: true, force: true, maxRetries: 5 });
}
let failing = false;
async function fail(message) {
  if (failing) return;
  failing = true;
  console.error(`sound-levels: ${message}`);
  clearTimeout(deadline);
  await close().catch(() => {});
  process.exit(1);
}

let target;
for (let i = 0; i < 50 && !target; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try {
    const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = pages.find((p) => p.type === 'page');
  } catch {
    /* Chrome is still starting. */
  }
}
if (!target) await fail('headless Chrome did not start');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) =>
  socket.addEventListener('open', resolve, { once: true }),
);
let next = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  pending.get(message.id)?.(message);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++next;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Page.navigate', { url: `${origin}/sound-lab` });
await new Promise((r) => setTimeout(r, 4000));
const measured = await send('Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const { soundBooks } = await import('/lib/games/sound/index.ts');
    const { measureCue } = await import('/lib/games/sound/cues.ts');
    const out = {};
    for (const book of soundBooks)
      for (const [name, cue] of Object.entries(book.cues)) {
        // Cues with random grains are measured three times and averaged.
        let power = 0, peak = -120, seconds = 0;
        for (let i = 0; i < 3; i++) {
          const m = await measureCue(book, name, ${check});
          power += 10 ** (m.loud / 10) / 3;
          peak = Math.max(peak, m.peak);
          seconds = Math.max(seconds, m.seconds);
        }
        out[book.id + ':' + name] = { loud: 10 * Math.log10(power), peak, seconds, target: cue.loud };
      }
    return out;
  })()`,
});
clearTimeout(deadline);
socket.close();
await close();
const result = measured.result?.result?.value;
if (!result) {
  console.error(
    JSON.stringify(measured.result?.exceptionDetails ?? measured, null, 2),
  );
  process.exit(1);
}

if (check) {
  let off = 0;
  for (const [key, m] of Object.entries(result)) {
    const miss = m.loud - m.target;
    if (Math.abs(miss) > 2.5 || m.peak > -3) {
      off++;
      console.log(
        `${key}: ${m.loud.toFixed(1)} dB (target ${m.target}), peak ${m.peak} dB`,
      );
    }
  }
  console.log(
    off
      ? `${off} cues off target`
      : `all ${Object.keys(result).length} cues within 2.5 dB of target`,
  );
  process.exit(off ? 1 : 0);
}

// Each gain carries a fingerprint of the code it was measured from; the
// tests flag a cue, an instrument or the synthesiser changed since.
const hashes = Object.fromEntries(
  soundBooks.flatMap((book) =>
    Object.keys(book.cues).map((name) => [
      `${book.id}:${name}`,
      cueFingerprint(book.id, name),
    ]),
  ),
);
const levels = {};
for (const [key, m] of Object.entries(result).sort(([a], [b]) =>
  a.localeCompare(b),
))
  levels[key] = {
    gain: Math.round(10 ** ((m.target - m.loud) / 20) * 1000) / 1000,
    hash: hashes[key],
  };
await writeFile(
  'lib/games/sound/levels.json',
  `${JSON.stringify(levels, null, 2)}\n`,
);
const peaks = Object.entries(result).map(([key, m]) => [
  key,
  m.peak + (m.target - m.loud),
]);
const hottest = peaks.sort((a, b) => b[1] - a[1])[0];
console.log(
  `wrote ${Object.keys(levels).length} levels; hottest levelled peak ${hottest[0]} at ${hottest[1].toFixed(1)} dBFS`,
);
