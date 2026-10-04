import * as THREE from 'three';

/** A ship fills its own preview bay. Measure only visible hardware, in the
 * preview camera's orientation; a base module never enters this frame.
 * Geometry bounds include morph poses, so the landing legs keep clearance. */
export function shipPreviewFrame(group: THREE.Group, turn: THREE.Quaternion) {
  const saved = {
    position: group.position.clone(),
    quaternion: group.quaternion.clone(),
    scale: group.scale.clone(),
    visible: group.visible,
  };
  group.position.set(0, 0, 0);
  group.quaternion.copy(turn);
  group.scale.setScalar(1);
  group.visible = true;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const part = new THREE.Box3();
  group.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh) || object.userData.ghostly) return;
    if (object instanceof THREE.InstancedMesh) {
      object.computeBoundingBox();
      part.copy(object.boundingBox!);
    } else {
      object.geometry.computeBoundingBox();
      part.copy(object.geometry.boundingBox!);
    }
    bounds.union(part.applyMatrix4(object.matrixWorld));
  });
  group.position.copy(saved.position);
  group.quaternion.copy(saved.quaternion);
  group.scale.copy(saved.scale);
  group.visible = saved.visible;
  group.updateMatrixWorld(true);
  const size = bounds.getSize(new THREE.Vector3());
  return {
    centre: bounds.getCenter(new THREE.Vector3()),
    span: Math.max(size.x, size.y, 0.01),
    width: Math.max(size.x, 0.01),
    height: Math.max(size.y, 0.01),
  };
}

/** A base fills its slot: everything drawn (the chassis, the built modules,
 * and the docked ship's box when it stands there), measured vertex by vertex
 * in the slot's orientation, so a young station is framed as closely as a
 * full one. A module not yet built (`userData.ghost`) and soft light
 * (`userData.ghostly`) are left out, so a pick never moves the frame.
 * `extra` points are in the group's own space. Returns the centre in the
 * turned frame and the width and height a slot must hold, unscaled. */
export function baseFrame(
  group: THREE.Group,
  turn: THREE.Quaternion,
  extra: readonly THREE.Vector3[] = [],
) {
  const saved = {
    position: group.position.clone(),
    quaternion: group.quaternion.clone(),
    scale: group.scale.clone(),
    visible: group.visible,
  };
  group.position.set(0, 0, 0);
  group.quaternion.copy(turn);
  group.scale.setScalar(1);
  group.visible = true;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const part = new THREE.Box3();
  const v = new THREE.Vector3();
  const visit = (object: THREE.Object3D) => {
    if (!object.visible || object.userData.ghost) return;
    if (object instanceof THREE.Mesh && !object.userData.ghostly) {
      if (object instanceof THREE.InstancedMesh) {
        object.computeBoundingBox();
        bounds.union(
          part.copy(object.boundingBox!).applyMatrix4(object.matrixWorld),
        );
      } else {
        const p = object.geometry.getAttribute('position');
        const e = object.matrixWorld.elements;
        let x0 = Infinity;
        let y0 = Infinity;
        let z0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        let z1 = -Infinity;
        for (let i = 0; i < p.count; i++) {
          const a = p.getX(i);
          const b = p.getY(i);
          const c = p.getZ(i);
          const x = e[0] * a + e[4] * b + e[8] * c + e[12];
          const y = e[1] * a + e[5] * b + e[9] * c + e[13];
          const z = e[2] * a + e[6] * b + e[10] * c + e[14];
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          if (z < z0) z0 = z;
          if (z > z1) z1 = z;
        }
        if (p.count) {
          bounds.expandByPoint(v.set(x0, y0, z0));
          bounds.expandByPoint(v.set(x1, y1, z1));
        }
      }
    }
    for (const child of object.children) visit(child);
  };
  visit(group);
  for (const point of extra)
    bounds.expandByPoint(v.copy(point).applyMatrix4(group.matrixWorld));
  group.position.copy(saved.position);
  group.quaternion.copy(saved.quaternion);
  group.scale.copy(saved.scale);
  group.visible = saved.visible;
  group.updateMatrixWorld(true);
  const size = bounds.getSize(new THREE.Vector3());
  return {
    centre: bounds.getCenter(new THREE.Vector3()),
    width: Math.max(size.x, 0.01),
    height: Math.max(size.y, 0.01),
  };
}
