import * as THREE from 'three';
import { lump, m4, merge, seeded } from './alto-3d';
import {
  TAU,
  v2,
  v3,
  C,
  sstep,
  angDist,
  vmat,
  kitMats,
  still,
  Bins,
  lathe,
  latheZ,
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
  link,
  grid,
  onBody,
  wrap,
  hullRadius,
  hullR,
  STRIPE,
  NOSE,
  GROOVES,
  SEAMS,
  SEAM_SPANS,
  hullLift,
  hullRows,
  hullCols,
  CANOPY,
  onCanopy,
  inCanopy,
  outsideHull,
  type Upgrade,
  type Maker,
  type Paint,
  type Pt,
  type Radius,
} from './alto-kit';
export type { Upgrade } from './alto-kit';
import { gearMakers } from './alto-gear';
import { baseModuleMakers } from './alto-modules';

/**
 * Alto's ships and the upgrades that bolt onto them, built from code.
 *
 * Every player flies the same friendly little rocket in their seat colour: a
 * cream hull with panel seams, rivets and a raised painted stripe, a glass
 * canopy with a pilot inside, portholes, a side hatch, three swept fins, an
 * engine bell that glows when it flies and three legs with pistons that fold
 * out when it lands. Each ship part a player owns (tools and gear) is mounted
 * at its own spot on the hull, clear of every other part and of the canopy,
 * legs, fins, portholes, antenna and flame in any combination (checked by
 * scripts/alto-fit.mjs), so a ship shows at a glance what it can do. Trophies
 * and extras build the home base instead (alto-base.ts). The shop stands
 * every object on its own (see `buildShopModel`).
 *
 * Every piece is modelled from lathes, bevelled extrusions, rounded boxes and
 * tubes, then merged per material with vertex colours (`Bins`), so a fully
 * kitted ship stays at a few dozen draws. Each upgrade owns its materials, so
 * the ship can fade one in as a ghost.
 *
 * Units: the hull is 2 long (z from −1 to 1, nose along +Z) and about 1 wide.
 */

// ——— The upgrades of the first trip ———

const ORANGE = C('#f0a040');
const ORANGE_SEAM = C('#c47a2c');

/** One cargo pod along +Z; `s` is the side it hangs on (its label faces out). */
function cargoPodParts(b: Bins, s: number, at: THREE.Matrix4, ship: boolean) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  const dark = '#3b3f48';
  const steel = '#c9d0d8';
  const prof: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
    prof.push([0.19 * Math.cos(a), -0.28 + 0.185 * Math.sin(a)]);
  }
  prof.push(
    [0.19, -0.245],
    [0.184, -0.238],
    [0.184, -0.232],
    [0.19, -0.225],
    [0.19, 0.225],
    [0.184, 0.232],
    [0.184, 0.238],
    [0.19, 0.245],
  );
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    prof.push([0.19 * Math.cos(a), 0.28 + 0.17 * Math.sin(a)]);
  }
  b.add(
    'paint',
    latheZ(prof, 28, 1),
    (c) =>
      Math.abs(Math.abs(c.z) - 0.235) < 0.005 && Math.hypot(c.x, c.y) < 0.189
        ? ORANGE_SEAM
        : ORANGE,
    at,
  );
  // Two straps with buckles.
  for (const z of [-0.15, 0.15]) {
    b.add(
      'paint',
      latheZ(
        [
          [0.186, -0.032],
          [0.201, -0.03, 0.008],
          [0.201, 0.03, 0.008],
          [0.186, 0.032],
        ],
        28,
        2,
      ),
      dark,
      A(m4(0, 0, z)),
    );
    b.add(
      'metal',
      rbox(0.024, 0.078, 0.066, 0.008),
      steel,
      A(m4(s * 0.205, 0, z)),
    );
    b.add(
      'paint',
      rbox(0.014, 0.05, 0.014, 0.004),
      dark,
      A(m4(s * 0.219, 0, z)),
    );
  }
  // A shipping label on the outer side.
  const side: Radius = () => 0.19;
  const a0 = (s * Math.PI) / 2;
  b.add(
    'paint',
    wrap(
      extrude(roundRect(0.13, 0.2, 0.02), 0.004, 0.0015, 1),
      side,
      a0,
      0,
      0.004,
    ),
    '#f6eedd',
    at,
  );
  for (const [u, len] of [
    [0.032, 0.11],
    [0.008, 0.08],
    [-0.016, 0.1],
  ])
    b.add(
      'paint',
      wrap(
        extrude(roundRect(0.011, len, 0.005, u, -0.06 + len / 2), 0.002),
        side,
        a0,
        0,
        0.0072,
      ),
      dark,
      at,
    );
  b.add(
    'paint',
    wrap(
      extrude(roundRect(0.04, 0.04, 0.008, 0, 0.06), 0.002),
      side,
      a0,
      0,
      0.0072,
    ),
    '#d8453a',
    at,
  );
  // The front lid: bolted, hinged on top, with a pull handle.
  b.add(
    'metal',
    latheZ(
      [
        [0, 0.4],
        [0.1, 0.4],
        [0.104, 0.43, 0.008],
        [0.096, 0.447, 0.006],
        [0, 0.451],
      ],
      32,
      3,
    ),
    steel,
    at,
  );
  const bolt = dome(0.0075, 6, 2);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    b.add(
      'metal',
      bolt,
      '#8a919b',
      A(m4(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.447, Math.PI / 2, 0, 0)),
    );
  }
  b.add(
    'paint',
    tube(
      [
        v3(-0.045, -0.02, 0.448),
        v3(-0.035, -0.02, 0.47),
        v3(0.035, -0.02, 0.47),
        v3(0.045, -0.02, 0.448),
      ],
      0.008,
      12,
      6,
    ),
    dark,
    at,
  );
  b.add(
    'metal',
    cyl(0.013, 0.013, 0.075, 12),
    '#8a919b',
    A(m4(0, 0.104, 0.43, 0, 0, Math.PI / 2)),
  );
  for (const x of [-0.022, 0.022])
    b.add(
      'metal',
      rbox(0.022, 0.01, 0.05, 0.004),
      '#8a919b',
      A(m4(x, 0.11, 0.405, -0.5, 0, 0)),
    );
  // A valve at the back and a carry handle on top.
  b.add(
    'metal',
    latheZ(
      [
        [0, -0.478],
        [0.035, -0.474, 0.008],
        [0.04, -0.455],
        [0, -0.45],
      ],
      20,
      3,
    ),
    steel,
    at,
  );
  b.add(
    'paint',
    tube(
      [
        v3(0, 0.186, -0.1),
        v3(0, 0.226, -0.082),
        v3(0, 0.236, 0),
        v3(0, 0.226, 0.082),
        v3(0, 0.186, 0.1),
      ],
      0.011,
      20,
      8,
    ),
    dark,
    at,
  );
  for (const z of [-0.095, 0.095])
    b.add('metal', rbox(0.04, 0.02, 0.035, 0.006), steel, A(m4(0, 0.19, z)));
  // The pylon that holds it to the hull.
  if (ship)
    b.add(
      'paint',
      rbox(0.18, 0.085, 0.36, 0.03, 2),
      '#5a606b',
      A(m4(-s * 0.17, 0.01, -0.02)),
    );
}

