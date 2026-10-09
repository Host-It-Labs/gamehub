import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  crossingClearance,
  NEIGHBOURHOOD_FOOT_Y,
  RAIL_WALK_RAMP,
  ROAD_WALK_RAMP,
  type NeighbourhoodPlan,
  type TrafficBody,
} from '@/lib/games/rota/neighbourhood';
import type { QualityTier } from '@/lib/games/rota/quality';
import {
  CARRIAGE_HALF,
  GAUGE,
  PAVEMENT_TOP,
  RAIL_TOP,
  STREET_HALF,
} from '@/lib/games/rota/scale';
import { Materials, toon } from './materials';

export type { TrafficBody } from '@/lib/games/rota/neighbourhood';

type Lens = { crossing: number; amber: boolean; phase: number };
type Arm = { crossing: number; frame: THREE.Matrix4 };

/** Proper 1950s fittings at true scale: cream zebras and striped Belisha
 * poles; timber rail decks, white/red lifting gates, iron posts and paired
 * hooded red signals. Static fittings merge by material, all lenses and
 * gate arms instance. No point lights or traffic simulation mutations. */
export class Crossings {
  readonly group = new THREE.Group();
  readonly states: { blocked: boolean; clearance: number }[];
  private readonly raw: Float64Array;
  private readonly wanted: Uint8Array;
  private readonly release: Float32Array;
  private readonly open: Float32Array;
  private readonly lenses: Lens[] = [];
  private readonly arms: Arm[] = [];
  private readonly lensMesh: THREE.InstancedMesh;
  private readonly halo: THREE.InstancedMesh;
  private readonly whiteArms: THREE.InstancedMesh;
  private readonly redArms: THREE.InstancedMesh;
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly hinge = new THREE.Matrix4();
  private readonly colour = new THREE.Color();
  private readonly surfaceMaterials: Materials;
  private readonly ownSurfaceMaterials: boolean;

