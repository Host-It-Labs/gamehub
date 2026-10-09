import * as THREE from 'three';
import { Kit, meshes, type Mat, type Materials } from './kit';

/**
 * The diner rig (9 October 2026): a rounded cab-over truck towing a chrome
 * and cream kitchen trailer. One model serves two places:
 *
 * - **At a stop** (`open: true`) the trailer's long side facing the patio is
 *   one wide hatch: a steel worktop at waist height is the pass, the machines
 *   stand on it, and the kitchen's lit back wall shows behind them. The neon
 *   DINER sign stands on the roof's front edge.
 * - **On the road** (`open: false`) the same side is closed, with a row of
 *   warm windows, and the rig is short and chunky like a toy.
 *
 * Local frame: the trailer runs along +x from its front end (x = 0, the cab
 * side) to x = length; z = 0 is its centre line, +z the side that opens; y up
 * from the ground. The cab sits at negative x, facing -x.
 */
export type RigOptions = {
  /** Trailer length in metres (the shift's is set by the counter). */
  length: number;
  open: boolean;
  quality: 'high' | 'low';
  /** Overworld: smaller wheels, chunkier proportions. */
  toy?: boolean;
  /** How far the open worktop reaches out past the hatch, as a serving ledge. */
  ledge?: number;
};

export type Rig = {
  group: THREE.Group;
  /** Wheel groups, spun by the overworld while driving. */
  wheels: THREE.Object3D[];
  /** Headlight and window glow, dimmed in a brownout. */
  lights: THREE.Material[];
  /** Neon tubes of the roof sign, flickered by the view. */
  neon: THREE.MeshBasicMaterial;
  /** Trailer depth (z), roof height and the worktop's front edge (open rigs). */
  depth: number;
  roof: number;
  dispose(): void;
};

/** The rig's own palette: calm enamel, cream and steel. */
export const RIG = {
  cream: '#ece3cf',
  creamShade: '#d9cdb2',
  cherry: '#b3363b',
  cherryDark: '#7b2229',
  sage: '#8fbcaa',
  sageDark: '#5d907f',
  steel: '#b8c0c6',
  chrome: '#e4e8eb',
  rubber: '#26252a',
  glass: '#2d3640',
  tile: '#4f7f78',
  roof: '#cfc6b6',
  grout: '#3b625c',
  warm: '#ffcf8f',
};

export const TRAILER_DEPTH = 2.7;
export const TRAILER_FLOOR = 0.42;
export const TRAILER_ROOF = 3.0;
/** Bottom and top of the open hatch. */
export const HATCH = { bottom: 0.95, top: 2.62 };
/** The worktop's surface height (the counter machines stand on it). */
export const WORKTOP = 0.93;

type V3 = [number, number, number];

/** A rounded rectangle in the shape's own plane. */
function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * The trailer's cross-section (z across, y up), extruded along +x from x0 to
 * x1. `open` leaves the +z side out between the floor and the roof's curve,
 * as a thin shell; closed sections are solid.
 */
