import * as THREE from 'three';
import { lump, m4, merge, seeded } from './alto-3d';
import {
  TAU,
  v3,
  C,
  vmat,
  Bins,
  lathe,
  rbox,
  cyl,
  sphere,
  dome,
  rod,
  type Paint,
  type Pt,
  type Upgrade,
} from './alto-kit';
import { shipBounds, upgradeMakers } from './alto-ship';
import { planById } from '@/lib/games/alto/content';

/**
 * A player's home base: a little outpost floating in space, built from code
 * like the ships. A hub (a hab dome with lit windows and a flag in the seat
 * colour) and a landing pad share a chassis on an asteroid. Each base
 * module bolts into a socket on that chassis, using the same space-hardware
 * model as the shop. The chassis grows once: a compact deck for the inner
 * ring, the full deck once that ring is built. The scene frames what is
 * drawn (`baseFrame`), so a young base fills its slot as well as a big one.
 * The ship hovers over the pad when it is home (`dock`).
 *
 * Slots are fixed and filled in build order: five round the hub, eleven on an
 * outer ring, the pad back left. Each model is scaled to its plate, the
 * neighbouring hardware never meets, and nothing reaches the docked ship;
 * scripts/alto-fit.mjs checks all of it triangle by triangle.
 *
 * Static meshes of everything built are merged by material (`bake`), so a
 * base costs a few dozen draws; moving parts stay as they are.
 *
 * Units: the hub's deck is about 1.5 across; y is up, the front faces +Z.
 */

export type Base = {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
  /** Base-module ids in build order (ship-part ids are ignored); `ghost` shows see-through and pulsing (a pick not yet built). */
  setModules: (ids: readonly string[], ghost?: string | null) => void;
  /** Where the ship stands when docked, in the base group's local space: the ship group's position, scale and yaw (radians about +Y). */
  dock: { position: THREE.Vector3; scale: number; yaw: number };
  /** Max extent from the origin, local units, with every module built and the ship docked; the scene fits this into a slot. */
  reach: number;
  dispose: () => void;
};

const isModule = (id: string) => {
  const tag = planById[id]?.tag;
  return tag === 'monument' || tag === 'civic';
};
/** The base modules, in the order the upgrades are listed. */
export const baseModules = Object.keys(planById).filter(isModule);

// ——— Layout ———

const CREAM = '#f3eadb';
const CREAM_SEAM = '#d8ccb8';
const GUN = '#4a4f5a';
const DARK = '#3b3f48';
const STEEL = '#c9d0d8';

/** The hub's deck radius, a plate's, and the room a model gets on it. */
const HUB_R = 0.74;
const PLATE_R = 0.37;
const MODEL_R = 0.32;
/** Tallest a model may stand. */
const MODEL_H = 0.78;
/** The pad sits back left of the hub, where no slot is. */
const PAD_AT = THREE.MathUtils.degToRad(-150);
const PAD = {
  x: 1.7 * Math.sin(PAD_AT),
  z: 1.7 * Math.cos(PAD_AT),
  r: 0.68,
  y: 0,
};
const RING = [1.16, 2.0];
/** The inner ring's sockets, and the compact deck that carries them. */
const INNER = 5;
const COMPACT_R = 1.62;
const WALK_W = 0.15;

type Slot = { x: number; y: number; z: number; parent: number };
/** Parent −1 is the hub, otherwise an earlier slot. */
function slots(): Slot[] {
  const at = (r: number, deg: number, y: number, parent: number): Slot => {
    const a = THREE.MathUtils.degToRad(deg);
    return { x: r * Math.sin(a), y, z: r * Math.cos(a), parent };
  };
  // Five round the hub, front sides first; the pad has the back left and
  // the hub's door keeps a clear view to the front.
  const out: Slot[] = [
    at(RING[0], 30, 0.02, -1),
    at(RING[0], -30, -0.02, -1),
    at(RING[0], 90, -0.03, -1),
    at(RING[0], -90, 0.03, -1),
    at(RING[0], 150, -0.01, -1),
  ];
  // Eleven on the outer ring, each joined to the nearest plate in; the one
  // straight ahead of the door comes last.
  const ring: [number, number, number][] = [
    [28, 0, 0.0],
    [-28, 1, -0.04],
    [56, 0, 0.03],
    [-56, 1, -0.01],
    [84, 2, -0.05],
    [-84, 3, 0.02],
    [112, 2, 0.01],
    [-112, 3, -0.03],
    [140, 4, -0.04],
    [168, 4, 0.02],
    [0, -1, -0.02],
  ];
  for (const [deg, parent, y] of ring) out.push(at(RING[1], deg, y, parent));
  return out;
}
const SLOTS = slots();

/** The docked ship: over the pad, side on, nose out to the left and turned a
 * little towards the camera. */
const SHIP_SCALE = 0.45;
const SHIP_YAW = -Math.PI / 2 + 0.32;
function dockOf() {
  const c = shipBounds.getCenter(v3());
  // Centre its footprint over the pad and hover it clear of the deck.
  const off = v3(c.x, 0, c.z)
    .multiplyScalar(SHIP_SCALE)
    .applyAxisAngle(v3(0, 1, 0), SHIP_YAW);
  return {
    position: v3(
      PAD.x - off.x,
      PAD.y + 0.16 - shipBounds.min.y * SHIP_SCALE,
      PAD.z - off.z,
    ),
    scale: SHIP_SCALE,
    yaw: SHIP_YAW,
  };
}

