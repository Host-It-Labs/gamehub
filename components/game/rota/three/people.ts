import * as THREE from 'three';
import type {
  NeighbourhoodPlan,
  WalkRoute,
} from '@/lib/games/rota/neighbourhood';
import { qualityLevels, type QualityTier } from '@/lib/games/rota/quality';
import {
  PEOPLE_MAX,
  PEOPLE_PRESENTATION_SCALE,
  makeResident,
  stepResident,
  residentSeed,
  heightOnRoute,
  type Resident,
  type CrossingClearance,
} from '@/lib/games/rota/people';
import { toon } from './materials';

/** Source brief: docs/concepts/2026-10-08-rota-town-life/brief.md.
 *
 * Source residents are 1.7–1.85 m; pass 2 draws their complete anatomy at
 * the user's requested 1.3× scale for the fixed cameras. Coats are shaped
 * from hem/waist/ribcage/shoulder profiles, heads have jaw and brow planes,
 * caps have fitted crowns and projecting peaks. All authored parts remain
 * editable here; the runtime shares those parts in a small set of batches.
 * Silhouette/motion review is deliberately deferred to Claude by the user.
 * Coordinates below are adult reference dimensions in 25 m squares; +z is
 * the front, +y up, the resident's ground-contact point is the origin. */

type Profile = readonly [y: number, width: number, depth: number, z?: number];

export function paint(g: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex);
  const data = new Float32Array(g.getAttribute('position').count * 3);
  for (let i = 0; i < data.length; i += 3) {
    data[i] = c.r;
    data[i + 1] = c.g;
    data[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return g;
}

/** Elliptical cloth/anatomical sections; authored longitudinal profiles give
 * shoulders, fitted waists, jaw, ankle and shoe vamp their own silhouettes. */
export function profile(rows: readonly Profile[], sides = 10, hex = '#ffffff') {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const row of rows) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      positions.push(
        Math.cos(a) * row[1],
        row[0],
        Math.sin(a) * row[2] + (row[3] ?? 0),
      );
    }
  }
  for (let k = 0; k < rows.length - 1; k++) {
    for (let j = 0; j < sides; j++) {
      const a = k * sides + j,
        b = k * sides + ((j + 1) % sides),
        c = a + sides,
        d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
  }
  const first = rows[0],
    last = rows[rows.length - 1];
  const lo = positions.length / 3;
  positions.push(0, first[0], first[3] ?? 0, 0, last[0], last[3] ?? 0);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(
      lo,
      i,
      j,
      lo + 1,
      (rows.length - 1) * sides + j,
      (rows.length - 1) * sides + i,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return paint(g, hex);
}

export function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  hex: string,
) {
  return paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
}

function triangle(points: readonly number[], hex: string) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return paint(g, hex);
}

/** Merge authored subparts once. No hierarchy per resident and no clone per
 * frame; vertex colours retain skin/cloth/metal separation inside batches. */
export function merge(parts: THREE.BufferGeometry[]) {
  let count = 0;
  const plain = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of plain) count += g.getAttribute('position').count;
  const pos = new Float32Array(count * 3),
    normals = new Float32Array(count * 3),
    colours = new Float32Array(count * 3);
  const hasScarf = plain.some((g) => !!g.getAttribute('aScarf'));
  const scarf = hasScarf ? new Float32Array(count) : null;
  let at = 0;
  for (const g of plain) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    pos.set(p.array, at);
    normals.set((g.getAttribute('normal') as THREE.BufferAttribute).array, at);
    colours.set((g.getAttribute('color') as THREE.BufferAttribute).array, at);
    const mask = g.getAttribute('aScarf') as THREE.BufferAttribute | undefined;
    if (scarf && mask) scarf.set(mask.array, at / 3);
    at += p.count * 3;
    g.dispose();
  }
  for (const g of parts) if (g.index) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  if (scarf) out.setAttribute('aScarf', new THREE.BufferAttribute(scarf, 1));
  out.computeBoundingSphere();
  return out;
}

function scarfPart(g: THREE.BufferGeometry) {
  const values = new Float32Array(g.getAttribute('position').count).fill(1);
  g.setAttribute('aScarf', new THREE.BufferAttribute(values, 1));
  return g;
}

