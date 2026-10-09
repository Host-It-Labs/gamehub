/**
 * Impostor: you finish drawing a cat, every drawing lands on the evidence
 * board (three more cats and one fox), the one-word clues appear, you accuse
 * the fox and the reveal strings everyone to their suspect.
 *
 * The table is a saved match set up in advance: the four other seats have
 * already drawn (bots only doodle loops), written and accused, so the clip
 * holds only your moves and the reveal.
 */
export const css = `
  .party-players, .party-action-status, .party-dialog, .party-practice,
  .party-lock-count, .party-host-wait, .party-waiting, .imp-clock,
  .imp-vote-clock, .imp-tools, .imp-next,
  .imp-room:not(.phase-vote) .imp-dock { visibility: hidden !important; }
  /* A speck that never stops moving, so the screencast keeps sending frames
     through still moments and the clip keeps its full length. */
  body::after {
    content: ''; position: fixed; right: 0; bottom: 0; width: 1px; height: 1px;
    background: rgba(0, 0, 0, 0.02); pointer-events: none; z-index: 2147483647;
    animation: reel-tick 1s linear infinite;
  }
  @keyframes reel-tick { to { transform: translateX(-1px); } }
`;
export const warmup = 2600;
export const seconds = 10;

const SAVE = 'gamehub.standalone.v1';
const names = ['You', 'Mia', 'Leo', 'Ava', 'Sam', 'Noa'];
/** Sam, in the middle of the bottom row, drew the fox; three of the others
 * accuse Sam, so the strings fan across the board. */
const impostor = 4;
const clues = ['', 'purr', 'meow', 'tabby', 'sly', 'nap'];
const accuse = [null, 4, 4, 2, 3, 4];

// ---- Hand-drawn sketches in the card's 0–1000 square ----------------------
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Points along an ellipse, in degrees with y pointing down. */
function arc(cx, cy, rx, ry, a0, a1) {
  const steps = Math.max(
    8,
    Math.round(
      ((Math.abs(a1 - a0) / 360) * 2 * Math.PI * Math.max(rx, ry)) / 22,
    ),
  );
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}
/** A polyline through corners, filled in every ~22 units. */
function line(...corners) {
  const out = [corners[0]];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1],
      [bx, by] = corners[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 22));
    for (let k = 1; k <= n; k++)
      out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}
/** A smooth curve through points (Catmull-Rom). */
function curve(...pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] ?? p2;
    const n = Math.max(
      2,
      Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 22),
    );
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t;
      out.push(
        [0, 1].map(
          (d) =>
            0.5 *
            (2 * p1[d] +
              (-p0[d] + p2[d]) * t +
              (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
              (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3),
        ),
      );
    }
  }
  return out;
}
const dot = (x, y) => [[x, y]];
const S = (c, w, p) => ({ c, w, p });
// Inks: graphite, red, blue. Nibs: fine, marker, broad.
const G = 0,
  R = 1,
  B = 2;
const whiskers = (cx, cy, spread, len) =>
  [
    line([cx - spread, cy], [cx - spread - len, cy - 22]),
    line([cx - spread, cy + 22], [cx - spread - len, cy + 38]),
    line([cx + spread, cy], [cx + spread + len, cy - 22]),
    line([cx + spread, cy + 22], [cx + spread + len, cy + 38]),
  ].map((p) => S(G, 0, p));

