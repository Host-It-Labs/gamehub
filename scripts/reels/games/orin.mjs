/**
 * Know Me: one round of each of its three games, filmed as three scenes.
 *
 *  1. Top Five: you drag Mia's list ("The hardest thing to say no to") into
 *     the order you think she ranked it and lock; your own list is revealed
 *     with everyone's guesses dropping onto it, then Mia's, where your guess
 *     scores.
 *  2. Dial: you turn the dial for Mia's clue ("Escape room" between worst
 *     and best date idea) and lock; your own clue is revealed with everyone's
 *     pointers swinging in, then Mia's, where your pointer lands.
 *  3. Ten Coins: you tap Mia's ten coins onto "How you handle stress" and
 *     lock; your own split is revealed, then Mia's, where your read scores.
 *
 * Each table is a saved match set up in advance with four named seats, every
 * answer in and the other three guessers already locked, so each scene holds
 * only your choice and the reveals.
 */
export const css = `
  .party-players, .party-action-status, .party-dialog, .party-practice,
  .party-lock-count, .party-host-wait, .party-waiting, .author-tabs,
  .dial-slider, .party-dock, .comparison-open,
  .coin-step { visibility: hidden !important; }
  /* The dev server's error badge, should another edit be mid-flight. */
  [data-vinext-dev-error-overlay] { display: none !important; }
  /* A speck that never stops moving, so the screencast keeps sending frames
     through still moments and the clip keeps its full length. */
  body::after {
    content: ''; position: fixed; right: 0; bottom: 0; width: 1px; height: 1px;
    background: rgba(0, 0, 0, 0.02); pointer-events: none; z-index: 2147483647;
    animation: reel-tick 1s linear infinite;
  }
  @keyframes reel-tick { to { transform: translateX(-1px); } }
`;
export const warmup = 1200;
/** Filmed 2× slow so its motion stays smooth on a loaded Mac (see record.mjs). */
export const slow = 2;
/** Drives start as soon as a scene is ready; filming starts after warmup. */
const lead = warmup + 300;
export const seconds = 7.5;

const SAVE = 'gamehub.standalone.v1';
const names = ['You', 'Mia', 'Leo', 'Ava'];

/** Builds a table in the page, saves it as the Know Me match and opens it. */
async function open(page, build, ready) {
  await page.goto('/');
  const ok = await page.eval(`(async () => {
    const { standaloneGames } = await import('/lib/games/standalone/registry.ts');
    const names = ${JSON.stringify(names)};
    const tribu = { carry: names.map(() => 0), mode: 'individual', teams: names.map((_, s) => s) };
    const g = await (${build})(names, tribu);
    if (typeof g === 'string') return g;
    if (!standaloneGames.orin.isSavedGame(g)) return 'not a saved Know Me game';
    localStorage.setItem(${JSON.stringify(SAVE)}, JSON.stringify({ orin: g }));
    return 'ok';
  })()`);
  if (ok !== 'ok') throw new Error(`the prepared Know Me table failed: ${ok}`);
  await page.goto('/');
  await page.waitFor('button.lib-tile-button[aria-label^="Know Me."]', 60000);
  await page.click('button.lib-tile-button[aria-label^="Know Me."]');
  await page.waitFor('button.resume-strip');
  await page.click('button.resume-strip');
  await page.waitFor(ready);
}

/** Looks at every other player's answer once, as a player would, so Lock
 * is open; ends on Mia. */
async function visitTabs(page) {
  for (const i of [3, 2, 1]) {
    await page.click(`.author-tabs [role="tab"]:nth-of-type(${i})`);
    await page.sleep(150);
  }
}

/** Eased values from one stop to the next, about one per frame. */
function ease(stops, perLeg = 24) {
  const out = [stops[0]];
  for (let i = 1; i < stops.length; i++)
    for (let k = 1; k <= perLeg; k++) {
      const t = k / perLeg,
        e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      out.push(stops[i - 1] + (stops[i] - stops[i - 1]) * e);
    }
  return out;
}

/** Lock, a look at your own answer's reveal, then Next to Mia's. */
async function lockAndReveal(page, running, phase, hold) {
  await page.click('.party-dock .party-primary');
  await page.waitFor(phase);
  await page.sleep(hold);
  if (!running()) return;
  await page.click('.party-dock .next-step');
}

/* ---------------- Top Five ---------------- */

