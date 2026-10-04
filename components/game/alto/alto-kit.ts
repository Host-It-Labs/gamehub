import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { merge, part } from './alto-3d';

/**
 * The modelling kit shared by Alto's ships and upgrades (alto-ship.ts and the
 * upgrade files beside it): rounded lathes, bevelled boxes and extrusions,
 * tubes, parts merged per material with vertex colours (`Bins`), the hull's
 * shape and the helpers that put things on round bodies.
 *
 * Units: the hull is 2 long (z from −1 to 1, nose along +Z) and about 1 wide.
 */

export type Upgrade = {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
};
export type Maker = (where: 'ship' | 'shop') => Upgrade;

// ——— Modelling helpers ———

export const TAU = Math.PI * 2;
export const Y = new THREE.Vector3(0, 1, 0);
export const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const C = (hex: string) => new THREE.Color(hex);
export const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const angDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % TAU;
  return Math.min(d, TAU - d);
};

export const vmat = (o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, ...o });
/** The two materials every upgrade paints its parts with (its own copies). */
export const kitMats = () => ({
  paint: vmat({ roughness: 0.42, metalness: 0.05 }),
  metal: vmat({ roughness: 0.3, metalness: 0.78 }),
});
export const still = (group: THREE.Group): Upgrade => ({
  group,
  update: () => {},
});

export type Colour = string | THREE.Color;
export type Paint = (centre: THREE.Vector3, normal: THREE.Vector3) => Colour;

/** Colour each triangle of a non-indexed geometry by its centre and facing. */
export function tint(g: THREE.BufferGeometry, paint: Paint) {
  const p = g.getAttribute('position');
  const col = g.getAttribute('color');
  const a = v3();
  const b = v3();
  const c = v3();
  const m = v3();
  const n = v3();
  const e = v3();
  const k = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    m.copy(a).add(b).add(c).divideScalar(3);
    n.subVectors(b, a).cross(e.subVectors(c, a)).normalize();
    k.set(paint(m, n));
    for (let j = 0; j < 3; j++) col.setXYZ(i + j, k.r, k.g, k.b);
  }
}

/** Parts sorted by material, merged into one mesh per material. */
export class Bins {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  private mats: Record<string, THREE.Material>;
  constructor(mats: Record<string, THREE.Material>) {
    this.mats = mats;
  }
  add(
    key: string,
    geo: THREE.BufferGeometry,
    colour: Colour | Paint,
    at?: THREE.Matrix4,
  ) {
    const g = part(
      geo.index ? geo : geo.clone(),
      typeof colour === 'function' ? '#ffffff' : colour,
    );
    if (typeof colour === 'function') tint(g, colour);
    if (at) g.applyMatrix4(at);
    const list = this.parts.get(key) ?? [];
    list.push(g);
    this.parts.set(key, list);
  }
  into<T extends THREE.Object3D>(target: T) {
    for (const [key, list] of this.parts)
      target.add(new THREE.Mesh(merge(list), this.mats[key]));
    return target;
  }
}

export type Pt = [number, number, number?];
/** A polyline with rounded corners: each point is [x, y, fillet]; a negative
 * fillet doubles the point for a hard edge. */
export function rounded(pts: Pt[], steps = 4) {
  const out: THREE.Vector2[] = [];
  pts.forEach(([x, y, f = 0], i) => {
    if (f < 0) {
      out.push(v2(x, y), v2(x, y));
      return;
    }
    if (!f || i === 0 || i === pts.length - 1) {
      out.push(v2(x, y));
      return;
    }
    const p = v2(x, y);
    const a = v2(pts[i - 1][0], pts[i - 1][1]).sub(p);
    const b = v2(pts[i + 1][0], pts[i + 1][1]).sub(p);
    const s = p
      .clone()
      .addScaledVector(a.clone().normalize(), Math.min(f, a.length() / 2));
    const e = p
      .clone()
      .addScaledVector(b.clone().normalize(), Math.min(f, b.length() / 2));
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * u * (1 - u);
      const w2 = u * u;
      out.push(
        v2(w0 * s.x + w1 * p.x + w2 * e.x, w0 * s.y + w1 * p.y + w2 * e.y),
      );
    }
  });
  return out;
}
/** A lathe round +Y from [radius, height, fillet] points (bottom to top). */
export const lathe = (pts: Pt[], seg = 32, steps = 4) =>
  new THREE.LatheGeometry(rounded(pts, steps), seg);
/** The same lathe lying along +Z (its heights become z). */
export const latheZ = (pts: Pt[], seg = 32, steps = 4) =>
  lathe(pts, seg, steps).rotateX(Math.PI / 2);
