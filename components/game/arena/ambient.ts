import * as THREE from 'three';
import { forestAt, groundHeight } from './terrain';
import type { Wind } from './wind';

/**
 * The valley's small life, all cheap and all outside the play: smoke curling
 * from the king's chimneys and drifting downwind, embers rising off the
 * torches as their flames flicker, butterflies over the meadows beyond the
 * walls, now and then a few birds crossing high over the valley, and leaves
 * let go by the trees at the woods' edge, tumbling down in the wind.
 * Under reduced motion only the smoke and the flames stay, calmer.
 */

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Puff = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
};

/** Soft round sprites sized in world metres. */
class Sprites {
  readonly points: THREE.Points;
  private list: Puff[] = [];
  private pos: Float32Array;
  private tint: Float32Array;
  private size: Float32Array;
  private geo = new THREE.BufferGeometry();
  readonly uniforms = { uViewH: { value: 800 } };

  constructor(
    private max: number,
    additive: boolean,
    fog: THREE.Fog | null,
  ) {
    this.pos = new Float32Array(max * 3);
    this.tint = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    const dyn = (a: THREE.BufferAttribute) =>
      a.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute(
      'position',
      dyn(new THREE.BufferAttribute(this.pos, 3)),
    );
    this.geo.setAttribute('tint', dyn(new THREE.BufferAttribute(this.tint, 4)));
    this.geo.setAttribute('size', dyn(new THREE.BufferAttribute(this.size, 1)));
    const material = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsLib.fog, ...this.uniforms },
      fog: !!fog,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec4 tint;
        uniform float uViewH;
        varying vec4 vTint;
        #include <fog_pars_vertex>
        void main() {
          vTint = tint;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uViewH * 0.5 * projectionMatrix[1][1] / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying vec4 vTint;
        #include <fog_pars_fragment>
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.12, length(d));
          if (a <= 0.003) discard;
          gl_FragColor = vec4(vTint.rgb, vTint.a * a);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.points = new THREE.Points(this.geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }

