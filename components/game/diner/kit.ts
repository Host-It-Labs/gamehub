import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Diner's modelling kit: primitives painted with a colour baked into their
 * vertices and filed under one of a few shared materials (vinyl, enamel,
 * chrome, neon, glass). Everything filed under one material merges into one
 * geometry, so a whole booth or a whole guest costs a few draw calls.
 */
export type Mat = 'paint' | 'gloss' | 'chrome' | 'glow' | 'glass';
type V3 = [number, number, number];
type Opts = {
  rot?: V3;
  axis?: 'x' | 'y' | 'z';
  scale?: V3;
};

export class Kit {
  readonly parts: Partial<Record<Mat, THREE.BufferGeometry[]>> = {};

  add(
    mat: Mat,
    colour: string,
    geo: THREE.BufferGeometry,
    at: V3,
    o: Opts = {},
  ) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
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
    const n = g.getAttribute('position').count;
    const data = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(data, 3));
    g = g.index ? g.toNonIndexed() : g;
    (this.parts[mat] ??= []).push(g);
    return this;
  }
  box(mat: Mat, colour: string, size: V3, at: V3, o?: Opts) {
    return this.add(mat, colour, new THREE.BoxGeometry(...size), at, o);
  }
  rbox(mat: Mat, colour: string, size: V3, r: number, at: V3, o?: Opts) {
    const radius = Math.min(r, ...size.map((s) => s / 2 - 0.001));
    return this.add(
      mat,
      colour,
      new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius),
      at,
      o,
    );
  }
  cyl(
    mat: Mat,
    colour: string,
    top: number,
    bottom: number,
    h: number,
    at: V3,
    o: Opts & { seg?: number; open?: boolean } = {},
  ) {
    return this.add(
      mat,
      colour,
      new THREE.CylinderGeometry(
        top,
        bottom,
        h,
        o.seg ?? 24,
        1,
        o.open ?? false,
      ),
      at,
      o,
    );
  }
  sphere(
    mat: Mat,
    colour: string,
    r: number,
    at: V3,
    o: Opts & { seg?: number } = {},
  ) {
    const n = o.seg ?? 18;
    return this.add(
      mat,
      colour,
      new THREE.SphereGeometry(r, n, Math.ceil(n * 0.7)),
      at,
      o,
    );
  }
  /** A partial sphere: `from`..`to` of the polar angle (0 is the top). */
  dome(
    mat: Mat,
    colour: string,
    r: number,
    at: V3,
    to = Math.PI / 2,
    o: Opts & { from?: number } = {},
  ) {
    return this.add(
      mat,
      colour,
      new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, o.from ?? 0, to),
      at,
      o,
    );
  }
  torus(
    mat: Mat,
    colour: string,
    r: number,
    tube: number,
    at: V3,
    o: Opts & { arc?: number } = {},
  ) {
    const g = new THREE.TorusGeometry(r, tube, 10, 32, o.arc ?? Math.PI * 2);
    g.rotateX(Math.PI / 2);
    return this.add(mat, colour, g, at, o);
  }
  capsule(mat: Mat, colour: string, r: number, len: number, at: V3, o?: Opts) {
    return this.add(
      mat,
      colour,
      new THREE.CapsuleGeometry(r, len, 6, 16),
      at,
      o,
    );
  }
  /** A flat shape extruded upward by `depth`. */
  extrude(
    mat: Mat,
    colour: string,
    shape: THREE.Shape,
    depth: number,
    at: V3,
    o?: Opts & { bevel?: number },
  ) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: !!o?.bevel,
      bevelSize: o?.bevel ?? 0,
      bevelThickness: o?.bevel ?? 0,
      bevelSegments: 2,
      curveSegments: 16,
    });
    g.rotateX(-Math.PI / 2);
    return this.add(mat, colour, g, at, o);
  }
  tube(mat: Mat, colour: string, points: V3[], r: number, closed = false) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      closed,
      'catmullrom',
      0.2,
    );
    return this.add(
      mat,
      colour,
      new THREE.TubeGeometry(
        curve,
        Math.max(24, points.length * 10),
        r,
        8,
        closed,
      ),
      [0, 0, 0],
    );
  }
  /** Merged geometry per material, ready for one mesh each. */
  build(): Partial<Record<Mat, THREE.BufferGeometry>> {
    const out: Partial<Record<Mat, THREE.BufferGeometry>> = {};
    for (const [mat, list] of Object.entries(this.parts) as [
      Mat,
      THREE.BufferGeometry[],
    ][]) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (merged) {
        merged.computeBoundingSphere();
        out[mat] = merged;
      }
    }
    return out;
  }
}

export type Materials = Record<Mat, THREE.Material>;

/** The diner's few shared materials; colours live in the vertices. */
export function makeMaterials(): Materials {
  return {
    paint: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0,
    }),
    gloss: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.16,
    }),
    chrome: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.16,
      metalness: 1,
      envMapIntensity: 1.25,
    }),
    glow: new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.32,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      depthWrite: false,
    }),
  };
}

/** One mesh per material for a built kit, as a group. */
export function meshes(
  parts: Partial<Record<Mat, THREE.BufferGeometry>>,
  materials: Materials,
  shadows: { cast?: boolean; receive?: boolean } = {
    cast: true,
    receive: true,
  },
) {
  const group = new THREE.Group();
  for (const [mat, geo] of Object.entries(parts) as [
    Mat,
    THREE.BufferGeometry,
  ][]) {
    const mesh = new THREE.Mesh(geo, materials[mat]);
    mesh.castShadow = !!shadows.cast && mat !== 'glow' && mat !== 'glass';
    mesh.receiveShadow = !!shadows.receive && mat !== 'glow';
    group.add(mesh);
  }
  return group;
}