function section(
  open: boolean,
  d: number,
  quality: RigOptions['quality'],
  length: number,
  bevel: number,
) {
  // A bevel grows the shape outward and the ends outward: start smaller.
  const hd = d / 2 - bevel;
  const y0 = TRAILER_FLOOR + bevel;
  const y1 = TRAILER_ROOF - bevel;
  const r = Math.max(0.12, 0.42 - bevel);
  const rb = Math.max(0.04, 0.1 - bevel * 0.5);
  const t = 0.07;
  const s = new THREE.Shape();
  if (!open) {
    s.moveTo(-hd + rb, y0);
    s.lineTo(hd - rb, y0);
    s.quadraticCurveTo(hd, y0, hd, y0 + rb);
    s.lineTo(hd, y1 - r);
    s.quadraticCurveTo(hd, y1, hd - r, y1);
    s.lineTo(-hd + r, y1);
    s.quadraticCurveTo(-hd, y1, -hd, y1 - r);
    s.lineTo(-hd, y0 + rb);
    s.quadraticCurveTo(-hd, y0, -hd + rb, y0);
  } else {
    // Outer: the roof's front curve, over the roof, down the back, along the
    // floor to the front; inner: back the same way, a wall's width inside.
    s.moveTo(hd, y1 - r);
    s.quadraticCurveTo(hd, y1, hd - r, y1);
    s.lineTo(-hd + r, y1);
    s.quadraticCurveTo(-hd, y1, -hd, y1 - r);
    s.lineTo(-hd, y0 + rb);
    s.quadraticCurveTo(-hd, y0, -hd + rb, y0);
    s.lineTo(hd, y0);
    s.lineTo(hd, y0 + t);
    s.lineTo(-hd + t + rb, y0 + t);
    s.quadraticCurveTo(-hd + t, y0 + t, -hd + t, y0 + t + rb);
    s.lineTo(-hd + t, y1 - r);
    s.quadraticCurveTo(-hd + t, y1 - t, -hd + r, y1 - t);
    s.lineTo(hd - r, y1 - t);
    s.quadraticCurveTo(hd - t, y1 - t, hd - t, y1 - r);
    s.lineTo(hd - t, HATCH.top - 0.02);
    s.lineTo(hd, HATCH.top - 0.02);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.01, length - 2 * bevel),
    curveSegments: quality === 'high' ? 10 : 5,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: quality === 'high' ? 6 : 3,
  });
  // Shape x is the trailer's z; the extrusion runs along +x.
  g.rotateY(-Math.PI / 2);
  g.translate(length - bevel, 0, 0);
  return g;
}

/** Stroke paths for the sign's neon letters, in a unit box per letter. */
const LETTERS: Record<string, [number, number][][]> = {
  D: [
    [
      [0, 0],
      [0, 1],
      [0.42, 1],
      [0.72, 0.86],
      [0.86, 0.5],
      [0.72, 0.14],
      [0.42, 0],
      [0, 0],
    ],
  ],
  I: [
    [
      [0.3, 0],
      [0.3, 1],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [0.72, 0],
      [0.72, 1],
    ],
  ],
  E: [
    [
      [0.7, 1],
      [0, 1],
      [0, 0],
      [0.7, 0],
    ],
    [
      [0, 0.5],
      [0.55, 0.5],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.5, 1],
      [0.72, 0.86],
      [0.74, 0.66],
      [0.56, 0.52],
      [0, 0.52],
    ],
    [
      [0.38, 0.52],
      [0.76, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.42, 0.45],
      [0.84, 1],
      [0.84, 0],
    ],
  ],
  O: [
    [
      [0.42, 0],
      [0.12, 0.12],
      [0, 0.5],
      [0.12, 0.88],
      [0.42, 1],
      [0.72, 0.88],
      [0.84, 0.5],
      [0.72, 0.12],
      [0.42, 0],
    ],
  ],
  T: [
    [
      [0, 1],
      [0.8, 1],
    ],
    [
      [0.4, 1],
      [0.4, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [0.68, 0],
    ],
  ],
  A: [
    [
      [0, 0],
      [0.4, 1],
      [0.8, 0],
    ],
    [
      [0.16, 0.38],
      [0.64, 0.38],
    ],
  ],
  G: [
    [
      [0.78, 0.82],
      [0.5, 1],
      [0.2, 0.92],
      [0, 0.5],
      [0.2, 0.08],
      [0.5, 0],
      [0.8, 0.12],
      [0.8, 0.45],
      [0.48, 0.45],
    ],
  ],
  S: [
    [
      [0.76, 0.86],
      [0.44, 1],
      [0.1, 0.88],
      [0.08, 0.64],
      [0.4, 0.5],
      [0.72, 0.38],
      [0.74, 0.12],
      [0.4, 0],
      [0.04, 0.12],
    ],
  ],
};
/** Letter widths, in letter heights. */
export const letterWidth = (c: string) =>
  c === 'I' ? 0.6 : c === 'M' || c === 'D' || c === 'O' ? 0.95 : 0.85;
/** A word's width, in letter heights. */
export const wordWidth = (word: string) =>
  word.split('').reduce((a, c) => a + letterWidth(c), 0) +
  0.22 * (word.length - 1);