export function coat(style: number) {
  const female = style === 1,
    child = style === 2;
  const g = profile(
    [
      [child ? 0.034 : female ? 0.022 : 0.027, female ? 0.009 : 0.0081, 0.0039],
      [0.037, 0.0065, 0.0036],
      [0.045, 0.007, 0.0039],
      [0.051, female ? 0.0077 : 0.0087, 0.0042],
      [0.054, female ? 0.0067 : 0.0074, 0.0038],
      [0.057, 0.0036, 0.0025],
    ],
    12,
  );
  return merge([
    g,
    // Overlapping, folded lapels rather than painted lines on a cylinder.
    triangle(
      [-0.004, 0.055, 0.0034, -0.0011, 0.048, 0.0045, -0.0004, 0.0558, 0.0038],
      '#b9b9b9',
    ),
    triangle(
      [0.0004, 0.0558, 0.0038, 0.0011, 0.048, 0.0045, 0.004, 0.055, 0.0034],
      '#d7d7d7',
    ),
    box(0.0011, 0.0006, 0.0003, 0.0008, 0.045, 0.0041, '#a6a49d'),
    box(0.0011, 0.0006, 0.0003, 0.0008, 0.0415, 0.0039, '#a6a49d'),
    // A recessed front opening and hem vent carry the long wool silhouette.
    box(
      0.0004,
      child ? 0.009 : 0.015,
      0.0003,
      0,
      child ? 0.04 : 0.035,
      0.0039,
      '#8b8b8b',
    ),
  ]);
}

export function head(style: number) {
  const skin = '#d4b79d',
    hair = '#50433b';
  const parts = [
    profile(
      [
        [0.056, 0.0017, 0.0016],
        [0.0598, 0.0018, 0.0017],
      ],
      8,
      skin,
    ),
    profile(
      [
        [0.06, 0.0022, 0.0026, 0.0003],
        [0.062, 0.003, 0.0031, 0.0004],
        [0.065, 0.0035, 0.0031],
        [0.0678, 0.0031, 0.003, -0.0002],
        [0.069, 0.0018, 0.0022, -0.0003],
      ],
      12,
      skin,
    ),
    // The face is a brow/jaw plane with a tiny wedge nose, not a round bead.
    triangle(
      [-0.0007, 0.065, 0.003, 0, 0.0634, 0.0041, 0.0007, 0.065, 0.003],
      '#bd967d',
    ),
    box(0.0015, 0.00035, 0.0003, -0.00165, 0.0652, 0.0029, hair),
    box(0.0015, 0.00035, 0.0003, 0.00165, 0.0652, 0.0029, hair),
  ];
  if (style === 1) {
    // The headscarf follows the skull, gathers below the jaw and trails at
    // the nape. Its pale crown remains identifiable from the phone camera.
    parts.push(
      scarfPart(
        profile(
          [
            [0.063, 0.0039, 0.0035, -0.0009],
            [0.068, 0.0038, 0.0034, -0.0007],
            [0.0706, 0.002, 0.0023, -0.0005],
          ],
          12,
          '#ffffff',
        ),
      ),
      scarfPart(
        triangle(
          [
            -0.0039, 0.063, -0.001, -0.002, 0.057, 0.0025, -0.0005, 0.06,
            0.0035,
          ],
          '#ffffff',
        ),
      ),
      scarfPart(
        triangle(
          [0.0005, 0.06, 0.0035, 0.002, 0.057, 0.0025, 0.0039, 0.063, -0.001],
          '#e6e6e6',
        ),
      ),
      scarfPart(box(0.0014, 0.0012, 0.0012, 0, 0.0597, 0.0037, '#cccccc')),
    );
  } else {
    // A low wool crown tipped forwards and a flattened peak. The child's
    // knitted cap is smaller and rounder; neither enlarges the head.
    parts.push(
      profile(
        style === 2
          ? [
              [0.0666, 0.0035, 0.0033],
              [0.0693, 0.0033, 0.003],
              [0.071, 0.0012, 0.0018],
            ]
          : [
              [0.0675, 0.0038, 0.0036],
              [0.0698, 0.004, 0.0035, -0.0005],
              [0.0713, 0.0027, 0.0027, -0.0006],
            ],
        12,
        style === 2 ? '#9a7758' : '#999b8e',
      ),
      profile(
        [
          [0.0672, 0.003, 0.0028, 0.002],
          [0.0678, 0.0032, 0.0028, 0.0022],
        ],
        12,
        style === 2 ? '#806344' : '#767b73',
      ),
    );
  }
  return merge(parts);
}

/** A shaft runs along +y from joint to joint; radius scales are separate
 * from length so animated knees/elbows never become expanding capsules. */
export function sleeve(lower: boolean) {
  return profile(
    lower
      ? [
          [0, 0.78, 0.76],
          [0.25, 0.83, 0.74],
          [0.8, 0.64, 0.65],
          [1, 0.59, 0.6],
        ]
      : [
          [0, 0.97, 0.92],
          [0.22, 1, 0.95],
          [0.7, 0.86, 0.82],
          [1, 0.75, 0.76],
        ],
    8,
  );
}

