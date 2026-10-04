import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { lump, m4, seeded } from './alto-3d';
import {
  TAU,
  v2,
  v3,
  vmat,
  kitMats,
  still,
  Bins,
  lathe,
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
  type Upgrade,
  type Paint,
  type Pt,
} from './alto-kit';

/**
 * Models for trophies and extras of the first two trips and the Lighthouse
 * (Beacon, Toolbox, Dish, Garden, Statue, Workbench, Lighthouse). They stand
 * alone in the shop and as modules of the player's home base (alto-base.ts,
 * which scales each to its plate), never on the ship.
 *
 * Each stands on its base at y = 0, about as wide as it is tall, seen from
 * the front (+Z) and a little to the left (the shop turns it about yaw 0.5).
 */

const STEEL = '#c9d0d8';
const BRIGHT = '#dfe4ea';
const DARK = '#33363d';
const CHARCOAL = '#3b3f48';
const CREAM = '#f3efe4';
const RED = '#d8392b';
const YELLOW = '#f2c230';
const WOOD = '#c98a4a';

/** A glowing part's material (a lamp, a bulb, a lens). */
const glow = (color: string, emissive: string, intensity: number) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.35,
  });
/** A rock with smooth shading (a lump's faces are flat). */
function rock(detail: number, rough: number, seed: number) {
  const g = lump(detail, rough, seed);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
}
/** Compose matrices left to right. */
const at = (...ms: THREE.Matrix4[]) =>
  ms.reduce((a, m) => a.multiply(m), new THREE.Matrix4());
/** Colour faces by whether they look into a box's middle. */
const inOut =
  (centre: THREE.Vector3, outer: string, inner: string): Paint =>
  (c, n) =>
    n.dot(centre.clone().sub(c)) > 0 ? inner : outer;
/** An open-topped box (floor and four walls) standing on y = 0. */
function openBox(
  b: Bins,
  w: number,
  h: number,
  d: number,
  th: number,
  where: THREE.Matrix4,
  outer: string,
  inner: string,
  key = 'paint',
) {
  const paint = inOut(v3(0, h * 0.6, 0), outer, inner);
  const r = th * 0.45;
  const slabs = [
    rbox(w, th, d, r, 2).translate(0, th / 2, 0),
    rbox(w, h, th, r, 2).translate(0, h / 2, d / 2 - th / 2),
    rbox(w, h, th, r, 2).translate(0, h / 2, -d / 2 + th / 2),
    rbox(th, h, d - th * 2, r, 2).translate(w / 2 - th / 2, h / 2, 0),
    rbox(th, h, d - th * 2, r, 2).translate(-w / 2 + th / 2, h / 2, 0),
  ];
  for (const s of slabs) b.add(key, s, paint, where);
}
/** A lathe profile for a straight run, split at these heights so that each
 * band can take its own colour. */
const bands = (r0: number, r1: number, ys: number[]): Pt[] =>
  ys.map((y) => {
    const u = (y - ys[0]) / (ys[ys.length - 1] - ys[0]);
    return [r0 + (r1 - r0) * u, y];
  });

// ——— Hand tools (each along +Y from its handle end, flat side facing +Z) ———

/** An open-ended spanner's jaw: a C opening towards +X. */
function jawShape(r: number) {
  const g = 0.62;
  const jw = r * Math.sin(g) * 0.92;
  const s = new THREE.Shape();
  s.moveTo(r * Math.cos(g), r * Math.sin(g));
  s.absarc(0, 0, r, g, TAU - g, false);
  s.lineTo(r * Math.cos(g), -jw);
  s.lineTo(-0.12 * r, -jw);
  s.lineTo(-0.12 * r, jw);
  s.lineTo(r * Math.cos(g), jw);
  s.closePath();
  return s;
}
function spannerParts(
  b: Bins,
  where: THREE.Matrix4,
  len = 0.2,
  colour = BRIGHT,
) {
  const r = len * 0.135;
  const bar = extrude(
    roundRect(len * 0.12, len - r * 1.2, len * 0.045),
    0.008,
    0.002,
    2,
    6,
  );
  b.add('metal', bar, colour, at(where.clone(), m4(0, len / 2, 0)));
  const head = extrude(jawShape(r), 0.009, 0.0025, 2, 18);
  b.add(
    'metal',
    head,
    colour,
    at(where.clone(), m4(0, len - r * 0.4, 0, 0, 0, Math.PI / 2 + 0.26)),
  );
  b.add(
    'metal',
    head,
    colour,
    at(where.clone(), m4(0, r * 0.4, 0, 0, 0, -Math.PI / 2 - 0.26, 0.82)),
  );
}
function screwdriverParts(
  b: Bins,
  where: THREE.Matrix4,
  handle = RED,
  len = 0.19,
) {
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.014, 0, 0.004],
        [0.016, 0.012, 0.004],
        [0.017, 0.052, 0.01],
        [0.011, 0.07, 0.004],
        [0.007, 0.08],
        [0, 0.08],
      ],
      16,
      3,
    ),
    handle,
    where,
  );
  b.add(
    'paint',
    new THREE.TorusGeometry(0.0158, 0.0035, 5, 18).rotateX(Math.PI / 2),
    YELLOW,
    at(where.clone(), m4(0, 0.016, 0)),
  );
  b.add(
    'metal',
    cyl(0.0038, 0.0038, len - 0.08, 8),
    BRIGHT,
    at(where.clone(), m4(0, (len + 0.08) / 2, 0)),
  );
  b.add(
    'metal',
    rbox(0.01, 0.018, 0.0035, 0.0012),
    BRIGHT,
    at(where.clone(), m4(0, len + 0.006, 0)),
  );
}
function pliersParts(b: Bins, where: THREE.Matrix4, grip = RED) {
  for (const s of [-1, 1]) {
    b.add(
      'metal',
      tube(
        [v3(s * 0.004, 0.115, 0), v3(s * 0.012, 0.075, 0), v3(s * 0.024, 0, 0)],
        0.0045,
        10,
        5,
      ),
      BRIGHT,
      where,
    );
    b.add(
      'paint',
      tube(
        [
          v3(s * 0.0118, 0.072, 0),
          v3(s * 0.017, 0.04, 0),
          v3(s * 0.0245, -0.004, 0),
        ],
        0.0085,
        10,
        8,
      ),
      grip,
      where,
    );
  }
  b.add(
    'metal',
    cyl(0.013, 0.013, 0.011, 16),
    STEEL,
    at(where.clone(), m4(0, 0.115, 0, Math.PI / 2, 0, 0)),
  );
  const jaws = new THREE.Shape([
    v2(-0.012, 0.11),
    v2(0.012, 0.11),
    v2(0.0045, 0.17),
    v2(-0.0045, 0.17),
  ]);
  b.add('metal', extrude(jaws, 0.008, 0.002, 1), BRIGHT, where);
}
function hammerParts(b: Bins, where: THREE.Matrix4, len = 0.22) {
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.012, 0, 0.004],
        [0.0135, 0.03, 0.01],
        [0.011, 0.12],
        [0.0095, len],
        [0, len],
      ],
      14,
      3,
    ),
    (c) => (c.y < 0.07 ? '#3a3330' : WOOD),
    where,
  );
  const y = len + 0.004;
  b.add(
    'metal',
    rbox(0.1, 0.03, 0.03, 0.008, 2),
    '#9aa3ad',
    at(where.clone(), m4(0.008, y, 0)),
  );
  b.add(
    'metal',
    cyl(0.017, 0.017, 0.02, 16),
    BRIGHT,
    at(where.clone(), m4(0.064, y, 0, 0, 0, Math.PI / 2)),
  );
  b.add(
    'metal',
    rod(0.004, v3(-0.036, y, 0), v3(-0.08, y - 0.02, 0), 6, 0.014),
    '#9aa3ad',
    where,
  );
}
function sawParts(b: Bins, where: THREE.Matrix4) {
  const grip = roundRect(0.07, 0.08, 0.02, 0, 0.035);
  grip.holes.push(roundRect(0.034, 0.034, 0.012, 0.004, 0.04));
  b.add('paint', extrude(grip, 0.016, 0.004, 2, 6), WOOD, where);
  const blade = new THREE.Shape();
  blade.moveTo(-0.034, 0.07);
  blade.lineTo(0.032, 0.07);
  blade.lineTo(0.018, 0.33);
  const teeth = 16;
  for (let k = 0; k <= teeth; k++) {
    const u = k / teeth;
    const yy = 0.33 - u * 0.26;
    const xx = -0.012 - 0.022 * u;
    blade.lineTo(xx - (k % 2 ? 0.007 : 0), yy);
  }
  blade.closePath();
  b.add('metal', extrude(blade, 0.003, 0.001, 1), BRIGHT, where);
  for (const yy of [0.05, 0.075])
    b.add(
      'metal',
      cyl(0.006, 0.006, 0.02, 10),
      YELLOW,
      at(where.clone(), m4(0.016, yy, 0, Math.PI / 2, 0, 0)),
    );
}

// ——— Beacon (trophy) ———

/** A roadworks beacon: a banded post on a heavy foot, an amber lamp with a
 * turning mirror, a little solar panel and a traffic cone. */
