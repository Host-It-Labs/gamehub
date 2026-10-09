import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { WebGLRenderTarget } from 'three';

/**
 * The picture book's ink: a dark line round every silhouette, found where
 * the depth jumps. The second difference of the depth buffer (which is
 * flat on any plane, however steeply seen) marks the near side of each
 * jump, so the line sits on the object and never on the ground behind it.
 * Lines thin out with distance and fade into the haze.
 */
const InkShader = {
  name: 'RotaInk',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
    uNear: { value: 0.1 },
    uFar: { value: 200 },
    uWidth: { value: 1.5 },
    uInk: { value: new THREE.Color('#2a2b22') },
    uFade: { value: new THREE.Vector2(20, 60) },
    uGlow: { value: 0 },
    uGlowQuality: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uTexel;
    uniform float uNear;
    uniform float uFar;
    uniform float uWidth;
    uniform vec3 uInk;
    uniform vec2 uFade;
    uniform float uGlow, uGlowQuality;
    varying vec2 vUv;
    float viewZ(float d) {
      return (uNear * uFar) / ((uFar - uNear) * d - uFar);
    }
    float raw(vec2 uv) { return texture2D(tDepth, uv).x; }
    // Only HDR warm lenses/interiors spill a little colour. Cream stone,
    // the chalk grid and red gameplay marks stay crisp. No blur buffers.
    vec3 lamp(vec2 uv) {
      vec3 c = texture2D(tDiffuse, uv).rgb;
      float warm = step(c.b * 1.28, c.r) * step(c.r * 0.35, c.g);
      return c * min(1.0, max(0.0, max(c.r, c.g) - 1.4)) * warm;
    }
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float d = raw(vUv);
      float z = -viewZ(d);
      vec2 o = uTexel * uWidth;
      // Depth is affine in screen space on a plane: its second difference
      // there is zero. Scale by the distance so the threshold is relative.
      float lx = raw(vUv + vec2(o.x, 0.0)) + raw(vUv - vec2(o.x, 0.0)) - 2.0 * d;
      float ly = raw(vUv + vec2(0.0, o.y)) + raw(vUv - vec2(0.0, o.y)) - 2.0 * d;
      // In depth-buffer units; convert to a relative view-space jump.
      float k = (uFar - uNear) * z * z / (uNear * uFar);
      float jx = lx * k / z, jy = ly * k / z;
      // Only the near side of a jump: its neighbours lie further away.
      float edge = max(smoothstep(0.0035, 0.01, jx), smoothstep(0.0035, 0.01, jy));
      float fade = 1.0 - smoothstep(uFade.x, uFade.y, z);
      if (d >= 1.0) edge = 0.0;
      vec3 col = mix(base.rgb, uInk, edge * fade * 0.88);
      if (uGlowQuality > 0.01 && uGlow > 0.001) {
        vec2 halo = uTexel * uWidth * 2.2;
        vec3 glow = lamp(vUv + vec2(halo.x, 0.0)) + lamp(vUv - vec2(halo.x, 0.0))
          + lamp(vUv + vec2(0.0, halo.y)) + lamp(vUv - vec2(0.0, halo.y));
        if (uGlowQuality > 0.75) {
          glow += (lamp(vUv + halo) + lamp(vUv - halo)
            + lamp(vUv + vec2(halo.x, -halo.y)) + lamp(vUv + vec2(-halo.x, halo.y))) * 0.5;
        }
        col += glow * (uGlow * 0.25);
      }
      gl_FragColor = vec4(col, base.a);
    }`,
};

export class InkPass extends ShaderPass {
  constructor() {
    super(InkShader);
  }
  setCamera(cam: THREE.PerspectiveCamera) {
    this.uniforms.uNear.value = cam.near;
    this.uniforms.uFar.value = cam.far;
  }
  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean,
  ) {
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}
