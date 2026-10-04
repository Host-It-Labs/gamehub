import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CardId } from '@/lib/games/arena/cards';
import {
  arenaManifest,
  filesFor,
  loadFiles,
  type Progress,
  type Tier,
} from './assets';
import type { Textures } from './materials';
import type { WorldAssets } from './world';
export { pickQuality } from './quality';

export type Prepared = WorldAssets & { cards: Record<CardId, string> };

async function texture(blob: Blob, colour: boolean) {
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: 'none',
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
  const t = new THREE.Texture(bitmap);
  t.flipY = false;
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Download (or read from the cache) and decode everything a match needs. */
export async function prepare(
  tier: Tier,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<Prepared> {
  const blobs = await loadFiles(filesFor(tier), onProgress, signal);
  const get = (path: string) => {
    const b = blobs.get(path);
    if (!b) throw new Error(`Missing ${path}`);
    return b;
  };
  const textures: Textures = {};
  await Promise.all(
    Object.entries(arenaManifest.textures).map(async ([name, set]) => {
      const [map, normalMap, ormMap] = await Promise.all([
        texture(get(set.albedo[tier].path), true),
        texture(get(set.normal.path), false),
        texture(get(set.orm.path), false),
      ]);
      textures[name] = { map, normalMap, ormMap };
    }),
  );
  const loader = new GLTFLoader();
  const models: Record<
    string,
    Awaited<ReturnType<GLTFLoader['parseAsync']>>
  > = {};
  for (const [name, file] of Object.entries(arenaManifest.models))
    models[name] = await loader.parseAsync(
      await get(file.path).arrayBuffer(),
      '',
    );
  const cards = {} as Record<CardId, string>;
  for (const [id, file] of Object.entries(arenaManifest.cards))
    cards[id as CardId] = URL.createObjectURL(get(file.path));
  return {
    textures,
    towers: models.towers,
    cartoonTowers: models.cartoon_towers,
    troops: models.troops,
    props: models.props,
    figures: models.figures,
    cards,
  };
}
