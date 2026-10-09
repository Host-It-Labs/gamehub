import * as THREE from 'three';
import * as food from './food';
import { type DishId, type StationId } from '@/lib/games/diner/content';
import { COUNTER_X } from '@/lib/games/diner/layout';
import { Kit, type Materials } from './kit';
import { cached, shared } from './model-cache';
import type { Figure } from './people';
export { disposeCache } from './model-cache';
export { guestFigure, waiterFigure, type Figure } from './people';
import { SEAT_COLOURS } from './seats';

/**
 * Shared diner pieces modelled in code: the palette, particle textures, the
 * goo mimic and the props cooking on the machines. The room is the stage
 * (`stage.ts`), the machines `stations.ts`, the dishes `food.ts`.
 */
export const C = {
  // Calmer since 9 October 2026: enamel, not neon.
  cherry: '#b3363b',
  cherryDark: '#7b2229',
  cream: '#efe6d2',
  creamDark: '#ddd0b3',
  mint: '#8fbcaa',
  mintDark: '#5d907f',
  mintDeep: '#3c6f62',
  chrome: '#e4e8eb',
  steel: '#a2aab1',
  black: '#1d1b22',
  wood: '#7a4a2b',
  pink: '#e7799e',
  teal: '#5cc8bb',
  gold: '#e8bb48',
  goo: '#7d3cff',
  gooLight: '#b38bff',
  white: '#fbf7ef',
};

export { SEAT_COLOURS };

// ---------------------------------------------------------------- textures

function canvasTexture(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
  srgb = true,
) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  draw(el.getContext('2d')!);
  const t = new THREE.CanvasTexture(el);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A soft round glow, for halos, steam and sparkles. */
export function glowTexture() {
  return canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}
/** A four-pointed twinkle. */
export function starTexture() {
  return canvasTexture(64, 64, (c) => {
    c.translate(32, 32);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? 6 : 30;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  });
}
/** Transparent soap/oil bubbles with a fine rim and a reflected light. */
export function bubbleTexture() {
  return canvasTexture(64, 64, (c) => {
    const fill = c.createRadialGradient(25, 21, 0, 32, 32, 27);
    fill.addColorStop(0, 'rgba(255,255,255,.08)');
    fill.addColorStop(0.72, 'rgba(255,255,255,.025)');
    fill.addColorStop(0.9, 'rgba(255,255,255,.35)');
    fill.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = fill;
    c.fillRect(0, 0, 64, 64);
    c.strokeStyle = 'rgba(255,255,255,.66)';
    c.lineWidth = 1.7;
    c.beginPath();
    c.arc(32, 32, 23, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.95)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(32, 32, 20, 3.7, 4.55);
    c.stroke();
  });
}

/** A puff of smoke or steam with a soft lumpy edge. */
export function puffTexture() {
  return canvasTexture(64, 64, (c) => {
    for (const [x, y, r] of [
      [32, 34, 20],
      [22, 28, 13],
      [42, 26, 12],
      [30, 22, 12],
    ]) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
}

// ---------------------------------------------------------------- the counter

/**
 * A machine's moving parts and status lamps (built in `stations.ts`); the
 * room itself is the stage (`stage.ts`, 8 October 2026).
 */
export type MachineRig = {
  indicator: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  indicators?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  needle: THREE.Object3D;
  heat?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  rotor?: THREE.Object3D;
  rotors?: THREE.Object3D[];
  cover?: THREE.Object3D;
  pulse: number;
};

/** The same physical lanes drive appliance props and event effects. */
export const stationLaneX = (id: StationId, lane = 0, lanes = 2) =>
  COUNTER_X[id] +
  (id === 'pie'
    ? 0
    : lanes === 3
      ? (lane - 1) * 0.3
      : lane === 0
        ? -0.23
        : 0.23);

// ---------------------------------------------------------------- figures

/** A mimic's true form: glossy purple goo with one big eye. */
export function gooFigure(mats: Materials): Figure {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(
    shared(
      cached('goo', (k) => {
        k.sphere('gloss', C.goo, 0.34, [0, 0.3, 0], {
          scale: [1, 0.82, 1],
          seg: 24,
        });
        k.sphere('gloss', C.gooLight, 0.22, [0, 0.24, 0.16], {
          scale: [1, 0.7, 0.6],
        });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          k.sphere(
            'gloss',
            C.goo,
            0.09,
            [Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3],
            { scale: [1, 0.6, 1] },
          );
        }
        k.sphere('gloss', '#ffffff', 0.15, [0, 0.42, 0.22], { seg: 20 });
        k.sphere('gloss', '#121018', 0.075, [0, 0.42, 0.35], { seg: 14 });
        k.sphere('glow', '#ffffff', 0.025, [0.03, 0.46, 0.42], { seg: 8 });
        k.capsule('gloss', C.goo, 0.03, 0.12, [0.12, 0.62, 0], {
          rot: [0, 0, -0.4],
        });
        k.sphere('gloss', C.gooLight, 0.045, [0.17, 0.72, 0]);
      }),
      mats,
    ),
  );
  const nub = new THREE.Group();
  return { root, body, legs: [nub, nub] };
}

// ---------------------------------------------------------------- dishes

export type Prop = DishId | 'burnt' | 'dirty' | 'menu' | 'coins' | 'pot';

function dishParts(k: Kit, p: Prop) {
  if (p === 'burger') food.burger(k);
  else if (p === 'shake') food.shake(k);
  else if (p === 'pie') food.pie(k);
  else if (p === 'fries') food.fries(k);
  else if (p === 'burnt') food.burnt(k);
  else if (p === 'dirty') food.dirty(k);
  else if (p === 'pot') food.pot(k);
  else if (p === 'menu') food.menuCard(k);
  else if (p === 'coins') food.coins(k);
}

/** A dish (or a stack of dirty plates, a menu, coins) as a small group. */
export function propMesh(mats: Materials, p: Prop) {
  return shared(
    cached(`prop:v2:${p}`, (k) => dishParts(k, p)),
    mats,
    true,
  );
}

/** A flat glossy splat of goo, for puddles. */
export function puddleMesh(mats: Materials) {
  return shared(
    cached('puddle', (k) => {
      k.cyl('gloss', C.goo, 0.5, 0.52, 0.02, [0, 0.01, 0], {
        seg: 28,
        scale: [1, 1, 0.8],
      });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        const r = 0.45 + (i % 3) * 0.08;
        k.cyl(
          'gloss',
          i % 2 ? C.goo : '#6a2ee0',
          0.14 + (i % 2) * 0.05,
          0.15,
          0.022,
          [Math.cos(a) * r, 0.011, Math.sin(a) * r * 0.8],
          { seg: 14 },
        );
      }
      k.sphere('gloss', C.gooLight, 0.08, [0.15, 0.02, -0.1], {
        scale: [1.6, 0.25, 1],
      });
      k.sphere('gloss', C.gooLight, 0.05, [-0.2, 0.02, 0.12], {
        scale: [1.4, 0.25, 1],
      });
    }),
    mats,
    false,
  );
}

