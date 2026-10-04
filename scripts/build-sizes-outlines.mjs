// Traces every Sizes silhouette mask into polygon outlines, so the 3D board
// can extrude them into solid pieces. Reads the optimized alpha-mask sheets
// and the cell boxes from size-silhouettes.json; writes size-outlines.json
// with, per sheet and cell, closed loops in pixels relative to the cell box
// (holes are told apart at runtime by containment).
// Usage: node scripts/build-sizes-outlines.mjs
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const BOXES = JSON.parse(
  await readFile('lib/games/party/size-silhouettes.json', 'utf8'),
);
const OUT = 'lib/games/party/size-outlines.json';
const EPSILON = 0.9; // Douglas-Peucker tolerance, in sheet pixels
const MIN_AREA = 30; // loops smaller than this (px²) are dust

/** Loops of crack edges around the solid pixels, clockwise on screen for
 * solids and anticlockwise for holes. */
function trace(solid, w, h) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x];
  const out = new Map();
  const key = (x, y) => y * (w + 1) + x;
  const add = (x0, y0, x1, y1) => {
    const k = key(x0, y0);
    const list = out.get(k);
    const e = { x0, y0, x1, y1, used: false };
    if (list) list.push(e);
    else out.set(k, [e]);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) add(x, y, x + 1, y);
      if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!at(x - 1, y)) add(x, y + 1, x, y);
    }
  const loops = [];
  for (const list of out.values())
    for (const start of list) {
      if (start.used) continue;
      const loop = [];
      let e = start;
      while (e && !e.used) {
        e.used = true;
        loop.push([e.x0, e.y0]);
        const next = (out.get(key(e.x1, e.y1)) ?? []).filter((n) => !n.used);
        if (next.length <= 1) e = next[0];
        else {
          // Two ways on at a pinch point: take the right-hand turn, so
          // pixels touching only at a corner stay separate pieces.
          const dx = e.x1 - e.x0,
            dy = e.y1 - e.y0;
          e =
            next.find((n) => n.x1 - n.x0 === -dy && n.y1 - n.y0 === dx) ??
            next[0];
        }
      }
      if (loop.length >= 4) loops.push(loop);
    }
  return loops;
}

function area(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i],
      [x1, y1] = loop[(i + 1) % loop.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function simplify(points, eps) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a],
      [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1,
      far = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > far) {
        far = d;
        worst = i;
      }
    }
    if (far > eps && worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Closed-loop simplification: split at the point farthest from the start. */
function simplifyLoop(loop, eps) {
  let far = 0,
    best = 0;
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > far) {
      far = d;
      best = i;
    }
  }
  const a = simplify(loop.slice(0, best + 1), eps),
    b = simplify([...loop.slice(best), loop[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

const result = { sheets: {} };
for (const [sheet, cells] of Object.entries(BOXES.sheets)) {
  const { data, info } = await sharp(
    `public/art/optimized/sizes-sil-${sheet}-v1.webp`,
  )
    .ensureAlpha()
    .resize(BOXES.size, BOXES.size, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stride = info.channels;
  result.sheets[sheet] = cells.map((c) => {
    const solid = new Uint8Array(c.w * c.h);
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        const i = ((c.y + y) * info.width + (c.x + x)) * stride;
        solid[y * c.w + x] = data[i + stride - 1] >= 128 ? 1 : 0;
      }
    return trace(solid, c.w, c.h)
      .filter((l) => Math.abs(area(l)) >= MIN_AREA)
      .map((l) => simplifyLoop(l, EPSILON))
      .filter((l) => l.length >= 3)
      .map((l) => l.flat());
  });
  const points = result.sheets[sheet].flat(2).length / 2;
  console.log(`${sheet}: ${cells.length} cells, ${points} points`);
}
await writeFile(OUT, JSON.stringify(result));
console.log(`wrote ${OUT}`);
