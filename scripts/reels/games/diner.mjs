/**
 * Diner: ten seconds of quick cuts, six shots of different things you do on
 * the patio at six stops of the night: seating a party, the kitchen hatch,
 * serving, clearing and washing, then what a run unlocks (roller skates,
 * mimics and Out!, brownouts, the jukebox). See SHOTS below.
 *
 * Every shot is a real level played by the game's own bot (`botInput`, tick
 * for tick through the engine, at the game's speed) from a fixed seed, so
 * both shapes and every take show the same shift. Each shot's level, seed
 * and opening tick were found by playing the seeded levels out in Node and
 * picking the busiest moment where the shot's action lands inside it. Each
 * shot is its own scene (a fresh page) and the scenes are joined with hard
 * cuts (`cut`). The camera is the game's own (`fitDinerCamera`), with only
 * the room the hidden interface kept given back to the deck.
 */
export const css = `
  .diner-top, .diner-badges, .diner-pad, .diner-countdown, .diner-plate-wrap,
  .diner-modal, .table-manager, .diner-coin-fly, .rotate-to-landscape,
  .rotate-to-portrait,
  [role="dialog"], [data-radix-popper-content-wrapper] { display: none !important; }
`;
/** Diner plays sideways on phones: the tall clip is the game exactly as a
 * phone turned on its side shows it (a 693×390 landscape screen, the
 * phone's own framing), turned a quarter clockwise to fill the upright
 * frame. Upright, the game's own camera fits the 15 m deck across the
 * phone's width: a thin band of patio under bubbles sized for a sideways
 * screen, with car park above and below. */
export const tallCss = `
  .diner-game.diner-game {
    inset: auto; left: 0; top: 0; width: 100vh; height: 100vw;
    transform-origin: 0 0; transform: translateX(100vw) rotate(90deg);
  }
`;
/** Game milliseconds each shot plays (already in motion) before filming. */
export const warmup = 1500;
/** Filmed 8× slow, as every 3D game: Chrome screencasts about 20 full-HD
 * frames a real second of this canvas, so each of the clip's 60 a second
 * is new. */
export const slow = 8;
/** It never stops moving, so a take short of 55 new frames a second is
 * filmed again, slower (see record.mjs). */
export const minFps = 55;
/** A flat-shaded deck compresses well: crf 26 keeps the planks and faces
 * crisp at about the old clip's size (crf 30 made 1.5 MB masters). */
export const crf = { wide: 26, tall: 26 };
/** Shots joined with hard cuts, not crossfades. */
export const cut = true;

/**
 * The shots, in order, each 1⅔ s: the night's basics, then what a run
 * unlocks. `level` is the free-play level (its place, kit and trouble),
 * `seed` the shift's seed and `at` the engine tick the shot opens on; the
 * times are when the action lands in the shot (the take logs them).
 */
const SHOTS = [
  // Truck stop (level 31): a party of three follows you in a conga line
  // past the booths and sits down (0.9 s) as a new party comes in.
  { name: 'seat', level: 31, seed: 36, at: 2383 },
  // Drive-in (level 32): along the kitchen hatch, a milkshake (0.7 s) and
  // fries (1.2 s) taken from their machines, both carried away.
  { name: 'kitchen', level: 32, seed: 8, at: 2506 },
  // Fairground (level 39): two slices of pie served at a full booth (0.8,
  // 0.9 s), the order bubble ticking off.
  { name: 'serve', level: 39, seed: 20, at: 2260 },
  // Harbour (level 25): dirty plates and coins cleared from a booth (0.2 s),
  // a dash on roller skates and a wash at the sink (1.0 s).
  { name: 'wash', level: 25, seed: 28, at: 3181 },
  // Drive-in at night (level 38): Out! on the odd one in a waiting party,
  // a mimic, who pops into purple goo (0.9 s) and flees out of the gate.
  { name: 'mimic', level: 38, seed: 40, at: 2680 },
  // Moon Mile (level 40, the last): a dash across the patio, a brownout
  // dims the kitchen (0.7 s) and the jukebox plays (0.9 s).
  { name: 'jukebox', level: 40, seed: 4, at: 4179 },
].map((shot) => ({ seconds: 10 / 6, ...shot }));

/** The same people, steam and sparks on every take: the page's random
 * numbers are seeded before anything runs. */
