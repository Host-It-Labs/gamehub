import * as THREE from 'three';
import { Kit, type Mat, type Materials } from './kit';

type Entry = {
  parts: Partial<Record<Mat, THREE.BufferGeometry>>;
  last: number;
};
const geometry = new Map<string, Entry>();
const users = new Map<THREE.BufferGeometry, number>();
let clock = 0;
const limit = 96;

function trim() {
  if (geometry.size <= limit) return;
  const idle = [...geometry.entries()]
    .filter(([, entry]) =>
      Object.values(entry.parts).every((geo) => !users.get(geo)),
    )
    .sort((a, b) => a[1].last - b[1].last);
  for (const [key, entry] of idle) {
    if (geometry.size <= limit) break;
    for (const geo of Object.values(entry.parts)) {
      geo?.dispose();
      if (geo) users.delete(geo);
    }
    geometry.delete(key);
  }
}

export function cached(key: string, build: (kit: Kit) => void) {
  let entry = geometry.get(key);
  if (!entry) {
    trim();
    const kit = new Kit();
    build(kit);
    entry = { parts: kit.build(), last: ++clock };
    geometry.set(key, entry);
  }
  entry.last = ++clock;
  return entry.parts;
}

/** Actor clones share geometry and materials; only joints are per actor. */
export function shared(
  parts: Partial<Record<Mat, THREE.BufferGeometry>>,
  materials: Materials,
  cast = true,
) {
  const group = new THREE.Group();
  for (const [mat, geo] of Object.entries(parts) as [
    Mat,
    THREE.BufferGeometry,
  ][]) {
    const mesh = new THREE.Mesh(geo, materials[mat]);
    users.set(geo, (users.get(geo) ?? 0) + 1);
    mesh.userData.dinerShared = true;
    mesh.castShadow = cast && mat !== 'glow' && mat !== 'glass';
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}

/** Removed actors and props release the cache reference; active clones stay safe. */
export function releaseShared(group: THREE.Object3D) {
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.userData.dinerShared) return;
    users.set(node.geometry, Math.max(0, (users.get(node.geometry) ?? 1) - 1));
    node.userData.dinerShared = false;
  });
  trim();
}

export const modelCacheSize = () => geometry.size;

export function disposeCache() {
  for (const { parts } of geometry.values())
    for (const geo of Object.values(parts)) geo?.dispose();
  geometry.clear();
  users.clear();
}
