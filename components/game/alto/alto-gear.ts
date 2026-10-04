import * as THREE from 'three';
import { m4 } from './alto-3d';
import {
  TAU,
  v3,
  sstep,
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
  link,
  grid,
  onBody,
  wrap,
  hullR,
  type Maker,
} from './alto-kit';

/**
 * The second wave of tools and gear that bolt onto the hull (Robot Arm,
 * Cutter, Trailer, Magnet, Sidecar, Cooler). Each maker builds its object
 * at its own fixed mount on the ship (`'ship'`), clear of every other mount,
 * or standing alone with a small prop for the shop (`'shop'`).
 *
 * Mounts, in hull units (z from the tail at −1 to the nose at 1, +x right):
 * the Robot Arm hangs from a bracket low on the right flank by the nose and
 * the Cutter from one on the left; the Sidecar rides outboard on struts low
 * on the right and the Cooler, in its rack, on the left; the Magnet swings
 * under the rear belly between the back legs; the Trailer is towed behind
 * and below the tail, under the engine's flame.
 *
 * Parts that move together are merged per material; the arm's reach and grip
 * and the dog's ears are morph targets on those merged meshes, so each
 * object stays at a handful of draws.
 */

const DARK = '#3b3f48';
const GUN = '#4a4f5a';
const STEEL = '#c9d0d8';
const BOLT = '#8a919b';
const RUBBER = '#25282e';
const CHROME = '#e6eaef';
const X = v3(1, 0, 0);
/** A plain box, for details too small to show a bevel. */
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const UP = v3(0, 1, 0);
const Z = v3(0, 0, 1);

// ——— Helpers ———

/** A matrix whose +X runs along `x` and +Y as near `y` as it can, at `at`. */
function basis(x: THREE.Vector3, y: THREE.Vector3, at: THREE.Vector3) {
  const bx = x.clone().normalize();
  const bz = v3().crossVectors(bx, y).normalize();
  const by = v3().crossVectors(bz, bx);
  return new THREE.Matrix4().makeBasis(bx, by, bz).setPosition(at);
}
/** A direction in the YZ plane, `a` from +Y towards +Z, and its normal. */
const dirYZ = (a: number) => v3(0, Math.cos(a), Math.sin(a));
const perpYZ = (a: number) => v3(0, -Math.sin(a), Math.cos(a));
/** A ring sector from angle a0 to a1 (counter-clockwise), radii r0…r1. */
function sector(r0: number, r1: number, a0: number, a1: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  s.closePath();
  return s;
}
function polygon(pts: [number, number][]) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    if (i) s.lineTo(x, y);
    else s.moveTo(x, y);
  });
  s.closePath();
  return s;
}
function hexNut(r: number, hole: number) {
  const s = polygon(
    Array.from({ length: 6 }, (_, k): [number, number] => [
      r * Math.cos((k * Math.PI) / 3),
      r * Math.sin((k * Math.PI) / 3),
    ]),
  );
  s.holes.push(new THREE.Path().absarc(0, 0, hole, 0, TAU, true));
  return s;
}
/** A saddle plate bent onto the hull with a bolt at each corner. */
function saddle(
  b: Bins,
  a: number,
  z: number,
  w: number,
  l: number,
  colour = GUN,
  at = new THREE.Matrix4(),
) {
  b.add(
    'paint',
    wrap(
      extrude(roundRect(w, l, Math.min(w, l) * 0.25), 0.012, 0.004, 1),
      hullR,
      a,
      z,
      0.006,
    ),
    colour,
    at,
  );
  for (const [u, s] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const zz = z + s * (l / 2 - 0.018);
    b.add(
      'metal',
      dome(0.0075, 6, 2),
      BOLT,
      at
        .clone()
        .multiply(
          onBody(hullR, a - (u * (w / 2 - 0.018)) / hullR(zz), zz, 0.018),
        )
        .multiply(m4(0, 0, 0, Math.PI / 2, 0, 0)),
    );
  }
}
/** The angle round the hull (0 on top, + to the right) where it is at height y. */
const flankAt = (z: number, y: number, side: number) =>
  side * Math.acos(Math.max(-1, y / hullR(z)));
const hullPoint = (a: number, z: number, lift = 0) => {
  const r = hullR(z) + lift;
  return v3(r * Math.sin(a), r * Math.cos(a), z);
};

/** Parts built in several poses and merged per material, the later poses kept
 * as morph targets on the first, so one mesh per material can move. Returns a
 * setter for the morph weights. */
function posed(
  mats: Record<string, THREE.Material>,
  poses: number,
  build: (b: Bins, pose: number) => void,
  target: THREE.Object3D,
) {
  const sets: THREE.Mesh[][] = [];
  for (let k = 0; k <= poses; k++) {
    const b = new Bins(mats);
    build(b, k);
    const g = new THREE.Group();
    b.into(g);
    sets.push(g.children as THREE.Mesh[]);
  }
  const meshes = sets[0].map((base, i) => {
    const geo = base.geometry;
    const p0 = geo.getAttribute('position').array;
    const n0 = geo.getAttribute('normal').array;
    const dp: THREE.BufferAttribute[] = [];
    const dn: THREE.BufferAttribute[] = [];
    for (let k = 1; k <= poses; k++) {
      const g = sets[k][i].geometry;
      const p = g.getAttribute('position').array;
      const n = g.getAttribute('normal').array;
      const a = new Float32Array(p0.length);
      const c = new Float32Array(n0.length);
      for (let j = 0; j < a.length; j++) {
        a[j] = p[j] - p0[j];
        c[j] = n[j] - n0[j];
      }
      dp.push(new THREE.BufferAttribute(a, 3));
      dn.push(new THREE.BufferAttribute(c, 3));
      g.dispose();
    }
    geo.morphAttributes.position = dp;
    geo.morphAttributes.normal = dn;
    geo.morphTargetsRelative = true;
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, base.material);
    target.add(mesh);
    return mesh;
  });
  return (w: readonly number[]) => {
    for (const m of meshes) {
      const inf = m.morphTargetInfluences;
      if (inf) for (let k = 0; k < w.length; k++) inf[k] = w[k];
    }
  };
}

/** A small wooden crate with battens on its edges. */
function crate(b: Bins, at: THREE.Matrix4, s: number) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  const batten = '#8f5d31';
  b.add(
    'paint',
    rbox(s * 0.92, s * 0.92, s * 0.92, s * 0.04, 1),
    '#c58e55',
    at,
  );
  const t = s * 0.14;
  const e = s / 2 - t / 2;
  for (const [p, q] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    b.add('paint', rbox(t, t, s, t * 0.3, 1), batten, A(m4(p * e, q * e, 0)));
    b.add('paint', rbox(s, t, t, t * 0.3, 1), batten, A(m4(0, p * e, q * e)));
    b.add('paint', rbox(t, s, t, t * 0.3, 1), batten, A(m4(p * e, 0, q * e)));
  }
  const len = Math.SQRT2 * (s - 2 * t);
  for (let k = 0; k < 4; k++)
    b.add(
      'paint',
      rbox(len, t * 0.8, t * 0.4, t * 0.2, 1),
      batten,
      A(
        m4(0, 0, 0, 0, (k * Math.PI) / 2, 0).multiply(
          m4(0, 0, s * 0.47, 0, 0, Math.PI / 4),
        ),
      ),
    );
}

/** A tyre on a pressed rim with a hub cap and lug nuts, its axle along X. */
function wheel(
  b: Bins,
  at: THREE.Matrix4,
  r: number,
  w: number,
  rim: string,
  out = 1,
) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  b.add(
    'paint',
    lathe(
      [
        [r * 0.6, -w / 2],
        [r * 0.9, -w / 2, w * 0.25],
        [r, -w * 0.3, w * 0.25],
        [r, w * 0.3, w * 0.25],
        [r * 0.9, w / 2, w * 0.25],
        [r * 0.6, w / 2],
      ],
      22,
      1,
    ).rotateZ(-Math.PI / 2),
    (c) => (Math.hypot(c.y, c.z) > r * 0.97 ? '#30333a' : RUBBER),
    at,
  );
  b.add(
    'metal',
    lathe(
      [
        [0, -w * 0.36],
        [r * 0.62, -w * 0.36],
        [r * 0.62, w * 0.3, 0.004],
        [r * 0.5, w * 0.36, 0.004],
        [0, w * 0.36],
      ],
      20,
      1,
    ).rotateZ((-out * Math.PI) / 2),
    rim,
    at,
  );
  b.add(
    'metal',
    lathe(
      [
        [0, 0],
        [r * 0.24, 0, 0.004],
        [r * 0.2, r * 0.14, 0.006],
        [0, r * 0.17],
      ],
      16,
      2,
    ).rotateZ((-out * Math.PI) / 2),
    CHROME,
    A(m4((out * w) / 2 - out * 0.002, 0, 0)),
  );
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.4;
    b.add(
      'metal',
      cyl(r * 0.05, r * 0.05, 0.006, 6).rotateZ(Math.PI / 2),
      BOLT,
      A(
        m4(
          (out * w) / 2 - out * 0.002,
          Math.cos(a) * r * 0.36,
          Math.sin(a) * r * 0.36,
        ),
      ),
    );
  }
}

