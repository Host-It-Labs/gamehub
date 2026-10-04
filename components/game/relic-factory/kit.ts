import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * A small modelling kit for the factory's machines: primitives in machine
 * space (one cell is one unit, the machine faces +x, y is up), each painted
 * with a flat colour baked into its vertices and filed under one of a few
 * shared materials. Everything filed under one material merges into one
 * geometry, so a machine kind costs a handful of instanced draw calls
 * however many of it stand on the floor.
 */
/** Keep the authored curve detail at every zoom. Tiny fittings can ask for
 * fewer sides; the large silhouettes use 32–40. Instancing shares the same
 * geometry, instead of substituting a visibly coarse model from afar. */
const seg = (n: number) => Math.max(3, Math.round(n));
export type MatKey = 'paint' | 'gloss' | 'metal' | 'dark' | 'glow' | 'glass';
type V3 = [number, number, number];
type Opts = {
  /** Euler rotation in radians. */
  rot?: V3;
  /** Axis of a cylinder, cone or torus (default y; torus default lies flat). */
  axis?: 'x' | 'y' | 'z';
  scale?: V3;
};

export class Kit {
  readonly parts: Partial<Record<MatKey, THREE.BufferGeometry[]>> = {};

  add(
    mat: MatKey,
    colour: string,
    geo: THREE.BufferGeometry,
    at: V3,
    o: Opts = {},
  ) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (!g.getAttribute('uv'))
      g.setAttribute(
        'uv',
        new THREE.BufferAttribute(
          new Float32Array(g.getAttribute('position').count * 2),
          2,
        ),
      );
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal' && name !== 'uv')
        g.deleteAttribute(name);
    if (o.axis === 'x') g.rotateZ(-Math.PI / 2);
    else if (o.axis === 'z') g.rotateX(Math.PI / 2);
    if (o.scale) g.scale(...o.scale);
    if (o.rot) {
      g.rotateX(o.rot[0]);
      g.rotateY(o.rot[1]);
      g.rotateZ(o.rot[2]);
    }
    g.translate(...at);
    const c = new THREE.Color(colour);
    const count = g.getAttribute('position').count,
      data = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) data.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(data, 3));
    g = g.index ? g.toNonIndexed() : g;
    (this.parts[mat] ??= []).push(g);
    return this;
  }
  box(mat: MatKey, colour: string, size: V3, at: V3, o?: Opts) {
    return this.add(mat, colour, new THREE.BoxGeometry(...size), at, o);
  }
  /** A box with rounded edges: enamel shells and plinths. */
  rbox(
    mat: MatKey,
    colour: string,
    size: V3,
    radius: number,
    at: V3,
    o?: Opts,
  ) {
    const r = Math.min(radius, ...size.map((s) => s / 2 - 0.001));
    return this.add(
      mat,
      colour,
      // Broad housings need three bevel subdivisions. Thin trim spends
      // its geometry on the visible edge rather than hidden corner grids.
      new RoundedBoxGeometry(
        size[0],
        size[1],
        size[2],
        Math.min(...size) < 0.032 ? 1 : r >= 0.035 ? 3 : 2,
        r,
      ),
      at,
      o,
    );
  }
  cyl(
    mat: MatKey,
    colour: string,
    top: number,
    bottom: number,
    height: number,
    at: V3,
    o: Opts & { seg?: number } = {},
  ) {
    return this.add(
      mat,
      colour,
      new THREE.CylinderGeometry(top, bottom, height, seg(o.seg ?? 24)),
      at,
      o,
    );
  }
  sphere(
    mat: MatKey,
    colour: string,
    r: number,
    at: V3,
    o: Opts & { seg?: number } = {},
  ) {
    const n = seg(o.seg ?? 18);
    return this.add(
      mat,
      colour,
      new THREE.SphereGeometry(r, n, Math.max(4, Math.ceil(n * 0.7))),
      at,
      o,
    );
  }
  torus(
    mat: MatKey,
    colour: string,
    radius: number,
    tube: number,
    at: V3,
    o: Opts & { arc?: number; seg?: number } = {},
  ) {
    const g = new THREE.TorusGeometry(
      radius,
      tube,
      tube < 0.009 ? 4 : tube < 0.025 ? 6 : 8,
      seg(o.seg ?? 32),
      o.arc ?? Math.PI * 2,
    );
    // Lie flat by default (ring around y); `axis` points the ring's axis.
    if (!o.axis || o.axis === 'y') g.rotateX(Math.PI / 2);
    else if (o.axis === 'x') g.rotateY(Math.PI / 2);
    return this.add(mat, colour, g, at, { ...o, axis: undefined });
  }
  lathe(
    mat: MatKey,
    colour: string,
    profile: [number, number][],
    at: V3,
    o: Opts & { seg?: number } = {},
  ) {
    const g = new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      seg(o.seg ?? 32),
    );
    return this.add(mat, colour, g, at, o);
  }
  /** A strut or axle between two points, with the same smooth cylinder normals. */
  rod(mat: MatKey, colour: string, radius: number, a: V3, b: V3, sides = 16) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      direction = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(
      radius,
      radius,
      direction.length(),
      seg(sides),
    );
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      ),
    );
    return this.add(
      mat,
      colour,
      g,
      start.add(end).multiplyScalar(0.5).toArray() as V3,
    );
  }
  /** One merged geometry per material. */
  merged() {
    const out: Partial<Record<MatKey, THREE.BufferGeometry>> = {};
    for (const [mat, list] of Object.entries(this.parts) as [
      MatKey,
      THREE.BufferGeometry[],
    ][]) {
      const g = mergeGeometries(list, false);
      for (const p of list) p.dispose();
      if (g) out[mat] = g;
    }
    return out;
  }
}

