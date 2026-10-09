/** Shared pieces of the Nox, Mora and Yata reel drivers (not a game itself). */

/**
 * The screencast sends a frame only when the page repaints, and the painted
 * scenes behind Nox and Yata redraw at 20 Hz by design, so a quiet table would
 * film at 20 fps. A two-pixel corner whose faint colour drifts every frame
 * keeps the capture at the display rate; it never shows.
 */
export const steadyFrames = `
  html::after {
    content: ''; position: fixed; z-index: 2147483647; left: 0; top: 0;
    width: 2px; height: 2px; pointer-events: none;
    animation: reel-tick 4s linear infinite alternate;
  }
  @keyframes reel-tick {
    from { background: rgba(0, 0, 0, 0.02); }
    to { background: rgba(255, 255, 255, 0.02); }
  }
`;

/**
 * Bots answer through a worker in about a tenth of a second; on film that
 * reads as a blur. Hold each reply back a little (under the game's own four
 * second watchdog), so every card lands on its own beat. Drivers set the
 * hold with window.__reelDelay (ms, none by default).
 */
export const slowBots = (page) =>
  page.eval(`(() => {
    if (window.__reelWorker) return;
    const Base = window.Worker;
    window.__reelWorker = true;
    window.Worker = class extends Base {
      set onmessage(fn) {
        super.onmessage = fn ? (e) => setTimeout(() => fn(e), (window.__reelDelay ?? 0) * (0.7 + Math.random() * 0.6)) : fn;
      }
      get onmessage() { return super.onmessage; }
    };
  })()`);

/**
 * The painted scene behind Nox and Yata redraws its shimmer and lantern glow
 * by hand at 20 Hz, and each redraw costs the page most of a frame, so the
 * capture falls to about 24 fps once cards start moving. Freezing that canvas
 * on its current picture (tint and all) lets the cards move at full rate;
 * only the faint ripple of the backdrop is lost.
 */
export const freezeScene = (page) =>
  page.eval(`(() => {
    const proto = CanvasRenderingContext2D.prototype;
    for (const canvas of document.querySelectorAll('.world-scene canvas.paper-world-canvas.scene-ready')) {
      const ctx = canvas.getContext('2d');
      for (const name of Object.getOwnPropertyNames(proto)) {
        const value = Object.getOwnPropertyDescriptor(proto, name).value;
        if (typeof value !== 'function' || name === 'constructor') continue;
        ctx[name] = name.startsWith('create') ? () => ({ addColorStop() {} }) : () => {};
      }
    }
    return document.querySelectorAll('.world-scene canvas.scene-ready').length;
  })()`);

/** Opens a trio game from the library with a saved setup. */
export async function openFromLibrary(page, id, name, setup) {
  await page.goto('/');
  await page.eval(
    `localStorage.setItem('gamehub.setup.${id}.v1', ${JSON.stringify(JSON.stringify(setup))})`,
  );
  await page.goto('/');
  await slowBots(page);
  await page.waitFor(`.lib-tile-button[aria-label^="${name}."]`);
  await page.click(`.lib-tile-button[aria-label^="${name}."]`);
  await page.waitFor('.setup-modal .play-plate[data-starts-game]');
  await page.click('.setup-modal .play-plate[data-starts-game]');
  await page.waitFor('.table-layout');
  await page.waitUntil('!document.querySelector(".artwork-loading")', 30000);
}

/** Chrome every trio table shares. */
export const trioChrome = `
  ${steadyFrames}
  .app-header, .table-toolbar, .table-players, .activity-sidebar, .notice,
  .results-button, .results, .inspector, .help-modal, .undo-choice,
  .coach { visibility: hidden !important; }
`;
