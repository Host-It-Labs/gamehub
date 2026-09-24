'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Pin } from '@/lib/games/party/geography';
export type MapPin = Pin & { label: string; color: string; answer?: boolean };
const vector = (p: Pin, radius = 1) => {
  const lat = THREE.MathUtils.degToRad(p.lat),
    lng = THREE.MathUtils.degToRad(p.lng);
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lng),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lng),
  ).multiplyScalar(radius);
};
const location = (v: THREE.Vector3): Pin => ({
  lat: THREE.MathUtils.radToDeg(
    Math.asin(THREE.MathUtils.clamp(v.y / v.length(), -1, 1)),
  ),
  lng: THREE.MathUtils.radToDeg(Math.atan2(-v.z, v.x)),
});

/** Close-up imagery: Web Mercator satellite tiles, draped on the globe as
 * sphere patches once the camera is closer than the bundled 2048 px texture
 * can serve. */
const tileUrl = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
export const tileCredit = 'Imagery © Esri, Maxar, Earthstar Geographics';
const minTileZoom = 4,
  maxTileZoom = 16,
  maxTiles = 220,
  maxLoading = 8;
/** Closest camera: about 60 km above the ground. */
const minAltitude = 0.0095;
const mercatorLat = (y: number, n: number) =>
  THREE.MathUtils.radToDeg(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))));
