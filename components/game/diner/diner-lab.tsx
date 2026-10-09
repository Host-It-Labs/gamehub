'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  createProfile,
  driveTo,
  runMap,
  startRun,
} from '@/lib/games/diner/campaign';
import { DinerCampaign } from './diner-campaign';
import { DinerLevels } from './diner-levels';
import DinerGame from './diner-game';
import { SoloSession } from './session';
import { choicesFrom, isPlaceId } from '@/lib/games/diner/road';
import { fitDinerCamera } from './framing';
import { makeMaterials } from './kit';
import { nightRig, type NightRig } from './lighting';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRig } from './rig';
import { disposeSurfaceMaterials } from './materials';
import { buildStage } from './stage';
import type { CarUpgrades, StageQuality } from './stage-contract';

/**
 * Dev-only bench at /diner/lab for the diner car overhaul (8 October 2026).
 *
 * Stage: ?scene=stage&place=fairground&quality=high&tables=0,1,2,3,4,5&clay=1
 * Rig: ?scene=rig&open=1&toy=0 · Shift: ?scene=shift&level=12 · Levels: ?scene=levels
 * Campaign (the road map): ?scene=campaign
 *
 * `window.dinerLab` exposes { scene, camera, renderer, info() } for review
 * scripts. Size the browser viewport to the device being checked.
 */
export default function DinerLab() {
  // The server renders nothing; the browser reads the scene from the URL.
  const scene = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get('scene') ?? '',
    () => null,
  );
  if (scene === null) return null;
  if (scene === 'campaign')
    return (
      <DinerCampaign volume={0} music={0} sound={null} onExit={() => {}} />
    );
  if (scene === 'shift') return <LabShift />;
  if (scene === 'levels')
    return <DinerLevels volume={0} music={0} sound={null} onExit={() => {}} />;
  return <LabCanvas />;
}

/** A free-play level, or a campaign stop's rules: ?scene=shift&level=12 or &place=harbour&tools=1 */
function LabShift() {
  const [session] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const place = q.get('place');
    if (isPlaceId(place)) {
      const { run } = startRun(createProfile(), Number(q.get('seed') ?? 7));
      const first = choicesFrom(runMap(run), null)[0];
      const driven = driveTo(run, first.id);
      const m = driven.savedMatch!;
      m.config!.place = place;
      // ?tools=1 gives the shift every Workshop tool, to look at them.
      if (q.get('tools'))
        Object.assign(m.config!.effects, {
          dash: true,
          pass: true,
          coffee: true,
          jukebox: true,
          hands: 3,
          grillLanes: 3,
        });
      return new SoloSession({ match: m });
    }
    return new SoloSession({
      level: Math.max(1, Math.min(40, Number(q.get('level') ?? 1))),
    });
  });
  return (
    <DinerGame
      session={session}
      volume={0}
      music={0}
      sound={null}
      onExit={() => {}}
    />
  );
}

const noSubscribe = () => () => {};

function LabCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const failure = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const el = canvas.current;
    if (!el) return;
    try {
      return q.get('scene') === 'rig' ? rigLab(el, q) : stageLab(el, q);
    } catch (e) {
      if (failure.current)
        failure.current.textContent =
          e instanceof Error ? e.message : String(e);
    }
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0d1a' }}>
      <canvas
        ref={canvas}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <pre
        ref={failure}
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          color: '#ffb4a8',
          whiteSpace: 'pre-wrap',
        }}
      />
    </div>
  );
}

const ALL_UPGRADES: CarUpgrades = {
  spareTires: 2,
  biggerPatio: true,
  neonSign: true,
  jukebox: true,
  heatLampPass: true,
  coffeeUrn: true,
  twinGrill: true,
  rollerSkates: true,
  chromeTray: true,
  gasCan: true,
  luckyDice: true,
  roadAtlas: true,
};

