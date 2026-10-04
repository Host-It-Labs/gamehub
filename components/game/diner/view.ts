import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  dishes,
  stationDish,
  type NightId,
  type StationId,
} from '@/lib/games/diner/content';
import type {
  DinerEvent,
  Group,
  Guest,
  Match,
  UseAction,
} from '@/lib/games/diner/engine';
import {
  boothHz,
  COUNTER_X,
  COUNTER_Z,
  D,
  DOOR_GAP,
  DOOR_IN,
  QUEUE,
  seatOffset,
  W,
} from '@/lib/games/diner/layout';
import type { Rung } from '../arena/pacer';
import { Effects } from './fx';
import { Kit, makeMaterials, meshes, type Materials } from './kit';
import {
  basketMesh,
  buildShell,
  C,
  disposeCache,
  gooFigure,
  guestFigure,
  pattyMesh,
  propMesh,
  puddleMesh,
  SEAT_COLOURS,
  shakeCupMesh,
  waiterFigure,
  type Figure,
  type Prop,
  type Shell,
} from './models';

/** Where the stage sits on the canvas, in CSS pixels. */
export type Frame = {
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** Figures are drawn a little larger than life so outfits read on phones. */
const GUEST_SCALE = 1.3;
const ELEVATION = (52 * Math.PI) / 180;

type Actor = {
  figure: Figure;
  yaw: number;
  phase: number;
  seat: number;
  goo: boolean;
  hop: number;
  shake: number;
  prop: Prop | null;
  propMesh: THREE.Object3D | null;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angleTo = (from: number, to: number, k: number) => {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
};

/**
 * The 3D diner: builds the room for a night, keeps a figure for every
 * waiter and guest, animates them between the simulation's steps, and turns
 * events into steam, sparkles, goo and swinging doors. Numbers and bubbles
 * are DOM, positioned through `project`.
 */
export class DinerView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private mats: Materials;
  private shell: Shell;
  private fx = new Effects();
  private sun: THREE.DirectionalLight;
  private neonLight: THREE.PointLight;
  private jukeLight: THREE.PointLight;
  private waiters: Actor[] = [];
  private guests = new Map<number, Actor>();
  private puddles = new Map<number, THREE.Object3D>();
  private stationProps = new Map<
    StationId,
    {
      cook: THREE.Object3D | null;
      ready: THREE.Object3D | null;
      burnt: THREE.Object3D | null;
    }
  >();
  private tableProps = new Map<number, THREE.Group>();
  private tableKey = new Map<number, string>();
  private useRing: THREE.Mesh;
  private outRing: THREE.Mesh;
  private markers: THREE.Mesh[] = [];
  private mop: THREE.Group;
  private env: THREE.Texture;
  private ringGeo = new THREE.RingGeometry(0.42, 0.52, 40);
  private discGeo = new THREE.CircleGeometry(0.42, 32);
  private extra: { dispose: () => void }[] = [];
  private doorOpen = 0;
  private binOpen = 0;
  private flicker = 0;
  private shadowEvery: 1 | 2 = 1;
  private frames = 0;
  private basePixelRatio: number;
  pixelsPerUnit = 30;
  private time = 0;
  you = 0;

  constructor(
    canvas: HTMLCanvasElement,
    readonly night: NightId,
    tables: number[],
    stations: StationId[],
    players: number,
    pixelRatio: number,
  ) {
    this.basePixelRatio = pixelRatio;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(
      night === 1 ? '#1a1630' : night === 2 ? '#0c1226' : '#080a1a',
    );
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.32;
    this.mats = makeMaterials();

    // Light: a warm key from above the front left, the night's cool fill,
    // and the neon and jukebox colouring their corners.
    const hemi = new THREE.HemisphereLight('#aeb9ff', '#5a2a3a', 0.55);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#ffd9a8', 2.1);
    this.sun.position.set(W / 2 - 4, 11, D / 2 + 5);
    this.sun.target.position.set(W / 2, 0, D / 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -8.5;
    sc.right = 8.5;
    sc.top = 8.5;
    sc.bottom = -8.5;
    sc.near = 1;
    sc.far = 30;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.neonLight = new THREE.PointLight(C.pink, 4, 4.5, 1.6);
    this.neonLight.position.set(5.4, 1.75, 0.6);
    this.jukeLight = new THREE.PointLight('#ffb15c', 3, 4, 1.6);
    this.jukeLight.position.set(10.0, 1.2, 9.7);
    this.scene.add(this.neonLight, this.jukeLight);

    this.shell = buildShell(this.mats, night, stations, tables);
    this.scene.add(this.shell.group);
    for (const id of stations)
      this.stationProps.set(id, { cook: null, ready: null, burnt: null });
    this.scene.add(this.fx.group);

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#fff4cf',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    });
    this.useRing = new THREE.Mesh(this.ringGeo, ringMat);
    this.useRing.rotation.x = -Math.PI / 2;
    this.useRing.visible = false;
    this.useRing.renderOrder = 2;
    const outMat = new THREE.MeshBasicMaterial({
      color: '#ff3b4f',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      toneMapped: false,
    });
    this.outRing = new THREE.Mesh(this.ringGeo, outMat);
    this.outRing.rotation.x = -Math.PI / 2;
    this.outRing.visible = false;
    this.outRing.renderOrder = 2;
    this.scene.add(this.useRing, this.outRing);
    this.extra.push(ringMat, outMat);

    for (let i = 0; i < players; i++) {
      const figure = waiterFigure(this.mats, i);
      this.scene.add(figure.root);
      this.waiters.push({
        figure,
        yaw: 0,
        phase: 0,
        seat: -1,
        goo: false,
        hop: 0,
        shake: 0,
        prop: null,
        propMesh: null,
      });
      const mat = new THREE.MeshBasicMaterial({
        color: SEAT_COLOURS[i],
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        toneMapped: false,
      });
      const disc = new THREE.Mesh(this.discGeo, mat);
      disc.rotation.x = -Math.PI / 2;
      disc.renderOrder = 1;
      this.scene.add(disc);
      this.markers.push(disc);
      this.extra.push(mat);
    }
    const mk = new Kit();
    mk.cyl('paint', C.wood, 0.025, 0.025, 1.1, [0, 0.55, 0]);
    mk.cyl('paint', C.gold, 0.16, 0.2, 0.14, [0, 0.03, 0]);
    this.mop = meshes(mk.build(), this.mats);
    this.mop.visible = false;
    this.scene.add(this.mop);
  }

  /** Fits the whole diner inside the frame's free area. */
  resize(f: Frame) {
    const width = Math.max(1, f.width);
    const height = Math.max(1, f.height);
    this.renderer.setSize(width, height, false);
    const target = new THREE.Vector3(W / 2, 0, D / 2);
    const cam = this.camera;
    cam.position.set(
      target.x,
      target.y + Math.sin(ELEVATION) * 30,
      target.z + Math.cos(ELEVATION) * 30,
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse;
    const pts: [number, number, number][] = [
      [-0.25, -0.12, -0.25],
      [W + 0.25, -0.12, -0.25],
      [-0.25, 2.55, -0.25],
      [W + 0.25, 2.55, -0.25],
      [-0.35, -0.12, D + 0.3],
      [W + 0.35, -0.12, D + 0.3],
      [-0.3, 0.4, D + 0.2],
      [W + 0.3, 0.4, D + 0.2],
    ];
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    const v = new THREE.Vector3();
    for (const p of pts) {
      v.set(...p).applyMatrix4(inv);
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    const availW = Math.max(40, width - f.left - f.right);
    const availH = Math.max(40, height - f.top - f.bottom);
    const s = Math.max((x1 - x0) / availW, (y1 - y0) / availH) * 1.02;
    const rcx = f.left + availW / 2;
    const rcy = f.top + availH / 2;
    const bcx = (x0 + x1) / 2;
    const bcy = (y0 + y1) / 2;
    cam.left = bcx - rcx * s;
    cam.right = cam.left + width * s;
    cam.top = bcy + rcy * s;
    cam.bottom = cam.top - height * s;
    cam.near = 1;
    cam.far = 70;
    cam.updateProjectionMatrix();
    this.pixelsPerUnit = 1 / s;
    this.fx.setScale(this.pixelsPerUnit * this.renderer.getPixelRatio());
  }

  setRung(r: Rung) {
    this.renderer.setPixelRatio(this.basePixelRatio * r.resolution);
    this.shadowEvery = r.shadowEvery;
    if (this.sun.shadow.mapSize.x !== r.shadowSize) {
      const size = Math.min(2048, r.shadowSize);
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.fx.setScale(this.pixelsPerUnit * this.renderer.getPixelRatio());
  }

  set calm(on: boolean) {
    this.fx.calm = on;
  }

  /** A world point in CSS pixels on the canvas. */
  project(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    return { x: ((v.x + 1) / 2) * size.x, y: ((1 - v.y) / 2) * size.y };
  }

  // ------------------------------------------------------------ events

  handle(m: Match, events: DinerEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'cook': {
          const x = COUNTER_X[e.station];
          this.fx.emit(
            e.station === 'shake' ? 'bubble' : 'steam',
            x,
            1.2,
            0.8,
            { count: 6, spread: 0.2 },
          );
          break;
        }
        case 'ready': {
          const x = COUNTER_X[e.station];
          this.fx.emit('spark', x, 1.1, 1.15, {
            count: 10,
            speed: 0.6,
            size: 0.18,
          });
          this.fx.emit('steam', x, 1.05, 1.15, { count: 5, spread: 0.12 });
          break;
        }
        case 'burnt': {
          const x = COUNTER_X[e.station];
          this.fx.emit('smoke', x, 1.1, 0.9, {
            count: 14,
            spread: 0.3,
            size: 0.35,
          });
          break;
        }
        case 'take': {
          const x = COUNTER_X[e.station];
          this.fx.emit('dust', x, 1.0, 1.2, { count: 5, size: 0.14 });
          const w = this.waiters[e.player];
          if (w) w.hop = 1;
          break;
        }
        case 'serve': {
          const t = m.tables.find((s) => s.slot === e.table);
          if (t)
            this.fx.emit('spark', t.x, 0.9, t.z, {
              count: 12,
              size: 0.2,
              speed: 0.7,
            });
          const g = this.guests.get(e.guest);
          if (g) g.hop = 1;
          break;
        }
        case 'seat':
        case 'lead': {
          const w = this.waiters[e.player];
          if (w) w.hop = 1;
          break;
        }
        case 'order': {
          const t = m.tables.find((s) => s.slot === e.table);
          if (t)
            this.fx.emit('spark', t.x, 1.3, t.z, {
              count: 6,
              size: 0.14,
              speed: 0.4,
            });
          break;
        }
        case 'pay': {
          const t = m.tables.find((s) => s.slot === e.table);
          if (t)
            this.fx.emit('gold', t.x, 0.9, t.z, {
              count: 16,
              size: 0.2,
              speed: 0.8,
            });
          break;
        }
        case 'clear': {
          const t = m.tables.find((s) => s.slot === e.table);
          if (t) {
            this.fx.emit('gold', t.x, 0.9, t.z, { count: 10, size: 0.18 });
            this.fx.emit('dust', t.x, 0.8, t.z, { count: 6, size: 0.18 });
          }
          break;
        }
        case 'wash':
          this.fx.emit('bubble', COUNTER_X.sink, 1.05, 0.7, {
            count: 18,
            spread: 0.3,
            size: 0.14,
          });
          break;
        case 'bin':
          this.binOpen = 1;
          this.fx.emit('dust', COUNTER_X.bin, 0.7, 0.95, {
            count: 6,
            size: 0.18,
          });
          break;
        case 'storm':
          this.fx.emit('anger', e.x, 1.4, e.z, {
            count: 10,
            spread: 0.4,
            size: 0.3,
          });
          break;
        case 'wrong': {
          const g = this.guests.get(e.guest);
          if (g)
            this.fx.emit(
              'anger',
              g.figure.root.position.x,
              1.5,
              g.figure.root.position.z,
              { count: 8, size: 0.32 },
            );
          break;
        }
        case 'reveal': {
          this.fx.emit('goo', e.x, 0.7, e.z, { count: 34, size: 0.2 });
          this.fx.emit('spark', e.x, 1.0, e.z, {
            count: 16,
            size: 0.24,
            colour: '#d6b8ff',
          });
          const g = this.guests.get(e.guest);
          if (g) g.shake = 1;
          break;
        }
        case 'burst':
          this.fx.emit('goo', e.x, 0.8, e.z, {
            count: 44,
            size: 0.24,
            speed: 1.2,
          });
          this.fx.emit('smoke', e.x, 1.0, e.z, {
            count: 6,
            colour: '#7d3cff',
            size: 0.3,
          });
          break;
        case 'mopped': {
          const u = this.puddles.get(e.puddle);
          if (u)
            this.fx.emit('bubble', u.position.x, 0.2, u.position.z, {
              count: 14,
              spread: 0.4,
              size: 0.12,
            });
          break;
        }
        case 'deny': {
          const w = this.waiters[e.player];
          if (w) w.shake = 0.6;
          break;
        }
        case 'open':
          this.doorOpen = 1;
          break;
      }
    }
  }

  // ------------------------------------------------------------ frame

  private actor(x: Guest): Actor {
    let a = this.guests.get(x.id);
    if (!a) {
      const figure = guestFigure(this.mats, x.look);
      figure.root.scale.setScalar(GUEST_SCALE);
      this.scene.add(figure.root);
      a = {
        figure,
        yaw: Math.atan2(x.fx, x.fz),
        phase: Math.random() * 6,
        seat: -1,
        goo: false,
        hop: 0,
        shake: 0,
        prop: null,
        propMesh: null,
      };
      this.guests.set(x.id, a);
    }
    if (x.state === 'goo' && !a.goo) {
      // Pop back into goo.
      const at = a.figure.root.position.clone();
      this.scene.remove(a.figure.root);
      a.figure = gooFigure(this.mats);
      a.figure.root.scale.setScalar(GUEST_SCALE);
      a.figure.root.position.copy(at);
      this.scene.add(a.figure.root);
      a.goo = true;
      a.hop = 1;
    }
    return a;
  }

  private setProp(a: Actor, p: Prop | null) {
    if (a.prop === p) return;
    if (a.propMesh) a.figure.hold?.remove(a.propMesh);
    a.prop = p;
    a.propMesh = null;
    if (p && a.figure.hold) {
      a.propMesh = propMesh(this.mats, p);
      a.propMesh.scale.setScalar(1.25);
      a.figure.hold.add(a.propMesh);
    }
  }

  frame(
    m: Match,
    alpha: number,
    dt: number,
    hints: { use: UseAction | null; out: number | null },
  ) {
    this.time += dt;
    const t = this.time;
    const k = 1 - Math.pow(0.0001, dt);
    // Waiters.
    m.players.forEach((p, i) => {
      const a = this.waiters[i];
      if (!a) return;
      const x = lerp(p.px, p.x, alpha);
      const z = lerp(p.pz, p.z, alpha);
      const root = a.figure.root;
      const moved = Math.hypot(x - root.position.x, z - root.position.z);
      root.position.set(x, 0, z);
      a.yaw = angleTo(a.yaw, Math.atan2(p.fx, p.fz), Math.min(1, dt * 14));
      root.rotation.y = a.yaw;
      this.animateWalk(a, moved, dt, p.moving ? 1 : 0);
      const carry = p.carry;
      const prop: Prop | null =
        carry?.k === 'dish'
          ? carry.burnt
            ? 'burnt'
            : carry.dish
          : carry?.k === 'dirty'
            ? 'dirty'
            : carry?.k === 'lead'
              ? 'menu'
              : null;
      this.setProp(a, prop);
      const [l, r] = a.figure.arms!;
      const raise = prop ? -1.25 : 0;
      l.rotation.x = lerp(l.rotation.x, raise, k * 0.9);
      r.rotation.x = lerp(r.rotation.x, raise, k * 0.9);
      if (!prop) {
        const swing = Math.sin(a.phase) * 0.5 * (p.moving ? 1 : 0);
        l.rotation.x = lerp(l.rotation.x, swing, k);
        r.rotation.x = lerp(r.rotation.x, -swing, k);
      }
      if (a.propMesh)
        a.propMesh.position.y =
          Math.sin(t * 9 + i) * 0.012 * (p.moving ? 1 : 0.2);
      // Mopping: a mop in hand and a happy wiggle.
      if (p.mop > 0 && i === this.you) {
        this.mop.visible = true;
        this.mop.position.set(x + p.fx * 0.35, 0, z + p.fz * 0.35);
        this.mop.rotation.z = Math.sin(t * 14) * 0.35;
      } else if (i === this.you) this.mop.visible = false;
      if (p.mop > 0) a.figure.body.rotation.z = Math.sin(t * 14) * 0.12;
      const marker = this.markers[i];
      marker.position.set(x, 0.012, z);
      const pulse = i === this.you ? 0.55 + Math.sin(t * 4) * 0.12 : 0.35;
      (marker.material as THREE.MeshBasicMaterial).opacity = pulse;
      marker.scale.setScalar(i === this.you ? 1.05 : 0.9);
    });

    // Guests.
    const seen = new Set<number>();
    const groups = new Map<number, Group>();
    for (const g of m.groups) groups.set(g.id, g);
    for (const x of m.guests) {
      seen.add(x.id);
      const a = this.actor(x);
      const g = groups.get(x.group);
      const root = a.figure.root;
      const px = lerp(x.px, x.x, alpha);
      const pz = lerp(x.pz, x.z, alpha);
      const moved = Math.hypot(px - root.position.x, pz - root.position.z);
      root.position.x = px;
      root.position.z = pz;
      const yaw = Math.atan2(x.fx, x.fz);
      a.yaw = angleTo(a.yaw, yaw, Math.min(1, dt * 10));
      root.rotation.y = a.yaw;
      const sitting = x.state === 'sit';
      const walking = moved > 0.002;
      if (a.goo) {
        // Goo bounds along, squashing and stretching.
        const s = Math.sin(t * 16 + x.id);
        a.figure.body.scale.set(1 + s * 0.12, 1 - s * 0.14, 1 + s * 0.12);
        root.position.y = Math.max(0, Math.sin(t * 16 + x.id) * 0.08);
        if (walking && Math.random() < 0.35)
          this.fx.emit('goo', px, 0.1, pz, {
            count: 1,
            size: 0.12,
            speed: 0.2,
          });
      } else {
        root.position.y = sitting ? 0.16 : 0;
        const [l, r] = a.figure.legs;
        if (sitting) {
          l.rotation.x = lerp(l.rotation.x, -1.45, k);
          r.rotation.x = lerp(r.rotation.x, -1.45, k);
        } else
          this.animateWalk(a, moved, dt, walking ? 1 : 0, g?.angry ? 1.6 : 1);
        const eating = g?.state === 'eat';
        const following = g?.state === 'follow';
        const low =
          !!g &&
          g.patience < 0.3 &&
          g.state !== 'leave' &&
          g.state !== 'eat' &&
          g.state !== 'follow';
        let bob = 0;
        if (eating) bob = Math.abs(Math.sin(t * 7 + x.id)) * 0.05;
        if (following && walking)
          bob += Math.abs(Math.sin(t * 12 + x.id)) * 0.06;
        if (!walking && !sitting && !low) bob += Math.sin(t * 2 + x.id) * 0.012;
        a.figure.body.position.y =
          bob + a.hop * 0.12 * Math.sin((1 - a.hop) * Math.PI);
        a.figure.body.rotation.z = low
          ? Math.sin(t * 30 + x.id) * 0.06
          : lerp(a.figure.body.rotation.z, 0, k);
        if (low && Math.random() < dt * 1.2)
          this.fx.emit('anger', px, 1.45, pz, { count: 1, size: 0.18 });
        if (g?.angry && Math.random() < dt * 6)
          this.fx.emit('anger', px, 1.45, pz, { count: 1, size: 0.22 });
      }
      a.hop = Math.max(0, a.hop - dt * 3.5);
      if (a.shake > 0) {
        a.shake = Math.max(0, a.shake - dt * 2.5);
        const s = 1 + Math.sin(a.shake * 30) * 0.18 * a.shake;
        a.figure.body.scale.set(s, 2 - s, s);
      }
    }
    for (const [id, a] of this.guests)
      if (!seen.has(id)) {
        this.scene.remove(a.figure.root);
        this.guests.delete(id);
      }

    this.updateStations(m, t, dt);
    this.updateTables(m, groups);
    this.updatePuddles(m, t);
    this.updateHints(m, hints, t);

    // The door swings for anyone passing; the bin's lid falls shut.
    const near = m.guests.some(
      (x) =>
        x.x < DOOR_IN.x + 0.15 &&
        x.z > DOOR_GAP[0] - 0.3 &&
        x.z < DOOR_GAP[1] + 0.3,
    );
    this.doorOpen = lerp(
      this.doorOpen,
      near ? 1 : 0,
      Math.min(1, dt * (near ? 8 : 3)),
    );
    this.shell.door.rotation.y = -this.doorOpen * 1.2;
    this.binOpen = Math.max(0, this.binOpen - dt * 2.2);
    this.shell.binLid.rotation.x =
      -Math.sin(Math.min(1, this.binOpen) * Math.PI) * 1.1;
    // Neon hum and the odd flicker; the jukebox cycles its colours.
    this.flicker = Math.max(0, this.flicker - dt);
    if (Math.random() < dt * 0.15) this.flicker = 0.25;
    const on =
      this.flicker > 0 ? (Math.sin(this.flicker * 80) > 0 ? 1 : 0.35) : 1;
    (this.shell.neon.material as THREE.MeshBasicMaterial).color
      .set(C.pink)
      .multiplyScalar(0.75 + on * 0.6);
    (this.shell.neonStar.material as THREE.MeshBasicMaterial).color
      .set(C.teal)
      .multiplyScalar(0.9 + Math.sin(t * 3) * 0.25);
    this.neonLight.intensity = 3.6 * on;
    const hue = (t * 0.06) % 1;
    const jc = (this.shell.jukebox.material as THREE.MeshBasicMaterial).color;
    jc.setHSL(hue, 0.95, 0.6).multiplyScalar(1.4);
    this.jukeLight.color.setHSL(hue, 0.9, 0.6);

    this.fx.update(dt);
    this.frames++;
    this.renderer.shadowMap.autoUpdate =
      this.shadowEvery === 1 || this.frames % 2 === 0;
    this.renderer.render(this.scene, this.camera);
  }

  private animateWalk(
    a: Actor,
    moved: number,
    dt: number,
    moving: number,
    pace = 1,
  ) {
    a.phase += moved * 9 * pace;
    const [l, r] = a.figure.legs;
    const swing = Math.sin(a.phase) * 0.7 * moving;
    l.rotation.x = lerp(l.rotation.x, swing, Math.min(1, dt * 18));
    r.rotation.x = lerp(r.rotation.x, -swing, Math.min(1, dt * 18));
    a.figure.body.position.y =
      Math.abs(Math.cos(a.phase)) * 0.05 * moving +
      a.hop * 0.15 * Math.sin((1 - a.hop) * Math.PI);
    a.figure.body.rotation.z = Math.sin(a.phase) * 0.06 * moving;
    a.hop = Math.max(0, a.hop - dt * 3.5);
    if (a.shake > 0) {
      a.shake = Math.max(0, a.shake - dt * 3);
      a.figure.body.rotation.y = Math.sin(a.shake * 40) * 0.25 * a.shake;
    } else a.figure.body.rotation.y = 0;
  }

  private updateStations(m: Match, t: number, dt: number) {
    for (const s of m.stations) {
      const slots = this.stationProps.get(s.id);
      if (!slots) continue;
      const x = COUNTER_X[s.id];
      const dish = stationDish[s.id];
      const cooking = s.state === 'cook';
      const ready = s.state === 'ready';
      const burnt = s.state === 'burnt';
      // What sits on the station itself.
      if (s.id === 'grill') {
        const want = cooking ? 'patty' : null;
        if (want && !slots.cook) {
          slots.cook = pattyMesh(this.mats, false);
          slots.cook.position.set(x, 1.095, 0.72);
          this.scene.add(slots.cook);
        } else if (!want && slots.cook) {
          this.scene.remove(slots.cook);
          slots.cook = null;
        }
        if (cooking && Math.random() < dt * 9)
          this.fx.emit('steam', x + (Math.random() - 0.5) * 0.3, 1.15, 0.72, {
            count: 1,
            size: 0.16,
          });
      } else if (s.id === 'fryer') {
        if (!slots.cook) {
          slots.cook = basketMesh(this.mats);
          this.scene.add(slots.cook);
        }
        const down = cooking ? 1.12 : 1.32;
        slots.cook.position.set(
          x,
          lerp(slots.cook.position.y || 1.32, down, Math.min(1, dt * 6)),
          0.6,
        );
        if (cooking && Math.random() < dt * 12)
          this.fx.emit('bubble', x + (Math.random() - 0.5) * 0.4, 1.3, 0.66, {
            count: 1,
            size: 0.08,
            colour: '#ffe08a',
          });
      } else if (s.id === 'shake') {
        if (!slots.cook) {
          slots.cook = shakeCupMesh(this.mats);
          this.scene.add(slots.cook);
        }
        const buzz = cooking ? Math.sin(t * 70) * 0.012 : 0;
        slots.cook.position.set(x + buzz, cooking ? 1.03 : 1.03, 0.88);
        slots.cook.rotation.y = cooking ? t * 25 : 0;
        slots.cook.visible = cooking || s.state === 'idle';
      }
      // The plate waiting on the pass.
      const want: Prop | null = ready ? dish : burnt ? 'burnt' : null;
      const key = slots.ready?.userData.prop as Prop | undefined;
      if (key !== want) {
        if (slots.ready) this.scene.remove(slots.ready);
        slots.ready = null;
        if (want) {
          slots.ready = propMesh(this.mats, want);
          slots.ready.userData.prop = want;
          slots.ready.position.set(x, 0.955, 1.13);
          slots.ready.scale.setScalar(1.5);
          this.scene.add(slots.ready);
        }
      }
      if (slots.ready) {
        // Settles in with a little bounce.
        const sc = slots.ready.scale.x;
        if (sc > 1.3) slots.ready.scale.setScalar(Math.max(1.3, sc - dt * 1.5));
      }
      const burn = dishes[dish].burn;
      if (ready && Math.random() < dt * 3)
        this.fx.emit('steam', x, 1.15, 1.13, { count: 1, size: 0.16 });
      if (
        ready &&
        burn !== null &&
        s.t > burn * 30 * 0.5 &&
        Math.random() < dt * 8
      )
        this.fx.emit('smoke', x, 1.15, 1.1, { count: 1, size: 0.22 });
      if (burnt && Math.random() < dt * 6)
        this.fx.emit('smoke', x, 1.1, 1.1, { count: 1, size: 0.3 });
    }
  }

  private updateTables(m: Match, groups: Map<number, Group>) {
    for (const t of m.tables) {
      const g = t.group >= 0 ? groups.get(t.group) : undefined;
      const members = g
        ? m.guests.filter((x) => x.group === g.id && x.state === 'sit')
        : [];
      const parts: string[] = [];
      if (g && (g.state === 'read' || g.state === 'order'))
        for (const x of members) parts.push(`menu:${x.seat}`);
      if (g && (g.state === 'food' || g.state === 'eat'))
        for (const x of members)
          if (x.served && x.dish) parts.push(`${x.dish}:${x.seat}`);
      if (t.dirty) {
        parts.push('dirty:c');
        if (t.coins > 0) parts.push('coins:c');
      }
      const key = parts.join('|');
      let group = this.tableProps.get(t.slot);
      if (this.tableKey.get(t.slot) !== key) {
        this.tableKey.set(t.slot, key);
        if (group) this.scene.remove(group);
        group = new THREE.Group();
        group.position.set(t.x, 0.755, t.z);
        for (const part of parts) {
          const [p, seat] = part.split(':') as [Prop, string];
          const mesh = propMesh(this.mats, p);
          if (seat === 'c') {
            mesh.position.set(
              p === 'coins' ? 0.12 : -0.08,
              0,
              p === 'coins' ? 0.15 : -0.05,
            );
            mesh.scale.setScalar(1.25);
          } else {
            const [ox, oz] = seatOffset(t.seats, Number(seat));
            mesh.position.set(ox * 0.42, 0, oz * 0.95);
            if (p === 'menu') {
              mesh.rotation.y = ox < 0 ? -Math.PI / 2 : Math.PI / 2;
              mesh.position.y = 0.02;
            }
          }
          mesh.userData.prop = p;
          group.add(mesh);
        }
        this.scene.add(group);
        this.tableProps.set(t.slot, group);
      }
      // Eating: the plates shrink as they go.
      if (group && g?.state === 'eat')
        for (const c of group.children) {
          const left = 1 - Math.min(1, g.t / (6 * 30)) * 0.6;
          c.scale.setScalar(left);
        }
    }
  }

  private updatePuddles(m: Match, t: number) {
    const seen = new Set<number>();
    for (const u of m.puddles) {
      seen.add(u.id);
      let mesh = this.puddles.get(u.id);
      if (!mesh) {
        mesh = puddleMesh(this.mats);
        mesh.position.set(u.x, 0.004, u.z);
        mesh.rotation.y = (u.id % 7) * 0.9;
        mesh.scale.setScalar(0.01);
        this.scene.add(mesh);
        this.puddles.set(u.id, mesh);
      }
      const target = u.r / 0.5;
      const mopping = m.players.some((p) => p.mop > 0 && p.mopping === u.id);
      const s =
        mesh.scale.x + (target * (mopping ? 0.7 : 1) - mesh.scale.x) * 0.12;
      mesh.scale.set(s * (1 + Math.sin(t * 3 + u.id) * 0.02), 1, s);
    }
    for (const [id, mesh] of this.puddles)
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        this.puddles.delete(id);
      }
  }

  private updateHints(
    m: Match,
    hints: { use: UseAction | null; out: number | null },
    t: number,
  ) {
    const a = hints.use;
    let at: [number, number, number] | null = null;
    if (a) {
      if (a.counter) at = [COUNTER_X[a.counter], 0.8, COUNTER_Z + 0.32];
      else if (a.table !== undefined) {
        const tb = m.tables.find((s) => s.slot === a.table);
        if (tb) at = [tb.x, boothHz(tb.seats) * 1.25 + 0.4, tb.z];
      } else if (a.group !== undefined) {
        const g = m.groups.find((x) => x.id === a.group);
        const members = g ? m.guests.filter((x) => x.group === g.id) : [];
        if (a.kind === 'return' && g && g.slot >= 0)
          at = [QUEUE[g.slot].x, 0.9, QUEUE[g.slot].z];
        else if (members.length) {
          const cx = members.reduce((s, x) => s + x.x, 0) / members.length;
          const cz = members.reduce((s, x) => s + x.z, 0) / members.length;
          at = [cx, 0.85, cz];
        }
      } else if (a.puddle !== undefined) {
        const u = m.puddles.find((x) => x.id === a.puddle);
        if (u) at = [u.x, u.r * 1.6, u.z];
      }
    }
    this.useRing.visible = !!at;
    if (at) {
      this.useRing.position.set(at[0], 0.02, at[2]);
      const s = at[1] * (1 + Math.sin(t * 5) * 0.04);
      this.useRing.scale.set(s, s, 1);
      if (a?.counter) this.useRing.scale.set(1.25, 0.65, 1);
    }
    const guest = hints.out !== null ? this.guests.get(hints.out) : undefined;
    this.outRing.visible = !!guest;
    if (guest) {
      const p = guest.figure.root.position;
      this.outRing.position.set(p.x, 0.025, p.z);
      const s = 0.6 + Math.sin(t * 8) * 0.06;
      this.outRing.scale.set(s, s, 1);
    }
  }

  dispose() {
    this.shell.dispose();
    this.fx.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
    for (const e of this.extra) e.dispose();
    this.ringGeo.dispose();
    this.discGeo.dispose();
    this.mop.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.env.dispose();
    disposeCache();
    this.renderer.dispose();
  }
}
