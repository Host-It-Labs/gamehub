import * as THREE from 'three';
import {
  HAIRS,
  HAT_COLOURS,
  SKINS,
  type Look,
} from '@/lib/games/diner/content';
import { Kit, type Mat } from './kit';

/**
 * Editable character master. These surfaces author anatomy, cloth panels and
 * swept hair instead of assembling a stack of primitive bodies. Keep this
 * source when preparing lower-density runtime copies.
 */
export const HUMAN_SOURCE = Object.freeze({
  radial: 48,
  samples: 4,
  patch: 20,
});
export type PeopleDetail = 'source' | 'runtime';
/**
 * The tallest normal play camera presents an adult at about 90px. For a
 * 0.215m torso radius, 24 radial samples have a circular chord error of
 * 0.00184m (0.13px at that camera). Every authored ring still participates;
 * only samples between rings/along curves change. Faces keep denser samples.
 * The exact accepted v6 source also lives beside the review GLBs.
 */
export const HUMAN_RUNTIME = Object.freeze({
  radial: 24,
  samples: 2,
  patch: 12,
});
let detail: PeopleDetail = 'source';

/** Geometry/cache builders are synchronous; selection never escapes a build. */
export function withPeopleDetail<T>(next: PeopleDetail, build: () => T): T {
  const previous = detail;
  detail = next;
  try {
    return build();
  } finally {
    detail = previous;
  }
}

function radialSamples(source: number) {
  return detail === 'source' ? source : Math.max(12, Math.ceil(source / 8) * 4);
}
function patchSamples(source: number) {
  return detail === 'source'
    ? source
    : Math.max(4, Math.ceil((source * 0.6) / 2) * 2);
}
export const HUMAN = Object.freeze({
  hip: 0.59,
  thigh: 0.275,
  shin: 0.229,
  ankle: 0.086,
  shoulder: 0.908,
  upperArm: 0.211,
  forearm: 0.188,
  head: 1.109,
});

export type V3 = [number, number, number];
type Ring = {
  y: number;
  w: number;
  front: number;
  back: number;
  x?: number;
  z?: number;
  power?: number;
};
type Sculpt = (p: THREE.Vector3, angle: number) => void;
const cream = '#fff7e8';
const ink = '#2d2628';
const clamp = THREE.MathUtils.clamp;
const gaussian = (
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) => Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
export const tint = (base: string, colour: string, amount: number) =>
  `#${new THREE.Color(base).lerp(new THREE.Color(colour), amount).getHexString()}`;

function curve(a: number, b: number, c: number, d: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3)
  );
}

/** Smooth cross sections retain the deliberately authored width/depth changes. */
export function atRing(rings: readonly Ring[], y: number): Ring {
  let i = 0;
  while (i < rings.length - 2 && y > rings[i + 1].y) i++;
  const b = rings[i],
    c = rings[i + 1];
  const t = clamp((y - b.y) / (c.y - b.y), 0, 1);
  const a = rings[Math.max(0, i - 1)],
    d = rings[Math.min(rings.length - 1, i + 2)];
  const value = (key: Exclude<keyof Ring, 'y'>, fallback = 0) => {
    const bv = b[key] ?? fallback,
      cv = c[key] ?? fallback;
    return clamp(
      curve(a[key] ?? fallback, bv, cv, d[key] ?? fallback, t),
      Math.min(bv, cv),
      Math.max(bv, cv),
    );
  };
  return {
    y,
    w: value('w'),
    front: value('front'),
    back: value('back'),
    x: value('x'),
    z: value('z'),
    power: value('power', 2),
  };
}

function ringPoint(r: Ring, angle: number) {
  const s = Math.sin(angle),
    c = Math.cos(angle),
    p = 2 / (r.power ?? 2);
  return new THREE.Vector3(
    Math.sign(s) * Math.abs(s) ** p * r.w + (r.x ?? 0),
    r.y,
    Math.sign(c) * Math.abs(c) ** p * (c >= 0 ? r.front : r.back) + (r.z ?? 0),
  );
}

export function loft(
  rings: readonly Ring[],
  sculpt?: Sculpt,
  radial: number = HUMAN_SOURCE.radial,
  samples: number = HUMAN_SOURCE.samples,
  caps: 'both' | 'top' | 'bottom' | 'none' = 'both',
  protectedRuntime?: { radial: number; samples: number },
) {
  radial =
    detail === 'runtime' && protectedRuntime
      ? protectedRuntime.radial
      : radialSamples(radial);
  if (detail === 'runtime')
    samples = protectedRuntime?.samples ?? Math.max(1, Math.ceil(samples / 2));
  const rows: Ring[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < samples; j++) {
      const y = THREE.MathUtils.lerp(rings[i].y, rings[i + 1].y, j / samples);
      rows.push(atRing(rings, y));
    }
  }
  rows.push(rings[rings.length - 1]);
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const around = Math.max(...rings.map((r) => r.w)) * Math.PI * 2;
  for (const r of rows)
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const p = ringPoint(r, a);
      sculpt?.(p, a);
      positions.push(p.x, p.y, p.z);
      uv.push((j / radial) * around, r.y);
    }
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j,
        b = a + radial + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  for (const [row, upper] of [
    [0, false],
    [rows.length - 1, true],
  ] as const) {
    if (caps === 'none' || (upper ? caps === 'bottom' : caps === 'top'))
      continue;
    const r = rows[row],
      centre = positions.length / 3;
    positions.push(r.x ?? 0, r.y, r.z ?? 0);
    uv.push(0, r.y);
    for (let j = 0; j < radial; j++) {
      const a = row * (radial + 1) + j;
      indices.push(centre, upper ? a : a + 1, upper ? a + 1 : a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Shared seam normals avoid a visible cut down the back of the organic form.
  const n = g.getAttribute('normal');
  for (let i = 0; i < rows.length; i++) {
    const a = i * (radial + 1),
      b = a + radial;
    const v = new THREE.Vector3(
      n.getX(a) + n.getX(b),
      n.getY(a) + n.getY(b),
      n.getZ(a) + n.getZ(b),
    ).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  g.userData.metreUV = true;
  return g;
}

function patch(
  fn: (u: number, v: number) => V3,
  nu: number = HUMAN_SOURCE.patch,
  nv: number = HUMAN_SOURCE.patch,
  reverse = false,
) {
  nu = patchSamples(nu);
  nv = patchSamples(nv);
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let v = 0; v <= nv; v++)
    for (let u = 0; u <= nu; u++) {
      const p = fn(u / nu, v / nv);
      positions.push(...p);
      uv.push(p[0], p[1]);
    }
  for (let v = 0; v < nv; v++)
    for (let u = 0; u < nu; u++) {
      const a = v * (nu + 1) + u,
        b = a + nu + 1;
      indices.push(
        ...(reverse
          ? [a, b, a + 1, b, b + 1, a + 1]
          : [a, a + 1, b, b, a + 1, b + 1]),
      );
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.userData.metreUV = true;
  return g;
}

/** A continuous shaped lock or finger; the cross section follows its path. */
function sweep(
  points: V3[],
  widths: number[],
  depths: number[],
  steps = 24,
  radial = 16,
  roundTip = 0,
) {
  if (detail === 'runtime') {
    steps = Math.max(12, Math.ceil(steps / 2));
    radial = Math.max(8, Math.ceil(radial / 4) * 2);
  }
  const path = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'catmullrom',
    0.4,
  );
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      p = path.getPoint(t),
      tangent = path.getTangent(t);
    const right = new THREE.Vector3()
      .crossVectors(tangent, new THREE.Vector3(0, 0, 1))
      .normalize();
    if (right.lengthSq() < 0.1) right.set(1, 0, 0);
    const front = new THREE.Vector3().crossVectors(right, tangent).normalize();
    const section = t * (widths.length - 1),
      a = Math.min(widths.length - 2, Math.floor(section)),
      f = section - a;
    const cap =
      roundTip && t > 1 - roundTip
        ? Math.sqrt(
            Math.max(0.0001, 1 - ((t - (1 - roundTip)) / roundTip) ** 2),
          )
        : 1;
    const w = THREE.MathUtils.lerp(widths[a], widths[a + 1], f) * cap,
      d = THREE.MathUtils.lerp(depths[a], depths[a + 1], f) * cap;
    for (let j = 0; j <= radial; j++) {
      const angle = (j / radial) * Math.PI * 2;
      const v = p
        .clone()
        .addScaledVector(right, Math.sin(angle) * w)
        .addScaledVector(front, Math.cos(angle) * d);
      positions.push(v.x, v.y, v.z);
      uv.push((j / radial) * w * Math.PI * 2, t * path.getLength());
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j,
        b = a + radial + 1;
      // Sweeps run from shoulder to hand or from a hair root to its tip.
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.userData.metreUV = true;
  return g;
}

function stroke(
  k: Kit,
  mat: Mat,
  colour: string,
  points: V3[],
  r: number,
  preserveCurve = false,
) {
  const path = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'catmullrom',
    0.25,
  );
  k.add(
    mat,
    colour,
    new THREE.TubeGeometry(
      path,
      Math.max(
        12,
        Math.ceil(
          points.length * (detail === 'source' || preserveCurve ? 5 : 2.5),
        ),
      ),
      r,
      6,
      false,
    ),
    [0, 0, 0],
  );
}

function leaf(k: Kit, colour: string, points: [number, number][], z: number) {
  const shape = new THREE.Shape();
  shape.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) shape.lineTo(...points[i]);
  shape.closePath();
  k.add(
    'cloth',
    colour,
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.003,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.003,
      bevelSegments: 3,
      curveSegments: 16,
    }),
    [0, 0, z],
  );
}

