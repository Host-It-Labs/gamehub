/**
 * Arena: a 1 v 1 Versus battle on the game's own camera, staged so the ten
 * seconds always tell the same story. It opens calm with a few red troops
 * already marching down one lane; blue answers within a second, the other
 * lane wakes, and both sides keep dropping cards until two battles rage at
 * both bridges at once, a Meteor crashing into each. The bots are switched
 * off and every card is played through the real engine (`deploy`, so drops
 * look as in play) on a fixed schedule of match ticks.
 */
export const css = `
  .arena-top, .arena-ready, .arena-peek, .arena-results, .arena-modal,
  .arena-dock { visibility: hidden !important; }
`;
/** The swaying grass field and a crowd of figures are fine detail in every
 * frame: a little more compression keeps the clip inside the size budget. */
export const crf = { wide: 30, tall: 30 };
/** Game milliseconds between the staging starting and filming. */
export const warmup = 3000;
export const seconds = 10;
/** Filmed 8× slow: Chrome screencasts about 20 full-HD frames a real second
 * of this canvas, so every one of the clip's 60 frames a second is new. */
export const slow = 8;
/** It never stops moving, so a take short of 55 new frames a second is
 * filmed again, slower (see record.mjs). */
export const minFps = 55;

/**
 * The schedule, in seconds of the clip (negative ones play during the
 * warmup). Field coordinates: 18 wide, 32 long; blue (seat 0) plays from
 * y 0, red (seat 1) from y 32; the river runs from y 15 to 17 with bridges
 * at x 3.5 (lane A) and x 14.5 (lane B). Blue drops on y ≤ 14.5, red on
 * y ≥ 17.5. `walk` puts a troop down already walking (no drop), for those
 * on their way when the clip opens; `meteor` aims at the middle of the
 * other side's troops in that lane.
 */