const topFive = {
  /** Each seat's list: the prompt and its real order (answer ids, best first). */
  lists: [
    { title: 'Things you always put off', order: [1, 3, 0, 4, 2] },
    { title: 'The hardest thing to say no to', order: [2, 1, 4, 0, 3] },
    { title: 'The perfect Friday night', order: [1, 0, 3, 2, 4] },
    { title: 'The worst thing a guest can do', order: [4, 1, 0, 3, 2] },
  ],
  /** guesses[guesser][author]; yours for Mia comes live. */
  guesses: [
    [null, null, [1, 0, 3, 2, 4], [1, 4, 2, 3, 0]],
    [[1, 0, 3, 4, 2], null, [0, 1, 3, 2, 4], [1, 4, 3, 0, 2]],
    [[3, 1, 0, 2, 4], [2, 4, 1, 0, 3], null, [4, 1, 3, 0, 2]],
    [[1, 3, 4, 0, 2], [1, 2, 0, 4, 3], [1, 3, 0, 2, 4], null],
  ],
};

async function prepareTopFive(page) {
  await open(
    page,
    `async (names, tribu) => {
      const ranking = await import('/lib/games/party/ranking.ts');
      const { topics } = await import('/lib/games/party/catalog.ts');
      const spec = ${JSON.stringify(topFive)};
      const g = ranking.createGame('orin', names.length, 20261009);
      const ids = spec.lists.map((l) => topics.findIndex((t) => t.title === l.title && !t.retired));
      if (ids.some((id) => id < 0)) return 'a Top Five prompt is missing';
      const spare = topics.findIndex((t, i) => !t.retired && !ids.includes(i));
      g.seats = names;
      g.phase = 'guess';
      g.offers = ids.map((id) => [id, spare, ids[(ids.indexOf(id) + 1) % ids.length]]);
      g.ballots = spec.lists.map((l, s) => ({ topic: ids[s], order: l.order, locked: true }));
      g.guesses = spec.guesses.map((orders, s) => ({ orders, locked: s > 0 }));
      g.tribu = tribu;
      g.log = [];
      return ranking.validState(g) ? g : 'invalid Top Five table';
    }`,
    '.ranking-stage.phase-guess .tier-list .ranking-handle',
  );
  await visitTabs(page);
  await page.waitUntil(
    `document.querySelector('.tier-paper-heading h3')?.textContent === ${JSON.stringify(topFive.lists[1].title)}`,
  );
  await page.sleep(500);
}

/** Drags the row at `from` so it drops into slot `to` (0 = top). */
async function dragRow(page, from, to) {
  const at = await page.eval(`(() => {
    const rows = [...document.querySelectorAll('.tier-list > li')].map((li) => li.getBoundingClientRect());
    const h = document.querySelectorAll('.tier-list > li')[${from}].querySelector('.ranking-handle').getBoundingClientRect();
    return { x: h.x + h.width / 2, y: h.y + h.height / 2, rows: rows.map((r) => ({ top: r.top, h: r.height })) };
  })()`);
  const start = at.rows[from],
    goal = at.rows[to],
    grab = at.y - start.top,
    // Land the row a little above the slot's middle, so it settles there.
    endY = goal.top + grab - (to < from ? goal.h * 0.3 : -goal.h * 0.3);
  const ys = ease([at.y, endY], 30);
  await page.drag(
    ys.map((y) => ({ x: at.x, y })),
    16,
  );
}

async function driveTopFive(page, running) {
  await page.sleep(lead);
  await dragRow(page, 2, 0);
  await page.sleep(380);
  await dragRow(page, 4, 2);
  await page.sleep(500);
  await lockAndReveal(page, running, '.ranking-stage.phase-reveal', 2000);
}

/* ---------------- Dial ---------------- */

const dial = {
  /** Each seat's clue: the spectrum (by its left end), the hidden point, the clue. */
  cards: [
    { left: 'Totally normal', point: 72, clue: 'Texting back a week later' },
    { left: 'Worst date idea', point: 70, clue: 'Escape room' },
    { left: 'Tastes bad', point: 40, clue: 'Pineapple pizza' },
    { left: 'Dumb idea', point: 22, clue: 'Socks with sandals' },
  ],
  /** The other dials, locked: each row is one guesser's dial per author. */
  dials: [
    [null, null, null, null],
    [68, null, 45, 30],
    [80, 55, null, 20],
    [74, 71, 50, null],
  ],
};
/** Where your hand takes the needle for Mia's clue, and where it settles. */
const sweep = [50, 28, 86, 69];

