/**
 * Quiz: one short round of each of its games, each in a fresh browser and
 * joined with a crossfade. In every scene you make your answer with a real
 * drag or tap, lock, and the reveal counts everyone's points up.
 *
 *   Atlas  "Cape Town, South Africa": spin the globe to the tip of Africa
 *          and drop your pin; the reveal flies in and the distances count.
 *   Sizes  a giraffe beside a person: slide its size up until it stands tall;
 *          the lineup rises with everyone's guess.
 *   Years  "The Titanic sinks": drag the marker along the timeline from
 *          1600 to 1910; the year counts up and the pins drop.
 *   Order  "Fastest first": drag two rows into place; the true order flips
 *          in with who got each one right.
 *
 * Each table is a saved match set up in advance with four named seats: the
 * three others have already locked, and your other two answers of the round
 * are in, so each clip holds only one answer and its reveal.
 */
export const css = `
  .party-players, .party-action-status, .party-dialog, .party-practice,
  .party-lock-count, .party-host-wait, .party-waiting, .sabi-actions,
  .atlas-pin-legend, .atlas-sources, .atlas-globe-crosshair, .quiz-intro, .size-knob, .size-recentre, .size-zoom, .year-mark {
    visibility: hidden !important;
  }
  /* Script clicks still reach the step tabs. */
  .sabi-steps { display: none !important; }
  /* Still pressed by the drive, so only see-through. */
  .size-tape { opacity: 0 !important; }
  .atlas-pin-map canvas { outline: none !important; }
  :focus-visible { outline: none !important; }
  /* A speck that never stops moving, so the screencast keeps sending frames
     through still moments and the clip keeps its full length. */
  body::after {
    content: ''; position: fixed; right: 0; bottom: 0; width: 1px; height: 1px;
    background: rgba(0, 0, 0, 0.02); pointer-events: none; z-index: 2147483647;
    animation: reel-tick 1s linear infinite;
  }
  @keyframes reel-tick { to { transform: translateX(-1px); } }
`;
/** On phones the hidden top bar's room goes to the mat, the score plate
 * keeps clear of the revealed year, and the true order fits all five rows
 * (its fact and the unseen Next make way). */
export const tallCss = `
  .party-table.is-sabi { padding-top: 14px !important; }
  .year-stage.is-revealed .year-readout { align-self: flex-end; }
  .order-stage.is-revealed .size-fact { display: none !important; }
  .order-stage.is-revealed .order-board { padding-top: 66px !important; }
  .order-stage.is-revealed .order-truth { gap: 4px !important; }
  .order-stage.is-revealed .order-truth strong { font-size: 14px !important; }
  .order-stage.is-revealed .order-truth em { font-size: 12.5px !important; }
  .sabi-stage.is-revealed .sabi-actions { display: none !important; }
`;
export const warmup = 1200;
/** Filmed 2× slow so its motion stays smooth on a loaded Mac (see record.mjs). */
export const slow = 2;

const SAVE = 'gamehub.standalone.v1';
const names = ['You', 'Mia', 'Leo', 'Ava'];
const TILE = 'button.lib-tile-button[aria-label^="Trivia."]';

/** Writes a saved Quiz match of one game and opens it from the library.
 * `edit` runs in the page on the fresh game `g` (its module is `mod`) and
 * returns an error string or nothing. */
async function open(page, choice, edit, ready) {
  await page.goto('/');
  const ok = await page.eval(`(async () => {
    const { standaloneGames } = await import('/lib/games/standalone/registry.ts');
    const mod = await import(${JSON.stringify(
      {
        miro: '/lib/games/party/geography.ts',
        size: '/lib/games/party/size.ts',
        year: '/lib/games/party/year.ts',
        order: '/lib/games/party/order.ts',
      }[choice],
    )});
    const entry = standaloneGames.miro;
    let g = entry.create(4, 20261008, 'medium', undefined, undefined, undefined, false, 'quick');
    g = entry.play(g, { type: 'vote', choice: ${JSON.stringify(choice)} }, 0);
    if (g.kind !== ${JSON.stringify(choice)} || g.phase !== 'guess') return 'no guess phase';
    g.seats = ${JSON.stringify(names)};
    g.log = [];
    const failed = (${edit})(g, mod);
    if (failed) return failed;
    if (!mod.validState(g) || !entry.isSavedGame(g)) return 'invalid';
    localStorage.setItem(${JSON.stringify(SAVE)}, JSON.stringify({ miro: g }));
    return 'ok';
  })()`);
  if (ok !== 'ok')
    throw new Error(`the prepared ${choice} table failed: ${ok}`);
  await page.goto('/');
  await page.waitFor(TILE, 30000);
  await page.click(TILE);
  await page.waitFor('button.resume-strip');
  await page.click('button.resume-strip');
  await page.waitFor(ready, 30000);
}

