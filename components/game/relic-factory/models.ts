import * as THREE from 'three';
import type { MachineKind } from '@/lib/games/relic/factory';
import { Kit, pathTangent, rail, strip, type MatKey } from './kit';

/**
 * The factory's machines, modelled in code as enamel-and-brass miniature
 * fairground contraptions. Bevels, fittings and layered materials remain
 * present when the player zooms in. Every model faces +x (its output), stands on a
 * cell from -0.5 to 0.5, and splits into a static body and a few moving
 * parts. Each moving part has a pivot and a pose worked out every frame
 * from what the machine is doing, so the floor shows how each one works:
 * printers roll and press, bots scrub with a coin, stampers slam, the till
 * pops its drawer, lamps and charms glow when they have something to help.
 */

export const C = {
  green: '#1f5c4d',
  greenLight: '#2f8a6c',
  greenDeep: '#143d34',
  cream: '#f3e6c6',
  paper: '#fbf5e4',
  brass: '#e0ad52',
  gold: '#f6c64f',
  copper: '#c77b46',
  red: '#cf3a35',
  redDark: '#8f2125',
  dark: '#1b2421',
  slot: '#0d1412',
  rubber: '#2a302d',
  steel: '#c3ccd2',
  ink: '#2f5bd1',
  emerald: '#33c06f',
  wood: '#8a5a32',
  brassDark: '#9b7038',
  creamShade: '#d7c7a7',
} as const;

/** Light colours: what a machine's lamp says about it. */
export const STATUS = {
  work: new THREE.Color('#5cff8a'),
  idle: new THREE.Color('#3a2f1c'),
  full: new THREE.Color('#ffb52e'),
  stuck: new THREE.Color('#ff2f24'),
} as const;
export type Status = keyof typeof STATUS;

export type Tint = 'status' | 'book' | 'boost';
export type PartDef = {
  name: string;
  pivot: THREE.Vector3;
  geos: Partial<Record<MatKey, THREE.BufferGeometry>>;
  tint?: Tint;
};
export type ModelDef = {
  body: Partial<Record<MatKey, THREE.BufferGeometry>>;
  parts: PartDef[];
  /** Height of the machine's top, for picking. */
  height: number;
  /** Where a ticket rests inside it (machine space), if it shows one. */
  rest?: THREE.Vector3;
};

/** What a machine is doing this frame, for its moving parts. */
export type Ctx = {
  /** Seconds since the factory opened (smooth). */
  t: number;
  /** Work done toward the current job, 0–1, or -1 when there is none. */
  work: number;
  status: Status;
  /** Seconds since the last finished job (print, stamp, sale, pack). */
  since: number;
  /** Splitter: the angle of the next exit, smoothed. */
  turn: number;
  /** A booster with something to boost. */
  boost: boolean;
  /** Bundler: tickets waiting. */
  hold: number;
  seed: number;
};
export type Pose = { p: THREE.Vector3; r: THREE.Euler; s: number };

/** Every machine stands on the same brass-trimmed enamel plinth. */
function plinth(k: Kit) {
  k.rbox('gloss', C.greenDeep, [0.9, 0.06, 0.9], 0.024, [0, 0.04, 0]);
  k.rbox('metal', C.brass, [0.92, 0.023, 0.92], 0.01, [0, 0.018, 0]);
  for (const x of [-0.34, 0.34])
    for (const z of [-0.34, 0.34]) {
      k.cyl('dark', C.rubber, 0.055, 0.06, 0.014, [x, 0.007, z], { seg: 16 });
      screw(k, [x, 0.073, z], 0.016);
    }
}
/** Small domed screws have a recessed slot, so the fittings read at close range. */
function screw(k: Kit, at: [number, number, number], r = 0.012) {
  k.cyl('metal', C.brass, r, r * 1.05, r * 0.45, at, { seg: 12 });
  k.box(
    'dark',
    C.brassDark,
    [r * 1.35, 0.002, r * 0.22],
    [at[0], at[1] + r * 0.24, at[2]],
  );
}
type Side = 'back' | 'left' | 'right' | 'front';
const SIDE: Record<Side, [number, number]> = {
  front: [1, 0],
  back: [-1, 0],
  left: [0, -1],
  right: [0, 1],
};
/** A dark intake mouth with a brass lip at `reach` from the centre. */
function intake(k: Kit, side: Side, reach = 0.36, y = 0.13) {
  const [sx, sz] = SIDE[side],
    along = sx ? 'z' : 'x';
  const size = (w: number, h: number, d: number): [number, number, number] =>
    along === 'z' ? [d, h, w] : [w, h, d];
  k.rbox('metal', C.brass, size(0.36, 0.12, 0.05), 0.014, [
    sx * reach,
    y,
    sz * reach,
  ]);
  k.rbox('dark', C.slot, size(0.285, 0.067, 0.055), 0.01, [
    sx * (reach + 0.01),
    y,
    sz * (reach + 0.01),
  ]);
  k.cyl(
    'dark',
    C.rubber,
    0.016,
    0.016,
    0.26,
    [sx * (reach + 0.034), y - 0.023, sz * (reach + 0.034)],
    {
      axis: along,
      seg: 16,
    },
  );
}
/** The red output chute on the front. */
function chute(k: Kit, y = 0.15) {
  k.rbox('gloss', C.redDark, [0.18, 0.03, 0.28], 0.01, [0.39, y - 0.025, 0], {
    rot: [0, 0, -0.28],
  });
  k.rbox(
    'metal',
    C.brass,
    [0.18, 0.05, 0.025],
    0.008,
    [0.39, y - 0.01, 0.145],
    {
      rot: [0, 0, -0.28],
    },
  );
  k.rbox(
    'metal',
    C.brass,
    [0.18, 0.05, 0.025],
    0.008,
    [0.39, y - 0.01, -0.145],
    {
      rot: [0, 0, -0.28],
    },
  );
}
/** A status bulb on a little brass stalk. */
function bulbStalk(k: Kit, at: [number, number, number], h = 0.08) {
  k.cyl('metal', C.brass, 0.012, 0.016, h, [at[0], at[1] - h / 2, at[2]], {
    seg: 16,
  });
  k.cyl('metal', C.brass, 0.04, 0.03, 0.02, [at[0], at[1] - 0.005, at[2]], {
    seg: 24,
  });
  k.torus('dark', C.rubber, 0.031, 0.006, [at[0], at[1] + 0.002, at[2]], {
    seg: 24,
  });
}
function part(
  name: string,
  pivot: [number, number, number],
  build: (k: Kit) => void,
  tint?: Tint,
): PartDef {
  const k = new Kit();
  build(k);
  return { name, pivot: new THREE.Vector3(...pivot), geos: k.merged(), tint };
}
const light = (name: string, at: [number, number, number], r = 0.04) =>
  part(
    name,
    at,
    (k) => k.sphere('glow', '#ffffff', r, [0, 0, 0], { seg: 18 }),
    'status',
  );