const headRings: Ring[] = [
  { y: -0.139, w: 0.025, front: 0.053, back: 0.026, z: 0.005 },
  { y: -0.133, w: 0.05, front: 0.074, back: 0.045, z: 0.003 },
  { y: -0.115, w: 0.079, front: 0.095, back: 0.06, power: 2.6 },
  { y: -0.084, w: 0.111, front: 0.107, back: 0.081, power: 2.4 },
  { y: -0.049, w: 0.132, front: 0.116, back: 0.105, power: 2.3 },
  { y: -0.012, w: 0.143, front: 0.125, back: 0.12, power: 2.3 },
  { y: 0.024, w: 0.146, front: 0.126, back: 0.128, power: 2.3 },
  { y: 0.065, w: 0.143, front: 0.115, back: 0.13, power: 2.2 },
  { y: 0.104, w: 0.134, front: 0.107, back: 0.124 },
  { y: 0.14, w: 0.108, front: 0.083, back: 0.105 },
  { y: 0.163, w: 0.059, front: 0.043, back: 0.058 },
  { y: 0.174, w: 0.002, front: 0.002, back: 0.002 },
];

function faceSculpt(p: THREE.Vector3, angle: number) {
  if (Math.cos(angle) <= 0) return;
  const front = Math.cos(angle) ** 3;
  const cheek = gaussian(Math.abs(p.x), p.y, 0.099, -0.028, 0.041, 0.032);
  const socket = gaussian(Math.abs(p.x), p.y, 0.059, 0.037, 0.031, 0.022);
  const brow = gaussian(Math.abs(p.x), p.y, 0.063, 0.072, 0.047, 0.017);
  const muzzle = gaussian(p.x, p.y, 0, -0.068, 0.049, 0.035);
  const philtrum = gaussian(p.x, p.y, 0, -0.044, 0.01, 0.018);
  p.z +=
    front *
    (cheek * 0.014 -
      socket * 0.011 +
      brow * 0.011 +
      muzzle * 0.006 -
      philtrum * 0.002);
}

function warmSkin(k: Kit, base: string) {
  const g = k.parts.skin?.at(-1);
  if (!g) return;
  const pos = g.getAttribute('position'),
    colours = g.getAttribute('color');
  const c = new THREE.Color(base),
    rose = new THREE.Color(tint(base, '#b75845', 0.19));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const cheek =
      gaussian(Math.abs(x), y, 0.1, -0.037, 0.041, 0.027) *
      clamp(z / 0.1, 0, 1);
    const colour = c.clone().lerp(rose, cheek * 0.65);
    colours.setXYZ(i, colour.r, colour.g, colour.b);
  }
}

/** A soft nasal tip and alar plane lead into an embedded bridge. */
function nose(k: Kit, skin: string, variant: number) {
  const n = variant % 5;
  const width = [0.97, 1.04, 1.13, 0.9, 1.17][n];
  const projection = [1, 0.77, 1.02, 1.1, 1.08][n];
  k.add(
    'skin',
    skin,
    loft(
      [
        { y: -0.037, w: 0.007, front: 0.005, back: 0.005, z: 0.128 },
        {
          y: -0.03,
          w: 0.015 * width,
          front: 0.019,
          back: 0.005,
          z: 0.13,
          power: 2.5,
        },
        {
          y: -0.022,
          w: 0.023 * width,
          front: 0.033,
          back: 0.005,
          z: 0.128,
          power: 2.3,
        },
        {
          y: -0.012,
          w: 0.024 * width,
          front: 0.038,
          back: 0.005,
          z: 0.129,
          power: 2.2,
        },
        { y: 0.0, w: 0.018 * width, front: 0.034, back: 0.005, z: 0.127 },
        { y: 0.013, w: 0.011 * width, front: 0.025, back: 0.005, z: 0.126 },
        { y: 0.032, w: 0.008 * width, front: 0.016, back: 0.004, z: 0.122 },
        { y: 0.054, w: 0.005, front: 0.007, back: 0.003, z: 0.118 },
        { y: 0.064, w: 0.002, front: 0.002, back: 0.002, z: 0.116 },
      ],
      (p) => {
        if (p.z > 0.128) p.z = 0.128 + (p.z - 0.128) * projection;
        if (n === 1 && p.y < 0.013) p.y += 0.005;
        if (n === 4 && p.y < 0.009) p.y -= 0.003;
      },
      32,
    ),
    [0, 0, 0],
  );
  for (const s of [-1, 1]) {
    stroke(
      k,
      'skin',
      tint(skin, '#64392f', 0.23),
      [
        [s * 0.011, -0.027, 0.147],
        [s * 0.018, -0.025, 0.143],
        [s * 0.021, -0.022, 0.137],
      ],
      0.0019,
    );
  }
}

