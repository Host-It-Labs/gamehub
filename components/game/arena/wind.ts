import * as THREE from 'three';

/**
 * The valley's wind. One set of uniforms, shared by every swaying thing
 * (grass, tufts, flowers, bushes, trees, flags and banners) and by the
 * ground's gust sheen, so a gust is one wave rolling across the whole
 * landscape: it bends the grass, then the bushes, then the crowns of the
 * trees as it passes.
 *
 * Everything is in world space and needs no per-instance data: a vertex's
 * bend grows with its height above the ground (read from a small height
 * map of the slab), so a tree's trunk stays planted while its crown sways,
 * and its trunk and crown (separate meshes) bend as one.
 */
export type Wind = {
  uWindTime: { value: number };
  /** Downwind direction on the ground (x, z), unit length. */
  uWindDir: { value: THREE.Vector2 };
  /** 1 for the full sway; less under reduced motion. */
  uWindAmp: { value: number };
  /** Leaf and blade flutter, 0 under reduced motion. */
  uFlutter: { value: number };
  tWindNoise: { value: THREE.Texture | null };
  tGround: { value: THREE.Texture | null };
  /** The height map's extent: left, far, width, depth (world metres). */
  uGroundBox: { value: THREE.Vector4 };
};

export function createWind(
  noise: THREE.Texture,
  ground: THREE.Texture,
  box: THREE.Vector4,
): Wind {
  return {
    uWindTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.86, -0.51).normalize() },
    uWindAmp: { value: 1 },
    uFlutter: { value: 1 },
    tWindNoise: { value: noise },
    tGround: { value: ground },
    uGroundBox: { value: box },
  };
}

/** Uniform declarations and helpers, for vertex and fragment shaders. */
export const WIND_GLSL = /* glsl */ `
uniform float uWindTime;
uniform vec2 uWindDir;
uniform float uWindAmp;
uniform float uFlutter;
uniform sampler2D tWindNoise;
uniform sampler2D tGround;
uniform vec4 uGroundBox;
float groundAt(vec2 p) {
  return texture2D(tGround, (p - uGroundBox.xy) / uGroundBox.zw).r;
}
// How hard the wind blows at a point, 0 (lull) to 1 (gust). Broad gusts
// roll downwind across the valley at about 3 m/s.
float gustAt(vec2 p) {
  vec2 q = p * 0.028 - uWindDir * uWindTime * 0.085;
  float g = texture2D(tWindNoise, q).r * 0.7
    + texture2D(tWindNoise, q * 2.1 + vec2(0.37, 0.71)).g * 0.3;
  return smoothstep(0.36, 0.74, g);
}
// The horizontal bend at a point for a gust strength: a steady lean
// downwind that deepens in the gusts, and a slow sway either way.
vec2 windBend(vec2 p, float gust) {
  vec2 side = vec2(-uWindDir.y, uWindDir.x);
  float sway = sin(uWindTime * 1.6 + dot(p, vec2(0.31, 0.23))) * 0.6
    + sin(uWindTime * 2.7 + dot(p, vec2(-0.19, 0.43))) * 0.4;
  return (uWindDir * (0.3 + 0.95 * gust + sway * (0.18 + 0.3 * gust))
    + side * sway * 0.22) * uWindAmp;
}
`;

/**
 * Per kind: bend per metre of height (`stiff`, trees: the whole tree leans
 * from its foot as one, so its crown keeps its shape) or per metre squared
 * (grass and bushes curve), and leaf flutter (m). Tree crowns do not
 * flutter: on their broad facets a ripple reads as the crown boiling.
 */
export const SWAY = {
  tree: { k: 0.02, flutter: 0, stiff: true },
  bush: { k: 0.045, flutter: 0.009, stiff: false },
  tuft: { k: 0.55, flutter: 0.006, stiff: false },
  trunk: { k: 0.02, flutter: 0, stiff: true },
} as const;
export type SwayKind = keyof typeof SWAY;