/** A real press the drive can steer as it goes: touch on phones, mouse on
 * desktops. */
function press(page) {
  const touch = page.shape === 'tall';
  const send = (type, p) =>
    touch
      ? page.send('Input.dispatchTouchEvent', {
          type: { down: 'touchStart', move: 'touchMove', up: 'touchEnd' }[type],
          touchPoints: type === 'up' ? [] : [{ x: p.x, y: p.y, id: 1 }],
        })
      : page.send('Input.dispatchMouseEvent', {
          type: { down: 'mousePressed', move: 'mouseMoved', up: 'mouseReleased' }[
            type
          ],
          x: p.x,
          y: p.y,
          button: 'left',
          buttons: type === 'up' ? 0 : 1,
          clickCount: 1,
        });
  return {
    async down(p) {
      if (!touch)
        await page.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: p.x,
          y: p.y,
          button: 'none',
          buttons: 0,
        });
      await send('down', p);
    },
    move: (p) => send('move', p),
    up: (p) => send('up', p),
  };
}
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** An eased path between two points. */
function path(from, to, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const e = ease(i / steps);
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
  });
}
/** Locks your answers with the (hidden) Lock button. */
const lock = (page) => page.click('.sabi-actions .party-primary');

// ---------------------------------------------------------------- Atlas

const place = { name: 'Cape Town', lat: -33.9253, lng: 18.4239 };
/** Everyone else's pins for Cape Town. */
const capePins = [null, [-33.0, 25.6], [-26.2, 28.0], [-29.0, 16.5]];
/** Where the globe faces when it opens (geo-pin-map's reset). */
const facing = { lat: 18, lng: 8 };

const atlas = {
  seconds: 6.5,
  async prepare(page) {
    await open(
      page,
      'miro',
      `(g, geo) => {
        const id = geo.places.findIndex((p) => p.name === ${JSON.stringify(place.name)});
        if (id < 0 || geo.places[id].difficulty !== 'medium') return 'no Cape Town';
        const at = g.deck.indexOf(id);
        if (at >= 0) g.deck[at] = g.deck[0];
        g.deck[0] = id;
        g.cityIds = g.deck.slice(0, 3);
        g.prompts[0] = { ...g.prompts[0], difficulty: 'medium', title: 'Cape Town, South Africa' };
        const pins = ${JSON.stringify(capePins)};
        g.guesses = pins.map((pin, s) => s === 0
          ? { pins: [null, { lat: -15.8, lng: -47.9 }, { lat: 35.7, lng: 139.7 }], locked: false }
          : { pins: [{ lat: pin[0], lng: pin[1] }, { lat: -12 - s, lng: -40 + s }, { lat: 20 - s * 5, lng: 30 * s }], locked: true });
      }`,
      '.atlas-stage .atlas-pin-map canvas',
    );
    // The satellite globe is in once its loading notice is gone.
    await page.waitUntil(`!document.querySelector('.atlas-map-error')`, 30000);
    await warmTiles(page);
    await page.sleep(2000);
  },
  async drive(page, running) {
    const g = await globe(page);
    const rad = Math.PI / 180;
    // Drag the tip of Africa from where it sits up into the middle.
    const dx = (facing.lng - place.lng) * rad * g.perRad,
      dy = (place.lat - facing.lat) * rad * g.perRad;
    const cx = g.left + g.w / 2,
      cy = g.top + g.h / 2;
    const from = { x: cx - dx / 2, y: cy - dy / 2 + g.h * 0.08 };
    await page.sleep(1400);
    await page.drag(
      path(from, { x: from.x + dx, y: from.y + dy }, 70),
      16,
    );
    if (!running()) return;
    await page.sleep(250);
    // The spin brought Cape Town to the centre; the pin lands a near miss.
    await page.tap(cx + 6, cy - 8);
    await page.sleep(350);
    await lock(page);
  },
};