// ——— Robot Arm ———

const YELLOW = '#f4b62c';
const YELLOW_D = '#d6951c';
type ArmPose = { a1: number; a2: number; a3: number; open: number };
const ARM = { shoulder: 0.11, upper: 0.17, fore: 0.14 };

/** The arm's fixed foot: a bolted plate and the slewing ring, facing +Y. */
function armFoot(b: Bins, at: THREE.Matrix4) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  b.add(
    'paint',
    extrude(roundRect(0.13, 0.13, 0.028), 0.012, 0.004, 1).rotateX(Math.PI / 2),
    GUN,
    A(m4(0, 0.008, 0)),
  );
  for (const [x, z] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ])
    b.add('metal', dome(0.008, 6, 2), BOLT, A(m4(x * 0.048, 0.018, z * 0.048)));
  b.add(
    'paint',
    lathe(
      [
        [0.04, 0.012],
        [0.064, 0.014, 0.004],
        [0.064, 0.028, 0.004],
        [0.04, 0.03],
      ],
      28,
      2,
    ),
    DARK,
    at,
  );
}

/** The arm from its turret up: shoulder, two links, wrist and a three-finger
 * gripper, in the YZ plane of `at` (its base on the XZ plane). */
function armParts(b: Bins, p: ArmPose, at: THREE.Matrix4, load: boolean) {
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  const S = v3(0, ARM.shoulder, 0);
  const d1 = dirYZ(p.a1);
  const n1 = perpYZ(p.a1);
  const d2 = dirYZ(p.a2);
  const n2 = perpYZ(p.a2);
  const d3 = dirYZ(p.a3);
  const E = S.clone().addScaledVector(d1, ARM.upper);
  const W = E.clone().addScaledVector(d2, ARM.fore);
  // The turret, with its yoke.
  b.add(
    'paint',
    lathe(
      [
        [0, 0.026],
        [0.058, 0.026, 0.006],
        [0.058, 0.04, 0.004],
        [0.05, 0.062, 0.012],
        [0.04, 0.072, 0.004],
        [0, 0.072],
      ],
      28,
      3,
    ),
    YELLOW,
    at,
  );
  const cheek = extrude(link(ARM.shoulder - 0.045, 0.036, 0.034), 0.014, 0.005);
  for (const s of [-1, 1])
    b.add('paint', cheek, YELLOW, A(basis(UP, Z, v3(s * 0.046, 0.045, 0))));
  b.add(
    'metal',
    cyl(0.016, 0.016, 0.13, 12).rotateZ(Math.PI / 2),
    STEEL,
    A(m4(0, S.y, 0)),
  );
  for (const s of [-1, 1])
    b.add(
      'metal',
      lathe(
        [
          [0, 0],
          [0.026, 0, 0.004],
          [0.024, 0.01, 0.005],
          [0, 0.013],
        ],
        18,
        2,
      ).rotateZ((-s * Math.PI) / 2),
      BOLT,
      A(m4(s * 0.064, S.y, 0)),
    );
  // A drive motor on the yoke's outer side.
  b.add(
    'paint',
    latheZ(
      [
        [0, -0.02],
        [0.026, -0.02, 0.006],
        [0.026, 0.02, 0.006],
        [0, 0.02],
      ],
      20,
      2,
    ).rotateY(Math.PI / 2),
    DARK,
    A(m4(-0.075, S.y - 0.03, -0.012)),
  );
  // The upper arm: a rounded link with inset side panels and a hose.
  const upper = extrude(link(ARM.upper, 0.036, 0.03), 0.05, 0.008, 2, 12);
  b.add('paint', upper, YELLOW, A(basis(d1, n1, S)));
  const panel = (len: number, hgt: number) =>
    extrude(roundRect(len, hgt, hgt * 0.45, len * 0.55, 0), 0.004, 0.0015, 1);
  const up = panel(ARM.upper * 0.5, 0.032);
  for (const s of [-1, 1])
    b.add(
      'paint',
      up,
      YELLOW_D,
      A(basis(d1, n1, S.clone().addScaledVector(X, s * 0.0345))),
    );
  // A black-and-yellow warning tag on the outer side.
  const tagAt = S.clone()
    .addScaledVector(d1, ARM.upper * 0.3)
    .addScaledVector(X, -0.037);
  b.add(
    'paint',
    box(0.003, 0.02, 0.036),
    '#2a2c31',
    A(basis(n1, d1, tagAt)).multiply(m4(0, 0, 0, 0, Math.PI / 2, 0)),
  );
  for (const k of [-1, 0, 1])
    b.add(
      'paint',
      box(0.004, 0.006, 0.02),
      YELLOW,
      A(
        basis(
          d1,
          n1,
          tagAt
            .clone()
            .addScaledVector(d1, k * 0.011)
            .addScaledVector(X, -0.0015),
        ),
      ).multiply(m4(0, 0, 0, 0, 0, 0.7)),
    );
  b.add(
    'paint',
    tube(
      [
        S.clone().addScaledVector(n1, 0.04).addScaledVector(d1, -0.035),
        S.clone()
          .addScaledVector(n1, 0.05)
          .addScaledVector(d1, ARM.upper * 0.4),
        E.clone().addScaledVector(n1, 0.042).addScaledVector(d1, -0.01),
        E.clone().addScaledVector(n2, 0.032).addScaledVector(d2, 0.04),
      ],
      0.0065,
      18,
      6,
    ),
    RUBBER,
    at,
  );
  for (const s of [0.25, 0.7])
    b.add(
      'metal',
      rbox(0.022, 0.012, 0.014, 0.004, 1),
      STEEL,
      A(
        basis(
          d1,
          n1,
          S.clone()
            .addScaledVector(d1, ARM.upper * s)
            .addScaledVector(n1, 0.042),
        ),
      ),
    );
  // The elbow: a motor drum across the joint.
  b.add(
    'paint',
    cyl(0.031, 0.031, 0.082, 20).rotateZ(Math.PI / 2),
    GUN,
    A(m4(E.x, E.y, E.z)),
  );
  for (const s of [-1, 1])
    b.add(
      'metal',
      dome(0.02, 14, 4).rotateZ((-s * Math.PI) / 2),
      STEEL,
      A(m4(s * 0.041, E.y, E.z)),
    );
  // The forearm.
  b.add(
    'paint',
    extrude(link(ARM.fore, 0.027, 0.021), 0.04, 0.007, 2, 12),
    YELLOW,
    A(basis(d2, n2, E)),
  );
  const fp = panel(ARM.fore * 0.45, 0.022);
  for (const s of [-1, 1])
    b.add(
      'paint',
      fp,
      YELLOW_D,
      A(basis(d2, n2, E.clone().addScaledVector(X, s * 0.0285))),
    );
  // The wrist and the gripper.
  b.add(
    'paint',
    cyl(0.022, 0.022, 0.058, 16).rotateZ(Math.PI / 2),
    GUN,
    A(m4(W.x, W.y, W.z)),
  );
  b.add(
    'paint',
    cyl(0.023, 0.026, 0.036, 16),
    GUN,
    A(aim(W.clone().addScaledVector(d3, 0.02), d3)),
  );
  b.add(
    'metal',
    lathe(
      [
        [0, 0],
        [0.033, 0, 0.003],
        [0.033, 0.01, 0.003],
        [0.03, 0.012],
        [0.03, 0.03, 0.004],
        [0, 0.03],
      ],
      24,
      2,
    ),
    STEEL,
    A(aim(W.clone().addScaledVector(d3, 0.038), d3)),
  );
  const P0 = W.clone().addScaledVector(d3, 0.068);
  const w = v3().crossVectors(d3, X);
  for (let k = 0; k < 3; k++) {
    const psi = Math.PI / 2 + (k * TAU) / 3;
    const rr = X.clone()
      .multiplyScalar(Math.cos(psi))
      .addScaledVector(w, Math.sin(psi));
    const tt = v3().crossVectors(d3, rr);
    const H = P0.clone().addScaledVector(rr, 0.019);
    const f = d3
      .clone()
      .multiplyScalar(Math.cos(p.open))
      .addScaledVector(rr, Math.sin(p.open));
    const be = p.open - 0.72;
    const f2 = d3
      .clone()
      .multiplyScalar(Math.cos(be))
      .addScaledVector(rr, Math.sin(be));
    const inward = d3
      .clone()
      .multiplyScalar(Math.sin(be))
      .addScaledVector(rr, -Math.cos(be));
    const J = H.clone().addScaledVector(f, 0.044);
    b.add(
      'paint',
      rbox(0.022, 0.016, 0.016, 0.004, 1),
      GUN,
      A(basis(tt, d3, H)),
    );
    b.add(
      'metal',
      rbox(0.017, 0.046, 0.011, 0.004, 1),
      STEEL,
      A(basis(tt, f, H.clone().addScaledVector(f, 0.022))),
    );
    b.add('paint', cyl(0.0075, 0.0075, 0.022, 10), GUN, A(basis(f, tt, J)));
    b.add(
      'metal',
      rbox(0.015, 0.034, 0.01, 0.004, 1),
      STEEL,
      A(basis(tt, f2, J.clone().addScaledVector(f2, 0.017))),
    );
    b.add(
      'paint',
      rbox(0.013, 0.024, 0.005, 0.002, 1),
      RUBBER,
      A(
        basis(
          tt,
          f2,
          J.clone().addScaledVector(f2, 0.019).addScaledVector(inward, 0.006),
        ),
      ),
    );
  }
  if (load)
    crate(b, A(basis(X, d3, P0.clone().addScaledVector(d3, 0.062))), 0.064);
}

