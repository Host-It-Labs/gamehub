import * as THREE from 'three';
import { surfaceFunction, surfaceGLSL, uvMetres } from './surfaces';

/**
 * Rota's materials: the mill town drawn in ink and textured colour (3 October
 * 2026). Blender names each material "<family>:<tint>" (see
 * assets/rota/blender/rkit.py); every surface is the tint's own colour,
 * barely lifted, lit in three hard tones (light, mid, shade) with the
 * baked ambient occlusion softened into the vertex colours. The ink lines
 * come from the board's outline pass (world.ts). Sooty brick, slate,
 * sandstone and painted doors keep their sober colours: grown-up, not a
 * toy box.
 *
 * Special tints: `body` (a car's own colour, set per car), `team` and
 * `team2` (a train's livery: the sheet owner's seat colour).
 */
export type TextureSet = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  ormMap: THREE.Texture;
  /** Average linear colour of the tile. */
  mean: THREE.Vector3;
};
export type Textures = Partial<Record<string, TextureSet>>;

/** Seat colours, as railway liveries: an engine's paint and its trim. */
export const seatLivery = [
  { main: '#2d5fa8', dark: '#1b3766' },
  { main: '#a8344c', dark: '#5e1c2b' },
  { main: '#2f7d4f', dark: '#1a4a2e' },
  { main: '#c27a24', dark: '#7a4a12' },
  { main: '#6550a8', dark: '#3a2d66' },
  { main: '#21808f', dark: '#124a54' },
];

/** How far each family's colour is moved: saturation multiplier and a
 *  lift towards white (a little, so shade never goes muddy). */
const push: Record<string, [number, number]> = {
  grass: [1.05, 0.04],
  foliage: [1.1, 0.05],
  field: [1.05, 0.04],
  slate: [1.0, 0.06],
  stone: [1.0, 0.06],
  rock: [1.0, 0.06],
  metal: [0.9, 0.12],
  chrome: [0.7, 0.2],
  glass: [1, 0],
};

const named: Record<string, string> = {
  white: '#f4f1ea',
  black: '#17181b',
  dark: '#2a2d33',
  grey: '#a9a9a9',
  red: '#c63a2c',
  lamp: '#ffd38a',
  window: '#ffcf86',
  cream: '#f1e6cc',
  brass: '#d9a74a',
  steel: '#c9ced6',
  iron: '#4b4d52',
};

export function tintHex(tint: string, livery: number, hex?: string) {
  const l = seatLivery[livery % seatLivery.length];
  if (tint === 'team') return l.main;
  if (tint === 'team2') return l.dark;
  return hex ?? named[tint] ?? '#cccccc';
}

/** A colour moved into the picture-book palette. */
export function cartoon(hex: string, family: string) {
  const c = new THREE.Color(hex);
  const [sat, lift] = push[family] ?? [1.0, 0.04];
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.s = Math.min(0.9, hsl.s * sat);
  hsl.l = hsl.l + (1 - hsl.l) * lift;
  // Nothing goes muddy: the darkest colours keep a little light.
  hsl.l = Math.max(
    hsl.l,
    family === 'rubber' || family === 'plain' ? 0.1 : 0.16,
  );
  return c.setHSL(hsl.h, hsl.s, hsl.l);
}

let gradient: THREE.DataTexture | null = null;
/** Three hard tones: shade, mid and light. */
export function toonRamp() {
  if (gradient) return gradient;
  const steps = [96, 178, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export function toon(
  colour: THREE.ColorRepresentation,
  opts: { vertexColors?: boolean; emissive?: string; glow?: number } = {},
) {
  const m = new THREE.MeshToonMaterial({
    color: new THREE.Color(colour),
    gradientMap: toonRamp(),
    vertexColors: opts.vertexColors ?? false,
  });
  if (opts.emissive) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.glow ?? 1;
  }
  return m;
}

/** Soften the baked occlusion once per geometry: a cartoon keeps it light. */
function softenAO(g: THREE.BufferGeometry) {
  if (g.userData.softAO) return;
  g.userData.softAO = true;
  const c = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!c) {
    const white = new Float32Array(g.getAttribute('position').count * 3).fill(
      1,
    );
    g.setAttribute('color', new THREE.BufferAttribute(white, 3));
    return;
  }
  for (let i = 0; i < c.count; i++)
    for (let k = 0; k < c.itemSize && k < 3; k++) {
      const v = c.getComponent(i, k);
      c.setComponent(i, k, 0.62 + 0.38 * v);
    }
  c.needsUpdate = true;
}

