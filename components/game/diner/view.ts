import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  stationDish,
  type NightId,
  type StationId,
} from '@/lib/games/diner/content';
import type { PlaceId } from '@/lib/games/diner/road';
import {
  burnSeconds,
  cookSeconds,
  eatSeconds,
  isRush,
  powerOnline,
  stationSlots,
  type DinerEvent,
  type Item,
  type Group,
  type Guest,
  type Match,
  type UseAction,
} from '@/lib/games/diner/engine';
import {
  boothHz,
  COUNTER_X,
  COUNTER_Z,
  DOOR_GAP,
  DOOR_IN,
  JUKEBOX,
  QUEUE,
  seatOffset,
} from '@/lib/games/diner/layout';
import type { Rung } from '../render-pacer';
import { devicePower } from '../render-quality';
import { Effects } from './fx';
import { fitDinerCamera, type Frame } from './framing';
import { Kit, makeMaterials, meshes, type Materials } from './kit';
import { nightRig, type NightRig } from './lighting';
import { buildCounter, type Counter } from './stations';
import { buildStage } from './stage';
import type { CarUpgrades, Stage } from './stage-contract';
import { disposeSurfaceMaterials } from './materials';
import { cached, releaseShared, shared } from './model-cache';
import { expression } from './people';
import { advanceStride, mopGripPoint, poseFigure } from './people-motion';
import {
  basketMesh,
  C,
  disposeCache,
  gooFigure,
  guestFigure,
  pattyMesh,
  propMesh,
  puddleMesh,
  SEAT_COLOURS,
  shakeCupMesh,
  stationLaneX,
  waiterFigure,
  type Figure,
  type Prop,
} from './models';

/** How a shift's room is set up. */
export type ViewOptions = {
  night: NightId;
  place: PlaceId;
  tables: number[];
  stations: StationId[];
  players: number;
  pixelRatio: number;
  upgrades: CarUpgrades;
  grillLanes: number;
  pass: boolean;
  coffee: boolean;
  /** Roller skates (Dash): the waiters wear them. */
  skates: boolean;
};

/** Where the stage sits on the canvas, in CSS pixels. */
export type { Frame } from './framing';

/** Figures are drawn a little larger than life so outfits read on phones. */
const GUEST_SCALE = 1.3;