  add(p: Partial<Puff> & { x: number; y: number; z: number }) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      life: 1,
      size: 0.3,
      grow: 0,
      alpha: 1,
      r: 1,
      g: 1,
      b: 1,
      ...p,
    });
  }

  update(dt: number, push: (p: Puff, dt: number) => void) {
    let n = 0;
    const keep: Puff[] = [];
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      push(p, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      keep.push(p);
      const t = p.age / p.life;
      this.pos.set([p.x, p.y, p.z], n * 3);
      this.tint.set(
        [p.r, p.g, p.b, p.alpha * Math.min(1, t * 6) * (1 - t) ** 1.4],
        n * 4,
      );
      this.size[n] = p.size + p.grow * t;
      n++;
    }
    this.list = keep;
    this.geo.setDrawRange(0, n);
    for (const name of ['position', 'tint', 'size'])
      (this.geo.attributes[name] as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/** Flapping wings: butterflies and birds, one instanced mesh each. */
function wings(span: number, length: number, shape: 'butterfly' | 'bird') {
  // Each wing a fan from the body (x = 0) out to its tip; z runs along the
  // body, head forward (+z).
  const p: number[] = [];
  const outline =
    shape === 'butterfly'
      ? [
          [0, 0.45],
          [0.75, 0.75],
          [1, 0.2],
          [0.62, -0.15],
          [0.85, -0.6],
          [0.3, -0.7],
          [0, -0.4],
        ]
      : [
          [0, 0.3],
          [0.5, 0.18],
          [1, -0.25],
          [0.55, -0.1],
          [0, -0.45],
        ];
  for (const side of [-1, 1])
    for (let i = 1; i < outline.length - 1; i++)
      for (const k of [0, i, i + 1]) {
        const [x, z] = outline[k];
        p.push(side * x * span, 0, z * length);
      }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return geo;
}

function flapMaterial(fog: THREE.Fog | null, beat: number, lift: number) {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog, uTime: { value: 0 } },
    fog: !!fog,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vShade;
      varying vec3 vColour;
      #include <fog_pars_vertex>
      void main() {
        float phase = float(gl_InstanceID) * 2.399;
        float a = sin(uTime * ${beat.toFixed(1)} + phase) * ${lift.toFixed(2)} + 0.25;
        float r = abs(position.x);
        vec3 p = vec3(sign(position.x) * r * cos(a), r * sin(a), position.z);
        vShade = 0.72 + 0.4 * cos(a);
        vColour = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vColour = instanceColor;
        #endif
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying float vShade;
      varying vec3 vColour;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(vColour * vShade, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

type Flyer = { ax: number; az: number; phase: number; speed: number };

export class Ambient {
  private smoke: Sprites;
  private embers: Sprites;
  private butterflies?: THREE.InstancedMesh;
  private flyers: Flyer[] = [];
  private birds?: THREE.InstancedMesh;
  private flock = {
    at: -1,
    from: new THREE.Vector3(),
    dir: new THREE.Vector3(),
  };
  private leaves?: THREE.InstancedMesh;
  private falling: {
    p: THREE.Vector3;
    v: THREE.Vector3;
    spin: THREE.Vector3;
    r: THREE.Euler;
    age: number;
    landed: number;
  }[] = [];
  private owned: { dispose(): void }[] = [];
  private dummy = new THREE.Object3D();
  private time = 0;
  private puffTimers = new Map<THREE.Vector3, number>();
  /** Where smoke rises (king chimneys); set per match by the world. */
  chimneys: { at: THREE.Vector3; on: () => boolean }[] = [];
  /** Torch flames. */
  torches: THREE.Vector3[] = [];
  /** Tree crowns at the woods' edge that may drop a leaf. */
  crowns: THREE.Vector3[] = [];

  constructor(
    private scene: THREE.Scene,
    private wind: Wind,
    private reduced: boolean,
    noise: THREE.DataTexture,
    /** The flames' material, which flickers. */
    private flame?: THREE.MeshStandardMaterial,
  ) {
    const fog = scene.fog as THREE.Fog | null;
    this.smoke = new Sprites(160, false, fog);
    this.embers = new Sprites(160, true, fog);
    scene.add(this.smoke.points, this.embers.points);
    this.owned.push(this.smoke, this.embers);
    if (reduced) return;

    // Butterflies over the meadows beyond the walls, in pairs.
    const colours = ['#fff2a8', '#ffffff', '#ffb35c', '#a9d4ff', '#ffc4e0'];
    const spots: [number, number][] = [];
    for (let i = 0; i < 400 && spots.length < 14; i++) {
      const x = rand(-17, 17);
      const z = rand(-24, 24);
      const out = Math.max(Math.abs(x) - 10.4, Math.abs(z) - 17.8);
      if (out < 0.6 || out > 6.5) continue;
      if (Math.abs(z) < 3) continue;
      if (forestAt(noise, x, z) > 0.5) continue;
      spots.push([x, z]);
    }
    if (spots.length) {
      const mesh = new THREE.InstancedMesh(
        wings(0.075, 0.07, 'butterfly'),
        flapMaterial(fog, 24, 1.05),
        spots.length,
      );
      const c = new THREE.Color();
      spots.forEach(([x, z], i) => {
        this.flyers.push({
          ax: x,
          az: z,
          phase: rand(0, 100),
          speed: rand(0.7, 1.2),
        });
        mesh.setColorAt(i, c.set(colours[i % colours.length]));
      });
      mesh.frustumCulled = false;
      mesh.name = 'butterflies';
      scene.add(mesh);
      this.butterflies = mesh;
      this.owned.push(mesh.geometry, mesh.material as THREE.Material);
    }
    // A few birds now and then, high over the valley.
    const birds = new THREE.InstancedMesh(
      wings(0.42, 0.3, 'bird'),
      flapMaterial(fog, 7, 0.75),
      5,
    );
    const dark = new THREE.Color('#3b3f4a');
    for (let i = 0; i < 5; i++) birds.setColorAt(i, dark);
    birds.count = 0;
    birds.frustumCulled = false;
    birds.name = 'birds';
    scene.add(birds);
    this.birds = birds;
    this.owned.push(birds.geometry, birds.material as THREE.Material);
    // Leaves: a small cut leaf shape, lit like the scenery.
    const leaf = new THREE.ShapeGeometry(
      new THREE.Shape([
        new THREE.Vector2(0, -0.07),
        new THREE.Vector2(0.04, -0.01),
        new THREE.Vector2(0.025, 0.05),
        new THREE.Vector2(0, 0.075),
        new THREE.Vector2(-0.025, 0.05),
        new THREE.Vector2(-0.04, -0.01),
      ]),
    );
    const leaves = new THREE.InstancedMesh(
      leaf,
      new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
      36,
    );
    const greens = ['#9ccf6a', '#c9d65a', '#e3b54a', '#7fbf6e', '#d98d3e'];
    const tone = new THREE.Color();
    for (let i = 0; i < 36; i++)
      leaves.setColorAt(i, tone.set(greens[i % greens.length]));
    leaves.count = 0;
    leaves.frustumCulled = false;
    leaves.name = 'leaves';
    scene.add(leaves);
    this.leaves = leaves;
    this.owned.push(leaf, leaves.material as THREE.Material);
  }

  /** The drawing buffer's height, for sizing the sprites. */
  setViewHeight(h: number) {
    this.smoke.uniforms.uViewH.value = h;
    this.embers.uniforms.uViewH.value = h;
  }

  update(dt: number) {
    this.time += dt;
    const t = this.time;
    const dir = this.wind.uWindDir.value;
    const amp = this.wind.uWindAmp.value;
    // Chimney smoke: a puff every few tenths of a second, rising, slowing
    // and leaning downwind as it spreads.
    for (const c of this.chimneys) {
      if (!c.on()) continue;
      const next = (this.puffTimers.get(c.at) ?? 0) - dt;
      if (next > 0) {
        this.puffTimers.set(c.at, next);
        continue;
      }
      this.puffTimers.set(c.at, rand(0.22, 0.38) * (this.reduced ? 1.6 : 1));
      const grey = rand(0.82, 0.95);
      this.smoke.add({
        x: c.at.x + rand(-0.04, 0.04),
        y: c.at.y,
        z: c.at.z + rand(-0.04, 0.04),
        vy: rand(0.45, 0.7),
        life: rand(2.6, 3.4),
        size: 0.2,
        grow: 0.9,
        alpha: 0.55,
        r: grey,
        g: grey,
        b: grey * 1.02,
      });
    }
    // Torches: a flicker in the flame and embers rising off it.
    if (this.flame) {
      const f =
        0.55 * Math.sin(t * 13.1) +
        0.3 * Math.sin(t * 23.7 + 1.3) +
        0.15 * Math.sin(t * 41.3 + 0.4);
      this.flame.emissiveIntensity = 2.6 * (0.86 + 0.14 * f);
    }
    for (const at of this.torches) {
      if (Math.random() > dt * (this.reduced ? 1.2 : 3.2)) continue;
      this.embers.add({
        x: at.x + rand(-0.06, 0.06),
        y: at.y + 0.25,
        z: at.z + rand(-0.06, 0.06),
        vx: rand(-0.1, 0.1),
        vy: rand(0.5, 0.9),
        vz: rand(-0.1, 0.1),
        life: rand(0.7, 1.3),
        size: rand(0.035, 0.06),
        alpha: 0.95,
        r: 1,
        g: rand(0.55, 0.75),
        b: 0.2,
      });
    }
    const drift = (p: Puff, step: number) => {
      // Rising slows; the wind takes over.
      p.vy *= 1 - 0.35 * step;
      p.vx += (dir.x * 0.55 * amp - p.vx) * step * 0.6;
      p.vz += (dir.y * 0.55 * amp - p.vz) * step * 0.6;
    };
    this.smoke.update(dt, drift);
    this.embers.update(dt, (p, step) => {
      p.vx += Math.sin(t * 9 + p.y * 7) * 0.4 * step;
      p.vx += dir.x * 0.3 * step;
      p.vz += dir.y * 0.3 * step;
    });
    if (this.reduced) return;

    // Butterflies loop lazily round their meadow spot, bobbing.
    if (this.butterflies) {
      this.flyers.forEach((b, i) => {
        const k = t * 0.45 * b.speed + b.phase;
        const x = b.ax + Math.sin(k) * 1.6 + Math.sin(k * 2.3) * 0.4;
        const z = b.az + Math.cos(k * 0.8) * 1.3;
        const y =
          groundHeight(x, z) +
          0.45 +
          0.25 * Math.sin(k * 3.1) +
          0.08 * Math.sin(t * 9 + b.phase);
        const vx = Math.cos(k) * 1.6 + Math.cos(k * 2.3) * 0.92;
        const vz = -Math.sin(k * 0.8) * 1.04;
        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(0, Math.atan2(vx, vz), 0);
        this.dummy.updateMatrix();
        this.butterflies!.setMatrixAt(i, this.dummy.matrix);
      });
      this.butterflies.instanceMatrix.needsUpdate = true;
      (this.butterflies.material as THREE.ShaderMaterial).uniforms.uTime.value =
        t;
    }
    // Birds: every half minute or so a small flock crosses the valley.
    if (this.birds) {
      const birds = this.birds;
      (birds.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      if (this.flock.at < 0 && Math.random() < dt / 25) {
        const a = rand(0, Math.PI * 2);
        this.flock.dir.set(Math.cos(a), 0, Math.sin(a));
        this.flock.from
          .copy(this.flock.dir)
          .multiplyScalar(-60)
          .add(new THREE.Vector3(rand(-12, 12), rand(13, 17), rand(-10, 10)));
        this.flock.at = 0;
      }
      if (this.flock.at >= 0) {
        this.flock.at += dt;
        const run = this.flock.at * 7.5;
        if (run > 120) {
          this.flock.at = -1;
          birds.count = 0;
        } else {
          birds.count = 5;
          const d = this.flock.dir;
          const side = new THREE.Vector3(-d.z, 0, d.x);
          for (let i = 0; i < 5; i++) {
            const row = Math.ceil(i / 2);
            const s = i === 0 ? 0 : i % 2 ? -1 : 1;
            this.dummy.position
              .copy(this.flock.from)
              .addScaledVector(d, run - row * 1.6)
              .addScaledVector(side, s * row * 1.3);
            this.dummy.position.y += Math.sin(t * 0.8 + i) * 0.3;
            this.dummy.rotation.set(0, Math.atan2(d.x, d.z), 0);
            this.dummy.updateMatrix();
            birds.setMatrixAt(i, this.dummy.matrix);
          }
          birds.instanceMatrix.needsUpdate = true;
        }
      }
    }
    // Leaves let go at the woods' edge and tumble down in the wind.
    if (this.leaves && this.crowns.length) {
      const leaves = this.leaves;
      if (this.falling.length < 36 && Math.random() < dt * 1.6) {
        const c = this.crowns[Math.floor(Math.random() * this.crowns.length)];
        this.falling.push({
          p: c.clone().add(new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1))),
          v: new THREE.Vector3(0, -0.5, 0),
          spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-3, 3)),
          r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)),
          age: 0,
          landed: 0,
        });
      }
      let n = 0;
      this.falling = this.falling.filter((l) => {
        l.age += dt;
        const floor = groundHeight(l.p.x, l.p.z) + 0.02;
        if (l.p.y > floor) {
          // Flutter: swinging side to side as it sinks, carried downwind.
          const sw = Math.sin(l.age * 3.1 + l.spin.x);
          l.v.set(
            dir.x * 0.7 * amp + sw * 0.5,
            -0.42 - 0.15 * Math.abs(sw),
            dir.y * 0.7 * amp + Math.cos(l.age * 2.3) * 0.3,
          );
          l.p.addScaledVector(l.v, dt);
          l.r.x += l.spin.x * dt;
          l.r.y += l.spin.y * dt;
          l.r.z += l.spin.z * dt;
        } else {
          l.p.y = floor;
          l.r.x = -Math.PI / 2;
          l.landed += dt;
        }
        if (l.landed > 4 || l.age > 25) return false;
        const fade = l.landed > 3 ? 1 - (l.landed - 3) : 1;
        this.dummy.position.copy(l.p);
        this.dummy.rotation.copy(l.r);
        this.dummy.scale.setScalar(Math.max(0.01, fade));
        this.dummy.updateMatrix();
        leaves.setMatrixAt(n++, this.dummy.matrix);
        return true;
      });
      leaves.count = n;
      leaves.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const o of this.owned) o.dispose();
    this.scene.remove(this.smoke.points, this.embers.points);
    if (this.butterflies) this.scene.remove(this.butterflies);
    if (this.birds) this.scene.remove(this.birds);
    if (this.leaves) this.scene.remove(this.leaves);
  }
}