/** The vertex code that bends a world position `wp` (in place). */
function swayCode(kind: SwayKind) {
  const { k, flutter, stiff } = SWAY[kind];
  // A tree reads a slow, broad wind that is all but the same over its whole
  // crown, so the crown moves as one; the gust map changes within a crown
  // and would warp it.
  return /* glsl */ `{
    float hAbove = max(0.0, wp.y - groundAt(wp.xz));
    ${
      stiff
        ? `vec2 at = wp.xz * 0.12;
    float gust = 0.35 + 0.3 * sin(uWindTime * 0.45 + at.x * 0.5 - at.y * 0.3);
    vec2 bend = windBend(at, gust) * ${k.toFixed(5)} * hAbove;`
        : `float gust = gustAt(wp.xz);
    vec2 bend = windBend(wp.xz, gust) * ${k.toFixed(5)} * hAbove * hAbove;`
    }
    // Bending shortens the height a little, so tips swing in an arc.
    float drop = dot(bend, bend) / max(0.3, hAbove) * 0.5;
    wp.xz += bend;
    wp.y -= drop;
    ${
      flutter
        ? `// Leaves rustle in clumps (about half a metre), not vertex by vertex.
    float ph = dot(wp.xyz, vec3(2.1, 1.3, 2.7));
    // Fixed rates (see the flags): quicker in a gust by mixing.
    float fl = (sin(uWindTime * 7.5 + ph) * (1.0 - 0.5 * gust)
        + sin(uWindTime * 11.5 + ph * 1.3) * 0.5 * gust)
      * ${flutter.toFixed(4)} * min(hAbove, 1.5) * (0.35 + gust) * uFlutter;
    wp.xyz += vec3(fl, fl * 0.6, -fl * 0.8);`
        : ''
    }
  }`;
}

/**
 * Make a material sway in the wind (works for instanced, merged and plain
 * meshes, and for MeshDepthMaterial shadow casters). Chains onto any
 * onBeforeCompile already set.
 */
export function addSway(
  material: THREE.Material,
  wind: Wind,
  kind: SwayKind,
): THREE.Material {
  const previous = material.onBeforeCompile?.bind(material);
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    Object.assign(shader.uniforms, wind);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${WIND_GLSL}\nvoid main() {`)
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          wp = batchingMatrix * wp;
        #endif
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        ${swayCode(kind)}
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
          vec4 worldPosition = wp;
        #endif`,
      );
  };
  material.customProgramCacheKey = () =>
    `${previousKey?.() ?? ''}|sway-${kind}`;
  material.needsUpdate = true;
  return material;
}

/** A shadow caster's depth material that sways like its colour pass. */
export function swayingDepth(wind: Wind, kind: SwayKind) {
  const depth = new THREE.MeshDepthMaterial();
  return addSway(depth, wind, kind) as THREE.MeshDepthMaterial;
}

/**
 * Flags and banners: cloth that ripples in the wind. Their second uv set
 * (`uv1`, from the Blender scripts) carries how free each point is: x is 0
 * where the cloth is fixed (the pole, the hanging bar) and 1 at the free
 * edge, y a phase so neighbouring flags never flap in step; `tagCloth`
 * adds 8 to y on cloth that hangs (banners and pennants on a wall).
 *
 * A flag swings slowly about its pole, one way then the other, with a
 * ripple running out to its free edge that lifts and drops it a little.
 * Hanging cloth stays near its wall: a small ripple and a sideways sway.
 * Every rate is fixed and the gusts change only how far the cloth moves:
 * time multiplied by a changing rate jumps by time times the change, so
 * the cloth would flap faster and faster as the match went on.
 */