// ——— Pieces ———

type Mats = Record<string, THREE.Material>;
const baseMats = (): Mats => ({
  paint: vmat({ roughness: 0.45, metalness: 0.05 }),
  metal: vmat({ roughness: 0.32, metalness: 0.75 }),
  rock: vmat({ roughness: 0.92, flatShading: true }),
  port: vmat({
    roughness: 0.15,
    metalness: 0.2,
    emissive: '#ffcf80',
    emissiveIntensity: 0.9,
  }),
  glow: vmat({ emissive: '#7ef0e0', emissiveIntensity: 0.9, roughness: 0.3 }),
  lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#8fc4ef',
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1,
    transparent: true,
    opacity: 0.45,
  }),
});

const hash = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const rockPaint =
  (top: number): Paint =>
  (c, n) => {
    const k = (hash(c.x, c.y, c.z) - 0.5) * 0.06;
    const base = C(n.y > 0.5 && c.y > top - 0.06 ? '#9a8fa6' : '#6f6680');
    return base.offsetHSL(0, 0, k - Math.max(0, top - c.y) * 0.12);
  };

/** A lumpy asteroid with a flat top at y = 0, `r` across and `d` deep. */
function rock(b: Bins, at: THREE.Matrix4, r: number, d: number, seed: number) {
  const g = lump(3, 0.2, seed);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = Math.min(p.getY(i), 0.35) - 0.35;
    p.setXYZ(i, p.getX(i) * r * 0.82, y * d, p.getZ(i) * r * 0.82);
  }
  g.computeVertexNormals();
  b.add('rock', g, rockPaint(0), at);
  // A few glowing crystals poking out underneath.
  const rand = seeded(seed * 7 + 3);
  for (let k = 0; k < 3; k++) {
    const a = rand() * TAU;
    const s = 0.05 + rand() * 0.04;
    const tip = new THREE.OctahedronGeometry(1, 0).scale(
      s * 0.5,
      s * 1.6,
      s * 0.5,
    );
    b.add(
      'glow',
      tip,
      k % 2 ? '#7ef0e0' : '#b6a4ff',
      at
        .clone()
        .multiply(
          m4(
            Math.cos(a) * r * 0.42,
            -d * (0.55 + rand() * 0.2),
            Math.sin(a) * r * 0.42,
            Math.cos(a) * 0.6,
            0,
            -Math.sin(a) * 0.6,
          ),
        ),
    );
  }
}

/** A round deck: a cream top with seams, a band in the seat colour, a rim. */
function deck(
  b: Bins,
  at: THREE.Matrix4,
  r: number,
  seat: THREE.Color,
  h = 0.1,
) {
  const pts: Pt[] = [
    [0, -h],
    [r - 0.05, -h],
    [r - 0.01, -h + 0.03, 0.02],
    [r, -h * 0.55],
    [r + 0.008, -h * 0.5],
    [r + 0.008, -h * 0.2],
    [r, -h * 0.15],
    [r, -0.015, 0.01],
    [r - 0.015, 0, 0.01],
  ];
  for (let k = 1; k < 8; k++) pts.push([(r - 0.015) * (1 - k / 8), 0]);
  pts.push([0, 0]);
  // The chassis decks are steel blue; hub, pad and plates are cream.
  const steel = r > 1.2;
  const seam = C(steel ? '#2f3c50' : CREAM_SEAM);
  const cream = C(steel ? '#53637b' : CREAM);
  const under = C('#8a8f9a');
  b.add(
    'paint',
    lathe(pts, Math.round(28 + r * 40), 2),
    (c, n) => {
      const q = Math.hypot(c.x, c.z);
      if (n.y > 0.8 && c.y > -0.004) {
        if (Math.abs(q - r * 0.72) < 0.008) return seam;
        return cream;
      }
      if (n.y < -0.5) return under;
      if (q > r + 0.004) return seat;
      return under;
    },
    at,
  );
  // Bolts round the top's edge, and little lamps in the band.
  const n = Math.round(r * 22);
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * TAU;
    b.add(
      'metal',
      dome(0.011, 6, 2),
      STEEL,
      at
        .clone()
        .multiply(m4(Math.sin(a) * (r - 0.045), 0, Math.cos(a) * (r - 0.045))),
    );
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3;
    b.add(
      'lights',
      sphere(0.014, 8, 6),
      '#ffe7a8',
      at
        .clone()
        .multiply(
          m4(Math.sin(a) * (r + 0.01), -h * 0.35, Math.cos(a) * (r + 0.01)),
        ),
    );
  }
}

/** A walkway from a to b (deck tops), with girders and rails; it runs from
 * edge to edge, `ra` and `rb` in from each centre. */
