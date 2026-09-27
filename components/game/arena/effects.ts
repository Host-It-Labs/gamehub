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
import { FLY_HEIGHT, TROOP_SCALE } from './troops';
import { TOWER_SCALE, type ArenaWorld } from './world';

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

export class Particles {
  readonly glow: ParticleLayer;
  readonly smoke: ParticleLayer;
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
    };
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
  sync(m: Match, alpha: number, targetHeight: (id: number) => number) {
    const seen = new Set<number>();
    for (const p of m.projectiles) {
      seen.add(p.id);
      let mesh = this.meshes.get(p.id);
      if (!mesh) {
        // Shots wear the shooter's colour as the viewer sees it.
        const team: Team = p.side === this.world.viewSide ? 0 : 1;
        this.team.set(p.id, team);
        mesh = this.kinds[p.kind](team);
        mesh.castShadow = p.kind !== 'fire' && p.kind !== 'laser';
        mesh.scale.setScalar(this.size);
        this.meshes.set(p.id, mesh);
        this.world.scene.add(mesh);
        if (p.kind === 'fire') {
          const glow = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
          glow.renderOrder = 4;
          this.glows.set(p.id, glow);
          this.world.scene.add(glow);
        }
      }
      this.place(mesh, p, alpha, targetHeight(p.targetId));
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
        const glow = this.glows.get(id);
        if (glow) this.world.scene.remove(glow);
        this.glows.delete(id);
      }
  }

  private next = new THREE.Vector3();
  private place(
    mesh: THREE.Object3D,
    p: Projectile,
    alpha: number,
    endHeight: number,
  ) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const ahead = Math.min(d, p.speed * TICK * alpha);
    const fx = d > 0 ? p.x + (dx / d) * ahead : p.x;
    const fy = d > 0 ? p.y + (dy / d) * ahead : p.y;
    const t = Math.min(1, (p.travelled + ahead) / Math.max(0.01, p.distance));
    // Rays and bullets fly straight; balls and bombs lob.
    const arc =
      p.kind === 'cannon'
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
    const fall = p.kind === 'bomb' ? t * t : t;
    const tower = this.world.towers.get(p.sourceId);
    const startHeight = tower
      ? tower.kind === 'king'
        ? p.sz * TOWER_SCALE
        : p.sz - tower.guardDrop
      : p.sz;
    const h = startHeight + (endHeight - startHeight) * fall + lift;
    const [wx, , wz] = toWorld(fx, fy);
    // Aim along the path, a little ahead.
    const t2 = Math.min(1, t + 0.04);
    const fall2 = p.kind === 'bomb' ? t2 * t2 : t2;
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
    if (this.next.distanceToSquared(mesh.position) > 1e-6)
      mesh.lookAt(this.next);
    this.particles.trail(
      wx,
      h,
      wz,
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

/**
 * Falling Meteors. Each is drawn from the engine's spell (its time left), so
 * it lands exactly on the crash: a glowing rock streaking down out of the
 * light with a fiery trail, and on the mat a ring in the caster's colour
 * that tightens as it comes.
 */
export class SpellViews {
  private views = new Map<
    number,
    {
      rock: THREE.Object3D;
      ring: THREE.Mesh;
      disc: THREE.Mesh;
      spin: THREE.Vector3;
    }
  >();
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

  private rock() {
    const { towers } = this.world.assets;
    if (towers.scene.getObjectByName('meteor'))
      return this.world.instance(towers, 'meteor', 0);
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
        v = {
          rock,
          ring,
          disc,
          spin: new THREE.Vector3(rand(-4, 4), rand(-4, 4), rand(-4, 4)),
        };
        this.views.set(sp.id, v);
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
    v: {
      rock: THREE.Object3D;
      ring: THREE.Mesh;
      disc: THREE.Mesh;
      spin: THREE.Vector3;
    },
    sp: Spell,
    alpha: number,
    time: number,
    turn: number,
  ) {
    const left = Math.max(0, sp.left - alpha * TICK);
    const t = 1 - left / Math.max(0.01, sp.delay);
    const [wx, , wz] = toWorld(sp.x, sp.y);
    // In from high up, out of the window's light, falling faster and faster.
    const k = t * t;
    const from = new THREE.Vector3(wx - 9 * turn, 24, wz + 7 * turn);
    const x = from.x + (wx - from.x) * k;
    const y = from.y + (0.4 - from.y) * k;
    const z = from.z + (wz - from.z) * k;
    v.rock.position.set(x, y, z);
    v.rock.rotation.set(time * v.spin.x, time * v.spin.y, time * v.spin.z);
    const size = 1.1 + t * 0.4;
    v.rock.scale.setScalar(size);
    for (let i = 0; i < 3; i++)
      this.particles.trail(
        x + rand(-0.3, 0.3),
        y + rand(-0.3, 0.3),
        z + rand(-0.3, 0.3),
        'fire',
      );
    if (Math.random() < 0.5)
      this.particles.smoke.add({
        x,
        y: y + 0.3,
        z,
        vy: 0.3,
        life: 0.7,
        size: 0.5,
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
  refresh(m: Match, side: Side, spell = false) {
    const key = `${spell ? 's' : 't'}${m.towers.map((t) => (t.destroyed ? 1 : 0)).join('')}`;
    if (key === this.key) return;
    this.key = key;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        // Row 0 of the texture is the bottom of the plane (your side).
        const x = (c + 0.5) / 2;
        const y = LENGTH - (r + 0.5) / 2;
        const ok = spell || canDeployAt(m, side, x, LENGTH - y) ? 255 : 0;
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

/**
 * The placement warning: while a troop card is held, every enemy tower and
 * troop that would shoot it where it would land shows its reach as a red
 * ring on the ground, a dashed edge turning slowly over a faint fill. Rings
 * fade in and out as the finger moves.
 */
export class ThreatRings {
  private geometry = new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2);
  private base = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uR: { value: 1 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vP;
      void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uOpacity, uR;
      varying vec2 vP;
      void main() {
        float d = length(vP);
        // The edge is about 0.14 tiles wide whatever the ring's size.
        float w = 0.14 / uR;
        float edge = smoothstep(1.0 - w * 1.6, 1.0 - w, d) * (1.0 - smoothstep(0.995, 1.0, d));
        float a = atan(vP.y, vP.x);
        float dash = step(0.42, fract(a * uR * 0.9 / 6.2831 * 6.0 + uTime * 0.35));
        float fill = 0.14 * smoothstep(0.0, 1.0, d);
        float alpha = (edge * (0.55 + 0.45 * dash) + fill) * uOpacity;
        gl_FragColor = vec4(vec3(1.0, 0.3, 0.24), alpha);
      }`,
  });
  private rings = new Map<
    number,
    { mesh: THREE.Mesh; material: THREE.ShaderMaterial; on: boolean }
  >();

  constructor(private world: ArenaWorld) {}

  /** Show the rings for these threats (`[]` hides them all). */
  show(threats: { id: number; x: number; y: number; reach: number }[]) {
    for (const ring of this.rings.values()) ring.on = false;
    for (const t of threats) {
      let ring = this.rings.get(t.id);
      if (!ring) {
        const material = this.base.clone();
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.renderOrder = 5;
        this.world.scene.add(mesh);
        ring = { mesh, material, on: true };
        this.rings.set(t.id, ring);
      }
      ring.on = true;
      const [wx, , wz] = toWorld(t.x, t.y);
      ring.mesh.position.set(wx, 0.09, wz);
      ring.mesh.scale.setScalar(t.reach);
      ring.material.uniforms.uR.value = t.reach;
    }
  }

  update(dt: number, time: number) {
    for (const [id, ring] of this.rings) {
      const u = ring.material.uniforms;
      const k = Math.min(1, dt * 14);
      u.uOpacity.value += ((ring.on ? 1 : 0) - u.uOpacity.value) * k;
      u.uTime.value = time;
      ring.mesh.visible = u.uOpacity.value > 0.01;
      if (!ring.on && !ring.mesh.visible) {
        this.world.scene.remove(ring.mesh);
        ring.material.dispose();
        this.rings.delete(id);
      }
    }
  }

  dispose() {
    for (const ring of this.rings.values()) {
      this.world.scene.remove(ring.mesh);
      ring.material.dispose();
    }
    this.rings.clear();
    this.geometry.dispose();
    this.base.dispose();
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
      this.group.clear();
      const r = spellCards[card].spell.radius;
      this.circle.scale.setScalar(r);
      this.area.scale.setScalar(r);
      this.group.add(this.circle, this.area);
    } else if (card !== this.card && !isSpell(card)) {
      this.card = card;
      this.group.clear();
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
        model.scale.set(...figureDimensions(this.figureScale));
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
    this.world.scene.remove(this.group, this.tether);
    this.tether.geometry.dispose();
    (this.tether.material as THREE.Material).dispose();
    this.okMat.dispose();
    this.badMat.dispose();
    this.area.geometry.dispose();
    (this.area.material as THREE.Material).dispose();
  }
}
