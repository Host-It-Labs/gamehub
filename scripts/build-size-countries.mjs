// Builds lib/games/party/size-countries.json for Sizes' country rounds.
// Usage: node scripts/build-size-countries.mjs <ne_50m_admin_0_countries.geojson>
// Source: Natural Earth 1:50m Admin 0 Countries (public domain),
// https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
// Each outline is drawn in its own Lambert azimuthal equal-area projection, in
// kilometres around its centre, so outlines compare at true relative size.
// Areas are official total areas (km²), which the game scores against.
import { readFileSync, writeFileSync } from 'node:fs';

/** [ISO A3, display name, total area km², keep polygons within km of centre,
 * optional projection centre when the label point sits off to one side] */
const countries = [
  ['RUS', 'Russia', 17098246, 6000, [99, 64]],
  ['CAN', 'Canada', 9984670, 4200],
  ['USA', 'the United States', 9833520, 5200, [-110, 45]],
  ['CHN', 'China', 9596961, 3200],
  ['BRA', 'Brazil', 8515767, 3000],
  ['AUS', 'Australia', 7692024, 2800],
  ['IND', 'India', 3287263, 2200],
  ['ARG', 'Argentina', 2780400, 2400],
  ['KAZ', 'Kazakhstan', 2724900, 1800],
  ['DZA', 'Algeria', 2381741, 1600],
  ['COD', 'DR Congo', 2344858, 1600],
  ['SAU', 'Saudi Arabia', 2149690, 1500],
  ['MEX', 'Mexico', 1964375, 2000],
  ['LBY', 'Libya', 1759540, 1200],
  ['IRN', 'Iran', 1648195, 1200],
  ['MNG', 'Mongolia', 1564110, 1300],
  ['PER', 'Peru', 1285216, 1200],
  ['ZAF', 'South Africa', 1221037, 1100],
  ['COL', 'Colombia', 1141748, 1100],
  ['ETH', 'Ethiopia', 1104300, 1000],
  ['EGY', 'Egypt', 1002450, 900],
  ['TZA', 'Tanzania', 947303, 900],
  ['NGA', 'Nigeria', 923768, 900],
  ['VEN', 'Venezuela', 916445, 900],
  ['TUR', 'Türkiye', 783562, 1000],
  ['CHL', 'Chile', 756102, 2400],
  ['UKR', 'Ukraine', 603550, 800],
  ['MDG', 'Madagascar', 587041, 900],
  ['KEN', 'Kenya', 580367, 700],
  ['FRA', 'France', 551695, 800],
  ['THA', 'Thailand', 513120, 1000],
  ['ESP', 'Spain', 505990, 900],
  ['SWE', 'Sweden', 450295, 1000],
  ['JPN', 'Japan', 377975, 1700],
  ['DEU', 'Germany', 357588, 600],
  ['FIN', 'Finland', 338455, 800],
  ['VNM', 'Vietnam', 331212, 1000],
  ['POL', 'Poland', 312696, 500],
  ['ITA', 'Italy', 302073, 800],
  ['PHL', 'the Philippines', 300000, 1200],
  ['NZL', 'New Zealand', 268021, 1000],
  ['GBR', 'the United Kingdom', 242495, 800],
  ['ROU', 'Romania', 238397, 500],
  ['BLR', 'Belarus', 207600, 500],
  ['KHM', 'Cambodia', 181035, 500],
  ['URY', 'Uruguay', 176215, 500],
  ['BGD', 'Bangladesh', 147570, 500],
  ['NPL', 'Nepal', 147516, 500],
  ['GRC', 'Greece', 131957, 600],
  ['CUB', 'Cuba', 109884, 700],
  ['ISL', 'Iceland', 103000, 400],
  ['KOR', 'South Korea', 100210, 500],
  ['HUN', 'Hungary', 93030, 400],
  ['AUT', 'Austria', 83879, 400],
  ['CZE', 'Czechia', 78871, 400],
  ['IRL', 'Ireland', 70273, 400],
  ['LKA', 'Sri Lanka', 65610, 400],
  ['CRI', 'Costa Rica', 51100, 400],
  ['DNK', 'Denmark', 42933, 400],
  ['NLD', 'the Netherlands', 41850, 300],
  ['CHE', 'Switzerland', 41285, 300],
  ['BEL', 'Belgium', 30689, 300],
  ['SVN', 'Slovenia', 20271, 300],
  ['JAM', 'Jamaica', 10991, 300],
  ['LBN', 'Lebanon', 10452, 300],
  ['LUX', 'Luxembourg', 2586, 200],
];

