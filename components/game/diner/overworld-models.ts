import * as THREE from 'three';
import type { PlaceId } from '@/lib/games/diner/road';
import { Kit, meshes, type Materials } from './kit';
import { neonWord, RIG, wordWidth } from './rig';

/**
 * The road map's models (9 October 2026): chunky, rounded, toy-like
 * landmarks for each place at map scale, the Garage and the Motel, and the
 * scenery of the three stretches of road. Built from the same kit and
 * palette as the shift, so the map and the patio belong together.
 *
 * Every landmark stands at its own origin, its front toward +z (the camera);
 * the road passes on its inner side. Animated parts come back separately.
 */
type V3 = [number, number, number];

export type Landmark = {
  group: THREE.Group;
  /** Turning, sweeping or blinking parts. */
  update(time: number): void;
  /** Where the sign floats, in the landmark's frame. */
  top: number;
  /** Solid footprint radius, for the truck to bump into. */
  radius: number;
  dispose(): void;
};

const C = {
  cream: RIG.cream,
  cherry: RIG.cherry,
  cherryDark: RIG.cherryDark,
  sage: RIG.sage,
  steel: RIG.steel,
  chrome: RIG.chrome,
  ink: '#2f2b33',
  warm: RIG.warm,
  sky: '#6f9fc8',
  brick: '#a5584a',
  brickDark: '#7f4238',
  wood: '#8a5c3c',
  rose: '#c97d8c',
  gold: '#e3b04b',
  teal: '#4f8f8a',
};

function finish(
  mats: Materials,
  k: Kit,
  lit: Kit,
  glow: THREE.MeshBasicMaterial,
  group: THREE.Group,
) {
  group.add(meshes(k.build(), mats));
  for (const g of Object.values(lit.build()))
    if (g) group.add(new THREE.Mesh(g, glow));
}

function signBoard(
  k: Kit,
  lit: Kit,
  word: string,
  at: V3,
  h: number,
  colour: string,
  face = 1,
) {
  const w = wordWidth(word) * h + h * 0.8;
  k.rbox('gloss', colour, [w, h * 1.7, 0.3], 0.16, at);
  k.rbox('chrome', C.chrome, [w + 0.12, 0.1, 0.36], 0.04, [
    at[0],
    at[1] + h * 0.85 + 0.03,
    at[2],
  ]);
  k.rbox('chrome', C.chrome, [w + 0.12, 0.1, 0.36], 0.04, [
    at[0],
    at[1] - h * 0.85 - 0.03,
    at[2],
  ]);
  neonWord(
    lit,
    word,
    [at[0], at[1] - h * 0.5, at[2] + face * 0.17],
    h,
    Math.max(0.03, h * 0.065),
    '#fff1d6',
  );
  for (let i = 0; i < 9; i++)
    lit.sphere(
      'glow',
      C.warm,
      h * 0.07,
      [
        at[0] - w / 2 + 0.2 + (i * (w - 0.4)) / 8,
        at[1] + h * 0.68,
        at[2] + face * 0.16,
      ],
      { seg: 8 },
    );
}

function pump(k: Kit, lit: Kit, x: number, z: number, colour: string) {
  k.rbox('gloss', colour, [0.7, 1.7, 0.55], 0.18, [x, 0.95, z]);
  k.rbox('gloss', C.cream, [0.72, 0.5, 0.57], 0.14, [x, 1.5, z]);
  k.rbox('paint', C.ink, [0.4, 0.3, 0.05], 0.05, [x, 1.5, z + 0.3]);
  lit.sphere('glow', '#ffe5b8', 0.26, [x, 2.05, z], { seg: 16 });
  k.tube(
    'paint',
    C.ink,
    [
      [x + 0.36, 1.1, z],
      [x + 0.6, 0.5, z + 0.2],
      [x + 0.55, 0.2, z + 0.5],
    ],
    0.04,
  );
}

