'use client';
import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { seatColours } from '@/lib/games/alto/art';
import { buildPlanet, spaceLights, type Planet } from './alto-3d';
import { buildBase, type Base } from './alto-base';
import { baseFrame, shipPreviewFrame } from './alto-framing';
import { startRatio } from '../render-quality';
import { planById } from '@/lib/games/alto/content';
import {
  buildShip,
  buildShopModel,
  shipBounds,
  type Ship,
  type Upgrade,
} from './alto-ship';

/**
 * Alto's one 3D layer, laid over the painted space and under every control.
 * The DOM keeps the layout: each planet slot, each player's base slot and
 * each shop item are measured every frame and the 3D is drawn into them, so
 * the planets stay buttons, the piles stay text and nothing about the layout
 * depends on WebGL. Without WebGL the DOM's own fallbacks simply stay.
 *
 * Nothing shows half-built: everything the table needs is built and its
 * shaders compiled first, while the loading screen reports progress. Each
 * year's planets are built during the last turn of the year before.
 *
 * Every player's ship stands on the pad of their base between flights. At a
 * reveal the ships fly out and hover in front of their planet, never through
 * it, its moons or its rings, then fly home.
 */

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(startRatio(window.innerWidth, window.innerHeight));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}
function environment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  strength = 0.35,
) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = strength;
  pmrem.dispose();
}
const disposeTree = (root: THREE.Object3D) => {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const m = o.material as THREE.Material | THREE.Material[];
      (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    }
  });
};

/** Where each player's ship is going: a planet index, or home. */
export type ShipTargets = (number | null)[];

type Flight = {
  ship: Ship;
  island: number | null;
  /** Position, turn and size at the start of the current leg, in world pixels. */
  from: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  fromScale: number;
  start: number;
  mode: 'fly' | 'hover' | 'return' | 'docked';
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
  landed: number;
};

const FLY = 1.15;
const RETURN = 1.0;
const ease = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
/** Bases look down a little, so their decks read from above while the
 * modules still stand up. */
const BASE_TILT = 0.5;
/** How much of its slot a base fills, leaving room for its gentle bob. */
const BASE_FILL = 0.94;
/** Time spent building per frame while loading; the bar moves between. */
const SLICE_MS = 14;

export type Year = 1 | 2 | 3;