export class Materials {
  private cache = new Map<string, THREE.Material>();
  readonly detail = { value: 1 };
  // No image atlas: procedural surfaces retain detail at every screen density.
  constructor(readonly textures: Textures = {}) {}

  /** Dress a surface without changing its tint or the town's toon lighting.
   * Models use their physical UVs; generated/merged geometry uses a planar
   * projection in world units, including instanced meshes. */
  private surface(m: THREE.MeshToonMaterial, family: string, uvScale?: number) {
    const fn = surfaceFunction[family];
    if (!fn) return m;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uSurfaceDetail = this.detail;
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `varying vec2 vSurfaceUv;
varying vec3 vSurfaceWorld, vSurfaceNormal;
void main() {`,
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
  vSurfaceUv = uv;
  vec4 surfacePosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    surfacePosition = instanceMatrix * surfacePosition;
  #endif
  vSurfaceWorld = (modelMatrix * surfacePosition).xyz;
  vSurfaceNormal = inverseTransformDirection(transformedNormal, viewMatrix);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `varying vec2 vSurfaceUv;
varying vec3 vSurfaceWorld, vSurfaceNormal;
${surfaceGLSL}
void main() {`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
  vec3 surfaceAxes = abs(normalize(vSurfaceNormal));
  vec2 surfaceCoord = ${
    uvScale !== undefined
      ? `vSurfaceUv * ${uvScale.toFixed(4)}`
      : `surfaceAxes.y > max(surfaceAxes.x, surfaceAxes.z) ? vSurfaceWorld.xz
      : surfaceAxes.x > surfaceAxes.z ? vSurfaceWorld.zy : vSurfaceWorld.xy`
  };
  float surfaceValue = ${fn}(surfaceCoord);
  diffuseColor.rgb *= surfaceValue;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
  if (uSurfaceDetail > 0.45)
    normal = rotaRelief(normal, -vViewPosition, surfaceValue * 0.00012);`,
        );
    };
    m.customProgramCacheKey = () =>
      `rota-surface-v1|${family}|${uvScale ?? 'world'}`;
    return m;
  }

  /** A surface built in code (ground, roads, rails), in its own colour. */
  tiled(
    family: string,
    colour: string,
    opts: { rough?: number; vertexColors?: boolean } = {},
  ) {
    const key = `tiled|${family}|${colour}|${opts.vertexColors ?? ''}`;
    const hit = this.cache.get(key);
    if (hit) return hit as THREE.MeshToonMaterial;
    const m = this.surface(
      toon(colour, { vertexColors: opts.vertexColors }),
      family,
    );
    m.name = key;
    this.cache.set(key, m);
    return m;
  }

  get(name: string, livery = 0, hex?: string): THREE.Material {
    const [family, tint = ''] = name.split(':');
    const teamed = tint === 'team' || tint === 'team2';
    const key = `${name}${teamed ? `@${livery}` : ''}|${hex ?? ''}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const made = this.make(family, tint, livery, hex);
    made.name = name;
    this.cache.set(key, made);
    return made;
  }

  private make(family: string, tint: string, livery: number, hex?: string) {
    const raw = tintHex(tint, livery, hex);
    if (family === 'glow') {
      const c = new THREE.Color(raw);
      return new THREE.MeshBasicMaterial({ color: c.multiplyScalar(1.25) });
    }
    if (family === 'glass')
      // Windows: dark glass with a little evening sky in it.
      return toon(tint === 'shed' ? '#9fb5bd' : '#5e7682', {
        vertexColors: true,
        emissive: '#34505e',
        glow: 0.25,
      });
    if (family === 'plain' && tint === 'void')
      return new THREE.MeshBasicMaterial({ color: '#1d2a24' });
    const team = tint === 'team' || tint === 'team2';
    const colour = team ? new THREE.Color(raw) : cartoon(raw, family);
    return this.surface(
      toon(colour, { vertexColors: true }),
      family,
      uvMetres[family],
    );
  }

  /** Swap every Blender material in a loaded model for the dressed one. */
  dress(object: THREE.Object3D, livery = 0, body?: string) {
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swap = (m: THREE.Material) => {
        const name = m.name || 'plain:grey';
        if (body && name.endsWith(':body')) return this.get(name, livery, body);
        return this.get(name, livery, (m.userData as { hex?: string }).hex);
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(swap)
        : swap(mesh.material);
      softenAO(mesh.geometry);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return object;
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}
