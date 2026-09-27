import * as THREE from 'three';
import type { Pin } from '../../lib/games/party/geography.ts';
export const vector = (p: Pin, radius = 1) => {
  const lat = THREE.MathUtils.degToRad(p.lat),
    lng = THREE.MathUtils.degToRad(p.lng);
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lng),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lng),
  ).multiplyScalar(radius);
};
const mercatorLat = (y: number, n: number) =>
  THREE.MathUtils.radToDeg(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))));
/** Web Mercator stops at about ±85.05°. */
export const mercatorLimit = mercatorLat(0, 1);
export function tileGeometry(z: number, x: number, y: number) {
  const n = 2 ** z,
    // Low zooms span wide arcs; fine rows keep their flat facets on the sphere.
    segs = z < 4 ? 32 : z < 7 ? 16 : 8;
  const positions: number[] = [],
    uvs: number[] = [],
    index: number[] = [];
  // Rows are even in Mercator space, so the image maps without warping.
  const rows = Array.from({ length: segs + 1 }, (_, j) => ({
    lat: mercatorLat(y + j / segs, n),
    v: 1 - j / segs,
  }));
  for (const { lat, v: tv } of rows)
    for (let i = 0; i <= segs; i++) {
      const lng = ((x + i / segs) / n) * 360 - 180;
      const v = vector({ lat, lng });
      positions.push(v.x, v.y, v.z);
      uvs.push(i / segs, tv);
    }
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i,
        b = a + segs + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

/** The bundled equirectangular image has actual polar coverage. Mercator
 * tiles stop at their native limit instead of stretching into changing wedges. */
export function polarGeometry(north: boolean) {
  const columns = 128,
    rings = 24;
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const lat = north
      ? 90 - ((90 - mercatorLimit) * j) / rings
      : -mercatorLimit - ((90 - mercatorLimit) * j) / rings;
    for (let i = 0; i <= columns; i++) {
      const p = vector({ lat, lng: (i / columns) * 360 - 180 });
      positions.push(p.x, p.y, p.z);
      uvs.push(i / columns, (lat + 90) / 180);
    }
  }
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i,
        b = a + columns + 1;
      if (!north || j > 0) indices.push(a, b, a + 1);
      if (north || j < rings - 1) indices.push(b, b + 1, a + 1);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/** Keep desktop imagery detail on short phone canvases as well. The drawing
 * buffer still follows the actual viewport; only tile selection has a floor. */
export function imageryZoom(
  height: number,
  fov: number,
  distance: number,
  lat = 0,
  slant = 1,
) {
  const pixels =
    Math.max(1080, height) /
    2 /
    Math.tan(THREE.MathUtils.degToRad(fov / 2)) /
    distance;
  const shrink =
    Math.cos(THREE.MathUtils.degToRad(Math.min(Math.abs(lat), mercatorLimit))) *
    Math.sqrt(Math.max(0.1, slant));
  return Math.min(
    16,
    Math.ceil(Math.log2((pixels * 2 * Math.PI * shrink) / 256)),
  );
}