function walkway(
  b: Bins,
  a: THREE.Vector3,
  ra: number,
  bEnd: THREE.Vector3,
  rb: number,
  seat: THREE.Color,
) {
  const d = bEnd.clone().sub(a);
  const flat = Math.hypot(d.x, d.z);
  const dir = v3(d.x / flat, 0, d.z / flat);
  const p0 = a.clone().addScaledVector(dir, ra - 0.04);
  const p1 = bEnd.clone().addScaledVector(dir, -(rb - 0.04));
  p0.y = a.y - 0.012;
  p1.y = bEnd.y - 0.012;
  const len = p0.distanceTo(p1);
  const mid = p0.clone().add(p1).multiplyScalar(0.5);
  const yaw = Math.atan2(dir.x, dir.z);
  const pitch = -Math.asin((p1.y - p0.y) / len);
  const at = new THREE.Matrix4().compose(
    mid,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')),
    v3(1, 1, 1),
  );
  const A = (m: THREE.Matrix4) => at.clone().multiply(m);
  b.add('paint', rbox(WALK_W, 0.024, len, 0.008, 1), '#d9d4cb', A(m4(0, 0, 0)));
  // Tread slats.
  const slats = Math.max(2, Math.floor(len / 0.07));
  for (let k = 0; k < slats; k++)
    b.add(
      'paint',
      rbox(WALK_W - 0.03, 0.006, 0.018, 0.002, 1),
      '#b9b2a6',
      A(m4(0, 0.013, -len / 2 + (len * (k + 0.5)) / slats)),
    );
  for (const s of [-1, 1]) {
    // A girder under each edge and a rail on posts above it.
    b.add(
      'metal',
      rbox(0.022, 0.04, len, 0.006, 1),
      GUN,
      A(m4(s * (WALK_W / 2 - 0.006), -0.024, 0)),
    );
    const posts = Math.max(2, Math.round(len / 0.16) + 1);
    const x = s * (WALK_W / 2 - 0.012);
    for (let k = 0; k < posts; k++) {
      const z = -len / 2 + 0.04 + ((len - 0.08) * k) / (posts - 1);
      b.add('metal', cyl(0.006, 0.006, 0.07, 6), STEEL, A(m4(x, 0.047, z)));
    }
    b.add(
      'paint',
      rod(
        0.009,
        v3(x, 0.082, -len / 2 + 0.04),
        v3(x, 0.082, len / 2 - 0.04),
        6,
      ),
      seat,
      at,
    );
  }
}

/**
 * The chassis under the hub, in two sizes. A new base is a compact station:
 * the inner ring's five sockets on a small deck, the pad reaching out past
 * its edge. Once those five are built the full deck, with all sixteen
 * sockets, takes its place, so a ghost or a new module never lands off the
 * deck. Restrained socket outlines and panel seams make the bare deck read
 * as a working station; the hardware rises from these same positions.
 */
function chassis(seat: THREE.Color, full: boolean, mats: Mats) {
  const group = new THREE.Group();
  const b = new Bins(mats);
  deck(b, m4(0, -0.18, 0), full ? 2.43 : COMPACT_R, seat, 0.16);
  rock(
    b,
    m4(0, -0.33, 0),
    full ? 2.3 : COMPACT_R - 0.08,
    full ? 0.65 : 0.5,
    11,
  );
  for (const s of full ? SLOTS : SLOTS.slice(0, INNER)) {
    b.add(
      'paint',
      new THREE.RingGeometry(0.23, 0.25, 24).rotateX(-Math.PI / 2),
      '#92a1b5',
      m4(s.x, -0.177, s.z),
    );
  }
  if (full)
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8;
      b.add(
        'paint',
        rbox(0.014, 0.004, 1.48, 0.002, 1),
        '#354358',
        m4(Math.sin(a) * 1.65, -0.175, Math.cos(a) * 1.65, 0, a, 0),
      );
    }
  b.into(group);
  group.visible = full;
  return group;
}

/** The hub: deck, skirt, dome, windows, door, cupola, mast and flag, on
 * both chassis (`compact` shows until the inner ring is built). */
