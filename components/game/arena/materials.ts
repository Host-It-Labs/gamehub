import * as THREE from 'three';
import {
  addDrape,
  addFlutter,
  addSway,
  swayingDepth,
  tagCloth,
  type SwayKind,
  type Wind,
} from './wind';

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
  roof: { desat: 0.65, normal: 0.06 },
  stone: { normal: 0.06 },
  wood: { desat: 0.65, normal: 0.08 },
  foliage: { desat: 0.7, normal: 0.04 },
  bark: { desat: 0.8, normal: 0.06 },
  rock: { desat: 0.7, normal: 0.05 },
};
/** How strongly each scenery tile paints over its Blender tint (0 is the
 *  flat tint). */
const paintStrength: Record<string, number> = {
  stone: 0.45,
  roof: 0.4,
  slate: 0.4,
  wood: 0.5,
  bark: 0.55,
  rock: 0.45,
  foliage: 0.5,
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
  // Anatomical figures use their authored surface relief. The shared leather
  // tile would repeat across skin and scales and shimmer at the game camera.
  skin: { rough: 0.64, coat: 0.025, coatRough: 0.65, env: 0.65 },
  reptile: { rough: 0.76, env: 0.55 },
  hair: { rough: 0.48, coat: 0.05, coatRough: 0.55, env: 0.6 },
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
    relief: { texture: 'cloth', strength: 0.12 },
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
  private means = new Map<string, THREE.Vector3>();
  /** Swaying copies of scenery materials and their shadow casters. */
  private swaying = new Map<string, THREE.Material>();
  /** The world's wind, for swaying scenery and waving flags. */
  wind?: Wind;
  constructor(private textures: Textures) {}

  /** A copy of a dressed material that sways in the wind (see wind.ts). */
  sway(material: THREE.Material, kind: SwayKind) {
    if (!this.wind) return material;
    const key = `${material.uuid}|${kind}`;
    const hit = this.swaying.get(key);
    if (hit) return hit;
    const copy = material.clone();
    // clone() leaves the shader hooks behind; the paint needs them.
    copy.onBeforeCompile = material.onBeforeCompile.bind(material);
    copy.customProgramCacheKey = material.customProgramCacheKey.bind(material);
    copy.name = `${material.name}~${kind}`;
    addSway(copy, this.wind, kind);
    this.swaying.set(key, copy);
    return copy;
  }

  /** The shadow caster for swaying scenery of one kind. */
  swayDepth(kind: SwayKind) {
    if (!this.wind) return undefined;
    const key = `depth|${kind}`;
    const hit = this.swaying.get(key);
    if (hit) return hit;
    const depth = swayingDepth(this.wind, kind);
    this.swaying.set(key, depth);
    return depth;
  }

  /** A tile's average linear colour after its wash (`desat`), read once
   *  from a small copy of its image. */
  private paintMean(texture: string, map: THREE.Texture, desat: number) {
    const key = `${texture}-${desat}`;
    const hit = this.means.get(key);
    if (hit) return hit;
    const mean = new THREE.Vector3(0.5, 0.5, 0.5);
    const image = map.image as CanvasImageSource | undefined;
    if (image && typeof document !== 'undefined') {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const g = c.getContext('2d', { willReadFrequently: true });
        if (g) {
          g.drawImage(image, 0, 0, 32, 32);
          const d = g.getImageData(0, 0, 32, 32).data;
          const colour = new THREE.Color();
          const sum = new THREE.Vector3();
          for (let i = 0; i < d.length; i += 4) {
            colour.setRGB(
              d[i] / 255,
              d[i + 1] / 255,
              d[i + 2] / 255,
              THREE.SRGBColorSpace,
            );
            sum.x += colour.r;
            sum.y += colour.g;
            sum.z += colour.b;
          }
          sum.divideScalar(d.length / 4);
          const grey = sum.x * 0.299 + sum.y * 0.587 + sum.z * 0.114;
          mean
            .copy(sum)
            .lerp(
              new THREE.Vector3(1, 1, 1).multiplyScalar(grey * 1.25),
              desat,
            );
        }
      } catch {
        // A tile that cannot be read keeps the neutral middle.
      }
    }
    mean.max(new THREE.Vector3(0.02, 0.02, 0.02));
    this.means.set(key, mean);
    return mean;
  }

  get(name: string, team: Team, hex?: string): THREE.Material {
    // A frozen figure appended into a build that already has the same
    // material gets Blender's `.001` suffix; it is still that material
    // (a `team.001` tint would otherwise lose the side's colour).
    name = name.replace(/\.\d{3}$/, '');
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

  /** Flags and banners: painted cloth, both faces, rippling in the wind
   *  (its second uv set says how free each point is; see wind.ts). */
  private flag(colour: THREE.Color) {
    const set = this.textures.cloth;
    const material = new THREE.MeshStandardMaterial({
      color: colour,
      map: set?.map ?? null,
      normalMap: set?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.5, -0.5),
      roughness: 0.82,
      side: THREE.DoubleSide,
      vertexColors: true,
      envMapIntensity: 0.6,
    });
    extend(material, 0.85);
    if (this.wind) addFlutter(material, this.wind);
    return material;
  }

  private make(texture: string, tint: string, team: Team, hex?: string) {
    const colour = new THREE.Color(tintColour(tint, team, hex));
    // Troops' cloth: painted weave that ripples (wind.ts, addDrape).
    if (texture === 'drape') {
      const drape = this.family(families.weave, colour);
      if (this.wind) addDrape(drape, this.wind);
      return drape;
    }
    const f = families[texture];
    if (f) return this.family(f, colour);
    if (texture === 'flag') return this.flag(colour);
    // Helmet bubbles and visors (9 October 2026): clear, glossy and thin,
    // so the face inside reads from the game camera. No vertex AO: baked
    // occlusion would cloud the glass.
    if (texture === 'glass')
      return new THREE.MeshPhysicalMaterial({
        color: colour,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 2.4,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
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
    const scenery = [
      'stone',
      'roof',
      'slate',
      'wood',
      'bark',
      'rock',
      'foliage',
    ].includes(texture);
    if (scenery && !tint.startsWith('team')) {
      // Coloured props already carry the palette in their Blender materials.
      if (texture === 'stone') colour.set('#efd9b5');
      if (texture === 'roof' || texture === 'slate') colour.set('#ce8167');
    }
    const look = textureLook[texture] ?? {};
    const material = new THREE.MeshStandardMaterial({
      color: colour,
      map: set.map,
      normalMap: set.normalMap,
      // Tiles load unflipped, as glTF expects; derivative tangents then need
      // green flipped, as three's GLTFLoader does.
      normalScale: new THREE.Vector2(look.normal ?? 1, -(look.normal ?? 1)),
      roughnessMap: scenery ? null : set.ormMap,
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
    if (scenery) {
      // The Blender tint carries the colour; the tile adds painted light
      // and shade around it. Divided by its own average (after the wash
      // above), the tile keeps the tint's mean tone at any strength, and
      // `base` keeps the tone the scenery had when the tile was a quarter
      // strength, so a stronger paint changes the detail, not the palette.
      const mean = this.paintMean(texture, set.map, desat);
      const strength = paintStrength[texture] ?? 0.4;
      const base = new THREE.Vector3(1, 1, 1).lerp(mean, 0.24);
      const previous = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        shader.uniforms.uPaintMean = { value: mean };
        shader.uniforms.uPaintBase = { value: base };
        shader.fragmentShader = shader.fragmentShader
          .replace(
            'void main() {',
            'uniform vec3 uPaintMean;\nuniform vec3 uPaintBase;\nvoid main() {',
          )
          .replace(
            'diffuseColor *= sampledDiffuseColor;',
            `diffuseColor.rgb *= uPaintBase * mix(vec3(1.0), sampledDiffuseColor.rgb / uPaintMean, ${strength.toFixed(2)});`,
          )
          .replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
            vec4 paint = texture2D(map, vMapUv);
            diffuseColor.rgb *= uPaintBase * mix(vec3(1.0), paint.rgb / uPaintMean, ${strength.toFixed(2)});
          #endif`,
          );
      };
      material.customProgramCacheKey = () =>
        `cartoon-${texture}-${desat}-${strength}`;
    }
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
      const cloth = Array.isArray(mesh.material) ? undefined : mesh.material;
      if (cloth?.name.startsWith('flag')) tagCloth(mesh);
    });
    return object;
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
    for (const m of this.swaying.values()) m.dispose();
    this.swaying.clear();
  }
}
