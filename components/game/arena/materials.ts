import * as THREE from 'three';

/**
 * Materials for Arena's toys. Blender names each material "<family>:<tint>"
 * (see assets/arena/blender/kit.py): a surface family of the toy world
 * (glossy plastic, satin vinyl, rubber, tinplate, chrome, lacquered paint,
 * natural beech, felt) or a high-resolution tile (cloth), multiplied by the
 * tint and by the ambient occlusion baked into the vertex colours. "team"
 * tints follow the side (blue for you, red for the other side); any other
 * tint is a name here or the hex colour the model script gave it, which the
 * GLB carries in the material's extras.
 */
export type TextureSet = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  ormMap: THREE.Texture;
};
export type Textures = Record<string, TextureSet>;
export type Team = 0 | 1;

export const teamColours: Record<
  Team,
  { main: string; dark: string; light: string }
> = {
  0: { main: '#2f63e0', dark: '#1c3a94', light: '#8fb6ff' },
  1: { main: '#d8382c', dark: '#8e1f1a', light: '#ff9a8a' },
};

/** Tints in sRGB. Keep the names in step with kit.TINTS. */
const tints: Record<string, string> = {
  warm: '#fff3e2',
  cool: '#e4ebf7',
  steel: '#f2f5fb',
  silver: '#dfe3ea',
  dark: '#8a93aa',
  gold: '#ffc453',
  brass: '#f0b764',
  iron: '#76767e',
  brown: '#b98555',
  tan: '#f3d3a2',
  cream: '#f7ecd4',
  honey: '#ffe7c2',
  peach: '#ffc7a2',
  ogre: '#a3b381',
  imp: '#94b64f',
  drake: '#f2692a',
  belly: '#ffd98f',
  white: '#f6f5f0',
  black: '#0b0b0e',
  fire: '#ff9a2e',
  green: '#8cc15b',
  grey: '#b5b5b5',
  red: '#c9281e',
  umber: '#a8876c',
  chestnut: '#7a5340',
  pine: '#4f7f5a',
  moss: '#7fa04c',
  leaf2: '#b6c95a',
  'petal-white': '#fbf8ee',
  'petal-pink': '#f19ac4',
  'petal-yellow': '#ffd84a',
  'petal-violet': '#9e7aeb',
  tuft: '#6ba833',
};

/** Per texture: how much to wash out its own colour before tinting (skins
 * reuse the leather tile), roughness scale and metalness. */
const textureLook: Record<
  string,
  { desat?: number; rough?: number; metal?: number; normal?: number }
> = {
  metal: { rough: 0.75, metal: 1, normal: 0.45 },
  leather: { desat: 0.25, normal: 0.7 },
  cloth: { normal: 0.6 },
  roof: { normal: 1 },
  stone: { normal: 1 },
  wood: { normal: 0.9 },
  foliage: { desat: 0.15, normal: 0.8 },
  bark: { normal: 1 },
  rock: { normal: 1 },
};
/** Leather tinted as skin or scales loses most of its brown. */
const skinTints = new Set(['ogre', 'imp', 'drake', 'belly', 'peach']);

export function tintColour(tint: string, team: Team, hex?: string) {
  if (tint === 'team') return teamColours[team].main;
  if (tint === 'team2') return teamColours[team].dark;
  if (tint === 'team3') return teamColours[team].light;
  return hex ?? tints[tint] ?? '#cccccc';
}

/**
 * The toy surface families. Plastic, tin and paint wear a clear coat so they
 * catch the window like real toys; rubber takes the leather tile's fine
 * grain as a pebbly relief, paint the beech grain faintly under its lacquer.
 */
type Family = {
  rough: number;
  metal?: number;
  coat?: number;
  coatRough?: number;
  env?: number;
  sheen?: number;
  /** A tile whose relief (and, for 'map', colour) the family borrows. */
  relief?: { texture: string; strength: number; map?: boolean };
};
const families: Record<string, Family> = {
  plastic: { rough: 0.3, coat: 0.55, coatRough: 0.12, env: 1 },
  vinyl: { rough: 0.46, coat: 0.2, coatRough: 0.3, env: 0.8 },
  rubber: {
    rough: 0.56,
    env: 0.6,
    relief: { texture: 'leather', strength: 0.32 },
  },
  tin: { rough: 0.3, metal: 0.4, coat: 0.7, coatRough: 0.1, env: 1.1 },
  chrome: { rough: 0.12, metal: 1, env: 1.5 },
  paint: {
    rough: 0.36,
    coat: 0.6,
    coatRough: 0.14,
    env: 0.9,
    relief: { texture: 'beech', strength: 0.25 },
  },
  beech: {
    rough: 0.5,
    coat: 0.3,
    coatRough: 0.25,
    env: 0.7,
    relief: { texture: 'beech', strength: 0.4, map: true },
  },
  felt: {
    rough: 1,
    env: 0.4,
    sheen: 1,
    relief: { texture: 'cloth', strength: 0.5 },
  },
  // The collector's miniatures: hand-painted resin, lacquered plates,
  // metallic paint, sculpted scaly hide and painted cloth.
  resin: { rough: 0.58, coat: 0.08, coatRough: 0.5, env: 0.75 },
  lacquer: { rough: 0.28, coat: 0.45, coatRough: 0.18, env: 1 },
  gilt: { rough: 0.32, metal: 0.85, env: 1.25 },
  hide: {
    rough: 0.55,
    env: 0.7,
    relief: { texture: 'leather', strength: 0.5 },
  },
  weave: {
    rough: 0.85,
    env: 0.55,
    sheen: 0.4,
    relief: { texture: 'cloth', strength: 0.35 },
  },
};