function hub(seat: THREE.Color) {
  const group = new THREE.Group();
  const mats = baseMats();
  const compact = chassis(seat, false, mats);
  const full = chassis(seat, true, mats);
  group.add(compact, full);
  const b = new Bins(mats);
  deck(b, m4(), HUB_R, seat, 0.12);
  const R = 0.42;
  const W = 0.14;
  const cream = C(CREAM);
  const seam = C(CREAM_SEAM);
  // The skirt with its band, then the dome with panel seams.
  b.add(
    'paint',
    lathe(
      [
        [0, 0],
        [R + 0.04, 0],
        [R + 0.04, 0.03, 0.01],
        [R + 0.01, 0.04],
        [R + 0.01, W],
        [0, W],
      ],
      48,
      2,
    ),
    (c) => (c.y > 0.065 && c.y < 0.11 ? seat : c.y < 0.035 ? C(GUN) : cream),
  );
  const prof: Pt[] = [[0, W]];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    prof.push([R * Math.cos(a), W + R * Math.sin(a)]);
  }
  prof[1] = [R, W];
  b.add('paint', lathe(prof, 48, 1), (c) => {
    const el = Math.asin(Math.min(1, (c.y - W) / R));
    const az = (Math.atan2(c.x, c.z) + TAU) % TAU;
    if (Math.abs(el - 0.55) < 0.012 || Math.abs(el - 1.05) < 0.014) return seam;
    if (el < 1.05 && Math.abs((((az / TAU) * 8) % 1) - 0.5) < 0.012)
      return seam;
    return cream;
  });
  // Round windows round the dome, warm inside.
  const bezel = new THREE.TorusGeometry(0.052, 0.013, 6, 20);
  const pane = new THREE.CircleGeometry(0.052, 20);
  for (const deg of [-140, -95, -50, 50, 95, 140]) {
    const az = THREE.MathUtils.degToRad(deg);
    const el = 0.3;
    const n = v3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el),
    );
    const p = n
      .clone()
      .multiplyScalar(R)
      .add(v3(0, W, 0));
    const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), n);
    const at = new THREE.Matrix4().compose(p, q, v3(1, 1, 1));
    b.add('metal', bezel, '#c9d0d8', at.clone().multiply(m4(0, 0, 0.004)));
    b.add('port', pane, '#ffd890', at.clone().multiply(m4(0, 0, 0.002)));
  }
  // The airlock at the front: a rounded porch, a door and a lamp.
  b.add('paint', rbox(0.27, 0.27, 0.3, 0.06, 3), cream, m4(0, 0.135, R - 0.02));
  b.add('paint', rbox(0.3, 0.05, 0.31, 0.02, 2), seat, m4(0, 0.285, R - 0.02));
  b.add('paint', rbox(0.17, 0.2, 0.02, 0.03, 2), DARK, m4(0, 0.115, R + 0.13));
  b.add(
    'lights',
    rbox(0.1, 0.012, 0.012, 0.004, 1),
    '#ffe7a8',
    m4(0, 0.2, R + 0.142),
  );
  b.add(
    'metal',
    rbox(0.012, 0.06, 0.012, 0.004, 1),
    STEEL,
    m4(0.055, 0.11, R + 0.143),
  );
  b.add('lights', sphere(0.022, 10, 8), '#ffd27a', m4(0, 0.24, R + 0.14));
  // Fuel tanks on each side, on cradles.
  for (const s of [-1, 1]) {
    const az = s * THREE.MathUtils.degToRad(115);
    const x = Math.sin(az) * 0.56;
    const z = Math.cos(az) * 0.56;
    const turn = m4(x, 0.085, z, 0, az + Math.PI / 2, 0);
    b.add(
      'paint',
      lathe(
        [
          [0, -0.13],
          [0.05, -0.125, 0.03],
          [0.065, -0.09, 0.03],
          [0.065, 0.09, 0.03],
          [0.05, 0.125, 0.03],
          [0, 0.13],
        ],
        20,
        3,
      ).rotateX(Math.PI / 2),
      (c) => (Math.abs(c.z) < 0.02 ? seat : '#f0a040'),
      turn,
    );
    for (const u of [-0.07, 0.07])
      b.add(
        'metal',
        rbox(0.1, 0.06, 0.025, 0.008, 1),
        GUN,
        turn.clone().multiply(m4(0, -0.055, u)),
      );
  }
  // Crates and a lamp post on the deck.
  b.add(
    'paint',
    rbox(0.11, 0.11, 0.11, 0.015, 2),
    '#c98a4a',
    m4(0.5, 0.055, 0.34, 0, 0.4, 0),
  );
  b.add(
    'paint',
    rbox(0.08, 0.08, 0.08, 0.012, 2),
    '#e0b070',
    m4(0.53, 0.15, 0.33, 0, 0.9, 0),
  );
  b.add('metal', cyl(0.012, 0.016, 0.3, 8), GUN, m4(-0.52, 0.15, 0.34));
  b.add('lights', sphere(0.03, 10, 8), '#ffe7a8', m4(-0.52, 0.32, 0.34));
  // The cupola on top, and the mast.
  const top = W + R;
  b.add('paint', cyl(0.11, 0.13, 0.06, 24), DARK, m4(0, top + 0.01, 0));
  b.add(
    'glass',
    new THREE.SphereGeometry(0.1, 20, 8, 0, TAU, 0, Math.PI / 2),
    '#ffffff',
    m4(0, top + 0.04, 0),
  );
  b.add(
    'metal',
    cyl(0.009, 0.012, 0.36, 8),
    STEEL,
    m4(0.13, top + 0.12, -0.12),
  );
  b.add('metal', cyl(0.022, 0.026, 0.03, 10), GUN, m4(0.13, top - 0.04, -0.12));
  b.into(group);

  // The beacon on the mast blinks; the flag waves.
  const blink = new THREE.MeshBasicMaterial({ color: '#ff5a4a' });
  const lamp = new THREE.Mesh(sphere(0.022, 10, 8), blink);
  lamp.position.set(0.13, top + 0.31, -0.12);
  lamp.userData.live = true;
  group.add(lamp);
  const flagGeo = new THREE.PlaneGeometry(0.2, 0.12, 8, 3).translate(0.1, 0, 0);
  const rest = Float32Array.from(flagGeo.getAttribute('position').array);
  const flagMat = new THREE.MeshStandardMaterial({
    color: seat,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.14, top + 0.22, -0.12);
  flag.rotation.y = 0.5;
  flag.userData.live = true;
  group.add(flag);
  return {
    group,
    compact,
    full,
    update(t: number) {
      blink.color.set(Math.sin(t * 3) > 0.4 ? '#ff5a4a' : '#5a1a14');
      const p = flagGeo.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = rest[i * 3];
        p.setZ(i, Math.sin(x * 22 - t * 5) * 0.022 * (x / 0.2));
      }
      p.needsUpdate = true;
      flagGeo.computeVertexNormals();
    },
  };
}

/** The landing pad: a dark deck with markings, chasing lights and a soft
 * column of light that holds the ship. */
