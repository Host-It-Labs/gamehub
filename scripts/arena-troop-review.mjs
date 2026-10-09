/**
 * Frame sheets of one Arena troop moving in the real renderer: headless
 * Chrome opens /arena/lab with a close camera on the troop, captures frames
 * at an even rate and lays them out in one JPEG with their times.
 *
 *   node scripts/arena-troop-review.mjs --id sumo [--figures /3d/arena/dev/sumo-v2.glb]
 *       [--mode walk|march|circle|attack|idle|deploy|battle] [--cam front|side|back|three|game|gameback]
 *       [--turn 0] [--zoom 1] [--seconds 3] [--frames 12] [--cols 4]
 *       [--size 480x600] [--status stun|slow|haste|taunt|rage|heal|push]
 *       [--settle 2] [--both] [--port 3017 (the app's /arena/lab instead)]
 *       [--eval "<js run once framed>"]
 *       --out work/arena/<...>/<name>.jpg
 *
 * Frames are evenly spaced in game time: the lab's clock is stopped
 * (`?manual`) and stepped at 60 Hz between shots, however busy the machine
 * is (`--realtime` films the free-running clock instead).
 * By default it uses the stand-alone Arena lab (scripts/arena-lab, port
 * 3027, started here if it isn't running), which only loads the Arena, so
 * another game's half-finished edit can't break a review; `--port` uses a
 * full Gamehub dev server's /arena/lab instead. Needs Chrome. `--both`
 * also lines up the enemy copy (the troop's target in attack mode); the
 * camera follows the near one. Each run uses a private Chrome profile per
 * troop id so the Arena download is cached between runs.
 */
import { spawn } from 'node:child_process';
import {
  mkdirSync,
  rmSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import sharp from 'sharp';

const args = process.argv.slice(2);
if (args.includes('--help') || !args.includes('--id')) {
  console.log(
    (await import('node:fs'))
      .readFileSync(new URL(import.meta.url))
      .toString()
      .split('*/')[0],
  );
  process.exit(args.includes('--help') ? 0 : 1);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const id = flag('id');
const mode = flag('mode', 'walk');
const cam = flag('cam', 'three');
const seconds = Number(flag('seconds', 3));
const frames = Math.max(1, Math.min(48, Number(flag('frames', 12))));
const cols = Math.max(1, Number(flag('cols', 4)));
const [width, height] = flag('size', '480x600').split('x').map(Number);
const settle = Number(flag('settle', 2));
const port = flag('port') ? Number(flag('port')) : null;
const out = resolve(flag('out', `work/arena/review/${id}-${mode}-${cam}.jpg`));
const realtime = args.includes('--realtime');
const query = new URLSearchParams({ only: id, cam, mode });
if (!realtime) query.set('manual', '');
if (!args.includes('--both')) query.set('single', '');
for (const name of ['figures', 'zoom', 'turn', 'status'])
  if (flag(name)) query.set(name, flag(name));
const search = query.toString().replace(/(single|manual)=(&|$)/g, '$1$2');
let url = `http://localhost:${port}/arena/lab?${search}`;
if (!port) {
  url = `http://127.0.0.1:3027/?${search}`;
  const { execFileSync } = await import('node:child_process');
  execFileSync(
    process.execPath,
    [new URL('./arena-lab/serve.mjs', import.meta.url).pathname],
    { stdio: 'ignore' },
  );
}

const CHROME =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () =>
  new Promise((done) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });

// Cached profiles per troop (the Arena download stays in Cache Storage),
// one per concurrent run: each slot is taken with an atomic lock file that
// names its process, and a dead owner's slot is reused.
let profile;
let lock;
for (let slot = 0; slot < 6 && !profile; slot++) {
  const dir = join(tmpdir(), `arena-review-${id}-${slot}`);
  const file = `${dir}.lock`;
  try {
    writeFileSync(file, String(process.pid), { flag: 'wx' });
  } catch {
    const owner = Number(readFileSync(file, 'utf8'));
    let alive = false;
    try {
      process.kill(owner, 0);
      alive = true;
    } catch {}
    if (alive) continue;
    writeFileSync(file, String(process.pid));
  }
  profile = dir;
  lock = file;
}
let fresh = false;
if (!profile) {
  profile = mkdtempSync(join(tmpdir(), `arena-review-${id}-`));
  fresh = true;
}
const debug = await freePort();
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--enable-gpu',
    '--use-angle=metal',
    '--ignore-gpu-blocklist',
    `--remote-debugging-port=${debug}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    '--hide-scrollbars',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const done = (code) => {
  if (typeof problems !== 'undefined' && problems.size)
    console.error(`Page errors:\n  ${[...problems].slice(0, 6).join('\n  ')}`);
  chrome.kill('SIGKILL');
  if (fresh) rmSync(profile, { recursive: true, force: true });
  if (lock) rmSync(lock, { force: true });
  process.exit(code);
};
// Never hang: the whole run gives up after two minutes plus the capture.
setTimeout(
  () => {
    console.error('Timed out');
    done(2);
  },
  (120 + seconds + settle) * 1000,
).unref();

let targets;
for (let i = 0; i < 100 && !targets; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${debug}/json`)).json();
  } catch {
    await sleep(100);
  }
}
const target = targets?.find((t) => t.type === 'page');
if (!target) {
  console.error('Chrome did not start');
  done(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, fail) => {
  ws.addEventListener('open', ok);
  ws.addEventListener('error', () => fail(new Error('DevTools')));
});
let seq = 0;
const pending = new Map();
const problems = new Set();
ws.addEventListener('message', (event) => {
  const m = JSON.parse(event.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    problems.add(d.exception?.description?.split('\n').slice(0, 3).join(' | ') ?? d.text);
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    problems.add(
      m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300),
    );
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((ok, fail) => {
    const n = ++seq;
    pending.set(n, (m) =>
      m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result),
    );
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true }))?.result
    ?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url });