/** A wooden crate: battens on every edge and a brace on each side. */
function crateParts(b: Bins, at: THREE.Matrix4, s: number) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  const board = '#c58e55';
  const batten = '#8f5d31';
  b.add('paint', rbox(s * 0.94, s * 0.94, s * 0.94, s * 0.03, 1), board, at);
  const t = s * 0.12;
  const e = s / 2 - t / 2;
  for (const [x, y] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    b.add('paint', rbox(t, t, s, t * 0.3, 1), batten, A(m4(x * e, y * e, 0)));
    b.add('paint', rbox(s, t, t, t * 0.3, 1), batten, A(m4(0, x * e, y * e)));
    b.add('paint', rbox(t, s, t, t * 0.3, 1), batten, A(m4(x * e, 0, y * e)));
  }
  const len = Math.SQRT2 * (s - 2 * t);
  for (let k = 0; k < 4; k++)
    b.add(
      'paint',
      rbox(len, t * 0.8, t * 0.5, t * 0.2, 1),
      batten,
      A(
        m4(0, 0, 0, 0, (k * Math.PI) / 2, 0).multiply(
          m4(0, 0, s * 0.47, 0, 0, Math.PI / 4),
        ),
      ),
    );
  for (const [x, y, z] of [
    [-1, -1, 1],
    [1, -1, 1],
    [-1, 1, 1],
    [1, 1, 1],
  ])
    b.add(
      'metal',
      dome(s * 0.018, 6, 2),
      '#7e848c',
      A(m4(x * e, y * e, z * s * 0.5, Math.PI / 2, 0, 0)),
    );
}
/** A cardboard box, taped shut, with this-way-up arrows. */
function cartonParts(
  b: Bins,
  at: THREE.Matrix4,
  w: number,
  h: number,
  d: number,
) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  b.add('paint', rbox(w, h, d, 0.012, 2), '#c99a5b', at);
  b.add(
    'paint',
    rbox(w * 0.32, 0.004, d * 1.01, 0.0015, 1),
    '#e8d9a8',
    A(m4(0, h / 2, 0)),
  );
  for (const z of [-1, 1])
    b.add(
      'paint',
      rbox(w * 0.32, h * 0.42, 0.004, 0.0015, 1),
      '#e8d9a8',
      A(m4(0, h * 0.29, (z * d) / 2)),
    );
  b.add(
    'paint',
    rbox(0.004, 0.003, d * 0.98, 0.001, 1),
    '#8e6a3c',
    A(m4(0, h / 2 + 0.002, 0)),
  );
  for (const x of [-0.025, 0.025]) {
    b.add(
      'paint',
      rbox(0.004, h * 0.4, 0.008, 0.002, 1),
      '#4a3a2a',
      A(m4(w / 2 + 0.001, -0.005, x)),
    );
    for (const r of [-0.7, 0.7])
      b.add(
        'paint',
        rbox(0.004, 0.03, 0.008, 0.002, 1),
        '#4a3a2a',
        A(m4(w / 2 + 0.001, h * 0.2 - 0.016, x + r * 0.012, r, 0, 0)),
      );
  }
}

/** Cargo Pod (hold +1): an orange pod strapped to each side of the hull. */
const cargoPod: Maker = (where) => {
  const group = new THREE.Group();
  const b = new Bins(kitMats());
  if (where === 'ship') {
    for (const s of [-1, 1])
      cargoPodParts(b, s, m4(s * 0.66, -0.1, -0.12), true);
  } else {
    cargoPodParts(b, 1, m4(), false);
    // A crate and a box waiting to go in.
    crateParts(b, m4(0.42, -0.06, 0.22, 0, 0.4, 0), 0.26);
    cartonParts(b, m4(0.44, 0.15, 0.2, 0, 0.9, 0), 0.2, 0.16, 0.2);
  }
  b.into(group);
  return still(group);
};

/** Fruit for the harvester's shop stand. */
function fruitParts(b: Bins) {
  const stem = '#6b4a2b';
  const leaf = '#4f9a35';
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.03, 0.028, 0.075, 0);
  leafShape.quadraticCurveTo(0.03, -0.028, 0, 0);
  const leafGeo = extrude(leafShape, 0.004, 0, 1, 8);
  const apple = new THREE.SplineCurve(
    [
      [0, -0.074],
      [0.03, -0.08],
      [0.066, -0.066],
      [0.09, -0.032],
      [0.095, 0.008],
      [0.084, 0.046],
      [0.058, 0.068],
      [0.03, 0.07],
      [0.012, 0.058],
      [0, 0.052],
    ].map(([x, y]) => v2(x, y)),
  ).getPoints(22);
  const pear = new THREE.SplineCurve(
    [
      [0, -0.08],
      [0.045, -0.078],
      [0.072, -0.055],
      [0.074, -0.022],
      [0.058, 0.008],
      [0.04, 0.036],
      [0.034, 0.064],
      [0.022, 0.086],
      [0, 0.09],
    ].map(([x, y]) => v2(x, y)),
  ).getPoints(22);
  const appleAt = m4(-0.18, -0.31, 0.29, 0.2, 0, 0.15);
  b.add(
    'paint',
    new THREE.LatheGeometry(apple, 24),
    (c) => (c.y > 0.02 ? '#e0473a' : '#c8322c'),
    appleAt,
  );
  b.add(
    'paint',
    tube([v3(0, 0.05, 0), v3(0.004, 0.08, 0), v3(0.016, 0.1, 0)], 0.006, 6, 5),
    stem,
    appleAt,
  );
  b.add(
    'paint',
    leafGeo,
    leaf,
    appleAt.clone().multiply(m4(0.01, 0.085, 0, 0.6, 0, 0.5)),
  );
  b.add('paint', sphere(0.085, 24, 16), '#f39a2b', m4(0.02, -0.31, 0.35));
  b.add('paint', sphere(0.014, 8, 6), '#5d8a2e', m4(0.02, -0.228, 0.35));
  const pearAt = m4(0.2, -0.31, 0.27, -0.1, 0, -0.2);
  b.add('paint', new THREE.LatheGeometry(pear, 24), '#b9cf45', pearAt);
  b.add(
    'paint',
    tube(
      [v3(0, 0.086, 0), v3(-0.004, 0.11, 0), v3(-0.014, 0.125, 0)],
      0.005,
      6,
      5,
    ),
    stem,
    pearAt,
  );
  b.add(
    'paint',
    leafGeo,
    leaf,
    pearAt.clone().multiply(m4(-0.01, 0.11, 0, -0.5, Math.PI, 0.4)),
  );
}

