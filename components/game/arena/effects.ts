import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  isSpell,
  spellCards,
  troopCards,
  type CardId,
  type ProjectileKind,
} from '@/lib/games/arena/cards';
import {
  LENGTH,
  TICK,
  WIDTH,
  canDeployAt,
  type Match,
  type Projectile,
  type Side,
  type Spell,
} from '@/lib/games/arena/engine';
import { figureDimensions, toWorld } from '@/lib/games/arena/layout';
import { teamColours, type Team } from './materials';
import { FLY_HEIGHT, TROOP_SCALE, figureSize } from './troops';
import { standHeight, type ArenaWorld } from './world';
import { TroopStatuses } from './status';
import { projectileAhead, projectileOrigin } from './projectile-motion';

// ---------------------------------------------------------------- particles

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  age: number;
  size: number;
  grow: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  gravity: number;
  drag: number;
};

const spriteVertex = `
  attribute float size;
  attribute vec4 tint;
  varying vec4 vTint;
  void main() {
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (900.0 / -mv.z) * uScale;
    gl_Position = projectionMatrix * mv;
  }`;
const spriteFragment = `
  varying vec4 vTint;
  uniform float uSoft;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = smoothstep(1.0, uSoft, r);
    if (a <= 0.001) discard;
    gl_FragColor = vec4(vTint.rgb, vTint.a * a);
  }`;

class ParticleLayer {
  readonly points: THREE.Points;
  private list: Particle[] = [];
  private positions: Float32Array;
  private tints: Float32Array;
  private sizes: Float32Array;
  private geometry = new THREE.BufferGeometry();
  readonly uniforms = { uScale: { value: 1 }, uSoft: { value: 0.2 } };

  constructor(
    private max: number,
    additive: boolean,
    soft: number,
  ) {
    this.positions = new Float32Array(max * 3);
    this.tints = new Float32Array(max * 4);
    this.sizes = new Float32Array(max);
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      'tint',
      new THREE.BufferAttribute(this.tints, 4).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      'size',
      new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.uniforms.uSoft.value = soft;
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `uniform float uScale;\n${spriteVertex}`,
      fragmentShader: spriteFragment,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }

  add(p: Partial<Particle> & { x: number; y: number; z: number }) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      vx: 0,
      vy: 0,
      vz: 0,
      life: 1,
      age: 0,
      size: 0.4,
      grow: 0,
      r: 1,
      g: 1,
      b: 1,
      alpha: 1,
      gravity: 0,
      drag: 0,
      ...p,
    });
  }

  update(dt: number) {
    const keep: Particle[] = [];
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vz *= damp;
      p.vy = p.vy * damp - p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.gravity && p.y < 0.02) {
        p.y = 0.02;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      keep.push(p);
    }
    this.list = keep;
    const n = keep.length;
    for (let i = 0; i < n; i++) {
      const p = keep[i];
      const t = p.age / p.life;
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.tints[i * 4] = p.r;
      this.tints[i * 4 + 1] = p.g;
      this.tints[i * 4 + 2] = p.b;
      // Fade in quickly, out slowly.
      this.tints[i * 4 + 3] =
        p.alpha * Math.min(1, t * 8) * (1 - t) * (1 - t * 0.3);
      this.sizes[i] = p.size + p.grow * t;
    }
    this.geometry.setDrawRange(0, n);
    for (const name of ['position', 'tint', 'size'])
      (this.geometry.attributes[name] as THREE.BufferAttribute).needsUpdate =
        true;
  }

  dispose() {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Bolt = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  age: number;
  life: number;
  /** When it next re-forks, so it flickers while it lasts. */
  next: number;
  strands: THREE.Vector3[][];
};

const LIGHTNING_QUADS = 1800;
const tmpDir = new THREE.Vector3();
const tmpSide = new THREE.Vector3();
const tmpEye = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Lightning drawn as glowing ribbons facing the camera: a jagged main
 *  strand and a fork, each a wide blue glow round a thin white-hot core,
 *  re-forked every few frames so it crackles, gone in about a fifth of a
 *  second. */
class Lightning {
  readonly mesh: THREE.Mesh;
  private bolts: Bolt[] = [];
  private geometry = new THREE.BufferGeometry();
  private positions = new Float32Array(LIGHTNING_QUADS * 4 * 3);
  private tints = new Float32Array(LIGHTNING_QUADS * 4 * 4);
  private sides = new Float32Array(LIGHTNING_QUADS * 4);