function pad(seat: THREE.Color, beamTop: number) {
  const group = new THREE.Group();
  const mats = baseMats();
  const b = new Bins(mats);
  const at = m4(PAD.x, PAD.y, PAD.z);
  deck(b, at, PAD.r, seat, 0.12);
  // Markings: a ring in the seat colour, a cream circle and four chevrons.
  const ring = (r0: number, r1: number) =>
    new THREE.RingGeometry(r0, r1, 64).rotateX(-Math.PI / 2);
  b.add(
    'paint',
    new THREE.CircleGeometry(PAD.r - 0.1, 64).rotateX(-Math.PI / 2),
    '#454a56',
    at.clone().multiply(m4(0, 0.002, 0)),
  );
  b.add('paint', ring(0.56, 0.64), seat, at.clone().multiply(m4(0, 0.004, 0)));
  b.add(
    'paint',
    ring(0.24, 0.27),
    '#f3eadb',
    at.clone().multiply(m4(0, 0.004, 0)),
  );
  const chevron = new THREE.Shape();
  chevron.moveTo(-0.07, 0);
  chevron.lineTo(0, 0.06);
  chevron.lineTo(0.07, 0);
  chevron.lineTo(0.07, -0.03);
  chevron.lineTo(0, 0.03);
  chevron.lineTo(-0.07, -0.03);
  chevron.closePath();
  const chev = new THREE.ShapeGeometry(chevron).rotateX(-Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    b.add(
      'paint',
      chev,
      '#f3eadb',
      at
        .clone()
        .multiply(
          m4(Math.sin(a) * 0.42, 0.005, Math.cos(a) * 0.42, 0, a + Math.PI, 0),
        ),
    );
  }
  b.into(group);
  // The bridge to the hub.
  const w = new Bins(mats);
  walkway(w, v3(0, 0, 0), HUB_R, v3(PAD.x, PAD.y, PAD.z), PAD.r, seat);
  const bridge = new THREE.Group();
  w.into(bridge);
  // Rim lights chasing round.
  const n = 16;
  const lamps = new THREE.InstancedMesh(
    dome(0.026, 10, 4),
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    n,
  );
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    lamps.setMatrixAt(
      k,
      m4(
        PAD.x + Math.sin(a) * (PAD.r - 0.085),
        PAD.y,
        PAD.z + Math.cos(a) * (PAD.r - 0.085),
      ),
    );
    lamps.setColorAt(k, C('#ffd27a'));
  }
  lamps.userData.live = true;
  group.add(lamps);
  // The light column, faint at the top.
  const beamH = beamTop - PAD.y - 0.01;
  const beamGeo = new THREE.CylinderGeometry(
    0.5,
    0.56,
    beamH,
    40,
    6,
    true,
  ).translate(PAD.x, PAD.y + 0.01 + beamH / 2, PAD.z);
  const bp = beamGeo.getAttribute('position');
  const fade = new Float32Array(bp.count * 3);
  for (let i = 0; i < bp.count; i++) {
    const k = Math.pow(1 - (bp.getY(i) - PAD.y) / beamH, 1.6) * 0.5;
    fade.set([k, k, k], i * 3);
  }
  beamGeo.setAttribute('color', new THREE.BufferAttribute(fade, 3));
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#9fdcff',
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.userData.live = true;
  beam.userData.ghostly = true;
  group.add(beam);
  const on = C('#ffd27a');
  const off = C('#5a4a2a');
  const mix = new THREE.Color();
  return {
    group,
    bridge,
    update(t: number) {
      for (let k = 0; k < n; k++) {
        const f = Math.max(0, Math.cos(((k / n) * TAU - t * 2.2) * 1)) ** 6;
        lamps.setColorAt(k, mix.copy(off).lerp(on, 0.25 + 0.75 * f));
      }
      lamps.instanceColor!.needsUpdate = true;
      beamMat.opacity = 0.75 + 0.25 * Math.sin(t * 2);
    },
  };
}

/** A socket plate and mounting collar attached to the permanent chassis. */
function slotPieces(i: number, seat: THREE.Color, mats: Mats) {
  const s = SLOTS[i];
  const plate = new THREE.Group();
  const b = new Bins(mats);
  deck(b, m4(s.x, s.y, s.z), PLATE_R, seat, 0.1);
  // A short mounting collar joins this socket to the common chassis.
  b.add(
    'metal',
    cyl(0.27, 0.32, 0.14 + s.y, 24),
    GUN,
    m4(s.x, -0.17 + (0.14 + s.y) / 2, s.z),
  );
  b.into(plate);
  const walk = new THREE.Group();
  // Kept as an empty group for the layout/collision contract; no outlying walkway.
  return { plate, walk };
}

// ——— Modules ———

/**
 * Each upgrade's model is built once for every base on the page: a template,
 * fitted to a plate and animated by its own `update`. A base shows a clone
 * (sharing geometry and materials) and copies the template's moving parts
 * into it each frame, so a second base with the same module costs nothing to
 * build.
 */
type Template = {
  model: THREE.Group;
  upgrade: Upgrade;
  /** Objects (by order in the tree) whose transform or visibility changes. */
  moving: number[];
  /** Meshes (by order in the tree) that never change, for baking. */
  still: number[];
  last: number;
};
const templates = new Map<string, Template>();

const nodesOf = (root: THREE.Object3D) => {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => out.push(o));
  return out;
};