function ears(k: Kit, skin: string) {
  for (const side of [-1, 1]) {
    k.add(
      'skin',
      skin,
      loft(
        [
          { y: -0.055, w: 0.009, front: 0.009, back: 0.01 },
          { y: -0.043, w: 0.016, front: 0.015, back: 0.018 },
          { y: -0.014, w: 0.019, front: 0.022, back: 0.025 },
          { y: 0.017, w: 0.014, front: 0.017, back: 0.022 },
          { y: 0.023, w: 0.005, front: 0.008, back: 0.006 },
        ],
        undefined,
        24,
      ),
      [side * 0.145, 0, -0.008],
      { rot: [0, side * 0.25, -side * 0.11] },
    );
    stroke(
      k,
      'skin',
      tint(skin, '#ac624c', 0.25),
      [
        [side * 0.158, 0.009, 0.007],
        [side * 0.165, -0.004, 0.014],
        [side * 0.159, -0.031, 0.011],
      ],
      0.003,
    );
    stroke(
      k,
      'skin',
      tint(skin, cream, 0.025),
      [
        [side * 0.155, -0.001, 0.017],
        [side * 0.155, -0.017, 0.019],
      ],
      0.004,
    );
  }
}

function eyePatch(
  k: Kit,
  mat: Mat,
  colour: string,
  x: number,
  width: number,
  height: number,
  z: number,
) {
  k.add(
    mat,
    colour,
    patch(
      (u, v) => {
        const xx = (u * 2 - 1) * width;
        const edge = Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2));
        const yy = (v * 2 - 1) * height * edge;
        return [
          x + xx,
          0.036 + yy,
          z + (1 - ((xx / width) ** 2 + (yy / height) ** 2)) * 0.004,
        ];
      },
      16,
      8,
    ),
    [0, 0, 0],
  );
}

function eyes(k: Kit, skin: string, hair: string) {
  const iris = tint(hair, '#42646b', 0.62);
  for (const s of [-1, 1]) {
    const x = s * 0.057;
    eyePatch(k, 'gloss', cream, x, 0.027, 0.011, 0.126);
    // Restrained pupils sit inside the socket; no protruding doll eyeballs.
    eyePatch(k, 'gloss', iris, x + 0.001, 0.0086, 0.0097, 0.131);
    eyePatch(k, 'gloss', ink, x + 0.001, 0.0043, 0.0064, 0.135);
    k.sphere('gloss', '#ffffff', 0.0021, [x + 0.003, 0.041, 0.139], {
      seg: 8,
      scale: [1, 1, 0.3],
    });
    stroke(
      k,
      'skin',
      tint(skin, '#6d4034', 0.14),
      [
        [x - 0.026, 0.035, 0.123],
        [x - 0.014, 0.047, 0.13],
        [x + 0.009, 0.049, 0.133],
        [x + 0.026, 0.036, 0.125],
      ],
      0.0031,
    );
    stroke(
      k,
      'skin',
      skin,
      [
        [x - 0.025, 0.033, 0.125],
        [x, 0.025, 0.132],
        [x + 0.024, 0.033, 0.126],
      ],
      0.0025,
    );
    // Brows broaden at the nose, taper at the temple and follow the skull.
    k.add(
      'hair',
      hair,
      sweep(
        [
          [x - 0.031, 0.075, 0.12],
          [x - 0.006, 0.082, 0.128],
          [x + 0.023, 0.077, 0.12],
        ],
        [0.002, 0.006, 0.001],
        [0.002, 0.0035, 0.001],
        18,
        12,
      ),
      [0, 0, 0],
    );
  }
}

function glasses(k: Kit) {
  for (const side of [-1, 1]) {
    const x = side * 0.061;
    // Curved broad lenses, a rim following their perimeter and proper temples.
    k.add(
      'gloss',
      '#293039',
      patch(
        (u, v) => {
          const xx = (u * 2 - 1) * 0.047;
          const yy =
            (v * 2 - 1) *
            0.031 *
            (0.82 + 0.18 * Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2)));
          return [x + xx, 0.038 + yy, 0.156 - ((x + xx) / 0.19) ** 2 * 0.015];
        },
        16,
        10,
      ),
      [0, 0, 0],
    );
    const rim = [
      [x - 0.047, 0.037, 0.151],
      [x - 0.037, 0.069, 0.153],
      [x + 0.031, 0.069, 0.151],
      [x + 0.047, 0.038, 0.145],
      [x + 0.034, 0.007, 0.15],
      [x - 0.035, 0.007, 0.154],
      [x - 0.047, 0.037, 0.151],
    ] as V3[];
    stroke(k, 'gloss', '#201f24', rim, 0.0062);
    stroke(
      k,
      'gloss',
      '#77828a',
      [
        [x - 0.022, 0.056, 0.158],
        [x + 0.013, 0.059, 0.158],
      ],
      0.0021,
    );
    stroke(
      k,
      'gloss',
      '#201f24',
      [
        [side * 0.105, 0.062, 0.145],
        [side * 0.151, 0.058, 0.074],
        [side * 0.157, 0.02, -0.036],
      ],
      0.0085,
    );
  }
  stroke(
    k,
    'gloss',
    '#201f24',
    [
      [-0.02, 0.048, 0.158],
      [0, 0.056, 0.16],
      [0.02, 0.048, 0.158],
    ],
    0.006,
  );
}

function hair(k: Kit, colour: string, variant: number, covered: boolean) {
  const shade = tint(colour, '#170e0d', 0.12);
  const flip = variant % 2 === 1 ? -1 : 1;
  const scalp = (a: number, y: number, offset = 0) => {
    const r = atRing(headRings, y);
    const p = ringPoint(
      {
        ...r,
        w: r.w + 0.012 + offset,
        front: r.front + 0.009 + offset,
        back: r.back + 0.01 + offset,
      },
      a,
    );
    return [p.x, p.y, p.z] as V3;
  };
  const surface = (a: number, v: number) => {
    const forward = Math.max(0, Math.cos(a)),
      back = Math.max(0, -Math.cos(a));
    const edge = -0.011 + forward ** 2 * 0.12 - back * 0.048;
    const p = scalp(a, THREE.MathUtils.lerp(0.176, edge, v));
    // One continuous side-swept mass stays rooted across the full skull.
    if (!covered) {
      const height = variant === 2 ? 0.064 : variant === 4 ? 0.033 : 0.052;
      const wave = Math.sin(v * Math.PI) * forward ** 2;
      p[1] += wave * height * (1 + Math.sin(a) * flip * 0.22);
      p[2] += wave * 0.018;
      p[1] -= gaussian(p[0], p[2], flip * 0.044, 0.063, 0.007, 0.053) * 0.003;
    }
    return p;
  };
  k.add(
    'hair',
    colour,
    patch((u, v) => surface(u * Math.PI * 2, v), 48, 24, true),
    [0, 0, 0],
  );
  if (!covered)
    for (const angle of [-0.68, -0.35, 0.45])
      stroke(
        k,
        'hair',
        shade,
        [0.09, 0.23, 0.43, 0.68].map((v) => {
          const p = surface((angle + v * 0.14) * flip, v);
          p[1] += 0.0014;
          return p;
        }),
        0.0015,
      );
  // Grooves conform to the skull rather than floating beside the hair shell.
  for (const side of [-1, 1]) {
    k.add(
      'hair',
      colour,
      sweep(
        [
          [side * 0.118, 0.103, -0.038],
          [side * 0.148, 0.059, -0.054],
          [side * 0.145, -0.011, -0.061],
        ],
        [0.026, 0.019, 0.007],
        [0.017, 0.015, 0.005],
        24,
        20,
      ),
      [0, 0, 0],
    );
    stroke(
      k,
      'hair',
      shade,
      [
        scalp(side * 2.15, 0.112, 0.0013),
        scalp(side * 1.95, 0.051, 0.0013),
        scalp(side * 1.84, -0.017, 0.0013),
      ],
      0.002,
    );
  }
}

