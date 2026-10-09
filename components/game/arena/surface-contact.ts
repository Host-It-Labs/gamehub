import * as THREE from 'three';
import type { FigureSurface } from './troops';

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
const attributeVersion = (attribute: Attribute) =>
  'data' in attribute ? attribute.data.version : attribute.version;

/** Exact posed points for one candidate pose. Refresh after every bone or
 * body change. Immutable vertex inputs are cached; current bone matrices
 * stay in double precision, matching SkinnedMesh.getVertexPosition. */
export function createSurfacePointReader(surface: FigureSurface) {
  const mesh = surface.mesh as THREE.SkinnedMesh;
  let fallback = true;
  let matrices: THREE.Matrix4[] = [];
  const indexAt = (i: number) => surface.indices?.[i] ?? i;
  const count = () =>
    surface.indices?.length ?? mesh.geometry.attributes.position.count;
  const build = () => {
    const {
      position,
      skinWeight: weight,
      skinIndex: index,
    } = mesh.geometry.attributes;
    const n = count();
    const base = new Float64Array(n * 4);
    const weights = new Float64Array(n * 4);
    const indices = new Uint32Array(n * 4);
    const active = new Set<number>();
    const v = new THREE.Vector4();
    for (let i = 0; i < n; i++) {
      const vertex = indexAt(i);
      // Three skins a Vector4, without a perspective divide here.
      v.set(
        position.getX(vertex),
        position.getY(vertex),
        position.getZ(vertex),
        1,
      ).applyMatrix4(mesh.bindMatrix);
      v.toArray(base, i * 4);
      for (let c = 0; c < 4; c++) {
        const at = i * 4 + c;
        weights[at] = weight.getComponent(vertex, c);
        indices[at] = index.getComponent(vertex, c);
        if (weights[at] !== 0) active.add(indices[at]);
      }
    }
    matrices = Array.from(
      { length: mesh.skeleton.bones.length },
      () => new THREE.Matrix4(),
    );
    return {
      geometry: mesh.geometry,
      skeleton: mesh.skeleton,
      position,
      positionVersion: attributeVersion(position),
      weight,
      weightVersion: attributeVersion(weight),
      index,
      indexVersion: attributeVersion(index),
      selected: surface.indices,
      count: n,
      bind: mesh.bindMatrix.clone(),
      base,
      weights,
      indices,
      active: [...active],
    };
  };
  let input: ReturnType<typeof build> | undefined;
  const matches = (a: ReturnType<typeof build>) => {
    const attrs = mesh.geometry.attributes;
    return (
      a.geometry === mesh.geometry &&
      a.skeleton === mesh.skeleton &&
      a.position === attrs.position &&
      a.positionVersion === attributeVersion(attrs.position) &&
      a.weight === attrs.skinWeight &&
      a.weightVersion === attributeVersion(attrs.skinWeight) &&
      a.index === attrs.skinIndex &&
      a.indexVersion === attributeVersion(attrs.skinIndex) &&
      a.selected === surface.indices &&
      a.count === count() &&
      a.bind.equals(mesh.bindMatrix)
    );
  };
  return {
    get count() {
      return count();
    },
    get mode() {
      return fallback ? 'native' : 'cached';
    },
    refresh() {
      fallback =
        !mesh.isSkinnedMesh ||
        !surface.indices ||
        mesh.getVertexPosition !==
          THREE.SkinnedMesh.prototype.getVertexPosition ||
        mesh.applyBoneTransform !==
          THREE.SkinnedMesh.prototype.applyBoneTransform ||
        !!mesh.morphTargetInfluences?.some((weight) => weight !== 0);
      if (fallback) return;
      if (!input || !matches(input)) input = build();
      for (const bone of input.active)
        matrices[bone].multiplyMatrices(
          mesh.skeleton.bones[bone].matrixWorld,
          mesh.skeleton.boneInverses[bone],
        );
    },
    read(i: number, target: THREE.Vector3) {
      if (fallback || !input)
        return mesh
          .getVertexPosition(indexAt(i), target)
          .applyMatrix4(mesh.matrixWorld);
      const at = i * 4;
      const { base, weights, indices } = input;
      const bx = base[at];
      const by = base[at + 1];
      const bz = base[at + 2];
      const bw = base[at + 3];
      let x = 0;
      let y = 0;
      let z = 0;
      for (let c = 0; c < 4; c++) {
        const weight = weights[at + c];
        if (weight === 0) continue;
        const e = matrices[indices[at + c]].elements;
        // Match Vector4 followed by Vector3.addScaledVector, in order.
        x += (e[0] * bx + e[4] * by + e[8] * bz + e[12] * bw) * weight;
        y += (e[1] * bx + e[5] * by + e[9] * bz + e[13] * bw) * weight;
        z += (e[2] * bx + e[6] * by + e[10] * bz + e[14] * bw) * weight;
      }
      // Keep the native operation order rather than fusing transforms.
      return target
        .set(x, y, z)
        .applyMatrix4(mesh.bindMatrixInverse)
        .applyMatrix4(mesh.matrixWorld);
    },
  };
}
