import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

/**
 * Alto's planets, built from code (no model files): each has its own ground,
 * a dozen or so big things standing on it that read at phone size, small
 * props clustered round them, and its own motion. The ships and their
 * upgrades live in alto-ship.ts.
 *
 * Everything static on a planet is merged by material into a handful of
 * meshes (vertex colours carry the paint and the shading gradients), and
 * repeated things are instanced, so eight planets stay cheap to draw.
 *
 * Units: a planet is built at radius 1 and scaled to its slot on screen.
 */

// ——— Small helpers ———

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fractal noise in about −1…1. */
function fbm(
  noise: SimplexNoise,
  x: number,
  y: number,
  z: number,
  octaves = 5,
  lacunarity = 2.05,
  gain = 0.5,
) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise.noise3d(x * f, y * f, z * f);
    f *= lacunarity;
    amp *= gain;
  }
  return sum * 1.6;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const col = (hex: string) => new THREE.Color(hex);
const TAU = Math.PI * 2;
type V3 = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A part for merging: non-indexed, no uv, one vertex colour. */
export function part(
  geo: THREE.BufferGeometry,
  color: string | THREE.Color,
  at?: THREE.Matrix4,
) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (at) g.applyMatrix4(at);
  const c = typeof color === 'string' ? col(color) : color;
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
export const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts)!;
export const m4 = (
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  s: number | [number, number, number] = 1,
) => {
  const scale =
    typeof s === 'number'
      ? new THREE.Vector3(s, s, s)
      : new THREE.Vector3(...s);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    scale,
  );
};
/** A lumpy rock or cloud puff: an icosphere pushed about by noise. */
export function lump(detail: number, rough: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const noise = new SimplexNoise({ random: seeded(seed) });
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + rough * noise.noise3d(v.x * 1.7, v.y * 1.7, v.z * 1.7);
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const up = new THREE.Vector3(0, 1, 0);
/** Stand a thing on the planet at this direction. */
function standOn(
  dir: THREE.Vector3,
  radius: number,
  scale: number,
  spin: number,
  lean = 0,
) {
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
  const turn = new THREE.Quaternion().setFromAxisAngle(up, spin);
  if (lean)
    turn.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean),
    );
  q.multiply(turn);
  return new THREE.Matrix4().compose(
    dir.clone().multiplyScalar(radius),
    q,
    new THREE.Vector3(scale, scale, scale),
  );
}
function randomDir(rand: () => number) {
  const u = rand() * 2 - 1;
  const t = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return new THREE.Vector3(r * Math.cos(t), u, r * Math.sin(t));
}
/** A direction a little way from `d`, `angle` radians off in a random heading. */
function near(d: V3, angle: number, rand: () => number) {
  const axis = randomDir(rand).cross(d).normalize();
  return d.clone().applyAxisAngle(axis, angle).normalize();
}

// ——— Geometry kit: indexed, smooth parts painted per vertex ———

/** Orient local +y along `dir`, at `pos`. */
function aim(
  pos: V3,
  dir: V3,
  s: number | [number, number, number] = 1,
  roll = 0,
) {
  const q = new THREE.Quaternion().setFromUnitVectors(
    up,
    dir.clone().normalize(),
  );
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(up, roll));
  const sc = typeof s === 'number' ? v3(s, s, s) : v3(...s);
  return new THREE.Matrix4().compose(pos, q, sc);
}
/** Keep only position and normal, and make sure there is an index. */
function tidy(geo: THREE.BufferGeometry) {
  for (const name of Object.keys(geo.attributes))
    if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
  geo.clearGroups();
  geo.morphAttributes = {};
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  if (!geo.index) {
    const n = geo.getAttribute('position').count;
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return geo;
}
/** Share the vertices that sit at the same spot (positions only): a fast
 * numeric-key version of mergeVertices for the shapes built here. */
function joinVertices(geo: THREE.BufferGeometry) {
  const src = geo.getAttribute('position');
  const n = src.count;
  const old = geo.index;
  const seen = new Map<number, number>();
  const remap = new Uint32Array(n);
  const out: number[] = [];
  const q = 1 / 2e-5;
  const span = 2 ** 17;
  for (let i = 0; i < n; i++) {
    const x = src.getX(i);
    const y = src.getY(i);
    const z = src.getZ(i);
    const key =
      (Math.round(x * q) + span) * span * span * 4 +
      (Math.round(y * q) + span) * span * 2 +
      (Math.round(z * q) + span);
    let k = seen.get(key);
    if (k === undefined) {
      k = out.length / 3;
      seen.set(key, k);
      out.push(x, y, z);
    }
    remap[i] = k;
  }
  const count = old ? old.count : n;
  const idx = new Uint32Array(count);
  for (let i = 0; i < count; i++) idx[i] = remap[old ? old.getX(i) : i];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
/** Weld a geometry's seams so it shades smoothly. */
function weld(geo: THREE.BufferGeometry) {
  const g = joinVertices(geo);
  g.computeVertexNormals();
  return g;
}
/** A smooth icosphere of radius 1. */
const ball = (detail: number) => weld(new THREE.IcosahedronGeometry(1, detail));
/** Move every vertex, then reshade. */
function warp(
  g: THREE.BufferGeometry,
  fn: (v: V3, i: number) => void,
  normals = true,
) {
  const p = g.getAttribute('position');
  const v = v3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v, i);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  if (normals) g.computeVertexNormals();
  return g;
}
/** A smooth lump: a welded icosphere pushed about by noise. */
function blob(detail: number, rough: number, seed: number, freq = 1.6) {
  const nz = new SimplexNoise({ random: seeded(seed) });
  return warp(ball(detail), (v) =>
    v.multiplyScalar(
      1 +
        rough * nz.noise3d(v.x * freq, v.y * freq, v.z * freq) +
        rough * 0.4 * nz.noise3d(v.x * freq * 2.7, v.y * freq * 2.7, v.z * 3),
    ),
  );
}
const lathe = (pts: [number, number][], seg: number) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
/** A box (or round rod) from a to b. */
function beam(a: V3, b: V3, w: number, round = 0, d = w) {
  const len = a.distanceTo(b);
  const g = round
    ? new THREE.CylinderGeometry(w / 2, w / 2, len, round, 1)
    : new THREE.BoxGeometry(w, len, d);
  return g.applyMatrix4(
    aim(a.clone().add(b).multiplyScalar(0.5), b.clone().sub(a)),
  );
}
const tube = (pts: V3[], r: number, seg = 20, radial = 6) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, radial);
const rbox = (w: number, h: number, d: number, r = 0.02, seg = 1) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
/** A leaf or petal in the xy plane, growing up +y, cupped towards +z. */
function leafGeo(len: number, wid: number, cup = 0.3, bend = 0.15, seg = 6) {
  const g = new THREE.PlaneGeometry(1, 1, 4, seg);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i);
    const t = p.getY(i) + 0.5;
    const w = Math.sin(Math.PI * Math.pow(t, 0.7));
    p.setXYZ(
      i,
      u * wid * w,
      t * len,
      cup * wid * (2 * u) ** 2 * 0.5 * w + bend * len * t * t,
    );
  }
  g.computeVertexNormals();
  return g;
}

type Paint = (p: V3, n: V3, c: THREE.Color) => void;
type Tint = string | THREE.Color | Paint;
const tone = new SimplexNoise({ random: seeded(9) });
/** Colour from a at y0 to b at y1. */
const grad = (a: string, b: string, y0: number, y1: number): Paint => {
  const ca = col(a);
  const cb = col(b);
  return (p, _n, c) => {
    c.copy(ca).lerp(cb, smooth(y0, y1, p.y));
  };
};
/** A colour, lighter where it faces up, mottled a little. */
const lit = (hex: string, k = 0.2, mottle = 0.06, freq = 9): Paint => {
  const base = col(hex);
  return (p, n, c) => {
    c.copy(base).multiplyScalar(
      1 -
        k +
        k * (0.5 + 0.5 * n.y) +
        mottle * tone.noise3d(p.x * freq, p.y * freq, p.z * freq),
    );
  };
};
/** Paint on top of another paint. */
const then =
  (a: Paint, b: (p: V3, n: V3, c: THREE.Color) => void): Paint =>
  (p, n, c) => {
    a(p, n, c);
    b(p, n, c);
  };

/** One part, tidied, moved into place and painted (in its final position). */
function bit(geo: THREE.BufferGeometry, tint: Tint, at?: THREE.Matrix4) {
  const g = tidy(geo.clone());
  if (at) g.applyMatrix4(at);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const p = v3();
  const n = v3();
  const fixed =
    typeof tint === 'function'
      ? null
      : typeof tint === 'string'
        ? col(tint)
        : tint;
  for (let i = 0; i < pos.count; i++) {
    if (fixed) c.copy(fixed);
    else {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      (tint as Paint)(p, n, c);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Parts sorted by material; baked into one geometry per material. */
class Kit {
  readonly bins = new Map<string, THREE.BufferGeometry[]>();
  private baked?: Map<string, THREE.BufferGeometry>;
  private list(key: string) {
    let l = this.bins.get(key);
    if (!l) this.bins.set(key, (l = []));
    this.baked = undefined;
    return l;
  }
  add(key: string, geo: THREE.BufferGeometry, tint: Tint, at?: THREE.Matrix4) {
    this.list(key).push(bit(geo, tint, at));
    return this;
  }
  /** Another kit, moved into place. */
  put(other: Kit, at: THREE.Matrix4) {
    for (const [key, geo] of other.bake())
      this.list(key).push(geo.clone().applyMatrix4(at));
    return this;
  }
  /** Darken what is near the ground (y = 0), as if it shaded itself. */
  ground(h: number, k: number) {
    for (const l of this.bins.values())
      for (const g of l) {
        const p = g.getAttribute('position');
        const c = g.getAttribute('color');
        for (let i = 0; i < p.count; i++) {
          const f = 1 - k * (1 - smooth(-0.04, h, p.getY(i)));
          c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f);
        }
      }
    this.baked = undefined;
    return this;
  }
  bake() {
    if (!this.baked) {
      this.baked = new Map();
      for (const [key, l] of this.bins)
        if (l.length) this.baked.set(key, l.length === 1 ? l[0] : merge(l));
    }
    return this.baked;
  }
  meshes(mats: Mats) {
    return [...this.bake()].map(([key, geo]) => new THREE.Mesh(geo, mats(key)));
  }
}

// ——— Materials (one set per planet, made on first use) ———

type Mats = (key: string) => THREE.Material;
const vmat = (o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, ...o });
/** Make a material's emissive light follow its vertex colour. */
const glowPatch = (s: { fragmentShader: string }) => {
  s.fragmentShader = s.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;',
  );
};
/** Emissive light painted per vertex: the vertex colour is the glow. */
function glowMat(
  intensity = 1.6,
  o: THREE.MeshStandardMaterialParameters = {},
) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    emissive: '#ffffff',
    emissiveIntensity: intensity,
    ...o,
  });
  m.onBeforeCompile = glowPatch;
  return m;
}
function makeMat(key: string): THREE.Material {
  switch (key) {
    case 'satin':
      return vmat({ roughness: 0.5 });
    case 'gloss':
      return new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.3,
        clearcoat: 0.7,
        clearcoatRoughness: 0.2,
      });
    case 'metal':
      return vmat({ metalness: 0.75, roughness: 0.3 });
    case 'steel':
      return vmat({ metalness: 0.45, roughness: 0.45 });
    case 'facet':
      return vmat({ metalness: 0.85, roughness: 0.22, flatShading: true });
    case 'leaf':
      return vmat({ roughness: 0.7, side: THREE.DoubleSide });
    case 'snow':
      return vmat({ roughness: 0.55 });
    case 'ice':
      return new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        flatShading: true,
      });
    case 'glass':
      return new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.04,
        clearcoat: 1,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
    case 'glow':
      return glowMat();
    default:
      return vmat({ roughness: 0.85 });
  }
}
function materials(extra: Record<string, THREE.Material> = {}): Mats {
  const made = new Map<string, THREE.Material>(Object.entries(extra));
  return (key) => {
    let m = made.get(key);
    if (!m) made.set(key, (m = makeMat(key)));
    return m;
  };
}

// ——— Air, ground, water, clouds ———

/** The glow of thin air: a soft halo just past the planet's edge (drawn
 * from the inside of a larger sphere) and a faint rim on the ground. */
