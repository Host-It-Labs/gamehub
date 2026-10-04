import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import outlines from '@/lib/games/party/size-outlines.json';
import silhouettes from '@/lib/games/party/size-silhouettes.json';
import { country, thing, type SizeKind } from '@/lib/games/party/size';

/** Sizes' 3D table: every silhouette is an extruded piece on the green
 * cutting mat, lit by the desk lamp. Things stand up like thick standees;
 * countries lie flat like map pieces. Units are the reference's longest
 * side, so the reference is always about one unit big. The scene owns the
 * camera (it frames whatever is on the mat), picking, and dragging pieces;
 * the size itself always comes from the React side. */

export type Finish = 'cream' | 'enamel' | 'gold' | 'seat';
export type PieceSpec = {
  key: string;
  kind: SizeKind;
  item: string;
  /** Longest side of the piece, in scene units. */
  size: number;
  /** Centre of the piece on the mat. */
  x: number;
  z: number;
  finish: Finish;
  color?: string;
  /** Can be dragged around the mat. */
  movable?: boolean;
  /** Steps in front of (or, flat, lies on top of) pieces it overlaps. */
  front?: boolean;
  /** Seconds after setPieces before it rises out of the mat. */
  delay?: number;
  /** Dimmed while another piece is singled out. */
  dim?: boolean;
};
export type Anchor = 'base' | 'corner' | 'foot';
type Outline = {
  loops: number[][];
  w: number;
  h: number;
  x: number;
  y: number;
};

const MAT = '#1f5a4a';
const flatDepth = 0.035,
  standDepth = 0.09;

/** A silhouette's loops in its own pixel box (y down). */
function outline(kind: SizeKind, id: string): Outline {
  if (kind === 'country') {
    const loops: number[][] = [];
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const part of country(id)!.path.split('Z')) {
      const n = part.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      if (n.length < 6) continue;
      loops.push(n);
      for (let i = 0; i + 1 < n.length; i += 2) {
        x0 = Math.min(x0, n[i]);
        x1 = Math.max(x1, n[i]);
        y0 = Math.min(y0, n[i + 1]);
        y1 = Math.max(y1, n[i + 1]);
      }
    }
    return { loops, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const t = thing(id)!;
  const sheet = t.sheet as keyof typeof silhouettes.sheets;
  const c = silhouettes.sheets[sheet][t.cell];
  return {
    loops: (outlines.sheets as Record<string, number[][][]>)[sheet][t.cell],
    x: 0,
    y: 0,
    w: c.w,
    h: c.h,
  };
}

function area(p: THREE.Vector2[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return a / 2;
}
function inside(pt: THREE.Vector2, poly: THREE.Vector2[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x
    )
      hit = !hit;
  }
  return hit;
}
/** Loops to shapes with holes: a loop inside an odd number of others is a
 * hole in the smallest one around it. */
function shapes(o: Outline): THREE.Shape[] {
  const k = 1 / Math.max(o.w, o.h);
  const polys = o.loops
    .map((l) => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i + 1 < l.length; i += 2)
        pts.push(
          new THREE.Vector2(
            (l[i] - o.x - o.w / 2) * k,
            (o.y + o.h - l[i + 1]) * k,
          ),
        );
      return { pts, area: Math.abs(area(pts)) };
    })
    .filter((p) => p.area > 1e-7)
    .sort((a, b) => b.area - a.area);
  const parent: number[] = [],
    depth: number[] = [];
  polys.forEach((p, i) => {
    parent[i] = -1;
    depth[i] = 0;
    for (let j = i - 1; j >= 0; j--)
      if (inside(p.pts[0], polys[j].pts)) {
        parent[i] = j;
        depth[i] = depth[j] + 1;
        break;
      }
  });
  const made = new Map<number, THREE.Shape>();
  polys.forEach((p, i) => {
    if (depth[i] % 2 === 0) {
      const pts = area(p.pts) < 0 ? [...p.pts].reverse() : p.pts;
      made.set(i, new THREE.Shape(pts));
    } else {
      const s = made.get(parent[i]);
      if (s) {
        const pts = area(p.pts) > 0 ? [...p.pts].reverse() : p.pts;
        s.holes.push(new THREE.Path(pts));
      }
    }
  });
  return [...made.values()];
}