/** Harvester (+1 food): a turning reel under the nose that combs fruit up. */
const harvester: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const green = '#4e9a3a';
  const deep = '#3a7a2a';
  const yellow = '#f2c230';
  const steel = '#c9d0d8';
  // The reel: an axle, two spiders, six bats with curved tines.
  const reel = new THREE.Group();
  const r = new Bins(mats);
  r.add(
    'metal',
    cyl(0.03, 0.03, 0.7, 16),
    steel,
    m4(0, 0, 0, 0, 0, Math.PI / 2),
  );
  for (const x of [-0.29, 0.29]) {
    r.add(
      'paint',
      cyl(0.05, 0.05, 0.035, 20),
      green,
      m4(x, 0, 0, 0, 0, Math.PI / 2),
    );
    r.add(
      'paint',
      new THREE.TorusGeometry(0.16, 0.013, 6, 36),
      green,
      m4(x, 0, 0, 0, Math.PI / 2, 0),
    );
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      r.add(
        'paint',
        rbox(0.018, 0.15, 0.026, 0.006, 1),
        green,
        m4(x, Math.cos(a) * 0.085, Math.sin(a) * 0.085, a, 0, 0),
      );
    }
  }
  const tine = (x: number, a: number) =>
    tube(
      [0, 0.35, 0.7, 1].map((s) => {
        const rr = 0.16 + 0.078 * s;
        const ang = a + 0.5 * s * s;
        return v3(x, Math.cos(ang) * rr, Math.sin(ang) * rr);
      }),
      0.0055,
      5,
      4,
    );
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + TAU / 12;
    r.add(
      'paint',
      rbox(0.6, 0.036, 0.036, 0.012, 1),
      yellow,
      m4(0, Math.cos(a) * 0.16, Math.sin(a) * 0.16, a, 0, 0),
    );
    for (let j = 0; j < 6; j++) r.add('metal', tine(-0.25 + j * 0.1, a), steel);
  }
  r.into(reel);
  group.add(reel);
  // The frame: two arms back to the hull, hub bosses, a gearbox, dividers.
  const f = new Bins(mats);
  const arm = extrude(link(0.4, 0.05, 0.062), 0.03, 0.008, 2, 12)
    .rotateZ(Math.atan2(0.26, 0.3))
    .rotateY(Math.PI / 2);
  for (const s of [-1, 1]) {
    const x = s * 0.345;
    f.add('paint', arm, green, m4(x, 0, 0));
    f.add(
      'paint',
      latheZ(
        [
          [0, -0.03],
          [0.05, -0.03, 0.01],
          [0.05, 0.03, 0.01],
          [0, 0.03],
        ],
        24,
        3,
      ),
      deep,
      m4(x, 0, 0, 0, Math.PI / 2, 0),
    );
    f.add(
      'metal',
      latheZ(
        [
          [0, 0],
          [0.026, 0, 0.006],
          [0.02, 0.018, 0.008],
          [0, 0.022],
        ],
        16,
        3,
      ),
      steel,
      m4(x + s * 0.03, 0, 0, 0, (s * Math.PI) / 2, 0),
    );
    f.add(
      'paint',
      cyl(0.002, 0.034, 0.17, 16),
      yellow,
      aim(v3(x, -0.07, 0.14), v3(0, -0.35, 1)),
    );
  }
  f.add(
    'metal',
    rod(0.022, v3(-0.36, 0.2, -0.24), v3(0.36, 0.2, -0.24), 14),
    steel,
  );
  const gb = m4(0.4, 0.1, -0.12, 0.7, 0, 0);
  const G = (m: THREE.Matrix4) => gb.clone().multiply(m);
  f.add('paint', rbox(0.06, 0.15, 0.2, 0.025, 2), deep, gb);
  f.add(
    'paint',
    extrude(roundRect(0.16, 0.1, 0.04), 0.012, 0.004).rotateY(Math.PI / 2),
    yellow,
    G(m4(0.034, 0, 0)),
  );
  for (const [y, z] of [
    [-0.035, -0.065],
    [0.035, -0.065],
    [-0.035, 0.065],
    [0.035, 0.065],
  ])
    f.add(
      'metal',
      dome(0.008, 6, 2),
      steel,
      G(m4(0.046, y, z, 0, 0, -Math.PI / 2)),
    );
  f.add(
    'metal',
    rod(0.014, v3(0.4, 0.17, -0.2), v3(0.3, 0.32, -0.32), 10),
    steel,
  );
  f.into(group);
  if (where === 'ship') group.position.set(0, -0.47, 0.64);
  else {
    const b = new Bins(mats);
    fruitParts(b);
    b.into(group);
  }
  return { group, update: (t) => (reel.rotation.x = -t * 2.4) };
};

/** Drill (+1 metal): a threaded steel bit on the nose that spins. */
const drill: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const yellow = C('#f2c230');
  const fin = C('#d9a820');
  const steel = '#cfd6de';
  // The motor housing that clamps onto the nose.
  const h = new Bins(mats);
  h.add(
    'paint',
    latheZ(
      [
        [0, -0.13],
        [0.22, -0.13],
        [0.245, -0.115, 0.01],
        [0.245, -0.098],
        [0.262, -0.095, 0.003],
        [0.262, -0.087, 0.003],
        [0.245, -0.084],
        [0.245, -0.072],
        [0.262, -0.069, 0.003],
        [0.262, -0.061, 0.003],
        [0.245, -0.058],
        [0.245, -0.046],
        [0.262, -0.043, 0.003],
        [0.262, -0.035, 0.003],
        [0.245, -0.032],
        [0.245, 0, 0.01],
        [0.228, 0.014],
        [0, 0.014],
      ],
      40,
      2,
    ),
    (c) => (Math.hypot(c.x, c.y) > 0.25 ? fin : yellow),
  );
  h.add(
    'paint',
    latheZ(
      [
        [0.2, 0.01],
        [0.224, 0.013, 0.004],
        [0.224, 0.03, 0.004],
        [0.2, 0.033],
      ],
      28,
      3,
    ),
    '#33363d',
  );
  h.add(
    'metal',
    latheZ(
      [
        [0, 0.028],
        [0.205, 0.028],
        [0.21, 0.04, 0.005],
        [0.198, 0.055, 0.005],
        [0, 0.058],
      ],
      28,
      3,
    ),
    steel,
  );
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    h.add(
      'metal',
      dome(0.009, 6, 2),
      '#8a919b',
      m4(Math.cos(a) * 0.176, Math.sin(a) * 0.176, 0.055, Math.PI / 2, 0, 0),
    );
  }
  // Two little grab handles on the housing's sides.
  for (const s of [-1, 1])
    h.add(
      'paint',
      tube(
        [
          v3(s * 0.24, 0.05, -0.11),
          v3(s * 0.285, 0.06, -0.085),
          v3(s * 0.285, 0.06, -0.025),
          v3(s * 0.24, 0.05, 0),
        ],
        0.012,
        14,
        6,
      ),
      '#33363d',
    );
  h.into(group);
  // The spinning bit: chuck, then a cone wound with a two-start thread.
  const bit = new THREE.Group();
  const k = new Bins(mats);
  k.add(
    'metal',
    lathe(
      [
        [0, 0.055],
        [0.118, 0.055],
        [0.124, 0.065, 0.006],
        [0.124, 0.1, 0.006],
        [0.1, 0.122, 0.008],
        [0.085, 0.135],
        [0, 0.135],
      ],
      36,
      3,
    ),
    '#9aa3ad',
  );
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU;
    const d = v3(Math.cos(a), 0, Math.sin(a));
    k.add(
      'paint',
      cyl(0.014, 0.014, 0.012, 10),
      '#2a2d33',
      aim(d.clone().multiplyScalar(0.121).setY(0.085), d),
    );
  }
  const L = 0.44;
  const R0 = 0.155;
  const y0 = 0.13;
  const turns = 2.6;
  const R = (s: number) => R0 * Math.pow(Math.max(0, 1 - s), 0.92);
  const rows = 56;
  const cols = 44;
  const auger = grid(rows, cols, (i, j) => {
    const s = i / (rows - 1);
    const th = (j / cols) * TAU;
    const q = th - s * turns * TAU;
    const ridge =
      Math.pow(0.5 + 0.5 * Math.cos(2 * q), 5) * (1 - sstep(0.8, 0.97, s));
    const rr = R(s) * (0.74 + 0.26 * ridge);
    return v3(-rr * Math.sin(th), y0 + s * L, rr * Math.cos(th));
  });
  const bright = C('#e2e7ec');
  const valley = C('#9ea7b2');
  const tip = C('#e9b94c');
  k.add('metal', auger, (c) => {
    const s = (c.y - y0) / L;
    if (s > 0.9) return tip;
    const ratio = Math.hypot(c.x, c.z) / Math.max(1e-4, R(s));
    return ratio < 0.8 ? valley : bright;
  });
  k.add(
    'metal',
    new THREE.CircleGeometry(R0, 40).rotateX(Math.PI / 2),
    '#9ea7b2',
    m4(0, y0, 0),
  );
  k.into(bit);
  bit.rotation.x = Math.PI / 2;
  group.add(bit);
  if (where === 'ship') group.position.set(0, 0, 0.88);
  else {
    group.rotation.set(-0.5, 0.6, 0);
    // A lump of ore with bright metal showing through.
    const o = new Bins(mats);
    const at = m4(0.06, -0.2, 0.64, 0.3, 0.2, 0);
    o.add(
      'paint',
      lump(2, 0.3, 4),
      (c) => (c.y > 0.1 ? '#8a7f74' : '#6f655c'),
      at.clone().multiply(m4(0, 0, 0, 0, 0, 0, 0.16)),
    );
    const rand = seeded(12);
    for (let n = 0; n < 6; n++) {
      const d = v3(rand() - 0.5, rand() * 0.8, rand() - 0.5).normalize();
      o.add(
        'metal',
        lump(1, 0.25, 20 + n),
        ['#e8c25a', '#cfd6de', '#d98c5a'][n % 3],
        at
          .clone()
          .multiply(
            m4(
              d.x * 0.15,
              d.y * 0.15,
              d.z * 0.15,
              rand(),
              rand(),
              0,
              0.03 + rand() * 0.02,
            ),
          ),
      );
    }
    o.into(group);
  }
  return { group, update: (t) => (bit.rotation.y = t * 9) };
};