function tileGeometry(z: number, x: number, y: number) {
  const n = 2 ** z,
    segs = z < 7 ? 16 : 8;
  const positions: number[] = [],
    uvs: number[] = [],
    index: number[] = [];
  for (let j = 0; j <= segs; j++) {
    // Rows are even in Mercator space, so the image maps without warping.
    const lat = mercatorLat(y + j / segs, n);
    for (let i = 0; i <= segs; i++) {
      const lng = ((x + i / segs) / n) * 360 - 180;
      const v = vector({ lat, lng });
      positions.push(v.x, v.y, v.z);
      uvs.push(i / segs, 1 - j / segs);
    }
  }
  for (let j = 0; j < segs; j++)
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
/** A map pin: a round head on a short stem, its tip on the spot. */
function pinTexture(pin: MapPin) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.shadowColor = '#0008';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(32, 92);
  ctx.bezierCurveTo(26, 74, 8, 62, 8, 34);
  ctx.arc(32, 34, 24, Math.PI, 0);
  ctx.bezierCurveTo(56, 62, 38, 74, 32, 92);
  ctx.closePath();
  ctx.fillStyle = pin.color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = pin.answer ? '#173f40' : '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pin.answer ? '★' : pin.label.slice(0, 1), 32, 35);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function GeoPinMap({
  pins,
  onPin,
}: {
  pins: MapPin[];
  onPin?: (pin: Pin) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<{
    reset: () => void;
    pins: (p: MapPin[]) => void;
  } | null>(null);
  const pick = useRef(onPin);
  const [status, setStatus] = useState('Loading satellite imagery…');
  const [tiled, setTiled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    pick.current = onPin;
  }, [onPin]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() =>
        setStatus(
          'The globe needs WebGL. Enable hardware acceleration or try another browser.',
        ),
      );
      return;
    }
    let disposed = false,
      loaded = false;
    const scene = new THREE.Scene();
    renderer.setClearColor(0x000000, 0);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.002, 20);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute(
      'aria-label',
      'Satellite globe. Drag to rotate; pinch or scroll to zoom. Arrow keys rotate, plus and minus zoom, Enter places a pin at the crosshair. Home resets the globe.',
    );
    container.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = false;
    // Zoom works in altitude, below, so it slows as the ground gets close.
    controls.enableZoom = false;
    controls.minDistance = 1 + minAltitude;
    controls.maxDistance = 8;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const geometry = new THREE.SphereGeometry(1, 128, 96);
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
    // A thin sky-blue rim so the globe reads as a planet on the desk.
    const haloGeometry = new THREE.SphereGeometry(1.045, 64, 48);
    const halo = new THREE.Mesh(
      haloGeometry,
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        vertexShader: `varying vec3 vNormal; varying vec3 vView;
          void main() {
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-p.xyz);
            gl_Position = projectionMatrix * p;
          }`,
        fragmentShader: `varying vec3 vNormal; varying vec3 vView;
          void main() {
            // Strongest at the globe's edge, fading out into the room.
            float rim = pow(clamp(-dot(vNormal, vView) * 3.4, 0.0, 1.0), 2.0);
            gl_FragColor = vec4(0.45, 0.72, 1.0, rim * 0.7);
          }`,
      }),
    );
    scene.add(halo);
    const tiles = new THREE.Group();
    scene.add(tiles);
    const markers = new THREE.Group();
    scene.add(markers);
    const arcs = new THREE.Group();
    scene.add(arcs);
    let frame = 0,
      drawing: { start: number; lines: Line2[] } | null = null,
      flight: {
        start: number;
        from: THREE.Vector3;
        to: THREE.Vector3;
        ms: number;
      } | null = null;
    const halfFov = () => THREE.MathUtils.degToRad(camera.fov / 2);
    function fitDistance() {
      return (
        1.04 /
        Math.sin(Math.atan(Math.tan(halfFov()) * Math.min(1, camera.aspect)))
      );
    }
    /** Dragging holds the ground under the pointer at every zoom level:
     * OrbitControls turns 2π·rotateSpeed per element height, and the view
     * spans 2·altitude·tan(fov/2) of ground there. */
    function pace() {
      const altitude = camera.position.length() - 1;
      controls.rotateSpeed = THREE.MathUtils.clamp(
        (altitude * Math.tan(halfFov())) / Math.PI,
        0.0005,
        1,
      );
    }
    function paint() {
      if (disposed) return;
      frame = 0;
      const now = performance.now();
      if (flight) {
        const t = Math.min(1, (now - flight.start) / flight.ms),
          e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
        const len = THREE.MathUtils.lerp(
          flight.from.length(),
          flight.to.length(),
          e,
        );
        camera.position
          .copy(flight.from)
          .normalize()
          .lerp(flight.to.clone().normalize(), e)
          .normalize()
          .multiplyScalar(len);
        controls.update();
        if (t >= 1) flight = null;
      }
      if (drawing) {
        const t = Math.min(1, (now - drawing.start) / 900);
        for (const line of drawing.lines) {
          const total = line.userData.segments as number;
          line.geometry.instanceCount = Math.max(1, Math.round(total * t));
        }
        if (t >= 1) drawing = null;
      }
      pace();
      halo.visible = camera.position.length() > 1.12;
      // Pins stand on top of everything but hide past the horizon.
      const eye = camera.position;
      for (const m of markers.children)
        m.visible = m.userData.normal.dot(eye) > 1.002;
      refreshTiles();
      renderer.render(scene, camera);
      if (flight || drawing) render();
    }
    const render = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(paint);
    };

    // Tiles: cached patches by key, the visible set picked from a grid of
    // rays through the view, and a missing tile covered by its parent.
    type Tile = {
      mesh: THREE.Mesh;
      z: number;
      ready: boolean;
      used: number;
    };
    const cache = new Map<string, Tile>();
    let loading = 0,
      queue: [number, number, number, number][] = [];
    const ray = new THREE.Raycaster(),
      ball = new THREE.Sphere(new THREE.Vector3(), 1),
      hit = new THREE.Vector3();
    function tileZoom() {
      const altitude = camera.position.length() - 1;
      const pxPerRadian =
        renderer.domElement.height / 2 / Math.tan(halfFov()) / altitude;
      return Math.min(
        maxTileZoom,
        Math.floor(Math.log2((pxPerRadian * 2 * Math.PI) / 256) + 0.3),
      );
    }
    function loadTile(z: number, x: number, y: number) {
      const key = `${z}/${x}/${y}`;
      const tileMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1 - z,
        polygonOffsetUnits: -4 - z,
      });
      const mesh = new THREE.Mesh(tileGeometry(z, x, y), tileMaterial);
      mesh.renderOrder = z;
      mesh.visible = false;
      tiles.add(mesh);
      const tile: Tile = { mesh, z, ready: false, used: performance.now() };
      cache.set(key, tile);
      loading++;
      new THREE.TextureLoader().load(
        tileUrl(z, x, y),
        (texture) => {
          loading--;
          if (disposed || cache.get(key) !== tile) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tileMaterial.map = texture;
          tileMaterial.opacity = 1;
          tileMaterial.transparent = false;
          tileMaterial.needsUpdate = true;
          tile.ready = true;
          render();
        },
        undefined,
        () => {
          loading--;
          render();
        },
      );
    }
    function dropTile(key: string) {
      const tile = cache.get(key)!;
      const m = tile.mesh.material as THREE.MeshBasicMaterial;
      m.map?.dispose();
      m.dispose();
      tile.mesh.geometry.dispose();
      tiles.remove(tile.mesh);
      cache.delete(key);
    }
    function refreshTiles() {
      const z = tileZoom();
      for (const t of cache.values()) t.mesh.visible = false;
      if (!loaded || z < minTileZoom) {
        queue = [];
        setTiled(false);
        return;
      }
      const n = 2 ** z,
        wanted = new Map<string, [number, number, number, number]>(),
        grid = 12,
        point = new THREE.Vector2();
      for (let gy = 0; gy <= grid; gy++)
        for (let gx = 0; gx <= grid; gx++) {
          point.set((gx / grid) * 2 - 1, (gy / grid) * 2 - 1);
          ray.setFromCamera(point, camera);
          if (!ray.ray.intersectSphere(ball, hit)) continue;
          const p = location(hit);
          if (Math.abs(p.lat) > 85) continue;
          const x = Math.floor(((p.lng + 180) / 360) * n) % n;
          const s = Math.sin(THREE.MathUtils.degToRad(p.lat));
          const y = Math.floor(
            (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n,
          );
          const d = Math.hypot(gx / grid - 0.5, gy / grid - 0.5);
          const key = `${z}/${x}/${y}`;
          const prev = wanted.get(key);
          if (!prev || prev[3] > d) wanted.set(key, [z, x, y, d]);
        }
      const now = performance.now();
      queue = [];
      for (const [key, [tz, x, y, d]] of wanted) {
        const tile = cache.get(key);
        if (tile?.ready) {
          tile.mesh.visible = true;
          tile.used = now;
          continue;
        }
        if (!tile) queue.push([tz, x, y, d]);
        // Until it arrives, the nearest loaded ancestor stands in.
        for (let up = 1; up <= tz - minTileZoom + 1; up++) {
          const parent = cache.get(`${tz - up}/${x >> up}/${y >> up}`);
          if (parent?.ready) {
            parent.mesh.visible = true;
            parent.used = now;
            break;
          }
        }
      }
      queue.sort((a, b) => a[3] - b[3]);
      while (loading < maxLoading && queue.length) {
        const [tz, x, y] = queue.shift()!;
        loadTile(tz, x, y);
      }
      if (cache.size > maxTiles) {
        const old = [...cache.entries()]
          .filter(([, t]) => !t.mesh.visible && t.ready)
          .sort((a, b) => a[1].used - b[1].used)
          .slice(0, cache.size - maxTiles);
        for (const [key] of old) dropTile(key);
      }
      setTiled([...cache.values()].some((t) => t.mesh.visible));
    }

    const texture = new THREE.TextureLoader().load(
      '/maps/earth-satellite.jpg',
      () => {
        if (disposed) {
          texture.dispose();
          return;
        }
        loaded = true;
        setStatus('');
        render();
      },
      undefined,
      () => {
        if (!disposed)
          setStatus('Satellite imagery could not load. Retry the globe.');
      },
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    material.map = texture;

    function clearPins() {
      while (markers.children.length) {
        const sprite = markers.children[0] as THREE.Sprite;
        sprite.material.map?.dispose();
        sprite.material.dispose();
        markers.remove(sprite);
      }
      while (arcs.children.length) {
        const line = arcs.children[0] as Line2;
        line.geometry.dispose();
        line.material.dispose();
        arcs.remove(line);
      }
      drawing = null;
    }
    let lastAnswer = '',
      shownPins: MapPin[] = [];
    function updatePins(next: MapPin[]) {
      clearPins();
      shownPins = next;
      const { width, height } = container!.getBoundingClientRect();
      for (const pin of next) {
        const map = pinTexture(pin);
        if (!map) continue;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map,
            sizeAttenuation: false,
            depthTest: false,
            depthWrite: false,
          }),
        );
        sprite.center.set(0.5, 0);
        sprite.renderOrder = pin.answer ? 1001 : 1000;
        sprite.position.copy(vector(pin, 1.001));
        sprite.userData.normal = vector(pin);
        sprite.scale.set(0.04, 0.06, 1);
        markers.add(sprite);
      }
      // Arcs from every guess to the answer, drawn in.
      const answer = next.find((p) => p.answer);
      const lines: Line2[] = [];
      if (answer) {
        const to = vector(answer);
        for (const pin of next) {
          if (pin.answer) continue;
          const from = vector(pin);
          const angle = from.angleTo(to);
          if (angle < 0.002) continue;
          const steps = Math.max(12, Math.ceil(angle * 60)),
            lift = Math.min(0.2, angle * 0.12),
            points: number[] = [];
          for (let i = 0; i <= steps; i++) {
            const t = i / steps,
              // Spherical interpolation, lifted into a gentle arch.
              p = from
                .clone()
                .multiplyScalar(Math.sin((1 - t) * angle))
                .add(to.clone().multiplyScalar(Math.sin(t * angle)))
                .divideScalar(Math.sin(angle))
                .multiplyScalar(1.002 + Math.sin(t * Math.PI) * lift);
            points.push(p.x, p.y, p.z);
          }
          const lineGeometry = new LineGeometry();
          lineGeometry.setPositions(points);
          const line = new Line2(
            lineGeometry,
            new LineMaterial({
              color: pin.color,
              linewidth: 3,
              transparent: true,
              opacity: 0.95,
              resolution: new THREE.Vector2(width, height),
            }),
          );
          line.userData.segments = steps;
          line.renderOrder = 900;
          arcs.add(line);
          lines.push(line);
        }
        const key = `${answer.lat},${answer.lng}`;
        if (key !== lastAnswer) {
          lastAnswer = key;
          frameAnswer(next, answer);
          if (!reducedMotion() && lines.length) {
            for (const l of lines) l.geometry.instanceCount = 1;
            drawing = { start: performance.now() + 350, lines };
          }
        }
      } else lastAnswer = '';
      render();
    }
    /** Turns the globe to show the answer and every guess together. */
    function frameAnswer(next: MapPin[], answer: MapPin) {
      const to = vector(answer);
      const centre = next
        .reduce((sum, p) => sum.add(vector(p)), new THREE.Vector3())
        .add(to.clone().multiplyScalar(next.length))
        .normalize();
      if (centre.lengthSq() === 0) centre.copy(to);
      const spread = Math.max(...next.map((p) => centre.angleTo(vector(p))));
      const altitude = THREE.MathUtils.clamp(
        spread * 2.6 + 0.12,
        0.15,
        fitDistance() - 1,
      );
      const target = centre.multiplyScalar(1 + altitude);
      if (reducedMotion()) {
        camera.position.copy(target);
        controls.update();
      } else
        flight = {
          start: performance.now(),
          from: camera.position.clone(),
          to: target,
          ms: 1100,
        };
    }
    function reset() {
      const fit = fitDistance();
      controls.maxDistance = Math.max(8, fit);
      flight = null;
      camera.position.copy(vector({ lat: 18, lng: 8 }, fit));
      controls.update();
      render();
    }
    function zoomBy(factor: number) {
      flight = null;
      const altitude = THREE.MathUtils.clamp(
        (camera.position.length() - 1) * factor,
        minAltitude,
        controls.maxDistance - 1,
      );
      camera.position.setLength(1 + altitude);
      controls.update();
      render();
    }
    let previousFit = 0;
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      for (const l of arcs.children)
        (l as Line2).material.resolution.set(width, height);
      const fit = fitDistance();
      if (!previousFit) {
        reset();
        // The first layout may land after the reveal's pins: frame them now.
        const answer = shownPins.find((p) => p.answer);
        if (answer) frameAnswer(shownPins, answer);
      } else {
        // Preserve rotation and relative zoom across orientation changes.
        controls.maxDistance = Math.max(8, fit);
        camera.position.setLength(
          THREE.MathUtils.clamp(
            1 +
              ((camera.position.length() - 1) * (fit - 1)) / (previousFit - 1),
            controls.minDistance,
            controls.maxDistance,
          ),
        );
        controls.update();
      }
      previousFit = fit;
      render();
    });
    resize.observe(container);
    controls.addEventListener('change', render);
    controls.addEventListener('start', () => {
      flight = null;
    });
    function place(x: number, y: number) {
      if (!loaded) return;
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      const hit = ray.intersectObject(earth, false)[0];
      if (hit) pick.current?.(location(hit.point));
    }
    const pointers = new Map<number, { x: number; y: number }>();
    let start: { x: number; y: number; moved: boolean } | null = null,
      spread = 0;
    const gap = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1 && e.button === 0)
        start = { x: e.clientX, y: e.clientY, moved: false };
      else if (start) start.moved = true;
      if (pointers.size === 2) spread = gap();
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5)
        start.moved = true;
      if (pointers.size === 2) {
        const d = gap();
        if (spread > 0 && d > 0) zoomBy(spread / d);
        spread = d;
      }
    };
    const up = (e: PointerEvent) => {
      if (start && !start.moved && pointers.size === 1) {
        const box = canvas.getBoundingClientRect();
        place(
          ((e.clientX - box.left) / box.width) * 2 - 1,
          1 - ((e.clientY - box.top) / box.height) * 2,
        );
      }
      pointers.delete(e.pointerId);
      if (!pointers.size) start = null;
    };
    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (start) start.moved = true;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const px =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * 400
            : e.deltaY;
      // Trackpad pinches arrive as ctrl+wheel with small deltas.
      zoomBy(
        Math.exp(
          THREE.MathUtils.clamp(px, -120, 120) * (e.ctrlKey ? 0.01 : 0.0025),
        ),
      );
    };
    const key = (e: KeyboardEvent) => {
      if (
        ![
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          '+',
          '=',
          '-',
          'Enter',
          ' ',
          'Home',
        ].includes(e.key)
      )
        return;
      e.preventDefault();
      if (e.key === 'Home') {
        reset();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        place(0, 0);
        return;
      }
      if (!e.key.startsWith('Arrow')) {
        zoomBy(e.key === '-' ? 1.4 : 1 / 1.4);
        return;
      }
      flight = null;
      const p = location(camera.position),
        radius = camera.position.length();
      const step = (e.shiftKey ? 0.2 : 3) * Math.min(1, (radius - 1) * 1.5);
      p.lng +=
        e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      p.lat = THREE.MathUtils.clamp(
        p.lat +
          (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0),
        -89,
        89,
      );
      camera.position.copy(vector(p, radius));
      controls.update();
      render();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('keydown', key);
    const lost = (e: Event) => {
      e.preventDefault();
      setStatus('The graphics connection was lost. Retry the globe.');
    };
    canvas.addEventListener('webglcontextlost', lost);
    actions.current = { reset, pins: updatePins };
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      actions.current = null;
      resize.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', key);
      canvas.removeEventListener('webglcontextlost', lost);
      clearPins();
      for (const k of cache.keys()) dropTile(k);
      texture.dispose();
      material.dispose();
      geometry.dispose();
      haloGeometry.dispose();
      (halo.material as THREE.Material).dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [attempt]);
  useEffect(() => {
    actions.current?.pins(pins);
  }, [pins, attempt]);
  return (
    <div className="atlas-map-shell">
      <div ref={host} className="atlas-pin-map">
        {onPin && (
          <span className="atlas-globe-crosshair" aria-hidden="true">
            +
          </span>
        )}
      </div>
      {tiled && <small className="atlas-map-credit">{tileCredit}</small>}
      {status && (
        <output className="atlas-map-error">
          {status}
          {!status.startsWith('Loading') && (
            <button
              onClick={() => {
                setStatus('Loading satellite imagery…');
                setAttempt((a) => a + 1);
              }}
            >
              Retry globe
            </button>
          )}
        </output>
      )}
    </div>
  );
}
