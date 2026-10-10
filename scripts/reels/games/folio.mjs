/**
 * Puzzles (`folio`): a run told in seven quick cuts, at the game's own speed
 * and 60 different frames a second.
 *
 *   1  the route: a run two stops in (Country outline and Codebreaker
 *      solved, ticked on the red trail); the camera glides up the trail to
 *      the three open stops and the host picks Word guess;
 *   2  Word guess: the answer lands, its tiles flipping green, the row
 *      bouncing and circled in red pen;
 *   3  Nonogram: the sailboat's hull drawn in three strokes, the grid melting
 *      away to leave the printed picture and its name;
 *   4  Connections: the last four words picked and their band landing;
 *   5  Sudoku: the last four squares of a row filled, each finishing its
 *      column, the last the row and the grid;
 *   6  Minesweeper: two flags planted, then one dig that clears the rest of
 *      the field;
 *   7  the route again, Word guess ticked: the camera rises to the boss,
 *      the host picks it, and the camera pulls back to the whole act.
 *
 * Every shot is its own scene (a fresh page) joined with hard cuts (`cut`)
 * and staged from a prepared save: the driver starts a run or a practice
 * puzzle through the API, then writes a fixed state over it in the dev
 * database (a seeded run from the game's own engine, with the moves before
 * the shot already played through the engine), so both shapes and every
 * take tell the same story. On camera the moves are real inputs (taps,
 * drags, keys, a right click or long press), each a correct move read from
 * the staged answer. The camera is a page transform on the run's screen,
 * moved on the page clock along a smooth path, so it glides at 60 fps and
 * keeps the game's speed.
 *
 * `PUZZLES_SHOTS=route,word node scripts/reels/record.mjs folio` films only
 * the named shots (for trying one out).
 */
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const lib = (path) =>
  new URL(`../../../lib/games/folio/${path}`, import.meta.url).href;
const E = await import(lib("engine.ts"));
const { KIND_MODULES } = await import(lib("kinds/index.ts"));
const { ANSWERS } = await import(lib("words.ts"));
const { neighbours } = await import(lib("kinds/mines.ts"));

/** Everything but the board, the trail and the backdrop. */
export const css = `
  .folio-hud, .folio-play-head, .folio-play-tools, .folio-verdict, .folio-dialog,
  .folio-route-head, .folio-pick, .folio-error, .folio-suggestions, .table-manager,
  .fk-nonogram-top, .fk-nonogram-modes, [data-radix-portal], [role="dialog"],
  .fk-toast, .fk-badge, .fk-answer, .fk-sudoku-bar, .fk-sudoku-tools, .fk-mines-bar,
  .fk-groups-prompt, .fk-groups-mistakes, .fk-groups-actions { visibility: hidden !important; }
  [data-vinext-dev-error-overlay] { display: none !important; }
  /* The room the hidden top bar kept goes back to the board. */
  main.folio-world { padding-top: 22px !important; }
`;
/** Game milliseconds each shot plays before filming. */
export const warmup = 900;
/** Filmed 4× slow: full-HD painted paper under a moving camera changes
 * every frame, and Chrome sends about 60 of those a real second, so 4× gives
 * some 240 a game second for the clip's 60 (8× sent ~470; see record.mjs). */
export const slow = 4;
/** It is moving in every shot, so a take short of 55 new frames a second
 * is filmed again, slower. */
export const minFps = 55;
/** A painted backdrop in every frame. */
export const crf = { wide: 26, tall: 26 };
/** Shots joined with hard cuts. */
export const cut = true;

// ------------------------------------------------------------------ staging

const DB = resolve(process.env.DATABASE_PATH ?? ".data/gamehub.sqlite");

/**
 * Starts a run (or a practice puzzle of `practice`) through the API, as a
 * player would, then writes `g` over its state: the server reads every
 * request's state from the database, so the page opens on it. Returns the
 * run's token.
 */
