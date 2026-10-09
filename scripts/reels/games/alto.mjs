/**
 * Alto: a three-captain table in its second year, the first year's upgrades
 * built and the hold full of cargo. The deck stays, simplified to your ship
 * and base bays and the shop (each upgrade's model, name and price). Each
 * turn you pick an upgrade from the shop, then send your ship to a random
 * planet; the bots answer at once, the ships fly the reveal and the upgrade
 * lands on your ship or base.
 */
export const css = `
  .alto-players, .alto-notice, .alto-banner, .alto-coach, .alto-captains,
  .alto-finale, .alto-dialog, .alto-lab-bar, .alto-pile, .alto-comet,
  .alto-flags, .alto-arrivals, .alto-base-tag, .alto-base-built,
  .table-manager, [role="dialog"], [data-radix-popper-content-wrapper],
  /* The deck, simplified: no cargo counts, owned lists, buttons or orders,
     no labels or rule lines; the shop keeps its models, names and prices. */
  .alto-dock-row, .alto-orders, .alto-preview-label, .alto-shelf-label span,
  .alto-effects, .alto-item-seal, .alto-item-choice { display: none !important; }
  .alto-dock { grid-template-areas: 'home shop' !important; grid-template-rows: auto !important; }
  /* With the badges gone, the planets take the sky down to the deck. */
  main.alto-world { --stage-top: 24px !important; }
`;
/** On a phone the two bays sit side by side above the shop. */
export const tallCss = `
  .alto-dock { grid-template-columns: minmax(0, 1fr) !important; grid-template-areas: 'home' 'shop' !important; }
  .alto-home:has(.alto-preview), .alto-preview { min-height: 66px !important; }
`;
export const warmup = 1500;
/** A busy canvas only screencasts a few full-HD frames a second on a loaded
 * Mac: film it 3× slow so the clip stays smooth (see record.mjs). */
export const slow = 3;
/** It never stops moving, so a choppier take is filmed again. */
export const minFps = 24;
export const seconds = 12;

export async function prepare(page) {
  await page.goto(
    '/alto/lab?table&seats=3&year=2&built=rigging,sawmill,mason,fold,shrine,kite,pier,beacon,post',
  );
  await page.waitFor('main.alto-world:not([data-loading])[data-3d]', 90000);
  await page.sleep(1500);
}

/** Whether the table waits on you, with the last reveal flown home. */
const ready = `(() => {
  const world = document.querySelector('main.alto-world');
  if (!world || world.dataset.locked || world.dataset.phase !== 'plan') return false;
  if (document.querySelector('.alto-arrivals, .alto-home[data-away]')) return false;
  return document.querySelectorAll('.alto-planet-button').length > 0;
})()`;

/** Picks an upgrade you can afford, ship parts and base modules in turn. */
const shop = (n) => `(() => {
  const items = [...document.querySelectorAll('.alto-item.is-ready:not(.is-picked)')];
  if (!items.length) return false;
  const family = ${n} % 2 ? 'is-base' : 'is-ship';
  const pool = items.filter((el) => el.classList.contains(family));
  const list = pool.length ? pool : items;
  list[Math.floor(Math.random() * list.length)].click();
  return true;
})()`;

const fly = `(() => {
  const planets = [...document.querySelectorAll('.alto-planet-button')];
  if (!planets.length) return false;
  planets[Math.floor(Math.random() * planets.length)].click();
  return true;
})()`;

export async function drive(page, running) {
  // The clip opens on the ships at home; the first purchase follows shortly.
  await page.sleep(warmup + 400);
  let turn = 0;
  while (running()) {
    if (!(await page.eval(ready).catch(() => false))) {
      await page.sleep(150);
      continue;
    }
    // Let the chosen upgrade glow in the shop before the ship lifts off.
    if (await page.eval(shop(turn)).catch(() => false)) await page.sleep(1000);
    await page.eval(fly).catch(() => false);
    turn++;
    await page.sleep(600);
  }
}