export function AltoSpace({
  root,
  ships,
  kits,
  ghost,
  viewer,
  year = 2,
  prepareYear,
  onProgress,
  onReady,
}: {
  root: RefObject<HTMLElement | null>;
  ships: ShipTargets;
  /** Every upgrade each seat owns: ship parts on the ship, base modules on the base. */
  kits: readonly (readonly string[])[];
  /** The upgrade you are about to build, shown see-through on your ship or base. */
  ghost?: string | null;
  viewer: number;
  /** Which year's planets to show. */
  year?: Year;
  /** A year to build ahead of time, so its planets are ready when it starts. */
  prepareYear?: Year | null;
  /** Loading progress, 0 to 1. */
  onProgress?: (done: number) => void;
  /** True once everything is built and shown; false without WebGL. */
  onReady?: (ready: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({
    ships,
    kits,
    ghost,
    year,
    prepareYear,
    onProgress,
    onReady,
  });
  useEffect(() => {
    live.current = {
      ships,
      kits,
      ghost,
      year,
      prepareYear,
      onProgress,
      onReady,
    };
  });

  useEffect(() => {
    const el = canvas.current;
    const world = root.current;
    if (!el || !world) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = makeRenderer(el);
    } catch {
      live.current.onReady?.(false);
      return;
    }
    renderer.autoClear = false;
    const scene = new THREE.Scene();
    environment(renderer, scene);
    spaceLights(scene);
    const camera = new THREE.PerspectiveCamera(22, 1, 1, 10000);
    // The shop: one object at a time, each in its own viewport.
    const shop = new THREE.Scene();
    environment(renderer, shop, 0.55);
    const shopLights = spaceLights(shop, 1.1);
    const shopStrength = shopLights.map((l) => l.intensity);
    const shopCamera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    shopCamera.position.set(0, 0.9, 4.2);
    shopCamera.lookAt(0, 0, 0);
    const models = new Map<string, Upgrade>();

    /** Planets by `${id}:${year}`. */
    const planets = new Map<string, Planet>();
    const bases = new Map<number, Base>();
    const flights = new Map<number, Flight>();
    const still = reducedMotion();
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = performance.now();
    let clock = 0;
    let loading = true;
    let compiling = false;
    let disposed = false;

    const toWorld = (x: number, y: number, out = new THREE.Vector3()) =>
      out.set(x - width / 2, height / 2 - y, 0);
    const resize = () => {
      const r = el.getBoundingClientRect();
      if (Math.abs(r.width - width) < 0.5 && Math.abs(r.height - height) < 0.5)
        return;
      width = r.width;
      height = r.height;
      // Native density on powerful devices, the power's budget elsewhere.
      renderer.setPixelRatio(startRatio(width, height));
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      // World units are screen pixels on the z = 0 plane.
      camera.position.set(
        0,
        0,
        height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)),
      );
      camera.near = 10;
      camera.far = camera.position.z * 3;
      camera.updateProjectionMatrix();
    };

    // ——— Building ———

    const planetIds = () =>
      [...world.querySelectorAll<HTMLElement>('.alto-planet[data-island]')].map(
        (li) => li.dataset.island!,
      );
    const baseSeats = () =>
      [...world.querySelectorAll<HTMLElement>('[data-base-seat]')].map((n) =>
        Number(n.dataset.baseSeat),
      );
    const shopIds = () =>
      [
        ...world.querySelectorAll<HTMLElement>('.alto-item-art[data-model]'),
      ].map((n) => n.dataset.model!);
    const planetKey = (id: string, y: Year) => `${id}:${y}`;
    const makePlanet = (id: string, y: Year) => {
      const planet = buildPlanet(id, y);
      planet.group.visible = false;
      planets.set(planetKey(id, y), planet);
      scene.add(planet.group);
      return planet;
    };
    const makeBase = (seat: number) => {
      const base = buildBase(seatColours[seat % seatColours.length]);
      base.group.visible = false;
      bases.set(seat, base);
      scene.add(base.group);
      return base;
    };
    const makeShip = (seat: number) => {
      const ship = buildShip(seatColours[seat % seatColours.length]);
      ship.group.visible = false;
      scene.add(ship.group);
      const f: Flight = {
        ship,
        island: null,
        from: new THREE.Vector3(),
        fromQuat: new THREE.Quaternion(),
        fromScale: 1,
        start: 0,
        mode: 'docked',
        pos: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        scale: 1,
        landed: 1,
      };
      flights.set(seat, f);
      return f;
    };
    const makeModel = (id: string) => {
      const made = buildShopModel(id);
      if (!made) return null;
      models.set(id, made);
      made.group.visible = false;
      shop.add(made.group);
      return made;
    };
    /** Objects that failed to build; never retried, so the table still loads. */
    const failed = new Set<string>();
    type Job = { key: string; run: () => unknown };
    /** Everything the table shows now that does not exist yet. */
    const missing = () => {
      const { year: y, kits } = live.current;
      const jobs: Job[] = [];
      const add = (key: string, run: () => unknown) => {
        if (!failed.has(key)) jobs.push({ key, run });
      };
      for (const id of planetIds())
        if (!planets.has(planetKey(id, y)))
          add(`planet:${id}:${y}`, () => makePlanet(id, y));
      const seats = new Set([...baseSeats(), ...kits.keys()]);
      for (const seat of seats) {
        if (baseSeats().includes(seat) && !bases.has(seat))
          add(`base:${seat}`, () => makeBase(seat));
        if (!flights.has(seat)) add(`ship:${seat}`, () => makeShip(seat));
      }
      for (const id of shopIds())
        if (!models.has(id)) add(`model:${id}`, () => makeModel(id));
      return jobs;
    };
    let total = 0;
    /** Builds for a slice of the frame; true once nothing is missing. */
    const buildSome = () => {
      const jobs = missing();
      total = Math.max(total, jobs.length);
      const t0 = performance.now();
      while (jobs.length && performance.now() - t0 < SLICE_MS) {
        const job = jobs.shift()!;
        try {
          job.run();
        } catch (error) {
          // One broken object must never hold the table back.
          console.error(`Alto: could not build ${job.key}`, error);
          failed.add(job.key);
        }
      }
      if (loading && total)
        live.current.onProgress?.(0.9 * (1 - jobs.length / total));
      return jobs.length === 0;
    };
    /** Next year's planets, one a frame, while nothing else needs building. */
    const prepare = () => {
      const next = live.current.prepareYear;
      if (!next) return;
      for (const id of planetIds()) {
        const key = `planet:${id}:${next}`;
        if (planets.has(planetKey(id, next)) || failed.has(key)) continue;
        try {
          const p = makePlanet(id, next);
          renderer.compile(p.group, camera);
        } catch (error) {
          console.error(`Alto: could not build ${key}`, error);
          failed.add(key);
        }
        return;
      }
    };

    // ——— Placing ———

    let base = el.getBoundingClientRect();
    const slots = new Map<
      number,
      { centre: THREE.Vector3; radius: number; reach: number }
    >();
    /** Each seat's dock: where its ship stands, in world pixels. */
    const docks = new Map<
      number,
      { pos: THREE.Vector3; quat: THREE.Quaternion; scale: number }
    >();
    const tmpM = new THREE.Matrix4();
    const tmpS = new THREE.Vector3();
    const yawQ = new THREE.Quaternion();
    const Y = new THREE.Vector3(0, 1, 0);

    const placePlanets = (dt: number, now: number) => {
      const y = live.current.year;
      const picking = world.hasAttribute('data-picking');
      slots.clear();
      for (const li of world.querySelectorAll<HTMLElement>(
        '.alto-planet[data-island]',
      )) {
        const id = li.dataset.island!;
        const index = Number(li.dataset.index);
        // A new year's planet shows once it is built; until then the old one stays.
        let planet = planets.get(planetKey(id, y));
        if (!planet)
          for (const k of [3, 2, 1] as Year[])
            planet ??= planets.get(planetKey(id, k));
        if (!planet) continue;
        const r = li.getBoundingClientRect();
        const size = Math.min(r.width, r.height);
        if (!size) continue;
        const centre = toWorld(
          r.left + r.width / 2 - base.left,
          r.top + r.height / 2 - base.top,
        );
        if (!still)
          centre.y += Math.sin(clock * 0.8 + index * 1.3) * size * 0.01;
        const button = li.querySelector('.alto-planet-button');
        const hover = !!button?.matches(':hover, :focus-visible');
        const mine = li.classList.contains('is-mine');
        // Everything it carries (moons, rings, tall buildings) fits its slot,
        // and slots never overlap, so planets never touch.
        const radius = (size * 0.47) / Math.max(1, planet.reach);
        // The pile chip hangs from the planet's own body, not its slot.
        const body = (0.47 / Math.max(1, planet.reach)).toFixed(3);
        if (li.style.getPropertyValue('--body') !== body)
          li.style.setProperty('--body', body);
        const grow = hover ? 1.04 : mine ? 1.025 : 1;
        const current =
          planet.group.userData.seen && planet.group.visible
            ? planet.group.scale.x
            : radius;
        const next = current + (radius * grow - current) * Math.min(1, dt * 10);
        planet.group.scale.setScalar(next);
        planet.group.position.copy(centre);
        planet.group.visible = true;
        planet.group.userData.seen = now;
        planet.air.material.uniforms.power.value = mine
          ? 1.8
          : hover
            ? 1.5
            : picking
              ? 1.25
              : 1;
        planet.update(clock, still ? 0 : dt);
        slots.set(index, {
          centre: centre.clone(),
          radius: next,
          reach: planet.reach,
        });
      }
      for (const planet of planets.values())
        if (planet.group.userData.seen !== now) planet.group.visible = false;
    };

    /** The docked ship's box corners in a base's own space. */
    const shipCorners = (b: Base) => {
      const at = new THREE.Matrix4().compose(
        b.dock.position,
        new THREE.Quaternion().setFromAxisAngle(Y, b.dock.yaw),
        new THREE.Vector3().setScalar(b.dock.scale),
      );
      return Array.from({ length: 8 }, (_, k) =>
        new THREE.Vector3(
          k & 1 ? shipBounds.max.x : shipBounds.min.x,
          k & 2 ? shipBounds.max.y : shipBounds.min.y,
          k & 4 ? shipBounds.max.z : shipBounds.min.z,
        ).applyMatrix4(at),
      );
    };
    type Framing = {
      key: string;
      frame: ReturnType<typeof baseFrame>;
      scale: number;
      offset: THREE.Vector3;
    };
    const framings = new Map<number, Framing>();
    const turnQ = new THREE.Quaternion();
    const turnE = new THREE.Euler();

    const placeBases = (dt: number, now: number) => {
      const { kits, ghost } = live.current;
      docks.clear();
      for (const node of world.querySelectorAll<HTMLElement>(
        '[data-base-seat]',
      )) {
        const seat = Number(node.dataset.baseSeat);
        const b = bases.get(seat);
        if (!b) continue;
        const r = node.getBoundingClientRect();
        if (
          !r.width ||
          !r.height ||
          r.bottom < base.top ||
          r.top > base.bottom
        ) {
          b.group.visible = false;
          continue;
        }
        const ids = kits[seat] ?? [];
        const shown = seat === viewer ? ghost : null;
        b.setModules(ids, shown);
        // Your own base turns its pad toward the shop; the others face in.
        const left = r.left + r.width / 2 - base.left < width / 2;
        const yaw = seat === viewer ? 0.5 : left ? 0.45 : -0.45;
        // A ship with a bay of its own is not on the pad.
        const docked = !world.querySelector(`[data-ship-seat="${seat}"]`);
        // Framed on what is built (never the ghost), measured again only
        // when that changes, and eased so a growing base zooms gently.
        const key = `${ids.join(',')}|${yaw}|${docked}`;
        let f = framings.get(seat);
        if (!f || f.key !== key) {
          const frame = baseFrame(
            b.group,
            turnQ.setFromEuler(turnE.set(BASE_TILT, yaw, 0)),
            docked ? shipCorners(b) : [],
          );
          f = f
            ? { ...f, key, frame }
            : { key, frame, scale: 0, offset: frame.centre.clone() };
          framings.set(seat, f);
        }
        const target = Math.min(
          (r.width * BASE_FILL) / f.frame.width,
          (r.height * BASE_FILL) / f.frame.height,
        );
        const glide = f.scale && !still ? Math.min(1, dt * 5) : 1;
        f.scale += (target - f.scale) * glide;
        f.offset.lerp(f.frame.centre, glide);
        const scale = f.scale;
        const centre = toWorld(
          r.left + r.width / 2 - base.left,
          r.top + r.height / 2 - base.top,
        );
        if (!still)
          centre.y +=
            Math.sin(clock * 0.7 + seat * 2.1) *
            Math.min(r.width, r.height) *
            0.01;
        b.group.scale.setScalar(scale);
        b.group.rotation.set(
          BASE_TILT,
          yaw + (still ? 0 : Math.sin(clock * 0.25 + seat) * 0.06),
          0,
        );
        // What is drawn sits in the middle of the slot.
        b.group.position.copy(f.offset).multiplyScalar(-scale).add(centre);
        b.group.visible = true;
        b.group.userData.seen = now;
        b.update(clock, still ? 0 : dt);
        b.group.updateMatrixWorld(true);
        // The ship's place on the pad, in world pixels.
        yawQ.setFromAxisAngle(Y, b.dock.yaw);
        tmpM.compose(b.dock.position, yawQ, tmpS.setScalar(b.dock.scale));
        tmpM.premultiply(b.group.matrixWorld);
        const dock = {
          pos: new THREE.Vector3(),
          quat: new THREE.Quaternion(),
          scale: 1,
        };
        tmpM.decompose(dock.pos, dock.quat, tmpS);
        dock.scale = tmpS.x;
        docks.set(seat, dock);
      }
      for (const b of bases.values())
        if (b.group.userData.seen !== now) b.group.visible = false;
    };

    /** Your ship fills its own bay, independently of base modules. Its frame
     * changes only when the ship's own hardware changes. */
    const previewTurn = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.25, -1.0, 0),
    );
    const placeShipPreviews = () => {
      for (const node of world.querySelectorAll<HTMLElement>(
        '[data-ship-seat]',
      )) {
        const r = node.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const seat = Number(node.dataset.shipSeat);
        const flight = flights.get(seat);
        if (!flight) continue;
        const ids = (live.current.kits[seat] ?? []).filter(
          (id) => planById[id]?.family === 'ship',
        );
        const ghost =
          seat === viewer &&
          live.current.ghost &&
          planById[live.current.ghost]?.family === 'ship'
            ? live.current.ghost
            : null;
        const key = `${ids.join(',')}|${ghost ?? ''}`;
        const data = flight.ship.group.userData;
        if (data.previewKey !== key) {
          flight.ship.setKit(ids, ghost);
          flight.ship.setLanded(1);
          flight.ship.update(clock, 0);
          data.previewKey = key;
          data.previewFrame = shipPreviewFrame(flight.ship.group, previewTurn);
        }
        const fit = data.previewFrame as ReturnType<typeof shipPreviewFrame>;
        // As large as the bay allows either way; a ship is long, so a wide
        // bay shows it best.
        const scale = Math.min(
          (r.width * 0.9) / fit.width,
          (r.height * 0.84) / fit.height,
        );
        const centre = toWorld(
          r.left + r.width / 2 - base.left,
          r.top + r.height / 2 - base.top,
        );
        docks.set(seat, {
          pos: centre.addScaledVector(fit.centre, -scale),
          quat: previewTurn.clone(),
          scale,
        });
      }
    };

    /** Where a ship hovers at a planet: in front of it, clear of everything it carries. */
    const hoverAt = (
      island: number,
      slot: number,
      count: number,
      t: number,
      out: THREE.Vector3,
    ) => {
      const s = slots.get(island);
      if (!s) return out;
      const across = count > 1 ? (slot / (count - 1) - 0.5) * 2 : 0;
      const spread = s.radius * Math.min(1.1, 0.42 * (count - 1));
      return out.set(
        s.centre.x +
          across * spread +
          Math.sin(t * 1.3 + slot) * s.radius * 0.04,
        s.centre.y +
          s.radius * (0.42 - Math.abs(across) * 0.18) +
          Math.sin(t * 1.9 + slot * 1.7) * s.radius * 0.04,
        s.centre.z + s.radius * (s.reach + 0.35),
      );
    };
    const hoverScale = (island: number | null, count: number) => {
      const s = island === null ? null : slots.get(island);
      const r = s ? s.radius : Math.min(width, height) * 0.08;
      return r * 0.34 * Math.min(1, 2.6 / Math.max(1, count + 0.6));
    };

    const prev = new THREE.Vector3();
    const look = new THREE.Vector3();
    const ctrl = new THREE.Vector3();
    const goal = new THREE.Vector3();
    const lookM = new THREE.Matrix4();
    const faceQ = new THREE.Quaternion();
    const facing = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      out: THREE.Quaternion,
    ) => {
      look.subVectors(to, from);
      if (look.lengthSq() < 0.01) return out;
      look.y *= 0.5;
      // Object3D.lookAt points +Z at the target, the ship's nose.
      lookM.lookAt(look.normalize(), new THREE.Vector3(), Y);
      return out.setFromRotationMatrix(lookM);
    };

    const flyShips = (dt: number) => {
      const { ships: want, kits } = live.current;
      const counts = new Map<number, number>();
      const order = new Map<number, number>();
      want.forEach((island, seat) => {
        if (island === null || island === undefined) return;
        order.set(seat, counts.get(island) ?? 0);
        counts.set(island, (counts.get(island) ?? 0) + 1);
      });
      for (const [seat, f] of flights) {
        const island = want[seat] ?? null;
        const dock = docks.get(seat);
        f.ship.setKit(
          kits[seat] ?? [],
          seat === viewer ? live.current.ghost : null,
        );
        if (island !== f.island && (island === null || slots.has(island))) {
          f.from.copy(f.pos);
          f.fromQuat.copy(f.quat);
          f.fromScale = f.scale;
          f.start = clock;
          f.island = island;
          f.mode =
            island === null
              ? f.mode === 'docked'
                ? 'docked'
                : 'return'
              : 'fly';
        }
        const count = f.island === null ? 1 : (counts.get(f.island) ?? 1);
        const slot = order.get(seat) ?? 0;
        prev.copy(f.pos);
        let thrust = 0;
        let docked = false;
        if (f.mode === 'docked') {
          if (!dock) {
            f.ship.group.visible = false;
            continue;
          }
          f.pos.copy(dock.pos);
          f.quat.copy(dock.quat);
          f.scale = dock.scale;
          docked = true;
        } else if (f.mode === 'fly' && f.island !== null) {
          const p = still ? 1 : Math.min(1, (clock - f.start) / FLY);
          hoverAt(f.island, slot, count, clock, goal);
          ctrl.copy(f.from).lerp(goal, 0.5);
          ctrl.y += Math.abs(goal.x - f.from.x) * 0.12 + 60;
          ctrl.z += 260;
          const e = ease(p);
          f.pos
            .set(0, 0, 0)
            .addScaledVector(f.from, (1 - e) * (1 - e))
            .addScaledVector(ctrl, 2 * e * (1 - e))
            .addScaledVector(goal, e * e);
          f.scale = THREE.MathUtils.lerp(
            f.fromScale,
            hoverScale(f.island, count),
            e,
          );
          facing(prev, f.pos, faceQ);
          f.quat.slerp(faceQ, Math.min(1, dt * 8));
          thrust = 1 - e * 0.6;
          if (p >= 1) f.mode = 'hover';
        } else if (f.mode === 'hover' && f.island !== null) {
          hoverAt(f.island, slot, count, clock, f.pos);
          f.scale +=
            (hoverScale(f.island, count) - f.scale) * Math.min(1, dt * 6);
          // Side-on to the viewer, nose toward the planet's middle.
          const s = slots.get(f.island)!;
          faceQ.setFromAxisAngle(
            Y,
            f.pos.x > s.centre.x + 2 ? -Math.PI / 2 : Math.PI / 2,
          );
          f.quat.slerp(faceQ, Math.min(1, dt * 4));
          thrust = 0.3;
        } else if (f.mode === 'return') {
          if (!dock) {
            f.mode = 'docked';
            continue;
          }
          const p = still ? 1 : Math.min(1, (clock - f.start) / RETURN);
          goal.copy(dock.pos);
          ctrl.copy(f.from).lerp(goal, 0.5);
          ctrl.z += 200;
          ctrl.y += 40;
          const e = ease(p);
          f.pos
            .set(0, 0, 0)
            .addScaledVector(f.from, (1 - e) * (1 - e))
            .addScaledVector(ctrl, 2 * e * (1 - e))
            .addScaledVector(goal, e * e);
          f.scale = THREE.MathUtils.lerp(f.fromScale, dock.scale, e);
          if (e < 0.75) {
            facing(prev, f.pos, faceQ);
            f.quat.slerp(faceQ, Math.min(1, dt * 8));
          } else f.quat.slerp(dock.quat, Math.min(1, dt * 10));
          thrust = 1 - e * 0.7;
          if (p >= 1) f.mode = 'docked';
        }
        const ship = f.ship.group;
        ship.visible = true;
        // Legs out only when standing on the pad; tucked away in flight.
        f.landed +=
          ((docked ? 1 : 0) - f.landed) * Math.min(1, dt * (docked ? 5 : 9));
        f.ship.setLanded(still ? (docked ? 1 : 0) : f.landed);
        f.ship.setThrust(thrust);
        ship.position.copy(f.pos);
        ship.quaternion.copy(f.quat);
        ship.scale.setScalar(f.scale);
        f.ship.update(clock, dt);
      }
    };

    const drawShop = () => {
      renderer.setScissorTest(true);
      for (const art of world.querySelectorAll<HTMLElement>(
        '.alto-item-art[data-model]',
      )) {
        const model = models.get(art.dataset.model!);
        if (!model) continue;
        const r = art.getBoundingClientRect();
        if (!r.width || r.bottom < base.top || r.top > base.bottom) continue;
        const size = Math.max(r.width, r.height) * 1.2;
        const x = r.left + r.width / 2 - base.left - size / 2;
        const y = height - (r.top + r.height / 2 - base.top) - size / 2;
        const item = art.closest('.alto-item');
        const dim = item?.classList.contains('is-short')
          ? 0.62
          : item?.classList.contains('is-built')
            ? 0.7
            : 1;
        const picked = item?.classList.contains('is-picked');
        shopLights.forEach((l, k) => (l.intensity = shopStrength[k] * dim));
        for (const m of models.values()) m.group.visible = m === model;
        model.group.position.y =
          picked && !still ? 0.06 + Math.sin(clock * 4) * 0.04 : 0;
        model.update(clock * (dim < 1 ? 0.4 : picked ? 1.8 : 1), 0);
        renderer.setViewport(x, y, size, size);
        renderer.setScissor(x, y, size, size);
        renderer.clearDepth();
        renderer.render(shop, shopCamera);
      }
      renderer.setScissorTest(false);
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!still) clock += dt;
      resize();
      if (!width || !height) return;
      base = el.getBoundingClientRect();
      if (loading) {
        if (compiling || !buildSome()) return;
        // Everything exists: compile every shader before the first frame shows.
        compiling = true;
        for (const p of planets.values()) p.group.visible = true;
        for (const b of bases.values()) b.group.visible = true;
        for (const f of flights.values()) f.ship.group.visible = true;
        for (const m of models.values()) m.group.visible = true;
        const done = () => {
          if (disposed) return;
          loading = false;
          compiling = false;
          live.current.onProgress?.(1);
        };
        Promise.all([
          renderer.compileAsync(scene, camera),
          renderer.compileAsync(shop, shopCamera),
        ]).then(done, done);
        return;
      }
      // Later arrivals (a new year's shop, a new seat) build quietly.
      buildSome();
      if (!live.current.prepareYear) {
        // Drop planets of years that are over.
        for (const [key, p] of planets) {
          const y = Number(key.split(':')[1]);
          if (
            y < live.current.year &&
            planets.has(key.replace(/:\d$/, `:${live.current.year}`))
          ) {
            scene.remove(p.group);
            disposeTree(p.group);
            planets.delete(key);
          }
        }
      } else prepare();

      placePlanets(dt, now);
      placeBases(dt, now);
      placeShipPreviews();
      flyShips(dt);

      renderer.setViewport(0, 0, width, height);
      renderer.clear();
      renderer.render(scene, camera);
      drawShop();

      if (!world.hasAttribute('data-3d')) {
        world.setAttribute('data-3d', '');
        live.current.onReady?.(true);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      world.removeAttribute('data-3d');
      for (const b of bases.values()) b.dispose();
      for (const f of flights.values()) f.ship.dispose();
      disposeTree(scene);
      disposeTree(shop);
      scene.environment?.dispose();
      shop.environment?.dispose();
      renderer.dispose();
    };
  }, [root, viewer]);

  return <canvas ref={canvas} className="alto-3d" aria-hidden="true" />;
}