/** Visits Cape Town's close-up with the globe's own keys before filming, so
 * its satellite tiles are cached and the fly-in never shows a tile still
 * loading; Home then turns the globe back to its opening view. */
async function warmTiles(page) {
  await page.eval(`document.querySelector('.atlas-pin-map canvas').focus()`);
  const key = async (name, times) => {
    for (let i = 0; i < times; i++) await page.key(name, name, 20);
  };
  // Cape Town: about 52° south and 10° east of the opening view.
  await key('ArrowDown', 17);
  await key('ArrowRight', 3);
  for (let zoom = 0; zoom < 6; zoom++) {
    await key('+', 1);
    await page.sleep(500);
  }
  await page.sleep(2500);
  await key('-', 6);
  // Let the zoom-out settle first, or the far globe can keep the satellite
  // tiles (dark seas) instead of its own bright texture.
  await page.sleep(1500);
  await key('Home', 1);
  await page.sleep(1000);
  await page.eval(`document.activeElement?.blur()`);
}

/** The canvas box and how many pixels of drag turn the globe one radian:
 * OrbitControls turns 2π·rotateSpeed per canvas height, and the map sets
 * rotateSpeed to altitude·tan(fov/2)/π (fov 40°). */
function globe(page) {
  return page.eval(`(() => {
    const r = document.querySelector('.atlas-pin-map canvas').getBoundingClientRect();
    const half = Math.PI / 9, tan = Math.tan(half);
    const fit = 1.04 / Math.sin(Math.atan(tan * Math.min(1, r.width / r.height)));
    return { left: r.left, top: r.top, w: r.width, h: r.height, perRad: r.height / (2 * (fit - 1) * tan) };
  })()`);
}

// ---------------------------------------------------------------- Sizes

/** A giraffe (5.5 m tall) beside a person (1.75 m): you size it to 6 m. */
const giraffe = { mine: 6, others: [4.6, 7.4, 3.6] };

const sizes = {
  seconds: 6.3,
  async prepare(page) {
    await open(
      page,
      'size',
      `(g, size) => {
        g.questions[0] = { kind: 'thing', ref: 'person', target: 'giraffe', answer: size.measure('thing', 'giraffe').real };
        const others = ${JSON.stringify(giraffe.others)};
        const near = (i, f) => size.tidy(g.questions[i].answer * f);
        g.guesses = g.seats.map((_, s) => s === 0
          ? { values: [null, near(1, 1.15), near(2, 0.9)], locked: false }
          : { values: [others[s - 1], near(1, 0.7 + s * 0.2), near(2, 1.4 - s * 0.15)], locked: true });
      }`,
      '.size-stage .size-tape.is-live',
    );
    await page.sleep(1500);
  },
  async drive(page, running) {
    await page.sleep(1900);
    // Slide the (unseen) tape: the camera keeps the growing giraffe in view,
    // where its corner knob would hold the camera still. The tape reads the
    // giraffe's height in persons on a log scale.
    const tape = await page.eval(`(() => {
      const r = document.querySelector('.size-tape-track').getBoundingClientRect();
      const size = Number(document.querySelector('.size-tape').getAttribute('aria-valuenow'));
      return { x: r.x + r.width / 2, top: r.y, h: r.height, size };
    })()`);
    const lo = Math.log(0.08),
      hi = Math.log(12);
    const y = (size) => tape.top + (1 - (Math.log(size) - lo) / (hi - lo)) * tape.h;
    const points = path(
      { x: tape.x, y: y(tape.size) },
      { x: tape.x, y: y(giraffe.mine / 1.75) },
      60,
    );
    const hand = press(page);
    await hand.down(points[0]);
    for (const p of points.slice(1)) {
      await hand.move(p);
      await page.sleep(16);
    }
    await page.sleep(120);
    await hand.up(points.at(-1));
    if (!running()) return;
    await page.sleep(500);
    await lock(page);
  },
};

