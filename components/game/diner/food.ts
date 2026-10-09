import * as THREE from 'three';
import type { Kit } from './kit';

/**
 * The dishes, plates and things a waiter carries (8 October 2026, Claude's
 * half of the 3D split). They sit at about 15–30 px on screen, so each is
 * built around one clear silhouette and two or three saturated masses, with
 * the small detail (seeds, lattice, stripes) there to reward a closer look.
 * Units are metres; the origin is the bottom centre of the plate or glass.
 */
type V3 = [number, number, number];

const lathe = (points: [number, number][], segments = 28) => {
  const g = new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  g.computeVertexNormals();
  return g;
};

/** A white diner plate with a cherry pinstripe. */
export function plate(k: Kit, y = 0, r = 0.17) {
  k.add(
    'ceramic',
    '#fbf6ec',
    lathe([
      [0, 0],
      [r * 0.72, 0],
      [r * 0.76, 0.006],
      [r * 0.95, 0.02],
      [r, 0.027],
      [r * 0.97, 0.031],
      [r * 0.74, 0.016],
      [0, 0.015],
    ]),
    [0, y, 0],
  );
  k.torus('gloss', '#d23a45', r * 0.86, 0.0035, [0, y + 0.024, 0], {
    scale: [1, 0.3, 1],
  });
}

/** A wavy ring of lettuce leaves peeking out of a burger. */
function lettuce(k: Kit, y: number, r: number) {
  const n = 64;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wave = Math.sin(a * 9) * 0.012 + Math.sin(a * 4 + 1) * 0.006;
    const outer = r + 0.016 + wave;
    const lift = Math.sin(a * 9 + 0.8) * 0.006;
    pos.push(Math.cos(a) * (r - 0.03), 0.004, Math.sin(a) * (r - 0.03));
    pos.push(Math.cos(a) * outer, lift - 0.006, Math.sin(a) * outer);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const two = mergeSided(g);
  k.add('paint', '#5fbf45', two, [0, y, 0]);
}
/** Thin sheets need both faces in a merged, single-sided material. */
function mergeSided(g: THREE.BufferGeometry) {
  const flipped = g.clone();
  const index = flipped.getIndex()!;
  const a = index.array as unknown as number[];
  const swapped: number[] = [];
  for (let i = 0; i < a.length; i += 3) swapped.push(a[i], a[i + 2], a[i + 1]);
  flipped.setIndex(swapped);
  const both = new THREE.BufferGeometry();
  const p1 = g.getAttribute('position').array as Float32Array;
  const p2 = flipped.getAttribute('position').array as Float32Array;
  const positions = new Float32Array(p1.length + p2.length);
  positions.set(p1);
  positions.set(p2, p1.length);
  both.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const offset = p1.length / 3;
  both.setIndex([
    ...(g.getIndex()!.array as unknown as number[]),
    ...swapped.map((i) => i + offset),
  ]);
  both.computeVertexNormals();
  return both;
}

/** A slice of cheese, its corners drooping over the patty. */
function cheese(k: Kit, y: number, s: number) {
  const g = new THREE.PlaneGeometry(s, s, 8, 8);
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    const d = Math.max(0, Math.hypot(x, z) - s * 0.36);
    p.setY(i, -d * d * 9);
  }
  g.computeVertexNormals();
  g.rotateY(Math.PI / 4);
  k.add('gloss', '#ffc93a', mergeSided(g.index ? g : g), [0, y, 0]);
}

export function burger(k: Kit) {
  plate(k);
  const b = 0.016;
  // Bottom bun, patty, cheese, lettuce, tomato, top bun with seeds.
  k.add(
    'paint',
    '#e9a957',
    lathe([
      [0, 0],
      [0.098, 0],
      [0.104, 0.012],
      [0.1, 0.03],
      [0, 0.03],
    ]),
    [0, b, 0],
  );
  k.add(
    'paint',
    '#5a2f1c',
    lathe([
      [0, 0],
      [0.104, 0],
      [0.11, 0.012],
      [0.106, 0.034],
      [0, 0.036],
    ]),
    [0, b + 0.03, 0],
  );
  cheese(k, b + 0.068, 0.17);
  k.cyl('gloss', '#e8443a', 0.09, 0.09, 0.012, [0.012, b + 0.075, 0.006]);
  lettuce(k, b + 0.084, 0.1);
  k.add(
    'gloss',
    '#e79a45',
    lathe([
      [0, 0.0],
      [0.104, 0],
      [0.11, 0.012],
      [0.104, 0.04],
      [0.084, 0.066],
      [0.05, 0.08],
      [0, 0.085],
    ]),
    [0, b + 0.088, 0],
  );
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39996;
    const r = 0.02 + Math.sqrt((i + 0.5) / 14) * 0.065;
    const yy = b + 0.088 + 0.085 * (1 - (r / 0.11) ** 2) + 0.002;
    k.sphere(
      'paint',
      '#fff4d6',
      0.006,
      [Math.cos(a) * r, yy, Math.sin(a) * r],
      {
        scale: [1.6, 0.6, 0.9],
        rot: [0, a, 0],
        seg: 6,
      },
    );
  }
}