export const rbox = (w: number, h: number, d: number, r: number, seg = 1) =>
  new RoundedBoxGeometry(
    w,
    h,
    d,
    seg,
    Math.min(r, Math.min(w, h, d) / 2 - 1e-4),
  );
export const cyl = (rt: number, rb: number, h: number, seg = 16) =>
  new THREE.CylinderGeometry(rt, rb, h, seg);
export const sphere = (r: number, w = 16, h = 12) =>
  new THREE.SphereGeometry(r, w, h);
/** A rivet head: a little dome facing +Y. */
export const dome = (r: number, w = 8, h = 3) =>
  new THREE.SphereGeometry(r, w, h, 0, TAU, 0, Math.PI / 2);
export const tube = (
  pts: THREE.Vector3[],
  r: number,
  seg = 16,
  radial = 6,
  closed = false,
) =>
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts, closed),
    seg,
    r,
    radial,
    closed,
  );
/** A matrix that stands +Y along `dir` at `at`. */
export const aim = (at: THREE.Vector3, dir: THREE.Vector3, s = 1) =>
  new THREE.Matrix4().compose(
    at,
    new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize()),
    v3(s, s, s),
  );
/** A round bar from a to b. */
export function rod(
  r: number,
  a: THREE.Vector3,
  b: THREE.Vector3,
  seg = 8,
  rb = r,
) {
  const d = b.clone().sub(a);
  return cyl(r, rb, d.length(), seg).applyMatrix4(
    aim(a.clone().add(b).multiplyScalar(0.5), d),
  );
}
/** A bevelled extrusion of a shape, centred on its depth. */
export function extrude(
  shape: THREE.Shape,
  depth: number,
  bevel = 0,
  segs = 2,
  curve = 10,
) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: segs,
    curveSegments: curve,
  });
  return g.translate(0, 0, -depth / 2);
}
export function roundRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
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
export function star(ro: number, ri: number, points = 5, a0 = Math.PI / 2) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = a0 + (i * Math.PI) / points;
    const r = i % 2 ? ri : ro;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
/** A knurled knob outline. */
export function knurl(r: number, teeth: number, depth: number) {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r - (i % 4 < 2 ? 0 : depth);
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}
/** A link between a circle at the origin and one `len` along +X. */
export function link(len: number, r0: number, r1: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -r0);
  s.lineTo(len, -r1);
  s.absarc(len, 0, r1, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, r0);
  s.absarc(0, 0, r0, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}
/** A smooth surface from a grid of points that wraps round in its columns
 * (`at(i, cols)` must equal `at(i, 0)`); rows run along, columns around. */
export function grid(
  rows: number,
  cols: number,
  at: (i: number, j: number) => THREE.Vector3,
) {
  const w = cols + 1;
  const pos = new Float32Array(rows * w * 3);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j <= cols; j++) {
      const p = at(i, j);
      pos.set([p.x, p.y, p.z], (i * w + j) * 3);
    }
  const index: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * w + j;
      const b = a + w;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  // Weld the shading across the wrap-round seam.
  const n = g.getAttribute('normal');
  const s = v3();
  for (let i = 0; i < rows; i++) {
    const a = i * w;
    const b = a + cols;
    s.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b));
    s.normalize();
    n.setXYZ(a, s.x, s.y, s.z);
    n.setXYZ(b, s.x, s.y, s.z);
  }
  return g;
}

// ——— Round bodies: putting things on the hull and the pods ———

export type Radius = (z: number) => number;
/** The surface frame of a round body at angle a (0 on top, towards +x) and
 * length z: x across (towards −a), y along towards the nose, n outwards. */
export function frameOn(R: Radius, a: number, z: number) {
  const dr = (R(z + 0.004) - R(z - 0.004)) / 0.008;
  const n = v3(Math.sin(a), Math.cos(a), -dr).normalize();
  const x = v3(-Math.cos(a), Math.sin(a), 0);
  const y = v3().crossVectors(n, x);
  return { n, x, y };
}
/** A matrix placing a part on the body: its +Z out of the surface. */
export function onBody(R: Radius, a: number, z: number, lift = 0) {
  const f = frameOn(R, a, z);
  const r = R(z) + lift;
  return new THREE.Matrix4()
    .makeBasis(f.x, f.y, f.n)
    .setPosition(r * Math.sin(a), r * Math.cos(a), z);
}
/** Bend a flat piece (x across, y along, z out) onto the body's surface. */
export function wrap(
  geo: THREE.BufferGeometry,
  R: Radius,
  a0: number,
  z0: number,
  lift = 0,
) {
  const p = geo.getAttribute('position');
  const nAttr = geo.getAttribute('normal');
  const v = v3();
  const nn = v3();
  const w = v3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const z = z0 + v.y;
    const r = R(z) + lift;
    const a = a0 - v.x / r;
    p.setXYZ(i, (r + v.z) * Math.sin(a), (r + v.z) * Math.cos(a), z);
    if (nAttr) {
      const f = frameOn(R, a, z);
      nn.fromBufferAttribute(nAttr, i);
      w.set(0, 0, 0)
        .addScaledVector(f.x, nn.x)
        .addScaledVector(f.y, nn.y)
        .addScaledVector(f.n, nn.z)
        .normalize();
      nAttr.setXYZ(i, w.x, w.y, w.z);
    }
  }
  p.needsUpdate = true;
  return geo;
}