const robotArm: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const ship = where === 'ship';
  const fixed = new Bins(mats);
  const arm = new THREE.Group();
  const yaw = new THREE.Group();
  arm.add(yaw);
  group.add(arm);
  if (ship) {
    // A bracket under the right flank by the nose; the arm hangs from it.
    const z = 0.14;
    const yB = -0.355;
    const a = flankAt(z, yB, 1);
    const root = hullPoint(a, z);
    saddle(fixed, a, z, 0.09, 0.13);
    fixed.add(
      'paint',
      rbox(0.6 - root.x + 0.02, 0.04, 0.07, 0.012, 2),
      GUN,
      m4((root.x - 0.02 + 0.6) / 2, yB, z),
    );
    fixed.add(
      'paint',
      extrude(
        polygon([
          [root.x - 0.025, -0.36],
          [root.x + 0.11, -0.372],
          [0.13, -0.435],
        ]),
        0.014,
        0.004,
      ),
      GUN,
      m4(0, 0, z),
    );
    for (const x of [0.47, 0.57])
      for (const s of [-1, 1])
        fixed.add(
          'metal',
          dome(0.007, 6, 2),
          BOLT,
          m4(x, yB + 0.02, z + s * 0.025),
        );
    armFoot(fixed, m4(0.52, -0.375, z, 0, 0, Math.PI));
    arm.position.set(0.52, -0.375, z);
    arm.rotation.z = Math.PI;
  } else {
    // A round plinth with a hazard ring.
    fixed.add(
      'paint',
      lathe(
        [
          [0, -0.05],
          [0.15, -0.05, 0.01],
          [0.155, -0.02, 0.008],
          [0.14, 0, 0.004],
          [0, 0],
        ],
        36,
        3,
      ),
      (c) => {
        const r = Math.hypot(c.x, c.z);
        if (r < 0.142 || c.y < -0.045) return '#5a606b';
        const k = Math.floor(((Math.atan2(c.z, c.x) + Math.PI) / TAU) * 18);
        return k % 2 ? '#2a2c31' : YELLOW;
      },
    );
    armFoot(fixed, m4());
  }
  fixed.into(group);
  // The moving arm: its pose and grip are morph targets.
  const poses: ArmPose[] = ship
    ? [
        { a1: 1.28, a2: 0.32, a3: 0.12, open: 0.14 },
        { a1: 1.1, a2: 0.62, a3: 0.45, open: 0.14 },
        { a1: 1.28, a2: 0.32, a3: 0.12, open: 0.55 },
      ]
    : [
        { a1: 0.42, a2: 2.0, a3: Math.PI - 0.04, open: 0.46 },
        { a1: 0.3, a2: 1.8, a3: Math.PI - 0.1, open: 0.46 },
        { a1: 0.42, a2: 2.0, a3: Math.PI - 0.04, open: 0.5 },
      ];
  const morph = posed(
    mats,
    2,
    (b, k) => armParts(b, poses[k], m4(), !ship),
    yaw,
  );
  return {
    group,
    update: (t) => {
      yaw.rotation.y = Math.sin(t * 0.55) * (ship ? 0.14 : 0.35);
      const reach = 0.5 + 0.5 * Math.sin(t * 0.8);
      const grip = ship ? sstep(-0.2, 0.7, Math.sin(t * 1.25)) : 0;
      morph([reach, grip]);
    },
  };
};

// ——— Cutter ———

const TEAL = '#2a9d8f';
const TEAL_D = '#1f7a70';

/** The saw's blade: toothed, with slots and a painted ring so it reads spinning. */
function bladeParts(b: Bins) {
  const R = 0.1;
  const n = 30;
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const st = TAU / n;
    const pts: [number, number][] = [
      [R, a],
      [R - 0.013, a + st * 0.7],
      [R - 0.011, a + st * 0.88],
    ];
    for (const [r, q] of pts) {
      if (i === 0 && r === R) s.moveTo(r * Math.cos(q), r * Math.sin(q));
      else s.lineTo(r * Math.cos(q), r * Math.sin(q));
    }
  }
  s.closePath();
  s.holes.push(new THREE.Path().absarc(0, 0, 0.011, 0, TAU, true));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.3;
    s.holes.push(
      new THREE.Path().absarc(
        Math.cos(a) * 0.072,
        Math.sin(a) * 0.072,
        0.0055,
        0,
        TAU,
        true,
      ),
    );
  }
  const geo = extrude(s, 0.004, 0.0008, 1, 8).rotateY(-Math.PI / 2);
  b.add('metal', geo, (c) => {
    const r = Math.hypot(c.y, c.z);
    if (r > R - 0.009) return '#8f98a3';
    const a = Math.atan2(c.y, c.z);
    if (
      r > 0.036 &&
      r < 0.058 &&
      ((a > 0.2 && a < 1.4) || (a < -1.9 && a > -3.1))
    )
      return '#e9a23b';
    return '#e3e8ed';
  });
  for (const s2 of [-1, 1]) {
    b.add(
      'metal',
      lathe(
        [
          [0.011, 0],
          [0.024, 0, 0.002],
          [0.024, 0.004, 0.002],
          [0.011, 0.005],
        ],
        20,
        1,
      ).rotateZ((-s2 * Math.PI) / 2),
      STEEL,
      m4(s2 * 0.002, 0, 0),
    );
  }
  b.add(
    'metal',
    cyl(0.013, 0.013, 0.008, 6).rotateZ(Math.PI / 2),
    BOLT,
    m4(-0.01, 0, 0),
  );
  b.add(
    'metal',
    cyl(0.007, 0.007, 0.03, 10).rotateZ(Math.PI / 2),
    STEEL,
    m4(0, 0, 0),
  );
}

/** The saw round its blade: guards, motor, handle, shoe (blade axis along X,
 * the motor on +X, the front +Z). */
