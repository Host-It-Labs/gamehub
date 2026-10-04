'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { islands, plans } from '@/lib/games/alto/content';
import { modelledPlans, seatColours, skyArt } from '@/lib/games/alto/art';
import { buildPlanet, spaceLights, type Year } from './alto-3d';
import { buildShip, buildShopModel } from './alto-ship';
import { baseModules, buildBase } from './alto-base';
import { AltoTableLab } from './alto-table-lab';
import { AltoSpace, type ShipTargets } from './alto-scene';
import { PlanFace } from './alto-parts';
import './alto.css';

/**
 * Dev-only bench at /alto/lab: every planet large, the ships (each carrying a
 * different set of upgrades), your docked ship and the shop's objects.
 * `?one=<planet id>` shows one planet alone, `?trip=<1–3>` that trip's shop; `?stills` renders a transparent
 * still of every planet and upgrade into `window.altoStills`, which
 * scripts/alto-art.mjs turns into the 2D pictures after PNG export.
 * `?stills=modules` isolates the v3 hardware for scripts/alto-module-art.mjs. `?view=planet:<id>`,
 * `?view=ship` (every modelled upgrade on) or `?view=upgrade:<id>` shows one
 * object alone, filling the screen, with its triangle count; `yaw`, `pitch`
 * and `dist` set the camera and `still` stops the turntable. `?view=base` is
 * a home base, `&mods=beacon,palace` or `&mods=all` its modules, `&ghost=<id>`
 * a pick not yet built, `&ship=<ids>` the docked ship's kit (`none` hides it).
 * `&year=<1–3>` shows the planets as they stand that year (default 2), in
 * the grid, `?one=` and `?view=planet:<id>` (which also gives the build time).
 */
export default function AltoLab() {
  const root = useRef<HTMLElement>(null);
  const [ships, setShips] = useState<ShipTargets>([]);
  const [ghost, setGhost] = useState<string | null>(null);
  const params =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search);
  const one = params?.get('one') ?? null;
  const year = yearOf(params);
  const stills = params?.has('stills') ?? false;
  const view = params?.get('view') ?? null;
  const shown = one ? islands.filter((i) => i.id === one) : islands;
  const trip = Number(params?.get('trip') ?? 1);
  const shop = plans.filter((p) => p.season === trip).map((p) => p.id);
  // Seat 0 is the docked ship (every bolt-on and a few stickers); the others
  // carry more of each trip's upgrades the further round the table they sit.
  const kits = seatColours.map((_, s) =>
    s === 0
      ? [
          ...'rigging sawmill mason fold shrine kite pier glassworks sails harbor balloon windmill'.split(
            ' ',
          ),
          'beacon',
          'gardens',
          'palace',
          'skytower',
        ]
      : modelledPlans.filter((_, k) => k % seatColours.length < s + 1),
  );
  const send = (spread: boolean) =>
    setShips(seatColours.map((_, s) => (spread ? s % islands.length : s % 2)));
  if (params?.has('table'))
    return <AltoTableLab query={window.location.search} />;
  if (stills) return <Stills />;
  if (view) return <Viewer view={view} query={window.location.search} />;
  return (
    <main ref={root} className="alto-world alto-lab">
      <picture className="alto-space">
        <img src={skyArt.landscape} alt="" draggable={false} />
      </picture>
      <AltoSpace
        root={root}
        ships={ships}
        kits={kits}
        ghost={ghost}
        viewer={0}
        year={year}
      />
      <header className="alto-lab-bar">
        {seatColours.map((c, s) => (
          <span
            key={s}
            className="alto-player"
            style={{ background: c } as CSSProperties}
          >
            {s + 1}
          </span>
        ))}
        <button type="button" onClick={() => send(true)}>
          Spread
        </button>
        <button type="button" onClick={() => send(false)}>
          Crowd
        </button>
        <button type="button" onClick={() => setShips([])}>
          Home
        </button>
      </header>
      <ul className={`alto-lab-planets ${one ? 'is-one' : ''}`}>
        {shown.map((island) => (
          <li
            key={island.id}
            className="alto-planet"
            data-island={island.id}
            data-index={islands.indexOf(island)}
          >
            <button
              type="button"
              className="alto-planet-button"
              aria-label={island.name}
            />
            <b>{island.name}</b>
          </li>
        ))}
      </ul>
      <footer className="alto-lab-dock">
        <span className="alto-home">
          <span className="alto-home-bay" data-base-seat={0} />
        </span>
        <div className="alto-shop">
          {shop.map((id) => (
            <button
              type="button"
              key={id}
              className={`alto-item is-ready ${ghost === id ? 'is-picked' : ''}`}
              onClick={() => setGhost(ghost === id ? null : id)}
            >
              <PlanFace id={id} />
            </button>
          ))}
        </div>
      </footer>
    </main>
  );
}

