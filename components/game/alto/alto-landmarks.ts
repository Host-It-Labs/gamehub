import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { lump, m4, merge, part } from './alto-3d';
import {
  TAU,
  v3,
  C,
  vmat,
  kitMats,
  still,
  Bins,
  lathe,
  latheZ,
  rounded,
  rbox,
  cyl,
  sphere,
  dome,
  tube,
  aim,
  rod,
  extrude,
  roundRect,
  star,
  knurl,
  type Colour,
  type Upgrade,
  type Paint,
  type Pt,
} from './alto-kit';

/**
 * Models for the last trip's trophies and extras (Moon Base, Factory,
 * Observatory, Garage, Pool, Safe, Museum, Bazaar). They stand alone in the
 * shop and as modules of the player's home base (alto-base.ts): each a little
 * diorama on a round base, front towards +Z, its side details on the left
 * (−X), the side the shop's turntable and the base show.
 */

// ——— Shared pieces ———

const WHITE = '#f3f1ec';
const SEAM = '#c9ccd2';
const DARK = '#3b3f48';
const STEEL = '#c9d0d8';
const ORANGE = '#f0a040';
const GOLD = '#f2c14e';
const WOOD = '#b98450';
const WOOD_DARK = '#8f5d31';

const hash = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
/** A colour with a faint per-facet speckle, for ground and stone. */
const mottle =
  (hex: string, k = 0.06): Paint =>
  (c) =>
    C(hex).offsetHSL(0, 0, (hash(c.x, c.y, c.z) - 0.5) * k);
/** A plain box, for small strips and slats where a bevel would not show. */
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const glowMat = (hex: string, k = 0.8) =>
  vmat({ emissive: hex, emissiveIntensity: k, roughness: 0.35 });
const glassMat = (hex: string, opacity = 0.32) =>
  new THREE.MeshStandardMaterial({
    color: hex,
    transparent: true,
    opacity,
    roughness: 0.05,
    metalness: 0.2,
    depthWrite: false,
  });

/** The round display base every diorama stands on: its top at y = 0. */
function pad(
  b: Bins,
  r: number,
  top: Colour | Paint,
  side: Colour,
  band?: Colour,
  h = 0.08,
) {
  const pts: Pt[] = [
    [0, -h],
    [r - 0.03, -h],
    [r, -h + 0.03, 0.02],
    [r, -h * 0.66],
    [r + 0.006, -h * 0.62],
    [r + 0.006, -h * 0.38],
    [r, -h * 0.34],
    [r, -0.016, 0.012],
    [r - 0.016, 0, 0.012],
  ];
  for (let k = 1; k < 7; k++) pts.push([(r - 0.016) * (1 - k / 7), 0]);
  pts.push([0, 0]);
  b.add('paint', lathe(pts, 56, 3), (c, n) => {
    if (n.y > 0.8 && c.y > -0.004)
      return typeof top === 'function' ? top(c, n) : top;
    if (band && Math.hypot(c.x, c.z) > r + 0.0035) return band;
    return side;
  });
}

/** A round bush of a few overlapping balls, with berries. */
function bush(
  b: Bins,
  at: THREE.Matrix4,
  s: number,
  hex: string,
  berry?: string,
) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  const deep = C(hex).offsetHSL(0, 0, -0.06);
  for (const [x, y, z, r, c] of [
    [0, 0.55, 0, 0.62, hex],
    [-0.5, 0.35, 0.15, 0.45, deep],
    [0.48, 0.38, 0.1, 0.48, deep],
    [0.05, 0.4, 0.45, 0.45, hex],
    [-0.1, 0.95, -0.05, 0.4, hex],
  ] as const)
    b.add('paint', sphere(r * s, 16, 12), c, A(m4(x * s, y * s, z * s)));
  if (berry)
    for (const [x, y, z] of [
      [0.3, 0.75, 0.42],
      [-0.42, 0.62, 0.42],
      [0.1, 1.1, 0.25],
    ])
      b.add('paint', sphere(0.12 * s, 8, 6), berry, A(m4(x * s, y * s, z * s)));
}

/** A lumpy blob (bush, sack, smoke) with smooth shading. */
function blob(detail: number, rough: number, seed: number) {
  const g = lump(detail, rough, seed);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
}

/** One geometry from parts painted into a throwaway bin (for instancing). */
function geoOf(fill: (b: Bins) => void) {
  const scratch = new THREE.MeshBasicMaterial();
  const g = new THREE.Group();
  const b = new Bins({ paint: scratch });
  fill(b);
  b.into(g);
  scratch.dispose();
  return (g.children[0] as THREE.Mesh).geometry;
}

/** A cloth (flag, banner, awning) made of strips split at `splits` along u,
 * each strip its own colour, laid out by `place(u, v, t)` every frame. */
function cloth(
  splits: number[],
  sub: number,
  rows: number,
  colour: (strip: number, v: number) => Colour,
  place: (u: number, v: number, t: number, out: THREE.Vector3) => void,
) {
  const uv: number[] = [];
  const cols: number[] = [];
  const index: number[] = [];
  const k = new THREE.Color();
  for (let s = 0; s < splits.length - 1; s++) {
    const start = uv.length / 2;
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j <= sub; j++) {
        const v = i / rows;
        uv.push(splits[s] + ((splits[s + 1] - splits[s]) * j) / sub, v);
        k.set(colour(s, v));
        cols.push(k.r, k.g, k.b);
      }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < sub; j++) {
        const a = start + i * (sub + 1) + j;
        const c = a + sub + 1;
        index.push(a, a + 1, c, c, a + 1, c + 1);
      }
  }
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((uv.length / 2) * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(index);
  const mesh = new THREE.Mesh(
    g,
    vmat({ side: THREE.DoubleSide, roughness: 0.75 }),
  );
  const p = v3();
  const update = (t: number) => {
    for (let i = 0; i < uv.length / 2; i++) {
      place(uv[2 * i], uv[2 * i + 1], t, p);
      pos.set([p.x, p.y, p.z], 3 * i);
    }
    g.getAttribute('position').needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };
  update(0);
  return { mesh, update };
}

/** Puffs of smoke rising from each source, as one instanced draw. */
function smoke(sources: THREE.Vector3[], each = 4, size = 0.05) {
  const geo = merge(
    [
      [0, 0, 0, 1],
      [0.7, -0.15, 0.2, 0.7],
      [-0.6, -0.2, -0.1, 0.65],
    ].map(([x, y, z, r]) => part(sphere(r, 10, 8), '#eeeae4', m4(x, y, z))),
  );
  const n = sources.length * each;
  const mesh = new THREE.InstancedMesh(geo, vmat({ roughness: 0.95 }), n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = v3();
  const p = v3();
  const update = (t: number) => {
    sources.forEach((src, i) => {
      for (let j = 0; j < each; j++) {
        const ph = (t * 0.22 + j / each + i * 0.37) % 1;
        const k = size * (0.45 + ph * 1.1) * Math.min(1, (1 - ph) * 3);
        p.set(
          src.x + ph * 0.07 + Math.sin(ph * 6 + i) * 0.01,
          src.y + ph * 0.24,
          src.z + ph * 0.02,
        );
        s.setScalar(Math.max(0.001, k));
        q.setFromAxisAngle(v3(0, 1, 0), ph * 2 + j);
        mesh.setMatrixAt(i * each + j, m.compose(p, q, s));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  };
  update(0);
  return { mesh, update };
}

/** A round window: a lit pane in a steel ring, facing `dir` at `at`. */
function porthole(
  b: Bins,
  at: THREE.Vector3,
  dir: THREE.Vector3,
  r: number,
  pane = '#ffd27a',
) {
  const m = aim(at, dir);
  b.add('glow', cyl(r, r, 0.012, 16), pane, m);
  b.add(
    'metal',
    new THREE.TorusGeometry(r + 0.004, 0.008, 5, 18).rotateX(Math.PI / 2),
    STEEL,
    m,
  );
}
/** A point on a sphere round `c` at azimuth `az` (0 towards +Z) and elevation. */
const onSphere = (c: THREE.Vector3, r: number, az: number, el: number) => {
  const d = v3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  return { p: c.clone().addScaledVector(d, r), d };
};

/** An arched window outline (flat bottom, round top) standing on y = 0. */
function arch(w: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  return s;
}

/** A tyre with a hub, its axle along X. */
function wheel(b: Bins, at: THREE.Matrix4, r: number, w: number) {
  b.add(
    'paint',
    lathe(
      [
        [r * 0.5, -w / 2],
        [r * 0.92, -w / 2, r * 0.15],
        [r, 0, r * 0.2],
        [r * 0.92, w / 2, r * 0.15],
        [r * 0.5, w / 2],
      ],
      14,
      2,
    ).rotateZ(Math.PI / 2),
    '#34373f',
    at,
  );
  b.add(
    'metal',
    lathe(
      [
        [0, -w * 0.42],
        [r * 0.55, -w * 0.42, r * 0.1],
        [r * 0.55, w * 0.42, r * 0.1],
        [0, w * 0.42],
      ],
      12,
      1,
    ).rotateZ(Math.PI / 2),
    STEEL,
    at,
  );
}

/** A trapezoid bar (gold or ingot) lying along Z. */
function barGeo(w: number, h: number, len: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w * 0.36, h);
  s.lineTo(-w * 0.36, h);
  s.lineTo(-w / 2, 0);
  return extrude(s, len, Math.min(w, h) * 0.08, 1);
}

/** A closed wooden crate with battens round its faces. */
function crateParts(b: Bins, at: THREE.Matrix4, s: number, key = 'paint') {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  b.add(key, rbox(s * 0.94, s * 0.94, s * 0.94, s * 0.04, 1), '#c58e55', at);
  const t = s * 0.13;
  const e = s / 2 - t / 2;
  for (const [x, y] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    b.add(key, box(t, t, s), WOOD_DARK, A(m4(x * e, y * e, 0)));
    b.add(key, box(s, t, t), WOOD_DARK, A(m4(0, x * e, y * e)));
    b.add(key, box(t, s, t), WOOD_DARK, A(m4(x * e, 0, y * e)));
  }
  const len = Math.SQRT2 * (s - 2 * t);
  for (let k = 0; k < 4; k++)
    b.add(
      key,
      box(len, t * 0.8, t * 0.5),
      WOOD_DARK,
      A(
        m4(0, 0, 0, 0, (k * Math.PI) / 2, 0).multiply(
          m4(0, 0, s * 0.47, 0, 0, Math.PI / 4),
        ),
      ),
    );
}

/** An open market crate of slats; its inside floor at y = h * 0.25. */
function openCrate(
  b: Bins,
  at: THREE.Matrix4,
  w: number,
  h: number,
  d: number,
) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  const t = 0.012;
  b.add('paint', rbox(w, t, d, 0.004), WOOD_DARK, A(m4(0, h * 0.25, 0)));
  for (const [y, hh] of [
    [h * 0.4, h * 0.36],
    [h * 0.82, h * 0.3],
  ]) {
    for (const z of [-1, 1])
      b.add('paint', box(w, hh, t), '#d39a5e', A(m4(0, y, (z * (d - t)) / 2)));
    for (const x of [-1, 1])
      b.add(
        'paint',
        box(t, hh, d - 2 * t),
        '#c98f53',
        A(m4((x * (w - t)) / 2, y, 0)),
      );
  }
  for (const [x, z] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ])
    b.add(
      'paint',
      rbox(0.022, h, 0.022, 0.006),
      WOOD_DARK,
      A(m4((x * (w - 0.02)) / 2, h / 2 + 0.01, (z * (d - 0.02)) / 2)),
    );
}

// ——— Moon Base (trophy) ———

function rover(b: Bins, at: THREE.Matrix4) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  b.add('paint', rbox(0.1, 0.045, 0.15, 0.018), WHITE, A(m4(0, 0.07, 0)));
  b.add('paint', rbox(0.106, 0.012, 0.156, 0.005), ORANGE, A(m4(0, 0.053, 0)));
  b.add(
    'paint',
    rbox(0.08, 0.008, 0.08, 0.003),
    '#2f4f8f',
    A(m4(0, 0.096, -0.03)),
  );
  for (const x of [-0.013, 0.013])
    b.add(
      'paint',
      rbox(0.002, 0.009, 0.08, 0.001),
      SEAM,
      A(m4(x, 0.097, -0.03)),
    );
  // A camera head on a mast, two lenses looking ahead.
  b.add(
    'metal',
    rod(0.005, v3(0.02, 0.09, 0.05), v3(0.02, 0.15, 0.05)),
    STEEL,
    at,
  );
  b.add(
    'paint',
    rbox(0.05, 0.024, 0.028, 0.009),
    WHITE,
    A(m4(0.02, 0.16, 0.05)),
  );
  for (const x of [0.007, 0.033])
    b.add(
      'paint',
      cyl(0.0065, 0.0065, 0.008, 12).rotateX(Math.PI / 2),
      '#2a3150',
      A(m4(x, 0.16, 0.066)),
    );
  b.add(
    'metal',
    rod(0.003, v3(-0.03, 0.09, -0.06), v3(-0.03, 0.2, -0.07)),
    STEEL,
    at,
  );
  b.add('paint', sphere(0.011, 10, 8), ORANGE, A(m4(-0.03, 0.205, -0.07)));
  for (const s of [-1, 1]) {
    b.add(
      'paint',
      rbox(0.012, 0.014, 0.13, 0.004),
      DARK,
      A(m4(s * 0.056, 0.042, 0)),
    );
    for (const z of [-0.052, 0, 0.052])
      wheel(b, A(m4(s * 0.064, 0.026, z)), 0.026, 0.02);
  }
}