const beacon = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const lensMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.94,
    emissive: '#ff5200',
    emissiveIntensity: 0.8,
  });
  const bulbMat = glow('#fff4cc', '#ffcf70', 2.2);
  const b = new Bins({ ...mats, lens: lensMat, bulb: bulbMat });
  const black = '#2b2e35';
  // The heavy foot, a hazard checker round its rim.
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.27, 0, 0.012],
        [0.28, 0.05, 0.012],
        [0.24, 0.066, 0.014],
        [0.11, 0.092, 0.03],
        [0.075, 0.13, 0.012],
        [0, 0.13],
      ],
      48,
      3,
    ),
    (c) => {
      const r = Math.hypot(c.x, c.z);
      if (r < 0.245 || c.y > 0.058) return '#41454e';
      const k = Math.floor(((Math.atan2(c.z, c.x) + TAU) / TAU) * 16);
      return k % 2 ? YELLOW : black;
    },
  );
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3;
    b.add(
      'metal',
      cyl(0.014, 0.014, 0.014, 6),
      STEEL,
      m4(Math.cos(a) * 0.17, 0.084, Math.sin(a) * 0.17),
    );
  }
  // The post in reflective bands.
  const n = 8;
  const y0 = 0.13;
  const y1 = 0.78;
  const ys = Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
  b.add(
    'paint',
    lathe([[0, y0], ...bands(0.066, 0.06, ys), [0, y1]], 28, 2),
    (c) =>
      c.y > y1 - 0.004 || c.y < y0 + 0.004
        ? black
        : Math.floor(((c.y - y0) / (y1 - y0)) * n) % 2
          ? black
          : YELLOW,
  );
  // A battery box clamped on the front, with a lightning label.
  const box = m4(0, 0.43, 0.112);
  b.add('paint', rbox(0.15, 0.18, 0.09, 0.02, 2), CREAM, box);
  b.add(
    'paint',
    rbox(0.156, 0.018, 0.096, 0.008),
    '#d9d3c4',
    at(box.clone(), m4(0, 0.06, 0)),
  );
  b.add('paint', rbox(0.07, 0.14, 0.06, 0.01), black, m4(0, 0.43, 0.04));
  for (const y of [0.37, 0.49])
    b.add(
      'metal',
      new THREE.TorusGeometry(0.068, 0.008, 6, 24).rotateX(Math.PI / 2),
      STEEL,
      m4(0, y, 0),
    );
  b.add(
    'paint',
    extrude(roundRect(0.08, 0.08, 0.016), 0.006, 0.002),
    black,
    at(box.clone(), m4(0, -0.02, 0.046)),
  );
  const bolt = new THREE.Shape([
    v2(0.012, 0.032),
    v2(-0.014, -0.002),
    v2(0.002, -0.002),
    v2(-0.01, -0.034),
    v2(0.016, 0.006),
    v2(0.0, 0.006),
  ]);
  b.add(
    'paint',
    extrude(bolt, 0.004, 0.001, 1),
    YELLOW,
    at(box.clone(), m4(0, -0.02, 0.05)),
  );
  for (const x of [-0.05, 0.05])
    b.add(
      'metal',
      dome(0.007, 6, 2),
      STEEL,
      at(box.clone(), m4(x, 0.035, 0.045, Math.PI / 2, 0, 0)),
    );
  // A solar panel on an arm, tilted to the sky.
  const panel = m4(-0.25, 0.74, 0.02, 0.22, 0, 0.55);
  b.add('metal', rbox(0.3, 0.02, 0.22, 0.007, 2), '#d5dae0', panel);
  b.add(
    'paint',
    new THREE.PlaneGeometry(0.276, 0.196, 6, 4).rotateX(-Math.PI / 2),
    (c) => {
      const i = Math.floor(((c.x + 0.138) / 0.276) * 6);
      const j = Math.floor(((c.z + 0.098) / 0.196) * 4);
      return (i + j) % 2 ? '#2a4c8f' : '#2f58a2';
    },
    at(panel.clone(), m4(0, 0.0105, 0)),
  );
  for (let i = 1; i < 6; i++)
    b.add(
      'metal',
      new THREE.BoxGeometry(0.003, 0.002, 0.196),
      '#c7ced8',
      at(panel.clone(), m4(-0.138 + (0.276 * i) / 6, 0.011, 0)),
    );
  for (let j = 1; j < 4; j++)
    b.add(
      'metal',
      new THREE.BoxGeometry(0.276, 0.002, 0.003),
      '#c7ced8',
      at(panel.clone(), m4(0, 0.011, -0.098 + (0.196 * j) / 4)),
    );
  const knuckle = v3(0, -0.03, 0).applyMatrix4(panel);
  b.add(
    'metal',
    sphere(0.018, 12, 8),
    STEEL,
    m4(knuckle.x, knuckle.y, knuckle.z),
  );
  b.add('metal', rod(0.011, v3(-0.03, 0.66, 0), knuckle, 10), STEEL);
  b.add(
    'metal',
    new THREE.TorusGeometry(0.068, 0.009, 6, 24).rotateX(Math.PI / 2),
    STEEL,
    m4(0, 0.66, 0),
  );
  b.add(
    'paint',
    tube(
      [
        knuckle,
        v3(-0.12, 0.6, 0.06),
        v3(-0.07, 0.52, 0.12),
        v3(-0.04, 0.5, 0.14),
      ],
      0.006,
      14,
      5,
    ),
    black,
  );
  // The lamp: a collar, a ribbed amber lens and a cap with a ring, made a
  // size up so it reads as the subject.
  const LS = 1.3;
  const lampAt = at(m4(0, y1, 0), m4(0, 0, 0, 0, 0, 0, LS), m4(0, -y1, 0));
  const lamp = (m = new THREE.Matrix4()) => at(lampAt.clone(), m);
  b.add(
    'paint',
    lathe(
      [
        [0, y1],
        [0.07, y1],
        [0.07, 0.795],
        [0.105, 0.8, 0.008],
        [0.105, 0.845, 0.006],
        [0, 0.845],
      ],
      32,
      3,
    ),
    '#41454e',
    lamp(),
  );
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    b.add(
      'metal',
      dome(0.0075, 6, 2),
      STEEL,
      lamp(m4(Math.cos(a) * 0.099, 0.845, Math.sin(a) * 0.099)),
    );
  }
  const lens: Pt[] = [
    [0, 0.845],
    [0.088, 0.845],
  ];
  for (let k = 0; k <= 8; k++)
    lens.push([0.089 + (k % 2) * 0.004, 0.857 + k * 0.0125]);
  lens.push([0.08, 0.982, 0.02], [0.05, 0.996, 0.01], [0, 0.998]);
  b.add('lens', lathe(lens, 36, 3), '#ff7614', lamp());
  b.add(
    'paint',
    lathe(
      [
        [0, 0.99],
        [0.055, 0.99],
        [0.058, 1.006, 0.006],
        [0.03, 1.022, 0.006],
        [0, 1.026],
      ],
      28,
      3,
    ),
    '#41454e',
    lamp(),
  );
  b.add(
    'metal',
    new THREE.TorusGeometry(0.022, 0.006, 6, 20),
    STEEL,
    lamp(m4(0, 1.048, 0)),
  );
  b.add('paint', cyl(0.018, 0.022, 0.04, 12), DARK, lamp(m4(0, 0.865, 0)));
  b.add('bulb', sphere(0.026, 14, 10), '#ffffff', lamp(m4(0, 0.905, 0)));
  // A traffic cone beside it.
  const cone = m4(0.37, 0, 0.13);
  b.add(
    'paint',
    rbox(0.17, 0.022, 0.17, 0.008, 2),
    black,
    at(cone.clone(), m4(0, 0.011, 0)),
  );
  const cr = (y: number) =>
    0.066 + ((0.017 - 0.066) * (y - 0.024)) / (0.215 - 0.024);
  b.add(
    'paint',
    lathe(
      [
        [0, 0.022],
        [0.072, 0.022],
        [0.072, 0.026],
        ...[0.026, 0.09, 0.14, 0.215].map((y): Pt => [cr(y), y]),
        [0.012, 0.222, 0.006],
        [0, 0.224],
      ],
      28,
      2,
    ),
    (c) => (c.y > 0.092 && c.y < 0.138 ? '#f6f4ee' : '#f07a24'),
    cone,
  );
  b.into(group);
  // The mirror turns round the bulb.
  const mirror = new THREE.Group();
  mirror.position.y = y1 + (0.905 - y1) * LS;
  mirror.scale.setScalar(LS);
  const arc = new THREE.Shape();
  arc.absarc(0, 0, 0.066, Math.PI / 2, Math.PI * 1.5, false);
  arc.absarc(0, 0, 0.058, Math.PI * 1.5, Math.PI / 2, true);
  arc.closePath();
  const mb = new Bins({ metal: mats.metal });
  mb.add(
    'metal',
    extrude(arc, 0.085, 0.002, 1, 18).rotateX(-Math.PI / 2),
    '#f4f6f8',
  );
  mb.into(mirror);
  group.add(mirror);
  return {
    group,
    update: (t) => {
      const a = t * 2.6;
      mirror.rotation.y = a;
      // The mirror's open side faces (cos a, 0, −sin a); flash towards the camera.
      const f = Math.max(0, Math.cos(a) * -0.48 - Math.sin(a) * 0.88);
      lensMat.emissiveIntensity = 0.8 + 1.6 * f ** 3;
      bulbMat.emissiveIntensity = 1.8 + 1.4 * f ** 3;
    },
  };
};

// ——— Toolbox (extra) ———

/** A red cantilever toolbox, both trays swung open on their arms, full of
 * spanners, pliers, a tape measure and nuts, a hammer standing in it. */