  constructor(private camera: THREE.Camera) {
    const index = new Uint16Array(LIGHTNING_QUADS * 6);
    for (let q = 0; q < LIGHTNING_QUADS; q++) {
      index.set(
        [q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3],
        q * 6,
      );
    }
    this.geometry.setIndex(new THREE.BufferAttribute(index, 1));
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      'tint',
      new THREE.BufferAttribute(this.tints, 4).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      'side',
      new THREE.BufferAttribute(this.sides, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec4 tint;
        attribute float side;
        varying vec4 vTint;
        varying float vSide;
        void main() {
          vTint = tint;
          vSide = side;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec4 vTint;
        varying float vSide;
        void main() {
          float edge = 1.0 - abs(vSide);
          gl_FragColor = vec4(vTint.rgb, vTint.a * sqrt(edge));
        }`,
      transparent: true,
      depthWrite: false,
      // Ordinary blending, not additive: on the bright field additive light
      // washes out to a pale haze.
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  add(a: THREE.Vector3, b: THREE.Vector3) {
    if (this.bolts.length >= 24) this.bolts.shift();
    const bolt: Bolt = {
      a: a.clone(),
      b: b.clone(),
      age: 0,
      life: 0.22,
      next: 0,
      strands: [],
    };
    this.fork(bolt);
    this.bolts.push(bolt);
  }

  /** A fresh jagged path from a to b, and a fork off it. */
  private fork(bolt: Bolt) {
    const { a, b } = bolt;
    tmpDir.subVectors(b, a);
    const length = tmpDir.length();
    if (length < 1e-4) {
      bolt.strands = [];
      return;
    }
    tmpDir.divideScalar(length);
    tmpUp.set(0, 1, 0);
    if (Math.abs(tmpDir.y) > 0.9) tmpUp.set(1, 0, 0);
    tmpSide.crossVectors(tmpDir, tmpUp).normalize();
    tmpAxis.crossVectors(tmpSide, tmpDir).normalize();
    const path = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      amplitude: number,
      pinned: boolean,
    ) => {
      const span = from.distanceTo(to);
      const steps = Math.max(5, Math.min(22, Math.round(span * 5)));
      const out: THREE.Vector3[] = [];
      let u = 0;
      let w = 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        u = (u + rand(-1, 1) * amplitude) * 0.72;
        w = (w + rand(-1, 1) * amplitude) * 0.72;
        const pin = pinned ? Math.sin(t * Math.PI) : Math.min(1, t * 3);
        out.push(
          from
            .clone()
            .lerp(to, t)
            .addScaledVector(tmpSide, u * pin * 1.6)
            .addScaledVector(tmpAxis, w * pin * 1.6),
        );
      }
      return out;
    };
    const amplitude = Math.min(0.32, 0.08 + length * 0.04);
    const main = path(a, b, amplitude, true);
    const at = main[Math.floor(main.length * rand(0.3, 0.6))];
    const end = at
      .clone()
      .addScaledVector(tmpDir, length * rand(0.2, 0.35))
      .addScaledVector(tmpSide, length * rand(-0.25, 0.25))
      .addScaledVector(tmpAxis, length * rand(-0.15, 0.1));
    bolt.strands = [main, path(at, end, amplitude * 0.8, false)];
  }

  update(dt: number) {
    this.bolts = this.bolts.filter((bolt) => {
      bolt.age += dt;
      if (bolt.age >= bolt.life) return false;
      if (bolt.age >= bolt.next) {
        bolt.next = bolt.age + 0.045;
        this.fork(bolt);
      }
      return true;
    });
    const eye = this.camera.position;
    let q = 0;
    const quad = (
      p0: THREE.Vector3,
      p1: THREE.Vector3,
      width: number,
      r: number,
      g: number,
      b: number,
      alpha: number,
    ) => {
      if (q >= LIGHTNING_QUADS) return;
      tmpDir.subVectors(p1, p0);
      tmpEye.addVectors(p0, p1).multiplyScalar(0.5).sub(eye).negate();
      tmpSide.crossVectors(tmpDir, tmpEye);
      const n = tmpSide.length();
      if (n < 1e-6) return;
      tmpSide.multiplyScalar(width / n);
      // Run a little past each end so neighbouring segments overlap.
      const corners = [
        [p0, -1],
        [p0, 1],
        [p1, 1],
        [p1, -1],
      ] as const;
      corners.forEach(([p, side], k) => {
        const v = q * 4 + k;
        this.positions[v * 3] = p.x + tmpSide.x * side;
        this.positions[v * 3 + 1] = p.y + tmpSide.y * side;
        this.positions[v * 3 + 2] = p.z + tmpSide.z * side;
        this.tints.set([r, g, b, alpha], v * 4);
        this.sides[v] = side;
      });
      q++;
    };
    for (const bolt of this.bolts) {
      const t = bolt.age / bolt.life;
      // Full strength at once, then a flickering fade.
      const fade = (1 - t) * (1 - t) * (0.75 + Math.random() * 0.25);
      bolt.strands.forEach((strand, s) => {
        const thin = s === 0 ? 1 : 0.6;
        for (let i = 0; i < strand.length - 1; i++) {
          quad(strand[i], strand[i + 1], 0.3 * thin, 0.2, 0.5, 1, fade * 0.85);
          quad(strand[i], strand[i + 1], 0.09 * thin, 0.94, 0.98, 1, fade);
        }
      });
    }
    this.geometry.setDrawRange(0, q * 6);
    for (const name of ['position', 'tint', 'side'])
      (this.geometry.attributes[name] as THREE.BufferAttribute).needsUpdate =
        true;
  }

  dispose() {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export class Particles {
  readonly glow: ParticleLayer;
  readonly smoke: ParticleLayer;
  private lightning: Lightning;
  private debris: THREE.InstancedMesh;
  private chunks: {
    p: THREE.Vector3;
    v: THREE.Vector3;
    r: THREE.Euler;
    w: THREE.Vector3;
    s: number;
    age: number;
    c: string;
  }[] = [];
  private dummy = new THREE.Object3D();

  constructor(world: ArenaWorld) {
    this.glow = new ParticleLayer(900, true, 0.0);
    this.smoke = new ParticleLayer(1400, false, 0.35);
    world.scene.add(this.glow.points, this.smoke.points);
    this.lightning = new Lightning(world.camera);
    world.scene.add(this.lightning.mesh);
    // A fallen tower throws out chunks of its stone, each a little
    // different in tone.
    const geo = new THREE.DodecahedronGeometry(0.16, 0);
    this.blockMaterial = world.materials.get(
      'stone:warm',
      0,
    ) as THREE.MeshStandardMaterial;
    this.debris = new THREE.InstancedMesh(geo, this.blockMaterial, 160);
    this.debris.castShadow = true;
    this.debris.count = 0;
    this.debris.frustumCulled = false;
    world.scene.add(this.debris);
  }
  private blockMaterial: THREE.MeshStandardMaterial;
  private blockColour = new THREE.Color();

  setScale(pixelsPerUnit: number) {
    // Points are sized in pixels; keep them proportional to the field.
    const k = pixelsPerUnit / 24;
    this.glow.uniforms.uScale.value = k;
    this.smoke.uniforms.uScale.value = k;
  }

  dust(
    x: number,
    y: number,
    z: number,
    amount = 10,
    colour = [0.78, 0.68, 0.52],
    spread = 1,
  ) {
    for (let i = 0; i < amount; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(0.6, 1.8) * spread;
      this.smoke.add({
        x: x + Math.cos(a) * 0.2,
        y: y + 0.1,
        z: z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: rand(0.2, 0.9),
        drag: 2.6,
        life: rand(0.5, 0.9),
        size: rand(0.35, 0.6) * spread,
        grow: 0.8 * spread,
        r: colour[0],
        g: colour[1],
        b: colour[2],
        alpha: 0.55,
      });
    }
  }

  sparks(x: number, y: number, z: number, amount = 8, colour = [1, 0.8, 0.4]) {
    for (let i = 0; i < amount; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(1.5, 4);
      this.glow.add({
        x,
        y,
        z,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: rand(1, 3.5),
        gravity: 9,
        drag: 1.2,
        life: rand(0.2, 0.45),
        size: rand(0.08, 0.16),
        r: colour[0],
        g: colour[1],
        b: colour[2],
      });
    }
  }

  fire(x: number, y: number, z: number, radius: number) {
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, radius);
      this.glow.add({
        x: x + Math.cos(a) * d * 0.4,
        y: y + rand(0, 0.3),
        z: z + Math.sin(a) * d * 0.4,
        vx: Math.cos(a) * d * 2.4,
        vz: Math.sin(a) * d * 2.4,
        vy: rand(0.5, 2.2),
        drag: 3,
        life: rand(0.3, 0.6),
        size: rand(0.5, 0.9),
        grow: 0.6,
        r: 1,
        g: rand(0.45, 0.7),
        b: 0.15,
      });
    }
    this.dust(x, y, z, 10, [0.32, 0.3, 0.3], 1.2);
  }

  smokePuff(x: number, y: number, z: number, size = 1) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2);
      this.smoke.add({
        x: x + Math.cos(a) * 0.2 * size,
        y: y + rand(0.1, 0.8) * size,
        z: z + Math.sin(a) * 0.2 * size,
        vx: Math.cos(a) * rand(0.4, 1.2) * size,
        vz: Math.sin(a) * rand(0.4, 1.2) * size,
        vy: rand(0.4, 1.4),
        drag: 2,
        life: rand(0.6, 1.1),
        size: rand(0.4, 0.8) * size,
        grow: 1.2 * size,
        r: 0.92,
        g: 0.92,
        b: 0.95,
        alpha: 0.7,
      });
    }
  }

  /** A gun going off where its shot first shows: a flash, sparks and,
   *  for powder guns, a puff of smoke. */
  muzzle(
    x: number,
    y: number,
    z: number,
    kind: ProjectileKind,
    colour: number[] = [1, 0.9, 0.6],
  ) {
    const look: Partial<
      Record<
        ProjectileKind,
        { flash: number; tint: number[]; sparks: number; smoke: number }
      >
    > = {
      laser: { flash: 0.55, tint: colour, sparks: 5, smoke: 0 },
      bolt: { flash: 0.6, tint: [1, 0.86, 0.5], sparks: 4, smoke: 4 },
      frost: { flash: 0.55, tint: [0.75, 0.95, 1], sparks: 7, smoke: 3 },
      shell: { flash: 1.1, tint: [1, 0.62, 0.22], sparks: 8, smoke: 10 },
      fire: { flash: 0.7, tint: [1, 0.55, 0.15], sparks: 6, smoke: 0 },
    };
    const it = look[kind];
    if (!it) return;
    this.glow.add({
      x,
      y,
      z,
      life: 0.1,
      size: it.flash,
      grow: it.flash * 0.6,
      r: 1,
      g: 1,
      b: 1,
    });
    this.glow.add({
      x,
      y,
      z,
      life: 0.16,
      size: it.flash * 1.4,
      grow: it.flash * 0.5,
      r: it.tint[0],
      g: it.tint[1],
      b: it.tint[2],
    });
    for (let i = 0; i < it.sparks; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(1.2, 3);
      this.glow.add({
        x,
        y,
        z,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: rand(-0.3, 1.6),
        drag: 5,
        life: rand(0.12, 0.26),
        size: rand(0.08, 0.16),
        r: it.tint[0],
        g: it.tint[1],
        b: it.tint[2],
      });
    }
    for (let i = 0; i < it.smoke; i++)
      this.smoke.add({
        x: x + rand(-0.08, 0.08),
        y: y + rand(-0.05, 0.08),
        z: z + rand(-0.08, 0.08),
        vx: rand(-0.4, 0.4),
        vy: rand(0.3, 0.9),
        vz: rand(-0.4, 0.4),
        drag: 2,
        life: rand(0.5, 0.9),
        size: kind === 'shell' ? rand(0.3, 0.5) : rand(0.12, 0.22),
        grow: kind === 'shell' ? 0.6 : 0.3,
        r: kind === 'frost' ? 0.9 : 0.92,
        g: kind === 'frost' ? 0.97 : 0.9,
        b: kind === 'frost' ? 1 : 0.86,
        alpha: 0.55,
      });
  }

  trail(
    x: number,
    y: number,
    z: number,
    kind: ProjectileKind,
    colour?: number[],
  ) {
    if (kind === 'laser' && colour)
      this.glow.add({
        x,
        y,
        z,
        life: 0.14,
        size: 0.22,
        grow: -0.15,
        r: colour[0],
        g: colour[1],
        b: colour[2],
      });
    else if (kind === 'bomb')
      this.glow.add({
        x: x + rand(-0.04, 0.04),
        y: y + 0.18,
        z: z + rand(-0.04, 0.04),
        vy: 0.6,
        life: 0.22,
        size: rand(0.08, 0.14),
        r: 1,
        g: 0.8,
        b: 0.3,
      });
    else if (kind === 'bolt')
      this.smoke.add({
        x,
        y,
        z,
        life: 0.25,
        size: 0.08,
        grow: 0.12,
        r: 1,
        g: 1,
        b: 1,
        alpha: 0.35,
      });
    else if (kind === 'fire')
      this.glow.add({
        x: x + rand(-0.05, 0.05),
        y: y + rand(-0.05, 0.05),
        z: z + rand(-0.05, 0.05),
        vy: 0.4,
        life: 0.35,
        size: rand(0.25, 0.4),
        grow: -0.15,
        r: 1,
        g: rand(0.45, 0.65),
        b: 0.12,
      });
    else if (kind === 'frost')
      // Cold sparkles shed along the frost shot's path.
      this.glow.add({
        x: x + rand(-0.06, 0.06),
        y: y + rand(-0.06, 0.06),
        z: z + rand(-0.06, 0.06),
        vy: -0.3,
        life: 0.3,
        size: rand(0.08, 0.14),
        grow: -0.06,
        r: 0.72,
        g: 0.92,
        b: 1,
      });
    else if (kind === 'cannon')
      this.smoke.add({
        x,
        y,
        z,
        vy: 0.2,
        life: 0.5,
        size: 0.18,
        grow: 0.3,
        r: 0.8,
        g: 0.8,
        b: 0.8,
        alpha: 0.4,
      });
  }

  /** Confetti-bright sparkles for a toy knocked out of the game. */
  pop(x: number, y: number, z: number, size = 1) {
    const colours = [
      [1, 0.84, 0.3],
      [0.55, 0.8, 1],
      [1, 0.55, 0.7],
      [0.7, 1, 0.6],
      [1, 1, 1],
    ];
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(1.2, 3) * size;
      const c = colours[i % colours.length];
      this.glow.add({
        x,
        y: y + rand(0.2, 0.9) * size,
        z,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: rand(1.5, 3.5),
        gravity: 6,
        drag: 1.5,
        life: rand(0.45, 0.8),
        size: rand(0.1, 0.2),
        r: c[0],
        g: c[1],
        b: c[2],
      });
    }
  }

  /** A ray-gun zap: a bright flash in the shooter's colour. */
  zap(x: number, y: number, z: number, colour: number[]) {
    for (let i = 0; i < 7; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(1, 2.6);
      this.glow.add({
        x,
        y,
        z,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: rand(-0.5, 1.5),
        drag: 5,
        life: rand(0.15, 0.3),
        size: rand(0.12, 0.26),
        r: colour[0],
        g: colour[1],
        b: colour[2],
      });
    }
    this.glow.add({
      x,
      y,
      z,
      life: 0.16,
      size: 0.9,
      grow: 0.6,
      r: 1,
      g: 1,
      b: 1,
    });
  }

  /** A crackling bolt from one troop to the next: glowing beads along a
   *  jagged line, bright at both ends. */
  bolt(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    this.lightning.add(tmpA.set(ax, ay, az), tmpB.set(bx, by, bz));
    // A few sparks scattered along it.
    for (let i = 0; i < 6; i++) {
      const t = Math.random();
      this.glow.add({
        x: ax + (bx - ax) * t + rand(-0.15, 0.15),
        y: ay + (by - ay) * t + rand(-0.15, 0.15),
        z: az + (bz - az) * t + rand(-0.15, 0.15),
        vy: rand(-0.4, 0.8),
        drag: 4,
        life: rand(0.15, 0.3),
        size: rand(0.1, 0.18),
        r: 0.7,
        g: 0.9,
        b: 1,
      });
    }
    this.zap(bx, by, bz, [0.6, 0.85, 1]);
  }

  /** The Medic's pulse: a ring of green light and sparkles rising. */
  heal(x: number, z: number, radius: number) {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.glow.add({
        x: x + Math.cos(a) * radius * 0.3,
        y: 0.25,
        z: z + Math.sin(a) * radius * 0.3,
        vx: Math.cos(a) * radius * 1.8,
        vz: Math.sin(a) * radius * 1.8,
        drag: 3,
        life: 0.55,
        size: 0.22,
        grow: -0.2,
        r: 0.45,
        g: 1,
        b: 0.55,
      });
    }
    for (let i = 0; i < 8; i++)
      this.glow.add({
        x: x + rand(-0.4, 0.4),
        y: rand(0.4, 1.2),
        z: z + rand(-0.4, 0.4),
        vy: rand(0.8, 1.6),
        life: rand(0.5, 0.8),
        size: rand(0.12, 0.2),
        r: 0.7,
        g: 1,
        b: 0.7,
      });
  }

  /** The Meteor's crash: a white flash, a fireball, a ring of dust racing
   *  out over the mat and dark rock chips flung everywhere. */
  blast(x: number, z: number, radius: number) {
    this.glow.add({
      x,
      y: 0.6,
      z,
      life: 0.22,
      size: radius * 2.4,
      grow: 1.5,
      r: 1,
      g: 0.95,
      b: 0.8,
    });
    for (let i = 0; i < 46; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, radius * 0.7);
      this.glow.add({
        x: x + Math.cos(a) * d * 0.4,
        y: rand(0.2, 1),
        z: z + Math.sin(a) * d * 0.4,
        vx: Math.cos(a) * d * 3,
        vz: Math.sin(a) * d * 3,
        vy: rand(1, 4.5),
        drag: 2.6,
        life: rand(0.35, 0.8),
        size: rand(0.6, 1.2),
        grow: 0.8,
        r: 1,
        g: rand(0.4, 0.7),
        b: rand(0.08, 0.2),
      });
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + rand(-0.08, 0.08);
      const v = rand(4.5, 6.5) * (radius / 2.5);
      this.smoke.add({
        x: x + Math.cos(a) * 0.4,
        y: 0.25,
        z: z + Math.sin(a) * 0.4,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: rand(0.2, 0.8),
        drag: 3.2,
        life: rand(0.7, 1.2),
        size: rand(0.6, 1),
        grow: 1.6,
        r: 0.82,
        g: 0.74,
        b: 0.62,
        alpha: 0.6,
      });
    }
    this.sparks(x, 0.8, z, 26, [1, 0.75, 0.3]);
    this.smokePuff(x, 0.4, z, radius * 0.7);
  }

  collapse(x: number, z: number, big: boolean) {
    const n = big ? 60 : 40;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(1.5, 5);
      this.chunks.push({
        p: new THREE.Vector3(
          x + rand(-1, 1),
          rand(1, big ? 4.5 : 3.5),
          z + rand(-1, 1),
        ),
        v: new THREE.Vector3(Math.cos(a) * v, rand(2, 6), Math.sin(a) * v),
        r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)),
        w: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
        s: rand(0.6, 1.8),
        age: 0,
        c: blockColours[Math.floor(rand(0, blockColours.length))],
      });
    }
    if (this.chunks.length > 160)
      this.chunks.splice(0, this.chunks.length - 160);
    for (let i = 0; i < 5; i++)
      this.dust(
        x + rand(-1.5, 1.5),
        rand(0, 2),
        z + rand(-1.5, 1.5),
        12,
        [0.74, 0.7, 0.62],
        2.2,
      );
  }

  update(dt: number) {
    this.glow.update(dt);
    this.smoke.update(dt);
    this.lightning.update(dt);
    const keep = [];
    for (const c of this.chunks) {
      c.age += dt;
      if (c.age > 2.4) continue;
      c.v.y -= 16 * dt;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < 0.1) {
        c.p.y = 0.1;
        c.v.y *= -0.3;
        c.v.x *= 0.5;
        c.v.z *= 0.5;
        c.w.multiplyScalar(0.5);
      }
      c.r.x += c.w.x * dt;
      c.r.y += c.w.y * dt;
      c.r.z += c.w.z * dt;
      keep.push(c);
    }
    this.chunks = keep;
    keep.forEach((c, i) => {
      const fade = c.age > 1.8 ? 1 - (c.age - 1.8) / 0.6 : 1;
      this.dummy.position.copy(c.p);
      this.dummy.rotation.copy(c.r);
      this.dummy.scale.setScalar(c.s * Math.max(0.01, fade));
      this.dummy.updateMatrix();
      this.debris.setMatrixAt(i, this.dummy.matrix);
      this.debris.setColorAt(i, this.blockColour.set(c.c));
    });
    if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;
    this.debris.count = keep.length;
    this.debris.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.glow.dispose();
    this.smoke.dispose();
    this.lightning.dispose();
    this.debris.geometry.dispose();
  }
}

/** Tones for the chunks of a fallen tower. */
const blockColours = ['#ffffff', '#e8e4dc', '#d6d2cc', '#c9c2b8', '#b8b4ae'];

// ---------------------------------------------------------------- projectiles

/** Glow colours for ray-gun bolts, by team. */
const laserColours: Record<Team, number[]> = {
  0: [0.55, 0.85, 1],
  1: [1, 0.55, 0.45],
};

export class ProjectileViews {
  private meshes = new Map<number, THREE.Object3D>();
  /** Shots whose launch flash has gone off. */
  private flashed = new Set<number>();
  private kinds: Record<ProjectileKind, (team: Team) => THREE.Object3D>;
  private geometries: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  /**
   * Fireballs light the ground around them with a warm additive glow drawn
   * on the mat. Real point lights looked the same but cost every lit pixel
   * on screen, even unused, and adding one makes three.js rebuild every lit
   * shader (the battle froze whenever a Mage fired).
   */
  private glows = new Map<number, THREE.Mesh>();
  private glowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private glowMaterial: THREE.MeshBasicMaterial;
  private team = new Map<number, Team>();
  /** A shot drawn leaving its shooter's hand (a tower archer's bow) rather
   *  than the engine's launch spot: the gap, closed as it flies. */
  private offsets = new Map<number, THREE.Vector3>();
  private meshRadii = new Map<ProjectileKind, number>();
  private shotBounds = new THREE.Box3();
  private shotSphere = new THREE.Sphere();

  constructor(
    private world: ArenaWorld,
    private particles: Particles,
  ) {
    // Ray-gun bolts: a white-hot core in a coloured sheath, along +z.
    const core = new THREE.CapsuleGeometry(0.035, 0.46, 4, 8).rotateX(
      Math.PI / 2,
    );
    const sheath = new THREE.CapsuleGeometry(0.08, 0.52, 4, 10).rotateX(
      Math.PI / 2,
    );
    // A brass toy bullet for the Cowboy.
    const bullet = mergeGeometries([
      new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10),
      new THREE.SphereGeometry(
        0.045,
        10,
        6,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ).translate(0, 0.07, 0),
    ]).rotateX(Math.PI / 2);
    // A longbow arrow along +z: an ash shaft, a steel bodkin head and three
    // fletches in the side's colour.
    const shaft = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6).rotateX(
      Math.PI / 2,
    );
    const head = new THREE.ConeGeometry(0.04, 0.13, 6)
      .rotateX(Math.PI / 2)
      .translate(0, 0, 0.5);
    const fletch = mergeGeometries(
      [0, 1, 2].map((i) =>
        new THREE.PlaneGeometry(0.07, 0.2)
          .rotateX(Math.PI / 2)
          .rotateZ(Math.PI / 2)
          .translate(0, 0.04, -0.34)
          .rotateZ((i * Math.PI * 2) / 3),
      ),
    );
    const ball = new THREE.SphereGeometry(0.2, 18, 12);
    const fireball = new THREE.SphereGeometry(0.26, 16, 12);
    // A little round bomb with a tail fin ring and a fuse.
    const bomb = mergeGeometries([
      new THREE.SphereGeometry(0.17, 16, 12),
      new THREE.CylinderGeometry(0.1, 0.13, 0.08, 12).translate(0, -0.2, 0),
      new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6).translate(0, 0.2, 0),
    ]).rotateX(-Math.PI / 2);
    this.geometries.push(
      core,
      sheath,
      bullet,
      shaft,
      head,
      fletch,
      ball,
      fireball,
      bomb,
    );
    const hot = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      toneMapped: false,
    });
    const sheaths: Record<Team, THREE.MeshBasicMaterial> = {
      0: new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(
          ...(laserColours[0] as [number, number, number]),
        ),
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      1: new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(
          ...(laserColours[1] as [number, number, number]),
        ),
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    };
    const brass = new THREE.MeshStandardMaterial({
      color: '#e2b04c',
      roughness: 0.25,
      metalness: 1,
    });
    const plastic = new THREE.MeshPhysicalMaterial({
      color: '#1d1f24',
      roughness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    });
    const flame = new THREE.MeshBasicMaterial({
      color: '#ffb347',
      toneMapped: false,
    });
    const ash = new THREE.MeshStandardMaterial({
      color: '#b99a6e',
      roughness: 0.7,
    });
    const steel = new THREE.MeshStandardMaterial({
      color: '#c9ccd2',
      roughness: 0.35,
      metalness: 1,
    });
    const feathers: Record<Team, THREE.MeshStandardMaterial> = {
      0: new THREE.MeshStandardMaterial({
        color: '#3d63d8',
        roughness: 0.8,
        side: THREE.DoubleSide,
      }),
      1: new THREE.MeshStandardMaterial({
        color: '#c7392f',
        roughness: 0.8,
        side: THREE.DoubleSide,
      }),
    };
    this.mats.push(
      hot,
      sheaths[0],
      sheaths[1],
      brass,
      plastic,
      flame,
      ash,
      steel,
      feathers[0],
      feathers[1],
    );
    this.kinds = {
      laser: (team) => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(core, hot), new THREE.Mesh(sheath, sheaths[team]));
        return g;
      },
      bolt: () => new THREE.Mesh(bullet, brass),
      arrow: (team) => {
        const g = new THREE.Group();
        g.add(
          new THREE.Mesh(shaft, ash),
          new THREE.Mesh(head, steel),
          new THREE.Mesh(fletch, feathers[team]),
        );
        return g;
      },
      cannon: () => new THREE.Mesh(ball, plastic),
      fire: () => new THREE.Mesh(fireball, flame),
      bomb: () => new THREE.Mesh(bomb, plastic),
      drop: () => new THREE.Mesh(bomb, plastic),
      shell: () => new THREE.Mesh(ball, plastic),
      zap: () => new THREE.Mesh(core, hot),
      // The Explorer's frost shot: a glowing ice shard in a cold halo.
      frost: () => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(shard, ice), new THREE.Mesh(halo, frostHalo));
        return g;
      },
    };
    // The frost shard: a long ice crystal, white-hot at its core.
    const shard = new THREE.OctahedronGeometry(0.1, 0).scale(0.75, 0.75, 2.4);
    const halo = new THREE.OctahedronGeometry(0.16, 0).scale(0.8, 0.8, 2);
    const ice = new THREE.MeshBasicMaterial({
      color: '#d8f6ff',
      toneMapped: false,
    });
    const frostHalo = new THREE.MeshBasicMaterial({
      color: '#5fc8ff',
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.geometries.push(shard, halo);
    this.mats.push(ice, frostHalo);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const glow = new THREE.CanvasTexture(c);
    glow.colorSpace = THREE.SRGBColorSpace;
    this.glowMaterial = new THREE.MeshBasicMaterial({
      map: glow,
      color: '#ff7a24',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.mats.push(this.glowMaterial);
    this.geometries.push(this.glowGeometry);
    this.textures.push(glow);
  }

  /** Shots grow with the figures on portrait phones. */
  private size = 1;
  setScale(size: number) {
    this.size = size;
    for (const mesh of this.meshes.values()) mesh.scale.setScalar(size);
  }

  /** Height of a projectile's target: chest height of a troop or tower. */
  /** `origin` gives where a shooter's shot is drawn leaving it, if it
   *  knows (a tower archer's nocked arrow). */
  sync(
    m: Match,
    alpha: number,
    targetHeight: (id: number) => number,
    origin?: (sourceId: number, kind: ProjectileKind) => THREE.Vector3 | null,
  ) {
    const seen = new Set<number>();
    for (const p of m.projectiles) {
      seen.add(p.id);
      let mesh = this.meshes.get(p.id);
      if (!mesh) {
        // Shots wear the shooter's colour as the viewer sees it.
        const team: Team = p.side === this.world.viewSide ? 0 : 1;
        this.team.set(p.id, team);
        mesh = this.kinds[p.kind](team);
        if (!this.meshRadii.has(p.kind)) {
          this.shotBounds
            .setFromObject(mesh)
            .getBoundingSphere(this.shotSphere);
          this.meshRadii.set(
            p.kind,
            this.shotSphere.radius + this.shotSphere.center.length(),
          );
        }
        mesh.castShadow = p.kind !== 'fire' && p.kind !== 'laser';
        mesh.scale.setScalar(this.size);
        this.meshes.set(p.id, mesh);
        this.world.scene.add(mesh);
        // (Seen within its first ticks: a shot seen late, after a resync,
        // has long left the bow.)
        const fresh = p.travelled <= p.speed * TICK * 2.5;
        const from = fresh ? origin?.(p.sourceId, p.kind) : null;
        if (from) {
          const [sx, , sz] = toWorld(p.sx, p.sy);
          this.offsets.set(
            p.id,
            from.clone().sub(this.tmpStart.set(sx, this.startHeight(p), sz)),
          );
        }
        if (p.kind === 'fire') {
          const glow = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
          glow.renderOrder = 4;
          this.glows.set(p.id, glow);
          this.world.scene.add(glow);
        }
      }
      this.place(mesh, p, alpha, targetHeight(p.targetId), m);
      if (this.flashed.size > 64) this.flashed.clear();
      if (!this.flashed.has(p.id) && p.travelled <= p.speed * TICK * 2.5) {
        this.flashed.add(p.id);
        this.particles.muzzle(
          mesh.position.x,
          mesh.position.y,
          mesh.position.z,
          p.kind,
          laserColours[this.team.get(p.id) ?? 0],
        );
      }
      const glow = this.glows.get(p.id);
      if (glow) {
        // Brighter and tighter as the fireball comes down.
        const h = Math.max(0, mesh.position.y);
        const size = 2.6 + h * 0.5;
        glow.position.set(mesh.position.x, 0.06, mesh.position.z);
        glow.scale.set(size, 1, size);
        this.glowMaterial.opacity = 0.75;
      }
    }
    for (const [id, mesh] of this.meshes)
      if (!seen.has(id)) {
        this.world.scene.remove(mesh);
        this.meshes.delete(id);
        this.team.delete(id);
        this.offsets.delete(id);
        const glow = this.glows.get(id);
        if (glow) this.world.scene.remove(glow);
        this.glows.delete(id);
      }
  }

  private next = new THREE.Vector3();
  private tmpStart = new THREE.Vector3();

  /** The height a shot leaves from: a small tower's archer stands lower
   *  than the engine's platform, the king's cannon is scaled with it. */
  private startHeight(p: Projectile) {
    const tower = this.world.towers.get(p.sourceId);
    return tower
      ? tower.kind === 'king'
        ? p.sz * this.world.towerScale
        : p.sz - tower.guardDrop
      : p.sz;
  }

  private place(
    mesh: THREE.Object3D,
    p: Projectile,
    alpha: number,
    endHeight: number,
    m: Match,
  ) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const ahead = projectileAhead(m, p, alpha);
    const fx = d > 0 ? p.x + (dx / d) * ahead : p.x;
    const fy = d > 0 ? p.y + (dy / d) * ahead : p.y;
    const t = Math.min(1, (p.travelled + ahead) / Math.max(0.01, p.distance));
    // Rays and bullets fly straight; balls and bombs lob.
    const arc =
      p.kind === 'shell'
        ? 3.2
        : p.kind === 'drop' || p.kind === 'zap'
          ? 0
          : p.kind === 'cannon'
            ? 1.4
            : p.kind === 'bomb'
              ? 0.25
              : p.kind === 'fire'
                ? 0.5
                : p.kind === 'laser'
                  ? 0.05
                  : p.kind === 'arrow'
                    ? 0.45
                    : 0.2;
    const lift = Math.sin(t * Math.PI) * arc * Math.min(1, p.distance / 6);
    // A bomb falls away from the plane, accelerating down.
    const fall = p.kind === 'bomb' || p.kind === 'drop' ? t * t : t;
    const startHeight = this.startHeight(p);
    const h = startHeight + (endHeight - startHeight) * fall + lift;
    const [wx, , wz] = toWorld(fx, fy);
    // Aim along the path, a little ahead.
    const t2 = Math.min(1, t + 0.04);
    const fall2 = p.kind === 'bomb' || p.kind === 'drop' ? t2 * t2 : t2;
    const h2 =
      startHeight +
      (endHeight - startHeight) * fall2 +
      Math.sin(t2 * Math.PI) * arc * Math.min(1, p.distance / 6);
    const [nx, , nz] = toWorld(
      fx + (d > 0 ? (dx / d) * 0.3 : 0),
      fy + (d > 0 ? (dy / d) * 0.3 : 0),
    );
    mesh.position.set(wx, h, wz);
    this.next.set(nx, h2, nz);
    const offset = this.offsets.get(p.id);
    if (offset) {
      mesh.position.addScaledVector(offset, 1 - t);
      this.next.addScaledVector(offset, 1 - t2);
    }
    const [cx, cy] = projectileOrigin(
      m,
      p,
      mesh.position.x + WIDTH / 2,
      LENGTH / 2 - mesh.position.z,
      (this.meshRadii.get(p.kind) ?? 0) * this.size,
    );
    const shiftX = cx - WIDTH / 2 - mesh.position.x;
    const shiftZ = LENGTH / 2 - cy - mesh.position.z;
    mesh.position.x += shiftX;
    mesh.position.z += shiftZ;
    this.next.x += shiftX;
    this.next.z += shiftZ;
    if (this.next.distanceToSquared(mesh.position) > 1e-6)
      mesh.lookAt(this.next);
    this.particles.trail(
      mesh.position.x,
      mesh.position.y,
      mesh.position.z,
      p.kind,
      laserColours[this.team.get(p.id) ?? 0],
    );
  }

  /** The zap colour for a shot's side, as the viewer sees it. */
  colourOf(side: Side) {
    return laserColours[side === this.world.viewSide ? 0 : 1];
  }

  dispose() {
    for (const m of this.meshes.values()) this.world.scene.remove(m);
    for (const g of this.glows.values()) this.world.scene.remove(g);
    this.textures.forEach((t) => t.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}

// ---------------------------------------------------------------- spells

/** One Meteor in flight. */
type MeteorView = {
  rock: THREE.Object3D;
  ring: THREE.Mesh;
  disc: THREE.Mesh;
  spin: THREE.Vector3;
  /** Where it was hurled from (the caster's king's roof), or null for
   *  the old fall out of the sky (no king to throw it). */
  from: THREE.Vector3 | null;
  /** The arc's height above the straight line, at its middle. */
  lob: number;
};

/**
 * Meteors. The caster's king hurls the rock from its roof (a flash, a burst
 * of flame and smoke), it arcs over the field trailing fire and smoke and
 * lands on the crash: each is drawn from the engine's spell (its time
 * left), so the rock reaches the ground exactly on the 30th step. On the
 * mat a ring in the caster's colour tightens as it comes. The flight is
 * the same from either end and in team battles: it always starts at the
 * casting side's king.
 */
export class SpellViews {
  private views = new Map<number, MeteorView>();
  private ringGeometry = new THREE.RingGeometry(0.93, 1, 64).rotateX(
    -Math.PI / 2,
  );
  private discGeometry = new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
  private rockGeometry?: THREE.BufferGeometry;
  private mats: THREE.Material[] = [];
  private ringMats: Record<Team, THREE.MeshBasicMaterial>;
  private discMats: Record<Team, THREE.MeshBasicMaterial>;
  private rockMaterial?: THREE.Material;

  constructor(
    private world: ArenaWorld,
    private particles: Particles,
  ) {
    const make = (team: Team, opacity: number) =>
      new THREE.MeshBasicMaterial({
        color: team === 0 ? teamColours[0].light : teamColours[1].light,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
      });
    this.ringMats = { 0: make(0, 0.95), 1: make(1, 0.95) };
    this.discMats = { 0: make(0, 0.18), 1: make(1, 0.18) };
    this.mats.push(
      ...Object.values(this.ringMats),
      ...Object.values(this.discMats),
    );
  }

  /** Burning copies of the modelled rock's materials. */
  private burning = new Map<THREE.Material, THREE.MeshStandardMaterial>();

  private rock() {
    const { towers } = this.world.assets;
    if (towers.scene.getObjectByName('meteor')) {
      const rock = this.world.instance(towers, 'meteor', 0);
      // A fireball, not a stone: its surface glows from within.
      rock.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const source = mesh.material as THREE.MeshStandardMaterial;
        if (!source.isMeshStandardMaterial) return;
        let hot = this.burning.get(source);
        if (!hot) {
          hot = source.clone();
          hot.onBeforeCompile = source.onBeforeCompile.bind(source);
          hot.customProgramCacheKey = source.customProgramCacheKey.bind(source);
          hot.emissive.set('#ff8a1e');
          hot.emissiveIntensity = 1.05;
          this.burning.set(source, hot);
          this.mats.push(hot);
        }
        mesh.material = hot;
      });
      return rock;
    }
    // Until the modelled rock is built: a dark lumpy stone with a glow.
    if (!this.rockGeometry) {
      const g = new THREE.IcosahedronGeometry(0.6, 1);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const k = 0.8 + Math.random() * 0.35;
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
      }
      g.computeVertexNormals();
      this.rockGeometry = g;
      this.rockMaterial = new THREE.MeshStandardMaterial({
        color: '#3a2c26',
        roughness: 0.8,
        emissive: '#ff5a14',
        emissiveIntensity: 0.6,
        flatShading: true,
      });
      this.mats.push(this.rockMaterial);
    }
    return new THREE.Mesh(this.rockGeometry, this.rockMaterial);
  }

  /** The roof spot a side's king hurls its Meteors from. */
  private launchSpot(m: Match, sp: Spell) {
    const king = m.towers.find((t) => t.side === sp.side && t.kind === 'king');
    if (!king) return null;
    const [kx, , kz] = toWorld(king.x, king.y);
    const [tx, , tz] = toWorld(sp.x, sp.y);
    // From the front of the roof deck, towards the target.
    const dx = tx - kx;
    const dz = tz - kz;
    const d = Math.hypot(dx, dz) || 1;
    const reach = Math.min(0.55, d * 0.5);
    return new THREE.Vector3(
      kx + (dx / d) * reach,
      3.75 * this.world.towerScale,
      kz + (dz / d) * reach,
    );
  }

  /** The king's throw: a flash on its roof, flame bursting towards the
   *  target, and a ring of smoke rolling off the deck. */
  private launch(from: THREE.Vector3, to: THREE.Vector3) {
    const p = this.particles;
    const dir = to.clone().sub(from).setY(0).normalize();
    p.glow.add({
      x: from.x,
      y: from.y + 0.2,
      z: from.z,
      life: 0.24,
      size: 2.6,
      grow: 1.4,
      r: 1,
      g: 0.86,
      b: 0.55,
    });
    for (let i = 0; i < 22; i++) {
      const v = rand(2, 6);
      p.glow.add({
        x: from.x + rand(-0.2, 0.2),
        y: from.y + rand(0, 0.3),
        z: from.z + rand(-0.2, 0.2),
        vx: dir.x * v + rand(-1.2, 1.2),
        vy: rand(2, 5.5),
        vz: dir.z * v + rand(-1.2, 1.2),
        drag: 3.2,
        life: rand(0.25, 0.5),
        size: rand(0.4, 0.8),
        grow: 0.5,
        r: 1,
        g: rand(0.45, 0.72),
        b: 0.15,
      });
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const v = rand(1.4, 2.4);
      p.smoke.add({
        x: from.x + Math.cos(a) * 0.4,
        y: from.y - 0.2,
        z: from.z + Math.sin(a) * 0.4,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: rand(0.3, 1),
        drag: 2.4,
        life: rand(0.8, 1.3),
        size: rand(0.45, 0.75),
        grow: 1.3,
        r: 0.9,
        g: 0.88,
        b: 0.86,
        alpha: 0.6,
      });
    }
    p.smokePuff(from.x, from.y, from.z, 1.1);
    p.sparks(from.x, from.y + 0.3, from.z, 16, [1, 0.8, 0.35]);
  }

  sync(m: Match, alpha: number, time: number) {
    const seen = new Set<number>();
    const turn = this.world.viewSide === 1 ? -1 : 1;
    for (const sp of m.spells ?? []) {
      seen.add(sp.id);
      let v = this.views.get(sp.id);
      if (!v) {
        const team: Team = sp.side === this.world.viewSide ? 0 : 1;
        const rock = this.rock();
        rock.traverse((n) => {
          if ((n as THREE.Mesh).isMesh) (n as THREE.Mesh).castShadow = true;
        });
        const ring = new THREE.Mesh(this.ringGeometry, this.ringMats[team]);
        const disc = new THREE.Mesh(this.discGeometry, this.discMats[team]);
        ring.renderOrder = 4;
        disc.renderOrder = 4;
        this.world.scene.add(rock, ring, disc);
        const from = this.launchSpot(m, sp);
        const [tx, , tz] = toWorld(sp.x, sp.y);
        const reach = from ? Math.hypot(tx - from.x, tz - from.z) : 0;
        v = {
          rock,
          ring,
          disc,
          spin: new THREE.Vector3(rand(-4, 4), rand(-4, 4), rand(-4, 4)),
          from,
          // Higher for a longer throw, so it always reads as a lob; kept
          // low enough that the steep camera still sees it cross the field.
          lob: 2.2 + reach * 0.11,
        };
        this.views.set(sp.id, v);
        // A cast seen late (a resync) has already left the roof; the
        // shader warm-up's pretend cast never throws.
        const t = 1 - sp.left / Math.max(0.01, sp.delay);
        if (from && sp.id >= 0 && t < 0.35)
          this.launch(from, new THREE.Vector3(tx, 0, tz));
      }
      this.place(v, sp, alpha, time, turn);
    }
    for (const [id, v] of this.views)
      if (!seen.has(id)) {
        this.world.scene.remove(v.rock, v.ring, v.disc);
        this.views.delete(id);
      }
  }

  private place(
    v: MeteorView,
    sp: Spell,
    alpha: number,
    time: number,
    turn: number,
  ) {
    const left = Math.max(0, sp.left - alpha * TICK);
    const t = 1 - left / Math.max(0.01, sp.delay);
    const [wx, , wz] = toWorld(sp.x, sp.y);
    let x: number;
    let y: number;
    let z: number;
    if (v.from) {
      // A lob: steady across the ground, up and over, down onto the mark.
      const f = v.from;
      x = f.x + (wx - f.x) * t;
      z = f.z + (wz - f.z) * t;
      y = f.y + (0.4 - f.y) * t + 4 * v.lob * t * (1 - t);
    } else {
      // No king to throw it: in from high up, falling faster and faster.
      const k = t * t;
      const from = new THREE.Vector3(wx - 9 * turn, 24, wz + 7 * turn);
      x = from.x + (wx - from.x) * k;
      y = from.y + (0.4 - from.y) * k;
      z = from.z + (wz - from.z) * k;
    }
    v.rock.position.set(x, y, z);
    v.rock.rotation.set(time * v.spin.x, time * v.spin.y, time * v.spin.z);
    // Small on the roof, a blazing boulder by the time it lands.
    const size = v.from ? 0.75 + t * 0.6 : 1.1 + t * 0.4;
    v.rock.scale.setScalar(size);
    for (let i = 0; i < 3; i++)
      this.particles.trail(
        x + rand(-0.3, 0.3) * size,
        y + rand(-0.3, 0.3) * size,
        z + rand(-0.3, 0.3) * size,
        'fire',
      );
    if (v.from) {
      // It burns as it flies: a halo round the rock and a long tail of
      // flame and dark smoke behind it.
      this.particles.glow.add({
        x,
        y,
        z,
        life: 0.06,
        size: 2.3 * size,
        r: 1,
        g: 0.62,
        b: 0.16,
        alpha: 0.85,
      });
      for (let i = 0; i < 3; i++)
        this.particles.glow.add({
          x: x + rand(-0.25, 0.25) * size,
          y: y + rand(-0.25, 0.25) * size,
          z: z + rand(-0.25, 0.25) * size,
          vy: 0.6,
          life: rand(0.4, 0.6),
          size: rand(0.5, 0.85) * size,
          grow: -0.4,
          r: 1,
          g: rand(0.38, 0.62),
          b: 0.1,
        });
    }
    if (Math.random() < (v.from && t < 0.3 ? 0.9 : 0.5))
      this.particles.smoke.add({
        x,
        y: y + 0.3,
        z,
        vy: 0.3,
        life: v.from ? 0.9 : 0.7,
        size: 0.5 * size,
        grow: 1,
        r: 0.35,
        g: 0.3,
        b: 0.3,
        alpha: 0.45,
      });
    // The target ring pulses and tightens onto the blast circle.
    const r = sp.radius * (1 + (1 - t) * 0.35);
    const pulse = 1 + Math.sin(time * 18) * 0.03;
    v.ring.scale.set(r * pulse, 1, r * pulse);
    v.ring.position.set(wx, 0.07, wz);
    v.disc.scale.set(sp.radius * t, 1, sp.radius * t);
    v.disc.position.set(wx, 0.065, wz);
  }

  dispose() {
    for (const v of this.views.values())
      this.world.scene.remove(v.rock, v.ring, v.disc);
    this.views.clear();
    this.ringGeometry.dispose();
    this.discGeometry.dispose();
    this.rockGeometry?.dispose();
    this.mats.forEach((m) => m.dispose());
  }
}

/** A dark scorch ring left on the mat by a Meteor, fading away. */
export class Scorches {
  private list: { mesh: THREE.Mesh; age: number }[] = [];
  private geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private texture: THREE.CanvasTexture;

  constructor(private world: ArenaWorld) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(20,12,8,0.75)');
    grad.addColorStop(0.55, 'rgba(40,24,14,0.5)');
    grad.addColorStop(0.8, 'rgba(60,36,20,0.18)');
    grad.addColorStop(1, 'rgba(60,36,20,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  add(x: number, z: number, radius: number) {
    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.position.set(x, 0.05, z);
    mesh.scale.set(radius * 2.2, 1, radius * 2.2);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.renderOrder = 3;
    this.world.scene.add(mesh);
    this.list.push({ mesh, age: 0 });
  }

  update(dt: number) {
    this.list = this.list.filter((s) => {
      s.age += dt;
      const fade = 1 - Math.max(0, (s.age - 2.5) / 2);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade);
      if (fade > 0) return true;
      this.world.scene.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
      return false;
    });
  }

  dispose() {
    for (const s of this.list) {
      this.world.scene.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
    }
    this.geometry.dispose();
    this.texture.dispose();
  }
}

// ---------------------------------------------------------------- placement

/** The shaded drop zone shown while a card is held. */
export class DeployOverlay {
  readonly mesh: THREE.Mesh;
  private mask: THREE.DataTexture;
  private data: Uint8Array;
  private key = '';
  private cols = WIDTH * 2;
  private rows = LENGTH * 2;

  constructor(world: ArenaWorld) {
    this.data = new Uint8Array(this.cols * this.rows * 4);
    this.mask = new THREE.DataTexture(
      this.data,
      this.cols,
      this.rows,
      THREE.RGBAFormat,
    );
    this.mask.magFilter = THREE.LinearFilter;
    this.mask.minFilter = THREE.LinearFilter;
    const geo = new THREE.PlaneGeometry(WIDTH, LENGTH).rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        tMask: { value: this.mask },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tMask;
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float ok = texture2D(tMask, vUv).r;
          vec2 tile = vUv * vec2(${WIDTH.toFixed(1)}, ${LENGTH.toFixed(1)});
          vec2 f = abs(fract(tile) - 0.5);
          float grid = smoothstep(0.47, 0.5, max(f.x, f.y));
          float stripes = step(0.5, fract((tile.x + tile.y) * 1.2 - uTime * 0.4));
          vec3 good = vec3(1.0);
          vec3 bad = vec3(0.95, 0.22, 0.2);
          vec3 col = mix(bad, good, ok);
          float a = mix(0.18 + stripes * 0.12, 0.1 + grid * 0.28, ok);
          gl_FragColor = vec4(col, a * uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.position.set(0, 0.035, 0);
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    world.scene.add(this.mesh);
  }

  /** Recompute which half-tiles accept a troop (pockets open as towers
   *  fall). A spell may land anywhere, so the whole field lights up. */
  /** `spell` lights the whole field; `card` asks the rules for one troop
   *  (a burrowing Miner may go anywhere off the water). */
  refresh(m: Match, side: Side, spell = false, card?: CardId) {
    const key = `${spell ? 's' : (card ?? 't')}${m.towers.map((t) => (t.destroyed ? 1 : 0)).join('')}`;
    if (key === this.key) return;
    this.key = key;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        // Row 0 of the texture is the bottom of the plane (your side).
        const x = (c + 0.5) / 2;
        const y = LENGTH - (r + 0.5) / 2;
        const ok = spell || canDeployAt(m, side, x, LENGTH - y, card) ? 255 : 0;
        const i = (r * this.cols + c) * 4;
        this.data[i] = ok;
        this.data[i + 3] = 255;
      }
    this.mask.needsUpdate = true;
  }

  show(on: boolean, time: number) {
    const mat = this.mesh.material as THREE.ShaderMaterial;
    const target = on ? 1 : 0;
    const cur = mat.uniforms.uOpacity.value as number;
    mat.uniforms.uOpacity.value = cur + (target - cur) * 0.25;
    mat.uniforms.uTime.value = time;
    this.mesh.visible = mat.uniforms.uOpacity.value > 0.01;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mask.dispose();
  }
}

/** Compact, camera-facing warnings above enemies that can hit a placement. */
export class ThreatMarkers {
  private texture: THREE.CanvasTexture;
  private markers = new Map<number, { sprite: THREE.Sprite; on: boolean }>();

  constructor(private world: ArenaWorld) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#452c20';
    ctx.beginPath();
    ctx.roundRect(27, 7, 74, 111, 26);
    ctx.fill();
    ctx.fillStyle = '#ffcb58';
    ctx.beginPath();
    ctx.roundRect(33, 13, 62, 99, 21);
    ctx.fill();
    ctx.fillStyle = '#432516';
    ctx.beginPath();
    ctx.roundRect(56, 28, 16, 45, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 90, 8, 0, Math.PI * 2);
    ctx.fill();
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  show(threats: { id: number; x: number; y: number; height: number }[]) {
    for (const marker of this.markers.values()) marker.on = false;
    for (const t of threats) {
      let marker = this.markers.get(t.id);
      if (!marker) {
        const material = new THREE.SpriteMaterial({
          map: this.texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          opacity: 0,
        });
        const sprite = new THREE.Sprite(material);
        sprite.renderOrder = 20;
        sprite.scale.set(1.05, 1.05, 1);
        this.world.scene.add(sprite);
        marker = { sprite, on: true };
        this.markers.set(t.id, marker);
      }
      marker.on = true;
      const [x, , z] = toWorld(t.x, t.y);
      marker.sprite.position.set(x, t.height, z);
    }
  }

  update(dt: number, _time: number) {
    for (const [id, marker] of this.markers) {
      const material = marker.sprite.material;
      material.opacity +=
        ((marker.on ? 1 : 0) - material.opacity) * Math.min(1, dt * 18);
      if (!marker.on && material.opacity < 0.01) {
        this.world.scene.remove(marker.sprite);
        material.dispose();
        this.markers.delete(id);
      }
    }
  }

  dispose() {
    for (const { sprite } of this.markers.values()) {
      this.world.scene.remove(sprite);
      sprite.material.dispose();
    }
    this.markers.clear();
    this.texture.dispose();
  }
}

/** The camera layer of the ghost's figures for the x-ray pass. */
export const GHOST_LAYER = 2;

/** Translucent preview of the troops a card would place, or of where a
 *  spell would land. */
export class Ghost {
  readonly group = new THREE.Group();
  private card: CardId | null = null;
  private okMat = new THREE.MeshBasicMaterial({
    color: '#d6e6ff',
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  private badMat = new THREE.MeshBasicMaterial({
    color: '#ff5a4a',
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  private circle: THREE.Mesh;
  private area: THREE.Mesh;
  /** A faint line from the finger to the spot the card snapped to. */
  private tether: THREE.Mesh;
  /** The side placing the card; side 1 faces and forms up the other way. */
  side: Side = 0;
  /** How much larger than its footprint a figure is drawn (the troops'). */
  private figureScale = TROOP_SCALE;

  constructor(private world: ArenaWorld) {
    this.area = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: teamColours[0].light,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.area.position.y = 0.055;
    this.circle = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: teamColours[0].light,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.circle.position.y = 0.06;
    this.group.visible = false;
    world.scene.add(this.group);
    // A unit strip along +z from its origin, stretched to the finger.
    this.tether = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshBasicMaterial({
        color: teamColours[0].light,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.tether.visible = false;
    world.scene.add(this.tether);
  }

  /** Figures drawn at a new size: the ghost follows the troops. */
  setScale(scale: number) {
    if (scale === this.figureScale) return;
    this.figureScale = scale;
    this.card = null;
  }

  /** Preview copies own their cloned skeleton textures; their geometry,
   *  source materials and library textures still belong to the assets. */
  private clear() {
    const skeletons = new Set<THREE.Skeleton>();
    this.group.traverse((node) => {
      const mesh = node as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
    });
    for (const skeleton of skeletons) skeleton.dispose();
    this.group.clear();
  }

  /** Shows the card at (x, y); `from` is the finger's field point when the
   *  card snapped elsewhere. */
  show(
    card: CardId | null,
    x: number,
    y: number,
    ok: boolean,
    from?: [number, number],
  ) {
    this.tether.visible = false;
    if (!card) {
      this.group.visible = false;
      return;
    }
    if (card !== this.card && isSpell(card)) {
      // A spell: the blast circle it will hit.
      this.card = card;
      this.clear();
      const r = spellCards[card].spell.radius;
      this.circle.scale.setScalar(r);
      this.area.scale.setScalar(r);
      this.group.add(this.circle, this.area);
    } else if (card !== this.card && !isSpell(card)) {
      this.card = card;
      this.clear();
      const c = troopCards[card];
      // The collector figure where one is built, else the older model.
      const { figures, troops } = this.world.assets;
      const figure = !!figures?.scene.getObjectByName(card);
      const known = figure || !!troops.scene.getObjectByName(card);
      for (const [ox, oy] of c.formation) {
        const model = this.world.instance(
          figure && figures ? figures : troops,
          known ? card : 'archers',
          0,
        );
        model.traverse((n) => {
          const mesh = n as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = false;
            mesh.userData.ghost = true;
            // The ghost shows through towers too (view.ts, x-ray pass).
            mesh.layers.enable(GHOST_LAYER);
          }
        });
        model.position.set(ox, c.unit.flying ? FLY_HEIGHT : 0, -oy);
        model.scale.set(
          ...figureDimensions(
            this.figureScale * (known ? figureSize(card) : 1),
          ),
        );
        this.group.add(model);
      }
      const reach = c.formation.length > 1 ? 0.7 : 0;
      this.circle.scale.setScalar(c.unit.radius + reach);
      this.group.add(this.circle);
    }
    this.group.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.ghost)
        mesh.material = ok ? this.okMat : this.badMat;
    });
    (this.area.material as THREE.MeshBasicMaterial).color.set(
      ok ? teamColours[0].light : '#ff5a4a',
    );
    const [wx, , wz] = toWorld(x, y);
    this.group.position.set(wx, 0, wz);
    this.group.rotation.y = this.side === 1 ? Math.PI : 0;
    this.group.visible = true;
    if (from) {
      const [fx, , fz] = toWorld(from[0], from[1]);
      const dx = fx - wx;
      const dz = fz - wz;
      const length = Math.hypot(dx, dz);
      if (length > 0.6) {
        this.tether.position.set(wx, 0.05, wz);
        this.tether.rotation.y = Math.atan2(dx, dz);
        this.tether.scale.set(0.11, 1, length);
        this.tether.visible = true;
      }
    }
  }

  dispose() {
    this.clear();
    this.world.scene.remove(this.group, this.tether);
    this.tether.geometry.dispose();
    (this.tether.material as THREE.Material).dispose();
    this.okMat.dispose();
    this.badMat.dispose();
    this.area.geometry.dispose();
    (this.area.material as THREE.Material).dispose();
  }
}

// ------------------------------------------- abilities of 1 October 2026
// The eight troops' ability visuals (figures agent): the Drummer's beat,
// the Sumo's stomp, the Firefighter's water jet, the Explorer's frost on
// what it slows, the Diver's armour sparks, the Linebacker's tackle and
// every knock-back, the Jetpack's exhaust and the Beekeeper's smoke.
// The bees themselves are ordinary figures (figure_bee.py, moves/bee.ts).

/** A ground ring that grows and fades: one InstancedMesh per look, the
 *  fade written into the instance colour (additive blending). */
class RingPulses {
  readonly mesh: THREE.InstancedMesh;
  private list: {
    x: number;
    y: number;
    z: number;
    r0: number;
    r1: number;
    life: number;
    age: number;
    c: THREE.Color;
  }[] = [];
  private m = new THREE.Matrix4();
  private c = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    inner: number,
    private max = 48,
  ) {
    const geometry = new THREE.RingGeometry(inner, 1, 48).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(max * 3),
      3,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  add(
    x: number,
    y: number,
    z: number,
    r0: number,
    r1: number,
    life: number,
    colour: THREE.ColorRepresentation,
  ) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      x,
      y,
      z,
      r0,
      r1,
      life,
      age: 0,
      c: new THREE.Color(colour),
    });
  }

  update(dt: number) {
    this.list = this.list.filter((p) => (p.age += dt) < p.life);
    this.list.forEach((p, i) => {
      const t = p.age / p.life;
      const r = p.r0 + (p.r1 - p.r0) * (1 - (1 - t) * (1 - t));
      this.m.makeScale(r, 1, r).setPosition(p.x, p.y, p.z);
      this.mesh.setMatrixAt(i, this.m);
      const fade = Math.min(1, t * 6) * (1 - t) * (1 - t);
      this.mesh.setColorAt(i, this.c.copy(p.c).multiplyScalar(fade));
    });
    this.mesh.count = this.list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

const jetVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
/** Streaks of water racing out along the cone, brightest at its core and
 *  breaking up toward the end. */
const jetFragment = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uFade;
  void main() {
    float along = vUv.y;
    float streak = 0.5 + 0.5 * sin(vUv.x * 40.0 + sin(vUv.x * 13.0) * 2.0);
    float flow = 0.5 + 0.5 * sin(along * 18.0 - uTime * 26.0 + vUv.x * 9.0);
    float a = (0.5 + 0.5 * streak * flow) * smoothstep(0.0, 0.08, along) *
      (1.0 - smoothstep(0.7, 1.0, along)) * uFade;
    gl_FragColor = vec4(mix(vec3(0.5, 0.78, 1.0), vec3(1.0), flow * 0.55),
      a * 0.78);
  }`;

/** Where a drawn troop is: its feet on the ground and its chest (where
 *  shots land, raised with a flyer's body), or null. */
export type TroopSpot = (
  id: number,
) => { at: THREE.Vector3; chest: THREE.Vector3; head?: THREE.Vector3 } | null;

export class AbilityEffects {
  private statuses: TroopStatuses;
  private motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  private beats: RingPulses;
  private shocks: RingPulses;
  private chills: RingPulses;
  private jets = new Map<
    number,
    { mesh: THREE.Mesh; life: number; material: THREE.ShaderMaterial }
  >();
  private jetGeometry: THREE.CylinderGeometry;
  private time = 0;
  private puff = 0;
  /** World units per figure unit: the troops' drawn scale (troopScale
   *  in layout.ts, larger on portrait phones). */
  size = TROOP_SCALE;

  constructor(
    private world: ArenaWorld,
    private particles: Particles,
  ) {
    this.statuses = new TroopStatuses(world.scene, world.camera);
    this.beats = new RingPulses(world.scene, 0.9);
    this.shocks = new RingPulses(world.scene, 0.72, 16);
    this.chills = new RingPulses(world.scene, 0.55, 96);
    // An open cone along +z from its tip at the origin to its mouth at 1.
    this.jetGeometry = new THREE.CylinderGeometry(1, 0.06, 1, 20, 1, true)
      .translate(0, 0.5, 0)
      .rotateX(Math.PI / 2);
  }

  heal(ids: number[]) {
    this.statuses.heal(ids);
  }

  hud(height: number, trackHeight: number) {
    this.statuses.hud(height, trackHeight);
  }

  /** The Drummer's beat: a ring of his team's light colour sweeping out
   *  to the edge of his aura, a few golden sparkles over the drum. */
  beat(x: number, z: number, radius: number, team: Team) {
    const y = standHeight(x, z) + 0.07;
    this.beats.add(x, y, z, 0.4, radius, 0.55, teamColours[team].light);
    this.particles.glow.add({
      x: x + rand(-0.2, 0.2),
      y: standHeight(x, z) + 0.75 * this.size,
      z: z + rand(-0.2, 0.2),
      vy: 0.9,
      life: 0.45,
      size: rand(0.12, 0.2),
      r: 1,
      g: 0.86,
      b: 0.4,
    });
  }

  /** The Sumo's landing stomp: a heavy shock ring out to the taunt's
   *  reach, dust thrown up all round and a flash of his team's colour. */
  stomp(x: number, z: number, radius: number, team: Team) {
    const y = standHeight(x, z) + 0.08;
    this.shocks.add(x, y, z, 0.5, radius, 0.7, '#fff1d6');
    this.shocks.add(x, y, z, 0.3, radius * 0.7, 0.5, teamColours[team].main);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.particles.dust(
        x + Math.cos(a) * 0.9,
        0.05,
        z + Math.sin(a) * 0.9,
        1,
        undefined,
        1.4,
      );
    }
  }

  /** A taunted troop: a red flick over its head now and then. */
  private taunted(p: THREE.Vector3, high: number) {
    this.particles.glow.add({
      x: p.x + rand(-0.15, 0.15),
      y: p.y + high,
      z: p.z + rand(-0.15, 0.15),
      vy: 0.6,
      life: 0.35,
      size: rand(0.12, 0.18),
      r: 1,
      g: 0.3,
      b: 0.2,
    });
  }

  /** The Firefighter's blow: the jet from his nozzle to (bx, bz), the cone
   *  `cos` wide, held on until the next blow; spray and a splash where it
   *  lands. */
  spray(
    id: number,
    ax: number,
    az: number,
    bx: number,
    bz: number,
    cos: number,
  ) {
    let jet = this.jets.get(id);
    if (!jet) {
      const material = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
        vertexShader: jetVertex,
        fragmentShader: jetFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.jetGeometry, material);
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      this.world.scene.add(mesh);
      jet = { mesh, life: 0, material };
      this.jets.set(id, jet);
    }
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return;
    const ux = dx / len;
    const uz = dz / len;
    // The nozzle's mouth: ahead of him at hip height.
    const nx = ax + ux * 0.5 * this.size;
    const nz = az + uz * 0.5 * this.size;
    const ny = standHeight(ax, az) + 0.72 * this.size;
    const reach = Math.max(0.5, len - 0.5 * this.size);
    // Wide enough to read as the cone that hits, narrower than its edge.
    const half = Math.acos(Math.max(-1, Math.min(1, cos)));
    const mouth = Math.tan(half) * reach * 0.55;
    jet.mesh.position.set(nx, ny, nz);
    jet.mesh.lookAt(nx + ux, ny - 0.5 / reach, nz + uz);
    jet.mesh.scale.set(mouth, mouth * 0.7, reach);
    jet.life = 0.5;
    // Droplets flung along the cone and falling.
    for (let i = 0; i < 16; i++) {
      const s = rand(4, 8);
      const spread = rand(-1, 1) * Math.tan(half) * 0.5;
      this.particles.glow.add({
        x: nx,
        y: ny,
        z: nz,
        vx: (ux - uz * spread) * s,
        vz: (uz + ux * spread) * s,
        vy: rand(0.4, 1.6),
        gravity: 7,
        drag: 0.9,
        life: rand(0.35, 0.6),
        size: rand(0.14, 0.24),
        r: 0.7,
        g: 0.88,
        b: 1,
        alpha: 0.9,
      });
    }
    // The splash where it lands, and spray mist.
    const ex = nx + ux * reach;
    const ez = nz + uz * reach;
    for (let i = 0; i < 9; i++) {
      const a = rand(0, Math.PI * 2);
      this.particles.smoke.add({
        x: ex + Math.cos(a) * 0.3,
        y: standHeight(ex, ez) + 0.2,
        z: ez + Math.sin(a) * 0.3,
        vx: Math.cos(a) * rand(0.6, 1.6) + ux * 1.2,
        vz: Math.sin(a) * rand(0.6, 1.6) + uz * 1.2,
        vy: rand(0.6, 1.8),
        drag: 2.4,
        life: rand(0.4, 0.7),
        size: rand(0.4, 0.7),
        grow: 0.8,
        r: 0.88,
        g: 0.95,
        b: 1,
        alpha: 0.6,
      });
    }
  }

  /** The Diver's armour turning a blow: bright metal sparks off brass. */
  armour(x: number, y: number, z: number, amount: number) {
    const n = Math.min(16, 6 + Math.round(amount / 6));
    this.particles.sparks(x, y, z, n, [1, 0.93, 0.62]);
    this.particles.glow.add({
      x,
      y,
      z,
      life: 0.16,
      size: 0.9,
      grow: -0.5,
      r: 1,
      g: 0.95,
      b: 0.8,
    });
  }

  /** The Linebacker's tackle landing: a burst of dust, white stars and a
   *  ring at the spot. */
  tackle(x: number, z: number) {
    const y = standHeight(x, z);
    this.particles.dust(x, y + 0.05, z, 14, undefined, 1.3);
    this.particles.sparks(x, y + 0.6 * this.size, z, 10, [1, 1, 0.9]);
    this.shocks.add(x, y + 0.08, z, 0.2, 1.4, 0.4, '#fff4dc');
  }

  /** A troop knocked back (a slap, a tackle, the jet): a skid of dust. */
  push(x: number, z: number, fx = x, fz = z) {
    // A trail along the actual impulse, rather than a puff at its endpoint.
    const distance = Math.hypot(x - fx, z - fz);
    const steps = Math.max(1, Math.min(6, Math.ceil(distance * 4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = fx + (x - fx) * t;
      const pz = fz + (z - fz) * t;
      this.particles.dust(
        px,
        standHeight(px, pz) + 0.02,
        pz,
        2,
        undefined,
        0.55,
      );
    }
  }

  /** The Beekeeper lets out her bees: a puff of grey smoke from the
   *  smoker and the hive. */
  release(x: number, z: number) {
    this.particles.smokePuff(x, standHeight(x, z) + 0.75 * this.size, z, 0.55);
  }

  /** Per frame: frost on slowed troops, a red flick over taunted ones,
   *  the Jetpack's exhaust, and the water jets fading out. */
  update(dt: number, m: Match, spot: TroopSpot) {
    this.time += dt;
    this.puff += dt;
    const tick = this.puff >= 0.05;
    if (tick) this.puff = 0;
    this.statuses.size = this.size;
    this.statuses.begin(dt, this.motion?.matches ?? false);
    for (const u of m.units) {
      const where = spot(u.id);
      if (!where) continue;
      const p = where.at;
      const s = troopCards[u.card].unit;
      this.statuses.show(u, s, where.head ?? where.chest);
      if (u.state === 'deploying') continue;
      const flyer = s.flying;
      // The body's height off the ground (a flyer's hover), from its
      // chest as TroopView.chest() places it.
      const body = flyer
        ? where.chest.y - p.y - FLY_HEIGHT * (this.size / 1.3) * 0.6
        : 0;
      const high = body + 1.35 * this.size;
      if (u.slow > 0 && tick) {
        // A ring of frost on the ground and flakes drifting round it.
        const y = flyer ? 0.07 : standHeight(p.x, p.z) + 0.07;
        const k = s.radius * (this.size / 1.3);
        if (Math.random() < 0.35)
          this.chills.add(p.x, y, p.z, k * 1.0, k * 1.35, 0.6, '#4f9fc4');
        const a = rand(0, Math.PI * 2);
        const r = s.radius * this.size * rand(0.45, 0.8);
        this.particles.glow.add({
          x: p.x + Math.cos(a) * r,
          y: p.y + body + rand(0.15, 1.1) * this.size,
          z: p.z + Math.sin(a) * r,
          vy: -rand(0.2, 0.5),
          vx: -Math.sin(a) * 0.5,
          vz: Math.cos(a) * 0.5,
          life: rand(0.5, 0.8),
          size: rand(0.14, 0.22),
          r: 0.75,
          g: 0.93,
          b: 1,
        });
      }
      if (u.taunt > 0 && tick && Math.random() < 0.25) this.taunted(p, high);
      if (u.card === 'jetpack' && tick) {
        // Two flames under the pack and grey smoke drifting off.
        for (const side of [-1, 1]) {
          this.particles.glow.add({
            x: p.x + side * 0.12 * this.size + rand(-0.03, 0.03),
            y: p.y + body + 0.6 * this.size,
            z: p.z + rand(-0.03, 0.03),
            vy: -rand(1.5, 2.5),
            life: 0.18,
            size: rand(0.16, 0.24) * this.size,
            grow: -0.12,
            r: 1,
            g: rand(0.55, 0.75),
            b: 0.2,
          });
        }
        if (Math.random() < 0.5)
          this.particles.smoke.add({
            x: p.x,
            y: p.y + body + 0.45 * this.size,
            z: p.z,
            vy: -0.6,
            vx: rand(-0.3, 0.3),
            vz: rand(-0.3, 0.3),
            drag: 1.5,
            life: 0.8,
            size: 0.25,
            grow: 0.7,
            r: 0.85,
            g: 0.85,
            b: 0.88,
            alpha: 0.3,
          });
      }
    }
    this.statuses.end();
    for (const [id, jet] of this.jets) {
      jet.life -= dt;
      jet.material.uniforms.uTime.value = this.time;
      jet.material.uniforms.uFade.value = Math.max(
        0,
        Math.min(1, jet.life * 5),
      );
      jet.mesh.visible = jet.life > 0;
      const alive = m.units.some((u) => u.id === id);
      if (!alive && jet.life <= 0) {
        jet.mesh.removeFromParent();
        jet.material.dispose();
        this.jets.delete(id);
      }
    }
    this.beats.update(dt);
    this.shocks.update(dt);
    this.chills.update(dt);
  }

  dispose() {
    this.statuses.dispose();
    this.beats.dispose();
    this.shocks.dispose();
    this.chills.dispose();
    for (const jet of this.jets.values()) {
      jet.mesh.removeFromParent();
      jet.material.dispose();
    }
    this.jets.clear();
    this.jetGeometry.dispose();
  }
}
