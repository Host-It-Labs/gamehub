import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ORDER, type MachineKind } from '@/lib/games/relic/factory';
import { makeMaterials, chevronTexture } from './look';
import { beltModel, buildModel, pose, type Pose } from './models';
import type { MatKey } from './kit';

/**
 * Palette pictures of the machines, rendered once from the same models the
 * floor uses, so the palette, inspector and notes always match the floor.
 * One small offscreen renderer draws all ten and is then thrown away.
 */
let made: Promise<Record<MachineKind, string>> | null = null;

export function machineIcons() {
  made ??= new Promise((resolve, reject) => {
    try {
      resolve(render());
    } catch (error) {
      made = null;
      reject(error);
    }
  });
  return made;
}

function render(): Record<MachineKind, string> {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  room.dispose();
  scene.environment = env.texture;
  scene.environmentIntensity = 0.4;
  scene.add(new THREE.HemisphereLight('#fff0d4', '#655e57', 1.4));
  const sun = new THREE.DirectionalLight('#fff0dc', 2.4);
  sun.position.set(-3, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -0.8;
  sun.shadow.camera.right = sun.shadow.camera.top = 0.8;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 10;
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.009;
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  const mats = makeMaterials();
  const chevron = chevronTexture();
  const beltTop = new THREE.MeshStandardMaterial({
    map: chevron,
    roughness: 0.75,
  });
  const out = {} as Record<MachineKind, string>;
  const geos: THREE.BufferGeometry[] = [];
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity: 0.15 }),
  );
  ground.position.y = -0.004;
  ground.receiveShadow = true;
  scene.add(ground);
  const posed: Pose = { p: new THREE.Vector3(), r: new THREE.Euler(), s: 1 };
  const direction = new THREE.Vector3(0.55, 0.78, 0.82).normalize();
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), direction)
    .normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  for (const kind of ORDER) {
    const group = new THREE.Group();
    const add = (
      geo: THREE.BufferGeometry | undefined,
      mat: THREE.Material,
      at?: THREE.Vector3,
      tint?: string,
      motion?: Pose,
    ) => {
      if (!geo) return;
      geos.push(geo);
      const m = tint ? (mat.clone() as THREE.MeshStandardMaterial) : mat;
      if (tint) (m as THREE.MeshStandardMaterial).color.set(tint);
      const mesh = new THREE.Mesh(geo, m);
      if (at) mesh.position.copy(at);
      if (motion) {
        mesh.position.add(motion.p);
        mesh.rotation.copy(motion.r);
        mesh.scale.setScalar(motion.s);
      }
      mesh.castShadow = !m.transparent && mat !== mats.glow;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    if (kind === 'belt') {
      const b = beltModel('straight');
      for (const [mat, geo] of Object.entries(b.body) as [
        MatKey,
        THREE.BufferGeometry,
      ][])
        add(geo, mats[mat]);
      add(b.top, beltTop);
    } else {
      const def = buildModel(kind);
      for (const [mat, geo] of Object.entries(def.body) as [
        MatKey,
        THREE.BufferGeometry,
      ][])
        add(geo, mats[mat]);
      for (const p of def.parts) {
        pose(
          kind,
          p.name,
          {
            t: 0,
            work: 0.45,
            status: 'work',
            since: 99,
            turn: 0,
            boost: true,
            hold: 3,
            seed: 0,
            energy: 1,
            spin: 0.05,
          },
          posed,
        );
        for (const [mat, geo] of Object.entries(p.geos) as [
          MatKey,
          THREE.BufferGeometry,
        ][])
          add(
            geo,
            mats[mat],
            p.pivot,
            p.tint === 'status'
              ? '#86e09c'
              : p.tint === 'book'
                ? '#c8363a'
                : p.tint === 'boost'
                  ? BOOST[kind]
                  : undefined,
            posed,
          );
      }
    }
    scene.add(group);
    // Fit the actual silhouette, including the feather, arm and output chute.
    const bounds = new THREE.Box3().setFromObject(group);
    const target = bounds.getCenter(new THREE.Vector3());
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let dist = 0;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const offset = new THREE.Vector3(x, y, z).sub(target);
          dist = Math.max(
            dist,
            offset.dot(direction) +
              Math.max(Math.abs(offset.dot(right)), Math.abs(offset.dot(up))) /
                tan,
          );
        }
    camera.position
      .copy(direction)
      .multiplyScalar(dist * 1.12)
      .add(target);
    camera.lookAt(target);
    renderer.render(scene, camera);
    out[kind] = canvas.toDataURL('image/png');
    scene.remove(group);
    group.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (
        mesh.isMesh &&
        !Object.values(mats).includes(mesh.material as THREE.Material) &&
        mesh.material !== beltTop
      )
        (mesh.material as THREE.Material).dispose();
    });
  }
  for (const g of geos) g.dispose();
  for (const m of Object.values(mats)) m.dispose();
  beltTop.dispose();
  chevron.dispose();
  env.dispose();
  ground.geometry.dispose();
  ground.material.dispose();
  sun.shadow.map?.dispose();
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
const BOOST: Partial<Record<MachineKind, string>> = {
  lamp: '#fff0b8',
  charm: '#28ad50',
};