/** A flat strip swept along a path in the xz plane: belt tops on curves.
 * `u` runs along the path (in cells), `v` across it. */
export function strip(
  points: THREE.Vector3[],
  width: number,
  y: number,
): THREE.BufferGeometry {
  const pos: number[] = [],
    uv: number[] = [],
    norm: number[] = [];
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    if (i) length += points[i].distanceTo(points[i - 1]);
    const t = pathTangent(points, i);
    const side = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(width / 2);
    for (const s of [-1, 1]) {
      pos.push(points[i].x + side.x * s, y, points[i].z + side.z * s);
      uv.push(length, s < 0 ? 0 : 1);
      norm.push(0, 1, 0);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2,
      b = a + 1,
      c = a + 2,
      d = a + 3;
    index.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  faceUp(g);
  return g;
}

/** The end tangent uses the next two samples so curved belts meet their
 * neighbouring cell squarely, rather than protruding beyond the boundary. */
export function pathTangent(points: THREE.Vector3[], i: number) {
  const t = new THREE.Vector3();
  if (points.length > 2 && i === 0)
    t.copy(points[1])
      .multiplyScalar(4)
      .addScaledVector(points[0], -3)
      .sub(points[2]);
  else if (points.length > 2 && i === points.length - 1)
    t.copy(points[i])
      .multiplyScalar(3)
      .addScaledVector(points[i - 1], -4)
      .add(points[i - 2]);
  else
    t.subVectors(
      points[Math.min(points.length - 1, i + 1)],
      points[Math.max(0, i - 1)],
    );
  return t.setY(0).normalize();
}

/** A bevelled rail swept along a path in the xz plane. Each side has its
 * own normals: smooth along the curve, crisp between the bevel and face. */
export function rail(
  points: THREE.Vector3[],
  width: number,
  height: number,
  y: number,
) {
  const g = new THREE.BufferGeometry(),
    pos: number[] = [],
    normals: number[] = [];
  const bevel = Math.min(width, height) * 0.22;
  const corners: [number, number][] = [
    [-width / 2 + bevel, 0],
    [width / 2 - bevel, 0],
    [width / 2, bevel],
    [width / 2, height - bevel],
    [width / 2 - bevel, height],
    [-width / 2 + bevel, height],
    [-width / 2, height - bevel],
    [-width / 2, bevel],
  ];
  const ring = (i: number) => {
    const t = pathTangent(points, i);
    const side = new THREE.Vector3(-t.z, 0, t.x);
    return corners.map(
      ([s, h]) =>
        new THREE.Vector3(
          points[i].x + side.x * s,
          y + h,
          points[i].z + side.z * s,
        ),
    );
  };
  const faceNormal = (i: number, k: number) => {
    const a = corners[k],
      b = corners[(k + 1) % corners.length];
    const n = new THREE.Vector2(b[1] - a[1], a[0] - b[0]).normalize();
    const t = pathTangent(points, i);
    return new THREE.Vector3(-t.z * n.x, n.y, t.x * n.x);
  };
  for (let i = 0; i < points.length - 1; i++) {
    const r0 = ring(i),
      r1 = ring(i + 1);
    for (let k = 0; k < corners.length; k++) {
      const a = r0[k],
        b = r0[(k + 1) % corners.length],
        c = r1[(k + 1) % corners.length],
        d = r1[k];
      const n0 = faceNormal(i, k),
        n1 = faceNormal(i + 1, k);
      pos.push(
        ...a.toArray(),
        ...c.toArray(),
        ...b.toArray(),
        ...a.toArray(),
        ...d.toArray(),
        ...c.toArray(),
      );
      normals.push(
        ...n0.toArray(),
        ...n1.toArray(),
        ...n0.toArray(),
        ...n0.toArray(),
        ...n1.toArray(),
        ...n1.toArray(),
      );
    }
  }
  for (const end of [0, points.length - 1]) {
    const r = ring(end),
      centre = new THREE.Vector3(points[end].x, y + height / 2, points[end].z),
      n = pathTangent(points, end).multiplyScalar(end === 0 ? -1 : 1);
    for (let k = 0; k < corners.length; k++) {
      const a = r[k],
        b = r[(k + 1) % corners.length];
      pos.push(
        ...centre.toArray(),
        ...(end === 0 ? a : b).toArray(),
        ...(end === 0 ? b : a).toArray(),
      );
      normals.push(...n.toArray(), ...n.toArray(), ...n.toArray());
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

/** Turns every triangle of a flat geometry to face up. */
function faceUp(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position'),
    idx = g.getIndex()!;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(p, idx.getX(i));
    b.fromBufferAttribute(p, idx.getX(i + 1));
    c.fromBufferAttribute(p, idx.getX(i + 2));
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (ny < 0) {
      const t = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, t);
    }
  }
}