function extend(material: THREE.MeshStandardMaterial, desat: number) {
  if (!desat) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDesat = { value: desat };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uDesat;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          float grey = dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
          sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, vec3( grey ) * 1.25, uDesat );
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
  };
  material.customProgramCacheKey = () => `desat-${desat}`;
}

export class MaterialLibrary {
  private cache = new Map<string, THREE.Material>();
  constructor(private textures: Textures) {}

  get(name: string, team: Team, hex?: string): THREE.Material {
    const [texture, tint = ''] = name.split(':');
    const teamed = tint === 'team' || tint === 'team2' || tint === 'team3';
    const key = teamed ? `${name}@${team}` : name;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const made = this.make(texture, tint, team, hex);
    made.name = key;
    this.cache.set(key, made);
    return made;
  }

  private family(f: Family, colour: THREE.Color) {
    const set = f.relief ? this.textures[f.relief.texture] : undefined;
    const strength = f.relief?.strength ?? 0;
    const material = new THREE.MeshPhysicalMaterial({
      color: colour,
      roughness: f.rough,
      metalness: f.metal ?? 0,
      clearcoat: f.coat ?? 0,
      clearcoatRoughness: f.coatRough ?? 0.2,
      sheen: f.sheen ?? 0,
      sheenRoughness: 0.6,
      envMapIntensity: f.env ?? 1,
      vertexColors: true,
      map: set && f.relief?.map ? set.map : null,
      normalMap: set ? set.normalMap : null,
      // Tiles load unflipped, as glTF expects; derivative tangents then need
      // green flipped, as three's GLTFLoader does.
      normalScale: new THREE.Vector2(strength, -strength),
    });
    if (f.sheen)
      material.sheenColor.copy(colour).lerp(new THREE.Color('#ffffff'), 0.5);
    return material;
  }

  private make(texture: string, tint: string, team: Team, hex?: string) {
    const colour = new THREE.Color(tintColour(tint, team, hex));
    const f = families[texture];
    if (f) return this.family(f, colour);
    if (texture === 'fire' || texture === 'glow')
      return new THREE.MeshStandardMaterial({
        color: colour,
        emissive: colour,
        emissiveIntensity: 2.6,
        roughness: 0.6,
        toneMapped: false,
      });
    const set = this.textures[texture];
    if (!set || texture === 'plain') {
      const eyes = tint === 'black' || tint === 'white';
      return new THREE.MeshStandardMaterial({
        color: colour,
        roughness: eyes ? 0.25 : 0.75,
        vertexColors: true,
      });
    }
    const look = textureLook[texture] ?? {};
    const material = new THREE.MeshStandardMaterial({
      color: colour,
      map: set.map,
      normalMap: set.normalMap,
      // Tiles load unflipped, as glTF expects; derivative tangents then need
      // green flipped, as three's GLTFLoader does.
      normalScale: new THREE.Vector2(look.normal ?? 1, -(look.normal ?? 1)),
      roughnessMap: set.ormMap,
      metalnessMap: look.metal ? set.ormMap : null,
      aoMap: null,
      roughness: look.rough ?? 1,
      metalness: look.metal ?? 0,
      vertexColors: true,
      envMapIntensity: look.metal ? 2.2 : 0.6,
    });
    const desat =
      texture === 'leather' && skinTints.has(tint) ? 0.85 : (look.desat ?? 0);
    extend(material, desat);
    return material;
  }

  /** Replace every Blender material in a loaded model by the dressed one. */
  dress(object: THREE.Object3D, team: Team) {
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swap = (m: THREE.Material) =>
        this.get(
          m.name || 'plain:grey',
          team,
          (m.userData as { hex?: string }).hex,
        );
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(swap)
        : swap(mesh.material);
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