type Actor = {
  figure: Figure;
  yaw: number;
  phase: number;
  seat: number;
  goo: boolean;
  hop: number;
  shake: number;
  prop: string | null;
  propMesh: THREE.Object3D | null;
  gesture: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A pink roller skate under a shoe: a sole plate and four yellow wheels. */
function skate(mats: Materials) {
  return shared(
    cached('skate', (k) => {
      k.rbox(
        'gloss',
        '#ff7aa6',
        [0.085, 0.016, 0.21],
        0.006,
        [0, -0.094, 0.03],
      );
      k.rbox('chrome', C.chrome, [0.06, 0.01, 0.17], 0.004, [0, -0.106, 0.03]);
      for (const z of [-0.035, 0.1])
        for (const x of [-0.034, 0.034])
          k.cyl('gloss', '#ffd23f', 0.022, 0.022, 0.02, [x, -0.122, z], {
            axis: 'x',
            seg: 14,
          });
      k.cyl('paint', '#e8457a', 0.018, 0.018, 0.02, [0, -0.09, 0.15], {
        axis: 'z',
        seg: 12,
      });
    }),
    mats,
  );
}
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
  private stage: Stage;
  private counter: Counter;
  private rig: NightRig;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private output: OutputPass;
  private fx = new Effects();
  private lanes: number;
  private waiters: Actor[] = [];
  private guests = new Map<number, Actor>();
  private puddles = new Map<number, THREE.Object3D>();
  private stationProps = new Map<
    StationId,
    {
      cook: THREE.Object3D | null;
      ready: THREE.Object3D | null;
      burnt: THREE.Object3D | null;
    }[]
  >();
  private tableProps = new Map<number, THREE.Group>();
  private tableKey = new Map<number, string>();
  private useRing: THREE.Mesh;
  private outRing: THREE.Mesh;
  private markers: THREE.Mesh[] = [];
  private mop: THREE.Group;
  private mopLower = new THREE.Vector3();
  private mopUpper = new THREE.Vector3();
  private mopAxis = new THREE.Vector3();
  private mopUp = new THREE.Vector3(0, 1, 0);
  private ringGeo = new THREE.RingGeometry(0.42, 0.52, 40);
  private discGeo = new THREE.CircleGeometry(0.42, 32);
  private extra: { dispose: () => void }[] = [];
  private doorOpen = 0;
  private binOpen = 0;
  private washing = 0;
  private passProps: THREE.Object3D[] = [];
  private passKey = '';
  /** Wheel height under skating waiters. */
  private lift = 0;
  private reduced = false;
  private shadowEvery: 1 | 2 = 1;
  private frames = 0;
  private basePixelRatio: number;
  pixelsPerUnit = 30;
  private time = 0;
  you = 0;

  readonly night: NightId;

  constructor(canvas: HTMLCanvasElement, o: ViewOptions) {
    const { pixelRatio, stations, tables, players } = o;
    this.night = o.night;
    this.lanes = o.grillLanes;
    this.basePixelRatio = pixelRatio;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.mats = makeMaterials();
    // Night on the patio: a warm pool on the deck, the place in moonlight.
    this.rig = nightRig(this.scene, this.renderer, o.place);
    // Strong phones get the full models; weaker ones the lighter cut.
    const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
    const power = devicePower();
    this.stage = buildStage(this.mats, {
      place: o.place,
      tables,
      upgrades: o.upgrades,
      quality: power === 'low' || (phone && power === 'mid') ? 'low' : 'high',
    });
    this.scene.add(this.stage.group);
    this.counter = buildCounter(this.mats, {
      stations,
      grillLanes: o.grillLanes,
      pass: o.pass,
      coffee: o.coffee,
    });
    this.scene.add(this.counter.group);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Bloom only lifts the neon and bulbs; it never washes the deck.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.35, 0.96);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.lift = o.skates ? 0.05 : 0;
    for (const id of stations)
      this.stationProps.set(
        id,
        Array.from(
          { length: id === 'pie' ? 1 : id === 'grill' ? o.grillLanes : 2 },
          () => ({
            cook: null,
            ready: null,
            burnt: null,
          }),
        ),
      );
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
      if (o.skates)
        for (const ankle of figure.joints?.ankles ?? [])
          ankle.add(skate(this.mats));
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
        gesture: 0,
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
    mk.cyl('wood', C.wood, 0.025, 0.025, 1.1, [0, 0.55, 0]);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      mk.capsule(
        'cloth',
        '#ded8c8',
        0.014,
        0.11,
        [Math.cos(a) * 0.09, 0.054, Math.sin(a) * 0.09],
        { rot: [Math.sin(a) * 0.31, 0, Math.cos(a) * 0.31] },
      );
    }
    this.mop = meshes(mk.build(), this.mats);
    this.mop.visible = false;
    this.scene.add(this.mop);
  }

  /** Fits the whole diner inside the frame's free area. */
  resize(f: Frame) {
    const width = Math.max(1, f.width);
    const height = Math.max(1, f.height);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.pixelsPerUnit = fitDinerCamera(
      this.camera,
      f,
      this.stage.landmarks,
    ).pixelsPerUnit;
    this.fx.setScale(this.pixelsPerUnit * this.renderer.getPixelRatio());
  }

  setRung(r: Rung) {
    this.renderer.setPixelRatio(this.basePixelRatio * r.resolution);
    this.composer.setPixelRatio(this.basePixelRatio * r.resolution);
    // Bloom is the first thing a struggling device gives up, measured
    // against the 2× the diner drew at before native density.
    this.bloom.enabled =
      this.basePixelRatio * r.resolution >=
      0.85 * Math.min(this.basePixelRatio, 2);
    this.shadowEvery = r.shadowEvery;
    const key = this.rig.key;
    if (key.shadow.mapSize.x !== r.shadowSize) {
      const size = Math.min(2048, r.shadowSize);
      key.shadow.mapSize.set(size, size);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    this.fx.setScale(this.pixelsPerUnit * this.renderer.getPixelRatio());
  }

  set calm(on: boolean) {
    this.reduced = on;
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
      if (
        'player' in e &&
        ['cook', 'order', 'serve', 'clear', 'wash', 'repair'].includes(e.type)
      ) {
        const waiter = this.waiters[e.player];
        if (waiter) waiter.gesture = 0.7;
      }
      if ('station' in e) {
        const rig = this.counter.machines.get(e.station);
        if (rig && ['cook', 'take', 'repair'].includes(e.type)) rig.pulse = 1;
      }
      switch (e.type) {
        case 'cook': {
          const x = stationLaneX(e.station, e.slot, this.laneCount(e.station));
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
          const x = stationLaneX(e.station, e.slot, this.laneCount(e.station));
          this.fx.emit('spark', x, 1.1, 1.15, {
            count: 10,
            speed: 0.6,
            size: 0.18,
          });
          this.fx.emit('steam', x, 1.05, 1.15, { count: 5, spread: 0.12 });
          break;
        }
        case 'burnt': {
          const x = stationLaneX(e.station, e.slot, this.laneCount(e.station));
          this.fx.emit('smoke', x, 1.1, 0.9, {
            count: 14,
            spread: 0.3,
            size: 0.35,
          });
          break;
        }
        case 'take': {
          const x = stationLaneX(e.station, e.slot, this.laneCount(e.station));
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
          this.washing = 1.05;
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
        case 'jam':
          this.fx.emit('smoke', COUNTER_X[e.station], 1.25, 0.8, {
            count: 4,
            size: 0.17,
            colour: '#ceaa62',
          });
          break;
        case 'dash': {
          const p = m.players[e.player];
          if (p)
            this.fx.emit('dust', p.x - p.fx * 0.3, 0.1, p.z - p.fz * 0.3, {
              count: 8,
              spread: 0.25,
              size: 0.2,
            });
          break;
        }
        case 'pour': {
          const g = m.groups.find((x) => x.id === e.group);
          const x = g ? m.guests.find((y) => y.id === g.guests[0]) : undefined;
          if (x) {
            this.fx.emit('steam', x.x, 1.3, x.z, {
              count: 8,
              spread: 0.3,
              size: 0.2,
            });
            this.fx.emit('spark', x.x, 1.5, x.z, {
              count: 8,
              size: 0.16,
              colour: '#ffe2b0',
            });
          }
          const w = this.waiters[e.player];
          if (w) w.gesture = 0.7;
          break;
        }
        case 'juke':
          this.fx.emit('spark', JUKEBOX.x, 1.6, JUKEBOX.z, {
            count: 24,
            spread: 0.6,
            size: 0.22,
            colour: '#ff8fd0',
            speed: 0.9,
          });
          this.fx.emit('bubble', JUKEBOX.x, 1.2, JUKEBOX.z, {
            count: 10,
            spread: 0.5,
            size: 0.12,
          });
          break;
        case 'put':
        case 'pick':
          this.fx.emit('spark', COUNTER_X.pass, 1.3, 0.95, {
            count: 6,
            size: 0.12,
            colour: '#ffcf8a',
          });
          break;
        case 'pot':
          this.fx.emit('steam', COUNTER_X.coffee, 1.7, 0.7, {
            count: 5,
            spread: 0.15,
            size: 0.16,
          });
          break;
        case 'repair':
          this.fx.emit(
            e.left ? 'dust' : 'spark',
            COUNTER_X[e.station],
            1.22,
            1,
            { count: e.left ? 3 : 8, size: 0.13 },
          );
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
        phase: x.id * 0.717,
        seat: -1,
        goo: false,
        hop: 0,
        shake: 0,
        prop: null,
        propMesh: null,
        gesture: 0,
      };
      this.guests.set(x.id, a);
    }
    if (x.state === 'goo' && !a.goo) {
      // Pop back into goo.
      const at = a.figure.root.position.clone();
      this.scene.remove(a.figure.root);
      releaseShared(a.figure.root);
      a.figure = gooFigure(this.mats);
      a.figure.root.scale.setScalar(GUEST_SCALE);
      a.figure.root.position.copy(at);
      this.scene.add(a.figure.root);
      a.goo = true;
      a.hop = 1;
    }
    return a;
  }

  private laneCount(id: StationId) {
    return id === 'grill' ? this.lanes : 2;
  }

  /** What a waiter holds, as a stack in the carrying hands. */
  private setProp(a: Actor, items: Prop[]) {
    const p = items.join(',') || null;
    if (a.prop === p) return;
    if (a.propMesh) {
      a.figure.hold?.remove(a.propMesh);
      releaseShared(a.propMesh);
    }
    a.prop = p;
    a.propMesh = null;
    if (items.length && a.figure.hold) {
      // Plates side by side across both hands, the way a waiter carries
      // them, so none hides the face; a third rides on top in the middle.
      const stack = new THREE.Group();
      const spread = items.length > 1 ? 0.13 : 0;
      items.forEach((item, i) => {
        const mesh = propMesh(this.mats, item);
        if (i < 2) mesh.position.set((i === 0 ? -1 : 1) * spread, 0, 0.02);
        else mesh.position.set(0, 0.07, 0.07);
        mesh.rotation.y = i * 0.5;
        stack.add(mesh);
      });
      stack.scale.setScalar(1.25);
      a.propMesh = stack;
      a.figure.hold.add(stack);
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
    // Waiters.
    m.players.forEach((p, i) => {
      const a = this.waiters[i];
      if (!a) return;
      const x = lerp(p.px, p.x, alpha);
      const z = lerp(p.pz, p.z, alpha);
      const root = a.figure.root;
      const moved = Math.hypot(x - root.position.x, z - root.position.z);
      root.position.set(x, this.lift, z);
      a.yaw = angleTo(a.yaw, Math.atan2(p.fx, p.fz), Math.min(1, dt * 14));
      root.rotation.y = a.yaw;
      a.phase = advanceStride(a.figure, a.phase, moved);
      const held: Prop[] = p.hands.map((i: Item) =>
        i.k === 'dish'
          ? i.burnt
            ? 'burnt'
            : i.dish
          : i.k === 'dirty'
            ? 'dirty'
            : 'pot',
      );
      // Leading a party with empty hands: the menus show it.
      if (!held.length && p.lead >= 0) held.push('menu');
      this.setProp(a, held);
      const prop = held.length > 0;
      poseFigure(a.figure, {
        time: t,
        phase: a.phase,
        moving: p.moving ? 1 : 0,
        seed: i,
        carry: !!prop,
        gesture: a.gesture / 0.7,
        mopping: p.mop > 0,
        reduced: this.reduced,
        dt,
      });
      a.gesture = Math.max(0, a.gesture - dt);
      a.hop = Math.max(0, a.hop - dt * 3.5);
      a.shake = Math.max(0, a.shake - dt * 3);
      if (!this.reduced && a.shake > 0)
        a.figure.body.rotation.y = Math.sin(a.shake * 40) * 0.15 * a.shake;
      expression(
        a.figure,
        a.gesture > 0 ? 'smile' : 'rest',
        t,
        i,
        this.reduced,
      );
      // The shaft passes through both palms and meets the floor. Its motion
      // comes from the posed hands, including their yaw and reduced motion.
      if (p.mop > 0 && i === this.you) {
        this.mop.visible = true;
        const low = mopGripPoint(a.figure, 1, this.mopLower);
        const high = mopGripPoint(a.figure, 0, this.mopUpper);
        this.mop.visible = !!low && !!high;
        if (low && high) {
          this.mopAxis.subVectors(high, low).normalize();
          this.mop.position
            .copy(low)
            .addScaledVector(this.mopAxis, -low.y / this.mopAxis.y);
          this.mop.quaternion.setFromUnitVectors(this.mopUp, this.mopAxis);
        }
      } else if (i === this.you) this.mop.visible = false;
      const marker = this.markers[i];
      marker.position.set(x, 0.012, z);
      const pulse =
        i === this.you
          ? 0.55 + (this.reduced ? 0 : Math.sin(t * 3) * 0.05)
          : 0.35;
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
        const s = this.reduced ? 0 : Math.sin(t * 12 + x.id);
        a.figure.body.scale.set(1 + s * 0.12, 1 - s * 0.14, 1 + s * 0.12);
        root.position.y = Math.max(0, s * 0.06);
        if (walking && !this.reduced && Math.random() < dt * 8)
          this.fx.emit('goo', px, 0.1, pz, {
            count: 1,
            size: 0.12,
            speed: 0.2,
          });
      } else {
        root.position.y = sitting ? 0.16 : 0;
        if (!sitting) a.phase = advanceStride(a.figure, a.phase, moved);
        const eating = g?.state === 'eat';
        const low =
          !!g &&
          g.patience < 0.3 &&
          g.state !== 'leave' &&
          g.state !== 'eat' &&
          g.state !== 'follow';
        poseFigure(a.figure, {
          time: t,
          phase: a.phase,
          moving: walking && !sitting ? 1 : 0,
          seed: x.id,
          sitting,
          eating,
          impatient: !!g?.angry || low,
          reduced: this.reduced,
          dt,
        });
        expression(
          a.figure,
          g?.angry || low
            ? 'frown'
            : eating
              ? 'eat'
              : a.hop > 0.2
                ? 'smile'
                : 'rest',
          t,
          x.id,
          this.reduced,
        );
        if (low && !this.reduced && Math.random() < dt * 0.8)
          this.fx.emit('anger', px, 1.45, pz, { count: 1, size: 0.18 });
        if (g?.angry && !this.reduced && Math.random() < dt * 3)
          this.fx.emit('anger', px, 1.45, pz, { count: 1, size: 0.22 });
      }
      a.hop = Math.max(0, a.hop - dt * 3.5);
      if (a.shake > 0 && !this.reduced) {
        a.shake = Math.max(0, a.shake - dt * 2.5);
        if (a.goo) {
          const s = 1 + Math.sin(a.shake * 30) * 0.18 * a.shake;
          a.figure.body.scale.set(s, 2 - s, s);
        } else
          a.figure.body.rotation.y += Math.sin(a.shake * 30) * 0.08 * a.shake;
      }
    }
    for (const [id, a] of this.guests)
      if (!seen.has(id)) {
        this.scene.remove(a.figure.root);
        releaseShared(a.figure.root);
        this.guests.delete(id);
      }

    this.updateStations(m, t, dt);
    this.updateTables(m, groups);
    this.updatePuddles(m, t);
    this.updateHints(m, hints, t);

    // The gate swings for anyone passing; the bin's lid falls shut.
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
    this.binOpen = Math.max(0, this.binOpen - dt * 2.2);
    this.counter.binLid.rotation.x =
      -Math.sin(Math.min(1, this.binOpen) * Math.PI) * 1.1;
    const powered = powerOnline(m);
    this.rig.update(powered, t);
    this.scene.environmentIntensity = powered ? 0.24 : 0.14;
    this.stage.update({
      time: t,
      dt,
      reduced: this.reduced,
      power: powered,
      rush: isRush(m),
      gate: this.doorOpen,
      jukebox: m.juke.play > 0 || !this.reduced,
    });
    this.washing = Math.max(0, this.washing - dt);
    this.counter.water.visible = this.washing > 0;
    this.updatePass(m);

    this.fx.update(dt);
    this.frames++;
    this.renderer.shadowMap.autoUpdate =
      this.shadowEvery === 1 || this.frames % 2 === 0;
    this.composer.render();
  }

  /** Plates under the heat lamps. */
  private updatePass(m: Match) {
    const key = m.pass
      .map((i) => (i.k === 'dish' ? `${i.dish}${i.burnt ? '!' : ''}` : i.k))
      .join(',');
    if (key === this.passKey) return;
    this.passKey = key;
    for (const p of this.passProps) {
      this.scene.remove(p);
      releaseShared(p);
    }
    this.passProps = m.pass.map((item, i) => {
      const prop: Prop =
        item.k === 'dish' ? (item.burnt ? 'burnt' : item.dish) : 'dirty';
      const mesh = propMesh(this.mats, prop);
      const spot = this.counter.passSpots[i];
      if (spot) mesh.position.copy(spot);
      mesh.scale.setScalar(1.2);
      this.scene.add(mesh);
      return mesh;
    });
  }

  private updateStations(m: Match, t: number, dt: number) {
    const powered = powerOnline(m);
    for (const s of m.stations) {
      const props = this.stationProps.get(s.id);
      if (!props) continue;
      const lanes = stationSlots(s);
      const dish = stationDish[s.id];
      const cook = Math.max(0.01, cookSeconds(m, s.id));
      const burning = burnSeconds(m, s.id);
      const working = !s.jam && lanes.some((lane) => lane.state === 'cook');
      const rig = this.counter.machines.get(s.id);
      if (rig) {
        rig.pulse = Math.max(0, rig.pulse - dt * 1.8);
        const indicators = rig.indicators ?? [rig.indicator];
        indicators.forEach((indicator, i) => {
          const lane = lanes[i];
          indicator.material.color.set(
            s.jam
              ? '#ffb43b'
              : !powered
                ? '#676f7b'
                : lane?.state === 'burnt'
                  ? '#ed553d'
                  : lane?.state === 'ready'
                    ? '#b4ffe0'
                    : lane?.state === 'cook'
                      ? '#ffd58a'
                      : '#65bfa8',
          );
          if (s.jam && !this.reduced)
            indicator.material.color.multiplyScalar(
              0.87 + Math.sin(t * 3) * 0.13,
            );
        });
        const progress = Math.max(
          ...lanes.map((lane) =>
            lane.state === 'cook'
              ? Math.min(1, Math.max(0, 1 - lane.t / (cook * 30)))
              : lane.state === 'ready'
                ? 1
                : 0,
          ),
        );
        rig.needle.rotation.z = (0.5 - progress) * Math.PI * 0.75;
        if (rig.heat)
          rig.heat.material.opacity =
            working && powered
              ? 0.58 + (this.reduced ? 0 : Math.sin(t * 5) * 0.06)
              : working
                ? 0.24
                : 0.07;
        if (!this.reduced) {
          if (s.id === 'shake')
            (rig.rotors ?? (rig.rotor ? [rig.rotor] : [])).forEach(
              (rotor, i) => {
                if (lanes[i]?.state === 'cook' && !s.jam)
                  rotor.rotation.y += dt * (powered ? 24 : 4);
              },
            );
          else if (rig.rotor && s.id === 'pie' && powered && !s.jam)
            rig.rotor.rotation.y += dt * 0.12;
        }
        if (rig.cover)
          rig.cover.rotation.x = -Math.sin(rig.pulse * Math.PI) * 0.69;
      }
      const anchor = this.counter.anchors.get(s.id);
      lanes.forEach((lane, i) => {
        const slot = props[i];
        if (!slot || !anchor) return;
        const x = stationLaneX(s.id, i, this.laneCount(s.id));
        const cooking = lane.state === 'cook';
        const ready = lane.state === 'ready';
        const burnt = lane.state === 'burnt';
        const running = cooking && !s.jam && powered;
        if (s.id === 'grill') {
          if (cooking && !slot.cook) {
            slot.cook = pattyMesh(this.mats, false);
            slot.cook.position.set(x, anchor.cookY, anchor.cookZ);
            this.scene.add(slot.cook);
          } else if (!cooking && slot.cook) {
            this.scene.remove(slot.cook);
            releaseShared(slot.cook);
            slot.cook = null;
          }
          if (running && !this.reduced && Math.random() < dt * 4)
            this.fx.emit(
              'steam',
              x + (Math.random() - 0.5) * 0.18,
              1.15,
              0.72,
              { count: 1, size: 0.12 },
            );
        } else if (s.id === 'fryer') {
          if (!slot.cook) {
            slot.cook = basketMesh(this.mats);
            slot.cook.scale.set(0.59, 1, 0.85);
            this.scene.add(slot.cook);
          }
          const down = cooking ? (anchor.downY ?? anchor.cookY) : anchor.cookY;
          slot.cook.position.set(
            x,
            lerp(
              slot.cook.position.y || anchor.cookY,
              down,
              Math.min(1, dt * 6),
            ),
            anchor.cookZ,
          );
          if (running && !this.reduced && Math.random() < dt * 5)
            this.fx.emit(
              'bubble',
              x + (Math.random() - 0.5) * 0.2,
              anchor.cookY - 0.15,
              anchor.cookZ,
              {
                count: 1,
                size: 0.065,
                colour: '#ffe08a',
              },
            );
        } else if (s.id === 'shake') {
          if (!slot.cook) {
            slot.cook = shakeCupMesh(this.mats);
            this.scene.add(slot.cook);
          }
          const buzz = running && !this.reduced ? Math.sin(t * 44) * 0.005 : 0;
          slot.cook.position.set(x + buzz, anchor.cookY, anchor.cookZ);
          slot.cook.rotation.y = 0;
          slot.cook.visible = cooking || lane.state === 'idle';
          if (running && !this.reduced && Math.random() < dt * 3)
            this.fx.emit('bubble', x, anchor.cookY + 0.32, anchor.cookZ, {
              count: 1,
              size: 0.055,
              colour: '#ffe1ef',
              spread: 0.04,
            });
        }
        const want: Prop | null = ready ? dish : burnt ? 'burnt' : null;
        if (slot.ready?.userData.prop !== want) {
          if (slot.ready) {
            this.scene.remove(slot.ready);
            releaseShared(slot.ready);
          }
          slot.ready = null;
          if (want) {
            slot.ready = propMesh(this.mats, want);
            slot.ready.userData.prop = want;
            slot.ready.position.set(x, anchor.readyY, anchor.readyZ);
            slot.ready.scale.setScalar(this.reduced ? 1.22 : 1.35);
            this.scene.add(slot.ready);
          }
        }
        if (slot.ready && slot.ready.scale.x > 1.22)
          slot.ready.scale.setScalar(
            Math.max(1.22, slot.ready.scale.x - dt * 1.5),
          );
        if (ready && !this.reduced && Math.random() < dt)
          this.fx.emit('steam', x, 1.15, 1.14, { count: 1, size: 0.13 });
        if (
          ready &&
          !s.jam &&
          !this.reduced &&
          burning !== null &&
          lane.t > burning * 15 &&
          Math.random() < dt * 5
        )
          this.fx.emit('smoke', x, 1.15, 1.1, { count: 1, size: 0.18 });
        if (burnt && !this.reduced && Math.random() < dt * 3)
          this.fx.emit('smoke', x, 1.1, 1.1, { count: 1, size: 0.23 });
      });
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
        if (group) {
          this.scene.remove(group);
          releaseShared(group);
        }
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
          const left = 1 - Math.min(1, g.t / (eatSeconds(m) * 30)) * 0.6;
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
      mesh.scale.set(
        s * (1 + (this.reduced ? 0 : Math.sin(t * 3 + u.id) * 0.02)),
        1,
        s,
      );
    }
    for (const [id, mesh] of this.puddles)
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        releaseShared(mesh);
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
      } else if (a.kind === 'juke') {
        at = [JUKEBOX.x, JUKEBOX.r * 2.2, JUKEBOX.z];
      } else if (a.puddle !== undefined) {
        const u = m.puddles.find((x) => x.id === a.puddle);
        if (u) at = [u.x, u.r * 1.6, u.z];
      }
    }
    this.useRing.visible = !!at;
    if (at) {
      this.useRing.position.set(at[0], 0.02, at[2]);
      const s = at[1] * (1 + (this.reduced ? 0 : Math.sin(t * 3) * 0.025));
      this.useRing.scale.set(s, s, 1);
      if (a?.counter) this.useRing.scale.set(1.25, 0.65, 1);
    }
    const guest = hints.out !== null ? this.guests.get(hints.out) : undefined;
    this.outRing.visible = !!guest;
    if (guest) {
      const p = guest.figure.root.position;
      this.outRing.position.set(p.x, 0.025, p.z);
      const s = 0.6 + (this.reduced ? 0 : Math.sin(t * 3) * 0.035);
      this.outRing.scale.set(s, s, 1);
    }
  }

  dispose() {
    // Removing a skinned figure releases its private bone textures; releasing
    // the shared reference also keeps room remounts from retaining actor meshes.
    for (const actor of [...this.waiters, ...this.guests.values()]) {
      this.scene.remove(actor.figure.root);
      releaseShared(actor.figure.root);
    }
    this.waiters.length = 0;
    this.guests.clear();
    for (const p of this.passProps) releaseShared(p);
    this.stage.dispose();
    this.counter.dispose();
    this.fx.dispose();
    disposeSurfaceMaterials(this.mats);
    for (const e of this.extra) e.dispose();
    this.ringGeo.dispose();
    this.discGeo.dispose();
    this.mop.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.rig.dispose();
    // The composer does not free its passes.
    this.bloom.dispose();
    this.output.dispose();
    this.composer.dispose();
    disposeCache();
    this.renderer.dispose();
  }
}
