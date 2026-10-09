/** Arena: a 1 v 1 Versus battle, your seat played by the game's own bot. */
export const css = `
  .arena-top, .arena-ready, .arena-peek, .arena-results, .arena-modal,
  .arena-dock { visibility: hidden !important; }
`;
/** The swaying grass field is fine detail in every frame: a little more
 * compression keeps the 1080p clip inside the library's size budget. */
export const crf = { wide: 29, tall: 29 };
export const warmup = 9000;
/** A busy canvas only screencasts a few full-HD frames a second on a loaded
 * Mac: film it 3× slow so the clip stays smooth (see record.mjs). */
export const slow = 3;
/** It never stops moving, so a choppier take is filmed again. */
export const minFps = 24;

export async function prepare(page) {
  await page.goto('/');
  await page.eval(`(() => {
    localStorage.setItem('gamehub.arena.kind', 'versus');
    localStorage.setItem('gamehub.arena.mode', 'duel');
    localStorage.setItem('gamehub.arena.difficulty', 'hard');
    localStorage.setItem('gamehub.arena.draft', 'off');
  })()`);
  await page.goto('/arena');
  await page.waitFor('.play-plate[data-starts-game]');
  await page.click('.play-plate[data-starts-game]');
  await page.waitFor('.arena-pick-ready[data-starts-game]', 90000);
  await page.click('.arena-pick-ready[data-starts-game]');
  await page.waitFor(
    '.arena-game:not([data-phase="loading"]):not([data-phase="ready"])',
    30000,
  );
  await page.waitUntil('!!window.arenaDebug?.session');
  // Your seat plays like a hard bot, so both sides keep sending troops.
  await page.eval(`(async () => {
    const { botMemory, botStep } = await import('/lib/games/arena/bot.ts');
    const memory = botMemory(0, 'hard', 1);
    // Three times the elixir on both sides: a full clash inside ten seconds.
    for (const player of window.arenaDebug.session.match.players) {
      player.boost.elixirRate = 3;
      player.elixir = 10;
    }
    window.__reelTimer = setInterval(() => {
      const session = window.arenaDebug?.session;
      if (!session) return;
      const move = botStep(session.match, memory);
      if (move) session.play(move.slot, move.x, move.y);
    }, 60);
  })()`);
}