function tinyCar(
  k: Kit,
  lit: Kit,
  x: number,
  z: number,
  yaw: number,
  body: string,
) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const p = (dx: number, dy: number, dz: number): V3 => [
    x + dx * c + dz * s,
    dy,
    z - dx * s + dz * c,
  ];
  const r = { rot: [0, yaw, 0] as V3 };
  k.rbox('gloss', body, [2.4, 0.55, 1.2], 0.24, p(0, 0.5, 0), r);
  k.rbox('gloss', body, [1.2, 0.45, 1.05], 0.22, p(-0.15, 0.92, 0), r);
  k.rbox('gloss', RIG.glass, [1.05, 0.32, 1.08], 0.14, p(-0.15, 0.94, 0), r);
  k.rbox('chrome', C.chrome, [2.5, 0.1, 1.24], 0.05, p(0, 0.28, 0), r);
  for (const dx of [-0.75, 0.75])
    for (const dz of [-0.55, 0.55])
      k.cyl('paint', RIG.rubber, 0.24, 0.24, 0.2, p(dx, 0.24, dz), {
        axis: 'z',
        rot: [0, yaw, 0],
        seg: 14,
      });
  for (const dz of [-0.38, 0.38])
    lit.sphere('glow', '#fff0c8', 0.08, p(1.22, 0.55, dz), { seg: 8 });
}