/** Scoop (+1 ice): a big bucket under the belly, full of ice. */
const scoop: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const blue = C('#3b8fd5');
  const worn = C('#7f9cb8');
  const steel = '#c9d0d8';
  // The bucket's centreline in side view (z, y): floor, a round heel, the back.
  const line: THREE.Vector2[] = [];
  for (let i = 0; i <= 4; i++) line.push(v2(0.22 - (0.28 * i) / 4, 0));
  for (let i = 1; i <= 10; i++) {
    const a = -Math.PI / 2 - (i / 10) * (Math.PI / 2);
    line.push(v2(-0.06 + 0.14 * Math.cos(a), 0.14 + 0.14 * Math.sin(a)));
  }
  for (let i = 1; i <= 3; i++) line.push(v2(-0.2, 0.14 + (0.14 * i) / 3));
  const normalAt = (i: number) => {
    const p = line[Math.max(0, i - 1)];
    const q = line[Math.min(line.length - 1, i + 1)];
    const t = q.clone().sub(p).normalize();
    return v2(-t.y, t.x);
  };
  const offset = (d: number, from = 0) =>
    line
      .slice(from)
      .map((p, i) => p.clone().addScaledVector(normalAt(i + from), d));
  const band = (d0: number, d1: number, from = 0) => {
    const outer = offset(d1, from);
    const inner = offset(d0, from).reverse();
    return new THREE.Shape([...outer, ...inner]);
  };
  const b = new Bins({
    ...mats,
    ice: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.72,
      emissive: '#6cc6ff',
      emissiveIntensity: 0.16,
    }),
  });
  const inside = v3(0, 0.16, 0);
  b.add(
    'paint',
    extrude(band(-0.0125, 0.0125), 0.56, 0.008, 2).rotateY(-Math.PI / 2),
    (c, n) =>
      Math.abs(n.x) > 0.7
        ? blue
        : n.dot(inside.clone().sub(c)) > 0
          ? worn
          : blue,
  );
  // Side plates, sloping down to the front.
  const sideShape = new THREE.Shape([
    ...offset(0.0125),
    v2(-0.2125, 0.285),
    v2(0.2, 0.08),
    v2(0.235, 0.01),
  ]);
  const sideGeo = extrude(sideShape, 0.022, 0.006, 2).rotateY(-Math.PI / 2);
  for (const x of [-0.3, 0.3]) b.add('paint', sideGeo, blue, m4(x, 0, 0));
  // Ribs down the back, a steel lip and five teeth.
  const ribGeo = extrude(band(0.0125, 0.036, 4), 0.024, 0.005, 2).rotateY(
    -Math.PI / 2,
  );
  for (const x of [-0.17, 0, 0.17])
    b.add('paint', ribGeo, '#2f78b8', m4(x, 0, 0));
  b.add('metal', rbox(0.62, 0.032, 0.05, 0.012), steel, m4(0, 0.002, 0.215));
  b.add('metal', rbox(0.6, 0.026, 0.036, 0.01), steel, m4(0, 0.285, -0.2));
  for (const x of [-0.313, 0.313])
    for (const [y, z] of [
      [0.04, 0.12],
      [0.04, -0.05],
      [0.19, -0.17],
      [0.12, 0.03],
    ])
      b.add(
        'metal',
        dome(0.009, 6, 2),
        steel,
        m4(x, y, z, 0, 0, x > 0 ? -Math.PI / 2 : Math.PI / 2),
      );
  for (let k = 0; k < 5; k++)
    b.add(
      'metal',
      cyl(0.012, 0.028, 0.07, 10),
      '#dfe4ea',
      m4(-0.24 + k * 0.12, 0.002, 0.265, Math.PI / 2, 0, 0, [1, 1, 0.55]),
    );
  // Hinge lugs where it hangs from the hull, between the stripe's rivets.
  if (where === 'ship')
    for (const x of [-0.325, 0.325]) {
      b.add(
        'metal',
        rbox(0.03, 0.22, 0.06, 0.012),
        '#5a606b',
        m4(x, 0.26, -0.18),
      );
      b.add(
        'metal',
        cyl(0.026, 0.026, 0.05, 16),
        steel,
        m4(x, 0.17, -0.18, 0, 0, Math.PI / 2),
      );
    }
  // Rounded ice cubes, each with a cloudy heart.
  const rand = seeded(9);
  const cubes: [number, number, number, number][] = [
    [-0.18, 0.09, -0.05, 0.15],
    [-0.03, 0.08, 0.02, 0.14],
    [0.13, 0.085, -0.06, 0.15],
    [0.06, 0.2, -0.1, 0.13],
    [-0.1, 0.2, -0.11, 0.12],
    [0.2, 0.07, 0.08, 0.11],
  ];
  const ice = ['#bfe8ff', '#aee0fb', '#d2f0ff'];
  cubes.forEach(([x, y, z, s], i) => {
    const at = m4(x, y, z, rand() * 0.8, rand() * 1.5, rand() * 0.8);
    b.add('ice', rbox(s, s, s, s * 0.2, 2), ice[i % 3], at);
    b.add(
      'paint',
      rbox(s * 0.36, s * 0.36, s * 0.36, s * 0.1, 1),
      '#e4f6ff',
      at,
    );
  });
  if (where === 'ship') group.position.set(0, -0.6, -0.13);
  else group.rotation.set(0.25, -0.5, 0);
  b.into(group);
  return still(group);
};