export function trouser(lower: boolean) {
  return profile(
    lower
      ? [
          [0, 0.82, 0.82],
          [0.28, 0.92, 0.9],
          [0.75, 0.65, 0.65],
          [1, 0.61, 0.65],
        ]
      : [
          [0, 0.99, 0.9],
          [0.27, 1.02, 0.91],
          [0.8, 0.84, 0.84],
          [1, 0.8, 0.8],
        ],
    8,
  );
}

export function shoe() {
  return merge([
    profile(
      [
        [0, 0.00235, 0.0048, 0.0013],
        [0.0015, 0.00235, 0.0049, 0.0013],
        [0.003, 0.0021, 0.0041, 0.0007],
        [0.004, 0.0017, 0.0026, -0.0003],
      ],
      10,
      '#3e3832',
    ),
    box(0.0038, 0.0015, 0.0032, 0, 0.0009, -0.0016, '#2e2a28'),
  ]);
}

export function hand() {
  return profile(
    [
      [0, 0.00125, 0.001],
      [0.0015, 0.0014, 0.0012],
      [0.0033, 0.001, 0.0009],
    ],
    8,
    '#d4b79d',
  );
}

export function rod(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  radius: number,
  hex: string,
) {
  const a = new THREE.Vector3(x1, y1, z1),
    b = new THREE.Vector3(x2, y2, z2),
    delta = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(radius, radius, delta.length(), 6);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
  g.applyQuaternion(q).translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  return paint(g, hex);
}

function pram() {
  const parts = [
    // Deep coach-built body: sides flare gently from the sprung chassis.
    profile(
      [
        [0.012, 0.0095, 0.017, 0.044],
        [0.022, 0.0116, 0.019, 0.044],
        [0.024, 0.0118, 0.019, 0.044],
      ],
      12,
      '#414b4c',
    ),
    box(0.021, 0.0015, 0.034, 0, 0.024, 0.044, '#c3b99f'),
    box(0.0185, 0.001, 0.015, 0, 0.0252, 0.052, '#d8ccb4'),
    // Arched hood with open front, stout side cheeks and a narrow fabric rim.
    profile(
      [
        [0.024, 0.0118, 0.0092, 0.035],
        [0.031, 0.0107, 0.009, 0.034],
        [0.0365, 0.0068, 0.008, 0.033],
        [0.0388, 0.0025, 0.006, 0.032],
      ],
      12,
      '#374345',
    ),
    box(0.018, 0.01, 0.0008, 0, 0.0295, 0.0432, '#292e2e'),
    rod(-0.009, 0.022, 0.027, -0.009, 0.036, 0.013, 0.00065, '#9b9e93'),
    rod(0.009, 0.022, 0.027, 0.009, 0.036, 0.013, 0.00065, '#9b9e93'),
    // Pusher wrists below meet the ends of this very handle, in local space.
    rod(-0.01, 0.036, 0.013, 0.01, 0.036, 0.013, 0.0009, '#605746'),
    rod(-0.012, 0.006, 0.029, 0.012, 0.006, 0.029, 0.0008, '#9da092'),
    rod(-0.012, 0.006, 0.059, 0.012, 0.006, 0.059, 0.0008, '#9da092'),
    rod(-0.009, 0.006, 0.029, -0.009, 0.014, 0.052, 0.0007, '#9da092'),
    rod(0.009, 0.006, 0.029, 0.009, 0.014, 0.052, 0.0007, '#9da092'),
    rod(-0.009, 0.006, 0.059, -0.009, 0.014, 0.035, 0.0007, '#9da092'),
    rod(0.009, 0.006, 0.059, 0.009, 0.014, 0.035, 0.0007, '#9da092'),
  ];
  return merge(parts);
}

function wheel() {
  const tyre = paint(
    new THREE.CylinderGeometry(0.0057, 0.0057, 0.0017, 12).rotateZ(Math.PI / 2),
    '#373736',
  );
  const hub = paint(
    new THREE.CylinderGeometry(0.0039, 0.0039, 0.0019, 10).rotateZ(Math.PI / 2),
    '#b4b3a3',
  );
  const spokes: THREE.BufferGeometry[] = [tyre, hub];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    spokes.push(
      rod(
        0,
        -Math.cos(a) * 0.004,
        -Math.sin(a) * 0.004,
        0,
        Math.cos(a) * 0.004,
        Math.sin(a) * 0.004,
        0.00022,
        '#d2cfbf',
      ),
    );
  }
  return merge(spokes);
}