/** One place's landmark at map scale. */
export function placeLandmark(
  mats: Materials,
  place: PlaceId | 'garage' | 'motel',
  quality: 'high' | 'low',
): Landmark {
  const group = new THREE.Group();
  const k = new Kit();
  const lit = new Kit();
  const glow = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  const owned: { dispose(): void }[] = [glow];
  let update: (t: number) => void = () => {};
  let top = 7;
  let radius = 4.2;
  const seg = quality === 'high' ? 1 : 0.6;

  switch (place) {
    case 'truckstop': {
      // A canopy over two pumps, and a tall EAT sign on a pole.
      for (const [x, z] of [
        [-2.2, -1.4],
        [2.2, -1.4],
        [-2.2, 1.4],
        [2.2, 1.4],
      ])
        k.cyl('chrome', C.steel, 0.12, 0.14, 3.4, [x, 1.7, z], { seg: 12 });
      k.rbox('gloss', C.cream, [5.6, 0.36, 3.8], 0.16, [0, 3.55, 0]);
      k.rbox('gloss', C.cherry, [5.7, 0.26, 3.9], 0.12, [0, 3.3, 0]);
      for (let i = 0; i < 4; i++)
        lit.box('glow', C.warm, [0.9, 0.05, 0.4], [-2 + i * 1.33, 3.14, 0]);
      k.rbox('paint', '#8a8682', [4.6, 0.2, 2.2], 0.08, [0, 0.1, 0]);
      pump(k, lit, -1.1, 0, C.cherry);
      pump(k, lit, 1.1, 0, C.sage);
      k.cyl('paint', C.ink, 0.16, 0.2, 7.5, [-3.6, 3.75, -1.2], { seg: 12 });
      signBoard(k, lit, 'EAT', [-3.6, 7.6, -1.0], 0.9, C.cherry);
      // A star on top.
      lit.sphere('glow', C.gold, 0.3, [-3.6, 9.1, -1.0], { seg: 12 });
      top = 9.6;
      radius = 3.8;
      break;
    }
    case 'drivein': {
      k.rbox('paint', '#3a3e46', [8.4, 5, 0.5], 0.12, [0, 4.4, -2]);
      lit.box('glow', '#9dbbe6', [7.6, 4.2, 0.05], [0, 4.45, -1.72]);
      // A silhouette on screen: two heads close together.
      lit.sphere('glow', '#6c87b6', 0.75, [-0.6, 3.5, -1.68], {
        scale: [1, 1.2, 0.05],
      });
      lit.sphere('glow', '#6c87b6', 0.68, [0.55, 3.4, -1.68], {
        scale: [1, 1.2, 0.05],
      });
      for (const x of [-3, 3])
        k.box('paint', '#3a3e46', [0.35, 2.4, 0.35], [x, 1.2, -1.9]);
      tinyCar(k, lit, -2.4, 1.6, Math.PI / 2 + 0.15, '#6f9fb8');
      tinyCar(k, lit, 0.4, 2.1, Math.PI / 2, '#c56a6a');
      tinyCar(k, lit, 3.1, 1.7, Math.PI / 2 - 0.15, '#e0c27a');
      for (const x of [-1, 1.8]) {
        k.cyl('paint', '#55595e', 0.05, 0.05, 1.1, [x, 0.55, 3.0], { seg: 8 });
        k.rbox('gloss', '#7f8a8f', [0.24, 0.2, 0.12], 0.04, [x, 1.15, 3.0]);
      }
      top = 7.4;
      radius = 4.4;
      break;
    }
    case 'fairground': {
      const wheel = new THREE.Group();
      const wk = new Kit();
      const wl = new Kit();
      const R = 3.6;
      wk.torus('chrome', '#d9dde0', R, 0.09, [0, 0, 0], {
        rot: [Math.PI / 2, 0, 0],
      });
      wk.torus('chrome', '#d9dde0', R * 0.45, 0.06, [0, 0, 0], {
        rot: [Math.PI / 2, 0, 0],
      });
      const cars = 10;
      for (let i = 0; i < cars; i++) {
        const a = (i / cars) * Math.PI * 2;
        wk.cyl(
          'chrome',
          '#d9dde0',
          0.04,
          0.04,
          R,
          [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 0],
          { rot: [0, 0, a + Math.PI / 2] },
        );
        wl.sphere(
          'glow',
          i % 2 ? C.warm : '#f2a8c0',
          0.13,
          [Math.cos(a) * R, Math.sin(a) * R, 0.12],
          { seg: 8 },
        );
      }
      wheel.add(meshes(wk.build(), mats));
      for (const g of Object.values(wl.build()))
        if (g) wheel.add(new THREE.Mesh(g, glow));
      wheel.position.set(-1.2, 4.6, -1);
      group.add(wheel);
      // The gondolas hang level as the wheel turns.
      const gondolas = Array.from({ length: cars }, (_, i) => {
        const g = new THREE.Group();
        const gk = new Kit();
        gk.rbox(
          'gloss',
          ['#c95d74', '#5f8fb0', '#e3b04b', '#86ad83', '#b07ac9'][i % 5],
          [0.7, 0.62, 0.7],
          0.14,
          [0, -0.45, 0],
        );
        gk.cyl('chrome', C.chrome, 0.03, 0.03, 0.3, [0, -0.08, 0]);
        g.add(meshes(gk.build(), mats));
        group.add(g);
        return g;
      });
      for (const s of [-1, 1]) {
        k.cyl(
          'paint',
          '#4b4652',
          0.14,
          0.2,
          5.2,
          [-1.2 + s * 1.5, 2.3, -1.35],
          { rot: [0, 0, s * 0.3] },
        );
        k.cyl(
          'paint',
          '#4b4652',
          0.14,
          0.2,
          5.2,
          [-1.2 + s * 1.5, 2.3, -0.65],
          { rot: [0, 0, s * 0.3] },
        );
      }
      k.cyl('chrome', C.chrome, 0.16, 0.16, 1, [-1.2, 4.6, -1], { axis: 'z' });
      // A striped tent beside it.
      const n = 12;
      for (let i = 0; i < n; i++) {
        const cone = new THREE.ConeGeometry(
          1.9,
          1.6,
          1,
          1,
          true,
          (i / n) * Math.PI * 2,
          (Math.PI * 2) / n,
        );
        k.add('cloth', i % 2 ? C.cream : '#c95d74', cone, [2.7, 2.6, 1.0]);
        const wall = new THREE.CylinderGeometry(
          1.8,
          1.8,
          1.8,
          1,
          1,
          true,
          (i / n) * Math.PI * 2,
          (Math.PI * 2) / n,
        );
        k.add('cloth', i % 2 ? '#c95d74' : C.cream, wall, [2.7, 0.9, 1.0]);
      }
      k.sphere('gloss', C.cherry, 0.16, [2.7, 3.45, 1.0]);
      update = (t) => {
        wheel.rotation.z = t * 0.25;
        gondolas.forEach((g, i) => {
          const a = (i / cars) * Math.PI * 2 + t * 0.25;
          g.position.set(
            -1.2 + Math.cos(a) * R,
            4.6 + Math.sin(a) * R,
            -1 + 0.2,
          );
        });
      };
      update(0);
      top = 9.4;
      radius = 4.6;
      break;
    }
    case 'harbour': {
      // A lighthouse on rocks by a patch of water, a little pier and a boat.
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(4.2, 32 * seg + 8),
        new THREE.MeshStandardMaterial({
          color: '#2f6f86',
          roughness: 0.2,
          metalness: 0.1,
        }),
      );
      owned.push(water.geometry, water.material as THREE.Material);
      water.rotation.x = -Math.PI / 2;
      water.position.set(1.4, 0.03, -0.4);
      group.add(water);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        k.sphere(
          'paint',
          '#7c7a7e',
          0.6 + (i % 3) * 0.2,
          [-2.2 + Math.cos(a) * 1.2, 0.3, -1.6 + Math.sin(a) * 1.2],
          { scale: [1.2, 0.7, 1], seg: 10 },
        );
      }
      k.cyl('ceramic', C.cream, 0.75, 1.15, 6.4, [-2.2, 3.4, -1.6], {
        seg: 24,
      });
      for (const y of [1.4, 3.6])
        k.cyl(
          'gloss',
          C.cherry,
          1.04 - y * 0.055,
          1.08 - y * 0.055,
          1,
          [-2.2, y, -1.6],
          { seg: 24 },
        );
      k.cyl('paint', C.ink, 1.05, 1.05, 0.15, [-2.2, 6.65, -1.6], { seg: 20 });
      lit.cyl('glow', '#ffeec2', 0.6, 0.6, 0.8, [-2.2, 7.1, -1.6], { seg: 16 });
      k.add(
        'gloss',
        C.cherry,
        new THREE.ConeGeometry(0.85, 0.8, 20),
        [-2.2, 7.9, -1.6],
      );
      // The beam: a long soft cone that sweeps round.
      const beamGeo = new THREE.ConeGeometry(1.4, 12, 18, 1, true);
      beamGeo.translate(0, -6, 0);
      beamGeo.rotateZ(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        color: '#fff3c8',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      });
      owned.push(beamGeo, beamMat);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(-2.2, 7.1, -1.6);
      group.add(beam);
      k.rbox('wood', C.wood, [1.0, 0.16, 4.2], 0.04, [2.4, 0.35, 0.2]);
      for (const z of [-1.6, 0, 1.6])
        for (const x of [1.95, 2.85])
          k.cyl('wood', '#6a4a35', 0.08, 0.08, 0.7, [x, 0.1, z], { seg: 8 });
      const boat = new THREE.Group();
      const bk = new Kit();
      bk.rbox('gloss', C.cream, [2.2, 0.5, 0.95], 0.22, [0, 0.25, 0]);
      bk.rbox('gloss', C.teal, [2.25, 0.16, 1.0], 0.08, [0, 0.1, 0]);
      bk.rbox('gloss', C.cream, [0.8, 0.5, 0.7], 0.12, [-0.2, 0.7, 0]);
      boat.add(meshes(bk.build(), mats));
      boat.position.set(0.4, 0.1, -1.4);
      boat.rotation.y = 0.4;
      group.add(boat);
      update = (t) => {
        beam.rotation.y = t * 0.9;
        boat.position.y = 0.08 + Math.sin(t * 1.4) * 0.06;
        boat.rotation.z = Math.sin(t * 1.1) * 0.05;
      };
      top = 9.2;
      radius = 4.2;
      break;
    }
    case 'oldtown': {
      // A brick clock tower and two gabled shops with lit windows.
      k.rbox('paint', C.brick, [2, 7, 2], 0.08, [-1.4, 3.5, -1.4]);
      k.rbox('paint', C.brickDark, [2.2, 0.3, 2.2], 0.06, [-1.4, 7.1, -1.4]);
      k.add(
        'paint',
        '#3d3f47',
        new THREE.ConeGeometry(1.65, 2.2, 4),
        [-1.4, 8.35, -1.4],
        { rot: [0, Math.PI / 4, 0] },
      );
      k.cyl('ceramic', C.cream, 0.66, 0.66, 0.12, [-1.4, 5.8, -0.36], {
        axis: 'z',
        seg: 24,
      });
      lit.cyl('glow', '#ffe9b8', 0.55, 0.55, 0.05, [-1.4, 5.8, -0.28], {
        axis: 'z',
        seg: 24,
      });
      k.box('paint', C.ink, [0.06, 0.45, 0.04], [-1.4, 5.95, -0.24]);
      k.box('paint', C.ink, [0.35, 0.06, 0.04], [-1.25, 5.8, -0.24]);
      for (const [x, z, w, colour] of [
        [1.4, -1.0, 2.6, '#c9a27a'],
        [1.6, 1.8, 2.2, '#9fb39a'],
      ] as const) {
        k.rbox('paint', colour, [w, 2.6, 2.2], 0.06, [x, 1.3, z]);
        const roof = new THREE.CylinderGeometry(0.01, 1.6, 1.4, 4, 1);
        roof.rotateY(Math.PI / 4);
        roof.scale(w / 2.2, 1, 1.1);
        k.add('gloss', C.cherryDark, roof, [x, 3.3, z]);
        for (const dx of [-0.55, 0.55])
          lit.box('glow', C.warm, [0.5, 0.6, 0.05], [x + dx, 1.5, z + 1.12]);
        k.rbox('wood', C.wood, [0.6, 1.1, 0.06], 0.03, [x, 0.55, z + 1.12]);
      }
      top = 9.4;
      radius = 3.9;
      break;
    }
    case 'moonmile': {
      // A rocket on a pole (a motel's old sign), a radio dish, crater rocks.
      k.cyl('paint', '#4a4250', 0.14, 0.18, 4.5, [-1.6, 2.25, -0.8], {
        seg: 12,
      });
      const rocket = new THREE.Group();
      const rk = new Kit();
      rk.capsule('gloss', C.cream, 0.55, 2.1, [0, 0, 0]);
      rk.add(
        'gloss',
        C.cherry,
        new THREE.ConeGeometry(0.55, 0.9, 22),
        [0, 1.85, 0],
      );
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        rk.rbox(
          'gloss',
          C.cherry,
          [0.1, 0.9, 0.6],
          0.04,
          [Math.cos(a) * 0.55, -1.0, Math.sin(a) * 0.55],
          { rot: [0, -a, 0] },
        );
      }
      rk.cyl('chrome', C.chrome, 0.24, 0.24, 0.06, [0, 0.3, 0.53], {
        axis: 'z',
        seg: 18,
      });
      rocket.add(meshes(rk.build(), mats));
      const rl = new Kit();
      rl.cyl('glow', '#b9a0ff', 0.18, 0.18, 0.02, [0, 0.3, 0.57], {
        axis: 'z',
        seg: 18,
      });
      rl.add(
        'glow',
        '#ffb347',
        new THREE.ConeGeometry(0.4, 1.0, 14, 1, true),
        [0, -2.1, 0],
        { rot: [Math.PI, 0, 0] },
      );
      for (const g of Object.values(rl.build()))
        if (g) rocket.add(new THREE.Mesh(g, glow));
      rocket.position.set(-1.6, 5.9, -0.8);
      group.add(rocket);
      k.cyl('paint', '#4a4250', 0.3, 0.45, 2.4, [2.2, 1.2, -1.6], { seg: 14 });
      const dish = new THREE.Group();
      const dk = new Kit();
      dk.dome('chrome', '#cfcadb', 1.9, [0, 0, 0], Math.PI / 2, {
        scale: [1, 0.42, 1],
      });
      dk.cyl('chrome', C.steel, 0.05, 0.05, 1.4, [0, -0.2, 0]);
      dish.add(meshes(dk.build(), mats));
      dish.position.set(2.2, 2.7, -1.6);
      dish.rotation.x = Math.PI - 0.9;
      group.add(dish);
      for (const [x, z, r] of [
        [3.2, 1.6, 0.7],
        [-3.4, 1.8, 0.5],
        [0.2, -3.0, 0.9],
      ] as const) {
        k.torus('paint', '#8a6a7e', r, r * 0.25, [x, 0.06, z]);
        k.sphere('paint', '#6d5363', r * 0.5, [x + r * 1.4, 0.15, z - 0.4], {
          scale: [1.2, 0.6, 1],
          seg: 9,
        });
      }
      update = (t) => {
        rocket.position.y = 5.9 + Math.sin(t * 1.3) * 0.08;
        dish.rotation.y = Math.sin(t * 0.3) * 0.6;
      };
      top = 8.4;
      radius = 3.8;
      break;
    }
    case 'garage': {
      k.rbox('paint', '#d9cbb0', [6, 3.4, 3.6], 0.1, [0, 1.7, -0.8]);
      k.rbox('gloss', C.sage, [6.2, 0.4, 3.8], 0.1, [0, 3.5, -0.8]);
      for (const x of [-1.5, 1.5]) {
        k.rbox('paint', '#3c3a40', [2.4, 2.4, 0.1], 0.04, [x, 1.25, 1.02]);
        lit.box('glow', '#ffd59a', [2.2, 1.3, 0.05], [x, 0.8, 1.06]);
        for (let i = 0; i < 4; i++)
          k.box(
            'chrome',
            '#8b8f96',
            [2.3, 0.06, 0.04],
            [x, 1.55 + i * 0.22, 1.08],
          );
      }
      signBoard(k, lit, 'GARAGE', [0, 4.6, -0.4], 0.62, C.cherry);
      for (let i = 0; i < 4; i++)
        k.torus('paint', RIG.rubber, 0.42, 0.16, [3.6, 0.16 + i * 0.3, 1.2]);
      k.cyl('gloss', '#3f6b8a', 0.32, 0.32, 0.95, [-3.6, 0.48, 1.0], {
        seg: 16,
      });
      top = 6.4;
      radius = 4.2;
      break;
    }
    case 'motel': {
      k.rbox('paint', '#e6d7bd', [6.4, 2.3, 2.6], 0.08, [0.4, 1.15, -1.2]);
      k.rbox('gloss', '#5f8fb0', [6.8, 0.3, 3.2], 0.08, [0.4, 2.4, -1.0]);
      for (let i = 0; i < 5; i++) {
        const x = -2.2 + i * 1.3;
        k.rbox(
          'gloss',
          ['#c95d74', '#e3b04b', '#86ad83'][i % 3],
          [0.6, 1.4, 0.06],
          0.03,
          [x, 0.75, 0.12],
        );
        if (i % 2 === 0)
          lit.box('glow', C.warm, [0.4, 0.45, 0.05], [x + 0.55, 1.3, 0.12]);
      }
      // A tall neon arrow sign.
      k.cyl('paint', C.ink, 0.13, 0.16, 6.4, [-3.6, 3.2, 0.2], { seg: 12 });
      signBoard(k, lit, 'MOTEL', [-3.6, 6.2, 0.3], 0.6, '#5f8fb0');
      const arrow = new THREE.Shape();
      arrow.moveTo(0, 0);
      arrow.lineTo(1.8, 0);
      arrow.lineTo(1.8, -0.35);
      arrow.lineTo(2.5, 0.25);
      arrow.lineTo(1.8, 0.85);
      arrow.lineTo(1.8, 0.5);
      arrow.lineTo(0, 0.5);
      arrow.closePath();
      const ag = new THREE.ExtrudeGeometry(arrow, {
        depth: 0.2,
        bevelEnabled: false,
      });
      k.add('gloss', C.cherry, ag, [-3.5, 4.4, 0.2]);
      for (let i = 0; i < 6; i++)
        lit.sphere('glow', C.warm, 0.07, [-3.3 + i * 0.4, 4.65, 0.42], {
          seg: 8,
        });
      top = 7.6;
      radius = 4;
      break;
    }
  }
  finish(mats, k, lit, glow, group);
  return {
    group,
    update,
    top,
    radius,
    dispose() {
      group.traverse((n) => {
        if (n instanceof THREE.Mesh) n.geometry.dispose();
      });
      for (const d of owned) d.dispose();
    },
  };
}