/** Radar (alone +1): a dish on a short mast that sweeps round and round. */
const radar: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const white = C('#f3f1ec');
  const seam = C('#c9ccd2');
  const dark = '#3b3f48';
  const steel = '#c9d0d8';
  const red = new THREE.MeshStandardMaterial({
    color: '#ff6b4a',
    emissive: '#ff4a2a',
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  // The mast on its flange.
  const m = new Bins(mats);
  m.add(
    'paint',
    lathe(
      [
        [0, -0.06],
        [0.1, -0.06],
        [0.1, 0.06],
        [0.116, 0.066, 0.004],
        [0.116, 0.084, 0.004],
        [0.075, 0.094, 0.006],
        [0.05, 0.11, 0.008],
        [0.042, 0.14],
        [0.04, 0.155],
        [0.047, 0.158, 0.002],
        [0.047, 0.168, 0.002],
        [0.039, 0.171],
        [0.035, 0.26],
        [0, 0.26],
      ],
      28,
      2,
    ),
    dark,
  );
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    m.add(
      'metal',
      dome(0.008, 6, 2),
      steel,
      m4(Math.cos(a) * 0.098, 0.088, Math.sin(a) * 0.098),
    );
  }
  m.add(
    'metal',
    lathe(
      [
        [0.03, 0.25],
        [0.052, 0.252, 0.004],
        [0.052, 0.27, 0.004],
        [0.03, 0.272],
      ],
      32,
      2,
    ),
    steel,
  );
  if (where === 'shop') {
    // A base plate and a little control box with a cable.
    m.add('paint', rbox(0.36, 0.04, 0.36, 0.018), '#5a606b', m4(0, -0.02, 0));
    for (const [x, z] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ])
      m.add('metal', dome(0.012, 8, 2), steel, m4(x * 0.145, 0, z * 0.145));
    m.add(
      'paint',
      rbox(0.11, 0.09, 0.08, 0.016),
      '#f3f1ec',
      m4(0.24, 0.045, 0.2, 0, -0.5, 0),
    );
    m.add(
      'paint',
      lathe(
        [
          [0, 0],
          [0.018, 0, 0.004],
          [0.016, 0.014, 0.004],
          [0, 0.016],
        ],
        16,
        2,
      ),
      dark,
      m4(0.25, 0.056, 0.245, Math.PI / 2 - 0.1, 0, 0.5),
    );
    m.add(
      'paint',
      tube(
        [v3(0.2, 0.02, 0.17), v3(0.15, 0.01, 0.1), v3(0.09, 0.03, 0.04)],
        0.008,
        12,
        6,
      ),
      dark,
    );
  }
  m.into(group);
  // The head turns: a drum, the dish on a neck, the feed on three struts.
  const head = new THREE.Group();
  head.position.y = 0.27;
  const h = new Bins(mats);
  h.add(
    'paint',
    lathe(
      [
        [0, 0],
        [0.056, 0, 0.006],
        [0.056, 0.024],
        [0.052, 0.027],
        [0.056, 0.03],
        [0.056, 0.052, 0.008],
        [0, 0.056],
      ],
      28,
      3,
    ),
    (c) => (c.y > 0.022 && c.y < 0.032 ? seam : white),
  );
  const dishAt = m4(0, 0.1, 0, Math.PI / 2 - 0.5, 0, 0);
  const D = (local: THREE.Matrix4) => dishAt.clone().multiply(local);
  const k = 1.6;
  const rim = 0.28;
  const prof: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const r = (rim * i) / 14;
    prof.push([r, k * r * r - 0.012 - 0.006 * (1 - i / 14)]);
  }
  for (let i = 14; i >= 0; i--) {
    const r = (rim * i) / 14;
    prof.push([r, k * r * r]);
  }
  h.add(
    'paint',
    lathe(prof, 48),
    (c, n) => {
      const r = Math.hypot(c.x, c.z);
      return n.y > 0 &&
        (Math.abs(r - 0.13) < 0.006 || r < 0.035 || Math.abs(r - 0.215) < 0.005)
        ? seam
        : white;
    },
    dishAt,
  );
  h.add(
    'paint',
    new THREE.TorusGeometry(rim + 0.002, 0.009, 6, 48).rotateX(Math.PI / 2),
    white,
    D(m4(0, k * rim * rim - 0.004, 0)),
  );
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * TAU;
    const pts = [0.045, 0.1, 0.16, 0.22, 0.27].map((r) =>
      v3(Math.cos(a) * r, k * r * r - 0.022, Math.sin(a) * r),
    );
    h.add('metal', tube(pts, 0.006, 10, 4), '#aab2bc', dishAt);
  }
  h.add(
    'metal',
    lathe(
      [
        [0, -0.075],
        [0.035, -0.075, 0.006],
        [0.06, -0.03, 0.008],
        [0.06, -0.01],
        [0, -0.01],
      ],
      28,
      3,
    ),
    '#aab2bc',
    dishAt,
  );
  const hub = v3(0, -0.06, 0).applyMatrix4(dishAt);
  h.add('metal', rod(0.024, v3(0, 0.04, 0), hub, 14), '#aab2bc');
  const focus = 0.18;
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU + Math.PI / 2;
    const r = rim - 0.02;
    h.add(
      'metal',
      rod(
        0.0055,
        v3(Math.cos(a) * r, k * r * r, Math.sin(a) * r),
        v3(0, focus + 0.01, 0),
        6,
      ),
      steel,
      dishAt,
    );
  }
  h.add('metal', cyl(0.012, 0.03, 0.05, 16), steel, D(m4(0, focus - 0.02, 0)));
  h.add(
    'paint',
    rbox(0.05, 0.04, 0.05, 0.012),
    white,
    D(m4(0, focus + 0.02, 0)),
  );
  h.into(head);
  const lamp = new THREE.Mesh(sphere(0.022, 14, 10), red);
  lamp.applyMatrix4(D(m4(0, focus + 0.055, 0)));
  head.add(lamp);
  group.add(head);
  if (where === 'ship') group.position.set(0, 0.4, 0.02);
  else group.position.y = -0.18;
  return {
    group,
    update: (t) => {
      head.rotation.y = t * 1.3;
      red.emissiveIntensity = 0.3 + 0.9 * (Math.sin(t * 6) > 0.6 ? 1 : 0);
    },
  };
};

/** Upgrades that bolt onto the hull, each at its own mount. */
const hullMakers: Record<string, Maker> = {
  rigging: cargoPod,
  sawmill: harvester,
  mason: drill,
  fold: scoop,
  kite: radar,
  ...gearMakers,
};
/** Every upgrade's object. Trophies and extras (and the Telescope) are the
 * home base's modules (alto-base.ts), so they are made for the shop only. */
export const upgradeMakers: Record<string, Maker> = {
  ...Object.fromEntries(
    Object.entries(baseModuleMakers).map(
      ([id, make]) => [id, () => make()] as const,
    ),
  ),
  ...hullMakers,
};
const onHull = (id: string) => id in hullMakers;
/** Free an object's geometry and materials. */
function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}

/** An upgrade standing alone in the shop: centred, fitted to a unit sphere,
 * turning slowly on its own. */
export function buildShopModel(id: string): Upgrade | null {
  const make = upgradeMakers[id];
  if (!make) return null;
  const inner = make('shop');
  const fit = new THREE.Group();
  fit.add(inner.group);
  const box = new THREE.Box3().setFromObject(fit);
  const centre = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  inner.group.position.sub(centre);
  fit.scale.setScalar(0.95 / Math.max(0.01, radius));
  const group = new THREE.Group();
  group.add(fit);
  return {
    group,
    update: (t, dt) => {
      fit.rotation.y = 0.5 + Math.sin(t * 0.45) * 0.55;
      inner.update(t, dt);
    },
  };
}