const moonBase = (): Upgrade => {
  const group = new THREE.Group();
  const mats = {
    ...kitMats(),
    glow: glowMat('#ffb04a', 0.75),
    glass: glassMat('#cfeeff', 0.3),
  };
  const b = new Bins(mats);
  pad(b, 0.53, mottle('#aeadbb', 0.05), '#5b5f6e', ORANGE);
  // Craters in the regolith.
  for (const [x, z, s] of [
    [-0.3, 0.36, 1],
    [0.38, 0.32, 0.8],
    [0.42, -0.16, 0.7],
    [0.1, 0.46, 0.5],
  ])
    b.add(
      'paint',
      lathe(
        [
          [0, 0.002],
          [0.04, 0.002],
          [0.054, 0.013, 0.008],
          [0.068, 0.004, 0.006],
          [0.078, 0],
        ],
        20,
        2,
      ),
      (c) => (Math.hypot(c.x, c.z) < 0.042 ? '#8f8e9c' : '#bdbcc9'),
      m4(x, 0, z, 0, 0, 0, s),
    );
  // The main dome: a white shell on a footing, an orange band, ribs.
  const R = 0.25;
  const W = 0.07;
  const dc = v3(0.02, 0, -0.08);
  const sc = v3(dc.x, W, dc.z);
  const at = m4(dc.x, 0, dc.z);
  const prof: Pt[] = [
    [0, 0.02],
    [R, 0.02],
    [R, W],
  ];
  for (let i = 1; i <= 14; i++) {
    const a = (i / 14) * (Math.PI / 2);
    prof.push([R * Math.cos(a), W + R * Math.sin(a)]);
  }
  b.add('paint', lathe(prof, 44, 2), WHITE, at);
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [R + 0.03, 0],
        [R + 0.03, 0.026, 0.008],
        [R, 0.032],
        [0, 0.032],
      ],
      56,
      2,
    ),
    '#6c7080',
    at,
  );
  b.add(
    'paint',
    new THREE.TorusGeometry(R + 0.004, 0.013, 6, 48).rotateX(Math.PI / 2),
    ORANGE,
    m4(dc.x, W, dc.z),
  );
  for (let k = 0; k < 6; k++) {
    const az = (k / 6) * TAU + TAU / 12;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++)
      pts.push(onSphere(sc, R + 0.003, az, 0.08 + (i / 8) * 1.12).p);
    b.add('paint', tube(pts, 0.0065, 10, 5), SEAM);
  }
  // A hatch ring on top, a mast and (below) the turning dish.
  b.add(
    'metal',
    lathe(
      [
        [0, W + R - 0.01],
        [0.075, W + R - 0.022],
        [0.078, W + R - 0.004, 0.006],
        [0.05, W + R + 0.012, 0.006],
        [0, W + R + 0.014],
      ],
      28,
      2,
    ),
    STEEL,
    at,
  );
  b.add(
    'metal',
    rod(0.012, v3(dc.x, W + R, dc.z), v3(dc.x, W + R + 0.11, dc.z), 10),
    '#9aa2ad',
  );
  for (const [az, el, r] of [
    [-0.85, 0.38, 0.036],
    [-1.75, 0.36, 0.036],
    [0.85, 0.38, 0.036],
    [-1.25, 0.86, 0.028],
    [0.0, 0.92, 0.028],
  ]) {
    const { p, d } = onSphere(sc, R, az, el);
    porthole(b, p, d, r);
  }
  // The airlock: a ribbed tunnel to a round-topped orange door and a lamp.
  const ty = 0.1;
  b.add(
    'paint',
    latheZ(
      [
        [0, 0.14],
        [0.078, 0.14],
        [0.078, 0.31, 0.01],
        [0.092, 0.316, 0.004],
        [0.092, 0.34, 0.004],
        [0, 0.342],
      ],
      32,
      2,
    ),
    WHITE,
    m4(dc.x, ty, dc.z),
  );
  for (const z of [0.2, 0.26])
    b.add(
      'paint',
      new THREE.TorusGeometry(0.08, 0.008, 6, 32),
      '#8a909c',
      m4(dc.x, ty, dc.z + z),
    );
  const door = m4(dc.x, ty - 0.012, dc.z + 0.345);
  const D = (m: THREE.Matrix4) => door.clone().multiply(m);
  b.add(
    'paint',
    extrude(arch(0.084, 0.12), 0.014, 0.004).translate(0, -0.06, 0),
    ORANGE,
    door,
  );
  porthole(b, v3(dc.x, ty + 0.012, dc.z + 0.356), v3(0, 0, 1), 0.018);
  b.add(
    'metal',
    rbox(0.026, 0.008, 0.008, 0.003),
    STEEL,
    D(m4(0.02, -0.02, 0.012)),
  );
  b.add(
    'paint',
    rbox(0.11, 0.016, 0.06, 0.006),
    '#6c7080',
    m4(dc.x, 0.008, dc.z + 0.37),
  );
  b.add(
    'glow',
    sphere(0.012, 10, 8),
    '#ffcf6a',
    m4(dc.x, ty + 0.1, dc.z + 0.33),
  );
  // The greenhouse dome on the left, linked by a ribbed tube.
  const gc = v3(-0.34, 0, 0.12);
  const Rg = 0.15;
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [Rg + 0.012, 0],
        [Rg + 0.012, 0.045, 0.006],
        [Rg, 0.05],
        [0, 0.05],
      ],
      40,
      2,
    ),
    (c) => (c.y > 0.02 && c.y < 0.032 ? ORANGE : WHITE),
    m4(gc.x, 0, gc.z),
  );
  b.add('glass', dome(Rg, 32, 10), '#ffffff', m4(gc.x, 0.05, gc.z));
  for (let k = 0; k < 6; k++) {
    const az = (k / 6) * TAU;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++)
      pts.push(
        onSphere(v3(gc.x, 0.05, gc.z), Rg + 0.002, az, (i / 8) * 1.45).p,
      );
    b.add('metal', tube(pts, 0.004, 12, 4), STEEL);
  }
  b.add(
    'metal',
    new THREE.TorusGeometry(Rg * Math.cos(0.7), 0.004, 4, 40).rotateX(
      Math.PI / 2,
    ),
    STEEL,
    m4(gc.x, 0.05 + Rg * Math.sin(0.7), gc.z),
  );
  b.add(
    'paint',
    cyl(Rg - 0.01, Rg - 0.01, 0.01, 28),
    '#6b4a2b',
    m4(gc.x, 0.055, gc.z),
  );
  for (const [x, z, s, hex] of [
    [-0.05, -0.03, 0.06, '#4f9e3f'],
    [0.05, 0.02, 0.05, '#63b14a'],
    [-0.01, 0.07, 0.04, '#4f9e3f'],
    [0.04, -0.07, 0.04, '#63b14a'],
  ] as const)
    b.add(
      'paint',
      sphere(1, 12, 8),
      hex,
      m4(gc.x + x, 0.075, gc.z + z, 0, 0, 0, [s, s * 0.85, s]),
    );
  for (const [x, z] of [
    [0.05, 0.02],
    [-0.05, -0.03],
  ])
    b.add(
      'paint',
      sphere(0.012, 8, 6),
      '#f05a4a',
      m4(gc.x + x, 0.115, gc.z + z),
    );
  const link = (a: THREE.Vector3, c: THREE.Vector3, r: number) => {
    b.add('paint', rod(r, a, c, 20), WHITE);
    const dir = c.clone().sub(a);
    for (const f of [0.3, 0.7])
      b.add(
        'paint',
        new THREE.TorusGeometry(r + 0.002, 0.006, 5, 18).rotateX(Math.PI / 2),
        '#8a909c',
        aim(a.clone().lerp(c, f), dir),
      );
  };
  link(
    v3(dc.x - 0.2, 0.075, dc.z + 0.08),
    v3(gc.x + 0.08, 0.06, gc.z - 0.05),
    0.04,
  );
  // A small sleeping dome on the right.
  const rc = v3(0.34, 0, 0.1);
  const Rr = 0.12;
  const pr: Pt[] = [
    [0, 0.015],
    [Rr, 0.015],
    [Rr, 0.04],
  ];
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    pr.push([Rr * Math.cos(a), 0.04 + Rr * Math.sin(a)]);
  }
  b.add('paint', lathe(pr, 40, 2), WHITE, m4(rc.x, 0, rc.z));
  b.add(
    'paint',
    new THREE.TorusGeometry(Rr + 0.003, 0.01, 6, 40).rotateX(Math.PI / 2),
    ORANGE,
    m4(rc.x, 0.04, rc.z),
  );
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [Rr + 0.02, 0],
        [Rr + 0.02, 0.02, 0.006],
        [0, 0.022],
      ],
      40,
      2,
    ),
    '#6c7080',
    m4(rc.x, 0, rc.z),
  );
  {
    const { p, d } = onSphere(v3(rc.x, 0.04, rc.z), Rr, -0.4, 0.45);
    porthole(b, p, d, 0.028);
  }
  link(
    v3(dc.x + 0.2, 0.075, dc.z + 0.08),
    v3(rc.x - 0.07, 0.06, rc.z - 0.04),
    0.034,
  );
  // A rover parked out front, a solar panel and a few supply tanks.
  rover(b, m4(-0.17, 0, 0.36, 0, -0.55, 0));
  const sp = m4(0.32, 0, -0.3, 0, -0.5, 0);
  const S = (m: THREE.Matrix4) => sp.clone().multiply(m);
  b.add('metal', rod(0.008, v3(0, 0, 0), v3(0, 0.16, 0)), '#9aa2ad', sp);
  b.add(
    'paint',
    rbox(0.2, 0.012, 0.13, 0.004),
    '#2c4a86',
    S(m4(0, 0.17, 0, 0.7, 0, 0)),
  );
  for (const x of [-0.05, 0, 0.05])
    b.add(
      'metal',
      rbox(0.003, 0.003, 0.13, 0.001),
      SEAM,
      S(m4(x, 0.17, 0, 0.7, 0, 0).multiply(m4(0, 0.007, 0))),
    );
  b.add(
    'metal',
    rbox(0.2, 0.003, 0.003, 0.001),
    SEAM,
    S(m4(0, 0.17, 0, 0.7, 0, 0).multiply(m4(0, 0.007, 0))),
  );
  for (const [x, z] of [
    [-0.42, -0.14],
    [-0.36, -0.22],
  ]) {
    b.add(
      'paint',
      lathe(
        [
          [0, 0],
          [0.03, 0, 0.006],
          [0.03, 0.09, 0.02],
          [0.01, 0.105, 0.004],
          [0, 0.105],
        ],
        14,
        3,
      ),
      (c) => (c.y > 0.05 && c.y < 0.065 ? WHITE : '#5aa0d8'),
      m4(x, 0, z),
    );
  }
  // The flag, flying from a pole behind the left of the dome.
  const fp = v3(-0.2, 0, -0.34);
  b.add('metal', rod(0.007, fp, v3(fp.x, 0.72, fp.z), 10), STEEL);
  b.add('metal', sphere(0.013, 10, 8), GOLD, m4(fp.x, 0.725, fp.z));
  b.into(group);
  const flag = cloth(
    [0, 0.28, 1],
    6,
    6,
    (s, v) => (s === 0 ? WHITE : v > 0.35 && v < 0.65 ? WHITE : ORANGE),
    (u, v, t, out) =>
      out.set(
        fp.x + u * 0.2,
        0.58 + v * 0.13 - u * u * 0.012,
        fp.z + Math.sin(u * 7 - t * 4) * 0.018 * u,
      ),
  );
  group.add(flag.mesh);
  // The dish turns slowly on its mast.
  const dish = new THREE.Group();
  dish.position.set(dc.x, W + R + 0.11, dc.z);
  const db = new Bins({ paint: mats.paint });
  const dk = 2.4;
  const rim = 0.075;
  const dp: Pt[] = [];
  for (let i = 0; i <= 8; i++)
    dp.push([(rim * i) / 8, dk * ((rim * i) / 8) ** 2 - 0.008]);
  for (let i = 8; i >= 0; i--)
    dp.push([(rim * i) / 8, dk * ((rim * i) / 8) ** 2]);
  const da = m4(0, 0.02, 0, Math.PI / 2 - 0.55, 0, 0);
  db.add('paint', lathe(dp, 32), WHITE, da);
  db.add('paint', cyl(0.02, 0.026, 0.03, 14), '#9aa2ad');
  db.add('paint', rod(0.004, v3(0, 0, 0), v3(0, 0.07, 0)), STEEL, da);
  db.add(
    'paint',
    sphere(0.012, 10, 8),
    ORANGE,
    da.clone().multiply(m4(0, 0.075, 0)),
  );
  db.into(dish);
  group.add(dish);
  return {
    group,
    update: (t) => {
      flag.update(t);
      dish.rotation.y = t * 0.7;
    },
  };
};

