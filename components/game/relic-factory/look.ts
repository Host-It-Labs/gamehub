import * as THREE from 'three';
import type { MatKey } from './kit';

/** The factory's shared materials: painted enamel, glossy enamel, brass,
 * rubber, paper, light bulbs and glass. Colours live in the vertices, so one
 * material serves every machine. Only the enamel and glass use a clear coat;
 * glass avoids a transmission pass across the whole instanced factory. */
export function makeMaterials(): Record<MatKey, THREE.Material> {
  return {
    paint: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.74,
      metalness: 0,
    }),
    gloss: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.9,
    }),
    metal: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.26,
      metalness: 0.88,
      envMapIntensity: 1.15,
    }),
    dark: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0,
    }),
    glow: new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
      roughness: 0.12,
      metalness: 0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.2,
      depthWrite: false,
    }),
  };
}

function canvas(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  draw(el.getContext('2d')!);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rubber with chevrons pointing the way the belt runs (+u). */
export function chevronTexture() {
  const t = canvas(256, 256, (c) => {
    c.fillStyle = '#292f2d';
    c.fillRect(0, 0, 256, 256);
    // Fine ribs catch the light without becoming visual noise at overview.
    for (let x = 0; x < 256; x += 16) {
      c.fillStyle = '#202725';
      c.fillRect(x, 0, 2, 256);
      c.fillStyle = '#343b37';
      c.fillRect(x + 2, 0, 1, 256);
    }
    c.strokeStyle = '#53645a';
    c.lineWidth = 25;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(64, 42);
    c.lineTo(165, 128);
    c.lineTo(64, 214);
    c.stroke();
    c.fillStyle = '#1b201e';
    c.fillRect(0, 0, 256, 9);
    c.fillRect(0, 247, 256, 9);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.anisotropy = 16;
  return t;
}

/** Linear height data matching the eight tiles across floor.webp. The
 * original painted colour stays; grout and a rolled tile edge catch light
 * independently, so the floor has relief when viewed close to the models. */
export function floorBumpTexture() {
  const t = canvas(1024, 1024, (c) => {
    c.fillStyle = '#505050';
    c.fillRect(0, 0, 1024, 1024);
    for (let y = 0; y < 1024; y += 128)
      for (let x = 0; x < 1024; x += 128) {
        c.fillStyle = '#8c8c8c';
        c.fillRect(x + 2, y + 2, 124, 124);
        c.fillStyle = '#b6b6b6';
        c.fillRect(x + 3, y + 3, 122, 122);
        c.fillStyle = '#c8c8c8';
        c.fillRect(x + 5, y + 5, 118, 118);
      }
    // Deterministic, very shallow enamel texture; no generated raster source.
    let seed = 7349;
    for (let i = 0; i < 10000; i++) {
      seed = Math.imul(seed ^ (seed >>> 13), 1597334677) >>> 0;
      const x = seed % 1024;
      seed = Math.imul(seed ^ (seed >>> 15), 1597334677) >>> 0;
      const y = seed % 1024;
      if (x % 128 < 6 || y % 128 < 6 || x % 128 > 122 || y % 128 > 122)
        continue;
      c.fillStyle = i % 2 ? '#c6c6c6' : '#cacaca';
      c.fillRect(x, y, 1, 1);
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}

/** Faint cell lines to place machines by (one cell per repeat). */
export function gridTexture() {
  const t = canvas(64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    c.strokeStyle = 'rgba(255, 240, 205, 0.9)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, 62, 62);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** A rounded square outline: hover, selection and removal marks. */
export function markTexture() {
  return canvas(128, 128, (c) => {
    c.clearRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.strokeStyle = '#ffffff';
    c.lineWidth = 9;
    c.beginPath();
    c.roundRect(8, 8, 112, 112, 20);
    c.fill();
    c.stroke();
  });
}

/** A chevron pointing +u, for intake and output marks. */
export function arrowTexture() {
  return canvas(64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(12, 10);
    c.lineTo(52, 32);
    c.lineTo(12, 54);
    c.lineTo(22, 32);
    c.closePath();
    c.fill();
  });
}

/** The red warning disc over a stuck machine. */
export function badgeTexture() {
  return canvas(64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    c.fillStyle = '#e8352b';
    c.beginPath();
    c.arc(32, 32, 28, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = '#fff3d6';
    c.stroke();
    c.fillStyle = '#fff3d6';
    c.fillRect(28, 14, 8, 24);
    c.beginPath();
    c.arc(32, 47, 5, 0, Math.PI * 2);
    c.fill();
  });
}

/** A soft round shadow under the whole floor. */
export function shadowTexture() {
  return canvas(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,10,8,0.75)');
    g.addColorStop(0.6, 'rgba(0,10,8,0.35)');
    g.addColorStop(1, 'rgba(0,10,8,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}

/** A soft glow for halos and sparkles. */
export function glowTexture() {
  return canvas(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

/** A five-pointed star as a flat shape facing +y. */
export function starGeometry(r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2,
      rr = i % 2 ? r * 0.45 : r;
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}