  constructor(
    private readonly plan: NeighbourhoodPlan,
    private readonly still: boolean,
    materials?: Materials,
  ) {
    this.surfaceMaterials = materials ?? new Materials();
    this.ownSurfaceMaterials = !materials;
    this.group.name = 'rota-neighbourhood-crossings';
    const count = plan.crossings.length;
    this.states = plan.crossings.map(() => ({
      blocked: false,
      clearance: Infinity,
    }));
    this.raw = new Float64Array(count).fill(Infinity);
    this.wanted = new Uint8Array(count);
    this.release = new Float32Array(count);
    this.open = new Float32Array(count).fill(1);
    const parts = new Map<string, THREE.BufferGeometry[]>();
    const frame = new THREE.Matrix4(),
      local = new THREE.Matrix4(),
      transform = new THREE.Matrix4();
    const q = new THREE.Quaternion(),
      p = new THREE.Vector3(),
      scale = new THREE.Vector3(1, 1, 1);
    const axis = new THREE.Vector3(0, 1, 0);
    const lensMatrices: THREE.Matrix4[] = [];
    const add = (
      family: string,
      geometry: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0,
      shade = 1,
    ) => {
      q.setFromEuler(new THREE.Euler(rx, ry, rz));
      local.compose(p.set(x, y, z), q, scale);
      transform.multiplyMatrices(frame, local);
      geometry.applyMatrix4(transform);
      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          new Float32Array(geometry.getAttribute('position').count * 3).fill(
            shade,
          ),
          3,
        ),
      );
      const bucket = parts.get(family);
      if (bucket) bucket.push(geometry);
      else parts.set(family, [geometry]);
    };
    const box = (
      family: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      rz = 0,
      shade = 1,
    ) => add(family, new THREE.BoxGeometry(w, h, d), x, y, z, 0, 0, rz, shade);
    const lens = (
      crossing: number,
      amber: boolean,
      phase: number,
      x: number,
      y: number,
      z: number,
      radius: number,
    ) => {
      local.makeScale(radius, radius, radius);
      local.setPosition(x, y, z);
      lensMatrices.push(new THREE.Matrix4().multiplyMatrices(frame, local));
      this.lenses.push({ crossing, amber, phase });
    };

    plan.crossings.forEach((site, index) => {
      q.setFromAxisAngle(axis, site.axis === 'x' ? 0 : -Math.PI / 2);
      frame.compose(p.set(site.x, site.y, site.z), q, scale);
      if (site.kind === 'road') {
        // Paint stops at the carriageway's kerbs. It is a zebra, rather than
        // paving drawn over the entire street or a white railway sleeper.
        for (let u = -CARRIAGE_HALF + 0.015; u < CARRIAGE_HALF; u += 0.042)
          box('cream', u, -0.00045, 0, 0.022, 0.0009, site.width);
        const rise = PAVEMENT_TOP + 0.001 - NEIGHBOURHOOD_FOOT_Y;
        for (const sign of [-1, 1])
          box(
            'cream',
            sign * (STREET_HALF + ROAD_WALK_RAMP / 2),
            PAVEMENT_TOP - 0.012 - rise / 2 - 0.001,
            0,
            Math.hypot(ROAD_WALK_RAMP, rise),
            0.003,
            site.width + 0.008,
            -sign * Math.atan2(rise, ROAD_WALK_RAMP),
          );
        for (const sign of [-1, 1]) {
          const u = sign * (CARRIAGE_HALF + 0.045),
            v = -sign * (site.width / 2 + 0.024);
          const base = 0.009;
          add(
            'iron',
            new THREE.CylinderGeometry(0.007, 0.009, 0.005, 8),
            u,
            base,
            v,
          );
          add(
            'iron',
            new THREE.CylinderGeometry(0.0026, 0.0033, 0.126, 7),
            u,
            base + 0.065,
            v,
          );
          for (let h = 0.021; h < 0.13; h += 0.03)
            add(
              'white',
              new THREE.CylinderGeometry(0.0032, 0.0034, 0.014, 7),
              u,
              base + h,
              v,
            );
          add(
            'iron',
            new THREE.CylinderGeometry(0.0061, 0.005, 0.003, 8),
            u,
            base + 0.13,
            v,
          );
          lens(index, true, 0, u, base + 0.14, v, 0.0095);
        }
      } else {
        // Recesses preserve both rail heads and their flange gaps. The deck
        // meets rail top; little approach ramps meet the lower flags.
        for (const [lo, hi] of [
          [-site.halfWidth, -GAUGE / 2 - 0.004],
          [-GAUGE / 2 + 0.004, GAUGE / 2 - 0.004],
          [GAUGE / 2 + 0.004, site.halfWidth],
        ]) {
          const planks = Math.ceil((hi - lo) / 0.015);
          const step = (hi - lo) / planks;
          for (let j = 0; j < planks; j++)
            box(
              'timber',
              lo + (j + 0.5) * step,
              -0.0041,
              0,
              step - 0.001,
              0.007,
              site.width + 0.008,
              0,
              j % 2 ? 0.91 : 1,
            );
          for (let j = 0; j < planks; j++) {
            const u = lo + (j + 0.5) * step;
            // Dark timber ends and small bolt heads articulate the deck in
            // both cameras without a broad flat slab over the rail heads.
            for (const sign of [-1, 1]) {
              box(
                'timber',
                u,
                -0.004,
                sign * (site.width / 2 + 0.0035),
                step - 0.001,
                0.007,
                0.0015,
                0,
                0.72,
              );
              if (j % 2 === 0)
                add(
                  'iron',
                  new THREE.CylinderGeometry(0.0012, 0.0012, 0.0006, 6),
                  u,
                  -0.0005,
                  sign * (site.width / 2 - 0.008),
                );
            }
          }
          const stones = Math.ceil((hi - lo) / 0.025),
            stoneStep = (hi - lo) / stones;
          for (let j = 0; j < stones; j++)
            for (const sign of [-1, 1])
              box(
                'setts',
                lo + (j + 0.5) * stoneStep,
                -0.004,
                sign * (site.width / 2 + 0.011),
                stoneStep - 0.001,
                0.006,
                0.012,
                0,
                j % 2 ? 0.94 : 1,
              );
        }
        const rise = RAIL_TOP + 0.001 - NEIGHBOURHOOD_FOOT_Y,
          run = RAIL_WALK_RAMP;
        for (const sign of [-1, 1]) {
          box(
            'timber',
            sign * (site.halfWidth + run / 2),
            -rise / 2 - 0.003,
            0,
            Math.hypot(run, rise),
            0.004,
            site.width + 0.008,
            -sign * Math.atan2(rise, run),
          );
          const u = sign * (site.halfWidth - 0.006),
            v = -sign * (site.width / 2 + 0.015);
          box('stone', u, -RAIL_TOP + 0.0015, v, 0.018, 0.005, 0.021);
          box('iron', u, 0.005, v, 0.01, 0.088, 0.011);
          add(
            'iron',
            new THREE.CylinderGeometry(0.007, 0.007, 0.013, 8),
            u,
            0.031,
            v,
            0,
            0,
            Math.PI / 2,
          );
          local.makeRotationY(sign < 0 ? Math.PI : 0);
          local.setPosition(u, 0.032, v);
          this.arms.push({
            crossing: index,
            frame: new THREE.Matrix4().multiplyMatrices(frame, local),
          });

          const headU = sign * (site.halfWidth + 0.019),
            headV = sign * (site.width / 2 + 0.033);
          box('stone', headU, -RAIL_TOP + 0.0015, headV, 0.019, 0.005, 0.019);
          box('iron', headU, 0.018, headV, 0.005, 0.114, 0.005);
          box('iron', headU, 0.076, headV, 0.008, 0.022, 0.036);
          for (const pair of [-1, 1]) {
            const lv = headV + pair * 0.009;
            // Cast-iron eyebrows and cheek pieces leave the lens exposed on
            // the pedestrian side, visible from the steep phone camera too.
            box('iron', headU + sign * 0.005, 0.085, lv, 0.012, 0.003, 0.014);
            for (const cheek of [-1, 1])
              box(
                'iron',
                headU + sign * 0.004,
                0.077,
                lv + cheek * 0.006,
                0.01,
                0.013,
                0.002,
              );
            lens(
              index,
              false,
              pair < 0 ? 0 : 1,
              headU + sign * 0.0055,
              0.077,
              lv,
              0.0047,
            );
          }
        }
      }
    });

    const palette: Record<string, string> = {
      iron: '#252b2d',
      white: '#e8e1ce',
      cream: '#eee4ca',
      timber: '#958067',
      stone: '#afa28b',
      setts: '#93918a',
    };
    for (const [family, list] of parts) {
      const geometry = mergeGeometries(list)!;
      for (const part of list) part.dispose();
      this.geometries.push(geometry);
      const material = this.surfaceMaterials.tiled(
        family === 'timber'
          ? 'wood'
          : family === 'setts'
            ? 'cobble'
            : family === 'iron'
              ? 'metal'
              : family,
        palette[family],
        { vertexColors: true },
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `rota-crossing-${family}`;
      mesh.castShadow = family !== 'cream';
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    const white = toon('#e8e1ce'),
      red = toon('#a64132');
    this.materials.push(white, red);
    const armLength = 0.102;
    const gateParts: THREE.BufferGeometry[] = [
      new THREE.BoxGeometry(0.008, 0.008, armLength).translate(
        0,
        0,
        armLength / 2,
      ),
      new THREE.BoxGeometry(0.005, 0.004, armLength - 0.004).translate(
        0,
        0.022,
        armLength / 2,
      ),
    ];
    for (let z = 0.004; z < armLength; z += 0.0235)
      gateParts.push(
        new THREE.BoxGeometry(0.005, 0.022, 0.0035).translate(0, 0.011, z),
      );
    // The round stop target is a period detail, separate from the warning
    // lenses. It is mounted in the little white frame, visible on either side.
    gateParts.push(
      new THREE.CylinderGeometry(0.0095, 0.0095, 0.0075, 14)
        .rotateZ(Math.PI / 2)
        .translate(0, 0.012, 0.061),
    );
    const whiteGeometry = mergeGeometries(gateParts)!;
    for (const geometry of gateParts) geometry.dispose();
    const stripes: THREE.BufferGeometry[] = [];
    for (let z = 0.015; z < armLength; z += 0.031)
      stripes.push(
        new THREE.BoxGeometry(0.0083, 0.0083, 0.014).translate(0, 0, z),
      );
    stripes.push(
      new THREE.CylinderGeometry(0.0075, 0.0075, 0.0082, 14)
        .rotateZ(Math.PI / 2)
        .translate(0, 0.012, 0.061),
    );
    const redGeometry = mergeGeometries(stripes)!;
    for (const geometry of stripes) geometry.dispose();
    this.geometries.push(whiteGeometry, redGeometry);
    this.whiteArms = new THREE.InstancedMesh(
      whiteGeometry,
      white,
      this.arms.length,
    );
    this.redArms = new THREE.InstancedMesh(redGeometry, red, this.arms.length);
    this.whiteArms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.redArms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.whiteArms.frustumCulled = this.redArms.frustumCulled = false;
    this.whiteArms.castShadow = true;
    this.whiteArms.name = 'rota-level-crossing-gates';
    this.group.add(this.whiteArms, this.redArms);

    const lensGeometry = new THREE.SphereGeometry(1, 10, 7);
    this.geometries.push(lensGeometry);
    const signal = toon('#ffffff', { emissive: '#ffffff', glow: 1 });
    // Three's per-instance colour normally affects only diffuse. Multiply
    // emissive as well, so each individual lens can be dark, red or amber.
    signal.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)\n  totalEmissiveRadiance *= vColor.rgb;\n#endif',
      );
    };
    signal.customProgramCacheKey = () => 'rota-crossing-instance-emissive-v2';
    this.materials.push(signal);
    this.lensMesh = new THREE.InstancedMesh(
      lensGeometry,
      signal,
      this.lenses.length,
    );
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.materials.push(haloMaterial);
    this.halo = new THREE.InstancedMesh(
      lensGeometry,
      haloMaterial,
      this.lenses.length,
    );
    lensMatrices.forEach((matrix, index) => {
      this.lensMesh.setMatrixAt(index, matrix);
      this.matrix.copy(matrix).scale(scale.set(1.8, 1.8, 1.8));
      this.halo.setMatrixAt(index, this.matrix);
    });
    this.lensMesh.frustumCulled = this.halo.frustumCulled = false;
    this.lensMesh.name = 'rota-crossing-lenses';
    this.halo.renderOrder = 2;
    this.group.add(this.lensMesh, this.halo);
    this.tick(0, 0, 0);
    this.lensMesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    this.halo.instanceColor?.setUsage(THREE.DynamicDrawUsage);
  }

  /** Called at the world's bounded sensor cadence (8–10 Hz). */
  sense(bodies: readonly TrafficBody[], count: number) {
    for (let i = 0; i < this.states.length; i++) {
      const site = this.plan.crossings[i];
      const clearance = crossingClearance(site, bodies, count);
      this.raw[i] = clearance;
      const unsafe = clearance <= (site.kind === 'rail' ? 12 : 1);
      this.wanted[i] = unsafe ? 1 : 0;
      if (unsafe) {
        this.release[i] = site.kind === 'rail' ? 1.4 : 0.65;
        this.states[i].blocked = true;
        this.states[i].clearance = 0;
      }
    }
  }

  /** Allocation-free: scalar safety/dwell updates, a few shared hinge
   * matrices, and an RGB write per instanced lens. */
  tick(dt: number, now: number, dusk: number, occupancy?: Uint8Array) {
    for (let i = 0; i < this.states.length; i++) {
      if (!this.wanted[i]) this.release[i] = Math.max(0, this.release[i] - dt);
      const blocked = !!this.wanted[i] || this.release[i] > 0;
      // Warn immediately, but an admitted walker (including its pram) must
      // leave the entire walkway before an arm can come down through it.
      const target = blocked && !occupancy?.[i] ? 0 : 1;
      this.open[i] = this.still
        ? target
        : Math.max(
            0,
            Math.min(
              1,
              this.open[i] + (target ? 1 : -1) * Math.min(dt, 0.12) * 1.25,
            ),
          );
      const gated =
        this.plan.crossings[i].kind === 'rail' && this.open[i] < 0.97;
      this.states[i].blocked = blocked || gated;
      this.states[i].clearance = this.states[i].blocked ? 0 : this.raw[i];
    }
    for (let i = 0; i < this.arms.length; i++) {
      const arm = this.arms[i];
      const opening = this.open[arm.crossing];
      // Ease the lifting arm; its hinge remains at a fixed iron post.
      const angle = opening * opening * (3 - 2 * opening) * -Math.PI * 0.47;
      this.hinge.makeRotationX(angle);
      this.matrix.multiplyMatrices(arm.frame, this.hinge);
      this.whiteArms.setMatrixAt(i, this.matrix);
      this.redArms.setMatrixAt(i, this.matrix);
    }
    this.whiteArms.instanceMatrix.needsUpdate =
      this.redArms.instanceMatrix.needsUpdate = true;
    const strength = 1.9 + dusk * 1.1;
    for (let i = 0; i < this.lenses.length; i++) {
      const lens = this.lenses[i];
      const on = lens.amber
        ? this.still || Math.floor(now / 0.55) % 2 === 0
        : this.states[lens.crossing].blocked &&
          (this.still || Math.floor(now / 0.43) % 2 === lens.phase);
      const light = on ? strength : lens.amber ? 0.13 : 0.028;
      if (lens.amber) this.colour.setRGB(light, light * 0.37, light * 0.026);
      else this.colour.setRGB(light, light * 0.022, light * 0.015);
      this.lensMesh.setColorAt(i, this.colour);
      this.halo.setColorAt(i, this.colour);
    }
    if (this.lensMesh.instanceColor)
      this.lensMesh.instanceColor.needsUpdate = true;
    if (this.halo.instanceColor) this.halo.instanceColor.needsUpdate = true;
  }

  setQuality(tier: QualityTier) {
    if (this.ownSurfaceMaterials)
      this.surfaceMaterials.detail.value = {
        high: 1,
        balanced: 0.65,
        low: 0.3,
      }[tier];
    this.halo.visible = tier !== 'low';
    (this.halo.material as THREE.MeshBasicMaterial).opacity =
      tier === 'high' ? 0.075 : 0.045;
    // Crossing semantics/engineering silhouettes stay the same at low tier.
    this.whiteArms.castShadow = tier !== 'low';
  }

  dispose() {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    if (this.ownSurfaceMaterials) this.surfaceMaterials.dispose();
    this.whiteArms.dispose();
    this.redArms.dispose();
    this.lensMesh.dispose();
    this.halo.dispose();
    this.group.clear();
  }
}
