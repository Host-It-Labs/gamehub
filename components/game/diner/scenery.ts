import * as THREE from 'three';
import { DOOR_GAP, W } from '@/lib/games/diner/layout';
import type { PlaceId } from '@/lib/games/diner/road';
import { Kit, meshes, type Materials } from './kit';
import { RIG } from './rig';
import type { StageCues } from './stage-contract';

/**
 * What stands around the patio at each place (9 October 2026). A few chunky,
 * well-made things on the left, right and front edges (what a landscape
 * screen shows beside the deck) and one landmark far behind the trailer for
 * taller screens. Nothing here is lit brighter than the patio.
 *
 * Keep clear: the deck (x -0.4..W+0.4, z 1.3..D+0.2) and the guests' path in
 * from the left (x < -0.3, z around the gate).
 */
export type Scenery = {
  group: THREE.Group;
  update(cues: StageCues): void;
  dispose(): void;
};

type V3 = [number, number, number];
const L = -1.4; // just left of the deck
const R = W + 1.4; // just right of the deck

/** A rounded 1950s car, facing +x at the origin, for drive-ins and lots. */
function car(k: Kit, lit: Kit, at: V3, yaw: number, body: string) {
  const [x, y, z] = at;
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const p = (dx: number, dy: number, dz: number): V3 => [
    x + dx * c + dz * s,
    y + dy,
    z - dx * s + dz * c,
  ];
  const rot = { rot: [0, yaw, 0] as V3 };
  k.rbox('gloss', body, [3.6, 0.6, 1.7], 0.26, p(0, 0.55, 0), rot);
  k.rbox('gloss', body, [1.8, 0.5, 1.5], 0.24, p(-0.2, 1.0, 0), rot);
  k.rbox('gloss', RIG.glass, [1.6, 0.36, 1.52], 0.18, p(-0.2, 1.02, 0), rot);
  k.rbox('chrome', RIG.chrome, [3.7, 0.12, 1.74], 0.05, p(0, 0.32, 0), rot);
  k.rbox('gloss', RIG.cream, [3.62, 0.08, 1.72], 0.04, p(0, 0.7, 0), rot);
  for (const dx of [-1.15, 1.15])
    for (const dz of [-0.78, 0.78])
      k.cyl('paint', RIG.rubber, 0.32, 0.32, 0.24, p(dx, 0.32, dz), {
        axis: 'z',
        rot: [0, yaw, 0],
        seg: 18,
      });
  for (const dz of [-0.55, 0.55])
    lit.sphere('glow', '#fff1c8', 0.09, p(1.8, 0.62, dz), { seg: 10 });
  for (const dz of [-0.6, 0.6])
    lit.sphere('glow', '#ff5a4d', 0.07, p(-1.82, 0.62, dz), { seg: 10 });
}

function cactus(k: Kit, x: number, z: number, h: number) {
  const g = '#5f7f5e';
  k.capsule('paint', g, 0.2, h, [x, h / 2 + 0.2, z]);
  k.capsule('paint', g, 0.13, h * 0.35, [x - 0.32, h * 0.62, z], {});
  k.capsule('paint', g, 0.13, 0.32, [x - 0.2, h * 0.42, z], {
    rot: [0, 0, Math.PI / 2],
  });
  k.capsule('paint', g, 0.12, h * 0.28, [x + 0.3, h * 0.72, z]);
  k.capsule('paint', g, 0.12, 0.28, [x + 0.18, h * 0.55, z], {
    rot: [0, 0, Math.PI / 2],
  });
}

function rock(k: Kit, x: number, z: number, r: number, colour: string) {
  k.sphere('paint', colour, r, [x, r * 0.35, z], {
    scale: [1.3, 0.75, 1],
    seg: 10,
  });
  k.sphere('paint', colour, r * 0.6, [x + r * 0.8, r * 0.2, z + r * 0.3], {
    scale: [1.2, 0.7, 1],
    seg: 9,
  });
}

function streetLamp(k: Kit, lit: Kit, x: number, z: number) {
  k.cyl('paint', '#2c3236', 0.06, 0.09, 3.4, [x, 1.7, z], { seg: 12 });
  k.cyl('paint', '#2c3236', 0.16, 0.2, 0.18, [x, 0.09, z], { seg: 14 });
  k.cyl('paint', '#2c3236', 0.2, 0.12, 0.2, [x, 3.5, z], { seg: 6 });
  lit.cyl('glow', '#ffd59a', 0.15, 0.15, 0.32, [x, 3.33, z], { seg: 6 });
}