function brim(
  k: Kit,
  colour: string,
  rx: number,
  rz: number,
  y: number,
  cowboy = false,
) {
  k.add(
    'cloth',
    colour,
    patch(
      (u, v) => {
        const a = u * Math.PI * 2,
          width = 0.74 + v * 0.26;
        const x = Math.sin(a) * rx * width,
          z = Math.cos(a) * rz * width - 0.014;
        const turn = cowboy
          ? (Math.abs(Math.sin(a)) ** 4 * 0.034 -
              Math.max(0, Math.cos(a)) * 0.011) *
            v *
            v
          : 0.006 * v * v;
        return [x, y + turn + Math.sin(a * 2) * 0.002, z];
      },
      64,
      8,
      true,
    ),
    [0, 0, 0],
  );
  const edge: V3[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    edge.push([
      Math.sin(a) * rx,
      y +
        (cowboy
          ? Math.abs(Math.sin(a)) ** 4 * 0.034 -
            Math.max(0, Math.cos(a)) * 0.011
          : 0.006),
      Math.cos(a) * rz - 0.014,
    ]);
  }
  stroke(k, 'cloth', tint(colour, cream, 0.1), edge, cowboy ? 0.0038 : 0.003);
}

function hat(k: Kit, look: Look) {
  if (look.hat === 'none') return;
  const c = HAT_COLOURS[look.hat];
  if (look.hat === 'cap') {
    k.add(
      'cloth',
      c,
      loft([
        { y: 0.094, w: 0.164, front: 0.134, back: 0.144, z: -0.014 },
        { y: 0.13, w: 0.166, front: 0.147, back: 0.145, z: -0.014 },
        { y: 0.19, w: 0.142, front: 0.123, back: 0.122, z: -0.014 },
        { y: 0.232, w: 0.079, front: 0.067, back: 0.065, z: -0.014 },
        { y: 0.244, w: 0.003, front: 0.003, back: 0.003, z: -0.014 },
      ]),
      [0, 0, 0],
    );
    k.add(
      'cloth',
      tint(c, '#6f1c20', 0.09),
      patch(
        (u, v) => {
          const x = (u * 2 - 1) * (0.145 - v * 0.02);
          const bow = Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2));
          return [
            x,
            0.102 - v * 0.009 + (x / 0.145) ** 2 * 0.009,
            0.107 + bow * (0.036 + v * 0.092),
          ];
        },
        28,
        12,
        true,
      ),
      [0, 0, 0],
    );
    for (const side of [-1, 1])
      stroke(
        k,
        'cloth',
        tint(c, cream, 0.16),
        [
          [side * 0.126, 0.11, 0.098],
          [side * 0.097, 0.195, 0.076],
          [0, 0.246, -0.014],
        ],
        0.0025,
      );
    k.sphere('cloth', c, 0.009, [0, 0.247, -0.014], {
      seg: 12,
      scale: [1, 0.6, 1],
    });
  } else if (look.hat === 'bowler') {
    brim(k, c, 0.225, 0.19, 0.113);
    k.add(
      'cloth',
      c,
      loft([
        { y: 0.112, w: 0.167, front: 0.139, back: 0.147, z: -0.014 },
        { y: 0.149, w: 0.169, front: 0.141, back: 0.148, z: -0.014 },
        { y: 0.225, w: 0.161, front: 0.136, back: 0.139, z: -0.014 },
        { y: 0.28, w: 0.118, front: 0.101, back: 0.101, z: -0.014 },
        { y: 0.306, w: 0.051, front: 0.044, back: 0.044, z: -0.014 },
        { y: 0.31, w: 0.002, front: 0.002, back: 0.002, z: -0.014 },
      ]),
      [0, 0, 0],
    );
    k.add(
      'cloth',
      '#74323b',
      loft([
        { y: 0.133, w: 0.171, front: 0.144, back: 0.15, z: -0.014 },
        { y: 0.159, w: 0.171, front: 0.144, back: 0.15, z: -0.014 },
      ]),
      [0, 0, 0],
    );
    leaf(
      k,
      '#74323b',
      [
        [-0.161, 0.132],
        [-0.131, 0.143],
        [-0.158, 0.16],
      ],
      0.087,
    );
  } else if (look.hat === 'beanie') {
    k.add(
      'cloth',
      c,
      loft(
        [
          { y: 0.083, w: 0.163, front: 0.139, back: 0.151, z: -0.014 },
          { y: 0.125, w: 0.169, front: 0.143, back: 0.157, z: -0.014 },
          { y: 0.202, w: 0.145, front: 0.122, back: 0.135, z: -0.014 },
          { y: 0.253, w: 0.083, front: 0.069, back: 0.079, z: -0.014 },
          { y: 0.276, w: 0.005, front: 0.005, back: 0.005, z: -0.014 },
        ],
        (p, a) => {
          const rib = 1 + Math.cos(a * 22) * 0.006;
          p.x *= rib;
          p.z = (p.z + 0.014) * rib - 0.014;
        },
      ),
      [0, 0, 0],
    );
    k.add(
      'cloth',
      tint(c, cream, 0.08),
      loft(
        [
          { y: 0.079, w: 0.164, front: 0.14, back: 0.152, z: -0.014 },
          { y: 0.086, w: 0.172, front: 0.148, back: 0.16, z: -0.014 },
          { y: 0.123, w: 0.174, front: 0.15, back: 0.162, z: -0.014 },
          { y: 0.132, w: 0.168, front: 0.145, back: 0.157, z: -0.014 },
        ],
        (p, a) => {
          const rib = 1 + Math.cos(a * 28) * 0.009;
          p.x *= rib;
          p.z = (p.z + 0.014) * rib - 0.014;
        },
      ),
      [0, 0, 0],
    );
    // A soft knit pompom uses an authored lobe surface, never skin-like shine.
    k.add(
      'cloth',
      cream,
      loft(
        [
          { y: 0.263, w: 0.006, front: 0.006, back: 0.006 },
          { y: 0.278, w: 0.027, front: 0.027, back: 0.027 },
          { y: 0.302, w: 0.031, front: 0.031, back: 0.031 },
          { y: 0.325, w: 0.006, front: 0.006, back: 0.006 },
        ],
        (p, a) => {
          p.x *= 1 + 0.04 * Math.sin(a * 9 + p.y * 80);
        },
        32,
      ),
      [0, 0, -0.014],
    );
  } else {
    brim(k, c, 0.27, 0.235, 0.106, true);
    k.add(
      'cloth',
      c,
      loft(
        [
          {
            y: 0.108,
            w: 0.17,
            front: 0.136,
            back: 0.149,
            z: -0.015,
            power: 2.3,
          },
          {
            y: 0.147,
            w: 0.166,
            front: 0.134,
            back: 0.147,
            z: -0.015,
            power: 2.3,
          },
          {
            y: 0.229,
            w: 0.128,
            front: 0.106,
            back: 0.114,
            z: -0.015,
            power: 2.4,
          },
          {
            y: 0.281,
            w: 0.108,
            front: 0.083,
            back: 0.09,
            z: -0.015,
            power: 2.6,
          },
          {
            y: 0.292,
            w: 0.076,
            front: 0.053,
            back: 0.062,
            z: -0.015,
            power: 2.3,
          },
          { y: 0.295, w: 0.002, front: 0.002, back: 0.002, z: -0.015 },
        ],
        (p) => {
          if (p.y > 0.23) p.y -= Math.exp(-((p.x / 0.042) ** 2)) * 0.014;
        },
      ),
      [0, 0, 0],
    );
    k.add(
      'cloth',
      '#65422c',
      loft([
        {
          y: 0.127,
          w: 0.171,
          front: 0.139,
          back: 0.152,
          z: -0.015,
          power: 2.3,
        },
        {
          y: 0.155,
          w: 0.164,
          front: 0.135,
          back: 0.147,
          z: -0.015,
          power: 2.3,
        },
      ]),
      [0, 0, 0],
    );
  }
}