const A = 3.5;
const B = 14.5;
const PLAN = [
  // Calm: a red Samurai and two Cadets already marching down lane B.
  { at: -1.4, walk: [1, 'duelist', B, 22.5] },
  { at: -1.4, walk: [1, 'archers', B - 0.9, 24] },
  { at: -1.4, walk: [1, 'archers', B + 0.9, 24] },
  // Blue answers at once: Robots rush the bridge, a Gladiator behind.
  { at: 0.5, play: [0, 'imps', B, 12.5] },
  { at: 1.0, play: [0, 'gladiator', B - 0.5, 11.5] },
  // The other lane wakes: a red Viking and Pirate cross lane A.
  { at: 1.6, play: [1, 'viking', A, 19] },
  { at: 1.9, play: [1, 'pirate', A + 1, 18.5] },
  // Blue meets them with the Sumo and Cadets.
  { at: 2.3, play: [0, 'sumo', A, 12.5] },
  { at: 2.6, play: [0, 'archers', A, 11] },
  // Both lanes grow.
  { at: 3.2, play: [1, 'mage', B, 21] },
  { at: 3.4, play: [1, 'drake', B - 1, 20.5] },
  { at: 3.8, play: [0, 'inventor', B, 11] },
  { at: 4.0, play: [0, 'ranger', B + 1, 11.5] },
  { at: 4.6, play: [1, 'linebacker', A - 0.5, 18.5] },
  { at: 4.8, play: [1, 'gunner', A + 1, 20] },
  { at: 5.2, play: [0, 'firefighter', A, 13] },
  { at: 5.4, play: [0, 'jetpack', A - 1, 12.5] },
  { at: 5.8, meteor: [0, 'B'] },
  { at: 6.3, play: [1, 'imps', A, 18.5] },
  { at: 6.5, play: [1, 'beekeeper', A + 1, 21] },
  { at: 6.8, play: [0, 'duelist', B, 13.5] },
  { at: 7.0, play: [0, 'pirate', B - 1, 13] },
  { at: 7.4, meteor: [1, 'A'] },
  { at: 7.6, play: [1, 'ogre', B, 19] },
  { at: 7.8, play: [0, 'explorer', A + 1, 12] },
  { at: 8.3, play: [0, 'viking', A, 13.5] },
  { at: 8.5, play: [0, 'medic', A - 1, 11.5] },
  { at: 8.6, play: [1, 'sumo', B, 19.5] },
  { at: 9.0, play: [1, 'drummer', A, 20] },
  { at: 9.2, play: [1, 'firefighter', A - 1, 19] },
  { at: 9.3, play: [0, 'drake', B, 12] },
];

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
  await page.waitUntil(`window.arenaDebug.session.match.phase === 'battle'`);
  // From here the session steps the match itself, on the schedule above.
  await page.eval(`(async () => {
    const { TICK, step, deploy, summon } = await import('/lib/games/arena/engine.ts');
    const session = window.arenaDebug.session;
    const plan = ${JSON.stringify(PLAN)};
    const lead = ${warmup / 1000};
    session.bots = [];
    const m = session.match;
    m.units.length = 0;
    m.spells.length = 0;
    m.projectiles.length = 0;
    // Sturdier troops on both sides, so the battles build up instead of
    // trading one for one.
    for (const p of m.players) p.boost = { ...p.boost, troopHp: 1.6 };
    const start = m.tick;
    const play = (m, player, card, x, y) => {
      const seat = m.players[player];
      seat.hand.cards[0] = card;
      seat.elixir = 10;
      const r = deploy(m, player, 0, x, y);
      if (!r.ok) window.__reelMisses.push(card + ' ' + r.reason);
    };
    const run = (m, s) => {
      if (s.walk) {
        const [player, card, x, y] = s.walk;
        const u = summon(m, player, card, x, y);
        u.state = 'walking';
        u.deployLeft = 0;
      } else if (s.play) play(m, ...s.play);
      else if (s.meteor) {
        const [player, lane] = s.meteor;
        const foes = m.units.filter(
          (u) => u.side !== m.players[player].side && (u.x < 9) === (lane === 'A'),
        );
        if (!foes.length) return window.__reelMisses.push('meteor: no target');
        const x = foes.reduce((a, u) => a + u.x, 0) / foes.length;
        const y = foes.reduce((a, u) => a + u.y, 0) / foes.length;
        play(m, player, 'meteor', x, y);
      }
    };
    window.__reelLog = [];
    window.__reelMisses = [];
    session.advance = function (dt, paused) {
      const m = this.match;
      if (paused || this.phase || m.phase === 'over') return 1;
      this.acc += dt;
      while (this.acc >= TICK) {
        const t = (m.tick - start) * TICK - lead;
        while (plan.length && plan[0].at <= t) run(m, plan.shift());
        if ((m.tick - start) % 15 === 0)
          window.__reelLog.push({
            t,
            real: window.__reelReal?.() ?? 0,
            A: [0, 1].map((s) => m.units.filter((u) => u.side === s && u.x < 9).length),
            B: [0, 1].map((s) => m.units.filter((u) => u.side === s && u.x >= 9).length),
          });
        step(m);
        this.acc -= TICK;
      }
      return this.acc / TICK;
    };
  })()`);
}

/** Once filming is over, logs the troops in each lane and checks the match
 * ran at its own speed (30 ticks a game second, `slow` times slower in real
 * time). */
export async function drive(page, running) {
  while (running()) await page.sleep(250);
  const log = await page.eval('window.__reelLog');
  const misses = await page.eval('window.__reelMisses');
  if (misses.length) console.log(`  cards not played: ${misses.join(', ')}`);
  const shown = log.filter((r) => r.t > -0.01 && r.t <= seconds + 0.01);
  for (const row of shown.filter((_, i) => i % 2 === 0))
    console.log(
      `  ${row.t.toFixed(1)} s: lane A blue ${row.A[0]} red ${row.A[1]}, lane B blue ${row.B[0]} red ${row.B[1]}`,
    );
  const [first, last] = [shown[0], shown.at(-1)];
  if (first?.real && last?.real)
    console.log(
      `  match: ${(last.t - first.t).toFixed(2)} game s in ${((last.real - first.real) / 1000).toFixed(2)} real s (${page.slow}× slow → ${(((last.t - first.t) * page.slow * 1000) / (last.real - first.real)).toFixed(3)}× speed)`,
    );
}