// ---------------------------------------------------------------- scenery

export type Biome = 'desert' | 'coast' | 'moon';

/** A saguaro, a pine, a palm, a bush or a rock, at map scale. */
export function decor(
  k: Kit,
  kind: string,
  x: number,
  z: number,
  s: number,
  rot: number,
) {
  switch (kind) {
    case 'saguaro': {
      const g = '#6f9468';
      k.capsule('paint', g, 0.35 * s, 2.6 * s, [x, 1.6 * s, z]);
      k.capsule('paint', g, 0.24 * s, 0.9 * s, [x - 0.62 * s, 2.0 * s, z]);
      k.capsule('paint', g, 0.22 * s, 0.6 * s, [x - 0.34 * s, 1.45 * s, z], {
        rot: [0, 0, Math.PI / 2],
      });
      k.capsule('paint', g, 0.22 * s, 0.7 * s, [x + 0.58 * s, 2.4 * s, z]);
      k.capsule('paint', g, 0.2 * s, 0.5 * s, [x + 0.32 * s, 1.95 * s, z], {
        rot: [0, 0, Math.PI / 2],
      });
      break;
    }
    case 'rock':
      k.sphere('paint', '#b0806c', 0.9 * s, [x, 0.4 * s, z], {
        scale: [1.3, 0.75, 1.1],
        rot: [0, rot, 0],
        seg: 10,
      });
      k.sphere(
        'paint',
        '#9a6e5e',
        0.55 * s,
        [x + 0.9 * s, 0.25 * s, z + 0.3 * s],
        { scale: [1.2, 0.7, 1], seg: 9 },
      );
      break;
    case 'mesa': {
      const g = new THREE.CylinderGeometry(4 * s, 5.2 * s, 5 * s, 9, 1);
      g.rotateY(rot);
      k.add('paint', '#b9735a', g, [x, 2.5 * s, z]);
      const cap = new THREE.CylinderGeometry(4.1 * s, 4.1 * s, 0.6 * s, 9, 1);
      cap.rotateY(rot);
      k.add('paint', '#c98a6a', cap, [x, 5.1 * s, z]);
      break;
    }
    case 'pine':
      k.cyl('wood', '#6a4a35', 0.16 * s, 0.22 * s, 1.2 * s, [x, 0.6 * s, z], {
        seg: 8,
      });
      for (let i = 0; i < 3; i++)
        k.add(
          'paint',
          i === 1 ? '#3f6e57' : '#477a60',
          new THREE.ConeGeometry((1.5 - i * 0.38) * s, (1.6 - i * 0.2) * s, 9),
          [x, (1.5 + i * 0.85) * s, z],
          { rot: [0, rot + i, 0] },
        );
      break;
    case 'bush':
      for (let i = 0; i < 3; i++)
        k.sphere(
          'paint',
          i % 2 ? '#5f8a5c' : '#6f9a68',
          (0.55 - i * 0.1) * s,
          [x + (i - 1) * 0.45 * s, 0.4 * s, z + (i % 2) * 0.2 * s],
          { seg: 10 },
        );
      break;
    case 'palm': {
      const pts: V3[] = [];
      for (let i = 0; i <= 6; i++)
        pts.push([x + Math.sin(i * 0.25) * 0.6 * s, i * 0.7 * s, z]);
      k.tube('wood', '#8f6d4e', pts, 0.16 * s);
      const tx = pts[6][0];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rot;
        k.sphere(
          'paint',
          '#5d8a54',
          0.55 * s,
          [tx + Math.cos(a) * 0.9 * s, 4.0 * s, z + Math.sin(a) * 0.9 * s],
          { scale: [2, 0.25, 0.7], rot: [0, -a, -0.35], seg: 8 },
        );
      }
      break;
    }
    case 'crystal':
      for (let i = 0; i < 3; i++)
        k.add(
          'paint',
          i === 1 ? '#8f7ac9' : '#a58fe0',
          new THREE.ConeGeometry(0.35 * s, (1.6 - i * 0.4) * s, 5),
          [x + (i - 1) * 0.4 * s, 0.7 * s, z],
          { rot: [(i - 1) * 0.3, rot, (i - 1) * 0.25] },
        );
      break;
    case 'crater':
      // A low rim round a darker dish, nearly flush with the sand.
      k.torus('paint', '#8e6f86', 1.4 * s, 0.34 * s, [x, 0.02, z], {
        scale: [1, 0.32, 1],
      });
      k.cyl('paint', '#6a4f63', 1.3 * s, 1.1 * s, 0.04, [x, 0.01, z], {
        seg: 20,
      });
      break;
    case 'post':
      k.cyl('wood', '#6a4a35', 0.08, 0.1, 1.6, [x, 0.8, z], { seg: 8 });
      break;
  }
}

