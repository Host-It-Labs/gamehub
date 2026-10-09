/**
 * Diner: free play's level 20 (Fireworks, the fairground boss), over a minute
 * in so the patio is busy, with your waiter run by the game's own bot:
 * seating guests, taking orders, cooking at the kitchen hatch and serving.
 * With the HUD gone the deck frames itself into the whole screen; the tall
 * clip looks closer at the left half of the deck (the game itself plays
 * sideways on phones).
 */
export const css = `
  .diner-top, .diner-badges, .diner-pad, .diner-countdown, .diner-plate-wrap,
  .diner-modal, .table-manager, .diner-coin-fly, .rotate-to-landscape,
  .rotate-to-portrait,
  [role="dialog"], [data-radix-popper-content-wrapper] { display: none !important; }
`;
export const warmup = 2500;
/** A busy canvas only screencasts a few full-HD frames a second on a loaded
 * Mac: film it 3× slow so the clip stays smooth (see record.mjs). */
export const slow = 3;
/** It never stops moving, so a choppier take is filmed again. */
export const minFps = 24;

/** Seconds of the shift played out before filming, so the patio is full. */
const AHEAD = 70;
const LEVEL = 20;

export async function prepare(page) {
  await page.goto('/diner');
  // Every level open, so the reel can film a busy one.
  await page.eval(
    `localStorage.setItem('gamehub.diner.levels.v1', JSON.stringify({ medals: Array(40).fill(1), best: Array(40).fill(0), last: ${LEVEL} }))`,
  );
  await page.goto('/diner');
  await page.waitFor('[aria-label="Diner mode"] label.seg-option', 60000);
  await page.eval(`(() => {
    const levels = [...document.querySelectorAll('[aria-label="Diner mode"] label.seg-option')]
      .find((l) => /levels/i.test(l.textContent));
    levels?.click();
  })()`);
  await page.sleep(300);
  await page.click('button.play-plate');
  await page.waitFor('.diner-level-tile[data-open="true"]', 60000);
  await page.eval(
    `[...document.querySelectorAll('.diner-level-tile')].find((b) => b.querySelector('b')?.textContent === '${LEVEL}')?.click()`,
  );
  await page.waitFor(
    '.diner-plate.intro button.diner-button[data-starts-game]',
    90000,
  );
  await page.waitUntil('!!window.dinerDebug?.session', 30000);
  // Your waiter plays like the bot, tick for tick, inside the game's own loop.
  await page.eval(`(async () => {
    const { botInput, botMemory } = await import('/lib/games/diner/bot.ts');
    const { step, TICK } = await import('/lib/games/diner/engine.ts');
    const session = window.dinerDebug.session;
    const memory = botMemory();
    const tick = (keep) => {
      const input = botInput(session.match, 0, memory);
      step(session.match, [input]);
      const events = session.match.events.splice(0);
      if (keep && events.length) session.events.push(...events);
    };
    window.__reelAhead = 0;
    session.advance = function (dt, paused, c) {
      c.use = false;
      c.out = false;
      if (paused) return 1;
      // Once: play the opening of the shift out at once, quietly.
      for (; window.__reelAhead > 0; window.__reelAhead--) tick(false);
      this.acc = Math.min(this.acc + dt, TICK * 6);
      while (this.acc >= TICK) {
        this.acc -= TICK;
        tick(true);
      }
      return this.acc / TICK;
    };
  })()`);
  await page.click('.diner-plate.intro button.diner-button[data-starts-game]');
  await page.waitUntil(
    'window.dinerDebug.session.match.phase === "open" && !window.dinerDebug.session.match.countdown',
    30000,
  );
  await page.eval(`window.__reelAhead = ${AHEAD * 30}`);
  await page.waitUntil('window.__reelAhead === 0', 10000);
  // No HUD to make room for. Tall: a closer look at the middle of the deck.
  await page.eval(`(() => {
    const stage = document.querySelector('.diner-stage')?.getBoundingClientRect();
    const width = stage?.width ?? innerWidth;
    const height = stage?.height ?? innerHeight;
    const tall = ${page.shape === 'tall'};
    window.dinerDebug.view.resize({
      width,
      height,
      top: tall ? height * 0.12 : 10,
      bottom: tall ? height * 0.12 : 10,
      // Tall: the line, its nearest booths and the grill in the middle.
      left: tall ? -width * 0.02 : 6,
      right: tall ? -width * 1.48 : 6,
    });
  })()`);
}
