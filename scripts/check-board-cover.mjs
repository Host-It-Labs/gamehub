// Does a Mora board fill common windows edge to edge? Landscape boards are
// checked against desktop browser windows, portrait boards against phones.
//
//   node --experimental-strip-types scripts/check-board-cover.mjs [art.json ...]
//
// On a wide window the scene only reaches both side edges at the cover scale
// (window width / source width). At that scale every pad, rule label and
// Release must still sit between the top bar and the hand tray, so the play
// box has a maximum height and must lie inside a band of source rows. The
// report prints both for each window, then whether the board meets them.
// Windows are browser viewports (screen minus browser chrome), not screens.
import { readFileSync } from 'node:fs';
import { paperWorldFrame, paperWorldPlayBox } from '../lib/games/mora-world.ts';

export const desktopWindows = [
  [1920, 969],
  [1920, 1080],
  [1680, 939],
  [1600, 789],
  [1536, 730],
  [1536, 864],
  [1512, 850],
  [1470, 832],
  [1440, 789],
  [1440, 900],
  [1366, 657],
  [1280, 720],
  [1280, 800],
  [2560, 1305],
  [2560, 1440],
  // Browser zoom on a 1920x969 window.
  ...[1.1, 1.25].map((z) => [1920 / z, 969 / z]),
];
// Phones in portrait, full height (fullscreen, home-screen app, or Safari
// with its bars collapsed). Enforced.
export const phoneWindows = [
  [390, 844],
  [393, 852],
  [430, 932],
  [375, 812],
  [360, 780],
  [412, 915],
];
// Short phone windows (Safari with both bars showing, iPhone SE): the board
// gets only ~370 px between the HUD reserves; reported, not enforced. No
// accepted board has covered them.
export const shortPhoneWindows = [
  [390, 664],
  [430, 739],
  [375, 667],
];
// Same fixed stages as the CSS and tests/observatory-layout.test.mjs.
export const desktopStage = (w, h) => {
  const y = Math.min(h * 0.16, 180);
  return { x: 0, y, width: w, height: h - y - 118 };
};
export const phoneStage = (w, h) => ({
  x: 8,
  y: 100,
  width: w - 16,
  height: h - 292,
});

/** The largest play box height and the source rows it must lie within so the
 *  scene covers a w x h window. */
export function coverBudget(art, w, h) {
  const stage = desktopStage(w, h);
  const lean = stage.height * 0.06;
  const s = Math.max(w / art.width, h / art.height);
  return {
    scale: s,
    maxHeight: (stage.height + 2 * lean) / s,
    top: (stage.y - lean) / s,
    bottom: (stage.y + stage.height + lean - h + art.height * s) / s,
  };
}

export function coverReport(art) {
  const box = paperWorldPlayBox(art);
  const tall = art.height > art.width;
  const windows = tall
    ? [...phoneWindows, ...shortPhoneWindows.map(([w, h]) => [w, h, true])]
    : desktopWindows;
  return windows.map(([w, h, informational]) => {
    const stage = (tall ? phoneStage : desktopStage)(w, h);
    const f = paperWorldFrame(art, { width: w, height: h }, stage);
    const s = Math.max(w / art.width, h / art.height);
    const budget = tall
      ? {
          scale: s,
          maxHeight: stage.height / s,
          top: stage.y / s,
          bottom: (stage.y + stage.height - h + art.height * s) / s,
          maxWidth: stage.width / s / 1.06,
        }
      : coverBudget(art, w, h);
    return {
      w: Math.round(w),
      h: Math.round(h),
      covers: f.covers,
      informational: !!informational,
      ...budget,
      box,
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  let failed = false;
  const all = [
    'observatory-art',
    'observatory-portrait-art',
    'floodline-art',
    'floodline-portrait-art',
  ];
  for (const file of files.length
    ? files
    : all.map((n) => `lib/games/${n}.json`)) {
    const art = JSON.parse(readFileSync(file, 'utf8'));
    const rows = coverReport(art);
    const { box } = rows[0];
    console.log(
      `\n${file}: play box x ${Math.round(box.left)}..${Math.round(box.left + box.width)}, y ${Math.round(box.top)}..${Math.round(box.top + box.height)} (${Math.round(box.width)} x ${Math.round(box.height)} of ${art.width} x ${art.height})`,
    );
    for (const r of rows) {
      failed ||= !r.covers && !r.informational;
      console.log(
        `  ${r.covers ? 'ok  ' : r.informational ? 'gaps' : 'GAPS'} ${r.w}x${r.h}: needs height <= ${Math.round(r.maxHeight)}${r.maxWidth ? `, width <= ${Math.round(r.maxWidth)} centred` : ''}, rows ${Math.round(r.top)}..${Math.round(r.bottom)}${r.informational ? ' (short phone, reported only)' : ''}`,
      );
    }
  }
  if (failed) process.exitCode = 1;
}