// ——— Factory (extra) ———

const factory = (): Upgrade => {
  const group = new THREE.Group();
  const mats = { ...kitMats(), glow: glowMat('#ffb04a', 0.7) };
  const b = new Bins(mats);
  pad(b, 0.54, mottle('#bdb6aa', 0.04), '#5a606b', '#f2c230');
  const brick = mottle('#c4593a', 0.1);
  const mortar = '#e2cdb2';
  const bw = 0.6;
  const bd = 0.42;
  const bh = 0.28;
  const bz = -0.12;
  const front = bz + bd / 2;
  b.add('paint', rbox(bw, bh, bd, 0.012), brick, m4(0, bh / 2, bz));
  b.add(
    'paint',
    rbox(bw + 0.024, 0.04, bd + 0.024, 0.01),
    '#8f8a84',
    m4(0, 0.02, bz),
  );
  b.add(
    'paint',
    rbox(bw + 0.03, 0.024, bd + 0.03, 0.008),
    '#efe4cf',
    m4(0, bh, bz),
  );
  for (const [x, z] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ])
    b.add(
      'paint',
      rbox(0.045, bh - 0.03, 0.045, 0.008),
      '#a9472c',
      m4((x * bw) / 2, bh / 2 + 0.01, bz + (z * bd) / 2),
    );
  // Mortar courses on the two faces the shop shows.
  for (let y = 0.075, row = 0; y < bh - 0.02; y += 0.034, row++) {
    b.add(
      'paint',
      box(bw - 0.05, 0.004, 0.004),
      mortar,
      m4(0, y, front + 0.001),
    );
    b.add(
      'paint',
      box(0.004, 0.004, bd - 0.05),
      mortar,
      m4(-bw / 2 - 0.001, y, bz),
    );
    for (let x = -0.26 + (row % 2) * 0.03; x < 0.26; x += 0.06)
      if (x < -0.005 || x > 0.27)
        b.add(
          'paint',
          box(0.004, 0.03, 0.004),
          mortar,
          m4(x, y + 0.017, front + 0.001),
        );
  }
  // Sawtooth roof: three teeth, glazed (and lit) on their steep faces.
  const td = bd / 3;
  const th = 0.11;
  const tooth = new THREE.Shape();
  tooth.moveTo(-td / 2, 0);
  tooth.lineTo(td / 2, 0);
  tooth.lineTo(td / 2, th);
  tooth.lineTo(-td / 2, 0);
  const toothGeo = extrude(tooth, bw - 0.01, 0.005, 1).rotateY(-Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const z = bz - bd / 2 + td / 2 + i * td;
    b.add(
      'paint',
      toothGeo,
      (_, n) =>
        Math.abs(n.x) > 0.9 ? '#b8513a' : n.z > 0.9 ? DARK : '#5d6879',
      m4(0, bh + 0.012, z),
    );
    b.add(
      'glow',
      rbox(bw - 0.06, th - 0.03, 0.006, 0.002),
      '#ffd27a',
      m4(0, bh + 0.012 + th / 2 - 0.004, z + td / 2 + 0.006),
    );
    for (let x = -0.24; x <= 0.241; x += 0.08)
      b.add(
        'metal',
        rbox(0.008, th - 0.024, 0.008, 0.002),
        STEEL,
        m4(x, bh + 0.012 + th / 2 - 0.004, z + td / 2 + 0.009),
      );
    b.add(
      'metal',
      rbox(bw - 0.05, 0.008, 0.01, 0.002),
      STEEL,
      m4(0, bh + 0.012 + th - 0.02, z + td / 2 + 0.009),
    );
  }
  // Two chimneys at the back, banded, open at the top.
  const chimneys = [v3(0.17, 0.62, bz - 0.12), v3(0.05, 0.55, bz - 0.15)];
  for (const c of chimneys) {
    b.add(
      'paint',
      lathe(
        [
          [0, bh],
          [0.05, bh],
          [0.046, c.y - 0.04],
          [0.058, c.y - 0.034, 0.004],
          [0.058, c.y, 0.004],
          [0.04, c.y],
          [0.04, c.y - 0.03],
          [0, c.y - 0.03],
        ],
        24,
        2,
      ),
      (p) =>
        p.y > c.y - 0.04
          ? '#4a4e58'
          : p.y > c.y - 0.1 && p.y < c.y - 0.07
            ? '#efe4cf'
            : mottle('#b8513a', 0.12)(p, p),
      m4(c.x, 0, c.z),
    );
  }
  // Arched windows, lit, on the front and the left side.
  const win = (at: THREE.Matrix4) => {
    b.add('paint', extrude(arch(0.085, 0.13), 0.012, 0.004), '#efe4cf', at);
    b.add(
      'glow',
      extrude(arch(0.06, 0.112), 0.012),
      '#ffd27a',
      at.clone().multiply(m4(0, 0.01, 0.004)),
    );
    const A = (m: THREE.Matrix4) => at.clone().multiply(m);
    b.add(
      'paint',
      rbox(0.006, 0.105, 0.006, 0.002),
      '#efe4cf',
      A(m4(0, 0.062, 0.012)),
    );
    b.add(
      'paint',
      rbox(0.06, 0.006, 0.006, 0.002),
      '#efe4cf',
      A(m4(0, 0.06, 0.012)),
    );
    b.add(
      'paint',
      rbox(0.1, 0.014, 0.03, 0.004),
      '#efe4cf',
      A(m4(0, -0.004, 0.008)),
    );
  };
  for (const x of [-0.22, -0.09]) win(m4(x, 0.07, front + 0.004));
  for (const z of [bz - 0.1, bz + 0.07])
    win(m4(-bw / 2 - 0.004, 0.07, z, 0, -Math.PI / 2, 0));
  // A gear sign over the door.
  const gear = knurl(0.042, 8, 0.012);
  gear.holes.push(new THREE.Path().absarc(0, 0, 0.014, 0, TAU, true));
  b.add(
    'paint',
    extrude(gear, 0.012, 0.003),
    '#f2c230',
    m4(0.13, 0.245, front + 0.01),
  );
  // The loading door: dark inside, a half-rolled door, hazard frame, canopy.
  const dx = 0.13;
  const dw = 0.17;
  const dh = 0.19;
  b.add(
    'paint',
    rbox(dw, dh, 0.01, 0.003),
    '#2a2622',
    m4(dx, dh / 2 + 0.005, front + 0.001),
  );
  for (let i = 0; i < 4; i++)
    b.add(
      'paint',
      rbox(dw - 0.004, 0.022, 0.01, 0.004),
      i % 2 ? '#8299b0' : '#7489a0',
      m4(dx, dh - 0.012 - i * 0.022, front + 0.008),
    );
  b.add(
    'paint',
    rbox(dw - 0.004, 0.008, 0.012, 0.003),
    DARK,
    m4(dx, dh - 0.1, front + 0.008),
  );
  for (let i = 0; i < 9; i++)
    b.add(
      'paint',
      rbox(dw / 9 + 0.002, 0.022, 0.016, 0.003),
      i % 2 ? '#2b2b30' : '#f2c230',
      m4(dx - dw / 2 + (i + 0.5) * (dw / 9), dh + 0.016, front + 0.008),
    );
  for (const s of [-1, 1])
    b.add(
      'paint',
      rbox(0.018, dh + 0.005, 0.016, 0.004),
      '#f2c230',
      m4(dx + (s * (dw + 0.018)) / 2, dh / 2 + 0.004, front + 0.008),
    );
  // The conveyor out of the door, with a pallet of crates at its end.
  const cz0 = front + 0.01;
  const cz1 = 0.46;
  const cy = 0.075;
  const cl = cz1 - cz0;
  const cm = (cz0 + cz1) / 2;
  b.add('paint', rbox(0.1, 0.012, cl, 0.004), '#2b2d33', m4(dx, cy, cm));
  for (const s of [-1, 1]) {
    b.add(
      'paint',
      rbox(0.012, 0.03, cl + 0.02, 0.005),
      '#5a8fc4',
      m4(dx + s * 0.058, cy - 0.004, cm),
    );
    for (const z of [cz0 + 0.04, cm, cz1 - 0.04])
      b.add(
        'metal',
        rod(0.006, v3(dx + s * 0.055, 0, z), v3(dx + s * 0.055, cy - 0.01, z)),
        STEEL,
      );
  }
  for (const z of [cz0 + 0.004, cz1])
    b.add(
      'metal',
      cyl(0.012, 0.012, 0.11, 14).rotateZ(Math.PI / 2),
      STEEL,
      m4(dx, cy - 0.002, z),
    );
  b.add('paint', rbox(0.14, 0.02, 0.12, 0.004), WOOD, m4(-0.13, 0.01, 0.34));
  crateParts(b, m4(-0.15, 0.072, 0.33, 0, 0.2, 0), 0.1);
  crateParts(b, m4(-0.11, 0.165, 0.34, 0, -0.3, 0), 0.085);
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.035, 0, 0.004],
        [0.038, 0.03],
        [0.035, 0.06],
        [0.038, 0.09],
        [0.035, 0.12, 0.004],
        [0, 0.12],
      ],
      20,
      2,
    ),
    (c) =>
      Math.abs(c.y - 0.03) < 0.006 || Math.abs(c.y - 0.09) < 0.006
        ? DARK
        : '#3f82c4',
    m4(-0.32, 0, 0.18),
  );
  b.into(group);
  // Crates ride the belt out of the door.
  const crateG = geoOf((cb) => crateParts(cb, m4(), 0.07));
  const crates = new THREE.InstancedMesh(crateG, mats.paint, 3);
  const puff = smoke(
    chimneys.map((c) => v3(c.x, c.y + 0.02, c.z)),
    4,
    0.04,
  );
  group.add(crates, puff.mesh);
  const cm4 = new THREE.Matrix4();
  const ride = (t: number) => {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.12 + i / 3) % 1;
      const z = cz0 - 0.05 + ph * (cl + 0.02);
      const s = Math.min(1, (1 - ph) * 10);
      crates.setMatrixAt(
        i,
        cm4.compose(
          v3(dx, cy + 0.006 + 0.035 * s, z),
          new THREE.Quaternion(),
          v3(s, s, s).max(v3(0.001, 0.001, 0.001)),
        ),
      );
    }
    crates.instanceMatrix.needsUpdate = true;
    crates.computeBoundingBox();
    crates.computeBoundingSphere();
  };
  ride(0);
  return {
    group,
    update: (t) => {
      ride(t);
      puff.update(t);
    },
  };
};

// ——— Observatory (trophy) ———

