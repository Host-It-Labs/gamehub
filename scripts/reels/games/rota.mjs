/**
 * Rota: the mill town on the default map (Meadow, no extensions: no water),
 * half built after five of its seven rounds, traffic running, and growing on
 * camera. Ten seconds in four quick shots, each placing pieces through the
 * real engine (the lab's `play`, as a tap would): it opens close on a corner
 * of the network, a road bend and a station dropping in, then cuts wider
 * and wider as the rail curves, a straight and an overpass and the last
 * straights land, and the final shot pulls back to the whole grown board.
 * The rounds are the game's own bot's (seed 202), so both shapes show the
 * same pieces in the same places. The match never ends on camera: a finished
 * match fills every empty square with houses, so round 7 is placed but never
 * locked.
 *
 * The camera is the game's own, steered from the driver for the reel only:
 * each frame, before the world draws, it is set between a close framing of
 * the shot's area and the board's own fitted view, on the page clock, so it
 * moves smoothly at 60 fps and plays at the game's speed.
 */
export const css = `
  .rota-players, .rota-notice, .rota-side, .rota-dock, .rota-results,
  .rota-coach, .rota-drag, .rota-modal, .rota-cells-3d, .rota-loading,
  .table-manager { display: none !important; }
  main.rota-world.rota-world { --top: 0px; --dock: 0px; --side: 0px; --strip: 0px; }
`;
/** On the desktop screen the board is fitted to the whole screen, not the
 * middle column, so the last shot ends on the whole board, large. */
export const wideCss = `
  main.rota-world .rota-stage {
    top: 14px; bottom: 14px; padding: 0; gap: 0;
    grid-template-columns: 0 minmax(0, 1fr) 0;
  }
`;
/** Game milliseconds the traffic runs before filming starts. */
export const warmup = 5000;
export const seconds = 10;
/** Filmed 8× slow, as every 3D game: the busy canvas screencasts about 20
 * full-HD frames a real second, so each of the clip's 60 a second is new. */
export const slow = 8;
/** It never stops moving, so a take short of 55 new frames a second is
 * filmed again, slower (see record.mjs). */
export const minFps = 55;
/** The town's fine brickwork, slates and smoke in every frame, and the cuts:
 * a little more compression keeps the clip inside the size budget. */
export const crf = { wide: 29, tall: 29 };

/**
 * The shots, in seconds of the clip. Each eases from its first framing to
 * its second; a new shot is a hard cut. `focus` is the board point the
 * camera looks at (squares: x across, z down, 0–7 on Meadow), `zoom` its
 * distance as a share of the fitted view's, `yaw` and `tilt` (degrees) turn
 * it round and lower it from the fitted view. The last shot ends exactly on
 * the fitted view (the whole board, centred). `place` lists the squares the
 * player builds on during the shot, at those times; `done` locks the round.
 * `tall` changes a shot for the phone: its fitted view looks almost straight
 * down, so the close shots lower the camera further for the same
 * three-quarter look.
 */
