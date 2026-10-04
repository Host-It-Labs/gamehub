import * as THREE from 'three';

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
attribute float aPhase;
varying float vAlpha;
void main() {
  float t = fract(uTime / ${LIFE.toFixed(1)} + aPhase);
  vec3 p = position + vec3(t * 0.9, t * 0.7 - t * t * 0.15, -t * 0.25);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uScale * (0.05 + t * 0.22) / -mv.z;
  vAlpha = smoothstep(0.0, 0.08, t) * (1.0 - t) * 0.55;
}`;

const fragment = /* glsl */ `
uniform vec3 uColour;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // A soft puff with a darker core, drawn in two flat tones like the rest.
  float a = vAlpha * smoothstep(0.5, 0.3, d);
  gl_FragColor = vec4(mix(uColour * 0.82, uColour, step(0.22, d)), a);
}`;

export class Smoke {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor(stacks: { x: number; y: number; z: number }[]) {
    const pos: number[] = [];
    const phase: number[] = [];
    stacks.forEach((s, k) => {
      for (let i = 0; i < PER_STACK; i++) {
        pos.push(s.x, s.y, s.z);
        phase.push(i / PER_STACK + k * 0.137);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 600 },
        uColour: { value: new THREE.Color('#c9c1b4') },
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

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