function paperCap(k: Kit, colour: string) {
  // Folded boat shape: tall sides, a shallow centre fold and pinched ends.
  const rings: Ring[] = [
    { y: 0.105, w: 0.16, front: 0.112, back: 0.123, z: -0.006, power: 3.5 },
    { y: 0.136, w: 0.166, front: 0.115, back: 0.124, z: -0.006, power: 3.5 },
    { y: 0.215, w: 0.151, front: 0.056, back: 0.063, z: -0.006, power: 3 },
    { y: 0.237, w: 0.109, front: 0.018, back: 0.021, z: -0.006, power: 2.6 },
    { y: 0.239, w: 0.09, front: 0.002, back: 0.003, z: -0.006, power: 2.5 },
  ];
  k.add(
    'cloth',
    cream,
    loft(
      rings,
      (p) => {
        if (p.y > 0.19) p.y -= Math.exp(-((p.x / 0.07) ** 2)) * 0.025;
      },
      HUMAN_SOURCE.radial,
      HUMAN_SOURCE.samples,
      'both',
      { radial: HUMAN_RUNTIME.radial, samples: HUMAN_SOURCE.samples },
    ),
    [0, 0, 0],
  );
  k.add(
    'cloth',
    colour,
    loft(
      [0.117, 0.13, 0.144].map((y) => {
        const r = atRing(rings, y);
        return {
          ...r,
          w: r.w + 0.003,
          front: r.front + 0.003,
          back: r.back + 0.003,
        };
      }),
    ),
    [0, 0, 0],
  );
  for (const side of [-1, 1])
    stroke(
      k,
      'cloth',
      '#d7cdbb',
      [
        [side * 0.155, 0.154],
        [side * 0.133, 0.205],
        [side * 0.07, 0.222],
      ].map(([x, y]) => {
        const r = atRing(rings, y);
        const power = r.power ?? 2;
        const z =
          (r.z ?? 0) +
          r.front *
            Math.max(0, 1 - (Math.abs(x) / r.w) ** power) ** (1 / power);
        const fold = y > 0.19 ? Math.exp(-((x / 0.07) ** 2)) * 0.025 : 0;
        return [x, y - fold, z + 0.0014] as V3;
      }),
      0.0018,
    );
}

export function sculptHead(k: Kit, look: Look, waiter: string | null) {
  const skin = SKINS[look.skin],
    hairColour = HAIRS[look.hair];
  // Public appearance gives distinct adults; there is no private role input.
  const face = look.hair % 5;
  const jaw = [1.05, 0.84, 1.21, 0.96, 1.12][face];
  const chin = [1.12, 0.94, 1.48, 1.02, 1.14][face];
  const cheek = [1.01, 1.055, 0.995, 0.97, 1.025][face];
  const drop = [0.001, -0.002, 0.004, 0.012, 0.001][face];
  k.add(
    'skin',
    skin,
    loft(
      headRings,
      (p, a) => {
        faceSculpt(p, a);
        const j = Math.exp(-(((p.y + 0.092) / 0.046) ** 2));
        const c = Math.exp(-(((p.y + 0.132) / 0.017) ** 2));
        const cheeks = Math.exp(-(((p.y + 0.021) / 0.053) ** 2));
        p.x *= 1 + (jaw - 1) * j + (chin - 1) * c + (cheek - 1) * cheeks;
        if (p.y < -0.076)
          p.y -= drop * THREE.MathUtils.smoothstep(-p.y, 0.076, 0.13);
        if (face === 2 && p.y < -0.081 && Math.cos(a) > 0) p.z += 0.0025 * j;
      },
      HUMAN_SOURCE.radial,
      HUMAN_SOURCE.samples,
      'both',
      {
        radial: 32,
        samples: 4,
      },
    ),
    [0, 0, 0],
  );
  warmSkin(k, skin);
  nose(k, skin, look.hair);
  ears(k, skin);
  eyes(k, skin, hairColour);
  hair(k, hairColour, look.hair, !!waiter || look.hat !== 'none');
  if (look.glasses) glasses(k);
  if (waiter) paperCap(k, waiter);
  else hat(k, look);
}

export type Expression = 'rest' | 'smile' | 'frown' | 'eat';
export function sculptMouth(k: Kit, skin: string, mood: Expression) {
  const lip = tint(skin, '#7d3d39', 0.38);
  const width = mood === 'eat' ? 0.012 : mood === 'smile' ? 0.036 : 0.028;
  const y = -0.069;
  if (mood === 'eat') {
    k.add(
      'paint',
      lip,
      patch(
        (u, v) => {
          const x = (u * 2 - 1) * width,
            edge = Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2));
          return [x, y + (v * 2 - 1) * 0.006 * edge, 0.121 - Math.abs(x) * 0.1];
        },
        16,
        8,
      ),
      [0, 0, 0],
    );
  } else {
    const bend = mood === 'smile' ? -0.012 : mood === 'frown' ? 0.007 : -0.0015;
    stroke(
      k,
      'paint',
      lip,
      [
        [-width, y, 0.113],
        [-width * 0.48, y + bend * 0.8, 0.122],
        [0, y + bend, 0.124],
        [width * 0.48, y + bend * 0.8, 0.122],
        [width, y, 0.113],
      ],
      mood === 'smile' ? 0.0032 : 0.0025,
    );
    if (mood === 'smile')
      stroke(
        k,
        'paint',
        cream,
        [
          [-0.025, y - 0.003, 0.122],
          [0, y - 0.007, 0.128],
          [0.025, y - 0.003, 0.122],
        ],
        0.0022,
      );
    else
      stroke(
        k,
        'paint',
        tint(skin, cream, 0.075),
        [
          [-0.017, y - 0.008, 0.118],
          [0, y - 0.01, 0.125],
          [0.017, y - 0.008, 0.118],
        ],
        0.0018,
      );
  }
}

export function sculptLids(k: Kit, skin: string) {
  for (const side of [-1, 1]) {
    eyePatch(k, 'skin', skin, side * 0.057, 0.028, 0.012, 0.14);
    stroke(
      k,
      'skin',
      tint(skin, '#6d4034', 0.14),
      [
        [side * 0.057 - 0.025, 0.036, 0.141],
        [side * 0.057, 0.035, 0.146],
        [side * 0.057 + 0.025, 0.036, 0.141],
      ],
      0.0017,
    );
  }
}