async function stage(page, g, practice) {
  await page.goto("/favicon.svg");
  const body = practice
    ? { name: "Rec", practice: { kind: practice, boss: false } }
    : { name: "Rec", seats: 1, difficulty: 1 };
  const token = await page.eval(`fetch('/api/folio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: ${JSON.stringify(JSON.stringify(body))},
  }).then((r) => r.json()).then((v) => v.token)`);
  if (!token) throw new Error("no run was started");
  const db = new DatabaseSync(DB);
  try {
    db.exec("PRAGMA busy_timeout=5000");
    const row = db
      .prepare("SELECT state FROM folio_runs WHERE token=?")
      .get(token);
    const was = JSON.parse(row.state);
    const now = Date.now();
    const state = {
      ...g,
      host: was.host,
      revision: was.revision + 1,
      startedAt: now,
      updatedAt: now,
    };
    db.prepare("UPDATE folio_runs SET state=? WHERE token=?").run(
      JSON.stringify(state),
      token,
    );
  } finally {
    db.close();
  }
  return token;
}

/** Opens the staged run and waits until it is drawn with its art and fonts. */
async function enter(page, token, selector) {
  await page.goto(`/folio/${token}`);
  await page.waitFor(selector, 40000).catch(async () => {
    await page.goto(`/folio/${token}`);
    await page.waitFor(selector, 40000);
  });
  await page.waitUntil(
    `[...document.images].every((i) => i.complete) && document.fonts.status === 'loaded'`,
    30000,
  );
  await page.sleep(500);
}

/** A practice puzzle of `kind` at `level` from `seed`, with `moves` played. */
function puzzle(kind, seed, level, moves = []) {
  const g = E.createFolio(seed, 1, 0, { kind, boss: false });
  if (level !== 1) {
    const made = KIND_MODULES[kind].make({ level, boss: false, seed });
    Object.assign(g.puzzle, {
      level,
      view: made.view,
      remaining: made.allowance,
      allowance: made.allowance,
    });
    g.secret = made.secret;
  }
  for (const move of moves) {
    E.actFolio(g, { type: "move", move });
    if (g.puzzle.status !== "playing")
      throw new Error(`${kind} ended while staged`);
  }
  return g;
}

// ------------------------------------------------------------------ camera

/**
 * The camera: the run's screen scaled about a point, on the page clock.
 * `__reelCam` keys are [clip second, scale, x, y], x and y the point (a
 * share of the screen) brought to the middle; the path runs smoothly
 * through every key (a Hermite curve with time-weighted tangents, so it
 * never stops at a key) and never shows past the screen's edge.
 */