// ——— The ship ———

export type Ship = {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
  /** Show these upgrades on the hull; `ghost` is shown see-through, pulsing (a pick not yet built). */
  setKit: (ids: readonly string[], ghost?: string | null) => void;
  /** 1 standing on its legs, 0 flying. */
  setLanded: (v: number) => void;
  /** 0 engine off … 1 full burn. */
  setThrust: (v: number) => void;
  dispose: () => void;
};

/** The hull shell: one surface with raised paint, seams and the cockpit well. */
function hullShell(seat: THREE.Color) {
  const ts = hullRows();
  const as = hullCols();
  const seamCols = new Set(SEAMS.map((s) => as.indexOf(s)));
  const shell = grid(ts.length, as.length, (i, j) => {
    const t = ts[i];
    const a = j === as.length ? as[0] + TAU : as[j];
    let r = Math.max(0.0001, hullRadius(t) + hullLift(t));
    if (
      seamCols.has(j % as.length) &&
      SEAM_SPANS.some(([p, q]) => t > p && t < q)
    )
      r -= 0.003;
    return v3(r * Math.sin(a), r * Math.cos(a), -1 + 2 * t);
  });
  const cream = C('#f3eadb');
  const creamSeam = C('#cbbda6');
  const seatSeam = seat.clone().multiplyScalar(0.7);
  const well = C('#262b38');
  const paint: Paint = (c) => {
    if (inCanopy(c)) return well;
    const t = (c.z + 1) / 2;
    const band = (t > STRIPE[0] && t < STRIPE[1]) || t > NOSE;
    if (GROOVES.some((g) => Math.abs(t - g) < 0.0028))
      return band ? seatSeam : creamSeam;
    const a = (Math.atan2(c.x, c.y) + TAU) % TAU;
    if (
      SEAMS.some((s) => angDist(a, s) < 0.009) &&
      SEAM_SPANS.some(([p, q]) => t > p && t < q)
    )
      return creamSeam;
    return band ? seat : cream;
  };
  return { shell, paint };
}