// ——— The hull's shape ———

/** The hull's radius along its length, t from the tail (0) to the nose (1). */
export const hullRadius = (t: number) =>
  0.5 *
  Math.pow(Math.max(0, Math.sin(Math.PI * (0.1 + 0.9 * t))), 0.55) *
  (1 - 0.1 * t);
export const hullR: Radius = (z) => hullRadius((z + 1) / 2);
export const STRIPE: [number, number] = [0.36, 0.5];
export const NOSE = 0.86;
/** Panel seams round the hull, and along it between these lengths. */
export const GROOVES = [0.07, 0.2, 0.33, 0.55, 0.7, 0.83];
export const SEAMS = [1, 3, 5, 7].map((k) => (k * Math.PI) / 4);
export const SEAM_SPANS: [number, number][] = [
  [0.07, 0.33],
  [0.55, 0.83],
];
/** How far the paint stands proud (the stripe, the nose) or dips (seams). */
export function hullLift(t: number) {
  let r =
    0.008 *
    sstep(STRIPE[0] - 0.003, STRIPE[0] + 0.003, t) *
    (1 - sstep(STRIPE[1] - 0.003, STRIPE[1] + 0.003, t));
  r +=
    0.005 * sstep(NOSE - 0.003, NOSE + 0.003, t) * Math.min(1, (1 - t) / 0.03);
  for (const g of GROOVES) {
    const d = Math.abs(t - g) / 0.004;
    if (d < 1) r -= 0.0035 * (1 - d * d);
  }
  return r;
}
export function hullRows() {
  const feat: number[] = [];
  for (const e of [STRIPE[0], STRIPE[1], NOSE])
    for (const d of [-0.003, -0.0015, 0, 0.0015, 0.003]) feat.push(e + d);
  for (const g of GROOVES)
    for (const d of [-0.004, -0.002, 0, 0.002, 0.004]) feat.push(g + d);
  const base: number[] = [];
  for (let i = 0; i <= 36; i++) base.push((i / 36) * 0.9);
  for (let k = 1; k <= 16; k++) base.push(1 - 0.1 * Math.pow(1 - k / 16, 2));
  const ts = [
    ...feat,
    ...base.filter((t) => feat.every((f) => Math.abs(f - t) > 0.0025)),
  ].sort((a, b) => a - b);
  return ts.filter((t, i) => i === 0 || t - ts[i - 1] > 1e-5);
}
export function hullCols() {
  const seams = SEAMS.flatMap((s) => [s - 0.012, s, s + 0.012]);
  const base: number[] = [];
  for (let i = 0; i < 52; i++) base.push((i / 52) * TAU);
  return [
    ...seams,
    ...base.filter((a) => seams.every((s) => angDist(a, s) > 0.03)),
  ].sort((a, b) => a - b);
}
/** The canopy: a glass ellipsoid sitting into the hull over the pilot. */
export const CANOPY = { c: v3(0, 0.3, 0.4), r: v3(0.2, 0.21, 0.27) };
export const onCanopy = (th: number, ph: number, s = 1) =>
  v3(
    CANOPY.r.x * s * Math.sin(th) * Math.cos(ph),
    CANOPY.r.y * s * Math.cos(th),
    CANOPY.r.z * s * Math.sin(th) * Math.sin(ph),
  ).add(CANOPY.c);
export const inCanopy = (p: THREE.Vector3) =>
  (p.x / CANOPY.r.x) ** 2 +
    ((p.y - CANOPY.c.y) / CANOPY.r.y) ** 2 +
    ((p.z - CANOPY.c.z) / CANOPY.r.z) ** 2 <
  1;
export const outsideHull = (p: THREE.Vector3) =>
  Math.hypot(p.x, p.y) > hullRadius((p.z + 1) / 2);