function printer(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.rbox('gloss', C.cream, [0.56, 0.3, 0.68], 0.05, [-0.04, 0.22, 0]);
  k.rbox('gloss', C.green, [0.5, 0.12, 0.7], 0.014, [-0.06, 0.22, 0]);
  k.rbox('metal', C.brass, [0.58, 0.03, 0.7], 0.01, [-0.04, 0.12, 0]);
  k.rbox('metal', C.brass, [0.58, 0.025, 0.7], 0.01, [-0.04, 0.33, 0]);
  // Recessed ventilation and bolted side plates, with a separate feed bed.
  for (const z of [-0.355, 0.355]) {
    k.rbox('gloss', C.greenDeep, [0.27, 0.105, 0.012], 0.005, [-0.06, 0.22, z]);
    for (let i = 0; i < 5; i++)
      k.box(
        'dark',
        C.slot,
        [0.017, 0.066, 0.016],
        [-0.14 + i * 0.042, 0.22, z],
      );
    for (const x of [-0.23, 0.15])
      k.cyl('metal', C.brass, 0.012, 0.012, 0.016, [x, 0.23, z], {
        axis: 'z',
        seg: 12,
      });
  }
  k.rbox('metal', C.steel, [0.29, 0.015, 0.52], 0.006, [0.25, 0.267, 0]);
  // Paper roll cradle at the back.
  for (const z of [-0.28, 0.28]) {
    k.rbox('gloss', C.green, [0.055, 0.22, 0.048], 0.016, [-0.33, 0.42, z]);
    k.cyl('metal', C.brass, 0.049, 0.049, 0.032, [-0.33, 0.5, z], {
      axis: 'z',
      seg: 24,
    });
    k.cyl('dark', C.rubber, 0.023, 0.023, 0.035, [-0.33, 0.5, z], {
      axis: 'z',
      seg: 18,
    });
    k.cyl('metal', C.steel, 0.014, 0.014, 0.14, [0.27, 0.4, z * 0.67], {
      seg: 16,
    });
  }
  // Roller cheeks at the front.
  k.rbox('gloss', C.cream, [0.12, 0.14, 0.05], 0.02, [0.1, 0.43, 0.3]);
  k.rbox('gloss', C.cream, [0.12, 0.14, 0.05], 0.02, [0.1, 0.43, -0.3]);
  chute(k, 0.17);
  bulbStalk(k, [-0.2, 0.5, -0.3]);
  return {
    body: k.merged(),
    height: 0.62,
    parts: [
      // The cover wears the colour of the book it prints.
      part(
        'cover',
        [-0.1, 0.39, 0],
        (p) => p.rbox('gloss', '#ffffff', [0.34, 0.05, 0.6], 0.02, [0, 0, 0]),
        'book',
      ),
      part('roll', [-0.33, 0.5, 0], (p) => {
        p.cyl('paint', C.paper, 0.11, 0.11, 0.5, [0, 0, 0], {
          axis: 'z',
          seg: 36,
        });
        p.cyl('metal', C.brass, 0.025, 0.025, 0.6, [0, 0, 0], {
          axis: 'z',
          seg: 20,
        });
        // Concentric paper edges and the seam remain visible up close.
        for (const z of [-0.251, 0.251])
          for (const r of [0.055, 0.08, 0.104])
            p.torus('paint', C.creamShade, r, 0.0018, [0, 0, z], {
              axis: 'z',
              seg: 32,
            });
        p.box('paint', C.creamShade, [0.002, 0.011, 0.47], [0.109, 0, 0]);
      }),
      part('drum', [0.1, 0.45, 0], (p) => {
        p.cyl('gloss', C.redDark, 0.065, 0.065, 0.5, [0, 0, 0], {
          axis: 'z',
          seg: 32,
        });
        p.cyl('metal', C.steel, 0.015, 0.015, 0.63, [0, 0, 0], {
          axis: 'z',
          seg: 16,
        });
        for (const z of [-0.263, 0.263]) {
          p.cyl('metal', C.brass, 0.069, 0.069, 0.019, [0, 0, z], {
            axis: 'z',
            seg: 32,
          });
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            p.box(
              'dark',
              C.brassDark,
              [0.035, 0.006, 0.021],
              [Math.cos(a) * 0.038, Math.sin(a) * 0.038, z],
              { rot: [0, 0, a] },
            );
          }
        }
        for (const z of [-0.17, 0, 0.17])
          p.torus('metal', C.brass, 0.066, 0.003, [0, 0, z], {
            axis: 'z',
            seg: 32,
          });
      }),
      part('press', [0.27, 0.36, 0], (p) => {
        p.rbox('gloss', C.red, [0.13, 0.07, 0.5], 0.02, [0, 0, 0]);
        p.rbox('metal', C.brass, [0.14, 0.015, 0.51], 0.006, [0, -0.036, 0]);
        p.box('metal', C.brass, [0.02, 0.12, 0.02], [0, 0.08, 0.18]);
        p.box('metal', C.brass, [0.02, 0.12, 0.02], [0, 0.08, -0.18]);
        for (const z of [-0.18, 0.18]) screw(p, [0, 0.038, z]);
      }),
      light('light', [-0.2, 0.53, -0.3]),
    ],
  };
}