const observatory = (): Upgrade => {
  const group = new THREE.Group();
  const mats = { ...kitMats(), glow: glowMat('#ffb04a', 0.8) };
  const b = new Bins(mats);
  // A grassy hill with a soil rim.
  const hill: Pt[] = [
    [0, -0.08],
    [0.44, -0.08],
    [0.47, -0.05, 0.02],
    [0.47, -0.02, 0.015],
    [0.43, 0.02, 0.04],
    [0.36, 0.055, 0.04],
    [0.28, 0.09, 0.05],
    [0.2, 0.105, 0.03],
    [0.12, 0.11],
    [0.06, 0.11],
    [0, 0.11],
  ];
  b.add('paint', lathe(hill, 64, 3), (c, n) =>
    n.y > 0.45 && c.y > -0.02
      ? mottle('#74b24c', 0.03)(c, n)
      : c.y < -0.05 && c.y > -0.065
        ? '#e8b04a'
        : '#8a5d3b',
  );
  const slope: [number, number][] = [
    [0.12, 0.11],
    [0.2, 0.105],
    [0.28, 0.09],
    [0.36, 0.055],
    [0.43, 0.02],
  ];
  const hy = (r: number) => {
    if (r <= slope[0][0]) return slope[0][1];
    for (let i = 1; i < slope.length; i++)
      if (r <= slope[i][0]) {
        const [r0, y0] = slope[i - 1];
        const [r1, y1] = slope[i];
        return y0 + ((r - r0) / (r1 - r0)) * (y1 - y0);
      }
    return 0.02;
  };
  // The drum: a stone plinth, white walls, a cornice.
  const dz = -0.03;
  const top = 0.395;
  b.add(
    'paint',
    lathe(
      [
        [0, 0.1],
        [0.235, 0.1],
        [0.235, 0.15, 0.01],
        [0.205, 0.155],
        [0.2, 0.16],
        [0.2, top - 0.025],
        [0.218, top - 0.019, 0.004],
        [0.218, top, 0.004],
        [0, top],
      ],
      48,
      2,
    ),
    (c) =>
      c.y < 0.156
        ? mottle('#aaa398', 0.08)(c, c)
        : c.y > top - 0.026
          ? '#d9d2c4'
          : '#f4efe5',
    m4(0, 0, dz),
  );
  // An arched wooden door with steps, and lit round windows.
  const door = m4(0, 0.155, dz + 0.196);
  const Dr = (m: THREE.Matrix4) => door.clone().multiply(m);
  b.add('paint', extrude(arch(0.11, 0.16), 0.02, 0.004), '#d9d2c4', door);
  b.add(
    'paint',
    extrude(arch(0.084, 0.142), 0.02),
    '#9a6438',
    Dr(m4(0, 0, 0.006)),
  );
  for (const x of [-0.021, 0, 0.021])
    b.add('paint', box(0.003, 0.12, 0.004), '#6b4426', Dr(m4(x, 0.062, 0.017)));
  b.add('metal', sphere(0.008, 8, 6), GOLD, Dr(m4(0.028, 0.065, 0.019)));
  b.add(
    'paint',
    rbox(0.14, 0.03, 0.06, 0.008),
    '#aaa398',
    m4(0, 0.115, dz + 0.24),
  );
  b.add(
    'paint',
    rbox(0.12, 0.022, 0.05, 0.008),
    '#aaa398',
    m4(0, 0.092, dz + 0.285),
  );
  for (const az of [-0.9, -1.8, 0.95]) {
    const d = v3(Math.sin(az), 0, Math.cos(az));
    porthole(b, v3(0, 0.29, dz).addScaledVector(d, 0.2), d, 0.032);
  }
  // A stepping-stone path, bushes, a little pine and a lamp.
  for (const [x, z, s] of [
    [0.0, 0.34, 1],
    [-0.04, 0.4, 0.9],
  ]) {
    const r = Math.hypot(x, z);
    b.add(
      'paint',
      cyl(0.032 * s, 0.036 * s, 0.016, 12),
      '#c9c2b4',
      m4(x, hy(r) + 0.002, z, 0.25, x * 4, 0, [1, 1, 0.8]),
    );
  }
  for (const [x, z, sz, hex, berry] of [
    [-0.25, 0.25, 0.07, '#4f9e3f', '#f06a8a'],
    [-0.35, 0.1, 0.055, '#5fae46', '#ffd24a'],
    [0.27, 0.24, 0.065, '#4f9e3f', '#f06a8a'],
  ] as const)
    bush(b, m4(x, hy(Math.hypot(x, z)) - 0.01, z, 0, x * 5, 0), sz, hex, berry);
  const pine = v3(-0.28, 0, -0.25);
  pine.y = hy(Math.hypot(pine.x, pine.z));
  b.add(
    'paint',
    cyl(0.012, 0.016, 0.06, 8),
    '#7a5634',
    m4(pine.x, pine.y + 0.03, pine.z),
  );
  for (const [y, r] of [
    [0.05, 0.085],
    [0.11, 0.068],
    [0.165, 0.05],
  ])
    b.add(
      'paint',
      lathe(
        [
          [0, 0],
          [r, 0, 0.01],
          [r * 0.8, 0.02, 0.02],
          [0, 0.1],
        ],
        14,
        2,
      ),
      '#3f8a45',
      m4(pine.x, pine.y + y, pine.z),
    );
  const lamp = v3(0.12, 0, 0.33);
  lamp.y = hy(Math.hypot(lamp.x, lamp.z));
  b.add('metal', rod(0.006, lamp, v3(lamp.x, lamp.y + 0.15, lamp.z), 8), DARK);
  b.add(
    'metal',
    cyl(0.018, 0.012, 0.012, 10),
    DARK,
    m4(lamp.x, lamp.y + 0.183, lamp.z),
  );
  b.add(
    'glow',
    sphere(0.016, 12, 8),
    '#ffd27a',
    m4(lamp.x, lamp.y + 0.165, lamp.z),
  );
  b.into(group);
  // The dome, its slit open, a telescope looking out; it turns gently.
  const dmg = new THREE.Group();
  dmg.position.set(0, top, dz);
  const db = new Bins(mats);
  const R = 0.215;
  const gap = 0.56;
  const outer: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    outer.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  db.add(
    'paint',
    new THREE.LatheGeometry(rounded(outer), 56, gap / 2, TAU - gap),
    (c) => {
      const phi = Math.atan2(c.x, c.z);
      const near =
        Math.abs(((phi + TAU) % (TAU / 8)) - TAU / 16) > TAU / 16 - 0.03;
      return near ? '#d8d6d2' : '#fbf9f5';
    },
  );
  db.add(
    'paint',
    new THREE.LatheGeometry(
      rounded([...outer].reverse().map(([x, y]) => [x * 0.95, y * 0.95])),
      40,
      gap / 2,
      TAU - gap,
    ),
    '#1d2236',
  );
  for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2 - 0.02);
      const p = onSphere(v3(), R, (s * gap) / 2, a).p;
      pts.push(p);
    }
    db.add('paint', tube(pts, 0.009, 16, 5), SEAM);
  }
  db.add(
    'metal',
    new THREE.TorusGeometry(R + 0.004, 0.01, 6, 56).rotateX(Math.PI / 2),
    '#9aa2ad',
    m4(0, 0.004, 0),
  );
  // The telescope: an orange tube with a dew shield and brass rings.
  const tel = m4(0, 0.06, 0, -0.62, 0, 0);
  db.add(
    'paint',
    latheZ(
      [
        [0, -0.1],
        [0.04, -0.1, 0.008],
        [0.046, -0.08],
        [0.046, 0.3],
        [0, 0.3],
      ],
      24,
      2,
    ),
    ORANGE,
    tel,
  );
  db.add(
    'paint',
    latheZ(
      [
        [0.04, 0.29],
        [0.055, 0.29, 0.005],
        [0.055, 0.36, 0.003],
        [0.047, 0.36],
        [0.047, 0.35],
      ],
      24,
      2,
    ),
    '#4a5468',
    tel,
  );
  db.add(
    'glow',
    cyl(0.046, 0.046, 0.004, 20).rotateX(Math.PI / 2),
    '#9fd8ff',
    tel.clone().multiply(m4(0, 0, 0.35)),
  );
  for (const z of [0.02, 0.2])
    db.add(
      'metal',
      latheZ(
        [
          [0.045, z - 0.012],
          [0.053, z - 0.01, 0.003],
          [0.053, z + 0.01, 0.003],
          [0.045, z + 0.012],
        ],
        24,
        2,
      ),
      GOLD,
      tel,
    );
  db.add('paint', cyl(0.035, 0.05, 0.06, 16), DARK, m4(0, 0.03, 0));
  db.into(dmg);
  group.add(dmg);
  return {
    group,
    update: (t) => {
      dmg.rotation.y = -0.25 + Math.sin(t * 0.3) * 0.3;
    },
  };
};

// ——— Garage (extra) ———

function scooter(b: Bins, at: THREE.Matrix4) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  const body = '#5cc6b0';
  const cream = '#f6eedc';
  for (const z of [0.11, -0.1]) {
    wheel(b, A(m4(0, 0.04, z)), 0.04, 0.03);
    b.add(
      'paint',
      new THREE.TorusGeometry(0.026, 0.004, 4, 16).rotateY(Math.PI / 2),
      cream,
      A(m4(0.016, 0.04, z)),
    );
  }
  b.add('paint', rbox(0.07, 0.018, 0.13, 0.008), DARK, A(m4(0, 0.062, 0.02)));
  b.add(
    'paint',
    sphere(1, 20, 14),
    body,
    A(m4(0, 0.1, -0.085, 0, 0, 0, [0.06, 0.058, 0.1])),
  );
  b.add(
    'paint',
    rbox(0.052, 0.026, 0.12, 0.013, 2),
    '#7a4a2a',
    A(m4(0, 0.158, -0.075)),
  );
  b.add(
    'paint',
    rbox(0.084, 0.14, 0.02, 0.012, 2),
    body,
    A(m4(0, 0.125, 0.088, -0.22, 0, 0)),
  );
  b.add(
    'paint',
    dome(0.046, 16, 6).scale(0.9, 0.7, 1.2),
    body,
    A(m4(0, 0.075, 0.11)),
  );
  b.add('metal', rod(0.007, v3(0, 0.1, 0.105), v3(0, 0.22, 0.085)), STEEL, at);
  b.add('paint', rbox(0.06, 0.036, 0.036, 0.014), body, A(m4(0, 0.225, 0.088)));
  b.add(
    'metal',
    rod(0.005, v3(-0.06, 0.23, 0.08), v3(0.06, 0.23, 0.08)),
    STEEL,
    at,
  );
  for (const s of [-1, 1]) {
    b.add(
      'paint',
      cyl(0.009, 0.009, 0.026, 10).rotateZ(Math.PI / 2),
      DARK,
      A(m4(s * 0.065, 0.23, 0.08)),
    );
    b.add(
      'metal',
      rod(0.002, v3(s * 0.03, 0.24, 0.082), v3(s * 0.045, 0.275, 0.078)),
      STEEL,
      at,
    );
    b.add(
      'metal',
      cyl(0.011, 0.011, 0.004, 12).rotateX(Math.PI / 2),
      STEEL,
      A(m4(s * 0.045, 0.28, 0.078)),
    );
  }
  b.add(
    'metal',
    cyl(0.017, 0.017, 0.008, 16).rotateX(Math.PI / 2),
    STEEL,
    A(m4(0, 0.225, 0.108)),
  );
  b.add(
    'glow',
    cyl(0.013, 0.013, 0.006, 16).rotateX(Math.PI / 2),
    '#fff1c4',
    A(m4(0, 0.225, 0.113)),
  );
  b.add(
    'paint',
    rbox(0.024, 0.014, 0.008, 0.004),
    '#e8453a',
    A(m4(0, 0.12, -0.185)),
  );
  b.add(
    'paint',
    rbox(0.004, 0.012, 0.06, 0.002),
    cream,
    A(m4(-0.061, 0.1, -0.08)),
  );
}