function sawParts(b: Bins, shoe: boolean) {
  const th0 = -0.3;
  const th1 = Math.PI + 0.3;
  const side = extrude(
    sector(0.03, 0.123, th0, th1),
    0.005,
    0.0015,
    1,
    24,
  ).rotateY(-Math.PI / 2);
  for (const s of [-1, 1]) b.add('paint', side, TEAL, m4(s * 0.02, 0, 0));
  b.add(
    'paint',
    extrude(sector(0.112, 0.124, th0, th1), 0.038, 0.003, 1, 28).rotateY(
      -Math.PI / 2,
    ),
    TEAL_D,
  );
  // A rotation arrow on the outer guard.
  b.add(
    'paint',
    extrude(sector(0.08, 0.091, 0.62, 2.35), 0.002, 0, 1, 16).rotateY(
      -Math.PI / 2,
    ),
    '#ffd23f',
    m4(-0.0245, 0, 0),
  );
  const ah = (r: number, a: number): [number, number] => [
    r * Math.cos(a),
    r * Math.sin(a),
  ];
  b.add(
    'paint',
    extrude(
      polygon([ah(0.0855, 0.32), ah(0.1, 0.64), ah(0.071, 0.64)]),
      0.002,
      0,
      1,
    ).rotateY(-Math.PI / 2),
    '#ffd23f',
    m4(-0.0245, 0, 0),
  );
  b.add(
    'paint',
    cyl(0.009, 0.009, 0.004, 16).rotateZ(Math.PI / 2),
    '#2a2c31',
    m4(-0.025, 0, 0),
  );
  // The lower guard, steel, swung back.
  b.add(
    'metal',
    extrude(
      sector(0.104, 0.112, th1 + 0.04, th1 + 1.05),
      0.028,
      0.002,
      1,
      12,
    ).rotateY(-Math.PI / 2),
    '#b5bcc5',
  );
  b.add(
    'metal',
    box(0.006, 0.03, 0.012),
    '#b5bcc5',
    m4(-0.017, -0.105, -0.045, 0.4, 0, 0),
  );
  // A dust port out of the back of the guard.
  const dp = 2.45;
  const dir = v3(0, Math.sin(dp), Math.cos(dp));
  b.add(
    'paint',
    lathe(
      [
        [0.012, 0],
        [0.019, 0, 0.003],
        [0.019, 0.04, 0.003],
        [0.014, 0.042],
        [0.012, 0.03],
      ],
      18,
      2,
    ),
    TEAL_D,
    aim(dir.clone().multiplyScalar(0.11), dir),
  );
  // The motor, coaxial, with vents, a band and an end cap.
  b.add(
    'paint',
    lathe(
      [
        [0, 0.02],
        [0.05, 0.02, 0.006],
        [0.052, 0.088, 0.01],
        [0.046, 0.112, 0.01],
        [0, 0.114],
      ],
      28,
      3,
    ).rotateZ(-Math.PI / 2),
    (c) => (c.x > 0.1 ? '#2f333b' : TEAL),
    m4(0, 0.022, -0.004),
  );
  b.add(
    'paint',
    lathe(
      [
        [0.05, 0],
        [0.0535, 0.002],
        [0.0535, 0.014],
        [0.05, 0.016],
      ],
      28,
      1,
    ).rotateZ(-Math.PI / 2),
    '#f3ead7',
    m4(0.042, 0.022, -0.004),
  );
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU;
    b.add(
      'paint',
      box(0.022, 0.006, 0.004),
      '#1d2026',
      m4(
        0.084,
        0.022 + Math.sin(a) * 0.0505,
        -0.004 + Math.cos(a) * 0.0505,
        -a,
        0,
        0,
      ),
    );
  }
  // The gear housing and the D-handle on top, a trigger, a front knob.
  b.add(
    'paint',
    rbox(0.05, 0.05, 0.11, 0.016, 2),
    TEAL,
    m4(0.044, 0.07, -0.01),
  );
  const loop = [
    v3(0.036, 0.085, -0.075),
    v3(0.036, 0.145, -0.08),
    v3(0.036, 0.168, -0.035),
    v3(0.036, 0.166, 0.03),
    v3(0.036, 0.135, 0.07),
    v3(0.036, 0.09, 0.058),
  ];
  b.add('paint', tube(loop, 0.012, 24, 8), TEAL);
  b.add(
    'paint',
    tube(
      [
        v3(0.036, 0.163, -0.05),
        v3(0.036, 0.17, -0.01),
        v3(0.036, 0.166, 0.028),
      ],
      0.0145,
      10,
      8,
    ),
    RUBBER,
  );
  b.add(
    'paint',
    rbox(0.012, 0.022, 0.012, 0.004, 1),
    '#e24a33',
    m4(0.036, 0.143, -0.02, 0.3, 0, 0),
  );
  b.add(
    'metal',
    rod(0.006, v3(0.06, 0.03, 0.04), v3(0.07, 0.05, 0.1), 8),
    STEEL,
  );
  b.add(
    'paint',
    sphere(0.018, 14, 10),
    RUBBER,
    m4(0.072, 0.054, 0.108, 0, 0, 0, [1, 0.85, 1]),
  );
  if (shoe) {
    b.add(
      'metal',
      rbox(0.04, 0.008, 0.27, 0.003, 1),
      STEEL,
      m4(-0.027, -0.042, 0),
    );
    b.add(
      'metal',
      rbox(0.065, 0.008, 0.27, 0.003, 1),
      STEEL,
      m4(0.04, -0.042, 0),
    );
    b.add(
      'metal',
      rbox(0.11, 0.006, 0.03, 0.003, 1),
      STEEL,
      m4(0.008, -0.042, 0.125),
    );
    b.add(
      'paint',
      rbox(0.008, 0.035, 0.012, 0.003, 1),
      '#e24a33',
      m4(0.075, -0.024, -0.1, 0, 0, 0.2),
    );
  }
}

const cutter: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const ship = where === 'ship';
  const saw = new THREE.Group();
  const s = new Bins(mats);
  sawParts(s, ship);
  const blade = new THREE.Group();
  const bb = new Bins(mats);
  bladeParts(bb);
  bb.into(blade);
  saw.add(blade);
  if (ship) {
    // Hung under a bracket on the left flank by the nose.
    const z = 0.29;
    const yB = -0.355;
    const a = flankAt(z, yB, -1);
    const root = hullPoint(a, z);
    const f = new Bins(mats);
    saddle(f, a, z, 0.09, 0.12);
    f.add(
      'paint',
      rbox(root.x + 0.62, 0.04, 0.07, 0.012, 2),
      GUN,
      m4((root.x + 0.02 - 0.6) / 2, yB, z),
    );
    f.add(
      'paint',
      extrude(
        polygon([
          [root.x + 0.025, -0.36],
          [root.x - 0.1, -0.372],
          [-0.12, -0.43],
        ]),
        0.014,
        0.004,
      ),
      GUN,
      m4(0, 0, z),
    );
    // A clamp block on the handle and a stay to the motor's end.
    f.add(
      'paint',
      rbox(0.04, 0.03, 0.06, 0.008, 1),
      GUN,
      m4(-0.547, -0.37, z - 0.004),
    );
    for (const s2 of [-1, 1])
      f.add(
        'metal',
        cyl(0.006, 0.006, 0.05, 8),
        STEEL,
        m4(-0.547 + s2 * 0.016, -0.375, z - 0.004 + 0.022),
      );
    f.add(
      'metal',
      rod(
        0.008,
        v3(-0.475, -0.36, z - 0.004),
        v3(-0.475, -0.535, z - 0.004),
        10,
      ),
      STEEL,
    );
    f.add(
      'metal',
      rbox(0.012, 0.03, 0.03, 0.004, 1),
      BOLT,
      m4(-0.472, -0.533, z - 0.004),
    );
    f.into(group);
    saw.position.set(-0.583, -0.555, z);
  } else {
    // A chop stand: a base with a slot, a post and an arm holding the saw over
    // a crystal it has just cut in two.
    const st = new Bins({
      ...mats,
      gem: new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.12,
        clearcoat: 1,
        emissive: '#7a3cff',
        emissiveIntensity: 0.18,
      }),
    });
    st.add(
      'paint',
      rbox(0.34, 0.04, 0.4, 0.014, 2),
      '#5a606b',
      m4(0, -0.02, 0),
    );
    st.add('paint', box(0.016, 0.004, 0.34), '#1d2026', m4(0, 0.0005, 0));
    for (const [x, z] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ])
      st.add(
        'paint',
        cyl(0.018, 0.022, 0.012, 14),
        RUBBER,
        m4(x * 0.14, -0.045, z * 0.165),
      );
    st.add(
      'paint',
      rbox(0.05, 0.25, 0.05, 0.012, 2),
      TEAL_D,
      m4(0.11, 0.125, -0.17),
    );
    st.add(
      'metal',
      cyl(0.02, 0.02, 0.07, 18).rotateZ(Math.PI / 2),
      STEEL,
      m4(0.11, 0.24, -0.17),
    );
    st.add(
      'paint',
      rbox(0.035, 0.035, 0.2, 0.01, 2),
      TEAL,
      m4(0.11, 0.2, -0.09, 0.42, 0, 0),
    );
    st.add(
      'metal',
      dome(0.022, 14, 4).rotateZ(-Math.PI / 2),
      BOLT,
      m4(0.147, 0.24, -0.17),
    );
    // The crystal, in two pieces either side of the blade.
    for (const k of [-1, 1]) {
      const piece = lathe(
        [
          [0, 0.006],
          [0.043, 0.006],
          [0.043, 0.08, 0.004],
          [0, 0.125],
        ],
        6,
        1,
      ).rotateZ((-k * Math.PI) / 2);
      st.add(
        'gem',
        piece,
        (_, nrm) =>
          Math.abs(nrm.x) > 0.95 && Math.abs(nrm.y) < 0.2
            ? '#efe2ff'
            : '#a77bea',
        m4(k * 0.012, 0.037, 0.02, Math.PI / 6, k * 0.12, 0),
      );
    }
    st.into(group);
    saw.position.set(0, 0.09, 0.02);
    saw.rotation.x = 0.06;
  }
  s.into(saw);
  group.add(saw);
  if (!ship) group.rotation.y = 0.35;
  return { group, update: (t) => (blade.rotation.x = t * 14) };
};

// ——— Trailer ———

const SAGE = '#6fa86a';
const SAGE_D = '#4f8a4c';
const TARP = '#cdb47e';

