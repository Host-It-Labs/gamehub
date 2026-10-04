import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { MapDef } from '@/lib/games/rota/maps';
import type { Placed } from '@/lib/games/rota/board';
import { growTown, type Lot } from '@/lib/games/rota/growth';
import {
  AdaptiveQuality,
  qualityLevels,
  renderDensity,
  renderSamples,
} from '@/lib/games/rota/quality';
import {
  DX,
  DY,
  RAIL,
  RIVER,
  ROAD,
  orient,
  pieces,
  type PieceId,
} from '@/lib/games/rota/pieces';
import {
  TUNNEL_AT,
  cellCentre,
  exitSegments,
  network,
  pieceSegments,
  pointAt,
  stationHalf,
  type Segment,
} from '@/lib/games/rota/routes';
import { Ground, type Polyline } from './ground';
import { Materials, toon } from './materials';
import {
  exitMeshes,
  mergeByMaterial,
  routeLook,
  routeMeshes,
  samples,
  type RouteLook,
} from './routes-mesh';
import { instance, planScenery, townRows, type Placement } from './scenery';
import { Traffic } from './traffic';
import { TownLayer } from './growth';
import { Smoke } from './smoke';
import { InkPass } from './ink';
import type { Library } from './assets';

/**
 * Rota's board in 3D: a mill town drawn in ink and flat colour, seen from
 * a fixed three-quarter camera (steeper on tall phone stages), late in a
 * smoky golden afternoon. The board is a cleared site in the middle of the
 * town; streets and the works railway run across it as they are built,
 * terraces and mills grow along them, and lorries and shunting engines
 * work them. The DOM keeps every control: this draws the board, the town
 * round it and the traffic, frames the board inside the stage the layout
 * gives it, and reports the perspective transform that lays the DOM
 * squares exactly over the drawn ones.
 */

export type BoardView = {
  map: MapDef;
  cells: (Placed | null)[];
  rubble: number[];
  towns: number[];
  strike: number;
  loose: { cell: number; dir: number }[];
  targets?: Set<number>;
  turnable?: number;
  ghost?: { cell: number; p: PieceId; o: number } | null;
  /** The sheet owner's seat: their engines wear its colour. */
  livery: number;
  /** The match is over: the empty squares fill in too. */
  finished?: boolean;
};

export type Rect = { x: number; y: number; w: number; h: number };

/** Size of one square in the DOM layer laid over the board, before the transform. */
export const CELL_PX = 100;
const PITCH = THREE.MathUtils.degToRad(49);
/** Extra pitch on tall stages (phones, tablets upright): almost straight
 *  down, so the squares stay square instead of flattening into a wedge. */
const TALL_PITCH = THREE.MathUtils.degToRad(27);
const FOV = 26;
/** New pieces drop in over this long; traffic and the town wait for them. */
const DROP = 0.42;

const facing = (d: number) => Math.atan2(DX[d], DY[d]);

type CellEntry = { key: string; group: THREE.Group; born: number };