const garage = (): Upgrade => {
  const group = new THREE.Group();
  const mats = { ...kitMats(), glow: glowMat('#ffc060', 0.8) };
  const b = new Bins(mats);
  pad(b, 0.52, mottle('#b8b2a6', 0.04), '#5a606b', '#e8453a');
  b.add(
    'paint',
    extrude(roundRect(0.3, 0.3, 0.04), 0.006).rotateX(-Math.PI / 2),
    '#5d6068',
    m4(0, 0.003, 0.3),
  );
  const w = 0.54;
  const d = 0.4;
  const h = 0.3;
  const z0 = -0.3;
  const zc = z0 + d / 2;
  const front = z0 + d;
  const cream = '#f2e6cf';
  const inside = '#3a3631';
  const t = 0.03;
  // Walls as slabs, so the open door shows a real inside.
  b.add(
    'paint',
    rbox(w, h, t, 0.006),
    (_, n) => (n.z < -0.5 ? cream : inside),
    m4(0, h / 2, z0 + t / 2),
  );
  for (const s of [-1, 1])
    b.add(
      'paint',
      rbox(t, h, d - 2 * t, 0.006),
      (_, n) => (n.x * s > 0.5 ? cream : inside),
      m4((s * (w - t)) / 2, h / 2, zc),
    );
  b.add(
    'paint',
    rbox(w - 2 * t, 0.01, d - t, 0.003),
    '#6e6a62',
    m4(0, 0.005, zc),
  );
  const ow = 0.3;
  const oh = 0.22;
  for (const s of [-1, 1])
    b.add(
      'paint',
      rbox((w - ow) / 2, h, t, 0.006),
      (_, n) => (n.z > 0.5 ? cream : inside),
      m4((s * (w + ow)) / 4, h / 2, front - t / 2),
    );
  b.add(
    'paint',
    rbox(ow, h - oh, t, 0.006),
    (_, n) => (n.z > 0.5 ? cream : inside),
    m4(0, (h + oh) / 2, front - t / 2),
  );
  // Clapboard lines on the front and the left.
  for (let y = 0.03; y < h - 0.01; y += 0.03) {
    for (const s of [-1, 1])
      b.add(
        'paint',
        box((w - ow) / 2 - 0.01, 0.004, 0.004),
        '#d9c6a2',
        m4((s * (w + ow)) / 4, y, front + 0.001),
      );
    if (y > oh + 0.01)
      b.add('paint', box(ow, 0.004, 0.004), '#d9c6a2', m4(0, y, front + 0.001));
    b.add(
      'paint',
      box(0.004, 0.004, d - 0.02),
      '#d9c6a2',
      m4(-w / 2 - 0.001, y, zc),
    );
  }
  for (const s of [-1, 1])
    b.add(
      'paint',
      rbox(0.022, h, 0.022, 0.006),
      '#e0d2b6',
      m4((s * w) / 2, h / 2, front - 0.008),
    );
  // The gable roof, its ridge along Z, red tiles in courses.
  const pitch = 0.52;
  const half = w / 2 + 0.04;
  const slab = half / Math.cos(pitch);
  const rise = (w / 2) * Math.tan(pitch);
  for (const s of [-1, 1]) {
    const roofAt = m4(
      (s * half) / 2,
      h + rise / 2 + 0.01,
      zc + 0.01,
      0,
      0,
      -s * pitch,
    );
    b.add('paint', rbox(slab, 0.026, d + 0.08, 0.008), '#c8553d', roofAt);
    for (let k = 0; k < 4; k++)
      b.add(
        'paint',
        rbox(0.012, 0.012, d + 0.08, 0.004),
        '#a8412e',
        roofAt
          .clone()
          .multiply(m4(-slab / 2 + 0.04 + k * (slab / 4.3), 0.016, 0)),
      );
  }
  b.add(
    'paint',
    rbox(0.04, 0.03, d + 0.09, 0.012),
    '#a8412e',
    m4(0, h + rise + 0.022, zc + 0.01),
  );
  const gable = new THREE.Shape();
  gable.moveTo(-w / 2, 0);
  gable.lineTo(w / 2, 0);
  gable.lineTo(0, rise);
  gable.lineTo(-w / 2, 0);
  for (const z of [z0 + t / 2, front - t / 2])
    b.add('paint', extrude(gable, t), cream, m4(0, h, z));
  // A round sign with a spanner on the gable.
  b.add(
    'paint',
    cyl(0.045, 0.045, 0.012, 28).rotateX(Math.PI / 2),
    ORANGE,
    m4(0, h + 0.07, front + 0.006),
  );
  b.add(
    'paint',
    new THREE.TorusGeometry(0.045, 0.006, 6, 28),
    WHITE,
    m4(0, h + 0.07, front + 0.012),
  );
  const spanner = m4(0, h + 0.07, front + 0.015, 0, 0, 0.8);
  b.add('paint', rbox(0.012, 0.06, 0.006, 0.003), WHITE, spanner);
  for (const y of [-1, 1]) {
    const jaw = new THREE.Shape().absarc(0, 0, 0.013, 0, TAU, false);
    jaw.holes.push(new THREE.Path().absarc(0, y * 0.006, 0.006, 0, TAU, true));
    b.add(
      'paint',
      extrude(jaw, 0.006),
      WHITE,
      spanner.clone().multiply(m4(0, y * 0.032, 0)),
    );
  }
  // The roll-up door, half open, and its drum housing.
  for (let i = 0; i < 3; i++)
    b.add(
      'paint',
      rbox(ow - 0.006, 0.026, 0.01, 0.004),
      i % 2 ? '#7d9cbc' : '#6f8fb0',
      m4(0, oh - 0.014 - i * 0.026, front - 0.02),
    );
  b.add(
    'paint',
    rbox(ow - 0.006, 0.01, 0.014, 0.004),
    DARK,
    m4(0, oh - 0.086, front - 0.02),
  );
  b.add(
    'metal',
    rbox(0.05, 0.008, 0.01, 0.003),
    STEEL,
    m4(0, oh - 0.076, front - 0.012),
  );
  // Inside: a bench, a shelf with cans and a lit bulb.
  b.add(
    'paint',
    rbox(0.2, 0.012, 0.08, 0.004),
    WOOD,
    m4(0.05, 0.08, z0 + 0.08),
  );
  for (const x of [-0.04, 0.14])
    b.add(
      'paint',
      rbox(0.012, 0.08, 0.06, 0.003),
      WOOD_DARK,
      m4(x, 0.04, z0 + 0.08),
    );
  b.add(
    'glow',
    sphere(0.018, 12, 8),
    '#fff1c4',
    m4(-0.05, oh - 0.085, zc - 0.06),
  );
  b.add(
    'metal',
    rod(0.002, v3(-0.05, oh - 0.07, zc - 0.06), v3(-0.05, h, zc - 0.06)),
    DARK,
  );
  // The tool wall on the left: a pegboard with a spanner, hammer, saw, screwdriver.
  const pegX = -w / 2 - 0.006;
  const pz = zc - 0.02;
  b.add('paint', rbox(0.012, 0.16, 0.26, 0.004), '#d4ad72', m4(pegX, 0.17, pz));
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 4; j++)
      if ((i + j) % 2)
        b.add(
          'paint',
          cyl(0.004, 0.004, 0.004, 6).rotateZ(Math.PI / 2),
          '#8a6a3c',
          m4(pegX - 0.006, 0.11 + j * 0.04, pz - 0.11 + i * 0.044),
        );
  const T = (y: number, z: number, rx = 0) => m4(pegX - 0.012, y, z, rx, 0, 0);
  // Hammer.
  b.add('paint', rbox(0.008, 0.1, 0.012, 0.004), '#b9844f', T(0.16, pz - 0.08));
  b.add(
    'metal',
    rbox(0.012, 0.02, 0.05, 0.005),
    '#8a919b',
    T(0.215, pz - 0.08),
  );
  // Spanner.
  b.add(
    'metal',
    rbox(0.006, 0.1, 0.014, 0.003),
    STEEL,
    T(0.17, pz - 0.02, 0.2),
  );
  for (const y of [-1, 1])
    b.add(
      'metal',
      cyl(0.014, 0.014, 0.006, 12).rotateZ(Math.PI / 2),
      STEEL,
      T(0.17 + y * 0.05, pz - 0.02 - y * 0.01),
    );
  // Saw.
  const saw = new THREE.Shape();
  saw.moveTo(0, 0);
  saw.lineTo(0.11, -0.012);
  saw.lineTo(0.11, 0.012);
  saw.lineTo(0, 0.035);
  saw.lineTo(0, 0);
  b.add(
    'metal',
    extrude(saw, 0.004).rotateY(Math.PI / 2),
    '#d9dee4',
    T(0.13, pz + 0.04, -Math.PI / 2),
  );
  b.add(
    'paint',
    rbox(0.012, 0.035, 0.03, 0.008),
    '#e8453a',
    T(0.25, pz + 0.05),
  );
  // Screwdriver.
  b.add(
    'paint',
    rbox(0.014, 0.045, 0.014, 0.006),
    '#f2c230',
    T(0.22, pz + 0.105),
  );
  b.add(
    'metal',
    rod(
      0.003,
      v3(pegX - 0.012, 0.2, pz + 0.105),
      v3(pegX - 0.012, 0.13, pz + 0.105),
    ),
    STEEL,
  );
  // Outside: a red oil can, a stack of tyres, the scooter on the drive.
  const can = m4(-0.21, 0, 0.17);
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.04, 0, 0.006],
        [0.04, 0.05, 0.01],
        [0.014, 0.085, 0.006],
        [0.01, 0.1],
        [0, 0.1],
      ],
      24,
      3,
    ),
    (c) => (c.y > 0.02 && c.y < 0.035 ? '#f2c230' : '#d8453a'),
    can,
  );
  b.add(
    'metal',
    rod(0.005, v3(-0.21, 0.07, 0.19), v3(-0.21, 0.13, 0.27), 8, 0.003),
    '#d4a64f',
  );
  b.add(
    'paint',
    tube(
      [v3(-0.21, 0.095, 0.155), v3(-0.21, 0.12, 0.13), v3(-0.21, 0.07, 0.13)],
      0.005,
      8,
      5,
    ),
    DARK,
  );
  for (let k = 0; k < 2; k++)
    b.add(
      'paint',
      new THREE.TorusGeometry(0.045, 0.02, 8, 24).rotateX(Math.PI / 2),
      '#2e3036',
      m4(0.34, 0.02 + k * 0.04, 0.15),
    );
  scooter(b, m4(0.17, 0.006, 0.31, 0, 1.2, 0));
  b.into(group);
  return still(group);
};

// ——— Pool (trophy) ———