type Built = {
  geometry: THREE.BufferGeometry;
  /** Box of the unit piece: width, height (up) and depth. */
  box: THREE.Vector3;
};
const built = new Map<string, Built>();
/** One unit-sized geometry per silhouette, base on the mat, centred. */
function piece(kind: SizeKind, id: string): Built {
  const key = `${kind}:${id}`;
  let b = built.get(key);
  if (b) return b;
  const o = outline(kind, id);
  const flat = kind === 'country';
  const depth = flat ? flatDepth : standDepth;
  const geometry = new THREE.ExtrudeGeometry(shapes(o), {
    depth,
    bevelEnabled: true,
    bevelThickness: flat ? 0.004 : 0.008,
    bevelSize: flat ? 0.002 : 0.004,
    bevelSegments: 2,
  });
  const k = 1 / Math.max(o.w, o.h);
  if (flat) {
    // Lie it down, north away from the camera, centred on the mat.
    geometry.translate(0, (-o.h * k) / 2, 0);
    geometry.rotateX(-Math.PI / 2);
  } else geometry.translate(0, 0, -depth / 2);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  if (flat) geometry.translate(0, -bb.min.y, 0);
  else geometry.translate(0, -bb.min.y, 0);
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox!.getSize(size);
  b = { geometry, box: size };
  built.set(key, b);
  return b;
}
/** The unit box of a piece (width, height, depth) without building it twice. */
export function pieceBox(kind: SizeKind, id: string) {
  return piece(kind, id).box.clone();
}

function materials(finish: Finish, env: THREE.Texture, color?: string) {
  const make = (c: THREE.ColorRepresentation, side: boolean) => {
    const base = new THREE.Color(c);
    if (side) base.multiplyScalar(0.72);
    switch (finish) {
      case 'cream':
        return new THREE.MeshStandardMaterial({
          color: base,
          roughness: 0.62,
          metalness: 0,
          envMapIntensity: 0.15,
        });
      case 'gold':
        return new THREE.MeshPhysicalMaterial({
          color: base,
          roughness: 0.28,
          metalness: 0.65,
          clearcoat: 0.6,
          emissive: new THREE.Color('#5a3a00'),
          emissiveIntensity: 0.25,
          envMapIntensity: 0.9,
        });
      default:
        return new THREE.MeshPhysicalMaterial({
          color: base,
          roughness: 0.32,
          metalness: 0,
          clearcoat: 0.9,
          clearcoatRoughness: 0.18,
          envMapIntensity: 0.2,
        });
    }
  };
  const c =
    finish === 'cream'
      ? '#f4e7c6'
      : finish === 'gold'
        ? '#f2b631'
        : finish === 'enamel'
          ? '#ef4b2c'
          : (color ?? '#ef4b2c');
  const out = [make(c, false), make(c, true)];
  // Each finish reflects the room by its own amount.
  for (const m of out) m.envMap = env;
  return out;
}

/** The cutting mat: deep green with a pale grid, fine every quarter unit and
 * bold every unit, drawn once and tiled. */
function matTexture() {
  const s = 512,
    c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.fillStyle = MAT;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(232,243,207,0.16)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const p = (i * s) / 4;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, s);
    g.moveTo(0, p);
    g.lineTo(s, p);
    g.stroke();
  }
  g.strokeStyle = 'rgba(232,243,207,0.34)';
  g.lineWidth = 4;
  g.strokeRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

type Live = {
  spec: PieceSpec;
  mesh: THREE.Mesh;
  mats: THREE.Material[];
  box: THREE.Vector3;
  /** Smoothed values the frame loop eases towards the spec. */
  x: number;
  z: number;
  y: number;
  size: number;
  rise: number;
  fade: number;
  born: number;
};
type Gesture =
  | {
      type: 'move';
      id: number;
      key: string;
      plane: THREE.Plane;
      grab: THREE.Vector3;
      from: { x: number; z: number };
    }
  | { type: 'pinch'; d: number };

