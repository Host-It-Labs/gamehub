import * as THREE from 'three';
import type { PlaceId } from '@/lib/games/diner/road';

/**
 * Painted ground for the shift and the road map (9 October 2026): small
 * canvas textures drawn once, tiled in metres. Calm colours with a little
 * wear, so outfits and plates stay the brightest things on screen.
 */

type Draw = (
  c: CanvasRenderingContext2D,
  n: number,
  rand: () => number,
) => void;

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(n: number, draw: Draw, seed = 7) {
  const el = document.createElement('canvas');
  el.width = el.height = n;
  const c = el.getContext('2d')!;
  draw(c, n, seeded(seed));
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Fine speckle and soft blotches over whatever is drawn. */
function grain(
  c: CanvasRenderingContext2D,
  n: number,
  rand: () => number,
  amount: number,
  blotch = 0.05,
) {
  for (let i = 0; i < n * n * amount * 0.004; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    c.fillStyle = `rgba(${v},${v},${v},${0.03 + rand() * 0.05})`;
    c.fillRect(rand() * n, rand() * n, 1 + rand() * 2, 1 + rand() * 2);
  }
  for (let i = 0; i < 18; i++) {
    const x = rand() * n,
      y = rand() * n,
      r = n * (0.05 + rand() * 0.15);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const v = rand() < 0.5 ? '0,0,0' : '255,255,255';
    g.addColorStop(0, `rgba(${v},${blotch})`);
    g.addColorStop(1, `rgba(${v},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
  }
}

/**
 * The patio deck: warm planks running across, with seams, end joints, nail
 * heads and a little grain. One texture repeat is 2.4 × 2.4 m (12 planks).
 */
export function deckTexture() {
  return texture(
    1024,
    (c, n, rand) => {
      const rows = 12;
      const h = n / rows;
      const tones = ['#8d6a4b', '#94704f', '#866448', '#9a7553', '#8a6849'];
      for (let r = 0; r < rows; r++) {
        // Each row of planks is cut in two or three lengths.
        let x = -rand() * n * 0.5;
        while (x < n) {
          const len = n * (0.35 + rand() * 0.45);
          const tone = tones[Math.floor(rand() * tones.length)];
          c.fillStyle = tone;
          c.fillRect(x, r * h, len, h);
          for (let g = 0; g < 9; g++) {
            c.strokeStyle = `rgba(60,38,24,${0.06 + rand() * 0.08})`;
            c.lineWidth = 1 + rand() * 1.5;
            const y = r * h + rand() * h;
            c.beginPath();
            c.moveTo(x, y);
            c.bezierCurveTo(
              x + len * 0.3,
              y + (rand() - 0.5) * 6,
              x + len * 0.6,
              y + (rand() - 0.5) * 6,
              x + len,
              y + (rand() - 0.5) * 4,
            );
            c.stroke();
          }
          c.fillStyle = 'rgba(40,24,16,0.55)';
          c.fillRect(x, r * h, 3, h);
          for (const ny of [0.25, 0.75]) {
            c.fillStyle = 'rgba(50,40,36,0.5)';
            c.beginPath();
            c.arc(x + 10, r * h + h * ny, 2.2, 0, Math.PI * 2);
            c.fill();
          }
          x += len;
        }
        c.fillStyle = 'rgba(36,22,14,0.6)';
        c.fillRect(0, r * h, n, 3);
        c.fillStyle = 'rgba(255,240,220,0.07)';
        c.fillRect(0, r * h + 3, n, 2);
      }
      grain(c, n, rand, 2, 0.04);
    },
    11,
  );
}

/** The diner's checker, for the runner along the counter: 2×2 tiles. */
export function checkerTexture() {
  return texture(
    256,
    (c, n, rand) => {
      const h = n / 2;
      const tiles = ['#d6cab1', '#545150'];
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) {
          c.fillStyle = tiles[(x + y) % 2];
          c.fillRect(x * h, y * h, h, h);
        }
      grain(c, n, rand, 2, 0.03);
      c.strokeStyle = 'rgba(30,26,24,0.35)';
      c.lineWidth = 2;
      c.strokeRect(0, 0, n, n);
      c.beginPath();
      c.moveTo(h, 0);
      c.lineTo(h, n);
      c.moveTo(0, h);
      c.lineTo(n, h);
      c.stroke();
    },
    5,
  );
}

type Ground = {
  colour: string;
  draw: Draw;
  /** metres per texture repeat */ size: number;
};

const GROUNDS: Record<PlaceId, Ground> = {
  // Asphalt with painted bays.
  truckstop: {
    colour: '#3b3a40',
    size: 8,
    draw: (c, n, rand) => {
      c.fillStyle = '#3d3c42';
      c.fillRect(0, 0, n, n);
      grain(c, n, rand, 14, 0.06);
      c.strokeStyle = 'rgba(214,186,96,0.55)';
      c.lineWidth = n * 0.012;
      for (const x of [0.25, 0.75]) {
        c.beginPath();
        c.moveTo(x * n, n * 0.1);
        c.lineTo(x * n, n * 0.9);
        c.stroke();
      }
      c.fillStyle = 'rgba(20,20,24,0.25)';
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.ellipse(
          rand() * n,
          rand() * n,
          n * 0.05,
          n * 0.02,
          rand() * 3,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    },
  },
  // Pale gravel.
  drivein: {
    colour: '#6d6760',
    size: 5,
    draw: (c, n, rand) => {
      c.fillStyle = '#6a645d';
      c.fillRect(0, 0, n, n);
      for (let i = 0; i < 2600; i++) {
        const v = 70 + rand() * 90;
        c.fillStyle = `rgb(${v + 8},${v + 4},${v})`;
        c.beginPath();
        c.ellipse(
          rand() * n,
          rand() * n,
          1 + rand() * 3,
          1 + rand() * 2.4,
          rand() * 3,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      grain(c, n, rand, 4, 0.05);
    },
  },
  // Trodden grass.
  fairground: {
    colour: '#3f5a3c',
    size: 5,
    draw: (c, n, rand) => {
      c.fillStyle = '#41603e';
      c.fillRect(0, 0, n, n);
      for (let i = 0; i < 5200; i++) {
        const x = rand() * n,
          y = rand() * n;
        const g = 70 + rand() * 60;
        c.strokeStyle = `rgba(${g * 0.6},${g + 20},${g * 0.55},0.55)`;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (rand() - 0.5) * 3, y - 2 - rand() * 4);
        c.stroke();
      }
      grain(c, n, rand, 2, 0.06);
    },
  },
  // Weathered pier planks.
  harbour: {
    colour: '#6b5543',
    size: 4,
    draw: (c, n, rand) => {
      const rows = 8;
      for (let i = 0; i < rows; i++) {
        const v = 92 + rand() * 26;
        c.fillStyle = `rgb(${v + 14},${v - 4},${v - 22})`;
        c.fillRect(0, (i * n) / rows, n, n / rows);
        c.fillStyle = 'rgba(30,20,14,0.6)';
        c.fillRect(0, (i * n) / rows, n, 2);
        const cut = rand() * n;
        c.fillRect(cut, (i * n) / rows, 2, n / rows);
        for (let j = 0; j < 30; j++) {
          c.fillStyle = `rgba(40,26,18,${0.05 + rand() * 0.08})`;
          c.fillRect(
            rand() * n,
            (i * n) / rows + rand() * (n / rows),
            10 + rand() * 40,
            1,
          );
        }
      }
      grain(c, n, rand, 3, 0.05);
    },
  },
  // Rounded cobbles.
  oldtown: {
    colour: '#5c5652',
    size: 3,
    draw: (c, n, rand) => {
      c.fillStyle = '#3e3a38';
      c.fillRect(0, 0, n, n);
      const step = n / 10;
      for (let y = 0; y < 10; y++)
        for (let x = 0; x < 11; x++) {
          const ox = (y % 2) * step * 0.5;
          const v = 86 + rand() * 30;
          c.fillStyle = `rgb(${v + 4},${v},${v - 4})`;
          c.beginPath();
          c.ellipse(
            x * step + ox,
            y * step + step / 2,
            step * 0.44,
            step * 0.4,
            rand() * 0.4,
            0,
            Math.PI * 2,
          );
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.06)';
          c.beginPath();
          c.ellipse(
            x * step + ox - step * 0.1,
            y * step + step * 0.38,
            step * 0.22,
            step * 0.14,
            0,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
      grain(c, n, rand, 2, 0.04);
    },
  },
  // Rose-grey desert sand with ripples.
  moonmile: {
    colour: '#6f5a63',
    size: 6,
    draw: (c, n, rand) => {
      c.fillStyle = '#76616a';
      c.fillRect(0, 0, n, n);
      c.strokeStyle = 'rgba(40,24,36,0.18)';
      c.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const y = rand() * n;
        c.beginPath();
        c.moveTo(0, y);
        for (let x = 0; x <= n; x += 16)
          c.lineTo(x, y + Math.sin(x * 0.03 + i) * 5);
        c.stroke();
      }
      grain(c, n, rand, 8, 0.05);
    },
  },
};

export function groundTexture(place: PlaceId) {
  const g = GROUNDS[place];
  const t = texture(512, g.draw, place.length * 31);
  return { texture: t, size: g.size, colour: g.colour };
}