const pool = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const b = new Bins(mats);
  pad(b, 0.5, mottle('#79b64d', 0.03), '#7a5636', '#f6d04a');
  const pz = 0.08;
  const deck = extrude(roundRect(0.76, 0.54, 0.12), 0.012).rotateX(
    -Math.PI / 2,
  );
  b.add('paint', deck, mottle('#e9dcc3', 0.03), m4(0, 0.006, pz - 0.02));
  // The basin: coping, tiled sides, a floor with a lane line.
  const pw = 0.54;
  const pd = 0.32;
  const frame = roundRect(pw + 0.1, pd + 0.1, 0.08);
  frame.holes.push(roundRect(pw, pd, 0.05));
  b.add(
    'paint',
    extrude(frame, 0.06, 0.006).rotateX(-Math.PI / 2),
    (c, n) =>
      n.y > 0.5 ? '#f6eedc' : n.x * c.x + n.z * c.z < 0 ? '#5cc0e0' : '#d9c7a8',
    m4(0, 0.042, pz),
  );
  b.add(
    'paint',
    extrude(roundRect(pw + 0.01, pd + 0.01, 0.05), 0.01).rotateX(-Math.PI / 2),
    '#3fa9d6',
    m4(0, 0.015, pz),
  );
  b.add(
    'paint',
    rbox(pw - 0.12, 0.002, 0.02, 0.001),
    '#3d8fc4',
    m4(0, 0.021, pz),
  );
  // Water with ripples.
  const water = new THREE.PlaneGeometry(pw + 0.02, pd + 0.02, 24, 14).rotateX(
    -Math.PI / 2,
  );
  const wpos = water.getAttribute('position');
  const base = Float32Array.from(wpos.array as Float32Array);
  const wmesh = new THREE.Mesh(
    water,
    new THREE.MeshStandardMaterial({
      color: '#1aa6dc',
      transparent: true,
      opacity: 0.74,
      roughness: 0.04,
      metalness: 0.05,
      emissive: '#0a4f7a',
      emissiveIntensity: 0.3,
    }),
  );
  wmesh.position.set(0, 0.056, pz);
  // A ladder over the back edge into the water.
  for (const x of [0.13, 0.2]) {
    const zb = pz - pd / 2;
    b.add(
      'metal',
      tube(
        [
          v3(x, 0.072, zb - 0.06),
          v3(x, 0.14, zb - 0.045),
          v3(x, 0.15, zb - 0.0),
          v3(x, 0.11, zb + 0.02),
          v3(x, 0.02, zb + 0.022),
        ],
        0.006,
        20,
        6,
      ),
      STEEL,
    );
  }
  for (const y of [0.03, 0.065])
    b.add(
      'metal',
      rbox(0.07, 0.006, 0.016, 0.003),
      STEEL,
      m4(0.165, y, pz - pd / 2 + 0.024),
    );
  // The lounger with a striped cushion, and a side table with a drink.
  const lg = m4(0.17, 0.012, -0.27, 0, -0.3, 0, 1.35);
  const L = (m: THREE.Matrix4) => lg.clone().multiply(m);
  for (const [x, z] of [
    [-0.045, -0.08],
    [0.045, -0.08],
    [-0.045, 0.08],
    [0.045, 0.08],
  ])
    b.add('metal', rod(0.005, v3(x, 0, z), v3(x, 0.05, z)), STEEL, lg);
  b.add('paint', rbox(0.11, 0.014, 0.22, 0.005), WHITE, L(m4(0, 0.055, 0.02)));
  b.add(
    'paint',
    rbox(0.1, 0.018, 0.16, 0.008),
    (c) => (Math.floor((c.z + 1) * 40) % 2 ? '#3fb8b0' : WHITE),
    L(m4(0, 0.07, 0.05)),
  );
  b.add(
    'paint',
    rbox(0.11, 0.014, 0.11, 0.005),
    WHITE,
    L(m4(0, 0.1, -0.11, 0.9, 0, 0)),
  );
  b.add(
    'paint',
    rbox(0.1, 0.018, 0.1, 0.008),
    '#3fb8b0',
    L(m4(0, 0.108, -0.1, 0.9, 0, 0)),
  );
  b.add(
    'paint',
    rbox(0.08, 0.024, 0.04, 0.012),
    '#f6eedc',
    L(m4(0, 0.15, -0.135, 0.9, 0, 0)),
  );
  const tbl = v3(0.34, 0.012, -0.2);
  b.add('metal', rod(0.005, tbl, v3(tbl.x, tbl.y + 0.07, tbl.z)), STEEL);
  b.add(
    'paint',
    cyl(0.04, 0.04, 0.008, 20),
    WHITE,
    m4(tbl.x, tbl.y + 0.074, tbl.z),
  );
  b.add(
    'paint',
    cyl(0.012, 0.009, 0.035, 12),
    '#f6a640',
    m4(tbl.x, tbl.y + 0.095, tbl.z),
  );
  b.add(
    'paint',
    rod(
      0.002,
      v3(tbl.x, tbl.y + 0.1, tbl.z),
      v3(tbl.x + 0.01, tbl.y + 0.13, tbl.z),
    ),
    '#e8453a',
  );
  // The parasol: a striped canopy on a pole with a weighted foot.
  const ps = v3(-0.24, 0.012, -0.26);
  const P = m4(ps.x, ps.y, ps.z, 0.12, 0, -0.08);
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.06, 0, 0.01],
        [0.055, 0.02, 0.01],
        [0.015, 0.03],
        [0, 0.03],
      ],
      24,
      2,
    ),
    '#6c7080',
    m4(ps.x, ps.y, ps.z),
  );
  b.add('paint', rod(0.007, v3(0, 0, 0), v3(0, 0.53, 0), 8), WHITE, P);
  b.add(
    'paint',
    lathe(
      [
        [0, 0.525],
        [0.12, 0.497, 0.02],
        [0.24, 0.43, 0.006],
        [0.24, 0.418, 0.006],
        [0.12, 0.484],
        [0, 0.51],
      ],
      32,
      2,
    ),
    (c, n) =>
      n.y < -0.2
        ? '#f3e2c4'
        : Math.floor(((Math.atan2(c.x, c.z) + Math.PI) / TAU) * 8 + 0.5) % 2
          ? '#e8503c'
          : WHITE,
    P,
  );
  b.add(
    'paint',
    sphere(0.014, 10, 8),
    '#e8503c',
    P.clone().multiply(m4(0, 0.535, 0)),
  );
  // A potted plant at the front left and a towel on the deck.
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.035, 0, 0.006],
        [0.045, 0.06, 0.004],
        [0.04, 0.065],
        [0, 0.065],
      ],
      20,
      2,
    ),
    '#d8784a',
    m4(-0.36, 0.0, 0.2),
  );
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    b.add(
      'paint',
      sphere(1, 10, 8),
      k % 2 ? '#3f9a45' : '#56b04a',
      m4(
        -0.36 + Math.cos(a) * 0.02,
        0.1,
        0.2 + Math.sin(a) * 0.02,
        Math.sin(a) * 0.5,
        0,
        Math.cos(a) * 0.5,
        [0.02, 0.05, 0.02],
      ),
    );
  }
  b.add(
    'paint',
    rbox(0.12, 0.008, 0.07, 0.004),
    (c) => (Math.floor((c.x + 1) * 50) % 2 ? '#f6d04a' : '#f28a3a'),
    m4(-0.2, 0.022, 0.29, 0, 0.3, 0),
  );
  b.into(group);
  group.add(wmesh);
  // A ring float and a rubber duck, bobbing.
  const ring = new THREE.Mesh(
    part(
      new THREE.TorusGeometry(0.048, 0.019, 10, 28).rotateX(Math.PI / 2),
      WHITE,
    ),
    mats.paint,
  );
  {
    const g = ring.geometry;
    const p = g.getAttribute('position');
    const col = g.getAttribute('color');
    const k = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const a = Math.atan2(
        p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2),
        p.getX(i) + p.getX(i + 1) + p.getX(i + 2),
      );
      k.set(Math.floor(((a + Math.PI) / TAU) * 6) % 2 ? '#e8453a' : WHITE);
      for (let j = 0; j < 3; j++) col.setXYZ(i + j, k.r, k.g, k.b);
    }
  }
  ring.position.set(-0.14, 0.058, pz + 0.04);
  const db = new Bins({ paint: mats.paint });
  db.add(
    'paint',
    sphere(1, 18, 12),
    '#ffd23a',
    m4(0, 0.02, 0, 0, 0, 0, [0.04, 0.03, 0.05]),
  );
  db.add(
    'paint',
    sphere(1, 6, 4),
    '#ffd23a',
    m4(0, 0.04, -0.045, 0.6, 0, 0, [0.012, 0.02, 0.02]),
  );
  db.add('paint', sphere(0.024, 16, 12), '#ffd23a', m4(0, 0.06, 0.028));
  db.add(
    'paint',
    sphere(1, 12, 8),
    '#f28a2a',
    m4(0, 0.056, 0.055, 0, 0, 0, [0.014, 0.006, 0.014]),
  );
  for (const s of [-1, 1])
    db.add(
      'paint',
      sphere(0.004, 8, 6),
      '#1f2330',
      m4(s * 0.012, 0.066, 0.046),
    );
  const duck = new THREE.Group();
  db.into(duck);
  duck.position.set(0.1, 0.05, pz + 0.06);
  duck.rotation.y = -0.6;
  group.add(ring, duck);
  return {
    group,
    update: (t) => {
      for (let i = 0; i < wpos.count; i++) {
        const x = base[3 * i];
        const z = base[3 * i + 2];
        wpos.setY(
          i,
          0.003 * Math.sin(x * 22 + t * 1.6) * Math.cos(z * 18 - t * 1.2) +
            0.002 * Math.sin((x + z) * 30 - t * 2.2),
        );
      }
      wpos.needsUpdate = true;
      water.computeVertexNormals();
      ring.position.y = 0.058 + Math.sin(t * 1.4) * 0.004;
      ring.rotation.set(
        Math.sin(t * 1.1) * 0.06,
        t * 0.15,
        Math.cos(t * 1.3) * 0.05,
      );
      duck.position.y = 0.05 + Math.sin(t * 1.7 + 1) * 0.004;
      duck.rotation.set(
        Math.sin(t * 1.5) * 0.06,
        -0.6 + Math.sin(t * 0.4) * 0.3,
        Math.cos(t * 1.2) * 0.05,
      );
    },
  };
};

// ——— Safe (extra) ———

const safe = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const b = new Bins(mats);
  // A round plank floor.
  pad(b, 0.5, mottle('#a8774a', 0.03), '#5a3e2a', GOLD, 0.07);
  for (let x = -0.405; x < 0.41; x += 0.09)
    b.add(
      'paint',
      box(0.005, 0.002, 2 * Math.sqrt(0.484 ** 2 - x * x)),
      '#86592f',
      m4(x, 0.001, 0),
    );
  const green = '#2f6b5a';
  const greenDark = '#24584a';
  const inner = '#a8323f';
  const w = 0.48;
  const h = 0.62;
  const d = 0.4;
  const t = 0.06;
  const y0 = 0.06;
  const zc = -0.19;
  const fz = zc + d / 2;
  // Feet.
  for (const [x, z] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ])
    b.add(
      'metal',
      lathe(
        [
          [0, 0],
          [0.03, 0, 0.006],
          [0.022, 0.04, 0.006],
          [0.028, 0.06],
          [0, 0.06],
        ],
        16,
        2,
      ),
      '#4a4e58',
      m4((x * (w - 0.08)) / 2, 0, zc + (z * (d - 0.08)) / 2),
    );
  // The body as thick slabs, a velvet lining, a shelf.
  const outer = (n: THREE.Vector3, axis: 'x' | 'y' | 'z', s: number) =>
    n[axis] * s > 0.5 ? green : inner;
  b.add(
    'paint',
    rbox(w, t, d, 0.025, 2),
    (_, n) => outer(n, 'y', 1),
    m4(0, y0 + h - t / 2, zc),
  );
  b.add(
    'paint',
    rbox(w, t, d, 0.025, 2),
    (_, n) => outer(n, 'y', -1),
    m4(0, y0 + t / 2, zc),
  );
  for (const s of [-1, 1])
    b.add(
      'paint',
      rbox(t, h, d, 0.025, 2),
      (_, n) => outer(n, 'x', s),
      m4((s * (w - t)) / 2, y0 + h / 2, zc),
    );
  b.add(
    'paint',
    rbox(w, h, t, 0.025, 2),
    (_, n) => outer(n, 'z', -1),
    m4(0, y0 + h / 2, zc - d / 2 + t / 2),
  );
  const ring = roundRect(w + 0.012, h + 0.012, 0.035);
  ring.holes.push(roundRect(w - 2 * t + 0.01, h - 2 * t + 0.01, 0.012));
  b.add('paint', extrude(ring, 0.02, 0.006), greenDark, m4(0, y0 + h / 2, fz));
  b.add(
    'paint',
    rbox(w - 2 * t, 0.012, d - t - 0.02, 0.004),
    inner,
    m4(0, y0 + h / 2 + 0.01, zc + 0.01),
  );
  b.add(
    'paint',
    rbox(w + 0.03, 0.02, d + 0.02, 0.008),
    greenDark,
    m4(0, y0 + 0.01, zc),
  );
  b.add(
    'paint',
    rbox(w + 0.02, 0.016, d + 0.016, 0.008),
    greenDark,
    m4(0, y0 + h, zc),
  );
  // Gold pinstripes on the left side.
  const pin = roundRect(d - 0.1, h - 0.12, 0.03);
  pin.holes.push(roundRect(d - 0.112, h - 0.132, 0.026));
  b.add(
    'paint',
    extrude(pin, 0.004).rotateY(-Math.PI / 2),
    GOLD,
    m4(-w / 2 - 0.001, y0 + h / 2, zc),
  );
  // Gold bars stacked below, coins and a sack above.
  const bar = barGeo(0.05, 0.028, 0.11);
  const iy = y0 + t;
  for (const [x, y, z] of [
    [-0.1, 0, 0.02],
    [-0.045, 0, 0.02],
    [0.01, 0, 0.02],
    [0.065, 0, 0.02],
    [-0.072, 0.03, 0.02],
    [-0.017, 0.03, 0.02],
    [0.038, 0.03, 0.02],
    [-0.045, 0.06, 0.02],
    [0.01, 0.06, 0.02],
  ])
    b.add('metal', bar, GOLD, m4(x + 0.07, iy + y, zc + z));
  const coin = cyl(0.022, 0.022, 0.007, 18);
  const sy = y0 + h / 2 + 0.016;
  for (const [x, z, n] of [
    [0.12, 0.06, 5],
    [0.07, 0.09, 3],
    [0.13, -0.02, 7],
    [0.02, 0.06, 4],
    [0.17, 0.1, 2],
  ])
    for (let k = 0; k < n; k++)
      b.add(
        'metal',
        coin,
        k % 2 ? '#e2b03e' : GOLD,
        m4(x + Math.sin(k * 3) * 0.002, sy + 0.0035 + k * 0.0075, zc + z),
      );
  b.add(
    'paint',
    blob(2, 0.12, 12),
    '#d9b26b',
    m4(-0.06, sy + 0.06, zc + 0.0, 0, 0, 0, [0.075, 0.065, 0.07]),
  );
  b.add(
    'paint',
    new THREE.TorusGeometry(0.03, 0.006, 6, 16).rotateX(Math.PI / 2),
    '#8a5a34',
    m4(-0.06, sy + 0.115, zc),
  );
  b.add(
    'metal',
    cyl(0.024, 0.024, 0.004, 18).rotateX(Math.PI / 2),
    GOLD,
    m4(-0.06, sy + 0.06, zc + 0.07),
  );
  b.add(
    'paint',
    blob(2, 0.25, 4),
    '#d9b26b',
    m4(-0.06, sy + 0.13, zc, 0, 0, 0, [0.03, 0.025, 0.03]),
  );
  // Spilled coins and a bar on the floor.
  for (const [x, z, rx] of [
    [0.16, 0.24, 0],
    [0.22, 0.3, 0.1],
    [0.12, 0.33, 0],
    [0.27, 0.2, 0],
    [0.04, 0.3, 0],
    [-0.05, 0.36, 0],
    [0.08, 0.4, 0],
    [0.19, 0.38, 0],
  ])
    b.add(
      'metal',
      coin,
      GOLD,
      m4(x, 0.004 + (rx ? 0.018 : 0), z - 0.06, rx, 0, rx ? 0.3 : 0),
    );
  b.add('metal', bar, GOLD, m4(0.22, 0, 0.3, 0, 0.7, 0));
  // The door, swung open on its left hinges.
  const hinge = v3(-w / 2 + 0.005, y0 + h / 2, fz + 0.012);
  const open = -1.42;
  const dw = w - 0.03;
  const dh = h - 0.03;
  const dt = 0.055;
  const door = new THREE.Matrix4().makeRotationY(open).setPosition(hinge);
  const D = (m: THREE.Matrix4) => door.clone().multiply(m);
  b.add(
    'paint',
    rbox(dw, dh, dt, 0.022, 2),
    (_, n) => (n.z < -0.5 ? '#6f7680' : green),
    D(m4(dw / 2 + 0.01, 0, dt / 2)),
  );
  const panel = roundRect(dw - 0.08, dh - 0.08, 0.02);
  panel.holes.push(roundRect(dw - 0.092, dh - 0.092, 0.016));
  b.add(
    'paint',
    extrude(panel, 0.004),
    GOLD,
    D(m4(dw / 2 + 0.01, 0, dt + 0.001)),
  );
  for (const y of [-0.17, 0.17])
    b.add(
      'metal',
      cyl(0.016, 0.016, 0.07, 14),
      '#d4a64f',
      m4(hinge.x - 0.004, hinge.y + y, hinge.z),
    );
  // Lock bolts on the door's edge, and the works on its inside.
  for (const y of [-0.15, 0, 0.15])
    b.add(
      'metal',
      cyl(0.013, 0.013, 0.05, 12).rotateZ(Math.PI / 2),
      STEEL,
      D(m4(dw + 0.02, y, dt / 2)),
    );
  b.add(
    'metal',
    rbox(dw - 0.12, dh - 0.14, 0.012, 0.01),
    '#9aa2ad',
    D(m4(dw / 2 + 0.01, 0, -0.004)),
  );
  // The handle: a three-spoke wheel; a gold nameplate.
  const hc = D(m4(dw / 2 + 0.01, -0.1, dt + 0.003));
  b.add(
    'metal',
    cyl(0.018, 0.022, 0.03, 16).rotateX(Math.PI / 2),
    STEEL,
    hc.clone().multiply(m4(0, 0, 0.012)),
  );
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.3;
    b.add(
      'metal',
      rod(
        0.006,
        v3(0, 0, 0.026),
        v3(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.03),
        8,
      ),
      STEEL,
      hc,
    );
    b.add(
      'metal',
      sphere(0.012, 10, 8),
      STEEL,
      hc.clone().multiply(m4(Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0.03)),
    );
  }
  b.add(
    'metal',
    rbox(0.12, 0.03, 0.006, 0.006),
    GOLD,
    D(m4(dw / 2 + 0.01, -0.2, dt + 0.003)),
  );
  b.into(group);
  // The dial turns back and forth.
  const dialAt = new THREE.Group();
  dialAt.applyMatrix4(D(m4(dw / 2 + 0.01, 0.07, dt)));
  const dial = new THREE.Group();
  const kb = new Bins({ metal: mats.metal });
  kb.add(
    'metal',
    extrude(knurl(0.065, 16, 0.004), 0.016, 0.003),
    '#d6dbe1',
    m4(0, 0, 0.01),
  );
  kb.add(
    'metal',
    cyl(0.052, 0.055, 0.008, 32).rotateX(Math.PI / 2),
    '#2a2e36',
    m4(0, 0, 0.021),
  );
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * TAU;
    kb.add(
      'metal',
      rbox(0.003, k % 5 ? 0.008 : 0.014, 0.003, 0.001),
      k ? '#e8eaee' : '#e8453a',
      m4(Math.sin(a) * 0.044, Math.cos(a) * 0.044, 0.026, 0, 0, -a),
    );
  }
  kb.add(
    'metal',
    lathe(
      [
        [0, 0],
        [0.024, 0, 0.004],
        [0.022, 0.018, 0.006],
        [0, 0.02],
      ],
      20,
      2,
    ).rotateX(Math.PI / 2),
    '#d6dbe1',
    m4(0, 0, 0.024),
  );
  kb.into(dial);
  dialAt.add(dial);
  group.add(dialAt);
  // Turned a little, so the shop looks past the open door into the safe.
  group.rotation.y = -0.2;
  return {
    group,
    update: (t) => {
      dial.rotation.z = Math.sin(t * 0.8) * 1.4;
    },
  };
};

