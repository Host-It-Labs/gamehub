// Builds every Alto planet in each of its three years and checks that
// nothing collides: features never pass into each other, moons, rings and
// clouds clear everything standing, `reach` is the true extent, each year
// holds the one before, and the triangle and draw budgets hold.
//
//   node --experimental-strip-types scripts/alto-planet-check.mjs [ids…]

import { DoubleSide } from 'three';
import {
  buildPlanet,
  clearanceOf,
  planetLooks,
} from '../components/game/alto/alto-3d.ts';

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Object.keys(planetLooks);
const budget = { 1: 200_000, 2: 260_000, 3: 330_000 };
const DRAWS = 45;
const SLICES = 8;
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};

/** The distances from the centre each slice spans, and its reach. */
function slices(f) {
  const L = f.at.length();
  const h = (f.y1 - f.y0) / SLICES;
  return f.r.map((r, i) => ({
    lo: L + f.y0 + i * h,
    hi: L + f.y0 + (i + 1) * h,
    r,
  }));
}
const topOf = (f) => Math.max(...slices(f).map((s) => Math.hypot(s.hi, s.r)));

/** Walk every column of `a` (in small steps up) through `b`'s columns. */
function into(a, b) {
  const m = b.frame.clone().invert().multiply(a.frame);
  const e = m.elements;
  const c = a.cols;
  const C = b.cols;
  for (let i = 0; i < c.n; i++)
    for (let j = 0; j < c.n; j++) {
      const k = i * c.n + j;
      if (c.lo[k] > c.hi[k]) continue;
      const x = c.x0 + (i + 0.5) * c.cell;
      const z = c.z0 + (j + 0.5) * c.cell;
      const steps = Math.max(1, Math.ceil((c.hi[k] - c.lo[k]) / c.cell));
      for (let q = 0; q <= steps; q++) {
        const y = c.lo[k] + ((c.hi[k] - c.lo[k]) * q) / steps;
        const px = e[0] * x + e[4] * y + e[8] * z + e[12];
        const py = e[1] * x + e[5] * y + e[9] * z + e[13];
        const pz = e[2] * x + e[6] * y + e[10] * z + e[14];
        const I = Math.floor((px - C.x0) / C.cell);
        const J = Math.floor((pz - C.z0) / C.cell);
        if (I < 0 || J < 0 || I >= C.n || J >= C.n) continue;
        const K = I * C.n + J;
        if (py >= C.lo[K] && py <= C.hi[K]) return true;
      }
    }
  return false;
}
/** Both ways round, so a thin thing poking into a big one is caught too. */
function touch(a, b) {
  if (a.flat || b.flat) return false;
  if (a.at.distanceTo(b.at) >= Math.max(...a.r) + Math.max(...b.r))
    return false;
  return into(a, b) || into(b, a);
}
const latOf = (v, axis) =>
  Math.asin(Math.max(-1, Math.min(1, v.clone().normalize().dot(axis))));
function inBelt(f, axis, b) {
  const at = latOf(f.at, axis);
  return slices(f).some((s) => {
    const w = Math.atan2(s.r, s.lo);
    return (
      at - w < b.lat[1] &&
      b.lat[0] < at + w &&
      s.lo < b.r[1] &&
      b.r[0] < Math.hypot(s.hi, s.r)
    );
  });
}
const overlap = (a, b) => a[0] < b[1] && b[0] < a[1];

function count(planet) {
  let triangles = 0;
  let draws = 0;
  planet.group.updateMatrixWorld(true);
  planet.group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    // three draws a see-through double-sided mesh twice (back, then front).
    const twice = o.material.transparent && o.material.side === DoubleSide;
    triangles += n * (o.isInstancedMesh ? o.count : 1) * (twice ? 2 : 1);
    draws += Array.isArray(o.material) ? o.material.length : 1;
  });
  return { triangles: Math.round(triangles), draws };
}