const SHOTS = [
  {
    // Close on the west side: a road bend, then a station, beside the
    // rail curves and the overpass already there.
    from: 0,
    to: 2.4,
    focus: [
      [1.95, 4.15],
      [1.75, 3.85],
    ],
    zoom: [0.3, 0.37],
    yaw: [-18, -11],
    tilt: [-11, -9],
    tall: { focus: [[1.85, 4.3], [1.7, 4.0]], zoom: [0.34, 0.42], tilt: [-26, -22] },
    place: [
      [0.6, 14],
      [1.4, 15],
    ],
  },
  {
    // From the other side, a little wider: two rail curves join the
    // station to the line.
    from: 2.4,
    to: 4.9,
    focus: [
      [2.1, 3.9],
      [2.2, 3.7],
    ],
    zoom: [0.45, 0.54],
    yaw: [15, 9],
    tilt: [-8, -6],
    tall: { tilt: [-22, -18] },
    place: [
      [2.85, 22],
      [3.55, 23],
    ],
    done: 4.25,
  },
  {
    // Wider again, the next round: a straight and an overpass carry the
    // line north.
    from: 4.9,
    to: 7.3,
    focus: [
      [2.9, 2.5],
      [3.1, 2.7],
    ],
    zoom: [0.6, 0.7],
    yaw: [-9, -4],
    tilt: [-5, -3],
    tall: { tilt: [-16, -12] },
    place: [
      [5.35, 16],
      [6.15, 9],
    ],
  },
  {
    // Pulling back to the whole network as the last straights land.
    from: 7.3,
    to: 10,
    focus: [
      [4.4, 4.1],
      [3.5, 3.5],
    ],
    zoom: [0.76, 1],
    yaw: [7, 0],
    tilt: [-3, 0],
    tall: { tilt: [-12, 0] },
    place: [
      [7.75, 33],
      [8.45, 47],
    ],
    ease: 'out',
  },
];