// ——— Museum (trophy) ———

const museum = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const b = new Bins(mats);
  pad(b, 0.54, mottle('#d9d3c6', 0.03), '#6d6a78', '#a98be8');
  const stone = '#f1e8d6';
  const stoneDark = '#ddd1ba';
  const zc = -0.05;
  // The stepped base.
  for (let i = 0; i < 3; i++)
    b.add(
      'paint',
      rbox(0.86 - i * 0.06, 0.035, 0.6 - i * 0.06, 0.008),
      mottle(i % 2 ? stoneDark : stone, 0.04),
      m4(0, 0.0175 + i * 0.035, zc + 0.03 - i * 0.02),
    );
  const fy = 0.105;
  // The hall behind the columns, with bronze doors and tall windows.
  const ch = 0.33;
  b.add(
    'paint',
    rbox(0.6, ch, 0.32, 0.008),
    stone,
    m4(0, fy + ch / 2, zc - 0.1),
  );
  const cf = zc + 0.06;
  b.add(
    'paint',
    rbox(0.17, 0.25, 0.02, 0.006),
    stoneDark,
    m4(0, fy + 0.125, cf + 0.004),
  );
  for (const s of [-1, 1]) {
    b.add(
      'metal',
      rbox(0.068, 0.22, 0.014, 0.006),
      '#b8863a',
      m4(s * 0.036, fy + 0.11, cf + 0.012),
    );
    for (const y of [0.06, 0.16])
      b.add(
        'metal',
        rbox(0.044, 0.07, 0.006, 0.004),
        '#d4a64f',
        m4(s * 0.036, fy + y, cf + 0.02),
      );
    b.add(
      'metal',
      sphere(0.007, 8, 6),
      GOLD,
      m4(s * 0.008, fy + 0.11, cf + 0.022),
    );
  }
  for (const z of [zc - 0.16, zc - 0.02])
    b.add(
      'paint',
      extrude(arch(0.06, 0.16), 0.01),
      '#4b3f6b',
      m4(-0.301, fy + 0.08, z, 0, -Math.PI / 2, 0),
    );
  // Fluted columns: base, shaft, capital.
  const shaft = extrude(knurl(0.032, 10, 0.004), 0.26, 0.002, 1, 4).rotateX(
    -Math.PI / 2,
  );
  const column = (x: number, z: number) => {
    b.add(
      'paint',
      rbox(0.08, 0.016, 0.08, 0.004),
      stoneDark,
      m4(x, fy + 0.008, z),
    );
    b.add(
      'paint',
      lathe(
        [
          [0, 0],
          [0.04, 0, 0.006],
          [0.036, 0.016, 0.006],
          [0, 0.016],
        ],
        20,
        2,
      ),
      stone,
      m4(x, fy + 0.016, z),
    );
    b.add('paint', shaft, stone, m4(x, fy + 0.032 + 0.13, z));
    b.add(
      'paint',
      lathe(
        [
          [0, 0],
          [0.034, 0, 0.004],
          [0.044, 0.018, 0.006],
          [0, 0.018],
        ],
        20,
        2,
      ),
      stone,
      m4(x, fy + 0.292, z),
    );
    b.add(
      'paint',
      rbox(0.09, 0.02, 0.09, 0.004),
      stoneDark,
      m4(x, fy + 0.32, z),
    );
  };
  const cz = zc + 0.2;
  for (const x of [-0.315, -0.105, 0.105, 0.315]) column(x, cz);
  for (const z of [zc - 0.05, zc - 0.22])
    for (const x of [-0.315, 0.315]) column(x, z);
  // Architrave, frieze with triglyphs, cornice.
  const ey = fy + ch;
  b.add(
    'paint',
    rbox(0.74, 0.04, 0.5, 0.006),
    stone,
    m4(0, ey + 0.02, zc - 0.01),
  );
  b.add(
    'paint',
    rbox(0.74, 0.04, 0.5, 0.006),
    stoneDark,
    m4(0, ey + 0.06, zc - 0.01),
  );
  for (let i = 0; i < 9; i++)
    b.add(
      'paint',
      rbox(0.026, 0.034, 0.006, 0.002),
      '#c9bca2',
      m4(-0.32 + i * 0.08, ey + 0.06, zc + 0.242),
    );
  b.add(
    'paint',
    rbox(0.78, 0.022, 0.53, 0.006),
    stone,
    m4(0, ey + 0.09, zc - 0.01),
  );
  // The pediment with a gold star, and the roof behind it.
  const pw = 0.39;
  const ph = 0.13;
  const tri = new THREE.Shape();
  tri.moveTo(-pw, 0);
  tri.lineTo(pw, 0);
  tri.lineTo(0, ph);
  tri.lineTo(-pw, 0);
  const py = ey + 0.1;
  b.add(
    'paint',
    extrude(tri, 0.5, 0.004),
    (_, n) => (n.z > 0.9 ? stoneDark : n.y > 0.2 ? '#c8664a' : stone),
    m4(0, py, zc - 0.01),
  );
  const slope = Math.atan2(ph, pw);
  const rake = Math.hypot(pw, ph) + 0.02;
  for (const s of [-1, 1])
    b.add(
      'paint',
      rbox(rake, 0.02, 0.03, 0.006),
      stone,
      m4((s * pw) / 2, py + ph / 2 + 0.008, zc + 0.245, 0, 0, -s * slope),
    );
  b.add(
    'metal',
    extrude(star(0.04, 0.018), 0.012, 0.003),
    GOLD,
    m4(0, py + 0.05, zc + 0.245),
  );
  // Potted topiaries by the steps.
  for (const s of [-1]) {
    const tp = v3(s * 0.36, 0, 0.32);
    b.add(
      'paint',
      lathe(
        [
          [0, 0],
          [0.03, 0, 0.006],
          [0.04, 0.05, 0.004],
          [0.034, 0.055],
          [0, 0.055],
        ],
        20,
        2,
      ),
      '#d8784a',
      m4(tp.x, 0, tp.z),
    );
    b.add(
      'paint',
      rod(0.005, v3(tp.x, 0.05, tp.z), v3(tp.x, 0.1, tp.z)),
      '#7a5634',
    );
    bush(b, m4(tp.x, 0.085, tp.z), 0.045, '#4f9e3f');
  }
  // A dinosaur skeleton on a low plinth out front.
  const dn = m4(0.24, 0, 0.36, 0, 0.5, 0, 1.25);
  const N = (m: THREE.Matrix4) => dn.clone().multiply(m);
  const bone = '#f5e9cc';
  b.add('paint', rbox(0.32, 0.03, 0.11, 0.01), '#4b3f6b', N(m4(0, 0.015, 0)));
  b.add('metal', rbox(0.06, 0.016, 0.004, 0.003), GOLD, N(m4(0, 0.016, 0.056)));
  const spine = new THREE.CatmullRomCurve3(
    [
      [-0.17, 0.07],
      [-0.11, 0.105],
      [-0.04, 0.135],
      [0.03, 0.14],
      [0.075, 0.13],
      [0.11, 0.17],
      [0.13, 0.23],
      [0.15, 0.26],
    ].map(([x, y]) => v3(x, y + 0.03, 0)),
  );
  const beads = 30;
  for (let i = 0; i <= beads; i++) {
    const u = i / beads;
    const r = 0.005 + 0.009 * Math.sin(Math.PI * Math.min(1, u * 1.25));
    const p = spine.getPoint(u);
    b.add(
      'paint',
      sphere(r, 8, 6),
      bone,
      N(m4(p.x, p.y, p.z, 0, 0, 0, [1.2, 1, 1])),
    );
  }
  for (let k = 0; k < 6; k++) {
    const p = spine.getPoint(0.36 + k * 0.045);
    const len = 0.08 - Math.abs(k - 2.5) * 0.01;
    for (const s of [-1, 1])
      b.add(
        'paint',
        tube(
          [
            v3(p.x, p.y, 0),
            v3(p.x + 0.004, p.y - len * 0.3, s * 0.035),
            v3(p.x + 0.008, p.y - len * 0.75, s * 0.032),
            v3(p.x + 0.01, p.y - len, s * 0.01),
          ],
          0.0035,
          8,
          4,
        ),
        bone,
        dn,
      );
  }
  for (const [x, top, w] of [
    [-0.035, 0.165, 0.008],
    [0.07, 0.155, 0.007],
  ])
    for (const s of [-1, 1]) {
      const hip = v3(x, top, s * 0.03);
      const knee = v3(x + 0.012, 0.1, s * 0.032);
      const foot = v3(x, 0.04, s * 0.03);
      b.add('paint', rod(w, hip, knee, 8), bone, dn);
      b.add('paint', rod(w * 0.85, knee, foot, 8), bone, dn);
      b.add(
        'paint',
        sphere(w * 1.3, 8, 6),
        bone,
        N(m4(knee.x, knee.y, knee.z)),
      );
      b.add(
        'paint',
        rbox(0.03, 0.01, 0.02, 0.004),
        bone,
        N(m4(foot.x + 0.008, 0.035, foot.z)),
      );
    }
  b.add('paint', rbox(0.05, 0.03, 0.06, 0.012), bone, N(m4(-0.035, 0.165, 0)));
  const head = spine.getPoint(1);
  b.add(
    'paint',
    rbox(0.05, 0.026, 0.03, 0.011, 2),
    bone,
    N(m4(head.x + 0.012, head.y, 0, 0, 0, -0.2)),
  );
  b.add(
    'paint',
    rbox(0.036, 0.008, 0.024, 0.004),
    bone,
    N(m4(head.x + 0.016, head.y - 0.018, 0, 0, 0, -0.1)),
  );
  for (const s of [-1, 1])
    b.add(
      'paint',
      sphere(0.0055, 8, 6),
      '#3a2f4a',
      N(m4(head.x + 0.008, head.y + 0.006, s * 0.014)),
    );
  b.add(
    'metal',
    rod(0.004, v3(0.01, 0.03, 0), v3(0.01, 0.13, 0), 8),
    '#9aa2ad',
    dn,
  );
  b.into(group);
  // Two banners hanging between the outer columns.
  const banners = [-0.21, 0.21].map((x, i) =>
    cloth(
      [0, 0.14, 0.86, 1],
      3,
      10,
      (s, v) =>
        s !== 1 || v < 0.12
          ? GOLD
          : v > 0.45 && v < 0.6
            ? '#f6d77a'
            : '#7d5bd6',
      (u, v, t, out) =>
        out.set(
          x + (u - 0.5) * 0.1,
          ey -
            0.012 -
            (1 - v) * 0.22 -
            (v === 0 ? (0.5 - Math.abs(u - 0.5)) * 0.04 : 0),
          cz - 0.03 + Math.sin(t * 1.5 + i * 2 + v * 2.5 + u) * 0.012 * (1 - v),
        ),
    ),
  );
  for (const bn of banners) group.add(bn.mesh);
  return {
    group,
    update: (t) => {
      for (const bn of banners) bn.update(t);
    },
  };
};