export function buildShip(colour: string): Ship {
  const group = new THREE.Group();
  const hull = new THREE.Group();
  group.add(hull);
  const seat = C(colour);
  const paintMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.42,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
  });
  const metal = vmat({ metalness: 0.75, roughness: 0.32 });
  const mats = {
    paint: paintMat,
    metal,
    glass: new THREE.MeshPhysicalMaterial({
      color: '#6f9fd0',
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1,
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 1.6,
    }),
    port: vmat({
      roughness: 0.1,
      metalness: 0.3,
      emissive: '#ffcf80',
      emissiveIntensity: 0.35,
    }),
    lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  const b = new Bins(mats);
  const steel = '#c9ced6';
  const gun = '#5d636e';

  // The shell, with rivets along the stripe and round the tail.
  const { shell, paint } = hullShell(seat);
  b.add('paint', shell, paint);
  const rivet = dome(0.0085, 6, 2);
  for (const [t, n, lift] of [
    [0.368, 36, 0.008],
    [0.492, 36, 0.008],
    [0.035, 24, 0],
  ] as const)
    for (let k = 0; k < n; k++)
      b.add(
        'metal',
        rivet,
        steel,
        onBody(hullR, (k / n) * TAU, -1 + 2 * t, lift).multiply(
          m4(0, 0, 0, Math.PI / 2, 0, 0),
        ),
      );
  // A chrome nose tip.
  b.add('metal', sphere(0.036, 16, 12), '#e3e7ec', m4(0, 0, 0.985));

  // The canopy: glass, a frame where it meets the hull, a hoop and a pilot.
  b.add(
    'glass',
    new THREE.SphereGeometry(1, 48, 18, 0, TAU, 0, Math.PI * 0.6),
    '#ffffff',
    m4(CANOPY.c.x, CANOPY.c.y, CANOPY.c.z, 0, 0, 0, [
      CANOPY.r.x,
      CANOPY.r.y,
      CANOPY.r.z,
    ]),
  );
  const ring: THREE.Vector3[] = [];
  for (let k = 0; k < 64; k++) {
    const ph = (k / 64) * TAU;
    let lo = 0;
    let hi = Math.PI * 0.62;
    for (let it = 0; it < 28; it++) {
      const mid = (lo + hi) / 2;
      if (outsideHull(onCanopy(mid, ph))) lo = mid;
      else hi = mid;
    }
    ring.push(onCanopy(lo, ph));
  }
  b.add('metal', tube(ring, 0.019, 64, 6, true), '#b4bcc6');
  for (let k = 0; k < 16; k++) {
    const p = ring[k * 4];
    const out = p.clone().sub(CANOPY.c).normalize();
    b.add(
      'metal',
      rivet,
      '#e3e7ec',
      aim(p.clone().addScaledVector(out, 0.017), out),
    );
  }
  const hoop: THREE.Vector3[] = [];
  for (let k = 0; k <= 20; k++) {
    const ps = -0.35 + ((Math.PI + 0.7) * k) / 20;
    const f = Math.sqrt(1 - ((0.52 - CANOPY.c.z) / CANOPY.r.z) ** 2) * 1.01;
    hoop.push(
      v3(
        Math.cos(ps) * CANOPY.r.x * f,
        CANOPY.c.y + Math.sin(ps) * CANOPY.r.y * f,
        0.52,
      ),
    );
  }
  b.add('metal', tube(hoop, 0.011, 32, 6), '#b4bcc6');
  b.add('paint', sphere(0.058, 20, 12), '#f7f6f1', m4(0, 0.428, 0.37));
  b.add(
    'metal',
    new THREE.SphereGeometry(
      0.061,
      20,
      10,
      Math.PI / 2 - 0.95,
      1.9,
      0.95,
      0.85,
    ),
    '#1b2a44',
    m4(0, 0.428, 0.37),
  );
  b.add(
    'paint',
    rbox(0.13, 0.06, 0.09, 0.025, 2),
    '#e9e4da',
    m4(0, 0.385, 0.37),
  );
  b.add(
    'paint',
    rbox(0.15, 0.13, 0.03, 0.012),
    '#3b3f48',
    m4(0, 0.41, 0.295, -0.2, 0, 0),
  );
  b.add(
    'paint',
    rbox(0.16, 0.035, 0.05, 0.012),
    '#3b3f48',
    m4(0, 0.39, 0.505, 0.35, 0, 0),
  );
  for (const [x, c] of [
    [-0.045, '#5dff8a'],
    [0, '#ffc23a'],
    [0.045, '#ff5a4a'],
  ] as const)
    b.add('lights', sphere(0.008, 8, 6), c, m4(x, 0.408, 0.5));

  // Portholes: a bolted bezel and warm glass.
  const bezel = lathe(
    [
      [0.09, -0.02],
      [0.088, 0.004, 0.004],
      [0.08, 0.017, 0.006],
      [0.064, 0.021, 0.005],
      [0.056, 0.012, 0.004],
      [0.054, -0.02],
    ],
    24,
    2,
  ).rotateX(Math.PI / 2);
  const cap = new THREE.SphereGeometry(0.2, 24, 3, 0, TAU, 0, 0.29)
    .translate(0, 0.006 - 0.2 * Math.cos(0.29), 0)
    .rotateX(Math.PI / 2);
  for (const a of [-1.22, 1.22])
    for (const z of [-0.42, -0.08]) {
      const at = onBody(hullR, a, z, hullLift((z + 1) / 2));
      b.add('metal', bezel, '#c9d0d8', at);
      b.add('port', cap, '#1d3557', at);
      for (let k = 0; k < 8; k++) {
        const q = (k / 8) * TAU;
        b.add(
          'metal',
          rivet,
          '#8a919b',
          at
            .clone()
            .multiply(
              m4(
                Math.cos(q) * 0.072,
                Math.sin(q) * 0.072,
                0.019,
                Math.PI / 2,
                0,
                0,
              ),
            ),
        );
      }
    }

  // A side hatch on the right, and an emblem on the left.
  const hz = 0.45;
  b.add(
    'paint',
    wrap(
      extrude(roundRect(0.21, 0.26, 0.05), 0.002),
      hullR,
      Math.PI / 2,
      hz,
      0.0015,
    ),
    '#bfb19a',
  );
  b.add(
    'paint',
    wrap(
      extrude(roundRect(0.18, 0.23, 0.035), 0.006, 0.003, 2),
      hullR,
      Math.PI / 2,
      hz,
      0.003,
    ),
    '#f6efe2',
  );
  b.add(
    'metal',
    wrap(
      tube(
        [
          v3(-0.04, -0.08, 0.008),
          v3(-0.036, -0.08, 0.026),
          v3(0.036, -0.08, 0.026),
          v3(0.04, -0.08, 0.008),
        ],
        0.0075,
        14,
        6,
      ),
      hullR,
      Math.PI / 2,
      hz,
    ),
    steel,
  );
  for (const u of [-0.055, 0.055]) {
    b.add(
      'metal',
      wrap(
        cyl(0.011, 0.011, 0.04, 12)
          .rotateZ(Math.PI / 2)
          .translate(u, 0.112, 0.01),
        hullR,
        Math.PI / 2,
        hz,
      ),
      gun,
    );
    b.add(
      'metal',
      wrap(
        rbox(0.032, 0.035, 0.006, 0.002, 1).translate(u, 0.092, 0.007),
        hullR,
        Math.PI / 2,
        hz,
      ),
      gun,
    );
  }
  b.add(
    'paint',
    wrap(
      extrude(
        new THREE.Shape().absarc(0, 0, 0.068, 0, TAU, false),
        0.003,
        0.0015,
        2,
        32,
      ),
      hullR,
      -Math.PI / 2,
      hz,
      0.002,
    ),
    seat,
  );
  b.add(
    'paint',
    wrap(
      extrude(star(0.045, 0.019, 5, Math.PI), 0.002, 0.001, 1),
      hullR,
      -Math.PI / 2,
      hz,
      0.0052,
    ),
    '#fbf6ec',
  );

  // A whip antenna, and RCS thruster blocks at the tail.
  {
    const at = onBody(hullR, -0.62, -0.42);
    b.add(
      'metal',
      lathe(
        [
          [0, -0.01],
          [0.024, -0.01],
          [0.026, 0.008, 0.004],
          [0.012, 0.016, 0.003],
          [0, 0.018],
        ],
        16,
        2,
      ).rotateX(Math.PI / 2),
      gun,
      at,
    );
    const tipAt = v3(0, -0.15, 0.17);
    b.add('metal', rod(0.0045, v3(0, 0, 0.012), tipAt, 6), steel, at);
    b.add(
      'lights',
      sphere(0.012, 10, 8),
      '#ff5a4a',
      at.clone().multiply(m4(tipAt.x, tipAt.y, tipAt.z)),
    );
  }
  for (const a of [-Math.PI / 2, Math.PI / 2]) {
    const at = onBody(hullR, a, -0.8);
    b.add(
      'metal',
      rbox(0.08, 0.1, 0.05, 0.015, 2),
      '#8a919b',
      at.clone().multiply(m4(0, 0, 0.012)),
    );
    const nozzle = cyl(0.018, 0.01, 0.03, 10);
    b.add(
      'metal',
      nozzle,
      gun,
      at.clone().multiply(m4(0.052, 0, 0.02, 0, 0, -Math.PI / 2)),
    );
    b.add(
      'metal',
      nozzle,
      gun,
      at.clone().multiply(m4(-0.052, 0, 0.02, 0, 0, Math.PI / 2)),
    );
    b.add(
      'metal',
      nozzle,
      gun,
      at.clone().multiply(m4(0, -0.062, 0.02, Math.PI, 0, 0)),
    );
  }

  // Three swept fins at the tail, in the seat colour, on bolted root plates.
  const fin = new THREE.Shape();
  fin.moveTo(-0.02, 0);
  fin.lineTo(0.56, 0);
  fin.quadraticCurveTo(0.24, 0.12, 0.09, 0.42);
  fin.quadraticCurveTo(0.07, 0.445, 0.035, 0.44);
  fin.lineTo(0.005, 0.432);
  fin.quadraticCurveTo(-0.03, 0.425, -0.035, 0.39);
  fin.lineTo(-0.02, 0);
  const finGeo = extrude(fin, 0.034, 0.013, 2, 10).rotateY(-Math.PI / 2);
  const plate = extrude(roundRect(0.11, 0.3, 0.03), 0.004, 0.002, 1);
  const finLights = ['#ffffff', '#ff5a4a', '#5dff8a'];
  [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3].forEach((a, i) => {
    const turn = m4(0, 0, 0, 0, 0, a);
    b.add('paint', finGeo, seat, turn.clone().multiply(m4(0, 0.2, -0.45)));
    b.add(
      'lights',
      sphere(0.016, 10, 8),
      finLights[i],
      turn.clone().multiply(m4(0, 0.65, -0.43)),
    );
    b.add('metal', wrap(plate.clone(), hullR, -a, -0.36, 0.002), '#9aa1ab');
    for (let k = 0; k < 4; k++)
      for (const u of [-0.042, 0.042]) {
        const z = -0.48 + k * 0.08;
        b.add(
          'metal',
          rivet,
          steel,
          onBody(hullR, -a - u / hullR(z), z, 0.006).multiply(
            m4(0, 0, 0, Math.PI / 2, 0, 0),
          ),
        );
      }
  });

  // The engine: a bolted mount, a ribbed bell, sooty inside.
  const rOut = (z: number) =>
    0.158 + 0.088 * Math.pow(Math.max(0, (-1.06 - z) / 0.18), 1.4);
  const ribs = [-1.11, -1.165, -1.215];
  const eng: Pt[] = [
    [0, -1.07],
    [0.11, -1.07, 0.01],
  ];
  for (let i = 1; i <= 8; i++) {
    const z = -1.08 - (0.155 * i) / 8;
    eng.push([rOut(z) - 0.012, z]);
  }
  eng.push([0.24, -1.25, 0.006], [0.252, -1.248, 0.006]);
  const zs: number[] = [];
  for (let i = 0; i <= 18; i++) zs.push(-1.24 + (0.18 * i) / 18);
  for (const q of ribs) zs.push(q - 0.007, q - 0.004, q + 0.004, q + 0.007);
  for (const z of zs
    .filter(
      (z) => ribs.every((q) => Math.abs(z - q) > 0.0075) || zs.indexOf(z) > 18,
    )
    .sort((a, b) => a - b)) {
    const bump = ribs.some((q) => Math.abs(z - q) < 0.005) ? 0.008 : 0;
    eng.push([rOut(z) + bump, z]);
  }
  eng.push(
    [0.17, -1.045, 0.006],
    [0.2, -1.04],
    [0.275, -1.03, 0.008],
    [0.285, -1.0, 0.006],
    [0.282, -0.975, 0.006],
    [0.26, -0.965],
    [0, -0.965],
  );
  const soot = C('#2a2c31');
  const throat = C('#4a3226');
  const bell = C(gun);
  const rib = C('#7d8590');
  const mount = C('#8a919b');
  b.add('metal', latheZ(eng, 32, 2), (c) => {
    const r = Math.hypot(c.x, c.y);
    if (c.z > -1.075 && r < 0.115) return throat;
    if (c.z > -1.05) return mount;
    if (r < rOut(c.z) - 0.005) return soot;
    return r > rOut(c.z) + 0.003 ? rib : bell;
  });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    b.add(
      'metal',
      cyl(0.009, 0.009, 0.01, 6),
      '#b4bcc6',
      m4(Math.cos(a) * 0.24, Math.sin(a) * 0.24, -1.036, Math.PI / 2, 0, 0),
    );
  }
  b.into(hull);

  // The flame: soft outer plume, hot core and a glow in the throat.
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#ffa53a',
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: '#fff3c4',
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const plume = (R: number, L: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const s = i / 16;
      pts.push(
        v2(
          Math.max(1e-4, R * Math.pow(1 - s, 0.9) * (1 + 1.2 * s * (1 - s))),
          s * L,
        ),
      );
    }
    return fade(new THREE.LatheGeometry(pts, 24).rotateX(-Math.PI / 2), L);
  };
  /** Bright at the nozzle, fading out (colour and alpha) to the tip. */
  const fade = (geo: THREE.BufferGeometry, L: number) => {
    const g = geo.toNonIndexed();
    g.deleteAttribute('uv');
    const p = g.getAttribute('position');
    const c = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const k = Math.pow(Math.max(0, 1 + p.getZ(i) / L), 0.9);
      c.set([k, k, k, k], i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 4));
    return g;
  };
  const flame = new THREE.Group();
  flame.add(new THREE.Mesh(plume(0.2, 0.85), flameMat));
  flame.add(
    new THREE.Mesh(
      merge([
        plume(0.1, 0.45),
        fade(
          new THREE.CircleGeometry(0.13, 24)
            .rotateY(Math.PI)
            .translate(0, 0, 0.1),
          1,
        ),
      ]),
      coreMat,
    ),
  );
  flame.position.z = -1.2;
  hull.add(flame);

  // Three legs that fold out to land: a bracket, strut, boot, piston, foot.
  const legs: THREE.Group[] = [];
  const bellows: Pt[] = [];
  for (let i = 0; i <= 10; i++)
    bellows.push([i % 2 ? 0.037 : 0.029, 0.3 + i * 0.005]);
  const pad: Pt[] = [
    [0, 0],
    [0.04, 0.005, 0.008],
    [0.09, 0.026, 0.01],
    [0.1, 0.036, 0.006],
    [0.1, 0.05, 0.004],
    [0, 0.052],
  ];
  for (const [a, z] of [
    [Math.PI - 0.75, -0.66],
    [Math.PI + 0.75, -0.66],
    [Math.PI, 0.26],
  ]) {
    const holder = new THREE.Group();
    holder.rotation.z = a;
    holder.position.z = z;
    const leg = new THREE.Group();
    leg.position.y = 0.3;
    const l = new Bins({ metal });
    l.add('metal', rbox(0.1, 0.1, 0.14, 0.02), '#4a4f5a', m4(0, 0.1, 0));
    l.add(
      'metal',
      cyl(0.022, 0.022, 0.13, 12),
      '#c9ced6',
      m4(0, 0.13, 0, 0, 0, Math.PI / 2),
    );
    l.add('metal', cyl(0.032, 0.028, 0.17, 14), '#6b717c', m4(0, 0.215, 0));
    l.add('metal', cyl(0.039, 0.039, 0.02, 16), '#8a919b', m4(0, 0.3, 0));
    l.add('metal', lathe(bellows, 14, 1), '#2f333b');
    l.add('metal', cyl(0.018, 0.018, 0.1, 12), '#e3e7ec', m4(0, 0.39, 0));
    l.add('metal', sphere(0.028, 12, 8), '#8a919b', m4(0, 0.43, 0));
    l.add(
      'metal',
      lathe(pad, 20, 2),
      (c) => (c.y > 0.038 ? '#2a2c31' : '#8a919b'),
      m4(0, 0.43, 0, 0, 0, Math.PI - a),
    );
    l.into(leg);
    holder.add(leg);
    hull.add(holder);
    legs.push(leg);
  }

  const kit = new Map<
    string,
    Upgrade & {
      mats: { m: THREE.Material; opacity: number; transparent: boolean }[];
    }
  >();
  let ghostId: string | null = null;
  let landed = 0;
  let thrust = 0;
  /** Bolt on the ship parts among `ids` (base modules are ignored). */
  const setKit = (ids: readonly string[], ghost: string | null = null) => {
    const want = new Set(ids.filter(onHull));
    if (ghost && onHull(ghost)) want.add(ghost);
    for (const id of want) {
      if (kit.has(id)) continue;
      const u = hullMakers[id]('ship');
      const mats: {
        m: THREE.Material;
        opacity: number;
        transparent: boolean;
      }[] = [];
      u.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.Material;
          mats.push({ m, opacity: m.opacity, transparent: m.transparent });
        }
      });
      hull.add(u.group);
      kit.set(id, { ...u, mats });
    }
    for (const [id, u] of kit) u.group.visible = want.has(id);
    const next = ghost && kit.has(ghost) && !ids.includes(ghost) ? ghost : null;
    if (ghostId !== next) {
      // Whatever was the ghost becomes solid again.
      const old = ghostId ? kit.get(ghostId) : null;
      old?.mats.forEach(({ m, opacity, transparent }) => {
        m.opacity = opacity;
        m.transparent = transparent;
        m.needsUpdate = true;
      });
      ghostId = next;
      kit.get(ghostId ?? '')?.mats.forEach(({ m }) => {
        m.transparent = true;
        m.needsUpdate = true;
      });
    }
  };

  return {
    group,
    setKit,
    setLanded: (v) => (landed = v),
    setThrust: (v) => (thrust = v),
    update(t, dt) {
      for (const leg of legs) {
        leg.scale.setScalar(Math.max(0.001, landed));
        leg.visible = landed > 0.02;
      }
      flame.visible = thrust > 0.02;
      flame.scale.set(
        1,
        1,
        thrust * (0.85 + 0.15 * Math.sin(t * 40) + 0.08 * Math.sin(t * 23)),
      );
      flameMat.opacity = 0.85 * Math.min(1, thrust * 1.5);
      hull.rotation.z = Math.sin(t * 1.3) * 0.03;
      for (const [id, u] of kit) {
        if (!u.group.visible) continue;
        u.update(t, dt);
        if (id === ghostId) {
          const a = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4));
          for (const { m } of u.mats) m.opacity = a;
        }
      }
    },
    dispose: () => disposeTree(group),
  };
}

/** The space a fully kitted ship fills, legs out (checked by scripts/alto-fit.mjs). */
export const shipBounds = new THREE.Box3(
  v3(-1.04, -0.85, -1.62),
  v3(1.04, 1.1, 1.47),
);
