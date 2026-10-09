import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceMaps } from './materials';

/**
 * Vertex tint, metre-scale UVs and shared tactile surfaces. Static parts merge
 * per material; heads and limbs stay separate only where a joint moves.
 */
export type Mat =
  | 'paint'
  | 'gloss'
  | 'chrome'
  | 'glow'
  | 'glass'
  | 'cloth'
  | 'skin'
  | 'hair'
  | 'vinyl'
  | 'laminate'
  | 'ceramic'
  | 'wood';
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
    // Boxes use a metre-scale planar chart on each face. Round pieces retain
    // their continuous cylinder/sphere chart, scaled to their circumference.
    const pos = g.getAttribute('position');
    const normal = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    if (
      geo.type === 'BoxGeometry' ||
      geo.type === 'RoundedBoxGeometry' ||
      !uv
    ) {
      const coords = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i += 3) {
        const nx = Math.abs(
          normal.getX(i) + normal.getX(i + 1) + normal.getX(i + 2),
        );
        const ny = Math.abs(
          normal.getY(i) + normal.getY(i + 1) + normal.getY(i + 2),
        );
        const nz = Math.abs(
          normal.getZ(i) + normal.getZ(i + 1) + normal.getZ(i + 2),
        );
        for (let j = i; j < i + 3; j++) {
          coords[j * 2] = nx > ny && nx > nz ? pos.getZ(j) : pos.getX(j);
          coords[j * 2 + 1] = ny > nx && ny > nz ? pos.getZ(j) : pos.getY(j);
        }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(coords, 2));
    } else {
      g.computeBoundingBox();
      const size = g.boundingBox!.getSize(new THREE.Vector3());
      // Profiles already carry UVs in metres.
      if (!geo.userData.metreUV) {
        const around = Math.max(size.x, size.z) * Math.PI;
        const high = Math.max(size.y, Math.min(size.x, size.z));
        for (let i = 0; i < uv.count; i++)
          uv.setXY(i, uv.getX(i) * around, uv.getY(i) * high);
      }
    }
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
  /** Elliptical rings: y, half width, half depth, forward offset. */
  profile(
    mat: Mat,
    colour: string,
    rings: [number, number, number, number?][],
    at: V3,
    o?: Opts,
  ) {
    const segments = 28;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const circumference =
      Math.max(...rings.map((r) => Math.max(r[1], r[2]))) * Math.PI * 2;
    for (const [y, rx, rz, offset = 0] of [...rings].sort(
      (a, b) => a[0] - b[0],
    )) {
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        positions.push(Math.sin(angle) * rx, y, Math.cos(angle) * rz + offset);
        uvs.push((j / segments) * circumference, y);
      }
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j;
        const b = a + segments + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const ordered = [...rings].sort((a, b) => a[0] - b[0]);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const lower = positions.length / 3;
    positions.push(0, first[0], first[3] ?? 0);
    uvs.push(0, first[0]);
    const upper = positions.length / 3;
    positions.push(0, last[0], last[3] ?? 0);
    uvs.push(0, last[0]);
    for (let j = 0; j < segments; j++) {
      indices.push(lower, j + 1, j);
      const a = (rings.length - 1) * (segments + 1) + j;
      indices.push(upper, a, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    g.userData.metreUV = true;
    return this.add(mat, colour, g, at, o);
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
      ...surfaceMaps('ceramic'),
      vertexColors: true,
      normalScale: new THREE.Vector2(0.07, 0.07),
      roughness: 0.78,
      metalness: 0,
    }),
    gloss: new THREE.MeshPhysicalMaterial({
      ...surfaceMaps('enamel'),
      vertexColors: true,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 0.35,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.16,
    }),
    chrome: new THREE.MeshStandardMaterial({
      ...surfaceMaps('steel'),
      vertexColors: true,
      normalScale: new THREE.Vector2(0.14, 0.14),
      roughness: 0.28,
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
      opacity: 0.15,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      depthWrite: false,
    }),
    cloth: new THREE.MeshStandardMaterial({
      ...surfaceMaps('cloth'),
      vertexColors: true,
      roughness: 0.9,
      normalScale: new THREE.Vector2(0.27, 0.27),
    }),
    skin: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.76,
      metalness: 0,
    }),
    hair: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0,
    }),
    vinyl: new THREE.MeshPhysicalMaterial({
      ...surfaceMaps('vinyl'),
      vertexColors: true,
      roughness: 0.62,
      normalScale: new THREE.Vector2(0.36, 0.36),
      clearcoat: 0.38,
      clearcoatRoughness: 0.4,
    }),
    laminate: new THREE.MeshPhysicalMaterial({
      ...surfaceMaps('laminate'),
      vertexColors: true,
      roughness: 0.52,
      normalScale: new THREE.Vector2(0.15, 0.15),
      clearcoat: 0.5,
      clearcoatRoughness: 0.36,
    }),
    ceramic: new THREE.MeshPhysicalMaterial({
      ...surfaceMaps('ceramic'),
      vertexColors: true,
      roughness: 0.4,
      normalScale: new THREE.Vector2(0.1, 0.1),
      clearcoat: 0.65,
      clearcoatRoughness: 0.2,
    }),
    wood: new THREE.MeshStandardMaterial({
      ...surfaceMaps('wood'),
      vertexColors: true,
      roughness: 0.72,
      normalScale: new THREE.Vector2(0.28, 0.28),
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
