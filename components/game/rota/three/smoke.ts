import * as THREE from 'three';
import type { QualityTier } from '@/lib/games/rota/quality';

/**
 * Chimney smoke: soft grey puffs rising from every mill stack and drifting
 * east on the wind, growing and thinning as they go. One Points object
 * whose shader moves each puff from its stack and its phase; under reduced
 * motion the puffs hold still.
 */

const PER_STACK = 7;
const LIFE = 7;

const vertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uCount;
attribute float aPhase;
attribute float aIndex;
varying float vAlpha;
varying float vDepth;
void main() {
  float t = fract(uTime / ${LIFE.toFixed(1)} + aPhase);
  vec3 p = position + vec3(t * 0.9, t * 0.7 - t * t * 0.15, -t * 0.25);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uScale * (0.05 + t * 0.22) / -mv.z;
  vDepth = -mv.z;
  vAlpha = smoothstep(0.0, 0.08, t) * (1.0 - t) * 0.55 * (1.0 - step(uCount, aIndex));
}`;

const fragment = /* glsl */ `
uniform vec3 uColour;
uniform vec3 uHaze;
uniform vec2 uFog;
varying float vAlpha;
varying float vDepth;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5 || vAlpha < 0.001) discard;
  // A soft puff with a darker core, drawn in two flat tones like the rest.
  float a = vAlpha * smoothstep(0.5, 0.3, d);
  float fog = smoothstep(uFog.x, uFog.y, vDepth);
  vec3 col = mix(uColour * 0.82, uColour, step(0.22, d));
  gl_FragColor = vec4(mix(col, uHaze, fog), a * (1.0 - fog * 0.65));
}`;

export class Smoke {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private day = new THREE.Color('#c9c1b4');
  private evening = new THREE.Color('#9faec0');

  constructor(stacks: { x: number; y: number; z: number }[]) {
    const pos: number[] = [];
    const phase: number[] = [];
    const index: number[] = [];
    stacks.forEach((s, k) => {
      for (let i = 0; i < PER_STACK; i++) {
        pos.push(s.x, s.y, s.z);
        phase.push(i / PER_STACK + k * 0.137);
        index.push(i);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    g.setAttribute('aIndex', new THREE.Float32BufferAttribute(index, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 600 },
        uColour: { value: new THREE.Color('#c9c1b4') },
        uHaze: { value: new THREE.Color('#e4d6bd') },
        uFog: { value: new THREE.Vector2(20, 60) },
        uCount: { value: PER_STACK },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  /** Pixels per unit at depth one, so the puffs keep their size on screen. */
  setScale(pixelsAtUnitDepth: number) {
    this.material.uniforms.uScale.value = pixelsAtUnitDepth;
  }

  tick(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  setDusk(dusk: number) {
    (this.material.uniforms.uColour.value as THREE.Color)
      .copy(this.day)
      .lerp(this.evening, dusk);
  }

  setFog(fog: THREE.Fog) {
    (this.material.uniforms.uHaze.value as THREE.Color).copy(fog.color);
    (this.material.uniforms.uFog.value as THREE.Vector2).set(fog.near, fog.far);
  }

  setQuality(tier: QualityTier) {
    this.material.uniforms.uCount.value =
      tier === 'high' ? 7 : tier === 'balanced' ? 5 : 3;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
