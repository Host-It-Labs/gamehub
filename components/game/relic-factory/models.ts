import * as THREE from 'three';
import type { MachineKind } from '@/lib/games/relic/factory';
import { Kit, pathTangent, rail, strip, type MatKey } from './kit';

/** Authored enamel toys, not a palette swap of a shared plinth. A cell is
 * one unit, +x is the outlet and y is up. Low colour pads belong to the floor;
 * every machine has its own structural base and a different primary form.
 * Static/material and animated/part batches share full geometry at every zoom. */
export const C = {
  cobalt: '#4f73a6',
  cobaltDeep: '#34507b',
  charcoal: '#2e3533',
  yellow: '#dcb55e',
  orange: '#d4844a',
  orangeDeep: '#a65d31',
  emerald: '#3f8c69',
  emeraldDeep: '#2b5f4a',
  violet: '#7c6aa8',
  violetDeep: '#54477a',
  lilac: '#a58cc0',
  red: '#bf5446',
  redDark: '#8a3732',
  gold: '#d6ac57',
  ribbon: '#bf6a8f',
  kraft: '#b08d66',
  kraftDeep: '#7c5b3c',
  cream: '#efe8d7',
  paper: '#faf6ec',
  creamShade: '#d8d1c0',
  brass: '#c6a466',
  brassDark: '#8f7142',
  copper: '#a87b57',
  dark: '#252b2b',
  slot: '#121817',
  rubber: '#30353a',
  steel: '#bcc3c4',
  steelShade: '#87918f',
  clover: '#4fa36b',
  stone: '#5f7466',
} as const;

export const MACHINE_COLOUR = {
  printer: C.cobalt,
  belt: C.charcoal,
  bot: C.orange,
  cashier: C.emerald,
  splitter: C.charcoal,
  lamp: C.violet,
  stamper: C.red,
  gilder: C.gold,
  charm: C.lilac,
  bundler: C.ribbon,
} as const;
/** Clear enamel tints; belt and splitter share the Move family's slate pad. */
export const PAD_COLOUR = {
  printer: '#8ea4c0',
  belt: '#93a09a',
  bot: '#cfa888',
  cashier: '#8fb39c',
  splitter: '#93a09a',
  lamp: '#a69ec0',
  stamper: '#c79a91',
  gilder: '#cdb98a',
  charm: '#b4a3c6',
  bundler: '#c6a3b4',
} as const;

export const STATUS = {
  work: new THREE.Color('#86e09c'),
  idle: new THREE.Color('#323b39'),
  full: new THREE.Color('#ecb85a'),
  stuck: new THREE.Color('#ee5a44'),
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
  height: number;
  rest?: THREE.Vector3;
  /** Printer's book swatch; the ticket display follows this authored point. */
  display?: THREE.Vector3;
};
export type Ctx = {
  t: number;
  work: number;
  status: Status;
  since: number;
  turn: number;
  boost: boolean;
  hold: number;
  seed: number;
  /** Boosters: 0 idle to 1 boosting, eased so starts and stops glide. */
  energy: number;
  /** Boosters: accumulated turn, advanced faster the higher the energy. */
  spin: number;
};
export type Pose = { p: THREE.Vector3; r: THREE.Euler; s: number };