function trailerParts(b: Bins, jockey: boolean) {
  // The box body, pressed ribs and a capped rim.
  b.add('paint', rbox(0.32, 0.11, 0.38, 0.022, 2), SAGE, m4(0, 0.135, -0.01));
  for (const s of [-1, 1]) {
    b.add(
      'paint',
      rbox(0.014, 0.014, 0.4, 0.006, 1),
      SAGE_D,
      m4(s * 0.161, 0.188, -0.01),
    );
    for (const y of [0.112, 0.15])
      b.add('paint', box(0.006, 0.01, 0.32), SAGE_D, m4(s * 0.161, y, -0.01));
  }
  for (const z of [-0.2, 0.18]) {
    b.add('paint', rbox(0.33, 0.014, 0.014, 0.006, 1), SAGE_D, m4(0, 0.188, z));
  }
  // Wheels under mudguards, on leaf springs.
  for (const s of [-1, 1]) {
    wheel(b, m4(s * 0.195, 0.07, 0), 0.07, 0.04, '#d8dde3', s);
    b.add(
      'paint',
      extrude(
        sector(0.081, 0.09, 0.12, Math.PI - 0.12),
        0.05,
        0.003,
        1,
        16,
      ).rotateY(-Math.PI / 2),
      SAGE_D,
      m4(s * 0.195, 0.07, 0),
    );
    b.add(
      'paint',
      rbox(0.026, 0.012, 0.16, 0.004, 1),
      SAGE_D,
      m4(s * 0.17, 0.15, 0),
    );
    b.add(
      'metal',
      tube(
        [
          v3(s * 0.135, 0.079, -0.1),
          v3(s * 0.135, 0.064, 0),
          v3(s * 0.135, 0.079, 0.1),
        ],
        0.006,
        10,
        5,
      ),
      DARK,
    );
  }
  b.add(
    'metal',
    cyl(0.009, 0.009, 0.36, 10).rotateZ(Math.PI / 2),
    DARK,
    m4(0, 0.068, 0),
  );
  // Lamps and a number plate at the back.
  for (const s of [-1, 1]) {
    b.add(
      'lamp',
      rbox(0.045, 0.022, 0.012, 0.005, 1),
      '#ff4a3a',
      m4(s * 0.115, 0.165, -0.203),
    );
    b.add(
      'lamp',
      cyl(0.008, 0.008, 0.008, 12).rotateX(Math.PI / 2),
      '#ffa53a',
      m4(s * 0.115, 0.115, -0.203),
    );
  }
  b.add(
    'paint',
    rbox(0.1, 0.034, 0.006, 0.004, 1),
    '#f3ead7',
    m4(0, 0.128, -0.205),
  );
  for (const x of [-0.03, -0.01, 0.012, 0.032])
    b.add('paint', box(0.008, 0.018, 0.003), '#2a3150', m4(x, 0.128, -0.209));
  // The A-frame drawbar and the coupling head.
  const head = v3(0, 0.11, 0.37);
  for (const s of [-1, 1])
    b.add('metal', rod(0.011, v3(s * 0.12, 0.105, 0.17), head, 10), GUN);
  b.add('metal', rod(0.009, v3(0, 0.1, 0.17), head, 8), GUN);
  b.add(
    'paint',
    rbox(0.045, 0.036, 0.075, 0.012, 2),
    DARK,
    m4(0, 0.112, 0.385),
  );
  b.add(
    'metal',
    lathe(
      [
        [0, 0],
        [0.026, 0, 0.006],
        [0.02, 0.018, 0.008],
        [0, 0.022],
      ],
      16,
      2,
    ).rotateX(Math.PI),
    STEEL,
    m4(0, 0.095, 0.405),
  );
  b.add('metal', rod(0.005, v3(0, 0.13, 0.36), v3(0, 0.15, 0.41), 6), STEEL);
  b.add('paint', sphere(0.009, 10, 8), '#e24a33', m4(0, 0.152, 0.414));
  for (let k = 0; k < 3; k++)
    b.add(
      'metal',
      new THREE.TorusGeometry(0.009, 0.0025, 4, 10),
      BOLT,
      m4(
        0.02,
        0.095 - k * 0.012,
        0.35 - k * 0.004,
        0,
        k % 2 ? Math.PI / 2 : 0,
        0,
      ),
    );
  if (jockey) {
    // A jockey wheel to stand on, with a crank.
    b.add('metal', rbox(0.03, 0.04, 0.03, 0.006, 1), DARK, m4(0.05, 0.11, 0.3));
    b.add('metal', cyl(0.011, 0.011, 0.2, 12), STEEL, m4(0.05, 0.11, 0.3));
    b.add(
      'metal',
      rod(0.005, v3(0.05, 0.21, 0.3), v3(0.09, 0.215, 0.3), 6),
      STEEL,
    );
    b.add('paint', cyl(0.007, 0.007, 0.025, 8), RUBBER, m4(0.09, 0.225, 0.3));
    b.add(
      'metal',
      rbox(0.035, 0.03, 0.012, 0.004, 1),
      DARK,
      m4(0.05, 0.03, 0.3),
    );
    wheel(b, m4(0.05, 0.025, 0.3), 0.025, 0.018, STEEL);
  }
  // The tarp over the front of the load, tied down with ropes.
  const rows = 22;
  const cols = 34;
  const z0 = -0.07;
  const z1 = 0.19;
  const bump = (x: number, u: number) =>
    0.018 * Math.exp(-(((x + 0.06) / 0.05) ** 2) - ((u - 0.32) / 0.17) ** 2) +
    0.014 * Math.exp(-(((x - 0.065) / 0.05) ** 2) - ((u - 0.68) / 0.15) ** 2);
  const top = (x: number, u: number) => {
    const q = Math.min(1, Math.abs(x) / 0.17);
    const e = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.32);
    return (
      0.17 +
      e * Math.pow(1 - q ** 3, 0.42) * (0.024 + 0.05 * (1 - q * q) + bump(x, u))
    );
  };
  b.add(
    'paint',
    grid(rows, cols, (i, j) => {
      const u = i / (rows - 1);
      const z = z1 - (z1 - z0) * u;
      const phi = (j / cols) * TAU;
      const x = 0.17 * Math.cos(phi);
      return v3(x, Math.sin(phi) > 1e-6 ? top(x, u) : 0.17, z);
    }),
    (c) => (c.y < 0.2 ? '#b89d68' : TARP),
  );
  for (const u of [0.22, 0.78]) {
    const z = z1 - (z1 - z0) * u;
    const pts = [v3(-0.163, 0.155, z)];
    for (let k = 0; k <= 8; k++) {
      const x = -0.17 + (0.34 * k) / 8;
      pts.push(v3(x * 1.02, top(x, u) + 0.004, z));
    }
    pts.push(v3(0.163, 0.155, z));
    b.add('paint', tube(pts, 0.0045, 30, 5), '#e8a24a');
    for (const s of [-1, 1])
      b.add('metal', box(0.006, 0.012, 0.012), STEEL, m4(s * 0.164, 0.152, z));
  }
  // Behind the tarp: a crate and a red can.
  crate(b, m4(-0.07, 0.228, -0.14, 0, 0.15, 0), 0.075);
  b.add(
    'paint',
    rbox(0.05, 0.072, 0.075, 0.01, 2),
    '#d8453a',
    m4(0.07, 0.226, -0.14),
  );
  for (const s of [-1, 1]) {
    b.add(
      'paint',
      box(0.004, 0.006, 0.075),
      '#b8352c',
      m4(0.07 + s * 0.026, 0.226, -0.14, s * 0.75, 0, 0),
    );
  }
  b.add(
    'paint',
    tube(
      [
        v3(0.07, 0.262, -0.165),
        v3(0.07, 0.272, -0.15),
        v3(0.07, 0.272, -0.125),
      ],
      0.005,
      8,
      5,
    ),
    '#b8352c',
  );
  b.add(
    'paint',
    cyl(0.009, 0.01, 0.014, 10),
    '#f2c230',
    m4(0.07, 0.266, -0.11, 0.5, 0, 0),
  );
}

const trailer: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const ship = where === 'ship';
  const towed = new THREE.Group();
  const b = new Bins({
    ...mats,
    lamp: vmat({
      emissive: '#ff5a3a',
      emissiveIntensity: 0.55,
      roughness: 0.3,
    }),
  });
  trailerParts(b, !ship);
  const body = new THREE.Group();
  b.into(body);
  towed.add(body);
  group.add(towed);
  if (ship) {
    // A tow arm from under the tail to a ball; the trailer pivots on the ball.
    const f = new Bins(mats);
    const z = -0.84;
    saddle(f, Math.PI, z, 0.09, 0.12);
    const ball = v3(0, -0.47, -0.98);
    const top = v3(0, -hullR(z) + 0.01, z);
    const drop = v3(0, ball.y + 0.06, ball.z);
    f.add(
      'paint',
      rbox(0.04, 0.035, top.distanceTo(drop) + 0.03, 0.01, 2),
      GUN,
      aim(top.clone().lerp(drop, 0.5), drop.clone().sub(top)).multiply(
        m4(0, 0, 0, Math.PI / 2, 0, 0),
      ),
    );
    f.add(
      'paint',
      rbox(0.04, 0.05, 0.035, 0.008, 1),
      GUN,
      m4(0, ball.y + 0.04, ball.z + 0.005),
    );
    f.add(
      'metal',
      cyl(0.007, 0.007, 0.012, 8),
      STEEL,
      m4(0, ball.y + 0.012, ball.z),
    );
    f.add(
      'metal',
      sphere(0.017, 14, 10),
      CHROME,
      m4(ball.x, ball.y + 0.026, ball.z),
    );
    f.into(group);
    // The coupling's cup sits on the ball.
    towed.position.copy(ball).add(v3(0, 0.026, 0));
    body.position.set(0, -0.112, -0.405);
  } else {
    group.rotation.y = -1.3;
  }
  return {
    group,
    update: (t) => {
      if (!ship) return;
      towed.rotation.x = Math.sin(t * 1.7) * 0.02 + Math.sin(t * 2.9) * 0.008;
      towed.rotation.y = Math.sin(t * 0.8) * 0.05;
      towed.rotation.z = Math.sin(t * 1.3) * 0.02;
    },
  };
};

