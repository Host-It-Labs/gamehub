// Sunset Motel and Glacier Dam world files from measured pads.
//   node --experimental-strip-types docs/concepts/2026-09-29-mora-new-boards/build.mjs [name ...] [--write]
// Pad centres come from scripts/measure-pads.mjs (a warmer cream threshold for
// the Motel) and were completed and checked by eye on overlays. Labels sit on
// the plain strip painted below each group. Zones: 0-2 square pads, 3, 4, 6 round.
import fs from 'node:fs';
import sharp from 'sharp';
import { paperWorldFrame, paperWorldPlayBox } from '../../../lib/games/mora-world.ts';
import { coverReport, phoneStage, phoneWindows } from '../../../scripts/check-board-cover.mjs';

const summaries = {
  // One short line each: phones give a label about 18 characters.
  motel: {
    0: '*Biggest* kind: 3 each',
    1: 'Up to *2* kinds: 3 each',
    2: '4 if on the *Road*',
    3: '*Repeat*: 3, else 1',
    4: '3 if *alone* here',
    6: '4 if in the *Pool*',
  },
  dam: {
    0: '*1·3·6·10* per kind',
    1: '*Pair* 7 · lone −2',
    2: 'Four *alike*: 16',
    3: '*Step* 1–5 if new',
    4: '*Habitats* · max 3',
    6: '1 per *same*, max 4',
  },
};

