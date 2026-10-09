'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { startRatio } from '../render-quality';
import { batchSettledTowerFloors, createTriviaTower } from './tower-model';
import {
  createTriviaExpedition,
  createTriviaTraveller,
} from './expedition-model';

export const triviaSeatColours = [
  '#e35a42',
  '#3c73d9',
  '#329674',
  '#9c6bc4',
  '#db923e',
  '#d86399',
];

export type TriviaScenePlayer = {
  floors: number;
  distance: number;
  previousFloors: number;
  previousDistance: number;
};

const clamp = THREE.MathUtils.clamp;
const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const settle = (t: number) => {
  const v = clamp(t, 0, 1);
  // A short compression after contact, then recovery. The foundation stays still.
  return v < 0.74
    ? 1 - ease(v / 0.74)
    : -Math.sin(((v - 0.74) / 0.26) * Math.PI) * 0.025;
};

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

/** Fit the actual complete silhouettes in the camera's projected plane.
 * Width and height both constrain the fit, including fractional resize/zoom. */
function fitCamera(
  camera: THREE.OrthographicCamera,
  bounds: THREE.Box3,
  aspect: number,
  silhouette?: THREE.Object3D,
) {
  const centre = bounds.getCenter(new THREE.Vector3());
  const offset = camera.position
    .clone()
    .sub(camera.userData.target ?? new THREE.Vector3());
  camera.position.copy(centre).add(offset);
  camera.lookAt(centre);
  camera.userData.target = centre;
  camera.updateMatrixWorld(true);
  const projected = new THREE.Box3();
  if (silhouette) {
    // Project the retained source vertices, rather than the island's enclosing
    // cuboid. A diagonal cuboid leaves large blank corners around the landscape.
    const point = new THREE.Vector3();
    const transform = new THREE.Matrix4();
    silhouette.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.visible) return;
      transform.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++)
        projected.expandByPoint(
          point.fromBufferAttribute(positions, i).applyMatrix4(transform),
        );
    });
    const middle = projected.getCenter(new THREE.Vector3());
    const shift = new THREE.Vector3(middle.x, middle.y, 0).transformDirection(
      camera.matrixWorld,
    );
    shift.multiplyScalar(Math.hypot(middle.x, middle.y));
    camera.position.add(shift);
    camera.userData.target.add(shift);
    camera.updateMatrixWorld(true);
  } else {
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          projected.expandByPoint(
            new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse),
          );
  }
  const size = projected.getSize(new THREE.Vector3());
  const h = Math.max(size.y, size.x / Math.max(0.1, aspect)) * 1.1;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.left = (-h * aspect) / 2;
  camera.right = (h * aspect) / 2;
  camera.updateProjectionMatrix();
}

/** One real WebGL scene, underneath the accessible score/route controls.
 * No renderer survives closing the board; hidden pages and reduced motion stop RAF. */