// ---------------------------------------------------------------- Years

/** "The Titanic sinks" (1912): you place it at 1910. */
const titanic = { year: 1912, mine: 1910, others: [1905, 1921, 1890] };

const years = {
  seconds: 6.3,
  async prepare(page) {
    await open(
      page,
      'year',
      `(g, year) => {
        g.events[0] = 39;
        if (g.events.indexOf(39) !== 0 || g.events.lastIndexOf(39) !== 0) return 'Titanic twice';
        const others = ${JSON.stringify(titanic.others)};
        g.guesses = g.seats.map((_, s) => s === 0
          ? { values: [null, 1180, 2019], locked: false }
          : { values: [others[s - 1], 1100 + s * 40, 2010 + s * 3], locked: true });
      }`,
      '.year-stage .year-line.is-live',
    );
    await page.sleep(1500);
  },
  async drive(page, running) {
    await page.sleep(1900);
    const line = await page.center('.year-line');
    const x = (y) => line.left + ((y - 1000) / 1025) * line.w;
    const hand = press(page);
    const points = path(
      { x: x(1600), y: line.y },
      { x: x(titanic.mine), y: line.y },
      55,
    );
    await hand.down(points[0]);
    for (const p of points.slice(1)) {
      await hand.move(p);
      await page.sleep(16);
    }
    await page.sleep(120);
    await hand.up(points.at(-1));
    if (!running()) return;
    await page.sleep(550);
    await lock(page);
  },
};

// ---------------------------------------------------------------- Order

/** "Fastest first", dealt with two pairs swapped: you fix both. */
const fastest = {
  set: 12,
  dealt: [1, 0, 3, 2, 4],
  others: [
    [0, 1, 2, 4, 3],
    [1, 0, 2, 3, 4],
    [1, 0, 3, 2, 4],
  ],
};

const order = {
  seconds: 6.3,
  async prepare(page) {
    await open(
      page,
      'order',
      `(g) => {
        const at = g.sets.indexOf(${fastest.set});
        if (at > 0) g.sets[at] = g.sets[0];
        g.sets[0] = ${fastest.set};
        g.dealt[0] = ${JSON.stringify(fastest.dealt)};
        const others = ${JSON.stringify(fastest.others)};
        g.guesses = g.seats.map((_, s) => s === 0
          ? { orders: [null, null, null], locked: false }
          : { orders: [others[s - 1], null, null], locked: true });
      }`,
      '.order-stage .ranking-handle',
    );
    // Lock appears once every set has been looked at.
    for (const i of [1, 2, 0]) {
      await page.eval(
        `document.querySelectorAll('.sabi-steps [role=tab]')[${i}].click()`,
      );
      await page.sleep(300);
    }
    await page.waitFor('.order-stage .ranking-handle');
    await page.sleep(1200);
  },
  async drive(page, running) {
    await page.sleep(1900);
    const rows = () =>
      page.eval(`[...document.querySelectorAll('.order-list .tier-row')].map((row) => {
        const h = row.querySelector('.ranking-handle').getBoundingClientRect();
        return { x: h.x + h.width / 2, y: h.y + h.height / 2 };
      })`);
    const hand = press(page);
    // Lift a row onto the one above it.
    const raise = async (index) => {
      const r = await rows();
      const points = path(r[index], { x: r[index].x, y: r[index - 1].y - 4 }, 24);
      await hand.down(points[0]);
      for (const p of points.slice(1)) {
        await hand.move(p);
        await page.sleep(16);
      }
      await page.sleep(90);
      await hand.up(points.at(-1));
    };
    await raise(1);
    await page.sleep(380);
    if (!running()) return;
    await raise(3);
    await page.sleep(500);
    if (!running()) return;
    await lock(page);
  },
};

export const scenes = [atlas, sizes, years, order];