const CAMERA = `(() => {
  const room = document.querySelector('main.folio-world');
  const W = innerWidth, H = innerHeight;
  const keys = window.__reelCam;
  const slope = (i, d) => {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(keys.length - 1, i + 1)];
    return b[0] === a[0] ? 0 : (b[d] - a[d]) / (b[0] - a[0]);
  };
  const pose = (t) => {
    if (t <= keys[0][0]) return keys[0];
    if (t >= keys.at(-1)[0]) return keys.at(-1);
    let i = 0;
    while (t > keys[i + 1][0]) i++;
    const [a, b] = [keys[i], keys[i + 1]];
    const h = b[0] - a[0], u = (t - a[0]) / h;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    return [t, ...[1, 2, 3].map((d) =>
      h00 * a[d] + h10 * h * slope(i, d) + h01 * b[d] + h11 * h * slope(i + 1, d))];
  };
  const aim = (now) => {
    const t = window.__reelT0 === undefined ? keys[0][0] : (now - window.__reelT0) / 1000;
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
 * Sets the shot's camera from keys [clip s, scale, selector, dx, dy]: the
 * point brought to the middle is that element's middle, moved by dx, dy
 * shares of its box. Measured before the camera moves anything.
 */
async function camera(page, keys) {
  const resolved = await page.eval(`(() => {
    const W = innerWidth, H = innerHeight;
    return ${JSON.stringify(keys)}.map(([t, s, sel, dx = 0, dy = 0]) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error('camera: nothing at ' + sel);
      const r = el.getBoundingClientRect();
      return [t, s, (r.left + r.width * (0.5 + dx)) / W, (r.top + r.height * (0.5 + dy)) / H];
    });
  })()`);
  await page.eval(
    `window.__reelCam = ${JSON.stringify(resolved)}; window.__reelT0 = undefined; ${CAMERA}`,
  );
  await page.sleep(300);
}

/** Waits for the take to slow the page (just after `drive` starts), then
 * starts the clip's clock: filming begins `warmup` later. */
async function startClock(page) {
  for (let i = 0; i < 300 && slow > 1 && page.slow === 1; i++)
    await new Promise((r) => setTimeout(r, 10));
  await page.eval(`window.__reelT0 = performance.now() + ${warmup}`);
}
const clock = (page) =>
  page.eval("(performance.now() - window.__reelT0) / 1000");
/** Waits until the clip's clock reads `at` seconds (negative: the warmup). */
async function until(page, at) {
  const now = await clock(page);
  if (at > now) await page.sleep((at - now) * 1000);
}
/** A real tap (touch) or click (mouse) on an element's middle. */
async function tapOn(page, selector) {
  const c = await page.center(selector);
  if (!c) throw new Error(`nothing to tap at ${selector}`);
  await page.tap(c.x, c.y);
}
/** A right click on desktops, a long press on phones. */
async function longPress(page, x, y) {
  if (page.shape === "tall") {
    await page.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await page.sleep(520);
    await page.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    return;
  }
  const mouse = (type, buttons) =>
    page.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "right",
      buttons,
      clickCount: 1,
    });
  await mouse("mouseMoved", 0);
  await mouse("mousePressed", 2);
  await page.sleep(60);
  await mouse("mouseReleased", 0);
}
/** Runs `steps` ([clip s, async fn, label]) each at its time; logs when
 * each ran, then holds until the take ends. */
async function play(page, running, name, steps) {
  await startClock(page);
  const log = [];
  for (const [at, step, label] of steps) {
    await until(page, at);
    log.push(`${label} ${(await clock(page)).toFixed(2)}`);
    await step();
  }
  console.log(`  ${name}: ${log.join(", ")}`);
  while (running()) await page.sleep(200);
}

// ------------------------------------------------------------------- route

/** A run whose first act holds nine different games: Country outline and
 * Codebreaker up the middle open Nonogram, Word guess and Sudoku, and
 * Hidden equation is the boss. */
const RUN_SEED = 8;
function run(stops) {
  const g = E.createFolio(RUN_SEED, 1, 0, undefined, 1);
  for (const id of stops) {
    E.actFolio(g, { type: "node", id });
    E.actFolio(g, { type: "dev-win" });
    E.actFolio(g, { type: "continue" });
  }
  return g;
}

/** A map shot: `stops` already won, then the stop whose label starts with
 * `pick` picked at `at`. */
function routeShot({ name, stops, pick, at, seconds, wide, tall }) {
  return {
    name,
    seconds,
    // The busiest pictures (the whole painted backdrop moving): a little
    // slower, for room above 55.
    slow: 6,
    async prepare(page) {
      const token = await stage(page, run(stops));
      await enter(page, token, ".folio-map .folio-node");
      await camera(page, page.shape === "tall" ? tall : wide);
    },
    drive: (page, running) =>
      play(page, running, name, [
        [at, () => tapOn(page, `.folio-node[aria-label^="${pick}"]`), "pick"],
      ]),
  };
}

const route = routeShot({
  name: "route",
  stops: ["r0l1", "r1l1"],
  pick: "Round 3: Word guess",
  at: 1.45,
  seconds: 2.6,
  // From the trail's start, up past the two ticked stops to the three open
  // ones, then in on Word guess as it is picked.
  wide: [
    [0, 1.3, ".folio-map", 0, 0.2],
    [1.2, 1.75, ".folio-map", -0.06, -0.04],
    [2.6, 2.5, ".folio-map", -0.27, -0.13],
  ],
  tall: [
    [0, 1.08, ".folio-map", 0, 0.2],
    [1.2, 1.35, ".folio-map", -0.08, -0.02],
    [2.6, 1.9, ".folio-map", -0.26, -0.12],
  ],
});

const boss = routeShot({
  name: "boss",
  stops: ["r0l1", "r1l1", "r2l0"],
  pick: "Round 4: Boss",
  at: 0.85,
  seconds: 1.9,
  // Close on Word guess, ticked, up to the boss, then back to the act.
  wide: [
    [0, 2.5, ".folio-map", -0.2, -0.08],
    [0.9, 2.2, ".folio-map", 0, -0.32],
    [1.9, 1.15, ".folio-map", 0, -0.05],
  ],
  tall: [
    [0, 1.85, ".folio-map", -0.2, -0.06],
    [0.9, 1.6, ".folio-map", 0, -0.3],
    [1.9, 1.04, ".folio-map", 0, 0],
  ],
});

// -------------------------------------------------------------------- word

/** Wordle grading: 2 right place, 1 elsewhere, 0 absent. */
function grade(guess, answer) {
  const marks = Array(5).fill(0);
  const left = {};
  for (let i = 0; i < 5; i++)
    if (guess[i] === answer[i]) marks[i] = 2;
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  for (let i = 0; i < 5; i++)
    if (!marks[i] && left[guess[i]]) {
      marks[i] = 1;
      left[guess[i]]--;
    }
  return marks;
}
/** Two guesses that close in on the answer, or null. */
export function guessesFor(answer) {
  const unique = (w) => new Set(w).size === 5;
  const sum = (m, v) => m.filter((x) => x === v).length;
  const pick = (test, not) =>
    ANSWERS.find(
      (w) =>
        w !== answer && !not.includes(w) && unique(w) && test(grade(w, answer)),
    );
  const first = pick((m) => sum(m, 2) === 1 && sum(m, 1) === 1, []);
  const second = pick((m) => sum(m, 2) === 3 && sum(m, 1) === 0, [first]);
  return first && second ? [first, second] : null;
}
const WORD_SEED = 3;

const word = {
  name: "word",
  seconds: 2.7,
  async prepare(page) {
    const answer = puzzle("word", WORD_SEED, 1).secret.answer;
    const before = guessesFor(answer);
    if (!before) throw new Error(`no lead-in guesses for ${answer}`);
    this.answer = answer;
    const token = await stage(
      page,
      puzzle(
        "word",
        WORD_SEED,
        1,
        before.map((guess) => ({ guess })),
      ),
    );
    await enter(page, token, ".fk-word-grid");
    // In on the third row as it flips, back a little for the red circle.
    const row = ".fk-word-grid > :nth-child(3)";
    await camera(
      page,
      page.shape === "tall"
        ? [
            [0, 1.1, row, 0, -0.6],
            [1.4, 1.26, row, 0, 0],
            [2.7, 1.18, row, 0, 0.2],
          ]
        : [
            [0, 1.9, row, 0, -0.8],
            [1.4, 2.25, row, 0, 0],
            [2.7, 2.05, row, 0, 0.3],
          ],
    );
  },
  drive(page, running) {
    // Typed in the warmup; the clip opens as the row starts to flip.
    const letters = [...this.answer].map((letter, k) => [
      -0.75 + k * 0.08,
      () => page.key(letter, `Key${letter}`, 30),
      letter,
    ]);
    return play(page, running, "word", [
      ...letters,
      [-0.28, () => page.key("Enter", "Enter", 30), "enter"],
    ]);
  },
};

// ---------------------------------------------------------------- nonogram

/** The practice seed whose picture is the sailboat. */
const NONOGRAM_SEED = 6;
/** Every run of filled squares in row `r`. */
function rowRuns(rows, r) {
  const out = [];
  const line = rows[r];
  for (let c = 0; c < line.length; c++) {
    if (line[c] !== "#") continue;
    let e = c;
    while (e + 1 < line.length && line[e + 1] === "#") e++;
    out.push({ r, from: c, to: e });
    c = e;
  }
  return out;
}
/** The hull, drawn on camera. */
const HULL = [6, 7, 8];

const nonogram = {
  name: "nonogram",
  seconds: 2.4,
  async prepare(page) {
    const { rows, name } = puzzle("nonogram", NONOGRAM_SEED, 1).secret;
    if (name !== "a sailboat")
      throw new Error(`nonogram seed ${NONOGRAM_SEED} draws ${name}`);
    const n = rows.length;
    // The sail drawn and its empty squares crossed; the hull is left.
    const moves = [];
    for (let r = 0; r < n; r++) {
      if (HULL.includes(r)) continue;
      for (const run of rowRuns(rows, r))
        moves.push({
          mark: "fill",
          cells: Array.from(
            { length: run.to - run.from + 1 },
            (_, k) => r * n + run.from + k,
          ),
        });
    }
    const staged = puzzle("nonogram", NONOGRAM_SEED, 1, moves);
    const cells = staged.puzzle.view.cells;
    for (let r = 0; r < n; r++) {
      if (HULL.includes(r)) continue;
      // One straight run of empty squares at a time.
      let line = [];
      for (let c = 0; c <= n; c++) {
        if (c < n && cells[r * n + c] === 0) line.push(r * n + c);
        else if (line.length) {
          E.actFolio(staged, {
            type: "move",
            move: { mark: "cross", cells: line },
          });
          line = [];
        }
      }
    }
    this.strokes = HULL.flatMap((r) => rowRuns(rows, r));
    this.n = n;
    const token = await stage(page, staged);
    await enter(page, token, ".folio-play-area [data-i]");
    const grid = ".fk-nonogram-grid";
    await camera(
      page,
      page.shape === "tall"
        ? [
            [0, 1.18, grid, -0.06, 0.25],
            [1.0, 1.12, grid, -0.06, 0.12],
            [2.4, 1.02, grid, 0, 0],
          ]
        : [
            [0, 2.0, grid, 0, 0.28],
            [1.0, 1.8, grid, 0, 0.12],
            [2.4, 1.5, grid, 0, 0],
          ],
    );
  },
  drive(page, running) {
    const { n } = this;
    const stroke = (run) => async () => {
      const box = await page.eval(`(() => {
        const r = document.querySelector('.fk-nonogram-grid').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      })()`);
      const at = (c) => ({
        x: box.x + ((c + 0.5) / n) * box.w,
        y: box.y + ((run.r + 0.5) / n) * box.h,
      });
      const points = [];
      const steps = Math.max(3, (run.to - run.from) * 2);
      for (let k = 0; k <= steps; k++)
        points.push(at(run.from + ((run.to - run.from) * k) / steps));
      points.push(points.at(-1));
      await page.drag(points, 14);
    };
    return play(
      page,
      running,
      "nonogram",
      this.strokes.map((run, k) => [
        -0.15 + k * 0.32,
        stroke(run),
        `row ${run.r}`,
      ]),
    );
  },
};

// ------------------------------------------------------------- connections

const GROUPS_SEED = 2;

const groups = {
  name: "groups",
  seconds: 2.0,
  async prepare(page) {
    const sets = puzzle("groups", GROUPS_SEED, 1).secret.groups;
    // The three easiest bands found; the hardest is left.
    const order = [...sets].sort((a, b) => a.level - b.level);
    const staged = puzzle(
      "groups",
      GROUPS_SEED,
      1,
      order.slice(0, 3).map((set) => ({ words: set.words })),
    );
    this.last = order[3].words;
    const token = await stage(page, staged);
    await enter(page, token, ".fk-groups-board .fk-groups-tile");
    const board = ".fk-groups-board";
    await camera(
      page,
      page.shape === "tall"
        ? [
            [0, 1.12, board, 0, 0.3],
            [1.1, 1.07, board, 0, 0.15],
            [2.0, 1.0, board, 0, 0],
          ]
        : [
            [0, 1.95, board, 0, 0.3],
            [1.1, 1.75, board, 0, 0.12],
            [2.0, 1.5, board, 0, 0],
          ],
    );
  },
  drive(page, running) {
    const tapWord = (w) => async () => {
      const c = await page.eval(`(() => {
        const el = [...document.querySelectorAll('.fk-groups-tile')]
          .find((t) => t.textContent.trim() === ${JSON.stringify(w)});
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      await page.tap(c.x, c.y);
    };
    // Submit is hidden with the other buttons; it is pressed by script.
    return play(page, running, "groups", [
      ...this.last.map((w, k) => [-0.12 + k * 0.13, tapWord(w), w]),
      [0.42, () => page.click(".fk-groups-submit"), "submit"],
    ]);
  },
};