function bot(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.rbox('dark', C.rubber, [0.66, 0.08, 0.66], 0.03, [0.02, 0.11, 0.02]);
  k.rbox('metal', C.brass, [0.7, 0.02, 0.7], 0.009, [0.02, 0.155, 0.02]);
  k.box('paint', '#2c3a35', [0.5, 0.01, 0.5], [0.04, 0.16, 0.04]);
  intake(k, 'back', 0.37, 0.12);
  intake(k, 'left', 0.37, 0.12);
  intake(k, 'right', 0.37, 0.12);
  chute(k, 0.16);
  // The robot's column in the back corner.
  k.cyl('gloss', C.green, 0.075, 0.09, 0.26, [-0.31, 0.26, -0.31], { seg: 32 });
  k.torus('metal', C.brass, 0.08, 0.016, [-0.31, 0.37, -0.31], { seg: 32 });
  k.torus('metal', C.brass, 0.09, 0.014, [-0.31, 0.15, -0.31], { seg: 32 });
  k.cyl('dark', C.rubber, 0.066, 0.066, 0.07, [-0.31, 0.408, -0.31], {
    seg: 28,
  });
  for (let i = 0; i < 3; i++)
    k.torus(
      'metal',
      C.brassDark,
      0.066,
      0.006,
      [-0.31, 0.389 + i * 0.019, -0.31],
      { seg: 24 },
    );
  for (const x of [-0.19, 0.27])
    for (const z of [-0.21, 0.27]) screw(k, [x, 0.166, z]);
  return {
    body: k.merged(),
    height: 0.69,
    rest: new THREE.Vector3(0.04, 0.17, 0.04),
    parts: [
      part('head', [-0.31, 0.47, -0.31], (p) => {
        p.rbox('gloss', C.cream, [0.22, 0.16, 0.21], 0.055, [0, 0, 0]);
        p.rbox('metal', C.brass, [0.21, 0.024, 0.2], 0.009, [0, -0.072, 0]);
        p.rbox('dark', C.slot, [0.016, 0.067, 0.155], 0.007, [0.109, 0.015, 0]);
        for (const z of [-0.049, 0.049])
          p.torus('metal', C.brass, 0.028, 0.006, [0.118, 0.014, z], {
            axis: 'x',
            seg: 24,
          });
        for (const z of [-0.11, 0.11]) {
          p.cyl('metal', C.brass, 0.027, 0.027, 0.014, [0, 0, z], {
            axis: 'z',
            seg: 20,
          });
          p.cyl('gloss', C.green, 0.013, 0.013, 0.018, [0, 0, z], {
            axis: 'z',
            seg: 16,
          });
        }
        p.box('dark', C.greenDeep, [0.011, 0.01, 0.052], [0.108, -0.044, 0]);
        p.cyl('metal', C.brass, 0.009, 0.009, 0.08, [0, 0.11, 0], { seg: 16 });
        p.sphere('gloss', C.red, 0.023, [0, 0.16, 0], { seg: 20 });
      }),
      // Eyes are the status light, looking where the head looks.
      part(
        'eyes',
        [-0.31, 0.47, -0.31],
        (p) => {
          p.sphere('glow', '#ffffff', 0.024, [0.118, 0.015, 0.049], {
            seg: 18,
            scale: [0.55, 1, 1],
          });
          p.sphere('glow', '#ffffff', 0.024, [0.118, 0.015, -0.049], {
            seg: 18,
            scale: [0.55, 1, 1],
          });
        },
        'status',
      ),
      part('arm', [-0.31, 0.37, -0.31], (p) => {
        // Paired links, elbow, piston and a wrist gripping the scratching coin.
        p.rod('metal', C.brass, 0.022, [0, 0, 0], [0.2, 0.012, 0.2]);
        p.rbox(
          'gloss',
          C.green,
          [0.24, 0.043, 0.065],
          0.017,
          [0.09, 0.012, 0.09],
          { rot: [0, -Math.PI / 4, 0] },
        );
        p.rod('metal', C.brass, 0.021, [0.2, 0.012, 0.2], [0.35, -0.05, 0.35]);
        p.rod(
          'metal',
          C.steel,
          0.012,
          [0.065, -0.025, 0.065],
          [0.3, -0.069, 0.3],
        );
        p.sphere('metal', C.brass, 0.039, [0.2, 0.012, 0.2], { seg: 18 });
        p.cyl('gloss', C.redDark, 0.023, 0.023, 0.065, [0.2, 0.012, 0.2], {
          seg: 20,
        });
        p.rod(
          'metal',
          C.steel,
          0.018,
          [0.35, -0.05, 0.35],
          [0.35, -0.15, 0.35],
        );
        p.cyl('dark', C.rubber, 0.028, 0.024, 0.035, [0.35, -0.133, 0.35], {
          seg: 24,
        });
        for (const z of [0.324, 0.376])
          p.rod('metal', C.brass, 0.009, [0.35, -0.13, z], [0.35, -0.173, z]);
        p.cyl('metal', C.gold, 0.074, 0.074, 0.018, [0.35, -0.18, 0.35], {
          seg: 36,
        });
        p.torus('metal', C.brassDark, 0.062, 0.0025, [0.35, -0.169, 0.35], {
          seg: 36,
        });
        p.cyl('metal', '#ffe198', 0.05, 0.05, 0.003, [0.35, -0.169, 0.35], {
          seg: 32,
        });
        p.sphere('metal', C.brass, 0.04, [0, 0, 0], { seg: 20 });
      }),
    ],
  };
}

function cashier(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.lathe(
    'gloss',
    C.green,
    [
      [0, 0],
      [0.36, 0],
      [0.388, 0.018],
      [0.392, 0.035],
      [0.38, 0.12],
      [0.36, 0.15],
      [0, 0.15],
    ],
    [0, 0.07, 0],
    { seg: 40 },
  );
  k.torus('metal', C.brass, 0.365, 0.016, [0, 0.22, 0], { seg: 40 });
  for (const side of ['front', 'back', 'left', 'right'] as const)
    intake(k, side, 0.37, 0.14);
  // The till.
  k.rbox('metal', C.brass, [0.44, 0.18, 0.34], 0.04, [0, 0.31, -0.02]);
  for (const x of [-0.219, 0.219]) {
    k.rbox('gloss', C.redDark, [0.014, 0.11, 0.24], 0.006, [x, 0.316, -0.02]);
    for (let i = 0; i < 3; i++)
      k.box(
        'metal',
        C.brass,
        [0.019, 0.007, 0.16],
        [x, 0.288 + i * 0.026, -0.02],
      );
  }
  k.rbox('gloss', C.redDark, [0.4, 0.04, 0.3], 0.015, [0, 0.41, -0.04]);
  // Keyboard on the slanted front, facing the camera.
  k.box('gloss', C.dark, [0.4, 0.03, 0.16], [0, 0.36, 0.14], {
    rot: [0.55, 0, 0],
  });
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 5; c++)
      k.cyl(
        'gloss',
        c === 4 ? C.red : C.cream,
        0.022,
        0.022,
        0.03,
        [-0.14 + c * 0.07, 0.38 - r * 0.04, 0.1 + r * 0.07],
        { seg: 20, rot: [0.55, 0, 0] },
      );
  // Display box with its little window.
  k.rbox('gloss', C.cream, [0.3, 0.1, 0.12], 0.02, [0, 0.48, -0.09]);
  k.box('dark', C.slot, [0.22, 0.05, 0.01], [0, 0.485, -0.025]);
  // A bevelled glass display and the little receipt tearing rail.
  k.rbox('glass', '#b1e9dd', [0.216, 0.047, 0.01], 0.004, [0, 0.485, -0.018]);
  k.box('metal', C.brass, [0.23, 0.012, 0.025], [0, 0.418, -0.13]);
  k.box('paint', C.paper, [0.1, 0.003, 0.065], [-0.065, 0.417, -0.15]);
  for (let i = 0; i < 3; i++)
    k.box(
      'paint',
      C.creamShade,
      [0.064, 0.003, 0.004],
      [-0.065, 0.42, -0.166 + i * 0.016],
    );
  bulbStalk(k, [0.17, 0.58, -0.12]);
  // A crank on the side.
  return {
    body: k.merged(),
    height: 0.66,
    parts: [
      part('drawer', [0, 0.235, 0.12], (p) => {
        p.rbox('gloss', C.cream, [0.36, 0.06, 0.16], 0.016, [0, 0, 0]);
        p.box('dark', C.rubber, [0.3, 0.007, 0.11], [0, 0.032, -0.012]);
        p.rbox('metal', C.brass, [0.12, 0.02, 0.023], 0.007, [0, 0, 0.085]);
        for (const x of [-0.055, 0.025, 0.105])
          p.box('metal', C.brassDark, [0.008, 0.02, 0.1], [x, 0.035, -0.012]);
        for (let i = 0; i < 4; i++)
          p.cyl(
            'metal',
            C.gold,
            0.03,
            0.03,
            0.012,
            [-0.1 + i * 0.065, 0.035, -0.02],
            { seg: 24 },
          );
      }),
      part('flag', [0, 0.5, -0.12], (p) => {
        p.rbox('gloss', C.red, [0.2, 0.08, 0.015], 0.006, [0, 0, 0]);
        p.rbox('gloss', C.cream, [0.12, 0.035, 0.018], 0.005, [0, 0, 0.003]);
      }),
      part('crank', [0.24, 0.32, -0.02], (p) => {
        p.cyl('metal', C.brass, 0.015, 0.015, 0.06, [0.03, 0, 0], {
          axis: 'x',
          seg: 20,
        });
        p.box('metal', C.brass, [0.02, 0.12, 0.02], [0.06, 0.05, 0]);
        p.sphere('gloss', C.red, 0.025, [0.08, 0.11, 0], { seg: 20 });
      }),
      light('light', [0.17, 0.6, -0.12]),
    ],
  };
}

