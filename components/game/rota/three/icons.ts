import * as THREE from 'three';
import {
  PIECE_IDS,
  RAIL,
  RIVER,
  orient,
  pieces,
  DX,
  DY,
} from '@/lib/games/rota/pieces';
import { pieceSegments, stationHalf } from '@/lib/games/rota/routes';
import { Materials, toon } from './materials';
import { routeLook, routeMeshes } from './routes-mesh';
import type { Library } from './assets';
import { setIcon } from '../icon-store';

/**
 * Each piece as a small 3D tile, for the dice faces and the specials: the
 * same streets, tracks and goods sheds as the board, on a square of the
 * cleared site seen from straight above, rendered once with a separate
 * little renderer. The pictures land in a store the piece icons read;
 * until then they keep their drawing.
 */

let started = false;

export async function renderIcons(lib: Library) {
  if (started || typeof document === 'undefined') return;
  started = true;
  const size = 200;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
  } catch {
    return;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e9e2d4', '#8f8272', 1.6));
  const sun = new THREE.DirectionalLight('#ffdcaa', 2.4);
  sun.position.set(-2, 4, -1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -1;
  sc.right = sc.top = 1;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  const mats = new Materials(lib.textures);
  const look = routeLook(mats);
  // A square of ground with a little depth, like a cut tile of the layout.
  const slab = new THREE.BoxGeometry(1, 0.08, 1);
  const uv = slab.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) / 1.2, uv.getY(i) / 1.2);
  const grass = mats.tiled('grass', '#8e9a5d');
  const earth = toon('#6f6257');
  const ground = new THREE.Mesh(slab, [
    earth,
    earth,
    grass,
    earth,
    earth,
    earth,
  ]);
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);
  // Straight down through a long lens: the tile fills the picture as a
  // true square, so a die face or a special never looks skewed (the cube
  // already gives the die its own perspective).
  const camera = new THREE.PerspectiveCamera(14, 1, 0.1, 20);
  const dist = 0.5 / Math.tan(THREE.MathUtils.degToRad(7));
  camera.up.set(0, 0, -1);
  camera.position.set(0, dist, 0);
  camera.lookAt(0, 0, 0);

  for (const p of PIECE_IDS) {
    const group = new THREE.Group();
    for (const m of routeMeshes(
      pieceSegments(p, 0, { x: 0, z: 0 }),
      look,
      stationHalf(p),
    ))
      group.add(m);
    if (pieces[p].station) {
      const grand = p === 'station-cross';
      const src = lib.models.get(grand ? 'goods_grand' : 'goods_shed');
      if (src) {
        const o = src.clone(true);
        mats.dress(o);
        const t = orient(p, 0);
        const r = t.edges.findIndex((e) => e === RAIL);
        o.rotation.y = Math.atan2(DX[r], DY[r]);
        group.add(o);
      }
    }
    // Rivers sink into the tile: water under them.
    if (pieces[p].group === 'river') {
      const t = orient(p, 0);
      const water = toon('#3f7f86');
      const g =
        p === 'river-curve'
          ? new THREE.RingGeometry(0.34, 0.66, 28, 1, Math.PI, Math.PI / 2)
              .rotateX(-Math.PI / 2)
              .translate(0.5, 0, -0.5)
          : new THREE.PlaneGeometry(0.32, 1)
              .rotateX(-Math.PI / 2)
              .rotateY(t.edges[1] === RIVER ? Math.PI / 2 : 0);
      const m = new THREE.Mesh(g, water);
      m.position.y = 0.003;
      group.add(m);
    }
    scene.add(group);
    renderer.render(scene, camera);
    setIcon(p, canvas.toDataURL('image/png'));
    scene.remove(group);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !mesh.geometry.userData.model) mesh.geometry.dispose();
    });
    // Let the page breathe between pieces.
    await new Promise((r) => setTimeout(r, 0));
  }
  renderer.dispose();
  renderer.forceContextLoss();
}
