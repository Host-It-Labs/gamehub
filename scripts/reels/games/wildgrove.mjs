/**
 * Mora: a three-seat creature draft; your seat picks and places by the driver.
 * One short scene per board (Observatory, Floodline Station, Sunset Motel,
 * Glacier Dam), each opening late in a match on a well-filled board.
 */
import { writeFileSync } from 'node:fs';
import { openFromLibrary, trioChrome } from './_trio.mjs';

const PROBE = process.env.REEL_PROBE;
async function shot(page, name) {
  if (!PROBE) return;
  const s = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(
    `${PROBE}/${name}-${page.shape}.png`,
    Buffer.from(s.data, 'base64'),
  );
}

/** Four detailed painted boards in one clip compress poorly: a little more
 * compression keeps the 1080p clip inside the library's size budget. */
export const crf = { wide: 28, tall: 28 };
export const css = `
  ${trioChrome}
  .mora-ground-label, .mora-trash > span, .observatory-achievements { visibility: hidden !important; }
  /* The die's caption goes, and the cube grows into the tag it leaves. */
  .die-caption { display: none !important; }
  .at-table .table-layout[data-environment='observatory'] .dice-token { justify-content: center !important; padding: 0 !important; }
  .at-table .table-layout[data-environment='observatory'] .dice-token.die-exempt .die-display { opacity: 1 !important; filter: none !important; }
  .at-table .table-layout[data-environment='observatory'] .dice-token > .player-status-icons,
  .at-table .table-layout[data-environment='observatory'] .dice-token > .turn-roller { display: none !important; }
`;
export const wideCss = `
  .at-table .table-layout[data-environment='observatory'] .die-cube-scene { --die-size: 50px !important; }
`;
export const tallCss = `
  .at-table .table-layout[data-environment='observatory'] .die-cube-scene { --die-size: 34px !important; }
`;
export const warmup = 200;
/** Filmed 2× slow so its motion stays smooth on a loaded Mac (see record.mjs). */
export const slow = 2;

/** Habitat spaces on the board, and how many hold a creature. */
const fill = `(() => {
  const nests = document.querySelectorAll('.mora-board .mora-nest');
  return { total: nests.length, taken: document.querySelectorAll('.mora-board .mora-nest.occupied').length };
})()`;

/**
 * Your turn with nothing picked yet and three or more creatures in the tray,
 * so the round cannot end (and blur into its summary) while filming.
 */
const ready = `!!document.querySelector('.players.your-turn') &&
  document.querySelectorAll('.hand button.creature-piece:not(.selected)').length >= 3 &&
  !document.querySelector('.hand button.creature-piece.selected')`;

/**
 * One step for seat 0: pick a creature from the tray, or set the picked one
 * down in a habitat that takes it (or release it when none does).
 */
const ACT = `(() => {
  if (!document.querySelector('.players.your-turn')) return 'wait';
  const legal = [...document.querySelectorAll('.mora-habitat.legal-region button.piece')];
  const picked = document.querySelector('.hand button.creature-piece.selected');
  if (picked) {
    if (legal.length) { legal[Math.floor(Math.random() * legal.length)].click(); return 'place'; }
    const trash = document.querySelector('.mora-trash');
    if (trash) { trash.click(); return 'release'; }
    return 'wait';
  }
  const tray = [...document.querySelectorAll('.hand button.creature-piece')];
  if (!tray.length) return 'wait';
  tray[Math.floor(Math.random() * tray.length)].click();
  return 'pick';
})()`;

/** Plays at full speed until the board is about this full, then waits for your turn. */
const board = (contentSet, share) => async (page) => {
  await openFromLibrary(page, 'wildgrove', 'Mora', {
    options: { contentSet },
    players: 3,
    difficulty: 'medium',
    fastMode: false,
  });
  await page.sleep(1200);
  const end = Date.now() + 150000;
  let state = await page.eval(fill);
  while (Date.now() < end) {
    state = await page.eval(fill);
    if (state.total && state.taken >= Math.round(state.total * share) && (await page.eval(ready)))
      break;
    await page.eval(ACT);
    await page.sleep(220);
  }
  const tray = await page.eval(`document.querySelectorAll('.hand button.creature-piece').length`);
  console.log(`  ${contentSet}: ${state.taken} of ${state.total} spaces filled, ${tray} in the tray`);
  await page.eval(`window.__reelDelay = 400`);
  await shot(page, contentSet);
};

async function drive(page, running) {
  await page.sleep(300);
  while (running()) {
    // Pick, hold it a beat so the eye follows, then set it down.
    const step = await page.eval(ACT);
    await page.sleep(step === 'pick' ? 650 : step === 'wait' ? 150 : 700);
  }
}

export const scenes = [
  { prepare: board('beginner', 0.5), drive, seconds: 4.2 },
  { prepare: board('intermediate', 0.6), drive, seconds: 4.2 },
  { prepare: board('desert', 0.6), drive, seconds: 4.2 },
  { prepare: board('alpine', 0.6), drive, seconds: 4.2 },
];