// ——— Magnet ———

const RED = '#d8392f';

function magnetParts(b: Bins) {
  const ro = 0.085;
  const ri = 0.04;
  const leg = -0.06;
  const s = new THREE.Shape();
  s.moveTo(ro, leg);
  s.lineTo(ro, 0);
  s.absarc(0, 0, ro, 0, Math.PI, false);
  s.lineTo(-ro, leg);
  s.lineTo(-ri, leg);
  s.lineTo(-ri, 0);
  s.absarc(0, 0, ri, Math.PI, 0, true);
  s.lineTo(ri, leg);
  s.closePath();
  b.add('paint', extrude(s, 0.062, 0.008, 2, 28), (c) =>
    c.y < leg + 0.004 ? '#b52a22' : RED,
  );
  // Silver pole tips, a white band and N / S marks.
  for (const k of [-1, 1]) {
    b.add(
      'metal',
      rbox(0.054, 0.036, 0.078, 0.008, 2),
      '#dfe4ea',
      m4(k * 0.0625, leg - 0.022, 0),
    );
    b.add(
      'paint',
      rbox(0.06, 0.006, 0.08, 0.002, 1),
      '#f6efe2',
      m4(k * 0.0625, leg - 0.001, 0),
    );
  }
  const ink = '#f6efe2';
  const zf = 0.04;
  b.add('paint', box(0.004, 0.022, 0.003), ink, m4(-0.072, -0.03, zf));
  b.add('paint', box(0.004, 0.022, 0.003), ink, m4(-0.053, -0.03, zf));
  b.add(
    'paint',
    box(0.004, 0.026, 0.003),
    ink,
    m4(-0.0625, -0.03, zf, 0, 0, 0.62),
  );
  b.add(
    'paint',
    tube(
      [
        v3(0.07, -0.02, zf),
        v3(0.062, -0.018, zf),
        v3(0.056, -0.025, zf),
        v3(0.068, -0.034, zf),
        v3(0.064, -0.042, zf),
        v3(0.055, -0.04, zf),
      ],
      0.0022,
      14,
      4,
    ),
    ink,
  );
  // A lug on top.
  b.add('metal', rbox(0.03, 0.03, 0.04, 0.008, 1), STEEL, m4(0, ro + 0.01, 0));
  b.add(
    'metal',
    cyl(0.007, 0.007, 0.046, 10).rotateX(Math.PI / 2),
    BOLT,
    m4(0, ro + 0.016, 0),
  );
  // Bits clinging to the poles: nuts, a bolt, a washer, two paper clips, a spanner.
  const nut = extrude(hexNut(0.014, 0.0065), 0.009, 0.0015, 1, 10);
  const yT = leg - 0.04;
  b.add(
    'metal',
    nut,
    '#b9c0c8',
    m4(0.07, yT - 0.006, 0.012, Math.PI / 2 + 0.2, 0, 0.3),
  );
  b.add(
    'metal',
    nut,
    '#9aa3ad',
    m4(0.052, yT - 0.004, -0.02, Math.PI / 2 - 0.3, 0.2, 0),
  );
  b.add(
    'metal',
    cyl(0.015, 0.015, 0.009, 6),
    '#b9c0c8',
    m4(-0.068, yT - 0.004, 0.005, 0.15, 0, 0.1),
  );
  const thread: [number, number][] = [[0, -0.0275]];
  for (let k = 0; k <= 16; k++)
    thread.push([k % 2 ? 0.0074 : 0.0062, -0.0275 + (0.055 * k) / 16]);
  thread.push([0, 0.0275]);
  b.add(
    'metal',
    lathe(thread, 10, 1),
    '#c9d0d8',
    m4(-0.07, yT - 0.035, 0.008, 0.15, 0, 0.18),
  );
  b.add(
    'metal',
    extrude(
      (() => {
        const w = new THREE.Shape().absarc(0, 0, 0.016, 0, TAU, false);
        w.holes.push(new THREE.Path().absarc(0, 0, 0.007, 0, TAU, true));
        return w;
      })(),
      0.003,
      0.001,
      1,
      16,
    ).rotateY(Math.PI / 2),
    '#d6dbe1',
    m4(0.0945, -0.082, -0.012, 0.4, 0, 0),
  );
  const clip = (at: THREE.Matrix4, colour: string) =>
    b.add(
      'metal',
      tube(
        [
          v3(0, 0, 0),
          v3(0, -0.026, 0),
          v3(0.006, -0.032, 0),
          v3(0.012, -0.026, 0),
          v3(0.012, -0.004, 0),
          v3(0.0065, 0.001, 0),
          v3(0.003, -0.004, 0),
          v3(0.003, -0.02, 0),
        ],
        0.0016,
        28,
        4,
      ),
      colour,
      at,
    );
  clip(m4(0.08, yT - 0.012, 0.03, 0, 0, 0.15), '#d6dbe1');
  clip(m4(0.084, yT - 0.042, 0.03, 0, 0.6, -0.2), '#e05a4a');
  // A little spanner stuck to the outside of the left leg.
  const deg = Math.PI / 180;
  const sp = new THREE.Shape();
  sp.moveTo(-0.04, -0.005);
  sp.lineTo(0.03, -0.005);
  sp.absarc(0.04, 0, 0.012, -150 * deg, -38 * deg, false);
  sp.lineTo(0.041, -0.0042);
  sp.lineTo(0.041, 0.0042);
  sp.absarc(0.04, 0, 0.012, 38 * deg, 150 * deg, false);
  sp.lineTo(-0.04, 0.005);
  sp.absarc(-0.047, 0, 0.011, 0.35 * Math.PI, 1.65 * Math.PI, false);
  sp.closePath();
  sp.holes.push(new THREE.Path().absarc(-0.047, 0, 0.0048, 0, TAU, true));
  b.add(
    'metal',
    extrude(sp, 0.004, 0.0012, 1, 12)
      .rotateZ(-Math.PI / 2 + 0.12)
      .rotateY(-Math.PI / 2),
    '#c2c9d1',
    m4(-0.0965, -0.036, 0.004, 0, 0, 0, 0.8),
  );
}

const magnet: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const ship = where === 'ship';
  const swing = new THREE.Group();
  const hold = new THREE.Group();
  const b = new Bins(mats);
  magnetParts(b);
  b.into(hold);
  swing.add(hold);
  group.add(swing);
  if (ship) {
    // Hung on a pivot under the rear belly, between the back legs.
    const z = -0.5;
    const f = new Bins(mats);
    saddle(f, Math.PI, z, 0.1, 0.12);
    const yb = -hullR(z);
    f.add('paint', rbox(0.06, 0.03, 0.05, 0.01, 2), GUN, m4(0, yb - 0.008, z));
    for (const s of [-1, 1])
      f.add(
        'paint',
        rbox(0.01, 0.03, 0.032, 0.004, 1),
        GUN,
        m4(s * 0.02, yb - 0.03, z),
      );
    f.into(group);
    swing.position.set(0, yb - 0.035, z);
    const a = new Bins(mats);
    a.add(
      'metal',
      cyl(0.007, 0.007, 0.052, 10).rotateZ(Math.PI / 2),
      STEEL,
      m4(),
    );
    a.add('metal', rbox(0.022, 0.05, 0.016, 0.006, 1), STEEL, m4(0, -0.024, 0));
    a.into(swing);
    hold.position.set(0, -0.052 - 0.105, 0);
    hold.rotation.y = 0.6;
  } else {
    hold.rotation.set(0.15, -0.25, 0);
    // A few more bits on a tray beneath.
    const t = new Bins(mats);
    t.add(
      'paint',
      rbox(0.26, 0.012, 0.16, 0.005, 2),
      '#5a606b',
      m4(0, -0.2, 0),
    );
    const nut = extrude(hexNut(0.014, 0.0065), 0.009, 0.0015, 1, 10).rotateX(
      Math.PI / 2,
    );
    for (const [x, z, r] of [
      [-0.08, 0.03, 0.3],
      [0.06, -0.04, 1.2],
      [0.09, 0.05, 2],
    ])
      t.add('metal', nut, '#b9c0c8', m4(x, -0.188, z, 0, r, 0));
    t.add(
      'metal',
      cyl(0.006, 0.006, 0.06, 10).rotateZ(Math.PI / 2),
      STEEL,
      m4(-0.02, -0.188, -0.03, 0, 0.5, 0),
    );
    t.add(
      'metal',
      cyl(0.013, 0.013, 0.008, 6).rotateZ(Math.PI / 2),
      BOLT,
      m4(-0.05, -0.188, -0.047, 0, 0.5, 0),
    );
    t.into(group);
  }
  return {
    group,
    update: (t) => {
      swing.rotation.x = Math.sin(t * 1.1) * 0.09 + Math.sin(t * 2.3) * 0.02;
      swing.rotation.z = Math.sin(t * 0.8 + 1) * 0.05;
      if (!ship) hold.rotation.y = -0.25 + Math.sin(t * 0.9) * 0.08;
    },
  };
};