function dog() {
  const body = profile(
    [
      [0, 0.0045, 0.0055],
      [0.009, 0.0047, 0.006],
      [0.023, 0.0038, 0.0048],
    ],
    10,
    '#9b8a70',
  );
  body.rotateX(Math.PI / 2).translate(0, 0.013, -0.01);
  return merge([
    body,
    profile(
      [
        [0.013, 0.0028, 0.003, 0.012],
        [0.021, 0.0038, 0.0042, 0.014],
        [0.024, 0.0024, 0.0035, 0.013],
      ],
      10,
      '#85735c',
    ),
    box(0.0052, 0.0032, 0.006, 0, 0.02, 0.018, '#a8977a'),
    box(0.0032, 0.0019, 0.0015, 0, 0.0205, 0.0214, '#403c34'),
    triangle(
      [-0.0035, 0.024, 0.012, -0.004, 0.0285, 0.012, -0.0015, 0.025, 0.016],
      '#675746',
    ),
    triangle(
      [0.0015, 0.025, 0.016, 0.004, 0.0285, 0.012, 0.0035, 0.024, 0.012],
      '#675746',
    ),
    rod(0, 0.018, -0.012, 0, 0.026, -0.018, 0.0013, '#8e7b61'),
    box(0.0072, 0.0012, 0.0081, 0, 0.0171, 0.0105, '#5d5750'),
  ]);
}

export const clothes = [
  '#d7ccb0', // cream mac
  '#aeb5b0', // grey wool suit/coat
  '#99a78f', // sage
  '#98aeb3', // blue-grey wool
  '#b29f86', // warm brown
  '#bec1b9', // pale grey
  '#808e8b', // restrained charcoal-green
];
export const headscarves = ['#c3b79c', '#b1695a', '#83967d'];