export function addFlutter(material: THREE.Material, wind: Wind) {
  const previous = material.onBeforeCompile?.bind(material);
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    Object.assign(shader.uniforms, wind);
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `${WIND_GLSL}\n#ifndef USE_UV1\nattribute vec2 uv1;\n#endif\nvoid main() {`,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        {
          vec3 wn = normalize(mat3(modelMatrix) * objectNormal);
          float free = uv1.x;
          float hang = step(4.0, uv1.y);
          float ph = fract(uv1.y) * 6.2831;
          float gust = gustAt(wp.xz);
          float A = uWindAmp * free;
          // Hanging cloth and the crest sewn on it may face either way:
          // one sign for both, so they move together.
          vec3 hn = dot(wn, vec3(0.6, 0.0, 0.8)) < 0.0 ? -wn : wn;
          wn = mix(wn, hn, hang);
          // The slow swing either way about the pole, the whole flag at
          // once, and the ripple running out along it.
          float swing = sin(uWindTime * 1.1 + ph) * 0.65
            + sin(uWindTime * 1.75 + ph * 1.3 + 1.0) * 0.35;
          float ripple = sin(uWindTime * 2.6 - free * 4.5 + ph);
          float out_ = mix(
            swing * (0.045 + 0.035 * gust) + ripple * (0.022 + 0.026 * gust),
            ripple * (0.012 + 0.016 * gust),
            hang);
          wp.xyz += wn * out_ * A;
          // Hanging cloth sways sideways along its wall.
          vec3 along = cross(hn, vec3(0.0, 1.0, 0.0));
          float alongLen = length(along);
          if (alongLen > 0.2)
            wp.xyz += along / alongLen * hang * swing * (0.025 + 0.02 * gust) * A;
          // A flag's free edge lifts and drops, and the gusts carry it
          // downwind.
          wp.y += (1.0 - hang) * sin(uWindTime * 1.4 + ph * 0.8 - free * 2.2)
            * (0.012 + 0.018 * gust) * free * A;
          wp.xz += uWindDir * (1.0 - hang) * (0.02 + 0.045 * gust) * free * A;
        }
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
          vec4 worldPosition = wp;
        #endif`,
      );
  };
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}|flutter`;
  material.needsUpdate = true;
  return material;
}

/**
 * Mark cloth that hangs (its free edge below its fixed one) for
 * addFlutter, by adding 8 to its phase. Run once per geometry, while the
 * mesh still stands as modelled (upright).
 */
export function tagCloth(mesh: THREE.Mesh) {
  const g = mesh.geometry;
  const wave = g.getAttribute('uv1') as THREE.BufferAttribute | undefined;
  if (!wave || g.userData.clothTagged) return;
  g.userData.clothTagged = true;
  const position = g.getAttribute('position');
  mesh.updateWorldMatrix(true, false);
  // Its fixed end and its free end: the least and most free points (a
  // crest sewn on a banner has neither 0 nor 1).
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < wave.count; i++) {
    low = Math.min(low, wave.getX(i));
    high = Math.max(high, wave.getX(i));
  }
  if (!(high - low > 0.05)) return;
  const band = (high - low) * 0.15;
  const fixed = new THREE.Vector3();
  const loose = new THREE.Vector3();
  let nFixed = 0;
  let nLoose = 0;
  const p = new THREE.Vector3();
  for (let i = 0; i < wave.count; i++) {
    const f = wave.getX(i);
    p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    if (f <= low + band) {
      fixed.add(p);
      nFixed++;
    } else if (f >= high - band) {
      loose.add(p);
      nLoose++;
    }
  }
  if (!nFixed || !nLoose) return;
  fixed.divideScalar(nFixed);
  loose.divideScalar(nLoose);
  const drop = fixed.y - loose.y;
  const reach = Math.hypot(loose.x - fixed.x, loose.z - fixed.z);
  if (drop <= reach) return;
  for (let i = 0; i < wave.count; i++) wave.setY(i, wave.getY(i) + 8);
  wave.needsUpdate = true;
}

/** The slab's ground heights as a small float texture, for the shaders. */
export function groundHeightTexture(
  height: (x: number, z: number) => number,
  box: { left: number; far: number; width: number; depth: number },
  perMetre = 2,
) {
  const w = Math.round(box.width * perMetre) + 1;
  const h = Math.round(box.depth * perMetre) + 1;
  const data = new Uint16Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = box.left + (i / (w - 1)) * box.width;
      const z = box.far + (j / (h - 1)) * box.depth;
      data[j * w + i] = THREE.DataUtils.toHalfFloat(height(x, z));
    }
  const tex = new THREE.DataTexture(
    data,
    w,
    h,
    THREE.RedFormat,
    THREE.HalfFloatType,
  );
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  // Texel centres sit on the grid points: map the box onto them.
  const half = new THREE.Vector4(
    box.left - box.width / (w - 1) / 2,
    box.far - box.depth / (h - 1) / 2,
    box.width * (w / (w - 1)),
    box.depth * (h / (h - 1)),
  );
  return { texture: tex, box: half };
}

/** Whether decorative motion should be calmed (prefers-reduced-motion). */
export function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Troops' cloth (capes, robes, sashes; the `drape` family): it ripples
 * and billows, more while the troop moves. Its second uv set (`uv1`,
 * kit.drape in the Blender scripts) carries how free each point is (x: 0
 * where it is sewn on, 1 at the hem) and a phase (y). The troop sends how
 * much it is moving (0..1) as its batch colour's alpha above 1
 * (`TroopRenderer.flutter`); the colour pass sets the alpha back to 1.
 *
 * The cloth moves along its part's own z (behind the figure, for a cape),
 * so a cape built with thickness moves as one sheet; waves run down it
 * from the shoulders and across it, and the shading follows them. The
 * rates are fixed (see addFlutter); moving changes only how far it goes,
 * and walking on carries the waves along a little faster.
 *
 * Every program that draws the troop batches moves the cloth the same way
 * (the colour pass, the shadow caster and the x-ray pass's overrides), or
 * the x-ray pass would take the moved cloth for something hidden. On
 * geometry without the uv set (every other troop part) it reads zero and
 * nothing moves.
 */
const DRAPE_GLSL = /* glsl */ `
uniform float uWindTime;
#ifndef USE_UV1
attribute vec2 uv1;
#endif
// The offset (part space) and the slope of the ripple across x and down y.
vec3 drapeAt(vec3 p, mat4 placed, out vec2 slope) {
  float free = clamp(uv1.x, 0.0, 1.0);
  float energy = 0.0;
  #ifdef USE_BATCHING_COLOR
    energy = clamp(getBatchingColor(getIndirectIndex(gl_DrawID)).a - 1.0, 0.0, 1.0);
  #endif
  float ph = uv1.y * 6.2831 + dot(placed[3].xz, vec2(1.3, 1.9));
  // Grows from the seam to the hem, eased so the top hangs on.
  float amp = free * free * (0.014 + 0.05 * energy);
  float a1 = uWindTime * 3.4 + p.y * 9.0 + p.x * 5.0 + ph;
  float a2 = uWindTime * 2.1 + p.y * 5.0 - p.x * 3.0 + ph * 1.7;
  float a3 = uWindTime * 1.3 + ph * 0.6;
  float w = amp * (0.55 * sin(a1) + 0.45 * sin(a2));
  slope = amp * vec2(
    0.55 * cos(a1) * 5.0 - 0.45 * cos(a2) * 3.0,
    0.55 * cos(a1) * 9.0 + 0.45 * cos(a2) * 5.0);
  // A slow billow out behind and a sway to the side, both more on the
  // move.
  float billow = free * (0.012 + 0.04 * energy) * (0.6 + 0.4 * sin(a3));
  float sway = free * free * (0.006 + 0.02 * energy) * sin(a3 * 1.4 + 1.0);
  return vec3(sway, 0.0, w + billow);
}
`;

export function addDrape<M extends THREE.Material>(material: M, wind: Wind) {
  const previous = material.onBeforeCompile?.bind(material);
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    shader.uniforms.uWindTime = wind.uWindTime;
    const placed = /* glsl */ `
      #ifdef USE_BATCHING
        mat4 drapePlaced = batchingMatrix;
      #else
        mat4 drapePlaced = mat4(1.0);
      #endif`;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${DRAPE_GLSL}\nvoid main() {`)
      .replace(
        '#include <color_vertex>',
        /* glsl */ `#include <color_vertex>
        #ifdef USE_BATCHING_COLOR
          vColor.a = 1.0;
        #endif`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `#include <beginnormal_vertex>
        {
          ${placed}
          vec2 slope;
          drapeAt(position, drapePlaced, slope);
          // The shading follows the waves: the normal tilts by their slope.
          float facing = objectNormal.z >= 0.0 ? 1.0 : -1.0;
          objectNormal = normalize(objectNormal - vec3(slope, 0.0) * facing * 1.6);
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        {
          ${placed}
          vec2 slope;
          transformed += drapeAt(position, drapePlaced, slope);
        }`,
      );
  };
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}|drape`;
  material.needsUpdate = true;
  return material;
}