// ------------------------------------------------------------------ sudoku

const SUDOKU_SEED = 4;

const sudoku = {
  name: "sudoku",
  seconds: 1.9,
  async prepare(page) {
    const g = puzzle("sudoku", SUDOKU_SEED, 1);
    const { grid } = g.puzzle.view;
    const { solution } = g.secret;
    // A middle row with four open squares spread along it.
    let row = -1,
      cells = [];
    for (const r of [4, 3, 5, 2, 6]) {
      const open = [];
      for (let c = 0; c < 9; c++) if (!grid[r * 9 + c]) open.push(r * 9 + c);
      const picks = [
        open[0],
        open[Math.floor(open.length / 3)],
        open[Math.floor((2 * open.length) / 3)],
        open.at(-1),
      ];
      if (open.length >= 4 && new Set(picks).size === 4) {
        row = r;
        cells = picks;
        break;
      }
    }
    if (row < 0) throw new Error("no sudoku row to finish");
    const moves = [];
    for (let i = 0; i < 81; i++)
      if (!grid[i] && !cells.includes(i))
        moves.push({ cell: i, digit: solution[i] });
    this.cells = cells.map((i) => ({ i, digit: solution[i] }));
    const token = await stage(page, puzzle("sudoku", SUDOKU_SEED, 1, moves));
    await enter(page, token, ".fk-sudoku-grid");
    const first = `[data-cell="${cells[0]}"]`;
    const mid = `[data-cell="${row * 9 + 4}"]`;
    await camera(
      page,
      page.shape === "tall"
        ? [
            [0, 1.3, first, 1.5, 0],
            [1.1, 1.2, mid, 0, 0],
            [1.9, 1.05, ".fk-sudoku-grid", 0, 0],
          ]
        : [
            [0, 2.4, first, 1.5, 0],
            [1.1, 2.1, mid, 0, 0],
            [1.9, 1.7, ".fk-sudoku-grid", 0, 0],
          ],
    );
  },
  drive(page, running) {
    // A square tapped, then its number typed.
    const steps = this.cells.flatMap(({ i, digit }, k) => [
      [0.02 + k * 0.3, () => tapOn(page, `[data-cell="${i}"]`), `tap ${i}`],
      [
        0.12 + k * 0.3,
        () => page.key(String(digit), `Digit${digit}`, 30),
        String(digit),
      ],
    ]);
    return play(page, running, "sudoku", steps);
  },
};

