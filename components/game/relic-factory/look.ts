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
    // Satin, not lacquer: a soft sheen that keeps colours flat and calm.
    gloss: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.6,
    }),
    metal: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.82,
      envMapIntensity: 0.8,
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
    c.fillStyle = '#2b2f36';
    c.fillRect(0, 0, 256, 256);
    // Fine ribs catch the light without becoming visual noise at overview.
    for (let x = 0; x < 256; x += 16) {
      c.fillStyle = '#20242b';
      c.fillRect(x, 0, 2, 256);
      c.fillStyle = '#363b43';
      c.fillRect(x + 2, 0, 1, 256);
    }
    c.strokeStyle = '#d6b665';
    c.lineWidth = 36;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(64, 42);
    c.lineTo(165, 128);
    c.lineTo(64, 214);
    c.stroke();
    c.fillStyle = '#191c23';
    c.fillRect(0, 0, 256, 9);
    c.fillRect(0, 247, 256, 9);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  t.anisotropy = 16;
  return t;
}

export const FLOOR_TILES_PER_REPEAT = 2;
export const REACH_STYLE = {
  lamp: { colour: '#f1e2b4', idle: 0.24, boost: 0.42 },
  charm: { colour: '#b7e3bf', idle: 0.18, boost: 0.32 },
} as const;

/** Pale sage stone, four subtly different tiles. The 2x2 repeat keeps each
 * tile aligned with one factory cell; all grain is deterministic. */
export function floorTexture() {
  const t = canvas(256, 256, (c) => {
    c.fillStyle = '#8e9f8b';
    c.fillRect(0, 0, 256, 256);
    const tones = ['#b5c0a9', '#afbba3', '#b9c3ad', '#b2bea6'];
    for (let row = 0; row < FLOOR_TILES_PER_REPEAT; row++)
      for (let col = 0; col < FLOOR_TILES_PER_REPEAT; col++) {
        const x = col * 128,
          y = row * 128;
        c.fillStyle = tones[row * 2 + col];
        c.fillRect(x + 1, y + 1, 126, 126);
        c.fillStyle = 'rgba(244,248,232,0.14)';
        c.fillRect(x + 2, y + 2, 124, 1);
        c.fillRect(x + 2, y + 2, 1, 124);
        c.fillStyle = 'rgba(52,74,60,0.14)';
        c.fillRect(x + 126, y + 2, 1, 125);
        c.fillRect(x + 2, y + 126, 125, 1);
      }
    let seed = 7349;
    for (let i = 0; i < 1800; i++) {
      seed = Math.imul(seed ^ (seed >>> 13), 1597334677) >>> 0;
      const x = 3 + (seed % 250);
      seed = Math.imul(seed ^ (seed >>> 15), 1597334677) >>> 0;
      const y = 3 + (seed % 250);
      c.fillStyle = i % 2 ? 'rgba(52,74,60,0.04)' : 'rgba(244,248,232,0.04)';
      c.fillRect(x, y, 1, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}

/** Shallow stone relief matching the procedural colour tile. */
export function floorBumpTexture() {
  const t = canvas(256, 256, (c) => {
    c.fillStyle = '#909090';
    c.fillRect(0, 0, 256, 256);
    for (let row = 0; row < FLOOR_TILES_PER_REPEAT; row++)
      for (let col = 0; col < FLOOR_TILES_PER_REPEAT; col++) {
        c.fillStyle = '#b8b8b8';
        c.fillRect(col * 128 + 1, row * 128 + 1, 126, 126);
        c.fillStyle = '#bebebe';
        c.fillRect(col * 128 + 2, row * 128 + 2, 124, 124);
      }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}

/** A feathered square, not a radius: diagonal neighbours get the same
 * reach as cardinal neighbours. No per-booster lights or texture loads. */
export function reachTexture(sparkles = false) {
  return canvas(256, 256, (c) => {
    const pixels = c.createImageData(256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const d = Math.max(Math.abs(x - 127.5), Math.abs(y - 127.5)) / 128;
        const edge = Math.max(0, Math.min(1, (1 - d) / 0.14));
        const a = edge * edge * (3 - 2 * edge) * (0.7 + (1 - d) * 0.18);
        const i = (y * 256 + x) * 4;
        pixels.data.set([255, 255, 255, Math.round(a * 255)], i);
      }
    c.putImageData(pixels, 0, 0);
    if (sparkles) {
      c.fillStyle = 'rgba(255,255,255,0.86)';
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++) {
          const x = 30 + col * 84 + (row % 2) * 8,
            y = 38 + row * 82;
          c.beginPath();
          c.moveTo(x, y - 4);
          c.lineTo(x + 1.4, y - 1.4);
          c.lineTo(x + 4, y);
          c.lineTo(x + 1.4, y + 1.4);
          c.lineTo(x, y + 4);
          c.lineTo(x - 1.4, y + 1.4);
          c.lineTo(x - 4, y);
          c.lineTo(x - 1.4, y - 1.4);
          c.closePath();
          c.fill();
        }
    }
  });
}

/** Faint cell lines to place machines by (one cell per repeat). */
export function gridTexture() {
  const t = canvas(64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    c.strokeStyle = 'rgba(46, 72, 58, 0.5)';
    c.lineWidth = 1.4;
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