/** Every vertex of an object, in its root's space, through `each`. */
function eachVertex(root: THREE.Object3D, each: (v: THREE.Vector3) => void) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const v = v3();
  const im = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.ghostly) return;
    const pos = o.geometry.getAttribute('position');
    const copies = o instanceof THREE.InstancedMesh ? o.count : 1;
    for (let c = 0; c < copies; c++) {
      m.multiplyMatrices(inv, o.matrixWorld);
      if (o instanceof THREE.InstancedMesh) {
        o.getMatrixAt(c, im);
        m.multiply(im);
      }
      for (let i = 0; i < pos.count; i += 1) {
        o.getVertexPosition(i, v);
        each(v.applyMatrix4(m));
      }
    }
  });
}

/** Build an upgrade's model and fit it to a plate: its footprint inside
 * MODEL_R, its height under MODEL_H, standing on y = 0, turned to show its
 * best side (as the shop does). Then sort out what moves. */
function template(id: string): Template {
  const known = templates.get(id);
  if (known) return known;
  const upgrade = upgradeMakers[id]('shop');
  const turn = new THREE.Group();
  turn.rotation.y = 0.5;
  turn.add(upgrade.group);
  const model = new THREE.Group();
  model.add(turn);
  // Measure over a few moments, so moving parts stay inside too.
  const box = new THREE.Box3();
  const xz: number[] = [];
  for (const t of [0, 1.7, 3.9, 6.2]) {
    upgrade.update(t, 0.5);
    eachVertex(model, (v) => {
      box.expandByPoint(v);
      xz.push(v.x, v.z);
    });
  }
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  let r = 0;
  for (let i = 0; i < xz.length; i += 2)
    r = Math.max(r, Math.hypot(xz[i] - cx, xz[i + 1] - cz));
  turn.position.set(-cx, -box.min.y, -cz);
  model.scale.setScalar(
    Math.min(MODEL_R / r, MODEL_H / (box.max.y - box.min.y)),
  );
  // Run the animation at a few moments and see what changes.
  const nodes = nodesOf(model);
  const snap = () => {
    model.updateMatrixWorld(true);
    return nodes.map((o) => {
      const key: (string | number | boolean | undefined)[] = [
        o.matrix.elements.map((x) => x.toFixed(5)).join(),
        o.visible,
      ];
      if (o instanceof THREE.Mesh) {
        const m = o.material as THREE.MeshStandardMaterial;
        key.push(
          m.opacity,
          m.color?.getHex(),
          m.emissive?.getHex(),
          m.emissiveIntensity,
          o.geometry.getAttribute('position').version,
          o.morphTargetInfluences?.join() ?? '',
        );
        if (o instanceof THREE.InstancedMesh)
          key.push(o.instanceMatrix.version, o.instanceColor?.version ?? 0);
      }
      return key.join('|');
    });
  };
  const shots = [0, 1.7, 4.3, 9.1].map((t) => {
    upgrade.update(t, 0.5);
    return snap();
  });
  upgrade.update(0, 0);
  const changes = nodes.map((_, i) => shots.some((s) => s[i] !== shots[0][i]));
  const moving = nodes.flatMap((_, i) => (changes[i] ? [i] : []));
  // Everything under a moving object moves; a material that changes keeps
  // every mesh using it unmerged.
  const live = new Set<THREE.Material>();
  const under = new Set<THREE.Object3D>();
  for (const i of moving) {
    nodes[i].traverse((o) => under.add(o));
    const n = nodes[i];
    if (n instanceof THREE.Mesh) live.add(n.material as THREE.Material);
  }
  const still = nodes.flatMap((o, i) =>
    o instanceof THREE.Mesh &&
    bakeable(o) &&
    !under.has(o) &&
    !live.has(o.material as THREE.Material)
      ? [i]
      : [],
  );
  const made = { model, upgrade, moving, still, last: NaN };
  templates.set(id, made);
  return made;
}

/** A base's copy of a template, kept moving with it. */
function moduleOf(id: string) {
  const tpl = template(id);
  const model = tpl.model.clone(true);
  const from = nodesOf(tpl.model);
  const to = nodesOf(model);
  const pairs = tpl.moving.map((i) => [from[i], to[i]] as const);
  const still = tpl.still.map((i) => to[i] as THREE.Mesh);
  return {
    model,
    still,
    update(t: number, dt: number) {
      if (tpl.last !== t) {
        tpl.last = t;
        tpl.upgrade.update(t, dt);
      }
      for (const [a, b] of pairs) {
        b.position.copy(a.position);
        b.quaternion.copy(a.quaternion);
        b.scale.copy(a.scale);
        b.visible = a.visible;
        if (a instanceof THREE.Mesh && b instanceof THREE.Mesh) {
          const w = a.morphTargetInfluences;
          const into = b.morphTargetInfluences;
          if (w && into) for (let k = 0; k < w.length; k++) into[k] = w[k];
        }
        if (
          a instanceof THREE.InstancedMesh &&
          b instanceof THREE.InstancedMesh
        ) {
          b.count = a.count;
          b.instanceMatrix.copy(a.instanceMatrix);
          b.instanceMatrix.needsUpdate = true;
          if (a.instanceColor && b.instanceColor) {
            b.instanceColor.copy(a.instanceColor);
            b.instanceColor.needsUpdate = true;
          }
        }
      }
    },
  };
}

// ——— Baking ———

/** A key for materials that draw the same, so their meshes can merge: every
 * plain setting, colour and texture. */
