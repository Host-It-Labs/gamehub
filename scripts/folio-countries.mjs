#!/usr/bin/env node
/**
 * Builds Folio's Worldle data from Natural Earth 1:110m admin-0 countries
 * (public domain, https://www.naturalearthdata.com).
 *
 *   node scripts/folio-countries.mjs path/to/ne_110m_admin_0_countries.geojson
 *
 * Writes lib/games/folio/country-data.ts (server: names, label points and
 * outlines normalised into a 200×200 box) and lib/games/folio/country-names.ts
 * (client-safe sorted names for the autocomplete).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) {
  console.error(
    'usage: node scripts/folio-countries.mjs <ne_110m_admin_0_countries.geojson>',
  );
  process.exit(1);
}
const root = fileURLToPath(new URL('..', import.meta.url));
const geo = JSON.parse(readFileSync(source, 'utf8'));

// Features that are not countries a player would name.
const SKIP = new Set([
  'Antarctica',
  'Fr. S. Antarctic Lands',
  'N. Cyprus',
  'Somaliland',
]);
// Common English names where Natural Earth's NAME_EN is formal or awkward.
const RENAME = {
  "People's Republic of China": 'China',
  'United States of America': 'United States',
  'The Bahamas': 'Bahamas',
  'The Gambia': 'Gambia',
  'Czech Republic': 'Czechia',
};
// Overseas pieces Worldle does not draw with the country.
const DROP = { France: (lon) => lon < -30, Norway: (_lon, lat) => lat > 72 };

const BOX = 200,
  PAD = 6;
const round = (n) => Math.round(n * 10) / 10;

function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return Math.abs(a / 2);
}
/** Douglas–Peucker on an open ring (first point repeated at the end). */
function simplify(points, tolerance) {
  if (points.length < 5) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a],
      [bx, by] = points[b];
    const dx = bx - ax,
      dy = by - ay,
      len = Math.hypot(dx, dy) || 1;
    let best = -1,
      far = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d =
        dx === 0 && dy === 0
          ? Math.hypot(px - ax, py - ay)
          : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > far) {
        far = d;
        best = i;
      }
    }
    if (far > tolerance && best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const out = [];
for (const f of geo.features) {
  const p = f.properties;
  if (SKIP.has(p.NAME)) continue;
  const name = RENAME[p.NAME_EN] ?? p.NAME_EN;
  const polygons =
    f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
  // Outer rings only; holes (e.g. Lesotho inside South Africa) are left out as
  // Worldle draws a solid silhouette.
  let rings = polygons.map((poly) => poly[0].map(([lon, lat]) => [lon, lat]));
  const drop = DROP[name];
  if (drop)
    rings = rings.filter((r) => {
      const [lon, lat] = r.reduce(
        (s, q) => [s[0] + q[0] / r.length, s[1] + q[1] / r.length],
        [0, 0],
      );
      return !drop(lon, lat);
    });
  // Pieces split at the antimeridian (Russia, Fiji): move them next to the rest.
  const lons = rings.flat().map((q) => q[0]);
  if (Math.max(...lons) - Math.min(...lons) > 180) {
    const east = p.LABEL_X > 0;
    rings = rings.map((r) => {
      const mean = r.reduce((s, q) => s + q[0], 0) / r.length;
      if (east && mean < 0) return r.map(([x, y]) => [x + 360, y]);
      if (!east && mean > 0) return r.map(([x, y]) => [x - 360, y]);
      return r;
    });
  }
  const lats = rings.flat().map((q) => q[1]);
  const mid = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const k = Math.cos(mid);
  let projected = rings.map((r) => r.map(([x, y]) => [x * k, -y]));
  const xs = projected.flat().map((q) => q[0]),
    ys = projected.flat().map((q) => q[1]);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const w = Math.max(...xs) - minX,
    h = Math.max(...ys) - minY;
  const scale = (BOX - 2 * PAD) / Math.max(w, h);
  const ox = (BOX - w * scale) / 2,
    oy = (BOX - h * scale) / 2;
  projected = projected.map((r) =>
    r.map(([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale]),
  );
  // Drop specks too small to see at the size the silhouette is drawn.
  const kept = projected
    .filter((r) => ringArea(r) >= 1.2)
    .map((r) => simplify(r, 0.1).map(([x, y]) => [round(x), round(y)]))
    .filter((r) => r.length >= 4);
  const path = kept
    .map((r) => {
      const pts = r.slice(0, -1);
      return 'M' + pts.map(([x, y]) => `${x},${y}`).join('L') + 'Z';
    })
    .join('');
  out.push({ name, lat: round(p.LABEL_Y), lon: round(p.LABEL_X), path });
}
out.sort((a, b) => a.name.localeCompare(b.name));
const names = out.map((c) => c.name);
if (new Set(names).size !== names.length) throw new Error('duplicate names');

const data = `// Generated by scripts/folio-countries.mjs from Natural Earth 1:110m admin-0
// countries (public domain). Server only. Do not edit by hand.
export type CountryRecord = { name: string; lat: number; lon: number; path: string };
export const COUNTRY_DATA: CountryRecord[] = [
${out.map((c) => `  { name: ${JSON.stringify(c.name)}, lat: ${c.lat}, lon: ${c.lon}, path: ${JSON.stringify(c.path)} },`).join('\n')}
];
`;
const list = `// Generated by scripts/folio-countries.mjs. Client-safe: names only.
export const COUNTRY_NAMES: readonly string[] = ${JSON.stringify(names, null, 2)};
`;
writeFileSync(`${root}lib/games/folio/country-data.ts`, data);
writeFileSync(`${root}lib/games/folio/country-names.ts`, list);
console.log(
  `${out.length} countries, ${(data.length / 1024).toFixed(0)} KB of outlines`,
);