// ------------------------------------------------------------------- mines

const MINES_SEED = 37;
const MINES_LEVEL = 2;

/** The staged field: opened but for one patch of empty ground (dug last)
 * and two unflagged mines beside it (flagged on camera); null when the
 * seed has no patch worth digging. */
export function minesPlan(seed) {
  const g = puzzle("mines", seed, MINES_LEVEL);
  const { size } = g.puzzle.view;
  const first = Math.floor(size / 2) * size + Math.floor(size / 2);
  E.actFolio(g, { type: "move", move: { open: first } });
  const mines = new Set(g.secret.mines);
  const count = (i) => neighbours(i, size).filter((k) => mines.has(k)).length;
  const view = g.puzzle.view;
  // Patches of empty ground still closed, each with the numbers round it.
  const seen = new Set();
  const patches = [];
  for (let i = 0; i < size * size; i++) {
    if (seen.has(i) || mines.has(i) || count(i) || view.cells[i] !== -1)
      continue;
    const patch = new Set([i]),
      zeros = [i],
      stack = [i];
    seen.add(i);
    while (stack.length) {
      const at = stack.pop();
      for (const k of neighbours(at, size)) {
        if (patch.has(k) || mines.has(k)) continue;
        patch.add(k);
        if (!count(k) && !seen.has(k)) {
          seen.add(k);
          zeros.push(k);
          stack.push(k);
        }
      }
    }
    patches.push({ patch, zeros });
  }
  patches.sort((a, b) => b.patch.size - a.patch.size);
  const best = patches[0];
  if (!best || best.patch.size < 12) return null;
  const near = [...mines].filter((m) =>
    neighbours(m, size).some((k) => best.patch.has(k)),
  );
  if (near.length < 2) return null;
  // Dug from the zero nearest the middle of the patch.
  const spread = (i) =>
    [...best.patch].reduce(
      (s, k) =>
        s +
        Math.hypot(
          (k % size) - (i % size),
          Math.floor(k / size) - Math.floor(i / size),
        ),
      0,
    );
  const dig = [...best.zeros].sort((a, b) => spread(a) - spread(b))[0];
  const late = near.slice(0, 2);
  for (let i = 0; i < size * size; i++)
    if (!mines.has(i) && !best.patch.has(i) && view.cells[i] === -1) {
      E.actFolio(g, { type: "move", move: { open: i } });
      if (g.puzzle.status !== "playing") return null;
    }
  if ([...best.patch].some((k) => view.cells[k] !== -1)) return null;
  for (const m of mines)
    if (!late.includes(m)) E.actFolio(g, { type: "move", move: { flag: m } });
  return { g, late, dig, patch: best.patch.size };
}