const toolbox = (): Upgrade => {
  const group = new THREE.Group();
  const b = new Bins(kitMats());
  const red = '#d63a2c';
  const redIn = '#a52b21';
  const W = 0.56;
  const H = 0.26;
  const D = 0.3;
  openBox(b, W, H, D, 0.018, m4(), red, redIn);
  // A rolled lip round the top.
  for (const z of [-1, 1])
    b.add(
      'paint',
      rbox(W + 0.008, 0.016, 0.026, 0.007, 2),
      red,
      m4(0, H, z * (D / 2 - 0.009)),
    );
  for (const x of [-1, 1])
    b.add(
      'paint',
      rbox(0.026, 0.016, D, 0.007, 2),
      red,
      m4(x * (W / 2 - 0.009), H, 0),
    );
  // Rubber feet, latches, a label plate and end handles.
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      b.add(
        'paint',
        cyl(0.022, 0.024, 0.014, 12),
        DARK,
        m4(x * 0.23, -0.005, z * 0.11),
      );
  for (const x of [-0.18, 0.18]) {
    b.add(
      'metal',
      rbox(0.045, 0.055, 0.012, 0.004, 2),
      BRIGHT,
      m4(x, H - 0.045, D / 2 + 0.006),
    );
    b.add(
      'metal',
      dome(0.008, 8, 2),
      STEEL,
      m4(x, H - 0.035, D / 2 + 0.012, Math.PI / 2, 0, 0),
    );
  }
  b.add(
    'paint',
    extrude(roundRect(0.17, 0.065, 0.014), 0.006, 0.002),
    CREAM,
    m4(0, 0.11, D / 2 + 0.004),
  );
  for (const [y, w] of [
    [0.122, 0.11],
    [0.098, 0.07],
  ] as const)
    b.add(
      'paint',
      rbox(w, 0.01, 0.004, 0.0015),
      DARK,
      m4(0.012, y, D / 2 + 0.009),
    );
  b.add(
    'paint',
    extrude(star(0.016, 0.007), 0.004, 0.001, 1),
    red,
    m4(-0.058, 0.11, D / 2 + 0.009),
  );
  for (const s of [-1, 1]) {
    const x = s * (W / 2);
    b.add(
      'metal',
      tube(
        [
          v3(x, 0.17, -0.07),
          v3(x + s * 0.035, 0.168, -0.06),
          v3(x + s * 0.045, 0.165, 0),
          v3(x + s * 0.035, 0.168, 0.06),
          v3(x, 0.17, 0.07),
        ],
        0.007,
        16,
        6,
      ),
      STEEL,
    );
    b.add(
      'paint',
      cyl(0.012, 0.012, 0.075, 12),
      DARK,
      m4(x + s * 0.045, 0.165, 0, Math.PI / 2, 0, 0),
    );
  }
  // Two shallow trays swung out on parallel arms.
  const ty = H + 0.085;
  const th = 0.062;
  for (const s of [-1, 1]) {
    openBox(b, 0.27, th, D, 0.012, m4(s * 0.29, ty, 0), red, redIn);
    b.add(
      'paint',
      rbox(0.01, th - 0.016, D - 0.03, 0.004, 1),
      redIn,
      m4(s * 0.3, ty + th / 2, 0),
    );
    for (const z of [-1, 1]) {
      const zz = z * (D / 2 + 0.007);
      for (const x0 of [0.11, 0.23]) {
        const a = v3(s * x0, H - 0.035, zz);
        const c = v3(s * (x0 + 0.1), ty + 0.026, zz);
        const d = c.clone().sub(a);
        b.add(
          'metal',
          rbox(d.length() + 0.024, 0.022, 0.007, 0.0034, 1),
          STEEL,
          m4((a.x + c.x) / 2, (a.y + c.y) / 2, zz, 0, 0, Math.atan2(d.y, d.x)),
        );
        for (const p of [a, c])
          b.add(
            'metal',
            dome(0.007, 8, 2),
            BRIGHT,
            m4(p.x, p.y, zz + z * 0.004, (z * Math.PI) / 2, 0, 0),
          );
      }
    }
  }
  // Left tray: pliers and a spanner leaning out of it.
  const floor = ty + 0.012;
  pliersParts(b, aim(v3(-0.36, floor + 0.17, 0.05), v3(0.32, -1, -0.1)));
  spannerParts(b, aim(v3(-0.2, floor + 0.01, -0.07), v3(-0.45, 1, 0.25)), 0.17);
  // Right tray: a tape measure on its edge and two screwdrivers.
  const tape = m4(0.23, floor + 0.045, 0.06, Math.PI / 2, 0, 0);
  b.add(
    'paint',
    lathe(
      [
        [0, -0.017],
        [0.045, -0.017, 0.01],
        [0.045, 0.017, 0.01],
        [0, 0.017],
      ],
      28,
      3,
    ),
    YELLOW,
    tape,
  );
  for (const y of [-0.018, 0.018])
    b.add(
      'paint',
      cyl(0.03, 0.03, 0.004, 20),
      DARK,
      at(tape.clone(), m4(0, y, 0)),
    );
  b.add(
    'metal',
    rbox(0.024, 0.026, 0.016, 0.003),
    BRIGHT,
    at(tape.clone(), m4(0.044, 0, 0.02)),
  );
  screwdriverParts(
    b,
    aim(v3(0.37, floor + 0.2, -0.07), v3(-0.25, -1, 0.05)),
    YELLOW,
    0.18,
  );
  screwdriverParts(
    b,
    aim(v3(0.33, floor + 0.19, 0.0), v3(0.12, -1, -0.15)),
    '#3b8fd5',
    0.17,
  );
  // In the box: a hammer, head up, and a big spanner.
  hammerParts(b, aim(v3(0.06, 0.03, -0.04), v3(-0.38, 1, 0.08)), 0.32);
  spannerParts(b, aim(v3(0.12, 0.03, 0.06), v3(0.22, 1, 0.12)), 0.3, '#c3cad3');
  b.into(group);
  return still(group);
};

// ——— Dish (trophy) ———

/** A big home satellite dish on a pole, strapped to a tiled roof beside a
 * brick chimney, with its arm and head (LNB) and a robin on the rim. */
const dish = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const b = new Bins(mats);
  const rand = seeded(31);
  // The top of a little house: plaster gables and a tiled roof.
  const L = 0.84;
  const ridge = 0.27;
  const eave = 0.07;
  const half = 0.3;
  const prism = new THREE.Shape([
    v2(-half + 0.02, 0),
    v2(half - 0.02, 0),
    v2(half - 0.02, eave),
    v2(0, ridge - 0.01),
    v2(-half + 0.02, eave),
  ]);
  b.add(
    'paint',
    extrude(prism, L - 0.04, 0.004, 2).rotateY(Math.PI / 2),
    '#efe2c8',
  );
  const slope = Math.atan2(ridge - eave, half);
  const run = Math.hypot(ridge - eave, half) + 0.04;
  for (const s of [-1, 1]) {
    // The deck under the tiles.
    b.add(
      'paint',
      rbox(L + 0.04, 0.02, run, 0.006, 1),
      '#7b4a32',
      m4(0, (ridge + eave) / 2 + 0.005, (s * half) / 2, s * slope, 0, 0),
    );
  }
  const tiles = ['#c8643c', '#b95934', '#d2714a', '#c06040'];
  const rows = 5;
  for (let i = 0; i < rows; i++) {
    const u = (i + 0.5) / rows;
    const z = half * (1 - u) + 0.02;
    const y = eave + (ridge - eave) * u + 0.022;
    const nx = i % 2 ? 9 : 8;
    for (let j = 0; j < nx; j++) {
      const x = -L / 2 + 0.02 + ((j + (i % 2 ? 0 : 0.5)) * (L - 0.04)) / 8.5;
      if (x > L / 2 - 0.02) continue;
      b.add(
        'paint',
        rbox(0.094, 0.018, 0.09, 0.008, 1),
        tiles[Math.floor(rand() * tiles.length)],
        m4(x, y, z, slope + 0.1, 0, (rand() - 0.5) * 0.04),
      );
    }
    // The back slope as long rows (it faces away).
    b.add(
      'paint',
      rbox(L, 0.018, 0.09, 0.008, 1),
      '#b95934',
      m4(0, y, -z, -slope - 0.1, 0, 0),
    );
  }
  for (let j = 0; j < 7; j++)
    b.add(
      'paint',
      lathe(
        [
          [0, -0.064],
          [0.034, -0.062, 0.01],
          [0.034, 0.062, 0.01],
          [0, 0.064],
        ],
        14,
        2,
      ).rotateZ(Math.PI / 2),
      '#a84e30',
      m4(-L / 2 + 0.06 + j * 0.12, ridge + 0.012, 0),
    );
  for (const x of [-1, 1])
    b.add(
      'paint',
      extrude(prism, 0.012, 0.004).rotateY(Math.PI / 2),
      '#8a5a3a',
      m4((x * L) / 2, 0.0, 0, 0, 0, 0, [1, 1.0, 1.07]),
    );
  // A brick chimney.
  const cx = -0.3;
  const cz = 0.0;
  b.add('paint', rbox(0.14, 0.34, 0.14, 0.006), '#cfc6b8', m4(cx, 0.33, cz));
  const bricks = ['#b24a32', '#a8432c', '#bd5638', '#9e3f2b'];
  for (let r = 0; r < 8; r++) {
    const y = 0.2 + r * 0.035;
    const off = r % 2 ? [-0.0525, 0, 0.0525] : [-0.0275, 0.0275];
    const wid = r % 2 ? [0.03, 0.066, 0.03] : [0.05, 0.05];
    for (const [nx, nz] of [
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      off.forEach((o, k) => {
        const g = rbox(
          nx ? 0.012 : wid[k],
          0.03,
          nz ? 0.012 : wid[k],
          0.004,
          1,
        );
        b.add(
          'paint',
          g,
          bricks[Math.floor(rand() * bricks.length)],
          m4(cx + nx * 0.072 + (nz ? o : 0), y, cz + nz * 0.072 + (nx ? o : 0)),
        );
      });
    }
  }
  b.add(
    'paint',
    rbox(0.19, 0.03, 0.19, 0.008, 2),
    '#b9b4ac',
    m4(cx, 0.505, cz),
  );
  b.add(
    'paint',
    lathe(
      [
        [0, 0.515],
        [0.04, 0.515],
        [0.036, 0.56, 0.01],
        [0.042, 0.575, 0.005],
        [0.03, 0.578],
        [0.03, 0.56],
        [0, 0.56],
      ],
      18,
      2,
    ),
    '#c06040',
  );
  // The pole on a saddle bracket over the ridge, braced to both slopes.
  const px = 0.1;
  const pz = 0.0;
  b.add(
    'metal',
    rod(0.021, v3(px, ridge, pz), v3(px, 0.66, pz), 16),
    '#b9c0c8',
  );
  b.add(
    'metal',
    rbox(0.1, 0.03, 0.08, 0.008, 2),
    '#9aa3ad',
    m4(px, ridge + 0.02, pz),
  );
  for (const s of [-1, 1]) {
    const foot = v3(px, eave + (ridge - eave) * 0.42 + 0.03, s * half * 0.58);
    b.add('metal', rod(0.009, v3(px, 0.44, pz), foot, 8), '#9aa3ad');
    b.add(
      'metal',
      rbox(0.06, 0.012, 0.05, 0.004),
      '#9aa3ad',
      m4(foot.x, foot.y - 0.004, foot.z, s * slope, 0, 0),
    );
    for (const dx of [-0.018, 0.018])
      b.add(
        'metal',
        dome(0.006, 6, 2),
        BRIGHT,
        m4(foot.x + dx, foot.y + 0.003, foot.z, s * slope, 0, 0),
      );
  }
  // The dish: an oval reflector tilted a little to the sky.
  const tilt = 0.24;
  const n = v3(0, Math.sin(tilt), Math.cos(tilt));
  const centre = v3(px, 0.78, 0.13);
  const Dm = aim(centre, n);
  const D = (m: THREE.Matrix4) => Dm.clone().multiply(m);
  const k = 0.95;
  const rim = 0.27;
  const tall = 1.13;
  const prof: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const r = (rim * i) / 14;
    prof.push([r, k * r * r - 0.014 - 0.006 * (1 - i / 14)]);
  }
  for (let i = 14; i >= 0; i--) {
    const r = (rim * i) / 14;
    prof.push([r, k * r * r]);
  }
  const white = '#ecebe6';
  b.add(
    'paint',
    lathe(prof, 56),
    (c, nn) => (nn.y > 0 ? white : '#cdd0d5'),
    D(m4(0, 0, 0, 0, 0, 0, [1, 1, tall])),
  );
  b.add(
    'paint',
    new THREE.TorusGeometry(rim + 0.003, 0.011, 8, 56).rotateX(Math.PI / 2),
    '#e2e1db',
    D(m4(0, k * rim * rim - 0.004, 0, 0, 0, 0, [1, 1, tall])),
  );
  // A maker's badge low on the face.
  const zb = 0.21;
  const slopeB = Math.atan(2 * k * zb);
  b.add(
    'paint',
    extrude(roundRect(0.09, 0.026, 0.01), 0.003, 0.001).rotateX(-Math.PI / 2),
    '#f08a2a',
    D(m4(0, k * zb * zb + 0.003, zb, slopeB, 0, 0)),
  );
  // The back: a ribbed mount and the clamp round the pole.
  b.add('metal', rbox(0.16, 0.03, 0.2, 0.01, 2), '#aab2bc', D(m4(0, -0.03, 0)));
  for (const x of [-0.05, 0.05])
    b.add(
      'metal',
      rbox(0.014, 0.05, 0.18, 0.005, 1),
      '#9aa3ad',
      D(m4(x, -0.06, 0)),
    );
  const back = v3(0, -0.08, 0).applyMatrix4(Dm);
  b.add('metal', rod(0.016, back, v3(px, 0.64, pz + 0.02), 10), '#9aa3ad');
  b.add('metal', rbox(0.07, 0.09, 0.07, 0.014, 2), '#8a919b', m4(px, 0.64, pz));
  for (const y of [0.615, 0.665])
    b.add(
      'metal',
      new THREE.TorusGeometry(0.03, 0.006, 6, 18).rotateX(Math.PI / 2),
      BRIGHT,
      m4(px, y, pz),
    );
  // The arm from under the dish to the head at the focus, and the head.
  const armPts = [
    v3(0, -0.05, 0.16),
    v3(0, -0.02, 0.31),
    v3(0, 0.1, 0.33),
    v3(0, 0.3, 0.17),
  ].map((p) => p.applyMatrix4(Dm));
  b.add('metal', tube(armPts, 0.012, 20, 8), '#b9c0c8');
  const head = v3(0, 0.37, 0.12).applyMatrix4(Dm);
  const toDish = centre.clone().sub(head).normalize();
  const H = aim(head, toDish.clone().negate());
  const Hm = (m: THREE.Matrix4) => H.clone().multiply(m);
  b.add(
    'paint',
    rbox(0.055, 0.1, 0.06, 0.016, 2),
    '#e3e5e8',
    Hm(m4(0, 0.01, 0)),
  );
  b.add(
    'paint',
    lathe(
      [
        [0, -0.09],
        [0.034, -0.09, 0.005],
        [0.026, -0.05],
        [0.024, -0.03],
        [0, -0.03],
      ],
      20,
      2,
    ),
    '#f4f4f1',
    Hm(m4()),
  );
  b.add('paint', cyl(0.027, 0.027, 0.004, 18), '#2d3038', Hm(m4(0, -0.091, 0)));
  b.add('paint', cyl(0.013, 0.013, 0.03, 12), '#8a919b', Hm(m4(0, 0.07, 0)));
  b.add(
    'metal',
    rbox(0.04, 0.03, 0.07, 0.008),
    '#9aa3ad',
    Hm(m4(0, 0.02, 0.04)),
  );
  // The coax cable down the arm and the pole to the roof.
  const cable = [
    v3(0, 0.08, 0).applyMatrix4(H),
    v3(0.02, 0.28, 0.2).applyMatrix4(Dm),
    v3(0.02, 0.06, 0.34).applyMatrix4(Dm),
    v3(0.03, -0.06, 0.2).applyMatrix4(Dm),
    v3(px + 0.03, 0.56, pz + 0.025),
    v3(px + 0.03, 0.4, pz + 0.025),
    v3(px + 0.05, ridge + 0.04, pz + 0.05),
    v3(px + 0.12, eave + 0.12, 0.2),
  ];
  b.add('paint', tube(cable, 0.006, 60, 5), '#25282e');
  b.into(group);
  // A robin on the top of the rim, bobbing its head.
  const perch = v3(0, k * rim * rim + 0.008, -rim * tall - 0.004).applyMatrix4(
    Dm,
  );
  const bird = new THREE.Group();
  bird.position.copy(perch);
  bird.rotation.y = 0.35;
  const bb = new Bins({ paint: mats.paint });
  const brown = '#8a5a3a';
  const breast = '#f07a32';
  bb.add(
    'paint',
    sphere(0.036, 16, 12),
    (c) =>
      c.x > 0.012 && c.y < 0.012 ? breast : c.y < -0.022 ? '#e8d8c0' : brown,
    m4(0, 0.038, 0, 0, 0, -0.25, [1.25, 1, 0.95]),
  );
  bb.add(
    'paint',
    rbox(0.05, 0.008, 0.026, 0.004),
    '#6b4429',
    m4(-0.058, 0.05, 0, 0, 0, 0.45),
  );
  for (const z of [-0.012, 0.012])
    bb.add(
      'paint',
      rod(0.0025, v3(0.004, 0.012, z), v3(0.006, -0.002, z), 4),
      '#e0a040',
    );
  bb.into(bird);
  const birdHead = new THREE.Group();
  birdHead.position.set(0.03, 0.068, 0);
  const hb = new Bins({ paint: mats.paint });
  hb.add('paint', sphere(0.024, 14, 10), (c) =>
    c.x > 0.01 && c.y < -0.004 ? breast : brown,
  );
  hb.add(
    'paint',
    cyl(0.0001, 0.008, 0.02, 6),
    '#e8a838',
    m4(0.03, -0.002, 0, 0, 0, -Math.PI / 2),
  );
  for (const z of [-1, 1])
    hb.add(
      'paint',
      sphere(0.0045, 6, 4),
      '#16181c',
      m4(0.016, 0.006, z * 0.018),
    );
  hb.into(birdHead);
  bird.add(birdHead);
  group.add(bird);
  return {
    group,
    update: (t) => {
      const hop = Math.max(0, Math.sin(t * 1.3)) ** 6;
      birdHead.rotation.z = -0.25 * hop + 0.06 * Math.sin(t * 3.1);
      birdHead.rotation.y = 0.35 * Math.sin(t * 0.7);
    },
  };
};