const torsoRings: Ring[] = [
  { y: 0.522, w: 0.17, front: 0.121, back: 0.118, power: 2.6 },
  { y: 0.546, w: 0.17, front: 0.12, back: 0.12, power: 2.6 },
  { y: 0.594, w: 0.165, front: 0.119, back: 0.113, power: 2.6 },
  { y: 0.674, w: 0.17, front: 0.133, back: 0.114, power: 2.5 },
  { y: 0.774, w: 0.193, front: 0.14, back: 0.119, power: 2.5 },
  { y: 0.85, w: 0.215, front: 0.139, back: 0.122, power: 2.5 },
  { y: 0.919, w: 0.214, front: 0.114, back: 0.111, power: 2.5 },
  { y: 0.951, w: 0.13, front: 0.083, back: 0.076, power: 2.3 },
  { y: 0.968, w: 0.067, front: 0.057, back: 0.05, power: 2 },
];
function clothSculpt(p: THREE.Vector3, angle: number) {
  const front = Math.max(0, Math.cos(angle)) ** 2;
  p.z +=
    front *
    (Math.sin(p.y * 50 + Math.abs(p.x) * 21) * 0.0018 +
      gaussian(Math.abs(p.x), p.y, 0.13, 0.62, 0.07, 0.028) * 0.004);
}
function shirtFront(x: number, y: number) {
  const r = atRing(torsoRings, y);
  const shape = Math.max(0, 1 - (Math.abs(x) / r.w) ** (r.power ?? 2));
  return r.front * shape ** (1 / (r.power ?? 2)) + 0.008;
}

export function sculptTorso(
  k: Kit,
  colour: string,
  skin: string,
  trousers: string,
  stripes: boolean,
  apron: string | null,
) {
  // Hips transition under the shirt hem and into the two trouser thighs.
  k.add(
    'cloth',
    trousers,
    loft([
      { y: 0.464, w: 0.041, front: 0.054, back: 0.055, power: 2.4 },
      { y: 0.495, w: 0.109, front: 0.082, back: 0.083, power: 2.6 },
      { y: 0.552, w: 0.156, front: 0.105, back: 0.103, power: 2.7 },
      { y: 0.607, w: 0.151, front: 0.108, back: 0.102, power: 2.6 },
      { y: 0.623, w: 0.14, front: 0.099, back: 0.093, power: 2.6 },
    ]),
    [0, 0, 0],
  );
  k.add('cloth', colour, loft(torsoRings, clothSculpt), [0, 0, 0]);
  k.add(
    'skin',
    skin,
    loft(
      [
        { y: 0.922, w: 0.062, front: 0.047, back: 0.052, z: -0.01 },
        { y: 0.951, w: 0.057, front: 0.045, back: 0.05, z: -0.009 },
        { y: 0.985, w: 0.052, front: 0.044, back: 0.046, z: -0.004 },
        { y: 1.011, w: 0.066, front: 0.049, back: 0.05, z: 0.006 },
      ],
      undefined,
      32,
    ),
    [0, 0, 0],
  );
  if (stripes) {
    const l = new THREE.Color(colour).getHSL({ h: 0, s: 0, l: 0 }).l;
    const stripe = l > 0.45 ? '#342e35' : cream;
    for (const y of [0.646, 0.74, 0.831]) {
      const rings = [
        atRing(torsoRings, y - 0.015),
        atRing(torsoRings, y),
        atRing(torsoRings, y + 0.015),
      ].map((r) => ({
        ...r,
        w: r.w + 0.0012,
        front: r.front + 0.0012,
        back: r.back + 0.0012,
      }));
      k.add('cloth', stripe, loft(rings, clothSculpt), [0, 0, 0]);
    }
  }
  const edging = tint(colour, cream, 0.22);
  for (const side of [-1, 1]) {
    leaf(
      k,
      apron ? cream : edging,
      [
        [side * 0.101, 0.932],
        [side * 0.058, 0.963],
        [side * 0.014, 0.934],
        [side * 0.053, 0.873],
        [side * 0.093, 0.909],
      ],
      0.099,
    );
    stroke(
      k,
      'cloth',
      tint(colour, '#37343e', 0.13),
      [
        [side * 0.145, 0.542, 0.065],
        [side * 0.152, 0.65, 0.079],
        [side * 0.186, 0.833, 0.067],
        [side * 0.205, 0.901, 0.071],
      ],
      0.0018,
    );
  }
  stroke(
    k,
    'cloth',
    tint(colour, '#37343e', 0.12),
    [-0.147, -0.095, 0, 0.095, 0.147].map(
      (x) => [x, 0.533, shirtFront(x, 0.533) - 0.004] as V3,
    ),
    0.002,
  );
  if (!apron) {
    stroke(
      k,
      'cloth',
      edging,
      [0.874, 0.81, 0.722, 0.65, 0.556].map(
        (y) => [0, y, shirtFront(0, y) - 0.003] as V3,
      ),
      0.002,
    );
    for (const y of [0.857, 0.779, 0.694, 0.604])
      k.sphere(
        'cloth',
        tint(colour, '#14171b', 0.25),
        0.004,
        [0, y, shirtFront(0, y) + 0.002],
        { seg: 8, scale: [1, 1, 0.4] },
      );
    return;
  }
  // A curved apron drapes against the body; the hem, bib and pocket are panels.
  k.add(
    'cloth',
    apron,
    patch(
      (u, v) => {
        const y = 0.483 + v * 0.252,
          width = 0.15 - v * 0.02,
          x = (u * 2 - 1) * width;
        return [
          x,
          y + (1 - v) * 0.003 * Math.cos(u * Math.PI * 4),
          shirtFront(x, Math.max(0.523, y)) +
            0.004 +
            Math.sin(u * Math.PI * 4) * (1 - v) * 0.002,
        ];
      },
      24,
      24,
    ),
    [0, 0, 0],
  );
  k.add(
    'cloth',
    apron,
    patch(
      (u, v) => {
        const y = 0.709 + v * 0.159,
          x = (u * 2 - 1) * (0.113 - v * 0.022);
        return [x, y, shirtFront(x, y) + 0.005];
      },
      24,
      20,
    ),
    [0, 0, 0],
  );
  const seam = tint(apron, cream, 0.22);
  stroke(
    k,
    'cloth',
    seam,
    [-0.147, -0.1, -0.05, 0, 0.05, 0.1, 0.147].map(
      (x) => [x, 0.486, shirtFront(x, 0.523) + 0.007] as V3,
    ),
    0.002,
  );
  for (const side of [-1, 1])
    stroke(
      k,
      'cloth',
      apron,
      [
        [side * 0.087, 0.862, 0.147],
        [side * 0.104, 0.92, 0.116],
        [side * 0.096, 0.949, 0.082],
        [side * 0.083, 0.93, -0.075],
      ],
      0.01,
    );
  k.add(
    'cloth',
    tint(apron, '#354248', 0.055),
    patch(
      (u, v) => {
        const x = 0.011 + u * 0.103,
          y = 0.56 + v * 0.075;
        return [x, y, shirtFront(x, y) + 0.013];
      },
      16,
      12,
    ),
    [0, 0, 0],
  );
  stroke(
    k,
    'cloth',
    seam,
    [0.014, 0.062, 0.111].map(
      (x) => [x, 0.632, shirtFront(x, 0.632) + 0.015] as V3,
    ),
    0.0018,
  );
  // Waist band wraps behind the apron; a small tied bow reads in the rear view.
  const waist = [atRing(torsoRings, 0.694), atRing(torsoRings, 0.716)].map(
    (r) => ({
      ...r,
      w: r.w + 0.009,
      front: r.front + 0.009,
      back: r.back + 0.006,
    }),
  );
  k.add('cloth', apron, loft(waist), [0, 0, 0]);
  stroke(
    k,
    'cloth',
    apron,
    [
      [0, 0.705, -0.125],
      [-0.038, 0.711, -0.135],
      [-0.029, 0.729, -0.133],
      [0, 0.705, -0.125],
      [0.039, 0.714, -0.135],
      [0.028, 0.73, -0.132],
      [0, 0.705, -0.125],
    ],
    0.006,
    true,
  );
  stroke(
    k,
    'cloth',
    apron,
    [
      [-0.009, 0.708, -0.129],
      [-0.019, 0.654, -0.129],
    ],
    0.007,
  );
  stroke(
    k,
    'cloth',
    apron,
    [
      [0.009, 0.708, -0.13],
      [0.023, 0.658, -0.129],
    ],
    0.007,
  );
  leaf(
    k,
    apron,
    [
      [-0.004, 0.92],
      [-0.047, 0.942],
      [-0.05, 0.914],
      [-0.018, 0.903],
    ],
    0.117,
  );
  leaf(
    k,
    apron,
    [
      [0.004, 0.92],
      [0.047, 0.942],
      [0.05, 0.914],
      [0.018, 0.903],
    ],
    0.117,
  );
  k.add(
    'cloth',
    tint(apron, '#33333a', 0.08),
    loft(
      [
        { y: 0.908, w: 0.008, front: 0.007, back: 0.007 },
        { y: 0.931, w: 0.009, front: 0.008, back: 0.008 },
      ],
      undefined,
      16,
    ),
    [0, 0, 0.124],
  );
}