function signature(m: THREE.Material) {
  const out: string[] = [m.type];
  for (const [k, v] of Object.entries(m)) {
    if (k === 'uuid' || k === 'id' || k === 'name' || k === 'version') continue;
    if (
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      typeof v === 'string'
    )
      out.push(`${k}=${v}`);
    else if (v instanceof THREE.Color) out.push(`${k}=${v.getHex()}`);
    else if (v instanceof THREE.Texture) out.push(`${k}=${v.uuid}`);
  }
  return out.join('|');
}
const bakeable = (o: THREE.Mesh) =>
  !(o instanceof THREE.InstancedMesh) &&
  !o.userData.live &&
  !Array.isArray(o.material) &&
  !(o.material as THREE.MeshStandardMaterial).map &&
  !o.geometry.morphAttributes.position;

/** Merge these meshes by material into `into` (base-local space); the
 * originals are hidden and marked `baked`. */
function bake(meshes: THREE.Mesh[], root: THREE.Object3D, into: THREE.Group) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const bins = new Map<
    string,
    { mat: THREE.Material; geos: THREE.BufferGeometry[] }
  >();
  for (const o of meshes) {
    const mat = o.material as THREE.Material;
    const key = signature(mat);
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = { mat, geos: [] }));
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal' && name !== 'color')
        g.deleteAttribute(name);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.getAttribute('color')) {
      const c = new Float32Array(g.getAttribute('position').count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    const col = g.getAttribute('color');
    if (col.itemSize !== 3) {
      const c = new Float32Array(col.count * 3);
      for (let i = 0; i < col.count; i++)
        c.set([col.getX(i), col.getY(i), col.getZ(i)], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    g = g.applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld),
    );
    bin.geos.push(g);
    o.visible = false;
    o.userData.baked = true;
  }
  for (const { mat, geos } of bins.values()) {
    const g = merge(geos);
    for (const x of geos) x.dispose();
    const m = mat.clone();
    // Meshes without vertex colours got white ones, which change nothing.
    into.add(new THREE.Mesh(g, m));
  }
}

// ——— The base ———

export function buildBase(colour: string): Base {
  const seat = C(colour);
  const group = new THREE.Group();
  const dock = dockOf();
  const h = hub(seat);
  const p = pad(seat, dock.position.y + shipBounds.min.y * SHIP_SCALE);
  group.add(h.group, p.group, p.bridge);
  const baked = new THREE.Group();
  group.add(baked);
  const slotMats = baseMats();
  const meshes = (root: THREE.Object3D) => {
    const out: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && bakeable(o)) out.push(o);
    });
    return out;
  };
  const chassisStill = { compact: meshes(h.compact), full: meshes(h.full) };
  const inChassis = new Set([...chassisStill.compact, ...chassisStill.full]);
  const fixedStill = [h.group, p.group, p.bridge]
    .flatMap(meshes)
    .filter((o) => !inChassis.has(o));
  let full = false;

  type Module = {
    slot: number;
    /** The slot's plate and walkway, and the module's model. */
    holder: THREE.Group;
    plate: THREE.Group;
    walk: THREE.Group;
  } & ReturnType<typeof moduleOf>;
  const modules = new Map<string, Module>();
  /** Each slot's plate and walkway, built once. */
  const pieces = new Map<number, { plate: THREE.Group; walk: THREE.Group }>();
  let order: string[] = [];
  let fresh = true;
  let ghostId: string | null = null;
  const ghostMats = new Map<THREE.Mesh, THREE.Material>();

  const piecesFor = (i: number) => {
    let s = pieces.get(i);
    if (!s) {
      s = slotPieces(i, seat, slotMats);
      pieces.set(i, s);
    }
    return s;
  };
  const drop = (id: string) => {
    const m = modules.get(id);
    if (!m) return;
    m.holder.remove(m.plate, m.walk);
    group.remove(m.holder);
    modules.delete(id);
  };
  const place = (id: string, slot: number) => {
    const old = modules.get(id);
    if (old && old.slot === slot) return old;
    drop(id);
    const { plate, walk } = piecesFor(slot);
    const made = moduleOf(id);
    const s = SLOTS[slot];
    made.model.position.set(s.x, s.y, s.z);
    const holder = new THREE.Group();
    holder.add(plate, walk, made.model);
    group.add(holder);
    const m = { ...made, slot, holder, plate, walk };
    modules.set(id, m);
    return m;
  };

  const ghostly = (root: THREE.Object3D, on: boolean) => {
    // The framing skips a pick not yet built.
    root.userData.ghost = on;
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (on && !ghostMats.has(o)) {
        ghostMats.set(o, o.material as THREE.Material);
        const g = (o.material as THREE.Material).clone();
        g.transparent = true;
        g.depthWrite = false;
        o.material = g;
      } else if (!on && ghostMats.has(o)) {
        (o.material as THREE.Material).dispose();
        o.material = ghostMats.get(o)!;
        ghostMats.delete(o);
      }
    });
  };

  const rebake = () => {
    group.traverse((o) => {
      if (o.userData.baked) {
        o.visible = true;
        o.userData.baked = false;
      }
    });
    disposeTree(baked);
    baked.clear();
    const list = [
      ...fixedStill,
      ...(full ? chassisStill.full : chassisStill.compact),
    ];
    for (const id of order) {
      const m = modules.get(id)!;
      list.push(...m.still);
      for (const piece of [m.plate, m.walk])
        piece.traverse((o) => {
          if (o instanceof THREE.Mesh && bakeable(o)) list.push(o);
        });
    }
    bake(list, group, baked);
  };

  const setModules = (ids: readonly string[], ghost: string | null = null) => {
    const next = [...new Set(ids.filter(isModule))].slice(0, SLOTS.length);
    const nextGhost =
      ghost &&
      isModule(ghost) &&
      !next.includes(ghost) &&
      next.length < SLOTS.length
        ? ghost
        : null;
    const same =
      next.length === order.length && next.every((id, i) => id === order[i]);
    if (same && nextGhost === ghostId && !fresh) return;
    // Clear the old ghost, then lay out the built modules.
    if (ghostId) {
      const g = modules.get(ghostId);
      if (g) ghostly(g.holder, false);
    }
    const shown = new Set<string>(next);
    next.forEach((id, i) => place(id, i));
    if (nextGhost) {
      const g = place(nextGhost, next.length);
      ghostly(g.holder, true);
      shown.add(nextGhost);
    }
    // A module dropped from the list gives its plate back to the slot.
    for (const id of modules.keys()) if (!shown.has(id)) drop(id);
    ghostId = nextGhost;
    if (!same || fresh) {
      fresh = false;
      order = next;
      // The full deck arrives with the inner ring's last module, before
      // anything needs an outer socket.
      full = next.length >= INNER;
      h.compact.visible = !full;
      h.full.visible = full;
      rebake();
    }
  };
  setModules([]);

  // How far anything reaches: the outer plates with the tallest models on
  // them, the permanent chassis and the docked ship's box.
  let reach = Math.hypot(2.5, 0.95);
  for (const s of SLOTS) {
    const out = Math.hypot(s.x, s.z) + PLATE_R + 0.02;
    reach = Math.max(
      reach,
      Math.hypot(out, s.y + MODEL_H),
      Math.hypot(out, 0.6),
    );
  }
  const shipBox = shipBounds
    .clone()
    .applyMatrix4(
      new THREE.Matrix4().compose(
        dock.position,
        new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), dock.yaw),
        v3(dock.scale, dock.scale, dock.scale),
      ),
    );
  for (let k = 0; k < 8; k++)
    reach = Math.max(
      reach,
      v3(
        k & 1 ? shipBox.max.x : shipBox.min.x,
        k & 2 ? shipBox.max.y : shipBox.min.y,
        k & 4 ? shipBox.max.z : shipBox.min.z,
      ).length(),
    );

  return {
    group,
    dock,
    reach,
    setModules,
    update(t, dt) {
      h.update(t);
      p.update(t);
      for (const [id, m] of modules) {
        m.update(t, dt);
        if (id === ghostId) {
          const a = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4));
          m.holder.traverse((o) => {
            if (o instanceof THREE.Mesh)
              (o.material as THREE.Material).opacity = a;
          });
        }
      }
    },
    dispose() {
      // The modules' geometry and materials belong to the shared templates.
      ghostly(group, false);
      disposeTree(baked);
      for (const root of [h.group, p.group, p.bridge]) disposeTree(root);
      for (const s of pieces.values()) {
        disposeTree(s.plate);
        disposeTree(s.walk);
      }
      for (const m of Object.values(slotMats)) m.dispose();
      group.clear();
    },
  };
}