function crate(k: Kit, x: number, y: number, z: number, s: number, rot = 0) {
  k.rbox('wood', '#8a6243', [s, s, s], 0.03, [x, y + s / 2, z], {
    rot: [0, rot, 0],
  });
  k.box('wood', '#6d4b33', [s + 0.01, 0.06, s + 0.01], [x, y + s * 0.5, z], {
    rot: [0, rot, 0],
  });
}

function stripeTent(
  k: Kit,
  x: number,
  z: number,
  r: number,
  h: number,
  a: string,
  b: string,
) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const g = new THREE.ConeGeometry(
      r,
      h * 0.45,
      1,
      1,
      true,
      (i / n) * Math.PI * 2,
      (Math.PI * 2) / n,
    );
    k.add('cloth', i % 2 ? a : b, g, [x, h * 0.775, z]);
    const w = new THREE.CylinderGeometry(
      r * 0.96,
      r * 0.96,
      h * 0.55,
      1,
      1,
      true,
      (i / n) * Math.PI * 2,
      (Math.PI * 2) / n,
    );
    k.add('cloth', i % 2 ? b : a, w, [x, h * 0.275, z]);
  }
  k.sphere('gloss', RIG.cherry, 0.12, [x, h + 0.05, z]);
}

export function buildScenery(
  mats: Materials,
  place: PlaceId,
  quality: 'high' | 'low',
): Scenery {
  const group = new THREE.Group();
  const k = new Kit();
  const lit = new Kit();
  const moving: {
    node: THREE.Object3D;
    spin?: number;
    bob?: number;
    base?: number;
  }[] = [];
  const owned: { dispose(): void }[] = [];
  let water: THREE.Mesh | null = null;
  const detail = quality === 'high';

  switch (place) {
    case 'truckstop': {
      // A pump island on the right, a parked rig's trailer beyond it.
      k.rbox('paint', '#8d8a86', [1.4, 0.18, 4.6], 0.05, [R + 1.2, -0.11, 6.2]);
      for (const z of [4.8, 7.6]) {
        k.rbox('gloss', RIG.cherry, [0.6, 1.5, 0.5], 0.12, [R + 1.2, 0.75, z]);
        k.rbox('gloss', RIG.cream, [0.62, 0.42, 0.52], 0.1, [R + 1.2, 1.3, z]);
        k.rbox('paint', '#2c2c30', [0.06, 0.26, 0.3], 0.03, [R + 0.88, 1.3, z]);
        lit.sphere('glow', '#ffe2b0', 0.2, [R + 1.2, 1.78, z], { seg: 14 });
        k.tube(
          'paint',
          '#25252a',
          [
            [R + 0.9, 1.0, z],
            [R + 0.7, 0.4, z + 0.3],
            [R + 0.85, 0.2, z + 0.6],
          ],
          0.03,
        );
      }
      k.rbox('gloss', '#c9c2b2', [3.2, 2.9, 11], 0.12, [R + 5.4, 1.6, 4.5]);
      k.rbox('gloss', RIG.cherry, [3.22, 0.3, 11.02], 0.06, [
        R + 5.4,
        1.2,
        4.5,
      ]);
      for (const dz of [-3.5, -2.3, 3.2, 4.4])
        k.cyl('paint', RIG.rubber, 0.5, 0.5, 2.6, [R + 5.4, 0.5, 4.5 + dz], {
          axis: 'x',
          seg: 18,
        });
      // Tire stack and oil drums on the left, clear of the gate path.
      for (let i = 0; i < 3; i++)
        k.torus('paint', RIG.rubber, 0.36, 0.14, [
          L - 0.9,
          0.14 + i * 0.27,
          7.6,
        ]);
      for (const [dx, dz] of [
        [0, 0],
        [0.62, 0.2],
        [0.3, -0.55],
      ])
        k.cyl(
          'gloss',
          dx ? '#3f6b8a' : '#b8762e',
          0.29,
          0.29,
          0.88,
          [L - 1.3 + dx, 0.44, 9.6 + dz],
          { seg: 18 },
        );
      // Far behind: a tall pole sign.
      k.cyl('paint', '#3a3a40', 0.18, 0.22, 9, [W + 4, 4.5, -9]);
      k.rbox('gloss', RIG.cherry, [4.2, 2, 0.4], 0.25, [W + 4, 9.4, -9]);
      lit.box('glow', '#ffcf8f', [3.6, 1.4, 0.05], [W + 4, 9.4, -8.78]);
      streetLamp(k, lit, L - 2.4, 11.4);
      break;
    }
    case 'drivein': {
      car(k, lit, [L - 2.6, 0, 6.6], Math.PI / 2 + 0.25, '#6f9fb8');
      car(k, lit, [R + 2.2, 0, 7.2], -Math.PI / 2 - 0.2, '#c56a6a');
      car(k, lit, [R + 2.6, 0, 2.4], -Math.PI / 2 + 0.1, '#e0c27a');
      for (const [x, z] of [
        [L - 0.9, 9.4],
        [R + 0.6, 4.8],
        [R + 0.6, 9.8],
      ]) {
        k.cyl('paint', '#55595e', 0.05, 0.05, 1.3, [x, 0.65, z], { seg: 10 });
        k.rbox('gloss', '#7f8a8f', [0.3, 0.22, 0.14], 0.05, [x, 1.32, z]);
        lit.sphere('glow', '#9fd4ff', 0.03, [x, 1.32, z + 0.08]);
      }
      // The screen far behind, glowing faintly blue.
      k.rbox('paint', '#2d3138', [18, 9, 0.6], 0.1, [W / 2, 5.6, -14]);
      lit.box('glow', '#6f8fbf', [16.6, 7.4, 0.05], [W / 2, 5.8, -13.68]);
      for (const x of [W / 2 - 7, W / 2 + 7])
        k.box('paint', '#2d3138', [0.4, 5, 0.4], [x, 1.5, -13.6]);
      break;
    }
    case 'fairground': {
      stripeTent(k, R + 2.6, 6.6, 1.9, 3.6, RIG.cream, '#c95d74');
      stripeTent(k, L - 2.8, 8.4, 1.5, 3.0, RIG.cream, '#5f8fb0');
      // Bunting strung down both sides, beyond the rail.
      for (const x of [-2.2, W + 2.2]) {
        for (const z of [2.2, 11])
          k.cyl('paint', '#4b4040', 0.05, 0.05, 3.4, [x, 1.7, z], { seg: 8 });
        const pts: V3[] = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          const z = 2.2 + (11 - 2.2) * t;
          pts.push([x, 3.2 - Math.sin(t * Math.PI) * 0.5, z]);
          if (i < 12) {
            const flag = new THREE.ConeGeometry(0.16, 0.36, 3);
            flag.rotateZ(Math.PI);
            const tf = t + 1 / 24;
            k.add(
              'cloth',
              ['#c9655d', '#d8b867', '#6f98b8', '#86ad83'][i % 4],
              flag,
              [x, 2.92 - Math.sin(tf * Math.PI) * 0.5, 2.2 + (11 - 2.2) * tf],
            );
          }
        }
        k.tube('paint', '#3c3434', pts, 0.012);
      }
      // A Ferris wheel far behind, turning slowly.
      const wheel = new THREE.Group();
      const wk = new Kit();
      const wl = new Kit();
      wk.torus('chrome', '#cfd5d8', 7, 0.12, [0, 0, 0], {
        rot: [Math.PI / 2, 0, 0],
      });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        wk.cyl(
          'chrome',
          '#cfd5d8',
          0.05,
          0.05,
          7,
          [Math.cos(a) * 3.5, Math.sin(a) * 3.5, 0],
          { rot: [0, 0, a + Math.PI / 2] },
        );
        wl.sphere(
          'glow',
          i % 2 ? '#ffcf8f' : '#f0a0b8',
          0.16,
          [Math.cos(a) * 7, Math.sin(a) * 7, 0.15],
          { seg: 8 },
        );
        wk.rbox(
          'gloss',
          ['#c95d74', '#5f8fb0', '#e8c46a', '#8fbf8a'][i % 4],
          [0.9, 0.8, 0.9],
          0.15,
          [Math.cos(a) * 7, Math.sin(a) * 7 - 0.6, 0],
        );
      }
      wheel.add(meshes(wk.build(), mats));
      const wGlow = new THREE.MeshBasicMaterial({
        vertexColors: true,
        toneMapped: false,
      });
      owned.push(wGlow);
      for (const g of Object.values(wl.build()))
        if (g) wheel.add(new THREE.Mesh(g, wGlow));
      wheel.position.set(W / 2 + 6, 9.5, -16);
      group.add(wheel);
      moving.push({ node: wheel, spin: 0.08 });
      k.cyl('paint', '#4b4040', 0.2, 0.3, 10, [W / 2 + 4.5, 4.8, -16.4], {
        rot: [0, 0, -0.18],
      });
      k.cyl('paint', '#4b4040', 0.2, 0.3, 10, [W / 2 + 7.5, 4.8, -16.4], {
        rot: [0, 0, 0.18],
      });
      break;
    }
    case 'harbour': {
      // The pier runs out front; water beyond it, bollards and crates.
      const waterGeo = new THREE.PlaneGeometry(140, 40, detail ? 70 : 30, 20);
      const waterMat = new THREE.MeshStandardMaterial({
        color: '#1f3f4c',
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
        opacity: 0.94,
      });
      owned.push(waterGeo, waterMat);
      water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(W / 2, -0.55, 33);
      group.add(water);
      k.rbox('wood', '#5d4636', [140, 0.4, 0.5], 0.05, [W / 2, -0.4, 13.1]);
      for (const x of [-3, 2, 7.5, 13, 18.5]) {
        k.cyl('paint', '#2e3337', 0.22, 0.26, 0.6, [x, 0.1, 12.5], { seg: 14 });
        k.cyl('paint', '#2e3337', 0.3, 0.3, 0.1, [x, 0.42, 12.5], { seg: 14 });
      }
      k.tube(
        'cloth',
        '#c9b48a',
        [
          [-3, 0.35, 12.5],
          [-0.5, 0.15, 12.6],
          [2, 0.35, 12.5],
        ],
        0.04,
      );
      crate(k, R + 0.9, -0.2, 7.8, 0.8, 0.2);
      crate(k, R + 1.9, -0.2, 8.3, 0.8, -0.15);
      crate(k, R + 1.4, 0.6, 8.0, 0.7, 0.4);
      k.cyl('gloss', '#c95d4a', 0.32, 0.32, 0.12, [L - 1.2, 0.0, 7.4], {
        seg: 20,
      });
      k.torus('cloth', RIG.cream, 0.42, 0.11, [L - 1.0, 0.1, 9.3]);
      k.torus('gloss', '#c95d4a', 0.42, 0.115, [L - 1.0, 0.1, 9.3], {
        arc: Math.PI / 2,
      });
      // A lighthouse far behind with a slow beam.
      k.cyl('ceramic', RIG.cream, 1.2, 1.7, 12, [W + 6, 6, -18], { seg: 24 });
      for (const y of [2.5, 6.5])
        k.cyl(
          'gloss',
          RIG.cherry,
          1.62 - y * 0.04,
          1.66 - y * 0.04,
          1.6,
          [W + 6, y, -18],
          { seg: 24 },
        );
      lit.cyl('glow', '#ffe9b8', 0.9, 0.9, 1.2, [W + 6, 12.6, -18], {
        seg: 18,
      });
      k.cyl('paint', '#2c3236', 1.3, 1.1, 0.4, [W + 6, 13.4, -18], { seg: 18 });
      break;
    }
    case 'oldtown': {
      // Brick shopfronts down the right side, lamps and a bench on the left.
      for (const [z, colour] of [
        [3.0, '#8c4a3e'],
        [7.6, '#7d5a48'],
      ] as const) {
        k.rbox('paint', colour, [3, 5.2, 4.2], 0.06, [R + 2.6, 2.6, z]);
        k.rbox('gloss', '#3f5a52', [0.1, 1.9, 3.2], 0.04, [R + 1.06, 1.15, z]);
        lit.box('glow', '#ffcf8f', [0.04, 1.4, 1.2], [R + 1.0, 1.25, z - 0.6]);
        k.rbox(
          'cloth',
          z < 5 ? '#b9524a' : '#4f7c73',
          [0.9, 0.08, 3.4],
          0.03,
          [R + 0.75, 2.45, z],
          { rot: [0, 0, -0.35] },
        );
        for (const dz of [-1.2, 0, 1.2])
          k.rbox('paint', '#e9dfcb', [0.06, 0.9, 0.6], 0.03, [
            R + 1.08,
            3.8,
            z + dz,
          ]);
      }
      streetLamp(k, lit, L - 1.0, 7.0);
      streetLamp(k, lit, R + 0.5, 11.2);
      k.rbox('wood', '#6a4a35', [0.5, 0.08, 1.6], 0.02, [L - 1.6, 0.48, 9.6]);
      k.rbox('wood', '#6a4a35', [0.08, 0.5, 1.6], 0.02, [L - 1.85, 0.75, 9.6]);
      for (const dz of [-0.65, 0.65])
        k.box(
          'paint',
          '#2c3236',
          [0.45, 0.48, 0.05],
          [L - 1.6, 0.24, 9.6 + dz],
        );
      // The clock tower far behind.
      k.rbox('paint', '#7a4f40', [3.2, 13, 3.2], 0.05, [W / 2 - 5, 6.5, -15]);
      k.cyl('ceramic', RIG.cream, 1.1, 1.1, 0.2, [W / 2 - 5, 10.4, -13.35], {
        axis: 'z',
        seg: 24,
      });
      lit.cyl('glow', '#ffe6b0', 0.95, 0.95, 0.05, [W / 2 - 5, 10.4, -13.22], {
        axis: 'z',
        seg: 24,
      });
      k.add(
        'paint',
        '#3d3f47',
        new THREE.ConeGeometry(2.6, 3.2, 4),
        [W / 2 - 5, 14.6, -15],
        { rot: [0, Math.PI / 4, 0] },
      );
      break;
    }
    case 'moonmile': {
      cactus(k, L - 1.4, 7.6, 1.8);
      cactus(k, R + 2.2, 4.0, 2.3);
      cactus(k, R + 0.9, 10.6, 1.3);
      rock(k, L - 2.3, 10.4, 0.6, '#6e5560');
      rock(k, R + 2.8, 8.6, 0.8, '#6a5260');
      rock(k, L - 0.9, 11.8, 0.4, '#77606a');
      // A rocket on a pole: the motel's sign.
      k.cyl('paint', '#3a3440', 0.1, 0.12, 4, [R + 1.4, 2, 1.0], { seg: 12 });
      k.capsule('gloss', RIG.cream, 0.42, 1.6, [R + 1.4, 4.6, 1.0]);
      k.add('gloss', RIG.cherry, new THREE.ConeGeometry(0.42, 0.7, 20), [
        R + 1.4,
        5.85,
        1.0,
      ]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        k.rbox(
          'gloss',
          RIG.cherry,
          [0.08, 0.7, 0.5],
          0.03,
          [R + 1.4 + Math.cos(a) * 0.45, 3.75, 1.0 + Math.sin(a) * 0.45],
          { rot: [0, -a, 0] },
        );
      }
      lit.sphere('glow', '#b9a0ff', 0.12, [R + 1.4, 4.9, 1.43]);
      // The radio dish far behind.
      k.cyl('paint', '#3a3440', 0.4, 0.6, 5, [W / 2 - 6, 2.5, -14]);
      k.dome('chrome', '#c8c4d2', 3.4, [W / 2 - 6, 6.2, -13.4], Math.PI / 2, {
        rot: [Math.PI / 2.6, 0, 0],
        scale: [1, 0.45, 1],
      });
      break;
    }
  }

  group.add(meshes(k.build(), mats));
  const glow = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  owned.push(glow);
  for (const g of Object.values(lit.build()))
    if (g) group.add(new THREE.Mesh(g, glow));
  const basePositions = water
    ? (water.geometry.getAttribute('position').array as Float32Array).slice()
    : null;
  void DOOR_GAP;

  return {
    group,
    update(cues) {
      const level = cues.power ? 1 : 0.5;
      glow.color.setScalar(1.3 * level);
      if (cues.reduced) return;
      for (const m of moving) if (m.spin) m.node.rotation.z += m.spin * cues.dt;
      if (water && basePositions) {
        const pos = water.geometry.getAttribute('position');
        const arr = pos.array as Float32Array;
        for (let i = 0; i < pos.count; i++) {
          const x = basePositions[i * 3],
            y = basePositions[i * 3 + 1];
          arr[i * 3 + 2] =
            Math.sin(x * 0.6 + cues.time * 1.3) * 0.06 +
            Math.sin(y * 0.9 - cues.time) * 0.05;
        }
        pos.needsUpdate = true;
        water.geometry.computeVertexNormals();
      }
    },
    dispose() {
      group.traverse((n) => {
        if (n instanceof THREE.Mesh) n.geometry.dispose();
      });
      for (const d of owned) d.dispose();
    },
  };
}
