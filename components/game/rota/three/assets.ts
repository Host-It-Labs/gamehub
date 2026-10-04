import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '@/lib/games/rota/assets.json';
import type { Textures } from './materials';

/**
 * Rota's downloads: the model files (vehicles, town, works, nature),
 * built by scripts/rota-assets.mjs with content hashes in their names, so
 * the browser may keep them for good. One promise per tier is shared by
 * every board on the page. Surfaces are procedural and need no image downloads.
 */
export type AssetFile = { path: string; bytes: number };
type Manifest = {
  textures: Record<
    string,
    {
      albedo: { hq: AssetFile; lite: AssetFile };
      normal: AssetFile;
      orm: AssetFile;
    }
  >;
  models: Record<string, AssetFile>;
};
const files = manifest as Manifest;
export type Tier = 'hq' | 'lite';

export type Library = {
  textures: Textures;
  /** Every model's root by name ("loco_steam", "oak_a" …). */
  models: Map<string, THREE.Object3D>;
};

export function pickTier(): Tier {
  // Small screens still start with the full town and high surface detail.
  // RotaWorld measures frame times and adapts rendering cost afterwards.
  return 'hq';
}

async function load(): Promise<Library> {
  // Procedural material detail is drawn at the canvas's current resolution.
  const textures: Textures = {};
  const loader = new GLTFLoader();
  const models = new Map<string, THREE.Object3D>();
  await Promise.all(
    Object.values(files.models).map(async (file) => {
      try {
        const gltf = await loader.loadAsync(file.path);
        for (const root of gltf.scene.children.slice()) {
          // Shared by every copy: boards never free a model's geometry.
          root.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) mesh.geometry.userData.model = true;
          });
          models.set(root.name, root);
        }
      } catch {
        // A missing model file simply leaves those objects out.
      }
    }),
  );
  return { textures, models };
}

const pending = new Map<Tier, Promise<Library>>();
export function library(tier: Tier) {
  let p = pending.get(tier);
  if (!p) {
    p = load();
    pending.set(tier, p);
  }
  return p;
}

/** Total download, for a loading bar. */
export function bytesFor() {
  let n = 0;
  for (const f of Object.values(files.models)) n += f.bytes;
  return n;
}