// ——— Garden (extra) ———

function leafShape(len: number, wid: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(wid, len * 0.4, 0, len);
  s.quadraticCurveTo(-wid, len * 0.4, 0, 0);
  return s;
}

/** A raised planter box with a sunflower, tulips, lettuces and carrots, a
 * watering can and a garden gnome. */
const garden = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const b = new Bins(mats);
  const rand = seeded(17);
  const woods = ['#c98a4a', '#bb7a3c', '#d39654'];
  const post = '#8f5c32';
  const X = 0.42;
  const Z = 0.2;
  // The box: corner posts, planks, a cap rail and nails.
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      b.add(
        'paint',
        rbox(0.06, 0.3, 0.06, 0.012, 2),
        post,
        m4(x * (X - 0.02), 0.15, z * (Z - 0.01)),
      );
  for (let i = 0; i < 3; i++) {
    const y = 0.045 + i * 0.085;
    for (const z of [-1, 1])
      b.add(
        'paint',
        rbox(2 * X - 0.07, 0.078, 0.03, 0.012, 2),
        woods[Math.floor(rand() * 3)],
        m4(0, y, z * (Z - 0.005)),
      );
    for (const x of [-1, 1])
      b.add(
        'paint',
        rbox(0.03, 0.078, 2 * Z - 0.07, 0.012, 2),
        woods[Math.floor(rand() * 3)],
        m4(x * (X - 0.015), y, 0),
      );
    for (const x of [-1, 1])
      for (const yy of [-0.02, 0.02])
        b.add(
          'metal',
          dome(0.0055, 6, 2),
          '#6f6a66',
          m4(x * (X - 0.068), y + yy, Z + 0.011, Math.PI / 2, 0, 0),
        );
  }
  for (const z of [-1, 1])
    b.add(
      'paint',
      rbox(2 * X + 0.04, 0.024, 0.07, 0.01, 2),
      '#dba468',
      m4(0, 0.3, z * Z),
    );
  for (const x of [-1, 1])
    b.add(
      'paint',
      rbox(0.07, 0.024, 2 * Z - 0.07, 0.01, 2),
      '#dba468',
      m4(x * X, 0.3, 0),
    );
  // Soil.
  b.add(
    'paint',
    rock(4, 0.18, 7),
    (c) => (c.y > 0.3 ? '#6b4a2e' : '#553621'),
    m4(0, 0.255, 0, 0, 0, 0, [X - 0.03, 0.05, Z - 0.03]),
  );
  const soil = 0.285;
  // Lettuces.
  for (const [x, z, s, seed] of [
    [0.02, 0.06, 0.07, 3],
    [0.13, -0.08, 0.06, 4],
    [-0.04, -0.1, 0.055, 6],
  ]) {
    b.add(
      'paint',
      rock(4, 0.3, seed),
      (c) => (c.y > 0.25 ? '#a6dc6a' : c.y > -0.2 ? '#7fc24f' : '#5a9c38'),
      m4(x, soil + s * 0.6, z, rand(), rand(), rand(), [s, s * 0.85, s]),
    );
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + rand();
      b.add(
        'paint',
        extrude(leafShape(s * 1.4, s * 0.9), 0.004, 0.002, 1, 8),
        '#6fb544',
        m4(
          x + Math.cos(a) * s * 0.4,
          soil + 0.004,
          z + Math.sin(a) * s * 0.4,
          0,
          -a + Math.PI / 2,
          0,
        ).multiply(m4(0, 0, 0, -1.0, 0, 0)),
      );
    }
  }
  // Carrots: orange shoulders and feathery tops.
  for (const [x, z] of [
    [-0.33, 0.11],
    [-0.24, 0.12],
    [-0.15, 0.1],
  ]) {
    b.add(
      'paint',
      cyl(0.018, 0.012, 0.03, 12),
      '#f08a2a',
      m4(x, soil + 0.005, z),
    );
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + rand();
      b.add(
        'paint',
        cyl(0.002, 0.006, 0.12, 5),
        '#5fae3c',
        aim(
          v3(x + Math.cos(a) * 0.02, soil + 0.07, z + Math.sin(a) * 0.02),
          v3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35),
        ),
      );
      b.add(
        'paint',
        extrude(leafShape(0.05, 0.02), 0.003, 0.001, 1, 6),
        '#6cbc46',
        aim(
          v3(x + Math.cos(a) * 0.04, soil + 0.11, z + Math.sin(a) * 0.04),
          v3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5),
        ),
      );
    }
  }
  // The gnome in front.
  const gn = m4(-0.37, 0, 0.32, 0, -0.35, 0);
  const G = (m: THREE.Matrix4) => gn.clone().multiply(m);
  for (const x of [-0.025, 0.025])
    b.add(
      'paint',
      rbox(0.04, 0.03, 0.06, 0.012, 2),
      '#4a3426',
      G(m4(x, 0.015, 0.01)),
    );
  b.add(
    'paint',
    lathe(
      [
        [0, 0.02],
        [0.07, 0.02, 0.012],
        [0.062, 0.1],
        [0.045, 0.15, 0.01],
        [0, 0.16],
      ],
      24,
      3,
    ),
    '#3b6fc4',
    G(m4()),
  );
  b.add(
    'paint',
    new THREE.TorusGeometry(0.065, 0.008, 6, 24).rotateX(Math.PI / 2),
    '#3a2a20',
    G(m4(0, 0.07, 0, 0, 0, 0, [1, 1, 1])),
  );
  b.add(
    'metal',
    rbox(0.026, 0.02, 0.006, 0.003),
    '#e8c25a',
    G(m4(0, 0.07, 0.07)),
  );
  for (const s of [-1, 1]) {
    b.add(
      'paint',
      rod(0.018, v3(s * 0.048, 0.135, 0), v3(s * 0.07, 0.095, 0.04), 10, 0.016),
      '#3b6fc4',
      G(m4()),
    );
    b.add(
      'paint',
      sphere(0.018, 10, 8),
      '#f2c29a',
      G(m4(s * 0.068, 0.088, 0.05)),
    );
  }
  b.add(
    'paint',
    lathe(
      [
        [0, 0.07],
        [0.03, 0.1, 0.02],
        [0.052, 0.16, 0.014],
        [0.04, 0.19],
        [0, 0.19],
      ],
      20,
      3,
    ),
    '#f7f4ee',
    G(m4(0, 0, 0.03, 0.25, 0, 0)),
  );
  b.add('paint', sphere(0.042, 18, 14), '#f2c29a', G(m4(0, 0.2, 0.012)));
  b.add('paint', sphere(0.016, 10, 8), '#ec8f86', G(m4(0, 0.195, 0.056)));
  for (const x of [-0.016, 0.016])
    b.add('paint', sphere(0.0055, 6, 4), '#1d1f24', G(m4(x, 0.212, 0.046)));
  b.add(
    'paint',
    lathe(
      [
        [0, 0.215],
        [0.052, 0.215, 0.008],
        [0.048, 0.235],
        [0.02, 0.3, 0.02],
        [0, 0.34],
      ],
      20,
      3,
    ),
    '#d8392b',
    G(m4(0, 0, -0.01, -0.12, 0, 0.1)),
  );
  // The watering can.
  const can = m4(0.32, 0, 0.33, 0, 0.25, 0);
  const W = (m: THREE.Matrix4) => can.clone().multiply(m);
  const teal = '#2f9aa3';
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.07, 0, 0.01],
        [0.072, 0.12, 0.012],
        [0.052, 0.14, 0.012],
        [0, 0.142],
      ],
      28,
      3,
    ),
    teal,
    W(m4()),
  );
  for (const y of [0.01, 0.11])
    b.add(
      'paint',
      new THREE.TorusGeometry(0.0715, 0.005, 5, 28).rotateX(Math.PI / 2),
      '#257f88',
      W(m4(0, y, 0)),
    );
  b.add(
    'metal',
    cyl(0.026, 0.028, 0.012, 18),
    '#c9d0d8',
    W(m4(0, 0.146, -0.01)),
  );
  b.add(
    'paint',
    rod(0.009, v3(0.055, 0.035, 0), v3(0.2, 0.16, 0), 12, 0.017),
    teal,
    W(m4()),
  );
  b.add(
    'metal',
    lathe(
      [
        [0, 0],
        [0.012, 0],
        [0.026, 0.028, 0.004],
        [0, 0.031],
      ],
      16,
      2,
    ),
    (c) => (c.y > 0.027 ? '#9aa3ad' : '#c9d0d8'),
    aim(v3(0.2, 0.16, 0), v3(0.75, 0.65, 0)).premultiply(W(m4())),
  );
  b.add(
    'paint',
    tube(
      [
        v3(-0.07, 0.04, 0),
        v3(-0.115, 0.1, 0),
        v3(-0.08, 0.17, 0),
        v3(-0.02, 0.15, 0),
      ],
      0.009,
      18,
      6,
    ),
    '#257f88',
    W(m4()),
  );
  b.add(
    'paint',
    tube(
      [v3(-0.045, 0.14, 0), v3(0.0, 0.2, 0), v3(0.045, 0.14, 0)],
      0.008,
      14,
      6,
    ),
    '#257f88',
    W(m4()),
  );
  b.into(group);
  // The sunflower sways from its foot.
  const sun = new THREE.Group();
  sun.position.set(-0.2, soil, -0.08);
  const sb = new Bins({ paint: mats.paint });
  const stem = [
    v3(0, 0, 0),
    v3(0.01, 0.2, 0.0),
    v3(0.0, 0.42, 0.02),
    v3(0.02, 0.55, 0.05),
  ];
  sb.add('paint', tube(stem, 0.012, 20, 8), '#4f8f35');
  for (const [y, a, s] of [
    [0.16, 0.4, 1],
    [0.3, Math.PI + 0.6, 0.9],
  ])
    sb.add(
      'paint',
      extrude(leafShape(0.15 * s, 0.07 * s), 0.004, 0.002, 1, 10),
      '#5ea33a',
      m4(0, y, 0, 0, a, 0).multiply(m4(0, 0, 0, 0, 0, -1.0)),
    );
  const face = aim(v3(0.02, 0.56, 0.07), v3(0.05, 0.45, 1));
  const F = (m: THREE.Matrix4) => face.clone().multiply(m);
  sb.add(
    'paint',
    lathe(
      [
        [0, -0.016],
        [0.06, -0.016, 0.012],
        [0.068, 0.0, 0.008],
        [0.058, 0.014, 0.012],
        [0, 0.022],
      ],
      32,
      3,
    ),
    (c, nn) =>
      nn.y < 0
        ? '#4f8f35'
        : Math.hypot(c.x, c.z) < 0.032
          ? '#5a3418'
          : '#7a4a22',
    F(m4()),
  );
  const petal = extrude(leafShape(0.075, 0.03), 0.004, 0.0015, 1, 8);
  for (let k = 0; k < 28; k++) {
    const a = (k / 14) * Math.PI + (k >= 14 ? Math.PI / 14 : 0);
    sb.add(
      'paint',
      petal,
      k >= 14 ? '#f0a92a' : '#f6c12a',
      F(
        m4(0, k >= 14 ? -0.004 : 0.002, 0, 0, -a, 0).multiply(
          m4(0, 0, 0.055, Math.PI / 2 - (k >= 14 ? 0.3 : 0.15), 0, 0),
        ),
      ),
    );
  }
  sb.into(sun);
  group.add(sun);
  // Tulips sway together.
  const tul = new THREE.Group();
  tul.position.set(0.25, soil, 0.06);
  const tb = new Bins({ paint: mats.paint });
  for (const [x, z, h, colour] of [
    [-0.07, 0.02, 0.17, '#e2453a'],
    [0.03, -0.07, 0.22, '#f07aa0'],
    [0.1, 0.05, 0.15, '#a070d0'],
  ] as const) {
    tb.add(
      'paint',
      tube([v3(x, 0, z), v3(x + 0.008, h * 0.5, z), v3(x, h, z)], 0.006, 10, 5),
      '#4f8f35',
    );
    tb.add(
      'paint',
      lathe(
        [
          [0, 0],
          [0.02, 0.006, 0.01],
          [0.031, 0.03, 0.014],
          [0.027, 0.058, 0.008],
          [0.018, 0.066],
          [0.008, 0.058],
          [0, 0.056],
        ],
        18,
        3,
      ),
      colour,
      m4(x, h - 0.004, z),
    );
    for (const a of [0.3, 3.6])
      tb.add(
        'paint',
        extrude(leafShape(0.1, 0.03), 0.004, 0.0015, 1, 8),
        '#5ea33a',
        m4(x, 0, z, 0, a, 0).multiply(m4(0, 0, 0, 0, 0, -0.35)),
      );
  }
  tb.into(tul);
  group.add(tul);
  return {
    group,
    update: (t) => {
      sun.rotation.z = Math.sin(t * 0.9) * 0.035;
      sun.rotation.x = Math.sin(t * 0.7 + 1) * 0.025;
      tul.rotation.z = Math.sin(t * 1.3 + 2) * 0.05;
      tul.rotation.x = Math.sin(t * 1.1) * 0.03;
    },
  };
};