/** Free an object's geometry and materials. */
function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const m = o.material as THREE.Material | THREE.Material[];
      for (const x of Array.isArray(m) ? m : [m]) x.dispose();
    }
  });
}

/** The base's pieces by name for scripts/alto-fit.mjs: which may touch
 * (joined), and the docked ship's box in base space. */
export function baseLayout(base: Base) {
  const named: { name: string; object: THREE.Object3D }[] = [];
  const [hubG, padG, bridgeG] = base.group.children;
  named.push(
    { name: 'hub', object: hubG },
    { name: 'pad', object: padG },
    { name: 'bridge', object: bridgeG },
  );
  const slotOf = new Map<THREE.Object3D, number>();
  base.group.children.slice(4).forEach((holder) => {
    if (!holder.visible) return;
    const [plate, walk, model] = holder.children;
    const s = SLOTS.findIndex(
      (q) =>
        Math.abs(q.x - model.position.x) < 1e-6 &&
        Math.abs(q.z - model.position.z) < 1e-6,
    );
    slotOf.set(holder, s);
    named.push(
      { name: `plate ${s}`, object: plate },
      { name: `walk ${s}`, object: walk },
      { name: `module ${s}`, object: model },
    );
  });
  const joined = (a: string, b: string) => {
    const [x, y] = [a, b].sort();
    const num = (s: string) => Number(s.split(' ')[1]);
    if (x === 'bridge' && (y === 'hub' || y === 'pad')) return true;
    // Socket collars and the pad are attached to the permanent chassis.
    if (x === 'hub' && (y === 'pad' || y.startsWith('plate'))) return true;
    if (x.startsWith('module') && y.startsWith('plate'))
      return num(x) === num(y);
    if (x.startsWith('plate') && y.startsWith('walk')) {
      const w = num(y);
      return num(x) === w || num(x) === SLOTS[w].parent;
    }
    if (x === 'hub' && y.startsWith('walk')) return SLOTS[num(y)].parent === -1;
    return false;
  };
  const toShip = new THREE.Matrix4()
    .compose(
      base.dock.position,
      new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), base.dock.yaw),
      v3(base.dock.scale, base.dock.scale, base.dock.scale),
    )
    .invert();
  return {
    pieces: named,
    joined,
    toShip,
    slots: SLOTS,
    room: { r: MODEL_R, h: MODEL_H },
  };
}