export function shake(k: Kit) {
  // A fluted sundae glass on a short stem, strawberry shake, whipped cream.
  k.add(
    'glass',
    '#ffffff',
    lathe(
      [
        [0.045, 0],
        [0.05, 0.006],
        [0.016, 0.02],
        [0.014, 0.05],
        [0.03, 0.058],
        [0.062, 0.1],
        [0.078, 0.2],
        [0.074, 0.2],
        [0.058, 0.1],
        [0.024, 0.062],
        [0, 0.06],
      ],
      20,
    ),
    [0, 0, 0],
  );
  k.add(
    'gloss',
    '#ff86b4',
    lathe(
      [
        [0, 0.062],
        [0.026, 0.064],
        [0.058, 0.102],
        [0.072, 0.19],
        [0, 0.19],
      ],
      20,
    ),
    [0, 0, 0],
  );
  for (let i = 0; i < 3; i++)
    k.torus('paint', '#fffaf2', 0.06 - i * 0.017, 0.022 - i * 0.004, [
      0,
      0.205 + i * 0.026,
      0,
    ]);
  k.cyl('paint', '#fffaf2', 0.0, 0.022, 0.04, [0, 0.282, 0]);
  k.sphere('gloss', '#d0102c', 0.018, [0.006, 0.31, 0]);
  k.tube(
    'paint',
    '#3b6b2a',
    [
      [0.006, 0.325, 0],
      [0.012, 0.345, 0.004],
      [0.022, 0.355, 0.006],
    ],
    0.0025,
  );
  // A red-and-white striped straw.
  for (let i = 0; i < 6; i++)
    k.cyl(
      'gloss',
      i % 2 ? '#ffffff' : '#e3313f',
      0.008,
      0.008,
      0.035,
      [0.034 + i * 0.006, 0.21 + i * 0.033, -0.01],
      {
        rot: [0, 0, -0.18],
      },
    );
}

export function fries(k: Kit) {
  // A flared red carton with a cream band, piled with golden fries.
  k.profile(
    'gloss',
    '#d8222f',
    [
      [0, 0.05, 0.034],
      [0.11, 0.072, 0.048],
      [0.13, 0.078, 0.052],
    ],
    [0, 0, 0],
  );
  k.profile(
    'paint',
    '#fff1d6',
    [
      [0.03, 0.057, 0.039],
      [0.06, 0.062, 0.042],
    ],
    [0, 0, 0],
    { scale: [1.02, 1, 1.02] },
  );
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996;
    const r = 0.012 + (i % 4) * 0.012;
    k.box(
      'paint',
      i % 3 ? '#f8cf4e' : '#eab23a',
      [0.016, 0.13 + (i % 5) * 0.012, 0.016],
      [Math.cos(a) * r, 0.14, Math.sin(a) * r * 0.7],
      {
        rot: [Math.sin(a) * 0.22, a, Math.cos(a) * 0.22],
      },
    );
  }
}

export function pie(k: Kit) {
  plate(k);
  // A wedge of cherry pie: golden crust, red filling on the cut faces,
  // a lattice top and a dollop of cream.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, 0.15, -0.42, 0.42, false);
  s.lineTo(0, 0);
  k.extrude('paint', '#e5a24c', s, 0.014, [-0.06, 0.018, 0]);
  k.extrude('gloss', '#b5122c', s, 0.04, [-0.06, 0.032, 0], {
    scale: [0.96, 1, 0.96],
  });
  k.tube(
    'paint',
    '#eab15c',
    Array.from({ length: 9 }, (_, i) => {
      const a = -0.42 + (i / 8) * 0.84;
      return [Math.cos(a) * 0.148 - 0.06, 0.068, Math.sin(a) * 0.148] as V3;
    }),
    0.014,
  );
  for (let i = 0; i < 3; i++)
    k.box(
      'paint',
      '#f2c27a',
      [0.012, 0.008, 0.11 - i * 0.025],
      [0.0 + i * 0.035, 0.074, 0],
      { rot: [0, 0, 0] },
    );
  for (let i = -1; i <= 1; i++)
    k.box('paint', '#f2c27a', [0.12, 0.008, 0.012], [0.02, 0.078, i * 0.03]);
  k.sphere('paint', '#fffaf2', 0.024, [0.03, 0.09, 0.0], {
    scale: [1, 0.8, 1],
  });
  k.sphere('paint', '#fffaf2', 0.014, [0.03, 0.11, 0.0]);
}

