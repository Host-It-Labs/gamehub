import * as THREE from 'three';
import type { QualityTier } from '@/lib/games/rota/quality';

/** Warm gas-light on the flags, with a small camera-facing head halo.
 * Two shared instanced quad batches; no per-lamp real lights or frame work. */
export class LanternPools {
  readonly mesh: THREE.InstancedMesh;
  readonly heads: THREE.InstancedMesh;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.ShaderMaterial;
  private headGeometry: THREE.PlaneGeometry;
  private headMaterial: THREE.ShaderMaterial;

  constructor(
    lamps: readonly { x: number; y?: number; z: number }[],
    dusk: { value: number },
  ) {
    this.geometry = new THREE.PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2);
    const phase = new Float32Array(lamps.length);
    for (let i = 0; i < lamps.length; i++) phase[i] = (i * 0.618034) % 1;
    this.geometry.setAttribute(
      'aLampPhase',
      new THREE.InstancedBufferAttribute(phase, 1),
    );
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uDusk: dusk,
      },
      vertexShader: /* glsl */ `
        attribute float aLampPhase;
        varying vec2 vUv;
        varying float vPhase;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vPhase = aLampPhase;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uDusk;
        varying vec2 vUv;
        varying float vPhase;
        #include <fog_pars_fragment>
        void main() {
          float r = length((vUv - 0.5) * 2.0);
          float light = smoothstep(0.12 + vPhase * 0.08, 0.44 + vPhase * 0.08, uDusk);
          float pool = exp(-r * r * 3.4) * (1.0 - smoothstep(0.72, 1.0, r));
          gl_FragColor = vec4(vec3(1.0, 0.66, 0.32), pool * light * 0.42);
          #include <fog_fragment>
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: true,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      lamps.length,
    );
    const matrix = new THREE.Matrix4();
    this.headGeometry = new THREE.PlaneGeometry(0.052, 0.052);
    this.headGeometry.setAttribute(
      'aLampPhase',
      new THREE.InstancedBufferAttribute(phase, 1),
    );
    this.headMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uDusk: dusk,
      },
      vertexShader: /* glsl */ `
        attribute float aLampPhase;
        varying vec2 vUv;
        varying float vPhase;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vPhase = aLampPhase;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mvPosition.xy += position.xy;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uDusk;
        varying vec2 vUv;
        varying float vPhase;
        #include <fog_pars_fragment>
        void main() {
          float r = length((vUv - 0.5) * 2.0);
          float light = smoothstep(0.14 + vPhase * 0.08, 0.42 + vPhase * 0.08, uDusk);
          float glow = exp(-r * r * 4.8) * (1.0 - smoothstep(0.75, 1.0, r));
          gl_FragColor = vec4(vec3(2.6, 1.55, 0.60), glow * light * 0.17);
          #include <fog_fragment>
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: true,
      toneMapped: false,
    });
    this.heads = new THREE.InstancedMesh(
      this.headGeometry,
      this.headMaterial,
      lamps.length,
    );
    for (let i = 0; i < lamps.length; i++) {
      const p = lamps[i];
      matrix.makeTranslation(p.x, (p.y ?? 0) + 0.006, p.z);
      this.mesh.setMatrixAt(i, matrix);
      matrix.makeTranslation(p.x, (p.y ?? 0) + 0.12, p.z);
      this.heads.setMatrixAt(i, matrix);
    }
    this.mesh.renderOrder = 2;
    this.mesh.computeBoundingSphere();
    this.heads.renderOrder = 3;
    this.heads.frustumCulled = false;
    this.mesh.add(this.heads);
  }

  setQuality(tier: QualityTier) {
    this.heads.visible = tier !== 'low';
  }

  dispose() {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.heads.dispose();
    this.headGeometry.dispose();
    this.headMaterial.dispose();
    this.mesh.remove(this.heads);
  }
}
