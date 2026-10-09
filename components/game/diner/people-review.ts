import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Look } from '@/lib/games/diner/content';
import { makeMaterials, type Materials } from './kit';
import { disposeSurfaceMaterials } from './materials';
import { releaseShared } from './model-cache';
import { guestFigure, waiterFigure, type PeopleDetail } from './people';
import { expression } from './people';
import {
  HUMAN_STRIDE_DISTANCE,
  poseFigure,
  resetFigurePose,
} from './people-motion';

export type PeopleReviewView = 'front' | 'side' | 'back' | 'face' | 'game';
type Surface = 'clay' | 'silhouette' | 'colour';
type Motion =
  | 'idle'
  | 'walk'
  | 'start-stop'
  | 'carry'
  | 'serve'
  | 'sit'
  | 'eat'
  | 'mop';
type ReviewOptions = {
  detail?: PeopleDetail;
  seat?: number;
  look?: Look;
  view?: PeopleReviewView;
  surface?: Surface;
  motion?: Motion;
  speed?: number;
  reduced?: boolean;
  width?: number;
  height?: number;
};

/**
 * Honest source review in the same Three renderer/material pipeline as the
 * diner. Import this from the running dev server and pass a separate canvas;
 * it never reads or writes game state, storage, the active view or progression.
 */