function splitter(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.cyl('gloss', C.green, 0.4, 0.42, 0.07, [0, 0.105, 0], { seg: 40 });
  k.torus('metal', C.brass, 0.41, 0.02, [0, 0.14, 0], { seg: 40 });
  k.cyl('dark', C.rubber, 0.355, 0.355, 0.007, [0, 0.143, 0], { seg: 40 });
  k.torus('metal', C.brassDark, 0.33, 0.008, [0, 0.15, 0], { seg: 40 });
  intake(k, 'back', 0.38, 0.12);
  // Exit lips: front, left and right.
  k.rbox('gloss', C.red, [0.08, 0.03, 0.3], 0.009, [0.42, 0.11, 0]);
  k.rbox('gloss', C.red, [0.3, 0.03, 0.08], 0.009, [0, 0.11, 0.42]);
  k.rbox('gloss', C.red, [0.3, 0.03, 0.08], 0.009, [0, 0.11, -0.42]);
  for (const [x, z, axis] of [
    [0.4, 0, 'z'],
    [0, -0.4, 'x'],
    [0, 0.4, 'x'],
  ] as const)
    k.cyl('metal', C.steel, 0.022, 0.022, 0.27, [x, 0.142, z], {
      axis,
      seg: 24,
    });
  k.cyl('metal', C.brass, 0.07, 0.08, 0.06, [0, 0.17, 0], { seg: 28 });
  return {
    body: k.merged(),
    height: 0.34,
    parts: [
      part('wheel', [0, 0.17, 0], (p) => {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
          p.rbox(
            'gloss',
            C.green,
            [0.3, 0.065, 0.035],
            0.011,
            [Math.cos(a) * 0.17, 0.0, -Math.sin(a) * 0.17],
            { rot: [0, a, 0] },
          );
          p.sphere(
            'metal',
            C.brass,
            0.024,
            [Math.cos(a) * 0.307, 0, -Math.sin(a) * 0.307],
            { seg: 16 },
          );
        }
      }),
      part('arrow', [0, 0.22, 0], (p) => {
        p.rbox('gloss', C.red, [0.18, 0.035, 0.055], 0.012, [0.05, 0, 0]);
        for (const s of [-1, 1])
          p.rbox(
            'gloss',
            C.red,
            [0.105, 0.035, 0.045],
            0.01,
            [0.155, 0, s * 0.031],
            { rot: [0, (s * Math.PI) / 4, 0] },
          );
        p.cyl('metal', C.brass, 0.043, 0.043, 0.018, [0, 0.003, 0], {
          seg: 28,
        });
        screw(p, [0, 0.018, 0], 0.018);
      }),
    ],
  };
}

function lamp(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.lathe(
    'gloss',
    C.green,
    [
      [0, 0],
      [0.185, 0],
      [0.2, 0.014],
      [0.2, 0.025],
      [0.188, 0.038],
      [0.17, 0.058],
      [0.1, 0.087],
      [0.062, 0.111],
      [0.045, 0.13],
      [0, 0.14],
    ],
    [0, 0.07, 0],
    { seg: 40 },
  );
  k.torus('metal', C.brass, 0.186, 0.009, [0, 0.104, 0], { seg: 40 });
  k.cyl('metal', C.brass, 0.028, 0.034, 0.44, [0, 0.42, 0], { seg: 28 });
  k.cyl('gloss', C.green, 0.038, 0.038, 0.085, [0, 0.305, 0], { seg: 28 });
  for (const y of [0.265, 0.346, 0.61])
    k.torus('metal', C.brass, 0.038, 0.01, [0, y, 0], { seg: 28 });
  k.cyl('gloss', C.red, 0.024, 0.029, 0.018, [0.125, 0.13, 0.04], { seg: 24 });
  // An open shade, with rolled brass lips and a warm inner lining.
  k.lathe(
    'gloss',
    C.green,
    [
      [0.205, 0],
      [0.205, 0.004],
      [0.197, 0.013],
      [0.078, 0.132],
      [0.064, 0.146],
      [0.044, 0.155],
    ],
    [0, 0.71, 0],
    { seg: 40 },
  );
  k.lathe(
    'metal',
    C.brass,
    [
      [0.055, 0.139],
      [0.073, 0.129],
      [0.19, 0.012],
      [0.197, 0],
    ],
    [0, 0.71, 0],
    { seg: 40 },
  );
  k.torus('metal', C.brass, 0.201, 0.009, [0, 0.712, 0], { seg: 40 });
  k.torus('metal', C.brass, 0.047, 0.006, [0, 0.86, 0], { seg: 28 });
  k.cyl('dark', C.rubber, 0.037, 0.037, 0.03, [0, 0.704, 0], { seg: 24 });
  k.sphere('gloss', C.red, 0.022, [0, 0.878, 0], { seg: 20 });
  return {
    body: k.merged(),
    height: 0.9,
    parts: [
      part(
        'bulb',
        [0, 0.64, 0],
        (p) =>
          p.sphere('glow', '#ffffff', 0.074, [0, 0.016, 0], {
            seg: 28,
            scale: [1, 1.12, 1],
          }),
        'boost',
      ),
    ],
  };
}

