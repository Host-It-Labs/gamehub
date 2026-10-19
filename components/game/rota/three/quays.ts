import * as THREE from 'three';
import type { MapDef } from '@/lib/games/rota/maps';
import { DX, DY } from '@/lib/games/rota/pieces';
import type { Materials } from './materials';
import { mergeByMaterial } from './routes-mesh';

/** Retaining walls follow the actual land/sea contour, not a painted coast.
 * Copings sit on the water side of the boundary, leaving every cell usable.
 * A wharf has an open centre so its road/rail leaves without an obstruction. */
export function quays(map: MapDef, mats: Materials) {
  const group = new THREE.Group();
  if (!map.sea.length) return group;
  const sea = new Set(map.sea);
  const parts: THREE.Mesh[] = [];
  const stone = mats.tiled('stone', '#82908d');
  const coping = mats.tiled('stone', '#c2c7b8');
  const iron = mats.tiled('metal', '#3d5053');
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parts.push(mesh);
  };
  for (let cell = 0; cell < map.size ** 2; cell++) {
    if (sea.has(cell)) continue;
    const x = cell % map.size,
      z = Math.floor(cell / map.size);
    for (let dir = 0; dir < 4; dir++) {
      const nx = x + DX[dir],
        nz = z + DY[dir];
      if (
        nx < 0 ||
        nz < 0 ||
        nx >= map.size ||
        nz >= map.size ||
        !sea.has(nz * map.size + nx)
      )
        continue;
      const sideX = -DY[dir],
        sideZ = DX[dir];
      const cx = x + 0.5 + DX[dir] * 0.53,
        cz = z + 0.5 + DY[dir] * 0.53;
      const pier = map.exits.some(
        (e) => e.cell === cell && e.dir === dir && e.pier,
      );
      const lengths = pier ? [-0.36, 0.36] : [-0.375, -0.125, 0.125, 0.375];
      for (const along of lengths) {
        const w = pier ? 0.27 : 0.245;
        box(
          dir % 2 ? 0.075 : w,
          0.105,
          dir % 2 ? w : 0.075,
          cx + sideX * along,
          -0.026,
          cz + sideZ * along,
          stone,
        );
        box(
          dir % 2 ? 0.095 : w + 0.003,
          0.018,
          dir % 2 ? w + 0.003 : 0.095,
          cx + sideX * along,
          0.033,
          cz + sideZ * along,
          coping,
        );
      }
      for (const along of [-0.34, 0.34]) {
        const bx = cx + sideX * along,
          bz = cz + sideZ * along;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.013, 0.019, 0.045, 8),
          iron,
        );
        post.position.set(bx, 0.064, bz);
        parts.push(post);
        box(0.045, 0.012, 0.025, bx, 0.086, bz, iron);
      }
    }
  }
  for (const mesh of mergeByMaterial(parts)) {
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