/** Station props that change with its state. */
export function pattyMesh(mats: Materials, burnt: boolean) {
  return shared(
    cached(`patty:${burnt}`, (k) => {
      k.cyl(
        'paint',
        burnt ? '#1c1714' : '#7a4426',
        0.13,
        0.13,
        0.045,
        [0, 0.022, 0],
        { seg: 20 },
      );
      if (!burnt)
        k.box('gloss', '#ffcc33', [0.18, 0.012, 0.18], [0, 0.05, 0], {
          rot: [0, 0.4, 0],
        });
    }),
    mats,
  );
}
export function basketMesh(mats: Materials) {
  return shared(
    cached('basket', (k) => {
      for (const y of [0.016, 0.17])
        k.tube(
          'chrome',
          C.chrome,
          [
            [-0.21, y, -0.15],
            [0.21, y, -0.15],
            [0.21, y, 0.15],
            [-0.21, y, 0.15],
          ],
          0.012,
          true,
        );
      for (let x = -0.19; x <= 0.2; x += 0.055) {
        k.tube(
          'chrome',
          C.steel,
          [
            [x, 0.17, -0.15],
            [x, 0.02, -0.15],
            [x, 0.02, 0.15],
            [x, 0.17, 0.15],
          ],
          0.006,
        );
      }
      for (const side of [-1, 1])
        for (let z = -0.13; z <= 0.14; z += 0.053)
          k.cyl(
            'chrome',
            C.steel,
            0.006,
            0.006,
            0.15,
            [side * 0.21, 0.092, z],
            { seg: 8 },
          );
      for (let i = 0; i < 11; i++) {
        const a = i * 2.4;
        k.rbox(
          'paint',
          i % 3 ? '#f0c44e' : '#d8a43c',
          [0.024, 0.024, 0.185],
          0.004,
          [Math.cos(a) * 0.12, 0.093 + (i % 3) * 0.019, Math.sin(a) * 0.065],
          { rot: [0.12 * Math.sin(a), a, 0] },
        );
      }
      k.cyl('chrome', C.chrome, 0.02, 0.02, 0.36, [0, 0.2, 0.32], {
        axis: 'z',
      });
      k.cyl('gloss', C.black, 0.03, 0.03, 0.1, [0, 0.22, 0.52], { axis: 'z' });
    }),
    mats,
  );
}
export function shakeCupMesh(mats: Materials) {
  return shared(
    cached('shakecup', (k) => {
      k.cyl('chrome', C.chrome, 0.09, 0.07, 0.3, [0, 0.15, 0]);
      k.cyl('gloss', '#ff9cc5', 0.08, 0.08, 0.02, [0, 0.29, 0]);
      k.torus('chrome', C.chrome, 0.091, 0.007, [0, 0.3, 0]);
      k.tube(
        'chrome',
        C.chrome,
        [
          [0.075, 0.245, 0],
          [0.14, 0.25, 0],
          [0.15, 0.13, 0],
          [0.079, 0.108, 0],
        ],
        0.011,
      );
    }),
    mats,
  );
}
