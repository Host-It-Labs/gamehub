import * as THREE from 'three';
import type { MapDef } from '@/lib/games/rota/maps';
import { DX, DY, RAIL } from '@/lib/games/rota/pieces';
import { EXIT_RUN, RAIL_RUN } from '@/lib/games/rota/routes';
import { FRONTAGE, HOUSE_DEPTH } from '@/lib/games/rota/scale';
import type { Materials } from './materials';
import { LANE_HALF, RING } from './ground';
import { prepareWindows } from './window-lights';
import { greenBlock, landscapes } from '@/lib/games/rota/landscape';

/**
 * The town round the site and the moors beyond it. Close in, an unbroken
 * terrace backs onto the site's hoarding all the way round, open only where
 * a main road or the railway leaves the board, so no back lane ever seems
 * to join a square. Beyond the lane that rings it, blocks of terraces stand
 * along back lanes that run on the board's grid; here and there a mill with its
 * chimney, a chapel, a gasholder. The streets and railways that leave the
 * board run on through it. Further out the houses thin into moorland with
 * dry-stone walls, farms and wind-bent trees; Harbour's docks open to the
 * sea, Ridge climbs its hills, Capital packs its blocks taller. Seeded by
 * the map, so every sheet of a match sits in the same town.
 *
 * The houses far off are drawn in code as plain massing (brick boxes with
 * slate roofs and stacks, a few windows): one merged mesh, cheap enough for
 * a few thousand; landmarks are the Blender models, instanced.
 */

export type Placement = {
  name: string;
  x: number;
  z: number;
  rot: number;
  scale: number;
  y?: number;
  /** Far out on the moors: no shadow of its own. */
  far?: boolean;
};

/** Mulberry32: a small seeded generator. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from a point to the board, zero on it. */
const boardDist = (n: number, x: number, z: number) =>
  Math.hypot(Math.max(0, -x, x - n), Math.max(0, -z, z - n));

function segDist(
  x: number,
  z: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
) {
  const dx = x1 - x0,
    dz = z1 - z0;
  const t = Math.max(
    0,
    Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t));
}

export type SceneryInput = {
  map: MapDef;
  /** Ground height at a board point, to find water and seat things. */
  height: (x: number, z: number) => number;
  /** River polylines off the board, kept clear. */
  rivers: { x: number; z: number }[][];
  /** Fewer houses on modest devices. */
  lite: boolean;
};

/** A row of terraced houses drawn in code. */
export type Row = {
  x: number;
  z: number;
  /** Turn about y; the fronts face +z at 0. */
  rot: number;
  houses: number;
  storeys: number;
  y: number;
  tint: number;
  windows: boolean;
};

/** Where the old town's chimneys smoke. */
export type Stack = { x: number; y: number; z: number };