export class RotaWorld {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 120);
  private composer: EffectComposer;
  private ink: InkPass;
  private root = new THREE.Group();
  private mats: Materials;
  private look: RouteLook;
  private ground: Ground;
  private cells = new Map<number, CellEntry>();
  private statics = new THREE.Group();
  private peaks = new THREE.Group();
  private rubble = new THREE.Group();
  private loose = new THREE.Group();
  private ghost = new THREE.Group();
  private scenery = new THREE.Group();
  private town: TownLayer;
  private smoke: Smoke | null = null;
  private traffic: Traffic;
  private ghostMaterial: THREE.MeshToonMaterial;
  private endMarks: THREE.Mesh[] = [];
  private endMaterial: THREE.MeshBasicMaterial;
  private frame = {
    width: 1,
    height: 1,
    stage: { x: 0, y: 0, w: 1, h: 1 } as Rect,
  };
  private view: BoardView | null = null;
  private keys = {
    statics: '-',
    peaks: '-',
    rubble: '',
    loose: '',
    ghost: '',
    rivers: '',
    scenery: '',
    net: '',
    town: '',
  };
  /** Work that waits for the pieces still dropping in. */
  private pending: { at: number; net?: () => void; town?: () => void } | null =
    null;
  private raf = 0;
  private last = performance.now();
  private time = 0;
  private disposed = false;
  /** Rebuilds without the drop animation (snapshots). */
  private quiet = false;
  private built = false;
  private project = new THREE.Vector3();
  private towns = new Map<string, Lot[]>();
  private quality = new AdaptiveQuality();
  private sun: THREE.DirectionalLight;
  private environment: THREE.WebGLRenderTarget;
  private contextLost = false;

  private onContextLost = () => {
    this.contextLost = true;
    this.quality.pressure();
  };
  private onContextRestored = () => {
    this.contextLost = false;
    this.last = performance.now();
    this.quality.reset();
    this.setQuality();
    this.fit();
  };

  constructor(
    canvas: HTMLCanvasElement,
    readonly map: MapDef,
    private lib: Library,
    private opts: {
      lite: boolean;
      still: boolean;
      onOverlay: (matrix: string) => void;
    },
  ) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    // Only the water still reflects a little sky.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.5;
    room.dispose();
    pmrem.dispose();
    // A smoky golden haze over the town.
    const haze = new THREE.Color('#e4d6bd');
    this.scene.background = haze;
    this.scene.fog = new THREE.Fog(haze, 20, 60);

    // A low warm sun from the west over a sky fill: shade stays a soft
    // smoky blue-grey, never black.
    this.scene.add(new THREE.HemisphereLight('#e9e2d4', '#8f8272', 1.5));
    const sun = new THREE.DirectionalLight('#ffdcaa', 2.5);
    this.sun = sun;
    const n = map.size;
    const reach = n * 0.75 + 4;
    sun.position.set(-reach * 0.95, reach * 0.95, -reach * 0.45);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    const shadow = Math.min(4096, renderer.capabilities.maxTextureSize);
    sun.shadow.mapSize.set(shadow, shadow);
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -reach;
    cam.right = cam.top = reach;
    cam.near = 0.5;
    cam.far = reach * 4;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.006;
    sun.shadow.radius = 1.5;
    this.scene.add(sun, sun.target);

    this.mats = new Materials(lib.textures);
    this.look = routeLook(this.mats);
    this.ghostMaterial = toon('#fff3d6', { emissive: '#ffcf73', glow: 0.4 });
    this.ghostMaterial.transparent = true;
    this.ghostMaterial.opacity = 0.72;
    this.ghostMaterial.depthWrite = false;
    // Where a route stops short: a pulsing red mark at the open edge.
    this.endMaterial = new THREE.MeshBasicMaterial({
      color: '#ff4b3a',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });

    this.root.position.set(-n / 2, 0, -n / 2);
    this.scene.add(this.root);
    this.ground = new Ground(map, this.mats.detail);
    this.ground.mesh.position.set(0, 0, 0);
    this.root.add(this.ground.mesh);
    this.ground.water.position.set(n / 2, this.ground.water.position.y, n / 2);
    this.root.add(this.ground.water);
    this.town = new TownLayer(lib.models, this.mats);
    this.root.add(
      this.statics,
      this.peaks,
      this.rubble,
      this.loose,
      this.ghost,
      this.scenery,
      this.town.group,
    );
    this.traffic = new Traffic(lib.models, this.mats, 0, (x, z) =>
      this.offscreen(x, z),
    );
    this.root.add(this.traffic.group);

    // Only the scene target needs depth and multisampling. The ink target
    // keeps HDR colour without duplicating those expensive attachments.
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    this.composer = new EffectComposer(renderer, target);
    const sceneTarget = this.composer.renderTarget2;
    sceneTarget.depthBuffer = true;
    sceneTarget.depthTexture = new THREE.DepthTexture(
      1,
      1,
      THREE.UnsignedIntType,
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ink = new InkPass();
    this.ink.setCamera(this.camera);
    this.composer.addPass(this.ink);
    this.composer.addPass(new OutputPass());

    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------ framing

  /** The canvas's size and the stage rectangle the board should fill, in CSS pixels. */
  setFrame(width: number, height: number, stage: Rect) {
    if (width !== this.frame.width || height !== this.frame.height)
      this.quality.reset();
    this.frame = { width, height, stage };
    this.setQuality();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.fit();
  }

  /** Adapt only rendering cost. The town, camera and tappable grid stay put. */
  private setQuality() {
    const q = qualityLevels[this.quality.tier];
    const density = renderDensity(
      this.quality.tier,
      window.devicePixelRatio || 1,
      this.frame.width,
      this.frame.height,
    );
    if (this.renderer.getPixelRatio() !== density) {
      this.renderer.setPixelRatio(density);
      this.composer.setPixelRatio(density);
    }
    this.mats.detail.value = q.detail;
    const shadow = Math.min(
      q.shadow,
      this.renderer.capabilities.maxTextureSize,
    );
    if (this.sun.shadow.mapSize.x !== shadow) {
      this.sun.shadow.mapSize.set(shadow, shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapPass?.dispose();
      this.sun.shadow.mapPass = null;
      this.sun.shadow.needsUpdate = true;
    }
    const samples = renderSamples(
      this.quality.tier,
      window.devicePixelRatio || 1,
      this.renderer.capabilities.maxSamples,
    );
    const target = this.composer.renderTarget2;
    if (target.samples !== samples) {
      target.samples = samples;
      target.dispose();
    }
    const canvas = this.renderer.domElement;
    canvas.dataset.quality = this.quality.tier;
    canvas.dataset.density = density.toFixed(2);
  }

  private fit() {
    const { width, height, stage } = this.frame;
    const cam = this.camera;
    cam.aspect = width / Math.max(1, height);
    cam.clearViewOffset();
    const n = this.map.size;
    // Tall stages look down more steeply so the board keeps its shape.
    const tall = stage.h / Math.max(1, stage.w);
    const pitch =
      PITCH + TALL_PITCH * Math.min(1, Math.max(0, (tall - 0.8) / 0.4));
    const dir = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch));
    // The board's outline, with room for the tallest things on its far row.
    const h = n / 2 + 0.16;
    const pts = [
      new THREE.Vector3(-h, 0, -h),
      new THREE.Vector3(h, 0, -h),
      new THREE.Vector3(-h, 0, h),
      new THREE.Vector3(h, 0, h),
      new THREE.Vector3(-h, 0.3, -h),
      new THREE.Vector3(h, 0.3, -h),
    ];
    let dist = n * 2.4;
    const measure = () => {
      cam.position.copy(dir).multiplyScalar(-dist);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const p of pts) {
        const v = p.clone().project(cam);
        const sx = ((v.x + 1) / 2) * width,
          sy = ((1 - v.y) / 2) * height;
        x0 = Math.min(x0, sx);
        x1 = Math.max(x1, sx);
        y0 = Math.min(y0, sy);
        y1 = Math.max(y1, sy);
      }
      return { x0, x1, y0, y1 };
    };
    for (let i = 0; i < 6; i++) {
      const b = measure();
      const s = Math.max(
        (b.x1 - b.x0) / Math.max(1, stage.w),
        (b.y1 - b.y0) / Math.max(1, stage.h),
      );
      dist *= s;
    }
    const b = measure();
    // Shift the picture so the board's box sits in the middle of the stage.
    const dx = stage.x + stage.w / 2 - (b.x0 + b.x1) / 2,
      dy = stage.y + stage.h / 2 - (b.y0 + b.y1) / 2;
    cam.setViewOffset(width, height, -dx, -dy, width, height);
    cam.updateProjectionMatrix();
    const fog = this.scene.fog as THREE.Fog;
    fog.near = dist * 1.15;
    fog.far = dist * 3;
    cam.far = dist * 4;
    cam.updateProjectionMatrix();
    // Ink about two CSS pixels wide, fading with the haze.
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const ink = this.ink.uniforms;
    ink.uTexel.value = new THREE.Vector2(1 / size.x, 1 / size.y);
    ink.uWidth.value = 1.8 * this.renderer.getPixelRatio();
    ink.uFade.value = new THREE.Vector2(dist * 1.05, dist * 2.2);
    this.ink.setCamera(cam);
    // Smoke puffs keep their size on screen.
    this.smoke?.setScale(
      (size.y / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * 1,
    );
    this.overlay();
  }

  /** Is a board point outside the picture? Traffic comes and goes there. */
  private offscreen(x: number, z: number) {
    const n = this.map.size;
    const p = this.project.set(x - n / 2, 0, z - n / 2).project(this.camera);
    return p.z > 1 || Math.abs(p.x) > 1.08 || Math.abs(p.y) > 1.08;
  }

  /** The CSS matrix3d that maps the DOM squares' plane onto the drawn board. */
  private overlay() {
    const { width, height } = this.frame;
    const n = this.map.size;
    const cam = this.camera;
    const pv = new THREE.Matrix4().multiplyMatrices(
      cam.projectionMatrix,
      cam.matrixWorldInverse,
    );
    // (u, v) pixels on the DOM layer → board point on the ground.
    const t = new THREE.Matrix4().set(
      1 / CELL_PX,
      0,
      0,
      -n / 2,
      0,
      0,
      0,
      0,
      0,
      1 / CELL_PX,
      0,
      -n / 2,
      0,
      0,
      0,
      1,
    );
    const m = new THREE.Matrix4().multiplyMatrices(pv, t);
    const e = m.elements; // column-major
    // Rows of clip x, y, w as functions of u, v, 1.
    const row = (r: number) => [e[r], e[4 + r], e[12 + r]];
    const cx = row(0),
      cy = row(1),
      cw = row(3);
    const X = cx.map((c, i) => ((c + cw[i]) * width) / 2);
    const Y = cy.map((c, i) => ((cw[i] - c) * height) / 2);
    const W = cw;
    const css = [
      X[0],
      Y[0],
      0,
      W[0],
      X[1],
      Y[1],
      0,
      W[1],
      0,
      0,
      1,
      0,
      X[2],
      Y[2],
      0,
      W[2],
    ];
    // Normalise so the numbers stay friendly to CSS.
    const k = 1 / W[2];
    this.opts.onOverlay(
      `matrix3d(${css.map((v, i) => (i === 10 ? 1 : v * k)).join(',')})`,
    );
  }

  // ------------------------------------------------------------ the board

  setView(v: BoardView) {
    this.view = v;
    this.traffic.setLivery(v.livery);
    const map = this.map;
    const towns = v.towns.join(',');
    const placedKey = v.cells.map((c) => (c ? `${c.p}${c.o}` : '-')).join('|');

    if (this.keys.statics !== towns) {
      this.keys.statics = towns;
      this.buildStatics(v);
    }
    // Squares: rebuild only the ones that changed.
    const fresh = this.built;
    let latest = -10;
    v.cells.forEach((c, cell) => {
      const key = c ? `${c.p}:${c.o}` : '';
      const entry = this.cells.get(cell);
      if ((entry?.key ?? '') === key) return;
      if (entry) {
        this.root.remove(entry.group);
        disposeGroup(entry.group);
        this.cells.delete(cell);
      }
      if (!c) return;
      const group = this.buildCell(cell, c);
      this.root.add(group);
      const born = fresh && !this.quiet ? this.time : -10;
      latest = Math.max(latest, born);
      this.cells.set(cell, { key, group, born });
    });
    this.built = true;

    // Ridge's outcrops: their bore runs the way the route through them does.
    const peaksKey = map.peaks
      .map((c) => (v.cells[c] ? `${v.cells[c]!.p}${v.cells[c]!.o}` : '-'))
      .join(',');
    if (peaksKey !== this.keys.peaks) {
      this.keys.peaks = peaksKey;
      clear(this.peaks);
      for (const c of map.peaks) {
        const at = cellCentre(map, c);
        const placed = v.cells[c];
        const across = placed
          ? orient(placed.p, placed.o).edges[1] !== 0
          : (c * 7) % 2 === 1;
        this.place(
          this.peaks,
          c % 2 ? 'outcrop_a' : 'outcrop_b',
          at.x,
          at.z,
          across ? Math.PI / 2 : 0,
        );
      }
    }

    const rubbleKey = v.rubble.join(',');
    if (rubbleKey !== this.keys.rubble) {
      this.keys.rubble = rubbleKey;
      clear(this.rubble);
      for (const c of v.rubble) {
        const at = cellCentre(map, c);
        const rot = Math.round((c * 1.7) % 4) * (Math.PI / 2);
        if (!this.place(this.rubble, 'subsidence', at.x, at.z, rot))
          this.place(this.rubble, 'rubble', at.x, at.z, rot);
      }
    }
    const looseKey = v.loose.map((l) => `${l.cell}.${l.dir}`).join(',');
    if (looseKey !== this.keys.loose) {
      this.keys.loose = looseKey;
      for (const m of this.endMarks) m.geometry.dispose();
      this.endMarks = [];
      clear(this.loose);
      for (const l of v.loose) this.looseEnd(l.cell, l.dir, v.cells[l.cell]);
    }
    const ghostKey = v.ghost ? `${v.ghost.cell}:${v.ghost.p}:${v.ghost.o}` : '';
    if (ghostKey !== this.keys.ghost) {
      this.keys.ghost = ghostKey;
      clearDispose(this.ghost);
      if (v.ghost) {
        const at = cellCentre(map, v.ghost.cell);
        for (const m of routeMeshes(
          pieceSegments(v.ghost.p, v.ghost.o, at),
          this.look,
          stationHalf(v.ghost.p),
        )) {
          m.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.material = this.ghostMaterial;
              mesh.castShadow = false;
            }
          });
          this.ghost.add(m);
        }
      }
    }
    // Rivers shape the ground and keep the scenery clear.
    const rivers = this.riverLines(v.cells);
    const riverKey = JSON.stringify(rivers.map((l) => [l[0], l.length]));
    if (riverKey !== this.keys.rivers || !this.keys.scenery) {
      this.keys.rivers = riverKey;
      this.ground.shape({
        map,
        rivers: [...rivers.board, ...rivers.off],
        corridors: exitSegments(map).map((s) => {
          const a = pointAt(s, 0),
            b = pointAt(s, 1);
          return { x0: a.x, z0: a.z, x1: b.x, z1: b.z };
        }),
        hills: map.id === 'ridge' ? ridgeHills(map.size) : undefined,
      });
      this.buildScenery(rivers.off);
    }
    // The ground opens under each overpass for its cutting.
    const cuts = new Map<number, 'x' | 'z'>();
    v.cells.forEach((c, cell) => {
      if (c?.p !== 'overpass') return;
      const t = orient(c.p, c.o);
      cuts.set(cell, t.edges[1] === RAIL ? 'x' : 'z');
    });
    this.ground.setCuts(cuts);
    const focus = [v.ghost?.cell ?? -1, v.turnable ?? -1].filter((c) => c >= 0);
    this.ground.setCells(v.targets, v.strike, focus);

    // The traffic and the town wait for the pieces still dropping in.
    const townKey = `${placedKey}#${v.rubble.join(',')}#${towns}#${!!v.finished}`;
    // A snapshot of another sheet leaves the traffic alone.
    const net = !this.quiet && placedKey !== this.keys.net;
    const town = townKey !== this.keys.town;
    if (net || town) {
      if (net) this.keys.net = placedKey;
      this.keys.town = townKey;
      const cells = v.cells.slice();
      const at = this.quiet
        ? -Infinity
        : Math.max(latest + DROP, this.pending?.at ?? -Infinity);
      this.pending = {
        at,
        net: net
          ? () =>
              this.traffic.setNetwork(network(map, cells), (cell) =>
                cells[cell] ? stationHalf(cells[cell]!.p) : 0.2,
              )
          : this.pending?.net,
        town: () => {
          // Snapshots go back and forth between sheets: keep a few towns.
          let lots = this.towns.get(townKey);
          if (!lots) {
            lots = growTown({
              map,
              cells,
              rubble: v.rubble,
              towns: v.towns,
              finished: v.finished,
            });
            this.towns.set(townKey, lots);
            if (this.towns.size > 8)
              this.towns.delete(this.towns.keys().next().value!);
          }
          this.town.set(lots, this.time, this.quiet || this.opts.still);
        },
      };
      if (this.quiet) this.flush();
    }
  }

  private flush() {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.net?.();
    p.town?.();
  }

  /** River lines on the board, and their runs off it. */
  private riverLines(cells: (Placed | null)[]) {
    const map = this.map;
    const board: Polyline[] = [];
    const off: Polyline[] = [];
    cells.forEach((c, cell) => {
      if (!c) return;
      const at = cellCentre(map, cell);
      for (const s of pieceSegments(c.p, c.o, at)) {
        if (s.kind !== RIVER) continue;
        board.push(samples(s, 0, 1, 0.04).map((p) => ({ x: p.x, z: p.z })));
      }
      const t = orient(c.p, c.o);
      t.edges.forEach((e, d) => {
        if (e !== RIVER) return;
        const x = (cell % map.size) + DX[d],
          y = Math.floor(cell / map.size) + DY[d];
        if (x >= 0 && y >= 0 && x < map.size && y < map.size) return;
        const from = { x: at.x + DX[d] * 0.5, z: at.z + DY[d] * 0.5 };
        const line: Polyline = [];
        for (let k = 0; k <= 150; k++) {
          const s = k * 0.04;
          // A lazy meander once it has left the board.
          const wiggle = Math.sin(s * 1.3 + cell) * 0.18 * Math.min(1, s / 1.5);
          line.push({
            x: from.x + DX[d] * s - DY[d] * wiggle,
            z: from.z + DY[d] * s + DX[d] * wiggle,
          });
        }
        off.push(line);
      });
    });
    return Object.assign([...board, ...off], { board, off });
  }

  /** A model copy, dressed, at a board point. */
  private place(
    group: THREE.Object3D,
    name: string,
    x: number,
    z: number,
    rot = 0,
    scale = 1,
    y = 0,
  ) {
    const src = this.lib.models.get(name);
    if (!src) return null;
    const o = src.clone(true);
    this.mats.dress(o, this.view?.livery ?? 0);
    o.position.set(x, y, z);
    o.rotation.set(0, rot, 0);
    o.scale.setScalar(scale);
    group.add(o);
    return o;
  }

  private buildCell(cell: number, c: Placed) {
    const map = this.map;
    const at = cellCentre(map, cell);
    const group = new THREE.Group();
    const segs = pieceSegments(c.p, c.o, at);
    for (const m of mergeByMaterial(
      routeMeshes(segs, this.look, stationHalf(c.p)),
    ))
      group.add(m);
    if (pieces[c.p].station) {
      // The goods shed, its crane side towards the first rail.
      const t = orient(c.p, c.o);
      const railSide = t.edges.findIndex((e) => e === RAIL);
      const grand = c.p === 'station-cross';
      this.place(
        group,
        grand ? 'goods_grand' : 'goods_shed',
        at.x,
        at.z,
        facing(railSide),
      );
    }
    return group;
  }

  /** The map's fixed things: the ways out, the site's hoarding, the mill
   *  sites, the wharves. */
  private buildStatics(v: BoardView) {
    clearDispose(this.statics);
    const map = this.map;
    const n = map.size;
    const segs = exitSegments(map);
    const props: Placement[] = [];
    const runs: THREE.Object3D[] = [];
    map.exits.forEach((e, i) => {
      runs.push(...exitMeshes(segs[i], this.look, !!e.pier));
      const side = { x: -DY[e.dir], z: DX[e.dir] };
      const from = pointAt(segs[i], 0);
      if (e.pier) {
        // A wharf: a crane on the quay and a steamer alongside.
        const end = pointAt(segs[i], 1);
        props.push({
          name: 'wharf_crane',
          x: (from.x + end.x) / 2 + side.x * 0.36,
          z: (from.z + end.z) / 2 + side.z * 0.36,
          rot: facing(e.dir),
          scale: 1,
        });
        this.place(
          this.statics,
          e.route === ROAD ? 'ferry' : 'fishing_boat',
          end.x + DX[e.dir] * 0.2 - side.x * 0.42,
          end.z + DY[e.dir] * 0.2 - side.z * 0.42,
          facing(e.dir),
          1.4,
          -0.024,
        );
        return;
      }
      if (e.route === RAIL) {
        // The line runs into a tunnel mouth off the board.
        this.place(
          this.statics,
          'tunnel_rail',
          from.x + DX[e.dir] * TUNNEL_AT,
          from.z + DY[e.dir] * TUNNEL_AT,
          facing((e.dir + 2) % 4),
        );
      }
    });
    // The site's hoarding round the board, open where the ways out leave.
    const exitSides = new Set(map.exits.map((e) => `${e.cell}:${e.dir}`));
    for (let k = 0; k < n; k++)
      for (const d of [0, 1, 2, 3]) {
        const cell =
          d === 0
            ? k
            : d === 2
              ? (n - 1) * n + k
              : d === 1
                ? k * n + n - 1
                : k * n;
        if (map.sea.includes(cell)) continue;
        const at = cellCentre(map, cell);
        const x = at.x + DX[d] * 0.53,
          z = at.z + DY[d] * 0.53;
        // Its face to the town outside.
        const rot = facing(d);
        const along = { x: d % 2 ? 0 : 1, z: d % 2 ? 1 : 0 };
        if (exitSides.has(`${cell}:${d}`)) {
          for (const s of [-1, 1])
            props.push({
              name: 'hoarding',
              x: x + along.x * s * 0.39,
              z: z + along.z * s * 0.39,
              rot,
              scale: 0.22,
            });
        } else props.push({ name: 'hoarding', x, z, rot, scale: 1.0 });
      }
    // Mill sites (the Mills extension): footings and a standing chimney.
    for (const c of v.towns) {
      const at = cellCentre(map, c);
      props.push({
        name: 'mill_site',
        x: at.x,
        z: at.z,
        rot: ((c * 3) % 4) * (Math.PI / 2),
        scale: 1,
      });
    }
    for (const m of mergeByMaterial(runs)) this.statics.add(m);
    this.statics.add(instance(this.lib.models, this.mats, props));
  }

  private buildScenery(offRivers: Polyline[]) {
    const key = JSON.stringify(offRivers.map((l) => l[0]));
    if (key === this.keys.scenery) return;
    this.keys.scenery = key;
    clearDispose(this.scenery);
    this.smoke?.dispose();
    const { placements, rows, stacks } = planScenery({
      map: this.map,
      height: (x, z) => this.ground.heightAt(x, z),
      rivers: offRivers,
      // Quality adapts the renderer, never the number/layout of buildings.
      lite: false,
    });
    if (process.env.NODE_ENV === 'development')
      Object.assign(window as object, {
        rotaScenery: placements,
        rotaWorld: this,
      });
    this.scenery.add(
      instance(
        this.lib.models,
        this.mats,
        placements.filter((p) => !p.far),
      ),
    );
    this.scenery.add(
      instance(
        this.lib.models,
        this.mats,
        placements.filter((p) => p.far),
        false,
      ),
    );
    this.scenery.add(townRows(rows, this.mats));
    this.smoke = new Smoke(stacks);
    this.scenery.add(this.smoke.points);
    this.fit();
  }

  /** A loose end: buffers on a rail, a barrier across a street, and a
   *  pulsing red mark on the open edge, so a cut route reads at a glance. */
  private looseEnd(cell: number, dir: number, c: Placed | null) {
    if (!c) return;
    const kind = orient(c.p, c.o).edges[dir];
    if (kind !== RAIL && kind !== ROAD) return;
    const at = cellCentre(this.map, cell);
    this.place(
      this.loose,
      kind === RAIL ? 'buffer_stop' : 'road_barrier',
      at.x + DX[dir] * 0.44,
      at.z + DY[dir] * 0.44,
      facing((dir + 2) % 4),
    );
    // A half ring on the ground round the edge's middle, bulging outwards.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.17, 0.215, 32, 1, 0, Math.PI).rotateX(
        -Math.PI / 2,
      ),
      this.endMaterial,
    );
    ring.position.set(at.x + DX[dir] * 0.5, 0.026, at.z + DY[dir] * 0.5);
    ring.rotation.y = facing(dir) + Math.PI;
    ring.renderOrder = 2;
    this.loose.add(ring);
    this.endMarks.push(ring);
  }

  /** A picture of another sheet on this board, seen straight down (a plan
   *  reads at a glance where the three-quarter view hides things), cropped
   *  to the board. */
  snapshot(view: BoardView, size = 720) {
    const saved = this.view;
    this.quiet = true;
    this.traffic.group.visible = false;
    this.setView({
      ...view,
      targets: undefined,
      ghost: null,
      turnable: undefined,
      strike: -1,
    });
    for (const e of this.cells.values()) e.group.position.y = 0;
    const { width, height } = this.frame;
    const cam = this.camera;
    const fog = this.scene.fog as THREE.Fog;
    // A long lens high above: close to a true plan, and the ink still works.
    const fov = 14;
    const half = this.map.size / 2 + 0.3;
    const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const aspect = width / Math.max(1, height);
    const dist = half / (tan * Math.min(1, aspect));
    cam.fov = fov;
    cam.aspect = aspect;
    cam.clearViewOffset();
    cam.up.set(0, 0, -1);
    cam.position.set(0, dist, 0);
    cam.lookAt(0, 0, 0);
    cam.far = dist * 2;
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    fog.near = dist * 3;
    fog.far = dist * 4;
    this.ink.setCamera(cam);
    this.ink.uniforms.uFade.value = new THREE.Vector2(dist * 3, dist * 4);
    this.render(0);
    const src = this.renderer.domElement;
    const k = src.width / Math.max(1, width);
    // The board's half width on screen, in CSS pixels.
    const px = (half / (dist * tan)) * (height / 2);
    const out = document.createElement('canvas');
    out.width = out.height = size;
    out
      .getContext('2d')
      ?.drawImage(
        src,
        (width / 2 - px) * k,
        (height / 2 - px) * k,
        px * 2 * k,
        px * 2 * k,
        0,
        0,
        size,
        size,
      );
    const url = out.toDataURL('image/jpeg', 0.88);
    cam.fov = FOV;
    cam.up.set(0, 1, 0);
    if (saved) this.setView(saved);
    this.traffic.group.visible = true;
    this.quiet = false;
    // Back to the table's own view (fit resets the fog and the ink too).
    this.fit();
    return url;
  }

  // ------------------------------------------------------------ loop

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden || this.contextLost) {
      this.last = now;
      this.quality.reset();
      return;
    }
    const frameMs = now - this.last;
    const dt = Math.min(0.05, frameMs / 1000);
    this.last = now;
    if (this.quality.sample(frameMs)) {
      this.setQuality();
      this.fit();
    }
    this.time += dt;
    const still = this.opts.still;
    if (this.pending && this.time >= this.pending.at) this.flush();
    this.ground.tick(still ? 1 : this.time);
    this.traffic.tick(dt, !still);
    this.town.tick(this.time);
    this.smoke?.tick(still ? 3.1 : this.time);
    // New pieces drop onto the board with a small bounce.
    for (const e of this.cells.values()) {
      const t = (this.time - e.born) / DROP;
      if (t >= 1 || still) {
        e.group.position.y = 0;
        continue;
      }
      const k = 1 - Math.pow(1 - Math.max(0, t), 3);
      e.group.position.y =
        (1 - k) * 0.35 + Math.sin(Math.min(1, t * 1.2) * Math.PI) * 0.02;
    }
    this.ghost.position.y =
      0.02 + (still ? 0 : Math.sin(this.time * 4) * 0.008);
    this.endMaterial.opacity = still
      ? 0.85
      : 0.5 + 0.45 * (0.5 + 0.5 * Math.sin(this.time * 3.4));
    this.render(dt);
  };

  private render(dt: number) {
    // RenderPass writes the scene to readBuffer; InkPass writes its colour
    // to writeBuffer. Keep their attachment roles fixed on every frame.
    this.composer.readBuffer = this.composer.renderTarget2;
    this.composer.writeBuffer = this.composer.renderTarget1;
    this.composer.render(dt);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.onContextLost,
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.onContextRestored,
    );
    this.traffic.clear();
    for (const e of this.cells.values()) disposeGroup(e.group);
    clearDispose(this.statics);
    clearDispose(this.peaks);
    clearDispose(this.rubble);
    clearDispose(this.loose);
    clearDispose(this.ghost);
    clearDispose(this.scenery);
    this.town.dispose();
    this.smoke?.dispose();
    this.ground.dispose();
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
    this.environment.dispose();
    this.sun.shadow.dispose();
    this.endMaterial.dispose();
    this.ghostMaterial.dispose();
    this.mats.dispose();
    this.renderer.dispose();
  }
}

function ridgeHills(n: number) {
  return [
    { x: -3, z: -3, r: 3, h: 0.5 },
    { x: n + 3, z: -2, r: 3.5, h: 0.6 },
    { x: -4, z: n + 1, r: 3, h: 0.4 },
    { x: n + 4, z: n + 2, r: 3, h: 0.45 },
  ];
}

function clear(g: THREE.Object3D) {
  for (const c of g.children.slice()) g.remove(c);
}
/** Remove and free geometry made in code (models' geometry is shared and kept). */
function clearDispose(g: THREE.Object3D) {
  for (const c of g.children.slice()) {
    g.remove(c);
    disposeGroup(c);
  }
}
function disposeGroup(o: THREE.Object3D) {
  o.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if ((n as THREE.InstancedMesh).isInstancedMesh)
      (n as THREE.InstancedMesh).dispose();
    if (
      mesh.isMesh &&
      !mesh.userData.shared &&
      mesh.geometry &&
      !(mesh.geometry.userData as { model?: boolean }).model
    )
      if (!(n as THREE.InstancedMesh).isInstancedMesh) mesh.geometry.dispose();
  });
}

export type { Segment };
