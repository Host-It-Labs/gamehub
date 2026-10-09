import * as THREE from 'three';
import type { QualityTier } from '@/lib/games/rota/quality';
import type { Spec } from '@/lib/games/rota/traffic-sim';

/** An outward end in the model's own coordinates; every model faces -Z.
 * The simulation retains physical axle order when a consist reverses. */
export function trainLampEnd(
  index: number,
  count: number,
  pushed: boolean,
  flip: boolean,
): -1 | 0 | 1 {
  if (index !== 0 && index !== count - 1) return 0;
  const physical = (index === 0) !== pushed ? -1 : 1;
  return (flip ? -physical : physical) as -1 | 1;
}

/** Off in afternoon, fully switched on before dusk 0.5. */
export function vehicleLightFade(dusk: number) {
  if (!Number.isFinite(dusk)) return 0;
  const t = Math.max(0, Math.min(1, (dusk - 0.12) / 0.36));
  return t * t * (3 - 2 * t);
}

type LampSlot = { mesh: THREE.Mesh; index: number };
export type VehicleLampRig = {
  slots: LampSlot[];
  flip: boolean;
  material: THREE.Material | null;
};

/** Reuses the authored lens geometry; one batch paints all headlight pools.
 * Matrices/vectors and the four railway material variants are allocated once. */
export class VehicleLights {
  readonly pools: THREE.InstancedMesh;
  private light = { value: 0 };
  private quality = { value: 1 };
  private head: THREE.MeshBasicMaterial;
  private tail: THREE.MeshBasicMaterial;
  private rail: THREE.MeshBasicMaterial[];
  private geometry: THREE.PlaneGeometry;
  private poolMaterial: THREE.ShaderMaterial;
  private pose = new THREE.Object3D();
  private offset = new THREE.Vector3();
  private used = 0;

  constructor() {
    this.head = this.lens(false);
    this.tail = this.lens(true);
    this.rail = [
      this.lens(false, -1),
      this.lens(true, -1),
      this.lens(false, 1),
      this.lens(true, 1),
    ];
    this.geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.poolMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uLight: this.light,
        uQuality: this.quality,
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLight, uQuality;
        varying vec2 vUv;
        #include <fog_pars_fragment>
        void main() {
          float ahead = vUv.y;
          float spread = mix(0.17, 0.52, ahead);
          float beam;
          if (uQuality > 0.45) {
            float left = (vUv.x - 0.5 - 0.15 * (1.0 - ahead)) / spread;
            float right = (vUv.x - 0.5 + 0.15 * (1.0 - ahead)) / spread;
            beam = (exp(-left * left * 4.5) + exp(-right * right * 4.5)) * 0.64;
          } else {
            float side = (vUv.x - 0.5) / spread;
            beam = exp(-side * side * 3.0);
          }
          float reach = smoothstep(0.0, 0.12, ahead) * (1.0 - smoothstep(0.3, 1.0, ahead));
          gl_FragColor = vec4(vec3(1.0, 0.77, 0.36), beam * reach * uLight * 0.36);
          #include <fog_fragment>
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: true,
    });
    // The eight-square board's complete street networks carry fewer than this
    // even with simultaneous visitors on separate live components.
    this.pools = new THREE.InstancedMesh(this.geometry, this.poolMaterial, 256);
    this.pools.count = 0;
    this.pools.visible = false;
    this.pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Traffic can be on any road, including its bridges and exit lanes.
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 2;
    this.pools.name = 'vehicle-headlight-pools';
  }

  private lens(red: boolean, end?: -1 | 1) {
    const material = new THREE.MeshBasicMaterial({
      color: red ? '#ff4b32' : '#ffe4b0',
      toneMapped: false,
    });
    material.name = red ? 'glow:traffic-tail' : 'glow:traffic-head';
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uVehicleLight = this.light;
      if (end !== undefined)
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying float vVehicleZ;\nvoid main() {')
          .replace(
            '#include <project_vertex>',
            '#include <project_vertex>\n vVehicleZ = transformed.z;',
          );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `uniform float uVehicleLight;\n${end !== undefined ? 'varying float vVehicleZ;' : ''}\nvoid main() {`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          diffuseColor.rgb *= mix(0.22, ${red ? '2.4' : '3.4'}, uVehicleLight);
          ${
            end !== undefined
              ? `// Coupling-side lenses do not illuminate the wagons.
          diffuseColor.rgb = mix(vec3(0.055, 0.05, 0.045), diffuseColor.rgb, step(0.0, vVehicleZ * ${end.toFixed(1)}));`
              : ''
          }`,
        );
    };
    material.customProgramCacheKey = () =>
      `rota-vehicle-lens-v1|${red}|${end ?? 'road'}`;
    return material;
  }

  attach(object: THREE.Object3D, car: Spec, rail: boolean) {
    const slots: LampSlot[] = [];
    const engine = rail && car.model.startsWith('loco_');
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (let i = 0; i < materials.length; i++) {
        const name = materials[i].name;
        if (name !== 'glow:lamp' && name !== 'glow:tail') continue;
        if (engine) slots.push({ mesh, index: i });
        else if (!rail) {
          const material = name === 'glow:tail' ? this.tail : this.head;
          if (Array.isArray(mesh.material)) mesh.material[i] = material;
          else mesh.material = material;
        }
        mesh.castShadow = false;
      }
    });
    return engine ? { slots, flip: !!car.flip, material: null } : null;
  }

  train(
    rig: VehicleLampRig | null,
    index: number,
    count: number,
    pushed: boolean,
  ) {
    if (!rig) return;
    const end = trainLampEnd(index, count, pushed, rig.flip);
    if (!end) return;
    const material = this.rail[(end === 1 ? 2 : 0) + (index === 0 ? 0 : 1)];
    if (material === rig.material) return;
    rig.material = material;
    for (const slot of rig.slots) {
      if (Array.isArray(slot.mesh.material))
        slot.mesh.material[slot.index] = material;
      else slot.mesh.material = material;
    }
  }

  setDusk(dusk: number) {
    this.light.value = vehicleLightFade(dusk);
    this.pools.visible = this.light.value > 0;
  }

  setQuality(tier: QualityTier) {
    this.quality.value = tier === 'high' ? 1 : tier === 'balanced' ? 0.65 : 0.3;
  }

  begin() {
    this.used = 0;
  }

  road(object: THREE.Object3D, car: Spec) {
    if (!this.pools.visible || this.used >= 256) return;
    const length = Math.min(0.36, 0.23 + car.length * 0.35);
    // A very slight lift avoids z-fighting. The same pitch follows the local
    // bridge approach. Pop/dying scale keeps the pool beside its own bumper.
    this.offset
      .set(0, 0.0025, -(car.length / 2 + length * 0.43) * object.scale.z)
      .applyQuaternion(object.quaternion);
    this.pose.position.copy(object.position).add(this.offset);
    this.pose.quaternion.copy(object.quaternion);
    this.pose.scale.set(
      Math.min(0.12, car.width * 1.55) * object.scale.x,
      1,
      length * object.scale.z,
    );
    this.pose.updateMatrix();
    this.pools.setMatrixAt(this.used++, this.pose.matrix);
  }

  end() {
    this.pools.count = this.used;
    if (this.used) this.pools.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.used = this.pools.count = 0;
  }

  dispose() {
    this.pools.dispose();
    this.geometry.dispose();
    this.poolMaterial.dispose();
    this.head.dispose();
    this.tail.dispose();
    for (const material of this.rail) material.dispose();
  }
}
