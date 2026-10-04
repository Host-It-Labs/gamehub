import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Fewer draw calls for Arena's still scenery, without changing a pixel:
 * meshes that never move are baked into world space and merged by material,
 * and scattered props are culled per instance for the camera and for the
 * sun's shadow box separately.
 */

/** One mesh's triangles, baked into world space, ready to merge. */
export type StaticPiece = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
  /** Drawn only while this object and its parents are visible. */
  owner?: THREE.Object3D;
};

/**
 * Take the meshes out of a placed object and hand them back baked into
 * world space. Subtrees named in `live` stay where they are, as do meshes
 * that could not merge unchanged (several materials, mirrored, hidden).
 */
export function bakeStatic(
  root: THREE.Object3D,
  owner?: THREE.Object3D,
  live: ReadonlySet<string> = new Set(),
): StaticPiece[] {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    // The root's own visibility is the owner's business, not a skip.
    if (live.has(o.name) || (o !== root && !o.visible)) return;
    const mesh = o as THREE.Mesh;
    if (
      mesh.isMesh &&
      !(mesh as THREE.InstancedMesh).isInstancedMesh &&
      !Array.isArray(mesh.material) &&
      mesh.matrixWorld.determinant() > 0
    )
      meshes.push(mesh);
    for (const c of o.children) walk(c);
  };
  walk(root);
  return meshes.map((mesh) => {
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    mesh.removeFromParent();
    return {
      geometry,
      material: mesh.material as THREE.Material,
      castShadow: mesh.castShadow,
      receiveShadow: mesh.receiveShadow,
      owner,
    };
  });
}

/** Pieces only merge when their attributes match exactly. */
function layout(g: THREE.BufferGeometry) {
  const attributes = Object.entries(g.attributes)
    .map(
      ([name, a]) =>
        `${name}:${a.itemSize}:${a.normalized ? 1 : 0}:${a.array.constructor.name}`,
    )
    .sort();
  return `${attributes.join(',')}|${Object.keys(g.morphAttributes).sort().join(',')}`;
}

function visibleInScene(o: THREE.Object3D) {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (!n.visible) return false;
    if ((n as THREE.Scene).isScene) return true;
  }
  return false;
}

type Range = { mesh: THREE.Mesh; start: number; count: number };

/**
 * Pieces merged into one mesh per material. A piece with an owner follows
 * that owner's visibility: hiding it blanks its triangles in the shared
 * index (restored when it shows again), so towers of one material still
 * draw together and can fall one at a time. Call sync() before each render.
 */
export class StaticMerge {
  readonly meshes: THREE.Mesh[] = [];
  private owners = new Map<
    THREE.Object3D,
    { shown: boolean; ranges: Range[] }
  >();
  /** Each mesh's full index, to restore blanked ranges from. */
  private indices = new Map<THREE.Mesh, ArrayLike<number>>();

  constructor(pieces: StaticPiece[]) {
    const groups = new Map<string, StaticPiece[]>();
    for (const p of pieces) {
      // Merged pieces must all be indexed (or none be).
      if (!p.geometry.index) {
        const n = p.geometry.attributes.position.count;
        p.geometry.setIndex([...Array(n).keys()]);
      }
      const key = `${p.material.uuid}|${+p.castShadow}${+p.receiveShadow}|${layout(p.geometry)}`;
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
    for (const list of groups.values()) this.build(list);
    for (const p of pieces) p.geometry.dispose();
    this.sync();
  }

  private build(list: StaticPiece[]) {
    const merged = mergeGeometries(list.map((p) => p.geometry));
    if (!merged) {
      // Should not happen with matching layouts; keep them apart if it does.
      if (list.length > 1) for (const p of list) this.build([p]);
      return;
    }
    const { material, castShadow, receiveShadow } = list[0];
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `static:${material.name}`;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.matrixAutoUpdate = false;
    merged.computeBoundingSphere();
    this.meshes.push(mesh);
    const index = merged.index!;
    this.indices.set(mesh, index.array.slice());
    let start = 0;
    for (const p of list) {
      const count = p.geometry.index!.count;
      if (p.owner) {
        const entry = this.owners.get(p.owner) ?? { shown: true, ranges: [] };
        entry.ranges.push({ mesh, start, count });
        this.owners.set(p.owner, entry);
      }
      start += count;
    }
  }

  /** Follow the owners' visibility. Cheap when nothing changed. */
  sync() {
    let changed = false;
    for (const [owner, entry] of this.owners) {
      const shown = visibleInScene(owner);
      if (shown === entry.shown) continue;
      entry.shown = shown;
      changed = true;
      for (const { mesh, start, count } of entry.ranges) {
        const index = mesh.geometry.index!;
        const array = index.array as Uint16Array | Uint32Array;
        if (shown)
          array.set(
            (this.indices.get(mesh) as Uint16Array | Uint32Array).subarray(
              start,
              start + count,
            ),
            start,
          );
        // Degenerate triangles draw nothing.
        else array.fill(0, start, start + count);
        index.addUpdateRange(start, count);
        index.needsUpdate = true;
      }
    }
    if (!changed) return;
    // A mesh whose owners are all hidden skips its draw altogether.
    const lit = new Map<THREE.Mesh, boolean>();
    for (const entry of this.owners.values())
      for (const { mesh } of entry.ranges)
        lit.set(mesh, (lit.get(mesh) ?? false) || entry.shown);
    for (const [mesh, on] of lit) mesh.visible = on;
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.meshes.length = 0;
    this.owners.clear();
    this.indices.clear();
  }
}

type ScatterPart = {
  /** Every instance's matrix, 16 floats each. */
  matrices: Float32Array;
  /** Every instance's bounding sphere in world space: x, y, z, radius. */
  spheres: Float32Array;
  /** Instances in view, drawn by the camera only. */
  view: THREE.InstancedMesh;
  viewIds: Int32Array;
  /** Instances inside the shadow box, drawn by the sun only. */
  shade?: THREE.InstancedMesh;
  shadeIds: Int32Array;
  shadeCount: number;
};

/**
 * Scattered props as instanced meshes, culled per instance: one mesh per
 * part draws the instances the camera sees, a second one (for parts that
 * cast shadows) the instances inside the sun's shadow box, in the shadow
 * pass only. Both lists are rebuilt whenever the camera or the sun moves,
 * so the picture is exactly what drawing every instance would give.
 */
export class ScatterCuller {
  readonly meshes: THREE.InstancedMesh[] = [];
  private parts: ScatterPart[] = [];
  private seen = new Float64Array(80).fill(NaN);
  private frustum = new THREE.Frustum();
  private matrix = new THREE.Matrix4();
  private scratch = new Int32Array(0);