export default function TriviaScene({
  mode,
  players,
  animate = true,
  review,
  source = false,
  onReady,
}: {
  mode: 'tower' | 'expedition';
  players: TriviaScenePlayer[];
  animate?: boolean;
  /** Development source review; never changes a live game's camera. */
  review?: 'front' | 'side' | 'rear' | 'clay';
  /** Keep the detailed editable hierarchy in the development review bench. */
  source?: boolean;
  onReady?: (ready: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ players, animate, onReady });
  useEffect(() => {
    latest.current = { players, animate, onReady };
  });

  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: surface,
        alpha: true,
        antialias: true,
      });
    } catch {
      latest.current.onReady?.(false);
      return;
    }
    let pixelRatio = startRatio(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    const art = new THREE.Group();
    scene.add(art);
    const makeEnvironment = () => {
      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const lighting = pmrem.fromScene(room, 0.04);
      room.dispose();
      pmrem.dispose();
      return lighting;
    };
    let environment = makeEnvironment();
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.46;
    const hemisphere = new THREE.HemisphereLight('#fff5da', '#657369', 1.45);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#fff0cd', 2.5);
    sun.position.set(-7, 15, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.camera.far = 45;
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.00015;
    sun.shadow.blurSamples = 4;
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#c5e8ef', 1.3);
    rim.position.set(7, 8, -10);
    scene.add(rim);
    const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);

    const towers =
      mode === 'tower'
        ? latest.current.players.map((_, seat) =>
            createTriviaTower(triviaSeatColours[seat], 25),
          )
        : [];
    const batches = source ? [] : towers.map(batchSettledTowerFloors);
    const expedition =
      mode === 'expedition'
        ? createTriviaExpedition({ runtime: !source })
        : null;
    const travellers = expedition
      ? latest.current.players.map((_, seat) =>
          createTriviaTraveller(triviaSeatColours[seat], { runtime: !source }),
        )
      : [];
    towers.forEach((tower) => art.add(tower.root));
    if (expedition) art.add(expedition.root);
    travellers.forEach((traveller) => {
      traveller.root.scale.setScalar(0.8);
      art.add(traveller.root);
    });

    // The display plinth gives every tower a grounded contact shadow.
    const plinth =
      mode === 'tower'
        ? new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1.025, 0.18, 64),
            new THREE.MeshStandardMaterial({
              color: '#41695f',
              roughness: 0.73,
            }),
          )
        : null;
    if (plinth) {
      plinth.position.y = -0.09;
      plinth.receiveShadow = true;
      art.add(plinth);
    }
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.17 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = mode === 'expedition' ? -0.69 : -0.24;
    shadow.receiveShadow = true;
    scene.add(shadow);
    const clay =
      review === 'clay'
        ? new THREE.MeshStandardMaterial({ color: '#85898b', roughness: 0.86 })
        : null;
    if (clay) {
      scene.overrideMaterial = clay;
      shadow.visible = false;
      renderer.toneMappingExposure = 0.85;
      scene.environmentIntensity = 0.18;
      hemisphere.intensity = 0.65;
      sun.intensity = 1.6;
      rim.intensity = 0.6;
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let disposed = false;
    let inView = true;
    let width = 0,
      height = 0;
    let started = performance.now();
    let lastScores = '';
    let fitted = '';
    let ready = false;
    let lost = false;
    let portrait = false;
    let lastDraw = 0;
    let settled = false;
    const origin = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const heading = new THREE.Quaternion();
    const planted = new THREE.Quaternion();

    // Two grounded lanes form a short queue when players share a step. Keep
    // complete boots apart at the bridge and in both endpoint clearings.
    const queue = (distances: number[]) => {
      const result = [...distances];
      for (let lane = 0; lane < 2; lane++) {
        const seats = distances
          .map((distance, seat) => ({ distance, seat }))
          .filter(({ seat }) => seat % 2 === lane)
          .sort((a, b) => a.distance - b.distance || a.seat - b.seat);
        let previous = -0.85;
        for (const { distance, seat } of seats) {
          result[seat] = Math.max(distance, previous + 0.85);
          previous = result[seat];
        }
        const excess = Math.max(0, previous - 12);
        for (const { seat } of seats) result[seat] -= excess;
      }
      return result;
    };

    const size = () => {
      const rect = surface.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const nextRatio = startRatio(rect.width, rect.height);
      if (
        width === rect.width &&
        height === rect.height &&
        nextRatio === pixelRatio
      )
        return;
      pixelRatio = nextRatio;
      renderer.setPixelRatio(pixelRatio);
      width = rect.width;
      height = rect.height;
      renderer.setSize(width, height, false);
      portrait = width / height < 1.05;
      art.rotation.y = expedition && portrait ? Math.PI / 2 : 0;
      camera.position.set(
        expedition ? (portrait ? 0 : 9) : 2.8,
        expedition ? 18 : 9,
        expedition ? 13 : 24,
      );
      if (review === 'front') camera.position.set(0, 3, 26);
      if (review === 'side') camera.position.set(26, 3, 0);
      if (review === 'rear') camera.position.set(0, 3, -26);
      camera.userData.target = origin.clone();
      if (plinth) {
        const spacing = portrait ? 1.44 : 1.92;
        plinth.scale.set(((towers.length - 1) * spacing) / 2 + 0.86, 1, 1.26);
      }
      towers.forEach((tower, seat) => {
        tower.root.position.set(
          (seat - (towers.length - 1) / 2) * (portrait ? 1.44 : 1.92),
          0,
          0,
        );
      });
      fitted = '';
    };

    const draw = (now: number) => {
      frame = 0;
      if (disposed || lost || document.hidden || !inView) return;
      size();
      if (width < 1 || height < 1) return;
      const data = latest.current;
      const still = motion.matches || !data.animate;
      const signature = data.players
        .map((p) => `${p.floors}:${p.distance}`)
        .join(',');
      if (signature !== lastScores) {
        started = now;
        lastScores = signature;
        settled = false;
        batches.forEach((batch) => batch.release());
        renderer.shadowMap.needsUpdate = true;
      }
      if (!still && now - lastDraw < 1000 / 30) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastDraw = now;
      const elapsed = (now - started) / 1000;
      const bounds = new THREE.Box3();
      let buildEnd = 0;
      if (towers.length)
        towers.forEach((tower, seat) => {
          const player = data.players[seat];
          const floors = Math.min(tower.floors.length, player.floors);
          const from = Math.min(floors, player.previousFloors);
          const count = floors - from;
          const duration = count ? Math.min(0.18, 1.05 / count) : 0;
          tower.floors.forEach((floor, level) => {
            const dropStarts = 0.23 + (level - from) * duration;
            floor.visible =
              level < floors &&
              (still || level < from || elapsed >= dropStarts);
            const remaining =
              still || level < from ? 0 : settle((elapsed - dropStarts) / 0.5);
            floor.position.y =
              tower.baseHeight +
              level * tower.floorHeight +
              Math.max(0, remaining) * 0.72;
            floor.scale.y = 1 + Math.min(0, remaining) * 2;
          });
          const end = 0.23 + Math.max(0, count - 1) * duration + 0.5;
          buildEnd = Math.max(buildEnd, count ? end + 0.35 : 0);
          const top = tower.baseHeight + floors * tower.floorHeight;
          tower.crown.position.y =
            still || count === 0
              ? top
              : elapsed < 0.23
                ? THREE.MathUtils.lerp(
                    tower.baseHeight + from * tower.floorHeight,
                    top + 0.8,
                    ease(elapsed / 0.23),
                  )
                : top + 0.8 * (1 - ease((elapsed - end) / 0.35));
          tower.wave?.(now / 1000, still);
          const x = tower.root.position.x,
            z = tower.root.position.z;
          bounds.expandByPoint(new THREE.Vector3(x - 0.86, -0.24, z - 0.86));
          bounds.expandByPoint(
            new THREE.Vector3(
              x + 0.86,
              tower.baseHeight + Math.max(5, floors) * tower.floorHeight + 2,
              z + 0.86,
            ),
          );
        });
      if (plinth) bounds.expandByObject(plinth);
      if (expedition) {
        expedition.update?.(now / 1000, still);
        const before = queue(
          data.players.map((player) => player.previousDistance),
        );
        const after = queue(data.players.map((player) => player.distance));
        travellers.forEach((traveller, seat) => {
          const travel = still ? 1 : ease((elapsed - seat * 0.065) / 1.15);
          const distance = THREE.MathUtils.lerp(
            before[seat],
            after[seat],
            travel,
          );
          const lateral = travellers.length === 1 ? 0 : seat % 2 ? 0.32 : -0.32;
          traveller.root.position.copy(expedition.point(distance, lateral));
          const ahead = expedition.point(
            Math.min(12, distance + 0.06),
            lateral,
          );
          const behind = expedition.point(
            Math.max(0, distance - 0.06),
            lateral,
          );
          heading.setFromAxisAngle(
            up,
            Math.atan2(ahead.x - behind.x, ahead.z - behind.z) + Math.PI,
          );
          planted.setFromUnitVectors(
            up,
            expedition.normalAt(
              traveller.root.position.x,
              traveller.root.position.z,
            ),
          );
          traveller.root.quaternion.copy(planted).multiply(heading);
          traveller.update?.(now / 1000 + seat, travel < 1, still);
        });
        art.updateMatrixWorld(true);
      }
      const fitKey = `${width}:${height}:${signature}`;
      if (fitKey !== fitted) {
        if (expedition) bounds.setFromObject(art);
        fitCamera(camera, bounds, width / height, expedition ? art : undefined);
        fitted = fitKey;
        renderer.shadowMap.needsUpdate = true;
      }
      const animationEnd = Math.max(
        buildEnd,
        expedition ? 1.15 + Math.max(0, travellers.length - 1) * 0.065 : 0,
      );
      if (!settled && (still || elapsed >= animationEnd)) {
        batches.forEach((batch, seat) => batch.sync(data.players[seat].floors));
        settled = true;
        renderer.shadowMap.needsUpdate = true;
      }
      // Contact shadows follow the build/walk, then remain cached while the
      // cloth, water and tiny trophy gleam continue their gentle idle cycles.
      renderer.shadowMap.autoUpdate =
        !still && elapsed < Math.max(buildEnd, expedition ? 1.6 : 0);
      renderer.render(scene, camera);
      if (process.env.NODE_ENV === 'development') {
        surface.dataset.calls = String(renderer.info.render.calls);
        surface.dataset.triangles = String(renderer.info.render.triangles);
        surface.dataset.motion = still ? 'still' : 'animated';
        surface.dataset.elapsed = elapsed.toFixed(2);
        surface.dataset.version = source ? 'source' : 'runtime';
        surface.dataset.settled = String(settled);
        surface.dataset.pixelRatio = String(pixelRatio);
      }
      if (!ready) {
        // The first render compiles materials and uploads the detailed source.
        // Give players the full animation after that work becomes visible.
        started = performance.now();
        lastDraw = 0;
        ready = true;
        latest.current.onReady?.(true);
      }
      if (!still) frame = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!frame && !disposed && !lost && !document.hidden && inView)
        frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(() => {
      fitted = '';
      wake();
    });
    observer.observe(surface);
    const visibility = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) wake();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    visibility.observe(surface);
    const pageVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        started = performance.now() - 2000;
        wake();
      }
    };
    document.addEventListener('visibilitychange', pageVisibility);
    motion.addEventListener('change', wake);
    window.visualViewport?.addEventListener('resize', wake);
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      ready = false;
      cancelAnimationFrame(frame);
      frame = 0;
      latest.current.onReady?.(false);
    };
    const contextRestored = () => {
      environment.dispose();
      environment = makeEnvironment();
      scene.environment = environment.texture;
      lost = false;
      fitted = '';
      renderer.shadowMap.needsUpdate = true;
      wake();
    };
    surface.addEventListener('webglcontextlost', contextLost);
    surface.addEventListener('webglcontextrestored', contextRestored);
    wake();
    // A new score can arrive while reduced motion has stopped the render loop.
    const changed = () => {
      fitted = '';
      wake();
    };
    surface.addEventListener('trivia-update', changed);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', pageVisibility);
      motion.removeEventListener('change', wake);
      window.visualViewport?.removeEventListener('resize', wake);
      surface.removeEventListener('trivia-update', changed);
      surface.removeEventListener('webglcontextlost', contextLost);
      surface.removeEventListener('webglcontextrestored', contextRestored);
      towers.forEach((tower) => {
        tower.root.removeFromParent();
        tower.dispose();
      });
      expedition?.root.removeFromParent();
      expedition?.dispose();
      travellers.forEach((traveller) => {
        traveller.root.removeFromParent();
        traveller.dispose();
      });
      disposeTree(scene);
      environment.dispose();
      clay?.dispose();
      sun.shadow.dispose();
      renderer.dispose();
    };
  }, [mode, players.length, review, source]);

  useEffect(() => {
    canvas.current?.dispatchEvent(new Event('trivia-update'));
  }, [players, animate]);
  return <canvas ref={canvas} className="trivia-scene" aria-hidden="true" />;
}
