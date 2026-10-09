import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RAIL, RIVER, ROAD, type Route } from '@/lib/games/rota/pieces';
import {
  liftAt,
  pointAt,
  segLength,
  stubEnd,
  type Segment,
  type Vec,
} from '@/lib/games/rota/routes';
import {
  BALLAST_HALF,
  BALLAST_TOP,
  CARRIAGE_HALF,
  CUTTING_HALF,
  GAUGE,
  PAVEMENT_TOP,
  RAIL_TOP,
  ROAD_TOP,
  STREET_HALF,
} from '@/lib/games/rota/scale';
import { toon, type Materials } from './materials';

/**
 * The mill town's streets and tracks, swept along Rota's route paths on the
 * routes' own height profile (`liftAt`): cobbled setts between kerbs and
 * flagstone pavements; single track of steel rails on dark sleepers and
 * cinder ballast; brick road bridges with parapets over the line, which
 * drops into a brick-walled cutting beneath; stone and iron bridges over
 * the rivers. Everything is in board coordinates (one square is one unit,
 * x east, z south, y up); the world shifts the board to its centre.
 */

export { ROAD_TOP };
const DECK = 0.025;
const PARAPET = 0.042;

type Sample = {
  x: number;
  z: number;
  tx: number;
  tz: number;
  y: number;
  s: number;
  /** Along the segment, 0–1. */
  t: number;
};

/** Points along a segment between t0 and t1, about `step` apart. */
export function samples(seg: Segment, t0 = 0, t1 = 1, step = 0.025): Sample[] {
  const len = segLength(seg.shape) * (t1 - t0);
  const n = Math.max(2, Math.ceil(len / step) + 1);
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * i) / (n - 1);
    const p = pointAt(seg, t);
    out.push({
      x: p.x,
      z: p.z,
      tx: p.tx,
      tz: p.tz,
      y: liftAt(seg.lift, t),
      s: (len * i) / (n - 1),
      t,
    });
  }
  return out;
}

/** A cross-section: lateral offset (right of travel) and height, per point. */
type Profile = (p: Sample) => [number, number][];

/**
 * Sweep an open cross-section along samples. Each edge of the section gets
 * its own strip of vertices, so creases stay sharp across the section and
 * smooth along the path.
 */
