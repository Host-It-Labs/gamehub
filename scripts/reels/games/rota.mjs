/**
 * Rota: the mill town on the default map (Meadow, no extensions: no water),
 * well grown after five of its seven rounds and growing a sixth on camera
 * while its traffic runs through the junctions and calls at the stations.
 * The rounds are played by the game's own bot. It stops short of the last
 * round: a finished match fills every empty square with houses.
 */
export const css = `
  .rota-players, .rota-notice, .rota-side, .rota-dock, .rota-results,
  .rota-coach, .rota-drag, .rota-modal, .rota-cells-3d, .rota-loading,
  .table-manager { display: none !important; }
  main.rota-world.rota-world { --top: 0px; --dock: 0px; --side: 0px; --strip: 0px; }
`;
/** On the desktop screen, a little closer, so the traffic reads at card
 * size: the board is fitted to the whole screen, not the middle column. */
export const wideCss = `
  main.rota-world .rota-stage {
    top: 14px; bottom: 14px; padding: 0; gap: 0;
    grid-template-columns: 0 minmax(0, 1fr) 0;
  }
`;
export const warmup = 6000;
/** A busy canvas only screencasts a few full-HD frames a second on a loaded
 * Mac: film it 3× slow so the clip stays smooth (see record.mjs). */
export const slow = 3;
/** It never stops moving, so a choppier take is filmed again. */
export const minFps = 24;

export async function prepare(page) {
  await page.goto('/rota/lab?map=meadow&rounds=5&ext=&seats=1&seed=202');
  await page.waitFor('canvas.rota-canvas[data-ready]', 90000);
  await page.waitUntil('!!window.rotaWorld && !!window.rotaLab', 30000);
  // Steady quality, and only the town itself: no open-end rings, aim
  // highlights or ghost pieces from the interface.
  await page.eval(`(() => {
    const w = window.rotaWorld;
    w.quality.sample = () => false;
    w.loose.visible = false;
    w.ghost.visible = false;
    const setView = w.setView.bind(w);
    w.setView = (v) => setView({ ...v, loose: [], targets: undefined, turnable: undefined, ghost: null });
  })()`);
  await page.sleep(1500);
}

export async function drive(page, running) {
  // Drive starts before the warmup: the new round lands three seconds into
  // the clip, once the streets have filled.
  await page.sleep(warmup + 3000);
  if (running()) await page.eval('window.rotaLab.auto()');
}
