/**
 * Films the library's gameplay footage (lib/games/library-reels.ts): each game
 * plays itself in a headless Chrome against the dev server, with its interface
 * hidden, filmed once on a desktop screen (wide) and once on a phone (tall).
 *
 *   node scripts/reels/record.mjs <game> [wide|tall|both] [--base http://localhost:3017]
 *       [--seconds 10] [--slow 8] [--out public/reels] [--keep]
 *
 * Every clip is 60 fps, and each of its 60 frames a second is a different
 * picture of the game playing at its own speed.
 *
 * Each game is a driver in scripts/reels/games/<game>.mjs exporting
 *   css      – extra selectors to hide (the shared chrome is hidden already)
 *   prepare  – async (page) => gets into a running game
 *   drive    – async (page, running) => keeps it moving while running() is true
 *   warmup   – ms of game time to let it settle before filming (default 2500)
 *   seconds  – clip length (default 10)
 *   crf      – { wide, tall } x264 quality for a game whose art compresses
 *              poorly (default 23 both; higher is smaller; the 720p and 360p
 *              cuts follow it, see tiers.mjs)
 *   minFps   – for games that never stop moving: films a scene again (up to
 *              three takes, each slower) when fewer than this many different
 *              frames make up each second of the clip. 55 for a 3D game.
 *   slow     – films the game this many times slower than real time and
 *              closes the frame times back up, so the clip plays at the
 *              game's own speed (default 1, at most 24; `--slow` overrides).
 *              Chrome screencasts only 5–25 full-HD frames a real second of a
 *              busy WebGL canvas, so a 3D game needs about 8× for 60 different
 *              frames a game second (Arena: ~150 sent, 59–60 kept). The page's
 *              clocks (performance.now, Date.now, frame times, timers) and its
 *              CSS and Web Animations all run k× slower from before the
 *              warmup (STRETCH_TIME), so the game itself never notices.
 * The log line of each take gives the different frames a second of the clip
 * ("unique"), the longest a picture holds (in 60ths), the frames Chrome sent
 * per game second and the frames the page drew.
 * or, for a game that holds several games or boards, `scenes`: an array of
 * { css, wideCss, tallCss, prepare, drive, warmup, seconds }, each filmed in
 * a fresh browser and joined with a short crossfade (shared exports above
 * apply to every scene unless it sets its own; `--seconds` is per scene).
 * `cut: true` joins the scenes with hard cuts instead, for a reel of quick
 * shots (Diner).
 * Wide is the desktop layout (a 1280×720 CSS screen at 1.5×) and tall the phone
 * layout (390×693 CSS at 1080/390×), so both are filmed at full 1080p: 1920×1080
 * and 1080×1920. Chrome runs with that scale forced (the screencast otherwise
 * sends CSS-size frames) and sends quality-95 JPEG frames at full size,
 * written to disk as they come. Each of the clip's 60 slots a second takes
 * the newest frame by then, read by ffmpeg as an exact 60 fps sequence;
 * ffmpeg only resamples (lanczos) when a frame comes back a pixel off, then
 * encodes H.264 (high, limited-range yuv420p, preset slow, keyframe every
 * 2 s, +faststart).
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
  linkSync,
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
/** The clip's frame rate, and the most a take may slow the page down. */
const FPS = 60;
const MAX_SLOW = 24;
const slowFlag = flag('slow') === undefined ? undefined : Number(flag('slow'));
if (slowFlag !== undefined && !(slowFlag >= 1 && slowFlag <= MAX_SLOW)) {
  console.error(`--slow must be between 1 and ${MAX_SLOW}`);
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
 * the game plays k times slower from then on (warmup and filming). CSS and
 * Web Animations are slowed to the same rate in the page (see below).
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
  // CSS and Web Animations run on Chrome's own animation clock: every
  // animation is slowed by the same rate once per frame. (DevTools'
  // Animation.setPlaybackRate would slow them too, but it also slows the
  // frame times handed to requestAnimationFrame, and a game slowed twice
  // runs k² times slower.)
  const applied = new WeakMap();
  const sweep = () => {
    if (document.getAnimations)
      for (const a of document.getAnimations()) {
        const was = applied.get(a) ?? 1;
        if (was === rate) continue;
        a.playbackRate = (a.playbackRate / was) * rate;
        applied.set(a, rate);
      }
    realRaf(sweep);
  };
  realRaf(sweep);
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
  // The real clock, for drivers that check the game kept its own speed.
  window.__reelReal = realNow;
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
async function openPage(target, shape, scene, slow) {
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
      ${slow > 1 ? STRETCH_TIME : ''}
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

/**
 * Films `seconds` of game time. With `slow` above 1 the page's clock already
 * runs that many times slower, so it films that much longer in real time and
 * closes the frame times back up: the clip plays at the game's own speed.
 * Frames go to disk as they arrive. Each of the clip's FPS frames a second
 * shows the newest frame Chrome had sent by then; `unique` is how many
 * different frames that makes a second (a slot no new frame reached repeats
 * the one before, which is what looks choppy).
 */
async function film(page, seconds, file, slow = 1) {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-frames-'));
  const frames = [];
  const onFrame = (m) => {
    if (m.method !== 'Page.screencastFrame') return;
    // Chrome sends the next frame only once this one is acknowledged.
    page
      .send('Page.screencastFrameAck', { sessionId: m.params.sessionId })
      .catch(() => {});
    const name = join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(name, Buffer.from(m.params.data, 'base64'));
    frames.push({ t: m.params.metadata.timestamp, at: Date.now() / 1000, name });
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
  const span = frames.length > 1 ? frames.at(-1).t - frames[0].t : 0;
  const fps = span ? frames.length / span : 0;
  // The clip's frames: each of its FPS slots a second shows the newest frame
  // by the slot's middle (the last one holds to the end), linked in order so
  // ffmpeg reads them at exactly FPS. (Read as a concat list with
  // durations instead, every image's time is rounded to 1/25 s and no clip
  // could show more than 25 different frames a second.)
  const slots = Math.round(seconds * FPS);
  mkdirSync(join(dir, 'slots'));
  const shown = new Set();
  let at = 0;
  let hold = 0;
  let run = 0;
  for (let n = 0; n < slots && frames.length; n++) {
    const time = origin + (n + 0.5) / FPS;
    let moved = false;
    while (at + 1 < frames.length && frames[at + 1].t <= time) {
      at++;
      moved = true;
    }
    run = moved || n === 0 ? 1 : run + 1;
    hold = Math.max(hold, run);
    shown.add(at);
    linkSync(frames[at].name, join(dir, 'slots', `${String(n).padStart(5, '0')}.jpg`));
  }
  const unique = shown.size / seconds;
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
        frames[0].name,
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
    '-framerate',
    String(FPS),
    '-i',
    join(dir, 'slots', '%05d.jpg'),
    '-vf',
    `${scale}format=yuv420p`,
    ...x264(crfFor(page.shape)),
    `${file}.mp4`,
  ]);
  still(file);
  if (!keep) rmSync(dir, { recursive: true, force: true });
  else {
    writeFileSync(
      join(dir, 'times.json'),
      JSON.stringify({
        started,
        realStop,
        slow,
        frames: frames.map(({ t, at }) => ({ t, at })),
      }),
    );
    console.log(`  frames kept in ${dir}`);
  }
  return {
    frames: frames.length,
    fps,
    unique,
    hold,
    bytes: statSync(`${file}.mp4`).size,
    frame: `${frameW}×${frameH}`,
    pageFps: paints / seconds,
  };
}

/** x264 settings every clip shares: high profile, a keyframe every two
 * seconds, ready to stream (+faststart), silent. */
const x264 = (crf) => [
  '-c:v',
  'libx264',
  '-threads',
  '4',
  '-profile:v',
  'high',
  '-crf',
  crf,
  '-preset',
  'slow',
  '-g',
  String(FPS * 2),
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  '-an',
];

/** Writes a clip's full-size first-frame still beside it. */
function still(file) {
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
}

/** Seconds each scene fades into the next. */
const FADE = 0.5;

/** Joins scene clips with crossfades (or, with the driver's `cut`, hard
 * cuts) into one clip and its first-frame still. */
function joinScenes(parts, file, shape) {
  if (parts.length === 1) return;
  const chain = driver.cut
    ? `${parts.map((_, i) => `[${i}:v]`).join('')}concat=n=${parts.length}:v=1:a=0[out];`
    : crossfades(parts);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    ...parts.flatMap((part) => ['-i', part]),
    '-filter_complex',
    chain.slice(0, -1),
    '-map',
    '[out]',
    ...x264(crfFor(shape)),
    `${file}.mp4`,
  ]);
  still(file);
  for (const part of parts) {
    rmSync(part, { force: true });
    rmSync(part.replace(/\.mp4$/, '.jpg'), { force: true });
  }
}