export function sweep(path: Sample[], profile: Profile) {
  const pos: number[] = [];
  const index: number[] = [];
  const sections = path.map((p) => profile(p));
  const m = sections[0].length;
  for (let e = 0; e < m - 1; e++) {
    const base = pos.length / 3;
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      // Right of travel, on the ground plane.
      const rx = -p.tz,
        rz = p.tx;
      for (const [l, h] of [sections[i][e], sections[i][e + 1]])
        pos.push(p.x + rx * l, h, p.z + rz * l);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const a = base + i * 2,
        b = a + 1,
        c = a + 2,
        d = a + 3;
      index.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- profiles

/** Under a deck: down to the ground on the ramps, a deck's thickness over
 *  the cutting (where the ground beneath has dropped away). */
const underside = (p: Sample) =>
  p.y > 0.02 && Math.abs(p.t - 0.5) * 1 < CUTTING_HALF + 0.015
    ? p.y - DECK
    : -0.004;
const raised = (p: Sample) => p.y > 0.004;

const setts: Profile = (p) => [
  [-CARRIAGE_HALF, ROAD_TOP + p.y],
  [CARRIAGE_HALF, ROAD_TOP + p.y],
];
/** A pavement on one side: kerb face, flagstones, outer edge; on a deck the
 *  outer edge rises into a parapet wall and drops to the ground. */
const pavement =
  (side: 1 | -1): Profile =>
  (p) => {
    const k = CARRIAGE_HALF * side,
      o = STREET_HALF * side;
    const top = PAVEMENT_TOP + p.y;
    const pts: [number, number][] = [
      [k, ROAD_TOP + p.y],
      [k, top],
      [o, top],
    ];
    if (raised(p))
      pts.push([o, top + PARAPET], [o + 0.012 * side, top + PARAPET]);
    pts.push([o + (raised(p) ? 0.012 * side : 0), underside(p)]);
    return side === 1 ? pts : pts.reverse();
  };
/** The kerb: a line of dressed granite along the pavement's edge, its face
 *  and top a little proud of the flags, so the street reads crisply. */
const KERB = 0.009;
const kerb =
  (side: 1 | -1): Profile =>
  (p) => {
    const k = CARRIAGE_HALF * side;
    const pts: [number, number][] = [
      [k - 0.0004 * side, ROAD_TOP + p.y],
      [k - 0.0004 * side, PAVEMENT_TOP + p.y + 0.0007],
      [k + KERB * side, PAVEMENT_TOP + p.y + 0.0007],
    ];
    return side === 1 ? pts : pts.reverse();
  };
/** The gutter: a run of darker setts along the foot of the kerb. */
const gutter =
  (side: 1 | -1): Profile =>
  (p) => {
    const k = CARRIAGE_HALF * side;
    const pts: [number, number][] = [
      [k - 0.014 * side, ROAD_TOP + p.y + 0.0004],
      [k - 0.0004 * side, ROAD_TOP + p.y + 0.0004],
    ];
    return side === 1 ? pts : pts.reverse();
  };
/** The underside of a deck over the cutting. */
const deckUnder: Profile = (p) => [
  [STREET_HALF + 0.012, underside(p)],
  [-STREET_HALF - 0.012, underside(p)],
];

const ballast: Profile = (p) => [
  [-BALLAST_HALF - 0.01, -0.004 + p.y],
  [-BALLAST_HALF + 0.022, BALLAST_TOP + p.y],
  [BALLAST_HALF - 0.022, BALLAST_TOP + p.y],
  [BALLAST_HALF + 0.01, -0.004 + p.y],
];
const railHead =
  (side: number): Profile =>
  (p) => {
    const c = (side * GAUGE) / 2;
    const bottom = BALLAST_TOP + 0.006 + p.y,
      top = RAIL_TOP + p.y;
    return [
      [c - 0.0055, bottom],
      [c - 0.0055, top],
      [c + 0.0055, top],
      [c + 0.0055, bottom],
    ];
  };
/** The cutting's floor and its brick walls, up to the ground. */
const cuttingFloor: Profile = (p) => [
  [-CUTTING_HALF, p.y - 0.002],
  [CUTTING_HALF, p.y - 0.002],
];
const cuttingWall =
  (side: 1 | -1): Profile =>
  (p) => {
    const c = CUTTING_HALF * side;
    const pts: [number, number][] = [
      [c, p.y - 0.004],
      [c, 0.0],
      [c + 0.02 * side, 0.0],
    ];
    return side === 1 ? pts : pts.reverse();
  };
/** A river bridge's sides: parapets, or the girders of an iron one. */
const bridgeSide =
  (half: number, side: 1 | -1, height: number): Profile =>
  (p) => {
    const c = half * side;
    const pts: [number, number][] = [
      [c, p.y + 0.004],
      [c, p.y + height],
      [c + 0.014 * side, p.y + height],
      [c + 0.014 * side, p.y - 0.03],
    ];
    return side === 1 ? pts : pts.reverse();
  };

/** Sleepers every 60 mm, as one merged mesh. */
function sleepers(path: Sample[]) {
  const len = path[path.length - 1].s;
  const count = Math.max(1, Math.floor(len / 0.06));
  const box = new THREE.BoxGeometry(0.155, 0.008, 0.024);
  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  let j = 0;
  for (let k = 0; k < count; k++) {
    const s = ((k + 0.5) / count) * len;
    while (j < path.length - 2 && path[j + 1].s < s) j++;
    const a = path[j],
      b = path[j + 1];
    const f = (s - a.s) / Math.max(1e-6, b.s - a.s);
    const x = a.x + (b.x - a.x) * f,
      z = a.z + (b.z - a.z) * f,
      y = a.y + (b.y - a.y) * f;
    const slope = Math.atan2(b.y - a.y, Math.max(1e-6, b.s - a.s));
    e.set(slope, Math.atan2(-a.tx, -a.tz), 0);
    q.setFromEuler(e);
    m.compose(
      new THREE.Vector3(x, BALLAST_TOP + 0.004 + y, z),
      q,
      new THREE.Vector3(1, 1, 1),
    );
    parts.push(box.clone().applyMatrix4(m));
  }
  box.dispose();
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

// ---------------------------------------------------------------- builders

export type RouteLook = {
  setts: THREE.Material;
  flags: THREE.Material;
  ballast: THREE.Material;
  sleeper: THREE.Material;
  rail: THREE.Material;
  brick: THREE.Material;
  coping: THREE.Material;
  iron: THREE.Material;
  plank: THREE.Material;
  kerb: THREE.Material;
  gutter: THREE.Material;
};

/** Dark warm setts and pale flagstones; cinder ballast under oiled
 *  sleepers and bright steel; sooty brick with sandstone coping. */
export function routeLook(mats: Materials): RouteLook {
  return {
    setts: mats.tiled('cobble', '#5a5a5e'),
    flags: mats.tiled('stone', '#c2b8a4'),
    ballast: mats.tiled('ballast', '#776d63'),
    sleeper: mats.tiled('wood', '#4d3c30'),
    rail: mats.tiled('metal', '#c9cdd2'),
    brick: mats.tiled('brick', '#8d4d3b'),
    coping: mats.tiled('stone', '#cbb894'),
    iron: mats.tiled('metal', '#3e4449'),
    plank: mats.tiled('wood', '#7a5a40'),
    kerb: mats.tiled('stone', '#82807b'),
    gutter: mats.tiled('cobble', '#3d3d41'),
  };
}

function mesh(
  g: THREE.BufferGeometry | null,
  m: THREE.Material,
  shadows = true,
) {
  if (!g) return null;
  const out = new THREE.Mesh(g, m);
  out.castShadow = shadows;
  out.receiveShadow = true;
  return out;
}

/** The part of a segment that is drawn: a station's tracks stop at its
 *  bank, its streets at the foot of its steps. */
function span(seg: Segment, stationHalf: number): [number, number] {
  if (seg.shape.type === 'stub' && seg.station)
    return [0, (0.5 - stubEnd(stationHalf, seg.kind) + 0.004) / 0.5];
  return [0, 1];
}

function street(
  seg: Segment,
  look: RouteLook,
  out: THREE.Object3D[],
  half: number,
) {
  const [t0, t1] = span(seg, half);
  const path = samples(seg, t0, t1);
  const lifted = seg.lift !== 'flat';
  out.push(
    mesh(sweep(path, setts), look.setts)!,
    mesh(sweep(path, pavement(-1)), lifted ? look.brick : look.flags)!,
    mesh(sweep(path, pavement(1)), lifted ? look.brick : look.flags)!,
  );
  for (const side of [-1, 1] as const)
    out.push(
      mesh(sweep(path, kerb(side)), look.kerb)!,
      mesh(sweep(path, gutter(side)), look.gutter)!,
    );
  if (lifted) {
    // Flagstones on the deck, sandstone coping on the parapets.
    out.push(
      mesh(
        sweep(path, (p) => [
          [-STREET_HALF, PAVEMENT_TOP + p.y + 0.0006],
          [-CARRIAGE_HALF, PAVEMENT_TOP + p.y + 0.0006],
        ]),
        look.flags,
      )!,
      mesh(
        sweep(path, (p) => [
          [CARRIAGE_HALF, PAVEMENT_TOP + p.y + 0.0006],
          [STREET_HALF, PAVEMENT_TOP + p.y + 0.0006],
        ]),
        look.flags,
      )!,
    );
    for (const side of [-1, 1] as const)
      out.push(
        mesh(
          sweep(path, (p) =>
            raised(p)
              ? [
                  [
                    side * (STREET_HALF - 0.003),
                    PAVEMENT_TOP + p.y + PARAPET + 0.001,
                  ],
                  [
                    side * (STREET_HALF + 0.015),
                    PAVEMENT_TOP + p.y + PARAPET + 0.001,
                  ],
                ]
              : [
                  [side * STREET_HALF, -1],
                  [side * STREET_HALF, -1],
                ],
          ),
          look.coping,
        )!,
      );
    out.push(mesh(sweep(path, deckUnder), look.brick)!);
  }
}

function track(
  seg: Segment,
  look: RouteLook,
  out: THREE.Object3D[],
  half: number,
) {
  const [t0, t1] = span(seg, half);
  const path = samples(seg, t0, t1, 0.02);
  out.push(
    mesh(sweep(path, ballast), look.ballast)!,
    mesh(sleepers(path), look.sleeper)!,
    mesh(sweep(path, railHead(-1)), look.rail)!,
    mesh(sweep(path, railHead(1)), look.rail)!,
  );
  if (seg.lift === 'cutting') {
    out.push(
      mesh(sweep(path, cuttingFloor), look.ballast)!,
      mesh(sweep(path, cuttingWall(-1)), look.brick)!,
      mesh(sweep(path, cuttingWall(1)), look.brick)!,
    );
    // Sandstone coping along the top of each wall.
    for (const side of [-1, 1] as const)
      out.push(
        mesh(
          sweep(path, () => [
            [side * (CUTTING_HALF - 0.004), 0.006],
            [side * (CUTTING_HALF + 0.022), 0.006],
          ]),
          look.coping,
        )!,
      );
  }
  if (seg.lift === 'bridge') {
    for (const side of [-1, 1] as const)
      out.push(
        mesh(
          sweep(path, bridgeSide(BALLAST_HALF + 0.012, side, 0.05)),
          look.iron,
        )!,
      );
  }
}

/** A thin slab between two heights, for the middle of a street junction. */
function slab(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  top: number,
  m: THREE.Material,
) {
  const g = new THREE.BoxGeometry(x1 - x0, top + 0.004, z1 - z0);
  g.translate((x0 + x1) / 2, (top - 0.004) / 2, (z0 + z1) / 2);
  const out = new THREE.Mesh(g, m);
  out.receiveShadow = true;
  return out;
}

/** A street junction: stubs from each side, a paved middle, pavements
 *  round the corners and across the sides no street leaves by. */
function junction(
  at: Vec,
  sides: number[],
  look: RouteLook,
  out: THREE.Object3D[],
) {
  const c = STREET_HALF;
  for (const a of sides) {
    const seg: Segment = {
      kind: ROAD,
      shape: { type: 'stub', a },
      at,
      lift: 'flat',
      junction: false,
      station: false,
    };
    const path = samples(seg, 0, (0.5 - c) / 0.5);
    out.push(
      mesh(sweep(path, setts), look.setts)!,
      mesh(sweep(path, pavement(-1)), look.flags)!,
      mesh(sweep(path, pavement(1)), look.flags)!,
    );
    for (const side of [-1, 1] as const)
      out.push(
        mesh(sweep(path, kerb(side)), look.kerb)!,
        mesh(sweep(path, gutter(side)), look.gutter)!,
      );
  }
  const k = CARRIAGE_HALF;
  // Kerbs round the corners and along the sides with no street.
  const edge = (x0: number, z0: number, x1: number, z1: number) => {
    const g = new THREE.BoxGeometry(
      Math.max(KERB, x1 - x0),
      PAVEMENT_TOP + 0.0007 - ROAD_TOP,
      Math.max(KERB, z1 - z0),
    );
    g.translate(
      at.x + (x0 + x1) / 2,
      (PAVEMENT_TOP + 0.0007 + ROAD_TOP) / 2,
      at.z + (z0 + z1) / 2,
    );
    const m = new THREE.Mesh(g, look.kerb);
    m.receiveShadow = true;
    out.push(m);
  };
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    // A corner's edge facing the carriageway: across from it is the arm
    // of a street (where one leaves by that side) or more pavement.
    const zx = sz * (k + KERB / 2),
      xz = sx * (k + KERB / 2);
    if (sides.includes(sx < 0 ? 3 : 1))
      edge(
        Math.min(sx * k, sx * c),
        zx - KERB / 2,
        Math.max(sx * k, sx * c),
        zx + KERB / 2,
      );
    if (sides.includes(sz < 0 ? 0 : 2))
      edge(
        xz - KERB / 2,
        Math.min(sz * k, sz * c),
        xz + KERB / 2,
        Math.max(sz * k, sz * c),
      );
  }
  for (let d = 0; d < 4; d++) {
    if (sides.includes(d)) continue;
    // The kerb across a side no street leaves by.
    const along = d % 2 === 0;
    const off = (d === 0 || d === 3 ? -1 : 1) * (k + KERB / 2);
    if (along) edge(-k, off - KERB / 2, k, off + KERB / 2);
    else edge(off - KERB / 2, -k, off + KERB / 2, k);
  }
  out.push(slab(at.x - c, at.z - c, at.x + c, at.z + c, ROAD_TOP, look.setts));
  // Corners, then the sides without a street.
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    out.push(
      slab(
        at.x + Math.min(sx * k, sx * c),
        at.z + Math.min(sz * k, sz * c),
        at.x + Math.max(sx * k, sx * c),
        at.z + Math.max(sz * k, sz * c),
        PAVEMENT_TOP,
        look.flags,
      ),
    );
  const dx = [0, 1, 0, -1],
    dz = [-1, 0, 1, 0];
  for (let d = 0; d < 4; d++) {
    if (sides.includes(d)) continue;
    const ax = dx[d],
      az = dz[d];
    // The strip between the corners along side d.
    const x0 = ax ? Math.min(ax * k, ax * c) : -k,
      x1 = ax ? Math.max(ax * k, ax * c) : k,
      z0 = az ? Math.min(az * k, az * c) : -k,
      z1 = az ? Math.max(az * k, az * c) : k;
    out.push(
      slab(
        at.x + x0,
        at.z + z0,
        at.x + x1,
        at.z + z1,
        PAVEMENT_TOP,
        look.flags,
      ),
    );
  }
}

/** Every mesh for one piece's segments. */
export function routeMeshes(
  segs: Segment[],
  look: RouteLook,
  stationHalf = 0.2,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  // Street junctions draw once per square, from the sides they join.
  const junctionSides = new Map<string, Set<number>>();
  for (const s of segs) {
    if (s.kind === RIVER) continue;
    if (s.kind === ROAD && s.junction) {
      const key = `${s.at.x},${s.at.z}`;
      const set = junctionSides.get(key) ?? new Set<number>();
      if (s.shape.type === 'straight')
        set.add(s.shape.a).add((s.shape.a + 2) % 4);
      if (s.shape.type === 'bend') set.add(s.shape.a).add(s.shape.b);
      junctionSides.set(key, set);
      continue;
    }
    if (s.kind === ROAD) street(s, look, out, stationHalf);
    else if (s.kind === RAIL) track(s, look, out, stationHalf);
  }
  for (const [key, sides] of junctionSides) {
    const [x, z] = key.split(',').map(Number);
    junction({ x, z }, [...sides], look, out);
  }
  // Stone parapets on a street bridge over a river.
  for (const s of segs)
    if (s.kind === ROAD && s.lift === 'bridge') {
      const path = samples(s);
      for (const side of [-1, 1] as const)
        out.push(
          mesh(sweep(path, bridgeSide(STREET_HALF, side, 0.04)), look.coping)!,
        );
    }
  return out;
}

/** The route one exit leads off the board by, or a wharf into the sea. */
export function exitMeshes(
  seg: Segment,
  look: RouteLook,
  pier: boolean,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  if (pier) {
    // A stone quay reaching into the dock, flush with the land.
    const path = samples(seg);
    const quay: Profile = () => [
      [-0.26, -0.08],
      [-0.26, 0.004],
      [0.26, 0.004],
      [0.26, -0.08],
    ];
    out.push(mesh(sweep(path, quay), look.coping)!);
  }
  if (seg.kind === ROAD) street(seg, look, out, 0);
  else track(seg, look, out, 0);
  return out;
}

export const routeKindName = (k: Route) =>
  k === ROAD ? 'street' : k === RAIL ? 'rail' : 'river';

/** A flat-coloured material for things made in code. */
export const plain = (hex: string) => toon(hex);

/** Merge meshes that share a material into one each: a square's street
 *  or track is a dozen swept strips, drawn in a few calls. */
export function mergeByMaterial(objects: THREE.Object3D[]): THREE.Object3D[] {
  const groups = new Map<
    THREE.Material,
    { geos: THREE.BufferGeometry[]; shadows: boolean }
  >();
  for (const o of objects) {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) continue;
    mesh.updateMatrix();
    const g = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    g.applyMatrix4(mesh.matrix);
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    const m = mesh.material as THREE.Material;
    const entry = groups.get(m) ?? { geos: [], shadows: false };
    entry.geos.push(g);
    entry.shadows ||= mesh.castShadow;
    groups.set(m, entry);
    mesh.geometry.dispose();
  }
  const out: THREE.Object3D[] = [];
  for (const [m, { geos, shadows }] of groups) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    out.push(mesh);
  }
  return out;
}