const specs = {
  'motel-art': {
    world: 'motel', name: 'mora-motel-landscape-v1-a', width: 1536, height: 1024, tokenWidth: 60,
    groups: [
      { zone: 0, slots: [[675, 639], [747, 638], [821, 638], [709, 695], [788, 696]], label: [932, 700] },
      { zone: 1, slots: [[653, 256], [730, 256], [651, 304], [731, 304]], label: [690, 352] },
      { zone: 2, slots: [[1143, 646], [1227, 646], [1318, 646]], label: [1243, 722] },
      { zone: 3, slots: [[1064, 286], [1143, 286], [1222, 286], [1301, 286], [1380, 286]], label: [1232, 362] },
      { zone: 4, slots: [[256, 588], [332, 587], [244, 646], [328, 646]], label: [270, 712] },
      { zone: 6, slots: [[219, 282], [304, 283]], label: [257, 352] },
    ],
    release: [770, 440],
    landmarks: [
      ['sign', [160, 70, 220, 275]], ['motel rooms', [465, 55, 460, 315]], ['road', [960, 195, 540, 190]],
      ['diner', [45, 405, 425, 335]], ['pool', [515, 525, 475, 280]], ['garage', [985, 405, 475, 345]],
    ],
    animation: {
      water: { polygon: [[560, 860], [1000, 858], [1010, 900], [560, 902]] },
      foliage: [
        { polygon: [[1070, 840], [1180, 838], [1185, 905], [1068, 908]], pivot: [1125, 915] },
        { polygon: [[1288, 770], [1372, 772], [1372, 830], [1290, 832]], pivot: [1330, 836] },
      ],
    },
  },
  'dam-art': {
    world: 'dam', name: 'mora-dam-landscape-v1-a', width: 1536, height: 1024, tokenWidth: 56,
    groups: [
      { zone: 0, slots: [[687, 547], [767, 547], [849, 547], [683, 606], [767, 606], [852, 606]], label: [1030, 582] },
      { zone: 1, slots: [[1208, 546], [1276, 548], [1356, 549], [1238, 605], [1323, 607]], label: [1288, 659] },
      { zone: 2, slots: [[705, 182], [777, 182], [705, 232], [780, 232]], label: [742, 288] },
      { zone: 3, slots: [[1079, 207], [1142, 207], [1206, 207], [1269, 207], [1333, 207]], label: [1206, 262] },
      { zone: 4, slots: [[193, 562], [270, 562], [348, 563], [227, 617], [309, 617]], label: [515, 590] },
      { zone: 6, slots: [[219, 206], [302, 209], [379, 205]], label: [300, 262] },
    ],
    release: [770, 378],
    landmarks: [
      ['summit hut', [140, 20, 310, 235]], ['cable car', [580, 20, 430, 290]], ['spillway', [990, 95, 470, 255]],
      ['ice cave', [0, 330, 480, 370]], ['reservoir', [540, 450, 510, 340]], ['turbine hall', [1050, 395, 430, 305]],
    ],
    animation: {
      water: { polygon: [[1330, 120], [1420, 150], [1425, 330], [1340, 340], [1320, 200]] },
      foliage: [
        { polygon: [[515, 140], [575, 140], [580, 240], [512, 242]], pivot: [545, 246] },
        { polygon: [[1488, 290], [1536, 290], [1536, 380], [1486, 382]], pivot: [1510, 386] },
      ],
    },
  },
  'motel-portrait-art': {
    // Variant b: variant a has a white haze along its left and bottom edges.
    world: 'motel', name: 'mora-motel-portrait-v1-b-ext', width: 1144, height: 2206, tokenWidth: 68,
    // Plate extended 300 px above, 370 below and 60 each side with its own mirrored scenery
    // (scripts/extend-paper-world.mjs, then extend-paper-world-sides.mjs).
    shift: [60, 300],
    groups: [
      { zone: 0, slots: [[151, 997], [242, 994], [335, 994], [193, 1077], [292, 1076]], label: [230, 1200] },
      { zone: 1, slots: [[253, 345], [340, 344], [248, 414], [339, 414]], label: [298, 505] },
      { zone: 2, slots: [[682, 438], [777, 438], [872, 438]], label: [777, 530] },
      { zone: 3, slots: [[226, 695], [369, 695], [513, 695], [657, 695], [800, 695]], label: [513, 790] },
      { zone: 4, slots: [[583, 1040], [674, 1040], [584, 1110], [674, 1110]], label: [575, 1212] },
      { zone: 6, slots: [[887, 1034], [903, 1112]], label: [915, 1205] },
    ],
    release: [330, 850],
    landmarks: [
      ['motel rooms', [55, 130, 460, 330]], ['garage', [590, 125, 410, 340]], ['road', [180, 640, 670, 110]],
      ['pool', [10, 840, 450, 340]], ['diner', [470, 880, 300, 340]], ['sign', [820, 860, 190, 300]],
    ],
    animation: { water: { polygon: [[420, 1360], [700, 1355], [705, 1440], [415, 1445]] }, foliage: [] },
  },
  'dam-portrait-art': {
    world: 'dam', name: 'mora-dam-portrait-v1-b-ext', width: 1284, height: 1986, tokenWidth: 64,
    // Plate extended 100 px above, 350 below and 130 each side with its own mirrored scenery.
    shift: [130, 100],
    groups: [
      { zone: 0, slots: [[185, 806], [284, 806], [383, 806], [180, 888], [281, 888], [383, 887]], label: [285, 982] },
      { zone: 1, slots: [[383, 1178], [487, 1178], [589, 1178], [427, 1255], [538, 1255]], label: [486, 1348] },
      { zone: 2, slots: [[686, 207], [771, 207], [689, 273], [776, 273]], label: [733, 366] },
      { zone: 3, slots: [[296, 506], [404, 502], [511, 501], [619, 503], [727, 505]], label: [512, 598] },
      { zone: 4, slots: [[690, 838], [777, 838], [864, 839], [730, 906], [826, 906]], label: [778, 1000] },
      { zone: 6, slots: [[192, 249], [283, 249], [373, 249]], label: [283, 342] },
    ],
    release: [790, 1240],
    landmarks: [
      ['summit hut', [120, 30, 330, 280]], ['cable car', [590, 40, 410, 300]], ['spillway', [200, 380, 640, 280]],
      ['reservoir', [60, 690, 470, 310]], ['ice cave', [590, 630, 410, 360]], ['turbine hall', [200, 1000, 560, 440]],
    ],
    animation: { water: { polygon: [[90, 400], [210, 400], [330, 640], [300, 690], [140, 690]] }, foliage: [] },
  },
};