/** A word in neon tubes, centred on x, letters `h` tall, facing +z. */
export function neonWord(
  k: Kit,
  word: string,
  at: V3,
  h: number,
  r: number,
  colour: string,
) {
  const widths = word.split('').map(letterWidth);
  const gap = 0.22;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (word.length - 1);
  let x = at[0] - (total * h) / 2;
  word.split('').forEach((c, i) => {
    for (const stroke of LETTERS[c] ?? [])
      k.tube(
        'glow',
        colour,
        stroke.map(([u, v]) => [x + u * h, at[1] + v * h, at[2]] as V3),
        r,
      );
    x += (widths[i] + gap) * h;
  });
}

/** A chunky wheel: tire, cream hubcap, chrome centre. Spins about z. */
function wheel(
  mats: Materials,
  radius: number,
  width: number,
  quality: RigOptions['quality'],
) {
  const k = new Kit();
  const seg = quality === 'high' ? 28 : 16;
  k.cyl('paint', RIG.rubber, radius, radius, width, [0, 0, 0], {
    axis: 'z',
    seg,
  });
  k.torus('paint', '#1c1b1f', radius - 0.015, width * 0.36, [0, 0, 0], {
    rot: [Math.PI / 2, 0, 0],
  });
  for (const side of [-1, 1]) {
    k.cyl(
      'gloss',
      RIG.cream,
      radius * 0.62,
      radius * 0.66,
      0.03,
      [0, 0, side * (width / 2 + 0.005)],
      { axis: 'z', seg },
    );
    k.cyl(
      'chrome',
      RIG.chrome,
      radius * 0.3,
      radius * 0.34,
      0.05,
      [0, 0, side * (width / 2 + 0.02)],
      { axis: 'z', seg },
    );
    k.sphere(
      'chrome',
      RIG.chrome,
      radius * 0.14,
      [0, 0, side * (width / 2 + 0.05)],
      { scale: [1, 1, 0.5] },
    );
  }
  return meshes(k.build(), mats);
}