// ——— Statue (trophy) ———

/** A golden statue of a little astronaut waving, holding a flag, on a marble
 * plinth with a plaque; a glint now and then. */
const statue = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const gold = vmat({ roughness: 0.26, metalness: 0.9 });
  // Flat gold (the plaque, the flag) gets less mirror so it stays bright.
  const satin = vmat({ roughness: 0.38, metalness: 0.55 });
  const b = new Bins({ ...mats, gold, satin });
  const slate = '#56636d';
  const marble = '#f1ece3';
  const g0 = '#f2c14e';
  const g1 = '#d9a032';
  const g2 = '#ffd977';
  // The plinth.
  b.add('paint', rbox(0.58, 0.06, 0.58, 0.02, 2), slate, m4(0, 0.03, 0));
  b.add('paint', rbox(0.52, 0.04, 0.52, 0.015, 2), marble, m4(0, 0.08, 0));
  b.add('paint', rbox(0.44, 0.3, 0.44, 0.02, 2), marble, m4(0, 0.25, 0));
  b.add('paint', rbox(0.5, 0.036, 0.5, 0.014, 2), marble, m4(0, 0.418, 0));
  b.add('paint', rbox(0.46, 0.03, 0.46, 0.012, 2), slate, m4(0, 0.451, 0));
  for (const y of [0.115, 0.385])
    b.add('gold', rbox(0.452, 0.012, 0.452, 0.005, 1), g1, m4(0, y, 0));
  // The plaque: a star and two lines of raised letters.
  const P = m4(0, 0.25, 0.222);
  b.add('gold', extrude(roundRect(0.28, 0.13, 0.02), 0.01, 0.003), g1, P);
  b.add(
    'satin',
    extrude(roundRect(0.26, 0.11, 0.014), 0.004, 0.001),
    '#c48d2c',
    at(P.clone(), m4(0, 0, 0.006)),
  );
  b.add(
    'satin',
    extrude(star(0.03, 0.013), 0.006, 0.0015, 1),
    g2,
    at(P.clone(), m4(-0.085, 0, 0.01)),
  );
  for (const [y, w] of [
    [0.022, 0.13],
    [-0.008, 0.11],
    [-0.034, 0.08],
  ] as const)
    b.add(
      'satin',
      rbox(w, 0.012, 0.006, 0.002, 1),
      g2,
      at(P.clone(), m4(0.035 - (0.13 - w) / 2, y, 0.009)),
    );
  for (const [x, y] of [
    [-0.125, 0.052],
    [0.125, 0.052],
    [-0.125, -0.052],
    [0.125, -0.052],
  ])
    b.add(
      'gold',
      dome(0.006, 6, 2),
      g2,
      at(P.clone(), m4(x, y, 0.006, Math.PI / 2, 0, 0)),
    );
  // The astronaut.
  const A = m4(0, 0.466, 0.0, 0, 0.1, 0, 1.2);
  const S = (m: THREE.Matrix4) => A.clone().multiply(m);
  const disc = lathe(
    [
      [0, 0],
      [0.16, 0, 0.01],
      [0.16, 0.02, 0.008],
      [0, 0.02],
    ],
    36,
    2,
  );
  b.add('gold', disc, g1, S(m4()));
  for (const x of [-0.045, 0.045]) {
    b.add(
      'gold',
      rbox(0.068, 0.05, 0.092, 0.022, 2),
      g1,
      S(m4(x, 0.045, 0.012)),
    );
    b.add(
      'gold',
      lathe(
        [
          [0, 0.06],
          [0.034, 0.06, 0.01],
          [0.036, 0.13, 0.01],
          [0, 0.15],
        ],
        18,
        3,
      ),
      g0,
      S(m4(x, 0, 0)),
    );
    b.add(
      'gold',
      new THREE.TorusGeometry(0.035, 0.007, 6, 18).rotateX(Math.PI / 2),
      g1,
      S(m4(x, 0.1, 0)),
    );
  }
  b.add(
    'gold',
    lathe(
      [
        [0, 0.13],
        [0.085, 0.13, 0.03],
        [0.098, 0.21, 0.04],
        [0.086, 0.3, 0.03],
        [0.05, 0.32],
        [0, 0.32],
      ],
      28,
      4,
    ),
    g0,
    S(m4()),
  );
  b.add(
    'gold',
    new THREE.TorusGeometry(0.09, 0.012, 8, 28).rotateX(Math.PI / 2),
    g1,
    S(m4(0, 0.15, 0)),
  );
  b.add(
    'gold',
    rbox(0.085, 0.062, 0.02, 0.008, 2),
    g1,
    S(m4(0, 0.225, 0.09, -0.1, 0, 0)),
  );
  for (const [x, c] of [
    [-0.022, g2],
    [0.0, g2],
    [0.022, g2],
  ] as const)
    b.add('gold', sphere(0.008, 8, 6), c, S(m4(x, 0.232, 0.101)));
  b.add('gold', rbox(0.15, 0.17, 0.07, 0.026, 2), g1, S(m4(0, 0.225, -0.1)));
  b.add(
    'gold',
    new THREE.TorusGeometry(0.068, 0.014, 8, 26).rotateX(Math.PI / 2),
    g1,
    S(m4(0, 0.315, 0)),
  );
  b.add('gold', sphere(0.108, 32, 24), g0, S(m4(0, 0.405, 0)));
  b.add(
    'gold',
    new THREE.SphereGeometry(
      0.111,
      28,
      16,
      Math.PI / 2 - 0.85,
      1.7,
      Math.PI / 2 - 0.5,
      0.95,
    ),
    '#a9741f',
    S(m4(0, 0.405, 0)),
  );
  b.add(
    'gold',
    rod(0.0045, v3(0.05, 0.49, -0.02), v3(0.075, 0.56, -0.03), 6),
    g1,
    S(m4()),
  );
  b.add('gold', sphere(0.014, 10, 8), g2, S(m4(0.075, 0.565, -0.03)));
  // The right arm waves.
  const joint = (p: THREE.Vector3, r: number) =>
    b.add('gold', sphere(r, 12, 10), g0, S(m4(p.x, p.y, p.z)));
  const sh = v3(0.09, 0.27, 0);
  const el = v3(0.17, 0.33, 0.02);
  const wr = v3(0.19, 0.43, 0.03);
  b.add('gold', rod(0.03, sh, el, 14), g0, S(m4()));
  b.add('gold', rod(0.027, el, wr, 14), g0, S(m4()));
  joint(sh, 0.034);
  joint(el, 0.03);
  b.add(
    'gold',
    new THREE.TorusGeometry(0.029, 0.007, 6, 16),
    g1,
    S(aim(wr, wr.clone().sub(el)).multiply(m4(0, 0, 0, Math.PI / 2, 0, 0))),
  );
  b.add(
    'gold',
    sphere(0.04, 16, 12),
    g0,
    S(m4(wr.x + 0.004, wr.y + 0.036, wr.z, 0, 0, -0.2, [1.1, 1.2, 0.62])),
  );
  b.add(
    'gold',
    sphere(0.016, 10, 8),
    g0,
    S(m4(wr.x - 0.034, wr.y + 0.022, wr.z + 0.006)),
  );
  // The left arm holds a flag planted in the base.
  const ls = v3(-0.09, 0.27, 0);
  const le = v3(-0.14, 0.2, 0.04);
  const lw = v3(-0.135, 0.15, 0.08);
  b.add('gold', rod(0.03, ls, le, 14), g0, S(m4()));
  b.add('gold', rod(0.027, le, lw, 14), g0, S(m4()));
  joint(ls, 0.034);
  joint(le, 0.03);
  b.add('gold', sphere(0.034, 12, 10), g0, S(m4(lw.x, lw.y - 0.01, lw.z)));
  const fx = -0.135;
  const fz = 0.08;
  b.add('gold', cyl(0.007, 0.007, 0.66, 10), g1, S(m4(fx, 0.33, fz)));
  b.add('gold', sphere(0.014, 10, 8), g2, S(m4(fx, 0.665, fz)));
  // The flag, rippled as if caught in a breeze.
  const ripple = (x: number) => {
    const u = (x + 0.08) / 0.16;
    return Math.sin(u * 6.2) * 0.02 * Math.min(1, u * 2.5);
  };
  const cloth = new THREE.BoxGeometry(0.16, 0.11, 0.008, 24, 2, 1);
  const cp = cloth.getAttribute('position');
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const u = (x + 0.08) / 0.16;
    cp.setZ(i, cp.getZ(i) + ripple(x));
    cp.setY(i, cp.getY(i) - u * u * 0.014);
  }
  cloth.computeVertexNormals();
  const flagAt = S(m4(fx - 0.083, 0.6, fz, 0, 0.5, 0));
  b.add('satin', cloth, g0, flagAt);
  b.add(
    'satin',
    extrude(star(0.024, 0.011), 0.004, 0.001, 1),
    g2,
    at(flagAt.clone(), m4(0.0, 0.0, ripple(0) + 0.006)),
  );
  b.into(group);
  // Two glints that flash in turn.
  const glintMat = new THREE.MeshBasicMaterial({ color: '#fff6cf' });
  const glintGeo = extrude(star(0.045, 0.008, 4), 0.002, 0, 1);
  const glints = [
    [v3(-0.1, 1.0, 0.14), Math.PI / 2],
    [v3(0.21, 0.66, 0.12), 2.6],
  ].map(([p, phase]) => {
    const m = new THREE.Mesh(
      phase === Math.PI / 2 ? glintGeo : glintGeo.clone(),
      glintMat,
    );
    m.position.copy(p as THREE.Vector3);
    group.add(m);
    return { m, phase: phase as number };
  });
  return {
    group,
    update: (t) => {
      for (const { m, phase } of glints) {
        const s = Math.max(0, Math.sin(t * 1.4 + phase)) ** 8;
        m.scale.setScalar(0.05 + 0.95 * s);
        m.rotation.z = t * 0.8 + phase;
        m.visible = s > 0.02;
      }
    },
  };
};