function stageLab(canvas: HTMLCanvasElement, q: URLSearchParams) {
  const asked = q.get('place');
  const place = isPlaceId(asked) ? asked : 'truckstop';
  const quality: StageQuality = q.get('quality') === 'low' ? 'low' : 'high';
  const tables = (q.get('tables') ?? '0,1,2,3,4')
    .split(',')
    .map(Number)
    .filter((n) => n >= 0 && n <= 4);
  const upgrades = q.get('upgrades') === 'all' ? ALL_UPGRADES : {};
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const rig = nightRig(scene, renderer, place);
  const mats = makeMaterials();
  const stage = buildStage(mats, { place, tables, upgrades, quality });
  scene.add(stage.group);
  const clay = new THREE.MeshStandardMaterial({
    color: '#b6b3ac',
    roughness: 0.85,
  });
  if (q.get('clay') === '1') {
    stage.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = clay;
    });
  }
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 140);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.42, 0.92);
  composer.addPass(bloom);
  const output = new OutputPass();
  composer.addPass(output);
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    composer.setSize(r.width, r.height);
    const phone = r.width <= 600;
    fitDinerCamera(
      camera,
      {
        width: r.width,
        height: r.height,
        top: phone ? 150 : 96,
        bottom: phone ? 170 : 24,
        left: 16,
        right: 16,
      },
      stage.landmarks,
    );
  };
  resize();
  window.addEventListener('resize', resize);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;
  let time = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) time += dt;
    const power = q.get('power') !== 'off';
    rig.update(power, time);
    stage.update({
      time,
      dt,
      reduced,
      power,
      rush: q.get('rush') === '1',
      gate: 0,
      jukebox: true,
    });
    renderer.info.reset();
    composer.render();
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  Object.assign(window, {
    dinerLab: {
      scene,
      camera,
      renderer,
      info: () => ({
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
      }),
    },
  });
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    stage.dispose();
    disposeSurfaceMaterials(mats);
    rig.dispose();
    clay.dispose();
    bloom.dispose();
    output.dispose();
    composer.dispose();
    renderer.dispose();
    delete (window as unknown as Record<string, unknown>).dinerLab;
  };
}

/**
 * One model under a neutral studio light (or the night rig with ?light=night):
 * ?scene=rig&open=1&toy=0&length=15.8&yaw=35&elev=22&zoom=1&clay=1
 */
function rigLab(canvas: HTMLCanvasElement, q: URLSearchParams) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const mats = makeMaterials();
  const open = q.get('open') !== '0';
  const toy = q.get('toy') === '1';
  const length = Number(q.get('length') ?? (toy ? 5.2 : 15.8));
  const rig = buildRig(mats, {
    length,
    open,
    toy,
    quality: q.get('quality') === 'low' ? 'low' : 'high',
  });
  scene.add(rig.group);
  if (q.get('clay') === '1') {
    const clay = new THREE.MeshStandardMaterial({
      color: '#b6b3ac',
      roughness: 0.85,
    });
    rig.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = clay;
    });
  }
  const night = q.get('light') === 'night';
  let rigLight: NightRig | null = null;
  if (night) rigLight = nightRig(scene, renderer, 'truckstop');
  else {
    scene.background = new THREE.Color('#8d939b');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environmentIntensity = 0.6;
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
    sun.position.set(-8, 14, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -14,
      right: 14,
      top: 14,
      bottom: -14,
    });
    scene.add(sun, new THREE.HemisphereLight('#dfe8ff', '#5c544c', 0.8));
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: '#6f6a66', roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const box = new THREE.Box3().setFromObject(rig.group);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  const yaw = (Number(q.get('yaw') ?? 35) * Math.PI) / 180;
  const elev = (Number(q.get('elev') ?? 22) * Math.PI) / 180;
  const dist =
    (size / 2 / Math.tan((15 * Math.PI) / 180)) * Number(q.get('zoom') ?? 1.05);
  camera.position.set(
    centre.x + Math.sin(yaw) * Math.cos(elev) * dist,
    centre.y + Math.sin(elev) * dist,
    centre.z + Math.cos(yaw) * Math.cos(elev) * dist,
  );
  camera.lookAt(centre);
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  };
  resize();
  let frame = 0;
  const loop = () => {
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  window.addEventListener('resize', resize);
  Object.assign(window, {
    dinerLab: {
      scene,
      camera,
      renderer,
      info: () => ({
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      }),
    },
  });
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    rig.dispose();
    rigLight?.dispose();
    disposeSurfaceMaterials(mats);
    renderer.dispose();
  };
}