function ink(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.cyl('gloss', C.green, 0.3, 0.32, 0.05, [0, 0.095, 0], { seg: 40 });
  // A squat glass bottle; the ink inside is a moving part.
  k.lathe(
    'glass',
    '#cfe6ff',
    [
      [0, 0],
      [0.245, 0],
      [0.263, 0.012],
      [0.277, 0.035],
      [0.28, 0.065],
      [0.278, 0.18],
      [0.268, 0.218],
      [0.243, 0.248],
      [0.15, 0.292],
      [0.108, 0.325],
      [0.102, 0.344],
      [0.102, 0.365],
      [0.083, 0.365],
      [0.083, 0.338],
    ],
    [0, 0.12, 0],
    { seg: 40 },
  );
  k.torus('metal', C.brass, 0.1, 0.012, [0, 0.483, 0], { seg: 32 });
  k.torus('metal', C.brass, 0.27, 0.01, [0, 0.14, 0], { seg: 40 });
  k.rbox('paint', C.cream, [0.18, 0.07, 0.013], 0.006, [0, 0.262, 0.276]);
  k.cyl('gloss', C.ink, 0.019, 0.019, 0.015, [0, 0.263, 0.287], {
    axis: 'z',
    seg: 24,
  });
  for (const x of [-0.21, 0.21]) screw(k, [x, 0.126, 0.16]);
  return {
    body: k.merged(),
    height: 0.88,
    parts: [
      part(
        'ink',
        [0, 0.12, 0],
        (p) =>
          p.lathe(
            'paint',
            '#ffffff',
            [
              [0, 0],
              [0.235, 0],
              [0.251, 0.02],
              [0.261, 0.05],
              [0.258, 0.155],
              [0.245, 0.171],
              [0, 0.17],
            ],
            [0, 0, 0],
            { seg: 40 },
          ),
        'boost',
      ),
      part('quill', [0.04, 0.46, 0], (p) => {
        const feather = new THREE.Shape();
        feather.moveTo(0, 0.07);
        feather.bezierCurveTo(-0.045, 0.145, -0.062, 0.22, -0.026, 0.29);
        feather.bezierCurveTo(-0.016, 0.324, 0.001, 0.35, 0.01, 0.372);
        feather.bezierCurveTo(0.064, 0.323, 0.092, 0.23, 0.031, 0.1);
        feather.lineTo(0, 0.07);
        p.add(
          'paint',
          C.paper,
          new THREE.ExtrudeGeometry(feather, {
            depth: 0.009,
            bevelEnabled: true,
            bevelSize: 0.003,
            bevelThickness: 0.003,
            bevelSegments: 2,
            curveSegments: 10,
            steps: 1,
          }),
          [0, 0, -0.005],
        );
        p.rod(
          'paint',
          C.creamShade,
          0.0035,
          [0, -0.065, 0.003],
          [0.01, 0.362, 0.003],
          12,
        );
        for (let i = 0; i < 7; i++) {
          const y = 0.13 + i * 0.027;
          p.rod(
            'paint',
            C.creamShade,
            0.0014,
            [0.006, y, 0.008],
            [0.048 - Math.max(0, i - 3) * 0.009, y + 0.032, 0.008],
            6,
          );
          p.rod(
            'paint',
            C.creamShade,
            0.0014,
            [0.004, y, 0.008],
            [-0.034 + Math.max(0, i - 3) * 0.006, y + 0.021, 0.008],
            6,
          );
        }
      }),
      ...[0, 1, 2].map((i) =>
        part(`bubble${i}`, [(i - 1) * 0.08, 0.16, (i % 2) * 0.06 - 0.03], (p) =>
          p.sphere('glow', '#9fc4ff', 0.018, [0, 0, 0], { seg: 16 }),
        ),
      ),
    ],
  };
}

function stamper(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.rbox('dark', C.rubber, [0.62, 0.08, 0.6], 0.03, [0, 0.11, 0]);
  k.box('metal', C.steel, [0.36, 0.012, 0.34], [0.02, 0.156, 0]);
  intake(k, 'back', 0.36, 0.12);
  intake(k, 'left', 0.37, 0.12);
  intake(k, 'right', 0.37, 0.12);
  chute(k, 0.16);
  // Two posts and a beam.
  for (const z of [-0.29, 0.29]) {
    k.cyl('metal', C.steel, 0.031, 0.031, 0.5, [-0.05, 0.4, z], { seg: 28 });
    k.cyl('gloss', C.green, 0.046, 0.053, 0.055, [-0.05, 0.184, z], {
      seg: 28,
    });
    k.cyl('gloss', C.green, 0.044, 0.044, 0.072, [-0.05, 0.515, z], {
      seg: 28,
    });
    for (const y of [0.207, 0.48, 0.55])
      k.torus('metal', C.brass, 0.043, 0.006, [-0.05, y, z], { seg: 24 });
    k.sphere('metal', C.brass, 0.037, [-0.05, 0.661, z], { seg: 20 });
  }
  k.rbox('gloss', C.green, [0.16, 0.1, 0.66], 0.03, [-0.05, 0.6, 0]);
  k.rbox('metal', C.brass, [0.17, 0.019, 0.65], 0.008, [-0.05, 0.55, 0]);
  k.cyl('gloss', C.greenDeep, 0.073, 0.073, 0.095, [-0.02, 0.672, 0], {
    seg: 32,
  });
  k.torus('metal', C.brass, 0.073, 0.008, [-0.02, 0.711, 0], { seg: 32 });
  k.cyl('metal', C.brass, 0.034, 0.034, 0.08, [-0.02, 0.54, 0], { seg: 24 });
  for (const z of [-0.23, 0.23]) screw(k, [-0.05, 0.654, z], 0.016);
  bulbStalk(k, [-0.05, 0.72, -0.18]);
  return {
    body: k.merged(),
    height: 0.8,
    rest: new THREE.Vector3(0.02, 0.165, 0),
    parts: [
      part('stamp', [-0.02, 0.4, 0], (p) => {
        p.cyl('metal', C.steel, 0.022, 0.022, 0.24, [0, 0.13, 0], { seg: 28 });
        p.rbox('gloss', C.red, [0.22, 0.09, 0.26], 0.025, [0, 0, 0]);
        p.rbox('metal', C.brass, [0.22, 0.016, 0.26], 0.007, [0, -0.045, 0]);
        p.rbox('dark', C.redDark, [0.2, 0.029, 0.24], 0.008, [0, -0.06, 0]);
        p.cyl('metal', C.brass, 0.047, 0.047, 0.023, [0, 0.055, 0], {
          seg: 28,
        });
        for (const z of [-0.078, 0.078]) screw(p, [0, 0.048, z]);
      }),
      light('light', [-0.05, 0.75, -0.18]),
    ],
  };
}

