/** Nox: a four-seat trick-taking table, your seat played by the driver. */
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

export const css = `
  ${trioChrome}
  .table-direction-marks, .blackwake-centre, .played-order,
  .table-seat { visibility: hidden !important; }
  /* The die's caption goes, and the cube grows to fill the room it leaves. */
  .die-caption { display: none !important; }
  /* Each seat keeps only its emblem and the points a trick hands it. */
  .table-seat .avatar, .table-seat .capture-score { visibility: visible !important; }
  .hand-confirmation { display: none !important; }
`;
export const wideCss = `
  /* Without the confirm plate the rope tray ends at the cards. */
  .world-table[data-environment='cabin'] .play-area::before { grid-area: 2 / 2 / 3 / 4 !important; margin: 0 -28px 0 -16px !important; }
  .at-table .world-table[data-environment='cabin'] .die-cube-scene { --die-size: 66px !important; }
  .at-table .world-table[data-environment='cabin'] .dice-token { width: 104px !important; padding: 0 !important; }
`;
export const tallCss = `
  /* The die stands on its own, without the plate that held its caption. */
  .at-table .world-table .dice-token { background: none !important; border: 0 !important; box-shadow: none !important; height: auto !important; padding: 0 0 6px 10px !important; }
  html .at-table .world-table[data-environment='cabin'] .die-cube-scene { --die-size: 46px !important; }
`;
export const warmup = 150;

/** One step for seat 0: pick and lock a pass, or play a legal card. */
const ACT = `(() => {
  const confirm = document.querySelector('.hand-confirmation .confirm-action');
  const pieces = [...document.querySelectorAll('.hand button.piece')];
  if (confirm && /^Pass/.test(confirm.textContent)) {
    if (!confirm.disabled) { confirm.click(); return 'pass'; }
    const free = pieces.filter((p) => !p.classList.contains('selected'));
    if (free.length) { free[Math.floor(Math.random() * free.length)].click(); return 'select'; }
    return 'wait';
  }
  if (!document.querySelector('.players.your-turn')) return 'wait';
  const playable = pieces.filter((p) => !p.classList.contains('not-playable'));
  if (!playable.length) return 'wait';
  playable[Math.floor(Math.random() * playable.length)].click();
  return 'play';
})()`;

/** A trick under way: two or three cards down, none being swept away. */
const midTrick = `(() => {
  const cards = document.querySelectorAll('.blackwake-played-card');
  return cards.length >= 2 && cards.length <= 3 && !document.querySelector('.blackwake-played-card.captured');
})()`;

export async function prepare(page) {
  await openFromLibrary(page, 'undertow', 'Nox', {
    options: {},
    players: 4,
    difficulty: 'medium',
    fastMode: false,
  });
  await page.sleep(800);
  // Pass and play a few tricks, so filming opens mid-round on a trick in progress.
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    const hand = await page.eval(
      `document.querySelectorAll('.hand button.piece').length`,
    );
    if (hand <= 14) {
      // From here on the table plays at filming pace.
      await page.eval(`window.__reelDelay = 550`);
      if (await page.eval(midTrick)) break;
    }
    await page.eval(ACT);
    await page.sleep(250);
  }
  await freezeScene(page);
  await shot(page, 'start');
}

export async function drive(page, running) {
  while (running()) {
    // A short think before each of your plays, like a person at the table.
    await page.sleep(700);
    if (running()) await page.eval(ACT);
  }
}
