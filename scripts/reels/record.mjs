/**
 * Films the library's gameplay footage (lib/games/library-reels.ts): each game
 * plays itself in a headless Chrome against the dev server, with its interface
 * hidden, filmed once on a desktop screen (wide) and once on a phone (tall).
 *
 *   node scripts/reels/record.mjs <game> [wide|tall|both] [--base http://localhost:3017]
 *       [--seconds 10] [--slow 3] [--out public/reels] [--keep]
 *
 * Each game is a driver in scripts/reels/games/<game>.mjs exporting
 *   css      – extra selectors to hide (the shared chrome is hidden already)
 *   prepare  – async (page) => gets into a running game
 *   drive    – async (page, running) => keeps it moving while running() is true
 *   warmup   – ms to let it settle before filming (default 2500)
 *   seconds  – clip length (default 10)
 *   crf      – { wide, tall } x264 quality for a game whose art compresses
 *              poorly (default 23 both; higher is smaller)
 *   minFps   – films a scene again (up to three takes) when fewer frames
 *              than this arrive a second, for games that never stop moving
 *   slow     – films the game this many times slower than real time and
 *              speeds the footage back up (default 1; `--slow` overrides).
 *              WebGL games use it: Chrome only screencasts 5–15 full-HD
 *              frames a second of a busy canvas on a loaded Mac, so slowing
 *              the page's clock threefold still gives smooth 30 fps footage.
 * or, for a game that holds several games or boards, `scenes`: an array of
 * { css, wideCss, tallCss, prepare, drive, warmup, seconds }, each filmed in
 * a fresh browser and joined with a short crossfade (shared exports above
 * apply to every scene unless it sets its own; `--seconds` is per scene).
 * Wide is the desktop layout (a 1280×720 CSS screen at 1.5×) and tall the phone
 * layout (390×693 CSS at 1080/390×), so both are filmed at full 1080p: 1920×1080
 * and 1080×1920. Chrome runs with that scale forced (the screencast otherwise
 * sends CSS-size frames) and sends quality-95 JPEG frames at full size;
 * ffmpeg only resamples (lanczos) when a frame comes back a pixel off, then
 * encodes H.264 (high, limited-range yuv420p, preset slow, +faststart).
 * Needs the dev server (npm run dev), Chrome and ffmpeg. Writes
 * <out>/<game>-<shape>.mp4, a full-size first-frame .jpg still, and the
 * lighter 720p and 360p cuts (tiers.mjs).
 */