/** This is a 16mm floor pad, not the old raised gold platform. */
function pad(k: Kit, kind: keyof typeof PAD_COLOUR) {
  k.rbox('paint', PAD_COLOUR[kind], [0.88, 0.016, 0.88], 0.007, [0, 0.012, 0]);
}
function screw(k: Kit, at: [number, number, number], r = 0.012) {
  k.cyl('metal', C.steel, r, r * 1.05, r * 0.45, at, { seg: 12 });
  k.box(
    'dark',
    C.dark,
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
/** Dark inset mouth plus a broad dark apron: visible from above as well as behind. */
function intake(k: Kit, side: Side, reach = 0.42, y = 0.12) {
  const [sx, sz] = SIDE[side];
  const size = (w: number, h: number, d: number): [number, number, number] =>
    sx ? [d, h, w] : [w, h, d];
  k.rbox('paint', C.steel, size(0.39, 0.105, 0.046), 0.012, [
    sx * reach,
    y,
    sz * reach,
  ]);
  k.rbox('dark', C.slot, size(0.325, 0.071, 0.05), 0.009, [
    sx * (reach + 0.012),
    y,
    sz * (reach + 0.012),
  ]);
  k.rbox('dark', C.slot, size(0.34, 0.012, 0.095), 0.005, [
    sx * (reach - 0.018),
    y + 0.052,
    sz * (reach - 0.018),
  ]);
  k.cyl(
    'dark',
    C.rubber,
    0.019,
    0.019,
    0.29,
    [sx * (reach + 0.035), y - 0.029, sz * (reach + 0.035)],
    { axis: sx ? 'z' : 'x', seg: 20 },
  );
}
/** Orange lip is the permanent direction cue, independent of selection. */
function chute(k: Kit, y = 0.16, side: Side = 'front') {
  const [sx, sz] = SIDE[side];
  const size = (w: number, h: number, d: number): [number, number, number] =>
    sx ? [d, h, w] : [w, h, d];
  k.rbox('dark', C.charcoal, size(0.38, 0.028, 0.2), 0.009, [
    sx * 0.38,
    y - 0.026,
    sz * 0.38,
  ]);
  k.rbox('gloss', C.orange, size(0.405, 0.045, 0.035), 0.01, [
    sx * 0.465,
    y - 0.014,
    sz * 0.465,
  ]);
  for (const s of [-1, 1])
    k.rbox('paint', C.steel, size(0.022, 0.055, 0.16), 0.007, [
      sx * 0.385 + (sx ? 0 : s * 0.19),
      y + 0.002,
      sz * 0.385 + (sx ? s * 0.19 : 0),
    ]);
}
function feeds(k: Kit) {
  intake(k, 'back');
  intake(k, 'left');
  intake(k, 'right');
  chute(k);
}
/** A single larger lamp at the upper back-left of each machine's structure. */
function bulbStalk(k: Kit, at: [number, number, number]) {
  k.cyl(
    'dark',
    C.charcoal,
    0.021,
    0.028,
    0.055,
    [at[0], at[1] - 0.028, at[2]],
    { seg: 20 },
  );
  k.cyl('metal', C.steel, 0.052, 0.042, 0.018, [at[0], at[1] - 0.014, at[2]], {
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
function light(at: [number, number, number]) {
  return part(
    'light',
    at,
    (k) =>
      k.sphere('glow', '#ffffff', 0.05, [0, 0, 0], {
        seg: 20,
        scale: [1, 0.85, 1],
      }),
    'status',
  );
}

function printer(): ModelDef {
  const k = new Kit();
  pad(k, 'printer');
  // Tall cobalt cabinet with small feet, broad white roll and a stepped feed bed.
  for (const z of [-0.26, 0.26])
    k.rbox('dark', C.rubber, [0.69, 0.052, 0.11], 0.017, [-0.05, 0.049, z]);
  k.rbox('gloss', C.cobalt, [0.57, 0.45, 0.69], 0.065, [-0.12, 0.297, 0]);
  k.rbox('gloss', C.cobaltDeep, [0.61, 0.078, 0.71], 0.02, [-0.11, 0.106, 0]);
  k.rbox('paint', C.cream, [0.29, 0.056, 0.56], 0.013, [0.24, 0.208, 0]);
  k.rbox('metal', C.steel, [0.3, 0.012, 0.53], 0.005, [0.24, 0.242, 0]);
  for (const z of [-0.35, 0.35]) {
    k.rbox('gloss', C.cobaltDeep, [0.32, 0.11, 0.015], 0.007, [-0.14, 0.3, z]);
    for (let i = 0; i < 4; i++)
      k.box('dark', C.slot, [0.018, 0.074, 0.018], [-0.24 + i * 0.061, 0.3, z]);
    k.rbox('gloss', C.cobalt, [0.075, 0.18, 0.061], 0.023, [
      -0.23,
      0.565,
      z * 0.94,
    ]);
    k.cyl('metal', C.steel, 0.034, 0.034, 0.018, [-0.23, 0.65, z * 0.94], {
      axis: 'z',
      seg: 24,
    });
    for (const x of [-0.3, 0.04])
      k.cyl('metal', C.steel, 0.014, 0.014, 0.018, [x, 0.3, z], {
        axis: 'z',
        seg: 12,
      });
  }
  // Paper unwinds down the back to the feed drum.
  k.box('paint', C.paper, [0.008, 0.23, 0.49], [-0.1, 0.54, 0], {
    rot: [0, 0, -0.3],
  });
  for (const z of [-0.26, 0.26]) {
    k.rbox('gloss', C.cobalt, [0.15, 0.16, 0.055], 0.022, [0.12, 0.337, z]);
    k.cyl('metal', C.steel, 0.014, 0.014, 0.12, [0.29, 0.3, z * 0.7], {
      seg: 16,
    });
  }
  chute(k);
  const at: [number, number, number] = [-0.28, 0.57, -0.25];
  bulbStalk(k, at);
  return {
    body: k.merged(),
    height: 0.8,
    display: new THREE.Vector3(0.0, 0.537, 0),
    parts: [
      // A small book swatch, not a book-coloured replacement for the cobalt body.
      part(
        'cover',
        [0.0, 0.523, 0],
        (p) => p.rbox('paint', '#ffffff', [0.25, 0.022, 0.38], 0.01, [0, 0, 0]),
        'book',
      ),
      part('roll', [-0.23, 0.65, 0], (p) => {
        p.cyl('paint', C.paper, 0.139, 0.139, 0.59, [0, 0, 0], {
          axis: 'z',
          seg: 40,
        });
        p.cyl('metal', C.steel, 0.026, 0.026, 0.7, [0, 0, 0], {
          axis: 'z',
          seg: 20,
        });
        for (const z of [-0.297, 0.297]) {
          p.cyl('paint', C.kraftDeep, 0.034, 0.034, 0.006, [0, 0, z], {
            axis: 'z',
            seg: 24,
          });
          for (const r of [0.065, 0.098, 0.131])
            p.torus('metal', C.steelShade, r, 0.002, [0, 0, z], {
              axis: 'z',
              seg: 32,
            });
        }
        p.box('paint', C.creamShade, [0.002, 0.012, 0.55], [0.138, 0, 0]);
      }),
      part('drum', [0.12, 0.345, 0], (p) => {
        p.cyl('gloss', C.charcoal, 0.074, 0.074, 0.49, [0, 0, 0], {
          axis: 'z',
          seg: 32,
        });
        p.cyl('metal', C.steel, 0.014, 0.014, 0.59, [0, 0, 0], {
          axis: 'z',
          seg: 20,
        });
        for (const z of [-0.245, 0.245])
          p.cyl('gloss', C.cobaltDeep, 0.077, 0.077, 0.022, [0, 0, z], {
            axis: 'z',
            seg: 28,
          });
        for (const z of [-0.15, 0, 0.15])
          p.torus('metal', C.steel, 0.074, 0.003, [0, 0, z], {
            axis: 'z',
            seg: 28,
          });
      }),
      part('press', [0.29, 0.354, 0], (p) => {
        p.rbox('gloss', C.cobalt, [0.14, 0.056, 0.5], 0.018, [0, 0, 0]);
        p.rbox('dark', C.rubber, [0.14, 0.012, 0.49], 0.005, [0, -0.034, 0]);
        for (const z of [-0.18, 0.18]) {
          p.cyl('metal', C.steel, 0.012, 0.012, 0.13, [0, 0.065, z], {
            seg: 16,
          });
          screw(p, [0, 0.03, z]);
        }
      }),
      light(at),
    ],
  };
}

function bot(): ModelDef {
  const k = new Kit();
  pad(k, 'bot');
  // The character stands beside its platen, with two boots and an orange torso.
  k.rbox('dark', C.charcoal, [0.65, 0.068, 0.66], 0.032, [0.055, 0.082, 0.055]);
  k.rbox('paint', C.steel, [0.47, 0.029, 0.47], 0.014, [0.1, 0.16, 0.1]);
  k.rbox('dark', C.dark, [0.43, 0.008, 0.43], 0.015, [0.1, 0.179, 0.1]);
  feeds(k);
  for (const z of [-0.3, -0.13]) {
    k.rbox('gloss', C.orangeDeep, [0.28, 0.08, 0.13], 0.028, [-0.24, 0.075, z]);
    k.cyl('metal', C.steel, 0.028, 0.033, 0.1, [-0.24, 0.155, z], { seg: 20 });
  }
  k.rbox('gloss', C.orange, [0.25, 0.23, 0.28], 0.047, [-0.23, 0.33, -0.23]);
  k.rbox('paint', C.cream, [0.02, 0.1, 0.18], 0.009, [-0.1, 0.33, -0.23]);
  k.box('dark', C.dark, [0.023, 0.012, 0.11], [-0.092, 0.345, -0.23]);
  k.cyl('dark', C.rubber, 0.054, 0.054, 0.057, [-0.23, 0.464, -0.23], {
    seg: 24,
  });
  for (const z of [-0.38, -0.08])
    k.cyl('metal', C.steel, 0.04, 0.04, 0.025, [-0.23, 0.383, z], {
      axis: 'z',
      seg: 24,
    });
  const at: [number, number, number] = [-0.23, 0.756, -0.25];
  bulbStalk(k, at);
  return {
    body: k.merged(),
    height: 0.81,
    rest: new THREE.Vector3(0.12, 0.19, 0.12),
    parts: [
      part('head', [-0.23, 0.58, -0.23], (p) => {
        p.rbox('gloss', C.orange, [0.31, 0.225, 0.285], 0.058, [0, 0, 0]);
        p.rbox('dark', C.slot, [0.023, 0.104, 0.23], 0.011, [0.149, 0.016, 0]);
        for (const z of [-0.06, 0.06])
          p.sphere('glow', '#f8fafb', 0.026, [0.165, 0.025, z], {
            seg: 18,
            scale: [0.42, 1, 1],
          });
        // Friendly, two-ended smile and enamel ear caps, distinct from the status lamp.
        p.box('paint', C.cream, [0.021, 0.01, 0.082], [0.157, -0.056, 0]);
        for (const z of [-0.039, 0.039])
          p.box('paint', C.cream, [0.021, 0.022, 0.01], [0.157, -0.05, z]);
        for (const z of [-0.147, 0.147])
          p.cyl('gloss', C.orangeDeep, 0.045, 0.045, 0.025, [0, 0, z], {
            axis: 'z',
            seg: 24,
          });
      }),
      part('arm', [-0.23, 0.39, -0.23], (p) => {
        p.rod('metal', C.steel, 0.024, [0, 0, 0], [0.2, 0.012, 0.2]);
        p.rbox(
          'gloss',
          C.orange,
          [0.25, 0.068, 0.08],
          0.024,
          [0.09, 0.012, 0.09],
          { rot: [0, -Math.PI / 4, 0] },
        );
        p.rod('metal', C.steel, 0.02, [0.2, 0.012, 0.2], [0.35, -0.05, 0.35]);
        p.rod(
          'metal',
          C.steel,
          0.013,
          [0.065, -0.025, 0.065],
          [0.3, -0.069, 0.3],
        );
        p.sphere('gloss', C.orangeDeep, 0.049, [0.2, 0.012, 0.2], { seg: 22 });
        p.cyl('metal', C.steel, 0.028, 0.028, 0.084, [0.2, 0.012, 0.2], {
          seg: 20,
        });
        p.rod(
          'metal',
          C.steel,
          0.019,
          [0.35, -0.05, 0.35],
          [0.35, -0.145, 0.35],
        );
        p.cyl('dark', C.rubber, 0.03, 0.025, 0.04, [0.35, -0.134, 0.35], {
          seg: 20,
        });
        for (const z of [0.319, 0.381])
          p.rod('metal', C.steel, 0.01, [0.35, -0.13, z], [0.35, -0.169, z]);
        p.cyl('metal', C.gold, 0.086, 0.086, 0.017, [0.35, -0.181, 0.35], {
          seg: 36,
        });
        p.torus('metal', C.brassDark, 0.073, 0.003, [0.35, -0.171, 0.35], {
          seg: 32,
        });
        p.cyl('gloss', '#ecdcae', 0.061, 0.061, 0.003, [0.35, -0.17, 0.35], {
          seg: 28,
        });
        p.sphere('metal', C.steel, 0.041, [0, 0, 0], { seg: 20 });
      }),
      light(at),
    ],
  };
}

function cashier(): ModelDef {
  const k = new Kit();
  pad(k, 'cashier');
  k.cyl('gloss', C.emeraldDeep, 0.39, 0.41, 0.055, [0, 0.066, 0], { seg: 40 });
  k.cyl('gloss', C.emerald, 0.35, 0.39, 0.13, [0, 0.135, 0], { seg: 40 });
  for (const side of ['front', 'back', 'left', 'right'] as const)
    intake(k, side, 0.42, 0.12);
  k.rbox('gloss', C.emerald, [0.5, 0.23, 0.4], 0.055, [-0.01, 0.3, -0.03]);
  k.rbox(
    'gloss',
    C.emeraldDeep,
    [0.52, 0.045, 0.4],
    0.014,
    [-0.01, 0.205, -0.03],
  );
  k.rbox('dark', C.charcoal, [0.4, 0.026, 0.17], 0.01, [-0.02, 0.4, 0.135], {
    rot: [0.55, 0, 0],
  });
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 5; c++)
      k.cyl(
        'paint',
        c === 4 ? C.gold : C.cream,
        0.026,
        0.026,
        0.025,
        [-0.17 + c * 0.074, 0.419 - r * 0.035, 0.1 + r * 0.06],
        { seg: 16, rot: [0.55, 0, 0] },
      );
  k.rbox(
    'gloss',
    C.emeraldDeep,
    [0.34, 0.09, 0.13],
    0.02,
    [-0.04, 0.46, -0.13],
  );
  k.rbox('dark', C.slot, [0.25, 0.045, 0.012], 0.006, [-0.04, 0.465, -0.06]);
  k.box('paint', C.paper, [0.09, 0.006, 0.072], [0.13, 0.427, -0.1]);
  // Raised coin landmark: solid colour centre, metal rim and embossed coin mark.
  for (const x of [-0.2, 0.04])
    k.cyl('gloss', C.emeraldDeep, 0.023, 0.027, 0.19, [x, 0.53, -0.1], {
      seg: 20,
    });
  k.cyl('gloss', C.gold, 0.183, 0.183, 0.043, [-0.08, 0.685, -0.1], {
    axis: 'z',
    seg: 40,
  });
  for (const z of [-0.126, -0.074]) {
    k.torus('metal', C.brass, 0.166, 0.012, [-0.08, 0.685, z], {
      axis: 'z',
      seg: 40,
    });
    k.cyl('gloss', '#ecdcae', 0.126, 0.126, 0.005, [-0.08, 0.685, z], {
      axis: 'z',
      seg: 32,
    });
    k.box('gloss', C.gold, [0.035, 0.145, 0.008], [-0.08, 0.685, z]);
    for (const y of [0.638, 0.732])
      k.rbox('gloss', C.gold, [0.085, 0.022, 0.008], 0.003, [-0.08, y, z]);
  }
  const at: [number, number, number] = [-0.25, 0.54, -0.25];
  bulbStalk(k, at);
  return {
    body: k.merged(),
    height: 0.88,
    rest: new THREE.Vector3(0, 0.14, 0),
    parts: [
      part('drawer', [0, 0.235, 0.15], (p) => {
        p.rbox('gloss', C.emeraldDeep, [0.4, 0.065, 0.18], 0.018, [0, 0, 0]);
        p.box('dark', C.slot, [0.35, 0.009, 0.14], [0, 0.036, -0.012]);
        p.rbox('metal', C.brass, [0.14, 0.024, 0.026], 0.007, [0, 0, 0.094]);
        for (const x of [-0.055, 0.025, 0.105])
          p.box('metal', C.brassDark, [0.008, 0.02, 0.12], [x, 0.042, -0.012]);
        for (let i = 0; i < 4; i++)
          p.cyl(
            'metal',
            C.gold,
            0.03,
            0.03,
            0.012,
            [-0.12 + i * 0.073, 0.046, -0.02],
            { seg: 20 },
          );
      }),
      part('flag', [0.21, 0.43, -0.1], (p) => {
        p.rbox('gloss', C.gold, [0.12, 0.07, 0.02], 0.007, [0, 0, 0]);
        p.box('paint', C.cream, [0.065, 0.025, 0.025], [0, 0, 0.004]);
      }),
      part('crank', [0.26, 0.32, -0.02], (p) => {
        p.cyl('metal', C.brass, 0.018, 0.018, 0.06, [0.03, 0, 0], {
          axis: 'x',
          seg: 20,
        });
        p.rbox('metal', C.brass, [0.024, 0.13, 0.025], 0.006, [0.06, 0.05, 0]);
        p.sphere('gloss', C.emeraldDeep, 0.028, [0.085, 0.112, 0], { seg: 20 });
      }),
      light(at),
    ],
  };
}

function splitter(): ModelDef {
  const k = new Kit();
  pad(k, 'splitter');
  k.cyl('dark', C.charcoal, 0.415, 0.43, 0.07, [0, 0.063, 0], { seg: 40 });
  k.cyl('gloss', C.charcoal, 0.398, 0.415, 0.04, [0, 0.113, 0], { seg: 40 });
  k.torus('paint', C.steel, 0.385, 0.009, [0, 0.14, 0], { seg: 40 });
  k.cyl('dark', C.slot, 0.352, 0.352, 0.012, [0, 0.141, 0], { seg: 40 });
  intake(k, 'back', 0.42, 0.095);
  for (const side of ['front', 'left', 'right'] as const) chute(k, 0.12, side);
  // Permanent yellow branches plus a large rotating next-exit arrow.
  for (const a of [0, Math.PI / 2, -Math.PI / 2])
    k.chevron(
      'gloss',
      C.yellow,
      0.16,
      0.18,
      0.014,
      [Math.cos(a) * 0.31, 0.157, -Math.sin(a) * 0.31],
      { rot: [0, a, 0] },
    );
  const at: [number, number, number] = [-0.26, 0.207, -0.26];
  bulbStalk(k, at);
  return {
    body: k.merged(),
    height: 0.26,
    rest: new THREE.Vector3(0, 0.166, 0),
    parts: [
      part('wheel', [0, 0.158, 0], (p) => {
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3 + Math.PI / 3;
          p.rbox(
            'gloss',
            C.charcoal,
            [0.24, 0.025, 0.07],
            0.01,
            [Math.cos(a) * 0.145, 0, -Math.sin(a) * 0.145],
            { rot: [0, a, 0] },
          );
        }
      }),
      part('arrow', [0, 0.184, 0], (p) => {
        p.rbox('gloss', C.yellow, [0.25, 0.027, 0.06], 0.01, [0.04, 0, 0]);
        p.chevron('gloss', C.yellow, 0.17, 0.22, 0.028, [0.18, 0, 0]);
        p.cyl('metal', C.steel, 0.037, 0.037, 0.023, [0, 0.014, 0], {
          seg: 24,
        });
      }),
      light(at),
    ],
  };
}

/** The lamp machine is drawn as a Turbo (9 October 2026): a squat enamel
 * engine drum whose three-bladed rotor spins up while it speeds up its
 * neighbours, a speed dial whose needle swings into the red, and eight cream
 * arrows round its foot pointing at the cells it reaches. */
const TURBO_AT: [number, number] = [0.05, 0.05];
/** The dial faces both factory cameras: diagonally out and tilted up. */
const DIAL_NORMAL = new THREE.Vector3(1, 0.62, 1).normalize();
const DIAL_SPIN = new THREE.Quaternion();
function lamp(): ModelDef {
  const k = new Kit();
  const [ox, oz] = TURBO_AT;
  pad(k, 'lamp');
  // A round foot with eight arrows on its rim, one toward each reached cell.
  k.cyl('paint', C.violetDeep, 0.27, 0.29, 0.05, [ox, 0.045, oz], { seg: 40 });
  k.torus('metal', C.brass, 0.272, 0.007, [ox, 0.07, oz], { seg: 40 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    k.chevron(
      'paint',
      C.cream,
      0.046,
      0.05,
      0.006,
      [ox + Math.cos(a) * 0.228, 0.07, oz + Math.sin(a) * 0.228],
      { rot: [0, -a, 0] },
    );
  }
  // The engine drum: a slightly bellied housing with brass bands and vents.
  k.lathe(
    'gloss',
    C.violet,
    [
      [0, 0],
      [0.19, 0],
      [0.198, 0.03],
      [0.192, 0.12],
      [0.16, 0.2],
      [0.12, 0.226],
      [0.05, 0.238],
      [0, 0.238],
    ],
    [ox, 0.07, oz],
    { seg: 40 },
  );
  k.torus('metal', C.brass, 0.197, 0.008, [ox, 0.095, oz], { seg: 40 });
  k.torus('metal', C.brass, 0.15, 0.007, [ox, 0.282, oz], { seg: 40 });
  for (let i = 0; i < 5; i++) {
    // Vents on the back half, away from the dial.
    const a = Math.PI * 0.75 + (i - 2) * 0.42;
    k.rbox(
      'dark',
      C.slot,
      [0.012, 0.05, 0.05],
      0.005,
      [ox + Math.cos(a) * 0.19, 0.18, oz + Math.sin(a) * 0.19],
      { rot: [0, -a, 0] },
    );
  }
  // The speed dial: brass bezel, cream face, a red zone toward "fast".
  const dial = new THREE.Vector3(ox, 0.19, oz).add(
    new THREE.Vector3(DIAL_NORMAL.x, 0, DIAL_NORMAL.z)
      .normalize()
      .multiplyScalar(0.175),
  );
  const face = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    DIAL_NORMAL,
  );
  const put = (
    mat: MatKey,
    colour: string,
    g: THREE.BufferGeometry,
    lift: number,
  ) =>
    k.add(
      mat,
      colour,
      g.applyQuaternion(face),
      dial.clone().addScaledVector(DIAL_NORMAL, lift).toArray() as [
        number,
        number,
        number,
      ],
    );
  put('paint', C.cream, new THREE.CylinderGeometry(0.068, 0.068, 0.02, 32), 0);
  put(
    'metal',
    C.brass,
    new THREE.TorusGeometry(0.07, 0.008, 6, 32).rotateX(Math.PI / 2),
    0.01,
  );
  // The red zone: the upper-right arc of the face, where "fast" sits.
  put(
    'paint',
    C.red,
    new THREE.RingGeometry(
      0.044,
      0.06,
      16,
      1,
      -Math.PI * 0.05,
      Math.PI * 0.42,
    ).rotateX(-Math.PI / 2),
    0.0105,
  );
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.95 - i * 0.25);
    put(
      'dark',
      C.dark,
      new THREE.BoxGeometry(0.006, 0.003, 0.016)
        .translate(0, 0, -0.05)
        .rotateY(a - Math.PI / 2),
      0.0105,
    );
  }
  // Spindle up to the rotor.
  k.rod('metal', C.steel, 0.016, [ox, 0.3, oz], [ox, 0.44, oz]);
  k.cyl('metal', C.brass, 0.034, 0.042, 0.022, [ox, 0.315, oz], { seg: 24 });
  const at: [number, number, number] = [-0.26, 0.131, -0.22];
  bulbStalk(k, at);
  const blade = new THREE.Shape();
  // A broad paddle, narrow at the hub and rounded at the tip.
  blade.moveTo(0.035, -0.024);
  blade.bezierCurveTo(0.11, -0.05, 0.19, -0.085, 0.24, -0.074);
  blade.bezierCurveTo(0.29, -0.06, 0.29, 0.05, 0.245, 0.064);
  blade.bezierCurveTo(0.19, 0.074, 0.11, 0.04, 0.035, 0.024);
  blade.closePath();
  const tip = new THREE.Shape();
  tip.moveTo(0.2, -0.08);
  tip.bezierCurveTo(0.22, -0.081, 0.232, -0.077, 0.24, -0.074);
  tip.bezierCurveTo(0.29, -0.06, 0.29, 0.05, 0.245, 0.064);
  tip.bezierCurveTo(0.232, 0.067, 0.22, 0.068, 0.2, 0.068);
  tip.closePath();
  const pitch = 0.26;
  return {
    body: k.merged(),
    height: 0.52,
    parts: [
      part('rotor', [ox, 0.45, oz], (p) => {
        for (let i = 0; i < 3; i++) {
          const yaw = (i / 3) * Math.PI * 2;
          p.add(
            'paint',
            C.cream,
            new THREE.ExtrudeGeometry(blade, {
              depth: 0.01,
              bevelEnabled: true,
              bevelSize: 0.004,
              bevelThickness: 0.003,
              bevelSegments: 1,
              curveSegments: 10,
            }).translate(0, 0, -0.005),
            [0, 0, 0],
            { rot: [-Math.PI / 2 + pitch, yaw, 0] },
          );
          p.add(
            'gloss',
            C.violet,
            new THREE.ExtrudeGeometry(tip, {
              depth: 0.018,
              bevelEnabled: true,
              bevelSize: 0.0055,
              bevelThickness: 0.003,
              bevelSegments: 1,
              curveSegments: 8,
            }).translate(0, 0, -0.009),
            [0, 0, 0],
            { rot: [-Math.PI / 2 + pitch, yaw, 0] },
          );
        }
        p.lathe(
          'metal',
          C.brass,
          [
            [0, -0.024],
            [0.05, -0.024],
            [0.054, -0.01],
            [0.046, 0.016],
            [0.026, 0.038],
            [0, 0.044],
          ],
          [0, 0, 0],
          { seg: 32 },
        );
        p.sphere('gloss', C.violet, 0.016, [0, 0.042, 0], { seg: 16 });
      }),
      part('needle', dial.toArray() as [number, number, number], (p) => {
        p.add(
          'gloss',
          C.redDark,
          new THREE.BoxGeometry(0.008, 0.004, 0.052)
            .translate(0, 0.014, -0.022)
            .applyQuaternion(face),
          [0, 0, 0],
        );
        p.add(
          'metal',
          C.brass,
          new THREE.CylinderGeometry(0.01, 0.01, 0.01, 16)
            .translate(0, 0.014, 0)
            .applyQuaternion(face),
          [0, 0, 0],
        );
      }),
      light(at),
    ],
  };
}

function stamper(): ModelDef {
  const k = new Kit();
  pad(k, 'stamper');
  k.rbox('gloss', C.redDark, [0.72, 0.09, 0.74], 0.03, [-0.015, 0.074, 0]);
  k.rbox('paint', C.steel, [0.38, 0.032, 0.42], 0.013, [0.02, 0.161, 0]);
  feeds(k);
  // Four thin columns and open bridges read as a press from both floor
  // orientations. A two-post z frame disappeared end-on at the game camera.
  for (const x of [-0.27, 0.23])
    for (const z of [-0.28, 0.28]) {
      k.rbox('gloss', C.red, [0.095, 0.5, 0.095], 0.021, [x, 0.391, z]);
      k.rbox('gloss', C.redDark, [0.14, 0.055, 0.14], 0.015, [x, 0.14, z]);
      k.cyl('metal', C.steel, 0.023, 0.023, 0.37, [x + 0.032, 0.373, z], {
        seg: 24,
      });
      screw(k, [x, 0.66, z], 0.016);
    }
  for (const z of [-0.28, 0.28])
    k.rbox('gloss', C.red, [0.63, 0.105, 0.105], 0.026, [-0.02, 0.652, z]);
  k.rbox('gloss', C.red, [0.12, 0.1, 0.62], 0.025, [-0.025, 0.652, 0]);
  k.cyl('gloss', C.redDark, 0.085, 0.085, 0.1, [-0.025, 0.723, 0], { seg: 28 });
  const at: [number, number, number] = [-0.2, 0.774, -0.25];
  bulbStalk(k, at);
  return {
    body: k.merged(),
    height: 0.83,
    rest: new THREE.Vector3(0.02, 0.18, 0),
    parts: [
      part('stamp', [-0.025, 0.414, 0], (p) => {
        p.cyl('metal', C.steel, 0.026, 0.026, 0.25, [0, 0.11, 0], { seg: 24 });
        p.lathe(
          'gloss',
          C.red,
          [
            [0, 0],
            [0.075, 0],
            [0.095, 0.04],
            [0.068, 0.072],
            [0.052, 0.09],
            [0.052, 0.12],
            [0, 0.12],
          ],
          [0, 0.015, 0],
          { seg: 32 },
        );
        p.rbox('gloss', C.red, [0.32, 0.07, 0.34], 0.03, [0, -0.014, 0]);
        p.rbox('dark', C.slot, [0.3, 0.024, 0.32], 0.01, [0, -0.057, 0]);
        p.torus('gloss', C.redDark, 0.085, 0.004, [0, -0.066, 0], { seg: 28 });
      }),
      light(at),
    ],
  };
}

function gilder(): ModelDef {
  const k = new Kit();
  pad(k, 'gilder');
  for (const z of [-0.3, 0.3])
    k.rbox('paint', C.cream, [0.71, 0.075, 0.14], 0.02, [-0.02, 0.072, z]);
  k.rbox('dark', C.dark, [0.64, 0.066, 0.53], 0.024, [0, 0.113, 0]);
  k.rbox('metal', C.gold, [0.44, 0.014, 0.44], 0.005, [0, 0.166, 0]);
  feeds(k);
  // A large gold burnishing drum on white cheeks. Its circular ends and
  // broad cylindrical roller remain a drum from the overview, not a box.
  for (const z of [-0.285, 0.285]) {
    k.rbox('paint', C.cream, [0.32, 0.29, 0.052], 0.025, [-0.09, 0.28, z]);
    k.cyl('paint', C.cream, 0.233, 0.233, 0.042, [-0.09, 0.408, z], {
      axis: 'z',
      seg: 40,
    });
    k.torus(
      'gloss',
      C.gold,
      0.212,
      0.012,
      [-0.09, 0.408, z + (z < 0 ? -0.024 : 0.024)],
      { axis: 'z', seg: 40 },
    );
    k.cyl('gloss', C.gold, 0.164, 0.164, 0.047, [-0.09, 0.408, z], {
      axis: 'z',
      seg: 36,
    });
    k.cyl('metal', C.steel, 0.042, 0.042, 0.055, [-0.09, 0.408, z], {
      axis: 'z',
      seg: 24,
    });
  }
  k.lathe(
    'gloss',
    C.gold,
    [
      [0, 0],
      [0.089, 0],
      [0.1, 0.012],
      [0.105, 0.065],
      [0.09, 0.083],
      [0, 0.083],
    ],
    [-0.09, 0.642, 0],
    { seg: 32 },
  );
  k.torus('paint', C.cream, 0.095, 0.007, [-0.09, 0.724, 0], { seg: 28 });
  k.rod('metal', C.brass, 0.013, [0.0, 0.68, 0.02], [0.16, 0.405, 0.02]);
  const at: [number, number, number] = [-0.25, 0.69, -0.25];
  bulbStalk(k, at);
  return {
    body: k.merged(),
    height: 0.75,
    rest: new THREE.Vector3(0.01, 0.184, 0),
    parts: [
      part('brush', [-0.09, 0.408, 0], (p) => {
        p.cyl('gloss', C.gold, 0.205, 0.205, 0.51, [0, 0, 0], {
          axis: 'z',
          seg: 40,
        });
        p.cyl('metal', C.steel, 0.018, 0.018, 0.66, [0, 0, 0], {
          axis: 'z',
          seg: 20,
        });
        for (let i = 0; i < 14; i++) {
          const a = (i * Math.PI * 2) / 14;
          p.box(
            'paint',
            '#ecdcae',
            [0.012, 0.026, 0.49],
            [Math.cos(a) * 0.207, Math.sin(a) * 0.207, 0],
            { rot: [0, 0, a - Math.PI / 2] },
          );
        }
      }),
      light(at),
    ],
  };
}

function charm(): ModelDef {
  const k = new Kit();
  pad(k, 'charm');
  k.cyl('gloss', C.lilac, 0.28, 0.32, 0.078, [0, 0.066, 0], { seg: 6 });
  k.lathe(
    'gloss',
    C.lilac,
    [
      [0, 0],
      [0.22, 0],
      [0.215, 0.034],
      [0.11, 0.095],
      [0.095, 0.19],
      [0.14, 0.215],
      [0.18, 0.232],
      [0.18, 0.255],
      [0, 0.255],
    ],
    [0, 0.097, 0],
    { seg: 32 },
  );
  k.torus('gloss', '#6f5a8c', 0.181, 0.012, [0, 0.342, 0], { seg: 32 });
  k.cyl('gloss', C.clover, 0.145, 0.145, 0.006, [0, 0.36, 0], { seg: 28 });
  const at: [number, number, number] = [-0.2, 0.25, -0.25];
  bulbStalk(k, at);
  return {
    body: k.merged(),
    height: 0.85,
    parts: [
      part(
        'clover',
        [0, 0.615, 0],
        (p) => {
          const leaf = new THREE.Shape();
          leaf.moveTo(0, 0.008);
          leaf.bezierCurveTo(-0.042, 0.064, -0.104, 0.128, -0.079, 0.175);
          leaf.bezierCurveTo(-0.058, 0.212, -0.021, 0.214, 0, 0.18);
          leaf.bezierCurveTo(0.021, 0.214, 0.058, 0.212, 0.079, 0.175);
          leaf.bezierCurveTo(0.104, 0.128, 0.042, 0.064, 0, 0.008);
          for (let i = 0; i < 4; i++)
            p.add(
              'gloss',
              '#ffffff',
              new THREE.ExtrudeGeometry(leaf, {
                depth: 0.02,
                bevelEnabled: true,
                bevelSize: 0.009,
                bevelThickness: 0.008,
                bevelSegments: 2,
                curveSegments: 10,
                steps: 1,
              }),
              [0, 0, -0.01],
              { rot: [0, 0, (i * Math.PI) / 2] },
            );
          p.sphere('gloss', '#ffffff', 0.029, [0, 0, 0.018], { seg: 20 });
          p.rod(
            'gloss',
            '#ffffff',
            0.014,
            [0.009, -0.02, 0],
            [0.052, -0.21, 0],
            16,
          );
        },
        'boost',
      ),
      light(at),
    ],
  };
}

function bundler(): ModelDef {
  const k = new Kit();
  pad(k, 'bundler');
  // A low open kraft packing bench with a thin upright magenta reel. The
  // reel's disc profile deliberately differs from the long white paper roll.
  k.rbox('paint', C.kraftDeep, [0.74, 0.065, 0.74], 0.022, [0, 0.058, 0]);
  // Split platen: the wrapping carriage travels through this central gap,
  // below the bundle and above the low base, without crossing the bench.
  for (const [x, w] of [
    [-0.09, 0.36],
    [0.31, 0.2],
  ]) {
    k.rbox('paint', C.kraft, [w, 0.058, 0.69], 0.02, [x, 0.12, 0]);
    k.rbox('paint', C.cream, [w, 0.012, 0.46], 0.005, [x, 0.159, 0]);
  }
  for (const z of [-0.35, 0.35])
    k.rbox('paint', C.kraftDeep, [0.64, 0.05, 0.043], 0.008, [-0.04, 0.177, z]);
  for (const z of [-0.315, -0.125]) {
    k.rbox('paint', C.kraft, [0.12, 0.21, 0.054], 0.015, [-0.22, 0.239, z]);
    k.cyl('metal', C.steel, 0.025, 0.025, 0.025, [-0.22, 0.335, z], {
      axis: 'z',
      seg: 20,
    });
  }
  feeds(k);
  k.torus('paint', C.cream, 0.145, 0.012, [0.15, 0.265, 0], {
    axis: 'x',
    seg: 36,
  });
  for (const z of [-0.16, 0.16])
    k.rbox('paint', C.kraftDeep, [0.06, 0.08, 0.055], 0.012, [0.15, 0.188, z]);
  const at: [number, number, number] = [-0.23, 0.56, -0.25];
  bulbStalk(k, at);
  return {
    body: k.merged(),
    height: 0.61,
    rest: new THREE.Vector3(0.15, 0.166, 0),
    parts: [
      part('spool', [-0.22, 0.335, -0.22], (p) => {
        p.cyl('gloss', C.ribbon, 0.176, 0.176, 0.12, [0, 0, 0], {
          axis: 'z',
          seg: 40,
        });
        for (const z of [-0.066, 0.066]) {
          p.cyl('paint', C.kraft, 0.19, 0.19, 0.015, [0, 0, z], {
            axis: 'z',
            seg: 40,
          });
          p.cyl('gloss', C.ribbon, 0.164, 0.164, 0.021, [0, 0, z], {
            axis: 'z',
            seg: 36,
          });
          p.torus(
            'gloss',
            '#dcaac0',
            0.135,
            0.005,
            [0, 0, z + (z < 0 ? -0.013 : 0.013)],
            { axis: 'z', seg: 32 },
          );
          p.cyl('paint', C.cream, 0.037, 0.037, 0.03, [0, 0, z], {
            axis: 'z',
            seg: 24,
          });
        }
        p.cyl('metal', C.steel, 0.017, 0.017, 0.24, [0, 0, 0], {
          axis: 'z',
          seg: 20,
        });
        p.box('gloss', '#dcaac0', [0.014, 0.06, 0.028], [0.1, 0.06, 0.08], {
          rot: [0, 0, -0.5],
        });
      }),
      part('ring', [0.15, 0.265, 0], (p) => {
        p.torus('gloss', C.ribbon, 0.132, 0.009, [0, 0, 0], {
          axis: 'x',
          seg: 32,
        });
        p.rbox('gloss', C.ribbon, [0.065, 0.035, 0.06], 0.013, [0, 0.132, 0]);
        p.cyl('metal', C.steel, 0.023, 0.023, 0.087, [0, 0.132, 0], {
          axis: 'x',
          seg: 20,
        });
      }),
      light(at),
    ],
  };
}

/** Belts are drawn by their own batch: frames here, the moving top apart. */
export type BeltShape = 'straight' | 'left' | 'right';
export const BELT_TOP = 0.105;
export function beltModel(shape: BeltShape) {
  const k = new Kit();
  pad(k, 'belt');
  let path: THREE.Vector3[];
  if (shape === 'straight') {
    path = [new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0.5, 0, 0)];
    k.rbox('gloss', C.charcoal, [1, 0.05, 0.68], 0.02, [0, 0.04, 0]);
    for (const x of [-0.42, 0, 0.42]) {
      k.box('paint', C.charcoal, [0.06, 0.06, 0.04], [x, 0.04, 0.27]);
      k.box('paint', C.charcoal, [0.06, 0.06, 0.04], [x, 0.04, -0.27]);
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
    const bed = rail(path, 0.68, 0.032, 0.033);
    k.add('gloss', C.charcoal, bed, [0, 0, 0]);
    k.cyl(
      'metal',
      C.charcoal,
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
  k.add(
    'paint',
    C.charcoal,
    rail(sideRail(0.335), 0.035, 0.05, 0.075),
    [0, 0, 0],
  );
  k.add(
    'metal',
    C.charcoal,
    rail(sideRail(-0.335), 0.035, 0.05, 0.075),
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
    const a = centre.clone().addScaledVector(side, -0.322),
      b = centre.clone().addScaledVector(side, 0.322);
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
      centre.clone().addScaledVector(side, -0.358).toArray() as [
        number,
        number,
        number,
      ],
      centre.clone().addScaledVector(side, 0.358).toArray() as [
        number,
        number,
        number,
      ],
      16,
    );
  }
  for (const offset of [-0.335, 0.335]) {
    const edge = sideRail(offset);
    for (const fraction of [0.08, 0.5, 0.92]) {
      const at =
        shape === 'straight'
          ? new THREE.Vector3(fraction - 0.5, 0.128, offset)
          : edge[Math.round(fraction * (edge.length - 1))].clone().setY(0.128);
      screw(k, at.toArray() as [number, number, number], 0.01);
    }
  }
  // A dark feed roller behind; orange lip at the front never scrolls.
  k.rbox('gloss', C.orange, [0.028, 0.027, 0.64], 0.006, [0.481, 0.104, 0]);
  const top = strip(path, 0.6, BELT_TOP);
  return { body: k.merged(), top, path };
}

const BUILDERS: Record<Exclude<MachineKind, 'belt'>, () => ModelDef> = {
  printer,
  bot,
  cashier,
  splitter,
  lamp,
  stamper,
  gilder,
  charm,
  bundler,
};
export function buildModel(kind: Exclude<MachineKind, 'belt'>): ModelDef {
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
      } else if (name === 'head') {
        // Head: watch the coin, or look about when idle.
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
      if (name === 'rotor') o.r.y = -c.spin * 9 - c.seed * 2;
      else if (name === 'needle') {
        // Slow on the left, into the red while it boosts, trembling there.
        const angle =
          Math.PI * (0.42 - 0.8 * c.energy) +
          Math.sin(c.t * 37 + c.seed * 11) * 0.05 * c.energy;
        o.r.setFromQuaternion(DIAL_SPIN.setFromAxisAngle(DIAL_NORMAL, angle));
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
      if (name !== 'clover') break;
      // One continuous turn: drifting at rest, twirling while it helps.
      o.r.y = c.seed * Math.PI * 2 + c.spin * 1.6;
      o.p.y = Math.sin(c.t * 1.8 + c.seed * 5) * 0.018 * c.energy;
      o.s = 0.96 + 0.04 * c.energy;
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