// ——— Sidecar ———

const PLUM = '#a8344a';
const LEATHER = '#3a2a24';

const SC = {
  L: 0.54,
  W: 0.13,
  H: 0.1,
  n: 2.6,
  cz: -0.06,
  ca: 0.115,
  cb: 0.085,
};
const scF = (u: number) =>
  Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 1.2))), 0.5);
const scC = (u: number) => -0.015 * (1 - u);
const scU = (z: number) => Math.min(1, Math.max(0, (SC.L / 2 - z) / SC.L));
/** The tub's top surface height at (x, z), before the cockpit dips it. */
function scTop(x: number, z: number) {
  const u = scU(z);
  const w = SC.W * scF(u);
  const q = Math.min(1, Math.abs(x) / Math.max(1e-4, w));
  return scC(u) + SC.H * scF(u) * Math.pow(1 - q ** SC.n, 1 / SC.n);
}
const inCockpit = (x: number, z: number) =>
  (x / SC.cb) ** 2 + ((z - SC.cz) / SC.ca) ** 2;

function sidecarParts(b: Bins, glass: boolean) {
  const rows = 38;
  const cols = 34;
  const e = 2 / SC.n;
  b.add(
    'paint',
    grid(rows, cols, (i, j) => {
      const u = i / (rows - 1);
      const z = SC.L / 2 - SC.L * u;
      const phi = (j / cols) * TAU;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const w = SC.W * scF(u);
      const h = SC.H * scF(u);
      const x = w * Math.sign(c) * Math.pow(Math.abs(c), e);
      let y = scC(u) + h * Math.sign(s) * Math.pow(Math.abs(s), e);
      if (s > 0) y -= 0.075 * sstep(1, 0.5, inCockpit(x, z));
      return v3(x, y, z);
    }),
    (c, n) => (n.y > -0.2 && inCockpit(c.x, c.z) < 0.97 ? LEATHER : PLUM),
  );
  // The padded rim round the cockpit and a seat back.
  const rim: THREE.Vector3[] = [];
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * TAU;
    const x = SC.cb * Math.cos(a);
    const z = SC.cz + SC.ca * Math.sin(a);
    rim.push(v3(x, scTop(x, z) + 0.004, z));
  }
  b.add('paint', tube(rim, 0.011, 40, 6, true), '#2b211d');
  b.add(
    'paint',
    rbox(0.13, 0.075, 0.03, 0.014, 2),
    '#c79a62',
    m4(0, 0.045, SC.cz - 0.088, -0.3, 0, 0),
  );
  b.add(
    'paint',
    rbox(0.14, 0.02, 0.08, 0.01, 2),
    '#b3874f',
    m4(0, 0.02, SC.cz - 0.04),
  );
  // A chrome belt trim, the nose bumper, the headlamp and a grab rail.
  for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 14; k++) {
      const u = 0.1 + (0.82 * k) / 14;
      const f = scF(u);
      const z = SC.L / 2 - SC.L * u;
      pts.push(
        v3(s * (SC.W * f * 0.989 + 0.003), scC(u) + 0.25 * SC.H * f * 0.6, z),
      );
    }
    b.add('metal', tube(pts, 0.004, 28, 4), CHROME);
  }
  b.add(
    'metal',
    tube(
      [
        v3(-0.085, -0.035, 0.19),
        v3(-0.065, -0.035, 0.255),
        v3(0, -0.035, 0.292),
        v3(0.065, -0.035, 0.255),
        v3(0.085, -0.035, 0.19),
      ],
      0.008,
      24,
      6,
    ),
    CHROME,
  );
  for (const s of [-1, 1])
    b.add(
      'metal',
      rod(0.005, v3(s * 0.06, -0.035, 0.225), v3(s * 0.045, -0.035, 0.2), 6),
      STEEL,
    );
  const lz = 0.165;
  const ly = scTop(0, lz);
  b.add(
    'metal',
    rod(0.008, v3(0, ly - 0.01, lz), v3(0, ly + 0.02, lz + 0.005), 8),
    CHROME,
  );
  b.add(
    'metal',
    latheZ(
      [
        [0, -0.03],
        [0.012, -0.03, 0.006],
        [0.026, -0.004, 0.006],
        [0.028, 0.012, 0.003],
        [0.024, 0.016],
      ],
      20,
      2,
    ),
    CHROME,
    m4(0, ly + 0.032, lz + 0.01),
  );
  b.add(
    'glow',
    new THREE.CircleGeometry(0.024, 20),
    '#fff4d0',
    m4(0, ly + 0.032, lz + 0.024),
  );
  b.add(
    'metal',
    tube(
      [
        v3(-0.05, scTop(-0.05, -0.215) - 0.004, -0.215),
        v3(-0.04, scTop(0, -0.235) + 0.03, -0.235),
        v3(0.04, scTop(0, -0.235) + 0.03, -0.235),
        v3(0.05, scTop(0.05, -0.215) - 0.004, -0.215),
      ],
      0.0055,
      16,
      6,
    ),
    CHROME,
  );
  // The wheel, outboard, under a mudguard.
  wheel(b, m4(0.12, -0.105, -0.08), 0.062, 0.032, '#d8dde3', 1);
  b.add(
    'paint',
    extrude(
      sector(0.07, 0.077, 0.15, Math.PI - 0.15),
      0.044,
      0.003,
      1,
      16,
    ).rotateY(-Math.PI / 2),
    PLUM,
    m4(0.12, -0.105, -0.08),
  );
  b.add(
    'metal',
    rod(0.007, v3(0.12, -0.105, -0.08), v3(0.06, -0.075, -0.08), 8),
    DARK,
  );
  // The chassis rail on the inboard side.
  b.add(
    'metal',
    rbox(0.022, 0.022, 0.34, 0.006, 1),
    GUN,
    m4(-0.105, -0.075, -0.06),
  );
  // The windscreen, curved round the front of the cockpit, in a chrome frame.
  const sz = SC.cz;
  const sy = scTop(0, SC.cz + SC.ca + 0.013) - 0.008;
  const r = SC.ca + 0.013;
  const hgt = 0.062;
  const scr = new THREE.Matrix4()
    .makeTranslation(0, sy, sz)
    .multiply(m4(0, 0, 0, -0.38, 0, 0, [0.8, 1, 1]));
  const t0 = -1.2;
  const t1 = 2.4;
  if (glass)
    b.add(
      'glass',
      new THREE.CylinderGeometry(r, r, hgt, 18, 1, true, t0, t1).translate(
        0,
        hgt / 2,
        0,
      ),
      '#cfe9ff',
      scr,
    );
  const edge: THREE.Vector3[] = [];
  for (let k = 0; k <= 10; k++) {
    const th = t0 + (t1 * k) / 10;
    edge.push(v3(r * Math.sin(th), hgt, r * Math.cos(th)).applyMatrix4(scr));
  }
  b.add('metal', tube(edge, 0.004, 24, 5), CHROME);
  for (const th of [t0, t0 + t1]) {
    const top = v3(r * Math.sin(th), hgt, r * Math.cos(th)).applyMatrix4(scr);
    const bot = v3(r * Math.sin(th), 0, r * Math.cos(th)).applyMatrix4(scr);
    b.add('metal', rod(0.004, bot, top, 6), CHROME);
  }
}

/** The passenger: a little dog in goggles and a scarf, pivoting at its neck.
 * Pose 1 flaps its ears and scarf. */
