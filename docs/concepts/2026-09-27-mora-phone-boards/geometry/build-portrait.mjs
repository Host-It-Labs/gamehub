// Build a Mora portrait art JSON from measured pads, then report phone framing.
//   node --experimental-strip-types docs/concepts/2026-09-27-mora-phone-boards/geometry/build-portrait.mjs <geometry.json> [--write]
import fs from 'node:fs';
import { coverReport } from '../../../../scripts/check-board-cover.mjs';
import { paperWorldFrame, paperWorldPlayBox } from '../../../../lib/games/mora-world.ts';
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dy = spec.extendTop ?? 0;
const dx = spec.extendSide ?? 0;
const sh = ([x, y]) => [x + dx, y + dy];
const habitats = spec.zones.map((z) => {
  const slots = z.slots.map(sh), tw = spec.tokenWidth;
  const xs = slots.map((s) => s[0]), ys = slots.map((s) => s[1]);
  const left = Math.min(...xs) - 0.62 * tw, right = Math.max(...xs) + 0.62 * tw;
  const top = Math.min(...ys) - 0.72 * tw, bottom = Math.max(...ys) + 0.6 * tw;
  const label = z.label ? sh(z.label) : [Math.round(z.labelX ?? (left + right) / 2), Math.round(bottom + spec.labelGap)];
  return { zone: z.zone, bounds: [left, top, right - left, bottom - top].map(Math.round), label, slots, tokenWidth: tw, summary: z.summary };
});
const height = spec.height + dy + (spec.extendBottom ?? 0);
const art = {
  source: spec.source, image: spec.image, boardImage: spec.image.replace('.webp', '-board.webp'),
  width: spec.width + 2 * dx, height,
  crop: null,
  landmarks: { roofTop: spec.roofTop + dy, protectedBounds: spec.landmarks.map((l) => ({ name: l.name, bounds: [l.bounds[0] + dx, l.bounds[1] + dy, l.bounds[2], l.bounds[3]] })) },
  habitats, release: sh(spec.release),
  animation: {
    water: { polygon: spec.water.map(sh) },
    foliage: spec.foliage.map((f) => ({ polygon: f.polygon.map(sh), pivot: sh(f.pivot) })),
  },
  overview: null, overviewImage: spec.image.replace('.webp', '-overview.webp'),
};
// Gameplay crop: the play box with a little air; the overview adds the landmarks.
const box = paperWorldPlayBox({ ...art, crop: { left: 0, top: 0, width: 1, height: 1 } });
const pad = 20;
const clampBox = (l, t, r, b) => { l = Math.max(0, Math.round(l)); t = Math.max(0, Math.round(t)); r = Math.min(art.width, Math.round(r)); b = Math.min(height, Math.round(b)); return { left: l, top: t, width: r - l, height: b - t }; };
art.crop = clampBox(box.left - pad, box.top - pad, box.left + box.width + pad, box.top + box.height + pad);
const lm = art.landmarks.protectedBounds.map((l) => l.bounds);
art.overview = clampBox(Math.min(art.crop.left, ...lm.map((b) => b[0])) - 10, Math.min(art.crop.top, ...lm.map((b) => b[1])) - 10,
  Math.max(art.crop.left + art.crop.width, ...lm.map((b) => b[0] + b[2])) + 10, Math.max(art.crop.top + art.crop.height, ...lm.map((b) => b[1] + b[3])) + 10);
const key = ['source', 'image', 'boardImage', 'width', 'height', 'crop', 'landmarks', 'habitats', 'release', 'animation', 'overview', 'overviewImage'];
const ordered = Object.fromEntries(key.map((k) => [k, art[k]]));
console.log(`play box x ${Math.round(box.left)}..${Math.round(box.left + box.width)} y ${Math.round(box.top)}..${Math.round(box.top + box.height)} (${Math.round(box.width)}x${Math.round(box.height)})`);
for (const r of coverReport(ordered)) {
  const stage = { x: 8, y: 100, width: r.w - 16, height: r.h - 292 };
  const f = paperWorldFrame(ordered, { width: r.w, height: r.h }, stage);
  console.log(`${r.covers ? 'ok  ' : 'GAPS'} ${r.w}x${r.h} scale ${f.scale.toFixed(3)} pad ${(f.scale * spec.tokenWidth).toFixed(1)}px${r.informational ? ' (short)' : ''}`);
}
for (const [w, h] of [[768, 1024], [810, 1080], [820, 1180], [834, 1194], [1024, 1366]]) {
  const f = paperWorldFrame(ordered, { width: w, height: h }, { x: 8, y: 100, width: w - 16, height: h - 292 });
  console.log(`${f.covers ? 'ok  ' : 'gaps'} tablet ${w}x${h} scale ${f.scale.toFixed(3)}`);
}
if (process.argv.includes('--write')) fs.writeFileSync(spec.out, JSON.stringify(ordered, null, 2) + '\n');
