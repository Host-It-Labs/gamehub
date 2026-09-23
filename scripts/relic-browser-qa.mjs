/** Optional headless acceptance checks. Uses an isolated DB and no user browser profile.
 * PLAYWRIGHT_MODULE can point to an existing Playwright installation. */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeServer } from '../server/index.ts';
import { openDatabase } from '../server/database.ts';
import { SCRATCH_SKILLS } from '../lib/games/relic/scratch.ts';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
);
const directory = mkdtempSync(join(tmpdir(), 'relic-browser-'));
const output =
  process.env.RELIC_QA_OUTPUT ??
  mkdtempSync(join(tmpdir(), 'relic-qa-artifacts-'));
mkdirSync(output, { recursive: true });
const database = join(directory, 'gamehub.sqlite');
const base = 'http://127.0.0.1:31987';
const app = await makeServer({
  database,
  origin: base,
  staticDir: resolve('dist/client'),
  bots: false,
});
await new Promise((r, reject) => {
  app.server.once('error', reject);
  app.server.listen(31987, '127.0.0.1', r);
});
let browser;
const reports = [],
  errors = [];
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`);
  });
  await page.goto(`${base}/relic`);
  await page.getByLabel('Your name', { exact: true }).fill('QA scratcher');
  await page.getByLabel('Desk name').fill('The scratch acceptance desk');
  await page.getByRole('button', { name: /Let.s play/ }).click();
  await page.waitForURL(/\/expedition\//);
  await page.locator('.scratch-field canvas:not(.scratch-dust)').waitFor();
  const path = new URL(page.url()).pathname.replace(
    '/expedition/',
    '/api/expeditions/',
  );
  async function state() {
    return page.evaluate(async (path) => (await fetch(path)).json(), path);
  }
  async function layout(name) {
    const data = await page.evaluate(() => {
      const r = (s) => {
        const e = document.querySelector(s);
        const b = e.getBoundingClientRect();
        return {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          right: b.right,
          bottom: b.bottom,
        };
      };
      return {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        canvas: r('.scratch-field canvas:not(.scratch-dust)'),
        dock: r('.scratch-hand-dock'),
        menu: r('.game-navigation-menu'),
        others: r('.game-navigation-others'),
        cabinet: r('.scratch-book-button'),
        atlas: r('.scratch-atlas-button'),
      };
    });
    assert.ok(
      data.scrollWidth <= data.width + 1,
      `${name}: horizontal overflow`,
    );
    assert.ok(
      data.scrollHeight <= data.height + 1,
      `${name}: document overflow`,
    );
    for (const key of ['canvas', 'dock', 'cabinet', 'atlas']) {
      const box = data[key];
      assert.ok(
        box.x >= -1 &&
          box.y >= -1 &&
          box.right <= data.width + 1 &&
          box.bottom <= data.height + 1,
        `${name}: ${key} outside viewport: ${JSON.stringify(box)}`,
      );
    }
    assert.ok(
      data.others.y >= data.menu.bottom,
      `${name}: Others must be under Menu`,
    );
    assert.ok(data.canvas.height >= 90, `${name}: scratch surface collapsed`);
    reports.push({ name, ...data });
    await page.screenshot({ path: join(output, `${name}.png`) });
  }
  await layout('desktop-pocket');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let box = await page
    .locator('.scratch-field canvas:not(.scratch-dust)')
    .boundingBox();
  await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.2, {
    steps: 15,
  });
  await page.mouse.up();
  await page.waitForFunction(async (path) => {
    const v = await (await fetch(path)).json();
    return v.game.scratch.tickets[v.viewerId].sequence > 0;
  }, path);
  const partial = await state(),
    partialTicket = partial.game.scratch.tickets[partial.viewerId];
  assert.ok(partialTicket.cells.some((c) => c.mask.includes('1')));
  await page.screenshot({ path: join(output, 'partial-scratch.png') });
  await page.reload();
  await page.locator('.scratch-field canvas:not(.scratch-dust)').waitFor();
  const restored = await state();
  assert.deepEqual(
    restored.game.scratch.tickets[restored.viewerId].cells,
    partialTicket.cells,
  );
  box = await page
    .locator('.scratch-field canvas:not(.scratch-dust)')
    .boundingBox();
  await page.mouse.move(box.x + box.width * 0.005, box.y + box.height * 0.015);
  await page.mouse.down();
  for (let line = 0; line < 34; line++) {
    const y = box.y + box.height * (0.005 + line * 0.03);
    await page.mouse.move(box.x + box.width * (line % 2 ? 0.005 : 0.995), y, {
      steps: 4,
    });
  }
  await page.mouse.up();
  await page
    .getByRole('button', { name: 'Collect prize' })
    .waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Collect prize' }).click();
  await page.getByRole('button', { name: /Next ticket/ }).waitFor();
  assert.equal((await state()).game.scratch.completed, 1);
  await page.locator('.scratch-atlas-button').click();
  await page.getByRole('button', { name: /^Copper edge, / }).click();
  await page.getByRole('button', { name: /^Upgrade/ }).click();
  await page.getByRole('button', { name: /^Copper edge, 1 of/ }).waitFor();
  await page.screenshot({ path: join(output, 'desktop-atlas.png') });
  const map = page.locator('.scratch-map-viewport');
  const before = await map.evaluate((e) => ({
    x: e.scrollLeft,
    y: e.scrollTop,
  }));
  const rect = await map.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.35,
    rect.y + rect.height * 0.3,
    { steps: 10 },
  );
  await page.mouse.up();
  const after = await map.evaluate((e) => ({
    x: e.scrollLeft,
    y: e.scrollTop,
  }));
  assert.ok(
    after.x > before.x || after.y > before.y,
    'Mouse panning moves the atlas',
  );
  await page.getByRole('button', { name: 'Zoom out upgrade map' }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(
    await page
      .locator('.scratch-atlas-button')
      .evaluate((e) => e === document.activeElement),
    true,
    'Closing restores focus',
  );
  await page.getByRole('button', { name: /Next ticket/ }).click();
  for (const [width, height, name] of [
    [390, 844, 'phone-pocket'],
    [320, 568, 'small-phone-pocket'],
    [844, 390, 'short-landscape-pocket'],
    [667, 375, 'small-landscape-pocket'],
    [768, 1024, 'tablet-pocket'],
    [1024, 768, 'tablet-landscape-pocket'],
    [820, 1180, 'large-tablet-pocket'],
    [1152, 720, 'fractional-zoom-equivalent-pocket'],
  ]) {
    await page.setViewportSize({ width, height });
    await layout(name);
  }
  const morePeople = [];
  for (let i = 0; i < 5; i++) {
    const guest = await browser.newContext();
    morePeople.push(guest);
    const joined = await guest.request.post(`${base}${path}/join`, {
      headers: { Origin: base },
      data: { name: `Companion ${i + 1} with a long name` },
    });
    assert.equal(joined.status(), 200);
  }
  await page.reload();
  await page.locator('.scratch-field canvas:not(.scratch-dust)').waitFor();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Others', exact: true }).click();
  assert.equal(await page.locator('.scratch-members > div').count(), 6);
  await page.screenshot({ path: join(output, 'small-phone-six-players.png') });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  for (const guest of morePeople) await guest.close();
  const data = await state(),
    db = openDatabase(database),
    token = path.split('/').at(-1);
  data.game.scratch.completed = 900;
  data.game.coins = 1000000;
  for (const skill of SCRATCH_SKILLS) data.game.scratch.skills[skill.id] = 1;
  data.game.scratch.tickets[data.viewerId].claimed = true;
  db.prepare('UPDATE expeditions SET state=? WHERE token=?').run(
    JSON.stringify(data.game),
    token,
  );
  db.close();
  await page.reload();
  await page.locator('.scratch-book-button').click();
  await page.getByRole('button', { name: /^Golden atlas/ }).click();
  await page.getByRole('button', { name: /Next ticket/ }).click();
  await page.locator('.scratch-field-atlas').waitFor();
  for (const [width, height, name] of [
    [1440, 900, 'desktop-golden'],
    [390, 844, 'phone-golden'],
    [320, 568, 'small-phone-golden'],
    [844, 390, 'short-landscape-golden'],
    [667, 375, 'small-landscape-golden'],
  ]) {
    await page.setViewportSize({ width, height });
    await layout(name);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const touch = await context.newCDPSession(page);
  box = await page
    .locator('.scratch-field canvas:not(.scratch-dust)')
    .boundingBox();
  const touchPoint = (x, y) => ({
    x: box.x + box.width * x,
    y: box.y + box.height * y,
    radiusX: 5,
    radiusY: 5,
    force: 0.6,
    id: 1,
  });
  const prior = (await state()).game.scratch.tickets[data.viewerId].sequence;
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(0.1, 0.2)],
  });
  for (let x = 0.12; x < 0.85; x += 0.04)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touchPoint(x, 0.2)],
    });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.waitForFunction(
    async ({ path, prior }) => {
      const s = await (await fetch(path)).json();
      return s.game.scratch.tickets[s.viewerId].sequence > prior;
    },
    { path, prior },
  );
  await page.locator('.scratch-atlas-button').click();
  await page.getByRole('button', { name: 'Golden hands', exact: true }).click();
  await page.screenshot({ path: join(output, 'phone-atlas.png') });
  const vp = await page.locator('.scratch-map-viewport').boundingBox(),
    oldScroll = await page
      .locator('.scratch-map-viewport')
      .evaluate((e) => e.scrollTop);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: vp.x + 40, y: vp.y + vp.height * 0.8, id: 1 }],
  });
  for (let i = 0; i < 10; i++)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: vp.x + 40, y: vp.y + vp.height * (0.8 - i * 0.05), id: 1 },
      ],
    });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  assert.ok(
    (await page.locator('.scratch-map-viewport').evaluate((e) => e.scrollTop)) >
      oldScroll,
    'Touch panning moves the atlas',
  );
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').count(), 0);
  assert.deepEqual(errors, []);
  writeFileSync(
    join(output, 'layout-report.json'),
    JSON.stringify(
      {
        reports,
        checks: [
          'mouse scratching and complete payout',
          'partial foil survives reload',
          'purchase persists',
          'atlas mouse pan and zoom',
          'atlas emulated touch pan',
          'emulated touch scratching',
          'focus restoration',
          'modal Escape',
          'six-player companion dialog with long labels',
          'no console or HTTP errors',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `Relic browser QA passed: ${reports.length} layouts, mouse and emulated touch input, save reload, upgrades, map pan/zoom and focus. Screenshots: ${output}`,
  );
} finally {
  await browser?.close();
  await app.close();
  rmSync(directory, { recursive: true, force: true });
}
