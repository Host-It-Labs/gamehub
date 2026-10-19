/**
 * Alto: a three-captain table in its second year, the first year's ship parts
 * fitted at level I and cargo ready for level II refits. The deck stays,
 * simplified to your ship and base bays and the shop (each upgrade's model, name and price). Each
 * turn you pick an upgrade from the shop, then send your ship to the next
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
  .alto-dock-row, .alto-orders, .alto-preview-label, .alto-shelf-label,
  .alto-shop-controls, .alto-level, .alto-family,
  .alto-effects, .alto-item-seal, .alto-item-choice { display: none !important; }
  .alto-shop-catalogue { padding-top: 0 !important; }
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
/** Film 3D at eight times slower and restore the game's real speed. */
export const slow = 8;
/** It never stops moving, so a choppier take is filmed again. */
export const minFps = 55;
export const seconds = 12;

export async function prepare(page) {
  await page.goto(
    '/alto/lab?table&seats=3&year=2&built=rigging,sawmill,mason,fold,kite,pier,post&level=1',
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
  list[${n} % list.length].click();
  return true;
})()`;

const fly = (n) => `(() => {
  const planets = [...document.querySelectorAll('.alto-planet-button')];
  if (!planets.length) return false;
  planets[${n} % planets.length].click();
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
    // The catalogue stays in use across years: browse its two families.
    await page
      .eval(`(() => {
      const tabs = [...document.querySelectorAll('.alto-shop-tabs button')];
      const tab = tabs[${turn} % 2];
      if (tab && !tab.disabled) tab.click();
    })()`)
      .catch(() => {});
    await page.sleep(120);
    // Let the chosen upgrade glow in the shop before the ship lifts off.
    if (await page.eval(shop(turn)).catch(() => false)) await page.sleep(1000);
    await page.eval(fly(turn)).catch(() => false);
    turn++;
    await page.sleep(600);
  }
}