// ——— Workbench (extra) ———

/** A wooden workbench with a vice holding a plank, a pegboard of tools, an
 * angled desk lamp, a mug and a paint tin. */
const workbench = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const bulb = glow('#fff6d8', '#ffd27a', 1.8);
  const b = new Bins({ ...mats, bulb });
  const top = 0.46;
  const X = 0.45;
  const Z = 0.2;
  const strips = ['#dba667', '#c8904f', '#e2b273'];
  for (let k = 0; k < 6; k++)
    b.add(
      'paint',
      rbox(2 * X, 0.056, 0.066, 0.01, 2),
      strips[k % 3],
      m4(0, top - 0.028, -Z + 0.033 + k * 0.0668),
    );
  const leg = '#a8723e';
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      b.add(
        'paint',
        rbox(0.062, top - 0.056, 0.062, 0.012, 2),
        leg,
        m4(x * (X - 0.06), (top - 0.056) / 2, z * (Z - 0.045)),
      );
  for (const z of [-1, 1])
    b.add(
      'paint',
      rbox(2 * X - 0.16, 0.06, 0.028, 0.008, 2),
      leg,
      m4(0, top - 0.09, z * (Z - 0.045)),
    );
  for (const x of [-1, 1])
    b.add(
      'paint',
      rbox(0.028, 0.05, 2 * Z - 0.12, 0.008, 2),
      leg,
      m4(x * (X - 0.06), 0.1, 0),
    );
  for (const z of [-0.105, 0, 0.105])
    b.add(
      'paint',
      rbox(2 * X - 0.17, 0.022, 0.098, 0.006, 2),
      '#c48c50',
      m4(0, 0.13, z),
    );
  // On the shelf: a paint tin and planks.
  b.add(
    'metal',
    lathe(
      [
        [0, 0.141],
        [0.06, 0.141, 0.006],
        [0.06, 0.24, 0.006],
        [0.054, 0.246],
        [0, 0.246],
      ],
      24,
      2,
    ),
    (c) =>
      c.y > 0.165 && c.y < 0.225 && Math.hypot(c.x, c.z) > 0.055
        ? '#3b8fd5'
        : '#c9d0d8',
    m4(-0.22, 0, 0.02),
  );
  b.add(
    'paint',
    cyl(0.061, 0.061, 0.06, 24),
    '#3b8fd5',
    m4(-0.22, 0.195, 0.02),
  );
  b.add(
    'paint',
    cyl(0.055, 0.055, 0.004, 24),
    '#f2c230',
    m4(-0.22, 0.247, 0.02),
  );
  for (const [y, z, w] of [
    [0.153, 0.02, 0.34],
    [0.177, 0.03, 0.3],
  ])
    b.add(
      'paint',
      rbox(w, 0.022, 0.08, 0.006, 2),
      '#e6c08a',
      m4(0.16, y, z, 0, 0.08, 0),
    );
  // The pegboard.
  const pz = -Z + 0.012;
  const py0 = top + 0.01;
  const ph = 0.46;
  b.add(
    'paint',
    rbox(2 * X - 0.06, ph, 0.02, 0.006, 2),
    '#c39a68',
    m4(0, py0 + ph / 2, pz),
  );
  for (const x of [-1, 1])
    b.add(
      'paint',
      rbox(0.04, ph + 0.04, 0.032, 0.01, 2),
      leg,
      m4(x * (X - 0.04), py0 + ph / 2 + 0.01, pz),
    );
  b.add(
    'paint',
    rbox(2 * X, 0.04, 0.034, 0.01, 2),
    leg,
    m4(0, py0 + ph + 0.02, pz),
  );
  const hole = new THREE.CircleGeometry(0.0055, 6);
  for (let i = 0; i < 13; i++)
    for (let j = 0; j < 7; j++)
      b.add(
        'paint',
        hole,
        '#6b4f33',
        m4(-0.348 + i * 0.058, py0 + 0.05 + j * 0.06, pz + 0.0105),
      );
  const face = pz + 0.016;
  const hook = (x: number, y: number) =>
    b.add(
      'metal',
      rod(0.003, v3(x, y, pz), v3(x, y + 0.006, face + 0.02), 5),
      STEEL,
    );
  hook(-0.3, 0.86);
  hammerParts(b, m4(-0.32, 0.62, face + 0.012, 0, 0, 0.0), 0.22);
  hook(-0.14, 0.88);
  sawParts(b, m4(-0.14, 0.88, face + 0.01, 0, 0, Math.PI));
  [0.13, 0.16, 0.19].forEach((len, i) => {
    const x = 0.0 + i * 0.05;
    hook(x, 0.88);
    spannerParts(b, m4(x, 0.88, face + 0.008, 0, 0, Math.PI), len);
  });
  for (const [x, c] of [
    [0.18, RED],
    [0.22, '#3b8fd5'],
  ] as const) {
    hook(x, 0.875);
    screwdriverParts(b, m4(x, 0.88, face + 0.02, 0, 0, Math.PI), c, 0.17);
  }
  hook(0.3, 0.86);
  pliersParts(b, m4(0.3, 0.86, face + 0.012, 0, 0, Math.PI), '#f2c230');
  // The vice on the front corner, holding a plank.
  const vx = -0.27;
  const blue = '#3f6fb5';
  const blueDark = '#2f5994';
  b.add(
    'paint',
    lathe(
      [
        [0, top],
        [0.07, top, 0.006],
        [0.07, top + 0.016, 0.006],
        [0.05, top + 0.022],
        [0, top + 0.022],
      ],
      24,
      2,
    ),
    blueDark,
    m4(vx, 0, 0.09),
  );
  b.add(
    'paint',
    rbox(0.1, 0.06, 0.15, 0.016, 2),
    blue,
    m4(vx, top + 0.05, 0.1),
  );
  b.add(
    'paint',
    rbox(0.15, 0.07, 0.045, 0.012, 2),
    blue,
    m4(vx, top + 0.11, 0.05),
  );
  b.add(
    'paint',
    rbox(0.15, 0.07, 0.045, 0.012, 2),
    blue,
    m4(vx, top + 0.11, 0.185),
  );
  b.add(
    'paint',
    rbox(0.06, 0.04, 0.09, 0.01, 2),
    blueDark,
    m4(vx, top + 0.06, 0.22),
  );
  for (const z of [0.075, 0.161])
    b.add(
      'metal',
      rbox(0.14, 0.05, 0.007, 0.002, 1),
      BRIGHT,
      m4(vx, top + 0.12, z),
    );
  b.add(
    'metal',
    rod(0.011, v3(vx, top + 0.06, 0.2), v3(vx, top + 0.06, 0.31), 12),
    BRIGHT,
  );
  b.add(
    'metal',
    rod(
      0.006,
      v3(vx - 0.075, top + 0.06, 0.3),
      v3(vx + 0.075, top + 0.06, 0.3),
      8,
    ),
    BRIGHT,
  );
  for (const s of [-1, 1])
    b.add(
      'metal',
      sphere(0.012, 10, 8),
      BRIGHT,
      m4(vx + s * 0.078, top + 0.06, 0.3),
    );
  b.add(
    'metal',
    cyl(0.018, 0.018, 0.02, 14),
    STEEL,
    m4(vx, top + 0.06, 0.305, Math.PI / 2, 0, 0),
  );
  b.add(
    'paint',
    rbox(0.2, 0.05, 0.04, 0.006, 2),
    '#ecc890',
    m4(vx + 0.05, top + 0.16, 0.118),
  );
  for (const x of [-0.02, 0.06, 0.13])
    b.add(
      'paint',
      rbox(0.004, 0.051, 0.041, 0.0015),
      '#d9ad70',
      m4(vx + x, top + 0.16, 0.118),
    );
  // A mug.
  const mug = m4(0.03, top, 0.1);
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.034, 0, 0.006],
        [0.036, 0.075, 0.003],
        [0.031, 0.077],
        [0.03, 0.06],
        [0, 0.06],
      ],
      20,
      2,
    ),
    (c, nn) => (nn.y > 0.5 && c.y > 0.05 ? '#5a3418' : '#e8eef4'),
    mug,
  );
  b.add(
    'paint',
    new THREE.TorusGeometry(0.022, 0.006, 6, 14, Math.PI * 1.2),
    '#e8eef4',
    at(mug.clone(), m4(0.035, 0.04, 0, 0, 0, -Math.PI * 0.6)),
  );
  b.add(
    'paint',
    cyl(0.0365, 0.0365, 0.018, 20),
    RED,
    at(mug.clone(), m4(0, 0.04, 0)),
  );
  // The lamp on the back corner.
  const mustard = '#f2b630';
  const lb = v3(0.3, top, -0.06);
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.065, 0, 0.008],
        [0.065, 0.02, 0.008],
        [0.03, 0.034, 0.008],
        [0, 0.036],
      ],
      24,
      3,
    ),
    mustard,
    m4(lb.x, lb.y, lb.z),
  );
  const j0 = v3(lb.x, lb.y + 0.05, lb.z);
  const j1 = v3(0.24, 0.79, -0.02);
  const j2 = v3(0.06, 0.8, 0.06);
  b.add(
    'paint',
    rbox(0.03, 0.03, 0.03, 0.01),
    DARK,
    m4(j0.x, j0.y - 0.008, j0.z),
  );
  for (const dz of [-0.012, 0.012]) {
    b.add(
      'metal',
      rod(0.0055, j0.clone().setZ(j0.z + dz), j1.clone().setZ(j1.z + dz), 8),
      BRIGHT,
    );
    b.add(
      'metal',
      rod(0.0055, j1.clone().setZ(j1.z + dz), j2.clone().setZ(j2.z + dz), 8),
      BRIGHT,
    );
  }
  const spring = (a: THREE.Vector3, c: THREE.Vector3, off: THREE.Vector3) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const p = a
        .clone()
        .lerp(c, 0.2 + u * 0.55)
        .add(off);
      const d = c.clone().sub(a).normalize();
      const s = v3(0, 0, 1);
      const q = d.clone().cross(s).normalize();
      const ang = u * TAU * 9;
      p.addScaledVector(s, Math.cos(ang) * 0.007).addScaledVector(
        q,
        Math.sin(ang) * 0.007,
      );
      pts.push(p);
    }
    return tube(pts, 0.0018, 120, 3);
  };
  b.add('metal', spring(j0, j1, v3(0.018, 0.004, 0)), STEEL);
  b.add('metal', spring(j1, j2, v3(0, -0.018, 0)), STEEL);
  for (const p of [j1, j2])
    b.add(
      'paint',
      cyl(0.016, 0.016, 0.04, 14),
      DARK,
      m4(p.x, p.y, p.z, Math.PI / 2, 0, 0),
    );
  const shade = aim(j2.clone().add(v3(-0.02, -0.02, 0.01)), v3(-0.35, -1, 0.3));
  b.add(
    'paint',
    lathe(
      [
        [0, -0.01],
        [0.026, -0.01, 0.008],
        [0.03, 0.03],
        [0.078, 0.11, 0.006],
        [0.074, 0.114],
        [0.026, 0.036],
        [0.02, 0.0],
        [0, 0.0],
      ],
      28,
      3,
    ),
    (c, nn) => (nn.dot(v3(c.x, 0, c.z)) < 0 ? '#fff4dc' : mustard),
    shade,
  );
  b.add(
    'bulb',
    sphere(0.027, 14, 10),
    '#ffffff',
    at(shade.clone(), m4(0, 0.05, 0)),
  );
  b.add(
    'paint',
    tube(
      [
        v3(lb.x - 0.04, top + 0.008, lb.z),
        v3(lb.x - 0.1, top + 0.005, lb.z - 0.06),
        v3(lb.x - 0.12, top + 0.004, -Z + 0.03),
      ],
      0.005,
      14,
      5,
    ),
    DARK,
  );
  b.into(group);
  return still(group);
};