export type SceneEvents = {
  /** A piece was dragged to a new place (sent continuously). */
  onMove?: (key: string, x: number, z: number) => void;
  /** Two fingers pinched by `factor` since the last call. */
  onPinch?: (factor: number, done: boolean) => void;
  /** The wheel turned over the mat: grow (>1) or shrink (<1). */
  onWheel?: (factor: number) => void;
  onHover?: (key: string | null) => void;
  onTap?: (key: string | null) => void;
  /** Whether anything is being dragged right now. */
  onGesture?: (active: boolean) => void;
};

export class SizeScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
  private sun: THREE.DirectionalLight;
  private env: THREE.Texture;
  private ground: THREE.Mesh;
  private pieces = new Map<string, Live>();
  private anchors = new Map<HTMLElement, { key: string; where: Anchor }>();
  private raf = 0;
  private disposed = false;
  private width = 1;
  private height = 1;
  private flat: boolean;
  private reduced: boolean;
  /** Pixels kept clear on the right (the tape); the view centres left of it. */
  private padRight: number;
  /** The one fixed angle: turned and raised enough to show depth. */
  private view = { yaw: -24, pitch: 20 };
  private eye = { dist: 4, cx: 0, cy: 0.5, cz: 0 };
  private frozen = false;
  /** The first frame frames at once instead of easing in from afar. */
  private settled = false;
  private framing: string[] | null = null;
  private frameCap: number | null = null;
  private gesture: Gesture | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private hovered: string | null = null;
  private downAt: { x: number; y: number; key: string | null } | null = null;
  private ray = new THREE.Raycaster();
  private observer: ResizeObserver;
  private events: SceneEvents = {};
  /** What the scene reports back: drags, pinches, wheel, hover and taps. */
  listen(events: SceneEvents) {
    this.events = events;
  }

  constructor(
    private host: HTMLElement,
    opts: { flat: boolean; reduced: boolean; padRight?: number },
  ) {
    this.flat = opts.flat;
    this.padRight = opts.padRight ?? 0;
    this.reduced = opts.reduced;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(MAT);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'size-canvas';
    host.prepend(this.canvas);
    if (this.flat) this.view = { yaw: -16, pitch: 48 };

    this.scene.fog = new THREE.Fog(MAT, 10, 40);
    // A soft room to reflect, so enamel shines and gold reads as gold.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight('#fff4dc', '#16443a', 1.0));
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    const rim = new THREE.DirectionalLight('#bfe8ff', 0.55);
    rim.position.set(3, 2, -4);
    this.scene.add(rim);

    const tex = matTexture();
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.92,
        envMapIntensity: 0,
      }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.bind();
  }

  /** Put these pieces on the mat; matching keys keep their state. */
  setPieces(specs: PieceSpec[]) {
    const now = performance.now();
    const keep = new Set(specs.map((s) => s.key));
    for (const [key, p] of this.pieces)
      if (!keep.has(key)) {
        this.scene.remove(p.mesh);
        p.mats.forEach((m) => m.dispose());
        this.pieces.delete(key);
      }
    for (const spec of specs) {
      const old = this.pieces.get(spec.key);
      if (
        old &&
        old.spec.item === spec.item &&
        old.spec.finish === spec.finish
      ) {
        old.spec = spec;
        continue;
      }
      if (old) {
        this.scene.remove(old.mesh);
        old.mats.forEach((m) => m.dispose());
      }
      const b = piece(spec.kind, spec.item);
      const mats = materials(spec.finish, this.env, spec.color);
      const mesh = new THREE.Mesh(b.geometry, mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.key = spec.key;
      this.scene.add(mesh);
      const rises = spec.delay !== undefined && !this.reduced;
      this.pieces.set(spec.key, {
        spec,
        mesh,
        mats,
        box: b.box,
        x: spec.x,
        z: spec.z,
        y: 0,
        size: spec.size,
        rise: rises ? 0 : 1,
        fade: 1,
        born: now + (spec.delay ?? 0) * 1000,
      });
    }
    this.wake();
  }

  /** Frame only these pieces (by key), capping each one's size for the
   * framing at `cap` units so a wild guess cannot shrink everyone else. */
  frame(keys: string[] | null, cap: number | null = null) {
    this.framing = keys;
    this.frameCap = cap;
    this.wake();
  }

  /** Keep the camera still while a size is being dragged, so the pointer's
   * scale never feeds back into the size. */
  freeze(on: boolean) {
    this.frozen = on;
    this.wake();
  }

  /** Keep `el` pinned to a point of a piece, every frame. */
  anchor(el: HTMLElement | null, key: string, where: Anchor) {
    if (!el) return;
    this.anchors.set(el, { key, where });
    this.wake();
  }
  unanchor(el: HTMLElement | null) {
    if (el) this.anchors.delete(el);
  }

  /** Where a piece's corner is on screen, for gestures driven from the DOM. */
  screenOf(key: string, where: Anchor) {
    const p = this.pieces.get(key);
    if (!p) return null;
    const v = this.point(p, where).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * this.width,
      y: ((1 - v.y) / 2) * this.height,
    };
  }

  /** Scene units per screen pixel at a piece, along the screen. */
  unitsPerPixel(key: string) {
    const p = this.pieces.get(key);
    if (!p) return 1;
    const at = new THREE.Vector3(p.x, p.y, p.z);
    const d = at.distanceTo(this.camera.position);
    return (
      (2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) /
      this.height
    );
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.unbind();
    for (const p of this.pieces.values()) p.mats.forEach((m) => m.dispose());
    this.ground.geometry.dispose();
    const gm = this.ground.material as THREE.MeshStandardMaterial;
    gm.map?.dispose();
    gm.dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth),
      h = Math.max(1, this.host.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const pad = Math.min(this.padRight, w * 0.3);
    this.camera.aspect = (w - pad) / h;
    if (pad) this.camera.setViewOffset(w - pad, h, 0, 0, w, h);
    this.camera.updateProjectionMatrix();
    this.wake();
  }

  private point(p: Live, where: Anchor) {
    const s = p.size,
      w = p.box.x * s,
      h = p.box.y * s,
      d = p.box.z * s;
    // The top right corner, nearest the camera; flat pieces, the far one.
    if (where === 'corner')
      return new THREE.Vector3(
        p.x + w / 2,
        p.y + h,
        p.z + (this.flat ? -d / 2 : d / 2),
      );
    // The bottom left corner nearest the camera: growing keeps it still.
    if (where === 'foot')
      return new THREE.Vector3(p.x - w / 2, p.y, p.z + d / 2);
    // Under the piece's front edge, on the mat.
    return new THREE.Vector3(p.x, 0, p.z + d / 2);
  }

  private wake() {
    if (!this.raf && !this.disposed)
      this.raf = requestAnimationFrame(() => this.tick());
  }

  /** Eases everything towards its target; sleeps once nothing moves. */
  private tick() {
    this.raf = 0;
    if (this.disposed) return;
    const now = performance.now();
    const ease = this.reduced ? 1 : 0.22;
    let moving = false;
    const lerp = (a: number, b: number, k = ease) => {
      const v = a + (b - a) * k;
      if (Math.abs(b - v) > Math.max(1e-4, Math.abs(b) * 1e-4)) moving = true;
      return Math.abs(b - v) <= Math.max(1e-4, Math.abs(b) * 1e-4) ? b : v;
    };
    const focusing = [...this.pieces.values()].some((p) => p.spec.dim);
    for (const p of this.pieces.values()) {
      const s = p.spec;
      const step = this.step(p);
      p.x = lerp(p.x, s.x, this.reduced ? 1 : 0.35);
      p.z = lerp(p.z, s.z + step.z, this.reduced ? 1 : 0.25);
      p.size = lerp(p.size, s.size, this.reduced ? 1 : 0.4);
      if (p.rise < 1) {
        const t = (now - p.born) / 520;
        p.rise = Math.max(0, Math.min(1, t));
        moving = true;
      }
      p.y = lerp(p.y, step.y, this.reduced ? 1 : 0.25);
      const fade = focusing && s.dim ? 0.22 : 1;
      p.fade = lerp(p.fade, fade, 0.25);
      for (const m of p.mats) {
        const see = p.fade < 0.999;
        if (m.transparent !== see) {
          m.transparent = see;
          m.needsUpdate = true;
        }
        m.opacity = p.fade;
        m.depthWrite = p.fade > 0.5;
      }
      // Rises out of the mat with a little overshoot.
      const r = p.rise,
        grow = r >= 1 ? 1 : 1 - Math.pow(1 - r, 3) * Math.cos(r * 4);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.scale.set(p.size, p.size * Math.max(0.001, grow), p.size);
      p.mesh.visible = r > 0;
    }
    moving = this.aim(lerp) || moving;
    this.render();
    if (moving) this.wake();
  }

  /** A front piece dragged over another lies on top of it (flat) or steps
   * in front of it (standing), so the two never pass through each other. */
  private step(p: Live) {
    const out = { y: 0, z: 0 };
    if (!p.spec.front) return out;
    const a = this.footprint(p);
    for (const o of this.pieces.values()) {
      if (o === p || o.spec.front) continue;
      const b = this.footprint(o);
      if (this.flat) {
        if (a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0)
          out.y = Math.max(out.y, o.box.y * o.spec.size + 0.002);
      } else if (
        a.x0 < b.x1 &&
        a.x1 > b.x0 &&
        Math.abs(p.spec.z - o.spec.z) < b.z1 - b.z0
      )
        out.z = Math.max(
          out.z,
          (b.z1 - b.z0) / 2 + (a.z1 - a.z0) / 2 + 0.01 + (o.spec.z - p.spec.z),
        );
    }
    return out;
  }
  private footprint(p: Live) {
    const w = (p.box.x * p.spec.size) / 2,
      d = (p.box.z * p.spec.size) / 2;
    return {
      x0: p.spec.x - w,
      x1: p.spec.x + w,
      z0: p.spec.z - d,
      z1: p.spec.z + d,
    };
  }

  /** Points the camera so the framed pieces fill the view. */
  private aim(lerp: (a: number, b: number, k?: number) => number) {
    const boxes: THREE.Box3[] = [];
    for (const p of this.pieces.values()) {
      if (this.framing && !this.framing.includes(p.spec.key)) continue;
      const s = this.frameCap
        ? Math.min(p.spec.size, this.frameCap)
        : p.spec.size;
      const w = (p.box.x * s) / 2,
        h = p.box.y * s,
        d = (p.box.z * s) / 2;
      boxes.push(
        new THREE.Box3(
          new THREE.Vector3(p.spec.x - w, 0, p.spec.z - d),
          new THREE.Vector3(p.spec.x + w, h, p.spec.z + d),
        ),
      );
    }
    const all = new THREE.Box3();
    boxes.forEach((b) => all.union(b));
    if (all.isEmpty())
      all.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    const centre = all.getCenter(new THREE.Vector3());
    const yaw = THREE.MathUtils.degToRad(this.view.yaw),
      pitch = THREE.MathUtils.degToRad(this.view.pitch);
    const back = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    const fwd = back.clone().negate();
    const right = new THREE.Vector3()
      .crossVectors(fwd, new THREE.Vector3(0, 1, 0))
      .normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)),
      tanH = tanV * this.camera.aspect;
    // Leave room at the edges: labels below, a handle above, the rail.
    const mx = 0.8,
      my = 0.72;
    let dist = 0.5;
    for (const b of boxes.length ? boxes : [all])
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Vector3(
          i & 1 ? b.max.x : b.min.x,
          i & 2 ? b.max.y : b.min.y,
          i & 4 ? b.max.z : b.min.z,
        ).sub(centre);
        const x = c.dot(right),
          y = c.dot(up),
          z = c.dot(fwd);
        dist = Math.max(
          dist,
          z + Math.abs(x) / (tanH * mx),
          z + Math.abs(y) / (tanV * my),
        );
      }
    let moving = false;
    if (!this.settled && boxes.length) {
      this.settled = true;
      Object.assign(this.eye, {
        cx: centre.x,
        cy: centre.y,
        cz: centre.z,
        dist,
      });
    }
    if (!this.frozen) {
      const before = { ...this.eye };
      this.eye.cx = lerp(this.eye.cx, centre.x, 0.16);
      // Look a touch below the middle so labels under the pieces fit.
      this.eye.cy = lerp(
        this.eye.cy,
        centre.y - (all.max.y - all.min.y) * 0.04,
        0.16,
      );
      this.eye.cz = lerp(this.eye.cz, centre.z, 0.16);
      this.eye.dist = lerp(this.eye.dist, dist, 0.16);
      moving = (Object.keys(before) as (keyof typeof before)[]).some(
        (k) => before[k] !== this.eye[k],
      );
    }
    const target = new THREE.Vector3(this.eye.cx, this.eye.cy, this.eye.cz);
    this.camera.position.copy(back).multiplyScalar(this.eye.dist).add(target);
    this.camera.near = this.eye.dist / 100;
    this.camera.far = this.eye.dist * 40;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(target);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.eye.dist * 1.6;
    fog.far = this.eye.dist * 7;
    // The mat follows the camera; its grid stays put in the world.
    const g = this.eye.dist * 20;
    this.ground.scale.set(g, g, 1);
    this.ground.position.set(target.x, 0, target.z);
    const tex = (this.ground.material as THREE.MeshStandardMaterial).map!;
    const cell = this.cell();
    tex.repeat.set(g / cell, g / cell);
    tex.offset.set(
      ((target.x - g / 2) / cell) % 1,
      ((-target.z - g / 2) / cell) % 1,
    );
    // The lamp: upper left, in front, its shadow box around the pieces.
    const span = Math.max(
      all.max.x - all.min.x,
      all.max.y - all.min.y,
      all.max.z - all.min.z,
      0.5,
    );
    this.sun.position.set(
      centre.x - span * 1.4,
      span * 2.4,
      centre.z + span * 1.6,
    );
    this.sun.target.position.copy(centre);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -span * 1.6;
    cam.right = cam.top = span * 1.6;
    cam.near = span * 0.2;
    cam.far = span * 8;
    cam.updateProjectionMatrix();
    return moving;
  }

  /** Grid spacing: the power of ten near a quarter of the view. */
  private cell() {
    const want = this.eye.dist * 0.18;
    const p = Math.pow(10, Math.floor(Math.log10(want)));
    return want / p > 5 ? p * 5 : want / p > 2 ? p * 2 : p;
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
    for (const [el, a] of this.anchors) {
      const p = this.pieces.get(a.key);
      if (!p || !el.isConnected) {
        this.anchors.delete(el);
        continue;
      }
      const v = this.point(p, a.where).project(this.camera);
      const x = ((v.x + 1) / 2) * this.width,
        y = ((1 - v.y) / 2) * this.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = p.rise > 0.6 && v.z < 1 ? '' : '0';
    }
  }

  // ---- input ----
  private pick(x: number, y: number): string | null {
    const ndc = new THREE.Vector2(
      (x / this.width) * 2 - 1,
      -(y / this.height) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects(
      [...this.pieces.values()]
        .filter((p) => p.mesh.visible)
        .map((p) => p.mesh),
      false,
    )[0];
    return (hit?.object.userData.key as string | undefined) ?? null;
  }
  private local(e: PointerEvent | WheelEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private rayAt(x: number, y: number) {
    this.ray.setFromCamera(
      new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1),
      this.camera,
    );
    return this.ray.ray;
  }
  private down = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    this.canvas.setPointerCapture(e.pointerId);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) };
      this.events.onGesture?.(true);
      this.downAt = null;
      return;
    }
    const key = this.pick(p.x, p.y);
    this.downAt = { ...p, key };
    const live = key ? this.pieces.get(key) : undefined;
    if (live?.spec.movable) {
      const ray = this.rayAt(p.x, p.y);
      const hit = new THREE.Vector3();
      const steep = this.view.pitch > 28;
      // Steep views slide pieces over the mat; low views slide them
      // sideways on an upright plane facing the camera.
      const plane = steep
        ? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        : new THREE.Plane().setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 0, 1).applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              THREE.MathUtils.degToRad(this.view.yaw),
            ),
            new THREE.Vector3(live.x, 0, live.z),
          );
      if (ray.intersectPlane(plane, hit)) {
        this.gesture = {
          type: 'move',
          id: e.pointerId,
          key: key!,
          plane,
          grab: hit,
          from: { x: live.spec.x, z: live.spec.z },
        };
        this.frozen = true;
        this.events.onGesture?.(true);
        return;
      }
    }
  };
  private moveEv = (e: PointerEvent) => {
    const p = this.local(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    const g = this.gesture;
    if (!g) {
      if (e.pointerType === 'mouse') {
        const key = this.pick(p.x, p.y);
        const movable = key && this.pieces.get(key)?.spec.movable;
        this.canvas.style.cursor = movable
          ? 'grab'
          : key
            ? 'pointer'
            : 'default';
        if (key !== this.hovered) {
          this.hovered = key;
          this.events.onHover?.(key);
        }
      }
      return;
    }
    if (g.type === 'pinch' && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.d > 0 && d > 0) this.events.onPinch?.(d / g.d, false);
      g.d = d;
      return;
    }
    if (g.type === 'pinch' || g.id !== e.pointerId) return;
    if (this.downAt && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > 6)
      this.downAt = null;
    const hit = new THREE.Vector3();
    if (!this.rayAt(p.x, p.y).intersectPlane(g.plane, hit)) return;
    const dx = hit.x - g.grab.x,
      dz = hit.z - g.grab.z;
    this.canvas.style.cursor = 'grabbing';
    this.events.onMove?.(
      g.key,
      g.from.x + dx,
      g.from.z + (g.plane.normal.y ? dz : 0),
    );
  };
  private up = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g?.type === 'pinch') {
      if (this.pointers.size < 2) {
        this.gesture = null;
        this.events.onPinch?.(1, true);
        this.events.onGesture?.(false);
      }
      return;
    }
    if (this.downAt && e.type === 'pointerup')
      this.events.onTap?.(this.downAt.key);
    this.downAt = null;
    if (g && g.id === e.pointerId) {
      this.gesture = null;
      if (g.type === 'move') {
        this.frozen = false;
        this.events.onGesture?.(false);
        this.wake();
      }
    }
  };
  private wheel = (e: WheelEvent) => {
    if (!this.events.onWheel) return;
    e.preventDefault();
    const k = e.ctrlKey ? 0.01 : 0.0018;
    this.events.onWheel(Math.exp(-e.deltaY * k));
  };
  private leave = () => {
    if (this.hovered !== null) {
      this.hovered = null;
      this.events.onHover?.(null);
    }
  };
  private bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', this.down);
    c.addEventListener('pointermove', this.moveEv);
    c.addEventListener('pointerup', this.up);
    c.addEventListener('pointercancel', this.up);
    c.addEventListener('pointerleave', this.leave);
    c.addEventListener('wheel', this.wheel, { passive: false });
  }
  private unbind() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.down);
    c.removeEventListener('pointermove', this.moveEv);
    c.removeEventListener('pointerup', this.up);
    c.removeEventListener('pointercancel', this.up);
    c.removeEventListener('pointerleave', this.leave);
    c.removeEventListener('wheel', this.wheel);
  }
}

/** Whether this browser can draw the 3D table. */
let webgl: boolean | null = null;
export function hasWebGL() {
  if (webgl === null)
    try {
      const c = document.createElement('canvas');
      webgl = !!(c.getContext('webgl2') ?? c.getContext('webgl'));
    } catch {
      webgl = false;
    }
  return webgl;
}