export function sculptUpperArm(
  k: Kit,
  colour: string,
  stripes: boolean,
  side: number,
) {
  const rings: Ring[] = [
    { y: -0.183, w: 0.049, front: 0.047, back: 0.05, power: 2.3 },
    { y: -0.154, w: 0.051, front: 0.05, back: 0.054, power: 2.3 },
    { y: -0.096, w: 0.062, front: 0.055, back: 0.061, power: 2.2 },
    {
      y: -0.04,
      w: 0.067,
      front: 0.059,
      back: 0.064,
      x: -side * 0.003,
      power: 2.2,
    },
    { y: 0.004, w: 0.059, front: 0.054, back: 0.059, x: -side * 0.017 },
    { y: 0.027, w: 0.03, front: 0.025, back: 0.027, x: -side * 0.044 },
    { y: 0.031, w: 0.002, front: 0.002, back: 0.002, x: -side * 0.045 },
  ];
  k.add(
    'cloth',
    colour,
    loft(
      rings,
      (p) => {
        p.z += Math.cos(p.y * 68) * 0.0018;
      },
      32,
      HUMAN_SOURCE.samples,
      'none',
    ),
    [0, 0, 0],
  );
  k.add(
    'cloth',
    tint(colour, cream, 0.16),
    loft(
      [
        { ...rings[0], y: -0.184, w: 0.051, front: 0.049, back: 0.052 },
        { ...rings[0], y: -0.164, w: 0.053, front: 0.051, back: 0.055 },
      ],
      undefined,
      32,
      HUMAN_SOURCE.samples,
      'none',
    ),
    [0, 0, 0],
  );
  if (stripes) {
    const l = new THREE.Color(colour).getHSL({ h: 0, s: 0, l: 0 }).l;
    for (const y of [-0.091, -0.17]) {
      const band = [atRing(rings, y - 0.014), atRing(rings, y + 0.014)].map(
        (r) => ({
          ...r,
          w: r.w + 0.001,
          front: r.front + 0.002,
          back: r.back + 0.002,
        }),
      );
      k.add(
        'cloth',
        l > 0.45 ? '#342e35' : cream,
        loft(band, undefined, 32, HUMAN_SOURCE.samples, 'none'),
        [0, 0, 0],
      );
    }
  }
}

export function sculptForearm(k: Kit, skin: string, side: number) {
  k.add(
    'skin',
    skin,
    loft(
      [
        {
          y: -HUMAN.forearm,
          w: 0.03,
          front: 0.027,
          back: 0.027,
          z: 0.006,
          power: 2.3,
        },
        { y: -0.166, w: 0.033, front: 0.031, back: 0.03, z: 0.003, power: 2.3 },
        { y: -0.11, w: 0.044, front: 0.034, back: 0.041, z: 0, power: 2.2 },
        { y: -0.044, w: 0.049, front: 0.039, back: 0.042, z: -0.002 },
        { y: 0.004, w: 0.045, front: 0.038, back: 0.041, z: 0.001 },
        { y: 0.032, w: 0.044, front: 0.037, back: 0.039, z: 0.001 },
        { y: 0.063, w: 0.042, front: 0.038, back: 0.041, z: 0.001 },
        { y: 0.098, w: 0.042, front: 0.037, back: 0.042, z: 0.001 },
      ],
      undefined,
      32,
      HUMAN_SOURCE.samples,
      'both',
      { radial: 16, samples: HUMAN_SOURCE.samples },
    ),
    [0, 0, 0],
  );
  // Subtle elbow landmarks keep an arm shaped, with overlap inside the sleeve.
  stroke(
    k,
    'skin',
    tint(skin, '#80523f', 0.1),
    [
      [-0.02, -0.008, 0.038],
      [0, -0.012, 0.042],
      [0.02, -0.008, 0.038],
    ],
    0.0015,
  );
  stroke(
    k,
    'skin',
    tint(skin, cream, 0.035),
    [
      [side * 0.021, -0.052, 0.035],
      [side * 0.014, -0.134, 0.031],
    ],
    0.0014,
  );
}

export function sculptHand(k: Kit, skin: string, side: number) {
  k.add(
    'skin',
    skin,
    loft(
      [
        { y: -0.058, w: 0.024, front: 0.016, back: 0.017, power: 2.8 },
        { y: -0.045, w: 0.033, front: 0.023, back: 0.021, power: 2.8 },
        { y: -0.018, w: 0.03, front: 0.024, back: 0.022, power: 2.5 },
        { y: 0.008, w: 0.028, front: 0.026, back: 0.025, power: 2.3 },
      ],
      undefined,
      28,
    ),
    [0, 0, 0.006],
  );
  for (let i = 0; i < 4; i++) {
    const x = (-0.023 + i * 0.015) * side,
      length = i === 0 || i === 3 ? 0.04 : 0.047;
    k.add(
      'skin',
      skin,
      sweep(
        [
          [x, -0.043, 0.009],
          [x, -0.066, 0.015],
          [x + side * 0.002, -0.048 - length, 0.025],
        ],
        [0.008, 0.0078, 0.0073],
        [0.01, 0.009, 0.0078],
        18,
        12,
        0.18,
      ),
      [0, 0, 0],
    );
    stroke(
      k,
      'skin',
      tint(skin, '#80523f', 0.12),
      [
        [x - 0.004, -0.065, 0.023],
        [x + 0.004, -0.065, 0.023],
      ],
      0.0011,
    );
  }
  k.add(
    'skin',
    skin,
    sweep(
      [
        [-side * 0.024, -0.018, 0.008],
        [-side * 0.042, -0.034, 0.025],
        [-side * 0.037, -0.056, 0.029],
      ],
      [0.011, 0.01, 0.008],
      [0.013, 0.012, 0.009],
      22,
      14,
      0.19,
    ),
    [0, 0, 0],
  );
}