export function planScenery({ map, height, rivers, lite }: SceneryInput) {
  const n = map.size;
  const landscape = landscapes[map.id];
  const r = rng(map.id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
  const out: Placement[] = [];
  const rows: Row[] = [];
  const stacks: Stack[] = [];
  const exits = map.exits.map((e) => {
    const cx = (e.cell % n) + 0.5,
      cz = Math.floor(e.cell / n) + 0.5;
    const x0 = cx + DX[e.dir] * 0.5,
      z0 = cz + DY[e.dir] * 0.5;
    const run = e.pier ? 1.2 : e.route === RAIL ? RAIL_RUN + 0.6 : EXIT_RUN + 2;
    return { ...e, x0, z0, x1: x0 + DX[e.dir] * run, z1: z0 + DY[e.dir] * run };
  });
  const taken: { x: number; z: number; r: number }[] = [];
  const clearOf = (x: number, z: number, rad: number) => {
    if (boardDist(n, x, z) < 0.62 + rad) return false;
    for (const e of exits) {
      const w = e.route === RAIL ? 0.3 : 0.26;
      if (segDist(x, z, e.x0, e.z0, e.x1, e.z1) < w + rad) return false;
      // The railway's tunnel mound.
      if (e.route === RAIL && !e.pier) {
        const tx = e.x0 + DX[e.dir] * (RAIL_RUN - 0.6),
          tz = e.z0 + DY[e.dir] * (RAIL_RUN - 0.6);
        if (Math.hypot(x - tx, z - tz) < 1.0 + rad) return false;
      }
    }
    for (const line of rivers)
      for (const p of line)
        if (Math.abs(p.x - x) < 0.35 + rad && Math.abs(p.z - z) < 0.35 + rad)
          return false;
    for (const [dx, dz] of [
      [0, 0],
      [rad, 0],
      [-rad, 0],
      [0, rad],
      [0, -rad],
    ])
      if (height(x + dx, z + dz) < -0.004) return false;
    for (const t of taken)
      if (Math.hypot(t.x - x, t.z - z) < t.r + rad) return false;
    return true;
  };
  const put = (
    name: string,
    x: number,
    z: number,
    rad: number,
    rot: number,
    scale = 1,
  ) => {
    if (!clearOf(x, z, rad)) return false;
    taken.push({ x, z, r: rad });
    out.push({ name, x, z, rot, scale, y: height(x, z) });
    return true;
  };

  // The camera sees more beyond the board's far edge than its near one.
  const inView = (x: number, z: number) =>
    x > -10 && x < n + 10 && z > -8 && z < n + 4.5;
  const town = landscape.town;

  // Exposed gritstone on Ridge's shoulders. These rocks have no tunnel:
  // only an actual railway arrival is allowed to suggest a way through.
  if (map.id === 'ridge') {
    for (const [x, z, rot, scale] of [
      [-3.8, -2.8, 0.25, 2.6],
      [n + 3.6, -2.8, -0.35, 3.0],
      [-4.2, n * 0.7, 0.7, 2.4],
      [n + 4, n + 1.4, -0.4, 2.8],
    ]) {
      put('rock_c', x, z, scale * 0.42, rot, scale * 6);
      put('rock_b', x + 1.3, z + 0.9, scale * 0.2, rot + 1, scale * 4);
    }
  }

  // Landmarks first: mills with their chimneys, chapels, gasholders.
  const landmarks = landscape.landmarks;
  for (let k = 0, tries = 0; k < landmarks && tries < 400; tries++) {
    // In a block of its own, between the streets.
    const x = Math.round(-6 + r() * (n + 12)),
      z = Math.round(-6 + r() * (n + 9));
    const d = boardDist(n, x, z);
    if (d < 1.9 || d > town - 0.5) continue;
    const roll = r();
    const rot = Math.round(r() * 4) * (Math.PI / 2);
    if (map.id === 'harbour' && roll < 0.4) {
      if (!put('warehouse_rail', x, z, 0.38, rot)) continue;
    } else if (roll < 0.5) {
      if (!put('mill_big', x, z, 0.5, rot)) continue;
      const cx = x + Math.cos(rot) * 0.55,
        cz = z - Math.sin(rot) * 0.55;
      if (put('chimney', cx, cz, 0.06, 0))
        stacks.push({ x: cx, y: height(cx, cz) + 1.0, z: cz });
    } else if (roll < 0.72) {
      if (!put('chapel', x, z, 0.28, rot)) continue;
    } else if (roll < 0.86) {
      if (!put('gasholder', x, z, 0.26, 0)) continue;
    } else if (!put('mill_small', x, z, 0.32, rot)) continue;
    k++;
  }
  // Free-standing works chimneys break the skyline.
  for (let k = 0, tries = 0; k < 4 && tries < 200; tries++) {
    const x = -5 + r() * (n + 10),
      z = -5 + r() * (n + 6);
    const d = boardDist(n, x, z);
    if (d < 1.7 || d > town) continue;
    if (put('chimney', x, z, 0.08, 0)) {
      stacks.push({ x, y: height(x, z) + 1.0, z });
      k++;
    }
  }

  // The ring of terraces round the site: a row fronting the ring lane and
  // one fronting the hoarding, back to back across their yards, along every
  // side. A way out breaks them; nothing else does.
  const tall = landscape.storeys;
  const front = RING - LANE_HALF - 0.05;
  const outer = front - HOUSE_DEPTH / 2,
    inner = outer - 0.4;
  const sides: {
    out: number;
    rot: number;
    along: 'x' | 'z';
    from: number;
    to: number;
    at: number;
  }[] = [];
  for (const [depth, reach] of [
    [outer, front],
    [inner, inner + HOUSE_DEPTH / 2],
  ] as const) {
    // Front and back rows run the full width; the sides fit between them.
    const end =
      depth === outer
        ? front - HOUSE_DEPTH - 0.01
        : inner - HOUSE_DEPTH / 2 - 0.01;
    const facesOut = depth === outer;
    sides.push(
      {
        out: 0,
        along: 'x',
        at: -depth,
        from: -reach,
        to: n + reach,
        rot: facesOut ? Math.PI : 0,
      },
      {
        out: 2,
        along: 'x',
        at: n + depth,
        from: -reach,
        to: n + reach,
        rot: facesOut ? 0 : Math.PI,
      },
      {
        out: 3,
        along: 'z',
        at: -depth,
        from: -end,
        to: n + end,
        rot: facesOut ? -Math.PI / 2 : Math.PI / 2,
      },
      {
        out: 1,
        along: 'z',
        at: n + depth,
        from: -end,
        to: n + end,
        rot: facesOut ? Math.PI / 2 : -Math.PI / 2,
      },
    );
  }
  for (const side of sides) {
    const slots = Math.floor((side.to - side.from) / FRONTAGE);
    const start = (side.from + side.to) / 2 - (slots * FRONTAGE) / 2;
    const free = Array.from({ length: slots }, (_, k) => {
      const u = start + (k + 0.5) * FRONTAGE;
      const x = side.along === 'x' ? u : side.at,
        z = side.along === 'x' ? side.at : u;
      const a = FRONTAGE / 2 - 0.01,
        b = HOUSE_DEPTH / 2;
      return [
        [x, z],
        side.along === 'x' ? [x - a, z - b] : [x - b, z - a],
        side.along === 'x' ? [x + a, z - b] : [x - b, z + a],
        side.along === 'x' ? [x - a, z + b] : [x + b, z - a],
        side.along === 'x' ? [x + a, z + b] : [x + b, z + a],
      ].every(([px, pz]) => clearOf(px, pz, 0.02));
    });
    // Runs of free plots, cut into rows of three to six houses.
    for (let k = 0; k < slots;) {
      if (!free[k]) {
        k++;
        continue;
      }
      let len = 0;
      const want = 3 + Math.floor(r() * 4);
      while (k + len < slots && free[k + len] && len < want) len++;
      const u = start + (k + len / 2) * FRONTAGE;
      const x = side.along === 'x' ? u : side.at,
        z = side.along === 'x' ? side.at : u;
      rows.push({
        x,
        z,
        rot: side.rot,
        houses: len,
        storeys: r() < 0.2 ? tall + 1 : tall,
        y: height(x, z),
        tint: r(),
        windows: true,
      });
      k += len;
    }
  }
  for (const side of sides)
    for (let u = side.from; u <= side.to; u += 0.25)
      taken.push(
        side.along === 'x'
          ? { x: u, z: side.at, r: 0.16 }
          : { x: side.at, z: u, r: 0.16 },
      );

  // Blocks of terraces between the old town's streets (which run on the
  // half-squares, as the board's exits do): two rows back to back with a
  // yard between, each block turned one way or the other by district.
  for (let gx = -11; gx < n + 11; gx++)
    for (let gz = -9; gz < n + 6; gz++) {
      const cx = gx,
        cz = gz;
      const d = boardDist(n, cx, cz);
      // The first ring is the terrace round the site.
      if (d < RING || d > town + (r() - 0.5) * 1.5 || !inView(cx, cz)) continue;
      if (lite && d > town - 2 && r() < 0.5) continue;
      // Authored green districts break up Meadow's streets and open Ridge
      // toward its slopes. Trees stand inside blocks, never on the lanes.
      if (greenBlock(map.id, gx, gz, n)) {
        const pine = map.id === 'ridge';
        put(
          pine ? 'pine_a' : 'oak_b',
          cx - 0.16,
          cz + 0.12,
          0.2,
          r() * 6,
          pine ? 1.8 : 1.65,
        );
        put(
          pine ? 'rock_c' : 'birch',
          cx + 0.22,
          cz - 0.2,
          0.12,
          r() * 6,
          pine ? 2.2 : 1.3,
        );
        if (!pine && r() > 0.45) put('stone_wall', cx, cz - 0.32, 0.09, 0, 0.7);
        taken.push({ x: cx, z: cz, r: 0.42 });
        continue;
      }
      const across = (Math.floor(gx / 3) + Math.floor(gz / 2)) % 2 === 0;
      const storeys = d < 3 && r() < 0.25 ? tall + 1 : r() < 0.15 ? 1 : tall;
      // Long bonded warehouses give the port a different roof rhythm.
      if (
        map.id === 'harbour' &&
        gx > n - 3 &&
        r() < 0.7 &&
        put('warehouse_rail', cx, cz, 0.38, Math.PI / 2)
      )
        continue;
      for (const side of [-1, 1]) {
        // A row along the block's edge, its back to the yard in the middle.
        const off = 0.2 * side;
        const x = across ? cx : cx + off,
          z = across ? cz + off : cz;
        const rot = across
          ? side > 0
            ? 0
            : Math.PI
          : side > 0
            ? Math.PI / 2
            : -Math.PI / 2;
        // Rows stop short of a route, the water and the site.
        let houses = 4;
        while (houses > 0) {
          const half = (houses * 0.2) / 2;
          const ax = across ? half : 0.13,
            az = across ? 0.13 : half;
          const ok = [
            [x - ax, z - az],
            [x + ax, z - az],
            [x - ax, z + az],
            [x + ax, z + az],
            [x, z],
          ].every(([px, pz]) => clearOf(px, pz, 0.02));
          if (ok) break;
          houses--;
        }
        if (!houses) continue;
        rows.push({
          x,
          z,
          rot,
          houses,
          storeys,
          y: height(x, z),
          tint: r(),
          windows: d < 3.5,
        });
      }
      taken.push({ x: cx, z: cz, r: 0.42 });
    }

  if (map.id === 'harbour') {
    // Cranes along the quay and ships at anchor in the dock.
    for (let k = 0, tries = 0; k < 4 && tries < 300; tries++) {
      const x = n - 3 + r() * 6,
        z = n - 3 + r() * 6;
      const h = height(x, z);
      if (h < -0.004 || boardDist(n, x, z) < 0.8) continue;
      // On the land at the water's edge.
      const wet = [
        [0.3, 0],
        [-0.3, 0],
        [0, 0.3],
        [0, -0.3],
      ].some(([dx, dz]) => height(x + dx, z + dz) < -0.03);
      if (!wet) continue;
      if (put('wharf_crane', x, z, 0.12, r() * Math.PI * 2)) k++;
    }
  }

  // The moors: walls, farms and wind-bent trees.
  const moorTrees = ['oak_a', 'oak_b', 'oak_c', 'pine_a', 'birch'];
  const moorFrom = out.length;
  for (let k = 0; k < (lite ? 70 : 130); k++) {
    const x = -14 + r() * (n + 28),
      z = -12 + r() * (n + 18);
    const d = boardDist(n, x, z);
    if (d < town - 0.5) continue;
    const roll = r();
    if (roll < 0.55)
      put(
        moorTrees[Math.floor(r() * moorTrees.length)],
        x,
        z,
        0.12,
        r() * 6,
        1.6 + r() * 0.6,
      );
    else if (roll < 0.85) {
      if (clearOf(x, z, 0.5))
        out.push({
          name: 'stone_wall',
          x,
          z,
          rot: Math.round(r() * 2) * (Math.PI / 2),
          scale: 1.2 + r(),
          y: height(x, z),
        });
    } else if (r() < 0.4) put('cottage', x, z, 0.2, r() * 6);
  }
  for (let i = moorFrom; i < out.length; i++) out[i].far = true;
  // A few trees between the houses nearer in.
  for (let k = 0; k < 60; k++) {
    const x = -6 + r() * (n + 12),
      z = -6 + r() * (n + 9);
    if (boardDist(n, x, z) < 1.7) continue;
    put(r() < 0.5 ? 'oak_a' : 'birch', x, z, 0.1, r() * 6, 1.5 + r() * 0.4);
  }
  return { placements: out, rows, stacks };
}

// ---------------------------------------------------------------- drawing

/** Brick tints for the old town's rows: sooty reds and browns, a few
 *  rendered and painted. */
const BRICK = [
  '#8a4a39',
  '#7d4334',
  '#94553f',
  '#6f3f33',
  '#a0644a',
  '#b9ab92',
  '#8c5a44',
];

/** One merged mesh for every row of houses, with vertex colours. */
export function townRows(rows: Row[], mats: Materials) {
  const walls: number[] = [],
    wallCol: number[] = [];
  const roofs: number[] = [];
  const glass: number[] = [];
  const stone: number[] = [];
  const doors: number[] = [],
    doorCol: number[] = [];
  const c = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const push = (arr: number[], pts: number[][], tf: THREE.Matrix4) => {
    for (const p of pts) {
      v.set(p[0], p[1], p[2]).applyMatrix4(tf);
      arr.push(v.x, v.y, v.z);
    }
  };
  /** Two triangles of a quad a, b, c, d (counterclockwise from outside). */
  const quad = (a: number[], b: number[], cc: number[], d: number[]) => [
    a,
    b,
    cc,
    a,
    cc,
    d,
  ];
  for (const row of rows) {
    const w = row.houses * 0.2,
      d = 0.26;
    const eaves = 0.03 + row.storeys * 0.095,
      ridge = eaves + 0.085;
    q.setFromAxisAngle(up, row.rot);
    m.compose(
      new THREE.Vector3(row.x, row.y - 0.02, row.z),
      q,
      new THREE.Vector3(1, 1, 1),
    );
    const x0 = -w / 2,
      x1 = w / 2,
      z0 = -d / 2,
      z1 = d / 2,
      y0 = 0,
      y1 = eaves + 0.02,
      yr = ridge + 0.02;
    const box = [
      ...quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]),
      ...quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]),
      ...quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]),
      ...quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]),
      // Gable ends.
      [x1, y1, z1],
      [x1, y1, z0],
      [x1, yr, 0],
      [x0, y1, z0],
      [x0, y1, z1],
      [x0, yr, 0],
    ];
    push(walls, box, m);
    c.set(BRICK[Math.floor(row.tint * BRICK.length)]);
    for (let i = 0; i < box.length; i++) wallCol.push(c.r, c.g, c.b);
    const over = 0.012;
    push(
      roofs,
      [
        ...quad(
          [x0 - over, y1 - 0.01, z1 + over],
          [x1 + over, y1 - 0.01, z1 + over],
          [x1 + over, yr, 0],
          [x0 - over, yr, 0],
        ),
        ...quad(
          [x1 + over, y1 - 0.01, z0 - over],
          [x0 - over, y1 - 0.01, z0 - over],
          [x0 - over, yr, 0],
          [x1 + over, yr, 0],
        ),
      ],
      m,
    );
    // A stack on every party wall.
    for (let k = 0; k <= row.houses; k++) {
      const sx = x0 + k * 0.2,
        s0 = yr - 0.02,
        s1 = yr + 0.05;
      const a = 0.018;
      push(
        walls,
        [
          ...quad(
            [sx - a, s0, a],
            [sx + a, s0, a],
            [sx + a, s1, a],
            [sx - a, s1, a],
          ),
          ...quad(
            [sx + a, s0, -a],
            [sx - a, s0, -a],
            [sx - a, s1, -a],
            [sx + a, s1, -a],
          ),
          ...quad(
            [sx + a, s0, a],
            [sx + a, s0, -a],
            [sx + a, s1, -a],
            [sx + a, s1, a],
          ),
          ...quad(
            [sx - a, s0, -a],
            [sx - a, s0, a],
            [sx - a, s1, a],
            [sx - a, s1, -a],
          ),
          ...quad(
            [sx - a, s1, a],
            [sx + a, s1, a],
            [sx + a, s1, -a],
            [sx - a, s1, -a],
          ),
        ],
        m,
      );
      for (let i = 0; i < 30; i++)
        wallCol.push(c.r * 0.85, c.g * 0.85, c.b * 0.85);
    }
    if (row.windows)
      for (let k = 0; k < row.houses; k++)
        for (let f = 0; f < row.storeys; f++) {
          const wy = 0.05 + f * 0.095;
          for (const u of [-0.045, 0.045]) {
            if (f === 0 && u < 0) continue;
            const wx = x0 + k * 0.2 + 0.1 + u;
            // Dark reveal behind the pane, cream sills and separate sash
            // bars in front: the light/curtains never paint over the frame.
            const face = z1 + 0.003;
            for (const [a, b, lo, hi] of [
              [wx - 0.024, wx - 0.02, wy - 0.003, wy + 0.053],
              [wx + 0.02, wx + 0.024, wy - 0.003, wy + 0.053],
              [wx - 0.024, wx + 0.024, wy - 0.004, wy],
              [wx - 0.024, wx + 0.024, wy + 0.05, wy + 0.054],
              [wx - 0.02, wx + 0.02, wy + 0.024, wy + 0.026],
              [wx - 0.001, wx + 0.001, wy, wy + 0.05],
            ])
              push(
                stone,
                quad(
                  [a, lo, face + 0.001],
                  [b, lo, face + 0.001],
                  [b, hi, face + 0.001],
                  [a, hi, face + 0.001],
                ),
                m,
              );
            push(
              glass,
              quad(
                [wx - 0.02, wy, z1 + 0.002],
                [wx + 0.02, wy, z1 + 0.002],
                [wx + 0.02, wy + 0.05, z1 + 0.002],
                [wx - 0.02, wy + 0.05, z1 + 0.002],
              ),
              m,
            );
          }
        }
    // Painted doors are on the exact doorway positions used by the walks.
    if (row.windows)
      for (let k = 0; k < row.houses; k++) {
        const dx = x0 + (k + 0.5) * FRONTAGE - 0.045;
        const face = z1 + 0.002;
        const paint = ['#344f45', '#5b3b38', '#3a465a', '#55554b'][
          (k + Math.floor(row.tint * 13)) % 4
        ];
        const door = quad(
          [dx - 0.015, 0.02, face],
          [dx + 0.015, 0.02, face],
          [dx + 0.015, 0.104, face],
          [dx - 0.015, 0.104, face],
        );
        push(doors, door, m);
        c.set(paint);
        for (let i = 0; i < door.length; i++) doorCol.push(c.r, c.g, c.b);
        push(
          glass,
          quad(
            [dx - 0.015, 0.104, face],
            [dx + 0.015, 0.104, face],
            [dx + 0.015, 0.114, face],
            [dx - 0.015, 0.114, face],
          ),
          m,
        );
        for (const [a, b, lo, hi] of [
          [dx - 0.019, dx - 0.015, 0.02, 0.118],
          [dx + 0.015, dx + 0.019, 0.02, 0.118],
          [dx - 0.019, dx + 0.019, 0.114, 0.118],
          [dx - 0.019, dx + 0.019, 0.02, 0.025],
          [dx - 0.015, dx + 0.015, 0.102, 0.104],
        ])
          push(
            stone,
            quad(
              [a, lo, face + 0.002],
              [b, lo, face + 0.002],
              [b, hi, face + 0.002],
              [a, hi, face + 0.002],
            ),
            m,
          );
      }
  }
  const group = new THREE.Group();
  const make = (
    pos: number[],
    mat: THREE.Material,
    col?: number[],
    windows = false,
  ) => {
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    else if (windows)
      g.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          new Float32Array(pos.length).fill(1),
          3,
        ),
      );
    if (windows) prepareWindows(g);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  make(walls, mats.tiled('brick', '#ffffff', { vertexColors: true }), wallCol);
  make(roofs, mats.tiled('slate', '#5b636b'));
  make(stone, mats.tiled('stone', '#c5bca7'));
  make(doors, mats.tiled('paint', '#ffffff', { vertexColors: true }), doorCol);
  make(glass, mats.windows(true), undefined, true);
  return group;
}

