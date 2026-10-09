import type { MapDef } from './maps.ts';
import { DX, DY, RAIL } from './pieces.ts';
import { exitSegments, TUNNEL_AT } from './routes.ts';
import {
  CARRIAGE_HALF,
  FRONTAGE,
  HOUSE_DEPTH,
  PAVEMENT_TOP,
  RAIL_TOP,
  ROAD_TOP,
  STREET_HALF,
  TRACK_CLEAR,
} from './scale.ts';

/** Shared with the ground shader: these lanes never meet a board square. */
export const LANE_HALF = 0.095;
export const RING = 1.5;
const PAVEMENT = RING - LANE_HALF - 0.018;
/** Enlarged residents/pram must fit the same narrow residential pavements. */
const FOOT_RADIUS = 0.018;
/** A whole enlarged pram/dog can turn at an unprotected path end. */
const TURN_CLEARANCE = 0.1;
/** Old-town flags are painted in the ground shader, rather than raised. */
export const NEIGHBOURHOOD_FOOT_Y = 0.0015;
export const RAIL_WALK_RAMP = 0.12;
export const ROAD_WALK_RAMP = 0.03;

export type WalkPoint = { x: number; y: number; z: number };
export type WalkSpan = {
  a: WalkPoint;
  b: WalkPoint;
  length: number;
  /** -1 is pavement; otherwise an index in NeighbourhoodPlan.crossings. */
  crossing: number;
  /** A road span stays whole for safety while feet step over its two kerbs. */
  kerb?: { edge: number; road: number; half: number };
};
export type WalkRoute = {
  spans: WalkSpan[];
  length: number;
  doors: { distance: number; point: WalkPoint }[];
  loop: boolean;
  /** Actual terrace fronts facing the hoarding, visible close to the site. */
  near?: boolean;
};
export type CrossingSite = {
  x: number;
  y: number;
  z: number;
  kind: 'road' | 'rail';
  /** Pedestrians walk in this direction; traffic travels perpendicular. */
  axis: 'x' | 'z';
  /** Distance from the middle to either waiting kerb. */
  halfWidth: number;
  /** Index in the map's exits and the simulation's gate list. */
  exitIndex: number;
  /** The crossing's width along the vehicle's direction. */
  width: number;
};
export type NeighbourhoodPlan = {
  routes: WalkRoute[];
  crossings: CrossingSite[];
  lamps: WalkPoint[];
};

/** Only the row's footprint and its front are needed by the pure planner. */
export type NeighbourhoodRow = {
  x: number;
  z: number;
  rot: number;
  houses: number;
  windows: boolean;
};

/** Reused by the renderer's read-only traffic sensor. A is the leading body
 * end in the direction of travel, B the trailing end, including overhang. */