const key = (f) => f.name;
for (const id of ids) {
  console.log(id);
  const years = [];
  for (const year of [1, 2, 3]) {
    const t0 = performance.now();
    const planet = buildPlanet(id, year);
    const ms = performance.now() - t0;
    planet.update(3, 0.016);
    const c = clearanceOf(planet);
    const { triangles, draws } = count(planet);
    const feet = c.feet;
    // Features against each other (a whale's sampled swim is one thing).
    let pairs = 0;
    for (let i = 0; i < feet.length; i++)
      for (let j = i + 1; j < feet.length; j++) {
        const a = feet[i];
        const b = feet[j];
        if (a.name === 'whale' && b.name === 'whale') continue;
        if (touch(a, b)) {
          pairs++;
          fail(`y${year} ${a.name} touches ${b.name}`);
        }
      }
    // Features against moons, rings and clouds.
    for (const f of feet)
      for (const b of c.belts)
        if (inBelt(f, c.axis, b))
          fail(`y${year} ${f.name} sweeps through ${b.name}`);
    // Belts against each other (clouds turn together, as one).
    for (let i = 0; i < c.belts.length; i++)
      for (let j = i + 1; j < c.belts.length; j++) {
        const a = c.belts[i];
        const b = c.belts[j];
        if (overlap(a.lat, b.lat) && overlap(a.r, b.r))
          fail(`y${year} ${a.name} meets ${b.name}`);
      }
    // Reach: the true extent of all that is drawn.
    let extent = c.ground;
    for (const f of feet) extent = Math.max(extent, topOf(f));
    for (const b of c.belts) extent = Math.max(extent, b.r[1]);
    if (Math.abs(extent - planet.reach) > 1e-6)
      fail(
        `y${year} reach ${planet.reach.toFixed(3)} but things reach ${extent.toFixed(3)}`,
      );
    if (planet.reach > 1.9)
      fail(`y${year} reach ${planet.reach.toFixed(3)} is over 1.9`);
    if (triangles > budget[year])
      fail(`y${year} ${triangles} triangles is over ${budget[year]}`);
    if (draws > DRAWS) fail(`y${year} ${draws} draws is over ${DRAWS}`);
    if (c.dropped.length) fail(`y${year} left out: ${c.dropped.join(', ')}`);
    // The same place every build.
    const again = clearanceOf(buildPlanet(id, year));
    const same =
      again.feet.length === feet.length &&
      again.feet.every((f, i) => f.frame.equals(feet[i].frame));
    if (!same) fail(`y${year} builds differently twice`);
    const tally = {};
    for (const f of feet) tally[key(f)] = (tally[key(f)] ?? 0) + 1;
    console.log(
      `  y${year}  ${String(triangles).padStart(6)} tris  ${String(draws).padStart(2)} draws  reach ${planet.reach.toFixed(3)}  ${ms.toFixed(0).padStart(4)} ms  ${feet.length} things, ${pairs} touching${c.cleared.length ? `, cleared ${c.cleared.join(' ')}` : ''}`,
    );
    years.push({ year, feet, cleared: c.cleared, tally });
  }
  // Each year holds the one before: whatever stood still stands, at (about)
  // the same spot, unless it was replaced or cleared for a new building.
  for (const [prev, next] of [
    [years[0], years[1]],
    [years[1], years[2]],
  ]) {
    const cleared = new Map();
    for (const c of next.cleared) {
      const name = c.split('@')[0];
      cleared.set(name, (cleared.get(name) ?? 0) + 1);
    }
    for (const f of prev.feet) {
      if (f.until !== undefined && f.until < next.year) continue;
      const home = f.at.clone().normalize();
      const kept = next.feet.some(
        (g) =>
          g.name === f.name && g.at.clone().normalize().angleTo(home) < 0.13,
      );
      if (kept) continue;
      const n = cleared.get(f.name) ?? 0;
      if (n > 0) cleared.set(f.name, n - 1);
      else fail(`y${prev.year} ${f.name} is gone in year ${next.year}`);
    }
    const more = Object.entries(next.tally)
      .filter(([k, v]) => v > (prev.tally[k] ?? 0))
      .map(([k, v]) => `${k} ${prev.tally[k] ?? 0}→${v}`);
    console.log(`  y${prev.year}→y${next.year}: ${more.join(', ')}`);
  }
}
console.log(failures ? `\n${failures} failures` : '\nAll clear.');
process.exit(failures ? 1 : 0);