/** Instanced copies of models: one InstancedMesh per model part. */
export function instance(
  models: Map<string, THREE.Object3D>,
  mats: Materials,
  placements: Placement[],
  shadows = true,
) {
  const group = new THREE.Group();
  const byName = new Map<string, Placement[]>();
  for (const p of placements) {
    const list = byName.get(p.name);
    if (list) list.push(p);
    else byName.set(p.name, [p]);
  }
  const m = new THREE.Matrix4(),
    t = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const [name, list] of byName) {
    const src = models.get(name);
    if (!src) continue;
    const root = src.clone(true);
    mats.dress(root);
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const rel = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
      const inst = new THREE.InstancedMesh(
        mesh.geometry,
        mesh.material,
        list.length,
      );
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.rot);
        // A wall or a fence stretched along its length only.
        const along =
          name === 'hoarding' || name === 'stone_wall' || name === 'fence';
        t.compose(
          new THREE.Vector3(p.x, p.y ?? 0, p.z),
          q,
          along
            ? new THREE.Vector3(p.scale, 1, 1)
            : new THREE.Vector3(p.scale, p.scale, p.scale),
        );
        m.multiplyMatrices(t, rel);
        inst.setMatrixAt(i, m);
      });
      inst.castShadow = shadows;
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      group.add(inst);
    });
  }
  return group;
}