/** The cab-over truck, facing -x, its back at x = 0. */
function cab(k: Kit, lit: Kit) {
  const L = 2.7; // front to back
  const w = 2.46;
  const x0 = -L;
  const cx = x0 + L / 2;
  const front = [0.62, -0.62];
  // Chassis rails, the fifth wheel and the hitch to the trailer.
  k.box('paint', '#2b2a30', [L + 0.35, 0.22, 1.1], [cx + 0.18, 0.6, 0]);
  k.rbox('chrome', RIG.steel, [0.8, 0.12, 0.5], 0.04, [0.12, 0.72, 0]);
  // Lower body in sage, its face bulging forward a little.
  k.rbox('gloss', RIG.sage, [L, 1.2, w], 0.28, [cx, 1.18, 0]);
  k.rbox('gloss', RIG.sage, [0.3, 1.0, w - 0.3], 0.22, [x0 - 0.04, 1.12, 0]);
  // Dark wheel wells, so the wheels sit inside the body.
  for (const ax of [x0 + 0.66, -0.6])
    for (const sd of [-1, 1]) {
      k.cyl(
        'paint',
        '#1f1e23',
        0.6,
        0.6,
        0.2,
        [ax, 0.62, sd * (w / 2 - 0.08)],
        { axis: 'z', seg: 24 },
      );
      k.torus(
        'gloss',
        RIG.sageDark,
        0.6,
        0.06,
        [ax, 0.62, sd * (w / 2 + 0.01)],
        { rot: [Math.PI / 2, 0, 0], arc: Math.PI },
      );
    }
  // The cream cab, rounded hard at the top, a cherry belt between.
  k.rbox('gloss', RIG.cream, [L - 0.1, 1.3, w - 0.06], 0.42, [
    cx + 0.05,
    2.28,
    0,
  ]);
  k.rbox('gloss', RIG.cherry, [L + 0.03, 0.13, w + 0.03], 0.06, [cx, 1.74, 0]);
  k.rbox('chrome', RIG.chrome, [L + 0.04, 0.03, w + 0.04], 0.012, [
    cx,
    1.82,
    0,
  ]);
  // Windscreen: a wide dark pane with a chrome frame, split down the middle.
  k.rbox('chrome', RIG.chrome, [0.1, 0.74, w - 0.38], 0.12, [
    x0 + 0.02,
    2.3,
    0,
  ]);
  k.rbox('gloss', RIG.glass, [0.1, 0.62, w - 0.5], 0.1, [x0 - 0.0, 2.3, 0]);
  k.box('chrome', RIG.chrome, [0.12, 0.62, 0.05], [x0 - 0.01, 2.3, 0]);
  lit.rbox('glow', '#8fb4c9', [0.02, 0.07, w - 0.9], 0.03, [
    x0 - 0.05,
    2.5,
    0.25,
  ]);
  // Sun visor and roof marker lights.
  k.rbox(
    'gloss',
    RIG.creamShade,
    [0.36, 0.07, w - 0.2],
    0.03,
    [x0 - 0.08, 2.76, 0],
    { rot: [0, 0, -0.2] },
  );
  for (const z of [-0.55, 0, 0.55])
    lit.sphere('glow', '#ffb347', 0.055, [x0 + 0.18, 2.93, z], {
      scale: [1, 0.6, 1],
    });
  for (const sd of [-1, 1]) {
    // Side windows, the door, a handle and a chrome step.
    k.rbox('gloss', RIG.glass, [0.95, 0.56, 0.06], 0.1, [
      x0 + 0.95,
      2.34,
      sd * (w / 2 - 0.01),
    ]);
    k.rbox('chrome', RIG.chrome, [1.02, 0.63, 0.04], 0.12, [
      x0 + 0.95,
      2.34,
      sd * (w / 2 - 0.025),
    ]);
    k.box(
      'paint',
      RIG.creamShade,
      [0.02, 1.0, 0.012],
      [x0 + 1.55, 2.08, sd * (w / 2 - 0.02)],
    );
    k.rbox('chrome', RIG.chrome, [0.2, 0.045, 0.05], 0.018, [
      x0 + 1.38,
      1.96,
      sd * (w / 2 + 0.005),
    ]);
    k.rbox('chrome', RIG.steel, [0.62, 0.07, 0.26], 0.025, [
      x0 + 1.25,
      0.5,
      sd * (w / 2 + 0.07),
    ]);
    // A round mirror on a chrome arm.
    k.tube(
      'chrome',
      RIG.chrome,
      [
        [x0 + 0.4, 2.2, sd * (w / 2)],
        [x0 + 0.18, 2.32, sd * (w / 2 + 0.26)],
        [x0 + 0.18, 2.48, sd * (w / 2 + 0.3)],
      ],
      0.02,
    );
    k.rbox('chrome', RIG.chrome, [0.09, 0.34, 0.2], 0.05, [
      x0 + 0.18,
      2.5,
      sd * (w / 2 + 0.32),
    ]);
  }
  // The face: a chrome grille, two big round headlamps, a badge, a bumper.
  k.rbox('chrome', RIG.chrome, [0.12, 0.5, 1.06], 0.16, [x0 - 0.17, 1.12, 0]);
  for (let i = 0; i < 5; i++)
    k.rbox('paint', '#35383f', [0.04, 0.045, 0.92], 0.02, [
      x0 - 0.22,
      0.95 + i * 0.085,
      0,
    ]);
  k.cyl('gloss', RIG.cherry, 0.11, 0.11, 0.05, [x0 - 0.24, 1.45, 0], {
    axis: 'x',
    seg: 20,
  });
  k.cyl('chrome', RIG.chrome, 0.06, 0.06, 0.06, [x0 - 0.26, 1.45, 0], {
    axis: 'x',
    seg: 14,
  });
  for (const z of front) {
    k.cyl('chrome', RIG.chrome, 0.24, 0.24, 0.12, [x0 - 0.12, 1.3, z * 1.42], {
      axis: 'x',
      seg: 28,
    });
    lit.cyl('glow', '#fff0c8', 0.18, 0.18, 0.04, [x0 - 0.19, 1.3, z * 1.42], {
      axis: 'x',
      seg: 28,
    });
    lit.cyl('glow', '#ffb347', 0.06, 0.06, 0.04, [x0 - 0.18, 0.9, z * 1.62], {
      axis: 'x',
      seg: 14,
    });
  }
  k.rbox('chrome', RIG.chrome, [0.24, 0.24, w + 0.16], 0.1, [
    x0 - 0.2,
    0.62,
    0,
  ]);
  return { axles: [x0 + 0.66, -0.6], width: w };
}