function gilder(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.rbox('dark', C.rubber, [0.62, 0.08, 0.6], 0.03, [0, 0.11, 0]);
  k.rbox('metal', C.brass, [0.43, 0.009, 0.4], 0.004, [0, 0.154, 0]);
  intake(k, 'back', 0.36, 0.12);
  intake(k, 'left', 0.37, 0.12);
  intake(k, 'right', 0.37, 0.12);
  chute(k, 0.16);
  // A golden arch over the platen with a paint pot on top.
  for (const x of [-0.065, 0.065])
    k.torus('metal', C.gold, 0.3, 0.024, [x, 0.15, 0], {
      axis: 'x',
      arc: Math.PI,
      seg: 40,
    });
  for (const z of [-0.3, 0.3]) {
    k.rbox('gloss', C.green, [0.18, 0.11, 0.085], 0.025, [0, 0.19, z]);
    k.cyl('metal', C.brass, 0.036, 0.036, 0.036, [0, 0.24, z], {
      axis: 'z',
      seg: 24,
    });
    k.cyl('dark', C.rubber, 0.019, 0.019, 0.039, [0, 0.24, z], {
      axis: 'z',
      seg: 20,
    });
  }
  k.lathe(
    'gloss',
    C.green,
    [
      [0, 0],
      [0.097, 0],
      [0.109, 0.014],
      [0.117, 0.075],
      [0.126, 0.09],
      [0.109, 0.09],
      [0.096, 0.019],
      [0, 0.019],
    ],
    [0, 0.458, 0],
    { seg: 32 },
  );
  k.torus('metal', C.brass, 0.118, 0.008, [0, 0.548, 0], { seg: 32 });
  k.cyl('metal', C.gold, 0.106, 0.106, 0.004, [0, 0.535, 0], { seg: 32 });
  k.rod('metal', C.copper, 0.012, [0.09, 0.475, 0.04], [0.12, 0.34, 0.04]);
  k.rod('metal', C.copper, 0.012, [0.12, 0.34, 0.04], [0.05, 0.286, 0.04]);
  bulbStalk(k, [-0.22, 0.5, 0.18]);
  return {
    body: k.merged(),
    height: 0.62,
    rest: new THREE.Vector3(0, 0.165, 0),
    parts: [
      part('brush', [0, 0.24, 0], (p) => {
        p.cyl('paint', '#e9c973', 0.068, 0.068, 0.44, [0, 0, 0], {
          axis: 'z',
          seg: 36,
        });
        p.cyl('metal', C.steel, 0.017, 0.017, 0.61, [0, 0, 0], {
          axis: 'z',
          seg: 20,
        });
        for (const z of [-0.24, 0.24]) {
          p.cyl('gloss', C.redDark, 0.048, 0.048, 0.032, [0, 0, z], {
            axis: 'z',
            seg: 28,
          });
          p.torus('metal', C.brass, 0.048, 0.007, [0, 0, z], {
            axis: 'z',
            seg: 28,
          });
        }
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          p.box(
            'paint',
            '#fff0b0',
            [0.008, 0.01, 0.425],
            [Math.cos(a) * 0.068, Math.sin(a) * 0.068, 0],
            { rot: [0, 0, a] },
          );
        }
      }),
      light('light', [-0.22, 0.53, 0.18]),
    ],
  };
}

function charm(): ModelDef {
  const k = new Kit();
  plinth(k);
  k.lathe(
    'gloss',
    C.green,
    [
      [0, 0],
      [0.22, 0],
      [0.223, 0.017],
      [0.2, 0.05],
      [0.125, 0.081],
      [0.1, 0.09],
      [0.09, 0.22],
      [0.12, 0.241],
      [0.16, 0.26],
      [0.16, 0.29],
      [0, 0.29],
    ],
    [0, 0.07, 0],
    { seg: 40 },
  );
  k.torus('metal', C.brass, 0.16, 0.012, [0, 0.36, 0], { seg: 40 });
  k.torus('metal', C.brass, 0.2, 0.01, [0, 0.088, 0], { seg: 40 });
  k.torus('metal', C.brass, 0.228, 0.009, [0, 0.578, 0], {
    axis: 'z',
    seg: 40,
  });
  for (const x of [-0.135, 0.135])
    k.rod('metal', C.brass, 0.011, [x, 0.363, 0], [x * 1.25, 0.425, 0]);
  return {
    body: k.merged(),
    height: 0.83,
    parts: [
      part(
        'clover',
        [0, 0.58, 0],
        (p) => {
          const leaf = new THREE.Shape();
          leaf.moveTo(0, 0.005);
          leaf.bezierCurveTo(-0.025, 0.046, -0.077, 0.103, -0.054, 0.139);
          leaf.bezierCurveTo(-0.04, 0.163, -0.014, 0.16, 0, 0.137);
          leaf.bezierCurveTo(0.014, 0.16, 0.04, 0.163, 0.054, 0.139);
          leaf.bezierCurveTo(0.077, 0.103, 0.025, 0.046, 0, 0.005);
          for (let i = 0; i < 4; i++)
            p.add(
              'gloss',
              '#ffffff',
              new THREE.ExtrudeGeometry(leaf, {
                depth: 0.018,
                bevelEnabled: true,
                bevelSize: 0.009,
                bevelThickness: 0.009,
                bevelSegments: 3,
                curveSegments: 8,
                steps: 1,
              }),
              [0, 0, -0.009],
              { rot: [0, 0, (i * Math.PI) / 2] },
            );
          p.sphere('gloss', '#ffffff', 0.022, [0, 0, 0.011], { seg: 20 });
          p.cyl('gloss', '#ffffff', 0.012, 0.012, 0.14, [0.03, -0.14, 0], {
            seg: 16,
            rot: [0, 0, 0.3],
          });
        },
        'boost',
      ),
    ],
  };
}

