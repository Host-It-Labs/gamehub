/**
 * Folio: four of its puzzle kinds solved in practice runs, one scene each:
 * a nonogram drawn with real drags, a word guessed with real keys, a Sudoku
 * filled with real taps and a minefield cleared with taps and flags. Answers
 * live on the server only, so the driver reads each one from the dev database
 * (read-only) to make only correct moves.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const css = `
  .folio-hud, .folio-play-head, .folio-play-tools, .folio-verdict, .folio-dialog,
  .fk-nonogram-top, .fk-nonogram-modes, .folio-suggestions, [data-radix-portal], [role="dialog"],
  .fk-toast, .fk-badge, .fk-answer, .fk-sudoku-bar, .fk-sudoku-tools, .fk-mines-bar { visibility: hidden !important; }
  /* The dev server's issue badge, when another session's edit trips it. */
  [data-vinext-dev-error-overlay] { display: none !important; }
  /* A pixel that never stops changing, so the screencast films a still end too. */
  body::after { content: ''; position: fixed; left: 0; top: 0; width: 2px; height: 2px; z-index: 99999;
    pointer-events: none; background: rgb(0 0 0 / 0.01); animation: reel-beat 0.2s steps(2) infinite; }
  @keyframes reel-beat { to { background: rgb(0 0 0 / 0.02); } }
`;

function stateOf(token) {
  const db = new DatabaseSync(
    resolve(process.env.DATABASE_PATH ?? '.data/gamehub.sqlite'),
    { readOnly: true },
  );
  try {
    const row = db
      .prepare('SELECT state FROM folio_runs WHERE token=?')
      .get(token);
    return row && JSON.parse(row.state);
  } finally {
    db.close();
  }
}

/**
 * Starts practice runs of one kind until `accept(state)` likes one (or the
 * tries run out), then opens it. A static file gives the page its origin, so
 * the library never has to load.
 */
async function practice(page, kind, ready, accept = () => true, tries = 12) {
  await page.goto('/favicon.svg');
  let token, state;
  for (let i = 0; i < tries; i++) {
    const view = await page.eval(`fetch('/api/folio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rec', practice: { kind: ${JSON.stringify(kind)}, boss: false } }),
    }).then((r) => r.json())`);
    token = view.token;
    state = stateOf(token);
    if (state?.secret && (accept(state) || i === tries - 1)) break;
  }
  if (!state?.secret) throw new Error(`no practice ${kind} found`);
  // A busy dev server sometimes leaves the first navigation unfinished.
  await page.goto(`/folio/${token}`);
  await page.waitFor(ready, 20000).catch(async () => {
    await page.goto(`/folio/${token}`);
    await page.waitFor(ready, 40000);
  });
  await page.sleep(800);
  return { token, state };
}

/** A right-click on desktops, a long press on phones. */
async function press(page, x, y, long) {
  if (!long) return page.tap(x, y);
  if (page.shape === 'tall') {
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    await page.sleep(520);
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    return;
  }
  const mouse = (type, buttons) =>
    page.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'right',
      buttons,
      clickCount: 1,
    });
  await mouse('mouseMoved', 0);
  await mouse('mousePressed', 2);
  await page.sleep(60);
  await mouse('mouseReleased', 0);
}

// ---------------------------------------------------------------- nonogram

/** Pictures that read at a glance once half drawn. */
const LIKED = [
  'a cat',
  'a fish',
  'a sailboat',
  'a house',
  'a crown',
  'a heart',
  'an umbrella',
  'a ghost',
  'a tree',
];
let picture;

/** Every run of filled squares, row by row, top to bottom. */
function runs(rows) {
  const out = [];
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      if (line[c] !== '#') continue;
      let e = c;
      while (e + 1 < line.length && line[e + 1] === '#') e++;
      out.push({ r, from: c, to: e });
      c = e;
    }
  });
  return out;
}

const nonogram = {
  // Drawing starts during the warmup, so the clip opens on a picture begun.
  warmup: 3200,
  seconds: 5.5,
  async prepare(page) {
    const { state } = await practice(
      page,
      'nonogram',
      '.folio-play-area [data-i]',
      (s) => LIKED.includes(s.secret.name),
    );
    picture = state.secret.rows;
  },
  async drive(page, running) {
    const n = picture.length;
    // Leave the last run open, so the clip never reaches the win screen.
    for (const run of runs(picture).slice(0, -1)) {
      if (!running()) return;
      const box = await page.eval(`(() => {
        const grid = document.querySelector('.folio-play-area [data-i="0"]')?.parentElement;
        const r = grid.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      })()`);
      const at = (r, c) => ({
        x: box.x + ((c + 0.5) / n) * box.w,
        y: box.y + ((r + 0.5) / n) * box.h,
      });
      const points = [];
      const steps = Math.max(2, (run.to - run.from) * 3);
      for (let k = 0; k <= steps; k++)
        points.push(at(run.r, run.from + ((run.to - run.from) * k) / steps));
      points.push(points.at(-1));
      await page.drag(points, 24);
      await page.sleep(180);
    }
  },
};

// -------------------------------------------------------------------- word

const ANSWERS = /ANSWERS =\s*'([A-Z ]+)'/
  .exec(readFileSync(resolve('lib/games/folio/words.ts'), 'utf8'))[1]
  .split(' ');

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

/** Two guesses that close in on the answer, then the answer. */
function guessesFor(answer) {
  const score = (w) => grade(w, answer);
  const unique = (w) => new Set(w).size === 5;
  const pick = (test, not) =>
    ANSWERS.find((w) => w !== answer && !not.includes(w) && test(score(w), w));
  const sum = (m, v) => m.filter((x) => x === v).length;
  const first = pick(
    (m, w) => unique(w) && sum(m, 2) === 1 && sum(m, 1) === 1,
    [],
  );
  const second = pick(
    (m, w) => unique(w) && sum(m, 2) === 2 && sum(m, 1) >= 1,
    [first],
  );
  return [first, second, answer].filter(Boolean);
}

let words;

const word = {
  // The first guess is typed and graded during the warmup.
  warmup: 2000,
  seconds: 6,
  async prepare(page) {
    const { state } = await practice(
      page,
      'word',
      '.fk-word-grid',
      (s) => guessesFor(s.secret.answer).length === 3,
    );
    words = guessesFor(state.secret.answer);
  },
  async drive(page, running) {
    for (const [k, guess] of words.entries()) {
      if (!running()) return;
      for (const letter of guess) {
        await page.key(letter, `Key${letter}`, 40);
        await page.sleep(k ? 90 : 60);
      }
      await page.sleep(140);
      await page.key('Enter', 'Enter', 40);
      // Let the row start flipping before the next guess.
      await page.sleep(1100);
    }
  },
};

// ------------------------------------------------------------------ sudoku

let sudokuGrid, sudokuSolution;

const sudoku = {
  warmup: 1800,
  seconds: 5.5,
  async prepare(page) {
    const { state } = await practice(page, 'sudoku', '.fk-sudoku-grid');
    sudokuGrid = [...state.puzzle.view.grid];
    sudokuSolution = state.secret.solution;
  },
  async drive(page, running) {
    const grid = sudokuGrid;
    const peers = (i) => {
      const r = Math.floor(i / 9),
        c = i % 9,
        b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const empty = (cells) => cells.filter((k) => !grid[k]).length;
      const row = Array.from({ length: 9 }, (_, k) => r * 9 + k);
      const col = Array.from({ length: 9 }, (_, k) => k * 9 + c);
      const box = Array.from(
        { length: 9 },
        (_, k) =>
          (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 +
          (b % 3) * 3 +
          (k % 3),
      );
      return Math.min(empty(row), empty(col), empty(box));
    };
    let last = 40;
    while (running()) {
      // The square nearest to finishing a row, column or box, near the last.
      const open = grid.flatMap((d, i) => (d ? [] : [i]));
      if (open.length <= 1) return;
      const dist = (i) =>
        Math.abs(Math.floor(i / 9) - Math.floor(last / 9)) +
        Math.abs((i % 9) - (last % 9));
      open.sort((a, b) => peers(a) - peers(b) || dist(a) - dist(b));
      const i = open[0];
      const cell = await page.center(`[data-cell="${i}"]`);
      await page.tap(cell.x, cell.y);
      await page.sleep(130);
      const digit = sudokuSolution[i];
      const pad = await page.eval(`(() => {
        const el = document.querySelectorAll('.fk-sudoku-num')[${digit - 1}];
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      await page.tap(pad.x, pad.y);
      grid[i] = digit;
      last = i;
      await page.sleep(220);
    }
  },
};