function dogParts(b: Bins, flap: number) {
  const white = '#f6f1e8';
  const brown = '#9a6236';
  b.add('paint', cyl(0.028, 0.034, 0.05, 16), white, m4(0, 0.025, 0));
  b.add(
    'paint',
    sphere(1, 16, 12),
    (c) => (c.x > 0.3 && c.z < 0 ? brown : white),
    m4(0, -0.004, -0.035, 0, 0, 0, [0.05, 0.04, 0.062]),
  );
  b.add(
    'paint',
    sphere(0.042, 18, 12),
    (c) => (c.x < -0.008 && c.y > -0.012 && c.z > -0.02 ? brown : white),
    m4(0, 0.082, 0.004, 0, 0, 0, [1, 0.93, 1.04]),
  );
  b.add(
    'paint',
    sphere(0.025, 14, 10),
    '#f7ead4',
    m4(0, 0.068, 0.04, 0.15, 0, 0, [0.95, 0.75, 1.15]),
  );
  b.add(
    'paint',
    sphere(0.009, 10, 8),
    '#1d1b1d',
    m4(0, 0.077, 0.068, 0, 0, 0, [1.2, 0.9, 1]),
  );
  b.add(
    'paint',
    rbox(0.014, 0.004, 0.018, 0.002, 1),
    '#ef7d93',
    m4(0.006, 0.054, 0.056, 0.7, 0, 0),
  );
  for (const s of [-1, 1]) {
    b.add(
      'paint',
      sphere(1, 12, 8),
      brown,
      m4(
        s * (0.041 + flap * 0.006),
        0.084 + flap * 0.004,
        -0.008,
        -0.2 - flap * 0.5,
        0,
        s * (0.35 + flap * 0.55),
      ).multiply(m4(0, -0.022, 0, 0, 0, 0, [0.008, 0.032, 0.02])),
    );
    // Goggles: a brass rim, a tinted lens and the eye behind.
    b.add(
      'paint',
      new THREE.TorusGeometry(0.0135, 0.0035, 6, 18),
      '#d4a64f',
      m4(s * 0.017, 0.096, 0.038, 0, s * 0.3, 0),
    );
    b.add(
      'paint',
      sphere(0.012, 12, 6),
      '#7cc6e0',
      m4(s * 0.017, 0.096, 0.036, 0, s * 0.3, 0, [1, 1, 0.45]),
    );
    b.add('paint', sphere(0.004, 8, 6), '#1d1b1d', m4(s * 0.016, 0.095, 0.04));
  }
  b.add(
    'paint',
    new THREE.TorusGeometry(0.043, 0.0045, 6, 28),
    '#6b4226',
    m4(0, 0.097, 0.0, Math.PI / 2 - 0.2, 0, 0, [1, 1.05, 1]),
  );
  b.add(
    'paint',
    new THREE.TorusGeometry(0.031, 0.009, 8, 22),
    '#e24a33',
    m4(0, 0.048, 0, Math.PI / 2 - 0.12, 0, 0),
  );
  const sw = flap;
  b.add(
    'paint',
    tube(
      [
        v3(0.012, 0.05, -0.028),
        v3(0.03, 0.052 + sw * 0.01, -0.06),
        v3(0.045 + sw * 0.01, 0.06 - sw * 0.008, -0.095),
        v3(0.06 - sw * 0.006, 0.068 + sw * 0.012, -0.125),
      ],
      0.0075,
      12,
      6,
    ),
    '#e24a33',
  );
  for (const s of [-1, 1])
    b.add(
      'paint',
      sphere(0.013, 10, 8),
      white,
      m4(s * 0.034, 0.05, 0.062, 0, 0, 0, [1, 0.7, 1.25]),
    );
}

const sidecar: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const ship = where === 'ship';
  const car = new THREE.Group();
  const b = new Bins({
    ...mats,
    glass: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.05,
      clearcoat: 1,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    glow: vmat({ emissive: '#ffe2a0', emissiveIntensity: 0.9, roughness: 0.2 }),
  });
  sidecarParts(b, true);
  const at = v3(0.86, -0.45, -0.3);
  if (ship) {
    // Two struts and a brace from the hull's lower right flank to the
    // chassis rail, merged with the car (in its own frame).
    const back = new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z);
    const B = (m: THREE.Matrix4) => back.clone().multiply(m);
    const ends: THREE.Vector3[][] = [];
    for (const [zr, zs] of [
      [-0.12, -0.15],
      [0.0, 0.08],
    ]) {
      const a = flankAt(zr, -0.33, 1);
      saddle(b, a, zr, 0.07, 0.09, GUN, back);
      const p0 = hullPoint(a, zr, 0.01);
      const p1 = v3(at.x - 0.105, at.y - 0.075, at.z + zs);
      ends.push([p0, p1]);
      b.add('metal', rod(0.013, p0, p1, 12), STEEL, back);
      b.add(
        'paint',
        rbox(0.03, 0.036, 0.04, 0.008, 1),
        GUN,
        B(m4(p1.x + 0.004, p1.y, p1.z)),
      );
      b.add(
        'paint',
        cyl(0.019, 0.019, 0.03, 14),
        GUN,
        B(aim(p0.clone().lerp(p1, 0.06), p1.clone().sub(p0))),
      );
    }
    b.add(
      'metal',
      rod(
        0.009,
        ends[0][0].clone().lerp(ends[0][1], 0.45),
        ends[1][0].clone().lerp(ends[1][1], 0.8),
        8,
      ),
      STEEL,
      back,
    );
  }
  b.into(car);
  const dog = new THREE.Group();
  dog.position.set(0, 0.035, SC.cz - 0.005);
  const flap = posed(mats, 1, (d, k) => dogParts(d, k), dog);
  car.add(dog);
  group.add(car);
  if (ship) car.position.copy(at);
  else group.rotation.y = -1.25;
  return {
    group,
    update: (t) => {
      dog.rotation.y = Math.sin(t * 0.6) * 0.35 + Math.sin(t * 1.7) * 0.08;
      dog.rotation.x = Math.sin(t * 2.2) * 0.05;
      flap([0.5 + 0.5 * Math.sin(t * 7.5)]);
    },
  };
};

// ——— Cooler: a sealed, insulated cargo cartridge ———

const cooler: Maker = (where) => {
  const group = new THREE.Group();
  const mats = kitMats();
  const unit = new THREE.Group();
  const b = new Bins(mats);
  // A horizontal coolant canister, with radiator fins and two retaining rings.
  b.add(
    'paint',
    cyl(0.08, 0.08, 0.23, 24).rotateZ(Math.PI / 2),
    '#8ed7ec',
    m4(0, 0.19, 0),
  );
  for (const sign of [-1, 1]) {
    b.add(
      'metal',
      dome(0.08, 20, 8).rotateZ((-sign * Math.PI) / 2),
      STEEL,
      m4(sign * 0.115, 0.19, 0, 0, 0, 0, [0.5, 1, 1]),
    );
    b.add(
      'paint',
      new THREE.TorusGeometry(0.083, 0.009, 6, 24).rotateY(Math.PI / 2),
      GUN,
      m4(sign * 0.077, 0.19, 0),
    );
    b.add(
      'metal',
      rbox(0.028, 0.1, 0.025, 0.007, 1),
      STEEL,
      m4(sign * 0.077, 0.081, 0),
    );
  }
  for (const x of [-0.035, 0, 0.035])
    b.add('metal', rbox(0.009, 0.055, 0.12, 0.003, 1), GUN, m4(x, 0.27, 0));
  b.add(
    'paint',
    tube(
      [
        v3(-0.08, 0.19, 0.085),
        v3(-0.04, 0.125, 0.106),
        v3(0.04, 0.125, 0.106),
        v3(0.08, 0.19, 0.085),
      ],
      0.011,
      16,
      8,
    ),
    '#65bfe8',
  );
  b.add(
    'paint',
    rbox(0.03, 0.025, 0.025, 0.005, 1),
    '#f0a040',
    m4(0.077, 0.27, 0),
  );
  b.add('paint', rbox(0.27, 0.02, 0.23, 0.006, 1), GUN, m4(0, 0.006, -0.005));
  b.into(unit);
  group.add(unit);
  if (where === 'ship') {
    const X0 = -0.85,
      Y0 = -0.655,
      Z0 = -0.19;
    unit.position.set(X0, Y0, Z0);
    unit.rotation.y = -Math.PI / 2;
    const f = new Bins(mats);
    for (const [zr, zs] of [
      [-0.12, -0.29],
      [0, -0.09],
    ]) {
      const a = flankAt(zr, -0.33, -1);
      saddle(f, a, zr, 0.07, 0.09);
      const p0 = hullPoint(a, zr, 0.01);
      const p1 = v3(X0 + 0.118, Y0 + 0.2, zs);
      f.add('metal', rod(0.013, p0, p1, 12), STEEL);
      f.add(
        'paint',
        rbox(0.03, 0.04, 0.04, 0.008, 1),
        GUN,
        m4(p1.x - 0.004, p1.y, p1.z),
      );
      f.add(
        'paint',
        cyl(0.019, 0.019, 0.03, 14),
        GUN,
        aim(p0.clone().lerp(p1, 0.06), p1.clone().sub(p0)),
      );
    }
    f.into(group);
  } else group.rotation.y = -0.9;
  return still(group);
};

export const gearMakers: Record<string, Maker> = {
  pier: robotArm,
  glassworks: cutter,
  sails: trailer,
  harbor: magnet,
  balloon: sidecar,
  windmill: cooler,
};