function bundler(): ModelDef {
  const k = new Kit();
  plinth(k);
  // A brass-walled tray.
  k.rbox('dark', C.rubber, [0.62, 0.07, 0.62], 0.03, [0, 0.105, 0]);
  for (const z of [-0.3, 0.3]) {
    k.rbox('metal', C.brass, [0.6, 0.1, 0.03], 0.01, [0, 0.19, z]);
    k.box('gloss', C.green, [0.42, 0.028, 0.035], [0, 0.19, z]);
  }
  k.rbox('metal', C.brass, [0.03, 0.1, 0.6], 0.01, [-0.3, 0.19, 0]);
  k.box('metal', C.steel, [0.43, 0.008, 0.44], [0.035, 0.143, 0]);
  intake(k, 'back', 0.37, 0.12);
  intake(k, 'left', 0.37, 0.12);
  intake(k, 'right', 0.37, 0.12);
  chute(k, 0.16);
  // The ribbon spool on a gantry.
  for (const z of [-0.3, 0.3]) {
    k.rbox('gloss', C.green, [0.065, 0.38, 0.065], 0.018, [-0.22, 0.38, z]);
    k.box('metal', C.brass, [0.075, 0.028, 0.075], [-0.22, 0.21, z]);
    k.cyl('metal', C.brass, 0.026, 0.026, 0.1, [-0.1, 0.5, z], {
      axis: 'z',
      seg: 24,
    });
    k.rod('metal', C.brass, 0.012, [-0.22, 0.555, z], [-0.1, 0.5, z]);
  }
  k.rbox('gloss', C.green, [0.08, 0.06, 0.66], 0.018, [-0.22, 0.58, 0]);
  // The ribbon carriage runs round this fixed hoop, clear of the ticket tray.
  k.torus('metal', C.brass, 0.222, 0.011, [0.04, 0.3, 0], {
    axis: 'x',
    seg: 40,
  });
  for (const z of [-0.235, 0.235])
    k.rbox('gloss', C.green, [0.09, 0.1, 0.047], 0.015, [0.04, 0.235, z]);
  bulbStalk(k, [-0.22, 0.68, 0.22]);
  return {
    body: k.merged(),
    height: 0.76,
    rest: new THREE.Vector3(0.04, 0.15, 0),
    parts: [
      part('spool', [-0.1, 0.5, 0], (p) => {
        p.cyl('gloss', C.red, 0.07, 0.07, 0.3, [0, 0, 0], {
          axis: 'z',
          seg: 36,
        });
        p.cyl('metal', C.brass, 0.1, 0.1, 0.02, [0, 0, 0.16], {
          axis: 'z',
          seg: 36,
        });
        p.cyl('metal', C.brass, 0.1, 0.1, 0.02, [0, 0, -0.16], {
          axis: 'z',
          seg: 36,
        });
        for (const z of [-0.173, 0.173]) {
          p.torus('metal', C.brassDark, 0.075, 0.003, [0, 0, z], {
            axis: 'z',
            seg: 32,
          });
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2;
            p.box(
              'dark',
              C.brassDark,
              [0.042, 0.008, 0.006],
              [Math.cos(a) * 0.046, Math.sin(a) * 0.046, z],
              { rot: [0, 0, a] },
            );
          }
        }
        p.cyl('metal', C.steel, 0.017, 0.017, 0.65, [0, 0, 0], {
          axis: 'z',
          seg: 20,
        });
      }),
      part('ring', [0.04, 0.3, 0], (p) => {
        p.torus('gloss', C.red, 0.205, 0.006, [0, 0, 0], {
          axis: 'x',
          seg: 40,
        });
        p.rbox('gloss', C.red, [0.062, 0.032, 0.063], 0.013, [0, 0.205, 0]);
        p.cyl('metal', C.brass, 0.027, 0.027, 0.09, [0, 0.205, 0], {
          axis: 'x',
          seg: 24,
        });
        p.cyl('paint', C.paper, 0.016, 0.016, 0.073, [0, 0.175, 0], {
          axis: 'z',
          seg: 24,
        });
      }),
      light('light', [-0.22, 0.71, 0.22]),
    ],
  };
}

/** Belts are drawn by their own batch: frames here, the moving top apart. */
export type BeltShape = 'straight' | 'left' | 'right';
export const BELT_TOP = 0.105;
export function beltModel(shape: BeltShape) {
  const k = new Kit();
  let path: THREE.Vector3[];
  if (shape === 'straight') {
    path = [new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0.5, 0, 0)];
    k.rbox('gloss', C.greenDeep, [1, 0.05, 0.5], 0.02, [0, 0.04, 0]);
    for (const x of [-0.42, 0, 0.42]) {
      k.box('metal', C.brass, [0.06, 0.06, 0.04], [x, 0.04, 0.27]);
      k.box('metal', C.brass, [0.06, 0.06, 0.04], [x, 0.04, -0.27]);
    }
  } else {
    // A quarter turn from the side edge (left: -z, right: +z) to the front.
    const s = shape === 'left' ? -1 : 1,
      centre = new THREE.Vector3(0.5, 0, 0.5 * s);
    path = [];
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI + s * (Math.PI / 2) * (i / 32);
      path.push(
        new THREE.Vector3(
          centre.x + Math.cos(a) * 0.5,
          0,
          centre.z + Math.sin(a) * 0.5,
        ),
      );
    }
    const bed = rail(path, 0.5, 0.032, 0.033);
    k.add('gloss', C.greenDeep, bed, [0, 0, 0]);
    k.cyl(
      'metal',
      C.brass,
      0.05,
      0.05,
      0.06,
      [0.5 - 0.08, 0.04, 0.5 * s - 0.08 * s],
      { seg: 24 },
    );
  }
  const sideRail = (offset: number) =>
    path.map((p, i) => {
      const t = pathTangent(path, i);
      return new THREE.Vector3(p.x - t.z * offset, 0, p.z + t.x * offset);
    });
  k.add('metal', C.brass, rail(sideRail(0.235), 0.035, 0.05, 0.075), [0, 0, 0]);
  k.add(
    'metal',
    C.brass,
    rail(sideRail(-0.235), 0.035, 0.05, 0.075),
    [0, 0, 0],
  );
  // Low-profile rollers, bearing caps and rail screws remain visible by the edges.
  for (const end of [0, path.length - 1]) {
    const t = path[end === 0 ? 1 : end]
      .clone()
      .sub(path[end === 0 ? 0 : end - 1])
      .normalize();
    if (shape !== 'straight')
      t.set(end === 0 ? 0 : 1, 0, end === 0 ? (shape === 'left' ? 1 : -1) : 0);
    const side = new THREE.Vector3(-t.z, 0, t.x);
    const centre = path[end]
      .clone()
      .addScaledVector(t, end === 0 ? 0.047 : -0.047)
      .setY(0.066);
    const a = centre.clone().addScaledVector(side, -0.232),
      b = centre.clone().addScaledVector(side, 0.232);
    k.rod(
      'dark',
      C.rubber,
      0.036,
      a.toArray() as [number, number, number],
      b.toArray() as [number, number, number],
      24,
    );
    k.rod(
      'metal',
      C.steel,
      0.017,
      centre.clone().addScaledVector(side, -0.273).toArray() as [
        number,
        number,
        number,
      ],
      centre.clone().addScaledVector(side, 0.273).toArray() as [
        number,
        number,
        number,
      ],
      16,
    );
  }
  for (const offset of [-0.235, 0.235]) {
    const edge = sideRail(offset);
    for (const fraction of [0.08, 0.5, 0.92]) {
      const at =
        shape === 'straight'
          ? new THREE.Vector3(fraction - 0.5, 0.128, offset)
          : edge[Math.round(fraction * (edge.length - 1))].clone().setY(0.128);
      screw(k, at.toArray() as [number, number, number], 0.01);
    }
  }
  const top = strip(path, 0.42, BELT_TOP);
  return { body: k.merged(), top, path };
}