// ——— Bazaar (extra) ———

const bazaar = (): Upgrade => {
  const group = new THREE.Group();
  const mats = {
    ...kitMats(),
    gem: vmat({
      transparent: true,
      opacity: 0.88,
      roughness: 0.08,
      metalness: 0.1,
      emissive: '#3a3a7a',
      emissiveIntensity: 0.3,
    }),
    glow: glowMat('#ffb04a', 0.9),
  };
  const b = new Bins(mats);
  pad(b, 0.52, mottle('#d8b98a', 0.05), '#7a5a3a', '#e8503c');
  // Cobbles.
  for (let k = 0; k < 26; k++) {
    const a = k * 2.4;
    const r = 0.18 + ((k * 37) % 30) / 100;
    b.add(
      'paint',
      rbox(0.05, 0.008, 0.04, 0.004),
      k % 3 ? '#ccab7c' : '#c49f70',
      m4(Math.cos(a) * r, 0.002, Math.sin(a) * r, 0, a, 0),
    );
  }
  // The stall: posts, a counter with a planked front, a back shelf.
  const sw = 0.76;
  const zb = -0.16;
  const zf = 0.12;
  for (const [x, z, h] of [
    [-sw / 2, zb, 0.68],
    [sw / 2, zb, 0.68],
    [-sw / 2, zf + 0.08, 0.56],
    [sw / 2, zf + 0.08, 0.56],
  ])
    b.add('paint', rbox(0.03, h, 0.03, 0.008), WOOD_DARK, m4(x, h / 2, z));
  const cy = 0.24;
  b.add('paint', rbox(sw - 0.02, 0.03, 0.28, 0.008), WOOD, m4(0, cy, -0.02));
  for (let i = 0; i < 8; i++)
    b.add(
      'paint',
      rbox(sw / 8 - 0.006, cy - 0.01, 0.016, 0.004),
      i % 2 ? '#c98f53' : '#b67f48',
      m4(-sw / 2 + 0.01 + (i + 0.5) * ((sw - 0.02) / 8), (cy - 0.01) / 2, 0.11),
    );
  b.add(
    'paint',
    rbox(sw - 0.02, 0.02, 0.02, 0.004),
    WOOD_DARK,
    m4(0, 0.1, 0.122),
  );
  b.add('paint', rbox(sw, 0.02, 0.1, 0.006), WOOD, m4(0, 0.44, zb + 0.04));
  // Jars on the back shelf.
  for (const [x, hex] of [
    [-0.25, '#f2c230'],
    [-0.17, '#e8503c'],
    [0.16, '#7ac74f'],
    [0.25, '#f28a3a'],
  ] as const) {
    b.add(
      'paint',
      lathe(
        [
          [0, 0],
          [0.025, 0, 0.006],
          [0.025, 0.05, 0.006],
          [0.018, 0.058],
          [0, 0.058],
        ],
        16,
        2,
      ),
      hex,
      m4(x, 0.45, zb + 0.04),
    );
    b.add(
      'paint',
      cyl(0.02, 0.02, 0.012, 14),
      '#8f5d31',
      m4(x, 0.512, zb + 0.04),
    );
  }
  // The scalloped valance under the awning's front edge.
  const stripes = 8;
  const sc = (sw + 0.06) / stripes;
  const red = '#e0503c';
  const cream = '#f6ead2';
  const scallop = new THREE.Shape();
  scallop.moveTo(-sc / 2, 0);
  scallop.lineTo(sc / 2, 0);
  scallop.lineTo(sc / 2, -0.02);
  scallop.absarc(0, -0.02, sc / 2, 0, -Math.PI, true);
  scallop.lineTo(-sc / 2, 0);
  const ay = 0.565;
  const az = zf + 0.1;
  for (let i = 0; i < stripes; i++)
    b.add(
      'paint',
      extrude(scallop, 0.006, 0.002),
      i % 2 ? cream : red,
      m4(-(sw + 0.06) / 2 + (i + 0.5) * sc, ay, az, 0.12, 0, 0),
    );
  // A lantern hanging from the front.
  b.add(
    'metal',
    rod(0.002, v3(0.0, ay - 0.04, az - 0.04), v3(0, ay - 0.1, az - 0.04)),
    DARK,
  );
  b.add(
    'glow',
    sphere(0.024, 14, 10),
    '#ffd27a',
    m4(0, ay - 0.125, az - 0.04, 0, 0, 0, [1, 1.2, 1]),
  );
  b.add(
    'metal',
    cyl(0.014, 0.022, 0.014, 12),
    DARK,
    m4(0, ay - 0.095, az - 0.04),
  );
  b.add(
    'metal',
    cyl(0.018, 0.012, 0.01, 12),
    DARK,
    m4(0, ay - 0.157, az - 0.04),
  );
  // Four crates of the four cargoes: fruit and crystals on the counter,
  // ingots and ice in front.
  const tilt = (x: number, y: number, z: number, ry = 0) =>
    m4(x, y, z, 0.28, ry, 0);
  const cw = 0.2;
  const ch = 0.09;
  const cd = 0.15;
  const fill = (
    at: THREE.Matrix4,
    item: (b: Bins, m: THREE.Matrix4, i: number, j: number) => void,
    nx = 3,
    nz = 2,
  ) => {
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        item(
          b,
          at
            .clone()
            .multiply(
              m4(
                -cw / 2 + (cw / nx) * (i + 0.5),
                ch * 0.25,
                -cd / 2 + (cd / nz) * (j + 0.5),
              ),
            ),
          i,
          j,
        );
  };
  const fruitAt = tilt(-0.18, cy + 0.015, -0.03);
  openCrate(b, fruitAt, cw, ch, cd);
  fill(fruitAt, (bb, m, i, j) => {
    const apple = (i + j) % 2 === 0;
    bb.add(
      'paint',
      sphere(0.03, 16, 12),
      apple ? '#e0473a' : '#f39a2b',
      m.clone().multiply(m4(Math.sin(i * 5) * 0.006, 0.05, 0)),
    );
    bb.add(
      'paint',
      sphere(0.007, 6, 4),
      apple ? '#6b4a2b' : '#5d8a2e',
      m.clone().multiply(m4(0, 0.08, 0)),
    );
  });
  b.add(
    'paint',
    sphere(1, 8, 6),
    '#4f9a35',
    fruitAt
      .clone()
      .multiply(
        m4(0.03, ch * 0.25 + 0.085, 0.0, 0, 0.5, 0.4, [0.03, 0.006, 0.014]),
      ),
  );
  const gemAt = tilt(0.18, cy + 0.015, -0.03);
  openCrate(b, gemAt, cw, ch, cd);
  fill(gemAt, (bb, m, i, j) => {
    const hh = 0.07 + ((i * 7 + j * 3) % 4) * 0.018;
    const lean = m
      .clone()
      .multiply(m4(0, 0.02, 0, (j - 0.5) * 0.5, i, (i - 1) * 0.4));
    bb.add(
      'gem',
      cyl(0.024, 0.024, hh, 6),
      '#9b5de5',
      lean.clone().multiply(m4(0, hh / 2, 0)),
    );
    bb.add(
      'gem',
      cyl(0, 0.024, 0.04, 6),
      '#c08bf5',
      lean.clone().multiply(m4(0, hh + 0.02, 0)),
    );
  });
  const ingotAt = m4(-0.17, 0.0, 0.3, 0, 0.2, 0);
  openCrate(b, ingotAt, cw, ch, cd);
  const bar = barGeo(0.05, 0.03, 0.12);
  for (const [x, y, hex] of [
    [-0.066, 0, '#e6ebf0'],
    [-0.013, 0, '#e08a52'],
    [0.04, 0, GOLD],
    [-0.04, 0.03, GOLD],
    [0.013, 0.03, '#e6ebf0'],
    [0.066, 0.03, '#e08a52'],
  ] as const)
    b.add(
      'metal',
      bar,
      hex,
      ingotAt.clone().multiply(m4(x, ch * 0.25 + 0.006 + y, 0)),
    );
  const iceAt = m4(0.17, 0.0, 0.3, 0, -0.2, 0);
  openCrate(b, iceAt, cw, ch, cd);
  for (let k = 0; k < 7; k++) {
    const i = k % 3;
    const j = Math.floor(k / 3) % 2;
    const top = k > 5;
    b.add(
      'gem',
      rbox(0.056, 0.056, 0.056, 0.012, 1),
      k % 2 ? '#6ec2f5' : '#9ad6fb',
      iceAt
        .clone()
        .multiply(
          m4(
            -0.06 + i * 0.06,
            ch * 0.25 + 0.03 + (top ? 0.045 : 0),
            -0.035 + j * 0.07,
            k * 0.4,
            k,
            k * 0.3,
          ),
        ),
    );
  }
  // A chalkboard sign with a coin and a price.
  const sg = m4(-0.38, 0, 0.24, 0, 0.6, 0);
  const G = (m: THREE.Matrix4) => sg.clone().multiply(m);
  for (const s of [-1, 1]) {
    b.add(
      'paint',
      rbox(0.11, 0.15, 0.012, 0.006),
      WOOD_DARK,
      G(m4(0, 0.075, s * 0.025, s * 0.2, 0, 0)),
    );
  }
  b.add(
    'paint',
    rbox(0.09, 0.12, 0.004, 0.003),
    '#2f4a3a',
    G(m4(0, 0.08, 0.033, 0.2, 0, 0)),
  );
  b.add(
    'metal',
    cyl(0.018, 0.018, 0.005, 16).rotateX(Math.PI / 2),
    GOLD,
    G(m4(-0.02, 0.1, 0.039, 0.2, 0, 0)),
  );
  for (const [x, y, w, h] of [
    [0.02, 0.11, 0.004, 0.03],
    [0.03, 0.098, 0.024, 0.004],
    [0.036, 0.09, 0.004, 0.044],
    [0.0, 0.05, 0.06, 0.004],
  ])
    b.add(
      'paint',
      rbox(w, h, 0.003, 0.0015),
      '#f4f1e6',
      G(m4(x, y, 0.039 + (0.11 - y) * 0.2, 0.2, 0, 0)),
    );
  // A sack at the side.
  b.add(
    'paint',
    blob(2, 0.12, 16),
    '#c9a26b',
    m4(0.42, 0.05, 0.12, 0, 0, 0, [0.05, 0.055, 0.05]),
  );
  b.add(
    'paint',
    blob(2, 0.22, 6),
    '#c9a26b',
    m4(0.42, 0.11, 0.12, 0, 0, 0, [0.024, 0.02, 0.024]),
  );
  b.into(group);
  // The striped awning, billowing gently.
  const splits = Array.from({ length: stripes + 1 }, (_, i) => i / stripes);
  const awning = cloth(
    splits,
    2,
    8,
    (s) => (s % 2 ? cream : red),
    (u, v, t, out) => {
      const sag =
        Math.sin(Math.PI * v) * (0.022 + 0.006 * Math.sin(t * 1.3 + u * 5));
      out.set(
        (u - 0.5) * (sw + 0.06),
        0.69 - v * 0.125 - sag,
        zb - 0.02 + v * (az - zb + 0.02),
      );
    },
  );
  group.add(awning.mesh);
  return { group, update: (t) => awning.update(t) };
};

export const landmarkModels: Record<string, () => Upgrade> = {
  palace: moonBase,
  guildhall: factory,
  observatory,
  archive: garage,
  fountain: pool,
  treasury: safe,
  skytower: museum,
  bazaar,
};