// ------------------------------------------------------------------- mines

let minesToken;

const mines = {
  warmup: 1600,
  seconds: 5.5,
  async prepare(page) {
    ({ token: minesToken } = await practice(page, 'mines', '.fk-mines-board'));
  },
  async drive(page, running) {
    const cellAt = (i) => page.center(`.fk-mines-cell:nth-child(${i + 1})`);
    const size = await page.eval(
      `Math.round(Math.sqrt(document.querySelectorAll('.fk-mines-cell').length))`,
    );
    const first = Math.floor(size / 2) * size + Math.floor(size / 2) - 1;
    const start = await cellAt(first);
    await page.tap(start.x, start.y);
    // The mines are laid by the first open.
    let mineSet;
    for (let k = 0; k < 40 && !mineSet; k++) {
      await page.sleep(150);
      const m = stateOf(minesToken)?.secret?.mines;
      if (m) mineSet = new Set(m);
    }
    if (!mineSet) throw new Error('mines were not laid');
    const around = (i) => {
      const x = i % size,
        y = Math.floor(i / size),
        out = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if ((dx || dy) && x + dx >= 0 && x + dx < size && y + dy >= 0 && y + dy < size)
            out.push((y + dy) * size + x + dx);
      return out;
    };
    const flagged = new Set();
    let last = first,
      count = 0;
    await page.sleep(700);
    while (running()) {
      const opened = await page.eval(
        `[...document.querySelectorAll('.fk-mines-cell')].map((el) => el.classList.contains('open'))`,
      );
      const near = (i) => around(i).some((k) => opened[k]);
      const dist = (i) =>
        Math.hypot((i % size) - (last % size), Math.floor(i / size) - Math.floor(last / size));
      const hidden = opened.flatMap((o, i) => (o || flagged.has(i) ? [] : [i]));
      // Every third move plants a flag on a mine beside the cleared ground.
      const wantFlag = ++count % 3 === 0;
      const choices = hidden
        .filter((i) => near(i) && mineSet.has(i) === wantFlag)
        .sort((a, b) => dist(a) - dist(b));
      const i =
        choices[0] ??
        hidden
          .filter((i) => near(i) && !mineSet.has(i))
          .sort((a, b) => dist(a) - dist(b))[0];
      if (i === undefined) return;
      const flag = mineSet.has(i);
      const at = await cellAt(i);
      await press(page, at.x, at.y, flag);
      if (flag) flagged.add(i);
      last = i;
      await page.sleep(flag ? 240 : 320);
    }
  },
};

export const scenes = [nonogram, word, sudoku, mines];