let ready = false;
for (let i = 0; i < 1200 && !ready; i++) {
  await sleep(100);
  ready = await evaluate('window.arenaLabReady === true').catch(() => false);
}
if (!ready) {
  console.error(`The lab never framed ${id} (${url})`);
  done(1);
}
if (flag('eval')) await evaluate(flag('eval'));
const errors = await evaluate(
  "document.querySelector('vite-error-overlay') ? 'vite error overlay' : ''",
);
if (errors) console.error(errors);
const shots = [];
const gap = seconds / Math.max(1, frames - 1);
const capture = async (at) => {
  const { data } = await send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 88,
  });
  shots.push({ at, image: Buffer.from(data, 'base64') });
};
if (realtime) {
  await sleep(settle * 1000);
  const start = Date.now();
  for (let i = 0; i < frames; i++) {
    const due = start + i * gap * 1000;
    if (frames > 1) await sleep(Math.max(0, due - Date.now()));
    await capture((Date.now() - start) / 1000);
  }
} else {
  await evaluate(`window.arenaLabAdvance(${settle})`);
  for (let i = 0; i < frames; i++) {
    if (i > 0) await evaluate(`window.arenaLabAdvance(${gap})`);
    await sleep(60);
    await capture(i * gap);
  }
}

const rows = Math.ceil(shots.length / cols);
const label = (text) =>
  Buffer.from(
    `<svg width="${width}" height="28"><rect width="100%" height="28" fill="rgba(0,0,0,.55)"/><text x="8" y="19" font-family="Helvetica" font-size="15" fill="#fff">${text}</text></svg>`,
  );
const tiles = [];
for (const [i, shot] of shots.entries()) {
  const left = (i % cols) * width;
  const top = Math.floor(i / cols) * height;
  tiles.push({ input: shot.image, left, top });
  tiles.push({
    input: label(`${id} ${mode} ${cam}  t=${shot.at.toFixed(2)}s`),
    left,
    top,
  });
}
mkdirSync(dirname(out), { recursive: true });
await sharp({
  create: {
    width: width * Math.min(cols, shots.length),
    height: height * rows,
    channels: 3,
    background: '#000',
  },
})
  .composite(tiles)
  .jpeg({ quality: 82 })
  .toFile(out);
console.log(`${out} (${shots.length} frames over ${seconds}s)`);
done(0);
