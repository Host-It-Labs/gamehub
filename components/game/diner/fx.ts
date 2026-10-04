import * as THREE from 'three';
import { glowTexture, puffTexture, starTexture } from './models';

/**
 * Diner's particles: steam off hot plates, grill smoke, sparkles, goo
 * droplets, soap bubbles and angry puffs. One point cloud per texture, so
 * a busy rush still costs three draw calls.
 */
export type Kind =
  | 'steam'
  | 'smoke'
  | 'spark'
  | 'goo'
  | 'bubble'
  | 'anger'
  | 'gold'
  | 'dust';

type P = {
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
  a: number;
  gravity: number;
  drag: number;
};

const VERT = /* glsl */ `
attribute float size;
attribute vec4 tint;
varying vec4 vTint;
uniform float scale;
void main() {
  vTint = tint;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale;
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vTint;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vTint.rgb, vTint.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
}`;

class Cloud {
  readonly points: THREE.Points;
  private list: P[] = [];
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private size: Float32Array;
  private tint: Float32Array;
  readonly material: THREE.ShaderMaterial;
  constructor(
    private max: number,
    map: THREE.Texture,
    additive: boolean,
  ) {
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.tint = new Float32Array(max * 4);
    this.geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geo.setAttribute(
      'size',
      new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.geo.setAttribute(
      'tint',
      new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage),
    );
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, scale: { value: 40 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  add(p: P) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(p);
  }
  update(dt: number) {
    let n = 0;
    for (const p of this.list) {
      p.age += dt;
      p.vy -= p.gravity * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.vy *= p.gravity ? 1 : k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.02 && p.gravity) {
        p.y = 0.02;
        p.vy *= -0.3;
        p.vx *= 0.5;
        p.vz *= 0.5;
      }
    }
    this.list = this.list.filter((p) => p.age < p.life);
    for (const p of this.list) {
      const t = p.age / p.life;
      this.pos[n * 3] = p.x;
      this.pos[n * 3 + 1] = p.y;
      this.pos[n * 3 + 2] = p.z;
      this.size[n] = p.size * (1 + p.grow * t);
      const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      this.tint.set([p.r, p.g, p.b, p.a * fade], n * 4);
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const name of ['position', 'size', 'tint'])
      this.geo.getAttribute(name).needsUpdate = true;
  }
  clear() {
    this.list = [];
  }
  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}

const colours: Record<Kind, string> = {
  steam: '#ffffff',
  smoke: '#4b4650',
  spark: '#fff1b8',
  goo: '#8b4dff',
  bubble: '#d8f3ff',
  anger: '#ff4a3d',
  gold: '#ffd35a',
  dust: '#f3e3c3',
};

export class Effects {
  readonly group = new THREE.Group();
  private soft: Cloud;
  private puffs: Cloud;
  private stars: Cloud;
  private textures: THREE.Texture[];
  /** Fewer particles under reduced motion. */
  calm = false;
  constructor() {
    const glow = glowTexture(),
      puff = puffTexture(),
      star = starTexture();
    this.textures = [glow, puff, star];
    this.soft = new Cloud(260, glow, false);
    this.puffs = new Cloud(220, puff, false);
    this.stars = new Cloud(160, star, true);
    this.group.add(this.puffs.points, this.soft.points, this.stars.points);
  }
  setScale(pixels: number) {
    for (const c of [this.soft, this.puffs, this.stars])
      c.material.uniforms.scale.value = pixels;
  }

  emit(
    kind: Kind,
    x: number,
    y: number,
    z: number,
    o: {
      count?: number;
      spread?: number;
      speed?: number;
      size?: number;
      colour?: string;
      up?: number;
    } = {},
  ) {
    const count = Math.max(
      1,
      Math.round((o.count ?? 1) * (this.calm ? 0.35 : 1)),
    );
    const c = new THREE.Color(o.colour ?? colours[kind]);
    const cloud =
      kind === 'steam' ||
      kind === 'smoke' ||
      kind === 'anger' ||
      kind === 'dust'
        ? this.puffs
        : kind === 'spark' || kind === 'gold'
          ? this.stars
          : this.soft;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spread = o.spread ?? 0.1;
      const speed = (o.speed ?? 1) * (0.6 + Math.random() * 0.8);
      const p: P = {
        x: x + Math.cos(a) * spread * Math.random(),
        y,
        z: z + Math.sin(a) * spread * Math.random(),
        vx: 0,
        vy: 0,
        vz: 0,
        life: 1,
        age: 0,
        size: o.size ?? 0.2,
        grow: 0,
        r: c.r,
        g: c.g,
        b: c.b,
        a: 1,
        gravity: 0,
        drag: 0,
      };
      switch (kind) {
        case 'steam':
          p.vy = 0.45 * speed + (o.up ?? 0);
          p.vx = (Math.random() - 0.5) * 0.15;
          p.life = 1.1 + Math.random() * 0.6;
          p.grow = 1.6;
          p.a = 0.45;
          break;
        case 'smoke':
          p.vy = 0.35 * speed;
          p.vx = (Math.random() - 0.5) * 0.2;
          p.life = 1.6 + Math.random() * 0.8;
          p.grow = 2.4;
          p.a = 0.7;
          break;
        case 'anger':
          p.vy = 0.6 * speed;
          p.vx = (Math.random() - 0.5) * 0.4;
          p.life = 0.7;
          p.grow = 1.2;
          p.a = 0.85;
          break;
        case 'dust':
          p.vx = Math.cos(a) * 0.6 * speed;
          p.vz = Math.sin(a) * 0.6 * speed;
          p.vy = 0.15;
          p.drag = 3;
          p.life = 0.6;
          p.grow = 1.5;
          p.a = 0.6;
          break;
        case 'spark':
        case 'gold':
          p.vx = Math.cos(a) * 1.4 * speed;
          p.vz = Math.sin(a) * 1.4 * speed;
          p.vy = (1.2 + Math.random()) * speed;
          p.gravity = 3.5;
          p.drag = 1.5;
          p.life = 0.7 + Math.random() * 0.4;
          break;
        case 'goo':
          p.vx = Math.cos(a) * 2.2 * speed;
          p.vz = Math.sin(a) * 2.2 * speed;
          p.vy = (1.6 + Math.random() * 1.6) * speed;
          p.gravity = 7;
          p.drag = 0.6;
          p.life = 0.9 + Math.random() * 0.5;
          p.size *= 0.7 + Math.random() * 0.8;
          break;
        case 'bubble':
          p.vy = 0.5 * speed;
          p.vx = (Math.random() - 0.5) * 0.3;
          p.life = 0.9 + Math.random() * 0.5;
          p.a = 0.8;
          break;
      }
      cloud.add(p);
    }
  }

  update(dt: number) {
    this.soft.update(dt);
    this.puffs.update(dt);
    this.stars.update(dt);
  }
  clear() {
    this.soft.clear();
    this.puffs.clear();
    this.stars.clear();
  }
  dispose() {
    this.soft.dispose();
    this.puffs.dispose();
    this.stars.dispose();
    for (const t of this.textures) t.dispose();
  }
}