function build(key) {
  const s = structuredClone(specs[key]);
  // Measured on the generated source; moved onto the extended plate.
  const [dx, dy] = s.shift ?? [0, 0];
  const move = ([x, y]) => [x + dx, y + dy];
  for (const g of s.groups) { g.slots = g.slots.map(move); g.label = move(g.label); }
  s.release = move(s.release);
  s.landmarks = s.landmarks.map(([n, [x, y, w, h]]) => [n, [x + dx, y + dy, w, h]]);
  s.animation.water.polygon = s.animation.water.polygon.map(move);
  for (const f of s.animation.foliage) { f.polygon = f.polygon.map(move); f.pivot = move(f.pivot); }
  const w = s.tokenWidth;
  const art = {
    source: `/art/${s.name}.png`,
    image: `/art/optimized/${s.name}.webp`,
    boardImage: `/art/optimized/${s.name}-board.webp`,
    width: s.width,
    height: s.height,
    crop: { left: 0, top: 0, width: s.width, height: s.height },
    landmarks: {
      roofTop: Math.min(...s.landmarks.map(([, b]) => b[1])),
      protectedBounds: s.landmarks.map(([name, bounds]) => ({ name, bounds })),
    },
    habitats: s.groups.map((g) => {
      const xs = g.slots.map((p) => p[0]), ys = g.slots.map((p) => p[1]);
      return {
        zone: g.zone,
        bounds: [Math.min(...xs) - w * 0.62, Math.min(...ys) - w * 0.72, Math.max(...xs) - Math.min(...xs) + w * 1.24, Math.max(...ys) - Math.min(...ys) + w * 1.32].map(Math.round),
        label: g.label,
        slots: g.slots,
        tokenWidth: w,
        summary: summaries[s.world][g.zone],
      };
    }),
    release: s.release,
    animation: s.animation,
    overview: { left: 0, top: 0, width: s.width, height: s.height },
    overviewImage: `/art/optimized/${s.name}-overview.webp`,
  };
  // The gameplay crop is the play box with a little air; the overview adds a band of scenery.
  const box = paperWorldPlayBox(art);
  const clamp = (r, W, H) => {
    const left = Math.max(0, Math.round(r.left)), top = Math.max(0, Math.round(r.top));
    return { left, top, width: Math.min(W - left, Math.round(r.width)), height: Math.min(H - top, Math.round(r.height)) };
  };
  const pad = (m) => ({ left: box.left - m, top: box.top - m, width: box.width + 2 * m, height: box.height + 2 * m });
  art.crop = clamp(pad(20), s.width, s.height);
  art.overview = clamp(pad(70), s.width, s.height);
  return { art, box };
}

const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let failed = false;
for (const key of names.length ? names : Object.keys(specs)) {
  if (!fs.existsSync(`public/art/${specs[key].name}.png`)) { console.log(key, 'source missing'); continue; }
  const { art, box } = build(key);
  const tall = art.height > art.width;
  const gaps = coverReport(art).filter((r) => !r.covers && !r.informational);
  console.log(key, 'play box', Object.values(box).map(Math.round).join(' '), gaps.length ? `GAPS ${gaps.map((r) => `${r.w}x${r.h}(max ${Math.round(r.maxHeight)})`).join(' ')}` : 'covers all');
  if (tall) {
    for (const [W, H] of [...phoneWindows, [768, 1024], [820, 1180]]) {
      const f = paperWorldFrame(art, { width: W, height: H }, phoneStage(W, H));
      const bad = art.landmarks.protectedBounds.filter(({ bounds: [x, y, bw, bh] }) => {
        const l = f.image.x + x * f.scale, t = f.image.y + y * f.scale;
        return l < -0.01 || t < -0.01 || l + bw * f.scale > W + 0.01 || t + bh * f.scale > H + 0.01;
      });
      console.log(' ', W, H, 'covers', f.covers, 'token', (f.scale * art.habitats[0].tokenWidth).toFixed(1), bad.length ? `cut: ${bad.map((b) => b.name)}` : '');
      failed ||= !f.covers || bad.length > 0;
    }
  }
  failed ||= gaps.length > 0;
  if (process.argv.includes('--write')) {
    fs.writeFileSync(`lib/games/${key}.json`, JSON.stringify(art, null, 2) + '\n');
    const src = 'public' + art.source;
    await sharp(src).webp({ quality: 92, effort: 6 }).toFile('public' + art.image);
    await sharp(src).extract(art.crop).webp({ quality: 92, effort: 6 }).toFile('public' + art.boardImage);
    await sharp(src).extract(art.overview).webp({ quality: 92, effort: 6 }).toFile('public' + art.overviewImage);
    console.log('  wrote', key);
  }
}
if (failed) process.exitCode = 1;