/** The filter chain that fades each scene clip into the next. */
function crossfades(parts) {
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
  return chain;
}

const scenes = driver.scenes?.length
  ? driver.scenes.map((scene) => ({ ...driver, ...scene }))
  : [driver];

mkdirSync(out, { recursive: true });
/** Films one scene in a fresh Chrome; resolves with the take's numbers. */
async function take(shape, scene, index, part, slow) {
  const label = `${game}-${shape}${scenes.length > 1 ? ` scene ${index + 1}/${scenes.length}` : ''}`;
  const { chrome, profile, target } = await launch(shape);
  let running = true;
  try {
    const page = await openPage(target, shape, scene, slow);
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
    if (slow > 1) {
      await page.eval(`window.__reelSlow(${slow})`);
      page.slow = slow;
    }
    await sleep((scene.warmup ?? 2500) * slow);
    const result = await film(page, seconds ?? scene.seconds ?? 10, part, slow);
    running = false;
    await driving;
    page.close();
    console.log(
      `${label}: ${result.unique.toFixed(1)} of ${FPS} fps unique (longest hold ${result.hold} frames), ${result.frames} frames sent, ${result.fps.toFixed(0)} a game second${slow > 1 ? `, filmed ${slow}× slow` : ''} (page drew ${result.pageFps.toFixed(0)}), ${result.frame}, ${(result.bytes / 1024).toFixed(0)} KB`,
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

/** The slowdown for the next take after one showed `unique` different
 * frames a second against a `minFps` floor: enough to clear it with room,
 * at most twice the last, never above MAX_SLOW. */
const slower = (slow, unique, minFps) =>
  Math.min(
    MAX_SLOW,
    Math.max(
      slow + 1,
      Math.min(slow * 2, Math.ceil((slow * (minFps + 8)) / Math.max(1, unique))),
    ),
  );

for (const shape of shapes) {
  const file = join(out, `${game}-${shape}`);
  const parts = [];
  for (const [index, scene] of scenes.entries()) {
    const part = scenes.length > 1 ? `${file}-scene${index}` : file;
    let slow = slowFlag ?? scene.slow ?? 1;
    for (let attempt = 1; ; attempt++) {
      const result = await take(shape, scene, index, part, slow);
      // A continuously moving game filmed this choppily was starved by a
      // busy machine: film it again, slower, rather than keep a stuttering
      // clip.
      if (!(result.unique < (scene.minFps ?? 0))) break;
      if (attempt === ATTEMPTS || slow >= MAX_SLOW) {
        console.error(
          `  still below ${scene.minFps} unique fps after ${attempt} takes; keeping the last`,
        );
        break;
      }
      slow = slower(slow, result.unique, scene.minFps);
      console.log(
        `  below ${scene.minFps} unique fps; filming again ${slow}× slow`,
      );
    }
    parts.push(`${part}.mp4`);
  }
  joinScenes(parts, file, shape);
  if (parts.length > 1)
    console.log(
      `${game}-${shape}: ${parts.length} scenes, ${(statSync(`${file}.mp4`).size / 1024).toFixed(0)} KB`,
    );
  // The 720p and 360p cuts smaller screens and game cards play.
  cutTiers(out, game, shape, Number(crfFor(shape)));
}
process.exit(0);