import { spawn, execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { cutTiers } from './tiers.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const game = args[0];
const shapes = { wide: ['wide'], tall: ['tall'], both: ['wide', 'tall'] }[
  args[1] && !args[1].startsWith('--') ? args[1] : 'both'
];
const base = flag('base', 'http://localhost:3017');
const seconds =
  flag('seconds') === undefined ? undefined : Number(flag('seconds'));
if (seconds !== undefined && !(seconds > 0 && seconds <= 60)) {
  console.error('--seconds must be between 0 and 60');
  process.exit(1);
}
const slowFlag = flag('slow') === undefined ? undefined : Number(flag('slow'));
if (slowFlag !== undefined && !(slowFlag >= 1 && slowFlag <= 8)) {
  console.error('--slow must be between 1 and 8');
  process.exit(1);
}
/** How long any one DevTools command may take before the take gives up. */
const COMMAND_MS = 60000;
const out = resolve(flag('out', 'public/reels'));
const keep = args.includes('--keep');
if (!game || !shapes) {
  console.error('usage: record.mjs <game> [wide|tall|both]');
  process.exit(1);
}
const driver = await import(`./games/${game}.mjs`);
const CHROME =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SIZES = {
  wide: {
    width: 1280,
    height: 720,
    scale: 1.5,
    mobile: false,
    encode: [1920, 1080],
  },
  tall: {
    width: 390,
    height: 693,
    scale: 1080 / 390,
    mobile: true,
    encode: [1080, 1920],
  },
};
/** Interface every game shares; drivers add their own. */
const SHARED_CSS = `
  nav.game-navigation, .game-menu, .rotate-to-portrait, .fullscreen-message,
  .notice.global-notice, vite-error-overlay, [data-vinext-dev-error-overlay],
  .copy-guard-toast { visibility: hidden !important; }
  * { cursor: none !important; caret-color: transparent !important; }
`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * Installed at document start when a scene films slowed down: the page's
 * clocks (performance.now, Date.now, animation-frame times) and timers run
 * through one rate that `window.__reelSlow(k)` changes without a jump, so
 * the game plays k times slower once filming begins. CSS and Web Animations
 * are slowed over DevTools (Animation.setPlaybackRate).
 */
const STRETCH_TIME = `(() => {
  const realNow = performance.now.bind(performance);
  const realDate = Date.now;
  const realTimeout = setTimeout, realClear = clearTimeout;
  const realRaf = requestAnimationFrame.bind(window);
  let rate = 1, realAt = realNow(), pageAt = realAt;
  const toPage = (real) => pageAt + (real - realAt) * rate;
  const dateOffset = realDate() - realNow();
  performance.now = () => toPage(realNow());
  Date.now = () => Math.round(dateOffset + toPage(realNow()));
  window.requestAnimationFrame = (cb) => realRaf((t) => cb(toPage(t)));
  window.setTimeout = (fn, ms = 0, ...rest) =>
    realTimeout(fn, Math.max(0, Number(ms) || 0) / rate, ...rest);
  const intervals = new Map();
  let nextInterval = 1e9;
  window.setInterval = (fn, ms = 0, ...rest) => {
    const id = nextInterval++;
    const tick = () => {
      intervals.set(id, realTimeout(() => {
        tick();
        typeof fn === 'function' ? fn(...rest) : (0, eval)(fn);
      }, Math.max(4, Number(ms) || 0) / rate));
    };
    tick();
    return id;
  };
  window.clearInterval = (id) => {
    if (intervals.has(id)) {
      realClear(intervals.get(id));
      intervals.delete(id);
    } else realClear(id);
  };
  window.__reelSlow = (k) => {
    const now = realNow();
    pageAt = toPage(now);
    realAt = now;
    rate = 1 / k;
  };
})();`;
/** The x264 quality for a shape: the driver's, or the shared default. */
const crfFor = (shape) => String(driver.crf?.[shape] ?? 23);
/** JPEG quality (2 is best) for the first-frame stills. */
const STILL_Q = '5';

function freePort() {
  return new Promise((done) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

async function launch(shape) {
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), 'gamehub-reel-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--enable-gpu',
      '--use-angle=metal',
      '--ignore-gpu-blocklist',
      // The screencast sends frames in screen DIPs, so an emulated
      // deviceScaleFactor alone still films at CSS size; forcing the
      // screen's own scale makes its frames full resolution.
      `--force-device-scale-factor=${SIZES[shape].scale}`,
      '--window-size=1280,1000',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--hide-scrollbars',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let targets;
  for (let i = 0; i < 100 && !targets; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch {
      await sleep(100);
    }
  }
  const target = targets.find((t) => t.type === 'page');
  return { chrome, profile, target };
}

/** A thin CDP page with the few helpers drivers need. */
async function openPage(target, shape, scene) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    ws.addEventListener('open', done);
    ws.addEventListener('error', () =>
      fail(new Error('DevTools did not connect')),
    );
    setTimeout(() => fail(new Error('DevTools did not connect')), 10000);
  });
  let id = 0;
  const pending = new Map();
  // If Chrome goes away, every waiting command fails instead of hanging.
  ws.addEventListener('close', () => {
    for (const settle of pending.values())
      settle({ error: { message: 'Chrome disconnected' } });
    pending.clear();
  });
  const listeners = new Set();
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) listeners.forEach((l) => l(m));
  });
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      const i = ++id;
      const timer = setTimeout(() => {
        pending.delete(i);
        fail(new Error(`${method}: no answer after ${COMMAND_MS / 1000} s`));
      }, COMMAND_MS);
      pending.set(i, (m) => {
        clearTimeout(timer);
        if (m.error) fail(new Error(`${method}: ${m.error.message}`));
        else done(m.result);
      });
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ id: i, method, params }));
      else pending.get(i)({ error: { message: 'Chrome disconnected' } });
    });
  const size = SIZES[shape];
  const page = {
    shape,
    width: size.width,
    height: size.height,
    base,
    send,
    /** How many times slower than real time the page runs (see `slow`). */
    slow: 1,
    on: (listener) => listeners.add(listener),
    off: (listener) => listeners.delete(listener),
    close: () => ws.close(),
    /** Waits in game time, so a slowed take keeps the driver's pacing. */
    sleep: (ms) => sleep(ms * page.slow),
    async goto(path) {
      await send('Page.navigate', { url: new URL(path, base).href });
      await sleep(400);
      await page.waitUntil('document.readyState === "complete"', 30000);
    },
    /** Evaluates an expression in the page (awaiting promises) and returns its value. */
    async eval(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description ??
            result.exceptionDetails.text,
        );
      return result.result.value;
    },
    /** Waits until an expression in the page is truthy. */
    async waitUntil(expression, timeout = 20000) {
      const end = Date.now() + timeout * page.slow;
      while (Date.now() < end) {
        if (await page.eval(expression).catch(() => false)) return;
        await sleep(150);
      }
      throw new Error(`timed out waiting for ${expression}`);
    },
    /** Waits for an element matching a CSS selector. */
    waitFor: (selector, timeout) =>
      page.waitUntil(
        `!!document.querySelector(${JSON.stringify(selector)})`,
        timeout,
      ),
    exists: (selector) =>
      page.eval(`!!document.querySelector(${JSON.stringify(selector)})`),
    /** A script click (no pointer); returns false if nothing matched. */
    click: (selector) =>
      page.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`,
      ),
    /** The middle of an element's box, in CSS pixels. */
    center: (selector) =>
      page.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, left: r.x, top: r.y }; })()`,
      ),
    /** A real press along a path of points: touch on phones, mouse on desktops. */
    async drag(points, stepMs = 16) {
      const [first, ...rest] = points;
      if (size.mobile) {
        const touch = (type, p) =>
          send('Input.dispatchTouchEvent', {
            type,
            touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y, id: 1 }],
          });
        await touch('touchStart', first);
        for (const p of rest) {
          await touch('touchMove', p);
          await page.sleep(stepMs);
        }
        await touch('touchEnd', points.at(-1));
      } else {
        const mouse = (type, p, buttons) =>
          send('Input.dispatchMouseEvent', {
            type,
            x: p.x,
            y: p.y,
            button: 'left',
            buttons,
            clickCount: 1,
          });
        await mouse('mouseMoved', first, 0);
        await mouse('mousePressed', first, 1);
        for (const p of rest) {
          await mouse('mouseMoved', p, 1);
          await page.sleep(stepMs);
        }
        await mouse('mouseReleased', points.at(-1), 0);
      }
    },
    tap: (x, y) =>
      page.drag([
        { x, y },
        { x, y },
      ]),
    async key(key, code = key, holdMs = 60) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await page.sleep(holdMs);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    },
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', {
    width: size.width,
    height: size.height,
    deviceScaleFactor: size.scale,
    mobile: size.mobile,
    screenWidth: size.width,
    screenHeight: size.height,
  });
  await send('Emulation.setTouchEmulationEnabled', {
    enabled: size.mobile,
    maxTouchPoints: size.mobile ? 5 : 1,
  });
  if (size.mobile)
    await send('Emulation.setEmitTouchEventsForMouse', {
      enabled: true,
      configuration: 'mobile',
    });
  const css = `${SHARED_CSS}\n${scene.css ?? ''}\n${scene[`${shape}Css`] ?? ''}`;
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      ${(slowFlag ?? scene.slow ?? 1) > 1 ? STRETCH_TIME : ''}
      Element.prototype.requestFullscreen = undefined;
      try { sessionStorage.setItem('gamehub.reel', '1'); } catch {}
      const addReelStyle = () => {
        const style = document.createElement('style');
        style.id = 'reel-style';
        style.textContent = ${JSON.stringify(css)};
        document.documentElement.append(style);
      };
      if (document.documentElement) addReelStyle();
      else document.addEventListener('DOMContentLoaded', addReelStyle);
    `,
  });
  return page;
}

/** Films `seconds` of game time; with `slow` above 1 the page's clock already
 * runs that many times slower, so it films that much longer in real time and
 * squeezes the frame times back. */
async function film(page, seconds, file, slow = 1) {
  const frames = [];
  const onFrame = (m) => {
    if (m.method !== 'Page.screencastFrame') return;
    frames.push({
      t: m.params.metadata.timestamp,
      at: Date.now() / 1000,
      data: m.params.data,
    });
    page
      .send('Page.screencastFrameAck', { sessionId: m.params.sessionId })
      .catch(() => {});
  };
  page.on(onFrame);
  const [outW, outH] = SIZES[page.shape].encode;
  // Counts the page's own animation frames, to tell a slow game from a slow
  // capture when a take stutters.
  await page
    .eval(
      `(() => { window.__reelPaints = 0; const tick = () => { window.__reelPaints++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`,
    )
    .catch(() => {});
  await page.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 95,
    maxWidth: outW,
    maxHeight: outH,
    everyNthFrame: 1,
  });
  const started = Date.now() / 1000;
  await sleep(seconds * slow * 1000);
  // Frames only arrive when the page changes, so the last one holds to the end.
  const realStop = Date.now() / 1000;
  await page.send('Page.stopScreencast');
  const paints = await page.eval('window.__reelPaints ?? 0').catch(() => 0);
  page.off(onFrame);
  // Chrome sometimes delivers two frames out of order; unsorted, the gaps
  // between them would add time and the clip would drift ahead.
  frames.sort((a, b) => a.t - b.t);
  // Back to game time: the first frame keeps its time, the rest close up.
  const origin = frames[0]?.t ?? started;
  for (const frame of frames) frame.t = origin + (frame.t - origin) / slow;
  const stopped = origin + (realStop - origin) / slow;
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-frames-'));
  let list = '';
  frames.forEach((frame, i) => {
    const name = join(dir, `${String(i).padStart(5, '0')}.jpg`);
    writeFileSync(name, Buffer.from(frame.data, 'base64'));
    const next = frames[i + 1]?.t ?? Math.max(stopped, frame.t + 1 / 30);
    list += `file '${name}'\nduration ${Math.max(0.001, next - frame.t).toFixed(4)}\n`;
  });
  // The concat reader ignores the last entry's duration unless the file is
  // listed once more, so the final hold would vanish.
  if (frames.length)
    list += `file '${join(dir, `${String(frames.length - 1).padStart(5, '0')}.jpg`)}'\n`;
  writeFileSync(join(dir, 'list.txt'), list);
  const span = frames.length > 1 ? frames.at(-1).t - frames[0].t : 0;
  const fps = span ? frames.length / span : 0;
  // The size Chrome actually sent, for the log.
  const [frameW, frameH] = frames.length
    ? execFileSync('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=p=0',
        join(dir, '00000.jpg'),
      ])
        .toString()
        .trim()
        .split(',')
        .map(Number)
    : [0, 0];
  // A frame Chrome sends at the clip's size is not resampled; only an odd
  // one (a pixel off) is. Every frame goes through the same filter so one
  // stray size cannot break the encode, and Chrome's full-range JPEG colour
  // becomes the standard (limited) range every player expects.
  const scale = `scale=${outW}:${outH}:flags=lanczos:out_range=tv,`;
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    join(dir, 'list.txt'),
    '-t',
    String(seconds),
    '-vf',
    `fps=30,${scale}format=yuv420p`,
    '-c:v',
    'libx264',
    '-threads',
    '4',
    '-profile:v',
    'high',
    '-crf',
    crfFor(page.shape),
    '-preset',
    'slow',
    '-g',
    '60',
    '-movflags',
    '+faststart',
    '-an',
    `${file}.mp4`,
  ]);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    `${file}.mp4`,
    '-frames:v',
    '1',
    '-q:v',
    STILL_Q,
    `${file}.jpg`,
  ]);
  if (!keep) rmSync(dir, { recursive: true, force: true });
  else {
    writeFileSync(
      join(dir, 'times.json'),
      JSON.stringify({ started, realStop, slow, frames: frames.map(({ t, at }) => ({ t, at })) }),
    );
    console.log(`  frames kept in ${dir}`);
  }
  return {
    frames: frames.length,
    fps,
    bytes: statSync(`${file}.mp4`).size,
    frame: `${frameW}×${frameH}`,
    pageFps: paints / (seconds * slow),
  };
}

/** Seconds each scene fades into the next. */
const FADE = 0.5;

/** Joins scene clips with crossfades into one clip and its first-frame still. */
function joinScenes(parts, file, shape) {
  if (parts.length === 1) return;
  const lengths = parts.map((part) =>
    Number(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        part,
      ]).toString(),
    ),
  );
  let chain = '';
  let offset = 0;
  let last = '0:v';
  for (let i = 1; i < parts.length; i++) {
    offset += lengths[i - 1] - FADE;
    const label = i === parts.length - 1 ? 'out' : `v${i}`;
    chain += `[${last}][${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[${label}];`;
    last = label;
  }
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    ...parts.flatMap((part) => ['-i', part]),
    '-filter_complex',
    chain.slice(0, -1),
    '-map',
    '[out]',
    '-c:v',
    'libx264',
    '-threads',
    '4',
    '-profile:v',
    'high',
    '-crf',
    crfFor(shape),
    '-preset',
    'slow',
    '-g',
    '60',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    `${file}.mp4`,
  ]);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    `${file}.mp4`,
    '-frames:v',
    '1',
    '-q:v',
    STILL_Q,
    `${file}.jpg`,
  ]);
  for (const part of parts) {
    rmSync(part, { force: true });
    rmSync(part.replace(/\.mp4$/, '.jpg'), { force: true });
  }
}

const scenes = driver.scenes?.length
  ? driver.scenes.map((scene) => ({ ...driver, ...scene }))
  : [driver];

mkdirSync(out, { recursive: true });
/** Films one scene in a fresh Chrome; resolves with the take's numbers. */
async function take(shape, scene, index, part) {
  const label = `${game}-${shape}${scenes.length > 1 ? ` scene ${index + 1}/${scenes.length}` : ''}`;
  const { chrome, profile, target } = await launch(shape);
  let running = true;
  try {
    const page = await openPage(target, shape, scene);
    try {
      await scene.prepare(page);
    } catch (error) {
      // Leave a picture of where it got stuck.
      const shot = await page.send('Page.captureScreenshot', {
        format: 'png',
      });
      writeFileSync(
        join(
          out,
          `${game}-${shape}${scenes.length > 1 ? `-scene${index}` : ''}-stuck.png`,
        ),
        Buffer.from(shot.data, 'base64'),
      );
      throw error;
    }
    const driving = scene
      .drive?.(page, () => running)
      .catch((error) => {
        console.error(`  drive stopped: ${error.message}`);
      });
    const slow = slowFlag ?? scene.slow ?? 1;
    if (slow > 1) {
      await page.eval(`window.__reelSlow(${slow})`);
      page.slow = slow;
      await page.send('Animation.enable');
      await page.send('Animation.setPlaybackRate', { playbackRate: 1 / slow });
    }
    await sleep((scene.warmup ?? 2500) * slow);
    const result = await film(page, seconds ?? scene.seconds ?? 10, part, slow);
    running = false;
    await driving;
    page.close();
    console.log(
      `${label}: ${result.frames} frames, ${result.fps.toFixed(1)} fps${slow > 1 ? ` (filmed ${slow}× slow)` : ''} (page ${result.pageFps.toFixed(0)}), ${result.frame} frames, ${(result.bytes / 1024).toFixed(0)} KB`,
    );
    return result;
  } finally {
    running = false;
    chrome.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

/** Takes per scene when one films below its driver's `minFps`. */
const ATTEMPTS = 3;

for (const shape of shapes) {
  const file = join(out, `${game}-${shape}`);
  const parts = [];
  for (const [index, scene] of scenes.entries()) {
    const part = scenes.length > 1 ? `${file}-scene${index}` : file;
    for (let attempt = 1; ; attempt++) {
      const result = await take(shape, scene, index, part);
      // A continuously moving game filmed this choppily was starved by a
      // busy machine: film it again rather than keep a stuttering clip.
      if (!(result.fps < (scene.minFps ?? 0))) break;
      if (attempt === ATTEMPTS) {
        console.error(
          `  still below ${scene.minFps} fps after ${ATTEMPTS} takes; keeping the last`,
        );
        break;
      }
      console.log(`  below ${scene.minFps} fps; filming again`);
    }
    parts.push(`${part}.mp4`);
  }
  joinScenes(parts, file, shape);
  if (parts.length > 1)
    console.log(
      `${game}-${shape}: ${parts.length} scenes, ${(statSync(`${file}.mp4`).size / 1024).toFixed(0)} KB`,
    );
  // The 720p and 360p cuts smaller screens and game cards play.
  cutTiers(out, game, shape);
}
process.exit(0);