function atmosphere(color: string, scale: number) {
  const glow = col(color);
  const shader = (halo: boolean) =>
    new THREE.ShaderMaterial({
      uniforms: { glow: { value: glow }, power: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal; varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: halo
        ? /* glsl */ `
        uniform vec3 glow; uniform float power;
        varying vec3 vNormal; varying vec3 vView;
        void main() {
          float d = clamp(-dot(vNormal, vView), 0.0, 1.0);
          float a = pow(d, 2.2) * 0.75 * power;
          gl_FragColor = vec4(glow * a, a);
        }`
        : /* glsl */ `
        uniform vec3 glow; uniform float power;
        varying vec3 vNormal; varying vec3 vView;
        void main() {
          float rim = 1.0 - max(dot(vNormal, vView), 0.0);
          float a = pow(rim, 3.0) * 0.55 * power;
          gl_FragColor = vec4(glow * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      side: halo ? THREE.BackSide : THREE.FrontSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(scale, 64, 40),
    shader(true),
  );
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 64, 40),
    shader(false),
  );
  // One uniform drives both, so callers brighten the air with one value.
  rim.material.uniforms.power = halo.material.uniforms.power;
  halo.add(rim);
  return halo;
}

type GroundOut = { glow: number };
/** The ground: a dense icosphere lifted by a height and coloured per vertex.
 * Steep faces are shaded darker (`slope`), and `shape` may set a glow. */
function terrain(
  detail: number,
  shape: (d: THREE.Vector3, c: THREE.Color, o: GroundOut) => number,
  slope = 0,
  withGlow = false,
) {
  const g = joinVertices(new THREE.IcosahedronGeometry(1, detail));
  const p = g.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  const glows = withGlow ? new Float32Array(p.count) : null;
  const d = new THREE.Vector3();
  const c = new THREE.Color();
  const o: GroundOut = { glow: 0 };
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    o.glow = 0;
    const h = shape(d, c, o);
    p.setXYZ(i, d.x * (1 + h), d.y * (1 + h), d.z * (1 + h));
    colors.set([c.r, c.g, c.b], i * 3);
    if (glows) glows[i] = o.glow;
  }
  g.computeVertexNormals();
  if (slope) {
    const nor = g.getAttribute('normal');
    const n = v3();
    for (let i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize();
      n.fromBufferAttribute(nor, i);
      const f = 1 - slope * (1 - smooth(0.55, 0.97, n.dot(d)));
      colors[i * 3] *= f;
      colors[i * 3 + 1] *= f;
      colors[i * 3 + 2] *= f;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (glows) g.setAttribute('glow', new THREE.BufferAttribute(glows, 1));
  return g;
}
const groundMat = (o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    ...o,
  });
/** Ground whose `glow` attribute lights it from within in `color`. */
function glowGroundMat(color: string) {
  const m = groundMat({
    roughness: 0.55,
    metalness: 0.15,
    emissive: color,
    emissiveIntensity: 1,
  });
  m.onBeforeCompile = (s) => {
    s.vertexShader =
      'attribute float glow;\nvarying float vGlow;\n' +
      s.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGlow = glow;',
      );
    s.fragmentShader =
      'varying float vGlow;\n' +
      s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;',
      );
  };
  return m;
}
function waterSphere(color: string) {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.001, 28),
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.12,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.86,
    }),
  );
}
/** A puffy cloud: a heap of smooth puffs, flat underneath, cool grey below
 * and white on top, resting on y = 0 and about two units long. */
function cloud(rand: () => number, k: number, tint = '#ffffff') {
  const top = col(tint);
  const under = col('#c9d6ea');
  {
    const kit = new Kit();
    const n = 9 + Math.floor(rand() * 4);
    const len = 1.5 + rand() * 0.6;
    for (let j = 0; j < n; j++) {
      const f = j / (n - 1) - 0.5;
      const s = (0.42 + rand() * 0.22) * (1 - Math.abs(f) * 0.9);
      const x = f * len + (rand() - 0.5) * 0.12;
      const z = (rand() - 0.5) * 0.45;
      const y = s * 0.35 + rand() * 0.12;
      const puff = blob(3, 0.07, k * 31 + j, 1.4);
      kit.add(
        'c',
        puff,
        '#ffffff',
        m4(x, y, z, 0, rand() * 3, 0, [s, s * 0.85, s]),
      );
    }
    for (let j = 0; j < 4; j++) {
      const s = 0.22 + rand() * 0.12;
      kit.add(
        'c',
        ball(2),
        '#ffffff',
        m4(
          (rand() - 0.5) * len * 0.7,
          0.55 + rand() * 0.15,
          (rand() - 0.5) * 0.3,
          0,
          0,
          0,
          s,
        ),
      );
    }
    const geo = kit.bake().get('c')!;
    // Flat underneath, then shaded from below.
    warp(geo, (v) => {
      if (v.y < 0.02) v.y = 0.02 + (v.y - 0.02) * 0.18;
    });
    const pos = geo.getAttribute('position');
    const cc = geo.getAttribute('color');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      c.copy(under).lerp(top, smooth(0.0, 0.45, pos.getY(i)));
      cc.setXYZ(i, c.r, c.g, c.b);
    }
    return geo;
  }
}

/** Chimney smoke: puffs rise, swell and fade on a loop. */
function smoke(rand: () => number) {
  const g = new THREE.Group();
  const puffs: THREE.Mesh[] = [];
  const geo = blob(3, 0.12, 4);
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: '#ece6df',
        roughness: 1,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    m.userData.phase = k / 6 + rand() * 0.05;
    puffs.push(m);
    g.add(m);
  }
  return {
    group: g,
    update(t: number) {
      for (const m of puffs) {
        const f = (t * 0.25 + (m.userData.phase as number)) % 1;
        m.position.set(Math.sin(f * 5) * 0.06 + f * 0.2, f * 0.6, 0);
        m.scale.setScalar(0.05 + f * 0.13);
        m.rotation.set(f * 2, f * 3, 0);
        (m.material as THREE.MeshStandardMaterial).opacity = 0.85 * (1 - f);
      }
    },
  };
}

/** Planetary rings: banded colour and see-through gaps, drawn per vertex. */
function ring(
  inner: number,
  outer: number,
  colors: string[],
  rand: () => number,
) {
  const geo = new THREE.RingGeometry(inner, outer, 160, 20);
  geo.deleteAttribute('uv');
  const p = geo.getAttribute('position');
  const data = new Float32Array(p.count * 4);
  const bands = Array.from({ length: 9 }, () => ({
    c: col(colors[Math.floor(rand() * colors.length)]),
    a: 0.45 + rand() * 0.55,
  }));
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const f = Math.min(1, Math.max(0, (v.length() - inner) / (outer - inner)));
    const b = bands[Math.min(bands.length - 1, Math.floor(f * bands.length))];
    const edge = smooth(0, 0.08, f) * smooth(1, 0.85, f);
    const ripple = 0.75 + 0.25 * Math.sin(f * 40);
    data.set([b.c.r, b.c.g, b.c.b, b.a * edge * ripple], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(data, 4));
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.2,
      depthWrite: false,
    }),
  );
}

/** A moon: rolling dust with real craters (a bowl and a raised rim). */
function moon(seed: number, tint: string) {
  const noise = new SimplexNoise({ random: seeded(seed) });
  const rand = seeded(seed * 3 + 1);
  const base = col(tint);
  const dark = base.clone().multiplyScalar(0.62);
  const light = base.clone().lerp(col('#ffffff'), 0.25);
  const craters = Array.from({ length: 11 }, () => ({
    c: randomDir(rand),
    r: 0.12 + rand() * 0.3,
  }));
  const geo = terrain(
    22,
    (d, c) => {
      const n = fbm(noise, d.x * 2.4, d.y * 2.4, d.z * 2.4, 4);
      let h = n * 0.035;
      let bowl = 0;
      let rim = 0;
      for (const cr of craters) {
        const a = d.angleTo(cr.c) / cr.r;
        if (a < 1) bowl = Math.max(bowl, 1 - a * a);
        rim = Math.max(rim, Math.exp(-(((a - 1) / 0.22) ** 2)));
      }
      h += -0.07 * bowl + 0.025 * rim;
      c.copy(base)
        .lerp(dark, 0.35 + 0.35 * n + bowl * 0.4)
        .lerp(light, rim * 0.5);
      return h;
    },
    0.3,
  );
  return new THREE.Mesh(geo, groundMat());
}
// ——— Big readable things that stand on the planets ———
// Every feature is sized to read on a phone: a planet carries a dozen or so,
// each about a tenth of its radius, rather than hundreds of specks. Each is
// built in its own frame (ground at y = 0, about a unit tall, front towards
// +z) and stood on the planet by the caller; small props cluster round them.

/** Directions spread over the sphere, at least `gap` radians apart. */
function scatter(
  rand: () => number,
  count: number,
  gap: number,
  ok: (d: THREE.Vector3) => boolean = () => true,
  taken: THREE.Vector3[] = [],
) {
  const out: THREE.Vector3[] = [];
  for (let k = 0; k < count * 60 && out.length < count; k++) {
    const d = randomDir(rand);
    if (!ok(d)) continue;
    if ([...taken, ...out].some((o) => o.angleTo(d) < gap)) continue;
    out.push(d);
  }
  taken.push(...out);
  return out;
}

/** Flat faces: split the vertices so each triangle shades on its own. */
function flat(geo: THREE.BufferGeometry) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}
const wood = (hex = '#8a6a4a') => lit(hex, 0.25, 0.08, 14);

// ——— Small props ———

/** A round bush of three or four leafy lobes, dark below and sunlit on top. */
function bush(seed: number, hex = '#4f9e3f', berries?: string) {
  const rand = seeded(seed);
  const k = new Kit();
  const base = col(hex);
  const dark = base.clone().multiplyScalar(0.5);
  const light = base.clone().lerp(col('#f0f7a0'), 0.35);
  const paint: Paint = (p, n, c) => {
    c.copy(dark)
      .lerp(base, smooth(0, 0.35, p.y))
      .lerp(light, smooth(0.3, 0.8, p.y) * (0.4 + 0.6 * Math.max(0, n.y)));
    c.multiplyScalar(0.9 + 0.14 * tone.noise3d(p.x * 6, p.y * 6, p.z * 6));
  };
  const lobes: [V3, number][] = [[v3(0, 0.34, 0), 0.36]];
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU + rand();
    lobes.push([
      v3(Math.cos(a) * 0.3, 0.22, Math.sin(a) * 0.3),
      0.24 + rand() * 0.06,
    ]);
  }
  for (const [c, r] of lobes)
    k.add(
      'matte',
      blob(4, 0.12, seed + r * 100, 2.8),
      paint,
      m4(c.x, c.y, c.z, rand(), rand(), 0, [r, r * 0.88, r]),
    );
  if (berries)
    for (let j = 0; j < 7; j++) {
      const [c, r] = lobes[j % lobes.length];
      const d = randomDir(rand);
      d.y = Math.abs(d.y);
      const at = c.clone().addScaledVector(d, r * 0.95);
      k.add('gloss', ball(1), berries, m4(at.x, at.y, at.z, 0, 0, 0, 0.05));
    }
  return k.ground(0.2, 0.3);
}

/** A rock (and a little one beside it), optionally capped with snow. */
function rock(seed: number, hex: string, snow = false) {
  const rand = seeded(seed);
  const k = new Kit();
  const base = col(hex);
  const cap = col('#f4f9ff');
  const paint: Paint = (p, n, c) => {
    c.copy(base).multiplyScalar(
      0.62 +
        0.38 * smooth(-0.05, 0.7, p.y) +
        0.1 * tone.noise3d(p.x * 6, p.y * 6, p.z * 6),
    );
    if (snow)
      c.lerp(
        cap,
        smooth(0.35, 0.65, n.y + 0.2 * tone.noise3d(p.x * 5, p.y * 5, p.z * 5)),
      );
  };
  const big = warp(blob(3, 0.24, seed, 1.2), (v) => {
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
  });
  k.add(
    'matte',
    big,
    paint,
    m4(0, 0.25, 0, rand(), rand() * 6, 0, [0.85, 0.62, 0.7]),
  );
  k.add(
    'matte',
    blob(2, 0.3, seed + 1),
    paint,
    m4(0.68, 0.08, 0.25, rand(), 0, 0, [0.3, 0.22, 0.26]),
  );
  k.add(
    'matte',
    blob(2, 0.3, seed + 2),
    paint,
    m4(-0.5, 0.05, 0.45, rand(), 0, 0, [0.18, 0.14, 0.16]),
  );
  return k.ground(0.15, 0.25);
}

/** A clump of flowers: thin stems, a few leaves and round coloured heads. */
function flowers(seed: number, heads: string[]) {
  const rand = seeded(seed);
  const k = new Kit();
  for (let j = 0; j < 7; j++) {
    const a = rand() * TAU;
    const r = rand() * 0.35;
    const h = 0.45 + rand() * 0.4;
    const foot = v3(Math.cos(a) * r, -0.02, Math.sin(a) * r);
    const top = foot
      .clone()
      .add(v3((rand() - 0.5) * 0.15, h, (rand() - 0.5) * 0.15));
    k.add('matte', beam(foot, top, 0.035, 5), '#4c8a36');
    k.add(
      'leaf',
      leafGeo(0.22, 0.1, 0.4, 0.3, 3),
      lit('#5da544', 0.3),
      aim(
        foot.clone().lerp(top, 0.3),
        v3(Math.cos(a), 0.8, Math.sin(a)),
        1,
        rand() * 6,
      ),
    );
    const hue = heads[j % heads.length];
    k.add(
      'satin',
      ball(2),
      lit(hue, 0.3, 0.05),
      m4(top.x, top.y, top.z, 0, 0, 0, [0.11, 0.07, 0.11]),
    );
    k.add(
      'satin',
      ball(1),
      '#ffe066',
      m4(top.x, top.y + 0.05, top.z, 0, 0, 0, 0.045),
    );
  }
  return k;
}

/** A short run of wooden fence: posts and two rails. */
function fence(len: number) {
  const k = new Kit();
  const n = Math.max(2, Math.round(len / 0.5) + 1);
  for (let j = 0; j < n; j++) {
    const x = -len / 2 + (j / (n - 1)) * len;
    k.add(
      'matte',
      rbox(0.11, 1.0, 0.11, 0.02),
      wood('#8d6a47'),
      m4(x, 0.42, 0, 0, 0, (j % 2 ? 1 : -1) * 0.03),
    );
    k.add(
      'matte',
      new THREE.ConeGeometry(0.08, 0.1, 4),
      wood('#7a5a3c'),
      m4(x, 0.97, 0, 0, Math.PI / 4, 0),
    );
  }
  for (const y of [0.35, 0.72])
    k.add(
      'matte',
      rbox(len + 0.1, 0.09, 0.05, 0.015),
      wood('#a07a52'),
      m4(0, y, 0.07),
    );
  return k.ground(0.25, 0.25);
}

/** A lamp post with a glowing lantern. */
function lampPost(glow = '#ffd27a') {
  const k = new Kit();
  const iron = lit('#3a3f48', 0.3, 0.02);
  k.add(
    'steel',
    lathe(
      [
        [0.16, 0],
        [0.15, 0.06],
        [0.07, 0.12],
        [0.05, 1.3],
        [0.07, 1.34],
        [0, 1.36],
      ],
      10,
    ),
    iron,
  );
  k.add('steel', beam(v3(0, 1.25, 0), v3(0.28, 1.32, 0), 0.04), iron);
  k.add('steel', new THREE.ConeGeometry(0.13, 0.1, 6), iron, m4(0.3, 1.3, 0));
  k.add('glow', ball(2), glow, m4(0.3, 1.18, 0, 0, 0, 0, [0.09, 0.11, 0.09]));
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.06, 0.1, 0.04, 6),
    iron,
    m4(0.3, 1.07, 0),
  );
  return k;
}

/** A wooden crate, optionally heaped with round things (apples, ore…). */
function crate(seed: number, fill?: string, fillKey = 'gloss') {
  const rand = seeded(seed);
  const k = new Kit();
  k.add('matte', rbox(1, 0.62, 0.7, 0.04, 1), wood('#b48650'), m4(0, 0.3, 0));
  for (const z of [0.355, -0.355])
    for (const y of [0.1, 0.3, 0.5])
      k.add(
        'matte',
        new THREE.BoxGeometry(0.96, 0.03, 0.02),
        '#8a6038',
        m4(0, y, z),
      );
  for (const x of [0.5, -0.5])
    for (const z of [0.33, -0.33])
      k.add(
        'matte',
        new THREE.BoxGeometry(0.07, 0.64, 0.07),
        '#9a6c40',
        m4(x, 0.31, z),
      );
  if (fill)
    for (let j = 0; j < 9; j++)
      k.add(
        fillKey,
        ball(2),
        lit(fill, 0.35, 0.05),
        m4(
          -0.3 + (j % 3) * 0.3 + (rand() - 0.5) * 0.06,
          0.64 + rand() * 0.05,
          -0.2 + Math.floor(j / 3) * 0.2,
          0,
          0,
          0,
          0.15,
        ),
      );
  return k.ground(0.15, 0.3);
}

// ——— Food: Orchard and Pumpkin ———

/** An apple tree: a flared, bent trunk with roots, a crown of overlapping
 * leafy lobes (dark inside, sunlit on top) and glossy apples. */
function appleTree(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const bark = then(grad('#46301f', '#7d5535', -0.05, 0.55), (p, _n, c) =>
    c.multiplyScalar(0.9 + 0.12 * tone.noise3d(p.x * 30, p.y * 5, p.z * 30)),
  );
  const trunk = weld(
    lathe(
      [
        [0.15, -0.1],
        [0.14, 0],
        [0.1, 0.07],
        [0.085, 0.22],
        [0.077, 0.42],
        [0.068, 0.6],
        [0, 0.63],
      ],
      14,
    ),
  );
  warp(trunk, (v) => {
    v.x += 0.07 * Math.max(0, v.y / 0.6) ** 2;
  });
  k.add('matte', trunk, bark);
  for (let j = 0; j < 4; j++) {
    const a = (j / 4) * TAU + rand() * 0.6;
    k.add(
      'matte',
      ball(2),
      bark,
      aim(
        v3(Math.cos(a) * 0.09, 0.0, Math.sin(a) * 0.09),
        v3(Math.cos(a), -0.45, Math.sin(a)),
        [0.045, 0.13, 0.035],
      ),
    );
  }
  const lobes: { c: V3; r: number }[] = [{ c: v3(0.07, 0.9, 0), r: 0.4 }];
  for (let j = 0; j < 5; j++) {
    const a = (j / 5) * TAU + rand() * 0.5;
    lobes.push({
      c: v3(0.07 + Math.cos(a) * 0.3, 0.77 + rand() * 0.18, Math.sin(a) * 0.3),
      r: 0.25 + rand() * 0.06,
    });
  }
  lobes.push({ c: v3(0.05, 1.14, 0.02), r: 0.27 });
  const fork = v3(0.07, 0.5, 0);
  for (const l of lobes.slice(1, 4))
    k.add('matte', beam(fork, l.c.clone().lerp(fork, 0.3), 0.05, 6), bark);
  const dark = col('#2a6430');
  const mid = col('#4c9a3e');
  const top = col('#93d35c');
  const foliage: Paint = (p, n, c) => {
    c.copy(dark)
      .lerp(mid, smooth(0.5, 0.95, p.y))
      .lerp(top, smooth(0.9, 1.38, p.y) * 0.85);
    c.multiplyScalar(
      0.82 +
        0.22 * (0.5 + 0.5 * n.y) +
        0.12 * tone.noise3d(p.x * 9, p.y * 9, p.z * 9),
    );
  };
  lobes.forEach((l, j) =>
    k.add(
      'matte',
      blob(j === 0 || j === lobes.length - 1 ? 5 : 4, 0.1, seed * 7 + j, 2.6),
      foliage,
      m4(l.c.x, l.c.y, l.c.z, rand(), rand(), 0, [l.r, l.r * 0.9, l.r]),
    ),
  );
  // Leafy tufts break up the outline.
  for (let j = 0; j < 10; j++) {
    const l = lobes[1 + Math.floor(rand() * (lobes.length - 1))];
    const d = randomDir(rand);
    d.y = Math.abs(d.y) * 0.8 + 0.1;
    d.normalize();
    const at = l.c.clone().addScaledVector(d, l.r * 0.86);
    k.add(
      'matte',
      blob(2, 0.12, seed + 40 + j),
      foliage,
      m4(at.x, at.y, at.z, 0, 0, 0, 0.085 + rand() * 0.05),
    );
  }
  // Apples on the outside of the crown, a couple fallen in the grass.
  const apple = warp(ball(2), (v) => {
    const r = Math.hypot(v.x, v.z);
    v.y = v.y * 0.9 - 0.2 * Math.max(0, 1 - r * 2.4) * Math.sign(v.y);
  });
  const red = col('#c9302a');
  const shine = col('#ff7050');
  const applePaint: Paint = (_p, n, c) => {
    c.copy(red).lerp(shine, smooth(-0.2, 0.9, n.y) * 0.7);
  };
  let placed = 0;
  for (let tries = 0; placed < 9 && tries < 300; tries++) {
    const l = lobes[Math.floor(rand() * lobes.length)];
    const d = randomDir(rand);
    if (d.y > 0.6) continue;
    const at = l.c.clone().addScaledVector(d, l.r * 0.98);
    if (lobes.some((o) => o !== l && o.c.distanceTo(at) < o.r * 0.97)) continue;
    const m = aim(at, v3(d.x * 0.3, 1, d.z * 0.3), 0.068, rand() * 6);
    k.add('gloss', apple, applePaint, m);
    k.add('matte', beam(v3(0, 0.6, 0), v3(0.1, 1.3, 0), 0.12), '#5a3a20', m);
    placed++;
  }
  for (let j = 0; j < 1; j++) {
    const a = rand() * TAU;
    const r = 0.3 + rand() * 0.15;
    k.add(
      'gloss',
      apple,
      applePaint,
      m4(Math.cos(a) * r, 0.05, Math.sin(a) * r, 1.2, a, 0.4, 0.065),
    );
  }
  return k.ground(0.3, 0.35);
}

/** A glasshouse: a ribbed glass dome on a stone plinth, a glazed porch with a
 * door, and two planter beds of lettuces and tomato plants inside. */
function greenhouse(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const R = 0.55;
  const Y0 = 0.07;
  k.add(
    'matte',
    lathe(
      [
        [0, -0.16],
        [0.6, -0.16],
        [0.63, 0],
        [0.61, Y0],
        [0, Y0],
      ],
      40,
    ),
    grad('#b3a993', '#efe8d8', -0.1, Y0),
  );
  k.add(
    'glass',
    new THREE.SphereGeometry(R, 40, 14, 0, TAU, 0, Math.PI / 2),
    '#e4f6ff',
    m4(0, Y0, 0),
  );
  const white = lit('#f4f1ea', 0.3, 0);
  for (let j = 0; j < 6; j++)
    k.add(
      'satin',
      new THREE.TorusGeometry(R + 0.004, 0.012, 5, 28, Math.PI),
      white,
      m4(0, Y0, 0, 0, (j / 6) * Math.PI, 0),
    );
  for (const y of [0.17, 0.33, 0.45]) {
    const r = Math.sqrt((R + 0.004) ** 2 - y * y);
    k.add(
      'satin',
      new THREE.TorusGeometry(r, 0.01, 5, 40),
      white,
      m4(0, Y0 + y, 0, Math.PI / 2, 0, 0),
    );
  }
  k.add(
    'satin',
    new THREE.TorusGeometry(R + 0.008, 0.024, 6, 48),
    white,
    m4(0, Y0 + 0.01, 0, Math.PI / 2, 0, 0),
  );
  k.add(
    'satin',
    new THREE.CylinderGeometry(0.07, 0.1, 0.06, 16),
    white,
    m4(0, Y0 + R - 0.01, 0),
  );
  k.add('satin', ball(2), white, m4(0, Y0 + R + 0.06, 0, 0, 0, 0, 0.035));
  // The porch.
  const fx = 0.13;
  const y1 = Y0 + 0.33;
  const z0 = R - 0.12;
  const z1 = R + 0.12;
  k.add(
    'glass',
    new THREE.BoxGeometry(fx * 2, 0.33, z1 - z0),
    '#e4f6ff',
    m4(0, Y0 + 0.165, (z0 + z1) / 2),
  );
  for (const x of [-fx, fx]) {
    k.add('satin', beam(v3(x, Y0, z1), v3(x, y1, z1), 0.026), white);
    k.add('satin', beam(v3(x, y1, z0), v3(x, y1, z1), 0.026), white);
    k.add(
      'satin',
      beam(v3(x, Y0 + 0.17, z0), v3(x, Y0 + 0.17, z1), 0.016),
      white,
    );
  }
  k.add('satin', beam(v3(-fx, y1, z1), v3(fx, y1, z1), 0.026), white);
  k.add(
    'satin',
    rbox(fx * 2 + 0.05, 0.03, z1 - z0 + 0.04, 0.01),
    white,
    m4(0, y1 + 0.02, (z0 + z1) / 2),
  );
  k.add(
    'satin',
    rbox(0.15, 0.27, 0.012, 0.004),
    '#d9eef5',
    m4(0, Y0 + 0.135, z1 + 0.004),
  );
  for (const x of [-0.075, 0.075])
    k.add(
      'satin',
      beam(v3(x, Y0, z1 + 0.01), v3(x, Y0 + 0.27, z1 + 0.01), 0.018),
      white,
    );
  k.add(
    'satin',
    beam(
      v3(-0.075, Y0 + 0.27, z1 + 0.01),
      v3(0.075, Y0 + 0.27, z1 + 0.01),
      0.018,
    ),
    white,
  );
  k.add(
    'metal',
    ball(1),
    '#d9b44a',
    m4(0.05, Y0 + 0.13, z1 + 0.02, 0, 0, 0, 0.014),
  );
  // Planter beds.
  for (const x of [-0.21, 0.21]) {
    k.add(
      'satin',
      rbox(0.16, 0.1, 0.6, 0.02),
      grad('#6b4329', '#9a6640', Y0, Y0 + 0.12),
      m4(x, Y0 + 0.05, -0.04),
    );
    k.add(
      'matte',
      new THREE.BoxGeometry(0.13, 0.01, 0.56),
      '#4a3222',
      m4(x, Y0 + 0.1, -0.04),
    );
    for (let j = 0; j < 5; j++) {
      const z = -0.28 + j * 0.12;
      if ((j + (x > 0 ? 1 : 0)) % 2) {
        for (let q = 0; q < 6; q++) {
          const a = (q / 6) * TAU + rand();
          k.add(
            'leaf',
            leafGeo(0.075, 0.065, 0.6, 0.3, 3),
            lit('#6cc04a', 0.35, 0.05),
            aim(
              v3(x, Y0 + 0.1, z),
              v3(Math.cos(a), 1.1, Math.sin(a)),
              1,
              rand() * 6,
            ),
          );
        }
        k.add('matte', ball(1), '#9ee06a', m4(x, Y0 + 0.125, z, 0, 0, 0, 0.03));
      } else {
        k.add(
          'matte',
          beam(v3(x, Y0 + 0.1, z), v3(x, Y0 + 0.34, z), 0.008),
          '#a07850',
        );
        k.add(
          'matte',
          blob(2, 0.22, j + seed),
          lit('#3f8f3a', 0.35, 0.05),
          m4(x, Y0 + 0.23, z, 0, 0, 0, [0.055, 0.09, 0.055]),
        );
        for (let q = 0; q < 3; q++)
          k.add(
            'gloss',
            ball(1),
            q % 2 ? '#e8463a' : '#f2a43a',
            m4(
              x + (rand() - 0.5) * 0.08,
              Y0 + 0.17 + rand() * 0.12,
              z + (rand() - 0.5) * 0.08,
              0,
              0,
              0,
              0.024,
            ),
          );
      }
    }
  }
  for (let j = 0; j < 3; j++)
    k.add(
      'matte',
      new THREE.CylinderGeometry(0.055, 0.06, 0.03, 10),
      lit('#b9b2a6', 0.3),
      m4((rand() - 0.5) * 0.06, 0.005, z1 + 0.12 + j * 0.13, 0, rand(), 0),
    );
  return k.ground(0.12, 0.25);
}

/** A round hay bale with rounded edges, a rolled spiral on each face and
 * two bands of twine. Lies along x, resting on the ground. */
function hayBale() {
  const k = new Kit();
  const body = weld(
    lathe(
      [
        [0, -0.21],
        [0.2, -0.21],
        [0.27, -0.2],
        [0.3, -0.16],
        [0.3, 0.16],
        [0.27, 0.2],
        [0.2, 0.21],
        [0, 0.21],
      ],
      30,
    ),
  );
  const straw = then(grad('#c9a03e', '#f0d277', 0.05, 0.6), (p, _n, c) =>
    c.multiplyScalar(0.92 + 0.1 * tone.noise3d(p.x * 3, p.y * 40, p.z * 40)),
  );
  k.add('matte', body, straw, m4(0, 0.3, 0, 0, 0, Math.PI / 2));
  for (const s of [1, -1]) {
    const pts: V3[] = [];
    for (let t = 0; t <= 1; t += 1 / 48) {
      const a = t * TAU * 3;
      const r = 0.02 + t * 0.22;
      pts.push(v3(s * 0.213, 0.3 + Math.sin(a) * r, Math.cos(a) * r));
    }
    k.add('matte', tube(pts, 0.008, 72, 4), '#b48a34');
  }
  for (const x of [-0.09, 0.09])
    k.add(
      'matte',
      new THREE.TorusGeometry(0.303, 0.009, 4, 40),
      '#7a5a32',
      m4(x, 0.3, 0, 0, Math.PI / 2, 0),
    );
  return k.ground(0.12, 0.3);
}

/** A barn: plank walls with battens under a gambrel roof with shingle
 * courses, white trim, a braced double door, a hayloft with a hoist, side
 * windows and a weathervane; a ribbed silo with a ladder beside it, a fence,
 * a trough and two hay bales. */
function barn(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const W = 0.4;
  const D = 0.46;
  const E = 0.42;
  const M: [number, number] = [0.29, 0.66];
  const R = 0.8;
  const prof: [number, number][] = [
    [-W, 0],
    [W, 0],
    [W, E],
    M,
    [0, R],
    [-M[0], M[1]],
    [-W, E],
  ];
  const walls = new THREE.ExtrudeGeometry(
    new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y))),
    { depth: 2 * D, bevelEnabled: false, curveSegments: 1 },
  );
  walls.translate(0, 0, -D);
  k.add('matte', walls, lit('#c2443a', 0.15, 0.04));
  const batten = lit('#a5352e', 0.15, 0.03);
  const topAt = (x: number) => {
    const a = Math.abs(x);
    return a <= M[0]
      ? R - (R - M[1]) * (a / M[0])
      : M[1] - (M[1] - E) * ((a - M[0]) / (W - M[0]));
  };
  for (const z of [D, -D])
    for (let x = -0.36; x <= 0.361; x += 0.072) {
      if (z > 0 && Math.abs(x) < 0.2) continue;
      const y1 = topAt(x) - 0.025;
      k.add(
        'matte',
        new THREE.BoxGeometry(0.02, y1, 0.012),
        batten,
        m4(x, y1 / 2, z + Math.sign(z) * 0.006),
      );
    }
  for (const x of [W, -W])
    for (let z = -0.4; z <= 0.401; z += 0.08)
      k.add(
        'matte',
        new THREE.BoxGeometry(0.012, E - 0.02, 0.02),
        batten,
        m4(x + Math.sign(x) * 0.006, E / 2, z),
      );
  k.add(
    'matte',
    rbox(0.88, 0.16, 1.0, 0.03),
    lit('#a39d92', 0.3, 0.08),
    m4(0, -0.05, 0),
  );
  const white = lit('#f6efe2', 0.2, 0.02);
  for (const sx of [1, -1])
    for (const sz of [1, -1])
      k.add(
        'satin',
        beam(
          v3(sx * (W + 0.008), 0, sz * (D + 0.008)),
          v3(sx * (W + 0.008), E, sz * (D + 0.008)),
          0.042,
        ),
        white,
      );
  const line: [number, number][] = [[W, E], M, [0, R], [-M[0], M[1]], [-W, E]];
  for (const sz of [1, -1])
    for (let j = 0; j < line.length - 1; j++)
      k.add(
        'satin',
        beam(
          v3(line[j][0], line[j][1], sz * (D + 0.014)),
          v3(line[j + 1][0], line[j + 1][1], sz * (D + 0.014)),
          0.036,
        ),
        white,
      );
  // Roof: four slabs with shingle courses and a ridge cap.
  const roof = then(grad('#4b382f', '#7a5a48', E, R + 0.05), (p, _n, c) =>
    c.multiplyScalar(0.94 + 0.06 * tone.noise3d(p.x * 20, p.y * 20, p.z * 20)),
  );
  const segs: [number, number, number, number][] = [
    [W, E, M[0], M[1]],
    [M[0], M[1], 0, R],
  ];
  for (const s of [1, -1])
    for (const [x0, y0, x1, y1] of segs) {
      const a = v3(s * x0, y0);
      const b = v3(s * x1, y1);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const out = v3(b.y - a.y, -(b.x - a.x)).normalize();
      if (out.dot(mid.clone().sub(v3(0, 0.4))) < 0) out.negate();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      k.add(
        'satin',
        rbox(a.distanceTo(b) + 0.07, 0.045, 2 * D + 0.12, 0.012),
        roof,
        m4(mid.x + out.x * 0.022, mid.y + out.y * 0.022, 0, 0, 0, ang),
      );
      for (const f of [0.15, 0.4, 0.65, 0.9]) {
        const q = a.clone().lerp(b, f).addScaledVector(out, 0.046);
        k.add(
          'satin',
          new THREE.BoxGeometry(0.014, 0.012, 2 * D + 0.1),
          '#3c2b24',
          m4(q.x, q.y, 0, 0, 0, ang),
        );
      }
    }
  k.add(
    'satin',
    new THREE.CylinderGeometry(0.03, 0.03, 2 * D + 0.14, 10),
    '#3a2a23',
    m4(0, R + 0.035, 0, Math.PI / 2, 0, 0),
  );
  // The braced double door.
  const dz = D + 0.01;
  for (const s of [-1, 1]) {
    k.add(
      'satin',
      rbox(0.165, 0.38, 0.02, 0.006),
      lit('#b23a31', 0.15, 0.03),
      m4(s * 0.0875, 0.19, dz),
    );
    const x0 = s * 0.012;
    const x1 = s * 0.163;
    for (const [a, b] of [
      [v3(x0, 0.02), v3(x1, 0.02)],
      [v3(x0, 0.37), v3(x1, 0.37)],
      [v3(x1, 0.02), v3(x1, 0.37)],
      [v3(x0, 0.02), v3(x0, 0.37)],
      [v3(x0, 0.03), v3(x1, 0.36)],
      [v3(x1, 0.03), v3(x0, 0.36)],
    ])
      k.add(
        'satin',
        beam(a.setZ(dz + 0.014), b.setZ(dz + 0.014), 0.022),
        white,
      );
    k.add(
      'metal',
      ball(1),
      '#2e2e2e',
      m4(s * 0.03, 0.2, dz + 0.03, 0, 0, 0, 0.012),
    );
  }
  for (const s of [-1, 1])
    k.add(
      'satin',
      beam(v3(s * 0.19, 0, dz + 0.006), v3(s * 0.19, 0.415, dz + 0.006), 0.036),
      white,
    );
  k.add(
    'satin',
    beam(v3(-0.205, 0.41, dz + 0.006), v3(0.205, 0.41, dz + 0.006), 0.036),
    white,
  );
  // Hayloft and hoist.
  k.add(
    'matte',
    new THREE.BoxGeometry(0.17, 0.15, 0.02),
    '#2a1a12',
    m4(0, 0.585, D + 0.002),
  );
  k.add(
    'matte',
    blob(2, 0.3, 3),
    '#e9c25a',
    m4(0, 0.53, D + 0.005, 0, 0, 0, [0.075, 0.035, 0.025]),
  );
  for (const [a, b] of [
    [v3(-0.1, 0.5), v3(0.1, 0.5)],
    [v3(-0.1, 0.67), v3(0.1, 0.67)],
    [v3(-0.095, 0.5), v3(-0.095, 0.67)],
    [v3(0.095, 0.5), v3(0.095, 0.67)],
  ])
    k.add('satin', beam(a.setZ(D + 0.012), b.setZ(D + 0.012), 0.028), white);
  k.add(
    'matte',
    rbox(0.04, 0.04, 0.2, 0.01),
    wood(),
    m4(0, R - 0.035, D + 0.08),
  );
  k.add(
    'metal',
    new THREE.TorusGeometry(0.022, 0.007, 4, 12),
    '#555',
    m4(0, R - 0.085, D + 0.16, 0, Math.PI / 2, 0),
  );
  k.add(
    'matte',
    beam(v3(0, R - 0.1, D + 0.16), v3(0, 0.66, D + 0.16), 0.006),
    '#c9b28a',
  );
  // Side windows.
  for (const sx of [1, -1])
    for (const z of [-0.2, 0.2]) {
      k.add(
        'satin',
        rbox(0.03, 0.15, 0.15, 0.008),
        white,
        m4(sx * (W + 0.012), 0.25, z),
      );
      k.add(
        'satin',
        new THREE.BoxGeometry(0.034, 0.11, 0.11),
        '#2f4a66',
        m4(sx * (W + 0.012), 0.25, z),
      );
      k.add(
        'satin',
        new THREE.BoxGeometry(0.038, 0.11, 0.012),
        white,
        m4(sx * (W + 0.012), 0.25, z),
      );
      k.add(
        'satin',
        new THREE.BoxGeometry(0.038, 0.012, 0.11),
        white,
        m4(sx * (W + 0.012), 0.25, z),
      );
    }
  // Weathervane.
  const iron = lit('#2f3236', 0.3, 0);
  k.add(
    'steel',
    beam(v3(0, R + 0.04, 0.2), v3(0, R + 0.27, 0.2), 0.012, 6),
    iron,
  );
  k.add(
    'steel',
    new THREE.BoxGeometry(0.014, 0.014, 0.2),
    iron,
    m4(0, R + 0.21, 0.2, 0, 0.6, 0),
  );
  k.add(
    'steel',
    new THREE.ConeGeometry(0.02, 0.05, 4),
    iron,
    m4(
      Math.sin(0.6) * 0.1,
      R + 0.21,
      0.2 + Math.cos(0.6) * 0.1,
      Math.PI / 2,
      0,
      0,
    ),
  );
  k.add('steel', ball(1), '#c9a24a', m4(0, R + 0.28, 0.2, 0, 0, 0, 0.02));
  // The silo.
  const sx = 0.66;
  const sz = -0.14;
  const SR = 0.19;
  const shell = warp(
    new THREE.CylinderGeometry(SR, SR, 1, 56, 1, true),
    (v) => {
      const a = Math.atan2(v.z, v.x);
      const f = 1 + 0.025 * Math.cos(a * 28);
      v.x *= f;
      v.z *= f;
    },
  );
  k.add(
    'steel',
    shell,
    then(lit('#d5dbe0', 0.2, 0.03), (p, _n, c) =>
      c.multiplyScalar(0.8 + 0.2 * smooth(0, 0.6, p.y)),
    ),
    m4(sx, 0.45, sz),
  );
  k.add(
    'steel',
    new THREE.SphereGeometry(SR + 0.006, 28, 8, 0, TAU, 0, Math.PI / 2),
    lit('#aab4bc', 0.3),
    m4(sx, 0.95, sz),
  );
  k.add('steel', ball(1), '#8e979e', m4(sx, 0.95 + SR, sz, 0, 0, 0, 0.035));
  for (const y of [0.12, 0.32, 0.52, 0.72, 0.9])
    k.add(
      'steel',
      new THREE.TorusGeometry(SR + 0.012, 0.01, 4, 40),
      '#8a939a',
      m4(sx, y, sz, Math.PI / 2, 0, 0),
    );
  k.add(
    'matte',
    new THREE.CylinderGeometry(SR + 0.04, SR + 0.05, 0.08, 28),
    lit('#a39d92', 0.3),
    m4(sx, -0.01, sz),
  );
  const lz = sz + SR + 0.03;
  for (const dx of [-0.045, 0.045])
    k.add(
      'steel',
      beam(v3(sx + dx, 0.02, lz), v3(sx + dx, 0.96, lz), 0.012),
      '#5d656c',
    );
  for (let y = 0.08; y < 0.95; y += 0.07)
    k.add(
      'steel',
      beam(v3(sx - 0.045, y, lz), v3(sx + 0.045, y, lz), 0.008),
      '#5d656c',
    );
  // Yard: a fence, a trough and two bales.
  k.put(fence(2.2), m4(-0.6, 0, 0.0, 0, Math.PI / 2, 0, 0.2));
  k.add('matte', rbox(0.12, 0.08, 0.26, 0.015), wood(), m4(-0.5, 0.04, 0.2));
  k.add(
    'gloss',
    new THREE.BoxGeometry(0.09, 0.01, 0.23),
    '#5aa8d8',
    m4(-0.5, 0.079, 0.2),
  );
  k.put(hayBale(), m4(0.24, 0, 0.72, 0, 0.3 + rand() * 0.3, 0, 0.32));
  k.put(hayBale(), m4(0.5, 0, 0.6, 0, 1.3, 0, 0.29));
  return k.ground(0.15, 0.3);
}

/** A ribbed pumpkin with a twisted stem, a curling tendril, two big leaves
 * on the ground, a vine and two little pumpkins beside it. */
function pumpkin(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const tall = seed % 2 === 1;
  const shapeOf = (ws: number, hs: number, squash: number) =>
    warp(weld(new THREE.SphereGeometry(0.5, ws, hs)), (v) => {
      const a = Math.atan2(v.z, v.x);
      const f = Math.abs(Math.cos(a * 5));
      const r = Math.hypot(v.x, v.z);
      const s = 0.89 + 0.11 * Math.pow(f, 0.35);
      v.x *= s;
      v.z *= s;
      v.y *= squash;
      if (v.y > 0) v.y -= 0.1 * Math.max(0, 1 - r / 0.24) ** 2;
      else v.y += 0.04 * Math.max(0, 1 - r / 0.3) ** 2;
    });
  const orange = col('#f28a26');
  const deep = col('#b9501a');
  const hi = col('#ffc464');
  const skin =
    (cy: number): Paint =>
    (p, n, c) => {
      const f = Math.pow(Math.abs(Math.cos(Math.atan2(p.z, p.x) * 5)), 0.5);
      c.copy(deep)
        .lerp(orange, 0.3 + 0.7 * f)
        .lerp(hi, smooth(0.3, 1, n.y) * 0.45 * f);
      c.multiplyScalar(0.78 + 0.22 * smooth(0, cy, p.y));
    };
  const squash = tall ? 0.9 : 0.72;
  const cy = 0.5 * squash;
  k.add('gloss', shapeOf(40, 22, squash), skin(cy), m4(0, cy, 0));
  const top = cy + 0.5 * squash - 0.1;
  const stem = warp(new THREE.CylinderGeometry(0.03, 0.055, 0.2, 8, 5), (v) => {
    const t = (v.y + 0.1) / 0.2;
    const a = Math.atan2(v.z, v.x);
    const s = 1 + 0.15 * Math.cos(a * 6 + t * 3);
    v.x = v.x * s + 0.12 * t * t;
    v.z *= s;
  });
  k.add(
    'matte',
    stem,
    grad('#4f6a2a', '#a89a5a', top, top + 0.2),
    m4(0, top + 0.09, 0, 0, rand() * 6, 0),
  );
  const curl: V3[] = [];
  for (let t = 0; t <= 1; t += 1 / 24) {
    const a = t * TAU * 2;
    curl.push(
      v3(
        -0.05 - t * 0.12 + Math.cos(a) * 0.05,
        top + 0.02 + Math.sin(a * 0.5) * 0.04,
        Math.sin(a) * 0.05,
      ),
    );
  }
  k.add('matte', tube(curl, 0.008, 40, 4), '#6f9a3a');
  const leafPaint = then(lit('#4f8f34', 0.35, 0.06), (p, _n, c) =>
    c.lerp(col('#7ab84a'), 0.3 * smooth(0.1, 0.4, Math.hypot(p.x, p.z) - 0.3)),
  );
  for (let j = 0; j < 2; j++) {
    const a = rand() * TAU;
    k.add(
      'leaf',
      leafGeo(0.42, 0.38, 0.25, 0, 6).rotateX(-Math.PI / 2),
      leafPaint,
      m4(-Math.sin(a) * 0.28, 0.03, -Math.cos(a) * 0.28, 0, a, 0),
    );
  }
  const b0 = rand() * TAU;
  const vine: V3[] = [];
  for (let t = 0; t <= 1.6; t += 0.1)
    vine.push(
      v3(
        Math.cos(b0 + t) * (0.32 + t * 0.35),
        0.02,
        Math.sin(b0 + t) * (0.32 + t * 0.35),
      ),
    );
  k.add('matte', tube(vine, 0.016, 24, 5), '#5d8a32');
  const little = shapeOf(22, 12, 0.75);
  for (let j = 0; j < 2; j++) {
    const a = b0 + 0.6 + j * 0.7;
    const r = 0.62 + j * 0.15;
    const s = 0.34 - j * 0.08;
    k.add(
      'gloss',
      little,
      skin(0.5 * 0.75 * s),
      m4(Math.cos(a) * r, 0.5 * 0.75 * s, Math.sin(a) * r, 0, rand() * 6, 0, s),
    );
  }
  return k.ground(0.14, 0.3);
}

/** A sunflower: a curved stem with heart leaves, and a big drooping head of
 * two rings of cupped petals round a domed seed disc. */
function sunflower(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const stemPts = [
    v3(0, -0.02, 0),
    v3(0.02, 0.35, 0),
    v3(-0.015, 0.7, 0.01),
    v3(0, 1.04, 0.03),
  ];
  k.add('matte', tube(stemPts, 0.03, 16, 7), grad('#3d7a2c', '#5a9a3c', 0, 1));
  const leaf = lit('#4f9a38', 0.35, 0.05);
  for (const [y, a] of [
    [0.3, 0.4],
    [0.55, 2.6],
    [0.78, 4.6],
  ]) {
    const at = v3(0.01, y, 0);
    k.add(
      'leaf',
      leafGeo(0.3, 0.22, 0.35, 0.3, 5),
      leaf,
      aim(at, v3(Math.cos(a), 0.7, Math.sin(a)), 1, rand() * 6),
    );
  }
  const head = new Kit();
  head.add(
    'matte',
    lathe(
      [
        [0, -0.06],
        [0.08, -0.055],
        [0.15, -0.025],
        [0.17, 0.005],
      ],
      20,
    ).rotateX(Math.PI / 2),
    lit('#4f8a34', 0.3),
    undefined,
  );
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * TAU;
    head.add(
      'leaf',
      leafGeo(0.07, 0.045, 0.3, 0, 3),
      '#5e9a3e',
      aim(
        v3(Math.cos(a) * 0.13, Math.sin(a) * 0.13, -0.03),
        v3(Math.cos(a), Math.sin(a), -0.35),
      ),
    );
  }
  const petal = (
    len: number,
    z: number,
    lean: number,
    off: number,
    n: number,
    inner: string,
    outer: string,
  ) => {
    const ci = col(inner);
    const co = col(outer);
    for (let j = 0; j < n; j++) {
      const a = ((j + off) / n) * TAU;
      head.add(
        'leaf',
        leafGeo(len, len * 0.4, 0.4, -0.08, 5),
        (p, _n, c) => {
          c.copy(ci).lerp(co, smooth(0.12, 0.12 + len, Math.hypot(p.x, p.y)));
        },
        aim(
          v3(Math.cos(a) * 0.12, Math.sin(a) * 0.12, z),
          v3(Math.cos(a), Math.sin(a), lean),
        ),
      );
    }
  };
  petal(0.18, -0.005, 0.05, 0, 16, '#f0a018', '#ffd23a');
  petal(0.15, 0.01, 0.22, 0.5, 16, '#f6b01e', '#ffe05a');
  const disc = warp(new THREE.RingGeometry(0, 0.14, 40, 8), (v) => {
    const r = Math.hypot(v.x, v.y) / 0.14;
    v.z = 0.035 * (1 - r * r) + 0.012;
  });
  const dc = [col('#3a2210'), col('#6a4220'), col('#2e1a0c')];
  head.add('satin', disc, (p, _n, c) => {
    const r = Math.hypot(p.x, p.y) / 0.14;
    c.copy(dc[0])
      .lerp(dc[1], smooth(0.1, 0.5, r))
      .lerp(dc[2], smooth(0.7, 1, r));
    c.multiplyScalar(
      0.85 + 0.25 * (0.5 + 0.5 * Math.sin(Math.atan2(p.y, p.x) * 21 + r * 30)),
    );
  });
  k.put(head, m4(0, 1.07, 0.06, 0.3, 0, 0));
  return k.ground(0.2, 0.3);
}

/** A scarecrow: a post and crossbar in a plaid shirt with straw hands, a
 * pumpkin head with a carved face, a straw hat, and a crow on one arm. */
function scarecrow() {
  const k = new Kit();
  k.add('matte', beam(v3(0, -0.05, 0), v3(0, 1.0, 0), 0.06), wood('#7a5636'));
  k.add(
    'matte',
    beam(v3(-0.36, 0.72, 0), v3(0.36, 0.72, 0), 0.05),
    wood('#7a5636'),
  );
  const plaid: Paint = (p, n, c) => {
    const stripe =
      (0.5 + 0.5 * Math.sin(p.x * 60)) * (0.5 + 0.5 * Math.sin(p.y * 60));
    c.set('#b8433a').lerp(col('#7a2622'), stripe * 0.6);
    c.multiplyScalar(0.85 + 0.15 * (0.5 + 0.5 * n.y));
  };
  k.add('satin', rbox(0.32, 0.34, 0.15, 0.05, 2), plaid, m4(0, 0.6, 0));
  for (const s of [1, -1]) {
    k.add(
      'satin',
      new THREE.CylinderGeometry(0.055, 0.07, 0.2, 10),
      plaid,
      m4(s * 0.24, 0.71, 0, 0, 0, (s * Math.PI) / 2),
    );
    for (let j = 0; j < 4; j++)
      k.add(
        'matte',
        new THREE.ConeGeometry(0.015, 0.1, 4),
        '#e2c062',
        aim(v3(s * 0.34, 0.71, 0), v3(s, (j - 1.5) * 0.4, (j % 2) * 0.3)),
      );
  }
  k.add('satin', rbox(0.3, 0.12, 0.13, 0.03), '#4a5f8a', m4(0, 0.38, 0));
  for (const s of [1, -1])
    k.add(
      'matte',
      new THREE.ConeGeometry(0.03, 0.12, 4),
      '#e2c062',
      m4(s * 0.1, 0.27, 0, Math.PI, 0, 0),
    );
  // Pumpkin head.
  const headGeo = warp(weld(new THREE.SphereGeometry(0.15, 24, 14)), (v) => {
    const f = Math.abs(Math.cos(Math.atan2(v.z, v.x) * 5));
    const s = 0.9 + 0.1 * Math.pow(f, 0.4);
    v.x *= s;
    v.z *= s;
    v.y *= 0.82;
  });
  k.add('gloss', headGeo, lit('#f08a24', 0.3), m4(0, 0.92, 0));
  for (const s of [1, -1])
    k.add(
      'glow',
      new THREE.ConeGeometry(0.025, 0.04, 3),
      '#ff9a2a',
      m4(s * 0.05, 0.95, 0.13, Math.PI / 2, 0, 0),
    );
  k.add('glow', rbox(0.1, 0.025, 0.02, 0.008), '#ff9a2a', m4(0, 0.87, 0.135));
  // Straw hat.
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.24, 0.24, 0.018, 24),
    lit('#d4ae55', 0.3),
    m4(0, 1.03, 0, 0.1, 0, 0.08),
  );
  k.add(
    'matte',
    lathe(
      [
        [0.11, 0],
        [0.105, 0.08],
        [0.06, 0.13],
        [0, 0.14],
      ],
      18,
    ),
    lit('#d4ae55', 0.3),
    m4(0, 1.03, 0, 0.1, 0, 0.08),
  );
  k.add(
    'satin',
    new THREE.CylinderGeometry(0.112, 0.112, 0.03, 18),
    '#7a2622',
    m4(0, 1.05, 0, 0.1, 0, 0.08),
  );
  // A crow on the arm.
  const crow = new Kit();
  crow.add(
    'satin',
    ball(2),
    lit('#22232a', 0.4),
    m4(0, 0.06, 0, 0, 0, 0, [0.045, 0.045, 0.07]),
  );
  crow.add(
    'satin',
    ball(2),
    lit('#22232a', 0.4),
    m4(0, 0.11, 0.05, 0, 0, 0, 0.032),
  );
  crow.add(
    'satin',
    new THREE.ConeGeometry(0.012, 0.04, 6),
    '#e2a63a',
    m4(0, 0.11, 0.09, Math.PI / 2, 0, 0),
  );
  crow.add(
    'satin',
    new THREE.BoxGeometry(0.04, 0.008, 0.06),
    '#22232a',
    m4(0, 0.07, -0.08, 0.3, 0, 0),
  );
  k.put(crow, m4(-0.28, 0.74, 0, 0, 0.6, 0));
  return k.ground(0.2, 0.3);
}

/** A tower windmill: a stone footing, a plastered tower with a wooden
 * gallery, doors and windows, a shingled cap with a finial, and four lattice
 * sails with cloth on their lower half (the sails turn; see `update`). */
function windmill(mats: Mats) {
  const k = new Kit();
  const stone = lit('#b5a893', 0.25, 0.08, 14);
  k.add(
    'matte',
    lathe(
      [
        [0, -0.14],
        [0.45, -0.14],
        [0.47, -0.02],
        [0.44, 0.05],
        [0, 0.05],
      ],
      32,
    ),
    stone,
  );
  const plaster = col('#f3e9d6');
  const footing = col('#b9ab96');
  k.add(
    'matte',
    weld(
      lathe(
        [
          [0.37, 0],
          [0.36, 0.13],
          [0.345, 0.15],
          [0.31, 0.45],
          [0.27, 0.8],
          [0.245, 1.0],
          [0, 1.0],
        ],
        28,
      ),
    ),
    (p, n, c) => {
      c.copy(footing).lerp(plaster, smooth(0.13, 0.15, p.y));
      c.multiplyScalar(
        0.88 +
          0.12 * (0.5 + 0.5 * n.y) +
          0.04 * tone.noise3d(p.x * 12, p.y * 12, p.z * 12),
      );
    },
  );
  const timber = wood('#7a5636');
  k.add(
    'satin',
    lathe(
      [
        [0.3, 0.43],
        [0.47, 0.43],
        [0.47, 0.465],
        [0.3, 0.465],
      ],
      32,
    ),
    timber,
  );
  for (let j = 0; j < 16; j++) {
    const a = (j / 16) * TAU;
    k.add(
      'satin',
      beam(
        v3(Math.cos(a) * 0.455, 0.46, Math.sin(a) * 0.455),
        v3(Math.cos(a) * 0.455, 0.6, Math.sin(a) * 0.455),
        0.016,
      ),
      timber,
    );
    if (j % 2 === 0)
      k.add(
        'satin',
        beam(
          v3(Math.cos(a) * 0.32, 0.33, Math.sin(a) * 0.32),
          v3(Math.cos(a) * 0.45, 0.43, Math.sin(a) * 0.45),
          0.02,
        ),
        timber,
      );
  }
  for (const y of [0.6, 0.53])
    k.add(
      'satin',
      new THREE.TorusGeometry(0.455, 0.011, 4, 48),
      timber,
      m4(0, y, 0, Math.PI / 2, 0, 0),
    );
  const door = wood('#6a4a30');
  k.add('matte', rbox(0.2, 0.3, 0.05, 0.03), stone, m4(0, 0.14, 0.345));
  k.add('satin', rbox(0.14, 0.24, 0.05, 0.03), door, m4(0, 0.12, 0.36));
  k.add('satin', rbox(0.12, 0.18, 0.04, 0.02), door, m4(0, 0.555, 0.305));
  for (const [x, y, z, ry] of [
    [0, 0.78, 0.262, 0],
    [0.29, 0.28, 0.03, Math.PI / 2],
    [-0.29, 0.28, 0.03, -Math.PI / 2],
    [0, 0.3, -0.33, Math.PI],
  ]) {
    k.add(
      'satin',
      rbox(0.1, 0.12, 0.03, 0.01),
      '#f9f6ee',
      m4(x, y, z, 0, ry, 0),
    );
    k.add(
      'satin',
      new THREE.BoxGeometry(0.07, 0.09, 0.034),
      '#34506a',
      m4(x, y, z, 0, ry, 0),
    );
  }
  const cap = grad('#8f3d2c', '#c25a40', 1.0, 1.35);
  k.add(
    'satin',
    weld(
      lathe(
        [
          [0.29, 0],
          [0.305, 0.04],
          [0.29, 0.12],
          [0.22, 0.25],
          [0.12, 0.34],
          [0.04, 0.39],
          [0, 0.4],
        ],
        28,
      ),
    ),
    cap,
    m4(0, 0.98, 0),
  );
  for (const [y, r] of [
    [1.06, 0.3],
    [1.15, 0.258],
    [1.24, 0.19],
  ])
    k.add(
      'satin',
      new THREE.TorusGeometry(r, 0.01, 4, 40),
      '#6e2c20',
      m4(0, y, 0, Math.PI / 2, 0, 0),
    );
  k.add('steel', beam(v3(0, 1.36, 0), v3(0, 1.52, 0), 0.016, 6), '#3a3a3a');
  k.add('metal', ball(2), '#d9b44a', m4(0, 1.45, 0, 0, 0, 0, 0.035));
  k.add(
    'satin',
    new THREE.CylinderGeometry(0.05, 0.065, 0.16, 12),
    timber,
    m4(0, 1.1, 0.3, Math.PI / 2, 0, 0),
  );
  // Flour sacks by the door.
  for (let j = 0; j < 3; j++)
    k.add(
      'matte',
      blob(2, 0.12, 60 + j),
      lit('#e9dcc0', 0.3, 0.05),
      m4(
        0.2 + j * 0.1,
        0.07 + (j === 2 ? 0.08 : 0),
        0.42 - (j === 2 ? 0.05 : 0),
        0,
        j,
        0,
        [0.07, 0.09, 0.06],
      ),
    );
  const sails = new Kit();
  for (let j = 0; j < 4; j++) {
    const s = new Kit();
    s.add(
      'satin',
      new THREE.BoxGeometry(0.045, 0.82, 0.035),
      timber,
      m4(0, 0.41, 0),
    );
    for (const x of [0.04, 0.21])
      s.add(
        'satin',
        new THREE.BoxGeometry(0.018, 0.62, 0.018),
        timber,
        m4(x, 0.48, 0),
      );
    for (let q = 0; q < 8; q++)
      s.add(
        'satin',
        new THREE.BoxGeometry(0.2, 0.014, 0.014),
        timber,
        m4(0.12, 0.18 + q * 0.083, 0),
      );
    const cloth = warp(new THREE.PlaneGeometry(0.16, 0.36, 3, 6), (v) => {
      v.z = -0.018 * Math.sin((v.x / 0.16 + 0.5) * Math.PI);
    });
    s.add('leaf', cloth, lit('#fff4dc', 0.2, 0.04), m4(0.125, 0.35, -0.013));
    sails.put(s, m4(0, 0, 0, 0, 0, (j * Math.PI) / 2));
  }
  sails.add('satin', ball(2), timber, m4(0, 0, 0.03, 0, 0, 0, 0.055));
  const blades = new THREE.Group();
  for (const m of sails.meshes(mats)) blades.add(m);
  blades.position.set(0, 1.1, 0.39);
  return {
    kit: k.ground(0.12, 0.25),
    moving: blades,
    update: (t: number) => (blades.rotation.z = -t * 1.6),
  };
}

// ——— Metal: Rust and Anvil ———

/** A mining headframe: four tapering steel legs with girts and X braces, a
 * back strut, a railed platform, a turning sheave wheel with its cables, a
 * winch house, and a rail track with an ore cart. */
function derrick(mats: Mats, ore: string) {
  const k = new Kit();
  const steel = lit('#3f4652', 0.3, 0.03);
  const brace = lit('#e2a63a', 0.3, 0.03);
  k.add(
    'matte',
    rbox(0.62, 0.16, 0.62, 0.03),
    lit('#9b968e', 0.3, 0.06),
    m4(0, -0.04, 0),
  );
  const w = (y: number) => 0.22 - 0.14 * (y / 1.22);
  const corner = (sx: number, sz: number, y: number) =>
    v3(sx * w(y), y, sz * w(y));
  const C: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [sx, sz] of C) {
    k.add(
      'steel',
      beam(corner(sx, sz, 0.02), corner(sx, sz, 1.24), 0.045),
      steel,
    );
    k.add(
      'steel',
      rbox(0.09, 0.05, 0.09, 0.01),
      steel,
      m4(sx * w(0.03), 0.03, sz * w(0.03)),
    );
  }
  const levels = [0.04, 0.34, 0.62, 0.9, 1.16];
  for (let i = 0; i < levels.length; i++)
    for (let f = 0; f < 4; f++) {
      const [ax, az] = C[f];
      const [bx, bz] = C[(f + 1) % 4];
      if (i > 0)
        k.add(
          'steel',
          beam(corner(ax, az, levels[i]), corner(bx, bz, levels[i]), 0.028),
          brace,
        );
      if (i < levels.length - 1) {
        const y0 = levels[i] + 0.02;
        const y1 = levels[i + 1] - 0.02;
        k.add(
          'steel',
          beam(corner(ax, az, y0), corner(bx, bz, y1), 0.017),
          brace,
        );
        k.add(
          'steel',
          beam(corner(bx, bz, y0), corner(ax, az, y1), 0.017),
          brace,
        );
      }
    }
  k.add('steel', rbox(0.36, 0.04, 0.36, 0.01), steel, m4(0, 1.25, 0));
  for (const [sx, sz] of C)
    k.add(
      'steel',
      beam(
        v3(sx * 0.17, 1.27, sz * 0.17),
        v3(sx * 0.17, 1.37, sz * 0.17),
        0.014,
      ),
      brace,
    );
  for (let f = 0; f < 4; f++) {
    const [ax, az] = C[f];
    const [bx, bz] = C[(f + 1) % 4];
    k.add(
      'steel',
      beam(
        v3(ax * 0.17, 1.37, az * 0.17),
        v3(bx * 0.17, 1.37, bz * 0.17),
        0.014,
      ),
      brace,
    );
  }
  // Back strut and its braces.
  for (const s of [1, -1]) {
    k.add(
      'steel',
      beam(v3(s * 0.07, 1.2, -0.08), v3(s * 0.15, 0.02, -0.52), 0.04),
      steel,
    );
    k.add(
      'steel',
      rbox(0.08, 0.05, 0.08, 0.01),
      steel,
      m4(s * 0.15, 0.025, -0.52),
    );
  }
  for (const y of [0.45, 0.85]) {
    const z = -0.08 - ((1.2 - y) / 1.18) * 0.44;
    const x = 0.07 + ((1.2 - y) / 1.18) * 0.08;
    k.add('steel', beam(v3(-x, y, z), v3(x, y, z), 0.022), brace);
    k.add('steel', beam(v3(-x, y, z), corner(-1, -1, y), 0.018), brace);
    k.add('steel', beam(v3(x, y, z), corner(1, -1, y), 0.018), brace);
  }
  // Sheave supports.
  for (const s of [1, -1]) {
    k.add(
      'steel',
      beam(v3(s * 0.045, 1.27, -0.12), v3(s * 0.045, 1.42, 0), 0.022),
      steel,
    );
    k.add(
      'steel',
      beam(v3(s * 0.045, 1.27, 0.12), v3(s * 0.045, 1.42, 0), 0.022),
      steel,
    );
    k.add(
      'steel',
      rbox(0.03, 0.05, 0.05, 0.01),
      '#2a2e35',
      m4(s * 0.045, 1.42, 0),
    );
  }
  const cable = '#2a2a2a';
  k.add('steel', beam(v3(0, 1.42, 0.2), v3(0, 0.08, 0.2), 0.009), cable);
  k.add('steel', beam(v3(0, 1.54, -0.16), v3(0, 0.27, -0.66), 0.009), cable);
  // Winch house.
  k.add(
    'steel',
    rbox(0.36, 0.3, 0.28, 0.02),
    then(lit('#8d97a3', 0.2, 0.02), (p, _n, c) =>
      c.multiplyScalar(0.92 + 0.08 * Math.sin(p.x * 120)),
    ),
    m4(0, 0.15, -0.72),
  );
  const roof = flat(
    new THREE.CylinderGeometry(0.21, 0.21, 0.32, 3).rotateX(-Math.PI / 2),
  );
  k.add('steel', roof, '#5b636e', m4(0, 0.358, -0.72, 0, 0, 0, [1, 0.55, 1]));
  k.add(
    'matte',
    rbox(0.02, 0.18, 0.1, 0.008),
    '#4b3a30',
    m4(0.185, 0.1, -0.72),
  );
  k.add(
    'glow',
    rbox(0.08, 0.06, 0.02, 0.008),
    '#ffcf6a',
    m4(0.08, 0.2, -0.575),
  );
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8),
    '#3a3f48',
    m4(-0.1, 0.42, -0.78),
  );
  k.add(
    'matte',
    new THREE.BoxGeometry(0.05, 0.05, 0.02),
    '#1d1d1d',
    m4(0, 0.27, -0.575),
  );
  // Rails and an ore cart.
  for (const x of [-0.06, 0.06])
    k.add(
      'steel',
      beam(v3(x, 0.02, 0.22), v3(x, 0.02, 0.78), 0.016),
      '#59606a',
    );
  for (let j = 0; j < 6; j++)
    k.add(
      'matte',
      rbox(0.2, 0.015, 0.035, 0.005),
      wood('#6b4a30'),
      m4(0, 0.008, 0.25 + j * 0.1),
    );
  k.add(
    'steel',
    lathe(
      [
        [0.0, 0.05],
        [0.07, 0.05],
        [0.1, 0.16],
        [0.095, 0.165],
        [0.0, 0.165],
      ],
      4,
    ),
    '#6d4c3a',
    m4(0, 0, 0.55, 0, Math.PI / 4, 0, [1.1, 1, 1.4]),
  );
  for (const x of [-0.075, 0.075])
    for (const z of [0.49, 0.61])
      k.add(
        'steel',
        new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12),
        '#2f3338',
        m4(x, 0.035, z, 0, 0, Math.PI / 2),
      );
  for (let j = 0; j < 4; j++)
    k.add(
      'facet',
      ball(0),
      lit(ore, 0.3),
      m4((j - 1.5) * 0.04, 0.17, 0.55 + (j % 2) * 0.04, j, j, 0, 0.045),
    );
  k.add('glow', ball(2), '#ff5a3a', m4(0.17, 1.4, 0.17, 0, 0, 0, 0.022));
  // The sheave wheel turns.
  const wk = new Kit();
  const shiny = lit('#d9dee5', 0.25, 0);
  wk.add(
    'metal',
    new THREE.TorusGeometry(0.2, 0.022, 8, 40),
    shiny,
    m4(0, 0, 0, 0, Math.PI / 2, 0),
  );
  wk.add(
    'metal',
    new THREE.TorusGeometry(0.17, 0.012, 6, 36),
    lit('#9aa3ad', 0.25),
    m4(0, 0, 0, 0, Math.PI / 2, 0),
  );
  wk.add(
    'metal',
    new THREE.CylinderGeometry(0.04, 0.04, 0.09, 12),
    shiny,
    m4(0, 0, 0, 0, 0, Math.PI / 2),
  );
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * TAU;
    wk.add(
      'metal',
      beam(v3(), v3(0, Math.sin(a) * 0.19, Math.cos(a) * 0.19), 0.018),
      shiny,
    );
  }
  const wheel = new THREE.Group();
  for (const m of wk.meshes(mats)) wheel.add(m);
  wheel.position.set(0, 1.42, 0);
  return {
    kit: k.ground(0.12, 0.3),
    moving: wheel,
    update: (t: number) => (wheel.rotation.x = t * 1.4),
  };
}

/** A crystalline nugget: a faceted prism with an off-centre point. */
function shardGeo(
  rand: () => number,
  sides: number,
  h: number,
  r: number,
  tip: number,
) {
  const pts: [number, number][] = [
    [r * 0.8, -0.12],
    [r, 0.02],
    [r * 1.05, h * 0.5],
    [r * 0.9, h],
    [r * 0.5, h + tip * 0.45],
    [0, h + tip],
  ];
  const g = lathe(pts, sides);
  const np = pts.length;
  const jit = Array.from({ length: sides }, () => 0.82 + rand() * 0.34);
  const lean = v3((rand() - 0.5) * r * 0.8, 0, (rand() - 0.5) * r * 0.8);
  return warp(g, (v, i) => {
    const seg = Math.floor(i / np) % sides;
    const row = i % np;
    if (row < np - 1) {
      v.x *= jit[seg];
      v.z *= jit[seg];
    }
    if (row >= 4) v.addScaledVector(lean, row === np - 1 ? 1 : 0.5);
  });
}

/** A heap of ore: a dark rock veined with metal, with bright crystalline
 * nuggets bursting out of it at varied angles. */
function oreCluster(seed: number, rockHex: string, metal: string) {
  const rand = seeded(seed);
  const k = new Kit();
  const base = col(rockHex);
  const vein = col(metal);
  const rockPaint: Paint = (p, n, c) => {
    c.copy(base).multiplyScalar(
      0.6 + 0.4 * smooth(-0.05, 0.4, p.y) + 0.1 * n.y,
    );
    const v = Math.abs(tone.noise3d(p.x * 5, p.y * 5, p.z * 5));
    c.lerp(vein, smooth(0.09, 0.02, v) * 0.85);
  };
  const r = warp(blob(3, 0.25, seed, 1.3), (v) => {
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3;
  });
  k.add(
    'matte',
    r,
    rockPaint,
    m4(0, 0.06, 0, 0, rand() * 6, 0, [0.46, 0.22, 0.42]),
  );
  const metalPaint = lit(metal, 0.35, 0.06);
  const n = 5 + Math.floor(rand() * 3);
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU + rand() * 0.6;
    const lean = j === 0 ? 0.15 : 0.35 + rand() * 0.55;
    const dir = v3(
      Math.cos(a) * Math.sin(lean),
      Math.cos(lean),
      Math.sin(a) * Math.sin(lean),
    );
    const d = j ? 0.13 + rand() * 0.1 : 0;
    const at = v3(Math.cos(a) * d, 0.1, Math.sin(a) * d);
    const h = j === 0 ? 0.3 : 0.12 + rand() * 0.14;
    const rr = j === 0 ? 0.2 : 0.09 + rand() * 0.06;
    k.add(
      'facet',
      shardGeo(rand, 5 + (j % 3), h, rr, rr * 0.75),
      metalPaint,
      aim(at, dir),
    );
  }
  for (let j = 0; j < 4; j++) {
    const a = rand() * TAU;
    k.add(
      'facet',
      ball(0),
      metalPaint,
      m4(
        Math.cos(a) * 0.55,
        0.03,
        Math.sin(a) * 0.55,
        rand(),
        rand(),
        0,
        0.05 + rand() * 0.04,
      ),
    );
    k.add(
      'matte',
      blob(1, 0.3, seed + j),
      rockPaint,
      m4(
        Math.cos(a + 1) * 0.5,
        0.02,
        Math.sin(a + 1) * 0.5,
        0,
        0,
        0,
        0.07 + rand() * 0.05,
      ),
    );
  }
  return k.ground(0.12, 0.25);
}

/** A domed mining base: a faceted pad with landing lights, a paneled dome
 * with a lit window band, a hatch, an antenna with a dish and a beacon, a
 * ribbed airlock tube to a small dome, solar panels and stacked crates. */
function miningBase(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const pad = lit('#8b939e', 0.3, 0.04);
  k.add(
    'steel',
    flat(
      lathe(
        [
          [0, -0.14],
          [0.66, -0.14],
          [0.7, 0.02],
          [0.66, 0.1],
          [0, 0.1],
        ],
        12,
      ),
    ),
    pad,
  );
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * TAU + Math.PI / 12;
    k.add(
      'steel',
      beam(
        v3(Math.cos(a) * 0.5, 0.102, Math.sin(a) * 0.5),
        v3(Math.cos(a) * 0.66, 0.102, Math.sin(a) * 0.66),
        0.012,
      ),
      '#5d646e',
    );
    k.add(
      'glow',
      ball(1),
      j % 2 ? '#7fd7ff' : '#ffd27a',
      m4(Math.cos(a) * 0.62, 0.11, Math.sin(a) * 0.62, 0, 0, 0, 0.018),
    );
  }
  const shell = then(lit('#eef1f5', 0.25, 0.02), (p, _n, c) =>
    c.multiplyScalar(0.85 + 0.15 * smooth(0.1, 0.5, p.y)),
  );
  k.add(
    'satin',
    new THREE.SphereGeometry(0.5, 36, 14, 0, TAU, 0, Math.PI / 2),
    shell,
    m4(0, 0.1, 0),
  );
  for (let j = 0; j < 6; j++)
    k.add(
      'steel',
      new THREE.TorusGeometry(0.505, 0.011, 5, 32, Math.PI),
      '#aab3be',
      m4(0, 0.1, 0, 0, (j / 6) * Math.PI, 0),
    );
  for (const y of [0.16, 0.36])
    k.add(
      'steel',
      new THREE.TorusGeometry(Math.sqrt(0.505 ** 2 - y * y), 0.011, 5, 48),
      '#aab3be',
      m4(0, 0.1 + y, 0, Math.PI / 2, 0, 0),
    );
  for (let j = 0; j < 7; j++) {
    const a = -0.95 + (j / 6) * 1.9;
    const e = 0.42;
    const at = v3(
      Math.sin(a) * Math.cos(e) * 0.5,
      0.1 + Math.sin(e) * 0.5,
      Math.cos(a) * Math.cos(e) * 0.5,
    );
    const out = at.clone().sub(v3(0, 0.1, 0));
    k.add(
      'glow',
      rbox(0.09, 0.012, 0.065, 0.01),
      '#ffcf6a',
      aim(at, out, 1, 0),
    );
  }
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16),
    '#9aa3ad',
    m4(0, 0.6, 0),
  );
  k.add(
    'steel',
    beam(v3(-0.14, 0.5, 0), v3(-0.14, 1.0, 0), 0.016, 6),
    '#7d8794',
  );
  k.add(
    'steel',
    beam(v3(-0.14, 0.8, 0), v3(-0.1, 0.62, 0), 0.01, 4),
    '#7d8794',
  );
  k.add(
    'satin',
    lathe(
      [
        [0, 0],
        [0.05, 0.008],
        [0.1, 0.03],
        [0.12, 0.05],
        [0.118, 0.055],
        [0, 0.012],
      ],
      18,
    ),
    lit('#e9edf2', 0.3),
    aim(v3(-0.14, 0.88, 0), v3(0.5, 0.6, 0.6)),
  );
  k.add('glow', ball(2), '#ff4a3a', m4(-0.14, 1.01, 0, 0, 0, 0, 0.03));
  // Airlock tube to the small dome.
  k.add(
    'satin',
    new THREE.CylinderGeometry(0.11, 0.11, 0.56, 20, 1, true),
    shell,
    m4(0.7, 0.16, 0, 0, 0, Math.PI / 2),
  );
  for (const x of [0.48, 0.62, 0.76, 0.9])
    k.add(
      'steel',
      new THREE.TorusGeometry(0.116, 0.016, 6, 24),
      '#8b939e',
      m4(x, 0.16, 0, 0, Math.PI / 2, 0),
    );
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.27, 0.29, 0.1, 20),
    pad,
    m4(1.02, 0, 0),
  );
  k.add(
    'satin',
    new THREE.SphereGeometry(0.23, 24, 10, 0, TAU, 0, Math.PI / 2),
    shell,
    m4(1.02, 0.05, 0),
  );
  k.add(
    'steel',
    rbox(0.12, 0.16, 0.04, 0.02),
    '#6f7782',
    m4(1.02, 0.12, 0.215),
  );
  k.add('glow', ball(1), '#7fd7ff', m4(1.02, 0.23, 0.22, 0, 0, 0, 0.02));
  // Solar panels.
  for (const z of [0.3, -0.22]) {
    k.add('steel', beam(v3(-0.82, 0, z), v3(-0.82, 0.22, z), 0.025), '#7d8794');
    const tilt = m4(-0.82, 0.24, z, 0, 0, 0.5);
    k.add('steel', rbox(0.34, 0.02, 0.26, 0.005), '#24345a', tilt);
    for (const dz of [-0.065, 0, 0.065])
      k.add(
        'metal',
        new THREE.BoxGeometry(0.34, 0.024, 0.006),
        '#b9c3cf',
        tilt.clone().multiply(m4(0, 0, dz)),
      );
    for (const dx of [-0.085, 0.085])
      k.add(
        'metal',
        new THREE.BoxGeometry(0.006, 0.024, 0.26),
        '#b9c3cf',
        tilt.clone().multiply(m4(dx, 0, 0)),
      );
  }
  // Crates.
  for (const [x, y, z, s] of [
    [0.32, 0, 0.62, 0.15],
    [0.5, 0, 0.55, 0.13],
    [0.4, 0.15, 0.6, 0.12],
  ]) {
    const turn = rand();
    k.add(
      'matte',
      rbox(s, s, s, 0.012),
      lit('#c08a3e', 0.3, 0.05),
      m4(x, y + s / 2, z, 0, turn, 0),
    );
    k.add(
      'steel',
      new THREE.BoxGeometry(s + 0.006, s * 0.15, s + 0.006),
      '#5d646e',
      m4(x, y + s / 2, z, 0, turn, 0),
    );
  }
  return k.ground(0.12, 0.25);
}

/** A smelting furnace: a brick drum with a glowing, barred mouth and a tall
 * tapering brick chimney with an iron rim, coal heaped beside it, a pipe and
 * embers. Its smoke is added by the planet at (0.12, 1.5, 0). */
function furnace(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const mortar = '#3e3432';
  const bricks = ['#7d5e52', '#8a6f62', '#6d5048', '#957565', '#7a564a'].map(
    (h) => col(h),
  );
  const course = (
    cx: number,
    y: number,
    r: number,
    n: number,
    off: number,
    h: number,
    skip?: (a: number) => boolean,
  ) => {
    for (let b = 0; b < n; b++) {
      const a = ((b + off) / n) * TAU;
      if (skip?.(a)) continue;
      const c = bricks[Math.floor(rand() * bricks.length)]
        .clone()
        .multiplyScalar(0.9 + rand() * 0.2);
      k.add(
        'matte',
        new THREE.BoxGeometry(((TAU * r) / n) * 0.88, h, 0.05),
        lit('#' + c.getHexString(), 0.25, 0.03),
        m4(cx + Math.sin(a) * r, y, Math.cos(a) * r, 0, a, 0),
      );
    }
  };
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.46, 0.5, 0.44, 24),
    mortar,
    m4(0, 0.17, 0),
  );
  for (let j = 0; j < 6; j++) {
    const y = 0.02 + j * 0.068;
    course(
      0,
      y,
      0.5 - (y / 0.44) * 0.04 + 0.012,
      22,
      (j % 2) * 0.5,
      0.058,
      (a) => y < 0.3 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.42,
    );
  }
  k.add(
    'steel',
    new THREE.TorusGeometry(0.47, 0.025, 6, 40),
    '#3a3f48',
    m4(0, 0.4, 0, Math.PI / 2, 0, 0),
  );
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.15, 0.21, 1.1, 16),
    mortar,
    m4(0.12, 0.92, 0),
  );
  for (let j = 0; j < 15; j++) {
    const y = 0.42 + j * 0.068;
    const r = 0.21 - ((y - 0.37) / 1.1) * 0.06 + 0.01;
    course(0.12, y, r, 12, (j % 2) * 0.5, 0.058);
  }
  const iron = lit('#2f3338', 0.3, 0);
  k.add(
    'steel',
    new THREE.TorusGeometry(0.17, 0.03, 6, 20),
    iron,
    m4(0.12, 1.46, 0, Math.PI / 2, 0, 0),
  );
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16, 1, true),
    '#1a1414',
    m4(0.12, 1.46, 0),
  );
  for (const y of [0.75, 1.15])
    k.add(
      'steel',
      new THREE.TorusGeometry(
        0.2 - ((y - 0.37) / 1.1) * 0.06 + 0.04,
        0.012,
        4,
        24,
      ),
      iron,
      m4(0.12, y, 0, Math.PI / 2, 0, 0),
    );
  // The mouth.
  k.add('matte', rbox(0.32, 0.26, 0.12, 0.04), '#1a1212', m4(0, 0.14, 0.45));
  k.add(
    'glow',
    rbox(0.25, 0.18, 0.04, 0.03),
    (p, _n, c) => c.set('#ff6a12').lerp(col('#ffd27a'), smooth(0.2, 0.06, p.y)),
    m4(0, 0.12, 0.49),
  );
  k.add(
    'steel',
    new THREE.TorusGeometry(0.15, 0.02, 4, 16, Math.PI),
    iron,
    m4(0, 0.17, 0.52),
  );
  for (const x of [-0.15, 0.15])
    k.add('steel', beam(v3(x, 0, 0.52), v3(x, 0.17, 0.52), 0.035), iron);
  for (const x of [-0.08, 0, 0.08])
    k.add('steel', beam(v3(x, 0.02, 0.53), v3(x, 0.24, 0.53), 0.014), iron);
  for (let j = 0; j < 5; j++)
    k.add(
      'glow',
      ball(1),
      j % 2 ? '#ff8a2a' : '#ffc04a',
      m4(
        (rand() - 0.5) * 0.3,
        0.01,
        0.62 + rand() * 0.15,
        0,
        0,
        0,
        0.018 + rand() * 0.015,
      ),
    );
  // Coal heap.
  for (let j = 0; j < 14; j++) {
    const a = rand() * TAU;
    const r = rand() * 0.16;
    k.add(
      'matte',
      ball(0),
      lit('#2a2626', 0.4, 0.05),
      m4(
        -0.62 + Math.cos(a) * r,
        0.03 + (0.16 - r) * 0.6,
        0.2 + Math.sin(a) * r,
        rand(),
        rand(),
        0,
        0.05 + rand() * 0.03,
      ),
    );
  }
  k.add(
    'steel',
    tube(
      [
        v3(0.42, 0.28, -0.22),
        v3(0.62, 0.3, -0.3),
        v3(0.74, 0.18, -0.36),
        v3(0.76, -0.02, -0.38),
      ],
      0.04,
      20,
      8,
    ),
    lit('#8a5a3a', 0.3, 0.06),
  );
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10),
    iron,
    m4(0.42, 0.28, -0.22, 0, 0.4, Math.PI / 2),
  );
  return k.ground(0.12, 0.3);
}

// ——— Ice: Frost and Floe ———

/** A snowy pine: five drooping, scalloped tiers of needles (dark inside,
 * lighter at the tips) with snow lying on top of each, and a snow cap. */
function snowPine(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  k.add(
    'matte',
    lathe(
      [
        [0.08, -0.06],
        [0.072, 0.2],
        [0.05, 0.6],
        [0, 0.62],
      ],
      9,
    ),
    grad('#4b3220', '#6b4a2f', 0, 0.3),
  );
  const inner = col('#1c4632');
  const needle = col('#2d7050');
  const tip = col('#4a9468');
  const snowC = col('#f6faff');
  const shade = col('#bcd3ea');
  for (let i = 0; i < 5; i++) {
    const r = 0.5 - i * 0.085;
    const h = 0.4 - i * 0.035;
    const y0 = 0.16 + i * 0.165;
    const ph = rand() * 6;
    const cone = new THREE.ConeGeometry(r, h, 36, 5);
    const nor = cone.getAttribute('normal');
    const caps: boolean[] = [];
    for (let j = 0; j < nor.count; j++) caps.push(nor.getY(j) < -0.5);
    warp(cone, (v, j) => {
      v.y += h / 2;
      const rr = Math.hypot(v.x, v.z) / r;
      const th = Math.atan2(v.z, v.x);
      const sc = 1 + 0.15 * Math.cos(9 * th + ph) * rr * rr;
      v.x *= sc;
      v.z *= sc;
      v.y -= 0.09 * rr ** 2.5 * (0.75 + 0.25 * Math.cos(9 * th + ph));
      if (caps[j]) v.y += 0.14 * (1 - rr);
    });
    k.add(
      'matte',
      cone,
      (p, n, c) => {
        const rr = Math.hypot(p.x, p.z) / r;
        c.copy(inner)
          .lerp(needle, smooth(0.15, 0.7, rr))
          .lerp(tip, smooth(0.75, 1.1, rr) * 0.6);
        c.multiplyScalar(
          n.y < -0.2
            ? 0.55
            : 0.92 + 0.08 * tone.noise3d(p.x * 12, p.y * 12, p.z * 12),
        );
      },
      m4(0, y0, 0),
    );
    // Snow lying on the tier: a thinner scalloped layer over its top.
    const sr = r * 0.8;
    const sh = h * 0.72;
    const cap = warp(new THREE.ConeGeometry(sr, sh, 36, 3, true), (v) => {
      v.y += sh / 2;
      const rr = Math.hypot(v.x, v.z) / sr;
      const th = Math.atan2(v.z, v.x);
      const sc = 1 + 0.17 * Math.cos(9 * th + ph) * rr * rr;
      v.x *= sc;
      v.z *= sc;
      v.y -= 0.07 * rr ** 2.5 * (0.75 + 0.25 * Math.cos(9 * th + ph));
    });
    k.add(
      'snow',
      cap,
      (_p, n, c) => {
        c.copy(shade).lerp(snowC, smooth(0.2, 0.85, n.y));
      },
      m4(0, y0 + h - sh + 0.012, 0),
    );
  }
  k.add(
    'snow',
    ball(2),
    lit('#f6faff', 0.2),
    m4(0, 0.16 + 4 * 0.165 + 0.25, 0, 0, 0, 0, [0.05, 0.08, 0.05]),
  );
  k.add(
    'snow',
    blob(2, 0.2, seed),
    lit('#f2f8ff', 0.3),
    m4(0, 0, 0, 0, 0, 0, [0.3, 0.06, 0.3]),
  );
  return k.ground(0.2, 0.3);
}

/** An igloo: a dome of staggered snow blocks over darker grooves, a blocky
 * entrance tunnel with a warm-lit doorway, a drift round its foot, an ice
 * window, a sled and a lantern (its footprints are added by the planet). */
function igloo(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const R = 0.5;
  k.add(
    'snow',
    new THREE.SphereGeometry(R - 0.004, 32, 12, 0, TAU, 0, Math.PI / 2),
    '#a9c3dd',
  );
  const shade = col('#c4d7ec');
  const rows = 6;
  for (let j = 0; j < rows; j++) {
    const e0 = (j / rows) * (Math.PI / 2);
    const e1 = ((j + 1) / rows) * (Math.PI / 2);
    if (j === rows - 1) {
      k.add(
        'snow',
        new THREE.SphereGeometry(
          R + 0.012,
          14,
          2,
          0,
          TAU,
          0,
          Math.PI / 2 - e0 - 0.012,
        ),
        lit('#f8fbff', 0.2),
      );
      continue;
    }
    const n = Math.max(4, Math.round(17 * Math.cos((e0 + e1) / 2)));
    for (let b = 0; b < n; b++) {
      const len = TAU / n;
      const phi = ((b + (j % 2) * 0.5) / n) * TAU;
      const mid = phi + len / 2;
      const off = Math.atan2(
        Math.sin(mid - Math.PI / 2),
        Math.cos(mid - Math.PI / 2),
      );
      if (j < 2 && Math.abs(off) < 0.42) continue;
      const tone2 = 0.93 + rand() * 0.09;
      const blk = new THREE.SphereGeometry(
        R + 0.012,
        4,
        2,
        phi + 0.012,
        len - 0.024,
        Math.PI / 2 - e1 + 0.012,
        e1 - e0 - 0.024,
      );
      k.add('snow', blk, (p, nn, c) => {
        c.set('#f8fbff')
          .multiplyScalar(tone2)
          .lerp(shade, (1 - Math.max(0, nn.y)) * 0.3);
      });
    }
  }
  const tunnel = new THREE.CylinderGeometry(
    0.2,
    0.2,
    0.32,
    18,
    1,
    true,
    -Math.PI / 2,
    Math.PI,
  ).rotateX(-Math.PI / 2);
  k.add('snow', tunnel, lit('#f4f9ff', 0.3), m4(0, 0, R - 0.02 + 0.14));
  for (const z of [0.42, 0.52, 0.62])
    k.add(
      'snow',
      new THREE.TorusGeometry(0.203, 0.012, 4, 18, Math.PI),
      '#b4cbe2',
      m4(0, 0, z),
    );
  k.add(
    'snow',
    new THREE.TorusGeometry(0.2, 0.035, 6, 18, Math.PI),
    lit('#f8fbff', 0.2),
    m4(0, 0, 0.64),
  );
  k.add(
    'glow',
    new THREE.CircleGeometry(0.17, 20, 0, Math.PI),
    (p, _n, c) => c.set('#a85a22').lerp(col('#ffb070'), smooth(0.18, 0, p.y)),
    m4(0, 0, 0.6),
  );
  k.add(
    'snow',
    warp(
      weld(
        lathe(
          [
            [0.47, -0.03],
            [0.68, -0.03],
            [0.58, 0.03],
            [0.51, 0.07],
            [0.47, 0.08],
          ],
          40,
        ),
      ),
      (v) => {
        v.y *= 1 + 0.6 * tone.noise3d(v.x * 5, 0, v.z * 5);
      },
    ),
    lit('#f2f8ff', 0.3, 0.04),
  );
  const win = m4(
    -Math.cos(0.4) * 0.47,
    0.1 + Math.sin(0.4) * 0.3,
    -0.12,
    0,
    Math.PI / 2,
    0,
  );
  k.add('glow', rbox(0.13, 0.11, 0.04, 0.01), '#4a8ab0', win);
  // Sled.
  const sled = new Kit();
  for (const x of [-0.07, 0.07])
    sled.add(
      'satin',
      tube(
        [
          v3(x, 0.02, -0.2),
          v3(x, 0.015, 0.1),
          v3(x, 0.04, 0.2),
          v3(x, 0.09, 0.19),
        ],
        0.011,
        16,
        5,
      ),
      '#c0392b',
    );
  for (const z of [-0.14, -0.05, 0.04, 0.12]) {
    sled.add(
      'matte',
      rbox(0.19, 0.014, 0.055, 0.005),
      wood('#b07a48'),
      m4(0, 0.065, z),
    );
    for (const x of [-0.07, 0.07])
      sled.add('matte', beam(v3(x, 0.02, z), v3(x, 0.06, z), 0.012), '#8a5a30');
  }
  sled.add(
    'matte',
    tube(
      [v3(-0.07, 0.09, 0.19), v3(0, 0.05, 0.36), v3(0.12, 0.01, 0.42)],
      0.005,
      10,
      3,
    ),
    '#d9c28a',
  );
  k.put(sled, m4(0.62, 0, 0.22, 0, 0.7, 0, 1.2));
  // Lantern on a pole.
  k.add(
    'matte',
    beam(v3(-0.58, -0.02, 0.42), v3(-0.58, 0.34, 0.42), 0.025),
    wood('#6b4a30'),
  );
  k.add(
    'steel',
    new THREE.ConeGeometry(0.045, 0.04, 6),
    '#2f3338',
    m4(-0.58, 0.39, 0.42),
  );
  k.add(
    'glow',
    ball(2),
    '#ffc26a',
    m4(-0.58, 0.345, 0.42, 0, 0, 0, [0.03, 0.04, 0.03]),
  );
  return k.ground(0.12, 0.2);
}

/** A snowman: three snowballs, coal eyes and buttons, a carrot nose, a red
 * scarf, stick arms and a top hat. */
function snowman(seed: number) {
  const k = new Kit();
  const snow = then(lit('#f7fbff', 0.25, 0.04), (_p, n, c) =>
    c.lerp(col('#bcd2ea'), smooth(0.2, -0.7, n.y) * 0.5),
  );
  k.add('snow', blob(4, 0.035, seed), snow, m4(0, 0.25, 0, 0, 0, 0, 0.3));
  k.add('snow', blob(4, 0.035, seed + 1), snow, m4(0, 0.64, 0, 0, 0, 0, 0.22));
  k.add('snow', blob(3, 0.03, seed + 2), snow, m4(0, 0.95, 0, 0, 0, 0, 0.16));
  const coal = '#22262c';
  for (const s of [1, -1])
    k.add('satin', ball(1), coal, m4(s * 0.055, 0.99, 0.142, 0, 0, 0, 0.022));
  for (let j = 0; j < 3; j++)
    k.add(
      'satin',
      ball(1),
      coal,
      m4(0, 0.56 + j * 0.08, 0.215 - Math.abs(j - 1) * 0.01, 0, 0, 0, 0.022),
    );
  k.add(
    'satin',
    new THREE.ConeGeometry(0.026, 0.15, 8),
    '#f07a2a',
    m4(0, 0.95, 0.22, Math.PI / 2, 0, 0),
  );
  k.add(
    'satin',
    new THREE.TorusGeometry(0.145, 0.042, 8, 24),
    lit('#d04a3a', 0.3),
    m4(0, 0.82, 0, Math.PI / 2, 0, 0),
  );
  k.add(
    'satin',
    rbox(0.07, 0.2, 0.03, 0.012),
    lit('#d04a3a', 0.3),
    m4(0.08, 0.73, 0.15, 0.2, 0, 0.15),
  );
  const hat = '#25272e';
  k.add(
    'satin',
    new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20),
    hat,
    m4(0, 1.08, 0, 0.08, 0, 0.1),
  );
  k.add(
    'satin',
    new THREE.CylinderGeometry(0.105, 0.11, 0.16, 18),
    hat,
    m4(0, 1.17, 0, 0.08, 0, 0.1),
  );
  k.add(
    'satin',
    new THREE.CylinderGeometry(0.112, 0.112, 0.03, 18),
    '#c0392b',
    m4(0, 1.11, 0, 0.08, 0, 0.1),
  );
  for (const s of [1, -1]) {
    const a = v3(s * 0.19, 0.68, 0);
    const b = v3(s * 0.42, 0.86, 0.03);
    k.add('matte', beam(a, b, 0.022, 5), '#6b4a2f');
    k.add(
      'matte',
      beam(
        b.clone().lerp(a, 0.25),
        b.clone().add(v3(s * 0.05, 0.08, 0)),
        0.014,
        4,
      ),
      '#6b4a2f',
    );
  }
  return k.ground(0.12, 0.2);
}

/** A cluster of crystals: one tall faceted point and smaller ones bursting
 * out round it at varied angles, from a dark rock with rubble about it.
 * Crystal parts go under `key`, painted root-dim to tip-bright in `tint`. */
function crystalCluster(
  seed: number,
  tint: string,
  rockHex: string,
  key = 'crystal',
) {
  const rand = seeded(seed);
  const k = new Kit();
  const t = col(tint);
  const glowPaint: Paint = (p, _n, c) => {
    c.copy(t).multiplyScalar(0.55 + 0.45 * smooth(0, 1.1, p.y));
  };
  k.add(
    key,
    shardGeo(rand, 6, 0.95, 0.2, 0.42),
    glowPaint,
    aim(v3(), v3((rand() - 0.5) * 0.3, 1, (rand() - 0.5) * 0.3)),
  );
  const n = 6 + Math.floor(rand() * 3);
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU + rand() * 0.5;
    const d = 0.12 + rand() * 0.1;
    const lean = 0.35 + rand() * 0.55;
    const dir = v3(
      Math.cos(a) * Math.sin(lean),
      Math.cos(lean),
      Math.sin(a) * Math.sin(lean),
    );
    const h = 0.3 + rand() * 0.42;
    const r = 0.07 + rand() * 0.07;
    k.add(
      key,
      shardGeo(rand, 5 + (j % 2), h, r, r * 1.9),
      glowPaint,
      aim(v3(Math.cos(a) * d, 0, Math.sin(a) * d), dir),
    );
  }
  for (let j = 0; j < 7; j++) {
    const a = rand() * TAU;
    const d = 0.3 + rand() * 0.2;
    const lean = 0.2 + rand() * 0.7;
    k.add(
      key,
      shardGeo(rand, 5, 0.06 + rand() * 0.08, 0.025 + rand() * 0.02, 0.06),
      glowPaint,
      aim(
        v3(Math.cos(a) * d, 0, Math.sin(a) * d),
        v3(
          Math.cos(a) * Math.sin(lean),
          Math.cos(lean),
          Math.sin(a) * Math.sin(lean),
        ),
      ),
    );
  }
  const rockC = col(rockHex);
  const rockPaint: Paint = (p, n, c) => {
    c.copy(rockC).multiplyScalar(
      0.7 +
        0.3 * smooth(-0.05, 0.2, p.y) +
        0.15 * n.y +
        0.08 * tone.noise3d(p.x * 8, p.y * 8, p.z * 8),
    );
  };
  k.add(
    'matte',
    warp(blob(3, 0.28, seed, 1.3), (v) => {
      if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3;
    }),
    rockPaint,
    m4(0, 0.02, 0, 0, rand() * 6, 0, [0.36, 0.16, 0.32]),
  );
  for (let j = 0; j < 6; j++) {
    const a = rand() * TAU;
    const d = 0.35 + rand() * 0.25;
    k.add(
      'matte',
      blob(1, 0.3, seed + j * 3),
      rockPaint,
      m4(
        Math.cos(a) * d,
        0.02,
        Math.sin(a) * d,
        rand(),
        rand(),
        0,
        0.04 + rand() * 0.04,
      ),
    );
  }
  return k.ground(0.1, 0.2);
}

/** A geode: a rough rock bowl broken open, its inside lined with glowing
 * crystal and small points standing in it. */
function geode(seed: number, tint: string, rockHex: string) {
  const rand = seeded(seed);
  const k = new Kit();
  const nz = new SimplexNoise({ random: seeded(seed) });
  const rough = (g: THREE.BufferGeometry) =>
    warp(weld(g), (v) => {
      const s = 1 + 0.1 * nz.noise3d(v.x * 4, v.y * 4, v.z * 4);
      v.x *= s;
      v.z *= s;
    });
  const rockC = col(rockHex);
  k.add(
    'matte',
    rough(
      lathe(
        [
          [0, -0.3],
          [0.3, -0.26],
          [0.48, -0.1],
          [0.52, 0.06],
          [0.5, 0.15],
          [0.44, 0.17],
        ],
        30,
      ),
    ),
    (p, n, c) => {
      c.copy(rockC).multiplyScalar(
        0.7 + 0.3 * n.y + 0.1 * tone.noise3d(p.x * 7, p.y * 7, p.z * 7),
      );
    },
  );
  const t = col(tint);
  const inner = rough(
    lathe(
      [
        [0.44, 0.17],
        [0.41, 0.1],
        [0.34, -0.04],
        [0.18, -0.13],
        [0, -0.15],
      ],
      30,
    ),
  );
  k.add('crystal', inner, (p, _n, c) =>
    c.copy(t).multiplyScalar(0.55 + 0.45 * smooth(-0.15, 0.17, p.y)),
  );
  for (let j = 0; j < 14; j++) {
    const a = rand() * TAU;
    const d = rand() * 0.3;
    const y = -0.13 + (d / 0.3) ** 2 * 0.15;
    k.add(
      'crystal',
      shardGeo(rand, 5, 0.06 + rand() * 0.1, 0.03 + rand() * 0.03, 0.07),
      (p, _n, c) =>
        c.copy(t).multiplyScalar(0.7 + 0.3 * smooth(-0.1, 0.25, p.y)),
      aim(
        v3(Math.cos(a) * d, y, Math.sin(a) * d),
        v3(-Math.cos(a) * d, 0.6, -Math.sin(a) * d),
      ),
    );
  }
  return k.ground(0.06, 0.2);
}

/** A flat ice floe: an irregular bevelled slab, white on top and pale blue
 * at the sides, with snow drifts and maybe a few penguins on it. */
function iceFloe(seed: number, penguins: number) {
  const rand = seeded(seed);
  const shape = new THREE.Shape();
  const n = 16;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU;
    const r = 0.4 + 0.1 * Math.sin(a * 3 + seed) + rand() * 0.08;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.8;
    if (j) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.04,
    bevelSegments: 3,
    curveSegments: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.06, 0);
  const k = new Kit();
  const top = col('#f8fcff');
  const side = col('#8fcde8');
  k.add('snow', weld(g), (p, n2, c) => {
    c.copy(side).lerp(top, smooth(0.0, 0.05, p.y) * smooth(0.2, 0.8, n2.y));
  });
  for (let j = 0; j < 2; j++) {
    const a = rand() * TAU;
    k.add(
      'snow',
      blob(2, 0.2, seed + j),
      lit('#f4f9ff', 0.3),
      m4(
        Math.cos(a) * 0.2,
        0.06,
        Math.sin(a) * 0.15,
        0,
        rand(),
        0,
        [0.16, 0.05, 0.1],
      ),
    );
  }
  for (let j = 0; j < penguins; j++) {
    const a = (j / Math.max(1, penguins)) * TAU + rand();
    k.put(
      penguin(),
      m4(Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.12, 0, a + rand(), 0, 0.62),
    );
  }
  return k;
}

/** A penguin: a black back, white belly, orange beak and feet. */
function penguin() {
  const k = new Kit();
  const coat: Paint = (p, n, c) => {
    c.set('#1f2630').lerp(
      col('#f4f6f8'),
      smooth(0.015, 0.04, p.z) * smooth(0.25, 0.15, p.y),
    );
    c.multiplyScalar(0.85 + 0.15 * (0.5 + 0.5 * n.y));
  };
  k.add('satin', ball(3), coat, m4(0, 0.11, 0, 0, 0, 0, [0.07, 0.11, 0.065]));
  k.add('satin', ball(2), '#1f2630', m4(0, 0.235, 0.005, 0, 0, 0, 0.05));
  k.add(
    'satin',
    new THREE.ConeGeometry(0.013, 0.05, 6),
    '#f29a2a',
    m4(0, 0.23, 0.065, Math.PI / 2, 0, 0),
  );
  for (const s of [1, -1]) {
    k.add(
      'satin',
      ball(1),
      '#f4f6f8',
      m4(s * 0.022, 0.25, 0.04, 0, 0, 0, 0.01),
    );
    k.add(
      'satin',
      ball(1),
      '#1f2630',
      m4(s * 0.068, 0.12, 0, 0, 0, s * 0.3, [0.014, 0.06, 0.03]),
    );
    k.add(
      'satin',
      ball(1),
      '#f29a2a',
      m4(s * 0.03, 0.006, 0.03, 0, 0, 0, [0.025, 0.008, 0.035]),
    );
  }
  return k;
}

/** An iceberg: two faceted, tapering tiers, deep blue at the waterline and
 * white at the top. Base below y = 0 so it sits in the sea. */
function iceberg(seed: number) {
  const rand = seeded(seed);
  const tier = (r0: number, depth: number, y: number) => {
    const shape = new THREE.Shape();
    const n = 9;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU;
      const r = r0 * (0.75 + rand() * 0.4);
      if (j) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.3,
      bevelSize: r0 * 0.25,
      bevelSegments: 1,
      curveSegments: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    return warp(
      g,
      (v) => {
        const s = 1 - 0.32 * smooth(y - 0.1, y + depth + 0.1, v.y);
        v.x = v.x * s + 0.05 * tone.noise3d(v.x * 5 + seed, v.y * 5, v.z * 5);
        v.z = v.z * s + 0.05 * tone.noise3d(v.x * 5, v.y * 5 + seed, v.z * 5);
        v.y += 0.04 * tone.noise3d(v.x * 6, v.y * 6, v.z * 6 + seed);
      },
      false,
    );
  };
  const g = merge(
    [tier(0.42, 0.42, -0.3), tier(0.24, 0.3, 0.2)].map((t) => tidy(t)),
  );
  const k = new Kit();
  const deep = col('#5cb6e0');
  const mid = col('#bfe8fa');
  const top = col('#ffffff');
  k.add('ice', flat(g), (p, _n, c) => {
    c.copy(deep)
      .lerp(mid, smooth(-0.15, 0.15, p.y))
      .lerp(top, smooth(0.15, 0.55, p.y));
  });
  return k;
}

/** A whale: a smooth tapering body, dark above with pale mottling and a
 * pale belly, a mouth line, eyes, flippers, a dorsal fin, a notched fluke
 * and a blowhole. Head towards +z. */
function whale() {
  const k = new Kit();
  const prof: [number, number][] = [
    [0, -1.0],
    [0.07, -0.95],
    [0.13, -0.8],
    [0.25, -0.5],
    [0.38, -0.2],
    [0.45, 0.1],
    [0.46, 0.35],
    [0.42, 0.6],
    [0.33, 0.78],
    [0.2, 0.9],
    [0.08, 0.96],
    [0, 0.97],
  ];
  const rAt = (z: number) => {
    for (let j = 1; j < prof.length; j++)
      if (z <= prof[j][1]) {
        const [r0, z0] = prof[j - 1];
        const [r1, z1] = prof[j];
        return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
      }
    return 0;
  };
  const sx = 0.88;
  const syUp = 0.86;
  const syDown = 0.76;
  const body = weld(lathe(prof, 40)).rotateX(Math.PI / 2);
  warp(body, (v) => {
    v.x *= sx;
    v.y *= v.y < 0 ? syDown : syUp;
    v.y += 0.12 * smooth(-0.3, -1, v.z);
  });
  const back = col('#2c4f7c');
  const spot = col('#5a7ea8');
  const belly = col('#d6e6f0');
  k.add('gloss', body, (p, n, c) => {
    c.copy(back).lerp(
      spot,
      smooth(0.35, 0.6, tone.noise3d(p.x * 9, p.y * 9, p.z * 9)) * 0.6,
    );
    const lift = 0.12 * smooth(-0.3, -1, p.z);
    c.lerp(belly, smooth(-0.06, -0.18, p.y - lift));
    c.multiplyScalar(0.85 + 0.15 * (0.5 + 0.5 * n.y));
  });
  const surface = (s: number, y: number, z: number, out = 1.01) => {
    const r = rAt(z);
    const ry = y < 0 ? syDown * r : syUp * r;
    const x = sx * r * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
    return v3(s * x * out, y, z);
  };
  for (const s of [1, -1]) {
    const pts = [0.42, 0.55, 0.68, 0.8, 0.9].map((z, j) =>
      surface(s, -0.06 - j * 0.012, z),
    );
    k.add('satin', tube(pts, 0.012, 16, 5), '#14263e');
    const eye = surface(s, -0.0, 0.5, 1.0);
    k.add('satin', ball(2), '#0e1a2c', m4(eye.x, eye.y, eye.z, 0, 0, 0, 0.035));
    k.add(
      'satin',
      ball(1),
      '#ffffff',
      m4(eye.x * 1.04, eye.y + 0.012, eye.z + 0.012, 0, 0, 0, 0.01),
    );
    const root = surface(s, -0.22, 0.3, 0.9);
    k.add(
      'gloss',
      ball(3),
      lit('#2c4f7c', 0.3),
      aim(
        root.clone().add(v3(s * 0.12, -0.08, -0.08)),
        v3(s, -0.55, -0.55),
        [0.08, 0.26, 0.025],
        s * 0.4,
      ),
    );
  }
  k.add(
    'gloss',
    ball(2),
    lit('#2c4f7c', 0.3),
    m4(0, 0.3, -0.45, -0.5, 0, 0, [0.03, 0.08, 0.13]),
  );
  const lobe: [number, number][] = [
    [0, -0.05],
    [0.18, -0.02],
    [0.38, 0.05],
    [0.5, 0.17],
    [0.32, 0.14],
    [0.14, 0.17],
    [0, 0.11],
  ];
  const flukePts = [
    ...lobe,
    ...[...lobe]
      .reverse()
      .slice(1, -1)
      .map(([x, y]) => [-x, y] as [number, number]),
  ];
  const fluke = new THREE.ExtrudeGeometry(
    new THREE.Shape(flukePts.map(([x, y]) => new THREE.Vector2(x, y))),
    {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 1,
    },
  );
  fluke.rotateX(-Math.PI / 2);
  k.add(
    'gloss',
    weld(fluke),
    lit('#2c4f7c', 0.3),
    m4(0, 0.12, -0.96, -0.2, 0, 0),
  );
  k.add(
    'satin',
    ball(1),
    '#10203a',
    m4(0, 0.385, 0.42, 0, 0, 0, [0.04, 0.01, 0.022]),
  );
  for (let j = 0; j < 6; j++) {
    const at = surface(
      j % 2 ? 1 : -1,
      0.2 + (j % 3) * 0.05,
      0.6 + j * 0.04,
      0.98,
    );
    k.add('matte', ball(1), '#c9d4dc', m4(at.x, at.y, at.z, 0, 0, 0, 0.02));
  }
  return k;
}

/** A lighthouse on its rock: a red and white banded tower, a railed
 * gallery, a glazed lantern with its light, a red cap, and
 * a keeper's hut beside it. */
function lighthouse(rockHex: string) {
  const k = new Kit();
  const rockC = col(rockHex);
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * TAU;
    k.add(
      'matte',
      blob(2, 0.25, 70 + j),
      (p, n, c) =>
        c
          .copy(rockC)
          .multiplyScalar(0.7 + 0.3 * n.y)
          .lerp(col('#f4f9ff'), smooth(0.5, 0.8, n.y)),
      m4(
        Math.cos(a) * 0.28,
        0.02,
        Math.sin(a) * 0.28,
        j,
        j,
        0,
        [0.14, 0.09, 0.12],
      ),
    );
  }
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.25, 0.28, 0.08, 24),
    lit('#b8b2a6', 0.3, 0.05),
    m4(0, 0.0, 0),
  );
  const pts: [number, number][] = [];
  for (let i = 0; i <= 5; i++) {
    const y = i * 0.2;
    const r = 0.2 - 0.07 * y;
    if (i > 0) pts.push([r, y - 0.004]);
    if (i < 5) pts.push([r, y + 0.004]);
  }
  pts.push([0, 1.0]);
  const red = col('#c8423a');
  const white = col('#f4f1ea');
  k.add('satin', weld(lathe(pts, 24)), (p, n, c) => {
    c.copy(Math.floor((p.y + 0.0001) / 0.2) % 2 ? red : white).multiplyScalar(
      0.85 + 0.15 * (0.5 + 0.5 * n.y),
    );
  });
  const iron = lit('#2f3338', 0.3);
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.2, 0.17, 0.04, 24),
    iron,
    m4(0, 1.02, 0),
  );
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * TAU;
    k.add(
      'steel',
      beam(
        v3(Math.cos(a) * 0.19, 1.04, Math.sin(a) * 0.19),
        v3(Math.cos(a) * 0.19, 1.12, Math.sin(a) * 0.19),
        0.01,
      ),
      iron,
    );
  }
  k.add(
    'steel',
    new THREE.TorusGeometry(0.19, 0.008, 4, 36),
    iron,
    m4(0, 1.12, 0, Math.PI / 2, 0, 0),
  );
  k.add(
    'glass',
    new THREE.CylinderGeometry(0.1, 0.1, 0.17, 16, 1, true),
    '#fff8d0',
    m4(0, 1.125, 0),
  );
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * TAU;
    k.add(
      'steel',
      beam(
        v3(Math.cos(a) * 0.1, 1.04, Math.sin(a) * 0.1),
        v3(Math.cos(a) * 0.1, 1.21, Math.sin(a) * 0.1),
        0.012,
      ),
      iron,
    );
  }
  k.add('glow', ball(2), '#fff2b0', m4(0, 1.12, 0, 0, 0, 0, 0.065));
  k.add(
    'satin',
    new THREE.ConeGeometry(0.14, 0.12, 16),
    lit('#b8372f', 0.3),
    m4(0, 1.27, 0),
  );
  k.add('steel', beam(v3(0, 1.32, 0), v3(0, 1.42, 0), 0.01), iron);
  k.add('metal', ball(1), '#d9b44a', m4(0, 1.34, 0, 0, 0, 0, 0.02));
  k.add(
    'satin',
    rbox(0.08, 0.13, 0.03, 0.01),
    wood('#5a3d28'),
    m4(0, 0.065, 0.195),
  );
  for (const y of [0.45, 0.75])
    k.add(
      'satin',
      rbox(0.05, 0.07, 0.02, 0.008),
      '#2f4a66',
      m4(0, y, 0.2 - 0.07 * y + 0.005),
    );
  // Keeper's hut.
  k.add(
    'satin',
    rbox(0.3, 0.2, 0.24, 0.015),
    lit('#f4f1ea', 0.25),
    m4(0.4, 0.1, -0.06),
  );
  k.add(
    'satin',
    flat(
      new THREE.CylinderGeometry(0.19, 0.19, 0.28, 3)
        .rotateX(-Math.PI / 2)
        .rotateY(Math.PI / 2),
    ),
    '#b8372f',
    m4(0.4, 0.245, -0.06, 0, 0, 0, [1, 0.55, 1]),
  );
  k.add(
    'satin',
    rbox(0.06, 0.11, 0.02, 0.006),
    wood('#5a3d28'),
    m4(0.4, 0.055, 0.065),
  );
  k.add('glow', rbox(0.05, 0.05, 0.02, 0.006), '#ffd27a', m4(0.5, 0.12, 0.065));
  k.add(
    'matte',
    new THREE.BoxGeometry(0.04, 0.1, 0.04),
    '#8a8277',
    m4(0.47, 0.32, -0.1),
  );
  return k.ground(0.08, 0.2);
}

// ——— First settlements ———

/** A settler's hut: log walls on a stone footing under a pitched shingle
 * roof, a plank door, a lit window, a stovepipe, a water barrel and a
 * chopping block with its axe. */
function hut(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const W = 0.34;
  const D = 0.27;
  const E = 0.4;
  const R = 0.68;
  k.add(
    'matte',
    rbox(0.86, 0.12, 0.72, 0.04),
    lit('#a39d92', 0.3, 0.08),
    m4(0, -0.03, 0),
  );
  k.add(
    'matte',
    new THREE.BoxGeometry(2 * W - 0.03, E, 2 * D - 0.03),
    '#7a5636',
    m4(0, E / 2, 0),
  );
  // Logs, crossing at the corners.
  const log = wood('#a0703f');
  for (let j = 0; j < 6; j++) {
    const y = 0.04 + j * 0.066;
    for (const z of [D, -D])
      k.add(
        'matte',
        new THREE.CylinderGeometry(0.036, 0.036, 2 * W + 0.12, 8),
        log,
        m4(0, y, z, 0, 0, Math.PI / 2),
      );
    for (const x of [W, -W])
      k.add(
        'matte',
        new THREE.CylinderGeometry(0.036, 0.036, 2 * D + 0.12, 8),
        log,
        m4(x, y + 0.033, 0, Math.PI / 2, 0, 0),
      );
  }
  // Gables and the roof.
  const gable = new THREE.ExtrudeGeometry(
    new THREE.Shape([
      new THREE.Vector2(-W, 0),
      new THREE.Vector2(W, 0),
      new THREE.Vector2(0, R - E),
    ]),
    { depth: 2 * D - 0.02, bevelEnabled: false },
  );
  gable.translate(0, E + 0.02, -(D - 0.01));
  k.add('matte', gable, lit('#b07c48', 0.2, 0.06));
  const slope = Math.atan2(R - E, W);
  const len = Math.hypot(W, R - E) + 0.14;
  const tiles = lit('#b4553c', 0.25, 0.06);
  for (const s of [1, -1]) {
    const tilt = m4(s * (W / 2), (E + R) / 2 + 0.05, 0, 0, 0, -s * slope);
    k.add('matte', rbox(len, 0.06, 2 * D + 0.24, 0.02), tiles, tilt);
    for (let q = 0; q < 4; q++)
      k.add(
        'matte',
        rbox(0.035, 0.03, 2 * D + 0.25, 0.01),
        lit('#8f3f2c', 0.2),
        tilt
          .clone()
          .multiply(m4(-len / 2 + 0.06 + q * ((len - 0.1) / 4), 0.035, 0)),
      );
  }
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.035, 0.035, 2 * D + 0.26, 8),
    lit('#7a3324', 0.2),
    m4(0, R + 0.08, 0, Math.PI / 2, 0, 0),
  );
  // Door, window and stovepipe.
  const z = D + 0.04;
  k.add(
    'matte',
    rbox(0.17, 0.29, 0.03, 0.01),
    wood('#6e4a2c'),
    m4(-0.1, 0.15, z),
  );
  for (const y of [0.07, 0.24])
    k.add(
      'matte',
      new THREE.BoxGeometry(0.17, 0.025, 0.012),
      '#4f341f',
      m4(-0.1, y, z + 0.018),
    );
  k.add('metal', ball(1), '#d9b44a', m4(-0.04, 0.15, z + 0.02, 0, 0, 0, 0.016));
  k.add(
    'glow',
    rbox(0.13, 0.12, 0.02, 0.01),
    '#ffd27a',
    m4(0.15, 0.24, z - 0.004),
  );
  k.add(
    'matte',
    new THREE.BoxGeometry(0.15, 0.02, 0.03),
    '#5a3a22',
    m4(0.15, 0.24, z + 0.008),
  );
  k.add(
    'matte',
    new THREE.BoxGeometry(0.02, 0.14, 0.03),
    '#5a3a22',
    m4(0.15, 0.24, z + 0.008),
  );
  k.add(
    'matte',
    rbox(0.19, 0.03, 0.06, 0.01),
    '#5a3a22',
    m4(0.15, 0.165, z + 0.01),
  );
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10),
    lit('#4a4f58', 0.3),
    m4(-0.17, R + 0.02, -0.08),
  );
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.06, 0.045, 0.04, 10),
    lit('#3a3f48', 0.3),
    m4(-0.17, R + 0.18, -0.08),
  );
  // A water barrel with two hoops.
  const barrel = lathe(
    [
      [0, 0],
      [0.09, 0],
      [0.105, 0.08],
      [0.09, 0.17],
      [0, 0.17],
    ],
    14,
  );
  k.add('matte', barrel, wood('#8a5c34'), m4(W + 0.13, -0.01, 0.12));
  for (const y of [0.04, 0.13])
    k.add(
      'steel',
      new THREE.TorusGeometry(0.1, 0.008, 4, 18),
      '#4a4f58',
      m4(W + 0.13, y, 0.12, Math.PI / 2, 0, 0),
    );
  k.add(
    'gloss',
    new THREE.CylinderGeometry(0.08, 0.08, 0.01, 14),
    '#5fb3e0',
    m4(W + 0.13, 0.15, 0.12),
  );
  // A chopping block with an axe and split logs.
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.08, 0.09, 0.1, 10),
    wood('#9a6c42'),
    m4(-W - 0.12, 0.04, 0.16),
  );
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.075, 0.075, 0.01, 10),
    '#e0c08a',
    m4(-W - 0.12, 0.095, 0.16),
  );
  k.add(
    'matte',
    beam(v3(-W - 0.12, 0.1, 0.16), v3(-W - 0.2, 0.24, 0.2), 0.02, 5),
    '#7a5233',
  );
  k.add(
    'steel',
    rbox(0.06, 0.035, 0.012, 0.005),
    '#c9d1da',
    m4(-W - 0.12, 0.11, 0.16, 0, 0.4, 0.5),
  );
  for (let j = 0; j < 3; j++)
    k.add(
      'matte',
      new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6),
      log,
      m4(
        -W - 0.08 + rand() * 0.02,
        0.03 + (j === 2 ? 0.05 : 0),
        -0.08 + (j % 2) * 0.065 + (j === 2 ? 0.03 : 0),
        Math.PI / 2,
        0.1,
        0,
      ),
    );
  return named('hut', k.ground(0.12, 0.25));
}

// ——— What the third year builds ———

/** A gabled roof over a box of `w` × `d` with eaves at `e` and its ridge at
 * `r`: two tiled slabs with courses, a ridge and filled gables. */
function roof(
  k: Kit,
  w: number,
  d: number,
  e: number,
  r: number,
  tile: string,
  gable: Tint,
) {
  const g = new THREE.ExtrudeGeometry(
    new THREE.Shape([
      new THREE.Vector2(-w, 0),
      new THREE.Vector2(w, 0),
      new THREE.Vector2(0, r - e),
    ]),
    { depth: 2 * d - 0.02, bevelEnabled: false },
  );
  g.translate(0, e, -(d - 0.01));
  k.add('matte', g, gable);
  const slope = Math.atan2(r - e, w);
  const len = Math.hypot(w, r - e) + 0.12;
  const dark = col(tile).multiplyScalar(0.72);
  for (const s of [1, -1]) {
    const tilt = m4(s * (w / 2), (e + r) / 2 + 0.04, 0, 0, 0, -s * slope);
    k.add('matte', rbox(len, 0.06, 2 * d + 0.2, 0.02), lit(tile, 0.25), tilt);
    for (let q = 0; q < 4; q++)
      k.add(
        'matte',
        rbox(0.035, 0.03, 2 * d + 0.21, 0.01),
        dark,
        tilt
          .clone()
          .multiply(m4(-len / 2 + 0.07 + q * ((len - 0.1) / 4), 0.035, 0)),
      );
  }
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.035, 0.035, 2 * d + 0.22, 8),
    dark,
    m4(0, r + 0.07, 0, Math.PI / 2, 0, 0),
  );
}

/** A cottage: white walls with dark timbers on a stone footing, a steep
 * tiled roof, a chimney, a door with a step, lit windows and a flower box. */
function cottage(seed: number, tile: string) {
  const rand = seeded(seed);
  const k = new Kit();
  const W = 0.3;
  const D = 0.26;
  const E = 0.36;
  const R = 0.72;
  k.add(
    'matte',
    rbox(0.72, 0.1, 0.62, 0.03),
    lit('#a39d92', 0.3, 0.08),
    m4(0, -0.02, 0),
  );
  k.add(
    'matte',
    rbox(2 * W, E, 2 * D, 0.015),
    lit('#f4ecdc', 0.2, 0.03),
    m4(0, E / 2, 0),
  );
  const beamC = lit('#5a3d28', 0.2);
  for (const x of [-W, 0, W])
    for (const z of [D + 0.005, -D - 0.005])
      if (!(x === 0 && z > 0))
        k.add(
          'matte',
          new THREE.BoxGeometry(0.03, E, 0.02),
          beamC,
          m4(x, E / 2, z),
        );
  for (const z of [D + 0.005, -D - 0.005])
    k.add(
      'matte',
      new THREE.BoxGeometry(2 * W, 0.03, 0.02),
      beamC,
      m4(0, E - 0.015, z),
    );
  for (const x of [W + 0.005, -W - 0.005])
    for (const z of [-D, 0, D])
      k.add(
        'matte',
        new THREE.BoxGeometry(0.02, E, 0.03),
        beamC,
        m4(x, E / 2, z),
      );
  roof(k, W + 0.02, D, E, R, tile, lit('#efe4cf', 0.2, 0.03));
  // A chimney on the ridge.
  k.add(
    'matte',
    rbox(0.1, 0.24, 0.1, 0.015),
    lit('#a4553f', 0.25, 0.06),
    m4(W * 0.45, R + 0.02, -D * 0.4),
  );
  k.add(
    'matte',
    rbox(0.13, 0.03, 0.13, 0.01),
    '#6a6058',
    m4(W * 0.45, R + 0.15, -D * 0.4),
  );
  // Door, step and windows.
  const z = D + 0.016;
  k.add(
    'matte',
    rbox(0.13, 0.24, 0.025, 0.01),
    wood('#5f7f9a'),
    m4(0, 0.12, z),
  );
  k.add('metal', ball(1), '#d9b44a', m4(0.04, 0.12, z + 0.015, 0, 0, 0, 0.012));
  k.add(
    'matte',
    rbox(0.2, 0.03, 0.08, 0.01),
    '#a39d92',
    m4(0, 0.005, z + 0.04),
  );
  for (const x of [-0.19, 0.19]) {
    k.add(
      'glow',
      rbox(0.1, 0.1, 0.02, 0.01),
      '#ffd98a',
      m4(x, 0.22, z - 0.006),
    );
    k.add(
      'matte',
      new THREE.BoxGeometry(0.11, 0.015, 0.02),
      beamC,
      m4(x, 0.22, z + 0.004),
    );
    k.add(
      'matte',
      new THREE.BoxGeometry(0.015, 0.11, 0.02),
      beamC,
      m4(x, 0.22, z + 0.004),
    );
    k.add(
      'matte',
      rbox(0.13, 0.04, 0.05, 0.01),
      wood('#8a5c34'),
      m4(x, 0.15, z + 0.02),
    );
    for (let j = 0; j < 4; j++)
      k.add(
        'satin',
        ball(1),
        ['#ff8fb0', '#ffd23a', '#ffffff', '#e8463a'][
          (j + Math.floor(rand() * 4)) % 4
        ],
        m4(x - 0.045 + j * 0.03, 0.18, z + 0.025, 0, 0, 0, 0.022),
      );
  }
  // A side window at the back too, so it reads from every side.
  k.add('glow', rbox(0.1, 0.1, 0.02, 0.01), '#ffd98a', m4(0, 0.22, -z + 0.006));
  return k.ground(0.1, 0.22);
}

/** A stone well with a little shingle roof, a crank and a bucket. */
function well() {
  const k = new Kit();
  const stone = then(lit('#b5aca0', 0.3, 0.1, 16), (p, _n, c) =>
    c.multiplyScalar(0.92 + 0.12 * Math.sign(Math.sin(p.y * 60))),
  );
  k.add(
    'matte',
    lathe(
      [
        [0, 0],
        [0.24, 0],
        [0.25, 0.2],
        [0.2, 0.22],
        [0.19, 0.04],
        [0, 0.04],
      ],
      20,
    ),
    stone,
  );
  k.add(
    'gloss',
    new THREE.CircleGeometry(0.19, 20).rotateX(-Math.PI / 2),
    '#3f8fc0',
    m4(0, 0.12, 0),
  );
  for (const x of [-0.21, 0.21])
    k.add('matte', beam(v3(x, 0.1, 0), v3(x, 0.52, 0), 0.04), wood('#7a5233'));
  roof(k, 0.26, 0.17, 0.5, 0.66, '#7a4a3a', wood('#8a6040'));
  k.add(
    'matte',
    beam(v3(-0.24, 0.42, 0), v3(0.24, 0.42, 0), 0.025, 8),
    wood('#6e4a2c'),
  );
  k.add(
    'steel',
    beam(v3(0.24, 0.42, 0), v3(0.28, 0.42, 0.06), 0.015, 6),
    '#4a4f58',
  );
  k.add(
    'matte',
    lathe(
      [
        [0, 0],
        [0.05, 0],
        [0.065, 0.1],
        [0, 0.1],
      ],
      10,
    ),
    wood('#9a6c42'),
    m4(0.06, 0.22, 0),
  );
  k.add(
    'matte',
    beam(v3(0.06, 0.32, 0), v3(0.06, 0.42, 0), 0.006, 4),
    '#c9b48a',
  );
  return k.ground(0.1, 0.2);
}

/** A little village: three cottages round a cobbled square with a well and
 * a lamp post. */
function village(seed: number) {
  const k = new Kit();
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.46, 0.48, 0.03, 28),
    (p, _n, c) =>
      c
        .set('#c9bca4')
        .multiplyScalar(0.88 + 0.12 * tone.noise3d(p.x * 20, 0, p.z * 20)),
    m4(0, 0.0, 0),
  );
  const tiles = ['#c4553a', '#5f7f9a', '#8a5a3a'];
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU + 0.5;
    k.put(
      cottage(seed + j, tiles[j]),
      m4(
        Math.cos(a) * 0.62,
        0,
        Math.sin(a) * 0.62,
        0,
        -a - Math.PI / 2,
        0,
        0.82,
      ),
    );
  }
  k.put(well(), m4(0, 0.01, 0, 0, 0.4, 0, 0.62));
  k.put(lampPost(), m4(0.3, 0, -0.3, 0, 2.2, 0, 0.32));
  return named('village', k);
}

/** A pumpkin house: a giant ribbed pumpkin with a round wooden door, lit
 * round windows, its stalk for a chimney, a leaf awning, steps and a
 * mailbox. */
function pumpkinHouse(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  const squash = 0.86;
  const R = 0.5;
  const shell = warp(weld(new THREE.SphereGeometry(R, 40, 22)), (v) => {
    const a = Math.atan2(v.z, v.x);
    const f = Math.abs(Math.cos(a * 4));
    const s = 0.88 + 0.12 * Math.pow(f, 0.35);
    v.x *= s;
    v.z *= s;
    v.y *= squash;
    const r = Math.hypot(v.x, v.z);
    if (v.y > 0) v.y -= 0.09 * Math.max(0, 1 - r / 0.22) ** 2;
  });
  const orange = col('#f28a26');
  const deep = col('#b9501a');
  const hi = col('#ffc464');
  k.add(
    'gloss',
    shell,
    (p, n, c) => {
      const f = Math.pow(Math.abs(Math.cos(Math.atan2(p.z, p.x) * 4)), 0.5);
      c.copy(deep)
        .lerp(orange, 0.3 + 0.7 * f)
        .lerp(hi, smooth(0.3, 1, n.y) * 0.45 * f);
      c.multiplyScalar(0.8 + 0.2 * smooth(0, 0.6, p.y));
    },
    m4(0, R * squash - 0.02, 0),
  );
  const top = 2 * R * squash - 0.1;
  // The stalk is the chimney.
  const stalk = warp(
    new THREE.CylinderGeometry(0.06, 0.09, 0.3, 10, 6),
    (v) => {
      const t = (v.y + 0.15) / 0.3;
      v.x += 0.06 * t * t;
    },
  );
  k.add(
    'matte',
    stalk,
    grad('#4f6a2a', '#8a9a4a', top, top + 0.3),
    m4(0, top + 0.13, 0),
  );
  k.add(
    'matte',
    new THREE.TorusGeometry(0.06, 0.02, 6, 14),
    wood('#6e4a2c'),
    m4(0.06, top + 0.29, 0, Math.PI / 2, 0, 0),
  );
  // An arched door in a little wooden porch, steps, and round windows.
  const arch = (w: number, h: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w, 0);
    sh.lineTo(w, 0);
    sh.lineTo(w, h);
    sh.absarc(0, h, w, 0, Math.PI, false);
    sh.lineTo(-w, 0);
    return sh;
  };
  k.add(
    'matte',
    new THREE.ExtrudeGeometry(arch(0.14, 0.16), {
      depth: 0.22,
      bevelEnabled: false,
      curveSegments: 10,
    }),
    wood('#6e4a2c'),
    m4(0, 0, 0.3),
  );
  k.add(
    'matte',
    new THREE.ExtrudeGeometry(arch(0.105, 0.15), {
      depth: 0.03,
      bevelEnabled: false,
      curveSegments: 10,
    }),
    then(wood('#a0703f'), (p, _n, c) =>
      c.multiplyScalar(0.85 + 0.15 * Math.sign(Math.sin(p.x * 60))),
    ),
    m4(0, 0.01, 0.505),
  );
  k.add('metal', ball(1), '#d9b44a', m4(0.06, 0.12, 0.54, 0, 0, 0, 0.016));
  k.add('matte', rbox(0.36, 0.035, 0.12, 0.01), '#a39d92', m4(0, -0.005, 0.6));
  k.add('matte', rbox(0.28, 0.035, 0.08, 0.01), '#b5aca0', m4(0, 0.025, 0.58));
  for (const [a, y, r, tilt] of [
    [-0.62, 0.4, 0.505, 0],
    [0.62, 0.4, 0.505, 0],
    [0, 0.62, 0.45, -0.5],
  ] as const) {
    const at = m4(Math.sin(a) * r, y, Math.cos(a) * r, tilt, a, 0);
    k.add('glow', new THREE.CircleGeometry(0.07, 16), '#ffd27a', at);
    k.add(
      'matte',
      new THREE.TorusGeometry(0.075, 0.018, 6, 18),
      wood('#6e4a2c'),
      at,
    );
  }
  // A leaf for an awning over the door.
  k.add(
    'leaf',
    leafGeo(0.3, 0.32, 0.35, 0.05, 6).rotateX(Math.PI / 2 + 0.25),
    lit('#4f8f34', 0.35, 0.06),
    m4(0, 0.4, 0.36),
  );
  // A curling vine and a mailbox.
  const vine: V3[] = [];
  for (let t = 0; t <= 1; t += 1 / 20)
    vine.push(
      v3(0.42 + t * 0.2, 0.02 + Math.sin(t * 9) * 0.02, -0.2 + t * 0.35),
    );
  k.add('matte', tube(vine, 0.014, 30, 5), '#5f8a34');
  k.add(
    'matte',
    beam(v3(0.5, 0, 0.42), v3(0.5, 0.26, 0.42), 0.03),
    wood('#7a5233'),
  );
  k.add('satin', rbox(0.1, 0.08, 0.14, 0.03), '#d9362c', m4(0.5, 0.29, 0.42));
  k.add(
    'satin',
    new THREE.BoxGeometry(0.01, 0.05, 0.03),
    '#ffd23a',
    m4(0.555, 0.32, 0.4 + rand() * 0.02),
  );
  return named('pumpkin house', k.ground(0.1, 0.22));
}

/** An ore works: a corrugated shed, a hopper on legs, a tall banded silo
 * with a ladder, and a conveyor carrying ore up from a heap to the hopper. */
function oreWorks(seed: number, ore: string) {
  const rand = seeded(seed);
  const k = new Kit();
  const steel = lit('#8b939e', 0.3, 0.04);
  const rust = lit('#b5653a', 0.25, 0.08);
  k.add(
    'matte',
    rbox(1.5, 0.08, 1.0, 0.03),
    lit('#8a8278', 0.3, 0.06),
    m4(0.05, -0.02, 0),
  );
  // The shed.
  k.add('matte', rbox(0.62, 0.36, 0.5, 0.02), rust, m4(-0.38, 0.18, 0.12));
  for (let j = 0; j < 9; j++)
    k.add(
      'matte',
      new THREE.BoxGeometry(0.012, 0.34, 0.51),
      lit('#9a4f2c', 0.2),
      m4(-0.66 + j * 0.07, 0.18, 0.12),
    );
  const tilt = m4(-0.38, 0.41, 0.12, 0.12, 0, 0);
  k.add('steel', rbox(0.7, 0.04, 0.6, 0.01), steel, tilt);
  for (let j = 0; j < 8; j++)
    k.add(
      'steel',
      new THREE.BoxGeometry(0.02, 0.05, 0.6),
      '#6f7782',
      tilt.clone().multiply(m4(-0.3 + j * 0.086, 0.01, 0)),
    );
  k.add('matte', rbox(0.2, 0.24, 0.02, 0.01), '#5d646e', m4(-0.38, 0.12, 0.38));
  k.add('glow', rbox(0.16, 0.05, 0.02, 0.01), '#ffd27a', m4(-0.6, 0.27, 0.375));
  // The silo.
  const sx = -0.52;
  const sz = -0.3;
  k.add(
    'steel',
    lathe(
      [
        [0, 0],
        [0.17, 0],
        [0.17, 0.92],
        [0.12, 1.02],
        [0.03, 1.05],
        [0, 1.05],
      ],
      20,
    ),
    lit('#d9dee5', 0.3, 0.03),
    m4(sx, 0, sz),
  );
  for (const y of [0.2, 0.45, 0.7, 0.9])
    k.add(
      'steel',
      new THREE.TorusGeometry(0.172, 0.012, 5, 24),
      '#c4572e',
      m4(sx, y, sz, Math.PI / 2, 0, 0),
    );
  for (const dz of [-0.04, 0.04])
    k.add(
      'steel',
      beam(v3(sx - 0.19, 0.02, sz + dz), v3(sx - 0.19, 0.95, sz + dz), 0.012),
      '#4a4f58',
    );
  for (let j = 0; j < 9; j++)
    k.add(
      'steel',
      beam(
        v3(sx - 0.19, 0.1 + j * 0.1, sz - 0.04),
        v3(sx - 0.19, 0.1 + j * 0.1, sz + 0.04),
        0.01,
      ),
      '#4a4f58',
    );
  k.add('glow', ball(1), '#ff5a3a', m4(sx, 1.07, sz, 0, 0, 0, 0.025));
  // The hopper on legs.
  const hx = 0.12;
  const hz = -0.18;
  for (const [dx, dz] of [
    [-0.13, -0.13],
    [0.13, -0.13],
    [-0.13, 0.13],
    [0.13, 0.13],
  ])
    k.add(
      'steel',
      beam(v3(hx + dx, 0, hz + dz), v3(hx + dx, 0.62, hz + dz), 0.03),
      steel,
    );
  k.add(
    'steel',
    beam(v3(hx - 0.13, 0.3, hz + 0.13), v3(hx + 0.13, 0.3, hz + 0.13), 0.02),
    steel,
  );
  k.add(
    'steel',
    flat(
      new THREE.CylinderGeometry(0.24, 0.07, 0.3, 4, 1).rotateY(Math.PI / 4),
    ),
    rust,
    m4(hx, 0.7, hz),
  );
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8),
    '#5d646e',
    m4(hx, 0.5, hz),
  );
  for (let j = 0; j < 6; j++)
    k.add(
      'facet',
      ball(0),
      lit(ore, 0.3),
      m4(
        hx + (rand() - 0.5) * 0.2,
        0.84,
        hz + (rand() - 0.5) * 0.2,
        j,
        j,
        0,
        0.05,
      ),
    );
  // A cart under the hopper.
  k.add(
    'matte',
    rbox(0.22, 0.1, 0.14, 0.02),
    lit('#6f7782', 0.3),
    m4(hx, 0.1, hz),
  );
  for (const dx of [-0.07, 0.07])
    k.add(
      'steel',
      new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10),
      '#2f3338',
      m4(hx + dx, 0.04, hz, Math.PI / 2, 0, 0),
    );
  // The conveyor: from a heap of ore up to the hopper.
  const a = v3(0.72, 0.08, 0.32);
  const b = v3(hx + 0.05, 0.86, hz + 0.02);
  const run = b.clone().sub(a);
  const along = (t: number) => a.clone().addScaledVector(run, t);
  k.add('steel', beam(a, b, 0.13, 0, 0.05), lit('#3a3f48', 0.3));
  for (const s of [-0.075, 0.075]) {
    const side = v3(-run.z, 0, run.x).normalize().multiplyScalar(s);
    k.add(
      'steel',
      beam(
        a
          .clone()
          .add(side)
          .add(v3(0, 0.03, 0)),
        b
          .clone()
          .add(side)
          .add(v3(0, 0.03, 0)),
        0.02,
        0,
        0.06,
      ),
      '#e0a030',
    );
  }
  for (let j = 1; j < 4; j++) {
    const p = along(j / 4);
    k.add('steel', beam(v3(p.x, 0, p.z), p, 0.035), steel);
  }
  for (let j = 0; j < 7; j++) {
    const p = along(0.08 + j * 0.13);
    k.add(
      'facet',
      ball(0),
      lit(ore, 0.3),
      m4(p.x, p.y + 0.06, p.z, j, j * 2, 0, 0.045),
    );
  }
  for (let j = 0; j < 8; j++) {
    const ang = rand() * TAU;
    const d = rand() * 0.12;
    k.add(
      'facet',
      ball(0),
      lit(j % 3 ? '#5a3a2e' : ore, 0.3),
      m4(
        0.78 + Math.cos(ang) * d,
        0.04,
        0.36 + Math.sin(ang) * d,
        j,
        j,
        0,
        0.06 + rand() * 0.03,
      ),
    );
  }
  k.add('glow', ball(1), '#ffd27a', m4(0.38, 0.62, -0.02, 0, 0, 0, 0.02));
  return named('ore works', k.ground(0.12, 0.25));
}

/** A launch pad: a round pad with lights, a chubby striped rocket on three
 * fins with a lit porthole, and a lattice gantry with its arm and a fuel
 * tank. */
function rocketPad(seed: number) {
  const rand = seeded(seed);
  const k = new Kit();
  k.add(
    'steel',
    flat(
      lathe(
        [
          [0, -0.1],
          [0.56, -0.1],
          [0.6, 0.02],
          [0.56, 0.06],
          [0, 0.06],
        ],
        16,
      ),
    ),
    lit('#8b939e', 0.3, 0.04),
  );
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * TAU;
    k.add(
      'glow',
      ball(1),
      j % 2 ? '#ffd27a' : '#ff5a3a',
      m4(Math.cos(a) * 0.52, 0.07, Math.sin(a) * 0.52, 0, 0, 0, 0.022),
    );
  }
  // The rocket.
  const white = then(lit('#f2f4f7', 0.25, 0.02), (p, _n, c) => {
    if (p.y > 0.42 && p.y < 0.5) c.set('#d9362c');
  });
  k.add(
    'satin',
    lathe(
      [
        [0, 0.12],
        [0.11, 0.12],
        [0.17, 0.25],
        [0.19, 0.45],
        [0.17, 0.7],
        [0.12, 0.84],
        [0, 0.88],
      ],
      24,
    ),
    white,
  );
  k.add(
    'satin',
    lathe(
      [
        [0.122, 0.83],
        [0.08, 0.92],
        [0.03, 0.99],
        [0, 1.0],
      ],
      24,
    ),
    lit('#d9362c', 0.25),
  );
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.09, 0.12, 0.08, 16),
    '#4a4f58',
    m4(0, 0.1, 0),
  );
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU;
    const fin = new THREE.ExtrudeGeometry(
      new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.15, -0.08),
        new THREE.Vector2(0.15, 0.04),
        new THREE.Vector2(0, 0.24),
      ]),
      { depth: 0.03, bevelEnabled: false },
    );
    fin.translate(0.15, 0.1, -0.015);
    k.add('satin', fin, lit('#d9362c', 0.25), m4(0, 0.04, 0, 0, a, 0));
  }
  k.add(
    'glow',
    new THREE.CircleGeometry(0.06, 16),
    '#9fe0ff',
    m4(0, 0.6, 0.185, -0.1, 0, 0),
  );
  k.add(
    'steel',
    new THREE.TorusGeometry(0.065, 0.014, 6, 18),
    '#aab3be',
    m4(0, 0.6, 0.183, -0.1, 0, 0),
  );
  // The gantry.
  const gx = -0.36;
  const lattice = lit('#e0a030', 0.25);
  for (const [dx, dz] of [
    [-0.07, -0.07],
    [0.07, -0.07],
    [-0.07, 0.07],
    [0.07, 0.07],
  ])
    k.add(
      'steel',
      beam(v3(gx + dx, 0.05, dz), v3(gx + dx, 0.95, dz), 0.025),
      lattice,
    );
  for (let j = 0; j < 5; j++) {
    const y0 = 0.08 + j * 0.18;
    for (const s of [-1, 1]) {
      k.add(
        'steel',
        beam(
          v3(gx - 0.07, y0, s * 0.07),
          v3(gx + 0.07, y0 + 0.18, s * 0.07),
          0.012,
        ),
        lattice,
      );
      k.add(
        'steel',
        beam(
          v3(gx + s * 0.07, y0, -0.07),
          v3(gx + s * 0.07, y0 + 0.18, 0.07),
          0.012,
        ),
        lattice,
      );
    }
  }
  k.add('steel', rbox(0.2, 0.03, 0.2, 0.01), '#6f7782', m4(gx, 0.96, 0));
  k.add(
    'steel',
    beam(v3(gx + 0.07, 0.72, 0), v3(-0.14, 0.72, 0), 0.04, 0, 0.06),
    lattice,
  );
  k.add(
    'steel',
    beam(v3(gx + 0.07, 0.86, 0), v3(gx - 0.02, 0.98, 0), 0.01),
    '#4a4f58',
  );
  k.add('glow', ball(2), '#ff4a3a', m4(gx, 1.0, 0, 0, 0, 0, 0.03));
  // A fuel tank and its pipe.
  k.add(
    'satin',
    new THREE.CapsuleGeometry(0.09, 0.2, 4, 12),
    lit('#d9dee5', 0.3),
    m4(0.36, 0.12, -0.3, 0, rand(), Math.PI / 2),
  );
  k.add(
    'steel',
    tube(
      [v3(0.24, 0.1, -0.28), v3(0.12, 0.08, -0.16), v3(0.06, 0.16, -0.09)],
      0.018,
      12,
      6,
    ),
    '#4a4f58',
  );
  return named('rocket pad', k.ground(0.12, 0.25));
}

/** An igloo village: three igloos round a campfire, with poles and strings
 * of coloured lights between them. */
function iglooVillage(seed: number) {
  const k = new Kit();
  const spots: V3[] = [];
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU + 0.3;
    spots.push(v3(Math.cos(a) * 0.64, 0, Math.sin(a) * 0.64));
    k.put(
      igloo(seed + j),
      m4(spots[j].x, 0, spots[j].z, 0, -a - Math.PI / 2, 0, 0.6),
    );
  }
  // The campfire.
  k.add(
    'matte',
    new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16),
    '#b9c9da',
    m4(0, 0.005, 0),
  );
  for (let j = 0; j < 7; j++) {
    const a = (j / 7) * TAU;
    k.add(
      'matte',
      blob(1, 0.2, seed + j),
      lit('#7d8794', 0.3),
      m4(Math.cos(a) * 0.13, 0.03, Math.sin(a) * 0.13, 0, 0, 0, 0.04),
    );
  }
  for (let j = 0; j < 4; j++)
    k.add(
      'matte',
      new THREE.CylinderGeometry(0.022, 0.022, 0.2, 6),
      wood('#6e4a2c'),
      m4(0, 0.05, 0, Math.PI / 2 - 0.35, (j / 4) * Math.PI, 0),
    );
  for (const [s, h, c] of [
    [0.08, 0.24, '#ff7a2a'],
    [0.05, 0.17, '#ffd23a'],
  ] as const)
    k.add('glow', new THREE.ConeGeometry(s, h, 8), c, m4(0, 0.06 + h / 2, 0));
  // Poles, and strings of lights sagging between them.
  const poles: V3[] = [];
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU + 0.3 + Math.PI / 3;
    const p = v3(Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56);
    poles.push(p);
    k.add('matte', beam(p, p.clone().setY(0.5), 0.035, 6), wood('#7a5233'));
    k.add('glow', ball(1), '#ffd27a', m4(p.x, 0.52, p.z, 0, 0, 0, 0.03));
  }
  const bulbs = ['#ff5a5a', '#ffd23a', '#7fd7ff', '#8fe36a', '#ff8fd0'];
  for (let j = 0; j < 3; j++) {
    const a = poles[j].clone().setY(0.48);
    const b = poles[(j + 1) % 3].clone().setY(0.48);
    const pts: V3[] = [];
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const p = a.clone().lerp(b, t);
      p.y -= 0.12 * 4 * t * (1 - t);
      pts.push(p);
    }
    k.add('matte', tube(pts, 0.006, 20, 4), '#3a3f48');
    for (let q = 1; q < 10; q++)
      k.add(
        'glow',
        ball(1),
        bulbs[(q + j) % bulbs.length],
        m4(pts[q].x, pts[q].y - 0.025, pts[q].z, 0, 0, 0, 0.022),
      );
  }
  return named('igloo village', k);
}

/** A fishing camp on a broad ice floe: a hut on skids with a stovepipe, a
 * fishing hole with a rod and a bucket of fish, penguins and a flag. */
function fishingCamp(seed: number) {
  const rand = seeded(seed);
  const shape = new THREE.Shape();
  const n = 18;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU;
    const r = 0.62 + 0.08 * Math.sin(a * 3 + seed) + rand() * 0.06;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.85;
    if (j) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.04,
    bevelSegments: 3,
    curveSegments: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.06, 0);
  const k = new Kit();
  const top = col('#f8fcff');
  const side = col('#8fcde8');
  k.add('snow', weld(g), (p, n2, c) => {
    c.copy(side).lerp(top, smooth(0.0, 0.05, p.y) * smooth(0.2, 0.8, n2.y));
  });
  // The hut on skids.
  const hx = -0.18;
  for (const z of [-0.14, 0.14])
    k.add('steel', rbox(0.5, 0.025, 0.04, 0.01), '#4a4f58', m4(hx, 0.08, z));
  k.add('matte', rbox(0.4, 0.3, 0.32, 0.015), wood('#c4553a'), m4(hx, 0.25, 0));
  for (let j = 0; j < 6; j++)
    k.add(
      'matte',
      new THREE.BoxGeometry(0.41, 0.012, 0.33),
      '#9a3f2c',
      m4(hx, 0.13 + j * 0.045, 0),
    );
  k.add(
    'matte',
    rbox(0.48, 0.04, 0.4, 0.01),
    lit('#f4f9ff', 0.2),
    m4(hx, 0.42, 0, 0, 0, 0.12),
  );
  k.add(
    'matte',
    rbox(0.11, 0.2, 0.02, 0.01),
    wood('#6e4a2c'),
    m4(hx + 0.08, 0.2, 0.17),
  );
  k.add(
    'glow',
    rbox(0.09, 0.07, 0.02, 0.01),
    '#ffd27a',
    m4(hx - 0.1, 0.28, 0.165),
  );
  k.add(
    'steel',
    new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8),
    '#4a4f58',
    m4(hx - 0.1, 0.5, -0.08),
  );
  // The fishing hole, a rod and a bucket of fish.
  const fx = 0.26;
  const fz = 0.12;
  k.add(
    'gloss',
    new THREE.CylinderGeometry(0.09, 0.09, 0.012, 18),
    '#1a4f8a',
    m4(fx, 0.03, fz),
  );
  k.add(
    'snow',
    new THREE.TorusGeometry(0.095, 0.02, 6, 20),
    '#dcecf8',
    m4(fx, 0.03, fz, Math.PI / 2, 0, 0),
  );
  k.add(
    'matte',
    beam(
      v3(fx + 0.14, 0.02, fz + 0.08),
      v3(fx + 0.02, 0.32, fz - 0.02),
      0.012,
      5,
    ),
    '#7a5233',
  );
  k.add(
    'matte',
    beam(v3(fx + 0.02, 0.32, fz - 0.02), v3(fx, 0.035, fz), 0.003, 3),
    '#e8e8e8',
  );
  k.add(
    'matte',
    lathe(
      [
        [0, 0],
        [0.05, 0],
        [0.06, 0.08],
        [0, 0.08],
      ],
      10,
    ),
    lit('#5f7f9a', 0.3),
    m4(fx + 0.2, 0.02, fz - 0.12),
  );
  for (let j = 0; j < 3; j++)
    k.add(
      'satin',
      new THREE.CapsuleGeometry(0.012, 0.05, 2, 6),
      '#b9c9da',
      m4(fx + 0.2 + (j - 1) * 0.02, 0.1, fz - 0.12, 0, 0, 0.3 * (j - 1)),
    );
  for (let j = 0; j < 3; j++) {
    const a = 2.2 + j * 0.5;
    k.put(
      penguin(),
      m4(Math.cos(a) * 0.4, 0.02, Math.sin(a) * 0.36, 0, a + 1.2, 0, 0.55),
    );
  }
  // A flag.
  k.add(
    'steel',
    beam(v3(0.36, 0.02, -0.3), v3(0.36, 0.5, -0.3), 0.015, 6),
    '#c9d1da',
  );
  k.add(
    'satin',
    new THREE.PlaneGeometry(0.16, 0.1),
    '#d9362c',
    m4(0.44, 0.44, -0.3),
  );
  return named('fishing camp', k.ground(0.1, 0.15));
}

/** A crystal refinery: a domed lab on a hexagonal platform, three pylons
 * arching over a great floating crystal, and glowing pipes to two tanks. */
function refinery(seed: number, tint: string, metal: string) {
  const k = new Kit();
  const plate = lit(metal, 0.3, 0.04);
  k.add(
    'steel',
    flat(
      lathe(
        [
          [0, -0.1],
          [0.6, -0.1],
          [0.64, 0.02],
          [0.6, 0.06],
          [0, 0.06],
        ],
        6,
      ),
    ),
    plate,
  );
  // The pylons and the crystal they hold.
  const legs: V3[] = [];
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU;
    const foot = v3(Math.cos(a) * 0.34, 0.06, Math.sin(a) * 0.34);
    legs.push(foot);
    k.add(
      'steel',
      tube(
        [
          foot,
          v3(Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3),
          v3(Math.cos(a) * 0.12, 0.84, Math.sin(a) * 0.12),
        ],
        0.03,
        16,
        8,
      ),
      lit('#e9edf2', 0.3),
    );
    k.add(
      'glow',
      ball(1),
      tint,
      m4(Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3, 0, 0, 0, 0.035),
    );
  }
  k.add(
    'steel',
    new THREE.TorusGeometry(0.13, 0.02, 6, 24),
    lit('#e9edf2', 0.3),
    m4(0, 0.84, 0, Math.PI / 2, 0, 0),
  );
  const rand = seeded(seed);
  const t = col(tint);
  const glowPaint: Paint = (p, _n, c) => {
    c.copy(t).multiplyScalar(0.6 + 0.4 * smooth(0.2, 0.9, p.y));
  };
  const gem = shardGeo(rand, 6, 0.3, 0.12, 0.16);
  k.add('crystal', gem, glowPaint, m4(0, 0.4, 0));
  k.add(
    'crystal',
    shardGeo(rand, 6, 0.12, 0.1, 0.1),
    glowPaint,
    m4(0, 0.4, 0, Math.PI, 0, 0),
  );
  // The lab.
  k.add(
    'satin',
    new THREE.SphereGeometry(0.2, 24, 10, 0, TAU, 0, Math.PI / 2),
    lit('#eef1f5', 0.25),
    m4(-0.4, 0.06, 0.3),
  );
  k.add(
    'glow',
    new THREE.TorusGeometry(0.2, 0.012, 5, 28),
    tint,
    m4(-0.4, 0.12, 0.3, Math.PI / 2, 0, 0),
  );
  k.add('steel', rbox(0.1, 0.12, 0.03, 0.02), '#6f7782', m4(-0.4, 0.12, 0.505));
  // Tanks and pipes.
  for (const [x, z] of [
    [0.42, 0.26],
    [0.42, -0.26],
  ]) {
    k.add(
      'satin',
      new THREE.CapsuleGeometry(0.08, 0.14, 4, 12),
      lit('#e9edf2', 0.3),
      m4(x, 0.2, z),
    );
    k.add(
      'glow',
      new THREE.CylinderGeometry(0.082, 0.082, 0.06, 12),
      tint,
      m4(x, 0.2, z),
    );
    k.add(
      'glow',
      tube(
        [v3(x, 0.1, z), v3(x * 0.6, 0.09, z * 0.6), legs[0].clone().setY(0.1)],
        0.018,
        12,
        6,
      ),
      tint,
    );
  }
  return named('refinery', k.ground(0.1, 0.2));
}

/** A crystal temple: a round stepped platform, a ring of crystal columns
 * under a glowing lintel, and a great spire in the middle. */
function crystalTemple(
  seed: number,
  tint: string,
  stone: string,
  gold: string,
) {
  const rand = seeded(seed);
  const k = new Kit();
  const rock = lit(stone, 0.3, 0.06);
  for (const [r, y] of [
    [0.62, 0],
    [0.52, 0.06],
    [0.42, 0.12],
  ] as const)
    k.add(
      'matte',
      new THREE.CylinderGeometry(r, r + 0.02, 0.06, 28),
      rock,
      m4(0, y, 0),
    );
  const t = col(tint);
  const glowPaint: Paint = (p, _n, c) => {
    c.copy(t).multiplyScalar(0.55 + 0.45 * smooth(0.1, 1.2, p.y));
  };
  const n = 6;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU;
    const x = Math.cos(a) * 0.36;
    const z = Math.sin(a) * 0.36;
    k.add(
      'crystal',
      shardGeo(rand, 6, 0.42, 0.05, 0.06),
      glowPaint,
      m4(x, 0.15, z),
    );
    k.add(
      'matte',
      new THREE.CylinderGeometry(0.07, 0.08, 0.05, 8),
      rock,
      m4(x, 0.17, z),
    );
  }
  k.add(
    'glow',
    new THREE.TorusGeometry(0.36, 0.025, 6, 48),
    gold,
    m4(0, 0.66, 0, Math.PI / 2, 0, 0),
  );
  k.add(
    'crystal',
    shardGeo(rand, 6, 0.62, 0.11, 0.24),
    glowPaint,
    m4(0, 0.15, 0),
  );
  for (let j = 0; j < 4; j++) {
    const a = (j / 4) * TAU + 0.4;
    k.add(
      'crystal',
      shardGeo(rand, 5, 0.2, 0.05, 0.08),
      glowPaint,
      aim(
        v3(Math.cos(a) * 0.08, 0.15, Math.sin(a) * 0.08),
        v3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6),
      ),
    );
  }
  return named('temple', k.ground(0.1, 0.2));
}

/** Instance a kit's meshes at many spots on the ground; `tinted` keys take a
 * colour per spot. */
function plantKit(
  body: THREE.Group,
  kit: Kit,
  mats: Mats,
  spots: THREE.Matrix4[],
  tinted: string[] = [],
  colours: string[] = [],
) {
  if (!spots.length) return;
  const c = new THREE.Color();
  for (const [key, geo] of kit.bake()) {
    const mesh = new THREE.InstancedMesh(geo, mats(key), spots.length);
    spots.forEach((m, k) => {
      mesh.setMatrixAt(k, m);
      if (tinted.includes(key))
        mesh.setColorAt(k, c.set(colours[k % colours.length]));
    });
    body.add(mesh);
  }
}

// ——— Planet looks ———

export type PlanetKind = 'food' | 'metal' | 'ice' | 'crystal';
type Look = {
  kind: PlanetKind;
  seed: number;
  /** Ground colours from low to high. */
  ground: string[];
  water?: string;
  air: string;
  /** Kind-specific accents. */
  accent: string[];
  variant?: 'pumpkin' | 'anvil' | 'floe' | 'rose';
};
/** One look per planet id (the ids are the old island ids); the second planet
 * of each cargo is a variation. */
export const planetLooks: Record<string, Look> = {
  pinewood: {
    kind: 'food',
    seed: 11,
    ground: ['#8fd16a', '#6cbb52', '#4f9e45', '#e3c66b', '#b9d86a'],
    water: '#3c9ad6',
    air: '#c4f5a8',
    accent: ['#e8463a'],
  },
  grove: {
    kind: 'food',
    seed: 53,
    ground: ['#d9b04a', '#c99a3e', '#a7a04a', '#8a5a30', '#e7c86a'],
    water: '#3d8fb8',
    air: '#ffe2a8',
    accent: ['#f08a24'],
    variant: 'pumpkin',
  },
  quarry: {
    kind: 'metal',
    seed: 23,
    ground: ['#c4572e', '#e08a4a', '#9a3f26', '#f0b07a', '#b5653a', '#7a3a2a'],
    air: '#ffb98a',
    accent: ['#c9d1da', '#aab4bf', '#e7ecf1'],
  },
  cliffs: {
    kind: 'metal',
    seed: 67,
    ground: ['#5d6470', '#7c8592', '#9aa3ae', '#4a505a', '#6c7480'],
    air: '#ffcf9e',
    accent: ['#d08a52', '#e0a86a', '#c9d1da'],
    variant: 'anvil',
  },
  meadow: {
    kind: 'ice',
    seed: 37,
    ground: ['#f6faff', '#e2edf8', '#c7dbef', '#a9c8e6'],
    water: '#8fd0f0',
    air: '#d6f1ff',
    accent: ['#bfe8ff', '#9fdcff', '#e6f7ff'],
  },
  downs: {
    kind: 'ice',
    seed: 79,
    ground: ['#d9c9a6', '#f6faff', '#e2edf8', '#c7dbef'],
    water: '#2f7fc4',
    air: '#bfe6ff',
    accent: ['#f8fcff', '#cfe9f8'],
    variant: 'floe',
  },
  spire: {
    kind: 'crystal',
    seed: 41,
    ground: ['#33285e', '#55469a', '#8e7fd2', '#d9cfff'],
    air: '#cdb8ff',
    accent: ['#b59bff', '#7fe6f0', '#efe6ff'],
  },
  shard: {
    kind: 'crystal',
    seed: 97,
    ground: ['#5e2850', '#a2487e', '#e08ab8', '#ffe6f2'],
    air: '#ffb8dc',
    accent: ['#ff8fc4', '#ffc78a', '#fff0f7'],
    variant: 'rose',
  },
};

/** The three years of a match; a planet grows from one to the next. */
export type Year = 1 | 2 | 3;

export type Planet = {
  group: THREE.Group;
  /** Spins with the ground; everything standing on it is a child. */
  body: THREE.Group;
  air: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  update: (t: number, dt: number) => void;
  /** How far everything drawn reaches from the centre (ground, features,
   * moons, rings, clouds; not the soft air), in planet radii. */
  reach: number;
};

// ——— Clearance: nothing on or round a planet ever collides ———

/** The room a thing takes, upright in its own frame: its height range; in
 * slices from the bottom up, how far it reaches from its axis (for what
 * circles the planet); and a grid of columns over the ground, each the
 * height range it fills there (for what stands beside it). */
type Shape = {
  y0: number;
  y1: number;
  r: number[];
  cols: Columns;
};
export type Columns = {
  x0: number;
  z0: number;
  cell: number;
  n: number;
  /** Per cell (x major); `lo > hi` where nothing stands. */
  lo: Float32Array;
  hi: Float32Array;
};
const SLICES = 8;
const GRID = 32;
/** Geometry to measure, moved into the thing's own frame by `m`. */
type Source = { geo: THREE.BufferGeometry; m: THREE.Matrix4 | null };
/** Visit every vertex (or every triangle's three) of some sources. */
function eachVertex(
  sources: Source[],
  fn: (x: number, y: number, z: number) => void,
  triangles = false,
) {
  for (const { geo, m } of sources) {
    const a = geo.getAttribute('position').array;
    const idx = triangles ? geo.index?.array : undefined;
    const e = m?.elements;
    const n = idx ? idx.length : a.length / 3;
    for (let i = 0; i < n; i++) {
      const k = (idx ? idx[i] : i) * 3;
      const x = a[k];
      const y = a[k + 1];
      const z = a[k + 2];
      if (e)
        fn(
          e[0] * x + e[4] * y + e[8] * z + e[12],
          e[1] * x + e[5] * y + e[9] * z + e[13],
          e[2] * x + e[6] * y + e[10] * z + e[14],
        );
      else fn(x, y, z);
    }
  }
}
function shapeOf(sources: Source[]): Shape {
  let y0 = Infinity;
  let y1 = -Infinity;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  eachVertex(sources, (x, y, z) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  });
  const r: number[] = Array(SLICES).fill(0);
  const span = Math.max(1e-6, y1 - y0);
  const cell = Math.max(x1 - x0, z1 - z0, 1e-6) / GRID;
  const n = GRID + 1;
  const lo = new Float32Array(n * n).fill(Infinity);
  const hi = new Float32Array(n * n).fill(-Infinity);
  const mark = (x: number, y: number, z: number) => {
    const k = Math.min(SLICES - 1, Math.floor(((y - y0) / span) * SLICES));
    const d = Math.sqrt(x * x + z * z);
    if (d > r[k]) r[k] = d;
    const c =
      Math.min(n - 1, ((x - x0) / cell) | 0) * n +
      Math.min(n - 1, ((z - z0) / cell) | 0);
    if (y < lo[c]) lo[c] = y;
    if (y > hi[c]) hi[c] = y;
  };
  // Fill each triangle finely enough that no column between its corners is
  // missed.
  const t = new Float32Array(9);
  let q = 0;
  eachVertex(
    sources,
    (x, y, z) => {
      t[q++] = x;
      t[q++] = y;
      t[q++] = z;
      if (q < 9) return;
      q = 0;
      const bx = t[3] - t[0];
      const bz = t[5] - t[2];
      const cx = t[6] - t[0];
      const cz = t[8] - t[2];
      const m = Math.min(
        48,
        Math.ceil(
          Math.max(
            Math.abs(bx) + Math.abs(bz),
            Math.abs(cx) + Math.abs(cz),
            Math.abs(bx - cx) + Math.abs(bz - cz),
          ) / cell,
        ),
      );
      if (m <= 1) {
        mark(t[0], t[1], t[2]);
        mark(t[3], t[4], t[5]);
        mark(t[6], t[7], t[8]);
        return;
      }
      const by = t[4] - t[1];
      const cy = t[7] - t[1];
      for (let u = 0; u <= m; u++)
        for (let v = 0; v <= m - u; v++) {
          const s = u / m;
          const w = v / m;
          mark(
            t[0] + bx * s + cx * w,
            t[1] + by * s + cy * w,
            t[2] + bz * s + cz * w,
          );
        }
    },
    true,
  );
  return { y0, y1, r, cols: { x0, z0, cell, n, lo, hi } };
}
const kitSources = (kit: Kit): Source[] =>
  [...kit.bake().values()].map((geo) => ({ geo, m: null }));
const kitShapes = new WeakMap<Kit, Shape>();
function kitShape(kit: Kit) {
  let s = kitShapes.get(kit);
  if (!s) kitShapes.set(kit, (s = shapeOf(kitSources(kit))));
  return s;
}
/** A moving part's geometry all through its motion, in its holder's frame. */
function motionSources(
  obj: THREE.Object3D,
  update: (t: number) => void,
  poses = 16,
) {
  const out: Source[] = [];
  const one = new THREE.Matrix4();
  for (let j = 0; j < poses; j++) {
    update(j * 0.43);
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      const mesh = o as THREE.InstancedMesh;
      if (!mesh.isMesh || !mesh.visible) return;
      const n = mesh.isInstancedMesh ? mesh.count : 1;
      for (let k = 0; k < n; k++) {
        const m = mesh.matrixWorld.clone();
        if (mesh.isInstancedMesh) m.multiply((mesh.getMatrixAt(k, one), one));
        out.push({ geo: mesh.geometry, m });
      }
    });
  }
  update(0);
  return out;
}
/** A shape grown sideways by `pad` (its own units), for things that sway. */
function widen(s: Shape, pad: number): Shape {
  const c = s.cols;
  const k = Math.ceil(pad / c.cell);
  const n = c.n + 2 * k;
  const lo = new Float32Array(n * n).fill(Infinity);
  const hi = new Float32Array(n * n).fill(-Infinity);
  for (let i = 0; i < c.n; i++)
    for (let j = 0; j < c.n; j++) {
      const src = i * c.n + j;
      if (c.lo[src] > c.hi[src]) continue;
      for (let di = -k; di <= k; di++)
        for (let dj = -k; dj <= k; dj++) {
          if (di * di + dj * dj > k * k) continue;
          const dst = (i + k + di) * n + (j + k + dj);
          lo[dst] = Math.min(lo[dst], c.lo[src]);
          hi[dst] = Math.max(hi[dst], c.hi[src]);
        }
    }
  return {
    ...s,
    r: s.r.map((r) => r + pad),
    cols: {
      x0: c.x0 - k * c.cell,
      z0: c.z0 - k * c.cell,
      cell: c.cell,
      n,
      lo,
      hi,
    },
  };
}

/** Where one thing stands, and the room it takes. */
export type Footprint = {
  name: string;
  /** The year it is first built, and the last it stands (if it is
   * replaced). */
  from: Year;
  until?: Year;
  /** Its foot, in the body's frame (planet radii). */
  at: THREE.Vector3;
  /** Its own frame, in the body's. */
  frame: THREE.Matrix4;
  /** Its height range above the foot, and each slice's reach from its axis
   * (planet radii). */
  y0: number;
  y1: number;
  r: number[];
  /** What it fills over the ground, in its own frame. */
  cols: Columns;
  /** Lies flat on the ground or the sea (prints, lily pads): never in the way. */
  flat: boolean;
};
/** Something circling the planet: the latitudes (about the spin axis) and
 * the distances from the centre it sweeps through. */
export type Belt = { name: string; lat: [number, number]; r: [number, number] };
export type Clearance = {
  /** The spin axis, in the body's frame. */
  axis: THREE.Vector3;
  feet: Footprint[];
  belts: Belt[];
  /** Highest ground, from the centre. */
  ground: number;
  /** Things built in an earlier year and cleared away for this year's. */
  cleared: string[];
  /** Things left out because they would have collided. */
  dropped: string[];
  /** Small props slid a little off their spot to keep clear. */
  slid: string[];
};
const clearances = new WeakMap<Planet, Clearance>();
/** What stands where on a built planet, for the clearance check
 * (scripts/alto-planet-check.mjs). */
export const clearanceOf = (planet: Planet) => clearances.get(planet);

/** A footprint's slices: the distances from the centre each spans, and its
 * reach from the thing's axis. */
function slices(f: Footprint) {
  const L = f.at.length();
  const h = (f.y1 - f.y0) / SLICES;
  return f.r.map((r, i) => ({
    lo: L + f.y0 + i * h,
    hi: L + f.y0 + (i + 1) * h,
    r,
  }));
}
const areas = new WeakMap<Columns, number>();
/** The ground a shape covers, in its own units. */
const filled = (c: Columns) => {
  let a = areas.get(c);
  if (a === undefined) {
    let k = 0;
    for (let i = 0; i < c.lo.length; i++) if (c.lo[i] <= c.hi[i]) k++;
    areas.set(c, (a = k * c.cell * c.cell));
  }
  return a;
};
/** Whether any column of `a`, walked up in small steps, enters one of
 * `b`'s columns (only `a`'s columns under `b`'s reach are walked). */
function enters(a: Footprint, b: Footprint) {
  const sa = v3().setFromMatrixColumn(a.frame, 0).length();
  const inv = a.frame.clone().invert();
  const mid = b.at.clone().applyMatrix4(inv);
  const reach = Math.max(...b.r) / sa + a.cols.cell;
  const e = b.frame.clone().invert().multiply(a.frame).elements;
  const c = a.cols;
  const C = b.cols;
  const cells = (v: number, v0: number) => [
    Math.max(0, Math.floor((v - reach - v0) / c.cell)),
    Math.min(c.n - 1, Math.ceil((v + reach - v0) / c.cell)),
  ];
  const [i0, i1] = cells(mid.x, c.x0);
  const [j0, j1] = cells(mid.z, c.z0);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const k = i * c.n + j;
      if (c.lo[k] > c.hi[k]) continue;
      const x = c.x0 + (i + 0.5) * c.cell;
      const z = c.z0 + (j + 0.5) * c.cell;
      const steps = Math.max(1, Math.ceil((c.hi[k] - c.lo[k]) / c.cell));
      for (let q = 0; q <= steps; q++) {
        const y = c.lo[k] + ((c.hi[k] - c.lo[k]) * q) / steps;
        const px = e[0] * x + e[4] * y + e[8] * z + e[12];
        const py = e[1] * x + e[5] * y + e[9] * z + e[13];
        const pz = e[2] * x + e[6] * y + e[10] * z + e[14];
        const I = Math.floor((px - C.x0) / C.cell);
        const J = Math.floor((pz - C.z0) / C.cell);
        if (I < 0 || J < 0 || I >= C.n || J >= C.n) continue;
        const K = I * C.n + J;
        if (py >= C.lo[K] && py <= C.hi[K]) return true;
      }
    }
  return false;
}
/** Whether two things standing on the ground would touch: no column of
 * either may enter the other's. */
export function collide(a: Footprint, b: Footprint) {
  if (a.flat || b.flat) return false;
  if (a.at.distanceTo(b.at) >= Math.max(...a.r) + Math.max(...b.r))
    return false;
  return enters(a, b) || enters(b, a);
}
/** How far a footprint reaches from the centre. */
const topOf = (f: Footprint) =>
  Math.max(...slices(f).map((s) => Math.hypot(s.hi, s.r)));
const latOf = (d: V3, axis: V3) =>
  Math.asin(Math.max(-1, Math.min(1, d.clone().normalize().dot(axis))));
/** How far out a footprint reaches within a band of latitudes (0 if it
 * stays out of the band). */
function topWithin(f: Footprint, axis: V3, lat: [number, number]) {
  const at = latOf(f.at, axis);
  let top = 0;
  for (const s of slices(f)) {
    const w = Math.atan2(s.r, s.lo);
    if (at - w < lat[1] && lat[0] < at + w)
      top = Math.max(top, Math.hypot(s.hi, s.r));
  }
  return top;
}
/** Whether a footprint sweeps through a belt as the planet spins. */
function inBelt(f: Footprint, axis: V3, b: Belt) {
  const at = latOf(f.at, axis);
  return slices(f).some((s) => {
    const w = Math.atan2(s.r, s.lo);
    return (
      at - w < b.lat[1] &&
      b.lat[0] < at + w &&
      s.lo < b.r[1] &&
      b.r[0] < Math.hypot(s.hi, s.r)
    );
  });
}
/** Directions spread evenly over a hemisphere (axes, so one half is enough). */
const axes = Array.from({ length: 900 }, (_, k) => {
  const y = 1 - (k + 0.5) / 900;
  const r = Math.sqrt(1 - y * y);
  const a = k * 2.399963;
  return v3(Math.cos(a) * r, y, Math.sin(a) * r);
});
/** The spin axis whose equator (± `band` radians) keeps clearest of the
 * tall things, so moons and rings can circle low without touching them. */
function clearAxis(tall: { d: V3; r: number }[], band: number, prefer: V3) {
  let best = prefer;
  let score = -Infinity;
  for (const a of [prefer, ...axes]) {
    let s = Infinity;
    for (const t of tall) s = Math.min(s, Math.abs(latOf(t.d, a)) - t.r);
    s = Math.min(s, band + 0.25);
    if (s > score + 1e-9) {
      score = s;
      best = a;
    }
  }
  return best.clone();
}
/** The farthest any vertex lies from the origin. */
function farthest(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute('position');
  let m = 0;
  for (let i = 0; i < p.count; i++)
    m = Math.max(m, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
  return m;
}

/** Moons on circular orbits round the spin axis, close to its equator. */
function moons(
  frame: THREE.Group,
  seed: number,
  tint: string,
  list: { size: number; r: number; tilt: number; phase: number }[],
  speed: number,
) {
  const made = list.map((o, k) => {
    const mesh = moon(seed + k, tint);
    mesh.scale.setScalar(o.size);
    frame.add(mesh);
    return { mesh, ...o };
  });
  /** How far a moon's craters and rims reach, from its middle. */
  const extent = Math.max(
    ...made.map((m) => farthest(m.mesh.geometry) * m.size),
  );
  const update = (t: number) => {
    for (const mo of made) {
      const a = mo.phase + t * speed;
      mo.mesh.position.set(
        Math.cos(a) * mo.r,
        Math.sin(a) * mo.r * Math.sin(mo.tilt),
        Math.sin(a) * mo.r * Math.cos(mo.tilt),
      );
      mo.mesh.rotation.y = t * 0.3;
    }
  };
  return { update, extent };
}

/** Ground levelled under a building: `h` at the centre, blending back to
 * the natural height between `r` and 1.8 r (radians). */
type Pad = { d: V3; r: number; h: number; from?: Year; until?: Year };
function levelled(pads: Pad[], base: (d: V3) => number) {
  return (d: V3) => {
    let h = base(d);
    for (const p of pads) {
      const a = d.angleTo(p.d);
      if (a < p.r * 1.8) h += (p.h - h) * smooth(p.r * 1.8, p.r, a);
    }
    return h;
  };
}
/** How far (radians) `d` is from the great-circle path a→b; 9 off its ends. */
function pathOff(d: V3, a: V3, b: V3) {
  const ab = a.angleTo(b);
  if (d.angleTo(a) > ab + 0.04 || d.angleTo(b) > ab + 0.04) return 9;
  const n = a.clone().cross(b).normalize();
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, d.dot(n)))));
}
/** Name a kit, for the clearance report. */
const named = <K extends Kit>(name: string, kit: K) => {
  kitNames.set(kit, name);
  return kit;
};
const kitNames = new WeakMap<Kit, string>();

// ——— The four kinds of planet ———

/**
 * One planet as it stands in `year`: the first year shows its first humble
 * settlement, the second the full planet, the third grows it further with
 * more of everything and one new landmark. Every year is the same place:
 * what stands in a year stands at the same spot the next (unless a bigger
 * building clears it away), so the planet visibly grows.
 */
export function buildPlanet(id: string, year: Year = 2): Planet {
  const look = planetLooks[id] ?? planetLooks.pinewood;
  const rand = seeded(look.seed);
  /** What the third year adds draws from its own stream, so the first two
   * years never shift. */
  const rand3 = seeded(look.seed * 31 + 7);
  const noise = new SimplexNoise({ random: seeded(look.seed * 7 + 1) });
  const group = new THREE.Group();
  // `frame` holds the spin axis upright (moons and rings circle in it);
  // `body` spins in it.
  const frame = new THREE.Group();
  const body = new THREE.Group();
  group.add(frame);
  frame.add(body);
  // Each planet leans its own way.
  const lean = [0.3 + rand() * 0.25, rand() * 6, (rand() - 0.5) * 0.5];
  frame.rotation.x = lean[0];
  let axis = v3(Math.sin(lean[2]), Math.cos(lean[2]), 0);
  const air = atmosphere(look.air, 1.14);
  group.add(air);
  const updates: ((t: number, dt: number) => void)[] = [];
  const g = look.ground.map(col);
  const DETAIL = 64;
  const taken: THREE.Vector3[] = [];
  const pads: Pad[] = [];
  /** What already stands, and how much ground (radians) it covers. */
  const bigs: { d: V3; r: number }[] = [];
  /** The tall things, for choosing a spin axis whose equator keeps clear. */
  const tall: { d: V3; r: number }[] = [];
  const clear = (d: V3, gap = 0.015) =>
    bigs.every((b) => b.d.angleTo(d) > b.r + gap);
  const world = new Kit();
  let mats = materials();
  let height: (d: V3) => number = () => 0;
  const shown = (p: { from?: Year; until?: Year }) =>
    (p.from ?? 1) <= year && year <= (p.until ?? 3);

  // Everything is noted first with its footprint and the year it is built;
  // what stands this year is decided at the end, so nothing ever collides.
  type Item = Footprint & {
    until: Year;
    size: number;
    /** A small prop that may slide a little to keep clear. */
    loose: boolean;
    emit: (at: THREE.Matrix4) => void;
  };
  const items: Item[] = [];
  let era: Year = 1;
  let lasts: Year = 3;
  let loose = false;
  /** Note what `fn` puts down as built in year `from` (and gone after
   * `until`). */
  const during = (from: Year, fn: () => void, until: Year = 3) => {
    const was = [era, lasts] as const;
    era = from;
    lasts = until;
    fn();
    [era, lasts] = was;
  };
  const note = (
    name: string,
    shape: Shape,
    at: THREE.Matrix4,
    emit: (at: THREE.Matrix4) => void,
    flat = false,
  ) => {
    const s = v3().setFromMatrixColumn(at, 0).length();
    items.push({
      loose,
      name,
      from: era,
      until: lasts,
      at: v3().setFromMatrixPosition(at),
      frame: at,
      y0: shape.y0 * s,
      y1: shape.y1 * s,
      r: shape.r.map((x) => x * s),
      cols: shape.cols,
      flat,
      size: filled(shape.cols) * (shape.y1 - shape.y0) * s ** 3,
      emit,
    });
  };
  /** Put a kit down at a ready matrix, merged with the rest of the planet. */
  const put = (kit: Kit, at: THREE.Matrix4, flat = false) =>
    note(
      kitNames.get(kit) ?? 'prop',
      kitShape(kit),
      at,
      (m) => world.put(kit, m),
      flat,
    );
  /** Stand a kit on the ground at `d`, merged with the rest of the planet. */
  const stand = (kit: Kit, d: V3, s: number, sink = 0, spin = rand() * TAU) => {
    const at = standOn(d, 1 + height(d) - sink, s, spin);
    put(kit, at);
    return at;
  };
  /** Same, for a feature with a moving part. */
  const standMoving = (
    f: { kit: Kit; moving: THREE.Object3D; update: (t: number) => void },
    d: V3,
    s: number,
    speed = 1,
    name = 'feature',
    spin = rand() * TAU,
  ) => {
    const at = standOn(d, 1 + height(d), s, spin);
    const shape = shapeOf([
      ...kitSources(f.kit),
      ...motionSources(f.moving, f.update),
    ]);
    note(name, shape, at, (m) => {
      world.put(f.kit, m);
      const holder = new THREE.Group();
      holder.applyMatrix4(m);
      holder.add(f.moving);
      body.add(holder);
      updates.push((t) => f.update(t * speed));
    });
    return at;
  };
  /** Many of one kit, instanced; `colour` tints its `tinted` keys. */
  const groves = new Map<
    Kit,
    { spots: THREE.Matrix4[]; colours: string[]; tinted: string[] }
  >();
  const plant = (
    kit: Kit,
    spots: THREE.Matrix4[],
    from: (k: number) => Year = () => era,
    tinted: string[] = [],
    colours: string[] = [],
  ) =>
    spots.forEach((at, k) =>
      during(
        from(k),
        () =>
          note(kitNames.get(kit) ?? 'plant', kitShape(kit), at, (m) => {
            let grove = groves.get(kit);
            if (!grove)
              groves.set(kit, (grove = { spots: [], colours: [], tinted }));
            grove.spots.push(m);
            if (colours.length) grove.colours.push(colours[k % colours.length]);
          }),
        lasts,
      ),
    );
  /** Small props round a spot, kept off everything big. */
  const around = (
    d: V3,
    count: number,
    from: number,
    to: number,
    place: (dd: V3, k: number) => void,
    rng = rand,
    ok = clear,
    list = bigs,
  ) => {
    let n = 0;
    for (let k = 0; k < count * 12 && n < count; k++) {
      const dd = near(d, from + rng() * (to - from), rng);
      if (!ok(dd)) continue;
      loosely(() => place(dd, n++));
      list.push({ d: dd, r: 0.025 });
    }
  };
  /** Note small props that may slide a little to keep clear. */
  const loosely = (fn: () => void) => {
    const was = loose;
    loose = true;
    fn();
    loose = was;
  };
  // Year three adds more of everything and a landmark, at spots drawn from
  // its own stream once the first two years' are chosen, so those never
  // shift; its props keep their own list.
  const later: { d: V3; r: number }[] = [];
  const taken3: V3[] = [];
  /** Spots for what year three adds, clear of all the first two years put
   * down; `pad` levels the ground under a building (at height `h`). */
  const room3 = (
    count: number,
    gap: number,
    r: number,
    ok: (d: V3) => boolean,
    pad = 0,
    h: (d: V3) => number = () => 0,
  ) => {
    if (!taken3.length) taken3.push(...taken);
    const free = (d: V3) =>
      ok(d) &&
      [...bigs, ...later].every((b) => b.d.angleTo(d) > b.r + r + 0.02);
    // Crowded planets settle for less elbow room.
    const found: V3[] = [];
    for (const f of [1, 0.8, 0.65, 0.5])
      if (found.length < count)
        found.push(
          ...scatter(rand3, count - found.length, gap * f, free, taken3),
        );
    return found.map((d) => {
      if (pad) pads.push({ d, r: pad, h: h(d), from: 3 });
      later.push({ d, r });
      tall.push({ d, r });
      return d;
    });
  };
  const clear3 = (d: V3, gap = 0.015) =>
    clear(d, gap) && later.every((b) => b.d.angleTo(d) > b.r + gap);
  /** Props round a year-three spot. */
  const around3 = (
    d: V3,
    count: number,
    from: number,
    to: number,
    place: (dd: V3, k: number) => void,
  ) => around(d, count, from, to, place, rand3, clear3, later);
  const spin3 = () => rand3() * TAU;
  /** Note what year three adds; all of it may slide a little to keep
   * clear. */
  const grow3 = (fn: () => void) => during(3, () => loosely(fn));
  /** How much of the ground is farmed (food planets), by year. */
  const farmed = [0.18, 0.06, -0.04][year - 1];
  let belt: 'clouds' | 'moons' | 'rings' = 'clouds';
  let cloudCount = 3;
  let cloudTint = '#ffffff';
  let cloudTurn = 0.03;
  let groundTop = 1.001;
  let crystals: THREE.Material | undefined;
  /** Set by a planet with a whale: it picks a clear swim once all else
   * stands. */
  let swim: ((feet: Footprint[]) => Footprint[]) | undefined;

  if (look.kind === 'food') {
    const pumpkins = look.variant === 'pumpkin';
    const base = (d: V3) =>
      fbm(noise, d.x * 0.9, d.y * 0.9, d.z * 0.9, 3) * 0.05 + 0.04;
    const land = (d: V3) => base(d) > 0.014;
    const fieldAxis = randomDir(rand);
    // Decide where the big things stand first, so the ground can be
    // levelled under the buildings and paths run between them.
    const spot = (d: V3, r: number, pad = 0, from?: Year) => {
      if (pad) pads.push({ d, r: pad, h: base(d), from });
      bigs.push({ d, r });
      tall.push({ d, r });
      return d;
    };
    const trees = pumpkins
      ? []
      : scatter(rand, 6, 0.66, land, taken).map((d) => spot(d, 0.1));
    const houses = pumpkins
      ? []
      : scatter(rand, 2, 0.75, land, taken).map((d) => spot(d, 0.25, 0.2, 2));
    const barns = pumpkins
      ? []
      : scatter(rand, 1, 0.7, land, taken).map((d) => spot(d, 0.27, 0.24, 2));
    const patch = pumpkins
      ? scatter(rand, 7, 0.55, land, taken).map((d) => spot(d, 0.12))
      : [];
    const flowersAt = pumpkins
      ? scatter(rand, 6, 0.5, land, taken).map((d) => spot(d, 0.06))
      : [];
    const bales = pumpkins
      ? scatter(rand, 3, 0.5, land, taken).map((d) => spot(d, 0.08))
      : [];
    const mills = pumpkins
      ? scatter(rand, 1, 0.7, land, taken).map((d) => spot(d, 0.2, 0.17, 2))
      : [];
    const crows = pumpkins
      ? scatter(rand, 1, 0.45, land, taken).map((d) => spot(d, 0.08, 0.06))
      : [];
    // Year three: a village (or a pumpkin house and a barn), another
    // greenhouse, more trees, pumpkins, sunflowers and bales.
    const home3 = room3(1, 0.8, pumpkins ? 0.33 : 0.39, land, 0.28, base);
    const barns3 = pumpkins ? room3(1, 0.7, 0.27, land, 0.24, base) : [];
    const houses3 = pumpkins ? [] : room3(1, 0.7, 0.25, land, 0.2, base);
    const trees3 = pumpkins ? [] : room3(3, 0.42, 0.1, land);
    const patch3 = pumpkins ? room3(5, 0.4, 0.12, land) : [];
    const flowers3 = pumpkins ? room3(4, 0.35, 0.06, land) : [];
    const bales3 = pumpkins ? room3(2, 0.4, 0.08, land) : [];
    // The first year's hut stands where the barn or the windmill comes.
    const hub = barns[0] ?? mills[0];
    if (hub) pads.push({ d: hub, r: 0.1, h: base(hub), until: 1 });
    const decide = levelled(
      pads.filter((p) => (p.from ?? 1) <= 2 && !p.until),
      base,
    );
    height = levelled(pads.filter(shown), base);
    const paths: [V3, V3][] = [];
    if (hub) {
      for (const h of [...houses, ...crows]) paths.push([hub, h]);
      const nearest = [...trees, ...bales]
        .sort((a, b) => a.angleTo(hub) - b.angleTo(hub))
        .slice(0, 2);
      for (const t of nearest) paths.push([hub, t]);
    }
    // The first year has only tracks to the nearest of what grows then; the
    // third adds tracks to its new buildings.
    const trails =
      year === 2 || !hub
        ? paths
        : year === 3
          ? [
              ...paths,
              ...[...home3, ...barns3, ...houses3].map((d): [V3, V3] => [
                hub,
                d,
              ]),
            ]
          : [...trees.slice(0, 3), ...bales.slice(0, 1), ...crows]
              .sort((a, b) => a.angleTo(hub) - b.angleTo(hub))
              .slice(0, 2)
              .map((t): [V3, V3] => [hub, t]);
    const sand = col('#e6d9a0');
    const dirt = col(pumpkins ? '#b88a4e' : '#c9a46a');
    const deep = col('#4f8f78');
    const tmp = new THREE.Color();
    const yards = pads.filter(shown);
    const ground = terrain(
      DETAIL,
      (d, c) => {
        const h = height(d);
        const v = 0.5 + 0.5 * noise.noise3d(d.x * 3, d.y * 3, d.z * 3);
        c.copy(g[0])
          .lerp(g[1], v)
          .lerp(g[2], smooth(0.03, 0.075, h) * 0.6);
        c.multiplyScalar(
          0.93 + 0.09 * noise.noise3d(d.x * 17, d.y * 17, d.z * 17),
        );
        let yard = 0;
        for (const p of yards)
          yard = Math.max(yard, smooth(p.r * 1.25, p.r * 0.75, d.angleTo(p.d)));
        // Patchwork fields with soft edges and crop rows.
        const pn = noise.noise3d(d.x * 1.6 + 7, d.y * 1.6, d.z * 1.6);
        const field =
          smooth(farmed, farmed + 0.16, pn) *
          smooth(0.006, 0.016, h) *
          (1 - yard);
        let rows = 0.5;
        if (field > 0) {
          rows = smooth(-0.6, 0.6, Math.sin(d.dot(fieldAxis) * 55 + pn * 4));
          tmp
            .copy(g[3])
            .lerp(g[4], 0.25 + 0.5 * rows)
            .multiplyScalar(0.92 + 0.1 * rows);
          c.lerp(tmp, 0.85 * field);
        }
        let path = 9;
        for (const [a, b] of trails) path = Math.min(path, pathOff(d, a, b));
        path += 0.006 * noise.noise3d(d.x * 20, d.y * 20, d.z * 20);
        const trail = smooth(0.03, 0.017, path) * smooth(0.0, 0.008, h);
        c.lerp(dirt, Math.max(trail * 0.85, yard * 0.6));
        c.lerp(sand, smooth(0.01, 0.003, h) * 0.75);
        if (h < -0.002) c.lerp(deep, smooth(-0.002, -0.02, h) * 0.6);
        const relief =
          field * (rows - 0.5) * 0.005 +
          0.0025 * noise.noise3d(d.x * 24, d.y * 24, d.z * 24) * (1 - yard) -
          trail * 0.002;
        return (h < 0 ? h * 0.7 : h) + relief;
      },
      0.3,
    );
    groundTop = Math.max(groundTop, farthest(ground));
    body.add(new THREE.Mesh(ground, groundMat()));
    body.add(waterSphere(look.water!));
    // Lily pads on the ponds and reeds at their edges.
    const lily = new Kit();
    lily.add(
      'satin',
      new THREE.CylinderGeometry(0.5, 0.5, 0.04, 16, 1, false, 0.3, TAU - 0.6),
      lit('#4f9a3a', 0.3, 0.08),
    );
    const lilyFlower = new Kit().put(lily, new THREE.Matrix4());
    lilyFlower.add(
      'satin',
      ball(2),
      '#ffb8d0',
      m4(0.1, 0.08, 0, 0, 0, 0, [0.14, 0.1, 0.14]),
    );
    named('lily pad', lily);
    named('lily pad', lilyFlower);
    for (const d of scatter(rand, 9, 0.12, (d) => base(d) < -0.012, [])) {
      const pad = rand() < 0.4 ? lilyFlower : lily;
      put(pad, standOn(d, 1.0015, 0.05 + rand() * 0.02, rand() * TAU), true);
    }
    const reed = named('reeds', new Kit());
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * TAU;
      const top = v3(
        Math.cos(a) * 0.15,
        0.8 + (j % 3) * 0.2,
        Math.sin(a) * 0.15,
      );
      reed.add(
        'matte',
        beam(v3(Math.cos(a) * 0.05, -0.1, Math.sin(a) * 0.05), top, 0.04, 4),
        '#6f9a44',
      );
      if (j % 2)
        reed.add(
          'matte',
          new THREE.CapsuleGeometry(0.05, 0.16, 2, 6),
          '#7a4a2a',
          m4(top.x, top.y - 0.1, top.z),
        );
    }
    for (const d of scatter(
      rand,
      8,
      0.08,
      (d) => base(d) > -0.003 && base(d) < 0.004,
      [],
    ))
      if (clear(d)) put(reed, standOn(d, 1 + height(d), 0.07, rand() * TAU));
    // Big features.
    const bushKits = [
      bush(look.seed, pumpkins ? '#7a9a3a' : '#4f9e3f'),
      bush(
        look.seed + 3,
        pumpkins ? '#8aa440' : '#5aa848',
        pumpkins ? undefined : '#e8463a',
      ),
    ].map((k) => named('bush', k));
    const rockKit = named(
      'rock',
      rock(look.seed, pumpkins ? '#a8957a' : '#9c9a92'),
    );
    const flowerKit = named(
      'flowers',
      flowers(
        look.seed,
        pumpkins
          ? ['#ffd23a', '#f08a24', '#ffffff']
          : ['#ff8fb0', '#ffffff', '#b59bff', '#ffd23a'],
      ),
    );
    /** The first year's trees and pumpkins are young. */
    const young = year === 1 ? 0.72 : 1;
    if (!pumpkins) {
      const treeKits = [appleTree(look.seed), appleTree(look.seed + 5)].map(
        (k) => named('apple tree', k),
      );
      treeKits.forEach((kit, v) => {
        const mine = trees.filter((_, i) => i % 2 === v);
        plant(
          kit,
          mine.map((d) =>
            standOn(
              d,
              1 + height(d) - 0.012,
              (0.27 + rand() * 0.05) * young,
              rand() * TAU,
            ),
          ),
          (k) => (trees.indexOf(mine[k]) < 3 ? 1 : 2),
        );
      });
      during(2, () => {
        houses.forEach((d, k) =>
          stand(named('greenhouse', greenhouse(look.seed + k)), d, 0.4),
        );
        barns.forEach((d, k) =>
          stand(named('barn', barn(look.seed + k)), d, 0.32),
        );
      });
      if (hub) during(1, () => stand(hut(look.seed), hub, 0.2, 0.004, 0.6), 1);
      const appleCrate = named('crate', crate(look.seed, '#d9362c'));
      trees.forEach((t, i) => {
        during(i < 3 ? 1 : 2, () =>
          around(t, 1 + Math.floor(rand() * 2), 0.11, 0.16, (dd) =>
            stand(
              bushKits[Math.floor(rand() * 2)],
              dd,
              0.075 + rand() * 0.03,
              0.004,
            ),
          ),
        );
        // Wild flowers grow from the start; crates come with the harvest.
        around(t, 1, 0.1, 0.15, (dd) =>
          rand() < 0.5
            ? during(2, () => stand(appleCrate, dd, 0.05))
            : during(i < 3 ? 1 : 2, () => stand(flowerKit, dd, 0.07)),
        );
      });
      during(2, () => {
        for (const h of houses)
          around(h, 2, 0.28, 0.34, (dd) => stand(flowerKit, dd, 0.075));
      });
      if (year === 3)
        grow3(() => {
          treeKits.forEach((kit, v) =>
            plant(
              kit,
              trees3
                .filter((_, i) => i % 2 === v)
                .map((d) =>
                  standOn(
                    d,
                    1 + height(d) - 0.012,
                    0.27 + rand3() * 0.05,
                    spin3(),
                  ),
                ),
            ),
          );
          houses3.forEach((d) =>
            stand(
              named('greenhouse', greenhouse(look.seed + 7)),
              d,
              0.4,
              0,
              spin3(),
            ),
          );
          home3.forEach((d) => {
            stand(village(look.seed), d, 0.4, 0.004, spin3());
            around3(d, 3, 0.42, 0.5, (dd) =>
              stand(flowerKit, dd, 0.075, 0, spin3()),
            );
          });
          for (const t of trees3) {
            around3(t, 1, 0.11, 0.16, (dd) =>
              stand(
                bushKits[Math.floor(rand3() * 2)],
                dd,
                0.075 + rand3() * 0.03,
                0.004,
                spin3(),
              ),
            );
            around3(t, 1, 0.1, 0.15, (dd) =>
              rand3() < 0.5
                ? stand(appleCrate, dd, 0.05, 0, spin3())
                : stand(flowerKit, dd, 0.07, 0, spin3()),
            );
          }
        });
    } else {
      const big = named('pumpkin', pumpkin(2));
      const small = named('pumpkin', pumpkin(3));
      const firstPumpkins = (i: number) => (i < 4 ? 1 : 2);
      plant(
        big,
        patch
          .filter((_, i) => i % 2 === 0)
          .map((d) =>
            standOn(
              d,
              1 + height(d) - 0.01,
              (0.24 + rand() * 0.06) * young,
              rand() * TAU,
            ),
          ),
        (k) => firstPumpkins(k * 2),
      );
      plant(
        small,
        patch
          .filter((_, i) => i % 2 === 1)
          .map((d) =>
            standOn(
              d,
              1 + height(d) - 0.01,
              (0.22 + rand() * 0.05) * young,
              rand() * TAU,
            ),
          ),
        (k) => firstPumpkins(k * 2 + 1),
      );
      plant(
        named('sunflower', sunflower(look.seed)),
        flowersAt.map((d) =>
          standOn(d, 1 + height(d) - 0.01, 0.3 + rand() * 0.04, rand() * TAU),
        ),
        (k) => (k < 3 ? 1 : 2),
      );
      const bale = named('hay bale', hayBale());
      bales.forEach((d, i) => {
        during(i < 1 ? 1 : 2, () => stand(bale, d, 0.22, 0.005));
        during(2, () =>
          around(d, 1, 0.08, 0.1, (dd) => stand(bale, dd, 0.15, 0.004)),
        );
      });
      during(2, () => {
        for (const d of mills) {
          standMoving(windmill(mats), d, 0.42, 1, 'windmill');
          const pumpkinCrate = named('crate', crate(look.seed + 1, '#f08a24'));
          around(d, 2, 0.21, 0.26, (dd) => stand(pumpkinCrate, dd, 0.05));
        }
      });
      if (hub) during(1, () => stand(hut(look.seed), hub, 0.2, 0.004, 0.6), 1);
      for (const d of crows) stand(named('scarecrow', scarecrow()), d, 0.3);
      const fenceKit = named('fence', fence(2));
      for (const [i, p] of patch.entries()) {
        const from = firstPumpkins(i);
        if (i % 2)
          during(2, () =>
            around(p, 1, 0.13, 0.17, (dd) => stand(fenceKit, dd, 0.055, 0.003)),
          );
        during(from, () =>
          around(p, 1, 0.12, 0.17, (dd) =>
            stand(
              bushKits[Math.floor(rand() * 2)],
              dd,
              0.07 + rand() * 0.03,
              0.004,
            ),
          ),
        );
      }
      during(2, () => {
        for (const f of flowersAt)
          around(f, 1, 0.07, 0.1, (dd) => stand(flowerKit, dd, 0.07));
      });
      if (year === 3)
        grow3(() => {
          const at = (d: V3, s: number) =>
            standOn(d, 1 + height(d) - 0.01, s, spin3());
          plant(
            big,
            patch3
              .filter((_, i) => i % 2 === 0)
              .map((d) => at(d, 0.24 + rand3() * 0.06)),
          );
          plant(
            small,
            patch3
              .filter((_, i) => i % 2 === 1)
              .map((d) => at(d, 0.22 + rand3() * 0.05)),
          );
          plant(
            named('sunflower', sunflower(look.seed)),
            flowers3.map((d) => at(d, 0.3 + rand3() * 0.04)),
          );
          for (const d of bales3) {
            stand(bale, d, 0.22, 0.005, spin3());
            around3(d, 1, 0.08, 0.1, (dd) =>
              stand(bale, dd, 0.15, 0.004, spin3()),
            );
          }
          barns3.forEach((d) =>
            stand(named('barn', barn(look.seed + 3)), d, 0.32, 0, spin3()),
          );
          home3.forEach((d) => {
            stand(pumpkinHouse(look.seed), d, 0.46, 0.004, spin3());
            around3(d, 2, 0.34, 0.4, (dd) =>
              stand(flowerKit, dd, 0.07, 0, spin3()),
            );
          });
          for (const p of patch3)
            around3(p, 1, 0.13, 0.17, (dd) =>
              stand(fenceKit, dd, 0.055, 0.003, spin3()),
            );
        });
    }
    loosely(() => {
      for (const d of scatter(rand, 6, 0.3, land, []))
        if (clear(d, 0.04)) stand(rockKit, d, 0.06 + rand() * 0.03, 0.006);
    });
    const lamp = named('lamp', lampPost());
    during(2, () => {
      for (const [a, b] of paths.slice(0, 3)) {
        const m = a.clone().lerp(b, 0.5).normalize();
        const side = near(m, 0.035, rand);
        if (clear(side, 0.01) && decide(side) > 0.008) stand(lamp, side, 0.07);
      }
    });
    cloudCount = 3;
  }

  if (look.kind === 'metal') {
    const anvil = look.variant === 'anvil';
    const craters = Array.from({ length: anvil ? 7 : 5 }, () => ({
      c: randomDir(rand),
      r: 0.2 + rand() * 0.22,
    }));
    const step = 0.034;
    // Height before the terraces are cut.
    const raw = (d: THREE.Vector3) => {
      let h = fbm(noise, d.x * 1.0, d.y * 1.0, d.z * 1.0, 4) * 0.11 + 0.02;
      for (const cr of craters) {
        const a = d.angleTo(cr.c) / cr.r;
        if (a < 1.3)
          h += a < 1 ? -0.06 * (1 - a * a) : 0.018 * smooth(1.3, 1, a);
      }
      return h;
    };
    const cut = (d: THREE.Vector3) => {
      if (anvil) return raw(d);
      const t = raw(d) / step;
      const f = t - Math.floor(t);
      return (Math.floor(t) + smooth(0.82, 1, f)) * step;
    };
    const flatGround = (d: THREE.Vector3) =>
      craters.every((cr) => d.angleTo(cr.c) > cr.r * 1.05);
    const spot = (d: V3, r: number, pad: number) => {
      pads.push({ d, r: pad, h: cut(d) });
      bigs.push({ d, r });
      tall.push({ d, r });
      return d;
    };
    const towers = anvil
      ? []
      : scatter(rand, 3, 0.9, flatGround, taken).map((d) =>
          spot(d, 0.18, 0.15),
        );
    const domes = anvil
      ? scatter(rand, 2, 1.0, flatGround, taken).map((d) => spot(d, 0.3, 0.26))
      : [];
    const furnaces = anvil
      ? scatter(rand, 1, 0.9, flatGround, taken).map((d) => spot(d, 0.2, 0.15))
      : [];
    const ores = scatter(rand, 8, 0.5, () => true, taken).map((d) => {
      bigs.push({ d, r: 0.07 });
      tall.push({ d, r: 0.07 });
      return d;
    });
    // Year three: an ore works (or a launch pad and another base), another
    // headframe and more ore.
    const works3 = room3(1, 0.9, anvil ? 0.27 : 0.36, flatGround, 0.26, cut);
    const more3 = room3(
      1,
      0.9,
      anvil ? 0.3 : 0.18,
      flatGround,
      anvil ? 0.26 : 0.15,
      cut,
    );
    const ores3 = room3(3, 0.45, 0.07, () => true);
    height = levelled(pads.filter(shown), cut);
    const ledge = g.map((c) => c.clone());
    const face = g.map((c) => c.clone().multiplyScalar(0.6));
    const dust = col(anvil ? '#8a919c' : '#e8a070');
    const yards = pads.filter(shown);
    const ground = terrain(
      80,
      (d, c) => {
        const r = raw(d);
        if (anvil) {
          const v = 0.5 + 0.5 * noise.noise3d(d.x * 3, d.y * 3, d.z * 3);
          c.copy(g[0])
            .lerp(g[1], v)
            .lerp(g[2], smooth(0.04, 0.09, r))
            .lerp(g[3], smooth(0, -0.04, r));
        } else {
          const t = r / step;
          const band = ((Math.floor(t) % g.length) + g.length) % g.length;
          c.copy(ledge[band]).lerp(
            face[band],
            smooth(0.7, 0.9, t - Math.floor(t)),
          );
        }
        let yard = 0;
        for (const p of yards)
          yard = Math.max(yard, smooth(p.r * 1.3, p.r * 0.7, d.angleTo(p.d)));
        c.lerp(dust, yard * 0.45);
        c.multiplyScalar(
          0.93 +
            noise.noise3d(d.x * 12, d.y * 12, d.z * 12) * 0.07 +
            noise.noise3d(d.x * 30, d.y * 30, d.z * 30) * 0.04,
        );
        return (
          height(d) +
          0.003 * noise.noise3d(d.x * 26, d.y * 26, d.z * 26) * (1 - yard)
        );
      },
      0.45,
    );
    groundTop = Math.max(groundTop, farthest(ground));
    body.add(new THREE.Mesh(ground, groundMat()));
    // Big heaps of ore lying about: the metal you come for.
    ores.forEach((d, k) =>
      during(k % 2 ? 2 : 1, () =>
        stand(
          named(
            'ore',
            oreCluster(
              look.seed + k,
              anvil ? '#4a4f58' : '#5a3a2e',
              look.accent[k % look.accent.length],
            ),
          ),
          d,
          0.27 + rand() * 0.06,
          0.006,
        ),
      ),
    );
    const boulder = named(
      'boulder',
      rock(look.seed, anvil ? '#7c8592' : '#b5653a'),
    );
    loosely(() => {
      for (const d of scatter(rand, 8, 0.3, () => true, []))
        if (clear(d, 0.04)) stand(boulder, d, 0.07 + rand() * 0.05, 0.008);
    });
    const box = named('crate', crate(look.seed, look.accent[0], 'facet'));
    const lamp = named('lamp', lampPost(anvil ? '#9fe0ff' : '#ffd27a'));
    // The first year's rig: a smaller headframe that grows into the mine.
    const rig = anvil ? domes[0] : towers[0];
    const rigScale = year === 1 ? (anvil ? 0.3 : 0.32) : 0.4;
    if (!anvil) {
      towers.forEach((d, i) => {
        during(i ? 2 : 1, () =>
          standMoving(
            derrick(mats, look.accent[0]),
            d,
            i ? 0.4 : rigScale,
            0.8 + rand() * 0.6,
            'derrick',
          ),
        );
        during(2, () => around(d, 1, 0.2, 0.24, (dd) => stand(lamp, dd, 0.08)));
        around(d, 2, 0.2, 0.26, (dd, k) =>
          during(i || k ? 2 : 1, () => stand(box, dd, 0.045)),
        );
      });
      belt = 'moons';
    } else {
      during(2, () =>
        domes.forEach((d, k) => {
          stand(named('mining base', miningBase(look.seed + k)), d, 0.3);
          around(d, 1, 0.36, 0.4, (dd) => stand(lamp, dd, 0.08));
        }),
      );
      if (rig)
        during(
          1,
          () =>
            standMoving(
              derrick(mats, look.accent[0]),
              rig,
              rigScale,
              1,
              'rig',
              0.4,
            ),
          1,
        );
      during(2, () => {
        for (const d of furnaces) {
          const at = standOn(d, 1 + height(d), 0.36, rand() * TAU);
          const kit = named('furnace', furnace(look.seed));
          const puff = smoke(rand);
          puff.group.position.set(0.12, 1.5, 0);
          const shape = shapeOf([
            ...kitSources(kit),
            ...motionSources(puff.group, (t: number) => puff.update(t)),
          ]);
          note('furnace', shape, at, () => {
            world.put(kit, at);
            const holder = new THREE.Group();
            holder.applyMatrix4(at);
            holder.add(puff.group);
            body.add(holder);
            updates.push((t) => puff.update(t));
          });
          around(d, 2, 0.2, 0.25, (dd) => stand(box, dd, 0.045));
        }
      });
      belt = 'moons';
    }
    if (year === 3)
      grow3(() => {
        ores3.forEach((d, k) =>
          stand(
            named(
              'ore',
              oreCluster(
                look.seed + 20 + k,
                anvil ? '#4a4f58' : '#5a3a2e',
                look.accent[k % look.accent.length],
              ),
            ),
            d,
            0.27 + rand3() * 0.06,
            0.006,
            spin3(),
          ),
        );
        for (const d of works3) {
          if (anvil) stand(rocketPad(look.seed), d, 0.38, 0.004, spin3());
          else
            stand(oreWorks(look.seed, look.accent[0]), d, 0.34, 0.004, spin3());
          around3(d, 2, 0.38, 0.44, (dd) => stand(box, dd, 0.045, 0, spin3()));
          around3(d, 1, 0.38, 0.44, (dd) => stand(lamp, dd, 0.08, 0, spin3()));
        }
        for (const d of more3) {
          if (anvil)
            stand(
              named('mining base', miningBase(look.seed + 5)),
              d,
              0.3,
              0,
              spin3(),
            );
          else
            standMoving(
              derrick(mats, look.accent[1]),
              d,
              0.4,
              0.8 + rand3() * 0.6,
              'derrick',
              spin3(),
            );
          around3(d, 2, 0.2, 0.26, (dd) => stand(box, dd, 0.045, 0, spin3()));
        }
      });
  }

  if (look.kind === 'ice') {
    const floe = look.variant === 'floe';
    if (!floe) {
      const base = (d: THREE.Vector3) =>
        fbm(noise, d.x * 1.0, d.y * 1.0, d.z * 1.0, 4) * 0.06 + 0.03;
      const land = (d: THREE.Vector3) => base(d) > 0.012;
      const spot = (d: V3, r: number, pad = 0, from?: Year) => {
        if (pad) pads.push({ d, r: pad, h: base(d), from });
        bigs.push({ d, r });
        tall.push({ d, r });
        return d;
      };
      const spikes = scatter(rand, 4, 0.8, land, taken).map((d) =>
        spot(d, 0.12),
      );
      const pines = scatter(rand, 6, 0.5, land, taken).map((d) =>
        spot(d, 0.08),
      );
      const huts = scatter(rand, 3, 0.6, land, taken).map((d, k) =>
        spot(d, 0.2, 0.2, k ? 2 : 1),
      );
      const men = scatter(rand, 2, 0.4, land, taken).map((d) =>
        spot(d, 0.05, 0.05),
      );
      // Year three: an igloo village with lights, more pines, another
      // spike and snowman.
      const village3 = room3(1, 0.8, 0.42, land, 0.32, base);
      const spikes3 = room3(1, 0.7, 0.12, land);
      const pines3 = room3(5, 0.42, 0.08, land);
      const men3 = room3(1, 0.4, 0.05, land, 0.05, base);
      height = levelled(pads.filter(shown), base);
      const windAxis = randomDir(rand);
      const ground = terrain(
        DETAIL,
        (d, c) => {
          const h = height(d);
          // Deep blue shadows in the hollows, bright snow on the tops.
          c.copy(g[3])
            .lerp(g[2], smooth(0, 0.03, h))
            .lerp(g[1], smooth(0.03, 0.06, h))
            .lerp(g[0], smooth(0.06, 0.09, h));
          // Wind ripples in the snow.
          const ripple = Math.sin(
            d.dot(windAxis) * 70 + noise.noise3d(d.x * 4, d.y * 4, d.z * 4) * 3,
          );
          c.multiplyScalar(0.97 + 0.03 * ripple * smooth(0.01, 0.03, h));
          c.lerp(col('#dff4ff'), smooth(0.006, -0.004, h) * 0.6);
          return (
            (h < 0 ? h * 0.6 : h) + 0.0015 * ripple * smooth(0.01, 0.03, h)
          );
        },
        0.25,
      );
      groundTop = Math.max(groundTop, farthest(ground));
      body.add(new THREE.Mesh(ground, groundMat({ roughness: 0.75 })));
      body.add(waterSphere(look.water!));
      const spikeMat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.08,
        clearcoat: 1,
        transparent: true,
        opacity: 0.88,
        emissive: '#ffffff',
        emissiveIntensity: 0.22,
        flatShading: true,
      });
      spikeMat.onBeforeCompile = glowPatch;
      mats = materials({ icy: spikeMat });
      spikes.forEach((d, k) => {
        during(k < 2 ? 1 : 2, () =>
          stand(
            named(
              'ice spike',
              crystalCluster(
                look.seed + k,
                look.accent[k % look.accent.length],
                '#8fa8c4',
                'icy',
              ),
            ),
            d,
            0.3 + rand() * 0.06,
            0.01,
          ),
        );
      });
      plant(
        named('pine', snowPine(look.seed)),
        pines.map((d) =>
          standOn(d, 1 + height(d) - 0.012, 0.25 + rand() * 0.05, rand() * TAU),
        ),
        (k) => (k < 3 ? 1 : 2),
      );
      const smallPine = named('pine', snowPine(look.seed + 1));
      const extra: THREE.Matrix4[] = [];
      for (const p of pines)
        around(p, 1, 0.09, 0.13, (dd) =>
          extra.push(
            standOn(
              dd,
              1 + height(dd) - 0.01,
              0.13 + rand() * 0.04,
              rand() * TAU,
            ),
          ),
        );
      loosely(() => plant(smallPine, extra, () => 2));
      const print = named(
        'prints',
        new Kit().add(
          'snow',
          new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12),
          '#a9c1db',
          m4(0, 0, 0, 0, 0, 0, [0.85, 1, 1.15]),
        ),
      );
      huts.forEach((d, k) =>
        during(k ? 2 : 1, () => {
          const at = stand(
            named('igloo', igloo(look.seed + k)),
            d,
            0.26,
            0.004,
          );
          // A trail of footprints out of the door, following the ground.
          const out = v3().setFromMatrixColumn(at, 2).normalize();
          const side = v3().setFromMatrixColumn(at, 0).normalize();
          const axis = d.clone().cross(out).normalize();
          const bend = rand() - 0.5;
          for (let j = 0; j < 8; j++) {
            const a = 0.2 + j * 0.022;
            const step = d.clone().applyAxisAngle(axis, a);
            const off = (j % 2 ? 1 : -1) * 0.007 + bend * 0.004 * j;
            step.addScaledVector(side, off).normalize();
            put(
              print,
              standOn(step, 1 + height(step) + 0.0004, 0.016, 0),
              true,
            );
          }
        }),
      );
      men.forEach((d, k) =>
        during(k ? 2 : 1, () =>
          stand(named('snowman', snowman(look.seed + k)), d, 0.12, 0.004),
        ),
      );
      const snowRock = named('rock', rock(look.seed, '#8fa0b4', true));
      loosely(() => {
        for (const d of scatter(rand, 7, 0.3, land, []))
          if (clear(d, 0.04)) stand(snowRock, d, 0.06 + rand() * 0.04, 0.008);
      });
      if (year === 3)
        grow3(() => {
          village3.forEach((d) =>
            stand(iglooVillage(look.seed + 10), d, 0.4, 0.004, spin3()),
          );
          spikes3.forEach((d) =>
            stand(
              named(
                'ice spike',
                crystalCluster(look.seed + 9, look.accent[1], '#8fa8c4', 'icy'),
              ),
              d,
              0.3 + rand3() * 0.06,
              0.01,
              spin3(),
            ),
          );
          const pine = named('pine', snowPine(look.seed));
          plant(
            pine,
            pines3.map((d) =>
              standOn(d, 1 + height(d) - 0.012, 0.25 + rand3() * 0.05, spin3()),
            ),
          );
          const small: THREE.Matrix4[] = [];
          for (const p of pines3)
            around3(p, 1, 0.17, 0.22, (dd) =>
              small.push(
                standOn(
                  dd,
                  1 + height(dd) - 0.01,
                  0.13 + rand3() * 0.04,
                  spin3(),
                ),
              ),
            );
          loosely(() => plant(smallPine, small));
          men3.forEach((d) =>
            stand(
              named('snowman', snowman(look.seed + 4)),
              d,
              0.12,
              0.004,
              spin3(),
            ),
          );
        });
      cloudCount = 4;
      cloudTint = '#f4faff';
      cloudTurn = -0.035;
    } else {
      // An ocean world: a few sandy islets, floes and icebergs bobbing on
      // the sea, a lighthouse and a whale.
      const base = (d: THREE.Vector3) =>
        fbm(noise, d.x * 1.3, d.y * 1.3, d.z * 1.3, 4) * 0.08 - 0.035;
      const isles = scatter(rand, 1, 0.5, (d) => base(d) > 0.02, taken);
      for (const d of isles) {
        pads.push({ d, r: 0.07, h: base(d) });
        bigs.push({ d, r: 0.1 });
        tall.push({ d, r: 0.1 });
      }
      height = levelled(pads, base);
      const ground = terrain(
        DETAIL,
        (d, c) => {
          const h = height(d);
          c.copy(col('#1a4f8a'))
            .lerp(col('#2f8fc0'), smooth(-0.04, -0.012, h))
            .lerp(col('#5cc4d8'), smooth(-0.012, -0.003, h))
            .lerp(g[0], smooth(-0.004, 0.004, h))
            .lerp(g[1], smooth(0.012, 0.024, h));
          c.multiplyScalar(
            0.95 + 0.06 * noise.noise3d(d.x * 18, d.y * 18, d.z * 18),
          );
          return h + 0.002 * noise.noise3d(d.x * 24, d.y * 24, d.z * 24);
        },
        0.2,
      );
      groundTop = Math.max(groundTop, farthest(ground));
      body.add(new THREE.Mesh(ground, groundMat()));
      const sea = waterSphere(look.water!);
      (sea.material as THREE.MeshPhysicalMaterial).opacity = 0.8;
      body.add(sea);
      const floeMat = vmat({ roughness: 0.45 });
      // Floes sway round their own spot, so they never drift into anything.
      const sway = 0.05;
      const addFloe = (d: V3, k: number, rng: () => number, from: Year) => {
        const kit = named(
          'floe',
          iceFloe(look.seed + k, k % 3 === 0 ? 2 + (k % 2) : 0),
        );
        const f = {
          axis: randomDir(rng).cross(d).normalize(),
          speed: 0.015 + rng() * 0.02,
          s: 0.26 + rng() * 0.1,
          spin: rng() * 6,
        };
        during(from, () =>
          note(
            'floe',
            // It also turns a little as it bobs.
            widen(kitShape(kit), sway / f.s + 0.1),
            standOn(d, 1.0, f.s, f.spin),
            () => {
              const mesh = new THREE.Mesh(
                merge([...kit.bake().values()]),
                floeMat,
              );
              mesh.matrixAutoUpdate = false;
              body.add(mesh);
              const at = v3();
              updates.push((t) => {
                const a = Math.sin(t * f.speed * 12 + k) * sway;
                at.copy(d).applyAxisAngle(f.axis, a);
                mesh.matrix.copy(
                  standOn(at, 1.0, f.s, f.spin + Math.sin(t * 0.3 + k) * 0.2),
                );
                mesh.matrixWorldNeedsUpdate = true;
              });
            },
          ),
        );
      };
      scatter(rand, 8, 0.55, (d) => base(d) < -0.01, taken).forEach((d, k) =>
        addFloe(d, k, rand, k % 2 ? 2 : 1),
      );
      const bergs = scatter(rand, 4, 0.6, (d) => base(d) < -0.01, taken);
      [iceberg(look.seed), iceberg(look.seed + 1)].forEach((kit, v) => {
        const mine = bergs.filter((_, i) => i % 2 === v);
        plant(
          named('iceberg', kit),
          mine.map((d) => standOn(d, 1.0, 0.2 + rand() * 0.06, rand() * 6)),
          (k) => (bergs.indexOf(mine[k]) < 2 ? 1 : 2),
          ['ice'],
          look.accent,
        );
      });
      for (const d of isles) {
        during(2, () =>
          stand(named('lighthouse', lighthouse('#7d8088')), d, 0.28),
        );
        during(
          1,
          () => stand(named('igloo', igloo(look.seed)), d, 0.15, 0.004, 0.5),
          1,
        );
        const r = named('rock', rock(look.seed, '#8a8478', true));
        around(d, 3, 0.09, 0.14, (dd) => {
          if (height(dd) > 0.0) stand(r, dd, 0.05 + rand() * 0.03, 0.006);
        });
      }
      // The whale surfaces in a slow arc every few seconds, and spouts.
      const path =
        scatter(rand, 1, 0.4, (d) => base(d) < -0.02, taken)[0] ??
        new THREE.Vector3(0, 0, 1);
      const heading = randomDir(rand).cross(path).normalize();
      // Year three: a fishing camp on a broad floe, more floes and bergs.
      const sea3 = (d: V3) => base(d) < -0.012;
      const camp3 = room3(1, 0.5, 0.25, sea3);
      const floes3 = room3(3, 0.45, 0.1, sea3);
      const bergs3 = room3(2, 0.5, 0.08, sea3);
      if (year === 3)
        grow3(() => {
          camp3.forEach((d) =>
            put(fishingCamp(look.seed), standOn(d, 1.0, 0.32, spin3())),
          );
          floes3.forEach((d, k) => addFloe(d, 9 + k * 3, rand3, 3));
          plant(
            named('iceberg', iceberg(look.seed + 2)),
            bergs3.map((d) => standOn(d, 1.0, 0.2 + rand3() * 0.06, spin3())),
            () => 3,
            ['ice'],
            look.accent,
          );
        });
      swim = (feet) => {
        const w = new THREE.Group();
        const whaleKit = new Kit().put(whale(), m4(0, 0, 0, 0, 0, 0, 0.68));
        for (const m of whaleKit.meshes(mats)) w.add(m);
        const spoutMat = new THREE.MeshStandardMaterial({
          color: '#eaf8ff',
          roughness: 0.2,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        });
        const spout = new THREE.Group();
        const column = lathe(
          [
            [0, 0],
            [0.04, 0],
            [0.025, 0.25],
            [0.07, 0.45],
            [0.1, 0.52],
            [0, 0.56],
          ],
          14,
        );
        spout.add(new THREE.Mesh(column, spoutMat));
        const drops = new THREE.InstancedMesh(ball(1), spoutMat, 10);
        for (let j = 0; j < 10; j++) {
          const a = (j / 10) * TAU;
          drops.setMatrixAt(
            j,
            m4(
              Math.cos(a) * 0.14,
              0.46 - (j % 3) * 0.08,
              Math.sin(a) * 0.14,
              0,
              0,
              0,
              0.03 + (j % 2) * 0.012,
            ),
          );
        }
        spout.add(drops);
        spout.position.set(0, 0.26, 0.29);
        w.add(spout);
        // Its room all along the arc it swims; turn the arc about its
        // middle until nothing is in the way.
        const S = 0.24;
        const shape = shapeOf(motionSources(w, () => {}, 1));
        /** Where the whale is, a fraction `f` through its loop. */
        const pose = (axis: V3, f: number, m: THREE.Matrix4) => {
          const rise = Math.sin(Math.min(1, f / 0.45) * Math.PI);
          const at = path.clone().applyAxisAngle(axis, (f - 0.22) * 1.2);
          // Nose along the way it swims.
          const fwd = v3().crossVectors(axis, at).normalize();
          const right = v3().crossVectors(at, fwd).normalize();
          m.makeBasis(right, at, fwd);
          m.setPosition(at.multiplyScalar(0.97 + rise * 0.06));
          m.scale(v3(S, S, S));
          return rise;
        };
        const arc = (axis: V3) =>
          Array.from({ length: 16 }, (_, j): Footprint => {
            const frame = new THREE.Matrix4();
            pose(axis, (j / 15) * 0.45, frame);
            return {
              name: 'whale',
              from: 1,
              at: v3().setFromMatrixPosition(frame),
              frame,
              y0: shape.y0 * S,
              y1: shape.y1 * S,
              r: shape.r.map((r) => r * S),
              cols: shape.cols,
              flat: false,
            };
          });
        let wAxis = heading;
        let room = arc(wAxis);
        for (let k = 1; k < 24; k++) {
          if (!room.some((a) => feet.some((b) => collide(a, b)))) break;
          wAxis = heading.clone().applyAxisAngle(path, (k * Math.PI) / 12);
          room = arc(wAxis);
        }
        body.add(w);
        w.matrixAutoUpdate = false;
        updates.push((t) => {
          const f = (t * 0.12) % 1;
          const rise = pose(wAxis, f, w.matrix);
          w.matrixWorldNeedsUpdate = true;
          w.visible = rise > 0.02;
          const blow = smooth(0.55, 0.9, rise) * (f < 0.3 ? 1 : 0);
          spout.visible = blow > 0.02;
          spout.scale.set(0.6 + 0.4 * blow, blow, 0.6 + 0.4 * blow);
        });
        return room;
      };
      cloudCount = 3;
      cloudTurn = 0.03;
    }
  }

  if (look.kind === 'crystal') {
    const rose = look.variant === 'rose';
    const height0 = (d: THREE.Vector3) => {
      const n = fbm(noise, d.x * 1.2, d.y * 1.2, d.z * 1.2, 5);
      const ridge =
        1 - Math.abs(noise.noise3d(d.x * 1.8, d.y * 1.8, d.z * 1.8));
      return n * 0.045 + Math.pow(ridge, 4.5) * 0.055;
    };
    const crackAt = (d: V3) =>
      smooth(
        0.085,
        0.02,
        Math.abs(noise.noise3d(d.x * 2.2 + 2, d.y * 2.2, d.z * 2.2)),
      );
    height = (d) => height0(d) - crackAt(d) * 0.01;
    const glow = col(look.accent[1]);
    const ground = terrain(
      80,
      (d, c, o) => {
        const h = height0(d);
        c.copy(g[0])
          .lerp(g[1], smooth(-0.03, 0.01, h))
          .lerp(g[2], smooth(0.01, 0.04, h))
          .lerp(g[3], smooth(0.045, 0.08, h));
        c.multiplyScalar(
          0.92 + 0.1 * noise.noise3d(d.x * 14, d.y * 14, d.z * 14),
        );
        const crack = crackAt(d);
        c.lerp(glow, 0.85 * crack);
        o.glow = crack;
        return height(d) + 0.002 * noise.noise3d(d.x * 30, d.y * 30, d.z * 30);
      },
      0.35,
      true,
    );
    groundTop = Math.max(groundTop, farthest(ground));
    const groundGlow = glowGroundMat(look.accent[1]);
    body.add(new THREE.Mesh(ground, groundGlow));
    const crystalMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.06,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      iridescence: 0.8,
      iridescenceIOR: 1.5,
      transparent: true,
      opacity: 0.9,
      emissive: '#ffffff',
      emissiveIntensity: 0.4,
      flatShading: true,
    });
    crystalMat.onBeforeCompile = glowPatch;
    mats = materials({ crystal: crystalMat });
    crystals = crystalMat;
    updates.push((t) => {
      crystalMat.emissiveIntensity = 0.4 + 0.2 * Math.sin(t * 1.4);
      groundGlow.emissiveIntensity = 0.75 + 0.35 * Math.sin(t * 1.4 + 1);
    });
    const rockHex = '#' + g[0].clone().multiplyScalar(0.8).getHexString();
    scatter(rand, 6, 0.8, () => true, taken).forEach((d, k) => {
      bigs.push({ d, r: 0.14 });
      tall.push({ d, r: 0.14 });
      const tint = look.accent[Math.floor(rand() * look.accent.length)];
      during(k < 3 ? 1 : 2, () =>
        stand(
          named(
            'crystals',
            crystalCluster(look.seed + bigs.length, tint, rockHex),
          ),
          d,
          0.36 * (0.85 + rand() * 0.3),
          0.01,
        ),
      );
    });
    scatter(rand, 3, 0.5, () => true, taken).forEach((d, k) => {
      bigs.push({ d, r: 0.08 });
      tall.push({ d, r: 0.08 });
      during(k < 1 ? 1 : 2, () =>
        stand(
          named(
            'geode',
            new Kit().put(
              geode(look.seed + bigs.length, look.accent[1], rockHex),
              m4(0, 0.24, 0),
            ),
          ),
          d,
          0.18,
          0.004,
        ),
      );
    });
    let n = 0;
    for (const d of scatter(rand, 12, 0.18, () => true, [])) {
      if (!clear(d, 0.03)) continue;
      bigs.push({ d, r: 0.04 });
      during(n++ % 2 ? 2 : 1, () =>
        stand(
          named(
            'crystals',
            crystalCluster(
              look.seed + bigs.length + 50,
              look.accent[bigs.length % look.accent.length],
              rockHex,
            ),
          ),
          d,
          0.11 + rand() * 0.04,
          0.008,
        ),
      );
    }
    // Year three: a refinery (or a temple of crystal spires), more crystals
    // and another geode.
    const mark3 = room3(1, 0.8, 0.3, () => true);
    const clusters3 = room3(3, 0.6, 0.14, () => true);
    const geodes3 = room3(1, 0.5, 0.08, () => true);
    if (year === 3)
      grow3(() => {
        for (const d of mark3)
          stand(
            rose
              ? crystalTemple(
                  look.seed,
                  look.accent[0],
                  '#f7ecf2',
                  look.accent[1],
                )
              : refinery(look.seed, look.accent[1], '#d9d2f2'),
            d,
            0.42,
            0.02,
            spin3(),
          );
        clusters3.forEach((d, k) =>
          stand(
            named(
              'crystals',
              crystalCluster(
                look.seed + 60 + k,
                look.accent[k % look.accent.length],
                rockHex,
              ),
            ),
            d,
            0.36 * (0.85 + rand3() * 0.3),
            0.01,
            spin3(),
          ),
        );
        geodes3.forEach((d) =>
          stand(
            named(
              'geode',
              new Kit().put(
                geode(look.seed + 70, look.accent[1], rockHex),
                m4(0, 0.24, 0),
              ),
            ),
            d,
            0.18,
            0.004,
            spin3(),
          ),
        );
        let k = 0;
        for (const d of scatter(rand3, 10, 0.18, () => true, [])) {
          if (!clear3(d, 0.03)) continue;
          later.push({ d, r: 0.04 });
          loosely(() =>
            stand(
              named(
                'crystals',
                crystalCluster(
                  look.seed + 80 + k,
                  look.accent[k++ % look.accent.length],
                  rockHex,
                ),
              ),
              d,
              0.11 + rand3() * 0.04,
              0.008,
              spin3(),
            ),
          );
        }
      });
    belt = 'rings';
    frame.rotation.set(rose ? -0.35 : 0.42, 0, rose ? 0.25 : -0.3);
  }

  // ——— What stands this year ———

  // Year by year, the biggest first: a small prop that would touch
  // something bigger slides a little away, or else is left out; something
  // built earlier that a new building needs the room of is cleared away.
  // Nothing comes back once gone, so every year holds the last one (bar what
  // was cleared).
  const kept: Item[] = [];
  const cleared: string[] = [];
  const dropped: string[] = [];
  const slid: string[] = [];
  /** `i`'s frame slid `angle` radians across the ground towards `dir`. */
  const slide = (i: Item, dir: V3, angle: number) => {
    const d0 = i.at.clone().normalize();
    const axis = d0.clone().cross(dir).normalize();
    const frame = i.frame
      .clone()
      .premultiply(new THREE.Matrix4().makeRotationAxis(axis, angle));
    const d1 = d0.clone().applyAxisAngle(axis, angle);
    return frame.setPosition(
      d1.multiplyScalar(i.at.length() + height(d1) - height(d0)),
    );
  };
  for (let y = 1; y <= year; y++) {
    // What stood before and is not a loose prop keeps its place; then the
    // biggest first.
    const old = (i: Item) => (kept.includes(i) && !i.loose ? 1 : 0);
    const now = items
      .filter((i) => (kept.includes(i) || i.from === y) && i.until >= y)
      .sort((a, b) => old(b) - old(a) || b.size - a.size);
    const gone = kept.filter((i) => i.until < y);
    for (const i of gone) kept.splice(kept.indexOf(i), 1);
    const keep: Item[] = [];
    for (const i of now) {
      const hits = keep.filter((k) => collide(k, i));
      if (hits.length && i.loose) {
        const d0 = i.at.clone().normalize();
        const away = v3();
        for (const k of hits) away.add(i.at.clone().sub(k.at).normalize());
        away.addScaledVector(d0, -away.dot(d0));
        if (away.lengthSq() < 1e-8) away.set(1, 0, 0).cross(d0);
        away.normalize();
        tries: for (const angle of [
          0.008, 0.016, 0.026, 0.038, 0.052, 0.07, 0.09, 0.12,
        ])
          for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
            const frame = slide(
              i,
              away.clone().applyAxisAngle(d0, turn),
              angle,
            );
            const moved = {
              ...i,
              frame,
              at: v3().setFromMatrixPosition(frame),
            };
            if (keep.some((k) => collide(k, moved))) continue;
            i.frame = frame;
            i.at = moved.at;
            slid.push(`${i.name}@${y}`);
            hits.length = 0;
            break tries;
          }
      }
      if (hits.length) {
        (i.from < y ? cleared : dropped).push(`${i.name}@${y}`);
        if (kept.includes(i)) kept.splice(kept.indexOf(i), 1);
        continue;
      }
      keep.push(i);
      if (!kept.includes(i)) kept.push(i);
    }
  }
  // Emit in the order they were noted, so the merged meshes match.
  const standing = items.filter((i) => kept.includes(i));

  // ——— Moons, rings and clouds keep clear of everything standing ———

  // A whale picks a clear swim first; clouds then keep over it too.
  const swum = swim ? swim(standing) : [];
  const belts: Belt[] = [];
  const margin = 0.03;
  const spinQ = new THREE.Quaternion();
  if (belt === 'moons') {
    const anvil = look.variant === 'anvil';
    const sizes = anvil ? [0.14, 0.09] : [0.18];
    const size = Math.max(...sizes) * 1.1;
    const band = Math.asin(size / 1.45) + 0.06;
    axis = clearAxis(tall, band, axis);
    // Two moons share one orbit, half a turn apart; the axis keeps the tall
    // things off the equator they circle over.
    const r = anvil ? 1.4 : 1.46;
    const mr = seeded(look.seed + 3);
    const phase = mr() * 6;
    const made = moons(
      frame,
      look.seed,
      anvil ? '#9aa3ae' : '#b9a597',
      sizes.map((s, k) => ({
        size: s,
        r,
        tilt: 0.06,
        phase: phase + k * Math.PI,
      })),
      anvil ? 0.22 : 0.32,
    );
    updates.push(made.update);
    const w = Math.asin(made.extent / r) + 0.06;
    belts.push({
      name: 'moons',
      lat: [-w, w],
      r: [r - made.extent, r + made.extent],
    });
  }
  if (belt === 'rings') {
    const rose = look.variant === 'rose';
    const band = 0.11;
    axis = clearAxis(tall, band, axis);
    const rr = seeded(look.seed + 5);
    const inner = rose ? 1.28 : 1.3;
    const width = rose ? 0.22 : 0.3;
    const rings = new THREE.Group();
    const r1 = ring(
      inner,
      inner + width,
      look.accent.concat(look.ground[3]),
      rr,
    );
    r1.rotation.x = Math.PI / 2;
    rings.add(r1);
    let outer = inner + width;
    if (rose) {
      const r2 = ring(
        outer + 0.05,
        outer + 0.13,
        [look.accent[1], look.ground[3]],
        rr,
      );
      r2.rotation.x = Math.PI / 2;
      rings.add(r2);
      outer += 0.13;
    }
    frame.add(rings);
    // Shards drifting on the ring.
    const shardGeoOne = tidy(shardGeo(rr, 6, 0.8, 0.22, 0.4));
    const sp = shardGeoOne.getAttribute('position');
    const sc0 = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i++)
      sc0.fill(0.6 + 0.4 * smooth(0, 1.2, sp.getY(i)), i * 3, i * 3 + 3);
    shardGeoOne.setAttribute('color', new THREE.BufferAttribute(sc0, 3));
    const shards = new THREE.InstancedMesh(
      shardGeoOne,
      crystals!,
      [10, 16, 22][year - 1],
    );
    const tip = farthest(shardGeoOne) * 0.08;
    const orbit = Array.from({ length: shards.count }, () => ({
      a: rr() * 6.3,
      r: inner + tip + rr() * (width - 2 * tip),
      s: 0.04 + rr() * 0.04,
      spin: rr() * 3,
    }));
    const tint = new THREE.Color();
    for (let k = 0; k < shards.count; k++)
      shards.setColorAt(k, tint.set(look.accent[k % look.accent.length]));
    rings.add(shards);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    updates.push((t) => {
      r1.rotation.z = t * 0.05;
      orbit.forEach((o, k) => {
        const a = o.a + t * (0.12 + o.s);
        mtx.compose(
          pos.set(Math.cos(a) * o.r, 0.02 * Math.sin(t + k), Math.sin(a) * o.r),
          q.setFromEuler(e.set(t * o.spin, t * 0.7, o.spin)),
          sc.set(o.s, o.s, o.s),
        );
        shards.setMatrixAt(k, mtx);
      });
      shards.instanceMatrix.needsUpdate = true;
    });
    const w = Math.asin((tip + 0.02) / inner);
    belts.push({ name: 'rings', lat: [-w, w], r: [inner, outer] });
  }
  if (belt === 'clouds') {
    // Puffy clouds drift round the spin axis, each at the latitude where it
    // floats lowest: just over the tallest thing beneath its path.
    const cr = seeded(look.seed + 9);
    const floor = Math.max(1.2, groundTop + 0.08);
    const parts: THREE.BufferGeometry[] = [];
    const paths: [number, number][] = [];
    for (let k = 0; k < cloudCount; k++) {
      const geo = cloud(cr, k, cloudTint);
      const s = 0.075 + cr() * 0.04;
      const spin = cr() * 6;
      const lon = cr() * TAU;
      geo.computeBoundingSphere();
      const half = geo.boundingSphere!.radius * s * 1.3;
      const options: { lat: number; r: number; w: number }[] = [];
      for (let j = 0; j < 19; j++) {
        const lat = -1.05 + (j / 18) * 2.1;
        const w = half / floor;
        if (paths.some(([a, b]) => Math.abs(a - lat) < b + w)) continue;
        let r = floor;
        for (const f of [...standing, ...swum])
          r = Math.max(r, topWithin(f, axis, [lat - w, lat + w]) + margin);
        options.push({ lat, r, w });
      }
      const low = Math.min(...options.map((o) => o.r));
      const best = options.filter((o) => o.r < low + 0.02);
      const pick = best[Math.floor(cr() * best.length)];
      paths.push([pick.lat, pick.w]);
      const dir = v3(
        Math.cos(pick.lat) * Math.cos(lon),
        Math.sin(pick.lat),
        Math.cos(pick.lat) * Math.sin(lon),
      );
      geo.applyMatrix4(standOn(dir, pick.r, s, spin));
      // Its own belt: the latitudes and heights it sweeps as it drifts.
      const p = geo.getAttribute('position');
      const b: Belt = { name: 'cloud', lat: [9, -9], r: [9, 0] };
      for (let i = 0; i < p.count; i++) {
        const l = Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
        const a = Math.asin(p.getY(i) / l);
        b.lat = [Math.min(b.lat[0], a), Math.max(b.lat[1], a)];
        b.r = [Math.min(b.r[0], l), Math.max(b.r[1], l)];
      }
      belts.push(b);
      parts.push(geo);
    }
    const clouds = new THREE.Mesh(
      merge(parts),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        transparent: true,
        opacity: 0.95,
      }),
    );
    frame.add(clouds);
    updates.push((t) => (clouds.rotation.y = t * cloudTurn));
  }
  // Turn the body so its spin axis stands upright in the frame.
  spinQ.setFromUnitVectors(axis, up);
  // A planet whose lean already spins about this axis keeps its old turn.
  const twist =
    belt === 'clouds'
      ? new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lean[2]))
      : spinQ;
  let turn = lean[1];
  const turnQ = new THREE.Quaternion();
  const spinBody = () =>
    body.quaternion.copy(turnQ.setFromAxisAngle(up, turn)).multiply(twist);
  spinBody();

  // ——— Put down what stands ———

  // Anything still in a belt's way is left out (none should be).
  const free = standing.filter((f) => {
    const hit = belts.some((b) => inBelt(f, axis, b));
    if (hit) dropped.push(`${f.name}@belt`);
    return !hit;
  });
  for (const i of free) i.emit(i.frame);
  for (const [kit, grove] of groves)
    plantKit(body, kit, mats, grove.spots, grove.tinted, grove.colours);
  for (const m of world.meshes(mats)) body.add(m);
  const feet: Footprint[] = free.map(
    ({ size: _s, emit: _e, loose: _l, ...f }) => f,
  );
  feet.push(...swum);
  let reach = groundTop;
  for (const f of feet) reach = Math.max(reach, topOf(f));
  for (const b of belts) reach = Math.max(reach, b.r[1]);

  const spin = 0.06 + rand() * 0.04;
  const planet: Planet = {
    group,
    body,
    air,
    reach,
    update(t, dt) {
      turn += spin * dt;
      spinBody();
      for (const u of updates) u(t, dt);
    },
  };
  clearances.set(planet, {
    axis,
    feet,
    belts,
    ground: groundTop,
    cleared,
    dropped,
    slid,
  });
  return planet;
}

/** Lights shared by Alto's 3D: one warm sun from the left, a soft space fill
 * and a cool rim from behind on the right. */
export function spaceLights(scene: THREE.Scene, strength = 1) {
  const sun = new THREE.DirectionalLight('#fff0d6', 2.8 * strength);
  sun.position.set(-1.2, 0.8, 1.0);
  const fill = new THREE.HemisphereLight('#c9d8ff', '#3a3060', 0.8 * strength);
  const rim = new THREE.DirectionalLight('#9cc8ff', 1.6 * strength);
  rim.position.set(1.2, 0.4, -1);
  scene.add(sun, fill, rim);
  return [sun, fill, rim] as const;
}