export function burnt(k: Kit) {
  plate(k);
  k.add(
    'paint',
    '#1c1512',
    lathe([
      [0, 0],
      [0.1, 0],
      [0.108, 0.016],
      [0.096, 0.04],
      [0.05, 0.05],
      [0, 0.048],
    ]),
    [0, 0.016, 0],
  );
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    k.sphere(
      'paint',
      '#3a2a22',
      0.02,
      [Math.cos(a) * 0.05, 0.062, Math.sin(a) * 0.05],
      { scale: [1.4, 0.4, 1] },
    );
  }
  k.sphere('glow', '#ff5a1e', 0.008, [0.03, 0.064, 0.02]);
  k.sphere('glow', '#ff7a2e', 0.006, [-0.04, 0.062, -0.01]);
}

export function dirty(k: Kit) {
  for (let i = 0; i < 3; i++) {
    const at: V3 = [i * 0.012, 0.0 + i * 0.03, -i * 0.012];
    k.add(
      'ceramic',
      '#f3ede1',
      lathe([
        [0, 0],
        [0.12, 0],
        [0.13, 0.006],
        [0.158, 0.02],
        [0.165, 0.026],
        [0.16, 0.03],
        [0.124, 0.015],
        [0, 0.014],
      ]),
      at,
      { rot: [0.05 * i, i * 0.6, 0.06 * i] },
    );
    k.sphere(
      'paint',
      i % 2 ? '#a0632f' : '#c5492f',
      0.026,
      [at[0] + 0.04 - i * 0.03, at[1] + 0.022, at[2] + 0.03],
      {
        scale: [1.5, 0.25, 1],
      },
    );
  }
  k.box('chrome', '#c9d2d8', [0.012, 0.006, 0.17], [0.05, 0.1, 0], {
    rot: [0, 0.5, 0.1],
  });
}

export function pot(k: Kit) {
  // A glass coffee pot with an orange lid and black handle.
  k.add(
    'glass',
    '#e8f4f8',
    lathe(
      [
        [0, 0],
        [0.07, 0],
        [0.085, 0.04],
        [0.08, 0.1],
        [0.05, 0.14],
        [0.046, 0.16],
        [0, 0.16],
      ],
      22,
    ),
    [0, 0, 0],
  );
  k.add(
    'paint',
    '#3a1d10',
    lathe(
      [
        [0, 0.004],
        [0.068, 0.004],
        [0.082, 0.04],
        [0.078, 0.085],
        [0, 0.085],
      ],
      22,
    ),
    [0, 0, 0],
  );
  k.cyl('gloss', '#ef7a2a', 0.05, 0.054, 0.03, [0, 0.168, 0], { seg: 20 });
  k.sphere('gloss', '#ef7a2a', 0.016, [0, 0.19, 0]);
  k.tube(
    'paint',
    '#25252b',
    [
      [0.07, 0.12, 0],
      [0.11, 0.11, 0],
      [0.11, 0.04, 0],
      [0.08, 0.03, 0],
    ],
    0.01,
  );
  k.cyl('chrome', '#d6dde2', 0.072, 0.074, 0.012, [0, 0.135, 0], { seg: 22 });
}

export function menuCard(k: Kit) {
  k.rbox('gloss', '#c8323f', [0.24, 0.32, 0.024], 0.016, [0, 0.16, 0], {
    rot: [-0.25, 0, 0],
  });
  k.box('paint', '#fff2db', [0.19, 0.08, 0.008], [0, 0.22, 0.018], {
    rot: [-0.25, 0, 0],
  });
  k.box('paint', '#f4c542', [0.19, 0.012, 0.008], [0, 0.12, 0.026], {
    rot: [-0.25, 0, 0],
  });
}

export function coins(k: Kit) {
  for (let i = 0; i < 6; i++)
    k.cyl(
      'chrome',
      '#f4c542',
      0.045,
      0.045,
      0.014,
      [(i % 2) * 0.012 - 0.006, 0.008 + i * 0.015, (i % 3) * 0.006],
      { seg: 20 },
    );
  k.cyl('chrome', '#f4c542', 0.045, 0.045, 0.014, [0.08, 0.008, 0.03], {
    seg: 20,
  });
  k.cyl('chrome', '#f9d76a', 0.045, 0.045, 0.014, [0.06, 0.012, -0.05], {
    seg: 20,
    rot: [0.2, 0, 0.1],
  });
}
