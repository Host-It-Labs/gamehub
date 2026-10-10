/**
 * Lucky: quick cuts of tickets being won, then the factory and the upgrade
 * tree, at the game's own speed and 60 different frames a second.
 *
 * Every shot is its own scene (a fresh page on a fresh development
 * workshop desk: every book open at a high level, a busy sixteen-by-nine
 * factory, most upgrades bought) joined with hard cuts (`cut`):
 *
 *   1–5  tickets: Lucky Seven, Twins, Garden, Gold Mine and Sea Chart, each
 *        bought and scratched most of the way through the real commands
 *        before the shot (the page loads with it in hand), then finished
 *        on camera with real pointer strokes (touch on the phone) on the
 *        perfect line, so every one ends in a jackpot paying out;
 *   6    the factory, on the game's own 3D camera, close on a working line
 *        and pulling back to the whole floor;
 *   7    the upgrade tree, the camera gliding across the paths to the Sun &
 *        Moon book, whose prize upgrade is bought and opens its helper.
 *
 * The tickets are the server's own (random) tickets: each scene plans its
 * strokes from the ticket it was dealt (`plan` below, using the books'
 * rules in the page), so every take shows the same kind of finish. The
 * camera is a page transform for the tickets and the tree and the
 * factory's own camera for the floor, each moved on the page clock, so it
 * glides at 60 fps and keeps the game's speed.
 *
 * `LUCKY_SHOTS=seven,factory node scripts/reels/record.mjs relic` films
 * only the named shots (for trying one out).
 */

/** Interface hidden in every shot: the top bar (tabs, purse, notes), the
 * shelf, the ticket's guide and badges, the hearts and Buy, errors. */
export const css = `
  header.rs-top, .rs-shelf, .rs-guide, .rs-guide-toggle, .rs-level-badge,
  .rs-star-badge, .rs-lives, .rs-rail-buy, .scratch-error, .rs-toasts,
  .rs-payout-xp, .rs-net, .scratch-modal-backdrop, .table-manager,
  .rf-dock-area, .rs-camera-tools { display: none !important; }
  .relic-scratch-room { --top-bar: 0px !important; --tab-bar: 0px !important; }
`;
/** Desktop: the ticket and its payout side by side in the middle. */
export const wideCss = `
  .rs-desk { grid-template-columns: minmax(0, 1fr) !important; gap: 0 !important; }
  .rs-hand { grid-column: 1 !important; --rail: 210px !important; }
`;
/** Phone: the ticket fills the screen, the payout beneath it. */
export const tallCss = `
  .rs-desk { grid-template-rows: minmax(0, 1fr) !important; gap: 0 !important; }
  .rs-hand { grid-row: 1 !important; }
  /* A wide ticket (Sea Chart) keeps its payout right beneath it. */
  .rs-hand-ticket { height: min(100cqh - 74px, 100cqw / var(--aspect)) !important; }
  .rs-hand-rail { flex-basis: 74px !important; justify-content: center; }
  .rs-hand-rail > .rs-rail-status { flex: 0 1 78% !important; }
  .rs-path-tabs { display: none !important; }
`;
/** Game milliseconds each shot plays before filming. */
export const warmup = 600;
/** Filmed 8× slow: the factory is a busy canvas, the tickets full-HD
 * pictures that change every frame while scratched (see record.mjs). */
export const slow = 8;
/** It is moving in every shot, so a take short of 55 new frames a second
 * is filmed again, slower. */
export const minFps = 55;
/** Painted tickets and a detailed floor in every frame. */
export const crf = { wide: 26, tall: 26 };
/** Shots joined with hard cuts. */
export const cut = true;