const BUILDERS: Record<Exclude<MachineKind, 'belt'>, () => ModelDef> = {
  printer,
  bot,
  cashier,
  splitter,
  lamp,
  ink,
  stamper,
  gilder,
  charm,
  bundler,
};
export function buildModel(kind: Exclude<MachineKind, 'belt'>) {
  return BUILDERS[kind]();
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** A quick hit that springs back: 1 at the hit, 0 after `len` seconds. */
const hit = (since: number, len: number) =>
  since < 0 || since > len ? 0 : 1 - since / len;

/** Where each moving part sits this frame. */
export function pose(kind: MachineKind, name: string, c: Ctx, o: Pose) {
  o.p.set(0, 0, 0);
  o.r.set(0, 0, 0);
  o.s = 1;
  const working = c.status === 'work' && c.work >= 0;
  const progress = Math.max(0, Math.min(1, c.work));
  const cycle = progress * Math.PI * 2;
  switch (kind) {
    case 'printer': {
      // Whole revolutions per job meet the next job without a phase jump.
      if (name === 'drum') o.r.z = -cycle * 3;
      else if (name === 'roll') o.r.z = -cycle;
      else if (name === 'press') {
        // The press comes down as the ticket finishes and lifts again.
        const down = Math.max(
          c.since >= 0 && c.since < 0.32 ? 1 - ease(c.since / 0.32) : 0,
          ease((progress - 0.78) / 0.22),
        );
        o.p.y = -0.07 * down;
      } else if (name === 'cover')
        o.p.y = 0.0015 * Math.sin(c.t * 16) * (working ? 1 : 0);
      break;
    }
    case 'bot': {
      if (name === 'arm') {
        if (working) {
          o.r.y = Math.sin(c.t * 10 + c.seed * 9) * 0.23;
          o.p.y = -0.008 + (1 - Math.cos(c.t * 20 + c.seed * 18)) * 0.002;
        } else {
          // At rest the arm lifts clear of the platen.
          o.r.z = 0.23;
          o.r.y = -0.12 + Math.sin(c.t * 0.7 + c.seed * 6) * 0.035;
          o.p.y = 0.018;
        }
      } else {
        // Head and eyes: watch the coin, or look about when idle.
        if (working) {
          o.r.y = -Math.PI / 4 + Math.sin(c.t * 10 + c.seed * 9) * 0.09;
          o.r.z = -0.065;
        } else {
          o.r.y = -Math.PI / 4 + Math.sin(c.t * 0.6 + c.seed * 7) * 0.18;
          o.r.z = c.status === 'stuck' ? -0.18 : 0;
        }
        // A happy hop when a ticket comes off.
        o.p.y +=
          0.026 *
          Math.sin(Math.PI * Math.min(1, Math.max(0, c.since / 0.3)) * 1) *
          hit(c.since, 0.3);
      }
      break;
    }
    case 'cashier': {
      const h = hit(c.since, 0.65);
      const open =
        h > 0 ? ease(c.since / 0.13) * (1 - ease((c.since - 0.26) / 0.39)) : 0;
      if (name === 'drawer') o.p.z = 0.105 * open;
      else if (name === 'flag') o.p.y = 0.087 * open;
      else if (name === 'crank')
        o.r.x = h > 0 ? -ease(c.since / 0.5) * Math.PI * 2 : 0;
      break;
    }
    case 'splitter': {
      if (name === 'arrow') o.r.y = c.turn;
      else if (name === 'wheel') o.r.y = c.turn;
      break;
    }
    case 'lamp': {
      o.s = c.boost ? 1 + Math.sin(c.t * 4 + c.seed * 5) * 0.018 : 0.96;
      break;
    }
    case 'ink': {
      if (name === 'ink')
        o.s = 1 + (c.boost ? Math.sin(c.t * 2 + c.seed * 4) * 0.008 : 0);
      else if (name === 'quill') {
        o.r.z =
          -0.35 + (c.boost ? Math.sin(c.t * 1.3 + c.seed * 4) * 0.025 : 0);
        o.r.x = c.boost ? Math.sin(c.t * 0.9 + c.seed * 3) * 0.022 : 0;
      } else {
        const i = Number(name.slice(-1)),
          phase = (c.t * 0.45 + i / 3 + c.seed) % 1;
        o.p.y = phase * 0.15;
        o.p.x = Math.sin(phase * 9 + i) * 0.01;
        o.s = c.boost ? Math.max(0.001, Math.sin(phase * Math.PI)) : 0.001;
      }
      break;
    }
    case 'stamper': {
      if (name === 'stamp') {
        // Up while waiting; it slams down as each ticket is finished.
        const down = ease((progress - 0.62) / 0.27);
        const release =
          c.since >= 0 && c.since < 0.26 ? 1 - ease(c.since / 0.26) : 0;
        o.p.y = -0.16 * Math.max(down, release);
      }
      break;
    }
    case 'gilder': {
      if (name === 'brush') o.r.z = -cycle * 3;
      break;
    }
    case 'charm': {
      o.r.y =
        c.seed * Math.PI * 2 +
        (c.boost ? Math.sin(c.t * 0.9 + c.seed * 5) * 0.65 : 0);
      o.p.y = c.boost ? Math.sin(c.t * 1.8 + c.seed * 5) * 0.018 : 0;
      o.s = c.boost ? 1 : 0.96;
      break;
    }
    case 'bundler': {
      if (name === 'spool') o.r.z = -cycle * 2;
      else if (name === 'ring') {
        const release =
          c.since >= 0 && c.since < 0.3 ? 1 - ease(c.since / 0.3) : 0;
        o.r.x = working ? -cycle * 2 : (1 - release) * Math.PI * 0.3;
        o.s = Math.max(0.001, working ? ease(progress / 0.06) : release);
      }
      break;
    }
  }
}