// ——— Lighthouse (trophy) ———

/** A red-and-white lighthouse on rocks with a keeper's cottage; its lens
 * turns in the lamp room and flashes as it faces you. */
const lighthouse = (): Upgrade => {
  const group = new THREE.Group();
  const mats = kitMats();
  const lensMat = glow('#ffb52a', '#ff9500', 1.3);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#fff0c0',
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.26,
    emissive: '#ffb848',
    emissiveIntensity: 0.4,
    depthWrite: false,
  });
  const b = new Bins({ ...mats, glass: glassMat });
  const rand = seeded(23);
  const red = '#d63a2c';
  const white = '#f6f2ea';
  // Rocks.
  const rocks: [number, number, number, number, number, number][] = [
    [0, 0.07, 0, 0.27, 0.11, 0.24],
    [-0.25, 0.05, 0.1, 0.13, 0.08, 0.12],
    [0.27, 0.06, -0.02, 0.15, 0.09, 0.14],
    [0.18, 0.04, 0.2, 0.1, 0.06, 0.09],
    [-0.16, 0.04, -0.19, 0.14, 0.07, 0.11],
    [-0.32, 0.03, -0.06, 0.08, 0.05, 0.08],
    [0.06, 0.03, 0.25, 0.09, 0.045, 0.07],
  ];
  rocks.forEach(([x, y, z, sx, sy, sz], i) =>
    b.add(
      'paint',
      rock(i < 3 ? 6 : 4, 0.2, 40 + i),
      (c, nn) =>
        nn.y > 0.75 && Math.sin(c.x * 9 + c.z * 7 + i) > 0.45
          ? '#6f9a45'
          : c.y > 0.3
            ? '#857e74'
            : c.y > -0.3
              ? '#6f685f'
              : '#57524c',
      m4(x, y, z, 0, rand() * 3, 0, [sx, sy, sz]),
    ),
  );
  // The stone base and the banded tower.
  b.add(
    'paint',
    lathe(
      [
        [0, 0.1],
        [0.205, 0.1, 0.01],
        [0.205, 0.17, 0.01],
        [0.185, 0.182],
        [0, 0.182],
      ],
      36,
      2,
    ),
    (c) => {
      const a = ((Math.atan2(c.z, c.x) + TAU) / TAU) * 18;
      return a % 1 < 0.12 ? '#9c968c' : '#bdb6aa';
    },
  );
  const y0 = 0.18;
  const y1 = 0.8;
  const nb = 5;
  const ys = Array.from(
    { length: nb + 1 },
    (_, i) => y0 + ((y1 - y0) * i) / nb,
  );
  const R0 = 0.165;
  const R1 = 0.112;
  const R = (y: number) => R0 + ((R1 - R0) * (y - y0)) / (y1 - y0);
  b.add('paint', lathe([[0, y0], ...bands(R0, R1, ys), [0, y1]], 40, 2), (c) =>
    Math.floor(((c.y - y0) / (y1 - y0)) * nb) % 2 ? white : red,
  );
  const lean = Math.atan((R0 - R1) / (y1 - y0));
  // The door, a step and two windows.
  const arch = (w: number, h: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h - w / 2);
    s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
    s.closePath();
    return s;
  };
  const onTower = (y: number, a: number, out = 0) => {
    const r = R(y) + out;
    return m4(Math.sin(a) * r, y, Math.cos(a) * r, 0, a, 0).multiply(
      m4(0, 0, 0, -lean, 0, 0),
    );
  };
  const da = -0.15;
  b.add(
    'paint',
    extrude(arch(0.078, 0.112), 0.012, 0.003),
    white,
    onTower(y0 + 0.002, da, -0.002),
  );
  b.add(
    'paint',
    extrude(arch(0.06, 0.1), 0.012, 0.002),
    '#2f5a6b',
    onTower(y0 + 0.004, da, 0.004),
  );
  b.add(
    'metal',
    sphere(0.006, 8, 6),
    '#e8c25a',
    onTower(y0 + 0.05, da, 0.012).multiply(m4(0.018, 0, 0)),
  );
  b.add(
    'paint',
    rbox(0.1, 0.02, 0.05, 0.006),
    '#9c968c',
    m4(Math.sin(da) * 0.2, 0.17, Math.cos(da) * 0.2, 0, da, 0),
  );
  for (const [y, a] of [
    [0.45, -0.55],
    [0.7, 0.35],
  ]) {
    b.add(
      'paint',
      extrude(arch(0.05, 0.07), 0.01, 0.003),
      white,
      onTower(y, a, -0.002),
    );
    b.add(
      'paint',
      extrude(arch(0.034, 0.056), 0.01, 0.002),
      '#26304a',
      onTower(y + 0.007, a, 0.003),
    );
  }
  // Corbels and the gallery with its railing.
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    b.add(
      'paint',
      rbox(0.022, 0.05, 0.05, 0.006, 1),
      white,
      m4(Math.sin(a) * 0.125, 0.79, Math.cos(a) * 0.125, 0, a, 0),
    );
  }
  b.add(
    'paint',
    lathe(
      [
        [0, 0.8],
        [0.12, 0.8],
        [0.178, 0.812, 0.006],
        [0.18, 0.832, 0.004],
        [0, 0.832],
      ],
      40,
      2,
    ),
    CHARCOAL,
  );
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU;
    b.add(
      'metal',
      cyl(0.0045, 0.0045, 0.07, 6),
      CHARCOAL,
      m4(Math.sin(a) * 0.168, 0.867, Math.cos(a) * 0.168),
    );
  }
  for (const y of [0.902, 0.868])
    b.add(
      'metal',
      new THREE.TorusGeometry(0.168, y > 0.9 ? 0.006 : 0.004, 6, 48).rotateX(
        Math.PI / 2,
      ),
      CHARCOAL,
      m4(0, y, 0),
    );
  // The lamp room: a low wall, glass between bars, the roof.
  b.add(
    'paint',
    lathe(
      [
        [0, 0.83],
        [0.1, 0.83],
        [0.1, 0.872, 0.004],
        [0.094, 0.876],
        [0, 0.876],
      ],
      32,
      2,
    ),
    red,
  );
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + TAU / 16;
    b.add(
      'metal',
      rbox(0.01, 0.13, 0.01, 0.003, 1),
      CHARCOAL,
      m4(Math.sin(a) * 0.093, 0.94, Math.cos(a) * 0.093),
    );
  }
  b.add(
    'glass',
    new THREE.CylinderGeometry(0.092, 0.092, 0.124, 32, 1, true),
    '#ffffff',
    m4(0, 0.938, 0),
  );
  b.add(
    'metal',
    lathe(
      [
        [0.085, 0.996],
        [0.1, 0.996, 0.003],
        [0.1, 1.006, 0.003],
        [0.085, 1.006],
      ],
      32,
      2,
    ),
    CHARCOAL,
  );
  b.add(
    'paint',
    lathe(
      [
        [0, 1.0],
        [0.116, 1.0],
        [0.12, 1.012, 0.004],
        [0.085, 1.05, 0.02],
        [0.03, 1.092, 0.012],
        [0, 1.098],
      ],
      36,
      3,
    ),
    red,
  );
  b.add('metal', sphere(0.022, 14, 10), CHARCOAL, m4(0, 1.11, 0));
  b.add('metal', rod(0.004, v3(0, 1.12, 0), v3(0, 1.19, 0), 6), CHARCOAL);
  b.add('metal', sphere(0.008, 8, 6), '#e8c25a', m4(0, 1.19, 0));
  b.add('paint', cyl(0.03, 0.04, 0.04, 14), CHARCOAL, m4(0, 0.895, 0));
  // The keeper's cottage on the right-hand rock.
  const ck = m4(0.27, 0.11, -0.03, 0, -0.35, 0);
  const K = (m: THREE.Matrix4) => ck.clone().multiply(m);
  b.add('paint', rbox(0.2, 0.13, 0.15, 0.012, 2), white, K(m4(0, 0.065, 0)));
  const gable = new THREE.Shape([v2(-0.095, 0), v2(0.095, 0), v2(0, 0.08)]);
  b.add('paint', extrude(gable, 0.15, 0.004), white, K(m4(0, 0.128, 0)));
  for (const s of [-1, 1])
    b.add(
      'paint',
      rbox(0.15, 0.018, 0.2, 0.006, 1),
      red,
      K(m4(s * 0.052, 0.181, 0, 0, 0, -s * 0.7)),
    );
  b.add(
    'paint',
    rbox(0.03, 0.06, 0.03, 0.005),
    '#bdb6aa',
    K(m4(0.05, 0.2, -0.03)),
  );
  b.add(
    'paint',
    rbox(0.04, 0.07, 0.008, 0.004),
    '#2f5a6b',
    K(m4(-0.04, 0.035, 0.077)),
  );
  b.add(
    'paint',
    rbox(0.045, 0.04, 0.008, 0.004),
    '#26304a',
    K(m4(0.045, 0.07, 0.077)),
  );
  b.add(
    'paint',
    rbox(0.053, 0.048, 0.006, 0.003),
    white,
    K(m4(0.045, 0.07, 0.074)),
  );
  // A life ring on the cottage wall.
  b.add(
    'paint',
    new THREE.TorusGeometry(0.022, 0.008, 8, 24),
    (c) =>
      Math.floor(((Math.atan2(c.y, c.x) + TAU) / TAU) * 8) % 2 ? red : white,
    K(m4(-0.101, 0.075, 0.02, 0, -Math.PI / 2, 0)),
  );
  b.into(group);
  // The lens turns: an eight-sided barrel of prisms with two bullseyes.
  const lens = new THREE.Group();
  lens.position.y = 0.94;
  const lb = new Bins({ glow: lensMat });
  const prof: Pt[] = [[0, -0.05]];
  for (let k = 0; k <= 8; k++)
    prof.push([
      0.05 + (k % 2) * 0.006 - Math.abs(k - 4) * 0.002,
      -0.048 + k * 0.012,
    ]);
  prof.push([0, 0.05]);
  lb.add('glow', lathe(prof, 8, 0).rotateY(Math.PI / 8), '#ffe39a');
  for (const a of [0, Math.PI])
    for (const [r, h] of [
      [0.03, 0.002],
      [0.018, 0.005],
    ])
      lb.add(
        'glow',
        new THREE.CircleGeometry(r, 18),
        '#ffffff',
        m4(Math.sin(a) * (0.05 + h), 0, Math.cos(a) * (0.05 + h), 0, a, 0),
      );
  lb.into(lens);
  group.add(lens);
  return {
    group,
    update: (t) => {
      const a = t * 1.1;
      lens.rotation.y = a;
      const f = Math.abs(Math.cos(a + 0.5)) ** 10;
      lensMat.emissiveIntensity = 1.3 + 1.6 * f;
      glassMat.emissiveIntensity = 0.5 + 0.9 * f;
    },
  };
};

export const trophyModels: Record<string, () => Upgrade> = {
  beacon,
  post: toolbox,
  belltower: dish,
  gardens: garden,
  bridge: statue,
  market: workbench,
  lighthouse,
};