/** Your cat, drawn live: a big friendly face. */
const youCat = [
  S(G, 1, arc(500, 560, 255, 225, 200, 565)),
  S(G, 1, line([300, 410], [285, 175], [440, 345])),
  S(G, 1, line([560, 345], [715, 175], [700, 410])),
  S(G, 2, dot(410, 520)),
  S(G, 2, dot(590, 520)),
  S(R, 2, line([470, 600], [530, 600], [500, 632], [470, 600])),
  S(G, 1, curve([440, 670], [470, 690], [500, 660], [530, 690], [560, 670])),
  ...whiskers(500, 625, 95, 150),
];
const sittingCat = [
  S(G, 1, arc(500, 290, 150, 128, 200, 565)),
  S(G, 1, line([395, 205], [372, 70], [462, 168])),
  S(G, 1, line([538, 168], [628, 70], [605, 205])),
  S(G, 2, dot(445, 280)),
  S(G, 2, dot(555, 280)),
  S(G, 1, line([484, 320], [516, 320], [500, 338], [484, 320])),
  S(G, 0, curve([462, 360], [482, 372], [500, 352], [518, 372], [538, 360])),
  ...whiskers(500, 335, 60, 110),
  S(G, 1, arc(500, 680, 190, 255, -62, 242)),
  S(G, 1, line([452, 720], [452, 925])),
  S(G, 1, line([548, 720], [548, 925])),
  S(G, 1, curve([680, 830], [790, 800], [850, 700], [835, 600], [780, 575])),
];
const faceCat = [
  S(G, 1, arc(500, 580, 280, 240, 195, 560)),
  S(G, 1, line([285, 430], [255, 170], [430, 345])),
  S(G, 1, line([570, 345], [745, 170], [715, 430])),
  S(G, 0, line([300, 380], [288, 245], [380, 340])),
  S(G, 0, line([620, 340], [712, 245], [700, 380])),
  S(B, 1, arc(395, 540, 50, 60, 0, 365)),
  S(B, 1, arc(605, 540, 50, 60, 0, 365)),
  S(G, 2, line([395, 505], [395, 575])),
  S(G, 2, line([605, 505], [605, 575])),
  S(R, 2, line([470, 640], [530, 640], [500, 668], [470, 640])),
  S(G, 1, line([500, 668], [500, 700])),
  S(G, 1, curve([430, 690], [465, 718], [500, 700])),
  S(G, 1, curve([500, 700], [535, 718], [570, 690])),
  ...whiskers(500, 660, 110, 170),
];
const walkingCat = [
  S(G, 1, arc(560, 600, 250, 135, 0, 360)),
  S(G, 1, arc(265, 455, 115, 100, 0, 362)),
  S(G, 1, line([180, 400], [175, 285], [250, 360])),
  S(G, 1, line([285, 358], [345, 280], [352, 395])),
  S(G, 2, dot(225, 445)),
  S(G, 2, dot(300, 445)),
  S(R, 1, line([252, 485], [278, 485], [265, 500], [252, 485])),
  S(G, 0, line([175, 495], [80, 480])),
  S(G, 0, line([175, 510], [85, 530])),
  S(G, 0, line([355, 495], [440, 470])),
  S(G, 1, line([395, 700], [385, 860], [430, 860])),
  S(G, 1, line([470, 725], [470, 870], [515, 870])),
  S(G, 1, line([650, 725], [655, 870], [700, 870])),
  S(G, 1, line([735, 700], [755, 860], [800, 860])),
  S(G, 1, curve([800, 560], [880, 470], [880, 340], [830, 270])),
  S(R, 1, curve([520, 470], [540, 520], [520, 570])),
  S(R, 1, curve([600, 468], [620, 520], [600, 575])),
  S(R, 1, curve([680, 478], [700, 525], [680, 575])),
];
const fox = [
  S(
    R,
    1,
    line(
      [380, 245],
      [338, 330],
      [430, 400],
      [500, 470],
      [570, 400],
      [662, 330],
      [620, 245],
    ),
  ),
  S(R, 1, line([380, 245], [340, 70], [452, 220])),
  S(R, 1, line([548, 220], [660, 70], [620, 245])),
  S(R, 1, curve([452, 220], [500, 210], [548, 220])),
  S(G, 1, line([420, 305], [465, 325])),
  S(G, 1, line([535, 325], [580, 305])),
  S(G, 2, dot(500, 462)),
  S(R, 0, line([345, 335], [380, 352], [372, 370], [410, 380])),
  S(R, 0, line([655, 335], [620, 352], [628, 370], [590, 380])),
  S(
    R,
    1,
    curve(
      [430, 470],
      [380, 600],
      [365, 760],
      [400, 900],
      [500, 925],
      [600, 900],
      [635, 760],
      [620, 600],
      [570, 470],
    ),
  ),
  S(G, 1, line([455, 760], [455, 920])),
  S(G, 1, line([545, 760], [545, 920])),
  S(
    R,
    1,
    curve(
      [625, 860],
      [760, 870],
      [890, 760],
      [910, 600],
      [860, 470],
      [800, 520],
      [770, 640],
      [700, 760],
      [628, 800],
    ),
  ),
  S(G, 0, line([862, 478], [880, 520], [905, 540])),
];
/** A slight, smooth hand wobble along every stroke. */
function wobbly(strokes, seed) {
  const rand = rng(seed);
  return strokes.map((s) => {
    let ox = 0,
      oy = 0;
    const amount = s.p.length < 2 ? 0 : 7;
    return {
      ...s,
      p: s.p.map(([x, y]) => {
        ox = ox * 0.7 + (rand() - 0.5) * amount;
        oy = oy * 0.7 + (rand() - 0.5) * amount;
        return [
          Math.round(Math.min(1000, Math.max(0, x + ox))),
          Math.round(Math.min(1000, Math.max(0, y + oy))),
        ];
      }),
    };
  });
}
const sleepingCat = [
  S(G, 1, arc(560, 610, 290, 185, -150, 165)),
  S(G, 1, arc(330, 540, 120, 105, 0, 362)),
  S(G, 1, line([245, 480], [235, 360], [315, 438])),
  S(G, 1, line([350, 436], [425, 365], [425, 480])),
  S(G, 1, arc(285, 540, 26, 16, 15, 165)),
  S(G, 1, arc(375, 540, 26, 16, 15, 165)),
  S(R, 2, dot(330, 585)),
  S(G, 1, curve([840, 650], [780, 770], [600, 815], [430, 780], [370, 700])),
  S(B, 1, line([640, 250], [730, 250], [640, 335], [730, 335])),
  S(B, 1, line([780, 130], [840, 130], [780, 190], [840, 190])),
];
const others = [sittingCat, faceCat, walkingCat, fox, sleepingCat].map((s, i) =>
  wobbly(s, i + 2),
);
const live = wobbly(youCat, 1);

