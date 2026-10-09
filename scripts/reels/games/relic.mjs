/**
 * Lucky: one Lucky Seven ticket scratched by hand on the felt stage. A couple
 * of misses show their arrows, then the sevens are found, the rest of the
 * ticket scratches itself and it pays.
 */
export const css = `
  header.rs-top, .rs-shelf, .rs-lives, .rs-again, .rs-level-badge,
  .rs-star-badge, .rs-modal, [role="dialog"], .rs-guide, .rs-guide-toggle { visibility: hidden !important; }
  .rs-shelf { display: none !important; }
  .rs-stage { top: 14px !important; }
  .rs-desk { grid-template-columns: minmax(0, 1fr) !important; grid-template-rows: minmax(0, 1fr) !important; }
  .rs-hand { grid-column: 1 !important; grid-row: 1 !important; }
  .rs-payout-chips, .rs-net { display: none !important; }
  /* A pixel that never stops changing, so the screencast films a still end too. */
  body::after { content: ''; position: fixed; left: 0; top: 0; width: 2px; height: 2px; z-index: 99999;
    pointer-events: none; background: rgb(0 0 0 / 0.01); animation: reel-beat 0.2s steps(2) infinite; }
  @keyframes reel-beat { to { background: rgb(0 0 0 / 0.02); } }
`;
/** The ticket in the middle, its payout beside it. */
export const wideCss = `
  .rs-hand { --rail: 0px !important; }
  .rs-hand-rail { position: absolute !important; left: calc(50% + 250px); top: 50%; width: 220px; transform: translateY(-50%); }
`;
/** The payout centred beneath the ticket. */
export const tallCss = `
  .rs-again { display: none !important; }
  .rs-hand-rail > .rs-payout { flex: 0 1 72%; }
`;
export const warmup = 1200;
/** A busy canvas only screencasts a few full-HD frames a second on a loaded
 * Mac: film it 3× slow so the clip stays smooth (see record.mjs). */
export const slow = 3;
/** It never stops moving, so a choppier take is filmed again. */
export const minFps = 24;

let token;
let ticket;

export async function prepare(page) {
  await page.goto('/');
  const view = await page.eval(`fetch('/api/expeditions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rec', title: 'Rec', world: 'dunes', devPreset: 'workshop' }),
  }).then((r) => r.json())`);
  token = view.token;
  await page.eval(`(() => {
    localStorage.setItem('gamehub-relic-tab', 'tickets');
    localStorage.setItem('gamehub-lucky-book', 'seven');
  })()`);
  await page.goto(`/expedition/${token}`);
  await page.waitFor('.rs-desk button.rs-again:not(:disabled)', 30000);
  await page.sleep(600);
  await page.click('button.rs-again:not(:disabled)');
  await page.waitFor('.rs-hand canvas[role="application"]', 15000);
  ticket =
    await page.eval(`fetch('/api/expeditions/${token}').then((r) => r.json()).then((v) => {
    const hands = v.game.scratch?.hands ?? {};
    return hands[v.viewerId] ?? Object.values(hands)[0];
  })`);
  if (!ticket?.cells) throw new Error('no ticket in hand');
  await page.sleep(700);
  // The first miss is open before filming, so the still already shows play.
  const [first, ...rest] = plan(ticket);
  order = rest;
  await scratch(page, first);
}

let order = [];
/** Two misses near the middle (their arrows point the way), then the sevens. */
function plan({ cols, rows, cells }) {
  const sevens = cells.flatMap((c, i) => (c.face === 'seven' ? [i] : []));
  const misses = cells.flatMap((c, i) =>
    c.face !== 'seven' && !c.revealed ? [i] : [],
  );
  const middle = (i) =>
    Math.hypot((i % cols) - cols / 2, Math.floor(i / cols) - rows / 2);
  const opening = misses.sort((a, b) => middle(a) - middle(b)).slice(0, 2);
  return [opening[0], sevens[0], opening[1], ...sevens.slice(1)];
}

async function scratch(page, index) {
  const box = await page.eval(`(() => {
    const r = document.querySelector('.rs-hand canvas[role="application"]').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  await page.drag(rub(box, ticket.cols, ticket.rows, index), 14);
}

/** A zigzag of rubs over one seal, in CSS pixels. */
function rub(box, cols, rows, index) {
  const cw = box.w / cols,
    ch = box.h / rows;
  const x0 = box.x + (index % cols) * cw,
    y0 = box.y + Math.floor(index / cols) * ch;
  const points = [];
  const passes = 4;
  for (let k = 0; k <= passes; k++) {
    const y = y0 + ch * (0.18 + (0.64 * k) / passes);
    const [a, b] = k % 2 ? [0.84, 0.16] : [0.16, 0.84];
    for (let s = 0; s <= 6; s++)
      points.push({ x: x0 + cw * (a + ((b - a) * s) / 6), y });
  }
  return points;
}

export async function drive(page, running) {
  for (const index of order) {
    if (!running()) return;
    await page.sleep(850);
    await scratch(page, index);
  }
}
