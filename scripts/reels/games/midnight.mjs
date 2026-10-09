/** Yata: a three-seat dish draft at the night market; your seat serves by the driver. */
import { writeFileSync } from 'node:fs';
import { freezeScene, openFromLibrary, trioChrome } from './_trio.mjs';

const PROBE = process.env.REEL_PROBE;
async function shot(page, name) {
  if (!PROBE) return;
  const s = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(
    `${PROBE}/${name}-${page.shape}.png`,
    Buffer.from(s.data, 'base64'),
  );
}

/** The cards and counter keep their full dress: tags, scoring lines and permits. */
export const css = `
  ${trioChrome}
`;
export const warmup = 200;

/** Cards left in your hand. */
const hand = `document.querySelectorAll('.hand button.food-card').length`;

/**
 * One step for seat 0: serve a dish from the hand. While a permit is left,
 * the first serves open a specialty stall, so the counter shows its marks.
 */
const ACT = `(() => {
  if (!document.querySelector('.players.your-turn')) return 'wait';
  const stall = document.querySelector('.extension-action-stall:not(.unavailable):not(.spent)');
  if (stall && window.__reelStalls && !/selected/.test(stall.getAttribute('aria-label') ?? '')) { stall.click(); return 'stall'; }
  const cards = [...document.querySelectorAll('.hand button.food-card:not(.not-playable)')];
  if (!cards.length) return 'wait';
  cards[Math.floor(Math.random() * cards.length)].click();
  return 'serve';
})()`;

export async function prepare(page) {
  await openFromLibrary(page, 'midnight', 'Yata', {
    options: { contentSet: 'beginner', specialtyStalls: true, marketSeasons: true },
    players: 3,
    difficulty: 'medium',
    fastMode: false,
    customerOrders: true,
  });
  await page.eval(`window.__reelStalls = true`);
  await page.sleep(1200);
  // Round one fills the counter (and opens the stalls); filming starts just
  // after your first dish of the last round, so its order is already locked
  // and four more dishes fit before the hand runs out.
  await page.waitUntil(`${hand} > 0`);
  const end = Date.now() + 90000;
  let last = await page.eval(hand);
  let lastRound = false;
  while (Date.now() < end) {
    const now = await page.eval(hand);
    if (now > last) lastRound = true;
    last = now;
    if (lastRound && now <= 5 && (await page.eval(`!!document.querySelector('.players.your-turn')`))) break;
    await page.eval(ACT);
    await page.sleep(300);
  }
  await page.eval(`window.__reelStalls = false; window.__reelDelay = 400`);
  await page.sleep(700);
  await freezeScene(page);
  await shot(page, 'start');
}

export async function drive(page, running) {
  await page.sleep(1200);
  while (running()) {
    const step = await page.eval(ACT);
    await page.sleep(step === 'serve' ? 2200 : 150);
  }
}