// ---- Driving ----------------------------------------------------------------
export async function prepare(page) {
  await page.goto('/');
  const ok = await page.eval(`(async () => {
    const m = await import('/lib/games/party/impostor.ts');
    const { standaloneGames } = await import('/lib/games/standalone/registry.ts');
    const names = ${JSON.stringify(names)}, others = ${JSON.stringify(others)};
    const clues = ${JSON.stringify(clues)}, accuse = ${JSON.stringify(accuse)};
    const g = m.createGame(names.length, 20261008);
    const { wordPairs } = await import('/lib/games/party/impostor-words.ts');
    const pair = wordPairs.findIndex((p) => p.words[0] === 'Cat');
    g.seats = names;
    g.pair = pair;
    g.deck = g.deck.filter((id) => id !== g.pair);
    g.impostors = [${impostor}];
    g.turns = names.map((_, s) => (s === ${impostor} ? 1 : 0));
    g.words = names.map((_, s) => (s === ${impostor} ? 'Fox' : 'Cat'));
    g.sketches = names.map((_, s) => s === 0
      ? { strokes: [], locked: false }
      : { locked: true, strokes: others[s - 1].map((k) => ({ c: k.c, w: k.w, p: m.packPoints(k.p.flat()) })) });
    g.clues = clues.map((text, s) => ({ text, locked: s > 0 }));
    g.accusations = accuse.map((target, s) => ({ target, locked: s > 0 }));
    g.drawEndsAt = Date.now() + 10 * 60_000;
    g.log = [];
    if (!m.validState(g) || !standaloneGames.impostor.isSavedGame(g)) return false;
    localStorage.setItem(${JSON.stringify(SAVE)}, JSON.stringify({ impostor: g }));
    return true;
  })()`);
  if (!ok) throw new Error('the prepared Impostor table did not validate');
  await page.goto('/');
  await page.waitFor('button.lib-tile-button[aria-label^="Impostor."]');
  await page.click('button.lib-tile-button[aria-label^="Impostor."]');
  await page.waitFor('button.resume-strip');
  await page.click('button.resume-strip');
  await page.waitFor('.imp-desk .imp-pad canvas.is-live');
  await page.sleep(400);
}

/** Draws one stroke on the card with a real pointer. */
async function stroke(page, box, points) {
  const at = points.map(([x, y]) => ({
    x: box.left + (x / 1000) * box.w,
    y: box.top + (y / 1000) * box.h,
  }));
  await page.drag(at.length > 1 ? at : [at[0], at[0]], 14);
  await page.sleep(90);
}

export async function drive(page, running) {
  const box = await page.center('.imp-pad canvas');
  let ink = 0;
  for (const s of live) {
    if (!running()) return;
    if (s.c !== ink) {
      await page.click(
        `.imp-ink[aria-label="${['Graphite', 'Red', 'Blue'][s.c]}"]`,
      );
      ink = s.c;
    }
    const nib = ['Fine', 'Marker', 'Broad'][s.w];
    await page.click(`.imp-nib[aria-label="${nib}"]`);
    await stroke(page, box, s.p);
  }
  await page.sleep(350);
  await page.click('.imp-done');
  // The board fills; you write your one word.
  await page.waitFor('.imp-room.phase-clue');
  const tall = page.shape === 'tall';
  await page.sleep(tall ? 900 : 1400);
  await page.eval(`(() => {
    const input = document.querySelector('input.imp-clue-input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, 'whiskers');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.sleep(200);
  await page.click('button.imp-send');
  // Every clue shows; you pick the fox.
  await page.waitFor('.imp-room.phase-accuse');
  await page.sleep(tall ? 1100 : 1500);
  await page.click(`button.imp-card[aria-label="Suspect ${names[impostor]}"]`);
  await page.sleep(tall ? 700 : 900);
  await page.click('.imp-accuse');
}