async function prepareDial(page) {
  await open(
    page,
    `async (names, tribu) => {
      const dial = await import('/lib/games/party/dial.ts');
      const { spectrums } = await import('/lib/games/party/spectrums.ts');
      const { cards, dials } = ${JSON.stringify(dial)};
      const g = dial.createGame(names.length, 20261008);
      const self = spectrums.findIndex((s) => s.self && !s.retired);
      const id = (left) => spectrums.findIndex((s) => s.left === left && !s.self);
      if (cards.some((c) => id(c.left) < 0)) return 'a Dial spectrum is missing';
      g.seats = names;
      g.phase = 'guess';
      g.target = 0;
      g.cards = cards.map((c) => ({
        offers: [id(c.left), self], card: id(c.left), point: c.point,
        clue: c.clue, placed: null, locked: true,
      }));
      g.guesses = dials.map((values, s) => ({ values, locked: s > 0 }));
      g.tribu = tribu;
      g.log = [];
      return dial.validState(g) ? g : 'invalid Dial table';
    }`,
    '.dial-stage.phase-guess .dial-face svg.is-live',
  );
  await visitTabs(page);
  await page.waitUntil(
    `document.querySelector('.dial-clue q')?.textContent === ${JSON.stringify(dial.cards[1].clue)}`,
  );
  await page.sleep(500);
}

/** Screen points along the dial's band for a run of dial values. */
function needlePath(page, values) {
  return page.eval(`(() => {
    const svg = document.querySelector('.dial-face svg');
    const m = svg.getScreenCTM();
    return ${JSON.stringify(values)}.map((v) => {
      const a = Math.PI * (1 - v / 100);
      const p = new DOMPoint(200 + 150 * Math.cos(a), 200 - 150 * Math.sin(a)).matrixTransform(m);
      return { x: p.x, y: p.y };
    });
  })()`);
}

async function driveDial(page, running) {
  await page.sleep(lead);
  await page.drag(await needlePath(page, ease(sweep, 20)), 16);
  await page.sleep(350);
  await lockAndReveal(page, running, '.dial-stage.phase-reveal', 2300);
}

/* ---------------- Ten Coins ---------------- */

const tenCoins = {
  /** Each seat's prompt and real split of the ten coins. */
  cards: [
    { text: 'A perfect weekend', coins: [3, 2, 1, 4] },
    { text: 'How you handle stress', coins: [2, 1, 3, 4] },
    { text: 'Where your money goes', coins: [4, 1, 3, 2] },
    { text: 'Your morning', coins: [5, 2, 0, 3] },
  ],
  /** guesses[guesser][author]; yours for Mia comes live. */
  guesses: [
    [null, null, [3, 2, 3, 2], [4, 3, 0, 3]],
    [[3, 3, 1, 3], null, [4, 1, 2, 3], [3, 2, 1, 4]],
    [[2, 2, 2, 4], [3, 1, 3, 3], null, [5, 1, 1, 3]],
    [[3, 2, 1, 4], [1, 2, 3, 4], [4, 2, 2, 2], null],
  ],
};
/** Your taps on Mia's rows: [option, coin], landing on 2-2-2-4. */
const taps = [
  [3, 4],
  [0, 2],
  [2, 2],
  [1, 2],
];

async function prepareCoins(page) {
  await open(
    page,
    `async (names, tribu) => {
      const coins = await import('/lib/games/party/coins.ts');
      const { coinPrompts } = await import('/lib/games/party/coin-prompts.ts');
      const spec = ${JSON.stringify(tenCoins)};
      const g = coins.createGame(names.length, 20261009);
      const ids = spec.cards.map((c) => coinPrompts.findIndex((p) => p.text === c.text && !p.retired));
      if (ids.some((id) => id < 0)) return 'a Ten Coins prompt is missing';
      g.seats = names;
      g.phase = 'guess';
      g.cards = spec.cards.map((c, s) => ({
        offers: [ids[s], ids[(s + 1) % ids.length]], prompt: ids[s], coins: c.coins, locked: true,
      }));
      g.guesses = spec.guesses.map((rows, s) => ({
        coins: rows.map((r) => r ?? [0, 0, 0, 0]), locked: s > 0,
      }));
      g.tribu = tribu;
      g.log = [];
      return coins.validState(g) ? g : 'invalid Ten Coins table';
    }`,
    '.coins-stage.phase-guess .coins-row .coin-slots button',
  );
  await page.waitUntil(
    `document.querySelector('.coins-prompt')?.textContent.includes(${JSON.stringify(tenCoins.cards[1].text)})`,
  );
  await page.sleep(500);
}

async function driveCoins(page, running) {
  await page.sleep(lead);
  for (const [option, coin] of taps) {
    const at = await page.center(
      `.coins-row.row-${option} .coin-slots button:nth-child(${coin})`,
    );
    await page.tap(at.x, at.y);
    await page.sleep(420);
  }
  await page.sleep(250);
  await lockAndReveal(page, running, '.coins-stage.phase-reveal', 2300);
}

export const scenes = [
  { prepare: prepareTopFive, drive: driveTopFive },
  { prepare: prepareDial, drive: driveDial },
  { prepare: prepareCoins, drive: driveCoins },
];