/**
 * The kitchen visible through an open hatch: tiled back splash, a shelf of
 * jars and plates, an order rail, a warm strip light under the roof.
 */
function kitchen(k: Kit, lit: Kit, x0: number, x1: number, hd: number) {
  const back = hd - 1.1;
  // Floor of the kitchen and the tiled wall behind the machines.
  k.box(
    'paint',
    '#4a4247',
    [x1 - x0, 0.04, hd * 2 - 0.2],
    [(x0 + x1) / 2, TRAILER_FLOOR + 0.06, 0],
  );
  k.box(
    'ceramic',
    RIG.tile,
    [x1 - x0, HATCH.top - WORKTOP + 0.2, 0.06],
    [(x0 + x1) / 2, (HATCH.top + WORKTOP) / 2, back],
  );
  for (let y = WORKTOP + 0.16; y < HATCH.top; y += 0.16)
    k.box(
      'paint',
      RIG.grout,
      [x1 - x0, 0.008, 0.01],
      [(x0 + x1) / 2, y, back + 0.035],
    );
  // A shelf with jars and stacked plates, running the length of the hatch.
  k.box(
    'wood',
    '#8a5c3c',
    [x1 - x0 - 0.2, 0.05, 0.3],
    [(x0 + x1) / 2, 1.86, back + 0.17],
  );
  const jars = ['#d9a441', '#c7553d', '#7fae6a', '#e7d9b6', '#9c6b4a'];
  for (let x = x0 + 0.4, i = 0; x < x1 - 0.3; x += 0.38, i++) {
    if (i % 4 === 3) {
      for (let j = 0; j < 4; j++)
        k.cyl('ceramic', '#f6f1e6', 0.12, 0.12, 0.022, [
          x,
          1.9 + j * 0.025,
          back + 0.17,
        ]);
      continue;
    }
    k.cyl('glass', '#f0f4f2', 0.065, 0.065, 0.18, [x, 1.98, back + 0.16]);
    k.cyl('paint', jars[i % jars.length], 0.06, 0.06, 0.13, [
      x,
      1.96,
      back + 0.16,
    ]);
    k.cyl('paint', '#4a4a50', 0.068, 0.068, 0.03, [x, 2.085, back + 0.16]);
  }
  // The order rail with paper slips, just under the hatch top.
  k.cyl(
    'chrome',
    RIG.chrome,
    0.015,
    0.015,
    x1 - x0 - 0.4,
    [(x0 + x1) / 2, 2.38, hd - 0.18],
    { axis: 'x' },
  );
  for (let x = x0 + 0.7; x < x1 - 0.5; x += 1.15 + ((x * 7) % 0.4))
    k.box('paint', '#f7f2e4', [0.13, 0.18, 0.006], [x, 2.27, hd - 0.17], {
      rot: [0, 0, ((x * 13) % 0.3) - 0.15],
    });
  // A warm strip light along the hatch top, lighting the line.
  lit.box(
    'glow',
    RIG.warm,
    [x1 - x0 - 0.3, 0.035, 0.08],
    [(x0 + x1) / 2, HATCH.top - 0.05, hd - 0.12],
  );
}

/**
 * Builds the rig. The open trailer's worktop front edge stands at
 * z = depth / 2 + 0.1 (it overhangs the hatch a little).
 */