const file = process.argv[2];
if (!file)
  throw new Error('Pass the Natural Earth 50m countries GeoJSON path.');
const features = JSON.parse(readFileSync(file, 'utf8')).features;
const byIso = (iso) =>
  features.find((f) =>
    [f.properties.ISO_A3, f.properties.ADM0_A3].includes(iso),
  );

const rad = Math.PI / 180,
  R = 6371.0088;
function project([lng, lat], [lng0, lat0]) {
  const l = (((lng - lng0 + 540) % 360) - 180) * rad,
    p = lat * rad,
    p0 = lat0 * rad;
  const k = Math.sqrt(
    2 /
      (1 +
        Math.sin(p0) * Math.sin(p) +
        Math.cos(p0) * Math.cos(p) * Math.cos(l)),
  );
  return [
    R * k * Math.cos(p) * Math.sin(l),
    -R *
      k *
      (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
  ];
}
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a],
      [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay);
    let far = -1,
      best = tolerance;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = points[i];
      // A closed ring starts and ends on one point: measure from it.
      const d = len
        ? Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / len
        : Math.hypot(x - ax, y - ay);
      if (d > best) {
        best = d;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
const ringArea = (ring) =>
  Math.abs(
    ring.reduce((sum, [x, y], i) => {
      const [nx, ny] = ring[(i + 1) % ring.length];
      return sum + x * ny - nx * y;
    }, 0) / 2,
  );

const out = countries.map(([iso, name, area, reach, at]) => {
  const f = byIso(iso);
  if (!f) throw new Error(`Missing ${String(iso)}`);
  const centre = at ?? [f.properties.LABEL_X, f.properties.LABEL_Y];
  const polygons =
    f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
  // Outer rings only: lakes are not holes a player would picture.
  let rings = polygons
    .map((poly) => poly[0].map((pt) => project(pt, centre)))
    .filter((ring) => ring.some(([x, y]) => Math.hypot(x, y) <= reach));
  const xs = rings.flat().map((p) => p[0]),
    ys = rings.flat().map((p) => p[1]);
  const extent = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const tolerance = extent / 260;
  rings = rings
    .map((ring) => simplify(ring, tolerance))
    .filter(
      (ring) => ring.length >= 4 && ringArea(ring) >= (extent / 160) ** 2,
    );
  const ax = rings.flat().map((p) => p[0]),
    ay = rings.flat().map((p) => p[1]);
  const minX = Math.min(...ax),
    minY = Math.min(...ay),
    maxX = Math.max(...ax),
    maxY = Math.max(...ay);
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  const digits = extent < 400 ? 1 : 0;
  const d = rings
    .map(
      (ring) =>
        'M' +
        ring
          .map(([x, y]) =>
            [(x - cx).toFixed(digits), (y - cy).toFixed(digits)].join(' '),
          )
          .join('L') +
        'Z',
    )
    .join('');
  return {
    id: iso,
    name,
    area,
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
    path: d.replace(/-0(?=[ LZ])/g, '0'),
  };
});
writeFileSync(
  new URL('../lib/games/party/size-countries.json', import.meta.url),
  JSON.stringify(out) + '\n',
);
console.log(
  out.length,
  'countries,',
  Math.round(JSON.stringify(out).length / 1024),
  'KB',
);