/** Renders every planet and modelled upgrade once, on a clear background. */
function Stills() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const out: Record<string, string> = {};
    const shoot = (
      object: THREE.Object3D,
      camera: THREE.PerspectiveCamera,
      update: () => void,
      key: string,
      env: number,
    ) => {
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = env;
      spaceLights(scene, 1.1);
      scene.add(object);
      update();
      renderer.clear();
      renderer.render(scene, camera);
      out[key] = canvas.toDataURL('image/png');
      pmrem.dispose();
    };
    const modulesOnly =
      new URLSearchParams(window.location.search).get('stills') === 'modules';
    for (const island of modulesOnly ? [] : islands) {
      const planet = buildPlanet(island.id);
      const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
      const fit = 1.02 * Math.max(1.18, Math.min(planet.reach, 2.1));
      camera.position.set(0, 0, fit / Math.tan(THREE.MathUtils.degToRad(12)));
      camera.lookAt(0, 0, 0);
      shoot(
        planet.group,
        camera,
        () => planet.update(6, 0.016),
        `planet-${island.id}`,
        0.35,
      );
    }
    const renderIds = modulesOnly
      ? [...baseModules, 'windmill']
      : modelledPlans;
    for (const id of renderIds) {
      const model = buildShopModel(id)!;
      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
      camera.position.set(0, 0.9, 4.2);
      camera.lookAt(0, 0, 0);
      shoot(
        model.group,
        camera,
        () => model.update(0, 0.016),
        `upgrade-${id}`,
        0.55,
      );
    }
    (window as unknown as { altoStills: Record<string, string> }).altoStills =
      out;
    renderer.dispose();
    const frame = requestAnimationFrame(() => setDone(Object.keys(out).length));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <p className="alto-lab-stills">
      {done ? `${done} stills ready` : 'Rendering…'}
    </p>
  );
}

/** The `year` query parameter: 1, 2 or 3 (default 2). */
const yearOf = (params: URLSearchParams | null): Year => {
  const y = Number(params?.get('year') ?? 2);
  return y === 1 || y === 3 ? y : 2;
};

/** One object alone, large, on the space background, for close modelling work. */
function Viewer({ view, query }: { view: string; query: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState('');
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const params = new URLSearchParams(query);
    const num = (k: string, d: number) => {
      const v = params.get(k);
      return v === null ? d : Number(v);
    };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    spaceLights(scene, 1.1);
    const [kind, id] = view.split(':');
    let object: THREE.Object3D;
    let update: (t: number, dt: number) => void;
    let size = 1.2;
    let built = '';
    if (kind === 'planet') {
      const t = performance.now();
      const planet = buildPlanet(id ?? 'pinewood', yearOf(params));
      built = ` · built in ${Math.round(performance.now() - t)} ms`;
      object = planet.group;
      update = planet.update;
      size = Math.max(1.2, Math.min(planet.reach, 2.1));
    } else if (kind === 'upgrade') {
      const model = buildShopModel(id ?? modelledPlans[0])!;
      object = model.group;
      update = model.update;
    } else if (kind === 'base') {
      const base = buildBase(seatColours[0]);
      const mods = params.get('mods');
      base.setModules(
        mods === 'all' ? baseModules : mods ? mods.split(',') : [],
        params.get('ghost'),
      );
      const group = new THREE.Group();
      group.add(base.group);
      const kit = params.get('ship');
      const ship = kit === 'none' ? null : buildShip(seatColours[0]);
      if (ship) {
        ship.setKit(kit ? kit.split(',') : modelledPlans);
        ship.setLanded(1);
        ship.group.position.copy(base.dock.position);
        ship.group.scale.setScalar(base.dock.scale);
        ship.group.rotation.y = base.dock.yaw;
        group.add(ship.group);
      }
      object = group;
      update = (t, dt) => {
        base.update(t, dt);
        ship?.update(t, dt);
      };
      size = base.reach;
    } else {
      const ship = buildShip(seatColours[0]);
      ship.setKit(id ? id.split(',') : modelledPlans);
      ship.setLanded(params.has('fly') ? 0 : 1);
      ship.setThrust(params.has('fly') ? 1 : 0);
      object = ship.group;
      update = ship.update;
      object.rotation.y = 0.6;
      size = 1.25;
    }
    scene.add(object);
    const camera = new THREE.PerspectiveCamera(
      30,
      el.clientWidth / el.clientHeight,
      0.01,
      100,
    );
    const yaw = num('yaw', 0);
    const pitch = num('pitch', kind === 'base' ? 0.45 : 0.25);
    const dist = num(
      'dist',
      (size / Math.tan(THREE.MathUtils.degToRad(15))) * 1.05,
    );
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(0, 0, 0);
    const turn = !params.has('still');
    const t0 = performance.now();
    let last = t0;
    let frame = 0;
    let counted = false;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      update(turn ? t : num('t', 0), turn ? dt : 0);
      if (turn && kind === 'ship') object.rotation.y = 0.6 + t * 0.3;
      if (turn && kind === 'base' && params.has('spin'))
        object.rotation.y = Math.sin(t * 0.3) * 0.7;
      renderer.render(scene, camera);
      if (!counted) {
        counted = true;
        const { triangles, calls } = renderer.info.render;
        setInfo(
          `${triangles.toLocaleString()} triangles · ${calls} draws${built}`,
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      pmrem.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [view, query]);
  return (
    <main className="alto-world alto-lab alto-lab-view">
      <picture className="alto-space">
        <img src={skyArt.landscape} alt="" draggable={false} />
      </picture>
      <div ref={host} className="alto-lab-view-host" />
      <p className="alto-lab-stills">{info}</p>
    </main>
  );
}