  /** `pad` widens every test (in metres) so a shaking camera rarely re-uploads. */
  constructor(private pad = 1) {}

  add(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrices: THREE.Matrix4[],
    castShadow: boolean,
    receiveShadow: boolean,
    /** A depth material for the shadow pass (one that sways, say). */
    depth?: THREE.Material,
  ) {
    const n = matrices.length;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const bound = geometry.boundingSphere!;
    const sphere = new THREE.Sphere();
    const part: ScatterPart = {
      matrices: new Float32Array(n * 16),
      spheres: new Float32Array(n * 4),
      view: this.mesh(name, geometry, material, n),
      viewIds: new Int32Array(n),
      shadeIds: new Int32Array(n),
      shadeCount: 0,
    };
    matrices.forEach((m, i) => {
      m.toArray(part.matrices, i * 16);
      sphere.copy(bound).applyMatrix4(m);
      part.spheres.set(
        [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius],
        i * 4,
      );
    });
    part.view.receiveShadow = receiveShadow;
    if (castShadow) {
      const shade = this.mesh(name, geometry, material, n);
      shade.castShadow = true;
      if (depth) shade.customDepthMaterial = depth;
      // The sun draws these; the camera skips them (its list is `view`).
      shade.onBeforeRender = () => {
        shade.count = 0;
      };
      shade.onAfterRender = () => {
        shade.count = part.shadeCount;
      };
      part.shade = shade;
    }
    if (this.scratch.length < n) this.scratch = new Int32Array(n);
    this.parts.push(part);
  }

  private mesh(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    n: number,
  ) {
    const mesh = new THREE.InstancedMesh(geometry, material, n);
    mesh.name = name;
    mesh.count = 0;
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.meshes.push(mesh);
    return mesh;
  }

  /** Re-cull if the camera or the sun moved since last time. */
  update(camera: THREE.Camera, sun: THREE.DirectionalLight) {
    camera.updateMatrixWorld();
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    const shadowCamera = sun.shadow.camera;
    let k = 0;
    let moved = false;
    for (const m of [
      camera.matrixWorld,
      camera.projectionMatrix,
      sun.matrixWorld,
      sun.target.matrixWorld,
      shadowCamera.projectionMatrix,
    ])
      for (const v of m.elements) {
        if (this.seen[k] !== v) {
          this.seen[k] = v;
          moved = true;
        }
        k++;
      }
    if (!moved) return;
    this.frustum.setFromProjectionMatrix(
      this.matrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    // The same box three culls shadow casters with.
    sun.shadow.updateMatrices(sun);
    const shadowFrustum = sun.shadow.getFrustum();
    for (const part of this.parts) {
      this.cull(part, part.view, part.viewIds, this.frustum);
      if (part.shade)
        part.shadeCount = this.cull(
          part,
          part.shade,
          part.shadeIds,
          shadowFrustum,
        );
    }
  }

  /** Put the instances touching `frustum` in `mesh`; returns how many. */
  private cull(
    part: ScatterPart,
    mesh: THREE.InstancedMesh,
    ids: Int32Array,
    frustum: THREE.Frustum,
  ) {
    const { spheres } = part;
    const planes = frustum.planes;
    const next = this.scratch;
    const total = spheres.length / 4;
    let n = 0;
    for (let i = 0; i < total; i++) {
      const x = spheres[i * 4];
      const y = spheres[i * 4 + 1];
      const z = spheres[i * 4 + 2];
      const r = -(spheres[i * 4 + 3] + this.pad);
      let inside = true;
      for (let p = 0; p < 6; p++) {
        const { normal, constant } = planes[p];
        if (normal.x * x + normal.y * y + normal.z * z + constant < r) {
          inside = false;
          break;
        }
      }
      if (inside) next[n++] = i;
    }
    // Outside a render, count is the live list's length for both meshes.
    let same = n === mesh.count;
    for (let j = 0; same && j < n; j++) same = ids[j] === next[j];
    if (same) return n;
    const array = mesh.instanceMatrix.array as Float32Array;
    for (let j = 0; j < n; j++) {
      const i = next[j];
      ids[j] = i;
      array.set(part.matrices.subarray(i * 16, i * 16 + 16), j * 16);
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (n) {
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, n * 16);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return n;
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.meshes.length = 0;
    this.parts.length = 0;
  }
}