export async function prepare(page) {
  // The same traffic, people and town life on every take and both shapes:
  // the page's Math.random is seeded before anything runs.
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      let a = 0x2f6b9c1d;
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();`,
  });
  await page.goto('/rota/lab?map=meadow&rounds=5&ext=&seats=1&seed=202');
  await page.waitFor('canvas.rota-canvas[data-ready]', 90000);
  await page.waitUntil(
    '!!window.rotaWorld && !!window.rotaLab && !!window.rotaLab.play',
    30000,
  );
  await page.eval(`(() => {
    const w = window.rotaWorld;
    // Steady quality, and only the town itself: no open-end rings, aim
    // highlights or ghost pieces from the interface.
    w.quality.sample = () => false;
    w.loose.visible = false;
    w.ghost.visible = false;
    const setView = w.setView.bind(w);
    w.setView = (v) => setView({ ...v, loose: [], targets: undefined, turnable: undefined, ghost: null });

    const shots = ${JSON.stringify(SHOTS.map((s) => ({ ...s, ...s[page.shape] })))};
    const deg = Math.PI / 180;
    const cam = w.camera;
    const n = w.map.size;
    const V = cam.position.constructor;
    // The board's own fitted view, kept from every fit (a resize refits).
    const fitted = { dist: 1, el: 0, off: [0, 0] };
    const fitCam = cam.clone();
    const fit = Object.getPrototypeOf(w).fit;
    w.fit = function () {
      fit.call(this);
      fitted.dist = cam.position.length();
      fitted.el = Math.asin(cam.position.y / fitted.dist);
      fitted.off = cam.view ? [cam.view.offsetX, cam.view.offsetY] : [0, 0];
      fitCam.copy(cam);
      fitCam.updateMatrixWorld();
      aim(clip(performance.now()));
    };
    const lerp = (a, b, k) => a + (b - a) * k;
    const ease = {
      // A steady dolly, easing a little before the cut.
      drift: (s) => 1 - (1 - s) * (1 - s) * 0.6 - (1 - s) * 0.4,
      // The last pull-back: brisk, then coming to rest on the board.
      out: (s) => 1 - Math.pow(1 - s, 3),
    };
    window.__reelT0 = undefined;
    const clip = (now) =>
      window.__reelT0 === undefined ? -1 : (now - window.__reelT0) / 1000;
    const aim = (t) => {
      const shot = shots.find((s) => t < s.to) ?? shots.at(-1);
      const s = Math.min(1, Math.max(0, (t - shot.from) / (shot.to - shot.from)));
      const k = ease[shot.ease ?? 'drift'](s);
      const zoom = lerp(shot.zoom[0], shot.zoom[1], k);
      const fx = lerp(shot.focus[0][0], shot.focus[1][0], k) - n / 2;
      const fz = lerp(shot.focus[0][1], shot.focus[1][1], k) - n / 2;
      const az = lerp(shot.yaw[0], shot.yaw[1], k) * deg;
      const el = fitted.el + lerp(shot.tilt[0], shot.tilt[1], k) * deg;
      const d = fitted.dist * zoom;
      cam.position.set(
        fx + Math.sin(az) * Math.cos(el) * d,
        Math.sin(el) * d,
        fz + Math.cos(az) * Math.cos(el) * d,
      );
      cam.up.set(0, 1, 0);
      cam.lookAt(fx, 0, fz);
      const { width, height } = w.frame;
      cam.setViewOffset(width, height, fitted.off[0] * zoom, fitted.off[1] * zoom, width, height);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
    };
    // Traffic comes and goes only where neither the board's own view nor
    // the shot sees it, so nothing appears or vanishes in either.
    const p = new V();
    const out = (c, x, z) => {
      const q = p.set(x - n / 2, 0, z - n / 2).project(c);
      return q.z > 1 || Math.abs(q.x) > 1.08 || Math.abs(q.y) > 1.08;
    };
    w.offscreen = (x, z) => out(cam, x, z) && out(fitCam, x, z);

    // The player's pieces, placed on the clip's clock through the lab
    // (the engine's own moves). A round's moves are the bot's, planned
    // once when the round opens.
    const steps = shots
      .flatMap((s) => [
        ...s.place.map(([at, cell]) => ({ at, cell })),
        ...(s.done === undefined ? [] : [{ at: s.done, done: true }]),
      ])
      .sort((a, b) => a.at - b.at);
    let plan = null;
    window.__reelPlaced = [];
    const run = (t) => {
      while (steps.length && steps[0].at <= t) {
        const step = steps.shift();
        if (step.done) {
          window.rotaLab.play({ type: 'done' });
          plan = null;
          window.__reelPlaced.push({ t, done: true });
          continue;
        }
        plan ??= window.rotaLab.plan().filter((m) => m.type !== 'done');
        const i = plan.findIndex((m) => m.cell === step.cell);
        const [m] = plan.splice(i >= 0 ? i : 0, 1);
        if (!m) continue;
        window.rotaLab.play(m);
        window.__reelPlaced.push({ t, cell: m.cell, wanted: step.cell });
      }
    };
    // Before the world draws each frame: place what is due, then aim.
    const loop = w.loop;
    window.__reelClock = [];
    w.loop = (now) => {
      const t = clip(now);
      if (t >= 0) run(t);
      if (t >= 0 && window.__reelClock.length < 4 && t >= window.__reelClock.length * 3.3)
        window.__reelClock.push({ t, real: window.__reelReal?.() ?? 0, world: w.time });
      aim(t);
      loop(now);
    };
    w.fit();
  })()`);
  await page.sleep(1500);
}

/** Starts the clip's clock (filming begins `warmup` game ms later), then
 * logs what was placed when and checks the world kept the game's speed. */
export async function drive(page, running) {
  await page.eval(`window.__reelT0 = performance.now() + ${warmup}`);
  while (running()) await page.sleep(250);
  const placed = await page.eval('window.__reelPlaced');
  console.log(
    `  placed: ${placed
      .map((p) =>
        p.done
          ? `done at ${p.t.toFixed(2)} s`
          : `${p.cell}${p.cell === p.wanted ? '' : ` (wanted ${p.wanted})`} at ${p.t.toFixed(2)} s`,
      )
      .join(', ')}`,
  );
  const clock = await page.eval('window.__reelClock');
  const [first, last] = [clock[0], clock.at(-1)];
  if (first?.real && last?.real && last !== first)
    console.log(
      `  world: ${(last.world - first.world).toFixed(2)} game s in ${((last.real - first.real) / 1000).toFixed(2)} real s (${page.slow}× slow → ${(((last.world - first.world) * page.slow * 1000) / (last.real - first.real)).toFixed(3)}× speed)`,
    );
}