export function buildRig(mats: Materials, o: RigOptions): Rig {
  const group = new THREE.Group();
  const k = new Kit();
  const lit = new Kit();
  const L = o.length;
  const d = TRAILER_DEPTH;
  const hd = d / 2;
  const ends = Math.min(0.75, L * 0.12);

  // Shell: two pillowy rounded end blocks and, between them, the open or
  // closed body. The blocks reach into the body so their inner rounding
  // hides inside it and the outside reads as one streamlined car.
  const round = Math.min(0.32, ends * 0.45);
  k.add(
    'gloss',
    RIG.cream,
    section(false, d, o.quality, ends + round, round),
    [0, 0, 0],
  );
  k.add('gloss', RIG.cream, section(false, d, o.quality, ends + round, round), [
    L - ends - round,
    0,
    0,
  ]);
  k.add('gloss', RIG.cream, section(o.open, d, o.quality, L - 2 * ends, 0), [
    ends,
    0,
    0,
  ]);
  // A warm grey roof skin over the body, so the long roof reads apart.
  k.rbox('paint', RIG.roof, [L - 2 * ends + 0.1, 0.03, d - 0.95], 0.012, [
    L / 2,
    TRAILER_ROOF + 0.005,
    0,
  ]);
  // Roof seams and vents, so the long roof is not a blank slab.
  for (let x = 1.2; x < L - 0.8; x += 2.4) {
    k.rbox('chrome', RIG.steel, [0.6, 0.12, 0.6], 0.04, [
      x,
      TRAILER_ROOF + 0.05,
      -0.2,
    ]);
    k.box(
      'paint',
      RIG.creamShade,
      [0.02, 0.01, d - 0.9],
      [x + 1.2, TRAILER_ROOF + 0.004, 0],
    );
  }
  // A cherry belt and chrome trim along both long sides, at the worktop.
  for (const s of o.open ? [-1] : [-1, 1]) {
    k.rbox('gloss', RIG.cherry, [L - 0.2, 0.2, 0.05], 0.03, [
      L / 2,
      1.0,
      s * (hd + 0.02),
    ]);
    k.rbox('chrome', RIG.chrome, [L - 0.18, 0.035, 0.06], 0.015, [
      L / 2,
      1.12,
      s * (hd + 0.025),
    ]);
    k.rbox('chrome', RIG.chrome, [L - 0.18, 0.035, 0.06], 0.015, [
      L / 2,
      0.88,
      s * (hd + 0.025),
    ]);
  }
  // Fluted steel skirt below the belt, both sides.
  for (const s of [-1, 1]) {
    k.rbox('chrome', RIG.steel, [L - 0.3, 0.42, 0.04], 0.02, [
      L / 2,
      0.6,
      s * (hd + 0.01),
    ]);
    for (let x = 0.4; x < L - 0.3; x += 0.16)
      k.box(
        'chrome',
        '#9aa3aa',
        [0.025, 0.36, 0.02],
        [x, 0.6, s * (hd + 0.035)],
      );
  }
  // End caps: cherry belt round the ends, a round porthole, tail lights.
  for (const [x, s] of [
    [0, -1],
    [L, 1],
  ] as const) {
    k.rbox('gloss', RIG.cherry, [0.06, 0.2, d - 0.3], 0.03, [
      x + s * 0.17,
      1.0,
      0,
    ]);
    k.cyl('chrome', RIG.chrome, 0.3, 0.3, 0.06, [x + s * 0.17, 1.95, 0], {
      axis: 'x',
      seg: 28,
    });
    lit.cyl('glow', RIG.warm, 0.24, 0.24, 0.02, [x + s * 0.2, 1.95, 0], {
      axis: 'x',
      seg: 28,
    });
  }
  for (const zs of [-1, 1])
    lit.rbox('glow', '#ff5a4d', [0.04, 0.12, 0.26], 0.03, [
      L + 0.18,
      0.72,
      zs * (hd - 0.35),
    ]);

  if (o.open) {
    // The hatch: the worktop, the lower panel below it, chrome posts at the
    // ends, a striped valance under the roof's front edge.
    const x0 = ends - 0.05;
    const x1 = L - ends + 0.05;
    const ledge = o.ledge ?? 0.12;
    k.rbox('chrome', '#8f969b', [x1 - x0 + 0.1, 0.05, 1.35 + ledge], 0.02, [
      (x0 + x1) / 2,
      WORKTOP - 0.025,
      hd - 0.67 + ledge / 2,
    ]);
    k.cyl(
      'chrome',
      RIG.chrome,
      0.035,
      0.035,
      x1 - x0 + 0.1,
      [(x0 + x1) / 2, WORKTOP - 0.02, hd + ledge],
      { axis: 'x', seg: 14 },
    );
    // The ledge's underside: a cherry fascia with a chrome strip.
    k.rbox('gloss', RIG.cherry, [x1 - x0 + 0.06, 0.16, 0.05], 0.02, [
      (x0 + x1) / 2,
      WORKTOP - 0.1,
      hd + ledge - 0.02,
    ]);
    // Below the ledge: the counter's front, cherry enamel with chrome flutes,
    // down to the deck.
    const front = hd + ledge - 0.05;
    k.box(
      'gloss',
      '#8c3439',
      [x1 - x0, WORKTOP - 0.18, 0.05],
      [(x0 + x1) / 2, (WORKTOP - 0.18) / 2, front],
    );
    for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.5)
      k.rbox('chrome', RIG.chrome, [0.05, WORKTOP - 0.34, 0.03], 0.015, [
        x,
        (WORKTOP - 0.18) / 2 + 0.04,
        front + 0.03,
      ]);
    k.box(
      'paint',
      '#2a2629',
      [x1 - x0, 0.1, 0.07],
      [(x0 + x1) / 2, 0.05, front + 0.01],
    );
    for (const x of [ends - 0.3, L - ends + 0.3])
      k.box(
        'paint',
        '#2a2629',
        [ends + 0.1, TRAILER_FLOOR + 0.05, 0.06],
        [x, TRAILER_FLOOR / 2, hd + 0.02],
      );
    for (const x of [x0, x1])
      k.rbox('chrome', RIG.chrome, [0.1, HATCH.top - WORKTOP, 0.1], 0.03, [
        x,
        (HATCH.top + WORKTOP) / 2,
        hd,
      ]);
    const stripes = Math.round((x1 - x0) / 0.36);
    for (let i = 0; i < stripes; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / stripes;
      k.rbox(
        'cloth',
        i % 2 ? RIG.cream : RIG.cherry,
        [(x1 - x0) / stripes + 0.005, 0.16, 0.04],
        0.01,
        [x, HATCH.top - 0.04, hd + 0.04],
      );
      // A scalloped edge: one rounded tab under each stripe.
      k.cyl(
        'cloth',
        i % 2 ? RIG.cream : RIG.cherry,
        0.09,
        0.09,
        0.04,
        [x, HATCH.top - 0.12, hd + 0.04],
        { axis: 'z', seg: 14 },
      );
    }
    kitchen(k, lit, x0, x1, hd);
  } else {
    // Closed: a row of rounded warm windows between chrome frames.
    const n = Math.max(2, Math.floor((L - 2 * ends) / 1.15));
    const span = (L - 2 * ends) / n;
    for (let i = 0; i < n; i++) {
      const x = ends + span * (i + 0.5);
      for (const s of [-1, 1]) {
        k.add(
          'chrome',
          RIG.chrome,
          new THREE.ExtrudeGeometry(roundedRect(span - 0.18, 0.9, 0.14), {
            depth: 0.04,
            bevelEnabled: false,
            curveSegments: 6,
          }),
          [x, 1.85, s * (hd + 0.005)],
          { rot: [0, s < 0 ? Math.PI : 0, 0] },
        );
        lit.add(
          'glow',
          RIG.warm,
          new THREE.ExtrudeGeometry(roundedRect(span - 0.3, 0.78, 0.1), {
            depth: 0.02,
            bevelEnabled: false,
            curveSegments: 6,
          }),
          [x, 1.85, s * (hd + 0.03)],
          { rot: [0, s < 0 ? Math.PI : 0, 0] },
        );
      }
    }
  }

  // The neon DINER sign in a cherry box, built at its own origin. Open: it
  // stands back on the roof, above the play on tall screens. On the road it
  // turns across the roof, read from behind the truck.
  const signW = o.toy ? d + 0.2 : Math.min(4.6, L * 0.55);
  const signH = o.toy ? 1.0 : 0.82;
  const sk = new Kit();
  const sl = new Kit();
  const neonKit = new Kit();
  const y0 = TRAILER_ROOF + 0.32;
  sk.rbox('gloss', RIG.cherryDark, [signW, signH, 0.18], 0.08, [
    0,
    y0 + signH / 2,
    0,
  ]);
  sk.rbox('chrome', RIG.chrome, [signW + 0.08, 0.06, 0.24], 0.025, [
    0,
    y0 + signH + 0.02,
    0,
  ]);
  sk.rbox('chrome', RIG.chrome, [signW + 0.08, 0.06, 0.24], 0.025, [
    0,
    TRAILER_ROOF + 0.3,
    0,
  ]);
  for (const s of [-1, 1])
    sk.cyl('chrome', RIG.steel, 0.04, 0.04, 0.34, [
      s * signW * 0.38,
      TRAILER_ROOF + 0.15,
      0,
    ]);
  const letter = Math.min(signH * 0.6, (signW * 0.84) / wordWidth('DINER'));
  for (const face of o.open ? [1] : [1, -1])
    neonWord(
      neonKit,
      'DINER',
      [0, y0 + (signH - letter) / 2, face * 0.1],
      letter,
      o.toy ? 0.034 : 0.026,
      '#ffffff',
    );
  // Bulbs round the sign's edge, on each lit face.
  for (const face of o.open ? [1] : [1, -1])
    for (let i = 0; i < 14; i++) {
      const x = -signW / 2 + 0.15 + (i * (signW - 0.3)) / 13;
      sl.sphere('glow', RIG.warm, 0.035, [x, y0 + signH - 0.07, face * 0.1]);
      sl.sphere('glow', RIG.warm, 0.035, [x, TRAILER_ROOF + 0.39, face * 0.1]);
    }
  const signGroup = new THREE.Group();
  signGroup.position.set(L / 2, 0, o.open ? -0.35 : 0);
  if (o.toy) {
    signGroup.position.x = L * 0.42;
    signGroup.rotation.y = Math.PI / 2;
  }
  group.add(signGroup);

  // Wheels: the trailer's tandem axle and the cab's two.
  const wheels: THREE.Object3D[] = [];
  // Under an open kitchen the wheels stay below the worktop.
  const wr = o.toy ? 0.55 : 0.42;
  const trailerAxles = o.toy ? [L * 0.7] : [L - 2.2, L - 1.1];
  const { axles, width } = cab(k, lit);
  for (const ax of trailerAxles)
    for (const s of [-1, 1]) {
      const w = wheel(mats, wr, 0.34, o.quality);
      w.position.set(ax, wr, s * (hd - 0.3));
      group.add(w);
      wheels.push(w);
    }
  for (const ax of axles)
    for (const s of [-1, 1]) {
      const w = wheel(mats, 0.5, 0.36, o.quality);
      w.position.set(ax, 0.5, s * (width / 2 - 0.2));
      group.add(w);
      wheels.push(w);
    }

  group.add(meshes(k.build(), mats));
  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  const litParts = lit.build();
  for (const geo of Object.values(litParts))
    if (geo) {
      const mesh = new THREE.Mesh(geo, glowMat);
      group.add(mesh);
    }
  const neon = new THREE.MeshBasicMaterial({
    color: '#ff7d74',
    toneMapped: false,
  });
  signGroup.add(meshes(sk.build(), mats));
  for (const geo of Object.values(sl.build()))
    if (geo) signGroup.add(new THREE.Mesh(geo, glowMat));
  for (const geo of Object.values(neonKit.build()))
    if (geo) signGroup.add(new THREE.Mesh(geo, neon));
  return {
    group,
    wheels,
    lights: [glowMat],
    neon,
    depth: d,
    roof: TRAILER_ROOF,
    dispose() {
      group.traverse((n) => {
        if (n instanceof THREE.Mesh) n.geometry.dispose();
      });
      glowMat.dispose();
      neon.dispose();
    },
  };
}

export type { Mat };