/** The kinds of scenery each stretch of road scatters, with odds. */
export const BIOME_DECOR: Record<Biome, [string, number][]> = {
  desert: [
    ['saguaro', 3],
    ['rock', 3],
    ['bush', 1],
  ],
  coast: [
    ['pine', 4],
    ['bush', 3],
    ['palm', 1],
    ['rock', 1],
  ],
  moon: [
    ['rock', 2],
    ['crystal', 2],
    ['crater', 2],
    ['saguaro', 1],
  ],
};

/** Ground, sky and light for each stretch: dusk, then twilight, then night. */
export const BIOME_LOOK: Record<
  Biome,
  {
    ground: string;
    groundFar: string;
    sky: string;
    horizon: string;
    sun: string;
    sunI: number;
    hemi: number;
  }
> = {
  desert: {
    ground: '#d2a77c',
    groundFar: '#c79570',
    sky: '#4d5a9a',
    horizon: '#f0b48a',
    sun: '#ffd2a0',
    sunI: 2.4,
    hemi: 0.9,
  },
  coast: {
    ground: '#86a86e',
    groundFar: '#759a62',
    sky: '#3c4f8c',
    horizon: '#e3a2a4',
    sun: '#ffd6c4',
    sunI: 2.1,
    hemi: 0.85,
  },
  moon: {
    ground: '#9a7f9c',
    groundFar: '#86708c',
    sky: '#231c4c',
    horizon: '#7a5aa6',
    sun: '#d9d2ff',
    sunI: 1.8,
    hemi: 0.8,
  },
};