const minesShot = {
  name: "mines",
  seconds: 1.9,
  async prepare(page) {
    const plan = minesPlan(MINES_SEED);
    if (!plan) throw new Error(`mines seed ${MINES_SEED} has no patch`);
    Object.assign(this, plan);
    const token = await stage(page, plan.g);
    await enter(page, token, ".fk-mines-board .fk-mines-cell");
    const cell = (i) => `.fk-mines-cell:nth-child(${i + 1})`;
    await camera(
      page,
      page.shape === "tall"
        ? [
            // The phone's board fills its width: closer only a little,
            // held on the board.
            [0, 1.3, ".fk-mines-board", -0.08, -0.12],
            [0.75, 1.22, ".fk-mines-board", 0, -0.06],
            [1.9, 1.05, ".fk-mines-board", 0, 0],
          ]
        : [
            [0, 2.5, cell(plan.late[0])],
            [0.75, 2.3, cell(plan.dig)],
            [1.9, 1.7, ".fk-mines-board"],
          ],
    );
  },
  drive(page, running) {
    const at = (i) => page.center(`.fk-mines-cell:nth-child(${i + 1})`);
    const flag = (i) => async () => {
      const c = await at(i);
      await longPress(page, c.x, c.y);
    };
    const dig = async () => {
      const c = await at(this.dig);
      await page.tap(c.x, c.y);
    };
    const tall = page.shape === "tall";
    return play(page, running, "mines", [
      // A long press lasts half a second: the phone's start earlier.
      [tall ? -0.4 : 0.05, flag(this.late[0]), "flag"],
      [tall ? 0.12 : 0.35, flag(this.late[1]), "flag"],
      [0.75, dig, `dig (${this.patch} squares)`],
    ]);
  },
};

const ONLY = process.env.PUZZLES_SHOTS?.split(",");
export const scenes = [route, word, nonogram, groups, sudoku, minesShot, boss]
  .map((shot) => ({
    name: shot.name,
    seconds: shot.seconds,
    ...(shot.slow && { slow: shot.slow }),
    prepare: (page) => shot.prepare(page),
    drive: (page, running) => shot.drive(page, running),
  }))
  .filter((scene) => !ONLY || ONLY.includes(scene.name));