export function createPeopleReview(
  canvas: HTMLCanvasElement,
  options: ReviewOptions = {},
) {
  const width = options.width ?? (canvas.clientWidth || 960);
  const height = options.height ?? (canvas.clientHeight || 960);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e7df');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentScene = new RoomEnvironment();
  const environment = pmrem.fromScene(environmentScene, 0.06);
  environmentScene.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.4;
  scene.add(new THREE.HemisphereLight('#fff7e6', '#758296', 1.7));
  const key = new THREE.DirectionalLight('#fff9eb', 2.6);
  key.position.set(-2.5, 4.8, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0003;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#cad9ee', 1.0);
  fill.position.set(3, 2, -2.5);
  scene.add(fill);

  const materials = makeMaterials();
  const clay = new THREE.MeshStandardMaterial({
    color: '#b4b1a6',
    roughness: 0.92,
    metalness: 0,
  });
  const silhouette = new THREE.MeshBasicMaterial({ color: '#18202a' });
  const figure = options.look
    ? guestFigure(materials, options.look, options.detail ?? 'source')
    : waiterFigure(materials, options.seat ?? 0, options.detail ?? 'source');
  if (options.look) figure.root.scale.setScalar(1.3);
  const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  figure.root.traverse((node) => {
    if (node instanceof THREE.Mesh) original.set(node, node.material);
  });
  scene.add(figure.root);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: '#d5d2c7',
    roughness: 0.97,
  });
  const floorGeometry = new THREE.PlaneGeometry(200, 200);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(120, 120, '#b5b9bd', '#c9c7bf');
  grid.position.y = 0.0001;
  scene.add(grid);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 200);
  let view = options.view ?? 'front';
  let motion = options.motion ?? 'idle';
  let reduced = options.reduced ?? false;
  let surface: Surface = 'colour';
  let elapsed = 0;
  let hasPose = false;

  function setSurface(next: Surface) {
    surface = next;
    for (const [mesh, own] of original)
      mesh.material =
        next === 'clay' ? clay : next === 'silhouette' ? silhouette : own;
  }
  function setCamera(z: number) {
    const scale = figure.root.scale.y;
    const face = view === 'face';
    const span = face
      ? 0.55 * scale
      : view === 'game'
        ? 1.95 * scale
        : 1.74 * scale;
    const target = face
      ? new THREE.Vector3(0, 1.15 * scale, z + 0.015)
      : new THREE.Vector3(0, 0.72 * scale, z);
    const position =
      view === 'side'
        ? new THREE.Vector3(4 * scale, 0.85 * scale, z)
        : view === 'back'
          ? new THREE.Vector3(0, 0.85 * scale, z - 4 * scale)
          : view === 'game'
            ? new THREE.Vector3(2.1 * scale, 3.8 * scale, z + 4.9 * scale)
            : new THREE.Vector3(0, (face ? 1.15 : 0.85) * scale, z + 4 * scale);
    camera.left = (-span * width) / height / 2;
    camera.right = -camera.left;
    camera.top = span / 2;
    camera.bottom = -camera.top;
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    key.position.z = z + 4;
    key.target.position.set(0, 0.6, z);
  }
  function draw(time = elapsed) {
    const dt = time - elapsed;
    const newPose = !hasPose || time !== elapsed;
    elapsed = time;
    const walking = motion === 'walk' || motion === 'carry';
    const speed = options.speed ?? 1.6;
    let distance = walking ? time * speed : 0;
    let moving = walking;
    if (motion === 'start-stop') {
      const cycle = Math.floor(time / 5.2),
        t = time % 5.2;
      moving = t > 0.6 && t < 3.7;
      let take = 0;
      if (t >= 3.7) take = 2.9;
      else if (t > 3.5) {
        const u = (t - 3.5) / 0.2;
        take = 2.8 + 0.2 * (u - u ** 3 + 0.5 * u ** 4);
      } else if (t >= 0.8) take = 0.1 + t - 0.8;
      else if (t > 0.6) {
        const u = (t - 0.6) / 0.2;
        take = 0.2 * (u ** 3 - 0.5 * u ** 4);
      }
      distance = (cycle * 2.9 + take) * speed;
    }
    figure.root.position.set(
      0,
      motion === 'sit' || motion === 'eat' ? 0.16 : 0,
      distance,
    );
    const phase =
      ((distance / (HUMAN_STRIDE_DISTANCE * figure.root.scale.z)) % 1) *
      Math.PI *
      2;
    if (newPose) {
      hasPose = true;
      poseFigure(figure, {
        time,
        phase,
        moving: moving ? 1 : 0,
        carry: motion === 'carry',
        sitting: motion === 'sit' || motion === 'eat',
        eating: motion === 'eat',
        gesture: motion === 'serve' ? (time % 1.6) / 1.6 : 0,
        mopping: motion === 'mop',
        reduced,
        dt: dt > 0 ? dt : undefined,
      });
      expression(
        figure,
        motion === 'eat' ? 'eat' : motion === 'serve' ? 'smile' : 'rest',
        time,
        0,
        reduced,
      );
    }
    setCamera(distance);
    renderer.render(scene, camera);
    return canvas;
  }
  function report() {
    let draws = 0,
      triangles = 0;
    figure.root.traverseVisible((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      draws++;
      triangles +=
        (node.geometry.index?.count ??
          node.geometry.getAttribute('position').count) / 3;
    });
    return {
      width,
      height,
      view,
      surface,
      motion,
      reduced,
      draws,
      triangles,
      rendererCalls: renderer.info.render.calls,
      renderedTriangles: renderer.info.render.triangles,
    };
  }
  setSurface(options.surface ?? 'clay');
  draw(0);
  return {
    figure,
    renderer,
    scene,
    camera,
    draw,
    report,
    setView(next: PeopleReviewView) {
      view = next;
      draw();
    },
    setSurface(next: Surface) {
      setSurface(next);
      draw();
    },
    setMotion(next: Motion) {
      motion = next;
      hasPose = false;
      resetFigurePose(figure);
      draw(0);
    },
    setReduced(next: boolean) {
      reduced = next;
      hasPose = false;
      draw();
    },
    dispose() {
      resetFigurePose(figure);
      scene.remove(figure.root);
      releaseShared(figure.root);
      disposeSurfaceMaterials(materials as Materials);
      clay.dispose();
      silhouette.dispose();
      floorMaterial.dispose();
      floorGeometry.dispose();
      grid.geometry.dispose();
      const gridMaterials = Array.isArray(grid.material)
        ? grid.material
        : [grid.material];
      for (const material of gridMaterials) material.dispose();
      environment.dispose();
      key.shadow.dispose();
      renderer.dispose();
    },
  };
}