export type TrafficBody = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  width: number;
  speed: number;
  /** Conservative approach speed while accelerating on the exit run. */
  maxSpeed?: number;
  /** A known planned restart on this exit, never an assumed queue release. */
  restartIn?: number;
  kind: number;
  exitIndex?: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const distance = (a: WalkPoint, b: WalkPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Feet and pram axles share this allocation-free surface profile. */
export function walkSpanY(span: WalkSpan, t: number) {
  if (!span.kerb) return span.a.y + (span.b.y - span.a.y) * t;
  const d = Math.abs(t - 0.5) * span.length;
  const blend = clamp((d - span.kerb.half + 0.004) / 0.008, 0, 1);
  return span.kerb.road + (span.kerb.edge - span.kerb.road) * blend;
}

function segmentDistance(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const dx = bx - ax,
    dz = bz - az;
  const t = clamp(
    ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1),
    0,
    1,
  );
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

/** Seconds until a moving body touches the walkway; zero while its full body
 * occupies it. A stopped vehicle elsewhere and a body moving away are clear.
 * All wagons are sensed separately, so rear overhang must clear as well. */
export function crossingClearance(
  site: CrossingSite,
  bodies: readonly TrafficBody[],
  count = bodies.length,
) {
  let clearance = Infinity;
  const rail = site.kind === 'rail';
  for (let i = 0; i < count; i++) {
    const b = bodies[i];
    if ((b.kind === RAIL) !== rail) continue;
    if (b.exitIndex !== undefined && b.exitIndex !== site.exitIndex) continue;
    const aSide = site.axis === 'x' ? b.ax : b.az,
      bSide = site.axis === 'x' ? b.bx : b.bz,
      side = site.axis === 'x' ? site.x : site.z;
    if (
      Math.max(aSide, bSide) + b.width / 2 < side - site.halfWidth ||
      Math.min(aSide, bSide) - b.width / 2 > side + site.halfWidth
    )
      continue;
    const a = site.axis === 'x' ? b.az : b.ax,
      tail = site.axis === 'x' ? b.bz : b.bx,
      centre = site.axis === 'x' ? site.z : site.x,
      margin = site.width / 2 + 0.018;
    if (
      Math.min(a, tail) <= centre + margin &&
      Math.max(a, tail) >= centre - margin
    )
      return 0;
    // A vehicle on a parallel/distant street must not close this gate. On
    // the axial exit runs the travel component is effectively one.
    const len = Math.hypot(a - tail, aSide - bSide);
    if (len < 0.001 || Math.abs(a - tail) < len * 0.88) continue;
    const speed =
      b.speed >= 0.004 || b.restartIn !== undefined
        ? Math.max(b.speed, b.maxSpeed ?? b.speed)
        : 0;
    if (speed < 0.004) continue;
    const sign = Math.sign(a - tail);
    const ahead = (centre - a) * sign - margin;
    if (ahead < 0) continue;
    clearance = Math.min(
      clearance,
      Math.max(0, b.restartIn ?? 0) + ahead / speed,
    );
  }
  return clearance;
}

/** The ring pavement is the connected homeward walk. A few actual nearby
 * terrace fronts add short walks on their own pavement, ending before a
 * perpendicular lane. Exit roads/rails are crossed only at protected spans;
 * routes never follow those roads or enter the cleared site. */
export function planNeighbourhood(
  map: MapDef,
  rows: readonly NeighbourhoodRow[],
  height: (x: number, z: number) => number,
  offRivers: readonly (readonly { x: number; z: number }[])[],
): NeighbourhoodPlan {
  const n = map.size;
  const exits = exitSegments(map);
  const crossings: CrossingSite[] = [];
  const routes: WalkRoute[] = [];

  const land = (x: number, z: number) => {
    if (x >= -0.04 && x <= n + 0.04 && z >= -0.04 && z <= n + 0.04)
      return false;
    for (const [dx, dz] of [
      [0, 0],
      [FOOT_RADIUS, 0],
      [-FOOT_RADIUS, 0],
      [0, FOOT_RADIUS],
      [0, -FOOT_RADIUS],
    ])
      if (height(x + dx, z + dz) < -0.004) return false;
    for (const river of offRivers) {
      if (
        river.length === 1 &&
        Math.hypot(x - river[0].x, z - river[0].z) < 0.23
      )
        return false;
      for (let j = 1; j < river.length; j++)
        if (
          segmentDistance(
            x,
            z,
            river[j - 1].x,
            river[j - 1].z,
            river[j].x,
            river[j].z,
          ) < 0.23
        )
          return false;
    }
    for (let i = 0; i < exits.length; i++) {
      const e = exits[i];
      if (e.kind !== RAIL || map.exits[i].pier || e.shape.type !== 'line')
        continue;
      const dx = x - e.shape.from.x,
        dz = z - e.shape.from.z;
      const along = dx * DX[e.shape.dir] + dz * DY[e.shape.dir],
        across = dx * DY[e.shape.dir] - dz * DX[e.shape.dir];
      if (
        along > TUNNEL_AT - 0.07 &&
        along < e.shape.length + 0.07 &&
        Math.abs(across) < 0.59
      )
        return false;
    }
    return true;
  };
  const outsideHouses = (x: number, z: number, ignore = -1) => {
    for (let i = 0; i < rows.length; i++) {
      if (i === ignore) continue;
      const row = rows[i],
        c = Math.cos(row.rot),
        s = Math.sin(row.rot),
        dx = x - row.x,
        dz = z - row.z;
      if (
        Math.abs(dx * c - dz * s) < (row.houses * FRONTAGE) / 2 + FOOT_RADIUS &&
        Math.abs(dx * s + dz * c) < HOUSE_DEPTH / 2 + FOOT_RADIUS
      )
        return false;
    }
    return true;
  };
  const safe = (x: number, z: number, crossing = -1) => {
    if (!land(x, z) || !outsideHouses(x, z)) return false;
    for (let i = 0; i < exits.length; i++) {
      const e = exits[i];
      if (e.shape.type !== 'line') continue;
      const dx = DX[e.shape.dir],
        dz = DY[e.shape.dir];
      const d = segmentDistance(
        x,
        z,
        e.shape.from.x,
        e.shape.from.z,
        e.shape.from.x + dx * e.shape.length,
        e.shape.from.z + dz * e.shape.length,
      );
      if (d >= (e.kind === RAIL ? TRACK_CLEAR : CARRIAGE_HALF) + FOOT_RADIUS)
        continue;
      if (crossing < 0 || crossings[crossing].exitIndex !== i) return false;
    }
    return true;
  };
  const clearFrontageExit = (x: number, z: number) => {
    for (const e of exits) {
      if (e.shape.type !== 'line') continue;
      if (
        segmentDistance(
          x,
          z,
          e.shape.from.x,
          e.shape.from.z,
          e.shape.from.x + DX[e.shape.dir] * e.shape.length,
          e.shape.from.z + DY[e.shape.dir] * e.shape.length,
        ) <
        // Includes the enlarged pram's 0.0897 turning envelope and flags.
        (e.kind === RAIL ? TRACK_CLEAR : STREET_HALF) + TURN_CLEARANCE
      )
        return false;
    }
    return true;
  };

  exits.forEach((e, exitIndex) => {
    if (
      e.shape.type !== 'line' ||
      map.exits[exitIndex].pier ||
      e.shape.length <= PAVEMENT
    )
      return;
    const x = e.shape.from.x + DX[e.shape.dir] * PAVEMENT,
      z = e.shape.from.z + DY[e.shape.dir] * PAVEMENT;
    const axis = DX[e.shape.dir] === 0 ? 'x' : 'z';
    const halfWidth =
      e.kind === RAIL ? TRACK_CLEAR + 0.028 : CARRIAGE_HALF + 0.03;
    // A crossing is a single explicit span. Validate all of it before using
    // it, including the kerbs and the width of the little timber deck.
    const reach =
      e.kind === RAIL
        ? halfWidth + RAIL_WALK_RAMP
        : STREET_HALF + ROAD_WALK_RAMP;
    for (const u of [-reach, -halfWidth, 0, halfWidth, reach])
      for (const v of [-0.044, 0, 0.044]) {
        const px = x + (axis === 'x' ? u : v),
          pz = z + (axis === 'z' ? u : v);
        if (!land(px, pz) || !outsideHouses(px, pz)) return;
      }
    crossings.push({
      x,
      z,
      y: height(x, z) + (e.kind === RAIL ? RAIL_TOP : ROAD_TOP) + 0.001,
      kind: e.kind === RAIL ? 'rail' : 'road',
      axis,
      halfWidth,
      exitIndex,
      width: e.kind === RAIL ? 0.072 : 0.088,
    });
  });

  const spans: WalkSpan[] = [];
  let working: WalkSpan[] = [];
  const flush = () => {
    if (working.length && working.reduce((sum, s) => sum + s.length, 0) > 0.3) {
      routes.push({
        spans: working,
        length: working.reduce((sum, s) => sum + s.length, 0),
        doors: [],
        loop: false,
      });
    }
    working = [];
  };
  const edge = (
    axis: 'x' | 'z',
    at: number,
    from: number,
    to: number,
    protectedCrossings: boolean,
    residentialJunctions = true,
  ) => {
    const hits = protectedCrossings
      ? crossings
          .map((site, index) => ({ site, index }))
          .filter(
            ({ site }) =>
              site.axis === axis &&
              Math.abs((axis === 'x' ? site.z : site.x) - at) < 0.001,
          )
          .sort((a, b) =>
            axis === 'x' ? a.site.x - b.site.x : a.site.z - b.site.z,
          )
      : [];
    const cuts = [from, to];
    for (const { site } of hits) {
      const u = axis === 'x' ? site.x : site.z;
      const reach =
        site.kind === 'rail'
          ? site.halfWidth + RAIL_WALK_RAMP
          : STREET_HALF + ROAD_WALK_RAMP;
      cuts.push(u - reach, u - site.halfWidth, u + site.halfWidth, u + reach);
      if (site.kind === 'road') cuts.push(u - STREET_HALF, u + STREET_HALF);
    }
    cuts.sort((a, b) => a - b);
    const ascending: WalkSpan[] = [];
    const point = (u: number) => {
      const x = axis === 'x' ? u : at,
        z = axis === 'z' ? u : at;
      let y = height(x, z) + NEIGHBOURHOOD_FOOT_Y;
      for (const { site } of hits) {
        const dist = Math.abs(u - (axis === 'x' ? site.x : site.z));
        if (site.kind === 'rail' && dist <= site.halfWidth + RAIL_WALK_RAMP) {
          const blend = clamp(
            (site.halfWidth + RAIL_WALK_RAMP - dist) / RAIL_WALK_RAMP,
            0,
            1,
          );
          y += (site.y - y) * blend;
        } else if (
          site.kind === 'road' &&
          dist <= STREET_HALF + ROAD_WALK_RAMP
        ) {
          const blend = clamp(
            (STREET_HALF + ROAD_WALK_RAMP - dist) / ROAD_WALK_RAMP,
            0,
            1,
          );
          const kerbY = site.y - ROAD_TOP + PAVEMENT_TOP;
          y += (kerbY - y) * blend;
        }
      }
      return { x, y, z };
    };
    for (let k = 1; k < cuts.length; k++) {
      const a = cuts[k - 1],
        b = cuts[k];
      if (b - a < 0.0001) continue;
      const crossing =
        hits.find(
          ({ site }) =>
            Math.abs((a + b) / 2 - (axis === 'x' ? site.x : site.z)) <
            site.halfWidth,
        )?.index ?? -1;
      const count = crossing >= 0 ? 1 : Math.ceil((b - a) / 0.12);
      for (let j = 0; j < count; j++) {
        const p = point(a + ((b - a) * j) / count),
          q = point(a + ((b - a) * (j + 1)) / count),
          mid = point(a + ((b - a) * (j + 0.5)) / count);
        const clearJunction = (p: WalkPoint) => {
          if (protectedCrossings || !residentialJunctions) return true;
          const u = axis === 'x' ? p.x : p.z;
          return (
            Math.abs(u - (Math.round(u - 0.5) + 0.5)) >=
            LANE_HALF + TURN_CLEARANCE
          );
        };
        if (
          [p, q, mid].every(
            (point) =>
              safe(point.x, point.z, crossing) &&
              clearJunction(point) &&
              (residentialJunctions ||
                protectedCrossings ||
                clearFrontageExit(point.x, point.z)),
          )
        )
          ascending.push({
            a: p,
            b: q,
            length: distance(p, q),
            crossing,
            ...(crossing >= 0 && crossings[crossing].kind === 'road'
              ? {
                  kerb: {
                    edge: p.y,
                    road: crossings[crossing].y,
                    half: CARRIAGE_HALF,
                  },
                }
              : {}),
          });
        else ascending.push({ a: p, b: q, length: -1, crossing: -1 });
      }
    }
    if (from > to) ascending.reverse();
    for (const s of ascending) {
      if (from > to) {
        const p = s.a;
        s.a = s.b;
        s.b = p;
      }
      spans.push(s);
    }
  };

  edge('x', -PAVEMENT, -PAVEMENT, n + PAVEMENT, true);
  edge('z', n + PAVEMENT, -PAVEMENT, n + PAVEMENT, true);
  edge('x', n + PAVEMENT, n + PAVEMENT, -PAVEMENT, true);
  edge('z', -PAVEMENT, n + PAVEMENT, -PAVEMENT, true);
  for (const s of spans) {
    if (s.length < 0) flush();
    else working.push(s);
  }
  flush();
  // A dry ring is one loop. With water cuts, join the first and last arcs
  // only if they share the same dry corner; never jump over a missing span.
  if (routes.length) {
    const first = routes[0],
      last = routes[routes.length - 1];
    const a = first.spans[0].a,
      b = last.spans[last.spans.length - 1].b;
    if (distance(a, b) < 0.0001) {
      if (first === last) first.loop = true;
      else {
        first.spans = last.spans.concat(first.spans);
        first.length += last.length;
        routes.pop();
      }
    }
  }

  // The inner back-to-back terraces have genuine front doors facing the
  // hoarding. A few short doorstep walks here keep town life close to the
  // site, instead of hiding the whole crowd behind the outer slate roofs.
  // They stop before each exit; no new/unprotected crossing is introduced.
  const nearRows = rows
    .map((row, index) => ({
      row,
      index,
      d: Math.hypot(
        Math.max(0, -row.x, row.x - n),
        Math.max(0, -row.z, row.z - n),
      ),
    }))
    .filter(
      ({ row, d }) =>
        row.windows &&
        row.houses >= 3 &&
        d > 0.6 &&
        d < 1.0 &&
        (n / 2 - row.x) * Math.sin(row.rot) +
          (n / 2 - row.z) * Math.cos(row.rot) >
          0,
    )
    .sort(
      (a, b) =>
        a.row.z - b.row.z || b.row.houses - a.row.houses || a.index - b.index,
    );
  const nearDistricts = new Set<number>();
  for (const { row } of nearRows) {
    const nx = Math.sin(row.rot),
      nz = Math.cos(row.rot),
      axis = Math.abs(nx) < 0.5 ? 'x' : 'z',
      normal = axis === 'x' ? nz : nx,
      // The phone fits the cleared site tightly: short flags 5 m beyond its
      // fence remain visible while fronts 17 m out fall beyond its sides.
      at = normal > 0 ? -0.2 : n + 0.2,
      along = axis === 'x' ? row.x : row.z,
      half = (row.houses * FRONTAGE) / 2 - 0.035,
      district = row.z < 0 ? 0 : row.x > n ? 1 : row.z > n ? 2 : 3;
    if (nearDistricts.has(district)) continue;
    spans.length = 0;
    edge(axis, at, along - half, along + half, false, false);
    working = [];
    const before = routes.length;
    for (const s of spans) {
      if (s.length < 0) flush();
      else working.push(s);
    }
    flush();
    for (let i = before; i < routes.length; i++) routes[i].near = true;
    if (routes.length > before) nearDistricts.add(district);
    if (nearDistricts.size >= 4) break;
  }

  const extra = rows
    .map((row, index) => ({
      row,
      index,
      d: Math.hypot(
        Math.max(0, -row.x, row.x - n),
        Math.max(0, -row.z, row.z - n),
      ),
    }))
    .filter(
      ({ row, d }) =>
        row.windows && row.houses >= 3 && d > RING + 0.15 && d < 3.4,
    )
    .sort(
      (a, b) => a.d - b.d || b.row.houses - a.row.houses || a.index - b.index,
    );
  const districts = new Set<number>();
  for (const { row } of extra) {
    const nx = Math.sin(row.rot),
      nz = Math.cos(row.rot),
      axis = Math.abs(nx) < 0.5 ? 'x' : 'z';
    const normal = axis === 'x' ? nz : nx;
    const front = (axis === 'x' ? row.z : row.x) + (normal * HOUSE_DEPTH) / 2;
    const lane = Math.round(front - 0.5) + 0.5;
    const at = lane - Math.sign(normal) * (LANE_HALF + 0.018);
    const district = row.z < 0 ? 0 : row.x > n ? 1 : row.z > n ? 2 : 3;
    if (districts.has(district)) continue;
    const along = axis === 'x' ? row.x : row.z;
    const half = (row.houses * FRONTAGE) / 2 - 0.035;
    spans.length = 0;
    edge(axis, at, along - half, along + half, false);
    working = [];
    const before = routes.length;
    for (const s of spans) {
      if (s.length < 0) flush();
      else working.push(s);
    }
    flush();
    if (routes.length > before) districts.add(district);
    if (districts.size >= 4) break;
  }

  // Project actual terrace doors onto a nearby pavement, never onto a
  // crossing. The same -0.045 local door offset is used by townRows.
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!row.windows) continue;
    const c = Math.cos(row.rot),
      s = Math.sin(row.rot);
    for (let h = 0; h < row.houses; h++) {
      const u = (h + 0.5) * FRONTAGE - (row.houses * FRONTAGE) / 2 - 0.045,
        v = HOUSE_DEPTH / 2 + 0.002;
      const x = row.x + u * c + v * s,
        z = row.z - u * s + v * c;
      if (!land(x, z) || !outsideHouses(x, z, ri)) continue;
      let bestRoute: WalkRoute | null = null,
        bestDistance = 0,
        bestGap = Infinity;
      for (const route of routes) {
        let walked = 0;
        for (const span of route.spans) {
          const dx = span.b.x - span.a.x,
            dz = span.b.z - span.a.z;
          const t = clamp(
            ((x - span.a.x) * dx + (z - span.a.z) * dz) /
              (dx * dx + dz * dz || 1),
            0,
            1,
          );
          const px = span.a.x + dx * t,
            pz = span.a.z + dz * t;
          const gap = Math.hypot(x - px, z - pz);
          if (
            span.crossing < 0 &&
            gap < bestGap &&
            gap < (route.near ? 0.56 : 0.075) &&
            (x - px) * s + (z - pz) * c < -0.01
          ) {
            let approach = true;
            if (route.near) {
              const steps = Math.ceil(gap / 0.04);
              for (let k = 0; k <= steps; k++) {
                const u = k / steps,
                  ax = px + (x - px) * u,
                  az = pz + (z - pz) * u;
                if (
                  !land(ax, az) ||
                  !outsideHouses(ax, az, ri) ||
                  !clearFrontageExit(ax, az)
                ) {
                  approach = false;
                  break;
                }
              }
            }
            if (!approach) {
              walked += span.length;
              continue;
            }
            bestGap = gap;
            bestRoute = route;
            bestDistance = walked + span.length * t;
          }
          walked += span.length;
        }
      }
      if (bestRoute)
        bestRoute.doors.push({
          distance: bestDistance,
          point: { x, y: height(x, z) + NEIGHBOURHOOD_FOOT_Y, z },
        });
    }
  }
  for (const route of routes)
    route.doors.sort((a, b) => a.distance - b.distance);

  // No unused rail gear beside water. Remap indices after the dry arcs are
  // known, keeping crossing spans single so walkers cannot stop mid-track.
  const used = new Set<number>();
  for (const route of routes)
    for (const span of route.spans)
      if (span.crossing >= 0) used.add(span.crossing);
  const remap = new Map<number, number>();
  const kept = crossings.filter((_, i) => {
    if (!used.has(i)) return false;
    remap.set(i, remap.size);
    return true;
  });
  for (const route of routes)
    for (const span of route.spans)
      if (span.crossing >= 0) span.crossing = remap.get(span.crossing)!;

  const lamps: WalkPoint[] = [];
  for (const route of routes) {
    let walked = 0,
      next = 0.55;
    for (const span of route.spans) {
      if (span.crossing < 0 && walked + span.length >= next) {
        const t = clamp((next - walked) / span.length, 0, 1);
        let x = span.a.x + (span.b.x - span.a.x) * t,
          z = span.a.z + (span.b.z - span.a.z) * t;
        if (Math.abs(span.b.x - span.a.x) > Math.abs(span.b.z - span.a.z))
          z += z < n / 2 ? -0.011 : 0.011;
        else x += x < n / 2 ? -0.011 : 0.011;
        if (
          safe(x, z) &&
          !kept.some((p) => Math.hypot(p.x - x, p.z - z) < p.halfWidth + 0.12)
        )
          lamps.push({ x, y: height(x, z), z });
        next += 1.5;
      }
      walked += span.length;
    }
  }
  return { routes, crossings: kept, lamps };
}