export function makeScarfMaterial() {
  const material = toon('#ffffff', { vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `
attribute float aScarf;
attribute vec3 aScarfTint;
varying float vScarf;
varying vec3 vScarfTint;
void main() {
  vScarf = aScarf;
  vScarfTint = aScarfTint;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying float vScarf;
varying vec3 vScarfTint;
void main() {`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  diffuseColor.rgb *= mix(vec3(1.0), vScarfTint, vScarf);`,
      );
  };
  material.customProgramCacheKey = () => 'rota-resident-scarves-pass2';
  return material;
}

export function makeContactMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uColour: { value: new THREE.Color('#252b2b') } },
    ]),
    vertexShader: /* glsl */ `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 local = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
  #endif
  vec4 mvPosition = modelViewMatrix * local;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform vec3 uColour;
#include <fog_pars_fragment>
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float d = dot(p, p);
  if (d >= 1.0) discard;
  float edge = 1.0 - d;
  gl_FragColor = vec4(uColour, 0.18 * edge * edge);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/** Only the new short walks get flags. This is static residential geometry,
 * separate from the board and existing streets, merged into one draw call. */
function makeFrontPaths(plan: NeighbourhoodPlan) {
  const parts: THREE.BufferGeometry[] = [];
  let seed = 0;
  const run = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    width: number,
  ) => {
    const dx = bx - ax,
      dz = bz - az,
      length = Math.hypot(dx, dz);
    if (length < 0.008) return;
    const steps = Math.ceil(length / 0.038),
      step = length / steps,
      angle = Math.atan2(dx, dz),
      c = Math.cos(angle),
      s = Math.sin(angle);
    for (let k = 0; k < steps; k++)
      for (let col = 0; col < 2; col++) {
        const t = (k + 0.5) / steps,
          side = ((col === 0 ? -1 : 1) * width) / 4,
          colour = residentSeed(++seed + 810) > 0.55 ? '#f0eee7' : '#d9d6c9';
        const g = new THREE.BoxGeometry(
          width / 2 - 0.0006,
          0.0007,
          step - 0.0006,
        )
          .rotateY(angle)
          .translate(
            ax + dx * t + side * c,
            ay + (by - ay) * t - 0.0006,
            az + dz * t - side * s,
          );
        parts.push(paint(g, colour));
      }
  };
  for (const route of plan.routes) {
    if (!route.near) continue;
    for (const span of route.spans)
      run(span.a.x, span.a.y, span.a.z, span.b.x, span.b.y, span.b.z, 0.055);
    // Actual door approaches belong to these same inward-facing fronts,
    // never to the back-to-back washing yards. Narrow flags connect homes.
    for (const door of route.doors) {
      let start = 0;
      for (const span of route.spans) {
        if (door.distance <= start + span.length) {
          const t = Math.max(
            0,
            Math.min(1, (door.distance - start) / span.length),
          );
          run(
            span.a.x + (span.b.x - span.a.x) * t,
            span.a.y + (span.b.y - span.a.y) * t,
            span.a.z + (span.b.z - span.a.z) * t,
            door.point.x,
            door.point.y,
            door.point.z,
            0.04,
          );
          break;
        }
        start += span.length;
      }
    }
  }
  return parts.length ? merge(parts) : null;
}

export class People {
  readonly group = new THREE.Group();
  private readonly residents: Resident[] = [];
  private readonly body: THREE.InstancedMesh[] = [];
  private readonly heads: THREE.InstancedMesh[] = [];
  private readonly slots = new Uint8Array(PEOPLE_MAX);
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly material = toon('#ffffff', { vertexColors: true });
  private readonly scarfMaterial = makeScarfMaterial();
  private readonly contactMaterial = makeContactMaterial();
  private readonly contact: THREE.InstancedMesh;
  private readonly paths: THREE.Mesh | null;
  private readonly pathMaterial = toon('#b7b09d', { vertexColors: true });
  private readonly upperArm: THREE.InstancedMesh;
  private readonly lowerArm: THREE.InstancedMesh;
  private readonly upperLeg: THREE.InstancedMesh;
  private readonly lowerLeg: THREE.InstancedMesh;
  private readonly shoes: THREE.InstancedMesh;
  private readonly hands: THREE.InstancedMesh;
  private readonly carriage: THREE.InstancedMesh;
  private readonly wheels: THREE.InstancedMesh;
  private readonly terrier: THREE.InstancedMesh;
  private readonly paws: THREE.InstancedMesh;
  private readonly leash: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Euler();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly colour = new THREE.Color();
  private count = 0;
  private accumulator = 0;
  private drawingStep = 1 / 60;
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(
    plan: NeighbourhoodPlan,
    private readonly still: boolean,
    private readonly lite: boolean,
  ) {
    this.group.name = 'rota-town-residents';
    const paths = makeFrontPaths(plan);
    this.paths = paths ? new THREE.Mesh(paths, this.pathMaterial) : null;
    if (this.paths) {
      this.paths.name = 'rota-residential-frontpaths';
      this.paths.receiveShadow = true;
      this.group.add(this.paths);
    }
    for (let i = 0; i < 3; i++) {
      this.body.push(this.batch(coat(i), PEOPLE_MAX, `coat-${i}`, true));
      this.heads.push(
        this.batch(
          head(i),
          PEOPLE_MAX,
          `head-${i}`,
          false,
          i === 1 ? this.scarfMaterial : this.material,
        ),
      );
    }
    const scarfTints = new THREE.InstancedBufferAttribute(
      new Float32Array(PEOPLE_MAX * 3),
      3,
    );
    this.heads[1].geometry.setAttribute('aScarfTint', scarfTints);
    this.contact = this.batch(
      new THREE.PlaneGeometry(0.028, 0.038).rotateX(-Math.PI / 2),
      PEOPLE_MAX,
      'contact-shadow',
      false,
      this.contactMaterial,
    );
    this.contact.receiveShadow = false;
    this.contact.renderOrder = 1;
    this.upperArm = this.batch(sleeve(false), PEOPLE_MAX * 2, 'upper-sleeves');
    this.lowerArm = this.batch(sleeve(true), PEOPLE_MAX * 2, 'cuffs');
    this.upperLeg = this.batch(trouser(false), PEOPLE_MAX * 2, 'thighs');
    this.lowerLeg = this.batch(trouser(true), PEOPLE_MAX * 2, 'shins');
    this.shoes = this.batch(shoe(), PEOPLE_MAX * 2, 'shoes');
    this.hands = this.batch(hand(), PEOPLE_MAX * 2, 'hands');
    this.carriage = this.batch(pram(), 1, 'coach-pram');
    this.wheels = this.batch(wheel(), 4, 'pram-wheels');
    this.terrier = this.batch(dog(), 1, 'terrier');
    this.paws = this.batch(
      profile(
        [
          [0, 0.001, 0.0012],
          [0.003, 0.0013, 0.0014],
          [0.012, 0.0014, 0.0011],
        ],
        6,
        '#837157',
      ),
      4,
      'terrier-legs',
    );
    this.leash = this.batch(
      paint(
        new THREE.CylinderGeometry(1, 1, 1, 4).translate(0, 0.5, 0),
        '#51493d',
      ),
      1,
      'dog-lead',
    );

    const routes = plan.routes.filter((r) => r.length > 0.14 && r.spans.length);
    const length = routes.reduce((sum, r) => sum + r.length, 0);
    const near = routes
      .filter((r) => r.near)
      .sort(
        (a, b) =>
          a.spans[0].a.z - b.spans[0].a.z || a.spans[0].a.x - b.spans[0].a.x,
      );
    const used = [0, 0, 0];
    if (length > 0) {
      for (let i = 0; i < PEOPLE_MAX; i++) {
        // Weighted spacing visits all residential fronts instead of filling
        // one short decorative lane. No geometry is placed on board cells.
        let target =
          ((i * 0.6180339887498949 + 0.137 + residentSeed(i + 181) * 0.02) %
            1) *
          length;
        let route: WalkRoute = routes[routes.length - 1];
        for (const r of routes) {
          target -= r.length;
          if (target <= 0) {
            route = r;
            break;
          }
        }
        let spawn: number | undefined;
        if (i < 8 && near.length) {
          route = near[i % near.length];
          const visits = Math.ceil(8 / near.length);
          spawn =
            (route.length * (Math.floor(i / near.length) + 1)) / (visits + 1);
        }
        const r = makeResident(route, i, spawn);
        this.slots[i] = used[r.style]++;
        this.residents.push(r);
        this.colour.set(clothes[i % clothes.length]);
        this.body[r.style].setColorAt(this.slots[i], this.colour);
        if (r.style === 1) {
          this.colour.set(headscarves[this.slots[i] % headscarves.length]);
          scarfTints.setXYZ(
            this.slots[i],
            this.colour.r,
            this.colour.g,
            this.colour.b,
          );
          this.colour.set(clothes[i % clothes.length]);
        }
        for (let side = 0; side < 2; side++) {
          this.upperArm.setColorAt(i * 2 + side, this.colour);
          this.lowerArm.setColorAt(i * 2 + side, this.colour);
          this.colour.set(r.style === 1 ? '#9b8b78' : '#626a68');
          this.upperLeg.setColorAt(i * 2 + side, this.colour);
          this.lowerLeg.setColorAt(i * 2 + side, this.colour);
          this.colour.set(clothes[i % clothes.length]);
        }
      }
    }
    this.setQuality('high');
    this.draw();
  }

  private batch(
    g: THREE.BufferGeometry,
    count: number,
    name: string,
    shadows = false,
    material: THREE.Material = this.material,
  ) {
    const mesh = new THREE.InstancedMesh(g, material, count);
    mesh.name = `rota-people-${name}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    this.meshes.push(mesh);
    this.group.add(mesh);
    return mesh;
  }

  setQuality(tier: QualityTier) {
    this.count = Math.min(
      this.residents.length,
      qualityLevels[tier].people,
      this.lite ? 20 : PEOPLE_MAX,
    );
    this.drawingStep =
      tier === 'high' ? 1 / 60 : tier === 'balanced' ? 1 / 30 : 1 / 20;
    for (let style = 0; style < 3; style++) {
      let count = 0;
      for (let i = 0; i < this.count; i++)
        if (this.residents[i].style === style) count++;
      this.body[style].count = this.heads[style].count = count;
      this.body[style].castShadow = tier !== 'low';
    }
    this.upperArm.count =
      this.lowerArm.count =
      this.upperLeg.count =
      this.lowerLeg.count =
      this.shoes.count =
      this.hands.count =
        this.count * 2;
    this.carriage.count = this.count > 0 ? 1 : 0;
    this.wheels.count = this.count > 0 ? 4 : 0;
    this.terrier.count = this.count > 2 ? 1 : 0;
    this.paws.count = this.count > 2 ? 4 : 0;
    this.leash.count = this.count > 2 ? 1 : 0;
    this.contact.count = this.count;
    this.accumulator = this.drawingStep;
    this.draw();
  }

  tick(dt: number, _now: number, crossings: readonly CrossingClearance[]) {
    if (this.still) return;
    for (let i = 0; i < this.residents.length; i++) {
      const r = this.residents[i];
      let gap = Infinity;
      // Narrow pavements form a small queue at the kerb instead of drawing
      // several residents in the same footprint. Crossing occupants retain
      // their admitted full-speed passage; the scan is bounded at 28².
      if (r.crossing < 0 && r.route.spans[r.span].crossing < 0) {
        for (let j = 0; j < this.residents.length; j++) {
          const other = this.residents[j];
          if (
            j === i ||
            other.route !== r.route ||
            other.direction !== r.direction ||
            !other.visible ||
            other.door >= 0
          )
            continue;
          const ahead = (other.distance - r.distance) * r.direction;
          if (ahead > 0.00001)
            gap = Math.min(
              gap,
              Math.max(
                0,
                ahead -
                  r.envelope -
                  (j === 2 ? 0.057 : 0.022) * PEOPLE_PRESENTATION_SCALE -
                  0.018 * PEOPLE_PRESENTATION_SCALE,
              ),
            );
        }
      }
      stepResident(r, dt, crossings, gap);
    }
    this.accumulator += dt;
    if (this.accumulator < this.drawingStep) return;
    this.accumulator %= this.drawingStep;
    this.draw();
  }

  /** Gate animation reads this after simulation; writing into the owner's
   * persistent buffer avoids allocations and never mutates traffic state. */
  fillCrossingOccupancy(flags: Uint8Array) {
    flags.fill(0);
    for (let i = 0; i < this.residents.length; i++) {
      const r = this.residents[i];
      if (r.visible && r.crossing >= 0 && r.crossing < flags.length)
        flags[r.crossing] = 1;
    }
  }

  private place(
    mesh: THREE.InstancedMesh,
    index: number,
    r: Resident,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    size = r.size,
  ) {
    if (!r.visible) {
      mesh.setMatrixAt(index, this.hidden);
      return;
    }
    const c = Math.cos(r.heading),
      s = Math.sin(r.heading);
    this.position.set(
      r.x + (x * c + z * s) * size,
      r.y + y * size,
      r.z + (-x * s + z * c) * size,
    );
    this.rotation.set(rx, r.heading + ry, rz, 'YXZ');
    this.quaternion.setFromEuler(this.rotation);
    this.scale.set(size, size, size);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  /** A limb basis in the sagittal plane, joined exactly at both endpoints. */
  private bone(
    mesh: THREE.InstancedMesh,
    index: number,
    r: Resident,
    x: number,
    y: number,
    z: number,
    endY: number,
    endZ: number,
    width: number,
    depth: number,
  ) {
    if (!r.visible) {
      mesh.setMatrixAt(index, this.hidden);
      return;
    }
    const c = Math.cos(r.heading),
      s = Math.sin(r.heading),
      dy = endY - y,
      dz = endZ - z,
      length = Math.hypot(dy, dz) || 1e-8,
      ny = dy / length,
      nz = dz / length,
      q = r.size;
    this.matrix.set(
      c * width * q,
      s * dz * q,
      s * ny * depth * q,
      r.x + (x * c + z * s) * q,
      0,
      dy * q,
      -nz * depth * q,
      r.y + y * q,
      -s * width * q,
      c * dz * q,
      c * ny * depth * q,
      r.z + (-x * s + z * c) * q,
      0,
      0,
      0,
      1,
    );
    mesh.setMatrixAt(index, this.matrix);
  }

  private draw() {
    for (let i = 0; i < this.count; i++) {
      const r = this.residents[i],
        phase = r.phase * Math.PI * 2,
        moving = r.motion,
        bob = -Math.cos(phase * 2) * moving * 0.00055,
        sway = Math.sin(phase) * moving * 0.025;
      this.place(this.contact, i, r, 0, 0.0003);
      let pramPitch = 0,
        pramY = 0;
      if (i === 0) {
        const rearY = heightOnRoute(r, 0.029 * r.size),
          frontY = heightOnRoute(r, 0.059 * r.size);
        pramPitch = -Math.atan2(frontY - rearY, 0.03 * r.size);
        pramY = (rearY - r.y) / r.size + Math.sin(pramPitch) * 0.029;
      }
      this.place(
        this.body[r.style],
        this.slots[i],
        r,
        0,
        bob,
        0,
        moving * 0.025,
        0,
        sway,
      );
      this.place(
        this.heads[r.style],
        this.slots[i],
        r,
        0,
        bob,
        0,
        0,
        Math.sin(phase * 0.5) * moving * 0.018,
        sway * 0.4,
      );
      for (let side = 0; side < 2; side++) {
        const index = i * 2 + side,
          sign = side === 0 ? -1 : 1,
          p = (r.phase + side * 0.5) % 1;
        // Stance is 60% of the stride. This linear retreat exactly cancels
        // forward travel; the remaining 40% swings with a bent knee.
        let footZ: number,
          lift = 0;
        if (p < 0.6) footZ = r.stride * (0.3 - p);
        else {
          const t = (p - 0.6) / 0.4;
          footZ = r.stride * (-0.3 + 0.6 * t * t * (3 - 2 * t));
          lift = Math.sin(t * Math.PI) * 0.0075;
        }
        // r.stride is already child-specific; local dimensions also scale.
        footZ *= moving / r.size;
        lift *= moving;
        const terrain = (heightOnRoute(r, footZ * r.size) - r.y) / r.size,
          hipY = 0.0325 + bob,
          ankleY = 0.0034 + lift + terrain,
          dy = ankleY - hipY,
          distance = Math.min(0.0329, Math.max(0.001, Math.hypot(dy, footZ))),
          along = (0.017 ** 2 - 0.016 ** 2 + distance ** 2) / (2 * distance),
          bend = Math.sqrt(Math.max(0, 0.017 ** 2 - along ** 2)),
          kneeY = hipY + (dy * along) / distance + (footZ * bend) / distance,
          kneeZ = (footZ * along) / distance - (dy * bend) / distance,
          legX = sign * 0.0039;
        this.bone(
          this.upperLeg,
          index,
          r,
          legX,
          hipY,
          0,
          kneeY,
          kneeZ,
          0.0031,
          0.0032,
        );
        this.bone(
          this.lowerLeg,
          index,
          r,
          legX,
          kneeY,
          kneeZ,
          ankleY,
          footZ,
          0.0028,
          0.0028,
        );
        this.place(
          this.shoes,
          index,
          r,
          legX,
          lift + terrain,
          footZ,
          p > 0.6 ? -Math.sin(((p - 0.6) / 0.4) * Math.PI) * 0.25 * moving : 0,
        );

        const armX = sign * (i === 0 ? 0.009 : 0.0082),
          shoulderY = 0.0527 + bob,
          swing = Math.sin(phase + side * Math.PI) * moving * 0.006,
          wristY =
            i === 0
              ? 0.036 * Math.cos(pramPitch) -
                0.013 * Math.sin(pramPitch) +
                pramY
              : 0.0329 + Math.abs(swing) * 0.3,
          wristZ =
            i === 0
              ? 0.036 * Math.sin(pramPitch) + 0.013 * Math.cos(pramPitch)
              : -swing,
          elbowY = i === 0 ? (shoulderY + wristY) / 2 - 0.001 : 0.043,
          elbowZ = i === 0 ? wristZ * 0.6 : -swing * 0.45 + 0.001;
        this.bone(
          this.upperArm,
          index,
          r,
          armX,
          shoulderY,
          0,
          elbowY,
          elbowZ,
          0.003,
          0.003,
        );
        this.bone(
          this.lowerArm,
          index,
          r,
          armX,
          elbowY,
          elbowZ,
          wristY,
          wristZ,
          0.0028,
          0.0028,
        );
        this.place(
          this.hands,
          index,
          r,
          armX,
          i === 0 ? wristY : wristY + 0.0003,
          i === 0 ? wristZ - 0.0015 : wristZ,
          i === 0 ? Math.PI / 2 : Math.PI,
        );
      }
      if (i === 0) {
        // The sprung coach and rigid handle move with the pusher; only the
        // torso breathes, so both hands always meet the same handle points.
        this.place(this.carriage, 0, r, 0, pramY, 0, pramPitch);
        for (let j = 0; j < 4; j++) {
          const wheelZ = j < 2 ? 0.029 : 0.059;
          this.place(
            this.wheels,
            j,
            r,
            (j % 2 ? 1 : -1) * 0.012,
            0.006 * Math.cos(pramPitch) - wheelZ * Math.sin(pramPitch) + pramY,
            0.006 * Math.sin(pramPitch) + wheelZ * Math.cos(pramPitch),
            pramPitch + r.travel / (0.0057 * r.size),
          );
        }
      }
      if (i === 2) this.drawDog(r);
    }
    for (let i = 0; i < this.meshes.length; i++)
      this.meshes[i].instanceMatrix.needsUpdate = true;
  }

  private drawDog(r: Resident) {
    const x = 0.008,
      z = -0.035,
      terrain = (heightOnRoute(r, z * r.size) - r.y) / r.size;
    this.place(
      this.terrier,
      0,
      r,
      x,
      terrain + Math.sin(r.phase * Math.PI * 4) * r.motion * 0.0003,
      z,
    );
    for (let j = 0; j < 4; j++) {
      const p = r.phase * Math.PI * 4 + (j === 0 || j === 3 ? 0 : Math.PI),
        swing = Math.sin(p) * r.motion * 0.0035,
        lift = Math.max(0, Math.cos(p)) * r.motion * 0.0016;
      const pawZ = z + (j < 2 ? 0.009 : -0.009) + swing,
        pawGround = (heightOnRoute(r, pawZ * r.size) - r.y) / r.size;
      this.place(
        this.paws,
        j,
        r,
        x + (j % 2 ? 1 : -1) * 0.0036,
        lift + pawGround,
        pawZ,
        swing * 30,
      );
    }
    const swing = Math.sin(r.phase * Math.PI * 2 + Math.PI) * r.motion * 0.006;
    this.bone(
      this.leash,
      0,
      r,
      x,
      0.0329 + Math.abs(swing) * 0.3,
      -swing,
      0.018 + terrain,
      z + 0.014,
      0.00023,
      0.00023,
    );
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.material.dispose();
    this.scarfMaterial.dispose();
    this.contactMaterial.dispose();
    this.paths?.geometry.dispose();
    this.pathMaterial.dispose();
    this.group.clear();
  }
}