const SEEDED = `(() => {
  let a = 0x51ed2701;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

async function prepare(page, shot) {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: SEEDED });
  // The same detailed models on both shapes (a phone-sized screen would
  // otherwise get the lighter cut).
  await page.goto(`/diner/lab?scene=shift&level=${shot.level}&power=high`);
  await page.waitFor(
    '.diner-plate.intro button.diner-button[data-starts-game]',
    90000,
  );
  await page.waitUntil('!!window.dinerDebug?.session', 30000);
  await page.eval(`(async () => {
    const E = await import('/lib/games/diner/engine.ts');
    const { levelConfig } = await import('/lib/games/diner/levels.ts');
    const { botInput, botMemory } = await import('/lib/games/diner/bot.ts');
    const { Pacer } = await import('/components/game/render-pacer.ts');
    // Full quality on every frame: the pacer neither skips frames nor steps
    // down (the slowed page reads as a very fast screen).
    Pacer.prototype.frame = () => true;
    const { session, view } = window.dinerDebug;
    view.setRung({ resolution: 1, shadowEvery: 1, shadowSize: 2048 });
    // The interface is hidden: give its room back to the deck. The camera
    // and its fit are the game's own.
    // Its size is the stage's own (untransformed: the tall clip turns it).
    const stage = document.querySelector('.diner-stage');
    const resize = view.resize.bind(view);
    view.resize = () =>
      resize({
        width: stage.offsetWidth,
        height: stage.offsetHeight,
        top: 10,
        bottom: 10,
        left: 6,
        right: 6,
      });
    view.resize();

    // The shift, played by the bot up to the warmup before the shot.
    const m = E.createConfiguredMatch(${shot.seed}, levelConfig(${shot.level}), ['You']);
    E.open(m);
    const memory = botMemory();
    const from = ${shot.at} - Math.round(${warmup / 1000} * E.HZ);
    while (m.tick < from) {
      E.step(m, [botInput(m, 0, memory)]);
      m.events.length = 0;
    }
    session.match = m;
    window.__reelGo = false;
    window.__reelLog = [];
    session.advance = function (dt, paused, c) {
      c.use = c.out = c.dash = false;
      if (paused || !window.__reelGo) return 1;
      this.acc = Math.min(this.acc + dt, E.TICK * 6);
      while (this.acc >= E.TICK) {
        this.acc -= E.TICK;
        E.step(m, [botInput(m, 0, memory)]);
        const events = m.events.splice(0);
        if (events.length) this.events.push(...events);
        for (const e of events)
          if (!['bell', 'ready', 'smoke', 'arrive', 'eat', 'impatient'].includes(e.type))
            window.__reelLog.push({ tick: m.tick, type: e.type, station: e.station });
        if (m.tick % 15 === 0)
          window.__reelLog.push({ tick: m.tick, real: window.__reelReal?.() ?? 0 });
      }
      return this.acc / E.TICK;
    };
  })()`);
  await page.click('.diner-plate.intro button.diner-button[data-starts-game]');
  await page.sleep(800);
}

/** Starts the shift moving (filming begins `warmup` game ms later), then
 * logs what the waiter did in the shot and checks the engine kept the
 * game's speed (30 ticks a game second). */
async function drive(page, running, shot) {
  await page.eval('window.__reelGo = true');
  while (running()) await page.sleep(250);
  const log = await page.eval('window.__reelLog');
  const end = shot.at + Math.round(shot.seconds * 30);
  const acts = log.filter((e) => e.type && e.tick > shot.at && e.tick <= end);
  console.log(
    `  ${shot.name}: ${acts.map((e) => `${e.type}${e.station ? `:${e.station}` : ''} ${((e.tick - shot.at) / 30).toFixed(2)} s`).join(', ')}`,
  );
  const clock = log.filter((e) => e.real && e.tick >= shot.at - 15 && e.tick <= end);
  const [first, last] = [clock[0], clock.at(-1)];
  if (first && last && last !== first)
    console.log(
      `  engine: ${((last.tick - first.tick) / 30).toFixed(2)} game s in ${((last.real - first.real) / 1000).toFixed(2)} real s (${page.slow}× slow → ${(((last.tick - first.tick) / 30) * page.slow * 1000 / (last.real - first.real)).toFixed(3)}× speed)`,
    );
}

export const scenes = SHOTS.map((shot) => ({
  seconds: shot.seconds,
  prepare: (page) => prepare(page, shot),
  drive: (page, running) => drive(page, running, shot),
}));
