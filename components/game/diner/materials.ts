import * as THREE from 'three';

/** Small, deterministic, seamless surfaces. Detail stays sharp at native DPR. */
type Surface =
  | 'enamel'
  | 'vinyl'
  | 'cloth'
  | 'steel'
  | 'laminate'
  | 'wood'
  | 'ceramic';
type Maps = {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
};

const N = 256;
const hash = (x: number, y: number, salt = 0) => {
  let n =
    Math.imul((x & 255) + 1031, 374761393) ^
    Math.imul((y & 255) + 917 + salt, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
const texture = (bytes: Uint8Array, colour = false) => {
  const t = new THREE.DataTexture(bytes, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
};

/** UVs are in metres; a tile is 25 cm, so grain never changes with prop size. */
export function surfaceMaps(kind: Surface): Maps {
  const height = new Float32Array(N * N);
  const colour = new Uint8Array(N * N * 4);
  const rough = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const noise = hash(x, y);
      const broad = hash(x >> 2, y >> 2, 11);
      let h = noise * 0.12;
      let shade = 0.99 - noise * 0.016;
      let r = 0.7;
      switch (kind) {
        case 'enamel': {
          const worn = noise > 0.998 ? 0.09 : 0;
          h = broad * 0.025 + noise * 0.035 - worn;
          shade = 0.995 - noise * 0.018 - worn;
          r = 0.35 + broad * 0.18 + worn;
          break;
        }
        case 'vinyl': {
          const pebble = Math.pow(broad, 2) * 0.23;
          h = pebble + noise * 0.06;
          shade = 0.986 - pebble * 0.13;
          r = 0.64 + pebble * 0.8;
          break;
        }
        case 'cloth': {
          const warp = (x % 8 < 4 ? 0.09 : -0.07) * (y % 8 < 4 ? 1 : -1);
          h = warp + noise * 0.07;
          shade = 0.98 - Math.abs(warp) * 0.17 - noise * 0.016;
          r = 0.92 + noise * 0.08;
          break;
        }
        case 'steel': {
          const grain = hash(0, y, 13);
          h = grain * 0.06 + noise * 0.012;
          shade = 0.97 - grain * 0.055;
          r = 0.56 + grain * 0.25;
          break;
        }
        case 'laminate': {
          const fleck = broad > 0.91 ? 0.25 + noise * 0.28 : 0;
          h = noise * 0.02;
          shade = 0.99 - fleck;
          r = 0.57 + noise * 0.12;
          break;
        }
        case 'wood': {
          const wave = Math.sin(
            x * 0.3 + Math.sin((y * Math.PI * 4) / N) * 2.6,
          );
          const grain = (wave + 1) / 2;
          h = grain * 0.065 + noise * 0.02;
          shade = 0.95 - grain * 0.13 - broad * 0.04;
          r = 0.75 + grain * 0.15;
          break;
        }
        case 'ceramic':
          h = broad * 0.014 + noise * 0.012;
          shade = 0.997 - noise * 0.01;
          r = 0.55 + broad * 0.1;
          break;
      }
      height[i] = h;
      const s = Math.round(Math.max(0, Math.min(1, shade)) * 255);
      colour.set([s, s, s, 255], i * 4);
      const rr = Math.round(Math.min(1, r) * 255);
      rough.set([rr, rr, rr, 255], i * 4);
    }
  }
  const normals = new Uint8Array(N * N * 4);
  const at = (x: number, y: number) => height[(y & 255) * N + (x & 255)];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * 1.5;
      const dy = (at(x, y - 1) - at(x, y + 1)) * 1.5;
      const length = Math.hypot(dx, dy, 1);
      normals.set(
        [
          Math.round(((dx / length) * 0.5 + 0.5) * 255),
          Math.round(((dy / length) * 0.5 + 0.5) * 255),
          Math.round(((1 / length) * 0.5 + 0.5) * 255),
          255,
        ],
        (y * N + x) * 4,
      );
    }
  }
  const maps = {
    map: texture(colour, true),
    normalMap: texture(normals),
    roughnessMap: texture(rough),
  };
  for (const t of Object.values(maps)) t.repeat.set(4, 4);
  return maps;
}

/** Shared materials own their maps; disposing a material alone does not free them. */
export function disposeSurfaceMaterials(
  materials: Record<string, THREE.Material>,
) {
  const textures = new Set<THREE.Texture>();
  for (const material of Object.values(materials)) {
    const m = material as THREE.MeshStandardMaterial;
    for (const t of [m.map, m.normalMap, m.roughnessMap])
      if (t) textures.add(t);
    material.dispose();
  }
  for (const t of textures) t.dispose();
}