export function sculptThigh(k: Kit, colour: string) {
  k.add(
    'cloth',
    colour,
    loft(
      [
        {
          y: -HUMAN.thigh - 0.019,
          w: 0.056,
          front: 0.057,
          back: 0.058,
          power: 2.5,
        },
        { y: -0.247, w: 0.062, front: 0.064, back: 0.063, power: 2.5 },
        { y: -0.177, w: 0.071, front: 0.074, back: 0.074, power: 2.5 },
        { y: -0.087, w: 0.081, front: 0.088, back: 0.081, power: 2.4 },
        { y: -0.007, w: 0.086, front: 0.096, back: 0.088, power: 2.4 },
        { y: 0.035, w: 0.072, front: 0.079, back: 0.076, power: 2.4 },
      ],
      (p, a) => {
        if (Math.cos(a) > 0) p.z += Math.cos(p.y * 74) * 0.0013;
      },
      32,
    ),
    [0, 0, 0],
  );
  stroke(
    k,
    'cloth',
    tint(colour, cream, 0.08),
    [
      [0, -0.036, 0.097],
      [0, -0.147, 0.081],
      [0, -0.253, 0.066],
    ],
    0.0016,
  );
}

/** Continuous trouser topology; weights bend this cloth across the real knee. */
export function sculptLeg(k: Kit, colour: string, side: number) {
  const rings: Ring[] = [
    { y: -0.519, w: 0.051, front: 0.046, back: 0.047, power: 2.5 },
    { y: -0.48, w: 0.052, front: 0.047, back: 0.05, power: 2.5 },
    { y: -0.413, w: 0.056, front: 0.052, back: 0.054, power: 2.5 },
    { y: -0.351, w: 0.058, front: 0.054, back: 0.056, power: 2.5 },
    { y: -0.309, w: 0.058, front: 0.057, back: 0.056, power: 2.4 },
    { y: -0.275, w: 0.059, front: 0.063, back: 0.058, power: 2.4 },
    { y: -0.24, w: 0.063, front: 0.065, back: 0.065, power: 2.5 },
    { y: -0.177, w: 0.071, front: 0.074, back: 0.074, power: 2.5 },
    { y: -0.087, w: 0.071, front: 0.078, back: 0.073, power: 2.4 },
    { y: -0.007, w: 0.07, front: 0.079, back: 0.079, power: 2.4 },
    { y: 0.035, w: 0.058, front: 0.065, back: 0.063, power: 2.4 },
  ];
  const at: V3 = [side * 0.083, HUMAN.hip, 0];
  k.add(
    'cloth',
    colour,
    loft(
      rings,
      (p, a) => {
        const knee = Math.exp(-(((p.y + HUMAN.thigh) / 0.054) ** 2));
        if (Math.cos(a) > 0)
          p.z +=
            Math.sin(p.y * 78 + Math.abs(p.x) * 16) * 0.0018 * (0.4 + knee);
      },
      40,
      HUMAN_SOURCE.samples,
      'both',
      { radial: 20, samples: HUMAN_SOURCE.samples },
    ),
    at,
  );
  const cuff = [atRing(rings, -0.519), atRing(rings, -0.499)].map((r) => ({
    ...r,
    w: r.w + 0.0015,
    front: r.front + 0.0015,
    back: r.back + 0.0015,
  }));
  k.add('cloth', tint(colour, '#221d24', 0.08), loft(cuff, undefined, 40), at);
  const crease = [-0.036, -0.177, -0.275, -0.413, -0.497].map(
    (y) => [at[0], y + at[1], atRing(rings, y).front + 0.0025] as V3,
  );
  stroke(k, 'cloth', tint(colour, cream, 0.075), crease, 0.0015);
}

export function sculptShin(k: Kit, colour: string) {
  k.add(
    'cloth',
    colour,
    loft(
      [
        {
          y: -HUMAN.shin - 0.013,
          w: 0.051,
          front: 0.046,
          back: 0.047,
          power: 2.5,
        },
        { y: -0.197, w: 0.052, front: 0.047, back: 0.049, power: 2.5 },
        { y: -0.134, w: 0.057, front: 0.054, back: 0.054, power: 2.5 },
        { y: -0.062, w: 0.058, front: 0.056, back: 0.058, power: 2.4 },
        { y: 0.006, w: 0.055, front: 0.056, back: 0.056, power: 2.4 },
        { y: 0.026, w: 0.052, front: 0.052, back: 0.054, power: 2.4 },
      ],
      (p, a) => {
        if (Math.cos(a) > 0)
          p.z +=
            Math.sin(p.y * 88) *
            0.0015 *
            Math.exp(-(((p.y + 0.03) / 0.05) ** 2));
      },
      32,
    ),
    [0, 0, 0],
  );
  k.add(
    'cloth',
    tint(colour, '#221d24', 0.08),
    loft(
      [
        { y: -0.232, w: 0.053, front: 0.049, back: 0.051, power: 2.6 },
        { y: -0.214, w: 0.054, front: 0.049, back: 0.051, power: 2.6 },
      ],
      undefined,
      32,
    ),
    [0, 0, 0],
  );
  stroke(
    k,
    'cloth',
    tint(colour, cream, 0.075),
    [
      [0, -0.035, 0.059],
      [0, -0.127, 0.057],
      [0, -0.212, 0.05],
    ],
    0.0015,
  );
}

export function sculptShoe(k: Kit, waiter: boolean) {
  const colour = waiter ? '#2b2528' : '#423329';
  // Cross sections follow the toe, vamp, ankle and heel, not a rounded box.
  const g = loft(
    [
      { y: -0.083, w: 0.061, front: 0.126, back: 0.06, z: 0.003, power: 3.4 },
      { y: -0.075, w: 0.064, front: 0.131, back: 0.064, z: 0.003, power: 3.4 },
      { y: -0.057, w: 0.059, front: 0.126, back: 0.061, z: 0.002, power: 3 },
      { y: -0.035, w: 0.052, front: 0.103, back: 0.057, power: 2.6 },
      { y: -0.012, w: 0.046, front: 0.067, back: 0.05, power: 2.3 },
      { y: 0.014, w: 0.041, front: 0.038, back: 0.044, power: 2.4 },
      { y: 0.026, w: 0.034, front: 0.032, back: 0.035, power: 2.4 },
    ],
    undefined,
    40,
  );
  k.add('gloss', colour, g, [0, 0, 0]);
  k.add(
    'gloss',
    '#1f2025',
    loft(
      [
        {
          y: -0.085,
          w: 0.064,
          front: 0.133,
          back: 0.065,
          z: 0.003,
          power: 3.4,
        },
        {
          y: -0.077,
          w: 0.064,
          front: 0.133,
          back: 0.065,
          z: 0.003,
          power: 3.4,
        },
      ],
      undefined,
      40,
    ),
    [0, 0, 0],
  );
  stroke(
    k,
    'gloss',
    tint(colour, '#bca28a', 0.13),
    [
      [-0.043, -0.045, 0.085],
      [0, -0.035, 0.108],
      [0.043, -0.045, 0.085],
    ],
    0.0019,
  );
  for (const y of [-0.02, -0.03, -0.04])
    stroke(
      k,
      'gloss',
      '#a99785',
      [
        [-0.017, y, 0.066 - (y + 0.02) * 1.5],
        [0.017, y, 0.066 - (y + 0.02) * 1.5],
      ],
      0.0016,
    );
}