/** The same foil dust, people and sparks in every take. */
const SEEDED = `(() => {
  let a = 0x1ac4e7d3;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

/**
 * The page's own requests, for the reel: once `__reelOffline` is set the
 * desk stops polling the server (the factory then runs on the browser's own
 * deterministic step, which a slowed page would otherwise see jump back),
 * and a staged upgrade tree (`gamehub.reel.stage`) is laid over every desk
 * the server sends, keeping what is bought on camera.
 */
const NETWORK = `(() => {
  const real = window.fetch.bind(window);
  const stage = (() => {
    try { return JSON.parse(localStorage.getItem('gamehub.reel.stage') || 'null'); } catch { return null; }
  })();
  let base = null;
  const restage = (view) => {
    const s = view?.game?.scratch;
    if (!s?.upgrades) return view;
    base ??= { ...s.upgrades };
    for (const [id, rank] of Object.entries(stage.upgrades))
      s.upgrades[id] = rank + Math.max(0, (s.upgrades[id] ?? 0) - (base[id] ?? 0));
    if (stage.coins !== undefined) view.game.coins = stage.coins;
    return view;
  };
  window.fetch = async (input, init = {}) => {
    const url = String(input?.url ?? input);
    const desk = /\\/api\\/expeditions\\/[^/?]+(\\/commands|\\/activity|\\/presence)?$/.exec(url);
    if (desk && window.__reelOffline && desk[1] !== '/commands')
      return new Promise(() => {});
    const response = await real(input, init);
    if (!desk || !stage || !response.ok || desk[1] === '/presence')
      return response;
    const view = restage(await response.clone().json());
    return new Response(JSON.stringify(view), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
})();`;

/**
 * The camera for a page view: the whole room is scaled about a point, on
 * the page clock. `__reelCam` keys are [clip second, scale, x, y] with x and
 * y the point (a share of the screen) brought to the middle of the screen,
 * eased between keys and never past the room's edge.
 */
const PAGE_CAMERA = `(() => {
  const room = document.querySelector('.relic-scratch-room');
  const ease = (k) => k * k * (3 - 2 * k);
  const lerp = (a, b, k) => a + (b - a) * k;
  const pose = (t) => {
    const keys = window.__reelCam;
    if (t <= keys[0][0]) return keys[0];
    for (let i = 1; i < keys.length; i++)
      if (t <= keys[i][0]) {
        const [a, b] = [keys[i - 1], keys[i]];
        const k = ease((t - a[0]) / (b[0] - a[0]));
        return [t, lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
      }
    return keys.at(-1);
  };
  const W = innerWidth, H = innerHeight;
  const aim = (now) => {
    const t = window.__reelT0 === undefined ? 0 : (now - window.__reelT0) / 1000;
    const [, s, x, y] = pose(t);
    const tx = Math.min(0, Math.max(W - W * s, W / 2 - s * x * W));
    const ty = Math.min(0, Math.max(H - H * s, H / 2 - s * y * H));
    room.style.transformOrigin = '0 0';
    room.style.transform = 'translate(' + tx.toFixed(2) + 'px, ' + ty.toFixed(2) + 'px) scale(' + s.toFixed(4) + ')';
    requestAnimationFrame(aim);
  };
  aim(performance.now());
})()`;

/**
 * Lucky's rules in the page, and the commands a player sends: buying a
 * ticket and scratching seals, as the desk does. `plan` splits a ticket's
 * perfect line into what is scratched before the shot and what on camera.
 */
const KIT = `(async () => {
  const B = await import('/lib/games/relic/books.ts');
  const token = window.__reelToken;
  const id = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  const command = (action) =>
    fetch('/api/expeditions/' + token + '/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id(), action }),
    }).then(async (r) => {
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      return v;
    });
  const hand = async () => {
    const v = await fetch('/api/expeditions/' + token).then((r) => r.json());
    return v.game.scratch.hands[v.viewerId];
  };
  const hidden = (t) => t.cells.flatMap((c, i) => (c.revealed || B.sealLocked(t, i) ? [] : [i]));
  const x = (t, i) => i % t.cols, y = (t, i) => Math.floor(i / t.cols);
  /** The seals a player who reads the whole ticket scratches, in order. */
  const perfect = (ticket) => {
    const t = structuredClone(ticket), line = [];
    const mechanic = B.bookFor(t.pack).mechanic;
    for (let guard = 0; !t.ended && guard < 200; guard++) {
      const open = hidden(t);
      if (!open.length) break;
      let i;
      if (mechanic === 'seven') i = open.find((j) => t.cells[j].face === 'seven');
      else if (mechanic === 'ladder') {
        const row = B.ladderRow(t) * t.cols;
        i = t.cells[row].n > t.last ? row : row + 2;
      } else if (mechanic === 'mine') {
        const safe = open.filter((j) => t.cells[j].face !== 'dynamite');
        i = safe.find((j) => B.neighbours(t.cols, t.rows, j, true).some((k) => t.cells[k].revealed && t.cells[k].face !== 'dynamite')) ?? safe[0];
      } else if (mechanic === 'chart') i = open.find((j) => t.cells[j].face === 'ship');
      else i = B.suggest(t, Math.random);
      if (i === undefined) break;
      B.openSeal(t, i);
      line.push(i);
    }
    return line;
  };
  /** Before the shot and on camera: { pre: [seal], acts: [[seal, …]] }; an
   * act of several seals is one stroke through them. Null when the ticket
   * cannot give the shot its finish. */
  const plan = (t) => {
    const mechanic = B.bookFor(t.pack).mechanic;
    const line = perfect(t);
    if (mechanic === 'seven') {
      // The last 7 left, and a miss two seals from it whose arrow points
      // at it; another miss was scratched before.
      const last = line.at(-1);
      const misses = hidden(t).filter((i) => t.cells[i].face !== 'seven');
      const d = (i) => Math.max(Math.abs(x(t, i) - x(t, last)), Math.abs(y(t, i) - y(t, last)));
      const near = misses.filter((i) => d(i) === 2)[0];
      if (near === undefined) return null;
      const far = misses.filter((i) => i !== near && d(i) >= 3).slice(0, 1);
      return { pre: [...far, ...line.slice(0, -1)], acts: [[near], [last]] };
    }
    if (mechanic === 'mine') {
      // A gem, then the biggest patch of empty ground opens in one dig.
      const zero = (i) => t.cells[i].face !== 'dynamite' && t.cells[i].n === 0;
      const flood = (start) => {
        const seen = new Set([start]), stack = [start];
        while (stack.length) {
          const at = stack.pop();
          if (!zero(at)) continue;
          for (const j of B.neighbours(t.cols, t.rows, at, true))
            if (!seen.has(j) && !t.cells[j].revealed && t.cells[j].face !== 'dynamite') {
              seen.add(j);
              stack.push(j);
            }
        }
        return seen;
      };
      const best = hidden(t).filter(zero).map(flood).sort((a, b) => b.size - a.size)[0];
      if (!best || best.size < 5) return null;
      const dig = [...best].find(zero);
      const rest = line.filter((i) => !best.has(i) && !zero(i));
      if (!rest.length) return null;
      return { pre: line.filter((i) => !best.has(i) && i !== rest.at(-1)), acts: [[rest.at(-1)], [dig]] };
    }
    if (mechanic === 'path') return { pre: line.slice(0, -6), acts: [line.slice(-6)] };
    if (mechanic === 'chart') {
      // The last ship sunk on camera, one part after another.
      const ship = t.ships.find((s) => s.length === 3 && s.every((i) => !t.cells[i].revealed));
      if (!ship) return null;
      return { pre: line.filter((i) => !ship.includes(i)), acts: ship.map((i) => [i]) };
    }
    const k = mechanic === 'twins' ? 4 : 3;
    return { pre: line.slice(0, -k), acts: line.slice(-k).map((i) => [i]) };
  };
  /** Scratches seals through the server, each a short dab at its middle. */
  const dab = async (cells) => {
    if (!cells.length) return;
    const t = await hand();
    const points = [], breaks = [];
    for (const i of cells) {
      const cx = (x(t, i) + 0.5) / t.cols, cy = (y(t, i) + 0.5) / t.rows;
      if (points.length) breaks.push(points.length);
      for (const [dx, dy] of [[0, 0], [0.004, 0], [0, 0.004], [-0.004, 0], [0, -0.004]])
        points.push({ x: +(cx + dx).toFixed(4), y: +(cy + dy).toFixed(4) });
    }
    await command({ type: 'scratch-stroke', ticket: t.id, sequence: t.sequence, points, breaks });
  };
  window.__lucky = { B, command, hand, plan, dab, perfect };
})()`;

/** A fresh workshop desk, set to open on one tab; returns its token. */
async function openDesk(page, { tab, book, level, stage }) {
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: SEEDED });
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: NETWORK,
  });
  await page.goto("/");
  return page.eval(`fetch('/api/expeditions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rec', title: 'Rec', world: 'dunes', devPreset: 'workshop' }),
  }).then((r) => r.json()).then((v) => {
    window.__reelToken = v.token;
    localStorage.setItem('gamehub-relic-tab', ${JSON.stringify(tab)});
    localStorage.setItem('gamehub-relic-muted', 'true');
    ${book ? `localStorage.setItem('gamehub-lucky-book', ${JSON.stringify(JSON.stringify(book))});` : ""}
    ${book ? `localStorage.setItem('gamehub-lucky-levels', ${JSON.stringify(JSON.stringify({ [book]: level }))});` : ""}
    ${stage ? `localStorage.setItem('gamehub.reel.stage', ${JSON.stringify(JSON.stringify(stage))});` : ""}
    return v.token;
  })`);
}

/** Opens the desk and, once it is drawn with its art and fonts, gives the
 * page the reel's kit again. */
async function enterDesk(page, token, selector) {
  await page.goto(`/expedition/${token}`);
  await page.waitFor(selector, 60000);
  await page.waitUntil(
    `[...document.images].every((i) => i.complete) && document.fonts.status === 'loaded'`,
    30000,
  );
  await page.eval(`window.__reelToken = ${JSON.stringify(token)}`);
  await page.eval(KIT);
  await page.sleep(400);
}

/** Waits for the take to slow the page (it does so just after `drive`
 * starts), then starts the clip's clock: filming begins `warmup` later. */
async function startClock(page) {
  for (let i = 0; i < 300 && slow > 1 && page.slow === 1; i++)
    await new Promise((r) => setTimeout(r, 10));
  await page.eval(`window.__reelT0 = performance.now() + ${warmup}`);
}

const clock = (page) =>
  page.eval("(performance.now() - window.__reelT0) / 1000");

/** Waits until the clip's clock reads `at` seconds. */
async function until(page, at) {
  const now = await clock(page);
  if (at > now) await page.sleep((at - now) * 1000);
}

/** A stroke over seals in CSS pixels: a short circle on one seal, or one
 * line through several (a Garden path). The desk's coin is wide (Bigger
 * coin), so the circle stays well inside its seal. */
function stroke(box, t, cells, radius) {
  const cw = 1 / t.cols,
    ch = 1 / t.rows;
  const at = (i) => ({
    x: ((i % t.cols) + 0.5) * cw,
    y: (Math.floor(i / t.cols) + 0.5) * ch,
  });
  const px = (p) => ({ x: box.x + p.x * box.w, y: box.y + p.y * box.h });
  const points = [];
  if (cells.length === 1) {
    const c = at(cells[0]);
    const ax = Math.max(0, Math.min(0.22 * cw, 0.6 * cw - radius));
    const ay = Math.max(0, Math.min(0.22 * ch, 0.6 * ch - radius));
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * Math.PI * 2.2 - Math.PI / 2;
      const s = 0.45 + 0.55 * Math.sin((k / 10) * Math.PI);
      points.push(
        px({ x: c.x + Math.cos(a) * ax * s, y: c.y + Math.sin(a) * ay * s }),
      );
    }
  } else
    for (let n = 0; n < cells.length - 1; n++) {
      const [a, b] = [at(cells[n]), at(cells[n + 1])];
      for (let k = 0; k < 4; k++)
        points.push(
          px({
            x: a.x + ((b.x - a.x) * k) / 4,
            y: a.y + ((b.y - a.y) * k) / 4,
          }),
        );
      if (n === cells.length - 2) points.push(px(b));
    }
  return points;
}

/**
 * The ticket shots. `book` and `level` (0 for I) pick the ticket; `times`
 * are when each act of the plan starts (clip seconds); `wide` and `tall`
 * are the camera keys [clip s, scale, framing]: `p` centres the scratch
 * panel, `g` the ticket and its payout together.
 */
const TICKETS = [
  {
    // A miss whose arrow points at the last 7, then the 7: the rest of
    // the ticket scratches itself and the jackpot pays.
    name: "seven",
    book: "seven",
    level: 1,
    seconds: 1.9,
    times: [0.1, 0.5],
    wide: [
      [0, 1.3, "p"],
      [0.7, 1.24, "p"],
      [1.9, 1.04, "g"],
    ],
    tall: [
      [0, 1.16, "p"],
      [0.7, 1.12, "p"],
      [1.9, 1, "g"],
    ],
  },
  {
    // Two pairs of twins matched, the last one paying.
    name: "twins",
    book: "twins",
    level: 2,
    seconds: 1.7,
    times: [0.05, 0.3, 0.6, 0.85],
    wide: [
      [0, 1.36, "p"],
      [1.0, 1.28, "p"],
      [1.7, 1.12, "g"],
    ],
    tall: [
      [0, 1.2, "p"],
      [1.0, 1.15, "p"],
      [1.7, 1.04, "g"],
    ],
  },
  {
    // The Garden path drawn through its last six seals in one stroke.
    name: "garden",
    book: "path",
    level: 2,
    seconds: 1.8,
    times: [0.08],
    wide: [
      [0, 1.42, "p"],
      [0.85, 1.32, "p"],
      [1.8, 1.12, "g"],
    ],
    tall: [
      [0, 1.22, "p"],
      [0.85, 1.16, "p"],
      [1.8, 1.04, "g"],
    ],
  },
  {
    // A gem, then one dig that opens a whole patch of empty ground.
    name: "mine",
    book: "mine",
    level: 2,
    seconds: 1.8,
    times: [0.1, 0.55],
    wide: [
      [0, 1.34, "p"],
      [0.9, 1.26, "p"],
      [1.8, 1.08, "g"],
    ],
    tall: [
      [0, 1.18, "p"],
      [0.9, 1.14, "p"],
      [1.8, 1.02, "g"],
    ],
  },
  {
    // The last ship found part by part and sunk.
    name: "chart",
    book: "chart",
    level: 1,
    seconds: 1.8,
    times: [0.08, 0.36, 0.64],
    wide: [
      [0, 1.3, "p"],
      [1.0, 1.22, "p"],
      [1.8, 1.06, "g"],
    ],
    // A wide chart on an upright phone: close on the sea, the payout last.
    tall: [
      [0, 1.9, "p"],
      [1.0, 1.72, "p"],
      [1.8, 1.22, "g"],
    ],
  },
];

/** The ticket in hand and what is left to scratch on camera. */
let plan = null;

async function prepareTicket(page, shot) {
  const token = await openDesk(page, {
    tab: "tickets",
    book: shot.book,
    level: shot.level,
  });
  await page.eval(KIT);
  // Deal until the ticket gives the shot its finish (a Gold Mine needs a
  // patch of empty ground); its start is scratched through the server.
  plan = null;
  for (let deal = 0; deal < 12 && !plan; deal++)
    plan = await page.eval(`(async () => {
      const L = window.__lucky;
      await L.command({ type: 'scratch-open', pack: ${JSON.stringify(shot.book)}, level: ${shot.level} });
      const t = await L.hand();
      const plan = L.plan(t);
      if (plan) await L.dab(plan.pre);
      const after = await L.hand();
      if (plan && !after.ended && plan.acts.flat().every((i) => !after.cells[i].revealed))
        return { ...plan, cols: after.cols, rows: after.rows };
      if (!after.ended) await L.dab(L.perfect(after));
      return null;
    })()`);
  if (!plan) throw new Error(`no ${shot.name} ticket to film`);
  await enterDesk(page, token, '.rs-hand canvas[role="application"]');
  // The camera's two framings, from the page.
  const frame = await page.eval(`(() => {
    const W = innerWidth, H = innerHeight;
    const mid = (r) => [(r.left + r.right) / 2 / W, (r.top + r.bottom) / 2 / H];
    const t = document.querySelector('.rs-big').getBoundingClientRect();
    const rail = document.querySelector('.rs-hand-rail').getBoundingClientRect();
    return {
      p: mid(document.querySelector('.rs-panel').getBoundingClientRect()),
      g: mid({ left: Math.min(t.left, rail.left), right: Math.max(t.right, rail.right),
        top: Math.min(t.top, rail.top), bottom: Math.max(t.bottom, rail.bottom) }),
    };
  })()`);
  const keys = shot[page.shape].map(([t, s, at]) => [t, s, ...frame[at]]);
  await page.eval(
    `window.__reelCam = ${JSON.stringify(keys)}; window.__reelT0 = undefined; ${PAGE_CAMERA}`,
  );
  await page.sleep(300);
}

async function driveTicket(page, running, shot) {
  await startClock(page);
  // The coin's radius, as a share of the panel (its cursor's size).
  const radius = await page.eval(
    `parseFloat(document.querySelector('.scratch-coin-cursor').style.width) / 200`,
  );
  const log = [];
  for (const [n, cells] of plan.acts.entries()) {
    await until(page, shot.times[n] ?? shot.times.at(-1) + 0.3 * n);
    const box = await page.eval(`(() => {
      const r = document.querySelector('.rs-hand canvas[role="application"]').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })()`);
    log.push(`${cells.join("→")} at ${(await clock(page)).toFixed(2)} s`);
    await page.drag(stroke(box, plan, cells, radius), 16);
  }
  const paid = await page
    .waitUntil(`!!document.querySelector('.rs-payout:not(.is-waiting)')`, 4000)
    .then(() => clock(page))
    .catch(() => null);
  const t = await page.eval("window.__lucky.hand()").catch(() => null);
  console.log(
    `  ${shot.name}: ${log.join(", ")}; ${t?.perfect ? "jackpot" : t?.ended ? "ended" : "still open"}${paid === null ? "" : `, pays at ${paid.toFixed(2)} s`}`,
  );
  while (running()) await page.sleep(200);
}

/**
 * The factory shot, on the game's own camera: `focus` (floor cells, x
 * across and y down the floor) and the game's own `zoom` (1 is the whole
 * floor) and a `yaw` (degrees round the floor) ease from their first value
 * to the second; it ends exactly on the fitted overview.
 */
const FACTORY = {
  seconds: 3,
  wide: { focus: [3.0, 5.1], zoom: 2.7, yaw: -14 },
  tall: { focus: [2.4, 5.0], zoom: 2.5, yaw: -12 },
};

async function prepareFactory(page) {
  const token = await openDesk(page, { tab: "factory" });
  await enterDesk(page, token, ".rs-floor3d canvas.rs-floor-canvas");
  await page.waitUntil("!!window.luckyFactory?.floorSize?.width", 30000);
  // Let the floor fill, then stop listening to the server: the factory
  // runs on the browser's own step from here.
  await page.sleep(1500);
  await page.eval(`(async () => {
    window.__reelOffline = true;
    const { factoryQuality } = await import('/components/game/relic-factory/quality.ts');
    const w = window.luckyFactory, rig = w.cameraRig, cam = rig.camera;
    const move = ${JSON.stringify(FACTORY[page.shape])};
    const seconds = ${FACTORY.seconds};
    // Full quality on every frame, with the close-up shadows.
    w.pacer = null;
    w.applyRung(factoryQuality(w.baseRatio, true)[0]);
    const lerp = (a, b, k) => a + (b - a) * k;
    // Brisk at first, coming to rest on the whole floor.
    const ease = (s) => 1 - Math.pow(1 - s, 3);
    const art = document.querySelector('.scratch-desk-art');
    const V = cam.position.constructor;
    const up = new V(0, 1, 0);
    const aim = (now) => {
      const t = window.__reelT0 === undefined ? 0 : (now - window.__reelT0) / 1000;
      const k = ease(Math.min(1, Math.max(0, t / seconds)));
      const base = rig.base;
      const fx = lerp(move.focus[0], base.target.x, k), fz = lerp(move.focus[1], base.target.z, k);
      const dir = new V().copy(base.dir).applyAxisAngle(up, (lerp(move.yaw, 0, k) * Math.PI) / 180);
      const target = new V(fx, 0, fz);
      cam.zoom = lerp(move.zoom, 1, k);
      cam.position.copy(target).addScaledVector(dir, base.d);
      cam.up.set(0, 1, 0);
      cam.lookAt(target);
      cam.near = Math.max(0.1, base.d * 0.2);
      cam.far = base.d * 3;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      // The desk under the model comes closer with it.
      const centre = w.project(base.target.x, base.target.z);
      art.style.transformOrigin = centre.x + 'px ' + centre.y + 'px';
      art.style.transform = 'scale(' + (1 + (cam.zoom - 1) * 0.85).toFixed(4) + ')';
      w.opts.onCamera?.();
      // A sale's amount is pinned where its till was on screen: none while
      // the camera is still travelling.
      if (k < 0.98) w.fx?.clear();
    };
    // Aimed before the machines pose each frame (their badges face it).
    const pose = w.animateMachines.bind(w);
    w.animateMachines = (dt) => {
      aim(performance.now());
      pose(dt);
    };
    window.__reelT0 = undefined;
    aim(performance.now());
  })()`);
  await page.sleep(500);
}

async function driveFactory(page, running) {
  await startClock(page);
  const read = `({ sold: window.luckyFactory.f?.sold ?? 0, real: window.__reelReal?.() ?? 0, page: performance.now() })`;
  const start = await page.eval(read);
  while (running()) await page.sleep(200);
  const end = await page.eval(read);
  if (start.real && end.real)
    console.log(
      `  factory: ${end.sold - start.sold} tickets sold; ${((end.page - start.page) / 1000).toFixed(2)} page s in ${((end.real - start.real) / 1000).toFixed(2)} real s (${page.slow}× slow → ${(((end.page - start.page) * page.slow) / (end.real - start.real)).toFixed(3)}× speed)`,
    );
}

/**
 * The upgrade tree, staged a little over half bought so it reads as a run
 * in progress (`NETWORK` lays it over the workshop desk's ranks). The Sun
 * & Moon prize is bought on camera, which opens its helper, Almanac, then
 * bought too.
 */
const TREE = {
  coins: 2.4e15,
  upgrades: {
    coin: 4,
    foil: 2,
    quick: 1,
    extra: 2,
    star: 3,
    goldseal: 2,
    starpower: 1,
    streak: 1,
    value: 7,
    jackpot: 2,
    hearts: 2,
    golden: 1,
    mastery: 1,
    collector: 0,
    discount: 3,
    loyalty: 1,
    freebie: 2,
    early: 1,
    "seven-prize": 3,
    "seven-help": 1,
    "twins-prize": 2,
    "twins-help": 1,
    "path-prize": 2,
    "path-help": 1,
    "ladder-prize": 2,
    "ladder-help": 1,
    "mine-prize": 1,
    "mine-help": 1,
    "sunmoon-prize": 0,
    "sunmoon-help": 0,
    "chart-prize": 0,
    "chart-help": 0,
    "crown-prize": 0,
    "crown-help": 0,
    printers: 5,
    bots: 4,
    sales: 2,
    cashiers: 2,
    wholesale: 1,
  },
};
const UPGRADES = {
  seconds: 2.6,
  /** Each tile picked a moment before its Buy is pressed. */
  buy: [
    { at: 1.05, name: "Sun & Moon" },
    { at: 1.6, name: "Almanac" },
  ],
  /** Camera keys: [clip s, scale, element, dx, dy], the point brought to
   * the middle given from that element's middle as a share of its box. */
  wide: [
    [0, 1.6, ".rs-branch.is-luck", 0, -0.18],
    [1.0, 1.55, ".rs-branch.is-books", -0.05, 0.1],
    [2.6, 1.26, ".rs-branch.is-books", 0, 0.1],
  ],
  tall: [
    [0, 1.32, ".rs-branch.is-books", 0, -0.22],
    [0.75, 1.02, ".rs-upgrades", 0, 0.04],
    [2.6, 1.0, ".rs-upgrades", 0, 0],
  ],
};

async function prepareUpgrades(page) {
  const token = await openDesk(page, { tab: "upgrades", stage: TREE });
  await enterDesk(page, token, ".rs-tree .rs-tile");
  if (page.shape === "tall") {
    // The phone shows one path: Books, scrolled to the Sun & Moon row.
    await page.click(".rs-path-tabs button:nth-child(5)");
    await page.sleep(300);
    await page.eval(`(() => {
      const list = document.querySelector('.rs-branch.is-current .rs-branch-list');
      const tile = [...list.querySelectorAll('.rs-tile')][10];
      list.scrollTop = tile.offsetTop - list.clientHeight * 0.45;
    })()`);
  }
  const keys = await page.eval(`(() => {
    const W = innerWidth, H = innerHeight;
    return ${JSON.stringify(UPGRADES[page.shape])}.map(([t, s, sel, dx, dy]) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return [t, s, (r.left + r.width * (0.5 + dx)) / W, (r.top + r.height * (0.5 + dy)) / H];
    });
  })()`);
  await page.eval(
    `window.__reelCam = ${JSON.stringify(keys)}; window.__reelT0 = undefined; ${PAGE_CAMERA}`,
  );
  await page.sleep(300);
}

/** A real click (mouse, `clicks` 2 for a double click) or tap (touch) on
 * an element's middle. */
async function press(page, selector, clicks = 1) {
  const c = await page.center(selector);
  if (!c) throw new Error(`nothing to press at ${selector}`);
  if (page.shape === "tall") return page.tap(c.x, c.y);
  const mouse = (type, buttons, clickCount) =>
    page.send("Input.dispatchMouseEvent", {
      type,
      x: c.x,
      y: c.y,
      button: "left",
      buttons,
      clickCount,
    });
  await mouse("mouseMoved", 0, 0);
  for (let n = 1; n <= clicks; n++) {
    await page.sleep(n === 1 ? 50 : 90);
    await mouse("mousePressed", 1, n);
    await page.sleep(70);
    await mouse("mouseReleased", 0, n);
  }
}

/** On the desktop a tile is bought with a double click (the bar's Buy is
 * below the close framing); on the phone it is picked, then bought with
 * the bar's Buy. */
async function driveUpgrades(page, running) {
  await startClock(page);
  const log = [];
  for (const { at, name } of UPGRADES.buy) {
    await until(page, at - (page.shape === "tall" ? 0.32 : 0.2));
    await page.eval(`(() => {
      for (const el of document.querySelectorAll('.rs-tile'))
        if (el.getAttribute('aria-label')?.startsWith(${JSON.stringify(`${name},`)}))
          el.dataset.reel = 'next';
        else delete el.dataset.reel;
    })()`);
    if (page.shape === "tall") {
      await press(page, '.rs-tile[data-reel="next"]');
      await until(page, at);
      await press(page, ".rs-buy-bar button.rs-primary");
    } else await press(page, '.rs-tile[data-reel="next"]', 2);
    log.push(`${name} at ${(await clock(page)).toFixed(2)} s`);
  }
  await page.sleep(400);
  const ranks = await page.eval(
    `[...document.querySelectorAll('.rs-branch.is-books .rs-tile')].slice(10, 12).map((t) => t.getAttribute('aria-label')).join(' | ')`,
  );
  console.log(`  bought ${log.join(", ")}: ${ranks}`);
  while (running()) await page.sleep(200);
}

const ONLY = process.env.LUCKY_SHOTS?.split(",");
export const scenes = [
  ...TICKETS.map((shot) => ({
    name: shot.name,
    seconds: shot.seconds,
    prepare: (page) => prepareTicket(page, shot),
    drive: (page, running) => driveTicket(page, running, shot),
  })),
  {
    name: "factory",
    seconds: FACTORY.seconds,
    // The busiest canvas: a little slower still, for room above 55.
    slow: 10,
    prepare: prepareFactory,
    drive: driveFactory,
  },
  {
    name: "upgrades",
    seconds: UPGRADES.seconds,
    prepare: prepareUpgrades,
    drive: driveUpgrades,
  },
].filter((scene) => !ONLY || ONLY.includes(scene.name));
